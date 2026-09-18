/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · src/art/index.js
 * ---------------------------------------------------------------------------
 * Cargador de arte. La única puerta por la que la interfaz pide imágenes.
 *
 * Tiene dos salidas y siempre da una:
 *
 *   1. Si hay un archivo de imagen declarado en el manifiesto Y carga bien, se
 *      usa ese.
 *   2. Si no hay manifiesto, o el archivo falta, o falla al cargar, se usa el
 *      SVG generado.
 *
 * El SVG se pinta SIEMPRE primero y la imagen lo sustituye después, ya cargada.
 * Al revés —poner el `<img>` y esperar— se ve un hueco, y si el archivo no
 * está, el hueco se queda. Un icono de imagen rota es peor que un vector.
 *
 * Esto es lo que permite empezar con arte vectorial hoy y pasar a imágenes
 * generadas mañana sin tocar la interfaz: basta con dejar los archivos en
 * `assets/` y declararlos en `assets/manifest.json`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { paisaje } from './paisaje.js';
import { retrato } from './retrato.js';
import { criatura } from './criatura.js';

export { paisaje, retrato, criatura };

/* ═══════════════════════════════════════════════════════════════════════════
   MANIFIESTO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Manifiesto de imágenes disponibles.
 *
 * Forma esperada:
 *
 * ```json
 * {
 *   "base": "assets/",
 *   "paisajes":  { "vado_yunque": "paisajes/vado_yunque.webp" },
 *   "retratos":  { "valdes": "retratos/valdes.webp" },
 *   "criaturas": { "lobo_ceniciento": "criaturas/lobo.webp" }
 * }
 * ```
 *
 * Vacío por defecto: sin manifiesto el juego funciona igual, solo que todo el
 * arte es vectorial.
 */
let manifiesto = { base: '', paisajes: {}, retratos: {}, criaturas: {} };

/** Archivos que ya se sabe que no cargan: no se reintentan en cada turno. */
const fallidos = new Set();

/**
 * Cuántas veces se ha cambiado el manifiesto.
 *
 * Entra en la firma de caché de `pintarArte`. Sin esto, una pieza pintada
 * ANTES de que llegue el manifiesto se queda en vector para siempre: la firma
 * no cambiaría y el repintado se saltaría. Como el manifiesto se carga sin
 * bloquear el arranque, ese caso es el normal, no la excepción.
 */
let version = 0;

/**
 * Registra un manifiesto de imágenes.
 *
 * @param {Object} nuevo
 */
export function registrarManifiesto(nuevo, prefijo = '') {
  if (!nuevo || typeof nuevo !== 'object') return;

  manifiesto = {
    base: `${prefijo}${nuevo.base ?? ''}`,
    paisajes: nuevo.paisajes ?? {},
    retratos: nuevo.retratos ?? {},
    criaturas: nuevo.criaturas ?? {},
  };

  version += 1;
}

/**
 * Carga el manifiesto desde disco, si lo hay.
 *
 * Falla en silencio a propósito: no tener manifiesto es el caso normal, no un
 * error. En el archivo único la petición falla siempre y el juego sigue con
 * arte vectorial, que es justo lo previsto.
 *
 * @param {string} [ruta]
 * @returns {Promise<boolean>} Si se cargó algo.
 */
