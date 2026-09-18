/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · quests/Objective.js
 * ---------------------------------------------------------------------------
 * Objetivos de misión.
 *
 * Un objetivo no es una casilla que alguien marca a mano: es una condición que
 * el motor VIGILA. Cuando el jugador mata al tercer lobo, el objetivo se cumple
 * solo, sin que el director tenga que darse cuenta.
 *
 * Eso importa porque un modelo de lenguaje es mal contable. Delegarle el
 * seguimiento produce misiones que nunca se completan o que se completan dos
 * veces. El motor lleva la cuenta; el director narra.
 *
 * Seis clases de objetivo, cada una con su disparador:
 *
 *   · MATAR — cuenta enemigos de un tipo
 *   · RECOGER — vigila el inventario
 *   · ENTREGAR — objeto más destinatario
 *   · LLEGAR — un lugar concreto
 *   · HABLAR — con alguien concreto
 *   · LIBRE — lo marca el director, para lo que no encaje en lo anterior
 *
 * La última existe porque ningún catálogo cubre todo lo que puede ocurrir en
 * una partida narrativa. Es la válvula de escape.
 *
 * Funciones puras.
 *
 * Dependencias: utils.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { idEntidad, TIPO } from '../utils/id.js';
import { truncar } from '../utils/text.js';
import { saturar } from '../utils/math.js';

/* ═══════════════════════════════════════════════════════════════════════════
   CLASES DE OBJETIVO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} ClaseObjetivo
 * @property {string} nombre
 * @property {string} evento Qué evento del motor lo hace avanzar.
 * @property {boolean} contable Si admite progreso parcial.
 * @property {string} plantilla Cómo se redacta si no se declara texto.
 */

