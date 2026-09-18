/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · ai/ResponseSchema.js
 * ---------------------------------------------------------------------------
 * Esquema y reparación del contrato JSON del director.
 *
 * Frontera entre lo no fiable y el motor. Todo lo que devuelve un modelo de
 * lenguaje pasa por aquí antes de tocar el estado.
 *
 * Filosofía: REPARAR ANTES QUE RECHAZAR. Un turno con un campo raro no debe
 * arruinar la partida. Se descarta el campo, se anota el problema y se sigue.
 * Solo lo estructuralmente irreparable —que no haya narración— se rechaza.
 *
 * `repararJSON` merece atención especial: los modelos envuelven el JSON en
 * bloques de código, añaden explicaciones, dejan comas colgando y usan comillas
 * tipográficas. Todo eso se corrige antes de intentar el parseo.
 *
 * Dependencias: core/Validator, config, Logger.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { validar, S } from '../core/Validator.js';
import { COTAS_IA } from '../config/balance.config.js';
import { DIRECTOR, CONTRATO } from '../config/ai.config.js';
import { APP } from '../config/app.config.js';
import { crearCanal } from '../core/Logger.js';

const log = crearCanal('ai');

/* ═══════════════════════════════════════════════════════════════════════════
   SUBESQUEMAS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Una opción sugerida. */
const ESQUEMA_OPCION = S.objeto({
  id: S.texto({ max: 24 }),
  label: S.texto({ requerido: true, min: 1, max: COTAS_IA.etiquetaOpcionMax }),
  intent: S.enumerado(DIRECTOR.intenciones, { defecto: 'custom' }),
  risk: S.enumerado(['low', 'medium', 'high', 'social'], { defecto: 'low' }),
  icon: S.texto({ max: 24 }),
  hidden: S.booleano({ defecto: false }),
});

/**
 * Un delta de recurso.
 *
 * El contrato admite `{delta: -5}` y `{set: 40}`. Se aceptan ambos, y también
 * un número suelto: los modelos lo escriben así con frecuencia y rechazarlo por
 * eso sería absurdo.
 */
const ESQUEMA_DELTA = S.objeto({
  delta: S.numero(),
  set: S.numero(),
}, {
  transformar: (v) => (typeof v === 'number' ? { delta: v } : v),
});

/** Cambios propuestos al personaje. */
const ESQUEMA_ACTUALIZACIONES = S.objeto({
  hp: ESQUEMA_DELTA,
  mana: ESQUEMA_DELTA,
  xp: ESQUEMA_DELTA,
  gold: ESQUEMA_DELTA,
  hunger: ESQUEMA_DELTA,
  thirst: ESQUEMA_DELTA,
  fatigue: ESQUEMA_DELTA,
  morale: ESQUEMA_DELTA,
  flags: S.objeto({}, { adicionales: true, defecto: {} }),
}, { adicionales: false, defecto: {} });

/** Un objeto entregado. */
const ESQUEMA_OBJETO = S.objeto({
  refId: S.texto({ max: 48 }),
  nombre: S.texto({ max: 60 }),
  descripcion: S.texto({ max: 300 }),
  qty: S.entero({ min: 1, max: 99, defecto: 1, saturar: true }),
  rareza: S.texto({ max: 16 }),
  durability: S.numero({ min: 0, max: 100, saturar: true }),
});

/** Un objetivo de misión. */
const ESQUEMA_OBJETIVO = S.objeto({
  id: S.texto({ max: 32 }),
  texto: S.texto({ requerido: true, max: 140 }),
  hecho: S.booleano({ defecto: false }),
});

/** Una operación sobre misiones. */
const ESQUEMA_MISION = S.objeto({
  id: S.texto({ requerido: true, max: 48 }),
  action: S.enumerado(['offer', 'accept', 'progress', 'complete', 'fail'], { defecto: 'progress' }),
  title: S.texto({ max: 80 }),
  summary: S.texto({ max: 400 }),
  tipo: S.enumerado(['principal', 'secundaria', 'menor'], { defecto: 'secundaria' }),
  objectives: S.lista(ESQUEMA_OBJETIVO, { max: 8 }),
  reward: S.objeto({
    xp: S.entero({ min: 0, max: 2000, saturar: true }),
    gold: S.entero({ min: 0, max: 2000, saturar: true }),
    items: S.lista(ESQUEMA_OBJETO, { max: 3 }),
  }),
});

