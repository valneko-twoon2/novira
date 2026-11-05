# Usar pelo celular

Pelo navegador de um celular conectado ao Wi-Fi da sua casa, você pode usar o novira do seu computador. Quem desenha as imagens é o computador; o celular só mostra a tela e recebe os seus toques. As configurações, os rascunhos, o histórico e o resto são os mesmos de quando você abre no computador. Quando as telas do celular e do computador estão abertas ao mesmo tempo, o que você muda em uma delas (prompt, modelo, LoRA, configurações de geração, predefinições, coleções de prompts e rascunhos) aparece nas outras telas abertas em cerca de 1 a 2 segundos. As configurações de exibição, como idioma, tema e tamanho da tela, o conteúdo em edição na tela e nos fluxos de trabalho e as conversas com o agente são próprios de cada tela e se igualam na próxima vez que você abrir. A comunicação é criptografada, e o celular só se conecta depois de ser autorizado no computador.

## Como conectar

1. Pressione **{{ui:app.tabs.short.homeLink}}**, na barra à esquerda do app novira. A rede em que você pressionou é lembrada como a da sua casa, e a porta de entrada se abre.
2. Aparece um código QR. Leia-o com a câmera de um celular conectado ao mesmo Wi-Fi do computador e abra o endereço que aparecer. Se você abriu com um app leitor de QR, pode reabrir o endereço no Safari ou no Chrome antes de conectar. O código expira em 2 minutos e vale para um único celular. Se expirar, pressione **{{ui:app.lan.newCode}}**.
3. Em um celular novo, o navegador mostra um aviso de certificado. Instale o certificado seguindo os passos de “Instalar o certificado”, abaixo.
4. Na tela do celular, confira o nome do dispositivo e pressione “Conectar”. O celular mostra um número de confirmação de 6 dígitos. O mesmo número aparece na tela **{{ui:app.tabs.short.homeLink}}** do computador (se ela não estiver aberta, em uma notificação no canto da tela); se for igual, pressione **{{ui:app.lan.allow}}**. O novira abre no celular.

Quando você fecha o app, a porta de entrada também se fecha, e o celular que estava conectado volta a se conectar na próxima vez que abrir.

### Conectar pela versão para navegador

Também é possível conectar do mesmo jeito pela versão para navegador, sem abrir o app. Feche o app (a pasta de dados só pode ser usada por um programa de cada vez), abra no Explorador de Arquivos a pasta do app (a que tem o `server.bat`), digite `cmd` na barra de endereço, no alto, e pressione Enter. No Prompt de Comando que se abrir, digite `server.bat` e pressione Enter: a mesma tela se abre no navegador do computador; então pressione **{{ui:app.tabs.short.homeLink}}**, na barra à esquerda. Para parar, pressione Ctrl+C no Prompt de Comando ou feche a janela dele.

### Instalar o certificado

O novira criptografa a comunicação com o celular com um certificado criado neste computador (novira local CA). Enquanto o celular não conhece esse certificado, o navegador avisa que “não é seguro”. Instale o certificado no celular uma única vez, no início. Abra “Instalar o certificado”, na parte de baixo da tela do celular, e baixe o certificado pelo link.

- iPhone: pressione o link, pressione “Permitir” e instale pelo “Perfil baixado”, no alto do app Ajustes. Depois, em Ajustes, “Geral”, “Sobre”, “Ajustes de Confiança do Certificado”, ative novira local CA. Se você esquecer esse último passo, o aviso não desaparece mesmo com o certificado instalado.
- Android (Chrome): em Configurações, “Segurança”, “Instalar certificado”, “Certificado de CA”, escolha o certificado baixado. O Firefox não usa certificados instalados depois. Abra no Chrome.

### Quando fechar

Não há um botão para fechar a porta de entrada da rede da casa. Mesmo fechando o pop-up, o celular conectado continua funcionando.

- Se ninguém usar por 30 minutos e não houver código esperando nem aprovação pendente, ela se fecha automaticamente.
- Ela também se fecha automaticamente quando a rede deixa de ser de confiança, por exemplo ao mudar para outro Wi-Fi.
- Os celulares conectados podem ser desconectados um a um com o × da lista. A conexão do celular cai se ele ficar 30 minutos sem uso ou 4 horas depois de conectado.

### Quando o Windows perguntar

Na primeira vez que a porta de entrada se abre, o Windows pergunta se permite a comunicação do novira (na versão para navegador, do novira-server). Permita a comunicação em redes privadas.

Quando o Windows trata a rede em uso como “Pública”, a tela mostra um aviso. Abra somente quando for a sua própria rede. Se não conseguir conectar pelo celular, abra em “Configurações” do Windows, “Rede e Internet”, as propriedades do Wi-Fi (ou da rede com fio) em uso e mude o tipo de perfil de rede para “Rede privada”.

### Dispositivos que se conectam e cuidados

