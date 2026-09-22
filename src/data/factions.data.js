/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · data/factions.data.js
 * ---------------------------------------------------------------------------
 * Facciones de los Reinos Quebrados. Contenido original.
 *
 * Ocho organizaciones con intereses que chocan. Lo importante no son sus datos
 * sino sus RELACIONES: cada una declara aliadas y enemigas, y eso hace que
 * ganarse a unos cueste con otros.
 *
 * `valora` y `desprecia` son listas de conductas. `ReputationSystem` las
 * compara con lo que el jugador hace y ajusta la reputación sin que nadie tenga
 * que declararlo turno a turno. Robar molesta a la Guardia porque su catálogo
 * lista el robo como despreciado, no porque haya una regla especial.
 *
 * `exige` es lo que la facción espera de un aliado. Se comunica al alcanzar ese
 * nivel: pertenecer a algo tiene precio, no solo ventajas.
 *
 * Sin dependencias.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * @typedef {Object} Faccion
 * @property {string} refId
 * @property {string} nombre
 * @property {string} lema
 * @property {string} regiones Donde tiene presencia.
 * @property {string[]} aliadas
 * @property {string[]} enemigas
 * @property {string[]} valora Conductas que le suben la reputación.
 * @property {string[]} desprecia Conductas que se la bajan.
 * @property {string[]} exige Lo que espera de un aliado.
 * @property {Record<string, string>} beneficios Por nivel de reputación.
 * @property {string} promptLore
 */

