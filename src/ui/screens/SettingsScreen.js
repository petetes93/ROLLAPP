/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · ui/screens/SettingsScreen.js
 * ---------------------------------------------------------------------------
 * Pantalla de ajustes, generada por completo desde el catálogo AJUSTES de
 * ui.config.js.
 *
 * No hay ni un control escrito a mano: la pantalla recorre el catálogo y
 * construye interruptores, desplegables, deslizadores y campos según el `tipo`
 * declarado. Añadir una opción al juego es añadir un objeto a la configuración.
 *
 * Dos casos reciben trato especial, y ambos por la misma razón —proteger al
 * jugador de decisiones que no ha entendido:
 *
 *   · Activar el guardado exige una confirmación explícita que dice qué se va a
 *     guardar y dónde.
 *   · El campo de credencial es volátil: no toca el estado ni el guardado. Va
 *     directo al proveedor y muere con la pestaña. La pantalla lo dice.
 *
 * Dependencias: Component, DOM, config, utils/id.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Component } from '../Component.js';
import { h, icono, texto as fijarTexto, visible, atributo } from '../DOM.js';
import { AJUSTES, PANTALLAS, TEXTOS } from '../../config/ui.config.js';
import { CATALOGO_PROVEEDORES, CREDENCIALES } from '../../config/ai.config.js';
import { id } from '../../utils/id.js';

export class SettingsScreen extends Component {
  static nombre = 'pantalla-ajustes';
  static rama = 'settings';

  constructor(contexto, opciones) {
    super(contexto, opciones);

    /**
     * Nodos de cada ajuste, para poder mostrarlos u ocultarlos según sus
     * dependencias sin rehacer la pantalla.
     * @type {Map<string, HTMLElement>}
     * @private
     */
    this._filas = new Map();
  }

