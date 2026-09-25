/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ai/narrador/Verificador.js
 * ---------------------------------------------------------------------------
 * Lo que narra un modelo, contrastado con lo que el motor sabe.
 *
 * Un modelo de lenguaje escribe bien y se equivoca con aplomo: pone a hablar
 * a quien no está, da por hecho que el jugador acepta, convierte un fracaso
 * en éxito, se inventa una espada o cambia la hora. Nada de eso puede entrar
 * en la partida.
 *
 * Aquí se busca cada contradicción concreta contra la instantánea del turno
 * y se repara EN LOCAL, sin gastar otra petición: se quita la frase que
 * contradice. Si lo que queda no se sostiene (demasiado corto, o la
 * contradicción es el turno entero), se devuelve como no reparable y quien
 * llama decide: pedir una corrección o narrar con el procedural.
 *
 * No es un detector perfecto: busca patrones concretos. Lo que no reconoce
 * no lo corrige; por eso los efectos nunca dependen del texto (ver
 * `Autorizacion.js`): una frase que se cuele no cambia el estado.
 *
 * Funciones puras.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { sinAcentos } from '../../utils/text.js';

const llano = (t) => sinAcentos(String(t ?? '').toLowerCase());
const NOMBRE = '(\\p{Lu}\\p{Ll}+(?:\\s\\p{Lu}\\p{Ll}+)?)';
const VERBO_HABLA = '(?:dice|responde|contesta|susurra|murmura|gruñe|añade|pregunta|grita|replica|suelta|masculla|insiste|repite)';

/** Palabras que abren frase y no son nombres. */
const NO_NOMBRES = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'tu', 'tus', 'su', 'sus', 'mi', 'nadie', 'alguien', 'todos', 'entonces', 'luego', 'ahora', 'aqui', 'alli', 'si', 'no', 'y', 'pero', 'cuando', 'mientras', 'tras', 'desde', 'hasta', 'con', 'sin', 'por', 'para']);

/** Frases en que el narrador decide por el jugador. */
const DECIDE = [
  ['aceptas', /\b(?:acept)/], ['decides', /\b(?:decid)/], ['prometes', /\b(?:promet)/], ['juras', /\b(?:jur)/],
  ['entregas', /\b(?:entreg)/], ['pagas', /\b(?:pag)/], ['compras', /\b(?:compr)/], ['vendes', /\b(?:vend)/],
  ['te rindes', /\b(?:rind)/], ['confiesas', /\b(?:confies)/], ['te marchas', /\b(?:march|voy|me voy|me alejo|me largo)/],
  ['atacas', /\b(?:atac|golpe|ataco)/], ['le das', /\b(?:doy|le doy|entrego)/],
];
const EMOCION_IMPUESTA = /\b(?:sientes que|piensas que|te das cuenta de que|decides que|te enamoras|sientes un escalofrio)\b/;

/**
 * ¿Deja ver este texto un secreto? Se compara por raíces (las cinco primeras
 * letras de las palabras largas): «escondidas» delata a «esconde».
 *
 * @param {string} texto
 * @param {string} secreto
 * @returns {boolean}
 */
export function pareceSecreto(texto, secreto) {
  const raices = [...new Set(llano(secreto).split(/[^\p{L}]+/u).filter((w) => w.length >= 5).map((w) => w.slice(0, 5)))];
  if (raices.length < 3) return false;
  const t = llano(texto);
  return raices.filter((r) => t.includes(r)).length / raices.length >= 0.55;
}

/**
 * @typedef {Object} Problema
 * @property {string} tipo
 * @property {boolean} grave Si no se puede quitar, el turno no vale.
 * @property {string} frase La frase que lo contiene.
 * @property {string} [detalle]
 */

