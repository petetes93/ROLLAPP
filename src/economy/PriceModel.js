/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · economy/PriceModel.js
 * ---------------------------------------------------------------------------
 * Formación de precios.
 *
 * Un objeto no vale lo mismo en todas partes. El precio final sale de multiplicar
 * seis factores independientes sobre el valor base:
 *
 *   1. MARGEN DEL MERCADER — compra barato, vende caro. Siempre.
 *   2. ESCASEZ LOCAL — el hierro es barato en las montañas y caro en el pantano
 *   3. REPUTACIÓN — un aliado del gremio paga menos en sus talleres
 *   4. ACTITUD PERSONAL — quien te aprecia te hace precio
 *   5. EVENTOS DEL MUNDO — una feria abarata, una plaga encarece
 *   6. ESTADO DEL OBJETO — lo desgastado vale menos
 *
 * Que sean multiplicativos importa: una feria (×0,85) durante una buena cosecha
 * (×0,75) siendo aliado del gremio (×0,88) deja el precio al 56 %. Los efectos
 * se componen sin que nadie los programe caso por caso.
 *
 * El margen del mercader es la razón de que comerciar no sea una máquina de
 * dinero: comprar y vender lo mismo siempre pierde.
 *
 * Funciones puras.
 *
 * Dependencias: items.data, locations.data, balance.config.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { ECONOMIA } from '../config/balance.config.js';
import { obtenerLugar, obtenerRegion } from '../data/locations.data.js';
import { estado as estadoDurabilidad } from '../inventory/Durability.js';
import { saturar } from '../utils/math.js';

/* ═══════════════════════════════════════════════════════════════════════════
   ESCASEZ POR REGIÓN
   ---------------------------------------------------------------------------
   Qué abunda y qué falta en cada sitio. Es lo que hace que el comercio entre
   regiones tenga sentido: comprar barato donde sobra y vender donde falta.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Multiplicadores por categoría y región.
 * Menor que 1 = abunda y es barato. Mayor que 1 = escasea y es caro.
 */
export const ESCASEZ = Object.freeze({
  valle_central: {
    // El centro comercial: todo llega y nada es extremo.
    arma: 1, armadura: 1, consumible: 0.9, util: 0.95, material: 1,
  },
  montanas_yunque: {
    // Las forjas: metal barato, comida cara.
    arma: 0.75, armadura: 0.7, consumible: 1.3, util: 1, material: 0.8,
  },
  bosque_cenizo: {
    // Sin talleres ni mercados: el metal cuesta traerlo.
    arma: 1.4, armadura: 1.5, consumible: 0.8, util: 1.1, material: 0.85,
  },
  marisma_velo: {
    // Aislada y hostil: todo lo importado se paga.
    arma: 1.5, armadura: 1.6, consumible: 1.4, util: 1.3, material: 1.2,
  },
  ruinas_albares: {
    // Poca población, mucha reliquia.
    arma: 1.3, armadura: 1.3, consumible: 1.5, util: 1.2, material: 1.1,
    magico: 0.8,
  },
  dunas_rojas: {
    // El agua es oro; las rutas traen de todo lo demás.
    arma: 1.1, armadura: 1.15, consumible: 1.6, util: 0.95, material: 1.2,
  },
});

/**
 * Ajustes por objeto concreto, que se superponen a los de categoría.
 *
 * Un odre de agua en el desierto no es «un consumible caro»: es carísimo.
 */
export const ESCASEZ_ESPECIFICA = Object.freeze({
  dunas_rojas: { odre_agua: 3, racion_viaje: 1.8 },
  montanas_yunque: { racion_viaje: 1.5, lingote_hierro: 0.5 },
  marisma_velo: { antorcha: 1.8, antidoto: 0.6 },
  bosque_cenizo: { hierbas_curativas: 0.5, racion_viaje: 0.7 },
});

