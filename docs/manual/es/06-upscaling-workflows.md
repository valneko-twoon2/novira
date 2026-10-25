# Ampliación y flujos de trabajo

Este capítulo explica la pestaña **{{ui:app.tabs.upscaling}}**, que amplía imágenes, y la pestaña **{{ui:app.tabs.workflows}}**, donde se conectan los pasos de procesamiento para crear flujos propios.

## Ampliación

![La pestaña Ampliación. En el centro hay una zona para soltar una imagen y tarjetas que muestran los pasos](shot:upscaling)

La pestaña **{{ui:app.tabs.upscaling}}** amplía una imagen añadiendo detalle fino. No se limita a estirarla. Primero amplía la imagen con un modelo de ampliación y después usa el prompt y un ControlNet de tipo tile para volver a dibujar las partes finas.

### Qué se necesita

Hacen falta los dos modelos siguientes. Si no están instalados, aparece un aviso en el panel izquierdo. Desde el botón «{{ui:params.upscale.openModels}}» se puede ir a la pantalla de modelos. Para saber cómo instalarlos, véase el capítulo [Modelos](08-models.md).

- {{ui:params.upscale.model}} (un modelo para ampliar imágenes, como Real-ESRGAN)
- Un {{ui:params.upscale.tileControlnet}} compatible con el modelo principal seleccionado

Cuando no hay ningún modelo de ampliación instalado, el panel izquierdo enumera los candidatos; se elige uno de los marcados como **{{ui:media.choice.recommended}}** y se instala con **{{ui:models.install.install}}**.

### Pasos

1. Arrastrar la imagen que se quiere ampliar desde la galería hasta la tarjeta del centro o hasta el marco **{{ui:params.upscale.title}}** del panel izquierdo. También se puede hacer clic con el botón derecho en una imagen de la galería (en el visor, usar la barra de herramientas) y elegir **{{ui:gallery.menu.upscale}}**, o abrir la imagen en el visor y pulsar `Shift+U`; la pestaña cambia y la imagen entra.
2. Elegir el **{{ui:params.upscale.model}}**.
3. Elegir la **{{ui:params.upscale.scale}}** entre 2x, 4x y 8x. El tamaño del resultado se muestra, por ejemplo «Salida: 2048×2048».
4. Ajustar el resultado con los dos controles deslizantes siguientes.
   - **{{ui:params.upscale.creativity}}**: cuanto más alto, más se aleja de la imagen original y más detalle nuevo añade.
   - **{{ui:params.upscale.structure}}**: cuanto más alto, más conserva las formas y la composición de la imagen original.
5. Elegir el **{{ui:params.upscale.tileControlnet}}**. Si hace falta, elegir también el **{{ui:params.upscale.postProcessing}}** (acaba la imagen dibujada, que después se ajusta al tamaño de salida).
6. Pulsar **{{ui:params.invoke.invoke}}**.

La imagen terminada pasa a la galería.

- El tamaño de salida es de hasta 8192 píxeles por lado. Si se supera, aparece un aviso, así que hay que reducir la escala.
- El prompt influye en el detalle que se añade. Si se introduce el prompt de la imagen original, es más fácil que el resultado coincida con la imagen original.
- Si la imagen ampliada difiere demasiado de la original, hay que bajar **{{ui:params.upscale.creativity}}** y subir **{{ui:params.upscale.structure}}**.

> Para ampliar varias imágenes a la vez, se eligen varias en la galería y se usa **{{ui:gallery.menu.batch}}** en el menú del botón derecho ([Retocar y reutilizar imágenes](04-improve.md)). Esa opción amplía usando solo el modelo de ampliación.

## Flujos de trabajo

![La pestaña Flujos de trabajo. A la derecha, la pantalla donde se dibujan las conexiones entre pasos; a la izquierda, el formulario](shot:workflows)

Un flujo de trabajo es una función para montar un procedimiento de procesamiento, como «cargar un modelo → introducir un prompt → crear una imagen → guardarla», conectando piezas (nodos). Permite construir procedimientos detallados, o flujos que combinan varios tipos de procesamiento, a los que no llega la pestaña Generar de uso diario.

Para empezar, se recomienda abrir una plantilla desde **{{ui:workflows.panel.templates}}** (véase la sección más abajo) y usarla.

La pantalla consta de dos partes.

