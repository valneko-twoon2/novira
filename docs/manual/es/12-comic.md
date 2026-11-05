# Cómic

![La pestaña Cómic completa. A la izquierda, los mismos ajustes que en la pestaña Generar. En el centro, una página de cómic vacía](shot:comic)

**{{ui:app.tabs.comic}}** es un espacio de trabajo para crear páginas de cómic. Se abre con el último icono (el libro) de la fila de iconos de la parte superior del panel izquierdo de la pestaña **{{ui:app.tabs.generate}}** (la tecla `1` abre la que haya usado en último lugar de las dos). Los cómics se guardan en proyectos. Un proyecto contiene páginas, cada página se divide en viñetas y se dibuja una imagen para cada viñeta. Además de las imágenes que se dibujan, una viñeta puede tomar una imagen de la galería o una pose. Añada globos y textos narrativos, y podrá guardar la página como una sola imagen.

La pantalla se divide en tres partes.

- Izquierda: en la parte superior, la fila de iconos de imagen, vídeo, etc. (el último es {{ui:app.tabs.comic}}); debajo, de arriba abajo, los {{ui:presets.label}} y la {{ui:params.seed.label}}, igual que en la pestaña {{ui:app.tabs.generate}}, luego el botón de dibujar, la lista de cómics y el {{ui:params.model.label}}. El botón de dibujar está donde está el botón de generar en las demás pantallas, y el menú de flecha que tiene al lado elige si dibuja solo la viñeta seleccionada o todas las viñetas de la página. Debajo está la sección **{{ui:params.prompt.title}}**, que contiene el prompt de la viñeta seleccionada. Más abajo están la sección de imagen de referencia (igual que en la pestaña {{ui:app.tabs.generate}}, y se usa para todas las viñetas del cómic) y los ajustes detallados de generación. Haga clic en el encabezado de un ajuste para abrir o cerrar su sección.
- Centro: la {{ui:app.views.comic}}. La fila de herramientas que hay encima contiene los ajustes de página, las plantillas, la herramienta para cortar viñetas, las herramientas de viñeta (globos y textos narrativos, pose, plantillas de viñeta), las herramientas de imagen, el botón de la papelera que elimina lo seleccionado y el botón que convierte la página en una imagen. Debajo de la página están deshacer y rehacer, un pequeño dibujo de cada página y el zoom.
- Derecha: dos pestañas, **{{ui:comic.side.assistant}}** y **{{ui:comic.side.gallery}}**. Las imágenes dibujadas en las viñetas también entran en la galería.

## Crear un cómic

![La lista de cómics, arriba a la izquierda. Una miniatura de la página 1, con el nombre del cómic y su número de páginas](shot:comic-project)

1. Abra la lista de cómics, arriba a la izquierda, pulse **{{ui:comic.project.new}}** al final del todo y póngale un nombre. Cuando aún no hay ningún cómic, también puede crear uno con **{{ui:comic.project.new}}** en el centro.
2. Una página nueva empieza con 3 viñetas. Para añadir una página, pulse **{{ui:comic.page.add}}** debajo de la página.
3. Haga clic en la página sobre la viñeta que quiere dibujar para seleccionarla. A la izquierda, en la sección **{{ui:params.prompt.title}}**, escriba una descripción de su imagen y pulse **{{ui:comic.panel.draw}}**.
4. Para dibujar en orden todas las viñetas de la página, pulse la flecha junto al botón de dibujar, elija **{{ui:comic.page.drawAll}}** y pulse el botón de dibujar. Se dibujan en orden las viñetas que tienen prompt.
5. Para dibujar todas las páginas del cómic, elija **{{ui:comic.comic.drawAll}}** en el mismo menú y pulse el botón de dibujar. Las viñetas de todas las páginas que tienen prompt se ponen en cola en orden de lectura.

La lista de cómics muestra una miniatura de la página 1 de cada cómic y su número de páginas. Seleccione un cómic de la lista para abrirlo. Para renombrar o eliminar un cómic, use el menú a la derecha de su fila.

Para crear una imagen hay que haber elegido un modelo. No se puede dibujar una viñeta con el prompt vacío. Los prompts funcionan mejor si se escriben como etiquetas en inglés. Una imagen dibujada entra en su viñeta y también en la galería. Una viñeta que no se pudo dibujar muestra **{{ui:comic.draw.failed}}** en la página.

## Prompts de las viñetas

En la pestaña de cómic, la sección **{{ui:params.prompt.title}}** de la izquierda contiene el prompt de la viñeta seleccionada. Al seleccionar otra viñeta, el texto de los campos cambia al de esa viñeta. Cada viñeta tiene su propio par de prompts **{{ui:params.prompt.positive}}** y **{{ui:params.prompt.negative}}**. Cuando no hay ninguna viñeta seleccionada, los campos conservan los prompts de la última viñeta seleccionada (o de la primera viñeta de la página, cuando aún no se ha seleccionado ninguna), y el botón de dibujar dibuja esa viñeta.

Los campos funcionan igual que en la pestaña {{ui:app.tabs.generate}}. Al cargar un {{ui:presets.label}}, los prompts del ajuste predefinido pasan a la viñeta seleccionada. Las palabras del **{{ui:params.promptBook.title}}** también pasan a la viñeta seleccionada. Al volver a la pestaña {{ui:app.tabs.generate}}, los prompts que había escrito en la pestaña {{ui:app.tabs.generate}} vuelven tal como estaban.

La imagen de una viñeta se dibuja solo con los prompts de esa viñeta. No se añaden los prompts de otras viñetas ni los de la pestaña {{ui:app.tabs.generate}}.

La sintaxis de prompts dinámicos (corchetes de combinación y comodines) también funciona. Con **{{ui:params.prompt.modeRandom}}**, la semilla de la imagen elige la combinación y se dibuja una imagen. Con **{{ui:params.prompt.modeCombinatorial}}**, las combinaciones se dibujan una a una. La primera combinación va a la viñeta, y las imágenes de las demás combinaciones van solo a la galería (no a la viñeta). Cuando hay varias combinaciones, un aviso lo indica.

## Ajustes de página

Pulse **{{ui:comic.page.settings}}** en la parte superior del centro para abrir los ajustes de página.

El número de viñetas de una página se fija de 1 a 24 en el campo **{{ui:comic.page.panelCount}}**. Al cambiar el número, la disposición de la página se rehace automáticamente. Una página cuyas formas de viñeta se cambiaron a mano también vuelve a la disposición automática cuando cambia el número.

El número de columnas de una página se puede elegir de 1 a 3 con **{{ui:comic.page.columns}}**. Con **{{ui:comic.page.direction}}** se elige el sentido en que se leen las viñetas. El manga normalmente se lee de derecha a izquierda, así que una página nueva empieza en el sentido «De derecha a izquierda (manga)». Al cambiar el sentido, el orden de las viñetas se invierte de izquierda a derecha.

Al reducir el número de viñetas, se quitan las últimas. Las imágenes de las viñetas quitadas se quedan en la galería.

