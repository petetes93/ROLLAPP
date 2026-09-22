/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ui/components/InventoryPanel.js
 * ---------------------------------------------------------------------------
 * Lista de inventario con filtros, orden y barra de carga.
 *
 * La barra de carga va arriba y a la vista porque el peso es una mecánica, no
 * un dato de consulta. Cuando cambia de color, el jugador debe enterarse sin
 * buscar.
 *
 * Los eventos se manejan por delegación: da igual que haya cinco objetos o
 * cuarenta, el coste es un oyente.
 *
 * Dependencias: Component, DOM, Panel, StatBar, módulos de inventario.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Component } from '../Component.js';
import { h, icono, vaciar, texto as fijarTexto, atributo } from '../DOM.js';
import { cabecera, vacio } from './Panel.js';
import { StatBar } from './StatBar.js';
import * as Item from '../../inventory/Item.js';
import * as Carga from '../../inventory/Encumbrance.js';
import * as Durabilidad from '../../inventory/Durability.js';
import { meta as metaRareza } from '../../inventory/Rarity.js';
import { LIMITES } from '../../config/app.config.js';
import { TEXTOS } from '../../config/ui.config.js';

/** Filtros disponibles. */
const FILTROS = Object.freeze([
  { clave: 'todo', nombre: 'Todo', icono: 'bolsa' },
  { clave: 'arma', nombre: 'Armas', icono: 'espada', categorias: ['arma'] },
  { clave: 'armadura', nombre: 'Protección', icono: 'escudo', categorias: ['armadura', 'escudo'] },
  { clave: 'consumible', nombre: 'Consumibles', icono: 'pocion', categorias: ['consumible'] },
  { clave: 'otro', nombre: 'Varios', icono: 'pergamino', categorias: ['util', 'material', 'magico'] },
]);

export class InventoryPanel extends Component {
  static nombre = 'inventario';
  static rama = 'inventory';

  constructor(contexto, opciones) {
    super(contexto, opciones);

    /** @private */
    this._filtro = 'todo';
    /** @type {StatBar|null} @private */
    this._barraCarga = null;
  }

