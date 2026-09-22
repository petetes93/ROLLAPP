/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ai/ResponseParser.js
 * ---------------------------------------------------------------------------
 * Análisis de las respuestas del director.
 *
 * Los modelos de lenguaje no siempre devuelven lo que se les pide. Envuelven el
 * JSON en bloques de código, añaden explicaciones antes, ponen comas de más o
 * directamente responden en prosa.
 *
 * Este módulo aplica TRES NIVELES DE RESCATE, de más fiel a más desesperado:
 *
 *   1. JSON LIMPIO — se extrae y se analiza. Lo habitual.
 *   2. EXTRACCIÓN PARCIAL — el JSON está roto, pero se recuperan campos sueltos
 *      con expresiones regulares.
 *   3. RESCATE DE PROSA — no hay JSON. Se toma el texto como narración y se
 *      infieren opciones.
 *
 * El tercer nivel importa más de lo que parece: un modelo que responde en prosa
 * ha escrito narración perfectamente utilizable. Descartarla por no venir en el
 * formato pedido sería tirar un turno bueno.
 *
 * Funciones puras.
 *
 * Dependencias: ai.config, ResponseSchema.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { DIRECTOR } from '../config/ai.config.js';
import { validarRespuesta } from './ResponseSchema.js';

/** Niveles de rescate aplicados. */
export const NIVEL = Object.freeze({
  LIMPIO: 'limpio',
  REPARADO: 'reparado',
  PARCIAL: 'parcial',
  PROSA: 'prosa',
  FALLIDO: 'fallido',
});

/* ═══════════════════════════════════════════════════════════════════════════
   RESPUESTA MÍNIMA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Construye una respuesta válida a partir de solo una narración.
 *
 * Es la base de todos los niveles de rescate: cualquier texto utilizable se
 * convierte en un turno jugable con opciones genéricas.
 *
 * @param {string} story
 * @returns {Object}
 */