**{{ui:comic.effect.comic}}** y **{{ui:comic.effect.page}}** ponen un efecto de acabado sobre toda la página: **{{ui:comic.effect.mono}}**, **{{ui:comic.effect.ebook}}** (en grises, con el tono del papel) o **{{ui:comic.effect.sepia}}**. No hace falta pedir blanco y negro al dibujar; el mismo efecto se puede poner después sobre todas las páginas, y a una página se le puede dar uno distinto. Las imágenes en sí no cambian; el efecto se aplica a cómo se muestra la página y a la imagen guardada, el PDF, el CBZ y el PSD.

El tamaño del papel se puede elegir entre A4, A5, B4 y B5 con **{{ui:comic.page.size}}**. La proporción entre ancho y alto de la página es la misma que la del papel. La imagen de página que se guarda es el papel dibujado a 200 dpi (A4 son unos 1654 × 2339 px).

**{{ui:comic.page.frameWidth}}** fija el grosor de las líneas del marco de las viñetas, de 0 mm a 3 mm (0,6 mm al principio). **{{ui:comic.page.inset}}** fija el espacio entre una línea del marco y la imagen, de 0 mm a 10 mm (0 mm al principio, así que la imagen queda justo contra la línea). **{{ui:comic.page.margin}}** añade un margen blanco fuera de la línea del marco, de 0 mm a 10 mm (0 mm al principio, así que no se dibuja borde blanco). **{{ui:comic.page.frameColor}}** elige el color de las líneas del marco (negro al principio). Todos se aplican a cada viñeta de la página, y la imagen de página que se guarda se dibuja con el mismo grosor, espacio y color.

## Cambiar de página y hacer zoom

En el centro, debajo de la página, se alinea un pequeño dibujo de cada página. Cada dibujo muestra las viñetas y las imágenes de su página, con el número de página en su parte inferior derecha. Pulse un dibujo para pasar a esa página. El dibujo de la página que está abierta ahora aparece enmarcado. En un cómic que se lee de derecha a izquierda (su primera página se lee desde la derecha), la página 1 está en el extremo derecho, como en un manga impreso, y las páginas posteriores quedan más a la izquierda (la flecha izquierda sigue hacia las páginas posteriores). Se muestran a la vez tantas páginas como caben (diez como máximo). Para las páginas que no caben, pulse las flechas izquierda y derecha (**{{ui:comic.page.prevGroup}}** y **{{ui:comic.page.nextGroup}}**) para mostrar los dibujos de las páginas anteriores o posteriores. Mostrar otros dibujos con las flechas no cambia la página abierta. **{{ui:comic.page.add}}** añade una página, y el botón de la papelera elimina la página que está abierta ahora (púlselo de nuevo para confirmar).

El tamaño de visualización de la página se puede cambiar con los botones **{{ui:common.zoomIn}}** y **{{ui:common.zoomOut}}** de la parte inferior derecha de la página. También se puede acercar y alejar alrededor del puntero girando la rueda del ratón con Ctrl pulsada. Pulse el porcentaje de zoom para volver al 100 %.

## Plantillas

![La lista de plantillas de página. Las disposiciones se muestran como pequeñas imágenes](shot:comic-templates)

Pulse **{{ui:comic.template.pageTitle}}** en la parte superior del centro para abrir la lista de plantillas de página. Cada plantilla se muestra como una pequeña imagen de su disposición. Pulse una imagen para aplicar esa plantilla a la página que está abierta ahora.

La lista muestra las disposiciones incorporadas ({{ui:comic.template.builtin.single}}, {{ui:comic.template.builtin.strip}}, {{ui:comic.template.builtin.four}}, {{ui:comic.template.builtin.six}} y {{ui:comic.template.builtin.nine}}, cinco en total), las plantillas de forma (diez en total, con cortes en diagonal y combinaciones de viñetas grandes y pequeñas) y las plantillas que guardó. Una disposición incorporada se aplica con el sentido de lectura y el tamaño de papel de esta página. Una plantilla de forma se aplica con el sentido de lectura de esta página, por lo que sus viñetas se voltean para coincidir con él. Una plantilla guardada toma el sentido de lectura y el tamaño de papel que tenía al guardarse. Cuando el número de viñetas baja, la etiqueta bajo la imagen cambia a **{{ui:comic.template.applyAgain}}**. Púlsela de nuevo para aplicarla, y se quitan las imágenes y los globos de las últimas viñetas.

Para guardar la disposición de esta página, introduzca un nombre debajo de la lista y pulse **{{ui:comic.template.savePage}}**. Si el nombre se deja vacío, la plantilla se llama «Plantilla» seguido de un número. Las plantillas se guardan dentro de este proyecto.

Una plantilla de viñeta guarda el prompt, el prompt negativo, la pose y los globos de la viñeta seleccionada. No guarda la imagen. En la sección que se abre al pulsar **{{ui:comic.template.panelTitle}}** en la parte superior central, póngale un nombre y pulse **{{ui:comic.template.save}}**. En otra viñeta, pulse **{{ui:comic.template.apply}}** en la fila de la plantilla guardada, y se pone en esa viñeta. Lo que entra es el prompt, el prompt negativo, la pose y los globos. La imagen de esa viñeta se queda.

## Cambiar la forma de las viñetas

![Una página con viñetas remodeladas: la viñeta superior está cortada en diagonal, y las esquinas de la viñeta seleccionada se muestran como puntos](shot:comic-shapes)

Las formas de las viñetas se pueden cambiar a mano, incluso cuando la página tiene la disposición automática. Pulse **{{ui:comic.shape.cut}}** en la parte superior del centro y luego trace una línea a través de una viñeta de un borde a otro, y la viñeta se corta en dos. Una línea que no corta la viñeta en dos (una línea fuera de la viñeta, o una que solo toca una esquina) no corta nada.

Para añadir una viñeta, pulse **{{ui:comic.shape.addPanel}}** junto a **{{ui:comic.shape.cut}}**. Las viñetas que ya hay se quedan como están, y la viñeta nueva se coloca sobre el centro de la página y queda seleccionada. La página pasa entonces a ser una donde las viñetas se colocan libremente (véase «Colocar las viñetas libremente» más abajo). No se pueden añadir viñetas cuando la página ya tiene 24.

Para quitar una viñeta, selecciónela y pulse el botón de la papelera de la parte superior del centro (**{{ui:comic.shape.removePanel}}**), o pulse la tecla Supr. Su imagen, sus prompts y sus globos se van con ella. En una disposición automática, las viñetas restantes se disponen de nuevo. En una página cuyas formas de viñeta se cambiaron a mano, la viñeta vecina más cercana crece hacia el espacio liberado y conserva su propio contenido; si la forma no permite esa unión, la página vuelve a la disposición automática. No se puede eliminar la última viñeta de una página. Una viñeta eliminada se puede recuperar con Ctrl+Z (volver a poner una imagen en una viñeta no se deshace).

Para deseleccionar la viñeta, haga clic en el margen de la página, en cualquier lugar vacío alrededor de la página o en una parte vacía de la fila de herramientas. La tecla Esc también la deselecciona. En una página con una imagen sobre toda la página, hacer clic en la página fuera de las viñetas selecciona esa imagen en su lugar (véase «Poner una imagen sobre toda la página»).

