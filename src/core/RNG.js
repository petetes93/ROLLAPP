/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · core/RNG.js
 * ---------------------------------------------------------------------------
 * Generador de números pseudoaleatorios determinista, con semilla.
 *
 * Math.random() no vale para un motor de rol: no se puede reproducir una
 * partida, no se puede depurar un combate y no se puede regenerar el mismo
 * mundo dos veces. Aquí se usa mulberry32, un generador de 32 bits rápido, de
 * distribución uniforme y estado mínimo (un solo entero), lo que hace trivial
 * serializarlo dentro del guardado.
 *
 * El motor mantiene flujos SEPARADOS por dominio: la tirada de un dado no debe
 * alterar la secuencia de generación del mundo. Así, mirar una vez más en un
 * cofre no cambia el clima de mañana.
 *
 * Dependencias: Logger.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { crearCanal } from './Logger.js';

const log = crearCanal('rng');

/* ═══════════════════════════════════════════════════════════════════════════
   ALGORITMO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * mulberry32: PRNG de 32 bits. Rápido, sin dependencias y de calidad más que
 * suficiente para un juego. Periodo ≈ 2³².
 *
 * @param {number} semilla Entero de 32 bits.
 * @returns {() => number} Función que devuelve un flotante en [0, 1).
 */
