/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · player/CharacterFactory.js
 * ---------------------------------------------------------------------------
 * Ensamblado del personaje a partir del borrador de la entrevista.
 *
 * Recibe lo que salió de CharacterInterview y produce un objeto `player`
 * completo y coherente, más los efectos secundarios que la creación genera en
 * el mundo: el inventario inicial, el PNJ de contacto del trasfondo y la misión
 * latente si la hubiera.
 *
 * Ese último punto es lo que distingue una ficha de un personaje: un fuera de
 * la ley no empieza con «trasfondo: criminal» escrito en una casilla, empieza
 * con un perista que existe en el mundo y una deuda pendiente que el director
 * puede activar cuando le convenga.
 *
 * El orden de ensamblado importa y está documentado paso a paso: los máximos de
 * vida dependen del Vigor final, que depende de los modificadores de linaje,
 * que se aplican después del reparto por compra.
 *
 * Dependencias: datos, todos los sistemas de jugador, core, utils.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { obtenerRaza, atributosDe, rasgosDe, loreParaDirector } from '../data/races.data.js';
import { obtenerClase } from '../data/classes.data.js';
import { obtenerTrasfondo } from '../data/backgrounds.data.js';
import { crearJugador } from '../core/GameState.js';
import { idEntidad, TIPO } from '../utils/id.js';
import { crearCanal } from '../core/Logger.js';

import { aplicarLinaje, validarReparto, repartoBase, describirFortalezas, describirDebilidad } from './Attributes.js';
import { vidaMaxima, manaMaximo } from './Vitals.js';
import { concederVarias } from './SkillSystem.js';
import { deducirInicial, describir as describirAlineamiento } from './Alignment.js';
import { rasgosActivos, capacidadesParaDirector } from './ClassSystem.js';

const log = crearCanal('core');

/* ═══════════════════════════════════════════════════════════════════════════
   ENSAMBLADO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Construye un personaje completo a partir del borrador de la entrevista.
 *
 * @param {Object} borrador Salida de CharacterInterview.finalizar().
 * @returns {{
 *   jugador: Object,
 *   inventario: Array<{refId: string, cantidad: number}>,
 *   oro: number,
 *   contacto: Object|null,
 *   deuda: Object|null,
 *   avisos: string[]
 * }}
 */
export function crearPersonaje(borrador) {
  const avisos = [];

  // ─── 1. Resolver el contenido referenciado ───────────────────────────────
  const raza = obtenerRaza(borrador.raza);
  const clase = obtenerClase(borrador.clase);
  const trasfondo = obtenerTrasfondo(borrador.trasfondo);

  if (!raza) avisos.push(`Linaje desconocido: ${borrador.raza}`);
  if (!clase) avisos.push(`Vocación desconocida: ${borrador.clase}`);
  if (!trasfondo) avisos.push(`Trasfondo desconocido: ${borrador.trasfondo}`);

  // ─── 2. Partir de una ficha en blanco ────────────────────────────────────
  const jugador = crearJugador();

  jugador.id = idEntidad(TIPO.PARTIDA);
  jugador.nombre = borrador.nombre || 'Sin nombre';
  jugador.raza = borrador.raza ?? null;
  jugador.subraza = borrador.subraza ?? null;
  jugador.clase = borrador.clase ?? null;
  jugador.trasfondo = borrador.trasfondo ?? null;

  // ─── 3. Atributos: reparto comprado + modificadores de linaje ────────────
  // El orden es deliberado. El jugador reparte sus 27 puntos con libertad y el
  // linaje suma encima, de modo que un ferrano puede llegar a 19 de Vigor en la
  // creación sin haber gastado puntos por encima del tope de compra.
  const reparto = borrador.atributos ?? repartoBase();
  const validacion = validarReparto(reparto);
  if (!validacion.valido) {
    avisos.push(...validacion.errores);
    log.aviso('Reparto de atributos inválido; se corrige', validacion.errores);
  }

  jugador.atributos = aplicarLinaje(reparto, atributosDe(borrador.raza, borrador.subraza));

  // ─── 4. Alineamiento deducido del principio declarado ────────────────────
  jugador.alineamiento = deducirInicial(borrador.principio);

  // ─── 5. Vitales, ya con los atributos finales ────────────────────────────
  const vidaMax = vidaMaxima(jugador, clase?.dadoVida ?? 8);
  const manaMax = manaMaximo(jugador, clase?.manaBase ?? 0);

  jugador.vida = { actual: vidaMax, max: vidaMax };
  jugador.mana = { actual: manaMax, max: manaMax };

  // Se empieza en plenas condiciones. Si el personaje debe arrancar hambriento
  // o herido por su trasfondo, eso lo decidirá el director en el primer turno.
  jugador.hambre = 100;
  jugador.sed = 100;
  jugador.fatiga = 100;

  // ─── 6. Competencias de las tres fuentes ─────────────────────────────────
  const competencias = [
    ...(raza?.habilidadesGratis ?? []),
    ...(clase?.habilidadesGratis ?? []),
    ...(trasfondo?.habilidades ?? []),
  ];
  const parcheCompetencias = concederVarias(jugador, competencias, 'practicado');
  jugador.habilidades = parcheCompetencias.player.habilidades;

  // ─── 7. Rasgo del trasfondo, que no vive en el catálogo de rasgos ────────
  if (trasfondo?.rasgo) jugador._rasgoTrasfondo = trasfondo.rasgo;

  // ─── 8. Rasgos que conceden competencias adicionales ─────────────────────
  // El rasgo 'Función original' del Crisol otorga una competencia a nivel de
  // experto; la Versatilidad humana, una a elección. Se resuelven aquí para que
  // el personaje llegue completo al mundo.
  for (const rasgo of rasgosDe(borrador.raza, borrador.subraza)) {
    if (rasgo.efecto?.tipo === 'competenciaExperto') {
      const elegida = borrador.competenciaExperta ?? competencias[0];
      if (elegida) jugador.habilidades[elegida] = 'experto';
    }
    if (rasgo.efecto?.tipo === 'habilidadExtra' && borrador.competenciasExtra) {
      for (const extra of borrador.competenciasExtra) {
        if (!jugador.habilidades[extra]) jugador.habilidades[extra] = 'practicado';
      }
    }
  }

  // ─── 9. Oro inicial ──────────────────────────────────────────────────────
  jugador.oro = (jugador.oro ?? 25) + (trasfondo?.oroExtra ?? 0);

  // ─── 10. Retrato narrativo ───────────────────────────────────────────────
  // El texto original del jugador se conserva íntegro. Es lo que hace que la
  // partida sea suya y no de una plantilla: viaja al director en cada prompt.
  jugador.retrato = borrador.retrato ?? '';
  jugador.motivacion = borrador.motivacion ?? null;
  jugador.gancho = borrador.gancho ?? null;
  jugador.detalle = borrador.detalle ?? null;
  jugador.principio = borrador.principio ?? null;

  // ─── 11. Banderas narrativas iniciales ───────────────────────────────────
  jugador.flags = {
    [`origen_${borrador.raza}`]: true,
    [`vocacion_${borrador.clase}`]: true,
    [`pasado_${borrador.trasfondo}`]: true,
  };

  // ─── 12. Efectos en el mundo ─────────────────────────────────────────────
  const inventario = construirInventarioInicial(clase, trasfondo);
  const contacto = construirContacto(trasfondo);
  const deuda = construirDeuda(trasfondo, borrador);

  log.info(`Personaje creado: ${jugador.nombre}, ${raza?.nombre} ${clase?.nombre}`);

  return { jugador, inventario, oro: jugador.oro, contacto, deuda, avisos };
}

