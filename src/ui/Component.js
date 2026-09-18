/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · ui/Component.js
 * ---------------------------------------------------------------------------
 * Clase base de todo componente de interfaz.
 *
 * Contrato: montar() → actualizar() → destruir(). Un componente se suscribe a
 * una rama del estado y solo se redibuja cuando esa rama cambia por identidad.
 * Como el Store aplica parches inmutables clonando únicamente el camino tocado,
 * la comparación es una igualdad por referencia: barata y exacta.
 *
 * El renderizado se agrupa por fotograma, de modo que veinte cambios en una
 * transacción producen un solo repintado.
 *
 * Todo lo que el componente registre (oyentes del DOM, suscripciones al estado,
 * eventos del bus, temporizadores) se libera solo al destruirse. Sin excepción:
 * es lo que permite cambiar de pantalla mil veces sin acumular fugas.
 *
 * Dependencias: DOM, core/Logger, core/Errors, utils/debounce.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { vaciar, on as onDOM, delegar as delegarDOM } from './DOM.js';
import { crearCanal } from '../core/Logger.js';
import { registrar } from '../core/Errors.js';
import { porFotograma } from '../utils/debounce.js';

/**
 * @typedef {Object} ContextoUI
 * @property {import('../core/Store.js').Store} store
 * @property {import('../core/EventBus.js').EventBus} bus
 * @property {Object} [ui] Referencia al UIManager, si hace falta.
 */

export class Component {
  /**
   * Nombre del componente, para el registro y la depuración.
   * @type {string}
   */
  static nombre = 'componente';

  /**
   * Rama del estado que vigila. Cadena vacía = no se suscribe a nada y solo se
   * redibuja cuando se le pide explícitamente.
   * @type {string}
   */
  static rama = '';

  /**
   * @param {ContextoUI} contexto
   * @param {Object} [opciones] Configuración propia del componente.
   */
  constructor(contexto, opciones = {}) {
    const clase = /** @type {typeof Component} */ (this.constructor);

    /** @type {import('../core/Store.js').Store} */
    this.store = contexto.store;
    /** @type {import('../core/EventBus.js').EventBus} */
    this.bus = contexto.bus;
    /** @type {Object|undefined} */
    this.ui = contexto.ui;

    /** Opciones de instancia. */
    this.opciones = opciones;

    /** Nombre de la clase. */
    this.nombre = clase.nombre;

    /** Canal de registro compartido por toda la interfaz. */
    this.log = crearCanal('ui');

    /**
     * Elemento contenedor donde vive el componente.
     * @type {HTMLElement|null}
     */
    this.el = null;

    /** true entre montar() y destruir(). */
    this.montado = false;

    /**
     * Referencias a nodos internos, para actualizaciones puntuales sin
     * reconstruir el árbol entero.
     * @type {Record<string, HTMLElement>}
     */
    this.refs = {};

    /**
     * Funciones de limpieza acumuladas.
     * @type {Array<() => void>}
     * @private
     */
    this._bajas = [];

    /** Último valor visto de la rama vigilada. @private */
    this._ultimo = undefined;

    /**
     * Redibujado agrupado por fotograma.
     * @private
     */
    this._pintarAgrupado = porFotograma(() => this._pintar());
  }

  /* ─────────────────────────────────────────────────────────────────────────
     GANCHOS PARA LAS SUBCLASES
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Construye el árbol de nodos del componente.
   * Se invoca UNA vez, al montar. Debe devolver el contenido a insertar.
   *
   * @param {*} _datos Valor actual de la rama vigilada.
   * @returns {Node|Node[]|null}
   * @protected
   */
  render(_datos) {
    return null;
  }

  /**
   * Actualiza el DOM ya construido con datos nuevos.
   *
   * Implementarlo es lo que separa un componente eficiente de uno que reconstruye
   * todo cada vez. Si se omite, el componente vuelve a renderizar por completo,
   * lo cual es aceptable para árboles pequeños.
   *
   * @param {*} _datos
   * @param {*} _anterior
   * @returns {boolean} true si se ha encargado de la actualización; false para
   *   que la clase base rehaga el render completo.
   * @protected
   */
  actualizar(_datos, _anterior) {
    return false;
  }

  /**
   * Se ejecuta tras el primer montaje, con el DOM ya insertado.
   * Es el sitio para oyentes, foco inicial y mediciones.
   * @protected
   */
  alMontar() {}

  /**
   * Se ejecuta antes de desmontar. La limpieza de suscripciones es automática.
   * @protected
   */
  alDestruir() {}

