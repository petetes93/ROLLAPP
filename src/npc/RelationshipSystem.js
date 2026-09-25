/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · npc/RelationshipSystem.js
 * ---------------------------------------------------------------------------
 * Relaciones individuales con los personajes.
 *
 * Se ocupa de una sola cosa: que lo que haces con la gente tenga consecuencias
 * duraderas y coherentes. Tres mecanismos:
 *
 *   1. DEDUCCIÓN AUTOMÁTICA — el motor observa lo que ocurre y ajusta las
 *      actitudes sin que el director tenga que declararlo. Regatear con dureza
 *      molesta a un mercader; cumplir un encargo mejora la relación.
 *
 *   2. PROPAGACIÓN — la gente habla. Tratar mal a alguien en un pueblo pequeño
 *      se sabe, y los demás lo notan. La propagación es más fuerte cuanto menor
 *      es el asentamiento.
 *
 *   3. DERIVA AL OLVIDO — las actitudes extremas se moderan con el tiempo si no
 *      se refuerzan. El odio se enfría; la lealtad se enfría también. Es lo que
 *      evita que un error de hace cien turnos te persiga para siempre.
 *
 * El tercero merece defensa: sin él, el jugador acumula enemigos permanentes y
 * el mundo se cierra. Con él, hay margen de reparación.
 *
 * Dependencias: SystemBase, NPC, locations.data, balance.config.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SystemBase } from '../core/SystemBase.js';
import * as N from './NPC.js';
import { obtenerLugar } from '../data/locations.data.js';
import { SOCIAL } from '../config/balance.config.js';

/** Eventos publicados. */
export const EVENTOS_RELACION = Object.freeze({
  CAMBIO: 'npc:attitude:change',
  NIVEL: 'npc:attitude:level',
  PROPAGADO: 'npc:attitude:spread',
  COMPROMISO: 'npc:commitment',
});

/* ═══════════════════════════════════════════════════════════════════════════
   CATÁLOGO DE ACCIONES SOCIALES
   ---------------------------------------------------------------------------
   Cada entrada declara cuánto mueve la actitud y si se propaga a terceros.
   Que esté en datos y no repartido por el código permite equilibrarlo de un
   vistazo.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} AccionSocial
 * @property {number} delta Cambio de actitud sobre el afectado.
 * @property {number} propagacion 0-1: cuánto llega a terceros.
 * @property {string} registro Texto que se guarda en la memoria del PNJ.
 * @property {boolean} [publica] Si ocurre a la vista de todos.
 */

