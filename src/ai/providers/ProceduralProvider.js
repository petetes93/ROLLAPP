/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · ai/providers/ProceduralProvider.js
 * ---------------------------------------------------------------------------
 * Director de juego interno. Sin IA, sin red, sin claves.
 *
 * Es la pieza que garantiza que ARCANUM sea un juego completo por sí mismo.
 * También es el respaldo al que caen todos los demás proveedores cuando fallan.
 *
 * Cómo narra: no elige frases de una lista, COMPONE. Cada turno se ensambla a
 * partir de piezas independientes —resultado de la acción, atmósfera del lugar,
 * momento del día, un detalle, una consecuencia— y la combinatoria produce
 * variedad real. Las mismas mil frases dan cien mil turnos distintos.
 *
 * Qué no puede hacer: sorprender de verdad. No inventará una trama que nadie
 * previó. Pero mantiene coherencia, recuerda lo que pasó, retoma hilos abiertos
 * y responde a lo que el jugador hace. Para una partida entera, basta.
 *
 * Dependencias: IDMProvider, narrative.templates, datos, config.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { IDMProvider } from './IDMProvider.js';
import {
  atmosferaDe, resultadosDe, categoriaDe,
  FRANJA, CLIMA, COMBATE, NPC, OPCIONES, CIERRES, AMBIENTE,
} from '../../data/narrative.templates.js';
import { APP } from '../../config/app.config.js';
import { capitalizar } from '../../utils/text.js';

export class ProceduralProvider extends IDMProvider {
  static id = 'procedural';
  static nombre = 'Director procedural';
  static autonomo = true;

  constructor(opciones = {}) {
    super(opciones);

    /**
     * Fragmentos usados recientemente, para no repetirse.
     *
     * Sin esto, la aleatoriedad pura repite la misma frase cada pocos turnos y
     * el efecto se rompe de inmediato.
     * @type {Set<string>}
     * @private
     */
    this._usados = new Set();

    /** Tamaño de la ventana antirrepetición. @private */
    this._ventana = 24;
  }

