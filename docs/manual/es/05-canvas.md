# Añadir trazos en el lienzo

![La pestaña Lienzo completa. El lienzo está en el centro y la lista de capas abajo a la derecha](shot:canvas)

La pestaña **{{ui:app.tabs.canvas}}** es un banco de trabajo para «dibujar, colocar y repintar solo una parte» de una imagen. Se puede colocar una imagen y extenderla, poner una máscara sobre la parte que se quiere repintar o decidir una pose con una figura de palos.

La pantalla se divide en tres.

- Izquierda: un panel con los mismos ajustes que la pestaña Generar (prompt, modelo, tamaño, etc.). En el lienzo se añade un elemento de **{{ui:params.compositing.title}}**.
- Centro: el lienzo. Encima hay botones de herramientas alineados.
- Derecha: la lista de **{{ui:canvas.layers.title}}**, que contienen sus imágenes.

Si pulsa **{{ui:params.invoke.invoke}}** sin nada puesto, simplemente se crea una imagen dentro del marco de puntos (el área de generación). La verdadera fuerza del lienzo se nota cuando se coloca allí una imagen o un boceto. Las capas y las máscaras se guardan automáticamente y vuelven al abrir de nuevo la aplicación (el historial de deshacer no se guarda).

## Colocar y dibujar imágenes

Hay varias formas de poner una imagen en el lienzo.

- Dibujar con el pincel (elija antes **{{ui:canvas.tool.brush}}** o pulse `B`). Si no hay ninguna capa seleccionada, se crea automáticamente una «{{ui:canvas.add.raster}}».
- Arrastrar una imagen de la galería al lienzo. Aparece un marco para elegir dónde ponerla (trama, control, máscara de inpainting, etc.); suéltela allí.
- Pulsar `Ctrl+V` para pegar una imagen del portapapeles como nueva capa de trama (también se guarda en la galería).
- Hacer clic derecho en una imagen de la galería (en el visor, el icono del pincel) y elegir un destino en **{{ui:gallery.menu.sendToCanvas}}**.

Los destinos son los siguientes.

