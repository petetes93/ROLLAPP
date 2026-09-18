/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · utils/merge.js
 * ---------------------------------------------------------------------------
 * Fusión de objetos.
 *
 * Reglas aplicadas en todo el motor:
 *   · Los objetos planos se funden en profundidad.
 *   · Los arrays se REEMPLAZAN, no se concatenan. Fundir arrays produce
 *     duplicados silenciosos y comportamientos difíciles de rastrear.
 *   · `undefined` significa «no tocar»; para borrar hay que pasar `null`.
 *
 * Sin dependencias.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * @param {*} valor
 * @returns {boolean} true si es un objeto plano fusionable.
 */
function esObjetoPlano(valor) {
  return valor !== null
    && typeof valor === 'object'
    && !Array.isArray(valor)
    && !(valor instanceof Date)
    && !(valor instanceof Map)
    && !(valor instanceof Set);
}

/**
 * Funde dos objetos en profundidad, sin mutar ninguno.
 *
 * @template T
 * @param {T} base
 * @param {Object} encima
 * @returns {T} Objeto nuevo si algo cambió; la misma referencia si no.
 */
export function fundir(base, encima) {
  if (!esObjetoPlano(encima)) return base;
  if (!esObjetoPlano(base)) return /** @type {any} */ (encima);

  let cambiado = false;
  const salida = { ...base };

  for (const [clave, valor] of Object.entries(encima)) {
    if (valor === undefined) continue;

    const anterior = salida[clave];

    if (esObjetoPlano(valor) && esObjetoPlano(anterior)) {
      const fundido = fundir(anterior, valor);
      if (fundido !== anterior) { salida[clave] = fundido; cambiado = true; }
    } else if (anterior !== valor) {
      salida[clave] = valor;
      cambiado = true;
    }
  }

  // Devolver la misma referencia cuando nada cambió es lo que permite que los
  // suscriptores del Store comparen por identidad y no repinten de más.
  return cambiado ? salida : base;
}

/**
 * Funde varios objetos en secuencia.
 * @param {...Object} objetos
 * @returns {Object}
 */
export function fundirVarios(...objetos) {
  return objetos.reduce((acc, o) => fundir(acc, o), {});
}

/**
 * Aplica valores por defecto: rellena solo lo que falta.
 *
 * Al revés que `fundir`, aquí manda la base: los defectos nunca pisan un valor
 * ya presente. Se usa al cargar partidas guardadas de versiones anteriores,
 * donde faltan campos añadidos después.
 *
 * @template T
 * @param {Object} objeto
 * @param {T} defectos
 * @returns {T}
 */
export function conDefectos(objeto, defectos) {
  if (!esObjetoPlano(objeto)) return /** @type {any} */ (defectos);

  const salida = { ...defectos };

  for (const [clave, valor] of Object.entries(objeto)) {
    if (valor === undefined) continue;

    if (esObjetoPlano(valor) && esObjetoPlano(defectos[clave])) {
      salida[clave] = conDefectos(valor, defectos[clave]);
    } else {
      salida[clave] = valor;
    }
  }

  return /** @type {any} */ (salida);
}

/**
 * Selecciona un subconjunto de claves.
 * @template T
 * @param {T} objeto
 * @param {string[]} claves
 * @returns {Partial<T>}
 */
export function tomar(objeto, claves) {
  const salida = {};
  for (const clave of claves) {
    if (Object.hasOwn(objeto ?? {}, clave)) salida[clave] = objeto[clave];
  }
  return salida;
}

/**
 * Devuelve el objeto sin las claves indicadas.
 * @template T
 * @param {T} objeto
 * @param {string[]} claves
 * @returns {Partial<T>}
 */
export function excepto(objeto, claves) {
  const excluidas = new Set(claves);
  const salida = {};
  for (const [clave, valor] of Object.entries(objeto ?? {})) {
    if (!excluidas.has(clave)) salida[clave] = valor;
  }
  return salida;
}

/**
 * Elimina las claves cuyo valor sea `null` o `undefined`.
 * @template T
 * @param {T} objeto
 * @returns {Partial<T>}
 */
export function limpiarNulos(objeto) {
  const salida = {};
  for (const [clave, valor] of Object.entries(objeto ?? {})) {
    if (valor !== null && valor !== undefined) salida[clave] = valor;
  }
  return salida;
}

export default { fundir, fundirVarios, conDefectos, tomar, excepto, limpiarNulos };
