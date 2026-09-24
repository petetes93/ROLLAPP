#!/usr/bin/env node
/** RegresiÃ³n real de la PWA en Chrome, sin dependencias externas. */
import { spawn, spawnSync } from 'node:child_process';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();
const PORT = 8765;
const DEBUG = 9228;
const URL_APP = `http://127.0.0.1:${PORT}/app/index.html`;
const out = process.argv.includes('--capturas') ? resolve('dist/regresion') : null;
const desktop = process.argv.includes('--desktop');

/**
 * `--sin-ia` bloquea el servicio de imágenes para probar el respaldo.
 *
 * La regresión tiene que valer con red y sin ella, porque las dos son
 * situaciones reales del jugador. Con la opción puesta, el retrato de IA no
 * puede cargar y el vectorial es la única salida posible: si el juego sigue
 * en pie y con cara, el respaldo funciona de verdad y no de palabra.
 */
const sinIA = process.argv.includes('--sin-ia');
const viewport = desktop ? { width: 1440, height: 900, label: '1440x900' } : { width: 390, height: 844, label: '390x844' };
// Antes de abrir el navegador: ¿el trabajador de servicio conoce el código
// actual?
//
// Tres módulos que se cargan al arrancar pasaron días fuera del cache y esta
// regresión no lo vio: su prueba sin red corre con el cache HTTP del
// navegador todavía caliente, así que el archivo aparecía aunque el
// trabajador no lo tuviera. Instalado de verdad y sin conexión, el juego no
// arrancaba. Comprobarlo aquí cuesta un instante y no depende del navegador.
{
  const sw = spawnSync(process.execPath, ['tools/generar-sw.mjs', '--revisar'], { cwd: ROOT, encoding: 'utf8' });
  if (sw.status !== 0) {
    console.error((sw.stdout || sw.stderr || '').trim() || 'sw.js está desfasado.');
    process.exit(1);
  }
}

const profile = await mkdtemp(join(tmpdir(), 'arcanveil-chrome-'));
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const children = [];
const stop = async () => {
  for (const p of children) { try { p.kill('SIGTERM'); } catch {} }
  await wait(400);
  for (let i=0;i<5;i++){ try { await rm(profile,{recursive:true,force:true}); break; } catch { await wait(200); } }
};
process.on('SIGINT', () => stop().finally(() => process.exit(130)));
process.on('SIGTERM', () => stop().finally(() => process.exit(143)));

function launch(cmd, args) {
  const p = spawn(cmd, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(p);
  return p;
}
async function json(url, init) {
  for (let i = 0; i < 150; i++) {
    try { const r = await fetch(url, init); if (r.ok) { const t=await r.text(); try{return JSON.parse(t)}catch{return t} } } catch {}
    await wait(100);
  }
  throw new Error(`No responde ${url}`);
}

const server = launch(process.execPath, ['tools/servir.mjs', '--puerto', String(PORT)]);
let serverErr = ''; server.stderr.on('data', d => { serverErr += d; });
/**
 * Dónde está Chrome.
 *
 * Estaba escrito `google-chrome` a secas, que solo existe en Linux: en un
 * Windows recién clonado la regresión no arrancaba y el error era un ENOENT
 * sin pistas. Se prueban los sitios de siempre de cada sistema y se puede
 * forzar con `CHROME_BIN` para los casos raros.
 */
function buscarChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;

  const candidatos = {
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
  }[process.platform] ?? ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];

  for (const c of candidatos) {
    // En Linux los candidatos son nombres sueltos y los resuelve el PATH.
    if (!c.includes('/') && !c.includes('\\')) return c;
    if (existsSync(c)) return c;
  }

  throw new Error('No encuentro Chrome. Indícalo con CHROME_BIN=/ruta/a/chrome');
}

const chrome = launch(buscarChrome(), [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  `--window-size=${viewport.width},${viewport.height}`, `--remote-debugging-port=${DEBUG}`,
  `--user-data-dir=${profile}`, 'about:blank',
]);
let chromeErr = ''; chrome.stderr.on('data', d => { chromeErr += d; });

let ws;
let seq = 0;
const pending = new Map();
const exceptions = [];
function cdp(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression, awaitPromise = true) {
  const r = await cdp('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result?.value;
}
async function until(expression, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await wait(100);
  }
  throw new Error(`Tiempo agotado esperando: ${expression}`);
}
async function shot(name) {
  if (!out) return;
  await import('node:fs/promises').then(m => m.mkdir(out, { recursive: true }));
  const r = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(join(out, name), Buffer.from(r.data, 'base64'));
}

