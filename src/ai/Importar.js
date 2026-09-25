/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ai/Importar.js
 * ---------------------------------------------------------------------------
 * Traer una historia que ya existe.
 *
 * Mucha gente llega a este juego con una partida ya empezada en otro sitio: un
 * hilo de ChatGPT, un documento, las notas de una campaña de mesa. Tiene un
 * personaje con nombre, compañeros, lugares y una trama a medias. Obligarle a
 * resumir todo eso en tres campos de texto es tirar meses de historia.
 *
 * Esto lee ese texto y saca lo que hace falta para arrancar: quién es cada
 * cual, dónde ocurre y qué está pendiente. Lo que salga va al canon —ver
 * `Cronica.js`—, así que desde el primer turno el juego habla de SU gente por
 * su nombre y diciendo de ellos lo que él ya tenía escrito.
 *
 * ── Qué mira ─────────────────────────────────────────────────────────────
 *
 * La señal fuerte es el guion de diálogo: un texto narrativo marca quién habla
 * con «Lyssara:» al principio de línea, y eso no admite otra lectura. Quien
 * habla, existe. Alrededor de esa lista se cuentan menciones, se recogen las
 * frases que describen a cada uno y se separan lugares y objetos.
 *
 * ── Lo que NO hace ───────────────────────────────────────────────────────
 *
 * No decide quién es el protagonista. Lo propone —el que más habla y al que
 * más nombran— y lo elige el jugador, porque acertar el 90 % de las veces
 * significa equivocarse en el 10 % con el personaje de alguien, y eso no se
 * arregla con una heurística mejor.
 *
 * Tampoco resume ni reescribe. Recorta y ordena. Lo que el jugador escribió es
 * suyo y llega al juego con sus palabras.
 *
 * Funciones puras.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { motivoAjeno } from './narrador/Canon.js';

/* ═══════════════════════════════════════════════════════════════════════════
   RUIDO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Lo que un volcado de conversación trae pegado y no es historia.
 *
 * Una página compartida de ChatGPT viene con su cabecera, su aviso de que la
 * IA puede equivocarse y sus tres sugerencias del final. Sin quitarlo, «ChatGPT
 * es una IA y puede equivocarse» acabaría siendo un personaje.
 */
const RUIDO = [
  /^esta es una copia de un chat compartido.*$/gim,
  /^informar sobre la conversaci[oó]n$/gim,
  /^chatgpt es una ia y puede equivocarse\.?$/gim,
  /^si quieres,? puedo:?$/gim,
  /^omitir e ir al contenido$/gim,
  /^(iniciar sesi[oó]n|reg[ií]strate|compartir)$/gim,
  /^usamos cookies[\s\S]*?pol[ií]tica de cookies\.?$/gim,
  /^(aceptar todas|rechazar las que no son esenciales)$/gim,
  // Marcas de tiempo del volcado: «mar, 25 ago a la(s) 11:25».
  /^\w{3},\s+\d{1,2}\s+\w{3}\s+a\s+la\(s\)\s+[\d:]+$/gim,
];

/**
 * Nombres que un volcado trae y no son personajes de la historia.
 *
 * La segunda mitad son palabras que abren frase a todas horas. Están aquí
 * porque la prueba de «verlo a mitad de frase» tiene un agujero: dentro de una
 * cita —«"Por el Creador. Por el Equilibrio."»— la segunda mitad parece ir en
 * mitad de línea, y «Por» se colaba como personaje. Una lista corta cierra el
 * caso mejor que una expresión regular más lista.
 */
const NO_PERSONAJE = new Set([
  'chatgpt', 'gpt', 'usuario', 'user', 'asistente', 'sistema', 'narrador',
  'tu', 'tú', 'yo', 'el', 'la', 'los', 'las', 'pausa', 'silencio', 'fin',

  'por', 'para', 'con', 'sin', 'desde', 'hasta', 'ahora', 'despues', 'después',
  'entonces', 'pero', 'una', 'uno', 'cuando', 'mientras', 'todo', 'todos',
  'algo', 'alguien', 'nadie', 'nada', 'mas', 'más', 'menos', 'solo', 'sólo',
  'muy', 'tan', 'aunque', 'porque', 'entre', 'sobre', 'bajo', 'tras', 'antes',
  'primero', 'despues', 'luego', 'aqui', 'aquí', 'alli', 'allí', 'asi', 'así',
  'esto', 'eso', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'aquel',
  'otra', 'otro', 'otras', 'otros', 'cada', 'algunos', 'algunas', 'varios',
  'incluso', 'quiza', 'quizá', 'tal', 'cual', 'quien', 'donde', 'como',
]);

