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
