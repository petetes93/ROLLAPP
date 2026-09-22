/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ai/providers/LocalLLMProvider.js
 * ---------------------------------------------------------------------------
 * Modelo local: Ollama, LM Studio, llama.cpp y compatibles.
 *
 * Habla con un servidor que corre en la máquina del jugador. No hay credencial
 * ni datos que salgan de su equipo, lo que encaja bien con el proyecto: sigue
 * siendo local, solo que el modelo vive en otro proceso.
 *
 * Contempla los dos dialectos habituales:
 *
 *   · OpenAI compatible (`/v1/chat/completions`) — LM Studio, llama.cpp server
 *   · Ollama nativo (`/api/chat`) — Ollama
 *
 * Se detecta cuál por la forma de la URL, y si falla se prueba el otro. Pedirle
 * al jugador que sepa qué dialecto habla su servidor sería una barrera absurda.
 *
 * Dependencias: IDMProvider, PromptBuilder, ResponseParser.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { IDMProvider } from './IDMProvider.js';
import * as Prompt from '../PromptBuilder.js';
import * as Parser from '../ResponseParser.js';
import { PROVEEDORES, MUESTREO, RED } from '../../config/ai.config.js';

/** Dialectos de API reconocidos. */
const DIALECTO = Object.freeze({
  OPENAI: 'openai',
  OLLAMA: 'ollama',
});

export class LocalLLMProvider extends IDMProvider {
  static id = PROVEEDORES.LOCAL;
  static nombre = 'Modelo local';
  static requiereCredencial = false;
  static requiereRed = true;   // Red local, no internet.

