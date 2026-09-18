/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · world/EncounterTables.js
 * ---------------------------------------------------------------------------
 * Tablas de encuentros.
 *
 * Dieciocho encuentros repartidos en tres familias, y la proporción importa:
 *
 *   · HOSTILES (6) — pelea, o negociación bajo amenaza
 *   · NEUTROS (8) — gente, situaciones, decisiones sin violencia
 *   · ÚTILES (4) — hallazgos, ayuda, oportunidades
 *
 * Que los neutros sean mayoría es deliberado. Un mundo donde cada encuentro es
 * un combate se agota rápido; uno donde la mayoría son personas con las que
 * hablar se siente habitado.
 *
 * Cada encuentro declara `resolucionesPosibles`: las vías por las que puede
 * terminar. Resolver uno hostil sin pelear da MÁS experiencia que matarlo, y
 * esa asimetría es una declaración de intenciones sobre qué clase de juego es
 * este.
 *
 * Sin dependencias más allá de los datos.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { PROGRESION } from '../config/balance.config.js';

/**
 * @typedef {Object} Encuentro
 * @property {string} refId
 * @property {string} nombre
 * @property {string} familia hostil|neutro|util
 * @property {number} peso
 * @property {string[]} terrenos Dónde puede aparecer.
 * @property {[number, number]} peligro Rango de peligro en que aparece.
 * @property {string} apertura Cómo se presenta.
 * @property {string} promptDirector Contexto para narrarlo.
 * @property {string[]} resolucionesPosibles
 * @property {Object} [combate] Declaración de enemigos si se llega a pelea.
 * @property {Object} [recompensa]
 */

/* ═══════════════════════════════════════════════════════════════════════════
   HOSTILES
   ═══════════════════════════════════════════════════════════════════════════ */

