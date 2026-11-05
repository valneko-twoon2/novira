# Ampliação e fluxos de trabalho

Este capítulo explica a aba **{{ui:app.tabs.upscaling}}**, que aumenta imagens, e a aba **{{ui:app.tabs.workflows}}**, em que você monta e conecta o processamento por conta própria.

## Ampliação

![A tela de ampliação. No centro, o lugar para soltar a imagem e os cartões dos passos](shot:upscaling)

**{{ui:app.tabs.upscaling}}** abre pelo ícone de moldura na barra lateral esquerda (também abre com a tecla numérica 3). Ela aumenta a imagem e acrescenta detalhes. Em vez de simplesmente esticar, primeiro amplia com um modelo de ampliação e depois redesenha os detalhes usando o prompt e o ControlNet de blocos. Uma imagem grande é dividida em blocos do mesmo tamanho da imagem original, e cada bloco é redesenhado e emendado. Como se desenha no tamanho em que o modelo é bom, é difícil a imagem se desmanchar, e o tempo necessário é, em geral, proporcional ao número de blocos. Todos os blocos são desenhados com o prompt inteiro, então, se o prompt descreve uma pessoa, podem aparecer pequenas silhuetas ou rostos nos blocos de céu ou de fundo. Nesse caso, reduza **{{ui:params.upscale.creativity}}** ou deixe no prompt só palavras de qualidade e de textura.

### O que é usado

São usados os 2 modelos a seguir. Se não estiverem instalados, um aviso aparece no painel esquerdo. Pelo botão “{{ui:params.upscale.openModels}}” é possível ir à tela de modelos. Como instalar está no capítulo [Modelos](08-models.md).

- {{ui:params.upscale.model}} (como o Real-ESRGAN, um modelo para ampliar imagens)
- {{ui:params.upscale.tileControlnet}} que combine com o modelo principal escolhido (se houver um compatível, ele é escolhido automaticamente. Em famílias sem um compatível, como Anima e Qwen-Image, redesenha-se sem o ControlNet de blocos. Nesse caso **{{ui:params.upscale.structure}}** não tem efeito; para manter a forma, reduza **{{ui:params.upscale.creativity}}**)

Quando nenhum modelo de ampliação está instalado, os candidatos aparecem no painel esquerdo; escolha entre os marcados com **{{ui:media.choice.recommended}}** e instale com **{{ui:models.install.install}}**.

### Passos

1. Arraste a imagem que quer ampliar, da galeria, até o cartão do centro ou até o quadro de **{{ui:params.upscale.title}}**, no painel esquerdo. Também funciona clicar com o botão direito numa imagem da galeria (no visualizador, a barra de ferramentas) e escolher **{{ui:gallery.menu.upscale}}**, ou abrir a imagem no visualizador e pressionar `Shift+U`: a aba muda e a imagem entra.
2. Escolha **{{ui:params.upscale.model}}**.
3. Escolha **{{ui:params.upscale.scale}}** entre 2x, 4x e 8x. O tamanho do resultado aparece, como em “Saída: 2048×2048”.
4. Ajuste o acabamento com os 2 controles deslizantes a seguir.
   - **{{ui:params.upscale.creativity}}**: quanto mais alto, mais a imagem se afasta da original e acrescenta detalhes novos.
   - **{{ui:params.upscale.structure}}**: quanto mais alto, mais se mantêm a forma e a disposição da imagem original.
5. Confira **{{ui:params.upscale.tileControlnet}}** (se houver um compatível, ele já vem escolhido). Se necessário, escolha também **{{ui:params.upscale.postProcessing}}** (a imagem desenhada é finalizada com este modelo e depois ajustada ao tamanho de saída).
6. Clique em **{{ui:params.invoke.invoke}}**.

A imagem pronta entra na galeria.

- O tamanho de saída tem no máximo 8192 pixels de lado. Se passar disso, aparece um aviso; reduza a ampliação.
- O prompt influencia os detalhes que são acrescentados. Se você digitar o prompt da imagem original, a direção da imagem tende a combinar melhor.
- Se a imagem depois da ampliação ficar diferente demais da original, reduza **{{ui:params.upscale.creativity}}** e aumente **{{ui:params.upscale.structure}}**.

> Para ampliar várias imagens de uma vez, selecione várias na galeria e use **{{ui:gallery.menu.batch}}**, no botão direito ([Corrigir e reutilizar imagens](04-improve.md)). Essa forma amplia usando só o modelo de ampliação.

## Fluxos de trabalho

