/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · combat/AttackResolver.js
 * ---------------------------------------------------------------------------
 * Resolución completa de un ataque, de la intención al resultado.
 *
 * Secuencia:
 *   1. Comprobar que el atacante puede atacar
 *   2. Tirar esquiva del objetivo (evasión pasiva, antes que nada)
 *   3. Tirar ataque contra la defensa
 *   4. Calcular daño si impacta
 *   5. Aplicar estados que provoque el impacto
 *   6. Resolver robo de vida
 *   7. Registrar el uso para la recarga
 *
 * La esquiva va ANTES de la tirada de ataque, y es porcentual, no un modificador
 * a la defensa. Un personaje ágil puede evitar por completo un golpe que
 * habría impactado, y eso se narra distinto que un fallo de puntería.
 *
 * Funciones puras: devuelven los combatientes modificados y un informe.
 *
 * Dependencias: Dice, Combatant, StatusEffects, DamageCalculator.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { tirar } from '../core/Dice.js';
import { TIRADAS, COMBATE } from '../config/balance.config.js';
import * as Comb from './Combatant.js';
import * as Estados from './StatusEffects.js';
import * as Dano from './DamageCalculator.js';

/** Resultados posibles de un ataque. */
export const RESULTADO = Object.freeze({
  IMPACTO: 'impacto',
  CRITICO: 'critico',
  FALLO: 'fallo',
  ESQUIVADO: 'esquivado',
  PIFIA: 'pifia',
  IMPOSIBLE: 'imposible',
});

/* ═══════════════════════════════════════════════════════════════════════════
   RESOLUCIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Resuelve un ataque completo.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Object} opciones
 * @param {Object} opciones.atacante
 * @param {Object} opciones.objetivo
 * @param {Object} opciones.ataque
 * @param {number} opciones.ronda
 * @param {Object} [opciones.circunstancias] { emboscada, rodeado, ventaja }
 * @returns {Object}
 */
