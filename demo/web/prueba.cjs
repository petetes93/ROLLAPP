require('/tmp/dom-fiel.js');

// Nodos que la app espera encontrar con querySelectorAll
__fijarLista('.sugerencia', []);
__fijarLista('.evento-check', []);
__fijarLista('.ejemplo', []);
__fijarLista('#mapa-desde', []);

// Valores iniciales de los controles
__nodo('#consola-entrada').value = 'intento colarme por la ventana sin que me vean';
__nodo('#mapa-desde').value = 'vado_yunque';
__nodo('#mapa-hasta').value = 'oasis_sal';
__nodo('#mapa-invierno').checked = false;
__nodo('#combate-enemigo').value = 'lobo_ceniciento';
__nodo('#combate-cuantos').value = '3';
__nodo('#enc-terreno').value = 'bosque';
__nodo('#enc-peligro').value = '3';
__nodo('#rescate-entrada').value = '';

require('/tmp/demo-abierto.js');
const app = globalThis.__app;

const pruebas = [];
function probar(nombre, fn, comprobar) {
  try {
    fn();
    const detalle = comprobar ? comprobar() : '';
    pruebas.push(['OK ', nombre, detalle]);
  } catch (e) {
    pruebas.push(['MAL', nombre, e.message]);
  }
}

// ── consola, con varias frases ──────────────────────────────────────────
for (const frase of [
  'intento colarme por la ventana sin que me vean',
  'ataco al lobo con la espada',
  'me bebo la poción',
  'registro la habitación a fondo',
  '',
]) {
  probar(`consola: «${frase || '(vacío)'}»`,
    () => app.pintarConsola(frase),
    () => `${__contar(__nodo('#consola-salida'))} nodos`);
}

// ── mapa ────────────────────────────────────────────────────────────────
probar('mapa: ruta normal', () => app.pintarRuta(),
  () => `${__contar(__nodo('#mapa-salida'))} nodos`);

__nodo('#mapa-invierno').checked = true;
__nodo('#mapa-desde').value = 'camino_norte';
__nodo('#mapa-hasta').value = 'forja_alta';
probar('mapa: paso cerrado en invierno', () => app.pintarRuta(),
  () => `${__contar(__nodo('#mapa-salida'))} nodos`);

// ── precios ─────────────────────────────────────────────────────────────
probar('precios: sin eventos', () => app.pintarPrecios(),
  () => `${__contar(__nodo('#precios-tabla'))} celdas`);

// ── encuentros ──────────────────────────────────────────────────────────
for (const t of ['bosque', 'pantano', 'desierto', 'ruinas']) {
  __nodo('#enc-terreno').value = t;
  probar(`encuentro en ${t}`, () => app.pintarEncuentro(),
    () => `${__contar(__nodo('#enc-salida'))} nodos`);
}

// ── rescate ─────────────────────────────────────────────────────────────
const casos = {
  'JSON limpio': '{"story":"El herrero levanta la vista.","mood":"tranquilo"}',
  'con coma de más': '{"story":"Los lobos rodean el claro.",}',
  'prosa': 'La taberna huele a humo. Alguien te mira con amenaza en los ojos.',
  'negativa': 'no puedo ayudarte con eso',
};
for (const [nombre, texto] of Object.entries(casos)) {
  __nodo('#rescate-entrada').value = texto;
  probar(`rescate: ${nombre}`, () => app.pintarRescate(),
    () => `${__contar(__nodo('#rescate-salida'))} nodos`);
}

// ── combate completo ────────────────────────────────────────────────────
probar('combate: iniciar', () => app.nuevoCombate(),
  () => `${__contar(__nodo('#combate-estado'))} nodos`);

probar('combate: 30 turnos seguidos', () => {
  for (let i = 0; i < 30; i++) app.avanzarCombate();
}, () => `${__contar(__nodo('#combate-log'))} líneas`);

// ── informe ─────────────────────────────────────────────────────────────
console.log();
let fallos = 0;
for (const [estado, nombre, detalle] of pruebas) {
  if (estado === 'MAL') fallos++;
  console.log(`  ${estado}  ${nombre.padEnd(44, '.')} ${detalle}`);
}
console.log();
console.log(`  ${pruebas.length} pruebas · ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
