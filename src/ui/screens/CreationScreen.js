/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · ui/screens/CreationScreen.js
 * ---------------------------------------------------------------------------
 * Creación de personaje como conversación, no como formulario.
 *
 * Cuatro fases:
 *   1. Apertura — el jugador describe a su personaje con sus palabras
 *   2. Entrevista — preguntas encadenadas, solo las que siguen faltando
 *   3. Atributos — reparto propuesto, ajustable
 *   4. Confirmación — resumen editable antes de empezar
 *
 * El diseño evita el error habitual: nunca se pregunta algo que ya se dedujo.
 * Si el jugador escribió «una enana herrera», el linaje y el trasfondo están
 * resueltos, y la primera pregunta será por qué dejó su clan.
 *
 * Todo el flujo admite escritura libre. Los botones son atajos, no la única vía.
 *
 * Dependencias: Component, DOM, CharacterInterview, CharacterFactory, datos.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Component } from '../Component.js';
import { h, icono, vaciar, enfocar, texto as fijarTexto, clase } from '../DOM.js';
import { CharacterInterview } from '../../player/creation/CharacterInterview.js';
import { previsualizar } from '../../player/CharacterFactory.js';
import { META_ATRIBUTOS, puedeSubir, puedeBajar, subir, bajar, puntosRestantes, calificar } from '../../player/Attributes.js';
import { nombreSugerido } from '../../data/races.data.js';
import { PLANTILLAS_ATRIBUTOS } from '../../data/interview.data.js';
import { TEXTOS_ENTREVISTA } from '../../data/interview.data.js';
import { ATRIBUTOS } from '../../config/balance.config.js';
import { PANTALLAS } from '../../config/ui.config.js';

/** Fases del asistente. */
const FASE = Object.freeze({
  APERTURA: 'apertura',
  ENTREVISTA: 'entrevista',
  ATRIBUTOS: 'atributos',
  CONFIRMAR: 'confirmar',
});

export class CreationScreen extends Component {
  static nombre = 'pantalla-creacion';
  static rama = '';

  constructor(contexto, opciones) {
    super(contexto, opciones);

    /** @type {CharacterInterview} @private */
    this._entrevista = new CharacterInterview({ rng: opciones?.rng ?? null });

    /** @private */
    this._fase = FASE.APERTURA;

    /** Reparto de atributos en edición. @private */
    this._atributos = null;

    /** true mientras se procesa una respuesta. @private */
    this._ocupado = false;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */

  /** @returns {HTMLElement} @protected */
  render() {
    return h('div.creator', { ref: this.ref('raiz') },
      this._cabecera(),
      h('div.creator__stage', { ref: this.ref('escenario') }, this._contenidoFase()),
    );
  }

  /** @private */
  _cabecera() {
    const pasos = ['Retrato', 'Historia', 'Aptitudes', 'Confirmar'];
    const indice = [FASE.APERTURA, FASE.ENTREVISTA, FASE.ATRIBUTOS, FASE.CONFIRMAR].indexOf(this._fase);

    return h('div.creator__head', {},
      h('h1', { text: 'Forja tu leyenda' }),
      h('div.steps', {},
        ...pasos.map((nombre, i) => h('div.step', {
          dataset: { state: i < indice ? 'done' : i === indice ? 'active' : 'pending' },
        },
          h('span.step__num', { text: String(i + 1) }),
          h('span', { text: nombre }),
        )),
      ),
    );
  }

  /** @private */
  _contenidoFase() {
    switch (this._fase) {
      case FASE.ENTREVISTA: return this._vistaEntrevista();
      case FASE.ATRIBUTOS: return this._vistaAtributos();
      case FASE.CONFIRMAR: return this._vistaConfirmar();
      default: return this._vistaApertura();
    }
  }

  /**
   * Repinta solo el escenario, conservando la cabecera y sus transiciones.
   * @private
   */
  _repintar() {
    if (!this.refs.escenario) return;
    vaciar(this.refs.escenario);
    this.refs.escenario.appendChild(this._contenidoFase());

    // La cabecera se actualiza en sitio para no perder la animación de pasos.
    const cabecera = this.refs.raiz?.querySelector('.creator__head');
    if (cabecera) cabecera.replaceWith(this._cabecera());
  }

  /* ═══════════════════════════════════════════════════════════════════════
     FASE 1 · APERTURA
     ═══════════════════════════════════════════════════════════════════════ */

  /** @private */
  _vistaApertura() {
    const datos = this._entrevista.apertura();

    const campo = h('textarea.input', {
      ref: this.ref('descripcion'),
      rows: 6,
      placeholder: datos.marcador,
      maxLength: 1200,
      style: { minHeight: '9rem', lineHeight: 'var(--lh-normal)' },
      onKeydown: (e) => {
        // Ctrl+Enter envía: es un textarea largo, Enter debe saltar línea.
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          this._enviarDescripcion();
        }
      },
    });

    return h('div.stack', {},
      h('h2', { text: datos.titulo }),
      h('p', { class: 'pick__desc', text: datos.cuerpo }),

      campo,

      h('p', { class: 'setting__desc', text: datos.ayuda }),

      // Semillas: rellenan el campo, no lo envían. El jugador puede editarlas.
      h('div.stack.stack--sm', {},
        h('span.eyebrow', { text: 'Si te falta inspiración' }),
        ...datos.semillas.map((s) => h('button.pick', {
          type: 'button',
          style: { padding: 'var(--sp-3)' },
          onClick: () => {
            campo.value = s;
            enfocar(campo);
          },
        }, h('span.pick__desc', { text: s }))),
      ),

      h('div.creator__nav', {},
        h('button.btn', {
          type: 'button',
          onClick: () => this.ui?.irA(PANTALLAS.MENU),
        }, icono('cerrar'), h('span', { text: 'Volver' })),

        h('div.row', {},
          h('button.btn', {
            type: 'button',
            onClick: () => this._saltarTodo(),
          }, h('span', { text: 'Créamelo tú' })),

          h('button.btn.btn--primary', {
            type: 'button',
            onClick: () => this._enviarDescripcion(),
          }, h('span', { text: 'Continuar' }), icono('enviar')),
        ),
      ),
    );
  }

