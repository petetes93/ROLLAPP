/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · ui/components/ItemActions.js
 * ---------------------------------------------------------------------------
 * Menú contextual de acciones sobre un objeto.
 *
 * Aparece con clic derecho o Alt+clic sobre una entrada del inventario. Las
 * acciones se calculan según el objeto concreto: una poción se consume, un arma
 * se equipa, un objeto de misión no se suelta.
 *
 * El menú se posiciona junto al cursor sin salirse de la ventana, se cierra al
 * hacer clic fuera o con Escape, y confina el foco mientras está abierto.
 *
 * Dependencias: Component, DOM, módulos de inventario.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Component } from '../Component.js';
import { h, icono, qs, enfocar, atraparFoco, aplicarEstilos } from '../DOM.js';
import * as Item from '../../inventory/Item.js';
import * as Durabilidad from '../../inventory/Durability.js';
import { SELECTORES } from '../../config/ui.config.js';

/** Separación del cursor, en píxeles. */
const MARGEN = 6;

export class ItemActions extends Component {
  static nombre = 'acciones-objeto';
  static rama = '';

  constructor(contexto, opciones) {
    super(contexto, opciones);

    /** @type {HTMLElement|null} @private */
    this._menu = null;
    /** @type {Function|null} @private */
    this._liberarFoco = null;
    /** @type {Object|null} @private */
    this._objeto = null;
  }

  /** @returns {HTMLElement} @protected */
  render() {
    return h('div.item-actions-host', { ref: this.ref('raiz') });
  }

  /** @protected */
  alMontar() {
    if (this.el) this.el.style.pointerEvents = 'none';

    this.escuchar('ui:item:menu', ({ objeto, x, y }) => this.abrir(objeto, x, y));

    // Un clic en cualquier otro sitio cierra el menú.
    this.on(document, 'pointerdown', (e) => {
      if (!this._menu) return;
      if (!this._menu.contains(e.target)) this.cerrar();
    });

    this.on(document, 'keydown', (e) => {
      if (e.key === 'Escape' && this._menu) {
        e.stopPropagation();
        this.cerrar();
      }
    });

    // Cualquier cambio de estado invalida el menú abierto: las acciones
    // disponibles podrían haber cambiado.
    this.observar('inventory.objetos', () => this.cerrar());
  }

  /* ─────────────────────────────────────────────────────────────────────────
     APERTURA
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Abre el menú para un objeto.
   *
   * @param {Object} objeto
   * @param {number} [x] Coordenada del cursor.
   * @param {number} [y]
   */
  abrir(objeto, x, y) {
    this.cerrar();
    if (!objeto) return;

    this._objeto = objeto;
    const acciones = this._accionesDe(objeto);

    this._menu = h('div.popup', {
      attrs: { role: 'menu', 'aria-label': `Acciones de ${objeto.nombre}` },
      style: {
        position: 'fixed',
        left: '0px',
        top: '0px',
        transform: 'none',
        width: 'min(240px, 90vw)',
        pointerEvents: 'auto',
      },
    },
      h('div.popup__head', { text: objeto.nombre }),

      h('div', { style: { display: 'grid', gap: 'var(--sp-1)', padding: 'var(--sp-2)' } },
        ...acciones.map((a) => h('button.choice', {
          type: 'button',
          disabled: !a.disponible,
          attrs: { role: 'menuitem', title: a.motivo ?? '' },
          style: {
            justifyContent: 'flex-start',
            width: '100%',
            borderRadius: 'var(--r-sm)',
            opacity: a.disponible ? '1' : '0.4',
            ...(a.peligrosa ? { borderColor: 'rgb(197 69 60 / 0.45)' } : {}),
          },
          onClick: () => this._ejecutar(a),
        },
          icono(a.icono, { class: 'icon--sm' }),
          h('span', { text: a.nombre }),
          a.detalle
            ? h('span', {
                style: { marginLeft: 'auto', fontSize: 'var(--f-2xs)', color: 'var(--c-texto-tenue)' },
                text: a.detalle,
              })
            : null,
        )),
      ),
    );

    document.body.appendChild(this._menu);
    this._posicionar(x, y);

    this._liberarFoco = atraparFoco(this._menu);

    const primero = this._menu.querySelector('button:not([disabled])');
    if (primero) requestAnimationFrame(() => enfocar(primero));
  }

