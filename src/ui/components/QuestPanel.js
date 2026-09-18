/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · ui/components/QuestPanel.js
 * ---------------------------------------------------------------------------
 * Registro de misiones.
 *
 * Tres secciones con prioridades distintas:
 *
 *   · OFRECIDAS — arriba del todo y destacadas. Son decisiones pendientes, y
 *     una decisión pendiente escondida es una decisión perdida.
 *   · EN CURSO — el grueso, con el progreso de cada objetivo visible.
 *   · CERRADAS — plegadas por defecto. Importan poco salvo para recordar.
 *
 * Los objetivos se muestran con su progreso solo si son contables. Un «mata 3
 * lobos (1/3)» informa; un «habla con el herrero (0/1)» estorba.
 *
 * Dependencias: Component, DOM, Panel, Quest.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Component } from '../Component.js';
import { h, icono, vaciar, visible, texto as fijarTexto, clase } from '../DOM.js';
import { cabecera, vacio } from './Panel.js';
import { ESTADO, TIPOS } from '../../quests/Quest.js';
import { TEXTOS } from '../../config/ui.config.js';

export class QuestPanel extends Component {
  static nombre = 'misiones';
  static rama = 'quests';

  constructor(contexto, opciones) {
    super(contexto, opciones);

    /** Misión desplegada. @private */
    this._expandida = null;

    /** Si se muestran las cerradas. @private */
    this._verCerradas = false;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * @param {Object} quests
   * @returns {Node}
   * @protected
   */
  render(quests) {
    const sistema = this.ui?.registry?.obtener?.('quests');
    const datos = sistema?.paraInterfaz() ?? { activas: [], ofrecidas: [], cerradas: [] };

    const hayAlgo = datos.activas.length || datos.ofrecidas.length || datos.cerradas.length;

    return h('div.stack.stack--sm', {},
      cabecera({
        titulo: TEXTOS.paneles.misiones,
        icono: 'mision',
        contador: datos.activas.length ? String(datos.activas.length) : null,
      }),

      !hayAlgo ? vacio(TEXTOS.vacios.misiones) : null,

      // ─── Ofrecidas ────────────────────────────────────────────────────
      datos.ofrecidas.length
        ? h('div.stack.stack--sm', { ref: this.ref('ofrecidas') },
            h('span.eyebrow', {
              style: { color: 'var(--c-acento)' },
              text: `Te han propuesto (${datos.ofrecidas.length})`,
            }),
            ...datos.ofrecidas.map((m) => this._fichaOferta(m)),
          )
        : null,

      // ─── En curso ─────────────────────────────────────────────────────
      datos.activas.length
        ? h('div.stack.stack--sm', { ref: this.ref('activas') },
            datos.ofrecidas.length ? h('span.eyebrow', { text: 'En curso' }) : null,
            ...datos.activas.map((m) => this._fichaMision(m)),
          )
        : null,

      // ─── Cerradas ─────────────────────────────────────────────────────
      datos.cerradas.length
        ? h('div.stack.stack--sm', {},
            h('button.btn.btn--ghost.btn--sm', {
              type: 'button',
              style: { justifyContent: 'space-between', width: '100%' },
              onClick: () => { this._verCerradas = !this._verCerradas; this.refrescar(); },
            },
              h('span.eyebrow', { text: `Cerradas (${datos.cerradas.length})` }),
              icono(this._verCerradas ? 'flecha-arriba' : 'flecha-abajo', { class: 'icon--sm' }),
            ),

            this._verCerradas
              ? h('div.stack.stack--sm', {},
                  ...datos.cerradas.slice(-8).reverse().map((m) => this._fichaCerrada(m)),
                )
              : null,
          )
        : null,
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
     FICHAS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Ficha de una misión ofrecida, con sus botones de decisión.
   *
   * Se muestra la recompensa antes de aceptar: decidir a ciegas no es decidir.
   *
   * @private
   */
  _fichaOferta(m) {
    return h('div', {
      dataset: { mision: m.refId },
      style: {
        padding: 'var(--sp-3)',
        background: 'var(--c-superficie-2)',
        border: 'var(--bw-hair) solid var(--c-acento)',
        borderRadius: 'var(--r-sm)',
      },
    },
      h('div.row.row--between', {},
        h('span', {
          style: {
            fontFamily: 'var(--f-display)',
            fontSize: 'var(--f-sm)',
            color: 'var(--c-texto-titulo)',
          },
          text: m.titulo,
        }),
        h('span.eyebrow', { text: TIPOS[m.tipo]?.nombre ?? m.tipo }),
      ),

      h('p', {
        style: {
          fontSize: 'var(--f-xs)',
          color: 'var(--c-texto-suave)',
          margin: 'var(--sp-2) 0',
        },
        text: m.resumen,
      }),

      // ─── Recompensa ───────────────────────────────────────────────────
      h('div.row', { style: { gap: 'var(--sp-3)', marginBottom: 'var(--sp-2)' } },
        m.recompensa.xp > 0
          ? h('span.row', { style: { gap: 'var(--sp-1)' } },
              icono('xp', { class: 'icon--sm' }),
              h('span', { style: { fontSize: 'var(--f-2xs)' }, text: `${m.recompensa.xp}` }),
            )
          : null,
        m.recompensa.oro > 0
          ? h('span.row', { style: { gap: 'var(--sp-1)' } },
              icono('oro', { class: 'icon--sm icon--gold' }),
              h('span', { style: { fontSize: 'var(--f-2xs)' }, text: `${m.recompensa.oro}` }),
            )
          : null,
        m.plazo.tienePlazo
          ? h('span', {
              style: { fontSize: 'var(--f-2xs)', color: 'var(--c-aviso)' },
              text: `${m.plazo.diasRestantes ?? '?'} días de plazo`,
            })
          : null,
      ),

      // ─── Decisión ─────────────────────────────────────────────────────
      h('div.row', { style: { gap: 'var(--sp-2)' } },
        h('button.btn.btn--primary.btn--sm', {
          type: 'button',
          style: { flex: 1 },
          onClick: () => this._aceptar(m.refId),
        }, h('span', { text: 'Aceptar' })),

        h('button.btn.btn--ghost.btn--sm', {
          type: 'button',
          onClick: () => this._rechazar(m.refId),
        }, h('span', { text: 'Ahora no' })),
      ),
    );
  }

  /**
   * Ficha de una misión en curso.
   * @private
   */
  _fichaMision(m) {
    const expandida = this._expandida === m.refId;

    return h('div', {
      dataset: { mision: m.refId },
      style: {
        padding: 'var(--sp-2)',
        background: 'var(--c-superficie-2)',
        borderRadius: 'var(--r-sm)',
        borderLeft: `var(--bw-thick) solid ${this._colorTipo(m.tipo)}`,
        cursor: 'pointer',
      },
      onClick: () => {
        this._expandida = expandida ? null : m.refId;
        this.refrescar();
      },
    },
      // ─── Cabecera ─────────────────────────────────────────────────────
      h('div.row.row--between', {},
        h('span.truncate', {
          style: { fontSize: 'var(--f-sm)', color: 'var(--c-texto)' },
          text: m.titulo,
        }),

        m.plazo.urgente
          ? h('span', {
              style: { fontSize: 'var(--f-2xs)', color: 'var(--c-peligro)' },
              text: `${m.plazo.diasRestantes} d`,
            })
          : null,
      ),

      // ─── Barra de progreso ────────────────────────────────────────────
      h('div.statbar__track', { style: { height: '4px', margin: 'var(--sp-1) 0' } },
        h('div.statbar__fill', {
          style: {
            width: `${Math.round(m.fraccion * 100)}%`,
            '--statbar-color': this._colorTipo(m.tipo),
          },
        }),
      ),

      // ─── Siguiente objetivo, siempre visible ──────────────────────────
      !expandida && m.siguiente
        ? h('p', {
            style: {
              fontSize: 'var(--f-2xs)',
              color: 'var(--c-texto-tenue)',
              fontStyle: 'italic',
            },
            text: m.siguiente,
          })
        : null,

      // ─── Detalle desplegado ───────────────────────────────────────────
      expandida
        ? h('div.stack.stack--sm', { style: { marginTop: 'var(--sp-2)' } },
            h('p', {
              style: { fontSize: 'var(--f-xs)', color: 'var(--c-texto-suave)' },
              text: m.resumen,
            }),

            h('div.filo'),

            ...m.objetivos.map((o) => this._lineaObjetivo(o)),

            m.origen
              ? h('p', {
                  style: { fontSize: 'var(--f-2xs)', color: 'var(--c-texto-tenue)' },
                  text: `Lo encargó ${m.origen}.`,
                })
              : null,

            // Cobrar, si está lista.
            m.fraccion >= 1
              ? h('button.btn.btn--primary.btn--sm.btn--block', {
                  type: 'button',
                  onClick: (e) => { e.stopPropagation(); this._completar(m.refId); },
                }, icono('mision', { class: 'icon--sm' }), h('span', { text: 'Dar por terminada' }))
              : null,
          )
        : null,
    );
  }

  /**
   * Línea de un objetivo, con su progreso si es contable.
   * @private
   */
  _lineaObjetivo(o) {
    return h('div.row', { style: { gap: 'var(--sp-2)', alignItems: 'flex-start' } },
      icono(o.hecho ? 'check' : 'punto', {
        class: 'icon--sm',
        style: { color: o.hecho ? 'var(--c-exito)' : 'var(--c-texto-tenue)', flexShrink: 0 },
      }),

      h('div', { style: { flex: 1, minWidth: 0 } },
        h('span', {
          style: {
            fontSize: 'var(--f-xs)',
            color: o.hecho ? 'var(--c-texto-tenue)' : 'var(--c-texto)',
            textDecoration: o.hecho ? 'line-through' : 'none',
          },
          text: o.texto,
        }),

        o.opcional
          ? h('span', {
              style: { fontSize: 'var(--f-2xs)', color: 'var(--c-acento)', marginLeft: 'var(--sp-1)' },
              text: '(opcional)',
            })
          : null,

        // La barra solo aparece en los contables con más de una unidad.
        o.contable && o.cantidad > 1 && !o.hecho
          ? h('div.statbar__track', { style: { height: '3px', marginTop: '2px' } },
              h('div.statbar__fill', {
                style: {
                  width: `${Math.round(o.fraccion * 100)}%`,
                  '--statbar-color': 'var(--c-info)',
                },
              }),
            )
          : null,
      ),
    );
  }

  /**
   * Ficha compacta de una misión cerrada.
   * @private
   */
  _fichaCerrada(m) {
    const completada = m.estado === ESTADO.COMPLETADA;

    return h('div.row.row--between', {
      style: {
        padding: 'var(--sp-1) var(--sp-2)',
        opacity: '0.6',
        fontSize: 'var(--f-2xs)',
      },
    },
      h('span.truncate', { text: m.titulo }),
      h('span', {
        style: { color: completada ? 'var(--c-exito)' : 'var(--c-peligro)', flexShrink: 0 },
        text: completada ? 'cumplida' : 'fallida',
      }),
    );
  }

  /** @private */
  _colorTipo(tipo) {
    const colores = {
      principal: 'var(--c-acento)',
      secundaria: 'var(--c-info)',
      menor: 'var(--c-texto-tenue)',
    };
    return colores[tipo] ?? 'var(--c-info)';
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ACCIONES
     ═══════════════════════════════════════════════════════════════════════ */

  /** @private */
  _aceptar(refId) {
    const sistema = this.ui?.registry?.obtener?.('quests');
    const r = sistema?.aceptar(refId);

    if (!r?.aplicada && r?.motivo) {
      this.ui?.avisar(r.motivo, { tipo: 'aviso' });
    }

    this.refrescar();
  }

  /** @private */
  _rechazar(refId) {
    // Rechazar no borra: la misión puede volver a ofrecerse más adelante.
    this.despachar('quests/actualizar', {
      mision: { ...this.leer(`quests.activas.porId.${refId}`), estado: ESTADO.RECHAZADA },
    });

    this.refrescar();
  }

  /** @private */
  async _completar(refId) {
    const sistema = this.ui?.registry?.obtener?.('quests');
    const mision = sistema?.obtener(refId);

    if (!mision) return;

    const seguro = await this.ui?.confirmar(
      mision.nombreOrigen
        ? `¿Dar por terminada «${mision.titulo}»? Normalmente hay que hablar con ${mision.nombreOrigen} para cobrarla.`
        : `¿Dar por terminada «${mision.titulo}»?`,
      { titulo: 'Terminar misión', si: 'Terminar', no: 'Cancelar' },
    );

    if (!seguro) return;

    const r = sistema.completar(refId);

    if (!r.aplicada && r.motivo) {
      this.ui?.avisar(r.motivo, { tipo: 'aviso' });
    }

    this.refrescar();
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CICLO DE VIDA
     ═══════════════════════════════════════════════════════════════════════ */

  /** @protected */
  alMontar() {
    // Cualquier movimiento en las misiones redibuja el panel.
    for (const evento of ['quests:offered', 'quests:accepted', 'quests:progress',
                          'quests:completed', 'quests:failed']) {
      this.escuchar(evento, () => this.refrescar());
    }

    // Una misión nueva destaca el panel para que se note.
    this.escuchar('quests:offered', () => {
      clase(this.el, 'is-levelup', true);
      this.espera(() => clase(this.el, 'is-levelup', false), 900);
    });
  }

  /**
   * @param {Object} quests
   * @param {Object} anterior
   * @returns {boolean}
   * @protected
   */
  actualizar(quests, anterior) {
    // El registro cambia poco y de forma estructural: se rehace entero.
    return quests?.activas === anterior?.activas
      && quests?.completadas === anterior?.completadas
      && quests?.fracasadas === anterior?.fracasadas;
  }

  /** @protected */
  alDestruir() {
    this._expandida = null;
  }
}

export default QuestPanel;
