/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · world/SituationSystem.js
 * ---------------------------------------------------------------------------
 * Lo que está pasando en el mundo, con o sin el jugador.
 *
 * Una situación es una escena en marcha: gente con sus motivos, algo que se
 * tuerce y más de una manera de meterse. No es un encargo: nadie la acepta ni
 * la rechaza. El jugador puede intervenir, mirar o seguir a lo suyo:
 *
 *   · Si interviene, la vía que elige se tira con los dados y el mundo
 *     cambia: actitudes, recuerdos de los PNJ, y a veces la situación acaba.
 *   · Si la ignora, la situación sigue ahí —sus actores no se evaporan— y
 *     pasados unos turnos se resuelve sin él, de la forma en que lo habría
 *     hecho de todos modos. No es un castigo: es el mundo moviéndose.
 *
 * Vive en `world.situaciones`, que se guarda con la partida.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SystemBase } from '../core/SystemBase.js';
import { situacionesPara, obtenerSituacion } from '../data/situaciones.data.js';
import { obtenerLugar } from '../data/locations.data.js';
import { nombreAleatorio } from '../player/CharacterRandom.js';
import { sinAcentos } from '../utils/text.js';

/**
 * Frases que apuntan a «lo que está pasando» sin nombrarlo: «me acerco a ver
 * qué pasa», «echo un vistazo». Con una situación en marcha, es a ella.
 */
export const ATIENDE = /\b(?:ver que (?:pasa|ocurre|sucede)|que (?:pasa|ocurre|sucede)|me acerco|acercarme|me asomo|echo un vistazo|me fijo|miro (?:lo que|que) (?:pasa|ocurre))\b/;

/** Frases con las que el jugador deja algo de lado a propósito. */
export const OMITE = /\b(?:ignoro|ignorando|paso de|no hago caso|sin hacer caso|me desentiendo|no me meto|no me importa|dejo (?:estar|atras|en paz)|sigo de largo|miro hacia otro lado|hago como si no)\b/;

/** Estados de una situación. */
export const ESTADO_SITUACION = Object.freeze({
  ABIERTA: 'abierta',
  RESUELTA: 'resuelta',
  DESENLACE: 'desenlace',   // se resolvió sola, sin el jugador
});

const llano = (t) => sinAcentos(String(t ?? '').toLowerCase());

export class SituationSystem extends SystemBase {
  static nombre = 'situations';
  static dependencias = ['world', 'npcs', 'rules'];

  constructor(contexto) {
    super(contexto);
    /** La situación en la que se fijó el jugador este turno. @private */
    this._atendida = null;
  }

