/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · ui/components/EquipmentSlots.js
 * ---------------------------------------------------------------------------
 * Ranuras de equipo.
 *
 * En la Fase 3 muestra las ranuras vacías: el sistema de inventario llega en la
 * Fase 4. Se incluye ahora para que el panel izquierdo esté completo y para
 * fijar el contrato visual que consumirá Inventory.
 *
 * Dependencias: Component, DOM, Panel, balance.config.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Component } from '../Component.js';
import { h, icono } from '../DOM.js';
import { cabecera } from './Panel.js';
import { OBJETOS } from '../../config/balance.config.js';

/** Etiqueta corta de cada ranura. */
const ETIQUETAS = Object.freeze({
  cabeza: 'Cabeza', torso: 'Torso', manos: 'Manos', piernas: 'Piernas', pies: 'Pies',
  armaPrincipal: 'Arma', armaSecundaria: 'Mano izq.', capa: 'Capa',
  amuleto: 'Amuleto', anillo1: 'Anillo I', anillo2: 'Anillo II',
});

/** Icono por defecto de cada ranura. */
const ICONOS_RANURA = Object.freeze({
  armaPrincipal: 'espada', armaSecundaria: 'escudo',
  torso: 'escudo', cabeza: 'escudo', manos: 'escudo',
  piernas: 'escudo', pies: 'escudo', capa: 'escudo',
  amuleto: 'mana', anillo1: 'mana', anillo2: 'mana',
});

export class EquipmentSlots extends Component {
  static nombre = 'equipo';
  static rama = 'inventory.equipado';

  /**
   * @param {Record<string, string|null>} equipado
   * @returns {Node}
   * @protected
   */
  render(equipado = {}) {
    const ocupadas = Object.values(equipado ?? {}).filter(Boolean).length;

    return h('div.stack.stack--sm', {},
      cabecera({
        titulo: 'Equipo',
        icono: 'espada',
        contador: `${ocupadas}/${OBJETOS.ranurasEquipo.length}`,
      }),

      h('div.slots', {},
        ...OBJETOS.ranurasEquipo.map((ranura) => this._ranura(ranura, equipado?.[ranura])),
      ),
    );
  }

  /** @private */
  _ranura(ranura, idObjeto) {
    const lleno = Boolean(idObjeto);

    return h('button.slot', {
      type: 'button',
      class: lleno ? 'is-filled' : '',
      dataset: {
        ranura,
        // El tooltip del objeto lo servirá InventoryPanel cuando exista.
        tooltipTipo: lleno ? 'objeto' : undefined,
        tooltipRef: lleno ? idObjeto : undefined,
      },
      attrs: {
        'aria-label': ETIQUETAS[ranura] ?? ranura,
        'data-tooltip': lleno ? undefined : `${ETIQUETAS[ranura]}: vacío`,
      },
      onClick: () => this.emitir('ui:equipment:click', { ranura, idObjeto }),
    },
      icono(ICONOS_RANURA[ranura] ?? 'bolsa', { class: 'icon--sm' }),
      h('span.slot__tag', { text: ETIQUETAS[ranura] ?? ranura }),
    );
  }
}

export default EquipmentSlots;
