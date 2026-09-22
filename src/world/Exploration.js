/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · world/Exploration.js
 * ---------------------------------------------------------------------------
 * Exploración y encuentros.
 *
 * Distingue tres acciones que suelen confundirse:
 *
 *   · EXPLORAR — avanzar mirando. Barato, rápido, poco fructífero.
 *   · REGISTRAR — buscar a fondo en un sitio concreto. Cuesta tiempo y una
 *     prueba, pero es lo único que encuentra lo escondido.
 *   · DESCUBRIR — dar con un lugar nuevo. Consecuencia de lo anterior.
 *
 * La distinción importa porque tres lugares del mapa SOLO aparecen registrando.
 * No salen en ningún rumor ni los menciona nadie. Quien no se moleste en buscar
 * no los verá nunca, y eso hace que buscar tenga sentido.
 *
 * También gestiona la resolución de encuentros, que es donde se cumple la
 * promesa de que hablar vale más que pelear.
 *
 * Dependencias: SystemBase, EncounterTables, MapGraph, Location.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SystemBase } from '../core/SystemBase.js';
import * as Tablas from './EncounterTables.js';
import * as Mapa from './MapGraph.js';
import { obtenerLugar } from '../data/locations.data.js';

/** Eventos publicados. */
export const EVENTOS_EXPLORACION = Object.freeze({
  ENCUENTRO: 'exploration:encounter',
  RESUELTO: 'exploration:resolved',
  DESCUBRIMIENTO: 'exploration:discovery',
  NADA: 'exploration:nothing',
});

export class Exploration extends SystemBase {
  static nombre = 'exploration';
  static dependencias = ['world', 'rules', 'clock'];
  static canal = 'world';