/** @type {Record<string, Encuentro>} */
export const HOSTILES = Object.freeze({

  emboscada_bandidos: {
    refId: 'emboscada_bandidos', nombre: 'Emboscada', familia: 'hostil',
    peso: 40, terrenos: ['camino', 'bosque', 'ruinas'], peligro: [1, 4],
    apertura: 'Salen de entre los árboles y te cortan el paso. Son tres y van armados.',
    promptDirector: 'Bandidos que buscan robar, no matar. Si el personaje ofrece algo o los intimida, pueden retirarse. Si pelea, pelean.',
    resolucionesPosibles: ['combate', 'intimidacion', 'soborno', 'huida', 'engano'],
    combate: { enemies: [{ refId: 'saqueador', count: 3 }] },
  },

  manada_hambrienta: {
    refId: 'manada_hambrienta', nombre: 'Manada', familia: 'hostil',
    peso: 35, terrenos: ['bosque', 'montana'], peligro: [2, 5],
    apertura: 'Los ves antes de oírlos: cuatro pares de ojos a la altura de la hierba.',
    promptDirector: 'Lobos hambrientos. No atacan si encuentran comida más fácil: tirar provisiones puede funcionar. El fuego los mantiene a raya.',
    resolucionesPosibles: ['combate', 'distraccion', 'fuego', 'huida'],
    combate: { enemies: [{ refId: 'lobo_ceniciento', count: 3 }] },
  },

  patrulla_hostil: {
    refId: 'patrulla_hostil', nombre: 'Patrulla', familia: 'hostil',
    peso: 25, terrenos: ['camino', 'ciudad'], peligro: [1, 3],
    apertura: 'Una patrulla te ve y cambia de dirección para interceptarte.',
    promptDirector: 'Guardias que buscan una excusa. Si el personaje tiene mala reputación con la Guardia del Valle, van a por él. Si no, solo quieren registrarlo y cobrar algo.',
    resolucionesPosibles: ['combate', 'soborno', 'persuasion', 'sumision', 'huida'],
    combate: { enemies: [{ refId: 'guardia_corrupto', count: 2 }] },
  },

  aparicion: {
    refId: 'aparicion', nombre: 'Aparición', familia: 'hostil',
    peso: 20, terrenos: ['ruinas', 'pantano', 'mazmorra'], peligro: [3, 5],
    apertura: 'La temperatura baja de golpe. Hay algo delante que no acaba de estar del todo.',
    promptDirector: 'Espectro de la edad anterior. Reacciona a los nombres antiguos y a los objetos albares. Si el personaje le habla con respeto, puede no atacar.',
    resolucionesPosibles: ['combate', 'ritual', 'huida', 'dialogo'],
    combate: { enemies: [{ refId: 'espectro_menor', count: 1 }] },
  },

  criatura_territorial: {
    refId: 'criatura_territorial', nombre: 'Territorio ajeno', familia: 'hostil',
    peso: 22, terrenos: ['pantano', 'bosque', 'desierto'], peligro: [2, 5],
    apertura: 'Has entrado donde no debías, y lo que vive aquí acaba de darse cuenta.',
    promptDirector: 'Criatura defendiendo su territorio. No persigue si el personaje retrocede despacio. Atacar la enfurece.',
    resolucionesPosibles: ['combate', 'retirada', 'sigilo'],
    combate: { enemies: [{ refId: 'tejedora_de_umbral', count: 1 }] },
  },

  asalto_nocturno: {
    refId: 'asalto_nocturno', nombre: 'Asalto nocturno', familia: 'hostil',
    peso: 18, terrenos: ['camino', 'bosque', 'montana'], peligro: [2, 5],
    apertura: 'Te despierta un ruido que no es del viento. Ya están dentro del campamento.',
    promptDirector: 'Ataque mientras el personaje descansaba. Está sin equipar del todo y medio dormido: desventaja inicial. Situación desesperada, no imposible.',
    resolucionesPosibles: ['combate', 'huida', 'grito'],
    combate: { enemies: [{ refId: 'saqueador', count: 2 }], ambush: true },
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEUTROS
   ═══════════════════════════════════════════════════════════════════════════ */

/** @type {Record<string, Encuentro>} */
export const NEUTROS = Object.freeze({

  viajero_solitario: {
    refId: 'viajero_solitario', nombre: 'Un viajero', familia: 'neutro',
    peso: 45, terrenos: ['camino', 'bosque', 'montana', 'desierto'], peligro: [0, 3],
    apertura: 'Alguien viene de frente por el camino. Levanta la mano al verte.',
    promptDirector: 'Viajero corriente con su propia historia. Puede tener rumores, mercancía o un problema. No es una amenaza salvo que el personaje lo convierta en una.',
    resolucionesPosibles: ['dialogo', 'comercio', 'ignorar', 'robo'],
  },

  caravana: {
    refId: 'caravana', nombre: 'Una caravana', familia: 'neutro',
    peso: 30, terrenos: ['camino', 'desierto'], peligro: [0, 3],
    apertura: 'Una caravana avanza despacio. El que va delante te mira sin dejar de andar.',
    promptDirector: 'Caravana comercial. Venden, compran y saben qué pasa en la ruta. Pueden ofrecer viajar juntos, lo que es más seguro y más lento.',
    resolucionesPosibles: ['dialogo', 'comercio', 'acompanar', 'ignorar'],
  },

  refugiados: {
    refId: 'refugiados', nombre: 'Gente huyendo', familia: 'neutro',
    peso: 25, terrenos: ['camino', 'bosque'], peligro: [1, 4],
    apertura: 'Un grupo pequeño con lo puesto y la mirada de quien no duerme.',
    promptDirector: 'Familias que huyen de algo. Saben qué las persigue y lo contarán si se les pregunta bien. Necesitan comida o protección.',
    resolucionesPosibles: ['dialogo', 'ayuda', 'ignorar'],
    recompensa: { xpSocial: true, reputacion: 8 },
  },

  disputa_camino: {
    refId: 'disputa_camino', nombre: 'Una discusión', familia: 'neutro',
    peso: 22, terrenos: ['camino', 'ciudad'], peligro: [0, 3],
    apertura: 'Dos personas discuten a gritos en mitad del camino. Al verte, ambas se giran.',
    promptDirector: 'Disputa entre dos partes que quieren un árbitro. Ambas tienen algo de razón. Tomar partido tiene consecuencias con quien pierda.',
    resolucionesPosibles: ['mediacion', 'tomar_partido', 'ignorar'],
    recompensa: { xpSocial: true },
  },

  cazador_furtivo: {
    refId: 'cazador_furtivo', nombre: 'Un cazador', familia: 'neutro',
    peso: 20, terrenos: ['bosque', 'montana'], peligro: [1, 3],
    apertura: 'Alguien agachado junto a un cepo. Se levanta despacio al notar que lo ves.',
    promptDirector: 'Cazador que no debería estar cazando aquí. Sabe moverse por el terreno y lo cambiará por silencio. En el Bosque Cenizo, denunciarlo agrada al Círculo.',
    resolucionesPosibles: ['dialogo', 'denuncia', 'trato', 'ignorar'],
  },

  campamento_ajeno: {
    refId: 'campamento_ajeno', nombre: 'Un campamento', familia: 'neutro',
    peso: 24, terrenos: ['bosque', 'montana', 'desierto', 'camino'], peligro: [0, 4],
    apertura: 'Ves el humo antes que las tiendas. Hay alguien acampado más adelante.',
    promptDirector: 'Campamento de desconocidos. Pueden ser hospitalarios u hostiles según cómo se acerque el personaje. Acercarse abiertamente es más seguro que espiar.',
    resolucionesPosibles: ['dialogo', 'sigilo', 'rodear', 'combate'],
  },

  peregrino: {
    refId: 'peregrino', nombre: 'Un peregrino', familia: 'neutro',
    peso: 18, terrenos: ['camino', 'montana'], peligro: [0, 2],
    apertura: 'Camina descalzo y sin prisa. Te saluda como si te conociera.',
    promptDirector: 'Peregrino que va a algún sitio importante para él. Habla mucho y sabe cosas raras. Puede ser exactamente lo que parece o no serlo en absoluto.',
    resolucionesPosibles: ['dialogo', 'acompanar', 'ignorar'],
  },

  mensajero: {
    refId: 'mensajero', nombre: 'Un mensajero', familia: 'neutro',
    peso: 16, terrenos: ['camino'], peligro: [0, 3],
    apertura: 'Un jinete se acerca a galope y frena al llegar a tu altura.',
    promptDirector: 'Mensajero con prisa. Lleva noticias de donde viene y las contará por poco. Puede necesitar ayuda si lo persiguen.',
    resolucionesPosibles: ['dialogo', 'ayuda', 'ignorar', 'robo'],
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   ÚTILES
   ═══════════════════════════════════════════════════════════════════════════ */

/** @type {Record<string, Encuentro>} */
export const UTILES = Object.freeze({

  hallazgo: {
    refId: 'hallazgo', nombre: 'Un hallazgo', familia: 'util',
    peso: 30, terrenos: ['bosque', 'ruinas', 'montana', 'desierto', 'pantano'], peligro: [0, 5],
    apertura: 'Algo brilla entre la maleza, medio enterrado.',
    promptDirector: 'Objeto abandonado o perdido. Puede tener dueño, y el dueño puede volver. Examinarlo antes de cogerlo es prudente.',
    resolucionesPosibles: ['recoger', 'examinar', 'ignorar'],
    recompensa: { botin: true, rareza: 'poco_comun' },
  },

  fuente: {
    refId: 'fuente', nombre: 'Agua limpia', familia: 'util',
    peso: 28, terrenos: ['bosque', 'montana', 'desierto'], peligro: [0, 4],
    apertura: 'Oyes agua corriendo antes de verla. Un manantial pequeño entre las rocas.',
    promptDirector: 'Fuente de agua potable. Permite rellenar odres y descansar con seguridad relativa. En el desierto, esto es un hallazgo importante.',
    resolucionesPosibles: ['beber', 'rellenar', 'descansar', 'ignorar'],
    recompensa: { agua: true, descanso: true },
  },

  refugio: {
    refId: 'refugio', nombre: 'Un refugio', familia: 'util',
    peso: 25, terrenos: ['montana', 'bosque', 'ruinas'], peligro: [0, 5],
    apertura: 'Una cavidad en la roca, seca y con restos de una hoguera vieja.',
    promptDirector: 'Refugio natural que permite descansar a cubierto. Alguien lo usó antes y puede volver. Descansar aquí es más seguro que a la intemperie.',
    resolucionesPosibles: ['descansar', 'registrar', 'ignorar'],
    recompensa: { descanso: true, seguro: true },
  },

  ayuda_inesperada: {
    refId: 'ayuda_inesperada', nombre: 'Ayuda inesperada', familia: 'util',
    peso: 15, terrenos: ['camino', 'bosque', 'montana', 'ciudad'], peligro: [0, 3],
    apertura: 'Alguien te reconoce y se acerca sonriendo. Dice que te debe una.',
    promptDirector: 'Alguien a quien el personaje ayudó antes, o que ha oído hablar bien de él. Ofrece algo concreto: información, un objeto o compañía en el camino.',
    resolucionesPosibles: ['aceptar', 'dialogo', 'rechazar'],
    recompensa: { informacion: true, actitud: 20 },
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   CATÁLOGO
   ═══════════════════════════════════════════════════════════════════════════ */

/** Todos los encuentros. */
export const ENCUENTROS = Object.freeze({
  ...HOSTILES,
  ...NEUTROS,
  ...UTILES,
});

/* ═══════════════════════════════════════════════════════════════════════════
   EXPERIENCIA POR RESOLUCIÓN
   ---------------------------------------------------------------------------
   Resolver sin violencia da MÁS que pelear. Es la declaración de intenciones
   más clara del sistema: no premiamos matar.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Experiencia según cómo se resuelva un encuentro. */
export const XP_RESOLUCION = Object.freeze({
  combate: 45,
  intimidacion: 50,
  persuasion: 55,
  mediacion: 60,
  engano: 50,
  soborno: 30,
  dialogo: 35,
  ayuda: 55,
  ritual: 60,
  sigilo: 40,
  huida: 15,
  retirada: 20,
  ignorar: 5,
  distraccion: 45,
  trato: 45,
});

/**
 * Experiencia que otorga una resolución.
 *
 * @param {string} resolucion
 * @param {number} [peligro=1]
 * @returns {number}
 */
export function xpPorResolucion(resolucion, peligro = 1) {
  const base = XP_RESOLUCION[resolucion] ?? 20;
  return Math.round(base * (1 + peligro * 0.15));
}

/* ═══════════════════════════════════════════════════════════════════════════
   SELECCIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Encuentros posibles en un contexto.
 *
 * @param {Object} contexto
 * @param {string} contexto.terreno
 * @param {number} contexto.peligro
 * @param {string} [contexto.familia] Fuerza una familia concreta.
 * @returns {Encuentro[]}
 */
export function candidatos(contexto) {
  const { terreno, peligro = 1, familia } = contexto;

  return Object.values(ENCUENTROS).filter((e) => {
    if (familia && e.familia !== familia) return false;
    if (terreno && !e.terrenos.includes(terreno)) return false;

    const [min, max] = e.peligro;
    return peligro >= min && peligro <= max;
  });
}

/**
 * Elige un encuentro.
 *
 * La proporción entre familias se ajusta al peligro del sitio: en un tramo
 * tranquilo predominan los neutros; en uno peligroso, los hostiles. Pero nunca
 * desaparecen los otros, para que el mundo no se vuelva monótono.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Object} contexto
 * @returns {Encuentro|null}
 */
export function elegir(flujo, contexto) {
  const peligro = contexto.peligro ?? 1;

  // Pesos por familia según el peligro.
  const pesosFamilia = {
    hostil: 20 + peligro * 12,
    neutro: 55 - peligro * 4,
    util: 25 - peligro * 2,
  };

  const familia = flujo.elegirClavePonderada(pesosFamilia);

  let opciones = candidatos({ ...contexto, familia });

  // Si la familia elegida no tiene candidatos aquí, se prueba sin filtro.
  if (!opciones.length) opciones = candidatos(contexto);
  if (!opciones.length) return null;

  return flujo.elegirPonderado(opciones.map((e) => ({ valor: e, peso: e.peso })));
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSULTAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @param {string} refId
 * @returns {Encuentro|null}
 */
export function obtenerEncuentro(refId) {
  return ENCUENTROS[refId] ?? null;
}

/**
 * Comprueba si una resolución es válida para un encuentro.
 *
 * @param {string} refId
 * @param {string} resolucion
 * @returns {boolean}
 */
export function admiteResolucion(refId, resolucion) {
  return Boolean(ENCUENTROS[refId]?.resolucionesPosibles?.includes(resolucion));
}

/**
 * Traduce una intención del jugador a una resolución posible.
 *
 * @param {Object} intencion
 * @param {Encuentro} encuentro
 * @returns {string|null}
 */
export function resolucionDesdeIntencion(intencion, encuentro) {
  if (!intencion || !encuentro) return null;

  const mapa = {
    attack: 'combate',
    intimidate: 'intimidacion',
    persuade: 'persuasion',
    deceive: 'engano',
    negotiate: 'soborno',
    talk: 'dialogo',
    hide: 'sigilo',
    flee: 'huida',
    travel: 'ignorar',
    observe: 'examinar',
    search: 'registrar',
    rest: 'descansar',
  };

  const candidata = mapa[intencion.tipo];
  if (!candidata) return null;

  // Solo se admite si el encuentro la contempla.
  return encuentro.resolucionesPosibles.includes(candidata) ? candidata : null;
}

export default ENCUENTROS;
