/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · quests/QuestGenerator.js
 * ---------------------------------------------------------------------------
 * Generación de misiones a partir del mundo.
 *
 * El mundo ya produce oportunidades: los lugares tienen `ganchos`, los eventos
 * dinámicos abren situaciones y los PNJ guardan secretos. Este módulo las
 * convierte en misiones jugables, con objetivos que el motor puede seguir.
 *
 * Tres fuentes, por orden de calidad:
 *
 *   1. GANCHOS DEL MUNDO — lo mejor. Ya tienen contexto y encajan con el sitio.
 *   2. PLANTILLAS — encargos genéricos poblados con datos reales del mundo.
 *   3. DEL DIRECTOR — lo que el modelo declara, normalizado y acotado.
 *
 * La segunda merece defensa: un encargo genérico es aburrido si dice «mata seis
 * lobos». Deja de serlo cuando el lobo es una manada concreta que ataca a una
 * aldea concreta cuyo nombre conoces. Las plantillas aquí se rellenan con
 * enemigos del terreno, lugares del mapa y PNJ presentes.
 *
 * Funciones puras.
 *
 * Dependencias: Quest, Objective, datos del mundo.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as Q from './Quest.js';
import * as Obj from './Objective.js';
import { obtenerLugar, obtenerRegion, lugaresDe } from '../data/locations.data.js';
import { apropiados as enemigosApropiados } from '../data/enemies.data.js';
import { obtenerFaccion } from '../data/factions.data.js';
import { xpPorMision } from '../player/Progression.js';
import { nombreAleatorio } from '../player/CharacterRandom.js';
import { trasPreposicion, sinAcentos } from '../utils/text.js';

/* ═══════════════════════════════════════════════════════════════════════════
   PLANTILLAS
   ---------------------------------------------------------------------------
   Cada una declara qué necesita del mundo para poder generarse. Si el contexto
   no lo tiene, la plantilla se descarta en vez de inventar.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Plantilla
 * @property {string} clave
 * @property {string} tipo principal|secundaria|menor
 * @property {number} peso
 * @property {string[]} requiere Qué debe existir en el contexto.
 * @property {Function} construir Devuelve los datos de la misión.
 */

