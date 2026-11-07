# El agente, los ajustes y los atajos

Este capítulo explica el agente que configura las cosas por usted cuando se lo dice con palabras, la pantalla de ajustes, la lista de atajos de teclado, la pantalla con información sobre la aplicación y el registro para desarrolladores.

La pantalla de ajustes, los atajos de teclado y la información sobre la aplicación se abren desde **{{ui:app.nav.settingsMenu}}**, en la parte inferior izquierda de la pantalla.

## El agente

![El agente en el panel derecho. La primera pantalla, donde se elige qué IA usar e iniciar sesión](shot:agent)

Pulse la pestaña **{{ui:app.right.assistant}}** de la parte superior del panel derecho, y el **{{ui:agent.title}}** ocupa el lugar de la galería. Está en las pantallas {{ui:app.tabs.generate}}, {{ui:app.tabs.canvas}}, {{ui:app.tabs.upscaling}} y {{ui:app.tabs.workflows}}, y el chat y el mensaje que está escribiendo se conservan al pasar de una a otra. La pestaña **{{ui:app.right.gallery}}** devuelve la galería. Cuando le pregunta algo al agente desde la pantalla {{ui:app.nav.extensions}}, se abre en una ventana sobre la pantalla. La ventana se muestra solo en la pantalla desde la que preguntó: no le sigue a las pantallas {{ui:app.tabs.models}}, {{ui:app.tabs.browse}} u otras. Puede mover la ventana arrastrando su encabezado.

En lugar de elegir usted mismo los modelos y los LoRA o fijar el prompt y el tamaño, le dice con palabras lo que quiere crear, como «una chica de estilo anime de pie en una playa al atardecer», y el agente elige los ajustes y los rellena por usted.

### Primeros pasos (iniciar sesión)

novira no ejecuta por sí misma una IA para el agente. Llama a un comando de IA que está en su ordenador (Claude o Codex) para producir las respuestas. Para usarlo, necesita la siguiente preparación.

1. Instale en su ordenador uno de los comandos: **Claude**, de Anthropic, o **Codex**, de OpenAI.
2. Abra el agente y pulse el que quiera usar (**{{ui:agent.setup.claude}}** o **{{ui:agent.setup.codex}}**).
3. Se abre un navegador, y allí inicia sesión.

Si ese comando no se encuentra en su ordenador, aparece un mensaje que dice «No se encontró el comando … en este PC. Instálelo primero».

El servicio que use, y su contrato con él, son los del que haya elegido. Con Claude y Codex, novira no guarda claves de API. Lo que se intercambia (el texto que envió y lo que el agente leyó en la aplicación para su trabajo, como la lista de modelos, los ajustes y el cómic o el texto que está abierto) se envía al servicio que eligió. La información de las imágenes de la galería y los prompts de la pestaña Generar se leen solo cuando usted lo permite (véase «Permiso para leer imágenes y prompts» más abajo).

La IA que eligió se muestra en la fila superior del agente. Si quiere cambiarla, pulse el botón **{{ui:agent.changeProvider}}** a la derecha de esa fila.

### Conectar con Ollama u otro servidor

![El formulario para conectar con un servidor. El botón de Ollama, la dirección, el modelo y el resultado de la prueba de conexión](shot:agent-server)

Además de Claude y Codex, el agente puede usar un servidor de su ordenador o de su red que ofrezca una API compatible con OpenAI, como Ollama o LM Studio. novira pide las respuestas al servidor y ejecuta ella misma las herramientas del agente (cambiar ajustes, editores, etc.), por lo que el modelo tiene que ser uno capaz de llamar a herramientas.

Para conectarlo:

1. Abra el agente y pulse **{{ui:agent.setup.openai}}**.
2. Pulse el botón del servidor que use (para Ollama, el botón **Ollama**). Rellena la dirección y lee la lista de modelos que tiene el servidor. Si no, escriba la dirección, que suele terminar en /v1, en **{{ui:agent.endpoint.address}}**.
3. Elija el modelo en **{{ui:agent.endpoint.model}}** de la lista, o escriba su nombre cuando el servidor no dé lista.
4. Si el servidor pide una clave, escríbala en **{{ui:agent.endpoint.key}}**. Se guarda cifrada en este PC y se envía solo a este servidor. Un servidor de su propio PC normalmente no necesita ninguna.
5. Pulse **{{ui:agent.endpoint.test}}**. Comprueba que el servidor responde, que el modelo está y que el modelo puede llamar a las herramientas de la aplicación.
6. Pulse **{{ui:agent.endpoint.use}}**.

Si el modelo no puede llamar a herramientas, la prueba lo dice y da el motivo del servidor, queda una advertencia sobre la entrada y se rechaza el envío de mensajes. Elija otro modelo con el botón junto al nombre del chat; eso también permite volver a comprobar. La prueba falla del mismo modo cuando la ventana de contexto del servidor es demasiado pequeña para la petición del agente, que es el caso de la configuración estándar de Ollama: fije la longitud de contexto del servidor en 32768 o más (en los ajustes de Ollama, o con la variable de entorno OLLAMA_CONTEXT_LENGTH) y vuelva a pulsar **{{ui:agent.endpoint.test}}**. novira no finge que un modelo pueda usar las herramientas.

El encabezado del chat muestra OpenAI API cuando se usa un servidor. Pulse **{{ui:agent.changeProvider}}** para volver a la elección. El servidor que introdujo se queda en el formulario.

Un servidor que no está en este PC recibe, por la red, lo que usted envía y lo que el agente lee cuando lo permite. Para un servidor así, y para uno que no usa https, aparece una advertencia bajo la dirección, porque entonces todo, la clave incluida, viaja sin cifrar. La pregunta «{{ui:agent.permission.title}}» indica adónde se envía lo que lee. Lo que responde un servidor se trata como texto sin formato y como peticiones que pasan las mismas comprobaciones que las de Claude y Codex.

### Qué hace por usted

A partir de su texto, el agente decide lo siguiente y lo rellena en los ajustes. Lo que rellenó se muestra como una lista en su respuesta.

