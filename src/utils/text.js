/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · utils/text.js
 * ---------------------------------------------------------------------------
 * Manipulación de texto en castellano.
 *
 * El motor genera mucha prosa a partir de plantillas y de datos, y el
 * castellano tiene concordancias que el inglés no: género, artículos
 * contraídos, plurales irregulares. Resolverlo aquí evita que cada sistema se
 * invente su propia chapuza.
 *
 * Sin dependencias.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* ═══════════════════════════════════════════════════════════════════════════
   BÁSICOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Primera letra en mayúscula, resto intacto.
 * @param {string} s
 * @returns {string}
 */
export function capitalizar(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Capitaliza cada palabra, respetando las partículas que en castellano van en
 * minúscula dentro de un nombre propio ('Torre de los Vientos').
 * @param {string} s
 * @returns {string}
 */
export function titulo(s) {
  const particulas = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'a', 'al']);
  return String(s)
    .split(/\s+/)
    .map((p, i) => (i > 0 && particulas.has(p.toLowerCase()) ? p.toLowerCase() : capitalizar(p)))
    .join(' ');
}

/**
 * Trunca añadiendo puntos suspensivos, cortando por palabra para no partir
 * ninguna por la mitad.
 * @param {string} s
 * @param {number} max
 * @returns {string}
 */
export function truncar(s, max) {
  const t = String(s);
  if (t.length <= max) return t;
  const corte = t.slice(0, max - 1);
  const espacio = corte.lastIndexOf(' ');
  return `${espacio > max * 0.6 ? corte.slice(0, espacio) : corte}…`;
}

/**
 * Elimina los acentos. Necesario para buscar y ordenar sin que 'Árbol' quede
 * después de 'Zorro'.
 * @param {string} s
 * @returns {string}
 */
export function sinAcentos(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Palabras que abren frase y pueden ir en minúscula al quedar en medio. */
const COMUNES = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'alguien', 'nadie', 'hay', 'se', 'lo', 'le', 'les', 'su', 'sus',
  'en', 'de', 'con', 'por', 'para', 'cuando', 'al', 'del', 'que', 'este', 'esta', 'ese', 'esa', 'aquel', 'aquella', 'todo', 'toda', 'todos', 'todas',
  'medio', 'media', 'entre', 'tras', 'desde', 'hace', 'mi', 'mis', 'tu', 'tus', 'nuestro', 'nuestra', 'era', 'fue', 'es', 'no', 'ya', 'si', 'muy',
  'mucho', 'mucha', 'poco', 'poca', 'otro', 'otra', 'cada', 'algo', 'dos', 'tres']);

/**
 * Pone en minúscula la primera letra para seguir una frase, pero solo si la
 * primera palabra es común: «Rora intentó…» no pasa a «rora intentó…».
 * @param {string} s
 * @returns {string}
 */
