/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · core/Validator.js
 * ---------------------------------------------------------------------------
 * Validador de esquemas ligero, sin dependencias externas.
 *
 * Su razón de ser es blindar la frontera con el director de juego: todo lo que
 * devuelve un modelo de lenguaje es texto no fiable hasta que se demuestre lo
 * contrario. También valida el estado tras las migraciones de guardado.
 *
 * Filosofía: SANEAR ANTES QUE RECHAZAR. Un turno con un campo raro no debe
 * arruinar la partida; se descarta el campo, se anota el problema y se sigue.
 * Sólo lo estructuralmente irreparable se rechaza.
 *
 * Dependencias: Errors.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { ErrorValidacion } from './Errors.js';

/* ═══════════════════════════════════════════════════════════════════════════
   DEFINICIÓN DE ESQUEMAS
   ---------------------------------------------------------------------------
   Un esquema es un objeto plano:
     { tipo, requerido, defecto, min, max, longitudMax, valores, elementos,
       propiedades, adicionales, saturar, transformar }
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Esquema
 * @property {string} tipo 'string'|'number'|'integer'|'boolean'|'array'|'object'|'any'
 * @property {boolean} [requerido=false]
 * @property {*} [defecto] Valor aplicado si falta o es inválido.
 * @property {number} [min] Mínimo numérico o longitud mínima.
 * @property {number} [max] Máximo numérico o longitud máxima.
 * @property {string[]} [valores] Conjunto cerrado de valores admitidos.
 * @property {Esquema} [elementos] Esquema de cada elemento de un array.
 * @property {Record<string, Esquema>} [propiedades] Esquema de cada clave de un objeto.
 * @property {boolean} [adicionales=false] Permitir claves no declaradas.
 * @property {boolean} [saturar=false] Recortar al rango en vez de rechazar.
 * @property {(v:*) => *} [transformar] Normalización aplicada antes de validar.
 */

/**
 * @typedef {Object} ResultadoValidacion
 * @property {boolean} valido true si no hubo fallos irreparables.
 * @property {*} valor Dato ya saneado, listo para usar.
 * @property {Array<{ruta: string, problema: string}>} fallos
 * @property {Array<{ruta: string, problema: string}>} avisos Correcciones aplicadas.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   VALIDACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Valida y sanea un valor contra un esquema.
 *
 * @param {*} valor
 * @param {Esquema} esquema
 * @param {string} [ruta='raiz'] Ruta usada en los mensajes de error.
 * @returns {ResultadoValidacion}
 *
 * @example
 * const r = validar(datosIA, ESQUEMA_RESPUESTA);
 * if (!r.valido) manejarFallo(r.fallos);
 * usar(r.valor);            // saneado, con defectos aplicados
 * r.avisos.forEach(log);    // qué se corrigió por el camino
 */
export function validar(valor, esquema, ruta = 'raiz') {
  const fallos = [];
  const avisos = [];
  const saneado = _validar(valor, esquema, ruta, fallos, avisos);
  return { valido: fallos.length === 0, valor: saneado, fallos, avisos };
}

/**
 * Núcleo recursivo de la validación.
 * @private
 */
function _validar(valor, esquema, ruta, fallos, avisos) {
  // — Transformación previa —
  if (typeof esquema.transformar === 'function' && valor !== undefined && valor !== null) {
    try {
      valor = esquema.transformar(valor);
    } catch {
      avisos.push({ ruta, problema: 'la transformación falló; se usa el valor original' });
    }
  }

  // — Ausencia —
  if (valor === undefined || valor === null) {
    if (esquema.requerido) {
      fallos.push({ ruta, problema: 'campo obligatorio ausente' });
      return esquema.defecto !== undefined ? clonar(esquema.defecto) : null;
    }
    return esquema.defecto !== undefined ? clonar(esquema.defecto) : undefined;
  }

  // — Por tipo —
  switch (esquema.tipo) {
    case 'string': return _cadena(valor, esquema, ruta, fallos, avisos);
    case 'number': return _numero(valor, esquema, ruta, fallos, avisos, false);
    case 'integer': return _numero(valor, esquema, ruta, fallos, avisos, true);
    case 'boolean': return _booleano(valor, esquema, ruta, avisos);
    case 'array': return _array(valor, esquema, ruta, fallos, avisos);
    case 'object': return _objeto(valor, esquema, ruta, fallos, avisos);
    case 'any': return valor;
    default:
      fallos.push({ ruta, problema: `tipo de esquema desconocido: ${esquema.tipo}` });
      return valor;
  }
}

