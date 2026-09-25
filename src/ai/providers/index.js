/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ai/providers/index.js
 * ---------------------------------------------------------------------------
 * Catálogo y fábrica de proveedores.
 *
 * Punto único donde se registran los directores disponibles. Añadir uno nuevo
 * es añadir una entrada aquí: nada más del motor necesita conocerlos.
 *
 * El orden del catálogo importa para la interfaz: los que menos exigen van
 * primero, porque son los que más gente puede usar sin configurar nada.
 *
 * Dependencias: los cuatro proveedores.
 *
 * No hay proveedor que reciba una clave en el navegador: la API remota con
 * clave en la página se retiró. Groq va por un puente local que la guarda.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { IDMProvider } from './IDMProvider.js';
import { ProceduralProvider } from './ProceduralProvider.js';
import { BridgeProvider } from './BridgeProvider.js';
import { LocalLLMProvider } from './LocalLLMProvider.js';
import { GroqProvider } from './GroqProvider.js';
import { PROVEEDORES, PROVEEDOR_DEFECTO } from '../../config/ai.config.js';

/* ═══════════════════════════════════════════════════════════════════════════
   CATÁLOGO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} EntradaCatalogo
 * @property {string} id
 * @property {string} nombre
 * @property {Function} clase
 * @property {string} descripcion
 * @property {string[]} requisitos Lo que el jugador debe aportar.
 * @property {boolean} sinRed
 * @property {boolean} sinCredencial
 */

/**
 * Proveedores disponibles, ordenados de menos a más exigente.
 *
 * @type {EntradaCatalogo[]}
 */
export const CATALOGO = Object.freeze([
  {
    id: PROVEEDORES.GROQ,
    nombre: 'IA Groq (nivel Free verificado; necesita internet y envía contexto narrativo a Groq)',
    clase: GroqProvider,
    descripcion: 'openai/gpt-oss-120b en la capa gratuita de Groq, por el puente local: la clave no entra en el navegador. '
      + 'Cada turno envía a Groq el lugar, quién está, lo que ha pasado y lo que escribes. Groq no entrena con ello; '
      + 'puede guardarlo hasta 30 días salvo que actives Zero Data Retention en tu cuenta.',
    limite: 'Cuota gratuita limitada (unas decenas de turnos al día según el tamaño). Si falla o se agota, '
      + 'narra el procedural y se avisa. No es ChatGPT: es otro modelo.',
    requisitos: ['El puente arrancado con node tools/iniciar-groq.mjs', 'Conexión a internet', 'Tu cuenta de Groq en plan Free, comprobada por ti'],
    sinRed: false,
    sinCredencial: false,
  },

  {
    id: PROVEEDORES.PROCEDURAL,
    nombre: 'Procedural sin IA (respaldo offline)',
    clase: ProceduralProvider,
    descripcion: 'Narración generada por el propio juego. No necesita nada y nunca falla.',
    // Su techo, dicho sin adornos: quien elige narrador tiene que saber qué
    // puede esperar de cada uno.
    limite: 'Lee lo que escribes por partes y el motor lo resuelve con dados, situaciones y memoria. '
      + 'Pero la prosa sale de plantillas: se repite, no inventa respuestas nuevas y no improvisa tramas. '
      + 'Para una historia que improvise de verdad, usa el Puente manual o una IA.',
    requisitos: [],
    sinRed: true,
    sinCredencial: true,
  },

  {
    id: PROVEEDORES.PUENTE,
    nombre: 'Puente manual',
    clase: BridgeProvider,
    descripcion: 'Copias el texto en el chat que uses y pegas la respuesta. Sin claves y sin coste.',
    requisitos: ['Un chat de IA abierto en otra pestaña'],
    sinRed: true,
    sinCredencial: true,
  },

  {
    id: PROVEEDORES.LOCAL,
    nombre: 'Modelo instalado en este PC (offline si se configura)',
    clase: LocalLLMProvider,
    descripcion: 'Un modelo que corre en tu equipo (Ollama, LM Studio o llama.cpp). Nada sale de tu equipo. '
      + 'Depende de tu hardware: un equipo modesto puede ser lento o no poder con un modelo decente.',
    requisitos: ['Un servidor de modelos instalado y arrancado en este equipo', 'La dirección y el nombre del modelo'],
    sinRed: true,
    sinCredencial: true,
  },
]);

/* ═══════════════════════════════════════════════════════════════════════════
   FÁBRICA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Crea un proveedor por su identificador.
 *
 * Si el identificador no existe, devuelve el procedural: es preferible una
 * partida jugable con el director interno que un fallo de arranque.
 *
 * @param {string} id
 * @param {Object} [opciones]
 * @returns {IDMProvider}
 */
export function crear(id, opciones = {}) {
  const entrada = CATALOGO.find((e) => e.id === id);

  if (!entrada) {
    return new ProceduralProvider(opciones);
  }

  return new entrada.clase(opciones);
}

/**
 * Crea todos los proveedores de una vez.
 *
 * Lo usa `DungeonMaster` para tenerlos listos y poder cambiar sin recrear.
 *
 * @param {Object} [opciones]
 * @returns {Map<string, IDMProvider>}
 */
export function crearTodos(opciones = {}) {
  const mapa = new Map();

  for (const entrada of CATALOGO) {
    try {
      mapa.set(entrada.id, new entrada.clase(opciones));
    } catch (e) {
      // Un proveedor que no se puede construir no debe impedir el arranque.
      console.warn(`[arcanveil] no se pudo crear el proveedor ${entrada.id}`, e);
    }
  }

  return mapa;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSULTAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @param {string} id
 * @returns {EntradaCatalogo|null}
 */
export function obtener(id) {
  return CATALOGO.find((e) => e.id === id) ?? null;
}

/**
 * Proveedores que no necesitan configuración.
 * @returns {EntradaCatalogo[]}
 */
export function sinConfiguracion() {
  return CATALOGO.filter((e) => e.requisitos.length === 0);
}

/**
 * Catálogo para la pantalla de ajustes.
 *
 * @param {Object} [estado] Configuración actual, para marcar disponibilidad.
 * @returns {Array<Object>}
 */
export function paraInterfaz(estado = {}) {
  return CATALOGO.map((e) => {
    let listo = e.requisitos.length === 0;

    // Los que necesitan configuración se comprueban de verdad.
    if (e.id === PROVEEDORES.LOCAL) {
      listo = Boolean(estado.urlLocal && estado.modeloLocal);
    } else if (e.id === PROVEEDORES.GROQ) {
      listo = Boolean(estado.groqConsentido);
    }

    return {
      id: e.id,
      nombre: e.nombre,
      descripcion: e.descripcion,
      limite: e.limite ?? null,
      requisitos: e.requisitos,
      listo,
      sinRed: e.sinRed,
      sinCredencial: e.sinCredencial,
      activo: estado.proveedor === e.id,
    };
  });
}

/**
 * Identificador del proveedor por defecto.
 * @returns {string}
 */
export function porDefecto() {
  return PROVEEDOR_DEFECTO;
}

/* ═══════════════════════════════════════════════════════════════════════════
   REEXPORTACIONES
   ═══════════════════════════════════════════════════════════════════════════ */

export {
  IDMProvider,
  ProceduralProvider,
  BridgeProvider,
  LocalLLMProvider,
  GroqProvider,
};

export default {
  CATALOGO,
  crear,
  crearTodos,
  obtener,
  sinConfiguracion,
  paraInterfaz,
  porDefecto,
};
