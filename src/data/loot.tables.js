/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · data/loot.tables.js
 * ---------------------------------------------------------------------------
 * Tablas de botín por amenaza, terreno y tipo de hallazgo.
 *
 * Tres dimensiones que se combinan:
 *   · AMENAZA  — cuánto suelta un enemigo según su grado
 *   · TERRENO  — qué es plausible encontrar en cada sitio
 *   · CONTENEDOR — cofres, cadáveres, alijos, sacos
 *
 * La lógica de negocio no vive aquí: esto son datos. `LootGenerator` los
 * combina y tira. Separarlo permite reequilibrar la generosidad del juego
 * editando una tabla, sin tocar una línea de código.
 *
 * Sin dependencias.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* ═══════════════════════════════════════════════════════════════════════════
   BOTÍN POR AMENAZA
   ---------------------------------------------------------------------------
   Lo que suelta un enemigo derrotado. `probabilidadObjeto` es la posibilidad de
   que suelte algo más allá del oro: un lobo no lleva pociones encima.
   ═══════════════════════════════════════════════════════════════════════════ */

export const POR_AMENAZA = Object.freeze({
  insignificante: {
    probabilidadObjeto: 0.15,
    objetos: { min: 0, max: 1 },
    rarezaMin: 'tosco', rarezaMax: 'comun',
    suerte: 0,
  },
  menor: {
    probabilidadObjeto: 0.3,
    objetos: { min: 0, max: 1 },
    rarezaMin: 'tosco', rarezaMax: 'comun',
    suerte: 0,
  },
  normal: {
    probabilidadObjeto: 0.5,
    objetos: { min: 1, max: 2 },
    rarezaMin: 'tosco', rarezaMax: 'fino',
    suerte: 0,
  },
  peligroso: {
    probabilidadObjeto: 0.7,
    objetos: { min: 1, max: 2 },
    rarezaMin: 'comun', rarezaMax: 'superior',
    suerte: 1,
  },
  letal: {
    probabilidadObjeto: 0.85,
    objetos: { min: 1, max: 3 },
    rarezaMin: 'comun', rarezaMax: 'arcano',
    suerte: 2,
  },
  jefe: {
    probabilidadObjeto: 1.0,
    objetos: { min: 2, max: 3 },
    rarezaMin: 'fino', rarezaMax: 'legendario',
    suerte: 4,
    garantizaRareza: 'superior',
  },
  jefeMayor: {
    probabilidadObjeto: 1.0,
    objetos: { min: 3, max: 5 },
    rarezaMin: 'superior', rarezaMax: 'mitico',
    suerte: 7,
    garantizaRareza: 'arcano',
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   BOTÍN POR TERRENO
   ---------------------------------------------------------------------------
   Qué es verosímil encontrar en cada sitio. `pesos` sesga las categorías: en
   una mazmorra aparecen armas; en un bosque, materiales y comida.
   ═══════════════════════════════════════════════════════════════════════════ */

export const POR_TERRENO = Object.freeze({
  ciudad: {
    pesos: { util: 30, consumible: 25, magico: 10, material: 20, arma: 10, armadura: 5 },
    especificos: ['racion_viaje', 'odre_agua', 'antorcha', 'cuerda', 'venda'],
    modificadorRareza: 0,
  },
  camino: {
    pesos: { consumible: 35, util: 25, material: 20, arma: 12, armadura: 8 },
    especificos: ['racion_viaje', 'odre_agua', 'antorcha', 'moneda_suerte'],
    modificadorRareza: 0,
  },
  bosque: {
    pesos: { material: 40, consumible: 25, util: 15, arma: 12, armadura: 8 },
    especificos: ['piel_curtida', 'flecha', 'cuerda', 'cuchillo_caza'],
    modificadorRareza: 0,
  },
  montana: {
    pesos: { material: 35, arma: 20, armadura: 20, util: 15, consumible: 10 },
    especificos: ['chatarra', 'gema_menor', 'hacha_mano', 'cuerda'],
    modificadorRareza: 1,
  },
  ruinas: {
    pesos: { material: 25, magico: 25, arma: 20, armadura: 15, util: 15 },
    especificos: ['reliquia_antigua', 'chatarra', 'gema_menor', 'tinta_plata'],
    modificadorRareza: 2,
  },
  mazmorra: {
    pesos: { arma: 25, armadura: 22, magico: 20, consumible: 18, material: 15 },
    especificos: ['pocion_curacion', 'antorcha', 'ganzuas', 'gema_menor'],
    modificadorRareza: 2,
  },
  pantano: {
    pesos: { material: 35, consumible: 25, magico: 20, util: 12, arma: 8 },
    especificos: ['antidoto', 'incienso', 'tinta_plata'],
    modificadorRareza: 1,
  },
  desierto: {
    pesos: { material: 30, consumible: 30, util: 20, arma: 12, armadura: 8 },
    especificos: ['odre_agua', 'capa_viaje', 'gema_menor'],
    modificadorRareza: 1,
  },
  oceano: {
    pesos: { material: 35, util: 25, consumible: 20, arma: 12, magico: 8 },
    especificos: ['cuerda', 'odre_agua', 'chatarra'],
    modificadorRareza: 1,
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   CONTENEDORES
   ---------------------------------------------------------------------------
   Lo que se encuentra al registrar algo. Cada tipo tiene su perfil: un cadáver
   da poco, un alijo escondido compensa el esfuerzo de encontrarlo.
   ═══════════════════════════════════════════════════════════════════════════ */

export const CONTENEDORES = Object.freeze({
  cadaver: {
    nombre: 'cadáver',
    oro: { min: 0, max: 15 },
    objetos: { min: 0, max: 2 },
    rarezaMin: 'tosco', rarezaMax: 'fino',
    suerte: 0,
    descripcion: 'Los bolsillos de alguien que ya no los necesita.',
  },
  saco: {
    nombre: 'saco',
    oro: { min: 0, max: 8 },
    objetos: { min: 1, max: 2 },
    rarezaMin: 'tosco', rarezaMax: 'comun',
    suerte: 0,
    descripcion: 'Un fardo abandonado.',
  },
  cofre: {
    nombre: 'cofre',
    oro: { min: 20, max: 120 },
    objetos: { min: 1, max: 3 },
    rarezaMin: 'comun', rarezaMax: 'superior',
    suerte: 1,
    descripcion: 'Un arca con cerradura.',
    puedeEstarCerrado: true,
    puedeTenerTrampa: true,
  },
  cofre_reforzado: {
    nombre: 'cofre reforzado',
    oro: { min: 60, max: 300 },
    objetos: { min: 2, max: 4 },
    rarezaMin: 'fino', rarezaMax: 'arcano',
    suerte: 3,
    descripcion: 'Hierro y cerradura doble. Alguien guardaba algo aquí.',
    puedeEstarCerrado: true,
    puedeTenerTrampa: true,
    dificultadCerradura: 'dificil',
  },
  alijo: {
    nombre: 'alijo',
    oro: { min: 30, max: 200 },
    objetos: { min: 1, max: 3 },
    rarezaMin: 'comun', rarezaMax: 'arcano',
    suerte: 2,
    descripcion: 'Escondido a propósito, y bien.',
  },
  altar: {
    nombre: 'altar',
    oro: { min: 0, max: 50 },
    objetos: { min: 1, max: 2 },
    rarezaMin: 'fino', rarezaMax: 'legendario',
    suerte: 4,
    descripcion: 'Ofrendas dejadas por quienes ya no vuelven.',
    consecuenciaMoral: 'saquear',
  },
  despensa: {
    nombre: 'despensa',
    oro: { min: 0, max: 5 },
    objetos: { min: 2, max: 5 },
    rarezaMin: 'tosco', rarezaMax: 'comun',
    suerte: 0,
    categoriaForzada: 'consumible',
    descripcion: 'Provisiones almacenadas.',
  },
  armeria: {
    nombre: 'armería',
    oro: { min: 0, max: 20 },
    objetos: { min: 2, max: 4 },
    rarezaMin: 'comun', rarezaMax: 'superior',
    suerte: 1,
    categoriasPermitidas: ['arma', 'armadura', 'escudo'],
    descripcion: 'Armas y protecciones en sus soportes.',
  },
  biblioteca: {
    nombre: 'estantería',
    oro: { min: 0, max: 10 },
    objetos: { min: 1, max: 3 },
    rarezaMin: 'comun', rarezaMax: 'arcano',
    suerte: 2,
    categoriasPermitidas: ['util', 'magico', 'material'],
    descripcion: 'Volúmenes y notas acumuladas.',
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   HALLAZGOS DE EXPLORACIÓN
   ---------------------------------------------------------------------------
   Lo que aparece al registrar una zona sin que haya combate. Deliberadamente
   modesto: la exploración recompensa con información y descubrimientos, no con
   equipo.
   ═══════════════════════════════════════════════════════════════════════════ */

export const HALLAZGOS = Object.freeze({
  forrajeo: {
    nombre: 'hierbas y frutos',
    habilidad: 'supervivencia',
    umbral: 'facil',
    objetos: ['racion_viaje'],
    cantidad: { min: 1, max: 2 },
    terrenos: ['bosque', 'pantano', 'montana'],
  },
  agua: {
    nombre: 'una fuente',
    habilidad: 'supervivencia',
    umbral: 'facil',
    efecto: { tipo: 'rellenar', refId: 'odre_agua' },
    terrenos: ['bosque', 'montana', 'pantano', 'camino'],
  },
  restos: {
    nombre: 'restos aprovechables',
    habilidad: 'percepcion',
    umbral: 'moderada',
    objetos: ['chatarra', 'piel_curtida', 'cuerda'],
    cantidad: { min: 1, max: 1 },
    terrenos: ['ruinas', 'mazmorra', 'camino', 'oceano'],
  },
  escondrijo: {
    nombre: 'un escondrijo',
    habilidad: 'percepcion',
    umbral: 'dificil',
    contenedor: 'alijo',
    terrenos: ['ciudad', 'ruinas', 'mazmorra'],
  },
  vestigio: {
    nombre: 'un vestigio antiguo',
    habilidad: 'saber_arcano',
    umbral: 'dificil',
    objetos: ['reliquia_antigua', 'gema_menor'],
    cantidad: { min: 1, max: 1 },
    terrenos: ['ruinas', 'mazmorra', 'montana'],
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   MODIFICADORES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Multiplicadores de generosidad según el preajuste de dificultad.
 * En modo Relato el botín es más abundante; en Implacable, escaso.
 */
export const POR_DIFICULTAD = Object.freeze({
  relato: { oro: 1.4, objetos: 1.3, suerte: 2 },
  equilibrado: { oro: 1.0, objetos: 1.0, suerte: 0 },
  duro: { oro: 0.75, objetos: 0.85, suerte: -1 },
  implacable: { oro: 0.55, objetos: 0.7, suerte: -2 },
});

/**
 * Probabilidad de que un contenedor esté cerrado o tenga trampa, según el
 * terreno. En una mazmorra casi todo está protegido; en un camino, no.
 */
export const SEGURIDAD_CONTENEDOR = Object.freeze({
  ciudad: { cerrado: 0.5, trampa: 0.1 },
  camino: { cerrado: 0.2, trampa: 0.05 },
  bosque: { cerrado: 0.15, trampa: 0.1 },
  montana: { cerrado: 0.3, trampa: 0.15 },
  ruinas: { cerrado: 0.45, trampa: 0.3 },
  mazmorra: { cerrado: 0.6, trampa: 0.45 },
  pantano: { cerrado: 0.25, trampa: 0.2 },
  desierto: { cerrado: 0.3, trampa: 0.15 },
  oceano: { cerrado: 0.35, trampa: 0.1 },
});

/* ═══════════════════════════════════════════════════════════════════════════
   CONSULTAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @param {string} amenaza
 * @returns {Object}
 */
export function perfilAmenaza(amenaza) {
  return POR_AMENAZA[amenaza] ?? POR_AMENAZA.normal;
}

/**
 * @param {string} terreno
 * @returns {Object}
 */
export function perfilTerreno(terreno) {
  return POR_TERRENO[terreno] ?? POR_TERRENO.camino;
}

/**
 * @param {string} tipo
 * @returns {Object}
 */
export function perfilContenedor(tipo) {
  return CONTENEDORES[tipo] ?? CONTENEDORES.saco;
}

/**
 * Hallazgos posibles en un terreno.
 * @param {string} terreno
 * @returns {Array<Object>}
 */
export function hallazgosDe(terreno) {
  return Object.entries(HALLAZGOS)
    .filter(([, h]) => h.terrenos.includes(terreno))
    .map(([clave, h]) => ({ clave, ...h }));
}

export default {
  POR_AMENAZA,
  POR_TERRENO,
  CONTENEDORES,
  HALLAZGOS,
  POR_DIFICULTAD,
  SEGURIDAD_CONTENEDOR,
  perfilAmenaza,
  perfilTerreno,
  perfilContenedor,
  hallazgosDe,
};
