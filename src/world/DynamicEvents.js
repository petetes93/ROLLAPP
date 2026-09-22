/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · world/DynamicEvents.js
 * ---------------------------------------------------------------------------
 * Eventos dinámicos del mundo.
 *
 * Hace que pasen cosas sin que el jugador las provoque. Evalúa cada tres días
 * si arranca algo nuevo y retira lo caducado.
 *
 * Los efectos se combinan de forma multiplicativa, lo que produce
 * combinaciones que nadie ha programado: una feria durante una buena cosecha
 * deja los precios al 64 %. Ese es el punto — el mundo tiene estados que se
 * superponen, no una lista de casos previstos.
 *
 * Los efectos se cachean porque se consultan muchas veces por turno: cada
 * precio de cada objeto de cada mercader pasa por aquí.
 *
 * Dependencias: SystemBase, events.data, locations.data.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SystemBase } from '../core/SystemBase.js';
import {
  obtenerEvento, candidatos, combinarEfectos, ganchosDe,
} from '../data/events.data.js';
import { obtenerLugar } from '../data/locations.data.js';
import { faccionesDe } from '../data/factions.data.js';

/** Eventos publicados. */
export const EVENTOS_DINAMICOS = Object.freeze({
  INICIADO: 'world:event:started',
  TERMINADO: 'world:event:ended',
});

/** Días entre evaluaciones. */
const DIAS_EVALUACION = 3;

export class DynamicEvents extends SystemBase {
  static nombre = 'events';
  static dependencias = ['clock', 'world'];
  static canal = 'world';

