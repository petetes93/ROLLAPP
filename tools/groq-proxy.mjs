#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · tools/groq-proxy.mjs
 * ---------------------------------------------------------------------------
 * Puente local entre el juego y Groq, pensado para no gastar un céntimo.
 *
 * La clave vive SOLO en este proceso. El navegador habla con 127.0.0.1 y
 * nunca la ve; tampoco aparece en respuestas, errores ni trazas.
 *
 * Lo que hace, y por qué:
 *
 *   · Escucha solo en 127.0.0.1. Comprueba el Host (contra el rebinding de
 *     DNS) y el Origin exacto de la app, además de CORS: CORS por sí solo no
 *     protege un servicio local.
 *   · Un único modelo permitido: openai/gpt-oss-120b. Cualquier otro se
 *     rechaza aquí. No hay modelo de respaldo ni otra nube: si Groq no
 *     puede, contesta que no y el juego sigue con el narrador procedural.
 *   · Topes propios POR DEBAJO de los de la capa Free (30 peticiones por
 *     minuto, 1.000 al día, 8.000 tokens por minuto, 200.000 al día). Un
 *     tope local no sustituye al de Groq, pero evita llegar a él.
 *   · Un 429 se devuelve con su Retry-After; si se acaba la cuota del día,
 *     se pausan las llamadas hasta que se renueve.
 *   · Idempotencia por turno: la misma petición repetida (un reintento) no
 *     gasta otra solicitud; se devuelve la misma respuesta.
 *   · Trazas sin contenido: tamaños, tiempos, tokens y estado. Nunca el
 *     texto de la partida ni la clave.
 *
 * Se arranca con `tools/iniciar-groq.mjs`, que pide la clave sin eco. Este
 * módulo exporta `crearProxyGroq` para que las pruebas lo levanten con un
 * Groq de mentira en loopback.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

/** El único modelo que este puente acepta. */
export const MODELO_PERMITIDO = 'openai/gpt-oss-120b';

/** Groq, de verdad. */
const UPSTREAM = 'https://api.groq.com/openai/v1';

/**
 * Topes propios, por debajo de los publicados para la capa Free a 25/09/2026.
 * El panel de la cuenta manda: si allí son menores, se bajan estos.
 */
export const LIMITES_LOCALES = Object.freeze({
  porMinuto: 25,
  porDia: 900,
  tokensMinuto: 7000,
  tokensDia: 180_000,
  maxTokensSalida: 1200,
  maxCaracteresEntrada: 48_000,
  maxCuerpo: 96 * 1024,
  esperaUpstreamMs: 45_000,
});

/* ═══════════════════════════════════════════════════════════════════════════
   USO
   ═══════════════════════════════════════════════════════════════════════════ */

/** Cuentas del día, en un fichero fuera del repositorio. Sin contenido. */
function almacenUso(ruta) {
  const hoy = () => new Date().toISOString().slice(0, 10);
  let datos = { dia: hoy(), peticiones: 0, tokens: 0 };
  if (ruta) {
    try {
      const leido = JSON.parse(readFileSync(ruta, 'utf8'));
      if (leido?.dia === hoy()) datos = { dia: leido.dia, peticiones: Number(leido.peticiones) || 0, tokens: Number(leido.tokens) || 0 };
    } catch { /* primera vez: sin fichero */ }
  }
  const guardar = () => {
    if (!ruta) return;
    try { mkdirSync(dirname(ruta), { recursive: true }); writeFileSync(ruta, JSON.stringify(datos)); } catch { /* sin disco: seguimos en memoria */ }
  };
  return {
    get() { if (datos.dia !== hoy()) datos = { dia: hoy(), peticiones: 0, tokens: 0 }; return datos; },
    sumar(peticiones, tokens) { const d = this.get(); d.peticiones += peticiones; d.tokens += tokens; guardar(); },
  };
}

/** Estimación grosera de tokens: ~3,5 caracteres por token en español. */
const estimar = (texto) => Math.ceil(String(texto ?? '').length / 3.5);

/* ═══════════════════════════════════════════════════════════════════════════
   PROXY
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @param {Object} op
 * @param {string} op.clave La clave de Groq. Solo en memoria.
 * @param {number} [op.puerto=11436]
 * @param {string} op.origen Origen exacto de la app, p. ej. http://localhost:8080
 * @param {string} [op.upstream] Solo para pruebas: un Groq falso en 127.0.0.1.
 * @param {Object} [op.limites]
 * @param {string|null} [op.rutaUso] Dónde guardar las cuentas del día.
 * @param {(traza: Object) => void} [op.trazar]
 * @returns {{servidor: import('node:http').Server, escuchar: () => Promise<number>, cerrar: () => Promise<void>, estado: () => Object}}
 */
