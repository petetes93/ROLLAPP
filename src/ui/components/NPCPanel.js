/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · ui/components/NPCPanel.js
 * ---------------------------------------------------------------------------
 * Quién hay delante.
 *
 * Muestra a los personajes presentes con lo que el jugador necesita saber para
 * decidir cómo tratarlos: quién son, qué opinan de él y qué se les puede pedir.
 *
 * Dos decisiones de presentación:
 *
 *   · LA ACTITUD SE MUESTRA EN PALABRAS, NO EN NÚMEROS. «Desconfía de ti» dice
 *     más que «-30», y evita que el jugador optimice una barra en vez de tratar
 *     con personas.
 *
 *   · LOS COMPROMISOS PENDIENTES SE DESTACAN. Si le debes algo a alguien, es lo
 *     primero que debería ver al tenerlo delante.
 *
 * Las acciones disponibles dependen de quién sea: solo los mercaderes ofrecen
 * comerciar, y solo quien te tiene aprecio admite según qué peticiones.
 *
 * Dependencias: Component, DOM, Panel, NPC.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Component } from '../Component.js';
import { h, icono, vaciar, clase } from '../DOM.js';
import { cabecera, vacio } from './Panel.js';
import { TEXTOS } from '../../config/ui.config.js';

export class NPCPanel extends Component {
  static nombre = 'npcs';
  static rama = 'npcs';

