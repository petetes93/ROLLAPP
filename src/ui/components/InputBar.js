/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ui/components/InputBar.js
 * ---------------------------------------------------------------------------
 * Caja de acción: por donde el jugador dice lo que hace.
 *
 * Es el compromiso central del proyecto: el popup ofrece atajos, pero AQUÍ se
 * puede escribir cualquier cosa. Nunca se deshabilita la escritura libre por el
 * hecho de que haya opciones sugeridas.
 *
 * Comportamiento:
 *   · Enter envía, Mayús+Enter salta de línea.
 *   · La caja crece con el texto hasta seis líneas, luego desplaza.
 *   · Ctrl+↑ / Ctrl+↓ recorren el historial de acciones, como una terminal.
 *   · Se bloquea mientras se resuelve el turno, y recupera el foco al terminar.
 *   · Contador de caracteres discreto al acercarse al límite.
 *
 * No resuelve la acción: la entrega a UIManager, que la publica en el bus.
 *
 * Dependencias: Component, DOM, config, utils.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Component } from '../Component.js';
import { qs, texto as fijarTexto, clase, enfocar, visible } from '../DOM.js';
import { SELECTORES, TECLAS, TEXTOS, COMPORTAMIENTO, HISTORIAL_ENTRADA_MAX } from '../../config/ui.config.js';
import { LIMITES } from '../../config/app.config.js';
import { h } from '../DOM.js';

export class InputBar extends Component {
  static nombre = 'inputbar';
  static rama = 'ui.entradaBloqueada';

  constructor(contexto, opciones) {
    super(contexto, opciones);

    /** @type {HTMLTextAreaElement|null} @private */
    this._campo = null;
    /** @type {HTMLButtonElement|null} @private */
    this._boton = null;
    /** @type {HTMLElement|null} @private */
    this._contador = null;

    /**
     * Historial local de acciones enviadas, del más reciente al más antiguo.
     * @type {string[]}
     * @private
     */
    this._historial = [];

    /** Posición en el historial. -1 = escribiendo algo nuevo. @private */
    this._posicion = -1;

    /** Borrador guardado al empezar a navegar el historial. @private */
    this._borrador = '';
  }

  /**
   * El componente no construye su árbol: index.html ya trae el textarea y el
   * botón. Los adopta y les da comportamiento.
   * @returns {null}
   * @protected
   */
  render() {
    return null;
  }

  /** @protected */
  alMontar() {
    this._campo = /** @type {HTMLTextAreaElement} */ (qs(SELECTORES.accion.entrada));
    this._boton = /** @type {HTMLButtonElement} */ (qs(SELECTORES.accion.enviar));

    if (!this._campo || !this._boton) {
      this.log.aviso('InputBar: no se encuentran los nodos de la barra de acción');
      return;
    }

    // Contador de caracteres, oculto hasta acercarse al límite.
    this._contador = h('span.actionbar__contador', {
      style: {
        position: 'absolute',
        right: 'var(--sp-2)',
        bottom: '-1.1rem',
        fontSize: 'var(--f-2xs)',
        color: 'var(--c-texto-tenue)',
        pointerEvents: 'none',
      },
      hidden: true,
    });
    this._campo.parentElement?.style.setProperty('position', 'relative');
    this._campo.parentElement?.appendChild(this._contador);

    this._campo.placeholder = TEXTOS.juego.entradaPlaceholder;
    this._campo.maxLength = LIMITES.entradaMax;

    this.on(this._campo, 'keydown', this._alTeclear);
    this.on(this._campo, 'input', this._alEscribir);
    this.on(this._boton, 'click', () => this.enviar());

    // Al elegir una opción del popup, su etiqueta se precarga aquí para que el
    // jugador pueda matizarla antes de enviar, si quiere.
    this.escuchar('ui:choice:preload', ({ texto }) => this.precargar(texto));

    // Devolver el foco cuando termina un turno.
    this.escuchar('turn:end', () => {
      if (COMPORTAMIENTO.refocoTrasTurno) enfocar(this._campo);
    });

    this._ajustarAltura();
  }

