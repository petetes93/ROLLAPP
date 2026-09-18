/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · player/SkillSystem.js
 * ---------------------------------------------------------------------------
 * Competencias: grados, bonificadores y resolución de pruebas.
 *
 * Aquí converge todo lo que modifica una tirada. `componerModificadores` es la
 * función más importante del archivo: reúne atributo, competencia, penalización
 * por hambre y sed, moral, equipo y situación, y devuelve el desglose completo.
 *
 * Ese desglose no es un lujo de depuración: se muestra al jugador en el tooltip
 * de la tirada. Saber que fallaste por −3 de agotamiento cambia cómo juegas el
 * turno siguiente.
 *
 * Funciones puras.
 *
 * Dependencias: skills.data, balance.config, Attributes, Vitals, Progression.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { HABILIDADES, obtenerHabilidad } from '../data/skills.data.js';
import { TIRADAS, PROGRESION } from '../config/balance.config.js';
import { modificadorEfectivo } from './Attributes.js';
import { penalizacionSupervivencia, penalizacionMoral } from './Vitals.js';
import { bonoNivel } from './Progression.js';

/* ═══════════════════════════════════════════════════════════════════════════
   GRADOS DE COMPETENCIA
   ═══════════════════════════════════════════════════════════════════════════ */

/** Grados ordenados de menor a mayor. */
export const GRADOS = Object.freeze([
  'inepto', 'lego', 'practicado', 'experto', 'maestro', 'legendario',
]);

/** Metadatos de cada grado, para la ficha. */
export const META_GRADOS = Object.freeze({
  inepto: { nombre: 'Inepto', descripcion: 'Nunca lo has intentado en serio.', color: 'peligro' },
  lego: { nombre: 'Lego', descripcion: 'Sabes lo que sabe cualquiera.', color: 'tenue' },
  practicado: { nombre: 'Practicado', descripcion: 'Lo has hecho lo bastante como para no fallar por torpeza.', color: 'texto' },
  experto: { nombre: 'Experto', descripcion: 'Es tu oficio y se nota.', color: 'info' },
  maestro: { nombre: 'Maestro', descripcion: 'Pocos te igualan.', color: 'acento' },
  legendario: { nombre: 'Legendario', descripcion: 'La gente cuenta historias sobre esto.', color: 'legendario' },
});

/** Coste en puntos de habilidad para subir a cada grado. */
export const COSTE_GRADO = Object.freeze({
  lego: 1,
  practicado: 2,
  experto: 4,
  maestro: 7,
  legendario: 12,
});

/** Nivel mínimo exigido para cada grado, para que nadie sea legendario a nivel 1. */
export const NIVEL_MINIMO_GRADO = Object.freeze({
  lego: 1,
  practicado: 1,
  experto: 4,
  maestro: 9,
  legendario: 15,
});

/* ═══════════════════════════════════════════════════════════════════════════
   CONSULTA DE COMPETENCIAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Grado del personaje en una habilidad.
 * @param {Object} jugador
 * @param {string} refId
 * @returns {string} Grado; 'lego' por defecto.
 */
export function gradoDe(jugador, refId) {
  return jugador?.habilidades?.[refId] ?? 'lego';
}

/**
 * Bonificador aportado por el grado de competencia.
 * @param {Object} jugador
 * @param {string} refId
 * @returns {number}
 */
export function bonoCompetencia(jugador, refId) {
  return TIRADAS.competencia[gradoDe(jugador, refId)] ?? 0;
}

/**
 * Bonificador total de una habilidad, sin situación ni penalizaciones.
 * Es el número que se muestra en la ficha junto a cada competencia.
 *
 * @param {Object} jugador
 * @param {string} refId
 * @returns {number}
 */
export function bonoHabilidad(jugador, refId) {
  const habilidad = obtenerHabilidad(refId);
  if (!habilidad) return 0;
  return modificadorEfectivo(jugador, habilidad.atributo) + bonoCompetencia(jugador, refId);
}

/**
 * Todas las habilidades con su grado y bonificador, agrupadas por atributo.
 * @param {Object} jugador
 * @returns {Record<string, Array<Object>>}
 */
export function resumenHabilidades(jugador) {
  const grupos = {};

  for (const h of Object.values(HABILIDADES)) {
    const grado = gradoDe(jugador, h.refId);
    const entrada = {
      refId: h.refId,
      nombre: h.nombre,
      atributo: h.atributo,
      grado,
      metaGrado: META_GRADOS[grado],
      bono: bonoHabilidad(jugador, h.refId),
      descripcion: h.descripcion,
    };

    if (!grupos[h.atributo]) grupos[h.atributo] = [];
    grupos[h.atributo].push(entrada);
  }

  // Dentro de cada grupo, primero lo que mejor se le da.
  for (const lista of Object.values(grupos)) lista.sort((a, b) => b.bono - a.bono);

  return grupos;
}

