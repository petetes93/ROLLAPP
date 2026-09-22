/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · data/statuses.data.js
 * ---------------------------------------------------------------------------
 * Estados alterados.
 *
 * Cada estado declara qué hace, cuánto dura y cómo se quita. Tres categorías
 * de efecto que pueden combinarse en el mismo estado:
 *
 *   · PERIÓDICO — daño o curación al inicio de cada turno del afectado
 *   · MODIFICADOR — cambia tiradas, defensa o daño mientras dura
 *   · RESTRICTIVO — impide acciones concretas
 *
 * `acumulable` importa: el veneno se apila y cada acumulación hace más daño;
 * el aturdimiento no, porque estar aturdido dos veces no significa nada.
 *
 * El campo `salvacion` permite que un estado se sacuda con una tirada al final
 * del turno, en vez de esperar a que expire.
 *
 * Sin dependencias.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * @typedef {Object} Estado
 * @property {string} refId
 * @property {string} nombre
 * @property {string} categoria beneficio|perjuicio|neutro
 * @property {string} familia Para el color en la interfaz.
 * @property {string} descripcion
 * @property {string} narracion Cómo se describe al aplicarse.
 * @property {number} duracion Rondas por defecto.
 * @property {boolean} acumulable
 * @property {number} [acumulacionesMax]
 * @property {Object} [periodico] { dano, tipo, porAcumulacion }
 * @property {Object} [modificadores] Cambios mientras dura.
 * @property {string[]} [impide] Acciones bloqueadas.
 * @property {Object} [salvacion] { atributo, umbral, alFinal }
 * @property {string[]} [inmunizaA] Estados que no pueden aplicarse encima.
 * @property {string} [alExpirar] refId de un estado que lo sustituye.
 */

