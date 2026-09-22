/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · combat/BossPatterns.js
 * ---------------------------------------------------------------------------
 * Comportamiento de jefes: fases, invocaciones y acciones legendarias.
 *
 * Un jefe no es un enemigo con más vida. Lo que lo distingue es que CAMBIA: a
 * cierto porcentaje de vida abandona lo que estaba haciendo y hace otra cosa.
 * Ese cambio es el que convierte una pelea larga en una pelea memorable.
 *
 * Tres mecanismos:
 *
 *   1. FASES — al cruzar umbrales de vida, cambian sus ataques y su actitud
 *   2. INVOCACIONES — refuerzos periódicos que hay que gestionar
 *   3. ACCIONES LEGENDARIAS — actúa fuera de su turno, para que un jefe solo
 *      no quede en desventaja numérica
 *
 * El tercero merece explicación: un jefe contra un grupo recibe muchos más
 * ataques de los que puede devolver. Las acciones legendarias corrigen esa
 * asimetría sin necesidad de inflarle las estadísticas.
 *
 * Funciones puras.
 *
 * Dependencias: Combatant, StatusEffects, enemies.data.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as Comb from './Combatant.js';
import * as Estados from './StatusEffects.js';
import { obtenerEnemigo } from '../data/enemies.data.js';

/* ═══════════════════════════════════════════════════════════════════════════
   FASES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Comprueba y aplica un cambio de fase.
 *
 * @param {Object} jefe
 * @returns {{jefe: Object, cambio: boolean, fase: Object|null, narracion: string|null, efectos: Array<Object>}}
 */
export function revisarFase(jefe) {
  const revision = Comb.revisarFase(jefe);

  if (!revision.cambia) {
    return { jefe, cambio: false, fase: null, narracion: null, efectos: [] };
  }

  const fase = revision.fase;
  let actualizado = Comb.aplicarFase(jefe, revision.indice);

  const efectos = [];

  // ─── Una fase puede conceder estados al jefe ───────────────────────────
  if (fase.estado) {
    const r = Estados.aplicar(actualizado, fase.estado, { rondas: 99 });
    actualizado = r.combatiente;
    efectos.push({ tipo: 'estado', estado: fase.estado });
  }

  // ─── O curarlo parcialmente, si así está declarado ─────────────────────
  if (fase.curacion) {
    const cantidad = Math.floor(actualizado.vida.max * fase.curacion);
    const r = Comb.modificarVida(actualizado, cantidad);
    actualizado = r.combatiente;
    efectos.push({ tipo: 'curacion', cantidad: r.aplicado });
  }

  // ─── O limpiarle los perjuicios ────────────────────────────────────────
  if (fase.limpiaEstados) {
    const r = Estados.retirarCategoria(actualizado, 'perjuicio');
    actualizado = r.combatiente;
    if (r.retirados.length) {
      efectos.push({ tipo: 'limpieza', estados: r.retirados });
    }
  }

  return {
    jefe: actualizado,
    cambio: true,
    fase,
    narracion: componerNarracionFase(actualizado, fase),
    efectos,
  };
}

/**
 * Compone la narración de un cambio de fase.
 *
 * El texto sale de los datos del jefe, no de una plantilla genérica: cada uno
 * cambia a su manera.
 *
 * @param {Object} jefe
 * @param {Object} fase
 * @returns {string}
 */
export function componerNarracionFase(jefe, fase) {
  const partes = [];

  if (fase.narracion) {
    partes.push(fase.narracion);
  } else {
    partes.push(`${jefe.nombre} cambia.`);
    if (fase.descripcion) partes.push(fase.descripcion);
  }

  return partes.join(' ');
}

/**
 * Fase actual de un jefe.
 * @param {Object} jefe
 * @returns {Object|null}
 */
export function faseActual(jefe) {
  return jefe.fases?.[jefe.faseActual ?? 0] ?? null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   INVOCACIONES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Genera los refuerzos que invoca un jefe.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Object} jefe
 * @param {Object} [opciones]
 * @param {boolean} [opciones.extra=false] Fase desesperada: invoca el doble.
 * @returns {{combatientes: Array<Object>, narracion: string}}
 */
