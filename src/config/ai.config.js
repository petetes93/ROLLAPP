/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · config/ai.config.js
 * ---------------------------------------------------------------------------
 * Configuración del director de juego: proveedores disponibles, personalidad,
 * presupuesto de contexto, política de credenciales y contrato de respuesta.
 *
 * POLÍTICA DE CREDENCIALES (decisión de proyecto, no negociable en código):
 *   Ninguna clave de API se escribe jamás en LocalStorage, sessionStorage,
 *   cookies, IndexedDB ni en la URL. Vive en una variable de módulo dentro de
 *   RemoteAPIProvider y desaparece al recargar la pestaña. Este archivo lo
 *   declara y SaveManager lo verifica.
 *
 * Como los otros config, NO importa nada.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * @template T
 * @param {T} obj
 * @returns {Readonly<T>}
 */
function congelar(obj) {
  if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) return obj;
  for (const clave of Object.getOwnPropertyNames(obj)) congelar(obj[clave]);
  return Object.freeze(obj);
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. PROVEEDORES
   ---------------------------------------------------------------------------
   Cuatro implementaciones tras la misma interfaz IDMProvider. El jugador elige
   en Ajustes; el motor no distingue entre ellas.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Identificadores canónicos de proveedor. */
export const PROVEEDORES = congelar({
  PROCEDURAL: 'procedural',
  PUENTE: 'puente',
  LOCAL: 'local',
  REMOTO: 'remoto',
});

/** Proveedor activo al arrancar por primera vez. */
export const PROVEEDOR_DEFECTO = PROVEEDORES.PROCEDURAL;

/**
 * Metadatos de cada proveedor. SettingsScreen construye su interfaz a partir
 * de este objeto, así que añadir un proveedor nuevo no requiere tocar la UI.
 */
