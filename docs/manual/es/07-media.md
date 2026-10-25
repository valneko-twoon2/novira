# Vídeo, música, voz, logotipos y texto

Además de imágenes, novira puede crear vídeo, música, voz y logotipos, y también permite añadir texto y bocadillos de diálogo a las imágenes.

Todo ello se usa desde el panel izquierdo de la pestaña **{{ui:app.tabs.generate}}**. Para saber cómo se usan las imágenes, conviene leer antes [Crear imágenes](02-generate.md).

## Cambiar lo que se crea

En la parte superior del panel izquierdo hay un selector formado solo por iconos. De izquierda a derecha son **{{ui:media.tab.image}}**, **{{ui:media.tab.video}}**, **{{ui:media.tab.music}}**, **{{ui:media.tab.voice}}**, **{{ui:media.tab.logo}}**, **{{ui:media.tab.text}}** y **{{ui:app.tabs.comic}}**. **{{ui:app.tabs.comic}}** es la pantalla para crear páginas de cómic ([Dibujar un cómic](12-comic.md)).

Al pasar el ratón sobre un icono se muestra su nombre. Al cambiar, el panel izquierdo y la vista central pasan a ser los de ese tipo.

## Funciones comunes

Las pantallas de vídeo, música, voz y logotipos tienen la misma forma.

- En la parte superior del panel izquierdo hay un **{{ui:presets.label}}** que permite recuperar de una vez todo un conjunto de ajustes.
- Debajo está el botón que inicia la creación. Si falta algo, el botón no se puede pulsar y el motivo aparece justo debajo.
- Cuando el motivo indica «Descargue primero el modelo de (lo que se crea)», se instala desde la **tarjeta del modelo** que aparece a continuación.
- En lugar del botón de inicio, también se puede crear con `Ctrl+Enter`.
- Mientras se crea, su estado (en espera, en creación, el motivo si falló) aparece en la parte superior de la pantalla central. Se puede detener con **{{ui:media.job.cancel}}**.

> Solo se crea una cosa a la vez. Mientras se crea un vídeo o música, las demás generaciones, como las de imágenes, esperan en la cola. Los elementos en espera también se pueden consultar en la pestaña **{{ui:app.tabs.queue}}**.

### Descargar primero los modelos necesarios

El vídeo, la música, la voz y los logotipos necesitan cada uno sus propios modelos. Si no están instalados, aparece una «tarjeta de modelo» en el panel izquierdo. Al pulsar **{{ui:pack.install}}**, la aplicación los trae automáticamente.

| Qué se crea | Nombre de la tarjeta | Tamaño aproximado |
|---|---|---|
| Vídeo | {{ui:pack.title.video}} | Unos 18 GB |
| Vídeo (versión rápida) | {{ui:pack.title.turbo}} | Los archivos compartidos con la versión estándar no se descargan dos veces |
| Música | {{ui:pack.title.music}} | Unos 10 GB |
| Voz | {{ui:pack.title.voice}} | Unos 9 GB |
| Logotipo | {{ui:pack.title.logo}} | Unos 12 GB |

Los tamaños son aproximados. Para conocer el tamaño exacto, hay que fijarse en el número que muestra la tarjeta.

Para el vídeo se puede elegir entre dos modelos, el estándar y el rápido. La tarjeta muestra el nombre y la memoria de la GPU de este PC y lo bien que se adapta cada modelo (**{{ui:media.choice.fit.comfortable}}**, **{{ui:media.choice.fit.tight}}** o **{{ui:media.choice.fit.short}}**). El modelo adecuado para este PC está marcado como **{{ui:media.choice.recommended}}**. Cuando no se puede leer la memoria de la GPU, la adaptación se muestra como **{{ui:media.choice.fit.unknown}}**. Son orientaciones aproximadas: incluso un modelo marcado como **{{ui:media.choice.fit.short}}** puede funcionar, solo que más despacio.

La descarga se hace una sola vez, al principio. El progreso se muestra en la tarjeta y, en cualquier pantalla, en el recuadro «{{ui:media.downloads.title}}» de la parte inferior izquierda, donde también se puede pulsar **{{ui:common.cancel}}** a mitad de camino. Si falla, el motivo aparece en la tarjeta y el botón cambia a **{{ui:pack.retry}}**.

Cuando se conoce el tamaño de una descarga, también se muestra el tiempo restante («Faltan unos 2 min»; se calcula a partir de la velocidad de descarga, por lo que no aparece en los primeros momentos). Cuando no se conoce el tamaño, o mientras se prepara una extensión, se muestra en su lugar el tiempo transcurrido desde el inicio. En la descarga de una extensión, **{{ui:media.downloads.manage}}** en el recuadro abre la lista de extensiones instaladas.