![A aba de fluxos de trabalho. À direita, a tela em que se desenha a conexão do processamento; à esquerda, o formulário](shot:workflows)

Um fluxo de trabalho é um recurso para montar, conectando componentes (nós), uma sequência de processamentos como “carregar o modelo → inserir o prompt → criar a imagem → salvar”. Permite criar etapas detalhadas que a aba de geração do dia a dia não alcança e fluxos que combinam vários processamentos.

No começo, recomenda-se abrir e usar um template em **{{ui:workflows.panel.templates}}** (próximo item).

A tela é formada por 2 partes.

- Centro: o **{{ui:app.views.editor}}**. Os nós são dispostos e ligados por linhas.
- Painel esquerdo: 6 abas, **{{ui:workflows.panel.workflow}}** (formulário), **{{ui:workflows.panel.nodes}}**, **{{ui:workflows.panel.templates}}**, **{{ui:workflows.panel.packs}}**, **{{ui:workflows.panel.details}}** e **{{ui:workflows.panel.data}}**.

Para executar o fluxo, clique no botão **{{ui:params.invoke.invoke}}**, no alto do painel esquerdo. Se houver problemas, como a falta de um nó de saída (como “{{ui:workflows.nodes.save_image.title}}”) ou nenhum modelo escolhido, o motivo pelo qual não é possível gerar é exibido.

Todos os nós conectados são usados na execução. **{{ui:workflows.nodes.controlnet.title}}**, **{{ui:workflows.nodes.ip_adapter.title}}**, **{{ui:workflows.nodes.img_resize.title}}**, **{{ui:workflows.nodes.canny_edge_detection.title}}** e outros também funcionam conforme foram conectados. **{{ui:workflows.nodes.ip_adapter.title}}** exige uma extensão e um modelo (codificador de imagem). Ainda não podem ser executados **{{ui:workflows.nodes.collect.title}}**, **{{ui:workflows.nodes.iterate.title}}**, **{{ui:workflows.nodes.range.title}}**, o desfoque de caixa e os nós de cálculo ligados a **{{ui:workflows.nodes.rand_int.title}}**. O motivo de não poderem ser usados aparece na exibição de problemas acima.

### Adicionar e conectar nós

Na aba **{{ui:workflows.panel.nodes}}** do painel esquerdo, os nós que podem ser acrescentados aparecem na mesma divisão do ComfyUI. Sob os títulos **{{ui:workflows.nodeLibrary.section.core}}** e **{{ui:workflows.picker.extensions}}**, as pastas por tipo (modelos, imagens, vídeo etc.) ficam na mesma ordem do ComfyUI, e os nós padrão próprios do novira também estão nas pastas do mesmo tipo. Ao abrir, aparecem as pastas e os nós. Em **{{ui:workflows.picker.extensions}}**, as categorias da extensão ficam dentro de uma pasta com o nome dela. Ao pesquisar, os nós correspondentes aparecem junto com a pasta em que estão. Com duplo clique no nó (ou selecionando e pressionando `Enter`), ele entra no centro da área de desenho; arrastando-o para a área de desenho, ele entra no ponto onde for solto. Dá para acrescentar vários seguidos sem abrir uma lista que cubra a tela. Também é possível acrescentar pelos métodos a seguir.

1. Pressione `Shift+A` ou `Space` no teclado para abrir a lista de seleção de nós.
2. Escolha o nó na lista. Digite palavras no campo de busca, no alto, para filtrar. Na classificação à esquerda, é possível filtrar pelos tipos de nó padrão, pelos tipos de nó do próprio ComfyUI ou por cada extensão instalada.
3. Arraste do círculo à direita de um nó (saída) até o círculo à esquerda de outro nó (entrada) para conectar. Só se conectam itens do mesmo tipo.

![A lista ao adicionar um nó](shot:workflows-add-node)

Há recursos úteis ao conectar.

- Se você soltar a linha num lugar vazio, a lista mostra só os nós que podem ser ligados ali. Ao escolher, o nó é acrescentado e já fica conectado.
- Se soltar a linha sobre um nó, ela se liga sozinha à entrada compatível.
- O nó selecionado é excluído com `Delete`. Com `Ctrl+C` e `Ctrl+V`, nós são duplicados. `Ctrl+Z` desfaz e `Ctrl+Shift+Z` refaz.
- Se você arrastar uma imagem da galeria até o editor, é acrescentado um nó “{{ui:workflows.nodes.image.title}}” com essa imagem.
- A seta à esquerda do nome do nó o recolhe. Com duplo clique no nome, o nome pode ser mudado.

