/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · core/Logger.js
 * ---------------------------------------------------------------------------
 * Registro de diagnóstico por niveles y canales, con búfer circular en memoria.
 *
 * Por qué existe en lugar de usar console.log directamente:
 *   · Permite silenciar un subsistema entero sin borrar líneas de código.
 *   · Conserva las últimas N entradas en memoria, de modo que cuando algo
 *     falla se puede volcar el contexto previo al fallo.
 *   · Da un formato uniforme y coloreado que hace legible la consola durante
 *     el desarrollo de un motor con muchos sistemas hablando a la vez.
 *
 * Nada se escribe en disco ni se envía a ninguna parte: el búfer vive en RAM
 * y muere con la pestaña, en coherencia con las restricciones del proyecto.
 *
 * Dependencias: sólo config/app.config.js.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { LOG, ENTORNO, APP } from '../config/app.config.js';

/* ═══════════════════════════════════════════════════════════════════════════
   NIVELES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Niveles de severidad, de menor a mayor verbosidad.
 * Se imprime una entrada si su nivel es <= al nivel configurado.
 * @readonly
 * @enum {number}
 */
export const NIVEL = Object.freeze({
  SILENCIO: 0,
  ERROR: 1,
  AVISO: 2,
  INFO: 3,
  DEPURACION: 4,
  TRAZA: 5,
});

/** Nombre legible de cada nivel, para el búfer y los volcados. */
const NOMBRE_NIVEL = Object.freeze({
  1: 'ERROR',
  2: 'AVISO',
  3: 'INFO',
  4: 'DEBUG',
  5: 'TRAZA',
});

/**
 * Estilo CSS aplicado a la etiqueta de nivel en la consola del navegador.
 * @type {Readonly<Record<number, string>>}
 */
const ESTILO_NIVEL = Object.freeze({
  1: 'color:#fff; background:#9e2f28; padding:1px 5px; border-radius:3px; font-weight:600',
  2: 'color:#0b0a0e; background:#d99a2b; padding:1px 5px; border-radius:3px; font-weight:600',
  3: 'color:#0b0a0e; background:#4a8fd4; padding:1px 5px; border-radius:3px; font-weight:600',
  4: 'color:#e7e4ee; background:#383547; padding:1px 5px; border-radius:3px',
  5: 'color:#948fa6; background:#1e1d29; padding:1px 5px; border-radius:3px',
});

/** Estilo de la etiqueta de canal. */
const ESTILO_CANAL = 'color:#c9a227; font-weight:600';

/** Estilo del sello de tiempo. */
const ESTILO_TIEMPO = 'color:#6b667e; font-weight:400';

/**
 * Método de consola usado para cada nivel. Respetarlos permite que el
 * navegador agrupe y filtre correctamente, y que los errores muestren su
 * traza de pila nativa.
 */
const METODO_CONSOLA = Object.freeze({
  1: 'error',
  2: 'warn',
  3: 'info',
  4: 'log',
  5: 'debug',
});

/* ═══════════════════════════════════════════════════════════════════════════
   BÚFER CIRCULAR
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} EntradaLog
 * @property {number} t      Milisegundos transcurridos desde el arranque.
 * @property {number} nivel  Nivel de severidad.
 * @property {string} canal  Canal emisor.
 * @property {string} mensaje Texto principal.
 * @property {unknown[]} datos Argumentos adicionales, ya serializados a algo inspeccionable.
 */

/**
 * Búfer circular en memoria. Se sobrescribe a sí mismo al llenarse, de modo que
 * el consumo de memoria está acotado por LOG.bufferMax.
 * @type {EntradaLog[]}
 */
const buffer = [];

/** Índice de escritura del búfer circular. */
let cursor = 0;

/** Contador total de entradas emitidas, incluidas las ya sobrescritas. */
let totalEmitidas = 0;

/**
 * Inserta una entrada en el búfer circular.
 * @param {EntradaLog} entrada
 */
function almacenar(entrada) {
  if (buffer.length < LOG.bufferMax) {
    buffer.push(entrada);
  } else {
    buffer[cursor] = entrada;
    cursor = (cursor + 1) % LOG.bufferMax;
  }
  totalEmitidas++;
}

