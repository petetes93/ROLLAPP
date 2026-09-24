/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ai/Cadencia.js
 * ---------------------------------------------------------------------------
 * El ritmo de la narración.
 *
 * El director componía párrafos densos: cuatro o cinco frases seguidas en un
 * bloque. Se leen de un vistazo y se olvidan igual de rápido, porque todo pesa
 * lo mismo. Una tirada crítica y el viento en el trigo ocupaban el mismo sitio
 * y sonaban igual.
 *
 * La narración de mesa no funciona así. Va por golpes:
 *
 *     La última criatura de la oleada cae.
 *
 *     Y, por un instante, reina el silencio.
 *
 *     Solo dura unos segundos.
 *
 *     BUM.
 *
 * Cada frase respira sola. El silencio entre líneas ES la narración: marca el
 * tiempo, deja caer lo importante y obliga al ojo a detenerse. Y encaja con
 * cómo el juego ya pinta el texto —línea a línea, con pausa— así que la
 * máquina de escribir pasa de efecto decorativo a instrumento de ritmo.
 *
 * ── Qué hace y qué no ────────────────────────────────────────────────────
 *
 * Esto NO escribe. Toma la prosa que ya compuso el director y decide dónde
 * cortarla, qué aislar y dónde cabe un golpe. Separar el ritmo del contenido
 * es lo que permite tocar uno sin romper el otro.
 *
 * Funciones puras.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* ═══════════════════════════════════════════════════════════════════════════
   GOLPES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Sonidos que valen por una frase entera.
 *
 * Van solos en su línea, en versalita, y no se explican. Un «CLANG» dice lo
 * que la espada cayó al suelo sin gastar una oración en decirlo, y además deja
 * un hueco de silencio detrás que ninguna descripción consigue.
 *
 * Se usan con cuentagotas. El cuarto de una sesión ya no suena: se lee.
 */
export const GOLPES = Object.freeze({
  critico: ['ZAS.', 'CRACK.', 'SHHHNG.'],
  pifia: ['CLANG.', 'CRAC.'],
  derribo: ['BOOM.', 'PUM.'],
  puerta: ['CLONC.', 'CHIRRÍA.'],
  combate: ['BUM.', 'BUM. BUM.'],
});

/* ═══════════════════════════════════════════════════════════════════════════
   CORTE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Trozos que NO se parten aunque lleven punto dentro.
 *
 * El diálogo va entero: cortar «—Ni idea. Aquí cada uno se ocupa de lo suyo.»
 * en dos líneas rompe la réplica y parece que hablan dos personas.
 */
const INDIVISIBLE = /^[«"—–]/u;

/**
 * Parte un bloque de prosa en frases, una por línea.
 *
 * Se respeta el punto como límite, pero no se parte por partir: una frase de
 * cinco palabras y la siguiente de cuatro se quedan juntas si las dos son
 * cortas, porque diez líneas de tres palabras no es ritmo, es tartamudeo.
 *
 * @param {string} texto
 * @param {Object} [opciones]
 * @param {number} [opciones.minimo] Bajo esta longitud, la frase busca compañía.
 * @returns {string[]}
 */
export function enFrases(texto, { minimo = 28 } = {}) {
  const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim();
  if (!limpio) return [];

  if (INDIVISIBLE.test(limpio)) return [limpio];

  // El corte mira el punto seguido de mayúscula: así «d20 14. Éxito» se parte
  // y «Sr. Verros» no.
  const crudas = limpio.split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÑ¿¡«"—])/u).filter(Boolean);

  const salida = [];

  for (const frase of crudas) {
    const previa = salida.at(-1);

    // Dos frases muy cortas seguidas se juntan: el ritmo lo dan los silencios,
    // y un silencio cada cuatro palabras no es un silencio, es un tropiezo.
    if (previa && previa.length < minimo && frase.length < minimo && !INDIVISIBLE.test(frase)) {
      salida[salida.length - 1] = `${previa} ${frase}`;
      continue;
    }

    salida.push(frase);
  }

  return salida;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MONTAJE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Conectores que marcan que algo va a cambiar.
 *
 * Van SOLOS en su línea, antes del golpe. Es el recurso más viejo que hay y
 * funciona por lo que no dice: el lector sabe que viene algo y no sabe qué.
 */
const ANTESALA = ['Y entonces...', 'Y entonces...', 'Hasta que...'];

/**
 * Monta el turno entero como una sucesión de golpes.
 *
 * @param {string[]} bloques Los párrafos que compuso el director, en orden.
 * @param {Object} [opciones]
 * @param {string} [opciones.golpe] Clave de `GOLPES` para el sonido de impacto.
 * @param {boolean} [opciones.antesala] Si el turno merece un corte de tensión.
 * @param {Function} [opciones.elegir] Cómo se elige entre variantes.
 * @returns {string} Líneas separadas por salto simple.
 */
export function montar(bloques, { golpe = '', antesala = false, elegir = (l) => l[0] } = {}) {
  const lineas = [];

  const utiles = (bloques ?? []).filter(Boolean);

  for (const [i, bloque] of utiles.entries()) {
    // La antesala va justo después de la acción, antes del bloque donde está
    // el giro.
    //
    // Al principio iba antes del último bloque y quedaba fatal: el último
    // suele ser el ambiente, así que anunciaba a bombo y platillo que iba a
    // hacer buen tiempo. El giro está en el segundo: lo que el mundo responde
    // cuando el jugador acaba de actuar.
    if (antesala && i === 1) lineas.push(elegir(ANTESALA));

    lineas.push(...enFrases(bloque));

    // El golpe cierra el primer bloque, que es el de la acción: el sonido
    // pertenece a lo que acaba de pasar, no al ambiente de después.
    if (golpe && i === 0 && GOLPES[golpe]) lineas.push(elegir(GOLPES[golpe]));
  }

  return lineas.join('\n');
}

/**
 * ¿Esta línea es un golpe?
 *
 * Lo usa la interfaz para pintarla distinta. Se reconoce por la forma —corta y
 * en mayúsculas— y no por una marca, para que valga también con los sonidos
 * que escriba un modelo de lenguaje, que no conoce nuestras convenciones.
 *
 * @param {string} linea
 * @returns {boolean}
 */
export function esGolpe(linea) {
  const t = String(linea ?? '').trim();
  if (!t || t.length > 24) return false;

  // Sonido: corto y en versalita. «CLANG.», «BUM. BUM.»
  if (/^[A-ZÁÉÍÓÚÑ¡!.\s]+$/u.test(t) && /[A-ZÁÉÍÓÚÑ]{3}/u.test(t)) return true;

  // Antesala: corta y suspendida. «Y entonces...», «Hasta que...» Van con el
  // mismo tratamiento porque cumplen la misma función —hacer que el ojo se
  // pare— aunque no vayan en mayúsculas.
  return /\.{3}$|…$/u.test(t) && t.split(/\s+/).length <= 4;
}

export default { enFrases, montar, esGolpe, GOLPES };
