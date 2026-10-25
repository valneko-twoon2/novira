# Quadrinho

![A aba Quadrinho inteira. À esquerda, as mesmas configurações da aba Gerar; no centro, a tela de um quadrinho vazio](shot:comic)

**{{ui:app.tabs.comic}}** é o espaço de trabalho para criar páginas de quadrinho. Na fileira de ícones no alto do painel esquerdo da aba {{ui:app.tabs.generate}}, toque no ícone mais à direita, um livro, para abri-lo (a tecla 3 também o abre). O quadrinho é organizado em projetos. Dentro do projeto ficam as páginas; cada página é dividida em quadros, e você desenha uma imagem em cada quadro. Além da imagem desenhada, um quadro também pode receber uma imagem da galeria ou uma pose. Com balões e legendas posicionados, a página pode ser salva como uma única imagem.

A tela é dividida em 3 partes.

- Esquerda: de cima para baixo ficam {{ui:presets.label}} e {{ui:params.seed.label}}, iguais aos da aba {{ui:app.tabs.generate}}, a lista de quadrinhos e {{ui:params.model.label}}. Logo abaixo fica a seção **{{ui:params.prompt.title}}**, que contém o prompt do quadro selecionado. Mais abaixo ficam o botão que desenha o quadro selecionado e o botão que desenha todos os quadros, a seção de imagem de referência e as configurações detalhadas de geração. Clicar no título de uma configuração abre ou fecha essa seção.
- Centro: a {{ui:app.views.comic}}. A fileira de ferramentas acima dela traz as configurações da página, os modelos, a ferramenta de cortar quadros, as ferramentas de quadro (balões e legendas, pose, modelos de quadro), as ferramentas de imagem e o botão que transforma a página em imagem. Abaixo da página ficam desfazer e refazer, a troca de página e o zoom.
- Direita: a galeria. As imagens desenhadas nos quadros também entram na galeria.

## Criar um quadrinho

![A lista de quadrinhos no alto à esquerda. A miniatura da página 1, com o nome do quadrinho e o número de páginas](shot:comic-project)

1. Abra a lista de quadrinhos no alto à esquerda, clique em **{{ui:comic.project.new}}**, no final da lista, e dê um nome. Quando ainda não há nenhum quadrinho, também é possível criar um com **{{ui:comic.project.new}}**, no centro.
2. A página começa com 3 quadros. Para adicionar uma página, clique em **{{ui:comic.page.add}}**, abaixo da página.
3. Clique na página sobre o quadro que deseja desenhar para selecioná-lo. À esquerda, na seção **{{ui:params.prompt.title}}**, escreva a descrição da imagem desse quadro e clique em **{{ui:comic.panel.draw}}**.
4. Para desenhar todos os quadros da página em sequência, clique em **{{ui:comic.page.drawAll}}**, ao lado de **{{ui:comic.panel.draw}}**.

A lista de quadrinhos mostra a miniatura da página 1 de cada quadrinho e o número de páginas. Escolha um quadrinho na lista para abri-lo. Para renomear ou excluir um quadrinho, use o menu à direita da linha dele.

Para criar uma imagem, é preciso escolher um modelo. Um quadro sem prompt não pode ser desenhado. O prompt funciona melhor escrito como tags em inglês. A imagem desenhada entra no quadro e também na galeria. Um quadro que não pôde ser desenhado mostra **{{ui:comic.draw.failed}}** na página.

## Prompts do quadro

Na aba de quadrinho, a seção **{{ui:params.prompt.title}}**, à esquerda, passa a ser o prompt do quadro selecionado. Ao selecionar outro quadro, o texto dos campos muda para o desse quadro. Cada quadro tem o seu próprio par de prompts **{{ui:params.prompt.positive}}** e **{{ui:params.prompt.negative}}**. Na aba de quadrinho, sempre há um quadro selecionado.

