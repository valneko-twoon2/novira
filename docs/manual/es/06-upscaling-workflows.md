# Ampliación y flujos de trabajo

Este capítulo explica **{{ui:app.tabs.upscaling}}**, que agranda imágenes, y la pestaña **{{ui:app.tabs.workflows}}**, donde se conectan pasos de procesamiento por cuenta propia para crear un procedimiento propio.

## Ampliación

![La pantalla Ampliación. En el centro hay una zona donde soltar una imagen y tarjetas que muestran los pasos](shot:upscaling)

Abra **{{ui:app.tabs.upscaling}}** con el icono del marco de la barra lateral de la izquierda (también se abre con la tecla 3). Agranda una imagen añadiéndole detalles finos. No se limita a estirarla. Primero agranda la imagen con un modelo de ampliación y después usa el prompt y un ControlNet de teselas para volver a dibujar las partes finas. Una imagen grande se divide en teselas del tamaño aproximado de la imagen original, y cada tesela se vuelve a dibujar y se une a las demás. El modelo dibuja con un tamaño que maneja bien, así que la imagen no se deshace, y el tiempo crece aproximadamente con el número de teselas. Cada tesela se dibuja con todo el prompt, de modo que con un prompt que nombra a una persona pueden añadirse figuras o rostros pequeños en teselas de cielo o de fondo. En ese caso, baje **{{ui:params.upscale.creativity}}** o deje en el prompt solo palabras sobre calidad y textura.

### Qué se usa

La ampliación usa los dos modelos siguientes. Si no están instalados, aparece un aviso en el panel izquierdo. Desde el botón «{{ui:params.upscale.openModels}}» se puede ir a la pantalla de modelos. Para saber cómo instalarlos, consulte el capítulo [Modelos](08-models.md).

- {{ui:params.upscale.model}} (un modelo para agrandar imágenes, como Real-ESRGAN)
- Un {{ui:params.upscale.tileControlnet}} que encaje con el modelo principal seleccionado (al instalarlo se elige uno automáticamente. Las familias que no tienen ninguno, como Anima y Qwen-Image, vuelven a dibujar sin ControlNet de teselas; entonces **{{ui:params.upscale.structure}}** no tiene efecto, así que baje **{{ui:params.upscale.creativity}}** para conservar las formas)

Cuando no hay ningún modelo de ampliación instalado, el panel izquierdo lista los candidatos; elija uno de los marcados como **{{ui:media.choice.recommended}}** e instálelo con **{{ui:models.install.install}}**.

### Pasos

1. Arrastre la imagen que quiere agrandar desde la galería hasta la tarjeta del centro o hasta el marco **{{ui:params.upscale.title}}** del panel izquierdo. También puede hacer clic derecho en una imagen de la galería (en el visor, use la barra de herramientas) y elegir **{{ui:gallery.menu.upscale}}**, o abrir una imagen en el visor y pulsar `Shift+U`; la pestaña cambia y la imagen entra.
2. Elija el **{{ui:params.upscale.model}}**.
3. Elija la **{{ui:params.upscale.scale}}** entre 2x, 4x y 8x. El tamaño del resultado se muestra, como «Salida: 2048×2048».
4. Ajuste el resultado con los dos controles deslizantes siguientes.
   - **{{ui:params.upscale.creativity}}**: cuanto más alto, más se aparta de la imagen original y más detalles nuevos añade.
   - **{{ui:params.upscale.structure}}**: cuanto más alto, más conserva las formas y la composición de la imagen original.
5. Compruebe el **{{ui:params.upscale.tileControlnet}}** (ya hay uno adecuado elegido). Si hace falta, elija también el **{{ui:params.upscale.postProcessing}}** (termina la imagen dibujada, que después se ajusta al tamaño de salida).
6. Pulse **{{ui:params.invoke.invoke}}**.

La imagen terminada va a la galería.

