/**
 * DOM mínimo con selección real por id y clase, para reproducir en Node lo que
 * ocurre en el navegador y obtener la traza exacta.
 */

class Nodo {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attrs = {};
    // El estilo admite setProperty/removeProperty como el real.
    const props = {};
    this.style = new Proxy(props, {
      get: (o, k) => {
        if (k === 'setProperty') return (n, v) => { o[n] = String(v); };
        if (k === 'removeProperty') return (n) => { delete o[n]; };
        if (k === 'getPropertyValue') return (n) => o[n] ?? '';
        return o[k];
      },
      set: (o, k, v) => { o[k] = v; return true; },
    });
    this.dataset = {};
    this.listeners = {};
    this._texto = '';
    this.value = '';
    this.checked = false;
    this.hidden = false;
    this.disabled = false;
    this.nodeType = 1;
    this.scrollTop = 0;
    this.scrollHeight = 0;
    this.className = '';
    this.classList = {
      add: (c) => { this.className = `${this.className} ${c}`.trim(); },
      remove: (c) => { this.className = this.className.split(/\s+/).filter((x) => x !== c).join(' '); },
      toggle: () => {},
      contains: (c) => this.className.split(/\s+/).includes(c),
    };
  }

  get id() { return this.attrs.id ?? ''; }
  get textContent() { return this._texto; }
  set textContent(v) { this._texto = String(v); this.children = []; }
  set innerHTML(v) { if (!v) this.children = []; }
  get innerHTML() { return ''; }

  setAttribute(k, v) {
    this.attrs[k] = String(v);
    if (k === 'class') this.className = String(v);
    if (k === 'value') this.value = String(v);
    if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = String(v);
  }
  getAttribute(k) { return this.attrs[k] ?? null; }

  append(...hijos) {
    for (const h of hijos) {
      if (h == null) continue;
      if (h.nodeType === 1) h.parentNode = this;
      this.children.push(h);
    }
  }
  appendChild(h) { this.append(h); return h; }

  prepend(...hijos) {
    for (const h of hijos.reverse()) {
      if (h == null) continue;
      if (h.nodeType === 1) h.parentNode = this;
      this.children.unshift(h);
    }
  }
  insertBefore(nuevo, ref) {
    const i = this.children.indexOf(ref);
    if (i < 0) this.append(nuevo); else this.children.splice(i, 0, nuevo);
    return nuevo;
  }
  remove() {
    const p = this.parentNode;
    if (!p) return;
    p.children = p.children.filter((c) => c !== this);
    this.parentNode = null;
  }
  replaceChildren(...hijos) { this.children = []; this.append(...hijos); }
  contains(otro) {
    for (const n of this.todos()) if (n === otro) return true;
    return false;
  }
  closest(sel) {
    let n = this;
    while (n) { if (n.encaja?.(sel)) return n; n = n.parentNode; }
    return null;
  }
  matches(sel) { return this.encaja(sel); }
  getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 100, height: 20, x: 0, y: 0 }; }
  scrollIntoView() {}
  get offsetParent() { return this.parentNode; }
  get firstChild() { return this.children[0] ?? null; }
  get lastChild() { return this.children.at(-1) ?? null; }
  get childNodes() { return this.children; }

  addEventListener(evt, fn) { (this.listeners[evt] ??= []).push(fn); }
  removeEventListener() {}
  focus() {}
  select() {}
  disparar(evt, datos = {}) {
    for (const fn of this.listeners[evt] ?? []) {
      fn({ target: this, currentTarget: this, preventDefault() {}, stopPropagation() {}, ...datos });
    }
  }

  /** Recorre el subárbol. */
  *todos() {
    for (const h of this.children) {
      if (h.nodeType !== 1) continue;
      yield h;
      yield* h.todos();
    }
  }

  encaja(sel) {
    // Soporta #id, .clase, etiqueta, [attr="valor"] y :checked
    const partes = sel.trim().split(':');
    const base = partes[0];
    const pseudo = partes[1];

    let ok = false;

    const attr = base.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);

    if (attr) {
      ok = attr[2] === undefined
        ? this.attrs[attr[1]] !== undefined
        : this.attrs[attr[1]] === attr[2];
    } else if (base.startsWith('#')) ok = this.id === base.slice(1);
    else if (base.startsWith('.')) ok = this.className.split(/\s+/).includes(base.slice(1));
    else ok = this.tagName === base.toUpperCase();

    if (!ok) return false;
    if (pseudo === 'checked') return this.checked === true;
    return true;
  }

  querySelector(sel) {
    for (const n of this.todos()) if (n.encaja(sel)) return n;
    return null;
  }
  querySelectorAll(sel) {
    const salida = [];
    for (const n of this.todos()) if (n.encaja(sel)) salida.push(n);
    return salida;
  }
}