Os valores de configuração do nó são digitados diretamente nele. O valor de uma entrada conectada vem do nó ao qual ela está ligada.

### Criar música e vídeo com um fluxo de trabalho

Na aba **{{ui:workflows.panel.nodes}}** do painel esquerdo e à esquerda da lista para adicionar nós, há a classificação **{{ui:workflows.picker.core}}**. Os nós que o ComfyUI já traz de início ficam alinhados por tipo (áudio, vídeo, amostragem etc.), e os nós que criam música e vídeo também estão aqui. Eles podem ser combinados livremente com os nós padrão.

- Abrindo os templates **{{ui:workflows.templates.musicAceStep.title}}**, **{{ui:workflows.templates.videoWan22.title}}** e **{{ui:workflows.templates.videoWan22Image.title}}**, já é possível executar. Os modelos usados são os baixados nas abas de música e de vídeo.
- Escolha o formato no nó que salva o resultado (Save Audio ou Save Video). As configurações necessárias para o formato escolhido, como a qualidade do MP3, aparecem logo abaixo.
- A música e o vídeo prontos entram na galeria. Os formatos que a galeria aceita são MP3, WAV e FLAC para música e MP4 para vídeo. Se você escolher Opus, WebM etc., aparece uma mensagem avisando que o formato não pode ser salvo, e o processo para.
- A música e o vídeo da galeria são escolhidos e conectados com os nós Load Audio e Load Video.
- O nó **{{ui:workflows.nodes.voice_speak.title}}** (categoria **{{ui:workflows.categories.audio}}**) cria uma voz lendo um texto em voz alta. Usa o mesmo mecanismo da aba de voz (Qwen3-TTS), que precisa ser instalado antes. A voz criada é ligada a um nó que recebe áudio. Ligada a Save Audio, pode ser salva em MP3 etc.; ligada ao áudio de Create Video, dá voz ao vídeo (se o áudio for mais longo que o vídeo, é cortado no comprimento do vídeo). Os templates **{{ui:workflows.templates.voiceRead.title}}** e **{{ui:workflows.templates.videoNarration.title}}** podem ser usados como estão.
- Uma seed sem um “número inteiro aleatório” conectado dá sempre o mesmo resultado. Nos templates, ele já vem conectado.
- Os nomes dos nós do próprio ComfyUI, dos campos e das pastas aparecem com as mesmas palavras da tela do próprio ComfyUI. As palavras que o ComfyUI não traduz (como nós de extensões) ficam em inglês. O número de nós disponíveis muda conforme a versão do ComfyUI.

### A fileira de botões

São os botões no canto superior esquerdo do editor.

| Botão | O que faz |
|---|---|
| **{{ui:workflows.toolbar.new}}** | Começa um fluxo de trabalho vazio. |
| **{{ui:workflows.toolbar.save}}** (`Ctrl+S`) | Salva. Na primeira vez, pede um nome. |
| **{{ui:workflows.toolbar.optimize}}** | Reúne nós duplicados, elimina nós que não levam à saída e conexões desnecessárias e reorganiza da esquerda para a direita. Também dá para refazer. |
| **{{ui:workflows.toolbar.more}}** | **{{ui:common.saveAs}}**, **{{ui:workflows.toolbar.download}}**, **{{ui:workflows.toolbar.loadFromFile}}**. |

Na engrenagem **{{ui:workflows.settings.title}}**, no canto superior direito, é possível alternar a exibição do minimapa, o ajuste à grade etc.

**{{ui:workflows.settings.autoTidy}}** começa desativado. Quando ativado, ao acrescentar ou apagar nós e linhas, pouco depois os nós são reorganizados automaticamente da esquerda para a direita e os nós duplicados de mesma função são reunidos. Ao reunir, uma notificação aparece, e `Ctrl+Z` desfaz. Nós desconectados não são apagados automaticamente. Se você prefere organizar à mão, deixe desativado.

Quando há alterações não salvas, aparece um ponto ao lado do nome. Ao trocar para outro fluxo de trabalho, o app pergunta se pode descartá-las.

### Usar com o formulário

O editor fica difícil de entender quando há muitos nós. Por isso, é possível criar um “formulário” que reúne só os itens mexidos com frequência no uso.

1. No editor, clique com o botão direito num item (campo) e escolha **{{ui:workflows.node.addToForm}}**.
2. Na aba **{{ui:workflows.panel.workflow}}** do painel esquerdo, o item passa a aparecer.
3. Clicando em **{{ui:workflows.form.editForm}}**, é possível reordenar e retirar itens.

