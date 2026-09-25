/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · tools/auditar-canon.mjs
 * ---------------------------------------------------------------------------
 * El canon del jugador no se pierde, y lo que no cabe se dice.
 *
 * Casos: muchas ediciones, muchas entidades, una historia larga, la revisión
 * de un mismo hecho, una contradicción de la IA después de guardar y cargar
 * (con el hecho FUERA de la petición) y la migración de partidas viejas.
 *
 *   node tools/auditar-canon.mjs
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { crearMotor } from './motor-sin-ventana.mjs';
import { MemoryStore } from '../src/ai/MemoryStore.js';
import { proyectar, anotar, crearRegistro, muertosSegunCanon } from '../src/ai/narrador/Canon.js';
import { filtrarModelo } from '../src/ai/narrador/FiltroModelo.js';

let fallos = 0;
let casos = 0;
function comprobar(bien, texto, detalle = '') {
  casos += 1;
  if (bien) console.log(`OK   ${texto}`);
  else {
    fallos += 1;
    console.log(`MAL  ${texto}`);
    if (detalle) console.log(`     ${String(detalle).replace(/\n/g, ' | ').slice(0, 600)}`);
  }
}

const NOMBRES = ['Aldo', 'Berin', 'Cessa', 'Dorne', 'Elva', 'Fiorn', 'Gadea', 'Hurel', 'Isna', 'Jorve', 'Kaela', 'Lusio', 'Mirte', 'Nolan', 'Orfa', 'Pelio', 'Quira', 'Rodel', 'Sibra', 'Tamer', 'Ulda', 'Varo', 'Wena', 'Xabe', 'Yerma', 'Zoril', 'Aroa', 'Bruma', 'Cirio', 'Dafne'];
const LORE = [
  'Nací en Pozoalto, un pueblo de mineros al pie de la sierra.',
  'Mi madre, Tessa, curaba fiebres con cortezas y no quería que yo bajara a la mina.',
  'A los doce años bajé igual, y a los trece vi hundirse la galería norte con mi tío Brando dentro.',
  ...Array.from({ length: 30 }, (_, i) => `Aprendí de ${NOMBRES[i]} el oficio número ${i + 1}, que consistía en guardar un secreto distinto de la cofradía de Pozoalto durante un invierno entero.`),
  'Juré a mi madre que volvería con la llave de hierro que se llevó el capataz Orvel.',
].join(' ');

/* ═══════════════════════════════════════════════════════════════════════════
   1. PIEZAS SUELTAS
   ═══════════════════════════════════════════════════════════════════════════ */

