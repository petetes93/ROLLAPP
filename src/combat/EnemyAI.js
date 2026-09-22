/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · combat/EnemyAI.js
 * ---------------------------------------------------------------------------
 * Decisiones de los enemigos en combate.
 *
 * Cada criatura declara una `tactica` en el bestiario, y aquí se traduce en
 * comportamiento. Un lobo rodea y muerde al más débil; un guardia aguanta la
 * línea; un asesino golpea y desaparece.
 *
 * Que las tácticas sean datos y no código tiene un efecto práctico: añadir una
 * criatura nueva al bestiario no obliga a tocar este archivo. Solo hay que
 * elegirle una de las tácticas existentes.
 *
 * Las decisiones tienen algo de ruido deliberado. Una IA perfecta que siempre
 * elige la jugada óptima resulta desagradable de enfrentar: los enemigos deben
 * ser competentes, no infalibles.
 *
 * Funciones puras.
 *
 * Dependencias: Combatant, StatusEffects, balance.config.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as Comb from './Combatant.js';
import * as Estados from './StatusEffects.js';
import { COMBATE } from '../config/balance.config.js';

/* ═══════════════════════════════════════════════════════════════════════════
   TÁCTICAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Tactica
 * @property {string} nombre
 * @property {string} descripcion
 * @property {string} prioridadObjetivo
 * @property {number} agresividad 0-1: cuánto prioriza atacar sobre protegerse.
 * @property {number} coordinacion 0-1: cuánto tiene en cuenta a sus aliados.
 * @property {boolean} usaEspeciales Si reserva los ataques con recarga.
 */