/* ═══════════════════════════════════════════════════════════════════════════
   CÁLCULO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} ContextoPrecio
 * @property {string} [region]
 * @property {Object} [mercader] PNJ que comercia.
 * @property {number} [reputacionFaccion] Multiplicador de ReputationSystem.
 * @property {Object} [efectosEventos] Salida de DynamicEvents.efectos().
 * @property {number} [habilidadTasacion] Modificador de tasación del jugador.
 */

/**
 * Calcula el precio de compra: lo que el jugador paga.
 *
 * @param {Object} objeto Instancia del inventario o plantilla.
 * @param {ContextoPrecio} contexto
 * @returns {{precio: number, base: number, desglose: Array<Object>, factor: number}}
 */
export function precioCompra(objeto, contexto = {}) {
  const base = objeto.valor ?? 1;
  const desglose = [];

  let factor = 1;

  // ─── 1. Margen del mercader ─────────────────────────────────────────────
  // Vende por encima del valor. Es su negocio.
  const margen = ECONOMIA.ratioCompra;
  factor *= margen;
  desglose.push({ fuente: 'Margen del mercader', factor: margen });

  // ─── 2. Escasez local ───────────────────────────────────────────────────
  const escasez = factorEscasez(objeto, contexto.region);
  if (escasez !== 1) {
    factor *= escasez;
    desglose.push({
      fuente: escasez > 1 ? 'Escasea por aquí' : 'Abunda por aquí',
      factor: escasez,
    });
  }

  // ─── 3. Reputación con su facción ───────────────────────────────────────
  const reputacion = contexto.reputacionFaccion ?? 1;
  if (reputacion !== 1) {
    factor *= reputacion;
    desglose.push({
      fuente: reputacion < 1 ? 'Te conocen bien' : 'No se fían de ti',
      factor: reputacion,
    });
  }

  // ─── 4. Actitud personal del mercader ───────────────────────────────────
  const actitud = factorActitud(contexto.mercader);
  if (actitud !== 1) {
    factor *= actitud;
    desglose.push({
      fuente: actitud < 1 ? 'Te aprecia' : 'No le caes bien',
      factor: actitud,
    });
  }

  // ─── 5. Eventos del mundo ───────────────────────────────────────────────
  const eventos = factorEventos(objeto, contexto.efectosEventos);
  if (eventos !== 1) {
    factor *= eventos;
    desglose.push({
      fuente: eventos < 1 ? 'Hay abundancia estos días' : 'Los tiempos están caros',
      factor: eventos,
    });
  }

  // ─── 6. Estado del objeto ───────────────────────────────────────────────
  const desgaste = factorDesgaste(objeto);
  if (desgaste !== 1) {
    factor *= desgaste;
    desglose.push({ fuente: 'Estado del objeto', factor: desgaste });
  }

  const precio = Math.max(1, Math.round(base * factor));

  return { precio, base, desglose, factor };
}

/**
 * Calcula el precio de venta: lo que el jugador recibe.
 *
 * El mercader compra muy por debajo del valor. Esa horquilla es lo que impide
 * que comprar y vender en bucle genere dinero.
 *
 * @param {Object} objeto
 * @param {ContextoPrecio} contexto
 * @returns {{precio: number, base: number, desglose: Array<Object>, factor: number}}
 */