  /** @private */
  async _enviarDescripcion() {
    if (this._ocupado) return;

    const texto = this.refs.descripcion?.value?.trim() ?? '';
    if (texto.length < 10) {
      this.ui?.avisar('Cuéntame algo más, aunque sea una frase', { tipo: 'aviso' });
      enfocar(this.refs.descripcion);
      return;
    }

    this._ocupado = true;
    const { resueltos } = await this._entrevista.describir(texto);
    this._ocupado = false;

    if (resueltos.length) {
      this.ui?.avisar(
        `He deducido ${resueltos.length === 1 ? 'una cosa' : `${resueltos.length} cosas`} de tu descripción`,
        { tipo: 'info' },
      );
    }

    this._fase = FASE.ENTREVISTA;
    this._siguiente();
  }

  /** @private */
  _saltarTodo() {
    const texto = this.refs.descripcion?.value?.trim();
    if (texto) this._entrevista.borrador.retrato = texto;

    this._entrevista.completar();
    this._atributos = { ...this._entrevista.borrador.atributos };
    this._fase = FASE.CONFIRMAR;
    this._repintar();
  }

  /* ═══════════════════════════════════════════════════════════════════════
     FASE 2 · ENTREVISTA
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Avanza a la siguiente pregunta pendiente.
   * @private
   */
  _siguiente() {
    const pregunta = this._entrevista.siguientePregunta();

    if (!pregunta) {
      this._atributos = this._entrevista.repartirAtributos();
      this._fase = FASE.ATRIBUTOS;
    }

    this._repintar();
  }

  /** @private */
  _vistaEntrevista() {
    const p = this._entrevista.actual;
    if (!p) return h('div', { text: 'Un momento…' });

    return h('div.stack', {},
      // Lo que ya se sabe, como recordatorio discreto.
      this._chipsResueltos(),

      h('h2', { text: p.texto }),
      p.ayuda ? h('p', { class: 'setting__desc', text: p.ayuda }) : null,

      p.tipo === 'confirmar' ? this._controlConfirmar(p) : null,
      p.tipo === 'opciones' ? this._controlOpciones(p) : null,
      p.tipo === 'texto' ? this._controlTexto(p) : null,

      h('div.creator__nav', {},
        h('button.btn', {
          type: 'button',
          disabled: this._entrevista.historial.length === 0,
          onClick: () => { this._entrevista.retroceder(); this._siguiente(); },
        }, h('span', { text: 'Atrás' })),

        h('div.row', {},
          p.opcional
            ? h('button.btn.btn--ghost', {
                type: 'button',
                onClick: () => this._responder('siguiente'),
              }, h('span', { text: 'Omitir' }))
            : null,

          h('button.btn.btn--ghost', {
            type: 'button',
            onClick: () => this._saltarTodo(),
          }, h('span', { text: 'Completa el resto' })),
        ),
      ),
    );
  }

