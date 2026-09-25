/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · tools/auditar-historia.mjs
 * ---------------------------------------------------------------------------
 * ¿La partida es una historia viva o la adaptación de la biografía?
 *
 * Alejandro corrigió el rumbo: el jugador escribe libremente y el mundo
 * reacciona a lo que hace, dice, pregunta, ignora o deja a medias. La
 * historia personal aporta datos, pero no dicta la campaña.
 *
 * Esta auditoría juega partidas de verdad con el motor completo, en Node y
 * con el narrador interno (ver `motor-sin-ventana.mjs`), y comprueba el
 * contrato con criterios de aceptación. Las tiradas de las situaciones se
 * fijan cuando lo que se prueba es la consecuencia y no el dado: el dado
 * tiene sus propias auditorías.
 *
 *   node tools/auditar-historia.mjs
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { crearMotor } from './motor-sin-ventana.mjs';

let fallos = 0;

function comprobar(bien, texto, detalle = '') {
  if (bien) {
    console.log(`OK   ${texto}`);
  } else {
    fallos += 1;
    console.log(`MAL  ${texto}`);
    if (detalle) console.log(`     ${String(detalle).slice(0, 600)}`);
  }
}

const HISTORIA = 'Perdí la forja de mi padre en un incendio. Busco al que la quemó.';
const FICHA = { nombre: 'Brunhilda', raza: 'ferrano', clase: 'vinculado', trasfondo: 'gente_campo', retrato: 'enana guerrera de barba trenzada', genero: 'f' };

const m = await crearMotor();

/** Hace que la próxima tirada de reglas salga como se pide. */
function fijarDado(exito) {
  const reglas = m.sistema('rules');
  const original = reglas.resolver;
  reglas.resolver = (t) => {
    reglas.resolver = original;
    const r = original.call(reglas, t);
    return { ...r, exito, grado: exito ? 'exitoClaro' : 'fracaso' };
  };
}

/** Empieza de cero con otra partida en el mismo proceso. */
async function nuevaPartida(ficha, opciones) {
  m.store.reiniciar();
  return m.empezar(ficha, opciones);
}

const misiones = () => {
  const a = m.ver('quests.activas', { porId: {}, orden: [] });
  return (a.orden ?? []).map((id) => a.porId[id]).filter(Boolean);
};

/* ── 1. La misma biografía no decide la campaña ─────────────────────────── */

{
  const aperturas = [];
  for (const nombre of ['Brunhilda', 'Hrodna']) {
    const apertura = await nuevaPartida({ ...FICHA, nombre, lore: HISTORIA });
    aperturas.push(apertura);

    comprobar(!misiones().length, `${nombre}: la partida no empieza con misiones impuestas`, misiones().map((q) => q.titulo).join(', '));
    comprobar(m.ver('player.lore') === HISTORIA, `${nombre}: la historia se conserva como canon en la ficha`);
    comprobar(!/forja|incendio|padre|quem/i.test(apertura), `${nombre}: la apertura no vuelca el pasado del personaje`, apertura);
    comprobar(m.sistema('situations').aqui().length === 1, `${nombre}: la apertura pone en marcha algo del mundo`, JSON.stringify(m.sistema('situations').inspeccionar()));
    const actores = Object.values(m.sistema('situations').aqui()[0]?.actores ?? {});
    comprobar(actores.length && actores.every((a) => m.ver('npcs.presentes', []).includes(a.refId)),
      `${nombre}: quienes están metidos en ello están en escena de verdad`);
    comprobar(/\?$/.test(apertura.trim().split('\n').at(-1)), `${nombre}: la apertura devuelve la palabra`, apertura.split('\n').at(-1));
    comprobar(!(m.ver('ai.memoria.hilos', []) ?? []).some((h) => /^player_lore/.test(h.relacionadoCon ?? '')),
      `${nombre}: el pasado no se abre como hilos de memoria`);
  }

  const sinHistoria = await nuevaPartida({ ...FICHA, nombre: 'Sinpasado', lore: '' });
  comprobar(!misiones().length && /\?$/.test(sinHistoria.trim()), 'sin historia tampoco hay objetivo obligatorio, y se juega igual');
}

/* ── 2. Ignorar algo no lo borra, y el mundo sigue a su ritmo ───────────── */

