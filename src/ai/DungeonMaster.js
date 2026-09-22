/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ai/DungeonMaster.js
 * ---------------------------------------------------------------------------
 * Coordinador de directores.
 *
 * Una fachada única sobre los cuatro proveedores. El resto del motor le pide
 * turnos sin saber ni importarle quién los narra.
 *
 * Su responsabilidad principal es que EL JUEGO NUNCA SE DETENGA:
 *
 *   · Si el proveedor activo falla, se reintenta.
 *   · Si falla varias veces seguidas, se degrada al director interno y se avisa.
 *   · Cuando el proveedor vuelve a estar disponible, se recupera solo.
 *
 * El director interno no puede fallar —no depende de nada— así que siempre hay
 * un suelo bajo el que el juego no cae. Una partida que se cuelga porque una
 * API no responde es una partida perdida.
 *
 * La recuperación automática importa tanto como la degradación: sin ella, un
 * fallo temporal de red condena el resto de la sesión al director interno.
 *
 * Dependencias: SystemBase, providers, ai.config.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SystemBase } from '../core/SystemBase.js';
import * as Proveedores from './providers/index.js';
import { PROVEEDORES, RED } from '../config/ai.config.js';

/** Eventos publicados. */
export const EVENTOS_DIRECTOR = Object.freeze({
  CAMBIO: 'dm:provider:change',
  DEGRADADO: 'dm:degraded',
  RECUPERADO: 'dm:recovered',
  FALLO: 'dm:failure',
});

export class DungeonMaster extends SystemBase {
  static nombre = 'dungeonmaster';
  static dependencias = [];
  static canal = 'ia';

