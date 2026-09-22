/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ui/screens/MainMenuScreen.js
 * ---------------------------------------------------------------------------
 * Menú principal: la portada.
 *
 * Es la primera cosa que ve el jugador, y por eso lleva escrito de forma
 * visible —no escondida en unos términos— que todo ocurre en su navegador y
 * que no se guarda nada salvo que lo active. Esa nota no es decorativa: es la
 * decisión de diseño del proyecto puesta donde se lee.
 *
 * "Continuar" solo aparece si existe realmente una partida guardada. Ofrecer un
 * botón que no lleva a ninguna parte es peor que no ofrecerlo.
 *
 * Dependencias: Component, DOM, config, utils/format.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Component } from '../Component.js';
import { h, icono } from '../DOM.js';
import { PANTALLAS, TEXTOS } from '../../config/ui.config.js';
import { APP, PERSISTENCIA } from '../../config/app.config.js';
import { fecha, tiempoJugado } from '../../utils/format.js';

export class MainMenuScreen extends Component {
  static nombre = 'pantalla-menu';
  static rama = '';

  /**
   * @returns {HTMLElement}
   * @protected
   */
  render() {
    const guardado = this._buscarGuardado();
    const hayPartida = Boolean(this.leer('meta.id'));

    return h('div.menu', {},

      h('div.boot__sigil', { attrs: { 'aria-hidden': 'true' } },
        this._sigilo(),
      ),

      h('h1.menu__title', { text: APP.nombre }),
      h('p.menu__subtitle', { text: APP.lema }),

      h('div.menu__filo.filo'),

      h('div.menu__actions', {},

        // Continuar la partida en memoria, si la hay.
        hayPartida
          ? h('button.btn.btn--primary.btn--lg.btn--block', {
              type: 'button',
              onClick: () => this.ui?.irA(PANTALLAS.JUEGO),
            },
              icono('pergamino'),
              h('span', { text: 'Volver a la crónica' }),
            )
          : null,

        // Cargar del almacenamiento, solo si existe algo que cargar.
        guardado
          ? h('button.btn.btn--lg.btn--block', {
              type: 'button',
              onClick: () => this._cargar(),
            },
              icono('bolsa'),
              h('span', { text: `${TEXTOS.menu.continuar} · ${guardado.titulo}` }),
            )
          : null,

        h('button.btn.btn--lg.btn--block', {
          class: hayPartida || guardado ? '' : 'btn--primary',
          type: 'button',
          onClick: () => this._nueva(hayPartida),
        },
          icono('dado'),
          h('span', { text: TEXTOS.menu.nuevaPartida }),
        ),

        h('button.btn.btn--lg.btn--block', {
          type: 'button',
          onClick: () => this.ui?.irA(PANTALLAS.AJUSTES),
        },
          icono('ajustes'),
          h('span', { text: TEXTOS.menu.ajustes }),
        ),
      ),

      // Detalle de la partida guardada, si la hay.
      guardado
        ? h('p.menu__version', {
            text: `${fecha(guardado.modificada)} · nivel ${guardado.nivel} · ${tiempoJugado(guardado.tiempoJugado ?? 0)}`,
          })
        : null,

      // Nota de privacidad, siempre visible.
      h('p.menu__privacy', {},
        icono('escudo', { class: 'icon--sm' }),
        h('span', { text: ` ${TEXTOS.menu.privacidad}` }),
      ),

      h('p.menu__version', { text: `v${APP.version} · ${APP.fase}` }),
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
     ACCIONES
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Empieza una crónica nueva, confirmando si hay una en curso.
   * @param {boolean} hayPartida
   * @private
   */
  async _nueva(hayPartida) {
    if (hayPartida) {
      const seguro = await this.ui?.confirmar(TEXTOS.confirmaciones.abandonar, {
        titulo: 'Abandonar la crónica',
        si: 'Abandonar',
        no: TEXTOS.confirmaciones.cancelar,
        peligroso: true,
      });
      if (!seguro) return;
    }

    this.emitir('game:new');
    this.ui?.irA(PANTALLAS.CREACION);
  }

  /**
   * Solicita la carga de la partida guardada. Quien la ejecute será SaveManager,
   * en la Fase 9; aquí solo se publica la intención.
   * @private
   */
  _cargar() {
    this.emitir('game:load', { ranura: 'auto' });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     AUXILIARES
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Lee la cabecera de la partida guardada sin deserializarla entera.
   *
   * Se accede a LocalStorage directamente y de forma protegida porque en modo
   * privado de algunos navegadores el simple acceso lanza. Un fallo aquí no
   * debe impedir que se vea el menú.
   *
   * @returns {Object|null}
   * @private
   */
  _buscarGuardado() {
    try {
      const crudo = localStorage.getItem(PERSISTENCIA.claveAuto);
      if (!crudo) return null;
      const datos = JSON.parse(crudo);
      return {
        titulo: datos?.meta?.titulo ?? 'Crónica sin nombre',
        modificada: datos?.meta?.modificada ?? Date.now(),
        nivel: datos?.player?.nivel ?? 1,
        tiempoJugado: datos?.meta?.tiempoJugado ?? 0,
      };
    } catch {
      return null;
    }
  }

  /**
   * Sigilo arcano de la portada.
   * @returns {SVGElement}
   * @private
   */
  _sigilo() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('class', 'boot__sigil-svg');

    const trazos = [
      { d: 'M50 6l38 44-38 44-38-44z', relleno: 'none' },
      { d: 'M50 20l26 30-26 30-26-30z', relleno: 'none' },
    ];

    for (const t of trazos) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', t.d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', '2');
      svg.appendChild(p);
    }

    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', '50');
    c.setAttribute('cy', '50');
    c.setAttribute('r', '5');
    c.setAttribute('fill', 'currentColor');
    svg.appendChild(c);

    return svg;
  }
}

export default MainMenuScreen;
