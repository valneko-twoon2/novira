# Ampliação e fluxos de trabalho

Este capítulo explica a aba **{{ui:app.tabs.upscaling}}**, que aumenta as imagens, e a aba **{{ui:app.tabs.workflows}}**, em que se monta o processamento conectando as etapas por conta própria.

## Ampliação

![A aba Ampliação. No centro ficam o local para soltar a imagem e os cartões das etapas](shot:upscaling)

A aba **{{ui:app.tabs.upscaling}}** aumenta a imagem e acrescenta detalhes. Em vez de apenas esticá-la, primeiro a amplia com um modelo de ampliação e, depois, refaz os detalhes finos usando o prompt e o ControlNet de mosaico.

### O que é necessário

São necessários os 2 modelos a seguir. Se não estiverem instalados, o painel esquerdo mostra um aviso. O botão “{{ui:params.upscale.openModels}}” leva à tela de modelos. Para saber como instalar, veja o capítulo [Modelos](08-models.md).

- {{ui:params.upscale.model}} (como o Real-ESRGAN, um modelo para aumentar imagens)
- O {{ui:params.upscale.tileControlnet}} compatível com o modelo principal selecionado

Se nenhum modelo de ampliação estiver instalado, o painel esquerdo lista candidatos; escolha um dos que têm a marca **{{ui:media.choice.recommended}}** e instale-o com **{{ui:models.install.install}}**.

### Passo a passo

1. Arraste a imagem que deseja aumentar da galeria até o cartão central ou até a moldura de **{{ui:params.upscale.title}}**, no painel esquerdo. Também é possível clicar com o botão direito em uma imagem da galeria (no visualizador, usar a barra de ferramentas) e escolher **{{ui:gallery.menu.upscale}}**, ou abrir a imagem no visualizador e pressionar `Shift+U`: a aba muda e a imagem entra.
2. Escolha o **{{ui:params.upscale.model}}**.
3. Escolha a **{{ui:params.upscale.scale}}** entre 2x, 4x e 8x. O tamanho final aparece como em “Saída: 2048×2048”.
4. Ajuste o resultado com os 2 controles deslizantes a seguir.
   - **{{ui:params.upscale.creativity}}**: quanto maior, mais a imagem se afasta da original e novos detalhes são acrescentados.
   - **{{ui:params.upscale.structure}}**: quanto maior, mais a forma e a disposição da imagem original são mantidas.
5. Escolha o **{{ui:params.upscale.tileControlnet}}**. Se necessário, escolha também o **{{ui:params.upscale.postProcessing}}** (ele refina a imagem desenhada, que depois é ajustada ao tamanho de saída).
6. Pressione **{{ui:params.invoke.invoke}}**.

A imagem criada vai para a galeria.

- O tamanho de saída vai até 8192 pixels em cada lado. Acima disso, aparece um aviso; reduza a escala.
- O prompt influencia os detalhes que serão acrescentados. Informar o prompt da imagem original ajuda a manter a mesma direção.
- Se a imagem ampliada ficar muito diferente da original, diminua **{{ui:params.upscale.creativity}}** e aumente **{{ui:params.upscale.structure}}**.

> Para ampliar várias imagens de uma vez, selecione várias na galeria e use **{{ui:gallery.menu.batch}}** no menu do botão direito ([Corrigir e reaproveitar imagens](04-improve.md)). Nesse caso, a ampliação usa apenas o modelo de ampliação.

## Fluxos de trabalho

![A aba Fluxos. À direita, a tela onde se desenham as conexões; à esquerda, o formulário](shot:workflows)

Um fluxo de trabalho é um recurso para montar uma sequência de etapas, como “carregar o modelo → inserir o prompt → criar a imagem → salvar”, conectando peças (nós). Permite criar procedimentos detalhados, fora do alcance da aba Gerar comum, e fluxos que combinam vários processamentos.

No início, recomenda-se abrir e usar um template na aba **{{ui:workflows.panel.templates}}** (na seção abaixo).

A tela é formada por 2 partes.

