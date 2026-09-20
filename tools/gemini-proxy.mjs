#!/usr/bin/env node
import { createServer } from 'node:http';

const clave = process.env.GEMINI_API_KEY?.trim();
const puerto = Number(process.env.GEMINI_PROXY_PORT) || 11435;
const hostApp = process.env.ROLLAPP_ORIGIN?.trim() || 'http://localhost:8080';
if (!clave) {
  console.error('Falta GEMINI_API_KEY. Define la variable antes de arrancar.');
  process.exit(1);
}

const cabeceras = {
  'Access-Control-Allow-Origin': hostApp,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};
const responder = (res, estado, cuerpo) => { res.writeHead(estado, cabeceras); res.end(JSON.stringify(cuerpo)); };
const leer = req => new Promise((ok, no) => { let texto=''; req.on('data', b => { texto += b; if (texto.length > 2_000_000) no(new Error('petición demasiado grande')); }); req.on('end', () => { try { ok(JSON.parse(texto || '{}')); } catch (e) { no(e); } }); req.on('error', no); });

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return responder(res, 204, {});
  if (req.method === 'GET' && req.url === '/v1/models') {
    return responder(res, 200, { object: 'list', data: [{ id: 'gemini-3.5-flash', object: 'model' }, { id: 'gemini-3.5-flash-lite', object: 'model' }] });
  }
  if (req.method !== 'POST' || req.url !== '/v1/chat/completions') return responder(res, 404, { error: { message: 'ruta no encontrada' } });
  try {
    const entrada = await leer(req);
    const modelo = String(entrada.model || 'gemini-3.5-flash');
    const sistema = entrada.messages?.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
    const contents = (entrada.messages ?? []).filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content ?? '') }] }));
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`;
    const respuesta = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave }, body: JSON.stringify({ systemInstruction: sistema ? { parts: [{ text: sistema }] } : undefined, contents, generationConfig: { temperature: entrada.temperature ?? .8, maxOutputTokens: entrada.max_tokens ?? 1600, responseMimeType: 'application/json' } }) });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) return responder(res, respuesta.status, { error: { message: datos?.error?.message ?? 'Gemini rechazó la petición' } });
    const texto = datos?.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
    return responder(res, 200, { id: `gemini-${Date.now()}`, object: 'chat.completion', model: modelo, choices: [{ index: 0, message: { role: 'assistant', content: texto }, finish_reason: 'stop' }] });
  } catch (e) { return responder(res, 500, { error: { message: e.message } }); }
}).listen(puerto, '127.0.0.1', () => {
  console.log(`Proxy seguro de Gemini: http://127.0.0.1:${puerto}`);
  console.log('La clave solo vive en este proceso y nunca llega al navegador.');
});
