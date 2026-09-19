/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · src/art/paisaje.js
 * ---------------------------------------------------------------------------
 * Paisaje generado para un lugar del mapa.
 *
 * La escena se construye por bandas, de fondo a primer plano, con una neblina
 * entre ellas: es el truco más viejo de la pintura de paisaje y el que da
 * profundidad sin dibujar detalle.
 *
 * Lo que un archivo de imagen no puede hacer, y por lo que esto existe: el
 * mismo lugar cambia con la hora y con el clima. Vado del Yunque al alba con
 * niebla y a mediodía despejado son dos imágenes distintas del mismo sitio,
 * generadas del mismo `refId` y por tanto con el mismo relieve.
 *
 * Función pura: recibe datos, devuelve una cadena SVG.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { hashSemilla, Flujo } from '../core/RNG.js';
import {
  TERRENOS, TERRENO_POR_DEFECTO, FRANJAS, FRANJA_POR_DEFECTO, CLIMAS, BASE,
} from './paleta.js';
import {
  lienzo, idUnico, num, curva, ruta, brillo, mezclar, degradadoVertical,
} from './lienzo.js';

/** Proporción del lienzo. Ancha: es una banda de cabecera, no un cuadro. */
const ANCHO = 800;
const ALTO = 320;

/* ═══════════════════════════════════════════════════════════════════════════
   PERFILES DE RELIEVE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Genera los puntos de una banda de terreno.
 *
 * Cada perfil devuelve la línea superior de la banda. El relleno hasta el pie
 * del lienzo lo cierra `bandaCerrada`.
 *
 * @param {string} perfil
 * @param {Flujo} flujo
 * @param {number} baseY Altura media de la banda.
 * @param {number} amplitud
 * @returns {Array<[number, number]>}
 */
function perfilar(perfil, flujo, baseY, amplitud) {
  const puntos = [];

  switch (perfil) {
    case 'picos': {
      // Montaña: dientes de sierra con cimas desiguales.
      const cimas = flujo.entero(5, 8);
      const paso = ANCHO / cimas;

      puntos.push([-40, baseY + amplitud * 0.6]);

      for (let i = 0; i <= cimas; i++) {
        const x = i * paso + flujo.flotante(-paso * 0.18, paso * 0.18);
        const alto = baseY - amplitud * flujo.flotante(0.55, 1.4);

        puntos.push([x, alto]);
        // El valle entre cimas no baja del todo: si baja, parecen colmillos.
        puntos.push([x + paso * 0.5, baseY - amplitud * flujo.flotante(0.05, 0.35)]);
      }

      puntos.push([ANCHO + 40, baseY + amplitud * 0.6]);
      return puntos;
    }

    case 'dunas': {
      // Desierto: ondas muy largas y muy suaves.
      const ondas = flujo.entero(2, 4);

      for (let i = 0; i <= ondas * 2; i++) {
        const x = (i / (ondas * 2)) * (ANCHO + 80) - 40;
        const y = baseY - Math.sin((i / (ondas * 2)) * Math.PI * ondas)
          * amplitud * flujo.flotante(0.5, 1);

        puntos.push([x, y]);
      }

      return puntos;
    }

    case 'llano':
    case 'roca':
    case 'agua': {
      const rugosidad = perfil === 'agua' ? 0.06 : perfil === 'roca' ? 0.5 : 0.22;
      const pasos = 12;

      for (let i = 0; i <= pasos; i++) {
        const x = (i / pasos) * (ANCHO + 80) - 40;
        puntos.push([x, baseY + flujo.flotante(-1, 1) * amplitud * rugosidad]);
      }

      return puntos;
    }

    case 'colinas':
    default: {
      const pasos = flujo.entero(6, 10);

      for (let i = 0; i <= pasos; i++) {
        const x = (i / pasos) * (ANCHO + 80) - 40;
        const y = baseY - Math.sin((i / pasos) * Math.PI * flujo.flotante(1, 2.2))
          * amplitud * flujo.flotante(0.35, 0.9);

        puntos.push([x, y]);
      }

      return puntos;
    }
  }
}

/**
 * Cierra un perfil contra el pie del lienzo para poder rellenarlo.
 *
 * @param {Array<[number, number]>} puntos
 * @returns {string}
 */
