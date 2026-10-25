# La galería y el visor

Las imágenes creadas se alinean en la **galería**, en el lado derecho de la pantalla. La imagen elegida en la galería se ve en grande en el **{{ui:app.views.viewer}}**, en el centro.
Este capítulo explica cómo organizar las imágenes, cómo buscarlas, cómo verlas en el visor, cómo recuperar sus ajustes, y cómo eliminarlas y descargarlas.

## Cómo es la galería

El panel derecho consta de dos partes, una sobre otra.

- Arriba: **{{ui:gallery.boards.title}}**. Son algo parecido a carpetas para guardar imágenes.
- Abajo: las miniaturas de las imágenes del tablero elegido.

La fila situada sobre las miniaturas contiene lo siguiente.

- Un selector entre «{{ui:gallery.view.images}}» y «{{ui:gallery.view.assets}}», y el número de imágenes.
- El botón de la lupa: búsqueda ({{ui:gallery.search.label}})
- El botón del calendario: {{ui:gallery.date.button}}
- El botón del engranaje: {{ui:gallery.settings.title}}
- El botón de la flecha hacia arriba: {{ui:gallery.upload}}

**{{ui:gallery.view.images}}** contiene las imágenes creadas en novira (incluidos vídeo y audio).
**{{ui:gallery.view.assets}}** contiene las imágenes subidas y elementos como logotipos, que se tratan como «material aparte de las obras». Si falta alguna imagen, conviene mirar en la otra vista.

El tamaño de las miniaturas se cambia con el control deslizante del botón del engranaje.
Las miniaturas de vídeo y audio llevan una marca de reproducción; al pasar el cursor por encima y moverlo en horizontal, se puede ver la escena de esa posición.

## Tableros

Un tablero es un contenedor para separar y organizar imágenes. «{{ui:gallery.boards.uncategorized}}» es un tablero que existe desde el principio y contiene las imágenes que no están en ningún tablero.

- **Crear**: pulsar el botón **＋** ({{ui:gallery.boards.add}}) de la esquina superior derecha de la zona de tableros. El nombre se escribe en el mismo sitio.
- **Cambiar**: hacer clic en un tablero. Debajo aparecen solo las imágenes de ese tablero.
- **Renombrar**: hacer doble clic en el nombre del tablero, o elegir «{{ui:common.rename}}» en el menú del clic derecho.
- **Buscar**: la lupa de la zona de tableros busca por nombre de tablero.
- **Contraer**: hacer clic en el encabezado «{{ui:gallery.boards.title}}». Arrastrando el borde inferior de la zona de tableros se cambia su altura.

### En qué tablero entra una imagen nueva

Una imagen recién creada (y también una subida) entra en el tablero marcado como «**{{ui:gallery.boards.autoBadge}}**».
Al principio, cada vez que se hace clic en un tablero, ese tablero pasa a ser «{{ui:gallery.boards.autoBadge}}». Para fijarlo, hay que desactivar «{{ui:gallery.settings.autoAssign}}» en los ajustes de la galería y elegirlo con «{{ui:gallery.boards.setAutoAdd}}» en el menú del clic derecho del tablero.

### El menú del clic derecho de un tablero

- **{{ui:gallery.boards.setAutoAdd}}**: lo convierte en el destino donde se guardan las imágenes nuevas.
- **{{ui:common.rename}}**
- **{{ui:gallery.boards.archive}}**: oculta el tablero de la lista. No se elimina; al activar «{{ui:gallery.settings.showArchived}}» en los ajustes de la galería, vuelve a verse. «{{ui:gallery.boards.unarchive}}» lo restituye.
- **{{ui:gallery.boards.delete}}**: aparece una ventana de confirmación y se elige una de estas opciones.
  - «{{ui:gallery.boards.deleteBoardOnly}}»: las imágenes se conservan y pasan a «{{ui:gallery.boards.uncategorized}}».
  - «{{ui:gallery.boards.deleteBoardAndImages}}»: también se eliminan las imágenes del tablero.

> «{{ui:gallery.boards.uncategorized}}» no se puede renombrar, archivar ni eliminar.

## Elegir imágenes

Las miniaturas se pueden elegir como sigue.