La viñeta seleccionada muestra sus esquinas como puntos redondos. Arrastre una esquina para cambiar la forma de la viñeta. Una esquina compartida con una viñeta vecina se mueve con ella. Haga doble clic en un borde para añadir una esquina, y doble clic en una esquina recta para quitarla. Una esquina no se mueve a un lugar donde las viñetas se superpondrían o donde un borde cruzaría otro borde.

La viñeta seleccionada muestra una pequeña barra (un tirador de borde) en el centro de cada borde. Arrastre un tirador para mover ese borde entero; las viñetas vecinas cambian de forma con él. Un borde no se mueve fuera del margen de la página.

En una página cuyas formas se cambiaron a mano, pulse **{{ui:comic.shape.reset}}** en **{{ui:comic.page.settings}}** para volver a la disposición automática. Cambiar el número de viñetas o el número de columnas también vuelve a la disposición automática. Ctrl+Z deshace un cambio de forma.

## Colocar las viñetas libremente

En cualquier página, arrastre una viñeta a cualquier lugar de ella para moverla donde quiera (sea cual sea su forma, se mueve desde donde pulsa). Pulsar una viñeta sin moverla solo la selecciona. Una vez movida una viñeta, la página pasa a ser una donde las viñetas se colocan libremente. Cada viñeta tiene entonces una forma propia y no comparte ningún borde con su vecina. Las viñetas pueden superponerse o dejar huecos. El aspecto que tenía la página antes (los lugares de las viñetas y los huecos blancos entre ellas) se queda como estaba.

Una viñeta puede salirse en parte de la página; lo que queda fuera se recorta, pero el centro de la viñeta se queda en la página. Sobre una viñeta el cursor es el de mover, sobre una esquina una cruz y sobre un borde una flecha que coincide con el sentido en que se desliza el borde. Arrastrar dentro de una viñeta siempre mueve la viñeta. Para mover solo su imagen, arrastre con la tecla Alt pulsada, o haga doble clic en la imagen para seleccionarla y arrastre la parte que sobresale de la viñeta. Arrastre el tirador redondo sobre la viñeta seleccionada (**{{ui:comic.free.rotate}}**) y la viñeta gira a cualquier ángulo; con la tecla Mayús pulsada, gira en pasos de 15 grados. En una página con viñetas colocadas libremente, las esquinas y los bordes de una viñeta mueven solo esa viñeta. Al añadir una viñeta se pone una rectangular en el centro de la página. Al eliminar una viñeta, ninguna vecina crece hacia su espacio. **{{ui:comic.shape.cut}}** también funciona, y las viñetas que rodean a la cortada se quedan como están.

Lo que gira es el marco de la viñeta: la imagen se queda derecha y el marco la recorta. El ángulo de la imagen se puede cambiar por separado con las herramientas de imagen. Para devolver la página a la disposición automática, pulse **{{ui:comic.shape.reset}}** en **{{ui:comic.page.settings}}** (deshacer recupera la página libre).

Cuando las viñetas se superponen, una viñeta posterior queda delante. Seleccione una viñeta y pulse **{{ui:comic.order.front}}**, **{{ui:comic.order.forward}}**, **{{ui:comic.order.backward}}** o **{{ui:comic.order.back}}** para cambiar el orden en que se apilan. El orden es también el de los números de las viñetas (el orden de lectura), así que cambiarlo las renumera.

Después de girar, redimensionar o mover una viñeta o su imagen, pulse **{{ui:comic.reset.title}}** en la parte superior del centro para devolverla a su estado. Se puede devolver una cosa cada vez (el giro de la viñeta, la forma y el tamaño de la viñeta, el giro, el tamaño, el lugar o el reflejo de la imagen) o todo con **{{ui:comic.reset.all}}**. Devolver la forma y el tamaño de una viñeta le da la forma que tiene en la disposición automática. Devolver una imagen no es un paso de deshacer.

## La imagen de una viñeta

![Una imagen colocada en una viñeta. Alrededor de la imagen reducida y girada hay tiradores en las cuatro esquinas y en la parte superior](shot:comic-image)

La imagen de una viñeta no tiene por qué ser una que haya dibujado. Arrastre una imagen de la galería sobre una viñeta, y esa imagen pasa a ser la imagen de la viñeta. Seleccione una viñeta y pulse **{{ui:comic.panel.imageUpload}}** en la parte superior del centro para elegir un archivo de imagen de su ordenador. El archivo entra primero en la galería y luego pasa a ser la imagen de la viñeta.

La imagen de una viñeta se mueve directamente sobre la página, como en el {{ui:app.tabs.canvas}}.

- Pulsar y arrastrar la imagen mueve la viñeta entera. Para mover solo la imagen, arrástrela con la tecla Alt pulsada. Una parte de la imagen también puede salirse de la viñeta.
- Haga doble clic en la imagen, o púlsela con la tecla Alt pulsada, para seleccionarla; alrededor aparecen un marco de puntos y tiradores. La parte que sobresale de la viñeta también se muestra tenuemente.
- Gire la rueda del ratón con la tecla Alt pulsada para ampliar o reducir, alrededor del puntero, la imagen de la viñeta que está bajo el puntero.
- Arrastre un tirador de esquina para ampliar o reducir la imagen alrededor de su centro.
- Arrastre el tirador redondo de arriba para girar la imagen. Mantenga pulsada Mayús mientras gira para girarla en pasos de 15°.
- La imagen seleccionada se mueve un poco con las teclas de flecha (mantenga pulsada Mayús para moverla más).
- Si una imagen se ha movido fuera de su viñeta, arrastre el marco de puntos de la imagen seleccionada para moverla.

Las herramientas de la parte superior del centro también cambian la imagen. **{{ui:comic.image.fitCover}}** quita cualquier giro y extiende la imagen por toda la viñeta. **{{ui:comic.image.fitContain}}** ajusta el tamaño de la imagen para que quepa entera en la viñeta. **{{ui:comic.image.rotateLeft}}** y **{{ui:comic.image.rotateRight}}** la giran 90°, y **{{ui:comic.image.flipX}}** y **{{ui:comic.image.flipY}}** la voltean. **{{ui:comic.image.scaleDown}}** y **{{ui:comic.image.scaleUp}}** la reducen y la amplían un poco cada vez, y **{{ui:comic.image.center}}** lleva el centro de la imagen al centro de la viñeta.

Para quitar la imagen de una viñeta, seleccione la imagen y pulse la tecla Supr, o pulse el botón de la papelera de la parte superior del centro (**{{ui:comic.panel.imageClear}}** mientras hay una imagen seleccionada). Hay un solo botón de papelera, y elimina lo que está seleccionado (un globo, una imagen, la imagen sobre toda la página o una viñeta). Mantenga el puntero sobre el botón para ver qué elimina. Aunque la quite, la imagen se queda en la galería. Pulse **{{ui:comic.history.undo}}** en el aviso que aparece justo después de quitarla, y la imagen vuelve con su posición y tamaño. Cuando pone una imagen distinta, la posición y el tamaño vuelven a sus valores predeterminados.

