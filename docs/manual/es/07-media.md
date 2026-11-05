# Vídeo, música, voz, logotipos y texto

Además de imágenes, novira puede crear vídeo, música, voz y logotipos, y también permite añadir texto y bocadillos de diálogo a las imágenes.

Todo ello se usa desde el panel izquierdo de la pestaña **{{ui:app.tabs.generate}}**. Para saber cómo se usan las imágenes, conviene leer antes [Crear imágenes](02-generate.md).

## Cambiar lo que se crea

En la parte superior del panel izquierdo hay una fila formada solo por iconos. De izquierda a derecha son **{{ui:media.tab.image}}**, **{{ui:media.tab.video}}**, **{{ui:media.tab.music}}**, **{{ui:media.tab.voice}}**, **{{ui:media.tab.logo}}**, **{{ui:media.tab.text}}** y **{{ui:app.tabs.comic}}**. Las páginas de cómic se crean con el último ([Dibujar un cómic](12-comic.md)).

Al pasar el ratón sobre un icono se muestra su nombre. Al cambiar, el panel izquierdo y la vista central pasan a ser los de ese tipo.

## Funciones comunes

Las pantallas de vídeo, música, voz y logotipos tienen la misma disposición.

- En la parte superior del panel izquierdo hay un **{{ui:presets.label}}** que permite recuperar de una vez todo un conjunto de ajustes.
- Debajo está el botón que inicia la creación. Si falta algo, el botón no se puede pulsar y el motivo aparece justo debajo.
- Cuando el motivo dice algo como «Descargue primero el modelo de música», se instala desde la **tarjeta del modelo** que aparece a continuación.
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

Los tamaños son aproximados. Para conocer el tamaño exacto, consulte el número que aparece en la tarjeta.

Para el vídeo se puede elegir entre dos modelos, el estándar y el rápido. La tarjeta muestra el nombre y la memoria de la GPU de este PC y lo bien que encaja cada modelo (**{{ui:media.choice.fit.comfortable}}**, **{{ui:media.choice.fit.tight}}** o **{{ui:media.choice.fit.short}}**). El modelo que mejor se adapta a este PC lleva la marca **{{ui:media.choice.recommended}}**. Cuando no se puede leer la memoria de la GPU, el encaje se muestra como **{{ui:media.choice.fit.unknown}}**. Son orientaciones aproximadas: incluso un modelo marcado como **{{ui:media.choice.fit.short}}** puede funcionar, solo que más despacio.

La descarga se hace una sola vez, al principio. El progreso se muestra en la tarjeta y, en cualquier pantalla, en el cuadro «{{ui:media.downloads.title}}» de la parte inferior izquierda, donde también se puede pulsar **{{ui:common.cancel}}** a mitad de camino. Si falla, el motivo aparece en la tarjeta y el botón cambia a **{{ui:pack.retry}}**.

Cuando se conoce el tamaño de una descarga, también se muestra el tiempo restante («quedan unos 2 min»; se calcula a partir de la velocidad de descarga, así que no aparece en los primeros instantes). Cuando no se conoce el tamaño, o mientras se prepara una extensión, se muestra en su lugar el tiempo transcurrido desde que empezó. En la descarga de una extensión, **{{ui:media.downloads.manage}}** en el cuadro abre la lista de extensiones instaladas.

Cuando termina la instalación, la tarjeta desaparece. Solo en el caso de la voz, el motor de lectura en voz alta se instala junto con el resto, por lo que tarda un poco más.

> Antes de descargar, el motor que crea las imágenes (ComfyUI) debe haber terminado de prepararse. Si algo no va bien, consulte [Solución de problemas](10-troubleshooting.md).

## Crear vídeo

![La pantalla de vídeo. A la izquierda, los ajustes como el método, la descripción y el tamaño; en el centro, la lista de vídeos creados](shot:media-video)

Para el vídeo hay una forma de crearlo a partir de texto y otra de animar una sola imagen.

### Cómo se crea

1. Elija **{{ui:media.tab.video}}** en el panel izquierdo.
2. Si es la primera vez, pulse **{{ui:pack.install}}** en la tarjeta **{{ui:pack.title.video}}**.
3. Con **{{ui:video.mode.label}}**, elija **{{ui:video.mode.text}}** o **{{ui:video.mode.image}}**.
4. En **{{ui:video.prompt}}**, escriba qué tipo de vídeo quiere. Si lo crea a partir de una imagen, escriba cómo quiere que se mueva.
5. Pulse **{{ui:params.invoke.invoke}}**.