  constructor(opciones = {}) {
    super(opciones);

    /** URL base del servidor. @private */
    this._url = opciones.url ?? '';

    /** Nombre del modelo. @private */
    this._modelo = opciones.modelo ?? '';

    /** Dialecto detectado. @private */
    this._dialecto = null;

    /** Historial de conversación, para no reenviar el sistema. @private */
    this._historial = [];
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONFIGURACIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Configura el proveedor.
   *
   * @param {Object} config
   * @param {string} config.url
   * @param {string} [config.modelo]
   */
  configurar(config) {
    this._url = String(config.url ?? '').trim().replace(/\/+$/, '');
    this._modelo = String(config.modelo ?? '').trim();
    this._dialecto = this._detectarDialecto(this._url);
    this._historial = [];
  }

  /**
   * Deduce el dialecto por la forma de la URL.
   * @private
   */
  _detectarDialecto(url) {
    if (/\/api\/chat|11434/.test(url)) return DIALECTO.OLLAMA;
    if (/\/v1|1234|8080/.test(url)) return DIALECTO.OPENAI;

    // Sin pistas, se prueba primero el más extendido.
    return DIALECTO.OPENAI;
  }

  /**
   * Comprueba si está configurado y accesible.
   *
   * @returns {{disponible: boolean, motivo: string|null}}
   */
  comprobar() {
    if (!this._url) {
      return {
        disponible: false,
        motivo: 'Falta la dirección del proxy local. Para Gemini usa http://127.0.0.1:11435.',
      };
    }

    if (!/^https?:\/\//.test(this._url)) {
      return { disponible: false, motivo: 'La dirección debe empezar por http:// o https://' };
    }

    if (!this._modelo) {
      return {
        disponible: false,
        motivo: 'Falta el nombre del modelo. Con el proxy de ARCANVEIL usa gemini-3.5-flash.',
      };
    }

    return { disponible: true, motivo: null };
  }

  /**
   * Prueba la conexión de verdad.
   *
   * @returns {Promise<{ok: boolean, motivo: string|null, modelos: string[]}>}
   */
  async probar() {
    const previo = this.comprobar();
    if (!previo.disponible) return { ok: false, motivo: previo.motivo, modelos: [] };

    try {
      // Se pide la lista de modelos: es la comprobación más barata.
      const rutas = this._dialecto === DIALECTO.OLLAMA
        ? ['/api/tags']
        : ['/v1/models', '/models'];

      for (const ruta of rutas) {
        try {
          const respuesta = await this._peticion(`${this._url}${ruta}`, null, 'GET');

          const modelos = this._dialecto === DIALECTO.OLLAMA
            ? (respuesta.models ?? []).map((m) => m.name)
            : (respuesta.data ?? []).map((m) => m.id);

          return { ok: true, motivo: null, modelos };
        } catch {
          continue;
        }
      }

      return {
        ok: false,
        motivo: 'El servidor responde pero no de la forma esperada. ¿Es la dirección correcta?',
        modelos: [],
      };

    } catch (e) {
      return { ok: false, motivo: this._explicarError(e), modelos: [] };
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     DIRECCIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Dirige un turno consultando al modelo local.
   *
   * @param {Object} peticion
   * @returns {Promise<Object>}
   */
  async dirigir(peticion) {
    const disponible = this.comprobar();

    if (!disponible.disponible) {
      throw new Error(disponible.motivo);
    }

    const mensajes = this._componerMensajes(peticion);
    const muestreo = MUESTREO.perfiles?.[peticion.tipo] ?? MUESTREO.perfiles?.narracion ?? {};

    const cuerpo = this._dialecto === DIALECTO.OLLAMA
      ? {
          model: this._modelo,
          messages: mensajes,
          stream: false,
          format: 'json',
          options: {
            temperature: muestreo.temperatura ?? 0.8,
            top_p: muestreo.topP ?? 0.9,
            num_predict: muestreo.maxTokens ?? 800,
          },
        }
      : {
          model: this._modelo,
          messages: mensajes,
          stream: false,
          temperature: muestreo.temperatura ?? 0.8,
          top_p: muestreo.topP ?? 0.9,
          max_tokens: muestreo.maxTokens ?? 800,
          response_format: { type: 'json_object' },
        };

    const ruta = this._dialecto === DIALECTO.OLLAMA ? '/api/chat' : '/v1/chat/completions';

    let datos;

    try {
      datos = await this._peticion(`${this._url}${ruta}`, cuerpo);
    } catch (e) {
      // Si falló, puede ser el dialecto equivocado: se prueba el otro una vez.
      if (!this._dialectoProbado) {
        this._dialectoProbado = true;
        this._dialecto = this._dialecto === DIALECTO.OLLAMA ? DIALECTO.OPENAI : DIALECTO.OLLAMA;

        this.log?.debug(`cambiando a dialecto ${this._dialecto}`);
        return this.dirigir(peticion);
      }

      throw new Error(this._explicarError(e));
    }

    // ─── Extracción del texto ───────────────────────────────────────────
    const crudo = this._dialecto === DIALECTO.OLLAMA
      ? datos?.message?.content
      : datos?.choices?.[0]?.message?.content;

    if (!crudo) {
      throw new Error('El modelo respondió, pero sin contenido utilizable.');
    }

    // ─── Análisis ───────────────────────────────────────────────────────
    const analisis = Parser.analizar(crudo, { accion: peticion.accion });

    if (!analisis.exito) {
      throw new Error(`No se pudo interpretar la respuesta: ${analisis.error}`);
    }

    // ─── Historial ──────────────────────────────────────────────────────
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
   * Compone la lista de mensajes.
   *
   * El prompt de sistema solo va en el primero: reenviarlo cada turno gastaría
   * contexto sin aportar nada.
   *
   * @private
   */
  _componerMensajes(peticion) {
    const mensajes = [];

    if (!this._historial.length) {
      mensajes.push({ role: 'system', content: Prompt.sistema() });
    } else {
      mensajes.push({ role: 'system', content: Prompt.sistema({ incluirEsquema: false }) });
      mensajes.push(...this._historial);
    }

    mensajes.push({
      role: 'user',
      content: Prompt.turno({ ...peticion, contextoTexto: peticion.prompt }),
    });

    return mensajes;
  }

  /**
   * Guarda el intercambio en el historial, acotado.
   * @private
   */
  _recordar(mensajeUsuario, respuesta) {
    this._historial.push(mensajeUsuario);
    this._historial.push({ role: 'assistant', content: respuesta });

    // Se conservan los últimos intercambios: el contexto largo lo aporta el
    // compositor, no el historial.
    const maximo = 6;
    if (this._historial.length > maximo) {
      this._historial = this._historial.slice(-maximo);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RESUMEN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Pide al modelo que resuma un tramo.
   *
   * @param {Array<Object>} turnos
   * @returns {Promise<string|null>}
   */
  async resumir(turnos) {
    if (!this.comprobar().disponible) return null;

    const cuerpo = this._dialecto === DIALECTO.OLLAMA
      ? {
          model: this._modelo,
          messages: [{ role: 'user', content: Prompt.resumen(turnos) }],
          stream: false,
          options: { temperature: 0.4, num_predict: 300 },
        }
      : {
          model: this._modelo,
          messages: [{ role: 'user', content: Prompt.resumen(turnos) }],
          stream: false,
          temperature: 0.4,
          max_tokens: 300,
        };

    const ruta = this._dialecto === DIALECTO.OLLAMA ? '/api/chat' : '/v1/chat/completions';

    try {
      const datos = await this._peticion(`${this._url}${ruta}`, cuerpo);

      const texto = this._dialecto === DIALECTO.OLLAMA
        ? datos?.message?.content
        : datos?.choices?.[0]?.message?.content;

      return texto?.trim() ?? null;
    } catch {
      // Un resumen fallido no es grave: el motor tiene el suyo mecánico.
      return null;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RED
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Petición HTTP con tiempo de espera.
   *
   * @param {string} url
   * @param {Object|null} cuerpo
   * @param {string} [metodo='POST']
   * @returns {Promise<Object>}
   * @private
   */
  async _peticion(url, cuerpo, metodo = 'POST') {
    const controlador = new AbortController();
    const limite = setTimeout(() => controlador.abort(), RED.timeout ?? 90000);

    try {
      const opciones = {
        method: metodo,
        signal: controlador.signal,
        headers: { 'Content-Type': 'application/json' },
      };

      if (cuerpo) opciones.body = JSON.stringify(cuerpo);

      const respuesta = await fetch(url, opciones);

      if (!respuesta.ok) {
        const texto = await respuesta.text().catch(() => '');
        throw new Error(`HTTP ${respuesta.status}: ${texto.slice(0, 200)}`);
      }

      return await respuesta.json();

    } finally {
      clearTimeout(limite);
    }
  }

  /**
   * Traduce un error de red a algo accionable.
   *
   * «Error de red» no ayuda a nadie; «¿está el servidor arrancado?» sí.
   *
   * @private
   */
  _explicarError(e) {
    const mensaje = String(e?.message ?? e);

    if (e?.name === 'AbortError') {
      return 'El modelo tardó demasiado. Los modelos grandes pueden necesitar más tiempo en equipos modestos.';
    }

    if (/failed to fetch|networkerror|load failed/i.test(mensaje)) {
      return `No se pudo conectar con ${this._url}. Comprueba que el servidor esté arrancado y que la dirección sea correcta.`;
    }

    if (/404/.test(mensaje)) {
      return 'El servidor responde pero la ruta no existe. ¿Es la dirección base correcta, sin la parte final?';
    }

    if (/model.*not found|no such model/i.test(mensaje)) {
      return `El modelo «${this._modelo}» no está en el servidor. Comprueba el nombre exacto.`;
    }

    return mensaje;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONSULTAS
     ═══════════════════════════════════════════════════════════════════════ */

  /** Reinicia el historial de conversación. */
  reiniciar() {
    this._historial = [];
    this._dialectoProbado = false;
  }

  /** @returns {Object} */
  inspeccionar() {
    return {
      id: this.id,
      url: this._url,
      modelo: this._modelo,
      dialecto: this._dialecto,
      historial: this._historial.length,
      disponible: this.comprobar().disponible,
    };
  }
}

export default LocalLLMProvider;
