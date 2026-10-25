# A galeria e o visualizador

As imagens que você cria aparecem na **galeria**, no lado direito da tela. Uma imagem escolhida na galeria pode ser vista em tamanho grande no **{{ui:app.views.viewer}}**, no centro.
Este capítulo explica como organizar as imagens, como encontrá-las, como vê-las no visualizador, como reutilizar suas configurações e como excluí-las e baixá-las.

## Conhecendo a galeria

O painel da direita é formado por duas partes, uma acima da outra.

- Em cima: as **{{ui:gallery.boards.title}}**, onde as imagens ficam guardadas.
- Embaixo: as miniaturas das imagens da pasta selecionada.

A linha acima das miniaturas tem o seguinte.

- Um seletor entre “{{ui:gallery.view.images}}” e “{{ui:gallery.view.assets}}”, e o número de imagens.
- O botão de lupa: pesquisa ({{ui:gallery.search.label}})
- O botão de calendário: {{ui:gallery.date.button}}
- O botão de engrenagem: {{ui:gallery.settings.title}}
- O botão de seta para cima: {{ui:gallery.upload}}

**{{ui:gallery.view.images}}** reúne as imagens criadas no novira (incluindo vídeo e áudio).
**{{ui:gallery.view.assets}}** reúne as imagens que você enviou e itens como logotipos, tratados como “material separado das suas obras”. Se uma imagem parecer estar faltando, olhe na outra.

Você pode mudar o tamanho das miniaturas com o controle deslizante do botão de engrenagem.
As miniaturas de vídeo e áudio têm uma marca de reprodução e, se você passar o cursor sobre uma e movê-lo para os lados, poderá conferir a cena naquela posição.

## Pastas

Uma pasta é um recipiente para dividir e organizar as imagens. “{{ui:gallery.boards.uncategorized}}” é uma pasta que já existe desde o início e guarda as imagens que não estão em nenhuma pasta.

- **Criar**: pressione o **＋** ({{ui:gallery.boards.add}}) no canto superior direito da área de pastas. Você pode digitar o nome ali mesmo.
- **Trocar**: clique em uma pasta. Somente as imagens dessa pasta aparecem abaixo.
- **Renomear**: clique duas vezes no nome de uma pasta ou escolha “{{ui:common.rename}}” no menu de clique com o botão direito.
- **Pesquisar**: a lupa na área de pastas pesquisa nomes de pastas.
- **Recolher**: clique no título “{{ui:gallery.boards.title}}”. Arraste a borda inferior da área de pastas para mudar sua altura.

### Em qual pasta vai uma imagem nova

Uma imagem recém-criada (e também uma enviada) vai para a pasta marcada com “**{{ui:gallery.boards.autoBadge}}**”.
No início, toda vez que você clica em uma pasta, ela passa a ser “{{ui:gallery.boards.autoBadge}}”. Se quiser fixar uma pasta, desative “{{ui:gallery.settings.autoAssign}}” nas configurações da galeria e escolha-a com “{{ui:gallery.boards.setAutoAdd}}” no menu de clique com o botão direito da pasta.

### O menu de clique com o botão direito de uma pasta

- **{{ui:gallery.boards.setAutoAdd}}**: define a pasta como o lugar onde as imagens novas são salvas.
- **{{ui:common.rename}}**
- **{{ui:gallery.boards.archive}}**: oculta a pasta da lista. Ela não é excluída; se você ativar “{{ui:gallery.settings.showArchived}}” nas configurações da galeria, poderá vê-la de novo. “{{ui:gallery.boards.unarchive}}” a traz de volta.
- **{{ui:gallery.boards.delete}}**: aparece uma janela de confirmação, e você escolhe uma das opções a seguir.
  - “{{ui:gallery.boards.deleteBoardOnly}}”: as imagens permanecem e passam para “{{ui:gallery.boards.uncategorized}}”.
  - “{{ui:gallery.boards.deleteBoardAndImages}}”: as imagens da pasta também são excluídas.

> “{{ui:gallery.boards.uncategorized}}” não pode ser renomeada, arquivada nem excluída.

## Escolher imagens

Você pode escolher miniaturas da seguinte forma.

