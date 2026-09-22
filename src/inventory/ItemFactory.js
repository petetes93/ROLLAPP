/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · inventory/ItemFactory.js
 * ---------------------------------------------------------------------------
 * Construcción de objetos: desde el catálogo, aleatorios y desde el director.
 *
 * Tres vías de entrada:
 *   1. `desdePlantilla` — el jugador compra algo concreto
 *   2. `generar` — botín aleatorio con rareza y afijos tirados
 *   3. `desdeDirector` — la IA propone un objeto, quizá inventado
 *
 * La tercera es la que necesita más cuidado. Un modelo de lenguaje puede pedir
 * «la Espada Solar del Amanecer Eterno, +50 de daño», y el motor tiene que
 * quedarse con la parte narrativa sin dejar entrar el desequilibrio. La función
 * busca la plantilla más parecida, aplica la rareza saturada contra las cotas
 * de `COTAS_IA` y conserva el nombre propuesto.
 *
 * Dependencias: items.data, Item, Rarity, RNG, balance.config, Logger.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { OBJETOS_BASE, obtenerPlantilla, buscarPorNombre, porCategoria, porValor } from '../data/items.data.js';
import * as Item from './Item.js';
import * as Rareza from './Rarity.js';
import { COTAS_IA, OBJETOS } from '../config/balance.config.js';
import { crearCanal } from '../core/Logger.js';

const log = crearCanal('core');

/* ═══════════════════════════════════════════════════════════════════════════
   DESDE CATÁLOGO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Crea un objeto concreto del catálogo.
 *
 * @param {string} refId
 * @param {Object} [opciones]
 * @param {number} [opciones.cantidad=1]
 * @param {Object} [opciones.origen]
 * @returns {Object|null}
 */
export function desdePlantilla(refId, opciones = {}) {
  return Item.crear(refId, opciones);
}

/**
 * Crea el equipo inicial de un personaje.
 *
 * @param {Array<{refId: string, cantidad: number}>} lista
 * @returns {Array<Object>}
 */
export function equipoInicial(lista) {
  return lista
    .map((e) => Item.crear(e.refId, {
      cantidad: e.cantidad,
      origen: { tipo: 'inicio' },
    }))
    .filter(Boolean);
}

/* ═══════════════════════════════════════════════════════════════════════════
   GENERACIÓN ALEATORIA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Genera un objeto aleatorio con rareza y afijos.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Object} [opciones]
 * @param {string} [opciones.categoria] Restringe a una categoría.
 * @param {string} [opciones.rarezaMin='tosco']
 * @param {string} [opciones.rarezaMax='legendario']
 * @param {number} [opciones.suerte=0]
 * @param {number} [opciones.nivelJugador=1] Ajusta el rango de valor.
 * @param {Object} [opciones.origen]
 * @returns {Object|null}
 */
export function generar(flujo, opciones = {}) {
  const {
    categoria, rarezaMin = 'tosco', rarezaMax = 'legendario',
    suerte = 0, nivelJugador = 1, origen = { tipo: 'botin' },
  } = opciones;

  // — Rareza —
  const rareza = Rareza.tirarRareza(flujo, { suerte, minima: rarezaMin, maxima: rarezaMax });

  // — Plantilla base, filtrada por categoría y por valor acorde al nivel —
  let candidatas = categoria ? porCategoria(categoria) : Object.values(OBJETOS_BASE);

  // El valor máximo escala con el nivel: a nivel 1 no aparecen cotas de malla.
  const valorTecho = 20 + nivelJugador * 30;
  const acordes = candidatas.filter((p) => (p.valor ?? 0) <= valorTecho);
  if (acordes.length) candidatas = acordes;

  // Los objetos irremplazables y de trasfondo no salen como botín.
  candidatas = candidatas.filter((p) => !p.propiedades?.includes('irreemplazable'));

  if (!candidatas.length) return null;

  const plantilla = flujo.elegir(candidatas);
  if (!plantilla) return null;

  // — Afijos según la rareza y la categoría —
  const afijos = Rareza.elegirAfijos(flujo, plantilla.categoria, rareza);

  // — Cantidad: solo los apilables salen en pila —
  const cantidad = plantilla.apilable
    ? flujo.entero(1, Math.min(5, plantilla.pilaMax ?? 5))
    : 1;

  // — Desgaste inicial: el botín rara vez está impecable —
  let durabilidad;
  if (plantilla.tieneDurabilidad) {
    const base = 100 + (afijos.some((a) => a.efecto?.tipo === 'durabilidadExtra') ? 50 : 0);
    durabilidad = flujo.entero(Math.floor(base * 0.4), base);
  }

  return Item.crear(plantilla.refId, { cantidad, rareza, afijos, durabilidad, origen });
}

/**
 * Genera varios objetos de una vez.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {number} cantidad
 * @param {Object} [opciones]
 * @returns {Array<Object>}
 */
