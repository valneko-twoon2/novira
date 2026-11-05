# Quadrinho

![A aba Quadrinho inteira. À esquerda, as mesmas configurações da geração; no centro, a tela de um quadrinho vazio](shot:comic)

**{{ui:app.tabs.comic}}** é a bancada para criar páginas de quadrinho. Ela se abre com o ícone mais à direita (o do livro) entre os ícones alinhados no alto do painel esquerdo da aba **{{ui:app.tabs.generate}}** (a tecla `1` abre o que foi usado por último). O quadrinho é organizado em “projetos”. Dentro do projeto ficam as “páginas”; cada página é dividida em “quadros”, e você desenha uma imagem em cada quadro. Além da imagem desenhada, um quadro também pode receber imagens da galeria e poses. Com balões e narrações posicionados, a página pode ser salva como uma única imagem.

A tela é dividida em 3 partes.

- Esquerda: no alto fica a fileira de ícones de imagem, vídeo etc. (o da extremidade direita é {{ui:app.tabs.comic}}); abaixo dela ficam, de cima para baixo, {{ui:presets.label}} e {{ui:params.seed.label}}, iguais aos da aba {{ui:app.tabs.generate}}, o botão de desenhar, a lista de quadrinhos e {{ui:params.model.label}}. O botão de desenhar fica no mesmo lugar do botão de gerar das outras telas, e o menu de seta ao lado dele permite escolher entre desenhar só o quadro selecionado ou todos os quadros da página. Em seguida vem a seção **{{ui:params.prompt.title}}**, que contém o prompt do quadro selecionado. Mais abaixo ficam a seção de imagem de referência (a mesma da aba {{ui:app.tabs.generate}}, usada em todos os quadros do quadrinho) e as configurações detalhadas de geração. Pressionar o título de uma configuração abre ou fecha essa seção.
- Centro: a {{ui:app.views.comic}}. A fileira de ferramentas acima dela traz as configurações da página, os modelos, a ferramenta de cortar quadros, as ferramentas de quadro (balões e narrações, pose, modelos de quadro), as ferramentas de imagem, o botão de lixeira que apaga o que está selecionado e o botão que transforma a página em imagem. Abaixo da página ficam desfazer e refazer, uma miniatura de cada página e o zoom.
- Direita: as abas **{{ui:comic.side.assistant}}** e **{{ui:comic.side.gallery}}**. As imagens desenhadas nos quadros também entram na galeria.

## Criar um quadrinho

![A lista de quadrinhos no alto à esquerda. A miniatura da página 1, com o nome do quadrinho e o número de páginas](shot:comic-project)

1. Abra a lista de quadrinhos no alto à esquerda, pressione **{{ui:comic.project.new}}**, no final da lista, e dê um nome. Quando ainda não há nenhum quadrinho, também é possível criar um com **{{ui:comic.project.new}}**, no centro.
2. A página começa com 3 quadros. Para adicionar uma página, pressione **{{ui:comic.page.add}}**, abaixo da página.
3. Clique na página sobre o quadro que deseja desenhar para selecioná-lo. À esquerda, na seção **{{ui:params.prompt.title}}**, escreva a descrição da imagem desse quadro e pressione **{{ui:comic.panel.draw}}**.
4. Para desenhar todos os quadros da página em sequência, pressione a seta ao lado do botão de desenhar, escolha **{{ui:comic.page.drawAll}}** e pressione o botão de desenhar. Os quadros que têm prompt são desenhados em ordem.
5. Para desenhar todas as páginas do quadrinho, escolha **{{ui:comic.comic.drawAll}}** no mesmo menu e pressione o botão de desenhar. Os quadros com prompt de todas as páginas entram na fila de desenho, na ordem de leitura.

A lista de quadrinhos mostra a miniatura da página 1 de cada quadrinho e o número de páginas. Escolha um quadrinho na lista para abri-lo. Para renomear ou excluir um quadrinho, use o menu à direita da linha dele.

Para criar uma imagem, é preciso ter escolhido um modelo. Um quadro sem prompt não pode ser desenhado. O prompt funciona melhor escrito como tags em inglês. A imagem desenhada entra no quadro e também na galeria. Um quadro que não pôde ser desenhado mostra **{{ui:comic.draw.failed}}** na página.

## Prompts do quadro

Na aba de quadrinho, a seção **{{ui:params.prompt.title}}**, à esquerda, passa a ser o prompt do quadro selecionado. Ao selecionar outro quadro, o texto dos campos muda para o desse quadro. Cada quadro tem o seu próprio par de prompts **{{ui:params.prompt.positive}}** e **{{ui:params.prompt.negative}}**. Mesmo que você desmarque a seleção do quadro, os campos continuam com o prompt do último quadro selecionado (ou, se nenhum foi selecionado ainda, o do primeiro quadro da página), e o botão de desenhar também desenha esse quadro.

Os campos funcionam como na aba {{ui:app.tabs.generate}}. Ao carregar uma {{ui:presets.label}}, os prompts dela vão para o quadro selecionado. As palavras da **{{ui:params.promptBook.title}}** também vão para o quadro selecionado. Ao voltar para a aba {{ui:app.tabs.generate}}, os prompts que você tinha escrito na aba {{ui:app.tabs.generate}} voltam como estavam.

A imagem de um quadro é desenhada somente com o prompt desse quadro. Os prompts dos outros quadros e o prompt da aba {{ui:app.tabs.generate}} não são acrescentados.

Também é possível usar a sintaxe de prompts dinâmicos (chaves de combinação e curingas). Com **{{ui:params.prompt.modeRandom}}**, é desenhada uma imagem com a combinação escolhida pela seed dessa imagem. Com **{{ui:params.prompt.modeCombinatorial}}**, cada combinação é desenhada uma vez. A primeira combinação entra no quadro, e as imagens das demais vão para a galeria (não para o quadro). Quando há várias combinações, um aviso informa isso.

## Configurações da página

Ao pressionar **{{ui:comic.page.settings}}**, no alto do centro, abrem-se as configurações da página.

O número de quadros da página é mudado, de 1 a 24, no campo **{{ui:comic.page.panelCount}}**. Ao mudar o número, a divisão em quadros da página é refeita automaticamente. Mesmo uma página cuja forma foi alterada à mão volta à divisão automática quando o número muda.

O número de colunas da página pode ser de 1 a 3 em **{{ui:comic.page.columns}}**. Em **{{ui:comic.page.direction}}**, escolhe-se o sentido de leitura dos quadros. Como o normal em mangá é “da direita para a esquerda (mangá)”, as páginas novas começam nesse sentido. Ao mudar o sentido, a ordem dos quadros se inverte entre esquerda e direita.

Ao reduzir o número de quadros, os últimos são removidos. As imagens dos quadros removidos permanecem na galeria.

