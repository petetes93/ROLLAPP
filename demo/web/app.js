/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · demo/web/app.js
 * ---------------------------------------------------------------------------
 * Banco de pruebas del motor, en el navegador.
 *
 * No simula nada: importa los módulos reales y los ejecuta. Lo que se ve en
 * pantalla sale del mismo código que corre en el juego.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { GestorRNG } from '../../src/core/RNG.js';
import { tirar } from '../../src/core/Dice.js';
import { interpretar } from '../../src/engine/IntentParser.js';
import * as Comb from '../../src/combat/Combatant.js';
import * as Ataques from '../../src/combat/AttackResolver.js';
import * as Iniciativa from '../../src/combat/InitiativeTracker.js';
import * as IA from '../../src/combat/EnemyAI.js';
import * as Registro from '../../src/combat/CombatLog.js';
import * as Mapa from '../../src/world/MapGraph.js';
import * as Precios from '../../src/economy/PriceModel.js';
import * as Tablas from '../../src/world/EncounterTables.js';
import * as Parser from '../../src/ai/ResponseParser.js';
import { LUGARES, obtenerLugar } from '../../src/data/locations.data.js';
import { combinarEfectos } from '../../src/data/events.data.js';


/* ═══════════════════════════════════════════════════════════════════════════
   INFORMADOR DE ERRORES
   ---------------------------------------------------------------------------
   Si algo falla, la página lo dice en pantalla con su traza en vez de quedarse
   en blanco. Un error silencioso en una demo es un error que nadie puede
   arreglar.
   ═══════════════════════════════════════════════════════════════════════════ */

function avisarFallo(donde, error) {
  console.error('[arcanum:demo] ' + donde, error);

  let caja = document.getElementById('fallos');

  if (!caja) {
    caja = document.createElement('div');
    caja.id = 'fallos';
    caja.className = 'fallos';
    caja.innerHTML = '<p class="fallos__titulo">Algo ha fallado en esta página</p>';
    document.querySelector('.envoltura')?.prepend(caja);
  }

  const linea = document.createElement('pre');
  linea.className = 'fallos__linea';
  linea.textContent = donde + ' → ' + (error?.message ?? error) + '\n'
    + String(error?.stack ?? '').split('\n').slice(1, 4).join('\n');
  caja.append(linea);
}

/** Envuelve una función para que un fallo suyo no tumbe la página entera. */
function protegido(donde, fn) {
  return (...args) => {
    try { return fn(...args); }
    catch (e) { avisarFallo(donde, e); return null; }
  };
}

window.addEventListener('error', (e) => {
  if (e.error) avisarFallo('error global', e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  avisarFallo('promesa rechazada', e.reason);
});

/* ── utilidades mínimas de DOM ─────────────────────────────────────────── */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function el(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== false) n.setAttribute(k, v);
  }
  for (const h of hijos.flat()) {
    if (h == null) continue;
    n.append(h.nodeType ? h : document.createTextNode(String(h)));
  }
  return n;
}

const rng = new GestorRNG(String(Date.now()));

/* ═══════════════════════════════════════════════════════════════════════════
   1 · CONSOLA: intención + tirada
   ═══════════════════════════════════════════════════════════════════════════ */

const HABILIDADES_MOD = {
  sigilo: 3, percepcion: 2, trato_social: 1, intimidacion: 2,
  engano: 1, acrobacias: 2, atletismo: 3, saber_arcano: 0,
  juego_manos: 2, tasacion: 1, artesania: 1, supervivencia: 2,
};

function resolverAccion(texto) {
  const intencion = interpretar(texto);

  // Modificadores de un personaje de ejemplo, para que la tirada sea real.
  const mods = [];
  const habilidad = intencion.habilidad;

  if (habilidad && HABILIDADES_MOD[habilidad] !== undefined) {
    mods.push({ fuente: 'Atributo', valor: 2 });
    mods.push({ fuente: `Competencia (${habilidad})`, valor: HABILIDADES_MOD[habilidad] });
  } else {
    mods.push({ fuente: 'Atributo', valor: 2 });
  }

  mods.push({ fuente: 'Carga media', valor: -1 });

  const umbrales = { facil: 10, moderada: 15, dificil: 20, ardua: 25 };
  const umbral = umbrales[intencion.umbral] ?? 15;

  const tirada = intencion.requiereTirada || habilidad
    ? tirar(rng.dados, { modificadores: mods, umbral })
    : null;

  return { intencion, tirada, umbral };
}

