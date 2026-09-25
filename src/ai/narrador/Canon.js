/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ai/narrador/Canon.js
 * ---------------------------------------------------------------------------
 * El canon del jugador, entero, y lo que de él cabe en cada turno.
 *
 * Dos cosas distintas que antes se mezclaban:
 *
 *   · EL REGISTRO — lo que el jugador ha establecido, íntegro. No se poda, no
 *     se recorta y no se pierde al guardar. Cada edición deliberada lleva su
 *     procedencia, su turno y sus revisiones: si el jugador cambia un hecho,
 *     la versión anterior queda en el historial de esa entrada y deja de
 *     valer. Antes las ediciones vivían entre los «hechos» de la memoria:
 *     se truncaban a 200 caracteres y se podaban con los demás.
 *
 *   · LA PROYECCIÓN — lo que se envía a un modelo en un turno concreto. Un
 *     canon largo no cabe en una petición de la capa gratuita, así que se
 *     elige lo pertinente (lo que nombra el jugador, quién está, dónde) y se
 *     dice EXPLÍCITAMENTE qué se ha dejado fuera. Nunca se corta una entrada
 *     por la mitad: o va entera, o va en la lista de omitidas.
 *
 * Si no cabe todo, no se promete continuidad: la proyección sale marcada como
 * incompleta y el motor lo avisa. La red de seguridad no depende de lo
 * enviado: el verificador comprueba la narración contra el registro ENTERO
 * (por ejemplo, quién está muerto según el canon).
 *
 * Funciones puras. El registro es un objeto plano y serializable.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { sinAcentos } from '../../utils/text.js';

const llano = (t) => sinAcentos(String(t ?? '').toLowerCase());

export const VERSION_REGISTRO = 1;

/** Familias de predicado: dos hechos sobre lo mismo y de la misma familia chocan. */
const FAMILIAS = [
  ['vida', /\b(?:muri[oó]|muert[oa]|falleci[oó]|asesinad[oa]|mataron|vive|vivo|viva|sigue viv[oa]|esta viv[oa]|resucit)\b/],
  ['paradero', /\b(?:esta en|vive en|desaparecio|se fue a|huyo a|paradero|preso en|encerrad[oa] en)\b/],
  ['parentesco', /\b(?:es mi|era mi|es hij[oa] de|es herman[oa] de|es padre de|es madre de)\b/],
  ['posesion', /\b(?:tengo|llevo|perdi|me robaron|es mi(?:o|a)|tiene (?:el|la|mi))\b/],
];

/** Marcas de que el jugador corrige algo que ya dijo. */
const CORRIGE = /\b(?:en realidad|corrijo|cambio|ya no|al final|resulta que|a partir de ahora)\b/;

const PARIENTES = 'herman[oa]|padre|madre|hij[oa]|abuel[oa]|tio|tia|prim[oa]|espos[oa]|mujer|marido|maestr[oa]|amig[oa]|compañer[oa]|mentor[a]?';

/** Palabras en mayúscula que no son nombres. */
const NO_NOMBRE = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'mi', 'mis', 'yo', 'en', 'de', 'si', 'no', 'y', 'pero', 'cuando', 'hace', 'desde', 'ahora', 'canon', 'tras', 'hay', 'era', 'fue']);

/** Una palabra en mayúscula, con límites que entienden las tildes. */
const NOMBRE = /(?<!\p{L})(\p{Lu}\p{Ll}{2,})(?!\p{L})/gu;

/** Verbos que abren frase en una historia en primera persona. */
const VERBOS_INICIO = new Set(['busco', 'llevo', 'tengo', 'soy', 'vine', 'debo', 'naci', 'perdi', 'jure', 'vivo', 'quiero', 'necesito', 'fui', 'estoy', 'crecí', 'creci', 'sigo', 'huyo', 'escapo', 'guardo', 'odio', 'amo', 'temo']);

/**
 * De quién o de qué habla un hecho. Sirve para saber si una edición nueva
 * revisa otra anterior.
 *
 * @param {string} texto
 * @returns {string|null}
 */
export function sujetoDe(texto) {
  const t = String(texto ?? '');
  const n = llano(t);
  const pariente = n.match(new RegExp(`\\bmi (${PARIENTES})\\b`, 'u'))?.[1];
  // Un nombre propio va en mayúscula; al principio de frase también un verbo
  // («Perdí la forja»), que no es sujeto de nada.
  const nombres = [...t.matchAll(NOMBRE)].map((m) => m[1])
    .filter((w) => !NO_NOMBRE.has(llano(w)) && !VERBOS_INICIO.has(llano(w)) && !/[áéíóú]$/u.test(w));
  if (nombres.length) return llano(nombres[0]);
  if (pariente) return `mi ${pariente}`;
  return null;
}

