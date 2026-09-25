/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · tools/revision-manual.mjs
 * ---------------------------------------------------------------------------
 * Partidas completas para LEERLAS, no para contarlas.
 *
 * Seis guiones escritos aparte de los tests (otros personajes, otras
 * semillas, otras maneras de jugar), de más de veinte turnos cada uno. Deja
 * una transcripción por partida con quién narró cada turno y, si narró una
 * IA, qué se quitó o se rechazó. Cada modo en su carpeta, sin mezclar:
 *
 *   node tools/revision-manual.mjs --modo procedural --salida carpeta/
 *   node tools/revision-manual.mjs --modo simulada   --salida carpeta/
 *   node tools/revision-manual.mjs --modo groq --partida 3 --pausa-ms 25000 --salida carpeta/
 *
 * «simulada» es el modelo falso y malintencionado de narrador-simulado.mjs:
 * su prosa es de plantilla, sirve para ver el filtro, no para juzgar voz.
 * «groq» exige el puente arrancado y gasta cuota: una o dos partidas al día.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { crearMotor } from './motor-sin-ventana.mjs';
import { modeloAdversario, conectar } from './narrador-simulado.mjs';

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const modo = arg('--modo') ?? 'procedural';
const salida = arg('--salida') ?? `revision-${modo}`;
const soloPartida = Number(arg('--partida')) || null;
const pausaMs = Number(arg('--pausa-ms')) || 0;

