/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · core/Dice.js
 * ---------------------------------------------------------------------------
 * Tiradas de dados y notación textual.
 *
 * Implementa el Sistema Núcleo d20 definido en balance.config.js:
 *   Tirada = d20 + modificador vs Umbral
 *   20 natural = crítico · 1 natural = pifia
 *   Ventaja / desventaja = 2d20 quedándose con el mejor / peor
 *
 * Todo resultado es un objeto AUDITABLE: incluye los dados individuales, los
 * modificadores desglosados y el margen frente al umbral. La narración del
 * director se construye sobre estos datos, y la bitácora los muestra al
 * jugador. Nada de números opacos.
 *
 * Dependencias: RNG, balance.config, Errors.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { TIRADAS } from '../config/balance.config.js';
import { ErrorReglas, CODIGO } from './Errors.js';

/* ═══════════════════════════════════════════════════════════════════════════
   TIPOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Modificador
 * @property {string} fuente Origen legible: 'Destreza', 'Competencia: sigilo', 'Fatiga'.
 * @property {number} valor  Puede ser negativo.
 */

/**
 * @typedef {Object} ResultadoTirada
 * @property {number} total       Resultado final: dados + modificadores.
 * @property {number} natural     Valor del d20 usado (tras ventaja/desventaja).
 * @property {number[]} dados     Todos los dados lanzados, en orden.
 * @property {number} modificador Suma de todos los modificadores.
 * @property {Modificador[]} desglose Modificadores individuales.
 * @property {number|null} umbral Umbral contra el que se comparó, si lo hubo.
 * @property {number|null} margen total - umbral.
 * @property {boolean} exito
 * @property {boolean} critico    20 natural.
 * @property {boolean} pifia      1 natural.
 * @property {string} grado       'fracasoGrave' | 'fracaso' | 'exitoJusto' | 'exitoClaro' | 'exitoRotundo'
 * @property {string} ventaja     'ninguna' | 'ventaja' | 'desventaja'
 * @property {string} notacion    Representación legible: '1d20+3 → 17 (14+3)'
 */

/**
 * @typedef {Object} ResultadoDados
 * @property {number} total
 * @property {number[]} dados
 * @property {number} modificador
 * @property {string} notacion
 */

/* ═══════════════════════════════════════════════════════════════════════════
   TIRADAS BÁSICAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Lanza N dados de C caras.
 *
 * @param {import('./RNG.js').Flujo} flujo Flujo aleatorio del que consumir.
 * @param {number} cantidad Número de dados (1-100).
 * @param {number} caras    Caras por dado (2-1000).
 * @returns {number[]} Resultados individuales.
 * @throws {ErrorReglas} Si los parámetros están fuera de rango razonable.
 */
export function lanzar(flujo, cantidad, caras) {
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100) {
    throw new ErrorReglas(`Cantidad de dados inválida: ${cantidad}`, { code: CODIGO.DADO_INVALIDO });
  }
  if (!Number.isInteger(caras) || caras < 2 || caras > 1000) {
    throw new ErrorReglas(`Número de caras inválido: ${caras}`, { code: CODIGO.DADO_INVALIDO });
  }
  const resultados = new Array(cantidad);
  for (let i = 0; i < cantidad; i++) resultados[i] = flujo.entero(1, caras);
  return resultados;
}

/**
 * Evalúa notación de dados: '2d6+3', 'd20', '4d8-2', '3d6k2' (quedarse con los
 * 2 mejores), '3d6kl1' (quedarse con el peor).
 *
 * @param {import('./RNG.js').Flujo} flujo
 * @param {string} notacion
 * @returns {ResultadoDados}
 * @throws {ErrorReglas} Si la notación no se reconoce.
 *
 * @example
 * evaluar(rng.dados, '2d6+3');  // → { total: 11, dados: [4,4], modificador: 3, … }
 */
