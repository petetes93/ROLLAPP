/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · combat/DamageCalculator.js
 * ---------------------------------------------------------------------------
 * Cálculo del daño, desde la tirada hasta la vida perdida.
 *
 * Orden de operaciones, que importa mucho:
 *
 *   1. Dados de daño del arma
 *   2. Bonificadores (atributo, arma, estados, fase de jefe)
 *   3. Multiplicador de crítico — sobre los dados, no sobre el total
 *   4. Daño elemental añadido, que se calcula aparte
 *   5. Vulnerabilidades y resistencias del objetivo
 *   6. Reducción plana de la armadura
 *   7. Suelo mínimo de un punto
 *
 * El paso 3 merece explicación. Multiplicar el total incluiría los
 * bonificadores fijos, y un crítico con un arma muy bonificada se volvería
 * absurdo. Multiplicar solo los dados mantiene el crítico emocionante sin
 * romper el equilibrio.
 *
 * El paso 6 va DESPUÉS de las resistencias: una armadura protege lo mismo
 * contra el fuego que contra una espada, pero la resistencia al fuego solo
 * aplica al fuego.
 *
 * Funciones puras.
 *
 * Dependencias: Dice, Combatant, balance.config.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { evaluar } from '../core/Dice.js';
import { COMBATE } from '../config/balance.config.js';
import { reduccionEfectiva, bonoDanoEstados } from './Combatant.js';

/* ═══════════════════════════════════════════════════════════════════════════
   TIPOS DE DAÑO
   ═══════════════════════════════════════════════════════════════════════════ */

/** Familias de daño reconocidas. */
export const TIPOS_DANO = Object.freeze({
  cortante: { familia: 'fisico', nombre: 'cortante' },
  perforante: { familia: 'fisico', nombre: 'perforante' },
  contundente: { familia: 'fisico', nombre: 'contundente' },
  fuego: { familia: 'elemental', nombre: 'de fuego' },
  frio: { familia: 'elemental', nombre: 'de frío' },
  rayo: { familia: 'elemental', nombre: 'de rayo' },
  acido: { familia: 'elemental', nombre: 'de ácido' },
  veneno: { familia: 'elemental', nombre: 'de veneno' },
  necrotico: { familia: 'arcano', nombre: 'necrótico' },
  radiante: { familia: 'arcano', nombre: 'radiante' },
  psiquico: { familia: 'arcano', nombre: 'psíquico' },
  fuerza: { familia: 'arcano', nombre: 'de fuerza' },
});

/**
 * Comprueba si un objetivo resiste, es inmune o es vulnerable a un tipo.
 *
 * La comprobación acepta tanto el tipo concreto como su familia: declarar
 * `resistencias: ['fisico']` cubre cortante, perforante y contundente.
 *
 * @param {Object} objetivo
 * @param {string} tipo
 * @returns {'inmune'|'resistente'|'vulnerable'|'normal'}
 */
export function afinidad(objetivo, tipo) {
  const familia = TIPOS_DANO[tipo]?.familia;

  const coincide = (lista) => (lista ?? []).some((t) => t === tipo || t === familia);

  if (coincide(objetivo.inmunidades)) return 'inmune';
  if (coincide(objetivo.vulnerabilidades)) return 'vulnerable';
  if (coincide(objetivo.resistencias)) return 'resistente';

  return 'normal';
}

/**
 * Multiplicador correspondiente a una afinidad.
 * @param {string} a
 * @returns {number}
 */