| Ação | Resultado |
|---|---|
| Clique | Escolhe somente essa imagem. A imagem mostrada no visualizador também muda para ela |
| Clique segurando `Ctrl` | Adiciona a imagem às escolhidas ou a remove da escolha (seleção múltipla) |
| Clique segurando `Shift` | Escolhe tudo, da imagem escolhida anteriormente até a que você clicou |
| Clique segurando `Alt` | Compara a imagem com a que está no visualizador (descrito adiante) |
| Clique duplo | Muda o centro para o visualizador e mostra essa imagem em tamanho grande |
| `Ctrl+A` | Escolhe todas as imagens exibidas no momento |
| Teclas de seta | Movem a escolha para a imagem anterior, seguinte, de cima ou de baixo. Segure `Shift` para ampliar o intervalo |
| `Esc` | Limpa a escolha |

> As teclas de seta e as semelhantes funcionam quando o cursor está sobre a galeria ou quando o centro é o visualizador.

As imagens escolhidas ganham uma moldura azul. Quando você passa o cursor sobre uma miniatura, aparece o seguinte.

- O tamanho da imagem (você também pode mostrá-lo sempre com “{{ui:gallery.settings.alwaysShowSize}}” nas configurações da galeria)
- O botão de estrela (adiciona ou remove uma estrela)
- O botão de lixeira (excluir)

Uma imagem com estrela recebe uma marca de estrela amarela no canto superior esquerdo.

## Clicar com o botão direito em uma miniatura

![O menu de clique com o botão direito de uma miniatura, com itens como Abrir no visualizador, Baixar, Remix e Enviar para a tela](shot:gallery-menu)

Ao clicar com o botão direito em uma miniatura, aparece uma lista das operações disponíveis para essa imagem. As operações que você não pode usar ficam em cinza (por exemplo, “{{ui:gallery.menu.remix}}” não pode ser usado em uma imagem sem configurações registradas).

| Item do menu | O que faz |
|---|---|
| **{{ui:gallery.menu.openInViewer}}** | Mostra a imagem em tamanho grande no visualizador, no centro |
| **{{ui:common.download}}** | Salva o arquivo da imagem |
| **{{ui:share.menu}}** | Exporta cópias em um formato e tamanho que você escolhe (as informações de geração podem ser removidas) |
| **{{ui:common.copy}}** (`Ctrl+C`) | Copia a imagem para a área de transferência |
| **{{ui:gallery.menu.compare}}** (`Alt+clique`) | Compara a imagem com a que está no visualizador |
| **{{ui:gallery.menu.loadWorkflow}}** (`W`) | Abre o fluxo de trabalho que criou a imagem |
| **{{ui:gallery.menu.remix}}** (`R`) | Carrega no painel esquerdo todas as configurações, exceto a seed |
| **{{ui:gallery.menu.usePrompt}}** (`P`) | Carrega somente o prompt |
| **{{ui:gallery.menu.useSeed}}** (`S`) | Carrega somente a seed (a seed passa a ficar fixa) |
| **{{ui:gallery.menu.useAll}}** (`A`) | Carrega todas as configurações |
| **{{ui:gallery.menu.useSize}}** | Carrega somente a largura e a altura |
| **{{ui:gallery.menu.sendToCanvas}}** | Coloca a imagem na tela. Você pode escolher entre criar uma nova tela e adicioná-la à tela atual como camada ou máscara |
| **{{ui:gallery.menu.useAsReference}}** | Adiciona a imagem a um quadro de imagem de referência |
| **{{ui:gallery.menu.sendToVideo}}** | Define a imagem como a primeira imagem de um vídeo |
| **{{ui:gallery.menu.sendToWorkflow}}** | Adiciona a imagem ao fluxo de trabalho aberto como entrada de imagem |
| **{{ui:gallery.menu.sendToText}}** | Define a imagem como o fundo de uma imagem de texto |
| **{{ui:gallery.menu.upscale}}** (`Shift+U`) | Envia a imagem para a aba Ampliação |
| **{{ui:gallery.menu.segment}}** | Seleciona uma parte da imagem para que você possa recortá-la ou repintá-la |
| **{{ui:gallery.derive.menu}}** | Cria outras imagens com as configurações desta, usando outra seed ou pequenas alterações |
| **{{ui:cutout.menu}}** | Remove o fundo |
| **{{ui:facefix.menu}}** | Encontra rostos e os redesenha |
| **{{ui:gallery.menu.trim}}** | Apara as margens transparentes e salva o resultado como uma nova imagem transparente |
| **{{ui:character.menu}}** | Registra a imagem como um personagem |
| **{{ui:gallery.menu.changeBoard}}** | Move a imagem para outra pasta |
| **{{ui:gallery.menu.star}}** / **{{ui:gallery.menu.unstar}}** | Adiciona ou remove uma estrela |
| **{{ui:gallery.menu.delete}}** (`Del`) | Exclui a imagem |

