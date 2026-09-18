/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · ui/components/NarrativeLog.js
 * ---------------------------------------------------------------------------
 * Bitácora narrativa: el panel central, donde ocurre el juego.
 *
 * Es el componente más delicado de la interfaz, por tres razones:
 *
 *   1. AÑADE, no reconstruye. Cien turnos de historia no se vuelven a pintar
 *      cada vez que llega uno nuevo. El componente compara con lo ya montado y
 *      añade únicamente lo que falta.
 *   2. Poda el DOM. Al superar el tope configurado, retira las entradas más
 *      antiguas del DOM (siguen en el estado). Sin esto, una partida larga
 *      arrastra miles de nodos.
 *   3. Respeta la lectura. Si el jugador ha subido a releer algo, el contenido
 *      nuevo NO le arrastra al fondo; aparece un aviso discreto en su lugar.
 *
 * Voces soportadas: director, jugador, PNJ, sistema, tirada y combate. Cada una
 * con su tratamiento tipográfico, definido en components.css.
 *
 * Dependencias: Component, DOM, TypeWriter, config, utils.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Component } from '../Component.js';
import { h, icono, alFondo, irAlFondo, vaciar, clase, qs } from '../DOM.js';
import { TypeWriter } from './TypeWriter.js';
import { VOCES, VOCES_ANIMADAS, COMPORTAMIENTO, TEXTOS, SELECTORES } from '../../config/ui.config.js';
import { LIMITES } from '../../config/app.config.js';
import { parrafos } from '../../utils/text.js';
import { tirada as formatearTirada, claseTirada } from '../../utils/format.js';

export class NarrativeLog extends Component {
  static nombre = 'narrativa';
  static rama = 'narrative.entradas';