/**
 * Las familias de predicado de un hecho. Puede tocar varias: «sigue vivo,
 * preso en Saucedo» es vida y paradero.
 * @param {string} texto
 * @returns {string[]}
 */
export function familiaDe(texto) {
  const n = llano(texto);
  return FAMILIAS.filter(([, re]) => re.test(n)).map(([f]) => f);
}

/** ¿Comparten alguna familia? */
const comparten = (a, b) => (a ?? []).some((f) => (b ?? []).includes(f));

/** Un registro vacío. */
export function crearRegistro() {
  return { version: VERSION_REGISTRO, entradas: [] };
}

let contador = 0;
const nuevoId = (turno) => `canon-${turno}-${Date.now().toString(36)}-${(contador++).toString(36)}`;

/**
 * Anota una edición deliberada del jugador.
 *
 * Si trata de lo mismo y de la misma familia que otra vigente («Aldo murió»
 * frente a «Aldo sigue vivo»), la REVISA: la entrada conserva su identidad,
 * el texto nuevo pasa a valer y el anterior queda en `revisiones`.
 *
 * @param {Object} registro
 * @param {string} texto Sin recortar.
 * @param {Object} [op]
 * @param {number} [op.turno=0]
 * @param {string} [op.fuente='jugador']
 * @returns {{registro: Object, entrada: Object, revisada: boolean, anterior: string|null}}
 */
export function anotar(registro, texto, { turno = 0, fuente = 'jugador' } = {}) {
  const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim();
  const r = { ...(registro ?? crearRegistro()), entradas: [...(registro?.entradas ?? [])] };
  const sujeto = sujetoDe(limpio);
  const familia = familiaDe(limpio);

  const i = sujeto ? r.entradas.findIndex((e) => e.vigente && e.sujeto === sujeto
    && (comparten(e.familia, familia) || CORRIGE.test(llano(limpio)))) : -1;

  if (i >= 0) {
    const vieja = r.entradas[i];
    const entrada = {
      ...vieja,
      texto: limpio,
      familia: familia.length ? familia : vieja.familia,
      turno,
      fuente,
      revisiones: [...(vieja.revisiones ?? []), { texto: vieja.texto, turno: vieja.turno, fuente: vieja.fuente }],
    };
    r.entradas[i] = entrada;
    return { registro: r, entrada, revisada: true, anterior: vieja.texto };
  }

  const entrada = { id: nuevoId(turno), sujeto, familia, texto: limpio, fuente, turno, revisiones: [], vigente: true };
  r.entradas.push(entrada);
  return { registro: r, entrada, revisada: false, anterior: null };
}

/**
 * Todo el canon, como entradas homogéneas: ediciones del jugador, su
 * historia (por frases, sin recortar ninguna) y las entidades que ha
 * nombrado (con todas sus notas y rasgos).
 *
 * @param {Object} fuentes
 * @param {Object} [fuentes.registro]
 * @param {string} [fuentes.lore]
 * @param {Array<Object>} [fuentes.entidades] De MemoryStore.canon.
 * @returns {Array<{id: string, texto: string, fuente: string, turno: number|null, sujeto: string|null, familia: string|null, prioridad: number, revisiones?: number}>}
 */
export function entradasDe({ registro = null, lore = '', entidades = [] } = {}) {
  const lista = [];
  for (const e of registro?.entradas ?? []) {
    if (!e.vigente) continue;
    lista.push({ id: e.id, texto: e.texto, fuente: 'jugador (edición deliberada)', turno: e.turno, sujeto: e.sujeto, familia: e.familia, prioridad: 3, revisiones: e.revisiones?.length ?? 0 });
  }
  const frases = String(lore ?? '').split(/(?<=[.!?…])\s+/u).map((f) => f.trim()).filter(Boolean);
  frases.forEach((f, i) => lista.push({ id: `lore-${i}`, texto: f, fuente: 'jugador (historia del personaje)', turno: 0, sujeto: sujetoDe(f), familia: familiaDe(f), prioridad: 2 }));
  for (const c of entidades ?? []) {
    const partes = [c.nombre];
    if (c.rasgos?.length) partes.push(`(${c.rasgos.join(', ')})`);
    const texto = `${partes.join(' ')}${c.notas?.length ? `: ${c.notas.join('; ')}` : ''}`;
    lista.push({ id: `entidad-${llano(c.nombre).replace(/\s+/g, '-')}`, texto, fuente: c.origen === 'importado' ? 'jugador (historia importada)' : 'jugador (nombrado jugando)', turno: c.turno ?? null, sujeto: llano(c.nombre), familia: familiaDe(texto), prioridad: 1, menciones: c.menciones ?? 1 });
  }
  return lista;
}