/* ═══════════════════════════════════════════════════════════════════════════
   LECTURA
   ═══════════════════════════════════════════════════════════════════════════ */

const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Quita del texto lo que es del contenedor y no de la historia.
 *
 * Eso incluye las instrucciones que se le dieron a la otra IA (un MASTER
 * PROMPT pegado al principio del hilo, «Eres el narrador…», «4 · MEMORIA»):
 * son reglas de narración, no gente ni hechos del mundo, y sin quitarlas
 * acababan como notas del canon.
 */
function limpiarVolcado(texto) {
  let t = String(texto ?? '').replace(/\r\n/g, '\n');
  for (const r of RUIDO) t = t.replace(r, '');
  t = t.split('\n').filter((linea) => motivoAjeno(linea) !== 'instruccion').join('\n');
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Quién habla en el texto, y cuánto.
 *
 * El guion de diálogo es la señal más fiable que hay: nadie escribe
 * «Lyssara:» al principio de una línea por accidente. Se acepta también la
 * forma en versalita —«NÚCLEO:»— que se usa para entidades.
 *
 * @param {string} texto
 * @returns {Map<string, number>} nombre → veces que habla
 */
function quienHabla(texto) {
  const cuenta = new Map();

  for (const m of texto.matchAll(/^\s*([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñü'’ -]{1,28}?)\s*:\s*$/gmu)) {
    const nombre = m[1].trim();
    const plano = sinTildes(nombre).toLowerCase();

    if (NO_PERSONAJE.has(plano) || nombre.length < 3) continue;

    // «NÚCLEO» y «Núcleo» son el mismo. Se guarda la forma más legible.
    const clave = plano;
    const previo = [...cuenta.keys()].find((k) => sinTildes(k).toLowerCase() === clave);

    if (previo) cuenta.set(previo, cuenta.get(previo) + 1);
    else cuenta.set(/^[A-ZÁÉÍÓÚÑ\s]+$/u.test(nombre) ? capitalizarNombre(nombre) : nombre, 1);
  }

  return cuenta;
}

/** «NÚCLEO» → «Núcleo». Un nombre en versalita grita en mitad de un párrafo. */
function capitalizarNombre(n) {
  return n.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
}

/**
 * Cuántas veces aparece cada nombre propio en el cuerpo del texto.
 *
 * Sirve para dos cosas: ordenar a los personajes por presencia y descubrir a
 * los que nunca hablan pero se nombran mucho, que en una historia suelen ser
 * el antagonista o un sitio.
 *
 * @param {string} texto
 * @returns {Map<string, number>}
 */
function menciones(texto) {
  // Fuera los guiones de diálogo, que ya se cuentan aparte.
  const cuerpo = texto.replace(/^\s*[A-ZÁÉÍÓÚÑ][^\n:]{1,28}:\s*$/gmu, '');

  const patron = /\b([A-ZÁÉÍÓÚÑ][a-záéíóúñü]{2,}(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñü]{2,})?)\b/gu;

  // Dos pasadas, y la primera es la que decide.
  //
  // En prosa narrativa los personajes abren frase constantemente —«Caelion
  // intenta incorporarse.»— así que descartar lo que va tras un punto perdía a
  // media compañía. Pero contar toda mayúscula convertiría «Miras», «Después»
  // y «Una» en personajes, porque también abren frase a todas horas.
  //
  // La prueba es verlo UNA vez en mitad de una frase, donde nadie escribe
  // mayúsculas por accidente. Si pasa esa prueba, ya se cuentan todas sus
  // apariciones, abran frase o no.
  const propios = new Set();

  for (const m of cuerpo.matchAll(patron)) {
    // Las comillas y las rayas de diálogo cuentan como principio de frase: lo
    // que va justo detrás de un «—» o de un «"» abre oración igual que lo que
    // va tras un punto.
    const enMedio = !/(?:^|[.!?¿¡:"«»—–-]\s*|\n\s*)$/u.test(cuerpo.slice(Math.max(0, m.index - 4), m.index));
    if (enMedio) propios.add(m[1]);
  }

  const cuenta = new Map();

  for (const m of cuerpo.matchAll(patron)) {
    const nombre = m[1];
    if (!propios.has(nombre)) continue;
    if (NO_PERSONAJE.has(sinTildes(nombre).toLowerCase())) continue;
    cuenta.set(nombre, (cuenta.get(nombre) ?? 0) + 1);
  }

  return cuenta;
}

/**
 * Las frases que dicen algo de un nombre.
 *
 * Es lo que convierte «Dhorak» en un personaje: sin esto solo tendríamos una
 * lista de nombres. Se cogen frases cortas donde el nombre es el sujeto, que
 * son las que describen y no las que solo narran movimiento.
 *
 * @param {string} texto
 * @param {string} nombre
 * @param {number} [maximo]
 * @returns {string[]}
 */
function frasesSobre(texto, nombre, maximo = 2) {
  const escapado = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patron = new RegExp(`(?:^|[.!?]\\s+)(${escapado}\\s[^.!?\\n]{12,120})[.!?]`, 'gu');

  const halladas = [];

  for (const m of texto.matchAll(patron)) {
    const f = m[1].replace(/\s+/g, ' ').trim();

    // Fuera lo que solo cuenta un gesto de paso: aporta menos que ocupar sitio.
    if (/^\S+\s+(mira|miras|asiente|responde|dice|contesta|pregunta|calla|guarda silencio)\b/iu.test(f)) continue;

    // Se quita el nombre del principio y queda solo lo que se dice de él.
    //
    // La nota se usa luego en frases como «Elyndra, quien ${nota}», así que
    // guardarla con el nombre dentro producía «Elyndra que Elyndra apenas
    // tiene fuerzas». Lo que hace falta es el predicado, no la oración.
    const predicado = f.slice(nombre.length).trim().replace(/^[,:;]\s*/, '');
    if (predicado.length < 10 || halladas.includes(predicado)) continue;

    halladas.push(predicado);
    if (halladas.length >= maximo) break;
  }

  return halladas;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CLASIFICACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/** Palabras que delante de un nombre lo convierten en lugar. */
const PISTA_LUGAR = /\b(?:en|hacia|hasta|desde|de|a)\s+(?:el\s+|la\s+|los\s+|las\s+)?(?:reino|ciudad|aldea|pueblo|valle|monta[ñn]a|bosque|puerto|fortaleza|castillo|torre|abad[ií]a|templo|cámara|camara|c[aá]mara|galer[ií]a|t[uú]nel|montes?|isla|mar|r[ií]o)\s+(?:de\s+)?$/i;

/**
 * Decide si un nombre es persona, lugar o cosa.
 *
 * Quien habla es persona sin discusión. Para el resto se mira el contexto de
 * su primera aparición, que es donde el autor suele presentarlo.
 *
 * @param {string} texto
 * @param {string} nombre
 * @param {boolean} habla
 * @returns {string}
 */
function tipoDe(texto, nombre, habla) {
  if (habla) return 'persona';

  const i = texto.indexOf(nombre);
  if (i < 0) return 'persona';

  const antes = texto.slice(Math.max(0, i - 50), i);

  if (PISTA_LUGAR.test(antes)) return 'lugar';
  if (/\b(?:la|el)\s+(?:espada|escudo|hoja|armadura|libro|medall[oó]n|anillo|lengua|corona)\s+$/i.test(antes)) return 'cosa';

  return 'persona';
}

/* ═══════════════════════════════════════════════════════════════════════════
   TENSIONES ABIERTAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Lo que la historia deja sin cerrar.
 *
 * Son el material con el que el juego puede seguir: una amenaza anunciada, una
 * promesa hecha, una pregunta sin responder. Se buscan por la forma en que se
 * escriben estas cosas, no por su contenido.
 *
 * @param {string} texto
 * @returns {string[]}
 */
function tensiones(texto) {
  const patrones = [
    /\b(?:jur[oóé]|prometi[oóó]?|dio su palabra|hab[ií]a jurado|juraste?)\s+(?:que\s+)?([^.!?\n]{12,110})/giu,
    /\b(?:todo poder tiene|el precio|a cambio de)\s+([^.!?\n]{8,110})/giu,
    /\b(?:lo que (?:hay )?(?:est[aá]|se esconde) (?:detr[aá]s|m[aá]s all[aá])|detr[aá]s de la monta[ñn]a)\s+([^.!?\n]{8,110})/giu,
    /\b(?:ahora (?:debes|tienes que)|debes decidir si)\s+([^.!?\n]{8,110})/giu,
  ];

  const halladas = [];

  for (const p of patrones) {
    for (const m of texto.matchAll(p)) {
      const t = m[1].replace(/\s+/g, ' ').trim();
      if (t && !halladas.some((h) => h.includes(t) || t.includes(h))) halladas.push(t);
    }
  }

  return halladas.slice(0, 4);
}

/* ═══════════════════════════════════════════════════════════════════════════
   ENTRADA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Lee una historia escrita fuera y devuelve lo que el juego necesita.
 *
 * @param {string} bruto El texto pegado.
 * @returns {{
 *   personajes: Array<{nombre: string, tipo: string, habla: number,
 *     menciones: number, notas: string[], protagonistaProbable: boolean}>,
 *   hilos: string[],
 *   palabras: number,
 *   vacio: boolean
 * }}
 */
export function importarHistoria(bruto) {
  const texto = limpiarVolcado(bruto);
  const palabras = texto ? texto.split(/\s+/).length : 0;

  if (palabras < 40) return { personajes: [], hilos: [], palabras, vacio: true };

  const hablan = quienHabla(texto);
  const nombrados = menciones(texto);

  // Se unen las dos listas. Quien habla entra siempre; quien solo se menciona,
  // a partir de dos veces, porque una sola suele ser un giro de la narración y
  // no un personaje.
  const todos = new Map();

  for (const [nombre, veces] of hablan) todos.set(nombre, { habla: veces, menciones: 0 });

  for (const [nombre, veces] of nombrados) {
    if (veces < 2 && !todos.has(nombre)) continue;

    const igual = [...todos.keys()].find((k) => sinTildes(k).toLowerCase() === sinTildes(nombre).toLowerCase());
    if (igual) todos.get(igual).menciones += veces;
    else todos.set(nombre, { habla: 0, menciones: veces });
  }

  const personajes = [...todos.entries()]
    .map(([nombre, d]) => ({
      nombre,
      tipo: tipoDe(texto, nombre, d.habla > 0),
      habla: d.habla,
      menciones: d.menciones,
      notas: frasesSobre(texto, nombre),
      protagonistaProbable: false,
    }))
    // Presencia: hablar pesa más que ser nombrado, porque un personaje de
    // fondo puede salir mucho sin llegar a ser nadie.
    .sort((a, b) => (b.habla * 3 + b.menciones) - (a.habla * 3 + a.menciones))
    .slice(0, 12);

  // A quién LLAMAN por su nombre dentro de los diálogos.
  //
  // Es la mejor pista de quién es el protagonista, y no se parece a ninguna
  // otra: en una narración en segunda persona el protagonista casi no se
  // nombra al narrar —«miras a tus compañeros»— pero los demás le hablan a él.
  // «—¿Aethor...?» lo dice Lyssara, y solo se lo puede estar diciendo a uno.
  //
  // Sin esto ganaba quien más hablase, que en un tramo de conversación puede
  // ser cualquiera.
  const interpelado = new Map();

  for (const m of texto.matchAll(/^\s*[—–-]\s*([^\n]{0,160})$/gmu)) {
    for (const p of personajes) {
      const escapado = p.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escapado}\\b`, 'iu').test(m[1])) {
        interpelado.set(p.nombre, (interpelado.get(p.nombre) ?? 0) + 1);
      }
    }
  }

  // Se PROPONE protagonista, no se decide. Elegirlo por él sería acertar casi
  // siempre y equivocarse con su personaje el resto de las veces, que es lo
  // único que no se puede fallar aquí.
  const personas = personajes.filter((p) => p.tipo === 'persona');

  const candidato = personas
    .slice()
    .sort((a, b) => ((interpelado.get(b.nombre) ?? 0) * 10 + b.habla)
      - ((interpelado.get(a.nombre) ?? 0) * 10 + a.habla))[0];

  if (candidato) candidato.protagonistaProbable = true;

  return { personajes, hilos: tensiones(texto), palabras, vacio: false };
}

export default { importarHistoria };
