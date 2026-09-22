/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ui/components/Modal.js
 * ---------------------------------------------------------------------------
 * Ventanas modales: confirmaciones, subida de nivel, árbol de talentos,
 * comercio, ficha de guardado.
 *
 * API basada en promesas: `await ui.confirmar('¿Abandonar?')` devuelve un
 * booleano. Es lo que permite escribir flujos de decisión de forma lineal, sin
 * anidar callbacks por toda la aplicación.
 *
 * Accesibilidad, que en un modal no es opcional:
 *   · El foco se confina dentro (atraparFoco).
 *   · Al cerrar, el foco vuelve exactamente a donde estaba.
 *   · Escape cierra, salvo modales marcados como obligatorios.
 *   · role="dialog" con aria-modal y etiqueta asociada al título.
 *
 * Pila de modales: uno puede abrirse sobre otro. Se cierran en orden inverso.
 *
 * Dependencias: Component, DOM, config, utils/id.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Component } from '../Component.js';
import { h, icono, vaciar, atraparFoco, enfocar, qs } from '../DOM.js';
import { TEXTOS, ICONOS } from '../../config/ui.config.js';
import { id } from '../../utils/id.js';

/**
 * @typedef {Object} ConfigModal
 * @property {string} titulo
 * @property {Node|string} [contenido] Nodo o texto del cuerpo.
 * @property {Array<{etiqueta: string, valor: *, clase?: string, primario?: boolean}>} [botones]
 * @property {boolean} [obligatorio=false] No se cierra con Escape ni con el velo.
 * @property {boolean} [ancho=false] Usa la variante ancha.
 * @property {boolean} [cerrable=true] Muestra la equis de cierre.
 * @property {string} [icono]
 */

export class GestorModal extends Component {
  static nombre = 'modales';
  static rama = '';

  constructor(contexto, opciones) {
    super(contexto, opciones);

    /**
     * Pila de modales abiertos.
     * @type {Array<{nodo: HTMLElement, resolver: Function, config: ConfigModal, liberarFoco: Function, focoPrevio: Element|null}>}
     * @private
     */
    this._pila = [];
  }

  /** @returns {HTMLElement} @protected */
  render() {
    return h('div.modal-stack', { ref: this.ref('raiz') });
  }

  /** @protected */
  alMontar() {
    if (this.el) this.el.style.pointerEvents = 'none';
  }

