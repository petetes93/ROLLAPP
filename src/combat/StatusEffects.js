/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · combat/StatusEffects.js
 * ---------------------------------------------------------------------------
 * Aplicación, acumulación y resolución de estados alterados.
 *
 * Cuatro momentos en la vida de un estado:
 *   1. APLICACIÓN — con inmunidades y acumulación
 *   2. INICIO DE TURNO — efectos periódicos
 *   3. FIN DE TURNO — salvaciones y decremento de duración
 *   4. EXPIRACIÓN — retirada y estados sucesores
 *
 * Detalle de diseño: los estados periódicos se resuelven al INICIO del turno
 * del afectado, no al final. Así el veneno hace daño antes de que actúe, lo que
 * puede impedirle actuar. Es más duro y más coherente.
 *
 * Funciones puras: reciben combatientes y devuelven combatientes nuevos.
 *
 * Dependencias: statuses.data, Combatant, balance.config.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { obtenerEstado } from '../data/statuses.data.js';
import { COMBATE } from '../config/balance.config.js';
import { modificarVida } from './Combatant.js';

/* ═══════════════════════════════════════════════════════════════════════════
   APLICACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Aplica un estado a un combatiente.
 *
 * @param {Object} c Combatiente.
 * @param {string} refId
 * @param {Object} [opciones]
 * @param {number} [opciones.rondas] Duración; por defecto la del estado.
 * @param {number} [opciones.acumulaciones=1]
 * @param {string} [opciones.origen] Quién lo causó.
 * @returns {{combatiente: Object, aplicado: boolean, motivo: string|null, narracion: string|null}}
 */
export function aplicar(c, refId, opciones = {}) {
  const estado = obtenerEstado(refId);

  if (!estado) {
    return { combatiente: c, aplicado: false, motivo: 'estado desconocido', narracion: null };
  }

  // ─── Inmunidades ────────────────────────────────────────────────────────
  if (c.inmunidades?.includes(refId)) {
    return {
      combatiente: c,
      aplicado: false,
      motivo: `es inmune a ${estado.nombre.toLowerCase()}`,
      narracion: null,
    };
  }

  // Ciertos estados inmunizan contra otros: estar paralizado hace irrelevante
  // el derribo.
  for (const activo of c.estados ?? []) {
    const otro = obtenerEstado(activo.refId);
    if (otro?.inmunizaA?.includes(refId)) {
      return {
        combatiente: c,
        aplicado: false,
        motivo: `ya está ${otro.nombre.toLowerCase()}`,
        narracion: null,
      };
    }
  }

  const estados = [...(c.estados ?? [])];
  const indice = estados.findIndex((e) => e.refId === refId);

  // ─── Ya lo tiene ────────────────────────────────────────────────────────
  if (indice >= 0) {
    const actual = estados[indice];

    if (!estado.acumulable) {
      // No acumulable: se refresca la duración, que es lo que cabe esperar.
      estados[indice] = {
        ...actual,
        rondas: Math.max(actual.rondas, opciones.rondas ?? estado.duracion),
      };

      return {
        combatiente: { ...c, estados },
        aplicado: true,
        motivo: 'duración renovada',
        narracion: null,
      };
    }

    // Acumulable: sube el contador hasta el tope.
    const tope = estado.acumulacionesMax ?? COMBATE.acumulacionesMax;
    const nuevas = Math.min(actual.acumulaciones + (opciones.acumulaciones ?? 1), tope);

    estados[indice] = {
      ...actual,
      acumulaciones: nuevas,
      rondas: Math.max(actual.rondas, opciones.rondas ?? estado.duracion),
    };

    let combatiente = { ...c, estados };

    // Llegar al tope puede desencadenar un estado peor: la congelación total.
    if (nuevas >= tope && estado.alAcumularMax) {
      const r = aplicar(combatiente, estado.alAcumularMax, { origen: opciones.origen });
      combatiente = r.combatiente;

      return {
        combatiente,
        aplicado: true,
        motivo: null,
        narracion: obtenerEstado(estado.alAcumularMax)?.narracion ?? null,
      };
    }

    return {
      combatiente,
      aplicado: true,
      motivo: `${nuevas} acumulaciones`,
      narracion: null,
    };
  }

  // ─── Nuevo ──────────────────────────────────────────────────────────────
  estados.push({
    refId,
    rondas: opciones.rondas ?? estado.duracion,
    acumulaciones: opciones.acumulaciones ?? 1,
    origen: opciones.origen ?? null,
  });

  return {
    combatiente: { ...c, estados },
    aplicado: true,
    motivo: null,
    narracion: estado.narracion,
  };
}

