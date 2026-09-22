/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ui/components/StatBar.js
 * ---------------------------------------------------------------------------
 * Barra de recurso: vida, maná, experiencia, fatiga, hambre, sed, moral, carga.
 *
 * Dos detalles que la hacen algo más que un rectángulo de color:
 *
 *   · Estela. Al recibir daño, una banda clara se queda atrás y alcanza a la
 *     barra medio segundo después. El jugador VE cuánto ha perdido, no solo
 *     dónde ha quedado. Es puro CSS: dos capas y una transición retardada.
 *
 *   · Alarma automática. Por debajo de los umbrales configurados, la barra
 *     cambia de color y late. El componente no decide los umbrales: los lee de
 *     balance.config.js a través de utils/math.
 *
 * No es un Component con estado propio: es un objeto ligero que se crea, se
 * inserta y se actualiza. Un panel puede tener ocho sin coste apreciable.
 *
 * Dependencias: DOM, utils/math, utils/format, config/ui.config.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { h, icono, texto as fijarTexto, atributo, clase } from '../DOM.js';
import { porcentaje, nivelAlarma } from '../../utils/math.js';
import { razon } from '../../utils/format.js';

/**
 * @typedef {Object} ConfigBarra
 * @property {string} clave Sufijo de clase y de variable: 'vida', 'mana'…
 * @property {string} etiqueta Texto visible.
 * @property {string} [icono] Clave de ICONOS.
 * @property {number} actual
 * @property {number} max
 * @property {boolean} [mostrarValor=true] Muestra '34/50'.
 * @property {string} [formato] 'razon' | 'porcentaje' | 'ninguno'
 * @property {boolean} [delgada=false]
 * @property {number} [umbralAlerta]
 * @property {number} [umbralCritico]
 * @property {boolean} [alarma=true] Aplica colores de alerta y crítico.
 */

export class StatBar {
  /**
   * @param {ConfigBarra} config
   */
  constructor(config) {
    this.config = { mostrarValor: true, formato: 'razon', alarma: true, ...config };

    /** @type {HTMLElement|null} */
    this.el = null;
    /** @type {HTMLElement|null} @private */
    this._relleno = null;
    /** @type {HTMLElement|null} @private */
    this._estela = null;
    /** @type {HTMLElement|null} @private */
    this._valor = null;

    /** Último porcentaje pintado. @private */
    this._pct = -1;
  }

  /**
   * Construye el nodo de la barra.
   * @returns {HTMLElement}
   */
  render() {
    const c = this.config;
    const pct = porcentaje(c.actual, c.max);

    this._relleno = h('div.statbar__fill', { style: { width: `${pct}%` } });
    this._estela = h('div.statbar__ghost', { style: { width: `${pct}%` } });
    this._valor = h('span.statbar__value', { text: this._formatear(c.actual, c.max) });

    this.el = h('div', {
      class: ['statbar', `statbar--${c.clave}`, c.delgada ? 'statbar--slim' : ''].filter(Boolean),
      dataset: { level: this._nivel(pct) },
      attrs: {
        role: 'progressbar',
        'aria-valuenow': String(Math.round(c.actual)),
        'aria-valuemin': '0',
        'aria-valuemax': String(Math.round(c.max)),
        'aria-label': c.etiqueta,
      },
    },
      h('div.statbar__head', {},
        h('span.statbar__label', {},
          c.icono ? icono(c.icono, { class: 'icon--sm' }) : null,
          h('span', { text: c.etiqueta }),
        ),
        c.mostrarValor ? this._valor : null,
      ),
      h('div.statbar__track', {}, this._estela, this._relleno),
    );

    this._pct = pct;
    return this.el;
  }

  /**
   * Actualiza los valores sin reconstruir el nodo.
   *
   * @param {number} actual
   * @param {number} [max] Si se omite, conserva el máximo anterior.
   */
  actualizar(actual, max) {
    const c = this.config;
    c.actual = actual;
    if (max !== undefined) c.max = max;

    const pct = porcentaje(c.actual, c.max);
    if (pct === this._pct && this._valor?.textContent === this._formatear(c.actual, c.max)) return;

    const subiendo = pct > this._pct;

    if (this._relleno) this._relleno.style.width = `${pct}%`;

    // La estela solo se retrasa al perder. Al ganar, ambas capas avanzan juntas
    // para que no se vea una banda blanca por delante de la barra.
    if (this._estela) {
      if (subiendo) this._estela.style.width = `${pct}%`;
      else requestAnimationFrame(() => { if (this._estela) this._estela.style.width = `${pct}%`; });
    }

    if (this._valor) fijarTexto(this._valor, this._formatear(c.actual, c.max));

    atributo(this.el, 'data-level', this._nivel(pct));
    atributo(this.el, 'aria-valuenow', String(Math.round(c.actual)));
    atributo(this.el, 'aria-valuemax', String(Math.round(c.max)));

    this._pct = pct;
  }

  /**
   * Destello de ganancia, para la barra de experiencia.
   * La clase se retira sola al terminar la animación.
   */
  destellar() {
    const pista = this.el?.querySelector('.statbar__track');
    if (!pista) return;
    clase(pista, 'is-gaining', true);
    setTimeout(() => clase(pista, 'is-gaining', false), 800);
  }

  /**
   * @param {number} actual
   * @param {number} max
   * @returns {string}
   * @private
   */
  _formatear(actual, max) {
    switch (this.config.formato) {
      case 'porcentaje': return `${Math.round(porcentaje(actual, max))} %`;
      case 'ninguno': return '';
      default: return razon(actual, max);
    }
  }

  /**
   * @param {number} pct
   * @returns {string}
   * @private
   */
  _nivel(pct) {
    if (!this.config.alarma) return 'normal';
    return nivelAlarma(
      pct, 100,
      (this.config.umbralAlerta ?? 0.5) * 100,
      (this.config.umbralCritico ?? 0.25) * 100,
    );
  }
}

/**
 * Atajo funcional para crear y renderizar una barra de una sola vez.
 * @param {ConfigBarra} config
 * @returns {{nodo: HTMLElement, barra: StatBar}}
 */
export function crearBarra(config) {
  const barra = new StatBar(config);
  return { nodo: barra.render(), barra };
}

export default StatBar;
