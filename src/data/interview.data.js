/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · data/interview.data.js
 * ---------------------------------------------------------------------------
 * Guion de la entrevista de creación de personaje.
 *
 * El flujo no es un formulario: es una conversación. El jugador escribe quién
 * quiere ser y el sistema pregunta solo lo que sigue faltando. Si describes
 * «un enano herrero que huyó de su clan», ya tienes linaje, vocación probable
 * y trasfondo: nadie te preguntará la raza. Te preguntará por qué huiste.
 *
 * Cada pregunta declara:
 *   · `necesita` — qué campo pretende resolver
 *   · `omitirSi` — cuándo no hace falta hacerla
 *   · `extrae`   — qué se guarda de la respuesta
 *
 * La entrevista NUNCA es obligatoria. En cualquier momento el jugador puede
 * decir «lo demás decídelo tú» y el sistema completa lo que falte.
 *
 * Sin dependencias.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* ═══════════════════════════════════════════════════════════════════════════
   APERTURA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Texto de bienvenida. Deliberadamente abierto: cuanto menos se acote, más
 * material aporta el jugador.
 */
export const APERTURA = Object.freeze({
  titulo: 'Cuéntame quién eres',
  cuerpo:
    'Describe a tu personaje con tus palabras. Puede ser una frase o un párrafo entero. ' +
    'No hace falta que uses términos de juego: escribe como si se lo estuvieras contando a alguien.',
  marcador:
    'Por ejemplo: «Una enana herrera que dejó su clan después de forjar algo de lo que se ' +
    'arrepiente. Prefiere arreglar cosas a pelear, pero pega fuerte cuando toca.»',
  ayuda:
    'Cuanto más cuentes, menos te preguntaré después. Si prefieres ir rápido, escribe algo breve ' +
    'y yo completo el resto.',
  minCaracteres: 10,
});

/** Sugerencias de ejemplo, por si el jugador se queda en blanco. */
export const SEMILLAS = Object.freeze([
  'Un veterano de guerra que ya no quiere empuñar un arma, pero no sabe hacer otra cosa.',
  'Una ladrona que roba historias más que objetos, y que busca el final de una que le contaron de niña.',
  'Un erudito expulsado de su academia por investigar algo que le prohibieron tocar.',
  'Alguien enorme y silencioso que bajó de la montaña buscando a la persona que le arrebataron.',
  'Una sanadora que juró proteger a alguien y llegó tarde.',
  'Un autómata que lleva siglos funcionando sin órdenes y ha empezado a preguntarse por qué.',
]);

/* ═══════════════════════════════════════════════════════════════════════════
   PREGUNTAS
   ---------------------------------------------------------------------------
   Se evalúan en orden. Cada una se omite si su información ya está resuelta
   con suficiente confianza.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Pregunta
 * @property {string} id
 * @property {string} necesita Campo que resuelve.
 * @property {string} texto
 * @property {string} [ayuda]
 * @property {'texto'|'opciones'|'confirmar'} tipo
 * @property {number} prioridad Menor se pregunta antes.
 * @property {(borrador: Object) => boolean} [omitirSi]
 * @property {(borrador: Object) => Array<Object>} [opciones] Para tipo 'opciones'.
 * @property {string} [extrae] Ruta del borrador donde se guarda.
 * @property {boolean} [opcional=false]
 */