console.log('\n── El registro y la proyección, sueltos ──');
{
  let r = crearRegistro();
  for (let i = 0; i < 30; i += 1) r = anotar(r, `${NOMBRES[i]} guarda la llave número ${i + 1} de la cofradía y nunca la presta`, { turno: i }).registro;
  comprobar(r.entradas.length === 30 && r.entradas.every((e) => e.vigente), 'treinta ediciones distintas: las treinta se guardan', r.entradas.length);

  const p = proyectar({ registro: r, lore: LORE, entidades: [] }, { texto: 'le pregunto a Tamer por su llave', presupuesto: 2400 });
  const enviado = p.entradas.map((e) => e.texto).join(' ');
  comprobar(!p.completa && p.omitidas.length > 0 && p.omitidas.length + p.entradas.length === p.total, 'si no cabe, la proyección dice cuántas se quedan fuera y cuáles', `${p.entradas.length} + ${p.omitidas.length} de ${p.total}`);
  comprobar(enviado.includes('Tamer guarda la llave número 20'), 'lo pertinente (lo que nombra el jugador) entra primero');
  comprobar(p.entradas.every((e) => r.entradas.some((x) => x.texto === e.texto) || LORE.includes(e.texto)), 'ninguna entrada enviada va cortada por la mitad');
  comprobar(JSON.stringify(p.entradas).length <= 2400, `y cabe en el presupuesto (${JSON.stringify(p.entradas).length} de 2400 caracteres)`);

  const entidades = NOMBRES.slice(0, 14).map((n, i) => ({ nombre: n, tipo: 'persona', rasgos: ['viejo', 'tuerto'], notas: [`nota una de ${n}`, `nota dos de ${n}, la que se perdía`], turno: i, menciones: 1 }));
  const pe = proyectar({ registro: crearRegistro(), lore: '', entidades }, { texto: 'miro alrededor', presupuesto: 4000 });
  comprobar(pe.entradas.length === 14 && pe.entradas.every((e) => /nota dos de/.test(e.texto)), 'catorce entidades con todas sus notas (antes: ocho y solo la primera nota)', pe.entradas.length);

  const largo = proyectar({ registro: crearRegistro(), lore: LORE, entidades: [] }, { texto: 'pienso en mi madre Tessa y en la llave del capataz Orvel', presupuesto: 1200 });
  const frasesEnviadas = largo.entradas.map((e) => e.texto);
  comprobar(frasesEnviadas.some((f) => /Tessa/.test(f)) && frasesEnviadas.some((f) => /Orvel/.test(f)) && largo.omitidas.length > 0,
    'una historia larga no se trunca a 400 caracteres: van enteras las frases pertinentes y se listan las demás', frasesEnviadas.join(' / ').slice(0, 300));

  let rv = anotar(crearRegistro(), 'mi hermano Aldo murió en el paso del norte', { turno: 3 }).registro;
  const rev = anotar(rv, 'en realidad Aldo sigue vivo, preso en Saucedo', { turno: 9 });
  comprobar(rev.revisada && rev.registro.entradas.length === 1 && rev.entrada.revisiones.length === 1 && /murió/.test(rev.entrada.revisiones[0].texto),
    'revisar el mismo hecho no duplica: la entrada cambia y la versión anterior queda en su historial', JSON.stringify(rev.entrada));
  comprobar(muertosSegunCanon({ registro: rev.registro, lore: 'Mi hermano Aldo murió cruzando el paso.' }).length === 0, 'y lo último manda: Aldo ya no está muerto aunque la historia lo diga');
  const pc = proyectar({ registro: rev.registro, lore: 'Mi hermano Aldo murió cruzando el paso.' }, { texto: 'pienso en Aldo' });
  comprobar(pc.conflictos.length === 1 && /sigue vivo/.test(pc.conflictos[0].vale), 'el choque con la historia se detecta antes de enviar', JSON.stringify(pc.conflictos));

  const vieja = new MemoryStore({ hechos: [{ id: 'x', texto: 'Aldo murió en el paso del norte', turno: 4, peso: 3, categoria: 'canon_jugador', veces: 1 }, { id: 'y', texto: 'Otra cosa cualquiera que pasó', turno: 5, peso: 1, categoria: 'general', veces: 1 }] });
  comprobar(vieja.registroCanon.entradas.length === 1 && !vieja.hechos.some((h) => h.categoria === 'canon_jugador') && vieja.hechos.length === 1,
    'una partida de antes pasa sus ediciones al registro y las saca de los hechos podables');

  // La red no depende de lo enviado: la petición no lleva NADA de canon y
  // aun así el filtro sabe que Aldo está muerto.
  const filtro = await filtrarModelo({
    resultado: { proveedor: 'groq', respuesta: { story: 'El viento sopla desde la sierra.\nAldo: «Hermana, estoy aquí.»\nUna campana suena lejos.', choices: [] } },
    peticion: { accion: 'miro la sierra', instantanea: { jugador: { escribe: 'miro la sierra' }, yaContado: [], memoria: { canon: [] } }, canonMuertos: ['Aldo'] },
    leer: (ruta, d) => d,
    permitirReparacion: false,
  });
  comprobar(!/Aldo/.test(filtro.respuesta?.story ?? '') && /campana/.test(filtro.respuesta?.story ?? ''), 'sin canon en la petición, un muerto según el canon entero sigue sin hablar', filtro.respuesta?.story);

  const mucho = new MemoryStore();
  for (let i = 0; i < 120; i += 1) mucho.registrarCanon({ nombre: `Persona${i}`, tipo: 'persona', rasgos: [] }, i);
  comprobar(mucho.canon.length === 120, 'las entidades nombradas no se podan (antes: tope de 80)', mucho.canon.length);
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. EN EL MOTOR, CON UNA IA SIMULADA
   ═══════════════════════════════════════════════════════════════════════════ */

console.log('\n── En el motor: guardar, cargar y una IA que contradice el canon ──');
{
  const m = await crearMotor({ semilla: 5150 });
  const avisos = [];
  m.bus.on('ui:notice', (a) => avisos.push(a.mensaje));
  await m.empezar({ nombre: 'Nerea', raza: 'valdes', clase: 'rastreador', trasfondo: 'errante', genero: 'f', lore: LORE });
  const jugar = async (t) => (await m.jugar(t)).split('\n').filter((l) => !l.startsWith('»')).join('\n');

  comprobar(m.ver('player.lore', '').length === LORE.length, `la historia del personaje se guarda entera (${LORE.length} caracteres)`);

  let t = await jugar('canon: mi hermano Aldo murió en el paso del norte hace dos inviernos');
  comprobar(/Canon anotado/.test(t), 'se anota una edición', t);
  for (let i = 1; i < 12; i += 1) await jugar(`canon: ${NOMBRES[i]} fue el ${i}.º guardián de la cofradía de Pozoalto y conoce la mina vieja`);
  const turnos = m.sistema('turns');
  comprobar(turnos.memoria.registroCanon.entradas.filter((e) => e.vigente).length === 12, 'doce ediciones, doce en el registro (antes solo viajaban seis)');

  m.guardarYCargar();
  const tras = m.sistema('turns').memoria.registroCanon.entradas;
  comprobar(tras.length === 12 && tras[0].texto === 'mi hermano Aldo murió en el paso del norte hace dos inviernos', 'tras guardar y cargar siguen las doce, enteras');

  // La IA simulada pone a hablar a Aldo, muerto según el canon.
  const dm = m.sistema('dungeonmaster');
  const groq = dm.proveedor('groq');
  const enviados = [];
  let contenido = '';
  groq._fetch = async (url, op = {}) => {
    if (/\/(?:probar|estado)$/.test(url)) return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ servicio: 'arcanveil-puente-groq/2', disponible: true }) };
    if (op.body) enviados.push(JSON.parse(op.body));
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ choices: [{ message: { content: contenido } }] }) };
  };
  await groq.probar();
  groq.configurar({ consentido: true });
  dm.cambiar('groq', { silencioso: true });

  contenido = JSON.stringify({ story: 'El viento baja de la sierra y levanta polvo de carbón en la calle.\nAldo: «Hermana, te estaba esperando.»\nUna campana suena lejos, en la boca de la mina.', choices: [] });
  avisos.length = 0;
  t = await jugar('camino hacia la boca de la mina vieja pensando en los guardianes de la cofradía');
  const inst = JSON.parse(enviados.at(-1).messages[1].content.replace(/^[^{]*/, '').replace(/[^}]*$/, ''));
  comprobar(inst.canonOmitido && inst.canonOmitido.n > 0, `la petición dice qué canon se queda fuera (${inst.canonOmitido?.n} de ${inst.canonOmitido?.total})`);
  comprobar(avisos.some((a) => /no cabe entero/.test(a)), 'y el jugador recibe el aviso de que la continuidad no está garantizada', avisos.join(' / '));
  comprobar(!/Aldo: «/.test(t) && /campana/.test(t), 'Aldo, muerto según el canon, no habla tras guardar y cargar', t);

  t = await jugar('canon: en realidad Aldo sigue vivo, preso en Saucedo');
  comprobar(/Canon revisado/.test(t) && /Sustituye a «mi hermano Aldo murió/.test(t), 'revisar el hecho lo dice y conserva la versión anterior', t);
  m.guardarYCargar();
  const aldo = m.sistema('turns').memoria.registroCanon.entradas.find((e) => e.sujeto === 'aldo');
  comprobar(aldo?.revisiones?.length === 1 && /vivo/.test(aldo.texto), 'tras cargar, la revisión y su historial siguen', JSON.stringify(aldo));

  groq.configurar({ consentido: true });
  dm.cambiar('groq', { silencioso: true });
  contenido = JSON.stringify({ story: 'Un arriero se cruza contigo en el camino y te mira dos veces.\nNo dice nada, pero aprieta el paso hacia el pueblo.', choices: [] });
  await jugar('pregunto por Aldo en el camino');
  const inst2 = JSON.parse(enviados.at(-1).messages[1].content.replace(/^[^{]*/, '').replace(/[^}]*$/, ''));
  const canon2 = inst2.memoria.canon.map((c) => c.texto).join(' ');
  comprobar(canon2.includes('Aldo sigue vivo') && !canon2.includes('Aldo murió en el paso del norte hace'), 'la petición lleva la versión vigente, no la sustituida', canon2.slice(0, 300));
  comprobar(inst2.canonConflictos?.length === 0 || inst2.canonConflictos.every((c) => /sigue vivo/.test(c.vale)), 'si choca con la historia, vale la edición y se dice');
}

console.log(`\n${casos - fallos}/${casos} comprobaciones`);
console.log(fallos ? `\n${fallos} fallos.` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
