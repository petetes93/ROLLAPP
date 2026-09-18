/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · ui/components/StatsPanel.js
 * ---------------------------------------------------------------------------
 * La crónica en cifras.
 *
 * Dos pestañas: las estadísticas de la partida y el registro de hazañas.
 *
 * El criterio para elegir qué mostrar no es «todo lo que se mide», que serían
 * setenta cifras ilegibles, sino lo que le dice algo al jugador sobre su propia
 * partida. De ahí que la sección más destacada sea el estilo de juego: una
 * palabra —«diplomático», «implacable», «explorador»— y la barra de violencia
 * que la sostiene.
 *
 * Las hazañas ocultas no conseguidas no aparecen. Sí aparece cuántas faltan,
 * porque saber que quedan seis sorpresas es en sí mismo un aliciente.
 *
 * Dependencias: Component, DOM, Panel, achievements.data.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Component } from '../Component.js';
import { h, icono, vaciar, clase } from '../DOM.js';
import { cabecera } from './Panel.js';
import { listado, conteo } from '../../data/achievements.data.js';
import { porciento, numero } from '../../utils/format.js';

export class StatsPanel extends Component {
  static nombre = 'estadisticas';
  static rama = 'hazanas';

  constructor(contexto, opciones) {
    super(contexto, opciones);

    /** 'cifras' | 'hazanas' @private */
    this._pestana = 'cifras';
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */

  /** @returns {Node} @protected */
  render() {
    return h('div.stack.stack--sm', {},
      cabecera({ titulo: 'La crónica', icono: 'pergamino' }),

      // ─── Pestañas ─────────────────────────────────────────────────────
      h('div.actionbar__quick', {},
        ...[
          { clave: 'cifras', etiqueta: 'Cifras', icono: 'xp' },
          { clave: 'hazanas', etiqueta: 'Hazañas', icono: 'mision' },
        ].map((p) => h('button.choice', {
          type: 'button',
          style: this._pestana === p.clave
            ? { borderColor: 'var(--c-acento)', color: 'var(--c-acento-claro)' }
            : {},
          onClick: () => { this._pestana = p.clave; this.refrescar(); },
        },
          icono(p.icono, { class: 'icon--sm' }),
          h('span', { text: p.etiqueta }),
        )),
      ),

      this._pestana === 'cifras' ? this._cifras() : this._hazanas(),
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CIFRAS
     ═══════════════════════════════════════════════════════════════════════ */

  /** @private */
  _cifras() {
    const tracker = this.ui?.registry?.obtener?.('hazanas');
    const r = tracker?.resumen();

    if (!r) {
      return h('p.settings__note', { text: 'Aún no hay nada que contar.' });
    }

    return h('div.stack.stack--sm', {},
      // ─── Estilo de juego: lo primero y lo más grande ─────────────────
      this._bloqueEstilo(r),

      this._grupo('La crónica', [
        ['Turnos jugados', numero(r.cronica.turnos)],
        ['Días transcurridos', numero(r.cronica.dias)],
        ['Nivel alcanzado', numero(r.cronica.nivel)],
      ]),

      this._grupo('Combate', [
        ['Combates', numero(r.combate.combates)],
        ['Victorias', numero(r.combate.victorias)],
        ['Huidas', numero(r.combate.huidas)],
        ['Enemigos derrotados', numero(r.combate.enemigos)],
        r.combate.jefes > 0 ? ['Jefes derrotados', numero(r.combate.jefes)] : null,
        r.combate.golpeMasFuerte > 0 ? ['Golpe más fuerte', numero(r.combate.golpeMasFuerte)] : null,
        r.combate.combates > 0 ? ['Tasa de victoria', porciento(r.combate.tasaVictoria)] : null,
      ]),

      this._grupo('Mundo', [
        ['Lugares descubiertos', numero(r.mundo.lugares)],
        ['Regiones pisadas', `${r.mundo.regiones} de 6`],
        ['Encuentros', numero(r.mundo.encuentros)],
      ]),

      this._grupo('Gente y palabra', [
        ['Personas conocidas', numero(r.social.personas)],
        ['Misiones cumplidas', numero(r.social.misiones)],
        r.social.falladas > 0 ? ['Misiones falladas', numero(r.social.falladas)] : null,
        r.social.sinViolencia > 0
          ? ['Resueltas hablando', numero(r.social.sinViolencia)]
          : null,
      ]),

      this._grupo('Oro', [
        ['Ganado', numero(r.economia.ganado)],
        ['Gastado', numero(r.economia.gastado)],
        ['Balance', numero(r.economia.neto)],
        ['Objetos encontrados', numero(r.economia.objetos)],
      ]),
    );
  }

  /**
   * Bloque destacado del estilo de juego.
   *
   * Es la única cifra que interpreta en vez de contar, y por eso va primero: un
   * jugador que ve «implacable» con la barra al 90 % aprende algo sobre su
   * partida que ninguna otra cifra le dice.
   *
   * @private
   */
  _bloqueEstilo(r) {
    const violencia = r.estilo.indiceViolencia;

    return h('div', {
      style: {
        padding: 'var(--sp-3)',
        background: 'var(--c-superficie-2)',
        borderRadius: 'var(--r-sm)',
        borderLeft: 'var(--bw-thick) solid var(--c-acento)',
      },
    },
      h('div.eyebrow', { text: 'Tu forma de jugar' }),

      h('div', {
        style: {
          fontFamily: 'var(--f-display)',
          fontSize: 'var(--f-lg)',
          color: 'var(--c-acento-claro)',
          textTransform: 'capitalize',
        },
        text: r.estilo.etiqueta,
      }),

      // ─── Barra de violencia ───────────────────────────────────────────
      // Los dos extremos etiquetados: sin ellos, un porcentaje suelto no dice
      // en qué dirección va.
      h('div', { style: { marginTop: 'var(--sp-3)' } },
        h('div.row.row--between', {},
          h('span', {
            style: { fontSize: 'var(--f-2xs)', color: 'var(--c-exito)' },
            text: 'la palabra',
          }),
          h('span', {
            style: { fontSize: 'var(--f-2xs)', color: 'var(--c-peligro)' },
            text: 'el acero',
          }),
        ),

        h('div.statbar__track', { style: { height: '8px', marginTop: '3px' } },
          h('div.statbar__fill', {
            style: {
              width: `${Math.round(violencia * 100)}%`,
              '--statbar-color': violencia > 0.6 ? 'var(--c-peligro)'
                : violencia > 0.35 ? 'var(--c-aviso)'
                : 'var(--c-exito)',
            },
          }),
        ),
      ),

      r.estilo.precision > 0
        ? h('p', {
            style: {
              fontSize: 'var(--f-2xs)',
              color: 'var(--c-texto-tenue)',
              marginTop: 'var(--sp-2)',
            },
            text: `Aciertas ${porciento(r.estilo.precision)} de las tiradas.`,
          })
        : null,
    );
  }

  /**
   * Grupo de cifras con su encabezado.
   *
   * Las entradas nulas se descartan: una fila «Jefes derrotados: 0» ocupa sitio
   * sin informar.
   *
   * @private
   */
  _grupo(titulo, filas) {
    const utiles = filas.filter(Boolean);
    if (!utiles.length) return null;

    return h('div.stack.stack--sm', {},
      h('span.eyebrow', { text: titulo }),

      ...utiles.map(([etiqueta, valor]) => h('div.row.row--between', {
        style: { fontSize: 'var(--f-xs)', padding: '2px 0' },
      },
        h('span', { style: { color: 'var(--c-texto-suave)' }, text: etiqueta }),
        h('span', {
          style: { fontFamily: 'var(--f-mono)', color: 'var(--c-texto)' },
          text: String(valor),
        }),
      )),
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
     HAZAÑAS
     ═══════════════════════════════════════════════════════════════════════ */

  /** @private */
  _hazanas() {
    const tracker = this.ui?.registry?.obtener?.('hazanas');
    const conseguidas = this.leer('hazanas.conseguidas', []);

    const lista = listado(conseguidas, tracker?.todas() ?? {}, this.store.estado);
    const total = conteo();

    const logradas = lista.filter((h) => h.conseguida);
    const pendientes = lista.filter((h) => !h.conseguida);

    // Las ocultas que siguen sin descubrirse.
    const ocultasPendientes = total.ocultas
      - logradas.filter((h) => h.clase === 'oculta').length;

    return h('div.stack.stack--sm', {},
      // ─── Recuento ─────────────────────────────────────────────────────
      h('div', {
        style: {
          padding: 'var(--sp-2) var(--sp-3)',
          background: 'var(--c-superficie-2)',
          borderRadius: 'var(--r-sm)',
        },
      },
        h('div.row.row--between', {},
          h('span.eyebrow', { text: 'Conseguidas' }),
          h('span', {
            style: { fontFamily: 'var(--f-mono)', color: 'var(--c-acento)' },
            text: `${logradas.length} de ${total.total}`,
          }),
        ),

        h('div.statbar__track', { style: { height: '5px', marginTop: '4px' } },
          h('div.statbar__fill', {
            style: {
              width: `${Math.round(logradas.length / total.total * 100)}%`,
              '--statbar-color': 'var(--c-acento)',
            },
          }),
        ),

        // Saber que quedan sorpresas es en sí mismo un aliciente.
        ocultasPendientes > 0
          ? h('p', {
              style: {
                fontSize: 'var(--f-2xs)',
                color: 'var(--c-texto-tenue)',
                marginTop: 'var(--sp-1)',
                fontStyle: 'italic',
              },
              text: ocultasPendientes === 1
                ? 'Queda una hazaña oculta por descubrir.'
                : `Quedan ${ocultasPendientes} hazañas ocultas por descubrir.`,
            })
          : null,
      ),

      // ─── Pendientes con progreso ──────────────────────────────────────
      pendientes.length
        ? h('div.stack.stack--sm', {},
            h('span.eyebrow', { text: 'En camino' }),
            ...pendientes.map((x) => this._fichaHazana(x)),
          )
        : null,

      // ─── Conseguidas ──────────────────────────────────────────────────
      logradas.length
        ? h('div.stack.stack--sm', { style: { marginTop: 'var(--sp-3)' } },
            h('div.filo'),
            h('span.eyebrow', { style: { color: 'var(--c-acento)' }, text: 'Logradas' }),
            ...logradas.map((x) => this._fichaHazana(x)),
          )
        : null,
    );
  }

  /**
   * Ficha de una hazaña.
   * @private
   */
  _fichaHazana(x) {
    return h('div', {
      style: {
        padding: 'var(--sp-2)',
        background: x.conseguida ? 'var(--c-superficie-2)' : 'transparent',
        borderRadius: 'var(--r-sm)',
        borderLeft: x.conseguida
          ? 'var(--bw-thick) solid var(--c-acento)'
          : 'var(--bw-thick) solid var(--c-borde)',
        opacity: x.conseguida ? '1' : '0.75',
      },
    },
      h('div.row', { style: { gap: 'var(--sp-2)', alignItems: 'flex-start' } },
        icono(x.icono, {
          class: 'icon--sm',
          style: {
            color: x.conseguida ? 'var(--c-acento)' : 'var(--c-texto-tenue)',
            flexShrink: 0,
            marginTop: '2px',
          },
        }),

        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', {
            style: {
              fontSize: 'var(--f-xs)',
              color: x.conseguida ? 'var(--c-texto-titulo)' : 'var(--c-texto-suave)',
            },
            text: x.nombre,
          }),

          h('div', {
            style: { fontSize: 'var(--f-2xs)', color: 'var(--c-texto-tenue)' },
            text: x.descripcion,
          }),

          // ─── Barra de progreso, si la declara ───────────────────────
          x.progreso
            ? h('div', { style: { marginTop: '3px' } },
                h('div.statbar__track', { style: { height: '3px' } },
                  h('div.statbar__fill', {
                    style: {
                      width: `${Math.round(x.progreso.fraccion * 100)}%`,
                      '--statbar-color': 'var(--c-info)',
                    },
                  }),
                ),
                h('span', {
                  style: { fontSize: 'var(--f-2xs)', color: 'var(--c-texto-tenue)' },
                  text: `${x.progreso.actual} / ${x.progreso.total}`,
                }),
              )
            : null,

          // ─── El texto de la hazaña, solo al conseguirla ─────────────
          // Antes sería un espóiler: buena parte del premio es leerlo.
          x.conseguida && x.texto
            ? h('p', {
                style: {
                  fontSize: 'var(--f-2xs)',
                  color: 'var(--c-texto-narrativa)',
                  fontStyle: 'italic',
                  marginTop: '3px',
                },
                text: x.texto,
              })
            : null,
        ),
      ),
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CICLO DE VIDA
     ═══════════════════════════════════════════════════════════════════════ */

  /** @protected */
  alMontar() {
    // Una hazaña nueva salta a su pestaña y destaca el panel.
    this.escuchar('achievement:unlocked', () => {
      this._pestana = 'hazanas';
      this.refrescar();

      clase(this.el, 'is-levelup', true);
      this.espera(() => clase(this.el, 'is-levelup', false), 900);
    });

    this.escuchar('stats:record', () => {
      if (this._pestana === 'cifras') this.refrescar();
    });
  }

  /**
   * @param {Object} hazanas
   * @param {Object} anterior
   * @returns {boolean}
   * @protected
   */
  actualizar(hazanas, anterior) {
    // Las estadísticas cambian cada turno; refrescar el panel entero cada vez
    // sería tirar trabajo. Solo se rehace si está a la vista.
    if (!this.visible) return true;

    if (hazanas?.conseguidas !== anterior?.conseguidas) return false;

    // Un cambio de cifras solo importa en la pestaña de cifras.
    return this._pestana !== 'cifras';
  }

  /** @returns {boolean} Si el panel está a la vista. @private */
  get visible() {
    return Boolean(this.el?.offsetParent);
  }

  /** @protected */
  alDestruir() {
    this._pestana = 'cifras';
  }
}

export default StatsPanel;
