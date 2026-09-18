/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · ai/providers/RemoteAPIProvider.js
 * ---------------------------------------------------------------------------
 * API remota: Anthropic, OpenAI y compatibles.
 *
 * El único proveedor que envía datos fuera del equipo del jugador, y por eso
 * el que más cuidado exige.
 *
 * REGLA INNEGOCIABLE SOBRE LA CREDENCIAL:
 *
 *   · Vive en una variable de módulo, fuera del árbol de estado.
 *   · NUNCA se escribe en localStorage, sessionStorage ni cookies.
 *   · No aparece en el guardado porque no está en el estado.
 *   · Muere al recargar la página. El jugador la reintroduce.
 *   · Caduca por inactividad, por si deja el navegador abierto.
 *
 * Que muera al recargar es incómodo a propósito. La alternativa —guardarla— es
 * cómoda hasta el día en que alguien comparte su archivo de guardado.
 *
 * Dependencias: IDMProvider, PromptBuilder, ResponseParser.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { IDMProvider } from './IDMProvider.js';
import * as Prompt from '../PromptBuilder.js';
import * as Parser from '../ResponseParser.js';
import { PROVEEDORES, MUESTREO, RED, CREDENCIALES } from '../../config/ai.config.js';

/* ═══════════════════════════════════════════════════════════════════════════
   ALMACÉN DE CREDENCIAL
   ---------------------------------------------------------------------------
   Fuera de la clase y fuera del estado. Es una variable de módulo y punto.
   ═══════════════════════════════════════════════════════════════════════════ */

/** @type {string|null} */
let _credencial = null;

/** Momento del último uso, para caducar por inactividad. */
let _ultimoUso = 0;

/**
 * Guarda la credencial en memoria.
 *
 * @param {string} valor
 * @returns {{aceptada: boolean, motivo: string|null}}
 */
export function fijarCredencial(valor) {
  const limpia = String(valor ?? '').trim();

  if (!limpia) {
    _credencial = null;
    return { aceptada: false, motivo: 'La clave está vacía.' };
  }

  // Comprobación de forma, no de validez: descarta pegados accidentales.
  if (limpia.length < 20) {
    return { aceptada: false, motivo: 'Esa clave es demasiado corta. ¿Se copió entera?' };
  }

  if (/\s/.test(limpia)) {
    return { aceptada: false, motivo: 'La clave contiene espacios. Revisa lo que has pegado.' };
  }

  _credencial = limpia;
  _ultimoUso = Date.now();

  return { aceptada: true, motivo: null };
}

/**
 * Retira la credencial de memoria.
 */
export function olvidarCredencial() {
  _credencial = null;
  _ultimoUso = 0;
}

/**
 * Comprueba si hay credencial vigente.
 *
 * @returns {boolean}
 */
export function hayCredencial() {
  if (!_credencial) return false;

  // Caducidad por inactividad: si el jugador dejó el navegador abierto toda la
  // noche, la clave ya no está.
  const limite = CREDENCIALES?.caducidadMs ?? 3_600_000;

  if (Date.now() - _ultimoUso > limite) {
    olvidarCredencial();
    return false;
  }

  return true;
}

/**
 * Obtiene la credencial y refresca su marca de uso.
 * @returns {string|null}
 * @private
 */