/**
 * Habilidades en las que el personaje destaca, para el prompt del director.
 * @param {Object} jugador
 * @param {number} [minimo=2] Índice mínimo de GRADOS para considerarlo destacado.
 * @returns {Array<{refId: string, nombre: string, grado: string}>}
 */
export function habilidadesDestacadas(jugador, minimo = 2) {
  const salida = [];
  for (const [refId, grado] of Object.entries(jugador?.habilidades ?? {})) {
    if (GRADOS.indexOf(grado) >= minimo) {
      const h = obtenerHabilidad(refId);
      if (h) salida.push({ refId, nombre: h.nombre, grado });
    }
  }
  return salida.sort((a, b) => GRADOS.indexOf(b.grado) - GRADOS.indexOf(a.grado));
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPOSICIÓN DE MODIFICADORES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Reúne todos los modificadores que afectan a una prueba.
 *
 * Este es el punto único donde se decide qué influye en una tirada. Si mañana
 * hay que añadir un modificador nuevo —clima, terreno, una maldición— se añade
 * aquí y todo el motor lo recoge.
 *
 * @param {Object} jugador
 * @param {Object} opciones
 * @param {string} [opciones.habilidad] refId de la competencia.
 * @param {string} [opciones.atributo] Atributo, si la prueba no usa habilidad.
 * @param {string} [opciones.situacion='neutra'] Clave de TIRADAS.situacion.
 * @param {number} [opciones.bonoEquipo=0]
 * @param {number} [opciones.bonoOtro=0] Rasgos, bendiciones, juramentos.
 * @param {boolean} [opciones.aplicarMoral=false] Solo en pruebas sociales y de temple.
 * @param {boolean} [opciones.usaNivel=false] Añade el bono de nivel (ataques, salvaciones).
 * @returns {{modificadores: Array<{fuente: string, valor: number}>, total: number}}
 */
export function componerModificadores(jugador, opciones = {}) {
  const {
    habilidad, atributo, situacion = 'neutra',
    bonoEquipo = 0, bonoOtro = 0,
    aplicarMoral = false, usaNivel = false,
  } = opciones;

  const modificadores = [];

  // — Atributo —
  const claveAtributo = habilidad ? obtenerHabilidad(habilidad)?.atributo : atributo;
  if (claveAtributo) {
    const mod = modificadorEfectivo(jugador, claveAtributo);
    if (mod !== 0) {
      modificadores.push({ fuente: _nombreAtributo(claveAtributo), valor: mod });
    }
  }

  // — Competencia —
  if (habilidad) {
    const bono = bonoCompetencia(jugador, habilidad);
    if (bono !== 0) {
      const h = obtenerHabilidad(habilidad);
      modificadores.push({
        fuente: `${h?.nombre ?? habilidad} (${META_GRADOS[gradoDe(jugador, habilidad)]?.nombre})`,
        valor: bono,
      });
    }
  }

  // — Nivel, en pruebas que lo usan —
  if (usaNivel) {
    modificadores.push({ fuente: 'Experiencia', valor: bonoNivel(jugador?.nivel ?? 1) });
  }

  // — Supervivencia: siempre pesa —
  const supervivencia = penalizacionSupervivencia(jugador);
  modificadores.push(...supervivencia.desglose);

  // — Moral: solo donde tiene sentido —
  if (aplicarMoral) {
    const moral = penalizacionMoral(jugador);
    modificadores.push(...moral.desglose);
  }

  // — Equipo y otros —
  if (bonoEquipo !== 0) modificadores.push({ fuente: 'Equipo', valor: bonoEquipo });
  if (bonoOtro !== 0) modificadores.push({ fuente: 'Rasgo', valor: bonoOtro });

  // — Situación —
  const bonoSituacion = TIRADAS.situacion[situacion] ?? 0;
  if (bonoSituacion !== 0) {
    modificadores.push({ fuente: _nombreSituacion(situacion), valor: bonoSituacion });
  }

  const total = modificadores.reduce((a, m) => a + m.valor, 0);
  return { modificadores, total };
}

/**
 * @param {string} clave
 * @returns {string}
 * @private
 */
function _nombreAtributo(clave) {
  const nombres = {
    vigor: 'Vigor', destreza: 'Destreza', temple: 'Temple',
    intelecto: 'Intelecto', astucia: 'Astucia', carisma: 'Carisma',
  };
  return nombres[clave] ?? clave;
}

/**
 * @param {string} clave
 * @returns {string}
 * @private
 */
function _nombreSituacion(clave) {
  const nombres = {
    muyFavorable: 'Situación muy favorable',
    favorable: 'Situación favorable',
    adversa: 'Situación adversa',
    muyAdversa: 'Situación muy adversa',
  };
  return nombres[clave] ?? 'Situación';
}

/* ═══════════════════════════════════════════════════════════════════════════
   VENTAJA Y DESVENTAJA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Determina si una prueba se lanza con ventaja o desventaja.
 *
 * Recorre los rasgos del personaje buscando los que otorgan ventaja en esta
 * prueba concreta. La regla del sistema es que ventaja y desventaja se anulan
 * sin acumularse: tener tres motivos a favor y uno en contra da tirada normal.
 *
 * @param {Object} jugador
 * @param {Object} opciones
 * @param {string} [opciones.habilidad]
 * @param {Array<Object>} [opciones.rasgos] Rasgos activos del personaje.
 * @param {string[]} [opciones.condiciones] Condiciones de la escena.
 * @param {boolean} [opciones.ventajaForzada=false]
 * @param {boolean} [opciones.desventajaForzada=false]
 * @returns {{ventaja: string, motivos: string[]}}
 */
export function determinarVentaja(jugador, opciones = {}) {
  const {
    habilidad, rasgos = [], condiciones = [],
    ventajaForzada = false, desventajaForzada = false,
  } = opciones;

  const motivos = [];
  let aFavor = ventajaForzada;
  let enContra = desventajaForzada;

  if (ventajaForzada) motivos.push('Situación ventajosa');
  if (desventajaForzada) motivos.push('Situación desventajosa');

  for (const rasgo of rasgos) {
    const efecto = rasgo?.efecto;
    if (!efecto) continue;

    const pruebas = Array.isArray(efecto.prueba) ? efecto.prueba : [efecto.prueba];
    const aplica = pruebas.includes(habilidad);
    if (!aplica) continue;

    // Un rasgo condicionado solo cuenta si su condición está presente.
    const condicionOk = !efecto.condicion || condiciones.includes(efecto.condicion);
    if (!condicionOk) continue;

    if (efecto.tipo === 'ventaja') { aFavor = true; motivos.push(rasgo.nombre); }
    if (efecto.tipo === 'desventaja') { enContra = true; motivos.push(rasgo.nombre); }
  }

  // Los estados alterados también influyen.
  for (const estado of jugador?.estados ?? []) {
    if (estado.refId === 'cegado' && habilidad === 'percepcion') { enContra = true; motivos.push('Cegado'); }
    if (estado.refId === 'invisible' && habilidad === 'sigilo') { aFavor = true; motivos.push('Invisible'); }
    if (estado.refId === 'aterrado') { enContra = true; motivos.push('Aterrado'); }
  }

  let ventaja = 'ninguna';
  if (aFavor && !enContra) ventaja = 'ventaja';
  else if (enContra && !aFavor) ventaja = 'desventaja';
  else if (aFavor && enContra) motivos.push('(se anulan)');

  return { ventaja, motivos };
}

/* ═══════════════════════════════════════════════════════════════════════════
   MEJORA DE COMPETENCIAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Comprueba si el personaje puede subir una habilidad de grado.
 *
 * @param {Object} jugador
 * @param {string} refId
 * @returns {{puede: boolean, siguiente: string|null, coste: number, motivo: string|null}}
 */
export function puedeMejorar(jugador, refId) {
  const actual = gradoDe(jugador, refId);
  const indice = GRADOS.indexOf(actual);

  if (indice >= GRADOS.length - 1) {
    return { puede: false, siguiente: null, coste: 0, motivo: 'Ya está al máximo' };
  }

  const siguiente = GRADOS[indice + 1];
  const coste = COSTE_GRADO[siguiente] ?? 99;
  const nivelMin = NIVEL_MINIMO_GRADO[siguiente] ?? 1;
  const nivel = jugador?.nivel ?? 1;

  if (nivel < nivelMin) {
    return { puede: false, siguiente, coste, motivo: `Requiere nivel ${nivelMin}` };
  }

  const puntos = jugador?.puntosHabilidad ?? 0;
  if (puntos < coste) {
    return { puede: false, siguiente, coste, motivo: `Cuesta ${coste} y tienes ${puntos}` };
  }

  return { puede: true, siguiente, coste, motivo: null };
}

/**
 * Sube una habilidad de grado, gastando los puntos correspondientes.
 * @param {Object} jugador
 * @param {string} refId
 * @returns {{parche: Object|null, exito: boolean, grado: string|null, motivo: string|null}}
 */
export function mejorar(jugador, refId) {
  const check = puedeMejorar(jugador, refId);
  if (!check.puede) return { parche: null, exito: false, grado: null, motivo: check.motivo };

  return {
    parche: {
      player: {
        habilidades: { [refId]: check.siguiente },
        puntosHabilidad: (jugador?.puntosHabilidad ?? 0) - check.coste,
      },
    },
    exito: true,
    grado: check.siguiente,
    motivo: null,
  };
}

/**
 * Concede un grado directamente, sin coste. Se usa al crear el personaje y con
 * los rasgos que otorgan competencias gratuitas.
 *
 * Nunca rebaja: si el personaje ya tiene un grado superior por otra vía, se
 * respeta el mejor.
 *
 * @param {Object} jugador
 * @param {string} refId
 * @param {string} [grado='practicado']
 * @returns {Object} Parche.
 */
export function conceder(jugador, refId, grado = 'practicado') {
  const actual = gradoDe(jugador, refId);
  const mejor = GRADOS.indexOf(grado) > GRADOS.indexOf(actual) ? grado : actual;
  return { player: { habilidades: { [refId]: mejor } } };
}

/**
 * Concede varias competencias de una vez.
 * @param {Object} jugador
 * @param {string[]} refIds
 * @param {string} [grado='practicado']
 * @returns {Object} Parche único.
 */
export function concederVarias(jugador, refIds, grado = 'practicado') {
  const habilidades = {};
  for (const refId of refIds ?? []) {
    const actual = gradoDe(jugador, refId);
    habilidades[refId] = GRADOS.indexOf(grado) > GRADOS.indexOf(actual) ? grado : actual;
  }
  return { player: { habilidades } };
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESOLUCIÓN DE PRUEBAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Prepara todos los datos de una prueba, listos para Dice.tirar().
 *
 * Separar la preparación de la tirada permite mostrar al jugador contra qué se
 * enfrenta ANTES de tirar, si algún día se quiere esa mecánica, y facilita las
 * pruebas automatizadas.
 *
 * @param {Object} jugador
 * @param {Object} opciones Igual que componerModificadores, más:
 * @param {number|string} [opciones.umbral] Número o clave de dificultad.
 * @returns {{modificadores: Array, total: number, umbral: number, ventaja: string, motivosVentaja: string[]}}
 */
export function prepararPrueba(jugador, opciones = {}) {
  const { modificadores, total } = componerModificadores(jugador, opciones);
  const { ventaja, motivos } = determinarVentaja(jugador, opciones);

  const umbral = typeof opciones.umbral === 'string'
    ? (TIRADAS.umbrales[opciones.umbral] ?? TIRADAS.umbralPorDefecto)
    : (opciones.umbral ?? TIRADAS.umbralPorDefecto);

  return { modificadores, total, umbral, ventaja, motivosVentaja: motivos };
}

/**
 * Deduce qué habilidad corresponde a una acción escrita en texto libre.
 * Delega en el catálogo y añade el bonificador del personaje.
 *
 * @param {Object} jugador
 * @param {string} texto
 * @returns {{refId: string, nombre: string, bono: number, confianza: number}|null}
 */
export function deducirPrueba(jugador, texto) {
  const limpio = String(texto ?? '').toLowerCase();
  let mejor = null;
  let mejorPuntos = 0;

  for (const h of Object.values(HABILIDADES)) {
    let puntos = 0;
    for (const verbo of h.intenciones) if (limpio.includes(verbo)) puntos += 2;
    if (limpio.includes(h.nombre.toLowerCase())) puntos += 5;
    if (puntos > mejorPuntos) { mejorPuntos = puntos; mejor = h; }
  }

  if (!mejor) return null;

  return {
    refId: mejor.refId,
    nombre: mejor.nombre,
    bono: bonoHabilidad(jugador, mejor.refId),
    confianza: Math.min(mejorPuntos / 7, 1),
  };
}

export default {
  GRADOS,
  META_GRADOS,
  COSTE_GRADO,
  NIVEL_MINIMO_GRADO,
  gradoDe,
  bonoCompetencia,
  bonoHabilidad,
  resumenHabilidades,
  habilidadesDestacadas,
  componerModificadores,
  determinarVentaja,
  puedeMejorar,
  mejorar,
  conceder,
  concederVarias,
  prepararPrueba,
  deducirPrueba,
};