- El tamaño de salida es de hasta 8192 píxeles por lado. Si se supera, aparece un aviso, así que baje la escala.
- El prompt afecta a los detalles que se añaden. Si introduce el prompt de la imagen original, es más probable que la dirección de la imagen coincida.
- Si la imagen tras agrandarla difiere demasiado de la original, baje **{{ui:params.upscale.creativity}}** y suba **{{ui:params.upscale.structure}}**.

> Para agrandar varias imágenes a la vez, elija varias en la galería y use **{{ui:gallery.menu.batch}}** en el menú del clic derecho ([Retocar y reutilizar imágenes](04-improve.md)). Eso agranda usando solo el modelo de ampliación.

## Flujos de trabajo

![La pestaña Flujos de trabajo. A la derecha, la pantalla donde se dibujan las conexiones entre pasos; a la izquierda, el formulario](shot:workflows)

Un flujo de trabajo es una función para armar un procedimiento de procesamiento, como «cargar un modelo → introducir un prompt → crear una imagen → guardarla», conectando piezas (nodos). Se pueden crear procedimientos detallados, o flujos que combinan varios tipos de procesamiento, a los que no llega la pestaña Generar de uso diario.

Para empezar, se recomienda abrir una plantilla desde **{{ui:workflows.panel.templates}}** (véase la sección de más abajo) y usarla.

La pantalla consta de dos partes.

- Centro: el **{{ui:app.views.editor}}**. Se colocan nodos y se conectan con líneas.
- Panel izquierdo: seis pestañas, **{{ui:workflows.panel.workflow}}** (el formulario), **{{ui:workflows.panel.nodes}}**, **{{ui:workflows.panel.templates}}**, **{{ui:workflows.panel.packs}}**, **{{ui:workflows.panel.details}}** y **{{ui:workflows.panel.data}}**.

Para ejecutar un flujo de trabajo, pulse el botón **{{ui:params.invoke.invoke}}** de la parte superior del panel izquierdo. Si hay un problema, como que no hay nodo de salida (por ejemplo, «{{ui:workflows.nodes.save_image.title}}») o que no hay modelo seleccionado, se muestra el motivo por el que no se puede generar.

Todos los nodos que se conectan participan en la ejecución. **{{ui:workflows.nodes.controlnet.title}}**, **{{ui:workflows.nodes.ip_adapter.title}}**, **{{ui:workflows.nodes.img_resize.title}}**, **{{ui:workflows.nodes.canny_edge_detection.title}}** y los demás funcionan tal como se conectaron. **{{ui:workflows.nodes.ip_adapter.title}}** necesita una extensión y un modelo (un codificador de imagen). Lo que todavía no se puede ejecutar es **{{ui:workflows.nodes.collect.title}}**, **{{ui:workflows.nodes.iterate.title}}** y **{{ui:workflows.nodes.range.title}}**, el desenfoque de caja y un nodo de cálculo alimentado por un **{{ui:workflows.nodes.rand_int.title}}**. El motivo se muestra en la lista de problemas de arriba.

### Añadir y conectar nodos

La pestaña **{{ui:workflows.panel.nodes}}** del panel izquierdo lista todos los nodos que se pueden añadir, ordenados como los ordena ComfyUI. Bajo los encabezados **{{ui:workflows.nodeLibrary.section.core}}** y **{{ui:workflows.picker.extensions}}** hay carpetas por tipo (modelo, imagen, vídeo, etc.), en el mismo orden que en ComfyUI, y los nodos integrados propios de la aplicación están en la carpeta de su tipo; ábrala para ver las carpetas y los nodos que contiene. Bajo **{{ui:workflows.picker.extensions}}**, cada extensión tiene una carpeta con su nombre y sus categorías dentro. Una búsqueda lista los nodos que coinciden junto con la carpeta en que está cada uno. Haga doble clic en un nodo (o selecciónelo y pulse `Enter`) para ponerlo en medio del lienzo, o arrástrelo al lienzo para ponerlo donde lo suelte. Así se puede seguir añadiendo sin que una lista cubra la pantalla. Las otras formas son las siguientes.