Cuando termina la instalación, la tarjeta desaparece. Solo en la voz se instala también el motor de lectura en voz alta, por lo que tarda un poco más.

> Antes de descargar, el motor que crea las imágenes (ComfyUI) debe haber terminado de prepararse. Si algo no va bien, véase [Solución de problemas](10-troubleshooting.md).

## Crear vídeo

![La pantalla de vídeo. A la izquierda, ajustes como el método, el prompt y el tamaño, y en el centro, la lista de vídeos creados](shot:media-video)

Para el vídeo hay una forma de crearlo a partir de texto y otra de animar una sola imagen.

### Cómo crearlo

1. Elegir **{{ui:media.tab.video}}** en el panel izquierdo.
2. Si es la primera vez, pulsar **{{ui:pack.install}}** en la tarjeta **{{ui:pack.title.video}}**.
3. En **{{ui:video.mode.label}}**, elegir **{{ui:video.mode.text}}** o **{{ui:video.mode.image}}**.
4. En **{{ui:video.prompt}}**, escribir qué tipo de vídeo se quiere. Al crear a partir de una imagen, escribir cómo se quiere que se mueva.
5. Pulsar **{{ui:params.invoke.invoke}}**.

Al elegir **{{ui:video.mode.image}}**, aparece un campo para indicar la imagen que se va a animar. Se puede soltar una imagen, o elegir una imagen de la galería y pulsar **{{ui:video.pickFromGallery}}**.

También se puede hacer clic con el botón derecho en una imagen de la galería y elegir **{{ui:gallery.menu.sendToVideo}}**.

### Ajustes

| Elemento | Qué es |
|---|---|
| {{ui:video.negative}} | Elementos que no se quieren. Desde el principio ya hay palabras introducidas que evitan el desenfoque, el texto y similares |
| {{ui:video.model}} | **{{ui:video.model.standard}}** lo crea con esmero. **{{ui:video.model.fast}}** puede crearlo en poco tiempo, pero los detalles pueden quedar toscos |
| {{ui:video.size}} | El tamaño del vídeo. Al principio es 832×480. También se puede elegir vertical y cuadrado |
| {{ui:video.fps}} | El número de fotogramas por segundo (de 8 a 30) |
| {{ui:video.lengthLabel}} | De 1 a 10 segundos. El número de fotogramas se decide automáticamente a partir de la duración y la velocidad de fotogramas |
| {{ui:video.steps}}, {{ui:video.cfg}} | Ajustes finos del resultado. Al elegir un modelo, cambian a valores adecuados para ese modelo |
| {{ui:video.randomSeed}} | Si se desactiva, se puede decidir la semilla y recrear el mismo movimiento |

Para usar **{{ui:video.model.fast}}**, hay que descargar **{{ui:pack.title.turbo}}** por separado. Este modelo tiene una licencia no comercial.

### Cuando la GPU tiene poca memoria

Bajo **{{ui:video.light.title}}** hay dos interruptores.

- **{{ui:video.light.fp8}}**: la memoria que usa el modelo se reduce casi a la mitad. Los detalles pueden quedar algo más toscos.
- **{{ui:video.light.tiled}}**: evita que la memoria aumente de golpe en el paso final de acabado. La calidad no cambia, y es algo más lento.

Si aun así no basta, también se puede crear con un tamaño más pequeño y ampliar el vídeo terminado con **{{ui:video.finish}}**.

### Resultados

Un vídeo tarda desde unos minutos hasta más de diez minutos. Cuando termina, se coloca como una lista de vídeos en el centro y se puede reproducir allí mismo. También pasa a la galería de la derecha como una miniatura con un ▶.

Bajo cada vídeo se muestran el prompt, el tamaño, la duración y la semilla. Se puede eliminar con el botón de la papelera.

Al pulsar **{{ui:video.finish}}**, se abre la pantalla **{{ui:finish.title}}**.

- **{{ui:finish.smooth.title}}**: rellena entre fotogramas para que el movimiento sea más fluido.
- **{{ui:finish.enlarge.title}}**: amplía el vídeo con un modelo de ampliación. Usa mucho tiempo y memoria.

El vídeo original se queda como está, y el vídeo terminado se añade como uno nuevo. Para rellenar fotogramas puede hacer falta una extensión (se sigue la guía de la pantalla y se pulsa **{{ui:finish.install}}**).