/** @type {Plantilla[]} */
export const PLANTILLAS = Object.freeze([

  /* ─── Limpieza de amenaza ────────────────────────────────────────────── */
  {
    clave: 'amenaza_local',
    tipo: 'secundaria',
    peso: 70,
    requiere: ['enemigo', 'lugar'],
    construir: ({ enemigo, lugar, npc, flujo }) => {
      const cantidad = flujo.entero(3, 6);

      return {
        titulo: `${_capitalizar(enemigo.plural)} en ${lugar.nombre}`,
        resumen:
          `${_capitalizar(enemigo.plural)} llevan semanas rondando ${lugar.nombre} y la ` +
          `gente ya no se atreve a salir de noche. Alguien tiene que ocuparse.`,
        promptDirector:
          `Encargo de limpieza: ${enemigo.plural} amenazan ${lugar.nombre}. ` +
          `${enemigo.promptLore} El encargo lo hace ${npc?.nombre ?? 'alguien del lugar'}, ` +
          `que está harto y algo asustado.`,
        objetivos: [
          Obj.crear({
            clase: 'matar',
            objetivo: enemigo.refId,
            nombreObjetivo: enemigo.plural,
            cantidad,
          }),
        ],
        recompensa: {
          xp: xpPorMision('secundaria'),
          oro: cantidad * 12 + enemigo.nivel * 8,
        },
        plazoDias: null,
      };
    },
  },

  /* ─── Recado de entrega ──────────────────────────────────────────────── */
  {
    clave: 'entrega',
    tipo: 'menor',
    peso: 60,
    requiere: ['npc', 'lugarLejano'],
    construir: ({ npc, lugarLejano, flujo }) => ({
      titulo: `Un paquete para ${lugarLejano.nombre}`,
      resumen:
        `${npc.nombre} necesita hacer llegar algo a ${lugarLejano.nombre} y no puede ` +
        `ir en persona. Dice que no preguntes qué hay dentro.`,
      promptDirector:
        `${npc.nombre} encarga llevar un paquete a ${lugarLejano.nombre}. ` +
        `El contenido es material narrativo: puede ser inocente o no. ` +
        `Si el personaje lo abre, que tenga consecuencias.`,
      objetivos: [
        Obj.crear({
          clase: 'llegar',
          objetivo: lugarLejano.refId,
          nombreObjetivo: lugarLejano.nombre,
        }),
        Obj.crear({
          clase: 'libre',
          descripcion: 'Entregar el paquete a quien corresponda',
        }),
      ],
      recompensa: {
        xp: xpPorMision('menor'),
        oro: flujo.entero(25, 60),
      },
      plazoDias: flujo.entero(6, 12),
    }),
  },

  /* ─── Búsqueda de material ───────────────────────────────────────────── */
  {
    clave: 'recolecta',
    tipo: 'menor',
    peso: 55,
    requiere: ['npc', 'material'],
    construir: ({ npc, material, flujo }) => {
      const cantidad = flujo.entero(4, 8);

      return {
        titulo: `${_capitalizar(material.nombre)} para ${npc.nombre}`,
        resumen:
          `${npc.nombre} necesita ${cantidad} de ${material.nombre.toLowerCase()} y ` +
          `paga bien por ahorrarse el paseo.`,
        promptDirector:
          `${npc.nombre} necesita ${material.nombre.toLowerCase()}. Que explique para qué ` +
          `lo quiere, aunque sea de forma vaga.`,
        objetivos: [
          Obj.crear({
            clase: 'recoger',
            objetivo: material.refId,
            nombreObjetivo: material.nombre.toLowerCase(),
            cantidad,
          }),
        ],
        recompensa: {
          xp: xpPorMision('menor'),
          oro: cantidad * (material.valor ?? 5) * 2,
        },
        plazoDias: null,
      };
    },
  },

  /* ─── Investigación ──────────────────────────────────────────────────── */
  {
    clave: 'investigar',
    tipo: 'secundaria',
    peso: 50,
    requiere: ['lugarDesconocido'],
    construir: ({ lugarDesconocido }) => ({
      titulo: `Qué pasa en ${lugarDesconocido.nombre}`,
      resumen:
        `Hay historias sobre ${lugarDesconocido.nombre} y ninguna coincide. ` +
        `Alguien tendría que ir y volver para contarlo.`,
      promptDirector:
        `Encargo de investigación sobre ${lugarDesconocido.nombre}. ` +
        `${lugarDesconocido.promptLore} Lo que el personaje encuentre allí es cosa tuya, ` +
        `pero que valga el viaje.`,
      objetivos: [
        Obj.crear({
          clase: 'llegar',
          objetivo: lugarDesconocido.refId,
          nombreObjetivo: lugarDesconocido.nombre,
        }),
        Obj.crear({ clase: 'libre', descripcion: 'Averiguar qué ocurre allí' }),
        Obj.crear({
          clase: 'libre',
          descripcion: 'Volver con lo que hayas descubierto',
          oculto: true,
        }),
      ],
      recompensa: {
        xp: xpPorMision('secundaria'),
        oro: 80 + (lugarDesconocido.peligro ?? 1) * 25,
      },
      plazoDias: null,
    }),
  },

  /* ─── Escolta ────────────────────────────────────────────────────────── */
  {
    clave: 'escolta',
    tipo: 'secundaria',
    peso: 40,
    requiere: ['npc', 'lugarLejano'],
    construir: ({ npc, lugarLejano, flujo }) => ({
      titulo: `Acompañar a ${npc.nombre}`,
      resumen:
        `${npc.nombre} tiene que llegar a ${lugarLejano.nombre} y el camino no está ` +
        `para ir solo. Busca a alguien que sepa defenderse.`,
      promptDirector:
        `Escolta hasta ${lugarLejano.nombre}. ${npc.nombre} viaja con el personaje: ` +
        `dale conversación y opiniones. Si hay peligro, que reaccione según su carácter. ` +
        `Si muere, la misión fracasa.`,
      objetivos: [
        Obj.crear({
          clase: 'llegar',
          objetivo: lugarLejano.refId,
          nombreObjetivo: lugarLejano.nombre,
        }),
        Obj.crear({ clase: 'libre', descripcion: `Que ${npc.nombre} llegue con vida` }),
      ],
      recompensa: {
        xp: xpPorMision('secundaria'),
        oro: flujo.entero(70, 140),
        actitud: 30,
      },
      plazoDias: flujo.entero(8, 15),
      consecuenciaFracaso: 'muerte del escoltado',
    }),
  },

  /* ─── Asunto de facción ──────────────────────────────────────────────── */
  {
    clave: 'faccion',
    tipo: 'secundaria',
    peso: 45,
    requiere: ['faccion', 'npc'],
    construir: ({ faccion, npc, flujo }) => ({
      titulo: `Un asunto de ${faccion.nombre}`,
      resumen:
        `${faccion.nombre} tiene un problema que prefiere no registrar. ` +
        `${npc.nombre} pregunta si te interesa resolverlo.`,
      promptDirector:
        `Encargo de ${faccion.nombre}: ${faccion.promptLore} ` +
        `El trabajo debe encajar con lo que la facción valora (${faccion.valora.join(', ')}) ` +
        `y no puede ser algo que desprecie.`,
      objetivos: [
        Obj.crear({ clase: 'libre', descripcion: 'Resolver el asunto como te parezca' }),
        Obj.crear({ clase: 'libre', descripcion: 'Informar del resultado', oculto: true }),
      ],
      recompensa: {
        xp: xpPorMision('secundaria'),
        oro: flujo.entero(60, 120),
        reputacion: { faccion: faccion.refId, cantidad: 15 },
      },
      plazoDias: flujo.entero(10, 20),
    }),
  },

  /* ─── Favor personal ─────────────────────────────────────────────────── */
  {
    clave: 'favor_personal',
    tipo: 'menor',
    peso: 35,
    requiere: ['npc'],
    construir: ({ npc, flujo }) => ({
      titulo: `Lo que le debes a ${npc.nombre}`,
      resumen: `${npc.nombre} te pide algo. No es gran cosa, pero se acordará de si lo haces.`,
      promptDirector:
        `Favor personal de ${npc.nombre}. Que sea pequeño y concreto, algo que encaje ` +
        `con su oficio y su carácter. La recompensa es su aprecio, no el dinero.`,
      objetivos: [
        Obj.crear({ clase: 'libre', descripcion: `Hacer lo que ${npc.nombre} te ha pedido` }),
      ],
      recompensa: {
        xp: xpPorMision('menor'),
        oro: flujo.entero(10, 30),
        actitud: 35,
      },
      plazoDias: flujo.entero(5, 10),
    }),
  },
]);