1. Pulse `Shift+A` o `Space` en el teclado para abrir una lista donde elegir un nodo.
2. Elija un nodo de la lista. Se puede acotar escribiendo palabras en el campo de búsqueda de arriba. La lista de la izquierda acota por tipo de nodo integrado, por tipo de nodo propio de ComfyUI o por extensión instalada.
3. Arrastre desde un círculo (salida) del lado derecho de un nodo hasta un círculo (entrada) del lado izquierdo de otro nodo para conectarlos. Solo se pueden conectar cosas del mismo tipo.

![La lista que se muestra al añadir un nodo](shot:workflows-add-node)

Hay algunas funciones útiles para conectar.

- Si suelta una línea en un lugar vacío, en la lista solo aparecen los nodos que se pueden conectar allí. Al elegir uno, el nodo se añade y se conecta de inmediato.
- Si suelta una línea sobre un nodo, se conecta automáticamente a una entrada que encaje.
- Un nodo elegido se quita con `Delete`. `Ctrl+C` y `Ctrl+V` duplican nodos. `Ctrl+Z` deshace y `Ctrl+Shift+Z` rehace.
- Si arrastra una imagen de la galería al editor, se añade un nodo «{{ui:workflows.nodes.image.title}}» que contiene esa imagen.
- La flecha a la izquierda del nombre de un nodo contrae el nodo. Haga doble clic en el nombre para renombrarlo.

Los valores de ajuste de un nodo se escriben directamente en el nodo. El valor de una entrada conectada procede de aquello a lo que está conectada.

### Crear música y vídeo en un flujo de trabajo

La pestaña **{{ui:workflows.panel.nodes}}** del panel izquierdo y la lista de la izquierda de la lista de nodos tienen un grupo **{{ui:workflows.picker.core}}**. Contiene los nodos que ComfyUI tiene de serie, ordenados por tipo (audio, vídeo, muestreo, etc.), y entre ellos están los nodos que crean música y vídeo. Se pueden combinar libremente con los nodos integrados.

- Abra las plantillas **{{ui:workflows.templates.musicAceStep.title}}**, **{{ui:workflows.templates.videoWan22.title}}** o **{{ui:workflows.templates.videoWan22Image.title}}** y se ejecutan enseguida. Usan los modelos que descargó en la pestaña Música y en la pestaña Vídeo.
- Elija el formato en el nodo que guarda el resultado (Save Audio o Save Video). Los ajustes que necesita ese formato, como la calidad de un MP3, aparecen debajo.
- La música o el vídeo que cree van a la galería. La galería maneja MP3, WAV y FLAC para música y MP4 para vídeo. Si elige Opus, WebM u otro formato, un mensaje indica que el formato no se puede conservar y la ejecución se detiene.
- Se puede elegir música o vídeo de la galería con el nodo Load Audio o Load Video y conectarlo.
- El nodo **{{ui:workflows.nodes.voice_speak.title}}** (grupo **{{ui:workflows.categories.audio}}**) crea un sonido con un texto leído en voz alta. Usa el motor de la pestaña Voz (Qwen3-TTS), que hay que instalar antes. Conecte el sonido a un nodo que admita sonido: Save Audio lo conserva como MP3 u otro formato, y el audio de Create Video pone la voz en un vídeo (un sonido más largo que el vídeo se corta al final del vídeo). Las plantillas **{{ui:workflows.templates.voiceRead.title}}** y **{{ui:workflows.templates.videoNarration.title}}** funcionan tal cual.
- Una semilla que no tiene conectado ningún «Entero aleatorio» da el mismo resultado siempre. Las plantillas tienen uno conectado desde el principio.
- Los nombres, los campos y las carpetas de los nodos propios de ComfyUI usan las mismas palabras que las pantallas de ComfyUI en su idioma. Las palabras que ComfyUI no tiene traducidas (como las de los nodos de las extensiones) se quedan en inglés. Cuántos nodos hay depende de la versión de ComfyUI.

### La fila de botones

