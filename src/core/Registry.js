/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · core/Registry.js
 * ---------------------------------------------------------------------------
 * Registro y orquestación del ciclo de vida de los sistemas.
 *
 * Resuelve el orden de arranque por dependencias declaradas (ordenación
 * topológica) y detecta ciclos. El arranque ocurre en dos fases:
 *
 *   1. iniciar()  — cada sistema registra sus reductores y oyentes, en orden
 *                   de dependencia. Aquí NO debe hablar con otros sistemas.
 *   2. arrancar() — todos existen ya; ahora sí pueden consultarse entre sí.
 *
 * Esa separación elimina de raíz el problema del huevo y la gallina entre
 * sistemas que se necesitan mutuamente.
 *
 * Dependencias: Logger, Errors.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { crearCanal } from './Logger.js';
import { ErrorNucleo, CODIGO, registrar } from './Errors.js';

const log = crearCanal('core');

export class Registry {
  /**
   * @param {Object} contexto
   * @param {import('./Store.js').Store} contexto.store
   * @param {import('./EventBus.js').EventBus} contexto.bus
   * @param {import('./RNG.js').GestorRNG} contexto.rng
   */
  constructor(contexto) {
    /** @private */
    this._contexto = { ...contexto, registry: this };

    /** @type {Map<string, import('./SystemBase.js').SystemBase>} @private */
    this._sistemas = new Map();

    /** @type {Map<string, typeof import('./SystemBase.js').SystemBase>} @private */
    this._clases = new Map();

    /** Orden de arranque ya resuelto. @type {string[]} @private */
    this._orden = [];

    /** @private */
    this._arrancado = false;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     REGISTRO
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Registra una clase de sistema. No la instancia todavía: eso ocurre en
   * iniciar(), cuando ya se conoce el orden correcto.
   *
   * @param {typeof import('./SystemBase.js').SystemBase} Clase
   * @returns {Registry} this, para encadenar.
   * @throws {ErrorNucleo} Si el nombre está duplicado o ausente.
   */
  registrar(Clase) {
    const nombre = Clase.nombre;

    if (!nombre || nombre === 'sistema-sin-nombre') {
      throw new ErrorNucleo('Un sistema debe declarar una propiedad estática "nombre"', {
        code: CODIGO.SISTEMA_DUPLICADO,
        contexto: { clase: Clase?.name },
      });
    }

    if (this._clases.has(nombre)) {
      throw new ErrorNucleo(`Sistema duplicado: "${nombre}"`, {
        code: CODIGO.SISTEMA_DUPLICADO,
        contexto: { nombre },
      });
    }

    this._clases.set(nombre, Clase);
    log.traza(`+ sistema registrado: ${nombre}`);
    return this;
  }

  /**
   * Registra varias clases de golpe.
   * @param {Array<typeof import('./SystemBase.js').SystemBase>} clases
   * @returns {Registry}
   */
  registrarTodos(clases) {
    for (const C of clases) this.registrar(C);
    return this;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     RESOLUCIÓN DE ORDEN
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Ordena los sistemas topológicamente según sus dependencias.
   *
   * @returns {string[]} Nombres en orden de arranque.
   * @throws {ErrorNucleo} Si hay un ciclo o falta una dependencia.
   * @private
   */
  _resolverOrden() {
    /** @type {string[]} */
    const orden = [];
    /** @type {Set<string>} */
    const visitados = new Set();
    /** @type {Set<string>} */
    const enProceso = new Set();

    /**
     * @param {string} nombre
     * @param {string[]} camino Ruta seguida, para poder describir el ciclo.
     */
    const visitar = (nombre, camino) => {
      if (visitados.has(nombre)) return;

      if (enProceso.has(nombre)) {
        throw new ErrorNucleo(
          `Dependencia cíclica entre sistemas: ${[...camino, nombre].join(' → ')}`,
          { code: CODIGO.DEPENDENCIA_CICLICA, contexto: { ciclo: [...camino, nombre] } },
        );
      }

      const Clase = this._clases.get(nombre);
      if (!Clase) {
        throw new ErrorNucleo(
          `Sistema "${nombre}" requerido por "${camino[camino.length - 1] ?? '(raíz)'}" pero no registrado`,
          { code: CODIGO.SISTEMA_AUSENTE, contexto: { falta: nombre, camino } },
        );
      }

      enProceso.add(nombre);
      for (const dep of Clase.dependencias ?? []) visitar(dep, [...camino, nombre]);
      enProceso.delete(nombre);

      visitados.add(nombre);
      orden.push(nombre);
    };

    for (const nombre of this._clases.keys()) visitar(nombre, []);
    return orden;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     CICLO DE VIDA
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Instancia e inicia todos los sistemas en orden de dependencia, y después
   * los arranca a todos.
   *
   * @returns {Promise<void>}
   * @throws {ErrorNucleo} Si un sistema falla al iniciarse.
   */
  async iniciar() {
    if (this._arrancado) {
      log.aviso('El registro ya estaba arrancado; se ignora la llamada');
      return;
    }

    const fin = log.cronometro('arranque de sistemas');
    this._orden = this._resolverOrden();
    log.info(`Orden de arranque: ${this._orden.join(' → ')}`);

    // — Fase 1: instanciar e iniciar —
    for (const nombre of this._orden) {
      const Clase = this._clases.get(nombre);
      let instancia;
      try {
        instancia = new Clase(this._contexto);
      } catch (e) {
        throw new ErrorNucleo(`No se pudo construir el sistema "${nombre}"`, {
          code: CODIGO.SISTEMA_AUSENTE,
          causa: e instanceof Error ? e : undefined,
          contexto: { nombre },
        });
      }

      this._sistemas.set(nombre, instancia);
      await instancia.iniciar();
    }

    // — Fase 2: arrancar, ya con todos disponibles —
    for (const nombre of this._orden) {
      await this._sistemas.get(nombre).arrancar();
    }

    this._arrancado = true;
    fin();
    log.info(`${this._sistemas.size} sistemas en marcha`);
  }

  /**
   * Detiene todos los sistemas en orden inverso al de arranque, de modo que
   * ninguno se apoye en otro ya apagado.
   * @returns {Promise<void>}
   */
  async detener() {
    if (!this._arrancado) return;

    for (let i = this._orden.length - 1; i >= 0; i--) {
      const sistema = this._sistemas.get(this._orden[i]);
      if (sistema) {
        try {
          await sistema.detener();
        } catch (e) {
          registrar(e, 'core');
        }
      }
    }

    this._sistemas.clear();
    this._arrancado = false;
    log.info('Todos los sistemas detenidos');
  }

  /**
   * Reinicia el conjunto: detiene todo y vuelve a arrancar con las mismas
   * clases registradas. Es lo que ocurre al abandonar una partida y empezar
   * otra sin recargar la página.
   * @returns {Promise<void>}
   */
  async reiniciar() {
    await this.detener();
    await this.iniciar();
  }

  /* ─────────────────────────────────────────────────────────────────────────
     ACCESO
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Obtiene un sistema por su nombre.
   * @param {string} nombre
   * @returns {import('./SystemBase.js').SystemBase|undefined}
   */
  obtener(nombre) {
    return this._sistemas.get(nombre);
  }

  /**
   * Obtiene un sistema o lanza si no existe. Para dependencias declaradas,
   * donde la ausencia es un error de programación.
   * @param {string} nombre
   * @returns {import('./SystemBase.js').SystemBase}
   * @throws {ErrorNucleo}
   */
  exigir(nombre) {
    const s = this._sistemas.get(nombre);
    if (!s) {
      throw new ErrorNucleo(`Sistema "${nombre}" no disponible`, {
        code: CODIGO.SISTEMA_AUSENTE,
        contexto: { nombre, disponibles: [...this._sistemas.keys()] },
      });
    }
    return s;
  }

  /**
   * @param {string} nombre
   * @returns {boolean}
   */
  tiene(nombre) {
    return this._sistemas.has(nombre);
  }

  /**
   * Ejecuta el gancho alTurno() de todos los sistemas que lo implementen.
   * Lo invoca Clock en cada turno de juego, en orden de dependencia.
   *
   * @param {Object} contextoTurno
   * @returns {Promise<void>}
   */
  async turno(contextoTurno) {
    for (const nombre of this._orden) {
      const sistema = this._sistemas.get(nombre);
      if (!sistema || !sistema.iniciado) continue;
      try {
        await sistema.alTurno(contextoTurno);
      } catch (e) {
        registrar(e, nombre);
      }
    }
  }

  /** Nombres de todos los sistemas activos, en orden de arranque. */
  get nombres() {
    return this._orden.slice();
  }

  /** Radiografía del registro. */
  inspeccionar() {
    return {
      arrancado: this._arrancado,
      total: this._sistemas.size,
      orden: this._orden.slice(),
      dependencias: Object.fromEntries(
        [...this._clases.entries()].map(([n, C]) => [n, C.dependencias ?? []]),
      ),
    };
  }
}

export default Registry;
