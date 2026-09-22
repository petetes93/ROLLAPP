/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · npc/NPCFactory.js
 * ---------------------------------------------------------------------------
 * Generación de personajes coherentes con el sitio donde aparecen.
 *
 * Un PNJ generado al azar es ruido. Uno generado a partir del lugar, la región,
 * la facción dominante y la hora del día es una persona verosímil: en Forja Alta
 * aparecen ferranos con oficio de forja, y en Puerto Lodo, contrabandistas.
 *
 * Tres vías de creación:
 *
 *   1. PROCEDURAL — el motor lo compone desde los datos del entorno
 *   2. DESDE EL DIRECTOR — el modelo propone un nombre y un papel, y aquí se
 *      completa con lo que falta
 *   3. FIJO — PNJ definidos en los datos, con su papel escrito
 *
 * La segunda vía es la más usada en la práctica. El director dice «aparece
 * Brenwen, la posadera»; la fábrica le da personalidad, conocimientos y actitud
 * coherentes con el sitio.
 *
 * Funciones puras.
 *
 * Dependencias: NPC, locations.data, factions.data, narrative.templates.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as N from './NPC.js';
import { obtenerLugar, obtenerRegion, obtenerSublugar } from '../data/locations.data.js';
import { faccionesDe, obtenerFaccion } from '../data/factions.data.js';
import { NPC as PLANTILLAS } from '../data/narrative.templates.js';
import { capitalizar, sinAcentos } from '../utils/text.js';

/* ═══════════════════════════════════════════════════════════════════════════
   OFICIOS POR CONTEXTO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Oficios plausibles según el tipo de lugar y sus servicios.
 *
 * Un herrero solo aparece donde hay fragua. Esa coherencia es lo que hace que
 * el mundo parezca construido en vez de sorteado.
 */
const OFICIOS_POR_SERVICIO = Object.freeze({
  posada: [
    { rol: 'posadero', genero: 'm', actitud: 12, apertura: 0.8, conoceRumores: true },
    { rol: 'posadera', genero: 'f', actitud: 12, apertura: 0.8, conoceRumores: true },
    { rol: 'cocinero', genero: 'm', actitud: 5, apertura: 0.5 },
    { rol: 'mozo de cuadra', genero: 'm', actitud: 8, apertura: 0.6, conoceRumores: true },
  ],
  herrero: [
    { rol: 'herrero', genero: 'm', actitud: 0, apertura: 0.3, esMercader: true },
    { rol: 'herrera', genero: 'f', actitud: 0, apertura: 0.3, esMercader: true },
    { rol: 'aprendiz de forja', genero: 'm', actitud: 8, apertura: 0.7 },
  ],
  mercado: [
    { rol: 'mercader', genero: 'm', actitud: 5, apertura: 0.6, codicia: 0.8, esMercader: true },
    { rol: 'mercadera', genero: 'f', actitud: 5, apertura: 0.6, codicia: 0.8, esMercader: true },
    { rol: 'vendedor ambulante', genero: 'm', actitud: 3, codicia: 0.85, esMercader: true },
    { rol: 'tasadora', genero: 'f', actitud: 0, apertura: 0.4 },
  ],
  templo: [
    { rol: 'sanadora', genero: 'f', actitud: 18, apertura: 0.6, honestidad: 0.85 },
    { rol: 'oficiante', genero: 'm', actitud: 12, apertura: 0.5, honestidad: 0.8 },
  ],
  archivo: [
    { rol: 'escriba', genero: 'm', actitud: 0, apertura: 0.3, conoceLugares: true },
    { rol: 'archivista', genero: 'f', actitud: 0, apertura: 0.35, conoceLugares: true },
  ],
  gremio: [
    { rol: 'maestro de gremio', genero: 'm', actitud: -5, apertura: 0.3, codicia: 0.7 },
    { rol: 'secretaria gremial', genero: 'f', actitud: 0, apertura: 0.4, conoceRumores: true },
  ],
});