/** @type {Record<string, Estado>} */
export const ESTADOS = Object.freeze({

  /* ═══════════════════════════════════════════════════════════════════════
     DAÑO PERIÓDICO
     ═══════════════════════════════════════════════════════════════════════ */

  envenenado: {
    refId: 'envenenado',
    nombre: 'Envenenado',
    categoria: 'perjuicio',
    familia: 'veneno',
    descripcion: 'El veneno corre por tus venas. Pierdes vida cada turno y todo te cuesta más.',
    narracion: 'El veneno empieza a hacer efecto.',
    duracion: 4,
    acumulable: true,
    acumulacionesMax: 5,
    periodico: { dano: 2, tipo: 'veneno', porAcumulacion: true },
    modificadores: { todasLasTiradas: -1 },
    salvacion: { atributo: 'temple', umbral: 'moderada', alFinal: true },
  },

  sangrado: {
    refId: 'sangrado',
    nombre: 'Sangrando',
    categoria: 'perjuicio',
    familia: 'sangrado',
    descripcion: 'Una herida abierta que no deja de sangrar.',
    narracion: 'La herida se abre y no para de sangrar.',
    duracion: 3,
    acumulable: true,
    acumulacionesMax: 5,
    periodico: { dano: 3, tipo: 'fisico', porAcumulacion: true },
    // El sangrado se corta con medicina, no con voluntad.
    curableCon: ['medicina', 'venda'],
  },

  ardiendo: {
    refId: 'ardiendo',
    nombre: 'Ardiendo',
    categoria: 'perjuicio',
    familia: 'quemadura',
    descripcion: 'Las llamas te consumen. Duele y distrae.',
    narracion: 'El fuego prende y no se apaga solo.',
    duracion: 3,
    acumulable: true,
    acumulacionesMax: 3,
    periodico: { dano: 4, tipo: 'fuego', porAcumulacion: true },
    modificadores: { concentracion: -3 },
    salvacion: { atributo: 'destreza', umbral: 'facil', alFinal: true },
  },

  congelado: {
    refId: 'congelado',
    nombre: 'Congelado',
    categoria: 'perjuicio',
    familia: 'congelacion',
    descripcion: 'El frío te agarrota. Te mueves más lento y golpeas peor.',
    narracion: 'El frío se te mete en los huesos.',
    duracion: 3,
    acumulable: true,
    acumulacionesMax: 3,
    periodico: { dano: 1, tipo: 'frio', porAcumulacion: false },
    modificadores: { destreza: -2, iniciativa: -3, esquiva: -0.1 },
    // Al acumularse del todo, congela por completo.
    alAcumularMax: 'paralizado',
  },

  /* ═══════════════════════════════════════════════════════════════════════
     RESTRICTIVOS
     ═══════════════════════════════════════════════════════════════════════ */

  aturdido: {
    refId: 'aturdido',
    nombre: 'Aturdido',
    categoria: 'perjuicio',
    familia: 'aturdido',
    descripcion: 'No coordinas. Pierdes tu turno.',
    narracion: 'El golpe te deja sin saber dónde estás.',
    duracion: 1,
    acumulable: false,
    impide: ['atacar', 'lanzar', 'usar_objeto', 'mover'],
    modificadores: { defensa: -3, esquiva: -0.15 },
    salvacion: { atributo: 'temple', umbral: 'moderada', alFinal: true },
  },

  paralizado: {
    refId: 'paralizado',
    nombre: 'Paralizado',
    categoria: 'perjuicio',
    familia: 'aturdido',
    descripcion: 'No puedes moverte. Los ataques contra ti aciertan siempre.',
    narracion: 'Tu cuerpo deja de responder.',
    duracion: 2,
    acumulable: false,
    impide: ['atacar', 'lanzar', 'usar_objeto', 'mover', 'huir'],
    modificadores: { defensa: -6, esquiva: -1, criticoRecibido: true },
    salvacion: { atributo: 'temple', umbral: 'dificil', alFinal: true },
  },

  derribado: {
    refId: 'derribado',
    nombre: 'Derribado',
    categoria: 'perjuicio',
    familia: 'perjuicio',
    descripcion: 'Estás en el suelo. Levantarte cuesta tu turno o parte de él.',
    narracion: 'Pierdes el equilibrio y acabas en el suelo.',
    duracion: 1,
    acumulable: false,
    modificadores: { defensa: -2, ataque: -2, esquiva: -0.1 },
    impide: ['huir'],
  },

  apresado: {
    refId: 'apresado',
    nombre: 'Apresado',
    categoria: 'perjuicio',
    familia: 'perjuicio',
    descripcion: 'Algo te sujeta. No puedes moverte ni huir.',
    narracion: 'Te sujetan y no consigues zafarte.',
    duracion: 99,   // Dura hasta que te sueltas.
    acumulable: false,
    impide: ['mover', 'huir'],
    modificadores: { destreza: -3 },
    salvacion: { atributo: 'vigor', umbral: 'moderada', alFinal: true },
  },

  cegado: {
    refId: 'cegado',
    nombre: 'Cegado',
    categoria: 'perjuicio',
    familia: 'perjuicio',
    descripcion: 'No ves nada. Atacas a ciegas y no puedes esquivar lo que no ves.',
    narracion: 'Todo se vuelve negro.',
    duracion: 2,
    acumulable: false,
    modificadores: { ataque: -5, percepcion: -10, esquiva: -0.2 },
    impide: ['leer'],
    salvacion: { atributo: 'temple', umbral: 'facil', alFinal: true },
  },

  /* ═══════════════════════════════════════════════════════════════════════
     MENTALES
     ═══════════════════════════════════════════════════════════════════════ */

  aterrado: {
    refId: 'aterrado',
    nombre: 'Aterrado',
    categoria: 'perjuicio',
    familia: 'maldicion',
    descripcion: 'El miedo te domina. No puedes acercarte a lo que te aterra.',
    narracion: 'El terror te agarra por dentro.',
    duracion: 3,
    acumulable: false,
    modificadores: { todasLasTiradas: -2, moral: -10 },
    impide: ['acercarse'],
    salvacion: { atributo: 'temple', umbral: 'moderada', alFinal: true },
  },

  dominado: {
    refId: 'dominado',
    nombre: 'Dominado',
    categoria: 'perjuicio',
    familia: 'maldicion',
    descripcion: 'Alguien controla lo que haces. No puedes atacar a quien te domina.',
    narracion: 'Tu voluntad deja de ser tuya.',
    duracion: 3,
    acumulable: false,
    impide: ['atacar_dominador'],
    salvacion: { atributo: 'temple', umbral: 'dificil', alFinal: true },
  },

  enfurecido: {
    refId: 'enfurecido',
    nombre: 'Enfurecido',
    categoria: 'neutro',
    familia: 'perjuicio',
    descripcion: 'La ira te hace pegar más fuerte y defenderte peor.',
    narracion: 'Algo se rompe dentro de ti y ya solo quieres golpear.',
    duracion: 4,
    acumulable: false,
    modificadores: { dano: 4, ataque: 2, defensa: -4, esquiva: -0.1 },
    impide: ['huir', 'negociar'],
  },

  /* ═══════════════════════════════════════════════════════════════════════
     BENEFICIOSOS
     ═══════════════════════════════════════════════════════════════════════ */

  bendecido: {
    refId: 'bendecido',
    nombre: 'Bendecido',
    categoria: 'beneficio',
    familia: 'bendicion',
    descripcion: 'Algo te acompaña. Todo sale un poco mejor.',
    narracion: 'Sientes que algo te respalda.',
    duracion: 5,
    acumulable: false,
    modificadores: { todasLasTiradas: 2 },
  },

  protegido: {
    refId: 'protegido',
    nombre: 'Protegido',
    categoria: 'beneficio',
    familia: 'beneficio',
    descripcion: 'Una barrera absorbe parte del daño que recibes.',
    narracion: 'Una barrera se cierra a tu alrededor.',
    duracion: 4,
    acumulable: false,
    modificadores: { reduccionDano: 3, defensa: 2 },
  },

  acelerado: {
    refId: 'acelerado',
    nombre: 'Acelerado',
    categoria: 'beneficio',
    familia: 'beneficio',
    descripcion: 'Te mueves más rápido que los demás.',
    narracion: 'Todo a tu alrededor parece ir más lento.',
    duracion: 3,
    acumulable: false,
    modificadores: { iniciativa: 5, esquiva: 0.12, ataquesExtra: 1 },
  },

  regenerando: {
    refId: 'regenerando',
    nombre: 'Regenerando',
    categoria: 'beneficio',
    familia: 'bendicion',
    descripcion: 'Tus heridas se cierran solas cada turno.',
    narracion: 'La carne empieza a cerrarse sola.',
    duracion: 4,
    acumulable: false,
    periodico: { dano: -3, tipo: 'curacion', porAcumulacion: false },
  },

  invisible: {
    refId: 'invisible',
    nombre: 'Invisible',
    categoria: 'beneficio',
    familia: 'invisible',
    descripcion: 'Nadie puede verte. Atacar te delata.',
    narracion: 'Dejas de estar a la vista.',
    duracion: 3,
    acumulable: false,
    modificadores: { sigilo: 10, esquiva: 0.25, ventajaAtaque: true },
    // Atacar rompe la invisibilidad: es la contrapartida.
    rompeAl: ['atacar', 'lanzar'],
  },

  concentrado: {
    refId: 'concentrado',
    nombre: 'Concentrado',
    categoria: 'beneficio',
    familia: 'beneficio',
    descripcion: 'Mantienes un efecto activo. Recibir daño puede romperlo.',
    narracion: 'Sostienes el efecto con esfuerzo.',
    duracion: 99,
    acumulable: false,
    // Recibir daño obliga a una prueba para no perder la concentración.
    salvacionAlRecibirDano: { atributo: 'temple', umbralBase: 10 },
  },

  /* ═══════════════════════════════════════════════════════════════════════
     DE AGOTAMIENTO
     ═══════════════════════════════════════════════════════════════════════ */

  exhausto: {
    refId: 'exhausto',
    nombre: 'Exhausto',
    categoria: 'perjuicio',
    familia: 'perjuicio',
    descripcion: 'No te queda nada. Todo cuesta el doble.',
    narracion: 'Las piernas te fallan y te cuesta hasta respirar.',
    duracion: 99,   // Solo se quita descansando.
    acumulable: true,
    acumulacionesMax: 3,
    modificadores: { todasLasTiradas: -3, esquiva: -0.1 },
    soloDescanso: true,
  },

  moribundo: {
    refId: 'moribundo',
    nombre: 'Moribundo',
    categoria: 'perjuicio',
    familia: 'perjuicio',
    descripcion: 'Estás a un paso de morir. Cada turno cuenta.',
    narracion: 'Todo se apaga. Necesitas ayuda ya.',
    duracion: 3,
    acumulable: false,
    impide: ['atacar', 'lanzar', 'mover', 'huir', 'usar_objeto'],
    periodico: { dano: 1, tipo: 'fisico', porAcumulacion: false },
    salvacion: { atributo: 'temple', umbral: 'moderada', alFinal: true },
    alExpirar: null,   // Al expirar sin salvarse, el personaje cae.
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   CONSULTAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @param {string} refId
 * @returns {Estado|null}
 */
export function obtenerEstado(refId) {
  return ESTADOS[refId] ?? null;
}

/**
 * Estados de una categoría.
 * @param {string} categoria
 * @returns {Estado[]}
 */
export function porCategoria(categoria) {
  return Object.values(ESTADOS).filter((e) => e.categoria === categoria);
}

/**
 * Estados que un efecto de curación puede quitar.
 * @param {string} medio 'medicina' | 'antidoto' | 'descanso'
 * @returns {string[]}
 */
export function curablesCon(medio) {
  return Object.values(ESTADOS)
    .filter((e) => e.curableCon?.includes(medio))
    .map((e) => e.refId);
}

/**
 * Traduce el nombre de un estado del SRD al del motor.
 * Lo usa el adaptador al importar criaturas.
 *
 * @param {string} nombre
 * @returns {string|null}
 */
export function traducirEstado(nombre) {
  const mapa = {
    blinded: 'cegado', charmed: 'dominado', frightened: 'aterrado',
    grappled: 'apresado', paralyzed: 'paralizado', poisoned: 'envenenado',
    prone: 'derribado', restrained: 'apresado', stunned: 'aturdido',
    unconscious: 'moribundo', exhaustion: 'exhausto', invisible: 'invisible',
  };
  return mapa[String(nombre).toLowerCase()] ?? null;
}

export default ESTADOS;