Os campos funcionam como na aba {{ui:app.tabs.generate}}. Ao carregar uma {{ui:presets.label}}, os prompts dela vão para o quadro selecionado. A **{{ui:params.promptBook.title}}** e as predefinições de prompt também vão para o quadro selecionado. Ao voltar para a aba {{ui:app.tabs.generate}}, os prompts que você tinha escrito na aba {{ui:app.tabs.generate}} voltam como estavam.

A imagem de um quadro é desenhada só com os prompts desse quadro. Os prompts dos outros quadros e os da aba {{ui:app.tabs.generate}} não são acrescentados.

Os prompts dinâmicos (a escrita de combinações e os curingas) também funcionam no quadrinho. Com **{{ui:params.prompt.modeRandom}}**, a combinação é escolhida pela seed da imagem e uma única imagem é desenhada. Com **{{ui:params.prompt.modeCombinatorial}}**, cada combinação é desenhada uma vez: a primeira combinação entra no quadro, e as imagens das demais combinações entram só na galeria (não no quadro). Quando há várias combinações, um aviso informa isso.

## Configurações da página

Clique em **{{ui:comic.page.settings}}**, no alto do centro, para abrir as configurações da página.

A quantidade de quadros da página vai de 1 a 24 e é alterada no campo **{{ui:comic.page.panelCount}}**. Ao mudar o número, a distribuição dos quadros da página é refeita automaticamente. Uma página cuja forma dos quadros foi alterada à mão também volta à distribuição automática quando a quantidade muda.

A página pode ter de 1 a 3 colunas, escolhidas em **{{ui:comic.page.columns}}**. Em **{{ui:comic.page.direction}}**, escolha a direção de leitura dos quadros. O mangá costuma ser lido “Da direita para a esquerda (mangá)”, por isso uma página nova começa nessa direção. Ao mudar a direção, a ordem dos quadros se inverte entre a esquerda e a direita.

Ao diminuir a quantidade de quadros, os quadros finais são removidos. As imagens dos quadros removidos continuam na galeria.

O tamanho do papel é escolhido em **{{ui:comic.page.size}}**, entre A4, A5, B4 e B5. A proporção da página é a mesma do papel escolhido. A imagem da página salva é desenhada no tamanho do papel a 200 dpi (no A4, cerca de 1654 × 2339 px).

**{{ui:comic.page.frameWidth}}** define a espessura das linhas da moldura dos quadros, de 0 mm a 3 mm (no início, 0,6 mm). **{{ui:comic.page.inset}}** define o espaço entre a linha da moldura e a imagem, de 0 mm a 10 mm (no início, 0 mm, então a imagem fica encostada na linha). Os dois valem para todos os quadros da página, e a imagem da página salva é desenhada com a mesma espessura e o mesmo espaço.

## Trocar de página e zoom

Os botões com os números das páginas ficam no meio, abaixo da página. Clique em um número, ou nas setas para a esquerda e para a direita, para ir a outra página. **{{ui:comic.page.add}}** acrescenta uma página, e o botão da lixeira exclui a página aberta no momento (clique de novo para confirmar). Mesmo com mais páginas, os botões de número ficam em uma só linha, e os que não cabem rolam para o lado. O número da página aberta é trazido para a parte visível.

O tamanho de exibição da página pode ser alterado com os botões **{{ui:common.zoomIn}}** e **{{ui:common.zoomOut}}**, abaixo da página, à direita. Também é possível ampliar ou reduzir em torno do ponteiro girando a roda do mouse com Ctrl pressionado. Clique no número do zoom para voltar a 100%.

## Modelos

![A lista de modelos de página. As distribuições aparecem como pequenos desenhos](shot:comic-templates)

Clique em **{{ui:comic.template.pageTitle}}**, no alto do centro, para abrir a lista de modelos de página. Cada modelo aparece como um pequeno desenho da sua distribuição. Clique em um desenho para aplicar esse modelo à página aberta no momento.