- Centro: el **{{ui:app.views.editor}}**. Se colocan nodos y se conectan con líneas.
- Panel izquierdo: cinco pestañas, **{{ui:workflows.panel.workflow}}** (el formulario), **{{ui:workflows.panel.templates}}**, **{{ui:workflows.panel.packs}}**, **{{ui:workflows.panel.details}}** y **{{ui:workflows.panel.data}}**.

Para ejecutar un flujo de trabajo, se pulsa el botón **{{ui:params.invoke.invoke}}** de la parte superior del panel izquierdo. Si hay algún problema, como que no haya un nodo de salida (por ejemplo «{{ui:workflows.nodes.save_image.title}}») o que no haya un modelo seleccionado, se muestra el motivo por el que no se puede generar.

### Añadir y conectar nodos

1. Pulsar **{{ui:workflows.toolbar.addNode}}** (＋) en la parte superior izquierda del editor. También se abre con `Shift+A` o `Space` en el teclado.
2. Elegir un nodo de la lista. Se puede filtrar escribiendo palabras en el campo de búsqueda de la parte superior. La lista de la izquierda filtra por tipo de nodo integrado o por extensión instalada.
3. Arrastrar desde un círculo (salida) del lado derecho de un nodo hasta un círculo (entrada) del lado izquierdo de otro nodo para conectarlos. Solo se pueden conectar elementos del mismo tipo.

![La lista que se muestra al añadir un nodo](shot:workflows-add-node)

Hay algunas funciones útiles para conectar.

- Si se suelta una línea en un lugar vacío, en la lista aparecen solo los nodos que se pueden conectar allí. Al elegir uno, el nodo se añade y se conecta de inmediato.
- Si se suelta una línea sobre un nodo, se conecta automáticamente a una entrada compatible.
- Un nodo elegido se quita con `Delete`. `Ctrl+C` y `Ctrl+V` duplican nodos. `Ctrl+Z` deshace y `Ctrl+Shift+Z` rehace.
- Si se arrastra una imagen desde la galería hasta el editor, se añade un nodo «{{ui:workflows.nodes.image.title}}» que contiene esa imagen.
- La flecha a la izquierda del nombre de un nodo lo contrae. Con doble clic en el nombre se renombra.

Los valores de ajuste de un nodo se escriben directamente en el nodo. El valor de una entrada conectada procede de aquello a lo que está conectada.

### La fila de botones

Son los botones de la parte superior izquierda del editor.

| Botón | Qué hace |
|---|---|
| **{{ui:workflows.toolbar.addNode}}** | Añade un nodo. |
| **{{ui:workflows.toolbar.library}}** | Abre la lista de flujos de trabajo. |
| **{{ui:workflows.toolbar.new}}** | Empieza un flujo de trabajo vacío. |
| **{{ui:workflows.toolbar.save}}** (`Ctrl+S`) | Guarda. La primera vez que se guarda, se pide un nombre. |
| **{{ui:workflows.toolbar.optimize}}** | Combina nodos duplicados, quita los nodos que no conducen a una salida y las conexiones innecesarias, y reordena todo de izquierda a derecha. También se puede deshacer. |
| **{{ui:workflows.toolbar.more}}** | **{{ui:common.saveAs}}**, **{{ui:workflows.toolbar.download}}**, **{{ui:workflows.toolbar.loadFromFile}}**. |

Con el engranaje de la parte superior derecha, **{{ui:workflows.settings.title}}**, se pueden activar o desactivar opciones como mostrar el minimapa y ajustar a la cuadrícula.

**{{ui:workflows.settings.autoTidy}}** está activado desde el principio. Al añadir o quitar nodos o líneas, tras un momento reordena automáticamente los nodos de izquierda a derecha y combina los nodos duplicados que hacen el mismo trabajo. Cuando combina alguno, aparece una notificación, y `Ctrl+Z` los recupera. Los nodos que no están conectados no se quitan automáticamente. Si se prefiere ordenar a mano, se desactiva.

Cuando hay cambios sin guardar, aparece un punto junto al nombre. Al cambiar a otro flujo de trabajo, se pregunta si se pueden descartar.

### Usarlo con el formulario

Cuando hay muchos nodos, el editor se vuelve difícil de seguir. Por eso se puede crear un «formulario» que reúna solo los elementos que se cambian con frecuencia durante el uso.

