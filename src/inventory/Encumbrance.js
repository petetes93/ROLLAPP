/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · inventory/Encumbrance.js
 * ---------------------------------------------------------------------------
 * Peso, capacidad de carga e impedimenta.
 *
 * Este sistema existe para que el inventario sea una decisión y no una lista
 * que crece sin límite. Los umbrales están calibrados para que un personaje con
 * armadura media ya vaya cargado antes de recoger botín: a partir del 70 % de
 * capacidad se aplica −1 a todas las tiradas, y al 90 %, −3.
 *
 * La penalización afecta a TODO, no solo al sigilo. Cargar de más te hace peor
 * en todo, que es exactamente lo que pasa cuando vas cargado de más.
 *
 * Funciones puras.
 *
 * Dependencias: config/balance.config.js, Attributes, ClassSystem, Item.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { OBJETOS } from '../config/balance.config.js';
import { modificadorEfectivo } from '../player/Attributes.js';
import { sumarEfecto } from '../player/ClassSystem.js';
import { pesoTotal } from './Item.js';
import { escalon, fraccion } from '../utils/math.js';

/* ═══════════════════════════════════════════════════════════════════════════
   CAPACIDAD
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Capacidad de carga del personaje.
 *
 * Base más Vigor, más lo que aporten los rasgos. El Griscuerno suma 15 por su
 * envergadura y el Goliat 20 por ser poderoso: en ambos casos, la diferencia se
 * nota de verdad en la práctica.
 *
 * @param {Object} jugador
 * @returns {number}
 */
export function capacidad(jugador) {
  const base = OBJETOS.cargaBase;
  const porVigor = modificadorEfectivo(jugador, 'vigor') * OBJETOS.cargaPorVigor;
  const porRasgos = sumarEfecto(jugador, 'cargaExtra');

  return Math.max(5, base + porVigor + porRasgos);
}

/**
 * Peso total que lleva encima el personaje, equipo incluido.
 *
 * @param {Object} inventario Rama `inventory` del estado.
 * @returns {number}
 */
export function cargaActual(inventario) {
  const objetos = Object.values(inventario?.objetos?.porId ?? {});
  const total = objetos.reduce((suma, o) => suma + pesoTotal(o), 0);
  return Math.round(total * 100) / 100;
}

/* ═══════════════════════════════════════════════════════════════════════════
   IMPEDIMENTA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Estado de carga según la fracción de capacidad ocupada.
 *
 * @param {number} carga
 * @param {number} maximo
 * @returns {{clave: string, nombre: string, modificador: number, fraccion: number}}
 */
export function estadoCarga(carga, maximo) {
  const f = maximo > 0 ? carga / maximo : 0;
  const fila = escalon([...OBJETOS.impedimenta].reverse(), f);

  const nombres = {
    ligero: 'Ligero',
    cargado: 'Cargado',
    sobrecargado: 'Sobrecargado',
    inmovilizado: 'Inmovilizado',
  };

  return {
    clave: fila.etiqueta,
    nombre: nombres[fila.etiqueta] ?? fila.etiqueta,
    modificador: fila.modificador,
    fraccion: f,
  };
}

/**
 * Análisis completo de la carga del personaje.
 *
 * Es lo que consulta la interfaz y lo que usa RulesEngine para saber qué
 * penalización aplicar.
 *
 * @param {Object} jugador
 * @param {Object} inventario
 * @returns {{
 *   carga: number, maximo: number, libre: number, fraccion: number,
 *   estado: Object, modificador: number, penalizado: boolean, inmovil: boolean
 * }}
 */
export function analizar(jugador, inventario) {
  const maximo = capacidad(jugador);
  const carga = cargaActual(inventario);
  const estado = estadoCarga(carga, maximo);

  return {
    carga,
    maximo,
    libre: Math.max(0, Math.round((maximo - carga) * 100) / 100),
    fraccion: estado.fraccion,
    estado,
    modificador: estado.modificador,
    penalizado: estado.modificador !== 0,
    inmovil: estado.clave === 'inmovilizado',
  };
}

/**
 * Penalización de carga en formato de desglose, para componerModificadores.
 *
 * @param {Object} jugador
 * @param {Object} inventario
 * @returns {{total: number, desglose: Array<{fuente: string, valor: number}>}}
 */