/** Un enemigo de combate. */
const ESQUEMA_ENEMIGO = S.objeto({
  refId: S.texto({ max: 48 }),
  nombre: S.texto({ max: 60 }),
  count: S.entero({ min: 1, max: COTAS_IA.enemigosPorCombate, defecto: 1, saturar: true }),
  level: S.entero({ min: 1, max: 20, defecto: 1, saturar: true }),
  amenaza: S.texto({ max: 24 }),
});

/** Declaración de combate. */
const ESQUEMA_COMBATE = S.objeto({
  start: S.booleano({ defecto: false }),
  ambush: S.booleano({ defecto: false }),
  enemies: S.lista(ESQUEMA_ENEMIGO, { max: COTAS_IA.enemigosPorCombate }),
  terrain: S.texto({ max: 32 }),
  escapable: S.booleano({ defecto: true }),
}, { defecto: {} });

/** Un evento del mundo. */
const ESQUEMA_EVENTO = S.objeto({
  type: S.enumerado(
    ['weather', 'npc_meet', 'discovery', 'faction', 'ambient', 'time', 'location', 'container'],
    { defecto: 'ambient' },
  ),
  payload: S.objeto({}, { adicionales: true, defecto: {} }),
  silent: S.booleano({ defecto: false }),
});

/* ═══════════════════════════════════════════════════════════════════════════
   ESQUEMA COMPLETO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Contrato completo de una respuesta de turno.
 *
 * `story` es el único campo verdaderamente obligatorio: sin narración no hay
 * turno. Todo lo demás tiene valor por defecto.
 */
export const ESQUEMA_RESPUESTA = S.objeto({
  schemaVersion: S.entero({ defecto: APP.versionContratoIA }),

  story: S.texto({ requerido: true, min: 1, max: COTAS_IA.narracionMax }),

  choices: S.lista(ESQUEMA_OPCION, { max: DIRECTOR.opciones.max, defecto: [] }),

  playerUpdates: ESQUEMA_ACTUALIZACIONES,

  newItems: S.lista(ESQUEMA_OBJETO, { max: COTAS_IA.objetosPorTurno, defecto: [] }),

  quests: S.lista(ESQUEMA_MISION, { max: COTAS_IA.misionesPorTurno, defecto: [] }),

  combat: ESQUEMA_COMBATE,

  events: S.lista(ESQUEMA_EVENTO, { max: 8, defecto: [] }),

  memory: S.lista(S.texto({ max: 200 }), { max: COTAS_IA.memoriaPorTurno, defecto: [] }),

  mood: S.texto({ max: 24, defecto: 'neutro' }),

  sceneBreak: S.booleano({ defecto: false }),

  npcs: S.lista(S.objeto({
    refId: S.texto({ max: 48 }),
    nombre: S.texto({ max: 60 }),
    rol: S.texto({ max: 40 }),
    actitud: S.texto({ max: 24 }),
    presente: S.booleano({ defecto: true }),
  }), { max: 5, defecto: [] }),

  location: S.objeto({
    refId: S.texto({ max: 48 }),
    nombre: S.texto({ max: 60 }),
    terreno: S.texto({ max: 24 }),
    descripcion: S.texto({ max: 300 }),
  }),

  timeAdvance: S.entero({ min: 0, max: 1440, saturar: true }),
}, { adicionales: false });

/* ═══════════════════════════════════════════════════════════════════════════
   REPARACIÓN DE JSON
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Extrae y repara el JSON de una respuesta cruda.
 *
 * Los modelos de lenguaje fallan de formas predecibles. Esta función corrige
 * las más habituales, en orden:
 *
 *   1. Bloques de código markdown envolviendo el JSON
 *   2. Texto explicativo antes o después
 *   3. Comillas tipográficas en vez de rectas
 *   4. Comas finales antes de cerrar
 *   5. Comentarios de estilo JavaScript
 *   6. Claves sin comillas
 *
 * @param {string} crudo
 * @returns {{objeto: Object|null, reparaciones: string[], error: string|null}}
 */