Una viñeta conserva sus imágenes anteriores. Cuando vuelve a dibujar una viñeta, pone otra imagen o quita su imagen, la imagen que tenía pasa a las **{{ui:comic.takes.title}}** de la viñeta (hasta 12, las más nuevas primero). Seleccione la viñeta y pulse **{{ui:comic.takes.title}}** en la parte superior del centro: aparecen la imagen que tiene ahora la viñeta y las anteriores. Pulse una imagen anterior para volver a ponerla en la viñeta con la posición y el tamaño que tenía (la imagen que está ahora pasa al historial). **{{ui:comic.takes.remove}}** quita una imagen de la lista; se queda en la galería. Una imagen que eliminó de la galería no se muestra. Deshacer no cambia el historial, igual que no cambia las imágenes.

También puede volver a dibujar solo una parte de una imagen (cuando una mano o una cara salió mal, por ejemplo). Seleccione una viñeta con una imagen y pulse **{{ui:comic.fix.start}}** (el botón del pincel) en la parte superior del centro: aparece una barra fina sobre la página. Pinte sobre la parte que quiere redibujar en la viñeta. En la barra puede cambiar el **{{ui:comic.fix.brush}}**, y deshacer el exceso de pintura con **{{ui:comic.fix.undoStroke}}** o **{{ui:comic.fix.clear}}**. En **{{ui:comic.fix.words}}**, escriba en inglés qué dibujar allí (si se deja vacío, se usa el prompt de la viñeta). Cuanto más bajo es **{{ui:comic.fix.strength}}**, más se parece la parte a la imagen original. Pulse **{{ui:comic.fix.go}}**: solo se vuelve a dibujar la parte pintada, y el resto de la imagen se queda como estaba. La imagen nueva entra en la viñeta, y la anterior se queda en las **{{ui:comic.takes.title}}**. Las palabras de los personajes y las imágenes de referencia se usan como cuando se dibuja la viñeta. Al seleccionar otra viñeta se borra lo que pintó.

## Poner una imagen sobre toda la página

Pulse **{{ui:comic.backdrop.title}}** en la parte superior del centro para poner una imagen sobre toda la página. Sirve para una imagen grande que ocupa la página, o para una página de fotos e imágenes sobre las que se colocan las viñetas. Una imagen de la galería o un archivo de imagen también se puede soltar en la página fuera de las viñetas (sobre una viñeta, suéltelo con la tecla Alt pulsada). O suéltelo en esa sección, o elija un archivo con **{{ui:comic.panel.imageUpload}}**. La imagen va detrás de las viñetas, en el fondo de la página, y lo que queda fuera de la página se recorta. Una viñeta sin imagen propia deja ver la imagen a través de ella. Los marcos y los globos se dibujan encima.

Pulse **{{ui:comic.backdrop.edit}}** y el marco de la imagen se muestra sobre la página. Arrastre en cualquier parte de la imagen para moverla, arrastre un círculo de esquina para cambiar su tamaño y arrastre el círculo de encima para girarla a cualquier ángulo (con la tecla Mayús pulsada, en pasos de 15 grados). Mientras tanto no se puede trabajar con las viñetas; pulse la tecla Esc o seleccione una viñeta para terminar. Los botones de la misma sección también ajustan la imagen a la página, la muestran entera, la amplían y la reducen, la devuelven al centro, la giran 90 grados, la reflejan de izquierda a derecha o de arriba abajo, y la quitan. La tecla Supr también la quita, y **{{ui:comic.history.undo}}** en el aviso que sigue la vuelve a poner. Tanto la imagen de la página como el archivo de todas las páginas la incluyen.

La imagen también se puede manejar en la página. Haga clic en la página fuera de las viñetas (un hueco entre viñetas, o el margen de la página), y la imagen se selecciona y se muestra su marco. Mientras está seleccionada, pulse la tecla Supr o el botón de la papelera de la parte superior del centro (**{{ui:comic.backdrop.clear}}**) para quitarla. Soltar una imagen de la galería o un archivo en la página mientras está seleccionada la reemplaza. Gire la rueda del ratón con la tecla Alt pulsada fuera de las viñetas para ampliarla o reducirla alrededor del puntero.

## Configurar la pose

![La pantalla de la figura de palos para configurar la pose de una viñeta](shot:comic-pose)

Seleccione una viñeta, pulse el botón de pose de la parte superior central para abrir su sección y luego pulse **{{ui:comic.panel.pose}}** para abrir una pantalla donde se configura la pose con una figura de palos. La pose se dibuja con la forma de esa viñeta, y al pulsar **{{ui:comic.pose.use}}** pasa a ser la pose de esa viñeta. Se puede volver a abrir la pose para corregirla. La pose configurada en esta pantalla es para una persona. Para quitarla, pulse **{{ui:comic.panel.poseRemove}}**.

![El campo de pose predefinida de una viñeta. Elija una categoría y una pose](shot:comic-presets)

En la misma sección, una pose también se puede tomar de las mismas poses ya preparadas que el lienzo. Elija una categoría con **{{ui:comic.panel.poseCategory}}**, elija una pose con **{{ui:comic.panel.posePreset}}** y pulse **{{ui:comic.panel.poseApply}}**. Se crea una imagen de figura de palos adaptada al tamaño de la viñeta y pasa a ser la pose de esa viñeta. Según la composición, varias personas pueden estar una al lado de otra. En ese caso, todas caben en la viñeta.

Para que la pose se refleje en la imagen, debe estar instalado un modelo ControlNet de poses (OpenPose, o un modelo union). A un modelo union se le indica que la imagen es una pose. Si no está instalado, la pose no se usa en la imagen, y aparece una advertencia en ese sentido.

## Disponer una viñeta en 3D

Seleccione una viñeta y pulse **{{ui:comic.rough.open}}** en el cuadro de pose: se abre una vista 3D con la forma de la viñeta. Allí coloca personas como maniquíes de cilindros y cajas, y el decorado como cajas, tableros, cilindros y un suelo. También fija la dirección, la distancia y el ángulo de visión de la cámara.

- Arrastre el fondo para girar la cámara; arrastre con Mayús (o con el botón derecho) para deslizarla; use la rueda para acercarse o alejarse.
- Añada cosas con **{{ui:comic.rough.kind.person}}**, **{{ui:comic.rough.kind.box}}**, **{{ui:comic.rough.kind.plane}}** y **{{ui:comic.rough.kind.cylinder}}** a la derecha. Un tablero va al fondo, los demás al lado. Arrastre una persona o un objeto para moverlo por el suelo.
- Cambie a la derecha el giro de lo elegido, su altura sobre el suelo y su tamaño (ancho, alto y profundidad; para una persona, el tamaño donde un adulto es 100). **{{ui:comic.rough.remove}}** lo quita.
- Arrastre un punto de color de la persona elegida para doblar esa extremidad. Arrastrar el cuello mueve a toda la persona.
- Las pequeñas imágenes de abajo a la derecha son la pose y la profundidad que recibirá el ControlNet.