  /**
   * @param {Object} inventario
   * @returns {Node}
   * @protected
   */
  render(inventario) {
    const jugador = this.leer('player');
    const datosCarga = Carga.paraInterfaz(jugador, inventario);
    const objetos = this._filtrar(inventario);

    this._barraCarga = new StatBar({
      clave: 'carga',
      etiqueta: `Carga · ${datosCarga.etiqueta}`,
      icono: 'bolsa',
      actual: datosCarga.actual,
      max: datosCarga.maximo,
      delgada: true,
      // La barra de carga se lee al revés que las demás: llena es malo.
      umbralAlerta: 0.3,
      umbralCritico: 0.1,
      formato: 'razon',
    });

    const nodoBarra = this._barraCarga.render();
    atributo(nodoBarra, 'data-level', datosCarga.nivel);

    return h('div.stack.stack--sm.grow', { style: { minHeight: 0 } },
      cabecera({
        titulo: TEXTOS.paneles.inventario,
        icono: 'bolsa',
        contador: `${inventario.objetos?.orden?.length ?? 0}/${LIMITES.inventarioRanuras}`,
      }),

      nodoBarra,

      datosCarga.modificador !== 0
        ? h('p.attralloc__hint', {
            ref: this.ref('avisoCarga'),
            style: { color: 'var(--c-aviso)', textAlign: 'center' },
            text: `${datosCarga.modificador} a todas las tiradas`,
          })
        : null,

      // Oro
      h('div.row.row--between', { style: { padding: '0 var(--sp-1)' } },
        h('span.row', {}, icono('oro', { class: 'icon--sm icon--gold' }),
          h('span.eyebrow', { text: 'Oro' })),
        h('span', {
          ref: this.ref('oro'),
          style: { fontFamily: 'var(--f-mono)', color: 'var(--c-oro-moneda)' },
          text: String(jugador?.oro ?? 0),
        }),
      ),

      // Filtros
      h('div.actionbar__quick', { ref: this.ref('filtros') },
        ...FILTROS.map((f) => h('button.choice', {
          type: 'button',
          dataset: { filtro: f.clave },
          style: this._filtro === f.clave
            ? { borderColor: 'var(--c-acento)', color: 'var(--c-acento-claro)' }
            : {},
          attrs: { title: f.nombre },
          onClick: () => { this._filtro = f.clave; this.refrescar(); },
        }, icono(f.icono, { class: 'icon--sm' }))),
      ),

      // Lista
      h('div.itemlist.grow', { ref: this.ref('lista') },
        objetos.length
          ? objetos.map((o) => this._fila(o))
          : vacio(this._mensajeVacio()),
      ),
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
     FILA DE OBJETO
     ───────────────────────────────────────────────────────────────────────── */

  /** @private */
  _fila(objeto) {
    const dur = Durabilidad.paraInterfaz(objeto);
    const rareza = metaRareza(objeto.rareza);

    return h('button', {
      class: ['item', rareza.clase, objeto.equipado ? 'is-equipped' : ''].filter(Boolean).join(' '),
      type: 'button',
      dataset: {
        objeto: objeto.id,
        tooltipTipo: 'objeto',
        tooltipRef: objeto.id,
      },
    },
      icono(this._iconoDe(objeto), { class: 'item__icon icon--sm' }),

      h('span.item__name.truncate', { text: objeto.nombre }),

      // Aro de durabilidad, solo si el objeto lo tiene.
      dur.visible
        ? h('span.item__dur', {
            style: { '--dur': String(dur.porcentaje) },
            dataset: {
              worn: dur.estado.clave === 'roto' ? 'broken'
                : dur.estado.clave === 'desgastado' || dur.estado.clave === 'critico' ? 'true'
                : 'false',
            },
          })
        : null,

      objeto.cantidad > 1
        ? h('span.item__qty', { text: `×${objeto.cantidad}` })
        : null,

      objeto.equipado
        ? icono('escudo', { class: 'icon--sm icon--gold' })
        : null,
    );
  }

  /** @private */
  _iconoDe(objeto) {
    const mapa = {
      arma: 'espada',
      armadura: 'escudo',
      escudo: 'escudo',
      consumible: 'pocion',
      magico: 'mana',
      util: 'pergamino',
      material: 'bolsa',
    };
    return mapa[objeto.categoria] ?? 'bolsa';
  }

  /* ─────────────────────────────────────────────────────────────────────────
     FILTRADO Y ORDEN
     ───────────────────────────────────────────────────────────────────────── */

  /** @private */
  _filtrar(inventario) {
    const orden = inventario?.objetos?.orden ?? [];
    const porId = inventario?.objetos?.porId ?? {};

    let objetos = orden.map((id) => porId[id]).filter(Boolean);

    const filtro = FILTROS.find((f) => f.clave === this._filtro);
    if (filtro?.categorias) {
      objetos = objetos.filter((o) => filtro.categorias.includes(o.categoria));
    }

    // Lo equipado siempre arriba: es lo que más se consulta.
    return objetos.sort((a, b) => {
      if (a.equipado !== b.equipado) return a.equipado ? -1 : 1;
      return 0;
    });
  }

  /** @private */
  _mensajeVacio() {
    if (this._filtro === 'todo') return TEXTOS.vacios.inventario;
    const nombre = FILTROS.find((f) => f.clave === this._filtro)?.nombre ?? '';
    return `No llevas nada de ${nombre.toLowerCase()}.`;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     INTERACCIÓN
     ───────────────────────────────────────────────────────────────────────── */

  /** @protected */
  alMontar() {
    // Delegación: un oyente para toda la lista, se llene lo que se llene.
    this.delegar(this.el, 'click', '[data-objeto]', (e, objetivo) => {
      const id = objetivo.dataset.objeto;
      const objeto = this.leer(`inventory.objetos.porId.${id}`);
      if (!objeto) return;

      // Clic normal usa o equipa; clic con Alt abre el menú de acciones.
      if (e.altKey) {
        this.emitir('ui:item:menu', { objeto, x: e.clientX, y: e.clientY });
        return;
      }
      this._accionPrincipal(objeto);
    });

    // Menú contextual con clic derecho.
    this.delegar(this.el, 'contextmenu', '[data-objeto]', (e, objetivo) => {
      e.preventDefault();
      const objeto = this.leer(`inventory.objetos.porId.${objetivo.dataset.objeto}`);
      if (objeto) this.emitir('ui:item:menu', { objeto, x: e.clientX, y: e.clientY });
    });

    // El tooltip pide la ficha del objeto a través de este proveedor.
    this.ui?.tooltip?.registrar('objeto', (idObjeto) => {
      const objeto = this.leer(`inventory.objetos.porId.${idObjeto}`);
      return objeto ? this._fichaTooltip(objeto) : null;
    });

    // Avisos de carga y de rotura llegan por el bus.
    this.escuchar('inventory:encumbrance', ({ nombre, modificador }) => {
      this.ui?.avisar(`Ahora vas ${nombre.toLowerCase()} (${modificador} a las tiradas)`, { tipo: 'aviso' });
    });

    this.escuchar('inventory:broken', ({ mensaje, tipo }) => {
      this.ui?.avisar(mensaje, { tipo });
    });

    this.escuchar('inventory:added', ({ mencion }) => {
      this.ui?.avisar(`Has obtenido ${mencion}`, { tipo: 'loot', icono: 'bolsa' });
    });
  }

  /**
   * Acción por defecto de un objeto: equipar si es equipable, consumir si es
   * consumible, nada si no es ninguna de las dos cosas.
   * @param {Object} objeto
   * @private
   */
  _accionPrincipal(objeto) {
    if (Item.esConsumible(objeto)) {
      this.despachar('inventory/consumir', { idObjeto: objeto.id });
      return;
    }

    if (Item.esEquipable(objeto)) {
      if (objeto.equipado) {
        const equipado = this.leer('inventory.equipado', {});
        const ranura = Object.keys(equipado).find((r) => equipado[r] === objeto.id);
        if (ranura) this.despachar('inventory/desequipar', { ranura });
      } else {
        this.despachar('inventory/equipar', { idObjeto: objeto.id });
      }
      return;
    }

    this.emitir('ui:item:menu', { objeto });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     TOOLTIP
     ───────────────────────────────────────────────────────────────────────── */

  /** @private */
  _fichaTooltip(objeto) {
    const f = Item.ficha(objeto);
    const filas = [];

    if (f.estadisticas.dano) {
      const d = f.estadisticas.dano;
      const bono = f.estadisticas.bonoDano ?? 0;
      filas.push({
        texto: `Daño: ${d.notacion}${bono ? (bono > 0 ? ` +${bono}` : ` ${bono}`) : ''} ${d.tipo}`,
        clase: 'plus',
      });
    }
    if (f.estadisticas.defensa) {
      filas.push({ texto: `Defensa: +${f.estadisticas.defensa}`, clase: 'plus' });
    }
    if (f.estadisticas.reduccion) {
      filas.push({ texto: `Reducción: −${f.estadisticas.reduccion} de daño`, clase: 'plus' });
    }

    for (const [habilidad, valor] of Object.entries(f.estadisticas.bonosHabilidad ?? {})) {
      filas.push({
        texto: `${habilidad}: ${valor > 0 ? '+' : ''}${valor}`,
        clase: valor > 0 ? 'plus' : 'minus',
      });
    }

    if (f.estadisticas.penalizacionDesgaste < 0) {
      filas.push({ texto: `Desgaste: ${f.estadisticas.penalizacionDesgaste}`, clase: 'minus' });
    }

    return h('div', { style: { '--item-color': `var(--rar-${objeto.rareza})` } },
      h('div.tooltip__name', { text: f.nombre }),
      h('div.tooltip__type', {
        text: `${f.metaRareza.nombre} · ${f.categoria}${f.subtipo ? ` · ${f.subtipo}` : ''}`,
      }),

      filas.length
        ? h('div.tooltip__stats', {},
            ...filas.map((r) => h('span', { class: `tooltip__stat--${r.clase}`, text: r.texto })),
          )
        : null,

      f.afijos.length
        ? h('div.tooltip__stats', {},
            ...f.afijos.map((a) => h('span', {
              style: { color: 'var(--c-acento)' },
              text: `${a.nombre}: ${a.descripcion}`,
            })),
          )
        : null,

      h('div.tooltip__desc', { text: objeto.descripcionPropia ?? f.descripcion }),

      h('div.tooltip__stats', {},
        h('span', { text: `Peso ${f.peso} · Valor ${f.valor} oro` }),
        f.durabilidad.visible
          ? h('span', {
              style: { color: `var(--c-${f.durabilidad.estado.color})` },
              text: `Estado: ${f.durabilidad.estado.nombre} (${f.durabilidad.texto})`,
            })
          : null,
        f.irreemplazable
          ? h('span', { style: { color: 'var(--c-acento)' }, text: 'Irremplazable' })
          : null,
        f.ilegal
          ? h('span', { style: { color: 'var(--c-peligro)' }, text: 'Portarlo es delito' })
          : null,
      ),
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
     ACTUALIZACIÓN
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * @param {Object} inventario
   * @param {Object} anterior
   * @returns {boolean}
   * @protected
   */
  actualizar(inventario, anterior) {
    // Un cambio en la lista de objetos obliga a rehacer las filas.
    if (inventario?.objetos !== anterior?.objetos) return false;
    if (inventario?.equipado !== anterior?.equipado) return false;

    // Solo cambió la carga: se actualiza la barra sin tocar la lista.
    const jugador = this.leer('player');
    const datos = Carga.paraInterfaz(jugador, inventario);

    this._barraCarga?.actualizar(datos.actual, datos.maximo);
    fijarTexto(this.refs.oro, String(jugador?.oro ?? 0));

    return true;
  }

  /** @protected */
  alDestruir() {
    this._barraCarga = null;
  }
}

export default InventoryPanel;
