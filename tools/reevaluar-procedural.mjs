/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · tools/reevaluar-procedural.mjs
 * ---------------------------------------------------------------------------
 * Reevaluación del narrador procedural con PARÁFRASIS y SEMILLAS NUEVAS.
 *
 * La revisión manual (`revision-manual.mjs`) destapó fallos concretos: una
 * pregunta con vocativo devuelta sin su cierre, ofrecer ayuda contestado
 * como pregunta, escuchar que describía el río, un ataque «al que tenga más
 * cerca» contra alguien sacado de las tablas… Arreglar esos guiones no
 * prueba nada: aquí cada fallo se reescribe de varias maneras y se juega en
 * doce semillas que no se habían usado, cada grupo en una partida limpia.
 *
 * Cada grupo tiene su comprobación (además de la de atención: tema y
 * destinatario, ver `atencion.mjs`). Las transcripciones salen completas
 * para leerlas; el marcador solo dice dónde mirar.
 *
 *   node tools/reevaluar-procedural.mjs [--salida carpeta] [--semillas 12]
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { crearMotor } from './motor-sin-ventana.mjs';
import { atiende } from './atencion.mjs';
import { obtenerEncuentro } from '../src/world/EncounterTables.js';

const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const salida = opcion('--salida', null);
const cuantas = Number(opcion('--semillas', 12));
const SEMILLAS = Array.from({ length: cuantas }, (_, i) => 9711 + i * 11);

const FICHAS = [
  { nombre: 'Aroa', raza: 'valdes', clase: 'rastreador', trasfondo: 'errante', genero: 'f', lore: 'Busco a quien quemó los libros de mi maestra.' },
  { nombre: 'Tirso', raza: 'ferrano', clase: 'vinculado', trasfondo: 'superviviente', genero: 'm', lore: 'Perdí a mi hermano en el paso del norte.' },
];

/** Líneas de la respuesta sin el eco de la acción. */
const cuerpo = (t) => String(t).split('\n').filter((l) => l && !l.startsWith('»')).slice(1).join('\n');

const GRUPOS = [
  {
    clave: 'pregunta_directa', titulo: 'Pregunta en estilo directo, con vocativo',
    frases: ['¿{a}, has oído hablar de un incendio de libros?', '{a}, ¿qué sabes de un incendio de libros?', 'Oye, {a}, ¿has visto a un hombre con capa roja?', '¡{a}! ¿Sabes algo de un incendio?'],
    // El eco conserva la pregunta entera («¿…?») y dice a quién va.
    comprobar: (e, t) => { const eco = t.split('\n').find((l) => l && !l.startsWith('»')) ?? ''; return [/«¿[^»]*\?»/.test(eco) && /a \p{Lu}/u.test(eco), eco]; },
    atencion: true,
  },
  {
    clave: 'ofrecer_ayuda', titulo: 'Ofrecer ayuda (no es preguntar un dato)',
    frases: ['le pregunto a {b} si necesita ayuda', '¿Te echo una mano, {b}?', 'le ofrezco mi ayuda a {b}', 'le pregunto a {b} si puedo hacer algo por él'],
    comprobar: (e, t) => [!/no s[eé] nada|pregunta a otro/i.test(t) && /«[^»]{4,}»/.test(cuerpo(t)), cuerpo(t)],
    atencion: true,
  },
  {
    clave: 'escuchar', titulo: 'Escuchar lo que se habla',
    frases: ['me siento a escuchar lo que se habla', 'presto atención a las conversaciones de alrededor', 'me quedo un rato oyendo lo que dice la gente', 'pego la oreja a lo que se cuenta'],
    // Lo que se oye es gente hablando, no el paisaje.
    comprobar: (e, t) => [/se comenta|conversaci|se habla|corrillo|precios|quejas|de lo que más|oyes|dicen/i.test(cuerpo(t)) && !/El río baja|piedras planas|el lecho/i.test(cuerpo(t)), cuerpo(t)],
  },
  {
    clave: 'cortesia', titulo: 'Gracias y despedidas',
    frases: ['le digo a {a}: «Gracias, me has ayudado mucho»', 'gracias, {a}', 'doy las gracias a {a} y me voy', 'me despido de {a}'],
    comprobar: (e, t, x) => [new RegExp(`${x.a}`).test(cuerpo(t)), cuerpo(t)],
  },
  {
    clave: 'regalo', titulo: 'Regalar algo (sin dados)',
    frases: ['le ofrezco a {b} un poco de mi agua', 'le doy a {b} un trozo de pan', 'le paso a {b} mi cantimplora', 'le ofrezco a {b} algo de comida'],
    comprobar: (e, t, x) => [!/No cuela|ceden|d20/i.test(t) && new RegExp(`${x.b}`).test(cuerpo(t)), cuerpo(t)],
  },
  {
    clave: 'servicio', titulo: 'Preguntar por un servicio del pueblo',
    frases: ['le pregunto a {a} si hay un curandero', '¿{a}, dónde puedo dormir esta noche?', 'le pregunto a {a} dónde se puede comer', 'le pregunto a {a} si hay herrero por aquí'],
    comprobar: (e, t) => [/«[^»]*(?:hay|templo|posada|fragua|mercado|Tres Clavos|aquí no|de aquí)[^»]*»/i.test(cuerpo(t)), cuerpo(t)],
    atencion: true,
  },
  {
    clave: 'ataque_indefinido', titulo: 'Atacar sin decir a quién, con gente delante',
    frases: ['ataco al que tenga más cerca', 'me lanzo contra el primero que vea', 'golpeo a cualquiera', 'ataco al más cercano'],
    // No se saca a nadie de las tablas: se dice quién hay y dónde.
    comprobar: (e, t, x, m) => [!m.ver('combat.activo', false) && /Si vas a por alguien, di a por quién/.test(t), t.split('\n').slice(1).join(' ')],
    aislado: true,
  },
  {
    clave: 'patrulla', titulo: 'Hablarle a la patrulla que corta el paso',
    antes: 'patrulla',
    frases: ['le digo a la patrulla que no busco pelea', 'les digo a los guardias que solo estoy de paso', 'les explico a los de la patrulla que voy al mercado'],
    // Contesta la patrulla (su desenlace), no la situación de al lado.
    comprobar: (e, t, x) => { const c = cuerpo(t); return [/patrulla|guardias|te dejan|cuela|tensan|ceden|seguir tu camino|registr/i.test(c) && !(x.actores ?? []).some((a) => new RegExp(`^${a}\\b`, 'm').test(c)), c]; },
    aislado: true,
  },
];

