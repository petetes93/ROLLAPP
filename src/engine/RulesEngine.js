/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · engine/RulesEngine.js
 * ---------------------------------------------------------------------------
 * Resolución de pruebas del Sistema Núcleo d20.
 *
 * Aquí se cumple la promesa que sostiene todo el proyecto: EL MOTOR TIRA LOS
 * DADOS, EL DIRECTOR NARRA EL RESULTADO. Nunca al revés.
 *
 * La secuencia es siempre la misma:
 *   1. El jugador declara una acción
 *   2. IntentParser deduce qué prueba corresponde
 *   3. Este módulo reúne modificadores, tira y decide
 *   4. El resultado viaja al director, que solo lo viste de palabras
 *
 * Un modelo de lenguaje no puede hacer que aciertes cuando has fallado. Esa
 * separación es lo que hace que las mecánicas de supervivencia, carga y
 * durabilidad signifiquen algo.
 *
 * Dependencias: SystemBase, Dice, balance.config, sistemas de jugador e inventario.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SystemBase } from '../core/SystemBase.js';
import { tirar, umbralPorClave, ajustarUmbral, combinarVentaja } from '../core/Dice.js';
import { TIRADAS, DIRECCION, COMBATE } from '../config/balance.config.js';
import { componerModificadores, determinarVentaja } from '../player/SkillSystem.js';
import { rasgosActivos } from '../player/ClassSystem.js';
import { obtenerHabilidad } from '../data/skills.data.js';
import { saturar } from '../utils/math.js';

/** Eventos publicados por el motor de reglas. */
export const EVENTOS_REGLAS = Object.freeze({
  TIRADA: 'rules:roll',
  CRITICO: 'rules:critical',
  PIFIA: 'rules:fumble',
  DIFICULTAD: 'rules:difficulty:adjust',
});

export class RulesEngine extends SystemBase {
  static nombre = 'rules';
  static dependencias = ['player', 'inventory'];
  static canal = 'engine';