## Crear música

![La pantalla de música. A la izquierda se alinean ajustes como el estilo, la letra, la duración y el tempo](shot:media-music)

Crea una canción a partir de texto (el estilo) y una letra.

### Cómo crearla

1. Elegir **{{ui:media.tab.music}}** en el panel izquierdo.
2. Si es la primera vez, pulsar **{{ui:pack.install}}** en la tarjeta **{{ui:pack.title.music}}**.
3. En **{{ui:music.tags}}**, escribir el género, el ambiente y los instrumentos separados por comas. Por ejemplo, algo como `upbeat J-pop, female vocal, piano, bright`.
4. Si se quiere una canción con voz, escribir la **{{ui:music.lyrics}}**. Si se quiere sin voz, marcar **{{ui:music.instrumental}}**.
5. Pulsar **{{ui:params.invoke.invoke}}**.

El estilo es obligatorio. Si se deja vacío, no se puede crear.

La letra se puede escribir con marcadores de sección entre corchetes, como `[verse]` (estrofa) y `[chorus]` (estribillo). Se puede escribir en inglés, japonés, chino y más. El idioma de la letra se elige con **{{ui:music.language}}**. Si hay dudas, se elige **{{ui:music.lang.unknown}}**.

### Ajustes

| Elemento | Qué es |
|---|---|
| {{ui:music.lengthLabel}} | De 10 a 240 segundos |
| {{ui:music.bpm}} | La velocidad de la canción (de 40 a 220) |
| {{ui:music.timeSignature}} | 2/4, 3/4, 4/4, 6/4 |
| {{ui:music.key}} | De `C major` a `B minor` |
| {{ui:music.steps}}, {{ui:music.cfg}} | Ajustes finos del resultado |

### Resultados

Una canción tarda desde varias decenas de segundos hasta unos minutos, y se coloca en la lista del centro. Cada una tiene un reproductor y se puede reproducir allí mismo. Se muestran la duración, el tempo, la tonalidad y la semilla, y cuando hay letra, se puede abrir **{{ui:audio.lyrics}}** para consultarla.

También pasa a la galería con una miniatura de nota musical.

## Crear voz

![La pantalla de voz. A la izquierda se alinean el texto que se va a leer en voz alta, el idioma y la forma de elegir una voz](shot:media-voice)

Convierte en voz el texto introducido y lo lee en voz alta.

### Cómo crearla

1. Elegir **{{ui:media.tab.voice}}** en el panel izquierdo.
2. Si es la primera vez, pulsar **{{ui:pack.install}}** en la tarjeta **{{ui:pack.title.voice}}**. El motor y los modelos para la lectura en voz alta se guardan solo en la carpeta de la aplicación.
3. En **{{ui:voice.text}}**, introducir el texto que se quiere leer en voz alta.
4. Elegir el **{{ui:voice.language}}**. Con **{{ui:voice.lang.Auto}}**, se determina a partir del texto.
5. Decidir la voz (véase más abajo).
6. Pulsar **{{ui:params.invoke.invoke}}**.

### Cómo decidir la voz

Bajo **{{ui:voice.mode.label}}** se puede elegir entre dos métodos.

- **{{ui:voice.mode.preset}}**: se elige entre las voces preparadas. Hay voces como japonés (mujer), chino, inglés (hombre) y coreano (mujer), y el idioma y el género se muestran tras el nombre. Si en **{{ui:voice.style}}** se escribe algo como «alegre y animada» o «lenta y tranquila», también se puede indicar cómo habla.
- **{{ui:voice.mode.design}}**: en **{{ui:voice.description}}**, se escriben con palabras las características de la voz. Por ejemplo, algo como «Una voz masculina grave y tranquila. Habla despacio y con suavidad». La descripción es obligatoria.

Los idiomas que puede leer en voz alta son japonés, inglés, chino, coreano, alemán, francés, ruso, portugués, español e italiano.

### Resultados

La voz terminada se coloca en la lista del centro con un reproductor. También se muestran la voz utilizada (para una voz creada a partir de palabras, «{{ui:audio.voice.designed}}») y el idioma. También pasa a la galería.

La primera generación tarda un poco en cargar el modelo. Si no se usa durante un tiempo, el modelo se retira de la GPU y la memoria vuelve a otros trabajos.

## Crear logotipos

![La pantalla de logotipos. A la izquierda se alinean el texto del logotipo, el estilo, la forma y el número de candidatos](shot:media-logo)

Crea candidatos de logotipo que contienen texto.

