/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · economy/Trade.js
 * ---------------------------------------------------------------------------
 * Ejecución de transacciones.
 *
 * `PriceModel` decide cuánto cuesta; este módulo ejecuta el intercambio y se
 * asegura de que sea válido. Cuatro comprobaciones antes de mover nada:
 *
 *   · ¿Tiene el jugador oro suficiente?
 *   · ¿Le cabe en la bolsa?
 *   · ¿Tiene el mercader el objeto y el oro para pagarlo?
 *   · ¿Es un objeto que puede venderse?
 *
 * Las transacciones son ATÓMICAS. Se toma una instantánea antes de empezar y se
 * restaura si algo falla a mitad. No puede ocurrir que el oro salga y el objeto
 * no entre.
 *
 * El mercader tiene oro finito. Es una restricción incómoda a propósito: obliga
 * a repartir las ventas y da sentido a viajar entre mercados.
 *
 * Funciones puras salvo la ejecución, que necesita el store.
 *
 * Dependencias: PriceModel, Item, Encumbrance.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as Precios from './PriceModel.js';
import * as Item from '../inventory/Item.js';
import { cabe } from '../inventory/Encumbrance.js';
import { ECONOMIA } from '../config/balance.config.js';

/** Motivos por los que una transacción puede rechazarse. */
export const RECHAZO = Object.freeze({
  SIN_ORO: 'sin_oro',
  SIN_ESPACIO: 'sin_espacio',
  SIN_STOCK: 'sin_stock',
  MERCADER_SIN_ORO: 'mercader_sin_oro',
  NO_VENDIBLE: 'no_vendible',
  NO_INTERESA: 'no_interesa',
});

/* ═══════════════════════════════════════════════════════════════════════════
   VALIDACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Comprueba si una compra es posible.
 *
 * @param {Object} opciones
 * @param {Object} opciones.objeto Lo que se compra.
 * @param {number} opciones.cantidad
 * @param {number} opciones.precioUnitario
 * @param {Object} opciones.jugador
 * @param {Object} opciones.inventario
 * @param {Object} [opciones.stock] Existencias del mercader.
 * @returns {{posible: boolean, motivo: string|null, mensaje: string|null, total: number}}
 */
export function validarCompra(opciones) {
  const { objeto, cantidad, precioUnitario, jugador, inventario, stock } = opciones;

  const total = precioUnitario * cantidad;

  // ─── Existencias ────────────────────────────────────────────────────────
  if (stock !== undefined && stock < cantidad) {
    return {
      posible: false,
      motivo: RECHAZO.SIN_STOCK,
      mensaje: stock === 0
        ? 'Ya no le queda.'
        : `Solo le quedan ${stock}.`,
      total,
    };
  }

  // ─── Oro ────────────────────────────────────────────────────────────────
  const oro = jugador.oro ?? 0;
  if (oro < total) {
    return {
      posible: false,
      motivo: RECHAZO.SIN_ORO,
      mensaje: `Te faltan ${total - oro} de oro.`,
      total,
    };
  }

  // ─── Espacio y peso ─────────────────────────────────────────────────────
  const espacio = cabe(jugador, inventario, objeto, cantidad);
  if (!espacio.cabe) {
    return {
      posible: false,
      motivo: RECHAZO.SIN_ESPACIO,
      mensaje: espacio.motivo,
      total,
    };
  }

  return { posible: true, motivo: null, mensaje: null, total };
}

/**
 * Comprueba si una venta es posible.
 *
 * @param {Object} opciones
 * @param {Object} opciones.objeto
 * @param {number} opciones.cantidad
 * @param {number} opciones.precioUnitario
 * @param {Object} [opciones.mercader]
 * @returns {{posible: boolean, motivo: string|null, mensaje: string|null, total: number}}
 */
export function validarVenta(opciones) {
  const { objeto, cantidad, precioUnitario, mercader } = opciones;

  const total = precioUnitario * cantidad;

  // ─── Objetos que no se venden ───────────────────────────────────────────
  if (objeto.esMision) {
    return {
      posible: false,
      motivo: RECHAZO.NO_VENDIBLE,
      mensaje: 'Eso no puedes venderlo.',
      total: 0,
    };
  }

  if (objeto.equipado) {
    return {
      posible: false,
      motivo: RECHAZO.NO_VENDIBLE,
      mensaje: 'Quítatelo antes de venderlo.',
      total,
    };
  }

  // ─── Interés del mercader ───────────────────────────────────────────────
  // Un herrero no compra pociones. Que cada uno tenga su ramo hace que buscar
  // al comprador adecuado sea parte del juego.
  if (mercader && !interesaA(mercader, objeto)) {
    return {
      posible: false,
      motivo: RECHAZO.NO_INTERESA,
      mensaje: `${mercader.nombre} no trata con eso.`,
      total: 0,
    };
  }

  // ─── Oro del mercader ───────────────────────────────────────────────────
  const oroMercader = mercader?.oro ?? Infinity;
  if (oroMercader < total) {
    return {
      posible: false,
      motivo: RECHAZO.MERCADER_SIN_ORO,
      mensaje: oroMercader <= 0
        ? 'No le queda oro para comprarte nada.'
        : `Solo puede pagarte ${oroMercader} de oro.`,
      total,
      maximoPagable: oroMercader,
    };
  }

  return { posible: true, motivo: null, mensaje: null, total };
}