| Acción | Resultado |
|---|---|
| Clic | Elige esa imagen. La imagen mostrada en el visor también cambia a ella |
| Clic con `Ctrl` pulsada | La añade a las imágenes elegidas o la quita de la selección (selección múltiple) |
| Clic con `Shift` pulsada | Elige todas las imágenes desde la elegida anteriormente hasta la pulsada |
| Clic con `Alt` pulsada | La compara con la imagen del visor (se describe más adelante) |
| Doble clic | Cambia el centro al visor y muestra esa imagen en grande |
| `Ctrl+A` | Elige todas las imágenes que están alineadas en ese momento |
| Teclas de flecha | Mueven la selección a la imagen anterior, siguiente, superior o inferior. Con `Shift` pulsada, amplían el rango |
| `Esc` | Anula la selección |

> Las teclas de flecha y similares funcionan cuando el cursor está sobre la galería o cuando el centro es el visor.

Las imágenes elegidas llevan un marco azul. Al pasar el cursor sobre una miniatura, aparece lo siguiente.

- El tamaño de la imagen (también se puede mostrar siempre con «{{ui:gallery.settings.alwaysShowSize}}» en los ajustes de la galería)
- El botón de la estrella (añadir o quitar la estrella)
- El botón de la papelera (eliminar)

Una imagen con estrella lleva una marca de estrella amarilla en la esquina superior izquierda.

## Clic derecho en una miniatura

![El menú del clic derecho de una miniatura, con Abrir en el visor, Descargar, Remezclar, Enviar al lienzo y más](shot:gallery-menu)

Al hacer clic derecho en una miniatura, aparece una lista de las operaciones disponibles para esa imagen. Las operaciones que no se pueden usar aparecen en gris (por ejemplo, «{{ui:gallery.menu.remix}}» no se puede usar en una imagen sin ajustes registrados).

| Elemento del menú | Qué hace |
|---|---|
| **{{ui:gallery.menu.openInViewer}}** | La muestra en grande en el visor del centro |
| **{{ui:common.download}}** | Guarda el archivo de la imagen |
| **{{ui:share.menu}}** | Exporta copias en el formato y el tamaño elegidos (también se puede quitar la información de generación) |
| **{{ui:common.copy}}** (`Ctrl+C`) | Copia la imagen en el portapapeles |
| **{{ui:gallery.menu.compare}}** (`Alt+clic`) | La compara con la imagen mostrada en el visor |
| **{{ui:gallery.menu.loadWorkflow}}** (`W`) | Abre el flujo de trabajo que creó la imagen |
| **{{ui:gallery.menu.remix}}** (`R`) | Carga en el panel izquierdo todos los ajustes excepto la semilla |
| **{{ui:gallery.menu.usePrompt}}** (`P`) | Carga solo el prompt |
| **{{ui:gallery.menu.useSeed}}** (`S`) | Carga solo la semilla (la semilla queda fija) |
| **{{ui:gallery.menu.useAll}}** (`A`) | Carga todos los ajustes |
| **{{ui:gallery.menu.useSize}}** | Carga solo el ancho y el alto |
| **{{ui:gallery.menu.sendToCanvas}}** | La coloca en el lienzo. Se puede elegir entre crear un lienzo nuevo o añadirla al lienzo actual como capa o como máscara |
| **{{ui:gallery.menu.useAsReference}}** | La añade a un marco de imagen de referencia |
| **{{ui:gallery.menu.sendToVideo}}** | La convierte en la primera imagen de un vídeo |
| **{{ui:gallery.menu.sendToWorkflow}}** | La añade al flujo de trabajo abierto como entrada de imagen |
| **{{ui:gallery.menu.sendToText}}** | La convierte en el fondo de un texto |
| **{{ui:gallery.menu.upscale}}** (`Shift+U`) | La envía a la pestaña de ampliación |
| **{{ui:gallery.menu.segment}}** | Selecciona una parte de la imagen para recortarla o volver a dibujarla |
| **{{ui:gallery.derive.menu}}** | Crea otras imágenes con los ajustes de esta, con otra semilla o con pequeños cambios |
| **{{ui:cutout.menu}}** | Quita el fondo |
| **{{ui:facefix.menu}}** | Detecta los rostros y los vuelve a dibujar |
| **{{ui:gallery.menu.trim}}** | Recorta los márgenes transparentes y guarda el resultado como una imagen transparente nueva |
| **{{ui:character.menu}}** | Registra la imagen como un personaje |
| **{{ui:gallery.menu.changeBoard}}** | La mueve a otro tablero |
| **{{ui:gallery.menu.star}}** / **{{ui:gallery.menu.unstar}}** | Añade o quita la estrella |
| **{{ui:gallery.menu.delete}}** (`Del`) | Elimina la imagen |

