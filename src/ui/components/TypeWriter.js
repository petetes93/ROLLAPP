/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ui/components/TypeWriter.js
 * ---------------------------------------------------------------------------
 * Escritura progresiva de la narración.
 *
 * Detalles que separan un efecto agradable de uno irritante:
 *
 *   · Ritmo variable. Una coma cuesta más que una letra; un punto, mucho más.
 *     El texto respira como se lee, no como una impresora matricial.
 *   · Salto instantáneo. Un clic, Enter o Espacio completan el texto de golpe.
 *     Nadie debería esperar a una animación para seguir jugando.
 *   · Escritura por fotograma, no por carácter. Un setTimeout por letra son
 *     mil temporizadores en un párrafo largo; aquí es un solo bucle de rAF que
 *     escribe todos los caracteres que toquen en ese fotograma.
 *   · Respeta prefers-reduced-motion y el ajuste del jugador: con velocidad 0
 *     el texto aparece completo, sin animación.
 *
 * Seguridad: escribe con textContent sobre nodos de texto. El contenido del
 * director nunca se interpreta como HTML.
 *
 * Dependencias: DOM, utils/text.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { h } from '../DOM.js';
import { parrafos } from '../../utils/text.js';

/** Multiplicador de pausa según el carácter recién escrito. */
const PAUSA = Object.freeze({
  '.': 12,
  '!': 12,
  '?': 12,
  '…': 14,
  ':': 8,
  ';': 8,
  ',': 5,
  '—': 4,
  '\n': 10,
});

export class TypeWriter {
  /**
   * @param {Object} [opciones]
   * @param {number} [opciones.velocidad=14] Milisegundos por carácter. 0 = instantáneo.
   * @param {boolean} [opciones.cursor=true] Muestra el cursor parpadeante.
   * @param {() => void} [opciones.alTerminar]
   * @param {(progreso: number) => void} [opciones.alAvanzar] Recibe 0-1.
   */
  constructor(opciones = {}) {
    this.velocidad = opciones.velocidad ?? 14;
    this.mostrarCursor = opciones.cursor !== false;
    this.alTerminar = opciones.alTerminar ?? null;
    this.alAvanzar = opciones.alAvanzar ?? null;

    /** @type {HTMLElement|null} @private */
    this._destino = null;
    /** @type {string[]} @private */
    this._bloques = [];
    /** @type {Text|null} Nodo de texto que se está rellenando. @private */
    this._nodoTexto = null;
    /** @type {HTMLElement|null} @private */
    this._cursor = null;

    /** @private */ this._bloque = 0;
    /** @private */ this._indice = 0;
    /** @private */ this._deuda = 0;      // milisegundos de pausa pendientes
    /** @private */ this._ultimo = 0;
    /** @private */ this._solicitud = null;
    /** @private */ this._activo = false;
    /** @private */ this._totalCaracteres = 0;
    /** @private */ this._escritos = 0;
  }

  /** @returns {boolean} true mientras está escribiendo. */
  get activo() {
    return this._activo;
  }

  /**
   * Escribe un texto dentro de un contenedor.
   *
   * @param {HTMLElement} destino Contenedor. Se vacía antes de empezar.
   * @param {string} texto Puede contener varios párrafos separados por línea en blanco.
   * @returns {Promise<void>} Resuelve al terminar o al saltar.
   */
  escribir(destino, texto) {
    this.detener();

    this._destino = destino;
    this._bloques = parrafos(texto);
    if (!this._bloques.length) this._bloques = [String(texto ?? '')];

    this._totalCaracteres = this._bloques.reduce((a, b) => a + b.length, 0);
    this._escritos = 0;
    this._bloque = 0;
    this._indice = 0;
    this._deuda = 0;

    destino.textContent = '';

    // Velocidad 0 o movimiento reducido: se pinta todo de una vez.
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (this.velocidad <= 0 || reducido) {
      this._pintarTodo();
      this.alTerminar?.();
      return Promise.resolve();
    }

    this._activo = true;
    this._crearParrafo();

    if (this.mostrarCursor) {
      this._cursor = h('span.typewriter__caret', { text: '▌' });
      destino.appendChild(this._cursor);
    }

    return new Promise((resolver) => {
      this._resolver = resolver;
      this._ultimo = performance.now();
      this._solicitud = requestAnimationFrame((t) => this._paso(t));
    });
  }

