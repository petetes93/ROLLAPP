/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ai/narrador/Canon.js
 * ---------------------------------------------------------------------------
 * El canon del jugador en hechos atómicos, y lo que de él cabe en cada turno.
 *
 * ── Por qué hechos atómicos ─────────────────────────────────────────────
 *
 * Antes cada edición era una entrada de texto libre, y una edición nueva
 * sobre lo mismo SUSTITUÍA la entrada entera. «Aldo es mi hermano y murió en
 * Saucedo» seguido de «Aldo está vivo» dejaba solo lo segundo: se perdía que
 * era su hermano y dónde pasó lo que pasó, sin avisar a nadie. Una frase
 * compuesta dice varias cosas y una corrección toca solo una de ellas.
 *
 * Ahora cada edición se guarda tal cual la escribió el jugador (su versión y
 * su procedencia no se pierden nunca) y se divide en hechos atómicos:
 *
 *   sujeto · predicado · valor (objeto o lugar) · cuándo · polaridad
 *
 * Los predicados son de dos clases:
 *
 *   · DE UN SOLO VALOR (vida, paradero, origen, parentesco con alguien): un
 *     valor nuevo dicho de forma directa sobre el mismo sujeto REVISA el
 *     anterior. El anterior deja de valer y queda en su historial, con lo
 *     que lo sustituyó. Lo que la edición no toca sigue valiendo.
 *   · DE VARIOS VALORES (rasgos, vínculos, posesiones, lo demás): se suman.
 *     Solo una negación específica («Aldo no es un traidor», «perdí la
 *     llave») retira un valor concreto.
 *
 * ── Cuando no es seguro, no se borra ────────────────────────────────────
 *
 *   · Sin sujeto claro («Ahora está vivo») no se adivina a quién se refiere:
 *     no se anota y se pregunta al jugador.
 *   · Con dos sujetos del mismo nombre («Aldo el herrero» y «Aldo el
 *     guardia»), un «Aldo» a secas tampoco se adivina.
 *   · Una contradicción que no se dice directamente («Aldo vive en Norte»
 *     cuando el canon lo da por muerto) no revisa nada: se guardan las dos
 *     afirmaciones, se marca el conflicto y el narrador no da ninguna por
 *     cierta hasta que el jugador lo aclare. Con una marca de corrección
 *     («en realidad», «corrijo») sí revisa.
 *   · Preguntas y suposiciones («¿y si Aldo estuviera vivo?», «quizá…») no
 *     cambian el canon. Un rumor («dicen que Aldo murió») se guarda como
 *     rumor, no como muerte.
 *   · Instrucciones para el narrador (un MASTER PROMPT pegado) y textos de
 *     otra partida u otra IA no se importan como canon.
 *
 * ── La proyección ───────────────────────────────────────────────────────
 *
 * Lo que va a un modelo en un turno sale del CONJUNTO VIGENTE de hechos, no
 * del texto de las ediciones: todo lo que vale de un sujeto viaja junto o no
 * viaja, nunca a medias, y lo que no cabe se lista como omitido. La red de
 * seguridad (quién está muerto) usa el conjunto vigente entero, quepa o no.
 *
 * Funciones puras. El registro es un objeto plano y serializable.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { sinAcentos } from '../../utils/text.js';

const nfc = (t) => String(t ?? '').normalize('NFC');
/** Minúsculas y sin tildes. Conserva la longitud de un texto en NFC. */
const llano = (t) => sinAcentos(nfc(t).toLowerCase());

export const VERSION_REGISTRO = 2;

/* ═══════════════════════════════════════════════════════════════════════════
   LÉXICO
   ═══════════════════════════════════════════════════════════════════════════ */

const PARIENTES = ['hermano', 'hermana', 'padre', 'madre', 'hijo', 'hija', 'abuelo', 'abuela', 'tio', 'tia', 'primo', 'prima',
  'esposo', 'esposa', 'marido', 'mujer', 'sobrino', 'sobrina', 'cunado', 'cunada', 'suegro', 'suegra', 'nieto', 'nieta',
  'gemelo', 'gemela', 'hermanastro', 'hermanastra', 'padrastro', 'madrastra'];
const VINCULOS = ['maestro', 'maestra', 'mentor', 'mentora', 'amigo', 'amiga', 'companero', 'companera', 'aprendiz', 'rival',
  'enemigo', 'enemiga', 'prometido', 'prometida', 'amante', 'protector', 'protectora', 'senor', 'senora', 'capitan', 'capitana', 'jefe', 'jefa'];
const PAR = PARIENTES.join('|');
const VIN = VINCULOS.join('|');

/** Palabras en mayúscula que no son nombres propios. */
const NO_NOMBRE = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'mi', 'mis', 'tu', 'tus', 'su', 'sus', 'yo', 'ella',
  'ellos', 'ellas', 'nosotros', 'en', 'de', 'si', 'no', 'pero', 'cuando', 'hace', 'desde', 'ahora', 'canon', 'tras', 'hay', 'era',
  'fue', 'es', 'esta', 'este', 'ese', 'esa', 'eso', 'esto', 'aquel', 'aquella', 'nunca', 'jamas', 'al', 'del', 'lo', 'le', 'les',
  'que', 'quien', 'como', 'donde', 'porque', 'aunque', 'luego', 'entonces', 'despues', 'antes', 'hoy', 'ayer', 'anoche', 'todos',
  'todo', 'toda', 'todas', 'nadie', 'alguien', 'nada', 'algo', 'cada', 'otro', 'otra', 'uno', 'dos', 'tres', 'por', 'para', 'con',
  'sin', 'sobre', 'entre', 'hasta', 'segun', 'tambien', 'tampoco', 'solo', 'quiza', 'quizas', 'tal', 'puede', 'creo', 'corrijo',
  'resulta', 'realidad', 'final', 'ademas', 'dicen', 'cuentan', 'se', 'me', 'te', 'nos', 'mas', 'muy', 'don', 'dona', 'sir', 'dama',
  'aun', 'todavia', 'siempre', 'mejor', 'bueno', 'vale', 'ojo', 'nota', 'fuera', 'dentro', 'arriba', 'abajo']);

/** Verbos que pueden abrir frase en mayúscula y no son nombres. */
const VERBOS_INICIO = new Set(['busco', 'llevo', 'tengo', 'soy', 'vine', 'debo', 'vivo', 'quiero', 'necesito', 'fui', 'estoy', 'sigo',
  'huyo', 'escapo', 'guardo', 'odio', 'amo', 'temo', 'vive', 'viven', 'sigue', 'siguen', 'tiene', 'tienen', 'lleva', 'guarda',
  'murio', 'mataron', 'conozco', 'trabajo', 'vengo', 'hablo', 'existe', 'existen', 'nacio', 'cayo', 'hubo', 'habia', 'estaba',
  'tenia', 'vivia', 'queda', 'quedan', 'son', 'eran', 'fueron', 'perdio', 'perdieron', 'robaron', 'imagina', 'supongamos', 'olvida']);

/** Una palabra en mayúscula, con límites que entienden las tildes. */
const NOMBRE = /(?<!\p{L})(\p{Lu}\p{Ll}{2,})(?!\p{L})/gu;

const PREPOSICIONES = new Set(['en', 'de', 'a', 'al', 'del', 'hacia', 'desde', 'por', 'para', 'con', 'sin', 'sobre', 'entre', 'hasta',
  'tras', 'contra', 'bajo', 'segun', 'como']);

/** Lo que sigue a un lugar y ya no es parte de él. */
const FIN_LUGAR = String.raw`(?=\s+(?:hace|desde|con|y|e|pero|porque|cuando|aunque|mientras|donde|tras|despues|antes|junto|desde|sin)\b|\s*[,;.!?]|$)`;
const LUGAR = String.raw`([^\s,;.!?][^,;.!?]*?)` + FIN_LUGAR;

/** «Está en paz», «está en deuda»: estados, no sitios. */
const NO_LUGAR = /^(?:paz|guerra|deuda|peligro|apuros|contra|duda|shock|coma|forma|condiciones|lo cierto|serio|busca|camino|lo suyo|lo mismo|juego|marcha|vela|silencio|calma|pie|venta|deuda con)\b/;

/** Marcas de que el jugador corrige algo que ya dijo. */
const CORRIGE = /\b(?:en realidad|corrijo|correccion|me equivoque|rectifico|al final|resulta que|a partir de ahora|mejor dicho|lo cierto es que)\b/;

/** Preguntas, condiciones y suposiciones: no son hechos. */
const HIPOTESIS = /(?:^|\b)(?:y si|que pasaria si|quiza|quizas|tal vez|a lo mejor|puede que|posiblemente|probablemente|creo que|me parece que|supongo|supongamos|imagina que|imaginemos|podria|podrian|seria|serian|estuviera|estuviese|estuvieran|hubiera|hubiese|hubieran|ojala|fuera(?! de)|fuese|muriera|viviera)\b|^si\s/;