/** @type {Pregunta[]} */
export const PREGUNTAS = Object.freeze([

  /* ─── 1. Nombre ──────────────────────────────────────────────────────── */
  {
    id: 'nombre',
    necesita: 'nombre',
    texto: '¿Cómo se llama?',
    ayuda: 'Si no se te ocurre nada, puedo sugerirte un nombre acorde a su origen.',
    tipo: 'texto',
    prioridad: 10,
    extrae: 'nombre',
    omitirSi: (b) => Boolean(b.nombre),
    permitirSugerencia: true,
  },

  /* ─── 2. Linaje ──────────────────────────────────────────────────────── */
  {
    id: 'raza_confirmar',
    necesita: 'raza',
    texto: 'Por cómo lo describes, diría que es {propuesta}. ¿Voy bien?',
    ayuda: 'Si no es eso, dime qué es y lo cambio.',
    tipo: 'confirmar',
    prioridad: 20,
    extrae: 'raza',
    omitirSi: (b) => !b._propuestas?.raza || b._propuestas.raza.confianza < 0.45,
  },
  {
    id: 'raza_elegir',
    necesita: 'raza',
    texto: '¿De qué pueblo viene?',
    ayuda: 'Puedes escribirlo con tus palabras o elegir de la lista.',
    tipo: 'opciones',
    prioridad: 21,
    extrae: 'raza',
    omitirSi: (b) => Boolean(b.raza),
    fuenteOpciones: 'razas',
  },
  {
    id: 'subraza',
    necesita: 'subraza',
    texto: 'Dentro de ese pueblo hay variantes. ¿Cuál encaja mejor?',
    tipo: 'opciones',
    prioridad: 22,
    extrae: 'subraza',
    opcional: true,
    omitirSi: (b) => Boolean(b.subraza) || !b._tieneSubrazas,
    fuenteOpciones: 'subrazas',
  },

  /* ─── 3. Vocación ────────────────────────────────────────────────────── */
  {
    id: 'clase_confirmar',
    necesita: 'clase',
    texto: 'Suena a {propuesta}: {descripcionBreve}. ¿Te encaja?',
    tipo: 'confirmar',
    prioridad: 30,
    extrae: 'clase',
    omitirSi: (b) => !b._propuestas?.clase || b._propuestas.clase.confianza < 0.45,
  },
  {
    id: 'clase_elegir',
    necesita: 'clase',
    texto: '¿Cómo resuelve los problemas cuando se complican?',
    ayuda: 'No pienses en clases: piensa en qué hace cuando la cosa se pone fea.',
    tipo: 'opciones',
    prioridad: 31,
    extrae: 'clase',
    omitirSi: (b) => Boolean(b.clase),
    fuenteOpciones: 'clases',
  },

  /* ─── 4. Trasfondo ───────────────────────────────────────────────────── */
  {
    id: 'trasfondo_confirmar',
    necesita: 'trasfondo',
    texto: 'Y antes de todo esto, ¿era {propuesta}?',
    tipo: 'confirmar',
    prioridad: 40,
    extrae: 'trasfondo',
    omitirSi: (b) => !b._propuestas?.trasfondo || b._propuestas.trasfondo.confianza < 0.45,
  },
  {
    id: 'trasfondo_elegir',
    necesita: 'trasfondo',
    texto: '¿A qué se dedicaba antes de empezar todo esto?',
    tipo: 'opciones',
    prioridad: 41,
    extrae: 'trasfondo',
    omitirSi: (b) => Boolean(b.trasfondo),
    fuenteOpciones: 'trasfondos',
  },

  /* ─── 5. Motivación ──────────────────────────────────────────────────── */
  {
    id: 'motivacion',
    necesita: 'motivacion',
    texto: '¿Qué le ha sacado de su vida anterior?',
    ayuda: 'Puede ser algo que busca, algo de lo que huye, o una deuda que arrastra.',
    tipo: 'texto',
    prioridad: 50,
    extrae: 'motivacion',
    omitirSi: (b) => Boolean(b.motivacion) && b.motivacion.length > 20,
  },

  /* ─── 6. Gancho personal ─────────────────────────────────────────────── */
  {
    id: 'gancho',
    necesita: 'gancho',
    texto: 'Una última cosa: {preguntaEspecifica}',
    ayuda: 'Esto es lo que usaré para que su pasado aparezca durante la partida.',
    tipo: 'texto',
    prioridad: 60,
    extrae: 'gancho',
    opcional: true,
    omitirSi: (b) => Boolean(b.gancho),
    usaPreguntaDeContenido: true,
  },

  /* ─── 7. Rasgo distintivo ────────────────────────────────────────────── */
  {
    id: 'detalle',
    necesita: 'detalle',
    texto: '¿Hay algo en su aspecto o su forma de ser que la gente note enseguida?',
    ayuda: 'Una cicatriz, una manía, una forma de hablar. Lo usaré al describirle.',
    tipo: 'texto',
    prioridad: 70,
    extrae: 'detalle',
    opcional: true,
    omitirSi: (b) => Boolean(b.detalle),
  },

  /* ─── 8. Alineamiento implícito ──────────────────────────────────────── */
  {
    id: 'principio',
    necesita: 'principio',
    texto: '¿Hay algo que no haría nunca, pase lo que pase?',
    ayuda: 'Sirve para calibrar su brújula moral. Puedes decir «nada» y también será una respuesta.',
    tipo: 'texto',
    prioridad: 80,
    extrae: 'principio',
    opcional: true,
    omitirSi: (b) => Boolean(b.principio),
  },
]);

