# Tela

![Visão geral da aba Tela. No centro fica a tela e, abaixo à direita, a lista de camadas](shot:canvas)

A aba **{{ui:app.tabs.canvas}}** é uma bancada para desenhar, posicionar e refazer apenas uma parte de uma imagem. É possível colocar uma imagem e expandi-la, aplicar uma máscara sobre a área que será refeita ou definir uma pose com um boneco de palitos.

A tela se divide em 3 partes.

- Esquerda: o painel com as mesmas configurações da aba Gerar (prompt, modelo, tamanho etc.). Na tela, o item **{{ui:params.compositing.title}}** é acrescentado.
- Centro: a tela. Os botões de ferramentas ficam na parte superior.
- Direita: a lista de **{{ui:canvas.layers.title}}**, que guardam as imagens.

Se **{{ui:params.invoke.invoke}}** for pressionado com a tela vazia, uma imagem comum é criada dentro da moldura pontilhada (a área de geração). O ponto forte da tela aparece quando se coloca ali uma imagem ou um esboço. As camadas e as máscaras são salvas automaticamente e voltam quando o app é aberto de novo (o histórico de desfazer não é salvo).

## Colocar e desenhar imagens

Há várias maneiras de colocar uma imagem na tela.

- Desenhar com o pincel. Se nenhuma camada estiver selecionada, uma “{{ui:canvas.add.raster}}” é criada automaticamente.
- Arrastar uma imagem da galeria para a tela. Aparece uma moldura para escolher o destino (raster, controle, máscara de inpaint etc.); solte a imagem nela.
- `Ctrl+V` cola a imagem da área de transferência como uma nova camada raster (ela também é salva na galeria).
- Clicar com o botão direito em uma imagem da galeria (no visualizador, o ícone de pincel) e escolher o destino em **{{ui:gallery.menu.sendToCanvas}}**.

Os destinos são os seguintes.

