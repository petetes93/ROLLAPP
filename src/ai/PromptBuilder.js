/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ai/PromptBuilder.js
 * ---------------------------------------------------------------------------
 * Construcción de prompts.
 *
 * Compone las instrucciones que recibe un modelo de lenguaje para actuar como
 * director de juego. Dos piezas:
 *
 *   · SISTEMA — quién es, qué puede y qué no. Largo, se envía una vez.
 *   · TURNO — la situación actual. Corto, cambia cada vez.
 *
 * Esa separación importa por coste: el prompt de sistema son unos cuatro mil
 * caracteres y no cambia. Reenviarlo cada turno multiplicaría el gasto sin
 * aportar nada en los proveedores que mantienen conversación.
 *
 * Principio de redacción: se le dice al modelo QUÉ NARRAR, nunca QUÉ DECIDIR.
 * Los dados ya están tirados cuando llega aquí. Un prompt que sugiera que el
 * modelo decide resultados produce narración que contradice al motor.
 *
 * Funciones puras.
 *
 * Dependencias: ai.config, ResponseSchema.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { DIRECTOR } from '../config/ai.config.js';
import { APP } from '../config/app.config.js';

/* ═══════════════════════════════════════════════════════════════════════════
   PROMPT DE SISTEMA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Construye el prompt de sistema.
 *
 * Se envía una sola vez por sesión en los proveedores conversacionales, y en
 * cada petición en los que no mantienen estado.
 *
 * @param {Object} [opciones]
 * @param {string} [opciones.tono] Registro narrativo.
 * @param {boolean} [opciones.incluirEsquema=true]
 * @returns {string}
 */
export function sistema(opciones = {}) {
  const partes = [];

  // ─── Identidad ──────────────────────────────────────────────────────────
  partes.push(
`Eres el director de juego de ARCANVEIL, un juego de rol narrativo de alta fantasía.
Narras en español de España, en segunda persona y en presente.`,
  );

  // ─── La regla que lo gobierna todo ──────────────────────────────────────
  partes.push(
`REGLA FUNDAMENTAL: el motor tira los dados; tú narras el resultado.
Cuando recibas una tirada resuelta, NARRA ESE RESULTADO. Si dice fracaso, el
personaje fracasa por muy bien que hubiera sonado el intento. Si dice éxito,
tiene éxito. No inviertas, matices ni reinterpretes lo que el motor decidió.
Nunca decidas si algo funciona: eso ya está decidido.`,
  );

  // ─── Interpretar al jugador ─────────────────────────────────────────────
  // Es el corazón del juego: no hay botones, hay una caja de texto libre.
  partes.push(
`LEE, ENTIENDE Y APLICA LO QUE ESCRIBE EL JUGADOR:
· No hay menú de acciones: el jugador escribe libremente lo que hace o dice.
  Lee su texto entero, entiende la intención y aplícala de forma lógica.
· Cada detalle que escribe cuenta: con qué, cómo, a quién, en qué orden. Si
  dice lo que su personaje dice, esas palabras se pronuncian y los demás
  reaccionan a ellas en concreto.
· Las consecuencias alcanzan a todo: a cada personaje presente (su actitud,
  lo que recuerda, lo que hace después), al entorno (lo que se rompe, se abre,
  se mueve, se oye) y a la situación general. El mundo responde.
· Libertad total para lo épico y lo original si está bien detallado y encaja
  con lo que el personaje sabe hacer. Premia la creatividad con escenas
  memorables.
· Pero nada imposible para su nivel: un personaje de nivel 1 no destruye el
  mundo, no mata a un ejército ni derrota a un dios. Si lo intenta, narra el
  intento con respeto y muestra el límite de forma dramática, dentro de la
  historia, nunca como un aviso técnico.
· Si el texto es ambiguo, elige la interpretación más razonable y sigue.`,
  );

  // ─── Estilo ─────────────────────────────────────────────────────────────
  partes.push(
`ESTILO:
· Prosa viva, concreta y sensorial. Detalles que se ven, se oyen o se huelen.
· De 120 a 260 palabras por turno, en dos o tres párrafos. Menos solo si la
  escena es de acción rápida. Nunca respuestas telegráficas.
· El jugador debe sentirse dentro: los personajes le miran, le hablan por su
  nombre, recuerdan lo que hizo. Diálogos con voz propia.
· Termina con la escena abierta, sin preguntar «¿qué haces?».
· Sin florituras ni adjetivación excesiva. Nada de «un escalofrío recorrió tu
  espina dorsal».
· El mundo es duro pero no cruel. Hay esperanza, y cuesta.
· Los personajes hablan como personas, no como oráculos.
· Nunca decidas por el personaje qué siente ni qué piensa. Narra lo que ocurre;
  las emociones las pone quien juega.`,
  );

  // ─── Prohibiciones ──────────────────────────────────────────────────────
  partes.push(
`NUNCA HAGAS ESTO:
· Matar al personaje fuera de un combate resuelto por el motor.
· Otorgar objetos legendarios sin que haya ocurrido algo importante.
· Contradecir una tirada.
· Resucitar a un personaje que murió.
· Cambiar el nivel o los atributos base del personaje.
· Narrar lo que el personaje decide hacer: eso lo escribe quien juega.
· Inventar información que el contexto declara que nadie tiene.`,
  );

  // ─── Formato ────────────────────────────────────────────────────────────
  if (opciones.incluirEsquema !== false) {
    partes.push(formatoRespuesta());
  }

  return partes.join('\n\n');
}

