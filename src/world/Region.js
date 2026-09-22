/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · world/Region.js
 * ---------------------------------------------------------------------------
 * Estado de una región.
 *
 * Una región es más que la suma de sus lugares: tiene una actitud general hacia
 * el jugador, un progreso de exploración y un depósito de rumores que se van
 * gastando.
 *
 * La ACTITUD REGIONAL se calcula ponderando la reputación con las facciones
 * presentes, y la dominante pesa el doble. Es lo que hace que entrar en las
 * Montañas del Yunque siendo enemigo del gremio se note desde el primer pueblo,
 * aunque nadie te conozca personalmente.
 *
 * Funciones puras.
 *
 * Dependencias: locations.data, factions.data.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { obtenerRegion, lugaresDe } from '../data/locations.data.js';
import { faccionesDe, obtenerFaccion } from '../data/factions.data.js';

/* ═══════════════════════════════════════════════════════════════════════════
   CREACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} EstadoRegion
 * @property {string} refId
 * @property {boolean} visitada
 * @property {number} primeraVisita
 * @property {string[]} rumoresOidos
 * @property {number} lugaresDescubiertos
 */

/**
 * Crea el estado inicial de una región.
 *
 * @param {string} refId
 * @param {Object} [opciones]
 * @returns {EstadoRegion|null}
 */
