# Crear imágenes

Este capítulo explica cómo crear dibujos en la pestaña **{{ui:app.tabs.generate}}**.
Para recorrer la pantalla, consulte [Primeros pasos](01-start.md); para ver y organizar las imágenes creadas, consulte [Galería y visor](03-gallery.md).

El procedimiento es siempre el mismo.

1. Elegir el modelo
2. Escribir el prompt
3. Si hace falta, ajustar el tamaño, la semilla y otros parámetros
4. Pulsar **{{ui:params.invoke.invoke}}**

El dibujo no empieza a generarse en el instante de pulsar: primero entra en la «{{ui:app.tabs.queue}}» (la fila de espera). Cuando le llega el turno, se dibuja de una en una.

## Escribir el prompt

![Pestaña Generar con una frase escrita en el prompt y la semilla fijada](shot:generate-prompt)

En «{{ui:params.prompt.title}}», en el panel izquierdo, hay 2 campos.

- **{{ui:params.prompt.positive}}**: aquí se escribe lo que se quiere que aparezca.
- **{{ui:params.prompt.negative}}**: aquí se escribe lo que no se quiere que aparezca. Por ejemplo, `blurry, watermark` (borroso, marca de agua). Se puede generar aunque quede vacío.

Pautas para escribir:

- Separe palabras o frases cortas con comas (`,`).
- Con muchos modelos es más fácil obtener lo esperado escribiendo en inglés. Si la descripción del modelo indica cómo escribir, siga esa indicación.
- Ponga las palabras importantes al principio.

Los pequeños botones situados sobre el campo funcionan así:

| Botón | Función |
|---|---|
| **{{ui:params.prompt.recommended}}** | Añade palabras de calidad adecuadas al modelo elegido (como `masterpiece, best quality`) al principio de «{{ui:params.prompt.positive}}» y las palabras que suelen querer evitarse al final de «{{ui:params.prompt.negative}}». Las palabras que ya están no se añaden de nuevo |
| **{{ui:params.prompt.expand}}** | Edita el prompt positivo y el negativo en una ventana grande, uno junto al otro |
| **{{ui:params.promptBook.open}}** | Abre una lista de palabras reunidas con su significado (más adelante) |
| **{{ui:caption.fromPrompt}}** | Mira una imagen y escribe palabras utilizables en el prompt. También funciona soltando sobre este botón una imagen de la galería o un archivo de imagen del ordenador (se explica en [Retocar y reutilizar imágenes](04-improve.md)) |
| «Preajustes positivos» / «Preajustes negativos» de cada campo | Guarda y recupera solo el texto del prompt (más adelante) |

### Número de tokens

El «0 / 77 tokens» situado sobre el campo es una estimación de la cantidad de palabras escritas.
Un token es la unidad en que el modelo divide las palabras al leerlas. Si se supera el límite, el número cambia a un color de aviso. Según el modelo, la parte que sobrepasa el límite puede tener menos efecto.
El número es aproximado, no exacto.

### Crear varias combinaciones a la vez `{red|blue}`

Si en el campo positivo se escribe entre llaves con barras verticales (`|`) como en `{red|blue}`, se crea un dibujo distinto por cada opción.

