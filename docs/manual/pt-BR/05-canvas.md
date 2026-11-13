# Tela

![A aba da tela inteira. No centro, a tela de desenho; à direita, embaixo, a lista de camadas](shot:canvas)

A aba **{{ui:app.tabs.canvas}}** é a bancada para “desenhar, colocar e redesenhar apenas uma parte” da imagem. É possível colocar uma imagem e expandi-la, aplicar uma máscara onde se quer redesenhar e definir a pose com um boneco de palitos.

A tela se divide em 3 partes.

- Esquerda: o painel com as mesmas configurações da aba de geração (prompt, modelo, tamanho etc.). Na tela de desenho, o item **{{ui:params.compositing.title}}** é acrescentado.
- Centro: a tela de desenho. Os botões das ferramentas ficam alinhados no alto.
- Direita: a lista de **{{ui:canvas.layers.title}}**, onde entram as imagens.

Se você clicar em **{{ui:params.invoke.invoke}}** com a tela vazia, uma imagem comum é criada dentro da moldura pontilhada (a área de geração). O verdadeiro valor da tela aparece quando você coloca ali uma imagem ou um esboço. As camadas e as máscaras são salvas automaticamente e voltam como estavam quando o app é aberto de novo (o histórico de desfazer não é salvo).

## Colocar e desenhar imagens

Há várias maneiras de colocar uma imagem na tela.

- Desenhar com o pincel (escolha antes o **{{ui:canvas.tool.brush}}** ou pressione `B`). Se nenhuma camada estiver selecionada, uma {{ui:canvas.add.raster}} é criada automaticamente.
- Arrastar uma imagem da galeria até a tela. Aparece uma moldura para escolher o destino (raster, controle, máscara de inpaint etc.); solte ali.
- Com `Ctrl+V`, a imagem da área de transferência é colada como uma nova camada raster (ela também é salva na galeria).
- Clicar com o botão direito numa imagem da galeria (no visualizador, o ícone de pincel) e escolher o destino em **{{ui:gallery.menu.sendToCanvas}}**.

Os destinos são estes:

| Destino | No que se transforma |
|---|---|
| **{{ui:gallery.canvas.newCanvasRaster}}** | Esvazia a tela e começa com o mesmo tamanho dessa imagem. |
| **{{ui:gallery.canvas.newCanvasControl}}** | Também começa do zero, mas a imagem vira uma camada de controle. |
| **{{ui:gallery.canvas.raster}}** | Acrescenta à tela atual como camada raster. |
| **{{ui:gallery.canvas.control}}** | Acrescenta como camada de controle. |
| **{{ui:gallery.canvas.inpaint}}** | Acrescenta como máscara de inpaint. |
| **{{ui:gallery.canvas.regional}}** | Acrescenta como imagem de referência da orientação regional (veja [Orientação regional](#orientação-regional)). |

## Ferramentas

As ferramentas ficam alinhadas na barra de cima. Também é possível trocá-las pelas teclas de letra. Quando o app inicia, está selecionada a ferramenta **{{ui:canvas.tool.view}}**; por isso, arrastar na tela logo no começo só desloca a visualização e não desenha nada.

| Ferramenta | Tecla | Para que serve |
|---|---|---|
| **{{ui:canvas.tool.brush}}** | `B` | Desenha. A cor é mudada no botão de cor da barra. |
| **{{ui:canvas.tool.eraser}}** | `E` | Apaga o que foi desenhado. |
| **{{ui:canvas.tool.mosaic}}** | `M` | Aplica mosaico por onde se passa (para esconder algo). A granulação é mudada pelo número da barra. Só vale para camadas que tenham imagem. |
| **{{ui:canvas.tool.rect}}** | `U` | Preenche um retângulo. |
| **{{ui:canvas.tool.lasso}}** | `L` | Contorna uma forma livre e preenche o interior com cor (na máscara, mascara). |
| **{{ui:canvas.tool.pose}}** | `O` | Coloca na camada de controle um boneco de palitos e move as articulações (veja “Criar uma pose na tela”, mais abaixo). |
| **{{ui:canvas.tool.move}}** | `V` | Move a camada. As teclas de seta movem a camada selecionada de 1 px em 1 px (com Shift, de 10 px em 10 px). |
| **{{ui:canvas.tool.bbox}}** | `C` | Move a área de geração (caixa delimitadora) e muda seu tamanho. |
| **{{ui:canvas.tool.view}}** | `H` | Desloca a visualização. |
| **{{ui:canvas.tool.colorPicker}}** | `I` | Pega uma cor da imagem. |
| **{{ui:canvas.tool.bucket}}** | `K` | Preenche a região de cor parecida com o ponto clicado. Até que ponto a cor é considerada parecida é definido por **{{ui:canvas.toolbar.bucketTolerance}}**, na barra. |

Também é possível fazer o seguinte:

- A espessura do pincel é mudada em **{{ui:canvas.toolbar.brushWidth}}**, na barra, ou pelas teclas `[` e `]`. `Q` alterna com a última ferramenta usada.
- Para ampliar e reduzir, use a roda do mouse ou as teclas `+` e `-`. `Ctrl+0` mostra tudo, e `Ctrl+1` mostra em tamanho real (100%).
- Para deslocar a visualização, arraste segurando `Space` ou arraste segurando o botão da roda.
- **{{ui:canvas.toolbar.undo}}** (`Ctrl+Z`) e **{{ui:canvas.toolbar.redo}}** (`Ctrl+Shift+Z`) desfazem e refazem o que foi desenhado.

A engrenagem **{{ui:canvas.settings.title}}** tem a exibição da grade, a exibição que escurece o lado de fora da área de geração, a opção de limitar as linhas desenhadas ao interior da área de geração, a operação de reunir em uma só as camadas raster visíveis etc.

## Área de geração (caixa delimitadora)

A moldura pontilhada dentro da tela é a “área em que a imagem será criada desta vez”. A cada geração, só o interior dessa moldura é criado, e o tamanho dela é o tamanho da imagem.

- Troque para **{{ui:canvas.tool.bbox}}** (`C`) e arraste a moldura para movê-la. Arrastando um canto ou um lado, o tamanho muda.
- Também é possível definir o tamanho com **{{ui:params.image.bboxWidth}}** e **{{ui:params.image.bboxHeight}}**, no painel esquerdo.
- Com **{{ui:canvas.actions.fitBboxToLayers}}** (`Shift+C`), a moldura se ajusta à imagem colocada.

## Camadas

Em **{{ui:canvas.layers.title}}**, embaixo à direita, aparece a lista do que foi colocado na tela. Acrescente com o botão **+** ({{ui:common.add}}).

![O menu “Adicionar” das camadas aberto](shot:canvas-add-layer)

Há tipos de camada com funções diferentes.

| Tipo | Função |
|---|---|
| **{{ui:canvas.add.raster}}** | A camada de imagem comum. Nela se desenha e se colocam imagens. O que está aqui vira a “imagem original”. |
| **{{ui:canvas.add.control}}** | Uma imagem usada como pista de forma, linha, pose etc. Ela serve de instrução para a geração e não entra no conteúdo da imagem. |
| **{{ui:canvas.add.inpaint}}** | Indica pintando a área em que “se quer redesenhar aqui”. |
| **{{ui:canvas.add.regional}}** | Uma camada que define um prompt diferente para cada lugar (veja [Orientação regional](#orientação-regional)). |
| **{{ui:canvas.add.globalRef}}** | Uma imagem de referência para imitar o clima da imagem inteira. É o mesmo que a imagem de referência da aba de geração. |

Na lista de camadas, é possível fazer o seguinte:

- O ícone de olho alterna entre mostrar e ocultar, e o ícone de cadeado alterna o bloqueio. Uma camada oculta não é usada na geração. Numa camada bloqueada não se pode desenhar.
- Com duplo clique no nome, o nome pode ser mudado.
- Com o botão direito, é possível duplicar, reordenar (mover para frente ou para trás; camadas do mesmo tipo também podem ser reordenadas arrastando na lista), **{{ui:canvas.entityMenu.flipHorizontal}}**, **{{ui:canvas.entityMenu.flipVertical}}**, **{{ui:canvas.entityMenu.rotateRight}}**, **{{ui:canvas.entityMenu.rotateLeft}}**, **{{ui:canvas.entityMenu.scaleUp}}**, **{{ui:canvas.entityMenu.scaleDown}}**, **{{ui:canvas.pose.random}}** (só em camadas de controle), converter para outro tipo, copiar para a área de transferência, **{{ui:canvas.entityMenu.saveToGallery}}**, **{{ui:canvas.entityMenu.exportToFile}}** e excluir.
- Em **{{ui:canvas.layers.more}}** (“…”), também é possível reunir em uma só as camadas raster visíveis e excluir todas as camadas.

![O menu do botão direito numa camada](shot:canvas-layer-menu)

Abaixo da camada selecionada, abrem-se as configurações dela.

- {{ui:canvas.add.inpaint}}: a cor da máscara e o padrão do preenchimento (só a aparência na tela) e **{{ui:canvas.mask.denoiseLimit}}** (ativado e reduzido, facilita manter a imagem original mesmo dentro da máscara). Com **{{ui:canvas.entityMenu.invertMask}}**, no botão direito, troca-se a parte mascarada pela parte livre dentro da área de geração. Com **{{ui:canvas.partFix.redraw}}**, **{{ui:canvas.partFix.erase}}** e **{{ui:canvas.partFix.cutOutAction}}**, a parte pintada pode ser redesenhada por uma instrução em texto, apagada ou recortada ([Selecionar uma região e corrigi-la](04-improve.md)).
- {{ui:canvas.add.control}}: veja o item “{{ui:canvas.add.control}}”, mais adiante.

## Como a imagem é refeita

Ao clicar em **{{ui:params.invoke.invoke}}** na tela de desenho, o app olha o interior da área de geração e decide sozinho como criar a imagem. Você não precisa escolher.

| Estado do interior da área de geração | Como é criada |
|---|---|
| Nada está desenhado nas camadas raster visíveis | Cria do zero a partir de texto (texto para imagem). |
| Numa camada raster, só uma parte está preenchida | Completa e expande a parte vazia (outpaint). A parte vazia é antes preenchida com cor. |
| Tudo está preenchido e a máscara de inpaint não tem pintura | Redesenha usando a imagem atual como base (imagem para imagem). |
| Tudo está preenchido e a máscara de inpaint tem pintura | Redesenha só a parte da máscara (inpaint). Fora da máscara, fica a imagem original. |

O quanto muda na imagem para imagem é definido por **{{ui:params.image.strength}}**, no painel esquerdo. Com 0, fica como o original; com 1, redesenha por completo.

Com o que preencher a parte vazia no outpaint, escolha em **{{ui:params.compositing.infillTitle}}**, dentro de **{{ui:params.compositing.title}}**, no painel esquerdo. Com **{{ui:params.compositing.infill.color}}**, preenche com a cor escolhida (preto, branco, cinza etc.). Com as demais opções, preenche misturando as cores do entorno. O quanto a emenda é esfumada é definido por **{{ui:params.compositing.maskBlur}}**.

> O inpaint pode ser usado com modelos comuns, do jeito que são. Não é preciso um “modelo para inpaint” específico.

## Decidir se o resultado será aceito (preparação)

A imagem criada na tela de desenho não entra logo na tela. Ela é exibida sobre a área de geração, e a barra de baixo (**{{ui:canvas.staging.title}}**) serve para decidir se será aceita.

| Botão | O que faz |
|---|---|
| Setas esquerda e direita (`←` `→`) | Quando foram criadas várias imagens, mostram a próxima ou a anterior. Enquanto ainda está sendo criada, a última página é a página “gerando”, e o andamento aparece só nessa página. Enquanto você olha a página de uma imagem pronta, a exibição não muda quando a seguinte fica pronta. |
| **{{ui:canvas.staging.accept}}** (`Enter`) | Coloca esta imagem na tela como uma nova camada raster. As demais são descartadas. |
| **{{ui:canvas.staging.hideResults}}** | Oculta os resultados para comparar com a imagem original. |
| **{{ui:canvas.staging.saveToGallery}}** | Salva esta imagem na galeria. |
| **{{ui:canvas.staging.discard}}** | Descarta só esta imagem. |
| **{{ui:canvas.staging.discardAll}}** (`Esc`) | Descarta todas. |

> A imagem do resultado, do jeito que está, não aparece na galeria. Para deixar uma imagem na galeria, clique antes em **{{ui:canvas.staging.saveToGallery}}**. As imagens descartadas desaparecem.

A alça na ponta esquerda da barra de resultados (⋮⋮) serve para arrastar a imagem e entregá-la a outro lugar.

## Camada de controle

A camada de controle é a pista que diz “desenhe seguindo esta forma, esta linha, esta pose”. Nela se colocam desenhos de linhas, contornos, poses etc.

Para usá-la, é preciso um modelo ControlNet que combine com o modelo principal. Como instalar está no capítulo [Modelos](08-models.md). Selecione a camada e escolha **{{ui:common.model}}** nas configurações. Sem modelo, aparece no campo de geração algo como “A camada de controle 1 não tem modelo”, e não é possível criar.

As configurações são estas:

- **{{ui:canvas.control.weight}}**: a intensidade com que a pista é seguida.
- **{{ui:canvas.control.begin}}** e **{{ui:canvas.control.end}}**: de que ponto a que ponto da geração, em proporção, o efeito age.
- **{{ui:canvas.control.controlMode}}**: há **{{ui:canvas.control.mode.balanced}}** e **{{ui:canvas.control.mode.moreControl}}**. **{{ui:canvas.control.mode.morePrompt}}** funciona, por enquanto, do mesmo modo que **{{ui:canvas.control.mode.balanced}}**.
- **{{ui:canvas.control.filter}}**: converte a imagem em uma imagem de pista, de linhas, profundidade etc. É uma conversão simples, feita dentro do app. Teste com **{{ui:canvas.control.process}}** e, se estiver bom, aplique à imagem com **{{ui:common.apply}}**.

## Criar uma pose (boneco de palitos)

![A caixa de diálogo para definir a pose com um boneco de palitos](shot:pose)

Movendo um boneco de palitos, é possível definir a pose. É útil quando indicar a pose por texto não dá certo.

1. Na aba **{{ui:app.tabs.canvas}}**, clique em **+** ({{ui:common.add}}), nas camadas, e escolha **{{ui:pose.menu}}**.
2. Escolha em **{{ui:pose.preset}}** uma pose parecida ({{ui:pose.preset.standing}}, {{ui:pose.preset.armsUp}}, {{ui:pose.preset.sitting}}, {{ui:pose.preset.walking}}).
3. Arraste os círculos das articulações para mudar a postura. Também é possível selecionar um círculo e movê-lo com as teclas de seta (com `Shift`, ele se move mais). **{{ui:pose.mirror}}** inverte esquerda e direita, e **{{ui:pose.reset}}** volta ao modelo inicial.
4. Escolha **{{ui:pose.size}}**. Normalmente o tamanho da tela serve.
5. Clique em **{{ui:pose.use}}**.

A pose entra na tela como uma camada de controle. Se a tela estiver vazia, ela começa do zero com esse tamanho.

Para usá-la, é preciso um modelo ControlNet compatível com OpenPose. Se estiver instalado, o app o escolhe sozinho como modelo da camada. Se não estiver, uma notificação avisa. Instale o modelo e então escolha-o nas configurações da camada.

> Só é possível definir a pose de uma pessoa. Como não se definem os dedos das mãos nem a direção do rosto, especifique o rosto e as mãos no prompt.

> O efeito da pose é determinado por **{{ui:canvas.control.weight}}**, na camada. A camada de pose já vem configurada com a intensidade máxima e agindo do começo ao fim. Para dar mais liberdade à pose, reduza.

### Criar uma pose na tela

![Um boneco de palitos colocado na tela com a ferramenta de pose](shot:canvas-pose)

Com a ferramenta **{{ui:canvas.tool.pose}}** (`O`), a pose pode ser criada diretamente na tela. A pose colocada pode ser corrigida depois, quantas vezes for preciso.

- Clicando num lugar vazio, é colocado um boneco de palitos em pé. Se nenhuma camada de controle estiver selecionada, uma nova é criada, com a intensidade para pose e, se estiver instalado, o modelo compatível com OpenPose.
- Ao arrastar o círculo de uma articulação, ela gira junto com os membros que vêm depois (o comprimento dos ossos não muda). Ao arrastar o pescoço, o corpo todo se move. Arrastando com `Shift`, só aquela articulação se move.
- Clicando numa articulação com `Alt`, é possível escondê-la ou mostrá-la de novo (para membros que saem da tela, por exemplo).
- Com a tecla `R` ou o botão **{{ui:canvas.pose.random}}** da barra, a pose da camada selecionada muda para uma nova pose aleatória. Dá para clicar quantas vezes quiser, até gostar.
- Com o número e o botão de raio da barra da ferramenta de pose, são geradas em sequência tantas imagens quanto o número, mudando a pose (no máximo 16). Como a seed também muda a cada pose, aparecem lado a lado imagens com posturas variadas e as mesmas configurações. Se não for possível gerar, o motivo é exibido e nada começa.
- Numa camada cabem quantas pessoas se quiser. Inverter, girar, ampliar e reduzir são feitos pelo menu do botão direito da camada.
- Também é possível pedir por texto. Com a aba **{{ui:app.tabs.canvas}}** aberta, abra o assistente de IA e diga algo como “uma pose correndo” ou “levante a mão esquerda”, e o boneco de palitos é colocado (até 4 pessoas). Depois de colocado, dizer “um pouco mais curvado para a frente” faz ele corrigir a pose. A pose pedida é uma suposição a partir das palavras; se não ficar como esperado, arraste as articulações para corrigir.
- Também é possível criar a partir de pessoas que aparecem numa imagem. Clique com o botão direito numa imagem da galeria e escolha **{{ui:canvas.poseFromImage.menu}}**: o esqueleto das pessoas que aparecem é lido na hora, e a faixa do visualizador mostra quantas pessoas foram encontradas. Ao clicar em **{{ui:canvas.poseFromImage.replace}}** ou **{{ui:canvas.poseFromImage.add}}**, elas são colocadas na tela como bonecos de palitos (até 4 pessoas). O botão de mesmo nome na barra da ferramenta de pose usa a imagem selecionada na galeria e, se nenhuma estiver selecionada, abre a tela para escolher um arquivo de imagem. A pose colocada pode ser corrigida como uma pose comum. Para usar, é preciso uma extensão (comfyui_controlnet_aux); se ela não estiver instalada, a faixa orienta a instalação. Na primeira leitura, leva tempo por causa do download do modelo. Se a pessoa for pequena demais ou estiver escondida, pode não ser encontrada.
- Ao clicar no botão **{{ui:canvas.pose.presets}}** da barra da ferramenta de pose, abre-se uma tela com as categorias à esquerda e os cartões de pose à direita. Nos cartões, há bonecos de palitos OpenPose desenhados dentro da moldura da área de geração. “{{ui:canvas.pose.group.panel}}” (plano fechado e plano aberto, duas pessoas, três ou mais, cena do dia a dia, drama e emoção) já define a posição e o tamanho das pessoas, e, ao escolher, substitui todas as poses da camada. “{{ui:canvas.pose.group.standard}}” e “{{ui:canvas.pose.group.manga}}” substituem a primeira pose da camada selecionada, mantendo a posição e o tamanho. Se não houver pose, uma nova é colocada. Se, ao levantar um braço ou chutar para cima, a pose sair da moldura, ela é reduzida até caber.
- Com o botão **{{ui:canvas.pose3d.menu}}** da barra da ferramenta de pose, é possível editar a pose em 3D (a primeira pose da camada de controle selecionada; se não houver, começa com um boneco em pé). Ao arrastar uma articulação, ela se move mantendo o comprimento dos ossos. Também é possível virá-la para o fundo ou para a frente. Arrastando o fundo, muda-se a direção do corpo, e a roda amplia e reduz. Os botões **{{ui:canvas.pose3d.front}}**, **{{ui:canvas.pose3d.side}}**, **{{ui:canvas.pose3d.back}}** e **{{ui:canvas.pose3d.top}}** colocam numa direção fixa. Ao clicar em **{{ui:canvas.pose3d.apply}}**, a forma vista na direção atual entra na tela como pose (a profundidade também fica memorizada, então dá para abrir de novo em 3D e girar); se fechar sem clicar, tudo fica como estava. A exibição em 3D exige WebGL do navegador; em ambientes em que não pode ser usado, isso é informado.

![A faixa para conferir, antes de colocar na tela, a pose lida a partir de uma imagem](shot:canvas-pose-from-image)

![A tela “Poses e composições clássicas”. A categoria “Duas pessoas” está selecionada](shot:canvas-pose-presets)

![A caixa de diálogo para editar a pose em 3D](shot:canvas-pose-3d)

Para extrair a pose de uma foto, pode-se usar o modelo “{{ui:workflows.templates.poseControl.title}}” de [Fluxos de trabalho](06-upscaling-workflows.md).

## Orientação regional

A camada de **{{ui:canvas.add.regional}}** define um prompt que só age nos lugares em que foi pintada. Pinte a região e, nas configurações da camada, acrescente um prompt positivo (o que desenhar ali) ou um prompt negativo (o que não se quer ali). O prompt da imagem inteira continua agindo em tudo como antes, e o prompt da camada é somado dentro da região. Ativando **Negativo automático**, o prompt positivo da camada é suprimido fora da região, de modo que um “chapéu vermelho” apareça só no lugar desejado.

- Uma camada sem pintura dentro da área de geração ou sem prompt não define nada e, por isso, não é usada.
- No máximo 8 podem ser usadas ao mesmo tempo. Camadas ocultas não são usadas.
- A orientação regional funciona com modelos SD1.X e SDXL. Com famílias mais novas (Flux, Qwen-Image etc.), a geração falha e isso é exibido. Nesse caso, oculte a camada.
- Imagens de referência acrescentadas a uma camada regional ainda não são usadas.

## Salvar e limpar

- Para salvar na galeria a imagem da tela, clique em **{{ui:canvas.toolbar.saveToGallery}}** (ícone de disco), na barra de cima. As camadas raster visíveis dentro da área de geração são reunidas e salvas como uma única imagem.
- Para gerar um arquivo PSD mantendo as camadas separadas, clique em **{{ui:canvas.toolbar.savePsd}}** (ícone de documento com seta para baixo). O interior da área de geração é salvo como um download do navegador. As camadas raster viram uma a uma camadas do PSD, mantendo nome, posição, opacidade e visibilidade. As camadas de controle entram como camadas ocultas, e as máscaras de inpaint e a orientação regional não entram.
- Para salvar só uma camada, clique nela com o botão direito e escolha **{{ui:canvas.entityMenu.saveToGallery}}**.
- Em **{{ui:canvas.settings.title}}** também há **{{ui:canvas.actions.clearCanvas}}**, **{{ui:canvas.actions.clearHistory}}** e **{{ui:canvas.actions.clearStaging}}**. **{{ui:canvas.actions.clearCanvas}}** apaga todas as camadas.

Os recursos de correção de imagem também estão em [Corrigir e reutilizar imagens](04-improve.md). “{{ui:gallery.menu.segment}}” abre a imagem na tela e permite redesenhar, apagar ou recortar a parte pintada.