/** @type {Record<string, AccionSocial>} */
export const ACCIONES_SOCIALES = Object.freeze({
  // ─── Positivas ────────────────────────────────────────────────────────
  cumplir_encargo: {
    delta: 25, propagacion: 0.4, publica: true,
    registro: 'cumplió lo que había prometido',
  },
  ayudar_sin_pedir_nada: {
    delta: 20, propagacion: 0.5, publica: true,
    registro: 'ayudó sin pedir nada a cambio',
  },
  salvar_la_vida: {
    delta: 45, propagacion: 0.6, publica: true,
    registro: 'le salvó la vida',
  },
  hacer_regalo: {
    delta: 12, propagacion: 0.2,
    registro: 'le hizo un regalo',
  },
  pagar_de_mas: {
    delta: 8, propagacion: 0.15,
    registro: 'pagó más de lo que pedía',
  },
  guardar_secreto: {
    delta: 18, propagacion: 0,
    registro: 'guardó su secreto',
  },
  defender_publicamente: {
    delta: 22, propagacion: 0.5, publica: true,
    registro: 'le defendió delante de otros',
  },
  escuchar_con_atencion: {
    delta: 5, propagacion: 0,
    registro: 'le escuchó de verdad',
  },
  comerciar_justo: {
    delta: 4, propagacion: 0.1,
    registro: 'comerció con honestidad',
  },

  // ─── Negativas ────────────────────────────────────────────────────────
  romper_promesa: {
    delta: -35, propagacion: 0.6, publica: true,
    registro: 'rompió su palabra',
  },
  robar: {
    delta: -40, propagacion: 0.5, publica: true,
    registro: 'le robó',
  },
  mentir_descubierto: {
    delta: -25, propagacion: 0.4,
    registro: 'le mintió y se descubrió',
  },
  amenazar: {
    delta: -20, propagacion: 0.35, publica: true,
    registro: 'le amenazó',
  },
  regatear_con_dureza: {
    delta: -6, propagacion: 0.1,
    registro: 'regateó sin escrúpulos',
  },
  ignorar_peticion: {
    delta: -12, propagacion: 0.2,
    registro: 'ignoró su petición',
  },
  atacar: {
    delta: -70, propagacion: 0.8, publica: true,
    registro: 'le atacó',
  },
  matar_conocido: {
    delta: -90, propagacion: 1, publica: true,
    registro: 'mató a alguien que conocía',
  },
  traicionar: {
    delta: -60, propagacion: 0.7, publica: true,
    registro: 'le traicionó',
  },
  humillar_publicamente: {
    delta: -30, propagacion: 0.6, publica: true,
    registro: 'le humilló delante de otros',
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   SISTEMA
   ═══════════════════════════════════════════════════════════════════════════ */

export class RelationshipSystem extends SystemBase {
  static nombre = 'relationships';
  static dependencias = ['world'];
  static canal = 'npc';

  constructor(contexto) {
    super(contexto);

    /**
     * Turno de la última deriva aplicada, para no repetirla cada turno.
     * @private
     */
    this._ultimaDeriva = 0;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CICLO DE VIDA
     ═══════════════════════════════════════════════════════════════════════ */

  alIniciar() {
    this.reductores({
      'npc/actitud': this._reducirActitud,
      'npc/compromiso': this._reducirCompromiso,
      'npc/resolver': this._reducirResolver,
    });

    // El motor deduce consecuencias sociales de lo que pasa.
    this.escuchar('turn:resolved', (resumen) => this._analizarTurno(resumen));
    this.escuchar('combat:enemy:killed', (datos) => this._alMatar(datos));
    this.escuchar('trade:completed', (datos) => this._alComerciar(datos));
    this.escuchar('quests:completed', (datos) => this._alCompletarMision(datos));
  }

  /**
   * La deriva al olvido se aplica cada varios días, no cada turno.
   * @param {Object} contexto
   */
  alTurno(contexto) {
    const dia = this.leer('world.tiempo.diasTotales', 0);

    if (dia - this._ultimaDeriva >= SOCIAL.diasDeriva) {
      this._ultimaDeriva = dia;
      this._aplicarDeriva();
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ACCIONES SOCIALES
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Aplica una acción social sobre un PNJ.
   *
   * Es el punto de entrada principal. Se encarga del afectado, de la
   * propagación a terceros y del registro en la memoria.
   *
   * @param {string} refId PNJ afectado.
   * @param {string} clave Clave de ACCIONES_SOCIALES.
   * @param {Object} [opciones]
   * @param {number} [opciones.factor=1] Multiplicador de intensidad.
   * @param {string} [opciones.detalle] Contexto para la memoria.
   * @returns {{aplicado: boolean, delta: number, nivel: string|null, propagados: number}}
   */
  aplicarAccion(refId, clave, opciones = {}) {
    const accion = ACCIONES_SOCIALES[clave];
    if (!accion) return { aplicado: false, delta: 0, nivel: null, propagados: 0 };

    const npc = this.obtener(refId);
    if (!npc) return { aplicado: false, delta: 0, nivel: null, propagados: 0 };

    const delta = Math.round(accion.delta * (opciones.factor ?? 1));

    // ─── Aplicación directa ─────────────────────────────────────────────
    const motivo = opciones.detalle
      ? `${accion.registro} (${opciones.detalle})`
      : accion.registro;

    const r = N.modificarActitud(npc, delta, motivo);

    this.despachar('npc/actitud', { refId, npc: r.npc });

    this.emitir(EVENTOS_RELACION.CAMBIO, {
      refId, nombre: npc.nombre, delta, accion: clave,
    });

    // Un cambio de nivel es narrativamente relevante: alguien pasa de tolerarte
    // a apreciarte, y eso debería notarse.
    if (r.cambioNivel) {
      this.emitir(EVENTOS_RELACION.NIVEL, {
        refId,
        nombre: npc.nombre,
        anterior: r.anterior.clave,
        nueva: r.nueva.clave,
        mejora: delta > 0,
      });

      this.emitir('memory:remember', {
        texto: `${npc.nombre} ahora ${r.nueva.nombre}.`,
        peso: 2,
      });
    }

    // ─── Propagación ────────────────────────────────────────────────────
    const propagados = accion.propagacion > 0
      ? this._propagar(refId, delta, accion, opciones)
      : 0;

    return { aplicado: true, delta, nivel: r.nueva.clave, propagados };
  }

  /**
   * Cambia la actitud de un PNJ por algo concreto que ha pasado.
   *
   * Para lo que no está en el catálogo de acciones sociales: ayudarle con el
   * carro, destapar su balanza trucada. Sin propagación: lo sabe él.
   *
   * @param {string} refId
   * @param {number} delta
   * @param {string} motivo
   * @returns {boolean}
   */
  ajustar(refId, delta, motivo) {
    const npc = this.obtener(refId);
    if (!npc || !delta) return false;
    const r = N.modificarActitud(npc, delta, motivo);
    this.despachar('npc/actitud', { refId, npc: r.npc });
    this.emitir(EVENTOS_RELACION.CAMBIO, { refId, nombre: npc.nombre, delta, accion: 'situacion' });
    return true;
  }

  /**
   * Propaga el efecto de una acción a los testigos y allegados.
   *
   * La intensidad depende del tamaño del asentamiento: en una aldea de veinte
   * casas se entera todo el mundo; en una ciudad, casi nadie.
   *
   * @param {string} refIdOrigen
   * @param {number} delta
   * @param {AccionSocial} accion
   * @param {Object} opciones
   * @returns {number} Cuántos PNJ se vieron afectados.
   * @private
   */
  _propagar(refIdOrigen, delta, accion, opciones) {
    const lugar = obtenerLugar(this.leer('world.ubicacion'));

    // Un asentamiento pequeño amplifica; uno grande diluye.
    const factorTamano = lugar?.tipo === 'asentamiento'
      ? Math.max(0.3, 1.2 - (lugar.tamano ?? 1) * 0.2)
      : 0.5;

    const intensidad = accion.propagacion * factorTamano;
    if (intensidad < 0.1) return 0;

    // Solo afecta a quien esté en el mismo lugar y ya conozca al jugador.
    const conocidos = this.leer('npcs.conocidos.porId', {});
    const afectados = Object.values(conocidos).filter((n) =>
      n.refId !== refIdOrigen
      && n.lugar === lugar?.refId
      && N.estaDisponible(n));

    if (!afectados.length) return 0;

    const deltaPropagado = Math.round(delta * intensidad);
    if (deltaPropagado === 0) return 0;

    let contador = 0;

    for (const otro of afectados) {
      // Los de la misma facción que el afectado lo sienten más.
      const mismaFaccion = otro.faccion && otro.faccion === conocidos[refIdOrigen]?.faccion;
      const factor = mismaFaccion ? 1.5 : 1;

      const r = N.modificarActitud(otro, Math.round(deltaPropagado * factor), null);
      this.despachar('npc/actitud', { refId: otro.refId, npc: r.npc });
      contador++;
    }

    if (contador > 0) {
      this.emitir(EVENTOS_RELACION.PROPAGADO, {
        origen: refIdOrigen,
        afectados: contador,
        delta: deltaPropagado,
        publica: Boolean(accion.publica),
      });

      // Se avisa solo cuando la propagación es apreciable: enterarse de que
      // «la gente lo ha notado» importa.
      if (Math.abs(deltaPropagado) >= 10) {
        this.emitir('ui:notice', {
          mensaje: deltaPropagado > 0
            ? 'La noticia corre. La gente de aquí te mira mejor.'
            : 'La noticia corre. La gente de aquí te mira peor.',
          tipo: deltaPropagado > 0 ? 'exito' : 'aviso',
        });
      }
    }

    return contador;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     DEDUCCIÓN AUTOMÁTICA
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Analiza un turno resuelto en busca de consecuencias sociales.
   *
   * Como en `ConsequenceEngine`, la detección se apoya en la intención
   * interpretada y en el resultado de la tirada, no en el texto narrativo.
   * Analizar prosa produciría falsos positivos constantes.
   *
   * @param {Object} resumen
   * @private
   */
  _analizarTurno(resumen) {
    const intencion = resumen?.intencion;
    if (!intencion) return;

    const presentes = this.leer('npcs.presentes', []);
    if (!presentes.length) return;

    // El PNJ afectado es el mencionado, o el primero presente.
    const refId = this._resolverObjetivo(intencion, presentes);
    if (!refId) return;

    // ─── Intenciones con consecuencia social ────────────────────────────
    const mapa = {
      intimidate: { clave: 'amenazar', soloSiExito: false },
      deceive: { clave: 'mentir_descubierto', soloSiFallo: true },
      talk: { clave: 'escuchar_con_atencion', probabilidad: 0.3 },
    };

    const entrada = mapa[intencion.tipo];
    if (!entrada) return;

    // Mentir solo penaliza si te pillan.
    if (entrada.soloSiFallo && resumen.tirada?.exito !== false) return;
    if (entrada.soloSiExito && !resumen.tirada?.exito) return;

    if (entrada.probabilidad && !this.rng.flujo('narrativa').oportunidad(entrada.probabilidad)) {
      return;
    }

    this.aplicarAccion(refId, entrada.clave);
  }

  /**
   * Resuelve a qué PNJ se dirigía una acción.
   * @private
   */
  _resolverObjetivo(intencion, presentes) {
    if (!intencion.objetivo) return presentes[0];

    const conocidos = this.leer('npcs.conocidos.porId', {});
    const objetivo = intencion.objetivo.toLowerCase();

    const encontrado = presentes.find((refId) => {
      const n = conocidos[refId];
      return n && (
        n.nombre.toLowerCase().includes(objetivo)
        || (n.rol ?? '').toLowerCase().includes(objetivo)
      );
    });

    return encontrado ?? presentes[0];
  }

  /** @private */
  _alMatar(datos) {
    // Matar delante de gente que te conoce es de lo peor que puedes hacer.
    const presentes = this.leer('npcs.presentes', []);

    for (const refId of presentes) {
      this.aplicarAccion(refId, 'matar_conocido', { factor: 0.5 });
    }
  }

  /** @private */
  _alComerciar(datos) {
    if (!datos?.refIdNPC) return;

    // Regatear mucho por debajo del precio justo molesta.
    if (datos.margenRegateo && datos.margenRegateo > 0.25) {
      this.aplicarAccion(datos.refIdNPC, 'regatear_con_dureza');
    } else if (datos.total > 100) {
      this.aplicarAccion(datos.refIdNPC, 'comerciar_justo');
    }
  }

  /** @private */
  _alCompletarMision(datos) {
    if (!datos?.refIdNPC) return;

    this.aplicarAccion(datos.refIdNPC, 'cumplir_encargo', {
      detalle: datos.titulo,
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     COMPROMISOS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Registra una promesa o deuda del jugador con un PNJ.
   *
   * @param {string} refId
   * @param {Object} datos
   * @returns {boolean}
   */
  anotarCompromiso(refId, datos) {
    const npc = this.obtener(refId);
    if (!npc) return false;

    const actualizado = N.anotarCompromiso(npc, {
      ...datos,
      turno: this.leer('meta.turno', 0),
    });

    this.despachar('npc/actitud', { refId, npc: actualizado });

    this.emitir(EVENTOS_RELACION.COMPROMISO, { refId, nombre: npc.nombre, ...datos });

    // Un compromiso abierto es un hilo narrativo: el director lo retomará.
    this.emitir('memory:thread', {
      tipo: datos.clase === 'deuda' ? 'deuda' : 'promesa',
      texto: `${datos.texto} (con ${npc.nombre})`,
      relacionadoCon: refId,
    });

    return true;
  }

  /**
   * Resuelve un compromiso pendiente.
   *
   * @param {string} refId
   * @param {string} idCompromiso
   * @param {boolean} [cumplido=true]
   * @returns {boolean}
   */
  resolverCompromiso(refId, idCompromiso, cumplido = true) {
    const npc = this.obtener(refId);
    if (!npc) return false;

    const r = N.resolverCompromiso(npc, idCompromiso, cumplido);

    // El cambio de actitud va aparte, para que pase por el registro habitual.
    const conActitud = N.modificarActitud(
      r.npc,
      r.deltaActitud,
      cumplido ? 'cumplió lo prometido' : 'no cumplió lo prometido',
    );

    this.despachar('npc/actitud', { refId, npc: conActitud.npc });

    if (!cumplido) {
      // Incumplir se propaga: es de las cosas que más rápido se saben.
      this._propagar(refId, r.deltaActitud, ACCIONES_SOCIALES.romper_promesa, {});
    }

    return true;
  }

  /**
   * Compromisos pendientes del jugador, con todos los PNJ.
   * @returns {Array<Object>}
   */
  compromisosPendientes() {
    const conocidos = this.leer('npcs.conocidos.porId', {});

    return Object.values(conocidos).flatMap((npc) =>
      N.pendientes(npc).map((c) => ({
        ...c,
        refIdNPC: npc.refId,
        nombreNPC: npc.nombre,
      })));
  }

  /* ═══════════════════════════════════════════════════════════════════════
     DERIVA AL OLVIDO
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Modera las actitudes extremas con el paso del tiempo.
   *
   * Sin esto, el jugador acumula enemigos permanentes y el mundo se le cierra.
   * Con esto hay margen de reparación, que es lo que hace interesante intentarla.
   *
   * La deriva es asimétrica a propósito: el rencor se enfría más despacio que
   * el afecto. Ganarse a alguien cuesta más que perderlo.
   *
   * @private
   */
  _aplicarDeriva() {
    const conocidos = this.leer('npcs.conocidos.porId', {});
    let movidos = 0;

    for (const npc of Object.values(conocidos)) {
      const actitud = npc.actitud;

      // Las actitudes moderadas no derivan: ya están donde deben.
      if (Math.abs(actitud) < 20) continue;

      // Un compromiso pendiente congela la deriva: no se olvida una deuda.
      if (N.pendientes(npc).length) continue;

      // El rencor se enfría más despacio que el afecto.
      const paso = actitud > 0 ? SOCIAL.derivaPositiva : SOCIAL.derivaNegativa;
      const delta = actitud > 0 ? -paso : paso;

      const r = N.modificarActitud(npc, delta, null);
      this.despachar('npc/actitud', { refId: npc.refId, npc: r.npc });
      movidos++;
    }

    if (movidos) this.log.debug(`deriva aplicada a ${movidos} personajes`);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     REDUCTORES
     ═══════════════════════════════════════════════════════════════════════ */

  /** @private */
  _reducirActitud(estado, accion) {
    const { refId, npc } = accion.payload ?? {};
    if (!refId || !npc) return null;

    const conocidos = estado.npcs.conocidos;
    const yaConocido = Boolean(conocidos.porId[refId]);

    return {
      npcs: {
        conocidos: {
          porId: { ...conocidos.porId, [refId]: npc },
          orden: yaConocido ? conocidos.orden : [...conocidos.orden, refId],
        },
        // El espejo numérico facilita las consultas rápidas del compositor.
        relaciones: { ...estado.npcs.relaciones, [refId]: npc.actitud },
      },
    };
  }

  /** @private */
  _reducirCompromiso(estado, accion) {
    const { refId, datos } = accion.payload ?? {};
    if (!refId) return null;

    queueMicrotask(() => this.anotarCompromiso(refId, datos));
    return null;
  }

  /** @private */
  _reducirResolver(estado, accion) {
    const { refId, id, cumplido } = accion.payload ?? {};
    if (!refId || !id) return null;

    queueMicrotask(() => this.resolverCompromiso(refId, id, cumplido));
    return null;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONSULTAS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * @param {string} refId
   * @returns {import('./NPC.js').PersonajeNoJugador|null}
   */
  obtener(refId) {
    return this.leer(`npcs.conocidos.porId.${refId}`) ?? null;
  }

  /**
   * Actitud efectiva de un PNJ, con la reputación de facción incluida.
   * @param {string} refId
   * @returns {Object|null}
   */
  actitudDe(refId) {
    const npc = this.obtener(refId);
    if (!npc) return null;

    return N.actitudEfectiva(npc, this.leer('factions.reputacion', {}));
  }

  /**
   * PNJ ordenados por afinidad. Los mejores amigos y los peores enemigos.
   * @param {number} [limite=5]
   * @returns {{aliados: Array<Object>, enemigos: Array<Object>}}
   */
  extremos(limite = 5) {
    const conocidos = Object.values(this.leer('npcs.conocidos.porId', {}));
    const ordenados = [...conocidos].sort((a, b) => b.actitud - a.actitud);

    return {
      aliados: ordenados.filter((n) => n.actitud >= 30).slice(0, limite),
      enemigos: ordenados.filter((n) => n.actitud <= -30).reverse().slice(0, limite),
    };
  }

  /** @returns {Object} */
  inspeccionar() {
    const conocidos = Object.values(this.leer('npcs.conocidos.porId', {}));

    return {
      conocidos: conocidos.length,
      vivos: conocidos.filter((n) => N.estaDisponible(n)).length,
      compromisos: this.compromisosPendientes().length,
      extremos: this.extremos(3),
    };
  }
}

export default RelationshipSystem;