  constructor(contexto) {
    super(contexto);

    /**
     * Eventos activos: refId → {alcance, ambito, hasta, desde}
     * @type {Map<string, Object>}
     * @private
     */
    this._activos = new Map();

    /** Último día en que se evaluó. @private */
    this._ultimaEvaluacion = 0;

    /**
     * Caché de efectos combinados. Se invalida al cambiar los activos o de
     * lugar, porque el ámbito importa.
     * @private
     */
    this._cacheEfectos = null;
    this._claveCache = null;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CICLO DE VIDA
     ═══════════════════════════════════════════════════════════════════════ */

  alIniciar() {
    this.reductores({
      'world/evento': this._reducirEvento,
    });

    this.escuchar('clock:day:new', ({ diasTotales }) => this._alNuevoDia(diasTotales));

    // Cambiar de lugar invalida la caché: los eventos locales dependen de dónde
    // estás.
    this.escuchar('world:arrived', () => this._invalidarCache());
    this.escuchar('world:region:change', () => this._invalidarCache());
  }

  /* ═══════════════════════════════════════════════════════════════════════
     EVALUACIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Cada día se retira lo caducado; cada tres, se evalúa si arranca algo.
   * @param {number} dia
   * @private
   */
  _alNuevoDia(dia) {
    this._retirarCaducados(dia);

    if (dia - this._ultimaEvaluacion < DIAS_EVALUACION) return;

    this._ultimaEvaluacion = dia;
    this._evaluar(dia);
  }

  /**
   * Decide si arranca algún evento nuevo.
   * @param {number} dia
   * @private
   */
  _evaluar(dia) {
    const flujo = this.rng.flujo('mundo');

    // ─── Probabilidades por alcance ─────────────────────────────────────
    // Los globales son raros porque afectan a todo; los locales, frecuentes.
    const probabilidades = { local: 0.35, regional: 0.2, global: 0.06 };

    for (const [alcance, probabilidad] of Object.entries(probabilidades)) {
      // No se acumulan dos del mismo alcance en el mismo ámbito.
      if (this._hayActivoDe(alcance)) continue;

      if (!flujo.oportunidad(probabilidad)) continue;

      this._intentarIniciar(alcance, flujo, dia);
    }
  }

  /**
   * Intenta iniciar un evento de un alcance dado.
   * @private
   */
  _intentarIniciar(alcance, flujo, dia) {
    const refIdLugar = this.leer('world.ubicacion');
    const lugar = obtenerLugar(refIdLugar);
    const region = this.leer('world.region');

    const posibles = candidatos({
      alcance,
      lugar,
      region,
      estacion: this.leer('world.tiempo.estacion'),
      numFacciones: faccionesDe(region).length,
    });

    // Los ya activos no se repiten.
    const disponibles = posibles.filter((e) => !this._activos.has(e.refId));
    if (!disponibles.length) return;

    const evento = flujo.elegirPonderado(disponibles.map((e) => ({ valor: e, peso: e.peso })));
    if (!evento) return;

    // ─── Ámbito ─────────────────────────────────────────────────────────
    // Un evento local ocurre en un lugar; uno regional, en una región.
    const ambito = alcance === 'local' ? refIdLugar
      : alcance === 'regional' ? region
      : null;

    const duracion = flujo.entero(evento.duracion[0], evento.duracion[1]);

    this._iniciar(evento, { ambito, desde: dia, hasta: dia + duracion });
  }

  /**
   * Inicia un evento.
   * @private
   */
  _iniciar(evento, datos) {
    this._activos.set(evento.refId, {
      refId: evento.refId,
      alcance: evento.alcance,
      ambito: datos.ambito,
      desde: datos.desde,
      hasta: datos.hasta,
    });

    this._invalidarCache();
    this._sincronizar();

    this.emitir(EVENTOS_DINAMICOS.INICIADO, {
      refId: evento.refId,
      nombre: evento.nombre,
      alcance: evento.alcance,
      ambito: datos.ambito,
      duracion: datos.hasta - datos.desde,
    });

    // Solo se narra si afecta a donde está el jugador.
    if (this._afectaAquí(this._activos.get(evento.refId))) {
      this.emitir('narrative:direct', { texto: evento.anuncio, voz: 'system' });

      this.emitir('memory:remember', {
        texto: `${evento.nombre}: ${evento.anuncio}`,
        peso: 2,
      });
    }

    this.log.debug(`evento iniciado: ${evento.refId} (${evento.alcance})`);
  }

  /**
   * Retira los eventos cuya duración ha expirado.
   * @param {number} dia
   * @private
   */
  _retirarCaducados(dia) {
    const caducados = [];

    for (const [refId, activo] of this._activos) {
      if (dia >= activo.hasta) caducados.push(refId);
    }

    if (!caducados.length) return;

    for (const refId of caducados) {
      const activo = this._activos.get(refId);
      const evento = obtenerEvento(refId);

      this._activos.delete(refId);

      this.emitir(EVENTOS_DINAMICOS.TERMINADO, { refId, nombre: evento?.nombre });

      // El cierre solo se narra si el jugador está donde ocurría.
      if (evento?.cierre && this._afectaAquí(activo)) {
        this.emitir('narrative:direct', { texto: evento.cierre, voz: 'system' });
      }
    }

    this._invalidarCache();
    this._sincronizar();
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ÁMBITO
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Comprueba si un evento activo afecta al lugar actual.
   *
   * Un evento local solo afecta a su lugar; uno regional, a toda su región; uno
   * global, a todas partes.
   *
   * @param {Object} activo
   * @returns {boolean}
   * @private
   */
  _afectaAquí(activo) {
    if (!activo) return false;
    if (activo.alcance === 'global') return true;

    if (activo.alcance === 'local') {
      return activo.ambito === this.leer('world.ubicacion');
    }

    return activo.ambito === this.leer('world.region');
  }

  /**
   * @param {string} alcance
   * @returns {boolean}
   * @private
   */
  _hayActivoDe(alcance) {
    for (const activo of this._activos.values()) {
      if (activo.alcance !== alcance) continue;

      // Para local y regional, solo cuenta si es del ámbito actual.
      if (alcance === 'global') return true;
      if (this._afectaAquí(activo)) return true;
    }

    return false;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     EFECTOS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Efectos combinados de los eventos que afectan al lugar actual.
   *
   * Se cachea porque se consulta muchas veces por turno: cada precio de cada
   * objeto de cada mercader pasa por aquí.
   *
   * @returns {Object}
   */
  efectos() {
    const clave = this._claveActual();

    if (this._cacheEfectos && this._claveCache === clave) {
      return this._cacheEfectos;
    }

    const relevantes = [...this._activos.values()]
      .filter((a) => this._afectaAquí(a))
      .map((a) => a.refId);

    // Los efectos de la estación se suman a los de los eventos.
    const deEventos = combinarEfectos(relevantes);
    const deEstacion = this.sistema('time')?.efectosEstacion() ?? {};

    const total = { ...deEventos };

    for (const [k, v] of Object.entries(deEstacion)) {
      if (typeof v === 'boolean') {
        total[k] = total[k] || v;
      } else if (typeof total[k] === 'number') {
        total[k] *= v;
      } else {
        total[k] = v;
      }
    }

    this._cacheEfectos = total;
    this._claveCache = clave;

    return total;
  }

  /**
   * Clave de caché: cambia si cambian los activos o el ámbito.
   * @private
   */
  _claveActual() {
    const activos = [...this._activos.keys()].sort().join(',');
    return `${activos}|${this.leer('world.ubicacion')}|${this.leer('world.tiempo.estacion')}`;
  }

  /** @private */
  _invalidarCache() {
    this._cacheEfectos = null;
    this._claveCache = null;
  }

  /**
   * Comprueba si un servicio está cerrado por un evento.
   *
   * @param {string} servicio
   * @returns {boolean}
   */
  servicioCerradoPorEvento(servicio) {
    const cerrados = this.efectos().serviciosCerrados;
    return Array.isArray(cerrados) && cerrados.includes(servicio);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     GANCHOS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Un gancho de los eventos activos, si lo hay.
   *
   * El generador de misiones los prefiere a sus plantillas: un incendio produce
   * «hay alguien atrapado dentro», que tiene más contexto que cualquier encargo
   * genérico.
   *
   * @returns {string|null}
   */
  ganchoDisponible() {
    const relevantes = [...this._activos.values()]
      .filter((a) => this._afectaAquí(a))
      .map((a) => a.refId);

    const ganchos = ganchosDe(relevantes);
    if (!ganchos.length) return null;

    // Los ya usados no se repiten.
    const usados = new Set(this.leer('world.ganchosEventoUsados', []));
    const disponibles = ganchos.filter((g) => !usados.has(g));

    if (!disponibles.length) return null;

    const elegido = this.rng.flujo('narrativa').elegir(disponibles);

    this.store.fijar('world.ganchosEventoUsados', [...usados, elegido]);

    return elegido;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONTROL MANUAL
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Fuerza un evento. Para depuración y para el director.
   *
   * @param {string} refId
   * @param {Object} [opciones]
   * @returns {boolean}
   */
  forzar(refId, opciones = {}) {
    const evento = obtenerEvento(refId);
    if (!evento) return false;

    if (this._activos.has(refId)) return false;

    const dia = this.leer('world.tiempo.diasTotales', 0);
    const flujo = this.rng.flujo('mundo');

    const duracion = opciones.duracion
      ?? flujo.entero(evento.duracion[0], evento.duracion[1]);

    const ambito = evento.alcance === 'local' ? this.leer('world.ubicacion')
      : evento.alcance === 'regional' ? this.leer('world.region')
      : null;

    this._iniciar(evento, { ambito, desde: dia, hasta: dia + duracion });

    return true;
  }

  /**
   * Termina un evento antes de tiempo.
   *
   * Se usa cuando el jugador lo resuelve: apagar el incendio debería terminar
   * el incendio.
   *
   * @param {string} refId
   * @returns {boolean}
   */
  terminar(refId) {
    if (!this._activos.has(refId)) return false;

    const activo = this._activos.get(refId);
    const evento = obtenerEvento(refId);

    this._activos.delete(refId);
    this._invalidarCache();
    this._sincronizar();

    this.emitir(EVENTOS_DINAMICOS.TERMINADO, { refId, nombre: evento?.nombre, resuelto: true });

    if (evento?.cierre && this._afectaAquí(activo)) {
      this.emitir('narrative:direct', { texto: evento.cierre, voz: 'system' });
    }

    return true;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ESTADO
     ═══════════════════════════════════════════════════════════════════════ */

  /** @private */
  _sincronizar() {
    this.despachar('world/evento', {
      activos: [...this._activos.values()],
    });
  }

  /** @private */
  _reducirEvento(estado, accion) {
    return { world: { eventos: accion.payload?.activos ?? [] } };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONSULTAS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Eventos activos que afectan aquí.
   * @returns {Array<Object>}
   */
  activosAqui() {
    return [...this._activos.values()]
      .filter((a) => this._afectaAquí(a))
      .map((a) => {
        const evento = obtenerEvento(a.refId);
        const dia = this.leer('world.tiempo.diasTotales', 0);

        return {
          refId: a.refId,
          nombre: evento?.nombre ?? a.refId,
          alcance: a.alcance,
          diasRestantes: Math.max(0, a.hasta - dia),
          urgente: Boolean(evento?.efectos?.urgente),
        };
      });
  }

  /**
   * @param {string} refId
   * @returns {boolean}
   */
  estaActivo(refId) {
    const activo = this._activos.get(refId);
    return Boolean(activo) && this._afectaAquí(activo);
  }

  /**
   * Contexto de eventos para el director.
   * @returns {string}
   */
  paraDirector() {
    const aqui = this.activosAqui();
    if (!aqui.length) return '';

    const lineas = aqui.map((a) => {
      const evento = obtenerEvento(a.refId);
      return `· ${evento?.nombre}: ${evento?.promptLore}`;
    });

    return `ESTÁ PASANDO:\n${lineas.join('\n')}`;
  }

  /** @returns {Object} */
  serializar() {
    return {
      activos: [...this._activos.entries()],
      ultimaEvaluacion: this._ultimaEvaluacion,
    };
  }

  /** @param {Object} datos */
  restaurar(datos) {
    this._activos = new Map(datos?.activos ?? []);
    this._ultimaEvaluacion = datos?.ultimaEvaluacion ?? 0;
    this._invalidarCache();
  }

  /** @returns {Object} */
  inspeccionar() {
    return {
      activos: [...this._activos.values()],
      aqui: this.activosAqui(),
      efectos: this.efectos(),
    };
  }
}

export default DynamicEvents;