/**
 * Retira un estado.
 *
 * @param {Object} c
 * @param {string} refId
 * @returns {{combatiente: Object, retirado: boolean}}
 */
export function retirar(c, refId) {
  const estados = (c.estados ?? []).filter((e) => e.refId !== refId);
  const retirado = estados.length < (c.estados?.length ?? 0);

  return { combatiente: { ...c, estados }, retirado };
}

/**
 * Retira todos los estados de una categoría.
 *
 * @param {Object} c
 * @param {string} categoria
 * @returns {{combatiente: Object, retirados: string[]}}
 */
export function retirarCategoria(c, categoria) {
  const retirados = [];

  const estados = (c.estados ?? []).filter((activo) => {
    const estado = obtenerEstado(activo.refId);
    if (estado?.categoria === categoria) {
      retirados.push(activo.refId);
      return false;
    }
    return true;
  });

  return { combatiente: { ...c, estados }, retirados };
}

/* ═══════════════════════════════════════════════════════════════════════════
   INICIO DE TURNO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Resuelve los efectos periódicos al empezar el turno del combatiente.
 *
 * @param {Object} c
 * @returns {{combatiente: Object, dano: number, curacion: number, eventos: Array<Object>, cayo: boolean}}
 */
export function alIniciarTurno(c) {
  let combatiente = c;
  let dano = 0;
  let curacion = 0;
  const eventos = [];

  for (const activo of c.estados ?? []) {
    const estado = obtenerEstado(activo.refId);
    if (!estado?.periodico) continue;

    const base = estado.periodico.dano;
    const acumulaciones = estado.periodico.porAcumulacion ? (activo.acumulaciones ?? 1) : 1;
    const cantidad = base * acumulaciones;

    // Los valores negativos curan.
    if (cantidad < 0) {
      curacion += Math.abs(cantidad);
      const r = modificarVida(combatiente, Math.abs(cantidad));
      combatiente = r.combatiente;

      eventos.push({
        tipo: 'curacion_periodica',
        estado: activo.refId,
        nombre: estado.nombre,
        cantidad: r.aplicado,
      });
      continue;
    }

    dano += cantidad;
    const r = modificarVida(combatiente, -cantidad);
    combatiente = r.combatiente;

    eventos.push({
      tipo: 'dano_periodico',
      estado: activo.refId,
      nombre: estado.nombre,
      cantidad,
      tipoDano: estado.periodico.tipo,
      acumulaciones,
    });

    if (r.cayo) {
      return { combatiente, dano, curacion, eventos, cayo: true };
    }
  }

  return { combatiente, dano, curacion, eventos, cayo: false };
}

/* ═══════════════════════════════════════════════════════════════════════════
   FIN DE TURNO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Resuelve salvaciones y decrementa duraciones al terminar el turno.
 *
 * @param {Object} c
 * @param {Function} tirarSalvacion Función (atributo, umbral) → {exito, total}
 * @returns {{combatiente: Object, expirados: Array<Object>, salvados: Array<Object>}}
 */