Al elegir **{{ui:video.mode.image}}**, aparece un campo para indicar la imagen que se quiere animar. Suelte una imagen en él, o elija una imagen en la galería y pulse **{{ui:video.pickFromGallery}}**.

También se puede hacer clic derecho en una imagen de la galería y elegir **{{ui:gallery.menu.sendToVideo}}**.

### Ajustes

| Elemento | Qué es |
|---|---|
| {{ui:video.negative}} | Elementos que no quiere que aparezcan. Ya vienen escritas desde el principio palabras que evitan el desenfoque, el texto y similares |
| {{ui:video.model}} | **{{ui:video.model.standard}}** lo crea con esmero. **{{ui:video.model.fast}}** puede crearlo en poco tiempo, pero los detalles pueden quedar toscos |
| {{ui:video.size}} | El tamaño del vídeo. Al principio es 832×480. También se puede elegir vertical y cuadrado |
| {{ui:video.fps}} | El número de fotogramas por segundo (de 8 a 30) |
| {{ui:video.lengthLabel}} | De 1 a 10 segundos. El número de fotogramas se decide automáticamente a partir de la duración y la tasa de fotogramas |
| {{ui:video.steps}}, {{ui:video.cfg}} | Ajustes finos del resultado. Al elegir un modelo, cambian a valores que le convienen |
| {{ui:params.seed.label}} | En la fila cercana a la parte superior, el dado ({{ui:params.seed.random}}) usa una semilla nueva cada vez, y el candado ({{ui:params.seed.fixed}}) conserva la semilla para poder recrear el mismo movimiento |

Para usar **{{ui:video.model.fast}}**, hay que descargar **{{ui:pack.title.turbo}}** por separado. Este modelo tiene una licencia no comercial.

La lista **{{ui:video.model}}** también contiene los modelos de vídeo que haya instalado: se admiten los modelos Wan 2.1 y Wan 2.2 (incluido VACE), HunyuanVideo y HunyuanVideo 1.5, LTX-Video y LTX-2. Al elegir uno se aplican los pasos, el CFG, la tasa de fotogramas y el tamaño que le convienen, y no hace falta descargar los modelos de vídeo. El codificador de texto y el VAE se buscan por nombre entre los modelos instalados; si falta alguno, la generación falla y muestra qué archivo se necesita (los modelos iniciales de la pantalla Modelos, **{{ui:models.install.tab.starter}}**, los instalan juntos).

- Un modelo Wan de texto a vídeo no puede animar una imagen; para animar una, elija un modelo Wan de imagen a vídeo.
- Wan 2.2 14B viene en un par de archivos, de ruido alto y de ruido bajo. Elija el archivo de ruido alto y se usará junto con su pareja de ruido bajo.
- HunyuanVideo (1.0 y 1.5) y LTX-Video funcionan a partir de texto y de una imagen (HunyuanVideo 1.0 necesita su modelo de imagen a vídeo y el archivo de visión `llava_llama3_vision`). LTX-2 también crea sonido, que se incorpora al clip.
- Un modelo Wan VACE admite una imagen como referencia para el clip; un modelo Wan 2.1 de imagen a vídeo necesita además su archivo CLIP-vision (`clip_vision_h`), que instalan los modelos iniciales.
- Los modelos Wan que necesitan un vídeo de control, audio, una trayectoria de cámara o un vídeo de pose (Fun Control, S2V, Animate y similares) no se pueden ejecutar aquí; la generación falla e indica lo que necesitan.

### Cuando la GPU tiene poca memoria

Bajo **{{ui:video.light.title}}** hay dos interruptores.

- **{{ui:video.light.fp8}}**: La memoria que usa el modelo se reduce casi a la mitad. Los detalles pueden quedar algo más toscos.
- **{{ui:video.light.tiled}}**: Evita que la memoria aumente de golpe en el último paso de acabado. La calidad no cambia, y es algo más lento.

Si aun así no basta, también se puede crear con un tamaño menor y luego ampliar el vídeo terminado con **{{ui:video.finish}}**.

### Resultados

Un vídeo tarda desde unos minutos hasta más de diez. Cuando termina, aparece en el centro como una lista de vídeos y se puede reproducir allí mismo. También entra en la galería de la derecha como una miniatura con un ▶.

Bajo cada vídeo se muestran la descripción, el tamaño, la duración y la semilla. Se puede borrar con el botón de la papelera.

Al pulsar **{{ui:video.finish}}**, se abre la pantalla **{{ui:finish.title}}**.

- **{{ui:finish.smooth.title}}**: Rellena entre fotogramas para que el movimiento sea más suave.
- **{{ui:finish.enlarge.title}}**: Amplía el vídeo con un modelo de ampliación. Usa mucho tiempo y memoria.