### Cómo crearlos

1. Elegir **{{ui:media.tab.logo}}** en el panel izquierdo.
2. Si es la primera vez, pulsar **{{ui:pack.install}}** en la tarjeta **{{ui:pack.title.logo}}**.
3. En **{{ui:logo.text}}**, introducir el texto que irá en el logotipo (hasta 60 caracteres).
4. En **{{ui:logo.style}}**, escribir el ambiente, los colores y la forma. Se puede escribir en japonés o en inglés. Por ejemplo, algo como «minimalista, azul y blanco, geométrico».
5. Con **{{ui:logo.size}}**, elegir la forma entre **{{ui:logo.size.square}}**, **{{ui:logo.size.wide}}** y **{{ui:logo.size.tall}}**.
6. Elegir el número de **{{ui:logo.countLabel}}** entre 1 y 4 y pulsar **{{ui:params.invoke.invoke}}**.

### Resultados y superposición de texto

Los logotipos creados se colocan en el centro como candidatos. En la galería, pasan a **{{ui:gallery.view.assets}}** en lugar de **{{ui:gallery.view.images}}**. Al abrir la pantalla de logotipos, la galería de la derecha cambia automáticamente a la vista de recursos.

El texto en inglés sale con precisión, pero el japonés puede salir deformado. En ese caso, se pulsa **{{ui:logo.layText}}** en un candidato que le guste. Cambia a **{{ui:media.tab.text}}**, y ese logotipo pasa a ser el fondo, de modo que se puede superponer el texto que se quiera.

## Texto (palabras y bocadillos)

![La pantalla de texto. A la izquierda, los botones para añadir texto, el fondo, las capas y los estilos de texto; en el centro, la imagen que se edita](shot:media-text)

**{{ui:media.tab.text}}** es una pantalla de edición en la que se añaden texto y bocadillos a una imagen y se guarda como imagen. No hace falta descargar ningún modelo. Tampoco usa el procesamiento que crea imágenes, por lo que se puede usar de inmediato.

### Decidir el fondo

Con **{{ui:text.bg.title}}** se elige sobre qué se coloca el texto.

- **{{ui:text.bg.image}}**: usa una imagen como fondo. Se muestra una imagen en la galería y se pulsa **{{ui:text.bg.useViewer}}**, o se suelta una imagen sobre esta pantalla. Se guarda con el mismo tamaño que la imagen.
- **{{ui:text.bg.color}}**: un fondo de un solo color. Para el tamaño, se elige de la lista, como 1024×1024 o 1920×1080, o se introducen el ancho y el alto como números.
- **{{ui:text.bg.transparent}}**: sin fondo. Se puede crear solo el texto como una imagen transparente.

También se puede hacer clic con el botón derecho en una imagen de la galería y elegir **{{ui:gallery.menu.sendToText}}**.

### Añadir texto y bocadillos

- **{{ui:text.add.text}}**: añade una capa de texto.
- **{{ui:text.add.bubble}}**: añade un bocadillo. La forma se elige entre **{{ui:text.shape.round}}**, **{{ui:text.shape.box}}**, **{{ui:text.shape.cloud}}**, **{{ui:text.shape.burst}}**, **{{ui:text.shape.whisper}}** y **{{ui:text.shape.narration}}**.

Lo que se añade se puede mover arrastrándolo por la pantalla. Al seleccionarlo, aparecen tiradores redondos en las cuatro esquinas, y se puede cambiar su tamaño arrastrándolos. Un bocadillo tiene una «{{ui:text.bubble.tail}}», y su dirección se cambia arrastrando el tirador de la punta.

`Delete` elimina, `Ctrl+D` duplica, las teclas de flecha lo mueven un poco cada vez, `Ctrl+Z` deshace y `Ctrl+Shift+Z` (o `Ctrl+Y`) rehace. Los botones **{{ui:text.undo}}** y **{{ui:text.redo}}** de la pantalla hacen lo mismo. El tamaño de visualización se puede cambiar con **{{ui:text.zoom.in}}**, **{{ui:text.zoom.out}}** y **{{ui:text.zoom.fit}}**.

### Capas

El texto y los bocadillos que se añaden se enumeran en **{{ui:text.layers.title}}** por orden de apilamiento. Cuanto más arriba en la lista, más cerca del frente.

Para cada uno se puede **{{ui:text.layer.hide}}**, **{{ui:text.layer.lock}}**, cambiar el orden con **{{ui:text.layer.up}}** y **{{ui:text.layer.down}}**, **{{ui:text.layer.duplicate}}** y **{{ui:text.layer.delete}}**. **{{ui:text.layers.clear}}** los quita todos de una vez.