function bandaCerrada(puntos) {
  const linea = curva(puntos, false);
  return `${linea}L${num(ANCHO + 40)} ${ALTO + 40}L-40 ${ALTO + 40}Z`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADORNOS DE PRIMER PLANO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Siluetas que se apoyan sobre una banda: árboles, juncos, columnas, muros.
 *
 * Van siempre en negro casi puro sobre la banda que las sostiene: a contraluz
 * no se ve el detalle, y no dibujar detalle es justo lo que pide el ancla de
 * estilo.
 *
 * @param {string} tipo
 * @param {Flujo} flujo
 * @param {number} baseY
 * @param {string} color
 * @returns {string}
 */
function adornos(tipo, flujo, baseY, color) {
  const piezas = [];

  switch (tipo) {
    case 'arboles': {
      const cuantos = flujo.entero(14, 22);

      for (let i = 0; i < cuantos; i++) {
        const x = flujo.flotante(-20, ANCHO + 20);
        const h = flujo.flotante(26, 68);
        const w = h * flujo.flotante(0.16, 0.30);
        const y = baseY + flujo.flotante(-6, 10);

        // Conífera: triángulo estrecho sobre un tronco corto.
        piezas.push(`<path d="M${num(x)} ${num(y)}L${num(x - w)} ${num(y)}`
          + `L${num(x)} ${num(y - h)}L${num(x + w)} ${num(y)}Z" fill="${color}"/>`);

        piezas.push(`<rect x="${num(x - w * 0.12)}" y="${num(y - 3)}" `
          + `width="${num(w * 0.24)}" height="8" fill="${color}"/>`);
      }

      return piezas.join('');
    }

    case 'juncos': {
      const cuantos = flujo.entero(30, 50);

      for (let i = 0; i < cuantos; i++) {
        const x = flujo.flotante(-10, ANCHO + 10);
        const h = flujo.flotante(12, 40);
        const inclina = flujo.flotante(-7, 7);
        const y = baseY + flujo.flotante(-4, 12);

        piezas.push(`<path d="M${num(x)} ${num(y)}Q${num(x + inclina * 0.5)} `
          + `${num(y - h * 0.6)} ${num(x + inclina)} ${num(y - h)}" `
          + `stroke="${color}" stroke-width="${num(flujo.flotante(1, 2.2))}" fill="none"/>`);
      }

      return piezas.join('');
    }

    case 'columnas': {
      const cuantas = flujo.entero(4, 7);

      for (let i = 0; i < cuantas; i++) {
        const x = flujo.flotante(20, ANCHO - 40);
        const h = flujo.flotante(40, 110);
        const w = flujo.flotante(9, 16);
        const y = baseY + flujo.flotante(-4, 8);

        // Rota por arriba: una columna entera parece un edificio en pie, y
        // estas ruinas llevan siglos caídas.
        piezas.push(`<path d="M${num(x)} ${num(y)}L${num(x)} ${num(y - h)}`
          + `L${num(x + w * 0.6)} ${num(y - h + flujo.flotante(4, 14))}`
          + `L${num(x + w)} ${num(y - h * flujo.flotante(0.75, 0.95))}`
          + `L${num(x + w)} ${num(y)}Z" fill="${color}"/>`);
      }

      return piezas.join('');
    }

    case 'muros': {
      const cuantos = flujo.entero(5, 9);

      for (let i = 0; i < cuantos; i++) {
        const x = flujo.flotante(-20, ANCHO);
        const w = flujo.flotante(40, 120);
        const h = flujo.flotante(14, 46);
        const y = baseY + flujo.flotante(-2, 10);

        piezas.push(`<rect x="${num(x)}" y="${num(y - h)}" width="${num(w)}" `
          + `height="${num(h + 20)}" fill="${color}"/>`);
      }

      return piezas.join('');
    }

    default:
      return '';
  }
}

/**
 * Lo que el ser humano ha puesto en el paisaje.
 *
 * Sin esto, tres lugares del mismo terreno salen casi idénticos: la semilla
 * cambia el relieve, pero el relieve solo no distingue un pueblo de un tramo
 * de camino vacío. Un par de tejados y una columna de humo hacen más por
 * separarlos que cualquier variación de las colinas.
 *
 * @param {string} tipo `asentamiento`, `ruina`, `mazmorra`, `natural`, `punto`.
 * @param {Flujo} flujo
 * @param {number} baseY
 * @param {string} color
 * @param {Object} hora
 * @returns {string}
 */
function construcciones(tipo, flujo, baseY, color, hora) {
  const piezas = [];

  if (tipo === 'asentamiento') {
    const casas = flujo.entero(7, 12);
    const centro = flujo.flotante(ANCHO * 0.25, ANCHO * 0.75);

    for (let i = 0; i < casas; i++) {
      // Se agrupan alrededor de un centro: un pueblo, no casas sueltas.
      const x = centro + flujo.normal(0, 1) * ANCHO * 0.17;
      const w = flujo.flotante(20, 42);
      const h = flujo.flotante(16, 34);
      const y = baseY + flujo.flotante(-6, 8);

      // Cuerpo.
      piezas.push(`<rect x="${num(x - w / 2)}" y="${num(y - h)}" `
        + `width="${num(w)}" height="${num(h + 16)}" fill="${color}"/>`);

      // Tejado a dos aguas.
      piezas.push(`<path d="M${num(x - w * 0.62)} ${num(y - h)}`
        + `L${num(x)} ${num(y - h - flujo.flotante(8, 18))}`
        + `L${num(x + w * 0.62)} ${num(y - h)}Z" fill="${color}"/>`);

      // Una ventana encendida de cada tres. De noche es lo único que se ve del
      // pueblo, y es lo que lo hace parecer habitado.
      if (flujo.oportunidad(0.34)) {
        piezas.push(`<rect x="${num(x - 3)}" y="${num(y - h * 0.55)}" `
          + `width="4.5" height="6" fill="${BASE.oro}" `
          + `opacity="${num(0.35 + (1 - hora.luz) * 0.6)}"/>`);
      }
    }

    // Humo de una chimenea.
    piezas.push(`<path d="M${num(centro)} ${num(baseY - 40)}`
      + `q${num(flujo.flotante(-14, 14))} -26 ${num(flujo.flotante(-20, 20))} -58" `
      + `stroke="${BASE.hueso}" stroke-width="7" fill="none" opacity="0.13" `
      + 'stroke-linecap="round"/>');

    return piezas.join('');
  }

  if (tipo === 'ruina') {
    // Muros a medias y un arco que ya no sostiene nada.
    const restos = flujo.entero(3, 6);

    for (let i = 0; i < restos; i++) {
      const x = flujo.flotante(ANCHO * 0.15, ANCHO * 0.85);
      const w = flujo.flotante(16, 34);
      const h = flujo.flotante(30, 84);
      const y = baseY + flujo.flotante(-4, 8);

      // Corona irregular: una ruina no tiene el borde recto.
      piezas.push(`<path d="M${num(x)} ${num(y + 14)}L${num(x)} ${num(y - h)}`
        + `L${num(x + w * 0.45)} ${num(y - h + flujo.flotante(6, 20))}`
        + `L${num(x + w)} ${num(y - h * flujo.flotante(0.6, 0.9))}`
        + `L${num(x + w)} ${num(y + 14)}Z" fill="${color}"/>`);
    }

    const ax = flujo.flotante(ANCHO * 0.3, ANCHO * 0.7);
    const aw = flujo.flotante(56, 96);
    const ah = flujo.flotante(60, 100);

    piezas.push(`<path d="M${num(ax - aw / 2)} ${num(baseY + 12)}`
      + `L${num(ax - aw / 2)} ${num(baseY - ah * 0.55)}`
      + `Q${num(ax)} ${num(baseY - ah)} ${num(ax + aw / 2)} ${num(baseY - ah * 0.55)}`
      + `L${num(ax + aw / 2)} ${num(baseY + 12)}`
      + `L${num(ax + aw / 2 - 11)} ${num(baseY + 12)}`
      + `L${num(ax + aw / 2 - 11)} ${num(baseY - ah * 0.5)}`
      + `Q${num(ax)} ${num(baseY - ah * 0.86)} ${num(ax - aw / 2 + 11)} `
      + `${num(baseY - ah * 0.5)}`
      + `L${num(ax - aw / 2 + 11)} ${num(baseY + 12)}Z" fill="${color}"/>`);

    return piezas.join('');
  }

  return '';
}

/* ═══════════════════════════════════════════════════════════════════════════
   CIELO
   ═══════════════════════════════════════════════════════════════════════════ */

/** Dónde está el sol o la luna en cada franja, en tanto por uno del ancho. */
const ASTRO = Object.freeze({
  madrugada: { x: 0.72, y: 0.26, luna: true },
  alba: { x: 0.16, y: 0.60, luna: false },
  manana: { x: 0.30, y: 0.34, luna: false },
  mediodia: { x: 0.50, y: 0.16, luna: false },
  tarde: { x: 0.70, y: 0.34, luna: false },
  ocaso: { x: 0.86, y: 0.62, luna: false },
  noche: { x: 0.24, y: 0.22, luna: true },
});

/**
 * Sol o luna, con su halo.
 *
 * @param {string} franja
 * @param {Object} datosFranja
 * @returns {string}
 */
function astro(franja, datosFranja) {
  const pos = ASTRO[franja];
  if (!pos) return '';

  const x = pos.x * ANCHO;
  const y = pos.y * ALTO * 0.8;
  const r = pos.luna ? 13 : 17;

  const color = pos.luna ? '#D6DCE0' : brillo(datosFranja.tinte, 1.35);
  const idHalo = idUnico('halo');

  return `<defs><radialGradient id="${idHalo}">`
    + `<stop offset="0" stop-color="${color}" stop-opacity="0.55"/>`
    + `<stop offset="1" stop-color="${color}" stop-opacity="0"/>`
    + '</radialGradient></defs>'
    + `<circle cx="${num(x)}" cy="${num(y)}" r="${num(r * 4.5)}" fill="url(#${idHalo})"/>`
    + `<circle cx="${num(x)}" cy="${num(y)}" r="${num(r)}" fill="${color}" opacity="0.9"/>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CLIMA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Velo de clima sobre la escena ya pintada.
 *
 * @param {string} clima
 * @param {Flujo} flujo
 * @returns {string}
 */
function velo(clima, flujo) {
  const datos = CLIMAS[clima];
  if (!datos) return '';

  const piezas = [`<rect width="${ANCHO}" height="${ALTO}" fill="${datos.color}" `
    + `opacity="${num(datos.opacidad)}"/>`];

  // Lluvia, nieve y viento se leen como trazos; niebla y calor, solo como velo.
  for (let i = 0; i < datos.trazos; i++) {
    const x = flujo.flotante(-40, ANCHO);
    const y = flujo.flotante(0, ALTO);

    if (clima === 'nieve') {
      piezas.push(`<circle cx="${num(x)}" cy="${num(y)}" `
        + `r="${num(flujo.flotante(0.8, 2))}" fill="#E8EDF0" opacity="0.7"/>`);
    } else {
      const largo = clima === 'tormenta' ? flujo.flotante(14, 30) : flujo.flotante(8, 18);
      const sesgo = clima === 'viento' ? 14 : clima === 'tormenta' ? 7 : 3;

      piezas.push(`<line x1="${num(x)}" y1="${num(y)}" x2="${num(x + sesgo)}" `
        + `y2="${num(y + largo)}" stroke="#C4CDD4" stroke-width="0.8" opacity="0.35"/>`);
    }
  }

  return piezas.join('');
}

/* ═══════════════════════════════════════════════════════════════════════════
   INTERIORES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Escena de mazmorra: no hay cielo, hay bóveda.
 *
 * Se separa del resto porque un degradado de cielo bajo tierra queda absurdo,
 * y porque la luz aquí no viene del sol sino de una antorcha fuera de cuadro.
 *
 * @param {Flujo} flujo
 * @param {Object} paleta
 * @returns {string}
 */
function interior(flujo, paleta) {
  const piezas = [];
  const idFondo = idUnico('maz');
  const idLuz = idUnico('luzmaz');

  piezas.push(`<defs>${degradadoVertical(idFondo, paleta.lejos, BASE.tinta)}`
    // Ámbar y flojo. Con el rojo del acento a 0.30 la mazmorra entera salía
    // lavada de rosa y los cuatro arcos se perdían dentro del velo.
    + `<radialGradient id="${idLuz}" cx="0.18" cy="0.38" r="0.55">`
    + '<stop offset="0" stop-color="#C08A3E" stop-opacity="0.20"/>'
    + '<stop offset="1" stop-color="#C08A3E" stop-opacity="0"/>'
    + '</radialGradient></defs>');

  piezas.push(`<rect width="${ANCHO}" height="${ALTO}" fill="url(#${idFondo})"/>`);

  // Arcos en fuga. Se dibujan RELLENOS y de fuera hacia dentro, cada uno más
  // oscuro: así el corredor se lee como profundidad. Antes eran contornos que
  // se mezclaban con el fondo hasta desaparecer.
  const cx = ANCHO * 0.5;
  const base = ALTO * 0.94;

  for (let i = 0; i < 4; i++) {
    const escala = 1 - i * 0.19;
    const w = ANCHO * 0.62 * escala;
    const h = ALTO * 0.92 * escala;

    // Cada arco es un peldaño más oscuro hacia el fondo del corredor.
    const color = mezclar(brillo(paleta.lejos, 1.5), BASE.tinta, i / 3.4);

    piezas.push(`<path d="M${num(cx - w / 2)} ${num(base)}`
      + `L${num(cx - w / 2)} ${num(base - h * 0.52)}`
      + `Q${num(cx)} ${num(base - h * 1.06)} ${num(cx + w / 2)} ${num(base - h * 0.52)}`
      + `L${num(cx + w / 2)} ${num(base)}Z" fill="${color}"/>`);
  }

  // Sillares en la pared más cercana: sin ellos la bóveda parece un túnel liso.
  for (let i = 0; i < 9; i++) {
    const y = base - i * 26 - 10;
    if (y < ALTO * 0.16) break;

    for (const lado of [-1, 1]) {
      const x = cx + lado * (ANCHO * 0.31 + flujo.flotante(0, 26));

      piezas.push(`<rect x="${num(x - 18)}" y="${num(y)}" width="36" height="17" `
        + `fill="${brillo(paleta.medio, 1.3)}" opacity="${num(flujo.flotante(0.10, 0.28))}"/>`);
    }
  }

  // Suelo.
  piezas.push(`<path d="${bandaCerrada(perfilar('roca', flujo, ALTO * 0.88, 6))}" `
    + `fill="${paleta.cerca}"/>`);

  // Escombro suelto: tres o cuatro bultos que rompen la simetría.
  for (let i = 0; i < flujo.entero(3, 6); i++) {
    const x = flujo.flotante(40, ANCHO - 40);
    const w = flujo.flotante(14, 34);

    piezas.push(`<ellipse cx="${num(x)}" cy="${num(ALTO * 0.90)}" `
      + `rx="${num(w)}" ry="${num(w * 0.38)}" fill="${BASE.tinta}" opacity="0.7"/>`);
  }

  // El resplandor de la antorcha, encima de todo: es lo que da el volumen.
  piezas.push(`<rect width="${ANCHO}" height="${ALTO}" fill="url(#${idLuz})"/>`);

  return piezas.join('');
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Genera el paisaje de un lugar.
 *
 * @param {Object} opciones
 * @param {string} opciones.refId Identificador del lugar: es la semilla, así
 *   que el mismo lugar sale siempre igual.
 * @param {string} [opciones.terreno]
 * @param {string} [opciones.nombre] Para el texto alternativo.
 * @param {string} [opciones.franja] Franja horaria del mundo.
 * @param {string} [opciones.clima]
 * @returns {string} SVG completo.
 */