/** Parte en frases conservando los saltos de línea como frases propias. */
export function partirFrases(story) {
  return String(story ?? '')
    .split(/\n+/)
    .flatMap((linea) => linea.match(/[^.!?…]+(?:[.!?…]+[»"”]?|$)/gu) ?? [linea])
    .map((f) => f.trim())
    .filter(Boolean);
}

/** Similitud de dos frases por trigramas de palabras. @private */
function parecido(a, b) {
  const tri = (t) => {
    const p = llano(t).replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean);
    const s = new Set();
    for (let i = 0; i + 2 < p.length; i += 1) s.add(p.slice(i, i + 3).join(' '));
    return s;
  };
  const x = tri(a);
  const y = tri(b);
  if (!x.size || !y.size) return llano(a).trim() === llano(b).trim() ? 1 : 0;
  let comun = 0;
  for (const t of x) if (y.has(t)) comun += 1;
  return comun / Math.min(x.size, y.size);
}

/** Quién habla en una frase, si se atribuye. @private */
export function hablantesDe(frase) {
  const quien = new Set();
  const pat = [
    new RegExp(`^${NOMBRE}\\s*:\\s*[«"“—-]`, 'u'),
    new RegExp(`[»"”],?\\s*${VERBO_HABLA}\\s+${NOMBRE}`, 'u'),
    new RegExp(`${NOMBRE}\\s+${VERBO_HABLA}\\s*[:,]?\\s*[«"“]`, 'u'),
  ];
  for (const p of pat) {
    const m = frase.match(p);
    if (m && !NO_NOMBRES.has(llano(m[1]).split(' ')[0])) quien.add(m[1]);
  }
  return [...quien];
}

/**
 * Busca contradicciones entre la narración y lo que sabe el motor.
 *
 * @param {string} story
 * @param {Object} c Contexto de verificación.
 * @param {string} c.jugador Nombre del personaje.
 * @param {string} c.texto Lo que escribió el jugador.
 * @param {Array<{nombre: string, vivo?: boolean}>} c.presentes
 * @param {string[]} [c.ausentes] Nombres conocidos que no están.
 * @param {string[]} [c.muertos]
 * @param {string[]} [c.nuevos] Nombres que el modelo presenta como pnj_nuevo.
 * @param {Object|null} [c.tirada] {exito}
 * @param {boolean} [c.negativa]
 * @param {string} [c.lugar] Nombre del lugar actual.
 * @param {string[]} [c.lugares] Nombres de otros lugares conocidos.
 * @param {string} [c.franja] manana|mediodia|tarde|noche|madrugada…
 * @param {string[]} [c.secretos]
 * @param {string[]} [c.inexistentes] Palabras que el motor dice que no hay.
 * @param {string[]} [c.caidos] Combatientes caídos.
 * @param {string[]} [c.yaContado]
 * @returns {Problema[]}
 */
export function verificar(story, c) {
  const problemas = [];
  const jugadorLlano = llano(c.texto);
  const vivos = new Set((c.presentes ?? []).filter((p) => p.vivo !== false).map((p) => llano(p.nombre).split(' ')[0]));
  const nuevos = new Set((c.nuevos ?? []).map((n) => llano(n).split(' ')[0]));
  const ausentes = new Set((c.ausentes ?? []).map((n) => llano(n).split(' ')[0]));
  const muertos = new Set((c.muertos ?? []).map((n) => llano(n).split(' ')[0]));
  const nombreJugador = llano(c.jugador).split(' ')[0];
  const citasJugador = (String(c.texto ?? '').match(/«[^»]*»|"[^"]*"|“[^”]*”/gu) ?? []).map((q) => llano(q.slice(1, -1)).trim());

  for (const frase of partirFrases(story)) {
    // Lo que dice un PNJ entre comillas no es narración: «Si pagas, pasas»
    // no decide nada por el jugador.
    const n = llano(frase.replace(/«[^»]*»|"[^"]*"|“[^”]*”/gu, ' '));
    const anadir = (tipo, grave, detalle) => problemas.push({ tipo, grave, frase, detalle });

    // ─── Quién habla ──────────────────────────────────────────────────────
    for (const h of hablantesDe(frase)) {
      const k = llano(h).split(' ')[0];
      if (k === nombreJugador) {
        const cita = llano(frase.match(/«([^»]*)»/u)?.[1] ?? '').trim();
        if (!citasJugador.some((q) => q === cita)) anadir('palabras_del_jugador', true, `pone palabras en boca de ${h}`);
      } else if (muertos.has(k)) anadir('muerto_habla', true, `${h} está muerto`);
      else if (ausentes.has(k) && !vivos.has(k)) anadir('hablante_ausente', true, `${h} no está en escena`);
      else if (!vivos.has(k) && !nuevos.has(k)) anadir('hablante_desconocido', true, `${h} no está en escena`);
    }

    // ─── Decidir por el jugador ───────────────────────────────────────────
    for (const [verbo, suyo] of DECIDE) {
      if (new RegExp(`\\b${llano(verbo)}\\b`).test(n) && !suyo.test(jugadorLlano)) {
        anadir('decide_por_el_jugador', true, `«${verbo}» no lo ha escrito el jugador`);
        break;
      }
    }
    if (EMOCION_IMPUESTA.test(n)) anadir('emocion_impuesta', false, 'decide lo que siente o piensa');
    if (c.negativa && /\b(?:le entregas|le das|entregas|cedes|le pasas)\b/.test(n)) anadir('ignora_negativa', true, 'el jugador se negó');

    // ─── La tirada manda ──────────────────────────────────────────────────
    if (c.tirada && c.tirada.exito === false && /\b(?:lo consigues|lo logras|consigues|logras|con exito|sin problema|sin esfuerzo)\b/.test(n)) {
      anadir('contradice_tirada', true, 'la tirada fue un fracaso');
    }
    if (c.tirada && c.tirada.exito === true && /\b(?:fallas|no lo consigues|no logras|fracasas|no puedes)\b/.test(n)) {
      anadir('contradice_tirada', true, 'la tirada fue un éxito');
    }

    // ─── Cosas que el motor no ha dado ────────────────────────────────────
    if (/\b(?:recibes|obtienes|te entrega|te regala|te pone en la mano|ahora tienes|guardas en tu)\b/.test(n)) anadir('objeto_inventado', true, 'los objetos los da el motor');
    if (/\b(?:\d+|un|una|unas|dos|tres|cuatro|cinco|seis|diez|veinte|treinta|cincuenta|cien|varias|algunas|un punado de)\s+monedas?\b/.test(n) && /\b(?:recibes|te da|te paga|te pagan|ganas|te entrega|obtienes)\b/.test(n)) anadir('oro_inventado', true, 'el oro lo mueve el motor');

    // ─── Dónde y cuándo ───────────────────────────────────────────────────
    for (const l of c.lugares ?? []) {
      if (llano(l) === llano(c.lugar)) continue;
      if (new RegExp(`\\b(?:llegas a|entras en|estas en|te encuentras en|alcanzas)\\s+(?:el |la |los |las )?${llano(l)}\\b`).test(n)) anadir('lugar_alterado', true, `el jugador está en ${c.lugar}`);
    }
    const dia = /^(?:manana|mediodia|tarde|amanecer)$/.test(llano(c.franja));
    const noche = /^(?:noche|madrugada|anochecer)$/.test(llano(c.franja));
    if (dia && /\b(?:noche cerrada|la luna|las estrellas|anochece|a medianoche|en plena noche)\b/.test(n)) anadir('fase_horaria', false, `es ${c.franja}`);
    if (noche && /\b(?:amanece|a pleno sol|sol de mediodia|a mediodia)\b/.test(n)) anadir('fase_horaria', false, `es ${c.franja}`);

    // ─── Combate ──────────────────────────────────────────────────────────
    // El motor no tiene posiciones, coberturas ni flancos: no se narran.
    if (c.enCombate && /\b(?:(?:te cubres|se cubre|se parapeta|te parapetas|se esconde|te escondes|a cubierto) (?:tras|detras de|bajo)|flanque\w*|por el flanco|le rodea\w*|os rodean|tomas? (?:la )?posicion)\b/.test(n)) {
      anadir('geometria_inventada', false, 'el motor no tiene posiciones ni cobertura');
    }
    for (const caido of c.caidos ?? []) {
      if (new RegExp(`\\b${llano(caido)}\\b[^.]{0,40}\\b(?:ataca|golpea|lanza|embiste|muerde|dispara|carga|arremete)`).test(n)) anadir('caido_ataca', true, `${caido} ya cayó`);
    }

    // ─── Lo que no existe ─────────────────────────────────────────────────
    for (const palabra of c.inexistentes ?? []) {
      if (new RegExp(`\\b(?:el|la|los|las|un|una)\\s+${llano(palabra)}\\b`).test(n) && !/\bno hay\b|\bningun/.test(n)) anadir('hace_existir', false, `el motor dice que no hay ${palabra}`);
    }

    // ─── Secretos ─────────────────────────────────────────────────────────
    // Aquí sí cuenta lo entrecomillado: el secreto se escapa por una boca.
    if ((c.secretos ?? []).some((s) => pareceSecreto(frase, s))) anadir('secreto_filtrado', true, 'revela algo que el PNJ guarda');

    // ─── Repetición ───────────────────────────────────────────────────────
    if (frase.length >= 24 && (c.yaContado ?? []).some((y) => parecido(frase, y) >= 0.8)) anadir('repeticion', false, 'ya se contó');
  }
  return problemas;
}

/**
 * Repara en local: quita las frases con problemas. Una línea de diálogo se
 * quita entera.
 *
 * @param {string} story
 * @param {Problema[]} problemas
 * @returns {{story: string, reparable: boolean, quitadas: number}}
 */
export function repararLocal(story, problemas) {
  if (!problemas.length) return { story, reparable: true, quitadas: 0 };
  const malas = new Set(problemas.map((p) => p.frase));
  const lineas = String(story ?? '').split(/\n+/).map((linea) => {
    const frases = partirFrases(linea);
    return frases.filter((f) => !malas.has(f)).join(' ');
  }).filter((l) => l.trim());
  const nueva = lineas.join('\n');
  const quitadas = malas.size;
  // Lo que queda tiene que sostenerse: si se ha ido más de la mitad o no
  // quedan ni dos frases, no es este turno.
  const antes = partirFrases(story).length;
  const despues = partirFrases(nueva).length;
  const reparable = nueva.trim().length >= 30 && despues >= Math.max(1, Math.ceil(antes / 2));
  return { story: nueva, reparable, quitadas };
}

export default { verificar, repararLocal, partirFrases, hablantesDe };
