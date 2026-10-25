# Retocar y reutilizar imágenes

Este capítulo reúne las funciones para cuando se piensa «me gustaría retocar un poco esta imagen terminada», «quiero algunas más con el mismo ambiente» o «quiero usar este personaje también en otra escena».

La mayoría de las funciones se abren desde un botón de la barra de herramientas situada sobre el visor (la pantalla que muestra una imagen en grande) o desde el menú que aparece al hacer clic derecho en una imagen de la galería. Al colocar el ratón sobre un botón de la barra de herramientas, aparece su nombre. Para lo básico del visor y de la galería, véase [La galería](03-gallery.md).

## Qué usar y desde dónde

| Qué se quiere hacer | Qué usar | Qué más hace falta |
|---|---|---|
| Crear algunas más con los mismos ajustes, o rehacer una con pequeños cambios | **{{ui:gallery.derive.menu}}** | Que esté instalado el modelo usado en la imagen original |
| Quitar el fondo y dejar solo la persona o el objeto | **{{ui:cutout.menu}}** | La extensión ComfyUI-RMBG |
| Recortar los márgenes transparentes | **{{ui:gallery.menu.trim}}** (solo con clic derecho) | Nada |
| Seleccionar una parte de una imagen para recortarla, borrarla o volver a dibujarla | **{{ui:gallery.menu.segment}}** | Una extensión como ComfyUI-segment-anything-2 |
| Arreglar rostros pequeños y deformados | **{{ui:facefix.menu}}** | Las extensiones ComfyUI-Impact-Pack y ComfyUI-Impact-Subpack |
| Obtener el prompt a partir de una imagen | **{{ui:caption.menu}}** | La extensión ComfyUI-Florence2 |
| Registrar un personaje y usarlo en otras imágenes | **{{ui:character.menu}}** | La extensión para imágenes de referencia (IP-Adapter) |
| Reunir en una sola tabla imágenes con ajustes distintos | **{{ui:xyplot.menu}}** | Nada |
| Elegir entre candidatas dibujadas a medias | La pestaña **{{ui:app.views.drafts}}** | Nada |
| Aplicar el mismo procesamiento a muchas imágenes | **{{ui:gallery.menu.batch}}** (elegir varias y hacer clic derecho) | Depende del procesamiento |

## Cuando se necesita una extensión

Quitar fondos, seleccionar una zona, arreglar rostros y otras funciones similares trabajan añadiendo «extensiones» al motor que crea las imágenes (ComfyUI). Si no hay instalada una extensión, el cuadro de diálogo indica «… necesita la extensión XXX.» y muestra los botones para instalarla.

1. Pulsar **{{ui:cutout.install}}**. Descarga e instala automáticamente lo necesario.
2. Al terminar la instalación, el botón cambia a **{{ui:cutout.restart}}**. Al pulsarlo, ComfyUI se reinicia.
3. Tras el reinicio, el mismo cuadro de diálogo puede usarse tal cual.

La primera vez que se usa, también empieza la descarga de los modelos que emplea la extensión, por lo que lleva tiempo. Hace falta estar conectado a internet.

> Algunas extensiones necesitan tiempo y espacio para instalarse. ComfyUI-Impact-Pack necesita Git para instalarse. En un ordenador sin Git, la instalación falla. Si aparece un mensaje, conviene leerlo antes de actuar.

Las extensiones también se pueden instalar desde la pestaña «{{ui:workflows.panel.packs}}» de [Flujos de trabajo](06-upscaling-workflows.md). Si no funciona, véase también [Solución de problemas](10-troubleshooting.md).

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

1. Mover el control deslizante **{{ui:gallery.derive.dialog.strength}}**. Cuanto más a la izquierda ({{ui:gallery.derive.dialog.close}}), más se conservan la composición y los colores originales; cuanto más a la derecha ({{ui:gallery.derive.dialog.free}}), más se parece a otra imagen.
2. Elegir **{{ui:gallery.derive.dialog.count}}** entre 1, 2, 4 y 8.
3. Pulsar **{{ui:gallery.derive.dialog.create}}**.