Estos son los botones de la parte superior izquierda del editor.

| Botón | Función |
|---|---|
| **{{ui:workflows.toolbar.new}}** | Empieza un flujo de trabajo vacío. |
| **{{ui:workflows.toolbar.save}}** (`Ctrl+S`) | Guarda. La primera vez que se guarda, se pide un nombre. |
| **{{ui:workflows.toolbar.optimize}}** | Fusiona nodos duplicados, quita los nodos que no llevan a una salida y las conexiones que no hacen falta, y reordena todo de izquierda a derecha. También se puede deshacer. |
| **{{ui:workflows.toolbar.more}}** | **{{ui:common.saveAs}}**, **{{ui:workflows.toolbar.download}}**, **{{ui:workflows.toolbar.loadFromFile}}**. |

Con el engranaje de la parte superior derecha, **{{ui:workflows.settings.title}}**, se pueden activar y desactivar cosas como mostrar el minimapa y ajustar a la cuadrícula.

**{{ui:workflows.settings.autoTidy}}** está desactivado desde el principio. Cuando se activa y después se añaden o quitan nodos o líneas, al cabo de un momento reordena automáticamente los nodos de izquierda a derecha y fusiona los nodos duplicados que hacen el mismo trabajo. Cuando fusiona alguno, aparece una notificación, y `Ctrl+Z` los devuelve. Los nodos que no están conectados no se quitan automáticamente. Si quiere ordenarlo usted mismo, déjelo desactivado.

Cuando hay cambios sin guardar, aparece un punto junto al nombre. Al cambiar a otro flujo de trabajo, se pregunta si se descartan.

### Usarlo con el formulario

Cuando hay muchos nodos, el editor se vuelve difícil de seguir. Por eso se puede crear un «formulario» que reúne solo los elementos que se cambian a menudo mientras se usa.

1. En el editor, haga clic derecho en un elemento (campo) y elija **{{ui:workflows.node.addToForm}}**.
2. El elemento se alinea en la pestaña **{{ui:workflows.panel.workflow}}** del panel izquierdo.
3. Pulse **{{ui:workflows.form.editForm}}** para reordenar o quitar elementos.

Es útil cuando se ejecuta algo muchas veces cambiando solo el prompt o el tamaño. Los elementos conectados muestran «{{ui:workflows.form.connected}}».

En la pestaña **{{ui:workflows.panel.details}}** se pueden escribir el nombre, el autor, las etiquetas, la descripción, etc. En la pestaña **{{ui:workflows.panel.data}}** se puede ver el contenido del flujo de trabajo (JSON) y copiarlo.

### La biblioteca de flujos de trabajo

![La biblioteca de flujos de trabajo](shot:workflows-library)

Pulse la tarjeta **{{ui:workflows.library.button}}** de la parte superior del panel izquierdo, sobre el botón Generar (muestra el nombre del flujo de trabajo abierto), para abrir la lista.

- **{{ui:workflows.library.recent}}**: los que abrió hace poco.
- **{{ui:workflows.library.yours}}**: los que guardó usted mismo.
- **{{ui:workflows.library.defaults}}**: ejemplos que vienen con la aplicación. De un ejemplo, haga una copia para usted con **{{ui:workflows.library.copyToMine}}** antes de cambiarlo.

Se puede buscar, filtrar por etiqueta y cambiar el orden. Abra uno con **{{ui:workflows.library.open}}** y elimine uno con el botón de la papelera. **{{ui:workflows.library.new}}** y **{{ui:workflows.library.upload}}** también están aquí.

### Exportar e importar

