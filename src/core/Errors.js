/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · core/Errors.js
 * ---------------------------------------------------------------------------
 * Jerarquía de errores propios del motor.
 *
 * Principio rector: un motor de juego no debe morir. Casi todo error es
 * RECUPERABLE — se registra, se degrada la funcionalidad afectada y la partida
 * continúa. Sólo los errores marcados como fatales detienen la aplicación.
 *
 * Cada error lleva:
 *   · code      → identificador estable, apto para comparar en el código
 *   · severidad → decide si se recupera, se avisa o se aborta
 *   · contexto  → datos estructurados para el diagnóstico
 *   · usuario   → mensaje apto para mostrar al jugador (o null si es interno)
 *
 * Dependencias: sólo Logger.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { crearCanal } from './Logger.js';

const log = crearCanal('core');

/* ═══════════════════════════════════════════════════════════════════════════
   SEVERIDAD
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @readonly
 * @enum {string}
 */
export const SEVERIDAD = Object.freeze({
  /** Se registra y se sigue. El jugador no se entera. */
  TRAZA: 'traza',
  /** Se registra y se degrada algo menor. El jugador puede no enterarse. */
  LEVE: 'leve',
  /** Se avisa al jugador y se aplica una alternativa. La partida sigue. */
  GRAVE: 'grave',
  /** No hay alternativa: la aplicación no puede continuar. */
  FATAL: 'fatal',
});

/* ═══════════════════════════════════════════════════════════════════════════
   CÓDIGOS
   Identificadores estables. Nunca se renombran: se añaden.
   ═══════════════════════════════════════════════════════════════════════════ */

export const CODIGO = Object.freeze({
  // Núcleo
  ESTADO_INVALIDO: 'E_ESTADO_INVALIDO',
  RUTA_INEXISTENTE: 'E_RUTA_INEXISTENTE',
  ACCION_DESCONOCIDA: 'E_ACCION_DESCONOCIDA',
  REDUCTOR_DUPLICADO: 'E_REDUCTOR_DUPLICADO',
  SISTEMA_DUPLICADO: 'E_SISTEMA_DUPLICADO',
  SISTEMA_AUSENTE: 'E_SISTEMA_AUSENTE',
  DEPENDENCIA_CICLICA: 'E_DEPENDENCIA_CICLICA',

  // Validación
  VALIDACION: 'E_VALIDACION',
  TIPO_INCORRECTO: 'E_TIPO_INCORRECTO',
  FUERA_DE_RANGO: 'E_FUERA_DE_RANGO',

  // Dados y reglas
  DADO_INVALIDO: 'E_DADO_INVALIDO',
  TIRADA_IMPOSIBLE: 'E_TIRADA_IMPOSIBLE',

  // Director de juego
  IA_SIN_RESPUESTA: 'E_IA_SIN_RESPUESTA',
  IA_JSON_INVALIDO: 'E_IA_JSON_INVALIDO',
  IA_ESQUEMA_INVALIDO: 'E_IA_ESQUEMA_INVALIDO',
  IA_TIMEOUT: 'E_IA_TIMEOUT',
  IA_SIN_CREDENCIAL: 'E_IA_SIN_CREDENCIAL',
  IA_SIN_URL: 'E_IA_SIN_URL',
  IA_RED: 'E_IA_RED',
  IA_PROVEEDOR_DESCONOCIDO: 'E_IA_PROVEEDOR_DESCONOCIDO',

  // Reglas de juego
  ACCION_ILEGAL: 'E_ACCION_ILEGAL',
  RECURSO_INSUFICIENTE: 'E_RECURSO_INSUFICIENTE',
  INVENTARIO_LLENO: 'E_INVENTARIO_LLENO',
  SOBRECARGA: 'E_SOBRECARGA',
  OBJETO_INEXISTENTE: 'E_OBJETO_INEXISTENTE',
  ENTIDAD_INEXISTENTE: 'E_ENTIDAD_INEXISTENTE',

  // Persistencia
  GUARDADO_FALLO: 'E_GUARDADO_FALLO',
  GUARDADO_LLENO: 'E_GUARDADO_LLENO',
  CARGA_FALLO: 'E_CARGA_FALLO',
  VERSION_INCOMPATIBLE: 'E_VERSION_INCOMPATIBLE',
  MIGRACION_FALLO: 'E_MIGRACION_FALLO',
  CREDENCIAL_EN_GUARDADO: 'E_CREDENCIAL_EN_GUARDADO',

  // Interfaz
  MONTAJE_AUSENTE: 'E_MONTAJE_AUSENTE',
  PANTALLA_INVALIDA: 'E_PANTALLA_INVALIDA',
  TRANSICION_INVALIDA: 'E_TRANSICION_INVALIDA',

  // Genérico
  DESCONOCIDO: 'E_DESCONOCIDO',
});

