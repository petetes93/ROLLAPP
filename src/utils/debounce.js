/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · utils/debounce.js
 * ---------------------------------------------------------------------------
 * Control de frecuencia de ejecución.
 *
 * Todas las funciones devuelven un envoltorio con método `cancelar()`. No es un
 * lujo: los componentes se destruyen al cambiar de pantalla y un temporizador
 * pendiente que dispara sobre un componente ya desmontado es una fuga y un
 * error simultáneos.
 *
 * Sin dependencias.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * @typedef {Object} Controlable
 * @property {() => void} cancelar Anula la ejecución pendiente.
 * @property {() => void} [ejecutarYa] Ejecuta de inmediato lo pendiente.
 */

/**
 * Retrasa la ejecución hasta que pasen `ms` sin nuevas llamadas.
 * Para guardar automáticamente tras dejar de teclear, o recalcular el diseño al
 * terminar de redimensionar.
 *
 * @template {(...args: any[]) => any} F
 * @param {F} fn
 * @param {number} ms
 * @returns {F & Controlable}
 */
export function antirrebote(fn, ms) {
  let temporizador = null;
  let ultimosArgs = null;

  const envoltorio = function (...args) {
    ultimosArgs = args;
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      temporizador = null;
      fn.apply(this, ultimosArgs);
    }, ms);
  };

  envoltorio.cancelar = () => {
    if (temporizador) clearTimeout(temporizador);
    temporizador = null;
    ultimosArgs = null;
  };

  envoltorio.ejecutarYa = function () {
    if (!temporizador) return;
    clearTimeout(temporizador);
    temporizador = null;
    fn.apply(this, ultimosArgs);
  };

  return /** @type {any} */ (envoltorio);
}

/**
 * Limita la ejecución a una vez cada `ms`, ejecutando en el primer borde.
 *
 * @template {(...args: any[]) => any} F
 * @param {F} fn
 * @param {number} ms
 * @returns {F & Controlable}
 */
export function limitar(fn, ms) {
  let ultima = 0;
  let temporizador = null;

  const envoltorio = function (...args) {
    const ahora = Date.now();
    const restante = ms - (ahora - ultima);

    if (restante <= 0) {
      ultima = ahora;
      fn.apply(this, args);
    } else if (!temporizador) {
      // Se garantiza que la última llamada del periodo no se pierda.
      temporizador = setTimeout(() => {
        ultima = Date.now();
        temporizador = null;
        fn.apply(this, args);
      }, restante);
    }
  };

  envoltorio.cancelar = () => {
    if (temporizador) clearTimeout(temporizador);
    temporizador = null;
    ultima = 0;
  };

  return /** @type {any} */ (envoltorio);
}

/**
 * Agrupa las llamadas en un único fotograma de animación.
 * Es lo correcto para cualquier función que escriba en el DOM: repintar más de
 * una vez por fotograma es trabajo tirado.
 *
 * @template {(...args: any[]) => any} F
 * @param {F} fn
 * @returns {F & Controlable}
 */
export function porFotograma(fn) {
  let solicitud = null;
  let ultimosArgs = null;

  const envoltorio = function (...args) {
    ultimosArgs = args;
    if (solicitud !== null) return;
    solicitud = requestAnimationFrame(() => {
      solicitud = null;
      fn.apply(this, ultimosArgs);
    });
  };

  envoltorio.cancelar = () => {
    if (solicitud !== null) cancelAnimationFrame(solicitud);
    solicitud = null;
    ultimosArgs = null;
  };

  return /** @type {any} */ (envoltorio);
}

/**
 * Ejecuta la función una sola vez; las llamadas posteriores devuelven el primer
 * resultado.
 *
 * @template {(...args: any[]) => any} F
 * @param {F} fn
 * @returns {F}
 */
export function unaVez(fn) {
  let llamada = false;
  let resultado;
  return /** @type {any} */ (function (...args) {
    if (!llamada) {
      llamada = true;
      resultado = fn.apply(this, args);
    }
    return resultado;
  });
}

/**
 * Promesa que se resuelve tras `ms` milisegundos.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function dormir(ms) {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

/**
 * Espera al siguiente fotograma. Se usa para dejar que el navegador aplique un
 * estilo antes de iniciar una transición sobre él.
 * @returns {Promise<void>}
 */
export function siguienteFotograma() {
  return new Promise((resolver) => requestAnimationFrame(() => resolver()));
}

export default { antirrebote, limitar, porFotograma, unaVez, dormir, siguienteFotograma };