/** Personajes y maneras de jugar que no aparecen en los tests. */
const PARTIDAS = [
  {
    titulo: 'Maelis, curandera, conversadora', semilla: 9101,
    ficha: { nombre: 'Maelis', raza: 'valdes', clase: 'rastreador', trasfondo: 'errante', genero: 'f', lore: 'Aprendí a curar con mi abuela en un pueblo que ya no existe. Busco a quien quemó sus libros.' },
    turnos: [
      'saludo a la gente que tengo más cerca y me presento',
      'le pregunto a {pnj} cómo se llama este sitio y quién vive aquí',
      'le pregunto a {pnj} si hay alguien enfermo por aquí',
      'le cuento a {pnj} que sé curar fiebres con cortezas',
      '¿{pnj}, has oído hablar de un incendio de libros?',
      'miro lo que está pasando con {cosa}',
      'le pregunto a {actor} si necesita ayuda',
      'le ofrezco a {actor} un poco de mi agua',
      'le pregunto a {pnj} dónde se puede dormir esta noche',
      'le pregunto a {pnj} por {vecino}',
      'le vuelvo a preguntar a {pnj} por {vecino}, pero cómo se llega',
      'me siento a escuchar lo que se habla',
      'le digo a {pnj}: «Gracias, me has ayudado más de lo que crees»',
      'le pregunto al alcalde si me deja curar a los enfermos',
      'busco un sitio tranquilo para ordenar mis hierbas',
      'reviso mis hierbas y cuento lo que me queda',
      'le pregunto a {pnj} si alguien vende corteza de sauce',
      'canon: mi abuela se llamaba Oria y murió en el incendio',
      'le hablo a {pnj} de mi abuela Oria',
      'miro alrededor por si alguien me observa',
      'me despido de {pnj} y le digo que volveré',
      'le pregunto a {actor} qué tal sigue',
    ],
  },
  {
    titulo: 'Korr, mercenario, provocador', semilla: 9202,
    ficha: { nombre: 'Korr', raza: 'ferrano', clase: 'vinculado', trasfondo: 'soldado', genero: 'm', lore: 'Serví diez años en una compañía libre. Me echaron por negarme a quemar una aldea.' },
    turnos: [
      'escupo al suelo y miro a todos con cara de pocos amigos',
      'le pregunto a {pnj} quién manda aquí, sin rodeos',
      'le digo a {pnj} que busco trabajo de espada',
      'le exijo a {pnj} que me diga quién paga bien',
      'me río de {actor} y de lo que le pasa',
      'le digo a {actor}: «Apártate, que me estorbas»',
      'le pregunto al capitán de la guardia si necesita hombres',
      'le pego una patada a un barril',
      'le pregunto a {pnj} si alguien ha visto mercenarios por el camino',
      'no voy a pagar a nadie por nada',
      'le digo a {pnj}: «Si me engañas, lo pagarás caro»',
      'afilo el hacha a la vista de todos',
      'si alguien me busca pelea, se la doy; de momento bebo',
      'le pregunto a {pnj} por {vecino} y si hay trabajo allí',
      'intento levantar la estatua del pueblo con las manos',
      'me acerco a {cosa} a ver qué pasa',
      'ayudo a {actor} de mala gana',
      'le pido a {actor} que me pague por la ayuda',
      'canon: la compañía libre se llamaba los Cuervos Rojos',
      'le pregunto a {pnj} si conoce a los Cuervos Rojos',
      'miro quién me está mirando',
      'me largo hacia la salida del pueblo',
    ],
  },
  {
    titulo: 'Sive, exploradora, cautelosa', semilla: 9303,
    ficha: { nombre: 'Sive', raza: 'valdes', clase: 'rastreador', trasfondo: 'errante', genero: 'f', lore: 'Dibujo mapas. El último que hice me lo robaron junto con mi caballo.' },
    turnos: [
      'me quedo a la sombra y observo sin llamar la atención',
      'cuento cuánta gente hay y qué hace cada uno',
      'examino las huellas del suelo',
      'miro por dónde se entra y se sale de aquí',
      'escucho sin que se note',
      'examino el caballo atado junto al abrevadero',
      'le pregunto en voz baja a {pnj} si ha visto un caballo gris con alforjas',
      'dibujo un croquis del sitio en mi cuaderno',
      'examino {cosa} desde lejos',
      'me acerco despacio a {cosa}',
      'le pregunto a {actor} qué ha pasado aquí',
      'le pregunto a {pnj} si alguien compra mapas',
      'miro el río',
      'vuelvo a mirar el río',
      'le pregunto a {pnj} por el camino a {vecino}',
      'apunto en el cuaderno lo que me ha dicho {pnj}',
      'busco un sitio alto desde donde se vea el camino',
      'si alguien me sigue, me escondo; mientras, sigo dibujando',
      'le pregunto a {pnj} si ha visto a alguien vender un mapa',
      'le pregunto al ladrón de caballos dónde está mi mapa',
      'recojo mis cosas con calma',
      'miro alrededor una última vez',
    ],
  },
  {
    titulo: 'Tobi, buhonero, negociador', semilla: 9404,
    ficha: { nombre: 'Tobi', raza: 'menudo', clase: 'sombra', trasfondo: 'criminal', genero: 'm', lore: 'Vendo baratijas de pueblo en pueblo. Debo un favor a una mujer peligrosa.' },
    turnos: [
      'saludo con una reverencia exagerada',
      'le pregunto a {pnj} qué se compra y qué se vende por aquí',
      'le ofrezco a {pnj} un peine de hueso a buen precio',
      'regateo con {pnj} el precio del peine',
      'le pregunto a {pnj} si alguien necesita un recado',
      'miro con disimulo qué llevan en las bolsas',
      'le propongo a {actor} un trato para solucionar lo suyo',
      'le digo a {actor}: «No te cobraré nada, hoy me siento generoso»',
      'le pregunto a {pnj} quién es el más rico del pueblo',
      'no le doy el peine a nadie hasta que me paguen',
      'cuento las monedas que llevo',
      'le pregunto a {pnj} si ha pasado por aquí una mujer con un anillo de serpiente',
      'le cuento a {pnj} una historia inventada sobre mis viajes',
      'le pregunto a {pnj} por {vecino}',
      'le pregunto al tabernero si me deja montar un puesto',
      'me acerco a {cosa}',
      'intento venderle algo a {actor}',
      'le digo a {pnj} que vuelvo mañana con mercancía nueva',
      'canon: la mujer peligrosa se llama Varenne',
      'le pregunto a {pnj} si conoce a Varenne',
      'miro si alguien me ha seguido',
      'me voy silbando',
    ],
  },
  {
    titulo: 'Ilde, sacerdotisa, contemplativa', semilla: 9505,
    ficha: { nombre: 'Ilde', raza: 'valdes', clase: 'rastreador', trasfondo: 'errante', genero: 'f', lore: 'Dejé el templo después de un sueño. En el sueño había un puente y una campana.' },
    turnos: [
      'me detengo y respiro hondo',
      'miro el cielo',
      'escucho si suena alguna campana',
      'miro el puente con atención',
      'le pregunto a {pnj} si hay un templo cerca',
      'le pregunto a {pnj} si ha soñado alguna vez con una campana',
      'rezo en silencio un momento',
      'miro lo que le pasa a {actor}',
      'le pregunto a {actor} si puedo hacer algo por él',
      'me siento junto a {cosa}',
      'le pregunto a {pnj} por las fiestas del lugar',
      'miro el agua pasar',
      'le pregunto a {pnj} quién es la persona más vieja del pueblo',
      'le pregunto a la anciana del pueblo por la campana',
      'escucho otra vez si suena la campana',
      'le pregunto a {pnj} por {vecino}',
      'me quedo quieta hasta que anochece',
      'si suena la campana, voy hacia ella; mientras, espero',
      'canon: la campana del sueño estaba rota por la mitad',
      'le hablo a {pnj} de la campana rota',
      'miro alrededor',
      'doy las gracias a {pnj} y sigo mi camino',
    ],
  },
  {
    titulo: 'Braen, cazador, impulsivo y combativo', semilla: 9606,
    ficha: { nombre: 'Braen', raza: 'ferrano', clase: 'vinculado', trasfondo: 'superviviente', genero: 'm', lore: 'Un lobo enorme mató a mi perro. Juré encontrarlo.' },
    turnos: [
      'le pregunto a {pnj} si han visto un lobo enorme por aquí',
      'examino el suelo buscando rastros de lobo',
      'salto sobre {cosa} para ver mejor',
      'le grito a {actor} que se aparte',
      '@patrulla',
      'le digo a la patrulla que no busco pelea',
      'ataco al que tenga más cerca',
      '@combate',
      'me curo las heridas como puedo',
      'le pregunto a {pnj} si hay un curandero',
      'le pregunto a {pnj} por {vecino}',
      'corro hacia el camino',
      'le pregunto a {pnj} si han desaparecido perros',
      'intento arrancar una puerta de un tirón',
      'le digo a {pnj}: «Si ves al lobo, avísame»',
      'miro alrededor',
      'afilo el cuchillo de desollar',
      'si aparece el lobo, lo sigo; mientras, espero',
      'canon: el lobo tiene una oreja partida',
      'le pregunto a {pnj} si ha visto un lobo con una oreja partida',
      'bebo agua del río',
      'me voy a buscar el rastro fuera del pueblo',
    ],
  },
];

