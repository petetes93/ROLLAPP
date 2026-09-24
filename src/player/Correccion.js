/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · player/Correccion.js
 * ---------------------------------------------------------------------------
 * «¿Te gusta así o quieres cambiar algo?»
 *
 * Tras crear el personaje, el jugador corrige con sus palabras: «mejor que sea
 * hombre», «que se llame Brun», «ponle una cicatriz en el ojo», «que sea
 * elfa», «más joven». Antes, para cambiar una cosa había que rehacerlo todo.
 *
 * Es un lector de reglas, sin modelo: funciona sin conexión y responde al
 * instante. Lo que no entiende lo dice, y lo que no se toca se conserva.
 *
 * El cambio de sexo es lo delicado. No basta con cambiar un campo: la
 * descripción es el encargo del retrato, y «enana guerrera» seguiría pintando
 * una mujer. Se cambian las palabras que hablan de la persona —«enana
 * guerrera» pasa a «enano guerrero»— y NO las que concuerdan con otra cosa:
 * en «barba trenzada pelirroja», «pelirroja» va con la barba.
 *
 * Funciones puras.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { RAZAS } from '../data/races.data.js';
import { CLASES } from '../data/classes.data.js';
import { sinAcentos } from '../utils/text.js';

/* ═══════════════════════════════════════════════════════════════════════════
   VOCABULARIO
   ═══════════════════════════════════════════════════════════════════════════ */

/** Lo que significa «así está bien, empezamos». */
const CONFIRMA = /^(?:si|vale|ok|okay|perfecto|genial|me gusta|asi (?:esta )?bien|asi vale|esta bien|empezamos|empecemos|empieza|adelante|listo|venga|dale|comenzar|comienza|a jugar|jugamos|vamos)\b/;

/** Sustantivos de persona: femenino → masculino. */
const PERSONA = Object.freeze({
  mujer: 'hombre', chica: 'chico', muchacha: 'muchacho', señora: 'señor', dama: 'caballero',
  elfa: 'elfo', enana: 'enano', orca: 'orco', humana: 'humano', mediana: 'mediano',
  guerrera: 'guerrero', exploradora: 'explorador', cazadora: 'cazador', rastreadora: 'rastreador',
  maga: 'mago', hechicera: 'hechicero', bruja: 'brujo', ladrona: 'ladrón', bandida: 'bandido',
  sacerdotisa: 'sacerdote', monja: 'monje', herrera: 'herrero', erudita: 'erudito', barda: 'bardo',
  juglaresa: 'juglar', mercenaria: 'mercenario', soldada: 'soldado', viajera: 'viajero',
  pastora: 'pastor', marinera: 'marinero', curandera: 'curandero', princesa: 'príncipe',
});

/**
 * Adjetivos que concuerdan con la persona. Solo se cambian si van pegados a
 * un sustantivo de persona: «enana pelirroja» sí, «barba pelirroja» no.
 */
const ADJETIVOS = Object.freeze({
  pelirroja: 'pelirrojo', morena: 'moreno', rubia: 'rubio', anciana: 'anciano',
  alta: 'alto', baja: 'bajo', delgada: 'delgado', fornida: 'fornido', robusta: 'robusto',
  vieja: 'viejo', canosa: 'canoso', menuda: 'menudo', corpulenta: 'corpulento',
  tuerta: 'tuerto', calva: 'calvo', flaca: 'flaco', guapa: 'guapo', callada: 'callado',
});

// Índices sin tildes en los dos sentidos: se busca por la palabra tal como
// quede tras `llano` («señora» → «senora»), se devuelve la forma escrita.
const indice = (mapa, sentido) => Object.fromEntries(Object.entries(mapa)
  .map(([f, m]) => (sentido === 'aM' ? [sinAcentos(f), m] : [sinAcentos(m), f])));
const A_MASCULINO = { ...indice(PERSONA, 'aM') };
const A_FEMENINO = { ...indice(PERSONA, 'aF') };
const ADJ_A_MASCULINO = indice(ADJETIVOS, 'aM');
const ADJ_A_FEMENINO = indice(ADJETIVOS, 'aF');

/** Especies que el jugador escribe (no los linajes del juego). */
const ESPECIES = ['elfa', 'elfo', 'enana', 'enano', 'orca', 'orco', 'humana', 'humano', 'mediana', 'mediano'];

/* ═══════════════════════════════════════════════════════════════════════════
   PIEZAS
   ═══════════════════════════════════════════════════════════════════════════ */

const llano = (t) => sinAcentos(String(t ?? '').toLowerCase());