  /* ─────────────────────────────────────────────────────────────────────────
     CICLO DE VIDA
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Monta el componente en un contenedor.
   *
   * @param {HTMLElement|null} contenedor
   * @returns {Component} this, para encadenar.
   */
  montar(contenedor) {
    if (!contenedor) {
      this.log.aviso(`${this.nombre}: contenedor inexistente; no se monta`);
      return this;
    }
    if (this.montado) this.destruir();

    this.el = contenedor;
    this.el.dataset.componente = this.nombre;

    const rama = /** @type {typeof Component} */ (this.constructor).rama;
    this._ultimo = rama ? this.store.select(rama) : undefined;

    try {
      const contenido = this.render(this._ultimo);
      vaciar(this.el);
      if (contenido) {
        if (Array.isArray(contenido)) contenido.forEach((n) => n && this.el.appendChild(n));
        else this.el.appendChild(contenido);
      }
    } catch (e) {
      registrar(e, 'ui');
      return this;
    }

    // Suscripción a la rama vigilada, con redibujado agrupado.
    if (rama) {
      const baja = this.store.subscribe(rama, (valor) => {
        this._pendiente = valor;
        this._pintarAgrupado();
      });
      this._bajas.push(baja);
    }

    this.montado = true;

    try {
      this.alMontar();
    } catch (e) {
      registrar(e, 'ui');
    }

    return this;
  }

  /**
   * Fuerza un repintado inmediato, sin esperar a un cambio de estado.
   */
  refrescar() {
    if (!this.montado) return;
    const rama = /** @type {typeof Component} */ (this.constructor).rama;
    this._pendiente = rama ? this.store.select(rama) : undefined;
    this._pintar();
  }

  /**
   * Aplica el cambio pendiente: primero intenta la actualización parcial y,
   * si el componente no la implementa, rehace el render.
   * @private
   */
  _pintar() {
    if (!this.montado || !this.el) return;

    const datos = this._pendiente;
    const anterior = this._ultimo;
    this._ultimo = datos;

    try {
      if (this.actualizar(datos, anterior)) return;

      const contenido = this.render(datos);
      vaciar(this.el);
      this.refs = {};
      if (contenido) {
        if (Array.isArray(contenido)) contenido.forEach((n) => n && this.el.appendChild(n));
        else this.el.appendChild(contenido);
      }
    } catch (e) {
      registrar(e, 'ui');
    }
  }

  /**
   * Destruye el componente y libera todo lo que registró.
   */
  destruir() {
    if (!this.montado) return;

    try {
      this.alDestruir();
    } catch (e) {
      registrar(e, 'ui');
    }

    this._pintarAgrupado.cancelar();

    for (let i = this._bajas.length - 1; i >= 0; i--) {
      try {
        this._bajas[i]();
      } catch (e) {
        registrar(e, 'ui');
      }
    }
    this._bajas.length = 0;

    if (this.el) {
      vaciar(this.el);
      delete this.el.dataset.componente;
    }

    this.refs = {};
    this.el = null;
    this.montado = false;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     AYUDAS CON LIMPIEZA AUTOMÁTICA
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Oyente del DOM que se retira al destruir el componente.
   * @param {EventTarget} el
   * @param {string} evento
   * @param {EventListener} fn
   * @param {*} [opciones]
   * @returns {() => void}
   * @protected
   */
  on(el, evento, fn, opciones) {
    const baja = onDOM(el, evento, fn.bind(this), opciones);
    this._bajas.push(baja);
    return baja;
  }

  /**
   * Delegación de eventos con limpieza automática.
   * @param {Element} contenedor
   * @param {string} evento
   * @param {string} selector
   * @param {Function} fn
   * @returns {() => void}
   * @protected
   */
  delegar(contenedor, evento, selector, fn) {
    const baja = delegarDOM(contenedor, evento, selector, fn.bind(this));
    this._bajas.push(baja);
    return baja;
  }

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
   * Se suscribe a una rama adicional del estado, distinta de la principal.
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
   * Temporizador que se cancela al destruir el componente.
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

  /**
   * Intervalo que se cancela al destruir el componente.
   * @param {Function} fn
   * @param {number} ms
   * @returns {number}
   * @protected
   */
  intervalo(fn, ms) {
    const id = setInterval(fn, ms);
    this._bajas.push(() => clearInterval(id));
    return id;
  }

  /**
   * Registra una limpieza arbitraria.
   * @param {() => void} fn
   * @protected
   */
  alLimpiar(fn) {
    this._bajas.push(fn);
  }

  /* ─────────────────────────────────────────────────────────────────────────
     ATAJOS
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Lee una rama del estado.
   * @param {string} ruta
   * @param {*} [defecto]
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
   * Guarda una referencia a un nodo interno.
   * @param {string} nombre
   * @returns {(el: HTMLElement) => void} Función apta para la prop `ref` de h().
   * @protected
   */
  ref(nombre) {
    return (el) => { this.refs[nombre] = el; };
  }
}

export default Component;