function respuestaMinima(story) {
  return {
    story: String(story ?? '').slice(0, DIRECTOR.narracion?.max ?? 2000),
    choices: [
      { label: 'Continuar', intent: 'explore', risk: 'low' },
      { label: 'Mirar alrededor', intent: 'observe', risk: 'low' },
    ],
    playerUpdates: {},
    newItems: [],
    quests: [],
    npcs: [],
    events: [],
    memory: [],
    mood: 'neutro',
    sceneBreak: false,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   ANÁLISIS PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Analiza la respuesta cruda de un proveedor.
 *
 * @param {string} crudo
 * @param {Object} [contexto] Para el rescate de prosa.
 * @returns {{
 *   exito: boolean, respuesta: Object|null, nivel: string,
 *   avisos: string[], error: string|null
 * }}
 */
export function analizar(crudo, contexto = {}) {
  const avisos = [];

  if (!crudo || typeof crudo !== 'string') {
    return {
      exito: false, respuesta: null, nivel: NIVEL.FALLIDO,
      avisos, error: 'respuesta vacía',
    };
  }

  const texto = crudo.trim();

  // ─── Nivel 1: JSON limpio ───────────────────────────────────────────────
  const extraido = extraerJSON(texto);

  if (extraido.encontrado) {
    const analisis = _intentarAnalizar(extraido.json);

    if (analisis.objeto) {
      const validacion = validarRespuesta(analisis.objeto);

      if (validacion.valida) {
        if (extraido.envuelto) avisos.push('el JSON venía envuelto en un bloque de código');
        if (analisis.reparado) avisos.push('se reparó el JSON antes de analizarlo');

        return {
          exito: true,
          respuesta: validacion.respuesta,
          nivel: analisis.reparado ? NIVEL.REPARADO : NIVEL.LIMPIO,
          avisos: [...avisos, ...validacion.avisos],
          error: null,
        };
      }

      // El JSON es válido pero la respuesta no cumple el esquema: se intenta
      // reparar campo a campo antes de rendirse.
      avisos.push(...validacion.fallos);

      const reparada = _repararRespuesta(analisis.objeto, contexto);

      if (reparada) {
        return {
          exito: true, respuesta: reparada, nivel: NIVEL.PARCIAL,
          avisos: [...avisos, 'respuesta incompleta: se completaron campos'],
          error: null,
        };
      }
    }
  }

  // ─── Nivel 2: extracción parcial ────────────────────────────────────────
  const parcial = extraerCampos(texto);

  if (parcial.story) {
    return {
      exito: true,
      respuesta: _componerDesdeCampos(parcial, contexto),
      nivel: NIVEL.PARCIAL,
      avisos: [...avisos, 'JSON irrecuperable: se extrajeron campos sueltos'],
      error: null,
    };
  }

  // ─── Nivel 3: rescate de prosa ──────────────────────────────────────────
  const prosa = rescatarProsa(texto, contexto);

  if (prosa) {
    return {
      exito: true, respuesta: prosa, nivel: NIVEL.PROSA,
      avisos: [...avisos, 'el modelo respondió en prosa: se usó como narración'],
      error: null,
    };
  }

  return {
    exito: false, respuesta: null, nivel: NIVEL.FALLIDO,
    avisos, error: 'no se pudo extraer nada utilizable',
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXTRACCIÓN DE JSON
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Extrae el objeto JSON de un texto.
 *
 * Contempla las tres formas habituales: JSON puro, envuelto en bloque de código
 * y precedido de explicaciones.
 *
 * @param {string} texto
 * @returns {{encontrado: boolean, json: string, envuelto: boolean}}
 */
export function extraerJSON(texto) {
  // ─── Bloque de código ───────────────────────────────────────────────────
  const bloque = texto.match(/```(?:json)?\s*([\s\S]*?)```/);

  if (bloque?.[1]) {
    return { encontrado: true, json: bloque[1].trim(), envuelto: true };
  }

  // ─── Objeto completo ────────────────────────────────────────────────────
  // Se busca desde la primera llave hasta su cierre equilibrado, para no
  // cortar en una llave anidada.
  const inicio = texto.indexOf('{');
  if (inicio === -1) return { encontrado: false, json: '', envuelto: false };

  let profundidad = 0;
  let enCadena = false;
  let escapado = false;

  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i];

    if (escapado) { escapado = false; continue; }
    if (c === '\\') { escapado = true; continue; }

    if (c === '"') { enCadena = !enCadena; continue; }
    if (enCadena) continue;

    if (c === '{') profundidad++;
    else if (c === '}') {
      profundidad--;

      if (profundidad === 0) {
        return {
          encontrado: true,
          json: texto.slice(inicio, i + 1),
          envuelto: false,
        };
      }
    }
  }

  // Llaves sin cerrar: se devuelve lo que hay para que el reparador lo intente.
  return { encontrado: true, json: texto.slice(inicio), envuelto: false };
}

/**
 * Intenta analizar un JSON, reparándolo si hace falta.
 *
 * @param {string} json
 * @returns {{objeto: Object|null, reparado: boolean}}
 * @private
 */
function _intentarAnalizar(json) {
  // ─── Directo ────────────────────────────────────────────────────────────
  try {
    return { objeto: JSON.parse(json), reparado: false };
  } catch {
    // Se sigue con la reparación.
  }

  // ─── Reparado ───────────────────────────────────────────────────────────
  const reparado = _repararTexto(json);

  try {
    return { objeto: JSON.parse(reparado), reparado: true };
  } catch {
    return { objeto: null, reparado: false };
  }
}

/**
 * Repara los errores de JSON más habituales de los modelos.
 *
 * @param {string} json
 * @returns {string}
 */
function _repararTexto(json) {
  let t = json.trim();

  // Comas finales antes de cierre: {"a": 1,} → {"a": 1}
  t = t.replace(/,(\s*[}\]])/g, '$1');

  // Comillas simples como delimitador de cadena.
  t = t.replace(/'([^']*)':/g, '"$1":');

  // Claves sin comillas: {story: "…"} → {"story": "…"}
  t = t.replace(/([{,]\s*)([a-zA-Z_$][\w$]*)\s*:/g, '$1"$2":');

  // Saltos de línea sin escapar dentro de cadenas.
  t = t.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match) =>
    match.replace(/\n/g, '\\n').replace(/\r/g, ''));

  // Llaves y corchetes sin cerrar: se cierran contando.
  const abiertas = (t.match(/\{/g) ?? []).length - (t.match(/\}/g) ?? []).length;
  const corchetes = (t.match(/\[/g) ?? []).length - (t.match(/\]/g) ?? []).length;

  if (corchetes > 0) t += ']'.repeat(corchetes);
  if (abiertas > 0) t += '}'.repeat(abiertas);

  return t;
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXTRACCIÓN DE CAMPOS SUELTOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Extrae campos individuales de un JSON irrecuperable.
 *
 * Cuando la estructura está rota pero los campos siguen ahí, se recuperan con
 * expresiones regulares. Es feo, pero salva turnos.
 *
 * @param {string} texto
 * @returns {Object}
 */
