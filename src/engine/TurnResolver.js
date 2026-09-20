/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · engine/TurnResolver.js
 * ---------------------------------------------------------------------------
 * El bucle de turno. Aquí converge todo el motor.
 *
 * Secuencia completa, en orden:
 *
 *   1. Se recibe la acción del jugador
 *   2. IntentParser deduce qué pretende
 *   3. RulesEngine TIRA LOS DADOS y decide el resultado
 *   4. ContextComposer arma el contexto con ese resultado dentro
 *   5. El proveedor narra lo que ya está decidido
 *   6. ResponseSchema valida y repara la respuesta
 *   7. EffectApplier aplica lo permitido, recorta el resto
 *   8. Clock avanza el mundo
 *   9. MemoryStore recuerda lo ocurrido
 *
 * El orden importa. Los dados se tiran en el paso 3, antes de que el director
 * exista en la ecuación. Ningún modelo de lenguaje puede hacer que aciertes
 * cuando has fallado.
 *
 * Garantía adicional: un turno nunca deja el estado a medias. Si algo falla,
 * se restaura y se entrega un turno mínimo jugable.
 *
 * Dependencias: SystemBase y prácticamente todo el motor.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SystemBase } from '../core/SystemBase.js';
import { interpretar, tipoDeTurno, COMANDOS } from './IntentParser.js';
import { validarRespuesta } from '../ai/ResponseSchema.js';
import { MemoryStore } from '../ai/MemoryStore.js';
import { ContextComposer } from '../ai/ContextComposer.js';
import { ProceduralProvider } from '../ai/providers/ProceduralProvider.js';
import { PROVEEDORES } from '../config/ai.config.js';
import { LIMITES, TIEMPOS } from '../config/app.config.js';
import { DIRECCION } from '../config/balance.config.js';
import { VOCES } from '../config/ui.config.js';
import { idEntidad, TIPO } from '../utils/id.js';
import { evaluar } from '../core/Dice.js';

/** Eventos del ciclo de turno. */
export const EVENTOS_TURNO = Object.freeze({
  INICIO: 'turn:start',
  PENSANDO: 'turn:thinking',
  RESUELTO: 'turn:resolved',
  FIN: 'turn:end',
  ERROR: 'turn:error',
  BLOQUEADO: 'turn:blocked',
});

export class TurnResolver extends SystemBase {
  static nombre = 'turns';
  static dependencias = ['clock', 'player', 'inventory', 'rules', 'effects'];
  static canal = 'engine';