/** Lo que se cuenta, no lo que es: «dicen que Aldo murió». */
const RUMOR = /\b(?:dicen que|se dice que|se rumorea|cuentan que|segun (?:los rumores|dicen|cuentan)|hay quien dice|corre el rumor)\b/;

/** Instrucciones para el narrador: un MASTER PROMPT pegado no es el mundo. */
const INSTRUCCION = /\b(?:eres (?:el|un|una) (?:narrador|director|asistente|ia|modelo|master|dungeon)|actua como|actuaras como|como narrador,? (?:debes|tienes|no)|el narrador (?:debe|no debe|nunca|siempre|tiene que)|responde (?:en|con|siempre|solo)|formato json|devuelve (?:un |el )?json|master prompt|system prompt|prompt del sistema|instrucciones? (?:del|para el) (?:narrador|sistema|modelo)|reglas del narrador|nunca reveles|no rompas la cuarta pared|tu (?:tarea|objetivo|funcion|papel) es|debes (?:narrar|responder|escribir|mantener|evitar|usar|seguir)|ignora (?:las|todas|lo) (?:instrucciones|anterior)|como modelo de lenguaje)\b/;
/**
 * El vocabulario de quien narra, no de quien vive en el mundo: «el
 * jugador», «los PNJ», «el motor», «no inventes…». Un hecho del mundo no
 * habla así; una regla de narración pegada, sí.
 */
