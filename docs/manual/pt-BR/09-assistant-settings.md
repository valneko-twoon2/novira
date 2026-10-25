# O assistente de IA, as configurações e os atalhos

Este capítulo explica o assistente de IA, que faz as configurações por você quando você diz o que quer em palavras, a tela de configurações, a lista de atalhos de teclado, a tela com informações sobre o app e o registro do desenvolvedor.

A tela de configurações, os atalhos de teclado e as informações sobre o app são abertos pelo **{{ui:app.nav.settingsMenu}}**, no canto inferior esquerdo da tela.

## O assistente de IA

![A janela do assistente de IA. A primeira tela, onde se escolhe qual IA usar e se faz o login](shot:agent)

Ao pressionar o botão **IA** (**{{ui:agent.open}}**) na navegação à esquerda, abre-se a janela **{{ui:agent.title}}**. É possível mover a janela arrastando o título.

Em vez de escolher modelos e LoRAs ou definir você mesmo o prompt e o tamanho, você diz em palavras o que quer criar, como “uma garota em estilo anime em pé numa praia ao pôr do sol”, e o assistente escolhe as configurações e as preenche para você.

### Primeiros passos (login)

O novira não executa uma IA por conta própria para o assistente. Ele chama um comando de IA que está no seu computador (Claude ou Codex) para produzir as respostas. Para usá-lo, é preciso fazer a seguinte preparação.

1. Instale um dos comandos no computador: **Claude**, da Anthropic, ou **Codex**, da OpenAI.
2. Abra o assistente e pressione o que deseja usar (**{{ui:agent.setup.claude}}** ou **{{ui:agent.setup.codex}}**).
3. Um navegador se abre, e é nele que você faz o login.

Se esse comando não for encontrado no computador, aparece a mensagem “O comando ○○ não foi encontrado neste PC. Instale-o primeiro.”. Instale esse comando antes.

Os serviços e contratos usados são os da opção que você escolheu. O novira não guarda chaves de API. O conteúdo da conversa (o texto que você enviou, a lista atual de modelos e configurações etc.) é enviado ao serviço que você escolheu.

A IA escolhida aparece no título, na parte superior da janela. Para trocá-la, pressione o botão **{{ui:agent.changeProvider}}** na parte superior.

### O que ele faz por você

A partir do seu texto, o assistente decide o seguinte e preenche as configurações. O que foi preenchido aparece como uma lista na resposta.