El vídeo original se queda como está, y el vídeo acabado se añade como uno nuevo. Para rellenar fotogramas puede hacer falta una extensión (siga las indicaciones de la pantalla y pulse **{{ui:finish.install}}**).

## Crear música

![La pantalla de música. A la izquierda se alinean ajustes como el estilo, la letra, la duración y el tempo](shot:media-music)

Crea una canción a partir de texto (el estilo) y de la letra.

### Cómo se crea

1. Elija **{{ui:media.tab.music}}** en el panel izquierdo.
2. Si es la primera vez, pulse **{{ui:pack.install}}** en la tarjeta **{{ui:pack.title.music}}**.
3. En **{{ui:music.tags}}**, escriba el género, el ambiente y los instrumentos separados por comas. Por ejemplo, algo como `upbeat J-pop, female vocal, piano, bright`.
4. Si quiere una canción con voz, escriba la **{{ui:music.lyrics}}**. Si no quiere voz, marque **{{ui:music.instrumental}}**.
5. Pulse **{{ui:params.invoke.invoke}}**.

El estilo es obligatorio. Si se deja vacío, no se puede crear.

La letra se puede escribir con marcas de sección entre corchetes, como `[verse]` y `[chorus]`. Se puede escribir en inglés, japonés, chino y más. Elija el idioma de la letra con **{{ui:music.language}}**. Si no está seguro, elija **{{ui:music.lang.unknown}}**.

### Ajustes

| Elemento | Qué es |
|---|---|
| {{ui:music.lengthLabel}} | De 10 a 240 segundos |
| {{ui:music.bpm}} | La velocidad de la canción (de 40 a 220) |
| {{ui:music.timeSignature}} | 2/4, 3/4, 4/4, 6/4 |
| {{ui:music.key}} | De `C major` a `B minor` |
| {{ui:music.steps}}, {{ui:music.cfg}} | Ajustes finos del resultado |

### Resultados

Una canción tarda desde algunas decenas de segundos hasta unos minutos, y aparece en la lista del centro. Cada una tiene un reproductor y se puede escuchar allí mismo. Se muestran la duración, el tempo, la tonalidad y la semilla, y si hay letra, se puede abrir **{{ui:audio.lyrics}}** para consultarla.

También entra en la galería con una miniatura de nota musical.

## Crear voz

![La pantalla de voz. A la izquierda se alinean el texto que se leerá en voz alta, el idioma y la forma de elegir la voz](shot:media-voice)

Lee en voz alta, como una voz, el texto que se introduce.

### Cómo se crea

1. Elija **{{ui:media.tab.voice}}** en el panel izquierdo.
2. Si es la primera vez, pulse **{{ui:pack.install}}** en la tarjeta **{{ui:pack.title.voice}}**. El motor y los modelos de lectura en voz alta se instalan solo dentro de la carpeta de la aplicación.
3. En **{{ui:voice.text}}**, introduzca el texto que quiere que se lea en voz alta.
4. Elija el **{{ui:voice.language}}**. Con **{{ui:voice.lang.Auto}}**, se determina a partir del texto.
5. Decida la voz (véase más abajo).
6. Pulse **{{ui:params.invoke.invoke}}**.

### Cómo decidir la voz

Bajo **{{ui:voice.mode.label}}** se puede elegir entre dos métodos.

- **{{ui:voice.mode.preset}}**: Elija entre las voces preparadas. Hay voces como una mujer japonesa, chino, un hombre inglés y una mujer coreana, y tras el nombre se muestran el idioma y el género. Si escribe algo como «alegre y animada» o «lenta y tranquila» en **{{ui:voice.style}}**, también puede indicar cómo habla.
- **{{ui:voice.mode.design}}**: En **{{ui:voice.description}}**, escriba con palabras las características de la voz. Por ejemplo, algo como «Una voz masculina grave y tranquila. Habla despacio y con suavidad». La descripción es obligatoria.

Los idiomas que puede leer en voz alta son japonés, inglés, chino, coreano, alemán, francés, ruso, portugués, español e italiano.

### Resultados

La voz terminada aparece en la lista del centro con un reproductor. También se muestran la voz utilizada (cuando es {{ui:audio.voice.designed}}, aparece «{{ui:audio.voice.designed}}») y el idioma. También entra en la galería.

La primera generación tarda un poco en cargar el modelo. Si no se usa durante un tiempo, el modelo se retira de la GPU y la memoria vuelve a quedar libre para otros trabajos.

## Crear logotipos