export async function cargarManifiesto(ruta = 'assets/manifest.json') {
  try {
    const respuesta = await fetch(ruta, { cache: 'no-cache' });
    if (!respuesta.ok) return false;

    // Las rutas del manifiesto se resuelven contra el PROPIO manifiesto, no
    // contra el documento. `app/index.html` pide `../assets/manifest.json`, y
    // sin este prefijo un `retratos/x.webp` de dentro acabaría buscándose en
    // `app/retratos/x.webp`.
    const carpeta = ruta.slice(0, ruta.lastIndexOf('/') + 1);

    registrarManifiesto(await respuesta.json(), carpeta);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ruta del archivo de imagen de una clave, si está declarado.
 *
 * @param {'paisajes'|'retratos'|'criaturas'} familia
 * @param {string} clave
 * @returns {string|null}
 */
export function rutaRaster(familia, clave) {
  const relativa = manifiesto[familia]?.[clave];
  if (!relativa) return null;

  const completa = `${manifiesto.base ?? ''}${relativa}`;
  return fallidos.has(completa) ? null : completa;
}

/* ═══════════════════════════════════════════════════════════════════════════
   GENERACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Devuelve el SVG de una pieza según su familia.
 *
 * @param {string} familia
 * @param {Object} opciones
 * @returns {string}
 */
function generar(familia, opciones) {
  switch (familia) {
    case 'retratos': return retrato(opciones);
    case 'criaturas': return criatura(opciones);
    case 'paisajes':
    default: return paisaje(opciones);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   PINTADO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Pinta una pieza de arte dentro de un nodo.
 *
 * @param {HTMLElement} nodo Contenedor. Se vacía.
 * @param {Object} peticion
 * @param {'paisajes'|'retratos'|'criaturas'} peticion.familia
 * @param {string} peticion.clave Identificador para el manifiesto y la semilla.
 * @param {Object} [peticion.opciones] Lo que recibe el generador.
 * @returns {void}
 */
export function pintarArte(nodo, peticion) {
  if (!nodo) return;

  const { familia, clave, opciones = {} } = peticion;

  // Se evita repintar lo mismo: el paisaje se pide en cada refresco y
  // regenerarlo hace parpadear la imagen sin motivo.
  const firma = `${version}:${familia}:${clave}:${JSON.stringify(opciones)}`;
  if (nodo.dataset.firmaArte === firma) return;

  nodo.dataset.firmaArte = firma;
  nodo.innerHTML = generar(familia, opciones);

  /* ── Mejora a imagen, si la hay ───────────────────────────────────────── */
  const ruta = rutaRaster(familia, clave);
  if (!ruta) return;

  const img = new Image();

  img.addEventListener('load', () => {
    // Puede haber cambiado de lugar mientras cargaba; si es así, no se pisa.
    if (nodo.dataset.firmaArte !== firma) return;

    img.className = 'arte arte--imagen';
    img.alt = opciones.nombre ?? '';
    nodo.replaceChildren(img);
  });

  img.addEventListener('error', () => {
    // Se apunta para no volver a intentarlo en cada turno. El SVG ya está
    // puesto, así que no hay nada más que hacer.
    fallidos.add(ruta);
  });

  img.src = ruta;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ATAJOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Pinta el paisaje de un lugar, con la hora y el clima del mundo.
 *
 * @param {HTMLElement} nodo
 * @param {Object} lugar Entrada de `locations.data.js`.
 * @param {Object} [mundo] `{ franja, clima }`.
 */
export function pintarLugar(nodo, lugar, mundo = {}) {
  if (!lugar) return;

  pintarArte(nodo, {
    familia: 'paisajes',
    clave: lugar.refId,
    opciones: {
      refId: lugar.refId,
      terreno: lugar.terreno,
      tipo: lugar.tipo,
      nombre: lugar.nombre,
      franja: mundo.franja ?? 'manana',
      clima: mundo.clima ?? 'despejado',
    },
  });
}

/**
 * Pinta el retrato de un personaje.
 *
 * @param {HTMLElement} nodo
 * @param {Object} personaje `{ raza, nombre }`.
 */
export function pintarRetrato(nodo, personaje = {}) {
  pintarArte(nodo, {
    familia: 'retratos',
    clave: personaje.raza ?? 'valdes',
    opciones: {
      raza: personaje.raza ?? 'valdes',
      nombre: personaje.nombre ?? '',
      // La semilla es SOLO el linaje, no el nombre. Sembrar con el nombre daba
      // más variedad, pero la vista previa de la creación —donde aún no hay
      // nombre escrito— habría enseñado una cara y la partida otra distinta.
      // Que el jugador reciba el rostro que eligió importa más que la variedad.
      semilla: '',
    },
  });
}

/**
 * Pinta una criatura.
 *
 * @param {HTMLElement} nodo
 * @param {Object} enemigo Entrada de `enemies.data.js`.
 */
export function pintarCriatura(nodo, enemigo = {}) {
  pintarArte(nodo, {
    familia: 'criaturas',
    clave: enemigo.refId ?? 'criatura',
    opciones: {
      refId: enemigo.refId ?? 'criatura',
      tipo: enemigo.tipo,
      tamano: enemigo.tamano,
      nombre: enemigo.nombre ?? '',
    },
  });
}
