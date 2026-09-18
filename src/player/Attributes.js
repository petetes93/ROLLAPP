/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · player/Attributes.js
 * ---------------------------------------------------------------------------
 * Atributos del personaje: valores, modificadores y reparto por compra.
 *
 * Módulo de funciones puras. No toca el estado ni conoce el Store: recibe datos
 * y devuelve datos. Eso permite que la pantalla de creación calcule un reparto
 * hipotético sin ensuciar la partida, y que las pruebas lo verifiquen sin
 * montar medio motor.
 *
 * Los seis atributos del Sistema Núcleo d20:
 *   Vigor      — fuerza bruta, aguante físico, capacidad de carga
 *   Destreza   — precisión, reflejos, sigilo, esquiva
 *   Temple     — resistencia, voluntad, concentración
 *   Intelecto  — conocimiento, magia estudiada, análisis
 *   Astucia    — percepción, intuición, supervivencia
 *   Carisma    — presencia, persuasión, magia por pacto
 *
 * Dependencias: config/balance.config.js, utils/math.js.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { ATRIBUTOS } from '../config/balance.config.js';
import { saturar } from '../utils/math.js';

/* ═══════════════════════════════════════════════════════════════════════════
   METADATOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Información de presentación de cada atributo.
 * Vive aquí y no en /data porque son seis constantes del sistema, no contenido.
 */
