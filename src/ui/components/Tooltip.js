/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ui/components/Tooltip.js
 * ---------------------------------------------------------------------------
 * Descripciones flotantes al vuelo.
 *
 * Un solo tooltip para toda la aplicación, reposicionado según haga falta. La
 * alternativa —un nodo por cada objeto del inventario— multiplicaría los nodos
 * sin ganar nada.
 *
 * Se activa por delegación desde el documento: cualquier elemento con
 * `data-tooltip` o `data-tooltip-ref` lo dispara, sin que quien lo renderiza
 * tenga que registrar nada.
 *
 * El posicionamiento evita desbordar la ventana: si no cabe abajo, sube; si no
 * cabe a la derecha, se pega al borde.
 *
 * Dependencias: Component, DOM, utils/debounce.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Component } from '../Component.js';
import { h, vaciar, visible, aplicarEstilos } from '../DOM.js';
import { antirrebote } from '../../utils/debounce.js';

/** Separación entre el objetivo y el tooltip, en píxeles. */
const MARGEN = 10;

/** Retardo antes de mostrar, para no invadir al pasar el ratón de largo. */
const RETARDO = 260;

export class GestorTooltip extends Component {
  static nombre = 'tooltip';
  static rama = '';

  constructor(contexto, opciones) {
    super(contexto, opciones);

    /** @type {HTMLElement|null} @private */
    this._caja = null;
    /** @type {HTMLElement|null} @private */
    this._objetivo = null;
    /** @private */
    this._temporizador = 0;

    /**
     * Proveedores de contenido registrados por clave. Permite que
     * InventoryPanel registre cómo se dibuja la ficha de un objeto sin que
     * este módulo sepa nada de objetos.
     * @type {Map<string, (ref: string) => (Node|null)>}
     * @private
     */
    this._proveedores = new Map();
  }

  /** @returns {HTMLElement} @protected */
  render() {
    this._caja = h('div.tooltip', {
      attrs: { role: 'tooltip', 'aria-hidden': 'true' },
      hidden: true,
    });
    return this._caja;
  }

  /** @protected */
  alMontar() {
    if (this.el) this.el.style.pointerEvents = 'none';

    // Delegación global: un puñado de oyentes para toda la aplicación.
    this.on(document, 'mouseover', this._alEntrar);
    this.on(document, 'mouseout', this._alSalir);
    this.on(document, 'focusin', this._alEntrar);
    this.on(document, 'focusout', this._alSalir);

    // Cualquier desplazamiento o redimensión invalida la posición calculada.
    const ocultarAgrupado = antirrebote(() => this.ocultar(), 60);
    this.on(window, 'scroll', ocultarAgrupado, true);
    this.on(window, 'resize', ocultarAgrupado);
    this.alLimpiar(() => ocultarAgrupado.cancelar());
  }

  /**
   * Registra un proveedor de contenido para una familia de tooltips.
   *
   * @param {string} clave Valor de `data-tooltip-tipo`.
   * @param {(ref: string) => (Node|null)} fn Recibe `data-tooltip-ref`.
   *
   * @example
   * ui.tooltip.registrar('objeto', (idObjeto) => fichaDeObjeto(idObjeto));
   */
  registrar(clave, fn) {
    this._proveedores.set(clave, fn);
  }

  /**
   * @param {Event} e
   * @private
   */
  _alEntrar(e) {
    const objetivo = e.target.closest?.('[data-tooltip], [data-tooltip-ref]');
    if (!objetivo || objetivo === this._objetivo) return;

    this._objetivo = objetivo;
    clearTimeout(this._temporizador);
    this._temporizador = setTimeout(() => this._mostrarPara(objetivo), RETARDO);
  }

  /**
   * @param {Event} e
   * @private
   */
  _alSalir(e) {
    const objetivo = e.target.closest?.('[data-tooltip], [data-tooltip-ref]');
    if (!objetivo) return;
    if (objetivo !== this._objetivo) return;
    this.ocultar();
  }

  /**
   * @param {HTMLElement} objetivo
   * @private
   */
  _mostrarPara(objetivo) {
    if (!this._caja || !objetivo.isConnected) return;

    /** @type {Node|null} */
    let contenido = null;

    const tipo = objetivo.dataset.tooltipTipo;
    const ref = objetivo.dataset.tooltipRef;

    if (tipo && ref && this._proveedores.has(tipo)) {
      contenido = this._proveedores.get(tipo)(ref);
    } else if (objetivo.dataset.tooltip) {
      // Texto plano, insertado de forma segura.
      contenido = h('div', { text: objetivo.dataset.tooltip });
    }

    if (!contenido) return;

    vaciar(this._caja);
    this._caja.appendChild(contenido);
    visible(this._caja, true);
    this._caja.setAttribute('aria-hidden', 'false');

    this._posicionar(objetivo);
  }

  /**
   * Coloca el tooltip junto al objetivo sin salirse de la ventana.
   * @param {HTMLElement} objetivo
   * @private
   */
  _posicionar(objetivo) {
    if (!this._caja) return;

    const r = objetivo.getBoundingClientRect();
    const c = this._caja.getBoundingClientRect();
    const anchoVentana = window.innerWidth;
    const altoVentana = window.innerHeight;

    // Preferencia: debajo y alineado a la izquierda del objetivo.
    let top = r.bottom + MARGEN;
    let left = r.left;

    // Si no cabe debajo, se coloca encima.
    if (top + c.height > altoVentana - MARGEN) {
      top = r.top - c.height - MARGEN;
    }
    // Si tampoco cabe encima, se pega al borde superior.
    if (top < MARGEN) top = MARGEN;

    // Ajuste horizontal.
    if (left + c.width > anchoVentana - MARGEN) {
      left = anchoVentana - c.width - MARGEN;
    }
    if (left < MARGEN) left = MARGEN;

    aplicarEstilos(this._caja, { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` });
  }

  /** Oculta el tooltip. */
  ocultar() {
    clearTimeout(this._temporizador);
    this._objetivo = null;
    if (!this._caja) return;
    visible(this._caja, false);
    this._caja.setAttribute('aria-hidden', 'true');
    vaciar(this._caja);
  }

  /** @protected */
  alDestruir() {
    clearTimeout(this._temporizador);
    this._proveedores.clear();
  }
}

export default GestorTooltip;