1. En el editor, hacer clic con el botón derecho en un elemento (campo) y elegir **{{ui:workflows.node.addToForm}}**.
2. El elemento se coloca en la pestaña **{{ui:workflows.panel.workflow}}** del panel izquierdo.
3. Pulsar **{{ui:workflows.form.editForm}}** para reordenar o quitar elementos.

Resulta útil cuando se ejecuta algo muchas veces cambiando solo el prompt o el tamaño. Los elementos conectados muestran «{{ui:workflows.form.connected}}».

En la pestaña **{{ui:workflows.panel.details}}** se pueden escribir el nombre, el autor, las etiquetas, la descripción, etc. En la pestaña **{{ui:workflows.panel.data}}** se puede ver el contenido del flujo de trabajo (JSON) y copiarlo.

### La biblioteca de flujos de trabajo

![La biblioteca de flujos de trabajo](shot:workflows-library)

Pulsar **{{ui:workflows.library.button}}** para abrir la lista.

- **{{ui:workflows.library.recent}}**: los que se abrieron recientemente.
- **{{ui:workflows.library.yours}}**: los que se guardaron personalmente.
- **{{ui:workflows.library.defaults}}**: ejemplos que vienen con la aplicación. Antes de modificar un ejemplo, se copia como propio con **{{ui:workflows.library.copyToMine}}**.

Se puede buscar, filtrar por etiqueta y cambiar el orden. Se abre uno con **{{ui:workflows.library.open}}** y se elimina con el botón de la papelera. Aquí también están **{{ui:workflows.library.new}}** y **{{ui:workflows.library.upload}}**.

### Exportar e importar

- Con **{{ui:workflows.toolbar.download}}** se puede exportar un flujo de trabajo como archivo JSON.
- Con **{{ui:workflows.toolbar.loadFromFile}}** (o **{{ui:workflows.library.upload}}**) se puede cargar un archivo exportado o un archivo creado por otra persona.
- Cuando un archivo cargado usa nodos de una extensión que aún no está instalada, aparece un cuadro de diálogo «{{ui:workflows.import.title}}». Tras instalarlas y reiniciar ComfyUI, ese flujo de trabajo se abre automáticamente.
- También se puede extraer un flujo de trabajo de una imagen creada con uno. Se hace clic con el botón derecho en una imagen de la galería y se elige **{{ui:gallery.menu.loadWorkflow}}** (en el visor, también con la tecla `W`). Incluso para una imagen creada con la generación normal, se puede construir el mismo flujo a partir de sus ajustes. Se elige **{{ui:gallery.menu.sendToWorkflow}}** cuando se quiere usar esa imagen como imagen de entrada de un flujo de trabajo.

> Un flujo de trabajo creado por otra persona es una cadena de programas que se ejecutan en el ordenador. No se debe cargar un archivo cuyo origen se desconoce.

## Plantillas

La pestaña **{{ui:workflows.panel.templates}}** enumera plantillas para combinaciones de uso frecuente.

- Pulsar **{{ui:workflows.templates.open}}** para abrirla como un flujo de trabajo nuevo.
- Pulsar **{{ui:workflows.templates.add}}** para añadirla a la derecha del editor actual.
- Los modelos y las imágenes se eligen después de abrirla.

En una plantilla que necesita extensiones aparece un campo «Requiere». Se pulsa **{{ui:workflows.templates.installPacks}}** para instalarlas y se reinicia ComfyUI con el botón **{{ui:workflows.templates.restartFirst}}**, y ya se puede abrir.

Las plantillas disponibles son las siguientes.

