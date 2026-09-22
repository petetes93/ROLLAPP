/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · src/art/criatura.js
 * ---------------------------------------------------------------------------
 * Criatura generada a partir de su tipo y su tamaño.
 *
 * Se dibuja a contraluz, casi en silueta, y por dos razones. La primera es de
 * estilo: el ancla prohíbe el detalle y la fantasía épica, y una silueta con
 * dos ojos encendidos da más miedo que una ilustración explícita. La segunda es
 * honesta: una silueta generada por código aguanta la comparación con arte
 * dibujado; una criatura detallada, no.
 *
 * El tamaño no cambia el lienzo, cambia cuánto lo llena. Así una rata y un
 * guardián de cuatro metros comparten encuadre y la diferencia se lee sola.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { hashSemilla, Flujo } from '../core/RNG.js';
import {
  TIPOS_CRIATURA, TIPO_CRIATURA_POR_DEFECTO, TAMANOS, TAMANO_POR_DEFECTO, BASE,
} from './paleta.js';
import {
  lienzo, idUnico, num, curva, brillo, mezclar, degradadoLuz, degradadoVertical,
} from './lienzo.js';

const ANCHO = 320;
const ALTO = 320;
const SUELO_Y = ALTO * 0.88;

/* ═══════════════════════════════════════════════════════════════════════════
   SILUETAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Cuadrúpedo: bestias. Lomo bajo, cabeza adelantada, cuatro patas.
 *
 * @param {Flujo} flujo
 * @param {number} escala
 * @param {Object} tonos
 * @returns {string}
 */
