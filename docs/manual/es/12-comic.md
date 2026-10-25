# Cómic

![La pestaña Cómic completa. A la izquierda, los mismos ajustes que en Generar; en el centro, una página vacía](shot:comic)

**{{ui:app.tabs.comic}}** es un espacio de trabajo para crear páginas de cómic. En la fila de iconos de la parte superior del panel izquierdo de la pestaña {{ui:app.tabs.generate}}, se abre con el icono situado más a la derecha, un libro (también se abre con la tecla 3). Los cómics se agrupan en proyectos. Dentro de un proyecto se colocan las páginas; cada página se divide en viñetas, y cada viñeta se dibuja por separado. Además de la imagen dibujada, una viñeta puede tener una imagen de la galería o una pose. Si se añaden globos y textos narrativos, la página puede guardarse como una sola imagen.

La pantalla se divide en tres partes.

- Izquierda: de arriba abajo están «{{ui:presets.label}}» y «{{ui:params.seed.label}}», como en la pestaña {{ui:app.tabs.generate}}, la lista de cómics y «{{ui:params.model.label}}». Debajo está la sección **{{ui:params.prompt.title}}**, con los prompts de la viñeta seleccionada. Más abajo están el botón para dibujar la viñeta seleccionada y el botón para dibujar todas las viñetas, la sección de imagen de referencia y los ajustes detallados de generación. Haga clic en el encabezado de un ajuste para abrir o cerrar esa sección.
- Centro: «{{ui:app.views.comic}}». En la barra de herramientas de arriba están los ajustes de página, las plantillas, la herramienta para cortar viñetas, las herramientas de viñeta (globos y cuadros de texto, pose, plantillas de viñeta), las herramientas de imagen y el botón para convertir la página en imagen. Debajo de la página están deshacer y rehacer, el cambio de página y el nivel de zoom.
- Derecha: la galería. Las imágenes dibujadas en las viñetas también se añaden a la galería.

## Crear un cómic

![La lista de cómics, arriba a la izquierda. Una miniatura de la primera página, el nombre del cómic y el número de páginas](shot:comic-project)

1. Abra la lista de cómics arriba a la izquierda, pulse **{{ui:comic.project.new}}** al final de la lista y dé un nombre. Si todavía no hay ningún cómic, también puede crearlo con **{{ui:comic.project.new}}** en el centro.
2. La página empieza con 3 viñetas. Para añadir una página, pulse **{{ui:comic.page.add}}** debajo de la página.
3. Haga clic en la página sobre la viñeta que quiere dibujar para seleccionarla. En la sección **{{ui:params.prompt.title}}** de la izquierda, escriba la descripción de su imagen y pulse **{{ui:comic.panel.draw}}**.
4. Para dibujar todas las viñetas de la página en orden, pulse **{{ui:comic.page.drawAll}}**, junto a **{{ui:comic.panel.draw}}**.

La lista de cómics muestra, para cada cómic, una miniatura de su primera página y el número de páginas. Al seleccionar un cómic en la lista, ese cómic se abre. Para cambiarle el nombre o eliminarlo, use el menú a la derecha de cada fila.

Para generar una imagen hay que haber elegido un modelo. No se puede dibujar una viñeta sin prompt. Los prompts funcionan mejor si se escriben como etiquetas en inglés. La imagen dibujada queda en esa viñeta y también se añade a la galería. Una viñeta que no se pudo dibujar muestra **{{ui:comic.draw.failed}}** en la página.

## Los prompts de la viñeta

En la pestaña Cómic, la sección **{{ui:params.prompt.title}}** de la izquierda contiene los prompts de la viñeta seleccionada. Al seleccionar otra viñeta, el texto de la sección cambia al de esa viñeta. Cada viñeta tiene un par de **{{ui:params.prompt.positive}}** y **{{ui:params.prompt.negative}}**. En la pestaña Cómic siempre hay una viñeta seleccionada.

