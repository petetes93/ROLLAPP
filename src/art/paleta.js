/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · src/art/paleta.js
 * ---------------------------------------------------------------------------
 * La paleta única de todo el arte del juego.
 *
 * Existe un solo archivo de color porque el riesgo del arte generado es que
 * cada pieza salga de un juego distinto. El ancla de estilo del proyecto pide
 * «ceniza, hierro y bronce oxidado» y «luz lateral única y suave»: si cada
 * módulo eligiera sus tonos, ese acuerdo se rompería a la tercera pieza.
 *
 * Nada aquí tiene lógica. Son constantes congeladas que consumen `retrato.js`,
 * `paisaje.js` y `criatura.js`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* ═══════════════════════════════════════════════════════════════════════════
   BASE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Grises y metales comunes a todas las piezas.
 *
 * Van de la sombra al reflejo. Cualquier volumen del juego se pinta con dos
 * tonos consecutivos de esta escala, y por eso todo parece iluminado por la
 * misma lámpara.
 */
export const BASE = Object.freeze({
  tinta: '#101216',
  cenizaHonda: '#181B20',
  ceniza: '#22262C',
  cenizaClara: '#2E333A',

  hierroHondo: '#3A4048',
  hierro: '#4C535C',
  hierroClaro: '#6B737D',

  hueso: '#A9A294',
  huesoClaro: '#C8C1B1',

  bronce: '#7C6A45',
  bronceClaro: '#A08A55',
  verdin: '#6E8168',

  brasa: '#B4533A',
  oro: '#C9A227',
});

/**
 * Ángulo de la luz, en grados, para TODAS las piezas.
 *
 * 135° es una lateral alta desde la izquierda. Se expone como constante para
 * que ningún degradado lo reinvente: dos piezas con luces distintas juntas se
 * notan al instante.
 */
export const LUZ = Object.freeze({
  grados: 135,
  // Coordenadas del degradado que corresponden a ese ángulo, en tanto por uno.
  x1: 0, y1: 0, x2: 1, y2: 1,
});

/* ═══════════════════════════════════════════════════════════════════════════
   LINAJES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Color de piel, pelo y rasgo propio de cada linaje.
 *
 * Los tonos salen literalmente del campo `aspecto` de `races.data.js`: si allí
 * dice «piel translúcida de tono cerúleo», aquí hay un cerúleo. Cuando se
 * edite el catálogo, hay que revisar esta tabla o el arte dejará de concordar
 * con lo que el juego dice por escrito.
 *
 * `rasgo` nombra el añadido de silueta que dibuja `retrato.js`.
 */
export const LINAJES = Object.freeze({
  valdes: Object.freeze({
    piel: '#8A6E52', pielSombra: '#5E4A38',
    pelo: '#221C18', ojo: '#3A2E22',
    acento: BASE.bronce, rasgo: 'capas',
  }),
  sombracorteza: Object.freeze({
    piel: '#6B6A5C', pielSombra: '#43443B',
    pelo: '#2B2E26', ojo: '#0C0D0B',
    acento: BASE.verdin, rasgo: 'veta',
  }),
  ferrano: Object.freeze({
    piel: '#9A6B4C', pielSombra: '#6A4833',
    pelo: '#4A3428', ojo: '#3B2A1E',
    acento: BASE.brasa, rasgo: 'barba',
  }),
  albar: Object.freeze({
    piel: '#C3BFC8', pielSombra: '#8E8B96',
    pelo: '#D8D3C6', ojo: '#8FA9AE',
    acento: BASE.huesoClaro, rasgo: 'brillo',
  }),
  griscuerno: Object.freeze({
    piel: '#6B7A85', pielSombra: '#47535C',
    pelo: '#2E3238', ojo: '#C9A227',
    acento: BASE.hueso, rasgo: 'cuernos',
  }),
  menudo: Object.freeze({
    piel: '#B08A66', pielSombra: '#7C5F45',
    pelo: '#5A3C24', ojo: '#4B3521',
    acento: BASE.oro, rasgo: 'rizos',
  }),
  brumal: Object.freeze({
    piel: '#8FA9AE', pielSombra: '#5C7378',
    pelo: '#A8BEC0', ojo: '#D8E4E2',
    acento: '#7FA0A6', rasgo: 'corriente',
  }),
  crisol: Object.freeze({
    piel: '#A8A79E', pielSombra: '#6F6F69',
    pelo: '#8E8D86', ojo: '#C9A227',
    acento: BASE.oro, rasgo: 'vetas',
  }),
});