const raiz = new Nodo('html');
const body = new Nodo('body');
raiz.append(body);

globalThis.document = {
  readyState: 'complete',
  documentElement: raiz,
  body,
  createElement: (t) => new Nodo(t),
  createElementNS: (_ns, t) => new Nodo(t),
  getElementById: (id) => raiz.querySelector('#' + id),
  createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }),
  addEventListener: () => {},
  querySelector: (s) => raiz.querySelector(s),
  querySelectorAll: (s) => raiz.querySelectorAll(s),
};

globalThis.window = globalThis;
Object.assign(globalThis.window, {
  addEventListener: () => {},
  location: { hostname: 'localhost', protocol: 'file:', href: 'file:///demo.html' },
  matchMedia: () => ({ matches: false, addEventListener: () => {} }),
});
globalThis.location = globalThis.window.location;
// Almacenamiento real en memoria, para poder probar el guardado.
const _almacen = new Map();
globalThis.localStorage = {
  getItem: (k) => (_almacen.has(k) ? _almacen.get(k) : null),
  setItem: (k, v) => { _almacen.set(k, String(v)); },
  removeItem: (k) => { _almacen.delete(k); },
  clear: () => _almacen.clear(),
};
Object.defineProperty(globalThis, 'navigator', {
  value: { clipboard: { writeText: async () => {} } },
  configurable: true, writable: true,
});
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);

/** Construye el árbol que la demo espera encontrar. */
export function montarPagina() {
  const crear = (tag, id, clase, extra = {}) => {
    const n = new Nodo(tag);
    if (id) n.setAttribute('id', id);
    if (clase) { n.className = clase; n.setAttribute('class', clase); }
    Object.assign(n, extra);
    body.append(n);
    return n;
  };

  crear('input', 'consola-entrada', '', { value: 'intento colarme por la ventana' });
  crear('div', 'consola-salida');

  for (const t of ['ataco al lobo', 'me bebo la poción']) {
    const b = crear('button', '', 'sugerencia');
    b.setAttribute('data-texto', t);
  }

  crear('select', 'combate-enemigo', '', { value: 'lobo_ceniciento' });
  crear('select', 'combate-cuantos', '', { value: '3' });
  crear('button', 'combate-nuevo');
  crear('button', 'combate-avanzar');
  crear('div', 'combate-estado');
  crear('div', 'combate-log');
  crear('div', 'combate-dm-caja');
  crear('p', 'combate-dm');

  crear('select', 'mapa-desde');
  crear('select', 'mapa-hasta');
  crear('input', 'mapa-invierno', '', { checked: false });
  crear('div', 'mapa-salida');

  for (const v of ['feria', 'buena_cosecha', 'crisis_comercial', 'invierno_duro']) {
    const c = crear('input', '', 'evento-check', { value: v, checked: false });
    c.setAttribute('value', v);
  }
  crear('tbody', 'precios-tabla');
  crear('p', 'precios-nota');

  crear('select', 'enc-terreno', '', { value: 'camino' });
  crear('select', 'enc-peligro', '', { value: '3' });
  crear('button', 'enc-tirar');
  crear('div', 'enc-salida');

  crear('textarea', 'rescate-entrada', '', { value: '' });
  crear('div', 'rescate-salida');

  for (const caso of ['limpio', 'bloque', 'roto', 'claves', 'prosa', 'basura']) {
    const b = crear('button', '', 'ejemplo');
    b.setAttribute('data-caso', caso);
  }

  return { body, Nodo };
}

export { body, Nodo };
