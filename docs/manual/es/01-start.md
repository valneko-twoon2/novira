# Primeros pasos

## Qué se puede hacer con novira

novira es una aplicación de escritorio para Windows que crea imágenes, vídeo, música y voz.
Basta con escribir un prompt (la descripción de lo que se quiere crear) y pulsar el botón **{{ui:params.invoke.invoke}}**: el dibujo se genera en el propio ordenador y aparece en la galería de la derecha.
La estructura de la pantalla y su manejo se basan en la herramienta de generación de imágenes InvokeAI. Quien ya la haya usado se sentirá en casa.

En líneas generales, se puede hacer lo siguiente:

- Crear imágenes a partir de texto (el tema central de esta guía)
- Rehacer una imagen a partir de otra, repintar solo una parte y ampliar
- Crear vídeo, música, voz, logotipos e imágenes con texto
- Consultar al agente sobre los ajustes y el prompt

> El dibujo se genera en el propio ordenador. Las funciones que usan internet, como buscar y descargar modelos o el agente, solo se conectan cuando se decide usarlas.

## Cómo se crean las imágenes

novira consta de 4 piezas.

| Pieza | Función |
|---|---|
| novira (esta aplicación) | Pantallas, galería, cola de espera y gestión de modelos |
| Motor de generación de imágenes (ComfyUI) | La parte que realmente dibuja. novira lo instala y lo inicia por sí misma |
| Modelos | Datos de aprendizaje para dibujar. Cada uno es un archivo de varios GB que se consigue aparte del motor |
| Carpeta de datos | Lugar donde se guardan las imágenes creadas, los modelos, el propio motor, etc. |

No hace falta instalar el motor a mano. novira lo instala automáticamente la primera vez que se inicia.
El motor y sus componentes (Python, etc.) se instalan solo dentro de la carpeta de datos de novira. No se modifica ningún otro lugar del ordenador ni ningún Python que ya exista.

La primera vez que se inicia la aplicación, una pantalla pregunta dónde se instalan la carpeta de datos y el motor (ComfyUI). Pulse «{{ui:firstrun.start}}» para dejar los lugares estándar, o pulse «{{ui:firstrun.choose}}» en una fila para elegir otra carpeta. Ambos se pueden cambiar más tarde en Motor, dentro de los ajustes. La carpeta de datos es la que se usa para mover o copiar las imágenes y los modelos.

> La generación de imágenes usa la GPU (tarjeta gráfica). De forma predeterminada, novira instala el motor para GPU de NVIDIA.

El modelo determina el estilo de dibujo. Hace falta uno para empezar. En [Preparar modelos](08-models.md) se explica cómo incorporarlo.

## Al iniciar por primera vez

Al abrir la aplicación aparece primero la pantalla de inicio, con el logotipo.
Debajo aparece una tarjeta que indica lo que la aplicación está haciendo en ese momento.

En el primer inicio comienza la instalación del motor de generación de imágenes. La tarjeta muestra 3 fases, una tras otra.

1. **{{ui:splash.step.downloading}}**: se descargan ComfyUI y Python. También se muestran el tamaño, la velocidad y una estimación del tiempo restante.
2. **{{ui:splash.step.extracting}}**: se extraen los archivos descargados.
3. **{{ui:splash.step.starting}}**: se inicia el motor y novira espera a que se conecte.

> {{ui:engine.firstRunNote}}

La instalación se hace una sola vez. A partir del segundo inicio, la pantalla de inicio termina en unos segundos y el motor arranca enseguida.

Mientras la descarga está en curso, el botón **{{ui:splash.open}}** situado bajo la tarjeta abre la aplicación antes de que termine. La descarga continúa en segundo plano y la banda de la parte superior muestra su avance. No se pueden crear imágenes hasta que el motor esté listo.

