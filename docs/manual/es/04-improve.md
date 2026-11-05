# Retocar y reutilizar imágenes

Este capítulo reúne las funciones para cuando se piensa «me gustaría retocar un poco esta imagen terminada», «quiero unas cuantas más con el mismo ambiente» o «quiero usar este personaje también en otra escena».

La mayoría de las funciones se llaman desde un botón de la barra de herramientas situada sobre el visor (la pantalla que muestra una imagen en grande) o desde el menú que aparece al hacer clic derecho en una imagen de la galería. Deje el ratón sobre un botón de la barra de herramientas para ver su nombre. Para lo básico del visor y la galería, consulte [La galería y el visor](03-gallery.md).

## Qué usar y desde dónde

| Lo que se quiere hacer | Qué usar | Qué más hace falta |
|---|---|---|
| Crear unas cuantas más con los mismos ajustes, o rehacer una con pequeños cambios | **{{ui:gallery.derive.menu}}** | Que esté instalado el modelo usado para la imagen original |
| Quitar el fondo y conservar solo a la persona o el objeto | **{{ui:cutout.menu}}** | La extensión ComfyUI-RMBG |
| Recortar los márgenes transparentes | **{{ui:gallery.menu.trim}}** (solo con el clic derecho) | Nada |
| Pintar sobre una parte de una imagen y después borrarla, recortarla o repintarla | **{{ui:gallery.menu.segment}}** | Para borrar, la extensión comfyui-inpaint-nodes |
| Arreglar rostros pequeños y deformados | **{{ui:facefix.menu}}** | Las extensiones ComfyUI-Impact-Pack y ComfyUI-Impact-Subpack |
| Convertir una imagen en una página de manga en blanco y negro | **{{ui:gallery.manga.menu}}** (solo en la barra de herramientas del visor) | La extensión ComfyUI-MangaScreen |
| Escribir un prompt a partir de una imagen | **{{ui:caption.menu}}** | La extensión ComfyUI-Florence2 |
| Registrar un personaje y usarlo en otras imágenes | **{{ui:character.menu}}** | La extensión para imágenes de referencia (IP-Adapter) |
| Alinear en una tabla imágenes con ajustes cambiados | **{{ui:xyplot.menu}}** | Nada |
| Elegir entre candidatos dibujados a medias | La pestaña **{{ui:app.views.drafts}}** | Nada |
| Aplicar el mismo procesamiento a muchas imágenes | **{{ui:gallery.menu.batch}}** (elija varias y haga clic derecho) | Depende del procesamiento |

## Usar las herramientas de retoque

Las cuatro herramientas {{ui:facefix.menu}}, {{ui:cutout.menu}}, {{ui:caption.menu}} y {{ui:canvas.poseFromImage.menu}} están agrupadas bajo **{{ui:gallery.tools.heading}}** en el menú del clic derecho de una imagen de la galería. Cada una trabaja en una banda que se abre sobre la imagen en el visor. La imagen permanece en el visor, así que se puede hacer zoom y moverla mientras se comprueba.

- Al elegir un elemento, se ejecuta enseguida con los ajustes de la última vez. La imagen aparece en el visor y la banda muestra el avance.
- El botón del engranaje, a la derecha de un elemento, abre los ajustes en la banda sin ejecutar. Cambie los ajustes y pulse **{{ui:gallery.tools.run}}**. Los ajustes cambiados se usan también la próxima vez.
- Los botones **{{ui:cutout.menu}}**, **{{ui:facefix.menu}}** y **{{ui:caption.menu}}** de la barra de herramientas del visor también abren los ajustes en la banda. Al pulsar de nuevo el botón, se cierra.
- Los botones del lado izquierdo de la banda cambian a otra herramienta.
- Al terminar, la banda muestra el resultado y los ajustes usados. **{{ui:gallery.tools.edit}}** vuelve a los ajustes para que se puedan cambiar y ejecutar de nuevo.
- El trabajo se ejecuta en la cola. Cerrar la banda, o pasar a otra imagen o pantalla, no lo detiene. Solo lo detiene **{{ui:common.cancel}}** en la banda. Un resultado que es una imagen se guarda en la galería aunque la banda esté cerrada.

## Cuando se necesita una extensión

