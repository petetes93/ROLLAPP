/**
 * Mejora opcional del retrato con un generador de imagen que corre en el PC.
 * La web nunca contiene un modelo ni una clave: habla solo con loopback. Si el
 * servicio no está levantado, el SVG procedural que ya está pintado permanece.
 */
const ORIGEN = 'http://127.0.0.1:11436';
const ESPERA_ESCRITURA = 850;
const pendientes = new WeakMap();

function firma(personaje) {
  return JSON.stringify({
    linaje: personaje.raza ?? 'valdes',
    nombre: personaje.nombre ?? '',
    descripcion: personaje.descripcion ?? personaje.retrato ?? '',
  });
}

/** Pide una imagen real local y sustituye el fallback solo cuando está lista. */
export function mejorarRetratoLocal(nodo, personaje = {}) {
  if (!nodo) return;
  const descripcion = (personaje.descripcion ?? personaje.retrato ?? '').trim();
  const anterior = pendientes.get(nodo);
  if (anterior) clearTimeout(anterior);
  if (descripcion.length < 8) return;

  const actual = firma(personaje);
  nodo.dataset.firmaRetratoLocal = actual;
  const temporizador = setTimeout(async () => {
    try {
      const respuesta = await fetch(`${ORIGEN}/v1/portrait`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lineage: personaje.raza ?? 'valdes',
          name: personaje.nombre ?? '',
          description: descripcion,
          seed: actual,
        }),
      });
      if (!respuesta.ok || nodo.dataset.firmaRetratoLocal !== actual) return;
      const blob = await respuesta.blob();
      if (!blob.type.startsWith('image/') || nodo.dataset.firmaRetratoLocal !== actual) return;

      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.className = 'arte arte--imagen arte--imagen-generada';
      img.alt = personaje.nombre ? `Retrato generado de ${personaje.nombre}` : 'Retrato generado';
      img.addEventListener('load', () => {
        if (nodo.dataset.firmaRetratoLocal !== actual) return URL.revokeObjectURL(url);
        const previa = nodo.dataset.urlRetratoLocal;
        nodo.replaceChildren(img);
        nodo.dataset.urlRetratoLocal = url;
        if (previa) URL.revokeObjectURL(previa);
      }, { once: true });
      img.addEventListener('error', () => URL.revokeObjectURL(url), { once: true });
      img.src = url;
    } catch {
      // El generador es una mejora local opcional. Nunca rompe el juego.
    }
  }, ESPERA_ESCRITURA);
  pendientes.set(nodo, temporizador);
}