export function seguirFrase(s) {
  const t = String(s ?? '').trim();
  const primera = sinAcentos(t.split(/\s+/)[0] ?? '').toLowerCase();
  return COMUNES.has(primera) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

/**
 * Convierte a slug apto para identificadores y clases CSS.
 * @param {string} s
 * @returns {string} 'La Posada del Yunque' → 'la-posada-del-yunque'
 */
export function slug(s) {
  return sinAcentos(String(s))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Escapa caracteres peligrosos para insertar texto en HTML.
 *
 * Importante: el director de juego produce texto arbitrario y no fiable. Todo
 * lo que venga de él debe pasar por aquí, o insertarse con textContent.
 *
 * @param {string} s
 * @returns {string}
 */
export function escapar(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Normaliza espacios: colapsa los múltiples y recorta los extremos.
 * @param {string} s
 * @returns {string}
 */
export function limpiar(s) {
  return String(s).replace(/\s+/g, ' ').trim();
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONCORDANCIA EN CASTELLANO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Plural de un sustantivo, siguiendo las reglas generales.
 * No cubre todas las irregularidades del idioma, pero sí el vocabulario típico
 * de un juego de rol.
 *
 * @param {string} palabra
 * @returns {string} 'espada' → 'espadas' · 'anillo' → 'anillos' · 'raíz' → 'raíces'
 */
export function plural(palabra) {
  const p = String(palabra);
  if (!p) return p;

  const ultima = p.slice(-1).toLowerCase();
  const dosUltimas = p.slice(-2).toLowerCase();

  if ('aeiou'.includes(ultima)) return `${p}s`;
  if (ultima === 'z') return `${p.slice(0, -1)}ces`;
  if (dosUltimas === 'ón') return `${p.slice(0, -2)}ones`;
  if ('íú'.includes(ultima)) return `${p}es`;
  if ('sx'.includes(ultima)) return p;              // invariable si es llana
  return `${p}es`;
}

/**
 * Concuerda un sustantivo con su cantidad.
 * @param {number} n
 * @param {string} singular
 * @param {string} [pluralExplicito] Para irregulares.
 * @returns {string} '1 poción' · '3 pociones'
 */
export function contar(n, singular, pluralExplicito) {
  const palabra = n === 1 ? singular : (pluralExplicito ?? plural(singular));
  return `${n} ${palabra}`;
}

/**
 * Artículo determinado concordado.
 * @param {string} palabra
 * @param {'m'|'f'} [genero='m']
 * @param {boolean} [esPlural=false]
 * @returns {string} 'el' | 'la' | 'los' | 'las'
 */
export function articulo(palabra, genero = 'm', esPlural = false) {
  if (esPlural) return genero === 'f' ? 'las' : 'los';
  // 'el agua', 'el hacha': femeninos que empiezan por a/ha tónica.
  if (genero === 'f' && /^h?[aá]/i.test(sinAcentos(palabra))) return 'el';
  return genero === 'f' ? 'la' : 'el';
}

/**
 * Artículo indeterminado concordado.
 * @param {string} palabra
 * @param {'m'|'f'} [genero='m']
 * @returns {string} 'un' | 'una'
 */
export function articuloIndet(palabra, genero = 'm') {
  if (genero === 'f' && /^h?[aá]/i.test(sinAcentos(palabra))) return 'un';
  return genero === 'f' ? 'una' : 'un';
}

/**
 * Concuerda un participio o adjetivo en -o con el género de quien lo lleva.
 *
 * «Brunhilda queda envenenado»: los estados se escriben en masculino en el
 * catálogo y se pegaban tal cual. Los gerundios («sangrando», «ardiendo») y
 * lo que no acaba en -o («invisible») no cambian.
 *
 * @param {string} palabra
 * @param {'m'|'f'} [genero='m']
 * @returns {string}
 */
export function concordar(palabra, genero = 'm') {
  const p = String(palabra ?? '');
  if (genero !== 'f' || /(?:ando|endo)$/i.test(p) || !/o$/i.test(p)) return p;
  return `${p.slice(0, -1)}${p.endsWith('O') ? 'A' : 'a'}`;
}

/**
 * Una preposición seguida de un nombre propio que empieza por artículo.
 *
 * Casi la mitad de los lugares se llaman «El Vado del Yunque», «La Forja
 * Alta»… y metidos a media frase salía «Emprendes el camino hacia El Camino
 * del Norte» o «Ir a el Mercado». El artículo baja a minúscula y se contrae
 * cuando toca: «al Vado», «del Vado». El resto del nombre no se toca.
 *
 * @param {string} preposicion «hacia», «a», «de», «por»…
 * @param {string} nombre
 * @returns {string} «hacia el Camino del Norte», «al Vado del Yunque»
 */
export function trasPreposicion(preposicion, nombre) {
  const n = String(nombre ?? '');
  const m = n.match(/^(El|La|Los|Las)\s+(.+)$/u);
  if (!m) return `${preposicion} ${n}`;

  const art = m[1].toLowerCase();
  const p = preposicion.toLowerCase();
  const mayus = /^[A-ZÁÉÍÓÚ]/u.test(preposicion);

  if (art === 'el' && (p === 'a' || p === 'de')) {
    const contraida = p === 'a' ? 'al' : 'del';
    return `${mayus ? capitalizar(contraida) : contraida} ${m[2]}`;
  }

  return `${preposicion} ${art} ${m[2]}`;
}

/**
 * Une elementos en una enumeración natural.
 * @param {string[]} lista
 * @param {string} [conjuncion='y']
 * @returns {string} 'espada, escudo y poción'
 */
export function enumerar(lista, conjuncion = 'y') {
  const l = lista.filter(Boolean);
  if (l.length === 0) return '';
  if (l.length === 1) return l[0];

  // 'y' se vuelve 'e' ante palabra que empieza por i/hi (pero no 'hie').
  let conj = conjuncion;
  const ultimo = sinAcentos(l[l.length - 1]).toLowerCase();
  if (conjuncion === 'y' && /^(i|hi(?!e))/.test(ultimo)) conj = 'e';
  if (conjuncion === 'o' && /^(o|ho)/.test(ultimo)) conj = 'u';

  return `${l.slice(0, -1).join(', ')} ${conj} ${l[l.length - 1]}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PLANTILLAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Sustituye marcadores {clave} por valores.
 * Un marcador sin valor se deja intacto: así se ve el hueco en vez de un
 * 'undefined' en mitad de la narración.
 *
 * @param {string} plantilla
 * @param {Record<string, *>} datos
 * @returns {string}
 *
 * @example
 * interpolar('{nombre} empuña {arma}.', { nombre: 'Iven', arma: 'la daga' });
 */
export function interpolar(plantilla, datos) {
  return String(plantilla).replace(/\{(\w+)\}/g, (coincidencia, clave) => {
    const v = datos[clave];
    return v === undefined || v === null ? coincidencia : String(v);
  });
}

/**
 * Divide un texto en párrafos por líneas en blanco. Es como llegan los bloques
 * narrativos del director.
 * @param {string} texto
 * @returns {string[]}
 */
export function parrafos(texto) {
  return String(texto)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Cuenta palabras. Se usa para verificar que la narración respeta la longitud
 * pedida al director.
 * @param {string} texto
 * @returns {number}
 */
export function palabras(texto) {
  const t = limpiar(texto);
  return t ? t.split(' ').length : 0;
}

/**
 * Detecta si el texto termina en signo de puntuación fuerte. Útil para decidir
 * si hay que cerrar una frase truncada.
 * @param {string} texto
 * @returns {boolean}
 */
export function terminaFrase(texto) {
  return /[.!?…»"]\s*$/.test(String(texto).trim());
}

export default {
  capitalizar, titulo, truncar, sinAcentos, slug, escapar, limpiar,
  plural, contar, articulo, articuloIndet, enumerar,
  interpolar, parrafos, palabras, terminaFrase,
};
