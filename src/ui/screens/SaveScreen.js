/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · ui/screens/SaveScreen.js
 * ---------------------------------------------------------------------------
 * Pantalla de partidas.
 *
 * Sirve para guardar, cargar, borrar, exportar e importar. Y para una cosa más
 * que importa igual: explicar con claridad qué se está escribiendo y dónde.
 *
 * Tres decisiones de diseño:
 *
 *   · EL ESTADO DEL GUARDADO SE EXPLICA ARRIBA. Si está desactivado, el jugador
 *     lo lee antes de intentar guardar y descubrir que no puede.
 *
 *   · BORRAR Y SOBRESCRIBIR PIDEN CONFIRMACIÓN. Cargar, no. Cargar es
 *     reversible si tienes otra ranura; borrar nunca lo es.
 *
 *   · LA EXPORTACIÓN A ARCHIVO SIEMPRE ESTÁ DISPONIBLE. Funciona sin permiso de
 *     almacenamiento porque no escribe en el navegador: descarga un archivo. Es
 *     la vía que respeta la restricción original del proyecto.
 *
 * Dependencias: Component, DOM, SaveManager.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Component } from '../Component.js';
import { h, icono, vaciar, visible, texto as fijarTexto, clase } from '../DOM.js';
import { PANTALLAS, TEXTOS } from '../../config/ui.config.js';
import { fecha as formatearFecha } from '../../utils/format.js';

export class SaveScreen extends Component {
  static nombre = 'partidas';
  static rama = '';