  /**
   * Chips con lo ya decidido. Dan sensación de avance y permiten ver de un
   * vistazo qué se dedujo sin preguntar.
   * @private
   */
  _chipsResueltos() {
    const r = this._entrevista.resumen();
    const chips = [];

    if (this._entrevista.borrador.nombre) chips.push(r.nombre);
    if (this._entrevista.borrador.raza) chips.push(r.raza + (r.subraza ? ` · ${r.subraza}` : ''));
    if (this._entrevista.borrador.clase) chips.push(r.clase);
    if (this._entrevista.borrador.trasfondo) chips.push(r.trasfondo);

    if (!chips.length) return null;

    return h('div.actionbar__quick', { style: { marginBottom: 'var(--sp-2)' } },
      ...chips.map((c) => h('span.choice', { style: { pointerEvents: 'none' } },
        icono('escudo', { class: 'icon--sm' }),
        h('span', { text: c }),
      )),
    );
  }

  /** @private */
  _controlConfirmar(p) {
    return h('div.stack.stack--sm', {},
      p.entidad
        ? h('div.pick', { attrs: { 'aria-pressed': 'true' } },
            h('span.pick__name', { text: p.entidad.nombre }),
            p.entidad.lema ? h('span.pick__tag', { text: p.entidad.lema }) : null,
            h('span.pick__desc', { text: p.entidad.descripcion ?? '' }),
          )
        : null,

      h('div.row', {},
        h('button.btn.btn--primary', {
          type: 'button',
          onClick: () => this._responder({ confirmado: true }),
        }, h('span', { text: 'Sí, eso es' })),

        h('button.btn', {
          type: 'button',
          onClick: () => this._responder({ confirmado: false }),
        }, h('span', { text: 'No exactamente' })),
      ),

      // Escritura libre siempre disponible, incluso en una confirmación.
      h('input.input', {
        ref: this.ref('entrada'),
        placeholder: 'O escríbelo con tus palabras…',
        onKeydown: (e) => {
          if (e.key === 'Enter') { e.preventDefault(); this._responder(e.target.value); }
        },
      }),
    );
  }

  /** @private */
  _controlOpciones(p) {
    return h('div.stack.stack--sm', {},
      h('div.pickgrid', {},
        ...(p.opciones ?? []).map((o) => h('button.pick', {
          type: 'button',
          attrs: { 'aria-pressed': 'false' },
          onClick: () => this._responder({ refId: o.refId }),
        },
          h('span.pick__name', { text: o.nombre }),
          o.sugerida ? h('span.pick__tag', { text: 'Sugerido para ti' }) : null,
          o.lema ? h('span.pick__tag', { text: o.lema }) : null,
          h('span.pick__desc', { text: o.descripcion ?? '' }),
          o.fuente === 'srd' ? h('span.pick__perk', { text: 'SRD' }) : null,
        )),
      ),

      h('input.input', {
        ref: this.ref('entrada'),
        placeholder: 'O descríbelo con tus palabras…',
        onKeydown: (e) => {
          if (e.key === 'Enter') { e.preventDefault(); this._responder(e.target.value); }
        },
      }),
    );
  }

  /** @private */
  _controlTexto(p) {
    const campo = h('textarea.input', {
      ref: this.ref('entrada'),
      rows: 3,
      placeholder: 'Escribe tu respuesta…',
      onKeydown: (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._responder(e.target.value); }
      },
    });

