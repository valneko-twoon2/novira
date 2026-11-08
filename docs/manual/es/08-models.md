# Gestión y búsqueda de modelos

Para crear imágenes hace falta un «modelo», que es el origen de las imágenes. novira tiene la pestaña **{{ui:app.tabs.models}}**, para organizar los modelos disponibles, y la pestaña **{{ui:app.tabs.browse}}**, para buscar e instalar modelos en internet.

Este capítulo explica cómo usar las dos pestañas, los tipos de modelos y cómo leer las licencias.

## Tipos de modelos

Un modelo tiene una «{{ui:models.sort.base}}» (a qué familia pertenece) y un «{{ui:models.sort.type}}» (qué función cumple).

### Base (familia)

Los modelos se crean por familias, y los de familias distintas no se pueden combinar. Por ejemplo, un LoRA creado para SD1.5 no se puede usar con un modelo SDXL.

| Se muestra como | Qué es |
|---|---|
| SD1.X | Stable Diffusion 1.5 y similares. Funciona con poca carga |
| SD2.X | La familia Stable Diffusion 2 |
| SDXL | La familia Stable Diffusion XL. Aquí entran también muchos modelos de ilustración (Illustrious, NoobAI, Pony, etc.) |
| SD3.X | La familia Stable Diffusion 3 |
| FLUX | La familia FLUX |
| Any | Lo que no depende de una familia (ampliadores y similares) |

> Además de SD1.X, SD2.X y SDXL, los modelos de las familias más recientes (Anima, Flux, FLUX.2, Chroma, Qwen-Image, Z-Image, SD3, HiDream, AuraFlow, HunyuanImage y Hunyuan-DiT) pueden generar imágenes, y los modelos Wan, HunyuanVideo y LTX-Video crean vídeo en la pantalla de vídeo. Los modelos de otras familias aparecen en la lista, pero generar con ellos falla e indica la familia. Cómo los trata la aplicación se explica en el capítulo sobre cómo crear imágenes.

Si las bases del modelo y del LoRA no coinciden, el botón de generar de la pantalla **{{ui:app.tabs.generate}}** no se puede pulsar y se muestra el motivo.

### Tipos

| Tipo | Función |
|---|---|
| {{ui:models.rail.main}} ({{ui:models.type.main}}) | El cuerpo principal que dibuja la imagen |
| {{ui:models.type.lora}} | Un modelo pequeño que se añade al principal para dar un estilo artístico o un personaje |
| {{ui:models.type.vae}} | Una pieza que se usa para terminar los colores y los detalles de una imagen |
| {{ui:models.type.controlnet}}, {{ui:models.type.modelPatch}} | Especifican la forma de una imagen, como una pose o un dibujo lineal (los parches de modelo son para Anima, Qwen-Image y Z-Image) |
| {{ui:models.type.ipAdapter}}, {{ui:models.type.clipVision}} | Trasladan el ambiente de una imagen de referencia a la generación |
| {{ui:models.rail.upscale}} | Amplían imágenes |
| {{ui:models.rail.encoders}} | Piezas que entienden el texto (T5, Qwen, CLIP, etc.; lo que Anima o Flux necesitan además del propio modelo) |
| {{ui:models.rail.diffusion}} | Modelos que se distribuyen solo como cuerpo del modelo, como Flux, Wan, Anima y Qwen-Image. Al instalar uno, novira lee el archivo para saber su clase y su familia |

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

