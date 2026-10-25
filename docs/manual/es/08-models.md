# Gestión y búsqueda de modelos

Para crear imágenes hace falta un «modelo», que es el origen de las imágenes. novira tiene la pestaña **{{ui:app.tabs.models}}**, para organizar los modelos disponibles, y la pestaña **{{ui:app.tabs.browse}}**, para buscar e instalar modelos en internet.

Este capítulo explica cómo usar las dos pestañas, los tipos de modelos y cómo leer las licencias.

## Tipos de modelos

Un modelo tiene una «{{ui:models.sort.base}}» (a qué familia pertenece) y un «{{ui:models.sort.type}}» (qué función cumple).

### Base (familia)

Cada modelo pertenece a una familia, y los de familias distintas no se pueden combinar. Por ejemplo, un LoRA creado para SD1.5 no se puede usar con un modelo SDXL.

| Se muestra como | Qué es |
|---|---|
| SD1.X | Stable Diffusion 1.5 y similares. Funciona con poca carga |
| SD2.X | La familia Stable Diffusion 2 |
| SDXL | La familia Stable Diffusion XL. Aquí entran también muchos modelos de ilustración (Illustrious, NoobAI, Pony, etc.) |
| SD3.X | La familia Stable Diffusion 3 |
| FLUX | La familia FLUX |
| Any | Lo que no depende de una familia (ampliadores y similares) |

> En la versión de escritorio actual, los modelos que se pueden usar para generar imágenes son SD1.X, SD2.X y SDXL. FLUX y SD3.X aparecen en la lista, pero si se inicia una generación con ellos, se obtiene un error que significa «aún no compatible».

Si las bases del modelo y del LoRA no coinciden, el botón **{{ui:params.invoke.invoke}}** de la pantalla **{{ui:app.tabs.generate}}** no se puede pulsar y se muestra el motivo.

### Tipos

| Tipo | Función |
|---|---|
| {{ui:models.rail.main}} ({{ui:models.type.main}}) | El cuerpo principal que dibuja la imagen |
| {{ui:models.type.lora}} | Un modelo pequeño que se añade al principal para dar un estilo artístico o un personaje |
| {{ui:models.type.vae}} | Una pieza que se usa para terminar los colores y los detalles de una imagen |
| {{ui:models.type.controlnet}} | Especifica la forma de una imagen, como una pose o un dibujo lineal |
| {{ui:models.type.ipAdapter}}, {{ui:models.type.clipVision}} | Trasladan el ambiente de una imagen de referencia a la generación |
| {{ui:models.rail.upscale}} | Amplían imágenes |
| {{ui:models.rail.encoders}} | Piezas que entienden el texto |
| {{ui:models.rail.diffusion}} | Modelos que se usan para vídeo, como Wan, o para flujos especiales |

Los modelos de vídeo, música, voz y logotipos no aparecen en esta lista. Se descargan desde cada una de sus pantallas ([Vídeo, música, voz, logotipos y texto](07-media.md)).

## La pestaña Modelos

![La pestaña Modelos. Categorías a la izquierda y tarjetas de modelos alineadas en el centro](shot:models)

La pestaña **{{ui:app.tabs.models}}** es una lista de los modelos disponibles.

### Búsqueda

Con **{{ui:models.rail.title}}**, a la izquierda, se puede acotar la lista por tipo. La cantidad aparece a la derecha.

- **{{ui:models.rail.all}}**: todo
- **{{ui:models.rail.favorites}}**: los que tienen una estrella
- **{{ui:models.rail.main}}**, **{{ui:models.rail.lora}}**, **{{ui:models.rail.controlnet}}**, **{{ui:models.rail.vae}}**, **{{ui:models.rail.ipAdapter}}**, **{{ui:models.rail.upscale}}**, **{{ui:models.rail.encoders}}**, **{{ui:models.rail.diffusion}}**

En la barra superior se puede acotar por nombre (**{{ui:models.searchPlaceholder}}**), acotar por base, **{{ui:models.sort.label}}** ({{ui:models.sort.name}}, {{ui:models.sort.size}}, {{ui:models.sort.base}}, {{ui:models.sort.type}}), cambiar entre **{{ui:models.view.grid}}** y **{{ui:models.view.list}}**, y ajustar el tamaño de las miniaturas.

