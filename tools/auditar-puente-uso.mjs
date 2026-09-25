/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · tools/auditar-puente-uso.mjs
 * ---------------------------------------------------------------------------
 * La cuenta del puente de Groq no se deja engañar.
 *
 * Contra un Groq falso en 127.0.0.1: peticiones simultáneas, reinicio con el
 * mismo fichero, fichero dañado o que no se puede escribir, timeout con
 * resultado incierto, caída de red, caché que falla, respuesta sin «usage»,
 * 429 sin Retry-After o con uno ilegible, y rechazos 4xx.
 *
 *   node tools/auditar-puente-uso.mjs
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createServer, request } from 'node:http';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearProxyGroq, MODELO_PERMITIDO } from './groq-proxy.mjs';

let fallos = 0;
let casos = 0;
function comprobar(bien, texto, detalle = '') {
  casos += 1;
  if (bien) console.log(`OK   ${texto}`);
  else {
    fallos += 1;
    console.log(`MAL  ${texto}`);
    if (detalle) console.log(`     ${String(detalle).slice(0, 500)}`);
  }
}

const CLAVE = `gsk_prueba_${'y'.repeat(40)}`;
const ORIGEN = 'http://localhost:8080';
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const carpeta = mkdtempSync(join(tmpdir(), 'arcanveil-uso-'));

/* ─── Un Groq falso, programable ─────────────────────────────────────────── */
let llamadas = 0;
let comportamiento = () => ({ estado: 200 });
const falso = createServer((req, res) => {
  let cuerpo = '';
  req.on('data', (b) => { cuerpo += b; });
  req.on('end', async () => {
    llamadas += 1;
    const c = comportamiento(JSON.parse(cuerpo || '{}'));
    if (c.colgar) return;                      // nunca contesta
    if (c.retraso) await dormir(c.retraso);
    const cab = { 'Content-Type': 'application/json', ...(c.retry !== undefined ? { 'retry-after': String(c.retry) } : {}) };
    res.writeHead(c.estado, cab);
    if (c.estado !== 200) return res.end(JSON.stringify({ error: { message: 'x', code: 'rate_limit_exceeded' } }));
    const usage = c.sinUsage ? undefined : { prompt_tokens: 1000, completion_tokens: 100, total_tokens: 1100, prompt_tokens_details: { cached_tokens: c.cacheados ?? 0 } };
    return res.end(JSON.stringify({ choices: [{ message: { content: '{"story":"Bien."}' } }], ...(usage ? { usage } : {}) }));
  });
});
await new Promise((r) => falso.listen(0, '127.0.0.1', r));
const UPSTREAM = `http://127.0.0.1:${falso.address().port}`;

/** Un puente con sus límites y su fichero. */
async function puente(op = {}) {
  const p = crearProxyGroq({ clave: CLAVE, puerto: 0, origen: ORIGEN, upstream: UPSTREAM, rutaUso: null, ...op });
  const puerto = await p.escuchar();
  const pedir = (turno, texto = 'hola', extra = {}) => new Promise((ok, no) => {
    const cuerpo = JSON.stringify({ model: MODELO_PERMITIDO, messages: [{ role: 'system', content: 'política '.repeat(200) }, { role: 'user', content: texto }], max_tokens: 500, ...extra });
    const req = request({ host: '127.0.0.1', port: puerto, path: '/v1/chat/completions', method: 'POST', headers: {
      Host: `127.0.0.1:${puerto}`, Origin: ORIGEN, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(cuerpo), ...(turno ? { 'X-Arcanveil-Turno': turno } : {}),
    } }, (res) => { let t = ''; res.on('data', (b) => { t += b; }); res.on('end', () => ok({ estado: res.statusCode, cab: res.headers, json: JSON.parse(t || '{}') })); });
    req.on('error', no);
    req.write(cuerpo);
    req.end();
  });
  return { p, pedir };
}

/* ─── 1. Simultáneas ──────────────────────────────────────────────────────── */
console.log('\n── Peticiones simultáneas ──');
{
  comportamiento = () => ({ estado: 200, retraso: 200 });
  llamadas = 0;
  const { p, pedir } = await puente({ limites: { porMinuto: 3 } });
  const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => pedir(`s-${i}`, `turno ${i}`)));
  comprobar(llamadas === 3 && rs.filter((r) => r.estado === 200).length === 3 && rs.filter((r) => r.estado === 429).length === 7,
    'diez a la vez con tope de tres por minuto: exactamente tres llegan a Groq', `${llamadas} llamadas; ${rs.map((r) => r.estado).join(',')}`);
  await p.cerrar();

  llamadas = 0;
  // Cada petición reserva ~1.020 tokens (política + turno + salida máxima).
  const { p: p2, pedir: pedir2 } = await puente({ limites: { tokensMinuto: 2100 } });
  const rs2 = await Promise.all(Array.from({ length: 6 }, (_, i) => pedir2(`k-${i}`, `turno ${i}`)));
  comprobar(llamadas === 2, 'con el tope de tokens por minuto pasa lo mismo: la reserva es el peor caso y es inmediata', `${llamadas} llamadas; ${rs2.map((r) => r.estado).join(',')}`);
  await p2.cerrar();
}