Com **{{ui:comic.effect.comic}}** e **{{ui:comic.effect.page}}**, é possível aplicar um efeito de acabamento à página inteira. Pode-se escolher **{{ui:comic.effect.mono}}**, **{{ui:comic.effect.ebook}}** (um tom acinzentado, como o de papel) ou **{{ui:comic.effect.sepia}}**. Mesmo sem escrever “monocromático” ao desenhar, depois é possível aplicar o mesmo efeito a todas as páginas. Também é possível escolher um efeito diferente para cada página. As imagens em si não mudam; o efeito vale apenas para a exibição da página e para o salvamento em imagem, PDF, CBZ e PSD.

O tamanho do original é escolhido em **{{ui:comic.page.size}}**, entre A4, A5, B4 e B5. A proporção da página passa a ser a mesma desse papel. A imagem da página salva é o tamanho do papel desenhado a 200 dpi (o A4 tem cerca de 1654 × 2339 px).

Com **{{ui:comic.page.frameWidth}}**, a espessura da moldura dos quadros pode ir de 0 mm a 3 mm (no início, 0,6 mm). Com **{{ui:comic.page.inset}}**, define-se a margem entre a moldura e a imagem, de 0 mm a 10 mm (no início, 0 mm, e a imagem fica encostada na moldura). Com **{{ui:comic.page.margin}}**, é possível acrescentar uma margem branca fora da moldura, de 0 mm a 10 mm (no início, 0 mm, e nenhuma borda branca aparece). Com **{{ui:comic.page.frameColor}}**, escolhe-se a cor da moldura (no início, preto). Todos esses valores se aplicam do mesmo modo a todos os quadros da página e, quando a página é transformada em imagem, ela é desenhada com a mesma espessura, a mesma margem e a mesma cor.

## Trocar de página e dar zoom

Abaixo da página, no centro, ficam as miniaturas de cada página. Cada miniatura mostra os quadros e as imagens da página, com o número da página no canto inferior direito. Ao pressionar uma miniatura, você passa para essa página. A miniatura da página aberta fica contornada por uma moldura. Em um quadrinho lido da direita para a esquerda (quando o sentido de leitura da página 1 é da direita), a página 1 fica na extremidade direita, como em um mangá impresso, e as páginas seguintes ficam mais à esquerda (a seta da esquerda avança para as páginas posteriores). Aparecem de uma vez só as miniaturas que cabem no espaço (no máximo 10 páginas). As páginas que não cabem podem ser vistas pressionando as setas esquerda e direita (**{{ui:comic.page.prevGroup}}**, **{{ui:comic.page.nextGroup}}**), que alternam para as miniaturas das páginas anteriores e posteriores. Trocar as miniaturas com as setas não muda a página aberta. Com **{{ui:comic.page.add}}** você acrescenta páginas, e com o botão de lixeira apaga a página aberta (pressione de novo para confirmar).

O tamanho de exibição da página é mudado com os botões **{{ui:common.zoomIn}}** e **{{ui:common.zoomOut}}**, abaixo da página, à direita. Girar a roda do mouse com Ctrl pressionado também amplia e reduz, tendo como centro a posição do ponteiro. Ao pressionar o número do zoom, ele volta a 100%.

## Modelos

![A lista de modelos de página. As divisões aparecem como pequenas figuras](shot:comic-templates)

Ao pressionar **{{ui:comic.template.pageTitle}}**, no alto do centro, abre-se a lista de modelos de página. Todos os modelos aparecem como pequenas figuras da divisão. Ao pressionar uma figura, o modelo é aplicado à página aberta.

A lista traz as divisões padrão (5 tipos: {{ui:comic.template.builtin.single}}, {{ui:comic.template.builtin.strip}}, {{ui:comic.template.builtin.four}}, {{ui:comic.template.builtin.six}} e {{ui:comic.template.builtin.nine}}), modelos de formas de quadro (10 tipos), como os cortados na diagonal e os que combinam quadros grandes e pequenos, e os modelos que você salvou. As divisões padrão são aplicadas mantendo o sentido de leitura e o tamanho do original desta página. Os modelos de formas de quadro têm a esquerda e a direita invertidas conforme o sentido de leitura desta página. Os modelos salvos usam o sentido de leitura e o tamanho do original de quando foram salvos. Quando o número de quadros diminui, o texto sob a figura muda para **{{ui:comic.template.applyAgain}}**. Ao pressionar de novo, o modelo é aplicado, e as imagens e os balões dos últimos quadros são apagados.

Para salvar a divisão desta página, digite um nome abaixo da lista e pressione **{{ui:comic.template.savePage}}**. Se o nome for deixado em branco, ele fica “Modelo” com um número. Os modelos são salvos dentro deste projeto.

Um modelo de quadro guarda o prompt, o prompt negativo, a pose e os balões do quadro selecionado. A imagem não é guardada. Na seção que se abre ao pressionar **{{ui:comic.template.panelTitle}}**, no alto do centro, dê um nome e pressione **{{ui:comic.template.save}}**. Em outro quadro, pressione **{{ui:comic.template.apply}}** na linha do modelo salvo, e ele entra nesse quadro. O que entra são o prompt, o prompt negativo, a pose e os balões. A imagem desse quadro permanece.

## Mudar a forma dos quadros

![Uma página com formas de quadro alteradas. O quadro de cima foi cortado na diagonal, e pontos de vértice aparecem nos cantos do quadro selecionado](shot:comic-shapes)

A forma dos quadros pode ser mudada mesmo com a divisão padrão. Pressione **{{ui:comic.shape.cut}}**, no alto do centro, e trace uma linha de ponta a ponta sobre o quadro que quer dividir: o quadro se divide em dois. Linhas que não dividem o quadro em dois (as que passam fora do quadro ou tocam só um canto) não o cortam.

Para acrescentar quadros, pressione **{{ui:comic.shape.addPanel}}**, ao lado de **{{ui:comic.shape.cut}}**. Os quadros existentes ficam como estão, e um quadro novo é colocado, sobreposto, perto do meio da página e selecionado. Nesse momento, a página passa a ser uma página de quadros livres (veja “Posicionar os quadros livremente”, abaixo). Não é possível acrescentar quando a página já tem 24 quadros.

Para reduzir os quadros, selecione um quadro e pressione o botão de lixeira no alto do centro (**{{ui:comic.shape.removePanel}}**) ou a tecla Delete. A imagem, o prompt e os balões desse quadro são apagados junto. Quando a página está na divisão automática, os quadros restantes são reorganizados. Em uma página cuja forma foi alterada à mão, o quadro vizinho mais próximo se expande até o lugar vago, e o conteúdo desse quadro permanece como está. Se a forma não permitir juntar com o vizinho, volta-se à divisão automática. O último quadro da página não pode ser apagado. Um quadro apagado pode ser recuperado com Ctrl+Z (a operação de colocar uma imagem de novo no quadro não é desfeita).

Para desmarcar a seleção do quadro, pressione a margem da página, uma área vazia em volta da página ou um espaço vazio da fileira de ferramentas. A tecla Esc também desmarca. Em uma página com uma imagem sobre a página inteira, pressionar a página fora dos quadros seleciona essa imagem (veja “Imagem sobre a página inteira”).

Nos cantos do quadro selecionado aparecem pontos redondos (vértices). Arrastar um vértice muda a forma do quadro. Os vértices em contato com um quadro vizinho se movem junto. Dar um clique duplo em uma aresta cria um vértice, e um clique duplo remove um vértice que esteja em linha reta. Os vértices não se movem para posições em que os quadros se sobreporiam ou as arestas se cruzariam.

