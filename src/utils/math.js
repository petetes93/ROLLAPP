/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · utils/math.js
 * ---------------------------------------------------------------------------
 * Operaciones numéricas del motor.
 *
 * `saturar` es, con diferencia, la función más usada del proyecto: toda barra,
 * todo recurso y todo delta propuesto por el director pasa por ella. Que la
 * vida nunca baje de 0 ni supere el máximo no es responsabilidad de quien
 * escribe cada sistema, sino de esta línea.
 *
 * Sin dependencias.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Recorta un valor a un rango cerrado.
 * @param {number} valor
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function saturar(valor, min, max) {
  return valor < min ? min : valor > max ? max : valor;
}

/**
 * Recorta a [0, 1].
 * @param {number} valor
 * @returns {number}
 */
export function saturar01(valor) {
  return saturar(valor, 0, 1);
}

/**
 * Interpolación lineal.
 * @param {number} a
 * @param {number} b
 * @param {number} t Entre 0 y 1.
 * @returns {number}
 */
export function interpolar(a, b, t) {
  return a + (b - a) * saturar01(t);
}

/**
 * Reproyecta un valor de un rango a otro, saturando en los extremos.
 * @param {number} valor
 * @param {number} minEntrada
 * @param {number} maxEntrada
 * @param {number} minSalida
 * @param {number} maxSalida
 * @returns {number}
 */
export function reproyectar(valor, minEntrada, maxEntrada, minSalida, maxSalida) {
  if (maxEntrada === minEntrada) return minSalida;
  const t = (valor - minEntrada) / (maxEntrada - minEntrada);
  return interpolar(minSalida, maxSalida, t);
}

/**
 * Porcentaje de un valor respecto a un máximo, en [0, 100].
 * Devuelve 0 si el máximo es 0, en vez de NaN: una barra vacía es preferible a
 * una barra rota.
 * @param {number} actual
 * @param {number} max
 * @returns {number}
 */
export function porcentaje(actual, max) {
  if (!max || max <= 0) return 0;
  return saturar((actual / max) * 100, 0, 100);
}

/**
 * Fracción en [0, 1].
 * @param {number} actual
 * @param {number} max
 * @returns {number}
 */
export function fraccion(actual, max) {
  if (!max || max <= 0) return 0;
  return saturar01(actual / max);
}

/**
 * Redondea a un número dado de decimales.
 * @param {number} valor
 * @param {number} [decimales=0]
 * @returns {number}
 */
export function redondear(valor, decimales = 0) {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

/**
 * Suma los valores de un array, opcionalmente proyectando cada elemento.
 * @template T
 * @param {T[]} lista
 * @param {(el: T) => number} [proyeccion]
 * @returns {number}
 */
export function sumar(lista, proyeccion) {
  let total = 0;
  for (const el of lista) total += proyeccion ? proyeccion(el) : Number(el) || 0;
  return total;
}

/**
 * Media aritmética. Devuelve 0 con lista vacía.
 * @template T
 * @param {T[]} lista
 * @param {(el: T) => number} [proyeccion]
 * @returns {number}
 */
export function media(lista, proyeccion) {
  if (!lista.length) return 0;
  return sumar(lista, proyeccion) / lista.length;
}

/**
 * Localiza el umbral vigente en una tabla escalonada descendente.
 *
 * Es el patrón que usan hambre, fatiga, moral e impedimenta en
 * balance.config.js: una lista ordenada de mayor a menor por `desde`.
 *
 * @template {{desde: number}} T
 * @param {T[]} tabla Ordenada de mayor a menor por `desde`.
 * @param {number} valor
 * @returns {T} El primer escalón cuyo `desde` no supera el valor.
 *
 * @example
 * escalon(VITALES.supervivencia.umbrales, 28);  // → { desde: 15, etiqueta: 'grave', … }
 */
export function escalon(tabla, valor) {
  for (const fila of tabla) {
    if (valor >= fila.desde) return fila;
  }
  return tabla[tabla.length - 1];
}

/**
 * Determina el nivel de alarma de una barra, para que StatBar aplique el color.
 * @param {number} actual
 * @param {number} max
 * @param {number} [umbralAlerta=0.5]
 * @param {number} [umbralCritico=0.25]
 * @returns {'normal'|'alerta'|'critico'}
 */
export function nivelAlarma(actual, max, umbralAlerta = 0.5, umbralCritico = 0.25) {
  const f = fraccion(actual, max);
  if (f <= umbralCritico) return 'critico';
  if (f <= umbralAlerta) return 'alerta';
  return 'normal';
}

/**
 * Aplica un delta a un valor y lo satura, devolviendo también lo que se perdió
 * por el recorte.
 *
 * Ese segundo dato importa: si el director cura 40 puntos a alguien al que solo
 * le faltan 10, la narración debería decir «te sientes pleno», no «recuperas 40».
 *
 * @param {number} actual
 * @param {number} delta
 * @param {number} min
 * @param {number} max
 * @returns {{valor: number, aplicado: number, desperdiciado: number}}
 */
export function aplicarDelta(actual, delta, min, max) {
  const bruto = actual + delta;
  const valor = saturar(bruto, min, max);
  const aplicado = valor - actual;
  return { valor, aplicado, desperdiciado: delta - aplicado };
}

/**
 * Comprueba si dos números son prácticamente iguales, evitando sorpresas de
 * coma flotante al comparar pesos o precios.
 * @param {number} a
 * @param {number} b
 * @param {number} [epsilon=1e-6]
 * @returns {boolean}
 */
export function casiIgual(a, b, epsilon = 1e-6) {
  return Math.abs(a - b) < epsilon;
}

/**
 * Envuelve un valor dentro de un rango cíclico. Se usa con las horas del día.
 * @param {number} valor
 * @param {number} max
 * @returns {number}
 */
export function ciclico(valor, max) {
  return ((valor % max) + max) % max;
}

export default {
  saturar, saturar01, interpolar, reproyectar, porcentaje, fraccion,
  redondear, sumar, media, escalon, nivelAlarma, aplicarDelta, casiIgual, ciclico,
};
