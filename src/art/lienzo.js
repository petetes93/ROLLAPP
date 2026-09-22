/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · src/art/lienzo.js
 * ---------------------------------------------------------------------------
 * El marco común de todas las piezas de arte.
 *
 * Aquí viven el degradado de luz, la viñeta y el grano. Los tres van juntos y
 * en el mismo orden en cada pieza, y son la mitad de lo que hace que un
 * retrato y un paisaje generados por separado parezcan del mismo juego: misma
 * lámpara, mismos bordes apagados, misma textura encima.
 *
 * Todo son funciones puras que devuelven cadenas. No tocan el DOM.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { LUZ } from './paleta.js';

/* ═══════════════════════════════════════════════════════════════════════════
   IDENTIFICADORES
   ═══════════════════════════════════════════════════════════════════════════ */

let contador = 0;

/**
 * Devuelve un identificador irrepetible para los `defs` de una pieza.
 *
 * Hace falta porque en pantalla conviven varios SVG a la vez —retrato, paisaje
 * y criatura— y los `id` de un `<defs>` son globales al documento. Con ids
 * fijos, el filtro de grano del paisaje acabaría aplicándose al retrato.
 *
 * @param {string} prefijo
 * @returns {string}
 */
export function idUnico(prefijo) {
  contador += 1;
  return `${prefijo}-${contador.toString(36)}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   FORMATO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Recorta un número a dos decimales.
 *
 * Un paisaje son cientos de coordenadas; sin recortar, la mitad del peso del
 * SVG son decimales que nadie ve.
 *
 * @param {number} n
 * @returns {string}
 */
export function num(n) {
  return String(Math.round(n * 100) / 100);
}

/**
 * Escapa un texto para meterlo en un atributo XML.
 *
 * Los nombres del catálogo llevan tildes y comillas («Vado del Yunque», «La
 * Señora del Pantano»); sin escapar, un apóstrofo parte el atributo y el SVG
 * entero deja de dibujarse.
 *
 * @param {string} texto
 * @returns {string}
 */
export function escapar(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convierte una lista de puntos en una ruta cerrada.
 *
 * @param {Array<[number, number]>} puntos
 * @param {boolean} cerrar
 * @returns {string}
 */
export function ruta(puntos, cerrar = true) {
  if (!puntos.length) return '';

  const cuerpo = puntos
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${num(x)} ${num(y)}`)
    .join('');

  return cerrar ? `${cuerpo}Z` : cuerpo;
}

/**
 * Convierte una lista de puntos en una curva suave (Catmull-Rom a Bézier).
 *
 * Las siluetas de terreno y de criatura salen de puntos con ruido; unidos con
 * rectas parecen un gráfico de barras. Suavizarlas es lo que las hace parecer
 * dibujadas.
 *
 * @param {Array<[number, number]>} puntos
 * @param {boolean} cerrar
 * @returns {string}
 */