La sección se usa igual que en la pestaña {{ui:app.tabs.generate}}. Al cargar un «{{ui:presets.label}}», sus prompts entran en la viñeta seleccionada. La **{{ui:params.promptBook.title}}** y los preajustes de prompt también entran en la viñeta seleccionada. Al volver a la pestaña {{ui:app.tabs.generate}}, vuelven a aparecer los prompts que había escrito en la pestaña {{ui:app.tabs.generate}}.

La imagen de una viñeta se dibuja solo con los prompts de esa viñeta. No se añaden los prompts de otras viñetas ni los de la pestaña {{ui:app.tabs.generate}}.

La sintaxis de los prompts dinámicos (las combinaciones entre llaves y los comodines) también funciona en el cómic. En el modo **{{ui:params.prompt.modeRandom}}**, la semilla de esa imagen elige la combinación y se dibuja 1 imagen. En el modo **{{ui:params.prompt.modeCombinatorial}}**, se dibuja cada combinación por separado. La primera entra en la viñeta, y las imágenes de las demás combinaciones solo entran en la galería (no en la viñeta). Si hay varias combinaciones, aparece un aviso.

## Ajustes de página

Pulse **{{ui:comic.page.settings}}** arriba en el centro para abrir los ajustes de la página.

El número de viñetas de la página se cambia de 1 a 24 en el campo **{{ui:comic.page.panelCount}}**. Al cambiar el número, la distribución de la página se vuelve a calcular automáticamente. Una página cuya forma de viñetas se cambió a mano también vuelve a la distribución automática cuando cambia el número.

El número de columnas de la página se elige de 1 a 3 en **{{ui:comic.page.columns}}**. En **{{ui:comic.page.direction}}** se elige la dirección de lectura de las viñetas. El manga suele leerse «De derecha a izquierda (manga)», así que una página nueva empieza con esa dirección. Al cambiar la dirección, el orden de las viñetas se invierte de izquierda a derecha.

Al reducir el número de viñetas, se eliminan las últimas. Las imágenes de las viñetas eliminadas siguen en la galería.

El tamaño del papel se elige en **{{ui:comic.page.size}}**, entre A4, A5, B4 y B5. La proporción de la página es la misma que la del papel. La imagen de la página que se guarda se dibuja con el tamaño del papel a 200 dpi (A4 mide unos 1654 × 2339 px).

Con **{{ui:comic.page.frameWidth}}** se cambia el grosor de las líneas del marco de las viñetas, de 0 mm a 3 mm (al principio 0,6 mm). Con **{{ui:comic.page.inset}}** se fija el espacio entre la línea del marco y la imagen, de 0 mm a 10 mm (al principio 0 mm, así que la imagen queda pegada a la línea). Ambos valores se aplican a todas las viñetas de la página, y la imagen de la página guardada se dibuja con el mismo grosor y el mismo espacio.

## Cambiar de página y hacer zoom

Debajo de la página, en el centro, hay botones con los números de página. Pulse un número o las flechas de izquierda y derecha para pasar a otra página. Con **{{ui:comic.page.add}}** se añade una página, y con el botón de la papelera se elimina la página abierta (vuelva a pulsar para confirmarlo). Aunque haya muchas páginas, los botones de número quedan en una sola línea, y los que no caben se desplazan en horizontal. El número de la página abierta se coloca a la vista.

El tamaño con que se muestra la página se cambia con los botones **{{ui:common.zoomIn}}** y **{{ui:common.zoomOut}}**, debajo de la página a la derecha. También puede girar la rueda del ratón con Ctrl pulsado para acercar o alejar alrededor de la posición del puntero. Al pulsar el número del nivel de zoom, vuelve al 100 %.

## Plantillas

![La lista de plantillas de página. Las distribuciones se muestran como pequeños dibujos](shot:comic-templates)

Pulse **{{ui:comic.template.pageTitle}}** arriba en el centro para abrir la lista de plantillas de página. Cada plantilla se muestra como un pequeño dibujo de su distribución. Al pulsar un dibujo, esa plantilla se aplica a la página abierta.