/* ═══════════════════════════════════════════════════════════════════════════
   CLASE BASE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Error base de ARCANUM. Todo error propio hereda de aquí, de modo que
 * `err instanceof ErrorArcanum` distingue lo nuestro de lo ajeno.
 */
export class ErrorArcanum extends Error {
  /**
   * @param {string} mensaje Descripción técnica, en español, para el registro.
   * @param {Object} [opciones]
   * @param {string} [opciones.code] Código de CODIGO.
   * @param {string} [opciones.severidad] Valor de SEVERIDAD.
   * @param {Object} [opciones.contexto] Datos estructurados del fallo.
   * @param {string|null} [opciones.usuario] Mensaje apto para el jugador.
   * @param {Error} [opciones.causa] Error original que provocó éste.
   */
  constructor(mensaje, opciones = {}) {
    super(mensaje);
    this.name = new.target.name;
    this.code = opciones.code ?? CODIGO.DESCONOCIDO;
    this.severidad = opciones.severidad ?? SEVERIDAD.GRAVE;
    this.contexto = opciones.contexto ?? {};
    this.usuario = opciones.usuario ?? null;
    this.causa = opciones.causa ?? null;
    this.momento = Date.now();

    // Conserva la traza nativa donde el motor lo soporte.
    if (Error.captureStackTrace) Error.captureStackTrace(this, new.target);
  }

  /** @returns {boolean} true si la partida puede continuar. */
  get recuperable() {
    return this.severidad !== SEVERIDAD.FATAL;
  }

  /** @returns {boolean} true si hay que decírselo al jugador. */
  get visible() {
    return this.usuario !== null &&
      (this.severidad === SEVERIDAD.GRAVE || this.severidad === SEVERIDAD.FATAL);
  }

