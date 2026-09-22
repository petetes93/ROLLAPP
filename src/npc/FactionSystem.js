/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · npc/FactionSystem.js
 * ---------------------------------------------------------------------------
 * Coordinador de personajes y facciones.
 *
 * Une lo que hacen `NPCFactory`, `RelationshipSystem` y `ReputationSystem`, y
 * se ocupa de lo que ninguno cubre por separado:
 *
 *   · QUIÉN ESTÁ PRESENTE — poblar una escena con gente coherente y retirarla
 *     al marcharse
 *   · PERSISTENCIA DE PERSONAS — que el posadero de Vado del Yunque sea el
 *     mismo cada vez que vuelves
 *   · INTEGRACIÓN CON EL DIRECTOR — recibir los PNJ que propone y devolverle el
 *     contexto de quién hay delante
 *
 * La persistencia es lo que más aporta. Un mundo donde cada visita genera
 * personas nuevas se siente hueco; uno donde el herrero te reconoce y recuerda
 * que le debes dinero, no.
 *
 * Dependencias: SystemBase, NPC, NPCFactory, locations.data.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SystemBase } from '../core/SystemBase.js';
import * as N from './NPC.js';
import * as Fabrica from './NPCFactory.js';
import { obtenerLugar, obtenerSublugar, sublugaresDe } from '../data/locations.data.js';
import { obtenerFaccion } from '../data/factions.data.js';

/** Eventos publicados. */
export const EVENTOS_NPC = Object.freeze({
  APARECE: 'npc:appears',
  SE_VA: 'npc:leaves',
  CONOCIDO: 'npc:met',
  MUERE: 'npc:killed',
});

/** Cuántos PNJ pueden estar presentes a la vez en una escena. */
const PRESENTES_MAX = 4;

export class FactionSystem extends SystemBase {
  static nombre = 'npcs';
  static dependencias = ['world', 'relationships', 'reputation'];
  static canal = 'npc';

  /* ═══════════════════════════════════════════════════════════════════════
     CICLO DE VIDA
     ═══════════════════════════════════════════════════════════════════════ */

  alIniciar() {
    this.reductores({
      'npc/presentes': this._reducirPresentes,
      'npc/registrar': this._reducirRegistrar,
      'npc/situacion': this._reducirSituacion,
    });

    // Al llegar a un lugar se puebla la escena.
    this.escuchar('world:arrived', ({ refId }) => this._alLlegar(refId));

    // Entrar en un interior cambia quién hay delante.
    this.escuchar('world:sublugar:change', () => this._repoblar());

    // El director puede introducir personajes en su respuesta.
    this.escuchar('npcs:introduce', (propuesta) => this.introducir(propuesta));

    // Empezar un viaje vacía la escena: la gente se queda donde estaba.
    this.escuchar('travel:start', () => this._vaciarPresentes());

    // Un encuentro con PNJ genera a alguien coherente con el terreno.
    this.escuchar('world:event:npc_meet', (datos) => this.introducir(datos));
  }

  /* ═══════════════════════════════════════════════════════════════════════
     POBLACIÓN DE ESCENAS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Puebla la escena al llegar a un lugar.
   *
   * Los PNJ ya conocidos que viven aquí reaparecen; se completa con gente nueva
   * si el sitio lo justifica.
   *
   * @param {string} refIdLugar
   * @private
   */
  _alLlegar(refIdLugar) {
    const lugar = obtenerLugar(refIdLugar);
    if (!lugar) return;

    // Los puntos de paso y las ruinas no tienen población fija.
    const poblado = lugar.tipo === 'asentamiento';

    const presentes = [];

    // ─── Residentes ya conocidos ────────────────────────────────────────
    const conocidos = this.leer('npcs.conocidos.porId', {});

    const residentes = Object.values(conocidos)
      .filter((n) => n.lugar === refIdLugar && N.estaDisponible(n))
      // Solo los que están en el exterior, no dentro de un sublugar.
      .filter((n) => !n.sublugar);

    presentes.push(...residentes.slice(0, PRESENTES_MAX).map((n) => n.refId));

    // ─── Gente nueva ────────────────────────────────────────────────────
    if (poblado && presentes.length < 2) {
      const flujo = this.rng.flujo('npc');
      const cuantos = flujo.entero(1, Math.min(2, PRESENTES_MAX - presentes.length));

      for (let i = 0; i < cuantos; i++) {
        const nuevo = Fabrica.generar(flujo, {
          lugar: refIdLugar,
          franja: this.leer('world.tiempo.franja'),
          turno: this.leer('meta.turno', 0),
        });

        this._registrar(nuevo);
        presentes.push(nuevo.refId);
      }
    }

    this.despachar('npc/presentes', { presentes });

    // Los reencuentros son material narrativo de primera.
    for (const refId of presentes) {
      const npc = conocidos[refId];
      if (npc?.encuentros > 0) {
        this.emitir('memory:context', {
          texto: `${npc.nombre} sigue aquí y reconoce al personaje.`,
          temporal: true,
        });
      }
    }
  }