É útil para executar muitas vezes mudando só o prompt e o tamanho. Os itens que estão conectados aparecem com “{{ui:workflows.form.connected}}”.

Na aba **{{ui:workflows.panel.details}}**, é possível escrever nome, autor, tags, descrição etc. Na aba **{{ui:workflows.panel.data}}**, é possível ver e copiar o conteúdo do fluxo de trabalho (JSON).

### Biblioteca de fluxos de trabalho

![A biblioteca de fluxos de trabalho](shot:workflows-library)

Clique no cartão **{{ui:workflows.library.button}}** (que mostra o nome do fluxo de trabalho aberto), no alto do painel esquerdo, acima do botão de gerar, e a lista se abre.

- **{{ui:workflows.library.recent}}**: os abertos recentemente.
- **{{ui:workflows.library.yours}}**: os que você salvou.
- **{{ui:workflows.library.defaults}}**: exemplos que já vêm com o app. Os exemplos são copiados para você com **{{ui:workflows.library.copyToMine}}**, e só então são alterados.

É possível buscar, filtrar por tag e mudar a ordem. Abra com **{{ui:workflows.library.open}}** e exclua com o botão de lixeira. **{{ui:workflows.library.new}}** e **{{ui:workflows.library.upload}}** também ficam aqui.

### Exportar e importar

- Com **{{ui:workflows.toolbar.download}}**, o fluxo de trabalho pode ser exportado como um arquivo JSON.
- Com **{{ui:workflows.toolbar.loadFromFile}}** (ou **{{ui:workflows.library.upload}}**), é possível carregar arquivos exportados ou criados por outras pessoas.
- Quando o arquivo carregado usa nós de extensões ainda não instaladas, aparece a caixa de diálogo “{{ui:workflows.import.title}}”. Depois de instalar e reiniciar o ComfyUI, o fluxo de trabalho abre sozinho.
- Também é possível extrair o fluxo de trabalho de uma imagem criada por ele. Clique com o botão direito numa imagem da galeria e escolha **{{ui:gallery.menu.loadWorkflow}}** (com a imagem aberta no visualizador, também funciona a tecla `W`). Mesmo numa imagem gerada de modo comum, o mesmo fluxo pode ser montado a partir das configurações. **{{ui:gallery.menu.sendToWorkflow}}** é para usar essa imagem como imagem de entrada do fluxo de trabalho.

> Um fluxo de trabalho feito por outra pessoa é uma ligação de programas que roda no seu computador. Não carregue arquivos de origem desconhecida.

## Templates

Na aba **{{ui:workflows.panel.templates}}** aparecem os modelos prontos das combinações mais usadas.

- Ao clicar em **{{ui:workflows.templates.open}}**, ele abre como um novo fluxo de trabalho.
- Ao clicar em **{{ui:workflows.templates.add}}**, ele é acrescentado à direita do que está no editor.
- O modelo de IA e as imagens são escolhidos depois de abrir.

Os templates que exigem extensões mostram o campo “Extensões necessárias”. Clique em **{{ui:workflows.templates.installPacks}}** para instalar e reinicie o ComfyUI com o botão **{{ui:workflows.templates.restartFirst}}**; então ele pode ser aberto. Os templates montados com nós do próprio ComfyUI podem ser abertos assim que o ComfyUI estiver em funcionamento.

Os templates disponíveis são estes:

| Template | O que faz | Extensão necessária |
|---|---|---|
| **{{ui:workflows.templates.text2image.title}}** | A forma básica: cria uma imagem a partir do modelo e do prompt e a salva. | Nenhuma |
| **{{ui:workflows.templates.text2imageUpscale.title}}** | Amplia para 2048 uma imagem criada em 1024 e a salva. | Nenhuma |
| **{{ui:workflows.templates.loraStack.title}}** | Liga LoRAs em sequência ao modelo para acrescentar estilo e detalhes. | Nenhuma |
| **{{ui:workflows.templates.image2image.title}}** | Redesenha com outro prompt a partir de uma imagem que você tem. | Nenhuma |
| **{{ui:workflows.templates.upscale.title}}** | Amplia a imagem em alta definição com um modelo de ampliação. | Nenhuma |
| **{{ui:workflows.templates.controlnetCanny.title}}** | Extrai as linhas de contorno de uma imagem e desenha uma nova mantendo essa forma. | Nenhuma |
| **{{ui:workflows.templates.imageToVideo.title}}** | Dá movimento a uma imagem e a transforma num vídeo curto. | Nenhuma (é necessário um modelo de vídeo) |
| **{{ui:workflows.templates.videoWan22.title}}** | Cria um vídeo curto a partir de texto com nós do próprio ComfyUI. Duração, tamanho e amostrador também podem ser mudados à vontade. | Nenhuma (é necessário um modelo de vídeo) |
| **{{ui:workflows.templates.videoWan22Image.title}}** | Na mesma montagem, cria um vídeo a partir da imagem escolhida. | Nenhuma (é necessário um modelo de vídeo) |
| **{{ui:workflows.templates.musicAceStep.title}}** | Cria uma música a partir de tags de estilo e da letra. | Nenhuma (é necessário um modelo de música) |
| **{{ui:workflows.templates.voiceRead.title}}** | Cria uma voz lendo um texto e a salva em MP3. | Nenhuma (são necessários o mecanismo de voz e o modelo) |
| **{{ui:workflows.templates.videoNarration.title}}** | Escolhe um vídeo da galeria, usa a voz lida como áudio desse vídeo e o salva como um novo vídeo. | Nenhuma (são necessários o mecanismo de voz e o modelo) |
| **{{ui:workflows.templates.filmGrain.title}}** | Acrescenta à imagem criada um grão de aspecto fotográfico. | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.faceRig.title}}** | Muda a expressão, o olhar e a direção do pescoço numa foto de rosto. | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.tiledUpscale.title}}** | Amplia para 2048 e depois redesenha bloco a bloco para acrescentar detalhes. | ComfyUI_UltimateSDUpscale |
| **{{ui:workflows.templates.styleReference.title}}** | Passa o estilo de uma imagem de referência para a imagem do prompt. | ComfyUI_IPAdapter_plus (e seus modelos) |
| **{{ui:workflows.templates.faceDetailer.title}}** | Encontra o rosto da imagem criada e o redesenha em alta resolução. | Impact Pack e Impact Subpack |
| **{{ui:workflows.templates.removeBackground.title}}** | Deixa só a pessoa ou o objeto e torna o fundo transparente. | ComfyUI-RMBG |
| **{{ui:workflows.templates.whiteBackground.title}}** | Deixa só a pessoa ou o objeto e torna o fundo branco puro. Serve de preparação para evitar que a cor do fundo da imagem de referência passe para a imagem. | ComfyUI-RMBG |
| **{{ui:workflows.templates.poseControl.title}}** | Extrai a pose da pessoa de uma imagem de referência e cria uma nova imagem na mesma postura. | comfyui_controlnet_aux (e um modelo ControlNet para OpenPose) |
| **{{ui:workflows.templates.captionToImage.title}}** | Transforma o conteúdo de uma imagem de referência em texto, usa-o como prompt e desenha uma imagem nova. | Extensão do Florence-2 |
| **{{ui:workflows.templates.characterReference.title}}** | Coloca o desenho do personagem sobre fundo branco como imagem de referência, uniformiza cabelo, olhos e roupas e desenha uma nova cena. O CFG vem com um valor baixo, adequado à imagem de referência. | ComfyUI-RMBG e ComfyUI_IPAdapter_plus |
| **{{ui:workflows.templates.characterPose.title}}** | Desenha com a aparência do personagem tirada da imagem de referência e a postura tirada do boneco de palitos (OpenPose). | As 2 acima, mais comfyui_controlnet_aux e um modelo ControlNet para OpenPose |