El uso de «{{ui:gallery.menu.sendToCanvas}}» y de las operaciones para rehacer o mejorar una imagen se explica en [Añadir trazos en el lienzo](05-canvas.md), [Retocar y reutilizar imágenes](04-improve.md), [Ampliación y flujos de trabajo](06-upscaling-workflows.md) y [Vídeo, música, voz, logotipos y texto](07-media.md).

> Solo cuando se usa en el navegador de un ordenador aparece también «{{ui:gallery.menu.openInNewTab}}». En la versión de escritorio no aparece.

## Operar con varias imágenes a la vez

![El menú al hacer clic derecho con dos imágenes elegidas](shot:gallery-multi-menu)

Si se eligen dos o más imágenes y después se hace clic derecho en una de ellas, aparece un menú para operar con todas a la vez. Al principio se muestra el número de imágenes elegidas, por ejemplo «2 imágenes seleccionadas».

- **{{ui:gallery.menu.changeBoard}}**: mueve a la vez las imágenes elegidas a otro tablero.
- **{{ui:gallery.menu.starAll}}** / **{{ui:gallery.menu.unstarAll}}**
- **{{ui:common.download}}**: guarda las imágenes elegidas una tras otra.
- **{{ui:share.menu}}**: exporta a la vez copias de las imágenes elegidas para compartir (se excluyen el vídeo y el audio).
- **{{ui:gallery.menu.batch}}**: aplica el mismo procesamiento (quitar el fondo, ampliar, etc.) a todas las imágenes elegidas. Cada imagen entra por separado en la cola.
- El elemento rojo de la parte inferior: elimina a la vez las imágenes elegidas.

> Si se hace clic derecho en una imagen que no está elegida, aparece el menú de esa sola imagen. Para actuar sobre varias imágenes, primero hay que elegirlas y después hacer clic derecho sobre una de las elegidas.

## Buscar, filtrar y ordenar

### Búsqueda

Al pulsar el botón de la lupa, se abre el campo de búsqueda. Si se escribe un nombre de archivo o parte del prompt positivo, se filtran las imágenes de ese tablero. Con `Esc` se cierra la búsqueda y se anula el filtro.

### Filtrar por fecha

![El menú para filtrar por fecha, con botones como Hoy y Ayer y un calendario mensual](shot:gallery-date)

Al pulsar el botón del calendario, se abre el menú para filtrar por fecha.

- **{{ui:gallery.date.quick.today}}**, **{{ui:gallery.date.quick.yesterday}}**, **{{ui:gallery.date.quick.last7}}**, **{{ui:gallery.date.quick.last30}}**: fijan el período con un solo botón.
- El calendario mensual: los días con imágenes aparecen marcados. Al hacer clic en una fecha, se alinean solo las imágenes de ese día. Con las flechas de arriba se cambia de mes.
- **{{ui:gallery.date.custom}}**: se escriben una fecha de inicio y una de fin y se pulsa **{{ui:gallery.date.apply}}** para alinear solo las imágenes de ese período. También se puede usar solo una de las dos.
- **{{ui:gallery.date.quick.all}}**: deja de filtrar.

Mientras hay un filtro activo, sobre la galería aparece una etiqueta con el período. También se puede anular con la × de la etiqueta.

### Ajustes de la galería

El botón del engranaje permite cambiar la disposición y el aspecto.

- {{ui:gallery.settings.thumbnailSize}}
- {{ui:gallery.settings.autoSwitch}}: cuando una imagen está lista, se muestra automáticamente.
- {{ui:gallery.settings.autoAssign}}
- {{ui:gallery.settings.alwaysShowSize}}
- {{ui:gallery.settings.showArchived}}
- {{ui:gallery.settings.starredFirst}}: coloca arriba del todo las imágenes con estrella (viene activado desde el principio).
- {{ui:gallery.settings.sort}}: «{{ui:gallery.settings.sortNewest}}» o «{{ui:gallery.settings.sortOldest}}».
- {{ui:gallery.settings.groupByDate}}: las separa con un encabezado para cada día.