export function extraerCampos(texto) {
  const salida = {};

  // ─── story ──────────────────────────────────────────────────────────────
  // La narración puede ser larga y contener comillas escapadas.
  const story = texto.match(/"story"\s*:\s*"((?:[^"\\]|\\.)*)"/);

  if (story?.[1]) {
    salida.story = story[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  // ─── mood ───────────────────────────────────────────────────────────────
  const mood = texto.match(/"mood"\s*:\s*"([^"]*)"/);
  if (mood?.[1]) salida.mood = mood[1];

  // ─── choices ────────────────────────────────────────────────────────────
  const choices = [];
  const patronOpcion = /"label"\s*:\s*"([^"]*)"(?:[^}]*?"intent"\s*:\s*"([^"]*)")?(?:[^}]*?"risk"\s*:\s*"([^"]*)")?/g;

  let m;
  while ((m = patronOpcion.exec(texto)) !== null && choices.length < 4) {
    choices.push({
      label: m[1],
      intent: m[2] ?? 'custom',
      risk: m[3] ?? 'medium',
    });
  }

  if (choices.length) salida.choices = choices;

  // ─── playerUpdates ──────────────────────────────────────────────────────
  const updates = {};

  for (const campo of ['hp', 'mana', 'xp', 'gold', 'hunger', 'thirst', 'fatigue', 'morale']) {
    const patron = new RegExp(`"${campo}"\\s*:\\s*\\{?\\s*(?:"delta"\\s*:\\s*)?(-?\\d+)`);
    const encontrado = texto.match(patron);

    if (encontrado) updates[campo] = { delta: parseInt(encontrado[1], 10) };
  }

  if (Object.keys(updates).length) salida.playerUpdates = updates;

  // ─── sceneBreak ─────────────────────────────────────────────────────────
  if (/"sceneBreak"\s*:\s*true/.test(texto)) salida.sceneBreak = true;

  // ─── combat ─────────────────────────────────────────────────────────────
  if (/"combat"\s*:\s*\{[^}]*"start"\s*:\s*true/.test(texto)) {
    const enemigos = [];
    const patronEnemigo = /"refId"\s*:\s*"([^"]*)"(?:[^}]*?"count"\s*:\s*(\d+))?/g;

    let e;
    while ((e = patronEnemigo.exec(texto)) !== null && enemigos.length < 6) {
      enemigos.push({ refId: e[1], count: e[2] ? parseInt(e[2], 10) : 1 });
    }

    if (enemigos.length) salida.combat = { start: true, enemies: enemigos };
  }

  return salida;
}

/**
 * Compone una respuesta válida a partir de campos sueltos.
 * @private
 */