  constructor(contexto, opciones) {
    super(contexto, opciones);

    /**
     * Identificadores ya presentes en el DOM, en orden.
     * @type {string[]}
     * @private
     */
    this._pintadas = [];

    /** @type {TypeWriter|null} @private */
    this._maquina = null;

    /** Nodo de aviso "hay contenido nuevo". @type {HTMLElement|null} @private */
    this._avisoNuevo = null;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     RENDER
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * @param {Array} entradas
   * @returns {Node}
   * @protected
   */
  render(entradas = []) {
    this._pintadas = [];

    if (!entradas.length) {
      return h('div.stack', {},
        h('p.block__empty', { text: TEXTOS.vacios.narrativa }),
      );
    }

    const fragmento = document.createDocumentFragment();
    for (const entrada of entradas.slice(-LIMITES.narrativaMax)) {
      fragmento.appendChild(this._crearEntrada(entrada, false));
      this._pintadas.push(entrada.id);
    }
    return fragmento;
  }

  /**
   * Añade solo lo nuevo, en vez de rehacer la bitácora.
   *
   * @param {Array} entradas
   * @param {Array} anteriores
   * @returns {boolean} true: la actualización queda gestionada aquí.
   * @protected
   */
  actualizar(entradas = [], anteriores = []) {
    if (!this.el) return true;

    // Si la lista se ha vaciado o encogido, es una partida nueva: render completo.
    if (entradas.length < anteriores.length || !entradas.length) return false;

    const seguirAlFondo = alFondo(this.el, COMPORTAMIENTO.autoScrollMargen);
    const yaPintadas = new Set(this._pintadas);
    const nuevas = entradas.filter((e) => !yaPintadas.has(e.id));

    if (!nuevas.length) return true;

    // Si el contenedor mostraba el estado vacío, se limpia antes de añadir.
    if (!this._pintadas.length) vaciar(this.el);

    for (const entrada of nuevas) {
      const animar = COMPORTAMIENTO.mostrarTiradas !== false
        && this.leer('settings.maquinaEscribir')
        && VOCES_ANIMADAS.includes(entrada.voz);

      const nodo = this._crearEntrada(entrada, animar);
      this.el.appendChild(nodo);
      this._pintadas.push(entrada.id);
    }

    this._podar();

    if (seguirAlFondo && COMPORTAMIENTO.autoScroll) {
      this._ocultarAvisoNuevo();
      requestAnimationFrame(() => irAlFondo(this.el));
    } else {
      this._mostrarAvisoNuevo();
    }

    return true;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     CONSTRUCCIÓN DE ENTRADAS
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Crea el nodo de una entrada según su voz.
   *
   * @param {Object} entrada
   * @param {boolean} animar
   * @returns {HTMLElement}
   * @private
   */
  _crearEntrada(entrada, animar) {
    switch (entrada.voz) {
      case VOCES.TIRADA: return this._entradaTirada(entrada);
      case VOCES.SISTEMA: return this._entradaSimple(entrada, VOCES.SISTEMA);
      case VOCES.COMBATE: return this._entradaSimple(entrada, VOCES.COMBATE);
      case VOCES.JUGADOR: return this._entradaJugador(entrada);
      case VOCES.NPC: return this._entradaNPC(entrada, animar);
      default: return this._entradaDirector(entrada, animar);
    }
  }

  /**
   * Narración del director. Es la única que lleva capitular.
   * @private
   */
  _entradaDirector(entrada, animar) {
    const cuerpo = h('div.entry__body');

    const nodo = h('article.entry', {
      dataset: {
        voice: VOCES.DM,
        sceneOpen: entrada.meta?.escenaAbierta ? 'true' : 'false',
        id: entrada.id,
      },
    }, cuerpo);

    if (animar) {
      this._maquina?.detener();
      this._maquina = new TypeWriter({
        velocidad: this.leer('settings.velocidadTexto', 14),
        alAvanzar: () => {
          // Mantener el fondo a la vista mientras se escribe, si procede.
          if (COMPORTAMIENTO.autoScroll && alFondo(this.el, 200)) irAlFondo(this.el, false);
        },
        alTerminar: () => this.emitir('ui:narrative:typed', { id: entrada.id }),
      });
      this._maquina.escribir(cuerpo, entrada.texto);

      // Un clic o una tecla completan el texto de inmediato.
      const saltar = () => this._maquina?.saltar();
      nodo.addEventListener('click', saltar, { once: true });
      this.alLimpiar(() => nodo.removeEventListener('click', saltar));
    } else {
      for (const p of parrafos(entrada.texto)) cuerpo.appendChild(h('p', { text: p }));
    }

    return nodo;
  }

  /**
   * Diálogo de un PNJ, con el nombre del hablante encima.
   * @private
   */
  _entradaNPC(entrada, animar) {
    const cuerpo = h('div.entry__body');
    const nodo = h('article.entry', { dataset: { voice: VOCES.NPC, id: entrada.id } },
      entrada.meta?.hablante
        ? h('span.entry__speaker', { text: entrada.meta.hablante })
        : null,
      cuerpo,
    );

    if (animar) {
      this._maquina?.detener();
      this._maquina = new TypeWriter({ velocidad: this.leer('settings.velocidadTexto', 14) });
      this._maquina.escribir(cuerpo, entrada.texto);
    } else {
      for (const p of parrafos(entrada.texto)) cuerpo.appendChild(h('p', { text: p }));
    }

    return nodo;
  }

  /**
   * Acción escrita por el jugador. Aparece siempre completa y de inmediato.
   * @private
   */
  _entradaJugador(entrada) {
    return h('article.entry', { dataset: { voice: VOCES.JUGADOR, id: entrada.id } },
      h('div.entry__body', {}, h('p', { text: entrada.texto })),
    );
  }

  /**
   * Aviso del sistema o línea de combate: centrada y sin capitular.
   * @private
   */
  _entradaSimple(entrada, voz) {
    return h('article.entry', { dataset: { voice: voz, id: entrada.id } },
      h('div.entry__body', {}, h('p', { text: entrada.texto })),
    );
  }

  /**
   * Resultado de una tirada, como ficha compacta con su desglose accesible
   * en el tooltip.
   * @private
   */
  _entradaTirada(entrada) {
    const t = entrada.meta?.tirada;

    const ficha = t
      ? h('span.roll', {
          dataset: { result: claseTirada(t) },
          attrs: {
            'data-tooltip': t.desglose?.length
              ? t.desglose.map((m) => `${m.fuente}: ${m.valor > 0 ? '+' : ''}${m.valor}`).join(' · ')
              : 'Sin modificadores',
          },
        },
          icono('dado', { class: 'icon--sm' }),
          h('span', { text: formatearTirada(t) }),
        )
      : h('span', { text: entrada.texto });

    return h('article.entry', { dataset: { voice: VOCES.TIRADA, id: entrada.id } },
      h('div.entry__body', {}, ficha),
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
     CORTE DE ESCENA
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Inserta un separador de escena.
   * @param {string} [titulo]
   */
  cortarEscena(titulo = '') {
    if (!this.el) return;
    this.el.appendChild(
      h('div.scene-break', {}, titulo ? h('span', { text: titulo }) : null),
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
     PODA Y DESPLAZAMIENTO
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Retira del DOM las entradas más antiguas cuando se supera el tope.
   * Siguen en el estado: solo desaparecen de la vista.
   * @private
   */
  _podar() {
    const exceso = this._pintadas.length - LIMITES.narrativaMax;
    if (exceso <= 0) return;

    const aRetirar = exceso + LIMITES.narrativaPoda;
    for (let i = 0; i < aRetirar && this.el.firstChild; i++) {
      this.el.removeChild(this.el.firstChild);
    }
    this._pintadas.splice(0, aRetirar);
    this.log.debug(`bitácora podada: ${aRetirar} entradas retiradas del DOM`);
  }

  /**
   * Muestra un aviso discreto cuando llega contenido nuevo mientras el jugador
   * está leyendo más arriba.
   * @private
   */
  _mostrarAvisoNuevo() {
    if (this._avisoNuevo) return;
    const panel = qs(SELECTORES.paneles.central);
    if (!panel) return;

    this._avisoNuevo = h('button.btn.btn--sm.narrative__nuevo', {
      type: 'button',
      text: '↓ Hay novedades',
      style: {
        position: 'absolute',
        left: '50%',
        bottom: 'var(--sp-4)',
        transform: 'translateX(-50%)',
        zIndex: 5,
      },
      onClick: () => {
        irAlFondo(this.el);
        this._ocultarAvisoNuevo();
      },
    });

    panel.appendChild(this._avisoNuevo);
  }

  /** @private */
  _ocultarAvisoNuevo() {
    this._avisoNuevo?.remove();
    this._avisoNuevo = null;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     CICLO DE VIDA
     ───────────────────────────────────────────────────────────────────────── */

  /** @protected */
  alMontar() {
    // Al desplazarse hasta el fondo, el aviso de novedades sobra.
    this.on(this.el, 'scroll', () => {
      if (alFondo(this.el, COMPORTAMIENTO.autoScrollMargen)) this._ocultarAvisoNuevo();
    }, { passive: true });

    // Espacio o Enter completan el texto en curso sin tocar la caja de acción.
    this.escuchar('ui:narrative:skip', () => this._maquina?.saltar());

    requestAnimationFrame(() => irAlFondo(this.el, false));
  }

  /** @protected */
  alDestruir() {
    this._maquina?.detener();
    this._maquina = null;
    this._ocultarAvisoNuevo();
    this._pintadas = [];
  }
}

export default NarrativeLog;