/** Oficios que aparecen sin servicio asociado, por tipo de lugar. */
const OFICIOS_POR_LUGAR = Object.freeze({
  asentamiento: [
    { rol: 'guardia', genero: 'm', actitud: -8, valentia: 0.7 },
    { rol: 'mendigo', genero: 'm', actitud: 10, apertura: 0.8, conoceRumores: true },
    { rol: 'lugareña', genero: 'f', actitud: 5, apertura: 0.6, conoceRumores: true },
    { rol: 'chiquillo', genero: 'm', actitud: 15, apertura: 0.9 },
  ],
  punto: [
    { rol: 'viajero', genero: 'm', actitud: 5, apertura: 0.5, conoceLugares: true },
    { rol: 'viajera', genero: 'f', actitud: 5, apertura: 0.5, conoceLugares: true },
    { rol: 'peregrino', genero: 'm', actitud: 12, apertura: 0.8, conoceRumores: true },
  ],
  ruina: [
    { rol: 'buscador de reliquias', genero: 'm', actitud: -5, codicia: 0.8, honestidad: 0.3 },
    { rol: 'estudiosa', genero: 'f', actitud: 8, apertura: 0.6, conoceLugares: true },
  ],
  natural: [
    { rol: 'cazador', genero: 'm', actitud: 0, apertura: 0.3, conoceLugares: true },
    { rol: 'rastreadora', genero: 'f', actitud: 0, apertura: 0.35, conoceLugares: true },
  ],
  mazmorra: [
    { rol: 'superviviente', genero: 'm', actitud: 20, apertura: 0.7, valentia: 0.2 },
  ],
});

/** Oficios propios de cada región, que dan color local. */
const OFICIOS_REGIONALES = Object.freeze({
  valle_central: [{ rol: 'recaudador', genero: 'm', actitud: -12, codicia: 0.8 }],
  bosque_cenizo: [{ rol: 'guardián de la arboleda', genero: 'f', actitud: -5, apertura: 0.3, lealtad: 0.9 }],
  montanas_yunque: [{ rol: 'maestro de clan', genero: 'm', actitud: 0, apertura: 0.4, honestidad: 0.9 }],
  marisma_velo: [{ rol: 'guardián del velo', genero: 'm', actitud: -5, apertura: 0.2, honestidad: 0.95 }],
  ruinas_albares: [{ rol: 'custodio', genero: 'm', actitud: 0, apertura: 0.3, conoceLugares: true }],
  dunas_rojas: [{ rol: 'caravanera', genero: 'f', actitud: 15, apertura: 0.8, conoceRumores: true, conoceLugares: true }],
});

/* ═══════════════════════════════════════════════════════════════════════════
   NOMBRES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Genera un nombre con las pilas silábicas.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {string} [genero]
 * @returns {string}
 */
export function generarNombre(flujo, genero = 'm') {
  const a = flujo.elegir(PLANTILLAS.nombres.pilaA);
  const b = flujo.elegir(PLANTILLAS.nombres.pilaB);

  let nombre = capitalizar(a + b);

  // Terminación femenina para dar variedad, no como regla estricta.
  if (genero === 'f' && !/[aeiou]$/i.test(nombre) && flujo.oportunidad(0.6)) {
    nombre += 'a';
  }

  return nombre;
}

/* ═══════════════════════════════════════════════════════════════════════════
   GENERACIÓN PROCEDURAL
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Genera un PNJ coherente con el lugar donde aparece.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Object} contexto
 * @param {string} contexto.lugar refId del lugar.
 * @param {string} [contexto.sublugar]
 * @param {string} [contexto.franja]
 * @param {number} [contexto.turno]
 * @param {string} [contexto.rolPreferido] Si el director pidió uno concreto.
 * @returns {import('./NPC.js').PersonajeNoJugador}
 */
export function generar(flujo, contexto) {
  const lugar = obtenerLugar(contexto.lugar);
  const region = obtenerRegion(lugar?.region);

  // ─── Oficio ─────────────────────────────────────────────────────────────
  const plantilla = _elegirOficio(flujo, lugar, region, contexto);

  // ─── Nombre ─────────────────────────────────────────────────────────────
  const nombre = generarNombre(flujo, plantilla.genero);

  // ─── Rasgo memorable ────────────────────────────────────────────────────
  const rasgo = flujo.elegir(PLANTILLAS.rasgos);

  // ─── Facción ────────────────────────────────────────────────────────────
  const faccion = _elegirFaccion(flujo, lugar, plantilla);

  // ─── Conocimiento ───────────────────────────────────────────────────────
  const conocimiento = _generarConocimiento(flujo, lugar, region, plantilla);

  // ─── Personalidad ───────────────────────────────────────────────────────
  // La plantilla fija los rasgos que definen el oficio; el resto varía.
  const rasgos = {
    apertura: plantilla.apertura ?? flujo.flotante(0.3, 0.7),
    codicia: plantilla.codicia ?? flujo.flotante(0.3, 0.7),
    valentia: plantilla.valentia ?? flujo.flotante(0.3, 0.7),
    lealtad: plantilla.lealtad ?? flujo.flotante(0.3, 0.7),
    honestidad: plantilla.honestidad ?? flujo.flotante(0.35, 0.75),
  };

  // La actitud inicial varía en torno a la del oficio.
  const actitud = Math.round((plantilla.actitud ?? 0) + flujo.entero(-8, 8));

  return N.crear({
    nombre,
    genero: plantilla.genero,
    rol: plantilla.rol,
    rasgo,
    faccion,
    actitud,
    lugar: contexto.lugar,
    sublugar: contexto.sublugar ?? null,
    conocimiento,
    rasgos,
    esMercader: plantilla.esMercader ?? false,
    oro: plantilla.esMercader ? flujo.entero(80, 400) : flujo.entero(0, 30),
    promptLore: _componerLore(nombre, plantilla, lugar, region, faccion),
  });
}