No meio de cada aresta do quadro selecionado aparece uma pequena barra (a alça da aresta). Arrastar a alça move essa aresta inteira, e o quadro vizinho muda de forma junto. Ela não se move para fora da margem da página.

Em uma página cuja forma dos quadros foi alterada à mão, pressione **{{ui:comic.shape.reset}}**, em **{{ui:comic.page.settings}}**, para voltar à divisão automática. Mudar o número de quadros ou de colunas também volta à divisão automática. As mudanças de forma podem ser desfeitas com Ctrl+Z.

## Posicionar os quadros livremente

Em qualquer página, um quadro pode ser movido para onde você quiser arrastando-o por qualquer ponto (independentemente da forma, ele se move a partir do lugar em que você o pressionou). Se você apenas pressionar, sem mover, o quadro é só selecionado. Depois que um quadro é movido uma vez, a página passa a ser uma página de quadros livres. Cada quadro passa a ter uma forma independente e não compartilha arestas com os vizinhos. Os quadros podem ser sobrepostos ou deixar espaços entre si. A aparência anterior ao movimento (as posições dos quadros e os espaços brancos entre eles) permanece como estava.

Um quadro também pode sair em parte da página. A parte que sai é cortada fora da página, mas o centro do quadro permanece sobre a página. Ao passar o cursor sobre o quadro, ele vira um cursor de movimento; nos cantos, uma cruz; nas arestas, uma seta na direção da aresta. Ao pressionar dentro do quadro e mover, o quadro sempre se move inteiro. Para mover só a imagem, arraste com a tecla Alt pressionada, ou dê um clique duplo na imagem para selecioná-la e arraste a parte que sai do quadro. Arrastar a alça redonda acima do quadro selecionado (**{{ui:comic.free.rotate}}**) gira o quadro para qualquer ângulo. Com a tecla Shift pressionada, ele gira de 15 em 15 graus. Em uma página de quadros livres, os cantos e as arestas de um quadro movem só esse quadro, sem afetar os outros. Ao acrescentar um quadro, um quadro retangular é colocado no meio da página. Mesmo que você apague um quadro, os vizinhos não se expandem. **{{ui:comic.shape.cut}}** também pode ser usado, e os quadros em volta do quadro dividido permanecem como estão.

O que gira é a moldura do quadro; a imagem continua reta e é recortada pela moldura. O ângulo da imagem pode ser mudado à parte, com as ferramentas de imagem. Para devolver a página à disposição automática, pressione **{{ui:comic.shape.reset}}**, em **{{ui:comic.page.settings}}** (é possível voltar com desfazer).

Quando os quadros se sobrepõem, o quadro posterior fica na frente. Selecione um quadro e pressione **{{ui:comic.order.front}}**, **{{ui:comic.order.forward}}**, **{{ui:comic.order.backward}}** ou **{{ui:comic.order.back}}** para mudar a ordem de sobreposição. Essa ordem é também o número do quadro (a ordem de leitura), por isso, ao mudar a ordem, os números também se trocam.

Depois de girar, redimensionar ou mover quadros ou imagens, é possível restaurá-los com **{{ui:comic.reset.title}}**, no alto do centro. É possível escolher e restaurar um a um a rotação do quadro, a forma e o tamanho do quadro e a rotação, o tamanho, a posição e o espelhamento da imagem, ou restaurar tudo de uma vez com **{{ui:comic.reset.all}}**. Ao restaurar a forma e o tamanho do quadro, ele passa a ter a forma que tinha na disposição automática. A operação de restaurar a imagem não pode ser desfeita.

## Imagens nos quadros

![Uma imagem colocada em um quadro. Em volta da imagem, reduzida e girada, aparecem os quatro cantos e a alça de cima](shot:comic-image)

A imagem de um quadro não precisa ser uma imagem desenhada. Se você arrastar uma imagem da galeria sobre um quadro, ela passa a ser a imagem desse quadro. Selecione um quadro e pressione **{{ui:comic.panel.imageUpload}}**, no alto do centro, para escolher um arquivo de imagem do computador. O arquivo entra primeiro na galeria e depois se torna a imagem do quadro.

A imagem do quadro é movida diretamente na página, como na {{ui:app.tabs.canvas}}.

- Pressionar a imagem e arrastar move o quadro inteiro. Para mover só a imagem, arraste com a tecla Alt pressionada. Também é possível deixar parte da imagem fora do quadro.
- Ao dar um clique duplo na imagem, ou ao pressioná-la com Alt, a imagem é selecionada e aparecem em volta dela uma moldura tracejada e alças. A parte que saiu do quadro também fica visível, de forma esmaecida.
- Girar a roda do mouse com a tecla Alt pressionada amplia e reduz a imagem do quadro sob o ponteiro, tendo como centro a posição do ponteiro.
- Arrastar as alças dos quatro cantos amplia e reduz a imagem a partir do centro dela.
- Arrastar a alça redonda de cima gira a imagem. Girar com Shift pressionado gira de 15° em 15°.
- A imagem selecionada se move aos poucos com as setas do teclado (com Shift pressionado, move mais).
- Mesmo que a imagem tenha saído do quadro, é possível movê-la arrastando a moldura tracejada da imagem selecionada.

As ferramentas no alto do centro também mudam a imagem. **{{ui:comic.image.fitCover}}** tira a rotação da imagem e a estica até preencher o quadro. **{{ui:comic.image.fitContain}}** deixa a imagem com um tamanho em que ela cabe inteira no quadro. **{{ui:comic.image.rotateLeft}}** e **{{ui:comic.image.rotateRight}}** giram de 90° em 90°, e **{{ui:comic.image.flipX}}** e **{{ui:comic.image.flipY}}** espelham. **{{ui:comic.image.scaleDown}}** e **{{ui:comic.image.scaleUp}}** reduzem e ampliam aos poucos, e **{{ui:comic.image.center}}** leva o centro da imagem para o meio do quadro.

Para tirar a imagem de um quadro, selecione a imagem e pressione a tecla Delete, ou pressione o botão de lixeira no alto do centro (**{{ui:comic.panel.imageClear}}**, quando uma imagem está selecionada). O botão de lixeira é um só e apaga o que estiver selecionado (balão, imagem, imagem da página inteira ou quadro). Ao passar o ponteiro sobre o botão, aparece o que será apagado. Mesmo depois de retirada, a imagem permanece na galeria. Ao pressionar **{{ui:comic.history.undo}}**, no aviso que aparece logo depois de retirar, a imagem volta com a posição e o tamanho originais. Quando outra imagem é colocada, a posição e o tamanho voltam ao original.