  /**
   * Representación serializable, apta para el volcado de diagnóstico.
   * @returns {Object}
   */
  toJSON() {
    return {
      nombre: this.name,
      code: this.code,
      severidad: this.severidad,
      mensaje: this.message,
      contexto: this.contexto,
      causa: this.causa ? `${this.causa.name}: ${this.causa.message}` : null,
      momento: this.momento,
    };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUBCLASES
   Cada familia fija su severidad por defecto, que el llamante puede elevar.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Fallo de validación de datos o de esquema. */
export class ErrorValidacion extends ErrorArcanum {
  /**
   * @param {string} mensaje
   * @param {Object} [opciones]
   * @param {Array<{ruta:string, problema:string}>} [opciones.fallos] Detalle por campo.
   */
  constructor(mensaje, opciones = {}) {
    super(mensaje, { code: CODIGO.VALIDACION, severidad: SEVERIDAD.LEVE, ...opciones });
    this.fallos = opciones.fallos ?? [];
  }
}

/** Fallo en el núcleo: estado, store, registro de sistemas. */
export class ErrorNucleo extends ErrorArcanum {
  constructor(mensaje, opciones = {}) {
    super(mensaje, { code: CODIGO.ESTADO_INVALIDO, severidad: SEVERIDAD.FATAL, ...opciones });
  }
}

/** Fallo del director de juego: red, formato, credenciales. */
export class ErrorDirector extends ErrorArcanum {
  constructor(mensaje, opciones = {}) {
    super(mensaje, { code: CODIGO.IA_SIN_RESPUESTA, severidad: SEVERIDAD.GRAVE, ...opciones });
    /** true si conviene reintentar la misma petición. */
    this.reintentable = opciones.reintentable ?? true;
    /** Texto crudo recibido, si lo hubo. Útil para reparar un JSON roto. */
    this.crudo = opciones.crudo ?? null;
  }
}

/** Acción que las reglas del juego no permiten. No es un bug: es una jugada inválida. */
export class ErrorReglas extends ErrorArcanum {
  constructor(mensaje, opciones = {}) {
    super(mensaje, { code: CODIGO.ACCION_ILEGAL, severidad: SEVERIDAD.LEVE, ...opciones });
  }
}

/** Fallo de guardado o carga. */
export class ErrorPersistencia extends ErrorArcanum {
  constructor(mensaje, opciones = {}) {
    super(mensaje, { code: CODIGO.GUARDADO_FALLO, severidad: SEVERIDAD.GRAVE, ...opciones });
  }
}

/** Fallo de la capa de presentación. */
export class ErrorInterfaz extends ErrorArcanum {
  constructor(mensaje, opciones = {}) {
    super(mensaje, { code: CODIGO.MONTAJE_AUSENTE, severidad: SEVERIDAD.GRAVE, ...opciones });
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   UTILIDADES DE MANEJO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Normaliza cualquier valor lanzado a un ErrorArcanum.
 * JavaScript permite lanzar cadenas, números y objetos; el motor no debería
 * tener que preocuparse de eso más de una vez.
 *
 * @param {unknown} valor
 * @param {Object} [predeterminados] Opciones aplicadas si hay que envolver.
 * @returns {ErrorArcanum}
 */
export function normalizar(valor, predeterminados = {}) {
  if (valor instanceof ErrorArcanum) return valor;
  if (valor instanceof Error) {
    return new ErrorArcanum(valor.message, { causa: valor, ...predeterminados });
  }
  return new ErrorArcanum(String(valor), predeterminados);
}

/**
 * Registra un error con el nivel adecuado a su severidad.
 * Es el único sitio del motor donde se decide cómo se anota un fallo.
 *
 * @param {unknown} error
 * @param {string} [canal] Canal de registro.
 * @returns {ErrorArcanum} El error ya normalizado.
 */
export function registrar(error, canal = 'core') {
  const err = normalizar(error);
  const l = canal === 'core' ? log : crearCanal(canal);
  const detalle = { code: err.code, ...err.contexto };

  switch (err.severidad) {
    case SEVERIDAD.TRAZA: l.traza(err.message, detalle); break;
    case SEVERIDAD.LEVE: l.debug(err.message, detalle); break;
    case SEVERIDAD.GRAVE: l.aviso(err.message, detalle); break;
    case SEVERIDAD.FATAL: l.error(err.message, detalle, err.causa ?? ''); break;
    default: l.aviso(err.message, detalle);
  }
  return err;
}

/**
 * Ejecuta una función protegiéndola: si lanza, registra y devuelve el valor de
 * reserva en lugar de propagar. Es el patrón por defecto del motor para
 * cualquier operación no crítica.
 *
 * @template T
 * @param {() => T} fn Función a ejecutar.
 * @param {T} reserva Valor devuelto si fn lanza.
 * @param {string} [canal] Canal de registro.
 * @returns {T}
 *
 * @example
 * const objetos = proteger(() => generarBotin(enemigo), [], 'combat');
 */
export function proteger(fn, reserva, canal = 'core') {
  try {
    return fn();
  } catch (e) {
    registrar(e, canal);
    return reserva;
  }
}

/**
 * Versión asíncrona de proteger().
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {T} reserva
 * @param {string} [canal]
 * @returns {Promise<T>}
 */
export async function protegerAsync(fn, reserva, canal = 'core') {
  try {
    return await fn();
  } catch (e) {
    registrar(e, canal);
    return reserva;
  }
}

/**
 * Afirma una condición y lanza ErrorNucleo si no se cumple.
 * Reservado para invariantes del motor: cosas que, de fallar, significan que el
 * código está mal, no que el jugador haya hecho algo raro.
 *
 * @param {unknown} condicion
 * @param {string} mensaje
 * @param {Object} [contexto]
 * @throws {ErrorNucleo}
 */
export function invariante(condicion, mensaje, contexto = {}) {
  if (condicion) return;
  throw new ErrorNucleo(`Invariante rota: ${mensaje}`, { contexto });
}

export default {
  SEVERIDAD,
  CODIGO,
  ErrorArcanum,
  ErrorValidacion,
  ErrorNucleo,
  ErrorDirector,
  ErrorReglas,
  ErrorPersistencia,
  ErrorInterfaz,
  normalizar,
  registrar,
  proteger,
  protegerAsync,
  invariante,
};
