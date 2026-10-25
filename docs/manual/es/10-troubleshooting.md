# Solución de problemas

Este capítulo reúne las causas de que algo vaya mal y qué probar. Conviene buscar las palabras que aparecen en la pantalla.

Primero, fijarse en los dos puntos siguientes suele dar una pista sobre la causa.

- La pestaña **{{ui:app.tabs.queue}}**: un elemento fallido muestra su motivo (véase [más abajo](#fallos-de-generación)).
- {{ui:app.devlog.title}}: un registro de los aspectos internos de la aplicación (véase [Asistente de IA y ajustes](09-assistant-settings.md)).

## Inicio y motor

Para crear imágenes y demás, novira usa un «motor de generación de imágenes» (ComfyUI y el Python que lo ejecuta). La aplicación instala el motor por sí misma y lo inicia por sí misma.

### El inicio tarda mucho

La primera vez que se inicia tarda un rato porque hay que descargar y descomprimir el motor. **{{ui:engine.firstRunNote}}**

En la primera pantalla aparecen tres etapas: **{{ui:splash.step.downloading}}**, **{{ui:splash.step.extracting}}** y **{{ui:splash.step.starting}}**. Durante la descarga se muestran también el tamaño, la velocidad y el tiempo restante. Hay que esperar a que termine.

Cuando el motor está listo, la pantalla cambia. A partir de la segunda vez, es solo el breve tiempo desde que se inicia hasta que el motor responde.

### Mensajes en la parte superior de la pantalla

Mientras se prepara el motor, o cuando algo ha ido mal, aparece un mensaje en la parte superior de la pantalla.

| Mensaje | Significado |
|---|---|
| {{ui:engine.title.downloading}} | Se está descargando el motor. Son varios GB. Con una conexión lenta lleva tiempo |
| {{ui:engine.title.extracting}} | Se están descomprimiendo los archivos descargados |
| {{ui:engine.title.starting}} | Se está iniciando el motor y novira espera a que se conecte |
| {{ui:engine.title.error}} | La preparación falló. El motivo aparece debajo |

### Apareció el mensaje «{{ui:engine.title.error}}»

Si apareció en la primera pantalla al iniciar, al pulsar **{{ui:splash.open}}** se abre la aplicación sin el motor. En ese caso no se pueden crear imágenes ni otros contenidos, pero sí ver imágenes y organizar modelos.

Qué probar:

1. Leer el texto del motivo. Comprobar si hay conexión a internet y si queda espacio libre en el disco.
2. Intentarlo de nuevo. Incluso después de que la preparación del motor haya fallado, la aplicación intenta prepararlo de nuevo la próxima vez que se empieza a generar. Si aun así no se soluciona, se cierra la aplicación y se vuelve a abrir.
3. Si la descarga está hecha y solo falló la descompresión, los archivos descargados permanecen, así que al reintentar se continúa desde la descompresión.
4. Un software de seguridad puede estar inspeccionando los archivos nuevos y detener la descompresión. La aplicación reintenta automáticamente varias veces, pero si sigue ocurriendo, conviene excluir la carpeta de datos (véase más abajo) del análisis o desactivar el software temporalmente.
5. Si el motivo dice «see logs/comfyui.log», el registro del motor tiene un motivo detallado ([Cómo leer los registros](#cómo-leer-los-registros)).

> El motor es ComfyUI para Windows y, de forma predeterminada, se instala el de las GPU NVIDIA. También hay ajustes para usar una GPU AMD o un ComfyUI instalado por uno mismo, pero son para usuarios avanzados ([Ajustes avanzados](#ajustes-avanzados)).

### El motor parece haberse detenido a mitad

El tiempo de espera entre que el motor se inicia y responde es de 3 minutos de forma predeterminada. Pasado ese tiempo, se obtiene un error que significa «ComfyUI did not answer in time». Si el motor se cerró a mitad del inicio, aparece «ComfyUI exited while starting». En ambos casos, el motivo queda en el registro del motor (`comfyui.log`).

## No se puede generar

### El botón Generar no se puede pulsar

Al pasar el ratón sobre el botón Generar de la pantalla **{{ui:app.tabs.generate}}**, aparece una lista de motivos bajo **{{ui:params.invoke.cannotInvoke}}**. En las pantallas de vídeo, música, voz y logotipos, los motivos aparecen debajo del botón. Al corregir uno a uno los motivos mostrados, el botón se puede pulsar.

| Motivo mostrado | Cómo corregirlo |
|---|---|
| {{ui:params.readiness.noModel}} | Elegir un modelo. Si no hay ninguno instalado, véase «No hay ningún modelo instalado» más abajo |
| {{ui:params.readiness.loraMissing}} | No se encuentra el LoRA que se había elegido. Puede que se haya eliminado o movido. Hay que volver a elegir el LoRA o quitarlo |
| LoRA «…» no es compatible con el modelo | La base (SDXL, SD1.X, etc.) es distinta. Hay que usar un LoRA con la misma base o quitarlo |
| Imagen de referencia 1: ninguna imagen seleccionada / ningún modelo seleccionado | Poner una imagen y un modelo en el campo de la imagen de referencia |
| Las imágenes de referencia necesitan la extensión … | Instalar la extensión desde la guía del campo de la imagen de referencia ([Falta una extensión](#falta-una-extensión)) |
| {{ui:params.readiness.upscaleNoImage}} | Elegir una imagen que ampliar |
| {{ui:params.readiness.upscaleNoModel}} | Elegir un modelo para la ampliación. Si no hay ninguno instalado, se puede instalar uno desde **{{ui:models.install.tab.starter}}** en la pestaña {{ui:app.tabs.models}} |
| {{ui:video.problem.prompt}}, {{ui:music.problem.tags}}, {{ui:voice.problem.text}}, {{ui:logo.problem.text}} | Un campo obligatorio está vacío. Hay que rellenarlo |
| {{ui:video.problem.image}} | En el modo «Desde imagen», no se ha elegido ninguna imagen que animar |
| {{ui:voice.problem.description}} | En el modo «Describir una voz», la descripción de la voz está vacía |
| {{ui:video.problem.pack}}, {{ui:music.problem.pack}}, {{ui:voice.problem.pack}}, {{ui:logo.problem.pack}} | Los modelos específicos no están instalados. Véase el siguiente apartado |

### Los modelos de vídeo, música, voz o logotipos no están instalados

En el panel izquierdo de cada pantalla aparece una tarjeta, así que hay que pulsar **{{ui:pack.install}}**. No se puede crear nada hasta que termine la instalación.

- Si la descarga falla a mitad, el botón de la tarjeta cambia a **{{ui:pack.retry}}**. Se pulsa para intentarlo de nuevo.
- Para la voz, se instala también el motor de lectura en voz alta. El motor de generación de imágenes debe haber terminado de prepararse antes.
- El modelo de vídeo rápido es una descarga aparte del modelo de vídeo estándar.

Para más detalles, véase [Vídeo, música, voz, logotipos y texto](07-media.md).

### No hay ningún modelo instalado

Cuando la pestaña **{{ui:app.tabs.models}}** muestra **{{ui:models.empty.title}}**, no hay ni un solo modelo.

- Desde **{{ui:models.install.tab.starter}}** en **{{ui:models.import}}**, se puede instalar el primer modelo.
- También se puede buscar un modelo que le guste en la pestaña **{{ui:app.tabs.browse}}** e instalarlo.
- Si ya se tienen archivos de modelos, se puede incorporar una carpeta entera con **{{ui:models.install.tab.scan}}** en **{{ui:models.import}}**.

Para más detalles, véase [Modelos](08-models.md).

### Falta una extensión

Algunas funciones dicen «necesita la extensión XXX». Corregir el rostro, seleccionar una zona, quitar fondo, rellenar fotogramas de vídeo y usar imágenes de referencia están entre ellas.

1. Pulsar **{{ui:params.refImage.installPack}}** junto al mensaje.
2. Cuando termine la instalación, pulsar **{{ui:params.refImage.restartEngine}}** para reiniciar el motor.
3. Tras el reinicio, intentarlo de nuevo.

También se pueden instalar y quitar extensiones como lista desde **{{ui:workflows.panel.packs}}** en la pestaña **{{ui:app.tabs.workflows}}**.

> Cuando se está conectado a un motor preparado por uno mismo y no al que instaló la aplicación, la aplicación no puede instalar extensiones. Hay que instalarlas en ese motor.

### La GPU se queda sin memoria o compite con otras aplicaciones

Las imágenes, el vídeo y la música usan la GPU del ordenador. Si otras aplicaciones (juegos, edición de vídeo, vídeos en un navegador, etc.) están usando la GPU, la memoria puede escasear y provocar fallos.

Cuando falta memoria, el error puede incluir las letras «OOM» (de out of memory, sin memoria).

Cuando un trabajo falla por falta de memoria, la aplicación lo reconoce y muestra el aviso **{{ui:queue.oom.title}}**. Aparece sobre la galería, bajo el elemento fallido en la pestaña **{{ui:app.tabs.queue}}**, en las pantallas de vídeo, música, voz y logotipos, y como notificación en la parte inferior derecha.

![El aviso de que se agotó la memoria de la GPU, con los botones Reintentar más pequeño y Activar el modo de poca memoria y reiniciar](shot:out-of-memory)

Los botones del aviso permiten probar una de estas opciones:

- **{{ui:queue.oom.retrySmaller}}**: lo crea de nuevo con los mismos ajustes y la misma semilla, con aproximadamente el 75 % del área y la misma relación de aspecto. Aparece solo para imágenes creadas con un tamaño elegido (no para vídeo, música, voz, logotipos ni ampliación).
- **{{ui:queue.oom.lowMemory}}**: activa **{{ui:settings.lowMemory.label}}** (véase [Asistente de IA y ajustes](09-assistant-settings.md)) y reinicia el motor. Si hay un elemento en proceso de creación, se aplica la próxima vez que se inicie el motor. No aparece cuando el modo ya está activado.

Después de que un trabajo falle por falta de memoria, la aplicación pide al motor que descargue sus modelos y libere la memoria. Por eso el siguiente trabajo empieza volviendo a cargar su modelo y tarda un poco más.

Qué probar:

- Cerrar otras aplicaciones que usen la GPU, como juegos o edición de vídeo, y crearlo de nuevo.
- Reducir el tamaño de la imagen.
- Reducir los LoRA y las imágenes de referencia que se usan.
- En el vídeo, crearlo con un tamaño menor y ampliarlo después con **{{ui:video.finish}}**. También se pueden probar **{{ui:video.light.fp8}}** y **{{ui:video.light.tiled}}** en **{{ui:video.light.title}}**.
- Volver a abrir la aplicación para liberar la memoria en uso.

El modelo de voz se retira de la GPU cuando no se ha usado durante un tiempo. La creación avanza de uno en uno, por orden.

### Fallos de generación

Cuando falla la creación de una imagen, un vídeo, música o similar, el elemento de la pestaña **{{ui:app.tabs.queue}}** pasa a **{{ui:queue.status.failed}}**. Se pulsa el elemento para abrirlo y el motivo aparece en **{{ui:queue.detail.error}}**. En las pantallas de vídeo, música, voz y logotipos, también aparecen un indicador de fallo y su motivo cerca de la parte superior del centro (hasta los 3 últimos).

Una vez conocido el motivo, se puede intentar de nuevo con los mismos ajustes mediante el botón **{{ui:queue.action.retry}}** del elemento.

El texto del motivo procede del interior del motor o de la aplicación, por lo que puede estar en inglés. Estos son los más habituales.

| Texto del motivo (en esencia) | Significado y qué probar |
|---|---|
| ComfyUI does not see ... (check model roots / extra_model_paths) | El motor no encuentra ese modelo. Se movió el archivo del modelo, o el ajuste de las carpetas donde buscar no coincide. Hay que instalarlo de nuevo desde la pestaña Modelos o comprobar la ubicación |
| ComfyUI is not reachable at ... | No se puede conectar con el motor preparado aparte. Comprobar que ese motor esté en marcha |
| ComfyUI exited while starting / did not answer in time | El motor no puede iniciarse. Consultar el registro del motor |
| ... OOM | La GPU se quedó sin memoria. Véase el apartado anterior |
| ... models are not supported by the ComfyUI backend yet | Los modelos FLUX y SD3.X aún no se pueden usar para generar imágenes. Elegir un modelo SDXL o SD1.X |
| Reference images need the ... custom node pack | No está instalada la extensión necesaria para las imágenes de referencia |
| This ComfyUI is too old for video / music | Al motor que se usa le faltan funciones necesarias para vídeo o música. Esto no ocurre con el motor que instaló la aplicación. Si el motor se preparó por cuenta propia, hay que actualizarlo |
| The video / music / logo models are not installed yet | Los modelos específicos no están instalados. Descargarlos desde cada pantalla |
| ComfyUI has no ... node; install the custom node pack | No está instalada la extensión de un nodo usado en el flujo de trabajo |
| Interrupted because novira was closed | La aplicación se cerró durante la creación. Hay que crearlo de nuevo |

### La imagen se creó pero no se ve

Si la creación muestra **{{ui:queue.status.completed}}** pero no aparece nada en la galería, conviene comprobar lo siguiente.

- **Un tablero distinto**: las imágenes nuevas van al tablero marcado con **{{ui:gallery.boards.autoBadge}}** (de forma predeterminada, **{{ui:gallery.boards.uncategorized}}**). Si hay otro tablero abierto, no aparecen en él. Se cambia de tablero o se vuelve a elegir el tablero al que van las imágenes nuevas con **{{ui:gallery.boards.setAutoAdd}}**.
- **Los logotipos van a «Recursos»**: los logotipos van a **{{ui:gallery.view.assets}}**, no a **{{ui:gallery.view.images}}**.
- **Cómo se ven el vídeo y el audio**: el vídeo aparece como una miniatura con un ▶ y el audio con un ♪. Quedan ocultos si hay una búsqueda o un filtro activos.

Si aun así no se encuentra, se comprueba el **{{ui:queue.col.destination}}** del elemento en la pestaña **{{ui:app.tabs.queue}}**. Un elemento cuyo destino de salida es **{{ui:queue.destination.canvas}}** aparece en el lienzo, no en la galería.

## Dónde se guardan los datos y copias de seguridad

### Dónde están los datos

Las imágenes, los modelos y los registros van a una carpeta llamada **`novira-data`**. La ubicación es la siguiente.

- Versión distribuida: la carpeta elegida al instalar. De forma predeterminada, `novira-data` dentro de la misma carpeta que el ejecutable de la aplicación (`novira.exe`).
- Versión en desarrollo: `novira-data` dentro de la carpeta superior del repositorio.

Se puede cambiar a otra ubicación con la variable de entorno `NOVIRA_DATA_DIR`.

| Carpeta o archivo | Qué contiene |
|---|---|
| `outputs` | Las imágenes, vídeos y audios creados |
| `novira.sqlite` | Registros como la información de las imágenes, los tableros, la cola, la lista de modelos y los flujos de trabajo |
| `thumbnails` | Imágenes reducidas |
| `models` | Los modelos instalados |
| `comfyui` | El motor de generación de imágenes que instaló la aplicación |
| `cache` | Datos temporales que usa el motor |
| `voice` | La biblioteca para leer la voz en voz alta |
| `logs` | Registros (véase más abajo) |
| `settings.json` | Ajustes para usuarios avanzados (no pasa nada si no está) |
| `secrets` | Claves de API y tokens (cifrados) |
| `agent.json` | El tipo de IA elegido para el asistente de IA |

El motor que instaló la aplicación (ComfyUI y Python) y sus datos de trabajo también van dentro de la carpeta de datos.

Los ajustes de pantalla de la aplicación (idioma, tema, preajustes, el historial de chats de IA, etc.) no se guardan en `novira-data`, sino en el área de almacenamiento propia de la pantalla de la aplicación.

### Copias de seguridad

novira tiene una función para crear una copia de seguridad y otra para restaurar desde ella. Para proteger las imágenes importantes, hay que usar la sección **{{ui:share.backup.section}}** de los ajustes (véase [Asistente de IA y ajustes](09-assistant-settings.md#copia-de-seguridad)). Una copia de seguridad contiene las imágenes creadas y lo que se ha configurado o registrado en la aplicación, pero no los modelos ni el motor de generación de imágenes. Si también se quieren conservar, hay que copiar la carpeta manualmente.

1. Cerrar la aplicación (comprobando también que no se esté creando nada).
2. Copiar la carpeta `novira-data` entera a otra unidad o similar.

Las más grandes son `models` y `comfyui`. Si solo se quieren conservar las imágenes y los registros, las partes principales son `outputs` y `novira.sqlite`. Los modelos de `models` suelen poder descargarse de nuevo desde donde se obtuvieron, pero los que ya no se distribuyen pueden no ser recuperables.

> Las claves de API y los tokens se cifran con una función de Windows. Es posible que no se puedan leer si se copian a otro ordenador o a otro usuario, así que en ese caso hay que volver a introducirlos en los ajustes.

Los ajustes de pantalla de la aplicación, los preajustes y el historial de chats de IA no se incluyen en esta copia de la carpeta, pero sí en una copia de seguridad.

## Cómo leer los registros

Los registros se pueden ver en tres lugares.

| Lugar | Qué contiene |
|---|---|
| {{ui:app.devlog.title}} (dentro de la aplicación) | Los registros internos de la aplicación, y los avisos y errores en pantalla. Su visualización se activa en los ajustes ([Asistente de IA y ajustes](09-assistant-settings.md)) |
| `novira-data\logs\novira.log` | El registro propio de la aplicación. Cuando crece (más de 2 MB), pasa a `novira.log.1` |
| `novira-data\logs\comfyui.log` | El registro del motor de generación de imágenes. El motivo aparece aquí cuando no puede iniciarse o cuando falla la generación |

En un registro, las líneas nuevas se añaden al final. Cuando ha pasado algo, hay que mirar cerca del final. Las líneas que contienen «error» o «failed» son las pistas.

## Al informar de un problema

Si se tiene lo siguiente en conjunto, la causa se puede encontrar antes.

1. **Qué se hizo y qué pasó**: el orden de las acciones, lo que se esperaba y lo que ocurrió realmente.
2. **Las palabras de la pantalla**: copiar exactamente el texto del error (el **{{ui:queue.detail.error}}** de la pestaña **{{ui:app.tabs.queue}}** o el mensaje que apareció en la parte superior de la pantalla).
3. **La versión de la aplicación**: se muestra abajo del todo en la pantalla de ajustes o en **{{ui:app.nav.about}}**.
4. **El registro de desarrollo**: el texto copiado con **{{ui:app.devlog.copy}}**.
5. **Los archivos de registro**: `novira.log` y `comfyui.log`, de alrededor del momento en que ocurrió el problema.
6. **Información sobre el ordenador**: el tipo de GPU y su memoria, y la versión de Windows.

> Los registros pueden contener prompts y ubicaciones de archivos. Antes de entregarlos a alguien, conviene comprobar si hay algo que no se quiera mostrar.

## Ajustes avanzados

Si se coloca un `settings.json` en la carpeta de datos, se puede cambiar el comportamiento de cosas como el motor. Normalmente no hace falta.

| Nombre del ajuste | Qué es |
|---|---|
| `comfyuiPackage` | El tipo de motor que se instala. `nvidia` (predeterminado) o `amd` |
| `comfyuiUrl` | Conectar con un ComfyUI que ya está en marcha (la aplicación no instala ni inicia un motor) |
| `comfyuiDir` | Usar la carpeta de un ComfyUI instalado por uno mismo |
| `modelRoots` | Añadir carpetas donde buscar modelos |
| `comfyuiStartTimeoutSecs` | El número de segundos de espera a que se inicie el motor (predeterminado 180) |
| `lowMemoryMode` | Modo de poca memoria (`true` o `false`). Al cambiar **{{ui:settings.lowMemory.label}}** en los ajustes se escribe aquí |

Si el archivo está mal escrito, la aplicación no se inicia y muestra el motivo. Tras hacer un cambio, hay que volver a abrir la aplicación.