![La pantalla de logotipos. A la izquierda se alinean el texto del logotipo, el estilo, la forma y el número de candidatos](shot:media-logo)

Crea candidatos de logotipo con texto dentro.

### Cómo se crea

1. Elija **{{ui:media.tab.logo}}** en el panel izquierdo.
2. Si es la primera vez, pulse **{{ui:pack.install}}** en la tarjeta **{{ui:pack.title.logo}}**.
3. En **{{ui:logo.text}}**, introduzca el texto que irá en el logotipo (hasta 60 caracteres).
4. En **{{ui:logo.style}}**, escriba el ambiente, los colores y la forma. Vale en japonés o en inglés. Por ejemplo, algo como «minimal, blue and white, geometric».
5. Con **{{ui:logo.size}}**, elija la forma entre **{{ui:logo.size.square}}**, **{{ui:logo.size.wide}}** y **{{ui:logo.size.tall}}**.
6. Elija el **{{ui:logo.countLabel}}** de 1 a 4 y pulse **{{ui:params.invoke.invoke}}**.

### Resultados y superposición de texto

Los logotipos creados aparecen en el centro como candidatos. En la galería entran en **{{ui:gallery.view.assets}}** y no en **{{ui:gallery.view.images}}**. Al abrir la pantalla de logotipos, la galería de la derecha cambia automáticamente a la vista de recursos.

El texto en inglés sale con exactitud, pero el japonés puede salir deformado. En ese caso, pulse **{{ui:logo.layText}}** en un candidato que le guste. Pasa a **{{ui:media.tab.text}}**, y ese logotipo se convierte en el fondo, de modo que se puede superponer el texto que se quiera.

## Texto (palabras y bocadillos de diálogo)

![La pantalla de texto. A la izquierda, los botones para añadir texto, el fondo, las capas y los estilos de texto; en el centro, la imagen que se está editando](shot:media-text)

**{{ui:media.tab.text}}** es una pantalla de edición donde se añaden texto y bocadillos de diálogo a una imagen y se guarda como imagen. No hace falta descargar ningún modelo. Tampoco usa el procesamiento que crea imágenes, así que se puede usar de inmediato.

### Decidir el fondo

Con **{{ui:text.bg.title}}** se elige sobre qué se coloca el texto.

- **{{ui:text.bg.image}}**: Usa una imagen como fondo. Muestre una imagen en la galería y pulse **{{ui:text.bg.useViewer}}**, o suelte una imagen en esta pantalla. Se guarda con el mismo tamaño que la imagen.
- **{{ui:text.bg.color}}**: Un fondo de un solo color. Para el tamaño, elija de la lista, como 1024×1024 o 1920×1080, o introduzca el ancho y el alto como números.
- **{{ui:text.bg.transparent}}**: Sin fondo. Se puede crear solo el texto como una imagen transparente.

También se puede hacer clic derecho en una imagen de la galería y elegir **{{ui:gallery.menu.sendToText}}**.

### Añadir texto y bocadillos

- **{{ui:text.add.text}}**: Añade una capa de texto.
- **{{ui:text.add.bubble}}**: Añade un bocadillo. Elija la forma entre **{{ui:text.shape.round}}**, **{{ui:text.shape.box}}**, **{{ui:text.shape.cloud}}**, **{{ui:text.shape.burst}}**, **{{ui:text.shape.whisper}}** y **{{ui:text.shape.narration}}**.

Lo que se añade se puede mover arrastrándolo por la pantalla. Al seleccionarlo, aparecen tiradores redondos en las cuatro esquinas, y se puede cambiar su tamaño arrastrándolos. Un bocadillo tiene una «{{ui:text.bubble.tail}}» (su cola), y su dirección se cambia arrastrando el tirador de la punta.

`Delete` elimina el elemento seleccionado, `Ctrl+D` lo duplica, las teclas de flecha lo mueven un poco cada vez, `Ctrl+Z` deshace y `Ctrl+Shift+Z` (o `Ctrl+Y`) rehace. Los botones **{{ui:text.undo}}** y **{{ui:text.redo}}** de la pantalla hacen lo mismo. El tamaño de visualización se cambia con **{{ui:text.zoom.in}}**, **{{ui:text.zoom.out}}** y **{{ui:text.zoom.fit}}**.

### Capas

El texto y los bocadillos que se añaden aparecen en **{{ui:text.layers.title}}** por orden de apilado. Cuanto más arriba en la lista, más cerca del frente.