| Plantilla | Qué hace | Extensiones necesarias |
|---|---|---|
| **{{ui:workflows.templates.text2image.title}}** | La forma básica que crea una imagen a partir de un modelo y un prompt y la guarda. | Ninguna |
| **{{ui:workflows.templates.text2imageUpscale.title}}** | Amplía una imagen creada a 1024 hasta 2048 y la guarda. | Ninguna |
| **{{ui:workflows.templates.loraStack.title}}** | Conecta LoRA al modelo una tras otra para añadir estilo artístico y detalle. | Ninguna |
| **{{ui:workflows.templates.image2image.title}}** | Vuelve a dibujar una imagen que ya se tiene con un prompt distinto. | Ninguna |
| **{{ui:workflows.templates.upscale.title}}** | Amplía una imagen en alta definición con un modelo de ampliación. | Ninguna |
| **{{ui:workflows.templates.controlnetCanny.title}}** | Extrae los contornos de una imagen y dibuja algo nuevo conservando esa forma. | Ninguna |
| **{{ui:workflows.templates.imageToVideo.title}}** | Añade movimiento a una sola imagen para crear un vídeo corto. | Ninguna (hace falta un modelo de vídeo) |
| **{{ui:workflows.templates.filmGrain.title}}** | Añade grano fotográfico a una imagen creada. | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.faceRig.title}}** | Cambia la expresión, la mirada y la dirección de la cabeza en una foto de un rostro. | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.tiledUpscale.title}}** | Amplía a 2048 y luego vuelve a dibujar tesela por tesela para añadir detalle. | ComfyUI_UltimateSDUpscale |
| **{{ui:workflows.templates.styleReference.title}}** | Traslada el estilo artístico de una imagen de referencia a la imagen del prompt. | ComfyUI_IPAdapter_plus (y su modelo) |
| **{{ui:workflows.templates.faceDetailer.title}}** | Encuentra los rostros de una imagen creada y los vuelve a dibujar con alta resolución. | Impact Pack e Impact Subpack |
| **{{ui:workflows.templates.removeBackground.title}}** | Conserva solo la persona o el objeto y hace transparente el fondo. | ComfyUI-RMBG |
| **{{ui:workflows.templates.whiteBackground.title}}** | Conserva solo la persona o el objeto y deja el fondo en blanco puro. Sirve como preparación para evitar que el color de fondo de una imagen de referencia pase a la imagen. | ComfyUI-RMBG |
| **{{ui:workflows.templates.poseControl.title}}** | Extrae la pose de la persona de una imagen usada como referencia y dibuja una imagen nueva con la misma postura. | comfyui_controlnet_aux (y un modelo ControlNet para OpenPose) |
| **{{ui:workflows.templates.captionToImage.title}}** | Convierte en texto el contenido de una imagen usada como referencia, lo usa como prompt y dibuja algo nuevo. | La extensión Florence-2 |
| **{{ui:workflows.templates.characterReference.title}}** | Coloca la imagen de un personaje sobre un fondo blanco para usarla como imagen de referencia, ajusta el pelo, los ojos y la ropa, y dibuja una escena nueva. El CFG se establece en un valor más bajo, adecuado para imágenes de referencia. | ComfyUI-RMBG y ComfyUI_IPAdapter_plus |
| **{{ui:workflows.templates.characterPose.title}}** | Dibuja con el aspecto del personaje tomado de una imagen de referencia y la postura tomada de una figura de palos (OpenPose). | Las dos anteriores, además de comfyui_controlnet_aux y un modelo ControlNet para OpenPose |