## Ver en el visor

![El visor, con la barra de herramientas arriba, la imagen en el centro, los botones de zoom abajo a la derecha y la información de la imagen abajo](shot:viewer)

El «{{ui:app.views.viewer}}» del centro muestra en grande la imagen elegida.
Con las flechas de los lados izquierdo y derecho de la pantalla se pasa a la imagen anterior o siguiente. La fila inferior muestra el tamaño de la imagen, el modelo usado, la semilla y el nombre del archivo. El vídeo y el audio se pueden reproducir en el mismo sitio.

### Zoom y desplazamiento

- Rueda del ratón: acerca y aleja tomando como centro la posición del cursor.
- Arrastrar: mueve la imagen cuando está ampliada y se sale del marco. También se puede mover manteniendo pulsada `Space` o pulsando la rueda.
- Doble clic: alterna entre la vista completa y el tamaño real (100 %).
- Botones de abajo a la derecha: alejar, el nivel de zoom (al pulsarlo se abre una lista de niveles habituales), acercar, `1:1` (tamaño real) y ajustar a la pantalla.
- Teclas: `+` y `-` cambian un nivel cada vez, `Ctrl+0` ajusta a la pantalla y `Ctrl+1` muestra el tamaño real.

### Barra de herramientas

La barra de herramientas situada sobre la imagen reúne las operaciones para esa imagen. Al pasar el cursor sobre un botón, se muestran su nombre y su atajo.

| Grupo | Botones |
|---|---|
| Información | **{{ui:gallery.viewer.toggleMetadata}}** (`I`) |
| Cargar ajustes | **{{ui:gallery.menu.remix}}** (`R`), **{{ui:gallery.menu.usePrompt}}** (`P`), **{{ui:gallery.menu.useSeed}}** (`S`), **{{ui:gallery.menu.useAll}}** (`A`), **{{ui:gallery.menu.loadWorkflow}}** (`W`), **{{ui:gallery.derive.menu}}** |
| Enviar y mejorar | **{{ui:gallery.menu.sendToCanvas}}**, **{{ui:gallery.menu.useAsReference}}**, **{{ui:gallery.menu.upscale}}** (`Shift+U`), **{{ui:gallery.menu.segment}}**, **{{ui:cutout.menu}}**, **{{ui:facefix.menu}}**, **{{ui:character.menu}}**, **{{ui:gallery.compare.toggle}}** (`C`) |
| Organizar | **{{ui:gallery.menu.star}}**, **{{ui:common.download}}**, **{{ui:share.menu}}**, **{{ui:gallery.menu.delete}}** (`Del`) |

Hacen lo mismo que los elementos con el mismo nombre del menú del clic derecho de la miniatura. En una imagen sin ajustes (como una imagen subida), los botones para cargar ajustes aparecen en gris.

## Información de la imagen y recuperación de ajustes

![El panel de metadatos, con una lista de prompt, modelo, semilla, pasos, etc.](shot:viewer-metadata)

Al pulsar el botón **{{ui:gallery.viewer.toggleMetadata}}** (`I`) de la barra de herramientas, se abre sobre la imagen un panel de información. Se cierra pulsándolo de nuevo o con la × de la esquina superior derecha.
El panel tiene cuatro pestañas.

- **{{ui:gallery.meta.tabRecall}}**: los ajustes usados al crear la imagen aparecen elemento por elemento (prompt, modelo, semilla, pasos, escala CFG, scheduler, tamaño, LoRA, etc.). El botón de flecha a la derecha de cada fila carga **solo ese elemento** en el panel izquierdo.
- **{{ui:gallery.meta.tabMetadata}}**: muestra el contenido registrado tal cual. Se puede copiar con el botón de la esquina superior derecha.
- **{{ui:gallery.meta.tabDetails}}**: el nombre del archivo, el tamaño, la fecha y hora de creación, el tablero, si tiene estrella, etc.
- **{{ui:gallery.meta.tabWorkflow}}**: en una imagen creada con un flujo de trabajo, se muestra su contenido.

El modo de cargar los ajustes se elige según cuánto se quiera usar.