function cuadrupedo(flujo, escala, tonos) {
  const cx = ANCHO * 0.5;
  const largo = 150 * escala;
  const alto = 78 * escala;
  const y = SUELO_Y;

  const piezas = [];

  // Patas: las traseras primero y más oscuras, para que haya un lado lejano y
  // otro cercano. Cuatro palos iguales daban una mesa, no un animal.
  const pata = (px, flexion, color, grosor) => {
    const rodilla = y - alto * 0.28;

    return `<path d="M${num(px)} ${num(y - alto * 0.46)}`
      + `L${num(px + flexion)} ${num(rodilla)}`
      + `L${num(px + flexion * 0.3)} ${num(y)}" `
      + `stroke="${color}" stroke-width="${num(grosor)}" fill="none" `
      + 'stroke-linecap="round" stroke-linejoin="round"/>';
  };

  const sombraPata = brillo(tonos.cuerpoSombra, 0.62);

  piezas.push(pata(cx - largo * 0.30, -7 * escala, sombraPata, 7 * escala));
  piezas.push(pata(cx + largo * 0.28, 7 * escala, sombraPata, 7 * escala));

  // Cola, detrás del cuerpo.
  piezas.push(`<path d="M${num(cx - largo * 0.46)} ${num(y - alto * 0.62)}`
    + `q${num(-30 * escala)} ${num(-14 * escala)} ${num(-52 * escala)} ${num(10 * escala)}" `
    + `stroke="${tonos.cuerpoSombra}" stroke-width="${num(6 * escala)}" `
    + 'fill="none" stroke-linecap="round"/>');

  // Cuerpo: grupa alta atrás, hundido en la cruz, pecho adelantado. Ese perfil
  // en ese orden es lo que lee como cuadrúpedo y no como un saco.
  const lomo = [
    [cx - largo * 0.48, y - alto * 0.60],   // nalga
    [cx - largo * 0.30, y - alto * 0.94],   // grupa, el punto más alto atrás
    [cx - largo * 0.02, y - alto * 0.80],   // hundido de la espalda
    [cx + largo * 0.26, y - alto * 0.92],   // cruz
    [cx + largo * 0.44, y - alto * 0.78],   // arranque del cuello
  ];

  const vientre = [
    [cx + largo * 0.40, y - alto * 0.34],
    [cx + largo * 0.02, y - alto * 0.26],
    [cx - largo * 0.40, y - alto * 0.36],
  ];

  piezas.push(`<path d="${curva([...lomo, ...vientre], true)}" fill="${tonos.cuerpo}"/>`);

  // Sombra del vientre: separa el cuerpo de las patas cercanas.
  piezas.push(`<path d="${curva(vientre, false)}" stroke="${tonos.cuerpoSombra}" `
    + `stroke-width="${num(10 * escala)}" fill="none" opacity="0.55" `
    + 'stroke-linecap="round"/>');

  // Patas delanteras, por delante del cuerpo y más claras.
  piezas.push(pata(cx - largo * 0.20, -4 * escala, tonos.cuerpoSombra, 8 * escala));
  piezas.push(pata(cx + largo * 0.36, 5 * escala, tonos.cuerpoSombra, 8 * escala));

  /* ── Cabeza ───────────────────────────────────────────────────────────── */
  // Baja y adelantada: postura de acecho, no de perro sentado.
  const cabX = cx + largo * 0.56;
  const cabY = y - alto * 0.74;

  // Cuello, del hombro a la nuca.
  piezas.push(`<path d="M${num(cx + largo * 0.30)} ${num(y - alto * 0.86)}`
    + `L${num(cabX - 6 * escala)} ${num(cabY - 12 * escala)}`
    + `L${num(cabX - 2 * escala)} ${num(cabY + 16 * escala)}`
    + `L${num(cx + largo * 0.26)} ${num(y - alto * 0.44)}Z" fill="${tonos.cuerpo}"/>`);

  // Cráneo: una cuña, no una pelota.
  piezas.push(`<path d="M${num(cabX - 16 * escala)} ${num(cabY - 14 * escala)}`
    + `L${num(cabX + 12 * escala)} ${num(cabY - 11 * escala)}`
    + `L${num(cabX + 40 * escala)} ${num(cabY + 4 * escala)}`
    + `L${num(cabX + 36 * escala)} ${num(cabY + 13 * escala)}`
    + `L${num(cabX + 6 * escala)} ${num(cabY + 18 * escala)}`
    + `L${num(cabX - 16 * escala)} ${num(cabY + 8 * escala)}Z" `
    + `fill="${tonos.cuerpo}"/>`);

  // Mandíbula entreabierta.
  piezas.push(`<path d="M${num(cabX + 14 * escala)} ${num(cabY + 12 * escala)}`
    + `L${num(cabX + 38 * escala)} ${num(cabY + 11 * escala)}`
    + `L${num(cabX + 14 * escala)} ${num(cabY + 20 * escala)}Z" `
    + `fill="${brillo(tonos.cuerpoSombra, 0.5)}"/>`);

  // Orejas: hacia atrás, pegadas al cráneo.
  for (let i = 0; i < 2; i++) {
    const dx = i * 7 * escala;

    piezas.push(`<path d="M${num(cabX - 12 * escala + dx)} ${num(cabY - 12 * escala)}`
      + `L${num(cabX - 24 * escala + dx)} ${num(cabY - 34 * escala)}`
      + `L${num(cabX - 2 * escala + dx)} ${num(cabY - 16 * escala)}Z" `
      + `fill="${i === 0 ? sombraPata : tonos.cuerpoSombra}"/>`);
  }

  // Un solo ojo: de perfil solo se ve uno, y dos ahí parecían frontales.
  piezas.push(ojo(cabX + 12 * escala, cabY - 2 * escala, 5.5 * escala, tonos));

  return piezas.join('');
}

/**
 * Bípedo: humanoides. De pie, hombros anchos, arma insinuada.
 *
 * @param {Flujo} flujo
 * @param {number} escala
 * @param {Object} tonos
 * @returns {string}
 */