  constructor(contexto) {
    super(contexto);

    /**
     * Historial reciente de resultados, para la dificultad adaptativa.
     * @type {Array<{turno: number, exito: boolean, umbral: number}>}
     * @private
     */
    this._historial = [];
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CICLO DE VIDA
     ═══════════════════════════════════════════════════════════════════════ */

  alIniciar() {
    // Otros componentes pueden pedir una prueba sin conocer el motor: publican
    // un evento con un callback y aquí se resuelve.
    this.escuchar('rules:check', (peticion) => {
      const resultado = this.resolver(peticion);
      peticion.alResolver?.(resultado);
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RESOLUCIÓN DE PRUEBAS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Resuelve una prueba completa.
   *
   * @param {Object} opciones
   * @param {string} [opciones.habilidad] refId de la competencia.
   * @param {string} [opciones.atributo] Atributo, si no hay habilidad.
   * @param {number|string} [opciones.umbral] Número o clave de dificultad.
   * @param {string} [opciones.situacion='neutra']
   * @param {boolean} [opciones.ventajaForzada=false]
   * @param {boolean} [opciones.desventajaForzada=false]
   * @param {boolean} [opciones.aplicarMoral] Por defecto, solo en pruebas sociales.
   * @param {string[]} [opciones.condiciones] Condiciones de la escena.
   * @param {boolean} [opciones.silencioso=false] No publica evento.
   * @returns {Object} Resultado completo y auditable.
   */
  resolver(opciones = {}) {
    const jugador = this.leer('player');
    const habilidad = opciones.habilidad;

    // ─── 1. Umbral ────────────────────────────────────────────────────────
    const umbral = this._resolverUmbral(opciones.umbral);

    // ─── 2. Modificadores ─────────────────────────────────────────────────
    const { modificadores } = this._reunirModificadores(jugador, opciones);

    // ─── 3. Ventaja o desventaja ──────────────────────────────────────────
    const { ventaja, motivos } = this._resolverVentaja(jugador, opciones);

    // ─── 4. Tirada ────────────────────────────────────────────────────────
    const resultado = tirar(this.rng.dados, {
      modificadores,
      umbral,
      ventaja,
    });

    // ─── 5. Enriquecimiento ───────────────────────────────────────────────
    resultado.habilidad = habilidad ?? null;
    resultado.nombreHabilidad = habilidad ? obtenerHabilidad(habilidad)?.nombre : null;
    resultado.motivosVentaja = motivos;
    resultado.turno = this.leer('meta.turno', 0);

    // ─── 6. Registro ──────────────────────────────────────────────────────
    this._registrar(resultado);

    if (!opciones.silencioso) {
      this.emitir(EVENTOS_REGLAS.TIRADA, resultado);
      if (resultado.critico) this.emitir(EVENTOS_REGLAS.CRITICO, resultado);
      if (resultado.pifia) this.emitir(EVENTOS_REGLAS.PIFIA, resultado);
    }

    // Estadísticas de partida.
    if (resultado.critico || resultado.pifia) {
      this.despachar('hazanas/registrar', {
        clave: resultado.critico ? 'criticos' : 'pifias',
        delta: 1,
      });
    }

    return resultado;
  }

  /**
   * Resuelve el umbral, sea clave textual o número.
   *
   * Un número arbitrario se redondea al escalón oficial más cercano. Es un
   * blindaje contra el director: si pide dificultad 17, se convierte en 15 o 20.
   *
   * @param {number|string|undefined} valor
   * @returns {number}
   * @private
   */
  _resolverUmbral(valor) {
    if (valor === undefined || valor === null) return TIRADAS.umbralPorDefecto;

    let base = typeof valor === 'string' ? umbralPorClave(valor) : ajustarUmbral(Number(valor));

    // La dificultad adaptativa desplaza el umbral, no las tiradas. Así el
    // jugador nunca ve números falsos: la dificultad cambia, no el dado.
    if (this.leer('settings.dificultadAdaptativa', true)) {
      const ajuste = this.leer('ai.ajusteDificultad', 1);
      const preajuste = DIRECCION.preajustes[this.leer('settings.dificultad', 'equilibrado')] ?? 1;
      base = Math.round(base * ajuste * preajuste);
    }

    return saturar(base, 5, 35);
  }

  /**
   * Reúne todos los modificadores aplicables.
   *
   * Punto único donde se decide qué influye en una tirada. El desglose viaja
   * hasta el tooltip: el jugador ve exactamente por qué falló.
   *
   * @param {Object} jugador
   * @param {Object} opciones
   * @returns {{modificadores: Array<Object>, total: number}}
   * @private
   */
  _reunirModificadores(jugador, opciones) {
    const habilidad = opciones.habilidad;

    // La moral solo pesa en pruebas sociales y de temple: estar desanimado no
    // te hace peor trepando.
    const aplicarMoral = opciones.aplicarMoral ?? this._esPruebaAnimica(habilidad);

    // — Base: atributo, competencia, supervivencia —
    const { modificadores } = componerModificadores(jugador, {
      habilidad,
      atributo: opciones.atributo,
      situacion: opciones.situacion ?? 'neutra',
      aplicarMoral,
      usaNivel: opciones.usaNivel ?? false,
    });

    // — Equipo —
    const inventario = this.sistema('inventory');
    if (inventario && habilidad) {
      const bonos = inventario.bonificadores();
      const bonoEquipo = bonos.habilidades?.[habilidad] ?? 0;
      if (bonoEquipo !== 0) {
        modificadores.push({ fuente: 'Equipo', valor: bonoEquipo });
      }
    }

    // — Carga —
    if (inventario) {
      const carga = inventario.penalizacionCarga();
      modificadores.push(...carga.desglose);
    }

    // — Clima, en pruebas que dependen de ver o de moverse —
    const modClima = this._modificadorClima(habilidad);
    if (modClima.valor !== 0) modificadores.push(modClima);

    // — Rasgos que otorgan bonificadores fijos —
    const bonoJuramento = this._bonoJuramento(jugador);
    if (bonoJuramento !== 0) {
      modificadores.push({ fuente: 'Juramento', valor: bonoJuramento });
    }

    // — Extra declarado por el llamante —
    if (opciones.bonoExtra) {
      modificadores.push({ fuente: opciones.fuenteExtra ?? 'Circunstancia', valor: opciones.bonoExtra });
    }

    const total = modificadores.reduce((a, m) => a + m.valor, 0);
    return { modificadores, total };
  }

  /**
   * Determina si una prueba depende del ánimo.
   * @param {string} habilidad
   * @returns {boolean}
   * @private
   */
  _esPruebaAnimica(habilidad) {
    if (!habilidad) return false;
    const h = obtenerHabilidad(habilidad);
    return h?.atributo === 'carisma' || h?.atributo === 'temple';
  }

  /**
   * Modificador por clima, aplicable solo a las pruebas afectadas.
   * @param {string} habilidad
   * @returns {{fuente: string, valor: number}}
   * @private
   */
  _modificadorClima(habilidad) {
    const clima = this.leer('world.clima.actual', 'despejado');

    const efectos = {
      lluvia: { percepcion: -1, sigilo: 1 },
      tormenta: { percepcion: -3, sigilo: 2, atletismo: -2 },
      niebla: { percepcion: -4, sigilo: 3 },
      nieve: { percepcion: -2, supervivencia: -1, atletismo: -1 },
      ventisca: { percepcion: -5, atletismo: -3, supervivencia: -2 },
      calorSofocante: { resistencia: -2, atletismo: -2 },
    };

    const valor = efectos[clima]?.[habilidad] ?? 0;

    const nombres = {
      lluvia: 'Lluvia', tormenta: 'Tormenta', niebla: 'Niebla',
      nieve: 'Nieve', ventisca: 'Ventisca', calorSofocante: 'Calor',
    };

    return { fuente: nombres[clima] ?? 'Clima', valor };
  }

  /**
   * Bonificador o penalización del juramento del Custodio.
   * @param {Object} jugador
   * @returns {number}
   * @private
   */
  _bonoJuramento(jugador) {
    const rasgo = rasgosActivos(jugador).find((r) => r.efecto?.tipo === 'bonoJuramento');
    if (!rasgo) return 0;

    const roto = jugador.flags?.juramento_roto === true;

    // El Penitente invierte la penalización: su culpa es su fuerza.
    const invierte = rasgosActivos(jugador).some((r) => r.efecto?.tipo === 'invertirPenalizacion');
    if (roto && invierte) return 4;

    return roto ? (rasgo.efecto.roto ?? -2) : (rasgo.efecto.cumpliendo ?? 1);
  }

  /**
   * Determina ventaja o desventaja reuniendo todas las fuentes.
   * @param {Object} jugador
   * @param {Object} opciones
   * @returns {{ventaja: string, motivos: string[]}}
   * @private
   */
  _resolverVentaja(jugador, opciones) {
    const condiciones = [...(opciones.condiciones ?? [])];

    // El terreno natural activa rasgos como el Paso callado del Sombracorteza.
    const terreno = this.leer('world.terreno', 'camino');
    if (['bosque', 'montana', 'pantano', 'desierto'].includes(terreno)) {
      condiciones.push('terrenoNatural');
    }
    if (terreno === 'ciudad') condiciones.push('multitud');

    const { ventaja, motivos } = determinarVentaja(jugador, {
      habilidad: opciones.habilidad,
      rasgos: rasgosActivos(jugador),
      condiciones,
      ventajaForzada: opciones.ventajaForzada,
      desventajaForzada: opciones.desventajaForzada,
    });

    // La oscuridad da desventaja en percepción, salvo con visión nocturna.
    if (opciones.habilidad === 'percepcion') {
      const esDeNoche = ['noche', 'madrugada'].includes(this.leer('world.tiempo.franja'));
      const veEnLaOscuridad = rasgosActivos(jugador).some((r) => r.efecto?.tipo === 'visionOscuridad');

      if (esDeNoche && !veEnLaOscuridad) {
        return {
          ventaja: combinarVentaja(ventaja === 'ventaja', true),
          motivos: [...motivos, 'Oscuridad'],
        };
      }
    }

    return { ventaja, motivos };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PRUEBAS ESPECÍFICAS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Prueba derivada de una intención interpretada.
   *
   * Es el camino habitual: TurnResolver pasa lo que dedujo IntentParser y aquí
   * se convierte en una tirada.
   *
   * @param {Object} intencion
   * @param {Object} [contexto]
   * @returns {Object|null} null si la acción no requiere tirada.
   */
  resolverIntencion(intencion, contexto = {}) {
    if (!intencion?.requiereTirada && !intencion?.habilidad) return null;

    // Una intención dudosa se resuelve con una dificultad algo mayor: el motor
    // no está seguro de qué pretendía el jugador, y eso tiene un coste.
    const penalizacionAmbiguedad = intencion.confianza < 0.4 ? -1 : 0;

    return this.resolver({
      habilidad: intencion.habilidad,
      umbral: contexto.umbral ?? intencion.umbral,
      situacion: contexto.situacion ?? 'neutra',
      bonoExtra: penalizacionAmbiguedad,
      fuenteExtra: penalizacionAmbiguedad ? 'Acción confusa' : null,
      condiciones: contexto.condiciones,
    });
  }

  /**
   * Prueba de ataque. Usa el arma equipada, no una competencia.
   *
   * @param {Object} [opciones]
   * @param {number} [opciones.defensaObjetivo]
   * @param {boolean} [opciones.emboscada=false]
   * @param {boolean} [opciones.rodeado=false]
   * @returns {Object}
   */
  resolverAtaque(opciones = {}) {
    const inventario = this.sistema('inventory');
    const arma = inventario?.armaActiva() ?? { stats: {} };

    const modificadoresExtra = [];

    const bonoArma = arma.stats?.bonoAtaque ?? 0;
    if (bonoArma !== 0) {
      modificadoresExtra.push({ fuente: arma.objeto?.nombre ?? 'Arma', valor: bonoArma });
    }

    if (opciones.emboscada) {
      modificadoresExtra.push({ fuente: 'Emboscada', valor: COMBATE.bonoEmboscada });
    }
    if (opciones.rodeado) {
      modificadoresExtra.push({ fuente: 'Rodeado', valor: COMBATE.penalizacionRodeado });
    }

    const jugador = this.leer('player');

    // El atributo del ataque depende del arma: las de distancia y las precisas
    // usan Destreza; el resto, Vigor.
    const propiedades = arma.stats?.propiedades ?? [];
    const usaDestreza = propiedades.includes('distancia')
      || propiedades.includes('precisa')
      || propiedades.includes('ligera');

    const { modificadores } = this._reunirModificadores(jugador, {
      atributo: usaDestreza ? 'destreza' : 'vigor',
      usaNivel: true,
      situacion: opciones.situacion ?? 'neutra',
    });

    modificadores.push(...modificadoresExtra);

    const resultado = tirar(this.rng.combate, {
      modificadores,
      umbral: opciones.defensaObjetivo ?? COMBATE.defensaBase,
      ventaja: opciones.ventaja ?? 'ninguna',
    });

    resultado.esAtaque = true;
    resultado.arma = arma.objeto?.nombre ?? 'a puño limpio';
    resultado.desarmado = arma.desarmado ?? false;

    // Ciertos afijos amplían el rango de crítico.
    const umbralCritico = arma.stats?.umbralCritico ?? TIRADAS.critico;
    if (resultado.natural >= umbralCritico) resultado.critico = true;

    this._registrar(resultado);
    if (!opciones.silencioso) this.emitir(EVENTOS_REGLAS.TIRADA, resultado);

    return resultado;
  }

  /**
   * Prueba de resistencia contra un efecto.
   *
   * @param {string} atributo
   * @param {number|string} umbral
   * @param {Object} [opciones]
   * @returns {Object}
   */
  resolverResistencia(atributo, umbral, opciones = {}) {
    return this.resolver({
      atributo,
      umbral,
      usaNivel: true,
      aplicarMoral: atributo === 'temple',
      ...opciones,
    });
  }

  /**
   * Prueba de iniciativa.
   * @returns {Object}
   */
  resolverIniciativa() {
    const jugador = this.leer('player');

    const { modificadores } = componerModificadores(jugador, { atributo: 'destreza' });

    return tirar(this.rng.combate, { modificadores, umbral: null });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     DIFICULTAD ADAPTATIVA
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Registra un resultado para el análisis de dificultad.
   * @param {Object} resultado
   * @private
   */
  _registrar(resultado) {
    if (resultado.umbral === null) return;

    this._historial.push({
      turno: resultado.turno ?? this.leer('meta.turno', 0),
      exito: resultado.exito,
      umbral: resultado.umbral,
    });

    if (this._historial.length > DIRECCION.ventanaAnalisis * 2) {
      this._historial = this._historial.slice(-DIRECCION.ventanaAnalisis);
    }
  }

  /**
   * Revisa y ajusta la dificultad según cómo le está yendo al jugador.
   *
   * Se invoca cada cierto número de turnos. El ajuste es lento y acotado: la
   * idea es corregir una racha, no anular la suerte.
   *
   * @returns {{ajustado: boolean, anterior: number, nuevo: number, tasa: number}}
   */
  revisarDificultad() {
    if (!this.leer('settings.dificultadAdaptativa', true)) {
      return { ajustado: false, anterior: 1, nuevo: 1, tasa: 0 };
    }

    const ventana = this._historial.slice(-DIRECCION.ventanaAnalisis);
    if (ventana.length < DIRECCION.ventanaAnalisis) {
      return { ajustado: false, anterior: 1, nuevo: 1, tasa: 0 };
    }

    const exitos = ventana.filter((r) => r.exito).length;
    const tasa = exitos / ventana.length;

    const actual = this.leer('ai.ajusteDificultad', 1);
    let nuevo = actual;

    if (tasa >= DIRECCION.umbralSubida) {
      nuevo = saturar(actual + DIRECCION.pasoAjuste, DIRECCION.ajusteMin, DIRECCION.ajusteMax);
    } else if (tasa <= DIRECCION.umbralBajada) {
      nuevo = saturar(actual - DIRECCION.pasoAjuste, DIRECCION.ajusteMin, DIRECCION.ajusteMax);
    }

    if (nuevo === actual) return { ajustado: false, anterior: actual, nuevo, tasa };

    this.store.fijar('ai.ajusteDificultad', nuevo);

    this.emitir(EVENTOS_REGLAS.DIFICULTAD, {
      anterior: actual,
      nuevo,
      tasa,
      direccion: nuevo > actual ? 'sube' : 'baja',
    });

    this.log.debug(`dificultad ajustada: ${actual.toFixed(2)} → ${nuevo.toFixed(2)} (tasa de éxito ${(tasa * 100).toFixed(0)} %)`);

    return { ajustado: true, anterior: actual, nuevo, tasa };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONSULTAS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Previsualiza una prueba sin tirar.
   *
   * Permite mostrar al jugador contra qué se enfrenta antes de decidir, si algún
   * día se quiere esa mecánica. También sirve para depurar el equilibrio.
   *
   * @param {Object} opciones
   * @returns {Object}
   */
  previsualizar(opciones) {
    const jugador = this.leer('player');
    const umbral = this._resolverUmbral(opciones.umbral);
    const { modificadores, total } = this._reunirModificadores(jugador, opciones);
    const { ventaja } = this._resolverVentaja(jugador, opciones);

    // Probabilidad de éxito con un d20: (21 - necesario) / 20.
    const necesario = saturar(umbral - total, 1, 20);
    let probabilidad = (21 - necesario) / 20;

    // Con ventaja, la probabilidad de fallar se eleva al cuadrado.
    if (ventaja === 'ventaja') probabilidad = 1 - Math.pow(1 - probabilidad, 2);
    if (ventaja === 'desventaja') probabilidad = Math.pow(probabilidad, 2);

    return {
      umbral,
      modificador: total,
      desglose: modificadores,
      ventaja,
      necesario,
      probabilidad: Math.round(probabilidad * 100) / 100,
    };
  }

  /**
   * Estado del motor de reglas, para depuración.
   * @returns {Object}
   */
  inspeccionar() {
    const ventana = this._historial.slice(-DIRECCION.ventanaAnalisis);
    const exitos = ventana.filter((r) => r.exito).length;

    return {
      tiradasRegistradas: this._historial.length,
      tasaExitoReciente: ventana.length ? exitos / ventana.length : null,
      ajusteDificultad: this.leer('ai.ajusteDificultad', 1),
      preajuste: this.leer('settings.dificultad', 'equilibrado'),
    };
  }
}

export default RulesEngine;