- Centro: o **{{ui:app.views.editor}}**. Nele se dispõem os nós e se ligam com linhas.
- Painel esquerdo: 5 abas, **{{ui:workflows.panel.workflow}}** (formulário), **{{ui:workflows.panel.templates}}**, **{{ui:workflows.panel.packs}}**, **{{ui:workflows.panel.details}}** e **{{ui:workflows.panel.data}}**.

Para executar o fluxo, pressione o botão **{{ui:params.invoke.invoke}}** no alto do painel esquerdo. Se houver problemas, como a falta de um nó de saída (por exemplo, “{{ui:workflows.nodes.save_image.title}}”) ou de um modelo selecionado, o motivo pelo qual não é possível gerar é exibido.

### Adicionar nós e conectar

1. Pressione **{{ui:workflows.toolbar.addNode}}** (＋), no alto à esquerda do editor. Também abre com `Shift+A` ou `Space` no teclado.
2. Escolha um nó na lista. Digitando palavras no campo de busca acima, é possível filtrar. Com as categorias à esquerda, filtra-se por tipo de nó padrão ou por extensão instalada.
3. Arraste do círculo do lado direito de um nó (saída) até o círculo do lado esquerdo de outro nó (entrada) para conectá-los. Só é possível conectar itens do mesmo tipo.

![A lista exibida ao adicionar um nó](shot:workflows-add-node)

Há recursos úteis para conectar.

- Se a linha for solta em um local vazio, a lista mostra apenas os nós que podem ser ligados ali. Ao escolher um, o nó é acrescentado e já fica conectado.
- Se a linha for solta sobre um nó, ela se conecta automaticamente à entrada adequada.
- O nó selecionado é excluído com `Delete`. Com `Ctrl+C` e `Ctrl+V`, é possível duplicá-lo. `Ctrl+Z` desfaz e `Ctrl+Shift+Z` refaz.
- Ao arrastar uma imagem da galeria para o editor, é acrescentado um nó de “{{ui:workflows.nodes.image.title}}” que a contém.
- A seta à esquerda do nome do nó o recolhe. Clicando duas vezes no nome, é possível renomeá-lo.

Os valores de configuração do nó são digitados diretamente nele. O valor de uma entrada conectada vem do nó ao qual ela está ligada.

### Disposição dos botões

São os botões no alto à esquerda do editor.

| Botão | O que faz |
|---|---|
| **{{ui:workflows.toolbar.addNode}}** | Acrescenta um nó. |
| **{{ui:workflows.toolbar.library}}** | Abre a lista de fluxos de trabalho. |
| **{{ui:workflows.toolbar.new}}** | Inicia um fluxo de trabalho vazio. |
| **{{ui:workflows.toolbar.save}}** (`Ctrl+S`) | Salva. Na primeira vez, pede um nome. |
| **{{ui:workflows.toolbar.optimize}}** | Une os nós duplicados, remove os nós que não levam a uma saída e as conexões desnecessárias e reorganiza da esquerda para a direita. Também é possível desfazer. |
| **{{ui:workflows.toolbar.more}}** | **{{ui:common.saveAs}}**, **{{ui:workflows.toolbar.download}}**, **{{ui:workflows.toolbar.loadFromFile}}**. |

Na engrenagem **{{ui:workflows.settings.title}}**, no alto à direita, é possível alternar opções como exibir o minimapa e alinhar à grade.

**{{ui:workflows.settings.autoTidy}}** já vem ativado. Ao acrescentar ou remover nós e linhas, pouco depois os nós são reorganizados automaticamente da esquerda para a direita e os nós duplicados com a mesma função são unidos. Quando há união, aparece uma notificação, e `Ctrl+Z` desfaz. Nós sem conexão não são removidos automaticamente. Para organizar por conta própria, desative a opção.

Se houver alterações não salvas, aparece um ponto ao lado do nome. Ao trocar para outro fluxo de trabalho, o app pergunta se as alterações podem ser descartadas.

### Usar com o formulário

Com muitos nós, o editor fica difícil de entender. Por isso, é possível criar um “formulário” que reúne apenas os itens mexidos com frequência no uso.

