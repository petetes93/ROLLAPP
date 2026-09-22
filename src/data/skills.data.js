/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · data/skills.data.js
 * ---------------------------------------------------------------------------
 * Competencias del Sistema Núcleo d20.
 *
 * Dieciocho habilidades, cada una vinculada a un atributo. El grado de
 * competencia (inepto → legendario) aporta un bonificador definido en
 * balance.config.js.
 *
 * El campo `usos` no es decorativo: el director lo consulta para saber qué
 * puede pedir con cada habilidad, y `intenciones` permite que ActionRouter
 * traduzca «intento colarme por la ventana» a una prueba de sigilo sin que
 * nadie escriba un if.
 *
 * Sin dependencias.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * @typedef {Object} Habilidad
 * @property {string} refId
 * @property {string} nombre
 * @property {string} atributo Atributo base.
 * @property {string} descripcion
 * @property {string[]} usos Ejemplos de aplicación.
 * @property {string[]} intenciones Verbos que la disparan.
 * @property {string} [icono]
 */

/** @type {Record<string, Habilidad>} */
export const HABILIDADES = Object.freeze({

  /* ─── VIGOR ──────────────────────────────────────────────────────────── */
  atletismo: {
    refId: 'atletismo',
    nombre: 'Atletismo',
    atributo: 'vigor',
    descripcion: 'Trepar, saltar, nadar, forzar puertas y todo esfuerzo físico bruto.',
    usos: ['escalar un muro', 'forzar una puerta atrancada', 'nadar contra corriente', 'sujetar a alguien'],
    intenciones: ['trepar', 'escalar', 'saltar', 'nadar', 'forzar', 'empujar', 'levantar', 'agarrar'],
  },
  resistencia: {
    refId: 'resistencia',
    nombre: 'Resistencia',
    atributo: 'vigor',
    descripcion: 'Aguantar el esfuerzo prolongado, el dolor, el hambre y las inclemencias.',
    usos: ['marchas forzadas', 'soportar tortura', 'aguantar sin dormir', 'resistir el frío'],
    intenciones: ['aguantar', 'resistir', 'soportar', 'perseverar'],
  },

  /* ─── DESTREZA ───────────────────────────────────────────────────────── */
  sigilo: {
    refId: 'sigilo',
    nombre: 'Sigilo',
    atributo: 'destreza',
    descripcion: 'Moverse sin ser visto ni oído, y esconderse cuando hace falta.',
    usos: ['colarse en un campamento', 'seguir a alguien', 'esconderse a la vista'],
    intenciones: ['esconder', 'ocultar', 'colar', 'acechar', 'seguir', 'infiltrar', 'sigilo'],
  },
  acrobacias: {
    refId: 'acrobacias',
    nombre: 'Acrobacias',
    atributo: 'destreza',
    descripcion: 'Equilibrio, agilidad y control del cuerpo en situaciones precarias.',
    usos: ['cruzar una viga estrecha', 'caer sin daño', 'escapar de un agarre'],
    intenciones: ['equilibrio', 'voltereta', 'esquivar', 'escurrir', 'zafar'],
  },
  juego_manos: {
    refId: 'juego_manos',
    nombre: 'Juego de manos',
    atributo: 'destreza',
    descripcion: 'Forzar cerraduras, robar bolsillos, hacer trampas y manipular mecanismos finos.',
    usos: ['abrir una cerradura', 'robar una llave', 'desarmar una trampa', 'hacer trampas al juego'],
    intenciones: ['ganzúa', 'robar', 'sustraer', 'desarmar', 'manipular', 'trucar'],
  },

  /* ─── TEMPLE ─────────────────────────────────────────────────────────── */
  concentracion: {
    refId: 'concentracion',
    nombre: 'Concentración',
    atributo: 'temple',
    descripcion: 'Mantener un efecto activo bajo presión y no perder el hilo bajo estrés.',
    usos: ['sostener un glifo mientras te golpean', 'no perder la calma'],
    intenciones: ['concentrar', 'mantener', 'enfocar'],
  },
  voluntad: {
    refId: 'voluntad',
    nombre: 'Voluntad',
    atributo: 'temple',
    descripcion: 'Resistir el miedo, el dominio mental y las tentaciones.',
    usos: ['resistir un encantamiento', 'aguantar el terror', 'rechazar un soborno'],
    intenciones: ['resistir', 'rechazar', 'negar', 'sobreponer'],
  },

  /* ─── INTELECTO ──────────────────────────────────────────────────────── */
  saber_arcano: {
    refId: 'saber_arcano',
    nombre: 'Saber arcano',
    atributo: 'intelecto',
    descripcion: 'Identificar magia, glifos, criaturas mágicas y sus reglas.',
    usos: ['identificar un conjuro', 'leer un glifo', 'reconocer un objeto encantado'],
    intenciones: ['identificar', 'analizar', 'descifrar', 'estudiar'],
  },
  historia: {
    refId: 'historia',
    nombre: 'Historia',
    atributo: 'intelecto',
    descripcion: 'Recordar acontecimientos, linajes, guerras y política pasada.',
    usos: ['reconocer un escudo de armas', 'recordar un tratado', 'datar unas ruinas'],
    intenciones: ['recordar', 'conocer', 'datar', 'reconocer'],
  },
  saber_oculto: {
    refId: 'saber_oculto',
    nombre: 'Saber oculto',
    atributo: 'intelecto',
    descripcion: 'Conocimiento de lo sobrenatural, los pactos y lo que hay al otro lado del velo.',
    usos: ['reconocer una marca de pacto', 'entender un ritual', 'saber qué ahuyenta a algo'],
    intenciones: ['ritual', 'invocar', 'exorcizar', 'presagio'],
  },
  medicina: {
    refId: 'medicina',
    nombre: 'Medicina',
    atributo: 'intelecto',
    descripcion: 'Tratar heridas, diagnosticar males y estabilizar a un moribundo.',
    usos: ['detener una hemorragia', 'identificar un veneno', 'entablillar un hueso'],
    intenciones: ['curar', 'vendar', 'tratar', 'diagnosticar', 'estabilizar'],
  },
  artesania: {
    refId: 'artesania',
    nombre: 'Artesanía',
    atributo: 'intelecto',
    descripcion: 'Fabricar, reparar y comprender objetos hechos por manos.',
    usos: ['reparar un arma', 'fabricar una herramienta', 'entender un mecanismo'],
    intenciones: ['reparar', 'fabricar', 'construir', 'arreglar', 'forjar'],
  },

  /* ─── ASTUCIA ────────────────────────────────────────────────────────── */
  percepcion: {
    refId: 'percepcion',
    nombre: 'Percepción',
    atributo: 'astucia',
    descripcion: 'Notar lo que otros pasan por alto: detalles, emboscadas, sonidos.',
    usos: ['detectar una emboscada', 'oír una conversación', 'ver una trampa'],
    intenciones: ['mirar', 'observar', 'escuchar', 'buscar', 'examinar', 'inspeccionar', 'registrar'],
  },
  supervivencia: {
    refId: 'supervivencia',
    nombre: 'Supervivencia',
    atributo: 'astucia',
    descripcion: 'Rastrear, orientarse, cazar y sobrevivir lejos de la civilización.',
    usos: ['seguir un rastro', 'encontrar agua', 'predecir el tiempo', 'montar un campamento'],
    intenciones: ['rastrear', 'cazar', 'orientar', 'acampar', 'forrajear'],
  },
  perspicacia: {
    refId: 'perspicacia',
    nombre: 'Perspicacia',
    atributo: 'astucia',
    descripcion: 'Leer intenciones, detectar mentiras y calibrar a la gente.',
    usos: ['saber si alguien miente', 'intuir un motivo oculto', 'medir a un rival'],
    intenciones: ['leer', 'intuir', 'calibrar', 'sospechar'],
  },
  tasacion: {
    refId: 'tasacion',
    nombre: 'Tasación',
    atributo: 'astucia',
    descripcion: 'Estimar el valor real de un objeto y detectar falsificaciones.',
    usos: ['valorar una gema', 'detectar una falsificación', 'saber si te están timando'],
    intenciones: ['tasar', 'valorar', 'apreciar'],
  },

  /* ─── CARISMA ────────────────────────────────────────────────────────── */
  trato_social: {
    refId: 'trato_social',
    nombre: 'Trato social',
    atributo: 'carisma',
    descripcion: 'Persuadir, negociar y caer bien cuando conviene.',
    usos: ['convencer a un guardia', 'regatear', 'pedir un favor', 'calmar una multitud'],
    intenciones: ['convencer', 'persuadir', 'negociar', 'pedir', 'regatear', 'hablar', 'calmar'],
  },
  intimidacion: {
    refId: 'intimidacion',
    nombre: 'Intimidación',
    atributo: 'carisma',
    descripcion: 'Imponerse por la fuerza de la presencia o la amenaza.',
    usos: ['hacer hablar a un prisionero', 'ahuyentar a unos matones', 'imponer respeto'],
    intenciones: ['intimidar', 'amenazar', 'coaccionar', 'asustar'],
  },
  engano: {
    refId: 'engano',
    nombre: 'Engaño',
    atributo: 'carisma',
    descripcion: 'Mentir con convicción, hacerse pasar por otro y distraer.',
    usos: ['mentir a un interrogador', 'suplantar a alguien', 'crear una distracción'],
    intenciones: ['mentir', 'engañar', 'fingir', 'disfrazar', 'suplantar', 'distraer'],
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   CONSULTAS
   ═══════════════════════════════════════════════════════════════════════════ */

/** @type {string[]} */
export const ORDEN_HABILIDADES = Object.freeze(Object.keys(HABILIDADES));

/**
 * @param {string} refId
 * @returns {Habilidad|null}
 */
export function obtenerHabilidad(refId) {
  return HABILIDADES[refId] ?? null;
}

/**
 * Habilidades agrupadas por atributo, para la ficha de personaje.
 * @returns {Record<string, Habilidad[]>}
 */
export function porAtributo() {
  const grupos = {};
  for (const h of Object.values(HABILIDADES)) {
    if (!grupos[h.atributo]) grupos[h.atributo] = [];
    grupos[h.atributo].push(h);
  }
  return grupos;
}

/**
 * Deduce qué habilidad corresponde a una acción escrita en texto libre.
 *
 * Es lo que permite que «intento colarme por la ventana sin que me vean» se
 * resuelva como una prueba de sigilo sin que el jugador nombre la habilidad.
 *
 * @param {string} texto Acción del jugador.
 * @returns {{refId: string, confianza: number}|null}
 */
export function deducirHabilidad(texto) {
  const limpio = texto.toLowerCase();
  let mejor = null;
  let mejorPuntos = 0;

  for (const h of Object.values(HABILIDADES)) {
    let puntos = 0;
    for (const verbo of h.intenciones) {
      if (limpio.includes(verbo)) puntos += 2;
    }
    // El nombre explícito de la habilidad pesa más que cualquier verbo.
    if (limpio.includes(h.nombre.toLowerCase())) puntos += 5;

    if (puntos > mejorPuntos) {
      mejorPuntos = puntos;
      mejor = h.refId;
    }
  }

  return mejor ? { refId: mejor, confianza: Math.min(mejorPuntos / 7, 1) } : null;
}

export default HABILIDADES;