const COSA = { carro_atascado: 'el carro', colgante_en_el_pozo: 'el pozo', encapuchado_vigila: 'el tejado', balanza_trucada: 'la balanza', cabra_escapada: 'la cabra', buhonero_herido: 'el fardo del buhonero', peaje_abusivo: 'la garita del peaje' };

let modelo = null;
let trazas = [];
mkdirSync(salida, { recursive: true });

for (const [i, p] of PARTIDAS.entries()) {
  if (soloPartida && i + 1 !== soloPartida) continue;
  const m = await crearMotor({ semilla: p.semilla });
  if (modo === 'simulada' && !modelo) { modelo = modeloAdversario(); trazas = await conectar(m, modelo); }
  if (modo === 'groq' && !modelo) {
    modelo = { groq: true };
    m.sistema('dungeonmaster').proveedor('groq').configurar({ url: 'http://127.0.0.1:11436' });
    trazas = await conectar(m, { fetch: (url, op = {}) => fetch(url, { ...op, headers: { ...(op.headers ?? {}), Origin: 'http://localhost:8080' } }) });
    if (!m.sistema('dungeonmaster').proveedor('groq').inspeccionar().verificado) throw new Error('El puente no contesta: arráncalo con node tools/iniciar-groq.mjs');
  }
  m.store.reiniciar();
  const desde = trazas.length;
  const apertura = await m.empezar(p.ficha);
  const sit = m.sistema('situations').aqui()[0] ?? null;
  const suyos = new Set(Object.values(sit?.actores ?? {}).map((a) => a.refId));
  const nombre = (id) => m.ver(`npcs.conocidos.porId.${id}.nombre`);
  const pnj = (m.ver('npcs.presentes', []) ?? []).find((id) => !suyos.has(id)) ?? m.ver('npcs.presentes', [])[0];
  const actor = Object.values(sit?.actores ?? {})[0]?.refId ?? pnj;
  const vecinoId = m.sistema('world')?.lugarActual?.()?.plantilla?.conexiones?.[0]?.hasta;
  const c = { pnj: nombre(pnj) ?? 'el herrero', actor: nombre(actor) ?? 'el herrero', cosa: COSA[sit?.refId] ?? 'la plaza', vecino: m.ver(`world.localizaciones.porId.${vecinoId}.nombre`) ?? 'el camino' };
  const rellenar = (t) => t.replace(/\{(\w+)\}/g, (_, k) => c[k] ?? k);

  const lineas = [`# ${p.titulo} · semilla ${p.semilla} · modo ${modo}`, '', `Comodines: ${JSON.stringify(c)}`, '', '### Apertura', '', ...apertura.split('\n'), ''];
  let n = 0;
  for (const plantilla of p.turnos) {
    if (plantilla === '@patrulla') { m.sistema('exploration')._presentar((await import('../src/world/EncounterTables.js')).obtenerEncuentro('patrulla_hostil')); lineas.push('> (llega una patrulla)', ''); continue; }
    if (plantilla === '@combate') {
      const antes = m.entradas().length;
      for (let k = 0; k < 4 && m.ver('combat.activo', false); k += 1) {
        for (let w = 0; w < 60 && m.ver('combat.activo', false) && !m.sistema('combat').esperandoJugador; w += 1) await new Promise((r) => setTimeout(r, 25));
        if (!m.ver('combat.activo', false)) break;
        await m.sistema('combat').jugadaLibre(k < 2 ? 'golpeo al que tengo delante' : 'huyo');
      }
      lineas.push('### (combate)', '', ...m.entradas().slice(antes).map((e) => e.texto).filter(Boolean), '');
      continue;
    }
    n += 1;
    const entrada = rellenar(plantilla);
    if (pausaMs) await new Promise((r) => setTimeout(r, pausaMs));
    const t0 = trazas.length;
    const texto = await m.jugar(entrada);
    const tr = trazas.slice(t0).at(-1);
    const quien = m.ver('meta.narrador')?.narra ?? 'procedural';
    lineas.push(`### Turno ${n} · narra: ${tr?.final ?? (modo === 'procedural' ? 'procedural' : `${quien} (sin modelo: resuelto por el motor)`)}`, '', `» ${entrada}`);
    lineas.push(...texto.split('\n').filter((l) => l && !l.startsWith('»')));
    if (tr) {
      if (tr.problemas?.length) lineas.push(`> filtro: ${tr.problemas.join(', ')} · reparado: ${tr.reparado}`);
      if (tr.rechazados?.length) lineas.push(`> rechazado: ${tr.rechazados.map((r) => `${r.tipo} (${r.motivo})`).join('; ')}`);
      if (tr.aplicado?.length) lineas.push(`> aplicado: ${tr.aplicado.join('; ')}`);
    }
    lineas.push('');
  }
  lineas.push(`---`, `Turnos: ${n} · peticiones a la IA en esta partida: ${trazas.length - desde}`);
  writeFileSync(join(salida, `${String(i + 1).padStart(2, '0')}-${p.ficha.nombre}.md`), lineas.join('\n'));
  console.log(`${p.titulo}: ${n} turnos`);
}