/** @type {Record<string, Tactica>} */
export const TACTICAS = Object.freeze({
  agresivo: {
    nombre: 'Agresivo',
    descripcion: 'Ataca al más cercano sin pensarlo mucho.',
    prioridadObjetivo: 'cualquiera',
    agresividad: 1,
    coordinacion: 0.2,
    usaEspeciales: true,
  },

  manada: {
    nombre: 'Manada',
    descripcion: 'Se centra en el objetivo más débil y coordina con los suyos.',
    prioridadObjetivo: 'mas_debil',
    agresividad: 0.9,
    coordinacion: 0.9,
    usaEspeciales: true,
  },

  enjambre: {
    nombre: 'Enjambre',
    descripcion: 'Ataca en masa sin criterio, pero abruma por número.',
    prioridadObjetivo: 'mismo_que_aliados',
    agresividad: 1,
    coordinacion: 0.6,
    usaEspeciales: false,
  },

  cobarde: {
    nombre: 'Cobarde',
    descripcion: 'Solo ataca si tiene ventaja. Huye en cuanto se complica.',
    prioridadObjetivo: 'mas_debil',
    agresividad: 0.4,
    coordinacion: 0.3,
    usaEspeciales: false,
  },

  oportunista: {
    nombre: 'Oportunista',
    descripcion: 'Busca al herido y evita al que está entero.',
    prioridadObjetivo: 'mas_herido',
    agresividad: 0.7,
    coordinacion: 0.4,
    usaEspeciales: true,
  },

  disciplinado: {
    nombre: 'Disciplinado',
    descripcion: 'Mantiene la posición y usa sus recursos con cabeza.',
    prioridadObjetivo: 'mayor_amenaza',
    agresividad: 0.7,
    coordinacion: 0.8,
    usaEspeciales: true,
  },

  acechador: {
    nombre: 'Acechador',
    descripcion: 'Golpea a quien está aislado y se retira.',
    prioridadObjetivo: 'mas_debil',
    agresividad: 0.8,
    coordinacion: 0.1,
    usaEspeciales: true,
  },

  controlador: {
    nombre: 'Controlador',
    descripcion: 'Prioriza inmovilizar y debilitar antes que hacer daño.',
    prioridadObjetivo: 'mayor_amenaza',
    agresividad: 0.5,
    coordinacion: 0.7,
    usaEspeciales: true,
    prefiereEstados: true,
  },

  metodico: {
    nombre: 'Metódico',
    descripcion: 'Elimina objetivos de uno en uno, sin desperdiciar nada.',
    prioridadObjetivo: 'mas_herido',
    agresividad: 0.85,
    coordinacion: 0.5,
    usaEspeciales: true,
  },

  asesino: {
    nombre: 'Asesino',
    descripcion: 'Busca el golpe letal. Si su objetivo cae, se marcha.',
    prioridadObjetivo: 'mas_debil',
    agresividad: 0.95,
    coordinacion: 0.2,
    usaEspeciales: true,
    abandonaTrasObjetivo: true,
  },

  inteligente: {
    nombre: 'Inteligente',
    descripcion: 'Evalúa la situación y actúa en consecuencia.',
    prioridadObjetivo: 'mayor_amenaza',
    agresividad: 0.75,
    coordinacion: 0.85,
    usaEspeciales: true,
  },

  jefe_fases: {
    nombre: 'Jefe',
    descripcion: 'Cambia de comportamiento según su estado.',
    prioridadObjetivo: 'mayor_amenaza',
    agresividad: 0.8,
    coordinacion: 0.9,
    usaEspeciales: true,
  },

  jefe_invocador: {
    nombre: 'Jefe invocador',
    descripcion: 'Llama refuerzos y deja que peleen por él.',
    prioridadObjetivo: 'mayor_amenaza',
    agresividad: 0.6,
    coordinacion: 1,
    usaEspeciales: true,
    invoca: true,
  },

  jugador: {
    nombre: 'Jugador',
    descripcion: 'Controlado por la persona.',
    prioridadObjetivo: 'manual',
    agresividad: 0,
    coordinacion: 0,
    usaEspeciales: false,
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   DECISIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Decide qué hace un enemigo en su turno.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Object} opciones
 * @param {Object} opciones.actor Combatiente que decide.
 * @param {Object} opciones.combatientes Mapa completo.
 * @param {number} opciones.ronda
 * @param {Array<Object>} [opciones.historial] Últimas acciones, para coordinar.
 * @returns {{accion: string, objetivo: string|null, objetivos: string[], ataque: Object|null, motivo: string}}
 */
export function decidir(flujo, opciones) {
  const { actor, combatientes, ronda, historial = [] } = opciones;

  const tactica = TACTICAS[actor.tactica] ?? TACTICAS.agresivo;

  // ─── ¿Puede hacer algo? ─────────────────────────────────────────────────
  if (!Comb.puede(actor, 'atacar').puede) {
    // Si no puede atacar pero sí moverse, retrocede.
    if (Comb.puede(actor, 'mover').puede) {
      return { accion: 'retroceder', objetivo: null, objetivos: [], ataque: null, motivo: 'no puede atacar' };
    }
    return { accion: 'nada', objetivo: null, objetivos: [], ataque: null, motivo: 'incapacitado' };
  }

  // ─── ¿Debería huir? ─────────────────────────────────────────────────────
  if (_evaluarHuida(flujo, actor, combatientes, tactica)) {
    return { accion: 'huir', objetivo: null, objetivos: [], ataque: null, motivo: 'malherido' };
  }

  // ─── ¿Invoca refuerzos? ─────────────────────────────────────────────────
  if (tactica.invoca && _tocaInvocar(actor, combatientes, ronda)) {
    return { accion: 'invocar', objetivo: null, objetivos: [], ataque: null, motivo: 'refuerzos' };
  }

  // ─── Elegir objetivo ────────────────────────────────────────────────────
  const candidatos = Object.values(combatientes)
    .filter((c) => c.vivo && c.bando !== actor.bando && c.bando !== Comb.BANDO.NEUTRAL);

  if (!candidatos.length) {
    return { accion: 'nada', objetivo: null, objetivos: [], ataque: null, motivo: 'sin objetivos' };
  }

  const objetivo = _elegirObjetivo(flujo, actor, candidatos, tactica, historial);

  // ─── Elegir ataque ──────────────────────────────────────────────────────
  const disponibles = Comb.ataquesDisponibles(actor, ronda);

  if (!disponibles.length) {
    return { accion: 'esperar', objetivo: objetivo.id, objetivos: [], ataque: null, motivo: 'sin ataques listos' };
  }

  const ataque = _elegirAtaque(flujo, actor, objetivo, disponibles, tactica, candidatos);

  // ─── Ataques de área: se recogen todos los afectados ────────────────────
  if (ataque.area) {
    return {
      accion: 'atacar_area',
      objetivo: objetivo.id,
      objetivos: candidatos.map((c) => c.id),
      ataque,
      motivo: `área con ${ataque.nombre}`,
    };
  }

  return {
    accion: 'atacar',
    objetivo: objetivo.id,
    objetivos: [objetivo.id],
    ataque,
    motivo: `${ataque.nombre} contra ${objetivo.nombre}`,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   ELECCIÓN DE OBJETIVO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Elige a quién atacar según la táctica.
 *
 * Se introduce ruido deliberado: incluso una táctica que prioriza al más débil
 * ataca a veces a otro. Un enemigo que siempre hace la jugada óptima resulta
 * desagradable.
 *
 * @private
 */
function _elegirObjetivo(flujo, actor, candidatos, tactica, historial) {
  // Un 20 % de las veces se elige al azar: es el ruido que hace creíble a la IA.
  if (flujo.oportunidad(0.2)) return flujo.elegir(candidatos);

  switch (tactica.prioridadObjetivo) {
    case 'mas_debil':
      // Menos vida absoluta: el que caerá antes.
      return [...candidatos].sort((a, b) => a.vida.actual - b.vida.actual)[0];

    case 'mas_herido':
      // Menor fracción de vida: el que está peor en proporción.
      return [...candidatos].sort((a, b) => Comb.fraccionVida(a) - Comb.fraccionVida(b))[0];

    case 'mayor_amenaza':
      return [...candidatos].sort((a, b) => _amenaza(b) - _amenaza(a))[0];

    case 'mismo_que_aliados': {
      // Se concentra en el mismo objetivo que los suyos: es lo que hace
      // peligroso a un enjambre.
      const ultimo = historial
        .slice(-3)
        .reverse()
        .find((h) => h.objetivo && candidatos.some((c) => c.id === h.objetivo));

      if (ultimo) {
        const encontrado = candidatos.find((c) => c.id === ultimo.objetivo);
        if (encontrado) return encontrado;
      }
      return flujo.elegir(candidatos);
    }

    default:
      return flujo.elegir(candidatos);
  }
}

/**
 * Estima cuánta amenaza representa un combatiente.
 *
 * No es una medida objetiva de poder, sino de lo peligroso que resulta dejarlo
 * actuar: alguien con mucha vida y mucho daño es prioritario.
 *
 * @private
 */
function _amenaza(c) {
  let puntos = 0;

  puntos += (c.nivel ?? 1) * 2;
  puntos += Comb.fraccionVida(c) * 10;

  // El daño potencial de sus ataques.
  const mejorAtaque = (c.ataques ?? []).reduce((max, a) => {
    const bono = a.bonoDano ?? a.bonoAtaque ?? 0;
    return Math.max(max, bono);
  }, 0);
  puntos += mejorAtaque;

  // Quien está incapacitado deja de ser una amenaza inmediata.
  if (!Comb.puede(c, 'atacar').puede) puntos -= 15;

  return puntos;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ELECCIÓN DE ATAQUE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Elige qué ataque usar.
 * @private
 */
function _elegirAtaque(flujo, actor, objetivo, disponibles, tactica, todosLosObjetivos) {
  // Sin ataques especiales disponibles, no hay que decidir nada.
  const especiales = disponibles.filter((a) => a.recarga || a.area);
  const basicos = disponibles.filter((a) => !a.recarga && !a.area);

  if (!especiales.length) return flujo.elegir(basicos) ?? disponibles[0];
  if (!tactica.usaEspeciales) return flujo.elegir(basicos) ?? disponibles[0];

  // ─── Un ataque de área compensa si hay varios objetivos ────────────────
  const deArea = especiales.filter((a) => a.area);

  if (deArea.length && todosLosObjetivos.length >= 2) {
    // Con dos o más objetivos, el área es claramente mejor.
    if (flujo.oportunidad(0.8)) return flujo.elegir(deArea);
  }

  // ─── Los controladores prefieren estados ───────────────────────────────
  if (tactica.prefiereEstados) {
    const conEstado = especiales.filter((a) => a.estado);

    // No tiene sentido volver a aplicar un estado que el objetivo ya tiene.
    const utiles = conEstado.filter((a) => {
      const refId = a.estado?.refId;
      return refId && !Estados.tiene(objetivo, refId);
    });

    if (utiles.length && flujo.oportunidad(0.7)) return flujo.elegir(utiles);
  }

  // ─── Un objetivo casi muerto pide el golpe más fuerte ──────────────────
  if (Comb.fraccionVida(objetivo) < 0.25) {
    const masFuerte = [...disponibles].sort((a, b) => _potencial(b) - _potencial(a))[0];
    if (flujo.oportunidad(0.7)) return masFuerte;
  }

  // ─── Decisión general, ponderada por agresividad ───────────────────────
  const usaEspecial = flujo.oportunidad(tactica.agresividad * 0.6);

  if (usaEspecial && especiales.length) return flujo.elegir(especiales);

  return flujo.elegir(basicos) ?? flujo.elegir(disponibles);
}

/**
 * Estima el daño potencial de un ataque, para comparar.
 * @private
 */
function _potencial(ataque) {
  const notacion = ataque.dano ?? '1d4';
  const m = String(notacion).match(/^(\d*)d(\d+)([+-]\d+)?$/);

  if (!m) return 0;

  const cantidad = m[1] ? parseInt(m[1], 10) : 1;
  const caras = parseInt(m[2], 10);
  const mod = m[3] ? parseInt(m[3], 10) : 0;

  // Media del dado más el modificador.
  return cantidad * ((caras + 1) / 2) + mod + (ataque.bonoDano ?? 0);
}

/* ═══════════════════════════════════════════════════════════════════════════
   HUIDA E INVOCACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Decide si un enemigo intenta huir.
 * @private
 */
function _evaluarHuida(flujo, actor, combatientes, tactica) {
  if (!Comb.deberiaHuir(actor)) {
    // Un cobarde huye también si se queda solo, aunque esté entero.
    if (tactica.nombre === 'Cobarde') {
      const aliados = Object.values(combatientes)
        .filter((c) => c.vivo && c.bando === actor.bando && c.id !== actor.id);

      if (!aliados.length && flujo.oportunidad(0.6)) return true;
    }
    return false;
  }

  // Incluso al límite, huir no es automático: hay quien pelea hasta el final.
  const probabilidad = 1 - tactica.agresividad * 0.5;
  return flujo.oportunidad(probabilidad);
}

/**
 * Determina si toca invocar refuerzos.
 * @private
 */
function _tocaInvocar(actor, combatientes, ronda) {
  const config = actor.invoca;
  if (!config) return false;

  // Periodicidad.
  const cada = config.cadaRondas ?? 4;
  if (ronda % cada !== 0) return false;

  // Tope de invocados vivos.
  const invocados = Object.values(combatientes)
    .filter((c) => c.vivo && c.invocadoPor === actor.id).length;

  return invocados < (config.maximo ?? 4);
}

/* ═══════════════════════════════════════════════════════════════════════════
   COORDINACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Ajusta la decisión teniendo en cuenta lo que han hecho los aliados.
 *
 * Es lo que convierte a un grupo de enemigos en un grupo, y no en varios
 * enemigos actuando por separado.
 *
 * @param {Object} decision
 * @param {Object} actor
 * @param {Array<Object>} historialRonda Acciones de esta ronda.
 * @returns {Object}
 */
export function coordinar(decision, actor, historialRonda) {
  const tactica = TACTICAS[actor.tactica] ?? TACTICAS.agresivo;

  if (tactica.coordinacion < 0.5) return decision;
  if (decision.accion !== 'atacar') return decision;

  // Si un aliado ya dejó a alguien casi muerto, se remata.
  const casiMuerto = historialRonda
    .slice()
    .reverse()
    .find((h) => h.objetivoFraccionVida !== undefined && h.objetivoFraccionVida < 0.2);

  if (casiMuerto?.objetivo && casiMuerto.objetivo !== decision.objetivo) {
    return {
      ...decision,
      objetivo: casiMuerto.objetivo,
      objetivos: [casiMuerto.objetivo],
      motivo: `${decision.motivo} (rematando)`,
    };
  }

  return decision;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESENTACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Describe la intención de un enemigo, para el director.
 *
 * @param {Object} decision
 * @param {Object} actor
 * @param {Object} combatientes
 * @returns {string}
 */
export function describir(decision, actor, combatientes) {
  const objetivo = decision.objetivo ? combatientes[decision.objetivo] : null;

  switch (decision.accion) {
    case 'atacar':
      return `${actor.nombre} ataca a ${objetivo?.nombre ?? 'alguien'} con ${decision.ataque?.nombre ?? 'su arma'}.`;

    case 'atacar_area':
      return `${actor.nombre} usa ${decision.ataque?.nombre ?? 'un ataque de área'}.`;

    case 'huir':
      return `${actor.nombre} intenta escapar.`;

    case 'invocar':
      return `${actor.nombre} llama refuerzos.`;

    case 'retroceder':
      return `${actor.nombre} retrocede.`;

    case 'esperar':
      return `${actor.nombre} espera su momento.`;

    default:
      return `${actor.nombre} no hace nada.`;
  }
}

export default { TACTICAS, decidir, coordinar, describir };