  constructor(contexto) {
    super(contexto);

    /** Proveedores instanciados. @private */
    this._proveedores = new Map();

    /** Identificador del proveedor elegido por el jugador. @private */
    this._elegido = PROVEEDORES.PROCEDURAL;

    /** Identificador del que se está usando ahora. @private */
    this._activo = PROVEEDORES.PROCEDURAL;

    /** Fallos consecutivos del elegido. @private */
    this._fallos = 0;

    /** true si se degradó automáticamente. @private */
    this._degradado = false;

    /** Turno en que se degradó, para reintentar más tarde. @private */
    this._turnoDegradacion = 0;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CICLO DE VIDA
     ═══════════════════════════════════════════════════════════════════════ */

  alIniciar() {
    this._proveedores = Proveedores.crearTodos({
      rng: this.rng,
      bus: this.bus,
      log: this.log,
    });

    // El cambio de proveedor llega desde Ajustes.
    this.escuchar('settings:change', ({ id, valor }) => {
      if (id === 'proveedor') this.cambiar(valor);
      if (id === 'proveedorConfig') this._configurar(valor);
    });

    // El panel del puente devuelve la respuesta pegada por aquí.
    this.escuchar('bridge:submit', ({ texto }) => {
      const puente = this._proveedores.get(PROVEEDORES.PUENTE);
      return puente?.recibir(texto);
    });

    this.escuchar('bridge:cancel', () => {
      this._proveedores.get(PROVEEDORES.PUENTE)?.cancelar();
    });

    // Al introducir una credencial se intenta recuperar el proveedor remoto.
    this.escuchar('ai:credential:set', () => this._intentarRecuperar());
  }

  alArrancar() {
    const guardado = this.leer('settings.proveedor', PROVEEDORES.PROCEDURAL);
    this.cambiar(guardado, { silencioso: true });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SELECCIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Cambia el proveedor activo.
   *
   * @param {string} id
   * @param {Object} [opciones]
   * @returns {{exito: boolean, motivo: string|null}}
   */
  cambiar(id, opciones = {}) {
    if (!this._proveedores.has(id)) {
      return { exito: false, motivo: 'Ese director no existe.' };
    }

    const proveedor = this._proveedores.get(id);
    const disponible = proveedor.comprobar();

    this._elegido = id;
    this._fallos = 0;
    this._degradado = false;

    // ─── No disponible: se elige igual, pero se usa el interno ──────────
    // Elegir un proveedor sin configurar no debería fallar: se acepta la
    // elección y se avisa de qué falta.
    if (!disponible.disponible) {
      this._activo = PROVEEDORES.PROCEDURAL;

      if (!opciones.silencioso) {
        this.emitir('ui:notice', {
          mensaje: disponible.motivo,
          tipo: 'aviso',
        });
      }

      return { exito: true, motivo: disponible.motivo };
    }

    this._activo = id;

    if (!opciones.silencioso) {
      this.emitir(EVENTOS_DIRECTOR.CAMBIO, {
        id,
        nombre: Proveedores.obtener(id)?.nombre,
      });

      this.emitir('ui:notice', {
        mensaje: `Director: ${Proveedores.obtener(id)?.nombre}`,
        tipo: 'info',
      });
    }

    this.log.info(`director activo: ${id}`);

    return { exito: true, motivo: null };
  }

  /**
   * Configura el proveedor elegido.
   * @param {Object} config
   * @private
   */
  _configurar(config) {
    const proveedor = this._proveedores.get(this._elegido);

    if (typeof proveedor?.configurar === 'function') {
      proveedor.configurar(config);

      // Reconfigurar puede haberlo hecho disponible.
      this._intentarRecuperar();
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     DIRECCIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Dirige un turno.
   *
   * Nunca lanza: si todo falla, devuelve el turno mínimo. El bucle de juego
   * debe poder confiar en que esto siempre responde.
   *
   * @param {Object} peticion
   * @returns {Promise<Object>}
   */
  async dirigir(peticion) {
    // ─── ¿Toca reintentar el elegido? ───────────────────────────────────
    if (this._degradado) this._evaluarRecuperacion(peticion.turno);

    const proveedor = this._proveedores.get(this._activo)
      ?? this._proveedores.get(PROVEEDORES.PROCEDURAL);

    try {
      const resultado = await proveedor.dirigir(peticion);

      // Éxito: se reinician los fallos.
      if (this._activo === this._elegido) this._fallos = 0;

      return resultado;

    } catch (e) {
      return this._alFallar(e, peticion);
    }
  }

  /**
   * Gestiona un fallo del proveedor activo.
   *
   * @param {Error} error
   * @param {Object} peticion
   * @returns {Promise<Object>}
   * @private
   */
  async _alFallar(error, peticion) {
    this._fallos++;

    this.log.aviso(`fallo del director ${this._activo} (${this._fallos}): ${error?.message}`);

    this.emitir(EVENTOS_DIRECTOR.FALLO, {
      proveedor: this._activo,
      motivo: error?.message,
      consecutivos: this._fallos,
    });

    // ─── Degradación ────────────────────────────────────────────────────
    if (this._fallos >= RED.fallosParaRespaldo && !this._degradado) {
      this._degradar(error);
    }

    // ─── Respaldo ───────────────────────────────────────────────────────
    // Se intenta el interno, que no puede fallar.
    const interno = this._proveedores.get(PROVEEDORES.PROCEDURAL);

    try {
      const resultado = await interno.dirigir(peticion);

      return {
        ...resultado,
        degradado: true,
        avisos: [...(resultado.avisos ?? []), `el director externo falló: ${error?.message}`],
      };

    } catch (e2) {
      // Si hasta el interno falla, algo va muy mal. El turno mínimo es el
      // último recurso y no depende de nada.
      this.log.error('el director interno también falló', e2);

      return {
        respuesta: interno.turnoMinimo(peticion, 'todos los directores fallaron'),
        proveedor: 'minimo',
        avisos: ['no hay ningún director disponible'],
        degradado: true,
      };
    }
  }

  /**
   * Degrada al director interno.
   * @param {Error} error
   * @private
   */
  _degradar(error) {
    this._degradado = true;
    this._activo = PROVEEDORES.PROCEDURAL;
    this._turnoDegradacion = this.leer('meta.turno', 0);

    const nombre = Proveedores.obtener(this._elegido)?.nombre ?? this._elegido;

    this.emitir(EVENTOS_DIRECTOR.DEGRADADO, {
      desde: this._elegido,
      motivo: error?.message,
    });

    // Se avisa una sola vez, no en cada turno.
    this.emitir('ui:notice', {
      mensaje: `${nombre} no responde. Continúa el director interno.`,
      tipo: 'aviso',
    });

    this.log.aviso(`degradado a director interno desde ${this._elegido}`);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RECUPERACIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Evalúa si toca reintentar el proveedor elegido.
   *
   * Se reintenta cada cierto número de turnos, no en cada uno: reintentar
   * constantemente una API caída solo alarga cada turno con un tiempo de
   * espera inútil.
   *
   * @param {number} turno
   * @private
   */
  _evaluarRecuperacion(turno) {
    const espera = 10;

    if (turno - this._turnoDegradacion < espera) return;

    this._intentarRecuperar();
  }

  /**
   * Intenta volver al proveedor elegido.
   *
   * @returns {boolean} true si se recuperó.
   */
  _intentarRecuperar() {
    if (!this._degradado) return false;
    if (this._elegido === PROVEEDORES.PROCEDURAL) return false;

    const proveedor = this._proveedores.get(this._elegido);
    const disponible = proveedor?.comprobar();

    if (!disponible?.disponible) {
      // Sigue sin estar listo: se pospone el siguiente intento.
      this._turnoDegradacion = this.leer('meta.turno', 0);
      return false;
    }

    // ─── Recuperado ─────────────────────────────────────────────────────
    this._degradado = false;
    this._activo = this._elegido;
    this._fallos = 0;

    // El historial de conversación puede estar desincronizado tras la caída.
    proveedor.reiniciar?.();

    const nombre = Proveedores.obtener(this._elegido)?.nombre;

    this.emitir(EVENTOS_DIRECTOR.RECUPERADO, { proveedor: this._elegido });

    this.emitir('ui:notice', {
      mensaje: `${nombre} vuelve a estar disponible.`,
      tipo: 'exito',
    });

    this.log.info(`recuperado el director ${this._elegido}`);

    return true;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RESUMEN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Pide un resumen del tramo.
   *
   * Devuelve null si el proveedor no puede: el motor tiene su resumen mecánico
   * de respaldo.
   *
   * @param {Array<Object>} turnos
   * @returns {Promise<string|null>}
   */
  async resumir(turnos) {
    const proveedor = this._proveedores.get(this._activo);

    try {
      return await proveedor?.resumir?.(turnos) ?? null;
    } catch (e) {
      this.log.debug('el resumen del director falló', e);
      return null;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     DELEGACIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Turno mínimo, delegado al proveedor interno.
   *
   * @param {Object} peticion
   * @param {string} motivo
   * @returns {Object}
   */
  turnoMinimo(peticion, motivo) {
    const interno = this._proveedores.get(PROVEEDORES.PROCEDURAL);
    return interno.turnoMinimo(peticion, motivo);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONSULTAS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Identificador del proveedor activo.
   *
   * No se llama `id` ni `nombre` a secas: `nombre` es propiedad del sistema en
   * SystemBase y definirla como getter impide que la clase base la asigne.
   *
   * @returns {string}
   */
  get proveedorId() {
    return this._activo;
  }

  /** @returns {string} */
  get proveedorNombre() {
    return Proveedores.obtener(this._activo)?.nombre ?? this._activo;
  }

  /** @returns {boolean} */
  get degradado() {
    return this._degradado;
  }

  /**
   * Proveedor activo, por si alguien necesita hablarle directamente.
   * @returns {Object|null}
   */
  proveedorActivo() {
    return this._proveedores.get(this._activo) ?? null;
  }

  /**
   * Un proveedor concreto por su identificador.
   * @param {string} id
   * @returns {Object|null}
   */
  proveedor(id) {
    return this._proveedores.get(id) ?? null;
  }

  /**
   * Catálogo para la pantalla de ajustes.
   * @returns {Array<Object>}
   */
  catalogo() {
    return Proveedores.paraInterfaz({
      proveedor: this._elegido,
      urlLocal: this.leer('settings.urlLocal'),
      modeloLocal: this.leer('settings.modeloLocal'),
    });
  }

  /**
   * Reinicia todos los proveedores.
   *
   * Se llama al empezar una partida nueva: los historiales de conversación de
   * la anterior no tienen sentido.
   */
  reiniciar() {
    for (const proveedor of this._proveedores.values()) {
      proveedor.reiniciar?.();
    }

    this._fallos = 0;
    this._degradado = false;
    this._activo = this._elegido;
  }

  /** @returns {Object} */
  inspeccionar() {
    return {
      elegido: this._elegido,
      activo: this._activo,
      degradado: this._degradado,
      fallos: this._fallos,
      disponibles: [...this._proveedores.entries()].map(([id, p]) => ({
        id,
        disponible: p.comprobar().disponible,
        motivo: p.comprobar().motivo,
      })),
    };
  }
}

export default DungeonMaster;
