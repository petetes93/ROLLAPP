/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · npc/MerchantSystem.js
 * ---------------------------------------------------------------------------
 * Inventarios de los mercaderes.
 *
 * Un mercader no vende de todo ni tiene existencias infinitas. Este sistema le
 * da a cada uno un catálogo propio con tres propiedades:
 *
 *   · ESPECIALIDAD — un herrero vende acero, una posadera comida. El surtido
 *     sale de su oficio y de la región.
 *   · EXISTENCIAS FINITAS — comprar agota. Vaciar la tienda es posible.
 *   · REPOSICIÓN CON EL TIEMPO — el surtido se renueva cada varios días, con
 *     variación. Volver a la semana siguiente encuentra cosas distintas.
 *
 * La reposición es lo que convierte una tienda en un sitio al que merece la
 * pena volver. Sin ella, el jugador la vacía una vez y la olvida.
 *
 * Los objetos comprados al jugador entran en el catálogo: si le vendes una
 * espada al herrero, ahí está si te arrepientes. Cuesta más recuperarla, claro.
 *
 * Dependencias: SystemBase, ItemFactory, items.data, locations.data.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SystemBase } from '../core/SystemBase.js';
import { desdePlantilla, generar as generarObjeto } from '../inventory/ItemFactory.js';
import { OBJETOS_BASE, porCategoria } from '../data/items.data.js';
import { obtenerLugar } from '../data/locations.data.js';
import { ECONOMIA } from '../config/balance.config.js';

/** Eventos publicados. */
export const EVENTOS_MERCADER = Object.freeze({
  CATALOGO: 'merchant:stock',
  REPUESTO: 'merchant:restocked',
  AGOTADO: 'merchant:soldout',
});

/** Días entre reposiciones del surtido. */
const DIAS_REPOSICION = 6;

/* ═══════════════════════════════════════════════════════════════════════════
   SURTIDOS POR OFICIO
   ---------------------------------------------------------------------------
   Qué vende cada uno y en qué proporción. `piezas` acota el tamaño del catálogo
   para que revisarlo no sea una tarea.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Surtido
 * @property {Record<string, number>} categorias Peso de cada categoría.
 * @property {[number, number]} piezas Cuántas entradas distintas.
 * @property {number} rarezaMax Índice máximo de rareza que maneja.
 * @property {[number, number]} oro Rango de fondos.
 * @property {string[]} [garantizados] refIds que siempre tiene.
 */

/** @type {Record<string, Surtido>} */
export const SURTIDOS = Object.freeze({
  herrero: {
    categorias: { arma: 45, armadura: 35, escudo: 10, material: 10 },
    piezas: [5, 9],
    rarezaMax: 3,
    oro: [150, 400],
    garantizados: ['daga', 'cota_ligera'],
  },
  herrera: {
    categorias: { arma: 45, armadura: 35, escudo: 10, material: 10 },
    piezas: [5, 9],
    rarezaMax: 3,
    oro: [150, 400],
    garantizados: ['daga', 'cota_ligera'],
  },
  'aprendiz de forja': {
    categorias: { material: 60, arma: 40 },
    piezas: [2, 4],
    rarezaMax: 1,
    oro: [20, 60],
  },
  mercader: {
    categorias: { consumible: 30, util: 30, arma: 15, armadura: 15, material: 10 },
    piezas: [7, 12],
    rarezaMax: 2,
    oro: [200, 500],
    garantizados: ['racion_viaje', 'odre_agua', 'antorcha'],
  },
  mercadera: {
    categorias: { consumible: 30, util: 30, arma: 15, armadura: 15, material: 10 },
    piezas: [7, 12],
    rarezaMax: 2,
    oro: [200, 500],
    garantizados: ['racion_viaje', 'odre_agua', 'antorcha'],
  },
  'vendedor ambulante': {
    categorias: { consumible: 45, util: 40, material: 15 },
    piezas: [3, 6],
    rarezaMax: 2,
    oro: [40, 120],
    garantizados: ['racion_viaje'],
  },
  posadero: {
    categorias: { consumible: 100 },
    piezas: [2, 4],
    rarezaMax: 0,
    oro: [60, 150],
    garantizados: ['racion_viaje', 'odre_agua'],
  },
  posadera: {
    categorias: { consumible: 100 },
    piezas: [2, 4],
    rarezaMax: 0,
    oro: [60, 150],
    garantizados: ['racion_viaje', 'odre_agua'],
  },
  sanadora: {
    categorias: { consumible: 80, material: 20 },
    piezas: [3, 6],
    rarezaMax: 2,
    oro: [80, 200],
    garantizados: ['pocion_curacion', 'vendas'],
  },
  tasadora: {
    categorias: { magico: 40, util: 30, material: 30 },
    piezas: [3, 5],
    rarezaMax: 4,
    oro: [300, 700],
  },
});

