/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ai/providers/IDMProvider.js
 * ---------------------------------------------------------------------------
 * Interfaz común de todo director de juego.
 *
 * Cuatro implementaciones tras el mismo contrato: procedural, puente manual,
 * modelo local y API remota. El motor de turno no distingue entre ellas.
 *
 * Esta clase base hace tres cosas:
 *   · Define el contrato que deben cumplir las subclases.
 *   · Implementa lo común: reintentos, respaldo, contador de fallos.
 *   · Garantiza que `dirigir()` NUNCA lance. Si todo falla, devuelve un turno
 *     mínimo válido. Una partida no puede quedarse colgada porque un modelo
 *     devolviera basura.
 *
 * Ese último punto es la razón de que exista esta capa. Sin ella, cada
 * proveedor tendría que reimplementar su propia red de seguridad.
 *
 * Dependencias: Logger, Errors, config/ai.config.js.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { crearCanal } from '../../core/Logger.js';
import { ErrorDirector, CODIGO, registrar } from '../../core/Errors.js';
import { RED, DIRECTOR } from '../../config/ai.config.js';

/**
 * @typedef {Object} PeticionTurno
 * @property {string} accion Texto de la acción del jugador.
 * @property {Object} intencion Intención ya interpretada.
 * @property {Object|null} tirada Resultado de la prueba, si la hubo.
 * @property {Object} contexto Estado compuesto por ContextComposer.
 * @property {string} tipo 'narracion'|'combate'|'dialogo'|'comercio'
 * @property {number} turno
 */

/**
 * @typedef {Object} RespuestaTurno
 * @property {number} schemaVersion
 * @property {string} story
 * @property {Array<Object>} choices
 * @property {Object} playerUpdates
 * @property {Array<Object>} newItems
 * @property {Array<Object>} quests
 * @property {Object} combat
 * @property {Array<Object>} events
 * @property {Array<string>} [memory]
 * @property {string} [mood]
 */

export class IDMProvider {
  /**
   * Identificador del proveedor. Las subclases DEBEN redefinirlo.
   * @type {string}
   */
  static id = 'base';

  /** Nombre visible en Ajustes. @type {string} */
  static nombre = 'Director base';

  /** true si puede funcionar sin red ni credenciales. @type {boolean} */
  static autonomo = true;