O quadro se lembra das imagens anteriores. Quando você redesenha o quadro, coloca outra imagem ou retira a imagem, as imagens de antes ficam guardadas no **{{ui:comic.takes.title}}** desse quadro (as 12 mais recentes). Selecione um quadro e pressione **{{ui:comic.takes.title}}**, no alto do centro: a imagem atual e as anteriores aparecem lado a lado. Ao pressionar uma imagem anterior, ela volta ao quadro com a mesma posição e o mesmo tamanho que tinha (a imagem atual entra no histórico). Mesmo que você a retire da lista com **{{ui:comic.takes.remove}}**, a imagem permanece na galeria. As imagens apagadas da galeria não aparecem. Desfazer, como acontece com as imagens, não altera o histórico.

Também é possível redesenhar só uma parte da imagem (por exemplo, quando uma mão ou um rosto saiu deformado). Selecione um quadro que tenha imagem e pressione **{{ui:comic.fix.start}}** (o botão de pincel), no alto do centro: uma barra fina aparece sobre a página. Pinte sobre o quadro o lugar que quer redesenhar. Na barra, é possível mudar o **{{ui:comic.fix.brush}}** e, se pintar demais, voltar com **{{ui:comic.fix.undoStroke}}** ou **{{ui:comic.fix.clear}}**. No campo **{{ui:comic.fix.words}}**, escreva em inglês o que deve ser desenhado ali (se estiver vazio, desenha-se com o prompt do quadro). Quanto mais você baixa **{{ui:comic.fix.strength}}**, mais o resultado fica parecido com a imagem original. Ao pressionar **{{ui:comic.fix.go}}**, só o lugar pintado é redesenhado, e o resto permanece como a imagem original. A imagem resultante entra no quadro, e a anterior permanece no **{{ui:comic.takes.title}}**. As palavras dos personagens e as imagens de referência são usadas como ao desenhar o quadro. Ao selecionar outro quadro, a pintura é apagada.

## Imagem sobre a página inteira

Ao pressionar **{{ui:comic.backdrop.title}}**, no alto do centro, é possível colocar uma imagem preenchendo a página inteira. Isso serve para páginas com uma imagem grande, como uma página dupla, ou para páginas em que se alinham fotos e desenhos. Imagens da galeria e arquivos de imagem do computador também entram se forem soltos na página fora dos quadros (sobre um quadro, solte com a tecla Alt pressionada). Também é possível colocá-las soltando-as nessa seção ou escolhendo um arquivo com **{{ui:comic.panel.imageUpload}}**. A imagem fica atrás dos quadros, no fundo da página, e a parte que sai da página é cortada. Nos quadros sem imagem, a imagem de trás aparece por transparência. As molduras dos quadros e os balões são desenhados por cima.

Ao pressionar **{{ui:comic.backdrop.edit}}**, aparece uma moldura da imagem sobre a página. Arrastar a imagem em qualquer ponto a move, arrastar as bolinhas dos quatro cantos muda o tamanho e arrastar a bolinha de cima gira para qualquer ângulo (de 15 em 15 graus com a tecla Shift pressionada). Enquanto isso, os quadros não podem ser operados. Pressione a tecla Esc ou selecione outro quadro para terminar. Com os botões da mesma seção, também é possível ajustar para preencher a página, mostrar a imagem inteira, ampliar e reduzir, voltar ao centro, girar 90 graus, espelhar na horizontal e na vertical e retirar. A tecla Delete também retira. Depois de retirada, é possível voltar pelo aviso com **{{ui:comic.history.undo}}**. Essa imagem é incluída tanto ao transformar a página em imagem quanto ao gerar o arquivo de todas as páginas.

Também é possível usar essa imagem diretamente na página. Ao pressionar a página fora dos quadros (os espaços entre os quadros ou a margem da página), a imagem é selecionada e a moldura aparece. Enquanto ela está selecionada, a tecla Delete ou o botão de lixeira no alto do centro (**{{ui:comic.backdrop.clear}}**) a retira. Enquanto ela está selecionada, soltar na página uma imagem da galeria ou um arquivo a substitui por essa imagem. Girar a roda do mouse com a tecla Alt pressionada fora dos quadros amplia e reduz, tendo como centro a posição do ponteiro.

## Definir a pose

![A tela do boneco de palitos que define a pose do quadro](shot:comic-pose)

Selecione um quadro, pressione o botão de pose no alto do centro para abrir a seção e pressione **{{ui:comic.panel.pose}}**: abre-se a tela em que a pose é definida com um boneco de palitos. A pose é desenhada na forma do quadro e, ao pressionar **{{ui:comic.pose.use}}**, torna-se a pose desse quadro. A pose pode ser aberta de novo e corrigida. A pose definida nesta tela é de uma pessoa. Para retirá-la, pressione **{{ui:comic.panel.poseRemove}}**.

![A seção de poses prontas para o quadro. Escolhem-se a categoria e a pose](shot:comic-presets)

Na mesma seção, também é possível inserir as mesmas poses prontas da tela. Escolha a categoria em **{{ui:comic.panel.poseCategory}}**, escolha a pose em **{{ui:comic.panel.posePreset}}** e pressione **{{ui:comic.panel.poseApply}}**. O desenho do boneco de palitos é criado conforme o tamanho do quadro e se torna a pose desse quadro. Dependendo da composição, aparecem várias pessoas lado a lado. Nesse caso, todas entram no quadro.

Para que a pose seja refletida na imagem, é preciso ter instalado um modelo ControlNet de pose (OpenPose ou um modelo union). Para um modelo union, a imagem é desenhada informando que se trata de uma imagem de pose. Se não estiver instalado, a pose não é usada na imagem e aparece um aviso.

## Posicionar com o esboço 3D

Selecione um quadro e pressione **{{ui:comic.rough.open}}**, na seção de pose: abre-se uma tela 3D na forma do quadro. Em 3D, você posiciona as pessoas com bonecos feitos de cilindros e caixas, e o cenário com caixas, placas, cilindros e um piso. Também se definem a direção, a distância e o ângulo de visão da câmera.

- Arrastar o fundo gira a câmera. Arrastar com Shift pressionado (ou com o botão direito) a move, e a roda aproxima e afasta.
- Posicione com **{{ui:comic.rough.kind.person}}**, **{{ui:comic.rough.kind.box}}**, **{{ui:comic.rough.kind.plane}}** e **{{ui:comic.rough.kind.cylinder}}**, na seção da direita. A placa é colocada ao fundo, e os demais, ao lado. Pessoas e objetos podem ser movidos sobre o piso arrastando.
- Na seção da direita, mude a direção, a altura em relação ao piso e o tamanho (largura, altura e profundidade; para pessoas, o tamanho com um adulto igual a 100) do objeto selecionado. **{{ui:comic.rough.remove}}** o apaga.
- Arrastar o ponto colorido de uma pessoa selecionada dobra o membro correspondente. Arrastar o ponto do pescoço move a pessoa inteira.
- As imagens pequenas no canto inferior direito são a pose e a profundidade que serão passadas ao ControlNet.

Ao pressionar **{{ui:comic.rough.apply}}**, duas imagens são criadas no tamanho do quadro e colocadas nele. Uma é a imagem da pose vista da câmera. As articulações ocultas, como o rosto de quem está de costas ou as pernas escondidas atrás de uma mesa, não são desenhadas. A outra é a imagem de profundidade, que expressa a perspectiva dos objetos com brilho. Ao desenhar, além da pose, a imagem de profundidade também é passada ao ControlNet, aproximando as pessoas e o cenário da disposição do esboço 3D. A profundidade é fraca e age só da largada até a metade dos passos, porque, se fosse forte, as formas dos bonecos e das caixas seriam desenhadas como são.