Na lista aparecem as distribuições padrão (“{{ui:comic.template.builtin.single}}”, “{{ui:comic.template.builtin.strip}}”, “{{ui:comic.template.builtin.four}}”, “{{ui:comic.template.builtin.six}}” e “{{ui:comic.template.builtin.nine}}”), os modelos de forma de quadros (dez no total, com cortes inclinados e combinações de quadros grandes e pequenos) e os modelos salvos. A distribuição padrão segue a direção de leitura e o tamanho do papel desta página. Um modelo de forma usa a direção de leitura desta página, e seus quadros são invertidos para combinar com ela. Um modelo salvo usa a direção de leitura e o tamanho do papel que tinha quando foi salvo. Quando a página fica com menos quadros, o texto abaixo do desenho muda para **{{ui:comic.template.applyAgain}}**. Um novo clique aplica o modelo, e os quadros finais perdem a imagem e os balões.

Para salvar a distribuição desta página, digite um nome abaixo da lista e clique em **{{ui:comic.template.savePage}}**. Se o nome ficar vazio, o modelo recebe o nome “Modelo” seguido de um número. Os modelos ficam salvos dentro deste projeto.

Um modelo de quadro guarda o prompt, o prompt negativo, a pose, os balões e a imagem de referência do quadro selecionado; a imagem do quadro não é salva. Na seção que se abre ao clicar em **{{ui:comic.template.panelTitle}}** no alto do centro, dê um nome e clique em **{{ui:comic.template.save}}**. Em outro quadro, clique em **{{ui:comic.template.apply}}** na linha do modelo salvo para aplicá-lo a esse quadro. Entram no quadro o prompt, o prompt negativo, a pose, os balões e a imagem de referência; a imagem do quadro é mantida.

## Alterar a forma dos quadros

![Página com quadros reformados: o quadro de cima está cortado em diagonal, e os vértices do quadro selecionado aparecem como pontos](shot:comic-shapes)

A forma dos quadros pode ser alterada à mão, mesmo quando a página tem a distribuição automática. Clique em **{{ui:comic.shape.cut}}**, no alto do centro, e depois trace uma linha sobre um quadro de uma borda a outra: o quadro é dividido em dois. Uma linha que não divide o quadro em dois (uma linha fora do quadro, ou uma que só toca um canto) não corta nada.

Para adicionar um quadro, clique em **{{ui:comic.shape.addPanel}}**, ao lado de **{{ui:comic.shape.cut}}**. O quadro selecionado (ou o maior quadro, se nenhum estiver selecionado) é dividido em dois por uma linha que corta ao meio o seu lado mais longo, e o novo quadro fica selecionado. Não é possível adicionar quadros quando a página já tem 24 ou quando o quadro é pequeno demais.

Para remover um quadro, selecione-o e clique em **{{ui:comic.shape.removePanel}}**. A imagem, os prompts e os balões dele vão junto. Na distribuição automática, os quadros restantes são distribuídos de novo. Em uma página cuja forma dos quadros foi alterada à mão, o quadro vizinho mais próximo cresce até o espaço liberado e mantém o próprio conteúdo; se a forma não permitir essa junção, a página volta à distribuição automática. O último quadro de uma página não pode ser excluído. Um quadro excluído pode ser trazido de volta com Ctrl+Z (colocar uma imagem em um quadro novamente não é desfeito).

Para desmarcar o quadro, clique na margem da página ou em qualquer lugar vazio ao redor da página.

O quadro selecionado mostra seus cantos como pontos redondos. Arraste um canto para mudar a forma do quadro. Um canto compartilhado com um quadro vizinho se move junto. Clique duas vezes em uma borda para acrescentar um canto, e clique duas vezes em um canto reto para removê-lo. Um canto não se move para um lugar onde os quadros se sobreporiam ou onde uma borda cruzaria outra.

No meio de cada borda do quadro selecionado aparece uma pequena barra (a alça da borda). Ao arrastar a alça, a borda inteira se move, e os quadros vizinhos mudam de forma junto. Uma borda não vai além da margem da página.