/**
 * Devuelve el búfer en orden cronológico, deshaciendo la rotación circular.
 * @returns {EntradaLog[]} Copia ordenada; mutarla no afecta al búfer real.
 */
function leerBuffer() {
  if (buffer.length < LOG.bufferMax) return buffer.slice();
  return buffer.slice(cursor).concat(buffer.slice(0, cursor));
}

/* ═══════════════════════════════════════════════════════════════════════════
   ESTADO MUTABLE DEL REGISTRO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Nivel activo. Arranca desde la configuración pero puede ajustarse en caliente
 * desde la consola: ARCANUM.log.nivel(5).
 */
let nivelActivo = LOG.nivel;

/**
 * Canales silenciados en caliente, además de los que ya vengan a false en la
 * configuración.
 * @type {Set<string>}
 */
const canalesSilenciados = new Set();

/**
 * Suscriptores externos al flujo de registro. UIManager puede engancharse aquí
 * para mostrar errores al jugador sin que Logger conozca la interfaz.
 * @type {Set<(entrada: EntradaLog) => void>}
 */
const oyentes = new Set();

/* ═══════════════════════════════════════════════════════════════════════════
   FORMATO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Formatea los milisegundos desde el arranque como mm:ss.mmm.
 * Es más útil que la hora del reloj: lo que importa al depurar un motor de
 * turnos es cuánto ha pasado desde que empezó todo.
 * @param {number} ms
 * @returns {string}
 */
function sello(ms) {
  const totalSeg = Math.floor(ms / 1000);
  const min = String(Math.floor(totalSeg / 60)).padStart(2, '0');
  const seg = String(totalSeg % 60).padStart(2, '0');
  const mil = String(Math.floor(ms % 1000)).padStart(3, '0');
  return `${min}:${seg}.${mil}`;
}

/**
 * Decide si una entrada debe imprimirse.
 * @param {number} nivel
 * @param {string} canal
 * @returns {boolean}
 */
function debeImprimir(nivel, canal) {
  if (nivel > nivelActivo) return false;
  if (canalesSilenciados.has(canal)) return false;
  // Un canal ausente del mapa se considera activo: así, un subsistema nuevo
  // registra desde el primer día sin tener que declararse en la configuración.
  if (canal in LOG.canales && LOG.canales[canal] === false) return false;
  return true;
}

/**
 * Emite una entrada: la almacena, la imprime si corresponde y avisa a los
 * oyentes. Es el único camino de salida del módulo.
 *
 * @param {number} nivel   Severidad.
 * @param {string} canal   Subsistema emisor.
 * @param {string} mensaje Texto principal.
 * @param {unknown[]} datos Argumentos adicionales.
 */