Os templates que usam personagens servem para quando se quer ajustar com precisão, num fluxo de trabalho, o recurso de [registrar e usar um personagem](04-improve.md#registrar-e-usar-um-personagem). Normalmente basta usar na aba de geração o personagem registrado. A postura do boneco de palitos pode ser criada em “{{ui:pose.title}}”, na [Tela](05-canvas.md).

## Extensões (nós personalizados)

Na aba **{{ui:workflows.panel.packs}}**, acrescentam-se e retiram-se extensões do ComfyUI. As extensões são peças adicionais que aumentam o número de nós. Os nós instalados aparecem em **{{ui:workflows.categories.extension}}**, na lista para adicionar nós.

No começo, aparecem grandes blocos de “{{ui:workflows.packs.whatToDo}}”. Ao escolher o que você quer fazer (corrigir rostos, apagar o fundo, ampliar com alta definição etc.), as extensões adequadas aparecem com uma descrição.

1. Clique em **{{ui:workflows.packs.install}}** na extensão que quer usar.
2. Terminada a instalação, aparece “{{ui:workflows.packs.restartNeeded}}”. Clique em **{{ui:workflows.packs.restart}}**.
3. Depois da reinicialização, os nós dessa extensão e os templates podem ser usados.

Algumas extensões trazem avisos, como “exige o Git”, “a instalação leva tempo e espaço” ou “não é mais atualizada”. Leia antes de instalar.

O que não está no catálogo pode ser instalado digitando o endereço do GitHub (no formato https://github.com/usuário/nome) em **{{ui:workflows.packs.byAddress}}**. As outras extensões que também estão instaladas aparecem em **{{ui:workflows.packs.others}}**. Extensões desnecessárias podem ser retiradas com **{{ui:workflows.packs.remove}}** (clique de novo para confirmar).

As extensões instaladas podem ser vistas a qualquer momento, mesmo fora da tela de fluxos de trabalho. Ao clicar em **{{ui:app.nav.extensions}}** (ícone de peça de quebra-cabeça), na barra lateral esquerda, abre-se **{{ui:workflows.packs.mgr.title}}**. As extensões publicadas aparecem em cartões; na lista da esquerda é possível filtrar por **{{ui:workflows.packs.mgr.installed}}**, **{{ui:workflows.packs.mgr.notInstalled}}** e por finalidade, e no campo de cima, procurar por nome, autor e descrição. **{{ui:workflows.packs.mgr.sort.label}}** começa na ordem de **{{ui:workflows.packs.mgr.sort.downloads}}**, do maior para o menor. Os cartões mostram autor, versão, data de atualização e número de downloads, e as instaladas mostram **{{ui:workflows.packs.installed}}**. As que não estão instaladas podem ser instaladas por **{{ui:workflows.packs.install}}**, no cartão. Ao clicar no cartão, os detalhes se abrem à direita, onde se pode conferir a **{{ui:workflows.packs.mgr.license}}** e a origem da distribuição, e também usar **{{ui:workflows.packs.remove}}**. Uma extensão que não está na lista pode ser instalada digitando o endereço do GitHub em **{{ui:workflows.packs.mgr.addTitle}}**, no alto. Depois de instalar ou retirar, clique em **{{ui:workflows.packs.restart}}**, que aparece na mesma tela, para que a mudança valha. Os detalhes de cada cartão têm o botão **{{ui:agent.ask.button}}**, e, ao digitar palavras no campo de busca, também aparece **{{ui:agent.ask.resultsButton}}**. Ao clicar, o assistente de IA explica o que aquela extensão faz e como usá-la (veja [Assistente de IA e configurações](09-assistant-settings.md)).

Em **{{ui:workflows.packs.version.label}}**, nos detalhes, aparece a versão instalada no momento. **{{ui:workflows.packs.version.change}}** só aparece quando o repositório da extensão publica versões; ao clicar, as versões disponíveis aparecem, e **{{ui:workflows.packs.version.apply}}** troca para a versão escolhida. A versão instalada no momento mostra **{{ui:workflows.packs.installed}}**. Em extensões que não publicam versões, esse botão não aparece. Para a mudança valer, clique em **{{ui:workflows.packs.restart}}**, na mesma tela. Versões que se sabe não serem compatíveis com outras extensões ou com o ComfyUI mostram **{{ui:workflows.packs.version.deprecated}}**, e também é indicado quais não são compatíveis. Em extensões que você mesmo instalou, não é possível mudar a versão por aqui.

A versão do ComfyUI também pode ser mudada pela mesma tela. Clique no cartão **{{ui:workflows.packs.version.comfyTitle}}**, no começo da lista, e liste as versões disponíveis com **{{ui:workflows.packs.version.change}}**, à direita. Depois de clicar em **{{ui:workflows.packs.version.apply}}**, clique mais uma vez em **{{ui:workflows.packs.version.confirm}}** e a troca começa. Como todas as extensões instaladas são instaladas de novo, leva alguns minutos, e não é possível criar imagens até terminar. Se a versão nova não iniciar, volta-se à versão anterior.

> Extensões são programas que rodam no seu computador. Não instale as de origem desconhecida.

> Quando se usa um ComfyUI que o app não gerencia, não é possível instalar por esta tela. Instale no próprio ComfyUI.

Os recursos que usam extensões, como “{{ui:cutout.menu}}” e “{{ui:facefix.menu}}” em [Corrigir e reutilizar imagens](04-improve.md), também orientam a instalação do mesmo modo quando ela se torna necessária.