function pintarConsola(texto) {
  const salida = $('#consola-salida');
  salida.innerHTML = '';

  if (!texto.trim()) return;

  const { intencion, tirada } = resolverAccion(texto);

  // ── Lectura de la intención ──────────────────────────────────────────
  salida.append(
    el('div', { class: 'lectura' },
      el('span', { class: 'lectura__paso', text: '1' }),
      el('div', {},
        el('div', { class: 'lectura__titulo', text: 'El motor interpreta' }),
        el('div', { class: 'chips' },
          el('span', { class: 'chip chip--fuerte', text: intencion.tipo }),
          intencion.habilidad ? el('span', { class: 'chip', text: intencion.habilidad }) : null,
          intencion.objetivo ? el('span', { class: 'chip', text: `objetivo: ${intencion.objetivo}` }) : null,
          el('span', { class: 'chip chip--tenue', text: `confianza ${Math.round(intencion.confianza * 100)}%` }),
        ),
      ),
    ),
  );

  if (!tirada) {
    salida.append(
      el('div', { class: 'lectura' },
        el('span', { class: 'lectura__paso', text: '2' }),
        el('div', {},
          el('div', { class: 'lectura__titulo', text: 'Sin tirada' }),
          el('p', { class: 'nota', text: 'Esta acción no necesita dados: la resuelve el motor directamente.' }),
        ),
      ),
    );
    return;
  }

  // ── Pista de resolución ──────────────────────────────────────────────
  salida.append(
    el('div', { class: 'lectura' },
      el('span', { class: 'lectura__paso', text: '2' }),
      el('div', { style: 'flex:1;min-width:0' },
        el('div', { class: 'lectura__titulo', text: 'El motor tira' }),
        pista(tirada),
      ),
    ),
  );

  // ── Veredicto ────────────────────────────────────────────────────────
  const clase = tirada.pifia ? 'pifia' : tirada.critico ? 'critico' : tirada.exito ? 'exito' : 'fracaso';
  const etiqueta = tirada.pifia ? 'Fracaso grave'
    : tirada.critico ? 'Éxito rotundo'
    : tirada.exito ? (tirada.margen >= 5 ? 'Éxito claro' : 'Éxito justo')
    : (Math.abs(tirada.margen) <= 2 ? 'Fracaso por poco' : 'Fracaso');

  salida.append(
    el('div', { class: 'lectura' },
      el('span', { class: 'lectura__paso', text: '3' }),
      el('div', { style: 'flex:1' },
        el('div', { class: 'lectura__titulo', text: 'Lo que recibe el director' }),
        el('div', { class: `veredicto veredicto--${clase}` },
          el('span', { class: 'veredicto__sello', text: etiqueta }),
          el('p', { class: 'veredicto__orden', text: 'NARRA ESTE RESULTADO. No lo cambies.' }),
        ),
      ),
    ),
  );
}

/**
 * La pista de resolución: el dado cae en una posición, el umbral está fijo.
 * Es la pieza que hace visible que el motor decide antes que el narrador.
 */
function pista(t) {
  const min = 1;
  const max = 20 + Math.max(0, t.modificador) + 2;
  const pos = (v) => `${Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100))}%`;

  const wrap = el('div', { class: 'pista' });

  const track = el('div', { class: 'pista__via' });

  // Zona de éxito
  track.append(el('div', {
    class: 'pista__zona',
    style: `left:${pos(t.umbral)};right:0`,
  }));

  // Umbral
  track.append(el('div', { class: 'pista__umbral', style: `left:${pos(t.umbral)}` },
    el('span', { class: 'pista__umbral-num', text: String(t.umbral) })));

  // Dado natural
  track.append(el('div', { class: 'pista__marca pista__marca--nat', style: `left:${pos(t.natural)}` },
    el('span', { class: 'pista__marca-num', text: String(t.natural) })));

  // Total
  track.append(el('div', {
    class: 'pista__tramo',
    style: `left:${pos(t.natural)};width:calc(${pos(t.total)} - ${pos(t.natural)})`,
  }));

  track.append(el('div', { class: 'pista__marca pista__marca--total', style: `left:${pos(t.total)}` },
    el('span', { class: 'pista__marca-num', text: String(t.total) })));

  wrap.append(track);

  wrap.append(el('div', { class: 'pista__leyenda' },
    el('span', {}, el('b', { text: `d20 = ${t.natural}` })),
    el('span', { text: `modificadores ${t.modificador >= 0 ? '+' : ''}${t.modificador}` }),
    el('span', {}, el('b', { text: `total ${t.total}` }), ` contra ${t.umbral}`),
  ));

  wrap.append(el('div', { class: 'chips chips--mods' },
    ...(t.desglose ?? []).map((m) => el('span', {
      class: `chip chip--mod ${m.valor >= 0 ? 'es-mas' : 'es-menos'}`,
      text: `${m.fuente} ${m.valor >= 0 ? '+' : ''}${m.valor}`,
    })),
  ));

  return wrap;
}

