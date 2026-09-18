/**
 * Busca claves de configuración que el código usa y los ficheros de config no
 * definen. Un `undefined` en una constante no lanza: se propaga como NaN y
 * rompe algo mucho más lejos.
 */
import { readdirSync, statSync, readFileSync } from 'fs';
import { join, relative } from 'path';

const cfgs = {};
for (const [nombre, ruta] of [
  ['APP', 'src/config/app.config.js'], ['LIMITES', 'src/config/app.config.js'],
  ['TIEMPOS', 'src/config/app.config.js'], ['PERSISTENCIA', 'src/config/app.config.js'],
  ['DEPURACION', 'src/config/app.config.js'], ['ENTORNO', 'src/config/app.config.js'],
  ['COMBATE', 'src/config/balance.config.js'], ['TIRADAS', 'src/config/balance.config.js'],
  ['ECONOMIA', 'src/config/balance.config.js'], ['SOCIAL', 'src/config/balance.config.js'],
  ['PROGRESION', 'src/config/balance.config.js'], ['DIRECCION', 'src/config/balance.config.js'],
  ['SUPERVIVENCIA', 'src/config/balance.config.js'], ['COTAS_IA', 'src/config/balance.config.js'],
  ['DIRECTOR', 'src/config/ai.config.js'], ['MUESTREO', 'src/config/ai.config.js'],
  ['RED', 'src/config/ai.config.js'], ['CREDENCIALES', 'src/config/ai.config.js'],
  ['TEXTOS', 'src/config/ui.config.js'], ['MONTAJES', 'src/config/ui.config.js'],
  ['SELECTORES', 'src/config/ui.config.js'], ['PANTALLAS', 'src/config/ui.config.js'],
  ['VOCES', 'src/config/ui.config.js'],
]) {
  try {
    const m = await import('./' + relative('tools', ruta).replace(/\\/g, '/').replace('../', '../'));
    if (m[nombre]) cfgs[nombre] = m[nombre];
  } catch {}
}

function walk(d, o = []) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    statSync(p).isDirectory() ? walk(p, o) : e.endsWith('.js') && o.push(p);
  }
  return o;
}

const problemas = [];

for (const archivo of walk('src')) {
  const fuente = readFileSync(archivo, 'utf8');

  for (const [nombre, objeto] of Object.entries(cfgs)) {
    // El lookbehind evita que EVENTOS_COMBATE.X cuente como COMBATE.X
    const patron = new RegExp('(?<![\\w$])' + nombre + '\\.([a-zA-Z_$][\\w$]*)', 'g');

    for (const m of fuente.matchAll(patron)) {
      if (objeto[m[1]] === undefined) {
        problemas.push({ archivo, uso: nombre + '.' + m[1] });
      }
    }
  }
}

const vistos = new Set();
const unicos = problemas.filter((p) => {
  const k = p.uso + p.archivo;
  if (vistos.has(k)) return false;
  vistos.add(k);
  return true;
});

if (!unicos.length) {
  console.log('Sin claves de configuración ausentes.');
} else {
  console.log(unicos.length + ' usos de claves inexistentes:\n');
  for (const p of unicos) console.log('  ' + p.uso.padEnd(34) + p.archivo);
}
