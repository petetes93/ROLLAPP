/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · utils/format.js
 * ---------------------------------------------------------------------------
 * Formateo de valores para la interfaz.
 *
 * Toda cifra que ve el jugador pasa por aquí. Centralizarlo garantiza que el
 * oro se escriba igual en el inventario, en la tienda y en el aviso flotante.
 *
 * Dependencias: utils/math.js, utils/text.js.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { redondear } from './math.js';
import { contar } from './text.js';

/** Formateador de números con separador de millar español. */
const NUM = new Intl.NumberFormat('es-ES');

/**
 * Número con separador de millar.
 * @param {number} n
 * @returns {string} 12500 → '12.500'
 */
export function numero(n) {
  return NUM.format(Math.round(n));
}

/**
 * Número compacto para espacios estrechos.
 * @param {number} n
 * @returns {string} 12500 → '12,5 k'
 */
export function compacto(n) {
  const abs = Math.abs(n);
  if (abs < 1000) return String(Math.round(n));
  if (abs < 1_000_000) return `${redondear(n / 1000, 1).toString().replace('.', ',')} k`;
  return `${redondear(n / 1_000_000, 1).toString().replace('.', ',')} M`;
}

/**
 * Cantidad de oro.
 * @param {number} n
 * @returns {string} '1.250 de oro'
 */
export function oro(n) {
  return `${numero(n)} de oro`;
}

/**
 * Peso transportado.
 * @param {number} n
 * @returns {string} '12,5 kg'
 */
export function peso(n) {
  return `${redondear(n, 1).toString().replace('.', ',')} kg`;
}

/**
 * Barra numérica actual/máximo.
 * @param {number} actual
 * @param {number} max
 * @returns {string} '34/50'
 */
export function razon(actual, max) {
  return `${Math.round(actual)}/${Math.round(max)}`;
}

/**
 * Porcentaje entero.
 * @param {number} valor Fracción entre 0 y 1, o valor ya en porcentaje si se
 *   indica `yaEsPorcentaje`.
 * @param {boolean} [yaEsPorcentaje=false]
 * @returns {string} '68 %'
 */
export function porciento(valor, yaEsPorcentaje = false) {
  const p = yaEsPorcentaje ? valor : valor * 100;
  return `${Math.round(p)} %`;
}

/**
 * Modificador con signo explícito, para atributos y bonificadores.
 * @param {number} n
 * @returns {string} '+3' | '−1' | '±0'
 */
export function modificador(n) {
  if (n === 0) return '±0';
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/**
 * Hora del mundo.
 * @param {number} hora
 * @param {number} minuto
 * @returns {string} '07:05'
 */
export function reloj(hora, minuto) {
  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
}

/**
 * Duración legible a partir de minutos de mundo.
 * @param {number} minutos
 * @returns {string} '2 horas y 30 minutos'
 */
export function duracion(minutos) {
  if (minutos < 60) return contar(Math.round(minutos), 'minuto');
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  const horas = contar(h, 'hora');
  return m === 0 ? horas : `${horas} y ${contar(m, 'minuto')}`;
}

/**
 * Tiempo real jugado, para el menú de partidas.
 * @param {number} ms
 * @returns {string} '3 h 12 min'
 */
export function tiempoJugado(ms) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/**
 * Fecha absoluta, para la lista de guardados.
 * @param {number} marca Milisegundos epoch.
 * @returns {string} '14 mar, 21:40'
 */
export function fecha(marca) {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(marca));
}

/**
 * Durabilidad como porcentaje y etiqueta.
 * @param {number} valor 0-100
 * @returns {{texto: string, estado: 'intacto'|'usado'|'desgastado'|'roto'}}
 */
export function durabilidad(valor) {
  const v = Math.round(valor);
  if (v <= 0) return { texto: 'Roto', estado: 'roto' };
  if (v < 40) return { texto: `${v} % · desgastado`, estado: 'desgastado' };
  if (v < 80) return { texto: `${v} %`, estado: 'usado' };
  return { texto: `${v} %`, estado: 'intacto' };
}

/**
 * Resultado de una tirada, listo para la bitácora.
 * @param {import('../core/Dice.js').ResultadoTirada} tirada
 * @returns {string} 'd20 14 + 3 = 17 vs 15 · éxito'
 */
export function tirada(tirada_) {
  const partes = [tirada_.notacion];
  if (tirada_.umbral !== null) partes.push(`vs ${tirada_.umbral}`);
  if (tirada_.critico) partes.push('¡crítico!');
  else if (tirada_.pifia) partes.push('¡pifia!');
  else if (tirada_.umbral !== null) partes.push(tirada_.exito ? 'éxito' : 'fallo');
  return partes.join(' · ');
}

/**
 * Clase CSS del resultado de una tirada, para colorear la ficha.
 * @param {import('../core/Dice.js').ResultadoTirada} tirada_
 * @returns {'critico'|'pifia'|'exito'|'fallo'}
 */
export function claseTirada(tirada_) {
  if (tirada_.critico) return 'critico';
  if (tirada_.pifia) return 'pifia';
  return tirada_.exito ? 'exito' : 'fallo';
}

export default {
  numero, compacto, oro, peso, razon, porciento, modificador,
  reloj, duracion, tiempoJugado, fecha, durabilidad, tirada, claseTirada,
};
