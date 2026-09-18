/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · quests/Quest.js
 * ---------------------------------------------------------------------------
 * Modelo de misión.
 *
 * Una misión atraviesa cinco estados y solo algunos caminos entre ellos son
 * legales. Que las transiciones estén declaradas evita que el director pueda
 * completar una misión que el jugador nunca aceptó, o reabrir una fracasada.
 *
 *   ofrecida → aceptada → completada
 *      ↓          ↓
 *   rechazada  fracasada
 *
 * Tres decisiones de diseño:
 *
 *   · LAS MISIONES CADUCAN. Algunas tienen plazo, y dejarlo pasar las hace
 *     fracasar. Sin eso, el jugador acumula encargos indefinidamente y ninguno
 *     transmite urgencia.
 *
 *   · FRACASAR NO ES UN CALLEJÓN. Una misión fallida deja consecuencias —peor
 *     actitud de quien la encargó, reputación tocada— pero el juego sigue.
 *
 *   · LA RECOMPENSA SE FIJA AL ACEPTAR. Se calcula al ofrecerla y se congela,
 *     para que subir de nivel a mitad de misión no infle el pago.
 *
 * Funciones puras.
 *
 * Dependencias: Objective, utils.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as Obj from './Objective.js';
import { idEntidad, TIPO } from '../utils/id.js';
import { truncar } from '../utils/text.js';

/* ═══════════════════════════════════════════════════════════════════════════
   ESTADOS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Estados posibles de una misión. */
export const ESTADO = Object.freeze({
  OFRECIDA: 'ofrecida',
  ACEPTADA: 'aceptada',
  COMPLETADA: 'completada',
  FRACASADA: 'fracasada',
  RECHAZADA: 'rechazada',
});

/**
 * Transiciones permitidas.
 *
 * Declararlas explícitamente es lo que impide que el director complete una
 * misión que nunca se aceptó, o que resucite una fracasada.
 */
export const TRANSICIONES = Object.freeze({
  [ESTADO.OFRECIDA]: [ESTADO.ACEPTADA, ESTADO.RECHAZADA],
  [ESTADO.ACEPTADA]: [ESTADO.COMPLETADA, ESTADO.FRACASADA],
  [ESTADO.COMPLETADA]: [],
  [ESTADO.FRACASADA]: [],
  [ESTADO.RECHAZADA]: [ESTADO.OFRECIDA],   // Puede volver a ofrecerse.
});

/** Tipos de misión, con su peso narrativo. */
export const TIPOS = Object.freeze({
  principal: { nombre: 'principal', peso: 3, multiplicadorRecompensa: 2 },
  secundaria: { nombre: 'secundaria', peso: 2, multiplicadorRecompensa: 1 },
  menor: { nombre: 'encargo', peso: 1, multiplicadorRecompensa: 0.6 },
});

/* ═══════════════════════════════════════════════════════════════════════════
   CREACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Mision
 * @property {string} refId
 * @property {string} titulo
 * @property {string} resumen
 * @property {string} tipo principal|secundaria|menor
 * @property {string} estado
 * @property {Array<import('./Objective.js').Objetivo>} objetivos
 * @property {Object} recompensa
 * @property {string} [origen] refId del PNJ o evento que la generó.
 * @property {string} [faccion] Facción interesada.
 * @property {number} [plazoDias] Días para completarla.
 * @property {number} [turnoAceptada]
 * @property {number} [diaLimite]
 * @property {string} promptDirector Contexto para narrarla.
 */

/**
 * Crea una misión.
 *
 * @param {Object} datos
 * @returns {Mision}
 */
