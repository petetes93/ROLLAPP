#!/usr/bin/env node
/** RegresiÃ³n real de la PWA en Chrome, sin dependencias externas. */
import { spawn } from 'node:child_process';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();
const PORT = 8765;
const DEBUG = 9228;
const URL_APP = `http://127.0.0.1:${PORT}/app/index.html`;
const out = process.argv.includes('--capturas') ? resolve('dist/regresion') : null;
const desktop = process.argv.includes('--desktop');
const viewport = desktop ? { width: 1440, height: 900, label: '1440x900' } : { width: 390, height: 844, label: '390x844' };
const profile = await mkdtemp(join(tmpdir(), 'rollapp-chrome-'));
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
const chrome = launch('google-chrome', [
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
  await until('window.ARCANUM?.motor?.listo && document.body.classList.contains("esta-listo")');
  const boot = await evaluate(`({screen:document.body.dataset.activeScreen, systems:ARCANUM.inspeccionar().total, failures:document.querySelectorAll('#fallos').length})`);
  if (boot.screen !== 'inicio' || boot.failures) throw new Error(`arranque invÃ¡lido ${JSON.stringify(boot)}`);
  await shot(`01-inicio-${viewport.label}.png`);

  await evaluate(`document.querySelector('#inicio-acciones .btn--grande').click()`);
  await until('document.body.dataset.activeScreen === "creacion"');
  await evaluate(`(()=>{const fill=(q,v)=>{const n=document.querySelector(q);n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}))};fill('#nombre','Lyra');document.querySelector('[data-clave="raza"][data-valor="albar"]').click();fill('#retrato-descripcion','exploradora de pelo plateado y cicatriz en la ceja');fill('#lore-personaje','Mi hermana cruzó el Umbral con nuestro medallón. La busco desde entonces.');})()`);
  await until('document.querySelector("#creacion-cara .arte")');
  const retrato = await evaluate(`({cicatriz:Boolean(document.querySelector('#creacion-cara .retrato-rasgo--cicatriz')), loreVisible:document.querySelector('#lore-personaje').getBoundingClientRect().top < innerHeight})`);
  if (!retrato.cicatriz) throw new Error('la descripción libre no dibujó la cicatriz');
  if (viewport.label === '1440x900' && !retrato.loreVisible) throw new Error('el lore no es visible en la composición web');
  // La forja visual dura 720 ms; la captura valida el estado final nítido,
  // no un fotograma borroso de la transición procedural.
  await new Promise(resolve => setTimeout(resolve, 850));
  await shot(`02-creacion-${viewport.label}.png`);
  await evaluate(`document.querySelector('#creacion-empezar').click()`);
  await until('document.body.dataset.activeScreen === "juego" && !document.querySelector("#entrada").disabled && ARCANUM.sistema("turns").inspeccionar().ocupado === false && ARCANUM.ver("narrative.entradas",[]).length > 0 && ARCANUM.ver("player.lore","").includes("hermana")', 15000);

  const acciones = [
    'miro alrededor','escucho tras la puerta','exploro con cuidado','examino las huellas',
    'pregunto por rumores','busco un camino seguro','registro el lugar','observo el cielo',
    'recuerdo viejas historias','compruebo mi equipo','avanzo en silencio','busco agua',
    'inspecciono las piedras','dejo una marca en el camino','vigilo los tejados','sigo las luces',
    'investigo el ruido','anoto lo descubierto','descanso un momento','decido el siguiente paso',
  ];
  const turns = [];
  for (const a of acciones) {
    const result = await evaluate(`ARCANUM.jugar(${JSON.stringify(a)}).then(()=>({disabled:document.querySelector('#entrada').disabled, lines:ARCANUM.ver('narrative.entradas',[]).length, failures:document.querySelectorAll('#fallos .fallos__linea').length}))`);
    turns.push(result);
    if (result.disabled || result.failures) throw new Error(`turno fallido: ${a}`);
  }
  if (turns.at(-1).lines < 20) throw new Error(`la bitácora no avanzó: ${turns.at(-1).lines}`);
  await shot(`03-partida-20-turnos-${viewport.label}.png`);

  const libre = await evaluate(`({texto:ARCANUM.ver('narrative.entradas',[]).map(e=>e.texto??'').join(' '), retrato:Boolean(document.querySelector('#retrato-pj .retrato-rasgo--cicatriz'))})`);
  if (/intentas\s+anoto/i.test(libre.texto)) throw new Error('acción libre mal integrada');
  if (!libre.retrato) throw new Error('el rasgo visual no llegó a la partida');

  const beforeOffline = await evaluate(`navigator.serviceWorker.ready.then(()=>({controlled:Boolean(navigator.serviceWorker.controller),lines:ARCANUM.ver('narrative.entradas',[]).length}))`);
  await wait(700);
  await cdp('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await cdp('Page.reload', { ignoreCache: false });
  await until('window.ARCANUM?.motor?.listo && document.body.classList.contains("esta-listo")', 15000);
  const offline = await evaluate(`({screen:document.body.dataset.activeScreen, title:document.title, failures:document.querySelectorAll('#fallos .fallos__linea').length})`);
  await shot(`04-offline-${viewport.label}.png`);
  if (offline.title !== 'ARCANUM' || offline.failures) throw new Error(`offline invÃ¡lido ${JSON.stringify(offline)}`);

  const report = {
    viewport: viewport.label, systems: boot.systems, turns: turns.length,
    maxLogLines: Math.max(...turns.map(t => t.lines)),
    exceptions: exceptions.length, serviceWorkerControlled: beforeOffline.controlled,
    offlineScreen: offline.screen, failures: offline.failures,
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