/* ═══════════════════════════════════════════════════════════════════════════
   EFECTOS SECUNDARIOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Equipo inicial: el de la vocación más el del trasfondo, sin duplicados.
 *
 * @param {Object} clase
 * @param {Object} trasfondo
 * @returns {Array<{refId: string, cantidad: number}>}
 */
export function construirInventarioInicial(clase, trasfondo) {
  const cuenta = new Map();

  for (const refId of [...(clase?.equipoInicial ?? []), ...(trasfondo?.equipoInicial ?? [])]) {
    cuenta.set(refId, (cuenta.get(refId) ?? 0) + 1);
  }

  // Provisiones básicas para que nadie empiece muriéndose de sed en el turno 3.
  cuenta.set('racion_viaje', (cuenta.get('racion_viaje') ?? 0) + 2);
  cuenta.set('odre_agua', (cuenta.get('odre_agua') ?? 0) + 1);

  return [...cuenta.entries()].map(([refId, cantidad]) => ({ refId, cantidad }));
}

/**
 * PNJ de contacto derivado del trasfondo.
 *
 * Existe desde el turno cero: tiene identificador, actitud y ubicación. El
 * director puede hacerlo aparecer, mandarle un mensaje o matarlo fuera de
 * escena, y en cualquier caso el jugador tendrá la sensación de que ese
 * personaje ya estaba ahí. Porque estaba.
 *
 * @param {Object} trasfondo
 * @returns {Object|null}
 */
export function construirContacto(trasfondo) {
  const c = trasfondo?.contactoInicial;
  if (!c) return null;

  return {
    id: idEntidad(TIPO.NPC),
    rol: c.rol,
    actitud: c.actitud,
    ubicacion: c.ubicacion,
    // El nombre lo pondrá el director la primera vez que aparezca: así encaja
    // con el tono que haya tomado la partida.
    nombre: null,
    conocido: true,
    relacion: c.actitud === 'leal' ? 40 : c.actitud === 'cariñosa' ? 50 : 15,
    origen: 'trasfondo',
  };
}

/**
 * Misión latente derivada del trasfondo.
 *
 * No aparece en el registro de misiones al empezar: queda marcada como latente
 * para que el director la active cuando encaje. Una deuda que asoma en el turno
 * cuarenta pesa más que una que estaba en la lista desde el principio.
 *
 * @param {Object} trasfondo
 * @param {Object} borrador
 * @returns {Object|null}
 */
