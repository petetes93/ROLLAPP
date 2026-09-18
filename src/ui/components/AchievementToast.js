/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · ui/components/AchievementToast.js
 * ---------------------------------------------------------------------------
 * Aviso de hazaña conseguida.
 *
 * Separado del gestor de toasts corriente por una razón: una hazaña merece más
 * peso visual que «has recogido una poción», y encolarla con los avisos
 * ordinarios la enterraría.
 *
 * Tres decisiones:
 *
 *   · SE ENCOLAN, NO SE APILAN. Si tres hazañas caen a la vez —pasa al subir de
 *     nivel—, se muestran una tras otra. Tres carteles simultáneos no se leen.
 *
 *   · NO INTERRUMPEN. Aparecen en una esquina y se van solas. Un modal que
 *     detiene la partida para felicitarte es una interrupción, no una
 *     recompensa.
 *
 *   · EL TEXTO ES LO IMPORTANTE. Las hazañas de ARCANUM llevan una frase que
 *     comenta tu partida; esa frase es el premio, no el icono.
 *
 * Dependencias: Component, DOM, achievements.data.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Component } from '../Component.js';
import { h, icono, clase } from '../DOM.js';
import { obtenerHazana } from '../../data/achievements.data.js';

/** Tiempo en pantalla de cada aviso, en milisegundos. */
const DURACION = 5200;

/** Pausa entre avisos consecutivos. */
const PAUSA = 400;

export class AchievementToast extends Component {
  static nombre = 'hazana-toast';
  static rama = '';

  constructor(contexto, opciones) {
    super(contexto, opciones);

    /** Cola de hazañas pendientes de mostrar. @private */
    this._cola = [];

    /** true mientras hay una en pantalla. @private */
    this._mostrando = false;

    /** Nodo del aviso actual. @private */
    this._actual = null;
  }

  /** @returns {HTMLElement} @protected */
  render() {
    return h('div.hazana-host', {
      ref: this.ref('raiz'),
      style: {
        position: 'fixed',
        top: 'var(--sp-4)',
        right: 'var(--sp-4)',
        zIndex: 'var(--z-toast)',
        pointerEvents: 'none',
        display: 'grid',
        gap: 'var(--sp-2)',
        maxWidth: 'min(22rem, calc(100vw - var(--sp-8)))',
      },
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CICLO DE VIDA
     ═══════════════════════════════════════════════════════════════════════ */

  /** @protected */
  alMontar() {
    this.escuchar('achievement:unlocked', ({ refId }) => this.encolar(refId));

    // Los hitos narrativos usan el mismo canal visual: son de la misma familia.
    this.escuchar('milestone:reached', (datos) => this.encolarHito(datos));
  }

  /* ═══════════════════════════════════════════════════════════════════════
     COLA
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Encola una hazaña.
   * @param {string} refId
   */
  encolar(refId) {
    const hazana = obtenerHazana(refId);
    if (!hazana) return;

    this._cola.push({
      clase: 'hazana',
      titulo: hazana.nombre,
      texto: hazana.texto ?? hazana.descripcion,
      icono: hazana.icono ?? 'xp',
      oculta: hazana.oculta,
    });

    this._siguiente();
  }

  /**
   * Encola un hito narrativo.
   * @param {Object} datos
   */
  encolarHito(datos) {
    if (!datos?.titulo) return;

    this._cola.push({
      clase: 'hito',
      titulo: datos.titulo,
      texto: datos.texto ?? null,
      icono: datos.icono ?? 'mision',
      oculta: false,
    });

    this._siguiente();
  }

  /**
   * Muestra el siguiente de la cola, si no hay ninguno en pantalla.
   * @private
   */
  _siguiente() {
    if (this._mostrando) return;

    const entrada = this._cola.shift();
    if (!entrada) return;

    this._mostrando = true;
    this._mostrar(entrada);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PRESENTACIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Dibuja un aviso y programa su retirada.
   * @param {Object} entrada
   * @private
   */
  _mostrar(entrada) {
    const esHazana = entrada.clase === 'hazana';

    const nodo = h('div', {
      style: {
        pointerEvents: 'auto',
        padding: 'var(--sp-3)',
        background: 'var(--c-superficie-3)',
        border: `var(--bw-hair) solid ${esHazana ? 'var(--c-acento)' : 'var(--c-info)'}`,
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--sombra-alta)',
        // Entra desde la derecha; la clase la aplica la hoja de animaciones.
        opacity: '0',
        transform: 'translateX(1.5rem)',
        transition: 'opacity var(--t-lento) var(--e-out), transform var(--t-lento) var(--e-out)',
      },
      onClick: () => this._retirar(nodo),
    },
      // ─── Etiqueta ─────────────────────────────────────────────────────
      h('div.row', { style: { gap: 'var(--sp-2)', alignItems: 'center' } },
        icono(entrada.icono, {
          class: 'icon--lg',
          style: { color: esHazana ? 'var(--c-acento)' : 'var(--c-info)', flexShrink: 0 },
        }),

        h('div', { style: { minWidth: 0 } },
          h('div.eyebrow', {
            style: { color: esHazana ? 'var(--c-acento)' : 'var(--c-info)' },
            text: esHazana
              ? (entrada.oculta ? 'Hazaña oculta' : 'Hazaña')
              : 'Hito',
          }),

          h('div', {
            style: {
              fontFamily: 'var(--f-display)',
              fontSize: 'var(--f-md)',
              color: 'var(--c-texto-titulo)',
              lineHeight: '1.2',
            },
            text: entrada.titulo,
          }),
        ),
      ),

      // ─── El texto: es el verdadero premio ─────────────────────────────
      entrada.texto
        ? h('p', {
            style: {
              fontSize: 'var(--f-xs)',
              color: 'var(--c-texto-narrativa)',
              fontStyle: 'italic',
              marginTop: 'var(--sp-2)',
              lineHeight: '1.45',
            },
            text: entrada.texto,
          })
        : null,
    );

    this.refs.raiz?.appendChild(nodo);
    this._actual = nodo;

    // Un fotograma después, para que la transición se aplique.
    requestAnimationFrame(() => {
      nodo.style.opacity = '1';
      nodo.style.transform = 'translateX(0)';
    });

    this.espera(() => this._retirar(nodo), DURACION);
  }

  /**
   * Retira un aviso con su animación de salida.
   * @param {HTMLElement} nodo
   * @private
   */
  _retirar(nodo) {
    if (!nodo?.parentNode) return;

    nodo.style.opacity = '0';
    nodo.style.transform = 'translateX(1.5rem)';

    this.espera(() => {
      nodo.remove();

      if (this._actual === nodo) {
        this._actual = null;
        this._mostrando = false;

        // Pausa antes del siguiente: encadenar sin respiro se lee peor.
        this.espera(() => this._siguiente(), PAUSA);
      }
    }, 350);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONTROL
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Vacía la cola y retira lo que haya en pantalla.
   *
   * Se llama al cargar una partida: los avisos de la anterior no tienen por qué
   * arrastrarse.
   */
  limpiar() {
    this._cola = [];

    if (this._actual) {
      this._actual.remove();
      this._actual = null;
    }

    this._mostrando = false;
  }

  /** @returns {number} Hazañas pendientes de mostrar. */
  get pendientes() {
    return this._cola.length;
  }

  /** @protected */
  alDestruir() {
    this.limpiar();
  }
}

export default AchievementToast;