Cuando el motor está listo, la pantalla de inicio desaparece y se abre la pantalla principal.
Mientras se cargan los datos aparece «{{ui:splash.wait.heading.loading}}», y mientras se cargan el motor y la información necesaria para editar aparece «{{ui:splash.wait.heading.preparing}}».

### Mensajes en la parte superior de la pantalla

Si, después de abrir la aplicación, el motor se reinicia o se vuelve a instalar, aparece una banda (banner) en el centro de la parte superior de la pantalla para informar de lo que ocurre.

- «{{ui:engine.title.downloading}}», «{{ui:engine.title.extracting}}», «{{ui:engine.title.starting}}»: trabajo en curso. No se puede empezar a generar hasta que termine. Al terminar, la banda desaparece sola.
- «{{ui:engine.title.error}}»: no se pudo preparar el motor. El motivo aparece en la línea situada debajo de la banda.

Si se produce un error en la pantalla de inicio, debajo del motivo aparece el botón **{{ui:splash.open}}**. Al pulsarlo se abre la aplicación sin el motor. Se pueden revisar los modelos y cambiar los ajustes, pero no crear imágenes.
Si el error persiste, consulte [Solución de problemas](10-troubleshooting.md).

## Recorrido por la pantalla

![Vista general de la pestaña Generar. A la izquierda el panel de parámetros, en el centro la pantalla de inicio y a la derecha el tablero y la galería](shot:generate)

De izquierda a derecha, la pantalla se organiza así:

- La estrecha banda vertical del extremo izquierdo: la **navegación lateral**. Sirve para cambiar de pestaña.
- El panel izquierdo: el **panel de parámetros**. Contiene los ajustes para crear imágenes, como el prompt y el modelo.
- El centro: la **vista principal**. Es el área de trabajo, que cambia según la pestaña: pantalla de inicio, visor de imágenes, lienzo, etc.
- El panel derecho: la **galería**. Muestra los tableros (algo parecido a carpetas) y las miniaturas de las imágenes creadas.
- El extremo derecho de la franja fina de la parte inferior: la **campana** ({{ui:app.notifications.title}}). Muestra las notificaciones recibidas hasta ahora. Si hay alguna sin ver, indica cuántas.

### Navegación lateral (pestañas)

| Pestaña | Para qué sirve | Tecla numérica |
|---|---|---|
| **{{ui:app.tabs.generate}}** | Crear imágenes. Con los iconos de la parte superior también se puede cambiar a vídeo, música, voz, logotipo y texto. El último icono de esa fila, **{{ui:app.tabs.comic}}**, cambia a la creación de páginas de cómic (la tecla `1` abre el que se haya usado en último lugar de los dos) | `1` |
| **{{ui:app.tabs.canvas}}** | Colocar imágenes, añadirles trazos o repintar solo una parte | `2` |
| **{{ui:app.tabs.upscaling}}** | Agrandar una imagen añadiendo detalles finos | `3` |
| **{{ui:app.tabs.workflows}}** | Conectar piezas (nodos) para crear un procedimiento de generación propio | `4` |
| **{{ui:app.tabs.models}}** | Ver la lista de los modelos disponibles, instalarlos y eliminarlos | `5` |
| **{{ui:app.tabs.browse}}** | Buscar modelos en internet e incorporarlos | `6` |
| **{{ui:app.tabs.queue}}** | Ver o detener la cola de espera de generación. Una insignia indica cuántos elementos esperan | `7` |
| **{{ui:app.nav.extensions}}** | Buscar extensiones de ComfyUI, e instalarlas o quitarlas | `8` |

En la parte inferior de la navegación lateral también hay lo siguiente:

- **{{ui:app.nav.settings}}**: desde su menú se abren {{ui:app.nav.settings}}, {{ui:app.nav.hotkeys}} y {{ui:app.nav.about}}.
- El logotipo «n» de la parte superior: abre {{ui:app.nav.about}}.

El uso de cada una se explica en los capítulos siguientes.