  /** @returns {boolean} true si hay algún modal abierto. */
  get hayAbierto() {
    return this._pila.length > 0;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     APERTURA
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Abre un modal y espera a que se cierre.
   *
   * @param {ConfigModal} config
   * @returns {Promise<*>} El `valor` del botón pulsado, o null si se descartó.
   *
   * @example
   * const eleccion = await ui.abrirModal({
   *   titulo: 'Has subido de nivel',
   *   contenido: nodoDeMejoras,
   *   botones: [{ etiqueta: 'Confirmar', valor: true, primario: true }],
   *   obligatorio: true,
   * });
   */
  abrir(config) {
    return new Promise((resolver) => {
      const idTitulo = id('modal-title');
      const focoPrevio = document.activeElement;

      const cerrarConValor = (valor) => this._cerrarNodo(nodo, valor);

      const cuerpo = typeof config.contenido === 'string'
        ? h('p', { text: config.contenido })
        : (config.contenido ?? null);

      const botones = (config.botones ?? [{ etiqueta: TEXTOS.confirmaciones.si, valor: true, primario: true }])
        .map((b) => h('button', {
          type: 'button',
          class: ['btn', b.primario ? 'btn--primary' : '', b.clase ?? ''].filter(Boolean).join(' '),
          text: b.etiqueta,
          onClick: () => cerrarConValor(b.valor),
        }));

      const caja = h('div', {
        class: config.ancho ? 'modal modal--wide' : 'modal',
        attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': idTitulo },
      },
        h('div.modal__head', {},
          h('h2.modal__title', { id: idTitulo },
            config.icono ? icono(config.icono, { class: 'icon--lg' }) : null,
            h('span', { text: config.titulo }),
          ),
          config.cerrable !== false && !config.obligatorio
            ? h('button.btn.btn--ghost.btn--icon', {
                type: 'button',
                attrs: { 'aria-label': TEXTOS.confirmaciones.cancelar },
                onClick: () => cerrarConValor(null),
              }, icono('cerrar'))
            : null,
        ),
        cuerpo ? h('div.modal__body', {}, cuerpo) : null,
        botones.length ? h('div.modal__foot', {}, ...botones) : null,
      );

      const nodo = h('div.modal-backdrop', {
        // Un clic en el velo descarta, salvo que el modal sea obligatorio.
        onClick: (e) => {
          if (e.target === nodo && !config.obligatorio) cerrarConValor(null);
        },
      }, caja);

      // Escape cierra solo el modal superior de la pila.
      const alTeclear = (e) => {
        if (e.key !== 'Escape' || config.obligatorio) return;
        if (this._pila[this._pila.length - 1]?.nodo !== nodo) return;
        e.stopPropagation();
        cerrarConValor(null);
      };
      nodo.addEventListener('keydown', alTeclear);

      this.refs.raiz.appendChild(nodo);
      const liberarFoco = atraparFoco(caja);

      this._pila.push({ nodo, resolver, config, liberarFoco, focoPrevio });
      this.emitir('ui:layer:open', { capa: 'modal', titulo: config.titulo });

      // El foco va al botón primario si existe; si no, a la propia caja.
      const primario = caja.querySelector('.btn--primary') ?? caja;
      requestAnimationFrame(() => enfocar(/** @type {HTMLElement} */ (primario)));
    });
  }

  /**
   * Diálogo de confirmación.
   *
   * @param {string} mensaje
   * @param {Object} [opciones]
   * @param {string} [opciones.titulo]
   * @param {string} [opciones.si]
   * @param {string} [opciones.no]
   * @param {boolean} [opciones.peligroso=false] Marca el botón afirmativo en rojo.
   * @returns {Promise<boolean>}
   */
  async confirmar(mensaje, opciones = {}) {
    const resultado = await this.abrir({
      titulo: opciones.titulo ?? '¿Estás seguro?',
      contenido: mensaje,
      botones: [
        { etiqueta: opciones.no ?? TEXTOS.confirmaciones.no, valor: false },
        {
          etiqueta: opciones.si ?? TEXTOS.confirmaciones.si,
          valor: true,
          primario: !opciones.peligroso,
          clase: opciones.peligroso ? 'btn--danger' : '',
        },
      ],
    });
    return resultado === true;
  }

  /**
   * Modal informativo con un solo botón.
   * @param {string} titulo
   * @param {string|Node} contenido
   * @returns {Promise<void>}
   */
  async informar(titulo, contenido) {
    await this.abrir({
      titulo,
      contenido,
      botones: [{ etiqueta: 'Entendido', valor: true, primario: true }],
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     CIERRE
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Cierra el modal superior de la pila.
   * @param {*} [valor=null]
   */
  cerrar(valor = null) {
    const superior = this._pila[this._pila.length - 1];
    if (superior) this._cerrarNodo(superior.nodo, valor);
  }

  /** Cierra todos los modales abiertos. */
  cerrarTodos() {
    while (this._pila.length) this.cerrar(null);
  }

  /**
   * @param {HTMLElement} nodo
   * @param {*} valor
   * @private
   */
  _cerrarNodo(nodo, valor) {
    const indice = this._pila.findIndex((m) => m.nodo === nodo);
    if (indice === -1) return;

    const [modal] = this._pila.splice(indice, 1);
    modal.liberarFoco();
    modal.nodo.remove();
    modal.resolver(valor);

    // El foco vuelve a donde estaba antes de abrir. Sin esto, la navegación por
    // teclado se pierde tras cada modal.
    if (modal.focoPrevio instanceof HTMLElement && modal.focoPrevio.isConnected) {
      enfocar(modal.focoPrevio);
    }

    this.emitir('ui:layer:close', { capa: 'modal', valor });
  }

  /** @protected */
  alDestruir() {
    this.cerrarTodos();
  }
}

export default GestorModal;
