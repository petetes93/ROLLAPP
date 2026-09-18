/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · world/MapGraph.js
 * ---------------------------------------------------------------------------
 * Navegación del mapa como grafo real.
 *
 * Dijkstra con tres criterios de coste, porque «la mejor ruta» depende de qué
 * te importe:
 *
 *   · DISTANCIA — la más corta en horas
 *   · SEGURIDAD — la que evita los tramos peligrosos, aunque dé la vuelta
 *   · TIEMPO — la más rápida teniendo en cuenta el tipo de terreno
 *
 * Distinción importante: hay un MAPA REAL y un MAPA CONOCIDO. El jugador solo
 * puede planificar rutas por lugares que ha descubierto, aunque exista un
 * atajo que no conoce. Eso hace que explorar tenga recompensa concreta:
 * literalmente abre caminos.
 *
 * Funciones puras.
 *
 * Dependencias: locations.data.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { LUGARES, obtenerLugar } from '../data/locations.data.js';

/* ═══════════════════════════════════════════════════════════════════════════
   COSTES POR TIPO DE RUTA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Multiplicadores de tiempo según el tipo de ruta.
 *
 * Un camino se recorre a paso normal; un paso de montaña cuesta el doble por
 * hora nominal.
 */
export const COSTE_TIPO = Object.freeze({
  camino: 1,
  sendero: 1.3,
  paso: 2,
  travesia: 1.6,
  tunel: 1.4,
});

/** Criterios de optimización disponibles. */
export const CRITERIO = Object.freeze({
  DISTANCIA: 'distancia',
  SEGURIDAD: 'seguridad',
  TIEMPO: 'tiempo',
});

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTRUCCIÓN DEL GRAFO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Construye el grafo de adyacencia.
 *
 * Las conexiones se declaran en una dirección en los datos, pero el grafo es
 * bidireccional: si de A se puede ir a B, de B se puede volver a A.
 *
 * @param {Object} [opciones]
 * @param {Set<string>} [opciones.conocidos] Limita el grafo a estos lugares.
 * @param {string} [opciones.estacion] Cierra las rutas estacionales.
 * @param {Object} [opciones.efectosEventos] Puede cerrar pasos.
 * @returns {Map<string, Array<Object>>}
 */