  /**
   * @param {Object} [opciones]
   * @param {import('../../core/RNG.js').GestorRNG} [opciones.rng]
   * @param {IDMProvider} [opciones.respaldo] Proveedor al que caer si este falla.
   */
  constructor(opciones = {}) {
    const clase = /** @type {typeof IDMProvider} */ (this.constructor);

    this.id = clase.id;
    this.nombre = clase.nombre;
    this.rng = opciones.rng ?? null;
    this.respaldo = opciones.respaldo ?? null;

    this.log = crearCanal('ai');

    /** Fallos consecutivos. Al superar el umbral, se cae al respaldo. */
    this.fallosSeguidos = 0;

    /** true mientras hay una petición en curso. */
    this.ocupado = false;

    /** Estadísticas de la sesión, para diagnóstico. */
    this.stats = { peticiones: 0, exitos: 0, fallos: 0, respaldos: 0, msTotal: 0 };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONTRATO — las subclases implementan esto
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Produce la respuesta de un turno.
   *
   * Es el único método que las subclases DEBEN implementar. Puede lanzar: la
   * clase base se encarga de capturar, reintentar y caer al respaldo.
   *
   * @param {PeticionTurno} _peticion
   * @returns {Promise<RespuestaTurno>}
   * @abstract
   * @protected
   */
  async generar(_peticion) {
    throw new ErrorDirector(`El proveedor "${this.id}" no implementa generar()`, {
      code: CODIGO.IA_PROVEEDOR_DESCONOCIDO,
      reintentable: false,
    });
  }

  /**
   * Comprueba si el proveedor está listo para trabajar.
   *
   * @returns {{listo: boolean, motivo: string|null}}
   */
  comprobar() {
    return { listo: true, motivo: null };
  }

  /**
   * Interpreta la descripción libre de un personaje durante la creación.
   *
   * Opcional. Si un proveedor no lo implementa, CharacterInterview recurre a su
   * análisis léxico interno.
   *
   * @param {string} _texto
   * @param {Object} _borrador
   * @returns {Promise<Object|null>}
   */
  async interpretarPersonaje(_texto, _borrador) {
    return null;
  }

  /**
   * Genera un resumen de capítulo para comprimir la memoria.
   *
   * Opcional. Sin implementación, MemoryStore usa un resumen mecánico.
   *
   * @param {Array<Object>} _turnos
   * @returns {Promise<string|null>}
   */
  async resumir(_turnos) {
    return null;
  }

  /** Libera recursos. Las subclases con conexiones abiertas lo redefinen. */
  destruir() {}

  /* ═══════════════════════════════════════════════════════════════════════
     ORQUESTACIÓN — común a todos
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Dirige un turno con reintentos y respaldo.
   *
   * GARANTÍA: nunca lanza. Si todo falla, devuelve un turno mínimo válido.
   *
   * @param {PeticionTurno} peticion
   * @returns {Promise<{respuesta: RespuestaTurno, proveedor: string, degradado: boolean, avisos: string[]}>}
   */
  async dirigir(peticion) {
    const inicio = performance.now();
    this.stats.peticiones++;
    this.ocupado = true;

    const avisos = [];

    try {
      // ─── Comprobación previa ────────────────────────────────────────────
      const check = this.comprobar();
      if (!check.listo) {
        avisos.push(check.motivo);
        return await this._caerAlRespaldo(peticion, avisos, check.motivo);
      }

      // ─── Intentos ───────────────────────────────────────────────────────
      let ultimoError = null;

      for (let intento = 0; intento <= RED.reintentos; intento++) {
        try {
          if (intento > 0) {
            const espera = RED.esperaBase * Math.pow(RED.factorEspera, intento - 1);
            this.log.debug(`reintento ${intento} tras ${Math.round(espera)} ms`);
            await this._dormir(espera);
          }

          const respuesta = await this.generar(peticion);

          this.fallosSeguidos = 0;
          this.stats.exitos++;
          this.stats.msTotal += performance.now() - inicio;

          return { respuesta, proveedor: this.id, degradado: false, avisos };

        } catch (e) {
          ultimoError = e;
          const err = e instanceof ErrorDirector ? e : null;

          // Un error no reintentable corta el bucle de inmediato: no tiene
          // sentido volver a pedir con una credencial que falta.
          if (err && !err.reintentable) {
            this.log.aviso(`fallo no reintentable: ${err.message}`);
            break;
          }

          this.log.aviso(`intento ${intento + 1} fallido: ${e?.message ?? e}`);
        }
      }

      // ─── Todos los intentos han fallado ─────────────────────────────────
      this.fallosSeguidos++;
      this.stats.fallos++;
      registrar(ultimoError ?? new ErrorDirector('Fallo desconocido del director'), 'ai');

      avisos.push(ultimoError?.message ?? 'El director no ha respondido');
      return await this._caerAlRespaldo(peticion, avisos, ultimoError?.message);

    } finally {
      this.ocupado = false;
    }
  }

  /**
   * Delega en el proveedor de respaldo, o construye un turno mínimo.
   *
   * @param {PeticionTurno} peticion
   * @param {string[]} avisos
   * @param {string} [motivo]
   * @returns {Promise<Object>}
   * @private
   */
  async _caerAlRespaldo(peticion, avisos, motivo) {
    if (this.respaldo && this.respaldo.id !== this.id) {
      this.stats.respaldos++;
      this.log.aviso(`cayendo al respaldo "${this.respaldo.id}"`);

      try {
        const respuesta = await this.respaldo.generar(peticion);
        return { respuesta, proveedor: this.respaldo.id, degradado: true, avisos };
      } catch (e) {
        registrar(e, 'ai');
        avisos.push('El respaldo también ha fallado');
      }
    }

    // Última red: un turno mínimo pero válido. La partida sigue.
    return {
      respuesta: this.turnoMinimo(peticion, motivo),
      proveedor: 'minimo',
      degradado: true,
      avisos,
    };
  }

  /**
   * Construye un turno mínimo válido.
   *
   * No es una respuesta de error: es una escena real, con narración y opciones.
   * El jugador puede seguir jugando aunque el director esté caído.
   *
   * @param {PeticionTurno} peticion
   * @param {string} [motivo]
   * @returns {RespuestaTurno}
   */
  turnoMinimo(peticion, motivo) {
    const tirada = peticion?.tirada;

    // Se narra el resultado de la tirada, que el motor ya calculó. Aunque el
    // director esté mudo, la mecánica sigue siendo cierta.
    // La acción del jugador NO se le devuelve entre comillas.
    //
    // Salía «"ataco con el hacha al saqueador más cercano" funciona, aunque
    // los detalles se pierden en la confusión del momento»: el juego
    // admitiendo que no sabe qué contar y devolviéndole al jugador sus propias
    // palabras con un lazo. Y aparecía justo cuando el turno se había perdido,
    // así que la frase de consuelo era además la señal de que no pasó nada.
    //
    // Corta y honesta: sale o no sale.
    let story;
    if (tirada && tirada.habilidad === 'percepcion') {
      // Mirar no se falla: como mucho no hay nada que ver.
      story = tirada.exito
        ? 'Te haces una idea del sitio.'
        : 'Nada fuera de lo corriente.';
    } else if (tirada) {
      story = tirada.exito
        ? 'Sale. No de forma vistosa, pero sale.'
        : 'No sale. Algo se tuerce y te quedas donde estabas.';
    } else {
      story = 'El momento pasa sin que ocurra nada digno de mención. El mundo sigue a su ritmo.';
    }

    return {
      schemaVersion: 1,
      story,
      choices: DIRECTOR.opcionesRespaldo.map((o) => ({ ...o })),
      playerUpdates: {},
      newItems: [],
      quests: [],
      combat: {},
      events: motivo
        ? [{ type: 'ambient', payload: { nota: 'director degradado', motivo }, silent: true }]
        : [],
      memory: [],
      mood: 'neutro',
      _minimo: true,
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     AUXILIARES
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * @param {number} ms
   * @returns {Promise<void>}
   * @protected
   */
  _dormir(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Envuelve una promesa con tiempo límite.
   *
   * @template T
   * @param {Promise<T>} promesa
   * @param {number} ms
   * @param {string} [descripcion='petición']
   * @returns {Promise<T>}
   * @protected
   */
  async _conTimeout(promesa, ms, descripcion = 'petición') {
    let temporizador;

    const limite = new Promise((_, rechazar) => {
      temporizador = setTimeout(() => {
        rechazar(new ErrorDirector(`Tiempo agotado en ${descripcion} (${ms} ms)`, {
          code: CODIGO.IA_TIMEOUT,
          reintentable: true,
        }));
      }, ms);
    });

    try {
      return await Promise.race([promesa, limite]);
    } finally {
      clearTimeout(temporizador);
    }
  }

  /**
   * Elige un elemento al azar del flujo narrativo.
   *
   * Usar el flujo del RNG y no Math.random hace que la narración procedural sea
   * reproducible: misma semilla, misma partida.
   *
   * @template T
   * @param {T[]} lista
   * @returns {T|undefined}
   * @protected
   */
  _elegir(lista) {
    if (!lista?.length) return undefined;
    if (this.rng) return this.rng.flujo('narrativa').elegir(lista);
    return lista[Math.floor(Math.random() * lista.length)];
  }

  /**
   * Elige varios elementos distintos.
   * @template T
   * @param {T[]} lista
   * @param {number} n
   * @returns {T[]}
   * @protected
   */
  _elegirVarios(lista, n) {
    if (!lista?.length) return [];
    if (this.rng) return this.rng.flujo('narrativa').elegirVarios(lista, n);
    return [...lista].sort(() => Math.random() - 0.5).slice(0, n);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     DIAGNÓSTICO
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Estadísticas de la sesión.
   * @returns {Object}
   */
  inspeccionar() {
    return {
      id: this.id,
      nombre: this.nombre,
      autonomo: /** @type {typeof IDMProvider} */ (this.constructor).autonomo,
      listo: this.comprobar().listo,
      fallosSeguidos: this.fallosSeguidos,
      ...this.stats,
      msMedio: this.stats.exitos > 0 ? Math.round(this.stats.msTotal / this.stats.exitos) : 0,
      respaldo: this.respaldo?.id ?? null,
    };
  }
}

export default IDMProvider;