En la lista aparecen las cinco distribuciones estándar («{{ui:comic.template.builtin.single}}», «{{ui:comic.template.builtin.strip}}», «{{ui:comic.template.builtin.four}}», «{{ui:comic.template.builtin.six}}» y «{{ui:comic.template.builtin.nine}}»), las plantillas de forma de viñetas (diez en total, con cortes inclinados y combinaciones de viñetas grandes y pequeñas) y las plantillas guardadas. Las distribuciones estándar se aplican con la dirección de lectura y el tamaño del papel actuales de la página. Una plantilla de forma se aplica con la dirección de lectura de esta página, y sus viñetas se voltean para ajustarse a ella. Las plantillas guardadas se aplican con la dirección de lectura y el tamaño del papel que tenían al guardarlas. Si el número de viñetas baja, el texto bajo el dibujo cambia a **{{ui:comic.template.applyAgain}}**. Al volver a pulsarlo se aplica, y las imágenes y los globos de las últimas viñetas se borran.

Para guardar la distribución de esta página, escriba un nombre debajo de la lista y pulse **{{ui:comic.template.savePage}}**. Si deja el nombre vacío, se usa el nombre «Plantilla» con un número. Las plantillas se guardan dentro de este proyecto.

Una plantilla de viñeta guarda el prompt, el prompt negativo, la pose, los globos y la imagen de referencia de la viñeta seleccionada. No guarda la imagen de la viñeta. En la sección que se abre al pulsar **{{ui:comic.template.panelTitle}}** arriba en el centro, escriba un nombre y pulse **{{ui:comic.template.save}}**. En otra viñeta, pulse **{{ui:comic.template.apply}}** en la fila de la plantilla guardada para aplicarla a esa viñeta. Se aplican el prompt, el prompt negativo, la pose, los globos y la imagen de referencia. La imagen de esa viñeta se mantiene.

## Cambiar la forma de las viñetas

![Página con viñetas reformadas: la viñeta superior está cortada en diagonal, y los vértices de la viñeta seleccionada se ven como puntos](shot:comic-shapes)

La forma de las viñetas se puede cambiar a mano, incluso cuando la página tiene la distribución automática. Pulse **{{ui:comic.shape.cut}}** arriba en el centro y luego trace una línea sobre una viñeta de un borde a otro: la viñeta se divide en dos. Una línea que no la divide en dos (una línea fuera de la viñeta, o una que solo toca una esquina) no corta nada.

Para añadir una viñeta, pulse **{{ui:comic.shape.addPanel}}** junto a **{{ui:comic.shape.cut}}**. La viñeta seleccionada (o la más grande, si no hay ninguna seleccionada) se divide en dos con una línea que parte por la mitad su lado más largo, y la nueva viñeta queda seleccionada. No se pueden añadir viñetas cuando la página ya tiene 24 o cuando la viñeta es demasiado pequeña.

Para quitar una viñeta, selecciónela y pulse **{{ui:comic.shape.removePanel}}**. Su imagen, sus prompts y sus globos se van con ella. En la distribución automática, las viñetas restantes se vuelven a distribuir. En una página cuyas viñetas se reformaron a mano, la viñeta vecina más cercana crece hasta ocupar el espacio liberado y conserva su propio contenido; si la forma no permite esa unión, la página vuelve a la distribución automática. La última viñeta de una página no se puede eliminar. Una viñeta eliminada se recupera con Ctrl+Z (volver a poner una imagen en una viñeta no se deshace).

Para quitar la selección de la viñeta, pulse el margen de la página o cualquier lugar vacío alrededor de la página.

La viñeta seleccionada muestra sus esquinas como puntos redondos. Arrastre una esquina para cambiar la forma de la viñeta. Una esquina compartida con una viñeta vecina se mueve con ella. Haga doble clic en un borde para añadir una esquina, y doble clic en una esquina recta para quitarla. Una esquina no se mueve a un lugar donde las viñetas se superpondrían ni donde un borde cruzaría otro borde.

En el centro de cada borde de la viñeta seleccionada aparece una pequeña barra (el tirador del borde). Al arrastrar el tirador, todo ese borde se mueve y las viñetas vecinas cambian de forma con él. Un borde no se mueve fuera del margen de la página.

En una página cuya forma se cambió a mano, pulse **{{ui:comic.shape.reset}}** en **{{ui:comic.page.settings}}** para volver a la distribución automática. Al cambiar el número de viñetas o de columnas también se vuelve a la distribución automática. Ctrl+Z deshace un cambio de forma.