- {{ui:app.tabs.generate}}, {{ui:app.tabs.queue}}: [Crear imágenes](02-generate.md)
- Galería y visor: [La galería y el visor](03-gallery.md)
- {{ui:app.tabs.canvas}}: [Añadir trazos en el lienzo](05-canvas.md)
- {{ui:app.tabs.comic}}: [Dibujar un cómic](12-comic.md)
- {{ui:app.tabs.upscaling}}, {{ui:app.tabs.workflows}}: [Ampliación y flujos de trabajo](06-upscaling-workflows.md)
- Vídeo, música, voz, etc.: [Vídeo, música, voz, logotipos y texto](07-media.md)
- {{ui:app.tabs.models}}, {{ui:app.tabs.browse}}: [Preparar modelos](08-models.md)
- {{ui:agent.title}}, {{ui:app.nav.settings}}: [El agente y los ajustes](09-assistant-settings.md)

### Pestañas centrales (inicio, visor, borradores)

En la parte superior del centro de la pestaña {{ui:app.tabs.generate}} hay 3 pestañas pequeñas.

- **{{ui:app.views.launchpad}}**: guía para empezar. Muestra tarjetas como «{{ui:params.launchpad.generate.textTitle}}» y «{{ui:params.launchpad.generate.refTitle}}», junto con consejos de atajos.
- **{{ui:app.views.viewer}}**: lugar para ver una imagen en grande. Al elegir una imagen en la galería, se muestra aquí.
- **{{ui:app.views.drafts}}**: pantalla donde se alinean muchos candidatos dibujados a medias con los mismos ajustes y distinta semilla, para terminar de dibujar solo los que gustan.

Las demás pestañas también tienen sus propias pestañas pequeñas (por ejemplo, la pestaña {{ui:app.tabs.canvas}} tiene {{ui:app.views.canvas}}).

### Ocultar los paneles

Para ver la imagen más grande se pueden ocultar los paneles izquierdo y derecho.

- Los botones con una pequeña flecha en el borde superior del centro abren y cierran el panel izquierdo y el derecho (la galería y el agente).
- Con el teclado, `T` alterna el panel izquierdo, `G` el derecho y `F` ambos a la vez.
- Al arrastrar el límite entre paneles se cambia su ancho. El ancho se recuerda solo mientras la aplicación está abierta; al volver a iniciarla, vuelve al ancho inicial.

> Los atajos de una sola letra, como `T`, `G` y `F`, no funcionan mientras se está escribiendo en un campo. Salga primero del campo y después pulse la tecla.

## Crear la primera imagen (3 pasos)

Este es el procedimiento para crear una imagen por primera vez. Se supone que ya hay un modelo instalado.

1. **Elegir el modelo.** En el campo de modelo, situado en la parte superior del panel izquierdo, elija el modelo que quiera usar. Si en el campo aparece «{{ui:params.model.noModels}}», complete antes [Preparar modelos](08-models.md).
2. **Escribir el prompt.** En el campo «{{ui:params.prompt.positive}}», describa con palabras la imagen deseada. Por ejemplo, `a lighthouse on a cliff at dusk, calm sea, warm light`: palabras o frases cortas unidas con comas. Con muchos modelos es más fácil obtener lo esperado escribiendo en inglés.
3. **Pulsar {{ui:params.invoke.invoke}}.** Haga clic en el botón o pulse `Ctrl+Enter`. Sobre la galería de la derecha aparece «{{ui:gallery.generating.title}}», donde se ven el dibujo parcial y el avance. Cuando termina, la imagen aparece en el visor central y también en la galería.

Si el botón está gris y no se puede pulsar, el motivo aparece en la línea situada debajo (por ejemplo, «{{ui:params.readiness.noModel}}»). Al corregirlo, el botón se podrá pulsar.

La imagen creada se guarda automáticamente en la galería. Si no le gusta, basta con cambiar un poco el prompt o los ajustes y volver a pulsar.
Para más detalles, continúe con [Crear imágenes](02-generate.md).