  constructor(contexto, opciones) {
    super(contexto, opciones);

    /** PNJ desplegado. @private */
    this._expandido = null;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * @param {Object} npcs
   * @returns {Node}
   * @protected
   */
  render(npcs) {
    const sistema = this.ui?.registry?.obtener?.('npcs');
    const presentes = sistema?.paraInterfaz() ?? [];

    return h('div.stack.stack--sm', {},
      cabecera({
        titulo: TEXTOS.paneles.npcs,
        icono: 'ojo',
        contador: presentes.length ? String(presentes.length) : null,
      }),

      presentes.length
        ? h('div.stack.stack--sm', { ref: this.ref('lista') },
            ...presentes.map((n) => this._ficha(n)),
          )
        : vacio(TEXTOS.vacios.npcs),

      // ─── Conocidos que no están aquí ──────────────────────────────────
      this._resumenConocidos(),
    );
  }

  /**
   * Ficha de un personaje presente.
   * @private
   */
  _ficha(n) {
    const expandido = this._expandido === n.refId;

    return h('div', {
      dataset: { npc: n.refId },
      style: {
        padding: 'var(--sp-2)',
        background: 'var(--c-superficie-2)',
        borderRadius: 'var(--r-sm)',
        borderLeft: `var(--bw-thick) solid var(--c-${n.colorActitud})`,
        cursor: 'pointer',
      },
      onClick: () => {
        this._expandido = expandido ? null : n.refId;
        this.refrescar();
      },
    },
      // ─── Identidad ────────────────────────────────────────────────────
      h('div.row.row--between', {},
        h('span.truncate', {
          style: { fontSize: 'var(--f-sm)', color: 'var(--c-texto)' },
          text: n.nombre,
        }),

        // Un compromiso pendiente es lo primero que debe verse.
        n.pendientes > 0
          ? h('span.row', { style: { gap: '2px', flexShrink: 0 } },
              icono('oro', { class: 'icon--sm', style: { color: 'var(--c-aviso)' } }),
              h('span', {
                style: { fontSize: 'var(--f-2xs)', color: 'var(--c-aviso)' },
                text: String(n.pendientes),
              }),
            )
          : null,
      ),

      // ─── Papel y actitud ──────────────────────────────────────────────
      h('div.row.row--between', {},
        h('span', {
          style: { fontSize: 'var(--f-2xs)', color: 'var(--c-texto-tenue)' },
          text: n.rol,
        }),
        h('span', {
          style: { fontSize: 'var(--f-2xs)', color: `var(--c-${n.colorActitud})` },
          text: n.etiquetaActitud,
        }),
      ),

      // ─── Detalle desplegado ───────────────────────────────────────────
      expandido ? this._detalle(n) : null,
    );
  }

  /**
   * Detalle de un personaje, con sus acciones.
   * @private
   */
  _detalle(n) {
    return h('div.stack.stack--sm', { style: { marginTop: 'var(--sp-2)' } },
      n.rasgo
        ? h('p', {
            style: {
              fontSize: 'var(--f-xs)',
              color: 'var(--c-texto-suave)',
              fontStyle: 'italic',
            },
            text: n.rasgo.charAt(0).toUpperCase() + n.rasgo.slice(1) + '.',
          })
        : null,

      n.faccion
        ? h('div.row.row--between', {},
            h('span.eyebrow', { text: 'Afiliación' }),
            h('span', { style: { fontSize: 'var(--f-2xs)' }, text: n.faccion }),
          )
        : null,

      n.encuentros > 1
        ? h('div.row.row--between', {},
            h('span.eyebrow', { text: 'Os habéis visto' }),
            h('span', { style: { fontSize: 'var(--f-2xs)' }, text: `${n.encuentros} veces` }),
          )
        : null,

      // ─── Compromisos ──────────────────────────────────────────────────
      n.pendientes > 0
        ? h('p', {
            style: {
              fontSize: 'var(--f-2xs)',
              color: 'var(--c-aviso)',
              padding: 'var(--sp-1) var(--sp-2)',
              background: 'var(--c-aviso-tenue)',
              borderRadius: 'var(--r-sm)',
            },
            text: n.pendientes === 1
              ? 'Le debes algo.'
              : `Le debes ${n.pendientes} cosas.`,
          })
        : null,

      h('div.filo'),

      // ─── Acciones ─────────────────────────────────────────────────────
      h('div.actionbar__quick', {}, ...this._acciones(n)),
    );
  }

  /**
   * Acciones disponibles con este personaje.
   *
   * Dependen de quién sea y de cómo te trate: solo los mercaderes comercian, y
   * pedir un favor a quien te detesta no aparece siquiera.
   *
   * @private
   */
  _acciones(n) {
    const acciones = [];

    // ─── Hablar, siempre ────────────────────────────────────────────────
    acciones.push({
      etiqueta: 'Hablar',
      icono: 'ojo',
      accion: () => this._precargar(`Hablo con ${n.nombre}`),
    });

    // ─── Comerciar ──────────────────────────────────────────────────────
    if (n.esMercader && n.disponible) {
      acciones.push({
        etiqueta: 'Comerciar',
        icono: 'oro',
        accion: () => this.emitir('ui:trade:open', { npc: n }),
      });
    }

    // ─── Preguntar por la zona ──────────────────────────────────────────
    if (n.actitud > -25) {
      acciones.push({
        etiqueta: 'Preguntar',
        icono: 'mapa',
        accion: () => this._precargar(`Pregunto a ${n.nombre} qué se cuenta por aquí`),
      });
    }

    // ─── Pedir un favor: solo si hay confianza ──────────────────────────
    if (n.actitud >= 25) {
      acciones.push({
        etiqueta: 'Pedir ayuda',
        icono: 'escudo',
        accion: () => this._precargar(`Le pido ayuda a ${n.nombre}`),
      });
    }

    // ─── Saldar lo que le debes ─────────────────────────────────────────
    if (n.pendientes > 0) {
      acciones.push({
        etiqueta: 'Saldar',
        icono: 'oro',
        destacada: true,
        accion: () => this._precargar(`Cumplo lo que le prometí a ${n.nombre}`),
      });
    }

    return acciones.map((a) => h('button.choice', {
      type: 'button',
      style: a.destacada
        ? { borderColor: 'var(--c-acento)', color: 'var(--c-acento-claro)' }
        : {},
      onClick: (e) => { e.stopPropagation(); a.accion(); },
    },
      icono(a.icono, { class: 'icon--sm' }),
      h('span', { text: a.etiqueta }),
    ));
  }

  /**
   * Resumen de los conocidos que no están presentes.
   *
   * Da idea de la red de contactos sin llenar el panel: solo los extremos.
   *
   * @private
   */
  _resumenConocidos() {
    const relaciones = this.ui?.registry?.obtener?.('relationships');
    const extremos = relaciones?.extremos(3);

    if (!extremos || (!extremos.aliados.length && !extremos.enemigos.length)) return null;

    const presentes = new Set(this.leer('npcs.presentes', []));

    const filtrar = (lista) => lista.filter((n) => !presentes.has(n.refId));

    const aliados = filtrar(extremos.aliados);
    const enemigos = filtrar(extremos.enemigos);

    if (!aliados.length && !enemigos.length) return null;

    return h('div.stack.stack--sm', { style: { marginTop: 'var(--sp-3)' } },
      h('div.filo'),

      aliados.length
        ? h('div', {},
            h('span.eyebrow', { style: { color: 'var(--c-exito)' }, text: 'Cuentas con' }),
            ...aliados.map((n) => h('div.row.row--between', {
              style: { fontSize: 'var(--f-2xs)', padding: '2px 0' },
            },
              h('span.truncate', { text: n.nombre }),
              h('span', { style: { color: 'var(--c-texto-tenue)' }, text: n.rol }),
            )),
          )
        : null,

      enemigos.length
        ? h('div', {},
            h('span.eyebrow', { style: { color: 'var(--c-peligro)' }, text: 'Te la tienen jurada' }),
            ...enemigos.map((n) => h('div.row.row--between', {
              style: { fontSize: 'var(--f-2xs)', padding: '2px 0' },
            },
              h('span.truncate', { text: n.nombre }),
              h('span', { style: { color: 'var(--c-texto-tenue)' }, text: n.rol }),
            )),
          )
        : null,
    );
  }

  /**
   * Precarga texto en la caja de entrada.
   *
   * No lo envía: el jugador puede matizarlo antes. Es una ayuda, no un botón
   * de acción, y eso preserva la escritura libre como forma principal de jugar.
   *
   * @private
   */
  _precargar(texto) {
    this.emitir('ui:input:preload', { texto });
    this.ui?.cajon?.('derecho', false);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CICLO DE VIDA
     ═══════════════════════════════════════════════════════════════════════ */

  /** @protected */
  alMontar() {
    for (const evento of ['npc:appears', 'npc:leaves', 'npc:attitude:change',
                          'npc:attitude:level', 'npc:killed']) {
      this.escuchar(evento, () => this.refrescar());
    }

    // Un cambio de nivel de actitud merece destacarse.
    this.escuchar('npc:attitude:level', ({ nombre, mejora }) => {
      this.ui?.avisar(
        mejora ? `${nombre} te tiene en mejor concepto.` : `${nombre} te tiene en peor concepto.`,
        { tipo: mejora ? 'exito' : 'aviso' },
      );
    });
  }

  /**
   * @param {Object} npcs
   * @param {Object} anterior
   * @returns {boolean}
   * @protected
   */
  actualizar(npcs, anterior) {
    // Los presentes y las actitudes cambian juntos y de forma estructural.
    return npcs?.presentes === anterior?.presentes
      && npcs?.relaciones === anterior?.relaciones;
  }

  /** @protected */
  alDestruir() {
    this._expandido = null;
  }
}

export default NPCPanel;
