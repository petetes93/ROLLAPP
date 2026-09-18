/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · inventory/LootGenerator.js
 * ---------------------------------------------------------------------------
 * Generación de botín: enemigos, contenedores y hallazgos.
 *
 * Combina las tres dimensiones de las tablas —amenaza, terreno y contenedor—
 * y produce objetos concretos. Todo pasa por el flujo aleatorio del dominio
 * `botin`, de modo que repetir una tirada de percepción no altera el contenido
 * del próximo cofre.
 *
 * El sesgo de terreno no es cosmético: en una armería aparecen armas, en una
 * despensa aparece comida. Que el botín tenga sentido con el lugar es lo que
 * hace que el mundo parezca un mundo y no una máquina de premios.
 *
 * Dependencias: loot.tables, ItemFactory, Item, Rarity, items.data.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  perfilAmenaza, perfilTerreno, perfilContenedor,
  POR_DIFICULTAD, SEGURIDAD_CONTENEDOR, hallazgosDe,
} from '../data/loot.tables.js';
import * as Fabrica from './ItemFactory.js';
import * as Item from './Item.js';
import * as Rareza from './Rarity.js';
import { obtenerPlantilla, porCategoria } from '../data/items.data.js';
import { ECONOMIA } from '../config/balance.config.js';
import { saturar } from '../utils/math.js';

/* ═══════════════════════════════════════════════════════════════════════════
   BOTÍN DE ENEMIGO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Genera el botín que suelta un enemigo derrotado.
 *
 * @param {import('../core/RNG.js').Flujo} flujo Flujo del dominio 'botin'.
 * @param {Object} opciones
 * @param {string} opciones.amenaza Grado de amenaza del enemigo.
 * @param {number} [opciones.nivelJugador=1]
 * @param {string} [opciones.terreno='camino']
 * @param {string} [opciones.dificultad='equilibrado']
 * @param {string} [opciones.tipoEnemigo] Sesga las categorías.
 * @returns {{oro: number, objetos: Array<Object>, descripcion: string}}
 */
export function deEnemigo(flujo, opciones) {
  const {
    amenaza = 'normal', nivelJugador = 1, terreno = 'camino',
    dificultad = 'equilibrado', tipoEnemigo,
  } = opciones;

  const perfil = perfilAmenaza(amenaza);
  const ajuste = POR_DIFICULTAD[dificultad] ?? POR_DIFICULTAD.equilibrado;

  // ─── Oro ───────────────────────────────────────────────────────────────
  const rango = ECONOMIA.botinOro[amenaza] ?? ECONOMIA.botinOro.normal;
  let oro = Math.round(flujo.entero(rango[0], rango[1]) * ajuste.oro);

  // Las bestias no llevan monedas encima.
  if (_esBestia(tipoEnemigo)) oro = 0;

  // ─── Objetos ───────────────────────────────────────────────────────────
  const objetos = [];

  if (flujo.oportunidad(perfil.probabilidadObjeto * ajuste.objetos)) {
    const cuantos = flujo.entero(perfil.objetos.min, perfil.objetos.max);
    const suerte = saturar(perfil.suerte + ajuste.suerte + perfilTerreno(terreno).modificadorRareza, 0, 10);

    for (let i = 0; i < cuantos; i++) {
      const categoria = _elegirCategoria(flujo, terreno, tipoEnemigo);
      const objeto = Fabrica.generar(flujo, {
        categoria,
        rarezaMin: perfil.rarezaMin,
        rarezaMax: perfil.rarezaMax,
        suerte,
        nivelJugador,
        origen: { tipo: 'botin', amenaza },
      });
      if (objeto) objetos.push(objeto);
    }
  }

  // ─── Rareza garantizada de los jefes ───────────────────────────────────
  // Un jefe siempre suelta algo que merezca la pena. Si la tirada normal no lo
  // dio, se fuerza aquí: la recompensa por un jefe no puede ser una decepción.
  if (perfil.garantizaRareza) {
    const yaTiene = objetos.some((o) => Rareza.comparar(o.rareza, perfil.garantizaRareza) >= 0);

    if (!yaTiene) {
      const especial = Fabrica.generar(flujo, {
        rarezaMin: perfil.garantizaRareza,
        rarezaMax: perfil.rarezaMax,
        suerte: perfil.suerte,
        nivelJugador,
        origen: { tipo: 'botin', amenaza, garantizado: true },
      });
      if (especial) objetos.push(especial);
    }
  }

  return { oro, objetos, descripcion: _describirBotin(oro, objetos) };
}

/**
 * @param {string} tipo
 * @returns {boolean}
 * @private
 */
function _esBestia(tipo) {
  if (!tipo) return false;
  return /bestia|beast|animal|fiera|alimaña/i.test(tipo);
}

/**
 * Elige una categoría de objeto sesgada por el terreno y el tipo de enemigo.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {string} terreno
 * @param {string} [tipoEnemigo]
 * @returns {string|undefined}
 * @private
 */