  /**
   * Recalcula quién está presente al entrar o salir de un interior.
   * @private
   */
  _repoblar() {
    const refIdLugar = this.leer('world.ubicacion');
    const sublugar = this.leer('world.sublugar');

    const conocidos = this.leer('npcs.conocidos.porId', {});

    // Dentro de un sublugar solo está quien trabaja o para ahí.
    const candidatos = Object.values(conocidos).filter((n) => {
      if (n.lugar !== refIdLugar || !N.estaDisponible(n)) return false;
      return sublugar ? n.sublugar === sublugar : !n.sublugar;
    });

    const presentes = candidatos.slice(0, PRESENTES_MAX).map((n) => n.refId);

    // Un interior con servicio suele tener a quien lo atiende.
    if (sublugar && !presentes.length) {
      const s = obtenerSublugar(sublugar);

      if (s) {
        const flujo = this.rng.flujo('npc');
        const encargado = Fabrica.generar(flujo, {
          lugar: refIdLugar,
          sublugar,
          franja: this.leer('world.tiempo.franja'),
        });

        this._registrar(encargado);
        presentes.push(encargado.refId);
      }
    }

    this.despachar('npc/presentes', { presentes });
  }

  /** @private */
  _vaciarPresentes() {
    this.despachar('npc/presentes', { presentes: [] });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     INTRODUCCIÓN DESDE EL DIRECTOR
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Registra un PNJ que el director ha introducido.
   *
   * Si ya existe uno con ese identificador, se reutiliza en vez de duplicarlo:
   * el director puede mencionar a alguien que ya conocíamos.
   *
   * @param {Object} propuesta
   * @returns {Object|null} El PNJ resultante.
   */
  introducir(propuesta) {
    if (!propuesta?.nombre && !propuesta?.refId) return null;

    const refId = propuesta.refId
      ?? `npc_${String(propuesta.nombre).toLowerCase().replace(/\s+/g, '_')}`;

    // ─── ¿Ya lo conocemos? ──────────────────────────────────────────────
    const existente = this.leer(`npcs.conocidos.porId.${refId}`);

    if (existente) {
      if (!N.estaDisponible(existente)) {
        // El director intenta traer de vuelta a alguien que murió. No.
        this.log.aviso(`intento de reintroducir a ${existente.nombre}, que está ${existente.situacion}`);
        return null;
      }

      this._anadirPresente(refId);
      return existente;
    }

    // ─── Nuevo ──────────────────────────────────────────────────────────
    const flujo = this.rng.flujo('npc');

    const npc = Fabrica.desdeDirector(flujo, { ...propuesta, refId }, {
      lugar: this.leer('world.ubicacion'),
      sublugar: this.leer('world.sublugar'),
      franja: this.leer('world.tiempo.franja'),
    });

    this._registrar(npc);
    this._anadirPresente(refId);

    this.emitir(EVENTOS_NPC.APARECE, {
      refId, nombre: npc.nombre, rol: npc.rol,
    });

    return npc;
  }

  /**
   * Registra un PNJ en el estado.
   * @param {Object} npc
   * @private
   */
  _registrar(npc) {
    this.despachar('npc/registrar', { npc });

    this.emitir(EVENTOS_NPC.CONOCIDO, {
      refId: npc.refId, nombre: npc.nombre, rol: npc.rol,
    });
  }

  /**
   * Añade un PNJ a los presentes sin desplazar a los demás.
   * @param {string} refId
   * @private
   */
  _anadirPresente(refId) {
    const presentes = this.leer('npcs.presentes', []);
    if (presentes.includes(refId)) return;

    // Si la escena está llena, sale el más antiguo.
    const nuevos = presentes.length >= PRESENTES_MAX
      ? [...presentes.slice(1), refId]
      : [...presentes, refId];

    this.despachar('npc/presentes', { presentes: nuevos });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ENCUENTROS Y SITUACIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Registra que el jugador ha interactuado con un PNJ.
   *
   * @param {string} refId
   * @param {string} [resumen] Qué ocurrió, para su memoria.
   * @returns {boolean}
   */
  registrarEncuentro(refId, resumen) {
    const npc = this.leer(`npcs.conocidos.porId.${refId}`);
    if (!npc) return false;

    const r = N.registrarEncuentro(npc, {
      turno: this.leer('meta.turno', 0),
      resumen,
    });

    this.despachar('npc/registrar', { npc: r.npc });

    if (r.primeraVez) {
      this.emitir('memory:remember', {
        texto: `Conoció a ${npc.nombre}, ${npc.rol}.`,
        peso: 1,
      });
    }

    return true;
  }

  /**
   * Cambia la situación de un PNJ.
   *
   * Matar a alguien tiene consecuencias en cadena: con su facción, con quienes
   * lo conocían y en la memoria del mundo.
   *
   * @param {string} refId
   * @param {string} situacion
   * @param {string} [motivo]
   */
  cambiarSituacion(refId, situacion, motivo) {
    const npc = this.leer(`npcs.conocidos.porId.${refId}`);
    if (!npc) return;

    const actualizado = N.cambiarSituacion(npc, situacion, motivo);
    this.despachar('npc/situacion', { npc: actualizado });

    if (situacion === N.SITUACION.MUERTO) {
      // Fuera de la escena y de la lista de vivos.
      const presentes = this.leer('npcs.presentes', []).filter((id) => id !== refId);
      this.despachar('npc/presentes', { presentes });

      this.emitir(EVENTOS_NPC.MUERE, {
        refId,
        nombre: npc.nombre,
        faccion: npc.faccion,
        motivo,
      });

      this.emitir('memory:remember', {
        texto: `${npc.nombre} ha muerto${motivo ? `: ${motivo}` : ''}.`,
        peso: 4,
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONSULTAS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * @param {string} refId
   * @returns {Object|null}
   */
  obtener(refId) {
    return this.leer(`npcs.conocidos.porId.${refId}`) ?? null;
  }

  /**
   * PNJ presentes en la escena.
   * @returns {Array<Object>}
   */
  presentes() {
    const ids = this.leer('npcs.presentes', []);
    const conocidos = this.leer('npcs.conocidos.porId', {});

    return ids.map((id) => conocidos[id]).filter(Boolean);
  }

  /**
   * Busca un PNJ presente por nombre o papel.
   *
   * La usa el enrutador cuando el jugador escribe «hablo con el herrero».
   *
   * @param {string} texto
   * @returns {Object|null}
   */
  buscarPresente(texto) {
    if (!texto) return this.presentes()[0] ?? null;

    const limpio = texto.toLowerCase();
    const presentes = this.presentes();

    return presentes.find((n) => n.nombre.toLowerCase().includes(limpio))
      ?? presentes.find((n) => (n.rol ?? '').toLowerCase().includes(limpio))
      ?? null;
  }

  /**
   * Mercaderes presentes.
   * @returns {Array<Object>}
   */
  mercaderesPresentes() {
    return this.presentes().filter((n) => n.esMercader);
  }

  /**
   * Datos para la interfaz.
   * @returns {Array<Object>}
   */
  paraInterfaz() {
    const reputaciones = this.leer('factions.reputacion', {});
    return this.presentes().map((n) => N.paraInterfaz(n, reputaciones));
  }

  /**
   * Contexto de personas para el director.
   *
   * Es de las secciones más valiosas del prompt: sin ella, el director inventa
   * gente nueva cada turno y las conversaciones no tienen continuidad.
   *
   * @returns {string}
   */
  paraDirector() {
    const presentes = this.presentes();
    if (!presentes.length) return '';

    const reputaciones = this.leer('factions.reputacion', {});

    const bloques = presentes.map((n) => `· ${N.paraDirector(n, reputaciones)}`);

    return `PRESENTES EN LA ESCENA:\n${bloques.join('\n')}`;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     REDUCTORES
     ═══════════════════════════════════════════════════════════════════════ */

  /** @private */
  _reducirPresentes(estado, accion) {
    const { presentes = [] } = accion.payload ?? {};
    return { npcs: { presentes } };
  }

  /** @private */
  _reducirRegistrar(estado, accion) {
    const { npc } = accion.payload ?? {};
    if (!npc?.refId) return null;

    const conocidos = estado.npcs.conocidos;
    const yaEstaba = Boolean(conocidos.porId[npc.refId]);

    return {
      npcs: {
        conocidos: {
          porId: { ...conocidos.porId, [npc.refId]: npc },
          orden: yaEstaba ? conocidos.orden : [...conocidos.orden, npc.refId],
        },
        relaciones: { ...estado.npcs.relaciones, [npc.refId]: npc.actitud },
      },
    };
  }

  /** @private */
  _reducirSituacion(estado, accion) {
    const { npc } = accion.payload ?? {};
    if (!npc?.refId) return null;

    const parche = {
      npcs: {
        conocidos: {
          ...estado.npcs.conocidos,
          porId: { ...estado.npcs.conocidos.porId, [npc.refId]: npc },
        },
      },
    };

    // Los caídos se apuntan aparte: el motor lo consulta para impedir que el
    // director los resucite por descuido.
    if (npc.situacion === N.SITUACION.MUERTO) {
      const caidos = estado.npcs.caidos ?? [];
      if (!caidos.includes(npc.refId)) {
        parche.npcs.caidos = [...caidos, npc.refId];
      }
    }

    return parche;
  }

  /** @returns {Object} */
  inspeccionar() {
    const conocidos = Object.values(this.leer('npcs.conocidos.porId', {}));

    return {
      conocidos: conocidos.length,
      presentes: this.leer('npcs.presentes', []).length,
      vivos: conocidos.filter((n) => N.estaDisponible(n)).length,
      caidos: this.leer('npcs.caidos', []).length,
      mercaderes: conocidos.filter((n) => n.esMercader).length,
    };
  }
}

export default FactionSystem;
