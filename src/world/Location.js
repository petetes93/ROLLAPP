/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · world/Location.js
 * ---------------------------------------------------------------------------
 * Estado dinámico de un lugar.
 *
 * Separación deliberada: la PLANTILLA de `locations.data.js` es inmutable y
 * describe lo que el lugar es; el ESTADO que se maneja aquí describe lo que le
 * ha pasado. Vado del Yunque siempre tendrá una fragua, pero solo esta partida
 * concreta tiene registrado que el herrero te debe un favor.
 *
 * Esa separación permite dos cosas: que el estado guardado sea pequeño —solo lo
 * que cambió— y que una actualización de los datos base no rompa las partidas
 * antiguas.
 *
 * Funciones puras.
 *
 * Dependencias: locations.data.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { obtenerLugar, obtenerRegion } from '../data/locations.data.js';

/* ═══════════════════════════════════════════════════════════════════════════
   CREACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} EstadoLugar
 * @property {string} refId
 * @property {string} nombre Copia, para no depender de la plantilla al mostrar.
 * @property {boolean} visitado
 * @property {number} visitas
 * @property {number} primeraVisita Día.
 * @property {number} ultimaVisita Día.
 * @property {string} descubrimiento Cómo se supo de él.
 * @property {string[]} ganchosUsados
 * @property {Array<Object>} cambios Evolución mientras estabas fuera.
 * @property {Array<string>} notasDirector Cosas que el director estableció aquí.
 * @property {number} exploracion 0-1: cuánto se ha registrado.
 * @property {string[]} sublugaresVistos
 * @property {boolean} intuido true si se sabe que existe pero no dónde.
 */

/**
 * Crea el estado inicial de un lugar.
 *
 * @param {string} refId
 * @param {Object} [opciones]
 * @param {string} [opciones.motivo] Cómo se descubrió.
 * @param {number} [opciones.dia]
 * @param {boolean} [opciones.intuido=false]
 * @returns {EstadoLugar|null}
 */