export function curva(puntos, cerrar = false) {
  if (puntos.length < 3) return ruta(puntos, cerrar);

  let d = `M${num(puntos[0][0])} ${num(puntos[0][1])}`;

  for (let i = 0; i < puntos.length - 1; i++) {
    const p0 = puntos[i - 1] ?? puntos[i];
    const p1 = puntos[i];
    const p2 = puntos[i + 1];
    const p3 = puntos[i + 2] ?? p2;

    // Tensión 1/6: el valor clásico de Catmull-Rom uniforme. Más alto ondula
    // de más y las montañas parecen gelatina.
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;

    d += `C${num(c1x)} ${num(c1y)},${num(c2x)} ${num(c2y)},${num(p2[0])} ${num(p2[1])}`;
  }

  return cerrar ? `${d}Z` : d;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COLOR
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Aclara u oscurece un color hexadecimal.
 *
 * @param {string} hex `#RRGGBB`
 * @param {number} factor 1 deja igual, 1.2 aclara, 0.8 oscurece.
 * @returns {string}
 */
export function brillo(hex, factor) {
  const limpio = String(hex).replace('#', '');

  const n = parseInt(limpio.length === 3
    ? limpio.split('').map((c) => c + c).join('')
    : limpio, 16);

  if (!Number.isFinite(n)) return hex;

  const topar = (v) => Math.max(0, Math.min(255, Math.round(v * factor)));

  const r = topar((n >> 16) & 255);
  const g = topar((n >> 8) & 255);
  const b = topar(n & 255);

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Mezcla dos colores.
 *
 * @param {string} a
 * @param {string} b
 * @param {number} t 0 devuelve `a`, 1 devuelve `b`.
 * @returns {string}
 */
export function mezclar(a, b, t) {
  const leer = (hex) => {
    const n = parseInt(String(hex).replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  const [r1, g1, b1] = leer(a);
  const [r2, g2, b2] = leer(b);

  const m = (x, y) => Math.round(x + (y - x) * Math.max(0, Math.min(1, t)));

  return `#${((m(r1, r2) << 16) | (m(g1, g2) << 8) | m(b1, b2))
    .toString(16).padStart(6, '0')}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PIEZAS DEL MARCO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Degradado que representa la luz lateral única del ancla de estilo.
 *
 * @param {string} id
 * @param {string} claro Cara iluminada.
 * @param {string} oscuro Cara en sombra.
 * @returns {string}
 */
export function degradadoLuz(id, claro, oscuro) {
  return `<linearGradient id="${id}" x1="${LUZ.x1}" y1="${LUZ.y1}" `
    + `x2="${LUZ.x2}" y2="${LUZ.y2}">`
    + `<stop offset="0" stop-color="${claro}"/>`
    + `<stop offset="1" stop-color="${oscuro}"/>`
    + '</linearGradient>';
}

/**
 * Degradado vertical, para cielos y suelos.
 *
 * @param {string} id
 * @param {string} arriba
 * @param {string} abajo
 * @returns {string}
 */
export function degradadoVertical(id, arriba, abajo) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" stop-color="${arriba}"/>`
    + `<stop offset="1" stop-color="${abajo}"/>`
    + '</linearGradient>';
}

/**
 * Viñeta: oscurece las esquinas para que la mirada caiga al centro.
 *
 * @param {string} id
 * @param {number} fuerza 0 a 1.
 * @returns {string}
 */
export function defsVineta(id, fuerza = 0.55) {
  return `<radialGradient id="${id}" cx="0.5" cy="0.45" r="0.75">`
    + '<stop offset="0.45" stop-color="#000" stop-opacity="0"/>'
    + `<stop offset="1" stop-color="#000" stop-opacity="${num(fuerza)}"/>`
    + '</radialGradient>';
}

/**
 * Grano: la textura que quita el aspecto de vector limpio.
 *
 * Es lo que más acerca el resultado a «pintura al óleo apagada» sin pintar
 * nada. `feTurbulence` con pocas octavas es barato y no depende de ningún
 * archivo externo.
 *
 * @param {string} id
 * @param {number} semilla
 * @returns {string}
 */
export function defsGrano(id, semilla = 1) {
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%">`
    + `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" `
    + `seed="${Math.round(semilla)}" result="ruido"/>`
    + '<feColorMatrix type="saturate" values="0" in="ruido" result="gris"/>'
    + '<feComponentTransfer in="gris">'
    + '<feFuncA type="linear" slope="0.5" intercept="0"/>'
    + '</feComponentTransfer>'
    + '</filter>';
}

/**
 * Envuelve un cuerpo en un SVG completo con marco.
 *
 * @param {Object} opciones
 * @param {number} opciones.ancho
 * @param {number} opciones.alto
 * @param {string} opciones.etiqueta Texto alternativo, para lectores de pantalla.
 * @param {string} [opciones.defs]
 * @param {string} opciones.cuerpo
 * @param {number} [opciones.semilla]
 * @param {number} [opciones.vineta]
 * @param {number} [opciones.grano]
 * @param {string} [opciones.clase]
 * @param {string} [opciones.recorte] Valor de `preserveAspectRatio`. Importa
 *   cuando el hueco no tiene la misma proporción que el lienzo: en un retrato
 *   hay que conservar la cabeza y perder el pecho, no recortar por igual
 *   arriba y abajo, que es lo que le corta los cuernos a un griscuerno.
 * @returns {string}
 */
export function lienzo(opciones) {
  const {
    ancho, alto, etiqueta, defs = '', cuerpo,
    semilla = 1, vineta = 0.55, grano = 0.10, clase = '',
    recorte = 'xMidYMid slice',
  } = opciones;

  const idV = idUnico('vin');
  const idG = idUnico('gra');

  const capas = [
    cuerpo,
    vineta > 0
      ? `<rect width="${ancho}" height="${alto}" fill="url(#${idV})"/>`
      : '',
    grano > 0
      ? `<rect width="${ancho}" height="${alto}" filter="url(#${idG})" `
        + `opacity="${num(grano)}" style="mix-blend-mode:overlay"/>`
      : '',
  ].join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" `
    + `preserveAspectRatio="${escapar(recorte)}" role="img" `
    + `aria-label="${escapar(etiqueta)}"${clase ? ` class="${escapar(clase)}"` : ''}>`
    + `<defs>${defs}${vineta > 0 ? defsVineta(idV, vineta) : ''}`
    + `${grano > 0 ? defsGrano(idG, semilla) : ''}</defs>`
    + capas
    + '</svg>';
}