| Destino | En qué se convierte |
|---|---|
| **{{ui:gallery.canvas.newCanvasRaster}}** | Primero vacía el lienzo y empieza de nuevo con el mismo tamaño que esa imagen. |
| **{{ui:gallery.canvas.newCanvasControl}}** | Empieza de nuevo de la misma forma, pero la imagen se convierte en una capa de control. |
| **{{ui:gallery.canvas.raster}}** | La añade al lienzo actual como capa de trama. |
| **{{ui:gallery.canvas.control}}** | La añade como capa de control. |
| **{{ui:gallery.canvas.inpaint}}** | La añade como máscara de inpainting. |
| **{{ui:gallery.canvas.regional}}** | La añade como imagen de referencia de la guía regional (véase [Guía regional](#guía-regional)). |

## Herramientas

Las herramientas están alineadas en la barra de la parte superior. También se pueden cambiar con teclas de letra del teclado. Al iniciar la aplicación está elegida **{{ui:canvas.tool.view}}**, así que al principio arrastrar sobre el lienzo solo desplaza la vista y no dibuja nada.

| Herramienta | Tecla | Para qué sirve |
|---|---|---|
| **{{ui:canvas.tool.brush}}** | `B` | Dibuja imágenes. El color se cambia con el botón de color de la barra. |
| **{{ui:canvas.tool.eraser}}** | `E` | Borra lo que se dibujó. |
| **{{ui:canvas.tool.mosaic}}** | `M` | Convierte en mosaico la parte sobre la que se pinta (para ocultar algo). El tamaño del bloque es el número de la barra. Solo funciona en una capa con una imagen. |
| **{{ui:canvas.tool.rect}}** | `U` | Rellena un rectángulo. |
| **{{ui:canvas.tool.lasso}}** | `L` | Dibuja una forma libre y la rellena con el color (en una máscara, queda enmascarada). |
| **{{ui:canvas.tool.pose}}** | `O` | Coloca una pose de figura de palos en una capa de control y permite mover las articulaciones (véase «Crear una pose en el lienzo» más abajo). |
| **{{ui:canvas.tool.move}}** | `V` | Mueve capas. Las teclas de flecha desplazan la capa seleccionada 1 px (10 px con Shift). |
| **{{ui:canvas.tool.bbox}}** | `C` | Mueve el área de generación (cuadro delimitador) y cambia su tamaño. |
| **{{ui:canvas.tool.view}}** | `H` | Desplaza la vista. |
| **{{ui:canvas.tool.colorPicker}}** | `I` | Toma un color de la imagen. |
| **{{ui:canvas.tool.bucket}}** | `K` | Rellena la región de colores cercanos al que se pulsa. **{{ui:canvas.toolbar.bucketTolerance}}** en la barra fija cuánto de cercanos. |

También se puede hacer lo siguiente.

- Cambiar el ancho del pincel con **{{ui:canvas.toolbar.brushWidth}}** en la barra, o con las teclas `[` y `]`. `Q` alterna entre la herramienta actual y la usada antes.
- Acercar y alejar con la rueda del ratón o con las teclas `+` y `-`. `Ctrl+0` muestra todo el lienzo y `Ctrl+1` muestra el tamaño real (100 %).
- Para desplazar la vista, arrastrar con `Space` pulsada, o arrastrar pulsando la rueda.
- Con **{{ui:canvas.toolbar.undo}}** (`Ctrl+Z`) y **{{ui:canvas.toolbar.redo}}** (`Ctrl+Shift+Z`) se puede deshacer y rehacer lo dibujado.

El engranaje, **{{ui:canvas.settings.title}}**, contiene cosas como mostrar una cuadrícula, oscurecer el exterior del área de generación, un ajuste que mantiene las líneas dibujadas solo dentro del área de generación y una operación que fusiona en una sola las capas de trama visibles.

## El área de generación (cuadro delimitador)

El marco de puntos del lienzo es «el área donde se crea una imagen esta vez». Cada vez que se genera, solo se crea el interior de este marco, y su tamaño pasa a ser el tamaño de la imagen.

- Cambie a **{{ui:canvas.tool.bbox}}** (`C`) y arrastre el marco para moverlo. Arrastre una esquina o un borde para cambiar su tamaño.
- También se puede decidir el tamaño con **{{ui:params.image.bboxWidth}}** y **{{ui:params.image.bboxHeight}}** en el panel izquierdo.
- **{{ui:canvas.actions.fitBboxToLayers}}** (`Shift+C`) ajusta el marco a las imágenes colocadas.

## Capas

En **{{ui:canvas.layers.title}}**, abajo a la derecha, se listan las cosas colocadas en el lienzo. Se añaden con el botón **+** ({{ui:common.add}}).

![El menú Añadir de las capas abierto](shot:canvas-add-layer)

Las capas son de varios tipos con funciones distintas.

| Tipo | Función |
|---|---|
| **{{ui:canvas.add.raster}}** | Una capa de imagen normal. Se dibuja en ella y se colocan imágenes en ella. Lo que hay aquí se convierte en la «imagen original». |
| **{{ui:canvas.add.control}}** | Una imagen que sirve de pista para la forma, las líneas, la pose, etc. Actúa como una instrucción para la generación y no pasa a formar parte de la imagen. |
| **{{ui:canvas.add.inpaint}}** | Se pinta el área que dice «repinta aquí». |
| **{{ui:canvas.add.regional}}** | Una capa que da un prompt distinto para cada lugar (véase [Guía regional](#guía-regional)). |
| **{{ui:canvas.add.globalRef}}** | Una imagen de referencia que hace que toda la imagen imite un ambiente. Es lo mismo que las imágenes de referencia de la pestaña Generar. |

En la lista de capas se puede hacer lo siguiente.

- El icono del ojo alterna entre visible y oculta, y el icono del candado alterna el bloqueo. Las capas ocultas no se usan para la generación. No se puede dibujar en una capa bloqueada.
- Haga doble clic en un nombre para renombrarla.
- Con el clic derecho se puede duplicar, reordenar (mover hacia delante o hacia atrás; las capas del mismo tipo también se pueden arrastrar dentro de la lista), **{{ui:canvas.entityMenu.flipHorizontal}}**, **{{ui:canvas.entityMenu.flipVertical}}**, **{{ui:canvas.entityMenu.rotateRight}}**, **{{ui:canvas.entityMenu.rotateLeft}}**, **{{ui:canvas.entityMenu.scaleUp}}**, **{{ui:canvas.entityMenu.scaleDown}}**, **{{ui:canvas.pose.random}}** (solo capas de control), convertir a otro tipo, copiar al portapapeles, **{{ui:canvas.entityMenu.saveToGallery}}**, **{{ui:canvas.entityMenu.exportToFile}}** y eliminar.
- Desde **{{ui:canvas.layers.more}}** («…») también se pueden fusionar en una las capas de trama visibles y eliminar todas las capas.

![El menú contextual de una capa](shot:canvas-layer-menu)

Bajo la capa seleccionada se abren los ajustes de esa capa.

- {{ui:canvas.add.inpaint}}: el color y el patrón de relleno de la máscara (afectan solo a cómo se ve en pantalla) y **{{ui:canvas.mask.denoiseLimit}}** (si se activa y se baja, es más probable que la imagen original se conserve incluso dentro de la máscara). En el menú del clic derecho de la máscara, **{{ui:canvas.entityMenu.invertMask}}** intercambia las zonas enmascaradas y las libres dentro del área de generación. **{{ui:canvas.partFix.redraw}}**, **{{ui:canvas.partFix.erase}}** y **{{ui:canvas.partFix.cutOutAction}}** vuelven a dibujar la parte pintada según una instrucción de texto, la borran o la recortan ([Seleccionar una zona y retocarla](04-improve.md)).
- {{ui:canvas.add.control}}: véase la sección siguiente, «{{ui:canvas.add.control}}».

## Cómo se repinta

Al pulsar **{{ui:params.invoke.invoke}}** en el lienzo, la aplicación mira dentro del área de generación y decide automáticamente cómo crear la imagen. No hace falta elegirlo.

| Estado dentro del área de generación | Cómo se crea |
|---|---|
| No hay nada dibujado en las capas de trama visibles | Se crea una imagen nueva a partir de texto (texto a imagen). |
| Solo está rellena una parte de la capa de trama | Se añaden las partes vacías para extenderla (outpainting). Las partes vacías se rellenan primero con un color. |
| Todo está relleno y la máscara de inpainting no tiene pintura | Se toma la imagen actual como base y se vuelve a dibujar (imagen a imagen). |
| Todo está relleno y la máscara de inpainting tiene pintura | Solo se vuelve a dibujar la parte enmascarada (inpainting). Fuera de la máscara, la imagen original se queda como está. |

En imagen a imagen, cuánto cambia se decide con **{{ui:params.image.strength}}** en el panel izquierdo. 0 conserva el original tal cual y 1 lo redibuja por completo.

En el outpainting, con qué se rellenan las partes vacías se elige con **{{ui:params.compositing.infillTitle}}**, dentro de **{{ui:params.compositing.title}}** en el panel izquierdo. Con **{{ui:params.compositing.infill.color}}**, se rellenan con el color que se elija (negro, blanco, gris, etc.). Si se elige otra opción, se rellenan mezclando los colores de alrededor. Lo suave que es la unión se decide con **{{ui:params.compositing.maskBlur}}**.

> El inpainting funciona tal cual con modelos normales. No hace falta un «modelo de inpainting» específico.

## Decidir si se usa el resultado (staging)

Una imagen creada en el lienzo no entra en el lienzo de inmediato. Se muestra sobre el área de generación, y con la barra de abajo (**{{ui:canvas.staging.title}}**) se decide si se usa.

| Botón | Función |
|---|---|
| Flechas izquierda y derecha (`←` `→`) | Cuando se crearon varias, muestra la imagen siguiente o la anterior. Mientras se siguen creando más, la última página es la de generación, y solo esa página muestra la imagen tomando forma. Mientras se mira una imagen terminada, la vista no cambia cuando termina la siguiente. |
| **{{ui:canvas.staging.accept}}** (`Enter`) | Pone esta imagen en el lienzo como nueva capa de trama. Las demás imágenes se descartan. |
| **{{ui:canvas.staging.hideResults}}** | Oculta los resultados para poder comparar con la imagen original. |
| **{{ui:canvas.staging.saveToGallery}}** | Guarda esta imagen en la galería. |
| **{{ui:canvas.staging.discard}}** | Descarta solo esta imagen. |
| **{{ui:canvas.staging.discardAll}}** (`Esc`) | Descarta todo. |

> Las imágenes de resultado no van solas a la galería. Para una imagen que quiera conservar en la galería, pulse antes **{{ui:canvas.staging.saveToGallery}}**. Las imágenes descartadas se pierden.

El asa (⋮⋮) del extremo izquierdo de la barra de resultados sirve para arrastrar una imagen a otro lugar y entregarla.

## Capas de control

Una capa de control es una pista que dice «dibuja siguiendo esta forma, esta línea, esta pose». Se introducen dibujos de líneas, contornos, imágenes de poses, etc.

Para usar una, hace falta un modelo ControlNet que encaje con el modelo principal. Para saber cómo instalarlo, consulte el capítulo [Modelos](08-models.md). Seleccione la capa y elija el **{{ui:common.model}}** en sus ajustes. Si no hay ningún modelo, aparece en el botón Generar un mensaje como «La capa de control 1 no tiene modelo seleccionado» y no se puede crear la imagen.

Los ajustes son los siguientes.

- **{{ui:canvas.control.weight}}**: con cuánta fuerza sigue la pista.
- **{{ui:canvas.control.begin}}** y **{{ui:canvas.control.end}}**: desde qué fracción hasta qué fracción de la generación surte efecto.
- **{{ui:canvas.control.controlMode}}**: están **{{ui:canvas.control.mode.balanced}}** y **{{ui:canvas.control.mode.moreControl}}**. **{{ui:canvas.control.mode.morePrompt}}** se comporta por ahora igual que **{{ui:canvas.control.mode.balanced}}**.
- **{{ui:canvas.control.filter}}**: convierte una imagen en otra pensada como pista, como líneas o profundidad. Es una conversión sencilla hecha dentro de la aplicación. Pruébela con **{{ui:canvas.control.process}}** y, si se ve bien, aplíquela a la imagen con **{{ui:common.apply}}**.

## Crear una pose (figura de palos)

![El cuadro de diálogo para decidir una pose con una figura de palos](shot:pose)

Se puede decidir una pose moviendo una figura de palos. Es útil cuando especificar una pose con palabras no funciona bien.

1. En la pestaña **{{ui:app.tabs.canvas}}**, pulse **+** ({{ui:common.add}}) en las capas y elija **{{ui:pose.menu}}**.
2. En **{{ui:pose.preset}}**, elija la pose más cercana a lo que quiere ({{ui:pose.preset.standing}}, {{ui:pose.preset.armsUp}}, {{ui:pose.preset.sitting}}, {{ui:pose.preset.walking}}).
3. Arrastre los círculos de las articulaciones para cambiar la postura. También se puede seleccionar un círculo y moverlo con las teclas de flecha (con `Shift` pulsada se mueve mucho). **{{ui:pose.mirror}}** la voltea de izquierda a derecha y **{{ui:pose.reset}}** la devuelve a la plantilla original.
4. Elija el **{{ui:pose.size}}**. Normalmente basta con el tamaño del lienzo.
5. Pulse **{{ui:pose.use}}**.

La pose entra en el lienzo como una capa de control. Si el lienzo está vacío, empieza de nuevo con ese tamaño.

Para usarla, hace falta un modelo ControlNet compatible con OpenPose. Si hay uno, la aplicación lo elige automáticamente como modelo de la capa. Si no, se avisa en una notificación. Tras instalar el modelo, elíjalo en los ajustes de la capa.

> Solo se puede decidir la pose de una persona. No se pueden decidir cosas tan finas como los dedos de las manos o la dirección del rostro, así que especifique el rostro y las manos en el prompt.

> Con cuánta fuerza surte efecto la pose se decide con el **{{ui:canvas.control.weight}}** de la capa. Una capa de pose se ajusta desde el principio a la intensidad máxima y para actuar de principio a fin. Si quiere más libertad en la pose, bájelo.

### Crear una pose en el lienzo

![La figura de palos colocada en el lienzo con la herramienta de pose](shot:canvas-pose)

Con la herramienta **{{ui:canvas.tool.pose}}** (`O`) se puede crear una pose directamente en el lienzo. Una pose colocada se puede volver a ajustar tantas veces como se quiera.

- Haga clic en un lugar vacío para colocar una figura de palos de pie. Si no hay ninguna capa de control seleccionada, se crea una nueva capa de control, con la intensidad para poses y un modelo compatible con OpenPose (si hay uno instalado).
- Arrastre el círculo de una articulación para girarla junto con el miembro que hay más allá (la longitud del hueso no cambia). Arrastre el cuello para mover todo el cuerpo. Arrastre con `Shift` pulsada para mover solo esa articulación.
- Haga clic en una articulación con `Alt` pulsada para ocultarla o volver a mostrarla (por ejemplo, en miembros que sobresalen de la pantalla).
- Pulse la tecla `R` o el botón **{{ui:canvas.pose.random}}** de la barra para cambiar la pose de la capa seleccionada por una nueva pose aleatoria. Se puede pulsar tantas veces como se quiera, así que se puede probar hasta encontrar una que guste.
- Con los botones del número y del rayo de la barra de la herramienta de pose, se pueden generar esa cantidad de imágenes seguidas, cambiando la pose cada vez (hasta 16). La semilla también cambia con cada pose, así que se obtienen imágenes en varias posturas con los mismos ajustes. Si la generación no puede empezar, se muestra el motivo y no comienza nada.
- Se pueden colocar tantas figuras como se quiera en una capa. Voltear de izquierda a derecha, girar y cambiar de escala se hace desde el menú del clic derecho de la capa.
- También se puede pedir con palabras. Con la pestaña **{{ui:app.tabs.canvas}}** abierta, abra el agente y descríbalo, por ejemplo «una pose corriendo» o «levanta la mano izquierda», y se coloca una figura (hasta 4 figuras). Después, dígale «inclínate un poco más hacia delante» y ajusta esa pose. Una pose pedida es una suposición a partir de sus palabras, así que, si no es lo que quería, arrastre las articulaciones para corregirla.
- También se puede crear una pose a partir de una persona de una imagen. Haga clic derecho en una imagen de la galería y elija **{{ui:canvas.poseFromImage.menu}}**: se leen de inmediato los esqueletos de las personas que hay, y la banda del visor muestra cuántas personas se encontraron. Pulse **{{ui:canvas.poseFromImage.replace}}** o **{{ui:canvas.poseFromImage.add}}** para colocarlas en el lienzo como figuras de palos (hasta 4 personas). El botón del mismo nombre de la barra de la herramienta de pose usa la imagen seleccionada en la galería y, si no hay ninguna seleccionada, abre una ventana para elegir un archivo de imagen. Las poses colocadas se pueden ajustar como cualquier otra pose. Necesita la extensión (comfyui_controlnet_aux), y si falta, la banda ofrece instalarla. La primera vez, descargar los modelos lleva un rato. Una persona demasiado pequeña o parcialmente oculta puede no encontrarse.
- El botón **{{ui:canvas.pose.presets}}** de la barra de la herramienta de pose abre una ventana con las categorías a la izquierda y una tarjeta para cada pose a la derecha. Cada tarjeta dibuja la figura de OpenPose dentro de un marco con la forma del cuadro de generación. Las poses de «{{ui:canvas.pose.group.panel}}» (cerca y lejos, dos personas, grupos, escenas cotidianas, drama y emoción) también fijan dónde están las personas y su tamaño, y sustituyen todas las poses de la capa seleccionada. Las poses de «{{ui:canvas.pose.group.standard}}» y «{{ui:canvas.pose.group.manga}}» sustituyen la primera pose de la capa seleccionada en el mismo lugar y con el mismo tamaño; si allí no hay pose, se coloca una nueva. Una pose que saldría del cuadro, con los brazos levantados o una patada, se hace más pequeña para que quepa.
- El botón **{{ui:canvas.pose3d.menu}}** de la barra de la herramienta de pose edita una pose en 3D (la primera pose de la capa de control seleccionada, o una figura de pie cuando no hay ninguna). Al arrastrar una articulación, se mueve conservando la longitud de su hueso, y un hueso puede apuntar alejándose de usted o hacia usted. Al arrastrar el fondo se gira el cuerpo, y la rueda hace zoom. Los botones **{{ui:canvas.pose3d.front}}**, **{{ui:canvas.pose3d.side}}**, **{{ui:canvas.pose3d.back}}** y **{{ui:canvas.pose3d.top}}** giran a vistas fijas. **{{ui:canvas.pose3d.apply}}** pone en el lienzo la forma que se ve ahora como pose (la profundidad se recuerda, así que se puede volver a abrir en 3D y girarla más); cerrar sin pulsarlo deja la pose como estaba. La vista 3D necesita WebGL en el navegador; donde falte, el cuadro de diálogo lo indica.

![La banda tras leer las poses de una imagen, antes de ponerlas en el lienzo](shot:canvas-pose-from-image)

![La ventana de poses y composiciones predefinidas con la categoría Dos personas elegida](shot:canvas-pose-presets)

![El cuadro de diálogo para editar una pose en 3D](shot:canvas-pose-3d)

Si quiere extraer una pose de una fotografía, puede usar la plantilla «{{ui:workflows.templates.poseControl.title}}» de [Flujos de trabajo](06-upscaling-workflows.md).

## Guía regional

Una capa de **{{ui:canvas.add.regional}}** da un prompt para el lugar que se pinta en ella. Pinte la región y después añada un prompt positivo (qué dibujar allí) o uno negativo (qué mantener fuera de ella) en los ajustes de la capa. El prompt de toda la imagen se sigue aplicando en todas partes; los prompts de la capa se aplican dentro de su región además de él. Con **auto negative** activado, el prompt positivo de la capa también se mantiene fuera del resto de la imagen, de modo que un «sombrero rojo» se queda en su sitio.

- Una capa que no tiene pintura dentro del área de generación, o no tiene prompt, no dice nada y se omite.
- Se pueden usar como máximo 8 capas a la vez. Las capas ocultas no se usan.
- La guía regional funciona con modelos SD1.X y SDXL. Con las familias más nuevas (Flux, Qwen-Image y similares), la generación falla y lo indica; oculte las capas.
- Las imágenes de referencia añadidas a una capa regional todavía no se usan.

## Guardar y limpiar

- Para guardar la imagen del lienzo en la galería, pulse **{{ui:canvas.toolbar.saveToGallery}}** (el icono del disco) en la barra de la parte superior. Las capas de trama visibles dentro del área de generación se fusionan y se guardan como una sola imagen.
- Para guardar el lienzo como archivo PSD que conserva sus capas, pulse **{{ui:canvas.toolbar.savePsd}}** (el icono del documento con una flecha hacia abajo). El área de generación se guarda como descarga del navegador. Cada capa de trama se convierte en una capa del PSD, conservando su nombre, posición, opacidad y visibilidad. Las capas de control entran como capas ocultas; las máscaras de inpainting y la guía regional se omiten.
- Para guardar solo una capa, haga clic derecho en la capa y elija **{{ui:canvas.entityMenu.saveToGallery}}**.
- **{{ui:canvas.settings.title}}** también tiene **{{ui:canvas.actions.clearCanvas}}**, **{{ui:canvas.actions.clearHistory}}** y **{{ui:canvas.actions.clearStaging}}**. **{{ui:canvas.actions.clearCanvas}}** elimina todas las capas.

En [Retocar y reutilizar imágenes](04-improve.md) hay también funciones para arreglar imágenes. «{{ui:gallery.menu.segment}}» abre una imagen en el lienzo, donde se vuelve a dibujar, borrar o recortar la parte pintada.