/* ═══════════════════════════════════════════════════════════════════════════
   2 · COMBATE
   ═══════════════════════════════════════════════════════════════════════════ */

let combate = null;

function nuevoCombate() {
  const jugador = Comb.desdeJugador(
    {
      nombre: 'Kelra', nivel: 4,
      vida: { actual: 38, max: 38 },
      atributos: { vigor: 15, destreza: 14, temple: 13, intelecto: 10, astucia: 12, carisma: 11 },
      estados: [],
    },
    {
      defensa: 4, reduccion: 2,
      armaPrincipal: {
        objeto: { nombre: 'Espada corta' },
        stats: { dano: { notacion: '1d6+2', tipo: 'cortante' }, bonoAtaque: 1, bonoDano: 2 },
      },
    },
  );

  const enemigos = Comb.crearGrupo(
    [{ refId: $('#combate-enemigo').value, count: Number($('#combate-cuantos').value) }],
    { flujo: rng.combate },
  );

  const orden = Iniciativa.tirarIniciativa(rng.combate, [jugador, ...enemigos]);

  combate = {
    porId: Object.fromEntries((orden.combatientes ?? []).map((c) => [c.id, c])),
    orden: orden.orden,
    indice: -1,
    ronda: 1,
    bitacora: [],
  };

  $('#combate-log').innerHTML = '';
  logCombate(`Combate iniciado. Iniciativa: ${(orden.tiradas ?? []).map((t) => `${t.nombre} (${t.total})`).join(' · ')}`, 'sistema');

  pintarCombate();
  $('#combate-avanzar').disabled = false;
}

function avanzarCombate() {
  if (!combate) return;

  const fin = Iniciativa.comprobarFin(combate.porId);
  if (fin.terminado) return cerrarCombate(fin.resultado);

  const siguiente = Iniciativa.siguienteTurno(
    { iniciativa: combate.orden, turnoActual: combate.indice, ronda: combate.ronda },
    combate.porId,
  );

  if (!siguiente.siguiente) return cerrarCombate('tablas');

  if (siguiente.nuevaRonda) {
    combate.ronda++;
    logCombate(`── Ronda ${combate.ronda} ──`, 'sistema');
  }

  combate.indice = siguiente.indice;
  const actor = combate.porId[siguiente.siguiente];

  if (actor.esJugador) {
    const objetivo = Object.values(combate.porId)
      .filter((c) => c.vivo && c.bando === 'enemigo')
      .sort((a, b) => a.vida.actual - b.vida.actual)[0];

    if (objetivo) golpear(actor, objetivo, actor.ataques[0]);
  } else {
    const decision = IA.coordinar(
      IA.decidir(rng.combate, {
        actor, combatientes: combate.porId, ronda: combate.ronda, historial: combate.bitacora,
      }),
      actor,
      combate.bitacora,
    );

    if (decision.accion === 'atacar' && combate.porId[decision.objetivo]) {
      golpear(actor, combate.porId[decision.objetivo], decision.ataque);
    } else {
      logCombate(IA.describir(decision, actor, combate.porId), 'sistema');
    }
  }

  pintarCombate();

  const tras = Iniciativa.comprobarFin(combate.porId);
  if (tras.terminado) cerrarCombate(tras.resultado);
}

function golpear(atacante, objetivo, ataque) {
  const r = Ataques.resolver(rng.combate, { atacante, objetivo, ataque, ronda: combate.ronda });

  combate.porId[r.atacante.id] = r.atacante;
  combate.porId[r.objetivo.id] = r.objetivo;

  const entrada = Registro.entradaAtaque(r, {
    ronda: combate.ronda, atacante, objetivo, ataque,
  });

  combate.bitacora.push(entrada);
  logCombate(Registro.paraJugador(entrada), atacante.esJugador ? 'jugador' : 'enemigo');
}