/** @private */
function _cadena(valor, esquema, ruta, fallos, avisos) {
  let s = typeof valor === 'string' ? valor : String(valor);
  if (typeof valor !== 'string') avisos.push({ ruta, problema: 'convertido a texto' });

  if (esquema.max !== undefined && s.length > esquema.max) {
    s = s.slice(0, esquema.max);
    avisos.push({ ruta, problema: `truncado a ${esquema.max} caracteres` });
  }

  if (esquema.min !== undefined && s.length < esquema.min) {
    fallos.push({ ruta, problema: `longitud mínima ${esquema.min}` });
    return esquema.defecto ?? s;
  }

  if (esquema.valores && !esquema.valores.includes(s)) {
    const alternativa = esquema.defecto ?? esquema.valores[0];
    avisos.push({ ruta, problema: `valor "${s}" no admitido; se usa "${alternativa}"` });
    return alternativa;
  }

  return s;
}

/** @private */
function _numero(valor, esquema, ruta, fallos, avisos, entero) {
  let n = typeof valor === 'number' ? valor : Number(valor);

  if (!Number.isFinite(n)) {
    fallos.push({ ruta, problema: `no es un número: ${JSON.stringify(valor)}` });
    return esquema.defecto ?? 0;
  }

  if (entero && !Number.isInteger(n)) {
    n = Math.round(n);
    avisos.push({ ruta, problema: 'redondeado a entero' });
  }

  const bajo = esquema.min !== undefined && n < esquema.min;
  const alto = esquema.max !== undefined && n > esquema.max;

  if (bajo || alto) {
    if (esquema.saturar) {
      const original = n;
      n = Math.max(esquema.min ?? -Infinity, Math.min(esquema.max ?? Infinity, n));
      avisos.push({ ruta, problema: `${original} saturado a ${n}` });
    } else {
      fallos.push({ ruta, problema: `fuera de rango [${esquema.min ?? '−∞'}, ${esquema.max ?? '∞'}]: ${n}` });
      return esquema.defecto ?? Math.max(esquema.min ?? 0, Math.min(esquema.max ?? 0, n));
    }
  }

  return n;
}

/** @private */
function _booleano(valor, esquema, ruta, avisos) {
  if (typeof valor === 'boolean') return valor;
  if (valor === 'true' || valor === 1 || valor === '1') { avisos.push({ ruta, problema: 'convertido a true' }); return true; }
  if (valor === 'false' || valor === 0 || valor === '0') { avisos.push({ ruta, problema: 'convertido a false' }); return false; }
  avisos.push({ ruta, problema: 'valor no booleano; se usa el defecto' });
  return esquema.defecto ?? false;
}

/** @private */
function _array(valor, esquema, ruta, fallos, avisos) {
  if (!Array.isArray(valor)) {
    // Un objeto suelto donde se esperaba una lista es un fallo típico de los
    // modelos de lenguaje. Se envuelve en lugar de rechazarlo.
    if (valor && typeof valor === 'object') {
      avisos.push({ ruta, problema: 'objeto envuelto en array' });
      valor = [valor];
    } else {
      fallos.push({ ruta, problema: 'se esperaba una lista' });
      return esquema.defecto ?? [];
    }
  }

  let lista = valor;
  if (esquema.max !== undefined && lista.length > esquema.max) {
    lista = lista.slice(0, esquema.max);
    avisos.push({ ruta, problema: `recortado a ${esquema.max} elementos` });
  }

  if (!esquema.elementos) return lista;

  const salida = [];
  lista.forEach((el, i) => {
    const subFallos = [];
    const saneado = _validar(el, esquema.elementos, `${ruta}[${i}]`, subFallos, avisos);
    // Un elemento inválido se DESCARTA en vez de invalidar la lista entera:
    // si el director propone tres objetos y uno está mal, entran los otros dos.
    if (subFallos.length === 0) salida.push(saneado);
    else avisos.push({ ruta: `${ruta}[${i}]`, problema: `elemento descartado (${subFallos[0].problema})` });
  });

  if (esquema.min !== undefined && salida.length < esquema.min) {
    fallos.push({ ruta, problema: `se requieren al menos ${esquema.min} elementos válidos` });
  }

  return salida;
}