export function precioVenta(objeto, contexto = {}) {
  const base = objeto.valor ?? 1;
  const desglose = [];

  let factor = 1;

  // ─── 1. Margen del mercader ─────────────────────────────────────────────
  const margen = ECONOMIA.ratioVenta;
  factor *= margen;
  desglose.push({ fuente: 'Lo que ofrece el mercader', factor: margen });

  // ─── 2. Escasez local, invertida ────────────────────────────────────────
  // Lo que escasea aquí se paga mejor: es la base del comercio entre regiones.
  const escasez = factorEscasez(objeto, contexto.region);
  if (escasez !== 1) {
    factor *= escasez;
    desglose.push({
      fuente: escasez > 1 ? 'Aquí lo necesitan' : 'Aquí les sobra',
      factor: escasez,
    });
  }

  // ─── 3. Reputación, invertida ───────────────────────────────────────────
  // Un aliado recibe más por lo que vende, no menos.
  const reputacion = contexto.reputacionFaccion ?? 1;
  if (reputacion !== 1) {
    const invertido = 2 - reputacion;
    factor *= invertido;
    desglose.push({
      fuente: invertido > 1 ? 'Te conocen bien' : 'No se fían de ti',
      factor: invertido,
    });
  }

  // ─── 4. Actitud, invertida ──────────────────────────────────────────────
  const actitud = factorActitud(contexto.mercader);
  if (actitud !== 1) {
    const invertido = 2 - actitud;
    factor *= invertido;
    desglose.push({
      fuente: invertido > 1 ? 'Te aprecia' : 'No le caes bien',
      factor: invertido,
    });
  }

  // ─── 5. Estado ──────────────────────────────────────────────────────────
  const desgaste = factorDesgaste(objeto);
  if (desgaste !== 1) {
    factor *= desgaste;
    desglose.push({ fuente: 'Estado del objeto', factor: desgaste });
  }

  // ─── 6. Objetos que nadie quiere ────────────────────────────────────────
  if (objeto.esMision) {
    return { precio: 0, base, desglose: [{ fuente: 'No está en venta', factor: 0 }], factor: 0 };
  }

  const precio = Math.max(1, Math.round(base * factor));

  return { precio, base, desglose, factor };
}

/* ═══════════════════════════════════════════════════════════════════════════
   FACTORES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Factor de escasez del objeto en la región.
 *
 * @param {Object} objeto
 * @param {string} [region]
 * @returns {number}
 */
export function factorEscasez(objeto, region) {
  if (!region) return 1;

  // El ajuste específico manda sobre el de categoría.
  const especifico = ESCASEZ_ESPECIFICA[region]?.[objeto.refId];
  if (especifico !== undefined) return especifico;

  const porCategoria = ESCASEZ[region]?.[objeto.categoria];
  return porCategoria ?? 1;
}

/**
 * Factor derivado de la actitud personal del mercader.
 *
 * El rango es estrecho a propósito: caerle bien al herrero ayuda, pero no
 * convierte el comercio en un regalo.
 *
 * @param {Object} [mercader]
 * @returns {number}
 */
export function factorActitud(mercader) {
  if (!mercader) return 1;

  const actitud = mercader.actitud ?? 0;

  // De 0,9 a 1,15 según la actitud, con la codicia modulando.
  const base = saturar(1 - actitud / 500, 0.9, 1.15);

  // Un mercader codicioso hace menos favores.
  const codicia = mercader.rasgos?.codicia ?? 0.5;
  const atenuado = 1 + (base - 1) * (1.4 - codicia);

  return Math.round(atenuado * 100) / 100;
}

/**
 * Factor derivado de los eventos activos del mundo.
 *
 * @param {Object} objeto
 * @param {Object} [efectos] Salida de DynamicEvents.efectos().
 * @returns {number}
 */
export function factorEventos(objeto, efectos) {
  if (!efectos) return 1;

  let factor = efectos.precios ?? 1;

  // Ciertos eventos afectan a categorías concretas.
  if (objeto.subtipo === 'comida' || objeto.subtipo === 'bebida') {
    factor *= efectos.precioComida ?? 1;
  }
  if (objeto.subtipo === 'medicina' || objeto.subtipo === 'pocion') {
    factor *= efectos.precioMedicina ?? 1;
  }

  return factor;
}

/**
 * Factor derivado del desgaste.
 *
 * Un objeto roto conserva parte de su valor: el material sigue ahí.
 *
 * @param {Object} objeto
 * @returns {number}
 */
export function factorDesgaste(objeto) {
  if (!objeto.tieneDurabilidad) return 1;

  const e = estadoDurabilidad(objeto);
  return e?.multiplicadorValor ?? 1;
}

/* ═══════════════════════════════════════════════════════════════════════════
   REGATEO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Margen de negociación disponible sobre un precio.
 *
 * Determina cuánto puede moverse el precio con una buena tirada de trato social.
 * El tope existe para que regatear sea útil sin volverse la mecánica dominante.
 *
 * @param {Object} [mercader]
 * @param {number} [margenTirada=0] Margen de la prueba social superada.
 * @returns {{maximo: number, aplicable: number}}
 */