/** @type {Record<string, Faccion>} */
export const FACCIONES = Object.freeze({

  guardia_valle: {
    refId: 'guardia_valle',
    nombre: 'La Guardia del Valle',
    lema: 'El camino es de todos.',
    regiones: ['valle_central'],
    aliadas: ['gremio_yunque'],
    enemigas: ['sombras_puerto'],
    valora: [
      'proteger a un inocente', 'entregar a un criminal', 'denunciar un delito',
      'ayudar a un guardia', 'pagar impuestos', 'mantener el orden',
    ],
    desprecia: [
      'robar', 'matar a un civil', 'ayudar a un bandido', 'contrabando',
      'agredir a un guardia', 'sobornar',
    ],
    exige: [
      'Que no encubras a quien quebranta la ley.',
      'Que respondas cuando se te llame.',
    ],
    beneficios: {
      cordial: 'los guardias te dejan pasar sin registro',
      aliado: 'puedes reclamar auxilio en cualquier puesto del valle',
      venerado: 'tienes autoridad delegada: tu palabra vale ante un tribunal',
    },
    promptLore: 'Milicia del Valle Central. Mal pagada, escasa y no siempre honesta, pero es lo único que mantiene los caminos transitables. Su capitana es incorruptible; algunos de sus hombres, no.',
  },

  gremio_yunque: {
    refId: 'gremio_yunque',
    nombre: 'El Gremio del Yunque',
    lema: 'Sin sello, sin garantía.',
    regiones: ['valle_central', 'montanas_yunque'],
    aliadas: ['guardia_valle'],
    enemigas: ['clanes_ferranos', 'sombras_puerto'],
    valora: [
      'comerciar con honestidad', 'pagar un precio justo', 'cumplir un contrato',
      'denunciar una falsificación', 'usar productos con sello',
    ],
    desprecia: [
      'falsificar un sello', 'regatear con dureza', 'comerciar con contrabando',
      'romper un contrato', 'comprar a un herrero sin sello',
    ],
    exige: [
      'Que compres y vendas dentro del gremio.',
      'Que denuncies las forjas sin sello.',
    ],
    beneficios: {
      cordial: 'precios de gremio en los talleres afiliados',
      aliado: 'acceso a los encargos reservados y crédito',
      venerado: 'voto en las decisiones del gremio',
    },
    promptLore: 'Organización comercial que controla la forja y el comercio de metal. Quiere su sello en cada pieza fabricada en los reinos. Los clanes ferranos consideran eso una humillación, y ahí está el conflicto.',
  },

  clanes_ferranos: {
    refId: 'clanes_ferranos',
    nombre: 'Los Clanes Ferranos',
    lema: 'El metal recuerda quién lo trabajó.',
    regiones: ['montanas_yunque'],
    aliadas: [],
    enemigas: ['gremio_yunque'],
    valora: [
      'respetar una tradición', 'cumplir la palabra dada', 'defender a un ferrano',
      'trabajar con las manos', 'rechazar el sello del gremio',
    ],
    desprecia: [
      'romper la palabra', 'traficar con el gremio', 'despreciar el oficio',
      'profanar una forja', 'mentir a un maestro de clan',
    ],
    exige: [
      'Que tu palabra valga sin necesidad de papel.',
      'Que no lleves piezas selladas por el gremio a nuestros valles.',
    ],
    beneficios: {
      cordial: 'te reparan el equipo sin cobrar la mano de obra',
      aliado: 'un maestro forjará para ti una pieza a medida',
      venerado: 'te consideran de clan: tienes derecho de hospitalidad y voz en el salón',
    },
    promptLore: 'Confederación de clanes ferranos de las montañas. Ocho generaciones en la misma forja. Su palabra es contrato y una ofensa se recuerda durante décadas. Odian al gremio con paciencia.',
  },

  circulo_arboleda: {
    refId: 'circulo_arboleda',
    nombre: 'El Círculo de la Arboleda',
    lema: 'El bosque estaba antes.',
    regiones: ['bosque_cenizo'],
    aliadas: ['guardianes_velo'],
    enemigas: [],
    valora: [
      'plantar un árbol', 'proteger a un animal', 'respetar un lugar sagrado',
      'rechazar el metal en el bosque', 'sanar a alguien',
    ],
    desprecia: [
      'talar sin permiso', 'cazar por deporte', 'quemar el bosque',
      'traer hierro a la arboleda', 'matar a un guardián',
    ],
    exige: [
      'Que no cortes lo que no vas a usar.',
      'Que respetes los límites que marcamos.',
    ],
    beneficios: {
      cordial: 'los senderos del bosque se te muestran',
      aliado: 'los guardianes te avisan de los peligros y te dan cobijo',
      venerado: 'el Círculo te enseña a leer el bosque: ventaja en supervivencia',
    },
    promptLore: 'Guardianes sombracorteza del Bosque Cenizo. No reconocen fronteras humanas ni permisos de tala. Consideran el bosque un ser único y a sí mismos su sistema inmunitario. Toleran a los forasteros; no los invitan.',
  },

  guardianes_velo: {
    refId: 'guardianes_velo',
    nombre: 'Los Guardianes del Velo',
    lema: 'Lo que está cerrado, cerrado se queda.',
    regiones: ['marisma_velo'],
    aliadas: ['circulo_arboleda', 'custodios_albares'],
    enemigas: [],
    valora: [
      'guardar un secreto', 'sellar una brecha', 'advertir de un peligro',
      'respetar una prohibición', 'destruir un objeto peligroso',
    ],
    desprecia: [
      'abrir un sello', 'traficar con hongos del velo', 'invocar algo del otro lado',
      'entrar en el Espejo Negro', 'divulgar lo que se te confió',
    ],
    exige: [
      'Que no cuentes lo que ves aquí.',
      'Que informes de cualquier brecha que encuentres.',
    ],
    beneficios: {
      cordial: 'te enseñan a reconocer las señales del velo',
      aliado: 'te confían un amuleto de contención',
      venerado: 'te revelan qué hay al otro lado, y ojalá no lo hubieran hecho',
    },
    promptLore: 'Orden brumal que vigila las brechas del velo en la Marisma. Hablan con precisión inquietante y nunca explican del todo. Llevan generaciones conteniendo algo y consideran que la ignorancia general es parte de la contención.',
  },

  custodios_albares: {
    refId: 'custodios_albares',
    nombre: 'Los Custodios Albares',
    lema: 'Comprender antes de tocar.',
    regiones: ['ruinas_albares'],
    aliadas: ['guardianes_velo'],
    enemigas: ['sombras_puerto'],
    valora: [
      'entregar una reliquia', 'descifrar una inscripción', 'documentar un hallazgo',
      'proteger una ruina', 'compartir conocimiento',
    ],
    desprecia: [
      'saquear una ruina', 'vender una reliquia', 'destruir un mecanismo',
      'activar algo sin entenderlo', 'traficar con antigüedades',
    ],
    exige: [
      'Que nos traigas lo que encuentres antes de venderlo.',
      'Que no actives nada que no comprendas.',
    ],
    beneficios: {
      cordial: 'acceso al archivo del campamento',
      aliado: 'te traducen inscripciones albares y te prestan instrumentos',
      venerado: 'te enseñan albar suficiente para hablar con los autómatas',
    },
    promptLore: 'Orden de estudiosos que catalogan las Ruinas Albares. Prefieren dejar algo sin abrir a abrirlo mal. Desprecian a los buscadores de reliquias y compiten con ellos por cada hallazgo.',
  },

  caravanas_duna: {
    refId: 'caravanas_duna',
    nombre: 'Las Caravanas de la Duna',
    lema: 'El agua se comparte.',
    regiones: ['dunas_rojas'],
    aliadas: [],
    enemigas: ['sombras_puerto'],
    valora: [
      'compartir agua', 'dar hospitalidad', 'proteger una caravana',
      'cumplir un trato de palabra', 'ayudar a un extraviado',
    ],
    desprecia: [
      'robar agua', 'abandonar a alguien en el desierto', 'atacar bajo techo',
      'romper la hospitalidad', 'envenenar un pozo',
    ],
    exige: [
      'Que compartas el agua cuando puedas.',
      'Que respetes la hospitalidad, incluso con tus enemigos.',
    ],
    beneficios: {
      cordial: 'viajas gratis con cualquier caravana',
      aliado: 'te revelan rutas que no están en ningún mapa',
      venerado: 'una caravana entera responderá si la llamas',
    },
    promptLore: 'Confederación de caravaneros de las Dunas Rojas. La hospitalidad es su ley absoluta: bajo un techo, hasta un enemigo está a salvo, y romper eso es la única ofensa que no perdonan. Conocen el desierto mejor que cualquier mapa.',
  },

  sombras_puerto: {
    refId: 'sombras_puerto',
    nombre: 'Las Sombras del Puerto',
    lema: 'Todo tiene un precio y nosotros lo sabemos.',
    regiones: ['marisma_velo', 'dunas_rojas'],
    aliadas: [],
    enemigas: ['guardia_valle', 'gremio_yunque', 'custodios_albares', 'caravanas_duna'],
    valora: [
      'contrabando', 'sobornar', 'guardar un secreto lucrativo',
      'eliminar a un competidor', 'traficar con reliquias',
    ],
    desprecia: [
      'denunciar a un contrabandista', 'entregar a alguien a la guardia',
      'delatar un escondite', 'trabajar gratis',
    ],
    exige: [
      'Que no hables con la guardia de lo que sabes.',
      'Que pagues tu parte.',
    ],
    beneficios: {
      cordial: 'acceso al mercado que no existe',
      aliado: 'te consiguen lo que no se puede conseguir',
      venerado: 'tienes gente a tu disposición y nadie pregunta para qué',
    },
    promptLore: 'Organización criminal con base en Puerto Lodo. Mueven contrabando, reliquias y personas. No son crueles por gusto: son profesionales, y eso los hace peores. Todo el mundo sabe quiénes son y nadie lo dice en voz alta.',
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   CONSULTAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @param {string} refId
 * @returns {Faccion|null}
 */
export function obtenerFaccion(refId) {
  return FACCIONES[refId] ?? null;
}

/**
 * Facciones presentes en una región.
 *
 * La primera de la lista es la dominante, y pesa el doble en la actitud
 * regional: quien manda aquí importa más.
 *
 * @param {string} region
 * @returns {Faccion[]}
 */
export function faccionesDe(region) {
  if (!region) return [];
  return Object.values(FACCIONES).filter((f) => f.regiones.includes(region));
}

/**
 * Beneficios acumulados hasta un nivel de reputación.
 *
 * Los beneficios se suman: ser aliado incluye lo que da ser cordial.
 *
 * @param {string} refId
 * @param {string} nivel
 * @returns {string[]}
 */
export function beneficiosAcumulados(refId, nivel) {
  const faccion = FACCIONES[refId];
  if (!faccion) return [];

  const escala = ['cordial', 'aliado', 'venerado'];
  const tope = escala.indexOf(nivel);

  if (tope < 0) return [];

  return escala
    .slice(0, tope + 1)
    .map((n) => faccion.beneficios[n])
    .filter(Boolean);
}

/**
 * Evalúa si una acción afecta a la reputación con una facción.
 *
 * Compara el texto de la acción con las listas `valora` y `desprecia`. Es lo que
 * permite que el mundo reaccione sin que nadie declare cada consecuencia.
 *
 * @param {string} refId
 * @param {string} texto Descripción de la acción.
 * @returns {{coincide: boolean, direccion: number, motivo: string|null}}
 */
export function evaluarAccion(refId, texto) {
  const faccion = FACCIONES[refId];
  if (!faccion || !texto) return { coincide: false, direccion: 0, motivo: null };

  const limpio = String(texto).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Se buscan primero las conductas despreciadas: pesan más que las valoradas,
  // porque la desconfianza se gana antes que el aprecio.
  for (const conducta of faccion.desprecia) {
    const patron = conducta.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (limpio.includes(patron)) {
      return { coincide: true, direccion: -1, motivo: conducta };
    }
  }

  for (const conducta of faccion.valora) {
    const patron = conducta.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (limpio.includes(patron)) {
      return { coincide: true, direccion: 1, motivo: conducta };
    }
  }

  return { coincide: false, direccion: 0, motivo: null };
}

/**
 * Comprueba si dos facciones están enfrentadas.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function sonEnemigas(a, b) {
  return Boolean(FACCIONES[a]?.enemigas.includes(b));
}

/**
 * Comprueba si dos facciones son aliadas.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function sonAliadas(a, b) {
  return Boolean(FACCIONES[a]?.aliadas.includes(b));
}

export default FACCIONES;