function bipedo(flujo, escala, tonos) {
  const cx = ANCHO * 0.5;
  const alto = 210 * escala;
  const y = SUELO_Y;
  const hombro = y - alto * 0.76;
  const anchoHombro = 42 * escala;

  const piezas = [];

  // Piernas.
  for (const lado of [-1, 1]) {
    piezas.push(`<path d="M${num(cx + lado * 13 * escala)} ${num(y - alto * 0.44)}`
      + `L${num(cx + lado * 18 * escala)} ${num(y)}" `
      + `stroke="${tonos.cuerpoSombra}" stroke-width="${num(15 * escala)}" `
      + 'stroke-linecap="round"/>');
  }

  // Torso: trapecio de hombros a cadera.
  piezas.push(`<path d="M${num(cx - anchoHombro)} ${num(hombro)}`
    + `L${num(cx + anchoHombro)} ${num(hombro)}`
    + `L${num(cx + anchoHombro * 0.62)} ${num(y - alto * 0.40)}`
    + `L${num(cx - anchoHombro * 0.62)} ${num(y - alto * 0.40)}Z" fill="${tonos.cuerpo}"/>`);

  // Brazos.
  for (const lado of [-1, 1]) {
    const codo = flujo.flotante(0.52, 0.62);

    piezas.push(`<path d="M${num(cx + lado * anchoHombro * 0.92)} ${num(hombro + 6 * escala)}`
      + `L${num(cx + lado * anchoHombro * 1.24)} ${num(y - alto * codo)}`
      + `L${num(cx + lado * anchoHombro * 0.96)} ${num(y - alto * 0.34)}" `
      + `stroke="${tonos.cuerpoSombra}" stroke-width="${num(11 * escala)}" `
      + 'fill="none" stroke-linecap="round" stroke-linejoin="round"/>');
  }

  // Arma: una vara larga en diagonal. Insinuada, no descrita.
  piezas.push(`<line x1="${num(cx + anchoHombro * 1.1)}" y1="${num(y - alto * 0.18)}" `
    + `x2="${num(cx + anchoHombro * 1.6)}" y2="${num(y - alto * 1.02)}" `
    + `stroke="${tonos.detalle}" stroke-width="${num(4 * escala)}" stroke-linecap="round"/>`);

  // Cabeza con capucha.
  const cabY = hombro - 26 * escala;

  piezas.push(`<path d="M${num(cx - 22 * escala)} ${num(hombro + 4 * escala)}`
    + `C${num(cx - 26 * escala)} ${num(cabY - 24 * escala)} ${num(cx + 26 * escala)} `
    + `${num(cabY - 24 * escala)} ${num(cx + 22 * escala)} ${num(hombro + 4 * escala)}Z" `
    + `fill="${tonos.cuerpoSombra}"/>`);

  piezas.push(ojos(cx, cabY + 2 * escala, 6 * escala, tonos));

  return piezas.join('');
}

/**
 * Espectro: no muertos. Sin pies, deshecho por abajo.
 *
 * @param {Flujo} flujo
 * @param {number} escala
 * @param {Object} tonos
 * @returns {string}
 */
function espectro(flujo, escala, tonos) {
  const cx = ANCHO * 0.5;
  const alto = 200 * escala;
  const y = SUELO_Y;
  const idDesvanecer = idUnico('esp');

  const piezas = [`<defs><linearGradient id="${idDesvanecer}" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" stop-color="${tonos.cuerpo}" stop-opacity="0.85"/>`
    + `<stop offset="0.55" stop-color="${tonos.cuerpo}" stop-opacity="0.45"/>`
    + `<stop offset="1" stop-color="${tonos.cuerpo}" stop-opacity="0"/>`
    + '</linearGradient></defs>'];

  // Cuerpo: una campana irregular que se disuelve hacia el suelo.
  const izq = [];
  const der = [];

  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const ancho = (18 + t * 46) * escala * flujo.flotante(0.86, 1.14);
    const py = y - alto * (1 - t) * 0.86 - alto * 0.06;

    izq.push([cx - ancho, py]);
    der.unshift([cx + ancho, py]);
  }

  piezas.push(`<path d="${curva([...izq, ...der], true)}" fill="url(#${idDesvanecer})"/>`);

  // Jirones.
  for (let i = 0; i < 5; i++) {
    const x = cx + flujo.flotante(-46, 46) * escala;

    piezas.push(`<path d="M${num(x)} ${num(y - alto * 0.5)}`
      + `q${num(flujo.flotante(-10, 10))} ${num(28 * escala)} `
      + `${num(flujo.flotante(-16, 16))} ${num(52 * escala)}" `
      + `stroke="${tonos.detalle}" stroke-width="${num(2.4 * escala)}" `
      + 'fill="none" opacity="0.3"/>');
  }

  piezas.push(ojos(cx, y - alto * 0.84, 6.5 * escala, tonos));

  return piezas.join('');
}