  constructor(contexto) {
    super(contexto);

    /** @type {MemoryStore} */
    this.memoria = new MemoryStore();

    /** @type {ContextComposer|null} @private */
    this._compositor = null;

    /** Proveedor de respaldo, si no hay coordinador. @private */
    this._respaldo = null;

    /** true mientras hay un turno resolviéndose. @private */
    this._ocupado = false;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CICLO DE VIDA
     ═══════════════════════════════════════════════════════════════════════ */

  alIniciar() {
    this._compositor = new ContextComposer({
      store: this.store,
      registry: this.registry,
      memoria: this.memoria,
    });

    this.reductores({
      'narrative/anadir': this._reducirAnadirEntrada,
      'narrative/opciones': this._reducirOpciones,
      'narrative/limpiar': this._reducirLimpiar,
    });

    // Toda acción del jugador entra por aquí, venga de donde venga.
    this.escuchar('ui:action:submit', ({ texto, intencion, opcionId, origen }) => {
      this.procesar(texto, { intencionSugerida: intencion, opcionId, origen });
    });

    // Narración directa de otros sistemas: combate, mundo, comercio.
    this.escuchar('narrative:direct', ({ texto, voz }) => {
      this._anadirEntrada(voz ?? VOCES.SISTEMA, texto, {});
    });

    // Al empezar partida, la memoria se vacía.
    this.escuchar('player:created', () => {
      this.memoria.limpiar();
      // La historia libre no es decoración del prompt: nace como hilo real de
      // memoria incluso con el director procedural y sobrevive a los turnos.
      const lore = String(this.leer('player.lore', '') ?? '').trim();
      if (lore) {
        this.memoria.abrirHilo({
          tipo: 'misterio',
          texto: `Historia pendiente del personaje: ${lore}`,
          turno: 0,
          relacionadoCon: 'player_lore',
        });
      }
      this.store.fijar('ai.memoria', this.memoria.serializar());
    });

    // El director abre la crónica cuando la partida arranca.
    this.escuchar('game:open', () => this.abrirCronica());

    // Los hechos y hilos que publican otros sistemas van a la memoria.
    this.escuchar('memory:remember', ({ texto, peso }) => {
      this.memoria.recordar(texto, { turno: this.leer('meta.turno', 0), peso });
    });

    this.escuchar('memory:thread', (datos) => {
      this.memoria.abrirHilo({ ...datos, turno: this.leer('meta.turno', 0) });
    });
  }

  async alArrancar() {
    // Sin coordinador de directores, se usa el procedural directamente.
    this._respaldo = new ProceduralProvider({ rng: this.rng });
    this.log.info(`Director activo: ${this._idDirector()}`);
  }

  /**
   * El coordinador de directores, si está registrado.
   * @returns {Object}
   */
  get director() {
    return this.sistema('dungeonmaster') ?? this._respaldo;
  }

  /**
   * Identificador del proveedor que narra ahora.
   *
   * El coordinador lo expone como `proveedorId`; un proveedor suelto, como `id`.
   *
   * @returns {string}
   * @private
   */
  _idDirector() {
    const d = this.director;
    return d?.proveedorId ?? d?.id ?? PROVEEDORES.PROCEDURAL;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PROCESAMIENTO DE UN TURNO
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Procesa una acción del jugador de principio a fin.
   *
   * @param {string} texto
   * @param {Object} [opciones]
   * @returns {Promise<Object|null>}
   */
  async procesar(texto, opciones = {}) {
    // ─── Guardas ────────────────────────────────────────────────────────
    if (this._ocupado) {
      this.emitir(EVENTOS_TURNO.BLOQUEADO, { motivo: 'turno en curso' });
      return null;
    }

    const limpio = String(texto ?? '').trim();
    if (limpio.length < LIMITES.entradaMin) return null;

    if (this.leer('meta.fase') === 'fin') {
      this.emitir(EVENTOS_TURNO.BLOQUEADO, { motivo: 'la crónica ha terminado' });
      return null;
    }

    // ─── 1. Interpretación ──────────────────────────────────────────────
    const contextoIntencion = {
      intencionSugerida: opciones.intencionSugerida,
      enCombate: this.leer('combat.activo', false),
      npcsPresentes: this.leer('npcs.presentes', []),
    };

    const intencion = interpretar(limpio, contextoIntencion);

    // Los comandos no consumen turno.
    if (intencion.esComando) {
      return this._ejecutarComando(intencion);
    }

    this._ocupado = true;
    const numeroTurno = this.leer('meta.turno', 0) + 1;

    this.emitir(EVENTOS_TURNO.INICIO, { turno: numeroTurno, accion: limpio, intencion });
    this._bloquearEntrada(true);

    // Instantánea previa: un turno nunca deja el estado a medias.
    this.store.instantanea('turno');

    try {
      // ─── 2. La acción se registra en la bitácora ──────────────────────
      this._anadirEntrada(VOCES.JUGADOR, limpio, { turno: numeroTurno });

      // ─── 2b. Encuentro pendiente ──────────────────────────────────────
      const exploration = this.sistema('exploration');

      if (exploration?.encuentroActivo) {
        const r = await exploration.resolverEncuentro(intencion);

        if (r.resuelto && r.resultado === 'combate') {
          // El combate toma el control: este turno termina aquí.
          this.store.descartarInstantanea('turno');
          return { turno: numeroTurno, encuentro: 'combate' };
        }
      }

      // ─── 2c. Enrutado local ───────────────────────────────────────────
      const router = this.sistema('router');
      const ruta = router?.enrutar(intencion, contextoIntencion);

      if (ruta?.ruta === 'rechazada') {
        this._anadirEntrada(VOCES.SISTEMA, ruta.narracion, { turno: numeroTurno });
        this.store.descartarInstantanea('turno');
        return { turno: numeroTurno, rechazada: ruta.motivo };
      }

      if (ruta?.ruta === 'local') {
        if (ruta.narracion) this._anadirEntrada(VOCES.SISTEMA, ruta.narracion, { turno: numeroTurno });
        await this.sistema('clock').turno({ tipo: 'exploracion' });
        this.store.descartarInstantanea('turno');
        return { turno: numeroTurno, local: true };
      }

      // ─── 3. LOS DADOS, ANTES QUE EL DIRECTOR ──────────────────────────
      const rules = this.sistema('rules');
      const tirada = rules?.resolverIntencion(intencion, {
        situacion: this._situacionActual(),
      }) ?? null;

      if (tirada && this.leer('settings.mostrarTiradas', true)) {
        this._anadirEntrada(VOCES.TIRADA, '', { tirada, turno: numeroTurno });
      }

      // ─── 4. Contexto ──────────────────────────────────────────────────
      const tipo = tipoDeTurno(intencion, contextoIntencion);

      const peticion = {
        accion: limpio,
        intencion,
        tirada,
        tipo,
        turno: numeroTurno,
        contexto: this._compositor.componerEstructurado({ accion: limpio, intencion, tirada, tipo }),
        prompt: null,
      };

      // Los proveedores basados en modelos necesitan el contexto como prosa.
      if (this.director && this._idDirector() !== PROVEEDORES.PROCEDURAL) {
        const compuesto = this._compositor.componer({ accion: limpio, intencion, tirada, tipo });
        peticion.prompt = compuesto.texto;
        peticion.caracteres = compuesto.caracteres;
      }

      // La pista del enrutador se añade al contexto del director.
      if (ruta?.pistaDirector) {
        peticion.contexto.pistaRuta = ruta.pistaDirector;
      }

      // ─── 5. El director narra ─────────────────────────────────────────
      const temporizadorPensando = setTimeout(() => {
        this.emitir(EVENTOS_TURNO.PENSANDO, { turno: numeroTurno });
      }, TIEMPOS.pensandoUmbral);

      let resultado;
      try {
        resultado = await this.director.dirigir(peticion);
      } finally {
        clearTimeout(temporizadorPensando);
        this.emitir(EVENTOS_TURNO.PENSANDO, { turno: numeroTurno, terminado: true });
      }

      // ─── 6. Validación ────────────────────────────────────────────────
      const validacion = validarRespuesta(resultado.respuesta);

      if (!validacion.valida) {
        this.log.aviso('respuesta del director inválida; se usa el turno mínimo', validacion.fallos);
        resultado.respuesta = this.director.turnoMinimo(peticion, 'respuesta inválida');
        resultado.degradado = true;
      } else {
        resultado.respuesta = validacion.respuesta;
      }

      // ─── 7. Saneado y aplicación ──────────────────────────────────────
      const effects = this.sistema('effects');
      const { respuesta: saneada, retirado } = effects.sanear(resultado.respuesta);

      const aplicacion = effects.aplicar(saneada, {
        turno: numeroTurno,
        hitoNarrativo: this._esHito(saneada),
      });

      // ─── 8. Narración a la bitácora ───────────────────────────────────
      if (saneada.sceneBreak) this._cortarEscena();

      this._anadirEntrada(VOCES.DM, saneada.story, {
        turno: numeroTurno,
        escenaAbierta: this.leer('narrative.escenaAbierta', true),
        mood: saneada.mood,
      });

      // Los eventos no silenciosos se narran aparte.
      for (const evento of saneada.events ?? []) {
        if (evento.silent) continue;
        const texto = this._describirEvento(evento);
        if (texto) this._anadirEntrada(VOCES.SISTEMA, texto, { turno: numeroTurno });
      }

      // ─── 9. Opciones ──────────────────────────────────────────────────
      this.despachar('narrative/opciones', { opciones: saneada.choices ?? [] });

      // ─── 10. Combate ──────────────────────────────────────────────────
      if (saneada.combat?.start) {
        this.emitir('combat:request', saneada.combat);
      }

      // ─── 11. Memoria ──────────────────────────────────────────────────
      this.memoria.registrarTurno({
        numero: numeroTurno,
        accion: limpio,
        narracion: saneada.story,
        mood: saneada.mood,
        tirada,
      });

      this.memoria.recordarVarios(saneada.memory ?? [], { turno: numeroTurno });

      // ─── 12. El mundo avanza ──────────────────────────────────────────
      const clock = this.sistema('clock');
      await clock.turno({ tipo: tipo === 'combate' ? 'combate' : 'exploracion' });

      // ─── 13. Mantenimiento periódico ──────────────────────────────────
      await this._mantenimiento(numeroTurno);

      // ─── Cierre ───────────────────────────────────────────────────────
      this.store.descartarInstantanea('turno');
      this.store.fijar('ai.memoria', this.memoria.serializar());

      const resumen = {
        turno: numeroTurno,
        accion: limpio,
        intencion,
        tirada,
        proveedor: resultado.proveedor,
        degradado: resultado.degradado,
        ajustes: aplicacion.ajustes,
        retirado,
        avisos: resultado.avisos,
      };

      this.emitir(EVENTOS_TURNO.RESUELTO, resumen);

      // Un director degradado se avisa una sola vez, sin insistir.
      if (resultado.degradado && this._idDirector() !== PROVEEDORES.PROCEDURAL) {
        this.emitir('ui:notice', {
          mensaje: 'El director externo no respondió; continúa el director interno',
          tipo: 'aviso',
        });
      }

      return resumen;

    } catch (e) {
      // Un fallo en cualquier punto restaura el estado previo.
      this.store.restaurar('turno');
      this.log.error('fallo al resolver el turno', e);

      this._anadirEntrada(VOCES.SISTEMA, 'Algo se ha torcido. El momento pasa sin consecuencias.', {
        turno: numeroTurno,
      });

      this.emitir(EVENTOS_TURNO.ERROR, { turno: numeroTurno, error: e?.message });
      return null;

    } finally {
      this._ocupado = false;
      this._bloquearEntrada(false);
      this.emitir(EVENTOS_TURNO.FIN, { turno: numeroTurno });
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     MANTENIMIENTO PERIÓDICO
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Tareas que no toca hacer cada turno: resúmenes y ajuste de dificultad.
   * @param {number} turno
   * @private
   */
  async _mantenimiento(turno) {
    // ─── Resumen de capítulo ────────────────────────────────────────────
    if (this.memoria.tocaResumir(turno)) {
      const turnos = this.memoria.turnosParaResumir();

      if (turnos.length) {
        let texto = null;

        // Se pide al proveedor; si no puede, se usa el resumen mecánico.
        try {
          texto = await this.director?.resumir?.(turnos);
        } catch {
          texto = null;
        }

        if (!texto) texto = this.memoria.resumenMecanico(turnos);

        if (texto) {
          this.memoria.guardarResumen(texto, turnos[0].turno, turno);
        }
      }
    }

    // ─── Dificultad adaptativa ──────────────────────────────────────────
    if (turno % DIRECCION.ventanaAnalisis === 0) {
      const rules = this.sistema('rules');
      rules?.revisarDificultad();
    }

    // ─── Turnos sin tensión ─────────────────────────────────────────────
    const enCombate = this.leer('combat.activo', false);
    const sinTension = this.leer('world.turnosSinTension', 0);

    this.store.fijar('world.turnosSinTension', enCombate ? 0 : sinTension + 1);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     COMANDOS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Ejecuta un comando sin consumir turno.
   * @param {Object} intencion
   * @returns {Object}
   * @private
   */
  _ejecutarComando(intencion) {
    const { comando, argumentos } = intencion;

    switch (comando) {
      case '/dado': {
        const notacion = argumentos[0] ?? '1d20';
        try {
          const r = evaluar(this.rng.dados, notacion);
          this._anadirEntrada(VOCES.TIRADA, `${notacion} → ${r.total} [${r.dados.join(', ')}]`, {});
        } catch {
          this._anadirEntrada(VOCES.SISTEMA, `Notación no válida: ${notacion}`, {});
        }
        break;
      }

      case '/estado': {
        const player = this.sistema('player');
        const estado = player?.estadoNarrativo() ?? '';
        const jugador = this.leer('player');
        this._anadirEntrada(VOCES.SISTEMA,
          `${jugador.nombre}, nivel ${jugador.nivel}. Vida ${jugador.vida.actual}/${jugador.vida.max}. Está ${estado}.`, {});
        break;
      }

      case '/inventario':
        this.emitir('ui:drawer:open', { lado: 'izquierdo' });
        break;

      case '/misiones':
      case '/mapa':
        this.emitir('ui:drawer:open', { lado: 'derecho' });
        break;

      case '/guardar':
        this.emitir('game:save', { ranura: 'auto' });
        break;

      case '/ayuda': {
        const lineas = Object.entries(COMANDOS).map(([c, d]) => `${c} — ${d.descripcion}`);
        this._anadirEntrada(VOCES.SISTEMA, lineas.join('\n'), {});
        break;
      }
    }

    return { comando, ejecutado: true };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     BITÁCORA
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Añade una entrada a la bitácora narrativa.
   * @param {string} voz
   * @param {string} texto
   * @param {Object} meta
   * @private
   */
  _anadirEntrada(voz, texto, meta = {}) {
    this.despachar('narrative/anadir', {
      entrada: {
        id: idEntidad(TIPO.ENTRADA),
        voz,
        texto,
        meta,
        turno: meta.turno ?? this.leer('meta.turno', 0),
      },
    });
  }

  /** @private */
  _cortarEscena() {
    this.store.fijar('narrative.escenaAbierta', true);
    this.emitir('narrative:sceneBreak', {});
  }

  /** @private */
  _reducirAnadirEntrada(estado, accion) {
    const { entrada } = accion.payload ?? {};
    if (!entrada) return null;

    const entradas = [...estado.narrative.entradas, entrada];

    // La bitácora se poda en el estado, no solo en el DOM.
    const podadas = entradas.length > LIMITES.narrativaMax * 2
      ? entradas.slice(-LIMITES.narrativaMax)
      : entradas;

    return {
      narrative: {
        entradas: podadas,
        escenaAbierta: entrada.voz === 'dm' ? false : estado.narrative.escenaAbierta,
      },
    };
  }

  /** @private */
  _reducirOpciones(estado, accion) {
    return { narrative: { opciones: accion.payload?.opciones ?? [] } };
  }

  /** @private */
  _reducirLimpiar() {
    return { narrative: { entradas: [], opciones: [], escenaAbierta: true } };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     AUXILIARES
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Situación circunstancial que modifica las tiradas.
   * @returns {string}
   * @private
   */
  _situacionActual() {
    const jugador = this.leer('player');

    // Estar al límite de vida es una situación adversa por sí misma.
    const fraccionVida = (jugador.vida?.actual ?? 1) / (jugador.vida?.max ?? 1);
    if (fraccionVida <= 0.2) return 'adversa';

    return 'neutra';
  }

  /**
   * Determina si un turno constituye un hito narrativo.
   *
   * Los hitos permiten al director conceder objetos de rareza alta. Se
   * reconocen por lo que ocurre, no por lo que el director diga que ocurre.
   *
   * @param {Object} respuesta
   * @returns {boolean}
   * @private
   */
  _esHito(respuesta) {
    if (respuesta.quests?.some((q) => q.action === 'complete')) return true;
    if (respuesta.sceneBreak) return true;

    const xp = respuesta.playerUpdates?.xp;
    const delta = typeof xp === 'object' ? xp.delta : xp;
    if (typeof delta === 'number' && delta >= 300) return true;

    return false;
  }

  /**
   * Traduce un evento del mundo a texto para la bitácora.
   * @param {Object} evento
   * @returns {string|null}
   * @private
   */
  _describirEvento(evento) {
    switch (evento.type) {
      case 'weather':
        return evento.payload?.descripcion ?? null;
      case 'discovery':
        return evento.payload?.texto ?? 'Has descubierto algo.';
      case 'npc_meet':
        return null;   // Ya viene narrado dentro de la historia.
      case 'faction':
        return evento.payload?.texto ?? null;
      default:
        return null;
    }
  }

  /**
   * @param {boolean} bloqueada
   * @private
   */
  _bloquearEntrada(bloqueada) {
    this.store.fijar('ui.entradaBloqueada', bloqueada);
    this.store.fijar('ui.pensando', bloqueada);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     API PÚBLICA
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Arranca la crónica con un turno de apertura.
   *
   * Se invoca tras crear el personaje. No hay acción del jugador: el director
   * abre la escena.
   *
   * @returns {Promise<void>}
   */
  async abrirCronica() {
    if (this._ocupado) return;

    this._ocupado = true;
    this._bloquearEntrada(true);

    try {
      const peticion = {
        accion: '',
        intencion: { tipo: 'custom', requiereTirada: false, confianza: 1 },
        tirada: null,
        tipo: 'narracion',
        turno: 1,
        contexto: this._compositor.componerEstructurado({ accion: '', tipo: 'narracion' }),
      };

      if (this._idDirector() !== PROVEEDORES.PROCEDURAL) {
        const compuesto = this._compositor.componer({ accion: '', tipo: 'narracion' });
        peticion.prompt = `${compuesto.texto}\n\nESTE ES EL PRIMER TURNO. Abre la crónica situando al personaje en un lugar concreto, con algo que reclame su atención de inmediato.`;
      }

      const resultado = await this.director.dirigir(peticion);
      const validacion = validarRespuesta(resultado.respuesta);
      const respuesta = validacion.valida ? validacion.respuesta : resultado.respuesta;

      this._anadirEntrada(VOCES.DM, respuesta.story, { turno: 1, escenaAbierta: true });
      this.despachar('narrative/opciones', { opciones: respuesta.choices ?? [] });

      this.memoria.registrarTurno({
        numero: 1,
        accion: '(inicio)',
        narracion: respuesta.story,
        mood: respuesta.mood,
      });

      this.store.fijar('meta.fase', 'exploracion');

    } finally {
      this._ocupado = false;
      this._bloquearEntrada(false);
    }
  }

  /** @returns {boolean} */
  get ocupado() {
    return this._ocupado;
  }

  /**
   * Estado serializable de la memoria del director.
   * @returns {Object}
   */
  serializar() {
    return { memoria: this.memoria.serializar() };
  }

  /** @param {Object} datos */
  restaurar(datos) {
    if (datos?.memoria) Object.assign(this.memoria, datos.memoria);
  }

  /**
   * Estado del resolutor, para depuración.
   * @returns {Object}
   */
  inspeccionar() {
    return {
      ocupado: this._ocupado,
      turno: this.leer('meta.turno', 0),
      director: this.director?.inspeccionar() ?? null,
      memoria: this.memoria.inspeccionar(),
    };
  }
}

export default TurnResolver;
