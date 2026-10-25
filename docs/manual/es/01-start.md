# Primeros pasos

## Qué se puede hacer con novira

novira es una aplicación de escritorio para Windows que crea imágenes, vídeo, música y voz.
Basta con escribir un prompt (la descripción de lo que se quiere crear) y pulsar el botón **{{ui:params.invoke.invoke}}**: el dibujo se genera en el propio ordenador y aparece en la galería de la derecha.
La estructura de la pantalla y su manejo se basan en la herramienta de generación de imágenes InvokeAI. Quien ya la haya usado se sentirá en casa.

En líneas generales, se puede hacer lo siguiente:

- Crear imágenes a partir de texto (el tema central de esta guía)
- Rehacer una imagen a partir de otra, repintar solo una parte y ampliar
- Crear vídeo, música, voz, logotipos e imágenes con texto
- Consultar al asistente de IA sobre los ajustes y el prompt

> El dibujo se genera en el propio ordenador. Las funciones que usan internet, como buscar y descargar modelos o el asistente de IA, solo se conectan cuando se decide usarlas.

## Cómo se crean las imágenes

novira consta de estas 4 piezas.

| Pieza | Función |
|---|---|
| novira (esta aplicación) | Pantalla, galería, cola de espera y gestión de modelos |
| Motor de generación de imágenes (ComfyUI) | La parte que realmente dibuja. novira lo instala y lo inicia por sí misma |
| Modelos | Datos de aprendizaje para dibujar. Cada uno es un archivo de varios GB que se prepara aparte del motor |
| Carpeta de datos | Lugar donde se guardan las imágenes creadas, los modelos, el propio motor, etc. |

No hace falta instalar el motor a mano. novira lo instala automáticamente la primera vez que se inicia.
El motor y sus componentes (Python, etc.) se instalan solo dentro de la carpeta de datos de novira. No se modifica ningún otro lugar del ordenador ni ningún Python ya existente.

La carpeta de datos se llama `novira-data` y está dentro de la carpeta de la aplicación. Es la carpeta que se usa para mover o copiar las imágenes y los modelos.

> La generación de imágenes usa la GPU (tarjeta gráfica). De forma predeterminada se instala el motor para GPU de NVIDIA.

El modelo determina el estilo del dibujo. Hace falta uno al principio. En [Preparar modelos](08-models.md) se explica cómo instalarlo.

## Al iniciar por primera vez

Al abrir la aplicación aparece primero la pantalla de inicio (el logotipo y burbujas de dibujos que flotan despacio).
Debajo de la pantalla de inicio aparece una tarjeta que indica lo que se está haciendo en ese momento.

En el primer inicio comienza la instalación del motor de generación de imágenes. La tarjeta muestra 3 fases, una tras otra.

1. **{{ui:splash.step.downloading}}**: se descargan ComfyUI y Python. También se muestran el tamaño, la velocidad y una estimación del tiempo restante.
2. **{{ui:splash.step.extracting}}**: se extraen los archivos descargados.
3. **{{ui:splash.step.starting}}**: se inicia el motor y se espera a que se conecte.

> {{ui:engine.firstRunNote}}

La instalación se hace una sola vez. A partir del segundo inicio, la pantalla de inicio termina en unos segundos y el motor arranca enseguida.

Cuando el motor está listo, la pantalla de inicio desaparece y se abre la pantalla principal.
Mientras se cargan los datos aparece «{{ui:splash.wait.heading.loading}}», y mientras se espera la carga del motor y de la información necesaria para editar aparece «{{ui:splash.wait.heading.preparing}}».

### Mensajes en la parte superior de la pantalla

Si, después de abrir la aplicación, el motor se reinicia o se vuelve a instalar, aparece una banda (banner) en el centro de la parte superior de la pantalla para informar de la situación.

- «{{ui:engine.title.downloading}}», «{{ui:engine.title.extracting}}», «{{ui:engine.title.starting}}»: trabajo en curso. No se puede empezar a generar hasta que termine. Al terminar, la banda desaparece sola.
- «{{ui:engine.title.error}}»: no se pudo preparar el motor. El motivo aparece en la línea situada debajo de la banda.

Si se produce un error en la pantalla de inicio, debajo del motivo aparece el botón **{{ui:splash.open}}**. Al pulsarlo se abre la aplicación sin el motor. Se pueden revisar los modelos y los ajustes, pero no crear dibujos.
Si el error persiste, consulte [Solución de problemas](10-troubleshooting.md).

## Recorrido por la pantalla

![Vista general de la pestaña Generar. A la izquierda el panel de parámetros, en el centro la pantalla de inicio y a la derecha el tablero y la galería](shot:generate)

De izquierda a derecha, la pantalla se organiza así:

- La estrecha banda vertical del extremo izquierdo: la **navegación lateral**. Sirve para cambiar de pestaña.
- El panel izquierdo: el **panel de parámetros**. Contiene los ajustes para crear dibujos, como el prompt y el modelo.
- El centro: la **vista principal**. Es el lugar de trabajo según la pestaña: pantalla de inicio, visor de imágenes, lienzo, etc.
- El panel derecho: la **galería**. Muestra los tableros (algo parecido a carpetas) y las miniaturas de las imágenes creadas.

### Navegación lateral (pestañas)