Em uma página cuja forma foi alterada à mão, clique em **{{ui:comic.shape.reset}}** em **{{ui:comic.page.settings}}** para voltar à distribuição automática. Ao mudar a quantidade ou as colunas de quadros, também se volta à distribuição automática. Ctrl+Z desfaz uma alteração de forma.

## A imagem do quadro

![Uma imagem colocada no quadro. Em volta da imagem reduzida e girada aparecem alças nos quatro cantos e no alto](shot:comic-image)

A imagem de um quadro não se limita às que você desenha. Arraste uma imagem da galeria sobre um quadro, e ela passa a ser a imagem desse quadro. Selecione um quadro e clique em **{{ui:comic.panel.imageUpload}}**, no alto do centro, para escolher um arquivo de imagem do computador. O arquivo entra primeiro na galeria e depois passa a ser a imagem do quadro.

A imagem do quadro é movida diretamente sobre a página, como na {{ui:app.tabs.canvas}}.

- Arraste a imagem para mudar a posição dela. Parte da imagem também pode ficar fora do quadro.
- Clique na imagem para selecioná-la: aparecem em volta dela uma moldura pontilhada e alças. A parte que sai do quadro também aparece, mais clara.
- Arraste uma alça de canto para ampliar ou reduzir a imagem em torno do centro dela.
- Arraste a alça redonda do alto para girar a imagem. Com Shift pressionado, ela gira de 15° em 15°.
- A imagem selecionada se move aos poucos com as setas do teclado (com Shift, ela se move mais).

As ferramentas no alto do centro também alteram a imagem. **{{ui:comic.image.fitCover}}** tira a rotação da imagem e a estende sobre o quadro inteiro. **{{ui:comic.image.fitContain}}** deixa a imagem num tamanho em que ela cabe inteira no quadro. **{{ui:comic.image.rotateLeft}}** e **{{ui:comic.image.rotateRight}}** giram a imagem de 90° em 90°, e **{{ui:comic.image.flipX}}** e **{{ui:comic.image.flipY}}** a espelham. **{{ui:comic.image.scaleDown}}** e **{{ui:comic.image.scaleUp}}** a reduzem e a ampliam aos poucos, e **{{ui:comic.image.center}}** leva o centro da imagem ao centro do quadro.

Para tirar a imagem de um quadro, selecione a imagem e pressione a tecla Delete, ou clique em **{{ui:comic.panel.imageClear}}**, no alto do centro. Mesmo removida, a imagem continua na galeria. Clique em **{{ui:comic.history.undo}}** no aviso que aparece logo depois da remoção, e a imagem volta com a posição e o tamanho que tinha. Ao colocar outra imagem no quadro, a posição e o tamanho voltam ao original.

## Trocar quadros de lugar

Pegue a alça de seis pontos (⠿) no canto superior esquerdo do quadro, arraste-a até o quadro com o qual deseja trocar e solte: os dois quadros trocam de lugar. A imagem, os prompts, a pose e os balões do quadro se movem junto com ele.

Ao pressionar a alça e começar a arrastar, uma cópia semitransparente do quadro que está sendo movido acompanha o ponteiro. O quadro de destino fica marcado com uma moldura.

## Definir a pose

![Tela para definir a pose do quadro, com um boneco de palitos](shot:comic-pose)

Escolha um quadro, clique no botão de pose no alto do centro para abrir a seção dele e clique em **{{ui:comic.panel.pose}}** para abrir a tela em que a pose é definida com um boneco de palitos. A pose é desenhada na forma desse quadro e, ao clicar em **{{ui:comic.pose.use}}**, ela passa a ser a pose do quadro. A pose pode ser reaberta e corrigida. A pose definida nessa tela é de uma pessoa. Para removê-la, clique em **{{ui:comic.panel.poseRemove}}**.

![Área de predefinições de pose do quadro. Escolha a categoria e a pose](shot:comic-presets)

Na mesma seção, uma pose também pode ser colocada a partir das mesmas predefinições de pose da aba Tela. Escolha a categoria em **{{ui:comic.panel.poseCategory}}**, escolha a pose em **{{ui:comic.panel.posePreset}}** e clique em **{{ui:comic.panel.poseApply}}**. Um boneco de palitos é criado no tamanho do quadro e passa a ser a pose desse quadro. Dependendo da composição, várias pessoas ficam lado a lado, e todas entram no quadro.