Como referencia, con 0,25 aproximadamente se obtiene una imagen casi igual a la original, y con 0,75 aproximadamente una imagen en la que el personaje se mantiene pero la composición cambia mucho. Varía de una imagen a otra, así que conviene probar varios valores. El valor del control deslizante se usa solo para esa vez.

### Qué se conserva y qué no

- Se conserva: los ajustes usados al crear la imagen, como el prompt, el prompt negativo, el modelo, los LoRA, el tamaño, los pasos, la escala CFG y el scheduler.
- Las imágenes de referencia y las capas de control también se recuerdan junto con la imagen, de modo que se usan tal cual. Sin embargo, si esa imagen se ha eliminado de la galería, no se puede crear. El motivo aparece en una notificación.
- No se conserva: las máscaras, la guía regional y los ajustes de borradores. Si una imagen se creó antes de que existiera esta función y usaba imágenes de referencia o algo similar, no se recordaron, por lo que no se pueden conservar. Cuando algo no se pudo conservar, se avisa con una notificación.

En los casos siguientes, el botón no se puede pulsar, o aparece una notificación y no se puede crear.

- Cuando la imagen no es una creada a partir de texto (incluidas las creadas de imagen a imagen, inpainting y outpainting). Las imágenes ampliadas, el vídeo, el audio y similares quedan fuera.
- Cuando el modelo usado en la imagen original no está instalado. Aparece una notificación con el nombre del modelo.

## Quitar el fondo

![El cuadro de diálogo para quitar el fondo](shot:cutout)

Reconoce automáticamente lo que aparece en la imagen y crea una imagen sin el fondo. No hace falta señalar nada con clics.

1. Abrir la imagen en el visor y pulsar **{{ui:cutout.menu}}**, con el icono de las tijeras (también está en el menú del clic derecho).
2. Si hace falta, cambiar los ajustes.
   - **{{ui:cutout.model}}**: normalmente se puede dejar tal cual.
   - **{{ui:cutout.sensitivity}}**: cuanto más bajo, más conserva las partes con límites poco claros.
   - **{{ui:cutout.edge}}**: un valor positivo ensancha el contorno y uno negativo lo recorta.
   - **{{ui:cutout.background}}**: elegir **{{ui:cutout.background.alpha}}** o **{{ui:cutout.background.white}}**.
3. Pulsar **{{ui:cutout.run}}**.

La imagen terminada se guarda como una imagen nueva en el mismo tablero que la original. **La imagen original se conserva tal cual.** Si el resultado no convence, se cambian los ajustes y se pulsa **{{ui:cutout.again}}**. **{{ui:cutout.open}}** la muestra en el visor.