Para usar a imagem de profundidade, é preciso ter instalado um modelo ControlNet de profundidade (depth ou um modelo union). Se não estiver instalado, a profundidade não é usada na imagem e aparece um aviso.

Depois de usar o esboço 3D, se você mudar a pose pela tela de pose, por uma pose pronta ou pelo agente, a imagem de profundidade é retirada (porque a posição das pessoas ficaria desatualizada). O esboço 3D em si permanece no quadro. Ao abri-lo de novo, a câmera e os objetos continuam como estavam, e ele começa com as pessoas da pose atual em pé. Ao pressionar **{{ui:comic.rough.apply}}**, a imagem de profundidade também é criada de novo.

Quando a divisão em quadros ou o tamanho da página muda e a forma do quadro se altera, a imagem de profundidade também não é usada, e aparece um aviso. Isso acontece porque a imagem feita na forma antiga seria esticada e deslocaria a posição das pessoas e do cenário. Abra o esboço 3D e pressione **{{ui:comic.rough.apply}}** para recriá-la na forma atual.

## Manter os personagens consistentes

Quando os quadros são desenhados um a um, o rosto e a roupa mudam um pouco de um para outro. Para reduzir isso, registre os personagens. Selecione um quadro, pressione o botão **{{ui:comic.cast.title}}**, nas ferramentas de quadro no alto do centro, e pressione **{{ui:comic.cast.add}}**. A lista de personagens aparece no alto, e a seção do personagem cujo nome você pressionou aparece embaixo (um de cada vez). Dê um nome e escreva a aparência, em tags em inglês, na seção de baixo: tipo e número de pessoas, idade, cabelo, olhos, cor da roupa etc. (exemplo: `1boy, old man, short white hair, flat cap, beige cardigan, blue shirt`). A seção cresce conforme o texto e dá para ler tudo. Para os personagens que aparecem no quadro selecionado, marque a caixa ao lado do nome na lista. Ao desenhar esse quadro, as tags dos personagens marcados são colocadas, como estão, antes do prompt. No prompt, basta escrever o que muda (a composição, o lugar, o movimento). Os personagens sem marca não entram nesse quadro. Se você apagar um personagem, ele sai de todos os quadros.

Só com palavras, o cabelo e a roupa ficam iguais, mas o rosto não. Por isso, um personagem também pode ter uma imagem de referência. Ao pressionar **{{ui:comic.cast.refUse}}**, a imagem do quadro selecionado passa a ser a imagem de referência. Com **{{ui:comic.cast.refClear}}**, ela é retirada. Se essa imagem é usada com o IP-Adapter ao desenhar os quadros, isso é decidido em **{{ui:comic.draw.castReference.use}}**, em **{{ui:comic.draw.settings}}**. O padrão é desligado, porque, com o IP-Adapter, o estilo de desenho tende a piorar e o fundo branco e a postura em pé da imagem de referência tendem a passar para o quadro. Quando ligado, a imagem de referência é usada com pouca força e só na primeira metade do desenho, e a escala CFG não é reduzida (é preciso que o modelo IP-Adapter esteja instalado). Com ele ligado, ao desenhar a página inteira ou o quadrinho inteiro, um personagem sem imagem de referência é desenhado antes, só com palavras, sozinho sobre um fundo liso, e essa imagem passa a ser a imagem de referência. Quando o modelo da aba de geração é o FLUX.2, a imagem de referência é passada ao próprio modelo, sem passar pelo IP-Adapter, independentemente desta configuração (até 4 imagens por quadro). Nesse caso, o modelo IP-Adapter não é necessário.

Quando há 2 ou mais personagens no quadro e o quadro tem pose, em “{{ui:comic.cast.posePerson}}”, no elenco, é possível escolher qual pessoa da pose cada um é. Ao escolher, as palavras de aparência e a imagem de referência desse personagem passam a valer só em volta dessa pessoa da pose. Com isso, o rosto e a roupa passam menos para outro personagem (para modelos SD 1.5 e SDXL). Se o número de pessoas for igual ao de personagens humanos do elenco, a atribuição é feita pela ordem, mesmo sem escolher. Seres sem pose, como monstros e animais, são desenhados nos lugares restantes.

A aparência também pode ser escrita, além do campo de tags, em campos separados de cabelo, olhos, traços do rosto, roupa, físico e acessórios. Escrevendo por partes, só as partes que aparecem na imagem do quadro entram no prompt. Se o prompt do quadro tem close-up, entram cabelo, olhos, rosto e acessórios; com upper body, acrescenta-se a roupa; com from behind, tudo menos olhos e rosto. Se nada foi escrito, considera-se que o corpo inteiro aparece e tudo entra. Para monstros e animais, marque “{{ui:comic.cast.nonHuman}}” no elenco. As partes entram sempre, em qualquer enquadramento, e a imagem de referência é desenhada sem a pessoa.

Quando um personagem está ligado a um personagem com LoRA (cadastro de personagens), ligação feita em uma versão anterior, o quadro em que esse personagem aparece sozinho é desenhado com esse LoRA e as palavras de chamada. Em um quadro com 2 ou mais personagens com LoRA, ele não é usado, porque as aparências se misturariam. Também não é usado quando o LoRA é de um tipo diferente do modelo da aba de geração (por exemplo, SDXL e SD 1.5) ou quando o LoRA do personagem está desligado.

Quando o agente cria o quadrinho, ele também escreve os personagens. Como só as palavras ficam iguais e o rosto não é exatamente o mesmo, pode restar uma pequena diferença entre os quadros.

## Manter o cenário consistente

Quando os quadros são desenhados um a um, mesmo numa cena do mesmo quarto, o fundo muda de quadro para quadro. Para reduzir isso, registre os cenários. Selecione um quadro, pressione o botão **{{ui:comic.place.title}}**, nas ferramentas de quadro no alto do centro, e pressione **{{ui:comic.place.add}}**. O novo cenário passa a ser o cenário do quadro selecionado. Dê um nome e escreva em **{{ui:comic.place.tags}}**, em tags em inglês, que tipo de lugar é, os objetos que há nele, as cores e a luz (exemplo: `classroom, wooden desks, green chalkboard, large windows, afternoon sunlight`). Nos outros quadros, escolha o cenário na lista de **{{ui:comic.place.inPanel}}**. Ao desenhar esse quadro, as palavras do cenário são colocadas, como estão, depois do prompt. Quadros com o mesmo cenário tendem a ser desenhados com o mesmo fundo. Se você corrigir as palavras, isso vale para todos os quadros desse cenário. Um lugar cuja luz muda entre dia e noite deve ser registrado como cenários separados.

Quando o agente cria o quadrinho, ele também registra os cenários e escolhe um para cada quadro.

## Pedir ao agente