## La imagen de la viñeta

![Una imagen en una viñeta. Alrededor de la imagen reducida y girada se ven los tiradores de las cuatro esquinas y el de arriba](shot:comic-image)

La imagen de una viñeta no tiene por qué ser una que haya dibujado. Si arrastra una imagen de la galería sobre una viñeta, esa imagen pasa a ser la imagen de la viñeta. Seleccione una viñeta y pulse **{{ui:comic.panel.imageUpload}}** arriba en el centro para elegir un archivo de imagen de su ordenador. El archivo entra primero en la galería y después pasa a ser la imagen de la viñeta.

La imagen de la viñeta se mueve directamente sobre la página, como en el {{ui:app.tabs.canvas}}.

- Arrastre la imagen para moverla. Una parte de la imagen puede quedar fuera de la viñeta.
- Pulse la imagen para seleccionarla: aparecen a su alrededor un marco de puntos y unos tiradores. La parte que sobresale de la viñeta también se ve, más tenue.
- Arrastre un tirador de las esquinas para ampliar o reducir la imagen alrededor de su centro.
- Arrastre el tirador redondo de arriba para girar la imagen. Con Mayús pulsada, gira de 15° en 15°.
- La imagen seleccionada se mueve poco a poco con las teclas de flecha (con Mayús, se mueve más).

Las herramientas de arriba en el centro también cambian la imagen. **{{ui:comic.image.fitCover}}** quita el giro y extiende la imagen hasta llenar la viñeta. **{{ui:comic.image.fitContain}}** ajusta la imagen para que quepa entera en la viñeta. **{{ui:comic.image.rotateLeft}}** y **{{ui:comic.image.rotateRight}}** la giran 90°, y **{{ui:comic.image.flipX}}** y **{{ui:comic.image.flipY}}** la voltean. **{{ui:comic.image.scaleDown}}** y **{{ui:comic.image.scaleUp}}** la reducen y la amplían poco a poco, y **{{ui:comic.image.center}}** lleva el centro de la imagen al centro de la viñeta.

Para quitar la imagen de la viñeta, selecciónela y pulse la tecla Supr, o pulse **{{ui:comic.panel.imageClear}}** arriba en el centro. Aunque la quite, la imagen sigue en la galería. Si pulsa **{{ui:comic.history.undo}}** en el aviso que aparece justo después, la imagen vuelve con su posición y su tamaño anteriores. Al poner otra imagen, la posición y el tamaño vuelven a su estado inicial.

## Intercambiar viñetas

Sujete el tirador de seis puntos (⠿) que está arriba a la izquierda de la viñeta, arrástrelo hasta la viñeta con la que quiere intercambiarla y suéltelo: las dos viñetas se intercambian. La imagen, los prompts, la pose y los globos de una viñeta se mueven junto con ella.

En cuanto empieza a mover el tirador, una copia semitransparente de la viñeta que se mueve acompaña al puntero. La viñeta de destino del intercambio se marca con un recuadro.

## Elegir la pose

![Pantalla con la figura de palos para definir la pose de la viñeta](shot:comic-pose)

Seleccione una viñeta, pulse el botón de pose arriba en el centro para abrir su sección y pulse **{{ui:comic.panel.pose}}** para abrir una pantalla en la que la pose se define con una figura de palos. La pose se dibuja con la forma de esa viñeta, y al pulsar **{{ui:comic.pose.use}}** pasa a ser la pose de esa viñeta. La pose puede volver a abrirse para corregirla. La pose que se define en esta pantalla es de una sola persona. Para quitarla, pulse **{{ui:comic.panel.poseRemove}}**.

![El campo de preajustes de pose de la viñeta. Elija una categoría y una pose](shot:comic-presets)

En la misma sección, la pose también se puede poner a partir de las mismas poses prediseñadas del lienzo. Elija una categoría en **{{ui:comic.panel.poseCategory}}**, una pose en **{{ui:comic.panel.posePreset}}** y pulse **{{ui:comic.panel.poseApply}}**. Se crea un dibujo de figura de palos ajustado al tamaño de la viñeta, y ese dibujo pasa a ser la pose de la viñeta. Según la composición, puede haber varias personas una al lado de otra. En ese caso, todas entran en la viñeta.