/**
 * Elige el oficio más plausible.
 *
 * @private
 */
function _elegirOficio(flujo, lugar, region, contexto) {
  // Si el director pidió un rol concreto, se busca en el catálogo.
  if (contexto.rolPreferido) {
    const encontrado = _buscarOficio(contexto.rolPreferido);
    if (encontrado) return encontrado;

    // Si no existe, se acepta tal cual con valores por defecto.
    return { rol: contexto.rolPreferido, genero: flujo.oportunidad(0.5) ? 'm' : 'f', actitud: 0 };
  }

  const candidatos = [];

  // ─── Por sublugar ───────────────────────────────────────────────────────
  // Dentro de una posada, lo lógico es un posadero.
  if (contexto.sublugar) {
    const s = obtenerSublugar(contexto.sublugar);

    if (s?.tipo && OFICIOS_POR_SERVICIO[s.tipo]) {
      candidatos.push(...OFICIOS_POR_SERVICIO[s.tipo].map((o) => ({ ...o, peso: 60 })));
    }
  }

  // ─── Por servicios del lugar ────────────────────────────────────────────
  for (const servicio of lugar?.servicios ?? []) {
    const oficios = OFICIOS_POR_SERVICIO[servicio];
    if (oficios) candidatos.push(...oficios.map((o) => ({ ...o, peso: 30 })));
  }

  // ─── Por tipo de lugar ──────────────────────────────────────────────────
  const porTipo = OFICIOS_POR_LUGAR[lugar?.tipo] ?? OFICIOS_POR_LUGAR.punto;
  candidatos.push(...porTipo.map((o) => ({ ...o, peso: 25 })));

  // ─── Por región ─────────────────────────────────────────────────────────
  const porRegion = OFICIOS_REGIONALES[lugar?.region];
  if (porRegion) candidatos.push(...porRegion.map((o) => ({ ...o, peso: 15 })));

  if (!candidatos.length) return { rol: 'lugareño', genero: 'm', actitud: 0 };

  return flujo.elegirPonderado(candidatos.map((c) => ({ valor: c, peso: c.peso })));
}

/**
 * Busca un oficio en el catálogo por su nombre.
 * @private
 */
function _buscarOficio(rol) {
  const limpio = sinAcentos(String(rol).toLowerCase());

  const todos = [
    ...Object.values(OFICIOS_POR_SERVICIO).flat(),
    ...Object.values(OFICIOS_POR_LUGAR).flat(),
    ...Object.values(OFICIOS_REGIONALES).flat(),
  ];

  return todos.find((o) => sinAcentos(o.rol.toLowerCase()) === limpio)
    ?? todos.find((o) => limpio.includes(sinAcentos(o.rol.toLowerCase())))
    ?? null;
}

/**
 * Asigna una facción si el oficio la implica.
 * @private
 */
function _elegirFaccion(flujo, lugar, plantilla) {
  const presentes = faccionesDe(lugar?.region ?? '');
  if (!presentes.length) return null;

  // Ciertos oficios pertenecen a facciones concretas.
  const porOficio = {
    guardia: 'guardia_valle',
    'maestro de gremio': 'gremio_yunque',
    'secretaria gremial': 'gremio_yunque',
    recaudador: 'gremio_yunque',
    'guardián de la arboleda': 'circulo_arboleda',
    'maestro de clan': 'clanes_ferranos',
    'guardián del velo': 'guardianes_velo',
    custodio: 'custodios_albares',
    caravanera: 'caravanas_duna',
    contrabandista: 'sombras_puerto',
  };

  const asignada = porOficio[plantilla.rol];
  if (asignada && presentes.some((f) => f.refId === asignada)) return asignada;

  // Los demás pertenecen a la facción dominante con probabilidad moderada: no
  // todo el mundo está afiliado a algo.
  if (flujo.oportunidad(0.35)) return presentes[0].refId;

  return null;
}