Para que a pose seja usada na imagem, é preciso ter instalado o modelo ControlNet de pose (OpenPose, ou um modelo union). Se ele não estiver instalado, a pose não é usada na imagem e aparece um aviso sobre isso.

## Balões e legendas

![Um balão recém-adicionado. A edição do balão aparece sobreposta ao quadro à direita](shot:comic-balloon)

Escolha um quadro, clique em **{{ui:comic.panel.bubbles}}** no alto do centro para abrir a seção e clique em **{{ui:comic.bubble.kind.speech}}**, **{{ui:comic.bubble.kind.thought}}**, **{{ui:comic.bubble.kind.shout}}** ou **{{ui:comic.bubble.kind.caption}}**: um balão desse tipo é acrescentado ao quadro, e **{{ui:comic.bubble.editor}}** se abre sobreposta à pasta à direita. A seção lista os balões do quadro pelo tipo e pelo texto. Clique em uma linha para selecionar esse balão, e clique no botão do lápis (**{{ui:comic.bubble.edit}}**) para abrir **{{ui:comic.bubble.editor}}**.

- {{ui:comic.bubble.kind.speech}}: uma elipse, à qual pode ser acrescentado um rabinho.
- {{ui:comic.bubble.kind.thought}}: uma elipse seguida de pequenos círculos, no lugar do rabinho.
- {{ui:comic.bubble.kind.shout}}: um balão de contorno serrilhado.
- {{ui:comic.bubble.kind.caption}}: uma moldura de cantos retos, sem rabinho.

![Balão com texto vertical e a alça redonda na ponta do rabinho](shot:comic-tail)

Os balões são posicionados arrastando-os sobre a página. Ao selecionar um balão, aparece uma alça redonda na ponta do rabinho. Ao arrastar essa alça, mudam a direção e o comprimento do rabinho. Para acrescentar ou tirar o rabinho, clique em **{{ui:comic.bubble.tail}}** em **{{ui:comic.bubble.editor}}**.

Clicar duas vezes em um balão na página também abre **{{ui:comic.bubble.editor}}**. A edição se abre sobreposta às pastas, à direita da tela, então não cobre a página (quando o painel direito está fechado ou estreito, ela se abre na borda direita da página). Ali é possível mudar **{{ui:comic.bubble.kindLabel}}**, o texto, **{{ui:comic.bubble.size}}**, **{{ui:comic.bubble.vertical}}** e **{{ui:comic.bubble.tail}}**. Para fechar, clique no × no canto superior direito ou pressione a tecla Esc. Depois de fechar, o balão continua selecionado.

O tamanho do texto pode ser escolhido de 60% a 220% em **{{ui:comic.bubble.size}}**. Ao clicar em **{{ui:comic.bubble.vertical}}**, o texto passa a ser escrito na vertical, em colunas que começam pela direita.

O que não for mais necessário pode ser excluído com a lixeira da linha na seção ou com **{{ui:comic.bubble.remove}}** em **{{ui:comic.bubble.editor}}**. Também é possível selecionar um balão na página e pressionar a tecla Delete.

## Configurações de geração

{{ui:params.model.label}}, {{ui:params.lora.label}}, {{ui:params.advanced.vae}}, {{ui:params.refImage.sectionLabel}} e {{ui:params.hires.title}} são os mesmos da aba {{ui:app.tabs.generate}}. Ao mudar essas configurações na coluna esquerda, a aba {{ui:app.tabs.generate}} também passa a usar a mudança. Só os prompts são separados para cada quadro (veja “Prompts do quadro”).

Cada quadro recebe uma única imagem. Por isso, o tamanho da imagem é definido pelo tamanho do quadro, e não pelas configurações da aba {{ui:app.tabs.generate}}. O campo de iterações não aparece no quadrinho.

