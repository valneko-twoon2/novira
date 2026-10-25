# Lienzo

![La pestaña Lienzo completa. El lienzo está en el centro y la lista de capas en la parte inferior derecha](shot:canvas)

La pestaña **{{ui:app.tabs.canvas}}** es un espacio de trabajo para «dibujar, colocar y volver a pintar solo una parte» de una imagen. Se puede colocar una imagen y ampliarla, poner una máscara sobre la parte que se quiere volver a pintar o definir una pose con una figura de palos.

La pantalla se divide en tres zonas.

- Izquierda: un panel con los mismos ajustes que la pestaña Generar (prompt, modelo, tamaño, etc.). En el lienzo se añade un apartado **{{ui:params.compositing.title}}**.
- Centro: el lienzo. Encima se alinean los botones de herramientas.
- Derecha: la lista de **{{ui:canvas.layers.title}}**, que contienen las imágenes.

Si se pulsa **{{ui:params.invoke.invoke}}** sin nada colocado, se crea simplemente una imagen dentro del marco punteado (el área de generación). La verdadera potencia del lienzo se aprecia al colocar una imagen o un boceto rápido. Las capas y las máscaras se guardan automáticamente y vuelven al abrir la aplicación de nuevo (el historial de deshacer no se guarda).

## Colocar y dibujar imágenes

Hay varias formas de poner una imagen en el lienzo.

- Dibujar con el pincel. Si no hay ninguna capa seleccionada, se crea automáticamente una «{{ui:canvas.add.raster}}».
- Arrastrar una imagen desde la galería hasta el lienzo. Aparece un marco para elegir dónde colocarla (trama, control, máscara de inpainting, etc.); se suelta allí.
- `Ctrl+V` pega una imagen del portapapeles como una capa de trama nueva (también se guarda en la galería).
- Hacer clic con el botón derecho en una imagen de la galería (en el visor, el icono del pincel) y elegir un destino en **{{ui:gallery.menu.sendToCanvas}}**.

Los destinos son los siguientes.