/* ═══════════════════════════════════════════════════════════════════════════
   GENERACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Genera una misión adecuada al contexto.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Object} contexto
 * @param {string} contexto.lugar refId del lugar actual.
 * @param {Object} [contexto.npc] Quien la encarga.
 * @param {number} [contexto.nivelJugador]
 * @param {Set<string>} [contexto.lugaresConocidos]
 * @param {string[]} [contexto.plantillasUsadas] Para no repetir.
 * @returns {import('./Quest.js').Mision|null}
 */
export function generar(flujo, contexto) {
  const material = _reunirMaterial(flujo, contexto);

  // Se descartan las plantillas cuyo material no está disponible.
  const viables = PLANTILLAS.filter((p) => {
    if (contexto.plantillasUsadas?.includes(p.clave)) return false;
    return p.requiere.every((r) => Boolean(material[r]));
  });

  if (!viables.length) return null;

  const plantilla = flujo.elegirPonderado(viables.map((p) => ({ valor: p, peso: p.peso })));
  if (!plantilla) return null;

  const datos = plantilla.construir({ ...material, flujo });

  return Q.crear({
    ...datos,
    tipo: plantilla.tipo,
    origen: contexto.npc?.refId ?? null,
    nombreOrigen: contexto.npc?.nombre ?? null,
    faccion: material.faccion?.refId ?? contexto.npc?.faccion ?? null,
    lugar: contexto.lugar,
    turnoOferta: contexto.turno,
    plantilla: plantilla.clave,
  });
}