| O quê | Exemplo |
|---|---|
| Escolher um modelo | Escolhe um adequado entre os modelos que você tem |
| Adicionar um LoRA | Adiciona um LoRA que combine com o estilo de arte |
| Prompt | Escreve o prompt e o prompt negativo |
| Alterar configurações | Tamanho, passos, CFG, agendador, seed |
| Fluxo de trabalho | Monta um grafo ou corrige o grafo que está aberto |
| Texto | Corrige o texto e os balões de fala abertos em **{{ui:media.tab.text}}** |
| Vídeo, música, voz | Altera as configurações de cada uma dessas telas |
| Quadrinho | Em **{{ui:app.tabs.comic}}**, muda a divisão em quadros, adiciona e divide quadros e muda o prompt e a pose de cada quadro e os balões (veja “Ajuda com o quadrinho” abaixo) |
| Pose | Coloca em **{{ui:app.tabs.canvas}}** uma figura com a pose pedida em palavras (veja [Desenhar sobre a tela](05-canvas.md#criar-uma-pose-na-tela)) |
| Recomendação de extensões | Indica extensões adequadas ao que você quer fazer, que podem ser instaladas por um botão |
| Perguntas sobre o app | Responde com os nomes das telas e onde pressionar |
| Explicar extensões | Diz o que uma extensão faz e como usá-la (veja “Perguntar sobre o app e as extensões” abaixo) |

O assistente observa qual tela você tem aberta. Por exemplo, se você abrir **{{ui:media.tab.text}}** e disser “deixe o texto na vertical”, esse texto muda.

O assistente apenas altera configurações. Ele não cria imagens. Se o resultado parecer bom, pressione **{{ui:agent.generate}}** na resposta dele e a criação começa na hora.

### Ajuda com o quadrinho

Se você pedir com **{{ui:app.tabs.comic}}** aberto, o assistente lê a página aberta (a forma dos quadros, o prompt de cada quadro, as poses e os balões) e a reescreve diretamente. Por exemplo, você pode pedir assim.

- Peça “Faça 5 quadros com um momento de destaque. O primeiro grande, cortado na diagonal” e ele cria a divisão em quadros. Ele pode usar um modelo de página padrão ou decidir sozinho a forma dos quadros.
- Peça “Escreva o prompt de cada quadro com esta história” e ele escreve, para cada quadro, um prompt com um enquadramento que combina com o andamento da história (close, plano geral, contra-plongée etc.).
- Peça “Coloque falas em cada quadro” e ele posiciona balões e escreve as falas neles.
- Peça “Coloque a menina do quadro 2 numa pose de corrida” e ele dá uma pose a esse quadro.

Ele não desenha as imagens em si. Quando os prompts estiverem prontos, clique em **{{ui:comic.panel.draw}}** ou **{{ui:comic.page.drawAll}}**. Ao clicar em **{{ui:agent.undo}}**, as páginas do quadrinho alteradas por aquela resposta voltam ao que eram, todas de uma vez.

### Escolher o modelo e o nível de raciocínio

Clique no pequeno botão em forma de cérebro à direita do nome do chat para escolher o **{{ui:agent.model.label}}** e o **{{ui:agent.effort.label}}** que o assistente usa. O que você escolher é usado a partir da próxima mensagem enviada. Claude e Codex guardam cada um a sua escolha.

- O modelo do Claude é escolhido entre **{{ui:agent.model.default}}**, Fable, Opus, Sonnet e Haiku. Clique em **{{ui:agent.model.custom}}** para digitar diretamente o nome de um modelo. O nível de raciocínio tem 5 graus, de **{{ui:agent.effort.low}}** a **{{ui:agent.effort.max}}**.
- O modelo do Codex não pode ser escolhido (vale a configuração do próprio comando). O nível de raciocínio é **{{ui:agent.effort.low}}**, **{{ui:agent.effort.medium}}** ou **{{ui:agent.effort.high}}**.

Com **{{ui:agent.model.default}}**, vale a configuração do próprio comando.

### Chamar um modelo de pedido

Digite “/” no início da caixa de entrada e abre-se uma lista de modelos dos pedidos que você mais faz. Continue digitando letras depois da “/” e ficam só os que contêm essas letras no nome, no comando ou no texto (por exemplo, “/quadrinho” ou “/comic”).

Escolha com as setas para cima e para baixo e confirme com Enter ou Tab. Clicar em uma linha da lista também confirma. O texto do modelo escolhido entra na caixa de entrada; complete o restante e então envie (só escolher não envia). A tecla Esc fecha a lista.

### Perguntar sobre o app e as extensões

Além de pedir que ele configure algo, você pode fazer perguntas. Por exemplo, “Como removo um fundo?” ou “Onde adiciono um modelo?” Ele responde com os nomes das telas como aparecem e diz onde pressionar. Ele responde no idioma que você está usando.

Também é possível perguntar sobre extensões. Ele explica em palavras simples o que uma extensão faz, quando usá-la e como. Há três maneiras de perguntar:

- Pressione um cartão em **{{ui:app.nav.extensions}}** para abrir os detalhes e depois pressione **{{ui:agent.ask.button}}**. Uma pergunta sobre essa extensão é enviada em um novo chat.
- Digite uma palavra no campo de busca na parte superior de **{{ui:app.nav.extensions}}** e pressione **{{ui:agent.ask.resultsButton}}**, que aparece. Ele explica como as extensões encontradas (até as 8 primeiras) se diferenciam e qual experimentar primeiro.
- Escreva no chat o nome de uma extensão (em letras latinas) e pergunte. Ele procura entre as extensões publicadas as que têm nome ou descrição correspondentes (e carrega a lista antes, se ainda não estiver carregada).

Para uma extensão que você já instalou, ele também informa os nós que a extensão adiciona e a que conectá-los. Para uma que você ainda não instalou, um cartão acompanha a resposta, e é possível instalá-la ali mesmo com **{{ui:workflows.packs.install}}**.

> A explicação se baseia na descrição publicada da extensão e nas informações de seus nós. O assistente deve avisar quando não souber, mas ainda pode errar. Confira a página da extensão antes de instalá-la.

### Desfazer

Uma resposta que preencheu configurações recebe um botão **{{ui:agent.undo}}**. Ao pressioná-lo, as configurações voltam ao que eram antes dessa resposta.

No entanto, depois de reabrir o app, as alterações feitas antes disso não podem ser desfeitas (o botão não pode mais ser pressionado).

### Histórico de chats

Suas conversas com o assistente são guardadas como um “chat”. Ao pressionar o nome do chat na parte superior da janela, abre-se a lista **{{ui:agent.session.history}}**.

- Escolha na lista e é possível continuar de onde aquele chat parou.
- Com **{{ui:agent.session.rename}}**, é possível dar um nome a ele.
- Com **{{ui:agent.session.delete}}**, é possível removê-lo.
- Com **{{ui:agent.session.new}}**, ao lado, é possível iniciar um novo chat.

> Enquanto você espera uma resposta, não é possível enviar outra mensagem. Espere até que a indicação “{{ui:agent.thinking}}” desapareça ou cancele com o botão **{{ui:agent.stop}}**, que ocupa o lugar do botão de enviar. Um pedido cancelado não altera nenhuma configuração.

Arraste qualquer uma das quatro bordas ou dos quatro cantos da janela para mudar o tamanho. O canto inferior direito mostra uma marca para isso. O tamanho é lembrado. Quando uma resposta vem com a forma como a IA entendeu seu pedido, ela aparece como uma linha acima da resposta. Pressione-a para abrir o relato completo (**{{ui:agent.thoughts.label}}**). É o resumo curto da própria IA sobre como ela entendeu o pedido e por que escolheu o que escolheu, não o seu raciocínio interno bruto.

## Configurações

![A tela de configurações. Os itens Geral, Contas, Geração, Interface e Desenvolvedor aparecem alinhados](shot:settings)

Ao escolher **{{ui:app.nav.settings}}** no **{{ui:app.nav.settingsMenu}}**, no canto inferior esquerdo, abre-se a tela de configurações. O que você altera é usado na hora e permanece mesmo depois de fechar o app.

> Esta imagem é uma tela de exemplo executada em um navegador. Ela não mostra **{{ui:settings.uiZoom.label}}**, que existe apenas na versão para desktop.

### {{ui:settings.section.general}}

| Item | O que é |
|---|---|
| {{ui:settings.language.label}} | Escolha entre {{ui:settings.language.ja}}, {{ui:settings.language.en}}, {{ui:settings.language.zhcn}}, {{ui:settings.language.zhtw}}, {{ui:settings.language.ko}}, {{ui:settings.language.ru}}, {{ui:settings.language.es}}, {{ui:settings.language.ptbr}}, {{ui:settings.language.fr}} e {{ui:settings.language.de}}. As palavras na tela mudam na hora |
| {{ui:settings.theme.label}} | **{{ui:settings.theme.dark}}** (o padrão) ou **{{ui:settings.theme.light}}** |

### {{ui:settings.section.accounts}}

São campos para quando um site que distribui modelos exige que você faça login. O que você digita é criptografado e salvo neste computador, e não é exibido na tela.

| Item | O que é |
|---|---|
| {{ui:settings.civitaiKey.label}} | Usada para baixar modelos que exigem login |
| {{ui:settings.hfToken.label}} | Usado para baixar modelos que exigem solicitação de acesso |

Cole e pressione **{{ui:settings.civitaiKey.save}}**. Depois, também é possível usar **{{ui:settings.civitaiKey.change}}** ou **{{ui:settings.civitaiKey.remove}}**.

### {{ui:settings.section.generation}}

- **{{ui:settings.antialiasProgressImages}}**: mostra as imagens em andamento de forma suave na moldura “{{ui:gallery.generating.title}}” da galeria. Se estiver desligado, elas parecem pontos grosseiros.
- **{{ui:settings.lowMemory.label}}**: para computadores cuja GPU tem pouca memória. Quando ligado, os modelos não ficam guardados na memória da GPU, então é preciso menos memória, mas a criação fica mais lenta. Ao alterá-lo, o mecanismo é reiniciado. Enquanto um item está sendo criado, vale a partir da próxima vez que o mecanismo for iniciado. Não pode ser usado enquanto o app está conectado a um mecanismo iniciado em outro lugar.

### {{ui:settings.section.ui}}

- **{{ui:settings.uiZoom.label}}** (somente na versão para desktop): o tamanho de toda a tela. É possível escolher de 50% a 300%. Também é possível alterar com `Ctrl` e `+` / `-`.
- **{{ui:settings.confirmOnDelete}}**: mostra uma confirmação antes de excluir uma imagem. Isso também é desligado quando você escolhe “{{ui:common.dontAskAgain}}” na tela de confirmação.

### {{ui:share.backup.section}}

![A parte Backup das configurações: os botões para criar um backup e para restaurar a partir de um](shot:settings-backup)

É possível salvar suas imagens e o que você configurou e registrou no app em um único arquivo zip, para levar a outro computador ou por precaução.

- **{{ui:share.backup.create}}**: abre-se uma janela para escolher onde salvar. O nome do arquivo começa como “novira-backup-data-hora.zip”. Com muitas imagens, demora um pouco, e o andamento aparece nesta parte.
- **{{ui:share.backup.restore}}**: escolha um arquivo zip de backup. O conteúdo é verificado e depois se abre uma janela de confirmação.

O que um backup contém e o que não contém:

| Incluído | Não incluído |
|---|---|
| As imagens, os vídeos e os sons da galeria, com suas miniaturas | Modelos |
| Pastas, fluxos de trabalho, quadrinhos e os registros da fila | O mecanismo de imagens (ComfyUI) e as extensões |
| Personagens, predefinições, a lista de prompts, rascunhos, os chats com o assistente de IA e as configurações da tela | Chaves de API e tokens, e configurações que pertencem a este computador (como onde está o ComfyUI) |

![A confirmação de restauração: quando o backup foi feito, o que ele contém e o aviso de que tudo será substituído](shot:restore-confirm)

A janela de confirmação mostra quando o backup foi feito e quantas imagens, pastas e fluxos de trabalho ele contém. Pressione **{{ui:share.backup.confirm}}**: o app fecha e inicia de novo, e seus dados atuais são substituídos pelos do backup. Se isso falhar, os dados anteriores são restaurados e você é avisado.

> Os dados substituídos não podem ser recuperados; crie antes um backup do estado atual, se puder precisar dele. As chaves de API e os tokens são criptografados apenas para este computador, então digite-os novamente em **{{ui:settings.section.accounts}}** depois de uma restauração. Em um navegador, é baixado um arquivo JSON sem as imagens, e a restauração não está disponível.

### {{ui:settings.section.developer}}

- **{{ui:settings.showDevLog}}**: mostra um botão “{{ui:app.devlog.short}}” na navegação à esquerda (veja “Log do desenvolvedor” abaixo).
- **{{ui:settings.clearIntermediates}}**: exclui imagens que não aparecem na galeria, como resultados intermediários da tela. O número de itens a excluir é mostrado no botão.
- **{{ui:settings.resetWebUi}}**: devolve as configurações e o estado da tela aos valores iniciais. Imagens e modelos não são excluídos. Depois de pressioná-lo, confirme com **{{ui:settings.resetConfirm}}** e recarregue com **{{ui:settings.reload}}**.

A tela de configurações também tem as chaves “{{ui:settings.useCpuNoise}}”, “{{ui:settings.enableInformationalPopovers}}”, “{{ui:settings.enableImageDebugging}}” e “{{ui:settings.clearIntermediatesOnStartup}}”. Na versão atual, elas não alteram a geração nem o comportamento da tela.

Na parte mais baixa da tela, aparece a versão do app.

## Atalhos de teclado

![A lista de atalhos de teclado. Ações e teclas alinhadas por categoria, como App e Tela](shot:hotkeys)

Escolha **{{ui:app.nav.hotkeys}}** no **{{ui:app.nav.settingsMenu}}**, no canto inferior esquerdo, ou pressione `Shift+?`, e a lista se abre. Com o campo de busca na parte superior, é possível pesquisar pelo nome da ação ou pela tecla.

Aqui estão os mais usados. Para ver todos, consulte a lista na tela.

### O app inteiro

| Tecla | Ação |
|---|---|
| `Ctrl+Enter` | Gerar (adicionar à fila) |
| `Ctrl+Shift+Enter` | Adicionar ao início da fila e gerar |
| `Shift+X` | Cancelar o item em processamento |
| `Ctrl+Shift+X` | Limpar toda a fila |
| `Alt+A` | Ir para o campo do prompt |
| `T` | Abrir e fechar o painel esquerdo |
| `G` | Abrir e fechar o painel direito |
| `F` | Abrir e fechar os dois painéis juntos |
| `1` a `9`, `0` | Ir para a aba numerada |
| `Shift+?` | Abrir a lista de atalhos |
| `Ctrl` + `+` / `-` | Aumentar e diminuir o zoom de toda a tela |

### Tela

| Tecla | Ação |
|---|---|
| `B` | {{ui:settings.hotkeys.canvas.brush}} |
| `E` | {{ui:settings.hotkeys.canvas.eraser}} |
| `U` | {{ui:settings.hotkeys.canvas.rect}} |
| `V` | {{ui:settings.hotkeys.canvas.move}} |
| `C` | {{ui:settings.hotkeys.canvas.bbox}} |
| `H` | Mover a visualização |
| `I` | {{ui:settings.hotkeys.canvas.colorPicker}} |
| `[` / `]` | Diminuir e aumentar o pincel |
| `Ctrl+Z` | {{ui:settings.hotkeys.canvas.undo}} |
| `Ctrl+Shift+Z`, `Ctrl+Y` | {{ui:settings.hotkeys.canvas.redo}} |
| `Q` | Alternar com a ferramenta usada anteriormente |
| `Enter`, `Esc` | {{ui:settings.hotkeys.canvas.acceptStaged}}, {{ui:settings.hotkeys.canvas.discardStaged}} |

### A galeria e o visualizador

| Tecla | Ação |
|---|---|
| Teclas de seta | {{ui:settings.hotkeys.gallery.navigate}} |
| `Ctrl+A` | {{ui:settings.hotkeys.gallery.selectAll}} |
| `Esc` | {{ui:settings.hotkeys.gallery.clearSelection}} |
| `.` | {{ui:settings.hotkeys.gallery.star}} |
| `I` | {{ui:settings.hotkeys.viewer.toggleMetadata}} |
| `R` | {{ui:settings.hotkeys.viewer.remix}} (carregar tudo, exceto a seed) |
| `P`, `S`, `A` | Carregar o prompt, a seed, tudo |
| `W` | {{ui:settings.hotkeys.viewer.loadWorkflow}} |
| `Shift+U` | {{ui:settings.hotkeys.viewer.upscale}} |
| `C` | {{ui:settings.hotkeys.viewer.compare}} |
| `Delete` | {{ui:settings.hotkeys.viewer.delete}} |
| `Ctrl+0`, `Ctrl+1` | {{ui:settings.hotkeys.viewer.zoomFit}}, {{ui:settings.hotkeys.viewer.zoomActual}} |

### Fluxos de trabalho

| Tecla | Ação |
|---|---|
| `Shift+A`, `Space` | {{ui:settings.hotkeys.workflows.addNode}} |
| `Delete` | Excluir os nós e as conexões escolhidos |
| `Ctrl+C`, `Ctrl+V` | {{ui:settings.hotkeys.workflows.copy}}, {{ui:settings.hotkeys.workflows.paste}} |
| `Ctrl+S` | {{ui:settings.hotkeys.workflows.save}} |
| `Ctrl+Z`, `Ctrl+Shift+Z` | {{ui:settings.hotkeys.workflows.undo}}, {{ui:settings.hotkeys.workflows.redo}} |

Enquanto você digita em um campo, as teclas de uma só letra, como `T` e `G`, não funcionam.

## Sobre este app

![A tela com informações sobre o aplicativo. O logotipo, a versão, a licença e a lista de software de código aberto usado](shot:about)

Ao escolher **{{ui:app.nav.about}}** no **{{ui:app.nav.settingsMenu}}** no canto inferior esquerdo, aparecem no topo o nome do aplicativo, a versão, a licença e os direitos autorais. Abaixo há duas abas.

- **{{ui:settings.about.license.title}}**: o texto completo da licença do novira (Apache License 2.0). A pasta de instalação tem o mesmo arquivo (`LICENSE`).
- **{{ui:settings.about.oss.title}}**: os softwares de código aberto que o app usa. Cada linha mostra um nome e uma versão. Ao clicar em **{{ui:settings.about.oss.showLicense}}**, o texto completo da licença aparece abaixo da linha (clique de novo para fechar). Ao clicar em **{{ui:settings.about.oss.homepage}}**, a página abre no navegador. O motor de geração e as extensões não vêm com o app; consulte a licença completa na página deles.

Os botões acima da lista a limitam a **{{ui:settings.about.oss.short.frontend}}**, **{{ui:settings.about.oss.short.backend}}**, **{{ui:settings.about.oss.short.engine}}** ou **{{ui:settings.about.oss.short.packs}}** (as extensões instaladas agora). A caixa de busca encontra softwares pelo nome. Os textos completos das licenças dos softwares incluídos também estão reunidos em `THIRD_PARTY_NOTICES.txt`, na pasta de instalação.

Extensões (nós personalizados do ComfyUI) e modelos seguem, ao serem instalados, a licença de seus próprios distribuidores.

## Log do desenvolvedor

É um log para descobrir a causa quando algo não vai bem. Não é preciso usá-lo no dia a dia.

Ao ligar **{{ui:settings.showDevLog}}** em **{{ui:settings.title}}**, aparece um botão “{{ui:app.devlog.short}}” na navegação à esquerda. Pressione-o e o painel **{{ui:app.devlog.title}}** se abre no lado direito.

Aqui, os registros internos do app (o log do backend), os avisos na tela e os erros que não foram tratados aparecem alinhados com seus horários.

- Com o seletor na parte superior, é possível filtrar por **{{ui:app.devlog.level.all}}**, **{{ui:app.devlog.level.warn}}** ou **{{ui:app.devlog.level.error}}**.
- Se você digitar palavras no campo de filtro, somente as linhas que contêm essas palavras são exibidas.
- Com **{{ui:app.devlog.copy}}**, é possível copiar como texto as linhas exibidas. Você pode colá-las ao relatar um problema.
- É possível limpar com **{{ui:app.devlog.clear}}**.

> O log cobre o tempo em que o app ficou aberto. Ao fechá-lo, o log na tela desaparece. Para formas mais detalhadas de investigar, vá a [Solução de problemas](10-troubleshooting.md).
