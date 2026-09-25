/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · engine/Interpretacion.js
 * ---------------------------------------------------------------------------
 * Lo que ha escrito el jugador, entendido ANTES de que nadie lo narre.
 *
 * «Le pregunto al carretero qué necesita» en una escena sin carretero lo
 * contestaba la mercader que había al lado. «Examino el eje» sin carro se
 * narraba con el río de fondo. «No voy a darte mis monedas» salía como «No
 * vas a darte tus monedas». Los tres fallos son el mismo: se narraba sin
 * haber resuelto primero a quién y a qué se refiere el jugador.
 *
 * Aquí se construye una representación explícita del turno:
 *
 *   · segmentos en orden (los de `Segmentos.js`), cada uno con su tipo,
 *     su polaridad, si es pregunta o hipótesis y las palabras literales;
 *   · a quién se dirige, resuelto contra la escena;
 *   · cada persona, cosa o suceso concreto que nombra, con su estado:
 *     presente, mencionado de fondo, conocido pero ausente, visto en otra
 *     escena o inexistente.
 *
 * Si lo que se va a resolver en este turno depende de algo que no existe, se
 * dice y el turno no se narra como hecho. Da igual quién narre: el
 * procedural y el modelo de lenguaje reciben la misma interpretación.
 *
 * Funciones puras. La escena se construye con `escenaDesde` a partir de una
 * función de lectura del estado.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { segmentar, ordenar, TIPO_SEGMENTO } from './Segmentos.js';
import { actoDeHabla } from './ActoDeHabla.js';
import { rasgosDe } from '../data/rasgos.data.js';
import { sinAcentos } from '../utils/text.js';

/** Estados posibles de un referente. */
export const ESTADO_REF = Object.freeze({
  PRESENTE: 'presente',
  MENCIONADO: 'mencionado',
  AUSENTE: 'ausente_conocido',
  OTRA_ESCENA: 'otra_escena',
  AMBIGUO: 'ambiguo',
  INEXISTENTE: 'inexistente',
  PROPIO: 'propio',
});

const llano = (t) => sinAcentos(String(t ?? '').toLowerCase());

/* ═══════════════════════════════════════════════════════════════════════════
   LÉXICO
   ---------------------------------------------------------------------------
   Solo lo que tiene que EXISTIR para poder tocarlo. «Miro alrededor» o «con
   calma» no se comprueban: no son cosas. Tampoco lo que hay en cualquier
   pueblo (una puerta, la calle, el suelo): no se exige que alguien lo haya
   descrito antes de que el jugador lo mire.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Personas por oficio o papel, en masculino singular. */
const PERSONAS = [
  // Gente sin oficio, nombrada por cómo es: «la anciana del pueblo».
  'anciano', 'viejo', 'mujer', 'hombre', 'chico', 'muchacho', 'crio', 'joven', 'forastero', 'desconocido',
  'tabernero', 'posadero', 'mesonero', 'herrero', 'carretero', 'guardia', 'barquero', 'mercader',
  'sacerdote', 'cazador', 'pastor', 'buhonero', 'alcalde', 'soldado', 'capitan', 'cobrador',
  'boticario', 'curandero', 'panadero', 'pescador', 'minero', 'tendero', 'mozo', 'arriero',
  'aprendiz', 'cocinero', 'escriba', 'carnicero', 'molinero', 'lenador', 'nino', 'vigia',
  'encapuchado', 'centinela', 'lavandero', 'juglar', 'mendigo', 'ladron', 'bandido', 'monje',
  'sacerdotisa', 'noble', 'caballero', 'granjero', 'labrador', 'hortelano', 'porquero', 'cabrero',
];