Pulse **{{ui:comic.rough.apply}}** para crear dos imágenes del tamaño de la viñeta y ponerlas en la viñeta. Una es la pose tal como la ve la cámara, sin las articulaciones que algo oculta, como la cara de una persona vista de espaldas o las piernas detrás de una mesa. La otra es una imagen de profundidad, donde lo más cercano es más claro. Cuando se dibuja la viñeta, la imagen de profundidad va al ControlNet junto con la pose, de modo que las personas y el decorado salen cerca de donde los tiene el boceto. La profundidad se aplica con suavidad, solo durante la primera mitad de los pasos: más fuerte, los maniquíes y las cajas se dibujarían tal cual.

La imagen de profundidad necesita un modelo ControlNet de profundidad (depth, o un modelo union). Si no hay ninguno instalado, la profundidad no se usa en la imagen, y aparece una advertencia en ese sentido.

Si cambia la pose después con el editor de poses, una pose ya preparada o el agente, la imagen de profundidad se descarta, porque muestra a las personas donde estaban. El boceto en sí se queda en la viñeta. Al abrirlo de nuevo, conserva su cámara y sus objetos y parte de las personas de la pose tal como está ahora. Pulse **{{ui:comic.rough.apply}}** para volver a crear la imagen de profundidad.

Cuando la forma de la viñeta cambia, porque cambió el corte o el tamaño de la página, la imagen de profundidad tampoco se usa, y una advertencia lo indica: hecha para la forma antigua, se estiraría y movería a las personas y el decorado. Abra el boceto y pulse **{{ui:comic.rough.apply}}** para crearla para la forma que tiene ahora la viñeta.

## Mantener los personajes iguales

Dibujar cada viñeta por separado hace que la cara y la ropa de un personaje varíen de una viñeta a otra. Para evitarlo, escriba el reparto. Seleccione una viñeta, pulse el botón **{{ui:comic.cast.title}}** en las herramientas de viñeta de la parte superior central y pulse **{{ui:comic.cast.add}}**. Los personajes se listan arriba, y el que cuyo nombre pulsa se muestra debajo, uno cada vez. Dé un nombre al personaje y escriba su aspecto como etiquetas en inglés en el campo de abajo: el tipo y el número, la edad, el pelo, los ojos y la ropa con sus colores (por ejemplo `1boy, old man, short white hair, flat cap, beige cardigan, blue shirt`). Los campos crecen con sus palabras, así que se pueden leer enteros. Marque la casilla junto al nombre de cada personaje que está en la viñeta seleccionada. Cuando se dibuja esa viñeta, sus etiquetas se ponen delante de su prompt tal como están escritas, así que el prompt solo necesita decir lo que cambia: el plano, el lugar y la acción. Un personaje sin marca en una viñeta no se añade a ella. Quitar un personaje lo saca de todas las viñetas.

Las palabras por sí solas mantienen el pelo y la ropa, pero no la cara. Por eso un personaje también puede tener una imagen de referencia. Pulse **{{ui:comic.cast.refUse}}** para tomar la imagen de la viñeta seleccionada como referencia, o **{{ui:comic.cast.refClear}}** para soltarla. Si las viñetas la usan mediante IP-Adapter lo fija **{{ui:comic.draw.castReference.use}}** en **{{ui:comic.draw.settings}}**, y está desactivado por defecto: IP-Adapter tiende a apagar el estilo y a trasladar a las viñetas el fondo blanco y la postura de la imagen de referencia. Cuando está activado, la referencia se usa con suavidad, solo durante la primera parte del dibujo, y la escala CFG no se reduce (debe estar instalado un modelo IP-Adapter). Cuando está activado y dibuja la página entera o el cómic entero, un personaje sin imagen de referencia se dibuja primero solo, a partir de sus palabras, sobre un fondo liso, y esa imagen pasa a ser la referencia. Cuando el modelo de la pestaña Generar es un modelo FLUX.2, las imágenes de referencia van al propio modelo diga lo que diga este ajuste, en lugar de mediante IP-Adapter (hasta 4 por viñeta); entonces no hace falta ningún modelo IP-Adapter.

Cuando una viñeta con una pose tiene dos o más personajes, elija en el reparto qué persona de la pose es cada uno («{{ui:comic.cast.posePerson}}»). Las palabras y la imagen de referencia del personaje actúan entonces solo alrededor de esa persona, de modo que las caras y la ropa no pasan a la otra (con modelos SD 1.5 y SDXL). Cuando las personas son tantas como los personajes humanos, se toman en orden sin elegir. Un monstruo o un animal sin pose se dibuja en el resto de la viñeta.

Además del cuadro de etiquetas, el aspecto se puede dividir en pelo, ojos, marcas de la cara, ropa, complexión y accesorios. Entonces una viñeta recibe solo las partes que su imagen muestra: un prompt con primer plano añade pelo, ojos, cara y accesorios, torso añade la ropa, y de espaldas deja fuera los ojos y la cara. Un prompt que no dice nada se toma como que muestra a la persona entera, así que se añaden todas las partes. Marque «{{ui:comic.cast.nonHuman}}» para un monstruo o un animal: todas sus partes se añaden siempre, y su imagen de referencia se dibuja sin ninguna persona.

Si el personaje está vinculado a un personaje de la biblioteca de personajes que tiene un LoRA (un vínculo hecho por una versión anterior), las viñetas en las que este personaje está solo se dibujan con el LoRA y su palabra activadora. Una viñeta con dos o más personajes que tienen LoRA no usa ninguno, porque sus aspectos se mezclarían. Tampoco se usa un LoRA cuando es de un tipo distinto al del modelo de la pestaña Generar (como SDXL y SD 1.5), o cuando el LoRA del personaje está desactivado.

El agente escribe el reparto por usted cuando crea un cómic. El reparto mantiene las palabras iguales; no puede hacer una cara idéntica, así que puede quedar una pequeña diferencia entre viñetas.

## Mantener los lugares iguales

Dibujada viñeta a viñeta, una escena en una sala recibe un fondo distinto en cada viñeta. Para evitarlo, registre lugares. Seleccione una viñeta, pulse **{{ui:comic.place.title}}** en las herramientas de viñeta de la parte superior central y pulse **{{ui:comic.place.add}}**. El lugar nuevo pasa a ser el lugar de la viñeta seleccionada. Póngale un nombre y en **{{ui:comic.place.tags}}** escriba, como etiquetas en inglés, qué es el lugar, las cosas que contiene, sus colores y su luz (por ejemplo `classroom, wooden desks, green chalkboard, large windows, afternoon sunlight`). Para las demás viñetas, elija el lugar en la lista **{{ui:comic.place.inPanel}}**. Cuando se dibuja una viñeta, las palabras de su lugar se añaden después de su prompt tal como están escritas, de modo que las viñetas ambientadas allí se dibujan con el mismo fondo. Cambiar las palabras cambia todas las viñetas ambientadas allí. Registre un lugar visto de día y de noche como dos lugares.

