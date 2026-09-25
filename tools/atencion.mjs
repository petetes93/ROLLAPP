/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · tools/atencion.mjs
 * ---------------------------------------------------------------------------
 * ¿La respuesta atiende a lo que se preguntó y a quien se le preguntó?
 *
 * El marcador anterior daba 27/27 con respuestas que no atendían: contaba
 * como contestada cualquier pregunta sin tema reconocido, y cualquier «De
 * eso no sé nada. Pregunta a otro» como una admisión honrada. Aquí una
 * respuesta cuenta solo si cumple las tres cosas:
 *
 *   · DESTINATARIO — si se le pregunta a alguien presente, contesta él (su
 *     nombre abre o firma una línea de la respuesta) y no otro.
 *   · TEMA — la respuesta nombra lo preguntado (una palabra de contenido de
 *     la pregunta, por su raíz), o es un acto que no pide dato (ofrecer
 *     ayuda, dar las gracias) y se contesta a ese acto.
 *   · CONTENIDO — da un dato, o dice que no lo sabe y a quién preguntar.
 *
 * Es una comprobación de texto, no de sentido: sirve para cazar lo que no
 * atiende, no para certificar que una respuesta es buena. La lectura manual
 * de las transcripciones sigue mandando.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { actoDeHabla, ACTO } from '../src/engine/ActoDeHabla.js';

const llano = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Palabras de la pregunta que no son el tema. */
const VACIAS = new Set(['pregunto', 'pregunta', 'preguntar', 'sabes', 'sabe', 'algo', 'visto', 'vistos', 'alguien', 'alguno', 'alguna', 'aqui', 'por', 'para',
  'hablar', 'oido', 'otra', 'vez', 'digo', 'dime', 'cuentame', 'quien', 'donde', 'cuando', 'como', 'hay', 'esto', 'esta', 'este', 'estos', 'ese', 'esa',
  'tambien', 'entonces', 'pues', 'bueno', 'vale', 'mucho', 'poco', 'todo', 'nada', 'ahora', 'luego', 'desde', 'hasta', 'sobre', 'entre', 'tiene', 'tienen',
  'conoce', 'conoces', 'puede', 'puedes', 'podria', 'quiero', 'saber', 'habeis', 'hace', 'hacia', 'ellos', 'ellas', 'nadie', 'mismo', 'otro', 'otros']);

/** Raíz corta para comparar palabras: «incendio» y «incendios». */
const raiz = (w) => w.slice(0, Math.max(4, Math.min(6, w.length - 1)));

/**
 * ¿Atiende la respuesta a la pregunta?
 *
 * @param {Object} turno
 * @param {string} turno.entrada Lo que escribió el jugador.
 * @param {string} turno.texto Lo que salió (puede traer la línea «» del eco).
 * @param {string[]} [turno.presentes] Nombres de quien había en escena.
 * @returns {{destinatario: string|null, atiendeDestinatario: boolean, tema: string[], atiendeTema: boolean, contenido: boolean, atiende: boolean, motivo: string}}
 */