function cerrarCombate(resultado) {
  $('#combate-avanzar').disabled = true;

  logCombate(Registro.cierre(rng.combate, resultado), 'sistema');

  const resumen = Registro.resumir(combate.bitacora, {
    resultado,
    rondas: combate.ronda,
    enemigos: Object.values(combate.porId).filter((c) => !c.esJugador),
    jugadorInicial: { vida: { actual: 38, max: 38 } },
    jugadorFinal: combate.porId.jugador,
  });

  logCombate(resumen.texto, 'resumen');

  const paraDM = Registro.paraDirector(combate.bitacora.slice(-4));
  if (paraDM) {
    $('#combate-dm').textContent = paraDM;
    $('#combate-dm-caja').hidden = false;
  }
}

function logCombate(texto, clase) {
  const log = $('#combate-log');
  log.append(el('p', { class: `log__linea log__linea--${clase}`, text: texto }));
  log.scrollTop = log.scrollHeight;
}

function pintarCombate() {
  const caja = $('#combate-estado');
  caja.innerHTML = '';

  for (const id of combate.orden) {
    const c = combate.porId[id];
    if (!c) continue;

    const i = Comb.paraInterfaz(c);
    const activo = combate.orden[combate.indice] === id;
    const frac = Math.round(i.fraccionVida * 100);

    caja.append(el('div', { class: `luchador ${c.vivo ? '' : 'es-caido'} ${activo ? 'es-activo' : ''}` },
      el('div', { class: 'luchador__fila' },
        el('span', { class: 'luchador__nombre', text: i.nombre }),
        el('span', { class: 'luchador__pv', text: `${c.vida.actual}/${c.vida.max}` }),
      ),
      el('div', { class: 'barra' }, el('div', {
        class: `barra__relleno ${c.esJugador ? 'es-aliado' : ''}`,
        style: `width:${frac}%`,
      })),
      el('div', { class: 'luchador__pie' },
        el('span', { text: i.condicion }),
        i.estados.length ? el('span', { class: 'luchador__estados', text: (i.estados ?? []).map((e) => e.nombre).join(', ') }) : null,
      ),
    ));
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   3 · MAPA
   ═══════════════════════════════════════════════════════════════════════════ */

function pintarRuta() {
  const desde = $('#mapa-desde').value;
  const hasta = $('#mapa-hasta').value;
  const invierno = $('#mapa-invierno').checked;

  const salida = $('#mapa-salida');
  salida.innerHTML = '';

  const opciones = invierno ? { estacion: 'invierno' } : {};
  const alternativas = Mapa.alternativas(desde, hasta, opciones);

  if (!alternativas.length) {
    const r = Mapa.ruta(desde, hasta, opciones);
    salida.append(el('p', { class: 'aviso', text: r.motivo ?? 'No hay ruta.' }));
    return;
  }

  for (const alt of alternativas) {
    const prov = Mapa.provisionesNecesarias(alt);

    salida.append(el('div', { class: 'ruta' },
      el('div', { class: 'ruta__cabecera' },
        el('span', { class: 'ruta__criterio', text: alt.nombre }),
        el('span', { class: 'ruta__coste', text: `${Math.round(alt.tiempoTotal)} h` }),
      ),
      el('div', { class: 'ruta__tramos' },
        ...(alt.ruta ?? []).map((refId, i) => [
          el('span', { class: 'ruta__nodo', text: obtenerLugar(refId)?.nombre ?? refId }),
          i < alt.ruta.length - 1
            ? el('span', {
                class: `ruta__flecha ${alt.tramos[i]?.peligro >= 3 ? 'es-peligro' : alt.tramos[i]?.peligro >= 2 ? 'es-aviso' : ''}`,
                text: '→',
              })
            : null,
        ]),
      ),
      el('div', { class: 'ruta__pie' },
        el('span', { text: `${prov.raciones} raciones · ${prov.agua} odres` }),
        el('span', {
          class: alt.peligroMaximo >= 3 ? 'es-peligro' : alt.peligroMaximo >= 2 ? 'es-aviso' : '',
          text: alt.peligroMaximo >= 3 ? 'muy peligroso' : alt.peligroMaximo >= 2 ? 'poco seguro' : 'transitable',
        }),
      ),
    ));
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   4 · PRECIOS
   ═══════════════════════════════════════════════════════════════════════════ */

const CATALOGO_DEMO = [
  { refId: 'odre_agua', nombre: 'Odre de agua', categoria: 'consumible', valor: 5 },
  { refId: 'racion_viaje', nombre: 'Ración de viaje', categoria: 'consumible', valor: 4 },
  { refId: 'espada_corta', nombre: 'Espada corta', categoria: 'arma', valor: 40 },
  { refId: 'cota_ligera', nombre: 'Cota ligera', categoria: 'armadura', valor: 60 },
  { refId: 'lingote_hierro', nombre: 'Lingote de hierro', categoria: 'material', valor: 15 },
];

const REGIONES_DEMO = [
  ['valle_central', 'Valle Central'],
  ['montanas_yunque', 'Montañas del Yunque'],
  ['bosque_cenizo', 'Bosque Cenizo'],
  ['dunas_rojas', 'Dunas Rojas'],
  ['marisma_velo', 'Marisma del Velo'],
];

function pintarPrecios() {
  const eventos = ($$('.evento-check:checked') ?? []).map((c) => c.value);
  const efectos = combinarEfectos(eventos);

  const tabla = $('#precios-tabla');
  tabla.innerHTML = '';

  tabla.append(el('tr', {},
    el('th', { text: 'Objeto' }),
    ...REGIONES_DEMO.map(([, nombre]) => el('th', { class: 'es-num', text: nombre })),
  ));

  for (const objeto of CATALOGO_DEMO) {
    const fila = el('tr', {}, el('td', {},
      el('span', { text: objeto.nombre }),
      el('span', { class: 'celda__base', text: `base ${objeto.valor}` }),
    ));

    const precios = REGIONES_DEMO.map(([region]) =>
      Precios.precioCompra(objeto, { region, efectosEventos: efectos }).precio);

    const min = Math.min(...precios);
    const max = Math.max(...precios);

    for (const p of precios) {
      const clase = p === max && max !== min ? 'es-caro' : p === min && max !== min ? 'es-barato' : '';
      fila.append(el('td', { class: `es-num ${clase}`, text: String(p) }));
    }

    tabla.append(fila);
  }

  const factor = efectos.precios ?? 1;
  $('#precios-nota').textContent = eventos.length
    ? `Efecto combinado sobre los precios: ×${factor.toFixed(3)} — el ${Math.round(factor * 100)} % del valor base.`
    : 'Sin eventos activos. Marca alguno para ver cómo se multiplican.';
}

/* ═══════════════════════════════════════════════════════════════════════════
   5 · ENCUENTROS
   ═══════════════════════════════════════════════════════════════════════════ */

function pintarEncuentro() {
  const terreno = $('#enc-terreno').value;
  const peligro = Number($('#enc-peligro').value);

  const e = Tablas.elegir(rng.flujo('mundo'), { terreno, peligro });
  const salida = $('#enc-salida');
  salida.innerHTML = '';

  if (!e) {
    salida.append(el('p', { class: 'aviso', text: 'No hay encuentros para ese terreno y peligro.' }));
    return;
  }

  salida.append(el('div', { class: `encuentro es-${e.familia}` },
    el('div', { class: 'encuentro__cabecera' },
      el('span', { class: 'encuentro__nombre', text: e.nombre }),
      el('span', { class: 'encuentro__familia', text: e.familia }),
    ),
    el('p', { class: 'encuentro__texto', text: e.apertura }),
    el('div', { class: 'encuentro__vias' },
      ...(e.resolucionesPosibles ?? []).map((via) => el('span', { class: 'via' },
        el('span', { class: 'via__nombre', text: via }),
        el('span', { class: 'via__xp', text: `${Tablas.xpPorResolucion(via, peligro)} xp` }),
      )),
    ),
  ));
}

/* ═══════════════════════════════════════════════════════════════════════════
   6 · RESCATE DE RESPUESTAS
   ═══════════════════════════════════════════════════════════════════════════ */

const EJEMPLOS = {
  limpio: '{"story":"El herrero levanta la vista del yunque y te mide con los ojos antes de decir nada.","mood":"tranquilo"}',
  bloque: '```json\n{"story":"La puerta cede con un crujido largo y detrás solo hay oscuridad."}\n```',
  roto: '{"story":"Los lobos rodean el claro sin acercarse todavía, midiendo el momento.",}',
  claves: '{story: "Alguien ha estado aquí hace poco: la ceniza sigue tibia al tacto."}',
  prosa: 'La taberna huele a humo y a cerveza derramada. Alguien te mira desde el fondo y aparta la vista cuando le devuelves la mirada. Hay amenaza en ese gesto.',
  basura: 'no puedo ayudarte con eso',
};

function pintarRescate() {
  const texto = $('#rescate-entrada').value;
  const salida = $('#rescate-salida');
  salida.innerHTML = '';

  if (!texto.trim()) return;

  const r = Parser.analizar(texto);

  const clase = { limpio: 'ok', reparado: 'ok', parcial: 'aviso', prosa: 'aviso', fallido: 'mal' }[r.nivel] ?? 'mal';

  salida.append(el('div', { class: `rescate rescate--${clase}` },
    el('div', { class: 'rescate__cabecera' },
      el('span', { class: 'rescate__nivel', text: r.nivel }),
      el('span', { class: 'rescate__estado', text: r.exito ? 'recuperado' : 'descartado' }),
    ),

    r.exito
      ? el('div', {},
          el('p', { class: 'rescate__story', text: r.respuesta.story }),
          el('div', { class: 'chips' },
            el('span', { class: 'chip chip--tenue', text: `${(r.respuesta.choices ?? []).length} opciones` }),
            el('span', { class: 'chip chip--tenue', text: `tono: ${r.respuesta.mood}` }),
          ),
        )
      : el('p', { class: 'rescate__error', text: Parser.diagnosticar(texto) }),

    (r.avisos ?? []).length
      ? el('p', { class: 'rescate__aviso', text: (r.avisos ?? []).join(' · ') })
      : null,
  ));
}

/* ═══════════════════════════════════════════════════════════════════════════
   ARRANQUE
   ═══════════════════════════════════════════════════════════════════════════ */

function poblarSelectores() {
  const lugares = Object.values(LUGARES).sort((a, b) => a.nombre.localeCompare(b.nombre));

  for (const sel of ['#mapa-desde', '#mapa-hasta']) {
    const nodo = $(sel);
    for (const l of lugares) {
      nodo.append(el('option', { value: l.refId, text: l.nombre }));
    }
  }

  $('#mapa-desde').value = 'vado_yunque';
  $('#mapa-hasta').value = 'oasis_sal';
}

function conectar() {
  // Consola
  const entrada = $('#consola-entrada');
  entrada.addEventListener('input', protegido('consola', () => pintarConsola(entrada.value)));

  $$('.sugerencia').forEach((b) => b.addEventListener('click', () => {
    entrada.value = b.dataset.texto;
    pintarConsola(entrada.value);
    entrada.focus();
  }));

  // Combate
  $('#combate-nuevo').addEventListener('click', protegido('empezar combate', nuevoCombate));
  $('#combate-avanzar').addEventListener('click', protegido('turno de combate', avanzarCombate));

  // Mapa
  ['#mapa-desde', '#mapa-hasta', '#mapa-invierno'].forEach((s) =>
    $(s)?.addEventListener('change', protegido('mapa', pintarRuta)));

  // Precios
  $$('.evento-check').forEach((c) => c.addEventListener('change', protegido('precios', pintarPrecios)));

  // Encuentros
  $('#enc-tirar').addEventListener('click', protegido('encuentros', pintarEncuentro));
  ['#enc-terreno', '#enc-peligro'].forEach((s) => $(s)?.addEventListener('change', protegido('encuentros', pintarEncuentro)));

  // Rescate
  $('#rescate-entrada').addEventListener('input', protegido('rescate', pintarRescate));
  $$('.ejemplo').forEach((b) => b.addEventListener('click', () => {
    $('#rescate-entrada').value = EJEMPLOS[b.dataset.caso];
    pintarRescate();
  }));
}

function arrancar() {
  // Cada paso va protegido: si uno falla, los demás siguen funcionando y la
  // página dice cuál fue.
  const paso = (nombre, fn) => {
    try { fn(); } catch (e) { avisarFallo(nombre, e); }
  };

  paso('poblar selectores', poblarSelectores);
  paso('conectar controles', conectar);
  paso('consola', () => pintarConsola($('#consola-entrada')?.value ?? ''));
  paso('mapa', pintarRuta);
  paso('precios', pintarPrecios);
  paso('encuentros', pintarEncuentro);
  paso('rescate', () => {
    const campo = $('#rescate-entrada');
    if (campo) { campo.value = EJEMPLOS.prosa; pintarRescate(); }
  });

  document.body.classList.add('esta-listo');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', arrancar);
} else {
  arrancar();
}

// Se exponen para poder ejercitarlas desde una prueba automatizada sin
// navegador. No las usa nada del propio interfaz.
export {
  pintarConsola, pintarRuta, pintarPrecios, pintarEncuentro,
  pintarRescate, nuevoCombate, avanzarCombate, arrancar,
};
