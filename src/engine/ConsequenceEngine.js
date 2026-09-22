/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · engine/ConsequenceEngine.js
 * ---------------------------------------------------------------------------
 * Consecuencias de los actos.
 *
 * Observa lo que ocurre y produce repercusiones que el director no ha
 * declarado. Dos clases:
 *
 *   · INMEDIATAS — deriva del alineamiento, reputación, actitud de los testigos
 *   · DIFERIDAS — cosas que volverán más tarde: una deuda, un rencor, alguien
 *     que te vio hacer algo
 *
 * Las diferidas son lo que hace que el mundo tenga memoria. Robar en un pueblo
 * y volver treinta turnos después debería tener consecuencias, y no porque el
 * director se acuerde: porque el motor lo tenía apuntado.
 *
 * PRINCIPIO DE DETECCIÓN: se analiza la INTENCIÓN INTERPRETADA y el RESULTADO
 * DE LA TIRADA, nunca el texto narrativo. Analizar prosa produce falsos
 * positivos constantes: «no robaste nada» contiene «robaste».
 *
 * Dependencias: SystemBase, Alignment, sistemas sociales.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SystemBase } from '../core/SystemBase.js';
import { desplazar, etiquetaMoral } from '../player/Alignment.js';

/** Eventos publicados. */
export const EVENTOS_CONSECUENCIA = Object.freeze({
  MORAL: 'consequence:alignment',
  DIFERIDA: 'consequence:deferred',
  DISPARADA: 'consequence:triggered',
});

/* ═══════════════════════════════════════════════════════════════════════════
   CATÁLOGO DE ACTOS
   ---------------------------------------------------------------------------
   Cada acto declara su deriva moral y si deja rastro. Está en datos para poder
   equilibrarlo de un vistazo.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Acto
 * @property {number} [moral] Deriva en el eje moral.
 * @property {number} [orden] Deriva en el eje de orden.
 * @property {string} texto Cómo se describe.
 * @property {boolean} [dejaRastro] Si genera una consecuencia diferida.
 * @property {number} [gravedad] 1-3, para la consecuencia diferida.
 */

/** @type {Record<string, Acto>} */
export const ACTOS = Object.freeze({
  // ─── Contra personas ──────────────────────────────────────────────────
  matar_inocente: { moral: -25, orden: -10, texto: 'mató a alguien inocente', dejaRastro: true, gravedad: 3 },
  matar_hostil: { moral: -2, orden: 0, texto: 'mató a un enemigo' },
  perdonar_vida: { moral: 15, orden: 0, texto: 'perdonó una vida' },
  salvar_vida: { moral: 20, orden: 5, texto: 'salvó una vida' },
  ayudar_desinteresado: { moral: 12, orden: 3, texto: 'ayudó sin pedir nada' },

  // ─── Propiedad ────────────────────────────────────────────────────────
  robar: { moral: -10, orden: -12, texto: 'robó', dejaRastro: true, gravedad: 2 },
  robar_necesitado: { moral: -18, orden: -12, texto: 'robó a quien no tenía nada', dejaRastro: true, gravedad: 2 },
  devolver_perdido: { moral: 10, orden: 8, texto: 'devolvió algo perdido' },
  pagar_de_mas: { moral: 6, orden: 4, texto: 'pagó más de lo debido' },

  // ─── Palabra ──────────────────────────────────────────────────────────
  cumplir_promesa: { moral: 8, orden: 15, texto: 'cumplió su palabra' },
  romper_promesa: { moral: -12, orden: -20, texto: 'rompió su palabra', dejaRastro: true, gravedad: 2 },
  mentir: { moral: -5, orden: -8, texto: 'mintió' },
  decir_verdad_costosa: { moral: 10, orden: 12, texto: 'dijo la verdad aunque le perjudicaba' },

  // ─── Autoridad ────────────────────────────────────────────────────────
  obedecer_ley: { moral: 2, orden: 10, texto: 'respetó la ley' },
  quebrantar_ley: { moral: 0, orden: -15, texto: 'quebrantó la ley', dejaRastro: true, gravedad: 1 },
  sobornar: { moral: -4, orden: -10, texto: 'sobornó a alguien' },
  denunciar: { moral: 3, orden: 12, texto: 'denunció un delito', dejaRastro: true, gravedad: 1 },

  // ─── Violencia ────────────────────────────────────────────────────────
  amenazar: { moral: -8, orden: -5, texto: 'amenazó a alguien', dejaRastro: true, gravedad: 1 },
  torturar: { moral: -30, orden: -10, texto: 'torturó a alguien', dejaRastro: true, gravedad: 3 },
  defender_debil: { moral: 18, orden: 8, texto: 'defendió a quien no podía defenderse' },

  // ─── Traición ─────────────────────────────────────────────────────────
  traicionar: { moral: -22, orden: -25, texto: 'traicionó a alguien', dejaRastro: true, gravedad: 3 },
  lealtad_costosa: { moral: 15, orden: 20, texto: 'fue leal cuando le costaba' },
});