/**
 * Describe el formato JSON de respuesta.
 *
 * Se declara con un ejemplo completo además de la descripción: los modelos
 * siguen mejor un ejemplo que una especificación.
 *
 * @returns {string}
 */
export function formatoRespuesta() {
  return `RESPONDE SIEMPRE CON UN ÚNICO OBJETO JSON, sin texto antes ni después,
sin bloques de código, sin explicaciones.

Campos:
· story (obligatorio): la narración del turno.
· choices: EXACTAMENTE 3 sugerencias, cada una {label, intent, risk}. Son
  frases cortas (máximo 9 palabras) que encajan con lo que acaba de pasar:
  algo que el personaje podría decir o hacer ahora mismo, nombrando a quien
  o lo que está en escena. Nada genérico como «Explorar» o «Hablar».
  intent puede ser: ${DIRECTOR.intenciones.slice(0, 12).join(', ')}…
  risk puede ser: low, medium, high.
· playerUpdates: cambios en el personaje. Cada campo admite {delta: n}.
  Campos válidos: hp, mana, xp, gold, hunger, thirst, fatigue, morale, flags.
· newItems: objetos que encuentra, cada uno {nombre, categoria, rareza}.
· quests: operaciones sobre misiones, cada una {action, id, title, summary,
  objectives, reward}. action puede ser offer, accept, progress, complete, fail.
· npcs: personajes que aparecen, cada uno {refId, nombre, rol, actitud}.
· events: sucesos del mundo, cada uno {type, payload, silent}.
· combat: si empieza una pelea, {start: true, enemies: [{refId, count}]}.
· mood: el tono de la escena (tenso, tranquilo, sombrio, esperanzado, festivo…).
· pregunta: la pregunta de mesa que cierra el turno y devuelve la palabra al
  jugador. Breve. «¿Qué haces?» a secas, o con algo de la escena delante:
  «El herrero espera tu respuesta. ¿Qué haces?». No la repitas dentro de story.
· sceneBreak: true si cambia de escena por completo.
· memory: hechos que conviene recordar, como lista de cadenas.
· timeAdvance: minutos que pasan, si son más de los habituales.

Ejemplo mínimo válido:
{"story":"El herrero levanta la vista del yunque y te mide con los ojos.","choices":[{"label":"Preguntar por el encargo","intent":"talk","risk":"low"},{"label":"Ofrecerle el hierro","intent":"trade","risk":"low"}],"mood":"tranquilo","pregunta":"El herrero espera. ¿Qué haces?"}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROMPT DE TURNO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Construye el prompt de un turno.
 *
 * @param {Object} peticion
 * @param {string} peticion.accion Lo que escribió el jugador.
 * @param {Object} [peticion.intencion]
 * @param {Object} [peticion.tirada]
 * @param {string} peticion.contextoTexto Contexto ya compuesto.
 * @param {Object} [opciones]
 * @returns {string}
 */
export function turno(peticion, opciones = {}) {
  const partes = [];

  // ─── Contexto ───────────────────────────────────────────────────────────
  if (peticion.contextoTexto) partes.push(peticion.contextoTexto);

  // ─── La tirada, si la hay ───────────────────────────────────────────────
  // Va justo antes de la acción y con formato destacado, porque es lo que más
  // se ignora y lo que más importa.
  if (peticion.tirada) {
    partes.push(tirada(peticion.tirada));
  }

  // ─── La acción ──────────────────────────────────────────────────────────
  if (peticion.accion) {
    partes.push(`ACCIÓN DEL PERSONAJE: «${peticion.accion}»`);
  } else {
    partes.push('PRIMER TURNO: abre la crónica situando al personaje.');
  }

  // ─── Pista del enrutador ────────────────────────────────────────────────
  if (peticion.pistaRuta) {
    partes.push(`NOTA DEL MOTOR: ${peticion.pistaRuta}`);
  }

  // ─── Directriz de ritmo ─────────────────────────────────────────────────
  if (opciones.directriz) {
    partes.push(`RITMO: ${opciones.directriz}`);
  }

  // ─── Recordatorio final ─────────────────────────────────────────────────
  // El último mensaje pesa más en la atención del modelo: aquí va lo esencial.
  partes.push('Responde solo con el objeto JSON.');

  return partes.join('\n\n');
}

/**
 * Formatea una tirada resuelta para el prompt.
 *
 * El formato es deliberadamente rotundo: es la instrucción que un modelo
 * complaciente tiende a suavizar.
 *
 * @param {Object} t
 * @returns {string}
 */
export function tirada(t) {
  if (!t) return '';

  const partes = ['TIRADA YA RESUELTA POR EL MOTOR:'];

  const nombre = t.nombreHabilidad ?? t.habilidad ?? 'prueba';
  partes.push(`· Prueba de ${nombre}`);
  partes.push(`· Dado natural: ${t.natural}, total ${t.total} contra dificultad ${t.umbral}`);

  // El veredicto, en mayúsculas y sin ambigüedad.
  if (t.pifia) {
    partes.push('· RESULTADO: FRACASO GRAVE. Sale mal y además empeora la situación.');
  } else if (t.critico) {
    partes.push('· RESULTADO: ÉXITO ROTUNDO. Sale mejor de lo que cabía esperar.');
  } else if (t.exito) {
    const margen = t.margen ?? 0;
    partes.push(margen >= 5
      ? '· RESULTADO: ÉXITO CLARO.'
      : '· RESULTADO: ÉXITO JUSTO. Funciona, pero con dificultad o con algún coste.');
  } else {
    const margen = Math.abs(t.margen ?? 0);
    partes.push(margen <= 2
      ? '· RESULTADO: FRACASO POR POCO. Ha estado cerca.'
      : '· RESULTADO: FRACASO.');
  }

  // El desglose da material narrativo: saber que falló por la carga permite
  // mencionarlo.
  const relevantes = (t.desglose ?? [])
    .filter((m) => Math.abs(m.valor) >= 2)
    .map((m) => `${m.fuente} ${m.valor > 0 ? '+' : ''}${m.valor}`);

  if (relevantes.length) {
    partes.push(`· Pesó en la tirada: ${relevantes.join(', ')}`);
  }

  if (t.ventaja === 'ventaja') partes.push('· Tiró con ventaja.');
  if (t.ventaja === 'desventaja') partes.push('· Tiró con desventaja.');

  partes.push('NARRA ESTE RESULTADO. No lo cambies.');

  return partes.join('\n');
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROMPT DE RESUMEN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Prompt para resumir un tramo de la partida.
 *
 * Se usa cada cierto número de turnos para condensar la crónica y que el
 * contexto no crezca sin límite.
 *
 * @param {Array<Object>} turnos
 * @returns {string}
 */
export function resumen(turnos) {
  const lineas = (turnos ?? []).map((t) => {
    const accion = t.accion ? `> ${t.accion}` : '';
    const narracion = String(t.narracion ?? '').slice(0, 300);
    return `${accion}\n${narracion}`;
  });

  return `Resume en tres o cuatro frases lo esencial de este tramo de la crónica.

Conserva: decisiones importantes, personajes que aparecieron, promesas hechas,
lugares descubiertos y cambios en la situación del personaje.

Descarta: descripciones de ambiente, detalles sensoriales, acciones sin
consecuencia.

Escribe en pasado y en tercera persona. Responde solo con el resumen, sin
JSON ni comentarios.

TRAMO:
${lineas.join('\n\n')}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROMPT DE PUENTE MANUAL
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Prompt completo para copiar y pegar en un chat externo.
 *
 * El primero de la sesión lleva las instrucciones completas; los siguientes son
 * cortos, porque el chat externo ya las tiene en su contexto.
 *
 * @param {Object} peticion
 * @param {boolean} primero
 * @returns {string}
 */
export function paraPuente(peticion, primero) {
  if (primero) {
    return [
      sistema(),
      '─'.repeat(60),
      turno(peticion),
    ].join('\n\n');
  }

  // Los siguientes solo llevan la situación.
  return turno(peticion);
}

/* ═══════════════════════════════════════════════════════════════════════════
   UTILIDADES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Estima el coste en tokens de un texto.
 *
 * Aproximación grosera: unos cuatro caracteres por token en español. Sirve para
 * avisar de que un prompt se está pasando, no para facturar.
 *
 * @param {string} texto
 * @returns {number}
 */
export function estimarTokens(texto) {
  return Math.ceil(String(texto ?? '').length / 4);
}

/**
 * Recorta un prompt que excede el límite.
 *
 * Recorta por el principio del contexto, que es lo más antiguo y menos
 * relevante, conservando siempre la tirada y la acción del final.
 *
 * @param {string} prompt
 * @param {number} limiteCaracteres
 * @returns {{texto: string, recortado: boolean}}
 */
export function recortar(prompt, limiteCaracteres) {
  if (prompt.length <= limiteCaracteres) {
    return { texto: prompt, recortado: false };
  }

  // Se conservan los dos últimos bloques: la tirada y la acción.
  const bloques = prompt.split('\n\n');
  const cola = bloques.slice(-3).join('\n\n');

  const disponible = limiteCaracteres - cola.length - 40;

  if (disponible <= 0) {
    return { texto: cola, recortado: true };
  }

  const cabeza = bloques.slice(0, -3).join('\n\n').slice(-disponible);

  return {
    texto: `[…contexto anterior recortado…]\n\n${cabeza}\n\n${cola}`,
    recortado: true,
  };
}

export default {
  sistema,
  formatoRespuesta,
  turno,
  tirada,
  resumen,
  paraPuente,
  estimarTokens,
  recortar,
};
