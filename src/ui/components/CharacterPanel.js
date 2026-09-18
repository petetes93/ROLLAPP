/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · ui/components/CharacterPanel.js
 * ---------------------------------------------------------------------------
 * Ficha del personaje en el panel izquierdo: identidad, nivel, experiencia,
 * atributos y alineamiento.
 *
 * Se suscribe a `player` entera porque casi cualquier cambio en el personaje
 * afecta a algo de aquí. La actualización parcial evita reconstruir el árbol:
 * solo se reescriben los nodos cuyo valor cambió.
 *
 * Dependencias: Component, DOM, StatBar, sistemas de jugador, datos.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Component } from '../Component.js';
import { h, icono, texto as fijarTexto, atributo } from '../DOM.js';
import { cabecera } from './Panel.js';
import { StatBar } from './StatBar.js';
import { META_ATRIBUTOS, resumenAtributos } from '../../player/Attributes.js';
import { resumenProgresion } from '../../player/Progression.js';
import { describir as describirAlineamiento } from '../../player/Alignment.js';
import { obtenerRaza } from '../../data/races.data.js';
import { obtenerClase } from '../../data/classes.data.js';
import { ATRIBUTOS } from '../../config/balance.config.js';
import { modificador as formatearMod } from '../../utils/format.js';

export class CharacterPanel extends Component {
  static nombre = 'personaje';
  static rama = 'player';

  constructor(contexto, opciones) {
    super(contexto, opciones);
    /** @type {StatBar|null} @private */
    this._barraXP = null;
  }

  /**
   * @param {Object} jugador
   * @returns {Node}
   * @protected
   */
  render(jugador) {
    if (!jugador?.raza) {
      return h('p.block__empty', { text: 'Sin personaje' });
    }

    const raza = obtenerRaza(jugador.raza);
    const clase = obtenerClase(jugador.clase);
    const prog = resumenProgresion(jugador);
    const atributos = resumenAtributos(jugador);
    const alineamiento = describirAlineamiento(jugador.alineamiento);

    // Barra de experiencia, con su propia instancia para poder actualizarla.
    this._barraXP = new StatBar({
      clave: 'exp',
      etiqueta: `Nivel ${jugador.nivel}`,
      icono: 'pergamino',
      actual: prog.xpEnNivel,
      max: prog.xpParaSiguiente || 1,
      delgada: true,
      alarma: false,
      formato: prog.alMaximo ? 'ninguno' : 'razon',
    });

    return h('div.stack.stack--sm', {},
      cabecera({ titulo: 'Personaje', icono: 'escudo' }),

      // — Identidad —
      h('div.charcard', {},
        h('div.charcard__sigil', {
          ref: this.ref('sigilo'),
          text: (jugador.nombre?.[0] ?? '?').toUpperCase(),
        }),
        h('div', { style: { minWidth: 0 } },
          h('div.charcard__name.truncate', { ref: this.ref('nombre'), text: jugador.nombre }),
          h('div.charcard__meta.truncate', {
            ref: this.ref('meta'),
            text: `${raza?.nombre ?? '—'}${jugador.subraza ? ' ·' : ''} ${clase?.nombre ?? '—'}`,
          }),
          h('div.charcard__level', {
            ref: this.ref('nivel'),
            text: `Nivel ${jugador.nivel} · ${alineamiento.cuadrante}`,
          }),
        ),
      ),

      // — Experiencia —
      this._barraXP.render(),

      // Aviso de puntos sin gastar: es fácil olvidarse tras subir de nivel.
      prog.hayPendientes
        ? h('button.btn.btn--sm.btn--block', {
            ref: this.ref('pendientes'),
            type: 'button',
            onClick: () => this.emitir('ui:modal:levelup'),
          },
            icono('dado', { class: 'icon--sm' }),
            h('span', { text: this._textoPendientes(prog.puntosPendientes) }),
          )
        : null,

      h('div.filo'),

      // — Atributos —
      h('div.attrs', { ref: this.ref('atributos') },
        ...ATRIBUTOS.orden.map((clave) => this._celdaAtributo(clave, atributos[clave])),
      ),
    );
  }

  /** @private */
  _celdaAtributo(clave, datos) {
    const meta = META_ATRIBUTOS[clave];

    return h('div.attr', {
      dataset: { atributo: clave },
      attrs: { 'data-tooltip': `${meta.nombre}: ${meta.descripcion}` },
    },
      h('span.attr__label', { text: meta.abreviatura }),
      h('span.attr__value', {
        text: String(datos.total),
        // Un atributo alterado temporalmente se colorea para que se note.
        style: datos.temporal !== 0
          ? { color: datos.temporal > 0 ? 'var(--c-exito)' : 'var(--c-peligro)' }
          : {},
      }),
      h('span.attr__mod', { text: formatearMod(datos.mod) }),
    );
  }

  /** @private */
  _textoPendientes(p) {
    const partes = [];
    if (p.atributo) partes.push(`${p.atributo} de atributo`);
    if (p.talento) partes.push(`${p.talento} de talento`);
    if (p.habilidad) partes.push(`${p.habilidad} de habilidad`);
    return `Tienes ${partes.join(', ')} por gastar`;
  }

  /**
   * Actualización parcial: solo se reescribe lo que cambió.
   * @param {Object} jugador
   * @param {Object} anterior
   * @returns {boolean}
   * @protected
   */
  actualizar(jugador, anterior) {
    if (!jugador?.raza || !anterior?.raza) return false;   // Render completo.
    if (jugador.clase !== anterior.clase || jugador.raza !== anterior.raza) return false;

    // Identidad
    if (jugador.nombre !== anterior.nombre) {
      fijarTexto(this.refs.nombre, jugador.nombre);
      fijarTexto(this.refs.sigilo, (jugador.nombre?.[0] ?? '?').toUpperCase());
    }

    // Nivel y alineamiento
    if (jugador.nivel !== anterior.nivel || jugador.alineamiento !== anterior.alineamiento) {
      const a = describirAlineamiento(jugador.alineamiento);
      fijarTexto(this.refs.nivel, `Nivel ${jugador.nivel} · ${a.cuadrante}`);
    }

    // Experiencia
    if (jugador.xp !== anterior.xp || jugador.nivel !== anterior.nivel) {
      const prog = resumenProgresion(jugador);
      this._barraXP?.actualizar(prog.xpEnNivel, prog.xpParaSiguiente || 1);
      if (jugador.xp > (anterior.xp ?? 0)) this._barraXP?.destellar();

      // El aviso de puntos pendientes aparece o desaparece: render completo.
      const habiaPendientes = Boolean(this.refs.pendientes);
      if (prog.hayPendientes !== habiaPendientes) return false;
    }

    // Atributos
    if (jugador.atributos !== anterior.atributos || jugador.atributosTemporales !== anterior.atributosTemporales) {
      const datos = resumenAtributos(jugador);
      for (const clave of ATRIBUTOS.orden) {
        const celda = this.refs.atributos?.querySelector(`[data-atributo="${clave}"]`);
        if (!celda) continue;
        fijarTexto(celda.querySelector('.attr__value'), String(datos[clave].total));
        fijarTexto(celda.querySelector('.attr__mod'), formatearMod(datos[clave].mod));
      }
    }

    return true;
  }

  /** @protected */
  alDestruir() {
    this._barraXP = null;
  }
}

export default CharacterPanel;