Cuando el agente crea un cómic, también registra los lugares y elige un lugar para cada viñeta.

## Preguntar al agente

En la pestaña **{{ui:comic.side.assistant}}** de la columna derecha puede preguntar al agente sobre el cómic abierto. Lee y escribe los personajes y lugares del cómic, las disposiciones de página, el prompt y la pose de cada viñeta, y los globos. Hace solo lo que usted pide, y dibuja imágenes solo cuando se las pide.

Cuando le pide que mire una página dibujada y la corrija, el agente mira la imagen de esa página. La imagen se envía a la IA que ha elegido, así que antes aparece la misma confirmación que para leer imágenes ([El agente, los ajustes y los atajos](09-assistant-settings.md)). Si no lo permite, el agente no mira esa página.

## Indicaciones de escena

Cada viñeta puede contener una nota de su escena con palabras: como la acotación de un guion, escriba el lugar, el momento y quién hace qué. Seleccione la viñeta, pulse el botón de nota (**{{ui:comic.panel.note}}**) en la parte superior del centro para abrir la sección y escríbala allí. Una viñeta que aún no tiene imagen muestra su indicación de escena en letra cursiva (una viñeta sin ella muestra su prompt). Las indicaciones de escena no se usan para crear la imagen. El agente también puede escribirlas por usted (véase [El agente, los ajustes y los atajos](09-assistant-settings.md)).

## Globos y textos narrativos

![La sección de globos y textos narrativos. Los tipos de globo se muestran como pequeñas imágenes de su aspecto](shot:comic-balloon-list)

Seleccione una viñeta y pulse **{{ui:comic.panel.bubbles}}** en la parte superior central para abrir la sección: los tipos de globo se muestran como pequeñas imágenes del aspecto de cada uno. Pulse una imagen para añadir a la viñeta un globo de ese tipo, y **{{ui:comic.bubble.editor}}** se abre superpuesto al tablero de la derecha. Debajo, la sección lista los globos de la viñeta por tipo y texto. Pulse una fila para seleccionar ese globo, y pulse el botón del lápiz (**{{ui:comic.bubble.edit}}**) para abrir **{{ui:comic.bubble.editor}}**.

- {{ui:comic.bubble.kind.speech}}, {{ui:comic.bubble.kind.rounded}}, {{ui:comic.bubble.kind.box}}: una elipse, una caja con esquinas redondeadas y una caja cuadrada, a las que se puede añadir una cola.
- {{ui:comic.bubble.kind.thought}}: una nube, seguida de pequeños círculos en lugar de una cola.
- {{ui:comic.bubble.preset.whisper}}: una elipse dibujada con línea discontinua, para voces bajas y susurros.
- {{ui:comic.bubble.kind.shout}}, {{ui:comic.bubble.kind.explosion}}: globos con el borde puntiagudo. {{ui:comic.bubble.kind.explosion}} tiene puntas grandes e irregulares.
- {{ui:comic.bubble.kind.wavy}}, {{ui:comic.bubble.kind.fuzzy}}: un borde ondulado y un borde de pelillos finos, para una voz débil o una sensación de inquietud.
- {{ui:comic.bubble.kind.electric}}: una caja de muchas esquinas cuya cola es un rayo, para un teléfono, un altavoz o una máquina.
- {{ui:comic.bubble.kind.icicle}}: un globo con carámbanos colgando, para una voz fría.
- {{ui:comic.bubble.kind.heart}}: un globo en forma de corazón.
- {{ui:comic.bubble.kind.flash}}: líneas negras convergen sobre las palabras desde todos lados, para una impresión fuerte o un grito interior.
- {{ui:comic.bubble.preset.dark}}, {{ui:comic.bubble.preset.double}}: un globo relleno de negro (con letras blancas) y un globo dibujado con línea doble.
- {{ui:comic.bubble.kind.caption}}: una caja de esquinas cuadradas y sin cola.
- {{ui:comic.bubble.kind.sfx}}: rotulado para un efecto de sonido como «BOOM». No tiene globo: letras negras gruesas con un borde blanco, que empiezan con un tamaño mayor. **{{ui:comic.bubble.rotation}}** en **{{ui:comic.bubble.editor}}** inclina las letras (de -90 a 90 grados).
- {{ui:comic.bubble.kind.stamp}}: un efecto de sonido pegado como imagen en lugar de rotulado. Hay tres estilos de trazo (angular, pincel afilado, pincel seco) con 38 palabras cada uno, como «DON», «ZAWA» y «GOGOGOGO», 114 imágenes en total. La lista de **{{ui:comic.bubble.editor}}** se puede buscar por palabra, lectura o uso (por ejemplo «don», «zawa» o «tensión») y acotar por estilo de trazo. Su tamaño, inclinación y lugar cambian igual que en el efecto de sonido rotulado, y pasa a la página guardada y al PSD como imagen. Las imágenes son de uso libre, también comercial (CC0).
- {{ui:comic.bubble.kind.plain}}: letras de grosor normal sin globo, con un fino borde blanco para que se lean sobre una imagen. También se pueden inclinar.

La línea de un globo ondula un poco, como si estuviera dibujada a mano. Cada globo tiene su propia ondulación, que se mantiene igual cuando lo mueve o cambia su texto.

![Un globo con texto vertical, y el tirador redondo en la punta de su cola](shot:comic-tail)

Un globo que añade se coloca en el centro de su viñeta. Arrastre un globo en la página para colocarlo. Incluso mientras la imagen de la viñeta está seleccionada, pulsar un globo mueve solo el globo, no la viñeta ni la imagen. Al seleccionar un globo, queda enmarcado por una línea azul discontinua y los tiradores de su viñeta se ocultan. También aparece un tirador redondo en la punta de su cola. Arrastrar el tirador cambia la dirección y la longitud de la cola. Para añadir o quitar una cola, pulse **{{ui:comic.bubble.tail}}** en **{{ui:comic.bubble.editor}}**.

![Un globo recién añadido, con la edición del globo superpuesta al tablero de la derecha](shot:comic-balloon)

Hacer doble clic en un globo de la página también abre **{{ui:comic.bubble.editor}}**. Se abre superpuesto al tablero de la derecha de la pantalla, para no tapar la página (cuando el panel derecho está cerrado o es estrecho, se abre en el borde derecho de la página). Aquí puede cambiar **{{ui:comic.bubble.kindLabel}}**, el texto, **{{ui:comic.bubble.font}}**, **{{ui:comic.bubble.size}}**, **{{ui:comic.bubble.vertical}}** y **{{ui:comic.bubble.tail}}**. La lista de tipos también muestra cada forma como una pequeña imagen. Cambiar el tipo conserva el texto y el lugar. Para cerrarlo, pulse la × de arriba a la derecha o la tecla Esc. El globo sigue seleccionado después de cerrarse.

En **{{ui:comic.bubble.look}}** puede cambiar lo siguiente.