### Ajustar el texto

Al seleccionar una capa, sus ajustes aparecen debajo.

| Elemento | Qué es |
|---|---|
| {{ui:text.content}} | Introducir el texto (se pueden hacer saltos de línea) |
| {{ui:text.font}}, {{ui:text.weight}}, {{ui:text.size}} | Tipo de letra, grosor y tamaño. Los tipos de letra vienen con la aplicación, por lo que se ve igual en cualquier PC |
| {{ui:text.fill}} | **{{ui:text.fill.solid}}** o **{{ui:text.fill.gradient}}** (el color cambia de arriba abajo) |
| {{ui:text.stroke}}, {{ui:text.outline}} | El borde del texto y un borde exterior a este |
| {{ui:text.shadow}} | Sombra. Se pueden elegir el color, el desenfoque y el desplazamiento |
| {{ui:text.letterSpacing}}, {{ui:text.lineHeight}}, {{ui:text.align}} | El espaciado entre caracteres y entre líneas, y la alineación |
| {{ui:text.vertical}} | Lo convierte en escritura vertical. En la escritura vertical, la alineación pasa a «{{ui:text.align.top}}, {{ui:text.align.center}}, {{ui:text.align.bottom}}» |
| {{ui:text.bend}} | Curva el texto (no se puede usar con la escritura vertical) |
| {{ui:text.rotation}}, {{ui:text.opacity}} | Rotación y opacidad |

En los bocadillos también se pueden ajustar el tamaño, el color de relleno, el contorno y la cola. Con la forma **{{ui:text.shape.burst}}**, **{{ui:text.bubble.shuffle}}** cambia las puntas dentadas. Si se activa **{{ui:text.bubble.autoFit}}**, el texto se reduce para que quepa dentro del bocadillo.

### Preajustes de estilo

El preajuste de la parte superior del panel izquierdo contiene estilos de tipo logotipo: **{{ui:text.preset.plain}}**, **{{ui:text.preset.pop}}**, **{{ui:text.preset.sfx}}**, **{{ui:text.preset.gold}}**, **{{ui:text.preset.sticker}}** y **{{ui:text.preset.soft}}**. Si se selecciona una capa de texto y después se usa uno, se aplica ese estilo.

También se pueden guardar estilos propios (tipo de letra, relleno, trazo, sombra, espaciado entre letras).

### Guardar

Cuando está terminado, se pulsa **{{ui:text.save}}**. Pasa a la galería como imagen PNG con el tamaño del fondo. Incluso después de guardar, lo editado en la pantalla se conserva, por lo que se puede seguir corrigiendo.

## Preajustes

Las pantallas de vídeo, música, voz, logotipos y texto también tienen preajustes de la misma forma que para las imágenes. Al elegir en **{{ui:presets.label}}**, en la parte superior izquierda de la pantalla, los ajustes guardados se introducen de una vez.

Para guardar ajustes propios, se pulsa el botón de guardar situado junto al preajuste (**{{ui:presets.saveNew}}**) y se le da un nombre. Lo guardado se enumera en **{{ui:presets.group.mine}}**. Desde el menú «…» de cada elemento de la lista, también se puede **{{ui:presets.overwrite}}**, **{{ui:presets.rename}}** y **{{ui:presets.delete}}**. Los preajustes que vienen con la aplicación están en **{{ui:presets.group.builtin}}** (los nombres están en inglés).

Lo que se guarda difiere ligeramente según la pantalla.

| Pantalla | Qué se guarda | Qué no se guarda |
|---|---|---|
| Vídeo | El prompt, el modelo, el tamaño, la duración y los ajustes de calidad | La semilla y la imagen de origen |
| Música | Las etiquetas de estilo y los ajustes de la canción | La letra y la semilla |
| Voz | El idioma y la voz (la voz y el estilo de habla, o la descripción de la voz) | El texto que se va a leer en voz alta |
| Logotipo | Las palabras de estilo, la forma y el número de candidatos | El texto que irá en el logotipo |
| Texto | El estilo del texto | El contenido del texto |

Los preajustes que vienen con la aplicación son tres para vídeo, «Quick preview», «Standard 832x480» y «Vertical, low VRAM»; dos para música, «Lo-fi instrumental» y «J-pop song»; dos para voz, «Calm narrator» y «Energetic announcer»; y cinco para logotipos.

Para saber cómo buscar e instalar modelos, véase [Modelos](08-models.md).