/** @type {Record<string, ClaseObjetivo>} */
export const CLASES = Object.freeze({
  matar: {
    nombre: 'eliminar',
    evento: 'combat:enemy:killed',
    contable: true,
    plantilla: 'Acabar con {cantidad} {objetivo}',
  },
  recoger: {
    nombre: 'conseguir',
    evento: 'inventory:added',
    contable: true,
    plantilla: 'Conseguir {cantidad} {objetivo}',
  },
  entregar: {
    nombre: 'entregar',
    evento: 'quest:deliver',
    contable: false,
    plantilla: 'Llevar {objetivo} a {destinatario}',
  },
  llegar: {
    nombre: 'llegar',
    evento: 'world:arrived',
    contable: false,
    plantilla: 'Llegar a {objetivo}',
  },
  hablar: {
    nombre: 'hablar',
    evento: 'npc:talked',
    contable: false,
    plantilla: 'Hablar con {objetivo}',
  },
  libre: {
    nombre: 'hacer',
    evento: null,
    contable: false,
    plantilla: '{texto}',
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   CREACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Objetivo
 * @property {string} id
 * @property {string} clase Clave de CLASES.
 * @property {string} texto Redacción visible.
 * @property {string} [objetivo] refId de lo que hay que matar, recoger, etc.
 * @property {string} [destinatario] Para las entregas.
 * @property {number} cantidad Cuántos hacen falta.
 * @property {number} progreso Cuántos van.
 * @property {boolean} hecho
 * @property {boolean} opcional
 * @property {boolean} oculto Se revela al cumplir otro.
 * @property {string} [revelaA] id del objetivo que desvela al cumplirse.
 */

/**
 * Crea un objetivo.
 *
 * @param {Object} datos
 * @returns {Objetivo}
 */
export function crear(datos) {
  const clase = CLASES[datos.clase] ? datos.clase : 'libre';

  return {
    id: datos.id ?? idEntidad(TIPO.OBJETIVO),
    clase,
    texto: datos.texto ?? _redactar(clase, datos),
    objetivo: datos.objetivo ?? null,
    destinatario: datos.destinatario ?? null,
    cantidad: Math.max(1, datos.cantidad ?? 1),
    progreso: saturar(datos.progreso ?? 0, 0, datos.cantidad ?? 1),
    hecho: datos.hecho ?? false,
    opcional: datos.opcional ?? false,
    oculto: datos.oculto ?? false,
    revelaA: datos.revelaA ?? null,
  };
}

/**
 * Redacta el texto de un objetivo desde su plantilla.
 * @private
 */
function _redactar(clase, datos) {
  const plantilla = CLASES[clase]?.plantilla ?? '{texto}';

  return truncar(plantilla
    .replace('{cantidad}', String(datos.cantidad ?? 1))
    .replace('{objetivo}', datos.nombreObjetivo ?? datos.objetivo ?? 'algo')
    .replace('{destinatario}', datos.nombreDestinatario ?? datos.destinatario ?? 'alguien')
    .replace('{texto}', datos.descripcion ?? 'Hacer lo que haga falta'), 140);
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROGRESO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Avanza un objetivo.
 *
 * @param {Objetivo} objetivo
 * @param {number} [cantidad=1]
 * @returns {{objetivo: Objetivo, avanzo: boolean, completado: boolean}}
 */
export function avanzar(objetivo, cantidad = 1) {
  if (objetivo.hecho) {
    return { objetivo, avanzo: false, completado: false };
  }

  const progreso = saturar(objetivo.progreso + cantidad, 0, objetivo.cantidad);

  if (progreso === objetivo.progreso) {
    return { objetivo, avanzo: false, completado: false };
  }

  const completado = progreso >= objetivo.cantidad;

  return {
    objetivo: { ...objetivo, progreso, hecho: completado },
    avanzo: true,
    completado,
  };
}

/**
 * Fija el progreso a un valor absoluto.
 *
 * Se usa con los objetivos de recogida: el motor consulta cuántos hay en el
 * inventario en vez de contar los que entran, porque el jugador puede tirar
 * cosas o venderlas.
 *
 * @param {Objetivo} objetivo
 * @param {number} valor
 * @returns {{objetivo: Objetivo, cambio: boolean, completado: boolean}}
 */
export function fijarProgreso(objetivo, valor) {
  const progreso = saturar(valor, 0, objetivo.cantidad);

  if (progreso === objetivo.progreso) {
    return { objetivo, cambio: false, completado: objetivo.hecho };
  }

  const completado = progreso >= objetivo.cantidad;

  return {
    objetivo: { ...objetivo, progreso, hecho: completado },
    cambio: true,
    completado,
  };
}

/**
 * Marca un objetivo como cumplido, sin contar.
 *
 * @param {Objetivo} objetivo
 * @returns {Objetivo}
 */
export function completar(objetivo) {
  if (objetivo.hecho) return objetivo;
  return { ...objetivo, progreso: objetivo.cantidad, hecho: true };
}

/**
 * Revela un objetivo oculto.
 * @param {Objetivo} objetivo
 * @returns {Objetivo}
 */
export function revelar(objetivo) {
  return objetivo.oculto ? { ...objetivo, oculto: false } : objetivo;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPROBACIÓN DE EVENTOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Comprueba si un evento del motor hace avanzar este objetivo.
 *
 * Es el corazón del seguimiento automático. Devuelve cuánto avanza, o cero.
 *
 * @param {Objetivo} objetivo
 * @param {string} tipoEvento
 * @param {Object} datos Carga del evento.
 * @returns {number} Cuánto avanza.
 */
export function evaluarEvento(objetivo, tipoEvento, datos) {
  if (objetivo.hecho || objetivo.oculto) return 0;

  const clase = CLASES[objetivo.clase];
  if (!clase?.evento || clase.evento !== tipoEvento) return 0;

  switch (objetivo.clase) {
    case 'matar':
      // Coincide por refId de criatura, o por tipo si se declaró genérico.
      if (datos.refId === objetivo.objetivo) return 1;
      if (datos.tipo === objetivo.objetivo) return 1;
      return 0;

    case 'recoger':
      if (datos.objeto?.refId === objetivo.objetivo) {
        return datos.objeto.cantidad ?? 1;
      }
      return 0;

    case 'llegar':
      return datos.refId === objetivo.objetivo ? objetivo.cantidad : 0;

    case 'hablar':
      return datos.refId === objetivo.objetivo ? objetivo.cantidad : 0;

    case 'entregar':
      return datos.idObjetivo === objetivo.id ? objetivo.cantidad : 0;

    default:
      return 0;
  }
}

/**
 * Recalcula un objetivo de recogida contra el inventario actual.
 *
 * Los objetivos de recogida no pueden contar altas, porque el jugador puede
 * tirar o vender lo que ya tenía. Se consulta el estado real.
 *
 * @param {Objetivo} objetivo
 * @param {Function} contarEnInventario Función (refId) → cantidad.
 * @returns {{objetivo: Objetivo, cambio: boolean, completado: boolean}}
 */
export function sincronizarRecogida(objetivo, contarEnInventario) {
  if (objetivo.clase !== 'recoger') {
    return { objetivo, cambio: false, completado: objetivo.hecho };
  }

  const cantidad = contarEnInventario(objetivo.objetivo);
  return fijarProgreso(objetivo, cantidad);
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSULTAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Fracción de progreso.
 * @param {Objetivo} objetivo
 * @returns {number}
 */
export function fraccion(objetivo) {
  return objetivo.cantidad > 0 ? objetivo.progreso / objetivo.cantidad : 0;
}

/**
 * Texto del objetivo con su progreso, si es contable.
 * @param {Objetivo} objetivo
 * @returns {string}
 */
export function etiqueta(objetivo) {
  const clase = CLASES[objetivo.clase];

  if (!clase?.contable || objetivo.cantidad <= 1) return objetivo.texto;

  return `${objetivo.texto} (${objetivo.progreso}/${objetivo.cantidad})`;
}

/**
 * Objetivos visibles de una lista.
 * @param {Array<Objetivo>} objetivos
 * @returns {Array<Objetivo>}
 */
export function visibles(objetivos) {
  return (objetivos ?? []).filter((o) => !o.oculto);
}

/**
 * Comprueba si todos los obligatorios están cumplidos.
 *
 * Los opcionales no bloquean: existen para dar recompensa extra a quien se
 * moleste, no para alargar la misión.
 *
 * @param {Array<Objetivo>} objetivos
 * @returns {boolean}
 */
export function todosCumplidos(objetivos) {
  const obligatorios = (objetivos ?? []).filter((o) => !o.opcional);

  return obligatorios.length > 0 && obligatorios.every((o) => o.hecho);
}

/**
 * Siguiente objetivo pendiente, para orientar al jugador.
 * @param {Array<Objetivo>} objetivos
 * @returns {Objetivo|null}
 */
export function siguiente(objetivos) {
  return visibles(objetivos).find((o) => !o.hecho && !o.opcional)
    ?? visibles(objetivos).find((o) => !o.hecho)
    ?? null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   NORMALIZACIÓN DESDE EL DIRECTOR
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Convierte un objetivo propuesto por el director en uno válido.
 *
 * El modelo declara los objetivos con texto libre. Aquí se intenta deducir la
 * clase para que el motor pueda seguirlo; si no se reconoce, cae a `libre`, que
 * el director marcará a mano.
 *
 * @param {Object} propuesta
 * @returns {Objetivo}
 */
export function desdeDirector(propuesta) {
  const texto = propuesta.texto ?? propuesta.descripcion ?? '';

  const deduccion = _deducirClase(texto);

  return crear({
    id: propuesta.id,
    clase: propuesta.clase ?? deduccion.clase,
    texto,
    objetivo: propuesta.objetivo ?? deduccion.objetivo,
    destinatario: propuesta.destinatario,
    cantidad: propuesta.cantidad ?? deduccion.cantidad,
    hecho: propuesta.hecho ?? false,
    opcional: propuesta.opcional ?? false,
    oculto: propuesta.oculto ?? false,
  });
}

/**
 * Deduce la clase de un objetivo a partir de su redacción.
 *
 * No es infalible, y por eso el fallo es benigno: cae a `libre` y el director
 * lo marca cuando corresponda. Peor sería adivinar mal y contar cosas que no
 * son.
 *
 * @param {string} texto
 * @returns {{clase: string, objetivo: string|null, cantidad: number}}
 * @private
 */
function _deducirClase(texto) {
  const t = (texto ?? '').toLowerCase();

  // La cantidad se extrae del texto si aparece.
  const numero = t.match(/\b(\d+)\b/);
  const cantidad = numero ? parseInt(numero[1], 10) : 1;

  const patrones = [
    [/mata|acaba con|elimina|derrota|abate/, 'matar'],
    [/consigue|reúne|reune|recoge|encuentra \d|trae \d/, 'recoger'],
    [/entrega|lleva.*a |dale.*a |devuelve/, 'entregar'],
    [/llega|ve a|dirígete|dirigete|visita|alcanza/, 'llegar'],
    [/habla con|pregunta a|busca a|encuentra a/, 'hablar'],
  ];

  for (const [patron, clase] of patrones) {
    if (patron.test(t)) {
      return { clase, objetivo: null, cantidad };
    }
  }

  return { clase: 'libre', objetivo: null, cantidad: 1 };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESENTACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Datos del objetivo para la interfaz.
 * @param {Objetivo} objetivo
 * @returns {Object}
 */
export function paraInterfaz(objetivo) {
  return {
    id: objetivo.id,
    texto: etiqueta(objetivo),
    hecho: objetivo.hecho,
    opcional: objetivo.opcional,
    contable: CLASES[objetivo.clase]?.contable ?? false,
    progreso: objetivo.progreso,
    cantidad: objetivo.cantidad,
    fraccion: fraccion(objetivo),
  };
}

export default {
  CLASES,
  crear,
  avanzar,
  fijarProgreso,
  completar,
  revelar,
  evaluarEvento,
  sincronizarRecogida,
  fraccion,
  etiqueta,
  visibles,
  todosCumplidos,
  siguiente,
  desdeDirector,
  paraInterfaz,
};