En la parte inferior izquierda de una tarjeta hay etiquetas con la base (SDXL, etc.) y el formato. Al pasar el ratón sobre una tarjeta aparecen una estrella (favorito) y un menú.

En la parte inferior derecha de la pantalla se muestran el número de modelos y su tamaño total.

### Añadir modelos

Hay dos botones en la parte superior derecha.

- **{{ui:models.find}}**: pasa a la pestaña **{{ui:app.tabs.browse}}** (véase la sección correspondiente de este capítulo).
- **{{ui:models.import}}**: incorpora archivos propios o un modelo cuya dirección se conoce.

Al pulsar **{{ui:models.import}}** se abre la pantalla **{{ui:models.import.title}}**, donde se puede elegir entre cuatro métodos.

| Pestaña | Cómo usarla |
|---|---|
| {{ui:models.install.tab.source}} | Introducir la dirección de un modelo o la ubicación de un archivo del ordenador y pulsar **{{ui:models.install.install}}** |
| {{ui:models.install.tab.scan}} | Introducir la ubicación de una carpeta y pulsar **{{ui:models.install.scan}}**, y se listan los modelos que contiene. **{{ui:models.install.installAll}}** los incorpora todos de una vez |
| {{ui:models.install.tab.starter}} | La aplicación ha elegido y ordenado modelos prácticos para empezar. Los modelos de los que dependen (como un VAE) se incluyen también |
| {{ui:models.install.tab.huggingface}} | Un campo para buscar por el nombre de repositorio de Hugging Face (`author/name`) |

Lo que se puede introducir en el campo **{{ui:models.install.tab.source}}** es lo siguiente.

- La dirección de la página de un modelo en Civitai
- Una dirección directa a un archivo de modelo (una que empiece por `https://`)
- La ubicación de un archivo del ordenador (con una forma como `C:\models\model.safetensors`)
- Un archivo de Hugging Face (con la forma `author/name::filename`)

Cuando se indica un archivo del ordenador, este se incorpora a la carpeta de modelos de la aplicación (en la misma unidad, el espacio en disco apenas aumenta. En una unidad distinta, se copia).

> Tras escribir un repositorio (`autor/nombre`) y pulsar **{{ui:models.install.hfLookup}}**, la pestaña **{{ui:models.install.tab.huggingface}}** muestra los archivos de modelo sueltos (`.safetensors`, `.gguf`, `.ckpt`, `.pt`, `.pth`) del repositorio. No aparecen los archivos de carpetas de una canalización de diffusers, como `unet` y `vae`. Si hay un token de Hugging Face guardado, la lista se obtiene con él.

La instalación avanza por orden. El progreso se puede ver en **{{ui:models.queue.title}}**, que aparece al pulsar **{{ui:models.dock.queue}}** en la parte inferior izquierda de la pantalla (durante el trabajo muestra «N instalando»). Aquí también se puede **{{ui:models.queue.cancel}}** de uno en uno y quitar los terminados con **{{ui:models.queue.prune}}**.

Un archivo que está a medias de descargarse pasa a la carpeta de modelos solo cuando se completa. Aunque se detenga a mitad, no queda ningún archivo a medio terminar.

### Detalles del modelo

![Al elegir un modelo, sus detalles aparecen a la derecha. Tamaño, ubicación, licencia, origen, etc. aparecen en filas](shot:models-detail)

Al pulsar una tarjeta, los detalles se abren a la derecha. Para cerrarlos, hay que pulsar **{{ui:models.detail.close}}** en la parte superior derecha.

Los detalles muestran el nombre, las etiquetas de base y tipo, la descripción, **{{ui:models.details.size}}**, **{{ui:models.details.path}}** (se puede copiar), **{{ui:models.details.license}}** y **{{ui:models.details.source}}**.

Con los botones de la parte superior se puede hacer lo siguiente.