export function penalizacion(jugador, inventario) {
  const a = analizar(jugador, inventario);
  if (a.modificador === 0) return { total: 0, desglose: [] };

  return {
    total: a.modificador,
    desglose: [{ fuente: `Carga (${a.estado.nombre.toLowerCase()})`, valor: a.modificador }],
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPROBACIONES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Comprueba si cabe un objeto más.
 *
 * Devuelve `permitido` en vez de un simple booleano porque el motor nunca
 * impide recoger algo: avisa de que quedarás sobrecargado y deja decidir. Solo
 * la inmovilización total bloquea.
 *
 * @param {Object} jugador
 * @param {Object} inventario
 * @param {Object} objeto Instancia que se pretende añadir.
 * @returns {{cabe: boolean, permitido: boolean, cargaResultante: number, estadoResultante: Object, aviso: string|null}}
 */
export function cabe(jugador, inventario, objeto) {
  const maximo = capacidad(jugador);
  const actual = cargaActual(inventario);
  const nueva = actual + pesoTotal(objeto);

  const estadoNuevo = estadoCarga(nueva, maximo);
  const estadoViejo = estadoCarga(actual, maximo);

  let aviso = null;
  if (estadoNuevo.clave !== estadoViejo.clave) {
    aviso = estadoNuevo.clave === 'inmovilizado'
      ? 'No puedes cargar con más peso'
      : `Al cogerlo quedarás ${estadoNuevo.nombre.toLowerCase()}`;
  }

  return {
    cabe: nueva <= maximo,
    permitido: estadoNuevo.clave !== 'inmovilizado',
    cargaResultante: Math.round(nueva * 100) / 100,
    estadoResultante: estadoNuevo,
    aviso,
  };
}

/**
 * Sugiere qué soltar para volver a un estado de carga aceptable.
 *
 * El orden de la sugerencia no es casual: primero lo más pesado y menos
 * valioso, y nunca lo equipado ni lo irreemplazable. La idea es proponer soltar
 * chatarra, no el cuaderno de glifos.
 *
 * @param {Object} jugador
 * @param {Object} inventario
 * @param {string} [objetivo='cargado'] Estado al que se quiere llegar.
 * @returns {Array<{objeto: Object, peso: number, valor: number, razon: string}>}
 */
export function sugerirDescarte(jugador, inventario, objetivo = 'cargado') {
  const maximo = capacidad(jugador);
  const actual = cargaActual(inventario);

  const fila = OBJETOS.impedimenta.find((f) => f.etiqueta === objetivo);
  const limite = maximo * (fila?.desde ?? 0.7);

  if (actual <= limite) return [];

  const candidatos = Object.values(inventario?.objetos?.porId ?? {})
    .filter((o) => !o.equipado)
    .filter((o) => {
      const p = o.propiedades ?? [];
      return !p.includes('irreemplazable');
    })
    // Ratio peso/valor: cuanto más pesa y menos vale, antes se sugiere soltarlo.
    .map((o) => ({
      objeto: o,
      peso: pesoTotal(o),
      valor: o.valor * o.cantidad,
      ratio: pesoTotal(o) / Math.max(1, o.valor * o.cantidad),
    }))
    .sort((a, b) => b.ratio - a.ratio);

  const sugerencias = [];
  let restante = actual - limite;

  for (const c of candidatos) {
    if (restante <= 0) break;
    sugerencias.push({
      objeto: c.objeto,
      peso: c.peso,
      valor: c.valor,
      razon: c.valor < 5 ? 'poco valor y mucho peso' : 'pesa bastante',
    });
    restante -= c.peso;
  }

  return sugerencias;
}

/* ═══════════════════════════════════════════════════════════════════════════
   EFECTOS DERIVADOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Multiplicador de fatiga por carga.
 *
 * Ir cargado cansa más rápido. No es una penalización adicional a las tiradas:
 * es un coste distinto, que se paga en el desgaste del turno.
 *
 * @param {Object} jugador
 * @param {Object} inventario
 * @returns {number}
 */
export function multiplicadorFatiga(jugador, inventario) {
  const a = analizar(jugador, inventario);
  const factores = { ligero: 1, cargado: 1.3, sobrecargado: 1.8, inmovilizado: 2.5 };
  return factores[a.estado.clave] ?? 1;
}

/**
 * Comprueba si el personaje puede viajar en su estado actual.
 * @param {Object} jugador
 * @param {Object} inventario
 * @returns {{puede: boolean, motivo: string|null}}
 */
export function puedeViajar(jugador, inventario) {
  const a = analizar(jugador, inventario);
  if (a.inmovil) {
    return { puede: false, motivo: 'Llevas demasiado peso para moverte' };
  }
  return { puede: true, motivo: null };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESENTACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Datos de carga para la barra del panel de inventario.
 * @param {Object} jugador
 * @param {Object} inventario
 * @returns {Object}
 */
export function paraInterfaz(jugador, inventario) {
  const a = analizar(jugador, inventario);

  return {
    actual: a.carga,
    maximo: a.maximo,
    porcentaje: Math.round(a.fraccion * 100),
    etiqueta: a.estado.nombre,
    modificador: a.modificador,
    nivel: a.estado.clave === 'ligero' ? 'normal'
      : a.estado.clave === 'cargado' ? 'alerta'
      : 'critico',
    texto: `${a.carga} / ${a.maximo}`,
  };
}

/**
 * Descripción de la carga para el prompt del director.
 * @param {Object} jugador
 * @param {Object} inventario
 * @returns {string|null}
 */
export function paraDirector(jugador, inventario) {
  const a = analizar(jugador, inventario);
  if (!a.penalizado) return null;

  const textos = {
    cargado: 'Va cargado y se mueve con cierta torpeza.',
    sobrecargado: 'Va muy sobrecargado: cada paso le cuesta.',
    inmovilizado: 'Lleva tanto peso que apenas puede moverse.',
  };

  return textos[a.estado.clave] ?? null;
}

export default {
  capacidad,
  cargaActual,
  estadoCarga,
  analizar,
  penalizacion,
  cabe,
  sugerirDescarte,
  multiplicadorFatiga,
  puedeViajar,
  paraInterfaz,
  paraDirector,
};
