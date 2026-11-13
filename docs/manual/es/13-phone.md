# Usarlo desde un móvil

Puede usar novira, instalado en su ordenador, desde el navegador de un móvil conectado a la Wi-Fi de su casa. El ordenador dibuja las imágenes; el móvil solo muestra la pantalla y recibe sus toques. Los ajustes, los borradores, el historial y el resto son los mismos que al abrirlo en el ordenador. Mientras los móviles y el ordenador lo tienen abierto a la vez, un cambio hecho en uno (el prompt, el modelo, los LoRA, los ajustes de generación, los ajustes predefinidos, el libro de prompts y los borradores) aparece en las demás pantallas abiertas en un segundo o dos. Los ajustes de visualización (idioma, tema, tamaño), lo que se está editando en el lienzo o en los flujos de trabajo y el chat del asistente pertenecen a cada pantalla y se igualan la próxima vez que se abre. La conexión está cifrada, y un móvil se conecta solo después de que el ordenador lo permita.

## Conectarse

1. En la aplicación novira, pulse **{{ui:app.tabs.short.homeLink}}** en la barra de la izquierda. La red en la que está se recuerda como su red doméstica, y se abre la puerta.
2. Aparece un código QR. Escanéelo con la cámara de un móvil conectado a la misma Wi-Fi que el ordenador y abra la dirección que encuentre. Si lo abrió una aplicación lectora de QR, puede volver a abrirlo en Safari o Chrome antes de conectarse. El código caduca a los 2 minutos y sirve para un solo móvil. Cuando se agote, pulse **{{ui:app.lan.newCode}}**.
3. En un móvil que no ha usado antes, el navegador muestra una advertencia de certificado. Siga «Instalar el certificado», más abajo, para instalarlo.
4. En el móvil, compruebe el nombre del dispositivo y pulse «Conectar». El móvil muestra un código de 6 dígitos. El mismo número aparece en el ordenador, en la pantalla **{{ui:app.tabs.short.homeLink}}** (o como aviso en la esquina de la pantalla cuando no está abierta); si coinciden, pulse **{{ui:app.lan.allow}}**. novira se abre en el móvil.

Al cerrar la aplicación también se cierra la puerta; un móvil que estaba conectado vuelve a conectarse la próxima vez que se abre.

### Conectarse desde la versión de navegador

También puede conectarse del mismo modo desde la versión de navegador, sin la aplicación. Cierre la aplicación (solo un programa a la vez puede usar la carpeta de datos), abra la carpeta de la aplicación (la que contiene `server.bat`) en el Explorador de archivos, escriba `cmd` en la barra de direcciones de la parte superior y pulse Intro. En el símbolo del sistema que se abre, escriba `server.bat` y pulse Intro; la misma pantalla se abre en el navegador del ordenador, donde pulsa **{{ui:app.tabs.short.homeLink}}** en la barra de la izquierda. Para detenerlo, pulse Ctrl+C en el símbolo del sistema o cierre su ventana.

### Instalar el certificado

novira cifra la conexión con el móvil con un certificado creado en este ordenador (novira local CA). Mientras el móvil no conozca este certificado, el navegador advierte de que la conexión no es segura. Instálelo en el móvil una sola vez. Abra «Instalar el certificado» en la parte inferior de la pantalla del móvil y descargue el certificado con el enlace.

- iPhone: toque el enlace y toque «Permitir», y luego instale el perfil desde «Perfil descargado», en la parte superior de la aplicación Ajustes. Después, en Ajustes abra «General», «Información», «Ajustes de confianza de certificados» y active novira local CA. Si omite este último paso, la advertencia sigue apareciendo aunque el certificado esté instalado.
- Android (Chrome): en Ajustes, abra «Seguridad», «Instalar certificado», «Certificado de CA» y elija el certificado descargado. Firefox no usa los certificados añadidos después; ábralo en Chrome.

### Cerrarlo

No hay un botón para cerrar la puerta a la red doméstica. Cerrar la ventana emergente deja funcionando los móviles conectados.

- Se cierra sola a los 30 minutos si nadie la usa y no hay ningún código ni petición esperando.
- También se cierra sola cuando el ordenador deja de estar en la red en la que confió, por ejemplo tras pasar a otra Wi-Fi.
- Se puede desconectar un móvil conectado de uno en uno con la × de la lista. La conexión de un móvil termina a los 30 minutos sin usar, o 4 horas después de conectarse.

### Cuando Windows pregunta

La primera vez que se abre la puerta, Windows pregunta si novira (novira-server en la versión de navegador) puede comunicarse. Permítalo en las redes privadas.

Cuando Windows trata la red en la que está como «Pública», la pantalla muestra una advertencia. Ábrala solo en una red que sea suya. Si el móvil sigue sin poder conectarse, en la Configuración de Windows, en «Red e Internet», abra las propiedades de la conexión Wi-Fi (o por cable) que usa y ponga el tipo de perfil de red en «Red privada».

### Qué dispositivos pueden conectarse, y una precaución