| Pestaña | Para qué sirve | Tecla numérica |
|---|---|---|
| **{{ui:app.tabs.generate}}** | Crear imágenes. Con los iconos de la parte superior también se puede cambiar a vídeo, música, voz, logotipo, texto y cómic | `1` |
| **{{ui:app.tabs.canvas}}** | Colocar una imagen, añadirle trazos o repintar solo una parte | `2` |
| **{{ui:app.tabs.comic}}** | Crear páginas de cómic: distribución de viñetas, una imagen por viñeta, globos y textos narrativos. También se abre con el icono de más a la derecha de la parte superior de la pestaña {{ui:app.tabs.generate}} | `3` |
| **{{ui:app.tabs.upscaling}}** | Agrandar una imagen añadiendo detalles finos | `4` |
| **{{ui:app.tabs.workflows}}** | Conectar piezas (nodos) para crear un procedimiento de generación propio | `5` |
| **{{ui:app.tabs.models}}** | Lista de los modelos disponibles, instalación y eliminación | `6` |
| **{{ui:app.tabs.browse}}** | Buscar modelos en internet e incorporarlos | `7` |
| **{{ui:app.tabs.queue}}** | Ver o detener la cola de generación. Una insignia indica cuántos elementos esperan | `8` |
| **{{ui:app.nav.extensions}}** | Buscar extensiones de ComfyUI, e instalarlas o quitarlas | `0` |

En la parte inferior de la navegación lateral también hay lo siguiente:

- **{{ui:app.tabs.short.agent}}**: abre la ventana del asistente de IA sobre la pantalla actual.
- **{{ui:app.nav.settings}}**: desde el menú se abren {{ui:app.nav.settings}}, {{ui:app.nav.hotkeys}} y {{ui:app.nav.about}}.
- El logotipo «n» de la parte superior: abre {{ui:app.nav.about}}.

El uso de cada una se explica en los capítulos siguientes.

- {{ui:app.tabs.generate}}, {{ui:app.tabs.queue}}: [Crear imágenes](02-generate.md)
- Galería, visor: [Galería y visor](03-gallery.md)
- {{ui:app.tabs.canvas}}: [Añadir trazos en el lienzo](05-canvas.md)
- {{ui:app.tabs.comic}}: [Dibujar un cómic](12-comic.md)
- {{ui:app.tabs.upscaling}}, {{ui:app.tabs.workflows}}: [Ampliación y flujos de trabajo](06-upscaling-workflows.md)
- Vídeo, música, voz, etc.: [Vídeo, música, voz, logotipos y texto](07-media.md)
- {{ui:app.tabs.models}}, {{ui:app.tabs.browse}}: [Preparar modelos](08-models.md)
- {{ui:app.tabs.short.agent}}, {{ui:app.nav.settings}}: [Asistente de IA y ajustes](09-assistant-settings.md)

### Pestañas centrales (inicio, visor, borradores)

En el centro de la pestaña {{ui:app.tabs.generate}} hay 3 pestañas pequeñas en la parte superior.

- **{{ui:app.views.launchpad}}**: guía para empezar. Muestra tarjetas como «{{ui:params.launchpad.generate.textTitle}}» y «{{ui:params.launchpad.generate.refTitle}}», junto con consejos de atajos.
- **{{ui:app.views.viewer}}**: lugar para ver una imagen en grande. Al elegir una imagen en la galería, se muestra aquí.
- **{{ui:app.views.drafts}}**: pantalla donde se alinean muchos candidatos dibujados a medias con los mismos ajustes y distinta semilla, y solo los que gustan se terminan de dibujar.

Las demás pestañas también tienen sus propias pestañas pequeñas (por ejemplo, {{ui:app.views.canvas}} en {{ui:app.tabs.canvas}}).

### Ocultar los paneles

Para ver la imagen más grande se pueden ocultar los paneles izquierdo y derecho.

- Los botones con una pequeña flecha en el borde superior central abren y cierran el panel izquierdo y el derecho.
- Con el teclado, `T` alterna el panel izquierdo, `G` el derecho y `F` ambos a la vez.
- Al arrastrar el límite entre paneles se cambia su ancho. El ancho se recuerda mientras la aplicación está abierta (al volver a abrirla, vuelve al ancho inicial).

> Los atajos de una sola letra, como `T`, `G` y `F`, no funcionan mientras se está escribiendo texto. Salga del campo de entrada antes de pulsarlos.

## Crear la primera imagen (3 pasos)

Este es el procedimiento para crear un dibujo por primera vez. Se supone que ya hay un modelo instalado.

1. **Elegir el modelo.** En el campo de modelo, situado en la parte superior del panel izquierdo, elija el modelo que quiera usar. Si en el campo aparece «{{ui:params.model.noModels}}», complete antes [Preparar modelos](08-models.md).
2. **Escribir el prompt.** En el campo «{{ui:params.prompt.positive}}», escriba con palabras el dibujo deseado. Por ejemplo, `a lighthouse on a cliff at dusk, calm sea, warm light`: palabras o frases cortas unidas con comas. Con muchos modelos es más fácil obtener lo esperado escribiendo en inglés.
3. **Pulsar {{ui:params.invoke.invoke}}.** Pulse el botón o `Ctrl+Enter`. Sobre la galería de la derecha aparece «{{ui:gallery.generating.title}}», donde se ven el dibujo parcial y el avance. Cuando termina, la imagen aparece en el visor central y también en la galería.

Si el botón está gris y no se puede pulsar, el motivo aparece en la línea situada debajo (por ejemplo, «{{ui:params.readiness.noModel}}»). Al corregirlo, el botón se podrá pulsar.

La imagen creada se guarda automáticamente en la galería. Si no le gusta, basta con cambiar un poco el prompt o los ajustes y volver a pulsar.
Para más detalles, continúe con [Crear imágenes](02-generate.md).