export class MerchantSystem extends SystemBase {
  static nombre = 'merchants';
  static dependencias = ['npcs', 'world'];
  static canal = 'economy';

  constructor(contexto) {
    super(contexto);

    /**
     * Catálogos por mercader.
     * @type {Map<string, {objetos: Array<Object>, oro: number, ultimaReposicion: number}>}
     * @private
     */
    this._catalogos = new Map();
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CICLO DE VIDA
     ═══════════════════════════════════════════════════════════════════════ */

  alIniciar() {
    // Al abrir el comercio se prepara o repone el catálogo.
    this.escuchar('ui:trade:open', ({ npc }) => this.abrir(npc?.refId ?? npc));

    // Lo que el jugador vende entra en el catálogo del mercader.
    this.escuchar('trade:sold', (datos) => this._alRecibir(datos));

    // Lo comprado sale de las existencias.
    this.escuchar('trade:bought', (datos) => this._alEntregar(datos));
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CATÁLOGO
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Abre el comercio con un mercader, generando o reponiendo su catálogo.
   *
   * @param {string} refId
   * @returns {{objetos: Array<Object>, oro: number}|null}
   */
  abrir(refId) {
    const mercader = this.sistema('npcs')?.obtener(refId);

    if (!mercader?.esMercader) {
      this.emitir('narrative:direct', {
        texto: 'No tiene nada que vender.',
        voz: 'system',
      });
      return null;
    }

    const catalogo = this._obtenerCatalogo(mercader);

    this.emitir(EVENTOS_MERCADER.CATALOGO, {
      refId,
      nombre: mercader.nombre,
      objetos: catalogo.objetos.length,
      oro: catalogo.oro,
    });

    return catalogo;
  }

  /**
   * Obtiene el catálogo de un mercader, reponiéndolo si toca.
   *
   * @param {Object} mercader
   * @returns {Object}
   * @private
   */
  _obtenerCatalogo(mercader) {
    const dia = this.leer('world.tiempo.diasTotales', 0);
    const existente = this._catalogos.get(mercader.refId);

    // ─── Primera vez ────────────────────────────────────────────────────
    if (!existente) {
      const nuevo = this._generar(mercader, dia);
      this._catalogos.set(mercader.refId, nuevo);
      return nuevo;
    }

    // ─── ¿Toca reponer? ─────────────────────────────────────────────────
    if (dia - existente.ultimaReposicion >= DIAS_REPOSICION) {
      const repuesto = this._reponer(mercader, existente, dia);
      this._catalogos.set(mercader.refId, repuesto);

      this.emitir(EVENTOS_MERCADER.REPUESTO, {
        refId: mercader.refId,
        nombre: mercader.nombre,
      });

      return repuesto;
    }

    return existente;
  }

  /**
   * Genera un catálogo desde cero.
   *
   * @param {Object} mercader
   * @param {number} dia
   * @returns {Object}
   * @private
   */
  _generar(mercader, dia) {
    const surtido = SURTIDOS[mercader.rol] ?? SURTIDOS.mercader;
    const flujo = this.rng.flujo('botin');

    const objetos = [];

    // ─── Garantizados ───────────────────────────────────────────────────
    // Lo que siempre debe estar: sin esto, un jugador sin comida podría no
    // encontrar dónde comprarla, y eso es frustración pura.
    for (const refId of surtido.garantizados ?? []) {
      const objeto = desdePlantilla(refId, {
        cantidad: flujo.entero(3, 8),
        origen: { tipo: 'mercader' },
      });

      if (objeto) objetos.push({ ...objeto, stock: objeto.cantidad });
    }

    // ─── Surtido variable ───────────────────────────────────────────────
    const cuantas = flujo.entero(surtido.piezas[0], surtido.piezas[1]);
    const lugar = obtenerLugar(this.leer('world.ubicacion'));

    for (let i = 0; i < cuantas; i++) {
      const categoria = flujo.elegirClavePonderada(surtido.categorias);

      const objeto = generarObjeto(flujo, {
        categoria,
        nivelJugador: this.leer('player.nivel', 1),
        terreno: lugar?.terreno,
        rarezaMax: surtido.rarezaMax,
      });

      if (!objeto) continue;

      // Duplicados: se suman a la pila existente en vez de repetir entrada.
      const yaEsta = objetos.find((o) => o.refId === objeto.refId && !o.afijos?.length);

      if (yaEsta) {
        yaEsta.stock += 1;
        continue;
      }

      const stock = objeto.apilable ? flujo.entero(2, 5) : 1;
      objetos.push({ ...objeto, stock });
    }

    return {
      objetos,
      oro: flujo.entero(surtido.oro[0], surtido.oro[1]),
      ultimaReposicion: dia,
    };
  }

  /**
   * Repone un catálogo existente.
   *
   * No se regenera entero: se conserva lo que quedaba y se añade lo nuevo. Así
   * el objeto raro que el jugador no pudo pagar sigue ahí a la vuelta.
   *
   * @param {Object} mercader
   * @param {Object} anterior
   * @param {number} dia
   * @returns {Object}
   * @private
   */
  _reponer(mercader, anterior, dia) {
    const surtido = SURTIDOS[mercader.rol] ?? SURTIDOS.mercader;
    const flujo = this.rng.flujo('botin');

    // Lo que quedaba se conserva.
    const objetos = anterior.objetos.filter((o) => o.stock > 0);

    // Los garantizados se rellenan.
    for (const refId of surtido.garantizados ?? []) {
      const existente = objetos.find((o) => o.refId === refId);

      if (existente) {
        existente.stock = Math.max(existente.stock, flujo.entero(3, 8));
      } else {
        const objeto = desdePlantilla(refId, {
          cantidad: flujo.entero(3, 8),
          origen: { tipo: 'mercader' },
        });
        if (objeto) objetos.push({ ...objeto, stock: objeto.cantidad });
      }
    }

    // Se añaden piezas nuevas hasta acercarse al tope.
    const objetivo = flujo.entero(surtido.piezas[0], surtido.piezas[1]);
    const faltan = Math.max(0, objetivo - objetos.length);

    const lugar = obtenerLugar(this.leer('world.ubicacion'));

    for (let i = 0; i < faltan; i++) {
      const categoria = flujo.elegirClavePonderada(surtido.categorias);

      const objeto = generarObjeto(flujo, {
        categoria,
        nivelJugador: this.leer('player.nivel', 1),
        terreno: lugar?.terreno,
        rarezaMax: surtido.rarezaMax,
      });

      if (objeto) objetos.push({ ...objeto, stock: objeto.apilable ? flujo.entero(2, 5) : 1 });
    }

    // El oro también se recupera, pero no del todo: un mercader al que le has
    // vaciado la caja tarda en rehacerse.
    const oroObjetivo = flujo.entero(surtido.oro[0], surtido.oro[1]);
    const oro = Math.round(anterior.oro + (oroObjetivo - anterior.oro) * 0.6);

    return { objetos, oro: Math.max(anterior.oro, oro), ultimaReposicion: dia };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     MOVIMIENTO DE EXISTENCIAS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * El jugador ha comprado: se descuenta del catálogo.
   * @private
   */
  _alEntregar(datos) {
    const catalogo = this._catalogos.get(datos.refIdMercader);
    if (!catalogo) return;

    const entrada = catalogo.objetos.find((o) => o.nombre === datos.objeto);
    if (!entrada) return;

    entrada.stock = Math.max(0, entrada.stock - (datos.cantidad ?? 1));

    if (entrada.stock === 0) {
      catalogo.objetos = catalogo.objetos.filter((o) => o !== entrada);

      this.emitir(EVENTOS_MERCADER.AGOTADO, {
        refId: datos.refIdMercader,
        objeto: datos.objeto,
      });
    }
  }

  /**
   * El jugador ha vendido: el objeto entra en el catálogo.
   *
   * Es un detalle pequeño con buen efecto: arrepentirse de una venta es posible,
   * aunque cueste. También hace que las tiendas reflejen por dónde has pasado.
   *
   * @private
   */
  _alRecibir(datos) {
    const catalogo = this._catalogos.get(datos.refIdMercader);
    if (!catalogo) return;

    const existente = catalogo.objetos.find((o) => o.nombre === datos.objeto);

    if (existente) {
      existente.stock += datos.cantidad ?? 1;
      return;
    }

    // Se recupera la instancia que el jugador acaba de vender.
    const vendido = datos.instancia;
    if (vendido) {
      catalogo.objetos.push({ ...vendido, stock: datos.cantidad ?? 1, deSegundaMano: true });
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONSULTAS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Catálogo de un mercader, cotizado y listo para la interfaz.
   *
   * @param {string} refId
   * @returns {{objetos: Array<Object>, oro: number, mercader: Object}|null}
   */
  catalogoParaInterfaz(refId) {
    const mercader = this.sistema('npcs')?.obtener(refId);
    if (!mercader?.esMercader) return null;

    const catalogo = this._obtenerCatalogo(mercader);
    const economia = this.sistema('economy');

    const objetos = catalogo.objetos.map((o) => {
      const calculo = economia?.cotizar(o, 'compra', refId);

      return {
        ...o,
        precio: calculo?.precio ?? o.valor,
        valoracion: calculo ? require_valoracion(calculo, economia) : null,
      };
    });

    return { objetos, oro: catalogo.oro, mercader };
  }

  /**
   * Lo que el jugador puede vender a este mercader, ya cotizado.
   *
   * @param {string} refId
   * @returns {Array<Object>}
   */
  vendibleA(refId) {
    const mercader = this.sistema('npcs')?.obtener(refId);
    if (!mercader) return [];

    const economia = this.sistema('economy');
    const objetos = Object.values(this.leer('inventory.objetos.porId', {}));

    return objetos
      .filter((o) => !o.esMision && !o.equipado)
      .map((o) => {
        const calculo = economia?.cotizar(o, 'venta', refId);

        return {
          ...o,
          precio: calculo?.precio ?? 0,
          interesa: _interesaA(mercader, o),
        };
      })
      .filter((o) => o.interesa);
  }

  /**
   * Oro disponible de un mercader.
   * @param {string} refId
   * @returns {number}
   */
  oroDe(refId) {
    return this._catalogos.get(refId)?.oro ?? 0;
  }

  /**
   * Contexto de comercio para el director.
   * @param {string} refId
   * @returns {string}
   */
  paraDirector(refId) {
    const catalogo = this._catalogos.get(refId);
    if (!catalogo) return '';

    const mercader = this.sistema('npcs')?.obtener(refId);
    const destacados = catalogo.objetos
      .filter((o) => o.rareza && o.rareza !== 'comun')
      .slice(0, 3)
      .map((o) => o.nombre);

    const partes = [`${mercader?.nombre ?? 'El mercader'} tiene ${catalogo.objetos.length} clases de artículo.`];

    if (destacados.length) partes.push(`Entre ellos: ${destacados.join(', ')}.`);
    if (catalogo.oro < 50) partes.push('Anda corto de fondos: no puede comprar mucho.');

    return partes.join(' ');
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PERSISTENCIA
     ═══════════════════════════════════════════════════════════════════════ */

  /** @returns {Object} */
  serializar() {
    return { catalogos: [...this._catalogos.entries()] };
  }

  /** @param {Object} datos */
  restaurar(datos) {
    this._catalogos = new Map(datos?.catalogos ?? []);
  }

  /** @returns {Object} */
  inspeccionar() {
    return {
      catalogos: this._catalogos.size,
      detalle: [...this._catalogos.entries()].map(([refId, c]) => ({
        refId,
        piezas: c.objetos.length,
        oro: c.oro,
      })),
    };
  }
}

/**
 * Comprueba si un mercader trata con una categoría.
 * Duplica la lógica de Trade a propósito: evita un ciclo de importación.
 * @private
 */
function _interesaA(mercader, objeto) {
  const surtido = SURTIDOS[mercader.rol];
  if (!surtido) return true;

  return Boolean(surtido.categorias[objeto.categoria]);
}

/**
 * Obtiene la valoración de un cálculo sin importar PriceModel directamente.
 * @private
 */
function require_valoracion(calculo, economia) {
  const ratio = calculo.precio / Math.max(1, calculo.base);

  if (ratio <= 0.8) return { etiqueta: 'una ganga', color: 'exito' };
  if (ratio <= 1.1) return { etiqueta: 'precio justo', color: 'neutral' };
  if (ratio <= 1.5) return { etiqueta: 'algo caro', color: 'aviso' };

  return { etiqueta: 'un robo', color: 'peligro' };
}

export default MerchantSystem;