- Con **{{ui:workflows.toolbar.download}}** se puede exportar un flujo de trabajo como archivo JSON.
- Con **{{ui:workflows.toolbar.loadFromFile}}** (o **{{ui:workflows.library.upload}}**) se puede cargar un archivo exportado o un archivo creado por otra persona.
- Cuando un archivo cargado usa nodos de una extensión que todavía no está instalada, aparece un cuadro de diálogo «{{ui:workflows.import.title}}». Tras instalarlas y reiniciar ComfyUI, ese flujo de trabajo se abre automáticamente.
- También se puede extraer un flujo de trabajo de una imagen creada con uno. Haga clic derecho en una imagen de la galería y elija **{{ui:gallery.menu.loadWorkflow}}** (cuando la imagen está abierta en el visor, también funciona la tecla `W`). Incluso para una imagen creada con la generación normal, se puede armar el mismo flujo a partir de sus ajustes. Elija **{{ui:gallery.menu.sendToWorkflow}}** cuando quiera usar esa imagen como imagen de entrada de un flujo de trabajo.

> Un flujo de trabajo creado por otra persona es una cadena de programas que se ejecutan en su ordenador. No cargue un archivo cuyo origen no conozca.

## Plantillas

La pestaña **{{ui:workflows.panel.templates}}** alinea plantillas para combinaciones de uso habitual.

- Pulse **{{ui:workflows.templates.open}}** para abrirla como un flujo de trabajo nuevo.
- Pulse **{{ui:workflows.templates.add}}** para añadirla a la derecha del editor actual.
- Los modelos y las imágenes se eligen después de abrirla.

En una plantilla que necesita extensiones, aparece un campo «Necesita». Pulse **{{ui:workflows.templates.installPacks}}** para instalarlas. Después reinicie ComfyUI con el botón **{{ui:workflows.templates.restartFirst}}** y la plantilla se podrá abrir. Una plantilla creada con nodos propios de ComfyUI se puede abrir cuando ComfyUI está en marcha.

Las plantillas que se ofrecen son las siguientes.

| Plantilla | Qué hace | Extensiones necesarias |
|---|---|---|
| **{{ui:workflows.templates.text2image.title}}** | La forma básica que crea una imagen a partir de un modelo y un prompt y la guarda. | Ninguna |
| **{{ui:workflows.templates.text2imageUpscale.title}}** | Agranda de 1024 a 2048 una imagen creada y la guarda. | Ninguna |
| **{{ui:workflows.templates.loraStack.title}}** | Conecta LoRA al modelo uno tras otro para añadir estilo de dibujo y detalle. | Ninguna |
| **{{ui:workflows.templates.image2image.title}}** | Redibuja con otro prompt una imagen que ya se tiene. | Ninguna |
| **{{ui:workflows.templates.upscale.title}}** | Agranda en alta definición una imagen con un modelo de ampliación. | Ninguna |
| **{{ui:workflows.templates.controlnetCanny.title}}** | Extrae los contornos de una imagen y dibuja algo nuevo conservando esa forma. | Ninguna |
| **{{ui:workflows.templates.imageToVideo.title}}** | Añade movimiento a una sola imagen para crear un vídeo corto. | Ninguna (hace falta un modelo de vídeo) |
| **{{ui:workflows.templates.videoWan22.title}}** | Crea un vídeo corto a partir de texto con nodos propios de ComfyUI. La duración, el tamaño y el muestreador se pueden cambiar. | Ninguna (hace falta un modelo de vídeo) |
| **{{ui:workflows.templates.videoWan22Image.title}}** | La misma construcción, creando el vídeo a partir de una imagen que se elija. | Ninguna (hace falta un modelo de vídeo) |
| **{{ui:workflows.templates.musicAceStep.title}}** | Crea una canción a partir de etiquetas de estilo y letra. | Ninguna (hace falta un modelo de música) |
| **{{ui:workflows.templates.voiceRead.title}}** | Lee un texto en voz alta y guarda el sonido como MP3. | Ninguna (hacen falta el motor de voz y los modelos) |
| **{{ui:workflows.templates.videoNarration.title}}** | Toma un vídeo de la galería, le pone como sonido un texto leído en voz alta y lo guarda como vídeo nuevo. | Ninguna (hacen falta el motor de voz y los modelos) |
| **{{ui:workflows.templates.filmGrain.title}}** | Añade grano fotográfico a una imagen creada. | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.faceRig.title}}** | Cambia la expresión, la mirada y la dirección de la cabeza en una fotografía de un rostro. | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.tiledUpscale.title}}** | Agranda a 2048 y después vuelve a dibujar tesela a tesela para añadir detalle. | ComfyUI_UltimateSDUpscale |
| **{{ui:workflows.templates.styleReference.title}}** | Aplica el estilo de dibujo de una imagen de referencia a la imagen creada a partir del prompt. | ComfyUI_IPAdapter_plus (y su modelo) |
| **{{ui:workflows.templates.faceDetailer.title}}** | Encuentra los rostros de una imagen creada y los vuelve a dibujar con una resolución alta. | Impact Pack e Impact Subpack |
| **{{ui:workflows.templates.removeBackground.title}}** | Conserva solo a la persona o el objeto y hace transparente el fondo. | ComfyUI-RMBG |
| **{{ui:workflows.templates.whiteBackground.title}}** | Conserva solo a la persona o el objeto y deja el fondo en blanco puro. Es útil para preparar una imagen de referencia, de modo que el color del fondo no pase a la imagen. | ComfyUI-RMBG |
| **{{ui:workflows.templates.poseControl.title}}** | Extrae la pose de la persona de una imagen usada como referencia y dibuja una imagen nueva con la misma postura. | comfyui_controlnet_aux (y un modelo ControlNet para OpenPose) |
| **{{ui:workflows.templates.captionToImage.title}}** | Convierte en texto el contenido de una imagen usada como referencia, lo usa como prompt y dibuja algo nuevo. | La extensión Florence-2 |
| **{{ui:workflows.templates.characterReference.title}}** | Pone la imagen de un personaje sobre fondo blanco para usarla como imagen de referencia, ajusta el pelo, los ojos y la ropa y dibuja una escena nueva. El CFG se fija en un valor más bajo adecuado para imágenes de referencia. | ComfyUI-RMBG y ComfyUI_IPAdapter_plus |
| **{{ui:workflows.templates.characterPose.title}}** | Dibuja con el aspecto del personaje tomado de una imagen de referencia y la postura tomada de una figura de palos (OpenPose). | Las dos anteriores, más comfyui_controlnet_aux y un modelo ControlNet para OpenPose |

