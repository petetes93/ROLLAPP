#!/usr/bin/env node
/** Puente local ARCANVEIL -> ComfyUI. Sin nube, cuenta ni coste por imagen. */
import http from 'node:http';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const PORT = Number(process.env.ROLLAPP_IMAGE_PORT || 11436);
const COMFY = process.env.COMFY_URL || 'http://127.0.0.1:8188';
const CONFIG_PATH = join(process.cwd(), '.rollapp-image-config.json');
const CONFIG = existsSync(CONFIG_PATH) ? JSON.parse(await readFile(CONFIG_PATH, 'utf8')) : {};
const CHECKPOINT = process.env.ROLLAPP_IMAGE_MODEL || CONFIG.model || 'sd_xl_base_1.0.safetensors';
const WIDTH = Number(CONFIG.width || 768);
const HEIGHT = Number(CONFIG.height || 960);
const STEPS = Number(CONFIG.steps || 28);
const CFG = Number(CONFIG.cfg || 6.5);
const SAMPLER = CONFIG.sampler || 'dpmpp_2m';
const SCHEDULER = CONFIG.scheduler || 'karras';
const ARCH = CONFIG.architecture || 'sdxl';
const CACHE = join(process.cwd(), '.rollapp-images');
await mkdir(CACHE, { recursive: true });

const lineage = {
  albar: 'high elf, long pointed ears, moon-pale skin',
  brumal: 'fey elf, pale skin, windblown hair',
  ferrano: 'broad forge dwarf, angular face',
  menudo: 'small fantasy wanderer, sharp expressive face',
  griscuerno: 'horned dark-fantasy warrior',
  sombracorteza: 'forest folk, weathered mineral skin',
  crisol: 'arcane mineral-born adventurer',
  valdes: 'human dark-fantasy adventurer',
};
const style = 'close-up character portrait, modern Dungeons and Dragons concept art, dark fantasy digital painting, sharp believable facial anatomy, detailed skin, dramatic side light and cold rim light, desaturated palette, painterly hair masses, dark atmospheric background, cinematic, highly detailed, no frame, no text';
const negative = 'flat vector, cartoon, anime, cel shading, line art, pencil sketch, engraving, icon, low detail, plastic skin, symmetry, front flash, text, watermark, extra eyes, malformed face';

function graph(prompt, seed) {
  return {
    1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: CHECKPOINT } },
    2: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['1', 1] } },
    3: { class_type: 'CLIPTextEncode', inputs: { text: negative, clip: ['1', 1] } },
    4: { class_type: 'EmptyLatentImage', inputs: { width: WIDTH, height: HEIGHT, batch_size: 1 } },
    5: { class_type: 'KSampler', inputs: { seed, steps: STEPS, cfg: CFG, sampler_name: SAMPLER, scheduler: SCHEDULER, denoise: 1, model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0] } },
    6: { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    7: { class_type: 'SaveImage', inputs: { filename_prefix: 'ARCANVEIL/portrait', images: ['6', 0] } },
  };
}
function headers(type='application/json') {
  return { 'content-type': type, 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST,GET,OPTIONS', 'cache-control': 'no-store' };
}
async function json(url, init) {
  const r = await fetch(url, init); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json();
}
async function generate(body) {
  const key = createHash('sha256').update(JSON.stringify({ body, CHECKPOINT })).digest('hex');
  const cached = join(CACHE, `${key}.png`);
  if (existsSync(cached)) return readFile(cached);
  const words = String(body.description || '').slice(0, 600);
  const fluxStyle = ARCH === 'flux' ? ', photographically believable volume, intricate oil-brush texture' : '';
  const prompt = `${lineage[body.lineage] || lineage.valdes}, ${words}, ${style}${fluxStyle}`;
  const seed = parseInt(createHash('sha256').update(String(body.seed || words)).digest('hex').slice(0, 12), 16) % 2147483647;
  const queued = await json(`${COMFY}/prompt`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ prompt: graph(prompt, seed) }) });
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 900));
    const history = await json(`${COMFY}/history/${queued.prompt_id}`);
    const item = history[queued.prompt_id];
    const image = item?.outputs?.['7']?.images?.[0];
    if (!image) continue;
    const q = new URLSearchParams({ filename:image.filename, subfolder:image.subfolder || '', type:image.type || 'output' });
    const response = await fetch(`${COMFY}/view?${q}`); if (!response.ok) throw new Error('ComfyUI no devolvió la imagen');
    const bytes = Buffer.from(await response.arrayBuffer()); await writeFile(cached, bytes); return bytes;
  }
  throw new Error('Tiempo de generación agotado');
}
const server = http.createServer(async (req,res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, headers()); return res.end(); }
  if (req.method === 'GET' && req.url === '/health') {
    try { await json(`${COMFY}/system_stats`); res.writeHead(200,headers()); return res.end(JSON.stringify({ok:true,model:CHECKPOINT})); }
    catch (e) { res.writeHead(503,headers()); return res.end(JSON.stringify({ok:false,error:String(e.message)})); }
  }
  if (req.method !== 'POST' || req.url !== '/v1/portrait') { res.writeHead(404,headers()); return res.end('{}'); }
  try {
    let raw=''; for await (const chunk of req) { raw += chunk; if (raw.length > 20_000) throw new Error('Petición demasiado grande'); }
    const body=JSON.parse(raw); if (String(body.description||'').trim().length < 8) throw new Error('Falta descripción');
    const image=await generate(body); res.writeHead(200,headers('image/png')); res.end(image);
  } catch (e) { res.writeHead(502,headers()); res.end(JSON.stringify({error:String(e.message)})); }
});
server.listen(PORT,'127.0.0.1',()=>console.log(`ARCANVEIL imagen local: http://127.0.0.1:${PORT} -> ${COMFY} (${CHECKPOINT}, ${ARCH}, ${WIDTH}x${HEIGHT})`));