/**
 * Choques entre lo que vale: una edición del jugador frente a su historia
 * sobre lo mismo y de la misma familia. La edición manda, pero se dice.
 *
 * @param {ReturnType<typeof entradasDe>} entradas
 * @returns {Array<{sujeto: string, familia: string, vale: string, sustituye: string}>}
 */
export function conflictosDe(entradas) {
  const choques = [];
  const ediciones = entradas.filter((e) => e.prioridad === 3 && e.sujeto && e.familia?.length);
  for (const ed of ediciones) {
    for (const otra of entradas) {
      if (otra === ed || otra.prioridad === 3 || otra.sujeto !== ed.sujeto || !comparten(otra.familia, ed.familia)) continue;
      if (llano(otra.texto) === llano(ed.texto)) continue;
      choques.push({ sujeto: ed.sujeto, familia: ed.familia.filter((f) => otra.familia.includes(f)).join(', '), vale: ed.texto, sustituye: otra.texto });
    }
  }
  return choques;
}

/**
 * Lo que va en este turno.
 *
 * Primero lo pertinente (lo que nombra el jugador, quién está, dónde se
 * está), luego las ediciones del jugador, luego su historia, luego el resto.
 * Entra lo que cabe ENTERO; lo demás se lista como omitido.
 *
 * @param {Object} fuentes Lo de `entradasDe`.
 * @param {Object} [op]
 * @param {string} [op.texto] Lo que escribe el jugador.
 * @param {string[]} [op.nombres] Presentes y lugar.
 * @param {number} [op.presupuesto=2400] Caracteres.
 * @returns {{entradas: Object[], omitidas: Array<{id: string, resumen: string}>, total: number, completa: boolean, conflictos: Object[]}}
 */
export function proyectar(fuentes, { texto = '', nombres = [], presupuesto = 2400 } = {}) {
  const todas = entradasDe(fuentes);
  const claves = [llano(texto), ...nombres.map(llano)].join(' ');
  const pertinente = (e) => (e.sujeto && claves.includes(e.sujeto) ? 10 : 0)
    + llano(e.texto).split(/[^\p{L}]+/u).filter((w) => w.length >= 5 && claves.includes(w)).length;
  const orden = todas
    .map((e, i) => ({ e, i, p: pertinente(e) }))
    .sort((a, b) => b.p - a.p || b.e.prioridad - a.e.prioridad || (b.e.menciones ?? 0) - (a.e.menciones ?? 0) || a.i - b.i);

  const entradas = [];
  const omitidas = [];
  let usado = 0;
  for (const { e } of orden) {
    // Lo que cuesta de verdad: la entrada tal como viaja, en JSON.
    const item = { id: e.id, texto: e.texto, fuente: e.fuente, turno: e.turno, ...(e.revisiones ? { revisada: e.revisiones } : {}) };
    const coste = JSON.stringify(item).length + 1;
    if (usado + coste <= presupuesto) {
      entradas.push(item);
      usado += coste;
    } else {
      omitidas.push({ id: e.id, resumen: e.texto.slice(0, 60) });
    }
  }
  // La historia del personaje se lee mejor en su orden.
  entradas.sort((a, b) => (a.id.startsWith('lore-') && b.id.startsWith('lore-') ? Number(a.id.slice(5)) - Number(b.id.slice(5)) : 0));
  return { entradas, omitidas, total: todas.length, completa: omitidas.length === 0, conflictos: conflictosDe(todas) };
}

/**
 * Quién está muerto según el canon entero (lo último que vale). Es la red
 * del verificador: aunque la entrada no quepa en la petición, un muerto no
 * habla.
 *
 * @param {Object} fuentes
 * @returns {string[]} Nombres.
 */
export function muertosSegunCanon(fuentes) {
  const muertos = new Set();
  const vivos = new Set();
  for (const e of entradasDe(fuentes).sort((a, b) => a.prioridad - b.prioridad)) {
    const n = llano(e.texto);
    const nombres = [...e.texto.matchAll(NOMBRE)].map((m) => m[1]).filter((w) => !NO_NOMBRE.has(llano(w)) && !VERBOS_INICIO.has(llano(w)));
    if (!nombres.length) continue;
    const muere = /\b(?:muri[oó]|esta muert[oa]|falleci[oó]|lo mataron|la mataron|fue asesinad[oa])\b/.test(n);
    const vive = /\b(?:sigue viv[oa]|esta viv[oa]|no murio|sobrevivio)\b/.test(n);
    for (const x of nombres) {
      // Lo que vale es lo último: las ediciones pesan más que la historia.
      if (vive) { vivos.add(x); muertos.delete(x); } else if (muere) { muertos.add(x); vivos.delete(x); }
    }
  }
  return [...muertos];
}

export default { crearRegistro, anotar, entradasDe, proyectar, conflictosDe, muertosSegunCanon, sujetoDe, familiaDe };
