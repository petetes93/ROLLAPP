/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · core/SystemBase.js
 * ---------------------------------------------------------------------------
 * Clase base de todo sistema del motor.
 *
 * Un sistema es una unidad autónoma que:
 *   · declara sus dependencias por nombre, nunca por importación
 *   · recibe el contexto (store, bus, rng, log) en la construcción
 *   · registra sus reductores y sus oyentes al iniciarse
 *   · lo suelta TODO al detenerse, sin dejar fugas
 *
 * El último punto no es cosmético: al abandonar una partida y empezar otra, un
 * oyente huérfano de la partida anterior provocaría fallos imposibles de
 * rastrear. Por eso las bajas se acumulan automáticamente y se ejecutan en
 * bloque en detener().
 *
 * Dependencias: Logger, Errors.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { crearCanal } from './Logger.js';
import { registrar } from './Errors.js';

/**
 * @typedef {Object} ContextoSistema
 * @property {import('./Store.js').Store} store
 * @property {import('./EventBus.js').EventBus} bus
 * @property {import('./RNG.js').GestorRNG} rng
 * @property {import('./Registry.js').Registry} registry
 */

export class SystemBase {
  /**
   * Nombre único del sistema. Las subclases DEBEN redefinirlo: es la clave con
   * la que se registra y con la que otros sistemas lo reclaman.
   * @type {string}
   */
  static nombre = 'sistema-sin-nombre';

  /**
   * Nombres de los sistemas que deben existir e iniciarse antes que éste.
   * @type {string[]}
   */
  static dependencias = [];

  /**
   * Canal de registro. Si se omite, se usa el nombre del sistema.
   * @type {string|null}
   */
  static canal = null;

