# Atribuciones y licencias · ARCANUM

Este documento cumple las obligaciones de atribución de las licencias abiertas
utilizadas en el proyecto. **No lo elimines ni lo modifiques al distribuir la
aplicación.** Su contenido también se muestra dentro del juego, en
Ajustes → Acerca de.

---

## 1. System Reference Document 5.1 y 5.2

This work includes material taken from the System Reference Document 5.1
("SRD 5.1") and the System Reference Document 5.2 ("SRD 5.2") by Wizards of
the Coast LLC, available at <https://www.dndbeyond.com/srd>.

The SRD 5.1 and SRD 5.2 are licensed under the Creative Commons Attribution
4.0 International License, available at
<https://creativecommons.org/licenses/by/4.0/legalcode>.

### Modificaciones realizadas

La licencia CC BY 4.0 exige indicar si el material ha sido modificado. Lo ha
sido, de las siguientes formas:

- **Traducción al castellano** de todo el material utilizado.
- **Conversión de atributos** al Sistema Núcleo d20 de este proyecto:
  Fuerza → Vigor · Destreza → Destreza · Constitución → Temple ·
  Inteligencia → Intelecto · Sabiduría → Astucia · Carisma → Carisma.
- **Sustitución de los bonificadores raciales fijos** por el reparto flexible
  del Núcleo d20.
- **Reescritura y reequilibrado de rasgos** para las mecánicas propias de este
  motor: fatiga, moral, hambre, sed, durabilidad y esquiva porcentual.
- **Reemplazo del sistema de clases de armadura** por defensa con reducción de
  daño y esquiva porcentual.
- **Adaptación de la progresión** a la curva de experiencia propia definida en
  `config/balance.config.js`.
- **Campos añadidos que no existen en el SRD**: `promptLore`, `pistas`,
  `ganchos`, `preguntasPropias` y descripciones culturales ampliadas, todos
  ellos obra original de este proyecto.

### Aclaración importante

Wizards of the Coast **no patrocina, avala ni está asociado** a este proyecto.
La licencia CC BY 4.0 no otorga derechos sobre marcas registradas: nombres como
*Dungeons & Dragons*, *D&D*, *Forgotten Realms* o el logotipo del dragón **no**
se utilizan en la aplicación ni en su material promocional.

---

## 2. Open5e

Cuando se instale el paquete de datos correspondiente, este proyecto puede
incorporar datos procedentes de **Open5e** (<https://open5e.com>), licenciados
bajo Creative Commons Attribution 4.0 International.

Open5e agrega contenido del SRD junto con material comunitario de licencia
abierta. Los datos se transforman mediante el adaptador
`src/data/adapters/srdAdapter.js` para ajustarlos al Sistema Núcleo d20.

---

## 3. 5e-bits / D&D 5e API

Cuando se instale el paquete de datos correspondiente, este proyecto puede
incorporar los volcados JSON del proyecto **5e-bits**
(<https://github.com/5e-bits/5e-database>).

- **Código** del proyecto: licencia MIT.
- **Datos** del SRD que contiene: Creative Commons Attribution 4.0 International.

Este proyecto no utiliza su API en tiempo de ejecución: los datos se empaquetan
de forma estática, en coherencia con el requisito de funcionamiento local sin
conexión.

---

## 4. Contenido original de ARCANUM

Todo lo que no proceda de las fuentes anteriores es obra original de este
proyecto y no deriva de material protegido. En particular:

- Los ocho linajes originales: Valdés, Sombracorteza, Ferrano, Albar,
  Griscuerno, Menudo, Brumal y Crisol.
- El linaje Zarpasuave.
- Las ocho vocaciones: Baluarte, Filo, Glifista, Vinculado, Rastreador,
  Sombra, Portavoz y Custodio.
- El Sistema Núcleo d20 y sus tablas de equilibrio.
- Los sistemas de fatiga, hambre, sed, moral, durabilidad y reputación.
- La ambientación de los Reinos Quebrados y todo su material narrativo.
- La totalidad del código fuente.

---

## 5. Dependencias de software

Ninguna. El proyecto no utiliza librerías de terceros, gestores de paquetes,
CDN ni fuentes tipográficas remotas. Todo el código es original y se ejecuta
sin conexión.

---

## 6. Cómo verificar el contenido instalado

Desde la consola del navegador:
