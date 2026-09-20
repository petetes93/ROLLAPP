/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · ai/providers/index.js
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
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { IDMProvider } from './IDMProvider.js';
import { ProceduralProvider } from './ProceduralProvider.js';
import { BridgeProvider } from './BridgeProvider.js';
import { LocalLLMProvider } from './LocalLLMProvider.js';
import {
  RemoteAPIProvider, fijarCredencial, olvidarCredencial, hayCredencial, SERVICIOS,
} from './RemoteAPIProvider.js';
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
    id: PROVEEDORES.PROCEDURAL,
    nombre: 'Director interno',
    clase: ProceduralProvider,
    descripcion: 'Narración generada por el propio juego. No necesita nada y nunca falla.',
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
    nombre: 'Gemini desde tu PC',
    clase: LocalLLMProvider,
    descripcion: 'Usa el proxy local de ROLLAPP: la clave nunca entra en el navegador ni en la partida.',
    requisitos: ['El lanzador local de Gemini arrancado', 'Conexión a internet desde el proxy'],
    sinRed: false,
    sinCredencial: true,
  },

  {
    id: PROVEEDORES.REMOTO,
    nombre: 'API remota',
    clase: RemoteAPIProvider,
    descripcion: 'Usa Anthropic u OpenAI. La clave no se guarda: se pide en cada sesión.',
    requisitos: ['Una clave de API', 'Conexión a internet'],
    sinRed: false,
    sinCredencial: false,
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
      console.warn(`[arcanum] no se pudo crear el proveedor ${entrada.id}`, e);
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
    } else if (e.id === PROVEEDORES.REMOTO) {
      listo = hayCredencial();
    }

    return {
      id: e.id,
      nombre: e.nombre,
      descripcion: e.descripcion,
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
  RemoteAPIProvider,
  fijarCredencial,
  olvidarCredencial,
  hayCredencial,
  SERVICIOS,
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