export function paisaje(opciones = {}) {
  const {
    refId = 'lugar', terreno = 'camino', tipo = 'punto', nombre = '',
    franja = 'manana', clima = 'despejado',
  } = opciones;

  const paleta = TERRENOS[terreno] ?? TERRENO_POR_DEFECTO;
  const hora = FRANJAS[franja] ?? FRANJA_POR_DEFECTO;

  // La semilla depende SOLO del lugar: si dependiera también de la hora, el
  // relieve cambiaría al anochecer y no parecería el mismo sitio.
  const semilla = hashSemilla(`paisaje:${refId}`);
  const flujo = new Flujo(semilla, 'paisaje');

  const etiqueta = nombre ? `Vista de ${nombre}` : 'Paisaje';

  /* ── Mazmorra: camino aparte ────────────────────────────────────────── */
  if (terreno === 'mazmorra') {
    return lienzo({
      ancho: ANCHO, alto: ALTO, etiqueta, semilla,
      cuerpo: interior(flujo, paleta),
      vineta: 0.72, grano: 0.13, clase: 'arte arte--paisaje',
    });
  }

  /* ── Cielo ──────────────────────────────────────────────────────────── */
  const idCielo = idUnico('cielo');
  const defs = degradadoVertical(idCielo, hora.cielo[0], hora.cielo[1]);

  const piezas = [`<rect width="${ANCHO}" height="${ALTO}" fill="url(#${idCielo})"/>`];

  piezas.push(astro(franja, hora));

  /* ── Bandas de terreno ──────────────────────────────────────────────── */
  // De lejos a cerca: cada una más baja, más oscura y menos velada.
  const bandas = [
    { clave: 'lejos', baseY: ALTO * 0.56, amplitud: 46, velo: 0.42 },
    { clave: 'medio', baseY: ALTO * 0.72, amplitud: 30, velo: 0.20 },
    { clave: 'cerca', baseY: ALTO * 0.88, amplitud: 18, velo: 0.00 },
  ];

  for (let i = 0; i < bandas.length; i++) {
    const banda = bandas[i];
    const perfil = paleta.capas[i] ?? 'colinas';

    // La luz de la franja aclara u oscurece toda la banda por igual.
    const color = brillo(paleta[banda.clave], hora.luz);

    const puntos = perfilar(perfil, flujo, banda.baseY, banda.amplitud);
    piezas.push(`<path d="${bandaCerrada(puntos)}" fill="${color}"/>`);

    // Los adornos van del color de la banda siguiente: así se recortan.
    const colorAdorno = brillo(
      paleta[bandas[i + 1]?.clave ?? 'cerca'], hora.luz * 0.85,
    );

    piezas.push(adornos(perfil, flujo, banda.baseY, colorAdorno));

    // Lo construido va en la banda media: lo bastante cerca para leerse, lo
    // bastante lejos para no tapar el primer plano.
    if (banda.clave === 'medio') {
      piezas.push(construcciones(tipo, flujo, banda.baseY, colorAdorno, hora));
    }

    // Neblina de distancia. Es lo que separa una banda de la siguiente sin
    // dibujar una línea.
    if (banda.velo > 0) {
      piezas.push(`<rect y="${num(banda.baseY - banda.amplitud)}" width="${ANCHO}" `
        + `height="${num(ALTO - banda.baseY + banda.amplitud)}" `
        + `fill="${paleta.aire}" opacity="${num(banda.velo * (0.4 + hora.velo))}"/>`);
    }
  }

  /* ── Clima y lavado de hora ─────────────────────────────────────────── */
  piezas.push(velo(clima, flujo));

  // Un lavado final con el tinte de la franja unifica cielo y suelo, que es lo
  // que hace que la escena parezca pintada de una vez y no montada por capas.
  piezas.push(`<rect width="${ANCHO}" height="${ALTO}" fill="${hora.tinte}" `
    + `opacity="${num(hora.velo * 0.45)}" style="mix-blend-mode:soft-light"/>`);

  return lienzo({
    ancho: ANCHO, alto: ALTO, etiqueta, semilla, defs,
    cuerpo: piezas.join(''),
    vineta: 0.5, grano: 0.11, clase: 'arte arte--paisaje',
  });
}

/**
 * Capa transparente para fundir una ilustración raster con el estado vivo.
 * Conserva hora, clima y partículas sin volver a dibujar el lugar debajo.
 */
export function atmosfera(opciones = {}) {
  const { refId = 'lugar', nombre = '', franja = 'manana', clima = 'despejado' } = opciones;
  const hora = FRANJAS[franja] ?? FRANJA_POR_DEFECTO;
  const semilla = hashSemilla(`paisaje:${refId}`);
  const flujo = new Flujo(semilla, 'atmosfera');
  const etiqueta = nombre ? `Atmósfera de ${nombre}` : 'Atmósfera';
  const cuerpo = [
    velo(clima, flujo),
    `<rect width="${ANCHO}" height="${ALTO}" fill="${hora.tinte}" `
      + `opacity="${num(Math.max(0.05, hora.velo * 0.72))}" style="mix-blend-mode:soft-light"/>`,
  ].join('');
  return lienzo({
    ancho: ANCHO, alto: ALTO, etiqueta, semilla, cuerpo,
    vineta: 0.34, grano: 0.06, clase: 'arte arte--atmosfera',
  });
}

export default paisaje;
