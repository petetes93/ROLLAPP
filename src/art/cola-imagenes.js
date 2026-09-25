/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · art/cola-imagenes.js
 * ---------------------------------------------------------------------------
 * Una sola petición de imagen a la vez.
 *
 * El servicio de imágenes (Pollinations) descarta las peticiones en paralelo
 * y responde 429 si se le piden varias seguidas. Al empezar partida se pedían
 * a la vez el retrato del jugador, el del compañero y la ilustración de la
 * escena, y alguna se quedaba sin llegar. Aquí se ponen en fila: una tras
 * otra y con un respiro entre medias.
 *
 * Solo pasan por aquí las imágenes NUEVAS. Lo que ya cargó una vez está en la
 * caché del navegador y se pinta directamente, sin esperar turno.
 *
 * Sin dependencias del resto del juego.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Respiro mínimo entre dos peticiones, en milisegundos. */
const RESPIRO = 2000;

/**
 * Lo más que se espera a una imagen antes de dejar pasar a la siguiente. El
 * servicio tarda unos 20 s con un encargo nuevo; si alguna se cuelga, no
 * puede bloquear a todas las demás. La que se pasó de tiempo sigue cargando
 * y, si llega, se pinta igual.
 */
const TOPE = 45000;

let fila = Promise.resolve();
let ultima = 0;

/**
 * Turno de cada URL que está en la fila. El panel crea un nodo nuevo en cada
 * repintado y cada uno pide su retrato: sin esto, la misma imagen se ponía a
 * la cola varias veces. La segunda espera a la primera y sale de la caché.
 */
const enFila = new Map();

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

/**
 * Carga una imagen cuando le toque.
 *
 * Los manejadores `load` y `error` se ponen antes de llamar aquí: esta
 * función solo decide CUÁNDO se asigna `src`.
 *
 * @param {HTMLImageElement} img
 * @param {string} url
 * @param {Object} [opciones]
 * @param {() => boolean} [opciones.vigente] Si al llegar su turno ya no hace
 *   falta (el jugador se ha ido, el retrato es otro), no se pide.
 * @returns {Promise<void>} Se resuelve al terminar su turno.
 */
export function cargarEnFila(img, url, { vigente = () => true } = {}) {
  const previa = enFila.get(url);
  if (previa) {
    return previa.then(() => {
      if (vigente()) img.src = url;
    });
  }

  fila = fila.then(async () => {
    if (!vigente()) return;

    const falta = ultima + RESPIRO - Date.now();
    if (falta > 0) await esperar(falta);
    if (!vigente()) return;

    await Promise.race([
      new Promise((fin) => {
        img.addEventListener('load', fin, { once: true });
        img.addEventListener('error', fin, { once: true });
        img.src = url;
      }),
      esperar(TOPE),
    ]);
    ultima = Date.now();
  });

  const turno = fila;
  enFila.set(url, turno);
  turno.then(() => { if (enFila.get(url) === turno) enFila.delete(url); });
  return turno;
}

export default { cargarEnFila };