Quitar fondos, arreglar rostros, etc. funcionan añadiendo «extensiones» al motor que crea las imágenes (ComfyUI). Si una extensión no está instalada, la banda dice «… necesita la extensión XXX.» y se muestran botones para instalarla.

1. Pulse **{{ui:gallery.tools.install}}**. Descarga e instala automáticamente lo necesario. La instalación se ejecuta en segundo plano y su avance aparece en el indicador de descargas. Cerrar la banda no la detiene.
2. Cuando termina la instalación, el botón de la banda cambia a **{{ui:gallery.tools.restart}}**. Púlselo y ComfyUI se reinicia.
3. Tras el reinicio, la herramienta se puede usar tal cual.

La primera vez que se usa una, también empiezan a descargarse los modelos que usa la extensión, por lo que tarda un rato. Hace falta estar conectado a internet. Esta descarga se ejecuta dentro del trabajo que se inició, así que cerrar la banda no la detiene.

> Algunas extensiones tardan y ocupan espacio en disco al instalarse. ComfyUI-Impact-Pack necesita Git para instalarse. En un ordenador sin Git, la instalación falla. Si aparece un mensaje, léalo y actúe en consecuencia.

Las extensiones también se pueden instalar desde la pestaña «{{ui:workflows.panel.packs}}» de [Flujos de trabajo](06-upscaling-workflows.md). Si no funciona, consulte también [Solución de problemas](10-troubleshooting.md).

## Crear otra con los mismos ajustes (derivar)

![El menú «Derivar más» abierto en la barra de herramientas del visor](shot:derive-menu)

Abra en el visor la imagen que le guste y pulse el botón **{{ui:gallery.derive.menu}}** (el icono de ramificación) de la barra de herramientas. En la galería, haga clic derecho en la imagen y elija **{{ui:gallery.derive.menu}}**.

Se puede elegir entre los tres tipos siguientes.

| Elemento | Qué hace |
|---|---|
| «Mismos ajustes, semilla nueva» (1 o 4 imágenes) | Dibuja cambiando solo la semilla y manteniendo el prompt, el modelo, el tamaño, etc. La composición cambia, pero el ambiente es el mismo. |
| «Repetir con cambios pequeños» (1 o 4 imágenes) | Toma la imagen original como base y la vuelve a dibujar con suavidad (con una intensidad de 0,45). La composición y los colores se conservan y solo cambian los detalles. |
| **{{ui:gallery.derive.custom}}** | Se decide cuánto cambiar (véase la sección siguiente). |

Al elegir una opción, las imágenes nuevas entran en la cola y se alinean en el mismo tablero que la original. **Los ajustes de la pestaña Generar no se modifican.** El prompt que se esté escribiendo también se mantiene tal cual.

> Para traer los ajustes de vuelta a la pantalla y retocarlos antes de crear una imagen, se usa **{{ui:gallery.menu.remix}}**. Derivar sirve para «crearla con los ajustes originales con un solo botón».

### Elegir cuánto cambiar y rehacer

![El cuadro de diálogo para decidir cuánto cambiar](shot:derive)

Al elegir **{{ui:gallery.derive.custom}}**, se abre un cuadro de diálogo.

1. Mueva el control deslizante **{{ui:gallery.derive.dialog.strength}}**. Cuanto más a la izquierda ({{ui:gallery.derive.dialog.close}}), más se conservan la composición y los colores originales; cuanto más a la derecha ({{ui:gallery.derive.dialog.free}}), más se acerca a una imagen distinta.
2. Elija el **{{ui:gallery.derive.dialog.count}}** entre 1, 2, 4 y 8.
3. Pulse **{{ui:gallery.derive.dialog.create}}**.

Como referencia, alrededor de 0,25 da una imagen casi igual a la original, y alrededor de 0,75 da una imagen en la que el personaje se mantiene pero la composición cambia mucho. Depende de la imagen, así que pruebe varias. El valor del control deslizante se aplica solo a esa vez.

### Qué se conserva y qué no