const META = /\b(?:el jugador|la jugadora|los jugadores|el protagonista|el lector|los pnj|un pnj|cada pnj|pnj|npc|el motor|la instantanea|proposedeffects|yacontado|json|segunda persona|la narracion|turno corriente|el canon|tu controlas|recibes una|no (?:inventes|repitas|contestes|reveles|hagas|resuelvas|cambies|empieces|contradigas|respondas|decidas|copies|parafrasees)|nunca (?:decidas|reveles|inventes|hables por)|no lo fuerces|narrador de escena|guardian de la continuidad|cada replica|solo hablan los presentes)\b/;
/** Cabeceras de un prompt: «4 · MEMORIA», «## Reglas». */
const CABECERA = /^\s*(?:#{1,6}\s|\d{1,2}(?:-\d{1,2})?\s*[·.)-]\s*\p{Lu}{3,})/u;

/** Otra partida u otra conversación. */
const AJENO = /\b(?:en|de|del|desde) (?:chatgpt|chat gpt|gpt|claude|gemini|copilot|otra partida|la otra partida|otro chat|el otro chat|otra conversacion|la conversacion anterior|otra campana|otro juego)\b/;

/** Primera persona al abrir una cláusula: el sujeto es el personaje. */
const PRIMERA = new RegExp(String.raw`^(?:(?:ya|no|nunca|tambien|aun|todavia|siempre|ahora|al final|en realidad|hoy)\s+)*(?:(?:me|te|se)\s+)?(?:soy|fui|estoy|estuve|tengo|tuve|llevo|vivo|vivi|naci|perdi|jure|busco|guardo|odio|amo|temo|conozco|conoci|sigo|vine|debo|quiero|servi|creci|aprendi|mate|robe|hui|escape|trabajo|trabaje|vengo|vendi|compre|gane|rompi|entregue|deje|encontre|llegue|robaron|poseo|conservo|perdi)\b`);

/** Verbos corrientes, para saber si un trozo de frase dice algo. */
const VERBO = /\b(?:es|son|era|eran|fue|fueron|sera|esta|estan|estaba|estuvo|hay|habia|hubo|tiene|tienen|tenia|tuvo|lleva|llevaba|guarda|guardaba|vive|viven|vivia|vivio|murio|murieron|muere|mato|odia|ama|quiere|queria|conoce|conocia|sabe|sabia|trabaja|trabajaba|sirve|servia|busca|buscaba|nacio|juro|debe|debia|dice|dijo|traiciono|huyo|escapo|volvio|regreso|sigue|siguen|seguia|desaparecio|lidera|dirige|gobierna|manda|protege|teme|oculta|esconde|escondio|vendio|compro|gano|cayo|crecio|aprendio|enseno|fundo|construyo|quemo|destruyo|salvo|ayudo|abandono|dejo|encontro|llego|partio|marcho|reside|habita|posee|conserva|perdio|robo|existe|existen|queda|quedan|fallecio|sobrevivio|resucito)\b/;

/* ═══════════════════════════════════════════════════════════════════════════
   PREDICADOS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Predicados de un solo valor: un valor nuevo directo revisa el anterior. */
const UN_VALOR = new Set(['vida', 'paradero', 'origen', 'parentesco', 'suceso_lugar']);

const RE = {
  muerto: new RegExp(String.raw`\b(?:murio|murieron|ha muerto|han muerto|esta muert[oa]|estan muert[oa]s|sigue muert[oa]|siguen muert[oa]s|fallecio|fallecieron|perecio|cayo en (?:la )?batalla|lo mataron|la mataron|los mataron|las mataron|fue asesinad[oa]|fueron asesinad[oa]s|lo asesinaron|la asesinaron)\b(?:\s+en\s+${LUGAR})?`, 'd'),
  vivo: /\b(?:esta viv[oa]|estan viv[oa]s|sigue viv[oa]|siguen viv[oa]s|sigue con vida|siguen con vida|esta con vida|sobrevivio|sobrevivieron|resucito|vive|viven)\b(?!\s+(?:en|con|cerca|junto|entre|bajo|sobre|como|de|para|al|del|a|lejos|por)\b)/d,
  mataA: /\b(?:mato|asesino|mataron|asesinaron|mate)\s+a\s+(\p{L}+)/du,
  paradero: new RegExp(String.raw`\b(?:(vive|viven|reside|residen|habita|habitan|preso|presa|presos|encerrad[oa]s?|cautiv[oa]s?|retenid[oa]s?|escondid[oa]s?)|(?:esta|estan|sigue|siguen|se quedo|se quedaron|se esconde|se oculta))\s+en\s+${LUGAR}`, 'd'),
  marcha: new RegExp(String.raw`\b(?:se fue|se fueron|se marcho|se marcharon|huyo|huyeron|partio|partieron|escapo|escaparon|volvio|volvieron|regreso|regresaron|se mudo|se mudaron)\s+(?:a|al|hacia)\s+${LUGAR}`, 'd'),
  estuvo: new RegExp(String.raw`\b(?:vivia|vivio|vivieron|estuvo|estuvieron|estaba|estaban|residia|residio|habitaba)\s+en\s+${LUGAR}`, 'd'),
  origen: new RegExp(String.raw`\b(?:es de|son de|era de|eran de|nacio en|nacieron en|viene de|vienen de|procede de|naci en|soy de|vengo de)\s+${LUGAR}`, 'd'),
  parentesco: new RegExp(String.raw`\b(?:es|era|fue|sera|soy|son|eran)\s+(?:(mi|tu|su|el|la|los|las)\s+)?(${PAR})s?\b(?:\s+de\s+((?:mi|tu)\s+\p{L}+|\p{L}+))?`, 'du'),
  vinculo: new RegExp(String.raw`\b(?:es|era|fue|sera|soy|son|eran)\s+(?:(mi|tu|su|el|la|un|una)\s+)?(${VIN})s?\b(?:\s+de\s+((?:mi|tu)\s+\p{L}+|\p{L}+))?`, 'du'),
  // Lo que se tiene o se pierde puede ser una lista: «la llave y un mapa».
  tiene: /\b(tengo|llevo|guardo|poseo|conservo|tiene|tienen|lleva|llevan|guarda|guardan|posee|conserva)\s+([^;.!?]+)/d,
  pierde: /\b(perdi|perdio|perdieron|me robaron|le robaron|les robaron|vendi|vendio|entregue|entrego|rompi|rompio|ya no tengo|ya no tiene|no tengo|no tiene)\s+([^;.!?]+)/d,
  rasgo: new RegExp(String.raw`\b(?:es|era|fue|son|eran|soy)\s+((?:un|una|unos|unas)\s+)?(\p{L}+(?:\s+(?!y\b|e\b|pero\b)\p{L}+){0,3})` + FIN_LUGAR, 'du'),
};

/** ¿Está negado lo que empieza en `i`? */
function negadoAntes(n, i) {
  const antes = n.slice(Math.max(0, i - 40), i);
  return /(?:\bno|\bnunca|\bjamas|\bya no)\s+(?:(?:se|lo|la|le|les|los|las|me|te|ha|han|habia|esta)\s+)*$/.test(antes);
}

/** Sustantivo núcleo de un objeto: «la llave de hierro» → «llave». */
const nucleo = (valor) => llano(valor).replace(/^(?:el|la|los|las|un|una|unos|unas|mi|mis|su|sus|tu|tus)\s+/, '').split(/\s+/)[0] ?? '';

const pasado = (t) => /\b(?:murio|murieron|fallecio|perecio|mataron|asesinaron|fue|fueron|era|eran|estuvo|estaba|vivia|vivio|huyo|se fue|se marcho|partio|escapo|volvio|regreso|se mudo|cayo|sobrevivio|resucito|nacio|naci|perdi|perdio|vendi|vendio)\b/.test(t);

/**
 * Los predicados de una cláusula, con dónde empiezan.
 * @returns {Array<Object>}
 */
function predicados(o, n) {
  const out = [];
  const tramo = (m, g) => (m.indices?.[g] ? o.slice(m.indices[g][0], m.indices[g][1]).trim() : null);
  const cuando = n.match(/\bhace\s+[^,;.!?]+?(?=\s+(?:y|e|pero)\b|[,;.!?]|$)/)?.[0] ?? null;
  const cuandoO = cuando ? o.slice(n.indexOf(cuando), n.indexOf(cuando) + cuando.length) : null;

  // Un rumor es de quien se habla, pero no afirma nada de él.
  if (RUMOR.test(n)) return [{ predicado: 'otro', valor: null, idx: n.length, rumor: true }];

  let m = RE.muerto.exec(n);
  if (m) {
    const neg = negadoAntes(n, m.index);
    const lugar = tramo(m, 1);
    out.push({ predicado: 'vida', valor: neg ? 'vivo' : 'muerto', lugar: neg || !lugar || NO_LUGAR.test(llano(lugar)) ? null : lugar, cuando: neg ? null : cuandoO, idx: m.index, tiempo: pasado(m[0]) ? 'pasado' : 'presente' });
  }
  m = RE.vivo.exec(n);
  if (m && !out.some((p) => p.predicado === 'vida')) {
    const neg = negadoAntes(n, m.index);
    out.push({ predicado: 'vida', valor: neg ? 'muerto' : 'vivo', idx: m.index, tiempo: pasado(m[0]) ? 'pasado' : 'presente' });
  }
  m = RE.mataA.exec(n);
  if (m && !negadoAntes(n, m.index)) {
    const victima = tramo(m, 1);
    if (victima && /^\p{Lu}/u.test(victima)) out.push({ predicado: 'vida', valor: 'muerto', idx: m.index, objeto: victima, tiempo: 'pasado' });
  }

  const estuvo = RE.estuvo.exec(n);
  if (estuvo && !NO_LUGAR.test(estuvo[1])) out.push({ predicado: 'estuvo', valor: tramo(estuvo, 1), idx: estuvo.index, polaridad: !negadoAntes(n, estuvo.index), tiempo: 'pasado' });
  m = RE.paradero.exec(n);
  if (m && !NO_LUGAR.test(llano(tramo(m, 2) ?? ''))) {
    const neg = negadoAntes(n, m.index);
    out.push({ predicado: 'paradero', valor: tramo(m, 2), idx: m.index, polaridad: !neg, tiempo: 'presente' });
    // Quien vive, reside o está preso en un sitio está vivo. Se deduce: no
    // revisa nada por sí solo (ver `aplicar`).
    if (m[1] && !neg && !out.some((p) => p.predicado === 'vida')) out.push({ predicado: 'vida', valor: 'vivo', idx: m.index, implicito: true, tiempo: 'presente' });
  } else {
    m = RE.marcha.exec(n);
    if (m && !NO_LUGAR.test(llano(tramo(m, 1) ?? ''))) out.push({ predicado: 'paradero', valor: tramo(m, 1), idx: m.index, polaridad: !negadoAntes(n, m.index), tiempo: 'pasado' });
  }
  m = RE.origen.exec(n);
  if (m) out.push({ predicado: 'origen', valor: tramo(m, 1), idx: m.index, polaridad: !negadoAntes(n, m.index), tiempo: 'presente' });

  m = RE.parentesco.exec(n);
  if (m) {
    const det = m[1];
    const de = m[3] ? tramo(m, 3) : (!det || /^(?:mi|tu)$/.test(det) ? 'yo' : null);
    out.push({ predicado: 'parentesco', valor: m[2], de, idx: m.index, polaridad: !negadoAntes(n, m.index), tiempo: pasado(m[0]) ? 'pasado' : 'presente', persona1: /^soy\b/.test(m[0]) });
  } else if ((m = RE.vinculo.exec(n))) {
    const det = m[1];
    const de = m[3] ? tramo(m, 3) : (!det || /^(?:mi|tu)$/.test(det) ? 'yo' : null);
    out.push({ predicado: 'vinculo', valor: m[2], de, idx: m.index, polaridad: !negadoAntes(n, m.index), tiempo: pasado(m[0]) ? 'pasado' : 'presente' });
  }

  const pierde = RE.pierde.exec(n);
  const tiene = pierde ? null : RE.tiene.exec(n);
  m = pierde ?? tiene;
  if (m) {
    // Un hecho por cosa: perder la llave no se lleva el mapa.
    const verbo = tramo(m, 1);
    const cosas = tramo(m, 2).split(/\s*,\s*(?:y\s+|e\s+)?|\s+(?:y|e)\s+/u).map((x) => x.trim()).filter(Boolean);
    const primera = /^(?:perdi|me robaron|vendi|entregue|rompi|ya no tengo|no tengo|tengo|llevo|guardo|poseo|conservo)\b/.test(m[1]);
    const polaridad = pierde ? false : !negadoAntes(n, m.index);
    for (const cosa of cosas) {
      out.push({ predicado: 'posesion', valor: cosa, idx: m.index, polaridad, primera, texto: cosas.length > 1 ? `${verbo} ${cosa}` : null });
    }
  }

  if (!out.some((p) => ['parentesco', 'vinculo', 'vida', 'origen'].includes(p.predicado))) {
    m = RE.rasgo.exec(n);
    if (m && !/^(?:que|de|como|cierto|verdad|mentira|falso|mas|muy)\b/.test(m[2])) {
      out.push({ predicado: 'rasgo', valor: `${m[1] ?? ''}${tramo(m, 2)}`.trim(), idx: m.index, polaridad: !negadoAntes(n, m.index), tiempo: pasado(m[0]) ? 'pasado' : 'presente' });
    }
  }
  // «No es verdad que Aldo muriera»: niega lo que sigue.
  if (/^(?:no es (?:verdad|cierto) que|es (?:falso|mentira) que)\b/.test(n)) {
    for (const p of out) {
      if (p.predicado === 'vida') p.valor = p.valor === 'muerto' ? 'vivo' : 'muerto';
      else p.polaridad = !(p.polaridad ?? true);
    }
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   FRASES Y SUJETOS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Nombres propios de un texto, con su posición. */
function nombresEn(o) {
  const out = [];
  for (const m of o.matchAll(NOMBRE)) {
    const w = m[1];
    const l = llano(w);
    if (NO_NOMBRE.has(l) || VERBOS_INICIO.has(l) || /[áéíóú]$/u.test(w)) continue;
    out.push({ nombre: w, i: m.index });
  }
  return out;
}

/** ¿Va detrás de una preposición? Entonces es sitio u objeto, no sujeto. */
function trasPreposicion(o, i) {
  const previa = llano(o.slice(0, i)).trim().split(/\s+/).at(-1) ?? '';
  return PREPOSICIONES.has(previa);
}

const tieneVerbo = (o) => {
  const n = llano(o);
  return VERBO.test(n) || PRIMERA.test(n.replace(/^(?:y|e|pero)\s+/, '')) || Object.values(RE).some((re) => { re.lastIndex = 0; return re.test(n); })
    || /(?<!\p{L})\p{Ll}{2,}[óéí](?!\p{L})/u.test(o) || /\b\p{Ll}{3,}(?:aron|ieron|aban)\b/u.test(n);
};

/** Solo nombres (y «y»): un sujeto coordinado, «Aldo y Berin murieron». */
const soloNombres = (o) => {
  const resto = o.replace(NOMBRE, '').replace(/\b(?:y|e)\b/g, '').replace(/[\s,]+/g, '');
  return nombresEn(o).length > 0 && resto === '';
};

/**
 * Divide una edición en cláusulas con sentido propio.
 *
 * Corta por oraciones y, dentro, por «y», «pero», «aunque», punto y coma y
 * comas; vuelve a pegar lo que se quedó sin verbo («tengo una espada, un
 * escudo y una capa» es una sola cláusula). Una cláusula que empieza por
 * «que» tras una coma es de relativo: su sujeto es el último nombre de la
 * anterior («Aldo mató a Berin, que murió en Saucedo» → murió Berin).
 */
function segmentar(texto) {
  const out = [];
  const oraciones = nfc(texto).split(/(?<=[.!?…;])\s+|\n+/u).map((s) => s.trim()).filter(Boolean);
  oraciones.forEach((oracion, k) => {
    let cuerpo = oracion.replace(/^[¿¡«"“]+|[.!?…;»"”]+$/gu, '').trim();
    // Una pregunta o una condición («si Aldo vuelve, lo mato») es entera
    // una suposición: ninguna de sus partes es un hecho.
    const pregunta = /^[¿¡]?\s*¿|\?\s*$/u.test(oracion) || /^(?:y\s+)?si\s/.test(llano(cuerpo)) ? oracion : null;
    // Aposiciones: «Aldo, mi hermano, murió» → «mi hermano Aldo murió»;
    // «Aldo, el herrero, murió» → «Aldo el herrero murió».
    cuerpo = cuerpo.replace(new RegExp(String.raw`(\p{Lu}\p{Ll}{2,}),\s+((?:mi|tu)\s+(?:${PAR}|${VIN}|cuñad[oa]|compañer[oa]|señor[a]?|capitán|capitana)),\s*`, 'giu'), '$2 $1 ');
    cuerpo = cuerpo.replace(/(\p{Lu}\p{Ll}{2,}),\s+((?:el|la)\s+\p{Ll}{3,}),\s*/gu, '$1 $2 ');
    const piezas = [];
    const corte = /(\s*,\s*(?:y|e|pero|aunque|sino)\s+|\s+(?:y|e|pero|aunque|sino que|mientras que)\s+|\s*;\s*|\s*,\s*)/iu;
    const trozos = cuerpo.split(corte);
    for (let i = 0; i < trozos.length; i += 2) {
      const o = trozos[i]?.trim();
      if (!o) continue;
      piezas.push({ o, sep: i > 0 ? trozos[i - 1] : '' });
    }
    // Lo que no lleva verbo vuelve con lo anterior (o es un sujeto coordinado).
    const unidas = [];
    let coordinados = [];
    for (let i = 0; i < piezas.length; i += 1) {
      const p = piezas[i];
      const relativo = /^(?:que|quien)\s/iu.test(p.o) && /,/.test(p.sep);
      if (!relativo && !tieneVerbo(p.o)) {
        if (soloNombres(p.o) && i + 1 < piezas.length && !/^,/.test(piezas[i + 1].sep.trim()) && !/^(?:que|quien)\s/iu.test(piezas[i + 1].o)) {
          coordinados.push(...nombresEn(p.o).map((x) => x.nombre));
          continue;
        }
        if (soloNombres(p.o) && i + 1 < piezas.length && /^(?:que|quien)\s/iu.test(piezas[i + 1].o)) {
          unidas.push({ o: p.o, soloAntecedente: true });
          continue;
        }
        if (unidas.length && !unidas.at(-1).soloAntecedente) { unidas.at(-1).o += `${p.sep}${p.o}`; continue; }
      }
      unidas.push({ o: p.o, relativo, coordinados: coordinados.length ? coordinados : null });
      coordinados = [];
    }
    for (const u of unidas) out.push({ ...u, n: llano(u.o), oracion: k, pregunta });
  });
  return out;
}

/** Artículo para un parentesco: «la hermana de Aldo». */
const articulo = (rel) => (/(?:a|triz)$/.test(rel) && !/^(?:guia|dia)$/.test(rel) ? 'la' : 'el');

/** Clave estable de un sujeto con nombre. */
const claveDe = (nombre, epiteto = null) => `${llano(nombre)}${epiteto ? `|${llano(epiteto)}` : ''}`;

/**
 * El sujeto de un nombre, sin adivinar entre homónimos.
 * @returns {{clave: string, nombre: string, base: string}|{ambiguo: Array<Object>}}
 */
function resolverNombre(r, nombre, epiteto = null) {
  const base = llano(nombre);
  const mismos = Object.values(r.sujetos).filter((s) => s.base === base);
  if (epiteto) {
    const clave = claveDe(nombre, epiteto);
    return r.sujetos[clave] ?? { clave, nombre: `${nombre} ${epiteto}`, base, nuevo: true };
  }
  if (mismos.length > 1) return { ambiguo: mismos };
  if (mismos.length === 1) return mismos[0];
  return { clave: base, nombre, base, nuevo: true };
}

const registrarSujeto = (r, s) => {
  if (!s?.clave || r.sujetos[s.clave]) return;
  r.sujetos[s.clave] = { clave: s.clave, nombre: s.nombre, base: s.base ?? null };
};

/* ═══════════════════════════════════════════════════════════════════════════
   EL REGISTRO
   ═══════════════════════════════════════════════════════════════════════════ */

/** Un registro vacío. */
export function crearRegistro() {
  return { version: VERSION_REGISTRO, siguiente: 0, ediciones: [], hechos: [], conflictos: [], aclaraciones: [], sujetos: {} };
}

const copia = (r) => (typeof structuredClone === 'function' ? structuredClone(r) : JSON.parse(JSON.stringify(r)));
const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const conPunto = (t) => (/[.!?…]$/u.test(t) ? t : `${t}.`);

/** Ranura de un hecho de un solo valor: lo que un valor nuevo sustituye. */
const ranura = (h) => (UN_VALOR.has(h.predicado) ? `${h.sujeto}·${h.predicado}·${h.de ?? ''}·${h.evento ?? ''}` : null);
const mismoValor = (a, b) => a.predicado === b.predicado && (a.de ?? '') === (b.de ?? '')
  && llano(a.valor ?? a.texto) === llano(b.valor ?? b.texto);
/** «la llave» nombra por su núcleo a «la llave de hierro» (y a la del faro). */
const mismoNucleo = (a, b) => a.predicado === b.predicado && nucleo(a.valor ?? '') === nucleo(b.valor ?? '');

/**
 * Por qué una edición no entra en el canon, si no entra.
 * @param {string} texto
 * @returns {'instruccion'|'ajeno'|null}
 */
export function motivoAjeno(texto) {
  const n = llano(texto);
  if (INSTRUCCION.test(n) || META.test(n) || CABECERA.test(nfc(texto))) return 'instruccion';
  if (AJENO.test(n)) return 'ajeno';
  return null;
}

/**
 * Anota una edición deliberada del jugador.
 *
 * La edición se guarda entera y se divide en hechos atómicos. Cada hecho
 * revisa, como mucho, el valor anterior de SU ranura (mismo sujeto, mismo
 * predicado de un solo valor), y solo si la corrección es directa. Lo demás
 * de ese sujeto no se toca.
 *
 * @param {Object} registro
 * @param {string} texto Sin recortar.
 * @param {Object} [op]
 * @param {number} [op.turno=0]
 * @param {string} [op.fuente='jugador']
 * @param {string} [op.sujetoPorDefecto] Para notas sobre alguien ya sabido.
 * @returns {{registro: Object, edicion: Object, anotados: Object[], revisados: Array<{nuevo: Object, viejos: Object[]}>,
 *   confirmados: Object[], conflictos: Object[], aclaraciones: Object[], hipotesis: string[], residuos: Object[], rechazo: string|null}}
 */
export function anotar(registro, texto, { turno = 0, fuente = 'jugador', sujetoPorDefecto = null } = {}) {
  const r = copia(migrarRegistro(registro));
  const limpio = nfc(texto).replace(/\s+/g, ' ').trim();
  const res = { registro: r, edicion: null, anotados: [], revisados: [], confirmados: [], conflictos: [], aclaraciones: [], hipotesis: [], residuos: [], rechazo: null };
  const edicion = { id: `e${++r.siguiente}`, texto: limpio, turno, fuente, hechos: [], resultado: 'anotada' };
  r.ediciones.push(edicion);
  res.edicion = edicion;

  const motivo = !limpio ? 'vacia' : motivoAjeno(limpio);
  if (motivo) {
    edicion.resultado = motivo;
    res.rechazo = motivo;
    return res;
  }
  const corrige = CORRIGE.test(llano(limpio));
  let previo = null;
  let antecedente = null;
  for (const seg of segmentar(limpio)) {
    if (seg.soloAntecedente) { antecedente = nombresEn(seg.o).at(-1)?.nombre ?? null; continue; }
    if (seg.pregunta) { if (!res.hipotesis.includes(seg.pregunta)) res.hipotesis.push(seg.pregunta); continue; }
    if (HIPOTESIS.test(seg.n)) { res.hipotesis.push(conPunto(mayuscula(seg.o))); continue; }
    const hechos = hechosDeClausula(r, seg, { previo, antecedente, sujetoPorDefecto, edicion, turno, fuente, res });
    if (!hechos) continue;
    previo = hechos.sujeto ?? previo;
    antecedente = nombresEn(seg.o).at(-1)?.nombre ?? antecedente;
    for (const h of hechos.lista) aplicar(r, h, { corrige, res, edicion });
  }

  edicion.resultado = res.rechazo ?? (res.revisados.length ? 'revisa'
    : res.conflictos.length ? 'conflicto'
      : res.anotados.length ? 'anotada'
        : res.aclaraciones.length ? 'aclarar'
          : res.hipotesis.length ? 'hipotesis' : res.confirmados.length ? 'confirma' : 'sin_hechos');
  for (const a of res.aclaraciones) r.aclaraciones.push({ id: `a${++r.siguiente}`, edicion: edicion.id, texto: a.texto, motivo: a.motivo, opciones: a.opciones.map((o) => o.nombre), turno, abierta: true });
  return res;
}

/**
 * Los hechos de una cláusula, o una aclaración pendiente si no se sabe de
 * quién habla.
 * @private
 */
function hechosDeClausula(r, seg, { previo, antecedente, sujetoPorDefecto, edicion, turno, fuente, res }) {
  // La marca de corrección es de la edición, no del hecho.
  let o = seg.o.replace(/^(?:y|e|pero|aunque)\s+/iu, '')
    .replace(/^(?:en realidad|corrijo|correcci[oó]n|me equivoqu[eé]|rectifico|al final|resulta que|a partir de ahora|mejor dicho|lo cierto es que)\s*[:,]?\s*/iu, '');
  let n = llano(o);
  const preds = predicados(o, n);
  const extra = [];
  const primerPred = Math.min(...preds.filter((p) => !p.objeto).map((p) => p.idx), o.length);

  // ── ¿De quién? ─────────────────────────────────────────────────────────
  let sujeto = null;
  let explicito = false;
  const rel = n.match(new RegExp(String.raw`^(?:(mi|tu|su)\s+)(${PAR}|${VIN})\b(?:\s+(\p{L}+))?`, 'u'));
  const nombres = nombresEn(o).filter((x) => !trasPreposicion(o, x.i));
  const antesDelVerbo = nombres.filter((x) => x.i < primerPred);

  if (seg.coordinados?.length) {
    // «Aldo y Berin murieron»: un hecho por cada uno.
    const todos = [...seg.coordinados, ...antesDelVerbo.map((x) => x.nombre)];
    const lista = [];
    let ultimo = null;
    for (const nombre of todos) {
      const s = resolverNombre(r, nombre);
      if (s.ambiguo) { aclarar(res, seg.o, 'homonimo', s.ambiguo); continue; }
      registrarSujeto(r, s);
      ultimo = s;
      const entera = conPunto(mayuscula(`${seg.coordinados.join(', ')} y ${o}`));
      for (const p of preds.filter((x) => !x.objeto)) lista.push(nuevoHecho(r, s, p, { texto: entera, edicion, turno, fuente }));
    }
    return { sujeto: ultimo, lista };
  }
  if (rel && rel[1] === 'su') {
    if (!previo) { aclarar(res, seg.o, 'sin_sujeto', candidatos(r, preds)); return null; }
    const par = rel[2];
    sujeto = { clave: `${par} de ${previo.clave}`, nombre: `${articulo(par)} ${par} de ${previo.nombre}`, base: null };
    o = `${mayuscula(sujeto.nombre)}${o.slice(rel[0].length - (rel[3] ? rel[3].length + 1 : 0))}`;
    explicito = true;
  } else if (rel && (rel[1] === 'mi' || rel[1] === 'tu')) {
    const par = rel[2];
    const conNombre = rel[3] && nombres.find((x) => llano(x.nombre) === rel[3]);
    if (conNombre) {
      // «mi hermano Aldo murió»: Aldo, y además es mi hermano.
      const s = resolverNombre(r, conNombre.nombre);
      if (s.ambiguo) { aclarar(res, seg.o, 'homonimo', s.ambiguo); return null; }
      sujeto = s;
      extra.push({ predicado: PARIENTES.includes(par) ? 'parentesco' : 'vinculo', valor: par, de: 'yo', polaridad: true, tiempo: 'presente', texto: `${s.nombre} es mi ${par}.` });
    } else {
      // «mi hermano vive en Norte»: si el canon ya dice quién es, ese; si hay
      // varios, se pregunta; si no hay ninguno, «mi hermano» a secas.
      const quienes = r.hechos.filter((h) => h.vigente && h.polaridad && ['parentesco', 'vinculo'].includes(h.predicado) && h.valor === par && h.de === 'yo');
      const distintos = [...new Set(quienes.map((h) => h.sujeto))];
      if (distintos.length > 1) { aclarar(res, seg.o, 'relacion_ambigua', distintos.map((c) => r.sujetos[c])); return null; }
      sujeto = distintos.length === 1 ? r.sujetos[distintos[0]] : { clave: `mi ${par}`, nombre: `mi ${par}`, base: null };
    }
    explicito = true;
  } else if (antesDelVerbo.length) {
    const x = antesDelVerbo[0];
    const ep = o.slice(x.i + x.nombre.length).match(/^,?\s+((?:el|la)\s+(\p{Ll}{3,}))/u);
    const epiteto = ep && !VERBO.test(llano(ep[2])) && !PREPOSICIONES.has(llano(ep[2])) ? ep[1] : null;
    const s = resolverNombre(r, x.nombre, epiteto);
    if (s.ambiguo) { aclarar(res, seg.o, 'homonimo', s.ambiguo); return null; }
    sujeto = s;
    explicito = true;
  } else if (seg.relativo && antecedente) {
    const s = resolverNombre(r, antecedente);
    if (s.ambiguo) { aclarar(res, seg.o, 'homonimo', s.ambiguo); return null; }
    sujeto = s;
    o = `${s.nombre} ${o.replace(/^(?:que|quien)\s+/iu, '')}`;
  } else if (PRIMERA.test(n) || preds.some((p) => p.persona1 || p.primera)) {
    sujeto = { clave: 'yo', nombre: 'tu personaje', base: null };
    explicito = true;
  } else if (previo) {
    sujeto = previo;
    // «…, preso en Saucedo» → «Aldo está preso en Saucedo».
    o = `${previo.nombre} ${/^(?:pres[oa]s?|encerrad[oa]s?|cautiv[oa]s?|escondid[oa]s?|herid[oa]s?|enferm[oa]s?|viv[oa]s?|muert[oa]s?|casad[oa]s?|retenid[oa]s?)\b/iu.test(o) ? 'está ' : ''}${o}`;
  } else if (sujetoPorDefecto) {
    const s = resolverNombre(r, sujetoPorDefecto);
    sujeto = s.ambiguo ? { clave: llano(sujetoPorDefecto), nombre: sujetoPorDefecto, base: llano(sujetoPorDefecto) } : s;
    o = `${sujeto.nombre} ${o}`;
  } else if (preds.some((p) => UN_VALOR.has(p.predicado) && !p.objeto)) {
    // «Ahora está vivo»: no se adivina de quién.
    aclarar(res, seg.o, 'sin_sujeto', candidatos(r, preds));
    return null;
  } else {
    sujeto = { clave: 'mundo', nombre: 'el mundo', base: null };
  }
  n = llano(o);
  registrarSujeto(r, sujeto);

  // ── Los hechos ─────────────────────────────────────────────────────────
  const texto = conPunto(mayuscula(o.trim()));
  const lista = [];
  for (const e of extra) lista.push(nuevoHecho(r, sujeto, e, { texto: e.texto, edicion, turno, fuente }));
  for (const p of preds) {
    if (p.objeto) {
      // «Aldo mató a Berin»: el muerto es Berin, no Aldo.
      const v = resolverNombre(r, p.objeto);
      if (v.ambiguo) { aclarar(res, seg.o, 'homonimo', v.ambiguo); continue; }
      registrarSujeto(r, v);
      lista.push(nuevoHecho(r, v, p, { texto: `${v.nombre} está muerto (${texto.replace(/\.$/, '')}).`, edicion, turno, fuente }));
      continue;
    }
    if (p.predicado === 'otro' && p.rumor) { lista.push(nuevoHecho(r, sujeto, { predicado: 'rumor', polaridad: true }, { texto, edicion, turno, fuente })); continue; }
    if (p.implicito) { lista.push(nuevoHecho(r, sujeto, { ...p, deduceDe: texto }, { texto: `${mayuscula(sujeto.nombre)} sigue con vida (se deduce de «${texto}»).`, edicion, turno, fuente })); continue; }
    // Una cosa de una lista lleva su propia frase: «Tengo un mapa».
    const propio = p.texto ? conPunto(sujeto.clave === 'yo' ? mayuscula(p.texto) : `${mayuscula(sujeto.nombre)} ${p.texto}`) : texto;
    lista.push(nuevoHecho(r, sujeto, p, { texto: propio, edicion, turno, fuente }));
  }
  const conObjeto = preds.filter((p) => p.objeto).length;
  if (!preds.length || (conObjeto && conObjeto === preds.length && explicito)) {
    lista.push(nuevoHecho(r, sujeto, { predicado: 'otro', polaridad: !/^(?:no|nunca|jamas)\b/.test(n.replace(/^\p{L}+\s+/u, '')) }, { texto, edicion, turno, fuente }));
  }
  return { sujeto: sujeto.clave === 'mundo' ? previo : sujeto, lista };
}

/** A quién podría referirse una cláusula sin sujeto, para sugerirlo. */
function candidatos(r, preds) {
  const tocados = new Set(preds.map((p) => p.predicado));
  const claves = [...new Set(r.hechos.filter((h) => h.vigente && tocados.has(h.predicado) && r.sujetos[h.sujeto]?.base).map((h) => h.sujeto))];
  return claves.map((c) => r.sujetos[c]).slice(0, 4);
}

function aclarar(res, texto, motivo, opciones = []) {
  res.aclaraciones.push({ texto: conPunto(mayuscula(texto)), motivo, opciones: opciones.filter(Boolean) });
}

function nuevoHecho(r, sujeto, p, { texto, edicion, turno, fuente }) {
  return {
    id: `h${++r.siguiente}`,
    edicion: edicion.id,
    sujeto: sujeto.clave,
    nombre: sujeto.nombre,
    predicado: p.predicado,
    valor: p.valor ?? null,
    de: p.de ?? null,
    lugar: p.lugar ?? null,
    cuando: p.cuando ?? null,
    evento: p.evento ?? null,
    tiempo: p.tiempo ?? null,
    polaridad: p.polaridad ?? true,
    implicito: Boolean(p.implicito),
    deduceDe: p.deduceDe ?? null,
    texto,
    turno,
    fuente,
    version: 1,
    vigente: true,
    sustituye: [],
    sustituidoPor: null,
    deriva: p.deriva ?? null,
  };
}

/**
 * Mete un hecho en el registro: nuevo, confirmación, revisión o conflicto.
 * @private
 */
function aplicar(r, h, { corrige, res, edicion }) {
  const anadir = () => {
    r.hechos.push(h);
    edicion.hechos.push(h.id);
    if (!h.implicito) res.anotados.push(h);
  };
  const vigentesDe = (f) => r.hechos.filter((x) => x.vigente && x.sujeto === h.sujeto && f(x));

  if (UN_VALOR.has(h.predicado) && h.polaridad) {
    const enRanura = vigentesDe((x) => x.polaridad && ranura(x) === ranura(h));
    const iguales = enRanura.filter((x) => mismoValor(x, h));
    const distintos = enRanura.filter((x) => !mismoValor(x, h));

    if (h.implicito) {
      if (iguales.length) return;
      r.hechos.push(h);
      edicion.hechos.push(h.id);
      if (!distintos.length) return;
      if (corrige) { revisar(r, distintos, h, res); return; }
      conflicto(r, [...distintos], h, 'se_deduce', res);
      return;
    }
    const igual = iguales.find((x) => !x.implicito);
    const deduccionesIguales = iguales.filter((x) => x.implicito);
    if (igual) {
      const otroLugar = h.lugar && llano(h.lugar) !== llano(igual.lugar ?? '');
      // En la misma edición, el detalle completa sin que cuente como revisión
      // («Aldo mató a Berin, que murió en Saucedo»).
      if (otroLugar && igual.edicion === h.edicion && !igual.lugar) {
        anadir();
        revisar(r, [igual, ...distintos, ...deduccionesIguales], h, { revisados: [], residuos: res.residuos });
        res.anotados = res.anotados.filter((x) => x !== igual);
        return;
      }
      if (otroLugar) {
        anadir();
        revisar(r, [igual, ...distintos, ...deduccionesIguales], h, res);
        return;
      }
      res.confirmados.push(igual);
      if (distintos.length || deduccionesIguales.length) revisar(r, [...distintos, ...deduccionesIguales], igual, res, { porEdicion: edicion.id });
      return;
    }
    const mismaEdicion = distintos.filter((x) => x.edicion === h.edicion);
    anadir();
    if (mismaEdicion.length) {
      conflicto(r, mismaEdicion, h, 'misma_edicion', res);
      const resto = distintos.filter((x) => x.edicion !== h.edicion);
      if (resto.length) revisar(r, resto, h, res);
      return;
    }
    if (distintos.length || deduccionesIguales.length) revisar(r, [...distintos, ...deduccionesIguales], h, res);
    return;
  }

  if (!h.polaridad) {
    // Una negación retira un valor concreto, no todo lo del sujeto.
    let objetivo = vigentesDe((x) => x.polaridad && x.predicado === h.predicado && mismoValor(x, h));
    if (!objetivo.length && h.predicado === 'posesion') objetivo = vigentesDe((x) => x.polaridad && mismoNucleo(x, h));
    if (h.predicado === 'posesion' && new Set(objetivo.map((x) => llano(x.valor))).size > 1) {
      aclarar(res, h.texto, 'objeto_ambiguo', objetivo.map((x) => ({ nombre: x.valor })));
      return;
    }
    const repetida = vigentesDe((x) => !x.polaridad && x.predicado === h.predicado && mismoValor(x, h));
    if (repetida.length && !objetivo.length) { res.confirmados.push(repetida[0]); return; }
    anadir();
    if (objetivo.length) revisar(r, objetivo, h, res);
    return;
  }

  // Varios valores: se suman, sin duplicar. Lo positivo retira su negación.
  const dup = vigentesDe((x) => x.polaridad && x.predicado === h.predicado && mismoValor(x, h));
  if (dup.length) { res.confirmados.push(dup[0]); return; }
  anadir();
  const negacion = vigentesDe((x) => !x.polaridad && x.predicado === h.predicado && mismoValor(x, h));
  if (negacion.length) revisar(r, negacion, h, res);
}

/**
 * El nuevo sustituye a los viejos en su ranura. Los viejos quedan en el
 * registro, sin valer, con quién los sustituyó. Si la muerte de alguien se
 * revisa, dónde se contó que murió no se pierde: queda como hecho aparte.
 * @private
 */
function revisar(r, viejos, nuevo, res, { porEdicion = null } = {}) {
  const sustituidos = [];
  for (const v of viejos) {
    if (!v.vigente || v === nuevo) continue;
    v.vigente = false;
    v.sustituidoPor = nuevo.id;
    if (porEdicion) v.sustituidoEn = porEdicion;
    nuevo.sustituye = [...(nuevo.sustituye ?? []), v.id];
    nuevo.version = Math.max(nuevo.version ?? 1, (v.version ?? 1) + 1);
    if (!v.implicito) sustituidos.push(v);
    if (v.predicado === 'vida' && v.valor === 'muerto' && v.lugar && !(nuevo.predicado === 'vida' && nuevo.valor === 'muerto')) {
      const residuo = {
        ...v,
        id: `h${++r.siguiente}`,
        predicado: 'suceso_lugar',
        evento: 'muerte',
        valor: v.lugar,
        texto: `Lo que se contó como la muerte de ${v.nombre} ocurrió en ${v.lugar}${v.cuando ? `, ${v.cuando}` : ''}.`,
        vigente: true,
        version: 1,
        sustituye: [],
        sustituidoPor: null,
        deriva: v.id,
      };
      r.hechos.push(residuo);
      res.residuos.push(residuo);
    }
    for (const c of r.conflictos) if (c.abierto && c.hechos.includes(v.id)) { c.abierto = false; c.resueltoPor = nuevo.id; }
  }
  if (sustituidos.length) res.revisados.push({ nuevo, viejos: sustituidos });
}

function conflicto(r, viejos, nuevo, motivo, res) {
  const c = { id: `c${++r.siguiente}`, sujeto: nuevo.sujeto, predicado: nuevo.predicado, hechos: [...viejos.map((v) => v.id), nuevo.id], motivo, turno: nuevo.turno, abierto: true };
  r.conflictos.push(c);
  res.conflictos.push({ ...c, nuevo, frente: viejos });
}

/* ═══════════════════════════════════════════════════════════════════════════
   MIGRACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Pasa un registro de cualquier versión a la actual, sin perder ediciones.
 *
 * Versión 1 (una entrada de texto por sujeto y familia, con `revisiones`):
 * la sustitución entera borraba de lo VIGENTE los hechos que la edición
 * nueva no tocaba, pero sus textos seguían en `revisiones`. Se reproducen
 * TODAS las versiones, en orden, con las reglas de ahora: lo que la
 * sustitución entera se llevó sin motivo vuelve a valer.
 *
 * Lo que no se puede reparar solo (queda anotado en `migracion.avisos`):
 *   · El orden exacto de dos ediciones del mismo turno sobre entradas
 *     distintas. Las ediciones de canon no avanzan el turno y la v1 no
 *     guardaba la hora de cada revisión. Se ordenan por la creación de su
 *     entrada; si tocan el mismo sujeto se avisa.
 *   · Lo que las partidas anteriores a la v1 ya habían perdido: las
 *     ediciones vivían entre los hechos de la memoria, recortadas a 200
 *     caracteres y podables. Lo recortado o podado no está en el guardado.
 *     (Esto lo migra `MemoryStore`, que marca las que llegan recortadas.)
 *
 * @param {Object|null} viejo
 * @returns {Object} Un registro de la versión actual (el mismo objeto si ya lo era).
 */
export function migrarRegistro(viejo) {
  if (!viejo) return crearRegistro();
  if (viejo.version === VERSION_REGISTRO && Array.isArray(viejo.hechos)) {
    viejo.sujetos ??= {};
    viejo.conflictos ??= [];
    viejo.aclaraciones ??= [];
    return viejo;
  }
  const entradas = viejo.entradas ?? [];
  const creacion = (e, i) => {
    const partes = String(e.id ?? '').split('-');
    const t = parseInt(partes[2] ?? '', 36);
    return Number.isFinite(t) ? t : i;
  };
  const pasos = [];
  entradas.forEach((e, i) => {
    const historia = [...(e.revisiones ?? []), { texto: e.texto, turno: e.turno, fuente: e.fuente }];
    historia.forEach((v, j) => pasos.push({ texto: v.texto, turno: v.turno ?? 0, fuente: v.fuente ?? 'jugador', entrada: i, creacion: creacion(e, i), j, sujeto: e.sujeto }));
  });
  pasos.sort((a, b) => a.turno - b.turno || a.creacion - b.creacion || a.entrada - b.entrada || a.j - b.j);

  const avisos = [];
  const porTurno = new Map();
  for (const p of pasos) {
    const k = `${p.turno}·${p.sujeto ?? ''}`;
    if (!porTurno.has(k)) porTurno.set(k, new Set());
    porTurno.get(k).add(p.entrada);
  }
  for (const [k, s] of porTurno) {
    if (s.size > 1 && !k.endsWith('·')) avisos.push(`Orden incierto: en el turno ${k.split('·')[0]} hubo ediciones de «${k.split('·')[1]}» en ${s.size} entradas distintas; se aplican por orden de creación.`);
  }

  let r = crearRegistro();
  for (const p of pasos) {
    r = anotar(r, p.texto, { turno: p.turno, fuente: `${String(p.fuente).replace(/ \(migrado.*\)$/, '')} (migrado de la v1)` }).registro;
  }
  r.migracion = { desde: viejo.version ?? 1, ediciones: pasos.length, avisos };
  return r;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LECTURA
   ═══════════════════════════════════════════════════════════════════════════ */

/** Los hechos que valen, sin las deducciones internas. */
export function vigentes(registro, { conDeducciones = false } = {}) {
  const r = migrarRegistro(registro);
  return r.hechos.filter((h) => h.vigente && (conDeducciones || !h.implicito));
}

/** Lo que vale de un sujeto (por nombre o por clave). */
export function hechosDe(registro, sujeto) {
  const r = migrarRegistro(registro);
  const k = llano(sujeto);
  return vigentes(r).filter((h) => h.sujeto === k || r.sujetos[h.sujeto]?.base === k);
}

/** Estados de vida: clave → {nombre, base, estado: 'muerto'|'vivo'|'dudoso'}. */
function estadosDeVida(r) {
  const out = new Map();
  const vida = r.hechos.filter((h) => h.vigente && h.predicado === 'vida');
  for (const h of vida) {
    const s = r.sujetos[h.sujeto];
    const prev = out.get(h.sujeto);
    const estado = prev && prev.estado !== h.valor ? 'dudoso' : h.valor;
    out.set(h.sujeto, { nombre: s?.nombre ?? h.nombre, base: s?.base ?? null, estado });
  }
  return out;
}

/* Lo que se deduce de textos que no son ediciones (la historia, las notas de
   las entidades) se recalcula cada turno: se guarda por texto. */
const memoAnalisis = new Map();
function analizar(texto, { sujetoPorDefecto = null, fuente = 'historia' } = {}) {
  const clave = `${sujetoPorDefecto ?? ''}\u0001${texto}`;
  if (memoAnalisis.has(clave)) return memoAnalisis.get(clave);
  let r = crearRegistro();
  for (const frase of String(texto ?? '').split(/(?<=[.!?…])\s+/u).filter(Boolean)) {
    if (motivoAjeno(frase)) continue;
    r = anotar(r, frase, { turno: 0, fuente, sujetoPorDefecto }).registro;
  }
  if (memoAnalisis.size > 400) memoAnalisis.clear();
  memoAnalisis.set(clave, r);
  return r;
}

/**
 * Todo el canon, como unidades que se envían enteras o no se envían:
 *
 *   · las ediciones del jugador, agrupadas por sujeto: TODO lo que vale de
 *     Aldo viaja junto (lo general, sin sujeto, va hecho a hecho);
 *   · su historia, por frases, sin recortar ninguna;
 *   · las entidades que ha nombrado, con todas sus notas y rasgos.
 *
 * @param {Object} fuentes
 * @param {Object} [fuentes.registro]
 * @param {string} [fuentes.lore]
 * @param {Array<Object>} [fuentes.entidades] De MemoryStore.canon.
 * @returns {Array<Object>}
 */
export function entradasDe({ registro = null, lore = '', entidades = [] } = {}) {
  const r = migrarRegistro(registro);
  const lista = [];
  const abiertos = r.conflictos.filter((c) => c.abierto);
  const enConflicto = new Map();
  for (const c of abiertos) for (const id of c.hechos) enConflicto.set(id, c);

  const porSujeto = new Map();
  for (const h of vigentes(r)) {
    const k = h.sujeto === 'mundo' ? `mundo-${h.id}` : h.sujeto;
    if (!porSujeto.has(k)) porSujeto.set(k, []);
    porSujeto.get(k).push(h);
  }
  for (const [k, hechos] of porSujeto) {
    const s = r.sujetos[hechos[0].sujeto];
    const textos = [...new Set(hechos.map((h) => {
      const c = enConflicto.get(h.id);
      return c ? `${h.texto} [EN CONFLICTO sin resolver: no lo des por cierto]` : h.texto;
    }))];
    // Una deducción en conflicto también se ve: es la otra mitad del choque.
    for (const c of abiertos) {
      if (c.sujeto !== hechos[0].sujeto) continue;
      for (const id of c.hechos) {
        const h = r.hechos.find((x) => x.id === id);
        if (h?.implicito && h.vigente) textos.push(`${h.texto} [EN CONFLICTO sin resolver: no lo des por cierto]`);
      }
    }
    const revisiones = r.hechos.filter((h) => !h.vigente && h.sujeto === hechos[0].sujeto && h.sustituidoPor).length;
    lista.push({
      id: `canon-${k.replace(/[^\p{L}\p{N}]+/gu, '-')}`,
      texto: textos.join(' '),
      fuente: 'jugador (edición deliberada)',
      turno: Math.max(...hechos.map((h) => h.turno ?? 0)),
      sujeto: s?.base ?? null,
      buscar: palabrasDe(s?.nombre ?? hechos[0].texto),
      prioridad: 3,
      ...(revisiones ? { revisiones } : {}),
    });
  }
  const frases = String(lore ?? '').split(/(?<=[.!?…])\s+/u).map((f) => f.trim()).filter(Boolean);
  frases.forEach((f, i) => lista.push({ id: `lore-${i}`, texto: f, fuente: 'jugador (historia del personaje)', turno: 0, sujeto: null, buscar: palabrasDe(nombresEn(f).map((x) => x.nombre).join(' ')), prioridad: 2 }));
  for (const c of entidades ?? []) {
    const partes = [c.nombre];
    if (c.rasgos?.length) partes.push(`(${c.rasgos.join(', ')})`);
    const texto = `${partes.join(' ')}${c.notas?.length ? `: ${c.notas.join('; ')}` : ''}`;
    lista.push({ id: `entidad-${llano(c.nombre).replace(/\s+/g, '-')}`, texto, fuente: c.origen === 'importado' ? 'jugador (historia importada)' : 'jugador (nombrado jugando)', turno: c.turno ?? null, sujeto: llano(c.nombre), buscar: palabrasDe(c.nombre), prioridad: 1, menciones: c.menciones ?? 1 });
  }
  return lista;
}

const palabrasDe = (t) => llano(t).split(/[^\p{L}]+/u).filter((w) => w.length >= 3 && !NO_NOMBRE.has(w) && !['canon', 'personaje'].includes(w));

/**
 * Lo que choca en el canon:
 *
 *   · conflictos abiertos del registro: dos afirmaciones que se guardan
 *     porque no era seguro cuál corregía a cuál (`vale: null`);
 *   · una edición frente a la historia del personaje, sobre lo mismo: vale
 *     la edición, y se dice.
 *
 * @param {Object} fuentes
 * @returns {Array<{sujeto: string, predicado: string, vale: string|null, sustituye?: string, versiones?: string[]}>}
 */
export function conflictosDe({ registro = null, lore = '' } = {}) {
  const r = migrarRegistro(registro);
  const choques = [];
  for (const c of r.conflictos.filter((x) => x.abierto)) {
    const hechos = c.hechos.map((id) => r.hechos.find((h) => h.id === id)).filter(Boolean);
    choques.push({ sujeto: r.sujetos[c.sujeto]?.nombre ?? c.sujeto, predicado: c.predicado, vale: null, versiones: hechos.map((h) => h.texto), nota: 'sin resolver: no afirmes ninguna; el jugador lo aclarará' });
  }
  if (lore) {
    const historia = analizar(lore);
    for (const h of vigentes(r)) {
      if (!UN_VALOR.has(h.predicado) || !h.polaridad) continue;
      for (const x of vigentes(historia)) {
        if (x.sujeto !== h.sujeto || ranura(x) !== ranura(h) || !x.polaridad || mismoValor(x, h)) continue;
        choques.push({ sujeto: r.sujetos[h.sujeto]?.nombre ?? h.sujeto, predicado: h.predicado, vale: h.texto, sustituye: x.texto });
      }
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
  const claves = new Set([llano(texto), ...nombres.map(llano)].join(' ').split(/[^\p{L}]+/u).filter(Boolean));
  const pertinente = (e) => ((e.buscar ?? []).some((w) => claves.has(w)) ? 10 : 0)
    + llano(e.texto).split(/[^\p{L}]+/u).filter((w) => w.length >= 5 && claves.has(w)).length;
  const orden = todas
    .map((e, i) => ({ e, i, p: pertinente(e) }))
    .sort((a, b) => b.p - a.p || b.e.prioridad - a.e.prioridad || (b.e.menciones ?? 0) - (a.e.menciones ?? 0) || a.i - b.i);

  const conflictos = conflictosDe(fuentes);
  const entradas = [];
  const omitidas = [];
  let usado = JSON.stringify(conflictos).length;
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
  return { entradas, omitidas, total: todas.length, completa: omitidas.length === 0, conflictos };
}

/**
 * Quién está muerto según el canon entero, quepa o no en la petición. Es la
 * red del verificador: un muerto no habla.
 *
 * Solo cuenta el SUJETO de cada hecho («Aldo mató a Berin» mata a Berin, no
 * a Aldo ni a Saucedo) y solo lo vigente. Manda la edición del jugador sobre
 * su historia, y la historia sobre las notas de las entidades. Un conflicto
 * sin resolver no mata a nadie, y con dos personas del mismo nombre solo
 * cuenta si las dos están muertas.
 *
 * @param {Object} fuentes
 * @returns {string[]} Nombres.
 */
export function muertosSegunCanon({ registro = null, lore = '', entidades = [] } = {}) {
  const capas = [estadosDeVida(migrarRegistro(registro)), estadosDeVida(analizar(lore))];
  const notas = new Map();
  for (const c of entidades ?? []) {
    if (!c?.nombre || !c.notas?.length) continue;
    for (const [k, v] of estadosDeVida(analizar(c.notas.join('. '), { sujetoPorDefecto: c.nombre, fuente: 'entidad' }))) if (!notas.has(k)) notas.set(k, v);
  }
  capas.push(notas);

  const final = new Map();
  for (const capa of capas) for (const [k, v] of capa) if (!final.has(k)) final.set(k, v);
  const porNombre = new Map();
  for (const v of final.values()) {
    if (!v.base) continue;
    if (!porNombre.has(v.base)) porNombre.set(v.base, []);
    porNombre.get(v.base).push(v);
  }
  const muertos = [];
  for (const lista of porNombre.values()) {
    if (lista.every((v) => v.estado === 'muerto')) muertos.push(lista[0].nombre.split(' ')[0]);
  }
  return muertos;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LO QUE SE LE DICE AL JUGADOR
   ═══════════════════════════════════════════════════════════════════════════ */

const cita = (h) => `«${h.texto}»`;
const citas = (xs) => [...new Set(xs.map(cita))].join(' ');

/**
 * El mensaje de sistema tras una edición: qué se anotó, qué se revisó (y qué
 * sigue valiendo), qué choca y qué hace falta aclarar.
 * @param {ReturnType<typeof anotar>} res
 * @returns {string}
 */
export function mensajeDeEdicion(res) {
  if (res.rechazo === 'instruccion') return 'Canon sin cambios: eso parece una instrucción para el narrador, no un hecho de tu mundo. El canon guarda hechos («canon: Aldo es mi hermano»), no reglas de narración.';
  if (res.rechazo === 'ajeno') return 'Canon sin cambios: eso viene de otra partida o de otra conversación. Si quieres que cuente aquí, escríbelo como un hecho de este mundo.';
  if (res.rechazo === 'vacia') return 'Canon sin cambios: la edición está vacía.';
  const partes = [];
  const revisadosIds = new Set(res.revisados.map((x) => x.nuevo.id));
  const nuevos = res.anotados.filter((h) => !revisadosIds.has(h.id) && h.vigente);
  if (nuevos.length) partes.push(`Canon anotado (fuera de la historia): ${citas(nuevos)}`);
  for (const { nuevo, viejos } of res.revisados) {
    partes.push(`Canon revisado: ${nuevo.implicito ? `«${nuevo.deduceDe}»` : cita(nuevo)} sustituye a ${viejos.map(cita).join(' y ')}, que queda en su historial.`);
  }
  if (res.residuos.length) partes.push(`Se conserva: ${citas(res.residuos)}`);
  if (res.revisados.length) {
    const tocados = new Set(res.revisados.map((x) => x.nuevo.sujeto));
    const fuera = new Set([...res.revisados.map((x) => x.nuevo.id), ...res.residuos.map((x) => x.id), ...res.anotados.map((x) => x.id)]);
    const sigue = res.registro.hechos.filter((h) => h.vigente && !h.implicito && tocados.has(h.sujeto) && !fuera.has(h.id));
    if (sigue.length) partes.push(`Sigue valiendo: ${citas(sigue)}`);
  }
  if (res.confirmados.length && !res.anotados.length && !res.revisados.length) partes.push(`Ya estaba en el canon: ${citas(res.confirmados)}`);
  for (const c of res.conflictos) {
    const nombre = mayuscula(c.nuevo.nombre);
    const ejemplo = c.predicado === 'vida' ? ` Por ejemplo: «canon: ${nombre} está vivo» o «canon: ${nombre} sigue muerto».` : ' Di cuál vale.';
    const dicho = c.nuevo.implicito ? `«${c.nuevo.deduceDe}» supone que ${c.nuevo.nombre} sigue con vida` : cita(c.nuevo);
    partes.push(`Esto choca con el canon: ${dicho}, frente a ${c.frente.map(cita).join(' y ')}. Guardo las dos y el narrador no dará ninguna por cierta hasta que lo aclares.${ejemplo}`);
  }
  for (const a of res.aclaraciones) {
    const nombres = a.opciones.map((o) => o.nombre ?? o);
    if (a.motivo === 'homonimo') partes.push(`No anoto «${a.texto}»: hay más de uno con ese nombre en tu canon (${nombres.join(', ')}). Di cuál, por ejemplo «canon: ${nombres[0]} …».`);
    else if (a.motivo === 'relacion_ambigua') partes.push(`No anoto «${a.texto}»: en tu canon hay más de uno así (${nombres.join(', ')}). Escríbelo con su nombre.`);
    else if (a.motivo === 'objeto_ambiguo') partes.push(`No anoto «${a.texto}»: en tu canon hay varias cosas así (${nombres.join(', ')}). Di cuál.`);
    else partes.push(`No anoto «${a.texto}»: no dice de quién.${nombres.length ? ` ¿Hablas de ${nombres.join(' o de ')}?` : ''} Escríbelo con su nombre${nombres.length ? `, por ejemplo «canon: ${nombres[0]} ${a.texto.charAt(0).toLowerCase()}${a.texto.slice(1).replace(/\.$/, '')}»` : ''}.`);
  }
  for (const h of res.hipotesis) partes.push(`«${h}» suena a pregunta o suposición: no cambia el canon. Si quieres que cuente, afírmalo.`);
  if (!partes.length) return `Canon anotado (fuera de la historia): «${res.edicion.texto}».`;
  return partes.map((p) => conPunto(p)).join(' ');
}

export default { crearRegistro, anotar, migrarRegistro, vigentes, hechosDe, entradasDe, proyectar, conflictosDe, muertosSegunCanon, mensajeDeEdicion, motivoAjeno };