- Solo se atiende a los dispositivos de la misma red que este ordenador (el mismo rango del mismo router). Un móvil fuera de casa, o que pasa por una VPN, no puede conectarse. Fuera de casa, use «Usarlo fuera de casa», más abajo.
- Incluso un dispositivo en la misma Wi-Fi no puede usarlo si el ordenador no lo permite. No enseñe el código QR a otras personas. Si el número es distinto, o no conoce el móvil, pulse **{{ui:app.lan.deny}}**.
- La conexión está cifrada con https.
- En una red que no conoce (una cafetería, por ejemplo), no pulse **{{ui:app.tabs.short.homeLink}}**. La red en la que lo pulsa pasa a ser de confianza, y se abre la puerta.

## Usarlo fuera de casa

Con [Tailscale](https://tailscale.com/), un móvil fuera de casa también puede usar novira en el ordenador. No hace falta abrir ningún puerto en el router. El móvil inicia sesión con una clave de acceso (cara, huella o código) configurada una vez en casa.

### Prepararse

1. Instale Tailscale en el ordenador y en el móvil e inicie sesión con la misma cuenta. Active la verificación en dos pasos en la cuenta de Tailscale.
2. En la consola de administración de Tailscale (los ajustes de DNS), active MagicDNS y los certificados HTTPS.
3. No ponga su nombre real ni otras palabras que quiera mantener privadas en el nombre de Tailscale del ordenador. Al crear el certificado, el nombre del ordenador y el nombre de la tailnet pasan a los registros públicos de certificados (Certificate Transparency). El nombre por sí solo no deja entrar a nadie.

### Activarlo y añadir un móvil

1. Pulse **{{ui:app.tabs.short.homeLink}}** en la barra izquierda y abra la pestaña **{{ui:app.lan.menuAway}}**.
2. Active **{{ui:app.remote.switch}}**. Cuando se muestra el nombre de Tailscale del ordenador (como `pc.tail1234.ts.net`), está listo; cuando no se puede abrir, se muestra el motivo. Se queda activado la próxima vez que se inicie novira.
3. Active Tailscale en el móvil, pulse **{{ui:app.remote.enrol}}** y escanee el código QR. Un móvil solo se añade en casa (el ordenador lo permite).
4. En el móvil, compruebe el nombre y pulse Iniciar; cuando el número del ordenador sea el mismo, pulse **{{ui:app.lan.allow}}**.
5. Pulse «Crear una clave de acceso» en el móvil y confirme con su cara, huella o código. El móvil aparece en la lista de **{{ui:app.remote.passkeys}}**.

### Abrirlo fuera de casa

Active Tailscale en el móvil, abra la dirección de cuando lo añadió (`https://pc.tail1234.ts.net:port/`) y pulse «Iniciar sesión con una clave de acceso». Un marcador ayuda. novira (o la versión de navegador) debe estar abierta en el ordenador, y su Tailscale conectado.

- Se puede hacer lo mismo que desde la Wi-Fi de casa. La instalación de modelos y extensiones, los ajustes del motor, las claves y la configuración del agente se quedan en el ordenador.
- Un inicio de sesión termina a los 30 minutos sin usar, o 4 horas después de iniciar sesión. Vuelva a iniciar sesión con la clave de acceso.
- **{{ui:app.remote.log}}** muestra cuándo un móvil se añadió, inició sesión o fue rechazado, y cuál. Si ve uno que no conoce, quite ese móvil y cambie su contraseña de Tailscale.
- Si pierde el móvil, pulse dos veces el botón de la papelera bajo **{{ui:app.remote.passkeys}}** para quitarlo. Sus inicios de sesión terminan de inmediato. Quite también el dispositivo en la consola de administración de Tailscale.
- {{ui:app.remote.switch}} se desactiva solo tras 14 días sin que se añada ningún móvil ni se inicie sesión.

## La pantalla del móvil

En un móvil, la página adopta un diseño hecho para móviles. Cambia sola en una pantalla estrecha, y se mantiene así al girar el móvil de lado. Una barra con la marca de la aplicación (y la imagen que se está dibujando) y el botón del agente recorre la parte superior, y seis pestañas, la inferior.

![La pestaña Generar del móvil: ajustes predefinidos, la fila de la semilla y Generar, el modelo y los prompts en una columna](shot:phone-generate)

| Pestaña | Qué se puede hacer |
|---|---|
| **{{ui:app.tabs.generate}}** | Las mismas partes que el panel izquierdo del escritorio, en el mismo orden, en una columna ([Crear imágenes](02-generate.md)). Los ajustes predefinidos, la {{ui:params.seed.label}} y el botón **{{ui:params.invoke.invoke}}**, el modelo, los prompts, las imágenes de referencia, la corrección de alta resolución y los ajustes avanzados funcionan como en el ordenador. La fila con la {{ui:params.seed.label}} y el botón **{{ui:params.invoke.invoke}}** se queda arriba al desplazarse |
| **{{ui:phone.gallery}}** | Elija un **{{ui:phone.board}}** y sus imágenes se muestran de tres en tres por fila. Las imágenes que se están dibujando van primero. Toque una para abrirla a pantalla completa |
| **{{ui:app.views.drafts}}** | Lo mismo que los borradores del ordenador ([Elegir entre borradores](04-improve.md)). El botón **{{ui:drafts.open}}** de un candidato muestra su imagen a pantalla completa |
| **{{ui:app.tabs.queue}}** | Los elementos que esperan en la cola, los más nuevos primero. El icono de la pestaña muestra cuántos están esperando y dibujándose |
| **{{ui:app.tabs.models}}** | Lo mismo que la pestaña **{{ui:app.tabs.models}}** del ordenador ([Modelos](08-models.md)). La pantalla es pequeña, así que las tarjetas empiezan con su tamaño mínimo |
| **{{ui:app.tabs.browse}}** | Lo mismo que la pestaña **{{ui:app.tabs.browse}}** del ordenador. Busque modelos en Civitai y Hugging Face e instálelos. La búsqueda y los filtros están dentro del botón **{{ui:browse.menu}}**, arriba a la izquierda; su control deslizante **{{ui:browse.cardSize}}** cambia el tamaño de las tarjetas (empiezan con el mínimo) |

Mientras se dibuja una imagen, la barra de título la muestra en curso con su paso. Tóquela para verla dibujarse a pantalla completa. Cuando termina, se convierte en la imagen acabada.

Toque un modelo en la pestaña **{{ui:app.tabs.models}}** y sus detalles llenan la pantalla, como en la pestaña **{{ui:app.tabs.browse}}**; **{{ui:models.detail.close}}**, arriba, vuelve a la lista. El botón **{{ui:params.promptBook.open}}** bajo un prompt también abre su lista a pantalla completa, y la flecha de arriba a la izquierda vuelve atrás.

Abrir una lista como la del modelo, los LoRA o los ajustes predefinidos no hace aparecer el teclado. Toque el cuadro de búsqueda cuando quiera escribir.

### Pantalla completa

![Una imagen abierta a pantalla completa, con sus prompts, modelo y otra información](shot:phone-picture)

- Separe dos dedos para acercar y junte los dedos para alejar. Mueva una imagen ampliada con un dedo.
- Cuando no está ampliada, deslice hacia un lado para ir a la imagen siguiente del tablero. Los botones laterales hacen lo mismo.
- Toque dos veces para alternar entre ampliada y la imagen completa.
- El botón **{{ui:gallery.viewer.toggleMetadata}}** muestra los prompts, el modelo, la semilla y el tamaño.
- El botón de tres líneas de arriba a la derecha (**{{ui:phone.pictureMenu}}**) abre el mismo menú que al hacer clic derecho en una imagen en el ordenador. Mantener pulsada la imagen también lo abre. Se omiten los elementos que envían la imagen a un lugar que el móvil no tiene, como el lienzo o los flujos de trabajo.
- Los botones de abajo son **{{ui:gallery.menu.star}}**, **{{ui:common.download}}**, **{{ui:phone.useSettings}}** (pone los ajustes de la imagen en la pestaña Generar) y **{{ui:common.delete}}**. Que pregunte o no antes de eliminar depende de **{{ui:settings.confirmOnDelete}}** en los Ajustes.

### Trabajar con la cola

![La pestaña Cola del móvil: un elemento dibujándose y otro en espera](shot:phone-queue)

- **{{ui:queue.action.pause}}**, arriba (**{{ui:queue.action.resume}}** mientras está en pausa), detiene y reanuda la cola.
- **{{ui:queue.action.prune}}** quita de la lista los elementos terminados (completados, fallidos, cancelados).
- Un elemento en espera o dibujándose se puede cancelar con la × de su derecha. Un elemento fallido o cancelado se puede volver a ejecutar con el botón **{{ui:queue.action.retry}}** de su derecha.
- Toque un elemento que se está dibujando o uno terminado para abrir su imagen a pantalla completa.

### Hablar con el agente

![El agente en un móvil: una petición y lo que el agente configuró](shot:phone-chat)

Toque el botón de destellos de la barra de título (**{{ui:agent.open}}**) y el agente se abre sobre toda la pantalla. Hace lo mismo que en el ordenador ([El agente](09-assistant-settings.md)).

- Escriba la imagen que quiere o su pregunta en el cuadro de abajo y envíela con el botón de su derecha. Intro inicia una línea nueva. El botón del clip, a la izquierda, adjunta fotos del móvil.
- Los ajustes que cambia el agente pasan a la pestaña **{{ui:app.tabs.generate}}** del móvil. **{{ui:agent.generate}}**, bajo su respuesta, dibuja de inmediato, y **{{ui:agent.undo}}** lo deja todo como estaba.
- Los botones de la derecha de la barra superior abren **{{ui:agent.session.history}}** o inician un **{{ui:agent.session.new}}**. La flecha de la izquierda vuelve a la pantalla en la que estaba.
- Elegir la IA e iniciar sesión se hace en la pantalla del ordenador. Hasta entonces, el móvil lo indica.

Todo lo que no está en las seis pestañas, como el lienzo, los flujos de trabajo, los cómics y los ajustes, se usa en el ordenador.