| Método | Qué carga |
|---|---|
| **{{ui:gallery.menu.useAll}}** | Todos los ajustes: prompt, modelo, semilla, tamaño, etc. La semilla queda fija |
| **{{ui:gallery.menu.remix}}** | Todo excepto la semilla. El ajuste actual de la semilla (aleatoria o fija) se mantiene tal cual. Sirve para «crear otra imagen con los mismos ajustes» |
| **{{ui:gallery.menu.usePrompt}}** | Solo el prompt (positivo y negativo) |
| **{{ui:gallery.menu.useSeed}}** | Solo la semilla. La semilla queda fija |
| **{{ui:gallery.menu.useSize}}** | Solo el ancho y el alto (solo en el menú del clic derecho) |

Después de cargar, basta con revisar el panel izquierdo y pulsar **{{ui:params.invoke.invoke}}**.

> El archivo de imagen (PNG) de una imagen creada en novira lleva registrados también sus ajustes. Por eso, a veces se pueden cargar los ajustes incluso de una imagen que se movió a otro lugar y se volvió a subir. Las imágenes creadas con otros programas y las imágenes editadas y guardadas de nuevo no contienen ajustes.

## Comparar dos imágenes

![El visor comparando dos imágenes con el control deslizante. La línea vertical del centro se mueve a izquierda y derecha](shot:viewer-compare)

Para ver la diferencia entre dos imágenes, se usa la comparación.

1. Hacer clic en la primera imagen que se quiere comparar para elegirla, y poner el centro en la pestaña «{{ui:app.views.viewer}}».
2. Hacer clic en la miniatura de la segunda imagen con `Alt` pulsada (también se puede con «{{ui:gallery.menu.compare}}» en el menú del clic derecho).
3. En la miniatura de la segunda imagen aparece la etiqueta «{{ui:gallery.compare.badge}}» y el visor pasa a la pantalla de comparación.

> También se puede empezar eligiendo dos imágenes con `Ctrl` pulsada y pulsando después el botón de comparar de la barra de herramientas o la tecla `C`. Si solo hay una elegida, aparece la indicación «{{ui:gallery.compare.hint}}».

En la parte superior de la pantalla de comparación aparecen los siguientes botones.

- **{{ui:gallery.compare.slider}}**: las dos imágenes se superponen y, al arrastrar la línea vertical del centro, se ve en qué se diferencian a izquierda y derecha.
- **{{ui:gallery.compare.sideBySide}}**: coloca las dos imágenes una junto a otra, a izquierda y derecha.
- **{{ui:gallery.compare.hover}}**: cambia a la segunda imagen solo mientras el cursor está sobre la imagen.
- **{{ui:gallery.compare.swap}}**: intercambia la primera y la segunda imagen.
- **{{ui:gallery.compare.exit}}**: deja de comparar. También se puede salir con `Esc`.

El zoom y el desplazamiento se aplican a la vez a las dos imágenes. Las diferencias en los detalles finos se aprecian mejor al ampliar.

## Estrellas y eliminación

### Añadir una estrella

A las imágenes que le gustan se les puede poner una estrella. Se puede añadir o quitar desde el botón de la estrella de la miniatura, desde el menú del clic derecho o desde la barra de herramientas del visor.
Si «{{ui:gallery.settings.starredFirst}}» está activado en los ajustes de la galería, las imágenes con estrella se agrupan al principio.

### Eliminar

Una imagen se puede eliminar de las siguientes maneras.

- El botón de la papelera de la miniatura
- «{{ui:gallery.menu.delete}}» en el menú del clic derecho
- El botón de la papelera de la barra de herramientas del visor
- Elegir la imagen y pulsar la tecla `Delete` (`Backspace` hace lo mismo)

Aparece una ventana de confirmación y, al pulsar «{{ui:common.delete}}», se elimina.

> Una imagen eliminada no se puede recuperar. No existe un lugar como una papelera de reciclaje.

Si se marca «{{ui:common.dontAskAgain}}» en la ventana de confirmación, a partir de entonces las imágenes se eliminan sin confirmar. Para recuperar la confirmación, hay que activar «{{ui:settings.confirmOnDelete}}» en **{{ui:app.nav.settings}}**.

## Subir y descargar

### Subir

Las imágenes del ordenador se pueden llevar a la galería.