Como usar “{{ui:gallery.menu.sendToCanvas}}” e as operações para refazer ou melhorar uma imagem é explicado em [Desenhar mais na tela](05-canvas.md), [Melhorar imagens](04-improve.md), [Ampliação e fluxos de trabalho](06-upscaling-workflows.md) e [Vídeo, música, voz, logotipos e texto](07-media.md).

> Somente quando você usa o app no navegador de um computador aparece também “{{ui:gallery.menu.openInNewTab}}”. Ele não aparece na versão para desktop.

## Trabalhar com várias imagens ao mesmo tempo

![O menu quando duas imagens estão escolhidas e se clica com o botão direito](shot:gallery-multi-menu)

Se você escolher duas ou mais imagens e clicar com o botão direito em uma das escolhidas, aparece um menu para trabalhar com todas juntas. No topo dele é mostrado o número de imagens escolhidas, como “2 imagens selecionadas”.

- **{{ui:gallery.menu.changeBoard}}**: move as imagens escolhidas para outra pasta de uma só vez.
- **{{ui:gallery.menu.starAll}}** / **{{ui:gallery.menu.unstarAll}}**
- **{{ui:common.download}}**: salva as imagens escolhidas uma após a outra.
- **{{ui:share.menu}}**: exporta cópias das imagens escolhidas para compartilhar (vídeos e sons ficam de fora).
- **{{ui:gallery.menu.batch}}**: aplica o mesmo processamento (remoção de fundo, ampliação e assim por diante) a todas as imagens escolhidas. Cada imagem entra na fila separadamente.
- O item vermelho bem no final: exclui as imagens escolhidas de uma só vez.

> Se você clicar com o botão direito em uma imagem que não está escolhida, aparece o menu dessa única imagem. Para agir sobre várias imagens, escolha-as primeiro e depois clique com o botão direito em uma das escolhidas.

## Encontrar, filtrar e ordenar

### Pesquisa

Pressione o botão de lupa para abrir o campo de pesquisa. Digite um nome de arquivo ou parte do prompt positivo e as imagens dessa pasta serão filtradas. Pressione `Esc` para fechar a pesquisa e limpar o filtro.

### Filtrar por data

![O menu para filtrar por data, com botões como Hoje e Ontem e um calendário mensal](shot:gallery-date)

Pressione o botão de calendário para abrir o menu de filtro por data.

- **{{ui:gallery.date.quick.today}}**, **{{ui:gallery.date.quick.yesterday}}**, **{{ui:gallery.date.quick.last7}}**, **{{ui:gallery.date.quick.last30}}**: definem o período com um único botão.
- O calendário mensal: os dias que têm imagens são marcados. Clique em uma data e somente as imagens desse dia aparecem. Use as setas no topo para passar de um mês a outro.
- **{{ui:gallery.date.custom}}**: digite uma data inicial e uma data final e pressione **{{ui:gallery.date.apply}}** para exibir somente as imagens desse período. Você também pode usar apenas uma das duas.
- **{{ui:gallery.date.quick.all}}**: para de filtrar.

Enquanto um filtro está ativo, aparece uma etiqueta com o período acima da galeria. Você também pode limpá-lo com o × da etiqueta.

### Configurações da galeria

O botão de engrenagem permite mudar como as imagens são organizadas e a aparência delas.

- {{ui:gallery.settings.thumbnailSize}}
- {{ui:gallery.settings.autoSwitch}}: quando uma imagem fica pronta, ela é mostrada automaticamente.
- {{ui:gallery.settings.autoAssign}}
- {{ui:gallery.settings.alwaysShowSize}}
- {{ui:gallery.settings.showArchived}}
- {{ui:gallery.settings.starredFirst}}: coloca as imagens com estrela bem no início (isso vem ativado desde o começo).
- {{ui:gallery.settings.sort}}: “{{ui:gallery.settings.sortNewest}}” ou “{{ui:gallery.settings.sortOldest}}”.
- {{ui:gallery.settings.groupByDate}}: separa as imagens com um título para cada dia.