export function atiende({ entrada, texto, presentes = [] }) {
  const cuerpo = String(texto ?? '').split('\n').filter((l) => l && !l.startsWith('»')).join('\n');
  // Sin el eco de la acción: «Le preguntas a Corvane por el incendio» no es
  // Corvane contestando ni el tema atendido.
  const lineas = cuerpo.split('\n').filter((l) => !/^(?:Le |Les )?(?:preguntas|dices|pides|cuentas|gritas|ofreces)\b/.test(l));
  const respuesta = lineas.join('\n');
  const n = llano(entrada);

  const nombres = presentes.filter(Boolean).map((p) => p.split(/\s+/)[0]);
  const destinatario = nombres.find((p) => new RegExp(`\\b${llano(p)}\\b`).test(n)) ?? null;
  const habla = (quien) => new RegExp(`(?:^|\\n)${quien}\\b|,? (?:te )?(?:dice|suelta|contesta|responde|añade) ${quien}\\b|${quien} (?:lo|te|niega|asiente|sonr|duda|no )`, 'u').test(respuesta);
  const otros = nombres.filter((p) => p !== destinatario);
  const hablaOtro = otros.some((p) => habla(p)) && !(destinatario && habla(destinatario));
  // A nadie en concreto: vale quien conteste.
  const atiendeDestinatario = destinatario ? habla(destinatario) && !hablaOtro : true;

  const acto = actoDeHabla(entrada)?.acto ?? null;
  const tema = llano(entrada.replace(destinatario ? new RegExp(`\\b${destinatario}\\b`, 'g') : /$^/, ''))
    .split(/[^a-zñ]+/u).filter((w) => w.length >= 4 && !VACIAS.has(w));
  const r = llano(respuesta);
  const actoSinDato = [ACTO.OFRECER_AYUDA, ACTO.AGRADECER, ACTO.OFRECER, ACTO.PEDIR_AVISO, ACTO.DESPEDIRSE].includes(acto);
  // «¿Qué te ha pasado?» se atiende contando lo que le pasó, con sus
  // palabras: no hace falta que repita «pasado».
  const quePaso = /\bque (?:te |le )?(?:ha |han )?(?:pasado|ocurrido|sucedido)\b|\bque (?:te |le )?paso\b|\bque tal (?:sigue|sigues|esta|estas)\b|\bcomo (?:sigue|sigues|estas)\b/.test(n);
  // «¿Cómo se llama esto?» se atiende diciendo un nombre.
  const comoSeLlama = /\bcomo se llama\b/.test(n) && /«[^»]*\b(?:es|son)\s+\p{Lu}\p{Ll}+/u.test(respuesta);
  const atiendeTema = comoSeLlama || actoSinDato || quePaso
    ? /«[^»]{3,}»/.test(respuesta)
    : tema.some((w) => r.includes(raiz(w))) || (acto === ACTO.SERVICIO && /«[^»]*(?:hay|templo|posada|fragua|mercado|aqui no|a \w+ de aqui)[^»]*»/i.test(respuesta));

  const dato = /«[^»]{15,}»/.test(respuesta) && !/no s[eé] nada|pregunta a otro/i.test(respuesta.match(/«[^»]{15,}»/)?.[0] ?? '');
  const admite = /no (?:lo )?s[eé]|no he visto|no tengo ni idea|no sabr[ií]a/i.test(respuesta) && /pregunta (?:a|en)|en la posada|en el templo|a la guardia|al herrero|quien baje/i.test(respuesta)
    && !/pregunta a otro; de eso yo no entiendo/i.test(respuesta);
  const contenido = actoSinDato ? atiendeTema : (dato || admite);

  // Preguntarle a quien no está: lo correcto es decirlo, y no cuenta como
  // pregunta contestada ni fallada.
  const ausente = /^(?:No has visto a ning|No conoces a nadie con ese nombre)|no está aquí\.|ya se ha ido de aquí|ya no puede contestar/m.test(cuerpo);
  if (ausente) return { aplica: false, destinatario, atiendeDestinatario: true, tema, atiendeTema: true, contenido: false, atiende: true, informa: false, motivo: 'no está: se dice' };

  // Atender es contestar ÉL y sobre ESO. Informar, además, es dar un dato o
  // decir a quién preguntar; «de eso no sé nada» atiende pero no informa.
  const atiendeTodo = atiendeDestinatario && atiendeTema;
  const motivo = !atiendeDestinatario ? (hablaOtro ? 'contesta otro' : `${destinatario} no contesta`)
    : !atiendeTema ? 'no nombra el tema'
      : contenido ? 'atiende' : 'atiende, sin dato ni a quién preguntar';
  return { aplica: true, destinatario, atiendeDestinatario, tema, atiendeTema, contenido, atiende: atiendeTodo, informa: atiendeTodo && contenido, motivo };
}

/** ¿Es una pregunta, o un acto que pide respuesta de alguien? */
export function pideRespuesta(entrada) {
  const n = llano(entrada);
  const acto = actoDeHabla(entrada)?.acto;
  return /\?|\bpregunt/.test(n) || [ACTO.SERVICIO, ACTO.OFRECER_AYUDA, ACTO.AGRADECER, ACTO.OFRECER, ACTO.PEDIR_AVISO].includes(acto);
}

export default { atiende, pideRespuesta };