export function margenRegateo(mercader, margenTirada = 0) {
  // Un mercader codicioso cede menos; uno abierto, más.
  const codicia = mercader?.rasgos?.codicia ?? 0.5;
  const maximo = saturar(ECONOMIA.regateoMax * (1.3 - codicia), 0.05, ECONOMIA.regateoMax);

  // El margen de la tirada determina cuánto de ese tope se consigue.
  const aplicable = saturar(margenTirada * 0.02, 0, maximo);

  return {
    maximo: Math.round(maximo * 100) / 100,
    aplicable: Math.round(aplicable * 100) / 100,
  };
}

/**
 * Aplica un descuento a un precio.
 *
 * @param {number} precio
 * @param {number} rebaja Fracción 0-1.
 * @returns {number}
 */
export function conDescuento(precio, rebaja) {
  return Math.max(1, Math.round(precio * (1 - saturar(rebaja, 0, 0.5))));
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESENTACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Compara el precio con el valor base, para que el jugador sepa si es un buen
 * trato.
 *
 * Requiere tasación: sin la habilidad, no se muestra. Es lo que hace que la
 * competencia sirva para algo.
 *
 * @param {Object} calculo Salida de precioCompra o precioVenta.
 * @param {boolean} [tieneTasacion=false]
 * @returns {{visible: boolean, etiqueta: string|null, color: string|null}}
 */
export function valoracion(calculo, tieneTasacion = false) {
  if (!tieneTasacion) return { visible: false, etiqueta: null, color: null };

  const ratio = calculo.precio / Math.max(1, calculo.base);

  if (ratio <= 0.8) return { visible: true, etiqueta: 'una ganga', color: 'exito' };
  if (ratio <= 1.1) return { visible: true, etiqueta: 'precio justo', color: 'neutral' };
  if (ratio <= 1.5) return { visible: true, etiqueta: 'algo caro', color: 'aviso' };

  return { visible: true, etiqueta: 'un robo', color: 'peligro' };
}

/**
 * Explica un precio en lenguaje natural.
 *
 * @param {Object} calculo
 * @returns {string}
 */
export function explicar(calculo) {
  const relevantes = calculo.desglose
    .filter((d) => Math.abs(d.factor - 1) >= 0.08)
    .map((d) => d.fuente.toLowerCase());

  if (!relevantes.length) return '';

  return `Influye: ${relevantes.join(', ')}.`;
}

/**
 * Contexto de precios para el director.
 *
 * Le permite narrar el regateo con coherencia: si el agua está por las nubes en
 * el desierto, que el mercader lo mencione.
 *
 * @param {string} region
 * @param {Object} [efectos]
 * @returns {string}
 */
export function paraDirector(region, efectos) {
  const partes = [];

  const escasez = ESCASEZ[region];
  if (escasez) {
    const caros = Object.entries(escasez).filter(([, v]) => v >= 1.3).map(([k]) => k);
    const baratos = Object.entries(escasez).filter(([, v]) => v <= 0.8).map(([k]) => k);

    if (caros.length) partes.push(`Aquí escasea: ${caros.join(', ')}.`);
    if (baratos.length) partes.push(`Aquí abunda: ${baratos.join(', ')}.`);
  }

  if (efectos?.precios > 1.2) partes.push('Los precios están por las nubes estos días.');
  else if (efectos?.precios < 0.85) partes.push('Los precios están bajos estos días.');

  if (efectos?.mercadoNegro) partes.push('Hay quien vende por debajo de la mesa.');

  return partes.join(' ');
}

export default {
  ESCASEZ,
  ESCASEZ_ESPECIFICA,
  precioCompra,
  precioVenta,
  factorEscasez,
  factorActitud,
  factorEventos,
  factorDesgaste,
  margenRegateo,
  conDescuento,
  valoracion,
  explicar,
  paraDirector,
};