## Ver no visualizador

![O visualizador, com a barra de ferramentas no topo, a imagem no centro, os botões de zoom no canto inferior direito e as informações da imagem na parte de baixo](shot:viewer)

O “{{ui:app.views.viewer}}” no centro mostra a imagem escolhida em tamanho grande.
Você pode ir para a imagem anterior e a seguinte com as setas à esquerda e à direita da tela. A linha de baixo mostra o tamanho da imagem, o modelo usado, a seed e o nome do arquivo. Vídeo e áudio podem ser reproduzidos ali mesmo.

### Zoom e movimento

- Roda do mouse: aumenta e diminui o zoom em torno da posição do cursor.
- Arrastar: move a imagem quando ela está ampliada e passa da borda. Você também pode movê-la segurando `Space` ou pressionando o botão da roda.
- Clique duplo: alterna entre mostrar a imagem inteira e o tamanho real (100%).
- Botões no canto inferior direito: reduzir o zoom, o nível de zoom (pressione-o para ver uma lista de níveis comuns), aumentar o zoom, `1:1` (tamanho real) e ajustar à tela.
- Teclas: `+` e `-` mudam o zoom um passo de cada vez, `Ctrl+0` ajusta à tela e `Ctrl+1` mostra o tamanho real.

### Barra de ferramentas

A barra de ferramentas acima da imagem reúne as operações dessa imagem. Passe o cursor sobre um botão para ver seu nome e atalho.

| Grupo | Botões |
|---|---|
| Informações | **{{ui:gallery.viewer.toggleMetadata}}** (`I`) |
| Carregar configurações | **{{ui:gallery.menu.remix}}** (`R`), **{{ui:gallery.menu.usePrompt}}** (`P`), **{{ui:gallery.menu.useSeed}}** (`S`), **{{ui:gallery.menu.useAll}}** (`A`), **{{ui:gallery.menu.loadWorkflow}}** (`W`), **{{ui:gallery.derive.menu}}** |
| Enviar e melhorar | **{{ui:gallery.menu.sendToCanvas}}**, **{{ui:gallery.menu.useAsReference}}**, **{{ui:gallery.menu.upscale}}** (`Shift+U`), **{{ui:gallery.menu.segment}}**, **{{ui:cutout.menu}}**, **{{ui:facefix.menu}}**, **{{ui:character.menu}}**, **{{ui:gallery.compare.toggle}}** (`C`) |
| Organizar | **{{ui:gallery.menu.star}}**, **{{ui:common.download}}**, **{{ui:share.menu}}**, **{{ui:gallery.menu.delete}}** (`Del`) |

Eles fazem o mesmo que os itens de mesmo nome no menu de clique com o botão direito da miniatura. Para uma imagem sem configurações (como uma imagem enviada), os botões de carregar configurações ficam em cinza.

## Informações da imagem e reutilização de configurações

![O painel de metadados, com uma lista de prompt, modelo, seed, passos e assim por diante](shot:viewer-metadata)

Pressione o botão **{{ui:gallery.viewer.toggleMetadata}}** (`I`) na barra de ferramentas e um painel de informações se abre sobre a imagem. Pressione-o de novo, ou o × no canto superior direito, para fechá-lo.
O painel tem quatro abas.

- **{{ui:gallery.meta.tabRecall}}**: as configurações usadas quando a imagem foi criada são listadas item por item (prompt, modelo, seed, passos, escala CFG, agendador, tamanho, LoRA e assim por diante). O botão de seta à direita de cada linha carrega **somente esse item** no painel esquerdo.
- **{{ui:gallery.meta.tabMetadata}}**: mostra o conteúdo registrado tal como está. Você pode copiá-lo com o botão no canto superior direito.
- **{{ui:gallery.meta.tabDetails}}**: o nome do arquivo, o tamanho, a data e a hora em que foi criada, a pasta, se tem estrela e assim por diante.
- **{{ui:gallery.meta.tabWorkflow}}**: para uma imagem criada com um fluxo de trabalho, mostra o conteúdo dele.

Você escolhe como carregar as configurações conforme a quantidade que deseja.