export const CATALOGO_PROVEEDORES = congelar({

  [PROVEEDORES.PROCEDURAL]: {
    nombre: 'Director procedural',
    resumen: 'Motor narrativo interno. Sin IA, sin red, sin claves.',
    detalle:
      'Compone la narración con gramáticas, tablas de encuentros y plantillas. ' +
      'Las partidas son coherentes y jugables, aunque menos sorprendentes que con un modelo de lenguaje. ' +
      'Es también el modo de respaldo: si cualquier otro proveedor falla, el motor cae aquí sin interrumpir la partida.',
    requiereRed: false,
    requiereClave: false,
    esRespaldo: true,
    /** Latencia simulada para que la narración no aparezca de golpe. */
    latenciaSimulada: [180, 520],
  },

  [PROVEEDORES.PUENTE]: {
    nombre: 'Puente manual de chat',
    resumen: 'Tú copias el prompt a tu asistente y pegas aquí el JSON.',
    detalle:
      'El motor genera el prompt completo y lo copia al portapapeles. Lo pegas en la conversación ' +
      'con tu asistente de IA, y el JSON que devuelva lo pegas de vuelta en el juego. ' +
      'Es el modo con mejor calidad narrativa sin instalar nada, sin conexión desde la app y sin guardar credenciales.',
    requiereRed: false,
    requiereClave: false,
    esRespaldo: false,
    /** Espera indefinida: el turno se completa cuando el jugador pega la respuesta. */
    sinTimeout: true,
  },

  [PROVEEDORES.LOCAL]: {
    nombre: 'Modelo local',
    resumen: 'Endpoint compatible con OpenAI en tu propia máquina.',
    detalle:
      'Apunta a un servidor de inferencia que ya tengas funcionando en tu equipo. ' +
      'Nada sale de tu red. No requiere clave, aunque admite una si tu servidor la exige.',
    requiereRed: false,
    requiereClave: false,
    esRespaldo: false,
    /** URL de ejemplo mostrada como marcador en Ajustes. */
    urlEjemplo: 'http://localhost:11434/v1/chat/completions',
    modeloEjemplo: 'llama3.1:8b-instruct',
  },

  [PROVEEDORES.REMOTO]: {
    nombre: 'API remota',
    resumen: 'Servicio externo. La clave vive sólo en memoria.',
    detalle:
      'Envía cada turno a un proveedor de modelos por HTTPS. La clave que introduzcas ' +
      'no se guarda en ningún sitio: se pierde al recargar la página y hay que volver a escribirla.',
    requiereRed: true,
    requiereClave: true,
    esRespaldo: false,
    urlEjemplo: 'https://api.ejemplo.com/v1/chat/completions',
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   2. CREDENCIALES
   ═══════════════════════════════════════════════════════════════════════════ */

export const CREDENCIALES = congelar({
  /** Prohibición explícita, verificada por SaveManager antes de serializar. */
  permitirPersistencia: false,

  /** Almacenes vetados. Ningún módulo puede escribir la clave en ninguno. */
  almacenesProhibidos: ['localStorage', 'sessionStorage', 'indexedDB', 'cookie', 'url'],

  /** Minutos de inactividad tras los cuales la clave en memoria se borra sola. */
  caducidadMinutos: 120,

  /** Texto mostrado junto al campo de clave en Ajustes. */
  aviso:
    'La clave se mantiene únicamente en la memoria de esta pestaña. ' +
    'Al recargar o cerrar el navegador desaparece y tendrás que introducirla de nuevo.',
});

/* ═══════════════════════════════════════════════════════════════════════════
   3. PARÁMETROS DE MUESTREO
   ═══════════════════════════════════════════════════════════════════════════ */

export const MUESTREO = congelar({
  /** Creatividad. Alta para narrar, baja para respetar el esquema. */
  temperatura: 0.85,

  /** Núcleo de probabilidad. */
  topP: 0.92,

  /** Tokens máximos de la respuesta. Un turno completo cabe holgado en 1400. */
  maxTokens: 1600,

  /** Penalización a la repetición literal de frases. */
  penalizacionRepeticion: 1.06,

  /** Secuencias que cortan la generación. Vacío: el JSON debe cerrarse solo. */
  secuenciasParada: [],

  /**
   * Ajustes por situación. TurnResolver los mezcla con los valores base según
   * el tipo de turno, porque narrar una taberna y resolver una ronda de
   * combate no piden la misma creatividad.
   */
  perfiles: {
    narracion: { temperatura: 0.9, maxTokens: 1600 },
    combate: { temperatura: 0.6, maxTokens: 1000 },
    dialogo: { temperatura: 0.88, maxTokens: 1200 },
    comercio: { temperatura: 0.5, maxTokens: 800 },
    resumen: { temperatura: 0.3, maxTokens: 600 },
    reparacion: { temperatura: 0.1, maxTokens: 1600 },
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   4. PRESUPUESTO DE CONTEXTO
   ---------------------------------------------------------------------------
   Un modelo local pequeño no admite un contexto enorme. ContextComposer poda
   siguiendo estas prioridades: lo primero que se sacrifica es lo último de la
   lista.
   ═══════════════════════════════════════════════════════════════════════════ */

export const CONTEXTO = congelar({
  /** Presupuesto total aproximado, en caracteres (≈ 4 caracteres por token). */
  presupuestoCaracteres: 14_000,

  /** Reparto del presupuesto por sección (fracciones que suman ≈1). */
  reparto: {
    instrucciones: 0.22,
    fichaPersonaje: 0.10,
    situacionActual: 0.12,
    turnosRecientes: 0.26,
    memoriaLargoPlazo: 0.14,
    misionesActivas: 0.07,
    npcsPresentes: 0.05,
    inventarioRelevante: 0.04,
  },

  /**
   * Orden de sacrificio al desbordar el presupuesto. Se poda de arriba abajo.
   * Las instrucciones y la ficha nunca se podan: son el suelo del sistema.
   */
  ordenPoda: [
    'inventarioRelevante',
    'npcsPresentes',
    'misionesActivas',
    'memoriaLargoPlazo',
    'turnosRecientes',
  ],

  /** Turnos recientes incluidos íntegros antes de empezar a resumir. */
  turnosIntegros: 6,

  /** Turnos anteriores incluidos ya resumidos en una línea. */
  turnosResumidos: 14,

  /**
   * Cada cuántos turnos se genera un resumen de capítulo que sustituye al
   * historial antiguo. Es la memoria a largo plazo comprimida.
   */
  intervaloResumen: 20,

  /** Longitud máxima de un resumen de capítulo, en caracteres. */
  resumenMax: 700,

  /** Hechos permanentes recordados al director en cada turno. */
  hechosMax: 30,

  /** Inventario: sólo se envían los objetos equipados más los N más valiosos. */
  objetosRelevantes: 8,
});

/* ═══════════════════════════════════════════════════════════════════════════
   5. PERSONALIDAD DEL DIRECTOR
   ---------------------------------------------------------------------------
   PromptBuilder ensambla estas piezas. Están aquí como datos, no dentro del
   constructor de prompts, para poder afinar el tono sin tocar la lógica.
   ═══════════════════════════════════════════════════════════════════════════ */

export const DIRECTOR = congelar({
  /** Rol declarado al modelo. */
  rol:
    'Eres el director de juego de una partida de rol narrativo de alta fantasía clásica. ' +
    'Diriges para un único jugador que encarna a un solo personaje.',

  /** Principios de dirección, en orden de importancia. */
  principios: [
    'Narra en segunda persona y en presente. El protagonista es el jugador.',
    'Nunca decides las acciones del personaje del jugador ni sus emociones: describes el mundo y sus reacciones.',
    'No pongas en boca del personaje palabras, aceptaciones, promesas ni movimientos que el jugador no haya escrito. Si delega en un compañero («que ella negocie; yo observo»), actúa el compañero y el personaje solo observa.',
    'Lo que escribe el jugador es lo que INTENTA; el resultado lo da el motor. «Lo mato» es una intención, no un hecho. Si su texto encadena varias cosas o una condición («si miente, me voy»), resuelve solo lo que cabe en este turno y deja lo demás pendiente.',
    'Nunca resuelves tú si una acción tiene éxito. El motor ya ha tirado los dados y te entrega el resultado; tú narras esa consecuencia.',
    'El pasado del personaje es canon, no guion: no lo contradigas, pero no lo conviertas en misión ni lo traigas a escena por tu cuenta. Vuelve cuando el jugador lo busca o el mundo lo roza de verdad.',
    'Las misiones nacen de lo que pasa en el mundo y de lo que el jugador acepta o se propone. Un rumor no es un encargo; un encargo rechazado no se repite solo.',
    'Lo que el jugador ignora sigue ahí, con sus propios motivos. No le castigues por no seguir la pista que tú preferías; si algo cambia por su omisión, que sea porque había una causa y un plazo.',
    'Un conflicto puede acabar en conversación, trato, huida o pelea según lo que haga el jugador. No toda amenaza es combate, y no todo combate acaba en muerte.',
    'El mundo existe con independencia del jugador: los personajes tienen intereses propios y actúan aunque él no esté.',
    'Toda elección deja rastro. Recuerda lo prometido, lo robado y lo traicionado, y haz que vuelva.',
    'Prefiere la consecuencia concreta al adjetivo. Un guardia que recuerda tu nombre vale más que una descripción grandilocuente.',
    'Deja hilos sueltos y misterios sin resolver; no expliques todo lo que muestras.',
    'Ofrece siempre al menos un camino que no pase por la violencia.',
    'No repitas estructuras ni fórmulas entre turnos.',
  ],

  /** Restricciones duras de contenido y de forma. */
  restricciones: [
    'Responde ÚNICAMENTE con un objeto JSON válido. Sin texto antes, sin texto después, sin bloques de código.',
    'No inventes nombres, criaturas, hechizos ni topónimos procedentes de obras publicadas con derechos de autor. Todo el contenido debe ser original.',
    'No modifiques nunca los atributos base, el nivel ni la clase del personaje: eso corresponde al motor.',
    'No mates al personaje del jugador fuera de un combate resuelto por el motor.',
    'Los cambios que propongas son deltas modestos; el motor recortará cualquier exceso.',
    'Mantén el tono de alta fantasía clásica: heroísmo, orden y caos, magia con reglas, ruinas de una edad anterior.',
    'Evita la crudeza gratuita. La violencia es consecuencia, no espectáculo.',
  ],

  /** Extensión objetivo de la narración por turno, en palabras. */
  longitudNarracion: { min: 90, objetivo: 190, max: 360 },

  /** Extensión en combate: más corta y más seca. */
  longitudCombate: { min: 30, objetivo: 70, max: 150 },

  /** Número de opciones sugeridas por turno. */
  /** Cotas de longitud de la narración, en caracteres. */
  narracion: { min: 40, max: 2400 },

  opciones: { min: 3, objetivo: 3, max: 6 },

  /**
   * Verbos canónicos de acción. El director debe mapear cada opción a uno de
   * ellos en el campo `intent`, para que ActionRouter sepa qué sistema invocar.
   */
  intenciones: [
    'attack', 'talk', 'explore', 'open', 'hide', 'negotiate',
    'use_item', 'flee', 'rest', 'travel', 'search', 'persuade',
    'intimidate', 'deceive', 'observe', 'cast', 'trade', 'wait', 'custom',
  ],

  /** Etiquetas sugeridas por defecto cuando el director no propone ninguna. */
  opcionesRespaldo: [
    { id: 'f1', label: 'Observar con calma', intent: 'observe', risk: 'low' },
    { id: 'f2', label: 'Avanzar con cautela', intent: 'explore', risk: 'medium' },
    { id: 'f3', label: 'Retroceder', intent: 'flee', risk: 'low' },
  ],
});

/* ═══════════════════════════════════════════════════════════════════════════
   6. CONTRATO DE RESPUESTA
   ---------------------------------------------------------------------------
   Descripción legible del JSON que se le exige al director. ResponseSchema.js
   contiene la validación formal; esto es lo que se le enseña al modelo.
   ═══════════════════════════════════════════════════════════════════════════ */

export const CONTRATO = congelar({
  /** Claves obligatorias en toda respuesta. */
  clavesObligatorias: ['story', 'choices', 'playerUpdates', 'newItems', 'quests', 'combat', 'events'],

  /** Claves opcionales aceptadas. */
  clavesOpcionales: ['schemaVersion', 'memory', 'mood', 'sceneBreak', 'npcs', 'location', 'timeAdvance'],

  /**
   * Ejemplo canónico incluido en el prompt. Vale más que cualquier descripción:
   * los modelos imitan la forma antes que la instrucción.
   */
  ejemplo: {
    schemaVersion: 1,
    story:
      'La puerta de la posada se cierra a tu espalda y el rumor de la sala cae un instante. ' +
      'Junto al hogar, una mujer de manos encallecidas levanta la vista del mapa que estaba doblando, ' +
      'y no la vuelve a bajar. Huele a cebada quemada y a lana mojada.',
    choices: [
      { id: 'c1', label: 'Acercarte a la mujer del mapa', intent: 'talk', risk: 'low' },
      { id: 'c2', label: 'Pedir cama y guardar silencio', intent: 'rest', risk: 'low' },
      { id: 'c3', label: 'Escuchar a los parroquianos', intent: 'observe', risk: 'low' },
      { id: 'c4', label: 'Salir por donde has venido', intent: 'flee', risk: 'medium' },
    ],
    playerUpdates: {
      fatigue: { delta: -4 },
      flags: { conoce_posada_del_yunque: true },
    },
    newItems: [],
    quests: [],
    combat: {},
    events: [
      { type: 'npc_meet', payload: { ref: 'cartografa_desconocida', attitude: 'cauta' }, silent: false },
    ],
    memory: ['El jugador entró en la Posada del Yunque de noche y fue observado por una cartógrafa.'],
    mood: 'intriga',
  },

  /** Instrucción de reparación enviada cuando el JSON llega malformado. */
  instruccionReparacion:
    'Tu respuesta anterior no era JSON válido. Devuelve exclusivamente el objeto JSON corregido, ' +
    'sin explicaciones, sin comentarios y sin envolverlo en un bloque de código.',
});

/* ═══════════════════════════════════════════════════════════════════════════
   7. RED, REINTENTOS Y RESPALDO
   ═══════════════════════════════════════════════════════════════════════════ */

export const RED = congelar({
  /** Tiempo máximo de espera de una respuesta, en milisegundos. */
  timeout: 90_000,

  /** Reintentos ante fallo de red o respuesta vacía. */
  reintentos: 2,

  /** Espera base entre reintentos; crece exponencialmente. */
  esperaBase: 900,

  /** Factor de crecimiento de la espera. */
  factorEspera: 2.2,

  /** Máximo de peticiones simultáneas. Un turno es un turno: nunca más de una. */
  concurrencia: 1,

  /**
   * Tras este número de fallos consecutivos, el motor cambia al proveedor de
   * respaldo y avisa al jugador con un toast.
   */
  fallosParaRespaldo: 3,

  /** Proveedor al que se cae cuando el activo falla. */
  proveedorRespaldo: PROVEEDORES.PROCEDURAL,

  /** Códigos HTTP que no merecen reintento (error del cliente, no del enlace). */
  sinReintento: [400, 401, 403, 404, 422],
});

/* ═══════════════════════════════════════════════════════════════════════════
   8. MENSAJES DE ESPERA
   Se muestran bajo la narración mientras el director compone el turno.
   ═══════════════════════════════════════════════════════════════════════════ */

export const ESPERA = congelar({
  frases: [
    'El director medita tu destino…',
    'Se consultan las crónicas…',
    'El mundo contiene el aliento…',
    'Los dados ya han caído; falta contarlo…',
    'Alguien, en alguna parte, toma una decisión…',
    'Se descorre el telón de la siguiente escena…',
  ],
  /** Cada cuánto rota la frase mostrada. */
  rotacionMs: 3800,
});

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORTACIÓN AGRUPADA
   ═══════════════════════════════════════════════════════════════════════════ */

const AI = congelar({
  PROVEEDORES,
  PROVEEDOR_DEFECTO,
  CATALOGO_PROVEEDORES,
  CREDENCIALES,
  MUESTREO,
  CONTEXTO,
  DIRECTOR,
  CONTRATO,
  RED,
  ESPERA,
});

export default AI;