/** Conserva la mayúscula inicial de la palabra original. */
function comoEra(original, nueva) {
  return /^[A-ZÁÉÍÓÚÑ]/u.test(original) ? nueva.charAt(0).toUpperCase() + nueva.slice(1) : nueva;
}

/**
 * Pasa a otro sexo las palabras que hablan de la persona.
 *
 * Se recorre la descripción palabra a palabra. Un sustantivo de persona se
 * cambia siempre y abre una «cadena»; un adjetivo solo se cambia dentro de
 * esa cadena. Cualquier otra palabra —«de», «con», una coma— la corta.
 *
 * @param {string} descripcion
 * @param {'m'|'f'} genero El sexo al que se pasa.
 * @returns {string}
 */
export function cambiarSexo(descripcion, genero) {
  const sustantivos = genero === 'm' ? A_MASCULINO : A_FEMENINO;
  const adjetivos = genero === 'm' ? ADJ_A_MASCULINO : ADJ_A_FEMENINO;

  let enCadena = false;

  return String(descripcion ?? '').split(/(\s+|[,.;:])/u).map((trozo) => {
    if (!trozo || /^\s+$/u.test(trozo)) return trozo;
    // La coma y la «y» enumeran adjetivos de la misma persona («anciana, alta
    // y tuerta»): no cortan la cadena. El punto sí.
    if (trozo === ',' || /^[ye]$/iu.test(trozo)) return trozo;
    if (/^[.;:]$/u.test(trozo)) { enCadena = false; return trozo; }

    const k = llano(trozo);
    if (sustantivos[k]) { enCadena = true; return comoEra(trozo, sustantivos[k]); }
    if (adjetivos[k] && enCadena) return comoEra(trozo, adjetivos[k]);

    enCadena = false;
    return trozo;
  }).join('');
}

/**
 * ¿La descripción habla de una mujer, de un hombre, o no lo dice?
 *
 * Mira la primera palabra de persona: «enana guerrera» es una mujer aunque la
 * ficha aleatoria dijera otra cosa.
 *
 * @param {string} descripcion
 * @returns {'f'|'m'|null}
 */
export function sexoDescrito(descripcion) {
  return sexoDe(descripcion);
}

function sexoDe(descripcion) {
  for (const p of llano(descripcion).split(/[^a-zñ]+/u)) {
    if (A_MASCULINO[p]) return 'f';
    if (A_FEMENINO[p]) return 'm';
  }
  return null;
}

/** Nombre del linaje o de la clase, en masculino y femenino, sin tildes. */
function formas(nombre) {
  const base = llano(nombre);
  const femenina = base.endsWith('o') ? `${base.slice(0, -1)}a`
    : base.endsWith('or') ? `${base}a`
      : base.endsWith('es') ? `${base}a`
        : base;
  return [base, femenina];
}

/* ═══════════════════════════════════════════════════════════════════════════
   LECTURA DE UNA CORRECCIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Aplica una frase de corrección a la ficha.
 *
 * Puede llevar varias cosas a la vez: «que sea hombre y que se llame Brun».
 *
 * @param {Object} personaje Ficha actual: nombre, genero, raza, clase, retrato, lore.
 * @param {string} texto Lo que escribió el jugador.
 * @returns {{personaje: Object, cambios: string[], confirmar: boolean, entendido: boolean}}
 */
export function aplicarCorreccion(personaje, texto) {
  const original = String(texto ?? '').trim();
  const frase = llano(original).replace(/[¡!¿?]/g, '').trim();
  let p = { ...personaje };
  const cambios = [];

  if (!frase) return { personaje: p, cambios, confirmar: false, entendido: false };
  if (CONFIRMA.test(frase)) return { personaje: p, cambios, confirmar: true, entendido: true };

  // Varias órdenes en una frase: se parten por «y», comas y puntos cuando lo
  // que sigue abre otra orden.
  const ordenes = original
    .split(/\s*(?:[.;]|,|\by\b)\s*(?=(?:que|ponle|pon|quitale|quítale|quita|añade|añádele|anade|mejor|llamal|llámal|hazl|dale|sin|mas|más|su nombre|se llama|de oficio|linaje)\b)/iu)
    .filter(Boolean);

  for (const orden of ordenes) {
    const r = aplicarUna(p, orden);
    if (r) { p = r.personaje; cambios.push(r.cambio); }
  }

  return { personaje: p, cambios, confirmar: false, entendido: cambios.length > 0 };
}

/**
 * Una sola orden. Devuelve null si no la entiende.
 * @private
 */