/** Cosas concretas que hay que tener delante para tocarlas. */
const COSAS = [
  'carro', 'carreta', 'carretilla', 'carromato', 'carruaje', 'diligencia', 'rueda', 'eje',
  'caballo', 'yegua', 'mula', 'burro', 'asno', 'buey', 'cabra', 'oveja', 'cerdo', 'perro',
  'gato', 'gallina', 'vaca', 'toro', 'halcon', 'cuervo', 'barca', 'bote', 'balsa', 'barcaza',
  'barco', 'cofre', 'arcon', 'caja', 'barril', 'tonel', 'saco', 'fardo', 'cesta', 'cuerda',
  'soga', 'escalera', 'pozo', 'fuente', 'puente', 'torre', 'muralla', 'valla', 'huerto',
  'establo', 'granero', 'molino', 'fragua', 'yunque', 'altar', 'estatua', 'tumba', 'cripta',
  'cueva', 'porton', 'verja', 'reja', 'trampilla', 'hoguera', 'fogata', 'jaula', 'cadena',
  'trampa', 'cadaver', 'estandarte', 'bandera', 'cartel', 'tablon', 'pretil', 'garita',
  'balanza', 'tenderete', 'ancla', 'red', 'rio', 'lago', 'arroyo', 'fruta', 'colgante',
];

/** Sucesos: no se escucha una disputa que no está pasando. */
const SUCESOS = [
  'disputa', 'pelea', 'discusion', 'rina', 'trifulca', 'reyerta', 'incendio', 'fiesta', 'boda',
  'entierro', 'funeral', 'juicio', 'subasta', 'procesion', 'ejecucion', 'ahorcamiento',
  'torneo', 'duelo', 'combate',
];

/** Palabras que no son personas aunque acaben como oficios. */
const PRONOMBRES = new Set(['el', 'ella', 'ellos', 'ellas', 'usted', 'ti', 'mi', 'todos', 'nadie', 'alguien', 'quien']);

/** Formas de una palabra del léxico: género y número. */
function formas(base, persona) {
  const r = base.replace(/[oa]$/, '');
  const f = new Set([base, `${base}s`, `${base}es`]);
  if (persona && /[oa]$/.test(base)) for (const s of ['o', 'a', 'os', 'as']) f.add(r + s);
  if (/[aeiou]$/.test(base)) f.add(`${base}s`);
  else f.add(`${base}es`);
  if (base.endsWith('z')) f.add(`${base.slice(0, -1)}ces`);
  return [...f];
}

/** Índice palabra → {base, clase}. */
const INDICE = new Map();
for (const [lista, clase] of [[PERSONAS, 'persona'], [COSAS, 'cosa'], [SUCESOS, 'suceso']]) {
  for (const base of lista) for (const f of formas(base, clase === 'persona')) if (!INDICE.has(f)) INDICE.set(f, { base, clase });
}

const esPlural = (palabra, base) => palabra !== base && /s$/.test(palabra);

/* ═══════════════════════════════════════════════════════════════════════════
   ESCENA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Escena
 * @property {{id: string|null, nombre: string, terreno: string|null}} lugar
 * @property {Array<{id: string, nombre: string, rol: string, lugar?: string|null, vivo?: boolean}>} presentes
 * @property {Array<{id: string, nombre: string, rol: string, lugar?: string|null, vivo?: boolean}>} conocidos Los que no están.
 * @property {string} aqui Texto llano de todo lo que hay o se ha dicho en esta escena.
 * @property {Array<{lugar: string, texto: string}>} antes Lo narrado en otros sitios.
 * @property {string[]} propio Lo que lleva el personaje.
 * @property {string|null} interlocutor refId del último con quien habló.
 */

/**
 * Construye la escena desde el estado.
 *
 * Lo que cuenta como «aquí» es lo que el MUNDO ha puesto delante: el lugar,
 * sus rasgos, las situaciones de este sitio, el encuentro activo y los
 * elementos de escena registrados (`world.elementos`). La bitácora no
 * cuenta: el eco de «si el guardia me amenaza» contiene «el guardia», y con
 * eso aparecía un guardia en escena. Lo de otros lugares queda aparte, para
 * distinguir «el carro que viste en el vado» de «un carro que nunca existió».
 *
 * @param {(ruta: string, defecto?: any) => any} leer
 * @param {Object} [extra]
 * @param {string[]} [extra.textos] Más texto de escena (encuentro, situaciones).
 * @param {Array<{lugar: string, texto: string}>} [extra.antes] Lo de otros lugares.
 * @returns {Escena}
 */