function _componerDesdeCampos(campos, contexto) {
  const base = respuestaMinima(campos.story);

  return {
    ...base,
    ...campos,
    choices: campos.choices?.length ? campos.choices : base.choices,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESCATE DE PROSA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Convierte una respuesta en prosa en una respuesta válida.
 *
 * Un modelo que responde en prosa ha escrito narración perfectamente
 * utilizable. Descartarla por venir sin formato sería tirar un turno bueno.
 *
 * @param {string} texto
 * @param {Object} [contexto]
 * @returns {Object|null}
 */
export function rescatarProsa(texto, contexto = {}) {
  const limpio = _limpiarProsa(texto);

  // Demasiado corto para ser narración: probablemente sea un error del modelo.
  if (limpio.length < 40) return null;

  // Demasiado parecido a un mensaje de error.
  if (/^(lo siento|no puedo|as an ai|i cannot|error)/i.test(limpio)) return null;

  const respuesta = respuestaMinima(limpio);

  // ─── Inferencia de tono ─────────────────────────────────────────────────
  respuesta.mood = _inferirMood(limpio);

  // ─── Inferencia de opciones ─────────────────────────────────────────────
  const opciones = _inferirOpciones(limpio, contexto);
  if (opciones.length) respuesta.choices = opciones;

  return respuesta;
}

/**
 * Limpia la prosa de restos de formato.
 * @private
 */
function _limpiarProsa(texto) {
  return texto
    // Bloques de código vacíos o rotos.
    .replace(/```[a-z]*\n?/g, '')
    // Preámbulos habituales.
    .replace(/^(aquí (tienes|está)|claro|por supuesto|vale)[,:.]?\s*/i, '')
    // Encabezados de markdown.
    .replace(/^#+\s*/gm, '')
    // Restos de JSON al principio.
    .replace(/^\s*\{[\s\S]*?"story"\s*:\s*"?/i, '')
    .trim();
}

/**
 * Deduce el tono de la escena a partir del vocabulario.
 * @private
 */
function _inferirMood(texto) {
  const t = texto.toLowerCase();

  const marcadores = [
    [/sangre|grito|muerte|cadáver|dolor|herida/, 'sombrio'],
    [/peligro|amenaza|acecha|tensión|arma|cuidado/, 'tenso'],
    [/risa|música|fiesta|celebra|brind/, 'festivo'],
    [/misterio|extraño|inexplicable|susurro|antiguo/, 'misterioso'],
    [/calma|tranquil|paz|descans|silencio/, 'tranquilo'],
    [/esperanza|alivio|por fin|logra/, 'esperanzado'],
  ];

  for (const [patron, mood] of marcadores) {
    if (patron.test(t)) return mood;
  }

  return 'neutro';
}

/**
 * Infiere opciones plausibles a partir de la narración.
 *
 * No pretende adivinar lo que el modelo habría propuesto: solo ofrecer algo
 * razonable para que el jugador no se quede sin sugerencias.
 *
 * @private
 */
function _inferirOpciones(texto, contexto) {
  const t = texto.toLowerCase();
  const opciones = [];

  // Hay alguien delante.
  if (/\b(dice|pregunta|responde|habla|te mira|se acerca|saluda)\b/.test(t)) {
    opciones.push({ label: 'Responder', intent: 'talk', risk: 'low' });
  }

  // Hay algo que examinar.
  if (/\b(ves|encuentras|hay|aparece|brilla|asoma)\b/.test(t)) {
    opciones.push({ label: 'Examinarlo de cerca', intent: 'observe', risk: 'low' });
  }

  // Hay amenaza.
  if (/\b(amenaza|arma|hostil|gruñe|ataca|peligro)\b/.test(t)) {
    opciones.push({ label: 'Prepararte', intent: 'wait', risk: 'medium' });
    opciones.push({ label: 'Retroceder', intent: 'flee', risk: 'medium' });
  }

  // Hay camino.
  if (/\b(camino|sendero|puerta|pasillo|entrada|salida)\b/.test(t)) {
    opciones.push({ label: 'Seguir adelante', intent: 'explore', risk: 'low' });
  }

  // Siempre queda mirar.
  if (opciones.length < 2) {
    opciones.push({ label: 'Mirar alrededor', intent: 'observe', risk: 'low' });
    opciones.push({ label: 'Continuar', intent: 'explore', risk: 'low' });
  }

  return opciones.slice(0, 4);
}

/* ═══════════════════════════════════════════════════════════════════════════
   REPARACIÓN DE RESPUESTA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Completa una respuesta que falló la validación.
 *
 * @param {Object} objeto
 * @param {Object} contexto
 * @returns {Object|null}
 * @private
 */
function _repararRespuesta(objeto, contexto) {
  // Sin narración no hay nada que salvar.
  const story = objeto.story ?? objeto.narracion ?? objeto.text ?? objeto.narrative;

  if (!story || typeof story !== 'string' || story.length < 20) return null;

  const base = respuestaMinima(story);

  // Se conservan los campos que sí sean válidos.
  const salida = { ...base };

  if (Array.isArray(objeto.choices) && objeto.choices.length) {
    salida.choices = objeto.choices
      .filter((c) => c?.label)
      .slice(0, DIRECTOR.opciones.max)
      .map((c) => ({
        label: String(c.label).slice(0, 60),
        intent: c.intent ?? 'custom',
        risk: ['low', 'medium', 'high'].includes(c.risk) ? c.risk : 'medium',
      }));
  }

  if (objeto.playerUpdates && typeof objeto.playerUpdates === 'object') {
    salida.playerUpdates = objeto.playerUpdates;
  }

  if (Array.isArray(objeto.newItems)) salida.newItems = objeto.newItems.slice(0, 3);
  if (Array.isArray(objeto.npcs)) salida.npcs = objeto.npcs.slice(0, 5);
  if (Array.isArray(objeto.events)) salida.events = objeto.events.slice(0, 8);
  if (Array.isArray(objeto.quests)) salida.quests = objeto.quests.slice(0, 3);
  if (Array.isArray(objeto.memory)) salida.memory = objeto.memory.slice(0, 5);

  if (typeof objeto.mood === 'string') salida.mood = objeto.mood;
  if (objeto.sceneBreak === true) salida.sceneBreak = true;
  if (objeto.combat?.start) salida.combat = objeto.combat;
  if (typeof objeto.timeAdvance === 'number') salida.timeAdvance = objeto.timeAdvance;

  return salida;
}

/* ═══════════════════════════════════════════════════════════════════════════
   DIAGNÓSTICO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Explica por qué falló un análisis, para el panel del puente.
 *
 * El mensaje debe ser accionable: decir «error de sintaxis» no ayuda a nadie.
 *
 * @param {string} crudo
 * @returns {string}
 */
export function diagnosticar(crudo) {
  if (!crudo?.trim()) return 'No hay nada que pegar.';

  const texto = crudo.trim();

  if (!texto.includes('{')) {
    return 'No parece JSON: no hay ninguna llave de apertura. ¿Has copiado la respuesta entera?';
  }

  const extraido = extraerJSON(texto);

  try {
    JSON.parse(extraido.json);
    return 'El JSON es válido pero le falta el campo "story", que es obligatorio.';
  } catch (e) {
    const mensaje = String(e.message ?? '');

    if (/Unexpected end/.test(mensaje)) {
      return 'El JSON está incompleto: parece que falta el final. ¿Se cortó al copiar?';
    }

    if (/position (\d+)/.test(mensaje)) {
      const pos = mensaje.match(/position (\d+)/)[1];
      const fragmento = extraido.json.slice(Math.max(0, pos - 30), Number(pos) + 30);
      return `Hay un error de formato cerca de: «…${fragmento}…»`;
    }

    return `El JSON tiene un error de formato: ${mensaje}`;
  }
}

export default {
  NIVEL,
  analizar,
  extraerJSON,
  extraerCampos,
  rescatarProsa,
  diagnosticar,
};
