# A galeria e o visualizador

As imagens criadas ficam na **galeria**, no lado direito da tela. A imagem escolhida na galeria pode ser vista em tamanho grande no **{{ui:app.views.viewer}}**, no centro.
Este capítulo explica como organizar e procurar imagens, como vê-las no visualizador, como recarregar as configurações e como excluir e baixar.

## Conhecendo a galeria

Ao escolher a aba **{{ui:app.right.gallery}}**, no alto do painel da direita, a galeria aparece (a aba ao lado, **{{ui:app.right.assistant}}**, é o [assistente de IA](09-assistant-settings.md#o-agente)). A galeria tem duas partes, uma em cima e outra embaixo.

- Em cima: **{{ui:gallery.boards.title}}**. São como pastas onde se guardam as imagens.
- Embaixo: as miniaturas das imagens da pasta escolhida.

A linha acima das miniaturas contém:

- A troca entre “{{ui:gallery.view.images}}” e “{{ui:gallery.view.assets}}” e o número de imagens.
- Botão de lupa: busca ({{ui:gallery.search.label}})
- Botão de calendário: {{ui:gallery.date.button}}
- Botão de engrenagem: {{ui:gallery.settings.title}}
- Botão de seta para cima: {{ui:gallery.upload}}

Em **{{ui:gallery.view.images}}** ficam as imagens criadas no novira (incluindo vídeos e áudios).
Em **{{ui:gallery.view.assets}}** ficam as imagens enviadas e o que é tratado como “material à parte da obra”, como os logotipos. Se não achar uma imagem, olhe no outro.

O tamanho das miniaturas pode ser mudado com o controle deslizante do botão de engrenagem.
As miniaturas de vídeos e áudios têm uma marca de reprodução; ao passar o cursor e mexê-lo para os lados, é possível conferir a cena daquela posição.

## Pastas

A pasta é um recipiente para separar e organizar as imagens. “{{ui:gallery.boards.uncategorized}}” já existe desde o começo e recebe as imagens que não estão em nenhuma pasta.

- **Criar**: clique no **＋** ({{ui:gallery.boards.add}}) no canto superior direito da área das pastas. O nome pode ser digitado na hora.
- **Trocar**: clique na pasta. Só as imagens dessa pasta aparecem embaixo.
- **Renomear**: dê um duplo clique no nome da pasta ou escolha “{{ui:common.rename}}” no menu do botão direito.
- **Procurar**: a lupa da área das pastas busca pelo nome da pasta.
- **Recolher**: clique no título “{{ui:gallery.boards.title}}”. Arrastar a borda de baixo da área das pastas muda a altura.

### Em que pasta entram as imagens novas

As imagens recém-criadas (e as enviadas) entram na pasta marcada com “**{{ui:gallery.boards.autoBadge}}**”.
No início, cada vez que você clica numa pasta, ela passa a ser a “{{ui:gallery.boards.autoBadge}}”. Para fixar uma pasta, desative “{{ui:gallery.settings.autoAssign}}” nas configurações da galeria e defina com “{{ui:gallery.boards.setAutoAdd}}” no menu do botão direito da pasta.

### Menu do botão direito da pasta

- **{{ui:gallery.boards.setAutoAdd}}**: faz dela o destino das imagens novas.
- **{{ui:common.rename}}**
- **{{ui:gallery.boards.archive}}**: esconde a pasta da lista. Ela não some: ativando “{{ui:gallery.settings.showArchived}}” nas configurações da galeria, ela volta a aparecer. Com “{{ui:gallery.boards.unarchive}}”, tudo volta ao que era.
- **{{ui:gallery.boards.delete}}**: abre uma janela de confirmação, em que se escolhe uma das duas opções.
  - “{{ui:gallery.boards.deleteBoardOnly}}”: as imagens ficam e passam para “{{ui:gallery.boards.uncategorized}}”.
  - “{{ui:gallery.boards.deleteBoardAndImages}}”: as imagens dentro da pasta também são excluídas.

> “{{ui:gallery.boards.uncategorized}}” não pode ser renomeada, arquivada nem excluída.

## Selecionar imagens

As miniaturas podem ser selecionadas assim:

| Operação | Resultado |
|---|---|
| Clique | Seleciona só essa imagem. A imagem vista no visualizador também passa a ser ela |
| Clique segurando `Ctrl` | Acrescenta à seleção ou tira da seleção (seleção múltipla) |
| Clique segurando `Shift` | Seleciona de uma vez da imagem escolhida antes até a que foi clicada |
| Clique segurando `Alt` | Compara com a imagem do visualizador (veja adiante) |
| Duplo clique | Muda o centro para o visualizador e mostra a imagem em tamanho grande |
| `Ctrl+A` | Seleciona todas as imagens que estão na lista |
| Teclas de seta | Move a seleção para a imagem anterior, seguinte, de cima ou de baixo. Com `Shift`, amplia o intervalo |
| `Esc` | Desfaz a seleção |

> As teclas de seta e outras funcionam quando o cursor está sobre a galeria ou quando o centro é o visualizador.

As imagens selecionadas recebem uma moldura azul. Ao passar o cursor sobre a miniatura, aparecem:

- O tamanho da imagem (com “{{ui:gallery.settings.alwaysShowSize}}” nas configurações da galeria, pode ficar sempre visível)
- Botão de estrela (marcar ou desmarcar como favorita)
- Botão de lixeira (excluir)

Uma imagem favorita recebe uma estrela amarela no canto superior esquerdo.

## Clicar com o botão direito numa miniatura

![O menu do botão direito numa miniatura. Aparecem abrir no visualizador, baixar, remixar, enviar para a tela e outros](shot:gallery-menu)

Ao clicar com o botão direito numa miniatura, aparece uma lista das operações possíveis para essa imagem. As que não podem ser usadas ficam cinza (por exemplo, numa imagem sem registro de configurações, “{{ui:gallery.menu.remix}}” não pode ser usado).

| Menu | Função |
|---|---|
| **{{ui:gallery.menu.openInViewer}}** | Ver em tamanho grande no visualizador central |
| **{{ui:common.download}}** | Salvar o arquivo da imagem |
| **{{ui:share.menu}}** | Escolher o formato e o tamanho e exportar uma cópia (também é possível remover as informações de geração) |
| **{{ui:share.check.title}}** | Verificar a marca d'água, o aviso de geração por IA e as credenciais de conteúdo contidos na imagem |
| **{{ui:common.copy}}** (`Ctrl+C`) | Copiar a imagem para a área de transferência |
| **{{ui:gallery.menu.compare}}** (`Alt+clique`) | Comparar com a imagem que está no visualizador |
| **{{ui:gallery.menu.loadWorkflow}}** (`W`) | Abrir o fluxo de trabalho que criou a imagem |
| **{{ui:gallery.menu.remix}}** (`R`) | Carregar no painel esquerdo as configurações, exceto a seed |
| **{{ui:gallery.menu.usePrompt}}** (`P`) | Carregar só o prompt |
| **{{ui:gallery.menu.useSeed}}** (`S`) | Carregar só a seed (a seed fica fixa) |
| **{{ui:gallery.menu.useAll}}** (`A`) | Carregar todas as configurações |
| **{{ui:gallery.menu.useSize}}** | Carregar só a largura e a altura |
| **{{ui:gallery.menu.sendToCanvas}}** | Colocar na tela. É possível escolher entre criar uma tela nova ou acrescentar à tela atual como camada ou máscara |
| **{{ui:gallery.menu.useAsReference}}** | Acrescentar a uma moldura de imagem de referência |
| **{{ui:gallery.menu.sendToVideo}}** | Usar como primeira imagem de um vídeo |
| **{{ui:gallery.menu.sendToWorkflow}}** | Acrescentar ao fluxo de trabalho aberto como entrada de imagem |
| **{{ui:gallery.menu.sendToText}}** | Usar como fundo do texto |
| **{{ui:gallery.menu.upscale}}** (`Shift+U`) | Enviar para a aba de ampliação |
| **{{ui:gallery.menu.segment}}** | Abrir a imagem na tela e pintar com o pincel a parte que se quer corrigir, para apagar, recortar ou redesenhar |
| **{{ui:gallery.derive.menu}}** | Criar, com as configurações desta imagem, outra com seed diferente ou ligeiramente alterada |
| **{{ui:gallery.tools.heading}}** | {{ui:facefix.menu}}, {{ui:cutout.menu}}, {{ui:caption.menu}}, {{ui:canvas.poseFromImage.menu}}. Ao escolher, executa de imediato com as configurações da vez anterior; a engrenagem à direita abre antes as configurações ([Corrigir e reutilizar imagens](04-improve.md)) |
| **{{ui:gallery.menu.trim}}** | Eliminar as margens transparentes e salvar como uma nova imagem com transparência |
| **{{ui:character.menu}}** | Registrar a imagem como um personagem |
| **{{ui:gallery.menu.changeBoard}}** | Mover para outra pasta |
| **{{ui:gallery.menu.star}}** / **{{ui:gallery.menu.unstar}}** | Marcar ou desmarcar como favorita |
| **{{ui:gallery.menu.delete}}** (`Del`) | Excluir a imagem |

Como usar “{{ui:gallery.menu.sendToCanvas}}” e as operações de refazer e corrigir imagens é explicado em [Desenhar sobre a tela](05-canvas.md), [Corrigir imagens](04-improve.md), [Ampliação e fluxos de trabalho](06-upscaling-workflows.md) e [Vídeo, música, voz, logotipo e texto](07-media.md).

> Só quando o app é aberto no navegador do computador aparece também “{{ui:gallery.menu.openInNewTab}}”. Na versão para desktop, ele não aparece.

## Operar várias imagens de uma vez

![O menu quando 2 imagens são selecionadas e se clica com o botão direito](shot:gallery-multi-menu)

Depois de selecionar 2 ou mais imagens, clique com o botão direito em uma delas para abrir o menu de operações em conjunto. No começo aparece o número de imagens selecionadas, como em “2 selecionadas”.

- **{{ui:gallery.menu.changeBoard}}**: move as imagens selecionadas, todas juntas, para outra pasta.
- **{{ui:gallery.menu.starAll}}** / **{{ui:gallery.menu.unstarAll}}**
- **{{ui:common.download}}**: salva as imagens selecionadas em sequência.
- **{{ui:share.menu}}**: exporta as imagens selecionadas, de uma vez, como cópias para compartilhar (vídeos e áudios ficam de fora).
- **{{ui:gallery.menu.batch}}**: aplica o mesmo processamento (remover o fundo, ampliar etc.) a todas as imagens selecionadas. Cada imagem entra na fila separadamente.
- O item vermelho, no fim: exclui de uma vez as imagens selecionadas.

> Se você clicar com o botão direito numa imagem que não está selecionada, aparece o menu só dessa imagem. Para usar em várias, primeiro selecione e depois clique com o botão direito sobre uma das selecionadas.

## Procurar, filtrar e ordenar

### Busca

O botão de lupa abre o campo de busca. Digite o nome do arquivo ou parte do prompt positivo, e as imagens da pasta são filtradas. Com `Esc`, a busca é fechada e o filtro é desfeito.

### Filtrar por data

![O menu de filtro por data. Botões como hoje e ontem e o calendário do mês](shot:gallery-date)

O botão de calendário abre o menu de filtro por data.

- **{{ui:gallery.date.quick.today}}**, **{{ui:gallery.date.quick.yesterday}}**, **{{ui:gallery.date.quick.last7}}**, **{{ui:gallery.date.quick.last30}}**: definem o período com um único botão.
- Calendário do mês: os dias em que há imagens recebem uma marca. Ao clicar numa data, só as imagens daquele dia aparecem. As setas no alto mudam o mês.
- **{{ui:gallery.date.custom}}**: digite a data inicial e a final e clique em **{{ui:gallery.date.apply}}** para ver só as imagens desse período. Também funciona com apenas uma das duas.
- **{{ui:gallery.date.quick.all}}**: encerra o filtro.

Durante o filtro, uma etiqueta com o período aparece acima da galeria. O × da etiqueta também desfaz o filtro.

### Configurações da galeria

O botão de engrenagem permite mudar a ordem e o visual.

- {{ui:gallery.settings.thumbnailSize}}
- {{ui:gallery.settings.autoSwitch}}: quando uma imagem fica pronta, ela é mostrada automaticamente.
- {{ui:gallery.settings.autoAssign}}
- {{ui:gallery.settings.alwaysShowSize}}
- {{ui:gallery.settings.showArchived}}
- {{ui:gallery.settings.starredFirst}}: coloca as imagens favoritas no topo (já vem ativado).
- {{ui:gallery.settings.sort}}: “{{ui:gallery.settings.sortNewest}}” ou “{{ui:gallery.settings.sortOldest}}”.
- {{ui:gallery.settings.groupByDate}}: separa com títulos por dia.

## Ver no visualizador

![O visualizador. A barra de ferramentas no alto, a imagem no centro, os botões de zoom embaixo à direita e as informações da imagem embaixo](shot:viewer)

No “{{ui:app.views.viewer}}”, no centro, a imagem escolhida aparece em tamanho grande.
As setas dos lados esquerdo e direito da tela levam à imagem anterior e à seguinte. Na última linha aparecem o tamanho da imagem, o modelo usado, a seed e o nome do arquivo. Vídeos e áudios podem ser reproduzidos ali mesmo.

### Zoom e movimento

- Roda do mouse: aproxima e afasta, com o cursor como centro.
- Arrastar: move a imagem quando, ampliada, ela passa da tela. Também é possível mover segurando `Space` ou o botão da roda.
- Duplo clique: alterna entre a vista inteira e o tamanho real (100%).
- Botões embaixo à direita: reduzir, ampliação (ao clicar, mostra uma lista das ampliações mais usadas), ampliar, `1:1` (tamanho real) e ajustar à tela.
- Teclas: `+` e `-` mudam um nível por vez, `Ctrl+0` ajusta à tela e `Ctrl+1` coloca em tamanho real.

### Barra de ferramentas

A barra de ferramentas acima da imagem reúne as operações para ela. Ao passar o cursor sobre um botão, aparecem o nome e o atalho.

| Grupo | Botões |
|---|---|
| Informações | **{{ui:gallery.viewer.toggleMetadata}}** (`I`) |
| Carregar configurações | **{{ui:gallery.menu.remix}}** (`R`), **{{ui:gallery.menu.usePrompt}}** (`P`), **{{ui:gallery.menu.useSeed}}** (`S`), **{{ui:gallery.menu.useAll}}** (`A`), **{{ui:gallery.menu.loadWorkflow}}** (`W`), **{{ui:gallery.derive.menu}}** |
| Enviar e corrigir | **{{ui:gallery.menu.sendToCanvas}}**, **{{ui:gallery.menu.useAsReference}}**, **{{ui:gallery.menu.upscale}}** (`Shift+U`), **{{ui:gallery.menu.segment}}**, **{{ui:cutout.menu}}**, **{{ui:facefix.menu}}**, **{{ui:gallery.manga.menu}}**, **{{ui:character.menu}}**, **{{ui:gallery.compare.toggle}}** (`C`) |
| Organizar | **{{ui:gallery.menu.star}}**, **{{ui:common.download}}**, **{{ui:share.menu}}**, **{{ui:gallery.menu.delete}}** (`Del`) |

A função é a mesma do item de mesmo nome no menu do botão direito da miniatura. Numa imagem sem configurações (como uma imagem enviada), os botões de carregar configurações ficam cinza.

## Informações da imagem e recarregar as configurações

![O painel de metadados. Lista de prompt, modelo, seed, número de passos etc.](shot:viewer-metadata)

Ao clicar no botão **{{ui:gallery.viewer.toggleMetadata}}** (`I`) da barra de ferramentas, abre-se sobre a imagem um painel de informações. Para fechá-lo, clique de novo, no × do canto superior direito ou fora do painel. O texto do painel pode ser selecionado arrastando e copiado com `Ctrl+C` (enquanto há texto selecionado, `Ctrl+C` copia o texto, não a imagem).
O painel tem 4 abas.

- **{{ui:gallery.meta.tabRecall}}**: as configurações usadas para criar a imagem, item por item (prompt, modelo, seed, número de passos, escala de CFG, agendador, tamanho, LoRA etc.). O botão de seta à direita de cada linha carrega **só aquele item** no painel esquerdo. Na linha do prompt, o botão à esquerda da seta copia o prompt tal como está. Nas imagens de famílias de modelo em que o agendador é predefinido (Anima, Flux etc.), em vez do agendador aparece a linha “{{ui:gallery.meta.sampling}}”, que mostra o amostrador e o agendador realmente usados. Essa linha não pode ser carregada, e nem mesmo “{{ui:gallery.menu.useAll}}” muda o agendador atual.
- **{{ui:gallery.meta.tabMetadata}}**: o conteúdo registrado, exatamente como está. Pode ser copiado pelo botão do canto superior direito.
- **{{ui:gallery.meta.tabDetails}}**: nome do arquivo, tamanho, data e hora de criação, pasta, se é favorita etc.
- **{{ui:gallery.meta.tabWorkflow}}**: se a imagem foi criada por um fluxo de trabalho, o conteúdo dele aparece aqui.

O modo de carregar as configurações depende do que se quer usar.

| Modo | O que é carregado |
|---|---|
| **{{ui:gallery.menu.useAll}}** | Tudo: prompt, modelo, seed, tamanho etc. A seed fica fixa. Numa imagem criada em outro software e trazida para cá, o modelo é procurado pelo nome (grafias como `v17` e `v170` são consideradas o mesmo modelo). Se não for encontrado, o modelo atual é mantido e uma notificação avisa |
| **{{ui:gallery.menu.remix}}** | Tudo menos a seed. A configuração atual da seed (aleatória ou fixa) permanece como está. Use quando quiser “criar outra imagem com as mesmas configurações” |
| **{{ui:gallery.menu.usePrompt}}** | Só o prompt (positivo e negativo) |
| **{{ui:gallery.menu.useSeed}}** | Só a seed. A seed fica fixa |
| **{{ui:gallery.menu.useSize}}** | Só a largura e a altura (apenas no menu do botão direito) |

Depois de carregar, basta olhar o painel esquerdo e clicar em **{{ui:params.invoke.invoke}}**.

> O arquivo de imagem (PNG) criado no novira guarda também as configurações. Por isso, mesmo uma imagem cujo arquivo foi movido para outro lugar e enviado de novo às vezes ainda permite carregar as configurações. Imagens criadas em outro software, ou editadas e salvas de novo, não têm configurações.

## Comparar 2 imagens

![O visualizador comparando 2 imagens com o controle deslizante. A linha vertical do meio é movida para os lados](shot:viewer-compare)

Para ver a diferença entre duas imagens, use a comparação.

1. Clique na primeira das imagens a comparar para selecioná-la e deixe o centro na aba “{{ui:app.views.viewer}}”.
2. Clique na miniatura da segunda imagem segurando `Alt` (também é possível por “{{ui:gallery.menu.compare}}”, no menu do botão direito).
3. A miniatura da segunda imagem recebe a etiqueta “{{ui:gallery.compare.badge}}”, e o visualizador muda para a tela de comparação.

> Também é possível começar selecionando 2 imagens com `Ctrl` e pressionando o botão de comparar da barra de ferramentas ou a tecla `C`. Com apenas uma imagem selecionada, aparece a orientação “{{ui:gallery.compare.hint}}”.

No alto da tela de comparação aparecem os botões abaixo.

- **{{ui:gallery.compare.slider}}**: sobrepõe as duas imagens, e arrastar a linha vertical do meio mostra como elas diferem à esquerda e à direita.
- **{{ui:gallery.compare.sideBySide}}**: coloca as duas imagens lado a lado.
- **{{ui:gallery.compare.hover}}**: só enquanto o cursor está sobre a imagem, ela muda para a segunda.
- **{{ui:gallery.compare.swap}}**: troca a primeira pela segunda.
- **{{ui:gallery.compare.exit}}**: encerra a comparação. `Esc` também encerra.

O zoom e o movimento acontecem juntos nas duas imagens. As diferenças em detalhes ficam mais fáceis de ver com a imagem ampliada.

## Favoritas e exclusão

### Marcar como favorita

As imagens de que você gosta podem ser marcadas como favoritas. Dá para marcar e desmarcar pelo botão de estrela da miniatura, pelo menu do botão direito ou pela barra de ferramentas do visualizador.
Com “{{ui:gallery.settings.starredFirst}}” ativado nas configurações da galeria, as imagens favoritas ficam reunidas no começo.

### Excluir

Estas são as formas de excluir uma imagem:

- O botão de lixeira da miniatura
- “{{ui:gallery.menu.delete}}”, no menu do botão direito
- O botão de lixeira da barra de ferramentas do visualizador
- Selecionar a imagem e pressionar a tecla `Delete` (`Backspace` faz o mesmo)

Aparece uma janela de confirmação; clicando em “{{ui:common.delete}}”, a imagem é excluída.

A imagem excluída não some na hora: ela é guardada por 14 dias (até 500 imagens), por isso a exclusão pode ser desfeita.

- Clique no sino no canto inferior direito da tela e depois em **{{ui:gallery.undoDelete.action}}** na notificação da exclusão. Para não atrapalhar quando você exclui uma imagem atrás da outra, as notificações de exclusão não aparecem na tela: vão apenas para o sino (o número dele aumenta). Cada notificação mostra as imagens excluídas em tamanho pequeno.
- Clique no botão “{{ui:gallery.undoDelete.label}}”, acima da galeria, ou pressione `Ctrl+Z` enquanto o ponteiro estiver sobre a galeria (ou enquanto o visualizador estiver aberto). É possível desfazer até as últimas 30 exclusões, da mais recente para a mais antiga.
- Para excluir de novo uma imagem restaurada, use o botão “{{ui:gallery.redoDelete.label}}” ou `Ctrl+Shift+Z` (`Ctrl+Y`).

> O histórico que pode ser desfeito é esquecido quando o app é fechado. Imagens excluídas há mais de 14 dias não podem ser restauradas. Quando se exclui uma pasta junto com as imagens, também é possível desfazer da mesma forma. Se a pasta não existir mais, as imagens voltam para “{{ui:gallery.boards.uncategorized}}”.

Marcando “{{ui:common.dontAskAgain}}” na janela de confirmação, as exclusões seguintes são feitas sem confirmação. Para voltar a pedir confirmação, ative “{{ui:settings.confirmOnDelete}}” em **{{ui:app.nav.settings}}**.

## Enviar e baixar

### Enviar

Imagens do seu computador podem ser colocadas na galeria.

- Clique no botão **{{ui:gallery.upload}}** acima da galeria e escolha os arquivos.
- Arraste e solte arquivos de imagem do Explorador de Arquivos na galeria. Se você soltar sobre uma pasta, eles entram nessa pasta.

As imagens enviadas entram em **{{ui:gallery.view.assets}}**, na pasta “{{ui:gallery.boards.autoBadge}}”, e a tela também muda para lá. Vários arquivos podem ser enviados de uma vez. Arquivos que não são imagens são ignorados.

### Baixar

Para salvar o arquivo de uma imagem, use o menu do botão direito ou **{{ui:common.download}}**, na barra de ferramentas do visualizador. Se várias imagens estiverem selecionadas, elas são salvas juntas.

Na versão para desktop, abre-se uma janela para escolher a pasta de destino, e o arquivo original é copiado como está (inclusive as informações de geração). Se já existir um arquivo com o mesmo nome, um número como “-2” é acrescentado, e nada é sobrescrito. Na notificação que aparece depois de salvar, **{{ui:share.openFolder}}** abre a pasta. Quando o app é aberto no navegador, o arquivo vai para os downloads do navegador.

### Exportar para compartilhar

![A janela de exportação para compartilhar. Formato (PNG, JPEG, WebP), qualidade, limite do lado maior e a chave que remove as informações de geração](shot:share-export)

A cópia de uma imagem para publicar nas redes sociais ou entregar a alguém é feita pelo menu do botão direito (que também funciona com várias imagens selecionadas) ou por **{{ui:share.menu}}**, na barra de ferramentas do visualizador. A imagem original não muda.

- **{{ui:share.format}}**: escolha entre PNG, JPEG e WebP. No JPEG, é possível definir a **{{ui:share.quality}}** (1 a 100), e as partes transparentes ficam brancas. O WebP é salvo sem perdas.
- **{{ui:share.size}}**: “{{ui:share.size.original}}”, 2048, 1536 ou 1024 px, ou “{{ui:share.size.custom}}”, em que se digita o comprimento. Imagens menores que isso não são ampliadas.
- **{{ui:share.removeInfo}}**: começa desativado. Quando ativado, a imagem é salva de novo a partir dos pixels, sem incluir prompt, configurações nem fluxo de trabalho, e por isso nenhuma outra informação embutida permanece. Quando desativado, só o PNG guarda as configurações. Ative se não quiser mostrar o prompt antes de entregar a imagem a alguém.
- **{{ui:share.watermark}}**: começa desativado. Quando ativado, a imagem exportada recebe uma marca d'água invisível (TrustMark), uma informação que indica que foi criada por IA (IPTC) e credenciais de conteúdo assinadas (C2PA). A marca d'água contém um sinal do novira e um número aleatório diferente para cada imagem, e o par formado pelo número e pela imagem original é registrado neste app.

Ao clicar em **{{ui:share.run}}**, na versão para desktop abre-se uma janela para escolher a pasta de destino. O nome do arquivo é o da galeria com a nova extensão; se já existir um arquivo com o mesmo nome, é acrescentado um número como “-2” ou “-3”, e nada é sobrescrito. Depois da exportação, **{{ui:share.openFolder}}** abre a pasta.

> Só é possível exportar imagens. Vídeos e áudios da seleção ficam de fora. Quando o app é aberto no navegador, o arquivo vai para os downloads do navegador. Uma imagem é salva como está; duas ou mais são reunidas em um único zip. O limite por exportação é de 1 GB no total, e, se for ultrapassado, aparece um aviso para reduzir o número de imagens.

Os arquivos usados para a marca d'água (cerca de 140 MB no total) são baixados automaticamente quando o app inicia. Até o preparo terminar, o progresso aparece abaixo da chave e **{{ui:share.run}}** não pode ser clicado. Se o download falhar, clique em **{{ui:share.watermarkRetry}}**.

> A marca d'água fica na parte quadrada central da imagem. Foi verificado que ela continua legível mesmo depois de salvar de novo em JPEG com qualidade 80 ou de reduzir a imagem à metade, mas ela pode desaparecer com recorte, recriação ou edições fortes. Como a marca d'água usa um método público, qualquer pessoa pode gravar a mesma. A assinatura foi feita neste PC, por isso outros apps a mostram como de um signatário não confiável. O processamento da marca d'água exige o Microsoft Visual C++ Redistributable; se ele não estiver presente, aparece um erro.

### Verificar a marca d'água

Abra por **{{ui:share.check.title}}**, no menu do botão direito da miniatura. Ao escolher um arquivo de imagem (PNG, JPEG, WebP) com **{{ui:share.check.pick}}**, o app verifica o seguinte e mostra uma lista. Quando aberto pelo menu do botão direito, a imagem é verificada de imediato. Quando o app está aberto no navegador, não é possível escolher um arquivo para verificar.

- **{{ui:share.check.watermark}}**: se há uma marca d'água do novira. Se houver, o número é exibido.
- **{{ui:share.check.original}}**: se o número consta no registro de exportações deste app, são exibidos a imagem original e a data e hora da exportação, e **{{ui:share.check.showOriginal}}** a mostra no visualizador.
- **{{ui:share.check.credentials}}**: se há credenciais de conteúdo, se foram alteradas depois da assinatura, se constam como geradas por IA e quem é o signatário.
- **{{ui:share.check.iptc}}**: se há a informação que indica que a imagem foi criada por IA.

> Não encontrar a marca d'água não prova que a imagem não foi criada por IA. O registro de exportações fica no banco de dados deste app, por isso não se sabe qual é a imagem original de uma imagem exportada pelo novira de outro PC. Enquanto o preparo dos arquivos da marca d'água não termina, só são verificados os itens que não dependem dela.

## Arrastar e soltar

As miniaturas podem ser arrastadas para outros lugares. Quando várias estão selecionadas, todas se movem juntas.

- **Sobre uma pasta**: move a imagem para essa pasta.
- **Sobre a moldura de {{ui:params.refImage.sectionLabel}}**: usa como imagem de referência (veja [Criar imagens](02-generate.md)).
- **Sobre o campo de imagem da tela ou da ampliação, ou sobre um cartão da tela inicial**: usa como material daquela tela.

Arquivos do Explorador podem ser soltos na galeria, nas pastas, na moldura da imagem de referência, nos cartões da tela inicial etc.

## Atalhos de teclado da galeria

| Operação | Tecla |
|---|---|
| Selecionar a imagem anterior, seguinte, de cima ou de baixo | Teclas de seta (`Shift` amplia o intervalo) |
| Selecionar todas | `Ctrl+A` |
| Desfazer a seleção | `Esc` |
| Excluir a imagem selecionada | `Delete` |
| Copiar a imagem do visualizador ou a selecionada na galeria (na tela de desenho, também funciona depois de clicar numa imagem da galeria) | `Ctrl+C` |
| Abrir e fechar o painel de informações | `I` |
| Remixar, prompt, seed, tudo | `R`, `P`, `S`, `A` |
| Carregar o fluxo de trabalho | `W` |
| Enviar para a ampliação | `Shift+U` |
| Começar e encerrar a comparação | `C` |
| Vista inteira, tamanho real | `Ctrl+0`, `Ctrl+1` |
| Ampliar, reduzir | `+`, `-` |

Eles funcionam quando o cursor está sobre a galeria ou quando o centro é o visualizador. A lista também pode ser vista em “{{ui:app.nav.hotkeys}}”, no menu **{{ui:app.nav.settings}}**.