Las plantillas que usan personajes son para cuando se quiere afinar con un flujo de trabajo la función de [Registrar y usar un personaje](04-improve.md#registrar-y-usar-un-personaje). Normalmente basta con usar un personaje registrado en la pestaña Generar. Una figura de palos con una postura se puede crear con «{{ui:pose.title}}» en el [Lienzo](05-canvas.md).

## Extensiones (paquetes de nodos)

En la pestaña **{{ui:workflows.panel.packs}}** se añaden extensiones a ComfyUI o se quitan. Las extensiones son piezas complementarias que aumentan el número de nodos. Los nodos que se instalan aparecen en **{{ui:workflows.categories.extension}}** dentro de la lista para añadir nodos.

Al principio se muestran grandes mosaicos con la etiqueta «{{ui:workflows.packs.whatToDo}}». Al elegir lo que se quiere hacer (corregir rostros, quitar un fondo, ampliar con más nitidez, etc.), se enumeran con explicaciones las extensiones adecuadas.

1. Pulsar **{{ui:workflows.packs.install}}** en la extensión que se quiere usar.
2. Cuando termina la instalación, aparece «{{ui:workflows.packs.restartNeeded}}». Pulsar **{{ui:workflows.packs.restart}}**.
3. Tras el reinicio, se pueden usar los nodos y las plantillas de esa extensión.

Algunas extensiones llevan una advertencia, como «necesita Git», «la instalación requiere tiempo y espacio» o «ya no se actualiza». Conviene leerla antes de instalar.

Lo que no está en el catálogo se puede instalar con **{{ui:workflows.packs.byAddress}}** introduciendo una dirección de GitHub (con el formato https://github.com/usuario/nombre). Las demás extensiones instaladas aparecen en **{{ui:workflows.packs.others}}**. Una extensión que no se necesite se puede quitar con **{{ui:workflows.packs.remove}}** (se pulsa por segunda vez para confirmar).

Las extensiones se pueden ver en cualquier momento, no solo en la pantalla de Flujos de trabajo. Se pulsa **{{ui:app.nav.extensions}}** (el icono de la pieza de puzle) en la barra lateral izquierda para abrir el **{{ui:workflows.packs.mgr.title}}**. Las extensiones publicadas aparecen como tarjetas; se filtran con **{{ui:workflows.packs.mgr.installed}}**, **{{ui:workflows.packs.mgr.notInstalled}}** o una finalidad de la lista de la izquierda, o se busca por nombre, autor o descripción en el cuadro de la parte superior. **{{ui:workflows.packs.mgr.sort.label}}** empieza por las que tienen más **{{ui:workflows.packs.mgr.sort.downloads}}**. Una tarjeta muestra el autor, la versión, la fecha de actualización y el número de descargas, y aparece **{{ui:workflows.packs.installed}}** en las que ya se tienen. Una que no se tiene se añade con **{{ui:workflows.packs.install}}** en su tarjeta. Al pulsar una tarjeta se abren sus detalles a la derecha, donde se puede comprobar la **{{ui:workflows.packs.mgr.license}}** y el origen, y usar **{{ui:workflows.packs.remove}}** si se quiere quitar. Una extensión que no está en la lista se puede instalar introduciendo su dirección de GitHub en **{{ui:workflows.packs.mgr.addTitle}}**, en la parte superior. Tras añadir o quitar extensiones, se pulsa **{{ui:workflows.packs.restart}}** en la misma pantalla para aplicar el cambio. Los detalles de cada tarjeta tienen un botón **{{ui:agent.ask.button}}**, y **{{ui:agent.ask.resultsButton}}** aparece al escribir una palabra en el cuadro de búsqueda. Al pulsarlo, el asistente de IA explica qué hace la extensión y cómo se usa (véase [Asistente de IA y ajustes](09-assistant-settings.md)).

Los detalles muestran la **{{ui:workflows.packs.version.label}}** instalada ahora. **{{ui:workflows.packs.version.change}}** aparece solo cuando el repositorio de la extensión publica versiones; se pulsa para ver las versiones que se pueden elegir y **{{ui:workflows.packs.version.apply}}** para cambiar a una. La versión que se tiene ahora está marcada como **{{ui:workflows.packs.installed}}**. Una extensión que no publica versiones no tiene ese botón. Para aplicar el cambio, se pulsa **{{ui:workflows.packs.restart}}** en la misma pantalla. Una versión que se sabe que otra extensión o ComfyUI no admite está marcada como **{{ui:workflows.packs.version.deprecated}}**, junto con el nombre de lo que no la admite. A una extensión colocada manualmente no se le puede cambiar la versión desde aquí.

También se puede cambiar la versión de ComfyUI en la misma pantalla. Se pulsa la tarjeta **{{ui:workflows.packs.version.comfyTitle}}** de la parte superior de la lista y después **{{ui:workflows.packs.version.change}}** a la derecha para enumerar las versiones que se pueden elegir. Tras pulsar **{{ui:workflows.packs.version.apply}}**, se pulsa **{{ui:workflows.packs.version.confirm}}** una vez más para iniciar el cambio. Todas las extensiones que se tienen se instalan de nuevo, por lo que tarda unos minutos y no se pueden crear imágenes hasta que termine. Si la nueva versión no arranca, se restablece la anterior.

> Las extensiones son programas que se ejecutan en el ordenador. No se deben instalar las que tengan un origen desconocido.

> Cuando se está conectado a un ComfyUI que la aplicación no gestiona, no se puede instalar desde esta pantalla. Hay que instalar en ese propio ComfyUI.

Las funciones que usan extensiones, como «{{ui:cutout.menu}}» y «{{ui:facefix.menu}}» en [Retocar y reutilizar imágenes](04-improve.md), guían la instalación de la misma manera cuando resulta necesaria.
