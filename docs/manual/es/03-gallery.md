# La galería y el visor

Las imágenes que se crean se alinean en la **galería**, en el lado derecho de la pantalla. Una imagen elegida en la galería se ve en grande en el **{{ui:app.views.viewer}}**, en el centro.
Este capítulo explica cómo organizar las imágenes, cómo encontrarlas, cómo verlas en el visor, cómo recuperar sus ajustes y cómo eliminarlas y descargarlas.

## Cómo es la galería

Elija la pestaña **{{ui:app.right.gallery}}**, en la parte superior del panel derecho, para ver la galería (la pestaña **{{ui:app.right.assistant}}**, a su lado, es el [agente](09-assistant-settings.md#el-agente)). La galería consta de dos partes, una sobre otra.

- Arriba: los **{{ui:gallery.boards.title}}**. Son algo parecido a carpetas para guardar imágenes.
- Abajo: miniaturas de las imágenes del tablero seleccionado.

La fila situada sobre las miniaturas contiene lo siguiente.

- Un conmutador entre «{{ui:gallery.view.images}}» y «{{ui:gallery.view.assets}}», y el número de imágenes.
- El botón de la lupa: búsqueda ({{ui:gallery.search.label}})
- El botón del calendario: {{ui:gallery.date.button}}
- El botón del engranaje: {{ui:gallery.settings.title}}
- El botón de la flecha hacia arriba: {{ui:gallery.upload}}

**{{ui:gallery.view.images}}** contiene las imágenes creadas en novira (incluidos vídeo y audio).
**{{ui:gallery.view.assets}}** contiene las imágenes que ha subido y cosas como logotipos, que se tratan como «material aparte de sus obras». Si le parece que falta una imagen, mire en la otra.

El tamaño de las miniaturas se cambia con el control deslizante del botón del engranaje.
Las miniaturas de vídeo y audio llevan una marca de reproducción, y si deja el cursor encima y lo mueve hacia los lados, puede ver la escena de esa posición.

## Tableros

Un tablero es un contenedor para separar y organizar las imágenes. «{{ui:gallery.boards.uncategorized}}» es un tablero que existe desde el principio y contiene las imágenes que no están en ningún tablero.

- **Crear**: pulse el **＋** ({{ui:gallery.boards.add}}) de la parte superior derecha del área de tableros. Puede escribir el nombre allí mismo.
- **Cambiar**: haga clic en un tablero. Debajo solo se alinean las imágenes de ese tablero.
- **Renombrar**: haga doble clic en el nombre de un tablero o elija «{{ui:common.rename}}» en el menú del clic derecho.
- **Buscar**: la lupa del área de tableros busca nombres de tablero.
- **Contraer**: haga clic en el encabezado «{{ui:gallery.boards.title}}». Arrastre el borde inferior del área de tableros para cambiar su altura.

### A qué tablero va una imagen nueva

Una imagen recién creada (y también una subida) va al tablero marcado con «**{{ui:gallery.boards.autoBadge}}**».
Al principio, cada vez que se hace clic en un tablero, ese tablero pasa a ser «{{ui:gallery.boards.autoBadge}}». Si quiere fijarlo, desactive «{{ui:gallery.settings.autoAssign}}» en los ajustes de la galería y elíjalo con «{{ui:gallery.boards.setAutoAdd}}» en el menú del clic derecho del tablero.

### El menú del clic derecho de un tablero

- **{{ui:gallery.boards.setAutoAdd}}**: lo convierte en el lugar donde se guardan las imágenes nuevas.
- **{{ui:common.rename}}**
- **{{ui:gallery.boards.archive}}**: oculta el tablero de la lista. No se elimina; si activa «{{ui:gallery.settings.showArchived}}» en los ajustes de la galería, puede volver a verlo. «{{ui:gallery.boards.unarchive}}» lo devuelve a su sitio.
- **{{ui:gallery.boards.delete}}**: aparece una ventana de confirmación y se elige una de las siguientes opciones.
  - «{{ui:gallery.boards.deleteBoardOnly}}»: las imágenes se conservan y pasan a «{{ui:gallery.boards.uncategorized}}».
  - «{{ui:gallery.boards.deleteBoardAndImages}}»: también se eliminan las imágenes del tablero.

> «{{ui:gallery.boards.uncategorized}}» no se puede renombrar, archivar ni eliminar.

## Elegir imágenes

Las miniaturas se pueden elegir así.

| Acción | Resultado |
|---|---|
| Clic | Elige esa imagen. La imagen mostrada en el visor también cambia a ella |
| Clic con `Ctrl` pulsada | La añade a las imágenes elegidas o la quita de la selección (selección múltiple) |
| Clic con `Shift` pulsada | Elige todo desde la imagen elegida anteriormente hasta la que se ha pulsado |
| Clic con `Alt` pulsada | La compara con la imagen del visor (se explica más adelante) |
| Doble clic | Cambia el centro al visor y muestra esa imagen en grande |
| `Ctrl+A` | Elige todas las imágenes alineadas en ese momento |
| Teclas de flecha | Mueven la selección a la imagen anterior, siguiente, superior o inferior. Con `Shift` se amplía el intervalo |
| `Esc` | Borra la selección |

> Las teclas de flecha y similares funcionan cuando el cursor está sobre la galería o cuando el centro es el visor.

Las imágenes elegidas reciben un marco azul. Al dejar el cursor sobre una miniatura aparece lo siguiente.

- El tamaño de la imagen (también se puede mostrar siempre con «{{ui:gallery.settings.alwaysShowSize}}» en los ajustes de la galería)
- El botón de la estrella (añade o quita una estrella)
- El botón de la papelera (eliminar)

Una imagen con estrella recibe una marca de estrella amarilla en su esquina superior izquierda.

## Clic derecho en una miniatura

![El menú del clic derecho de una miniatura, con Abrir en el visor, Descargar, Remezclar, Enviar al lienzo y más](shot:gallery-menu)

Al hacer clic derecho en una miniatura aparece una lista de las operaciones disponibles para esa imagen. Las operaciones que no se pueden usar aparecen en gris (por ejemplo, «{{ui:gallery.menu.remix}}» no se puede usar en una imagen que no tiene ajustes registrados).

| Elemento del menú | Función |
|---|---|
| **{{ui:gallery.menu.openInViewer}}** | La muestra en grande en el visor del centro |
| **{{ui:common.download}}** | Guarda el archivo de la imagen |
| **{{ui:share.menu}}** | Exporta copias en el formato y el tamaño que se elijan (se puede quitar la información de generación) |
| **{{ui:share.check.title}}** | Comprueba si una imagen tiene marca de agua, la etiqueta de generada con IA y Content Credentials |
| **{{ui:common.copy}}** (`Ctrl+C`) | Copia la imagen al portapapeles |
| **{{ui:gallery.menu.compare}}** (`Alt+clic`) | La compara con la imagen mostrada en el visor |
| **{{ui:gallery.menu.loadWorkflow}}** (`W`) | Abre el flujo de trabajo que creó la imagen |
| **{{ui:gallery.menu.remix}}** (`R`) | Carga en el panel izquierdo todos los ajustes salvo la semilla |
| **{{ui:gallery.menu.usePrompt}}** (`P`) | Carga solo el prompt |
| **{{ui:gallery.menu.useSeed}}** (`S`) | Carga solo la semilla (la semilla queda fijada) |
| **{{ui:gallery.menu.useAll}}** (`A`) | Carga todos los ajustes |
| **{{ui:gallery.menu.useSize}}** | Carga solo el ancho y el alto |
| **{{ui:gallery.menu.sendToCanvas}}** | La coloca en el lienzo. Se puede elegir entre crear un lienzo nuevo y añadirla al lienzo actual como capa o como máscara |
| **{{ui:gallery.menu.useAsReference}}** | La añade a un marco de imagen de referencia |
| **{{ui:gallery.menu.sendToVideo}}** | La convierte en la primera imagen de un vídeo |
| **{{ui:gallery.menu.sendToWorkflow}}** | La añade al flujo de trabajo abierto como entrada de imagen |
| **{{ui:gallery.menu.sendToText}}** | La convierte en el fondo de una imagen de texto |
| **{{ui:gallery.menu.upscale}}** (`Shift+U`) | La envía a la pestaña Ampliación |
| **{{ui:gallery.menu.segment}}** | Abre la imagen en el lienzo para que se pueda pintar sobre una parte y borrarla, recortarla o repintarla |
| **{{ui:gallery.derive.menu}}** | Crea otras imágenes con los ajustes de esta, usando otra semilla o pequeños cambios |
| **{{ui:gallery.tools.heading}}** | {{ui:facefix.menu}}, {{ui:cutout.menu}}, {{ui:caption.menu}}, {{ui:canvas.poseFromImage.menu}}. Al elegir uno se ejecuta enseguida con los ajustes de la última vez; el engranaje a su derecha abre antes los ajustes (véase [Retocar y reutilizar imágenes](04-improve.md)) |
| **{{ui:gallery.menu.trim}}** | Recorta los márgenes transparentes y guarda el resultado como una imagen transparente nueva |
| **{{ui:character.menu}}** | Registra la imagen como un personaje |
| **{{ui:gallery.menu.changeBoard}}** | La mueve a otro tablero |
| **{{ui:gallery.menu.star}}** / **{{ui:gallery.menu.unstar}}** | Añade o quita una estrella |
| **{{ui:gallery.menu.delete}}** (`Del`) | Elimina la imagen |

Cómo usar «{{ui:gallery.menu.sendToCanvas}}» y las operaciones para rehacer o mejorar una imagen se explica en [Añadir trazos en el lienzo](05-canvas.md), [Retocar y reutilizar imágenes](04-improve.md), [Ampliación y flujos de trabajo](06-upscaling-workflows.md) y [Vídeo, música, voz, logotipos y texto](07-media.md).

> Solo cuando se usa en el navegador web de un ordenador aparece también «{{ui:gallery.menu.openInNewTab}}». No aparece en la versión de escritorio.

## Trabajar con varias imágenes a la vez

![El menú al elegir dos imágenes y hacer clic derecho](shot:gallery-multi-menu)

Si elige dos o más imágenes y después hace clic derecho en una de ellas, aparece un menú para trabajar con todas a la vez. En su parte superior se muestra el número de elegidas, como «2 imágenes seleccionadas».

- **{{ui:gallery.menu.changeBoard}}**: mueve de una vez las imágenes elegidas a otro tablero.
- **{{ui:gallery.menu.starAll}}** / **{{ui:gallery.menu.unstarAll}}**
- **{{ui:common.download}}**: guarda las imágenes elegidas una tras otra.
- **{{ui:share.menu}}**: exporta copias de las imágenes elegidas para compartirlas (los vídeos y los sonidos se omiten).
- **{{ui:gallery.menu.batch}}**: aplica el mismo procesamiento (quitar el fondo, ampliar, etc.) a todas las imágenes elegidas. Cada imagen entra por separado en la cola.
- El elemento rojo de la parte inferior: elimina de una vez las imágenes elegidas.

> Si hace clic derecho en una imagen que no está elegida, aparece el menú de esa sola imagen. Para actuar sobre varias, elíjalas primero y después haga clic derecho en una de las elegidas.

## Buscar, filtrar y ordenar

### Búsqueda

Pulse el botón de la lupa para abrir el campo de búsqueda. Introduzca un nombre de archivo o parte del prompt positivo y se acotan las imágenes de ese tablero. Pulse `Esc` para cerrar la búsqueda y quitar el filtro.

### Filtrar por fecha

![El menú para filtrar por fecha, con botones como Hoy y Ayer y un calendario mensual](shot:gallery-date)

Pulse el botón del calendario para abrir el menú de filtrado por fecha.

- **{{ui:gallery.date.quick.today}}**, **{{ui:gallery.date.quick.yesterday}}**, **{{ui:gallery.date.quick.last7}}**, **{{ui:gallery.date.quick.last30}}**: fijan el periodo con un solo botón.
- El calendario mensual: los días que tienen imágenes aparecen marcados. Haga clic en una fecha y solo se alinean las imágenes de ese día. Use las flechas de arriba para moverse entre meses.
- **{{ui:gallery.date.custom}}**: introduzca una fecha de inicio y una de fin y pulse **{{ui:gallery.date.apply}}** para alinear solo las imágenes de ese periodo. También se puede usar solo una de las dos.
- **{{ui:gallery.date.quick.all}}**: deja de filtrar.

Mientras hay un filtro activo, sobre la galería aparece una etiqueta con el periodo. También se puede quitar con la × de la etiqueta.

### Ajustes de la galería

El botón del engranaje permite cambiar cómo se ordenan las imágenes y su aspecto.

- {{ui:gallery.settings.thumbnailSize}}
- {{ui:gallery.settings.autoSwitch}}: cuando se termina una imagen, se muestra automáticamente.
- {{ui:gallery.settings.autoAssign}}
- {{ui:gallery.settings.alwaysShowSize}}
- {{ui:gallery.settings.showArchived}}
- {{ui:gallery.settings.starredFirst}}: alinea al principio del todo las imágenes con estrella (está activado de forma predeterminada).
- {{ui:gallery.settings.sort}}: «{{ui:gallery.settings.sortNewest}}» o «{{ui:gallery.settings.sortOldest}}».
- {{ui:gallery.settings.groupByDate}}: separa las imágenes con un encabezado por cada día.

## Mirar en el visor

![El visor, con la barra de herramientas arriba, la imagen en el centro, los botones de zoom abajo a la derecha y la información de la imagen en la parte inferior](shot:viewer)

El «{{ui:app.views.viewer}}» del centro muestra en grande la imagen elegida.
Se puede pasar a la imagen anterior y a la siguiente con las flechas de la izquierda y la derecha de la pantalla. La fila inferior muestra el tamaño de la imagen, el modelo usado, la semilla y el nombre del archivo. El vídeo y el audio se pueden reproducir allí mismo.

### Zoom y desplazamiento

- Rueda del ratón: acerca y aleja alrededor de la posición del cursor.
- Arrastrar: desplaza la imagen cuando está ampliada y sobresale del borde de la vista. También se puede mover manteniendo `Space` pulsada o pulsando la rueda.
- Doble clic: alterna entre mostrar la imagen entera y el tamaño real (100 %).
- Botones de abajo a la derecha: alejar, el nivel de zoom (púlselo para ver una lista de niveles habituales), acercar, `1:1` (tamaño real) y ajustar a la pantalla.
- Teclas: `+` y `-` hacen zoom paso a paso, `Ctrl+0` ajusta a la pantalla y `Ctrl+1` muestra el tamaño real.

### Barra de herramientas

La barra de herramientas situada sobre la imagen alinea las operaciones de esa imagen. Deje el puntero sobre un botón para ver su nombre y su atajo.

| Grupo | Botones |
|---|---|
| Información | **{{ui:gallery.viewer.toggleMetadata}}** (`I`) |
| Cargar ajustes | **{{ui:gallery.menu.remix}}** (`R`), **{{ui:gallery.menu.usePrompt}}** (`P`), **{{ui:gallery.menu.useSeed}}** (`S`), **{{ui:gallery.menu.useAll}}** (`A`), **{{ui:gallery.menu.loadWorkflow}}** (`W`), **{{ui:gallery.derive.menu}}** |
| Enviar y mejorar | **{{ui:gallery.menu.sendToCanvas}}**, **{{ui:gallery.menu.useAsReference}}**, **{{ui:gallery.menu.upscale}}** (`Shift+U`), **{{ui:gallery.menu.segment}}**, **{{ui:cutout.menu}}**, **{{ui:facefix.menu}}**, **{{ui:gallery.manga.menu}}**, **{{ui:character.menu}}**, **{{ui:gallery.compare.toggle}}** (`C`) |
| Organizar | **{{ui:gallery.menu.star}}**, **{{ui:common.download}}**, **{{ui:share.menu}}**, **{{ui:gallery.menu.delete}}** (`Del`) |

Hacen lo mismo que los elementos del mismo nombre del menú del clic derecho de la miniatura. En una imagen sin ajustes (como una imagen subida), los botones para cargar ajustes aparecen en gris.

## Información de la imagen y recuperación de ajustes

![El panel de metadatos, con una lista de prompt, modelo, semilla, pasos, etc.](shot:viewer-metadata)

Pulse el botón **{{ui:gallery.viewer.toggleMetadata}}** (`I`) de la barra de herramientas y se abre un panel de información sobre la imagen. Pulse de nuevo, pulse la × de la esquina superior derecha o pulse en cualquier lugar fuera del panel para cerrarlo. El texto del panel se puede seleccionar arrastrando y copiar con `Ctrl+C` (mientras hay texto seleccionado, `Ctrl+C` copia el texto, no la imagen).
El panel tiene cuatro pestañas.

- **{{ui:gallery.meta.tabRecall}}**: los ajustes usados al crear la imagen aparecen elemento por elemento (prompt, modelo, semilla, pasos, escala CFG, planificador, tamaño, LoRA, etc.). El botón de flecha a la derecha de cada fila carga **solo ese elemento** en el panel izquierdo. En las filas de prompt, el botón situado a la izquierda de la flecha copia el prompt tal cual. Una imagen de un modelo cuya familia fija el planificador (Anima, Flux, etc.) muestra una fila «{{ui:gallery.meta.sampling}}» en lugar del planificador, con el muestreador y el planificador que realmente se ejecutaron. Esa fila no carga nada, y «{{ui:gallery.menu.useAll}}» conserva su planificador actual.
- **{{ui:gallery.meta.tabMetadata}}**: muestra tal cual el contenido registrado. Se puede copiar con el botón de la esquina superior derecha.
- **{{ui:gallery.meta.tabDetails}}**: el nombre del archivo, el tamaño, la fecha y la hora de creación, el tablero, si tiene estrella, etc.
- **{{ui:gallery.meta.tabWorkflow}}**: en una imagen creada con un flujo de trabajo, se muestra su contenido.

La forma de cargar los ajustes se elige según cuántos se quieran.

| Método | Qué carga |
|---|---|
| **{{ui:gallery.menu.useAll}}** | Todos los ajustes, como el prompt, el modelo, la semilla y el tamaño. La semilla queda fijada. En una imagen creada con otro programa e importada, el modelo se busca por su nombre (pequeñas diferencias de escritura, como `v17` y `v170`, cuentan como el mismo modelo). Si no se encuentra ninguno, se conserva el modelo actual y la notificación lo indica |
| **{{ui:gallery.menu.remix}}** | Todo salvo la semilla. El ajuste actual de la semilla (aleatoria o fija) se queda como está. Úselo cuando quiera «crear otra imagen con los mismos ajustes» |
| **{{ui:gallery.menu.usePrompt}}** | Solo el prompt (positivo y negativo) |
| **{{ui:gallery.menu.useSeed}}** | Solo la semilla. La semilla queda fijada |
| **{{ui:gallery.menu.useSize}}** | Solo el ancho y el alto (solo en el menú del clic derecho) |

Tras cargar, basta con mirar el panel izquierdo y pulsar **{{ui:params.invoke.invoke}}**.

> El archivo de imagen (PNG) de una imagen creada en novira lleva registrados sus ajustes. Por eso, a veces se pueden cargar los ajustes incluso de una imagen que se movió a otro lugar y se volvió a subir. Las imágenes creadas con otro programa y las que se editaron y se guardaron de nuevo no contienen ajustes.

## Comparar dos imágenes

![El visor comparando dos imágenes con el control deslizante. Se mueve la línea vertical del medio a izquierda y derecha](shot:viewer-compare)

Cuando quiera ver la diferencia entre dos imágenes, use la comparación.

1. Haga clic en la primera imagen que quiere comparar para elegirla y asegúrese de que el centro esté en la pestaña «{{ui:app.views.viewer}}».
2. Haga clic en la miniatura de la segunda imagen con `Alt` pulsada (también se puede con «{{ui:gallery.menu.compare}}» en el menú del clic derecho).
3. En la segunda miniatura aparece una etiqueta «{{ui:gallery.compare.badge}}» y el visor cambia a la pantalla de comparación.

> También se puede empezar eligiendo dos imágenes con `Ctrl` pulsada y pulsando después el botón de comparar de la barra de herramientas o la tecla `C`. Si ha elegido solo una, aparece la indicación «{{ui:gallery.compare.hint}}».

En la parte superior de la pantalla de comparación aparecen los siguientes botones.

- **{{ui:gallery.compare.slider}}**: las dos imágenes se superponen, y si arrastra la línea vertical del medio, ve en qué se diferencian a izquierda y derecha.
- **{{ui:gallery.compare.sideBySide}}**: alinea las dos imágenes a izquierda y derecha.
- **{{ui:gallery.compare.hover}}**: cambia a la segunda imagen solo mientras el cursor está sobre la imagen.
- **{{ui:gallery.compare.swap}}**: intercambia la primera y la segunda imagen.
- **{{ui:gallery.compare.exit}}**: deja de comparar. También se puede dejar con `Esc`.

El zoom y el desplazamiento funcionan de forma sincronizada en las dos imágenes. Las diferencias en los detalles finos se ven mejor con zoom.

## Estrellas y eliminación

### Añadir una estrella

Se puede poner una estrella a las imágenes que gustan. La estrella se añade o se quita con el botón de estrella de la miniatura, desde el menú del clic derecho o desde la barra de herramientas del visor.
Cuando «{{ui:gallery.settings.starredFirst}}» está activado en los ajustes de la galería, las imágenes con estrella se reúnen al principio.

### Eliminar

Una imagen se puede eliminar de las siguientes formas.

- El botón de la papelera de la miniatura
- «{{ui:gallery.menu.delete}}» en el menú del clic derecho
- El botón de la papelera de la barra de herramientas del visor
- Elegir la imagen y pulsar la tecla `Delete` (`Backspace` hace lo mismo)

Aparece una ventana de confirmación y, al pulsar «{{ui:common.delete}}», se elimina.

Una imagen eliminada no se borra de inmediato. Se conserva durante 14 días (500 imágenes como máximo), por lo que se puede deshacer una eliminación.

- Pulse la campana de la esquina inferior derecha y luego **{{ui:gallery.undoDelete.action}}** en la notificación de la eliminación. Para no estorbar mientras elimina una imagen tras otra, las notificaciones de eliminación no aparecen en la pantalla: solo se guardan en la campana (su número aumenta).
- O bien pulse el botón «{{ui:gallery.undoDelete.label}}» de la parte superior de la galería, o `Ctrl+Z` con el puntero sobre la galería (o con el visor abierto). Se pueden deshacer las últimas 30 eliminaciones, empezando por la más reciente.
- Para volver a eliminar lo que se recuperó, pulse el botón «{{ui:gallery.redoDelete.label}}» o `Ctrl+Shift+Z` (`Ctrl+Y`).

> El historial de lo que se puede deshacer se olvida al cerrar la aplicación. Una imagen eliminada hace más de 14 días no se puede restaurar. Eliminar un tablero junto con sus imágenes se puede deshacer de la misma forma; las imágenes vuelven a «{{ui:gallery.boards.uncategorized}}» cuando el tablero ya no existe.

Si marca «{{ui:common.dontAskAgain}}» en la ventana de confirmación, a partir de entonces las imágenes se eliminan sin confirmación. Para recuperar la confirmación, active «{{ui:settings.confirmOnDelete}}» en **{{ui:app.nav.settings}}**.

## Subir y descargar

### Subir

Se pueden traer imágenes del ordenador a la galería.

- Pulse el botón **{{ui:gallery.upload}}** situado sobre la galería y elija los archivos.
- Arrastre y suelte archivos de imagen desde el Explorador de archivos sobre la galería. Si los suelta sobre un tablero, van a ese tablero.

Las imágenes subidas van a **{{ui:gallery.view.assets}}** del tablero «{{ui:gallery.boards.autoBadge}}», y la pantalla también cambia allí. Se pueden subir varios archivos a la vez. Los archivos que no son imágenes se ignoran.

### Descargar

Para guardar el archivo de una imagen, use el menú del clic derecho o **{{ui:common.download}}** en la barra de herramientas del visor. Si ha elegido varias imágenes, se guardan juntas.

En la aplicación de escritorio se abre una ventana para elegir la carpeta, y los archivos originales se copian allí tal cual (con su información de generación). Si ya existe un archivo con el mismo nombre, se añade un número como «-2»; no se sobrescribe nada. El aviso posterior al guardado tiene **{{ui:share.openFolder}}** para abrir esa carpeta. En un navegador, los archivos van a las descargas del navegador.

### Exportar para compartir

![La ventana Exportar para compartir: formato (PNG, JPEG, WebP), calidad, lado más largo y el interruptor que quita la información de generación](shot:share-export)

Para hacer copias de imágenes para redes sociales o para otras personas, use **{{ui:share.menu}}** en el menú del clic derecho (también funciona con varias imágenes elegidas) o en la barra de herramientas del visor. Los originales no cambian.

- **{{ui:share.format}}**: PNG, JPEG o WebP. En JPEG se puede ajustar la **{{ui:share.quality}}** (de 1 a 100) y las partes transparentes pasan a blanco. WebP se guarda sin pérdida.
- **{{ui:share.size}}**: «{{ui:share.size.original}}», 2048, 1536 o 1024 px, o «{{ui:share.size.custom}}» para escribir una longitud. Las imágenes más pequeñas que eso no se amplían.
- **{{ui:share.removeInfo}}**: desactivado al principio. Cuando está activado, se omiten el prompt, los ajustes y el flujo de trabajo, y la imagen se guarda de nuevo a partir de sus píxeles, de modo que tampoco queda ningún otro dato incrustado. Cuando está desactivado, solo PNG conserva los ajustes. Actívelo antes de entregar una imagen a otras personas si no quiere mostrar el prompt.
- **{{ui:share.watermark}}**: desactivado al principio. Cuando está activado, las imágenes exportadas reciben una marca de agua invisible (TrustMark), la etiqueta que indica que el contenido se creó con IA (IPTC) y Content Credentials firmadas (C2PA). La marca de agua lleva la señal de novira y un número aleatorio distinto para cada imagen, y la aplicación registra de qué imagen procede cada número.

Pulse **{{ui:share.run}}**; en la aplicación de escritorio se abre una ventana para elegir la carpeta. Cada archivo recibe el nombre de archivo de la galería con la nueva extensión; si ya existe un archivo con ese nombre, se añade un número como «-2» o «-3», y no se sobrescribe nada. Después, **{{ui:share.openFolder}}** abre esa carpeta.

> Solo se exportan imágenes; los vídeos y los sonidos entre los elementos elegidos se omiten. En un navegador, los archivos van a las descargas del navegador: una imagen tal cual, dos o más en un zip. Una exportación admite hasta 1 GB en total; por encima, se le pide que elija menos imágenes.

Los archivos que necesita la marca de agua (unos 140 MB en total) se descargan automáticamente al iniciar la aplicación. Hasta que estén listos, el avance aparece bajo el interruptor y **{{ui:share.run}}** no se puede pulsar. Si la descarga falla, pulse **{{ui:share.watermarkRetry}}**.

> La marca de agua está en el cuadrado central de la imagen. Se ha comprobado que sobrevive a guardar de nuevo como JPEG con calidad 80 y a reducir el tamaño a la mitad, pero recortar, regenerar o editar mucho puede eliminarla. El esquema es público, por lo que cualquiera puede escribir la misma marca. La firma se crea en este PC, por lo que otras aplicaciones muestran al firmante como no fiable. La marca de agua necesita el Microsoft Visual C++ Redistributable; sin él, se muestra un error.

### Comprobar si hay marca de agua

Ábrala con **{{ui:share.check.title}}** en el menú del clic derecho de una miniatura. Elija un archivo de imagen (PNG, JPEG o WebP) con **{{ui:share.check.pick}}** y la ventana lista lo que encontró. Si la abre desde el menú del clic derecho, esa imagen se comprueba de inmediato. En un navegador no se puede elegir un archivo para comprobarlo.

- **{{ui:share.check.watermark}}**: si está la marca de agua de novira, con su número.
- **{{ui:share.check.original}}**: si el número está en los registros de exportación de esta aplicación, la imagen original y cuándo se exportó; **{{ui:share.check.showOriginal}}** la muestra en el visor.
- **{{ui:share.check.credentials}}**: si hay Content Credentials, si el archivo cambió después de firmarse, si registran la imagen como generada con IA y quién las firmó.
- **{{ui:share.check.iptc}}**: si está la etiqueta que indica que el contenido se creó con IA.

> No encontrar una marca de agua no demuestra que una imagen no se haya creado con IA. Los registros de exportación están en la base de datos de esta aplicación, por lo que no se conoce el original de una imagen exportada por novira en otro PC. Mientras los archivos de la marca de agua no están listos, solo se comprueban los demás elementos.

## Arrastrar y soltar

Las miniaturas se pueden arrastrar a otros lugares y usarlas allí. Cuando hay varias elegidas, las imágenes elegidas se mueven juntas.

- **Sobre un tablero**: mueve la imagen a ese tablero.
- **Sobre un marco de {{ui:params.refImage.sectionLabel}}**: la convierte en imagen de referencia (véase [Crear imágenes](02-generate.md)).
- **Sobre el campo de imagen del lienzo o de Ampliación, o sobre una tarjeta de la pantalla de inicio**: la usa como material de esa pantalla.

Los archivos del Explorador de archivos se pueden soltar sobre la galería, sobre un tablero, sobre un marco de imagen de referencia, sobre una tarjeta de la pantalla de inicio, etc.

## Atajos de teclado de la galería

| Acción | Tecla |
|---|---|
| Elegir la imagen anterior, siguiente, superior o inferior | Teclas de flecha (`Shift` amplía el intervalo) |
| Elegir todo | `Ctrl+A` |
| Borrar la selección | `Esc` |
| Eliminar las imágenes elegidas | `Delete` |
| Copiar la imagen del visor o la elegida en la galería (también en la pantalla del lienzo, tras pulsar una imagen de la galería) | `Ctrl+C` |
| Abrir y cerrar el panel de información | `I` |
| Remezclar, prompt, semilla, todo | `R`, `P`, `S`, `A` |
| Cargar el flujo de trabajo | `W` |
| Enviar a Ampliación | `Shift+U` |
| Iniciar y detener la comparación | `C` |
| Ajustar a la pantalla, tamaño real | `Ctrl+0`, `Ctrl+1` |
| Acercar, alejar | `+`, `-` |

Funcionan cuando el cursor está sobre la galería o cuando el centro es el visor. También puede ver la lista en «{{ui:app.nav.hotkeys}}», dentro del menú **{{ui:app.nav.settings}}**.