  constructor(contexto, opciones) {
    super(contexto, opciones);

    /** 'guardar' | 'cargar' — determina qué hacen las ranuras. @private */
    this._modo = opciones?.modo ?? 'cargar';
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */

  /** @returns {Node} @protected */
  render() {
    const saves = this._saves();
    const ranuras = saves?.listar() ?? [];

    return h('div.screen.screen--centrada', { ref: this.ref('raiz') },
      h('div.screen__caja', { style: { maxWidth: '46rem' } },

        // ─── Cabecera ─────────────────────────────────────────────────────
        h('div.row.row--between', {},
          h('h1.screen__titulo', {
            text: this._modo === 'guardar' ? 'Guardar partida' : 'Cargar partida',
          }),

          h('button.btn.btn--ghost.btn--icon', {
            type: 'button',
            attrs: { 'aria-label': 'Volver' },
            onClick: () => this._volver(),
          }, icono('cerrar')),
        ),

        // ─── Estado del almacenamiento ────────────────────────────────────
        this._avisoAlmacenamiento(saves),

        // ─── Ranuras ──────────────────────────────────────────────────────
        h('div.stack.stack--sm', { ref: this.ref('ranuras') },
          ...ranuras.map((r) => this._ficha(r)),
        ),

        h('div.filo', { style: { margin: 'var(--sp-4) 0' } }),

        // ─── Archivo ──────────────────────────────────────────────────────
        this._bloqueArchivo(),

        // ─── Espacio y limpieza ───────────────────────────────────────────
        this._bloqueEspacio(saves),
      ),
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
     AVISOS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Explica el estado del almacenamiento.
   *
   * Va arriba y siempre visible: descubrir que no puedes guardar después de
   * intentarlo es la peor forma de enterarse.
   *
   * @private
   */
  _avisoAlmacenamiento(saves) {
    if (saves?.activo) {
      return h('p.settings__note', {
        ref: this.ref('avisoAlmacen'),
        style: { color: 'var(--c-texto-tenue)' },
        text: 'Las partidas se guardan en el almacenamiento de este navegador. No salen de tu equipo.',
      });
    }

    return h('div', {
      ref: this.ref('avisoAlmacen'),
      style: {
        padding: 'var(--sp-3)',
        margin: 'var(--sp-3) 0',
        background: 'var(--c-aviso-tenue)',
        border: 'var(--bw-hair) solid var(--c-aviso)',
        borderRadius: 'var(--r-sm)',
      },
    },
      h('p', {
        style: { fontSize: 'var(--f-xs)', color: 'var(--c-aviso)' },
        text: saves?.motivoInactivo ?? 'El guardado no está disponible.',
      }),

      // Si es cuestión de permiso, se ofrece activarlo aquí mismo.
      !this.leer('settings.persistencia', false)
        ? h('button.btn.btn--sm', {
            type: 'button',
            style: { marginTop: 'var(--sp-2)' },
            onClick: () => this._activarGuardado(),
          }, h('span', { text: 'Activar el guardado' }))
        : null,

      h('p', {
        style: { fontSize: 'var(--f-2xs)', color: 'var(--c-texto-tenue)', marginTop: 'var(--sp-2)' },
        text: 'Aunque no lo actives, puedes exportar la partida a un archivo.',
      }),
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RANURAS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Ficha de una ranura, vacía u ocupada.
   * @private
   */
  _ficha(r) {
    if (r.vacia) return this._fichaVacia(r);
    return this._fichaOcupada(r);
  }

  /** @private */
  _fichaVacia(r) {
    const puedeGuardar = this._modo === 'guardar' && !r.esAuto && this._saves()?.activo;

    return h('div', {
      dataset: { ranura: r.ranura },
      style: {
        padding: 'var(--sp-3)',
        background: 'var(--c-superficie-2)',
        border: 'var(--bw-hair) dashed var(--c-borde)',
        borderRadius: 'var(--r-sm)',
        opacity: puedeGuardar ? '1' : '0.5',
        cursor: puedeGuardar ? 'pointer' : 'default',
      },
      onClick: puedeGuardar ? () => this._guardar(r.ranura) : null,
    },
      h('div.row.row--between', {},
        h('span.eyebrow', {
          text: r.esAuto ? 'Autoguardado' : `Ranura ${r.ranura}`,
        }),

        puedeGuardar
          ? h('span', {
              style: { fontSize: 'var(--f-2xs)', color: 'var(--c-acento)' },
              text: 'Guardar aquí',
            })
          : null,
      ),

      h('p', {
        style: { fontSize: 'var(--f-xs)', color: 'var(--c-texto-tenue)', fontStyle: 'italic' },
        text: r.corrupta ? 'Partida corrupta: no se puede leer.' : 'Vacía',
      }),
    );
  }

  /** @private */
  _fichaOcupada(r) {
    const c = r.cabecera ?? {};
    const abrible = r.abrible !== false;

    return h('div', {
      dataset: { ranura: r.ranura },
      style: {
        padding: 'var(--sp-3)',
        background: 'var(--c-superficie-2)',
        borderRadius: 'var(--r-sm)',
        borderLeft: `var(--bw-thick) solid ${r.esAuto ? 'var(--c-info)' : 'var(--c-acento)'}`,
      },
    },
      // ─── Identidad de la partida ──────────────────────────────────────
      h('div.row.row--between', {},
        h('div', {},
          h('span', {
            style: {
              fontFamily: 'var(--f-display)',
              fontSize: 'var(--f-md)',
              color: 'var(--c-texto-titulo)',
            },
            text: c.nombre ?? 'Sin nombre',
          }),
          h('span', {
            style: { fontSize: 'var(--f-xs)', color: 'var(--c-texto-tenue)', marginLeft: 'var(--sp-2)' },
            text: `nivel ${c.nivel ?? 1}`,
          }),
        ),

        h('span.eyebrow', { text: r.esAuto ? 'Automática' : `Ranura ${r.ranura}` }),
      ),

      // ─── Detalles ─────────────────────────────────────────────────────
      h('div.row', { style: { gap: 'var(--sp-3)', margin: 'var(--sp-2) 0', flexWrap: 'wrap' } },
        c.lugar
          ? h('span.row', { style: { gap: '3px' } },
              icono('mapa', { class: 'icon--sm' }),
              h('span', { style: { fontSize: 'var(--f-2xs)' }, text: c.lugar }),
            )
          : null,

        h('span.row', { style: { gap: '3px' } },
          icono('reloj', { class: 'icon--sm' }),
          h('span', { style: { fontSize: 'var(--f-2xs)' }, text: `día ${c.dia ?? 1}` }),
        ),

        c.vida
          ? h('span.row', { style: { gap: '3px' } },
              icono('corazon', { class: 'icon--sm' }),
              h('span', { style: { fontSize: 'var(--f-2xs)' }, text: c.vida }),
            )
          : null,

        c.misiones > 0
          ? h('span.row', { style: { gap: '3px' } },
              icono('mision', { class: 'icon--sm' }),
              h('span', { style: { fontSize: 'var(--f-2xs)' }, text: `${c.misiones}` }),
            )
          : null,
      ),

      // ─── Marca de tiempo ──────────────────────────────────────────────
      h('p', {
        style: { fontSize: 'var(--f-2xs)', color: 'var(--c-texto-tenue)' },
        text: r.guardadoEn
          ? `Guardada el ${formatearFecha(r.guardadoEn)}`
          : 'Sin fecha',
      }),

      // ─── Aviso de migración ───────────────────────────────────────────
      r.aviso
        ? h('p', {
            style: {
              fontSize: 'var(--f-2xs)',
              color: abrible ? 'var(--c-aviso)' : 'var(--c-peligro)',
              marginTop: 'var(--sp-1)',
            },
            text: r.aviso,
          })
        : null,

      // ─── Nota del jugador ─────────────────────────────────────────────
      c.nota
        ? h('p', {
            style: {
              fontSize: 'var(--f-xs)',
              color: 'var(--c-texto-suave)',
              fontStyle: 'italic',
              marginTop: 'var(--sp-1)',
            },
            text: `«${c.nota}»`,
          })
        : null,

      h('div.filo', { style: { margin: 'var(--sp-2) 0' } }),

      // ─── Acciones ─────────────────────────────────────────────────────
      h('div.row', { style: { gap: 'var(--sp-2)' } },
        this._modo === 'cargar'
          ? h('button.btn.btn--primary.btn--sm', {
              type: 'button',
              disabled: !abrible,
              style: { flex: 1 },
              onClick: () => this._cargar(r.ranura),
            }, h('span', { text: 'Cargar' }))
          : h('button.btn.btn--sm', {
              type: 'button',
              disabled: r.esAuto || !this._saves()?.activo,
              style: { flex: 1 },
              attrs: { title: r.esAuto ? 'Esta ranura la gestiona el autoguardado' : '' },
              onClick: () => this._sobrescribir(r.ranura, c.nombre),
            }, h('span', { text: 'Sobrescribir' })),

        h('button.btn.btn--ghost.btn--sm.btn--icon', {
          type: 'button',
          attrs: { 'aria-label': 'Borrar', title: 'Borrar esta partida' },
          onClick: () => this._borrar(r.ranura, c.nombre),
        }, icono('cerrar')),
      ),
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ARCHIVO
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Exportación e importación a archivo.
   *
   * Funciona con el guardado desactivado: no escribe en el navegador, descarga
   * un archivo. Es la vía que encaja con la restricción original del proyecto.
   *
   * @private
   */
  _bloqueArchivo() {
    const enPartida = this.leer('meta.fase') !== 'menu';

    return h('div.stack.stack--sm', {},
      h('span.eyebrow', { text: 'Archivo' }),

      h('p.settings__note', {
        text: 'Exportar descarga la partida como archivo. No necesita permiso de almacenamiento y puedes llevártela a otro equipo.',
      }),

      h('div.row', { style: { gap: 'var(--sp-2)' } },
        h('button.btn.btn--sm', {
          type: 'button',
          disabled: !enPartida,
          style: { flex: 1 },
          attrs: { title: enPartida ? '' : 'No hay partida en curso' },
          onClick: () => this._exportar(),
        }, icono('pergamino', { class: 'icon--sm' }), h('span', { text: 'Exportar' })),

        h('button.btn.btn--sm', {
          type: 'button',
          style: { flex: 1 },
          onClick: () => this.refs.archivo?.click(),
        }, icono('bolsa', { class: 'icon--sm' }), h('span', { text: 'Importar' })),
      ),

      // Campo de archivo oculto: el botón de arriba lo dispara.
      h('input', {
        ref: this.ref('archivo'),
        type: 'file',
        accept: '.json,application/json',
        hidden: true,
        onChange: (e) => this._alElegirArchivo(e),
      }),
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ESPACIO
     ═══════════════════════════════════════════════════════════════════════ */

  /** @private */
  _bloqueEspacio(saves) {
    const espacio = saves?.espacioUsado();
    if (!espacio || espacio.ranuras === 0) return null;

    return h('div.stack.stack--sm', { style: { marginTop: 'var(--sp-4)' } },
      h('div.filo'),

      h('div.row.row--between', {},
        h('span', {
          style: { fontSize: 'var(--f-2xs)', color: 'var(--c-texto-tenue)' },
          text: `${espacio.ranuras} partidas · ${espacio.kb} KB`,
        }),

        h('button.btn.btn--ghost.btn--sm', {
          type: 'button',
          style: { color: 'var(--c-peligro)' },
          onClick: () => this._borrarTodo(),
        }, h('span', { text: 'Borrar todas' })),
      ),
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ACCIONES
     ═══════════════════════════════════════════════════════════════════════ */

  /** @private */
  async _guardar(ranura) {
    const nota = await this._pedirNota();
    if (nota === null) return;   // Cancelado.

    const r = this._saves()?.guardar(ranura, { nota: nota || undefined });

    if (!r?.exito && r?.motivo) {
      this.ui?.avisar(r.motivo, { tipo: 'error' });
    }

    this.refrescar();
  }

  /**
   * Sobrescribir siempre pide confirmación: es destructivo.
   * @private
   */
  async _sobrescribir(ranura, nombre) {
    const seguro = await this.ui?.confirmar(
      nombre
        ? `Vas a sustituir la partida de ${nombre}. No hay vuelta atrás.`
        : 'Vas a sustituir esta partida. No hay vuelta atrás.',
      { titulo: 'Sobrescribir', si: 'Sobrescribir', no: 'Cancelar', peligroso: true },
    );

    if (!seguro) return;

    await this._guardar(ranura);
  }

  /**
   * Cargar no pide confirmación: es reversible si hay otra ranura.
   *
   * Sí avisa cuando hay una partida en curso sin guardar, porque entonces sí se
   * pierde algo.
   *
   * @private
   */
  async _cargar(ranura) {
    const enPartida = this.leer('meta.fase') !== 'menu';

    if (enPartida) {
      const seguro = await this.ui?.confirmar(
        'Tienes una partida en curso. Si cargas otra, perderás lo que no hayas guardado.',
        { titulo: 'Cargar partida', si: 'Cargar', no: 'Cancelar' },
      );

      if (!seguro) return;
    }

    const r = this._saves()?.cargar(ranura);

    if (!r?.exito) {
      this.ui?.avisar(r?.motivo ?? 'No se ha podido cargar.', { tipo: 'error' });
      return;
    }

    if (r.avisos?.length) {
      this.ui?.avisar('Partida cargada, con algunos ajustes de compatibilidad.', { tipo: 'info' });
    } else {
      this.ui?.avisar('Partida cargada', { tipo: 'exito' });
    }

    this.ui?.irA(PANTALLAS.JUEGO);
  }

  /** @private */
  async _borrar(ranura, nombre) {
    const seguro = await this.ui?.confirmar(
      nombre
        ? `¿Borrar la partida de ${nombre}? No se puede recuperar.`
        : '¿Borrar esta partida? No se puede recuperar.',
      { titulo: 'Borrar partida', si: 'Borrar', no: 'Cancelar', peligroso: true },
    );

    if (!seguro) return;

    this._saves()?.borrar(ranura);
    this.refrescar();
  }

  /**
   * Borrar todo pide confirmación doble.
   *
   * No es paranoia: es la única acción de la pantalla que destruye varias
   * partidas de golpe.
   *
   * @private
   */
  async _borrarTodo() {
    const primera = await this.ui?.confirmar(
      'Vas a borrar todas las partidas guardadas, incluida la automática.',
      { titulo: 'Borrar todo', si: 'Continuar', no: 'Cancelar', peligroso: true },
    );

    if (!primera) return;

    const segunda = await this.ui?.confirmar(
      'Esto no se puede deshacer. ¿Seguro?',
      { titulo: '¿Seguro?', si: 'Borrar todo', no: 'Mejor no', peligroso: true },
    );

    if (!segunda) return;

    const r = this._saves()?.borrarTodo();

    this.ui?.avisar(`${r?.borradas ?? 0} partidas borradas`, { tipo: 'info' });
    this.refrescar();
  }

  /** @private */
  _exportar() {
    const r = this._saves()?.exportar();

    if (!r?.exito && r?.motivo) {
      this.ui?.avisar(r.motivo, { tipo: 'error' });
    }
  }

  /**
   * Lee un archivo elegido por el jugador.
   * @private
   */
  async _alElegirArchivo(evento) {
    const archivo = evento.target?.files?.[0];
    if (!archivo) return;

    // El campo se limpia para que elegir el mismo archivo dos veces funcione.
    evento.target.value = '';

    const enPartida = this.leer('meta.fase') !== 'menu';

    if (enPartida) {
      const seguro = await this.ui?.confirmar(
        'Tienes una partida en curso. Si importas otra, perderás lo que no hayas guardado.',
        { titulo: 'Importar partida', si: 'Importar', no: 'Cancelar' },
      );

      if (!seguro) return;
    }

    let texto;

    try {
      texto = await archivo.text();
    } catch (e) {
      this.ui?.avisar('No se ha podido leer el archivo.', { tipo: 'error' });
      return;
    }

    const r = this._saves()?.importar(texto);

    if (!r?.exito) {
      this.ui?.avisar(r?.motivo ?? 'El archivo no es una partida válida.', { tipo: 'error' });
      return;
    }

    this.ui?.avisar('Partida importada', { tipo: 'exito' });
    this.ui?.irA(PANTALLAS.JUEGO);
  }

  /**
   * Pide una nota opcional para la partida.
   *
   * Devuelve `null` si se cancela y cadena vacía si se acepta sin escribir: son
   * dos cosas distintas y el llamante necesita distinguirlas.
   *
   * @returns {Promise<string|null>}
   * @private
   */
  async _pedirNota() {
    const campo = h('input.input', {
      type: 'text',
      maxLength: 60,
      placeholder: 'Antes de entrar en la cripta…',
    });

    const resultado = await this.ui?.abrirModal({
      titulo: 'Nota de la partida',
      contenido: h('div.stack.stack--sm', {},
        h('p', {
          style: { fontSize: 'var(--f-xs)', color: 'var(--c-texto-suave)' },
          text: 'Opcional. Sirve para reconocerla en la lista.',
        }),
        campo,
      ),
      botones: [
        { etiqueta: 'Cancelar', valor: null },
        { etiqueta: 'Guardar', valor: 'ok', primario: true },
      ],
      alAbrir: () => campo.focus(),
    });

    return resultado === 'ok' ? (campo.value?.trim() ?? '') : null;
  }

  /** @private */
  _activarGuardado() {
    this.despachar('settings/fijar', { id: 'persistencia', valor: true });
    this.emitir('settings:change', { id: 'persistencia', valor: true });

    // Se refresca en el siguiente ciclo, cuando el sistema ya ha reevaluado.
    this.espera(() => this.refrescar(), 50);
  }

  /** @private */
  _volver() {
    const enPartida = this.leer('meta.fase') !== 'menu';
    this.ui?.irA(enPartida ? PANTALLAS.JUEGO : PANTALLAS.MENU);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CICLO DE VIDA
     ═══════════════════════════════════════════════════════════════════════ */

  /** @protected */
  alMontar() {
    // Cualquier cambio en las partidas redibuja la lista.
    for (const evento of ['save:written', 'save:deleted', 'save:availability']) {
      this.escuchar(evento, () => this.refrescar());
    }

    // Escape vuelve atrás.
    this.on(document, 'keydown', (e) => {
      if (e.key === 'Escape') this._volver();
    });
  }

  /**
   * Cambia entre modo guardar y cargar.
   * @param {'guardar'|'cargar'} modo
   */
  fijarModo(modo) {
    this._modo = modo;
    this.refrescar();
  }

  /** @private */
  _saves() {
    return this.ui?.registry?.obtener?.('saves');
  }
}

export default SaveScreen;