1. No editor, clique com o botão direito em um item (campo) e escolha **{{ui:workflows.node.addToForm}}**.
2. Na aba **{{ui:workflows.panel.workflow}}** do painel esquerdo, esse item passa a aparecer.
3. Ao pressionar **{{ui:workflows.form.editForm}}**, é possível reordenar e remover itens.

É útil para executar várias vezes mudando apenas o prompt e o tamanho. Os itens que estão conectados mostram “{{ui:workflows.form.connected}}”.

Na aba **{{ui:workflows.panel.details}}**, é possível escrever nome, autor, tags, descrição etc. Na aba **{{ui:workflows.panel.data}}**, é possível ver e copiar o conteúdo do fluxo de trabalho (JSON).

### Biblioteca de fluxos de trabalho

![A biblioteca de fluxos de trabalho](shot:workflows-library)

Ao pressionar **{{ui:workflows.library.button}}**, a lista se abre.

- **{{ui:workflows.library.recent}}**: os abertos recentemente.
- **{{ui:workflows.library.yours}}**: os que você mesmo salvou.
- **{{ui:workflows.library.defaults}}**: exemplos que já vêm com o app. Para modificar um exemplo, copie-o para o seu uso com **{{ui:workflows.library.copyToMine}}**.

É possível buscar, filtrar por tags e mudar a ordem. Abra com **{{ui:workflows.library.open}}** e exclua com o botão da lixeira. **{{ui:workflows.library.new}}** e **{{ui:workflows.library.upload}}** também ficam aqui.

### Exportar e importar

- Com **{{ui:workflows.toolbar.download}}**, o fluxo de trabalho pode ser exportado como arquivo JSON.
- Com **{{ui:workflows.toolbar.loadFromFile}}** (ou **{{ui:workflows.library.upload}}**), é possível importar um arquivo exportado ou criado por outra pessoa.
- Se o arquivo importado usar nós de extensões ainda não instaladas, aparece o diálogo “{{ui:workflows.import.title}}”. Depois de instalar e reiniciar o ComfyUI, esse fluxo de trabalho abre automaticamente.
- Também é possível extrair o fluxo de trabalho de uma imagem criada por um fluxo. Clique com o botão direito em uma imagem da galeria e escolha **{{ui:gallery.menu.loadWorkflow}}** (com a imagem aberta no visualizador, a tecla `W` também funciona). Mesmo para uma imagem gerada normalmente, é possível montar o mesmo fluxo a partir das configurações. **{{ui:gallery.menu.sendToWorkflow}}** é para usar essa imagem como imagem de entrada do fluxo de trabalho.

> Um fluxo de trabalho criado por outra pessoa é uma sequência de programas que roda no seu computador. Não importe arquivos de origem desconhecida.

## Templates

A aba **{{ui:workflows.panel.templates}}** reúne templates das combinações mais usadas.

- Ao pressionar **{{ui:workflows.templates.open}}**, ele abre como um novo fluxo de trabalho.
- Ao pressionar **{{ui:workflows.templates.add}}**, ele é acrescentado à direita do editor atual.
- Os modelos e as imagens são escolhidos depois de abrir.

Os templates que exigem extensões mostram o campo “Requer: …”. Pressione **{{ui:workflows.templates.installPacks}}** para instalar e reinicie o ComfyUI com o botão **{{ui:workflows.templates.restartFirst}}**; então será possível abri-los.

Os templates disponíveis são os seguintes.