/**
 * Comprueba si un mercader compra una categoría de objeto.
 *
 * @param {Object} mercader
 * @param {Object} objeto
 * @returns {boolean}
 */
export function interesaA(mercader, objeto) {
  const ramos = {
    herrero: ['arma', 'armadura', 'escudo', 'material'],
    herrera: ['arma', 'armadura', 'escudo', 'material'],
    'aprendiz de forja': ['material'],
    mercader: null,          // null = compra de todo.
    mercadera: null,
    'vendedor ambulante': null,
    posadero: ['consumible'],
    posadera: ['consumible'],
    sanadora: ['consumible', 'material'],
    tasadora: null,
  };

  const permitidas = ramos[mercader.rol];

  // Un rol no listado compra de todo: es lo menos frustrante.
  if (permitidas === undefined || permitidas === null) return true;

  return permitidas.includes(objeto.categoria);
}

/* ═══════════════════════════════════════════════════════════════════════════
   COTIZACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Calcula el precio de un objeto en una dirección concreta.
 *
 * @param {Object} objeto
 * @param {'compra'|'venta'} direccion
 * @param {Object} contexto
 * @returns {Object}
 */
export function cotizar(objeto, direccion, contexto) {
  const calculo = direccion === 'compra'
    ? Precios.precioCompra(objeto, contexto)
    : Precios.precioVenta(objeto, contexto);

  // El descuento negociado se aplica al final, sobre el precio ya formado.
  if (contexto.descuento) {
    const conRebaja = direccion === 'compra'
      ? Precios.conDescuento(calculo.precio, contexto.descuento)
      : Math.round(calculo.precio * (1 + contexto.descuento));

    return { ...calculo, precioOriginal: calculo.precio, precio: conRebaja };
  }

  return calculo;
}

/**
 * Cotiza un lote completo de objetos.
 *
 * Se usa al vender varias cosas de golpe: el jugador ve el total antes de
 * confirmar.
 *
 * @param {Array<{objeto: Object, cantidad: number}>} lote
 * @param {'compra'|'venta'} direccion
 * @param {Object} contexto
 * @returns {{lineas: Array<Object>, total: number}}
 */