  alIniciar() {
    this.reductores({ 'situaciones/guardar': this._reducirGuardar });

    // Al llegar a un asentamiento puede haber algo en marcha. No siempre: un
    // pueblo en el que siempre pasa algo al llegar es un escenario, no un
    // pueblo.
    this.escuchar('world:arrived', () => {
      // Colocar al personaje en su pueblo al empezar también es «llegar»:
      // de eso se encarga la apertura, que abre la suya.
      if (this.leer('meta.turno', 0) < 1) return;
      if (this.aqui().length) return;
      if (!this.rng.flujo('mundo').oportunidad(0.5)) return;
      const s = this.abrir();
      if (s) this.emitir('narrative:direct', { texto: s.texto, voz: 'dm' });
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONSULTAS
     ═══════════════════════════════════════════════════════════════════════ */

  /** @returns {Object[]} */
  todas() {
    const s = this.leer('world.situaciones', null) ?? { porId: {}, orden: [] };
    return (s.orden ?? []).map((id) => s.porId?.[id]).filter(Boolean);
  }

  /** Las abiertas donde está el jugador. @returns {Object[]} */
  aqui() {
    const lugar = this.leer('world.ubicacion');
    return this.todas().filter((s) => s.lugar === lugar && s.estado === ESTADO_SITUACION.ABIERTA);
  }

  /**
   * Sustituye {clave} por el nombre de cada actor.
   * @param {string} texto
   * @param {Object} situacion
   * @returns {string}
   */
  rellenar(texto, situacion) {
    return String(texto ?? '').replace(/\{(\w+)\}/g, (_, clave) => situacion.actores?.[clave]?.nombre ?? clave);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ABRIR
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Pone en marcha una situación donde está el jugador.
   *
   * @param {Object} [opciones]
   * @param {string} [opciones.refId] Una plantilla concreta.
   * @returns {Object|null} La situación, con `texto` ya relleno.
   */
  abrir({ refId = null } = {}) {
    const lugarId = this.leer('world.ubicacion');
    const lugar = obtenerLugar(lugarId);
    const flujo = this.rng.flujo('mundo');

    // No se repite una plantilla en el mismo sitio.
    const usadas = new Set(this.todas().filter((s) => s.lugar === lugarId).map((s) => s.refId));
    const plantilla = refId
      ? obtenerSituacion(refId)
      : flujo.elegir(situacionesPara(lugar).filter((p) => !usadas.has(p.refId)));
    if (!plantilla) return null;

    const npcs = this.sistema('npcs');
    const actores = {};
    for (const a of plantilla.actores) {
      const genero = a.genero ?? (flujo.oportunidad(0.5) ? 'f' : 'm');
      const nombre = this._nombreLibre(genero, flujo);
      const npc = npcs?.introducir?.({ nombre, rol: a.rol, genero }) ?? null;
      actores[a.clave] = { refId: npc?.refId ?? null, nombre: npc?.nombre ?? nombre, rol: a.rol, genero };
    }

    const turno = this.leer('meta.turno', 0);
    const situacion = {
      id: `sit_${plantilla.refId}_${lugarId}_${turno}`,
      refId: plantilla.refId,
      lugar: lugarId,
      actores,
      estado: ESTADO_SITUACION.ABIERTA,
      turnoInicio: turno,
      ultimaAtencion: turno,
      ignoradaAProposito: false,
      intentos: 0,
      resolucion: null,
    };
    this._guardar(situacion);

    this.emitir('memory:remember', { texto: this.rellenar(plantilla.agenda, situacion), peso: 1, categoria: 'situacion' });
    return { ...situacion, texto: this.rellenar(plantilla.apertura, situacion) };
  }

  /** Un nombre que no sea ya de nadie conocido. @private */
  _nombreLibre(genero, flujo) {
    const azar = () => flujo.next();
    let nombre = nombreAleatorio('valdes', genero, azar);
    for (let i = 0; i < 6; i += 1) {
      const refId = `npc_${nombre.toLowerCase().replace(/\s+/g, '_')}`;
      if (!this.leer(`npcs.conocidos.porId.${refId}`)) return nombre;
      nombre = nombreAleatorio('valdes', genero, azar);
    }
    return nombre;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     EL JUGADOR ACTÚA
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Mira si lo que escribe el jugador tiene que ver con una situación de aquí.
   *
   * @param {string} texto
   * @returns {null | {situacion: Object, omitida?: boolean, via?: string,
   *   tirada?: Object, narracion?: string, resuelta?: boolean}}
   */
  intervenir(texto) {
    const sit = this.aqui()[0];
    if (!sit) return null;

    const plantilla = obtenerSituacion(sit.refId);
    if (!plantilla) return null;

    const n = llano(texto);
    const nombrados = Object.values(sit.actores).some((a) => a.nombre && n.includes(llano(a.nombre)));
    const menciona = nombrados || plantilla.claves.test(n) || ATIENDE.test(n);
    if (!menciona) return null;

    // Dejarla de lado a propósito: sigue ahí, con su reloj en marcha. No es
    // una manera de resolverla ni una falta que haya que cobrar.
    if (OMITE.test(n)) {
      this._guardar({ ...sit, ignoradaAProposito: true });
      return { situacion: sit, omitida: true };
    }

    this._atendida = sit.id;
    const turno = this.leer('meta.turno', 0);
    const via = plantilla.vias.find((v) => v.patron.test(n));

    if (!via) {
      // Mirar de cerca también cuenta, y se ve algo que no se veía de lejos.
      this._guardar({ ...sit, ultimaAtencion: turno, ignoradaAProposito: false });
      return { situacion: sit, atencion: true, narracion: this.rellenar(plantilla.detalle ?? '', sit) };
    }

    const tirada = this.sistema('rules')?.resolver({ habilidad: via.habilidad, umbral: via.umbral }) ?? null;
    const exito = Boolean(tirada?.exito);
    const narracion = this.rellenar(exito ? via.exito : via.fracaso, sit);

    const resuelta = exito && Boolean(via.resuelveSiExito);
    this._guardar({
      ...sit,
      ultimaAtencion: turno,
      ignoradaAProposito: false,
      intentos: (sit.intentos ?? 0) + 1,
      estado: resuelta ? ESTADO_SITUACION.RESUELTA : sit.estado,
      resolucion: resuelta ? via.clave : sit.resolucion,
    });

    if (exito) this._consecuencias(sit, via);
    return { situacion: sit, via: via.clave, tirada, narracion, resuelta };
  }

  /** Actitudes y recuerdos de cada actor tras una vía que sale bien. @private */
  _consecuencias(sit, via) {
    const relaciones = this.sistema('relationships');
    const npcs = this.sistema('npcs');

    for (const [clave, delta] of Object.entries(via.actitud ?? {})) {
      const actor = sit.actores[clave];
      if (actor?.refId) relaciones?.ajustar?.(actor.refId, delta, via.recuerdo?.[clave] ?? via.clave);
    }
    for (const [clave, recuerdo] of Object.entries(via.recuerdo ?? {})) {
      const actor = sit.actores[clave];
      if (!actor?.refId) continue;
      npcs?.recordar?.(actor.refId, recuerdo, { tipo: 'situacion', peso: 3 });
      this.emitir('memory:remember', { texto: `${actor.nombre} (${actor.rol}): ${recuerdo}`, peso: 3, categoria: 'situacion' });
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     EL MUNDO SIGUE
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Al final de cada turno, lo que nadie atendió avanza.
   *
   * El reloj corre desde la última vez que el jugador se fijó en ella, esté
   * donde esté: una situación que dejó atrás al irse del pueblo también se
   * resuelve sin él, y se entera si vuelve.
   */
  alTurno() {
    const turno = this.leer('meta.turno', 0);
    const aqui = this.leer('world.ubicacion');

    for (const sit of this.todas()) {
      if (sit.estado !== ESTADO_SITUACION.ABIERTA || sit.id === this._atendida) continue;

      const plantilla = obtenerSituacion(sit.refId);
      const regla = plantilla?.siIgnorada;
      if (!regla || turno - sit.ultimaAtencion < regla.tras) continue;

      this._guardar({ ...sit, estado: ESTADO_SITUACION.DESENLACE, turnoDesenlace: turno });
      this.emitir('memory:remember', { texto: this.rellenar(regla.hecho, sit), peso: 2, categoria: 'situacion' });

      // Si pasa delante de él, se cuenta en el turno siguiente.
      if (sit.lugar === aqui) {
        this.emitir('memory:context', { texto: `EN ESCENA: ${this.rellenar(regla.texto, sit)}`, temporal: true });
      }
    }

    this._atendida = null;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PARA EL DIRECTOR
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * La situación abierta de aquí, para el contexto del director.
   * @returns {Object|null}
   */
  paraContexto() {
    const sit = this.aqui()[0];
    if (!sit) return null;
    const plantilla = obtenerSituacion(sit.refId);
    if (!plantilla) return null;

    return {
      id: sit.id,
      texto: this.rellenar(plantilla.apertura, sit),
      agenda: this.rellenar(plantilla.agenda, sit),
      actores: Object.values(sit.actores).map((a) => ({ nombre: a.nombre, rol: a.rol })),
      sinAtender: this.leer('meta.turno', 0) - sit.ultimaAtencion,
      ignoradaAProposito: Boolean(sit.ignoradaAProposito),
      sugerencia: plantilla.sugerencia ?? null,
    };
  }

  /**
   * La misma situación en prosa, para el prompt de un modelo.
   * @returns {string}
   */
  paraDirector() {
    const c = this.paraContexto();
    if (!c) return '';
    const lineas = [`SITUACIÓN EN MARCHA AQUÍ (no es una misión; el jugador puede ignorarla): ${c.texto}`, `Lo que quiere cada uno: ${c.agenda}`];
    if (c.ignoradaAProposito) lineas.push('El jugador ha decidido no meterse. Respétalo: sigue su curso sin él y sin castigarle por ello.');
    return lineas.join('\n');
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ESTADO
     ═══════════════════════════════════════════════════════════════════════ */

  /** @private */
  _guardar(situacion) {
    this.despachar('situaciones/guardar', { situacion });
  }

  /** @private */
  _reducirGuardar(estado, accion) {
    const { situacion } = accion.payload ?? {};
    if (!situacion?.id) return null;
    const actual = estado.world?.situaciones ?? { porId: {}, orden: [] };
    const orden = (actual.orden ?? []).includes(situacion.id) ? actual.orden : [...(actual.orden ?? []), situacion.id];
    return { world: { situaciones: { porId: { ...(actual.porId ?? {}), [situacion.id]: situacion }, orden } } };
  }

  inspeccionar() {
    return { situaciones: this.todas().map((s) => `${s.refId}@${s.lugar}:${s.estado}`) };
  }
}

export default SituationSystem;