  /**
   * @param {ContextoSistema} contexto
   */
  constructor(contexto) {
    const clase = /** @type {typeof SystemBase} */ (this.constructor);

    /** @type {import('./Store.js').Store} */
    this.store = contexto.store;
    /** @type {import('./EventBus.js').EventBus} */
    this.bus = contexto.bus;
    /** @type {import('./RNG.js').GestorRNG} */
    this.rng = contexto.rng;
    /** @type {import('./Registry.js').Registry} */
    this.registry = contexto.registry;

    /** Nombre de esta instancia. */
    this.nombre = clase.nombre;

    /** Canal de registro propio. */
    this.log = crearCanal(clase.canal ?? clase.nombre);

    /**
     * Funciones de limpieza acumuladas. Se ejecutan en detener().
     * @type {Array<() => void>}
     * @private
     */
    this._bajas = [];

    /** @type {boolean} */
    this.iniciado = false;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     CICLO DE VIDA
     Las subclases redefinen los ganchos; nunca llaman a estos métodos.
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Gancho de inicialización. Aquí se registran reductores y oyentes.
   * Puede ser asíncrono si el sistema necesita cargar datos.
   * @returns {void|Promise<void>}
   * @protected
   */
  alIniciar() {}

  /**
   * Gancho ejecutado cuando TODOS los sistemas ya están iniciados.
   * Es el sitio para hablar con otros sistemas: en alIniciar() puede que aún
   * no existan.
   * @returns {void|Promise<void>}
   * @protected
   */
  alArrancar() {}

  /**
   * Gancho de parada. La limpieza de suscripciones es automática; aquí sólo va
   * lo que el sistema haya adquirido por su cuenta (temporizadores, etc.).
   * @returns {void|Promise<void>}
   * @protected
   */
  alDetener() {}

  /**
   * Gancho invocado en cada turno de juego, si el sistema declara `porTurno`.
   * @param {Object} _contexto Datos del turno.
   * @returns {void|Promise<void>}
   * @protected
   */
  alTurno(_contexto) {}

  /* ─────────────────────────────────────────────────────────────────────────
     GESTIÓN INTERNA (invocada por Registry)
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Inicia el sistema. No redefinir: usar alIniciar().
   * @returns {Promise<void>}
   * @internal
   */
  async iniciar() {
    if (this.iniciado) return;
    const fin = this.log.cronometro(`iniciar ${this.nombre}`);
    try {
      await this.alIniciar();
      this.iniciado = true;
      this.log.debug('iniciado');
    } catch (e) {
      registrar(e, this.nombre);
      throw e;
    } finally {
      fin();
    }
  }

  /**
   * Arranca el sistema tras la inicialización global. No redefinir.
   * @returns {Promise<void>}
   * @internal
   */
  async arrancar() {
    try {
      await this.alArrancar();
    } catch (e) {
      registrar(e, this.nombre);
    }
  }

  /**
   * Detiene el sistema y libera TODO lo suscrito. No redefinir.
   * @returns {Promise<void>}
   * @internal
   */
  async detener() {
    if (!this.iniciado) return;
    try {
      await this.alDetener();
    } catch (e) {
      registrar(e, this.nombre);
    }

    // Las bajas se ejecutan en orden inverso al registro, por si alguna depende
    // de otra anterior.
    for (let i = this._bajas.length - 1; i >= 0; i--) {
      try {
        this._bajas[i]();
      } catch (e) {
        registrar(e, this.nombre);
      }
    }

    this._bajas.length = 0;
    this.iniciado = false;
    this.log.debug('detenido');
  }

  /* ─────────────────────────────────────────────────────────────────────────
     AYUDAS CON LIMPIEZA AUTOMÁTICA
     Todo lo que se registre por aquí se libera solo al detener el sistema.
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Escucha un evento del bus.
   * @param {string} patron
   * @param {Function} fn
   * @param {Object} [opciones]
   * @returns {() => void}
   * @protected
   */
  escuchar(patron, fn, opciones) {
    const baja = this.bus.on(patron, fn.bind(this), opciones);
    this._bajas.push(baja);
    return baja;
  }

  /**
   * Registra un reductor en el store.
   * @param {string} tipo
   * @param {import('./Store.js').Reductor} reductor
   * @returns {() => void}
   * @protected
   */
  reductor(tipo, reductor) {
    const baja = this.store.registrar(tipo, reductor.bind(this));
    this._bajas.push(baja);
    return baja;
  }

  /**
   * Registra un mapa de reductores { tipo: fn }.
   * @param {Record<string, import('./Store.js').Reductor>} mapa
   * @protected
   */
  reductores(mapa) {
    for (const [tipo, fn] of Object.entries(mapa)) this.reductor(tipo, fn);
  }

  /**
   * Se suscribe a una rama del estado.
   * @param {string} ruta
   * @param {Function} fn
   * @param {Object} [opciones]
   * @returns {() => void}
   * @protected
   */
  observar(ruta, fn, opciones) {
    const baja = this.store.subscribe(ruta, fn.bind(this), opciones);
    this._bajas.push(baja);
    return baja;
  }

  /**
   * Registra una limpieza arbitraria (temporizador, oyente del DOM…).
   * @param {() => void} fn
   * @protected
   */
  alLimpiar(fn) {
    this._bajas.push(fn);
  }

  /**
   * setInterval que se cancela solo al detener el sistema.
   * @param {Function} fn
   * @param {number} ms
   * @returns {number} Identificador del intervalo.
   * @protected
   */
  intervalo(fn, ms) {
    const id = setInterval(fn, ms);
    this._bajas.push(() => clearInterval(id));
    return id;
  }

  /**
   * setTimeout que se cancela solo al detener el sistema.
   * @param {Function} fn
   * @param {number} ms
   * @returns {number}
   * @protected
   */
  espera(fn, ms) {
    const id = setTimeout(fn, ms);
    this._bajas.push(() => clearTimeout(id));
    return id;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     ATAJOS
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Lee una rama del estado.
   * @param {string} ruta
   * @param {*} [defecto]
   * @returns {*}
   * @protected
   */
  leer(ruta, defecto) {
    return this.store.select(ruta, defecto);
  }

  /**
   * Despacha una acción.
   * @param {string|Object} accion
   * @param {*} [payload]
   * @protected
   */
  despachar(accion, payload) {
    return this.store.dispatch(accion, payload);
  }

  /**
   * Publica un evento.
   * @param {string} evento
   * @param {*} [payload]
   * @protected
   */
  emitir(evento, payload) {
    return this.bus.emit(evento, payload);
  }

  /**
   * Obtiene otro sistema por nombre. Sólo debe usarse con sistemas declarados
   * en `dependencias`; pedirle algo a un sistema no declarado es la vía rápida
   * a un fallo de orden de arranque.
   * @param {string} nombre
   * @returns {SystemBase|undefined}
   * @protected
   */
  sistema(nombre) {
    return this.registry.obtener(nombre);
  }
}

export default SystemBase;
