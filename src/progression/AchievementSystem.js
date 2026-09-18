/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · progression/AchievementSystem.js
 * ---------------------------------------------------------------------------
 * Detección y desbloqueo de hazañas.
 *
 * El problema técnico es cuándo comprobar. Evaluar treinta condiciones en cada
 * turno es barato, pero evaluarlas en cada evento del motor no lo es. Y hay
 * hazañas que solo pueden detectarse en el instante exacto —ganar con un punto
 * de vida— porque un turno después la información ya no está.
 *
 * La solución es doble:
 *
 *   · EVALUACIÓN PERIÓDICA para las de acumulación. Cada pocos turnos basta.
 *   · EVALUACIÓN DISPARADA para las de momento. Ciertos eventos fuerzan una
 *     comprobación inmediata.
 *
 * Sobre la presentación: una hazaña se anuncia UNA VEZ y sin interrumpir. Un
 * aviso modal que corta la narración para felicitarte por matar veinte lobos
 * rompe exactamente lo que el juego intenta construir.
 *
 * Dependencias: SystemBase, achievements.data.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SystemBase } from '../core/SystemBase.js';
import {
  HAZANAS, obtenerHazana, evaluar, listado, conteo, progresoDe,
} from '../data/achievements.data.js';

/** Eventos publicados. */
export const EVENTOS_HAZANA = Object.freeze({
  CONSEGUIDA: 'achievement:unlocked',
  PROGRESO: 'achievement:progress',
});

/** Turnos entre evaluaciones periódicas. */
const INTERVALO = 5;

/**
 * Eventos que fuerzan una comprobación inmediata.
 *
 * Son los que producen situaciones que un turno después ya no serían
 * detectables.
 */
const DISPARADORES = Object.freeze([
  'combat:end',
  'player:levelup',
  'quests:completed',
  'world:discovered',
  'npc:attitude:level',
  'faction:level:change',
  'player:lifesaver',
]);

export class AchievementSystem extends SystemBase {
  static nombre = 'achievements';
  static dependencias = ['hazanas'];
  static canal = 'engine';

