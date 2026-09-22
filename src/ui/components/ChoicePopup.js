/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ui/components/ChoicePopup.js
 * ---------------------------------------------------------------------------
 * Popup de opciones sugeridas por el director.
 *
 * Principio que gobierna este componente: es un ATAJO, nunca una jaula. Su pie
 * lo dice explícitamente y la caja de acción sigue activa detrás. Se cierra con
 * Escape, con un clic fuera o simplemente escribiendo.
 *
 * Detalles de uso:
 *   · Cada opción lleva su número: las teclas 1-9 las seleccionan.
 *   · El riesgo tiñe el borde (rojo para lo peligroso, azul para lo social),
 *     de modo que se lee la temperatura de la escena de un vistazo.
 *   · Clic normal → envía la acción. Clic con Alt → la precarga en la caja para
 *     matizarla antes de enviar.
 *   · El foco entra en la primera opción y queda confinado mientras está abierto.
 *
 * Dependencias: Component, DOM, config, utils/id.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Component } from '../Component.js';
import { h, icono, vaciar, atraparFoco, enfocar, qs } from '../DOM.js';
import { TEXTOS, ICONOS_INTENCION, COMPORTAMIENTO, SELECTORES } from '../../config/ui.config.js';
import { LIMITES, TIEMPOS } from '../../config/app.config.js';
import { truncar } from '../../utils/text.js';

export class ChoicePopup extends Component {
  static nombre = 'popup';
  static rama = '';

  constructor(contexto, opciones) {
    super(contexto, opciones);

    /** @type {HTMLElement|null} @private */
    this._caja = null;
    /** @type {Array<Object>} @private */
    this._opciones = [];
    /** @type {Function|null} @private */
    this._liberarFoco = null;
    /** @private */
    this._abierto = false;
    /** @private */
    this._temporizador = 0;
  }

  /** @returns {HTMLElement} @protected */
  render() {
    return h('div.popup-host', { ref: this.ref('raiz') });
  }

  /** @protected */
  alMontar() {
    if (this.el) this.el.style.pointerEvents = 'none';

    // Escribir en la caja de acción cierra el popup: el jugador ha decidido ir
    // por libre y no hay razón para seguir tapando la pantalla.
    if (COMPORTAMIENTO.cerrarPopupAlEscribir) {
      const campo = qs(SELECTORES.accion.entrada);
      if (campo) {
        this.on(campo, 'input', () => {
          if (this._abierto && campo.value.length > 0) this.cerrar();
        });
      }
    }

    // Un clic fuera de la caja también cierra.
    this.on(document, 'pointerdown', (e) => {
      if (!this._abierto || !this._caja) return;
      if (!this._caja.contains(e.target)) this.cerrar();
    });
  }

  /** @returns {boolean} */
  get abierto() {
    return this._abierto;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     APERTURA
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Muestra el popup con un conjunto de opciones.
   *
   * @param {Array<{id: string, label: string, intent?: string, risk?: string, icon?: string}>} opciones
   * @param {Object} [config]
   * @param {string} [config.titulo]
   * @param {number} [config.retardo] Espera antes de aparecer.
   */
  mostrar(opciones, config = {}) {
    if (!Array.isArray(opciones) || !opciones.length) return;
    if (!this.leer('settings.popupOpciones', true)) return;

    clearTimeout(this._temporizador);
    const retardo = config.retardo ?? TIEMPOS.popupRetardo;

    this._temporizador = setTimeout(() => {
      this._abrir(opciones.slice(0, LIMITES.opcionesMax), config);
    }, retardo);
  }

  /**
   * @param {Array<Object>} opciones
   * @param {Object} config
   * @private
   */
  _abrir(opciones, config) {
    this.cerrar();

    this._opciones = opciones;

    const botones = opciones.map((opcion, i) => this._crearBoton(opcion, i));

    this._caja = h('div.popup', {
      attrs: { role: 'dialog', 'aria-label': config.titulo ?? TEXTOS.popup.titulo },
    },
      h('div.popup__head', { text: config.titulo ?? TEXTOS.popup.titulo }),
      h('div.popup__body', {}, ...botones),
      h('div.popup__foot', { text: TEXTOS.popup.pie }),
    );

    // La caja sí recibe eventos, aunque su capa contenedora no.
    this._caja.style.pointerEvents = 'auto';

    // Se ancla al panel central para que quede sobre la narración y no tape la
    // caja de acción.
    const anfitrion = qs(SELECTORES.paneles.central) ?? this.refs.raiz;
    anfitrion.appendChild(this._caja);

    this._liberarFoco = atraparFoco(this._caja);
    this._abierto = true;
    this.store.fijar('ui.popupAbierto', true);

    requestAnimationFrame(() => enfocar(/** @type {HTMLElement} */ (botones[0])));
    this.emitir('ui:layer:open', { capa: 'popup', opciones: opciones.length });
  }

  /**
   * Construye el botón de una opción.
   * @param {Object} opcion
   * @param {number} indice
   * @returns {HTMLElement}
   * @private
   */
  _crearBoton(opcion, indice) {
    const claveIcono = opcion.icon ?? ICONOS_INTENCION[opcion.intent] ?? null;

    return h('button.choice', {
      type: 'button',
      dataset: { risk: opcion.risk ?? 'low', opcion: opcion.id ?? String(indice) },
      attrs: { 'aria-keyshortcuts': indice < 9 ? String(indice + 1) : null },
      onClick: (e) => this.elegir(indice, { precargar: e.altKey }),
    },
      indice < 9 ? h('span.choice__key', { text: String(indice + 1) }) : null,
      claveIcono ? icono(claveIcono, { class: 'icon--sm' }) : null,
      h('span', { text: truncar(opcion.label ?? '', 60) }),
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
     SELECCIÓN
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Elige una opción por su índice.
   *
   * @param {number} indice
   * @param {Object} [opciones]
   * @param {boolean} [opciones.precargar=false] Lleva el texto a la caja en vez
   *   de enviarlo, para que el jugador pueda matizarlo.
   */
  elegir(indice, opciones = {}) {
    const opcion = this._opciones[indice];
    if (!opcion) return;

    if (opciones.precargar) {
      this.emitir('ui:choice:preload', { texto: opcion.label });
      this.cerrar();
      return;
    }

    this.cerrar();
    this.emitir('ui:choice:pick', { opcion, indice });
    this.ui?.enviarAccion(opcion.label, {
      origen: 'popup',
      intencion: opcion.intent ?? null,
      opcionId: opcion.id ?? null,
    });
  }

  /**
   * Selección por atajo numérico. La llama UIManager.
   * @param {number} indice
   */
  elegirPorIndice(indice) {
    this.elegir(indice);
  }

  /* ─────────────────────────────────────────────────────────────────────────
     CIERRE
     ───────────────────────────────────────────────────────────────────────── */

  /** Cierra el popup sin elegir nada. */
  cerrar() {
    clearTimeout(this._temporizador);

    if (!this._abierto) return;

    this._liberarFoco?.();
    this._liberarFoco = null;
    this._caja?.remove();
    this._caja = null;
    this._opciones = [];
    this._abierto = false;
    this.store.fijar('ui.popupAbierto', false);

    this.emitir('ui:layer:close', { capa: 'popup' });
  }

  /** @protected */
  alDestruir() {
    this.cerrar();
  }
}

export default ChoicePopup;