export function construir(opciones = {}) {
  const { conocidos, estacion, efectosEventos } = opciones;
  const grafo = new Map();

  const visible = (refId) => !conocidos || conocidos.has(refId);

  const anadir = (desde, hasta, conexion) => {
    if (!grafo.has(desde)) grafo.set(desde, []);
    grafo.get(desde).push({ ...conexion, hasta });
  };

  for (const [refId, lugar] of Object.entries(LUGARES)) {
    if (!visible(refId)) continue;
    if (!grafo.has(refId)) grafo.set(refId, []);

    for (const conexion of lugar.conexiones ?? []) {
      if (!visible(conexion.hasta)) continue;

      // ─── Cierres estacionales ─────────────────────────────────────────
      // Un paso de montaña en invierno no es una ruta más lenta: no existe.
      if (conexion.estacional && conexion.estacional === estacion) continue;

      // Un evento de invierno duro cierra todos los pasos.
      if (efectosEventos?.pasosCerrados && conexion.tipo === 'paso') continue;

      anadir(refId, conexion.hasta, conexion);
      anadir(conexion.hasta, refId, conexion);
    }
  }

  // Se eliminan los duplicados que produce la bidireccionalidad cuando ambos
  // lugares declaran la misma conexión.
  for (const [refId, conexiones] of grafo) {
    const vistas = new Map();
    for (const c of conexiones) {
      if (!vistas.has(c.hasta)) vistas.set(c.hasta, c);
    }
    grafo.set(refId, [...vistas.values()]);
  }

  return grafo;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COSTE DE UNA ARISTA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Calcula el coste de recorrer una conexión según el criterio.
 *
 * @param {Object} conexion
 * @param {string} criterio
 * @param {Object} [contexto]
 * @returns {number}
 */
export function coste(conexion, criterio, contexto = {}) {
  const distancia = conexion.distancia ?? 1;
  const peligro = (conexion.peligro ?? 0) + (contexto.efectosEventos?.peligroRutas ?? 0);

  switch (criterio) {
    case CRITERIO.DISTANCIA:
      return distancia;

    case CRITERIO.SEGURIDAD:
      // El peligro pesa de forma cuadrática: dar un rodeo largo compensa si
      // evita un tramo muy peligroso.
      return distancia + Math.pow(Math.max(0, peligro), 2) * 3;

    case CRITERIO.TIEMPO:
      return distancia * (COSTE_TIPO[conexion.tipo] ?? 1);

    default:
      return distancia;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   DIJKSTRA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Encuentra la ruta óptima entre dos lugares.
 *
 * @param {string} origen
 * @param {string} destino
 * @param {Object} [opciones]
 * @param {string} [opciones.criterio='distancia']
 * @param {Set<string>} [opciones.conocidos]
 * @param {string} [opciones.estacion]
 * @param {Object} [opciones.efectosEventos]
 * @returns {{
 *   encontrada: boolean, ruta: string[], tramos: Array<Object>,
 *   distanciaTotal: number, peligroMaximo: number, tiempoTotal: number,
 *   motivo: string|null
 * }}
 */
export function ruta(origen, destino, opciones = {}) {
  const criterio = opciones.criterio ?? CRITERIO.DISTANCIA;

  const vacio = {
    encontrada: false, ruta: [], tramos: [],
    distanciaTotal: 0, peligroMaximo: 0, tiempoTotal: 0,
    motivo: null,
  };

  if (origen === destino) {
    return { ...vacio, encontrada: true, ruta: [origen], motivo: 'ya estás ahí' };
  }

  if (!obtenerLugar(origen) || !obtenerLugar(destino)) {
    return { ...vacio, motivo: 'lugar desconocido' };
  }

  if (opciones.conocidos && !opciones.conocidos.has(destino)) {
    return { ...vacio, motivo: 'no conoces ese lugar' };
  }

  const grafo = construir(opciones);

  if (!grafo.has(origen)) return { ...vacio, motivo: 'origen aislado' };

  // ─── Dijkstra ───────────────────────────────────────────────────────────
  const costes = new Map([[origen, 0]]);
  const previos = new Map();
  const conexionUsada = new Map();
  const visitados = new Set();

  // Con veinte nodos, una cola lineal es más simple y no se nota.
  const pendientes = new Set([origen]);

  while (pendientes.size) {
    // Se extrae el pendiente de menor coste.
    let actual = null;
    let menor = Infinity;

    for (const nodo of pendientes) {
      const c = costes.get(nodo) ?? Infinity;
      if (c < menor) { menor = c; actual = nodo; }
    }

    if (actual === null) break;

    pendientes.delete(actual);
    visitados.add(actual);

    if (actual === destino) break;

    for (const conexion of grafo.get(actual) ?? []) {
      if (visitados.has(conexion.hasta)) continue;

      const nuevoCoste = menor + coste(conexion, criterio, opciones);

      if (nuevoCoste < (costes.get(conexion.hasta) ?? Infinity)) {
        costes.set(conexion.hasta, nuevoCoste);
        previos.set(conexion.hasta, actual);
        conexionUsada.set(conexion.hasta, conexion);
        pendientes.add(conexion.hasta);
      }
    }
  }

  if (!previos.has(destino) && destino !== origen) {
    return {
      ...vacio,
      motivo: opciones.estacion === 'invierno'
        ? 'no hay ruta abierta en esta época del año'
        : 'no hay forma de llegar desde aquí',
    };
  }

  // ─── Reconstrucción ─────────────────────────────────────────────────────
  const camino = [destino];
  const tramos = [];

  let nodo = destino;
  while (previos.has(nodo)) {
    const conexion = conexionUsada.get(nodo);
    const anterior = previos.get(nodo);

    tramos.unshift({
      desde: anterior,
      hasta: nodo,
      distancia: conexion.distancia,
      tipo: conexion.tipo,
      peligro: conexion.peligro ?? 0,
      nombreDesde: obtenerLugar(anterior)?.nombre,
      nombreHasta: obtenerLugar(nodo)?.nombre,
    });

    nodo = anterior;
    camino.unshift(nodo);
  }

  const distanciaTotal = tramos.reduce((a, t) => a + t.distancia, 0);
  const tiempoTotal = tramos.reduce((a, t) => a + t.distancia * (COSTE_TIPO[t.tipo] ?? 1), 0);
  const peligroMaximo = tramos.reduce((max, t) => Math.max(max, t.peligro), 0);

  return {
    encontrada: true,
    ruta: camino,
    tramos,
    distanciaTotal,
    tiempoTotal: Math.round(tiempoTotal * 10) / 10,
    peligroMaximo,
    motivo: null,
  };
}

/**
 * Compara las rutas que producen los tres criterios.
 *
 * Permite ofrecer al jugador la elección: la corta y peligrosa, o la larga y
 * segura. Solo se devuelven las que difieren.
 *
 * @param {string} origen
 * @param {string} destino
 * @param {Object} [opciones]
 * @returns {Array<Object>}
 */
export function alternativas(origen, destino, opciones = {}) {
  const criterios = [
    { clave: CRITERIO.DISTANCIA, nombre: 'la más corta' },
    { clave: CRITERIO.SEGURIDAD, nombre: 'la más segura' },
    { clave: CRITERIO.TIEMPO, nombre: 'la más rápida' },
  ];

  const encontradas = [];
  const firmas = new Set();

  for (const c of criterios) {
    const r = ruta(origen, destino, { ...opciones, criterio: c.clave });
    if (!r.encontrada) continue;

    // Se descartan las que coinciden con una anterior.
    const firma = r.ruta.join('>');
    if (firmas.has(firma)) continue;

    firmas.add(firma);
    encontradas.push({ ...r, criterio: c.clave, nombre: c.nombre });
  }

  return encontradas;
}

/* ═══════════════════════════════════════════════════════════════════════════
   VECINDAD Y ALCANCE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Lugares directamente conectados con uno dado.
 *
 * @param {string} refId
 * @param {Object} [opciones]
 * @returns {Array<Object>}
 */
export function vecinos(refId, opciones = {}) {
  const grafo = construir(opciones);

  return (grafo.get(refId) ?? []).map((c) => ({
    refId: c.hasta,
    nombre: obtenerLugar(c.hasta)?.nombre ?? c.hasta,
    distancia: c.distancia,
    tipo: c.tipo,
    peligro: c.peligro ?? 0,
    conocido: !opciones.conocidos || opciones.conocidos.has(c.hasta),
  }));
}

/**
 * Lugares alcanzables dentro de un límite de coste.
 *
 * Se usa para saber a dónde se puede llegar con las provisiones que se llevan.
 *
 * @param {string} origen
 * @param {number} limite
 * @param {Object} [opciones]
 * @returns {Array<Object>}
 */
export function alcanzables(origen, limite, opciones = {}) {
  const grafo = construir(opciones);
  const criterio = opciones.criterio ?? CRITERIO.DISTANCIA;

  const costes = new Map([[origen, 0]]);
  const pendientes = [origen];
  const salida = [];

  while (pendientes.length) {
    const actual = pendientes.shift();
    const costeActual = costes.get(actual) ?? 0;

    for (const conexion of grafo.get(actual) ?? []) {
      const nuevo = costeActual + coste(conexion, criterio, opciones);

      if (nuevo > limite) continue;
      if (nuevo >= (costes.get(conexion.hasta) ?? Infinity)) continue;

      costes.set(conexion.hasta, nuevo);
      pendientes.push(conexion.hasta);
    }
  }

  for (const [refId, c] of costes) {
    if (refId === origen) continue;
    salida.push({
      refId,
      nombre: obtenerLugar(refId)?.nombre ?? refId,
      coste: Math.round(c * 10) / 10,
    });
  }

  return salida.sort((a, b) => a.coste - b.coste);
}

/* ═══════════════════════════════════════════════════════════════════════════
   POSICIONES PARA EL MAPA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Calcula posiciones para dibujar el mapa.
 *
 * No hay coordenadas en los datos a propósito: se derivan de la estructura del
 * grafo. Los lugares se agrupan por región y se distribuyen en círculo dentro de
 * cada grupo, y las regiones se reparten en una rejilla.
 *
 * Es un diseño automático, no cartografía: sirve para orientarse, no para medir.
 *
 * @param {Object} [opciones]
 * @param {Set<string>} [opciones.conocidos]
 * @returns {Map<string, {x: number, y: number, region: string}>}
 */
export function posiciones(opciones = {}) {
  const { conocidos } = opciones;
  const posiciones = new Map();

  // Se agrupan por región.
  const porRegion = new Map();

  for (const [refId, lugar] of Object.entries(LUGARES)) {
    if (conocidos && !conocidos.has(refId)) continue;

    if (!porRegion.has(lugar.region)) porRegion.set(lugar.region, []);
    porRegion.get(lugar.region).push(refId);
  }

  // Las regiones se reparten en una rejilla de tres columnas.
  const regiones = [...porRegion.keys()];
  const columnas = 3;

  regiones.forEach((region, i) => {
    const columna = i % columnas;
    const fila = Math.floor(i / columnas);

    const centroX = 20 + columna * 30;
    const centroY = 25 + fila * 35;

    const lugares = porRegion.get(region);

    // Un solo lugar va al centro de su región.
    if (lugares.length === 1) {
      posiciones.set(lugares[0], { x: centroX, y: centroY, region });
      return;
    }

    // Varios se distribuyen en círculo.
    const radio = Math.min(11, 4 + lugares.length * 1.4);

    lugares.forEach((refId, j) => {
      const angulo = (j / lugares.length) * Math.PI * 2 - Math.PI / 2;

      posiciones.set(refId, {
        x: Math.round((centroX + Math.cos(angulo) * radio) * 10) / 10,
        y: Math.round((centroY + Math.sin(angulo) * radio) * 10) / 10,
        region,
      });
    });
  });

  return posiciones;
}

/**
 * Aristas para dibujar, con sus posiciones ya resueltas.
 *
 * @param {Map} pos Salida de posiciones().
 * @param {Object} [opciones]
 * @returns {Array<Object>}
 */
export function aristas(pos, opciones = {}) {
  const grafo = construir(opciones);
  const salida = [];
  const vistas = new Set();

  for (const [desde, conexiones] of grafo) {
    const p1 = pos.get(desde);
    if (!p1) continue;

    for (const c of conexiones) {
      const p2 = pos.get(c.hasta);
      if (!p2) continue;

      // Cada arista se dibuja una vez, no dos.
      const clave = [desde, c.hasta].sort().join('|');
      if (vistas.has(clave)) continue;
      vistas.add(clave);

      salida.push({
        desde, hasta: c.hasta,
        x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
        tipo: c.tipo,
        peligro: c.peligro ?? 0,
        distancia: c.distancia,
        estacional: c.estacional ?? null,
      });
    }
  }

  return salida;
}

/* ═══════════════════════════════════════════════════════════════════════════
   DESCRIPCIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Describe una ruta en lenguaje natural.
 *
 * Se muestra antes de emprender el viaje: el jugador debería saber a qué se
 * compromete.
 *
 * @param {Object} r Salida de ruta().
 * @returns {string}
 */
export function describir(r) {
  if (!r.encontrada) return r.motivo ?? 'No hay ruta.';
  if (r.ruta.length <= 1) return 'Ya estás ahí.';

  const partes = [];

  const horas = Math.round(r.tiempoTotal);
  const dias = Math.floor(horas / 12);

  if (dias >= 1) {
    partes.push(`${dias} día${dias === 1 ? '' : 's'} de viaje`);
  } else {
    partes.push(`unas ${horas} horas de camino`);
  }

  // Los tramos intermedios, si hay.
  if (r.ruta.length > 2) {
    const intermedios = r.tramos
      .slice(0, -1)
      .map((t) => t.nombreHasta)
      .filter(Boolean);

    if (intermedios.length) {
      partes.push(`pasando por ${intermedios.join(' y ')}`);
    }
  }

  // El peligro se avisa siempre que sea apreciable.
  if (r.peligroMaximo >= 4) {
    partes.push('el camino es muy peligroso');
  } else if (r.peligroMaximo >= 2) {
    partes.push('hay tramos poco seguros');
  }

  return `${partes.join(', ')}.`;
}

/**
 * Provisiones necesarias para una ruta.
 *
 * @param {Object} r
 * @param {Object} [efectosEventos]
 * @returns {{raciones: number, agua: number}}
 */
export function provisionesNecesarias(r, efectosEventos = {}) {
  if (!r.encontrada) return { raciones: 0, agua: 0 };

  const multiplicador = efectosEventos.consumoRaciones ?? 1;

  // Una ración y un odre por cada doce horas, redondeando al alza.
  const jornadas = Math.ceil(r.tiempoTotal / 12);

  return {
    raciones: Math.ceil(jornadas * multiplicador),
    agua: Math.ceil(jornadas * multiplicador),
  };
}

export default {
  COSTE_TIPO,
  CRITERIO,
  construir,
  coste,
  ruta,
  alternativas,
  vecinos,
  alcanzables,
  posiciones,
  aristas,
  describir,
  provisionesNecesarias,
};
