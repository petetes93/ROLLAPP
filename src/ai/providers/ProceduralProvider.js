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
  atmosferaDe, resultadosDe, categoriaDe,
  FRANJA, CLIMA, COMBATE, NPC, OPCIONES, CIERRES, AMBIENTE,
} from '../../data/narrative.templates.js';
import { APP } from '../../config/app.config.js';
import { capitalizar } from '../../utils/text.js';
import { aSegundaPersona, esPrimeraPersona } from '../Persona.js';
import { obtenerLugar } from '../../data/locations.data.js';

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
    const npc = ctx.npcsPresentes?.[0];
    const t = peticion.tirada;
    const mereceLaPena = Boolean(escena) || Boolean(t?.critico) || Boolean(t?.pifia);

    if (accion && npc?.nombre && !String(r.story).includes(npc.nombre)
        && (mereceLaPena || this._flujo().entero(0, 2) === 0)) {
      parrafos.push(this._unico([
        `${npc.nombre} no te quita ojo. Por su gesto, lo que acabas de hacer le ha dicho de ti más que cualquier presentación.`,
        `${npc.nombre} deja lo que estaba haciendo y te mira de otra manera, como quien recoloca una pieza en un tablero.`,
        `A tu lado, ${npc.nombre} suelta el aire despacio. No dice nada todavía, pero ha tomado nota.`,
      ]));
    }

    // Nunca una sola línea: el mundo sigue vivo alrededor y el hilo personal
    // asoma de vez en cuando. Con una escena de verdad delante, esto ya no
    // hace falta: el relleno existe para que el turno no quede desnudo.
    if (!escena && parrafos.length < 3) {
      const atm = this._componerAtmosfera(ctx);
      if (atm && !r.story?.includes(atm)) parrafos.push(atm);
    }
    if (!escena && parrafos.length < 3 && ctx.hiloParaRetomar?.texto) {
      parrafos.push(this._recordarHilo(ctx.hiloParaRetomar, ctx));
    } else if (!escena && parrafos.length < 3) {
      const amb = this._elegirAmbiente(ctx);
      if (amb) parrafos.push(amb);
    }

    return {
      ...r,
      story: parrafos.join('\n\n'),
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
    const lore = String(ctx.jugador?.lore ?? '').toLowerCase();
    const vinculo = lore.match(/\b(hermana|hermano|padre|madre|hija|hijo|maestra|maestro|amiga|amigo|mentor|esposa|esposo|prometida|prometido)\b/)?.[1];
    const objeto = lore.match(/\b(medallón|colgante|anillo|espada|carta|mapa|libro|amuleto|diario|llave)\b/)?.[1];

    const candidatas = [];
    if (npc?.nombre) {
      if (vinculo) candidatas.push({ label: `Preguntar a ${npc.nombre} por tu ${vinculo}`, intent: 'talk', risk: 'low' });
      candidatas.push({ label: `Ganarte la confianza de ${npc.nombre}`, intent: 'persuade', risk: 'low' });
      candidatas.push({ label: `Observar a ${npc.nombre} sin que lo note`, intent: 'observe', risk: 'low' });
    }
    if (objeto && vinculo) candidatas.push({ label: `Enseñar el ${objeto} y preguntar por tu ${vinculo}`, intent: 'talk', risk: 'low' });
    else if (vinculo) candidatas.push({ label: `Buscar a alguien que conozca a tu ${vinculo}`, intent: 'talk', risk: 'low' });

    const sub = this._flujo().elegir(lugar?.sublugares ?? []);
    if (sub?.nombre) candidatas.push({ label: `Ir a ${sub.nombre.replace(/^(La|El|Los|Las) /, (m) => m.toLowerCase())}`, intent: 'explore', risk: 'low' });

    const conexion = this._flujo().elegir(lugar?.conexiones ?? []);
    const destino = conexion ? obtenerLugar(conexion.hasta) : null;
    if (destino?.nombre) candidatas.push({ label: `Tomar el camino hacia ${destino.nombre}`, intent: 'travel', risk: conexion.peligro > 1 ? 'medium' : 'low' });

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

    // ─── 0. Canon personal ─────────────────────────────────────────────
    // La apertura procedural debe demostrar que leyó la historia escrita por
    // el jugador. No espera a un modelo remoto ni a que pasen veinte turnos.
    if ((peticion.turno ?? ctx.turno) <= 1 && ctx.jugador?.lore) {
      parrafos.push(this._abrirDesdeLore(ctx.jugador.lore));
    }

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

  /** Abre la campaña desde una pieza concreta del canon del jugador. */
  _abrirDesdeLore(lore) {
    const limpio = String(lore).replace(/\s+/g, ' ').trim();
    const primera = aSegundaPersona(limpio.split(/(?<=[.!?…])\s+/u)[0].slice(0, 220).replace(/[.!?…]+$/u, ''));
    if (!primera) return '';
    return this._unico([
      `Tu pasado no te ha dejado llegar aquí por azar. ${capitalizar(primera)}. Hoy ese hilo vuelve a tensarse.`,
      `Hay una razón personal detrás de cada paso que te trajo hasta aquí: ${primera.toLowerCase()}. Algo en este lugar promete removerla.`,
      `Lo que dejaste atrás sigue viajando contigo. ${capitalizar(primera)}. Esta jornada podría acercarte a una respuesta.`,
    ]);
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
