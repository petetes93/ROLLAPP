/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · ui/components/QuickChoices.js
 * ---------------------------------------------------------------------------
 * Fila de acciones sugeridas, justo encima de la caja de texto.
 *
 * Complementa al popup en vez de duplicarlo. El popup interrumpe y reclama
 * atención; esta fila es persistente y discreta: las opciones siguen ahí
 * después de cerrar el popup, por si el jugador se lo pensó mejor.
 *
 * Se alimenta de `narrative.opciones`, la misma rama que el popup, de modo que
 * ambos muestran siempre lo mismo sin coordinarse entre sí.
 *
 * Dependencias: Component, DOM, config, utils/text.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Component } from '../Component.js';
import { h, icono, vaciar } from '../DOM.js';
import { ICONOS_INTENCION } from '../../config/ui.config.js';
import { LIMITES } from '../../config/app.config.js';
import { truncar } from '../../utils/text.js';

export class QuickChoices extends Component {
  static nombre = 'opciones-rapidas';
  static rama = 'narrative.opciones';

  /**
   * @param {Array<Object>} opciones
   * @returns {Node|null}
   * @protected
   */
  render(opciones = []) {
    if (!Array.isArray(opciones) || !opciones.length) return null;

    const fragmento = document.createDocumentFragment();
    for (const [i, opcion] of opciones.slice(0, LIMITES.opcionesMax).entries()) {
      fragmento.appendChild(this._crearChip(opcion, i));
    }
    return fragmento;
  }

  /**
   * @param {Object} opcion
   * @param {number} indice
   * @returns {HTMLElement}
   * @private
   */
  _crearChip(opcion, indice) {
    const claveIcono = opcion.icon ?? ICONOS_INTENCION[opcion.intent] ?? null;

    return h('button.choice', {
      type: 'button',
      dataset: { risk: opcion.risk ?? 'low', opcion: opcion.id ?? String(indice) },
      attrs: { title: opcion.label },
      // Alt+clic precarga en la caja en vez de enviar, igual que en el popup.
      onClick: (e) => this._elegir(opcion, Boolean(e.altKey)),
    },
      claveIcono ? icono(claveIcono, { class: 'icon--sm' }) : null,
      h('span', { text: truncar(opcion.label ?? '', 40) }),
    );
  }

  /**
   * @param {Object} opcion
   * @param {boolean} precargar
   * @private
   */
  _elegir(opcion, precargar) {
    if (this.leer('ui.entradaBloqueada')) return;

    if (precargar) {
      this.emitir('ui:choice:preload', { texto: opcion.label });
      return;
    }

    this.emitir('ui:choice:pick', { opcion, origen: 'chips' });
    this.ui?.enviarAccion(opcion.label, {
      origen: 'chips',
      intencion: opcion.intent ?? null,
      opcionId: opcion.id ?? null,
    });
  }

  /**
   * Las opciones cambian de golpe al llegar cada turno, así que un render
   * completo es lo correcto aquí: no hay nada que conservar entre turnos.
   * @returns {boolean}
   * @protected
   */
  actualizar() {
    return false;
  }

  /** @protected */
  alMontar() {
    // El bloqueo de entrada atenúa los chips sin desmontarlos: siguen visibles
    // como referencia mientras el director responde.
    this.observar('ui.entradaBloqueada', (bloqueada) => {
      if (!this.el) return;
      this.el.style.opacity = bloqueada ? '0.45' : '1';
      this.el.style.pointerEvents = bloqueada ? 'none' : 'auto';
    }, { inmediato: true });
  }
}

export default QuickChoices;