/** Linaje de reserva: un catálogo ampliado no debe dejar el retrato en blanco. */
export const LINAJE_POR_DEFECTO = LINAJES.valdes;

/* ═══════════════════════════════════════════════════════════════════════════
   TERRENOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Paleta y perfil de horizonte de cada terreno de `locations.data.js`.
 *
 * `capas` describe el relieve de fondo a primer plano; `paisaje.js` lo traduce
 * a bandas. `aire` tiñe la neblina de distancia, que es lo que separa un
 * pantano de una montaña incluso con la misma silueta.
 */
export const TERRENOS = Object.freeze({
  camino: Object.freeze({
    aire: '#6E7462', lejos: '#4A5145', medio: '#3A4038', cerca: '#262A26',
    capas: ['colinas', 'colinas', 'llano'], acento: BASE.bronce,
  }),
  bosque: Object.freeze({
    aire: '#5C6656', lejos: '#3E4A3C', medio: '#2C362C', cerca: '#1C231D',
    capas: ['arboles', 'arboles', 'llano'], acento: BASE.verdin,
  }),
  montana: Object.freeze({
    aire: '#7C8490', lejos: '#4E5660', medio: '#3A414A', cerca: '#242A31',
    capas: ['picos', 'picos', 'roca'], acento: BASE.hierroClaro,
  }),
  pantano: Object.freeze({
    aire: '#5E6E6A', lejos: '#3C4A48', medio: '#2A3634', cerca: '#1A2422',
    capas: ['juncos', 'agua', 'agua'], acento: '#7FA0A6',
  }),
  ruinas: Object.freeze({
    aire: '#7A7468', lejos: '#4E4A42', medio: '#3A3730', cerca: '#252320',
    capas: ['columnas', 'muros', 'llano'], acento: BASE.hueso,
  }),
  desierto: Object.freeze({
    aire: '#A08A62', lejos: '#7A6544', medio: '#5A4A32', cerca: '#3A3022',
    capas: ['dunas', 'dunas', 'llano'], acento: BASE.oro,
  }),
  mazmorra: Object.freeze({
    aire: '#2E3138', lejos: '#242830', medio: '#1C1F26', cerca: '#12141A',
    capas: ['boveda', 'muros', 'roca'], acento: BASE.brasa,
  }),
});

export const TERRENO_POR_DEFECTO = TERRENOS.camino;

/* ═══════════════════════════════════════════════════════════════════════════
   HORA Y CLIMA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Cielo y luz por franja horaria.
 *
 * El paisaje se repinta cuando cambia la hora, así que el mismo lugar a
 * mediodía y de noche no es la misma imagen. Es lo que un archivo estático no
 * puede dar, y la razón principal de generar el arte por código.
 *
 * `luz` multiplica el brillo de las capas de terreno; `tinte` es el color con
 * el que se lava toda la escena.
 */