- Con `a {red|blue} flower` se obtienen 2 variantes: `a red flower` y `a blue flower`.
- Con dos o más pares de llaves se obtienen todas las combinaciones. `a {red|blue} {cat|dog}` da 4 variantes.
- También se pueden anidar llaves dentro de llaves.
- Para usar una llave como carácter, anteponga `\` (`\{`).
- El número de combinaciones es de 100 como máximo.

Si el «{{ui:params.invoke.iterations}}» (más adelante) es 2 o más, se crean tantos dibujos como combinaciones × número de imágenes. Por ejemplo, con 2 variantes y 3 imágenes son 6 dibujos.
Esta sintaxis solo funciona en el campo positivo. En el campo negativo, las llaves se tratan como texto normal.

Para comprobar en qué frases se expande, use el botón **{{ui:params.prompt.dynamicPreview}}** (icono `{ }`) situado sobre el campo positivo. Al pulsarlo aparece la lista de combinaciones.

### Comodines `__nombre__`

![Ventana de comodines. A la izquierda la lista de listas; a la derecha el nombre y los elementos de la lista elegida](shot:wildcards)

Si en el campo positivo se escribe `__nombre__` (con dos guiones bajos delante y detrás del nombre), se inserta un elemento cada vez de la lista de «{{ui:params.wildcards.title}}» con ese nombre. Si se guardan las opciones de uso frecuente como lista, no hace falta escribir `{red|blue}` cada vez.

- Con `1girl, __hair-color__` se crean tantos prompts como elementos tenga la lista hair-color.
- Dentro de los elementos también se pueden escribir `{a|b}` u otros comodines. Los comodines dentro de comodines admiten hasta 6 niveles.
- El límite de combinaciones (100) es el mismo que con `{ }`.
- Si se escribe un nombre inexistente, una lista sin elementos o una lista que se usa a sí misma, **{{ui:params.invoke.invoke}}** no se puede pulsar y el motivo aparece debajo del botón.

Las listas se abren desde **{{ui:params.wildcards.open}}**, al final de la ventana del botón **{{ui:params.prompt.dynamicPreview}}**. Desde el principio hay 3: hair-color (color del pelo), expression (expresión) y time-of-day (momento del día).

| Operación | Función |
|---|---|
| **{{ui:params.wildcards.new}}** | Añade una lista vacía |
| Campo «{{ui:params.wildcards.name}}» | Cambia el nombre de la lista. Se pueden usar letras, números, `-` y `_`, y el primer y el último carácter deben ser una letra o un número |
| Campo «{{ui:params.wildcards.entries}}» | Se escribe un elemento por línea. Las líneas vacías y las que empiezan por `#` no cuentan como elementos |
| **{{ui:params.wildcards.import}}** / **{{ui:params.wildcards.export}}** | Lee y escribe una lista como archivo .txt con un elemento por línea. El archivo importado se convierte en una lista nueva cuyo nombre es el del archivo |
| **{{ui:common.delete}}** | Elimina la lista elegida |

Las listas se guardan dentro de esta aplicación (en el ordenador que se está usando).

### Elegir al azar

Cuando hay demasiadas combinaciones, cambie «{{ui:params.prompt.dynamicMode}}» en la ventana del botón **{{ui:params.prompt.dynamicPreview}}**.

- **{{ui:params.prompt.modeCombinatorial}}** (ajuste inicial): por cada combinación se crean tantos dibujos como indique el número de imágenes.
- **{{ui:params.prompt.modeRandom}}**: se crean tantos dibujos como indique el número de imágenes, y en cada uno se elige una combinación. La elección depende de la semilla de ese dibujo, así que al volver a dibujar con la misma semilla se obtiene el mismo prompt.

Con cualquiera de los dos métodos, la imagen creada guarda el prompt que realmente se usó.

## Semilla

El dibujo se crea a partir de un número llamado «{{ui:params.seed.label}}». Con la misma semilla y los mismos ajustes se obtiene el mismo dibujo.

En la fila «{{ui:params.seed.label}}», en la parte superior del panel izquierdo, hay 2 botones.

- **{{ui:params.seed.random}}** (dado): en cada generación se usa una semilla nueva. El dibujo es distinto cada vez. Es el estado inicial.
- **{{ui:params.seed.fixed}}** (candado): se dibuja con la semilla actual. Con los mismos ajustes, el dibujo es siempre el mismo. Es útil para ver qué cambia al modificar una sola palabra del prompt.

Al fijarla, el campo numérico de la semilla y el botón «{{ui:params.seed.shuffle}}» quedan bloqueados (para evitar cambios accidentales).
Para usar un número concreto, escríbalo en el campo numérico en el estado «{{ui:params.seed.random}}» y después cambie a «{{ui:params.seed.fixed}}».
Para usar la semilla de un dibujo que gustó, abra ese dibujo en la galería y pulse «{{ui:gallery.menu.useSeed}}»: la semilla se carga y queda fijada (consulte [Galería y visor](03-gallery.md)).

Si se aumenta el número de imágenes con la semilla fijada, a partir de la segunda imagen la semilla aumenta de uno en uno.

## Elegir el modelo

![Lista de modelos abierta, dividida por familias como FLUX, SDXL y SD1.X](shot:model-picker)

En la tarjeta de modelo de la parte superior del panel izquierdo se elige el modelo con el que dibujar.

1. Haga clic en el campo del nombre del modelo.
2. Elija en la lista. La lista está dividida por familias de modelos (FLUX, SDXL, SD1.X, etc.). Si hay muchos, se puede filtrar escribiendo parte del nombre en el campo de búsqueda de arriba.
3. El modelo elegido se marca con ✓ y la imagen de la tarjeta (la portada) cambia.

Con el botón **{{ui:app.tabs.short.models}}** de debajo de la lista se pasa a la pestaña {{ui:app.tabs.models}} (gestión de los modelos disponibles), y con el botón **{{ui:app.tabs.short.browse}}** a la pestaña {{ui:app.tabs.browse}} (búsqueda en internet). La forma de conseguir más modelos se explica en [Preparar modelos](08-models.md).

Si el modelo tiene ajustes recomendados registrados (pasos, CFG, scheduler, tamaño), se aplican automáticamente al elegirlo.
Al cambiar a un modelo de otra familia, se quitan los LoRA y elementos similares que no encajan con el nuevo modelo (una notificación indica cuántos se quitaron).

Al pulsar el botón **{{ui:params.profile.title}}** situado bajo el campo del modelo, aparece una lista con los valores recomendados para ese modelo. Si los ajustes actuales se alejan de lo recomendado, el botón cambia a un color llamativo, y con **{{ui:params.profile.apply}}** se pueden igualar a los valores recomendados.

> Si no hay ningún modelo instalado, en el campo aparece «{{ui:params.model.noModels}}» y no se puede generar. Complete antes [Preparar modelos](08-models.md).

## Otros ajustes

Debajo del prompt hay secciones con los ajustes agrupados. Se abren y se cierran con un clic.

| Sección | Contenido |
|---|---|
| **{{ui:params.refImage.sectionLabel}}** (justo debajo del prompt) | Imágenes para acercar el ambiente o los personajes de un dibujo (más adelante) |
| **{{ui:params.image.title}}** | {{ui:params.image.aspect}}, ancho y alto. También están los botones «{{ui:params.image.swap}}», «{{ui:params.image.lock}}» y «{{ui:params.image.optimal}}» |
| **{{ui:params.generation.title}}** | LoRA (pequeños modelos adicionales que añaden estilo o personajes), {{ui:params.generation.scheduler}}, {{ui:params.generation.steps}} y {{ui:params.generation.cfg}} |
| **{{ui:params.hires.title}}** | Una segunda generación que amplía el dibujo y lo vuelve a pintar (más adelante) |
| **{{ui:params.advanced.title}}** | {{ui:params.advanced.vae}}, {{ui:params.advanced.clipSkip}}, {{ui:params.advanced.seamless}} (dibujos que se pueden repetir sin que se vean las juntas), etc. |

Si hay dudas, excepto el tamaño, se pueden dejar los valores que se aplicaron al elegir el modelo.
Al colocar el cursor sobre el nombre de un ajuste («{{ui:params.generation.steps}}», «{{ui:params.generation.cfg}}», etc.), aparece una breve explicación. En el encabezado de cada sección se muestra, en pequeño, un resumen de los valores actuales.

Cuanto mayor es el tamaño, más tiempo y más carga para el ordenador. Se recomienda probar primero con un tamaño pequeño y, si el resultado le gusta, agrandarlo con la [ampliación](06-upscaling-workflows.md).

## Corrección de alta resolución

![Sección de corrección de alta resolución abierta y activada](shot:hires-fix)

Si se dibuja desde el principio con un tamaño grande, es fácil que aparezcan dos personas o que las formas se deformen. **{{ui:params.hires.title}}** primero dibuja con el tamaño ajustado, lo amplía y lo vuelve a dibujar con la misma semilla y los mismos ajustes. En una sola generación se obtiene un dibujo grande y con los detalles bien definidos. Esta sección está en las pestañas {{ui:app.tabs.generate}} y {{ui:app.tabs.comic}}.

- **{{ui:params.hires.enable}}**: se usa al activarlo.
- **{{ui:params.hires.scale}}**: de 1,25 a 2 veces. El tamaño final aparece en el encabezado de la sección y en la última fila.
- **{{ui:params.hires.strength}}**: de 0,2 a 0,75. Con un valor bajo se conserva casi por completo el primer dibujo, y con uno alto se repinta mucho. El valor inicial es 0,45.
- **{{ui:params.hires.method}}**: **{{ui:params.hires.methodSmooth}}** amplía sin usar un modelo. Si está instalado un modelo de ampliación de los que se usan en la pestaña {{ui:app.tabs.upscaling}}, también se puede elegir.
- **{{ui:params.hires.steps}}**: los pasos de la segunda pasada. Con 0, se dibuja con el mismo número que en la primera.

Tarda el tiempo de dibujar dos veces. El avance se cuenta sumando las dos pasadas. Los LoRA y las imágenes de referencia también se usan en la segunda pasada.

Cuando el resultado supera mucho el tamaño en que el modelo rinde mejor (un lado largo de unos 2048 px en SDXL y 1536 px en SD1.X), aparece un aviso bajo el botón de generar. Se puede generar, pero si el dibujo se deforma, reduzca el factor de ampliación.

En la imagen se guardan el tamaño de la primera pasada y los valores de la «{{ui:params.hires.title}}». Al cargarla con «{{ui:gallery.menu.useAll}}» en la galería, la «{{ui:params.hires.title}}» también se aplica tal cual.

## Número de generaciones y botón de generar

![Menú abierto al pulsar la flecha junto al botón de generar](shot:invoke-menu)

En la parte superior del panel izquierdo están agrupadas las operaciones de generación.

- **{{ui:params.invoke.invoke}}** (botón azul): añade al final de la cola y genera. También se puede pulsar con `Ctrl+Enter`.
- **El número junto a ×**: cuántas imágenes se crean en una operación. Con «3» se crean 3.
- **Botón × rojo**: cancela lo que se está dibujando.
- **∨** a la derecha de cada botón: menú de otras operaciones.

Cuando no se puede pulsar, el botón se pone gris y el motivo (por ejemplo, que no hay modelo elegido) aparece en la línea situada debajo. Al colocar el cursor sobre el botón se ve la lista de motivos.
Mientras se dibuja, el botón cambia a «{{ui:params.invoke.generating}}» y muestra el avance (%) y el número de elementos que esperan en la cola.

### Menú ∨ del botón de generar

- **{{ui:params.invoke.addBack}}** (`Ctrl+Enter`): se dibuja en el orden en que se pulsó. Es igual que la generación normal.
- **{{ui:params.invoke.addFront}}** (`Ctrl+Shift+Enter`): se cuela al principio de la fila de espera. Se usa para probar una sola imagen con urgencia.
- **{{ui:xyplot.menu}}**: a partir de los ajustes actuales, coloca en una sola tabla dibujos en los que solo se cambian 1 o 2 ajustes. Se dibuja con la misma semilla, de modo que la única diferencia es lo que se cambió. Elija para el eje horizontal y el vertical, por ejemplo, la escala CFG, los pasos o el modelo, escriba los valores y pulse **{{ui:xyplot.run}}**.

### Menú de cancelar

Al pulsar ∨ a la derecha del botón × rojo aparece este menú.

- **{{ui:params.invoke.cancelCurrent}}** (`Shift+X`)
- **{{ui:params.invoke.clearQueue}}** (`Ctrl+Shift+X`): borra todo, tanto lo que espera como lo que se está dibujando. No pide confirmación.
- **{{ui:params.invoke.pause}}** / **{{ui:params.invoke.resume}}**: detiene o reanuda el procesamiento de la cola.
- **{{ui:params.invoke.openQueue}}**

## Ver el dibujo terminado

![Pantalla al terminar la generación. El dibujo se muestra en el visor central y también aparece en la galería de la derecha](shot:generate-result)

Al pulsar, el centro cambia enseguida al visor.
Mientras se dibuja, sobre la galería de la derecha aparece la banda «{{ui:gallery.generating.title}}», donde se ven el dibujo parcial, los pasos y el avance. La fina línea del borde superior central también indica el avance.

Cuando termina, el dibujo se añade a la galería y aparece en el visor.
El dibujo se guarda en el tablero que esté seleccionado en ese momento (el que lleva la marca «{{ui:gallery.boards.autoBadge}}» en el panel derecho). Los tableros, y cómo organizar, comparar y rehacer dibujos, se explican en [Galería y visor](03-gallery.md).

> Si le molesta que el visor cambie solo al dibujo nuevo, desactive «{{ui:gallery.settings.autoSwitch}}» en «{{ui:gallery.settings.title}}» (el botón del engranaje).

## Preajustes

![Lista de preajustes. Aparecen los preajustes integrados y los guardados](shot:presets)

Las combinaciones de ajustes de uso frecuente se pueden guardar como preajustes. Al pulsar la tarjeta «{{ui:presets.label}}», en la parte más alta del panel izquierdo, se abre la lista.

Un preajuste incluye en conjunto:

- El prompt (positivo y negativo)
- El modelo y cada ajuste (tamaño, pasos, CFG, scheduler, VAE, etc.)
- Los LoRA y las imágenes de referencia

La semilla y el número de imágenes no se incluyen.

Se usa así:

- Al hacer clic en un elemento de la lista, se aplican esos ajustes (**{{ui:presets.apply}}**).
- Con **{{ui:presets.saveNew}}** bajo la lista (o el botón de guardar junto a la tarjeta), los ajustes actuales se guardan con un nombre.
- Con «…» a la derecha de un elemento se puede **{{ui:presets.apply}}**, **{{ui:presets.overwrite}}**, **{{ui:presets.rename}}** y **{{ui:presets.delete}}**.
- La lista se divide en «{{ui:presets.group.mine}}» y «{{ui:presets.group.builtin}}». Los preajustes integrados son ejemplos que ya vienen incluidos.

Aparte de esto, sobre los campos positivo y negativo también hay un campo de preajustes («Preajustes positivos» y «Preajustes negativos»). Este guarda y recupera solo el texto del prompt. Es adecuado para guardar frases hechas (conjuntos de palabras de calidad o de palabras que se quieren evitar).

## Lista de prompts

![Lista de prompts. Palabras y significados por categoría, con botones para añadir al positivo o al negativo](shot:prompt-book)

Para poder armar un prompt sin recordar palabras en inglés está la **{{ui:params.promptBook.open}}**. Se abre con el botón situado sobre los campos positivo y negativo.

- Al elegir una categoría a la izquierda (peinado, expresión, ropa, composición, etc.), solo se muestran las palabras de esa categoría. En el campo de búsqueda superior se buscan a la vez palabras, significados, categorías y notas.
- Al pulsar «{{ui:params.prompt.positive}}» o «{{ui:params.prompt.negative}}» a la derecha de una palabra, esa palabra se añade al prompt. La palabra añadida queda marcada, y al pulsar de nuevo se quita.
- Si se escribe una palabra y su significado en el campo superior y se pulsa **{{ui:params.promptBook.register}}**, se añaden palabras propias. El lápiz a la derecha de la palabra sirve para editarla y la papelera para eliminarla.

## Imágenes de referencia

**{{ui:params.refImage.sectionLabel}}** es una función para acercar el «ambiente» o el «estilo» de un dibujo existente a uno nuevo. No lo copia tal cual, sino que usa como guía los colores, el estilo y la impresión general.

1. Pulse el botón **＋** situado bajo el prompt para añadir un recuadro.
2. Arrastre y suelte en ese recuadro un dibujo de la galería. También funciona soltar un archivo de imagen del ordenador.
3. Al hacer clic en el recuadro, se abre una pequeña ventana de ajustes.

En la ventana se puede decidir lo siguiente:

- **{{ui:params.refImage.model}}**: el modelo específico para imágenes de referencia (IP-Adapter). Hace falta uno que corresponda a la familia del modelo elegido.
- **{{ui:params.refImage.methodLabel}}**: qué se usa como guía: todo, solo el estilo, solo la composición, etc. (no aparece en algunas familias de modelos).
- **{{ui:params.refImage.weight}}**: la intensidad con que influye.
- **{{ui:params.refImage.begin}}** y **{{ui:params.refImage.end}}**: desde qué punto hasta qué punto del proceso de dibujo actúa.

Si no están instalados el modelo o la extensión necesarios, el recuadro muestra una marca de aviso, y en la ventana y bajo el botón de generar aparece una indicación. Desde el botón de la indicación se puede instalar.

> La imagen de referencia sirve para «acercar el ambiente». Si se quiere «rehacer el dibujo a partir de este», use el lienzo. Consulte [Añadir trazos en el lienzo](05-canvas.md).

### Personaje

En el campo «{{ui:character.row.label}}», sobre las imágenes de referencia, se puede recuperar un personaje registrado (varios dibujos de la misma persona, con palabras sobre su aspecto).
Al elegirlo, se configuran las imágenes de referencia de ese personaje y sus palabras de aspecto. El registro de personajes se explica en [Retocar y reutilizar imágenes](04-improve.md).

## Cola

![Pestaña Cola. Aparece una lista con el elemento en proceso y los que esperan](shot:queue)

En la pestaña **{{ui:app.tabs.queue}}** se puede ver y gestionar la cola de generación. Cuando hay elementos en espera, {{ui:app.tabs.queue}} en la navegación lateral muestra una insignia con su número.

En la parte superior de la pantalla hay lo siguiente:

- El estado del procesamiento («{{ui:queue.processor.running}}» o «{{ui:queue.processor.paused}}») y los botones de operación.
- El desglose del número de elementos ({{ui:queue.status.pending}}, {{ui:queue.status.inProgress}}, {{ui:queue.status.completed}}, {{ui:queue.status.failed}}, {{ui:queue.status.canceled}}).
- En la parte superior derecha, el avance del elemento que se está dibujando.

Los botones funcionan así:

| Botón | Función |
|---|---|
| **{{ui:queue.action.pause}}** / **{{ui:queue.action.resume}}** | Detiene o reanuda el procesamiento de la cola. Lo que ya se está dibujando continúa hasta el final |
| **{{ui:queue.action.cancelCurrent}}** | Detiene lo que se está dibujando |
| **{{ui:queue.action.cancelAllExceptCurrent}}** | Cancela todo lo que está esperando |
| **{{ui:queue.action.prune}}** | Quita de la lista los elementos terminados (completados, fallidos y cancelados) |
| **{{ui:queue.action.clear}}** | Quita todos los elementos. Aparece una ventana de confirmación |

Al hacer clic en una fila de la lista inferior se abre la información detallada de ese elemento (hora, dibujos creados, motivo del fallo si lo hubo y contenido de los ajustes).
Con la × a la derecha de la fila se cancela solo ese elemento. En los elementos fallidos o cancelados aparece un botón para reintentar.

## Atajos de teclado

Los atajos que no funcionan mientras se escribe texto deben pulsarse después de salir del campo de entrada.

| Operación | Tecla |
|---|---|
| Generar (añadir al final de la cola) | `Ctrl+Enter` (también funciona mientras se escribe el prompt) |
| Generar añadiendo al principio de la cola | `Ctrl+Shift+Enter` |
| Cancelar lo que se está dibujando | `Shift+X` |
| Borrar toda la cola (sin confirmación) | `Ctrl+Shift+X` |
| Ir al campo del prompt | `Alt+A` |
| Abrir o cerrar el panel izquierdo y el derecho | `T`, `G` |
| Abrir o cerrar ambos paneles a la vez | `F` |
| Cambiar de pestaña (de {{ui:app.tabs.generate}} a {{ui:app.tabs.queue}}, en ese orden) | `1` a `9` |
| Abrir la lista de atajos | `Shift+?` |

Los atajos también se pueden consultar en «{{ui:app.nav.hotkeys}}», en el menú de **{{ui:app.nav.settings}}** de la navegación lateral.