export function crear(refId, opciones = {}) {
  const plantilla = obtenerLugar(refId);
  if (!plantilla) return null;

  return {
    refId,
    nombre: plantilla.nombre,
    region: plantilla.region,

    visitado: false,
    visitas: 0,
    primeraVisita: null,
    ultimaVisita: null,

    descubrimiento: opciones.motivo ?? 'inicial',
    diaDescubrimiento: opciones.dia ?? 0,

    // Un lugar intuido se sabe que existe pero no se puede viajar a él: hay que
    // encontrarlo primero.
    intuido: opciones.intuido ?? false,

    ganchosUsados: [],
    cambios: [],
    notasDirector: [],

    exploracion: 0,
    sublugaresVistos: [],
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   VISITAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Registra una visita.
 *
 * @param {EstadoLugar} estado
 * @param {number} dia
 * @returns {{estado: EstadoLugar, primeraVez: boolean, cambiosPendientes: Array<Object>}}
 */
export function visitar(estado, dia) {
  const primeraVez = !estado.visitado;

  // Los cambios ocurridos durante la ausencia se entregan para narrarlos y se
  // marcan como vistos.
  const cambiosPendientes = (estado.cambios ?? []).filter((c) => !c.visto);

  return {
    estado: {
      ...estado,
      visitado: true,
      intuido: false,
      visitas: estado.visitas + 1,
      primeraVisita: estado.primeraVisita ?? dia,
      ultimaVisita: dia,
      cambios: (estado.cambios ?? []).map((c) => ({ ...c, visto: true })),
    },
    primeraVez,
    cambiosPendientes,
  };
}

/**
 * Registra que se ha entrado en un sublugar.
 *
 * @param {EstadoLugar} estado
 * @param {string} refIdSublugar
 * @returns {EstadoLugar}
 */
export function verSublugar(estado, refIdSublugar) {
  if (estado.sublugaresVistos.includes(refIdSublugar)) return estado;

  return {
    ...estado,
    sublugaresVistos: [...estado.sublugaresVistos, refIdSublugar],
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXPLORACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Aumenta el grado de exploración del lugar.
 *
 * Llega a 1 cuando se ha registrado a fondo. Un lugar completamente explorado
 * ya no oculta nada, y eso se le dice al jugador para que no pierda el tiempo.
 *
 * @param {EstadoLugar} estado
 * @param {number} cantidad
 * @returns {{estado: EstadoLugar, completo: boolean}}
 */
export function explorar(estado, cantidad) {
  const antes = estado.exploracion ?? 0;
  const despues = Math.min(1, antes + cantidad);

  return {
    estado: { ...estado, exploracion: despues },
    completo: despues >= 1 && antes < 1,
  };
}

/**
 * Comprueba si queda algo por descubrir aquí.
 *
 * @param {EstadoLugar} estado
 * @returns {{quedaAlgo: boolean, fraccion: number}}
 */
export function quedaPorExplorar(estado) {
  const plantilla = obtenerLugar(estado.refId);

  const sublugaresTotales = (plantilla?.sublugares ?? []).length;
  const sublugaresVistos = estado.sublugaresVistos.length;

  const ganchosTotales = (plantilla?.ganchos ?? []).length;
  const ganchosUsados = estado.ganchosUsados.length;

  const quedaAlgo = (estado.exploracion ?? 0) < 1
    || sublugaresVistos < sublugaresTotales
    || ganchosUsados < ganchosTotales;

  return { quedaAlgo, fraccion: estado.exploracion ?? 0 };
}

/* ═══════════════════════════════════════════════════════════════════════════
   GANCHOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Ganchos del lugar que aún no se han usado.
 *
 * @param {EstadoLugar} estado
 * @returns {string[]}
 */
export function ganchosDisponibles(estado) {
  const plantilla = obtenerLugar(estado.refId);
  const usados = new Set(estado.ganchosUsados ?? []);

  return (plantilla?.ganchos ?? []).filter((g) => !usados.has(g));
}

/**
 * Marca un gancho como usado.
 *
 * @param {EstadoLugar} estado
 * @param {string} gancho
 * @returns {EstadoLugar}
 */
export function usarGancho(estado, gancho) {
  if (estado.ganchosUsados.includes(gancho)) return estado;

  return { ...estado, ganchosUsados: [...estado.ganchosUsados, gancho] };
}

/* ═══════════════════════════════════════════════════════════════════════════
   EVOLUCIÓN Y NOTAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Registra un cambio ocurrido durante la ausencia.
 *
 * @param {EstadoLugar} estado
 * @param {Object} cambio
 * @returns {EstadoLugar}
 */
export function registrarCambio(estado, cambio) {
  const cambios = [...(estado.cambios ?? []), { ...cambio, visto: false }];

  // Se conservan los últimos: un lugar con veinte cambios pendientes no aporta
  // nada que no aporten los cuatro más recientes.
  return { ...estado, cambios: cambios.slice(-4) };
}

/**
 * Añade una nota del director sobre este lugar.
 *
 * Es lo que permite que el director establezca hechos con permanencia: si dice
 * que hay una estatua rota en la plaza, la estatua sigue rota en la próxima
 * visita.
 *
 * @param {EstadoLugar} estado
 * @param {string} nota
 * @returns {EstadoLugar}
 */
export function anotar(estado, nota) {
  const limpia = String(nota ?? '').trim().slice(0, 200);
  if (!limpia) return estado;

  if (estado.notasDirector.includes(limpia)) return estado;

  return {
    ...estado,
    notasDirector: [...estado.notasDirector, limpia].slice(-6),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESENTACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Datos del lugar para la interfaz.
 *
 * @param {EstadoLugar} estado
 * @returns {Object}
 */
export function paraInterfaz(estado) {
  const plantilla = obtenerLugar(estado.refId);
  const region = obtenerRegion(estado.region);

  return {
    refId: estado.refId,
    nombre: estado.nombre,
    region: region?.nombre ?? estado.region,
    tipo: plantilla?.tipo,
    visitado: estado.visitado,
    intuido: estado.intuido,
    visitas: estado.visitas,
    servicios: plantilla?.servicios ?? [],
    peligro: plantilla?.peligro ?? 0,
    exploracion: estado.exploracion ?? 0,
    quedaAlgo: quedaPorExplorar(estado).quedaAlgo,
    sublugares: (plantilla?.sublugares ?? []).map((s) => ({
      ...s,
      visto: estado.sublugaresVistos.includes(s.refId),
    })),
  };
}

/**
 * Descripción del lugar para el director.
 *
 * Es la sección más importante del contexto espacial: sin ella, el director
 * describe un sitio genérico en vez de este sitio.
 *
 * @param {EstadoLugar} estado
 * @param {Object} [opciones]
 * @returns {string}
 */
export function paraDirector(estado, opciones = {}) {
  const plantilla = obtenerLugar(estado.refId);
  if (!plantilla) return '';

  const partes = [`LUGAR: ${plantilla.nombre}.`];

  partes.push(plantilla.promptLore);

  // ─── Historia con el jugador ────────────────────────────────────────────
  if (estado.visitas === 0) {
    partes.push('El personaje llega aquí por primera vez.');
  } else if (estado.visitas === 1) {
    partes.push('El personaje ya estuvo aquí una vez.');
  } else {
    partes.push(`El personaje ha estado aquí ${estado.visitas} veces: conoce el sitio.`);
  }

  // ─── Lo que cambió mientras no estaba ───────────────────────────────────
  const pendientes = (estado.cambios ?? []).filter((c) => !c.visto);

  if (pendientes.length) {
    partes.push(`HA CAMBIADO: ${pendientes.map((c) => c.nota).join(' ')}`);
  }

  // ─── Lo que el director estableció antes ────────────────────────────────
  if (estado.notasDirector.length) {
    partes.push(`Establecido aquí: ${estado.notasDirector.join('; ')}.`);
  }

  // ─── Servicios ──────────────────────────────────────────────────────────
  if (plantilla.servicios?.length) {
    partes.push(`Servicios: ${plantilla.servicios.join(', ')}.`);
  }

  // ─── Sublugares ─────────────────────────────────────────────────────────
  if (plantilla.sublugares?.length) {
    const nombres = plantilla.sublugares.map((s) => s.nombre);
    partes.push(`Interiores: ${nombres.join(', ')}.`);
  }

  // ─── Gancho disponible ──────────────────────────────────────────────────
  // Solo uno: ofrecerle tres al director le invita a usarlos todos de golpe.
  const ganchos = ganchosDisponibles(estado);

  if (ganchos.length && opciones.incluirGancho !== false) {
    partes.push(`Situación disponible aquí, úsala si encaja: ${ganchos[0]}`);
  }

  return partes.join(' ');
}

/**
 * Describe los cambios pendientes para narrarlos al llegar.
 *
 * @param {Array<Object>} cambios
 * @returns {string}
 */
export function describirCambios(cambios) {
  if (!cambios?.length) return '';

  const notas = cambios.map((c) => c.nota).filter(Boolean);
  if (!notas.length) return '';

  return notas.join(' ');
}

/**
 * Etiqueta del grado de exploración.
 * @param {EstadoLugar} estado
 * @returns {string}
 */
export function etiquetaExploracion(estado) {
  const f = estado.exploracion ?? 0;

  if (f >= 1) return 'registrado a fondo';
  if (f >= 0.6) return 'bastante explorado';
  if (f >= 0.3) return 'apenas visto';
  return 'sin explorar';
}

export default {
  crear,
  visitar,
  verSublugar,
  explorar,
  quedaPorExplorar,
  ganchosDisponibles,
  usarGancho,
  registrarCambio,
  anotar,
  paraInterfaz,
  paraDirector,
  describirCambios,
  etiquetaExploracion,
};