  constructor(contexto) {
    super(contexto);

    /** Turno de la última evaluación. @private */
    this._ultimaEvaluacion = 0;

    /** Cola de hazañas por anunciar, para no solapar avisos. @private */
    this._cola = [];

    /** true mientras se está anunciando. @private */
    this._anunciando = false;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CICLO DE VIDA
     ═══════════════════════════════════════════════════════════════════════ */

  alIniciar() {
    this.reductores({
      'hazanas/conseguir': this._reducirConseguir,
    });

    // Los disparadores fuerzan comprobación inmediata.
    for (const evento of DISPARADORES) {
      this.escuchar(evento, () => this.comprobar());
    }
  }

  /**
   * Evaluación periódica de las hazañas de acumulación.
   * @param {Object} contexto
   */
  alTurno(contexto) {
    const turno = contexto.turno ?? 0;

    if (turno - this._ultimaEvaluacion >= INTERVALO) {
      this._ultimaEvaluacion = turno;
      this.comprobar();
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     COMPROBACIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Evalúa todas las hazañas pendientes.
   *
   * @returns {Array<Object>} Las recién conseguidas.
   */
  comprobar() {
    const stats = this.sistema('hazanas')?.todas() ?? {};
    const estado = this.store.estado;
    const conseguidas = this.leer('hazanas.conseguidas', []);

    const nuevas = evaluar(stats, estado, conseguidas);
    if (!nuevas.length) return [];

    for (const hazana of nuevas) this._conseguir(hazana);

    return nuevas;
  }

  /**
   * Desbloquea una hazaña.
   *
   * @param {Object} hazana
   * @private
   */
  _conseguir(hazana) {
    this.despachar('hazanas/conseguir', {
      refId: hazana.refId,
      turno: this.leer('meta.turno', 0),
    });

    this.log.info(`hazaña conseguida: ${hazana.nombre}`);

    this.emitir(EVENTOS_HAZANA.CONSEGUIDA, {
      refId: hazana.refId,
      nombre: hazana.nombre,
      descripcion: hazana.descripcion,
      texto: hazana.texto,
      clase: hazana.clase,
      icono: hazana.icono,
      oculta: hazana.oculta,
    });

    // Se encola para anunciar de una en una.
    this._cola.push(hazana);
    this._procesarCola();

    // Las hazañas forman parte de la historia del personaje: el director puede
    // referirse a ellas.
    if (hazana.texto) {
      this.emitir('memory:remember', {
        texto: `Hazaña: ${hazana.nombre}. ${hazana.texto}`,
        peso: 2,
      });
    }
  }

  /**
   * Anuncia las hazañas de la cola, una cada vez.
   *
   * Conseguir tres de golpe es posible —al subir de nivel se cumplen varias— y
   * mostrar tres avisos superpuestos es peor que mostrarlos en fila.
   *
   * @private
   */
  _procesarCola() {
    if (this._anunciando || !this._cola.length) return;

    this._anunciando = true;
    const hazana = this._cola.shift();

    this.emitir('ui:achievement', {
      refId: hazana.refId,
      nombre: hazana.nombre,
      descripcion: hazana.descripcion,
      texto: hazana.texto,
      icono: hazana.icono,
      oculta: hazana.oculta,
    });

    // Se espera a que el aviso termine antes de sacar el siguiente.
    this.espera(() => {
      this._anunciando = false;
      this._procesarCola();
    }, 4200);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     REDUCTOR
     ═══════════════════════════════════════════════════════════════════════ */

  /** @private */
  _reducirConseguir(estado, accion) {
    const { refId, turno } = accion.payload ?? {};
    if (!refId) return null;

    const conseguidas = estado.hazanas?.conseguidas ?? [];
    if (conseguidas.includes(refId)) return null;

    return {
      hazanas: {
        conseguidas: [...conseguidas, refId],
        // Se guarda cuándo: la crónica de una partida incluye su cronología.
        cuando: { ...(estado.hazanas?.cuando ?? {}), [refId]: turno },
      },
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONSULTAS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * @param {string} refId
   * @returns {boolean}
   */
  tiene(refId) {
    return this.leer('hazanas.conseguidas', []).includes(refId);
  }

  /**
   * Listado completo para la interfaz, con las ocultas veladas.
   * @returns {Array<Object>}
   */
  listado() {
    const stats = this.sistema('hazanas')?.todas() ?? {};

    return listado(this.leer('hazanas.conseguidas', []), stats, this.store.estado);
  }

  /**
   * Resumen del progreso.
   * @returns {Object}
   */
  resumen() {
    const c = conteo();
    const conseguidas = this.leer('hazanas.conseguidas', []);

    const porClase = {};

    for (const refId of conseguidas) {
      const h = obtenerHazana(refId);
      if (h) porClase[h.clase] = (porClase[h.clase] ?? 0) + 1;
    }

    return {
      conseguidas: conseguidas.length,
      total: c.total,
      fraccion: conseguidas.length / c.total,
      // Las ocultas no se cuentan en el total visible: enseñar «12 de 34»
      // cuando once son secretas desanima sin motivo.
      visibles: c.visibles,
      ocultasEncontradas: conseguidas.filter((refId) => obtenerHazana(refId)?.oculta).length,
      ocultasTotales: c.ocultas,
      porClase,
    };
  }

  /**
   * Las más cercanas a conseguirse.
   *
   * Da al jugador algo hacia lo que apuntar sin convertirlo en una lista de
   * tareas: solo las tres que están de verdad a tiro.
   *
   * @param {number} [limite=3]
   * @returns {Array<Object>}
   */
  cercanas(limite = 3) {
    const stats = this.sistema('hazanas')?.todas() ?? {};
    const estado = this.store.estado;
    const conseguidas = new Set(this.leer('hazanas.conseguidas', []));

    return Object.values(HAZANAS)
      .filter((h) => !h.oculta && !conseguidas.has(h.refId) && h.progreso)
      .map((h) => ({
        refId: h.refId,
        nombre: h.nombre,
        descripcion: h.descripcion,
        icono: h.icono,
        progreso: progresoDe(h.refId, stats, estado),
      }))
      .filter((h) => h.progreso && h.progreso.fraccion >= 0.4)
      .sort((a, b) => b.progreso.fraccion - a.progreso.fraccion)
      .slice(0, limite);
  }

  /**
   * Cronología de hazañas, para la crónica final.
   * @returns {Array<Object>}
   */
  cronologia() {
    const conseguidas = this.leer('hazanas.conseguidas', []);
    const cuando = this.leer('hazanas.cuando', {});

    return conseguidas
      .map((refId) => {
        const h = obtenerHazana(refId);
        return h ? { refId, nombre: h.nombre, turno: cuando[refId] ?? 0 } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.turno - b.turno);
  }

  /** @returns {Object} */
  inspeccionar() {
    return { ...this.resumen(), cercanas: this.cercanas() };
  }
}

export default AchievementSystem;