{
  await nuevaPartida({ ...FICHA, lore: HISTORIA });
  const situaciones = m.sistema('situations');
  // Se fuerza la del encapuchado: es la que la especificación pone de ejemplo.
  for (const s of situaciones.aqui()) m.store.dispatch('situaciones/guardar', { situacion: { ...s, estado: 'desenlace' } });
  const sit = situaciones.abrir({ refId: 'encapuchado_vigila' });
  const vigia = sit.actores.vigia;
  const mercader = sit.actores.mercader;

  const hablados = [];
  m.bus.on('npc:talked', (e) => hablados.push(e.refId));

  const turno1 = await m.jugar('Ignoro al encapuchado; examino el pozo');
  const ahora = situaciones.todas().find((s) => s.id === sit.id);
  comprobar(ahora.estado === 'abierta' && ahora.ignoradaAProposito, 'ignorarlo lo deja en marcha, apuntado como ignorado a propósito', JSON.stringify(ahora));
  comprobar(!hablados.includes(vigia.refId), 'ignorarlo no es hablar con él');
  comprobar(m.ver('npcs.presentes', []).includes(vigia.refId), 'el encapuchado sigue en su sitio', turno1);
  comprobar(/pozo/i.test(turno1), 'el turno trata del pozo, que es lo que hizo', turno1);

  // Pocos turnos después, sin causa suficiente, no cambia nada.
  await m.jugar('miro el agua del pozo');
  comprobar(situaciones.todas().find((s) => s.id === sit.id).estado === 'abierta', 'dos turnos no bastan para que pase nada por su cuenta');

  // Con el plazo cumplido, lo que el vigía venía a hacer ocurre, y queda en la memoria.
  let desenlace = '';
  for (let i = 0; i < 5; i += 1) desenlace += `${await m.jugar('sigo sentada junto al pozo')}\n`;
  const fin = situaciones.todas().find((s) => s.id === sit.id);
  comprobar(fin.estado === 'desenlace', 'cumplido el plazo, el robo ocurre sin ella', JSON.stringify(fin));
  comprobar(new RegExp(mercader.nombre).test(desenlace) && /bolsa/.test(desenlace), 'y se cuenta en escena, con causa', desenlace);
  comprobar((m.ver('ai.memoria.hechos', []) ?? []).some((h) => h.texto.includes(mercader.nombre) && /robaron/.test(h.texto)),
    'el mundo lo recuerda como hecho');
  comprobar(!/culpa|por no|deberías|castig/i.test(desenlace), 'sin reproches ni castigo al jugador por no intervenir', desenlace);
}

/* ── 3. Intervenir cambia el mundo, y el mundo lo recuerda ──────────────── */

{
  await nuevaPartida({ ...FICHA, lore: HISTORIA });
  const situaciones = m.sistema('situations');
  for (const s of situaciones.aqui()) m.store.dispatch('situaciones/guardar', { situacion: { ...s, estado: 'desenlace' } });
  const sit = situaciones.abrir({ refId: 'carro_atascado' });
  const carretero = sit.actores.carretero;
  const actitudAntes = m.ver(`npcs.conocidos.porId.${carretero.refId}.actitud`);

  fijarDado(true);
  const turno = await m.jugar(`ayudo a ${carretero.nombre} a levantar el carro y calzar la rueda`);
  comprobar(/calzar el eje|Rueda coja/.test(turno), 'lo que se narra es lo que pasa en la situación', turno);
  comprobar(situaciones.todas().find((s) => s.id === sit.id).estado === 'resuelta', 'con éxito, la situación termina');
  comprobar(m.ver(`npcs.conocidos.porId.${carretero.refId}.actitud`) > actitudAntes, 'el carretero le tiene más aprecio');
  const recuerda = (m.ver(`npcs.conocidos.porId.${carretero.refId}.memoria`, []) ?? []).map((r) => r.texto).join(' | ');
  comprobar(/sacar el carro/.test(recuerda), 'el carretero lo recuerda', recuerda);

  // Guardar y cargar: el mismo mundo, los mismos nombres, los mismos recuerdos.
  const nombreAntes = m.ver(`npcs.conocidos.porId.${carretero.refId}.nombre`);
  m.guardarYCargar();
  const tras = m.sistema('situations').todas().find((s) => s.id === sit.id);
  comprobar(tras?.estado === 'resuelta', 'tras guardar y cargar, la situación sigue resuelta');
  comprobar(m.ver(`npcs.conocidos.porId.${carretero.refId}.nombre`) === nombreAntes
    && (m.ver(`npcs.conocidos.porId.${carretero.refId}.memoria`, []) ?? []).some((r) => /sacar el carro/.test(r.texto)),
  'y el carretero conserva su nombre y su recuerdo');
}

console.log(`\n${fallos ? `${fallos} fallos.` : 'Todo correcto.'}`);
process.exit(fallos ? 1 : 0);