| Destino | En qué se convierte |
|---|---|
| **{{ui:gallery.canvas.newCanvasRaster}}** | Vacía el lienzo y empieza con el mismo tamaño que esa imagen. |
| **{{ui:gallery.canvas.newCanvasControl}}** | Empieza de nuevo de la misma manera, pero la imagen se convierte en una capa de control. |
| **{{ui:gallery.canvas.raster}}** | La añade al lienzo actual como capa de trama. |
| **{{ui:gallery.canvas.control}}** | La añade como capa de control. |
| **{{ui:gallery.canvas.inpaint}}** | La añade como máscara de inpainting. |
| **{{ui:gallery.canvas.regional}}** | La añade como imagen de referencia de la guía regional (véase [La guía regional aún no está disponible](#la-guía-regional-aún-no-está-disponible)). |

## Herramientas

Las herramientas están alineadas en la barra superior. También se pueden cambiar con las teclas de letra del teclado.

| Herramienta | Tecla | Para qué sirve |
|---|---|---|
| **{{ui:canvas.tool.brush}}** | `B` | Dibuja imágenes. El color se cambia con el botón de color de la barra. |
| **{{ui:canvas.tool.eraser}}** | `E` | Borra lo dibujado. |
| **{{ui:canvas.tool.mosaic}}** | `M` | Convierte en mosaico la parte sobre la que se pinta (para ocultar algo). El tamaño de los bloques es el número de la barra. Solo funciona en una capa con imagen. |
| **{{ui:canvas.tool.rect}}** | `U` | Rellena un rectángulo. |
| **{{ui:canvas.tool.lasso}}** | `L` | Dibuja una forma libre y la rellena con el color (en una máscara, queda enmascarada). |
| **{{ui:canvas.tool.pose}}** | `O` | Coloca en una capa de control una pose de figura de palos y permite mover las articulaciones (véase «Crear una pose en el lienzo» más abajo). |
| **{{ui:canvas.tool.move}}** | `V` | Mueve las capas. Las flechas desplazan la capa seleccionada 1 px (10 px con Shift). |
| **{{ui:canvas.tool.bbox}}** | `C` | Mueve el área de generación (cuadro delimitador) y cambia su tamaño. |
| **{{ui:canvas.tool.view}}** | `H` | Desplaza la vista. |
| **{{ui:canvas.tool.colorPicker}}** | `I` | Toma un color de la imagen. |

También es posible hacer lo siguiente.

- Cambiar el grosor del pincel con **{{ui:canvas.toolbar.brushWidth}}** en la barra, o con las teclas `[` y `]`. `Q` cambia con la herramienta usada anteriormente.
- Acercar y alejar con la rueda del ratón o con las teclas `+` y `-`. `Ctrl+0` muestra todo el lienzo y `Ctrl+1` muestra el tamaño real (100 %).
- Para desplazar la vista, arrastrar mientras se mantiene pulsada la tecla `Space`, o arrastrar pulsando el botón de la rueda.
- Con **{{ui:canvas.toolbar.undo}}** (`Ctrl+Z`) y **{{ui:canvas.toolbar.redo}}** (`Ctrl+Shift+Z`) se puede deshacer y rehacer lo dibujado.

El engranaje, **{{ui:canvas.settings.title}}**, incluye opciones como mostrar una cuadrícula, oscurecer el exterior del área de generación, un ajuste que mantiene las líneas dibujadas solo dentro del área de generación y una operación que combina en una sola las capas de trama visibles.

## El área de generación (cuadro delimitador)

El marco punteado del lienzo es «el área donde se crea la imagen esta vez». En cada generación solo se crea el interior de este marco, y su tamaño pasa a ser el tamaño de la imagen.

- Cambiar a **{{ui:canvas.tool.bbox}}** (`C`) y arrastrar el marco para moverlo. Arrastrar una esquina o un borde para cambiar su tamaño.
- También se puede definir el tamaño con **{{ui:params.image.bboxWidth}}** y **{{ui:params.image.bboxHeight}}** en el panel izquierdo.
- **{{ui:canvas.actions.fitBboxToLayers}}** (`Shift+C`) ajusta el marco a las imágenes colocadas.

## Capas

En **{{ui:canvas.layers.title}}**, en la parte inferior derecha, se enumeran los elementos colocados en el lienzo. Se añaden con el botón **{{ui:common.add}}**.

![El menú Añadir de las capas abierto](shot:canvas-add-layer)

Las capas son de distintos tipos, con funciones diferentes.

| Tipo | Función |
|---|---|
| **{{ui:canvas.add.raster}}** | Una capa de imagen normal. Se dibuja en ella y se colocan imágenes. Lo que hay aquí se convierte en la «imagen original». |
| **{{ui:canvas.add.control}}** | Una imagen que se usa como pista de forma, líneas, pose, etc. Actúa como una instrucción para la generación y no pasa a formar parte de la imagen en sí. |
| **{{ui:canvas.add.inpaint}}** | Se pinta el área que indica «volver a pintar aquí». |
| **{{ui:canvas.add.regional}}** | Una capa que da un prompt distinto para cada lugar. En la versión de escritorio actual no se puede usar para generar. |
| **{{ui:canvas.add.globalRef}}** | Una imagen de referencia que hace que toda la imagen imite un ambiente. Es lo mismo que las imágenes de referencia de la pestaña Generar. |

En la lista de capas se puede hacer lo siguiente.

- El icono del ojo alterna entre mostrar y ocultar la capa, y el icono del candado alterna el bloqueo. Las capas ocultas no se usan para generar. No se puede dibujar en una capa bloqueada.
- Hacer doble clic en un nombre para renombrarlo.
- Con el botón derecho se puede duplicar, reordenar (subir o bajar; las capas del mismo tipo también se pueden arrastrar dentro de la lista), **{{ui:canvas.entityMenu.flipHorizontal}}**, **{{ui:canvas.entityMenu.flipVertical}}**, **{{ui:canvas.entityMenu.rotateRight}}**, **{{ui:canvas.entityMenu.rotateLeft}}**, **{{ui:canvas.entityMenu.scaleUp}}**, **{{ui:canvas.entityMenu.scaleDown}}**, **{{ui:canvas.pose.random}}** (solo en capas de control), convertir a otro tipo, copiar al portapapeles, **{{ui:canvas.entityMenu.saveToGallery}}**, **{{ui:canvas.entityMenu.exportToFile}}** y eliminar.
- Desde **{{ui:canvas.layers.more}}** («…») también se pueden combinar en una sola las capas de trama visibles y eliminar todas las capas.

![El menú contextual de una capa](shot:canvas-layer-menu)

Bajo la capa seleccionada se abren los ajustes de esa capa.

- {{ui:canvas.add.inpaint}}: el color y el patrón de relleno de la máscara (solo afectan al aspecto en pantalla) y **{{ui:canvas.mask.denoiseLimit}}** (si se activa y se reduce, es más probable que la imagen original se conserve incluso dentro de la máscara). En el menú del botón derecho de la máscara, **{{ui:canvas.entityMenu.invertMask}}** intercambia las zonas enmascaradas y libres dentro del área de generación.
- {{ui:canvas.add.control}}: véase la sección siguiente, «{{ui:canvas.add.control}}».

## Cómo se vuelve a pintar

Al pulsar **{{ui:params.invoke.invoke}}** en el lienzo, la aplicación examina el interior del área de generación y decide automáticamente cómo crear la imagen. No es necesario elegirlo.

| Estado del interior del área de generación | Cómo se crea |
|---|---|
| No hay nada dibujado en las capas de trama visibles | Se crea una imagen nueva a partir de texto (texto a imagen). |
| Solo está rellena una parte de la capa de trama | Las partes vacías se añaden para ampliarla (outpainting). Las partes vacías se rellenan primero con un color. |
| Todo está relleno y la máscara de inpainting no tiene pintura | La imagen actual se usa como base y se vuelve a dibujar (imagen a imagen). |
| Todo está relleno y la máscara de inpainting tiene pintura | Solo se vuelve a dibujar la parte enmascarada (inpainting). Fuera de la máscara, la imagen original se queda como está. |

En imagen a imagen, cuánto cambia se decide con **{{ui:params.image.strength}}** en el panel izquierdo. 0 deja el original tal cual y 1 lo vuelve a dibujar por completo.

En el outpainting, con qué se rellenan las partes vacías se elige en **{{ui:params.compositing.infillTitle}}**, dentro de **{{ui:params.compositing.title}}** en el panel izquierdo. Con **{{ui:params.compositing.infill.color}}** se rellenan con el color elegido (negro, blanco, gris, etc.). Si se elige otra opción, se rellenan mezclando los colores del entorno. La suavidad de la unión se decide con **{{ui:params.compositing.maskBlur}}**.

> El inpainting funciona tal cual con los modelos normales. No hace falta un «modelo de inpainting» específico.

## Decidir si se usa el resultado (staging)

Una imagen creada en el lienzo no pasa al lienzo de inmediato. Se muestra sobre el área de generación y se decide si usarla con la barra inferior (**{{ui:canvas.staging.title}}**).

| Botón | Qué hace |
|---|---|
| Flechas izquierda y derecha (`←` `→`) | Si se crearon varias, muestra la siguiente o la anterior. |
| **{{ui:canvas.staging.accept}}** (`Enter`) | Coloca esta imagen en el lienzo como una nueva capa de trama. Las demás imágenes se descartan. |
| **{{ui:canvas.staging.hideResults}}** | Oculta los resultados para comparar con la imagen original. |
| **{{ui:canvas.staging.saveToGallery}}** | Guarda esta imagen en la galería. |
| **{{ui:canvas.staging.discard}}** | Descarta solo esta imagen. |
| **{{ui:canvas.staging.discardAll}}** (`Esc`) | Descarta todo. |

> Las imágenes resultantes no aparecen en la galería por sí solas. Para una imagen que se quiera conservar en la galería, hay que pulsar primero **{{ui:canvas.staging.saveToGallery}}**. Las imágenes descartadas se pierden.

El asa (⋮⋮) del extremo izquierdo de la barra de resultados sirve para arrastrar una imagen a otro lugar y entregársela.

## Capas de control

Una capa de control es una pista que dice «dibuja siguiendo esta forma, esta línea, esta pose». Se introducen dibujos de líneas, contornos, imágenes de pose, etc.

Para usarla hace falta un modelo ControlNet compatible con el modelo principal. Para saber cómo instalarlo, véase el capítulo [Modelos](08-models.md). Se selecciona la capa y se elige el **{{ui:common.model}}** en sus ajustes. Si no hay modelo, aparece junto al botón Generar un mensaje como «La capa de control 1 no tiene modelo seleccionado» y no se puede crear la imagen.

Los ajustes son los siguientes.

- **{{ui:canvas.control.weight}}**: con qué fuerza sigue la pista.
- **{{ui:canvas.control.begin}}** y **{{ui:canvas.control.end}}**: desde qué fracción hasta qué fracción de la generación tiene efecto.
- **{{ui:canvas.control.controlMode}}**: hay **{{ui:canvas.control.mode.balanced}}** y **{{ui:canvas.control.mode.moreControl}}**. **{{ui:canvas.control.mode.morePrompt}}** se comporta por ahora igual que **{{ui:canvas.control.mode.balanced}}**.
- **{{ui:canvas.control.filter}}**: convierte una imagen en una imagen pensada como pista, como líneas o profundidad. Es una conversión sencilla hecha dentro de la aplicación. Se prueba con **{{ui:canvas.control.process}}** y, si el resultado es bueno, se aplica a la imagen con **{{ui:common.apply}}**.

## Crear una pose (figura de palos)

![El cuadro de diálogo para definir una pose con un muñeco de palitos](shot:pose)

Se puede definir una pose moviendo una figura de palos. Resulta útil cuando indicar la pose con palabras no funciona bien.

1. En la pestaña **{{ui:app.tabs.canvas}}**, pulsar el botón **{{ui:common.add}}** de las capas y elegir **{{ui:pose.menu}}**.
2. En **{{ui:pose.preset}}**, elegir una pose cercana ({{ui:pose.preset.standing}}, {{ui:pose.preset.armsUp}}, {{ui:pose.preset.sitting}}, {{ui:pose.preset.walking}}).
3. Arrastrar los círculos de las articulaciones para cambiar la postura. También se puede seleccionar un círculo y moverlo con las teclas de flecha (con `Shift` pulsada se mueve mucho más). **{{ui:pose.mirror}}** la voltea de izquierda a derecha y **{{ui:pose.reset}}** la devuelve a la plantilla original.
4. Elegir el **{{ui:pose.size}}**. Normalmente basta con el tamaño del lienzo.
5. Pulsar **{{ui:pose.use}}**.

La pose pasa al lienzo como una capa de control. Si el lienzo está vacío, empieza de nuevo con ese tamaño.

Para usarla hace falta un modelo ControlNet compatible con OpenPose. Si se dispone de uno, la aplicación lo elige automáticamente como modelo de la capa. Si no, se avisa mediante una notificación. Tras instalar el modelo, se elige en los ajustes de la capa.

> Solo se puede definir la pose de una persona. No se pueden definir detalles tan finos como los dedos de las manos o la dirección del rostro, por lo que el rostro y las manos se indican en el prompt.

> La fuerza con la que la pose tiene efecto se decide con el **{{ui:canvas.control.weight}}** de la capa. Una capa de pose está configurada desde el principio con la fuerza máxima y con efecto de principio a fin. Si se quiere más libertad en la pose, hay que reducirlo.

### Crear una pose en el lienzo

![El muñeco de palitos colocado en el lienzo con la herramienta de pose](shot:canvas-pose)

Con la herramienta **{{ui:canvas.tool.pose}}** (`O`) se puede crear una pose directamente en el lienzo. Una pose colocada se puede corregir después tantas veces como se quiera.

- Al hacer clic en un lugar vacío se coloca una figura de palos de pie. Si no hay ninguna capa de control seleccionada, se crea una nueva capa de control, con la fuerza para poses y un modelo compatible con OpenPose (si está instalado).
- Al arrastrar el círculo de una articulación, gira junto con la extremidad que sigue (la longitud de los huesos no cambia). Al arrastrar el cuello, se mueve todo el cuerpo. Si se arrastra manteniendo pulsada `Shift`, solo se mueve esa articulación.
- Al hacer clic en una articulación manteniendo pulsada `Alt`, se oculta o se vuelve a mostrar (por ejemplo, para extremidades que sobresalen de la pantalla).
- La tecla `R` o el botón **{{ui:canvas.pose.random}}** de la barra cambian la pose de la capa seleccionada por una nueva pose aleatoria. Se puede pulsar tantas veces como se quiera, así que se puede probar hasta encontrar una que le guste.
- Con los botones del número y del rayo de la barra de la herramienta de pose se generan seguidas tantas imágenes como se indique, cambiando la pose cada vez (hasta 16). La semilla también cambia con cada pose, así que con los mismos ajustes se obtienen imágenes en posturas distintas. Si no se puede generar, se muestra el motivo y no empieza nada.
- En una capa se pueden colocar tantas figuras como se quiera. Voltear a izquierda y derecha, girar y ampliar o reducir se hace desde el menú del botón derecho de la capa.
- También se puede pedir con palabras. Con la pestaña **{{ui:app.tabs.canvas}}** abierta, abra el asistente de IA y pídale una pose, por ejemplo «una pose corriendo» o «levanta la mano izquierda», y se coloca una figura (hasta 4 figuras). Después, si dice «inclínala un poco más hacia delante», el asistente corrige esa pose. La pose pedida es una suposición a partir de sus palabras, así que, si no es lo que quería, arrastre las articulaciones para corregirla.
- También se puede crear a partir de las personas que aparecen en una imagen. Se hace clic derecho en una imagen de la galería y se elige **{{ui:canvas.poseFromImage.menu}}**, o se pulsa el botón del mismo nombre en la barra de la herramienta de pose: se leen los esqueletos de las personas y se colocan como figuras (hasta 4 personas). Las poses colocadas se pueden corregir como cualquier otra. Hace falta la extensión (comfyui_controlnet_aux); si falta, el diálogo ofrece instalarla. La primera vez, la descarga de los modelos tarda un poco. Una persona demasiado pequeña o parcialmente oculta puede no encontrarse.
- El botón **{{ui:canvas.pose.presets}}** de la barra de la herramienta de pose abre una ventana con las categorías a la izquierda y una tarjeta por pose a la derecha. Cada tarjeta dibuja la figura de OpenPose dentro de un marco con la forma del recuadro de generación. Las «{{ui:canvas.pose.group.panel}}» (cerca y lejos, dos personas, grupos, escenas cotidianas, drama y emociones) fijan además dónde están las personas y su tamaño, y sustituyen todas las poses de la capa seleccionada. Las «{{ui:canvas.pose.group.standard}}» y la «{{ui:canvas.pose.group.manga}}» sustituyen a la primera pose de la capa seleccionada, en el mismo lugar y tamaño; si no hay ninguna, se coloca una nueva. Una pose que se saldría del recuadro, con los brazos en alto o una patada, se reduce para caber.
- El botón **{{ui:canvas.pose3d.menu}}** de la barra de la herramienta de pose edita una pose en 3D (la primera pose de la capa de control seleccionada, o una figura de palos de pie si no hay ninguna). Al arrastrar una articulación se mueve con la longitud del hueso intacta, y un hueso puede apuntar hacia el fondo o hacia delante. Arrastrar el fondo gira el cuerpo y la rueda acerca o aleja. Los botones **{{ui:canvas.pose3d.front}}**, **{{ui:canvas.pose3d.side}}**, **{{ui:canvas.pose3d.back}}** y **{{ui:canvas.pose3d.top}}** giran a vistas fijas. **{{ui:canvas.pose3d.apply}}** pone en el lienzo la forma que se ve ahora como pose (la profundidad se recuerda, así que se puede abrir de nuevo en 3D y seguir girando); cerrar sin pulsarlo deja la pose como estaba. La vista 3D necesita WebGL en el navegador; si falta, el diálogo lo indica.

![Lectura de las poses de una imagen antes de colocarlas en el lienzo](shot:canvas-pose-from-image)

![La ventana «Poses y composiciones predefinidas» con la categoría «Dos personas» elegida](shot:canvas-pose-presets)

![El diálogo para editar una pose en 3D](shot:canvas-pose-3d)

Si se quiere extraer una pose de una foto, se puede usar la plantilla «{{ui:workflows.templates.poseControl.title}}» en [Flujos de trabajo](06-upscaling-workflows.md).

## La guía regional aún no está disponible

**{{ui:canvas.add.regional}}** se ofrece en la pantalla, pero en la versión de escritorio actual no se puede usar para generar. Si hay una capa de guía regional con pintura, la generación se rechaza y aparece un mensaje de error (en inglés). Al generar en el lienzo, hay que ocultar o eliminar la capa de guía regional.

## Guardar y limpiar

- Para guardar la imagen del lienzo en la galería, pulsar **{{ui:canvas.toolbar.saveToGallery}}** (el icono del disco) en la barra superior. Las capas de trama visibles dentro del área de generación se combinan y se guardan como una sola imagen.
- Para guardar solo una capa, hacer clic con el botón derecho en la capa y elegir **{{ui:canvas.entityMenu.saveToGallery}}**.
- **{{ui:canvas.settings.title}}** también incluye **{{ui:canvas.actions.clearCanvas}}**, **{{ui:canvas.actions.clearHistory}}** y **{{ui:canvas.actions.clearStaging}}**. **{{ui:canvas.actions.clearCanvas}}** elimina todas las capas.

También hay funciones para corregir imágenes en [Retocar y reutilizar imágenes](04-improve.md). El resultado de «{{ui:gallery.menu.segment}}» se puede enviar al lienzo y volver a pintar.