function _elegirCategoria(flujo, terreno, tipoEnemigo) {
  const pesos = { ...perfilTerreno(terreno).pesos };

  // Un humanoide lleva equipo; una bestia deja materiales.
  if (_esBestia(tipoEnemigo)) {
    return flujo.elegirClavePonderada({ material: 70, consumible: 30 });
  }
  if (/no muerto|undead|espectro/i.test(tipoEnemigo ?? '')) {
    pesos.magico = (pesos.magico ?? 0) + 20;
    pesos.consumible = Math.max(0, (pesos.consumible ?? 0) - 15);
  }

  return flujo.elegirClavePonderada(pesos);
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONTENEDORES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Genera el contenido de un contenedor.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Object} opciones
 * @param {string} opciones.tipo Clave de CONTENEDORES.
 * @param {number} [opciones.nivelJugador=1]
 * @param {string} [opciones.terreno='camino']
 * @param {string} [opciones.dificultad='equilibrado']
 * @returns {{
 *   oro: number, objetos: Array<Object>, cerrado: boolean, trampa: boolean,
 *   dificultadCerradura: string, nombre: string, descripcion: string,
 *   consecuenciaMoral: string|null
 * }}
 */
export function deContenedor(flujo, opciones) {
  const {
    tipo = 'saco', nivelJugador = 1,
    terreno = 'camino', dificultad = 'equilibrado',
  } = opciones;

  const perfil = perfilContenedor(tipo);
  const ajuste = POR_DIFICULTAD[dificultad] ?? POR_DIFICULTAD.equilibrado;
  const seguridad = SEGURIDAD_CONTENEDOR[terreno] ?? SEGURIDAD_CONTENEDOR.camino;

  // ─── Oro ───────────────────────────────────────────────────────────────
  const oro = Math.round(flujo.entero(perfil.oro.min, perfil.oro.max) * ajuste.oro);

  // ─── Objetos ───────────────────────────────────────────────────────────
  const cuantos = Math.max(0, Math.round(
    flujo.entero(perfil.objetos.min, perfil.objetos.max) * ajuste.objetos,
  ));

  const suerte = saturar(
    perfil.suerte + ajuste.suerte + perfilTerreno(terreno).modificadorRareza, 0, 10,
  );

  const objetos = [];

  for (let i = 0; i < cuantos; i++) {
    // Algunos contenedores restringen o fuerzan la categoría.
    let categoria = perfil.categoriaForzada;

    if (!categoria && perfil.categoriasPermitidas) {
      categoria = flujo.elegir(perfil.categoriasPermitidas);
    }
    if (!categoria) {
      categoria = flujo.elegirClavePonderada(perfilTerreno(terreno).pesos);
    }

    const objeto = Fabrica.generar(flujo, {
      categoria,
      rarezaMin: perfil.rarezaMin,
      rarezaMax: perfil.rarezaMax,
      suerte,
      nivelJugador,
      origen: { tipo: 'contenedor', contenedor: tipo },
    });
    if (objeto) objetos.push(objeto);
  }

  // ─── Objetos específicos del terreno ───────────────────────────────────
  // Da color local: en un bosque aparece piel curtida, en el desierto un odre.
  const especificos = perfilTerreno(terreno).especificos ?? [];
  if (especificos.length && flujo.oportunidad(0.35)) {
    const refId = flujo.elegir(especificos);
    const extra = Item.crear(refId, {
      cantidad: flujo.entero(1, 2),
      origen: { tipo: 'contenedor', contenedor: tipo },
    });
    if (extra) objetos.push(extra);
  }

  // ─── Cerradura y trampa ────────────────────────────────────────────────
  const cerrado = Boolean(perfil.puedeEstarCerrado) && flujo.oportunidad(seguridad.cerrado);
  const trampa = Boolean(perfil.puedeTenerTrampa) && cerrado && flujo.oportunidad(seguridad.trampa);

  return {
    oro,
    objetos,
    cerrado,
    trampa,
    dificultadCerradura: perfil.dificultadCerradura ?? 'moderada',
    nombre: perfil.nombre,
    descripcion: perfil.descripcion,
    consecuenciaMoral: perfil.consecuenciaMoral ?? null,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   HALLAZGOS DE EXPLORACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Determina qué se puede encontrar registrando el terreno actual.
 *
 * No genera el botín todavía: devuelve la oportunidad con su prueba asociada,
 * para que el motor tire y después llame a `resolverHallazgo`.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {string} terreno
 * @returns {Object|null}
 */
export function oportunidadHallazgo(flujo, terreno) {
  const posibles = hallazgosDe(terreno);
  if (!posibles.length) return null;

  const elegido = flujo.elegir(posibles);
  if (!elegido) return null;

  return {
    clave: elegido.clave,
    nombre: elegido.nombre,
    habilidad: elegido.habilidad,
    umbral: elegido.umbral,
  };
}

/**
 * Resuelve un hallazgo tras una prueba superada.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {string} clave Clave del hallazgo.
 * @param {Object} [contexto]
 * @param {number} [contexto.margen=0] Margen de éxito de la prueba.
 * @param {number} [contexto.nivelJugador=1]
 * @param {string} [contexto.terreno='camino']
 * @returns {{objetos: Array<Object>, oro: number, efecto: Object|null, descripcion: string}}
 */
export function resolverHallazgo(flujo, clave, contexto = {}) {
  const { margen = 0, nivelJugador = 1, terreno = 'camino' } = contexto;

  const hallazgos = hallazgosDe(terreno);
  const h = hallazgos.find((x) => x.clave === clave);

  if (!h) return { objetos: [], oro: 0, efecto: null, descripcion: 'No encuentras nada.' };

  // Un hallazgo que abre un contenedor delega en la función correspondiente.
  if (h.contenedor) {
    const r = deContenedor(flujo, { tipo: h.contenedor, nivelJugador, terreno });
    return {
      objetos: r.objetos,
      oro: r.oro,
      efecto: null,
      descripcion: `Encuentras ${h.nombre}. ${r.descripcion}`,
    };
  }

  // Un hallazgo con efecto directo, como rellenar el odre.
  if (h.efecto) {
    return { objetos: [], oro: 0, efecto: h.efecto, descripcion: `Encuentras ${h.nombre}.` };
  }

  // Hallazgo de objetos. Un margen amplio da más cantidad.
  const bonus = margen >= 10 ? 1 : 0;
  const cuantos = flujo.entero(h.cantidad?.min ?? 1, (h.cantidad?.max ?? 1) + bonus);

  const objetos = [];
  for (let i = 0; i < cuantos; i++) {
    const refId = flujo.elegir(h.objetos ?? []);
    if (!refId) continue;
    const objeto = Item.crear(refId, { cantidad: 1, origen: { tipo: 'hallazgo', clave } });
    if (objeto) objetos.push(objeto);
  }

  return { objetos, oro: 0, efecto: null, descripcion: `Encuentras ${h.nombre}.` };
}

/* ═══════════════════════════════════════════════════════════════════════════
   BOTÍN DIRIGIDO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Genera botín a partir de una descripción del director.
 *
 * El director puede decir «encuentras un alijo de contrabandistas» sin conocer
 * las tablas. Esta función traduce esa descripción al contenedor más parecido.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {string} descripcion
 * @param {Object} contexto
 * @returns {Object}
 */
export function desdeDescripcion(flujo, descripcion, contexto = {}) {
  const texto = String(descripcion ?? '').toLowerCase();

  const pistas = [
    [/cofre reforzado|arca de hierro|caja fuerte/, 'cofre_reforzado'],
    [/cofre|arca|baúl|baul/, 'cofre'],
    [/alijo|escondite|escondrijo|caché|cache/, 'alijo'],
    [/altar|santuario|ofrenda/, 'altar'],
    [/despensa|cocina|almacén de comida/, 'despensa'],
    [/armería|armeria|arsenal|panoplia/, 'armeria'],
    [/biblioteca|estantería|estanteria|archivo/, 'biblioteca'],
    [/cadáver|cadaver|cuerpo|muerto|restos/, 'cadaver'],
    [/saco|fardo|bolsa|morral/, 'saco'],
  ];

  let tipo = 'saco';
  for (const [patron, clave] of pistas) {
    if (patron.test(texto)) { tipo = clave; break; }
  }

  return deContenedor(flujo, { ...contexto, tipo });
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESENTACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Descripción narrativa del botín, para la bitácora.
 *
 * @param {number} oro
 * @param {Array<Object>} objetos
 * @returns {string}
 * @private
 */
function _describirBotin(oro, objetos) {
  const partes = [];

  if (oro > 0) partes.push(`${oro} de oro`);

  for (const o of objetos) partes.push(Item.mencion(o));

  if (!partes.length) return 'No hay nada de valor.';
  if (partes.length === 1) return `Encuentras ${partes[0]}.`;

  const ultimo = partes.pop();
  return `Encuentras ${partes.join(', ')} y ${ultimo}.`;
}

/**
 * Descripción pública de un resultado de botín.
 * @param {{oro: number, objetos: Array<Object>}} botin
 * @returns {string}
 */
export function describir(botin) {
  return _describirBotin(botin?.oro ?? 0, botin?.objetos ?? []);
}

/**
 * Valor total de un botín, para calibrar y depurar.
 * @param {{oro: number, objetos: Array<Object>}} botin
 * @returns {number}
 */
export function valorTotal(botin) {
  const objetos = (botin?.objetos ?? []).reduce((a, o) => a + Item.valorTotal(o), 0);
  return (botin?.oro ?? 0) + objetos;
}

export default {
  deEnemigo,
  deContenedor,
  oportunidadHallazgo,
  resolverHallazgo,
  desdeDescripcion,
  describir,
  valorTotal,
};