| Template | O que faz | Extensão necessária |
|---|---|---|
| **{{ui:workflows.templates.text2image.title}}** | A forma básica: cria uma imagem a partir do modelo e do prompt e a salva. | Nenhuma |
| **{{ui:workflows.templates.text2imageUpscale.title}}** | Amplia para 2048 uma imagem criada em 1024 e a salva. | Nenhuma |
| **{{ui:workflows.templates.loraStack.title}}** | Conecta LoRAs em sequência ao modelo, acrescentando estilo e detalhes. | Nenhuma |
| **{{ui:workflows.templates.image2image.title}}** | Refaz com outro prompt a partir de uma imagem que você já tem. | Nenhuma |
| **{{ui:workflows.templates.upscale.title}}** | Amplia a imagem em alta definição com um modelo de ampliação. | Nenhuma |
| **{{ui:workflows.templates.controlnetCanny.title}}** | Extrai as linhas de contorno da imagem e cria uma nova mantendo essa forma. | Nenhuma |
| **{{ui:workflows.templates.imageToVideo.title}}** | Dá movimento a uma imagem e a transforma em um vídeo curto. | Nenhuma (é preciso um modelo de vídeo) |
| **{{ui:workflows.templates.filmGrain.title}}** | Acrescenta à imagem criada um grão de aspecto fotográfico. | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.faceRig.title}}** | Muda a expressão, o olhar e a direção do pescoço em uma foto de rosto. | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.tiledUpscale.title}}** | Amplia para 2048 e depois refaz cada bloco, acrescentando detalhes. | ComfyUI_UltimateSDUpscale |
| **{{ui:workflows.templates.styleReference.title}}** | Transfere o estilo de uma imagem de referência para a imagem do prompt. | ComfyUI_IPAdapter_plus (e seus modelos) |
| **{{ui:workflows.templates.faceDetailer.title}}** | Encontra o rosto na imagem criada e o refaz em resolução mais alta. | Impact Pack e Impact Subpack |
| **{{ui:workflows.templates.removeBackground.title}}** | Mantém apenas a pessoa ou o objeto e deixa o fundo transparente. | ComfyUI-RMBG |
| **{{ui:workflows.templates.whiteBackground.title}}** | Mantém apenas a pessoa ou o objeto e deixa o fundo totalmente branco. Serve de preparação para evitar que a cor do fundo da imagem de referência passe para a imagem. | ComfyUI-RMBG |
| **{{ui:workflows.templates.poseControl.title}}** | Extrai a pose da pessoa de uma imagem de referência e cria uma nova imagem com a mesma postura. | comfyui_controlnet_aux (e um modelo ControlNet para OpenPose) |
| **{{ui:workflows.templates.captionToImage.title}}** | Descreve em texto o conteúdo de uma imagem de referência, usa o texto como prompt e cria uma imagem nova. | Extensão do Florence-2 |
| **{{ui:workflows.templates.characterReference.title}}** | Coloca a imagem de um personagem sobre fundo branco como referência, uniformiza cabelo, olhos e roupa e cria uma nova cena. O CFG vem em um valor baixo, adequado à imagem de referência. | ComfyUI-RMBG e ComfyUI_IPAdapter_plus |
| **{{ui:workflows.templates.characterPose.title}}** | Cria com a aparência do personagem vinda da imagem de referência e a postura vinda de um boneco de palitos (OpenPose). | Os 2 acima, mais comfyui_controlnet_aux e um modelo ControlNet para OpenPose |