- Se conserva: los ajustes usados al crear la imagen, como el prompt, el prompt negativo, el modelo, los LoRA, el tamaño, los pasos, la escala CFG y el planificador.
- Las imágenes de referencia y las capas de control también se recuerdan junto con la imagen, así que se usan tal cual. Sin embargo, si una de esas imágenes se ha eliminado de la galería, no se puede crear la imagen. El motivo aparece en una notificación.
- No se conserva: las máscaras, la guía regional y los ajustes de borrador. Si una imagen se creó antes de que existiera esta función y usó imágenes de referencia o similares, estas no se recordaron, así que no se pueden conservar. Cuando algo no se pudo conservar, se avisa en una notificación.

En los casos siguientes, el botón no se puede pulsar o aparece una notificación y no se puede crear la imagen.

- Cuando la imagen no es una generada (es decir, creada a partir de texto; imagen a imagen, inpainting y outpainting también cuentan como generadas). No se incluyen las imágenes ampliadas, el vídeo, el audio y similares.
- Cuando el modelo usado para la imagen original no está instalado. Aparece una notificación con el nombre del modelo.

## Quitar el fondo

![El fondo quitado en la banda del visor y comparado con el original](shot:cutout)

Reconoce automáticamente lo que hay en la imagen y crea una imagen sin el fondo. No hace falta indicar nada con clics.

1. Haga clic derecho en una imagen de la galería y elija **{{ui:cutout.menu}}** bajo **{{ui:gallery.tools.heading}}**: se ejecuta enseguida con los ajustes de la última vez. Para cambiar antes los ajustes, abra la banda con el engranaje situado a la derecha del elemento o con el botón de las tijeras de la barra de herramientas del visor.
2. En la banda, cambie los ajustes si hace falta.
   - **{{ui:cutout.model}}**: normalmente está bien tal cual.
   - **{{ui:cutout.sensitivity}}**: cuanto más bajo se pone, más conserva de las partes con límites poco claros.
   - **{{ui:cutout.edge}}**: un valor positivo ensancha el contorno y uno negativo lo recorta.
   - **{{ui:cutout.background}}**: elija **{{ui:cutout.background.alpha}}** o **{{ui:cutout.background.white}}**.
3. Pulse **{{ui:gallery.tools.run}}**.

La imagen terminada se guarda como una imagen nueva en el mismo tablero que la original. **La imagen original se queda como está.** Después el visor compara la imagen nueva con la original. Si no está conforme con el resultado, pulse **{{ui:gallery.tools.edit}}**, cambie los ajustes y ejecútelo de nuevo.