- Pulsar el botón **{{ui:gallery.upload}}** situado sobre la galería y elegir los archivos.
- Arrastrar y soltar archivos de imagen desde el Explorador de archivos sobre la galería. Si se sueltan sobre un tablero, entran en ese tablero.

Las imágenes subidas entran en **{{ui:gallery.view.assets}}** del tablero «{{ui:gallery.boards.autoBadge}}» y la pantalla también cambia a esa vista. Se pueden subir varios archivos a la vez. Los archivos que no son imágenes se ignoran.

### Descargar

Para guardar el archivo de una imagen, se usa el menú del clic derecho o **{{ui:common.download}}** en la barra de herramientas del visor. Si hay varias imágenes elegidas, se guardan todas juntas.

### Exportar para compartir

![La ventana de exportación para compartir: formato (PNG, JPEG, WebP), calidad, límite del lado largo y el interruptor que quita la información de generación](shot:share-export)

Las copias de imágenes para publicar en redes sociales o entregar a otras personas se crean con **{{ui:share.menu}}**, en el menú del clic derecho (también funciona con varias imágenes elegidas) o en la barra de herramientas del visor. Las imágenes originales no cambian.

- **{{ui:share.format}}**: se elige entre PNG, JPEG y WebP. En JPEG se puede fijar la **{{ui:share.quality}}** (1 a 100) y las partes transparentes pasan a blanco. WebP se guarda sin pérdida.
- **{{ui:share.size}}**: «{{ui:share.size.original}}», 2048, 1536 o 1024 px, o «{{ui:share.size.custom}}» para escribir una longitud. Las imágenes más pequeñas no se amplían.
- **{{ui:share.removeInfo}}**: al principio está desactivado. Si se activa, no se incluyen el prompt, los ajustes ni el flujo de trabajo, y la imagen se vuelve a guardar a partir de sus píxeles, de modo que tampoco queda ningún otro dato incrustado. Si está desactivado, solo el PNG conserva los ajustes. Conviene activarlo antes de entregar una imagen a otras personas si no se quiere mostrar el prompt.

Al pulsar **{{ui:share.run}}**, en la versión de escritorio se abre una ventana para elegir la carpeta de destino. El nombre de archivo es el de la galería con la nueva extensión; si ya existe un archivo con ese nombre, se añade un número como «-2» o «-3» y nunca se sobrescribe. Después de exportar, **{{ui:share.openFolder}}** abre esa carpeta.

> Solo se exportan imágenes; el vídeo y el audio de lo elegido se excluyen. Cuando se usa en un navegador, los archivos se guardan en las descargas del navegador.

## Arrastrar y soltar

Las miniaturas se pueden arrastrar a otros lugares para usarlas allí. Si hay varias elegidas, las imágenes elegidas se mueven juntas.

- **Sobre un tablero**: mueve la imagen a ese tablero.
- **Sobre el marco de {{ui:params.refImage.sectionLabel}}**: la convierte en imagen de referencia (véase [Crear imágenes](02-generate.md)).
- **Sobre el campo de imagen del lienzo o de la ampliación, o sobre una tarjeta de la pantalla de inicio**: la usa como material de esa pantalla.

Los archivos del Explorador de archivos se pueden soltar sobre la galería, sobre un tablero, sobre un marco de imagen de referencia, sobre una tarjeta de la pantalla de inicio, etc.

## Atajos de teclado de la galería

| Acción | Tecla |
|---|---|
| Elegir la imagen anterior, siguiente, superior o inferior | Teclas de flecha (`Shift` amplía el rango) |
| Elegir todo | `Ctrl+A` |
| Anular la selección | `Esc` |
| Eliminar las imágenes elegidas | `Delete` |
| Copiar la imagen del visor | `Ctrl+C` |
| Abrir y cerrar el panel de información | `I` |
| Remezclar, prompt, semilla, todo | `R`, `P`, `S`, `A` |
| Cargar el flujo de trabajo | `W` |
| Enviar a la ampliación | `Shift+U` |
| Iniciar y detener la comparación | `C` |
| Ajustar a la pantalla, tamaño real | `Ctrl+0`, `Ctrl+1` |
| Acercar, alejar | `+`, `-` |

Estos atajos funcionan cuando el cursor está sobre la galería o cuando el centro es el visor. La lista también se puede ver en «{{ui:app.nav.hotkeys}}», dentro del menú de **{{ui:app.nav.settings}}**.