/* ─── 2. Peor caso, caché y usage ─────────────────────────────────────────── */
console.log('\n── Reserva en el peor caso, ajuste con lo que dice Groq ──');
{
  const { p, pedir } = await puente();
  comportamiento = () => ({ estado: 200, cacheados: 0 });
  await pedir('c-1');
  const tras1 = p.estado().usoHoy.tokens;
  comprobar(tras1 === 1100, 'sin caché, cuenta lo que Groq dice (1100)', tras1);
  comportamiento = () => ({ estado: 200, cacheados: 800 });
  await pedir('c-2');
  comprobar(p.estado().usoHoy.tokens === tras1 + 300, 'con caché confirmada por Groq, solo lo no cacheado (300)', p.estado().usoHoy.tokens);
  comportamiento = () => ({ estado: 200, sinUsage: true });
  const antes = p.estado().usoHoy.tokens;
  await pedir('c-3');
  const reservado = p.estado().usoHoy.tokens - antes;
  comprobar(reservado > 600, `sin «usage» en la respuesta se queda la reserva entera (${reservado} tokens, el peor caso)`);
  await p.cerrar();
}

/* ─── 3. Reinicio ─────────────────────────────────────────────────────────── */
console.log('\n── Reinicio con el mismo fichero ──');
{
  const ruta = join(carpeta, 'reinicio.json');
  comportamiento = () => ({ estado: 200 });
  llamadas = 0;
  const a = await puente({ rutaUso: ruta, limites: { porMinuto: 2 } });
  await a.pedir('r-1');
  await a.pedir('r-2');
  await a.p.cerrar();
  const b = await puente({ rutaUso: ruta, limites: { porMinuto: 2 } });
  comprobar(b.p.estado().usoHoy.peticiones === 2 && b.p.estado().usoHoy.tokens === 2200, 'tras reiniciar, las cuentas del día siguen', JSON.stringify(b.p.estado().usoHoy));
  const r = await b.pedir('r-3');
  comprobar(r.estado === 429 && llamadas === 2, 'y el minuto también: reiniciar no abre la puerta a otra ráfaga', `${r.estado} · ${llamadas}`);
  await b.p.cerrar();
}

/* ─── 4. Fichero dañado o que no se puede escribir ───────────────────────── */
console.log('\n── Fichero dañado o sin escritura: falla cerrado ──');
{
  const dañado = join(carpeta, 'dañado.json');
  writeFileSync(dañado, '{ esto no es json');
  let lanzo = null;
  try { crearProxyGroq({ clave: CLAVE, puerto: 0, origen: ORIGEN, upstream: UPSTREAM, rutaUso: dañado }); } catch (e) { lanzo = e.message; }
  comprobar(/dañado/.test(lanzo ?? ''), 'con el fichero dañado el puente no arranca', lanzo);
  comprobar(readFileSync(dañado, 'utf8') === '{ esto no es json', 'y no lo pisa: lo que había se puede revisar');

  // Una carpeta donde debía haber un fichero: tampoco arranca.
  const carpetaComoFichero = join(carpeta, 'soy-carpeta');
  mkdirSync(carpetaComoFichero);
  lanzo = null;
  try { crearProxyGroq({ clave: CLAVE, puerto: 0, origen: ORIGEN, upstream: UPSTREAM, rutaUso: carpetaComoFichero }); } catch (e) { lanzo = e.message; }
  comprobar(Boolean(lanzo), 'si el fichero de uso no se puede leer, tampoco arranca', lanzo);

  // Una ruta imposible de escribir en marcha: su carpeta es un fichero.
  const padreFichero = join(carpeta, 'soy-fichero');
  writeFileSync(padreFichero, 'x');
  llamadas = 0;
  comportamiento = () => ({ estado: 200 });
  const { p, pedir } = await puente({ rutaUso: join(padreFichero, 'uso.json') });
  const r1 = await pedir('w-1');
  const r2 = await pedir('w-2');
  comprobar(r1.estado === 503 && r2.estado === 503 && llamadas === 0 && r1.json?.error?.code === 'uso_no_persistido',
    'si no puede guardar el uso, no llama a Groq (ni la primera vez ni después)', `${r1.estado},${r2.estado} · ${llamadas} llamadas`);
  comprobar(p.estado().persistencia?.ok === false, 'y el estado lo dice');
  await p.cerrar();
}

