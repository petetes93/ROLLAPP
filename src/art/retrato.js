/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · src/art/retrato.js
 * ---------------------------------------------------------------------------
 * Retrato de busto generado a partir del linaje.
 *
 * El encuadre es IDÉNTICO en los ocho linajes —misma caja, mismos hombros, ojos
 * a un tercio de la altura del cuadro— y lo único que cambia es lo que el
 * catálogo dice que cambia: piel, pelo y un rasgo propio. Ese encuadre fijo es
 * lo que impide que ocho retratos parezcan de ocho juegos distintos.
 *
 * La cara NO se dibuja con líneas. Se modela con sombras recortadas contra la
 * silueta de la cabeza, más un filo de luz en el borde iluminado. Dibujar ojos,
 * nariz y boca con trazos da una carita de tebeo; quitar los trazos y dejar
 * solo el volumen es lo que se parece a «pintura al óleo apagada».
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { hashSemilla, Flujo } from '../core/RNG.js';
import { LINAJES, LINAJE_POR_DEFECTO, BASE } from './paleta.js';
import {
  lienzo, idUnico, num, brillo, mezclar, degradadoLuz,
} from './lienzo.js';

const ANCHO = 400;
const ALTO = 480;

/* ═══ Anclas del encuadre ═════════════════════════════════════════════════
   Cambiar una de estas seis cambia los ocho retratos a la vez, que es lo que
   se quiere. Cambiarla para un solo linaje es lo que rompe la serie.
   ═══════════════════════════════════════════════════════════════════════════ */

const OJOS_Y = ALTO / 3;      // 160. La línea de ojos del ancla de estilo.
const CX = ANCHO * 0.5;
const RX = 76;                // Media anchura del pómulo.
const RY = 104;               // Media altura, de coronilla a mentón.
const GIRO = 7;               // Desplazamiento de tres cuartos.

/* ═══════════════════════════════════════════════════════════════════════════
   PROPORCIONES POR LINAJE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Desviaciones respecto de la cabeza media.
 *
 * Pequeñas a propósito: lo justo para reconocer el linaje sin romper el
 * encuadre común.
 */
const FORMA = Object.freeze({
  valdes: { ancho: 1.00, largo: 1.00, menton: 1.00, hombros: 1.00 },
  sombracorteza: { ancho: 0.90, largo: 1.10, menton: 0.78, hombros: 0.92 },
  ferrano: { ancho: 1.14, largo: 0.92, menton: 1.22, hombros: 1.24 },
  albar: { ancho: 0.92, largo: 1.06, menton: 0.80, hombros: 0.94 },
  griscuerno: { ancho: 1.10, largo: 1.02, menton: 1.16, hombros: 1.28 },
  menudo: { ancho: 1.06, largo: 0.90, menton: 0.88, hombros: 0.84 },
  brumal: { ancho: 0.96, largo: 1.02, menton: 0.86, hombros: 0.92 },
  crisol: { ancho: 1.02, largo: 1.00, menton: 1.08, hombros: 1.10 },
});

const FORMA_POR_DEFECTO = FORMA.valdes;

/* ═══════════════════════════════════════════════════════════════════════════
   SILUETA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Contorno de la cabeza: cráneo ancho, pómulo, ángulo de mandíbula y mentón.
 *
 * Las proporciones son las clásicas del retrato —los ojos a media altura de la
 * cabeza, el mentón a un cuarto por debajo de la mandíbula— porque son las que
 * el ojo reconoce como una persona y no como un óvalo.
 *
 * @param {Object} forma
 * @returns {string} Atributo `d`.
 */