| Método | O que carrega |
|---|---|
| **{{ui:gallery.menu.useAll}}** | Todas as configurações, como prompt, modelo, seed e tamanho. A seed passa a ficar fixa |
| **{{ui:gallery.menu.remix}}** | Tudo, exceto a seed. A configuração atual da seed (aleatória ou fixa) permanece como está. Use quando quiser “criar uma imagem diferente com as mesmas configurações” |
| **{{ui:gallery.menu.usePrompt}}** | Somente o prompt (positivo e negativo) |
| **{{ui:gallery.menu.useSeed}}** | Somente a seed. A seed passa a ficar fixa |
| **{{ui:gallery.menu.useSize}}** | Somente a largura e a altura (apenas no menu de clique com o botão direito) |

Depois de carregar, basta olhar o painel esquerdo e pressionar **{{ui:params.invoke.invoke}}**.

> O arquivo de imagem (PNG) de uma imagem criada no novira tem as configurações registradas junto com ele. Por isso, às vezes é possível carregar as configurações até de uma imagem que você moveu para outro lugar e enviou de novo. Imagens criadas em outros programas e imagens que foram editadas e salvas de novo não contêm configurações.

## Comparar duas imagens

![O visualizador comparando duas imagens com o controle deslizante. Você move a linha vertical do meio para a esquerda e para a direita](shot:viewer-compare)

Quando quiser ver a diferença entre duas imagens, use a comparação.

1. Clique na primeira imagem que deseja comparar para escolhê-la e deixe o centro na aba “{{ui:app.views.viewer}}”.
2. Clique na miniatura da segunda imagem segurando `Alt` (você também pode fazer isso com “{{ui:gallery.menu.compare}}” no menu de clique com o botão direito).
3. Uma etiqueta “{{ui:gallery.compare.badge}}” aparece na segunda miniatura e o visualizador muda para a tela de comparação.

> Você também pode começar escolhendo duas imagens segurando `Ctrl` e depois pressionando o botão de comparar na barra de ferramentas ou a tecla `C`. Se você escolheu apenas uma, aparece a orientação “{{ui:gallery.compare.hint}}”.

Os botões a seguir aparecem no topo da tela de comparação.

- **{{ui:gallery.compare.slider}}**: as duas imagens ficam sobrepostas e, se você arrastar a linha vertical do meio, vê como elas diferem à esquerda e à direita.
- **{{ui:gallery.compare.sideBySide}}**: coloca as duas imagens lado a lado.
- **{{ui:gallery.compare.hover}}**: muda para a segunda imagem somente enquanto o cursor está sobre a imagem.
- **{{ui:gallery.compare.swap}}**: troca a primeira e a segunda imagem.
- **{{ui:gallery.compare.exit}}**: para de comparar. Você também pode parar com `Esc`.

O zoom e o movimento funcionam em conjunto nas duas imagens. As diferenças em detalhes finos ficam mais fáceis de ver com o zoom aumentado.

## Estrelas e exclusão

### Adicionar uma estrela

Você pode colocar uma estrela nas imagens de que gosta. Dá para adicioná-la ou removê-la pelo botão de estrela da miniatura, pelo menu de clique com o botão direito ou pela barra de ferramentas do visualizador.
Quando “{{ui:gallery.settings.starredFirst}}” está ativado nas configurações da galeria, as imagens com estrela ficam reunidas no início.

### Excluir

Você pode excluir uma imagem das seguintes formas.

- O botão de lixeira na miniatura
- “{{ui:gallery.menu.delete}}” no menu de clique com o botão direito
- O botão de lixeira na barra de ferramentas do visualizador
- Escolha a imagem e pressione a tecla `Delete` (`Backspace` faz o mesmo)

Aparece uma janela de confirmação e, ao pressionar “{{ui:common.delete}}”, a imagem é excluída.

> Uma imagem excluída não pode ser restaurada. Não existe algo como uma lixeira de reciclagem.

Se você marcar “{{ui:common.dontAskAgain}}” na janela de confirmação, as imagens passam a ser excluídas sem confirmação. Para a confirmação voltar, ative “{{ui:settings.confirmOnDelete}}” em **{{ui:app.nav.settings}}**.

## Enviar e baixar

### Enviar

Você pode trazer imagens do seu computador para a galeria.