try {
  await json(`http://127.0.0.1:${PORT}/app/index.html`);
  const target = await json(`http://127.0.0.1:${DEBUG}/json/new?${encodeURIComponent(URL_APP)}`, { method: 'PUT' });
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      exceptions.push(m.params.exceptionDetails?.text ?? 'excepciÃ³n');
    }
  };
  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Network.enable');

  if (sinIA) {
    await cdp('Network.setBlockedURLs', { urls: ['*image.pollinations.ai*', '*pollinations.ai*'] });
    await cdp('Page.reload', { ignoreCache: true });
    await until('window.ARCANVEIL?.motor?.listo && document.body.classList.contains("esta-listo")');
  }

  await until('window.ARCANVEIL?.motor?.listo && document.body.classList.contains("esta-listo")');
  const boot = await evaluate(`({screen:document.body.dataset.activeScreen, systems:ARCANVEIL.inspeccionar().total, failures:document.querySelectorAll('#fallos').length})`);
  if (boot.screen !== 'inicio' || boot.failures) throw new Error(`arranque invÃ¡lido ${JSON.stringify(boot)}`);
  await shot(`01-inicio-${viewport.label}.png`);

  const menu = await evaluate(`[...document.querySelectorAll('.menu-btn')].filter(b=>!b.hidden && getComputedStyle(b).display!=='none').map(b=>b.id)`);
  for (const id of ['menu-nueva', 'menu-cargar', 'menu-ajustes']) if (!menu.includes(id)) throw new Error(`falta ${id} en la portada: ${menu}`);

  await evaluate(`document.querySelector('#menu-nueva').click()`);
  await until('document.body.dataset.activeScreen === "creacion" && document.querySelector("#aleatoria-raza")');
  // El dado vuelve a tirar raza y nombre en cada pulsación.
  const tiradas = new Set();
  for (let i = 0; i < 6; i++) {
    tiradas.add(await evaluate(`document.querySelector('#aleatoria-raza').textContent + '|' + document.querySelector('#nombre').value`));
    await evaluate(`document.querySelector('#creacion-aleatorio').click()`);
  }
  if (tiradas.size < 3) throw new Error(`el generador aleatorio no varía: ${[...tiradas]}`);
  await evaluate(`(()=>{const fill=(q,v)=>{const n=document.querySelector(q);n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}))};fill('#nombre','Lyra');fill('#retrato-descripcion','elfa exploradora de pelo plateado, ojos azul brillante, cicatriz en la ceja y armadura de cuero negro');fill('#lore-personaje','Mi hermana cruzó el Umbral con nuestro medallón. La busco desde entonces.');})()`);
  await shot(`02a-creacion-${viewport.label}.png`);
  await evaluate(`document.querySelector('#creacion-crear').click()`);
  await until('document.querySelector("#creacion-empezar") && document.querySelector("#creacion-cara .arte")');
  // Mismo criterio de dos vías que abajo: la cicatriz vectorial vale, y la
  // imagen de IA cargada también. Con `--sin-ia` solo puede valer la primera,
  // que es justo lo que esa opción sirve para comprobar.
  const retrato = await evaluate(`(() => {
    const img = document.querySelector('#creacion-cara img.arte--ia');
    return {
      cicatriz: Boolean(document.querySelector('#creacion-cara .retrato-rasgo--cicatriz')),
      imagenIA: Boolean(img && img.complete && img.naturalWidth > 0),
      botones: [...document.querySelectorAll('#creacion-pie button')].map(b => b.id),
    };
  })()`);
  if (!retrato.cicatriz && !retrato.imagenIA) throw new Error('la descripción libre no llegó al retrato');

  // «Elfa» en la descripción y un linaje cualquiera en la ficha: la revelación
  // tiene que decirlo, y volver a la ficha no puede crear un gemelo.
  const aviso = await evaluate(`document.querySelector('#revelacion-especie')?.textContent ?? ''`);
  if (!/«elfa»/.test(aviso)) throw new Error(`la revelación no avisa de la especie escrita: «${aviso}»`);

  const contarPjs = `JSON.parse(localStorage.getItem('arcanveil:personajes') ?? '[]').length`;
  const pjsAntes = await evaluate(contarPjs);

  await evaluate(`document.querySelector('#revelacion-cambiar-linaje').click()`);
  await until('document.querySelector("#creacion-crear") && document.querySelector("#retrato-descripcion")');
  const conservado = await evaluate(`document.querySelector('#retrato-descripcion').value`);
  if (!conservado.startsWith('elfa exploradora')) throw new Error(`volver a la ficha perdió la descripción: «${conservado}»`);

  await evaluate(`document.querySelector('#creacion-aleatorio').click()`);
  const nombreTrasTirar = await evaluate(`document.querySelector('#nombre').value`);
  if (nombreTrasTirar !== 'Lyra') throw new Error(`volver a tirar borró el nombre escrito: «${nombreTrasTirar}»`);

  await evaluate(`document.querySelector('#creacion-crear').click()`);
  await until('document.querySelector("#creacion-empezar") && document.querySelector("#creacion-cara .arte")');

  const pjsDespues = await evaluate(contarPjs);
  if (pjsDespues !== pjsAntes) throw new Error(`cambiar de linaje creó un personaje gemelo: ${pjsAntes} → ${pjsDespues}`);
  // La forja visual dura 720 ms; la captura valida el estado final nítido.
  await new Promise(resolve => setTimeout(resolve, 850));
  await shot(`02-creacion-${viewport.label}.png`);
  await evaluate(`document.querySelector('#creacion-empezar').click()`);
  await until('document.body.dataset.activeScreen === "juego" && !document.querySelector("#entrada").disabled && ARCANVEIL.sistema("turns").inspeccionar().ocupado === false && ARCANVEIL.ver("narrative.entradas",[]).length > 0 && ARCANVEIL.ver("player.lore","").includes("hermana")', 15000);
  const aperturaLore = await evaluate(`({texto:ARCANVEIL.ver('narrative.entradas',[]).map(e=>e.texto??'').join(' '), memoria:ARCANVEIL.ver('ai.memoria.hilos',[])})`);
  if (!/hermana|medallón|Umbral/i.test(aperturaLore.texto)) throw new Error('la apertura procedural ignoró el lore');
  if (!aperturaLore.memoria.some(h => h.relacionadoCon === 'player_lore')) throw new Error('el lore no abrió un hilo persistente');
  if (!aperturaLore.memoria.some(h => h.tipo === 'relacion')) throw new Error('el lore no reconoció el hilo familiar');

  const acciones = [
    'miro alrededor','escucho tras la puerta','exploro con cuidado','examino las huellas',
    'pregunto por rumores','busco un camino seguro','registro el lugar','observo el cielo',
    'recuerdo viejas historias','compruebo mi equipo','avanzo en silencio','busco agua',
    'inspecciono las piedras','dejo una marca en el camino','vigilo los tejados','sigo las luces',
    'investigo el ruido','anoto lo descubierto','descanso un momento','decido el siguiente paso',
  ];
  const turns = [];
  for (const a of acciones) {
    const result = await evaluate(`ARCANVEIL.jugar(${JSON.stringify(a)}).then(()=>({disabled:document.querySelector('#entrada').disabled, lines:ARCANVEIL.ver('narrative.entradas',[]).length, failures:document.querySelectorAll('#fallos .fallos__linea').length}))`);
    turns.push(result);
    if (result.disabled || result.failures) throw new Error(`turno fallido: ${a}`);
  }
  if (turns.at(-1).lines < 20) throw new Error(`la bitácora no avanzó: ${turns.at(-1).lines}`);
  await shot(`03-partida-20-turnos-${viewport.label}.png`);

  // El retrato vale por cualquiera de sus dos vías.
  //
  // Esto buscaba `.retrato-rasgo--cicatriz`, que solo existe en el retrato
  // vectorial. Con el retrato de IA cargado ese nodo no está —la imagen
  // sustituye al SVG entero— y la prueba fallaba con «el rasgo visual no llegó
  // a la partida» teniendo el retrato delante. El juego no estaba roto: la
  // prueba se había quedado atrás.
  //
  // Lo que importa es que la cara del personaje esté puesta, por la vía que
  // sea. Se aceptan las dos y el informe dice cuál fue.
  const libre = await evaluate(`(() => {
    const img = document.querySelector('#retrato-pj img.arte--ia');
    return {
      texto: ARCANVEIL.ver('narrative.entradas', []).map(e => e.texto ?? '').join(' '),
      retratoIA: Boolean(img && img.complete && img.naturalWidth > 0),
      retratoVector: Boolean(document.querySelector('#retrato-pj .retrato-rasgo--cicatriz')),
    };
  })()`);

  if (/intentas\s+anoto/i.test(libre.texto)) throw new Error('acción libre mal integrada');
  if (!libre.retratoIA && !libre.retratoVector) {
    throw new Error('el retrato no llegó a la partida (ni imagen de IA ni rasgo vectorial)');
  }

  // ─── Caer detiene la partida de verdad ──────────────────────────────
  //
  // El fallo que esto sujeta: la caída pintaba «la crónica termina aquí» y la
  // crónica seguía. La fase volvía a `exploracion`, la caja quedaba activa y
  // cada «ataco» abría un combate nuevo con el personaje a cero de vida.
  //
  // Se golpea hasta tres veces: algunos linajes y oficios tienen un rasgo que
  // salva de la primera caída y deja al personaje a 1 de vida. Es un rasgo de
  // juego, no un fallo; lo que se comprueba es que, gastado el salvavidas,
  // caer sí termina la partida. Con un solo golpe la prueba dependía de lo
  // que hubiera salido en el dado de la ficha.
  for (let golpe = 0; golpe < 3; golpe += 1) {
    await evaluate(`ARCANVEIL.store.dispatch('player/danar', { cantidad: 999, origen: 'regresion' })`);
    await wait(300);
    if (await evaluate(`ARCANVEIL.store.select('meta.fase')`) === 'fin') break;
  }
  await wait(600);

  const caida = await evaluate(`({
    fase: ARCANVEIL.store.select('meta.fase'),
    modal: !document.getElementById('caida-modal').hidden,
    entrada: document.getElementById('entrada').disabled,
    salidas: [...document.querySelectorAll('#caida-acciones button')].length,
  })`);

  if (caida.fase !== 'fin') throw new Error(`al caer, la fase quedó en ${caida.fase}`);
  if (!caida.modal) throw new Error('al caer no se abrió la salida');
  if (!caida.entrada) throw new Error('al caer, la caja de texto siguió activa');
  if (caida.salidas < 2) throw new Error(`al caer solo había ${caida.salidas} salidas`);

  // Y el turno tiene que estar cerrado: nada de abrir combates desde el suelo.
  const desdeElSuelo = await evaluate(`ARCANVEIL.jugar('ataco al primer bandido que vea').then(() => ({
    combate: ARCANVEIL.store.select('combat.activo'),
    fase: ARCANVEIL.store.select('meta.fase'),
  }))`);
  if (desdeElSuelo.combate) throw new Error('caído, «ataco» abrió un combate');

  await evaluate(`[...document.querySelectorAll('#caida-acciones button')].find(b => /volver/i.test(b.textContent))?.click()`);
  await wait(1200);

  const revivido = await evaluate(`({
    fase: ARCANVEIL.store.select('meta.fase'),
    vida: ARCANVEIL.store.select('player.vida.actual'),
    entrada: document.getElementById('entrada').disabled,
  })`);

  if (revivido.fase !== 'exploracion' || revivido.vida !== 1 || revivido.entrada) {
    throw new Error(`«Volver en ti» dejó ${JSON.stringify(revivido)}`);
  }

  const beforeOffline = await evaluate(`navigator.serviceWorker.ready.then(()=>({controlled:Boolean(navigator.serviceWorker.controller),lines:ARCANVEIL.ver('narrative.entradas',[]).length}))`);
  await wait(700);
  await cdp('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await cdp('Page.reload', { ignoreCache: false });
  await until('window.ARCANVEIL?.motor?.listo && document.body.classList.contains("esta-listo")', 15000);
  const offline = await evaluate(`({screen:document.body.dataset.activeScreen, title:document.title, failures:document.querySelectorAll('#fallos .fallos__linea').length})`);
  await shot(`04-offline-${viewport.label}.png`);
  if (offline.title !== 'ARCANVEIL' || offline.failures) throw new Error(`offline invÃ¡lido ${JSON.stringify(offline)}`);

  const report = {
    viewport: viewport.label, systems: boot.systems, turns: turns.length,
    maxLogLines: Math.max(...turns.map(t => t.lines)),
    exceptions: exceptions.length, serviceWorkerControlled: beforeOffline.controlled,
    offlineScreen: offline.screen, failures: offline.failures,
    retrato: libre.retratoIA ? 'ia' : 'vectorial',
    sinIA,
  };
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  console.error(e.stack || e);
  if (serverErr) console.error('server:', serverErr.slice(-1000));
  if (chromeErr) console.error('chrome:', chromeErr.slice(-1000));
  process.exitCode = 1;
} finally {
  if (ws?.readyState === WebSocket.OPEN) ws.close();
  await stop();
}