/* ═══════════════════════════════════════════════════════════════════════════
   RESPUESTAS ESPECIALES
   Frases que el jugador puede escribir en cualquier momento.
   ═══════════════════════════════════════════════════════════════════════════ */

export const ATAJOS = Object.freeze({
  /** Completa todo lo que falte con decisiones automáticas coherentes. */
  autocompletar: [
    'decide tú', 'decídelo tú', 'lo que quieras', 'da igual', 'me da igual',
    'sorpréndeme', 'tú eliges', 'salta', 'sáltate esto', 'lo demás decídelo tú',
    'completa el resto', 'no sé', 'ni idea',
  ],
  /** Omite solo la pregunta actual. */
  omitir: ['siguiente', 'pasa', 'paso', 'omitir', 'skip', 'nada'],
  /** Vuelve a la pregunta anterior. */
  atras: ['atrás', 'atras', 'volver', 'anterior', 'corrige', 'me equivoqué'],
  /** Pide una sugerencia para la pregunta actual. */
  sugerir: ['sugiere', 'sugiéreme', 'dame ideas', 'propón', 'ejemplos', 'ayuda'],
});

/* ═══════════════════════════════════════════════════════════════════════════
   TEXTOS DE APOYO
   ═══════════════════════════════════════════════════════════════════════════ */

export const TEXTOS_ENTREVISTA = Object.freeze({
  pensando: 'Un momento…',
  autocompletado: 'De acuerdo, completo lo que falta.',
  corregido: 'Corregido.',
  sinPropuesta: 'No acabo de verlo claro, así que te lo pregunto directamente.',
  confirmacionPositiva: ['sí', 'si', 'exacto', 'eso es', 'correcto', 'vale', 'ok', 'perfecto', 'sip', 'claro'],
  confirmacionNegativa: ['no', 'nop', 'para nada', 'qué va', 'que va', 'negativo', 'nada de eso'],

  resumen: {
    titulo: 'Así queda',
    intro: 'Esto es lo que he entendido. Puedes cambiar cualquier cosa antes de empezar.',
    confirmar: 'Empezar la crónica',
    editar: 'Cambiar algo',
    reiniciar: 'Empezar de cero',
  },

  atributos: {
    titulo: 'Reparto de atributos',
    intro:
      'He repartido los puntos según lo que me has contado. Puedes ajustarlos a tu gusto o ' +
      'dejarlos como están.',
    automatico: 'Repartir por mí',
    manual: 'Ajustar a mano',
    restantes: 'Puntos por repartir',
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   PLANTILLAS DE REPARTO DE ATRIBUTOS
   ---------------------------------------------------------------------------
   Al deducir la vocación, el sistema reparte los 27 puntos siguiendo una de
   estas plantillas. El jugador siempre puede reajustar.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Cada plantilla asigna valores finales antes de los modificadores de linaje.
 * Suman exactamente 27 puntos según la tabla de coste de balance.config.js.
 */
export const PLANTILLAS_ATRIBUTOS = Object.freeze({
  fisico: { vigor: 15, destreza: 14, temple: 14, intelecto: 10, astucia: 12, carisma: 8 },
  agil: { vigor: 12, destreza: 16, temple: 13, intelecto: 10, astucia: 13, carisma: 10 },
  arcano: { vigor: 8, destreza: 12, temple: 14, intelecto: 16, astucia: 12, carisma: 11 },
  social: { vigor: 10, destreza: 12, temple: 12, intelecto: 12, astucia: 12, carisma: 16 },
  astuto: { vigor: 10, destreza: 14, temple: 12, intelecto: 13, astucia: 15, carisma: 11 },
  templado: { vigor: 12, destreza: 11, temple: 16, intelecto: 12, astucia: 14, carisma: 10 },
  equilibrado: { vigor: 13, destreza: 13, temple: 13, intelecto: 12, astucia: 12, carisma: 12 },
});

/** Plantilla recomendada por vocación. */
export const PLANTILLA_POR_CLASE = Object.freeze({
  baluarte: 'fisico',
  filo: 'agil',
  rastreador: 'agil',
  sombra: 'astuto',
  glifista: 'arcano',
  vinculado: 'social',
  portavoz: 'social',
  custodio: 'templado',
});

export default {
  APERTURA,
  SEMILLAS,
  PREGUNTAS,
  ATAJOS,
  TEXTOS_ENTREVISTA,
  PLANTILLAS_ATRIBUTOS,
  PLANTILLA_POR_CLASE,
};