- **{{ui:comic.bubble.lineLabel}}**: elija entre {{ui:comic.bubble.line.solid}}, {{ui:comic.bubble.line.dashed}}, {{ui:comic.bubble.line.double}} y {{ui:comic.bubble.line.none}}.
- **{{ui:comic.bubble.dark}}**: rellena el globo de negro y pone las letras en blanco.
- **{{ui:comic.bubble.lineWidth}}**: el grosor de la línea (de 0,3 a 4 veces).
- **{{ui:comic.bubble.rough}}**: cuánto ondula la línea, como si estuviera dibujada a mano. Con 0 la línea es tan recta como si se hubiera trazado con regla.
- **{{ui:comic.bubble.width}}**, **{{ui:comic.bubble.height}}**: el ancho y el alto del globo alrededor de sus palabras (de 0,6 a 3 veces).
- **{{ui:comic.bubble.spikes}}**, **{{ui:comic.bubble.depth}}**: cuántas puntas, bultos de nube, ondas, pelillos, esquinas, carámbanos o líneas hay, y cuánta profundidad tienen. Aparecen solo para los tipos que los tienen.
- **{{ui:comic.bubble.tailWidth}}**, **{{ui:comic.bubble.tailCurve}}**: lo ancha que es la cola donde sale del globo, y cómo se curva. Aparecen solo cuando hay una cola.

![Un globo remodelándose libremente. Puntos cuadrados se alinean en su contorno, y uno se ha estirado para cambiar la forma](shot:comic-balloon-shape)

La forma de un globo se puede cambiar libremente. Pulse **{{ui:comic.bubble.shapeFreely}}** en **{{ui:comic.bubble.outline}}**, y aparecen puntos cuadrados en el contorno del globo. Arrastre un punto para mover el contorno allí. Haga doble clic en un punto para quitarlo (nunca hay menos de 3), y doble clic en el globo para añadir un punto en el contorno más cercano al lugar donde hace clic. Las puntas, los bultos de nube y similares siguen el contorno cambiado. **{{ui:comic.bubble.smooth}}** alterna entre unir los puntos con una curva y con líneas rectas. **{{ui:comic.bubble.shapeReset}}** devuelve la forma propia del tipo. Pulse **{{ui:comic.bubble.shapeFreely}}** de nuevo para ocultar los puntos.

Una parte de las palabras puede ponerse en negrita o con puntos de énfasis (puntos junto a los caracteres, como el japonés destaca palabras). Seleccione palabras en el campo y pulse **{{ui:comic.bubble.bold}}** o **{{ui:comic.bubble.dots}}**; seleccione las mismas palabras y púlselo de nuevo para quitarlo. En el campo, la negrita se muestra como `**palabras**` y los puntos como `《《palabras》》`, y escribirlos directamente hace lo mismo. En la página, los puntos del texto horizontal van sobre los caracteres, y los del texto vertical, a su derecha.

**{{ui:comic.bubble.font}}** ofrece las tipografías de la aplicación y las instaladas en este ordenador, cada nombre mostrado con su propia tipografía. **{{ui:comic.bubble.fontDefault}}** usa **{{ui:settings.comicFont.label}}** de los ajustes (véase [El agente, los ajustes y los atajos](09-assistant-settings.md)). El tamaño del texto se cambia con el control deslizante **{{ui:comic.bubble.size}}**, del 40 % al 400 %. Al pulsar **{{ui:comic.bubble.vertical}}** el texto pasa a vertical, con las líneas corriendo desde la derecha. El texto vertical pasa a la columna siguiente a la altura del globo.

Cuando las palabras se salen de su globo, un anillo rojo discontinuo aparece alrededor del globo. **{{ui:comic.bubble.fitHelp}}** (el botón **{{ui:comic.bubble.fit}}**). Después de reducir, el globo también se mueve para que su forma se quede dentro de la viñeta. Los globos que coloca el agente se ajustan así por sí solos.

Todo lo que ya no necesite se puede eliminar con la papelera de su fila en la sección, o con **{{ui:comic.bubble.remove}}** en **{{ui:comic.bubble.editor}}**. También puede seleccionar un globo en la página y pulsar la tecla Supr o el botón de la papelera de la parte superior del centro.

## Capas

Las capas de la página se muestran siempre como una lista de **{{ui:canvas.layers.title}}** bajo las pestañas de la columna derecha (**{{ui:comic.side.assistant}}** y **{{ui:comic.side.gallery}}**). Son el mismo tipo de capas que en la pestaña {{ui:app.tabs.canvas}}. Cada página tiene dos capas desde el principio: **{{ui:comic.layers.panels}}** (los marcos y las imágenes de las viñetas) y **{{ui:comic.layers.balloons}}** (todos los globos y textos narrativos). Una capa más arriba en la lista se dibuja por delante. El menú de añadir (más) añade una **{{ui:canvas.add.raster}}** o una **{{ui:canvas.add.inpaint}}** propia. Una página contiene hasta 32 capas (incluidas las capas {{ui:comic.layers.panels}} y {{ui:comic.layers.balloons}}), 8 máscaras y 5000 elementos dibujados en una capa. Se le avisa cuando se alcanza un límite.

El botón del ojo de una fila muestra u oculta la capa, y el botón del candado la bloquea. Una capa oculta no se dibuja en la página, ni cuando la página se convierte en imagen. Cuando se elige una fila, puede cambiar su **{{ui:canvas.entity.opacity}}** y su **{{ui:canvas.entity.blend}}** ({{ui:canvas.entity.blend.normal}}, {{ui:canvas.entity.blend.multiply}}, {{ui:canvas.entity.blend.screen}}). Las filas se reordenan arrastrando o desde el menú del clic derecho: una capa debajo de **{{ui:comic.layers.panels}}** queda bajo las imágenes de las viñetas como un dibujo base, y una capa encima de **{{ui:comic.layers.balloons}}** queda sobre los globos. Las capas {{ui:comic.layers.panels}} y {{ui:comic.layers.balloons}} se pueden mover y ocultar, pero no eliminar ni dibujar en ellas. Las máscaras no están en la imagen de la página ni en el PSD.

## Pintar en la página

El interruptor de la parte superior del centro alterna entre **{{ui:comic.paint.page}}** y **{{ui:comic.paint.paint}}**. En el modo de pintura se guardan las herramientas de viñeta y de globo, y se dibuja en la **{{ui:canvas.add.raster}}** elegida con las mismas herramientas que en la pestaña {{ui:app.tabs.canvas}} ({{ui:canvas.tool.brush}}, {{ui:canvas.tool.eraser}}, {{ui:canvas.tool.mosaic}}, {{ui:canvas.tool.rect}}, {{ui:canvas.tool.lasso}}, {{ui:canvas.tool.move}}, {{ui:canvas.tool.bbox}}, {{ui:canvas.tool.colorPicker}}, {{ui:canvas.tool.bucket}}). Elegir una fila de capa raster de la lista también inicia la pintura, y elegir la fila {{ui:comic.layers.panels}} o {{ui:comic.layers.balloons}}, o pulsar la tecla Esc, vuelve a la página. Abrir otra página o salir de la pantalla del cómic también lo hace.

