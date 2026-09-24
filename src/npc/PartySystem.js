/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · npc/PartySystem.js
 * ---------------------------------------------------------------------------
 * El grupo: quién viaja con el personaje.
 *
 * Un PNJ se une si se le convence —«¿vienes conmigo?», «te pago para que me
 * guíes»—, con una tirada social contra lo bien que le cae el personaje. Si
 * dice que no, a veces ofrece a otro: «Yo no, pero mi aprendiz conoce el
 * bosque». Una vez en el grupo viaja, pelea en el bando del jugador y comenta
 * de vez en cuando. Se le puede despedir, y vuelve a donde estaba.
 *
 * Si cae en combate queda herido, no muerto; solo en la intensidad Brutal un
 * compañero puede morir. Ver `CombatManager`.
 *
 * Como mucho tres. Con más, el protagonista deja de serlo.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SystemBase } from '../core/SystemBase.js';
import { fichaDeCompanero } from './Companero.js';
import * as Fabrica from './NPCFactory.js';
import { concordar } from '../utils/text.js';

/** Cuántos pueden ir con el personaje a la vez. */
export const GRUPO_MAX = 3;

/**
 * Lo que cuesta convencer a alguien, según lo bien que le cae el personaje.
 *
 * La gente del pueblo empieza entre 0 y 12. Con «neutral = difícil (20)» un
 * personaje de nivel 1 solo reclutaba con un 20 natural: el grupo no se
 * formaba nunca en una partida normal. Neutral o mejor es moderada (15);
 * difícil queda para quien te tiene manía.
 */
export function umbralPorActitud(actitud = 0) {
  if (actitud >= 40) return 'facil';
  if (actitud >= 0) return 'moderada';
  if (actitud >= -30) return 'dificil';
  return 'ardua';
}

/** A quién ofrece alguien que se niega: su gente de confianza. */
const RELEVOS = Object.freeze({
  herrer: 'aprendiz de forja',
  posader: 'mozo de cuadra',
  cazador: 'cazador',
  barquer: 'barquero',
});

export class PartySystem extends SystemBase {
  static nombre = 'party';
  static dependencias = ['npcs', 'rules'];