  /**
   * @param {Object} ajustes
   * @returns {HTMLElement}
   * @protected
   */
  render(ajustes = {}) {
    this._filas.clear();

    // Agrupación por sección, conservando el orden del catálogo.
    /** @type {Map<string, Array<Object>>} */
    const secciones = new Map();
    for (const def of AJUSTES) {
      if (!secciones.has(def.seccion)) secciones.set(def.seccion, []);
      secciones.get(def.seccion).push(def);
    }

    const bloques = [];
    for (const [nombre, definiciones] of secciones) {
      bloques.push(
        h('div.stack.stack--sm', {},
          h('h5', { text: nombre }),
          ...definiciones.map((def) => this._crearFila(def, ajustes)),
        ),
      );

      // Aviso de credenciales bajo la sección del director.
      if (nombre === 'Director de juego') {
        bloques.push(h('p.settings__note', { text: CREDENCIALES.aviso }));
      }
    }

    return h('div.settings', {},
      h('div.row.row--between', {},
        h('h1', { text: TEXTOS.menu.ajustes }),
        h('button.btn.btn--ghost', {
          type: 'button',
          onClick: () => this._volver(),
        }, icono('cerrar'), h('span', { text: 'Volver' })),
      ),

      h('div.filo'),
      ...bloques,
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
     CONSTRUCCIÓN DE CONTROLES
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Crea la fila de un ajuste: etiqueta, descripción y control.
   * @param {Object} def
   * @param {Object} ajustes
   * @returns {HTMLElement}
   * @private
   */
  _crearFila(def, ajustes) {
    const valor = def.ruta ? this._leerRuta(ajustes, def.ruta) : '';
    const idControl = id('set');

    const fila = h('div.setting', { dataset: { ajuste: def.id } },
      h('div', {},
        h('label.setting__label', { attrs: { for: idControl }, text: def.etiqueta }),
        def.descripcion ? h('p.setting__desc', { text: def.descripcion }) : null,
      ),
      h('div.setting__control', {}, this._crearControl(def, valor, idControl)),
    );

    this._filas.set(def.id, fila);
    this._aplicarVisibilidad(def, fila, ajustes);
    return fila;
  }

  /**
   * Despacha al constructor adecuado según el tipo declarado.
   * @param {Object} def
   * @param {*} valor
   * @param {string} idControl
   * @returns {HTMLElement}
   * @private
   */
  _crearControl(def, valor, idControl) {
    switch (def.tipo) {
      case 'switch': return this._interruptor(def, valor, idControl);
      case 'select': return this._desplegable(def, valor, idControl);
      case 'range': return this._deslizador(def, valor, idControl);
      case 'password': return this._campo(def, '', idControl, 'password');
      default: return this._campo(def, valor, idControl, 'text');
    }
  }

  /**
   * @private
   */
  _interruptor(def, valor, idControl) {
    return h('button.switch', {
      id: idControl,
      type: 'button',
      attrs: { role: 'switch', 'aria-checked': String(Boolean(valor)) },
      onClick: (e) => this._alternar(def, e.currentTarget),
    });
  }

  /**
   * @private
   */
  _desplegable(def, valor, idControl) {
    const opciones = def.opcionesDinamicas === 'proveedores'
      ? Object.entries(CATALOGO_PROVEEDORES).map(([clave, meta]) => ({ valor: clave, etiqueta: meta.nombre }))
      : (def.opciones ?? []);

    return h('select.input.select', {
      id: idControl,
      onChange: (e) => this._guardar(def, e.target.value),
    },
      ...opciones.map((o) => h('option', {
        value: o.valor,
        text: o.etiqueta,
        selected: o.valor === valor,
      })),
    );
  }

  /**
   * @private
   */
  _deslizador(def, valor, idControl) {
    const salida = h('span', {
      text: String(valor),
      style: { fontFamily: 'var(--f-mono)', fontSize: 'var(--f-xs)', minWidth: '3ch' },
    });

    return h('div.row', {},
      h('input', {
        id: idControl,
        type: 'range',
        min: String(def.min ?? 0),
        max: String(def.max ?? 100),
        step: String(def.paso ?? 1),
        value: String(valor),
        style: { flex: '1' },
        onInput: (e) => {
          fijarTexto(salida, e.target.value);
          this._guardar(def, Number(e.target.value));
        },
      }),
      salida,
    );
  }

  /**
   * @private
   */
  _campo(def, valor, idControl, tipo) {
    const proveedor = this.leer('settings.proveedorIA');
    const meta = CATALOGO_PROVEEDORES[proveedor];

    // El marcador sugiere un ejemplo del proveedor activo, cuando lo tiene.
    let marcador = '';
    if (def.id === 'urlProveedor') marcador = meta?.urlEjemplo ?? '';
    if (def.id === 'modeloProveedor') marcador = meta?.modeloEjemplo ?? '';

    return h('input.input', {
      id: idControl,
      type: tipo,
      value: String(valor ?? ''),
      placeholder: marcador,
      autocomplete: tipo === 'password' ? 'off' : 'on',
      spellcheck: false,
      onChange: (e) => {
        if (def.volatil) this._guardarVolatil(def, e.target.value);
        else this._guardar(def, e.target.value);
      },
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     GUARDADO DE VALORES
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Alterna un interruptor, con confirmación si el ajuste la exige.
   * @param {Object} def
   * @param {HTMLElement} boton
   * @private
   */
  async _alternar(def, boton) {
    const actual = boton.getAttribute('aria-checked') === 'true';
    const nuevo = !actual;

    // El guardado en LocalStorage requiere consentimiento informado.
    if (nuevo && def.confirmarActivacion) {
      const seguro = await this.ui?.confirmar(def.textoConfirmacion ?? '¿Continuar?', {
        titulo: def.etiqueta,
        si: 'Activar',
        no: TEXTOS.confirmaciones.cancelar,
      });
      if (!seguro) return;
    }

    atributo(boton, 'aria-checked', String(nuevo));
    this._guardar(def, nuevo);
  }

  /**
   * Persiste el valor en el estado.
   * @param {Object} def
   * @param {*} valor
   * @private
   */
  _guardar(def, valor) {
    if (!def.ruta) return;

    this.store.fijar(def.ruta, valor);

    // Los ajustes que se reflejan en el documento se aplican al vuelo.
    if (def.atributoHtml) {
      document.documentElement.setAttribute(def.atributoHtml, String(valor));
    }

    this.emitir('settings:change', { id: def.id, valor });

    // Cambiar de proveedor puede revelar u ocultar otros campos.
    if (def.id === 'proveedorIA') this._revisarVisibilidad();
  }

  /**
   * Entrega un valor volátil directamente a quien corresponda, SIN pasar por el
   * estado ni por el guardado. Es el caso de la clave de acceso.
   * @param {Object} def
   * @param {string} valor
   * @private
   */
  _guardarVolatil(def, valor) {
    this.emitir('ai:credential:set', { valor });
    if (valor) {
      this.ui?.avisar('Clave aceptada. Se perderá al recargar.', { tipo: 'info' });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     VISIBILIDAD CONDICIONAL
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Oculta una fila si su dependencia no se cumple.
   * @param {Object} def
   * @param {HTMLElement} fila
   * @param {Object} ajustes
   * @private
   */
  _aplicarVisibilidad(def, fila, ajustes) {
    if (!def.dependeDe) return;

    const valorPadre = this._leerRuta(ajustes, `settings.${def.dependeDe}`);

    const visibleAhora = def.visibleSi
      ? def.visibleSi.includes(valorPadre)
      : Boolean(valorPadre);

    visible(fila, visibleAhora);
  }

  /** Revisa todas las dependencias tras un cambio. @private */
  _revisarVisibilidad() {
    const ajustes = this.leer('settings');
    for (const def of AJUSTES) {
      const fila = this._filas.get(def.id);
      if (fila) this._aplicarVisibilidad(def, fila, ajustes);
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     AUXILIARES
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Lee una ruta con puntos partiendo del estado completo.
   * Las rutas del catálogo incluyen el prefijo 'settings.', pero aquí se recibe
   * ya la rama; se recorta el prefijo para evitar duplicarlo.
   * @param {Object} ajustes
   * @param {string} ruta
   * @returns {*}
   * @private
   */
  _leerRuta(ajustes, ruta) {
    const limpia = ruta.startsWith('settings.') ? ruta.slice(9) : ruta;
    let nodo = ajustes;
    for (const tramo of limpia.split('.')) {
      nodo = nodo?.[tramo];
      if (nodo === undefined) return undefined;
    }
    return nodo;
  }

  /**
   * Vuelve a la pantalla anterior: al juego si hay partida, al menú si no.
   * @private
   */
  _volver() {
    const hayPartida = Boolean(this.leer('meta.id'));
    this.ui?.irA(hayPartida ? PANTALLAS.JUEGO : PANTALLAS.MENU);
  }

  /**
   * Un cambio externo del estado no debe rehacer la pantalla mientras se está
   * escribiendo en un campo: eso perdería el foco y el cursor.
   * @returns {boolean}
   * @protected
   */
  actualizar() {
    this._revisarVisibilidad();
    return true;
  }
}

export default SettingsScreen;