export function crear(refId, opciones = {}) {
  const plantilla = obtenerRegion(refId);
  if (!plantilla) return null;

  return {
    refId,
    nombre: plantilla.nombre,
    visitada: opciones.visitada ?? false,
    primeraVisita: opciones.dia ?? null,
    rumoresOidos: [],
    lugaresDescubiertos: 0,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROGRESO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Calcula el progreso de exploración de una región.
 *
 * @param {string} refId
 * @param {Object} lugaresConocidos Mapa de estados de lugar.
 * @returns {{descubiertos: number, visitados: number, total: number, fraccion: number, completa: boolean}}
 */
export function progreso(refId, lugaresConocidos) {
  const total = lugaresDe(refId).length;

  const deLaRegion = Object.values(lugaresConocidos ?? {})
    .filter((l) => l.region === refId);

  const descubiertos = deLaRegion.length;
  const visitados = deLaRegion.filter((l) => l.visitado).length;

  return {
    descubiertos,
    visitados,
    total,
    fraccion: total > 0 ? visitados / total : 0,
    completa: total > 0 && visitados >= total,
  };
}

/**
 * Lugares de la región que aún no se conocen.
 *
 * @param {string} refId
 * @param {Object} lugaresConocidos
 * @returns {number}
 */
export function porDescubrir(refId, lugaresConocidos) {
  const conocidos = new Set(Object.keys(lugaresConocidos ?? {}));
  return lugaresDe(refId).filter((l) => !conocidos.has(l.refId)).length;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACTITUD REGIONAL
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Actitud general de una región hacia el jugador.
 *
 * Pondera la reputación con las facciones presentes. La dominante —la primera
 * de la lista— pesa el doble: quien manda aquí importa más.
 *
 * @param {string} refId
 * @param {Record<string, number>} reputaciones
 * @returns {{valor: number, etiqueta: string, desglose: Array<Object>}}
 */
export function actitud(refId, reputaciones = {}) {
  const presentes = faccionesDe(refId);

  if (!presentes.length) {
    return { valor: 0, etiqueta: 'indiferente', desglose: [] };
  }

  const desglose = [];
  let suma = 0;
  let pesos = 0;

  presentes.forEach((faccion, i) => {
    const reputacion = reputaciones[faccion.refId] ?? 0;

    // La primera de la lista es la dominante y pesa el doble.
    const peso = i === 0 ? 2 : 1;

    suma += reputacion * peso;
    pesos += peso;

    if (reputacion !== 0) {
      desglose.push({
        faccion: faccion.nombre,
        reputacion,
        dominante: i === 0,
      });
    }
  });

  const valor = pesos > 0 ? Math.round(suma / pesos) : 0;

  return { valor, etiqueta: _etiquetaActitud(valor), desglose };
}

/**
 * Etiqueta de una actitud regional.
 * @param {number} valor
 * @returns {string}
 * @private
 */
function _etiquetaActitud(valor) {
  if (valor >= 60) return 'te reciben como a uno de los suyos';
  if (valor >= 30) return 'te tratan bien';
  if (valor >= 10) return 'te toleran sin problema';
  if (valor > -10) return 'te son indiferentes';
  if (valor > -30) return 'desconfían de ti';
  if (valor > -60) return 'no eres bienvenido';
  return 'te quieren fuera de aquí';
}

/**
 * Modificador que la actitud regional aplica a las pruebas sociales.
 *
 * Es moderado a propósito: la actitud personal de quien tienes delante debe
 * pesar más que la reputación general.
 *
 * @param {string} refId
 * @param {Record<string, number>} reputaciones
 * @returns {number}
 */
export function modificadorSocial(refId, reputaciones) {
  const { valor } = actitud(refId, reputaciones);
  return Math.round(valor / 40);
}

/* ═══════════════════════════════════════════════════════════════════════════
   RUMORES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Rumores de la región que el jugador aún no ha oído.
 *
 * @param {EstadoRegion} estado
 * @returns {string[]}
 */
export function rumoresDisponibles(estado) {
  const plantilla = obtenerRegion(estado.refId);
  const oidos = new Set(estado.rumoresOidos ?? []);

  return (plantilla?.rumores ?? []).filter((r) => !oidos.has(r));
}

/**
 * Marca un rumor como oído.
 *
 * @param {EstadoRegion} estado
 * @param {string} rumor
 * @returns {EstadoRegion}
 */
export function oirRumor(estado, rumor) {
  if (estado.rumoresOidos.includes(rumor)) return estado;

  return { ...estado, rumoresOidos: [...estado.rumoresOidos, rumor] };
}

/**
 * Comprueba si quedan rumores por oír.
 * @param {EstadoRegion} estado
 * @returns {boolean}
 */
export function quedanRumores(estado) {
  return rumoresDisponibles(estado).length > 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   VISITA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Registra la primera entrada en la región.
 *
 * @param {EstadoRegion} estado
 * @param {number} dia
 * @returns {{estado: EstadoRegion, primeraVez: boolean}}
 */
export function visitar(estado, dia) {
  const primeraVez = !estado.visitada;

  return {
    estado: {
      ...estado,
      visitada: true,
      primeraVisita: estado.primeraVisita ?? dia,
    },
    primeraVez,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESENTACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Datos de la región para la interfaz.
 *
 * @param {EstadoRegion} estado
 * @param {Object} lugaresConocidos
 * @param {Record<string, number>} reputaciones
 * @returns {Object}
 */
export function paraInterfaz(estado, lugaresConocidos, reputaciones) {
  const plantilla = obtenerRegion(estado.refId);
  const p = progreso(estado.refId, lugaresConocidos);
  const a = actitud(estado.refId, reputaciones);

  return {
    refId: estado.refId,
    nombre: plantilla?.nombre ?? estado.refId,
    terreno: plantilla?.terrenoDominante,
    peligro: plantilla?.peligroBase ?? 1,
    visitada: estado.visitada,
    progreso: p,
    actitud: a,
    facciones: faccionesDe(estado.refId).map((f) => ({
      refId: f.refId,
      nombre: f.nombre,
      reputacion: reputaciones?.[f.refId] ?? 0,
    })),
    rumoresPendientes: rumoresDisponibles(estado).length,
  };
}

/**
 * Descripción de la región para el director.
 *
 * @param {EstadoRegion} estado
 * @param {Record<string, number>} reputaciones
 * @returns {string}
 */
export function paraDirector(estado, reputaciones) {
  const plantilla = obtenerRegion(estado.refId);
  if (!plantilla) return '';

  const partes = [`REGIÓN: ${plantilla.nombre}.`];

  partes.push(plantilla.promptLore);

  // ─── Actitud ────────────────────────────────────────────────────────────
  const a = actitud(estado.refId, reputaciones);

  if (Math.abs(a.valor) >= 10) {
    partes.push(`Aquí ${a.etiqueta}.`);

    // El motivo da material narrativo: la gente sabe POR QUÉ te mira así.
    const dominante = a.desglose.find((d) => d.dominante);
    if (dominante) {
      partes.push(dominante.reputacion > 0
        ? `Es por tu relación con ${dominante.faccion}.`
        : `Es por tus problemas con ${dominante.faccion}.`);
    }
  }

  // ─── Primera vez ────────────────────────────────────────────────────────
  if (!estado.visitada) {
    partes.push('El personaje entra en esta región por primera vez: todo le resulta nuevo.');
  }

  return partes.join(' ');
}

/**
 * Elige un rumor apropiado para que un PNJ lo cuente.
 *
 * @param {EstadoRegion} estado
 * @param {import('../core/RNG.js').Flujo} flujo
 * @returns {string|null}
 */
export function rumorParaContar(estado, flujo) {
  const disponibles = rumoresDisponibles(estado);
  if (!disponibles.length) return null;

  return flujo.elegir(disponibles);
}

export default {
  crear,
  progreso,
  porDescubrir,
  actitud,
  modificadorSocial,
  rumoresDisponibles,
  oirRumor,
  quedanRumores,
  visitar,
  paraInterfaz,
  paraDirector,
  rumorParaContar,
};