En la parte inferior izquierda de una tarjeta hay etiquetas con la base (SDXL, etc.) y el formato. Un modelo cuya licencia se conoce tiene además una etiqueta de licencia en la parte superior izquierda ([Etiquetas de licencia](#etiquetas-de-licencia)); al pulsarla se abre allí mismo lo que permite la licencia, sin elegir la tarjeta. Cuando las tarjetas son pequeñas, la etiqueta muestra solo su marca. Al pasar el ratón sobre una tarjeta aparecen una estrella (favorito) y un menú.

En la parte inferior derecha de la pantalla se muestran el número de modelos y su tamaño total.

### Añadir modelos

Hay dos botones en la parte superior derecha.

- **{{ui:models.find}}**: pasa a la pestaña **{{ui:app.tabs.browse}}** (véase la sección correspondiente de este capítulo).
- **{{ui:models.import}}**: incorpora archivos propios o un modelo cuya dirección se conoce.

Al pulsar **{{ui:models.import}}** se abre la pantalla **{{ui:models.import.title}}**, donde se puede elegir entre cuatro métodos.

| Pestaña | Cómo se usa |
|---|---|
| {{ui:models.install.tab.source}} | Introduzca la dirección de un modelo y pulse **{{ui:models.install.install}}** |
| {{ui:models.install.tab.scan}} | Pulse **{{ui:models.install.scan}}** y elija una carpeta en el cuadro de diálogo que se abre; se listan los modelos que contiene. **{{ui:models.install.installAll}}** los incorpora todos de una vez. Los archivos de su ordenador se instalan desde aquí. No está disponible en un navegador |
| {{ui:models.install.tab.starter}} | La aplicación ha elegido y alineado modelos prácticos para tener al principio. También se instalan los modelos de los que dependen (como un VAE). También se listan los paquetes de modelos de vídeo, música, voz, logotipos y borrado. Se muestran como tarjetas, igual que en la pantalla Modelos. Acótelos con **{{ui:models.starter.purposes}}**, a la izquierda (crear imágenes, vídeo, ampliación, etc.), y con la lista **{{ui:models.starter.allFamilies}}** de la parte superior (Anima, SDXL, etc.). Al elegir una familia también se listan los VAE y codificadores que necesita |
| {{ui:models.install.tab.huggingface}} | Un campo para buscar por el nombre del repositorio de Hugging Face (`autor/nombre`) |

Lo que se puede introducir en el campo **{{ui:models.install.tab.source}}** es lo siguiente.

- La dirección de la página de un modelo en Civitai
- Una dirección directa a un archivo de modelo (una que empiece por `https://`)
- Un archivo de Hugging Face (con la forma `autor/nombre::nombre-del-archivo`)

Si introduce la ubicación de un archivo de su ordenador (con una forma como `C:\models\model.safetensors`), se le indica que use **{{ui:models.install.tab.scan}}**. Un archivo elegido allí se incorpora a la carpeta de modelos de la aplicación (en la misma unidad, el espacio en disco casi no aumenta. En otra unidad, se copia).

> La pestaña **{{ui:models.install.tab.huggingface}}** lista los archivos de modelo individuales (`.safetensors`, `.gguf`, `.ckpt`, `.pt`, `.pth`) de un repositorio después de introducirlo (`autor/nombre`) y pulsar **{{ui:models.install.hfLookup}}**. No se listan los archivos de las carpetas de una canalización diffusers, como `unet` y `vae`. Si hay un token de Hugging Face guardado, la lista se obtiene con él.

La instalación avanza por orden. El progreso se puede ver en **{{ui:models.queue.title}}**, que aparece al pulsar **{{ui:models.dock.queue}}** en la parte inferior izquierda de la pantalla (mientras trabaja muestra «N instalando»). Aquí también se puede **{{ui:models.queue.cancel}}** de uno en uno, y ordenar los terminados con **{{ui:models.queue.prune}}**.

Un archivo que está a medio descargar entra en la carpeta de modelos solo cuando se completa. Aunque se interrumpa a mitad, no queda ningún archivo a medias.

### Detalles del modelo

![Al elegir un modelo, sus detalles aparecen a la derecha. Se alinean el tamaño, la ubicación, la licencia, el origen, etc.](shot:models-detail)

Al pulsar una tarjeta, los detalles se abren a la derecha. Para cerrarlos, pulse **{{ui:models.detail.close}}** en la parte superior derecha.

Los detalles muestran el nombre, las etiquetas de base y tipo, la descripción, **{{ui:models.details.size}}**, **{{ui:models.details.path}}** (se puede copiar), **{{ui:models.details.license}}** y **{{ui:models.details.source}}** y **{{ui:models.details.page}}** (la dirección del modelo original; púlsela para abrirla en el navegador).

Cuando un modelo tiene varias imágenes, las flechas a ambos lados de la imagen cambian entre ellas, y el número de la actual aparece en la parte inferior derecha (un modelo instalado desde Civitai recibe las imágenes de su página original).

Con los botones de la parte superior se puede hacer lo siguiente.

- **{{ui:common.edit}}**: corrige el nombre, la descripción, la base y el tipo. Úselo cuando la base o el tipo no se hayan juzgado correctamente de forma automática.
- **{{ui:common.delete}}**: elimina el modelo (véase más abajo).

Cuando un modelo instalado desde Civitai tiene una versión más nueva, su tarjeta recibe una etiqueta **{{ui:models.updates.tag}}**, y el nombre y la fecha de la versión más nueva aparecen sobre los detalles. Pulse **{{ui:models.updates.open}}** para abrir la página de la versión más nueva en el navegador. La comprobación se ejecuta sola al abrir la pestaña Modelos (si la última tiene un día o más), y un aviso indica cuándo se encuentra algo nuevo. Para comprobar al instante, pulse el botón **{{ui:models.updates.check}}** de la parte superior. Solo se ofrecen versiones más nuevas de la misma base, y las versiones de pago se dejan fuera. La comprobación envía a Civitai los números de Civitai de los modelos que instaló.

### Frases activadoras

Los LoRA y similares tienen palabras (frases activadoras) que surten efecto al ponerlas en el prompt. Si las registra en **{{ui:models.triggers.title}}**, al elegir ese LoRA en la pantalla **{{ui:app.tabs.generate}}** las palabras aparecen como botones. Al pulsar uno, se añade al prompt.

Escriba una palabra en el campo de entrada y pulse **{{ui:common.add}}** para registrarla. Se puede quitar con la ×. Los cambios se guardan al instante. En los modelos instalados desde Civitai, las palabras que da el distribuidor pueden venir ya introducidas.

### Ajustes predeterminados

Un modelo principal tiene **{{ui:models.defaults.title}}**. Son valores que se rellenan automáticamente al elegir ese modelo en la pantalla de generación.

- **{{ui:models.defaults.scheduler}}**
- **{{ui:models.defaults.steps}}**
- **{{ui:models.defaults.cfgScale}}**
- Ancho y alto

También se pueden guardar **{{ui:models.defaults.vae}}** y **{{ui:models.defaults.vaePrecision}}**. Solo se guardan los elementos cuyo interruptor activó. Pulse **{{ui:common.save}}** para confirmar.

Los «valores recomendados» varían de un modelo a otro, así que si configura una vez los modelos que usa a menudo, no tendrá que corregirlos cada vez.

### Eliminación

Al pulsar **{{ui:common.delete}}**, aparece una confirmación. **{{ui:models.deleteWarning}}**

Sin embargo, un modelo que novira instaló (uno dentro de la carpeta de datos de la aplicación) se elimina junto con su archivo, mientras que un modelo de una carpeta que preparó usted mismo solo se quita de la lista y el archivo permanece.

## Etiquetas de licencia

Los modelos tienen unas condiciones de uso (una licencia) fijadas por su distribuidor. novira muestra sus puntos clave con etiquetas.

| Etiqueta | Significado |
|---|---|
| {{ui:browse.commercial.allowed}} | Se permiten la venta de las imágenes generadas, el uso en servicios de generación y la venta del propio modelo |
| {{ui:browse.commercial.limited}} | Solo se permiten algunos de los usos comerciales (una etiqueta con algunos usos sin indicar también es esta) |
| {{ui:browse.commercial.denied}} | No se permite ni la venta de las imágenes generadas, ni el uso en servicios de generación, ni la venta del propio modelo |

Al pulsar una etiqueta, aparece la lista **{{ui:browse.permission.title}}**. En ella se ve, para cosas como «{{ui:browse.permission.sellImages}}», «{{ui:browse.permission.sellModel}}» y «{{ui:browse.permission.shareMerges}}», si cada una está permitida, no permitida o sin indicar.

La etiqueta se decide a partir de los permisos de uso que el autor fijó en Civitai y de la licencia que se muestra en Hugging Face. Es una orientación basada en lo que muestran los sitios; en definitiva, compruebe el texto de la licencia del distribuidor. **{{ui:browse.permission.disclaimer}}**

Cuando no se conoce la licencia de un modelo instalado, se muestra **{{ui:models.details.licenseUnknown}}**.

> También hay modelos con licencias no comerciales. Por ejemplo, el **{{ui:video.model.fast}}** de vídeo tiene una licencia no comercial. Cuando use las imágenes o los vídeos que cree para trabajo o para la venta, asegúrese de comprobar la licencia del modelo que utilizó.

## La pestaña Explorar

![La pestaña Explorar. Arriba, dónde buscar, el tipo, el campo de búsqueda y los filtros; debajo, las tarjetas de modelos alineadas](shot:browse)

La pestaña **{{ui:app.tabs.browse}}** es una pantalla para buscar modelos en internet e instalarlos de inmediato.

### Dónde buscar

Con el interruptor de la parte superior izquierda se elige dónde buscar.

- **{{ui:browse.source.civitai}}**: un sitio donde se reúnen muchas ilustraciones y LoRA.
- **{{ui:browse.source.huggingface}}**: un sitio con muchos modelos de instituciones de investigación y empresas. Allí los modelos no se pueden encontrar por nombre, así que pegue la URL de la página del modelo (vale la de una carpeta o de un archivo) o `propietario/nombre` en el cuadro grande del centro de la pantalla y pulse **{{ui:models.install.hfLookup}}**. Marque los archivos que se muestran y pulse el botón de instalar de la parte superior derecha para iniciar la descarga. Si pegó la URL de una carpeta, al principio solo se muestran los archivos de esa carpeta.

Junto a él, elija el **{{ui:browse.kind.label}}**. Son **{{ui:browse.kind.lora}}**, **{{ui:browse.kind.checkpoint}}**, **{{ui:browse.kind.controlnet}}**, **{{ui:browse.kind.vae}}**, **{{ui:browse.kind.diffusion}}** y **{{ui:browse.kind.all}}**.

### Filtrado

En el campo de búsqueda, introduzca el nombre de un modelo, un autor o una etiqueta. Después de introducirlo y esperar un momento, los resultados se reemplazan.

Los resultados se pueden acotar con los menús de la derecha.

| Elemento | Qué es |
|---|---|
| {{ui:browse.base.label}} | {{ui:browse.base.sdxlCompat}}, {{ui:browse.base.illustrious}}, {{ui:browse.base.noobai}}, {{ui:browse.base.sdxl}}, {{ui:browse.base.pony}}, {{ui:browse.base.sd15}}, {{ui:browse.base.flux}}, {{ui:browse.base.anima}}, etc. |
| {{ui:browse.sort.label}} | {{ui:browse.sort.downloads}}, {{ui:browse.sort.rating}}, {{ui:browse.sort.newest}} |
| {{ui:browse.period.label}} | Todo el tiempo, Año, Mes, Semana, Día (solo Civitai). Una versión de pago muestra «{{ui:browse.paid.badge}}» en su tarjeta, y un acceso anticipado muestra además el día en que pasa a ser gratuito. Una versión de pago no se puede instalar (su botón no se puede pulsar), porque la aplicación no puede saber si la compró; consígala en la página de Civitai |
| {{ui:browse.nsfw.label}} | Desactivado por defecto. Al activarlo, también aparecen modelos orientados a adultos |
| **{{ui:browse.filter.button}}** | Abre un cuadro donde se puede acotar por lo que permite la licencia (venta de imágenes generadas, uso en servicios de generación, etc.; solo aparecen los modelos que permiten todo lo que marque), el tipo de checkpoint, el precio ({{ui:browse.filter.free}} o {{ui:browse.filter.paid}}), solo los modelos que tienen un archivo safetensors, y el autor (exactamente el mismo nombre). El botón muestra cuántos filtros hay fijados, y **{{ui:browse.filter.reset}}** los borra (solo Civitai) |

Al desplazarse hasta el final, se cargan más. También se pueden cargar más con **{{ui:browse.status.loadMore}}**. Si no se pudo obtener, pulse **{{ui:browse.status.retry}}**.

### Leer una tarjeta e instalar

Una tarjeta muestra una imagen de muestra, el nombre del modelo, el autor, el número de descargas, el número de «me gusta» y la etiqueta de licencia. En los LoRA también se muestran las palabras activadoras.

- **{{ui:browse.card.download}}**: instala el archivo representativo de ese modelo.
- El icono de la derecha (**{{ui:browse.card.openCivitai}}**): abre el sitio del distribuidor en el navegador.

Al pulsar una tarjeta, los detalles se abren desde la derecha. Se pueden ver las versiones, la lista de archivos (tamaño y formato), las palabras activadoras, las etiquetas, la descripción y la licencia. Elija una versión y pulse **{{ui:browse.card.download}}** en el archivo que quiera instalar. Al pulsar una palabra activadora, se copia. Se cierra pulsando fuera o con `Esc`.

La sección **{{ui:browse.samples.title}}** de los detalles lista las imágenes de ejemplo de esa versión que comparten sus ajustes. Se ven la imagen, el muestreador, los pasos, el CFG y el tamaño, el prompt, y los modelos y LoRA que usó (los que no ha instalado aparecen con línea discontinua). Pulse **{{ui:browse.samples.use}}** para poner el prompt y los ajustes en la pantalla de generación. Un ajuste que el ejemplo no registró se queda como está, y el modelo y los LoRA se aplican solo si los tiene instalados; el aviso nombra los que no tiene. Los ajustes son lo que escribió el autor, así que algunos ejemplos no tienen ninguno, y algunos no darán la misma imagen tal cual.

Cuando empieza la instalación, aparece una pequeña caja titulada **{{ui:browse.dock.title}}** en la parte inferior izquierda de la pantalla y se puede ver el progreso. Se puede detener con **{{ui:browse.dock.cancel}}**, y borrar los terminados con **{{ui:browse.dock.clear}}**. Una tarjeta que ha terminado de instalarse cambia a **{{ui:browse.card.installed}}** y también se añade a la lista de la pestaña **{{ui:app.tabs.models}}**.

> Cuando descargue un modelo que requiere iniciar sesión, registre su clave de API de Civitai en **{{ui:settings.title}}**. Cuando use un modelo de Hugging Face que requiere una solicitud de acceso, registre su token de Hugging Face. Ambos se guardan cifrados en este ordenador y no se muestran en pantalla. Para más detalles, vaya a [El agente, los ajustes y los atajos](09-assistant-settings.md).

> Para obtener de Civitai la imagen y la licencia de sus modelos locales, active **{{ui:settings.engine.civitai.label}}** en **{{ui:settings.tab.engine}}**, dentro de **{{ui:settings.title}}**. novira envía a Civitai el hash de cada archivo de modelo, por lo que está desactivado por defecto. El cambio se aplica en el siguiente inicio. Mientras está desactivado y un modelo no tiene imagen, una nota sobre la lista de la pestaña **{{ui:app.tabs.models}}** lo indica, y **{{ui:models.coverHint.open}}** abre los ajustes.

Para seguir con la creación de imágenes, vaya a [Crear imágenes](02-generate.md).