Na aba **{{ui:comic.side.assistant}}**, na coluna da direita, é possível pedir ao agente algo sobre o quadrinho aberto. O agente lê e escreve os personagens e cenários do quadrinho, a divisão em quadros da página, o prompt e a pose de cada quadro e os balões. Ele faz só o que foi pedido, e só desenha as imagens quando isso é pedido.

Se você pedir que ele olhe a imagem de uma página já desenhada e a corrija, o agente vê a imagem dessa página. Como a imagem da página é enviada à IA escolhida, antes de ver aparece a mesma confirmação de quando se leem imagens ([O agente, as configurações e os atalhos](09-assistant-settings.md)). Se você não permitir, ele não vê essa página.

## Indicação de cena

Para cada quadro, é possível anotar a cena em texto. Escreva, como nas indicações de cena de um roteiro, o lugar, a hora e quem faz o quê. Selecione um quadro, pressione o botão de anotação no alto do centro (**{{ui:comic.panel.note}}**) para abrir a seção e escreva. Nos quadros que ainda não têm imagem, a indicação de cena aparece em letras inclinadas (nos quadros sem indicação de cena, aparece o prompt). A indicação de cena não é usada para gerar a imagem. Também é possível pedir ao agente que a escreva ([O agente, as configurações e os atalhos](09-assistant-settings.md)).

## Balões e narrações

![A seção de balões e narrações. Os tipos de balão aparecem como pequenas figuras com a aparência real](shot:comic-balloon-list)

Selecione um quadro e pressione **{{ui:comic.panel.bubbles}}**, no alto do centro, para abrir a seção: os tipos de balão aparecem como pequenas figuras com a aparência de cada um. Ao pressionar uma figura, um balão desse tipo é acrescentado ao quadro, e o **{{ui:comic.bubble.editor}}** se abre sobreposto ao quadro da direita. Abaixo da seção, os balões do quadro aparecem listados por tipo e fala. Ao pressionar uma linha, o balão é selecionado; ao pressionar o botão de lápis (**{{ui:comic.bubble.edit}}**), abre-se o **{{ui:comic.bubble.editor}}**.

- {{ui:comic.bubble.kind.speech}}, {{ui:comic.bubble.kind.rounded}}, {{ui:comic.bubble.kind.box}}: balões elíptico, retangular de cantos arredondados e retangular, que podem ter rabicho.
- {{ui:comic.bubble.kind.thought}}: em forma de nuvem, com pequenos círculos em sequência no lugar do rabicho.
- {{ui:comic.bubble.preset.whisper}}: uma elipse pontilhada. Usada para voz baixa e cochichos.
- {{ui:comic.bubble.kind.shout}}, {{ui:comic.bubble.kind.explosion}}: balões de borda com pontas. {{ui:comic.bubble.kind.explosion}} tem pontas grandes e irregulares.
- {{ui:comic.bubble.kind.wavy}}, {{ui:comic.bubble.kind.fuzzy}}: uma borda ondulada e uma borda como pelos finos. Usadas para vozes fracas e sentimentos de insegurança.
- {{ui:comic.bubble.kind.electric}}: uma moldura de muitos cantos, com rabicho em forma de raio. Usada para telefone, alto-falante e vozes de máquinas.
- {{ui:comic.bubble.kind.icicle}}: um balão com pingentes de gelo pendurados embaixo. Usado para vozes frias.
- {{ui:comic.bubble.kind.heart}}: um balão em forma de coração.
- {{ui:comic.bubble.kind.flash}}: linhas pretas radiais se juntam em volta da fala. Usado para surpresa e gritos do coração.
- {{ui:comic.bubble.preset.dark}}, {{ui:comic.bubble.preset.double}}: um balão pintado de preto (com texto branco) e um balão de linha dupla.
- {{ui:comic.bubble.kind.caption}}: uma moldura com cantos, sem rabicho.
- {{ui:comic.bubble.kind.sfx}}: letras de efeito sonoro como “BUM” ou “MURMÚRIO”. Não tem moldura de balão; são letras pretas grossas com borda branca, e começam com um tamanho de letra grande. Em **{{ui:comic.bubble.rotation}}**, no **{{ui:comic.bubble.editor}}**, as letras podem ser inclinadas (de -90 a 90 graus).
- {{ui:comic.bubble.kind.stamp}}: cola o efeito sonoro como imagem, e não como letras. Dá para escolher entre 114 imagens, em 3 estilos de letra (angular, pincel afiado e pincel falhado), com 38 palavras cada, como “DON”, “ZAWA” e “GOGOGOGO”. A lista do **{{ui:comic.bubble.editor}}** pode ser pesquisada por palavra, leitura e uso (por exemplo: don, zawa, tensão) e filtrada por estilo de letra. O tamanho, a inclinação e a posição mudam como nos efeitos sonoros em letras, e a imagem também entra como imagem nas páginas salvas e no PSD. As imagens podem ser usadas livremente, inclusive para fins comerciais (CC0).
- {{ui:comic.bubble.kind.plain}}: letras de espessura normal, sem moldura. Para poderem ser lidas sobre a imagem, recebem uma borda branca fina. A inclinação também pode ser mudada.

As linhas dos balões tremem um pouco, como se fossem desenhadas à mão. O jeito de tremer é definido por balão e não muda ao mover ou reescrever.

![Um balão com texto na vertical e a alça redonda na ponta do rabicho](shot:comic-tail)

O balão acrescentado é colocado no meio do quadro. O balão é posicionado arrastando-o na página. Mesmo com a imagem do quadro selecionada, ao pressionar o balão só ele se move, e o quadro e a imagem não. Ao selecionar um balão, ele é contornado por uma moldura tracejada azul e as alças do quadro ficam ocultas. Também aparece uma alça redonda na ponta do rabicho. Arrastar a alça muda a direção e o comprimento do rabicho. Para pôr ou tirar o rabicho, pressione **{{ui:comic.bubble.tail}}**, no **{{ui:comic.bubble.editor}}**.

![Um balão acrescentado. A edição do balão se abre sobreposta ao quadro da direita](shot:comic-balloon)

Dar um clique duplo em um balão na página também abre o **{{ui:comic.bubble.editor}}**. A edição se abre sobreposta ao quadro que fica à direita da tela, então não esconde a página (quando o painel direito está fechado ou estreito, ela se abre na extremidade direita da página). Aqui é possível mudar **{{ui:comic.bubble.kindLabel}}**, a fala, **{{ui:comic.bubble.font}}**, **{{ui:comic.bubble.size}}**, **{{ui:comic.bubble.vertical}}** e **{{ui:comic.bubble.tail}}**. Na lista de tipos, cada forma também aparece como uma pequena figura. Mesmo mudando o tipo, a fala e a posição permanecem. Para fechar, pressione o × no canto superior direito ou a tecla Esc. Mesmo fechado, o balão continua selecionado.

Em **{{ui:comic.bubble.look}}**, é possível mudar o seguinte.