Para que la pose se refleje en la imagen, hay que tener instalado un modelo ControlNet de pose (OpenPose, o un modelo union). Si no está instalado, la pose no se usa en la imagen y aparece un aviso.

## Globos y textos narrativos

![Un globo recién añadido. La edición del globo se superpone al tablero de la derecha](shot:comic-balloon)

Seleccione una viñeta, pulse **{{ui:comic.panel.bubbles}}** arriba en el centro para abrir la sección y pulse **{{ui:comic.bubble.kind.speech}}**, **{{ui:comic.bubble.kind.thought}}**, **{{ui:comic.bubble.kind.shout}}** o **{{ui:comic.bubble.kind.caption}}** para añadir a esa viñeta un globo de ese tipo; **{{ui:comic.bubble.editor}}** se abre superpuesto al tablero de la derecha. La sección muestra los globos de la viñeta con su tipo y su texto. Al pulsar una fila se selecciona ese globo, y al pulsar el botón del lápiz (**{{ui:comic.bubble.edit}}**) se abre **{{ui:comic.bubble.editor}}**.

- {{ui:comic.bubble.kind.speech}}: una elipse a la que se puede añadir una cola.
- {{ui:comic.bubble.kind.thought}}: una elipse seguida de pequeños círculos en lugar de la cola.
- {{ui:comic.bubble.kind.shout}}: un globo de borde dentado.
- {{ui:comic.bubble.kind.caption}}: un recuadro de esquinas rectas, sin cola.

![Un globo con texto vertical y el tirador redondo en la punta de la cola](shot:comic-tail)

Los globos se colocan arrastrándolos sobre la página. Al seleccionar un globo, aparece un tirador redondo en la punta de su cola. Al arrastrar ese tirador, cambian la dirección y la longitud de la cola. Para añadir o quitar la cola, pulse **{{ui:comic.bubble.tail}}** en **{{ui:comic.bubble.editor}}**.

Al hacer doble clic en un globo de la página también se abre **{{ui:comic.bubble.editor}}**. La edición se abre superpuesta al tablero, a la derecha de la pantalla, así que no tapa la página (si el panel derecho está cerrado o es estrecho, se abre en cambio en el borde derecho de la página). Aquí se pueden cambiar **{{ui:comic.bubble.kindLabel}}**, el texto, **{{ui:comic.bubble.size}}**, **{{ui:comic.bubble.vertical}}** y **{{ui:comic.bubble.tail}}**. Para cerrarla, pulse la × de arriba a la derecha o la tecla Esc. Al cerrarla, el globo sigue seleccionado.

El tamaño del texto se elige de 60 % a 220 % en **{{ui:comic.bubble.size}}**. Al pulsar **{{ui:comic.bubble.vertical}}**, el texto pasa a estar en vertical, con las líneas de derecha a izquierda.

Lo que ya no se necesite se elimina con la papelera de su fila en la sección o con **{{ui:comic.bubble.remove}}** en **{{ui:comic.bubble.editor}}**. También puede seleccionar un globo en la página y pulsar la tecla Supr.

## Ajustes de generación

«{{ui:params.model.label}}», «{{ui:params.lora.label}}», «{{ui:params.advanced.vae}}», «{{ui:params.refImage.sectionLabel}}» y «{{ui:params.hires.title}}» son los mismos que en la pestaña {{ui:app.tabs.generate}}. Si cambia los ajustes de la izquierda, el cambio también se aplica en la pestaña {{ui:app.tabs.generate}}. Solo los prompts son propios de cada viñeta (véase «Los prompts de la viñeta»).

Cada viñeta se dibuja con una sola imagen. Por eso, el tamaño de la imagen depende del tamaño de la viñeta y no de los ajustes de la pestaña {{ui:app.tabs.generate}}. El campo de iteraciones no aparece en el cómic.

## Imagen de referencia de cada viñeta