  /** El director interno siempre está listo. */
  comprobar() {
    return { listo: true, motivo: null };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     GENERACIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Produce el turno completo.
   *
   * @param {import('./IDMProvider.js').PeticionTurno} peticion
   * @returns {Promise<import('./IDMProvider.js').RespuestaTurno>}
   * @protected
   */
  async generar(peticion) {
    // Una latencia mínima evita que el texto aparezca de golpe, lo que resulta
    // desconcertante después de haber esperado en otros proveedores.
    await this._latencia();

    const ctx = peticion.contexto ?? {};

    switch (peticion.tipo) {
      case 'combate': return this._turnoCombate(peticion, ctx);
      case 'dialogo': return this._turnoDialogo(peticion, ctx);
      default: return this._turnoNarrativo(peticion, ctx);
    }
  }

  /** @private */
  async _latencia() {
    const flujo = this.rng?.flujo('narrativa');
    const ms = flujo ? flujo.entero(180, 520) : 300;
    await this._dormir(ms);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     TURNO NARRATIVO
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Turno de exploración o acción libre.
   *
   * La narración se ensambla en cuatro movimientos:
   *   1. Resultado de lo que intentó el jugador
   *   2. Consecuencia inmediata
   *   3. Atmósfera del lugar
   *   4. Gancho o cierre abierto
   *
   * @param {Object} peticion
   * @param {Object} ctx
   * @returns {Object}
   * @private
   */
  _turnoNarrativo(peticion, ctx) {
    const parrafos = [];
    const eventos = [];
    const memoria = [];

    // ─── 1. Resultado de la acción ─────────────────────────────────────
    if (peticion.tirada) {
      parrafos.push(this._narrarResultado(peticion.tirada, peticion.intencion));
    } else if (peticion.accion) {
      parrafos.push(this._narrarAccionSimple(peticion.intencion, ctx));
    }

    // ─── 2. Atmósfera ──────────────────────────────────────────────────
    // Solo se describe el entorno cuando cambia algo o cada cierto tiempo. Un
    // director que describe el bosque en cada turno resulta agotador.
    if (this._tocaDescribirEntorno(ctx)) {
      parrafos.push(this._componerAtmosfera(ctx));
    }

    // ─── 3. Hilo abierto ───────────────────────────────────────────────
    // Si hay algo pendiente que lleva mucho sin tocarse, aquí vuelve.
    const hilo = ctx.hiloParaRetomar;
    if (hilo && this._flujo().oportunidad(0.4)) {
      parrafos.push(this._recordarHilo(hilo, ctx));
      eventos.push({ type: 'ambient', payload: { hilo: hilo.id }, silent: true });
    }

    // ─── 4. Suceso ambiental ───────────────────────────────────────────
    if (this._flujo().oportunidad(0.25)) {
      const ambiente = this._elegirAmbiente(ctx);
      if (ambiente) parrafos.push(ambiente);
    }

    // ─── 5. Cierre ─────────────────────────────────────────────────────
    if (this._flujo().oportunidad(0.3)) {
      parrafos.push(this._unico(CIERRES));
    }

    // ─── Consecuencias mecánicas ───────────────────────────────────────
    const playerUpdates = this._consecuencias(peticion, ctx);

    // ─── Memoria ───────────────────────────────────────────────────────
    if (peticion.tirada?.critico) {
      memoria.push(`El personaje logró algo notable al ${this._verboDe(peticion.intencion)}.`);
    }
    if (peticion.tirada?.pifia) {
      memoria.push(`El personaje falló estrepitosamente al ${this._verboDe(peticion.intencion)}.`);
    }

    return {
      schemaVersion: APP.versionContratoIA,
      story: parrafos.filter(Boolean).join('\n\n'),
      choices: this._opciones(ctx),
      playerUpdates,
      newItems: [],
      quests: [],
      combat: {},
      events: eventos,
      memory: memoria,
      mood: this._tono(peticion, ctx),
    };
  }

  /**
   * Narra el resultado de una tirada.
   *
   * El motor ya decidió: aquí solo se viste. La frase se elige por grado y por
   * categoría de la habilidad, de modo que fallar un sigilo suene distinto a
   * fallar un empujón.
   *
   * @param {Object} tirada
   * @param {Object} intencion
   * @returns {string}
   * @private
   */
  _narrarResultado(tirada, intencion) {
    const categoria = categoriaDe(tirada.habilidad);
    const frases = resultadosDe(tirada.grado, categoria);
    const base = this._unico(frases);

    const partes = [base + '.'];

    // Un fallo con causa identificable se narra citándola: perder por
    // agotamiento no es lo mismo que perder por mala suerte.
    if (!tirada.exito && tirada.desglose?.length) {
      const peor = [...tirada.desglose]
        .filter((m) => m.valor < 0)
        .sort((a, b) => a.valor - b.valor)[0];

      if (peor) {
        const causas = {
          Hambre: 'El hambre te resta reflejos.',
          Sed: 'La sed te nubla.',
          Agotamiento: 'Estás demasiado cansado para esto.',
          Carga: 'El peso que llevas encima te estorba.',
          Moral: 'No tienes el ánimo para esto.',
        };
        const clave = Object.keys(causas).find((k) => peor.fuente.startsWith(k));
        if (clave) partes.push(causas[clave]);
      }
    }

    // Un crítico o una pifia merecen su propia frase.
    if (tirada.critico) {
      partes.push(this._unico([
        'Todo se alinea de golpe.',
        'Ha sido uno de esos momentos que no se repiten.',
        'Ni tú te esperabas que saliera así.',
      ]));
    } else if (tirada.pifia) {
      partes.push(this._unico([
        'Y encima, ahora hay testigos.',
        'Lo que era un problema pequeño acaba de crecer.',
        'Peor imposible.',
      ]));
    }

    return partes.join(' ');
  }

  /**
   * Narra una acción que no requirió tirada.
   * @private
   */
  _narrarAccionSimple(intencion, ctx) {
    const tipo = intencion?.tipo ?? 'custom';

    const plantillas = {
      observe: [
        'Te detienes a mirar con calma.',
        'Dedicas un momento a fijarte en los detalles.',
      ],
      explore: [
        'Avanzas sin prisa, atento a lo que hay alrededor.',
        'Sigues adelante.',
      ],
      wait: [
        'Esperas. El tiempo pasa despacio.',
        'Te quedas quieto y dejas que la situación se desarrolle.',
      ],
      rest: [
        'Buscas un sitio resguardado y te sientas.',
        'Te tomas un respiro.',
      ],
      travel: [
        'Emprendes el camino.',
        'Te pones en marcha.',
      ],
    };

    const opciones = plantillas[tipo] ?? ['Haces lo que has decidido hacer.'];
    return this._unico(opciones);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ATMÓSFERA
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Decide si conviene describir el entorno en este turno.
   *
   * Se describe siempre al cambiar de terreno o de franja horaria, y de vez en
   * cuando en los demás casos. Repetirlo cada turno cansa.
   *
   * @param {Object} ctx
   * @returns {boolean}
   * @private
   */
  _tocaDescribirEntorno(ctx) {
    if (!ctx.ultimoTurno) return true;

    // Cambio de escenario: siempre.
    if (ctx._terrenoAnterior && ctx._terrenoAnterior !== ctx.mundo?.terreno) return true;
    if (ctx._franjaAnterior && ctx._franjaAnterior !== ctx.mundo?.franja) return true;

    return this._flujo().oportunidad(0.45);
  }

  /**
   * Compone una descripción del entorno.
   *
   * Toma dos o tres registros sensoriales distintos de la atmósfera del terreno
   * y los une. Esa combinatoria es lo que evita la repetición.
   *
   * @param {Object} ctx
   * @returns {string}
   * @private
   */
  _componerAtmosfera(ctx) {
    const terreno = ctx.mundo?.terreno ?? 'camino';
    const atmosfera = atmosferaDe(terreno);
    const partes = [];

    // Momento del día, solo a veces: no hace falta recordar la hora siempre.
    if (this._flujo().oportunidad(0.4)) {
      const franja = FRANJA[ctx.mundo?.franja] ?? FRANJA.mediodia;
      partes.push(this._unico(franja));
    }

    // Clima, si es algo más que un cielo despejado.
    const clima = ctx.mundo?.clima;
    if (clima && clima !== 'despejado' && this._flujo().oportunidad(0.6)) {
      partes.push(this._unico(CLIMA[clima] ?? CLIMA.despejado));
    }

    // Vista casi siempre; oído y olfato de forma alterna.
    partes.push(this._unico(atmosfera.vista));

    if (this._flujo().oportunidad(0.55)) partes.push(this._unico(atmosfera.sonido));
    if (this._flujo().oportunidad(0.3)) partes.push(this._unico(atmosfera.olfato));

    // Un detalle concreto: es lo que hace que el lugar parezca real en vez de
    // un decorado genérico.
    if (this._flujo().oportunidad(0.5)) partes.push(this._unico(atmosfera.detalle));

    return partes.map((p) => (p.endsWith('.') ? p : `${p}.`)).join(' ');
  }

  /**
   * Elige un suceso ambiental adecuado al momento.
   * @private
   */
  _elegirAmbiente(ctx) {
    const grupos = [AMBIENTE.general];

    if (ctx.mundo?.franja === 'noche' || ctx.mundo?.franja === 'madrugada') {
      grupos.push(AMBIENTE.noche);
    }
    if (ctx.mundo?.terreno === 'ciudad') grupos.push(AMBIENTE.ciudad);

    // Cuando lleva muchos turnos sin encuentros, se siembra inquietud. No
    // promete nada, pero prepara al jugador.
    if ((ctx.mundo?.turnosDesdeEncuentro ?? 0) > 5) grupos.push(AMBIENTE.peligro);

    const grupo = this._flujo().elegir(grupos);
    return grupo ? this._unico(grupo) : null;
  }

  /**
   * Recuerda un hilo abierto sin resolverlo.
   *
   * La forma importa: se menciona de refilón, como un pensamiento intrusivo, no
   * como un recordatorio de la interfaz.
   *
   * @private
   */
  _recordarHilo(hilo, ctx) {
    const formas = [
      `Te viene a la cabeza, sin venir a cuento: ${hilo.texto.toLowerCase()}`,
      `Sigue ahí, en algún rincón: ${hilo.texto.toLowerCase()}`,
      `No lo has olvidado. ${capitalizar(hilo.texto)}`,
      `Y entonces lo recuerdas otra vez: ${hilo.texto.toLowerCase()}`,
    ];

    return this._unico(formas);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     TURNO DE COMBATE
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Narra una ronda de combate. Corta y seca: en combate sobra la prosa.
   * @private
   */
  _turnoCombate(peticion, ctx) {
    const partes = [];
    const t = peticion.tirada;

    if (t) {
      const grupo = t.exito
        ? (t.critico ? PLANTILLAS_COMBATE.golpeJugador.critico
          : t.grado === 'exitoJusto' ? PLANTILLAS_COMBATE.golpeJugador.debil
          : PLANTILLAS_COMBATE.golpeJugador.normal)
        : PLANTILLAS_COMBATE.golpeJugador.fallo;

      partes.push(`${this._unico(grupo)}.`);
    }

    // Un enemigo herido de gravedad se comporta distinto, y eso se nota.
    const enemigos = ctx.combate?.combatientes;
    if (enemigos) {
      const heridos = Object.values(enemigos.porId ?? {})
        .filter((c) => c.bando === 'enemigo' && c.vida?.actual > 0)
        .filter((c) => c.vida.actual / c.vida.max < 0.3);

      if (heridos.length && this._flujo().oportunidad(0.5)) {
        partes.push(this._unico([
          'Uno de ellos sangra y ya no ataca con la misma confianza.',
          'Se nota que están al límite.',
          'Alguien retrocede medio paso.',
        ]));
      }
    }

    return {
      schemaVersion: APP.versionContratoIA,
      story: partes.join(' '),
      choices: OPCIONES.combate.map((o, i) => ({ ...o, id: `c${i + 1}` })),
      playerUpdates: {},
      newItems: [],
      quests: [],
      combat: {},
      events: [],
      memory: [],
      mood: 'tension',
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     TURNO DE DIÁLOGO
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Narra una interacción con un PNJ.
   * @private
   */
  _turnoDialogo(peticion, ctx) {
    const npc = ctx.npcsPresentes?.[0];
    const partes = [];

    if (!npc) {
      // Nadie con quien hablar: se genera alguien, que es más interesante que
      // decir «no hay nadie».
      const generado = this._generarNPC(ctx);
      partes.push(generado.presentacion);

      return {
        schemaVersion: APP.versionContratoIA,
        story: partes.join(' '),
        choices: OPCIONES.npcPresente.map((o, i) => ({ ...o, id: `c${i + 1}` })),
        playerUpdates: {},
        newItems: [],
        quests: [],
        combat: {},
        events: [{ type: 'npc_meet', payload: generado.datos, silent: false }],
        memory: [`Conoció a ${generado.datos.nombre}, ${generado.datos.rol}.`],
        mood: 'neutro',
      };
    }

    // Diálogo con alguien ya presente.
    const actitud = npc.actitud ?? 'cordial';
    const saludos = NPC.saludos[actitud] ?? NPC.saludos.cordial;

    partes.push(this._unico(saludos));

    if (peticion.tirada) {
      partes.push(this._narrarResultado(peticion.tirada, peticion.intencion));
    }

    return {
      schemaVersion: APP.versionContratoIA,
      story: partes.join(' '),
      choices: OPCIONES.npcPresente.map((o, i) => ({ ...o, id: `c${i + 1}` })),
      playerUpdates: {},
      newItems: [],
      quests: [],
      combat: {},
      events: [],
      memory: [],
      mood: 'neutro',
    };
  }

  /**
   * Genera un PNJ coherente con el lugar.
   *
   * Nombre compuesto de sílabas, oficio acorde al terreno y un rasgo físico
   * memorable. No es Shakespeare, pero da personas distintas cada vez.
   *
   * @private
   */
  _generarNPC(ctx) {
    const flujo = this._flujo();

    const nombre = capitalizar(
      flujo.elegir(NPC.nombres.pilaA) + flujo.elegir(NPC.nombres.pilaB),
    );

    // El oficio se filtra por lo que encaja en el terreno actual.
    const terreno = ctx.mundo?.terreno ?? 'camino';
    const compatibles = NPC.oficios.filter((o) => {
      if (terreno === 'ciudad') return true;
      if (terreno === 'bosque') return ['cazador', 'granjero', 'contrabandista'].includes(o.nombre);
      if (terreno === 'camino') return ['mercader', 'granjero', 'guardia', 'mendigo'].includes(o.nombre);
      if (terreno === 'oceano') return ['capitana', 'contrabandista', 'mercader'].includes(o.nombre);
      return ['cazador', 'contrabandista', 'mercader'].includes(o.nombre);
    });

    const oficio = flujo.elegir(compatibles.length ? compatibles : NPC.oficios);
    const rasgo = this._unico(NPC.rasgos);

    const presentaciones = [
      `Aparece ${nombre}, ${oficio.nombre} ${rasgo}.`,
      `Alguien se acerca: ${nombre}, ${oficio.nombre}, ${rasgo}.`,
      `Te cruzas con ${nombre}. Es ${oficio.nombre}, ${rasgo}.`,
    ];

    return {
      datos: {
        refId: `npc_${nombre.toLowerCase()}`,
        nombre,
        rol: oficio.nombre,
        actitud: oficio.actitud,
        rasgo,
        presente: true,
      },
      presentacion: this._unico(presentaciones),
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONSECUENCIAS Y OPCIONES
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Consecuencias mecánicas del turno.
   *
   * El director procedural es deliberadamente conservador: apenas toca el
   * estado. El desgaste ya lo gestiona el reloj; aquí solo se añaden efectos
   * directamente ligados a lo que pasó.
   *
   * @private
   */
  _consecuencias(peticion, ctx) {
    const updates = {};
    const t = peticion.tirada;

    if (!t) return updates;

    // Una pifia en algo físico cuesta algo de vida.
    if (t.pifia && categoriaDe(t.habilidad) === 'fisico') {
      updates.hp = { delta: -this._flujo().entero(1, 4) };
    }

    // Un éxito rotundo levanta el ánimo; un fracaso grave lo hunde.
    if (t.grado === 'exitoRotundo') {
      updates.morale = { delta: 3 };
    } else if (t.grado === 'fracasoGrave') {
      updates.morale = { delta: -4 };
    }

    return updates;
  }

  /**
   * Elige el conjunto de opciones adecuado a la situación.
   * @private
   */
  _opciones(ctx) {
    let base;

    if (ctx.combate) base = OPCIONES.combate;
    else if (ctx.npcsPresentes?.length) base = OPCIONES.npcPresente;
    else base = OPCIONES.exploracion;

    // Se ofrece un subconjunto, no la lista entera: cuatro opciones se leen,
    // seis empiezan a ser ruido.
    const elegidas = this._flujo().elegirVarios(base, 4);

    return elegidas.map((o, i) => ({ ...o, id: `c${i + 1}` }));
  }

  /**
   * Tono emocional del turno, para que la interfaz pueda reaccionar.
   * @private
   */
  _tono(peticion, ctx) {
    if (ctx.combate) return 'tension';

    const t = peticion.tirada;
    if (t?.critico) return 'triunfo';
    if (t?.pifia) return 'desastre';
    if (t && !t.exito) return 'frustracion';

    if ((ctx.mundo?.turnosDesdeEncuentro ?? 0) > 6) return 'inquietud';
    if (ctx.mundo?.franja === 'noche') return 'sombrio';

    return 'neutro';
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RESUMEN DE CAPÍTULO
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Resume una tanda de turnos.
   *
   * Devuelve null a propósito: MemoryStore tiene su propio resumen mecánico y
   * hace mejor trabajo que cualquier plantilla que se pudiera escribir aquí.
   *
   * @returns {Promise<string|null>}
   */
  async resumir() {
    return null;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ANTIRREPETICIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Elige un fragmento evitando los usados recientemente.
   *
   * Es lo que separa una gramática generativa aceptable de una irritante. Sin
   * este filtro, la aleatoriedad pura repite la misma frase cada cinco turnos.
   *
   * @param {string[]} lista
   * @returns {string}
   * @private
   */
  _unico(lista) {
    if (!lista?.length) return '';

    const disponibles = lista.filter((f) => !this._usados.has(f));
    const fuente = disponibles.length ? disponibles : lista;

    const elegido = this._flujo().elegir(fuente);

    this._usados.add(elegido);

    // La ventana se vacía por la mitad al llenarse, para que las frases puedan
    // reaparecer pasado un tiempo razonable.
    if (this._usados.size > this._ventana) {
      const mitad = [...this._usados].slice(this._ventana / 2);
      this._usados = new Set(mitad);
    }

    return elegido;
  }

  /**
   * Flujo aleatorio narrativo.
   * @private
   */
  _flujo() {
    return this.rng?.flujo('narrativa') ?? {
      elegir: (l) => l[Math.floor(Math.random() * l.length)],
      elegirVarios: (l, n) => [...l].sort(() => Math.random() - 0.5).slice(0, n),
      entero: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
      oportunidad: (p) => Math.random() < p,
    };
  }

  /**
   * Verbo asociado a una intención, para las entradas de memoria.
   * @private
   */
  _verboDe(intencion) {
    const verbos = {
      attack: 'atacar', talk: 'hablar', explore: 'explorar', open: 'abrir',
      hide: 'esconderse', negotiate: 'negociar', use_item: 'usar un objeto',
      flee: 'huir', rest: 'descansar', travel: 'viajar', search: 'registrar',
      persuade: 'persuadir', intimidate: 'intimidar', deceive: 'engañar',
      observe: 'observar', cast: 'lanzar un glifo', trade: 'comerciar',
    };
    return verbos[intencion?.tipo] ?? 'actuar';
  }
}

export default ProceduralProvider;