- **{{ui:comic.bubble.lineLabel}}**: escolha entre {{ui:comic.bubble.line.solid}}, {{ui:comic.bubble.line.dashed}}, {{ui:comic.bubble.line.double}} e {{ui:comic.bubble.line.none}}.
- **{{ui:comic.bubble.dark}}**: pinta o balão de preto e deixa o texto branco.
- **{{ui:comic.bubble.lineWidth}}**: a espessura da linha (de 0,3 a 4 vezes).
- **{{ui:comic.bubble.rough}}**: o tremor da linha, como feita à mão. Com 0, a linha fica como traçada com régua.
- **{{ui:comic.bubble.width}}**, **{{ui:comic.bubble.height}}**: a largura e a altura do balão em relação à fala (de 0,6 a 3 vezes).
- **{{ui:comic.bubble.spikes}}**, **{{ui:comic.bubble.depth}}**: o número e a profundidade das pontas, dos caroços da nuvem, das ondas, dos pelos, dos cantos, dos pingentes e das linhas. Aparecem só nos tipos que os têm.
- **{{ui:comic.bubble.tailWidth}}**, **{{ui:comic.bubble.tailCurve}}**: a espessura da base do rabicho e a curvatura dele. Aparecem só quando há rabicho.

![Um balão cuja forma está sendo mudada livremente. Pontos quadrados se alinham sobre o contorno, e um deles foi puxado, mudando a forma](shot:comic-balloon-shape)

A forma do balão pode ser mudada livremente. Ao pressionar **{{ui:comic.bubble.shapeFreely}}**, em **{{ui:comic.bubble.outline}}**, pontos quadrados se alinham sobre o contorno do balão. Arrastar um ponto move o contorno naquele lugar. Dar um clique duplo em um ponto o remove (não é possível ficar com menos de 3), e dar um clique duplo no balão acrescenta um ponto no contorno perto dali. As pontas, os caroços da nuvem etc. acompanham o contorno alterado. Ao pressionar **{{ui:comic.bubble.smooth}}**, alterna-se entre ligar os pontos com curvas ou com linhas retas. Ao pressionar **{{ui:comic.bubble.shapeReset}}**, volta-se à forma original do tipo. Ao pressionar **{{ui:comic.bubble.shapeFreely}}** de novo, os pontos desaparecem.

Parte da fala pode ficar em negrito ou receber pontos de ênfase (pontos ao lado das letras). Selecione letras na seção e pressione **{{ui:comic.bubble.bold}}** ou **{{ui:comic.bubble.dots}}** para aplicar; selecione as mesmas letras e pressione de novo para retirar. Na seção, o negrito aparece como `**texto**` e os pontos de ênfase, como `《《texto》》`, e digitar isso diretamente tem o mesmo efeito. Na página, os pontos de ênfase do texto na horizontal ficam acima das letras, e os do texto na vertical ficam à direita delas.

Em **{{ui:comic.bubble.font}}**, é possível escolher entre as fontes do app e as instaladas neste computador. O nome é exibido na própria fonte. Se você escolher **{{ui:comic.bubble.fontDefault}}**, é usada a configuração **{{ui:settings.comicFont.label}}** ([O agente, as configurações e os atalhos](09-assistant-settings.md)). O tamanho da letra muda de 40% a 400% com o controle deslizante de **{{ui:comic.bubble.size}}**. Ao pressionar **{{ui:comic.bubble.vertical}}**, o texto passa à escrita vertical, com as letras dispostas em colunas a partir da direita. O texto vertical muda para a coluna seguinte na altura do balão.

Se o texto sair do balão, uma moldura pontilhada vermelha aparece em volta dele. **{{ui:comic.bubble.fitHelp}}** (o botão **{{ui:comic.bubble.fit}}**). Depois de diminuir, a posição também é corrigida para que a forma do balão caiba no quadro. Os balões colocados pelo agente se ajustam assim automaticamente.

O que não for mais necessário pode ser apagado com a lixeira da linha na seção ou com **{{ui:comic.bubble.remove}}**, no **{{ui:comic.bubble.editor}}**. Também é possível apagar selecionando o balão na página e pressionando a tecla Delete, ou pressionando o botão de lixeira no alto do centro.

## Camadas

As camadas da página aparecem sempre como a lista **{{ui:canvas.layers.title}}**, sob as abas da coluna da direita (**{{ui:comic.side.assistant}}** e **{{ui:comic.side.gallery}}**). É a mesma coisa que as camadas da aba {{ui:app.tabs.canvas}}. A página já vem com duas camadas: **{{ui:comic.layers.panels}}** (as molduras e as imagens dos quadros) e **{{ui:comic.layers.balloons}}** (todos os balões e narrações). Quanto mais acima na lista, mais à frente a camada é desenhada. No menu de adicionar (o de mais), é possível acrescentar suas próprias **{{ui:canvas.add.raster}}** e **{{ui:canvas.add.inpaint}}**. Uma página pode ter até 32 camadas (incluindo {{ui:comic.layers.panels}} e {{ui:comic.layers.balloons}}), até 8 máscaras, e em uma camada podem ser desenhados até 5000 itens. Quando o limite se aproxima, você é avisado.

O botão de olho da linha alterna entre exibir e ocultar, e o de cadeado, entre bloquear e desbloquear. Uma camada oculta não é desenhada na página nem quando a página é transformada em imagem. Ao selecionar uma linha, é possível mudar **{{ui:canvas.entity.opacity}}** e **{{ui:canvas.entity.blend}}** ({{ui:canvas.entity.blend.normal}}, {{ui:canvas.entity.blend.multiply}}, {{ui:canvas.entity.blend.screen}}). As linhas podem ser reordenadas arrastando ou pelo menu de clique com o botão direito; abaixo de **{{ui:comic.layers.panels}}**, a camada vira um desenho de base estendido sob as imagens dos quadros, e acima de **{{ui:comic.layers.balloons}}**, fica sobreposta aos balões. As camadas {{ui:comic.layers.panels}} e {{ui:comic.layers.balloons}} podem ser reordenadas e ocultadas, mas não apagadas nem desenhadas. As máscaras não entram na imagem da página nem no PSD.

## Desenhar na página

Com o seletor no alto do centro, alterne entre **{{ui:comic.paint.page}}** e **{{ui:comic.paint.paint}}**. Em pintura, as operações com quadros e balões ficam indisponíveis, e é possível desenhar na **{{ui:canvas.add.raster}}** selecionada com as mesmas ferramentas da aba {{ui:app.tabs.canvas}} ({{ui:canvas.tool.brush}}, {{ui:canvas.tool.eraser}}, {{ui:canvas.tool.mosaic}}, {{ui:canvas.tool.rect}}, {{ui:canvas.tool.lasso}}, {{ui:canvas.tool.move}}, {{ui:canvas.tool.bbox}}, {{ui:canvas.tool.colorPicker}}, {{ui:canvas.tool.bucket}}). Selecionar na lista a linha de uma camada raster também inicia a pintura, e selecionar a linha de {{ui:comic.layers.panels}} ou {{ui:comic.layers.balloons}}, ou pressionar a tecla Esc, volta às operações da página. Abrir outra página ou sair da tela do quadrinho também volta.

