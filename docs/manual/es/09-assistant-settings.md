# El asistente de IA, los ajustes y los atajos

Este capítulo explica el asistente de IA que configura las cosas cuando se le indica con palabras, la pantalla de ajustes, la lista de atajos de teclado, la pantalla con información sobre la aplicación y el registro de desarrollo.

La pantalla de ajustes, los atajos de teclado y la información sobre la aplicación se abren desde el **{{ui:app.nav.settingsMenu}}**, en la parte inferior izquierda de la pantalla.

## El asistente de IA

![La ventana del asistente de IA. La primera pantalla, donde se elige qué IA usar e iniciar sesión](shot:agent)

Al pulsar el botón **IA** (**{{ui:agent.open}}**) en la navegación de la izquierda, se abre la ventana **{{ui:agent.title}}**. La ventana se puede mover arrastrando su encabezado.

En lugar de elegir uno mismo los modelos y los LoRA o establecer el prompt y el tamaño, se indica con palabras lo que se quiere crear, por ejemplo «una chica de estilo anime de pie en una playa al atardecer», y el asistente elige los ajustes y los rellena.

### Primeros pasos (inicio de sesión)

novira no ejecuta una IA por sí misma para el asistente de IA. Llama a un comando de IA que está en el ordenador (Claude o Codex) para producir las respuestas. Para usarlo hace falta la siguiente preparación.

1. Instalar uno de los comandos en el ordenador: **Claude** de Anthropic o **Codex** de OpenAI.
2. Abrir el asistente y pulsar el que se quiere usar (**{{ui:agent.setup.claude}}** o **{{ui:agent.setup.codex}}**).
3. Se abre un navegador y allí se inicia sesión.

Si ese comando no se encuentra en el ordenador, aparece un aviso que dice «No se encontró el comando ○○ en este PC. Instálelo primero.». Hay que instalar ese comando antes.

El servicio que se usa y sus condiciones son los del proveedor elegido. novira no guarda claves de API. Lo que se intercambia (el texto enviado, la lista actual de modelos y ajustes, etc.) se envía al servicio elegido.

La IA elegida se muestra en el encabezado de la parte superior de la ventana. Para cambiarla, se pulsa el botón **{{ui:agent.changeProvider}}** de la parte superior.

### Qué hace por el usuario

A partir del texto, el asistente decide lo siguiente y lo rellena en los ajustes. Lo que rellenó se muestra como una lista en su respuesta.