/**
 * Reúne del mundo el material con que poblar las plantillas.
 *
 * Es lo que separa un encargo genérico de uno que parece escrito para este
 * sitio: los enemigos salen del terreno real, los lugares del mapa real y las
 * facciones de las que mandan aquí.
 *
 * @private
 */
function _reunirMaterial(flujo, contexto) {
  const lugar = obtenerLugar(contexto.lugar);
  const region = obtenerRegion(lugar?.region);

  const material = { lugar, region, npc: contexto.npc };

  // ─── Enemigo del terreno ────────────────────────────────────────────────
  const candidatos = enemigosApropiados(
    lugar?.terreno,
    contexto.nivelJugador ?? 1,
    { margen: 1 },
  );

  if (candidatos.length) material.enemigo = flujo.elegir(candidatos);

  // ─── Lugar lejano conocido ──────────────────────────────────────────────
  // Para las entregas y escoltas hace falta un destino que el jugador sepa
  // alcanzar; si no, la misión sería imposible.
  const conocidos = [...(contexto.lugaresConocidos ?? [])]
    .map((refId) => obtenerLugar(refId))
    .filter((l) => l && l.refId !== contexto.lugar);

  if (conocidos.length) material.lugarLejano = flujo.elegir(conocidos);

  // ─── Lugar desconocido de la región ─────────────────────────────────────
  const desconocidos = lugaresDe(lugar?.region ?? '')
    .filter((l) => !contexto.lugaresConocidos?.has(l.refId))
    .filter((l) => l.descubrimiento !== 'mision');

  if (desconocidos.length) material.lugarDesconocido = flujo.elegir(desconocidos);

  // ─── Facción del encargante ─────────────────────────────────────────────
  if (contexto.npc?.faccion) {
    material.faccion = obtenerFaccion(contexto.npc.faccion);
  }

  // ─── Material recolectable ──────────────────────────────────────────────
  material.material = _materialDelTerreno(flujo, lugar?.terreno);

  return material;
}

/**
 * Elige un material recolectable coherente con el terreno.
 * @private
 */