{{ui:canvas.tool.bucket}} preenche a área de cor próxima à do ponto pressionado (**{{ui:canvas.toolbar.bucketTolerance}}** define até onde as cores são consideradas próximas). Com o botão **{{ui:canvas.toolbar.filter}}**, é possível aplicar {{ui:canvas.rasterFilter.blur}}, {{ui:canvas.rasterFilter.grayscale}} e {{ui:canvas.rasterFilter.invert}} à imagem da camada raster selecionada. Ambos podem ser desfeitos com o desfazer da pintura (desfazer e refazer das ferramentas de pintura). Durante a pintura, Ctrl+Z desfaz as camadas dessa página. O desfazer do quadrinho inteiro não restaura as camadas.

Para redesenhar só uma parte da página, acrescente uma {{ui:canvas.add.inpaint}}, pinte a máscara, defina com {{ui:canvas.tool.bbox}} a área a gerar (ela não pode sair da página) e pressione **{{ui:comic.inpaint.run}}**, na fileira de ferramentas de pintura. Se não houver máscara, você é avisado para pintá-la primeiro. O resultado fica esperando na barra de aceitação que aparece sobre a página e, com **{{ui:canvas.staging.accept}}**, entra em uma nova camada raster. Se chegar enquanto você vê outra página, você é avisado, e é possível aceitar colocando a página original em pintura.

## Configurações de geração

{{ui:params.model.label}}, {{ui:params.lora.label}}, {{ui:params.advanced.vae}}, {{ui:params.refImage.sectionLabel}} e {{ui:params.hires.title}} são os mesmos usados na aba {{ui:app.tabs.generate}}. Se você mudar as configurações da esquerda, elas também valem para a aba {{ui:app.tabs.generate}}. Só o prompt é separado por quadro (veja “Prompts do quadro”).

A imagem que entra em um quadro é uma por quadro. Por isso, o tamanho da imagem é definido pelo tamanho do quadro, e não pelas configurações da aba {{ui:app.tabs.generate}}. O campo do número de gerações não aparece no quadrinho.

Em **{{ui:comic.draw.settings}}**, na coluna da esquerda, há também campos exclusivos do quadrinho. **{{ui:comic.draw.style.title}}** traz as palavras de qualidade que são colocadas no início do prompt de todos os quadros e o negativo comum a todos os quadros. Se você acrescentar às palavras de qualidade as tags habituais de artista ou de estilo de desenho, o estilo de todos os quadros fica igual. Quando o campo está vazio, são usadas as palavras padrão conforme o modelo. O negativo padrão não inclui palavras que tiram a cor. Para deixar em preto e branco, use o efeito de preto e branco da página. **{{ui:comic.draw.castReference.title}}** define se a imagem de referência dos personagens é usada com o IP-Adapter e com que força (veja “Manter os personagens consistentes”).

## Transformar a página em uma imagem

Ao pressionar **{{ui:comic.page.export}}**, no alto do centro, a página é transformada em uma imagem (PNG) e salva na galeria. As imagens dos quadros e as letras dos balões e narrações são desenhadas nessa imagem. As imagens dos quadros são desenhadas na posição, no tamanho, na rotação e no espelhamento em que estão na página. Os balões são desenhados com a mesma forma, linha e tremor que têm na página. As letras são desenhadas com fontes do Windows, como as japonesas. As camadas são desenhadas na ordem de sobreposição, com a opacidade e o modo de mesclagem que têm, e as camadas ocultas não entram. O tamanho da imagem é desenhado a 200 dpi, conforme o tamanho do original.

Ao pressionar **{{ui:comic.page.psd}}**, a página é transformada em um arquivo PSD dividido em camadas e salva como um download do navegador. Entram, de baixo para cima, o papel branco, a imagem da página inteira, a imagem de cada quadro (recortada na forma do quadro; quadros sem imagem ficam cinza), todas as molduras e uma camada por balão. Essas camadas e as que você acrescentou ficam na ordem das camadas da página, e a opacidade, o modo de mesclagem e a exibição ou ocultação também entram como estão. As letras dos balões são desenhadas como imagem, por isso não podem ser redigitadas no PSD. O efeito aplicado à página também é aplicado a cada camada. O nome do arquivo é o nome do quadrinho e o número da página.

## Transformar todas as páginas em um só arquivo

Ao pressionar **{{ui:comic.book.export}}**, no alto do centro, todas as páginas do quadrinho podem ser salvas em um só arquivo. **{{ui:comic.book.pdf}}** cria um PDF, adequado para impressão e compartilhamento; **{{ui:comic.book.cbz}}** cria um CBZ, que pode ser lido em leitores de quadrinhos; e **{{ui:comic.book.psd}}** cria um ZIP que reúne os PSD de cada página. As páginas entram na ordem em que estão, e o nome do arquivo é o nome do quadrinho. O arquivo é salvo como um download do navegador. Se houver muitas páginas, a exportação demora um pouco.

Cada página do PDF é uma imagem no tamanho do original. Se a página 1 está configurada para leitura da direita para a esquerda, o PDF também se abre como um livro lido da direita para a esquerda. O CBZ reúne, em ordem, um PNG por página. Os PSD dentro do ZIP têm as mesmas camadas que **{{ui:comic.page.psd}}** e são numerados na ordem das páginas.

## Desfazer e refazer

Ao pressionar **{{ui:comic.history.undo}}**, abaixo da página, à esquerda, a última alteração é desfeita. Uma alteração desfeita pode ser refeita com **{{ui:comic.history.redo}}**. No teclado, Ctrl+Z desfaz e Ctrl+Shift+Z (ou Ctrl+Y) refaz (no Mac, Command no lugar de Ctrl). O que é desfeito: a divisão da página e a ordem dos quadros (incluindo a forma dos quadros), o prompt e a pose dos quadros e os balões. As camadas são restauradas com o desfazer da pintura (veja “Desenhar na página”). As imagens dos quadros (colocar, retirar, mover), os modelos e o nome do quadrinho não são desfeitos. Frases escritas em seguida no mesmo campo são desfeitas juntas, como uma única alteração. Quando o cursor está em um campo de texto, Ctrl+Z restaura o texto desse campo.

## Salvar e apagar

O quadrinho é salvo automaticamente cerca de 1 segundo depois de uma alteração. Mesmo depois de fechar e abrir o app, o projeto salvo continua na lista, e as páginas, os quadros, os balões e os modelos permanecem como estavam. Ele também entra no backup.

Para apagar um projeto, abra o menu da linha dele na lista de quadrinhos, pressione **{{ui:comic.project.delete}}** e pressione de novo para confirmar. Ao apagar o projeto, as páginas, os quadros e os modelos dele são apagados. As imagens desenhadas permanecem na galeria.

Para apagar uma página, pressione o botão de lixeira abaixo da página (**{{ui:comic.page.delete}}**) e pressione de novo para confirmar. Os quadros e balões da página são apagados, mas as imagens desenhadas permanecem na galeria.

## Usar as imagens desenhadas

As imagens desenhadas são imagens comuns, que entram na galeria. As operações que usam imagens da galeria em outras telas, como arrastar uma imagem da galeria para a {{ui:app.tabs.canvas}}, funcionam normalmente.
