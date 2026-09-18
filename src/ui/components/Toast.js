/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · ui/components/Toast.js
 * ---------------------------------------------------------------------------
 * Avisos flotantes efímeros.
 *
 * Se usan para lo que el jugador debe saber pero no debe interrumpirle: botín
 * obtenido, subida de nivel, misión completada, hambre apremiante, un error del
 * director del que el motor ya se ha recuperado.
 *
 * Decisiones de comportamiento:
 *   · Cola con tope. Al superar el máximo se retira el más antiguo, no se
 *     rechaza el nuevo: la información reciente vale más.
 *   · Antirrepetición. Un mismo mensaje repetido en menos de un segundo se
 *     agrupa con un contador, en vez de apilar cinco copias.
 *   · El temporizador se pausa al pasar el ratón por encima.
 *
 * Dependencias: Component, DOM, config, utils/id.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Component } from '../Component.js';
import { h, icono, texto as fijarTexto, clase } from '../DOM.js';
import { TIEMPOS, LIMITES } from '../../config/app.config.js';
import { ICONOS } from '../../config/ui.config.js';
import { id } from '../../utils/id.js';

/** Icono por defecto de cada tipo de aviso. */
const ICONO_TIPO = Object.freeze({
  info: ICONOS.pergamino,
  exito: ICONOS.escudo,
  aviso: ICONOS.ojo,
  peligro: ICONOS.espada,
  loot: ICONOS.bolsa,
});

export class GestorToast extends Component {
  static nombre = 'toasts';
  static rama = '';

  constructor(contexto, opciones) {
    super(contexto, opciones);

    /**
     * Avisos vivos.
     * @type {Map<string, {nodo: HTMLElement, temporizador: number, mensaje: string, veces: number, momento: number}>}
     * @private
     */
    this._vivos = new Map();
  }

  /**
   * @returns {HTMLElement}
   * @protected
   */
  render() {
    return h('div.toasts', { ref: this.ref('lista') });
  }

  /**
   * @protected
   */
  alMontar() {
    // El contenedor de capa ignora los eventos; la lista sí debe recibirlos
    // para poder cerrar un aviso con un clic.
    if (this.refs.lista) this.refs.lista.style.pointerEvents = 'auto';

    // Los errores graves del motor se anuncian solos. El Logger no conoce la
    // interfaz: se limita a emitir, y aquí se decide qué merece un aviso.
    this.escuchar('app:error:visible', ({ mensaje }) => {
      this.mostrar(mensaje, { tipo: 'peligro' });
    });
  }

  /**
   * Muestra un aviso.
   *
   * @param {string} mensaje
   * @param {Object} [opciones]
   * @param {'info'|'exito'|'aviso'|'peligro'|'loot'} [opciones.tipo='info']
   * @param {number} [opciones.duracion]
   * @param {string} [opciones.icono] Clave de ICONOS.
   * @param {boolean} [opciones.persistente=false] No se cierra solo.
   * @returns {string} Identificador del aviso.
   */
  mostrar(mensaje, opciones = {}) {
    const tipo = opciones.tipo ?? 'info';
    const texto = String(mensaje ?? '').trim();
    if (!texto || !this.refs.lista) return '';

    // — Agrupación de repetidos —
    const ahora = Date.now();
    for (const [clave, vivo] of this._vivos) {
      if (vivo.mensaje === texto && ahora - vivo.momento < 1000) {
        vivo.veces++;
        vivo.momento = ahora;
        const contador = vivo.nodo.querySelector('.toast__veces');
        if (contador) fijarTexto(contador, `×${vivo.veces}`);
        else vivo.nodo.appendChild(h('span.toast__veces', { text: `×${vivo.veces}` }));
        this._reprogramar(clave, opciones.duracion);
        return clave;
      }
    }

    // — Tope de la cola —
    if (this._vivos.size >= LIMITES.toastsMax) {
      const masAntiguo = this._vivos.keys().next().value;
      this._retirar(masAntiguo);
    }

    const clave = id('toast');
    const nodo = h('div', {
      class: `toast toast--${tipo}`,
      dataset: { toast: clave },
      attrs: { role: tipo === 'peligro' ? 'alert' : 'status' },
      onClick: () => this._retirar(clave),
    },
      icono(opciones.icono ?? ICONO_TIPO[tipo] ?? ICONOS.pergamino, { class: 'toast__icon icon--sm' }),
      h('span.toast__texto', { text: texto }),
    );

    // Pausa al pasar el ratón: leer un aviso no debería ser una carrera.
    nodo.addEventListener('mouseenter', () => this._pausar(clave));
    nodo.addEventListener('mouseleave', () => this._reprogramar(clave, opciones.duracion));

    this.refs.lista.appendChild(nodo);

    const duracion = opciones.persistente
      ? 0
      : (opciones.duracion ?? (tipo === 'peligro' || tipo === 'loot' ? TIEMPOS.toastLargo : TIEMPOS.toast));

    const temporizador = duracion > 0 ? setTimeout(() => this._retirar(clave), duracion) : 0;

    this._vivos.set(clave, { nodo, temporizador, mensaje: texto, veces: 1, momento: ahora });
    return clave;
  }

  /**
   * Cierra un aviso concreto.
   * @param {string} clave
   */
  cerrar(clave) {
    this._retirar(clave);
  }

  /** Cierra todos los avisos. */
  cerrarTodos() {
    for (const clave of [...this._vivos.keys()]) this._retirar(clave);
  }

  /**
   * @param {string} clave
   * @private
   */
  _retirar(clave) {
    const vivo = this._vivos.get(clave);
    if (!vivo) return;

    if (vivo.temporizador) clearTimeout(vivo.temporizador);
    this._vivos.delete(clave);

    clase(vivo.nodo, 'is-leaving', true);
    // Se espera a que termine la animación de salida antes de retirar el nodo.
    setTimeout(() => vivo.nodo.remove(), 200);
  }

  /**
   * @param {string} clave
   * @private
   */
  _pausar(clave) {
    const vivo = this._vivos.get(clave);
    if (vivo?.temporizador) {
      clearTimeout(vivo.temporizador);
      vivo.temporizador = 0;
    }
  }

  /**
   * @param {string} clave
   * @param {number} [duracion]
   * @private
   */
  _reprogramar(clave, duracion) {
    const vivo = this._vivos.get(clave);
    if (!vivo) return;
    if (vivo.temporizador) clearTimeout(vivo.temporizador);
    const ms = duracion ?? TIEMPOS.toast;
    vivo.temporizador = setTimeout(() => this._retirar(clave), ms);
  }

  /** @protected */
  alDestruir() {
    for (const vivo of this._vivos.values()) {
      if (vivo.temporizador) clearTimeout(vivo.temporizador);
    }
    this._vivos.clear();
  }
}

export default GestorToast;