export const FRANJAS = Object.freeze({
  madrugada: Object.freeze({ cielo: ['#141821', '#1E2530'], luz: 0.45, tinte: '#2A3345', velo: 0.32 }),
  alba: Object.freeze({ cielo: ['#3A3040', '#8A6A56'], luz: 0.78, tinte: '#8A6A56', velo: 0.20 }),
  manana: Object.freeze({ cielo: ['#5A6A78', '#9AA6A8'], luz: 1.00, tinte: '#9AA6A8', velo: 0.10 }),
  mediodia: Object.freeze({ cielo: ['#6E8090', '#B4BCB8'], luz: 1.12, tinte: '#B4BCB8', velo: 0.06 }),
  tarde: Object.freeze({ cielo: ['#6A6A6E', '#A08A6E'], luz: 0.95, tinte: '#A08A6E', velo: 0.12 }),
  ocaso: Object.freeze({ cielo: ['#33303E', '#A0603C'], luz: 0.72, tinte: '#A0603C', velo: 0.22 }),
  noche: Object.freeze({ cielo: ['#0E1118', '#1A2029'], luz: 0.38, tinte: '#1E2836', velo: 0.38 }),
});

export const FRANJA_POR_DEFECTO = FRANJAS.manana;

/**
 * Velos de clima que se superponen al paisaje ya pintado.
 *
 * `null` en `despejado` porque no dibujar nada es más barato que dibujar algo
 * transparente, y esta capa se repinta en cada turno.
 */
export const CLIMAS = Object.freeze({
  despejado: null,
  nublado: Object.freeze({ color: '#8A9098', opacidad: 0.14, trazos: 0 }),
  niebla: Object.freeze({ color: '#AEB6B8', opacidad: 0.30, trazos: 0 }),
  lluvia: Object.freeze({ color: '#7E8A96', opacidad: 0.18, trazos: 60 }),
  tormenta: Object.freeze({ color: '#5A6470', opacidad: 0.30, trazos: 110 }),
  nieve: Object.freeze({ color: '#C6CCD0', opacidad: 0.22, trazos: 70 }),
  viento: Object.freeze({ color: '#96A08E', opacidad: 0.12, trazos: 30 }),
  calor: Object.freeze({ color: '#C09050', opacidad: 0.16, trazos: 0 }),
});

/* ═══════════════════════════════════════════════════════════════════════════
   CRIATURAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Color y forma base por tipo de enemigo.
 *
 * `silueta` elige el constructor de `criatura.js`. Los tipos son los de
 * `enemies.data.js`; si se añade uno nuevo allí sin añadirlo aquí, cae en
 * `TIPO_CRIATURA_POR_DEFECTO` y sale una bestia genérica en vez de un hueco.
 */
export const TIPOS_CRIATURA = Object.freeze({
  bestia: Object.freeze({
    cuerpo: '#4A4238', cuerpoSombra: '#2A251F', detalle: '#8A7A5E',
    ojo: BASE.oro, silueta: 'cuadrupedo',
  }),
  humanoide: Object.freeze({
    cuerpo: '#4C4A46', cuerpoSombra: '#2C2B28', detalle: BASE.bronce,
    ojo: '#D8D0C0', silueta: 'bipedo',
  }),
  no_muerto: Object.freeze({
    cuerpo: '#5C6670', cuerpoSombra: '#333A42', detalle: '#9AA8B0',
    ojo: '#BFE0E4', silueta: 'espectro',
  }),
  aberracion: Object.freeze({
    cuerpo: '#3A3444', cuerpoSombra: '#201D28', detalle: '#6E5F80',
    ojo: '#C9A227', silueta: 'informe',
  }),
  construido: Object.freeze({
    cuerpo: '#8A887E', cuerpoSombra: '#56554F', detalle: BASE.oro,
    ojo: BASE.oro, silueta: 'coloso',
  }),
});

export const TIPO_CRIATURA_POR_DEFECTO = TIPOS_CRIATURA.bestia;

/**
 * Cuánto ocupa la criatura dentro de su marco, por tamaño.
 *
 * Se dibuja siempre en el mismo lienzo y se escala: así un devorador enorme y
 * una rata comparten encuadre y la diferencia se lee de un vistazo.
 */
export const TAMANOS = Object.freeze({
  pequeno: 0.42,
  mediano: 0.62,
  grande: 0.80,
  enorme: 0.96,
});

export const TAMANO_POR_DEFECTO = 0.62;