| Qué | Ejemplo |
|---|---|
| Elegir un modelo | Elige uno adecuado entre los modelos que tiene |
| Añadir un LoRA | Añade un LoRA que encaja con el estilo artístico |
| Prompt | Escribe el prompt y el prompt negativo |
| Cambiar ajustes | Tamaño, pasos, CFG, programador, semilla |
| Flujo de trabajo | Construye un grafo, o corrige el grafo que está abierto (también grafos de música, vídeo y voz hechos con los nodos propios de ComfyUI; usted mismo lo ejecuta con el botón **{{ui:params.invoke.invoke}}**) |
| Texto | Corrige el texto y los bocadillos abiertos en **{{ui:media.tab.text}}** |
| Vídeo, música, voz | Cambia los ajustes de cada una de esas pantallas |
| Cómic | En **{{ui:app.tabs.comic}}**, cambia la disposición de las viñetas, añade y corta viñetas, y cambia el prompt y la pose de cada viñeta, y los bocadillos (véase «Ayuda con un cómic» más abajo) |
| Pose | Coloca una figura con una pose que usted pida con palabras, en **{{ui:app.tabs.canvas}}** (véase [Dibujar más en el lienzo](05-canvas.md#crear-una-pose-en-el-lienzo)) |
| Generar | Solo cuando usted lo pide (y para una imagen de prueba, más abajo), pone en cola para generar los ajustes actuales o las viñetas del cómic |
| Recomendaciones de extensiones | Le indica extensiones que se adaptan a lo que quiere hacer, que puede instalar desde un botón |
| Preguntas sobre la aplicación | Responde con los nombres de las pantallas y dónde pulsar |
| Explicar extensiones | Dice qué hace una extensión y cómo usarla (véase «Preguntar sobre la aplicación y las extensiones» más abajo) |

El agente mira qué pantalla tiene abierta. Por ejemplo, si abre **{{ui:media.tab.text}}** y dice «pon el texto en vertical», ese texto cambia.

El agente coloca de inmediato en la pantalla lo que cambia, mientras trabaja. Mientras trabaja, lo que ha cambiado se lista bajo «{{ui:agent.thinking}}». Crea imágenes o vídeos solo cuando usted lo pide (los pone en cola). En los demás casos solo cambia ajustes, así que, si el resultado se ve bien, pulse **{{ui:agent.generate}}** en su respuesta y empieza a crear enseguida. Mientras hay un cómic abierto, junto a él también aparece un botón «Generar todas las páginas». Al pulsarlo se ponen en cola todas las viñetas que tienen prompt, en todas las páginas (no se pone nada en cola si no lo pulsa). No elimina imágenes ni instala modelos o extensiones (en el caso de las extensiones solo da recomendaciones). Las palabras en negrita, las listas, las tablas y similares de su respuesta se muestran como tales, no como marcas.

### Preguntar de vuelta e imágenes de prueba

Cuando su petición deja sin determinar algo que cambia mucho el resultado, como qué persona cambiar, el fondo o las personas, o el peinado o su color, el agente pregunta antes de cambiar nada. Responda, y lo cambia de ese modo. Cuando, tras una corrección, dice «la anterior era mejor» o «ella estaba bien como estaba», el agente busca cómo estaban las cosas antes de cambiarlas en este chat y vuelve a poner esa parte (una vez cerrada la aplicación, ya no se conoce el estado anterior).

Cuando pide un aspecto que las palabras apenas transmiten, como «más como un día de verano», el agente puede generar una imagen de prueba, mirarla y preguntar si es eso lo que quiere decir. La imagen de prueba aparece bajo su respuesta. Mirarla pide el mismo permiso que «Permiso para leer imágenes y prompts» más abajo. Para dejar de recibir imágenes de prueba, desactive **{{ui:settings.assistantTrial.label}}** en los ajustes (véase «Ajustes» más abajo).

### Ayuda con un cómic

Si pregunta con **{{ui:app.tabs.comic}}** abierto, el agente lee la página abierta (las formas de las viñetas, el prompt de cada viñeta, las poses y los bocadillos) y la reescribe directamente. Por ejemplo, puede pedir lo siguiente.

- Pida «Hazlo de 5 viñetas con un gran momento. Haz grande la primera viñeta y córtala en diagonal» y crea la disposición de las viñetas. Cuando no dice cómo, corta la página como se cortan las páginas de manga reales: filas de distinta altura y viñetas de distinto ancho, una viñeta grande para el momento clave y, según la escena, cortes en diagonal o una viñeta que llega hasta el borde del papel. El espacio entre filas es mayor que el espacio entre viñetas contiguas, y el corte cambia de una página a otra. También puede usar una plantilla incorporada, o decidir ella misma las formas de las viñetas.
- Pida «Escribe un prompt para cada viñeta de esta historia» y escribe un prompt para cada viñeta, con una composición que se ajusta al hilo de la historia (primer plano, plano general, contrapicado, etc.).
- Pida «Escribe una indicación de escena para cada viñeta de esta historia» y escribe con palabras la escena de cada viñeta (el lugar, el momento, quién hace qué).
- Pida «Pon diálogo en cada viñeta» y coloca bocadillos y les pone las frases. Cuando una frase se sale de su bocadillo, las palabras se hacen más pequeñas para que quepan.
- Pida «Haz que la chica de la viñeta 2 tenga una pose como si corriera» y da esa pose a la viñeta. También escribe el reparto (el aspecto de cada personaje) para que las caras y la ropa sean las mismas en todas las viñetas, y mantiene cada bocadillo pequeño, junto a la persona que habla y lejos de las demás.
- Pida «Crea un cómic nuevo y organiza 30 páginas» y crea un cómic nuevo, añade las páginas y recorre las disposiciones, los prompts y los diálogos hasta el final. Si se pide desde otra pantalla, cambia a la pantalla del cómic para trabajar. Incluso un trabajo largo continúa hasta terminar, dentro de una sola petición. Pulse **{{ui:agent.stop}}** para detenerlo.

Dibuja las imágenes solo cuando usted lo pide (las pone en cola). En los demás casos, una vez puestos los prompts, pulse **{{ui:comic.panel.draw}}**, **{{ui:comic.page.drawAll}}** o **{{ui:comic.comic.drawAll}}**. Pida «dibuja todas las páginas» y pone en cola de una vez todas las viñetas de todas las páginas; el botón «Generar todas las páginas» bajo su respuesta hace lo mismo. Al pulsar **{{ui:agent.undo}}** se devuelven de una vez las páginas del cómic que cambió esa respuesta.

### Adjuntar imágenes

Puede enviar imágenes con un mensaje y pedir, por ejemplo, «escribe un prompt a partir de esta imagen».

- Pulse el botón del clip a la izquierda del cuadro de mensaje (**{{ui:agent.attach.add}}**) y elija imágenes de su PC.
- También puede arrastrar imágenes de la galería, o archivos de imagen de su PC, y soltarlos sobre el cuadro de mensaje.
- También puede pegar una imagen copiada en el cuadro de mensaje.

Las imágenes adjuntas se alinean sobre el cuadro de mensaje; la × de la esquina superior derecha de cada una la quita. Un mensaje puede llevar hasta cuatro imágenes. Si envía imágenes sin ningún texto, es lo mismo que preguntar «{{ui:agent.attach.defaultAsk}}». Las imágenes de su PC también entran en la galería. Las imágenes se envían con ese mensaje a la IA que eligió (Claude, Codex o el servidor que conectó). No van con los mensajes siguientes, así que vuelva a adjuntar una imagen para preguntar de nuevo por ella. Un modelo que no puede leer imágenes no puede responder bien.

### Permiso para leer imágenes y prompts

La información de las imágenes de la galería (sus prompts, modelos, etc.) y los cuadros de prompt de la pestaña Generar pueden contener cosas que no quiere mostrar. Por eso, cuando el agente quiere leerlos, al principio aparece en el chat una pregunta «{{ui:agent.permission.title}}», con lo que quiere leer.

- **{{ui:agent.permission.once}}**: le deja leer esta vez. La próxima vez que quiera leer, se le vuelve a preguntar.
- **{{ui:agent.permission.always}}**: le deja leer a partir de ahora sin preguntar (el ajuste pasa a **{{ui:settings.assistantRead.always}}**).
- **{{ui:agent.permission.deny}}**: no le deja leer. El agente continúa sin ello, o le dice qué necesitaría.

Mientras la pantalla del cómic está abierta, el agente puede mirar una página que ha dibujado (cuando se lo pide, para comprobar el aspecto de los personajes y dónde están los bocadillos). Aparece la misma pregunta, y la imagen de la página se envía solo cuando usted lo permite. No mira en otras pantallas.

Si se le pregunta o no se puede cambiar con **{{ui:settings.assistantRead.label}}**, en **{{ui:settings.section.assistant}}** de la pestaña **{{ui:settings.tab.generation}}** de los ajustes (véase «Ajustes» más abajo). Las pantallas en las que le pide al agente que trabaje, como el cómic, el texto, el flujo de trabajo, las pantallas de vídeo, música y voz y las poses del lienzo, se leen sin preguntar.

### Consultar Wikipedia

Mientras trabaja en una historia (una época histórica, la ropa, un lugar, un oficio, un término), el agente puede consultar un dato en Wikipedia, en japonés o en inglés, y leer el comienzo de hasta tres artículos. Solo sale de su PC una frase de búsqueda corta, y va solo a Wikipedia; la envía la propia aplicación, nunca la pantalla. Como la frase sale por internet, primero se le pregunta en el chat: «{{ui:agent.permission.webTitle}}», con las palabras que enviaría.

- **{{ui:agent.permission.once}}**: le deja consultar esta vez. La próxima vez que quiera consultar algo, se le vuelve a preguntar.
- **{{ui:agent.permission.always}}**: le deja consultar a partir de ahora sin preguntar (el ajuste pasa a **{{ui:settings.assistantRead.always}}**).
- **{{ui:agent.permission.deny}}**: no le deja. El agente continúa con lo que sabe y no vuelve a preguntar en esa petición.

Es un ajuste propio, **{{ui:settings.assistantWeb.label}}**, en **{{ui:settings.section.assistant}}** de la pestaña **{{ui:settings.tab.generation}}** de los ajustes. Permitirle leer sus imágenes no permite las consultas, ni al revés. El texto de Wikipedia tiene licencia CC BY-SA 4.0, así que, cuando el agente usa un dato, nombra el artículo del que procede. Sus respuestas aún pueden ser erróneas: compruebe todo lo que importe.

### Elegir el modelo y el esfuerzo de razonamiento

Pulse el pequeño botón con forma de cerebro a la derecha del nombre del chat para elegir el **{{ui:agent.model.label}}** y el **{{ui:agent.effort.label}}** que usa el agente. Lo que elija se usa desde el siguiente mensaje que envíe. Claude y Codex recuerdan cada uno su propia elección.

- Para Claude, el modelo se elige entre Fable 5.1, Opus 5.5, Sonnet 5.5 y Haiku 5.5. La versión del nombre es la que se usa. El esfuerzo de razonamiento tiene 5 niveles, de **{{ui:agent.effort.low}}** a **{{ui:agent.effort.max}}**.
- Para Codex, el modelo se elige de la lista de modelos que Codex dice que su cuenta puede usar (la lista se lee de lo que Codex guardó en su PC). Solo se muestran los esfuerzos de razonamiento que admite el modelo elegido (algunos modelos admiten hasta **{{ui:agent.effort.ultra}}**).
- Para un servidor, se muestran los modelos que lista el servidor, y se puede escribir un nombre. No hay esfuerzo de razonamiento. El modelo forma parte de los ajustes del servidor, así que elegir otro lo guarda.

Hasta que elija, se elige Sonnet 5.5 para Claude y el primer modelo de la lista para Codex, y el botón muestra su nombre. El modelo que nombra el botón es siempre el que responde (solo cuando Codex no ha guardado ninguna lista se muestra **{{ui:agent.model.default}}**, y Codex decide el modelo). Siempre hay un esfuerzo de razonamiento elegido. Al principio es el esfuerzo estándar del modelo, y cuando cambia a un modelo que no admite el esfuerzo actual, vuelve al esfuerzo estándar de ese modelo.

### Cambiar la altura del cuadro de mensaje

Arrastre hacia arriba la barra ancha del borde superior del cuadro de mensaje para hacerlo más alto, o hacia abajo para hacerlo más bajo. También puede seleccionar la barra y pulsar las teclas de flecha arriba y abajo. La altura se mantiene la próxima vez que abra la ventana.

### Invocar una plantilla

Escriba «/» al principio del cuadro de entrada y se abre una lista de plantillas para las peticiones que hace a menudo. Escriba letras tras la «/» y la lista se reduce a las que contienen esas letras en su nombre, comando o texto (por ejemplo «/comic»).

Elija con las teclas de flecha arriba y abajo, y confirme con Intro o Tab. Pulsar una fila de la lista también la confirma. El texto de la plantilla elegida pasa al cuadro de entrada, así que añada el resto y luego envíelo (elegirla no la envía). La tecla Esc cierra la lista.

### Preguntar sobre la aplicación y las extensiones

Además de pedirle que configure cosas, puede hacerle preguntas. Por ejemplo, «¿Cómo quito un fondo?» o «¿Dónde añado un modelo?». Responde con los nombres de las pantallas tal como aparecen, e indica dónde pulsar. Responde en el idioma que está usando.

También puede preguntar sobre extensiones. Explica con palabras sencillas qué hace una extensión, cuándo usarla y cómo. Hay tres formas de preguntar:

- Pulse una tarjeta de **{{ui:app.nav.extensions}}** para abrir sus detalles, y luego pulse **{{ui:agent.ask.button}}**. Se envía una pregunta sobre esa extensión en un chat nuevo.
- Escriba una palabra en el cuadro de búsqueda de la parte superior de **{{ui:app.nav.extensions}}**, y luego pulse **{{ui:agent.ask.resultsButton}}**, que aparece. Explica en qué se diferencian las extensiones que encontró (hasta las 8 primeras) y cuál probar primero.
- Escriba en el chat el nombre de una extensión (con letras latinas) y pregunte. Busca entre las extensiones publicadas las que coinciden en nombre o descripción (y carga primero la lista si aún no está cargada).

Para una extensión que ha instalado, también nombra los nodos que añade la extensión y a qué conectarlos. Para una que aún no ha instalado, la respuesta viene con una tarjeta, y puede instalarla allí mismo con **{{ui:workflows.packs.install}}**.

> La explicación se basa en la descripción publicada de la extensión y en la información de sus nodos. El agente debería decirlo cuando no lo sepa, pero aun así puede equivocarse. Compruebe la página de la extensión antes de instalarla.

### Deshacer

Una respuesta que cambió ajustes o ediciones recibe un botón **{{ui:agent.undo}}**. Al pulsarlo se devuelven de una vez los ajustes y las ediciones que cambió esa petición a lo que eran antes. Lo que puso en cola para generar no se cancela (cancélelo en la cola).

Sin embargo, tras volver a abrir la aplicación, los cambios hechos antes no se pueden deshacer (el botón ya no se puede pulsar).

### Dibujar una y otra vez hasta que encaje

Pida «hazlo como esta imagen» o «prueba unas cuantas y acércalo» y el agente repite imágenes de prueba. Tras cada imagen la compara con su objetivo, cambia solo lo que difiere y dibuja la siguiente.

- Cuando termina una respuesta, la aplicación pide sola la siguiente imagen. El agente se detiene solo cuando juzga que la imagen está lo bastante cerca, o cuando dos imágenes seguidas no se acercaron más.
- Dibuja 30 imágenes como máximo.
- El chat muestra «Acercándose: imagen N de M».
- Para detenerlo, pulse **{{ui:agent.stop}}** o envíe un mensaje nuevo. Su mensaje sale en lugar de la siguiente imagen.
- Con **{{ui:settings.assistantTrial.label}}** desactivado, esto no se inicia.

### Comprobar cuánto dura la conversación

Dentro de un chat, el agente responde teniendo presente el intercambio anterior. Los nombres de las imágenes que adjuntó y de las que mostró también se conservan, y las vuelve a mirar cuando lo necesita.

- Sobre el cuadro de mensaje se muestra el tamaño de la conversación que acompaña a su siguiente mensaje como «unos N de N tokens». El número es una estimación.
- Mientras el interruptor «{{ui:agent.context.limit}}» de la misma línea está activado (lo está al principio), a una conversación que está a punto de pasar de 30000 tokens se le envían sus mensajes más antiguos como un resumen breve de una línea cada uno. Los mensajes más nuevos se envían tal cual, y la línea dice cuántos se resumieron. El resumen conserva solo los primeros 140 caracteres más o menos, así que no se conserva la redacción exacta. Si el asistente olvida una parte anterior que necesita, desactívelo para enviar la conversación entera (una larga puede superar el límite del modelo que use).
- Mientras el interruptor está activado, los prompts que el asistente escribe en los cuadros de prompt de {{ui:app.tabs.generate}} también se limitan a 77 tokens por cuadro (la cuenta bajo el cuadro). La aplicación no admite un prompt más largo, y el asistente lo acorta y lo escribe de nuevo. Para dejar que escriba un prompt largo, desactívelo.
- Para cambiar de tema, inicie un chat nuevo con {{ui:agent.session.new}} para que la conversación antigua no pese sobre él.

### Historial de chats

Sus intercambios con el agente se guardan como un «chat». Al pulsar el nombre del chat en la parte superior de la ventana, se abre la lista **{{ui:agent.session.history}}**.

- Elija de la lista y puede continuar desde donde quedó ese chat.
- Con **{{ui:agent.session.rename}}**, puede ponerle un nombre.
- Con **{{ui:agent.session.delete}}**, puede quitarlo.
- Con **{{ui:agent.session.new}}**, a un lado, puede iniciar un chat nuevo.

Puede seleccionar el texto del chat arrastrando y copiarlo. El botón de la parte inferior derecha de cada mensaje (**{{ui:agent.copy}}**) copia el texto completo de ese mensaje.

> Un mensaje que envía mientras aún llega una respuesta espera en cola y se envía solo cuando termina la respuesta. Los mensajes en espera se muestran atenuados, y la × quita uno. Si la respuesta falla, los mensajes en espera vuelven al cuadro de entrada. Para detener, cancele con el botón **{{ui:agent.stop}}**. Lo que cambió antes de cancelar se queda, y **{{ui:agent.undo}}** lo devuelve todo.

Arrastre el borde entre los paneles para cambiar el ancho del panel derecho. Una ventana abierta sobre la pantalla cambia de tamaño al arrastrar cualquiera de sus cuatro bordes o cuatro esquinas. La esquina inferior derecha muestra una marca para ello. El tamaño se recuerda. Cuando una respuesta viene con cómo leyó la IA su petición, se muestra como una línea sobre la respuesta. Púlsela para abrir la explicación completa (**{{ui:agent.thoughts.label}}**). Es el breve resumen propio de la IA sobre cómo leyó la petición y por qué eligió lo que eligió, no su razonamiento interno en bruto.

## Ajustes

![La pantalla de ajustes. Las pestañas se listan a la izquierda y los elementos de la pestaña elegida a la derecha](shot:settings)

Al elegir **{{ui:app.nav.settings}}** en **{{ui:app.nav.settingsMenu}}**, en la parte inferior izquierda, se abre la pantalla de ajustes. Elija una pestaña a la izquierda, y sus elementos se muestran a la derecha. Lo que cambie se usa de inmediato y se conserva incluso después de cerrar la aplicación. Al volver a abrir la pantalla, se abre la pestaña que miró por última vez.

> Esta imagen es una pantalla de muestra que funciona en un navegador. No muestra **{{ui:settings.uiZoom.label}}**, que existe solo en la versión de escritorio.

### {{ui:settings.tab.general}}

| Elemento | Qué es |
|---|---|
| {{ui:settings.language.label}} | Elija entre {{ui:settings.language.ja}}, {{ui:settings.language.en}}, {{ui:settings.language.zhcn}}, {{ui:settings.language.zhtw}}, {{ui:settings.language.ko}}, {{ui:settings.language.ru}}, {{ui:settings.language.es}}, {{ui:settings.language.ptbr}}, {{ui:settings.language.fr}} y {{ui:settings.language.de}}. Las palabras de la pantalla cambian de inmediato |
| {{ui:settings.theme.label}} | **{{ui:settings.theme.dark}}** (el predeterminado) o **{{ui:settings.theme.light}}** |
| {{ui:settings.uiZoom.label}} | Solo en la versión de escritorio. El tamaño de toda la pantalla. Se puede elegir del 50 % al 300 %. También se puede cambiar con `Ctrl` y `+` / `-` |
| {{ui:settings.startTab.label}} | La pestaña que se muestra primero al abrir la aplicación. Al principio es **{{ui:app.tabs.generate}}**. Elija **{{ui:settings.startTab.last}}** para abrir la pestaña que estaba abierta al cerrar la aplicación |
| {{ui:settings.waitForEngine.label}} | Activado al principio: la pantalla de inicio espera hasta que el motor de imágenes termina de cargarse. Desactívelo para abrir la aplicación mientras el motor aún se carga; su estado se muestra en un banner |
| {{ui:settings.toastSeconds.label}} | Cuántos segundos permanece una notificación antes de cerrarse sola, de 2 a 15 (3,5 al principio) |

### {{ui:settings.tab.generation}}

- **{{ui:settings.antialiasProgressImages}}**: muestra las imágenes en curso de forma suave en el marco «{{ui:gallery.generating.title}}» de la galería. Si está desactivado, se ven como puntos toscos.
- **{{ui:settings.draftCount.label}}**: el valor inicial de la cantidad al abrir la pantalla de borradores (de 1 a 24 imágenes; 4 al principio). Aún se puede cambiar allí cada vez.
- **{{ui:settings.draftPosition.label}}**: el valor inicial de la posición al abrir la pantalla de borradores (del 25 al 60 %; 35 % al principio).
- **{{ui:settings.lowMemory.label}}**: para ordenadores cuya GPU tiene poca memoria. Cuando está activado, los modelos no se mantienen en la memoria de la GPU, por lo que hace falta menos memoria pero la creación es más lenta. Al cambiarlo se reinicia el motor. Mientras se está creando algo, se aplica la próxima vez que se inicie el motor. No se puede usar mientras la aplicación está conectada a un motor iniciado en otro sitio.
- **{{ui:settings.assistantRead.label}}** (**{{ui:settings.section.assistant}}**): si el agente puede leer la información de las imágenes de la galería y los prompts de la pestaña Generar. Elija entre **{{ui:settings.assistantRead.ask}}** (el predeterminado), **{{ui:settings.assistantRead.always}}** y **{{ui:settings.assistantRead.never}}**.
- **{{ui:settings.assistantWeb.label}}** (**{{ui:settings.section.assistant}}**): si el agente puede consultar datos en Wikipedia. Se pregunta y se elige del mismo modo, aparte de la lectura de imágenes.
- **{{ui:settings.assistantTrial.label}}** (**{{ui:settings.section.assistant}}**): si el agente puede generar por su cuenta una imagen de prueba cuando una petición no está clara. Está activado al principio.

### {{ui:settings.tab.gallery}}

- **{{ui:gallery.settings.thumbnailSize}}**, **{{ui:gallery.settings.sort}}**, **{{ui:gallery.settings.starredFirst}}**, **{{ui:gallery.settings.groupByDate}}**, **{{ui:gallery.settings.alwaysShowSize}}**, **{{ui:gallery.settings.showArchived}}**, **{{ui:gallery.settings.autoSwitch}}**, **{{ui:gallery.settings.autoAssign}}**: los mismos elementos que **{{ui:gallery.settings.title}}**, que abre el botón del engranaje de la galería. Cambiarlos en cualquiera de los dos sitios los cambia en ambos.
- **{{ui:settings.confirmOnDelete}}**: muestra una confirmación antes de eliminar una imagen. También se desactiva al elegir «{{ui:common.dontAskAgain}}» en la pantalla de confirmación.
- **{{ui:settings.clearIntermediates}}**: elimina las imágenes que no aparecen en la galería, como los resultados intermedios del lienzo. El número que se eliminará se muestra en el botón.

### {{ui:settings.tab.edit}}

- **{{ui:settings.undoLimit.label}}**: cuántas ediciones se pueden deshacer en los editores del lienzo, del cómic, del texto y de flujos de trabajo, de 10 a 200 (60 al principio). Más pasos usan más memoria.

### {{ui:settings.tab.comicText}}

- **{{ui:settings.comicFont.label}}**: la tipografía de las palabras de los bocadillos que no tienen tipografía propia. Elija entre las tipografías de la aplicación o las instaladas en este ordenador. **{{ui:common.font.standard}}** es el rotulado estándar de la aplicación.
- **{{ui:settings.textFont.label}}**: la tipografía del texto que añade en la pantalla de texto. Se elige del mismo modo que la tipografía de los bocadillos.
- **{{ui:settings.section.comicPage}}**: fija el **{{ui:comic.page.size}}**, la **{{ui:comic.page.direction}}**, las **{{ui:settings.comicPage.panels}}** (de 1 a 6), el **{{ui:comic.page.frameWidth}}** y el **{{ui:comic.page.margin}}** de los cómics nuevos y de las páginas que añada más adelante. Las páginas que ya tiene no cambian.

### {{ui:settings.tab.engine}}

Dónde guarda la aplicación sus datos y cómo se inicia el motor de imágenes (ComfyUI). Lo que cambie aquí se usa desde la próxima vez que se inicie la aplicación (una nota en la parte superior lo indica).

| Elemento | Qué es |
|---|---|
| {{ui:settings.engine.dataDir.label}} | La carpeta que contiene sus imágenes, modelos, el motor de imágenes, etc. Al principio es `novira-data` en su carpeta de usuario. **{{ui:settings.engine.dataDir.change}}** pregunta primero qué pasa con los datos actuales. **{{ui:settings.engine.dataDir.dialog.move}}** los traslada a la carpeta que elija, que puede contener otras cosas siempre que ninguna tenga el nombre de una parte de los datos (se hace nada más iniciar la próxima vez, así que una biblioteca grande tarda un rato). **{{ui:settings.engine.dataDir.dialog.use}}** los deja donde están y abre la carpeta que elija (sus datos si los tiene, una biblioteca nueva si está vacía). Después se abre un cuadro de diálogo de carpetas, y el lugar que elija se usa desde el próximo inicio. **{{ui:settings.engine.dataDir.cancel}}** retira el cambio. Si no se puede hacer un traslado, se muestra el motivo y la aplicación se inicia con la carpeta actual. Cuando la variable de entorno `NOVIRA_DATA_DIR` la fija, no se puede cambiar aquí |
| {{ui:settings.engine.comfyui.label}} | El ComfyUI en uso. Normalmente está en `comfyui` dentro de la carpeta de datos, y se muestra ese lugar. Cuando en el archivo de ajustes se nombra otro ComfyUI, se muestra su lugar. **{{ui:settings.engine.comfyui.change}}** cambia dónde va el ComfyUI que instala la aplicación. Una carpeta vacía recibe una instalación nueva en el próximo inicio (una descarga grande); una carpeta que ya contiene una instalación se usa tal cual. Los archivos del lugar antiguo no se eliminan solos. Para volver a ponerlo dentro de la carpeta de datos, elija allí `comfyui` |
| {{ui:settings.engine.package.label}} | **{{ui:settings.engine.package.nvidia}}** o **{{ui:settings.engine.package.amd}}**. Se usa la próxima vez que se descargue ComfyUI (la primera instalación o un cambio de versión). Cuando ComfyUI está instalado, elegir el otro tipo pide primero una confirmación. Una vez confirmado, ComfyUI se instala de nuevo con el tipo elegido la próxima vez que se inicie novira (la descarga es grande y tarda un rato) |
| {{ui:settings.engine.timeout.label}} | Cuántos segundos esperar a que ComfyUI responda tras iniciarlo, de 30 a 1800. Hágalo más largo en un ordenador lento |
| {{ui:settings.engine.modelRoots.label}} | Carpetas donde se buscan modelos además de los modelos de la carpeta de datos. Pulse **{{ui:settings.engine.modelRoots.add}}** para abrir una ventana donde elegir una carpeta. Se entienden las estructuras de carpetas de ComfyUI y Stability Matrix. Los paquetes de modelos de las funciones de vídeo, música, voz y borrado también se encuentran allí (solo se leen; los nuevos siempre se instalan en la carpeta de datos). Se pueden añadir hasta 16. No se puede añadir una carpeta dentro de la carpeta de datos, ni una que ya esté en la lista. Quite una con su botón ×. En un navegador, las carpetas solo se pueden quitar, no añadir |

### {{ui:settings.tab.accounts}}

Son campos para cuando un sitio que distribuye modelos exige iniciar sesión. Lo que introduzca se cifra y se guarda en este ordenador, y no se muestra en la pantalla.

| Elemento | Qué es |
|---|---|
| {{ui:settings.civitaiKey.label}} | Se usa para descargar modelos que exigen iniciar sesión |
| {{ui:settings.hfToken.label}} | Se usa para descargar modelos que exigen una solicitud de acceso |

Péguela y pulse **{{ui:settings.civitaiKey.save}}**. Después también puede **{{ui:settings.civitaiKey.change}}** o **{{ui:settings.civitaiKey.remove}}**.

### {{ui:settings.tab.data}}

#### {{ui:share.backup.section}}

![La parte de copia de seguridad de los ajustes: los botones para crear una copia y para restaurar desde una](shot:settings-backup)

Puede guardar sus imágenes y lo que configuró y registró en la aplicación en un solo archivo zip, para llevarlo a otro ordenador o por precaución.

- **{{ui:share.backup.createLabel}}**: se abre una ventana para elegir dónde guardarlo. El nombre del archivo empieza como «novira-backup-fecha-hora.zip». Con muchas imágenes tarda un rato, y el progreso se muestra en esta parte.
- **{{ui:share.backup.restoreLabel}}**: elija un archivo zip de copia de seguridad. Se comprueba su contenido y luego se abre una ventana de confirmación.

Qué contiene una copia de seguridad y qué no:

| Incluido | No incluido |
|---|---|
| Las imágenes, vídeos y sonidos de la galería, con sus miniaturas | Modelos |
| Tableros, flujos de trabajo, cómics y los registros de la cola | El motor de imágenes (ComfyUI) y las extensiones |
| Personajes, ajustes predefinidos, la lista de prompts, borradores, los chats del agente y los ajustes de pantalla | Claves de API y tokens, y ajustes que pertenecen a este ordenador (como dónde está ComfyUI) |

![La confirmación de restauración: cuándo se hizo la copia, qué contiene y la advertencia de que todo se reemplaza](shot:restore-confirm)

La ventana de confirmación muestra cuándo se hizo la copia y cuántas imágenes, tableros y flujos de trabajo contiene. Pulse **{{ui:share.backup.confirm}}**: la aplicación se cierra y se inicia de nuevo, y sus datos actuales se reemplazan por los de la copia. Si eso falla, se devuelven los datos anteriores y se le avisa.

> Los datos reemplazados no se pueden recuperar; cree antes una copia de seguridad del estado actual si puede necesitarlo. Las claves de API y los tokens están cifrados solo para este ordenador, así que vuelva a introducirlos en **{{ui:settings.tab.accounts}}** tras una restauración. En un navegador no se pueden crear ni restaurar copias de seguridad; use la aplicación de escritorio.

#### {{ui:settings.section.unfinished}}

Cuando una descarga se detiene a medias, la parte ya recibida se queda en la carpeta de datos. Esta parte muestra el nombre, la carpeta y el tamaño de cada archivo sobrante. **{{ui:settings.unfinished.delete}}** elimina uno, y **{{ui:settings.unfinished.deleteAll}}** los elimina todos (antes se le pide confirmación). La próxima vez que se inicie la misma descarga, continúa desde su archivo sobrante; si elimina el archivo, esa descarga empieza de nuevo desde el principio. Un archivo en uso no se elimina y se queda.

#### {{ui:settings.section.reset}}

Elija qué restablecer con **{{ui:settings.reset.scope.label}}**, pulse **{{ui:settings.resetWebUi}}** y luego pulse **{{ui:settings.resetConfirm}}** de nuevo para confirmar. Las imágenes, los modelos, los cómics y el lienzo se conservan.

El estado de las pantallas (ajustes, ajustes predefinidos, borradores, historial, etc.) se guarda en la carpeta de datos. Mientras ambos usen la misma carpeta de datos, la aplicación de escritorio y el navegador muestran el mismo contenido. No pueden estar abiertos a la vez; lo que hizo en uno está ahí al abrir el otro. Un restablecimiento se aplica a ambos.

| Parte | Qué vuelve a como estaba al principio |
|---|---|
| {{ui:settings.reset.scope.settings}} | Los elementos de la pantalla de ajustes, de una vez |
| {{ui:settings.reset.scope.generation}} | Los prompts, el modelo y los parámetros de la pantalla de generación |
| {{ui:settings.reset.scope.gallery}} | La visualización de la galería (tamaño de miniaturas, orden, etc.) |
| {{ui:settings.reset.scope.assistant}} | Los chats con el agente, que se eliminan todos |
| {{ui:settings.reset.scope.all}} | Todos los ajustes y estados de pantalla guardados en el navegador. También se eliminan los ajustes predefinidos, los personajes, las listas de prompts y los chats del agente |

Excepto en «{{ui:settings.reset.scope.settings}}», el cambio se aplica al pulsar el botón **{{ui:settings.reload}}** que aparece tras confirmar, y la pantalla se carga de nuevo.

### {{ui:settings.tab.developer}}

- **{{ui:settings.showDevLog}}**: muestra un botón «{{ui:app.devlog.short}}» en la navegación de la izquierda (véase «Registro para desarrolladores» más abajo).

## Atajos de teclado

![La lista de atajos de teclado. Las acciones y las teclas se alinean por categorías, como Aplicación y Lienzo](shot:hotkeys)

Elija **{{ui:app.nav.hotkeys}}** en **{{ui:app.nav.settingsMenu}}**, en la parte inferior izquierda, o pulse `Shift+?`, y se abre la lista. Con el campo de búsqueda de la parte superior se puede buscar por nombre de acción o por tecla.

Estos son los de uso más habitual. Para verlos todos, consulte la lista en pantalla.

### Toda la aplicación

| Tecla | Acción |
|---|---|
| `Ctrl+Enter` | Generar (añadir a la cola) |
| `Ctrl+Shift+Enter` | Añadir al principio de la cola y generar |
| `Shift+X` | Cancelar el elemento que se está procesando |
| `Ctrl+Shift+X` | Vaciar toda la cola |
| `Alt+A` | Ir al campo de prompt |
| `T` | Abrir y cerrar el panel izquierdo |
| `G` | Abrir y cerrar el panel derecho (la galería y el agente) |
| `F` | Abrir y cerrar ambos paneles a la vez |
| `1` a `9` | Ir a la pestaña con ese número |
| `Shift+?` | Abrir la lista de atajos |
| `Ctrl` + `+` / `-` | Ampliar y reducir toda la pantalla |

### Lienzo

| Tecla | Acción |
|---|---|
| `B` | {{ui:settings.hotkeys.canvas.brush}} |
| `E` | {{ui:settings.hotkeys.canvas.eraser}} |
| `U` | {{ui:settings.hotkeys.canvas.rect}} |
| `V` | {{ui:settings.hotkeys.canvas.move}} |
| `C` | {{ui:settings.hotkeys.canvas.bbox}} |
| `H` | Mover la vista |
| `I` | {{ui:settings.hotkeys.canvas.colorPicker}} |
| `[` / `]` | Hacer el pincel más pequeño y más grande |
| `Ctrl+Z` | {{ui:settings.hotkeys.canvas.undo}} |
| `Ctrl+Shift+Z`, `Ctrl+Y` | {{ui:settings.hotkeys.canvas.redo}} |
| `Q` | Cambiar con la herramienta usada anteriormente |
| `Enter`, `Esc` | {{ui:settings.hotkeys.canvas.acceptStaged}}, {{ui:settings.hotkeys.canvas.discardStaged}} |

### La galería y el visor

| Tecla | Acción |
|---|---|
| Teclas de flecha | {{ui:settings.hotkeys.gallery.navigate}} |
| `Ctrl+A` | {{ui:settings.hotkeys.gallery.selectAll}} |
| `Esc` | {{ui:settings.hotkeys.gallery.clearSelection}} |
| `.` | {{ui:settings.hotkeys.gallery.star}} |
| `I` | {{ui:settings.hotkeys.viewer.toggleMetadata}} |
| `R` | {{ui:settings.hotkeys.viewer.remix}} (carga todo excepto la semilla) |
| `P`, `S`, `A` | Cargar el prompt, la semilla, todo |
| `W` | {{ui:settings.hotkeys.viewer.loadWorkflow}} |
| `Shift+U` | {{ui:settings.hotkeys.viewer.upscale}} |
| `C` | {{ui:settings.hotkeys.viewer.compare}} |
| `Delete` | {{ui:settings.hotkeys.viewer.delete}} |
| `Ctrl+0`, `Ctrl+1` | {{ui:settings.hotkeys.viewer.zoomFit}}, {{ui:settings.hotkeys.viewer.zoomActual}} |

### Flujos de trabajo

| Tecla | Acción |
|---|---|
| `Shift+A`, `Space` | {{ui:settings.hotkeys.workflows.addNode}} |
| `Delete` | Eliminar los nodos y conexiones elegidos |
| `Ctrl+C`, `Ctrl+V` | {{ui:settings.hotkeys.workflows.copy}}, {{ui:settings.hotkeys.workflows.paste}} |
| `Ctrl+S` | {{ui:settings.hotkeys.workflows.save}} |
| `Ctrl+Z`, `Ctrl+Shift+Z` | {{ui:settings.hotkeys.workflows.undo}}, {{ui:settings.hotkeys.workflows.redo}} |

Mientras escribe en un campo, las teclas de una sola letra como `T` y `G` no funcionan.

## Acerca de esta aplicación

![La pantalla con información sobre la aplicación. El logotipo, la versión, la licencia y la lista del software de código abierto en uso](shot:about)

Al elegir **{{ui:app.nav.about}}** en **{{ui:app.nav.settingsMenu}}**, en la parte inferior izquierda, aparecen en la parte superior el nombre de la aplicación, su versión, su licencia y su copyright. Debajo hay dos pestañas.

- **{{ui:settings.about.license.title}}**: el texto completo de la licencia de novira (Apache License 2.0). La carpeta de instalación contiene el mismo archivo (`LICENSE`).
- **{{ui:settings.about.oss.title}}**: el software de código abierto que usa la aplicación. Cada fila muestra un nombre y una versión. Al pulsar **{{ui:settings.about.oss.showLicense}}** se muestra su texto de licencia completo bajo la fila (púlselo de nuevo para cerrarlo). Al pulsar **{{ui:settings.about.oss.homepage}}** se abre su página en el navegador. El motor de generación y las extensiones no vienen incluidos con la aplicación, así que lea su licencia completa en su página web.

Los botones sobre la lista la acotan a **{{ui:settings.about.oss.short.frontend}}**, **{{ui:settings.about.oss.short.backend}}**, **{{ui:settings.about.oss.short.engine}}** o **{{ui:settings.about.oss.short.packs}}** (las extensiones instaladas en este momento). El cuadro de búsqueda encuentra el software por nombre. Los textos de licencia completos del software incluido también están reunidos en `THIRD_PARTY_NOTICES.txt` en la carpeta de instalación.

Las extensiones (nodos personalizados de ComfyUI) y los modelos siguen la licencia de sus propios distribuidores cuando los instala.

## Registro para desarrolladores

Es un registro para localizar la causa cuando algo no va bien. No hace falta usarlo en el uso diario.

Cuando activa **{{ui:settings.showDevLog}}** en **{{ui:settings.title}}**, aparece un botón «{{ui:app.devlog.short}}» en la navegación de la izquierda. Púlselo y el panel **{{ui:app.devlog.title}}** se abre en el lado derecho.

Aquí se alinean, con sus horas, los registros internos de la aplicación (el registro del backend), las advertencias en pantalla y los errores que no se capturaron.

- Con el selector de la parte superior, puede acotar a **{{ui:app.devlog.level.all}}**, **{{ui:app.devlog.level.warn}}** o **{{ui:app.devlog.level.error}}**.
- Si introduce palabras en el campo de filtro, solo se muestran las líneas que las contienen.
- Con **{{ui:app.devlog.copy}}**, puede copiar como texto las líneas mostradas. Puede pegarlo cuando informe de un problema.
- Se puede vaciar con **{{ui:app.devlog.clear}}**.

> El registro es un historial del tiempo que la aplicación ha estado abierta. Al cerrarla, el registro de la pantalla desaparece. Para formas más detalladas de investigar, vaya a [Solución de problemas](10-troubleshooting.md).