- **{{ui:models.detail.openSource}}**: abre la página del distribuidor en el navegador (solo para modelos que tienen una dirección).
- **{{ui:common.edit}}**: corrige el nombre, la descripción, la base y el tipo. Se usa cuando la base o el tipo no se determinaron correctamente de forma automática.
- **{{ui:common.delete}}**: elimina el modelo (véase más abajo).

### Frases activadoras

Los LoRA y similares tienen palabras (frases activadoras) que surten efecto al ponerlas en el prompt. Si se registran en **{{ui:models.triggers.title}}**, al elegir ese LoRA en la pantalla **{{ui:app.tabs.generate}}** las palabras aparecen como botones. Al pulsar uno, se añade al prompt.

Se escribe una palabra en el campo de entrada y se pulsa **{{ui:common.add}}** para registrarla. Se puede quitar con la ×. Los cambios se guardan de inmediato. En los modelos instalados desde Civitai, las palabras que da el distribuidor pueden estar ya introducidas desde el principio.

### Ajustes predeterminados

Un modelo principal tiene **{{ui:models.defaults.title}}**. Son valores que se rellenan automáticamente al elegir ese modelo en la pantalla de generación.

- **{{ui:models.defaults.scheduler}}**
- **{{ui:models.defaults.steps}}**
- **{{ui:models.defaults.cfgScale}}**
- Ancho y alto

También se pueden guardar **{{ui:models.defaults.vae}}** y **{{ui:models.defaults.vaePrecision}}**. Solo se guardan los elementos cuyo interruptor se activó. Se pulsa **{{ui:common.save}}** para confirmar.

Los «valores recomendados» difieren de un modelo a otro, así que si se configuran una vez los modelos que más se usan, no hace falta corregirlos cada vez.

### Eliminación

Al pulsar **{{ui:common.delete}}** aparece una confirmación. **{{ui:models.deleteWarning}}**

Sin embargo, un modelo que instaló novira (uno dentro de la carpeta de datos de la aplicación) se elimina junto con su archivo, mientras que un modelo de una carpeta preparada por uno mismo solo se quita de la lista y el archivo permanece.

## Etiquetas de licencia

Los modelos tienen unas condiciones de uso (una licencia) fijadas por su distribuidor. novira muestra los puntos clave con etiquetas.

| Etiqueta | Significado |
|---|---|
| {{ui:browse.commercial.allowed}} | Se permite vender las imágenes generadas y usar el modelo en servicios de generación |
| {{ui:browse.commercial.limited}} | Hay condiciones para el uso comercial (por ejemplo, solo vender imágenes generadas) |
| {{ui:browse.commercial.denied}} | No se permite el uso comercial. Se limita al uso personal |

Al pulsar una etiqueta aparece la lista **{{ui:browse.permission.title}}**. Se puede ver, para cosas como «{{ui:browse.permission.sellImages}}», «{{ui:browse.permission.sellModel}}» y «{{ui:browse.permission.shareMerges}}», si cada una está permitida, no permitida o sin indicar.

La etiqueta se determina a partir de los permisos de uso que fijó el autor en Civitai y de la licencia que muestra Hugging Face. Es una guía basada en lo que muestran los sitios, y en última instancia conviene comprobar el texto de la licencia del distribuidor. **{{ui:browse.permission.disclaimer}}**

Cuando no se conoce la licencia de un modelo instalado, se muestra **{{ui:models.details.licenseUnknown}}**.

> También hay modelos con licencias no comerciales. Por ejemplo, el vídeo **{{ui:video.model.fast}}** tiene una licencia no comercial. Al usar las imágenes o los vídeos creados para trabajo o para la venta, hay que comprobar sin falta la licencia del modelo utilizado.

## La pestaña Explorar

![La pestaña Explorar. Arriba, dónde buscar, el tipo, el campo de búsqueda y los filtros, y debajo las tarjetas de modelos alineadas](shot:browse)

La pestaña **{{ui:app.tabs.browse}}** es una pantalla para buscar modelos en internet e instalarlos de inmediato.

### Dónde buscar

Con el interruptor de la parte superior izquierda se elige dónde buscar.