export function crearProxyGroq({ clave, puerto = 11436, origen, upstream = UPSTREAM, limites = {}, rutaUso = null, trazar = () => {} }) {
  if (!clave || clave.length < 20 || /\s/.test(clave)) throw new Error('Falta una clave con forma válida.');
  if (!/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(String(origen ?? ''))) throw new Error('El origen de la app debe ser http://localhost:<puerto> o http://127.0.0.1:<puerto>.');
  if (upstream !== UPSTREAM && !/^http:\/\/127\.0\.0\.1:\d+(?:\/.*)?$/.test(upstream)) throw new Error('Solo se admite Groq o un doble de pruebas en 127.0.0.1.');

  const L = { ...LIMITES_LOCALES, ...limites };
  const uso = almacenUso(rutaUso);
  const minuto = [];            // [{t, tokens}]
  const cache = new Map();      // turno → {huella, promesa, expira}
  let pausaHasta = 0;           // cuota agotada: hasta cuándo no se llama
  let motivoPausa = null;
  let ultimosLimites = null;    // lo último que dijo Groq en sus cabeceras

  // El puerto real se conoce al escuchar (con 0, el sistema elige uno).
  let hosts = new Set([`127.0.0.1:${puerto}`, `localhost:${puerto}`]);

  function cabeceras(extra = {}) {
    return {
      'Access-Control-Allow-Origin': origen,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Arcanveil-Turno',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    };
  }

  function responder(res, estado, cuerpo, extra) {
    res.writeHead(estado, cabeceras(extra));
    res.end(JSON.stringify(cuerpo));
  }

  /** Nunca se reenvía un error crudo: solo un mensaje nuestro y un código limpio. */
  function error(res, estado, mensaje, extra = {}, codigo = null) {
    responder(res, estado, { error: { message: mensaje, code: codigo && /^[a-z_]{1,40}$/.test(codigo) ? codigo : null } }, extra);
  }

  function leerCuerpo(req) {
    return new Promise((ok, no) => {
      let tam = 0;
      const trozos = [];
      const reloj = setTimeout(() => { req.destroy(); no(Object.assign(new Error('cuerpo lento'), { estado: 408 })); }, 10_000);
      req.on('data', (b) => {
        tam += b.length;
        // Lo que pasa del tope se descarta sin guardarlo; al terminar, 413.
        if (tam <= L.maxCuerpo) trozos.push(b);
      });
      req.on('end', () => {
        clearTimeout(reloj);
        if (tam > L.maxCuerpo) { no(Object.assign(new Error('demasiado grande'), { estado: 413 })); return; }
        try { ok(JSON.parse(Buffer.concat(trozos).toString('utf8') || '{}')); } catch { no(Object.assign(new Error('JSON inválido'), { estado: 400 })); }
      });
      req.on('error', (e) => { clearTimeout(reloj); no(e); });
    });
  }

  /** Solo lo que el juego necesita, con los valores que cuidan la cuota. */
  function sanear(entrada) {
    if (entrada?.model !== MODELO_PERMITIDO) return { fallo: `Modelo no permitido. Este puente solo usa ${MODELO_PERMITIDO}.` };
    const mensajes = Array.isArray(entrada.messages) ? entrada.messages : [];
    if (mensajes.length < 2 || mensajes.length > 4) return { fallo: 'Se esperan entre 2 y 4 mensajes.' };
    if (mensajes[0]?.role !== 'system') return { fallo: 'El primer mensaje debe ser la política del narrador (system).' };
    let total = 0;
    for (const m of mensajes) {
      if (!['system', 'user', 'assistant'].includes(m?.role) || typeof m.content !== 'string') return { fallo: 'Mensaje con forma inválida.' };
      total += m.content.length;
    }
    if (total > L.maxCaracteresEntrada) return { fallo: 'El contexto del turno es demasiado largo.' };
    const maxTokens = Math.min(Math.max(Number(entrada.max_tokens) || 700, 64), L.maxTokensSalida);
    return {
      cuerpo: {
        model: MODELO_PERMITIDO,
        messages: mensajes.map((m) => ({ role: m.role, content: m.content })),
        temperature: Math.min(Math.max(Number(entrada.temperature ?? 0.8), 0), 1.2),
        max_completion_tokens: maxTokens,
        response_format: { type: 'json_object' },
        reasoning_effort: 'low',
        include_reasoning: false,
        stream: false,
      },
      estimados: estimar(mensajes.map((m) => m.content).join('')) + maxTokens,
      caracteres: total,
    };
  }

  /** ¿Cabe esta petición en los topes? */
  function cabe(estimados) {
    const ahora = Date.now();
    while (minuto.length && ahora - minuto[0].t > 60_000) minuto.shift();
    if (pausaHasta > ahora) return { no: true, dia: pausaHasta - ahora > 120_000, espera: Math.ceil((pausaHasta - ahora) / 1000), motivo: motivoPausa ?? 'cuota agotada' };
    const d = uso.get();
    if (d.peticiones + 1 > L.porDia) return { no: true, dia: true, motivo: 'tope diario de peticiones de este puente' };
    if (d.tokens + estimados > L.tokensDia) return { no: true, dia: true, motivo: 'tope diario de tokens de este puente' };
    if (minuto.length + 1 > L.porMinuto) return { no: true, espera: Math.ceil((60_000 - (ahora - minuto[0].t)) / 1000), motivo: 'tope por minuto de este puente' };
    const tokensMin = minuto.reduce((s, x) => s + x.tokens, 0);
    if (tokensMin + estimados > L.tokensMinuto) return { no: true, espera: Math.ceil((60_000 - (ahora - (minuto[0]?.t ?? ahora))) / 1000) || 1, motivo: 'tope de tokens por minuto de este puente' };
    return { no: false };
  }

  function leerLimites(h) {
    const n = (k) => { const v = h.get(k); return v == null ? null : Number(v); };
    ultimosLimites = {
      restantesPeticiones: n('x-ratelimit-remaining-requests'),
      limitePeticiones: n('x-ratelimit-limit-requests'),
      restantesTokens: n('x-ratelimit-remaining-tokens'),
      limiteTokens: n('x-ratelimit-limit-tokens'),
      renuevaPeticiones: h.get('x-ratelimit-reset-requests'),
      renuevaTokens: h.get('x-ratelimit-reset-tokens'),
    };
    // Sin peticiones en el día: se para hasta que Groq diga que renueva.
    if (ultimosLimites.restantesPeticiones === 0) {
      pausaHasta = Date.now() + Math.max(duracion(ultimosLimites.renuevaPeticiones), 60_000);
      motivoPausa = 'Groq indica que no quedan peticiones hoy';
    }
  }

  /** «2m59.56s», «7.66s», «1h2m» → milisegundos. */
  function duracion(texto) {
    let ms = 0;
    for (const [, n, u] of String(texto ?? '').matchAll(/([\d.]+)(ms|h|m|s)/g)) ms += Number(n) * ({ ms: 1, s: 1000, m: 60_000, h: 3_600_000 }[u]);
    return ms;
  }

  async function llamar(cuerpo) {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), L.esperaUpstreamMs);
    try {
      const r = await fetch(`${upstream}/chat/completions`, {
        method: 'POST',
        signal: control.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clave}` },
        body: JSON.stringify(cuerpo),
      });
      leerLimites(r.headers);
      const datos = await r.json().catch(() => ({}));
      return { estado: r.status, datos, retry: r.headers.get('retry-after') };
    } catch (e) {
      return { estado: e?.name === 'AbortError' ? 504 : 502, datos: {}, retry: null };
    } finally {
      clearTimeout(reloj);
    }
  }

  const MENSAJES = {
    400: 'Groq rechazó la forma de la petición.',
    401: 'Groq no acepta la clave: revisa que sea la de tu cuenta y que no esté revocada.',
    403: 'La cuenta no tiene acceso a este modelo.',
    404: 'El modelo no está disponible en esta cuenta.',
    413: 'El contexto del turno es demasiado largo para Groq.',
    498: 'Groq no tiene capacidad ahora mismo.',
    502: 'No se pudo hablar con Groq (red).',
    503: 'Groq no está disponible ahora mismo.',
    504: 'Groq tardó demasiado en responder.',
  };

  async function completar(req, res, inicio) {
    const turno = String(req.headers['x-arcanveil-turno'] ?? '');
    if (turno && !/^[A-Za-z0-9_.:-]{1,64}$/.test(turno)) return error(res, 400, 'Identificador de turno inválido.');

    let entrada;
    try { entrada = await leerCuerpo(req); } catch (e) { return error(res, e.estado ?? 400, e.estado === 413 ? 'Petición demasiado grande.' : 'Petición ilegible.'); }

    const s = sanear(entrada);
    if (s.fallo) return error(res, 400, s.fallo, {}, 'rechazado_por_puente');

    // Un reintento del mismo turno no gasta otra solicitud.
    const huella = createHash('sha256').update(JSON.stringify(s.cuerpo.messages)).digest('hex');
    const previo = turno ? cache.get(turno) : null;
    if (previo && previo.expira > Date.now()) {
      if (previo.huella !== huella) return error(res, 409, 'Ese turno ya se pidió con otro contenido.');
      const r = await previo.promesa;
      trazar({ ruta: 'completar', estado: r.estado, repetido: true, ms: Date.now() - inicio, turno: resumir(turno) });
      return responder(res, r.estado, r.cuerpo, r.extra);
    }

    const hueco = cabe(s.estimados);
    if (hueco.no) {
      trazar({ ruta: 'completar', estado: 429, local: true, motivo: hueco.motivo, turno: resumir(turno) });
      return error(res, 429, `Pausa: ${hueco.motivo}.`, hueco.espera ? { 'Retry-After': String(hueco.espera) } : {}, hueco.dia ? 'cuota_diaria' : 'cuota_minuto');
    }

    minuto.push({ t: Date.now(), tokens: s.estimados });
    const promesa = (async () => {
      const r = await llamar(s.cuerpo);
      // Lo cacheado (la política, idéntica cada turno) no cuenta para los
      // límites de Groq; tampoco para los nuestros.
      const cacheados = Number(r.datos?.usage?.prompt_tokens_details?.cached_tokens) || 0;
      const real = Math.max((Number(r.datos?.usage?.total_tokens) || s.estimados) - cacheados, 0);
      if (r.datos?.usage) r.datos.usage.cacheados = cacheados;
      minuto[minuto.length - 1].tokens = real;
      uso.sumar(1, real);

      if (r.estado === 200) {
        const contenido = r.datos?.choices?.[0]?.message?.content ?? '';
        return {
          estado: 200,
          cuerpo: {
            object: 'chat.completion',
            model: MODELO_PERMITIDO,
            choices: [{ index: 0, message: { role: 'assistant', content: String(contenido) }, finish_reason: r.datos?.choices?.[0]?.finish_reason ?? null }],
            usage: {
              prompt_tokens: Number(r.datos?.usage?.prompt_tokens) || null,
              completion_tokens: Number(r.datos?.usage?.completion_tokens) || null,
              total_tokens: Number(r.datos?.usage?.total_tokens) || null,
              cached_tokens: cacheados,
            },
            limites: ultimosLimites,
          },
          extra: {},
          usage: r.datos?.usage,
        };
      }

      if (r.estado === 429) {
        const espera = Number(r.retry) || 60;
        // Una espera larga es la cuota del día: se para hasta entonces.
        if (espera > 120) { pausaHasta = Date.now() + espera * 1000; motivoPausa = 'Groq indica que se ha agotado la cuota'; }
        return { estado: 429, cuerpo: { error: { message: 'Groq pide esperar: límite de la capa gratuita.', code: espera > 120 ? 'cuota_diaria' : 'cuota_minuto' } }, extra: { 'Retry-After': String(espera) } };
      }

      const codigo = typeof r.datos?.error?.code === 'string' ? r.datos.error.code : null;
      return { estado: r.estado, cuerpo: { error: { message: MENSAJES[r.estado] ?? `Groq respondió con un error ${r.estado}.`, code: codigo && /^[a-z_]{1,40}$/.test(codigo) ? codigo : null } }, extra: {} };
    })();

    if (turno) cache.set(turno, { huella, promesa, expira: Date.now() + 10 * 60_000 });
    for (const [k, v] of cache) if (v.expira < Date.now()) cache.delete(k);

    const r = await promesa;
    // Solo se recuerda lo que salió bien: tras un 429 o un fallo, el
    // reintento tiene que poder volver a pedir.
    if (turno && r.estado !== 200) cache.delete(turno);
    trazar({
      ruta: 'completar',
      estado: r.estado,
      ms: Date.now() - inicio,
      turno: resumir(turno),
      entradaCaracteres: s.caracteres,
      tokens: r.usage ? { entrada: r.usage.prompt_tokens, cacheados: r.usage.cacheados ?? 0, salida: r.usage.completion_tokens, total: r.usage.total_tokens } : null,
      restantes: ultimosLimites ? { peticiones: ultimosLimites.restantesPeticiones, tokens: ultimosLimites.restantesTokens } : null,
    });
    return responder(res, r.estado, r.cuerpo, r.extra);
  }

  /** Probar la conexión sin generar nada: se pide la lista de modelos. */
  async function probar(res, inicio) {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), 15_000);
    try {
      const r = await fetch(`${upstream}/models`, { signal: control.signal, headers: { Authorization: `Bearer ${clave}` } });
      const datos = await r.json().catch(() => ({}));
      trazar({ ruta: 'probar', estado: r.status, ms: Date.now() - inicio });
      if (!r.ok) return error(res, r.status, MENSAJES[r.status] ?? `Groq respondió con un error ${r.status}.`);
      const hay = (datos?.data ?? []).some((m) => m?.id === MODELO_PERMITIDO);
      return responder(res, 200, { ok: hay, modelo: MODELO_PERMITIDO, disponible: hay, generacion: false });
    } catch {
      return error(res, 502, MENSAJES[502]);
    } finally {
      clearTimeout(reloj);
    }
  }

  function estado() {
    const d = uso.get();
    return {
      modelo: MODELO_PERMITIDO,
      limitesLocales: { porMinuto: L.porMinuto, porDia: L.porDia, tokensMinuto: L.tokensMinuto, tokensDia: L.tokensDia },
      usoHoy: { dia: d.dia, peticiones: d.peticiones, tokens: d.tokens },
      pausa: pausaHasta > Date.now() ? { hasta: new Date(pausaHasta).toISOString(), motivo: motivoPausa } : null,
      groq: ultimosLimites,
    };
  }

  const servidor = createServer(async (req, res) => {
    const inicio = Date.now();
    // El Host lo fija el navegador: una web ajena con un DNS que apunte aquí
    // llegaría con su propio nombre y se queda fuera.
    if (!hosts.has(String(req.headers.host ?? ''))) { trazar({ ruta: 'rechazo', motivo: 'host' }); return error(res, 421, 'Host no permitido.'); }
    const origenPeticion = req.headers.origin;
    if (origenPeticion !== origen) { trazar({ ruta: 'rechazo', motivo: 'origen' }); return error(res, 403, 'Origen no permitido.'); }

    const ruta = String(req.url ?? '').split('?')[0];
    if (req.method === 'OPTIONS') { res.writeHead(204, cabeceras()); return res.end(); }
    if (req.method === 'GET' && ruta === '/estado') return responder(res, 200, estado());
    if (req.method === 'GET' && ruta === '/probar') return probar(res, inicio);
    if (req.method === 'POST' && ruta === '/v1/chat/completions') {
      if (!/^application\/json\b/.test(String(req.headers['content-type'] ?? ''))) return error(res, 415, 'Se espera JSON.');
      return completar(req, res, inicio);
    }
    return error(res, 404, 'Ruta no encontrada.');
  });
  servidor.headersTimeout = 15_000;
  servidor.requestTimeout = 60_000;

  return {
    servidor,
    estado,
    escuchar: () => new Promise((ok, no) => {
      servidor.once('error', no);
      servidor.listen(puerto, '127.0.0.1', () => {
        const real = servidor.address().port;
        hosts = new Set([`127.0.0.1:${real}`, `localhost:${real}`]);
        ok(real);
      });
    }),
    cerrar: () => new Promise((ok) => servidor.close(() => ok())),
  };
}

/** El identificador de turno, recortado a una huella que no dice nada. */
function resumir(turno) {
  return turno ? createHash('sha256').update(turno).digest('hex').slice(0, 8) : null;
}

/** Dónde guarda el puente sus cuentas y trazas: fuera del repositorio. */
export function carpetaDatos() {
  const base = process.env.LOCALAPPDATA || join(homedir(), '.local', 'share');
  return join(base, 'arcanveil');
}

/** Escribe una traza en consola y en el fichero de trazas. Sin contenido. */
export function trazadorArchivo(ruta) {
  return (t) => {
    const linea = JSON.stringify({ t: new Date().toISOString(), ...t });
    console.log(`[groq] ${linea}`);
    if (!ruta) return;
    try { mkdirSync(dirname(ruta), { recursive: true }); appendFileSync(ruta, `${linea}\n`); } catch { /* sin disco: solo consola */ }
  };
}