- Pressione o botão **{{ui:gallery.upload}}** acima da galeria e escolha os arquivos.
- Arraste e solte arquivos de imagem do Explorador de Arquivos na galeria. Se você soltá-los em uma pasta, eles vão para essa pasta.

As imagens enviadas vão para **{{ui:gallery.view.assets}}** da pasta “{{ui:gallery.boards.autoBadge}}”, e a tela também muda para lá. Você pode enviar vários arquivos de uma vez. Arquivos que não são imagens são ignorados.

### Baixar

Para salvar o arquivo de uma imagem, use o menu de clique com o botão direito ou **{{ui:common.download}}** na barra de ferramentas do visualizador. Se você escolheu várias imagens, elas são salvas juntas.

### Exportar para compartilhar

![A janela Exportar para compartilhar: formato (PNG, JPEG, WebP), qualidade, lado mais longo e a chave que remove as informações de geração](shot:share-export)

Para fazer cópias das imagens para redes sociais ou para outras pessoas, use **{{ui:share.menu}}** no menu de clique com o botão direito (também funciona com várias imagens escolhidas) ou na barra de ferramentas do visualizador. Os originais não mudam.

- **{{ui:share.format}}**: PNG, JPEG ou WebP. Para JPEG você pode definir a **{{ui:share.quality}}** (1 a 100), e as partes transparentes ficam brancas. O WebP é salvo sem perdas.
- **{{ui:share.size}}**: “{{ui:share.size.original}}”, 2048, 1536 ou 1024 px, ou “{{ui:share.size.custom}}” para digitar um comprimento. Imagens menores que isso não são ampliadas.
- **{{ui:share.removeInfo}}**: desativado no início. Quando ativado, o prompt, as configurações e o fluxo de trabalho ficam de fora, e a imagem é salva de novo a partir dos pixels, de modo que nenhum outro dado embutido permanece. Quando desativado, somente o PNG mantém as configurações. Ative antes de entregar uma imagem a outras pessoas se não quiser mostrar o prompt.

Pressione **{{ui:share.run}}**; no app para desktop abre-se uma janela para escolher a pasta. Cada arquivo recebe o nome de arquivo da galeria com a nova extensão; se já existir um arquivo com esse nome, é adicionado um número como “-2” ou “-3”, e nada é sobrescrito. Depois, **{{ui:share.openFolder}}** abre essa pasta.

> Somente imagens são exportadas; vídeos e sons entre os itens escolhidos ficam de fora. No navegador, os arquivos vão para as transferências do navegador.

## Arrastar e soltar

Você pode arrastar miniaturas para outros lugares e usá-las ali. Quando várias estão escolhidas, as imagens escolhidas se movem juntas.

- **Sobre uma pasta**: move a imagem para essa pasta.
- **Sobre um quadro de {{ui:params.refImage.sectionLabel}}**: torna a imagem uma imagem de referência (veja [Criar imagens](02-generate.md)).
- **Sobre o campo de imagem da tela ou da Ampliação, ou sobre um cartão da tela inicial**: usa a imagem como material para essa tela.

Arquivos do Explorador de Arquivos podem ser soltos na galeria, em uma pasta, em um quadro de imagem de referência, em um cartão da tela inicial e assim por diante.

## Atalhos de teclado da galeria

| Ação | Tecla |
|---|---|
| Escolher a imagem anterior, seguinte, de cima ou de baixo | Teclas de seta (`Shift` amplia o intervalo) |
| Escolher tudo | `Ctrl+A` |
| Limpar a escolha | `Esc` |
| Excluir as imagens escolhidas | `Delete` |
| Copiar a imagem do visualizador | `Ctrl+C` |
| Abrir e fechar o painel de informações | `I` |
| Remix, prompt, seed, tudo | `R`, `P`, `S`, `A` |
| Carregar o fluxo de trabalho | `W` |
| Enviar para a Ampliação | `Shift+U` |
| Iniciar e parar a comparação | `C` |
| Ajustar à tela, tamanho real | `Ctrl+0`, `Ctrl+1` |
| Aumentar o zoom, reduzir o zoom | `+`, `-` |

Esses atalhos funcionam quando o cursor está sobre a galeria ou quando o centro é o visualizador. Você também pode ver a lista em “{{ui:app.nav.hotkeys}}” no menu **{{ui:app.nav.settings}}**.