export function construirDeuda(trasfondo, borrador) {
  const d = trasfondo?.deudaInicial;
  if (!d) return null;

  return {
    id: idEntidad(TIPO.MISION),
    titulo: d.titulo,
    tipo: d.tipo,
    estado: 'latente',
    resumen: borrador.gancho ?? null,
    origen: 'trasfondo',
    objetivos: [],
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONTEXTO PARA EL DIRECTOR
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Ficha narrativa completa que se envía al director en el primer turno.
 *
 * Es prosa, no una tabla de datos: los modelos de lenguaje trabajan mucho mejor
 * con «un ferrano terco que dejó su clan» que con `{raza: 'ferrano', ...}`. El
 * texto original del jugador va primero, porque es lo más importante.
 *
 * @param {Object} jugador
 * @returns {string}
 */
export function fichaParaDirector(jugador) {
  const raza = obtenerRaza(jugador.raza);
  const clase = obtenerClase(jugador.clase);
  const trasfondo = obtenerTrasfondo(jugador.trasfondo);
  const alineamiento = describirAlineamiento(jugador.alineamiento);

  const bloques = [];

  // Lo que escribió el jugador, íntegro y primero.
  if (jugador.retrato) {
    bloques.push(`El jugador describió así a su personaje: «${jugador.retrato}»`);
  }

  bloques.push(
    `${jugador.nombre} es ${raza?.nombre ?? 'de origen desconocido'}, de vocación ${clase?.nombre ?? 'indefinida'}, ` +
    `nivel ${jugador.nivel}. Antes de esto: ${trasfondo?.nombre ?? 'pasado desconocido'}.`,
  );

  bloques.push(loreParaDirector(jugador.raza, jugador.subraza));

  if (clase?.promptLore) bloques.push(clase.promptLore);
  if (trasfondo?.promptLore) bloques.push(trasfondo.promptLore);

  bloques.push(
    `Físicamente ${describirFortalezas(jugador.atributos)}` +
    `${describirDebilidad(jugador.atributos) ? `, aunque ${describirDebilidad(jugador.atributos)}` : ''}.`,
  );

  bloques.push(`Su conducta lo perfila como ${alineamiento.resumen}.`);

  if (jugador.motivacion) bloques.push(`Lo que le mueve: ${jugador.motivacion}`);
  if (jugador.gancho) bloques.push(`Hilo abierto de su pasado: ${jugador.gancho}`);
  if (jugador.detalle) bloques.push(`Rasgo visible: ${jugador.detalle}`);
  if (jugador.principio) bloques.push(`Hay algo que no haría: ${jugador.principio}`);

  const capacidades = capacidadesParaDirector(jugador);
  if (capacidades) bloques.push(capacidades);

  return bloques.filter(Boolean).join('\n');
}

/* ═══════════════════════════════════════════════════════════════════════════
   VISTA PREVIA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Previsualiza el personaje sin construirlo del todo.
 *
 * La pantalla de creación la usa para mostrar en vivo cómo quedarían la vida y
 * el maná según se ajustan los atributos, sin tocar el estado de la partida.
 *
 * @param {Object} borrador
 * @returns {Object}
 */
export function previsualizar(borrador) {
  const raza = obtenerRaza(borrador.raza);
  const clase = obtenerClase(borrador.clase);
  const trasfondo = obtenerTrasfondo(borrador.trasfondo);

  const reparto = borrador.atributos ?? repartoBase();
  const atributos = aplicarLinaje(reparto, atributosDe(borrador.raza, borrador.subraza));

  const provisional = { atributos, atributosTemporales: {}, nivel: 1 };

  const vida = vidaMaxima(provisional, clase?.dadoVida ?? 8);
  const mana = manaMaximo(provisional, clase?.manaBase ?? 0);

  const competencias = [
    ...(raza?.habilidadesGratis ?? []),
    ...(clase?.habilidadesGratis ?? []),
    ...(trasfondo?.habilidades ?? []),
  ];

  return {
    nombre: borrador.nombre || 'Sin nombre',
    raza: raza?.nombre ?? '—',
    clase: clase?.nombre ?? '—',
    trasfondo: trasfondo?.nombre ?? '—',
    atributos,
    modificadoresLinaje: atributosDe(borrador.raza, borrador.subraza),
    vida,
    mana,
    oro: 25 + (trasfondo?.oroExtra ?? 0),
    competencias: [...new Set(competencias)],
    rasgos: [
      ...rasgosDe(borrador.raza, borrador.subraza),
      ...(clase?.rasgos ?? []).filter((r) => (r.nivel ?? 1) === 1),
      ...(trasfondo?.rasgo ? [trasfondo.rasgo] : []),
    ],
    equipo: construirInventarioInicial(clase, trasfondo),
  };
}

export default {
  crearPersonaje,
  construirInventarioInicial,
  construirContacto,
  construirDeuda,
  fichaParaDirector,
  previsualizar,
};
