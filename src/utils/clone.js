/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · utils/clone.js
 * ---------------------------------------------------------------------------
 * Clonado profundo y congelado recursivo.
 *
 * `structuredClone` está disponible en todos los navegadores modernos y es más
 * rápido que cualquier implementación manual, pero falla ante funciones,
 * símbolos y objetos con prototipo propio. Aquí se intenta primero y se recurre
 * al recorrido manual solo cuando hace falta.
 *
 * Sin dependencias.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Clona en profundidad cualquier estructura de datos plana.
 *
 * @template T
 * @param {T} valor
 * @returns {T} Copia independiente.
 */
export function clonar(valor) {
  if (valor === null || typeof valor !== 'object') return valor;

  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(valor);
    } catch {
      // Contiene algo no clonable: se sigue por la vía manual.
    }
  }

  return clonarManual(valor, new WeakMap());
}

/**
 * Recorrido manual con protección contra referencias circulares.
 *
 * @template T
 * @param {T} valor
 * @param {WeakMap} vistos
 * @returns {T}
 */
function clonarManual(valor, vistos) {
  if (valor === null || typeof valor !== 'object') return valor;

  // Una referencia ya clonada se reutiliza: así un grafo circular no desborda
  // la pila y las referencias compartidas siguen siéndolo tras el clonado.
  if (vistos.has(valor)) return vistos.get(valor);

  if (valor instanceof Date) return /** @type {any} */ (new Date(valor.getTime()));
  if (valor instanceof RegExp) return /** @type {any} */ (new RegExp(valor.source, valor.flags));

  if (valor instanceof Map) {
    const copia = new Map();
    vistos.set(valor, copia);
    for (const [k, v] of valor) copia.set(clonarManual(k, vistos), clonarManual(v, vistos));
    return /** @type {any} */ (copia);
  }

  if (valor instanceof Set) {
    const copia = new Set();
    vistos.set(valor, copia);
    for (const v of valor) copia.add(clonarManual(v, vistos));
    return /** @type {any} */ (copia);
  }

  if (Array.isArray(valor)) {
    const copia = new Array(valor.length);
    vistos.set(valor, copia);
    for (let i = 0; i < valor.length; i++) copia[i] = clonarManual(valor[i], vistos);
    return /** @type {any} */ (copia);
  }

  const copia = {};
  vistos.set(valor, copia);
  for (const [clave, v] of Object.entries(valor)) copia[clave] = clonarManual(v, vistos);
  return /** @type {any} */ (copia);
}

/**
 * Clonado superficial de un objeto o array.
 * @template T
 * @param {T} valor
 * @returns {T}
 */
export function clonarSuperficial(valor) {
  if (valor === null || typeof valor !== 'object') return valor;
  return /** @type {any} */ (Array.isArray(valor) ? valor.slice() : { ...valor });
}

/**
 * Congela un objeto y todos sus descendientes.
 *
 * Se usa con los catálogos de datos: un contenido congelado no puede corromperse
 * por accidente desde ningún sistema, y los errores salen a la luz en desarrollo
 * en vez de manifestarse tres turnos después.
 *
 * @template T
 * @param {T} objeto
 * @returns {Readonly<T>}
 */
export function congelar(objeto) {
  if (objeto === null || typeof objeto !== 'object' || Object.isFrozen(objeto)) return objeto;
  for (const clave of Object.getOwnPropertyNames(objeto)) congelar(objeto[clave]);
  return Object.freeze(objeto);
}

/**
 * Comparación profunda de dos valores.
 *
 * El Store compara por identidad, que es más rápido y suficiente para decidir
 * si repintar. Esta función es para los casos donde hace falta saber si dos
 * estructuras son equivalentes aunque sean objetos distintos.
 *
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
export function igualProfundo(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => igualProfundo(v, b[i]));
  }

  const clavesA = Object.keys(a);
  const clavesB = Object.keys(b);
  if (clavesA.length !== clavesB.length) return false;

  return clavesA.every((k) => Object.hasOwn(b, k) && igualProfundo(a[k], b[k]));
}

export default { clonar, clonarSuperficial, congelar, igualProfundo };
