/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · ui/components/Panel.js
 * ---------------------------------------------------------------------------
 * Bloque de panel con cabecera: título, icono, contador y cuerpo.
 *
 * No es un componente que se monte por sí solo, sino el marco que reutilizan
 * CharacterPanel, InventoryPanel, QuestPanel y compañía. Unifica la cabecera y
 * el estado vacío, para que ningún panel tenga que reinventar ninguno de los dos.
 *
 * Se exporta como funciones constructoras, no como clase: es composición pura
 * de nodos, sin ciclo de vida propio.
 *
 * Dependencias: DOM.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { h, icono, texto as fijarTexto } from '../DOM.js';

/**
 * Cabecera de bloque.
 *
 * @param {Object} config
 * @param {string} config.titulo Texto en versalitas.
 * @param {string} [config.icono] Clave de ICONOS.
 * @param {string|number} [config.contador] Cifra a la derecha ('12/40').
 * @param {Node|Node[]} [config.acciones] Botones adicionales.
 * @returns {HTMLElement}
 */
export function cabecera({ titulo, icono: claveIcono, contador, acciones }) {
  return h('div.block__head',
    {},
    h('div.block__title', {},
      claveIcono ? icono(claveIcono) : null,
      h('span', { text: titulo }),
    ),
    contador !== undefined && contador !== null
      ? h('span.block__count', { text: String(contador) })
      : null,
    acciones ?? null,
  );
}

/**
 * Mensaje de estado vacío.
 * @param {string} mensaje
 * @returns {HTMLElement}
 */
export function vacio(mensaje) {
  return h('p.block__empty', { text: mensaje });
}

/**
 * Bloque completo: cabecera más cuerpo.
 *
 * @param {Object} config Igual que `cabecera`, más:
 * @param {Node|Node[]} config.cuerpo Contenido del bloque.
 * @param {boolean} [config.crecer=false] El cuerpo ocupa el alto sobrante.
 * @returns {HTMLElement}
 */
export function bloque(config) {
  const { cuerpo, crecer = false, ...cabeceraConfig } = config;
  return h('div', { class: crecer ? 'stack stack--sm grow' : 'stack stack--sm' },
    cabecera(cabeceraConfig),
    cuerpo,
  );
}

/**
 * Actualiza el contador de una cabecera ya renderizada, sin rehacer el bloque.
 * @param {HTMLElement} raiz Contenedor del bloque.
 * @param {string|number} valor
 */
export function actualizarContador(raiz, valor) {
  const el = raiz?.querySelector('.block__count');
  if (el) fijarTexto(el, valor);
}

/**
 * Fila de dato: etiqueta a la izquierda, valor a la derecha.
 * Es el patrón de las fichas de personaje y de objeto.
 *
 * @param {string} etiqueta
 * @param {string|number|Node} valor
 * @param {Object} [opciones]
 * @param {string} [opciones.clase] Clase extra para el valor.
 * @returns {HTMLElement}
 */
export function fila(etiqueta, valor, opciones = {}) {
  return h('div.row.row--between', {},
    h('span', { class: 'eyebrow', text: etiqueta }),
    valor instanceof Node
      ? valor
      : h('span', { class: opciones.clase ?? '', text: String(valor) }),
  );
}

/**
 * Separador ornamental.
 * @returns {HTMLElement}
 */
export function filo() {
  return h('div.filo');
}

/**
 * Bloque de carga: placeholders con animación de brillo mientras llegan datos.
 * @param {number} [filas=3]
 * @returns {HTMLElement}
 */
export function esqueleto(filas = 3) {
  return h('div.stack.stack--sm', {},
    ...Array.from({ length: filas }, (_, i) =>
      h('div.skeleton', {
        style: { height: '14px', width: `${100 - i * 12}%` },
        text: '\u00A0',
      }),
    ),
  );
}

export default { cabecera, vacio, bloque, fila, filo, esqueleto, actualizarContador };