function _materialDelTerreno(flujo, terreno) {
  const porTerreno = {
    bosque: [
      { refId: 'hierbas_curativas', nombre: 'Hierbas curativas', valor: 8 },
      { refId: 'madera_noble', nombre: 'Madera noble', valor: 12 },
    ],
    montana: [
      { refId: 'lingote_hierro', nombre: 'Lingotes de hierro', valor: 15 },
      { refId: 'cristal_bruto', nombre: 'Cristal en bruto', valor: 20 },
    ],
    pantano: [
      { refId: 'hongo_velo', nombre: 'Hongos del velo', valor: 18 },
      { refId: 'hierbas_curativas', nombre: 'Hierbas curativas', valor: 8 },
    ],
    ruinas: [{ refId: 'fragmento_albar', nombre: 'Fragmentos albares', valor: 25 }],
    desierto: [{ refId: 'sal_roja', nombre: 'Sal roja', valor: 14 }],
    mazmorra: [{ refId: 'fragmento_albar', nombre: 'Fragmentos albares', valor: 25 }],
  };

  const opciones = porTerreno[terreno];
  return opciones ? flujo.elegir(opciones) : null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   DESDE GANCHOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Convierte un gancho del mundo en una misión.
 *
 * Los ganchos son la mejor fuente: ya tienen contexto y encajan con el lugar o
 * el evento que los produjo. Lo que falta es estructura, y eso se añade aquí.
 *
 * El objetivo queda deliberadamente abierto: el gancho describe una situación,
 * no una tarea, y el director la desarrollará. Por eso son objetivos `libre`
 * que él marca al resolverse.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {string} gancho Texto del gancho.
 * @param {Object} contexto
 * @returns {import('./Quest.js').Mision}
 */
export function desdeGancho(flujo, gancho, contexto = {}) {
  const lugar = obtenerLugar(contexto.lugar);

  return Q.crear({
    titulo: _tituloDesde(gancho),
    resumen: gancho,
    tipo: contexto.tipo ?? 'secundaria',

    objetivos: [
      Obj.crear({ clase: 'libre', descripcion: 'Averiguar de qué va esto' }),
      Obj.crear({ clase: 'libre', descripcion: 'Resolverlo', oculto: true }),
    ],

    recompensa: {
      xp: xpPorMision(contexto.tipo ?? 'secundaria'),
      oro: flujo.entero(50, 120),
    },

    origen: contexto.origen,
    nombreOrigen: contexto.nombreOrigen,
    lugar: contexto.lugar,
    turnoOferta: contexto.turno,

    promptDirector:
      `Esta misión nace de una situación abierta: «${gancho}» ` +
      `Desarróllala como te parezca. Los objetivos son deliberadamente vagos: ` +
      `márcalos cumplidos cuando el personaje haga lo que corresponda.` +
      (lugar ? ` Ocurre en ${lugar.nombre}.` : ''),
  });
}

/**
 * Extrae un título de un gancho narrativo.
 * @private
 */
function _tituloDesde(gancho) {
  const limpio = String(gancho ?? '').trim();

  // Se corta por la primera pausa fuerte, que suele separar la premisa.
  const corte = limpio.split(/[,.:;]/)[0];

  if (corte.length >= 12 && corte.length <= 60) {
    return corte.charAt(0).toUpperCase() + corte.slice(1);
  }

  return limpio.length > 60 ? `${limpio.slice(0, 57)}…` : limpio;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MISIÓN PRINCIPAL DESDE LA HISTORIA DEL PERSONAJE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Oficio de quien da la pista, según de qué hable la historia.
 *
 * «Perdí la forja de mi padre» pide un herrero: es quien sabría de hierro con
 * una marca. Si la historia no da pistas de oficio, una posadera, que en
 * cualquier pueblo es quien más oye.
 */
const OFICIO_POR_TEMA = Object.freeze([
  [/forj|herrer|hierro|yunque|acero|martillo/, { m: 'herrero', f: 'herrera' }],
  [/barc|rio|vado|puerto|barqu|pesca/, { m: 'barquero', f: 'barquera' }],
  [/templo|sacerdot|dios|diosa|fe|monj|rezo|oracion/, { m: 'sacerdote', f: 'sacerdotisa' }],
  [/bosque|caza|arco|rastro|lobo/, { m: 'cazador', f: 'cazadora' }],
  [/libro|mapa|saber|escrib|biblioteca|runa/, { m: 'escriba', f: 'escriba' }],
  [/mercad|comerci|oro|deuda|caravana/, { m: 'mercader', f: 'mercader' }],
]);

const VINCULOS = /\b(hermana|hermano|madre|padre|hija|hijo|maestra|maestro|mentora|mentor|amiga|amigo|esposa|esposo|abuela|abuelo)\b/;
const OBJETOS = /\b(medallon|anillo|espada|libro|mapa|llave|reliquia|amuleto|colgante|daga|diario|carta)\b/;
const OBJETO_GENERO = { medallon: 'm', anillo: 'm', libro: 'm', mapa: 'm', diario: 'm', amuleto: 'm', colgante: 'm', espada: 'f', llave: 'f', reliquia: 'f', daga: 'f', carta: 'f' };
const CON_TILDE = { medallon: 'medallón' };

/**
 * De qué va la historia, en el mismo orden de prioridad que los hilos del
 * lore: una relación pesa más que una amenaza, y una amenaza más que un
 * objeto, porque es lo que más empuja a moverse.
 * @private
 */
function _temaDeHistoria(llano) {
  const vinculo = llano.match(VINCULOS)?.[1];

  // El pariente es a quien se busca solo si es el objeto de la pérdida:
  // «busco a mi hermana», «mi hermana cruzó el Umbral». En «la forja de mi
  // padre» el padre es de quién era la forja, y lo que se perdió es la forja.
  const V = VINCULOS.source.replace(/^\\b\(|\)\\b$/g, '');
  const buscado = new RegExp(
    `\\b(?:busco a|perdi a|encontrar a|llevaron a|secuestraron a|mataron a)\\s+(?:mi|nuestra|nuestro)\\s+(${V})\\b`
    + `|\\b(?:mi|nuestra|nuestro)\\s+(${V})\\s+(?:cruzo|se fue|desaparecio|no volvio|huyo|partio|se marcho)`,
  );
  const m = llano.match(buscado);
  if (m) return { tipo: 'relacion', vinculo: m[1] ?? m[2] };

  // Un robo de un objeto es una misión de objeto, no de venganza: lo que se
  // quiere es recuperarlo.
  const objeto = llano.match(OBJETOS)?.[1];
  const perdioObjeto = /perd|rob|quitaron|llevaron|vendi/.test(llano);
  if (objeto && /rob|quitaron/.test(llano)) return { tipo: 'objeto', objeto, perdido: true };

  if (/quem|incendi|provoc|mat[oóa]|asesin|venganz|traicion|persig|enemig|arras|destru/.test(llano)) return { tipo: 'amenaza' };
  if (objeto) return { tipo: 'objeto', objeto, perdido: perdioObjeto };
  if (vinculo) return { tipo: 'relacion', vinculo };
  if (/prometi|jure|juramento/.test(llano)) return { tipo: 'promesa' };
  return { tipo: 'misterio' };
}

/**
 * Lo que la historia dice que se perdió, como sintagma: «la forja de tu
 * padre». Sirve para que el encargo nombre el caso del jugador y no uno
 * cualquiera.
 * @private
 */
function _loPerdido(llano) {
  const m = llano.match(/\b(?:la|el|mi|nuestra|nuestro)\s+(forja|casa|aldea|pueblo|taller|granja|barco|templo|familia|tienda|posada)(\s+de\s+(?:mi|nuestro|nuestra)\s+[a-zñ]+)?/);
  if (!m) return null;
  const articulo = ['forja', 'casa', 'aldea', 'granja', 'familia', 'tienda', 'posada'].includes(m[1]) ? 'la' : 'el';
  const de = m[2] ? m[2].replace(/\b(mi|nuestro|nuestra)\b/, 'tu') : '';
  return `${articulo} ${m[1]}${de}`;
}

/**
 * Dónde está la pista: un pueblo al que se llega desde aquí.
 *
 * Mejor uno vecino que el de salida, para que la misión mueva; si no hay, el
 * propio lugar si está poblado. Nunca un sitio sin gente: la pista la da
 * alguien.
 * @private
 */
function _lugarDeLaPista(flujo, refIdActual) {
  const actual = obtenerLugar(refIdActual);
  const poblado = (l) => l && l.tipo === 'asentamiento' && (l.servicios?.length ?? 0) > 0;

  const vecinos = (actual?.conexiones ?? [])
    .map((c) => obtenerLugar(c.hasta))
    .filter(poblado);

  if (vecinos.length) return flujo.elegir(vecinos);
  if (poblado(actual)) return actual;

  const region = lugaresDe(actual?.region ?? '').filter(poblado);
  return region.length ? flujo.elegir(region) : actual;
}

/**
 * La misión principal con que empieza la partida.
 *
 * La apertura era atmósfera y lore —«Hoy ese hilo vuelve a tensarse»— sin
 * nada que hacer. Esto da un objetivo concreto desde el turno 1: un lugar del
 * mapa, alguien con nombre y oficio, y una pista. Sale de la historia del
 * jugador cuando la hay; si no, de su trasfondo y su oficio.
 *
 * No inventa hechos del pasado del personaje: la pista es lo que otro dice
 * haber visto, y puede ser verdad o no. El pasado lo escribe el jugador.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Object} contexto
 * @param {string} contexto.lugar refId del lugar de salida.
 * @param {string} [contexto.lore]
 * @param {string} [contexto.trasfondo] Nombre legible.
 * @param {string} [contexto.clase] Nombre legible.
 * @param {number} [contexto.turno]
 * @param {number} [contexto.orden] 1 para la primera, 2 para la que la sigue…
 * @returns {{mision: import('./Quest.js').Mision, npc: Object, lugar: Object}}
 */
export function principalDesdeHistoria(flujo, contexto = {}) {
  const lore = String(contexto.lore ?? '').trim();
  const llano = sinAcentos(lore.toLowerCase());
  const lugar = _lugarDeLaPista(flujo, contexto.lugar);
  const enLugar = trasPreposicion('En', lugar?.nombre ?? 'el camino');

  // ─── Quién da la pista ──────────────────────────────────────────────────
  const genero = flujo.moneda() ? 'f' : 'm';
  const porTema = OFICIO_POR_TEMA.find(([re]) => re.test(llano))?.[1];
  const rol = (porTema ?? { m: 'posadero', f: 'posadera' })[genero];
  const nombre = nombreAleatorio('valdes', genero, () => flujo.next());
  const refIdNpc = `npc_${sinAcentos(nombre.toLowerCase()).replace(/\s+/g, '_')}`;
  const quien = `${nombre}, ${genero === 'f' ? 'la' : 'el'} ${rol}`;

  // ─── Qué se busca ───────────────────────────────────────────────────────
  let titulo;
  let objetivo;
  let pista;

  if (lore) {
    const tema = _temaDeHistoria(llano);
    const perdido = _loPerdido(llano);

    switch (tema.tipo) {
      case 'relacion': {
        const ella = /a$/.test(tema.vinculo);
        titulo = `Tras la pista de tu ${tema.vinculo}`;
        objetivo = `Encuentra a tu ${tema.vinculo}.`;
        pista = `${enLugar}, ${quien}, dice haber visto a alguien que encaja con ${ella ? 'ella' : 'él'}.`;
        break;
      }
      case 'amenaza':
        titulo = 'Una cuenta pendiente';
        objetivo = perdido
          ? `Averigua quién está detrás de lo que le pasó a ${perdido}.`
          : 'Averigua quién está detrás de lo que te pasó.';
        pista = /herrer/.test(rol)
          ? `Dicen que ${enLugar.charAt(0).toLowerCase()}${enLugar.slice(1)}, ${quien}, compró hierro con una marca que conoces.`
          : `${enLugar}, ${quien}, ha visto a alguien que encaja con quien buscas.`;
        break;
      case 'objeto': {
        const g = OBJETO_GENERO[tema.objeto] ?? 'm';
        const dicho = CON_TILDE[tema.objeto] ?? tema.objeto;
        const Dicho = `${dicho.charAt(0).toUpperCase()}${dicho.slice(1)}`;
        const uno = g === 'f' ? 'una' : 'uno';
        const tuyo = `${g === 'f' ? 'la' : 'el'} tuy${g === 'f' ? 'a' : 'o'}`;

        // Perdido o no: «Tengo un medallón que no sé de dónde viene» no pide
        // recuperar nada, pide saber de dónde sale.
        if (tema.perdido) {
          titulo = `${Dicho} ${g === 'f' ? 'perdida' : 'perdido'}`;
          objetivo = `Recupera tu ${dicho}.`;
          pista = `${enLugar}, ${quien}, ha oído que alguien intenta vender ${uno} como ${tuyo}.`;
        } else {
          titulo = `De dónde viene tu ${dicho}`;
          objetivo = `Averigua de dónde viene tu ${dicho}.`;
          pista = `${enLugar}, ${quien}, ha visto antes ${uno} como ${tuyo}.`;
        }
        break;
      }
      case 'promesa':
        titulo = 'Lo que prometiste';
        objetivo = 'Cumple lo que prometiste.';
        pista = `${enLugar}, ${quien}, sabe por dónde empezar.`;
        break;
      default:
        titulo = 'Lo que dejaste atrás';
        objetivo = 'Hay alguien que sabe algo de tu pasado.';
        pista = `${enLugar}, ${quien}, quiere hablar contigo.`;
    }
  } else {
    // Sin historia escrita: el oficio del personaje abre la puerta.
    const oficio = String(contexto.clase ?? '').toLowerCase() || 'alguien de fiar';
    titulo = 'Un primer encargo';
    objetivo = 'Necesitas trabajo, y hay quien paga.';
    pista = `${enLugar}, ${quien}, busca a un ${oficio} y paga bien.`;
  }

  // ─── Objetivos que el motor puede seguir ────────────────────────────────
  const objetivos = [];
  if (lugar && lugar.refId !== contexto.lugar) {
    objetivos.push(Obj.crear({ clase: 'llegar', objetivo: lugar.refId, nombreObjetivo: lugar.nombre }));
  }
  // Nada de objetivos «libres»: solo los puede cerrar un modelo, y sin él la
  // misión principal no terminaría nunca ni abriría la siguiente. Llegar y
  // hablar los cierra el motor.
  objetivos.push(Obj.crear({ clase: 'hablar', objetivo: refIdNpc, nombreObjetivo: nombre }));

  const mision = Q.crear({
    titulo,
    resumen: `${objetivo} ${pista}`,
    tipo: 'principal',
    objetivos,
    recompensa: { xp: xpPorMision('principal'), oro: flujo.entero(40, 90) },
    origen: refIdNpc,
    nombreOrigen: nombre,
    lugar: lugar?.refId ?? contexto.lugar,
    turnoOferta: contexto.turno ?? 1,
    orden: contexto.orden ?? 1,
    promptDirector:
      `Misión principal del personaje. ${objetivo} ${pista} ` +
      `${nombre} es ${rol} y está en ${lugar?.nombre ?? 'el camino'}. Lo que sabe es una pista, ` +
      'no la solución: que lleve al siguiente paso, no al final.',
  });

  return {
    mision,
    objetivo,
    pista,
    lugar,
    npc: { refId: refIdNpc, nombre, rol, genero, lugar: lugar?.refId ?? contexto.lugar },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   NORMALIZACIÓN DEL DIRECTOR
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Normaliza una misión declarada por el director.
 *
 * Acota las recompensas para que un modelo generoso no rompa la economía, y
 * garantiza que haya al menos un objetivo: una misión sin objetivos no se puede
 * completar nunca.
 *
 * @param {Object} propuesta
 * @param {Object} contexto
 * @returns {{mision: import('./Quest.js').Mision, ajustes: string[]}}
 */
export function normalizar(propuesta, contexto = {}) {
  const ajustes = [];

  const mision = Q.desdeDirector(propuesta, contexto);

  // ─── Objetivos ──────────────────────────────────────────────────────────
  if (!mision.objetivos.length) {
    mision.objetivos = [Obj.crear({ clase: 'libre', descripcion: 'Resolver el encargo' })];
    ajustes.push('misión sin objetivos: se añadió uno genérico');
  }

  if (mision.objetivos.length > 8) {
    mision.objetivos = mision.objetivos.slice(0, 8);
    ajustes.push('objetivos recortados a 8');
  }

  // ─── Recompensas acotadas ───────────────────────────────────────────────
  const topeXP = xpPorMision(mision.tipo) * 2;
  if (mision.recompensa.xp > topeXP) {
    ajustes.push(`xp recortada de ${mision.recompensa.xp} a ${topeXP}`);
    mision.recompensa.xp = topeXP;
  }

  const topeOro = Math.round(150 * (Q.TIPOS[mision.tipo]?.multiplicadorRecompensa ?? 1));
  if (mision.recompensa.oro > topeOro) {
    ajustes.push(`oro recortado de ${mision.recompensa.oro} a ${topeOro}`);
    mision.recompensa.oro = topeOro;
  }

  if (mision.recompensa.objetos.length > 3) {
    mision.recompensa.objetos = mision.recompensa.objetos.slice(0, 3);
    ajustes.push('objetos de recompensa recortados a 3');
  }

  // Sin recompensa declarada, se pone la que corresponde al tipo.
  if (mision.recompensa.xp === 0 && mision.recompensa.oro === 0) {
    mision.recompensa.xp = xpPorMision(mision.tipo);
    mision.recompensa.oro = Math.round(40 * (Q.TIPOS[mision.tipo]?.multiplicadorRecompensa ?? 1));
  }

  return { mision, ajustes };
}

/* ═══════════════════════════════════════════════════════════════════════════
   AUXILIAR
   ═══════════════════════════════════════════════════════════════════════════ */

/** @private */
function _capitalizar(texto) {
  const t = String(texto ?? '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default { PLANTILLAS, generar, desdeGancho, normalizar };