export const META_ATRIBUTOS = Object.freeze({
  vigor: {
    nombre: 'Vigor',
    abreviatura: 'VIG',
    descripcion: 'Fuerza bruta, aguante y capacidad de carga.',
    afecta: ['Vida máxima', 'Daño cuerpo a cuerpo', 'Capacidad de carga'],
  },
  destreza: {
    nombre: 'Destreza',
    abreviatura: 'DES',
    descripcion: 'Precisión, reflejos y agilidad.',
    afecta: ['Iniciativa', 'Esquiva', 'Ataques a distancia'],
  },
  temple: {
    nombre: 'Temple',
    abreviatura: 'TEM',
    descripcion: 'Resistencia física y firmeza mental.',
    afecta: ['Resistencia a estados', 'Concentración', 'Moral'],
  },
  intelecto: {
    nombre: 'Intelecto',
    abreviatura: 'INT',
    descripcion: 'Conocimiento, análisis y magia estudiada.',
    afecta: ['Maná máximo', 'Saber arcano', 'Potencia de glifos'],
  },
  astucia: {
    nombre: 'Astucia',
    abreviatura: 'AST',
    descripcion: 'Percepción, intuición y sentido práctico.',
    afecta: ['Percepción', 'Supervivencia', 'Detectar mentiras'],
  },
  carisma: {
    nombre: 'Carisma',
    abreviatura: 'CAR',
    descripcion: 'Presencia, persuasión y fuerza de voluntad proyectada.',
    afecta: ['Trato social', 'Precios de mercader', 'Magia por pacto'],
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   MODIFICADORES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Modificador derivado de un valor de atributo: floor((valor - 10) / 2).
 *
 * @param {number} valor
 * @returns {number} 8 → -1 · 10 → 0 · 14 → +2 · 18 → +4
 */
export function modificador(valor) {
  return Math.floor((Number(valor) || 10) - 10) >> 1;
}

/**
 * Modificadores de todos los atributos de un mapa de valores.
 * @param {Record<string, number>} valores
 * @returns {Record<string, number>}
 */
export function modificadores(valores) {
  const salida = {};
  for (const clave of ATRIBUTOS.orden) salida[clave] = modificador(valores[clave] ?? 10);
  return salida;
}

/**
 * Valor efectivo de un atributo: base más bonificadores temporales, saturado
 * al techo absoluto.
 *
 * @param {Object} jugador Rama `player` del estado.
 * @param {string} clave
 * @returns {number}
 */
export function valorEfectivo(jugador, clave) {
  const base = jugador?.atributos?.[clave] ?? ATRIBUTOS.base;
  const temporal = jugador?.atributosTemporales?.[clave] ?? 0;
  return saturar(base + temporal, ATRIBUTOS.min, ATRIBUTOS.maxAbsoluto);
}

/**
 * Modificador efectivo, incluidos los bonificadores temporales.
 * Es el que usa RulesEngine en cada tirada.
 *
 * @param {Object} jugador
 * @param {string} clave
 * @returns {number}
 */
export function modificadorEfectivo(jugador, clave) {
  return modificador(valorEfectivo(jugador, clave));
}

/**
 * Todos los valores efectivos, para la ficha de personaje.
 * @param {Object} jugador
 * @returns {Record<string, {base: number, temporal: number, total: number, mod: number}>}
 */
export function resumenAtributos(jugador) {
  const salida = {};
  for (const clave of ATRIBUTOS.orden) {
    const base = jugador?.atributos?.[clave] ?? ATRIBUTOS.base;
    const temporal = jugador?.atributosTemporales?.[clave] ?? 0;
    const total = saturar(base + temporal, ATRIBUTOS.min, ATRIBUTOS.maxAbsoluto);
    salida[clave] = { base, temporal, total, mod: modificador(total) };
  }
  return salida;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPRA POR PUNTOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Coste acumulado de llevar un atributo desde la base hasta un valor.
 *
 * La tabla de balance da el coste de cada escalón; aquí se suman todos los
 * escalones recorridos. Subir de 8 a 15 cuesta 1+1+1+1+1+2+2 = 9 puntos.
 *
 * @param {number} valor Valor de destino.
 * @returns {number} Puntos consumidos.
 */
export function costeAcumulado(valor) {
  let total = 0;
  for (let v = ATRIBUTOS.base + 1; v <= valor; v++) {
    total += ATRIBUTOS.costeCompra[v] ?? 999;
  }
  return total;
}

/**
 * Puntos gastados por un reparto completo.
 * @param {Record<string, number>} valores
 * @returns {number}
 */
export function puntosGastados(valores) {
  let total = 0;
  for (const clave of ATRIBUTOS.orden) total += costeAcumulado(valores[clave] ?? ATRIBUTOS.base);
  return total;
}

/**
 * Puntos que quedan por repartir.
 * @param {Record<string, number>} valores
 * @returns {number}
 */
export function puntosRestantes(valores) {
  return ATRIBUTOS.puntosCreacion - puntosGastados(valores);
}

/**
 * Comprueba si es posible subir un atributo un punto.
 *
 * @param {Record<string, number>} valores
 * @param {string} clave
 * @returns {{puede: boolean, coste: number, motivo: string|null}}
 */
export function puedeSubir(valores, clave) {
  const actual = valores[clave] ?? ATRIBUTOS.base;
  const destino = actual + 1;

  if (destino > ATRIBUTOS.maxCreacion) {
    return { puede: false, coste: 0, motivo: `Máximo ${ATRIBUTOS.maxCreacion} en la creación` };
  }

  const coste = ATRIBUTOS.costeCompra[destino];
  if (coste === undefined) {
    return { puede: false, coste: 0, motivo: 'Valor fuera de la tabla de compra' };
  }

  const restantes = puntosRestantes(valores);
  if (coste > restantes) {
    return { puede: false, coste, motivo: `Cuesta ${coste} y quedan ${restantes}` };
  }

  return { puede: true, coste, motivo: null };
}

/**
 * Comprueba si es posible bajar un atributo un punto.
 * @param {Record<string, number>} valores
 * @param {string} clave
 * @returns {{puede: boolean, recupera: number, motivo: string|null}}
 */
export function puedeBajar(valores, clave) {
  const actual = valores[clave] ?? ATRIBUTOS.base;
  if (actual <= ATRIBUTOS.base) {
    return { puede: false, recupera: 0, motivo: `Mínimo ${ATRIBUTOS.base}` };
  }
  return { puede: true, recupera: ATRIBUTOS.costeCompra[actual] ?? 0, motivo: null };
}

/**
 * Sube un atributo, devolviendo un reparto nuevo. No muta la entrada.
 * @param {Record<string, number>} valores
 * @param {string} clave
 * @returns {Record<string, number>} El reparto original si no era posible.
 */
export function subir(valores, clave) {
  if (!puedeSubir(valores, clave).puede) return valores;
  return { ...valores, [clave]: (valores[clave] ?? ATRIBUTOS.base) + 1 };
}

/**
 * Baja un atributo, devolviendo un reparto nuevo.
 * @param {Record<string, number>} valores
 * @param {string} clave
 * @returns {Record<string, number>}
 */
export function bajar(valores, clave) {
  if (!puedeBajar(valores, clave).puede) return valores;
  return { ...valores, [clave]: (valores[clave] ?? ATRIBUTOS.base) - 1 };
}

/**
 * Reparto de partida: todos los atributos en el valor base.
 * @returns {Record<string, number>}
 */
export function repartoBase() {
  return Object.fromEntries(ATRIBUTOS.orden.map((c) => [c, ATRIBUTOS.base]));
}

/**
 * Valida un reparto completo.
 *
 * @param {Record<string, number>} valores
 * @returns {{valido: boolean, gastados: number, restantes: number, errores: string[]}}
 */
export function validarReparto(valores) {
  const errores = [];

  for (const clave of ATRIBUTOS.orden) {
    const v = valores[clave];
    if (typeof v !== 'number' || !Number.isInteger(v)) {
      errores.push(`${META_ATRIBUTOS[clave].nombre}: valor no entero`);
      continue;
    }
    if (v < ATRIBUTOS.base) errores.push(`${META_ATRIBUTOS[clave].nombre}: por debajo de ${ATRIBUTOS.base}`);
    if (v > ATRIBUTOS.maxCreacion) errores.push(`${META_ATRIBUTOS[clave].nombre}: por encima de ${ATRIBUTOS.maxCreacion}`);
  }

  const gastados = puntosGastados(valores);
  if (gastados > ATRIBUTOS.puntosCreacion) {
    errores.push(`Se han gastado ${gastados} puntos y solo hay ${ATRIBUTOS.puntosCreacion}`);
  }

  return {
    valido: errores.length === 0,
    gastados,
    restantes: ATRIBUTOS.puntosCreacion - gastados,
    errores,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   APLICACIÓN DE MODIFICADORES RACIALES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Suma los modificadores de linaje a un reparto.
 *
 * Se aplican DESPUÉS de la compra, no durante: así el jugador reparte sus 27
 * puntos con libertad y el linaje añade encima. Un ferrano puede tener 17 de
 * Vigor comprado más 2 de linaje, y llegar a 19 en la creación.
 *
 * @param {Record<string, number>} valores Reparto comprado.
 * @param {Record<string, number>} bonificadores Modificadores del linaje.
 * @returns {Record<string, number>}
 */
export function aplicarLinaje(valores, bonificadores) {
  const salida = { ...valores };
  for (const [clave, bono] of Object.entries(bonificadores ?? {})) {
    // 'moral' no es un atributo: algunos linajes lo modifican y se ignora aquí,
    // porque lo gestiona Vitals.
    if (!ATRIBUTOS.orden.includes(clave)) continue;
    salida[clave] = saturar((salida[clave] ?? ATRIBUTOS.base) + bono, ATRIBUTOS.min, ATRIBUTOS.max);
  }
  return salida;
}

/* ═══════════════════════════════════════════════════════════════════════════
   BONIFICADORES TEMPORALES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Calcula el parche de estado para aplicar un bonificador temporal.
 * Se usa con objetos equipados, bendiciones y estados alterados.
 *
 * @param {Object} jugador
 * @param {string} clave
 * @param {number} delta
 * @returns {Object} Parche para el Store.
 */
export function parcheTemporal(jugador, clave, delta) {
  const actual = jugador?.atributosTemporales?.[clave] ?? 0;
  return { player: { atributosTemporales: { [clave]: actual + delta } } };
}

/**
 * Parche que limpia todos los bonificadores temporales.
 * Se aplica al terminar un combate o al desequipar todo.
 * @returns {Object}
 */
export function parcheLimpiarTemporales() {
  return { player: { atributosTemporales: {} } };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESENTACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Etiqueta descriptiva de un valor de atributo. Da al jugador una lectura
 * cualitativa además del número.
 *
 * @param {number} valor
 * @returns {string}
 */
export function calificar(valor) {
  if (valor <= 5) return 'lastrado';
  if (valor <= 7) return 'flojo';
  if (valor <= 9) return 'por debajo';
  if (valor <= 11) return 'corriente';
  if (valor <= 13) return 'competente';
  if (valor <= 15) return 'notable';
  if (valor <= 17) return 'excepcional';
  if (valor <= 19) return 'sobresaliente';
  return 'legendario';
}

/**
 * Los dos atributos más altos, para describir al personaje en el prompt del
 * director sin volcarle una tabla de seis números.
 *
 * @param {Record<string, number>} valores
 * @returns {string} 'destacado en Destreza y Astucia'
 */
export function describirFortalezas(valores) {
  const orden = ATRIBUTOS.orden
    .map((c) => ({ clave: c, valor: valores[c] ?? 10 }))
    .sort((a, b) => b.valor - a.valor);

  const [primero, segundo] = orden;
  const nombres = [META_ATRIBUTOS[primero.clave].nombre];
  if (segundo && segundo.valor >= primero.valor - 1) nombres.push(META_ATRIBUTOS[segundo.clave].nombre);

  return `destacado en ${nombres.join(' y ')}`;
}

/**
 * El atributo más bajo, si es lo bastante bajo como para ser un rasgo.
 * @param {Record<string, number>} valores
 * @returns {string|null}
 */
export function describirDebilidad(valores) {
  const orden = ATRIBUTOS.orden
    .map((c) => ({ clave: c, valor: valores[c] ?? 10 }))
    .sort((a, b) => a.valor - b.valor);

  const peor = orden[0];
  if (peor.valor >= 9) return null;
  return `flojo en ${META_ATRIBUTOS[peor.clave].nombre}`;
}

export default {
  META_ATRIBUTOS,
  modificador,
  modificadores,
  valorEfectivo,
  modificadorEfectivo,
  resumenAtributos,
  costeAcumulado,
  puntosGastados,
  puntosRestantes,
  puedeSubir,
  puedeBajar,
  subir,
  bajar,
  repartoBase,
  validarReparto,
  aplicarLinaje,
  parcheTemporal,
  parcheLimpiarTemporales,
  calificar,
  describirFortalezas,
  describirDebilidad,
};