export function cotizarLote(lote, direccion, contexto) {
  const lineas = lote.map(({ objeto, cantidad }) => {
    const calculo = cotizar(objeto, direccion, contexto);

    return {
      objeto,
      cantidad,
      unitario: calculo.precio,
      subtotal: calculo.precio * cantidad,
      calculo,
    };
  });

  return {
    lineas,
    total: lineas.reduce((a, l) => a + l.subtotal, 0),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   EJECUCIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Ejecuta una compra.
 *
 * Devuelve las acciones a despachar en vez de despacharlas: así el llamante
 * puede envolverlas en una transacción y el módulo sigue siendo comprobable
 * de forma aislada.
 *
 * @param {Object} opciones
 * @returns {{
 *   exito: boolean, motivo: string|null, mensaje: string|null,
 *   acciones: Array<Object>, total: number
 * }}
 */
export function ejecutarCompra(opciones) {
  const validacion = validarCompra(opciones);

  if (!validacion.posible) {
    return {
      exito: false,
      motivo: validacion.motivo,
      mensaje: validacion.mensaje,
      acciones: [],
      total: validacion.total,
    };
  }

  const { objeto, cantidad, precioUnitario } = opciones;
  const total = validacion.total;

  // Se crea una instancia propia: el objeto del catálogo del mercader es una
  // plantilla, no la pieza concreta que se lleva el jugador.
  const instancia = { ...objeto, cantidad };

  return {
    exito: true,
    motivo: null,
    mensaje: null,
    total,
    acciones: [
      { tipo: 'inventory/oro', payload: { delta: -total, motivo: 'compra' } },
      { tipo: 'inventory/anadir', payload: { objeto: instancia } },
    ],
  };
}

/**
 * Ejecuta una venta.
 *
 * @param {Object} opciones
 * @returns {Object}
 */
export function ejecutarVenta(opciones) {
  const validacion = validarVenta(opciones);

  if (!validacion.posible) {
    return {
      exito: false,
      motivo: validacion.motivo,
      mensaje: validacion.mensaje,
      acciones: [],
      total: validacion.total,
      maximoPagable: validacion.maximoPagable,
    };
  }

  const { objeto, cantidad } = opciones;
  const total = validacion.total;

  return {
    exito: true,
    motivo: null,
    mensaje: null,
    total,
    acciones: [
      { tipo: 'inventory/retirar', payload: { idObjeto: objeto.id, cantidad, silencioso: true } },
      { tipo: 'inventory/oro', payload: { delta: total, motivo: 'venta' } },
    ],
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   SERVICIOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Coste de un servicio: alojamiento, reparación, curación.
 *
 * @param {string} servicio
 * @param {Object} contexto
 * @returns {{precio: number, descripcion: string}}
 */
export function precioServicio(servicio, contexto = {}) {
  // Los nombres del catálogo no coinciden con los del contrato: se traducen.
  const claves = {
    posada: 'posadaHabitacion',
    curacion: 'curacionMenor',
    transporte: 'viajeCaravana',
    comida: 'comida',
    agua: 'agua',
  };

  const base = ECONOMIA.servicios[claves[servicio] ?? servicio] ?? 10;

  let factor = 1;

  // La reputación y los eventos también afectan a los servicios.
  factor *= contexto.reputacionFaccion ?? 1;
  factor *= contexto.efectosEventos?.precios ?? 1;

  // Un lugar grande cobra más por dormir.
  if (servicio === 'posada' && contexto.tamanoLugar) {
    factor *= 1 + contexto.tamanoLugar * 0.15;
  }

  const descripciones = {
    posada: 'una noche con cama y comida',
    curacion: 'que te atiendan las heridas',
    reparacion: 'reparar el equipo',
    transporte: 'que te lleven',
    informacion: 'que suelten la lengua',
  };

  return {
    precio: Math.max(1, Math.round(base * factor)),
    descripcion: descripciones[servicio] ?? servicio,
  };
}

/**
 * Coste de reparar un objeto concreto.
 *
 * @param {Object} objeto
 * @param {Object} [contexto]
 * @returns {{precio: number, puntos: number, posible: boolean, motivo: string|null}}
 */
export function precioReparacion(objeto, contexto = {}) {
  if (!objeto.tieneDurabilidad) {
    return { precio: 0, puntos: 0, posible: false, motivo: 'Eso no se repara.' };
  }

  const falta = (objeto.durabilidadMax ?? 100) - (objeto.durabilidad ?? 100);

  if (falta <= 0) {
    return { precio: 0, puntos: 0, posible: false, motivo: 'Está en perfecto estado.' };
  }

  // El coste escala con el valor del objeto: reparar una espada legendaria
  // cuesta más que reparar un cuchillo.
  const porPunto = Math.max(0.5, (objeto.valor ?? 10) / 100);
  const bruto = falta * porPunto;

  const factor = (contexto.reputacionFaccion ?? 1) * (contexto.efectosEventos?.precios ?? 1);

  return {
    precio: Math.max(1, Math.round(bruto * factor)),
    puntos: falta,
    posible: true,
    motivo: null,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESENTACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Prepara una línea de catálogo para la interfaz.
 *
 * @param {Object} objeto
 * @param {'compra'|'venta'} direccion
 * @param {Object} contexto
 * @param {number} [stock]
 * @returns {Object}
 */
export function paraInterfaz(objeto, direccion, contexto, stock) {
  const calculo = cotizar(objeto, direccion, contexto);
  const valoracion = Precios.valoracion(calculo, contexto.tieneTasacion);

  return {
    id: objeto.id,
    refId: objeto.refId,
    nombre: objeto.nombre,
    categoria: objeto.categoria,
    rareza: objeto.rareza,
    cantidad: objeto.cantidad ?? 1,
    stock,
    precio: calculo.precio,
    precioOriginal: calculo.precioOriginal ?? null,
    valoracion,
    explicacion: Precios.explicar(calculo),
    peso: objeto.peso,
  };
}

export default {
  RECHAZO,
  validarCompra,
  validarVenta,
  interesaA,
  cotizar,
  cotizarLote,
  ejecutarCompra,
  ejecutarVenta,
  precioServicio,
  precioReparacion,
  paraInterfaz,
};
