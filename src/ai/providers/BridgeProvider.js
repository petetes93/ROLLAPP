/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · ai/providers/BridgeProvider.js
 * ---------------------------------------------------------------------------
 * Puente manual.
 *
 * El jugador copia un prompt, lo pega en el chat que prefiera —cualquiera— y
 * trae de vuelta la respuesta. El juego usa un modelo de lenguaje sin
 * credenciales, sin coste y sin que nada salga de su máquina automáticamente.
 *
 * Es el proveedor que mejor encaja con las restricciones del proyecto: no hay
 * red, no hay claves y el jugador ve exactamente qué se envía.
 *
 * Todo el diseño busca reducir la fricción del ciclo copiar-pegar:
 *
 *   · El prompt se copia SOLO al abrirse el panel. Un botón menos.
 *   · La respuesta se detecta al pegar y se aplica sin confirmar. Otro menos.
 *   · El primer prompt lleva las instrucciones completas; los siguientes son
 *     cortos, porque el chat externo ya las tiene.
 *
 * Ese último punto reduce el texto a copiar de unos cuatro mil caracteres a
 * unos ochocientos a partir del segundo turno.
 *
 * Dependencias: IDMProvider, PromptBuilder, ResponseParser.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { IDMProvider } from './IDMProvider.js';
import * as Prompt from '../PromptBuilder.js';
import * as Parser from '../ResponseParser.js';
import { PROVEEDORES } from '../../config/ai.config.js';

export class BridgeProvider extends IDMProvider {
  static id = PROVEEDORES.PUENTE;
  static nombre = 'Puente manual';
  static requiereCredencial = false;
  static requiereRed = false;

  constructor(opciones = {}) {
    super(opciones);

    /** true hasta que se copia el primer prompt de la sesión. @private */
    this._primero = true;

    /**
     * Petición pendiente de respuesta.
     * @type {Object|null}
     * @private
     */
    this._pendiente = null;

    /**
     * Resolución de la promesa que espera la respuesta pegada.
     * @private
     */
    this._resolver = null;
    this._rechazar = null;

    /** Bus para comunicarse con el panel. @private */
    this._bus = opciones.bus ?? null;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     DISPONIBILIDAD
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * El puente siempre está disponible: no necesita nada.
   * @returns {{disponible: boolean, motivo: string|null}}
   */
  comprobar() {
    return { disponible: true, motivo: null };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     DIRECCIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Dirige un turno abriendo el panel del puente.
   *
   * Devuelve una promesa que se resuelve cuando el jugador pega la respuesta,
   * o se rechaza si cancela.
   *
   * @param {Object} peticion
   * @returns {Promise<{respuesta: Object, proveedor: string, avisos: string[]}>}
   */
  async dirigir(peticion) {
    const texto = Prompt.paraPuente(
      { ...peticion, contextoTexto: peticion.prompt },
      this._primero,
    );

    this._pendiente = { peticion, prompt: texto, esPrimero: this._primero };

    // ─── Se abre el panel ───────────────────────────────────────────────
    this._bus?.emitir('bridge:open', {
      prompt: texto,
      primero: this._primero,
      caracteres: texto.length,
      turno: peticion.turno,
    });

    // ─── Se espera la respuesta ─────────────────────────────────────────
    return new Promise((resolver, rechazar) => {
      this._resolver = resolver;
      this._rechazar = rechazar;
    });
  }

  /**
   * Recibe la respuesta pegada por el jugador.
   *
   * @param {string} crudo
   * @returns {{aceptada: boolean, motivo: string|null, nivel: string|null}}
   */
  recibir(crudo) {
    if (!this._pendiente) {
      return { aceptada: false, motivo: 'No hay ninguna petición pendiente.', nivel: null };
    }

    const analisis = Parser.analizar(crudo, {
      accion: this._pendiente.peticion.accion,
    });

    if (!analisis.exito) {
      // No se resuelve la promesa: el jugador puede volver a intentarlo.
      return {
        aceptada: false,
        motivo: Parser.diagnosticar(crudo),
        nivel: analisis.nivel,
      };
    }

    // ─── Aceptada ───────────────────────────────────────────────────────
    // A partir de aquí los prompts son cortos: el chat externo ya tiene las
    // instrucciones en su contexto.
    this._primero = false;

    const resolver = this._resolver;
    this._limpiar();

    resolver?.({
      respuesta: analisis.respuesta,
      proveedor: this.id,
      avisos: analisis.avisos,
      degradado: false,
    });

    this._bus?.emitir('bridge:close', { nivel: analisis.nivel });

    return { aceptada: true, motivo: null, nivel: analisis.nivel };
  }

  /**
   * Cancela la petición pendiente.
   *
   * El turno se resuelve con el turno mínimo en vez de perderse: cancelar no
   * debería costar una jugada.
   */
  cancelar() {
    if (!this._pendiente) return;

    const resolver = this._resolver;
    const peticion = this._pendiente.peticion;

    this._limpiar();

    resolver?.({
      respuesta: this.turnoMinimo(peticion, 'el jugador canceló el puente'),
      proveedor: this.id,
      avisos: ['puente cancelado'],
      degradado: true,
    });

    this._bus?.emitir('bridge:close', { cancelado: true });
  }

  /** @private */
  _limpiar() {
    this._pendiente = null;
    this._resolver = null;
    this._rechazar = null;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RESUMEN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * El puente no resume: exigiría otro ciclo de copiar y pegar solo para
   * condensar la crónica, lo que no compensa. El motor usa su resumen mecánico.
   *
   * @returns {Promise<null>}
   */
  async resumir() {
    return null;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONSULTAS
     ═══════════════════════════════════════════════════════════════════════ */

  /** @returns {boolean} */
  get esperando() {
    return Boolean(this._pendiente);
  }

  /** @returns {string|null} */
  get promptPendiente() {
    return this._pendiente?.prompt ?? null;
  }

  /**
   * Reinicia el estado de sesión.
   *
   * Se llama al empezar una partida nueva: el chat externo también empieza de
   * cero, así que el siguiente prompt debe llevar las instrucciones completas.
   */
  reiniciar() {
    this._primero = true;
    this.cancelar();
  }

  /** @returns {Object} */
  inspeccionar() {
    return {
      id: this.id,
      esperando: this.esperando,
      primerPrompt: this._primero,
      caracteresPendientes: this._pendiente?.prompt?.length ?? 0,
    };
  }
}

export default BridgeProvider;