function emitir(nivel, canal, mensaje, datos) {
  const entrada = {
    t: Date.now() - ENTORNO.arranque,
    nivel,
    canal,
    mensaje: String(mensaje),
    datos,
  };

  // El búfer conserva TODO, incluso lo que no se imprime: al fallar algo,
  // interesa el contexto completo aunque el canal estuviera silenciado.
  almacenar(entrada);

  // Los oyentes reciben errores y avisos aunque el canal esté silenciado,
  // porque su cometido es alertar al usuario, no depurar.
  if (nivel <= NIVEL.AVISO || debeImprimir(nivel, canal)) {
    for (const oyente of oyentes) {
      try {
        oyente(entrada);
      } catch {
        // Un oyente roto jamás debe tumbar el registro.
      }
    }
  }

  if (!debeImprimir(nivel, canal)) return;

  const metodo = METODO_CONSOLA[nivel] ?? 'log';
  const fn = console[metodo] ?? console.log;

  if (LOG.colores) {
    fn.call(
      console,
      `%c${NOMBRE_NIVEL[nivel]}%c ${canal}%c ${sello(entrada.t)}\n${mensaje}`,
      ESTILO_NIVEL[nivel],
      ESTILO_CANAL,
      ESTILO_TIEMPO,
      ...datos,
    );
  } else {
    fn.call(console, `[${NOMBRE_NIVEL[nivel]}][${canal}][${sello(entrada.t)}] ${mensaje}`, ...datos);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   CANAL
   ---------------------------------------------------------------------------
   Cada subsistema obtiene su propio canal con crearCanal('combate') y lo usa
   como si fuera una consola privada.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} CanalLog
 * @property {(msg: string, ...datos: unknown[]) => void} error
 * @property {(msg: string, ...datos: unknown[]) => void} aviso
 * @property {(msg: string, ...datos: unknown[]) => void} info
 * @property {(msg: string, ...datos: unknown[]) => void} debug
 * @property {(msg: string, ...datos: unknown[]) => void} traza
 * @property {(etiqueta: string) => () => void} cronometro
 * @property {(titulo: string, fn: () => void) => void} grupo
 * @property {(condicion: unknown, msg: string) => void} afirmar
 * @property {string} nombre
 */

/**
 * Crea un canal de registro para un subsistema.
 *
 * @param {string} nombre Identificador del canal ('core', 'combat', 'ai'…).
 * @returns {CanalLog} Objeto de registro con los métodos por nivel.
 *
 * @example
 * const log = crearCanal('combat');
 * log.info('Combate iniciado', { enemigos: 3 });
 * const fin = log.cronometro('resolver ronda');
 * // …trabajo…
 * fin();  // → "resolver ronda: 4.20 ms"
 */
export function crearCanal(nombre) {
  return Object.freeze({
    nombre,

    error: (msg, ...datos) => emitir(NIVEL.ERROR, nombre, msg, datos),
    aviso: (msg, ...datos) => emitir(NIVEL.AVISO, nombre, msg, datos),
    info: (msg, ...datos) => emitir(NIVEL.INFO, nombre, msg, datos),
    debug: (msg, ...datos) => emitir(NIVEL.DEPURACION, nombre, msg, datos),
    traza: (msg, ...datos) => emitir(NIVEL.TRAZA, nombre, msg, datos),

    /**
     * Mide el tiempo de un bloque. Devuelve la función que cierra la medición.
     * No usa console.time para poder respetar los niveles y el búfer.
     * @param {string} etiqueta
     * @returns {() => number} Al llamarla registra y devuelve los ms transcurridos.
     */
    cronometro(etiqueta) {
      const inicio = performance.now();
      return () => {
        const ms = performance.now() - inicio;
        emitir(NIVEL.DEPURACION, nombre, `${etiqueta}: ${ms.toFixed(2)} ms`, []);
        return ms;
      };
    },

    /**
     * Agrupa entradas relacionadas en la consola. Si el nivel no permite
     * imprimir, ejecuta la función igualmente pero sin abrir grupo.
     * @param {string} titulo
     * @param {() => void} fn
     */
    grupo(titulo, fn) {
      const imprimible = debeImprimir(NIVEL.DEPURACION, nombre);
      if (imprimible && console.groupCollapsed) console.groupCollapsed(`%c${nombre}%c ${titulo}`, ESTILO_CANAL, '');
      try {
        fn();
      } finally {
        if (imprimible && console.groupEnd) console.groupEnd();
      }
    },

    /**
     * Afirmación de desarrollo. En desarrollo registra un error si la condición
     * es falsa; en producción no hace nada. No lanza: una afirmación rota nunca
     * debe interrumpir una partida en curso.
     * @param {unknown} condicion
     * @param {string} msg
     */
    afirmar(condicion, msg) {
      if (!ENTORNO.desarrollo || condicion) return;
      emitir(NIVEL.ERROR, nombre, `Afirmación fallida: ${msg}`, []);
    },
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   API DE CONTROL
   ═══════════════════════════════════════════════════════════════════════════ */

/** Canal por defecto para código que aún no tiene el suyo. */
const canalRaiz = crearCanal('core');

export const Logger = Object.freeze({

  /** Acceso directo al canal raíz. */
  error: canalRaiz.error,
  aviso: canalRaiz.aviso,
  info: canalRaiz.info,
  debug: canalRaiz.debug,
  traza: canalRaiz.traza,

  /** Crea canales. Reexportado aquí por comodidad. */
  crearCanal,

  /** Constantes de nivel. */
  NIVEL,

  /**
   * Ajusta el nivel activo en caliente.
   * @param {number} [nuevo] Si se omite, sólo devuelve el nivel actual.
   * @returns {number} Nivel vigente tras la llamada.
   */
  nivel(nuevo) {
    if (typeof nuevo === 'number' && nuevo >= 0 && nuevo <= 5) {
      nivelActivo = nuevo;
      canalRaiz.info(`Nivel de registro fijado en ${NOMBRE_NIVEL[nuevo] ?? 'SILENCIO'}`);
    }
    return nivelActivo;
  },

  /**
   * Silencia un canal en caliente.
   * @param {string} canal
   */
  silenciar(canal) {
    canalesSilenciados.add(canal);
  },

  /**
   * Reactiva un canal silenciado.
   * @param {string} canal
   */
  activar(canal) {
    canalesSilenciados.delete(canal);
  },

  /**
   * Registra un oyente del flujo de entradas. Devuelve la función de baja.
   * Se usa para que la interfaz muestre errores al jugador sin acoplar Logger
   * a la capa de presentación.
   *
   * @param {(entrada: EntradaLog) => void} oyente
   * @returns {() => void} Función para darse de baja.
   */
  escuchar(oyente) {
    oyentes.add(oyente);
    return () => oyentes.delete(oyente);
  },

  /**
   * Devuelve el histórico conservado en memoria, en orden cronológico.
   * @param {Object} [filtro]
   * @param {string} [filtro.canal] Sólo entradas de este canal.
   * @param {number} [filtro.nivelMax] Sólo entradas de severidad <= a este valor.
   * @returns {EntradaLog[]}
   */
  historial(filtro = {}) {
    let lista = leerBuffer();
    if (filtro.canal) lista = lista.filter((e) => e.canal === filtro.canal);
    if (typeof filtro.nivelMax === 'number') lista = lista.filter((e) => e.nivel <= filtro.nivelMax);
    return lista;
  },

  /**
   * Vuelca el histórico como texto plano. Pensado para pegarlo en un informe de
   * error: no se descarga ningún archivo ni se envía nada a ninguna parte.
   * @returns {string}
   */
  volcar() {
    const cabecera = [
      `${APP.nombre} ${APP.version} · ${APP.fase}`,
      `Entradas: ${totalEmitidas} emitidas, ${buffer.length} conservadas`,
      `Navegador: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'desconocido'}`,
      '─'.repeat(60),
    ].join('\n');

    const cuerpo = leerBuffer()
      .map((e) => {
        const extra = e.datos.length ? ` ${seguroJSON(e.datos)}` : '';
        return `[${sello(e.t)}][${NOMBRE_NIVEL[e.nivel]}][${e.canal}] ${e.mensaje}${extra}`;
      })
      .join('\n');

    return `${cabecera}\n${cuerpo}`;
  },

  /** Vacía el búfer sin tocar la configuración. */
  limpiar() {
    buffer.length = 0;
    cursor = 0;
  },

  /** Número total de entradas emitidas desde el arranque. */
  get contador() {
    return totalEmitidas;
  },
});

/**
 * Serializa datos arbitrarios sin lanzar ante referencias circulares ni valores
 * no serializables. Imprescindible en un volcado de diagnóstico: el objetivo es
 * obtener información, no una excepción secundaria.
 *
 * @param {unknown} valor
 * @returns {string}
 */
function seguroJSON(valor) {
  const vistos = new WeakSet();
  try {
    return JSON.stringify(valor, (_clave, v) => {
      if (typeof v === 'function') return '[función]';
      if (typeof v === 'symbol') return v.toString();
      if (typeof v === 'bigint') return `${v}n`;
      if (v instanceof Error) return `${v.name}: ${v.message}`;
      if (typeof v === 'object' && v !== null) {
        if (vistos.has(v)) return '[circular]';
        vistos.add(v);
      }
      return v;
    });
  } catch {
    return '[no serializable]';
  }
}

export default Logger;
