/**
 * Simulador de DOM lo bastante fiel como para que la demo web se ejecute
 * de verdad: los selectores devuelven nodos distintos, los valores se
 * conservan y los manejadores se pueden disparar.
 *
 * El simulador anterior devolvía nodos vacíos para todo, así que la mitad
 * del código nunca llegaba a ejecutarse y los fallos pasaban desapercibidos.
 */

const registro = new Map();
const manejadores = new Map();

function crear(tag = 'div') {
  const hijos = [];
  const oyentes = {};

  const n = {
    tagName: String(tag).toUpperCase(),
    nodeType: 1,
    className: '',
    textContent: '',
    style: {},
    dataset: {},
    value: '',
    checked: false,
    hidden: false,
    disabled: false,
    scrollTop: 0,
    scrollHeight: 0,
    children: hijos,
    _oyentes: oyentes,

    set innerHTML(v) { hijos.length = 0; },
    get innerHTML() { return ''; },

    append(...h) { for (const x of h.flat()) if (x != null) hijos.push(x); },
    appendChild(h) { hijos.push(h); return h; },
    setAttribute(k, v) { if (k.startsWith('data-')) n.dataset[k.slice(5)] = v; },
    getAttribute() { return null; },
    addEventListener(ev, f) { (oyentes[ev] ??= []).push(f); },
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    focus() {},
    select() {},
    classList: {
      add() {}, remove() {}, toggle() {}, contains() { return false; },
    },
  };

  return n;
}

/** Devuelve siempre el MISMO nodo para el mismo selector. */
function porSelector(sel) {
  if (!registro.has(sel)) registro.set(sel, crear());
  return registro.get(sel);
}

globalThis.document = {
  readyState: 'complete',
  body: crear('body'),
  createElement: (t) => crear(t),
  createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }),
  addEventListener() {},
  querySelector: porSelector,
  querySelectorAll(sel) { return registro.get('##' + sel) ?? []; },
};

globalThis.window = {
  addEventListener() {},
  location: { hostname: 'localhost', protocol: 'file:', href: 'file:///demo.html' },
  matchMedia: () => ({ matches: false, addEventListener() {} }),
};
globalThis.location = globalThis.window.location;
globalThis.navigator = { clipboard: { writeText: async () => {} } };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
globalThis.performance = { now: () => Date.now() };

/** Registra una lista para un selector de querySelectorAll. */
globalThis.__fijarLista = (sel, nodos) => registro.set('##' + sel, nodos);

/** Recupera el nodo de un selector, para inspeccionarlo o dispararlo. */
globalThis.__nodo = porSelector;

/** Dispara un evento sobre un selector. */
globalThis.__disparar = (sel, evento) => {
  const n = porSelector(sel);
  for (const f of n._oyentes[evento] ?? []) f({ target: n, preventDefault() {} });
};

/** Cuenta los descendientes de un nodo, para saber si se pintó algo. */
globalThis.__contar = (n) => {
  let total = 0;
  const pila = [...(n.children ?? [])];
  while (pila.length) {
    const x = pila.pop();
    total++;
    if (x?.children) pila.push(...x.children);
  }
  return total;
};

module.exports = { crear, porSelector };
