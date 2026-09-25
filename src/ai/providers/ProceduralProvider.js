/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ai/providers/ProceduralProvider.js
 * ---------------------------------------------------------------------------
 * Director de juego interno. Sin IA, sin red, sin claves.
 *
 * Es la pieza que garantiza que ARCANVEIL sea un juego completo por sí mismo.
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
  atmosferaDe, atmosferaInterior, resultadosDe, categoriaDe,
  FRANJA, CLIMA, COMBATE, NPC, OPCIONES, CIERRES, AMBIENTE,
} from '../../data/narrative.templates.js';
import { APP } from '../../config/app.config.js';
import { capitalizar, trasPreposicion, sinAcentos } from '../../utils/text.js';
import { aSegundaPersona, esPrimeraPersona } from '../Persona.js';
import { obtenerLugar } from '../../data/locations.data.js';
import * as Cadencia from '../Cadencia.js';
import { comentario } from '../../npc/Companero.js';

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

    /**
     * Memoria por familia de frases.
     *
     * La ventana global de arriba no bastaba, y se veía jugando: en ocho
     * turnos, la misma reacción del acompañante salió cuatro veces palabra por
     * palabra. La razón es que `_usados` mezcla todas las familias y un turno
     * gasta cinco o seis frases de familias distintas, así que una familia de
     * tres opciones queda «limpia» a los pocos turnos. Peor: cuando las tres
     * estaban marcadas, el filtro se quedaba sin candidatas y caía a la lista
     * entera, es decir, podía repetir justo la que acababa de decir.
     *
     * Con una cola por familia se recorren todas las opciones antes de que
     * ninguna vuelva. Es lo mínimo que se le pide a un narrador: que no repita
     * teniendo más cosas que decir.
     *
     * @type {Map<string, string[]>}
     * @private
     */
    this._porFamilia = new Map();
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
      case 'dialogo': return this._enriquecer(peticion, ctx, this._turnoDialogo(peticion, ctx));
      default: return this._enriquecer(peticion, ctx, this._turnoNarrativo(peticion, ctx));
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     INTEGRAR AL JUGADOR
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Hace que el turno responda a lo que el jugador escribió.
   *
   * La acción se devuelve en segunda persona como arranque («Te acercas al
   * barquero y le enseñas el medallón»), quien esté presente reacciona, el
   * relato nunca queda en una sola línea y las sugerencias nombran lo que
   * hay en escena.
   * @private
   */
  _enriquecer(peticion, ctx, r) {
    // Los cierres tipo «Tú dirás.» sobran: la caja de texto ya invita a actuar.
    const parrafos = String(r.story ?? '').split(/\n\n+/).filter(Boolean)
      .filter((p) => !CIERRES.includes(p.trim()))
      // La cita literal de la intención se sustituye por la narración en segunda persona.
      .filter((p) => !(peticion.accion && /^(Pones en práctica tu idea|Sin apartar la vista|No dudas más)/.test(p)));
    const accion = String(peticion.accion ?? '').trim();

    if (accion) {
      let frase = capitalizar(aSegundaPersona(accion)).replace(/[.!?…]*$/u, '.');
      // Lo desmedido se narra como intento, con el límite dentro de la historia.
      if (peticion.ambicion === 'desmedida') {
        frase = `${frase.replace(/\.$/, '')}: esa es tu intención, y la empuñas con todo lo que tienes.`;
        parrafos.splice(1, 0, this._unico([
          'Pero el mundo es más grande que tus fuerzas. El impulso se quiebra a medio camino y te deja jadeando, con los brazos temblando y la certeza de que aún no eres quien necesitas ser para algo así.',
          'Durante un instante parece posible. Luego la realidad pesa más que tu voluntad: el golpe se pierde, el eco se apaga y solo queda tu respiración, rápida, y las miradas de quien lo haya visto.',
          'Algo responde, muy lejos, como si el mundo hubiera notado el intento. Pero no cede. Todavía no. Quizá algún día, con más camino a la espalda.',
        ]));
      }
      const primera = parrafos[0] ?? '';
      // Las plantillas cortas de acción («Te pones en marcha.») sobran cuando
      // ya se narra lo que el jugador escribió.
      const plantilla = primera.length < 60 && !primera.includes('«');
      parrafos[0] = plantilla ? frase : `${frase} ${primera}`.trim();
    }

    // Lo que el motor ha preparado para esta escena va justo detrás de la
    // acción y por delante de todo lo demás.
    //
    // El orden es la mitad del trabajo: si hay un carro volcado cortando el
    // paso, eso ES la escena, y el trigo moviéndose con el viento es decorado.
    // Enterrar el encuentro bajo dos párrafos de ambiente lo convierte en una
    // nota al pie de algo que no está pasando.
    const escena = this._narrarEscena(ctx);
    if (escena) parrafos.splice(1, 0, escena);

    // Quien está en escena no se queda de piedra... pero tampoco comenta que
    // bebas agua.
    //
    // Antes reaccionaba en TODOS los turnos. Con tres frases rotando, en doce
    // turnos cada una salía cuatro veces, y el acompañante pasaba de estar
    // vivo a ser un tic. El problema no era la falta de frases: era que no
    // callaba nunca. Un acompañante de verdad mira cuando hay algo que mirar.
    //
    // Reacciona si ha pasado algo —hay escena, o la tirada salió redonda o
    // desastrosa— y si no, una de cada tres veces.
    // Solo reacciona quien tiene que ver con la acción: el que se nombra en
    // ella. Antes era el primero de los presentes, hubiera pasado lo que
    // hubiera pasado, y un gesto inventado a un tercero no es el mundo
    // reaccionando: es relleno.
    const nombrada = String(peticion.accion ?? '').toLowerCase();
    const npc = (ctx.npcsPresentes ?? []).find((n) => n?.nombre && nombrada.includes(n.nombre.toLowerCase()));
    const tir = peticion.tirada;
    const mereceLaPena = Boolean(escena) || Boolean(tir?.critico) || Boolean(tir?.pifia);

    if (accion && npc?.nombre && !String(r.story).includes(npc.nombre)
        && (mereceLaPena || this._flujo().entero(0, 2) === 0)) {
      parrafos.push(this._unico([
        `${npc.nombre} no te quita ojo. Por su gesto, lo que acabas de hacer le ha dicho de ti más que cualquier presentación.`,
        `${npc.nombre} deja lo que estaba haciendo y te mira de otra manera, como quien recoloca una pieza en un tablero.`,
        `A tu lado, ${npc.nombre} suelta el aire despacio. No dice nada todavía, pero ha tomado nota.`,
      ]));
    }

    // El relleno existe para que un turno no quede desnudo, no para alargar
    // uno que ya dice algo.
    //
    // El tope pasa de tres párrafos a dos, y la atmósfera se corta a una sola
    // frase. Casi todas las respuestas terminaban con dos o tres frases de
    // adorno —«Una bandada cruza el cielo en formación cerrada», «Algo cruje a
    // tu espalda y no hay nada cuando te giras»— que el jugador aprende a
    // saltarse en cuatro turnos. Una frase se lee; tres son ruido.
    const conContenido = Boolean(escena) || parrafos.length >= 2;

    if (!conContenido && parrafos.length < 2) {
      const atm = this._componerAtmosfera(ctx, { frases: 1 });
      if (atm && !r.story?.includes(atm)) parrafos.push(atm);
    }
    // Orden de preferencia para cerrar un turno flojo: primero lo que el
    // jugador ha construido, luego sus hilos abiertos, y solo al final el
    // ambiente de fábrica.
    //
    // Es el orden que convierte el relleno en historia. Una bandada cruzando
    // el cielo vale para cualquier partida; el nombre que él trajo hace diez
    // turnos vale solo para la suya.
    if (!conContenido && parrafos.length < 2) {
      // Se comprueba que el canon no haya salido ya arriba, en `_turnoNarrativo`:
      // sin esto podía aparecer dos veces en el mismo turno, y un recuerdo
      // repetido dos párrafos más abajo deja de ser un recuerdo.
      const yaSalio = (ctx.canon ?? []).some((c) => parrafos.some((p) => p.includes(c.nombre)));
      const suyo = yaSalio ? '' : this._traerDelCanon(ctx, peticion.accion);
      const hilo = this._hiloPertinente(ctx);

      if (suyo) parrafos.push(suyo);
      else if (hilo) parrafos.push(this._recordarHilo(hilo, ctx));
      else {
        const amb = this._elegirAmbiente(ctx);
        if (amb) parrafos.push(amb);
      }
    }

    // El turno se monta por golpes, no por párrafos.
    //
    // Antes esto era `parrafos.join('\n\n')`: cuatro o cinco frases apelmazadas
    // en dos bloques. Se leen de un vistazo y se olvidan igual, porque todo
    // pesa lo mismo: una pifia y el viento en el trigo ocupaban el mismo sitio
    // y sonaban igual.
    //
    // Una frase por línea, y el silencio entre ellas hace de puntuación. Como
    // la interfaz ya escribe línea a línea y con pausa, la máquina de escribir
    // deja de ser un adorno y pasa a marcar el tiempo.
    const t = peticion.tirada;

    // ─── Una negativa tiene respuesta ───────────────────────────────────
    // Quien la oye reacciona desde lo que siente por él, sin que el
    // narrador haga ceder al jugador ni le ponga otras palabras.
    if (ctx.negativa?.nombre) {
      const { nombre, actitud = 0 } = ctx.negativa;
      const reaccion = actitud >= 30
        ? `${nombre} asiente despacio. No le gusta, pero lo respeta.`
        : actitud <= -20
          ? `${nombre} entorna los ojos. «Te vas a arrepentir de eso.»`
          : `${nombre} aprieta los labios. No insiste, pero tampoco se va.`;
      parrafos.splice(1, 0, reaccion);
    }

    // ─── Lo que queda en el aire ────────────────────────────────────────
    // Lo condicional no ha pasado: se deja dicho y se devuelve la palabra.
    for (const x of ctx.pendientes ?? []) {
      if (x.condicion) parrafos.push(`Queda en el aire lo que harás si ${x.condicion}.`);
    }

    // ─── Lo que dice el grupo ───────────────────────────────────────────
    // Con la misma regla que el resto del adorno: solo cuando pasa algo, o
    // uno de cada tres turnos. Un compañero que comenta todo es ruido. Habla
    // uno cada vez, por turnos, y los heridos callan.
    const grupo = (ctx.grupo ?? []).filter((c) => !c.herido);
    const turnoActual = peticion.turno ?? ctx.turno ?? 0;
    if (grupo.length && (escena || t?.critico || t?.pifia || turnoActual % 3 === 0)) {
      const quien = grupo[turnoActual % grupo.length];
      parrafos.push(comentario(quien, ctx.misionEnCurso, (lista) => this._unico(lista)));
    }

    // UN golpe por turno, y nunca dos seguidos.
    //
    // El sonido y la antesala hacen lo mismo —parar el ojo— así que puestos
    // juntos se anulan: salía «BUM.» y debajo «Hasta que...», dos frenos
    // pegados que dejan de frenar. Se elige el que corresponde.
    //
    // El sonido es para el golpe físico: un crítico, una pifia. Una escena que
    // se abre no suena, se anuncia, y para eso está la antesala. «BUM» delante
    // de un carro volcado es ruido en el sentido literal.
    //
    // Y nunca detrás de palabras. Preguntar al tabernero por el incendio acabó
    // en «CRACK.» porque la tirada social salió crítica, y un sonido de golpe
    // detrás de un diálogo no significa nada. Hablar, recordar y mirar no
    // suenan, salgan como salgan.
    const sinSonido = peticion.tipo === 'dialogo'
      || ['social', 'saber', 'mirada'].includes(categoriaDe(t?.habilidad));
    const golpe = sinSonido ? '' : t?.critico ? 'critico' : t?.pifia ? 'pifia' : '';

    return {
      ...r,
      story: Cadencia.montar(parrafos, {
        golpe,
        // La antesala se gana: solo cuando de verdad gira algo, y solo si no
        // hay sonido. Puesta en cada turno se convierte en muletilla y deja de
        // anunciar nada.
        antesala: !golpe && Boolean(escena),
        elegir: (lista) => this._unico(lista),
      }),
      choices: this._sugerenciasDeEscena(ctx, r.choices ?? []),
    };
  }

  /**
   * Tres sugerencias que nombran lo que hay en escena: la persona presente,
   * un rincón del lugar y el hilo personal del jugador.
   * @private
   */
  _sugerenciasDeEscena(ctx, base) {
    const lugar = obtenerLugar(ctx.mundo?.ubicacion);
    const npc = ctx.npcsPresentes?.[0];

    const candidatas = [];

    // La escena primero: lo que está pasando, quien está delante y el sitio.
    // Antes iban por delante sugerencias sacadas del pasado del personaje
    // («Preguntar a Torlin por tu padre», «Enseñar el medallón»): la ayuda
    // para cuando no se sabe qué hacer empujaba otra vez hacia su biografía.
    // El pasado vuelve cuando él lo busca; no se le propone.
    if (ctx.situacion?.sugerencia) candidatas.push(ctx.situacion.sugerencia);

    if (npc?.nombre) {
      candidatas.push({ label: `Hablar con ${npc.nombre}`, intent: 'talk', risk: 'low' });
      candidatas.push({ label: `Observar a ${npc.nombre} sin que lo note`, intent: 'observe', risk: 'low' });
    }

    const sub = this._flujo().elegir(lugar?.sublugares ?? []);
    if (sub?.nombre) candidatas.push({ label: `Ir ${trasPreposicion('a', sub.nombre)}`, intent: 'explore', risk: 'low' });

    const conexion = this._flujo().elegir(lugar?.conexiones ?? []);
    const destino = conexion ? obtenerLugar(conexion.hasta) : null;
    if (destino?.nombre) candidatas.push({ label: `Tomar el camino ${trasPreposicion('hacia', destino.nombre)}`, intent: 'travel', risk: conexion.peligro > 1 ? 'medium' : 'low' });

    // Lo que el jugador ha nombrado jugando, al final: es suyo, pero no se le
    // empuja hacia ello.
    const suyo = (ctx.canon ?? []).filter((c) => c.menciones >= 2 && c.origen !== 'importado');
    for (const c of suyo.slice(0, 1)) {
      if (c.tipo === 'persona' && npc?.nombre) candidatas.push({ label: `Preguntar a ${npc.nombre} por ${c.nombre}`, intent: 'talk', risk: 'low' });
    }

    candidatas.push(...base);

    const vistas = new Set();
    const elegidas = [];
    for (const c of candidatas) {
      const clave = c.label?.toLowerCase();
      if (!clave || vistas.has(clave) || c.label.split(/\s+/).length > 9) continue;
      vistas.add(clave);
      elegidas.push(c);
      if (elegidas.length === 3) break;
    }
    return elegidas.map((o, i) => ({ ...o, id: `c${i + 1}` }));
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

    // No se abre con el pasado del personaje. Se hacía («Tu pasado no te ha
    // dejado llegar aquí por azar. Perdiste la forja…»), y la historia que
    // escribió el jugador pasaba a ser la campaña. Es canon: vuelve cuando él
    // lo busca o el mundo lo roza, no en la primera línea.
    //
    // La primera línea es dónde y cuándo: sin ella la apertura empezaba con
    // «Un árbol solitario marca un cruce» y no se sabía ni en qué pueblo.
    if ((peticion.turno ?? ctx.turno) <= 1 && !ctx.ultimoTurno && !peticion.accion) {
      parrafos.push(this._abrirEscena(ctx));
    }

    // ─── 1. Resultado de la acción ─────────────────────────────────────
    // Si ha intervenido en algo que estaba pasando, lo que ocurre es eso: la
    // rueda que se calza, la niña que se aparta del pozo. Una frase genérica
    // de tirada («Todo encaja a la primera») no dice nada al lado.
    if (ctx.situacionResultado) {
      parrafos.push(ctx.situacionResultado);
    } else if (peticion.tirada) {
      parrafos.push(this._narrarResultado(peticion.tirada, peticion.intencion));
    } else if (peticion.accion) {
      parrafos.push(this._narrarAccionSimple(peticion.intencion, ctx));
    }

    // ─── 2. Atmósfera ──────────────────────────────────────────────────
    // Solo se describe el entorno cuando cambia algo o cada cierto tiempo. Un
    // director que describe el bosque en cada turno resulta agotador.
    //
    // Dos frases como mucho. Antes salían cuatro y cinco de golpe —hora,
    // clima, vista, sonido, olfato y detalle, todo seguido— y el jugador
    // aprendía a saltarse el párrafo entero en cuatro turnos. Lo que se lee
    // siempre no es lo que más dice, es lo que cabe.
    // Si hay algo pasando en escena, eso es la escena: sin paisaje encima.
    const conEscena = (ctx.contextoEscena ?? []).length > 0;
    if (!conEscena && this._tocaDescribirEntorno(ctx)) {
      parrafos.push(this._componerAtmosfera(ctx, { frases: 2 }));
    }

    // ─── 3. Lo suyo vuelve ─────────────────────────────────────────────
    //
    // Primero el canon —lo que él ha nombrado— y luego los hilos abiertos. Es
    // el mismo criterio de siempre: entre repetir una plantilla del juego y
    // repetir algo que escribió el jugador, gana lo segundo. Su historia no la
    // construye el catálogo, la construye él.
    // Pero solo lo que viene a cuento. Antes salía al azar un turno de cada
    // cuatro, para aparentar continuidad: un recuerdo sin motivo no es
    // memoria, es un gancho repetido.
    const hilo = this._hiloPertinente(ctx);
    const suyo = this._traerDelCanon(ctx, peticion.accion);

    if (suyo) {
      parrafos.push(suyo);
    } else if (hilo) {
      parrafos.push(this._recordarHilo(hilo, ctx));
      eventos.push({ type: 'ambient', payload: { hilo: hilo.id }, silent: true });
    }

    // ─── 4. Suceso ambiental ───────────────────────────────────────────
    if (!conEscena && this._flujo().oportunidad(0.25)) {
      const ambiente = this._elegirAmbiente(ctx);
      if (ambiente) parrafos.push(ambiente);
    }

    // ─── 5. Cierre ─────────────────────────────────────────────────────
    if (!conEscena && this._flujo().oportunidad(0.3)) {
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
   * Dónde y cuándo empieza la partida, en una línea.
   * @private
   */
  _abrirEscena(ctx) {
    const lugar = obtenerLugar(ctx.mundo?.ubicacion);
    if (!lugar?.nombre) return '';
    const CUANDO = {
      madrugada: 'de madrugada', alba: 'al alba', manana: 'por la mañana', mediodia: 'a mediodía',
      tarde: 'por la tarde', ocaso: 'al caer la tarde', noche: 'de noche',
    };
    const cuando = CUANDO[ctx.mundo?.franja] ? `, ${CUANDO[ctx.mundo.franja]}` : '';
    return `${lugar.nombre}${cuando}. ${lugar.descripcion ?? ''}`.trim();
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

    if (plantillas[tipo]) return this._unico(plantillas[tipo]);

    const accion = String(intencion?.texto ?? intencion?.accion ?? '').trim();
    // La entrada libre suele venir en primera persona ("anoto", "busco") o
    // como infinitivo. No la cosemos detrás de "intentas": eso exigiría
    // conjugar texto arbitrario y producía frases como "intentas anoto".
    // La conservamos como cita de intención y la narración sigue en segunda persona.
    const propuesta = accion.replace(/[.!?…]+$/u, '');
    const lugar = ctx.mundo?.lugar ?? ctx.mundo?.nombreLugar ?? 'este lugar';
    const abiertas = [
      propuesta ? `Pones en práctica tu idea: «${propuesta}».` : 'Actúas según tu instinto.',
      propuesta ? `Sin apartar la vista de ${lugar}, decides actuar: «${propuesta}».` : `Tomas la iniciativa en ${lugar}.`,
      propuesta ? `No dudas más. Tu intención está clara: «${propuesta}».` : 'Das el siguiente paso.',
      'Tu decisión rompe la quietud y obliga al mundo a responder.',
      'Te mueves con intención; alrededor, nada permanece del todo indiferente.',
    ];
    return this._unico(abiertas);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ATMÓSFERA
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Convierte en prosa lo que el motor ha preparado para esta escena.
   *
   * Las notas llegan escritas para un modelo de lenguaje, en mayúsculas y con
   * su etiqueta delante: «ENCUENTRO EN CURSO: un carro volcado corta el paso.
   * Vías posibles: ayudar, rodear, registrar.» Un modelo se las arregla con
   * eso; el director interno tiene que pasarlas a algo que se lea.
   *
   * Se traduce la etiqueta a una entradilla en castellano y se deja el cuerpo
   * de la nota tal cual, que es donde está la información concreta. Las vías
   * posibles se cuelgan al final como lo que son: lo que el jugador puede
   * hacer ahora.
   *
   * @param {Object} ctx
   * @returns {string}
   * @private
   */
  _narrarEscena(ctx) {
    const notas = ctx.contextoEscena ?? [];
    if (!notas.length) return '';

    // Solo la primera. Dos avisos a la vez se pisan y ninguno se lee.
    const nota = String(notas[0] ?? '').trim();
    if (!nota) return '';

    const corte = nota.indexOf(':');
    const etiqueta = corte > 0 ? nota.slice(0, corte).toUpperCase() : '';
    let cuerpo = corte > 0 ? nota.slice(corte + 1).trim() : nota;

    // Las vías posibles se separan para que no queden en mitad de la frase.
    let vias = '';
    const mVias = cuerpo.match(/\s*V[ií]as posibles:\s*([^.]+)\.?\s*$/i);
    if (mVias) {
      vias = mVias[1].trim().replace(/\.$/, '');
      cuerpo = cuerpo.slice(0, mVias.index).trim();
    }

    const ENTRADILLAS = {
      'ENCUENTRO EN CURSO': ['Y entonces se tuerce el camino.', 'Algo se cruza.', 'Ahí delante hay algo que no estaba.'],
      'HA CAMBIADO DESDE LA ÚLTIMA VISITA': ['Esto no lo dejaste así.', 'Algo ha cambiado desde la última vez.'],
      PENDIENTE: ['Hay algo que sigue sin saldar.', 'Queda una cuenta abierta.'],
    };

    const entradilla = ENTRADILLAS[etiqueta] ? this._unico(ENTRADILLAS[etiqueta]) : '';

    const partes = [entradilla, capitalizar(cuerpo)].filter(Boolean);
    if (vias) partes.push(`Se te ocurren varias salidas: ${vias}.`);

    return partes.join(' ');
  }

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
  _componerAtmosfera(ctx, { frases = 0 } = {}) {
    // Dentro de un sitio se describe el sitio, no la comarca.
    //
    // Esto miraba solo el terreno, así que desde la mesa de una taberna
    // contaba los surcos de carro y el viento en el trigo. El jugador tiene
    // cuatro paredes delante y le describían los campos de fuera.
    const dentro = this._sublugarActual(ctx);
    // En un asentamiento, ambiente de pueblo: el terreno es el de la comarca
    // y en pleno Vado salían «campos abiertos» y «el trigo con el viento».
    const enPueblo = obtenerLugar(ctx.mundo?.ubicacion)?.tipo === 'asentamiento';
    const atmosfera = dentro ? atmosferaInterior(dentro.tipo) : atmosferaDe(enPueblo ? 'ciudad' : (ctx.mundo?.terreno ?? 'camino'));
    const partes = [];

    // La hora y el clima son cosa de fuera. Bajo techo no se ve el cielo, y
    // recordar que llueve mientras estás a cubierto rompe la escena.
    if (!dentro) {
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
    }

    // Vista casi siempre; oído y olfato de forma alterna.
    partes.push(this._unico(atmosfera.vista));

    if (this._flujo().oportunidad(0.55)) partes.push(this._unico(atmosfera.sonido));
    if (this._flujo().oportunidad(0.3)) partes.push(this._unico(atmosfera.olfato));

    // Un detalle concreto: es lo que hace que el lugar parezca real en vez de
    // un decorado genérico.
    if (this._flujo().oportunidad(0.5)) partes.push(this._unico(atmosfera.detalle));

    // `frases` recorta el bloque cuando se usa como relleno. Se queda con las
    // primeras, que son las que sitúan: la hora, el clima y lo que se ve. El
    // olfato y el detalle son la guinda, y una guinda sobre un turno que ya
    // dice algo es justo el ruido que sobra.
    const elegidas = frases > 0 ? partes.slice(0, frases) : partes;

    return elegidas.map((p) => (p.endsWith('.') ? p : `${p}.`)).join(' ');
  }

  /**
   * Trae de vuelta algo que el jugador nombró.
   *
   * Es la pieza que convierte una sucesión de turnos en una historia: el
   * nombre que soltó hace diez turnos reaparece, y reaparece DICIENDO LO
   * MISMO. Si escribió «el capitán Verros, el que quemó mi forja», el juego
   * podrá hablar de Verros como capitán y como el que quemó la forja, y de
   * nada más, porque no tiene nada más.
   *
   * Esa pobreza es a propósito. Un narrador que solo repite lo que le dijeron
   * nunca se contradice, y la contradicción es lo que rompe una partida larga.
   * Lo que no sabe, no lo dice.
   *
   * @param {Object} ctx
   * @returns {string}
   * @private
   */
  _traerDelCanon(ctx, accion = '') {
    const canon = ctx.canon ?? [];
    if (!canon.length) return '';

    // Solo lo que el jugador nombra en esta acción. Antes se elegía al azar
    // entre lo que había repetido, y volvía cuando no venía a cuento: él
    // preguntaba por el pozo y el narrador le recordaba a Verros.
    const dicho = String(accion ?? '').toLowerCase();
    const candidatos = canon.filter((c) => c.nombre && dicho.includes(String(c.nombre).toLowerCase()));
    if (!candidatos.length) return '';

    const e = candidatos[0];
    const rasgo = e.rasgos[0] ?? '';

    // La nota se guarda tal y como la escribió el jugador —«quemó mi forja»—
    // porque el canon debe conservar sus palabras. Pero quien lo cuenta es el
    // narrador, y el narrador te habla de tú: sin esto salía «el que quemó mi
    // forja» en boca de alguien que no tiene forja.
    //
    // Solo los posesivos. El verbo no se toca: lo hizo Verros, no tú, y esa es
    // justo la confusión de persona que se arregló en `Persona.js`.
    const nota = (e.notas[0] ?? '')
      .replace(/\bmis\b/gi, 'tus').replace(/\bmi\b/gi, 'tu')
      .replace(/\bmías\b/gi, 'tuyas').replace(/\bmíos\b/gi, 'tuyos')
      .replace(/\bmía\b/gi, 'tuya').replace(/\bmío\b/gi, 'tuyo');

    if (e.tipo === 'lugar') {
      return this._unico([
        `${e.nombre} sigue ahí, en el mapa que llevas en la cabeza.`,
        `Piensas en ${e.nombre} sin querer, como se piensa en lo que queda pendiente.`,
        `Hay un camino que lleva a ${e.nombre}. No hoy, pero lo hay.`,
      ]);
    }

    if (e.tipo === 'cosa') {
      return this._unico([
        `Compruebas que ${e.nombre} sigue donde debe estar.`,
        `${e.nombre} pesa más de lo que debería, y no es por el metal.`,
      ]);
    }

    // Personas: el cargo y lo que el jugador contó, cosidos como oración de
    // relativo. Pegados con comas —«Verros, capitán, quemó mi forja»— sonaba a
    // ficha de archivo; con el «que» delante es una frase.
    //
    // Las palabras son las suyas, sin retocar: si escribió «capitan» sin
    // tilde, así se queda. Corregirle la ortografía sería meterse donde no nos
    // llaman, y peor, haría que su texto y el del juego dejaran de parecer lo
    // mismo.
    const quien = rasgo ? `${e.nombre}, el ${rasgo}` : e.nombre;

    if (nota) {
      // «quien» y no «el que»: del canon no sale el género de nadie, y llamar
      // «el que» a Elyndra o a Lyssara es inventarse la mitad del personaje.
      return this._unico([
        `Vuelve el mismo pensamiento: ${quien}, quien ${nota}.`,
        `${e.nombre}${rasgo ? `, el ${rasgo},` : ''} ${nota}. Eso no se va a ninguna parte.`,
        `No se te quita de la cabeza: ${quien}, quien ${nota}.`,
        `Piensas otra vez en ${quien}, quien ${nota}, y aprietas el paso.`,
      ]);
    }

    return this._unico([
      `El nombre de ${e.nombre} te ronda otra vez.`,
      `Piensas en ${quien} y en lo que falta por saber.`,
      `${e.nombre} sigue siendo un nombre y poco más. De momento.`,
    ]);
  }

  /**
   * ¿Está el personaje dentro de algún sitio?
   *
   * Vale tanto el sublugar donde ya está como el que acaba de nombrar en su
   * acción: quien escribe «entro en la taberna y me siento» está dentro a
   * efectos de lo que ve, aunque el estado aún no se haya actualizado.
   *
   * @param {Object} ctx
   * @returns {{refId: string, nombre: string, tipo: string}|null}
   * @private
   */
  _sublugarActual(ctx) {
    const lugar = obtenerLugar(ctx.mundo?.ubicacion);
    const sublugares = lugar?.sublugares ?? [];
    if (!sublugares.length) return null;

    const actual = ctx.mundo?.sublugar;
    if (actual) {
      const hallado = sublugares.find((s) => s.refId === actual);
      if (hallado) return hallado;
    }

    // Lo que nombra la acción, pero solo si dice que ENTRA o que ESTÁ ahí.
    //
    // Mencionar un sitio no es estar en él: «pregunto al herrero si ha oído
    // hablar del incendio» describía la fragua estando el personaje sentado en
    // la taberna. Hace falta un verbo de entrar o de estar, no una mención.
    const accion = String(ctx.accion ?? '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (!accion) return null;

    const entra = /\b(entro|entrar|entramos|paso a|me meto|voy a la|voy al|subo a|bajo a|estoy en|me siento en|dentro de|cruzo la puerta)\b/.test(accion);
    if (!entra) return null;

    const ALIAS = { posada: ['posada', 'taberna', 'meson'], herrero: ['fragua', 'herreria', 'herrero'], mercado: ['mercado', 'plaza', 'puesto'], templo: ['templo', 'santuario', 'capilla'] };

    return sublugares.find((s) => {
      const nombre = String(s.nombre ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      if (nombre && accion.includes(nombre)) return true;
      return (ALIAS[s.tipo] ?? [s.tipo]).some((a) => new RegExp(`\\b${a}`).test(accion));
    }) ?? null;
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
    if (ctx.mundo?.terreno === 'ciudad' || obtenerLugar(ctx.mundo?.ubicacion)?.tipo === 'asentamiento') grupos.push(AMBIENTE.ciudad);

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
  /**
   * El hilo abierto que viene a cuento ahora, si lo hay.
   *
   * Pertinente es que toque a quien está delante o al sitio donde se está.
   * Los hilos que nacían del pasado del personaje (`player_lore`) no vuelven
   * nunca solos: eran fragmentos de su biografía convertidos en ganchos.
   *
   * @param {Object} ctx
   * @returns {Object|null}
   * @private
   */
  _hiloPertinente(ctx) {
    const hilo = ctx.hiloParaRetomar;
    if (!hilo?.texto || /^player_lore/.test(hilo.relacionadoCon ?? '') || /^De su historia:/i.test(hilo.texto)) return null;

    const texto = String(hilo.texto).toLowerCase();
    const aqui = [
      ...(ctx.npcsPresentes ?? []).map((n) => n?.nombre),
      obtenerLugar(ctx.mundo?.ubicacion)?.nombre,
    ].filter(Boolean).map((x) => String(x).toLowerCase());
    const presentes = new Set((ctx.npcsPresentes ?? []).map((n) => n?.refId).filter(Boolean));

    const toca = presentes.has(hilo.relacionadoCon)
      || hilo.relacionadoCon === ctx.mundo?.ubicacion
      || aqui.some((x) => texto.includes(x));
    return toca ? hilo : null;
  }

  _recordarHilo(hilo, ctx) {
    // Los hilos de la historia del jugador llegan en su voz («Mi hermana
    // cruzó…»); se devuelven en la tuya y sin la etiqueta interna.
    const bruto = String(hilo.texto ?? '').replace(/^De su historia:\s*/i, '');
    const propio = bruto !== hilo.texto;

    if (propio) {
      const limpio = bruto.replace(/[.!?…]*$/u, '');

      // Solo se conjuga lo que viene en primera persona. El trasfondo lo suele
      // escribir el jugador en tercera, hablando de su personaje («Perdió la
      // forja de su padre»), y convertir eso producía «perdias la forja de su
      // padre»: verbo destrozado y posesivo sin tocar. En ese caso su texto se
      // deja tal cual y el encaje lo pone el narrador alrededor, con frases
      // que funcionan sin tener que tocarlo por dentro.
      if (esPrimeraPersona(limpio)) {
        const frase = aSegundaPersona(limpio).replace(/[.!?…]*$/u, '');
        return this._unico([
          `Y entonces lo recuerdas otra vez: ${frase.charAt(0).toLowerCase()}${frase.slice(1)}. No has venido hasta aquí para olvidarlo.`,
          `${capitalizar(frase)}. Lo piensas sin querer, como una piedra en la bota que no termina de salir.`,
          `Por un momento, el ruido de alrededor se apaga y solo queda eso: ${frase.charAt(0).toLowerCase()}${frase.slice(1)}.`,
        ]);
      }

      const suyo = capitalizar(limpio);
      return this._unico([
        `Vuelve a ti lo de siempre, con las mismas palabras de siempre. ${suyo}. Y aquí sigues.`,
        `${suyo}. Eso no se queda atrás por mucho camino que le eches.`,
        `Hay cosas que uno se lleva puestas. ${suyo}.`,
        `Por un momento el ruido se apaga y solo queda eso. ${suyo}.`,
      ]);
    }
    hilo = { ...hilo, texto: frase };
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

    // En combate la cadencia importa el doble: una frase por línea y el golpe
    // sonando en el crítico y en la pifia. Es donde el ritmo se nota, porque
    // es donde el jugador está pendiente de cada línea.
    return {
      schemaVersion: APP.versionContratoIA,
      story: Cadencia.montar(partes, {
        golpe: t?.critico ? 'critico' : t?.pifia ? 'pifia' : '',
        elegir: (lista) => this._unico(lista),
      }),
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
    const partes = [];

    // Contesta a quien se ha hablado, no al primero de la lista.
    //
    // «pregunto al tabernero por el incendio» en un vado, sin taberna,
    // contestaba Corlin sin más: el jugador no sabía si Corlin era el
    // tabernero, si había taberna o si el juego no le había escuchado. Si el
    // nombrado no está, se dice, y contesta quien sí está.
    const { npc, ausente } = this._aQuienSeHabla(peticion, ctx);
    if (ausente && npc) partes.push(`No hay ${ausente} por aquí. Quien te oye es ${npc.nombre}.`);

    if (!npc) {
      // Nadie con quien hablar: se genera alguien, que es más interesante que
      // decir «no hay nadie». Pero si preguntó por un oficio que aquí no hay,
      // se le dice antes de presentarle a otra persona.
      const generado = this._generarNPC(ctx);
      if (ausente) partes.push(`No hay ${ausente} por aquí.`);
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

    // Si le has PREGUNTADO algo, no te saluda.
    //
    // Antes salía siempre el saludo del catálogo, así que preguntar al herrero
    // por el incendio de Forja Alta devolvía «Buenas. ¿Qué necesitas?»: el PNJ
    // contestaba como si acabaras de entrar por la puerta. Es el fallo que más
    // rompe la ilusión de estar hablando con alguien.
    // Si ya os conocíais y ha pasado un rato, se acuerda. Antes de lo que
    // conteste: es lo primero que se nota al volver a alguien.
    const recuerdo = this._loQueRecuerda(npc, peticion.turno ?? ctx.turno ?? 0);
    if (recuerdo) partes.push(recuerdo);

    // Una negativa no se contesta con un saludo ni se tira: la reacción de
    // quien la oye la pone `_enriquecer`, desde lo que siente por él.
    const respuesta = ctx.negativa ? '' : this._responderPregunta(peticion, ctx, npc);

    if (respuesta) {
      partes.push(respuesta);
    } else if (!ctx.negativa) {
      partes.push(this._responderAfirmacion(peticion, ctx, npc, actitud));
    }

    return {
      schemaVersion: APP.versionContratoIA,
      story: partes.join(' '),
      choices: OPCIONES.npcPresente.map((o, i) => ({ ...o, id: `c${i + 1}` })),
      playerUpdates: {},
      newItems: [],
      quests: [],
      combat: {},
      // Se ha hablado con alguien concreto: los objetivos «Hablar con…» lo
      // necesitan saber.
      events: npc.refId ? [{ type: 'npc_talk', payload: { refId: npc.refId, nombre: npc.nombre }, silent: true }] : [],
      memory: [],
      mood: 'neutro',
    };
  }

  /**
   * A quién se dirige el jugador, y si ese alguien está en escena.
   *
   * Se busca el destinatario en la frase («pregunto AL tabernero», «hablo CON
   * la herrera») y se compara con el nombre y el oficio de quien está
   * presente. Los oficios tienen sinónimos porque la gente no escribe el
   * nombre de catálogo: dice «tabernero» y el catálogo dice «posadero».
   *
   * @returns {{npc: Object|null, ausente: string|null}} `ausente` ya lleva su
   *   determinante concordado: «ningún tabernero», «ninguna herrera».
   * @private
   */
  /**
   * Lo que un PNJ recuerda del jugador, dicho al volver a verle.
   *
   * Solo al reencontrarse (han pasado unos turnos desde la última vez) y con
   * algo que recordar. Una negativa se trae con las palabras exactas del
   * jugador: es lo único que se puede citar sin ponerle en la boca nada
   * que no dijo.
   *
   * @param {Object} npc Registro del PNJ, con `memoria` y `ultimoEncuentro`.
   * @param {number} turno
   * @returns {string}
   * @private
   */
  _loQueRecuerda(npc, turno) {
    const memoria = (npc?.memoria ?? []).filter((m) => m.tipo !== 'encuentro' && m.tipo !== 'actitud');
    if (!memoria.length) return '';
    const ultima = npc.ultimoEncuentro ?? null;
    if (ultima !== null && turno - ultima < 3) return '';

    const negativa = [...memoria].reverse().find((m) => m.tipo === 'negativa');
    if (negativa) {
      const cita = negativa.texto.match(/«[^»]*»|"[^"]*"|“[^”]*”/u)?.[0];
      if (cita) return `${npc.nombre} no ha olvidado lo que le dijiste: ${cita}.`;
    }

    const actitud = npc.actitud ?? 0;
    return actitud >= 30
      ? `${npc.nombre} te reconoce enseguida, y se le nota que se alegra.`
      : actitud <= -20
        ? `${npc.nombre} te reconoce, y no parece alegrarse.`
        : `${npc.nombre} te reconoce. Se acuerda de ti.`;
  }

  /**
   * Lo que contesta alguien a una frase que no es una pregunta.
   *
   * Contestaba siempre con un saludo de catálogo —«Pasa, pasa. ¿En qué te
   * ayudo?»— dijera el jugador lo que dijera. Ahora se mira qué es: un
   * saludo se devuelve, una petición se concede o no según la tirada, y lo
   * que se le cuenta se escucha.
   * @private
   */
  _responderAfirmacion(peticion, ctx, npc, actitud) {
    const dicho = sinAcentos(String(peticion.accion ?? '').toLowerCase());
    const t = peticion.tirada;

    if (/\b(?:hola|buenas|buenos dias|saludo|me presento)\b/.test(dicho)) {
      return this._unico(NPC.saludos[actitud] ?? NPC.saludos.cordial);
    }
    if (/\b(?:te pido|le pido|os pido|necesito|ayudame|me ayudas|podrias|puedes|dejame|me dejas)\b/.test(dicho)) {
      return t?.exito
        ? this._unico([`${npc.nombre} se lo piensa un momento y acaba asintiendo.`, `${npc.nombre} suspira. «Está bien. Pero que sea rápido.»`])
        : this._unico([`${npc.nombre} niega con la cabeza. «Eso no puedo hacerlo.»`, `${npc.nombre} te sostiene la mirada. «No.»`]);
    }
    if (/\b(?:cuento|le cuento|explico|le explico|le digo que|te digo que|le hablo de)\b/.test(dicho)) {
      return this._unico([
        `${npc.nombre} te escucha sin interrumpir. Cuando terminas, se queda un momento callado, midiéndote.`,
        `${npc.nombre} escucha con atención. No dice nada, pero algo ha cambiado en su gesto.`,
      ]);
    }
    const resultado = t ? ` ${this._narrarResultado(t, peticion.intencion)}` : '';
    return `${npc.nombre} te escucha.${resultado}`;
  }

  _aQuienSeHabla(peticion, ctx) {
    const presentes = ctx.npcsPresentes ?? [];
    const llano = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const frase = llano(ctx.foco ?? peticion.accion);

    const m = frase.match(/\b(?:pregunto|preguntar|hablo|hablar|digo|decir|le pregunto|le digo)\s+(?:a la|al|a|con la|con el|con)\s+([a-zñ]+)/u);
    const destinatario = m?.[1] ?? null;
    if (!destinatario) return { npc: presentes[0] ?? null, ausente: null };

    const SINONIMOS = {
      tabernero: ['tabernero', 'tabernera', 'posadero', 'posadera', 'mesonero', 'mesonera'],
      tabernera: ['tabernero', 'tabernera', 'posadero', 'posadera', 'mesonero', 'mesonera'],
      posadero: ['posadero', 'posadera', 'tabernero', 'tabernera'],
      posadera: ['posadero', 'posadera', 'tabernero', 'tabernera'],
      herrero: ['herrero', 'herrera', 'aprendiz de forja'],
      herrera: ['herrero', 'herrera', 'aprendiz de forja'],
      guardia: ['guardia', 'soldado', 'centinela'],
      soldado: ['guardia', 'soldado', 'centinela'],
    };
    const buscados = SINONIMOS[destinatario] ?? [destinatario];

    const npc = presentes.find((n) => {
      const nombre = llano(n.nombre);
      const rol = llano(n.rol);
      return nombre.split(/\s+/).includes(destinatario) || buscados.some((b) => rol.includes(b));
    });

    if (npc) return { npc, ausente: null };

    // Solo se dice «no hay» de un oficio, no de un nombre propio: si pregunta
    // por «Helta» y no está, eso es asunto de la pregunta, no del destinatario.
    const esOficio = Boolean(SINONIMOS[destinatario]) || /(ero|era|ista|ante|dor|dora)$/.test(destinatario);
    if (!esOficio) return { npc: presentes[0] ?? null, ausente: null };

    const EPICENOS = new Set(['guardia', 'centinela', 'guia']);
    const femenino = /a$/.test(destinatario) && !EPICENOS.has(destinatario);
    return { npc: presentes[0] ?? null, ausente: `${femenino ? 'ninguna' : 'ningún'} ${destinatario}` };
  }

  /**
   * Contesta a una pregunta concreta, recogiendo el tema.
   *
   * Devuelve `null` si la acción no era una pregunta, y entonces el saludo del
   * catálogo sigue valiendo.
   *
   * Lo que hace que esto funcione no es la plantilla: es el TEMA. «¿Forja
   * Alta? Eso queda lejos» convence porque repite lo que preguntaste; «Buenas,
   * ¿qué necesitas?» no convence de nada porque vale para cualquier cosa. Se
   * saca el sustantivo clave de la pregunta y se mete en la respuesta.
   *
   * El resultado de la tirada decide qué tipo de respuesta toca: con éxito hay
   * pista de verdad, atada a los ganchos del lugar o al hilo del jugador; con
   * fallo hay evasiva creíble, que no es lo mismo que silencio.
   *
   * @param {Object} peticion
   * @param {Object} ctx
   * @param {Object} npc
   * @returns {string|null}
   * @private
   */
  _responderPregunta(peticion, ctx, npc) {
    const accion = String(ctx.foco ?? peticion.accion ?? '').trim();
    if (!accion) return null;

    const plano = accion.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

    // Sin `\b` de cierre: lo llevaba y por eso no casaba nunca con la forma
    // que de verdad escribe la gente. «pregunto» sigue a «pregunt» con una
    // letra, así que el límite de palabra fallaba justo ahí y el PNJ volvía a
    // saludar en vez de contestar.
    const esPregunta = accion.includes('?')
      || /\b(pregunt|le digo si|si ha visto|si sabe|sabe algo|ha oido|has oido|que sabe|quien|donde|cuando|por que|cuanto)/.test(plano);
    if (!esPregunta) return null;

    const tema = this._temaDePregunta(accion, npc.nombre);
    const nombre = npc.nombre ?? 'quien tienes delante';

    // Lo que este lugar puede ofrecer de verdad como pista.
    const lugar = obtenerLugar(ctx.mundo?.ubicacion);
    const gancho = (lugar?.ganchos ?? [])[0] ?? null;

    const exito = peticion.tirada ? peticion.tirada.exito : true;

    // Toda respuesta nombra lo que se preguntó.
    //
    // Dos de las tres variantes de éxito y dos de fallo no lo hacían: «Mira»,
    // dice Corlin, y no termina la frase. Suena a respuesta y no responde a
    // nada. Si el jugador preguntó por el incendio, la respuesta habla del
    // incendio, aunque sea para no decir nada de él.
    const Tema = tema ? capitalizar(tema) : 'Eso';

    // ¿Pregunta por su propia historia? Entonces quien contesta reacciona a
    // eso, sin inventar hechos: el pasado del personaje lo escribe el jugador.
    const suyo = this._tocaSuPasado(tema, ctx.jugador?.lore);

    if (exito) {
      const reaccion = suyo ? 'Sabe de qué le hablas, y se le nota. ' : '';
      const pista = gancho
        ? `Y añade algo que no esperabas: ${gancho.charAt(0).toLowerCase()}${gancho.slice(1)}`
        : 'Y lo que cuenta encaja con lo que ya sospechabas';

      return reaccion + this._unico([
        `${nombre} tarda en contestar. «¿${Tema}?… Algo se dice.» ${pista}.`,
        `«${Tema}», repite ${nombre}, como si la palabra pesara. Luego habla. ${pista}.`,
        `Cuando nombras ${tema || 'eso'}, ${nombre} mira alrededor antes de responder, y eso ya te dice algo. ${pista}.`,
      ]);
    }

    return this._unico([
      `«¿${Tema}? Eso queda lejos de mis asuntos», dice ${nombre}. «Pregunta a los carreteros, que van y vienen.»`,
      `${nombre} se encoge de hombros. «¿${Tema}? Ni idea. Aquí cada uno se ocupa de lo suyo.»`,
      `«${Tema}… mira», dice ${nombre}, y no termina la frase. Vuelve a lo que estaba haciendo.`,
    ]);
  }

  /**
   * ¿El tema de la pregunta sale de la historia que escribió el jugador?
   *
   * Basta una palabra con peso en común: «el incendio de la forja» y «Perdí la
   * forja de mi padre en un incendio» comparten «incendio» y «forja».
   *
   * @param {string} tema
   * @param {string} lore
   * @returns {boolean}
   * @private
   */
  _tocaSuPasado(tema, lore) {
    if (!tema || !lore) return false;
    const llano = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const del = new Set(llano(lore).split(/[^a-zñ]+/u).filter((p) => p.length >= 5));
    return llano(tema).split(/[^a-zñ]+/u).some((p) => p.length >= 5 && del.has(p));
  }

  /**
   * El sustantivo clave por el que se pregunta.
   *
   * Primero los nombres propios, que es lo que suele importar —«Forja Alta»,
   * «Helta»—, y si no hay, el sintagma detrás de la preposición.
   *
   * @param {string} accion
   * @returns {string}
   * @private
   */
  _temaDePregunta(accion, aQuien = '') {
    // El nombre de a quien se pregunta no es el tema: «pregunto a Corlia por
    // el hierro» es sobre el hierro. Salía «Cuando nombras Corlia, Corlia mira
    // alrededor…».
    const propio = accion.match(/\b([A-ZÁÉÍÓÚÑ][a-záéíóúñü]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñü]+)*)\b/g)
      ?.filter((p) => !/^(Pregunto|Preguntar|Le|Si|El|La|Los|Las|Un|Una|Y|Que|Por|Del?)$/i.test(p))
      .filter((p) => !aQuien || p.toLowerCase() !== String(aQuien).toLowerCase());

    if (propio?.length) return propio[propio.length - 1];

    // Lo que va detrás de «por», «sobre» o «acerca de», entero y con su
    // artículo: «el incendio de la forja». Antes se cortaba en dos palabras y
    // salía «¿Incendio de?», que no es una pregunta que nadie repita.
    const tras = accion.match(/\b(?:por|sobre|acerca de)\s+([^,.;:!?¿¡«»"]+)/i)?.[1];
    if (tras) {
      const palabras = tras.trim().split(/\s+/).slice(0, 6);
      // Sin preposiciones ni artículos colgando al final.
      while (palabras.length && /^(de|del|la|el|los|las|a|al|en|con|y|que|un|una)$/i.test(palabras.at(-1))) palabras.pop();
      if (palabras.length) return palabras.join(' ');
    }

    const sintagma = accion.match(/\b(?:del|de la|de)\s+(?:el |la |los |las |un |una )?([a-záéíóúñü]+(?:\s+[a-záéíóúñü]+)?)/i);
    return sintagma?.[1]?.trim() ?? '';
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

    // Antes de inventar a nadie, se mira si el jugador ya nombró a alguien que
    // aún no ha aparecido.
    //
    // Es la diferencia entre un mundo que responde y uno que solo produce.
    // Quien lleva tres turnos preguntando por el capitán Verros no necesita
    // conocer a un tal Korsel: necesita que Verros aparezca. Y cuando aparece,
    // aparece con lo que el jugador dijo de él, no con un oficio del dado.
    const pendiente = (ctx.canon ?? [])
      .find((c) => c.tipo === 'persona' && c.rasgos.length && !c.presentado);

    if (pendiente && flujo.oportunidad(0.45)) {
      const rol = pendiente.rasgos[0];
      const nota = pendiente.notas[0] ?? '';

      return {
        datos: {
          refId: `npc_${pendiente.nombre.toLowerCase().replace(/\s+/g, '_')}`,
          nombre: pendiente.nombre,
          rol,
          rasgo: nota || rol,
          actitud: 'cauto',
        },
        presentacion: nota
          ? `Y entonces lo ves: ${pendiente.nombre}. El mismo ${rol} del que no has dejado de hablar, el que ${nota}.`
          : `Y entonces lo ves: ${pendiente.nombre}, el ${rol}. En carne y hueso, por fin.`,
      };
    }

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
    if (lista.length === 1) return lista[0];

    // La familia se identifica por su contenido: la misma lista, llamada desde
    // donde sea, comparte memoria. Cambiar una opción crea una familia nueva,
    // que es lo correcto: ya no es la misma baraja.
    const familia = lista.join('\u0001');
    const recientes = this._porFamilia.get(familia) ?? [];

    // Se descartan las últimas N-1: así SIEMPRE queda al menos una candidata y
    // no hace falta el recurso de «si no hay, vale cualquiera», que era justo
    // por donde se colaban las repeticiones.
    const disponibles = lista.filter((f) => !recientes.includes(f));
    const elegido = this._flujo().elegir(disponibles.length ? disponibles : lista);

    recientes.push(elegido);
    while (recientes.length > lista.length - 1) recientes.shift();
    this._porFamilia.set(familia, recientes);

    // La ventana global se mantiene: sirve para que dos familias distintas no
    // suelten la misma frase si alguna vez comparten texto.
    this._usados.add(elegido);

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