/** @private */
function _objeto(valor, esquema, ruta, fallos, avisos) {
  if (typeof valor !== 'object' || Array.isArray(valor) || valor === null) {
    fallos.push({ ruta, problema: 'se esperaba un objeto' });
    return esquema.defecto ?? {};
  }

  if (!esquema.propiedades) return valor;

  const salida = {};

  for (const [clave, sub] of Object.entries(esquema.propiedades)) {
    const r = _validar(valor[clave], sub, `${ruta}.${clave}`, fallos, avisos);
    if (r !== undefined) salida[clave] = r;
  }

  if (esquema.adicionales) {
    for (const [clave, v] of Object.entries(valor)) {
      if (!(clave in esquema.propiedades)) salida[clave] = v;
    }
  } else {
    const sobrantes = Object.keys(valor).filter((k) => !(k in esquema.propiedades));
    if (sobrantes.length) {
      avisos.push({ ruta, problema: `claves descartadas: ${sobrantes.join(', ')}` });
    }
  }

  return salida;
}

/* ═══════════════════════════════════════════════════════════════════════════
   AUXILIARES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Clon profundo simple para valores por defecto. No se usa structuredClone
 * porque los defectos son siempre datos planos y así se evita su coste.
 * @param {*} v
 * @returns {*}
 * @private
 */
function clonar(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(clonar);
  const o = {};
  for (const [k, val] of Object.entries(v)) o[k] = clonar(val);
  return o;
}

/**
 * Valida y lanza si el resultado no es válido. Reservado para fronteras donde
 * continuar carecería de sentido, como cargar un guardado corrupto.
 *
 * @param {*} valor
 * @param {Esquema} esquema
 * @param {string} [descripcion='dato']
 * @returns {*} El valor saneado.
 * @throws {ErrorValidacion}
 */
export function validarEstricto(valor, esquema, descripcion = 'dato') {
  const r = validar(valor, esquema);
  if (!r.valido) {
    throw new ErrorValidacion(`Validación fallida de ${descripcion}`, {
      fallos: r.fallos,
      contexto: { primerFallo: r.fallos[0] },
    });
  }
  return r.valor;
}

/**
 * Comprueba un valor contra un esquema sin sanearlo.
 * @param {*} valor
 * @param {Esquema} esquema
 * @returns {boolean}
 */
export function esValido(valor, esquema) {
  return validar(valor, esquema).valido;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTRUCTORES DE ESQUEMA
   Azúcar sintáctico que hace legibles las definiciones largas, como la del
   contrato del director en ai/ResponseSchema.js.
   ═══════════════════════════════════════════════════════════════════════════ */

export const S = Object.freeze({
  /** @param {Partial<Esquema>} [o] */
  texto: (o = {}) => ({ tipo: 'string', ...o }),
  /** @param {Partial<Esquema>} [o] */
  numero: (o = {}) => ({ tipo: 'number', ...o }),
  /** @param {Partial<Esquema>} [o] */
  entero: (o = {}) => ({ tipo: 'integer', ...o }),
  /** @param {Partial<Esquema>} [o] */
  booleano: (o = {}) => ({ tipo: 'boolean', ...o }),
  /**
   * @param {Esquema} elementos
   * @param {Partial<Esquema>} [o]
   */
  lista: (elementos, o = {}) => ({ tipo: 'array', elementos, defecto: [], ...o }),
  /**
   * @param {Record<string, Esquema>} propiedades
   * @param {Partial<Esquema>} [o]
   */
  objeto: (propiedades, o = {}) => ({ tipo: 'object', propiedades, defecto: {}, ...o }),
  /**
   * @param {string[]} valores
   * @param {Partial<Esquema>} [o]
   */
  enumerado: (valores, o = {}) => ({ tipo: 'string', valores, defecto: valores[0], ...o }),
  /** Cualquier valor, sin comprobación. */
  libre: (o = {}) => ({ tipo: 'any', ...o }),
});

export default { validar, validarEstricto, esValido, S };