  alIniciar() {
    this.reductores({
      'party/unir': (estado, { payload }) => ({
        party: { miembros: [...(estado.party?.miembros ?? []), payload.miembro] },
      }),
      'party/despedir': (estado, { payload }) => ({
        party: { miembros: (estado.party?.miembros ?? []).filter((m) => m.refId !== payload.refId) },
      }),
      'party/actualizar': (estado, { payload }) => ({
        party: {
          miembros: (estado.party?.miembros ?? []).map((m) => (m.refId === payload.refId ? { ...m, ...payload.cambios } : m)),
        },
      }),
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONSULTA
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Los miembros con su ficha.
   * @returns {Array<Object>}
   */
  miembros() {
    const conocidos = this.leer('npcs.conocidos.porId', {}) ?? {};
    return (this.leer('party.miembros', []) ?? [])
      .map((m) => {
        const npc = conocidos[m.refId];
        return npc ? { ...m, ficha: fichaDeCompanero(npc) } : null;
      })
      .filter(Boolean);
  }

  /** ¿Va este PNJ en el grupo? */
  enGrupo(refId) {
    return (this.leer('party.miembros', []) ?? []).some((m) => m.refId === refId);
  }

  /**
   * Busca un miembro por el nombre que aparece en una frase: «Grom, cúbreme».
   * @param {string} texto
   * @returns {Object|null}
   */
  porNombreEn(texto) {
    const t = String(texto ?? '').toLowerCase();
    return this.miembros().find((m) => t.includes(m.ficha.nombre.toLowerCase())) ?? null;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RECLUTAR Y DESPEDIR
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Intenta que un PNJ presente se una.
   *
   * @param {Object} npc Registro del PNJ.
   * @param {Object} [opciones]
   * @param {boolean} [opciones.pago] Si el jugador ofrece dinero.
   * @returns {{unido: boolean, texto: string, tirada: Object|null}}
   */
  reclutar(npc, { pago = false } = {}) {
    if (!npc) return { unido: false, tirada: null, texto: 'No hay nadie a quien pedírselo.' };
    if (this.enGrupo(npc.refId)) return { unido: false, tirada: null, texto: `${npc.nombre} ya va contigo.` };
    if ((this.leer('party.miembros', []) ?? []).length >= GRUPO_MAX) {
      return { unido: false, tirada: null, texto: `Ya sois demasiados. ${npc.nombre} no cabe en el grupo.` };
    }

    // Pagar ayuda, si hay con qué: diez monedas que se pierden solo si acepta.
    const oro = this.leer('player.oro', 0);
    const paga = pago && oro >= 10;

    const tirada = this.sistema('rules').resolver({
      habilidad: 'trato_social',
      // A quien te recomienda alguien que no puede ir, le vale su palabra:
      // «pregúntale» tiene que ser una puerta, no otra tirada imposible.
      umbral: npc.recomendadoPor ? 'facil' : umbralPorActitud(npc.actitud),
      bonoExtra: paga ? 2 : 0,
      fuenteExtra: paga ? 'Pago' : null,
    });
    const dados = `(d20 ${tirada.natural}: ${tirada.total} contra ${tirada.umbral})`;

    if (!tirada.exito) {
      const relevo = this._ofrecerRelevo(npc);
      const negativa = relevo
        ? `«Yo no puedo dejar esto», dice ${npc.nombre}. «Pero ${relevo.nombre}, ${relevo.rol}, conoce el camino. Pregúntale.»`
        : `${npc.nombre} niega con la cabeza. «No es mi guerra.»`;
      return { unido: false, tirada, texto: `${negativa} ${dados}` };
    }

    if (paga) this.despachar('inventory/oro', { delta: -10, motivo: 'paga de un compañero' });

    const ficha = fichaDeCompanero(npc);
    this.despachar('party/unir', {
      miembro: { refId: npc.refId, vida: { actual: ficha.vidaMax, max: ficha.vidaMax }, herido: false, desde: npc.lugar ?? this.leer('world.ubicacion') },
    });
    this.sistema('npcs')?.acompanar?.(npc.refId);

    this.emitir('party:join', { refId: npc.refId, nombre: npc.nombre });
    this.emitir('memory:remember', { texto: `${npc.nombre}, ${npc.rol}, se unió al grupo.`, peso: 3 });

    const acepta = paga
      ? `${npc.nombre} cuenta las monedas y asiente. «Hecho. Voy contigo.»`
      : `${npc.nombre} se lo piensa un momento y asiente. «Voy contigo.»`;
    return { unido: true, tirada, texto: `${acepta} ${dados}` };
  }

  /**
   * Alguien que se niega puede ofrecer a otro de su confianza, en el mismo
   * sitio. Una vez por persona: si se le vuelve a pedir, ya ofreció.
   * @private
   */
  _ofrecerRelevo(npc) {
    if (npc.ofrecioRelevo) return null;
    const rol = String(npc.rol ?? '').toLowerCase();
    const clave = Object.keys(RELEVOS).find((k) => rol.includes(k));
    if (!clave) return null;

    const flujo = this.rng.flujo('npc');
    if (!flujo.oportunidad(0.6)) return null;

    const npcs = this.sistema('npcs');
    const base = Fabrica.generar(flujo, { lugar: this.leer('world.ubicacion'), rolPreferido: RELEVOS[clave] });
    const nuevo = npcs?.introducir?.({ nombre: base?.nombre, rol: RELEVOS[clave], actitud: 'amable' });
    npcs?.actualizar?.(npc.refId, { ofrecioRelevo: true });
    if (nuevo?.refId) npcs?.actualizar?.(nuevo.refId, { recomendadoPor: npc.refId });
    return nuevo;
  }

  /**
   * Despide a un compañero: vuelve a donde se unió.
   *
   * @param {string} refId
   * @returns {{despedido: boolean, texto: string}}
   */
  despedir(refId) {
    const miembro = (this.leer('party.miembros', []) ?? []).find((m) => m.refId === refId);
    const npc = this.leer(`npcs.conocidos.porId.${refId}`);
    if (!miembro || !npc) return { despedido: false, texto: 'No va nadie así contigo.' };

    this.despachar('party/despedir', { refId });
    this.sistema('npcs')?.dejarEn?.(refId, miembro.desde);
    this.emitir('party:leave', { refId, nombre: npc.nombre });

    return { despedido: true, texto: `${npc.nombre} asiente y da media vuelta. «Ya sabes dónde encontrarme.»` };
  }

  /**
   * Lo que pasó en el combate, de vuelta al grupo: vida, heridas y muertes.
   *
   * @param {Array<Object>} combatientes Los compañeros tal como acabaron.
   * @param {Object} [opciones]
   * @param {boolean} [opciones.puedenMorir] Solo en Brutal.
   * @returns {string[]} Líneas para narrar.
   */
  despuesDelCombate(combatientes, { puedenMorir = false } = {}) {
    const lineas = [];

    for (const c of combatientes) {
      if (!c.esCompanero) continue;
      const nombre = c.nombre;

      if (!c.vivo && puedenMorir) {
        this.despachar('party/despedir', { refId: c.refId });
        this.sistema('npcs')?.actualizar?.(c.refId, { situacion: 'muerto' });
        lineas.push(`${nombre} no se levanta.`);
        continue;
      }

      const herido = !c.vivo;
      this.despachar('party/actualizar', {
        refId: c.refId,
        cambios: { vida: { actual: herido ? 1 : c.vida.actual, max: c.vida.max }, herido },
      });
      if (herido) lineas.push(`${nombre} está ${concordar('herido', c.genero)}, pero ${concordar('vivo', c.genero)}. Necesitará descansar.`);
    }

    return lineas;
  }

  /** Descansar cura al grupo. */
  descansar() {
    for (const m of this.leer('party.miembros', []) ?? []) {
      this.despachar('party/actualizar', { refId: m.refId, cambios: { vida: { actual: m.vida.max, max: m.vida.max }, herido: false } });
    }
  }

  inspeccionar() {
    return { miembros: (this.leer('party.miembros', []) ?? []).map((m) => m.refId) };
  }
}

export default PartySystem;