const resultados = new Map(GRUPOS.map((g) => [g.clave, { ok: 0, total: 0, atendidas: 0, conAtencion: 0, fallos: [] }]));
if (salida) mkdirSync(salida, { recursive: true });

for (const [k, semilla] of SEMILLAS.entries()) {
  const lineas = [`# Semilla ${semilla}`, ''];
  for (const g of GRUPOS) {
    lineas.push(`## ${g.titulo}`, '');
    for (const plantilla of g.frases) {
      // Cada frase en una partida limpia: lo que deja una no ayuda a la otra.
      const m = await crearMotor({ semilla });
      m.store.reiniciar();
      const apertura = await m.empezar(FICHAS[k % FICHAS.length]);
      const ids = m.ver('npcs.presentes', []) ?? [];
      const nombres = ids.map((id) => m.ver(`npcs.conocidos.porId.${id}.nombre`)).filter(Boolean);
      const actores = (m.sistema('situations').aqui()[0] ? Object.values(m.sistema('situations').aqui()[0].actores).map((a) => a.nombre) : []);
      const x = { a: nombres[0] ?? 'el herrero', b: nombres[1] ?? nombres[0] ?? 'el herrero', actores };
      if (g.antes === 'patrulla') m.sistema('exploration')._presentar(obtenerEncuentro('patrulla_hostil'));
      const entrada = plantilla.replace(/\{(\w)\}/g, (_, c) => x[c]);
      const texto = await m.jugar(entrada);
      const [bien, detalle] = g.comprobar(entrada, texto, x, m);
      const r = resultados.get(g.clave);
      r.total += 1;
      if (bien) r.ok += 1; else r.fallos.push(`${semilla} · «${entrada}» → ${String(detalle).replace(/\n/g, ' / ').slice(0, 220)}`);
      let marca = bien ? '✅' : '❌';
      if (g.atencion) {
        const j = atiende({ entrada, texto, presentes: nombres });
        if (j.aplica) { r.conAtencion += 1; if (j.atiende) r.atendidas += 1; }
        marca += j.aplica ? (j.atiende ? ' · atiende tema y destinatario' : ` · no atiende: ${j.motivo}`) : ` · (${j.motivo})`;
      }
      if (plantilla === g.frases[0]) lineas.push('```', ...apertura.split('\n'), '```', '');
      lineas.push(`**${marca}**`, '', ...texto.split('\n').filter(Boolean).map((l) => (l.startsWith('»') ? l : `  ${l}`)), '');
    }
  }
  if (salida) writeFileSync(join(salida, `semilla-${semilla}.md`), lineas.join('\n'));
}

console.log(`Paráfrasis en ${SEMILLAS.length} semillas nuevas (${SEMILLAS[0]}–${SEMILLAS.at(-1)}), cada frase en una partida limpia:\n`);
let ok = 0;
let total = 0;
for (const g of GRUPOS) {
  const r = resultados.get(g.clave);
  ok += r.ok;
  total += r.total;
  console.log(`${g.titulo.padEnd(48)} ${String(r.ok).padStart(3)}/${r.total}${g.atencion ? `  · atienden tema y destinatario: ${r.atendidas}/${r.conAtencion}` : ''}`);
  for (const f of r.fallos.slice(0, 4)) console.log(`   ❌ ${f}`);
}
console.log(`\nTOTAL: ${ok}/${total}`);
process.exit(ok === total ? 0 : 1);