function mulberry32(semilla) {
  let a = semilla >>> 0;
  return function siguiente() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Convierte una cadena en un entero de 32 bits (hash FNV-1a de 32 bits).
 * Permite usar semillas legibles: 'La Posada del Yunque' produce siempre el
 * mismo mundo.
 *
 * @param {string} texto
 * @returns {number} Entero de 32 bits sin signo.
 */
export function hashSemilla(texto) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Genera una semilla aleatoria de 32 bits usando la fuente criptográfica del
 * navegador cuando está disponible.
 * @returns {number}
 */
export function semillaAleatoria() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return (Math.random() * 0xffffffff) >>> 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   FLUJO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Un flujo aleatorio independiente con su propio estado serializable.
 */
export class Flujo {
  /**
   * @param {number|string} semilla Entero o cadena (se convierte por hash).
   * @param {string} [nombre='anonimo'] Etiqueta para diagnóstico.
   */
  constructor(semilla, nombre = 'anonimo') {
    this.nombre = nombre;
    this.semillaInicial = typeof semilla === 'string' ? hashSemilla(semilla) : semilla >>> 0;
    this._estado = this.semillaInicial;
    this._llamadas = 0;
    this._siguiente = mulberry32(this._estado);
  }

  /* ─── Primitivas ─────────────────────────────────────────────────────── */

  /**
   * Flotante uniforme en [0, 1).
   * @returns {number}
   */
  next() {
    this._llamadas++;
    // Se mantiene el estado sincronizado para poder serializarlo en cualquier
    // momento sin depender del cierre interno de mulberry32.
    this._estado = (this._estado + 0x6d2b79f5) >>> 0;
    let t = this._estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Entero uniforme en [min, max], ambos inclusive.
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  entero(min, max) {
    if (max < min) [min, max] = [max, min];
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Flotante uniforme en [min, max).
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  flotante(min, max) {
    return this.next() * (max - min) + min;
  }

  /**
   * Prueba de probabilidad.
   * @param {number} p Probabilidad entre 0 y 1.
   * @returns {boolean}
   */
  oportunidad(p) {
    return this.next() < p;
  }

  /**
   * Moneda al aire.
   * @returns {boolean}
   */
  moneda() {
    return this.next() < 0.5;
  }

  /* ─── Colecciones ────────────────────────────────────────────────────── */

  /**
   * Elemento al azar de un array.
   * @template T
   * @param {T[]} lista
   * @returns {T|undefined} undefined si la lista está vacía.
   */
  elegir(lista) {
    if (!Array.isArray(lista) || lista.length === 0) return undefined;
    return lista[Math.floor(this.next() * lista.length)];
  }

  /**
   * N elementos distintos al azar (muestreo sin reposición).
   * @template T
   * @param {T[]} lista
   * @param {number} n
   * @returns {T[]}
   */
  elegirVarios(lista, n) {
    const copia = lista.slice();
    this.barajar(copia);
    return copia.slice(0, Math.max(0, Math.min(n, copia.length)));
  }

  /**
   * Elección ponderada. Es el corazón de las tablas de botín y de encuentros.
   *
   * @template T
   * @param {Array<{valor: T, peso: number}>} entradas
   * @returns {T|undefined}
   *
   * @example
   * rng.elegirPonderado([
   *   { valor: 'comun', peso: 100 },
   *   { valor: 'raro',  peso: 5 },
   * ]);
   */
  elegirPonderado(entradas) {
    if (!Array.isArray(entradas) || entradas.length === 0) return undefined;
    let total = 0;
    for (const e of entradas) total += Math.max(0, e.peso ?? 0);
    if (total <= 0) return this.elegir(entradas)?.valor;

    let umbral = this.next() * total;
    for (const e of entradas) {
      umbral -= Math.max(0, e.peso ?? 0);
      if (umbral <= 0) return e.valor;
    }
    return entradas[entradas.length - 1].valor;
  }

  /**
   * Igual que elegirPonderado, pero sobre un objeto { clave: peso }.
   * Encaja directamente con las tablas de balance.config.js.
   *
   * @param {Record<string, number>} mapa
   * @returns {string|undefined}
   */
  elegirClavePonderada(mapa) {
    const entradas = Object.entries(mapa).map(([valor, peso]) => ({ valor, peso }));
    return this.elegirPonderado(entradas);
  }

  /**
   * Baraja un array in situ (Fisher-Yates).
   * @template T
   * @param {T[]} lista
   * @returns {T[]} La misma lista, ya barajada.
   */
  barajar(lista) {
    for (let i = lista.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    return lista;
  }

  /* ─── Distribuciones ─────────────────────────────────────────────────── */

  /**
   * Distribución normal aproximada mediante suma de tres uniformes.
   * Útil para variación de precios, estadísticas de PNJ y desviaciones sutiles
   * donde una uniforme resultaría demasiado plana.
   *
   * @param {number} media
   * @param {number} desviacion
   * @returns {number}
   */
  normal(media = 0, desviacion = 1) {
    const u = (this.next() + this.next() + this.next()) / 3;
    return media + (u - 0.5) * 2 * desviacion * 1.732;
  }

  /**
   * Valor sesgado hacia el extremo inferior o superior del rango.
   * @param {number} min
   * @param {number} max
   * @param {number} [sesgo=2] >1 sesga hacia min; <1 hacia max.
   * @returns {number}
   */
  sesgado(min, max, sesgo = 2) {
    return min + (max - min) * Math.pow(this.next(), sesgo);
  }

  /* ─── Estado ─────────────────────────────────────────────────────────── */

  /**
   * Serializa el flujo para el guardado.
   * @returns {{nombre: string, semilla: number, estado: number, llamadas: number}}
   */
  serializar() {
    return {
      nombre: this.nombre,
      semilla: this.semillaInicial,
      estado: this._estado,
      llamadas: this._llamadas,
    };
  }

  /**
   * Restaura un flujo serializado.
   * @param {{nombre?: string, semilla: number, estado: number, llamadas?: number}} datos
   * @returns {Flujo}
   */
  static restaurar(datos) {
    const f = new Flujo(datos.semilla, datos.nombre ?? 'restaurado');
    f._estado = datos.estado >>> 0;
    f._llamadas = datos.llamadas ?? 0;
    return f;
  }

  /**
   * Crea un flujo hijo derivado de éste. El hijo es determinista respecto al
   * padre, pero consumirlo no altera la secuencia paterna.
   *
   * Es lo que permite generar una mazmorra entera sin tocar la secuencia de
   * combate: `rng.derivar('mazmorra:cripta-3')`.
   *
   * @param {string} etiqueta
   * @returns {Flujo}
   */
  derivar(etiqueta) {
    const semillaHija = (this.semillaInicial ^ hashSemilla(etiqueta)) >>> 0;
    return new Flujo(semillaHija, `${this.nombre}/${etiqueta}`);
  }

  /** Reinicia el flujo a su semilla original. */
  reiniciar() {
    this._estado = this.semillaInicial;
    this._llamadas = 0;
  }

  /** Número de valores consumidos desde el inicio. */
  get llamadas() {
    return this._llamadas;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   GESTOR DE FLUJOS
   ---------------------------------------------------------------------------
   Los dominios están separados a propósito. Repetir una tirada de percepción
   no debe alterar qué objetos aparecerán en el próximo cofre.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Dominios estándar del motor. */
export const DOMINIO = Object.freeze({
  DADOS: 'dados',
  COMBATE: 'combate',
  BOTIN: 'botin',
  MUNDO: 'mundo',
  CLIMA: 'clima',
  ENCUENTROS: 'encuentros',
  NPC: 'npc',
  NARRATIVA: 'narrativa',
});

export class GestorRNG {
  /**
   * @param {number|string} [semillaMaestra] Si se omite, se genera al azar.
   */
  constructor(semillaMaestra) {
    this.semillaMaestra = semillaMaestra === undefined
      ? semillaAleatoria()
      : (typeof semillaMaestra === 'string' ? hashSemilla(semillaMaestra) : semillaMaestra >>> 0);

    /** @type {Map<string, Flujo>} */
    this._flujos = new Map();

    for (const dominio of Object.values(DOMINIO)) this._crear(dominio);

    log.info(`RNG inicializado con semilla maestra ${this.semillaMaestra}`);
  }

  /**
   * @param {string} dominio
   * @returns {Flujo}
   * @private
   */
  _crear(dominio) {
    const semilla = (this.semillaMaestra ^ hashSemilla(dominio)) >>> 0;
    const flujo = new Flujo(semilla, dominio);
    this._flujos.set(dominio, flujo);
    return flujo;
  }

  /**
   * Obtiene el flujo de un dominio, creándolo si no existe.
   * @param {string} [dominio=DOMINIO.DADOS]
   * @returns {Flujo}
   */
  flujo(dominio = DOMINIO.DADOS) {
    return this._flujos.get(dominio) ?? this._crear(dominio);
  }

  /** Atajos a los dominios más usados. */
  get dados() { return this.flujo(DOMINIO.DADOS); }
  get combate() { return this.flujo(DOMINIO.COMBATE); }
  get botin() { return this.flujo(DOMINIO.BOTIN); }
  get mundo() { return this.flujo(DOMINIO.MUNDO); }

  /**
   * Serializa todos los flujos para el guardado.
   * @returns {{semillaMaestra: number, flujos: Object[]}}
   */
  serializar() {
    return {
      semillaMaestra: this.semillaMaestra,
      flujos: [...this._flujos.values()].map((f) => f.serializar()),
    };
  }

  /**
   * Restaura un gestor completo desde el guardado.
   * @param {{semillaMaestra: number, flujos: Object[]}} datos
   * @returns {GestorRNG}
   */
  static restaurar(datos) {
    const g = new GestorRNG(datos.semillaMaestra);
    for (const f of datos.flujos ?? []) {
      g._flujos.set(f.nombre, Flujo.restaurar(f));
    }
    log.info(`RNG restaurado (semilla ${datos.semillaMaestra})`);
    return g;
  }
}

export default GestorRNG;