Una viñeta puede tener una imagen de referencia propia, además de las imágenes de referencia de la pestaña {{ui:app.tabs.generate}}. Sirve para que el dibujo de la viñeta siga el aspecto de la cara o la ropa de un personaje. En **{{ui:params.refImage.sectionLabel}}**, dentro de la viñeta seleccionada, arrastre una imagen de la galería, o elija un archivo de imagen con **{{ui:comic.panel.imageUpload}}**.

La imagen de referencia solo se usa al dibujar la viñeta. Si hay imágenes de referencia en la pestaña {{ui:app.tabs.generate}}, se usan junto con ella. Elija el modelo de IP-Adapter con **{{ui:params.refImage.model}}** y la fuerza con **{{ui:params.refImage.weight}}** (de 0 a 1; el valor predeterminado es 0,5). En los modelos que no son FLUX, también puede elegir **{{ui:params.refImage.clipVision}}** y **{{ui:params.refImage.methodLabel}}**. La lista de modelos muestra solo los modelos de IP-Adapter que encajan con el modelo principal.

Para quitar la imagen de referencia, pulse **{{ui:comic.reference.remove}}**. La imagen se queda en la galería. Un cambio en la imagen de referencia se puede deshacer con Ctrl+Z.

Si no hay ningún modelo de IP-Adapter elegido o instalado para la imagen de referencia, o si su imagen no está en la galería, la imagen de referencia no se usa. La imagen de referencia usa los mismos modelos de IP-Adapter y la misma extensión que las imágenes de referencia de la pestaña {{ui:app.tabs.generate}}.

## Convertir la página en una sola imagen

Pulse **{{ui:comic.page.export}}** arriba en el centro para guardar la página en la galería como una sola imagen (PNG). Las imágenes de las viñetas y el texto de los globos y de los textos narrativos se dibujan en esa imagen. Las imágenes de las viñetas se dibujan con la posición, el tamaño, el giro y el volteo que tienen en la página. El texto se dibuja con las fuentes que hay en Windows, incluidas las japonesas. La imagen se dibuja a 200 dpi, con el tamaño del papel de la página.

## Deshacer y rehacer

Pulse **{{ui:comic.history.undo}}**, abajo a la izquierda debajo de la página, para deshacer el último cambio, y **{{ui:comic.history.redo}}** para rehacer un cambio deshecho. Con el teclado, Ctrl+Z deshace un cambio y Ctrl+Mayús+Z (o Ctrl+Y) lo rehace (en Mac, Command en lugar de Ctrl). Al deshacer se vuelven atrás la disposición de las páginas y de las viñetas (incluida su forma), los prompts y las poses de las viñetas, los globos y las imágenes de referencia de las viñetas. Las imágenes de las viñetas (ponerlas, quitarlas, moverlas), las plantillas y el nombre del cómic no se deshacen. El texto escrito en un mismo campo sin pausas se deshace como un solo cambio. Con el cursor en un campo de texto, Ctrl+Z cambia solo el texto de ese campo.

## Guardar y eliminar

El cómic se guarda automáticamente aproximadamente 1 segundo después de cada cambio. Aunque cierre la aplicación y la vuelva a abrir, los proyectos guardados siguen en la lista, y las páginas, las viñetas, los globos y las plantillas se mantienen tal como estaban. También se incluyen en las copias de seguridad.

Para eliminar un proyecto, abra el menú de su fila en la lista de cómics, pulse **{{ui:comic.project.delete}}** y vuelva a pulsar para confirmarlo. Al eliminar un proyecto, se borran sus páginas, viñetas y plantillas. Las imágenes dibujadas siguen en la galería.

Para eliminar una página, pulse el botón de la papelera debajo de la página (**{{ui:comic.page.delete}}**) y vuelva a pulsar para confirmarlo. Las viñetas y los globos de la página se borran, pero las imágenes dibujadas siguen en la galería.

## Usar las imágenes dibujadas

Las imágenes dibujadas son imágenes normales de la galería. Las operaciones de otras pantallas que usan imágenes de la galería, como arrastrar una imagen de la galería a la pestaña {{ui:app.tabs.canvas}}, se pueden usar igual con ellas.