/* ─── 5. Timeout, red caída ───────────────────────────────────────────────── */
console.log('\n── Timeout con resultado incierto y red caída ──');
{
  comportamiento = () => ({ colgar: true });
  llamadas = 0;
  const { p, pedir } = await puente({ limites: { esperaUpstreamMs: 300 } });
  const r = await pedir('t-1', 'algo largo');
  const gastado = p.estado().usoHoy;
  comprobar(r.estado === 504 && r.json?.error?.code === 'resultado_incierto' && /pudo|procesarla|gastada/.test(r.json?.error?.message ?? ''),
    'un timeout se dice como incierto: Groq pudo procesarla', JSON.stringify(r.json));
  comprobar(gastado.peticiones === 1 && gastado.tokens > 0, 'y se cuenta como gastada, en el peor caso', JSON.stringify(gastado));
  const antes = llamadas;
  const r2 = await pedir('t-1', 'algo largo');
  comprobar(r2.estado === 409 && llamadas === antes, 'el mismo turno no se reenvía a ciegas', `${r2.estado} · ${llamadas - antes} llamadas nuevas`);
  await p.cerrar();

  // Un puerto sin nadie: la petición no llega.
  const vacio = createServer();
  await new Promise((ok) => vacio.listen(0, '127.0.0.1', ok));
  const puertoVacio = vacio.address().port;
  await new Promise((ok) => vacio.close(ok));
  const q = crearProxyGroq({ clave: CLAVE, puerto: 0, origen: ORIGEN, upstream: `http://127.0.0.1:${puertoVacio}`, rutaUso: null });
  const pq = await q.escuchar();
  const rq = await new Promise((ok) => {
    const cuerpo = JSON.stringify({ model: MODELO_PERMITIDO, messages: [{ role: 'system', content: 'p' }, { role: 'user', content: 'u' }] });
    const req = request({ host: '127.0.0.1', port: pq, path: '/v1/chat/completions', method: 'POST', headers: { Host: `127.0.0.1:${pq}`, Origin: ORIGEN, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(cuerpo) } }, (res) => { let t = ''; res.on('data', (b) => { t += b; }); res.on('end', () => ok({ estado: res.statusCode, json: JSON.parse(t) })); });
    req.write(cuerpo);
    req.end();
  });
  comprobar(rq.estado === 502 && rq.json?.error?.code !== 'resultado_incierto' && q.estado().usoHoy.peticiones === 0 && q.estado().usoHoy.tokens === 0,
    'con la red caída (no llega a Groq) no se cuenta nada', `${rq.estado} · ${JSON.stringify(q.estado().usoHoy)}`);
  await q.cerrar();
}

/* ─── 6. 429 sin Retry-After, ilegible; 4xx ──────────────────────────────── */
console.log('\n── 429 sin Retry-After o ilegible, y rechazos 4xx ──');
{
  llamadas = 0;
  comportamiento = () => ({ estado: 429 });
  const { p, pedir } = await puente();
  const r = await pedir('q-1');
  comprobar(r.estado === 429 && r.cab['retry-after'] === '60', 'un 429 sin Retry-After pide 60 s, no un reintento apresurado', JSON.stringify(r.cab));
  const antes = llamadas;
  await pedir('q-2');
  comprobar(llamadas === antes, 'y mientras tanto nadie llama a Groq');
  await p.cerrar();

  comportamiento = () => ({ estado: 429, retry: 'mañana' });
  const b = await puente();
  const rb = await b.pedir('q-3');
  comprobar(rb.cab['retry-after'] === '60', 'un Retry-After ilegible también es 60 s', JSON.stringify(rb.cab));
  await b.p.cerrar();

  comportamiento = () => ({ estado: 400 });
  const c = await puente();
  await c.pedir('q-4');
  comprobar(c.p.estado().usoHoy.peticiones === 1 && c.p.estado().usoHoy.tokens === 0, 'un 400 cuenta como petición pero no como tokens (se rechazó antes de generar)', JSON.stringify(c.p.estado().usoHoy));
  await c.p.cerrar();
}

falso.close();
console.log(`\n${casos - fallos}/${casos} comprobaciones`);
console.log(fallos ? `\n${fallos} fallos.` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