Las plantillas que usan personajes son para cuando se quiere afinar con un flujo de trabajo la función de [Registrar y usar un personaje](04-improve.md). Normalmente basta con usar un personaje registrado en la pestaña Generar. Una postura de figura de palos se puede crear con «{{ui:pose.title}}» en el [Lienzo](05-canvas.md).

## Extensiones (nodos personalizados)

En la pestaña **{{ui:workflows.panel.packs}}** se añaden extensiones a ComfyUI o se quitan. Las extensiones son piezas complementarias que aumentan el número de nodos. Los nodos que se instalan aparecen en **{{ui:workflows.categories.extension}}**, en la lista para añadir nodos.

Al principio se alinean grandes mosaicos con la etiqueta «{{ui:workflows.packs.whatToDo}}». Cuando se elige lo que se quiere hacer (arreglar rostros, quitar un fondo, hacerla más grande y nítida, etc.), las extensiones adecuadas se alinean con sus explicaciones.

1. Pulse **{{ui:workflows.packs.install}}** en la extensión que quiere usar.
2. Cuando termina la instalación, aparece «{{ui:workflows.packs.restartNeeded}}». Pulse **{{ui:workflows.packs.restart}}**.
3. Tras el reinicio, se pueden usar los nodos y las plantillas de esa extensión.

Algunas extensiones llevan una advertencia, como «necesita Git», «la instalación lleva tiempo y espacio» o «ya no se actualiza». Léala antes de instalar.