/**
 * Genera lo que este PNJ sabe.
 *
 * Su conocimiento sale de la región y del lugar, así que preguntar a la gente
 * de un sitio da información sobre ese sitio.
 *
 * @private
 */
function _generarConocimiento(flujo, lugar, region, plantilla) {
  const conocimiento = { rumores: [], lugares: [], secretos: [], compartidos: [] };

  // ─── Rumores de la región ───────────────────────────────────────────────
  if (plantilla.conoceRumores || flujo.oportunidad(0.4)) {
    const rumores = region?.rumores ?? [];
    const cuantos = plantilla.conoceRumores ? flujo.entero(1, 2) : 1;

    conocimiento.rumores = flujo.elegirVarios(rumores, cuantos);
  }

  // ─── Lugares no descubiertos ────────────────────────────────────────────
  if (plantilla.conoceLugares || flujo.oportunidad(0.25)) {
    // Sabe de sitios conectados al actual que se descubren por rumor.
    const conectados = (lugar?.conexiones ?? [])
      .map((c) => obtenerLugar(c.hasta))
      .filter((l) => l && ['rumor', 'exploracion'].includes(l.descubrimiento))
      .map((l) => l.refId);

    if (conectados.length) {
      conocimiento.lugares = flujo.elegirVarios(conectados, 1);
    }
  }

  // ─── Secretos ───────────────────────────────────────────────────────────
  // Los ganchos del lugar son secretos potenciales: alguien de aquí sabe algo.
  if (lugar?.ganchos?.length && flujo.oportunidad(0.3)) {
    conocimiento.secretos = flujo.elegirVarios(lugar.ganchos, 1);
  }

  return conocimiento;
}

/**
 * Compone el contexto narrativo del PNJ.
 * @private
 */
function _componerLore(nombre, plantilla, lugar, region, faccionRefId) {
  const partes = [`${nombre} es ${plantilla.rol} en ${lugar?.nombre ?? 'este lugar'}.`];

  if (faccionRefId) {
    const f = obtenerFaccion(faccionRefId);
    if (f) partes.push(`Afiliado a ${f.nombre}: ${f.lema}`);
  }

  // El carácter del lugar tiñe a su gente.
  if (region?.terrenoDominante === 'montana') {
    partes.push('Habla poco y mide sus palabras.');
  } else if (region?.terrenoDominante === 'pantano') {
    partes.push('Tiene una forma de hablar precisa que resulta inquietante.');
  } else if (region?.terrenoDominante === 'desierto') {
    partes.push('Es hospitalario por costumbre y curioso por oficio.');
  }

  return partes.join(' ');
}

/* ═══════════════════════════════════════════════════════════════════════════
   DESDE EL DIRECTOR
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Completa un PNJ que el director ha propuesto.
 *
 * El modelo suele dar nombre y papel; aquí se rellena todo lo demás con
 * coherencia. Es la vía más usada durante el juego.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Object} propuesta Campo del JSON del director.
 * @param {Object} contexto
 * @returns {import('./NPC.js').PersonajeNoJugador}
 */
export function desdeDirector(flujo, propuesta, contexto) {
  // Se genera una base coherente con el sitio.
  const base = generar(flujo, {
    ...contexto,
    rolPreferido: propuesta.rol,
  });

  // Y se sobreescribe con lo que el director declaró: su nombre manda.
  const actitudDeclarada = _traducirActitud(propuesta.actitud);

  return {
    ...base,
    refId: propuesta.refId ?? base.refId,
    nombre: propuesta.nombre ?? base.nombre,
    rol: propuesta.rol ?? base.rol,
    actitud: actitudDeclarada ?? base.actitud,
    // El lore del director se suma al generado: él sabe qué papel le ha dado.
    promptLore: propuesta.descripcion
      ? `${base.promptLore} ${propuesta.descripcion}`
      : base.promptLore,
  };
}

/**
 * Traduce una actitud declarada en texto a un valor numérico.
 * @private
 */
function _traducirActitud(texto) {
  if (!texto) return null;

  const mapa = {
    hostil: -60, agresivo: -60, enemigo: -80,
    desconfiado: -25, receloso: -25, cauta: -15, cauto: -15,
    neutral: 0, indiferente: 0, seca: -5, seco: -5, distraida: 0, distraido: 0,
    cordial: 20, amable: 25, hospitalario: 25, franca: 15, franco: 15,
    interesada: 5, interesado: 5, suplicante: 10, reservada: -5, reservado: -5,
    amigable: 35, leal: 70,
  };

  const limpio = sinAcentos(String(texto).toLowerCase().trim());
  return mapa[limpio] ?? null;
}

export default { generarNombre, generar, desdeDirector };