Os templates com personagens são para quem quer ajustar com mais detalhe, em um fluxo de trabalho, o recurso de [Registrar e usar um personagem](04-improve.md#registrar-e-usar-um-personagem). Normalmente, basta usar o personagem registrado na aba Gerar. A postura do boneco de palitos pode ser criada em “{{ui:pose.title}}” no capítulo [Tela](05-canvas.md).

## Extensões (pacotes de nós)

Na aba **{{ui:workflows.panel.packs}}**, é possível acrescentar extensões ao ComfyUI ou removê-las. Uma extensão é uma peça adicional que aumenta o número de nós. Os nós das extensões instaladas aparecem em **{{ui:workflows.categories.extension}}**, na lista de adicionar nós.

No início, aparecem grandes blocos de “{{ui:workflows.packs.whatToDo}}”. Ao escolher o que se quer fazer (corrigir bem o rosto, remover o fundo, ampliar com alta definição etc.), as extensões adequadas aparecem com uma descrição.

1. Pressione **{{ui:workflows.packs.install}}** na extensão que deseja usar.
2. Quando a instalação terminar, aparece “{{ui:workflows.packs.restartNeeded}}”. Pressione **{{ui:workflows.packs.restart}}**.
3. Depois da reinicialização, os nós e os templates dessa extensão podem ser usados.

Algumas extensões trazem observações, como “Requer Git”, “A instalação leva tempo e espaço” ou “Sem atualizações”. Leia antes de instalar.

O que não estiver no catálogo pode ser instalado com **{{ui:workflows.packs.byAddress}}**, informando um endereço do GitHub (no formato https://github.com/usuário/nome). As outras extensões já instaladas aparecem em **{{ui:workflows.packs.others}}**. As extensões desnecessárias podem ser removidas com **{{ui:workflows.packs.remove}}** (por segurança, é preciso pressionar de novo).

As extensões instaladas podem ser consultadas a qualquer momento, mesmo fora da tela de fluxos de trabalho. Ao pressionar **{{ui:app.nav.extensions}}** (o ícone de quebra-cabeça) na barra lateral esquerda, abre-se o **{{ui:workflows.packs.mgr.title}}**. As extensões publicadas aparecem em cartões; na lista à esquerda, é possível filtrar por **{{ui:workflows.packs.mgr.installed}}**, **{{ui:workflows.packs.mgr.notInstalled}}** e por finalidade, e no campo superior é possível buscar por nome, autor e descrição. **{{ui:workflows.packs.mgr.sort.label}}** começa com **{{ui:workflows.packs.mgr.sort.downloads}}** em ordem decrescente. Os cartões mostram autor, versão, data de atualização e número de downloads, e os já instalados mostram **{{ui:workflows.packs.installed}}**. Os não instalados podem ser instalados com **{{ui:workflows.packs.install}}**, no cartão. Ao clicar em um cartão, os detalhes abrem à direita; ali é possível conferir a **{{ui:workflows.packs.mgr.license}}** e a origem da distribuição, e também usar **{{ui:workflows.packs.remove}}**. Uma extensão que não está na lista pode ser instalada informando seu endereço do GitHub em **{{ui:workflows.packs.mgr.addTitle}}**, no alto. Depois de instalar ou remover, pressione **{{ui:workflows.packs.restart}}**, exibido na mesma tela, para aplicar. Os detalhes de cada cartão têm o botão **{{ui:agent.ask.button}}** e, se houver palavras no campo de busca, também aparece **{{ui:agent.ask.resultsButton}}**. Ao pressioná-los, o assistente de IA explica o que essa extensão faz e como usá-la (veja [Assistente de IA e configurações](09-assistant-settings.md)).

Em **{{ui:workflows.packs.version.label}}**, nos detalhes, aparece a versão instalada no momento. Somente quando o repositório da extensão publica versões, aparece **{{ui:workflows.packs.version.change}}**; ao pressioná-lo, as versões disponíveis são listadas, e **{{ui:workflows.packs.version.apply}}** troca para a versão escolhida. A versão instalada no momento mostra **{{ui:workflows.packs.installed}}**. Para extensões que não publicam versões, esse botão não aparece. Para aplicar, pressione **{{ui:workflows.packs.restart}}**, na mesma tela. Versões que se sabe não serem compatíveis com outras extensões ou com o ComfyUI mostram **{{ui:workflows.packs.version.deprecated}}**, com a indicação de quais não são compatíveis. Em extensões que você mesmo instalou, não é possível mudar a versão por aqui.

A versão do ComfyUI também pode ser trocada na mesma tela. Clique no cartão **{{ui:workflows.packs.version.comfyTitle}}**, no início da lista, e liste as versões disponíveis com **{{ui:workflows.packs.version.change}}**, que aparece à direita. Depois de pressionar **{{ui:workflows.packs.version.apply}}**, pressione de novo **{{ui:workflows.packs.version.confirm}}** para iniciar a troca. Como todas as extensões instaladas são reinstaladas, leva alguns minutos, e não é possível criar imagens até o fim. Se a nova versão não iniciar, o app volta à versão anterior.

> Uma extensão é um programa que roda no seu computador. Não instale extensões de origem desconhecida.

> Se estiver conectado a um ComfyUI que o app não gerencia, não é possível instalar a partir desta tela. Instale no próprio ComfyUI.

Os recursos que usam extensões, como “{{ui:cutout.menu}}” e “{{ui:facefix.menu}}” em [Corrigir e reaproveitar imagens](04-improve.md), orientam a instalação da mesma forma quando ela se torna necessária.