/**
 * Informe: aberraciones. Masa con patas de más y sin simetría fiable.
 *
 * @param {Flujo} flujo
 * @param {number} escala
 * @param {Object} tonos
 * @returns {string}
 */
function informe(flujo, escala, tonos) {
  const cx = ANCHO * 0.5;
  const cy = SUELO_Y - 78 * escala;
  const piezas = [];

  // Patas largas, en número impar: la asimetría es lo que inquieta.
  const patas = flujo.entero(5, 8);

  for (let i = 0; i < patas; i++) {
    const a = (i / patas) * Math.PI - Math.PI * 0.08;
    const largo = flujo.flotante(80, 145) * escala;

    const codoX = cx + Math.cos(a) * largo * 0.55;
    const codoY = cy - Math.abs(Math.sin(a)) * largo * 0.62;
    const pieX = cx + Math.cos(a) * largo;

    piezas.push(`<path d="M${num(cx)} ${num(cy)}L${num(codoX)} ${num(codoY)}`
      + `L${num(pieX)} ${num(SUELO_Y)}" `
      + `stroke="${tonos.cuerpoSombra}" stroke-width="${num(4.5 * escala)}" `
      + 'fill="none" stroke-linecap="round" stroke-linejoin="round"/>');
  }

  // Masa central: un contorno con ruido, nunca un círculo.
  const contorno = [];
  const lados = 11;

  for (let i = 0; i < lados; i++) {
    const a = (i / lados) * Math.PI * 2;
    const r = flujo.flotante(44, 68) * escala;

    contorno.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.82]);
  }

  contorno.push(contorno[0]);
  piezas.push(`<path d="${curva(contorno, true)}" fill="${tonos.cuerpo}"/>`);

  // Varios ojos, desordenados.
  for (let i = 0; i < flujo.entero(3, 6); i++) {
    piezas.push(ojo(
      cx + flujo.flotante(-32, 32) * escala,
      cy + flujo.flotante(-22, 18) * escala,
      flujo.flotante(3.5, 6.5) * escala,
      tonos,
    ));
  }

  return piezas.join('');
}

/**
 * Coloso: construidos. Bloques, simetría exacta, quietud.
 *
 * @param {Flujo} flujo
 * @param {number} escala
 * @param {Object} tonos
 * @returns {string}
 */
function coloso(flujo, escala, tonos) {
  const cx = ANCHO * 0.5;
  const alto = 220 * escala;
  const y = SUELO_Y;
  const ancho = 56 * escala;

  const piezas = [];

  // Piernas: columnas.
  for (const lado of [-1, 1]) {
    piezas.push(`<rect x="${num(cx + lado * ancho * 0.62 - 11 * escala)}" `
      + `y="${num(y - alto * 0.46)}" width="${num(22 * escala)}" `
      + `height="${num(alto * 0.46)}" fill="${tonos.cuerpoSombra}"/>`);
  }

  // Torso: bloque con el hombro más ancho que la cadera.
  piezas.push(`<path d="M${num(cx - ancho)} ${num(y - alto * 0.92)}`
    + `L${num(cx + ancho)} ${num(y - alto * 0.92)}`
    + `L${num(cx + ancho * 0.72)} ${num(y - alto * 0.44)}`
    + `L${num(cx - ancho * 0.72)} ${num(y - alto * 0.44)}Z" fill="${tonos.cuerpo}"/>`);

  // Grabados: las «vetas» del catálogo, apagadas y rectas.
  for (let i = 0; i < 4; i++) {
    const py = y - alto * (0.86 - i * 0.10);

    piezas.push(`<line x1="${num(cx - ancho * 0.66)}" y1="${num(py)}" `
      + `x2="${num(cx + ancho * 0.66)}" y2="${num(py)}" `
      + `stroke="${tonos.detalle}" stroke-width="${num(1.8 * escala)}" opacity="0.45"/>`);
  }

  // Brazos: rectos, colgando. No hay pose, hay espera.
  for (const lado of [-1, 1]) {
    piezas.push(`<rect x="${num(cx + lado * ancho * 1.12 - 9 * escala)}" `
      + `y="${num(y - alto * 0.90)}" width="${num(18 * escala)}" `
      + `height="${num(alto * 0.52)}" fill="${tonos.cuerpoSombra}"/>`);
  }

  // Cabeza: un bloque sin cuello.
  piezas.push(`<rect x="${num(cx - 22 * escala)}" y="${num(y - alto * 1.06)}" `
    + `width="${num(44 * escala)}" height="${num(alto * 0.15)}" fill="${tonos.cuerpo}"/>`);

  piezas.push(ojos(cx, y - alto * 0.99, 5 * escala, tonos));

  return piezas.join('');
}