export function crear(datos) {
  const tipo = TIPOS[datos.tipo] ? datos.tipo : 'secundaria';

  return {
    refId: datos.refId ?? idEntidad(TIPO.MISION),
    titulo: truncar(datos.titulo ?? 'Un encargo', 80),
    resumen: truncar(datos.resumen ?? '', 400),
    tipo,
    estado: datos.estado ?? ESTADO.OFRECIDA,

    objetivos: (datos.objetivos ?? []).map((o) => Obj.crear(o)),

    recompensa: {
      xp: datos.recompensa?.xp ?? 0,
      oro: datos.recompensa?.oro ?? 0,
      objetos: datos.recompensa?.objetos ?? [],
      reputacion: datos.recompensa?.reputacion ?? null,
      actitud: datos.recompensa?.actitud ?? 15,
    },

    // ─── Origen y contexto ────────────────────────────────────────────────
    origen: datos.origen ?? null,
    nombreOrigen: datos.nombreOrigen ?? null,
    faccion: datos.faccion ?? null,
    lugar: datos.lugar ?? null,

    // ─── Plazo ────────────────────────────────────────────────────────────
    plazoDias: datos.plazoDias ?? null,
    diaLimite: datos.diaLimite ?? null,

    // ─── Seguimiento ──────────────────────────────────────────────────────
    turnoOferta: datos.turnoOferta ?? null,
    turnoAceptada: datos.turnoAceptada ?? null,
    turnoCierre: datos.turnoCierre ?? null,

    promptDirector: datos.promptDirector ?? datos.resumen ?? '',
    consecuenciaFracaso: datos.consecuenciaFracaso ?? null,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   TRANSICIONES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Comprueba si una transición es legal.
 *
 * @param {Mision} mision
 * @param {string} nuevoEstado
 * @returns {boolean}
 */
export function puedeTransicionar(mision, nuevoEstado) {
  return (TRANSICIONES[mision.estado] ?? []).includes(nuevoEstado);
}

/**
 * Acepta una misión.
 *
 * @param {Mision} mision
 * @param {Object} contexto
 * @param {number} contexto.turno
 * @param {number} contexto.dia
 * @returns {{mision: Mision, aceptada: boolean, motivo: string|null}}
 */
export function aceptar(mision, contexto) {
  if (!puedeTransicionar(mision, ESTADO.ACEPTADA)) {
    return { mision, aceptada: false, motivo: 'Esa misión no está disponible.' };
  }

  // El plazo empieza a contar ahora, no cuando se ofreció.
  const diaLimite = mision.plazoDias
    ? contexto.dia + mision.plazoDias
    : null;

  return {
    mision: {
      ...mision,
      estado: ESTADO.ACEPTADA,
      turnoAceptada: contexto.turno,
      diaLimite,
    },
    aceptada: true,
    motivo: null,
  };
}

/**
 * Rechaza una misión ofrecida.
 *
 * @param {Mision} mision
 * @returns {{mision: Mision, rechazada: boolean}}
 */
export function rechazar(mision) {
  if (!puedeTransicionar(mision, ESTADO.RECHAZADA)) {
    return { mision, rechazada: false };
  }

  return { mision: { ...mision, estado: ESTADO.RECHAZADA }, rechazada: true };
}

/**
 * Completa una misión.
 *
 * @param {Mision} mision
 * @param {Object} contexto
 * @param {boolean} [contexto.forzar=false] Ignora los objetivos pendientes.
 * @returns {{mision: Mision, completada: boolean, motivo: string|null}}
 */
export function completar(mision, contexto = {}) {
  if (!puedeTransicionar(mision, ESTADO.COMPLETADA)) {
    return { mision, completada: false, motivo: 'Esa misión no está en curso.' };
  }

  // Sin forzar, hacen falta todos los objetivos obligatorios.
  if (!contexto.forzar && !Obj.todosCumplidos(mision.objetivos)) {
    const pendiente = Obj.siguiente(mision.objetivos);

    return {
      mision,
      completada: false,
      motivo: pendiente ? `Todavía falta: ${pendiente.texto}` : 'Aún no está terminada.',
    };
  }

  return {
    mision: {
      ...mision,
      estado: ESTADO.COMPLETADA,
      turnoCierre: contexto.turno ?? null,
      // Los objetivos obligatorios se cierran; los opcionales conservan su
      // estado, porque determinan la recompensa extra.
      objetivos: mision.objetivos.map((o) => (o.opcional ? o : Obj.completar(o))),
    },
    completada: true,
    motivo: null,
  };
}

/**
 * Hace fracasar una misión.
 *
 * @param {Mision} mision
 * @param {string} motivo
 * @param {Object} [contexto]
 * @returns {{mision: Mision, fracasada: boolean}}
 */
export function fracasar(mision, motivo, contexto = {}) {
  if (!puedeTransicionar(mision, ESTADO.FRACASADA)) {
    return { mision, fracasada: false };
  }

  return {
    mision: {
      ...mision,
      estado: ESTADO.FRACASADA,
      turnoCierre: contexto.turno ?? null,
      motivoFracaso: motivo,
    },
    fracasada: true,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROGRESO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Propaga un evento del motor a los objetivos de la misión.
 *
 * @param {Mision} mision
 * @param {string} tipoEvento
 * @param {Object} datos
 * @returns {{mision: Mision, avanzados: Array<Object>, listaParaCerrar: boolean}}
 */
export function propagarEvento(mision, tipoEvento, datos) {
  if (mision.estado !== ESTADO.ACEPTADA) {
    return { mision, avanzados: [], listaParaCerrar: false };
  }

  const avanzados = [];
  let cambio = false;

  let objetivos = mision.objetivos.map((o) => {
    const delta = Obj.evaluarEvento(o, tipoEvento, datos);
    if (delta === 0) return o;

    const r = Obj.avanzar(o, delta);
    if (!r.avanzo) return o;

    cambio = true;
    avanzados.push({
      id: o.id,
      texto: o.texto,
      completado: r.completado,
      progreso: r.objetivo.progreso,
      cantidad: r.objetivo.cantidad,
    });

    return r.objetivo;
  });

  if (!cambio) return { mision, avanzados: [], listaParaCerrar: false };

  // Un objetivo cumplido puede revelar otro oculto.
  objetivos = _revelarEncadenados(objetivos, avanzados);

  return {
    mision: { ...mision, objetivos },
    avanzados,
    listaParaCerrar: Obj.todosCumplidos(objetivos),
  };
}

/**
 * Revela los objetivos que dependían de otros ya cumplidos.
 * @private
 */
function _revelarEncadenados(objetivos, avanzados) {
  const completados = new Set(avanzados.filter((a) => a.completado).map((a) => a.id));
  if (!completados.size) return objetivos;

  // El campo revelaA de un objetivo cumplido desvela al que apunta.
  const aRevelar = new Set();

  for (const o of objetivos) {
    if (completados.has(o.id) && o.revelaA) aRevelar.add(o.revelaA);
  }

  if (!aRevelar.size) return objetivos;

  return objetivos.map((o) => (aRevelar.has(o.id) ? Obj.revelar(o) : o));
}

/**
 * Sincroniza los objetivos de recogida con el inventario.
 *
 * @param {Mision} mision
 * @param {Function} contarEnInventario
 * @returns {{mision: Mision, cambio: boolean, listaParaCerrar: boolean}}
 */
export function sincronizarInventario(mision, contarEnInventario) {
  if (mision.estado !== ESTADO.ACEPTADA) {
    return { mision, cambio: false, listaParaCerrar: false };
  }

  let cambio = false;

  const objetivos = mision.objetivos.map((o) => {
    const r = Obj.sincronizarRecogida(o, contarEnInventario);
    if (r.cambio) cambio = true;
    return r.objetivo;
  });

  if (!cambio) return { mision, cambio: false, listaParaCerrar: false };

  return {
    mision: { ...mision, objetivos },
    cambio: true,
    listaParaCerrar: Obj.todosCumplidos(objetivos),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PLAZOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Comprueba el estado del plazo.
 *
 * @param {Mision} mision
 * @param {number} diaActual
 * @returns {{tienePlazo: boolean, diasRestantes: number|null, vencido: boolean, urgente: boolean}}
 */
export function estadoPlazo(mision, diaActual) {
  if (!mision.diaLimite) {
    return { tienePlazo: false, diasRestantes: null, vencido: false, urgente: false };
  }

  const restantes = mision.diaLimite - diaActual;

  return {
    tienePlazo: true,
    diasRestantes: restantes,
    vencido: restantes < 0,
    // Con dos días o menos conviene avisar.
    urgente: restantes >= 0 && restantes <= 2,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   RECOMPENSA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Calcula la recompensa efectiva, con los extras de los objetivos opcionales.
 *
 * @param {Mision} mision
 * @returns {{xp: number, oro: number, objetos: Array<Object>, extra: boolean}}
 */
export function recompensaEfectiva(mision) {
  const base = mision.recompensa;

  // Los opcionales cumplidos suben la recompensa a medias.
  const opcionales = mision.objetivos.filter((o) => o.opcional);
  const cumplidos = opcionales.filter((o) => o.hecho).length;

  const bono = opcionales.length > 0 ? cumplidos / opcionales.length : 0;
  const factor = 1 + bono * 0.5;

  return {
    xp: Math.round(base.xp * factor),
    oro: Math.round(base.oro * factor),
    objetos: base.objetos,
    reputacion: base.reputacion,
    actitud: base.actitud,
    extra: cumplidos > 0,
    opcionalesCumplidos: cumplidos,
    opcionalesTotales: opcionales.length,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESENTACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Fracción de progreso de la misión.
 * @param {Mision} mision
 * @returns {number}
 */
export function fraccion(mision) {
  const obligatorios = mision.objetivos.filter((o) => !o.opcional && !o.oculto);
  if (!obligatorios.length) return 0;

  const suma = obligatorios.reduce((a, o) => a + Obj.fraccion(o), 0);
  return suma / obligatorios.length;
}

/**
 * Datos de la misión para la interfaz.
 *
 * @param {Mision} mision
 * @param {number} [diaActual]
 * @returns {Object}
 */
export function paraInterfaz(mision, diaActual = 0) {
  const plazo = estadoPlazo(mision, diaActual);

  return {
    refId: mision.refId,
    titulo: mision.titulo,
    resumen: mision.resumen,
    tipo: mision.tipo,
    estado: mision.estado,
    objetivos: Obj.visibles(mision.objetivos).map((o) => Obj.paraInterfaz(o)),
    fraccion: fraccion(mision),
    recompensa: recompensaEfectiva(mision),
    origen: mision.nombreOrigen,
    plazo,
    siguiente: Obj.siguiente(mision.objetivos)?.texto ?? null,
  };
}

/**
 * Descripción de la misión para el director.
 *
 * @param {Mision} mision
 * @param {number} [diaActual]
 * @returns {string}
 */
export function paraDirector(mision, diaActual = 0) {
  const partes = [`«${mision.titulo}»`];

  if (mision.promptDirector) partes.push(mision.promptDirector);

  const pendientes = Obj.visibles(mision.objetivos)
    .filter((o) => !o.hecho)
    .map((o) => Obj.etiqueta(o));

  if (pendientes.length) {
    partes.push(`Falta: ${pendientes.join('; ')}.`);
  } else {
    partes.push('Está terminada y falta cobrarla.');
  }

  const plazo = estadoPlazo(mision, diaActual);
  if (plazo.urgente) {
    partes.push(`Quedan ${plazo.diasRestantes} días de plazo: conviene que se note la prisa.`);
  }

  if (mision.nombreOrigen) partes.push(`La encargó ${mision.nombreOrigen}.`);

  return partes.join(' ');
}

/* ═══════════════════════════════════════════════════════════════════════════
   DESDE EL DIRECTOR
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Construye una misión a partir de lo que declara el director.
 *
 * @param {Object} propuesta Entrada del campo `quests` del JSON.
 * @param {Object} contexto
 * @returns {Mision}
 */
export function desdeDirector(propuesta, contexto = {}) {
  return crear({
    refId: propuesta.id,
    titulo: propuesta.title,
    resumen: propuesta.summary,
    tipo: propuesta.tipo,
    objetivos: (propuesta.objectives ?? []).map((o) => Obj.desdeDirector(o)),
    recompensa: {
      xp: propuesta.reward?.xp ?? 0,
      oro: propuesta.reward?.gold ?? 0,
      objetos: propuesta.reward?.items ?? [],
    },
    origen: contexto.origen,
    nombreOrigen: contexto.nombreOrigen,
    faccion: contexto.faccion,
    lugar: contexto.lugar,
    turnoOferta: contexto.turno,
    promptDirector: propuesta.summary,
  });
}

export default {
  ESTADO,
  TRANSICIONES,
  TIPOS,
  crear,
  puedeTransicionar,
  aceptar,
  rechazar,
  completar,
  fracasar,
  propagarEvento,
  sincronizarInventario,
  estadoPlazo,
  recompensaEfectiva,
  fraccion,
  paraInterfaz,
  paraDirector,
  desdeDirector,
};