export function repararJSON(crudo) {
  const reparaciones = [];

  if (typeof crudo !== 'string' || !crudo.trim()) {
    return { objeto: null, reparaciones, error: 'respuesta vacía' };
  }

  let texto = crudo.trim();

  // ─── 1. Intento directo ────────────────────────────────────────────────
  try {
    return { objeto: JSON.parse(texto), reparaciones, error: null };
  } catch {
    // Sigue el proceso de reparación.
  }

  // ─── 2. Quitar bloques de código ───────────────────────────────────────
  const bloque = texto.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (bloque) {
    texto = bloque[1].trim();
    reparaciones.push('bloque de código retirado');
  }

  // ─── 3. Extraer el objeto equilibrado ──────────────────────────────────
  // Se busca desde la primera llave y se cuenta hasta cerrar, respetando las
  // cadenas: una llave dentro de un texto no cuenta.
  const inicio = texto.indexOf('{');
  if (inicio === -1) return { objeto: null, reparaciones, error: 'no se encontró ningún objeto JSON' };

  let profundidad = 0;
  let enCadena = false;
  let escapado = false;
  let fin = -1;

  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i];

    if (escapado) { escapado = false; continue; }
    if (c === '\\') { escapado = true; continue; }
    if (c === '"') { enCadena = !enCadena; continue; }
    if (enCadena) continue;

    if (c === '{') profundidad++;
    else if (c === '}') {
      profundidad--;
      if (profundidad === 0) { fin = i + 1; break; }
    }
  }

  if (fin === -1) {
    return { objeto: null, reparaciones, error: 'el objeto JSON está incompleto' };
  }

  if (inicio > 0 || fin < texto.length) {
    texto = texto.slice(inicio, fin);
    reparaciones.push('texto sobrante retirado');
  }

  try {
    return { objeto: JSON.parse(texto), reparaciones, error: null };
  } catch {
    // Continúa con las reparaciones de contenido.
  }

  // ─── 4. Comillas tipográficas ──────────────────────────────────────────
  const conComillasRectas = texto.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  if (conComillasRectas !== texto) {
    texto = conComillasRectas;
    reparaciones.push('comillas tipográficas corregidas');
  }

  // ─── 5. Comentarios ────────────────────────────────────────────────────
  const sinComentarios = texto
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:"'])\/\/[^\n\r]*/g, '$1');
  if (sinComentarios !== texto) {
    texto = sinComentarios;
    reparaciones.push('comentarios retirados');
  }

  // ─── 6. Comas colgando ─────────────────────────────────────────────────
  const sinComasFinales = texto.replace(/,(\s*[}\]])/g, '$1');
  if (sinComasFinales !== texto) {
    texto = sinComasFinales;
    reparaciones.push('comas finales retiradas');
  }

  // ─── 7. Claves sin comillas ────────────────────────────────────────────
  const conClavesCitadas = texto.replace(/([{,]\s*)([a-zA-Z_$][\w$]*)\s*:/g, '$1"$2":');
  if (conClavesCitadas !== texto) {
    texto = conClavesCitadas;
    reparaciones.push('claves entrecomilladas');
  }

  try {
    const objeto = JSON.parse(texto);
    log.debug(`JSON reparado (${reparaciones.length} correcciones)`, reparaciones);
    return { objeto, reparaciones, error: null };
  } catch (e) {
    return { objeto: null, reparaciones, error: `JSON irreparable: ${e.message}` };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   VALIDACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Valida y sanea una respuesta del director.
 *
 * @param {Object|string} entrada Objeto ya parseado, o texto crudo.
 * @returns {{
 *   valida: boolean, respuesta: Object|null,
 *   fallos: Array<Object>, avisos: Array<Object>, reparaciones: string[]
 * }}
 */
export function validarRespuesta(entrada) {
  let objeto = entrada;
  let reparaciones = [];

  // Texto crudo: primero hay que extraer el JSON.
  if (typeof entrada === 'string') {
    const r = repararJSON(entrada);
    if (!r.objeto) {
      return {
        valida: false,
        respuesta: null,
        fallos: [{ ruta: 'raiz', problema: r.error }],
        avisos: [],
        reparaciones: r.reparaciones,
      };
    }
    objeto = r.objeto;
    reparaciones = r.reparaciones;
  }

  const resultado = validar(objeto, ESQUEMA_RESPUESTA);

  // Sin narración no hay turno posible.
  if (!resultado.valor?.story) {
    return {
      valida: false,
      respuesta: null,
      fallos: [{ ruta: 'story', problema: 'la narración es obligatoria' }, ...resultado.fallos],
      avisos: resultado.avisos,
      reparaciones,
    };
  }

  // El resto de fallos son tolerables: se anotan y se sigue.
  if (resultado.fallos.length) {
    log.debug(`respuesta con ${resultado.fallos.length} campos descartados`, resultado.fallos);
  }

  return {
    valida: true,
    respuesta: _normalizar(resultado.valor),
    fallos: resultado.fallos,
    avisos: resultado.avisos,
    reparaciones,
  };
}

/**
 * Ajustes finales tras la validación.
 *
 * @param {Object} r
 * @returns {Object}
 * @private
 */
function _normalizar(r) {
  // Las opciones sin identificador reciben uno: el motor los necesita para
  // rastrear qué eligió el jugador.
  r.choices = (r.choices ?? []).map((o, i) => ({
    ...o,
    id: o.id || `c${i + 1}`,
  })).filter((o) => o.label && !o.hidden);

  // Si el director no propuso ninguna, se usan las de respaldo: quedarse sin
  // opciones deja la interfaz vacía y al jugador sin pistas.
  if (!r.choices.length) {
    r.choices = DIRECTOR.opcionesRespaldo.map((o) => ({ ...o }));
  }

  // Un combate sin enemigos declarados no puede empezar.
  if (r.combat?.start && !r.combat.enemies?.length) {
    r.combat = {};
  }

  // La narración se recorta por frase completa si excede el máximo, en vez de
  // cortarse a mitad de palabra.
  if (r.story.length > COTAS_IA.narracionMax) {
    const corte = r.story.slice(0, COTAS_IA.narracionMax);
    const ultimoPunto = Math.max(corte.lastIndexOf('.'), corte.lastIndexOf('!'), corte.lastIndexOf('?'));
    r.story = ultimoPunto > COTAS_IA.narracionMax * 0.6
      ? corte.slice(0, ultimoPunto + 1)
      : `${corte.trim()}…`;
  }

  return r;
}

/* ═══════════════════════════════════════════════════════════════════════════
   INSTRUCCIONES PARA EL MODELO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Descripción del contrato para incluir en el prompt.
 *
 * El ejemplo pesa más que la explicación: los modelos imitan la forma mucho
 * mejor de lo que siguen una especificación abstracta.
 *
 * @returns {string}
 */
export function instruccionesContrato() {
  return [
    'FORMATO DE RESPUESTA',
    '',
    'Responde ÚNICAMENTE con un objeto JSON válido. Sin texto antes, sin texto después,',
    'sin bloques de código, sin explicaciones.',
    '',
    'Estructura exacta:',
    JSON.stringify(CONTRATO.ejemplo, null, 2),
    '',
    'Reglas de los campos:',
    '· story: la narración del turno, en segunda persona y presente.',
    `· choices: entre ${DIRECTOR.opciones.min} y ${DIRECTOR.opciones.max} opciones. intent debe ser uno de: ${DIRECTOR.intenciones.join(', ')}.`,
    '· playerUpdates: usa {"delta": N} para sumar o restar, {"set": N} para fijar.',
    '  Los cambios deben ser modestos; el motor recortará cualquier exceso.',
    '· newItems: objetos entregados. Usa refId si conoces el catálogo, o nombre si no.',
    '· quests: operaciones sobre misiones. action ∈ offer|accept|progress|complete|fail.',
    '· combat: solo si empieza un combate. Debe incluir enemies.',
    '· events: sucesos del mundo. Marca silent:true si no debe narrarse aparte.',
    '· memory: hechos permanentes que debas recordar en turnos futuros.',
    '',
    'No incluyas campos que no aparezcan en el ejemplo: se descartarán.',
  ].join('\n');
}

/**
 * Mensaje de corrección cuando la respuesta llegó malformada.
 * @param {string} error
 * @returns {string}
 */
export function instruccionReparacion(error) {
  return `${CONTRATO.instruccionReparacion}\n\nProblema detectado: ${error}`;
}

export default {
  ESQUEMA_RESPUESTA,
  repararJSON,
  validarRespuesta,
  instruccionesContrato,
  instruccionReparacion,
};
