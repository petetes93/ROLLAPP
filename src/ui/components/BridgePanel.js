/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · ui/components/BridgePanel.js
 * ---------------------------------------------------------------------------
 * Panel del puente manual.
 *
 * Todo el diseño busca reducir la fricción del ciclo copiar-pegar, que es lo
 * único que el jugador hace aquí y lo hará muchas veces:
 *
 *   · EL PROMPT SE COPIA SOLO al abrirse el panel. Un botón menos.
 *   · LA RESPUESTA SE DETECTA AL PEGAR y se aplica sin confirmar. Otro menos.
 *   · SI FALLA, EL MENSAJE ES CONCRETO. «Error de JSON» no ayuda; «parece que
 *     se cortó al copiar» sí.
 *
 * Sin esos tres detalles, el ciclo son cinco acciones por turno. Con ellos son
 * dos: pegar en el chat externo y traer la respuesta.
 *
 * Dependencias: Component, DOM, ResponseParser.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Component } from '../Component.js';
import { h, icono, clase, enfocar } from '../DOM.js';
import * as Parser from '../../ai/ResponseParser.js';

export class BridgePanel extends Component {
  static nombre = 'puente';
  static rama = '';

  constructor(contexto, opciones) {
    super(contexto, opciones);

    /** Prompt pendiente de copiar. @private */
    this._prompt = '';

    /** true si el panel está abierto. @private */
    this._abierto = false;

    /** Mensaje de error del último intento. @private */
    this._error = null;

    /** true mientras se muestra la confirmación de copia. @private */
    this._copiado = false;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */

  /** @returns {Node} @protected */
  render() {
    if (!this._abierto) return h('div', { style: { display: 'none' } });

    return h('div.modal-backdrop', {
      ref: this.ref('fondo'),
      style: { display: 'grid', placeItems: 'center', padding: 'var(--sp-4)' },
    },
      h('div.modal', {
        style: { maxWidth: '42rem', width: '100%' },
        attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Puente manual' },
      },
        // ─── Cabecera ─────────────────────────────────────────────────────
        h('div.row.row--between', {},
          h('h2.modal__titulo', { text: 'Puente manual' }),
          h('button.btn.btn--ghost.btn--icon', {
            type: 'button',
            attrs: { 'aria-label': 'Cancelar' },
            onClick: () => this._cancelar(),
          }, icono('cerrar')),
        ),

        // ─── Instrucciones ────────────────────────────────────────────────
        h('p.settings__note', {
          text: this._primero
            ? 'Pega esto en el chat que uses. Lleva las instrucciones completas: solo hace falta la primera vez.'
            : 'Pega esto en el mismo chat de antes. Es corto porque ya tiene las instrucciones.',
        }),

        // ─── Prompt ───────────────────────────────────────────────────────
        h('div', { style: { position: 'relative' } },
          h('textarea.input', {
            ref: this.ref('prompt'),
            readOnly: true,
            rows: 8,
            style: {
              width: '100%',
              fontFamily: 'var(--f-mono)',
              fontSize: 'var(--f-2xs)',
              resize: 'vertical',
            },
            value: this._prompt,
            onClick: (e) => e.target.select(),
          }),

          h('span', {
            style: {
              position: 'absolute',
              bottom: 'var(--sp-2)',
              right: 'var(--sp-2)',
              fontSize: 'var(--f-2xs)',
              color: 'var(--c-texto-tenue)',
              background: 'var(--c-superficie-2)',
              padding: '1px 5px',
              borderRadius: 'var(--r-xs)',
            },
            text: `${this._prompt.length} caracteres`,
          }),
        ),

        h('button.btn.btn--sm.btn--block', {
          ref: this.ref('copiar'),
          type: 'button',
          onClick: () => this._copiar(),
        },
          icono(this._copiado ? 'check' : 'pergamino', { class: 'icon--sm' }),
          h('span', { text: this._copiado ? 'Copiado' : 'Copiar de nuevo' }),
        ),

        h('div.filo', { style: { margin: 'var(--sp-3) 0' } }),

        // ─── Respuesta ────────────────────────────────────────────────────
        h('p.settings__note', {
          text: 'Pega aquí la respuesta. Se aplica sola en cuanto sea válida.',
        }),

        h('textarea.input', {
          ref: this.ref('respuesta'),
          rows: 6,
          placeholder: '{"story": "…"}',
          style: {
            width: '100%',
            fontFamily: 'var(--f-mono)',
            fontSize: 'var(--f-2xs)',
            resize: 'vertical',
            borderColor: this._error ? 'var(--c-peligro)' : undefined,
          },
          onPaste: (e) => this._alPegar(e),
          onInput: (e) => this._alEscribir(e),
        }),

        // ─── Error ────────────────────────────────────────────────────────
        this._error
          ? h('p', {
              ref: this.ref('error'),
              style: {
                fontSize: 'var(--f-xs)',
                color: 'var(--c-peligro)',
                padding: 'var(--sp-2)',
                background: 'var(--c-peligro-tenue)',
                borderRadius: 'var(--r-sm)',
              },
              text: this._error,
            })
          : null,

        // ─── Acciones ─────────────────────────────────────────────────────
        h('div.row', { style: { gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' } },
          h('button.btn.btn--primary.btn--sm', {
            type: 'button',
            style: { flex: 1 },
            onClick: () => this._aplicar(),
          }, h('span', { text: 'Aplicar' })),

          h('button.btn.btn--ghost.btn--sm', {
            type: 'button',
            onClick: () => this._cancelar(),
          }, h('span', { text: 'Saltar turno' })),
        ),

        h('p.settings__note', {
          style: { textAlign: 'center', marginTop: 'var(--sp-2)' },
          text: 'Si cancelas, el turno se resuelve con el director interno.',
        }),
      ),
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
     APERTURA Y CIERRE
     ═══════════════════════════════════════════════════════════════════════ */

  /** @protected */
  alMontar() {
    this.escuchar('bridge:open', (datos) => this.abrir(datos));
    this.escuchar('bridge:close', () => this.cerrar());

    // Escape cancela.
    this.on(document, 'keydown', (e) => {
      if (e.key === 'Escape' && this._abierto) {
        e.stopPropagation();
        this._cancelar();
      }
    });
  }

  /**
   * Abre el panel con un prompt.
   *
   * @param {Object} datos
   */
  abrir(datos) {
    this._prompt = datos.prompt ?? '';
    this._primero = Boolean(datos.primero);
    this._abierto = true;
    this._error = null;
    this._copiado = false;

    this.refrescar();

    // El prompt se copia solo: es lo primero que el jugador iba a hacer.
    this.espera(() => {
      this._copiar({ silencioso: true });
      enfocar(this.refs.respuesta);
    }, 60);
  }

  /** Cierra el panel. */
  cerrar() {
    this._abierto = false;
    this._prompt = '';
    this._error = null;
    this.refrescar();
  }

  /* ═══════════════════════════════════════════════════════════════════════
     COPIA
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Copia el prompt al portapapeles.
   *
   * @param {Object} [opciones]
   * @private
   */
  async _copiar(opciones = {}) {
    try {
      await navigator.clipboard.writeText(this._prompt);

      this._copiado = true;
      this.refrescar();

      this.espera(() => { this._copiado = false; this.refrescar(); }, 2000);

      if (!opciones.silencioso) {
        this.ui?.avisar('Copiado al portapapeles', { tipo: 'exito' });
      }

    } catch {
      // El portapapeles puede estar bloqueado: se selecciona el texto para que
      // el jugador copie a mano.
      this.refs.prompt?.select();

      if (!opciones.silencioso) {
        this.ui?.avisar('No se pudo copiar solo. El texto está seleccionado: usa Ctrl+C.', {
          tipo: 'aviso',
        });
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PEGADO
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Intercepta el pegado y aplica si es válido.
   *
   * Aplicar sin confirmar ahorra un clic por turno, y en un ciclo que se repite
   * cien veces por partida eso se nota.
   *
   * @param {ClipboardEvent} e
   * @private
   */
  _alPegar(e) {
    const texto = e.clipboardData?.getData('text');
    if (!texto) return;

    // Se deja completar el pegado antes de analizar.
    this.espera(() => this._intentar(texto), 30);
  }

  /**
   * Al escribir a mano, se intenta solo si parece un JSON completo.
   * @private
   */
  _alEscribir(e) {
    const texto = e.target.value;

    if (this._error) {
      this._error = null;
      this.refrescar();
    }

    // Solo se intenta si hay llaves equilibradas: evita analizar en cada tecla.
    const abre = (texto.match(/\{/g) ?? []).length;
    const cierra = (texto.match(/\}/g) ?? []).length;

    if (abre > 0 && abre === cierra) {
      this.espera(() => this._intentar(texto), 300);
    }
  }

  /**
   * Intenta aplicar una respuesta.
   *
   * @param {string} texto
   * @private
   */
  _intentar(texto) {
    if (!this._abierto) return;

    const resultado = this.emitirRespuesta(texto);

    if (resultado?.aceptada) {
      // El panel se cierra desde el evento bridge:close.
      this._error = null;
      return;
    }

    // Si falló, se guarda el motivo pero no se muestra todavía: el jugador
    // puede seguir escribiendo.
    this._ultimoFallo = resultado?.motivo ?? null;
  }

  /**
   * Aplica lo que haya en el campo, mostrando el error si lo hay.
   * @private
   */
  _aplicar() {
    const texto = this.refs.respuesta?.value ?? '';

    if (!texto.trim()) {
      this._error = 'No has pegado nada.';
      this.refrescar();
      return;
    }

    const resultado = this.emitirRespuesta(texto);

    if (!resultado?.aceptada) {
      this._error = resultado?.motivo ?? Parser.diagnosticar(texto);
      this.refrescar();

      clase(this.el, 'is-shaking', true);
      this.espera(() => clase(this.el, 'is-shaking', false), 400);
    }
  }

  /**
   * Envía la respuesta al proveedor a través del bus.
   *
   * @param {string} texto
   * @returns {Object|null}
   */
  emitirRespuesta(texto) {
    const dm = this.ui?.registry?.obtener?.('dungeonmaster');
    const puente = dm?.proveedor?.('puente');

    return puente?.recibir(texto) ?? null;
  }

  /** @private */
  _cancelar() {
    const dm = this.ui?.registry?.obtener?.('dungeonmaster');
    dm?.proveedor?.('puente')?.cancelar();

    this.cerrar();
  }

  /** @protected */
  alDestruir() {
    this._abierto = false;
    this._prompt = '';
  }
}

export default BridgePanel;