Las que no están en el catálogo se pueden instalar con **{{ui:workflows.packs.byAddress}}** introduciendo una dirección de GitHub (con la forma https://github.com/usuario/nombre). Las demás extensiones instaladas aparecen en **{{ui:workflows.packs.others}}**. Una extensión que no necesite se puede quitar con **{{ui:workflows.packs.remove}}** (púlselo una segunda vez para confirmar).

Las extensiones se pueden ver en cualquier momento, no solo en la pantalla Flujos de trabajo. Pulse **{{ui:app.nav.extensions}}** (el icono de la pieza de puzle) en la barra lateral de la izquierda para abrir el **{{ui:workflows.packs.mgr.title}}**. Las extensiones publicadas aparecen como tarjetas; acótelas con **{{ui:workflows.packs.mgr.installed}}**, **{{ui:workflows.packs.mgr.notInstalled}}** o una finalidad en la lista de la izquierda, o busque por nombre, autor o descripción en el cuadro de la parte superior. Al principio, **{{ui:workflows.packs.mgr.sort.label}}** está en **{{ui:workflows.packs.mgr.sort.downloads}}**, así que las más descargadas van primero. Una tarjeta muestra el autor, la versión, la fecha de actualización y el número de descargas, y **{{ui:workflows.packs.installed}}** en las que ya se tienen. Una extensión que no se tiene se puede instalar con **{{ui:workflows.packs.install}}** en su tarjeta. Pulse una tarjeta para abrir sus detalles a la derecha, compruebe la **{{ui:workflows.packs.mgr.license}}** y el origen, y use **{{ui:workflows.packs.remove}}** si quiere quitarla. Una extensión que no está en la lista se puede instalar introduciendo su dirección de GitHub en **{{ui:workflows.packs.mgr.addTitle}}**, en la parte superior. Tras añadir o quitar extensiones, pulse **{{ui:workflows.packs.restart}}** en la misma pantalla para aplicar el cambio. Los detalles de cada tarjeta tienen un botón **{{ui:agent.ask.button}}**, y **{{ui:agent.ask.resultsButton}}** aparece cuando se escribe una palabra en el cuadro de búsqueda. Púlselo y el agente explica qué hace la extensión y cómo se usa (véase [El agente y los ajustes](09-assistant-settings.md)).

Los detalles muestran la **{{ui:workflows.packs.version.label}}** que está instalada ahora. **{{ui:workflows.packs.version.change}}** aparece solo cuando el repositorio de la extensión publica versiones; púlselo para ver las versiones que se pueden elegir, y **{{ui:workflows.packs.version.apply}}** para cambiar a una. La versión que se tiene ahora está marcada como **{{ui:workflows.packs.installed}}**. Una extensión que no publica versiones no tiene ese botón. Para aplicar el cambio, pulse **{{ui:workflows.packs.restart}}** en la misma pantalla. Una versión que se sabe que otra extensión o ComfyUI no admite está marcada como **{{ui:workflows.packs.version.deprecated}}**, junto con el nombre de lo que no la admite. A una extensión que instaló usted mismo no se le puede cambiar la versión desde aquí.

La versión de ComfyUI también se puede cambiar en la misma pantalla. Pulse la tarjeta **{{ui:workflows.packs.version.comfyTitle}}** de la parte superior de la lista y después **{{ui:workflows.packs.version.change}}**, a la derecha, para listar las versiones que se pueden elegir. Después de pulsar **{{ui:workflows.packs.version.apply}}**, pulse una vez más **{{ui:workflows.packs.version.confirm}}** para iniciar el cambio. Todas las extensiones que se tienen se instalan de nuevo, por lo que tarda unos minutos y no se pueden crear imágenes hasta que termine. Si la nueva versión no arranca, se restaura la anterior.

> Las extensiones son programas que se ejecutan en su ordenador. No instale las que no conozca su origen.

> Cuando se está conectado a un ComfyUI que la aplicación no gestiona, no se puede instalar desde esta pantalla. Instale en ese propio ComfyUI.

Las funciones que usan extensiones, como «{{ui:cutout.menu}}» y «{{ui:facefix.menu}}» en [Retocar y reutilizar imágenes](04-improve.md), guían la instalación de la misma forma cuando hace falta.