export class ConsequenceEngine extends SystemBase {
  static nombre = 'consequences';
  static dependencias = ['player'];
  static canal = 'engine';

  constructor(contexto) {
    super(contexto);

    /**
     * Consecuencias pendientes de dispararse.
     * @type {Array<Object>}
     * @private
     */
    this._diferidas = [];
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CICLO DE VIDA
     ═══════════════════════════════════════════════════════════════════════ */

  alIniciar() {
    // Se observa lo que ocurre, no lo que se narra.
    this.escuchar('turn:resolved', (resumen) => this._analizarTurno(resumen));
    this.escuchar('combat:enemy:killed', (datos) => this._alMatar(datos));
    this.escuchar('npc:commitment', (datos) => this._alPrometer(datos));
    this.escuchar('quests:failed', (datos) => this._alFallarMision(datos));

    // El director puede declarar un acto explícitamente.
    this.escuchar('consequence:declare', ({ acto, contexto }) => {
      this.registrar(acto, contexto);
    });
  }

  /**
   * Cada turno se comprueban las consecuencias diferidas.
   * @param {Object} contexto
   */
  alTurno(contexto) {
    this._revisarDiferidas(contexto.turno);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     DETECCIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Analiza un turno resuelto en busca de actos con consecuencia.
   *
   * Se apoya en la intención y la tirada, nunca en el texto: analizar prosa
   * produce falsos positivos constantes.
   *
   * @param {Object} resumen
   * @private
   */
  _analizarTurno(resumen) {
    const intencion = resumen?.intencion;
    if (!intencion) return;

    const tirada = resumen.tirada;

    // ─── Mapa de intención a acto ───────────────────────────────────────
    const mapa = {
      // Mentir solo cuenta si el jugador se salió con la suya: si falla, lo
      // que hay es un intento fallido, y eso ya tiene su propio castigo.
      deceive: { acto: 'mentir', requiereExito: true },
      intimidate: { acto: 'amenazar', requiereExito: false },
    };

    const entrada = mapa[intencion.tipo];
    if (!entrada) return;

    if (entrada.requiereExito && !tirada?.exito) return;

    this.registrar(entrada.acto, {
      turno: resumen.turno,
      objetivo: intencion.objetivo,
    });
  }

  /**
   * Matar tiene consecuencias distintas según a quién.
   * @private
   */
  _alMatar(datos) {
    // Un enemigo hostil en combate no es un inocente.
    const acto = datos.faccion && datos.tipo === 'humanoide'
      ? 'matar_hostil'
      : 'matar_hostil';

    this.registrar(acto, { turno: this.leer('meta.turno', 0), objetivo: datos.nombre });
  }

  /** @private */
  _alPrometer(datos) {
    // Prometer no tiene consecuencia moral: cumplir o romper, sí. Se anota como
    // diferida para comprobarlo más adelante.
    this.diferir({
      tipo: 'promesa_pendiente',
      texto: datos.texto,
      relacionadoCon: datos.refId,
      turnoLimite: this.leer('meta.turno', 0) + 40,
      gravedad: 2,
    });
  }

  /** @private */
  _alFallarMision(datos) {
    this.registrar('romper_promesa', {
      turno: this.leer('meta.turno', 0),
      detalle: datos.titulo,
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     REGISTRO DE ACTOS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Registra un acto y aplica sus consecuencias.
   *
   * @param {string} clave
   * @param {Object} [contexto]
   * @returns {{aplicado: boolean, deriva: Object|null}}
   */
  registrar(clave, contexto = {}) {
    const acto = ACTOS[clave];
    if (!acto) return { aplicado: false, deriva: null };

    // ─── Deriva moral ───────────────────────────────────────────────────
    const jugador = this.leer('player');
    const alineamiento = jugador.alineamiento ?? { moral: 0, orden: 0 };

    const resultado = derivar(alineamiento, {
      bondad: acto.moral ?? 0,
      orden: acto.orden ?? 0,
    });

    if (resultado.cambio) {
      this.despachar('player/alineamiento', { alineamiento: resultado.alineamiento });

      this.emitir(EVENTOS_CONSECUENCIA.MORAL, {
        acto: clave,
        texto: acto.texto,
        deriva: { moral: acto.moral, orden: acto.orden },
        nuevo: resultado.alineamiento,
        cambioEtiqueta: resultado.cambioEtiqueta,
      });

      // Un cambio de etiqueta moral es narrativamente relevante.
      if (resultado.cambioEtiqueta) {
        this.emitir('memory:remember', {
          texto: `Su forma de actuar ha cambiado: ahora es ${resultado.etiqueta}.`,
          peso: 3,
        });
      }
    }

    // ─── Rastro ─────────────────────────────────────────────────────────
    if (acto.dejaRastro) {
      this._dejarRastro(clave, acto, contexto);
    }

    // ─── Memoria ────────────────────────────────────────────────────────
    // Los actos graves se recuerdan aunque no dejen rastro diferido.
    if (Math.abs(acto.moral ?? 0) >= 15) {
      this.emitir('memory:remember', {
        texto: `El personaje ${acto.texto}${contexto.objetivo ? ` (${contexto.objetivo})` : ''}.`,
        peso: 3,
      });
    }

    return { aplicado: true, deriva: resultado.alineamiento };
  }

  /**
   * Registra que un acto ha dejado rastro.
   *
   * Que haya testigos determina si el acto tendrá consecuencias sociales: robar
   * sin que nadie lo vea es distinto de robar delante del pueblo.
   *
   * @private
   */
  _dejarRastro(clave, acto, contexto) {
    const testigos = this.leer('npcs.presentes', []);
    const lugar = this.leer('world.ubicacion');

    // Sin testigos, el rastro es más débil pero no nulo: alguien puede
    // descubrirlo después.
    const gravedad = testigos.length ? acto.gravedad : Math.max(1, acto.gravedad - 1);

    this.diferir({
      tipo: 'rastro',
      acto: clave,
      texto: acto.texto,
      lugar,
      testigos: [...testigos],
      gravedad,
      turnoLimite: this.leer('meta.turno', 0) + 60,
      detalle: contexto.detalle ?? contexto.objetivo ?? null,
    });

    // Los testigos presentes reaccionan ya.
    if (testigos.length) {
      const relaciones = this.sistema('relationships');

      const mapaAcciones = {
        robar: 'robar',
        amenazar: 'amenazar',
        traicionar: 'traicionar',
        matar_inocente: 'matar_conocido',
        romper_promesa: 'romper_promesa',
      };

      const accion = mapaAcciones[clave];

      if (accion) {
        for (const refId of testigos) {
          relaciones?.aplicarAccion(refId, accion, { detalle: contexto.detalle });
        }
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONSECUENCIAS DIFERIDAS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Aparta una consecuencia para más adelante.
   *
   * @param {Object} datos
   */
  diferir(datos) {
    this._diferidas.push({
      ...datos,
      turnoOrigen: this.leer('meta.turno', 0),
      disparada: false,
    });

    // Se acotan: cien rastros pendientes no aportan más que veinte.
    if (this._diferidas.length > 20) {
      this._diferidas = this._diferidas
        .filter((d) => !d.disparada)
        .slice(-20);
    }

    this.emitir(EVENTOS_CONSECUENCIA.DIFERIDA, { tipo: datos.tipo, gravedad: datos.gravedad });
  }

  /**
   * Comprueba si alguna consecuencia diferida debe dispararse.
   *
   * @param {number} turno
   * @private
   */
  _revisarDiferidas(turno) {
    const pendientes = this._diferidas.filter((d) => !d.disparada);
    if (!pendientes.length) return;

    const lugar = this.leer('world.ubicacion');
    const flujo = this.rng.flujo('narrativa');

    for (const diferida of pendientes) {
      // ─── Caducidad ────────────────────────────────────────────────────
      if (turno > diferida.turnoLimite) {
        diferida.disparada = true;
        continue;
      }

      // ─── Volver al lugar del acto ─────────────────────────────────────
      // Es el disparador más natural: volver donde robaste.
      if (diferida.lugar && diferida.lugar === lugar) {
        const turnosTranscurridos = turno - diferida.turnoOrigen;

        // No inmediatamente: hace falta que haya pasado algo de tiempo.
        if (turnosTranscurridos < 8) continue;

        const probabilidad = Math.min(0.5, 0.15 * diferida.gravedad);

        if (flujo.oportunidad(probabilidad)) {
          this._disparar(diferida, 'volviste al lugar');
          continue;
        }
      }

      // ─── Promesa a punto de caducar ───────────────────────────────────
      if (diferida.tipo === 'promesa_pendiente') {
        const restantes = diferida.turnoLimite - turno;

        if (restantes === 10) {
          this.emitir('memory:context', {
            texto: `PENDIENTE: el personaje prometió «${diferida.texto}» y lleva tiempo sin cumplirlo. Alguien podría recordárselo.`,
            temporal: true,
          });
        }
      }
    }
  }

  /**
   * Dispara una consecuencia diferida.
   *
   * No la resuelve: se la pasa al director como material narrativo. El motor
   * sabe QUÉ debe volver; el director sabe CÓMO contarlo.
   *
   * @private
   */
  _disparar(diferida, motivo) {
    diferida.disparada = true;

    this.emitir(EVENTOS_CONSECUENCIA.DISPARADA, {
      tipo: diferida.tipo,
      acto: diferida.acto,
      gravedad: diferida.gravedad,
      motivo,
    });

    const testigos = diferida.testigos?.length
      ? 'Hubo testigos.'
      : 'Nadie lo vio, pero alguien pudo atar cabos.';

    this.emitir('memory:context', {
      texto: `CONSECUENCIA PENDIENTE: hace tiempo el personaje ${diferida.texto}${diferida.detalle ? ` (${diferida.detalle})` : ''} aquí mismo. ${testigos} Es buen momento para que eso vuelva, si encaja.`,
      temporal: true,
    });

    this.log.debug(`consecuencia disparada: ${diferida.acto} (${motivo})`);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONSULTAS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Consecuencias pendientes.
   * @returns {Array<Object>}
   */
  pendientes() {
    return this._diferidas.filter((d) => !d.disparada);
  }

  /**
   * Contexto de consecuencias para el director.
   *
   * Solo lo que está a punto de vencer: enumerar todo lo pendiente en cada
   * turno gastaría contexto sin aportar.
   *
   * @returns {string}
   */
  paraDirector() {
    const turno = this.leer('meta.turno', 0);
    const lugar = this.leer('world.ubicacion');

    const relevantes = this.pendientes().filter((d) =>
      d.lugar === lugar || (d.turnoLimite - turno) <= 12);

    if (!relevantes.length) return '';

    const lineas = relevantes.slice(0, 3).map((d) =>
      `· ${d.texto}${d.detalle ? ` (${d.detalle})` : ''}`);

    return `ASUNTOS SIN CERRAR:\n${lineas.join('\n')}`;
  }

  /** @returns {Object} */
  serializar() {
    return { diferidas: this._diferidas };
  }

  /** @param {Object} datos */
  restaurar(datos) {
    this._diferidas = datos?.diferidas ?? [];
  }

  /** @returns {Object} */
  inspeccionar() {
    return {
      pendientes: this.pendientes().length,
      alineamiento: this.leer('player.alineamiento'),
      detalle: this.pendientes().map((d) => ({
        acto: d.acto ?? d.tipo,
        gravedad: d.gravedad,
        caducaEn: d.turnoLimite - this.leer('meta.turno', 0),
      })),
    };
  }
}

export default ConsequenceEngine;
