/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · player/Progression.js
 * ---------------------------------------------------------------------------
 * Experiencia, niveles y recompensas de progresión.
 *
 * Un detalle de diseño que conviene entender: `otorgarXP` puede provocar VARIOS
 * niveles de una vez. Una recompensa grande tras un jefe no debe atascarse en
 * el siguiente umbral. La función devuelve todos los niveles ganados y sus
 * recompensas acumuladas, para que el modal de subida los muestre juntos.
 *
 * Funciones puras. Devuelven parches, no mutan.
 *
 * Dependencias: config/balance.config.js, Vitals, Attributes, utils/math.js.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { PROGRESION, VITALES } from '../config/balance.config.js';
import { vidaMaxima, manaMaximo } from './Vitals.js';
import { saturar } from '../utils/math.js';

/* ═══════════════════════════════════════════════════════════════════════════
   UMBRALES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Experiencia acumulada necesaria para alcanzar un nivel.
 * @param {number} nivel
 * @returns {number}
 */
export function xpParaNivel(nivel) {
  const indice = saturar(nivel, PROGRESION.nivelMin, PROGRESION.nivelMax) - 1;
  return PROGRESION.umbralesXP[indice] ?? PROGRESION.umbralesXP.at(-1);
}

/**
 * Nivel correspondiente a una cantidad de experiencia acumulada.
 * @param {number} xp
 * @returns {number}
 */
export function nivelParaXP(xp) {
  let nivel = PROGRESION.nivelMin;
  for (let i = 0; i < PROGRESION.umbralesXP.length; i++) {
    if (xp >= PROGRESION.umbralesXP[i]) nivel = i + 1;
    else break;
  }
  return saturar(nivel, PROGRESION.nivelMin, PROGRESION.nivelMax);
}

/**
 * Progreso dentro del nivel actual, para la barra de experiencia.
 *
 * @param {number} xp
 * @param {number} nivel
 * @returns {{actual: number, necesaria: number, fraccion: number, restante: number, alMaximo: boolean}}
 */