  /**
   * Refleja el bloqueo de entrada.
   * @param {boolean} bloqueada
   * @returns {boolean}
   * @protected
   */
  actualizar(bloqueada) {
    if (!this._campo || !this._boton) return true;

    this._campo.disabled = Boolean(bloqueada);
    this._boton.disabled = Boolean(bloqueada);
    clase(this._boton, 'is-loading', Boolean(bloqueada));
    this._campo.placeholder = bloqueada
      ? TEXTOS.juego.pensando
      : TEXTOS.juego.entradaPlaceholder;

    if (!bloqueada && COMPORTAMIENTO.refocoTrasTurno) {
      requestAnimationFrame(() => enfocar(this._campo));
    }

    return true;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     TECLADO
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * @param {KeyboardEvent} e
   * @private
   */
  _alTeclear(e) {
    // Enter envía; Mayús+Enter inserta un salto de línea.
    if (e.code === TECLAS.enviar.code && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      this.enviar();
      return;
    }

    // Historial estilo terminal.
    if (e.ctrlKey && e.code === TECLAS.historialAnterior.code) {
      e.preventDefault();
      this._navegarHistorial(1);
      return;
    }
    if (e.ctrlKey && e.code === TECLAS.historialSiguiente.code) {
      e.preventDefault();
      this._navegarHistorial(-1);
      return;
    }

    // Escape con la caja llena la vacía; con la caja vacía, deja que UIManager
    // cierre la capa que corresponda.
    if (e.code === TECLAS.cerrar.code && this._campo.value) {
      e.preventDefault();
      e.stopPropagation();
      this.limpiar();
    }
  }

  /** @private */
  _alEscribir() {
    this._posicion = -1;
    this._ajustarAltura();
    this._actualizarContador();
  }

  /**
   * Ajusta la altura del textarea al contenido, hasta el máximo configurado.
   * @private
   */
  _ajustarAltura() {
    if (!this._campo) return;
    this._campo.style.height = 'auto';
    const maximo = COMPORTAMIENTO.entradaFilasMax * 24 + 20;
    this._campo.style.height = `${Math.min(this._campo.scrollHeight, maximo)}px`;
  }

  /**
   * Muestra el contador solo cuando el límite empieza a estar cerca.
   * @private
   */
  _actualizarContador() {
    if (!this._contador || !this._campo) return;
    const restantes = LIMITES.entradaMax - this._campo.value.length;
    const cerca = restantes <= 80;
    visible(this._contador, cerca);
    if (cerca) {
      fijarTexto(this._contador, `${restantes}`);
      this._contador.style.color = restantes <= 20 ? 'var(--c-peligro)' : 'var(--c-texto-tenue)';
    }
  }

  /**
   * @param {number} direccion +1 hacia atrás, -1 hacia delante.
   * @private
   */
  _navegarHistorial(direccion) {
    if (!this._historial.length) return;

    // Al entrar en el historial se guarda lo que se estaba escribiendo.
    if (this._posicion === -1 && direccion > 0) this._borrador = this._campo.value;

    const nueva = this._posicion + direccion;

    if (nueva < 0) {
      this._posicion = -1;
      this._campo.value = this._borrador;
    } else if (nueva < this._historial.length) {
      this._posicion = nueva;
      this._campo.value = this._historial[nueva];
    } else {
      return;
    }

    this._ajustarAltura();
    // El cursor al final, que es donde se espera al recuperar un comando.
    requestAnimationFrame(() => {
      const fin = this._campo.value.length;
      this._campo.setSelectionRange(fin, fin);
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     ENVÍO
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Envía el contenido de la caja.
   * @param {Object} [meta] Metadatos adicionales (origen, intención).
   */
  enviar(meta = {}) {
    if (!this._campo || this._campo.disabled) return;

    const texto = this._campo.value.trim();
    if (texto.length < LIMITES.entradaMin) {
      this.ui?.avisar(TEXTOS.juego.entradaVacia, { tipo: 'aviso' });
      enfocar(this._campo);
      return;
    }

    this._recordar(texto);
    if (COMPORTAMIENTO.limpiarAlEnviar) this.limpiar();

    this.ui?.enviarAccion(texto, { origen: 'texto', ...meta });
  }

  /**
   * Precarga texto en la caja sin enviarlo, dejando el cursor al final.
   * @param {string} texto
   */
  precargar(texto) {
    if (!this._campo) return;
    this._campo.value = texto;
    this._ajustarAltura();
    this._actualizarContador();
    enfocar(this._campo);
    const fin = texto.length;
    this._campo.setSelectionRange(fin, fin);
  }

  /** Vacía la caja. */
  limpiar() {
    if (!this._campo) return;
    this._campo.value = '';
    this._posicion = -1;
    this._borrador = '';
    this._ajustarAltura();
    this._actualizarContador();
  }

  /**
   * Añade una acción al historial local, evitando repetir la última.
   * @param {string} texto
   * @private
   */
  _recordar(texto) {
    if (this._historial[0] === texto) return;
    this._historial.unshift(texto);
    if (this._historial.length > HISTORIAL_ENTRADA_MAX) this._historial.pop();
    this._posicion = -1;
  }

  /** @protected */
  alDestruir() {
    this._contador?.remove();
    this._contador = null;
    this._historial = [];
  }
}

export default InputBar;
