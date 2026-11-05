# Crear imágenes

Este capítulo explica cómo crear imágenes en la pestaña **{{ui:app.tabs.generate}}**.
Para recorrer la pantalla, consulte [Primeros pasos](01-start.md); para ver y organizar las imágenes creadas, consulte [La galería y el visor](03-gallery.md).

El procedimiento es siempre el mismo.

1. Elegir el modelo
2. Escribir el prompt
3. Si hace falta, ajustar parámetros como el tamaño y la semilla
4. Pulsar **{{ui:params.invoke.invoke}}**

La imagen no empieza a dibujarse en el instante de pulsar el botón. Primero entra en la «{{ui:app.tabs.queue}}» (la cola de espera). Cuando le llega el turno, las imágenes se dibujan de una en una.

El modelo, los prompts y los ajustes que elija se conservan al cerrar la aplicación y se encuentran tal como estaban la próxima vez que la inicie.

## Escribir el prompt

![Pestaña Generar con una frase escrita en el prompt y la semilla fijada](shot:generate-prompt)

En «{{ui:params.prompt.title}}», en el panel izquierdo, hay 2 campos.

- **{{ui:params.prompt.positive}}**: aquí se escribe lo que se quiere que aparezca.
- **{{ui:params.prompt.negative}}**: aquí se escribe lo que no se quiere que aparezca. Por ejemplo, `blurry, watermark`. También se puede generar con el campo vacío.

Pautas para escribir:

- Escriba palabras o frases cortas separadas por comas (`,`).
- Con muchos modelos es más fácil obtener lo esperado escribiendo en inglés. Si la descripción del modelo indica cómo escribir, siga esa indicación.
- Ponga las palabras importantes al principio.

Los pequeños botones situados sobre los campos funcionan así. Solo tienen icono; deje el puntero encima para ver su nombre.

| Botón | Función |
|---|---|
| **{{ui:params.prompt.recommended}}** | Añade a «{{ui:params.prompt.positive}}» las palabras de calidad de uso general en la familia del modelo elegido, y al final de «{{ui:params.prompt.negative}}» las palabras que conviene evitar. Los modelos que se escriben con etiquetas (Illustrious, NoobAI, Pony, Anima, etc.) reciben al principio etiquetas como `masterpiece, best quality`; los que se escriben con frases (FLUX, Qwen-Image, etc.) reciben palabras de calidad al final. Los modelos que no usan prompt negativo (FLUX.1) no reciben palabras negativas. Las palabras que ya están no se añaden dos veces |
| **{{ui:params.prompt.expand}}** | Edita el prompt positivo y el negativo, uno junto al otro, en una ventana grande |
| **{{ui:params.prompt.textView}}** / **{{ui:params.prompt.tagView}}** | Cambia el campo entre texto normal y una fila de etiquetas, una por palabra. Al pulsar una etiqueta se abre un panel emergente: reescribir sus palabras, cambiar su intensidad con el control deslizante, restablecerla a 1 o quitar la etiqueta. Una etiqueta cuya intensidad ha cambiado se escribe en el prompt como `(smile:1.3)`. Escriba una palabra en el cuadro de abajo y pulse Intro para añadir una etiqueta |
| **{{ui:params.promptBook.open}}** | Abre los preajustes, palabras reunidas con su significado (se explican más adelante) |
| **{{ui:caption.fromPrompt}}** | Mira la imagen seleccionada en la galería (o, si no hay ninguna, un archivo de imagen que se elija) y escribe de una vez palabras utilizables como prompt. El resultado se muestra en la banda del visor. También se puede soltar sobre este botón una imagen de la galería o un archivo de imagen del ordenador (se explica en [Retocar y reutilizar imágenes](04-improve.md)) |

### Número de tokens

El «0 / 77 tokens» situado sobre el campo es una medida aproximada de la cantidad escrita.
Un token es una unidad con la que el modelo lee las palabras. Si se supera el límite, el número cambia a un color de aviso. Con algunos modelos, la parte que sobrepasa el límite puede tener menos efecto.
El número es aproximado, no un recuento exacto.