function aplicarUna(p, orden) {
  const t = llano(orden);

  // ─── Nombre ─────────────────────────────────────────────────────────────
  const nombre = orden.match(/\b(?:que se llame|ll[aá]mal[aoe]|ponle de nombre|su nombre (?:es|ser[aá])|se llama)\s+([A-Za-zÁÉÍÓÚáéíóúÑñ'-]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ'-]+)?)/u)?.[1];
  if (nombre) {
    const limpio = nombre.charAt(0).toUpperCase() + nombre.slice(1);
    return { personaje: { ...p, nombre: limpio.slice(0, 28) }, cambio: `Ahora se llama ${limpio}.` };
  }

  // ─── Sexo ───────────────────────────────────────────────────────────────
  const aHombre = /\b(?:hombre|chico|varon|masculino|un tio|muchacho)\b/.test(t) && /\b(?:que sea|mejor|hazlo|es|sea|ahora)\b/.test(t);
  const aMujer = /\b(?:mujer|chica|femenina|una tia|muchacha)\b/.test(t) && /\b(?:que sea|mejor|hazla|es|sea|ahora)\b/.test(t);
  if (aHombre || aMujer) {
    const genero = aHombre ? 'm' : 'f';
    let retrato = cambiarSexo(p.retrato ?? '', genero);
    // Si la descripción no decía nada del sexo, se dice: el retrato lo lee
    // de ahí.
    if (!sexoDe(retrato)) retrato = `${genero === 'm' ? 'hombre' : 'mujer'}, ${retrato}`.replace(/,\s*$/u, '');
    return { personaje: { ...p, genero, retrato }, cambio: genero === 'm' ? 'Ahora es un hombre.' : 'Ahora es una mujer.' };
  }

  // ─── Especie, tal como la escribe el jugador ───────────────────────────
  const especie = ESPECIES.find((e) => new RegExp(`\\b(?:que sea|mejor|hazl[ao]|es|sea|ahora)\\s+(?:una?\\s+)?${e}\\b`).test(t));
  if (especie) {
    const genero = /a$/.test(especie) ? 'f' : 'm';
    let retrato = String(p.retrato ?? '');
    const re = new RegExp(`\\b(?:${ESPECIES.join('|')})\\b`, 'iu');
    retrato = re.test(llano(retrato))
      ? retrato.replace(new RegExp(`\\b(?:${ESPECIES.join('|')})\\b`, 'iu'), (m) => comoEra(m, especie))
      : `${especie}, ${retrato}`.replace(/,\s*$/u, '');
    retrato = cambiarSexo(retrato, genero);
    return { personaje: { ...p, genero, retrato }, cambio: `Ahora es ${genero === 'f' ? 'una' : 'un'} ${especie}.` };
  }

  // ─── Linaje del juego ───────────────────────────────────────────────────
  for (const raza of Object.values(RAZAS)) {
    const [m, f] = formas(raza.nombre);
    if (new RegExp(`\\b(?:que sea|mejor|linaje|de linaje|sea|es)\\s+(?:de\\s+)?(?:una?\\s+)?(?:${m}|${f})\\b`).test(t)) {
      return { personaje: { ...p, raza: raza.refId }, cambio: `Su linaje es ahora ${raza.nombre}.` };
    }
  }

  // ─── Oficio ─────────────────────────────────────────────────────────────
  for (const clase of Object.values(CLASES)) {
    const [m, f] = formas(clase.nombre);
    if (new RegExp(`\\b(?:que sea|mejor|oficio|de oficio|clase|sea|es)\\s+(?:de\\s+)?(?:una?\\s+)?(?:${m}|${f})\\b`).test(t)) {
      return { personaje: { ...p, clase: clase.refId }, cambio: `Su oficio es ahora ${clase.nombre}.` };
    }
  }

  // ─── Edad ───────────────────────────────────────────────────────────────
  if (/\b(?:mas joven|joven|jovencit)/.test(t)) {
    const retrato = quitarTrozos(p.retrato, /\b(?:viej|ancian|canos|mayor)/u);
    return { personaje: { ...p, retrato: `${retrato}, joven`.replace(/^,\s*/u, '') }, cambio: 'Ahora es más joven.' };
  }
  if (/\b(?:mas mayor|mas viej|viej|ancian|mayor)\b/.test(t)) {
    const retrato = quitarTrozos(p.retrato, /\bjoven/u);
    const ancian = p.genero === 'f' ? 'anciana' : 'anciano';
    return { personaje: { ...p, retrato: `${retrato}, ya ${ancian}`.replace(/^,\s*/u, '') }, cambio: 'Ahora tiene más años encima.' };
  }

  // ─── Quitar un rasgo ────────────────────────────────────────────────────
  const quita = t.match(/\b(?:quitale|quita|sin|que no tenga|fuera)\s+(?:la |el |los |las |un |una |su |sus )?([a-zñ]{3,})/)?.[1];
  if (quita) {
    const antes = String(p.retrato ?? '');
    const retrato = quitarRasgo(antes, quita.slice(0, Math.max(4, quita.length - 1)));
    if (retrato !== antes) return { personaje: { ...p, retrato }, cambio: `Fuera ${quita}.` };
    return null;
  }

  // ─── Añadir un rasgo ────────────────────────────────────────────────────
  const pone = orden.match(/\b(?:p[oó]nle|pon|a[ñn][aá]dele|a[ñn]ade|dale|que tenga|con)\s+(.{3,80})$/iu)?.[1];
  if (pone) {
    const rasgo = pone.replace(/[.!]+$/u, '').trim();
    const retrato = `${String(p.retrato ?? '').replace(/[.\s]+$/u, '')}, con ${rasgo}`.replace(/^,\s*/u, '');
    return { personaje: { ...p, retrato: retrato.slice(0, 360) }, cambio: `Añadido: ${rasgo}.` };
  }

  return null;
}