export function generarVarios(flujo, cantidad, opciones = {}) {
  const salida = [];
  for (let i = 0; i < cantidad; i++) {
    const objeto = generar(flujo, opciones);
    if (objeto) salida.push(objeto);
  }
  return salida;
}

/* ═══════════════════════════════════════════════════════════════════════════
   DESDE EL DIRECTOR
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Construye un objeto a partir de lo que propone el director de juego.
 *
 * Este es el cortafuegos entre la narrativa y la mecánica. El director puede
 * inventarse el nombre y la descripción que quiera —eso enriquece la partida—
 * pero las estadísticas salen del catálogo y se saturan contra las cotas.
 *
 * Proceso:
 *   1. Si el `refId` existe en el catálogo, se usa esa plantilla.
 *   2. Si no, se busca por nombre aproximado.
 *   3. Si tampoco, se elige una plantilla de la categoría que encaje.
 *   4. La rareza se recorta al techo permitido sin hito narrativo.
 *   5. El nombre propuesto se conserva; las estadísticas, no.
 *
 * @param {Object} propuesta Entrada de `newItems` del JSON del director.
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Object} [contexto]
 * @param {boolean} [contexto.hitoNarrativo=false] Permite rarezas altas.
 * @param {number} [contexto.nivelJugador=1]
 * @returns {{objeto: Object|null, ajustes: string[]}}
 */
export function desdeDirector(propuesta, flujo, contexto = {}) {
  const ajustes = [];
  const { hitoNarrativo = false, nivelJugador = 1 } = contexto;

  if (!propuesta) return { objeto: null, ajustes: ['propuesta vacía'] };

  // ─── 1. Localizar la plantilla ───────────────────────────────────────────
  let plantilla = obtenerPlantilla(propuesta.refId);

  if (!plantilla && propuesta.nombre) {
    plantilla = buscarPorNombre(propuesta.nombre);
    if (plantilla) ajustes.push(`"${propuesta.nombre}" resuelto como ${plantilla.nombre}`);
  }

  if (!plantilla) {
    plantilla = _inferirPlantilla(propuesta, flujo, nivelJugador);
    if (plantilla) {
      ajustes.push(`objeto desconocido aproximado a ${plantilla.nombre}`);
    } else {
      return { objeto: null, ajustes: ['no se pudo resolver el objeto propuesto'] };
    }
  }

  // ─── 2. Saturar la rareza ────────────────────────────────────────────────
  let rareza = propuesta.rareza ?? plantilla.rareza ?? 'comun';

  if (!Rareza.GRADOS_RAREZA.includes(rareza)) {
    ajustes.push(`rareza "${rareza}" no reconocida`);
    rareza = plantilla.rareza ?? 'comun';
  }

  if (!hitoNarrativo) {
    const techo = COTAS_IA.rarezaMaxSinHito;
    if (Rareza.comparar(rareza, techo) > 0) {
      ajustes.push(`rareza rebajada de ${rareza} a ${techo}`);
      rareza = techo;
    }
  }

  // ─── 3. Afijos según la rareza final ─────────────────────────────────────
  const afijos = Rareza.elegirAfijos(flujo, plantilla.categoria, rareza);

  // ─── 4. Cantidad, saturada ───────────────────────────────────────────────
  let cantidad = Math.max(1, Math.floor(propuesta.qty ?? propuesta.cantidad ?? 1));
  const pilaMax = plantilla.apilable ? (plantilla.pilaMax ?? 20) : 1;
  if (cantidad > pilaMax) {
    ajustes.push(`cantidad recortada de ${cantidad} a ${pilaMax}`);
    cantidad = pilaMax;
  }

  // ─── 5. Durabilidad propuesta, como fracción ─────────────────────────────
  let durabilidad;
  if (plantilla.tieneDurabilidad && propuesta.durability !== undefined) {
    const f = Number(propuesta.durability);
    // El contrato admite tanto 0-1 como 0-100; se acepta cualquiera.
    durabilidad = f <= 1 ? Math.round(f * 100) : Math.round(f);
    durabilidad = Math.max(0, Math.min(100, durabilidad));
  }

  // ─── 6. Construir y personalizar ─────────────────────────────────────────
  const objeto = Item.crear(plantilla.refId, {
    cantidad,
    rareza,
    afijos,
    durabilidad,
    origen: { tipo: 'director', turno: contexto.turno ?? null },
  });

  if (!objeto) return { objeto: null, ajustes: [...ajustes, 'fallo al construir la instancia'] };

  // El nombre y la descripción propuestos se conservan: es la parte del
  // director que enriquece la partida sin romper nada.
  if (propuesta.nombre && propuesta.nombre.length <= 60) {
    objeto.nombre = propuesta.nombre;
    objeto.nombrePropio = true;
  }
  if (propuesta.descripcion && propuesta.descripcion.length <= 300) {
    objeto.descripcionPropia = propuesta.descripcion;
  }

  return { objeto, ajustes };
}