export function multiplicadorAfinidad(a) {
  switch (a) {
    case 'inmune': return 0;
    case 'resistente': return 0.5;
    case 'vulnerable': return 2;
    default: return 1;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   CÁLCULO PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Calcula el daño de un impacto.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Object} opciones
 * @param {Object} opciones.atacante
 * @param {Object} opciones.objetivo
 * @param {Object} opciones.ataque Datos del ataque usado.
 * @param {boolean} [opciones.critico=false]
 * @param {number} [opciones.bonoExtra=0]
 * @returns {Object}
 */
export function calcular(flujo, opciones) {
  const { atacante, objetivo, ataque, critico = false, bonoExtra = 0 } = opciones;

  const desglose = [];

  // ─── 1. Dados de daño ───────────────────────────────────────────────────
  const notacion = ataque.dano ?? '1d4';
  let dados = 0;

  try {
    const tirada = evaluar(flujo, notacion);
    dados = tirada.total;
    desglose.push({ fuente: `Daño (${notacion})`, valor: dados, dados: tirada.dados });
  } catch {
    dados = 1;
    desglose.push({ fuente: 'Daño mínimo', valor: 1 });
  }

  // ─── 2. Crítico: se duplican los dados, no el total ─────────────────────
  if (critico) {
    let extra = 0;
    try {
      extra = evaluar(flujo, notacion).total;
    } catch {
      extra = 1;
    }
    dados += extra;
    desglose.push({ fuente: 'Crítico (dados adicionales)', valor: extra, critico: true });
  }

  // ─── 3. Bonificadores fijos ─────────────────────────────────────────────
  const bonoArma = ataque.bonoDano ?? 0;
  if (bonoArma !== 0) {
    desglose.push({ fuente: 'Arma', valor: bonoArma });
  }

  const bonoEstados = bonoDanoEstados(atacante);
  if (bonoEstados !== 0) {
    desglose.push({ fuente: 'Estados', valor: bonoEstados });
  }

  if (bonoExtra !== 0) {
    desglose.push({ fuente: 'Circunstancia', valor: bonoExtra });
  }

  let bruto = dados + bonoArma + bonoEstados + bonoExtra;

  // ─── 4. Afinidad del objetivo al tipo principal ─────────────────────────
  const tipo = ataque.tipo ?? 'contundente';
  const afin = afinidad(objetivo, tipo);
  const multiplicador = multiplicadorAfinidad(afin);

  if (multiplicador !== 1) {
    const antes = bruto;
    bruto = Math.floor(bruto * multiplicador);

    const etiquetas = {
      inmune: 'Inmune',
      resistente: 'Resistencia',
      vulnerable: 'Vulnerabilidad',
    };

    desglose.push({
      fuente: `${etiquetas[afin]} a lo ${TIPOS_DANO[tipo]?.nombre ?? tipo}`,
      valor: bruto - antes,
      afinidad: afin,
    });
  }

  // ─── 5. Daño elemental añadido, con su propia afinidad ──────────────────
  const elemental = [];

  for (const e of ataque.danoElemental ?? []) {
    let cantidad = 0;

    try {
      cantidad = evaluar(flujo, e.notacion ?? '1d6').total;
    } catch {
      cantidad = 1;
    }

    const afinE = afinidad(objetivo, e.elemento);
    const multE = multiplicadorAfinidad(afinE);
    const efectivo = Math.floor(cantidad * multE);

    if (efectivo > 0 || afinE === 'inmune') {
      elemental.push({ elemento: e.elemento, cantidad: efectivo, afinidad: afinE });
      desglose.push({
        fuente: `Daño ${TIPOS_DANO[e.elemento]?.nombre ?? e.elemento}`,
        valor: efectivo,
        elemental: true,
      });
    }

    bruto += efectivo;
  }

  // ─── 6. Reducción de la armadura ────────────────────────────────────────
  // Va después de las resistencias: la armadura protege igual de todo, pero la
  // resistencia al fuego solo cubre el fuego.
  const reduccion = reduccionEfectiva(objetivo);

  // El techo evita que una armadura muy pesada anule el daño por completo.
  const reduccionMax = Math.floor(bruto * COMBATE.reduccionMax);
  const bloqueado = Math.min(reduccion, reduccionMax);

  if (bloqueado > 0) {
    desglose.push({ fuente: 'Armadura', valor: -bloqueado });
  }

  // ─── 7. Suelo mínimo ────────────────────────────────────────────────────
  // Un impacto siempre hace algo, salvo inmunidad total: si no, atacar a un
  // enemigo muy blindado sería inútil y frustrante.
  const total = afin === 'inmune' ? 0 : Math.max(COMBATE.danoMinimo, bruto - bloqueado);

  return { total, desglose, tipo, critico, bloqueado, afinidad: afin, elemental };
}

/* ═══════════════════════════════════════════════════════════════════════════
   DAÑO SIN ATAQUE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Calcula daño de área o de efecto, sin tirada de ataque.
 *
 * Se usa en alientos, trampas y conjuros de zona. La salvación reduce a la
 * mitad en vez de anular: fallar la salvación de un aliento de dragón no
 * debería ser una sentencia.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Object} opciones
 * @returns {Object}
 */
export function calcularArea(flujo, opciones) {
  const { objetivo, notacion, tipo, salvado = false, mitadSiSalva = true } = opciones;

  const desglose = [];

  let bruto = 0;
  try {
    const tirada = evaluar(flujo, notacion);
    bruto = tirada.total;
    desglose.push({ fuente: `Daño de área (${notacion})`, valor: bruto, dados: tirada.dados });
  } catch {
    bruto = 1;
  }

  if (salvado) {
    const antes = bruto;
    bruto = mitadSiSalva ? Math.floor(bruto / 2) : 0;
    desglose.push({ fuente: 'Salvación superada', valor: bruto - antes });
  }

  // Afinidad.
  const afin = afinidad(objetivo, tipo);
  const mult = multiplicadorAfinidad(afin);

  if (mult !== 1) {
    const antes = bruto;
    bruto = Math.floor(bruto * mult);
    desglose.push({ fuente: `Afinidad (${afin})`, valor: bruto - antes });
  }

  // El daño de área ignora parte de la armadura: cubrirse no protege de un
  // aliento que llena el pasillo.
  const reduccion = Math.floor(reduccionEfectiva(objetivo) / 2);
  const bloqueado = Math.min(reduccion, Math.floor(bruto * COMBATE.reduccionMax));

  if (bloqueado > 0) desglose.push({ fuente: 'Armadura (parcial)', valor: -bloqueado });

  const total = afin === 'inmune' ? 0 : Math.max(0, bruto - bloqueado);

  return { total, desglose, tipo, critico: false, bloqueado, afinidad: afin, elemental: [] };
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROBO DE VIDA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Calcula cuánta vida recupera el atacante por robo.
 *
 * @param {number} danoInfligido
 * @param {number} fraccion Fracción robada (0-1).
 * @returns {number}
 */
export function roboVida(danoInfligido, fraccion) {
  if (!fraccion || danoInfligido <= 0) return 0;
  return Math.floor(danoInfligido * fraccion);
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESENTACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Describe un resultado de daño en lenguaje natural.
 *
 * @param {Object} resultado
 * @param {Object} objetivo
 * @returns {string}
 */
export function describir(resultado, objetivo) {
  if (resultado.afinidad === 'inmune') {
    return `${objetivo.nombre} no sufre ningún daño: es inmune.`;
  }

  const partes = [`${resultado.total} de daño`];

  if (resultado.tipo) {
    partes.push(TIPOS_DANO[resultado.tipo]?.nombre ?? resultado.tipo);
  }

  const notas = [];
  if (resultado.critico) notas.push('crítico');
  if (resultado.afinidad === 'resistente') notas.push('resistido a medias');
  if (resultado.afinidad === 'vulnerable') notas.push('duplicado por vulnerabilidad');
  if (resultado.bloqueado > 0) notas.push(`${resultado.bloqueado} absorbidos por la armadura`);

  const texto = partes.join(' ');
  return notas.length ? `${texto} (${notas.join(', ')})` : texto;
}

/**
 * Adjetivo que califica la magnitud del golpe respecto a la vida del objetivo.
 *
 * Es lo que permite narrar «apenas le roza» frente a «lo parte en dos» sin que
 * el director tenga que hacer cuentas.
 *
 * @param {number} dano
 * @param {Object} objetivo
 * @returns {string}
 */
export function magnitud(dano, objetivo) {
  const fraccion = dano / Math.max(1, objetivo.vida?.max ?? 1);

  if (fraccion >= 0.5) return 'devastador';
  if (fraccion >= 0.3) return 'demoledor';
  if (fraccion >= 0.15) return 'sólido';
  if (fraccion >= 0.05) return 'moderado';
  return 'leve';
}

export default {
  TIPOS_DANO,
  afinidad,
  multiplicadorAfinidad,
  calcular,
  calcularArea,
  roboVida,
  describir,
  magnitud,
};