export function alTerminarTurno(c, tirarSalvacion) {
  const estados = [];
  const expirados = [];
  const salvados = [];

  let combatiente = c;

  for (const activo of c.estados ?? []) {
    const estado = obtenerEstado(activo.refId);

    if (!estado) continue;

    // ─── Salvación ──────────────────────────────────────────────────────
    // Permite sacudirse un estado antes de que expire por tiempo.
    if (estado.salvacion?.alFinal && tirarSalvacion) {
      const r = tirarSalvacion(estado.salvacion.atributo, estado.salvacion.umbral);

      if (r.exito) {
        salvados.push({ refId: activo.refId, nombre: estado.nombre, tirada: r });
        continue;   // No se conserva: se ha librado.
      }
    }

    // ─── Duración ───────────────────────────────────────────────────────
    // Los estados que solo se quitan descansando no decrementan aquí.
    if (estado.soloDescanso || estado.duracion >= 99) {
      estados.push(activo);
      continue;
    }

    const rondas = activo.rondas - 1;

    if (rondas <= 0) {
      expirados.push({ refId: activo.refId, nombre: estado.nombre });

      // Un estado puede dar paso a otro al expirar.
      if (estado.alExpirar) {
        const r = aplicar({ ...combatiente, estados }, estado.alExpirar);
        combatiente = r.combatiente;
      }
      continue;
    }

    estados.push({ ...activo, rondas });
  }

  return {
    combatiente: { ...combatiente, estados },
    expirados,
    salvados,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   INTERACCIONES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Comprueba si recibir daño rompe algún estado.
 *
 * La invisibilidad no se rompe por recibir daño, pero la concentración sí.
 *
 * @param {Object} c
 * @param {number} dano
 * @param {Function} tirarSalvacion
 * @returns {{combatiente: Object, rotos: Array<Object>}}
 */
export function alRecibirDano(c, dano, tirarSalvacion) {
  const rotos = [];
  let combatiente = c;

  for (const activo of [...(c.estados ?? [])]) {
    const estado = obtenerEstado(activo.refId);
    if (!estado?.salvacionAlRecibirDano) continue;

    // El umbral escala con el daño recibido: un golpe fuerte cuesta más de
    // aguantar que un roce.
    const umbral = Math.max(
      estado.salvacionAlRecibirDano.umbralBase,
      Math.floor(dano / 2),
    );

    const r = tirarSalvacion?.(estado.salvacionAlRecibirDano.atributo, umbral);

    if (r && !r.exito) {
      const retirada = retirar(combatiente, activo.refId);
      combatiente = retirada.combatiente;
      rotos.push({ refId: activo.refId, nombre: estado.nombre });
    }
  }

  return { combatiente, rotos };
}

/**
 * Comprueba si una acción rompe algún estado.
 *
 * Atacar rompe la invisibilidad: es la contrapartida que la equilibra.
 *
 * @param {Object} c
 * @param {string} accion
 * @returns {{combatiente: Object, rotos: Array<Object>}}
 */
export function alActuar(c, accion) {
  const rotos = [];
  let combatiente = c;

  for (const activo of [...(c.estados ?? [])]) {
    const estado = obtenerEstado(activo.refId);
    if (!estado?.rompeAl?.includes(accion)) continue;

    const retirada = retirar(combatiente, activo.refId);
    combatiente = retirada.combatiente;
    rotos.push({ refId: activo.refId, nombre: estado.nombre });
  }

  return { combatiente, rotos };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSULTAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @param {Object} c
 * @param {string} refId
 * @returns {boolean}
 */
export function tiene(c, refId) {
  return (c.estados ?? []).some((e) => e.refId === refId);
}

/**
 * @param {Object} c
 * @param {string} refId
 * @returns {number} Acumulaciones, o 0 si no lo tiene.
 */
export function acumulaciones(c, refId) {
  return (c.estados ?? []).find((e) => e.refId === refId)?.acumulaciones ?? 0;
}

/**
 * Estados de una categoría que tiene el combatiente.
 * @param {Object} c
 * @param {string} categoria
 * @returns {Array<Object>}
 */
export function porCategoria(c, categoria) {
  return (c.estados ?? []).filter((activo) => {
    return obtenerEstado(activo.refId)?.categoria === categoria;
  });
}

/**
 * Descripción de los estados activos, para la narración.
 * @param {Object} c
 * @returns {string}
 */
export function describir(c) {
  const activos = (c.estados ?? [])
    .map((a) => {
      const estado = obtenerEstado(a.refId);
      if (!estado) return null;

      const acum = estado.acumulable && a.acumulaciones > 1 ? ` ×${a.acumulaciones}` : '';
      return `${estado.nombre}${acum}`;
    })
    .filter(Boolean);

  return activos.length ? activos.join(', ') : '';
}

export default {
  aplicar,
  retirar,
  retirarCategoria,
  alIniciarTurno,
  alTerminarTurno,
  alRecibirDano,
  alActuar,
  tiene,
  acumulaciones,
  porCategoria,
  describir,
};