/* ═══════════════════════════════════════════════════════════════════════════
   OJOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Un ojo encendido, con halo.
 *
 * Es el único punto luminoso de la pieza. Con la criatura casi en negro, el
 * ojo es lo que mira de vuelta.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} r
 * @param {Object} tonos
 * @returns {string}
 */
function ojo(x, y, r, tonos) {
  const id = idUnico('ojo');

  return `<defs><radialGradient id="${id}">`
    + `<stop offset="0" stop-color="${tonos.ojo}" stop-opacity="0.85"/>`
    + `<stop offset="1" stop-color="${tonos.ojo}" stop-opacity="0"/>`
    + '</radialGradient></defs>'
    + `<circle cx="${num(x)}" cy="${num(y)}" r="${num(r * 3.4)}" fill="url(#${id})"/>`
    + `<circle cx="${num(x)}" cy="${num(y)}" r="${num(r)}" fill="${tonos.ojo}"/>`;
}

/** Par de ojos separados por su radio. */
function ojos(cx, y, r, tonos) {
  return ojo(cx - r * 1.7, y, r, tonos) + ojo(cx + r * 1.7, y, r, tonos);
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */

const SILUETAS = { cuadrupedo, bipedo, espectro, informe, coloso };

/**
 * Genera el retrato de una criatura.
 *
 * @param {Object} opciones
 * @param {string} opciones.refId Semilla: la misma criatura sale siempre igual.
 * @param {string} [opciones.tipo] `bestia`, `humanoide`, `no_muerto`…
 * @param {string} [opciones.tamano] `pequeno`, `mediano`, `grande`, `enorme`.
 * @param {string} [opciones.nombre]
 * @returns {string} SVG completo.
 */
export function criatura(opciones = {}) {
  const {
    refId = 'criatura', tipo = 'bestia', tamano = 'mediano', nombre = '',
  } = opciones;

  const tonos = TIPOS_CRIATURA[tipo] ?? TIPO_CRIATURA_POR_DEFECTO;
  const escala = TAMANOS[tamano] ?? TAMANO_POR_DEFECTO;

  const semilla = hashSemilla(`criatura:${refId}`);
  const flujo = new Flujo(semilla, 'criatura');

  const idFondo = idUnico('cfd');
  const idSuelo = idUnico('csl');

  const dibujar = SILUETAS[tonos.silueta] ?? cuadrupedo;

  // Fondo: un halo tenue del color del tipo. Sitúa a la criatura sin dibujar
  // un escenario que competiría con el paisaje del lugar.
  const defs = `<radialGradient id="${idFondo}" cx="0.5" cy="0.62" r="0.7">`
    + `<stop offset="0" stop-color="${mezclar(BASE.ceniza, tonos.detalle, 0.28)}"/>`
    + `<stop offset="1" stop-color="${BASE.tinta}"/>`
    + '</radialGradient>'
    + degradadoVertical(idSuelo, 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0)');

  const cuerpo = [
    `<rect width="${ANCHO}" height="${ALTO}" fill="url(#${idFondo})"/>`,

    // Sombra en el suelo: sin ella la criatura flota.
    `<ellipse cx="${num(ANCHO / 2)}" cy="${num(SUELO_Y + 4)}" `
      + `rx="${num(96 * escala)}" ry="${num(11 * escala)}" `
      + 'fill="#000" opacity="0.45"/>',

    dibujar(flujo, escala, tonos),
  ].join('');

  return lienzo({
    ancho: ANCHO, alto: ALTO,
    etiqueta: nombre || 'Criatura',
    semilla, defs, cuerpo,
    vineta: 0.66, grano: 0.12, clase: 'arte arte--criatura',
  });
}

export default criatura;