export function resolver(flujo, opciones) {
  const { ataque, ronda, circunstancias = {} } = opciones;

  let atacante = opciones.atacante;
  let objetivo = opciones.objetivo;

  const eventos = [];

  // ─── 1. ¿Puede atacar? ──────────────────────────────────────────────────
  const permiso = Comb.puede(atacante, 'atacar');

  if (!permiso.puede) {
    return {
      resultado: RESULTADO.IMPOSIBLE,
      atacante, objetivo,
      tirada: null, dano: null,
      estadosAplicados: [], vidaRobada: 0, cayo: false,
      eventos, motivo: permiso.motivo,
    };
  }

  // Atacar rompe ciertos estados, como la invisibilidad.
  const rotura = Estados.alActuar(atacante, 'atacar');
  atacante = rotura.combatiente;

  for (const roto of rotura.rotos) {
    eventos.push({ tipo: 'estado_roto', combatiente: atacante.id, estado: roto.nombre });
  }

  // ─── 2. Esquiva ─────────────────────────────────────────────────────────
  // Evasión pasiva, antes de la tirada. Un ágil puede evitar por completo un
  // golpe que habría acertado.
  const esquiva = Comb.esquivaEfectiva(objetivo);

  if (esquiva > 0 && flujo.oportunidad(esquiva)) {
    eventos.push({ tipo: 'esquiva', combatiente: objetivo.id, probabilidad: esquiva });

    return {
      resultado: RESULTADO.ESQUIVADO,
      atacante, objetivo,
      tirada: null, dano: null,
      estadosAplicados: [], vidaRobada: 0, cayo: false,
      eventos, motivo: null,
    };
  }

  // ─── 3. Tirada de ataque ────────────────────────────────────────────────
  const modificadores = _modificadoresAtaque(atacante, ataque, circunstancias);
  const defensa = Comb.defensaEfectiva(objetivo);

  const ventaja = _resolverVentaja(atacante, objetivo, circunstancias);

  const tirada = tirar(flujo, { modificadores, umbral: defensa, ventaja });

  // Ciertas armas amplían el rango de crítico.
  const umbralCritico = ataque.umbralCritico ?? TIRADAS.critico;
  const critico = tirada.natural >= umbralCritico;
  tirada.critico = critico;

  // Un objetivo paralizado recibe críticos automáticos.
  const modsObjetivo = Comb.modificadoresDeEstados(objetivo);
  const criticoForzado = Boolean(modsObjetivo.criticoRecibido);
  const esCritico = critico || (tirada.exito && criticoForzado);

  // ─── Fallo ──────────────────────────────────────────────────────────────
  if (!tirada.exito) {
    return {
      resultado: tirada.pifia ? RESULTADO.PIFIA : RESULTADO.FALLO,
      atacante, objetivo,
      tirada, dano: null,
      estadosAplicados: [], vidaRobada: 0, cayo: false,
      eventos, motivo: null,
    };
  }

  // ─── 4. Daño ────────────────────────────────────────────────────────────
  const resultadoDano = Dano.calcular(flujo, {
    atacante,
    objetivo,
    ataque,
    critico: esCritico,
  });

  const cambio = Comb.modificarVida(objetivo, -resultadoDano.total);
  objetivo = cambio.combatiente;

  eventos.push({
    tipo: 'dano',
    atacante: atacante.id,
    objetivo: objetivo.id,
    cantidad: resultadoDano.total,
    tipoDano: resultadoDano.tipo,
    critico: esCritico,
    magnitud: Dano.magnitud(resultadoDano.total, objetivo),
  });

  // ─── 5. Estados que rompe el daño recibido ──────────────────────────────
  if (resultadoDano.total > 0) {
    const roturaDano = Estados.alRecibirDano(
      objetivo,
      resultadoDano.total,
      (atributo, umbral) => _salvacionSimple(flujo, objetivo, atributo, umbral),
    );

    objetivo = roturaDano.combatiente;

    for (const roto of roturaDano.rotos) {
      eventos.push({ tipo: 'estado_roto', combatiente: objetivo.id, estado: roto.nombre });
    }
  }

  // ─── 6. Estados aplicados por el impacto ────────────────────────────────
  const estadosAplicados = [];

  const declarados = [
    ...(ataque.estado ? [ataque.estado] : []),
    ...(ataque.estadosAlImpactar ?? []),
  ];

  for (const decl of declarados) {
    // La probabilidad sube con un crítico: un golpe perfecto envenena mejor.
    const probabilidad = (decl.probabilidad ?? 1) * (esCritico ? 1.5 : 1);

    if (!flujo.oportunidad(Math.min(probabilidad, 1))) continue;

    const r = Estados.aplicar(objetivo, decl.refId ?? decl.estado, {
      acumulaciones: decl.acumulaciones ?? 1,
      origen: atacante.id,
    });

    objetivo = r.combatiente;

    if (r.aplicado) {
      estadosAplicados.push({ refId: decl.refId ?? decl.estado, narracion: r.narracion });
      eventos.push({
        tipo: 'estado_aplicado',
        combatiente: objetivo.id,
        estado: decl.refId ?? decl.estado,
        narracion: r.narracion,
      });
    }
  }

  // ─── 7. Robo de vida ────────────────────────────────────────────────────
  let vidaRobada = 0;

  if (ataque.robarVida || ataque.curaAtacante) {
    const fraccion = ataque.robarVida ?? 0.5;
    vidaRobada = Dano.roboVida(resultadoDano.total, fraccion);

    if (vidaRobada > 0) {
      const r = Comb.modificarVida(atacante, vidaRobada);
      atacante = r.combatiente;

      eventos.push({ tipo: 'robo_vida', combatiente: atacante.id, cantidad: r.aplicado });
    }
  }

  // ─── 8. Registro del uso, para la recarga ───────────────────────────────
  if (ataque.recarga) {
    atacante = Comb.marcarUso(atacante, ataque.nombre, ronda);
  }

  return {
    resultado: esCritico ? RESULTADO.CRITICO : RESULTADO.IMPACTO,
    atacante,
    objetivo,
    tirada,
    dano: resultadoDano,
    estadosAplicados,
    vidaRobada,
    cayo: cambio.cayo,
    eventos,
    motivo: null,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   ATAQUES DE ÁREA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Resuelve un ataque que afecta a varios objetivos.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Object} opciones
 * @returns {{atacante: Object, objetivos: Array<Object>, resultados: Array<Object>, eventos: Array<Object>}}
 */
export function resolverArea(flujo, opciones) {
  const { ataque, ronda } = opciones;

  let atacante = opciones.atacante;
  const objetivos = [];
  const resultados = [];
  const eventos = [];

  for (let objetivo of opciones.objetivos) {
    if (!objetivo.vivo) {
      objetivos.push(objetivo);
      continue;
    }

    // ─── Salvación ────────────────────────────────────────────────────────
    let salvado = false;
    let tiradaSalvacion = null;

    if (ataque.salvacion) {
      tiradaSalvacion = _salvacionSimple(
        flujo, objetivo,
        ataque.salvacion.atributo,
        ataque.salvacion.umbral,
      );
      salvado = tiradaSalvacion.exito;
    }

    // ─── Daño ─────────────────────────────────────────────────────────────
    const resultadoDano = Dano.calcularArea(flujo, {
      objetivo,
      notacion: ataque.dano ?? '2d6',
      tipo: ataque.tipo ?? 'fuerza',
      salvado,
    });

    const cambio = Comb.modificarVida(objetivo, -resultadoDano.total);
    objetivo = cambio.combatiente;

    eventos.push({
      tipo: 'dano_area',
      objetivo: objetivo.id,
      cantidad: resultadoDano.total,
      salvado,
    });

    // ─── Estados ──────────────────────────────────────────────────────────
    // Salvar la tirada también evita el estado: es la recompensa completa.
    if (ataque.estado && !salvado) {
      const probabilidad = ataque.estado.probabilidad ?? 1;

      if (flujo.oportunidad(probabilidad)) {
        const r = Estados.aplicar(objetivo, ataque.estado.refId, {
          acumulaciones: ataque.estado.acumulaciones ?? 1,
          origen: atacante.id,
        });

        objetivo = r.combatiente;

        if (r.aplicado) {
          eventos.push({
            tipo: 'estado_aplicado',
            combatiente: objetivo.id,
            estado: ataque.estado.refId,
            narracion: r.narracion,
          });
        }
      }
    }

    objetivos.push(objetivo);
    resultados.push({
      objetivo: objetivo.id,
      nombre: objetivo.nombre,
      dano: resultadoDano,
      salvado,
      tiradaSalvacion,
      cayo: cambio.cayo,
    });
  }

  if (ataque.recarga) {
    atacante = Comb.marcarUso(atacante, ataque.nombre, ronda);
  }

  return { atacante, objetivos, resultados, eventos };
}

/* ═══════════════════════════════════════════════════════════════════════════
   AUXILIARES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Reúne los modificadores de una tirada de ataque.
 *
 * @param {Object} atacante
 * @param {Object} ataque
 * @param {Object} circunstancias
 * @returns {Array<Object>}
 * @private
 */
function _modificadoresAtaque(atacante, ataque, circunstancias) {
  const modificadores = [];

  // Bonificador propio del ataque.
  if (ataque.bonoAtaque) {
    modificadores.push({ fuente: ataque.nombre ?? 'Arma', valor: ataque.bonoAtaque });
  }

  // El jugador usa el modificador de atributo; los enemigos ya lo traen dentro
  // de su bonoAtaque, que viene calculado del bestiario.
  if (atacante.esJugador) {
    const usaDestreza = ataque.alcance === 'distancia';
    const atributo = usaDestreza ? 'destreza' : 'vigor';
    const valor = atacante.atributos?.[atributo] ?? 10;
    const mod = Math.floor((valor - 10) / 2);

    if (mod !== 0) {
      modificadores.push({ fuente: usaDestreza ? 'Destreza' : 'Vigor', valor: mod });
    }

    // El bonificador de nivel.
    const bonoNivel = 2 + Math.floor(((atacante.nivel ?? 1) - 1) / 4);
    modificadores.push({ fuente: 'Experiencia', valor: bonoNivel });
  }

  // Estados.
  const bonoEstados = Comb.bonoAtaqueEstados(atacante);
  if (bonoEstados !== 0) {
    modificadores.push({ fuente: 'Estados', valor: bonoEstados });
  }

  // Circunstancias.
  if (circunstancias.emboscada) {
    modificadores.push({ fuente: 'Emboscada', valor: COMBATE.bonoEmboscada });
  }
  if (circunstancias.rodeado) {
    modificadores.push({ fuente: 'Rodeado', valor: COMBATE.penalizacionRodeado });
  }

  // La jugada escrita: de −2 a +3 según lo que usa y aprovecha (ver Jugada.js).
  // Va con nombre propio para que el parte pueda decir de dónde sale.
  if (circunstancias.creatividad) {
    modificadores.push({ fuente: 'Creativo', valor: circunstancias.creatividad });
  }

  return modificadores;
}

/**
 * Determina ventaja o desventaja en un ataque.
 *
 * @param {Object} atacante
 * @param {Object} objetivo
 * @param {Object} circunstancias
 * @returns {string}
 * @private
 */
function _resolverVentaja(atacante, objetivo, circunstancias) {
  const modsAtacante = Comb.modificadoresDeEstados(atacante);

  let aFavor = Boolean(modsAtacante.ventajaAtaque) || Boolean(circunstancias.ventaja);
  let enContra = Boolean(circunstancias.desventaja);

  // Atacar a alguien derribado o inmovilizado es más fácil.
  if (Estados.tiene(objetivo, 'derribado')) aFavor = true;
  if (Estados.tiene(objetivo, 'paralizado')) aFavor = true;
  if (Estados.tiene(objetivo, 'apresado')) aFavor = true;

  // Atacar cegado es más difícil.
  if (Estados.tiene(atacante, 'cegado')) enContra = true;

  if (aFavor && enContra) return 'ninguna';
  if (aFavor) return 'ventaja';
  if (enContra) return 'desventaja';

  return 'ninguna';
}

/**
 * Tirada de salvación simple.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Object} combatiente
 * @param {string} atributo
 * @param {number|string} umbral
 * @returns {Object}
 * @private
 */
function _salvacionSimple(flujo, combatiente, atributo, umbral) {
  const valor = combatiente.atributos?.[atributo] ?? 10;
  const mod = Math.floor((valor - 10) / 2);

  const modificadores = [{ fuente: atributo, valor: mod }];

  // Los estados que penalizan todas las tiradas también penalizan salvaciones.
  const modsEstados = Comb.modificadoresDeEstados(combatiente);
  if (modsEstados.todasLasTiradas) {
    modificadores.push({ fuente: 'Estados', valor: modsEstados.todasLasTiradas });
  }

  const umbralNumerico = typeof umbral === 'string'
    ? (TIRADAS.umbrales[umbral] ?? TIRADAS.umbralPorDefecto)
    : umbral;

  return tirar(flujo, { modificadores, umbral: umbralNumerico });
}

/**
 * Expone la tirada de salvación para que otros módulos la usen.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Object} combatiente
 * @param {string} atributo
 * @param {number|string} umbral
 * @returns {Object}
 */
export function salvacion(flujo, combatiente, atributo, umbral) {
  return _salvacionSimple(flujo, combatiente, atributo, umbral);
}

export default { RESULTADO, resolver, resolverArea, salvacion };