export function escenaDesde(leer, extra = {}) {
  const lugarId = leer('world.ubicacion', null);
  const lugares = leer('world.localizaciones.porId', {}) ?? {};
  const ficha = lugarId ? (lugares[lugarId] ?? {}) : {};
  const conocidosPorId = leer('npcs.conocidos.porId', {}) ?? {};
  const presentesIds = new Set(leer('npcs.presentes', []) ?? []);

  const persona = (n) => ({ id: n.refId ?? n.id, nombre: n.nombre ?? '', rol: n.rol ?? '', lugar: n.lugar ?? null, vivo: n.vivo !== false && n.estado !== 'muerto', visto: n.ultimoEncuentro ?? -1 });
  const todos = Object.values(conocidosPorId).filter(Boolean).map(persona);
  const presentes = todos.filter((n) => presentesIds.has(n.id));
  const conocidos = todos.filter((n) => !presentesIds.has(n.id));

  const trozos = [ficha.nombre, ficha.descripcion, ficha.resumen];
  // Las palabras clave de los rasgos son lo que el sitio TIENE (la balanza
  // del mercado, el pretil del puente): cuentan sin artículo delante.
  const fijos = new Set();
  for (const r of rasgosDe(lugarId, ficha.terreno) ?? []) {
    for (const p of String(r.palabras ?? '').split('|')) fijos.add(llano(p).trim());
    trozos.push(r.ve);
  }
  trozos.push(...(extra.textos ?? []));

  // Los elementos de escena registrados: aquí cuentan; en otro sitio, son
  // lo que se vio antes.
  const antes = (extra.antes ?? []).map((a) => ({ lugar: a.lugar, texto: llano(a.texto) }));
  for (const [lugar, lista] of Object.entries(leer('world.elementos', {}) ?? {})) {
    for (const e of lista ?? []) {
      if (lugar === lugarId) trozos.push(e.texto);
      else antes.push({ lugar, texto: llano(e.texto) });
    }
  }

  const inventario = Object.values(leer('inventory.objetos.porId', {}) ?? {}).map((o) => llano(o?.nombre)).filter(Boolean);

  return {
    lugar: { id: lugarId, nombre: ficha.nombre ?? '', terreno: ficha.terreno ?? null },
    presentes,
    conocidos,
    aqui: llano(trozos.filter(Boolean).join(' \n ')),
    antes,
    papeles: extra.papeles ?? [],
    fijos,
    propio: inventario,
    // Con quien habló hace poco sigue siendo a quien se dirige sin nombrarlo.
    interlocutor: [...presentes].sort((a, b) => b.visto - a.visto).find((p) => p.visto >= leer('meta.turno', 0) - 3)?.id ?? null,
    nombreLugar: (id) => lugares[id]?.nombre ?? null,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   REFERENTES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * ¿Aparece la palabra en el texto como algo que está ahí?
 *
 * Una mención con artículo o determinante cuenta; una palabra suelta dentro
 * de una lista de precios («cinco con carro») no. Y el plural genérico («por
 * los carros») solo vale si se pregunta por varios.
 *
 * @private
 */
function aparece(texto, palabras, { plural = false } = {}) {
  for (const p of palabras) {
    const pl = /s$/.test(p);
    if (pl && !plural) continue;
    const det = pl ? '(?:unos|unas|los|las|sus|dos|tres|varios|varias|estos|esos)' : '(?:un|una|el|la|al|del|su|este|esta|ese|esa|aquel|aquella|otro|otra)';
    if (new RegExp(`\\b${det}\\s+(?:\\p{L}+\\s+)?${p}\\b`, 'u').test(texto)) return true;
  }
  return false;
}

/**
 * La palabra tal y como la escribió el jugador (con sus tildes): el aviso
 * dice «ningún capitán», no «ningún capitan».
 * @private
 */
function superficie(texto, palabra) {
  return (String(texto ?? '').toLowerCase().match(/\p{L}+/gu) ?? []).find((w) => llano(w) === palabra) ?? palabra;
}

/** Referentes que nombra un trozo de texto. @private */
function extraerReferentes(texto) {
  const n = llano(texto).replace(/«[^»]*»|"[^"]*"|“[^”]*”/g, ' ');
  const vistos = new Map();
  const patron = /\b(?:el|la|los|las|al|del|un|una|unos|unas|su|sus|mi|mis|ese|esa|este|esta|aquel|aquella|otro|otra)\s+(\p{L}+)/gu;
  let m;
  while ((m = patron.exec(n))) {
    const palabra = m[1];
    const e = INDICE.get(palabra);
    if (!e || vistos.has(e.base)) continue;
    // «su carro», «mi caballo»: con posesivo de primera persona es suyo.
    const propio = /^(?:mi|mis)\s/.test(m[0]);
    vistos.set(e.base, { palabra, superficie: superficie(texto, palabra), base: e.base, clase: e.clase, plural: esPlural(palabra, e.base), propio });
  }
  return [...vistos.values()];
}

/**
 * Resuelve un referente contra la escena.
 *
 * @param {{palabra: string, base: string, clase: string, plural: boolean, propio: boolean}} ref
 * @param {Escena} escena
 * @returns {Object} El referente con `estado` y, si lo hay, a quién o dónde.
 */
export function resolverReferente(ref, escena) {
  const variantes = formas(ref.base, ref.clase === 'persona');
  const conRol = (lista) => lista.filter((p) => variantes.some((v) => new RegExp(`\\b${v.replace(/s$/, '')}`).test(llano(p.rol))));

  if (ref.clase === 'persona') {
    // El papel que tiene en lo que está pasando cuenta como su oficio: en el
    // peaje, «el cobrador» es Lumán aunque de oficio sea guardia.
    const papel = (escena.papeles ?? []).find((p) => variantes.includes(p.papel));
    if (papel) {
      const aqui = escena.presentes.find((x) => x.id === papel.quien?.id);
      if (aqui) return { ...ref, estado: ESTADO_REF.PRESENTE, quien: aqui };
      const fuera = escena.conocidos.find((x) => x.id === papel.quien?.id) ?? { id: papel.quien?.id, nombre: papel.quien?.nombre, lugar: null };
      return { ...ref, estado: ESTADO_REF.AUSENTE, quien: fuera, lugar: fuera.lugar ?? null };
    }
    const aqui = conRol(escena.presentes);
    if (aqui.length === 1 || (aqui.length > 1 && ref.plural)) return { ...ref, estado: ESTADO_REF.PRESENTE, quien: aqui[0] };
    if (aqui.length > 1) return { ...ref, estado: ESTADO_REF.AMBIGUO, candidatos: aqui.map((p) => p.nombre) };
    if (aparece(escena.aqui, variantes, { plural: ref.plural })) return { ...ref, estado: ESTADO_REF.MENCIONADO };
    const fuera = conRol(escena.conocidos);
    if (fuera.length) return { ...ref, estado: ESTADO_REF.AUSENTE, quien: fuera[0], lugar: fuera[0].lugar };
    return { ...ref, estado: ESTADO_REF.INEXISTENTE };
  }

  if (ref.propio && escena.propio.some((o) => variantes.some((v) => o.includes(v)))) return { ...ref, estado: ESTADO_REF.PROPIO };
  if (escena.propio.some((o) => variantes.some((v) => new RegExp(`\\b${v}\\b`).test(o)))) return { ...ref, estado: ESTADO_REF.PROPIO };
  if (variantes.some((v) => escena.fijos?.has(v))) return { ...ref, estado: ESTADO_REF.PRESENTE, fijo: true };
  if (aparece(escena.aqui, variantes, { plural: ref.plural })) return { ...ref, estado: ESTADO_REF.PRESENTE };
  const otra = escena.antes.find((a) => aparece(a.texto, variantes, { plural: ref.plural }));
  if (otra) return { ...ref, estado: ESTADO_REF.OTRA_ESCENA, lugar: otra.lugar, yaNo: otra.lugar === escena.lugar.id };
  return { ...ref, estado: ESTADO_REF.INEXISTENTE };
}

/* ═══════════════════════════════════════════════════════════════════════════
   DESTINATARIO
   ═══════════════════════════════════════════════════════════════════════════ */

const VERBO_A = /\b(?:pregunt\w*|dig[oa]|decirle|habl\w*|cuent[oa]|contarle|explic\w*|pid[oa]|pedirle|exij[oa]|grit\w*|contest\w*|respond\w*|advier\w*|supli\w*|ofrezc\w*|ofrec\w*|propong\w*|salud\w*|ayud\w*|interrog\w*|amenaz\w*|enseñ\w*|ensen\w*|muestr\w*|entreg\w*|d[oa]y?)\s+(?:a\s+(?:la|los|las)\s+|al\s+|a\s+|con\s+(?:el|la)\s+|con\s+)(\p{L}+)/u;

/**
 * A quién se dirige un segmento.
 *
 * @param {string} texto
 * @param {Escena} escena
 * @returns {Object|null} `{estado, quien?, palabra?, implicito?}` o null si no habla a nadie.
 */
export function resolverDestinatario(texto, escena) {
  const n = llano(texto);
  const todos = [...escena.presentes, ...escena.conocidos];

  // Un nombre propio pesa más que un oficio: «le pregunto a Marlo».
  const porNombre = todos.find((p) => p.nombre && new RegExp(`\\b${llano(p.nombre).split(/\s+/)[0]}\\b`).test(n));
  const m = n.match(VERBO_A);
  const palabra = m?.[1] ?? null;

  if (porNombre && (!palabra || llano(porNombre.nombre).startsWith(palabra))) {
    const aqui = escena.presentes.includes(porNombre);
    if (!aqui) return { estado: ESTADO_REF.AUSENTE, quien: porNombre, lugar: porNombre.lugar };
    if (!porNombre.vivo) return { estado: ESTADO_REF.INEXISTENTE, quien: porNombre, muerto: true };
    return { estado: ESTADO_REF.PRESENTE, quien: porNombre };
  }

  if (palabra && !PRONOMBRES.has(palabra)) {
    const e = INDICE.get(palabra);
    if (e?.clase === 'persona') return { ...resolverReferente({ palabra, superficie: superficie(texto, palabra), base: e.base, clase: 'persona', plural: esPlural(palabra, e.base), propio: false }, escena), palabra };
    // Un nombre que el juego no conoce: no se sabe quién es.
    if (/^[a-zñ]{3,}$/.test(palabra) && !INDICE.has(palabra) && /[A-ZÁÉÍÓÚÑ]/.test(texto.match(new RegExp(`\\b${palabra}`, 'iu'))?.[0]?.[0] ?? '')) {
      return { estado: ESTADO_REF.INEXISTENTE, palabra, nombrePropio: true };
    }
  }

  // Sin decir a quién: al que ya se hablaba, o al único que hay.
  const habla = /\b(?:le|les)\s+\p{L}+|\b(?:pregunt|dig[oa]|cuent[oa]|contest|respond)\w*|\?|«|citaImplicita/u.test(n);
  if (!habla) return null;
  const previo = escena.presentes.find((p) => p.id === escena.interlocutor);
  if (previo) return { estado: ESTADO_REF.PRESENTE, quien: previo, implicito: true };
  if (escena.presentes.length === 1) return { estado: ESTADO_REF.PRESENTE, quien: escena.presentes[0], implicito: true };
  if (escena.presentes.length > 1) return { estado: ESTADO_REF.AMBIGUO, candidatos: escena.presentes.map((p) => p.nombre), implicito: true };
  return { estado: ESTADO_REF.INEXISTENTE, implicito: true };
}

/* ═══════════════════════════════════════════════════════════════════════════
   NORMALIZACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Corrige la tilde de más en un verbo que abre frase: «Examinó el eje» es
 * «Examino el eje». El jugador escribe en primera persona; un pretérito en
 * tercera al principio de lo que hace es una errata, no otro sujeto.
 *
 * @param {string} texto
 * @returns {string}
 */
export function corregirErratas(texto) {
  return String(texto ?? '').replace(/(^|[.;,!?]\s*|\sy\s+)(\p{L}{3,})ó(?=\s|[.,;]|$)/gu, (_, a, raiz) => `${a}${raiz}o`);
}

/* ═══════════════════════════════════════════════════════════════════════════
   INTERPRETACIÓN DEL TURNO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Interpretacion
 * @property {string} original Lo que escribió, tal cual.
 * @property {string} texto Con las erratas de tilde corregidas.
 * @property {Array<Object>} segmentos Cada uno con destinatario y referentes.
 * @property {Object} plan La forma de `ordenar()`: foco, hechos, pendientes…
 * @property {Object|null} destinatario El del foco.
 * @property {Object|null} bloqueo Si el foco depende de algo que no está.
 * @property {string[]} aclaraciones Lo que no existe en segmentos secundarios.
 */

/**
 * Interpreta el turno contra la escena.
 *
 * @param {string} entrada
 * @param {Escena} escena
 * @returns {Interpretacion}
 */
export function interpretarTurno(entrada, escena) {
  const original = String(entrada ?? '').trim();
  const texto = corregirErratas(original);
  const brutos = segmentar(texto);

  let cursor = 0;
  const segmentos = brutos.map((s) => {
    const desde = texto.indexOf(s.texto, cursor);
    if (desde >= 0) cursor = desde + s.texto.length;
    const hablado = s.tipo === TIPO_SEGMENTO.DIALOGO || s.pregunta;
    const destinatario = hablado ? resolverDestinatario(s.citaImplicita ? `citaImplicita ${s.texto}` : s.texto, escena) : null;
    // Lo que se nombra dentro de una pregunta a alguien es el tema, no algo
    // que haya que tocar: «le pregunto a Marlo por la cabra» no exige cabra.
    const referentes = (hablado ? [] : extraerReferentes(s.texto)).map((r) => resolverReferente(r, escena));
    // Si pasa algo hipotético dentro de una pregunta («qué hará si no
    // apartamos el carro»), no es una condición del jugador ni un hecho.
    const hipotesis = s.pregunta && /\bsi\b/u.test(llano(s.texto)) && s.tipo !== TIPO_SEGMENTO.CONDICIONAL;
    return {
      ...s,
      span: desde >= 0 ? [desde, desde + s.texto.length] : null,
      polaridad: s.negativa ? 'negativa' : 'afirmativa',
      hipotesis,
      destinatario,
      referentes,
      // Qué hace al hablar: preguntar, ofrecer ayuda, dar las gracias…
      acto: actoDeHabla(s.texto),
    };
  });

  const plan = ordenar(segmentos);
  const foco = plan.foco;
  const aclaraciones = [];
  let bloqueo = null;

  if (foco) {
    const d = foco.destinatario;
    if (d && [ESTADO_REF.INEXISTENTE, ESTADO_REF.AUSENTE].includes(d.estado) && !d.implicito) {
      bloqueo = { motivo: 'destinatario', ...d, texto: frasePersona(d, escena) };
    } else {
      const falta = foco.referentes.find((r) => [ESTADO_REF.INEXISTENTE, ESTADO_REF.OTRA_ESCENA, ESTADO_REF.AUSENTE].includes(r.estado));
      if (falta) bloqueo = { motivo: 'referente', ...falta, texto: falta.clase === 'persona' ? frasePersona(falta, escena) : fraseCosa(falta, escena) };
    }
  }

  for (const s of plan.hechos) {
    if (s === foco) continue;
    for (const r of s.referentes) {
      if (r.estado === ESTADO_REF.INEXISTENTE) aclaraciones.push(r.clase === 'persona' ? frasePersona(r, escena) : fraseCosa(r, escena));
      if (r.estado !== ESTADO_REF.PRESENTE && r.estado !== ESTADO_REF.PROPIO && r.estado !== ESTADO_REF.MENCIONADO) s.sinReferente = true;
    }
  }

  const acto = foco?.acto ?? actoDeHabla(texto);
  return { original, texto, segmentos, plan, destinatario: foco?.destinatario ?? null, acto, bloqueo, aclaraciones };
}

/* ═══════════════════════════════════════════════════════════════════════════
   LO QUE SE DICE CUANDO FALTA ALGO
   ═══════════════════════════════════════════════════════════════════════════ */

/** Artículo indefinido negativo: «ningún carro», «ninguna disputa». */
const femenina = (palabra) => { const p = llano(palabra); return /a$|ion$|dad$|red$/.test(p) && !/^(?:guardia|centinela|vigia|dia|mapa)$/.test(p); };
function ninguno(palabra) {
  return `${femenina(palabra) ? 'ninguna' : 'ningún'} ${palabra}`;
}

/** Quién hay delante, en una línea. @private */
function quienHay(escena) {
  const p = escena.presentes.filter((x) => x.vivo);
  if (!p.length) return 'Aquí no hay nadie más.';
  const lista = p.map((x) => (x.rol ? `${x.nombre} (${x.rol})` : x.nombre));
  return `Aquí están ${lista.length > 1 ? `${lista.slice(0, -1).join(', ')} y ${lista.at(-1)}` : lista[0]}.`;
}

/** @private */
function frasePersona(ref, escena) {
  if (ref.muerto && ref.quien) return `${ref.quien.nombre} ya no puede contestar.`;
  if (ref.estado === ESTADO_REF.AUSENTE && ref.quien) {
    // Nombrado por su oficio, se le pone nombre: «el carretero» es Elrén.
    const porOficio = ref.palabra && !llano(ref.quien.nombre).startsWith(llano(ref.palabra));
    const quien = porOficio ? `${femenina(llano(ref.palabra)) ? 'La' : 'El'} ${ref.palabra}, ${ref.quien.nombre},` : ref.quien.nombre;
    if (!ref.lugar || ref.lugar === escena.lugar.id) return `${quien} ya se ha ido de aquí. ${quienHay(escena)}`;
    const donde = escena.nombreLugar?.(ref.lugar);
    return `${quien} no está aquí.${donde ? ` La última vez estaba en ${donde}.` : ''} ${quienHay(escena)}`;
  }
  if (ref.nombrePropio) return `No conoces a nadie con ese nombre por aquí. ${quienHay(escena)}`;
  const palabra = String(ref.superficie ?? ref.palabra ?? '').replace(/s$/, '');
  return `No has visto a ${ninguno(palabra)} por aquí. ${quienHay(escena)}`;
}

/** @private */
function fraseCosa(ref, escena) {
  const palabra = String(ref.superficie ?? ref.palabra).replace(/s$/, '');
  if (ref.estado === ESTADO_REF.OTRA_ESCENA) {
    const donde = escena.nombreLugar?.(ref.lugar);
    const art = femenina(palabra) ? (ref.plural ? 'Las' : 'La') : (ref.plural ? 'Los' : 'El');
    // Se sabe que estuvo; que siga, no. Se dice lo que se sabe.
    if (ref.yaNo) return `Lo de ${art.toLowerCase()} ${ref.superficie ?? ref.palabra} ya pasó, y ahora no ${ref.plural ? 'los' : 'lo'} ves por aquí.`.replace(/de el /, 'del ');
    return `${art} ${ref.palabra} que ${ref.plural ? 'viste estaban' : 'viste estaba'} ${donde ? `en ${donde}` : 'en otro sitio'}; aquí no ${ref.plural ? 'están' : 'está'}.`;
  }
  if (ref.clase === 'suceso') return `No hay ${ninguno(palabra)} a la vista.`;
  return `Aquí no hay ${ninguno(palabra)}.`;
}


export default { interpretarTurno, escenaDesde, resolverReferente, resolverDestinatario, corregirErratas, ESTADO_REF };