export function invocar(flujo, jefe, opciones = {}) {
  const config = jefe.invoca;
  if (!config) return { combatientes: [], narracion: '' };

  const cantidad = opciones.extra
    ? (config.cantidad ?? 1) * 2
    : (config.cantidad ?? 1);

  const combatientes = [];
  const letras = 'IJKLMNOP';   // Distintas de las del grupo inicial.

  for (let i = 0; i < cantidad; i++) {
    const c = Comb.desdeEnemigo(config.refId, {
      nivel: config.nivel,
      sufijo: cantidad > 1 ? letras[i % letras.length] : null,
      flujo,
    });

    if (c) {
      // La marca permite contar cuántos hay vivos y no pasarse del tope.
      c.invocadoPor = jefe.id;
      combatientes.push(c);
    }
  }

  if (!combatientes.length) return { combatientes: [], narracion: '' };

  const plantilla = obtenerEnemigo(config.refId);
  const nombre = combatientes.length > 1
    ? (plantilla?.plural ?? 'criaturas')
    : (plantilla?.nombre ?? 'una criatura');

  const formas = [
    `${jefe.nombre} llama, y ${combatientes.length > 1 ? 'aparecen' : 'aparece'} ${combatientes.length} ${nombre}.`,
    `Del suelo y las sombras ${combatientes.length > 1 ? 'salen' : 'sale'} ${nombre}.`,
    `${jefe.nombre} no está solo: ${nombre} ${combatientes.length > 1 ? 'acuden' : 'acude'} a su llamada.`,
  ];

  return { combatientes, narracion: flujo.elegir(formas) };
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACCIONES LEGENDARIAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Acciones que un jefe puede ejecutar fuera de su turno.
 *
 * Existen para corregir la asimetría numérica: un jefe solo recibe muchos más
 * ataques de los que devuelve. En vez de inflarle la vida, se le dan turnos
 * parciales entre los ajenos.
 */
export const ACCIONES_LEGENDARIAS = Object.freeze({
  golpe_veloz: {
    nombre: 'Golpe veloz',
    coste: 1,
    descripcion: 'Un ataque rápido fuera de turno.',
    tipo: 'ataque',
    modificadorDano: 0.5,
  },
  desplazarse: {
    nombre: 'Desplazarse',
    coste: 1,
    descripcion: 'Se reposiciona sin provocar reacciones.',
    tipo: 'movimiento',
  },
  mirada: {
    nombre: 'Mirada',
    coste: 2,
    descripcion: 'Fuerza una salvación de temple o el objetivo queda aterrado.',
    tipo: 'estado',
    estado: 'aterrado',
    salvacion: { atributo: 'temple', umbral: 'dificil' },
  },
  embate: {
    nombre: 'Embate',
    coste: 3,
    descripcion: 'Un ataque de área devastador.',
    tipo: 'area',
    modificadorDano: 0.7,
  },
});

/**
 * Decide si un jefe usa una acción legendaria.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Object} jefe
 * @param {Object} contexto
 * @param {number} contexto.cargasDisponibles
 * @param {Array<Object>} contexto.objetivos
 * @param {number} contexto.ronda
 * @returns {{usa: boolean, accion: Object|null, objetivo: string|null, coste: number}}
 */
export function decidirLegendaria(flujo, jefe, contexto) {
  const { cargasDisponibles = 0, objetivos = [] } = contexto;

  if (cargasDisponibles <= 0) return { usa: false, accion: null, objetivo: null, coste: 0 };
  if (!objetivos.length) return { usa: false, accion: null, objetivo: null, coste: 0 };
  if (!Comb.puede(jefe, 'atacar').puede) return { usa: false, accion: null, objetivo: null, coste: 0 };

  // Las declaradas por el jefe, o el repertorio estándar.
  const disponibles = (jefe.legendarias ?? ['golpe_veloz', 'mirada'])
    .map((clave) => ({ clave, ...ACCIONES_LEGENDARIAS[clave] }))
    .filter((a) => a.nombre && a.coste <= cargasDisponibles);

  if (!disponibles.length) return { usa: false, accion: null, objetivo: null, coste: 0 };

  // Un jefe herido gasta más: no le sirve reservar cargas para una ronda a la
  // que quizá no llegue.
  const fraccion = Comb.fraccionVida(jefe);
  const probabilidad = fraccion < 0.4 ? 0.85 : 0.55;

  if (!flujo.oportunidad(probabilidad)) {
    return { usa: false, accion: null, objetivo: null, coste: 0 };
  }

  // Con varios objetivos, el área compensa.
  const deArea = disponibles.filter((a) => a.tipo === 'area');
  if (deArea.length && objetivos.length >= 2 && flujo.oportunidad(0.6)) {
    const accion = flujo.elegir(deArea);
    return { usa: true, accion, objetivo: null, coste: accion.coste };
  }

  const accion = flujo.elegir(disponibles);
  const objetivo = flujo.elegir(objetivos);

  return { usa: true, accion, objetivo: objetivo.id, coste: accion.coste };
}

/**
 * Cargas legendarias que recupera un jefe al empezar la ronda.
 *
 * @param {Object} jefe
 * @returns {number}
 */
export function cargasPorRonda(jefe) {
  if (jefe.amenaza === 'jefeMayor') return 3;
  if (jefe.amenaza === 'jefe') return 2;
  return 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESISTENCIA A ESTADOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Un jefe puede sacudirse un estado incapacitante al inicio de su turno.
 *
 * Sin esto, encadenar aturdimientos convertiría cualquier pelea contra un jefe
 * en un trámite. Con esto, los estados siguen siendo útiles pero no anulan al
 * enemigo por completo.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Object} jefe
 * @returns {{jefe: Object, liberado: Array<string>, narracion: string|null}}
 */
export function sacudirseEstados(flujo, jefe) {
  if (!['jefe', 'jefeMayor'].includes(jefe.amenaza)) {
    return { jefe, liberado: [], narracion: null };
  }

  const incapacitantes = ['aturdido', 'paralizado', 'dominado', 'aterrado'];

  const activos = (jefe.estados ?? []).filter((e) => incapacitantes.includes(e.refId));
  if (!activos.length) return { jefe, liberado: [], narracion: null };

  // Un jefe mayor se libra más fácilmente.
  const probabilidad = jefe.amenaza === 'jefeMayor' ? 0.7 : 0.5;

  const liberado = [];
  let actualizado = jefe;

  for (const activo of activos) {
    if (!flujo.oportunidad(probabilidad)) continue;

    const r = Estados.retirar(actualizado, activo.refId);
    actualizado = r.combatiente;
    liberado.push(activo.refId);
  }

  if (!liberado.length) return { jefe: actualizado, liberado: [], narracion: null };

  const formas = [
    `${jefe.nombre} se sacude el efecto y vuelve a moverse.`,
    'Lo que fuera que le retenía cede.',
    `${jefe.nombre} rompe la contención.`,
  ];

  return { jefe: actualizado, liberado, narracion: flujo.elegir(formas) };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSULTAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @param {Object} c
 * @returns {boolean}
 */
export function esJefe(c) {
  return ['jefe', 'jefeMayor'].includes(c?.amenaza);
}

/**
 * Estado del jefe para la interfaz.
 *
 * Un jefe merece su propia presentación: barra grande, nombre de fase y aviso
 * cuando está a punto de cambiar.
 *
 * @param {Object} jefe
 * @returns {Object|null}
 */
export function paraInterfaz(jefe) {
  if (!esJefe(jefe)) return null;

  const fase = faseActual(jefe);
  const fraccion = Comb.fraccionVida(jefe);

  // Próximo umbral de fase, para anticipar el cambio.
  const proxima = (jefe.fases ?? [])
    .filter((f) => f.hasta < fraccion)
    .sort((a, b) => b.hasta - a.hasta)[0];

  return {
    id: jefe.id,
    nombre: jefe.nombre,
    vida: jefe.vida,
    fraccion,
    fase: fase?.nombre ?? null,
    faseIndice: jefe.faseActual ?? 0,
    fasesTotales: jefe.fases?.length ?? 1,
    umbrales: (jefe.fases ?? []).map((f) => f.hasta).filter((u) => u < 1),
    proximoUmbral: proxima?.hasta ?? null,
    cercaDeCambiar: proxima ? fraccion - proxima.hasta < 0.08 : false,
  };
}

/**
 * Descripción del jefe para el director.
 * @param {Object} jefe
 * @returns {string}
 */
export function paraDirector(jefe) {
  if (!esJefe(jefe)) return Comb.paraDirector(jefe);

  const fase = faseActual(jefe);
  const partes = [Comb.paraDirector(jefe)];

  if (fase) {
    partes.push(`Fase actual: ${fase.nombre}. ${fase.descripcion ?? ''}`);
  }

  if (jefe.promptLore) partes.push(jefe.promptLore);

  return partes.join(' ');
}

export default {
  revisarFase,
  componerNarracionFase,
  faseActual,
  invocar,
  ACCIONES_LEGENDARIAS,
  decidirLegendaria,
  cargasPorRonda,
  sacudirseEstados,
  esJefe,
  paraInterfaz,
  paraDirector,
};