| Qué | Ejemplo |
|---|---|
| Elección de modelo | Elige uno adecuado entre los modelos disponibles |
| Añadir un LoRA | Añade un LoRA que encaja con el estilo artístico |
| Prompt | Escribe el prompt y el prompt negativo |
| Cambio de ajustes | Tamaño, pasos, CFG, scheduler, semilla |
| Flujo de trabajo | Construye un grafo o corrige el grafo que está abierto |
| Texto | Corrige el texto y los bocadillos abiertos en **{{ui:media.tab.text}}** |
| Vídeo, música, voz | Cambia los ajustes de cada una de esas pantallas |
| Cómic | En **{{ui:app.tabs.comic}}**, cambia la distribución de viñetas, añade y divide viñetas, y cambia el prompt y la pose de cada viñeta y los globos (véase «Ayuda con el cómic» más abajo) |
| Pose | Coloca en **{{ui:app.tabs.canvas}}** una figura con la pose que se pide con palabras (consulte [Añadir trazos en el lienzo](05-canvas.md#crear-una-pose-en-el-lienzo)) |
| Recomendaciones de extensiones | Indica extensiones adecuadas para lo que se quiere hacer, que se pueden instalar desde un botón |
| Preguntas sobre la aplicación | Responde con los nombres de las pantallas y dónde pulsar |
| Explicación de extensiones | Dice qué hace una extensión y cómo usarla (véase «Preguntas sobre la aplicación y las extensiones» más abajo) |

El asistente observa qué pantalla está abierta. Por ejemplo, si se abre **{{ui:media.tab.text}}** y se dice «pon el texto en vertical», ese texto cambia.

El asistente solo cambia ajustes. No crea imágenes. Si el resultado parece bueno, se pulsa **{{ui:agent.generate}}** en su respuesta y empieza a crear de inmediato.

### Ayuda con el cómic

Si se le pide algo con **{{ui:app.tabs.comic}}** abierto, el asistente lee la página abierta (la forma de las viñetas, el prompt de cada viñeta, las poses y los globos) y la reescribe directamente. Por ejemplo, se le puede pedir así.

- Si se pide «Hazlo en 5 viñetas con un momento culminante. La primera, grande y cortada en diagonal», crea la distribución de viñetas. Puede usar una plantilla estándar o decidir él mismo la forma de las viñetas.
- Si se pide «Escribe el prompt de cada viñeta con esta historia», escribe para cada viñeta un prompt con un encuadre que encaje con el desarrollo de la historia (primer plano, plano general, contrapicado, etc.).
- Si se pide «Pon diálogos en cada viñeta», coloca globos y escribe los diálogos en ellos.
- Si se pide «Pon a la chica de la viñeta 2 en una pose de correr», da una pose a esa viñeta.

No dibuja las imágenes en sí. Cuando los prompts estén puestos, pulse **{{ui:comic.panel.draw}}** o **{{ui:comic.page.drawAll}}**. Al pulsar **{{ui:agent.undo}}**, las páginas del cómic que cambió esa respuesta vuelven todas a la vez a como estaban.

### Elegir el modelo y el nivel de razonamiento

Al pulsar el pequeño botón con forma de cerebro que está a la derecha del nombre del chat, se pueden elegir el **{{ui:agent.model.label}}** y el **{{ui:agent.effort.label}}** que usa el asistente. Lo elegido se usa a partir del siguiente mensaje que se envíe. Claude y Codex recuerdan cada uno su propia elección.

- El modelo de Claude se elige entre **{{ui:agent.model.default}}**, Fable, Opus, Sonnet y Haiku. Con **{{ui:agent.model.custom}}** se puede escribir directamente el nombre de un modelo. El nivel de razonamiento tiene 5 grados, de **{{ui:agent.effort.low}}** a **{{ui:agent.effort.max}}**.
- El modelo de Codex no se puede elegir (se sigue el ajuste del propio comando). El nivel de razonamiento es **{{ui:agent.effort.low}}**, **{{ui:agent.effort.medium}}** o **{{ui:agent.effort.high}}**.

Con **{{ui:agent.model.default}}**, se sigue el ajuste del propio comando.

### Llamar a una plantilla

Al escribir «/» al principio del cuadro de entrada, se abre una lista de plantillas de peticiones habituales. Si se siguen escribiendo letras tras la «/», quedan solo las que contienen esas letras en el nombre, el comando o el texto (por ejemplo, «/cómic» o «/comic»).

Se elige con las flechas arriba y abajo y se confirma con Enter o Tab. También se confirma pulsando una fila de la lista. El texto de la plantilla elegida pasa al cuadro de entrada, así que complételo y luego envíelo (elegirla no lo envía). La tecla Esc cierra la lista.

### Preguntas sobre la aplicación y las extensiones

Además de pedirle que configure cosas, se le pueden hacer preguntas. Por ejemplo, «¿Cómo se quita un fondo?» o «¿Dónde se añade un modelo?». Responde con los nombres de las pantallas tal como aparecen e indica dónde pulsar. Responde en el idioma que se está usando.

También se puede preguntar por las extensiones. Explica con palabras sencillas qué hace una extensión, cuándo usarla y cómo. Hay tres maneras de preguntar:

- Pulsar una tarjeta en **{{ui:app.nav.extensions}}** para abrir sus detalles y luego pulsar **{{ui:agent.ask.button}}**. Se envía una pregunta sobre esa extensión en un chat nuevo.
- Escribir una palabra en el cuadro de búsqueda de la parte superior de **{{ui:app.nav.extensions}}** y luego pulsar **{{ui:agent.ask.resultsButton}}**, que aparece. Explica en qué se diferencian las extensiones encontradas (hasta las 8 primeras) y cuál probar primero.
- Escribir el nombre de una extensión (con letras latinas) en el chat y preguntar. Busca entre las extensiones publicadas las que coinciden en nombre o descripción (y carga primero la lista si aún no está cargada).

Para una extensión instalada, nombra también los nodos que añade la extensión y a qué conectarlos. Para una que aún no está instalada, la respuesta viene con una tarjeta y se puede instalar allí mismo con **{{ui:workflows.packs.install}}**.

> La explicación se basa en la descripción publicada de la extensión y en la información de sus nodos. El asistente debería decirlo cuando no lo sabe, pero aun así puede equivocarse. Conviene comprobar la página de la extensión antes de instalarla.

### Deshacer

Una respuesta que rellenó ajustes recibe un botón **{{ui:agent.undo}}**. Al pulsarlo, los ajustes vuelven a lo que eran antes de esa respuesta.

Sin embargo, tras volver a abrir la aplicación, los cambios hechos antes no se pueden deshacer (el botón ya no se puede pulsar).

### Historial de chats

Los intercambios con el asistente se guardan como un «chat». Al pulsar el nombre del chat en la parte superior de la ventana, se abre la lista **{{ui:agent.session.history}}**.

- Eligiendo de la lista se puede continuar desde donde quedó ese chat.
- Con **{{ui:agent.session.rename}}** se le puede poner un nombre.
- Con **{{ui:agent.session.delete}}** se puede quitar.
- Con **{{ui:agent.session.new}}**, al lado, se puede empezar un chat nuevo.

> Mientras se espera una respuesta, no se puede enviar otro mensaje. Hay que esperar a que desaparezca el indicador «{{ui:agent.thinking}}» o cancelar con el botón **{{ui:agent.stop}}**, que ocupa el lugar del botón de enviar. Una solicitud cancelada no cambia ningún ajuste.

Arrastrando cualquiera de los cuatro bordes o de las cuatro esquinas de la ventana se cambia su tamaño. La esquina inferior derecha muestra una marca para ello. El tamaño se recuerda. Cuando la respuesta incluye cómo interpretó la IA la solicitud, se muestra en una línea sobre ella. Al pulsarla se abre la explicación completa (**{{ui:agent.thoughts.label}}**). Es el breve resumen de la propia IA sobre cómo interpretó la solicitud y por qué eligió lo que eligió, no su razonamiento interno en bruto.

## Ajustes

![La pantalla de ajustes. Los elementos General, Cuentas, Generación, Interfaz y Desarrollo se muestran en una lista](shot:settings)

Al elegir **{{ui:app.nav.settings}}** en el **{{ui:app.nav.settingsMenu}}**, en la parte inferior izquierda, se abre la pantalla de ajustes. Lo que se cambia se usa de inmediato y se conserva incluso después de cerrar la aplicación.

> Esta imagen es una pantalla de ejemplo que se ejecuta en un navegador. No muestra **{{ui:settings.uiZoom.label}}**, que existe solo en la versión de escritorio.

### {{ui:settings.section.general}}

| Elemento | Qué es |
|---|---|
| {{ui:settings.language.label}} | Se elige entre {{ui:settings.language.ja}}, {{ui:settings.language.en}}, {{ui:settings.language.zhcn}}, {{ui:settings.language.zhtw}}, {{ui:settings.language.ko}}, {{ui:settings.language.ru}}, {{ui:settings.language.es}}, {{ui:settings.language.ptbr}}, {{ui:settings.language.fr}} y {{ui:settings.language.de}}. Los textos de la pantalla cambian de inmediato |
| {{ui:settings.theme.label}} | **{{ui:settings.theme.dark}}** (el predeterminado) o **{{ui:settings.theme.light}}** |

### {{ui:settings.section.accounts}}

Son campos para cuando un sitio que distribuye modelos exige iniciar sesión. Lo que se introduce se cifra y se guarda en este ordenador, y no se muestra en pantalla.

| Elemento | Qué es |
|---|---|
| {{ui:settings.civitaiKey.label}} | Se usa para descargar modelos que exigen iniciar sesión |
| {{ui:settings.hfToken.label}} | Se usa para descargar modelos que exigen una solicitud de acceso |

Se pega y se pulsa **{{ui:settings.civitaiKey.save}}**. Después también se puede **{{ui:settings.civitaiKey.change}}** o **{{ui:settings.civitaiKey.remove}}**.

### {{ui:settings.section.generation}}

- **{{ui:settings.antialiasProgressImages}}**: muestra con suavidad las imágenes en curso en el recuadro «{{ui:gallery.generating.title}}» de la galería. Si está desactivado, se ven como puntos toscos.
- **{{ui:settings.lowMemory.label}}**: para ordenadores cuya GPU tiene poca memoria. Cuando está activado, los modelos no se mantienen en la memoria de la GPU, así que hace falta menos memoria pero la creación es más lenta. Al cambiarlo se reinicia el motor. Si hay un elemento en proceso de creación, se aplica la próxima vez que se inicie el motor. No se puede usar mientras la aplicación está conectada a un motor iniciado en otro lugar.

### {{ui:settings.section.ui}}

- **{{ui:settings.uiZoom.label}}** (solo versión de escritorio): el tamaño de toda la pantalla. Se puede elegir entre el 50 % y el 300 %. También se puede cambiar con `Ctrl` y `+` / `-`.
- **{{ui:settings.confirmOnDelete}}**: muestra una confirmación antes de eliminar una imagen. También se desactiva al elegir «{{ui:common.dontAskAgain}}» en la pantalla de confirmación.

### {{ui:share.backup.section}}

![La parte de copia de seguridad de los ajustes: los botones para crear una copia y para restaurar desde una](shot:settings-backup)

Se pueden guardar las imágenes y lo configurado y registrado en la aplicación en un solo archivo zip, para llevarlo a otro ordenador o por precaución.

- **{{ui:share.backup.create}}**: se abre una ventana para elegir dónde guardarla. El nombre del archivo empieza como «novira-backup-fecha-hora.zip». Con muchas imágenes tarda un rato, y el progreso se muestra en esta parte.
- **{{ui:share.backup.restore}}**: se elige un archivo zip de copia de seguridad. Se comprueba su contenido y luego se abre una ventana de confirmación.

Qué contiene una copia de seguridad y qué no:

| Incluido | No incluido |
|---|---|
| Las imágenes, vídeos y sonidos de la galería, con sus miniaturas | Modelos |
| Tableros, flujos de trabajo, cómics y los registros de la cola | El motor de imágenes (ComfyUI) y las extensiones |
| Personajes, preajustes, la lista de prompts, borradores, los chats de IA y los ajustes de pantalla | Claves de API y tokens, y ajustes propios de este ordenador (como la ubicación de ComfyUI) |

![La confirmación de la restauración: cuándo se hizo la copia, qué contiene y el aviso de que todo se sustituye](shot:restore-confirm)

La ventana de confirmación muestra cuándo se hizo la copia y cuántas imágenes, tableros y flujos de trabajo contiene. Al pulsar **{{ui:share.backup.confirm}}**, la aplicación se cierra y vuelve a iniciarse, y los datos actuales se sustituyen por los de la copia. Si falla, se restauran los datos anteriores y se avisa.

> Los datos sustituidos no se pueden recuperar; conviene crear antes una copia del estado actual si puede hacer falta. Las claves de API y los tokens se cifran solo para este ordenador, así que hay que volver a introducirlos en **{{ui:settings.section.accounts}}** después de una restauración. En un navegador se descarga un archivo JSON sin las imágenes, y la restauración no está disponible.

### {{ui:settings.section.developer}}

- **{{ui:settings.showDevLog}}**: muestra un botón «{{ui:app.devlog.short}}» en la navegación de la izquierda (véase «Registro de desarrollo» más abajo).
- **{{ui:settings.clearIntermediates}}**: elimina las imágenes que no aparecen en la galería, como los resultados intermedios del lienzo. El número de imágenes que se eliminarán se muestra en el botón.
- **{{ui:settings.resetWebUi}}**: devuelve los ajustes y el estado de la pantalla a sus valores iniciales. No se eliminan imágenes ni modelos. Tras pulsarlo, se confirma con **{{ui:settings.resetConfirm}}** y se vuelve a cargar con **{{ui:settings.reload}}**.

La pantalla de ajustes tiene además los interruptores «{{ui:settings.useCpuNoise}}», «{{ui:settings.enableInformationalPopovers}}», «{{ui:settings.enableImageDebugging}}» y «{{ui:settings.clearIntermediatesOnStartup}}». En la versión actual, estos no cambian la generación ni el comportamiento de la pantalla.

Abajo del todo, en la pantalla, se muestra la versión de la aplicación.

## Atajos de teclado

![La lista de atajos de teclado. Las acciones y las teclas se agrupan por categorías, como Aplicación y Lienzo](shot:hotkeys)

Se elige **{{ui:app.nav.hotkeys}}** en el **{{ui:app.nav.settingsMenu}}**, en la parte inferior izquierda, o se pulsa `Shift+?`, y se abre la lista. Con el campo de búsqueda de la parte superior se puede buscar por nombre de acción o por tecla.

Aquí están los de uso más habitual. Para verlos todos, conviene consultar la lista en pantalla.

### Toda la aplicación

| Tecla | Acción |
|---|---|
| `Ctrl+Enter` | Generar (añadir a la cola) |
| `Ctrl+Shift+Enter` | Añadir al principio de la cola y generar |
| `Shift+X` | Cancelar el elemento en proceso |
| `Ctrl+Shift+X` | Vaciar toda la cola |
| `Alt+A` | Ir al campo del prompt |
| `T` | Abrir y cerrar el panel izquierdo |
| `G` | Abrir y cerrar el panel derecho |
| `F` | Abrir y cerrar los dos paneles a la vez |
| `1` a `9`, `0` | Ir a la pestaña numerada |
| `Shift+?` | Abrir la lista de atajos |
| `Ctrl` + `+` / `-` | Acercar y alejar toda la pantalla |

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
| `R` | {{ui:settings.hotkeys.viewer.remix}} (cargar todo excepto la semilla) |
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
| `Delete` | Eliminar los nodos y las conexiones elegidos |
| `Ctrl+C`, `Ctrl+V` | {{ui:settings.hotkeys.workflows.copy}}, {{ui:settings.hotkeys.workflows.paste}} |
| `Ctrl+S` | {{ui:settings.hotkeys.workflows.save}} |
| `Ctrl+Z`, `Ctrl+Shift+Z` | {{ui:settings.hotkeys.workflows.undo}}, {{ui:settings.hotkeys.workflows.redo}} |

Mientras se escribe en un campo, las teclas de una sola letra como `T` y `G` no funcionan.

## Acerca de esta aplicación

![La pantalla con información de la aplicación. El logotipo, la versión, la licencia y la lista del software de código abierto usado](shot:about)

Al elegir **{{ui:app.nav.about}}** en el **{{ui:app.nav.settingsMenu}}** de la parte inferior izquierda, arriba aparecen el nombre de la aplicación, su versión, su licencia y sus derechos de autor. Debajo hay dos pestañas.

- **{{ui:settings.about.license.title}}**: el texto completo de la licencia de novira (Apache License 2.0). La carpeta de instalación contiene el mismo archivo (`LICENSE`).
- **{{ui:settings.about.oss.title}}**: el software de código abierto que usa la aplicación. Cada fila muestra un nombre y una versión. Al pulsar **{{ui:settings.about.oss.showLicense}}** aparece el texto completo de su licencia debajo de la fila (púlsalo de nuevo para cerrarlo). Al pulsar **{{ui:settings.about.oss.homepage}}** se abre su página en el navegador. El motor de generación y las extensiones no vienen con la aplicación, así que consulta su licencia completa en su página.

Los botones sobre la lista la limitan a **{{ui:settings.about.oss.short.frontend}}**, **{{ui:settings.about.oss.short.backend}}**, **{{ui:settings.about.oss.short.engine}}** o **{{ui:settings.about.oss.short.packs}}** (las extensiones instaladas ahora). El cuadro de búsqueda encuentra software por nombre. Los textos completos de las licencias del software incluido también están reunidos en `THIRD_PARTY_NOTICES.txt`, en la carpeta de instalación.

Las extensiones (nodos personalizados de ComfyUI) y los modelos siguen, al instalarlos, la licencia de su propio distribuidor.

## Registro de desarrollo

Es un registro para localizar la causa cuando algo no va bien. No hace falta usarlo en el uso cotidiano.

Al activar **{{ui:settings.showDevLog}}** en **{{ui:settings.title}}**, aparece un botón «{{ui:app.devlog.short}}» en la navegación de la izquierda. Al pulsarlo se abre el panel **{{ui:app.devlog.title}}** en el lado derecho.

Aquí aparecen, con sus horas, los registros internos de la aplicación (el registro del backend), los avisos en pantalla y los errores que no se capturaron.

- Con el selector de la parte superior se puede acotar a **{{ui:app.devlog.level.all}}**, **{{ui:app.devlog.level.warn}}** o **{{ui:app.devlog.level.error}}**.
- Si se introducen palabras en el campo de filtro, solo se muestran las líneas que las contienen.
- Con **{{ui:app.devlog.copy}}** se pueden copiar como texto las líneas mostradas. Se pueden pegar al informar de un problema.
- Se puede borrar con **{{ui:app.devlog.clear}}**.

> El registro solo recoge lo ocurrido mientras la aplicación está abierta. Al cerrarla, el registro de la pantalla desaparece. Para formas de investigación más detalladas, véase [Solución de problemas](10-troubleshooting.md).