  /**
   * Coloca el menú junto al cursor sin salirse de la ventana.
   * @param {number} [x]
   * @param {number} [y]
   * @private
   */
  _posicionar(x, y) {
    if (!this._menu) return;

    const r = this._menu.getBoundingClientRect();
    const anchoVentana = window.innerWidth;
    const altoVentana = window.innerHeight;

    // Sin coordenadas, se centra sobre el panel izquierdo.
    if (x === undefined || y === undefined) {
      const panel = qs(SELECTORES.paneles.izquierdo);
      const pr = panel?.getBoundingClientRect();
      x = pr ? pr.left + pr.width / 2 : anchoVentana / 2;
      y = pr ? pr.top + 120 : altoVentana / 2;
    }

    let left = x + MARGEN;
    let top = y + MARGEN;

    if (left + r.width > anchoVentana - MARGEN) left = x - r.width - MARGEN;
    if (top + r.height > altoVentana - MARGEN) top = altoVentana - r.height - MARGEN;

    left = Math.max(MARGEN, left);
    top = Math.max(MARGEN, top);

    aplicarEstilos(this._menu, { left: `${Math.round(left)}px`, top: `${Math.round(top)}px` });
  }

  /** Cierra el menú. */
  cerrar() {
    this._liberarFoco?.();
    this._liberarFoco = null;
    this._menu?.remove();
    this._menu = null;
    this._objeto = null;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     ACCIONES DISPONIBLES
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Calcula las acciones aplicables a un objeto.
   *
   * Una acción no disponible se muestra atenuada con su motivo, en vez de
   * ocultarse: así el jugador entiende por qué no puede hacer algo.
   *
   * @param {Object} objeto
   * @returns {Array<Object>}
   * @private
   */
  _accionesDe(objeto) {
    const acciones = [];
    const roto = Durabilidad.estaRoto(objeto);
    const oro = this.leer('player.oro', 0);

    // — Consumir —
    if (Item.esConsumible(objeto)) {
      acciones.push({
        clave: 'consumir',
        nombre: 'Usar',
        icono: 'pocion',
        disponible: true,
        detalle: objeto.cantidad > 1 ? `×${objeto.cantidad}` : null,
      });
    }

    // — Equipar o desequipar —
    if (Item.esEquipable(objeto)) {
      if (objeto.equipado) {
        acciones.push({ clave: 'desequipar', nombre: 'Quitar', icono: 'cerrar', disponible: true });
      } else {
        acciones.push({
          clave: 'equipar',
          nombre: 'Equipar',
          icono: 'escudo',
          disponible: !roto,
          motivo: roto ? 'Está roto: repáralo primero' : null,
        });
      }
    }

    // — Reparar —
    if (objeto.tieneDurabilidad) {
      const coste = Durabilidad.costeReparacion(objeto);

      if (coste.posible) {
        acciones.push({
          clave: 'repararCampo',
          nombre: 'Apañar aquí',
          icono: 'bolsa',
          disponible: true,
          detalle: 'prueba',
          motivo: 'Restaura poco y reduce la durabilidad máxima',
        });

        acciones.push({
          clave: 'reparar',
          nombre: 'Reparar',
          icono: 'espada',
          disponible: oro >= coste.coste,
          detalle: `${coste.coste} oro`,
          motivo: oro < coste.coste ? 'No tienes suficiente oro' : 'Requiere un herrero',
        });
      }
    }

    // — Examinar —
    acciones.push({ clave: 'examinar', nombre: 'Examinar', icono: 'ojo', disponible: true });

    // — Soltar —
    const plantilla = Item.plantilla(objeto);
    const irreemplazable = plantilla?.propiedades?.includes('irreemplazable');

    acciones.push({
      clave: 'soltar',
      nombre: 'Tirar',
      icono: 'huir',
      disponible: !objeto.esMision,
      peligrosa: true,
      detalle: objeto.cantidad > 1 ? 'todo' : null,
      motivo: objeto.esMision
        ? 'Es parte de tu misión'
        : irreemplazable
          ? 'No podrás recuperarlo nunca'
          : null,
    });

    return acciones;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     EJECUCIÓN
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * @param {Object} accion
   * @private
   */
  async _ejecutar(accion) {
    if (!accion.disponible || !this._objeto) return;

    const objeto = this._objeto;
    this.cerrar();

    switch (accion.clave) {
      case 'consumir':
        this.despachar('inventory/consumir', { idObjeto: objeto.id });
        break;

      case 'equipar':
        this.despachar('inventory/equipar', { idObjeto: objeto.id });
        break;

      case 'desequipar': {
        const equipado = this.leer('inventory.equipado', {});
        const ranura = Object.keys(equipado).find((r) => equipado[r] === objeto.id);
        if (ranura) this.despachar('inventory/desequipar', { ranura });
        break;
      }

      case 'reparar': {
        const coste = Durabilidad.costeReparacion(objeto);
        const seguro = await this.ui?.confirmar(
          `Reparar ${objeto.nombre} costará ${coste.coste} de oro. ¿Continuar?`,
          { titulo: 'Reparar', si: 'Reparar', no: 'Cancelar' },
        );
        if (seguro) {
          this.despachar('inventory/reparar', { idObjeto: objeto.id, coste: coste.coste });
        }
        break;
      }

      case 'repararCampo':
        // Un apaño requiere una prueba de artesanía: se delega al motor de
        // reglas, que resolverá la tirada y devolverá el margen.
        this.emitir('rules:check', {
          habilidad: 'artesania',
          umbral: 'moderada',
          alResolver: (resultado) => {
            if (resultado.exito) {
              this.despachar('inventory/reparar', {
                idObjeto: objeto.id,
                enCampo: true,
                margen: resultado.margen ?? 0,
              });
            } else {
              this.ui?.avisar('No consigues arreglarlo', { tipo: 'aviso' });
            }
          },
        });
        break;

      case 'examinar':
        this._examinar(objeto);
        break;

      case 'soltar': {
        const plantilla = Item.plantilla(objeto);
        const irreemplazable = plantilla?.propiedades?.includes('irreemplazable');

        const seguro = await this.ui?.confirmar(
          irreemplazable
            ? `${objeto.nombre} es irremplazable. Si lo tiras, no habrá otro. ¿Seguro?`
            : `¿Tirar ${Item.nombreConCantidad(objeto)}?`,
          { titulo: 'Tirar', si: 'Tirar', no: 'Cancelar', peligroso: true },
        );

        if (seguro) {
          this.despachar('inventory/soltar', { idObjeto: objeto.id, cantidad: objeto.cantidad });
        }
        break;
      }
    }
  }

  /**
   * Muestra la ficha completa del objeto en un modal.
   *
   * Además publica el examen en la bitácora: mirar algo con atención es una
   * acción de juego, y el director puede querer decir algo al respecto.
   *
   * @param {Object} objeto
   * @private
   */
  _examinar(objeto) {
    const f = Item.ficha(objeto);

    const cuerpo = h('div.stack.stack--sm', {},
      h('p', {
        style: { fontStyle: 'italic', color: 'var(--c-texto-narrativa)' },
        text: objeto.descripcionPropia ?? f.descripcion,
      }),

      h('div.filo'),

      h('div.row.row--between', {},
        h('span.eyebrow', { text: 'Rareza' }),
        h('span', {
          style: { color: `var(--rar-${objeto.rareza})` },
          text: f.metaRareza.nombre,
        }),
      ),

      h('div.row.row--between', {},
        h('span.eyebrow', { text: 'Peso' }),
        h('span', { text: `${f.peso}` }),
      ),

      h('div.row.row--between', {},
        h('span.eyebrow', { text: 'Valor' }),
        h('span', { text: `${f.valor} de oro` }),
      ),

      f.durabilidad.visible
        ? h('div.row.row--between', {},
            h('span.eyebrow', { text: 'Estado' }),
            h('span', {
              style: { color: `var(--c-${f.durabilidad.estado.color})` },
              text: `${f.durabilidad.estado.nombre} · ${f.durabilidad.texto}`,
            }),
          )
        : null,

      f.afijos.length
        ? h('div.stack.stack--sm', {},
            h('div.filo'),
            h('span.eyebrow', { text: 'Propiedades' }),
            ...f.afijos.map((a) => h('p', {},
              h('strong', { style: { color: 'var(--c-acento)' }, text: a.nombre }),
              h('span', { class: 'pick__desc', text: ` — ${a.descripcion}` }),
            )),
          )
        : null,
    );

    this.ui?.abrirModal({
      titulo: objeto.nombre,
      contenido: cuerpo,
      icono: objeto.categoria === 'arma' ? 'espada' : 'bolsa',
      botones: [{ etiqueta: 'Cerrar', valor: true, primario: true }],
    });

    // El director puede tener algo que decir sobre lo que se está mirando.
    const paraDirector = Item.paraDirector(objeto);
    if (paraDirector) {
      this.emitir('narrative:examine', { objeto: objeto.nombre, contexto: paraDirector });
    }
  }

  /** @protected */
  alDestruir() {
    this.cerrar();
  }
}

export default ItemActions;