  constructor(contexto) {
    super(contexto);

    /**
     * Encuentro pendiente de resolver.
     * @type {Object|null}
     * @private
     */
    this._encuentro = null;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CICLO DE VIDA
     ═══════════════════════════════════════════════════════════════════════ */

  alIniciar() {
    // El viaje delega aquí sus encuentros.
    this.escuchar('exploration:encounter:trigger', ({ encuentro, contexto }) => {
      this._presentar(encuentro, contexto);
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     EXPLORAR
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Explorar: avanzar mirando alrededor.
   *
   * Barato en tiempo, poco fructífero. Sube algo el grado de exploración del
   * lugar y puede producir un encuentro.
   *
   * @returns {Promise<Object>}
   */
  async explorar() {
    const refId = this.leer('world.ubicacion');
    const lugar = obtenerLugar(refId);
    const flujo = this.rng.flujo('mundo');

    // ─── Tiempo ─────────────────────────────────────────────────────────
    this.sistema('clock')?.avanzarTiempo(30, 'exploracion');

    // ─── Progreso ───────────────────────────────────────────────────────
    this.despachar('world/explorar', { refId, cantidad: 0.12 });

    // ─── Encuentro ──────────────────────────────────────────────────────
    const peligro = lugar?.peligro ?? 1;
    const efectos = this.sistema('events')?.efectos() ?? {};

    const probabilidad = Math.min(0.35, (peligro + (efectos.peligroRutas ?? 0)) * 0.07);

    if (flujo.oportunidad(probabilidad)) {
      const encuentro = this.generarEncuentro({ terreno: lugar?.terreno, peligro });

      if (encuentro) {
        this._presentar(encuentro, { terreno: lugar?.terreno });
        return { tipo: 'encuentro', encuentro };
      }
    }

    // ─── Hallazgo menor ─────────────────────────────────────────────────
    // Explorar sin más rara vez encuentra algo, pero no nunca.
    if (flujo.oportunidad(0.15)) {
      return this._hallazgoMenor(flujo);
    }

    // ─── Nada ───────────────────────────────────────────────────────────
    this.emitir(EVENTOS_EXPLORACION.NADA, { accion: 'explorar' });

    return {
      tipo: 'nada',
      pistaDirector: 'El personaje avanza y observa sin encontrar nada relevante. Describe el entorno, no un hallazgo.',
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     REGISTRAR
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Registrar: buscar a fondo.
   *
   * Cuesta una hora y requiere una prueba de percepción. Es la única vía para
   * encontrar los lugares ocultos y lo que no está a la vista.
   *
   * @returns {Promise<Object>}
   */
  async registrar() {
    const refId = this.leer('world.ubicacion');
    const lugar = obtenerLugar(refId);
    const flujo = this.rng.flujo('mundo');

    const estado = this.leer(`world.localizaciones.porId.${refId}`);

    // ─── ¿Queda algo? ───────────────────────────────────────────────────
    // Decirlo evita que el jugador pierda tiempo buscando en un sitio agotado.
    if ((estado?.exploracion ?? 0) >= 1) {
      return {
        tipo: 'agotado',
        pistaDirector: 'El personaje ya ha registrado este sitio a fondo. No queda nada por encontrar y él lo sabe.',
      };
    }

    // ─── Tiempo ─────────────────────────────────────────────────────────
    this.sistema('clock')?.avanzarTiempo(60, 'registro');

    // ─── Prueba ─────────────────────────────────────────────────────────
    const rules = this.sistema('rules');

    const tirada = rules.resolver({
      habilidad: 'percepcion',
      umbral: this._umbralRegistro(lugar, estado),
      situacion: 'neutra',
    });

    this.despachar('world/explorar', { refId, cantidad: tirada.exito ? 0.35 : 0.15 });

    if (!tirada.exito) {
      return {
        tipo: 'fallo',
        tirada,
        pistaDirector: 'El personaje busca sin encontrar nada. Que se note el esfuerzo y el tiempo perdido.',
      };
    }

    // ─── Éxito: qué se encuentra ────────────────────────────────────────
    return this._resolverHallazgo(flujo, lugar, estado, tirada);
  }

  /**
   * Umbral de la prueba de registro.
   *
   * Sube conforme el lugar está más explorado: lo fácil ya se encontró.
   *
   * @private
   */
  _umbralRegistro(lugar, estado) {
    const base = 12;
    const yaExplorado = (estado?.exploracion ?? 0) * 8;
    const porPeligro = (lugar?.peligro ?? 0);

    return Math.round(base + yaExplorado + porPeligro);
  }

  /**
   * Decide qué se encuentra al registrar con éxito.
   *
   * Prioridad: lugar oculto > sublugar > gancho > botín. Los lugares son lo más
   * valioso y lo más raro.
   *
   * @private
   */
  _resolverHallazgo(flujo, lugar, estado, tirada) {
    // ─── 1. Lugar oculto ────────────────────────────────────────────────
    const oculto = this._buscarLugarOculto(lugar);

    if (oculto && tirada.margen >= 3) {
      this.despachar('world/descubrir', { refId: oculto.refId, motivo: 'exploracion' });

      this.emitir(EVENTOS_EXPLORACION.DESCUBRIMIENTO, {
        refId: oculto.refId,
        nombre: oculto.nombre,
        motivo: 'exploracion',
      });

      return {
        tipo: 'lugar',
        lugar: oculto.refId,
        tirada,
        pistaDirector: `El personaje encuentra el camino a ${oculto.nombre}. ${oculto.promptLore} Ya está en su mapa.`,
      };
    }

    // ─── 2. Sublugar no visto ───────────────────────────────────────────
    const sublugares = lugar?.sublugares ?? [];
    const vistos = new Set(estado?.sublugaresVistos ?? []);
    const nuevo = sublugares.find((s) => !vistos.has(s.refId));

    if (nuevo) {
      this.despachar('world/sublugar/ver', { refId: lugar.refId, sublugar: nuevo.refId });

      return {
        tipo: 'sublugar',
        sublugar: nuevo.refId,
        tirada,
        pistaDirector: `El personaje encuentra ${nuevo.nombre}. Descríbelo al entrar.`,
      };
    }

    // ─── 3. Gancho del lugar ────────────────────────────────────────────
    const world = this.sistema('world');
    const ganchos = world?.ganchosDisponibles() ?? [];

    if (ganchos.length && flujo.oportunidad(0.5)) {
      const gancho = flujo.elegir(ganchos);
      world?.usarGancho(gancho);

      this.emitir('memory:thread', {
        tipo: 'misterio',
        texto: gancho,
        relacionadoCon: lugar?.refId,
      });

      return {
        tipo: 'gancho',
        gancho,
        tirada,
        pistaDirector: `Registrando, el personaje da con esto: ${gancho}. Preséntalo como un hallazgo concreto, no como un rumor.`,
      };
    }

    // ─── 4. Botín ───────────────────────────────────────────────────────
    return this._hallazgoMenor(flujo, tirada);
  }

  /**
   * Busca un lugar oculto conectado al actual.
   * @private
   */
  _buscarLugarOculto(lugar) {
    const conocidos = new Set(this.leer('world.localizaciones.orden', []));

    const candidatos = (lugar?.conexiones ?? [])
      .map((c) => obtenerLugar(c.hasta))
      .filter((l) => l && !conocidos.has(l.refId))
      .filter((l) => l.descubrimiento === 'exploracion');

    return candidatos[0] ?? null;
  }

  /**
   * Genera un hallazgo pequeño: algo de valor, no gran cosa.
   * @private
   */
  _hallazgoMenor(flujo, tirada = null) {
    const lugar = obtenerLugar(this.leer('world.ubicacion'));

    const botin = this.sistema('inventory');

    // Un poco de oro o un objeto común: suficiente para que buscar no sea
    // nunca del todo inútil.
    if (flujo.oportunidad(0.5)) {
      const oro = flujo.entero(3, 15 + (lugar?.peligro ?? 0) * 5);
      this.despachar('inventory/oro', { delta: oro, motivo: 'hallazgo' });

      return {
        tipo: 'oro',
        cantidad: oro,
        tirada,
        pistaDirector: `El personaje encuentra ${oro} de oro. Que tenga una procedencia verosímil.`,
      };
    }

    return {
      tipo: 'menor',
      tirada,
      pistaDirector: 'El personaje encuentra algo de poco valor pero que encaja con el sitio. Decide tú qué es.',
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ENCUENTROS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Genera un encuentro adecuado al contexto.
   *
   * @param {Object} contexto
   * @returns {Object|null}
   */
  generarEncuentro(contexto) {
    const flujo = this.rng.flujo('mundo');
    return Tablas.elegir(flujo, contexto);
  }

  /**
   * Presenta un encuentro y espera la reacción del jugador.
   *
   * @param {Object} encuentro
   * @param {Object} [contexto]
   * @private
   */
  _presentar(encuentro, contexto = {}) {
    this._encuentro = {
      ...encuentro,
      contexto,
      turnoInicio: this.leer('meta.turno', 0),
    };

    this.emitir(EVENTOS_EXPLORACION.ENCUENTRO, {
      refId: encuentro.refId,
      nombre: encuentro.nombre,
      familia: encuentro.familia,
      resoluciones: encuentro.resolucionesPosibles,
    });

    this.emitir('narrative:direct', { texto: encuentro.apertura, voz: 'system' });

    // El director recibe el contexto para desarrollarlo.
    this.emitir('memory:context', {
      texto: `ENCUENTRO EN CURSO: ${encuentro.promptDirector} Vías posibles: ${encuentro.resolucionesPosibles.join(', ')}.`,
      temporal: true,
    });
  }

  /**
   * Resuelve el encuentro pendiente según lo que hace el jugador.
   *
   * @param {Object} intencion
   * @returns {Promise<Object>}
   */
  async resolverEncuentro(intencion) {
    if (!this._encuentro) {
      return { resuelto: false, motivo: 'no hay encuentro' };
    }

    const encuentro = this._encuentro;

    // ─── ¿Qué vía intenta? ──────────────────────────────────────────────
    const resolucion = Tablas.resolucionDesdeIntencion(intencion, encuentro);

    if (!resolucion) {
      // La acción no encaja con ninguna vía: el director la narra, pero el
      // encuentro sigue abierto.
      return {
        resuelto: false,
        motivo: 'via_no_contemplada',
        pistaDirector: 'Lo que intenta el personaje no resuelve la situación. Narra el intento y deja el encuentro abierto.',
      };
    }

    // ─── Combate ────────────────────────────────────────────────────────
    if (resolucion === 'combate') {
      this._encuentro = null;

      if (encuentro.combate) {
        this.emitir('combat:request', encuentro.combate);
        return { resuelto: true, resultado: 'combate' };
      }

      return {
        resuelto: true,
        resultado: 'sin_combate',
        pistaDirector: 'El personaje ataca, pero no hay contra quién pelear de verdad.',
      };
    }

    // ─── Resolución con prueba ──────────────────────────────────────────
    const requierePrueba = ['intimidacion', 'persuasion', 'engano', 'sigilo', 'huida', 'mediacion'];

    let tirada = null;

    if (requierePrueba.includes(resolucion)) {
      const habilidades = {
        intimidacion: 'intimidacion',
        persuasion: 'trato_social',
        mediacion: 'trato_social',
        engano: 'engano',
        sigilo: 'sigilo',
        huida: 'acrobacias',
      };

      tirada = this.sistema('rules').resolver({
        habilidad: habilidades[resolucion],
        umbral: this._umbralResolucion(encuentro, resolucion),
      });

      if (!tirada.exito) {
        // Fallar una vía no cierra el encuentro: se puede intentar otra cosa.
        // Salvo en los hostiles, donde fallar suele significar pelea.
        if (encuentro.familia === 'hostil' && encuentro.combate) {
          this._encuentro = null;
          this.emitir('combat:request', encuentro.combate);

          return {
            resuelto: true,
            resultado: 'combate',
            tirada,
            pistaDirector: 'El intento del personaje ha salido mal y ahora hay pelea.',
          };
        }

        return {
          resuelto: false,
          tirada,
          pistaDirector: 'El intento falla. El encuentro sigue: el personaje puede probar otra cosa.',
        };
      }
    }

    // ─── Éxito ──────────────────────────────────────────────────────────
    this._encuentro = null;

    const peligro = encuentro.peligro?.[1] ?? 1;
    const xp = Tablas.xpPorResolucion(resolucion, peligro);

    this.despachar('player/xp', { cantidad: xp, motivo: 'encuentro' });

    // Los resueltos sin violencia se cuentan aparte: alimentan las hazañas de
    // estilo y el índice de violencia.
    if (resolucion !== 'combate') {
      this.despachar('hazanas/registrar', { clave: 'conflictosResueltosSinViolencia', delta: 1 });
    }

    this.emitir(EVENTOS_EXPLORACION.RESUELTO, {
      refId: encuentro.refId,
      resolucion,
      xp,
    });

    // Las recompensas declaradas del encuentro.
    this._aplicarRecompensa(encuentro, resolucion);

    return {
      resuelto: true,
      resultado: resolucion,
      tirada,
      xp,
      pistaDirector: `El personaje resuelve la situación mediante ${resolucion}. Narra el desenlace.`,
    };
  }

  /**
   * Umbral de una vía de resolución.
   * @private
   */
  _umbralResolucion(encuentro, resolucion) {
    const peligro = encuentro.peligro?.[1] ?? 1;

    // Las vías más ventajosas son más difíciles: resolver hablando un encuentro
    // hostil debe costar más que huir.
    const dificultadExtra = {
      persuasion: 3, mediacion: 3, intimidacion: 2,
      engano: 2, sigilo: 1, huida: 0,
    };

    return 10 + peligro + (dificultadExtra[resolucion] ?? 0);
  }

  /**
   * Aplica la recompensa declarada de un encuentro.
   * @private
   */
  _aplicarRecompensa(encuentro, resolucion) {
    const r = encuentro.recompensa;
    if (!r) return;

    const flujo = this.rng.flujo('botin');

    if (r.botin) {
      this.emitir('world:loot:found', { rareza: r.rareza ?? 'comun' });
    }

    if (r.agua) {
      // Rellenar odres: se restaura la sed sin gastar el inventario.
      this.despachar('player/recurso', { clave: 'sed', delta: 60 });
    }

    if (r.descanso) {
      this.emitir('world:rest:available', { seguro: Boolean(r.seguro) });
    }

    if (r.reputacion) {
      const region = this.leer('world.region');
      this.emitir('faction:regional:adjust', { region, cantidad: r.reputacion });
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONSULTAS
     ═══════════════════════════════════════════════════════════════════════ */

  /** @returns {boolean} */
  get encuentroActivo() {
    return Boolean(this._encuentro);
  }

  /**
   * Encuentro pendiente, para la interfaz.
   * @returns {Object|null}
   */
  encuentroPendiente() {
    if (!this._encuentro) return null;

    return {
      refId: this._encuentro.refId,
      nombre: this._encuentro.nombre,
      familia: this._encuentro.familia,
      resoluciones: this._encuentro.resolucionesPosibles,
    };
  }

  /**
   * Contexto de exploración para el director.
   * @returns {string}
   */
  paraDirector() {
    if (this._encuentro) {
      return `ENCUENTRO SIN RESOLVER: ${this._encuentro.promptDirector}`;
    }

    const refId = this.leer('world.ubicacion');
    const estado = this.leer(`world.localizaciones.porId.${refId}`);

    if ((estado?.exploracion ?? 0) >= 1) {
      return 'El personaje ya ha registrado este lugar a fondo.';
    }

    return '';
  }

  /** @returns {Object} */
  serializar() {
    return { encuentro: this._encuentro };
  }

  /** @param {Object} datos */
  restaurar(datos) {
    this._encuentro = datos?.encuentro ?? null;
  }

  /** @returns {Object} */
  inspeccionar() {
    const refId = this.leer('world.ubicacion');
    const estado = this.leer(`world.localizaciones.porId.${refId}`);

    return {
      encuentroActivo: this.encuentroActivo,
      encuentro: this.encuentroPendiente(),
      exploracionAqui: estado?.exploracion ?? 0,
    };
  }
}

export default Exploration;