function siluetaCabeza(forma) {
  const rx = RX * forma.ancho;
  const ry = RY * forma.largo;
  const cx = CX + GIRO;
  const cy = OJOS_Y;

  const mx = rx * (0.34 * forma.menton);   // Media anchura del mentón.
  const my = cy + ry * 0.98;               // Punta del mentón.

  return `M${num(cx - rx)} ${num(cy - ry * 0.10)}`
    // Cráneo.
    + `C${num(cx - rx * 1.02)} ${num(cy - ry * 1.02)} ${num(cx + rx * 1.02)} `
    + `${num(cy - ry * 1.02)} ${num(cx + rx)} ${num(cy - ry * 0.10)}`
    // Pómulo a mandíbula, lado derecho.
    + `C${num(cx + rx * 0.99)} ${num(cy + ry * 0.30)} ${num(cx + rx * 0.86)} `
    + `${num(cy + ry * 0.56)} ${num(cx + rx * 0.56)} ${num(cy + ry * 0.80)}`
    // Mentón.
    + `C${num(cx + mx)} ${num(my)} ${num(cx - mx)} ${num(my)} `
    + `${num(cx - rx * 0.56)} ${num(cy + ry * 0.80)}`
    // Mandíbula a pómulo, lado izquierdo.
    + `C${num(cx - rx * 0.86)} ${num(cy + ry * 0.56)} ${num(cx - rx * 0.99)} `
    + `${num(cy + ry * 0.30)} ${num(cx - rx)} ${num(cy - ry * 0.10)}Z`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   BUSTO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Cuello y hombros.
 *
 * El cuello sale de detrás de la mandíbula y los hombros llenan el tercio
 * inferior del cuadro. Un cuello estrecho sobre nada es lo que hace que un
 * retrato parezca una piruleta.
 *
 * @param {Object} forma
 * @param {Object} tonos
 * @param {string} idTela
 * @returns {string}
 */
function busto(forma, tonos, idTela) {
  const ry = RY * forma.largo;
  const anchoCuello = 32 * forma.ancho;
  const cuelloY = OJOS_Y + ry * 0.72;
  const hombroY = ALTO * 0.76;
  const anchoHombro = 150 * forma.hombros;

  // Cuello. Va en sombra entero: la mandíbula lo tapa de la luz. Baja hasta
  // bien dentro de la ropa para que no quede un escalón entre los dos.
  const cuello = `<path d="M${num(CX - anchoCuello)} ${num(cuelloY)}`
    + `L${num(CX - anchoCuello * 1.20)} ${num(hombroY + 40)}`
    + `L${num(CX + anchoCuello * 1.20)} ${num(hombroY + 40)}`
    + `L${num(CX + anchoCuello)} ${num(cuelloY)}Z" `
    + `fill="${brillo(tonos.pielSombra, 0.72)}"/>`;

  // Hombros. La clave es que la línea de hombro sea ANCHA y casi horizontal, y
  // que el trapecio suba al cuello con una pendiente corta. Una sola curva de
  // lado a lado daba una cúpula: parecía una colina, no una persona.
  const bordeIzq = CX - anchoHombro * 1.5;
  const bordeDer = CX + anchoHombro * 1.5;
  const hombroAlto = hombroY + 16;      // Dónde cae el deltoides.
  const cuelloAlto = hombroY - 34;      // Dónde arranca el trapecio.

  const ropa = `<path d="M${num(bordeIzq)} ${num(ALTO + 12)}`
    + `L${num(bordeIzq)} ${num(hombroAlto + 26)}`
    // Deltoides izquierdo: redondeo corto.
    + `C${num(bordeIzq + 18)} ${num(hombroAlto - 4)} `
    + `${num(CX - anchoHombro * 0.86)} ${num(hombroAlto - 10)} `
    + `${num(CX - anchoHombro * 0.66)} ${num(hombroAlto - 12)}`
    // Trapecio izquierdo: sube al cuello.
    + `C${num(CX - anchoHombro * 0.34)} ${num(hombroAlto - 16)} `
    + `${num(CX - anchoCuello * 1.5)} ${num(cuelloAlto + 12)} `
    + `${num(CX)} ${num(cuelloAlto)}`
    // Y lo mismo en espejo.
    + `C${num(CX + anchoCuello * 1.5)} ${num(cuelloAlto + 12)} `
    + `${num(CX + anchoHombro * 0.34)} ${num(hombroAlto - 16)} `
    + `${num(CX + anchoHombro * 0.66)} ${num(hombroAlto - 12)}`
    + `C${num(CX + anchoHombro * 0.86)} ${num(hombroAlto - 10)} `
    + `${num(bordeDer - 18)} ${num(hombroAlto - 4)} `
    + `${num(bordeDer)} ${num(hombroAlto + 26)}`
    + `L${num(bordeDer)} ${num(ALTO + 12)}Z" `
    + `fill="url(#${idTela})"/>`;

  // Sombra que el mentón proyecta sobre el pecho. Estrecha y pegada al cuello:
  // ancha se convertía en una banda oscura cruzando el retrato.
  const sombra = `<ellipse cx="${num(CX)}" cy="${num(cuelloAlto + 10)}" `
    + `rx="${num(anchoCuello * 2.1)}" ry="14" fill="#000" opacity="0.28"/>`;

  return cuello + ropa + sombra;
}

/* ═══════════════════════════════════════════════════════════════════════════
   VOLUMEN DE LA CARA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Las sombras que modelan el rostro, recortadas contra la cabeza.
 *
 * Ninguna es una línea: son manchas suaves. Cuencas, pómulo, lateral de la
 * nariz y hueco bajo el labio. Puestas en el sitio correcto bastan para leer
 * una cara, y dejan el «rostro cansado» que pide el ancla sin dibujar arrugas.
 *
 * @param {Object} forma
 * @param {Object} tonos
 * @returns {string}
 */
function volumenRostro(forma, tonos) {
  const rx = RX * forma.ancho;
  const ry = RY * forma.largo;
  const cx = CX + GIRO;
  const sombra = tonos.pielSombra;
  const piezas = [];

  // Cuenca de los ojos: una sombra suave bajo el hueso de la ceja. Aporta el
  // cansancio que pide el ancla, pero floja: subida de opacidad, las dos
  // manchas se juntan con el iris y el resultado son unas gafas de buzo.
  for (const lado of [-1, 1]) {
    const x = cx + lado * rx * 0.44;
    const escala = lado < 0 ? 1 : 0.9;   // El lado en sombra, algo menor.

    piezas.push(`<ellipse cx="${num(x)}" cy="${num(OJOS_Y - 1)}" `
      + `rx="${num(21 * escala)}" ry="${num(13 * escala)}" `
      + `fill="${sombra}" opacity="0.26"/>`);
  }

  // Hueso de la ceja: una franja clara justo encima de las cuencas.
  piezas.push(`<path d="M${num(cx - rx * 0.86)} ${num(OJOS_Y - ry * 0.22)}`
    + `Q${num(cx)} ${num(OJOS_Y - ry * 0.30)} ${num(cx + rx * 0.86)} `
    + `${num(OJOS_Y - ry * 0.22)}" stroke="${brillo(tonos.piel, 1.12)}" `
    + 'stroke-width="9" fill="none" opacity="0.30" stroke-linecap="round"/>');

  // Lateral de la nariz: una sola sombra, del lado contrario a la luz.
  // Medida en fracciones de `ry` y no en píxeles: los linajes de cara larga
  // llevan la nariz más abajo, como debe ser.
  const nz = (f) => OJOS_Y + ry * f;

  piezas.push(`<path d="M${num(cx + 5)} ${num(nz(-0.08))}`
    + `C${num(cx + 14)} ${num(nz(0.16))} ${num(cx + 15)} ${num(nz(0.31))} `
    + `${num(cx + 9)} ${num(nz(0.42))}`
    + `C${num(cx + 3)} ${num(nz(0.48))} ${num(cx - 5)} ${num(nz(0.46))} `
    + `${num(cx - 6)} ${num(nz(0.38))}Z" `
    + `fill="${sombra}" opacity="0.42"/>`);

  // Pómulos: dos manchas que hunden las mejillas.
  for (const lado of [-1, 1]) {
    piezas.push(`<ellipse cx="${num(cx + lado * rx * 0.72)}" `
      + `cy="${num(OJOS_Y + ry * 0.34)}" rx="${num(rx * 0.30)}" `
      + `ry="${num(ry * 0.22)}" fill="${sombra}" opacity="0.30"/>`);
  }

  // Hueco bajo el labio inferior. Insinúa la boca sin dibujarla.
  piezas.push(`<ellipse cx="${num(cx)}" cy="${num(OJOS_Y + ry * 0.66)}" `
    + `rx="${num(rx * 0.30)}" ry="${num(ry * 0.07)}" `
    + `fill="${sombra}" opacity="0.45"/>`);

  // Línea de la boca: lo único parecido a un trazo, y muy tenue.
  piezas.push(`<path d="M${num(cx - rx * 0.28)} ${num(OJOS_Y + ry * 0.55)}`
    + `Q${num(cx)} ${num(OJOS_Y + ry * 0.58)} ${num(cx + rx * 0.26)} `
    + `${num(OJOS_Y + ry * 0.54)}" stroke="${brillo(sombra, 0.7)}" `
    + 'stroke-width="2.4" fill="none" opacity="0.6" stroke-linecap="round"/>');

  return piezas.join('');
}

/**
 * Los ojos: iris en la parte oscura de la cuenca, con un punto de luz.
 *
 * @param {Object} forma
 * @param {Object} tonos
 * @returns {string}
 */
function mirada(forma, tonos) {
  const rx = RX * forma.ancho;
  const ry = RY * forma.largo;
  const cx = CX + GIRO;
  const piezas = [];

  // El ojo mide una quinta parte de la anchura de la cara: la proporción
  // clásica, y la que evita que parezcan botones pegados.
  const w = rx * 0.20;

  for (const lado of [-1, 1]) {
    const escala = lado < 0 ? 1 : 0.88;
    const x = cx + lado * rx * 0.44;
    const a = w * escala;

    // Hendidura del párpado: almendra, más alta por dentro que por fuera.
    piezas.push(`<path d="M${num(x - a)} ${num(OJOS_Y + 1)}`
      + `Q${num(x)} ${num(OJOS_Y + a * 0.62)} ${num(x + a)} ${num(OJOS_Y - 1)}`
      + `Q${num(x)} ${num(OJOS_Y - a * 0.55)} ${num(x - a)} ${num(OJOS_Y + 1)}Z" `
      + `fill="${brillo(tonos.pielSombra, 0.42)}"/>`);

    // Iris.
    piezas.push(`<circle cx="${num(x + lado * 0.8)}" cy="${num(OJOS_Y + 1)}" `
      + `r="${num(a * 0.36)}" fill="${tonos.ojo}"/>`);

    // Reflejo, siempre arriba a la izquierda: es la misma lámpara de todo el
    // juego, y ponerlo en otro sitio rompe la serie entera.
    piezas.push(`<circle cx="${num(x - a * 0.16)}" cy="${num(OJOS_Y - a * 0.14)}" `
      + `r="${num(a * 0.11)}" fill="#FFF" opacity="0.6"/>`);

    // Pestaña superior: sombra fina, no línea negra.
    piezas.push(`<path d="M${num(x - a)} ${num(OJOS_Y)}`
      + `Q${num(x)} ${num(OJOS_Y - a * 0.52)} ${num(x + a)} ${num(OJOS_Y - 2)}" `
      + `stroke="${brillo(tonos.pielSombra, 0.48)}" stroke-width="2.4" `
      + 'fill="none" stroke-linecap="round"/>');
  }

  // Cejas: por encima del hueso, no pegadas al párpado.
  for (const lado of [-1, 1]) {
    const x = cx + lado * rx * 0.44;
    const escala = lado < 0 ? 1 : 0.88;
    const a = w * escala;

    piezas.push(`<path d="M${num(x - a * 1.25)} ${num(OJOS_Y - ry * 0.15)}`
      + `Q${num(x)} ${num(OJOS_Y - ry * 0.20)} ${num(x + a * 1.15)} `
      + `${num(OJOS_Y - ry * 0.14)}" stroke="${tonos.pelo}" `
      + `stroke-width="${num(4.6 * escala)}" fill="none" stroke-linecap="round" `
      + 'opacity="0.8"/>');
  }

  return piezas.join('');
}

/* ═══════════════════════════════════════════════════════════════════════════
   PELO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Pelo que arranca en una línea de nacimiento y sigue el cráneo.
 *
 * Antes era un casquete que bajaba hasta las cejas y el resultado parecía una
 * seta. La línea de nacimiento a media frente es lo que lo convierte en pelo.
 *
 * @param {Object} forma
 * @param {Object} tonos
 * @param {Flujo} flujo
 * @returns {string}
 */
function pelo(forma, tonos, flujo) {
  const rx = RX * forma.ancho;
  const ry = RY * forma.largo;
  const cx = CX + GIRO;

  // La frente ocupa el tramo entre la ceja y el nacimiento del pelo: un tercio
  // de la altura de la cabeza, que es la proporción clásica.
  const nacimiento = OJOS_Y - ry * 0.46;

  const masa = `<path d="M${num(cx - rx * 1.04)} ${num(OJOS_Y + ry * 0.12)}`
    + `C${num(cx - rx * 1.12)} ${num(OJOS_Y - ry * 1.10)} ${num(cx + rx * 1.12)} `
    + `${num(OJOS_Y - ry * 1.10)} ${num(cx + rx * 1.04)} ${num(OJOS_Y + ry * 0.12)}`
    + `C${num(cx + rx * 0.95)} ${num(nacimiento + 12)} ${num(cx + rx * 0.55)} `
    + `${num(nacimiento - 6)} ${num(cx)} ${num(nacimiento)}`
    + `C${num(cx - rx * 0.55)} ${num(nacimiento - 6)} ${num(cx - rx * 0.95)} `
    + `${num(nacimiento + 12)} ${num(cx - rx * 1.04)} ${num(OJOS_Y + ry * 0.12)}Z" `
    + `fill="${tonos.pelo}"/>`;

  // Un par de mechones sueltos rompen el borde limpio del vector.
  const mechones = [];

  for (let i = 0; i < 5; i++) {
    const x = cx + flujo.flotante(-rx, rx);
    const y = nacimiento + flujo.flotante(-4, 10);

    mechones.push(`<path d="M${num(x)} ${num(y)}q${num(flujo.flotante(-8, 8))} `
      + `${num(flujo.flotante(8, 18))} ${num(flujo.flotante(-10, 10))} `
      + `${num(flujo.flotante(16, 30))}" stroke="${tonos.pelo}" `
      + `stroke-width="${num(flujo.flotante(2, 4.5))}" fill="none" `
      + 'stroke-linecap="round"/>');
  }

  // Brillo del pelo, arriba a la izquierda como todo lo demás.
  const luz = `<path d="M${num(cx - rx * 0.8)} ${num(OJOS_Y - ry * 0.72)}`
    + `Q${num(cx - rx * 0.2)} ${num(OJOS_Y - ry * 1.0)} ${num(cx + rx * 0.4)} `
    + `${num(OJOS_Y - ry * 0.82)}" stroke="${brillo(tonos.pelo, 1.5)}" `
    + 'stroke-width="6" fill="none" opacity="0.3" stroke-linecap="round"/>';

  return masa + mechones.join('') + luz;
}

/* ═══════════════════════════════════════════════════════════════════════════
   RASGO PROPIO DEL LINAJE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * El añadido que separa un linaje de otro. Todo sale del campo `aspecto`.
 *
 * @param {string} rasgo
 * @param {Object} forma
 * @param {Object} tonos
 * @param {Flujo} flujo
 * @param {'detras'|'delante'} capa
 * @returns {string}
 */
function rasgoLinaje(rasgo, forma, tonos, flujo, capa) {
  const rx = RX * forma.ancho;
  const ry = RY * forma.largo;
  const cx = CX + GIRO;
  const piezas = [];

  /* ── Detrás de la cabeza ──────────────────────────────────────────────── */
  if (capa === 'detras') {
    switch (rasgo) {
      case 'cuernos': {
        // Griscuerno: «cuernos curvos que van del pardo al blanco según la edad».
        // Nacen en la sien y barren hacia atrás y arriba, no hacia los lados:
        // hacia los lados parecían un bigote.
        for (const lado of [-1, 1]) {
          const x0 = cx + lado * rx * 0.78;
          const y0 = OJOS_Y - ry * 0.62;

          piezas.push(`<path d="M${num(x0)} ${num(y0)}`
            + `C${num(x0 + lado * 34)} ${num(y0 - 26)} `
            + `${num(x0 + lado * 52)} ${num(y0 - 62)} `
            + `${num(x0 + lado * 38)} ${num(y0 - 96)}`
            + `C${num(x0 + lado * 34)} ${num(y0 - 66)} `
            + `${num(x0 + lado * 20)} ${num(y0 - 34)} `
            + `${num(x0 - lado * 4)} ${num(y0 - 6)}Z" `
            + `fill="${mezclar(BASE.hueso, '#5E5142', 0.42)}"/>`);

          // Filo de luz en el canto del cuerno.
          piezas.push(`<path d="M${num(x0 + lado * 2)} ${num(y0 - 4)}`
            + `C${num(x0 + lado * 30)} ${num(y0 - 28)} `
            + `${num(x0 + lado * 46)} ${num(y0 - 62)} `
            + `${num(x0 + lado * 37)} ${num(y0 - 92)}" `
            + `stroke="${brillo(BASE.hueso, 1.18)}" stroke-width="2.4" `
            + 'fill="none" opacity="0.5"/>');
        }
        break;
      }

      case 'brillo': {
        // Albar: «piel pálida con un brillo tenue bajo la luna».
        const id = idUnico('albar');

        piezas.push(`<defs><radialGradient id="${id}">`
          + `<stop offset="0.35" stop-color="${tonos.acento}" stop-opacity="0.26"/>`
          + `<stop offset="1" stop-color="${tonos.acento}" stop-opacity="0"/>`
          + '</radialGradient></defs>');

        piezas.push(`<ellipse cx="${num(cx)}" cy="${num(OJOS_Y)}" `
          + `rx="${num(rx * 2.4)}" ry="${num(ry * 2.0)}" fill="url(#${id})"/>`);
        break;
      }

      case 'corriente': {
        // Brumal: «cabello que se mueve como si hubiera corriente».
        for (let i = 0; i < 14; i++) {
          const x0 = cx + flujo.flotante(-rx * 0.95, rx * 0.95);
          const y0 = OJOS_Y - ry * 0.5 + flujo.flotante(-30, 10);
          const deriva = flujo.flotante(30, 92) * (flujo.moneda() ? 1 : -1);

          piezas.push(`<path d="M${num(x0)} ${num(y0)}`
            + `q${num(deriva * 0.45)} ${num(flujo.flotante(-34, -12))} `
            + `${num(deriva)} ${num(flujo.flotante(-70, -26))}" `
            + `stroke="${tonos.pelo}" stroke-width="${num(flujo.flotante(2, 5.5))}" `
            + `fill="none" opacity="${num(flujo.flotante(0.25, 0.6))}" `
            + 'stroke-linecap="round"/>');
        }
        break;
      }

      case 'rizos': {
        // Menudo: rizos apretados que desbordan el cráneo.
        for (let i = 0; i < 30; i++) {
          const a = Math.PI * 1.04 + (i / 30) * Math.PI * 0.92;
          const r = flujo.flotante(1.0, 1.12);

          piezas.push(`<circle cx="${num(cx + Math.cos(a) * rx * r)}" `
            + `cy="${num(OJOS_Y + Math.sin(a) * ry * r)}" `
            + `r="${num(flujo.flotante(10, 16))}" fill="${tonos.pelo}"/>`);
        }
        break;
      }

      default: break;
    }

    return piezas.join('');
  }

  /* ── Delante de la cabeza ─────────────────────────────────────────────── */
  switch (rasgo) {
    case 'barba': {
      // Ferrano: «barba de forja, trenzada». Cubre mandíbula y mentón, NO la
      // boca entera: taparla del todo era lo que la convertía en un babero.
      const barbaY = OJOS_Y + ry * 0.58;

      piezas.push(`<path d="M${num(cx - rx * 0.98)} ${num(barbaY - 16)}`
        + `C${num(cx - rx * 1.06)} ${num(barbaY + 76)} ${num(cx - rx * 0.4)} `
        + `${num(barbaY + 116)} ${num(cx)} ${num(barbaY + 118)}`
        + `C${num(cx + rx * 0.4)} ${num(barbaY + 116)} ${num(cx + rx * 1.06)} `
        + `${num(barbaY + 76)} ${num(cx + rx * 0.98)} ${num(barbaY - 16)}`
        + `C${num(cx + rx * 0.7)} ${num(barbaY + 26)} ${num(cx - rx * 0.7)} `
        + `${num(barbaY + 26)} ${num(cx - rx * 0.98)} ${num(barbaY - 16)}Z" `
        + `fill="${tonos.pelo}"/>`);

      // Bigote, separado de la barba por el hueco de la boca.
      piezas.push(`<path d="M${num(cx - rx * 0.52)} ${num(OJOS_Y + ry * 0.42)}`
        + `Q${num(cx)} ${num(OJOS_Y + ry * 0.52)} ${num(cx + rx * 0.5)} `
        + `${num(OJOS_Y + ry * 0.40)}" stroke="${tonos.pelo}" stroke-width="13" `
        + 'fill="none" stroke-linecap="round"/>');

      // Dos trenzas.
      for (const lado of [-1, 1]) {
        piezas.push(`<path d="M${num(cx + lado * 20)} ${num(barbaY + 84)}`
          + `q${num(lado * 4)} 22 ${num(lado * 2)} 40" `
          + `stroke="${brillo(tonos.pelo, 0.68)}" stroke-width="9" `
          + 'fill="none" stroke-linecap="round"/>');
      }
      break;
    }

    case 'veta': {
      // Sombracorteza: «piel veteada en gris y pardo que se endurece con la edad».
      for (let i = 0; i < 8; i++) {
        const x = cx + flujo.flotante(-rx * 0.85, rx * 0.85);
        const y = OJOS_Y + flujo.flotante(-ry * 0.3, ry * 0.72);

        piezas.push(`<path d="M${num(x)} ${num(y)}`
          + `q${num(flujo.flotante(-5, 5))} ${num(flujo.flotante(10, 20))} `
          + `${num(flujo.flotante(-3, 3))} ${num(flujo.flotante(20, 38))}" `
          + `stroke="${brillo(tonos.pielSombra, 0.78)}" stroke-width="1.8" `
          + 'fill="none" opacity="0.55" stroke-linecap="round"/>');
      }
      break;
    }

    case 'vetas': {
      // Crisol: «vetas de mineral luminoso que se apagan cuando están heridos».
      const id = idUnico('veta');

      piezas.push(`<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">`
        + `<stop offset="0" stop-color="${tonos.acento}" stop-opacity="0.9"/>`
        + `<stop offset="1" stop-color="${tonos.acento}" stop-opacity="0.15"/>`
        + '</linearGradient></defs>');

      for (let i = 0; i < 6; i++) {
        const x = cx + flujo.flotante(-rx * 0.8, rx * 0.8);
        const y = OJOS_Y - ry * 0.34 + flujo.flotante(-8, 8);

        piezas.push(`<path d="M${num(x)} ${num(y)}`
          + `l${num(flujo.flotante(-12, 12))} ${num(flujo.flotante(26, 54))}" `
          + `stroke="url(#${id})" stroke-width="2.2" fill="none" `
          + 'stroke-linecap="round"/>');
      }

      // La juntura de la placa facial: es un rostro fijo, construido.
      piezas.push(`<path d="M${num(cx)} ${num(OJOS_Y - ry * 0.5)}`
        + `L${num(cx)} ${num(OJOS_Y + ry * 0.72)}" `
        + `stroke="${brillo(tonos.pielSombra, 0.8)}" stroke-width="1.6" `
        + 'opacity="0.5"/>');
      break;
    }

    case 'capas': {
      // Valdés: «visten en capas superpuestas». Se lee en el cuello de la ropa.
      for (let i = 0; i < 3; i++) {
        const y = ALTO * 0.70 + i * 16;

        piezas.push(`<path d="M${num(CX - 118 - i * 22)} ${num(y + 26)}`
          + `Q${num(CX)} ${num(y - 14)} ${num(CX + 118 + i * 22)} ${num(y + 26)}" `
          + `stroke="${brillo(BASE.ceniza, 1.05 + i * 0.30)}" stroke-width="8" `
          + 'fill="none" stroke-linecap="round"/>');
      }
      break;
    }

    default: break;
  }

  return piezas.join('');
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Genera el retrato de un personaje.
 *
 * @param {Object} opciones
 * @param {string} opciones.raza `refId` del linaje.
 * @param {string} [opciones.nombre] Para el texto alternativo y el ruido fino.
 * @param {string} [opciones.semilla] Distingue dos personajes del mismo linaje.
 * @returns {string} SVG completo.
 */
export function retrato(opciones = {}) {
  const { raza = 'valdes', nombre = '', semilla: extra = '' } = opciones;

  const tonos = LINAJES[raza] ?? LINAJE_POR_DEFECTO;
  const forma = FORMA[raza] ?? FORMA_POR_DEFECTO;

  const semilla = hashSemilla(`retrato:${raza}:${extra}`);
  const flujo = new Flujo(semilla, 'retrato');

  const idFondo = idUnico('fdo');
  const idPiel = idUnico('piel');
  const idTela = idUnico('tela');
  const idRecorte = idUnico('rec');

  const dCabeza = siluetaCabeza(forma);

  // Fondo plano, como pide el ancla, con un halo muy corto detrás de la cabeza
  // para que la silueta se despegue sin dibujar un escenario.
  const defs = `<radialGradient id="${idFondo}" cx="0.5" cy="0.34" r="0.75">`
    + `<stop offset="0" stop-color="${mezclar(BASE.ceniza, tonos.acento, 0.16)}"/>`
    + `<stop offset="1" stop-color="${BASE.tinta}"/>`
    + '</radialGradient>'
    + degradadoLuz(idPiel, tonos.piel, tonos.pielSombra)
    // La tela tiene que despegarse del fondo. Con los grises de `ceniza` a
    // `tinta` el busto salía del mismo color que el fondo y la cabeza parecía
    // flotar sobre un palo.
    + degradadoLuz(idTela, BASE.hierro, BASE.cenizaHonda)
    + `<clipPath id="${idRecorte}"><path d="${dCabeza}"/></clipPath>`;

  const cuerpo = [
    `<rect width="${ANCHO}" height="${ALTO}" fill="url(#${idFondo})"/>`,

    rasgoLinaje(tonos.rasgo, forma, tonos, flujo, 'detras'),
    busto(forma, tonos, idTela),

    // La cabeza y todo lo que la modela, recortado contra su propia silueta.
    `<path d="${dCabeza}" fill="url(#${idPiel})"/>`,
    `<g clip-path="url(#${idRecorte})">`,
    volumenRostro(forma, tonos),
    mirada(forma, tonos),
    pelo(forma, tonos, flujo),
    '</g>',

    // Filo de luz en el borde iluminado. Va SIN recortar y encima de todo:
    // es lo que separa la cabeza del fondo y lo que más se parece a óleo.
    `<path d="${dCabeza}" fill="none" stroke="${brillo(tonos.piel, 1.3)}" `
      + 'stroke-width="2.2" opacity="0.30"/>',

    rasgoLinaje(tonos.rasgo, forma, tonos, flujo, 'delante'),
  ].join('');

  return lienzo({
    ancho: ANCHO, alto: ALTO,
    etiqueta: nombre ? `Retrato de ${nombre}` : 'Retrato',
    semilla, defs, cuerpo,
    vineta: 0.60, grano: 0.12, clase: 'arte arte--retrato',
    // Anclado arriba: en un hueco más apaisado que 5:6 se pierde el pecho,
    // no la coronilla. Los cuernos del griscuerno y los rizos del menudo
    // salen del cráneo hacia arriba y son la mitad de su identidad.
    recorte: 'xMidYMin slice',
  });
}

export default retrato;