function _usarCredencial() {
  if (!hayCredencial()) return null;

  _ultimoUso = Date.now();
  return _credencial;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PERFILES DE API
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Configuración de cada servicio compatible.
 *
 * Aislar las diferencias aquí permite añadir un servicio nuevo sin tocar la
 * lógica del proveedor.
 */
export const SERVICIOS = Object.freeze({
  anthropic: {
    nombre: 'Anthropic',
    url: 'https://api.anthropic.com/v1/messages',
    modeloDefecto: 'claude-sonnet-4-5',
    cabeceras: (clave) => ({
      'Content-Type': 'application/json',
      'x-api-key': clave,
      'anthropic-version': '2023-06-01',
    }),
    cuerpo: (modelo, sistema, mensajes, muestreo) => ({
      model: modelo,
      system: sistema,
      messages: mensajes,
      max_tokens: muestreo.maxTokens ?? 1600,
      temperature: muestreo.temperatura ?? 0.85,
    }),
    extraer: (datos) => datos?.content?.[0]?.text,
  },

  openai: {
    nombre: 'OpenAI',
    url: 'https://api.openai.com/v1/chat/completions',
    modeloDefecto: 'gpt-4o-mini',
    cabeceras: (clave) => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clave}`,
    }),
    cuerpo: (modelo, sistema, mensajes, muestreo) => ({
      model: modelo,
      messages: [{ role: 'system', content: sistema }, ...mensajes],
      max_tokens: muestreo.maxTokens ?? 1600,
      temperature: muestreo.temperatura ?? 0.85,
      response_format: { type: 'json_object' },
    }),
    extraer: (datos) => datos?.choices?.[0]?.message?.content,
  },
});

export class RemoteAPIProvider extends IDMProvider {
  static id = PROVEEDORES.REMOTO;
  static nombre = 'API remota';
  static requiereCredencial = true;
  static requiereRed = true;

  constructor(opciones = {}) {
    super(opciones);

    /** Servicio elegido. @private */
    this._servicio = opciones.servicio ?? 'anthropic';

    /** Modelo. @private */
    this._modelo = opciones.modelo ?? null;

    /** Historial de conversación. @private */
    this._historial = [];

    /** Fallos consecutivos. @private */
    this._fallos = 0;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONFIGURACIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * @param {Object} config
   */
  configurar(config) {
    if (config.servicio && SERVICIOS[config.servicio]) {
      this._servicio = config.servicio;
    }

    if (config.modelo) this._modelo = String(config.modelo).trim();

    if (config.credencial !== undefined) {
      fijarCredencial(config.credencial);
    }

    this._historial = [];
    this._fallos = 0;
  }

  /** @returns {Object} */
  get perfil() {
    return SERVICIOS[this._servicio] ?? SERVICIOS.anthropic;
  }

  /**
   * @returns {{disponible: boolean, motivo: string|null}}
   */
  comprobar() {
    if (!hayCredencial()) {
      return {
        disponible: false,
        motivo: 'Falta la clave de API. No se guarda: hay que introducirla cada vez que se abre el juego.',
      };
    }

    return { disponible: true, motivo: null };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     DIRECCIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Dirige un turno consultando la API.
   *
   * @param {Object} peticion
   * @returns {Promise<Object>}
   */
  async dirigir(peticion) {
    const clave = _usarCredencial();

    if (!clave) {
      throw new Error('No hay clave de API. Introdúcela en Ajustes.');
    }

    const perfil = this.perfil;
    const modelo = this._modelo ?? perfil.modeloDefecto;

    const muestreo = {
      ...MUESTREO,
      ...(MUESTREO.perfiles?.[peticion.tipo] ?? {}),
    };

    const mensajes = this._componerMensajes(peticion);

    const cuerpo = perfil.cuerpo(
      modelo,
      Prompt.sistema(),
      mensajes,
      muestreo,
    );

    // ─── Petición con reintentos ────────────────────────────────────────
    const datos = await this._conReintentos(perfil, clave, cuerpo);

    const crudo = perfil.extraer(datos);

    if (!crudo) {
      this._fallos++;
      throw new Error('La API respondió sin contenido.');
    }

    // ─── Análisis ───────────────────────────────────────────────────────
    const analisis = Parser.analizar(crudo, { accion: peticion.accion });

    if (!analisis.exito) {
      this._fallos++;
      throw new Error(`No se pudo interpretar la respuesta: ${analisis.error}`);
    }

    this._fallos = 0;
    this._recordar(mensajes.at(-1), crudo);

    return {
      respuesta: analisis.respuesta,
      proveedor: this.id,
      avisos: analisis.avisos,
      degradado: false,
      nivel: analisis.nivel,
    };
  }

  /**
   * Ejecuta la petición con reintentos y espera creciente.
   *
   * Los errores del cliente (clave mal, modelo inexistente) no se reintentan:
   * reintentar una clave inválida tres veces solo alarga el fallo.
   *
   * @private
   */
  async _conReintentos(perfil, clave, cuerpo) {
    let ultimoError = null;

    for (let intento = 0; intento <= RED.reintentos; intento++) {
      try {
        return await this._peticion(perfil, clave, cuerpo);
      } catch (e) {
        ultimoError = e;

        // Los errores del cliente no mejoran reintentando.
        if (e.codigoHTTP && RED.sinReintento.includes(e.codigoHTTP)) throw e;

        if (intento < RED.reintentos) {
          const espera = RED.esperaBase * Math.pow(RED.factorEspera, intento);
          await new Promise((r) => setTimeout(r, espera));
        }
      }
    }

    this._fallos++;
    throw ultimoError;
  }

  /**
   * Petición HTTP.
   * @private
   */
  async _peticion(perfil, clave, cuerpo) {
    const controlador = new AbortController();
    const limite = setTimeout(() => controlador.abort(), RED.timeout);

    try {
      const respuesta = await fetch(perfil.url, {
        method: 'POST',
        signal: controlador.signal,
        headers: perfil.cabeceras(clave),
        body: JSON.stringify(cuerpo),
      });

      if (!respuesta.ok) {
        const texto = await respuesta.text().catch(() => '');

        const error = new Error(this._explicarHTTP(respuesta.status, texto));
        error.codigoHTTP = respuesta.status;

        // Una clave rechazada se olvida: no sirve de nada conservarla.
        if (respuesta.status === 401 || respuesta.status === 403) {
          olvidarCredencial();
        }

        throw error;
      }

      return await respuesta.json();

    } catch (e) {
      if (e.name === 'AbortError') {
        const error = new Error('La API tardó demasiado en responder.');
        error.codigoHTTP = null;
        throw error;
      }
      throw e;

    } finally {
      clearTimeout(limite);
    }
  }

  /**
   * Traduce un código HTTP a algo que el jugador pueda accionar.
   * @private
   */
  _explicarHTTP(codigo, texto) {
    switch (codigo) {
      case 401:
        return 'La clave de API no es válida. Compruébala y vuelve a introducirla.';
      case 403:
        return 'La clave no tiene permiso para este modelo.';
      case 404:
        return `El modelo «${this._modelo ?? this.perfil.modeloDefecto}» no existe o no está disponible.`;
      case 429:
        return 'Has superado el límite de peticiones. Espera un momento antes de seguir.';
      case 400: {
        // El detalle del 400 suele decir qué campo falla.
        const detalle = texto.slice(0, 150);
        return `La petición fue rechazada: ${detalle}`;
      }
      case 500:
      case 502:
      case 503:
        return 'El servicio está teniendo problemas. Inténtalo en un momento.';
      default:
        return `Error ${codigo} del servicio.`;
    }
  }

  /** @private */
  _componerMensajes(peticion) {
    const mensajes = [...this._historial];

    mensajes.push({
      role: 'user',
      content: Prompt.turno({ ...peticion, contextoTexto: peticion.prompt }),
    });

    return mensajes;
  }

  /** @private */
  _recordar(mensajeUsuario, respuesta) {
    this._historial.push(mensajeUsuario);
    this._historial.push({ role: 'assistant', content: respuesta });

    if (this._historial.length > 6) {
      this._historial = this._historial.slice(-6);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RESUMEN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * @param {Array<Object>} turnos
   * @returns {Promise<string|null>}
   */
  async resumir(turnos) {
    const clave = _usarCredencial();
    if (!clave) return null;

    const perfil = this.perfil;

    const cuerpo = perfil.cuerpo(
      this._modelo ?? perfil.modeloDefecto,
      'Eres un asistente que resume crónicas de juego con precisión y brevedad.',
      [{ role: 'user', content: Prompt.resumen(turnos) }],
      { maxTokens: 400, temperatura: 0.4 },
    );

    try {
      const datos = await this._peticion(perfil, clave, cuerpo);
      return perfil.extraer(datos)?.trim() ?? null;
    } catch {
      return null;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONSULTAS
     ═══════════════════════════════════════════════════════════════════════ */

  /** Reinicia el historial. */
  reiniciar() {
    this._historial = [];
    this._fallos = 0;
  }

  /** @returns {number} */
  get fallosConsecutivos() {
    return this._fallos;
  }

  /**
   * Estado del proveedor. La credencial NO aparece, ni truncada.
   * @returns {Object}
   */
  inspeccionar() {
    return {
      id: this.id,
      servicio: this._servicio,
      modelo: this._modelo ?? this.perfil.modeloDefecto,
      credencialPresente: hayCredencial(),
      credencialPersistida: false,   // Nunca. Por diseño.
      historial: this._historial.length,
      fallos: this._fallos,
    };
  }
}

export default RemoteAPIProvider;