| Destino | O que se torna |
|---|---|
| **{{ui:gallery.canvas.newCanvasRaster}}** | Esvazia a tela e começa com o mesmo tamanho dessa imagem. |
| **{{ui:gallery.canvas.newCanvasControl}}** | Também começa do zero, mas a imagem se torna uma camada de controle. |
| **{{ui:gallery.canvas.raster}}** | Acrescenta à tela atual como camada raster. |
| **{{ui:gallery.canvas.control}}** | Acrescenta como camada de controle. |
| **{{ui:gallery.canvas.inpaint}}** | Acrescenta como máscara de inpaint. |
| **{{ui:gallery.canvas.regional}}** | Acrescenta como imagem de referência da orientação regional (veja [A orientação regional ainda não pode ser usada](#a-orientação-regional-ainda-não-pode-ser-usada)). |

## Ferramentas

As ferramentas ficam na barra superior. Também é possível alternar entre elas com as teclas de letra do teclado.

| Ferramenta | Tecla | Para que serve |
|---|---|---|
| **{{ui:canvas.tool.brush}}** | `B` | Desenha. A cor é alterada no botão de cor da barra. |
| **{{ui:canvas.tool.eraser}}** | `E` | Apaga o que foi desenhado. |
| **{{ui:canvas.tool.mosaic}}** | `M` | Aplica mosaico por onde se passa (para esconder algo). A granulação é alterada pelo número na barra. Só atua em camadas que tenham imagem. |
| **{{ui:canvas.tool.rect}}** | `U` | Preenche um retângulo. |
| **{{ui:canvas.tool.lasso}}** | `L` | Desenha uma forma livre e a preenche com a cor (em uma máscara, ela fica mascarada). |
| **{{ui:canvas.tool.pose}}** | `O` | Coloca uma pose de boneco de palitos em uma camada de controle e permite mover as articulações (veja “Criar uma pose na tela” abaixo). |
| **{{ui:canvas.tool.move}}** | `V` | Move a camada. As setas deslocam a camada selecionada 1 px (10 px com Shift). |
| **{{ui:canvas.tool.bbox}}** | `C` | Move ou redimensiona a área de geração (caixa delimitadora). |
| **{{ui:canvas.tool.view}}** | `H` | Desloca a visualização. |
| **{{ui:canvas.tool.colorPicker}}** | `I` | Captura uma cor da imagem. |

Também é possível fazer o seguinte.

- A espessura do pincel é alterada em **{{ui:canvas.toolbar.brushWidth}}**, na barra, ou com as teclas `[` e `]`. A tecla `Q` alterna com a ferramenta usada anteriormente.
- Para ampliar ou reduzir, use a roda do mouse ou as teclas `+` e `-`. `Ctrl+0` mostra tudo e `Ctrl+1` mostra o tamanho real (100%).
- Para deslocar a visualização, arraste mantendo `Space` pressionada ou mantendo pressionado o botão da roda.
- **{{ui:canvas.toolbar.undo}}** (`Ctrl+Z`) e **{{ui:canvas.toolbar.redo}}** (`Ctrl+Shift+Z`) desfazem e refazem o que foi desenhado.

A engrenagem **{{ui:canvas.settings.title}}** reúne opções como exibir a grade, escurecer a parte externa à área de geração, restringir os traços à área de geração e mesclar as camadas raster visíveis em uma só.

## Área de geração (caixa delimitadora)

A moldura pontilhada na tela é “a área em que a imagem será criada desta vez”. A cada geração, apenas o interior dessa moldura é criado, e o tamanho dela passa a ser o tamanho da imagem.

- Mude para **{{ui:canvas.tool.bbox}}** (`C`) e arraste a moldura para movê-la. Arrastando um canto ou uma borda, o tamanho muda.
- O tamanho também pode ser definido em **{{ui:params.image.bboxWidth}}** e **{{ui:params.image.bboxHeight}}**, no painel esquerdo.
- **{{ui:canvas.actions.fitBboxToLayers}}** (`Shift+C`) ajusta a moldura às imagens colocadas.

## Camadas

Em **{{ui:canvas.layers.title}}**, abaixo à direita, aparece a lista do que foi colocado na tela. Use o botão **{{ui:common.add}}** para acrescentar.

![O menu “Adicionar” das camadas aberto](shot:canvas-add-layer)

Há tipos de camada com funções diferentes.

| Tipo | Função |
|---|---|
| **{{ui:canvas.add.raster}}** | A camada de imagem comum. Nela se desenha e se colocam imagens. O que está aqui se torna a “imagem original”. |
| **{{ui:canvas.add.control}}** | Uma imagem usada como pista de forma, linha, pose etc. Serve de instrução para a geração e não entra no conteúdo da imagem. |
| **{{ui:canvas.add.inpaint}}** | Define, pintando, a área que será refeita. |
| **{{ui:canvas.add.regional}}** | Uma camada para dar prompts diferentes a cada região. Na versão atual para desktop, não pode ser usada na geração. |
| **{{ui:canvas.add.globalRef}}** | Uma imagem de referência para imitar o clima geral da imagem. É a mesma imagem de referência da aba Gerar. |

Na lista de camadas, é possível fazer o seguinte.

- O ícone de olho alterna entre exibir e ocultar, e o ícone de cadeado alterna o bloqueio. Camadas ocultas não são usadas na geração. Não se pode desenhar em camadas bloqueadas.
- Clique duas vezes no nome para renomear.
- Com o botão direito, é possível duplicar, reordenar (mover para frente ou para trás; camadas do mesmo tipo também podem ser arrastadas dentro da lista), **{{ui:canvas.entityMenu.flipHorizontal}}**, **{{ui:canvas.entityMenu.flipVertical}}**, **{{ui:canvas.entityMenu.rotateRight}}**, **{{ui:canvas.entityMenu.rotateLeft}}**, **{{ui:canvas.entityMenu.scaleUp}}**, **{{ui:canvas.entityMenu.scaleDown}}**, **{{ui:canvas.pose.random}}** (somente em camadas de controle), converter para outro tipo, copiar para a área de transferência, usar **{{ui:canvas.entityMenu.saveToGallery}}**, **{{ui:canvas.entityMenu.exportToFile}}** e excluir.
- Em **{{ui:canvas.layers.more}}** (“…”), também é possível mesclar as camadas raster visíveis em uma só ou excluir todas as camadas.

![O menu de contexto de uma camada](shot:canvas-layer-menu)

Abaixo da camada selecionada, abrem-se as configurações dela.

- {{ui:canvas.add.inpaint}}: a cor e o padrão de preenchimento da máscara (apenas a aparência na tela) e **{{ui:canvas.mask.denoiseLimit}}** (ao ativar e diminuir o valor, fica mais fácil manter a imagem original mesmo dentro da máscara). No menu de botão direito da máscara, **{{ui:canvas.entityMenu.invertMask}}** troca as áreas mascaradas e livres dentro da área de geração.
- {{ui:canvas.add.control}}: veja a seção “{{ui:canvas.add.control}}” abaixo.

## Como a imagem é refeita

Ao pressionar **{{ui:params.invoke.invoke}}** na tela, o app examina o interior da área de geração e decide automaticamente como criar a imagem. Não é preciso escolher.

| Estado do interior da área de geração | Como é criada |
|---|---|
| Nada foi desenhado nas camadas raster visíveis | Cria uma imagem nova a partir do texto (texto para imagem). |
| Nas camadas raster, apenas uma parte está preenchida | Completa e expande a parte vazia (outpaint). A parte vazia é preenchida antes com uma cor. |
| Tudo está preenchido e a máscara de inpaint não tem pintura | Refaz a imagem atual usando-a como base (imagem para imagem). |
| Tudo está preenchido e a máscara de inpaint tem pintura | Refaz apenas a parte da máscara (inpaint). O que está fora da máscara permanece como a imagem original. |

Na imagem para imagem, o grau de mudança é definido em **{{ui:params.image.strength}}**, no painel esquerdo. Com 0, a imagem permanece igual; com 1, é totalmente refeita.

No outpaint, o que preenche a parte vazia é escolhido em **{{ui:params.compositing.infillTitle}}**, dentro de **{{ui:params.compositing.title}}**, no painel esquerdo. Com **{{ui:params.compositing.infill.color}}**, o preenchimento usa a cor escolhida (preto, branco, cinza etc.). Com as outras opções, o preenchimento mistura as cores do entorno. O quanto a emenda é suavizada é definido em **{{ui:params.compositing.maskBlur}}**.

> O inpaint funciona direto com modelos comuns. Não é preciso um “modelo de inpaint” dedicado.

## Decidir se o resultado será aceito (preparação)

A imagem criada na tela não entra nela imediatamente. Ela é exibida sobre a área de geração, e a barra inferior (**{{ui:canvas.staging.title}}**) serve para decidir se será aceita.

| Botão | O que faz |
|---|---|
| Setas esquerda e direita (`←` `→`) | Ao criar várias imagens, mostram a próxima ou a anterior. |
| **{{ui:canvas.staging.accept}}** (`Enter`) | Coloca esta imagem na tela como uma nova camada raster. As demais são descartadas. |
| **{{ui:canvas.staging.hideResults}}** | Oculta os resultados para comparar com a imagem original. |
| **{{ui:canvas.staging.saveToGallery}}** | Salva esta imagem na galeria. |
| **{{ui:canvas.staging.discard}}** | Descarta apenas esta imagem. |
| **{{ui:canvas.staging.discardAll}}** (`Esc`) | Descarta todas. |

> A imagem do resultado não aparece na galeria por si só. Para manter uma imagem na galeria, pressione antes **{{ui:canvas.staging.saveToGallery}}**. As imagens descartadas são perdidas.

A alça (⋮⋮) na extremidade esquerda da barra de resultado serve para arrastar a imagem para outro lugar.

## Camada de controle

A camada de controle é uma pista que diz “desenhe seguindo esta forma, esta linha ou esta pose”. Nela se colocam desenhos de linhas, contornos, poses etc.

Para usá-la, é preciso um modelo ControlNet compatível com o modelo principal. Para saber como instalar, veja o capítulo [Modelos](08-models.md). Selecione a camada e escolha o **{{ui:common.model}}** nas configurações. Sem modelo, a geração mostra mensagens como “A camada de controle 1 não tem modelo selecionado” e não pode ser feita.

As configurações são as seguintes.

- **{{ui:canvas.control.weight}}**: a intensidade com que a pista é seguida.
- **{{ui:canvas.control.begin}}** e **{{ui:canvas.control.end}}**: de que ponto a que ponto da geração (em porcentagem) a pista age.
- **{{ui:canvas.control.controlMode}}**: há **{{ui:canvas.control.mode.balanced}}** e **{{ui:canvas.control.mode.moreControl}}**. **{{ui:canvas.control.mode.morePrompt}}** tem, por ora, o mesmo comportamento de **{{ui:canvas.control.mode.balanced}}**.
- **{{ui:canvas.control.filter}}**: converte a imagem em uma imagem de pista, como linhas ou profundidade. É uma conversão simples feita dentro do app. Teste com **{{ui:canvas.control.process}}** e, se ficar bom, aplique à imagem com **{{ui:common.apply}}**.

## Criar uma pose (boneco de palitos)

![Diálogo para definir a pose com um boneco de palitos](shot:pose)

É possível mover um boneco de palitos para definir a pose. É útil quando descrever a pose em texto não funciona bem.

1. Na aba **{{ui:app.tabs.canvas}}**, pressione **{{ui:common.add}}** nas camadas e escolha **{{ui:pose.menu}}**.
2. Em **{{ui:pose.preset}}**, escolha uma pose próxima ({{ui:pose.preset.standing}}, {{ui:pose.preset.armsUp}}, {{ui:pose.preset.sitting}}, {{ui:pose.preset.walking}}).
3. Arraste os círculos das articulações para mudar a postura. Também é possível selecionar um círculo e movê-lo com as setas do teclado (com `Shift`, o movimento é maior). **{{ui:pose.mirror}}** inverte esquerda e direita, e **{{ui:pose.reset}}** volta ao modelo inicial.
4. Escolha **{{ui:pose.size}}**. Normalmente, o tamanho da tela serve.
5. Pressione **{{ui:pose.use}}**.

A pose entra na tela como uma camada de controle. Se a tela estiver vazia, ela começa do zero com esse tamanho.

Para usá-la, é preciso um modelo ControlNet compatível com OpenPose. Se estiver instalado, o app o escolhe automaticamente como modelo da camada. Se não estiver, uma notificação avisa. Instale o modelo e depois escolha-o nas configurações da camada.

> Só é possível definir a pose de uma pessoa. Não é possível definir os dedos das mãos nem a direção do rosto; por isso, especifique o rosto e as mãos no prompt.

> A força da pose é definida pelo **{{ui:canvas.control.weight}}** da camada. A camada de pose já vem configurada com a intensidade máxima, atuando do início ao fim. Para dar mais liberdade à pose, diminua o valor.

### Criar uma pose na tela

![O boneco de palitos colocado na tela com a ferramenta de pose](shot:canvas-pose)

Com a ferramenta **{{ui:canvas.tool.pose}}** (`O`), é possível criar uma pose diretamente na tela. Uma pose colocada pode ser corrigida depois quantas vezes quiser.

- Ao clicar em um lugar vazio, um boneco de palitos em pé é colocado. Se nenhuma camada de controle estiver selecionada, uma nova camada de controle é criada, com a intensidade para poses e um modelo compatível com OpenPose (se estiver instalado).
- Ao arrastar o círculo de uma articulação, ela gira junto com os membros que vêm depois dela (o comprimento dos ossos não muda). Ao arrastar o pescoço, o corpo inteiro se move. Arrastando com `Shift` pressionada, só essa articulação se move.
- Ao clicar em uma articulação com `Alt` pressionada, ela é ocultada ou exibida de novo (para membros que saem da tela, por exemplo).
- A tecla `R` ou o botão **{{ui:canvas.pose.random}}** da barra troca a pose da camada selecionada por uma nova pose aleatória. É possível pressionar quantas vezes quiser, então dá para tentar até gostar de uma.
- Com os botões de número e de raio na barra da ferramenta de pose, é possível gerar em sequência essa quantidade de imagens, trocando a pose a cada uma (até 16). A seed também muda a cada pose, então as mesmas configurações resultam em imagens com várias posturas. Se não for possível gerar, o motivo é exibido e nada começa.
- Em uma camada, é possível colocar quantas figuras quiser. Inverter na horizontal, girar e ampliar ou reduzir são feitos pelo menu de clique direito da camada.
- Também é possível pedir com palavras. Com a aba **{{ui:app.tabs.canvas}}** aberta, abra o assistente de IA e descreva, por exemplo, “uma pose correndo” ou “levante a mão esquerda”, e uma figura é colocada (até 4 figuras). Depois, se você disser “incline um pouco mais para a frente”, ele corrige essa pose. A pose pedida é um palpite a partir das suas palavras; se não for o que você queria, arraste as articulações para corrigi-la.
- Também é possível criar a partir de uma pessoa em uma imagem. Clique com o botão direito em uma imagem da galeria e escolha **{{ui:canvas.poseFromImage.menu}}**, ou pressione o botão de mesmo nome na barra da ferramenta de pose: os esqueletos das pessoas são lidos e colocados como bonecos (até 4 pessoas). As poses colocadas podem ser corrigidas como qualquer outra. É necessária a extensão (comfyui_controlnet_aux); se ela faltar, a janela oferece instalá-la. Na primeira vez, o download dos modelos demora um pouco. Uma pessoa pequena demais ou parcialmente escondida pode não ser encontrada.
- O botão **{{ui:canvas.pose.presets}}** da barra da ferramenta de pose abre uma janela com as categorias à esquerda e um cartão para cada pose à direita. Cada cartão desenha a figura do OpenPose dentro de uma moldura com a forma da caixa de geração. As “{{ui:canvas.pose.group.panel}}” (perto e longe, duas pessoas, grupos, cenas do dia a dia, drama e emoções) também definem onde as pessoas ficam e o tamanho delas, e substituem todas as poses da camada selecionada. As “{{ui:canvas.pose.group.standard}}” e a “{{ui:canvas.pose.group.manga}}” substituem a primeira pose da camada selecionada, no mesmo lugar e tamanho; se não houver nenhuma, uma nova é colocada. Uma pose que sairia da caixa, com os braços erguidos ou um chute, é reduzida para caber.
- O botão **{{ui:canvas.pose3d.menu}}** da barra da ferramenta de pose edita uma pose em 3D (a primeira pose da camada de controle selecionada, ou um boneco em pé se não houver). Ao arrastar uma articulação, ela se move com o comprimento do osso mantido, e um osso pode apontar para dentro ou para você. Arrastar o fundo gira o corpo e a roda aproxima ou afasta. Os botões **{{ui:canvas.pose3d.front}}**, **{{ui:canvas.pose3d.side}}**, **{{ui:canvas.pose3d.back}}** e **{{ui:canvas.pose3d.top}}** giram para vistas fixas. **{{ui:canvas.pose3d.apply}}** coloca na tela a forma que você vê agora como pose (a profundidade é lembrada, então dá para abrir de novo em 3D e girar mais); fechar sem aplicar deixa a pose como estava. A visualização 3D precisa de WebGL no navegador; se faltar, a janela avisa.

![Leitura das poses de uma imagem antes de colocá-las na tela](shot:canvas-pose-from-image)

![A janela “Poses e composições prontas” com a categoria “Duas pessoas” escolhida](shot:canvas-pose-presets)

![A janela para editar uma pose em 3D](shot:canvas-pose-3d)

Para extrair a pose de uma foto, é possível usar o template “{{ui:workflows.templates.poseControl.title}}” em [Fluxos de trabalho](06-upscaling-workflows.md).

## A orientação regional ainda não pode ser usada

**{{ui:canvas.add.regional}}** está disponível na tela, mas, na versão atual para desktop, não pode ser usada na geração. Se houver uma camada de orientação regional com pintura, a geração é recusada e aparece uma mensagem de falha (em inglês). Ao gerar na tela, oculte ou exclua as camadas de orientação regional.

## Salvar e limpar

- Para salvar a imagem da tela na galeria, pressione **{{ui:canvas.toolbar.saveToGallery}}** (o ícone de disco) na barra superior. As camadas raster visíveis dentro da área de geração são mescladas e salvas como uma única imagem.
- Para salvar apenas uma camada, clique nela com o botão direito e escolha **{{ui:canvas.entityMenu.saveToGallery}}**.
- Em **{{ui:canvas.settings.title}}** também há **{{ui:canvas.actions.clearCanvas}}**, **{{ui:canvas.actions.clearHistory}}** e **{{ui:canvas.actions.clearStaging}}**. **{{ui:canvas.actions.clearCanvas}}** apaga todas as camadas.

Também há recursos de correção de imagens em [Corrigir e reaproveitar imagens](04-improve.md). O resultado de “{{ui:gallery.menu.segment}}” pode ser enviado à tela para ser refeito de novo.