  /**
   * Bucle de escritura. Se ejecuta una vez por fotograma y escribe tantos
   * caracteres como corresponda al tiempo transcurrido.
   *
   * @param {number} ahora
   * @private
   */
  _paso(ahora) {
    if (!this._activo) return;

    const delta = ahora - this._ultimo;
    this._ultimo = ahora;

    // La deuda acumula las pausas de puntuación: mientras sea positiva, no se
    // escribe nada, solo se descuenta.
    this._deuda -= delta;
    if (this._deuda > 0) {
      this._solicitud = requestAnimationFrame((t) => this._paso(t));
      return;
    }

    let presupuesto = -this._deuda;
    this._deuda = 0;

    // Tope de seguridad: nunca más de 400 caracteres por fotograma, para que
    // una pestaña que vuelve del segundo plano no vuelque el texto de golpe.
    let escritosAhora = 0;

    while (presupuesto >= this.velocidad && escritosAhora < 400) {
      const bloque = this._bloques[this._bloque];

      if (this._indice >= bloque.length) {
        // Fin de párrafo: se abre el siguiente, si lo hay.
        this._bloque++;
        this._indice = 0;
        if (this._bloque >= this._bloques.length) {
          this._finalizar();
          return;
        }
        this._crearParrafo();
        this._deuda = this.velocidad * PAUSA['\n'];
        break;
      }

      const caracter = bloque[this._indice++];
      this._nodoTexto.appendData(caracter);
      this._escritos++;
      escritosAhora++;
      presupuesto -= this.velocidad;

      const pausa = PAUSA[caracter];
      if (pausa) {
        this._deuda = this.velocidad * pausa;
        break;
      }
    }

    if (this.alAvanzar && this._totalCaracteres > 0) {
      this.alAvanzar(this._escritos / this._totalCaracteres);
    }

    this._solicitud = requestAnimationFrame((t) => this._paso(t));
  }

  /**
   * Abre un párrafo nuevo con su nodo de texto vacío.
   * @private
   */
  _crearParrafo() {
    const p = document.createElement('p');
    this._nodoTexto = document.createTextNode('');
    p.appendChild(this._nodoTexto);

    if (this._cursor) this._destino.insertBefore(p, this._cursor);
    else this._destino.appendChild(p);
  }

  /**
   * Completa el texto de inmediato. Es lo que ocurre al pulsar o hacer clic.
   */
  saltar() {
    if (!this._activo) return;
    this._pintarTodo();
    this._finalizar();
  }

  /**
   * Vuelca todo el texto restante sin animación.
   * @private
   */
  _pintarTodo() {
    if (!this._destino) return;
    this._destino.textContent = '';
    for (const bloque of this._bloques) {
      this._destino.appendChild(h('p', { text: bloque }));
    }
    this._escritos = this._totalCaracteres;
  }

  /** @private */
  _finalizar() {
    this._activo = false;
    if (this._solicitud !== null) cancelAnimationFrame(this._solicitud);
    this._solicitud = null;
    this._cursor?.remove();
    this._cursor = null;
    this.alAvanzar?.(1);
    this.alTerminar?.();
    this._resolver?.();
    this._resolver = null;
  }

  /**
   * Detiene la escritura sin completar el texto. Se usa al destruir el
   * componente que la aloja.
   */
  detener() {
    if (this._solicitud !== null) cancelAnimationFrame(this._solicitud);
    this._solicitud = null;
    this._activo = false;
    this._cursor?.remove();
    this._cursor = null;
    this._resolver = null;
  }
}

export default TypeWriter;