/**
 * Infiere una plantilla razonable cuando el director propone algo que no existe.
 *
 * Busca por palabras clave en el nombre y la descripción. Si menciona «espada»,
 * se le da una espada; si menciona «poción», una poción. Es preferible a
 * descartar la propuesta: el jugador recibe algo coherente con lo narrado.
 *
 * @param {Object} propuesta
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {number} nivelJugador
 * @returns {Object|null}
 * @private
 */
function _inferirPlantilla(propuesta, flujo, nivelJugador) {
  const texto = `${propuesta.nombre ?? ''} ${propuesta.descripcion ?? ''}`.toLowerCase();

  const pistas = [
    [/espada|sable|hoja|acero/, 'espada_corta'],
    [/daga|puñal|cuchillo/, 'daga'],
    [/hacha/, 'hacha_mano'],
    [/maza|martillo|garrote/, 'maza'],
    [/arco|flecha/, 'arco_corto'],
    [/bastón|baston|vara|cayado/, 'baston_glifos'],
    [/escudo|broquel|rodela/, 'escudo_madera'],
    [/coraza|peto|cota|malla|armadura/, 'coraza_cuero'],
    [/túnica|tunica|hábito|habito/, 'tunica_estudio'],
    [/capa|manto/, 'capa_viaje'],
    [/anillo|sortija/, 'anillo_familia'],
    [/amuleto|colgante|talismán|talisman/, 'simbolo_sagrado'],
    [/poción|pocion|elixir|brebaje|frasco/, 'pocion_curacion'],
    [/comida|pan|carne|provisión|provision|ración|racion/, 'racion_viaje'],
    [/agua|odre|cantimplora/, 'odre_agua'],
    [/cuerda|soga/, 'cuerda'],
    [/antorcha|linterna|candil/, 'antorcha'],
    [/libro|tomo|grimorio|cuaderno|pergamino/, 'libro_notas'],
    [/gema|joya|piedra preciosa|rubí|rubi|zafiro/, 'gema_menor'],
    [/reliquia|artefacto|fragmento antiguo/, 'reliquia_antigua'],
    [/ganzúa|ganzua|herramienta de ladrón/, 'ganzuas'],
    [/herramienta|utensilio/, 'herramientas_oficio'],
  ];

  for (const [patron, refId] of pistas) {
    if (patron.test(texto)) return obtenerPlantilla(refId);
  }

  // Sin pistas: se entrega algo de valor acorde al nivel, para que la propuesta
  // del director no se pierda del todo.
  const rango = porValor(1, 20 + nivelJugador * 15)
    .filter((p) => !p.propiedades?.includes('irreemplazable'));

  return rango.length ? flujo.elegir(rango) : null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   OBJETOS ESPECIALES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Crea un objeto de misión: no se puede vender ni soltar.
 *
 * @param {string} refId
 * @param {Object} datos
 * @returns {Object|null}
 */
export function objetoMision(refId, datos = {}) {
  const objeto = Item.crear(refId, { cantidad: 1, origen: { tipo: 'mision', id: datos.misionId } });
  if (!objeto) return null;

  if (datos.nombre) objeto.nombre = datos.nombre;
  if (datos.descripcion) objeto.descripcionPropia = datos.descripcion;

  objeto.esMision = true;
  objeto.valor = 0;   // Sin valor de venta: no es mercancía.

  return objeto;
}

/**
 * Crea una recompensa acorde al nivel y a la importancia del hito.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Object} opciones
 * @param {number} opciones.nivelJugador
 * @param {'menor'|'media'|'mayor'|'capitulo'} opciones.importancia
 * @returns {Array<Object>}
 */
export function recompensa(flujo, opciones) {
  const { nivelJugador = 1, importancia = 'menor' } = opciones;

  const perfiles = {
    menor: { cantidad: 1, rarezaMin: 'comun', rarezaMax: 'fino', suerte: 0 },
    media: { cantidad: 2, rarezaMin: 'comun', rarezaMax: 'superior', suerte: 1 },
    mayor: { cantidad: 2, rarezaMin: 'fino', rarezaMax: 'arcano', suerte: 3 },
    capitulo: { cantidad: 3, rarezaMin: 'fino', rarezaMax: 'legendario', suerte: 5 },
  };

  const p = perfiles[importancia] ?? perfiles.menor;

  return generarVarios(flujo, p.cantidad, {
    rarezaMin: p.rarezaMin,
    rarezaMax: p.rarezaMax,
    suerte: p.suerte,
    nivelJugador,
    origen: { tipo: 'recompensa', importancia },
  });
}

export default {
  desdePlantilla,
  equipoInicial,
  generar,
  generarVarios,
  desdeDirector,
  objetoMision,
  recompensa,
};
