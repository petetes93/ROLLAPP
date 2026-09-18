/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · inventory/Rarity.js
 * ---------------------------------------------------------------------------
 * Rarezas y afijos.
 *
 * Siete grados: común, tosco, fino, superior, arcano, legendario, mítico.
 * El grado hace tres cosas: colorear el objeto, multiplicar su valor y decidir
 * cuántos afijos lleva.
 *
 * Un afijo es una propiedad que se añade al objeto al generarlo — «del Lobo»,
 * «Rúnico», «de la Viuda». No son adornos: alteran el nombre, el valor y las
 * estadísticas. Es lo que hace que dos espadas cortas del mismo catálogo sean
 * objetos distintos.
 *
 * Funciones puras.
 *
 * Dependencias: config/balance.config.js, utils/text.js.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { OBJETOS } from '../config/balance.config.js';
import { capitalizar } from '../utils/text.js';

/* ═══════════════════════════════════════════════════════════════════════════
   GRADOS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Rarezas ordenadas de menor a mayor. */
export const GRADOS_RAREZA = Object.freeze([
  'tosco', 'comun', 'fino', 'superior', 'arcano', 'legendario', 'mitico',
]);

/** Metadatos de presentación. La clase CSS ya existe en components.css. */
export const META_RAREZA = Object.freeze({
  tosco: {
    nombre: 'Tosco', clase: 'rar-tosco',
    descripcion: 'Mal hecho o muy usado. Cumple a duras penas.',
  },
  comun: {
    nombre: 'Común', clase: 'rar-comun',
    descripcion: 'Trabajo corriente. Ni bueno ni malo.',
  },
  fino: {
    nombre: 'Fino', clase: 'rar-fino',
    descripcion: 'Buen material y mejor mano. Se nota al usarlo.',
  },
  superior: {
    nombre: 'Superior', clase: 'rar-superior',
    descripcion: 'Obra de maestro. Poca gente puede permitírselo.',
  },
  arcano: {
    nombre: 'Arcano', clase: 'rar-arcano',
    descripcion: 'Lleva magia dentro, y no es una metáfora.',
  },
  legendario: {
    nombre: 'Legendario', clase: 'rar-legendario',
    descripcion: 'Tiene nombre propio y alguien lo recuerda.',
  },
  mitico: {
    nombre: 'Mítico', clase: 'rar-mitico',
    descripcion: 'No debería existir. Y sin embargo, aquí está.',
  },
});

/**
 * @param {string} rareza
 * @returns {Object} Metadatos; los de común si no se reconoce.
 */
export function meta(rareza) {
  return META_RAREZA[rareza] ?? META_RAREZA.comun;
}

/**
 * Índice de una rareza en la escala. Sirve para comparar grados.
 * @param {string} rareza
 * @returns {number}
 */
export function indice(rareza) {
  const i = GRADOS_RAREZA.indexOf(rareza);
  return i === -1 ? 1 : i;
}

/**
 * Compara dos rarezas.
 * @param {string} a
 * @param {string} b
 * @returns {number} Negativo si a es inferior.
 */
export function comparar(a, b) {
  return indice(a) - indice(b);
}

/**
 * Multiplicador de valor de una rareza.
 * @param {string} rareza
 * @returns {number}
 */
export function multiplicador(rareza) {
  return OBJETOS.rarezas[rareza]?.multiplicador ?? 1;
}

/**
 * Número de afijos que corresponde a una rareza.
 * @param {string} rareza
 * @returns {number}
 */