- Só respondem os dispositivos na mesma rede deste computador (a mesma faixa do mesmo roteador). Um celular fora de casa ou que passe por uma VPN não se conecta. Para usar fora de casa, use o método de “Usar fora de casa”, abaixo.
- Mesmo um dispositivo no mesmo Wi-Fi só pode usar se for autorizado no computador. Não mostre o código QR a ninguém. Se o número de confirmação for diferente ou o celular for desconhecido, pressione **{{ui:app.lan.deny}}**.
- A comunicação é criptografada por https.
- Em redes desconhecidas (como cafés), não pressione **{{ui:app.tabs.short.homeLink}}**. A rede em que você pressiona passa a ser de confiança, e a porta de entrada se abre.

## Usar fora de casa

Com o [Tailscale](https://tailscale.com/), também é possível usar o novira do computador pelo celular fora de casa. Não é preciso abrir portas no roteador. O celular entra com uma chave de acesso (passkey: rosto, impressão digital ou senha do aparelho) registrada uma vez em casa.

### Preparar

1. Instale o Tailscale no computador e no celular e entre com a mesma conta. Ative a verificação em duas etapas na conta do Tailscale.
2. No painel de administração do Tailscale (configuração de DNS), ative o MagicDNS e os certificados HTTPS.
3. No nome do computador no Tailscale, não coloque palavras que você não queira divulgar, como o seu nome verdadeiro. Ao criar o certificado, o nome do computador e o nome da tailnet entram no registro público de certificados (Certificate Transparency). Só com o nome, ninguém consegue entrar.

### Ativar e registrar o celular

1. Pressione **{{ui:app.tabs.short.homeLink}}**, na barra à esquerda, e abra a aba **{{ui:app.lan.tabAway}}**.
2. Ative **{{ui:app.remote.switch}}**. Quando o nome do computador no Tailscale (como `pc.tail1234.ts.net`) aparece, está tudo pronto. Se não for possível abrir, o motivo é exibido. O que foi ativado continua na próxima vez que você abrir o novira.
3. Ative o Tailscale no celular e leia o código QR que aparece ao pressionar **{{ui:app.remote.enrol}}**. O registro só pode ser feito em casa (porque é autorizado no computador).
4. No celular, confira o nome e pressione “Iniciar o registro”; se o número de confirmação que aparece no computador for o mesmo, pressione **{{ui:app.lan.allow}}**.
5. Pressione “Criar uma chave de acesso”, que aparece no celular, e confirme com o rosto, a impressão digital ou a senha. O dispositivo registrado aparece em **{{ui:app.remote.passkeys}}**.

### Abrir fora de casa

Ative o Tailscale no celular, abra o endereço do momento do registro (`https://pc.tail1234.ts.net:número-da-porta/`) e pressione “Entrar com a chave de acesso”. É prático guardá-lo nos favoritos. O novira (ou a versão para navegador) precisa estar aberto no computador, e o Tailscale do computador precisa estar conectado.

- O que dá para fazer é o mesmo de quando se conecta pelo Wi-Fi de casa. Instalar modelos e extensões, as configurações do mecanismo, as chaves e as configurações do agente só podem ser feitas no computador.
- O login expira se ficar 30 minutos sem uso ou 4 horas depois de entrar. Entre de novo com a chave de acesso.
- Em **{{ui:app.remote.log}}**, aparecem a data e hora e o dispositivo de cada registro, login e recusa. Se houver algo que você não reconhece, apague o registro desse dispositivo e troque também a senha do Tailscale.
- Se perder o celular, pressione duas vezes o botão de lixeira em **{{ui:app.remote.passkeys}}** para apagar o registro. O login desse dispositivo também cai na hora. Remova também o dispositivo no painel de administração do Tailscale.
- {{ui:app.remote.switch}} se desativa automaticamente se ficar 14 dias sem registro nem login.

## A tela do celular

Ao abrir no celular, aparece uma tela própria para celular. Ela muda sozinha em telas de pouca largura e é a mesma com o celular na horizontal. No alto fica uma barra com a marca do app (e a imagem que está sendo desenhada) e o botão do agente, e embaixo ficam 6 abas.

![A aba de geração no celular. Predefinição, seed e botão de gerar, modelo e prompt aparecem em coluna](shot:phone-generate)

| Aba | O que dá para fazer |
|---|---|
| **{{ui:app.tabs.generate}}** | Os mesmos componentes do painel esquerdo do computador aparecem em coluna, na mesma ordem ([Criar imagens](02-generate.md)). Predefinição, {{ui:params.seed.label}} e o botão **{{ui:params.invoke.invoke}}**, modelo, prompt, imagem de referência, correção em alta resolução e configurações detalhadas funcionam como no computador. A linha de {{ui:params.seed.label}} e do botão **{{ui:params.invoke.invoke}}** permanece no alto mesmo ao rolar |
| **{{ui:phone.gallery}}** | Ao escolher um **{{ui:phone.board}}**, as imagens desse board aparecem em 3 colunas. As imagens em andamento aparecem primeiro. Ao pressionar uma, ela abre em tela cheia |
| **{{ui:app.views.drafts}}** | O mesmo que os rascunhos do computador ([Escolher entre rascunhos](04-improve.md#escolher-entre-rascunhos)). O botão **{{ui:drafts.open}}** do candidato mostra essa imagem em tela cheia |
| **{{ui:app.tabs.queue}}** | Os itens na fila aparecem do mais novo para o mais antigo. O ícone da aba mostra o número de itens esperando e em desenho |
| **{{ui:app.tabs.models}}** | O mesmo que a aba {{ui:app.tabs.models}} do computador ([Gerenciar e encontrar modelos](08-models.md)). Como a tela é pequena, os cartões começam no menor tamanho |
| **{{ui:app.tabs.browse}}** | O mesmo que a aba {{ui:app.tabs.browse}} do computador. É possível procurar e instalar modelos no Civitai e no Hugging Face. A busca e os filtros ficam dentro do botão **{{ui:browse.menu}}**, no canto superior esquerdo, e ali **{{ui:browse.cardSize}}** muda o tamanho dos cartões da lista (começa no menor tamanho) |

Enquanto uma imagem está sendo desenhada, a barra de título mostra a imagem parcial e o andamento. Ao pressioná-la, é possível ver em tela cheia a imagem sendo desenhada. Quando termina, ela passa a ser a imagem pronta.

Ao pressionar um modelo na aba **{{ui:app.tabs.models}}**, os detalhes se abrem ocupando a tela inteira, como na aba **{{ui:app.tabs.browse}}**. Com **{{ui:models.detail.close}}**, no alto, você volta à lista. A lista do botão **{{ui:params.promptBook.open}}**, abaixo do prompt, também se abre em tela cheia, e a seta no canto superior esquerdo volta.

Mesmo ao abrir listas de modelos, LoRAs, predefinições etc., o teclado não aparece. Quando quiser digitar, pressione o campo de busca.

### Ver em tela cheia

![Uma imagem aberta em tela cheia, com informações como o prompt e o modelo](shot:phone-picture)

- Abrir dois dedos amplia, e juntá-los reduz. Uma imagem ampliada pode ser movida com um dedo.
- Sem ampliar, deslizar para o lado passa para a imagem vizinha do board. Os botões esquerdo e direito também levam a ela.
- Tocar duas vezes alterna entre ampliado e o tamanho original.
- O botão **{{ui:gallery.viewer.toggleMetadata}}** mostra o prompt, o modelo, a seed e o tamanho.
- O botão de três linhas, no canto superior direito (**{{ui:phone.pictureMenu}}**), abre o mesmo menu que aparece ao clicar com o botão direito em uma imagem no computador. Pressionar a imagem por um tempo também o abre. Os itens que enviam para lugares que não existem na tela do celular, como a tela e os fluxos de trabalho, não aparecem.
- Os botões de baixo permitem **{{ui:gallery.menu.star}}**, **{{ui:common.download}}**, **{{ui:phone.useSettings}}** (coloca as configurações dessa imagem na aba de geração) e **{{ui:common.delete}}**. A confirmação antes de apagar segue **{{ui:settings.confirmOnDelete}}**, nas configurações.

### Operar a fila

![A aba de fila no celular. Um item em desenho e itens esperando](shot:phone-queue)

- **{{ui:queue.action.pause}}**, no alto (**{{ui:queue.action.resume}}**, quando está parada), para e retoma o processamento da fila.
- **{{ui:queue.action.prune}}** remove da lista os itens terminados (concluídos, com falha e cancelados).
- Um item esperando ou em desenho pode ser cancelado com o × à direita. Um item com falha ou cancelado pode ser refeito com o botão **{{ui:queue.action.retry}}**, à direita.
- Ao pressionar um item em desenho ou pronto, a imagem dele abre em tela cheia.

### Conversar com o agente

![O agente no celular. O pedido e o que o agente configurou](shot:phone-chat)

Ao pressionar o botão de brilhos (**{{ui:agent.open}}**), na barra de título, o agente se abre ocupando a tela inteira. O que ele faz é o mesmo do computador ([O agente](09-assistant-settings.md#o-agente)).

- Escreva no campo de baixo a imagem que quer criar ou o que quer perguntar, e envie com o botão de enviar, à direita. Enter faz uma quebra de linha. Com o botão de clipe, à esquerda, é possível anexar fotos do celular.
- As configurações que o agente muda entram na aba **{{ui:app.tabs.generate}}** do celular. Com **{{ui:agent.generate}}**, abaixo da resposta, você gera na hora, e com **{{ui:agent.undo}}** volta ao que era.
- Com os botões à direita da barra de cima, abre-se **{{ui:agent.session.history}}** ou começa-se **{{ui:agent.session.new}}**. A seta da esquerda volta à tela anterior.
- Escolher a IA a usar e fazer o login são coisas feitas na tela do computador. Se ainda não foram feitas, o celular mostra um aviso.

O que não está nas 6 abas, como tela, fluxos de trabalho, quadrinho e configurações, é usado no computador.