El {{ui:canvas.tool.bucket}} rellena la región de colores cercanos al que pulsa (**{{ui:canvas.toolbar.bucketTolerance}}** fija lo cercanos que son). El botón **{{ui:canvas.toolbar.filter}}** aplica {{ui:canvas.rasterFilter.blur}}, {{ui:canvas.rasterFilter.grayscale}} o {{ui:canvas.rasterFilter.invert}} a la imagen de la capa raster elegida. Ambos se deshacen con el deshacer de las herramientas de pintura. Ctrl+Z mientras pinta deshace las capas de esa página; el deshacer propio del cómic no devuelve las capas.

Para volver a dibujar solo una parte de la página, añada una {{ui:canvas.add.inpaint}}, pinte la máscara, fije el área que se generará con el {{ui:canvas.tool.bbox}} (no puede salirse de la página) y pulse **{{ui:comic.inpaint.run}}** en la fila de herramientas de pintura. Sin máscara se le indica que pinte una primero. El resultado espera en la barra de aceptación sobre esa página, y **{{ui:canvas.staging.accept}}** lo pone en una capa raster nueva. Si llega mientras está en otra página, se le avisa, y puede aceptarlo pintando en la página original.

## Ajustes de generación

El {{ui:params.model.label}}, los {{ui:params.lora.label}}, el {{ui:params.advanced.vae}}, la {{ui:params.refImage.sectionLabel}} y la {{ui:params.hires.title}} son los mismos que en la pestaña {{ui:app.tabs.generate}}. Cambiar los ajustes de la izquierda también se aplica a la pestaña {{ui:app.tabs.generate}}. Solo los prompts son distintos para cada viñeta (véase «Prompts de las viñetas»).

La imagen que entra en una viñeta es una por viñeta. Por eso el tamaño de una imagen lo decide el tamaño de la viñeta, no el ajuste de tamaño de la pestaña {{ui:app.tabs.generate}}. El campo de iteraciones no aparece en los cómics.

Los **{{ui:comic.draw.settings}}** de la columna izquierda también tienen campos propios. **{{ui:comic.draw.style.title}}** son las palabras de calidad que se ponen delante del prompt de cada viñeta y el negativo compartido por todas las viñetas. Añada a las palabras de calidad sus etiquetas habituales de artista o de estilo y todas las viñetas reciben el mismo estilo. Cuando están vacías, se usan palabras predeterminadas para el modelo. El negativo predeterminado no tiene palabras que quiten el color; para que las páginas salgan en blanco y negro, use el efecto de la página. **{{ui:comic.draw.castReference.title}}** indica si las imágenes de referencia de los personajes se usan mediante IP-Adapter, y con qué intensidad (véase «Mantener los personajes iguales»).

## Convertir la página en una sola imagen

Pulse **{{ui:comic.page.export}}** en la parte superior del centro para guardar la página como una sola imagen (PNG) en la galería. Las imágenes de las viñetas y el texto de los globos y textos narrativos se dibujan en esa imagen. La imagen de cada viñeta se dibuja con la posición, el tamaño, el giro y el volteo que le dio en la página. Los globos se dibujan con la misma forma, línea y ondulación que en la página. El texto se dibuja con tipografías instaladas en Windows, como las japonesas. Las capas se dibujan en su orden, con su opacidad y su modo de mezcla, y una capa oculta se deja fuera. La imagen se dibuja a 200 dpi para coincidir con el tamaño del papel.

Pulse **{{ui:comic.page.psd}}** para guardar la página como un archivo PSD dividido en capas, como una descarga del navegador. Desde abajo, contiene el papel blanco, la imagen sobre toda la página, una capa por viñeta (su imagen recortada con la forma de la viñeta; una viñeta sin imagen es gris), una capa con todos los marcos y una capa por globo. Estas y las capas que añadió siguen el orden de las capas de la página, y conservan su opacidad, su modo de mezcla y si se muestran. El texto de los globos se dibuja en las imágenes, así que no se puede reescribir en el PSD. El efecto de la página también se aplica a cada capa. El archivo se nombra con el cómic y el número de página.

## Guardar todas las páginas en un archivo

Pulse **{{ui:comic.book.export}}** en la parte superior del centro para guardar todas las páginas del cómic en un archivo. **{{ui:comic.book.pdf}}** crea un PDF, adecuado para imprimir y compartir; **{{ui:comic.book.cbz}}** crea un CBZ, que abren los lectores de cómics; **{{ui:comic.book.psd}}** crea un ZIP con un PSD por página. Las páginas van en el orden en que están, y el archivo toma el nombre del cómic. El archivo se guarda como una descarga del navegador. Con muchas páginas, dibujarlas tarda un poco.

Cada página del PDF es una imagen del tamaño del papel. Si la primera página está configurada para leerse de derecha a izquierda, el PDF se abre como un libro de derecha a izquierda. Un CBZ contiene un PNG por página, en orden. Cada PSD del ZIP tiene las mismas capas que da **{{ui:comic.page.psd}}**, y están numerados en el orden de las páginas.

## Deshacer y rehacer

Pulse **{{ui:comic.history.undo}}** en la parte inferior izquierda, debajo de la página, para deshacer el último cambio, y **{{ui:comic.history.redo}}** para recuperar un cambio deshecho. En el teclado, Ctrl+Z deshace un cambio y Ctrl+Shift+Z (o Ctrl+Y) lo recupera (en un Mac, Comando en lugar de Ctrl). Deshacer revierte la disposición de las páginas y las viñetas (incluidas sus formas), los prompts y las poses de las viñetas, y los globos. Las capas se deshacen con el deshacer de la pintura (véase «Pintar en la página»). Las imágenes de las viñetas (ponerlas, quitarlas y moverlas), las plantillas y el nombre del cómic no se deshacen. El texto escrito en un campo sin pausa se deshace como un solo cambio. Mientras el cursor está en un campo de texto, Ctrl+Z cambia solo el texto de ese campo.

## Guardar y eliminar

Un cómic se guarda automáticamente aproximadamente 1 segundo después de un cambio. Aunque cierre la aplicación y la vuelva a abrir, los proyectos guardados siguen en la lista, y las páginas, viñetas, globos y plantillas permanecen como estaban. También se incluyen en las copias de seguridad.

Para eliminar un proyecto, abra el menú de su fila en la lista de cómics, pulse **{{ui:comic.project.delete}}** y vuelva a pulsarlo para confirmar. Eliminar un proyecto quita sus páginas, viñetas y plantillas. Las imágenes que dibujó se quedan en la galería.

Para eliminar una página, pulse el botón de la papelera debajo de la página (**{{ui:comic.page.delete}}**) y vuelva a pulsarlo para confirmar. Las viñetas y los globos de la página se quitan, pero las imágenes que dibujó se quedan en la galería.

## Usar las imágenes dibujadas

Las imágenes dibujadas son imágenes normales que entran en la galería. Las operaciones de otras pantallas que usan imágenes de la galería, como arrastrar una imagen de la galería a la pestaña {{ui:app.tabs.canvas}}, funcionan tal cual.