export function progresoNivel(xp, nivel) {
  if (nivel >= PROGRESION.nivelMax) {
    return { actual: 0, necesaria: 0, fraccion: 1, restante: 0, alMaximo: true };
  }

  const base = xpParaNivel(nivel);
  const siguiente = xpParaNivel(nivel + 1);
  const tramo = siguiente - base;
  const dentro = xp - base;

  return {
    actual: dentro,
    necesaria: tramo,
    fraccion: tramo > 0 ? saturar(dentro / tramo, 0, 1) : 0,
    restante: Math.max(0, siguiente - xp),
    alMaximo: false,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONCESIÓN DE EXPERIENCIA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Otorga experiencia y calcula las subidas de nivel resultantes.
 *
 * @param {Object} jugador
 * @param {number} cantidad
 * @param {Object} [contexto]
 * @param {string} [contexto.motivo] Para la bitácora.
 * @param {number} [contexto.dadoVida=8] Dado de vida de la vocación.
 * @param {number} [contexto.manaBase=0] Maná base de la vocación.
 * @returns {{parche: Object, xpGanada: number, nivelesGanados: number[], recompensas: Object, subioNivel: boolean}}
 */
export function otorgarXP(jugador, cantidad, contexto = {}) {
  const { dadoVida = 8, manaBase = 0 } = contexto;

  const xpActual = jugador?.xp ?? 0;
  const nivelActual = jugador?.nivel ?? 1;

  const ganada = Math.max(0, Math.floor(cantidad));
  const xpNueva = xpActual + ganada;
  const nivelNuevo = nivelParaXP(xpNueva);

  const parche = { player: { xp: xpNueva } };
  const nivelesGanados = [];

  const recompensas = {
    puntosTalento: 0,
    puntosHabilidad: 0,
    puntosAtributo: 0,
    vidaGanada: 0,
    manaGanado: 0,
    desbloqueaClaseAvanzada: false,
    desbloqueaEspecializacion: false,
  };

  if (nivelNuevo > nivelActual) {
    // Se acumulan las recompensas de TODOS los niveles ganados, no solo del último.
    for (let n = nivelActual + 1; n <= nivelNuevo; n++) {
      nivelesGanados.push(n);
      recompensas.puntosTalento += PROGRESION.talentosPorNivel;
      if (PROGRESION.talentosExtra.includes(n)) recompensas.puntosTalento += 1;
      recompensas.puntosHabilidad += PROGRESION.habilidadesPorNivel;
      if (PROGRESION.nivelesMejora.includes(n)) recompensas.puntosAtributo += PROGRESION.puntosPorMejora;
      if (n === PROGRESION.nivelClaseAvanzada) recompensas.desbloqueaClaseAvanzada = true;
      if (n === PROGRESION.nivelSegundaEspecializacion) recompensas.desbloqueaEspecializacion = true;
    }

    // Los máximos se recalculan con el nivel nuevo ya aplicado.
    const jugadorFuturo = { ...jugador, nivel: nivelNuevo };
    const vidaMaxNueva = vidaMaxima(jugadorFuturo, dadoVida);
    const manaMaxNuevo = manaMaximo(jugadorFuturo, manaBase);

    recompensas.vidaGanada = vidaMaxNueva - (jugador?.vida?.max ?? 0);
    recompensas.manaGanado = manaMaxNuevo - (jugador?.mana?.max ?? 0);

    parche.player.nivel = nivelNuevo;

    // Subir de nivel cura por completo. Es una convención generosa a propósito:
    // marca el momento y evita el anticlímax de subir y seguir moribundo.
    parche.player.vida = { actual: vidaMaxNueva, max: vidaMaxNueva };
    parche.player.mana = { actual: manaMaxNuevo, max: manaMaxNuevo };

    parche.player.puntosTalento = (jugador?.puntosTalento ?? 0) + recompensas.puntosTalento;
    parche.player.puntosHabilidad = (jugador?.puntosHabilidad ?? 0) + recompensas.puntosHabilidad;
    parche.player.puntosAtributo = (jugador?.puntosAtributo ?? 0) + recompensas.puntosAtributo;

    // Subir de nivel también levanta el ánimo.
    parche.player.moral = saturar(
      (jugador?.moral ?? VITALES.moral.inicial) + VITALES.moral.porVictoria,
      0, VITALES.moral.max,
    );
  }

  return {
    parche,
    xpGanada: ganada,
    nivelesGanados,
    recompensas,
    subioNivel: nivelesGanados.length > 0,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   FUENTES DE EXPERIENCIA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Experiencia por derrotar a un enemigo, con la penalización por diferencia de
 * nivel ya aplicada.
 *
 * @param {string} amenaza Grado de amenaza.
 * @param {number} nivelEnemigo
 * @param {number} nivelJugador
 * @returns {number}
 */
export function xpPorEnemigo(amenaza, nivelEnemigo, nivelJugador) {
  const base = PROGRESION.xpPorAmenaza[amenaza] ?? PROGRESION.xpPorAmenaza.normal;
  const diferencia = nivelJugador - nivelEnemigo;

  // Machacar enemigos muy inferiores deja de compensar.
  if (diferencia >= PROGRESION.umbralPenalizacion) {
    return Math.max(1, Math.floor(base * PROGRESION.penalizacionNivelSuperior));
  }
  return base;
}

/**
 * Experiencia por completar una misión.
 * @param {'menor'|'secundaria'|'principal'|'capitulo'} tipo
 * @returns {number}
 */
export function xpPorMision(tipo) {
  return PROGRESION.xpMision[tipo] ?? PROGRESION.xpMision.menor;
}

/**
 * Experiencia por hitos que no son combate.
 *
 * Existe precisamente para que la vía no violenta compense. Resolver un
 * conflicto hablando da más que un enemigo normal.
 *
 * @param {'descubrimiento'|'social'|'primeraVisita'} tipo
 * @returns {number}
 */
export function xpPorHito(tipo) {
  const mapa = {
    descubrimiento: PROGRESION.xpDescubrimiento,
    social: PROGRESION.xpResolucionSocial,
    primeraVisita: PROGRESION.xpPrimeraVisita,
  };
  return mapa[tipo] ?? PROGRESION.xpDescubrimiento;
}

/* ═══════════════════════════════════════════════════════════════════════════
   GASTO DE PUNTOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Gasta un punto de atributo para subir un valor base.
 *
 * @param {Object} jugador
 * @param {string} clave
 * @param {Object} [contexto] dadoVida y manaBase, para recalcular máximos.
 * @returns {{parche: Object|null, exito: boolean, motivo: string|null}}
 */
export function gastarPuntoAtributo(jugador, clave, contexto = {}) {
  const disponibles = jugador?.puntosAtributo ?? 0;
  if (disponibles <= 0) return { parche: null, exito: false, motivo: 'No te quedan puntos de atributo' };

  const actual = jugador?.atributos?.[clave] ?? 8;
  if (actual >= 20) return { parche: null, exito: false, motivo: 'Ese atributo está al máximo' };

  const parche = {
    player: {
      atributos: { [clave]: actual + 1 },
      puntosAtributo: disponibles - 1,
    },
  };

  // Vigor e Intelecto alteran vida y maná máximos: hay que recalcularlos.
  if (clave === 'vigor' || clave === 'intelecto') {
    const futuro = { ...jugador, atributos: { ...jugador.atributos, [clave]: actual + 1 } };
    const vidaMax = vidaMaxima(futuro, contexto.dadoVida ?? 8);
    const manaMax = manaMaximo(futuro, contexto.manaBase ?? 0);

    parche.player.vida = {
      max: vidaMax,
      actual: saturar((jugador?.vida?.actual ?? 0) + Math.max(0, vidaMax - (jugador?.vida?.max ?? 0)), 0, vidaMax),
    };
    parche.player.mana = {
      max: manaMax,
      actual: saturar((jugador?.mana?.actual ?? 0) + Math.max(0, manaMax - (jugador?.mana?.max ?? 0)), 0, manaMax),
    };
  }

  return { parche, exito: true, motivo: null };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSULTAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Estado de progresión, para el panel de personaje.
 * @param {Object} jugador
 * @returns {Object}
 */
export function resumenProgresion(jugador) {
  const nivel = jugador?.nivel ?? 1;
  const xp = jugador?.xp ?? 0;
  const p = progresoNivel(xp, nivel);

  return {
    nivel,
    xp,
    xpEnNivel: p.actual,
    xpParaSiguiente: p.necesaria,
    fraccion: p.fraccion,
    restante: p.restante,
    alMaximo: p.alMaximo,
    puntosPendientes: {
      talento: jugador?.puntosTalento ?? 0,
      habilidad: jugador?.puntosHabilidad ?? 0,
      atributo: jugador?.puntosAtributo ?? 0,
    },
    hayPendientes:
      (jugador?.puntosTalento ?? 0) + (jugador?.puntosHabilidad ?? 0) + (jugador?.puntosAtributo ?? 0) > 0,
  };
}

/**
 * Bonificador de competencia derivado del nivel. Escala cada cuatro niveles.
 * @param {number} nivel
 * @returns {number}
 */
export function bonoNivel(nivel) {
  return 2 + Math.floor((saturar(nivel, 1, 20) - 1) / 4);
}

export default {
  xpParaNivel,
  nivelParaXP,
  progresoNivel,
  otorgarXP,
  xpPorEnemigo,
  xpPorMision,
  xpPorHito,
  gastarPuntoAtributo,
  resumenProgresion,
  bonoNivel,
};