Un fondo blanco es una buena opción cuando después se quiere usar la imagen como imagen de referencia de un [personaje](#registrar-y-usar-un-personaje). El color del fondo se transmite con menos facilidad a las imágenes nuevas que se creen.

## Recortar los márgenes transparentes

Una imagen con fondo transparente conserva márgenes transparentes alrededor. Con **{{ui:gallery.menu.trim}}** se guarda una imagen transparente nueva recortada ajustadamente a la parte que tiene contenido. Es útil para usarla como pegatina o como material.

- Haga clic derecho en una imagen de la galería y elíjalo. Justo después de quitar un fondo, se puede hacer lo mismo desde **{{ui:cutout.trim}}** en la banda (aparece solo cuando se hizo transparente el fondo).
- Una sombra tan tenue que casi no se ve se recorta como margen.
- En una imagen cuya zona transparente no llega al borde de la imagen, aparece «No hay margen que recortar.» y no se guarda nada. Una imagen totalmente transparente tampoco se puede recortar.

## Seleccionar una zona y retocarla

La parte que se quiere retocar se selecciona pintando encima con un pincel. La imagen se abre en el [lienzo](05-canvas.md), así que se puede hacer zoom y moverse mientras se pintan los detalles finos.

1. Abra la imagen en el visor y pulse **{{ui:gallery.menu.segment}}** (también se puede elegir en el menú del clic derecho de la galería).
2. Se abre el lienzo con la imagen y un **{{ui:canvas.add.inpaint}}** vacío seleccionado. La herramienta es **{{ui:canvas.tool.brush}}**.
3. Pinte la parte que quiere retocar. Quite lo que haya pintado de más con **{{ui:canvas.tool.eraser}}**. Para seleccionar en cambio todo lo demás, haga clic derecho en la máscara y elija **{{ui:canvas.entityMenu.invertMask}}**.
4. Elija qué hacer con la parte pintada. Cuando la fila de la máscara está seleccionada, debajo aparecen un cuadro de texto y botones (borrar y recortar también están en el menú del clic derecho de la máscara).

| Lo que se quiere | Cómo | Qué hace falta |
|---|---|---|
| Borrarla, integrándola en la imagen de alrededor | **{{ui:canvas.partFix.erase}}**. El resultado se pone en staging en el lienzo, así que elija **{{ui:canvas.staging.accept}}** o descártelo. | La extensión comfyui-inpaint-nodes. Con el modelo LaMa (unos 200 MB), borra de forma natural. Sin ella, todavía se puede borrar de forma sencilla. |
| Guardar solo la parte pintada como imagen transparente | **{{ui:canvas.partFix.cutOutAction}}** | Nada |
| Repintarla según una instrucción de texto | Escriba en el cuadro de texto qué dibujar allí, por ejemplo «un lazo azul», y pulse **{{ui:canvas.partFix.redraw}}**. Solo se vuelve a dibujar la parte pintada, con el modelo y los ajustes de la pestaña Generar. Con el cuadro de texto en blanco, se usa el prompt de la pestaña Generar. El prompt de la pestaña Generar no se modifica. El resultado se pone en staging, así que elija **{{ui:canvas.staging.accept}}** o descártelo. | Un modelo de imagen |
| Aplicar un mosaico | No use la máscara; pase directamente sobre la parte con la herramienta **{{ui:canvas.tool.mosaic}}**. | Nada |

La imagen original no cambia. Un recorte se guarda en la galería como imagen nueva.

## Arreglar rostros

![Los ajustes de arreglar rostros abiertos en la banda del visor](shot:facefix)

En los planos generales, los rostros que aparecen pequeños suelen salir deformados. **{{ui:facefix.menu}}** encuentra automáticamente los rostros de la imagen, vuelve a dibujar solo los rostros a alta resolución y los devuelve a la imagen original. No cambia nada más que los rostros.

1. Haga clic derecho en una imagen de la galería y elija **{{ui:facefix.menu}}** bajo **{{ui:gallery.tools.heading}}**: se ejecuta enseguida. Para comprobar los ajustes antes de ejecutar, abra la banda con el engranaje situado a la derecha del elemento o con el botón **{{ui:facefix.menu}}** de la barra de herramientas del visor.
2. Solo la primera vez hacen falta las extensiones ComfyUI-Impact-Pack y ComfyUI-Impact-Subpack. Instálelas con **{{ui:gallery.tools.install}}** en la banda y pulse **{{ui:gallery.tools.restart}}**. El modelo que encuentra los rostros lo prepara el propio Subpack.
3. Compruebe los ajustes.
   - **{{ui:facefix.model}}**: está seleccionado el modelo usado para la imagen original.
   - **{{ui:facefix.detector}}**: el modelo que se usa para encontrar los rostros. Normalmente está bien tal cual.
   - **{{ui:facefix.prompt}}**: se rellena con el prompt de la imagen original. Añadir rasgos del rostro lo hace más eficaz.
   - **{{ui:facefix.strength}}**: cuanto más bajo, más cerca del rostro original; cuanto más alto, más lo vuelve a dibujar.
   - **{{ui:facefix.sensitivity}}**: al subirlo, solo detecta rostros claros, y al bajarlo detecta también rostros pequeños y de perfil. Sin embargo, también es más fácil que detecte cosas que no son rostros.
4. Pulse **{{ui:gallery.tools.run}}**.

El resultado se guarda en el mismo tablero que el original y el visor lo compara con el original. Si no le gusta, pulse **{{ui:gallery.tools.edit}}**, cambie los ajustes y ejecútelo de nuevo. El modelo y lo que se debe dibujar se recuerdan solo mientras se trabaja con la misma imagen.

> Una imagen creada con un LoRA se vuelve a dibujar sin el LoRA. Por eso, solo el rostro puede parecer ligeramente distinto en estilo.

> Cuando aparece «No se encontró el modelo de detección de rostros (YOLO)», reinicie ComfyUI o vuelva a instalar las extensiones.

## Terminar una imagen como página de manga

**{{ui:gallery.manga.menu}}** en la barra de herramientas del visor convierte la imagen abierta en una página de manga en blanco y negro con líneas nítidas. Las sombras pasan a tonos planos y a puntos de trama reales, y las líneas principales dentro de las zonas de negro sólido se recortan finas y en blanco. El dibujo en sí siempre crea la imagen normal a color; el acabado es un paso que se da después, sobre una imagen que gusta.

1. Abra la imagen en el visor y pulse **{{ui:gallery.manga.menu}}**. El original se muestra a la izquierda.
2. Solo la primera vez hace falta la extensión ComfyUI-MangaScreen. Cuando no está instalada, aparece un aviso; pulse **{{ui:gallery.manga.installPack}}** y después **{{ui:gallery.manga.restartEngine}}**. Los botones de abajo esperan hasta que esté instalada.
3. Cambie los valores si quiere (se recuerdan para la próxima vez):
   - **{{ui:gallery.manga.screenLines}}**: filas de puntos a lo ancho. 120 es grueso, 200 normal, 300 fino.
   - **{{ui:gallery.manga.whitePoint}}**: lo más claro que esto pasa a blanco papel. Bájelo para limpiar la trama de la piel y del pelo claro.
   - **{{ui:gallery.manga.blackPoint}}**: lo más oscuro que esto pasa a negro sólido. Súbalo para tener más negro.
   - **{{ui:gallery.manga.gradation}}**: las sombras suaves hacen crecer sus puntos con la oscuridad en lugar de cortarse en escalones. Con 0 se conservan solo las zonas planas.
   - **{{ui:gallery.manga.whiteLines}}**: cuántas líneas dentro del negro sólido se recortan en blanco. Con 0 se desactiva.
   **{{ui:gallery.manga.reset}}** devuelve todos los valores a su estado inicial.
4. Pulse **{{ui:gallery.manga.tryRun}}** para ver el resultado a la derecha, junto al original. Una prueba no guarda nada.
5. Pulse **{{ui:gallery.manga.save}}** cuando le guste. La página se guarda como una imagen nueva en el mismo tablero que el original, y el original no cambia. Pulse **{{ui:gallery.manga.open}}** para verla.

Al guardar se vuelve a terminar la imagen con los valores mostrados, así que tarda lo mismo que una prueba.

## Crear un prompt a partir de una imagen

![Etiquetas escritas para una imagen en la banda del visor](shot:caption)

Mira una imagen y escribe un prompt (etiquetas o una frase) para dibujarla. Úselo cuando quiera imágenes parecidas a una que le gusta, o cuando no sepa cómo escribir el prompt.

1. Haga clic derecho en una imagen de la galería y elija **{{ui:caption.menu}}** bajo **{{ui:gallery.tools.heading}}**: escribe las palabras enseguida. El botón **{{ui:caption.fromPrompt}}**, situado sobre el campo del prompt en la pestaña Generar, hace lo mismo. Ese botón usa la imagen seleccionada en la galería y, si no hay ninguna seleccionada, abre una ventana para elegir un archivo de imagen. También se puede soltar sobre ese botón una imagen de la galería o un archivo de imagen del ordenador.
2. Para cambiar la forma de escribir, pulse **{{ui:gallery.tools.edit}}** en la banda y elija **{{ui:caption.style.tags}}** o **{{ui:caption.style.sentence}}** en **{{ui:caption.style}}**.
3. Pulse **{{ui:gallery.tools.run}}**.
4. Allí mismo, en la banda, se pueden editar las palabras. Después pulse **{{ui:caption.replace}}**, **{{ui:caption.append}}** o **{{ui:caption.copy}}**.

Reemplazar y añadir actúan sobre «{{ui:params.prompt.positive}}» en la pestaña Generar. Esta función no añade ninguna imagen a la galería.

> Esta función necesita la extensión ComfyUI-Florence2. Cuando no está instalada, se puede instalar desde la banda (véase «Cuando se necesita una extensión» en este capítulo). La primera vez que se usa, se descarga el modelo para describir imágenes (Florence-2 PromptGen).

## Registrar y usar un personaje

![El cuadro de diálogo para registrar como personaje](shot:character)

Si registra una imagen de un personaje que le gusta, puede dibujar a ese personaje en otras escenas, manteniéndose cerca de su aspecto. Se registran estas tres cosas.

- Imágenes de referencia (imágenes del mismo personaje, tantas como se quiera)
- Palabras de aspecto (color de pelo y de ojos, ropa, etc.; se añaden al principio del prompt)
- La intensidad del parecido

### Registrar

1. En la galería, elija la imagen que quiere registrar. Para varias imágenes, haga clic con `Ctrl` pulsada.
2. Elija el botón **{{ui:character.menu}}** del visor o **{{ui:character.menu}}** en el menú del clic derecho. Si abre el campo **{{ui:character.row.choose}}** en la pestaña Generar, al final de la lista hay **{{ui:character.row.register}}**, y también se puede abrir desde allí.
3. Introduzca el **{{ui:character.name}}** y las **{{ui:character.tags}}**. Escriba los rasgos que no quiere que cambien (pelo castaño, blusa blanca, falda azul, etc.).
4. Decida el **{{ui:character.weight}}**. Cuanto más lo suba, más se parecerá a las imágenes de referencia, pero menos libertad tendrá sobre la escena y la composición.
5. Pulse **{{ui:character.save}}**.

Con **{{ui:character.addSelected}}** se pueden añadir más tarde a las imágenes de referencia las imágenes elegidas en la galería. **{{ui:character.removePicture}}** es la ✕ de la esquina superior derecha de una imagen.

Si activa **{{ui:character.whiteBg}}**, se crea una imagen con el fondo de la imagen registrada sustituido por blanco, y esa se usa como imagen de referencia. Así se evita que el color del fondo se transmita a las imágenes que se generen. La imagen original se conserva, y la imagen con fondo blanco se guarda como una nueva. Cuando la extensión ComfyUI-RMBG, que se usa para quitar fondos, no está instalada, este interruptor no se puede usar y se utiliza la imagen original tal cual.

### Usar

1. En el panel izquierdo de la pestaña **{{ui:app.tabs.generate}}** (o de la pestaña [Lienzo](05-canvas.md)), abra **{{ui:character.row.choose}}** y elija el personaje que quiere usar.
2. Las imágenes de referencia del personaje van al campo «{{ui:params.refImage.sectionLabel}}» y las palabras de aspecto se añaden al principio del prompt.
3. Genere como de costumbre.

Al usar uno, la aplicación puede ajustar algunas cosas automáticamente. Se avisa en una notificación.

- Cuando se usan imágenes de referencia, una escala CFG alta tiende a quemar la imagen, así que si la escala CFG es superior a 5 se baja a 4,5.
- Se pueden tener 8 imágenes de referencia como máximo en total. Cuando el total con otras imágenes de referencia supera 8, se usan las imágenes del principio.
- Cuando hay varias imágenes de referencia, la intensidad por imagen se reduce automáticamente para que juntas no resulten demasiado fuertes.
- Las imágenes que se eliminaron de la galería no se pueden usar. Si se han eliminado todas, el personaje no se puede usar.

Para corregir o eliminar un personaje registrado, use el botón «…» de un elemento de la lista.

> Esta es una función que «se acerca» al mismo personaje, por lo que no da exactamente el mismo rostro. El peinado, el color, la ropa, etc. tienden a conservarse, pero los rasgos faciales cambian un poco. Escribir en las palabras de aspecto los rasgos que se quieren conservar ayuda.

> Para usar imágenes de referencia hacen falta la extensión ComfyUI_IPAdapter_plus y un modelo para imágenes de referencia. Si no están instalados, se pueden instalar desde el campo de imágenes de referencia de la pestaña Generar. Para los modelos, consulte el capítulo [Modelos](08-models.md).

## Elegir un LoRA para un personaje

En el cuadro de diálogo de edición del personaje, elija un LoRA en **{{ui:lora.section}}**. Entonces se puede activar y desactivar **{{ui:lora.use}}** y cambiar **{{ui:lora.weight}}**; al usar el personaje se añaden al prompt el LoRA y su palabra de activación. El entrenamiento de LoRA está en la aplicación aparte novira-train.

## Comparar ajustes con una cuadrícula de comparación

![El cuadro de diálogo de la cuadrícula de comparación](shot:xyplot)

¿Cómo cambia una imagen al cambiar la escala CFG o el número de pasos? Esta función lo reúne en una sola tabla para poder compararlo.

1. En la pestaña Generar, decida el prompt y el modelo como de costumbre.
2. Pulse la «▼» situada a la derecha del botón **{{ui:params.invoke.invoke}}** y elija **{{ui:xyplot.menu}}**.
3. Con **{{ui:xyplot.x}}** y **{{ui:xyplot.y}}**, elija los ajustes que se van a cambiar. Se puede hacer con uno solo de ellos.
4. Introduzca los valores. Separe los números con comas (por ejemplo: 3, 5, 7).
5. Pulse **{{ui:xyplot.run}}**.

En la parte inferior del cuadro de diálogo aparece el número de imágenes que se van a crear, como «Se crearán 3 columnas × 2 filas = 6 imágenes.»

Los ajustes que se pueden cambiar son los siguientes.

| Ajuste | Cómo se introduce |
|---|---|
| {{ui:xyplot.axis.cfgScale}} | Números (1 a 30) |
| {{ui:xyplot.axis.steps}} | Números enteros (1 a 150) |
| {{ui:xyplot.axis.seed}} | Números enteros |
| {{ui:xyplot.axis.strength}} | Números (0,05 a 1). Solo tiene efecto al crear a partir de una imagen (imagen a imagen). |
| {{ui:xyplot.axis.scheduler}} | Se elige de una lista |
| {{ui:xyplot.axis.model}} | Se eligen de una lista modelos de la misma familia |
| {{ui:xyplot.axis.prompt}} | Escriba uno por línea. Se añaden al prompt |

Las reglas son las siguientes.

- Se pueden introducir hasta 8 valores para un ajuste. La tabla puede tener 36 imágenes como máximo en total.
- No se puede elegir el mismo ajuste para el horizontal y el vertical.
- Todas las imágenes se dibujan con la **misma semilla** (salvo que se elija un ajuste que cambie la semilla). La única diferencia es el ajuste que se cambió.
- Los ajustes se toman del formulario de la pestaña Generar en ese momento. El formulario no se modifica.
- Una imagen que no se pudo crear aparece como × en la tabla. La tabla se crea igualmente con las demás imágenes.

La tabla terminada se guarda en la galería como una sola imagen. **{{ui:xyplot.open}}** la muestra en el visor. Las imágenes individuales con las que se creó la tabla también se quedan en la galería.

> Cuantas más imágenes, más tiempo lleva. Para 36 imágenes hacen falta 36 generaciones. Se recomienda probar al principio con 2 o 3 valores.

## Elegir entre borradores

![La pestaña Borradores con candidatos dibujados a medias alineados](shot:drafts)

Una imagen cambia mucho según la semilla. Borradores es una función que dibuja muchas semillas solo «hasta cierto punto» y después dibuja hasta el final únicamente las composiciones que gustan. Ahorra tiempo.

Abra la pestaña **{{ui:app.views.drafts}}** en el centro de la pestaña **{{ui:app.tabs.generate}}**.

1. Elija el **{{ui:drafts.model}}**. Al principio está seleccionado el modelo de la pestaña Generar. Se puede elegir cualquier modelo de imagen que ofrezca la pestaña Generar: SDXL y SD1.X, y también los modelos que vienen sin sus codificadores de texto ni VAE, como Anima, Flux, FLUX.2 y Z-Image. Los modelos de edición (Flux Fill, Flux Kontext, Qwen-Image-Edit) solo modifican una imagen que se les da, por lo que no están en la lista; cuando hay alguno, sus nombres se muestran debajo.
2. Decida el **{{ui:drafts.count}}** (de 1 a 24 imágenes; 4 al principio, que se puede cambiar con **{{ui:settings.draftCount.label}}** en los ajustes). El número y la posición se conservan como los puso al cambiar a otras pantallas, hasta que se cierre la aplicación.
3. Decida la **{{ui:drafts.position}}** (de 25 a 60 %; 35 % al principio). Cuanto menor es, más rápido termina, pero más toscas son las imágenes.
4. Pulse **{{ui:drafts.start}}**.

Las imágenes de borrador se alinean en el orden en que se terminan. Se usan el prompt y los demás ajustes de la pestaña Generar.

Haga clic en una imagen para elegirla (haga clic de nuevo para deseleccionarla). Haga doble clic para verla en grande en el visor. El botón de la estrella (**{{ui:drafts.keep}}**) y la ✕ (**{{ui:drafts.reject}}**) son marcas para uso propio. Pulse el botón «{{ui:manual.drafts.finish}} N imágenes» de la parte inferior derecha (N es el número que haya elegido) y las imágenes elegidas se dibujan hasta el final. Para elegir de nuevo, pulse **{{ui:drafts.clearSelection}}**.

Las imágenes dibujadas hasta el final van a la galería igual que una generación normal, y «{{ui:drafts.badge.finished}}» aparece sobre el borrador. Si algunos borradores fallaron, aparece un botón «{{ui:manual.drafts.retry}} N fallidos».

> Aunque diga «{{ui:manual.drafts.finish}}», no continúa desde la mitad. Vuelve a dibujar de principio a fin con la misma semilla. Por eso, el tiempo que tarda en terminar es el mismo que el de una generación normal. Se obtiene una imagen con la composición que se vio en el borrador.

> Los borradores se pueden usar para la generación que crea imágenes a partir de texto y para redibujar una imagen colocada en la sección **{{ui:params.i2i.title}}**. Con {{ui:params.i2i.title}}, un borrador se dibuja hasta la posición indicada de la parte de los pasos que realmente se dibujan, que depende de la **{{ui:params.image.strength}}**. Las imágenes de borrador no se alinean en la lista de la galería.

Los borradores se alinean en las pestañas de arriba «en el orden en que se iniciaron». Solo las últimas 5 se quedan como pestañas. Todos los borradores están en la pantalla **{{ui:drafts.history.title}}** que abre el botón «Historial» situado a la izquierda de las pestañas.

- Elija un periodo ({{ui:drafts.history.period.today}}, {{ui:drafts.history.period.yesterday}}, {{ui:drafts.history.period.week}}, {{ui:drafts.history.period.older}}) y un modelo en la columna izquierda para ver solo esos borradores. El cuadro de arriba encuentra borradores por palabras de sus prompts o nombres de modelos.
- Los borradores se dividen por día y muestran las imágenes dibujadas entonces, la hora, el tamaño y cuántos borradores e imágenes terminadas hay.
- **{{ui:drafts.history.open}}** abre un borrador y **{{ui:drafts.history.reuse}}** vuelve a poner sus ajustes en el formulario Generar.

Cuando ya no necesite uno, ciérrelo con la ✕ de su pestaña o del historial, o cierre de una vez todos los más antiguos que no son pestañas con «{{ui:drafts.closeOlder}}» en la pantalla del historial.

## Procesar en bloque

![El cuadro de diálogo de procesamiento en bloque](shot:batch)

Se puede aplicar quitar el fondo o ampliar a varias imágenes elegidas a la vez.

1. En la galería, elija varias imágenes (haga clic con `Ctrl` pulsada, o haga clic con `Shift` pulsada para elegir un intervalo).
2. Haga clic derecho en una imagen elegida y elija **{{ui:gallery.menu.batch}}**.
3. Elija el procesamiento.
   - **{{ui:batch.op.removeBackground.title}}**: hace transparente el fondo. Hace falta la extensión ComfyUI-RMBG. Si no está instalada, aparece un botón de instalación.
   - **{{ui:batch.op.upscale.title}}**: amplía con un modelo de ampliación. Si no tiene ningún modelo, instale uno desde la pantalla [Modelos](08-models.md).
4. Pulse **{{ui:batch.run}}**.

Cada imagen entra en la cola como un elemento propio. El avance se ve en la pestaña **{{ui:app.tabs.queue}}**. Los resultados van al mismo tablero que las imágenes originales, como imágenes nuevas. Las imágenes originales no cambian.

Cuando quiera procesar con cuidado una sola imagen mientras cambia los ajustes, use las funciones individuales de este capítulo ([Quitar el fondo](#quitar-el-fondo)). Para ampliar una sola imagen, también puede usar la pestaña [Ampliación](06-upscaling-workflows.md).