/**
 * Quita un rasgo sin llevarse lo que va delante.
 *
 * En «enana guerrera de barba trenzada pelirroja», quitar la barba deja
 * «enana guerrera»: se corta desde el «de» o el «con» que la introduce. Si el
 * rasgo abre el trozo («barba larga»), se va el trozo entero.
 *
 * @private
 */
function quitarRasgo(descripcion, raiz) {
  const tiene = new RegExp(`\\b${raiz}`, 'u');

  return String(descripcion ?? '')
    .split(/\s*,\s*/u)
    .map((trozo) => {
      if (!tiene.test(llano(trozo))) return trozo;
      const palabras = trozo.split(/\s+/u);
      const i = palabras.findIndex((w) => tiene.test(llano(w)));
      // ¿La introduce un «de», «con» o «y», con o sin artículo en medio?
      let corte = i;
      while (corte > 0 && /^(?:la|el|los|las|un|una|su|sus)$/iu.test(palabras[corte - 1])) corte -= 1;
      if (corte > 0 && /^(?:de|con|y)$/iu.test(palabras[corte - 1])) corte -= 1;
      return corte > 0 ? palabras.slice(0, corte).join(' ') : '';
    })
    .filter(Boolean)
    .join(', ');
}

/**
 * Quita de la descripción los trozos (entre comas) que casan con un patrón.
 * @private
 */
function quitarTrozos(descripcion, patron) {
  return String(descripcion ?? '')
    .split(/\s*,\s*/u)
    .filter((trozo) => trozo && !patron.test(llano(trozo)))
    .join(', ');
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESUMEN DEL NARRADOR
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Oficio o linaje en el género del personaje: «rastreadora», «ferrana».
 * @private
 */
function enSuGenero(nombre, genero) {
  const [m, f] = formas(nombre);
  const elegido = genero === 'f' ? f : m;
  // Se recupera la tilde de la forma original si la tenía.
  return elegido === llano(nombre) ? nombre.toLowerCase() : elegido;
}

/**
 * Dos o tres frases sobre el personaje, y la pregunta.
 *
 * Solo cuenta lo que hay en la ficha: nombre, oficio, linaje, lo que escribió
 * de su aspecto y la primera frase de su historia, citada con sus palabras
 * para no cambiarle la persona gramatical.
 *
 * @param {Object} p
 * @returns {string}
 */
export function resumenPersonaje(p = {}) {
  const genero = p.genero === 'f' ? 'f' : 'm';
  const clase = CLASES[p.clase]?.nombre;
  const raza = RAZAS[p.raza]?.nombre;

  // El oficio concuerda con la persona («rastreadora»); el linaje, con la
  // palabra «linaje», que es masculina: «de linaje ferrano» siempre.
  const quien = [
    clase ? enSuGenero(clase, genero) : null,
    raza ? `de linaje ${raza.toLowerCase()}` : null,
  ].filter(Boolean).join(' ');

  const frases = [`${p.nombre ?? 'Tu personaje'}${quien ? `, ${quien}` : ''}.`];

  const aspecto = String(p.retrato ?? '').trim().replace(/[.\s]+$/u, '');
  if (aspecto) frases.push(`${aspecto.charAt(0).toUpperCase()}${aspecto.slice(1)}.`);

  const historia = String(p.lore ?? '').trim().split(/(?<=[.!?…])\s+/u)[0];
  if (historia) frases.push(`Carga con esto: «${historia.replace(/[.\s]+$/u, '')}».`);

  return frases.join(' ');
}

export const PREGUNTA_CREACION = '¿Te gusta así o quieres cambiar algo?';

export default { aplicarCorreccion, cambiarSexo, resumenPersonaje, PREGUNTA_CREACION };