export function evaluar(flujo, notacion) {
  const limpia = String(notacion).replace(/\s+/g, '').toLowerCase();
  //            cantidad    d caras     k/kl n         +/- mod
  const patron = /^(\d*)d(\d+)(?:(kl?)(\d+))?([+-]\d+)?$/;
  const m = limpia.match(patron);

  if (!m) {
    throw new ErrorReglas(`Notación de dados no reconocida: "${notacion}"`, {
      code: CODIGO.DADO_INVALIDO,
      contexto: { notacion },
    });
  }

  const cantidad = m[1] === '' ? 1 : parseInt(m[1], 10);
  const caras = parseInt(m[2], 10);
  const modoConservar = m[3] ?? null;   // 'k' = mejores, 'kl' = peores
  const conservar = m[4] ? parseInt(m[4], 10) : null;
  const modificador = m[5] ? parseInt(m[5], 10) : 0;

  const dados = lanzar(flujo, cantidad, caras);
  let usados = dados;

  if (modoConservar && conservar !== null) {
    const ordenados = dados.slice().sort((a, b) => (modoConservar === 'kl' ? a - b : b - a));
    usados = ordenados.slice(0, Math.min(conservar, dados.length));
  }

  const suma = usados.reduce((a, b) => a + b, 0);
  return {
    total: suma + modificador,
    dados,
    modificador,
    notacion: limpia,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   TIRADA NÚCLEO d20
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Resuelve una tirada del Sistema Núcleo.
 *
 * Es la función que usa RulesEngine para TODA prueba del juego: ataques,
 * habilidades, salvaciones, persuasión y percepción. El director de juego
 * nunca decide un éxito; recibe el resultado de esta función y lo narra.
 *
 * @param {import('./RNG.js').Flujo} flujo
 * @param {Object} opciones
 * @param {Modificador[]} [opciones.modificadores=[]] Desglose de bonificadores.
 * @param {number|null} [opciones.umbral=null] Dificultad a superar.
 * @param {'ninguna'|'ventaja'|'desventaja'} [opciones.ventaja='ninguna']
 * @param {boolean} [opciones.criticoAutomatico=true] 20 natural siempre acierta.
 * @param {boolean} [opciones.pifiaAutomatica=true] 1 natural siempre falla.
 * @returns {ResultadoTirada}
 *
 * @example
 * tirar(rng.dados, {
 *   modificadores: [
 *     { fuente: 'Destreza', valor: 3 },
 *     { fuente: 'Competencia: sigilo', valor: 2 },
 *     { fuente: 'Fatiga', valor: -1 },
 *   ],
 *   umbral: TIRADAS.umbrales.moderada,
 *   ventaja: 'ventaja',
 * });
 */
export function tirar(flujo, opciones = {}) {
  const {
    modificadores = [],
    umbral = null,
    ventaja = 'ninguna',
    criticoAutomatico = true,
    pifiaAutomatica = true,
  } = opciones;

  // — Dados —
  const caras = TIRADAS.dado;
  let dados;
  let natural;

  if (ventaja === 'ventaja') {
    dados = lanzar(flujo, 2, caras);
    natural = Math.max(...dados);
  } else if (ventaja === 'desventaja') {
    dados = lanzar(flujo, 2, caras);
    natural = Math.min(...dados);
  } else {
    dados = lanzar(flujo, 1, caras);
    natural = dados[0];
  }

  // — Modificadores, saturados contra las cotas de balance —
  const desglose = modificadores.filter((m) => m && m.valor !== 0);
  const sumaBruta = desglose.reduce((a, m) => a + m.valor, 0);
  const modificador = Math.max(TIRADAS.modificadorMin, Math.min(TIRADAS.modificadorMax, sumaBruta));

  const total = natural + modificador;

  // — Crítico y pifia —
  const critico = natural >= TIRADAS.critico;
  const pifia = natural <= TIRADAS.pifia;

  // — Éxito —
  let exito;
  if (umbral === null) exito = true;
  else if (critico && criticoAutomatico) exito = true;
  else if (pifia && pifiaAutomatica) exito = false;
  else exito = total >= umbral;

  const margen = umbral === null ? null : total - umbral;

  return {
    total,
    natural,
    dados,
    modificador,
    desglose,
    umbral,
    margen,
    exito,
    critico,
    pifia,
    grado: calcularGrado(margen, critico, pifia),
    ventaja,
    notacion: componerNotacion(natural, dados, modificador, ventaja, total),
  };
}

/**
 * Traduce el margen a un grado narrativo. Es lo que permite que el director
 * distinga entre rozar el éxito y arrasar.
 *
 * @param {number|null} margen
 * @param {boolean} critico
 * @param {boolean} pifia
 * @returns {string}
 */
export function calcularGrado(margen, critico, pifia) {
  if (critico) return 'exitoRotundo';
  if (pifia) return 'fracasoGrave';
  if (margen === null) return 'exitoJusto';

  const m = TIRADAS.margenes;
  if (margen <= m.fracasoGrave) return 'fracasoGrave';
  if (margen < 0) return 'fracaso';
  if (margen >= m.exitoRotundo) return 'exitoRotundo';
  if (margen >= m.exitoClaro) return 'exitoClaro';
  return 'exitoJusto';
}

/**
 * Compone la representación legible de una tirada, la que verá el jugador en
 * la bitácora.
 *
 * @param {number} natural
 * @param {number[]} dados
 * @param {number} modificador
 * @param {string} ventaja
 * @param {number} total
 * @returns {string}
 * @private
 */
function componerNotacion(natural, dados, modificador, ventaja, total) {
  const marca = ventaja === 'ventaja' ? '⌃' : ventaja === 'desventaja' ? '⌄' : '';
  const detalleDados = dados.length > 1 ? `[${dados.join(', ')}]${marca}→${natural}` : `${natural}`;
  const signo = modificador === 0 ? '' : modificador > 0 ? ` + ${modificador}` : ` − ${Math.abs(modificador)}`;
  return `d20 ${detalleDados}${signo} = ${total}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   AUXILIARES DE REGLAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Combina condiciones de ventaja y desventaja.
 * Regla del sistema: se anulan mutuamente, sin acumularse. Tener tres motivos
 * de ventaja y uno de desventaja da tirada normal.
 *
 * @param {boolean} hayVentaja
 * @param {boolean} hayDesventaja
 * @returns {'ninguna'|'ventaja'|'desventaja'}
 */
export function combinarVentaja(hayVentaja, hayDesventaja) {
  if (hayVentaja && hayDesventaja) return 'ninguna';
  if (hayVentaja) return 'ventaja';
  if (hayDesventaja) return 'desventaja';
  return 'ninguna';
}

/**
 * Redondea un umbral arbitrario al escalón más cercano de la tabla oficial.
 * Blindaje contra el director: si pide dificultad 17, se convierte en 15 o 20.
 *
 * @param {number} valor
 * @returns {number}
 */
export function ajustarUmbral(valor) {
  const escalones = Object.values(TIRADAS.umbrales);
  let mejor = escalones[0];
  let dist = Math.abs(valor - mejor);
  for (const e of escalones) {
    const d = Math.abs(valor - e);
    if (d < dist) { dist = d; mejor = e; }
  }
  return mejor;
}

/**
 * Convierte la clave textual de dificultad en su umbral numérico.
 * @param {string} clave 'trivial' | 'facil' | 'moderada' | 'dificil' | 'ardua' | 'heroica'
 * @returns {number} Umbral, o el valor por defecto si la clave no existe.
 */
export function umbralPorClave(clave) {
  return TIRADAS.umbrales[clave] ?? TIRADAS.umbralPorDefecto;
}

/**
 * Modificador derivado de un valor de atributo: floor((valor - 10) / 2).
 * @param {number} valor
 * @returns {number}
 */
export function modificadorAtributo(valor) {
  return Math.floor((valor - 10) / 2);
}

/**
 * Formatea un modificador con signo explícito, para la interfaz.
 * @param {number} valor
 * @returns {string} '+3', '−1', '±0'
 */
export function formatearModificador(valor) {
  if (valor === 0) return '±0';
  return valor > 0 ? `+${valor}` : `−${Math.abs(valor)}`;
}

export default {
  lanzar,
  evaluar,
  tirar,
  calcularGrado,
  combinarVentaja,
  ajustarUmbral,
  umbralPorClave,
  modificadorAtributo,
  formatearModificador,
};