## Imagem de referência de cada quadro

Um quadro pode ter uma imagem de referência própria, além das imagens de referência da aba {{ui:app.tabs.generate}}. Ela serve para que o desenho do quadro siga a aparência do rosto ou da roupa de um personagem. Em **{{ui:params.refImage.sectionLabel}}**, no quadro selecionado, arraste uma imagem da galeria ou escolha um arquivo de imagem com **{{ui:comic.panel.imageUpload}}**.

A imagem de referência só é usada ao desenhar o quadro. As imagens de referência da aba {{ui:app.tabs.generate}}, se houver, são usadas junto com ela. Escolha o modelo do IP-Adapter em **{{ui:params.refImage.model}}** e a força em **{{ui:params.refImage.weight}}** (de 0 a 1; o padrão é 0,5). Nos modelos que não são FLUX, você também pode escolher **{{ui:params.refImage.clipVision}}** e **{{ui:params.refImage.methodLabel}}**. A lista de modelos mostra apenas os modelos do IP-Adapter que combinam com o modelo principal.

Para remover a imagem de referência, clique em **{{ui:comic.reference.remove}}**. A imagem continua na galeria. Uma alteração na imagem de referência pode ser desfeita com Ctrl+Z.

Quando nenhum modelo do IP-Adapter é escolhido ou instalado para a imagem de referência, ou quando a imagem dela não está na galeria, a imagem de referência não é usada. A imagem de referência usa os mesmos modelos do IP-Adapter e a mesma extensão das imagens de referência da aba {{ui:app.tabs.generate}}.

## Transformar a página em uma única imagem

Clique em **{{ui:comic.page.export}}**, no alto do centro, para salvar a página como uma imagem (PNG) na galeria. As imagens dos quadros e o texto dos balões e das legendas são desenhados nessa imagem. A imagem de cada quadro é desenhada com a posição, o tamanho, a rotação e o espelhamento que recebeu na página. O texto é desenhado com fontes instaladas no Windows, inclusive as japonesas. O tamanho da imagem segue o tamanho do papel, a 200 dpi.

## Desfazer e refazer

Pressione **{{ui:comic.history.undo}}**, embaixo à esquerda, abaixo da página, para desfazer a última alteração e **{{ui:comic.history.redo}}** para refazer uma alteração desfeita. No teclado, Ctrl+Z desfaz e Ctrl+Shift+Z (ou Ctrl+Y) refaz (no Mac, use Command no lugar de Ctrl). Ao desfazer, voltam a disposição das páginas e dos quadros (incluindo a forma deles), os prompts e as poses dos quadros, os balões e as imagens de referência dos quadros. As imagens dos quadros (colocar, tirar e mover), os modelos e o nome do quadrinho não são desfeitos. Um texto digitado no mesmo campo sem pausa é desfeito de uma vez. Com o cursor em um campo de texto, Ctrl+Z altera apenas o texto desse campo.

## Salvar e excluir

O quadrinho é salvo automaticamente cerca de 1 segundo depois de cada alteração. Mesmo depois de fechar e abrir o app de novo, os projetos salvos continuam na lista, e as páginas, os quadros, os balões e os modelos permanecem como estavam. Eles também entram nos backups.

Para excluir um projeto, abra o menu da linha dele na lista de quadrinhos, clique em **{{ui:comic.project.delete}}** e clique de novo para confirmar. Ao excluir um projeto, as páginas, os quadros e os modelos dele também são apagados. As imagens desenhadas continuam na galeria.

Para excluir uma página, clique no botão da lixeira abaixo da página (**{{ui:comic.page.delete}}**) e clique de novo para confirmar. Os quadros e os balões da página são removidos, mas as imagens desenhadas continuam na galeria.

## Usar as imagens desenhadas

As imagens desenhadas são imagens comuns, que entram na galeria. As operações de outras telas que usam imagens da galeria, como arrastar uma imagem da galeria para a aba {{ui:app.tabs.canvas}}, continuam funcionando normalmente.