    return h('div.stack.stack--sm', {},
      campo,
      h('div.row', {},
        h('button.btn.btn--primary', {
          type: 'button',
          onClick: () => this._responder(campo.value),
        }, h('span', { text: 'Continuar' })),

        p.permitirSugerencia
          ? h('button.btn', {
              type: 'button',
              onClick: () => {
                const sugerido = nombreSugerido(this._entrevista.borrador.raza);
                if (sugerido) { campo.value = sugerido; enfocar(campo); }
              },
            }, icono('dado'), h('span', { text: 'Sugerir' }))
          : null,
      ),
    );
  }

  /** @private */
  async _responder(respuesta) {
    if (this._ocupado) return;
    this._ocupado = true;

    const r = await this._entrevista.responder(respuesta);
    this._ocupado = false;

    if (!r.aceptada) {
      this.ui?.avisar('No he entendido eso. Prueba de otra forma o elige una opción', { tipo: 'aviso' });
      return;
    }

    if (r.accion === 'autocompletado') {
      this._atributos = { ...this._entrevista.borrador.atributos };
      this._fase = FASE.CONFIRMAR;
      this._repintar();
      return;
    }

    this._siguiente();

    // El foco vuelve al campo de entrada para poder encadenar respuestas sin
    // tocar el ratón.
    requestAnimationFrame(() => {
      if (this.refs.entrada) enfocar(this.refs.entrada);
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     FASE 3 · ATRIBUTOS
     ═══════════════════════════════════════════════════════════════════════ */

  /** @private */
  _vistaAtributos() {
    const restantes = puntosRestantes(this._atributos);
    const vista = previsualizar({ ...this._entrevista.borrador, atributos: this._atributos });

    return h('div.stack', {},
      h('h2', { text: TEXTOS_ENTREVISTA.atributos.titulo }),
      h('p', { class: 'setting__desc', text: TEXTOS_ENTREVISTA.atributos.intro }),

      h('div.attralloc__pool', { ref: this.ref('bolsa') },
        h('span', { text: `${TEXTOS_ENTREVISTA.atributos.restantes}: ` }),
        h('strong', { text: String(restantes) }),
      ),

      h('div.attralloc', {},
        ...ATRIBUTOS.orden.map((clave) => this._filaAtributo(clave)),
      ),

      // Vista previa en vivo: se ve el efecto de cada punto invertido.
      h('div.row.row--between', { style: { marginTop: 'var(--sp-4)' } },
        h('span.eyebrow', { text: 'Con este reparto' }),
        h('span', {
          ref: this.ref('preview'),
          style: { fontFamily: 'var(--f-mono)', fontSize: 'var(--f-sm)' },
          text: `Vida ${vista.vida} · Maná ${vista.mana}`,
        }),
      ),

      h('div.creator__nav', {},
        h('button.btn', {
          type: 'button',
          onClick: () => { this._fase = FASE.ENTREVISTA; this._siguiente(); },
        }, h('span', { text: 'Atrás' })),

        h('div.row', {},
          h('button.btn', {
            type: 'button',
            onClick: () => {
              this._atributos = this._entrevista.repartirAtributos();
              this._repintar();
            },
          }, icono('dado'), h('span', { text: 'Reparto sugerido' })),

          h('button.btn.btn--primary', {
            type: 'button',
            onClick: () => {
              this._entrevista.borrador.atributos = { ...this._atributos };
              this._fase = FASE.CONFIRMAR;
              this._repintar();
            },
          }, h('span', { text: 'Continuar' })),
        ),
      ),
    );
  }

  /** @private */
  _filaAtributo(clave) {
    const meta = META_ATRIBUTOS[clave];
    const valor = this._atributos[clave] ?? ATRIBUTOS.base;
    const bonoLinaje = this._bonoLinaje(clave);

    return h('div.attralloc__row', { dataset: { atributo: clave } },
      h('div', {},
        h('span.attralloc__name', { text: meta.nombre }),
        h('span.attralloc__hint', { text: ` — ${calificar(valor + bonoLinaje)}` }),
        h('p.attralloc__hint', { text: meta.afecta.join(' · ') }),
      ),

      h('button.btn.btn--sm.btn--icon', {
        type: 'button',
        disabled: !puedeBajar(this._atributos, clave).puede,
        attrs: { 'aria-label': `Bajar ${meta.nombre}` },
        onClick: () => this._ajustar(clave, -1),
      }, h('span', { text: '−' })),

      h('span.attralloc__val', {
        text: bonoLinaje ? `${valor}+${bonoLinaje}` : String(valor),
      }),

      h('button.btn.btn--sm.btn--icon', {
        type: 'button',
        disabled: !puedeSubir(this._atributos, clave).puede,
        attrs: { 'aria-label': `Subir ${meta.nombre}` },
        onClick: () => this._ajustar(clave, 1),
      }, h('span', { text: '+' })),
    );
  }

  /**
   * Bonificador que aporta el linaje a un atributo.
   * @private
   */
  _bonoLinaje(clave) {
    const vista = previsualizar(this._entrevista.borrador);
    return vista.modificadoresLinaje?.[clave] ?? 0;
  }

  /** @private */
  _ajustar(clave, direccion) {
    this._atributos = direccion > 0
      ? subir(this._atributos, clave)
      : bajar(this._atributos, clave);
    this._repintar();
  }

  /* ═══════════════════════════════════════════════════════════════════════
     FASE 4 · CONFIRMACIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /** @private */
  _vistaConfirmar() {
    const borrador = { ...this._entrevista.borrador, atributos: this._atributos };
    const vista = previsualizar(borrador);
    const r = this._entrevista.resumen();

    return h('div.stack', {},
      h('h2', { text: TEXTOS_ENTREVISTA.resumen.titulo }),
      h('p', { class: 'setting__desc', text: TEXTOS_ENTREVISTA.resumen.intro }),

      // Ficha
      h('div.charcard', { style: { marginBottom: 'var(--sp-4)' } },
        h('div.charcard__sigil', { text: (r.nombre?.[0] ?? '?').toUpperCase() }),
        h('div', {},
          h('div.charcard__name', { text: r.nombre }),
          h('div.charcard__meta', {
            text: `${r.raza}${r.subraza ? ` · ${r.subraza}` : ''} · ${r.clase}`,
          }),
          h('div.charcard__level', { text: `Nivel 1 · ${r.trasfondo}` }),
        ),
      ),

      // El texto original del jugador, destacado. Es lo que hace suya la partida.
      r.retrato
        ? h('div', {
            style: {
              padding: 'var(--sp-4)',
              background: 'var(--c-superficie-2)',
              borderLeft: 'var(--bw-heavy) solid var(--c-acento)',
              borderRadius: 'var(--r-sm)',
              fontStyle: 'italic',
              color: 'var(--c-texto-narrativa)',
            },
            text: r.retrato,
          })
        : null,

      h('div.filo'),

      // Atributos
      h('div.attrs', {},
        ...ATRIBUTOS.orden.map((clave) => h('div.attr', {},
          h('span.attr__label', { text: META_ATRIBUTOS[clave].abreviatura }),
          h('span.attr__value', { text: String(vista.atributos[clave]) }),
          h('span.attr__mod', {
            text: (() => {
              const m = Math.floor((vista.atributos[clave] - 10) / 2);
              return m === 0 ? '±0' : m > 0 ? `+${m}` : `−${Math.abs(m)}`;
            })(),
          }),
        )),
      ),

      // Vitales y bolsa
      h('div.row.row--between', {},
        h('span', { text: `Vida ${vista.vida}` }),
        h('span', { text: `Maná ${vista.mana}` }),
        h('span', { text: `${vista.oro} de oro` }),
      ),

      h('div.filo'),

      // Rasgos
      h('div.stack.stack--sm', {},
        h('span.eyebrow', { text: 'Rasgos' }),
        ...vista.rasgos.slice(0, 6).map((rasgo) => h('div', {},
          h('strong', { text: rasgo.nombre }),
          h('span', { class: 'pick__desc', text: ` — ${rasgo.descripcion}` }),
        )),
      ),

      // Hilos narrativos
      r.motivacion || r.gancho
        ? h('div.stack.stack--sm', {},
            h('span.eyebrow', { text: 'Hilos abiertos' }),
            r.motivacion ? h('p', { class: 'pick__desc', text: r.motivacion }) : null,
            r.gancho ? h('p', { class: 'pick__desc', text: r.gancho }) : null,
          )
        : null,

      h('div.creator__nav', {},
        h('button.btn', {
          type: 'button',
          onClick: () => { this._fase = FASE.ATRIBUTOS; this._repintar(); },
        }, h('span', { text: TEXTOS_ENTREVISTA.resumen.editar })),

        h('div.row', {},
          h('button.btn.btn--ghost', {
            type: 'button',
            onClick: () => this._reiniciar(),
          }, h('span', { text: TEXTOS_ENTREVISTA.resumen.reiniciar })),

          h('button.btn.btn--primary.btn--lg', {
            type: 'button',
            onClick: () => this._empezar(),
          }, icono('dado'), h('span', { text: TEXTOS_ENTREVISTA.resumen.confirmar })),
        ),
      ),
    );
  }

  /** @private */
  async _reiniciar() {
    const seguro = await this.ui?.confirmar('¿Empezar la creación de cero?', {
      titulo: 'Reiniciar',
      si: 'Empezar de nuevo',
      no: 'Cancelar',
    });
    if (!seguro) return;

    this._entrevista.reiniciar();
    this._atributos = null;
    this._fase = FASE.APERTURA;
    this._repintar();
  }

  /** @private */
  _empezar() {
    const borrador = this._entrevista.finalizar();
    borrador.atributos = this._atributos ?? borrador.atributos;

    this.despachar('player/crear', { borrador });
    this.emitir('game:started', { borrador });
    this.ui?.irA(PANTALLAS.JUEGO);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CICLO DE VIDA
     ═══════════════════════════════════════════════════════════════════════ */

  /** @protected */
  alMontar() {
    requestAnimationFrame(() => {
      if (this.refs.descripcion) enfocar(this.refs.descripcion);
    });
  }

  /** @protected */
  actualizar() {
    return true;   // El repintado lo gobierna la fase, no el estado.
  }
}

export default CreationScreen;