export function numeroAfijos(rareza) {
  return OBJETOS.rarezas[rareza]?.afijos ?? 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   AFIJOS
   ---------------------------------------------------------------------------
   Prefijos (van delante: «Rúnico estoque») y sufijos (van detrás: «espada del
   Lobo»). Cada uno declara a qué categorías puede aplicarse y qué modifica.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Afijo
 * @property {string} refId
 * @property {string} nombre Forma masculina.
 * @property {string} [nombreF] Forma femenina, si difiere.
 * @property {'prefijo'|'sufijo'} posicion
 * @property {string[]} categorias Categorías de objeto admitidas.
 * @property {number} nivelMin Rareza mínima (índice) para que aparezca.
 * @property {number} peso Probabilidad relativa.
 * @property {Object} efecto
 * @property {number} valorExtra Multiplicador de valor añadido.
 * @property {string} [descripcion]
 */

/** @type {Record<string, Afijo>} */
export const AFIJOS = Object.freeze({

  /* ─── Prefijos de arma ────────────────────────────────────────────────── */
  afilado: {
    refId: 'afilado', nombre: 'Afilado', nombreF: 'Afilada', posicion: 'prefijo',
    categorias: ['arma'], nivelMin: 2, peso: 100, valorExtra: 0.4,
    efecto: { tipo: 'bonoDano', valor: 1 },
    descripcion: 'El filo aguanta más y corta mejor.',
  },
  equilibrado: {
    refId: 'equilibrado', nombre: 'Equilibrado', nombreF: 'Equilibrada', posicion: 'prefijo',
    categorias: ['arma'], nivelMin: 2, peso: 100, valorExtra: 0.4,
    efecto: { tipo: 'bonoAtaque', valor: 1 },
    descripcion: 'El peso cae donde debe. Apunta solo.',
  },
  robusto: {
    refId: 'robusto', nombre: 'Robusto', nombreF: 'Robusta', posicion: 'prefijo',
    categorias: ['arma', 'armadura', 'escudo'], nivelMin: 1, peso: 90, valorExtra: 0.3,
    efecto: { tipo: 'durabilidadExtra', valor: 50 },
    descripcion: 'Construido para durar más de lo razonable.',
  },
  ligero: {
    refId: 'ligero', nombre: 'Ligero', nombreF: 'Ligera', posicion: 'prefijo',
    categorias: ['arma', 'armadura'], nivelMin: 2, peso: 80, valorExtra: 0.5,
    efecto: { tipo: 'reduccionPeso', valor: 0.4 },
    descripcion: 'Pesa mucho menos de lo que aparenta.',
  },
  runico: {
    refId: 'runico', nombre: 'Rúnico', nombreF: 'Rúnica', posicion: 'prefijo',
    categorias: ['arma', 'armadura', 'escudo'], nivelMin: 4, peso: 40, valorExtra: 2.0,
    efecto: { tipo: 'bonoLanzamiento', valor: 1 },
    descripcion: 'Grabado con notación que sostiene un efecto permanente.',
  },
  ardiente: {
    refId: 'ardiente', nombre: 'Ardiente', posicion: 'prefijo',
    categorias: ['arma'], nivelMin: 4, peso: 35, valorExtra: 2.5,
    efecto: { tipo: 'danoElemental', elemento: 'fuego', notacion: '1d6' },
    descripcion: 'El metal desprende calor y chisporrotea al impactar.',
  },
  gelido: {
    refId: 'gelido', nombre: 'Gélido', nombreF: 'Gélida', posicion: 'prefijo',
    categorias: ['arma'], nivelMin: 4, peso: 35, valorExtra: 2.5,
    efecto: { tipo: 'danoElemental', elemento: 'frio', notacion: '1d6' },
    descripcion: 'Escarcha el aire a su alrededor y ralentiza a quien toca.',
  },
  sanguinario: {
    refId: 'sanguinario', nombre: 'Sanguinario', nombreF: 'Sanguinaria', posicion: 'prefijo',
    categorias: ['arma'], nivelMin: 5, peso: 15, valorExtra: 4.0,
    efecto: { tipo: 'robarVida', fraccion: 0.25 },
    descripcion: 'Devuelve a quien la empuña parte del daño que causa.',
  },
  silente: {
    refId: 'silente', nombre: 'Silente', posicion: 'prefijo',
    categorias: ['armadura', 'arma'], nivelMin: 3, peso: 50, valorExtra: 1.2,
    efecto: { tipo: 'bonoHabilidad', habilidad: 'sigilo', valor: 2 },
    descripcion: 'No hace ruido. Ninguno.',
  },

  /* ─── Sufijos de arma ─────────────────────────────────────────────────── */
  del_lobo: {
    refId: 'del_lobo', nombre: 'del Lobo', posicion: 'sufijo',
    categorias: ['arma'], nivelMin: 3, peso: 60, valorExtra: 1.0,
    efecto: { tipo: 'criticoAmpliado', umbral: 19 },
    descripcion: 'Encuentra el hueco antes que su portador.',
  },
  del_cazador: {
    refId: 'del_cazador', nombre: 'del Cazador', posicion: 'sufijo',
    categorias: ['arma'], nivelMin: 3, peso: 55, valorExtra: 1.0,
    efecto: { tipo: 'bonoContra', categoria: 'bestia', valor: 3 },
    descripcion: 'Forjada contra las bestias del bosque.',
  },
  de_la_viuda: {
    refId: 'de_la_viuda', nombre: 'de la Viuda', posicion: 'sufijo',
    categorias: ['arma'], nivelMin: 4, peso: 30, valorExtra: 2.2,
    efecto: { tipo: 'estadoAlImpactar', estado: 'sangrado', probabilidad: 0.3 },
    descripcion: 'Las heridas que abre tardan en cerrar.',
  },
  del_juramento: {
    refId: 'del_juramento', nombre: 'del Juramento', posicion: 'sufijo',
    categorias: ['arma', 'escudo'], nivelMin: 5, peso: 20, valorExtra: 3.0,
    efecto: { tipo: 'bonoProteger', valor: 2 },
    descripcion: 'Responde mejor cuando se usa para defender a otro.',
  },

  /* ─── Prefijos de armadura ────────────────────────────────────────────── */
  reforzado: {
    refId: 'reforzado', nombre: 'Reforzado', nombreF: 'Reforzada', posicion: 'prefijo',
    categorias: ['armadura', 'escudo'], nivelMin: 2, peso: 100, valorExtra: 0.5,
    efecto: { tipo: 'bonoDefensa', valor: 1 },
    descripcion: 'Placas adicionales donde más hacen falta.',
  },
  acolchado: {
    refId: 'acolchado', nombre: 'Acolchado', nombreF: 'Acolchada', posicion: 'prefijo',
    categorias: ['armadura'], nivelMin: 1, peso: 90, valorExtra: 0.3,
    efecto: { tipo: 'bonoReduccion', valor: 1 },
    descripcion: 'Reparte los golpes en vez de concentrarlos.',
  },
  brunido: {
    refId: 'brunido', nombre: 'Bruñido', nombreF: 'Bruñida', posicion: 'prefijo',
    categorias: ['armadura', 'escudo'], nivelMin: 3, peso: 45, valorExtra: 1.0,
    efecto: { tipo: 'bonoHabilidad', habilidad: 'intimidacion', valor: 2 },
    descripcion: 'Pulida hasta el espejo. Impone antes de decir nada.',
  },

  /* ─── Sufijos de armadura ─────────────────────────────────────────────── */
  del_guardian: {
    refId: 'del_guardian', nombre: 'del Guardián', posicion: 'sufijo',
    categorias: ['armadura', 'escudo'], nivelMin: 4, peso: 35, valorExtra: 2.0,
    efecto: { tipo: 'reduccionDano', valor: 2 },
    descripcion: 'Absorbe lo que otras armaduras dejan pasar.',
  },
  del_caminante: {
    refId: 'del_caminante', nombre: 'del Caminante', posicion: 'sufijo',
    categorias: ['armadura', 'capa'], nivelMin: 2, peso: 70, valorExtra: 0.8,
    efecto: { tipo: 'reduccionFatiga', valor: 0.3 },
    descripcion: 'Cansa menos en marchas largas.',
  },
  de_las_brumas: {
    refId: 'de_las_brumas', nombre: 'de las Brumas', posicion: 'sufijo',
    categorias: ['armadura', 'capa'], nivelMin: 5, peso: 18, valorExtra: 3.5,
    efecto: { tipo: 'esquivaExtra', valor: 0.08 },
    descripcion: 'Cuesta fijar la vista en quien la lleva.',
  },

  /* ─── Afijos universales ──────────────────────────────────────────────── */
  del_erudito: {
    refId: 'del_erudito', nombre: 'del Erudito', posicion: 'sufijo',
    categorias: ['arma', 'armadura', 'magico', 'util'], nivelMin: 3, peso: 40, valorExtra: 1.2,
    efecto: { tipo: 'bonoAtributo', atributo: 'intelecto', valor: 1 },
    descripcion: 'Aclara la mente de quien lo porta.',
  },
  del_titan: {
    refId: 'del_titan', nombre: 'del Titán', posicion: 'sufijo',
    categorias: ['arma', 'armadura', 'magico'], nivelMin: 4, peso: 30, valorExtra: 1.8,
    efecto: { tipo: 'bonoAtributo', atributo: 'vigor', valor: 1 },
    descripcion: 'Da fuerza a quien lo usa, y le pesa la mano.',
  },
  del_zorro: {
    refId: 'del_zorro', nombre: 'del Zorro', posicion: 'sufijo',
    categorias: ['arma', 'armadura', 'magico'], nivelMin: 4, peso: 30, valorExtra: 1.8,
    efecto: { tipo: 'bonoAtributo', atributo: 'astucia', valor: 1 },
    descripcion: 'Afina el instinto y despierta la sospecha.',
  },
  maldito: {
    refId: 'maldito', nombre: 'Maldito', nombreF: 'Maldita', posicion: 'prefijo',
    categorias: ['arma', 'armadura', 'magico'], nivelMin: 4, peso: 12, valorExtra: 1.5,
    efecto: { tipo: 'malicion', bono: 3, penalizacion: { recurso: 'moral', valor: -8 } },
    descripcion: 'Poderoso, sí. Y va comiendo por dentro.',
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   GENERACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Afijos aplicables a un objeto de una categoría y rareza dadas.
 *
 * @param {string} categoria
 * @param {string} rareza
 * @param {'prefijo'|'sufijo'} [posicion]
 * @returns {Afijo[]}
 */
export function afijosDisponibles(categoria, rareza, posicion) {
  const nivel = indice(rareza);
  return Object.values(AFIJOS).filter((a) =>
    a.categorias.includes(categoria)
    && a.nivelMin <= nivel
    && (!posicion || a.posicion === posicion),
  );
}

/**
 * Elige los afijos de un objeto según su rareza.
 *
 * Se reparte entre prefijos y sufijos de forma alterna, empezando por prefijo,
 * y nunca se repite el mismo afijo. Un objeto arcano lleva tres: dos prefijos y
 * un sufijo, o al revés según disponibilidad.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {string} categoria
 * @param {string} rareza
 * @returns {Afijo[]}
 */
export function elegirAfijos(flujo, categoria, rareza) {
  const cantidad = numeroAfijos(rareza);
  if (cantidad <= 0) return [];

  const elegidos = [];
  const usados = new Set();

  for (let i = 0; i < cantidad; i++) {
    const posicion = i % 2 === 0 ? 'prefijo' : 'sufijo';

    let candidatos = afijosDisponibles(categoria, rareza, posicion)
      .filter((a) => !usados.has(a.refId));

    // Si se agotan los de esa posición, se acepta cualquiera.
    if (!candidatos.length) {
      candidatos = afijosDisponibles(categoria, rareza).filter((a) => !usados.has(a.refId));
    }
    if (!candidatos.length) break;

    const elegido = flujo.elegirPonderado(candidatos.map((a) => ({ valor: a, peso: a.peso })));
    if (!elegido) break;

    elegidos.push(elegido);
    usados.add(elegido.refId);
  }

  return elegidos;
}

/**
 * Compone el nombre completo de un objeto con sus afijos.
 *
 * Concuerda en género: «Afilada espada» y no «Afilado espada».
 *
 * @param {string} nombreBase
 * @param {Afijo[]} afijos
 * @param {'m'|'f'} [genero='m']
 * @returns {string}
 *
 * @example
 * componerNombre('Espada corta', [afilado, del_lobo], 'f')
 * // → 'Afilada espada corta del Lobo'
 */
export function componerNombre(nombreBase, afijos = [], genero = 'm') {
  if (!afijos.length) return nombreBase;

  const prefijos = afijos.filter((a) => a.posicion === 'prefijo');
  const sufijos = afijos.filter((a) => a.posicion === 'sufijo');

  const partes = [];

  for (const p of prefijos) {
    partes.push(genero === 'f' ? (p.nombreF ?? p.nombre) : p.nombre);
  }

  // Con prefijo, el nombre base va en minúscula: «Afilada espada corta».
  partes.push(prefijos.length ? nombreBase.toLowerCase() : nombreBase);

  for (const s of sufijos) partes.push(s.nombre);

  return capitalizar(partes.join(' '));
}

/**
 * Valor final de un objeto con rareza y afijos aplicados.
 *
 * @param {number} valorBase
 * @param {string} rareza
 * @param {Afijo[]} afijos
 * @returns {number}
 */
export function calcularValor(valorBase, rareza, afijos = []) {
  const extraAfijos = afijos.reduce((a, af) => a + (af.valorExtra ?? 0), 0);
  return Math.round(valorBase * multiplicador(rareza) * (1 + extraAfijos));
}

/**
 * Determina la rareza de un hallazgo mediante tirada ponderada.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Object} [opciones]
 * @param {number} [opciones.suerte=0] Desplaza la tabla hacia arriba.
 * @param {string} [opciones.minima='tosco']
 * @param {string} [opciones.maxima='mitico']
 * @returns {string}
 */
export function tirarRareza(flujo, opciones = {}) {
  const { suerte = 0, minima = 'tosco', maxima = 'mitico' } = opciones;

  const iMin = indice(minima);
  const iMax = indice(maxima);

  const entradas = GRADOS_RAREZA
    .map((clave, i) => ({ clave, i }))
    .filter(({ i }) => i >= iMin && i <= iMax)
    .map(({ clave, i }) => {
      const base = OBJETOS.rarezas[clave]?.peso ?? 1;
      // La suerte multiplica el peso de los grados altos sin anular los bajos.
      const factor = suerte > 0 ? 1 + (suerte * i) / 10 : 1;
      return { valor: clave, peso: base * factor };
    });

  return flujo.elegirPonderado(entradas) ?? 'comun';
}

/* ═══════════════════════════════════════════════════════════════════════════
   APLICACIÓN DE EFECTOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Reúne los efectos de todos los afijos de un objeto, agrupados por tipo.
 *
 * Devolverlos agrupados permite que Equipment sume los bonificadores del mismo
 * tipo sin recorrer la lista varias veces.
 *
 * @param {Afijo[]} afijos
 * @returns {Record<string, Array<Object>>}
 */
export function efectosDeAfijos(afijos = []) {
  const grupos = {};
  for (const a of afijos) {
    const tipo = a.efecto?.tipo;
    if (!tipo) continue;
    if (!grupos[tipo]) grupos[tipo] = [];
    grupos[tipo].push({ ...a.efecto, fuente: a.nombre });
  }
  return grupos;
}

/**
 * Descripción legible de los afijos, para el tooltip.
 * @param {Afijo[]} afijos
 * @returns {Array<{nombre: string, descripcion: string}>}
 */
export function describirAfijos(afijos = []) {
  return afijos.map((a) => ({
    nombre: a.nombre,
    descripcion: a.descripcion ?? '',
  }));
}

export default {
  GRADOS_RAREZA,
  META_RAREZA,
  AFIJOS,
  meta,
  indice,
  comparar,
  multiplicador,
  numeroAfijos,
  afijosDisponibles,
  elegirAfijos,
  componerNombre,
  calcularValor,
  tirarRareza,
  efectosDeAfijos,
  describirAfijos,
};