Un fondo blanco es una buena opción cuando después se quiere usar la imagen como imagen de referencia de un [personaje](#registrar-y-usar-un-personaje). El color del fondo se transmite con menos facilidad a las imágenes nuevas que se creen.

## Recortar los márgenes transparentes

Una imagen con el fondo transparente conserva márgenes transparentes alrededor de la imagen. Con **{{ui:gallery.menu.trim}}**, se guarda una imagen transparente nueva recortada justo a la parte que tiene contenido. Resulta útil para usarla como pegatina o como material.

- Se hace clic derecho en una imagen de la galería y se elige. Justo después de quitar un fondo, se puede hacer lo mismo desde **{{ui:cutout.trim}}** en el cuadro de diálogo (solo aparece cuando se dejó el fondo transparente).
- Una sombra tan tenue que casi no se ve se recorta como margen.
- En una imagen cuya zona transparente no llega al borde de la imagen, aparece «No hay margen que recortar.» y no se guarda nada. Tampoco se puede recortar una imagen totalmente transparente.

## Seleccionar una zona y retocarla

![El cuadro de diálogo para indicar con clics qué seleccionar en la imagen](shot:segment)

Con un clic se selecciona lo que se tiene en mente dentro de la imagen. Después se puede recortar, borrar o volver a dibujar la parte seleccionada.

1. Abrir la imagen en el visor y pulsar **{{ui:gallery.menu.segment}}**.
2. Solo la primera vez hace falta la extensión ComfyUI-segment-anything-2. Se instala siguiendo las indicaciones de la pantalla ([Cuando se necesita una extensión](#cuando-se-necesita-una-extensión)).
3. Hacer clic sobre lo que se quiere seleccionar. Si falta algo, se hace clic en otro lugar para añadirlo. Para quitar una zona seleccionada de más, se cambia el botón a **{{ui:segment.mode.exclude}}** y se hace clic, o se hace clic derecho (o clic con `Shift` pulsada). Al hacer clic de nuevo en un punto ya marcado, se cancela ese punto. **{{ui:segment.clear}}** permite volver a empezar desde cero.
4. Pulsar **{{ui:segment.run}}**. La zona seleccionada se muestra en azul.
5. Si la zona azul es correcta, se elige la operación siguiente. Si se quiere seleccionar «el resto», se activa **{{ui:segment.invert}}**.

| Botón | Qué hace | Qué hace falta |
|---|---|---|
| **{{ui:segment.cutout}}** | Recorta solo la parte seleccionada y la guarda como una imagen transparente. | Nada |
| **{{ui:segment.mosaic}}** | Convierte la parte seleccionada en bloques gruesos (mosaico) y guarda la imagen. El tamaño de los bloques es el número situado junto al botón. | Nada |
| **{{ui:segment.erase}}** | Borra la parte seleccionada, integrándola con el resto de la imagen. | La extensión comfyui-inpaint-nodes. Con el modelo LaMa (unos 200 MB), borra de forma natural. Sin él, se puede borrar de manera sencilla. |
| **{{ui:segment.redraw.title}}** | Vuelve a dibujar solo la parte seleccionada según una instrucción de texto. Las demás partes no cambian. | Un modelo de imágenes |
| **{{ui:segment.toCanvas}}** | Envía la imagen y la selección al [lienzo](05-canvas.md). La selección se convierte en una máscara de inpainting. | Nada |

Al volver a dibujar, se escribe **qué dibujar** en texto (por ejemplo: blue hair, red scarf). Se obtiene lo esperado con más facilidad si se escribe en el estilo que mejor domina el modelo (como etiquetas en inglés para un modelo de estilo anime). Cuanto más se baja **{{ui:segment.redraw.strength}}**, más se conservan las formas y los colores originales.

El resultado se guarda como una imagen nueva en el mismo tablero que la original. La imagen original no cambia.

## Arreglar rostros

![El cuadro de diálogo para arreglar rostros](shot:facefix)

En los planos generales, los rostros que aparecen pequeños suelen salir deformados. **{{ui:facefix.menu}}** encuentra automáticamente los rostros de la imagen, vuelve a dibujar solo los rostros con una resolución alta y los devuelve a la imagen original. Solo cambian los rostros.

1. Abrir la imagen en el visor y pulsar **{{ui:facefix.menu}}** (también está en el menú del clic derecho).
2. Solo la primera vez hacen falta las extensiones ComfyUI-Impact-Pack y ComfyUI-Impact-Subpack. Se instalan con **{{ui:facefix.install}}** y se pulsa **{{ui:facefix.restart}}**. El modelo que detecta los rostros lo prepara el propio Subpack.
3. Revisar los ajustes.
   - **{{ui:facefix.model}}**: está elegido el modelo usado en la imagen original.
   - **{{ui:facefix.prompt}}**: ya contiene el prompt de la imagen original. Añadir rasgos del rostro lo hace más eficaz.
   - **{{ui:facefix.strength}}**: cuanto más bajo, más cerca del rostro original; cuanto más alto, más lo vuelve a dibujar.
   - **{{ui:facefix.sensitivity}}**: al subirlo, detecta solo los rostros seguros; al bajarlo, detecta también rostros pequeños y de perfil. Sin embargo, también detecta con más facilidad cosas que no son rostros.
4. Pulsar **{{ui:facefix.run}}**.

El resultado se guarda en el mismo tablero que la original. Al pulsar **{{ui:facefix.open}}**, se puede comparar con la original en el visor. Si no le gusta, se cambian los ajustes y se pulsa **{{ui:facefix.again}}**.

> Una imagen creada con un LoRA se vuelve a dibujar sin el LoRA. Por eso, solo el rostro puede verse con un estilo ligeramente distinto.

> Cuando aparece «No se encontró el modelo de detección de rostros (YOLO)», hay que reiniciar ComfyUI o volver a instalar las extensiones.

## Crear un prompt a partir de una imagen

![El cuadro de diálogo tras escribir las etiquetas de una imagen](shot:caption)

Observe una imagen y escriba un prompt (etiquetas o una frase) para dibujarla. Se usa cuando se quieren imágenes parecidas a una que le gusta, o cuando no se sabe cómo escribir el prompt.

1. Elegir el botón **{{ui:caption.menu}}** del visor, o **{{ui:caption.menu}}** en el menú del clic derecho de la imagen. También se puede abrir desde el botón **{{ui:caption.fromPrompt}}** situado sobre el campo del prompt de la pestaña Generar. Sobre ese botón se puede soltar una imagen de la galería o un archivo de imagen del ordenador.
2. En **{{ui:caption.style}}**, elegir **{{ui:caption.style.tags}}** o **{{ui:caption.style.sentence}}**.
3. Pulsar **{{ui:caption.run}}**.
4. Las palabras obtenidas se pueden editar en el mismo sitio. Después se pulsa **{{ui:caption.replace}}**, **{{ui:caption.append}}** o **{{ui:caption.copy}}**.

Reemplazar y añadir actúan sobre «{{ui:params.prompt.positive}}» de la pestaña Generar. Esta función no añade ninguna imagen a la galería.

> Esta función necesita la extensión ComfyUI-Florence2. Si no está instalada, se puede instalar desde el cuadro de diálogo (véase «Cuando se necesita una extensión» en este capítulo). La primera vez que se usa, empieza la descarga del modelo que describe las imágenes con palabras (Florence-2 PromptGen).

## Registrar y usar un personaje

![El cuadro de diálogo para registrar como personaje](shot:character)

Si se registra una imagen de un personaje que le gusta, se pueden dibujar imágenes en otras escenas que se acerquen a ese mismo personaje. Se registran las tres cosas siguientes.

- Imágenes de referencia (imágenes del mismo personaje, tantas como se quiera)
- Palabras de aspecto (color del pelo y de los ojos, ropa, etc.; se añaden al principio del prompt)
- La intensidad del parecido

### Registrar

1. En la galería, elegir la imagen que se quiere registrar. Para varias imágenes, hacer clic con `Ctrl` pulsada.
2. Elegir el botón **{{ui:character.menu}}** del visor, o **{{ui:character.menu}}** en el menú del clic derecho. Al abrir el campo **{{ui:character.row.choose}}** de la pestaña Generar, al final de la lista está **{{ui:character.row.register}}**, y también se puede abrir desde ahí.
3. Escribir el **{{ui:character.name}}** y el **{{ui:character.tags}}**. Se escriben los rasgos que no deben cambiar (pelo castaño, blusa blanca, falda azul, etc.).
4. Decidir la **{{ui:character.weight}}**. Cuanto más se sube, más se parece a las imágenes de referencia, pero menos libertad hay en la escena y la composición.
5. Pulsar **{{ui:character.save}}**.

Con **{{ui:character.addSelected}}**, más adelante se pueden añadir a las imágenes de referencia las imágenes elegidas en la galería. **{{ui:character.removePicture}}** es la ✕ de la esquina superior derecha de una imagen.

Si se activa **{{ui:character.whiteBg}}**, se crea una imagen en la que el fondo de la imagen registrada se sustituye por blanco, y esa se usa como imagen de referencia. Así se evita que el color del fondo se transmita a las imágenes generadas. La imagen original se conserva y la imagen de fondo blanco se guarda como una nueva. Cuando la extensión ComfyUI-RMBG, que se usa para quitar fondos, no está instalada, este interruptor no se puede usar y se emplea la imagen original tal cual.

### Usar

1. En el panel izquierdo de la pestaña **{{ui:app.tabs.generate}}** (o de la pestaña [Lienzo](05-canvas.md)), abrir **{{ui:character.row.choose}}** y elegir el personaje que se quiere usar.
2. Las imágenes de referencia del personaje entran en el campo «{{ui:params.refImage.sectionLabel}}» y las palabras de aspecto se añaden al principio del prompt.
3. Generar como de costumbre.

Al usarlo, la aplicación puede ajustar algunas cosas automáticamente. Se avisa con una notificación.

- Cuando se usan imágenes de referencia, una escala CFG alta tiende a quemar la imagen, por lo que, si la escala CFG es mayor que 5, se baja a 4,5.
- Se pueden tener como máximo 8 imágenes de referencia en total. Cuando el total con otras imágenes de referencia supera 8, se usan las imágenes del principio.
- Cuando hay varias imágenes de referencia, la intensidad de cada una se reduce automáticamente para que, juntas, no resulten demasiado fuertes.
- Las imágenes eliminadas de la galería no se pueden usar. Si se han eliminado todas, el personaje no se puede usar.

Para modificar o eliminar un personaje registrado, se usa el botón «…» de un elemento de la lista.

> Es una función que «se acerca» al mismo personaje, por lo que no da exactamente el mismo rostro. El peinado, el color, la ropa, etc. suelen conservarse, pero las facciones cambian un poco. Escribir en las palabras de aspecto los rasgos que se quieren conservar ayuda.

> Para usar imágenes de referencia, hacen falta la extensión ComfyUI_IPAdapter_plus y un modelo para imágenes de referencia. Si no están instalados, se pueden instalar desde el campo de imágenes de referencia de la pestaña Generar. Para los modelos, véase el capítulo [Modelos](08-models.md).

## Comparar ajustes con una cuadrícula de comparación

![El cuadro de diálogo de la cuadrícula de comparación](shot:xyplot)

¿Cómo cambia una imagen al variar la escala CFG o el número de pasos? Esta función lo presenta en una sola tabla para poder compararlo.

1. En la pestaña Generar, decidir el prompt y el modelo como de costumbre.
2. Pulsar la «▼» situada a la derecha del botón **{{ui:params.invoke.invoke}}** y elegir **{{ui:xyplot.menu}}**.
3. Con **{{ui:xyplot.x}}** y **{{ui:xyplot.y}}**, elegir los ajustes que se van a variar. Se puede crear con solo uno de ellos.
4. Escribir los valores. Los números se escriben separados por comas (por ejemplo: 3, 5, 7).
5. Pulsar **{{ui:xyplot.run}}**.

En la parte inferior del cuadro de diálogo aparece el número de imágenes que se van a crear, como «Se crearán 3 columnas × 2 filas = 6 imágenes.».

Los ajustes que se pueden variar son los siguientes.

| Ajuste | Cómo se escribe |
|---|---|
| {{ui:xyplot.axis.cfgScale}} | Números (1 a 30) |
| {{ui:xyplot.axis.steps}} | Números enteros (1 a 150) |
| {{ui:xyplot.axis.seed}} | Números enteros |
| {{ui:xyplot.axis.strength}} | Números (0,05 a 1). Solo tiene efecto al crear a partir de una imagen (imagen a imagen). |
| {{ui:xyplot.axis.scheduler}} | Se elige de una lista |
| {{ui:xyplot.axis.model}} | Se eligen de una lista modelos de la misma familia |
| {{ui:xyplot.axis.prompt}} | Se escribe uno por línea. Se añaden al prompt |

Las reglas son las siguientes.

- Se pueden introducir hasta 8 valores para un ajuste. La tabla puede tener como máximo 36 imágenes en total.
- No se puede elegir el mismo ajuste para el eje horizontal y el vertical.
- Todas las imágenes se dibujan con la **misma semilla** (salvo cuando se elige un ajuste que cambia la semilla). La única diferencia es el ajuste que se varió.
- Los ajustes se toman del formulario de la pestaña Generar en ese momento. El formulario no se modifica.
- Una imagen que no se pudo crear aparece como × en la tabla. La tabla se crea igualmente con las demás imágenes.

La tabla terminada se guarda en la galería como una sola imagen. **{{ui:xyplot.open}}** la muestra en el visor. Las imágenes individuales a partir de las cuales se hizo la tabla también permanecen en la galería.

> Cuantas más imágenes, más tiempo lleva. Para 36 imágenes hacen falta 36 generaciones. Se recomienda probar al principio con 2 o 3 valores.

## Elegir entre borradores

![La pestaña Borradores con candidatas dibujadas a medias alineadas](shot:drafts)

Una imagen cambia mucho según la semilla. Los borradores son una función que dibuja muchas semillas solo «hasta la mitad» y luego dibuja hasta el final únicamente las composiciones que le gustan. Ahorra tiempo.

Abrir la pestaña **{{ui:app.views.drafts}}**, en el centro de la pestaña **{{ui:app.tabs.generate}}**.

1. Elegir el **{{ui:drafts.model}}**. Al principio está elegido el modelo de la pestaña Generar.
2. Decidir la **{{ui:drafts.count}}** (de 1 a 24 imágenes; 8 al principio).
3. Decidir el **{{ui:drafts.position}}** (del 25 al 60 %; 35 % al principio). Cuanto menor es, más rápido se termina, pero más toscas son las imágenes.
4. Pulsar **{{ui:drafts.start}}**.

Las imágenes de borrador se alinean en el orden en que se van terminando. Se usan el prompt y los demás ajustes de la pestaña Generar.

Al hacer clic en una imagen, queda elegida (al hacer clic de nuevo, se deselecciona). Con doble clic se ve en grande en el visor. El botón de la estrella (**{{ui:drafts.keep}}**) y la ✕ (**{{ui:drafts.reject}}**) son marcas para uso propio. Al pulsar el botón «{{ui:manual.drafts.finish}} N imágenes» de abajo a la derecha (N es el número de imágenes elegidas), las imágenes elegidas se dibujan hasta el final. Para elegir de nuevo, se pulsa **{{ui:drafts.clearSelection}}**.

Las imágenes dibujadas hasta el final entran en la galería igual que en una generación normal, y sobre el borrador aparece «{{ui:drafts.badge.finished}}». Si algún borrador falló, aparece el botón «{{ui:manual.drafts.retry}} N fallidos».

> Aunque se llame «{{ui:manual.drafts.finish}}», no se reanuda desde la mitad. Se vuelve a dibujar de principio a fin con la misma semilla. Por eso, el tiempo que lleva terminarla es el mismo que el de una generación normal. Se obtiene una imagen con la composición que se vio en el borrador.

> Los borradores solo se pueden usar en la generación que crea imágenes a partir de texto. Si hay imágenes de referencia o algo similar configurado, aparece un mensaje y no se puede empezar. Las imágenes de borrador no se alinean en la lista de la galería.

Los borradores se alinean en las pestañas de arriba «en el orden en que se iniciaron». Cuando ya no hacen falta, se cierran con la ✕ de la pestaña.

## Procesar en bloque

![El cuadro de diálogo de procesamiento en bloque](shot:batch)

Se puede aplicar el quitado de fondo o la ampliación a varias imágenes elegidas a la vez.

1. En la galería, elegir varias imágenes (clic con `Ctrl` pulsada, o clic con `Shift` pulsada para elegir un rango).
2. Hacer clic derecho sobre una imagen elegida y elegir **{{ui:gallery.menu.batch}}**.
3. Elegir el procesamiento.
   - **{{ui:batch.op.removeBackground.title}}**: deja el fondo transparente. Hace falta la extensión ComfyUI-RMBG. Si no está instalada, aparece un botón de instalación.
   - **{{ui:batch.op.upscale.title}}**: amplía con un modelo de ampliación. Si no se dispone de un modelo, se instala uno desde la pantalla de [Modelos](08-models.md).
4. Pulsar **{{ui:batch.run}}**.

Cada imagen entra en la cola como un elemento independiente. El progreso se puede ver en la pestaña **{{ui:app.tabs.queue}}**. Los resultados van al mismo tablero que las imágenes originales, como imágenes nuevas. Las imágenes originales no cambian.

Cuando se quiere procesar con cuidado una sola imagen mientras se cambian los ajustes, se usan las funciones individuales de este capítulo ([Quitar el fondo](#quitar-el-fondo)). Para ampliar una sola imagen, también se puede usar la pestaña de [Ampliación](06-upscaling-workflows.md).