De cada uno se puede **{{ui:text.layer.hide}}**, **{{ui:text.layer.lock}}**, cambiar el orden con **{{ui:text.layer.up}}** y **{{ui:text.layer.down}}**, **{{ui:text.layer.duplicate}}** y **{{ui:text.layer.delete}}**. **{{ui:text.layers.clear}}** los elimina todos de una vez.

### Ajustar el texto

Al seleccionar una capa, sus ajustes aparecen debajo.

| Elemento | Qué es |
|---|---|
| {{ui:text.content}} | Introduzca el texto (se pueden hacer saltos de línea) |
| {{ui:text.font}}, {{ui:text.weight}}, {{ui:text.size}} | Tipografía, grosor y tamaño. Las tipografías vienen con la aplicación, así que se ve igual en cualquier PC |
| {{ui:text.fill}} | **{{ui:text.fill.solid}}** o **{{ui:text.fill.gradient}}** (el color cambia de arriba abajo) |
| {{ui:text.stroke}}, {{ui:text.outline}} | El borde del texto, y un borde exterior a este |
| {{ui:text.shadow}} | Sombra. Se pueden elegir el color, el desenfoque y el desplazamiento |
| {{ui:text.letterSpacing}}, {{ui:text.lineHeight}}, {{ui:text.align}} | El espacio entre caracteres y entre líneas, y la alineación |
| {{ui:text.vertical}} | Pone la escritura en vertical. En la escritura vertical, la alineación cambia a «{{ui:text.align.top}}, {{ui:text.align.center}}, {{ui:text.align.bottom}}» |
| {{ui:text.bend}} | Curva el texto (no se puede usar con la escritura vertical) |
| {{ui:text.rotation}}, {{ui:text.opacity}} | Rotación y opacidad |

En los bocadillos también se pueden ajustar el tamaño, el color de relleno, el contorno y la punta. Con la forma **{{ui:text.shape.burst}}**, **{{ui:text.bubble.shuffle}}** cambia las puntas dentadas. Si activa **{{ui:text.bubble.autoFit}}**, el texto se reduce para que quepa dentro del bocadillo.

### Estilos predefinidos

El ajuste predefinido de la parte superior del panel izquierdo contiene estilos de aire logotipo: **{{ui:text.preset.plain}}**, **{{ui:text.preset.pop}}**, **{{ui:text.preset.sfx}}**, **{{ui:text.preset.gold}}**, **{{ui:text.preset.sticker}}** y **{{ui:text.preset.soft}}**. Si selecciona una capa de texto y luego usa uno, se aplica ese estilo.

También se pueden guardar estilos propios (tipografía, relleno, trazo, sombra, espaciado entre caracteres).

### Guardar

Cuando termine, pulse **{{ui:text.save}}**. Entra en la galería como una imagen PNG con el tamaño del fondo. Aunque se guarde, lo que se editó en la pantalla se conserva, así que se puede seguir corrigiendo.

## Ajustes predefinidos

Las pantallas de vídeo, música, voz, logotipos y texto también tienen ajustes predefinidos con la misma forma que los de las imágenes. Al elegir en **{{ui:presets.label}}**, en la parte superior izquierda de la pantalla, los ajustes que guardó se aplican de una vez.

Para guardar sus propios ajustes, pulse el botón de guardar junto al ajuste predefinido (**{{ui:presets.saveNew}}**) y póngale un nombre. Lo que guardó aparece bajo **{{ui:presets.group.mine}}**. Desde el menú «…» de cada elemento de la lista también se puede **{{ui:presets.overwrite}}**, **{{ui:presets.rename}}** y **{{ui:presets.delete}}**. Los preparados desde el principio están bajo **{{ui:presets.group.builtin}}**.

Lo que se guarda varía un poco según la pantalla.

| Pantalla | Qué se guarda | Qué no se guarda |
|---|---|---|
| Vídeo | La descripción, el modelo, el tamaño, la duración y los ajustes de calidad | La semilla y la imagen de origen |
| Música | Las etiquetas de estilo y los ajustes de la canción | La letra y la semilla |
| Voz | El idioma y la voz (voz y estilo de habla, o la descripción de la voz) | El texto que se leerá en voz alta |
| Logotipo | Las palabras de estilo, la forma y el número de candidatos | El texto que irá en el logotipo |
| Texto | El estilo del texto | El contenido del texto |

Los ajustes predefinidos que vienen con la aplicación son tres para el vídeo, «Quick preview», «Standard 832x480» y «Vertical, low VRAM»; dos para la música, «Lo-fi instrumental» y «J-pop song»; dos para la voz, «Calm narrator» y «Energetic announcer»; y cinco para los logotipos.

Para saber cómo buscar e instalar modelos, vaya a [Modelos](08-models.md).