- **{{ui:browse.source.civitai}}**: un sitio donde se reúnen muchas ilustraciones y LoRA.
- **{{ui:browse.source.huggingface}}**: un sitio con muchos modelos de instituciones de investigación y empresas. Allí no se pueden buscar modelos por nombre: pegue la URL de la página del modelo (sirve la página de una carpeta o de un archivo) o `owner/name` en el cuadro grande del centro de la pantalla y pulse **{{ui:models.install.hfLookup}}**. Marque los archivos que aparecen y pulse después el botón de instalar de arriba a la derecha para empezar la descarga. Si pegó la URL de una carpeta, al principio solo se muestran los archivos de esa carpeta.

A su lado se elige el **{{ui:browse.kind.label}}**. Son **{{ui:browse.kind.lora}}**, **{{ui:browse.kind.checkpoint}}**, **{{ui:browse.kind.controlnet}}**, **{{ui:browse.kind.vae}}**, **{{ui:browse.kind.diffusion}}** y **{{ui:browse.kind.all}}**.

### Filtrado

En el campo de búsqueda se introduce un nombre de modelo, un autor o una etiqueta. Tras introducirlo y esperar un momento, se sustituyen los resultados.

Los resultados se pueden acotar con los menús de la derecha.

| Elemento | Qué es |
|---|---|
| {{ui:browse.base.label}} | {{ui:browse.base.sdxlCompat}}, {{ui:browse.base.illustrious}}, {{ui:browse.base.noobai}}, {{ui:browse.base.sdxl}}, {{ui:browse.base.pony}}, {{ui:browse.base.sd15}}, {{ui:browse.base.flux}}, {{ui:browse.base.anima}}, etc. |
| {{ui:browse.sort.label}} | {{ui:browse.sort.downloads}}, {{ui:browse.sort.rating}}, {{ui:browse.sort.newest}} |
| {{ui:browse.period.label}} | Siempre, Año, Mes, Semana, Día (solo Civitai) |
| {{ui:browse.nsfw.label}} | Desactivado de forma predeterminada. Al activarlo, aparecen también modelos orientados a adultos |

Al desplazarse hasta el final se carga más. También se puede cargar más con **{{ui:browse.status.loadMore}}**. Si no se pudo obtener, se pulsa **{{ui:browse.status.retry}}**.

### Lectura de una tarjeta e instalación

Una tarjeta muestra una imagen de muestra, el nombre del modelo, el autor, el número de descargas, el número de «me gusta» y la etiqueta de licencia. En los LoRA se muestran también las palabras activadoras.

- **{{ui:browse.card.download}}**: instala el archivo representativo de ese modelo.
- El icono de la derecha (**{{ui:browse.card.openCivitai}}**): abre el sitio del distribuidor en el navegador.

Al pulsar una tarjeta, los detalles se abren desde la derecha. Se pueden ver las versiones, la lista de archivos (tamaño y formato), las palabras activadoras, las etiquetas, la descripción y la licencia. Se elige una versión y se pulsa **{{ui:browse.card.download}}** para el archivo que se quiere instalar. Al pulsar una palabra activadora, se copia. Se cierra pulsando fuera o con `Esc`.

Cuando empieza la instalación, aparece en la parte inferior izquierda de la pantalla un pequeño recuadro con la etiqueta **{{ui:browse.dock.title}}** y se puede ver el progreso. Se puede detener con **{{ui:browse.dock.cancel}}** y borrar los terminados con **{{ui:browse.dock.clear}}**. Una tarjeta que terminó de instalarse cambia a **{{ui:browse.card.installed}}** y se añade también a la lista de la pestaña **{{ui:app.tabs.models}}**.

> Al descargar un modelo que exige iniciar sesión, hay que registrar la clave de API de Civitai en **{{ui:settings.title}}**. Al usar un modelo de Hugging Face que exige una solicitud de acceso, hay que registrar el token de Hugging Face. Ambos se cifran y se guardan en este ordenador, y no se muestran en pantalla. Para más detalles, véase [Asistente de IA y ajustes](09-assistant-settings.md).

Para continuar con la generación de imágenes, véase [Crear imágenes](02-generate.md).