### Crear varias combinaciones a la vez con `{red|blue}`

Si en el campo positivo se escriben llaves con opciones separadas por barras verticales (`|`), como `{red|blue}`, se crea una imagen distinta por cada opción.

- Con `a {red|blue} flower` se obtienen 2 versiones: `a red flower` y `a blue flower`.
- Con dos o más pares de llaves se obtienen todas las combinaciones. `a {red|blue} {cat|dog}` da 4.
- También se pueden poner llaves dentro de llaves.
- Para usar una llave como carácter normal, anteponga `\` (`\{`).
- El número de combinaciones tiene un máximo de 100.

Si «{{ui:params.invoke.iterations}}» (se explica más adelante) es 2 o más, el número de imágenes creadas es el de combinaciones por las iteraciones. Por ejemplo, 2 combinaciones con las iteraciones en 3 dan 6 imágenes.
Esta sintaxis solo funciona en el campo positivo. En el campo negativo, las llaves se tratan como caracteres normales.

Para comprobar en qué textos se expande, use el botón **{{ui:params.prompt.dynamicPreview}}** (el icono `{ }`) situado sobre el campo positivo. Al pulsarlo aparece una lista de las combinaciones. El campo negativo tiene el mismo botón, y `{a|b}` y los comodines también funcionan en el prompt negativo. Las combinaciones son todos los pares de un positivo y un negativo.

### Comodines `__name__`

![Ventana de comodines: las listas a la izquierda, el nombre y las entradas de la lista elegida a la derecha](shot:wildcards)

Escriba `__name__` (dos guiones bajos antes y después del nombre) en el campo positivo, y las entradas de la lista «{{ui:params.wildcards.title}}» de ese nombre se colocan ahí de una en una. Si guarda en una lista las opciones que usa a menudo, ya no tendrá que escribir `{red|blue}` cada vez.

- `1girl, __hair-color__` crea un prompt por cada entrada de la lista hair-color.
- Las entradas pueden usar `{a|b}` y otros comodines. Los comodines dentro de comodines pueden anidarse hasta 6 niveles.
- El límite de combinaciones (100) es el mismo que con `{ }`.
- Un nombre sin lista, una lista sin entradas o una lista que se usa a sí misma impiden pulsar **{{ui:params.invoke.invoke}}**, y el motivo aparece bajo el botón.

Abra las listas con **{{ui:params.wildcards.open}}**, en la parte inferior de la ventana del botón **{{ui:params.prompt.dynamicPreview}}**. La aplicación incluye tres listas: hair-color, expression y time-of-day.

| Control | Función |
|---|---|
| **{{ui:params.wildcards.new}}** | Añade una lista vacía |
| El campo «{{ui:params.wildcards.name}}» | Cambia el nombre de la lista. Use letras, dígitos, `-` y `_`, empezando y terminando por una letra o un dígito |
| El campo «{{ui:params.wildcards.entries}}» | Una entrada por línea. Las líneas vacías y las que empiezan por `#` no son entradas |
| **{{ui:params.wildcards.import}}** / **{{ui:params.wildcards.export}}** | Lee o escribe una lista como archivo .txt con una entrada por línea. Un archivo importado se convierte en una lista nueva con el nombre del archivo |
| **{{ui:common.delete}}** | Elimina la lista elegida |

Las listas se guardan dentro de la aplicación (en el ordenador que se está usando).

### Elegir al azar

Cuando hay demasiadas combinaciones, cambie «{{ui:params.prompt.dynamicMode}}» en la ventana del botón **{{ui:params.prompt.dynamicPreview}}**.

- **{{ui:params.prompt.modeCombinatorial}}** (valor predeterminado): crea el número de imágenes indicado en las iteraciones por cada combinación.
- **{{ui:params.prompt.modeRandom}}**: crea el número de imágenes indicado en las iteraciones, eligiendo una combinación para cada imagen. La elección depende de la semilla de la imagen, así que al volver a dibujar con la misma semilla se obtiene el mismo prompt.

En ambos casos, cada imagen terminada conserva el prompt que realmente se usó.

## Semilla

Una imagen se crea a partir de un número llamado «{{ui:params.seed.label}}». Con la misma semilla y los mismos ajustes se obtiene la misma imagen.

En la fila «{{ui:params.seed.label}}», cerca de la parte superior del panel izquierdo, hay 2 botones.

- **{{ui:params.seed.random}}** (el dado): en cada generación se usa una semilla nueva. Se obtiene una imagen distinta cada vez. Es el valor predeterminado.
- **{{ui:params.seed.fixed}}** (el candado): se dibuja con la semilla actual. Por muchas veces que se cree con los mismos ajustes, se obtiene la misma imagen. Es útil para ver qué cambia al modificar una sola palabra del prompt.

Al fijarla, el campo numérico de la semilla y el botón «{{ui:params.seed.shuffle}}» quedan bloqueados (para evitar cambios accidentales).
Para usar un número concreto, escríbalo en el campo numérico con «{{ui:params.seed.random}}» seleccionado y después cambie a «{{ui:params.seed.fixed}}».
Para usar la semilla de una imagen que le gustó, abra esa imagen en la galería y pulse «{{ui:gallery.menu.useSeed}}»: la semilla se carga y queda fijada (consulte [La galería y el visor](03-gallery.md)).

Si se aumentan las iteraciones con la semilla fijada, a partir de la segunda imagen la semilla aumenta de uno en uno.

## Elegir el modelo

![La lista de modelos abierta, dividida por familias como FLUX, SDXL y SD1.X](shot:model-picker)

Con la tarjeta de modelo, situada cerca de la parte superior del panel izquierdo, se elige el modelo que dibuja la imagen.

1. Haga clic en el campo del nombre del modelo.
2. Elija en la lista. La lista está dividida por familias de modelos (FLUX, SDXL, SD1.X, etc.). Cuando hay muchos, escriba parte de un nombre en el campo de búsqueda de arriba para acotar.

Aquí también se pueden elegir modelos de Anima, Flux, FLUX.2, Chroma, Qwen-Image, Z-Image, SD3, HiDream, AuraFlow y HunyuanImage. Cuando el modelo, el codificador de texto y el VAE se distribuyen como archivos separados, la aplicación busca el codificador de texto y el VAE por nombre entre los modelos instalados. Al instalar un modelo al que le falta alguno, la aplicación pregunta enseguida «{{ui:params.parts.title}}» y muestra los nombres y tamaños, para que se instalen solo los archivos que faltan. Si se cierra con «Ahora no», el panel Generar conserva una nota de lo que le falta al modelo y un botón que instala esos archivos sin salir de la pantalla; una descarga superior a 5 GB vuelve a pedir confirmación tras pulsarlo. Los modelos iniciales de la pantalla Modelos (**{{ui:models.install.tab.starter}}**) también los instalan. Las máscaras, las capas de control y la corrección de alta resolución también funcionan con estos modelos. Las imágenes de referencia funcionan solo con modelos SD1.X y SDXL. Lo que se elija en «{{ui:params.generation.scheduler}}» no se usa: cada familia dibuja con su propio muestreador y planificador (`euler / simple` para Flux; solo Anima dibuja con el planificador elegido), y el campo «{{ui:params.generation.scheduler}}» muestra el par que se ejecutará. Si se elige un «{{ui:params.generation.sampler}}» o un «{{ui:params.generation.noiseSchedule}}», prevalece en un modelo de cualquier familia.

- **Modelos de edición.** FLUX Kontext y Qwen-Image-Edit modifican una imagen que se les da: coloque la imagen en el origen (imagen a imagen) y escriba en el prompt qué cambiar. FLUX Fill vuelve a dibujar la parte enmascarada (use inpaint u outpaint con máscara). Estos modelos no admiten la corrección de alta resolución, los borradores ni las capas de control. La aplicación los distingue de los modelos normales por lo que hay dentro del archivo o, en el caso de Kontext y los modelos de edición de Qwen, por la palabra `kontext` o `edit` en el nombre del archivo; no los renombre.
- **FLUX.2.** Los modelos klein funcionan en pocos pasos (use CFG 1 con los destilados); dev usa el valor de CFG como guía. Coloque una imagen en el origen (imagen a imagen) y FLUX.2 la edita según el prompt. Las máscaras, las capas de control y la corrección de alta resolución no están disponibles con FLUX.2 (los borradores sí).
- **Modelos cuantizados (GGUF).** Un archivo de modelo o de codificador de texto que termina en `.gguf` lo lee la extensión ComfyUI-GGUF. Instálela una vez desde la pantalla Extensiones (https://github.com/city96/ComfyUI-GGUF) y reinicie el motor; hasta entonces, la generación falla y lo indica.
- **Modelos hechos para otras entradas.** Los modelos que necesitan un vídeo de control, audio, una trayectoria de cámara o un vídeo de pose (por ejemplo Wan Fun Control, Wan Animate, Flux Canny) todavía no se pueden ejecutar aquí. La generación falla e indica lo que necesita el modelo.
3. El modelo elegido recibe una marca ✓, y la imagen de la tarjeta (la portada) también cambia.

Bajo la lista, el botón **{{ui:app.tabs.short.models}}** lleva a la pestaña {{ui:app.tabs.models}} (gestionar los modelos disponibles) y el botón **{{ui:app.tabs.short.browse}}** lleva a la pestaña {{ui:app.tabs.browse}} (buscar en internet). Cómo añadir más modelos se explica en [Preparar modelos](08-models.md).

Si para el modelo hay ajustes recomendados registrados (pasos, CFG, planificador, tamaño), se rellenan automáticamente al elegirlo.
Al cambiar a un modelo de otra familia, se quitan los LoRA y elementos similares que no encajan con el nuevo modelo (se indica cuántos se quitaron).

Pulse el botón **{{ui:params.profile.title}}**, bajo el campo del modelo, para ver en una lista los valores recomendados de ese modelo. Si los ajustes actuales difieren de los recomendados, el botón toma un color más llamativo, y **{{ui:params.profile.apply}}** pone todo en los valores recomendados. Los pasos se comprueban con un intervalo que va desde un poco por debajo hasta un poco por encima del número recomendado. Los modelos Anima se deshacen con facilidad con muy pocos pasos (la imagen puede salir de un solo color plano), por lo que su límite inferior es más alto (24 o más cuando se recomienda 30).

> Cuando no hay ningún modelo instalado, el campo indica «{{ui:params.model.noModels}}» y no se puede generar. Complete antes [Preparar modelos](08-models.md).

## Otros ajustes

Bajo el prompt hay secciones que agrupan los ajustes. Se abren y se cierran haciendo clic.

| Sección | Contenido |
|---|---|
| **{{ui:params.refImage.sectionLabel}}** (justo bajo el prompt) | Imágenes que sirven para orientar el ambiente o los personajes de una imagen (se explica más adelante) |
| **{{ui:params.i2i.title}}** | La imagen sobre la que se dibuja al redibujar a partir de una imagen, y la {{ui:params.image.strength}} (se explica más adelante) |
| **{{ui:params.image.title}}** | {{ui:params.image.aspect}}, ancho y alto. También están los botones «{{ui:params.image.swap}}», «{{ui:params.image.lock}}» y «{{ui:params.image.optimal}}» |
| **{{ui:params.generation.title}}** | LoRA (un pequeño modelo complementario que añade un estilo de dibujo o un personaje), {{ui:params.generation.scheduler}}, {{ui:params.generation.sampler}}, {{ui:params.generation.noiseSchedule}} (se eligen con los nombres propios de ComfyUI; «{{ui:params.generation.engineAuto}}» sigue el planificador o el propio del modelo y muestra el nombre que representa, como «Auto (nombre)»; FLUX.2 admite solo el muestreador), {{ui:params.generation.steps}}, {{ui:params.generation.cfg}} |
| **{{ui:params.hires.title}}** | Una segunda pasada que amplía la imagen dibujada y la vuelve a dibujar (véase más abajo) |
| **{{ui:params.advanced.title}}** | {{ui:params.advanced.vae}}, {{ui:params.advanced.clipSkip}}, {{ui:params.advanced.seamless}} (imágenes sin costuras visibles al repetirlas en mosaico; modelos SD1.X y SDXL, con la extensión ComfyUI-seamless-tiling instalada desde la pantalla Extensiones), etc. |

Si tiene dudas, todo salvo el tamaño puede quedar como se rellenó al elegir el modelo.
Deje el puntero sobre el nombre de un elemento («{{ui:params.generation.steps}}», «{{ui:params.generation.cfg}}», etc.) para ver una breve explicación. El encabezado de cada sección muestra un pequeño resumen de sus valores actuales.

Cuanto mayor es el tamaño, más tarda y más carga el ordenador. Se recomienda probar primero con un tamaño pequeño y, si el resultado es bueno, ampliarlo con [Ampliación](06-upscaling-workflows.md).

## Corrección de alta resolución

![La sección de corrección de alta resolución abierta y activada](shot:hires-fix)

Si se dibuja desde el principio con un tamaño grande, es frecuente que salgan dos personas en lugar de una o que las formas se deformen. **{{ui:params.hires.title}}** dibuja primero con el tamaño ajustado, amplía la imagen y la vuelve a dibujar con la misma semilla y los mismos ajustes. En una sola generación se obtiene una imagen grande y con detalle en todas partes. Esta sección está en las pestañas {{ui:app.tabs.generate}} y {{ui:app.tabs.comic}}.

- **{{ui:params.hires.enable}}**: actívela para usarla.
- **{{ui:params.hires.scale}}**: de 1,25 a 2 veces. El tamaño final se muestra en el encabezado de la sección y en la línea inferior.
- **{{ui:params.hires.strength}}**: de 0,2 a 0,75. Un valor bajo conserva casi tal cual la primera imagen; uno alto la redibuja más. El valor predeterminado es 0,45.
- **{{ui:params.hires.method}}**: **{{ui:params.hires.methodSmooth}}** amplía sin usar un modelo. Si hay modelos de ampliación instalados (los que usa la pestaña {{ui:app.tabs.upscaling}}), también se puede elegir uno de ellos.
- **{{ui:params.hires.steps}}**: los pasos de la segunda pasada. Con 0 se usan los mismos que en la primera.

Tarda aproximadamente lo mismo que dibujar dos veces. El avance cuenta las dos pasadas juntas. Los LoRA y las imágenes de referencia también se usan en la segunda pasada.

Cuando el resultado es mucho mayor de lo que el modelo dibuja bien (unos 2048 px en el lado largo para SDXL, 1536 px para SD1.X), aparece una nota bajo el botón de generar. Se puede generar igualmente; si la imagen se deforma, reduzca la escala.

La imagen conserva el tamaño de la primera pasada y los ajustes de {{ui:params.hires.title}}. Al cargarla con «{{ui:gallery.menu.useAll}}» en la galería, {{ui:params.hires.title}} queda como estaba.

## Iteraciones y el botón Generar

![El menú abierto con la flecha situada junto al botón Generar](shot:invoke-menu)

Los controles para generar están reunidos cerca de la parte superior del panel izquierdo.

- **{{ui:params.invoke.invoke}}** (el botón azul): añade al final de la cola y genera. También se puede pulsar `Ctrl+Enter`.
- **El número junto a ×** (Iteraciones): cuántas imágenes se crean en una operación. Si se pone «3», se crean tres imágenes.
- **El botón × rojo**: cancela lo que se está dibujando en ese momento.
- **La ∨ a la derecha de cada botón**: un menú con otras operaciones.

Cuando no se puede pulsar, el botón se pone gris y el motivo (por ejemplo, que no hay modelo seleccionado) aparece en la línea situada debajo. Deje el puntero sobre el botón para ver la lista de motivos.
Mientras se dibuja, el botón cambia a «{{ui:params.invoke.generating}}» y muestra el avance (%) y el número de elementos que esperan en la cola.

### El menú ∨ del botón Generar

- **{{ui:params.invoke.addBack}}** (`Ctrl+Enter`): dibuja en el orden en que se pulsó. Es igual que una generación normal.
- **{{ui:params.invoke.addFront}}** (`Ctrl+Shift+Enter`): se cuela al principio de la cola de espera. Úselo cuando tenga prisa y quiera probar solo una imagen.
- **{{ui:xyplot.menu}}**: a partir de los ajustes actuales, alinea en una sola tabla imágenes con uno o dos ajustes cambiados. Se dibujan con la misma semilla, así que la única diferencia es el ajuste que se cambió. Elija la escala CFG, los pasos, el modelo u otro ajuste para los ejes horizontal y vertical, introduzca los valores y pulse **{{ui:xyplot.run}}**.

### El menú de cancelar

Pulse la ∨ situada a la derecha del botón × rojo para mostrar el siguiente menú.

- **{{ui:params.invoke.cancelCurrent}}** (`Shift+X`)
- **{{ui:params.invoke.clearQueue}}** (`Ctrl+Shift+X`): quita todo, tanto lo que espera como lo que se está dibujando. No aparece confirmación.
- **{{ui:params.invoke.pause}}** / **{{ui:params.invoke.resume}}**: detiene y reanuda el procesamiento de la cola.
- **{{ui:params.invoke.openQueue}}**

## Ver la imagen terminada

![La pantalla al terminar la generación. La imagen se muestra en el visor central y también aparece en la galería de la derecha](shot:generate-result)

En cuanto se pulsa el botón, el centro cambia al visor.
Mientras se dibuja, sobre la galería de la derecha aparece una banda «{{ui:gallery.generating.title}}» donde se ven la imagen parcial, el número de paso y el avance. La fina línea del borde superior del centro también muestra el avance. La misma imagen aparece además como una pequeña celda al principio de la galería. Pulse la celda para ver en grande, en el visor central, la imagen parcial. Cuando termina el dibujo, la imagen terminada ocupa su lugar.

Al terminar, la imagen se añade a la galería y se muestra en el visor.
La imagen se guarda en el tablero seleccionado en ese momento (el marcado con «{{ui:gallery.boards.autoBadge}}» en el panel derecho). Los tableros y cómo organizar, comparar y rehacer imágenes se explican en [La galería y el visor](03-gallery.md).

> Si le molesta que el visor cambie solo a cada imagen nueva, desactive «{{ui:gallery.settings.autoSwitch}}» en {{ui:gallery.settings.title}} (el botón del engranaje).

## Preajustes

![La lista de preajustes, con preajustes integrados y preajustes guardados](shot:presets)

Una combinación de ajustes que se usa a menudo puede guardarse como preajuste. Pulse la tarjeta «{{ui:presets.label}}» de la parte superior del panel izquierdo para abrir la lista.

Un preajuste guarda juntos los siguientes elementos.

- Los prompts (positivo y negativo)
- El modelo y cada ajuste (tamaño, pasos, CFG, planificador, VAE, etc.)
- Los LoRA y las imágenes de referencia
- {{ui:params.hires.title}}, los ajustes de la pestaña **{{ui:app.tabs.upscaling}}**, los ajustes de inpaint (desenfoque de máscara, relleno, etc.) y cómo se crean los prompts dinámicos

No se incluyen la semilla, las iteraciones ni la imagen que se va a ampliar.

Así se usan.

- Haga clic en un elemento de la lista y se aplican sus ajustes (**{{ui:presets.apply}}**).
- Con **{{ui:presets.saveNew}}**, al final de la lista (o el botón de guardar junto a la tarjeta), se guardan con un nombre los ajustes actuales.
- Los «…» a la derecha de un elemento permiten **{{ui:presets.apply}}**, **{{ui:presets.overwrite}}**, **{{ui:presets.rename}}** y **{{ui:presets.delete}}**.
- La lista se divide en «{{ui:presets.group.mine}}» y «{{ui:presets.group.builtin}}». Los preajustes integrados son ejemplos que vienen con la aplicación.

### Ejecutar preajustes al azar

Se puede generar un lote alternando al azar entre varios preajustes. Úselo cuando quiera muchas imágenes seguidas cuyos prompts y tamaños sean muy distintos.

1. Pulse el botón con flechas cruzadas ({{ui:presets.run.title}}) situado a la derecha de la tarjeta «{{ui:presets.label}}».
2. Marque los preajustes que se van a usar.
3. Introduzca el {{ui:presets.run.count}} en el cuadro «×» y pulse **{{ui:presets.run.queue}}**.

Para cada imagen se elige uno de los preajustes marcados, todos con la misma probabilidad, y la semilla también es aleatoria. Los ajustes que un preajuste no guarda se toman del panel izquierdo actual. Los ajustes del panel izquierdo no cambian.

- Cuando los preajustes usan modelos distintos, cargar el modelo lleva tiempo en cada cambio.
- Cuando un prompt tiene prompts dinámicos, a cada imagen le toca un prompt elegido según su semilla (no todas las combinaciones).
- Cuando alguno de los preajustes marcados no se puede generar, se muestran su nombre y el motivo, y no se puede añadir nada a la cola.
- Las marcas y el número se conservan para la próxima vez que lo abra.

## Preajustes de prompt

![Los preajustes de prompt. Palabras y significados ordenados por categoría, con botones de añadir Positivo y Negativo](shot:prompt-book)

Para poder armar prompts aunque no se recuerden las palabras en inglés, existe **{{ui:params.promptBook.open}}**. Se abre desde el botón situado sobre los campos positivo y negativo.

- Al elegir una categoría a la izquierda (personas, relaciones e interacciones, poses, movimientos, expresiones, mirada, composición, peinados, ropa, etc.), solo se listan las palabras de esa categoría. El campo de búsqueda de arriba busca a la vez en palabras, significados, categorías y notas.
- Pulse «{{ui:params.prompt.positive}}» o «{{ui:params.prompt.negative}}» a la derecha de una palabra y la palabra se añade al prompt. Una palabra añadida recibe una marca de verificación, y al pulsarla de nuevo se quita.
- Escriba una palabra y su significado en el campo de entrada de la parte superior y pulse **{{ui:params.promptBook.register}}** para añadir una palabra propia. El lápiz a la derecha de una palabra la edita, y la papelera la elimina.

## Imágenes de referencia

**{{ui:params.refImage.sectionLabel}}** es una función para orientar una imagen nueva hacia el «ambiente» o el «estilo» de una existente. No la copia exactamente. Usa como pistas la paleta de colores, el estilo de dibujo y la impresión general.

1. Pulse el botón **＋** bajo el prompt para añadir un marco.
2. Arrastre y suelte una imagen de la galería sobre ese marco. También se puede soltar un archivo de imagen del ordenador.
3. Haga clic en el marco y se abre una pequeña ventana de ajustes.

En la ventana pequeña se puede decidir lo siguiente.

- **{{ui:params.refImage.model}}**: el modelo específico para imágenes de referencia (IP-Adapter). Hace falta uno que encaje con la familia del modelo seleccionado.
- **{{ui:params.refImage.methodLabel}}**: qué se usa como pista, como la imagen entera, solo el estilo o solo la composición (no aparece en algunas familias de modelos).
- **{{ui:params.refImage.weight}}**: con cuánta fuerza se orienta.
- **{{ui:params.refImage.begin}}** y **{{ui:params.refImage.end}}**: la parte del proceso de dibujo en la que surte efecto, del principio al final.

Cuando falta un modelo o una extensión necesarios, aparece una marca de aviso en el marco y una indicación en la ventana pequeña y bajo el botón Generar. Se puede instalar desde el botón de la indicación.

> Una imagen de referencia sirve para «orientar el ambiente». Cuando quiera «redibujar a partir de esta imagen», use imagen a imagen, que se explica a continuación.

## Imagen a imagen (redibujar a partir de una imagen)

Si se coloca una imagen en la sección **{{ui:params.i2i.title}}**, se dibuja encima tomándola como punto de partida. Úselo para conservar la composición y los colores de una imagen cambiándola según el prompt.

1. Abra la sección y suelte una imagen de la galería (o un archivo de imagen del ordenador) en el marco. **{{ui:params.refImage.openI2i}}**, en la ventana pequeña de una imagen de referencia, también coloca una.
2. El ancho y el alto cambian al tamaño que el modelo dibuja bien más cercano a la forma de la imagen. Después se pueden cambiar a mano.
3. **{{ui:params.image.strength}}** decide cuánto se vuelve a dibujar. Cerca de 0 conserva la imagen tal cual; cerca de 1 la ignora. Alrededor de 0,5 es un buen punto de partida.

Con {{ui:params.hires.title}} activada, la imagen dibujada sobre la suya se amplía y se vuelve a dibujar. Para quitar la imagen, pulse la × de la esquina superior derecha de su marco. Para redibujar solo una parte pintada, use [Añadir trazos en el lienzo](05-canvas.md).

### Personajes

En el campo «{{ui:character.row.label}}», situado sobre las imágenes de referencia, se pueden llamar personajes registrados (cualquier número de imágenes de un mismo personaje, con palabras que describen su aspecto).
Al elegir uno, se establecen las imágenes de referencia y las palabras de aspecto de ese personaje. Cómo registrar un personaje se explica en [Retocar y reutilizar imágenes](04-improve.md).

## Cola

![La pestaña Cola. Se listan el elemento en proceso y los que esperan](shot:queue)

En la pestaña **{{ui:app.tabs.queue}}** se ve y se gestiona la cola de espera de generación. Cuando hay elementos esperando, aparece una insignia con un número en {{ui:app.tabs.queue}}, en la navegación lateral.

En la parte superior de la pantalla hay lo siguiente.

- El estado del procesamiento («{{ui:queue.processor.running}}» o «{{ui:queue.processor.paused}}») y los botones de control.
- El desglose del número de elementos ({{ui:queue.status.pending}}, {{ui:queue.status.inProgress}}, {{ui:queue.status.completed}}, {{ui:queue.status.failed}}, {{ui:queue.status.canceled}}).
- En la parte superior derecha, el avance del elemento que se está dibujando ahora.

Los botones funcionan así.

| Botón | Función |
|---|---|
| **{{ui:queue.action.pause}}** / **{{ui:queue.action.resume}}** | Detiene o reanuda el procesamiento de la cola de espera. Lo que se está dibujando ahora se termina tal cual |
| **{{ui:queue.action.cancelCurrent}}** | Detiene lo que se está dibujando en este momento |
| **{{ui:queue.action.cancelAllExceptCurrent}}** | Cancela todo lo que está esperando |
| **{{ui:queue.action.prune}}** | Quita de la lista los elementos terminados (completados, fallidos, cancelados) |
| **{{ui:queue.action.clear}}** | Quita todos los elementos. Aparece una ventana de confirmación |

Haga clic en una fila de la lista de abajo para abrir la información detallada de ese elemento (las horas, las imágenes creadas, el motivo si falló y el contenido de los ajustes).
La × a la derecha de una fila cancela solo ese elemento. Los elementos que fallaron o se cancelaron tienen un botón de reintento.

## Atajos de teclado

Para los atajos que no funcionan mientras se escribe, salga del campo de entrada antes de pulsarlos.

| Acción | Tecla |
|---|---|
| Generar (añadir al final de la cola) | `Ctrl+Enter` (funciona incluso al escribir el prompt) |
| Añadir al principio de la cola y generar | `Ctrl+Shift+Enter` |
| Cancelar lo que se está dibujando | `Shift+X` |
| Vaciar toda la cola (sin confirmación) | `Ctrl+Shift+X` |
| Ir al campo del prompt | `Alt+A` |
| Mostrar u ocultar los paneles izquierdo y derecho | `T`, `G` |
| Abrir y cerrar ambos paneles a la vez | `F` |
| Cambiar de pestaña (en el orden de la navegación lateral, de {{ui:app.tabs.generate}} a {{ui:app.nav.extensions}}) | `1` a `9` |
| Abrir la lista de atajos | `Shift+?` |

Los atajos también se pueden consultar en «{{ui:app.nav.hotkeys}}», dentro del menú **{{ui:app.nav.settings}}** de la navegación lateral.
