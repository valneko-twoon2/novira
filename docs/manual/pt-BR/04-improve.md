# Corrigir e reutilizar imagens

Este capítulo reúne os recursos para quando, depois de pronta a imagem, você pensa “quero corrigir um pouco”, “quero mais algumas imagens com o mesmo clima” ou “quero usar este personagem em outra cena”.

A maioria dos recursos é chamada pelos botões da barra de ferramentas acima do visualizador (a tela para ver a imagem em tamanho grande) ou pelo menu do botão direito numa imagem da galeria. Os botões da barra de ferramentas mostram o nome quando o mouse passa por cima. O básico do visualizador e da galeria está em [Galeria e visualizador](03-gallery.md).

## O que usar e onde

| O que se quer fazer | O que usar | O que mais é preciso |
|---|---|---|
| Criar mais algumas imagens com as mesmas configurações ou refazer mudando só um pouco | **{{ui:gallery.derive.menu}}** | O modelo usado na imagem original estar instalado |
| Apagar o fundo e deixar só a pessoa ou o objeto | **{{ui:cutout.menu}}** | Extensão ComfyUI-RMBG |
| Eliminar as margens transparentes | **{{ui:gallery.menu.trim}}** (só no botão direito) | Nada |
| Pintar uma parte da imagem para apagar, recortar ou redesenhar | **{{ui:gallery.menu.segment}}** | Para apagar, a extensão comfyui-inpaint-nodes |
| Limpar um rosto pequeno que saiu desfeito | **{{ui:facefix.menu}}** | Extensões ComfyUI-Impact-Pack e ComfyUI-Impact-Subpack |
| Transformar a imagem em um original de mangá em preto e branco | **{{ui:gallery.manga.menu}}** (só na barra de ferramentas do visualizador) | Extensão ComfyUI-MangaScreen |
| Extrair um prompt a partir de uma imagem | **{{ui:caption.menu}}** | Extensão ComfyUI-Florence2 |
| Registrar um personagem para usá-lo em outras imagens | **{{ui:character.menu}}** | Extensão para imagens de referência (IP-Adapter) |
| Alinhar numa tabela imagens com configurações diferentes | **{{ui:xyplot.menu}}** | Nada |
| Escolher entre candidatos desenhados até a metade | Aba **{{ui:app.views.drafts}}** | Nada |
| Aplicar o mesmo processamento a várias imagens | **{{ui:gallery.menu.batch}}** (selecione várias e clique com o botão direito) | Depende do processamento |

## Como usar as ferramentas de correção

{{ui:facefix.menu}}, {{ui:cutout.menu}}, {{ui:caption.menu}} e {{ui:canvas.poseFromImage.menu}} ficam reunidos sob **{{ui:gallery.tools.heading}}** no menu do botão direito de uma imagem da galeria. Todos são usados numa faixa que se abre acima do visualizador. A imagem continua no visualizador, então dá para conferir enquanto se amplia e se move.

- Ao escolher um item, ele é executado de imediato com as configurações da vez anterior. A imagem aparece no visualizador, e a faixa mostra o progresso.
- O botão de engrenagem à direita do item abre as configurações na faixa, sem executar. Mude as configurações e clique em **{{ui:gallery.tools.run}}**. As configurações alteradas também valem na próxima execução.
- Os botões **{{ui:cutout.menu}}**, **{{ui:facefix.menu}}** e **{{ui:caption.menu}}** da barra de ferramentas do visualizador também abrem as configurações da faixa. Clicando de novo, ela se fecha.
- O botão à esquerda da faixa troca para outra ferramenta.
- Ao terminar, a faixa mostra o resultado e as configurações usadas. Clicando em **{{ui:gallery.tools.edit}}**, você volta às configurações e pode mudá-las e executar de novo.
- O processamento avança pela fila. Fechar a faixa, ir para outra imagem ou outra tela não o interrompe. O único jeito de interromper é **{{ui:common.cancel}}**, na faixa. O resultado de um processamento que cria imagem é salvo na galeria mesmo com a faixa fechada.

## Quando uma extensão é necessária

Funções como remover o fundo e corrigir rostos funcionam acrescentando “extensões” ao mecanismo que cria as imagens (ComfyUI). Se a extensão não estiver instalada, a faixa mostra “… exige a extensão ○○.” e botões para instalar.

1. Clique em **{{ui:gallery.tools.install}}**. O que é necessário é baixado e instalado automaticamente. A instalação avança em segundo plano, e o progresso aparece no indicador de download. Fechar a faixa não a interrompe.
2. Terminada a instalação, o botão da faixa passa a ser **{{ui:gallery.tools.restart}}**. Ao clicar, o ComfyUI é reiniciado.
3. Depois da reinicialização, a ferramenta já pode ser usada.

No primeiro uso, também começa o download dos modelos que a extensão utiliza, e isso leva tempo. É preciso estar conectado à internet. Esse download acontece dentro do processamento executado, então fechar a faixa não o interrompe.

> Algumas extensões levam tempo e espaço para instalar. A ComfyUI-Impact-Pack exige o Git para ser instalada. Em um computador sem o Git, a instalação falha. Se aparecer uma mensagem, leia-a antes de agir.

As extensões também podem ser instaladas na aba “{{ui:workflows.panel.packs}}” de [Fluxos de trabalho](06-upscaling-workflows.md). Se algo não funcionar, veja também [Solução de problemas](10-troubleshooting.md).

## Criar de novo com as mesmas configurações (derivar)

![A opção de derivar aberta na barra de ferramentas do visualizador](shot:derive-menu)

Abra no visualizador a imagem de que você gostou e clique no botão **{{ui:gallery.derive.menu}}** da barra de ferramentas (ícone de ramificação). Na galeria, clique com o botão direito na imagem e escolha **{{ui:gallery.derive.menu}}**.

Há 3 tipos para escolher:

| Item | O que faz |
|---|---|
| “Mesmas configurações, outra seed” (1 ou 4 imagens) | Mantém prompt, modelo, tamanho etc. e muda só a seed. A composição muda, mas o clima é o mesmo. |
| “Refazer mudando só um pouco” (1 ou 4 imagens) | Usa a imagem original como base e a redesenha de leve (com intensidade 0,45). Os detalhes mudam, mas a composição e as cores permanecem. |
| **{{ui:gallery.derive.custom}}** | Você decide o quanto mudar (próximo item). |

Ao escolher, a nova imagem entra na fila e aparece na mesma pasta da imagem original. **As configurações da aba de geração não são reescritas.** O prompt que você estava digitando também continua como está.

> Para trazer as configurações de volta à tela e então ajustá-las você mesmo, use **{{ui:gallery.menu.remix}}**. Derivar serve para “criar com um único botão, com as configurações originais”.

### Escolher o quanto mudar e refazer

![A caixa de diálogo para definir o quanto mudar](shot:derive)

Ao escolher **{{ui:gallery.derive.custom}}**, abre-se uma caixa de diálogo.

1. Mova o controle deslizante **{{ui:gallery.derive.dialog.strength}}**. Quanto mais à esquerda ({{ui:gallery.derive.dialog.close}}), mais se mantêm a composição e as cores originais; quanto mais à direita ({{ui:gallery.derive.dialog.free}}), mais a imagem se aproxima de outra.
2. Escolha **{{ui:gallery.derive.dialog.count}}** entre 1, 2, 4 e 8.
3. Clique em **{{ui:gallery.derive.dialog.create}}**.

Como referência, perto de 0,25 sai uma imagem quase igual à original, e perto de 0,75 sai uma em que o personagem permanece mas a composição muda bastante. Varia de imagem para imagem, então experimente algumas vezes. O valor do controle deslizante vale apenas para essa vez.

### O que é mantido e o que não é

- Mantidas: as configurações usadas na criação da imagem, como prompt, prompt negativo, modelo, LoRA, tamanho, número de passos, escala de CFG e agendador.
- As imagens de referência e as camadas de controle também ficam memorizadas junto com a imagem e são usadas como estão. Mas, se alguma dessas imagens tiver sido excluída da galeria, não é possível criar. O motivo aparece numa notificação.
- Não mantidas: máscara, orientação por regiões e configurações de rascunho. Se a imagem foi criada antes de existir este recurso e usava imagens de referência etc., isso não foi memorizado e não pode ser mantido. Quando algo não é mantido, uma notificação avisa.

Nos casos a seguir, o botão não pode ser clicado ou aparece uma notificação e a criação não é feita.

- Se a imagem não foi criada a partir de texto (incluindo imagem para imagem, inpaint e outpaint). Imagens ampliadas, vídeos, áudios etc. ficam de fora.
- Se o modelo usado na imagem original não estiver instalado. Aparece uma notificação com o nome do modelo.

## Remover o fundo

![Removendo o fundo na faixa do visualizador e comparando com a imagem original](shot:cutout)

O app reconhece automaticamente o que aparece na imagem e cria uma imagem sem o fundo. Não é preciso indicar nada com cliques.

1. Clique com o botão direito numa imagem da galeria e escolha **{{ui:cutout.menu}}** em **{{ui:gallery.tools.heading}}**, e ele é executado de imediato com as configurações da vez anterior. Para mudar as configurações antes, abra a faixa pela engrenagem à direita do item ou pelo botão de tesoura da barra de ferramentas do visualizador.
2. Na faixa, mude as configurações se necessário.
   - **{{ui:cutout.model}}**: normalmente pode ficar como está.
   - **{{ui:cutout.sensitivity}}**: quanto mais baixo, mais se mantêm também as partes de limite impreciso.
   - **{{ui:cutout.edge}}**: valores positivos ampliam o contorno e valores negativos o reduzem.
   - **{{ui:cutout.background}}**: escolha **{{ui:cutout.background.alpha}}** ou **{{ui:cutout.background.white}}**.
3. Clique em **{{ui:gallery.tools.run}}**.

A imagem pronta é salva como imagem nova, na mesma pasta da original. **A imagem original permanece.** O visualizador passa a mostrar a imagem nova ao lado da original para comparar. Se o resultado não agradar, clique em **{{ui:gallery.tools.edit}}**, mude as configurações e execute de novo.

O fundo branco é indicado para quando a imagem for usada depois como imagem de referência de um [personagem](#registrar-e-usar-um-personagem). A cor do fundo passa menos para as imagens novas.

## Eliminar as margens transparentes

Numa imagem com fundo transparente, sobra uma margem transparente em volta. Com **{{ui:gallery.menu.trim}}**, é salva uma nova imagem transparente, cortada rente à parte desenhada. É útil para usar como adesivo ou material.

- Clique com o botão direito numa imagem da galeria e escolha. Logo depois de remover o fundo, o mesmo pode ser feito por **{{ui:cutout.trim}}**, na faixa (que só aparece quando o fundo foi tornado transparente).
- Sombras tão fracas que quase não se veem são cortadas como margem.
- Se a parte transparente não chega até a borda da imagem, aparece “Não há margem para cortar” e nada é salvo. Uma imagem inteiramente transparente também não pode ser cortada.

## Selecionar uma região e corrigi-la

Pinte com o pincel a parte que quer corrigir para selecioná-la. A imagem é aberta na [tela de desenho](05-canvas.md), então dá para pintar com precisão ampliando e movendo.

1. Abra a imagem no visualizador e clique em **{{ui:gallery.menu.segment}}** (também dá para escolher no botão direito da galeria).
2. A tela de desenho abre com a imagem e uma **{{ui:canvas.add.inpaint}}** vazia selecionada. A ferramenta é o **{{ui:canvas.tool.brush}}**.
3. Pinte a parte que quer corrigir. O que foi pintado demais é retirado com a **{{ui:canvas.tool.eraser}}**. Para selecionar o resto, clique com o botão direito na máscara e escolha **{{ui:canvas.entityMenu.invertMask}}**.
4. Escolha o que fazer com a parte pintada. Ao selecionar a linha da máscara, aparecem embaixo um campo de entrada e botões (apagar e recortar também estão no menu do botão direito da máscara).

| O que se quer fazer | Operação | O que é preciso |
|---|---|---|
| Apagar misturando com o entorno | **{{ui:canvas.partFix.erase}}**. O resultado fica provisoriamente na tela; escolha **{{ui:canvas.staging.accept}}** ou descarte. | Extensão comfyui-inpaint-nodes. Com o modelo LaMa (cerca de 200 MB), a remoção fica natural. Sem ele, ainda dá para apagar de forma simples. |
| Salvar só a parte pintada como uma imagem transparente | **{{ui:canvas.partFix.cutOutAction}}** | Nada |
| Redesenhar com uma instrução em texto | Escreva no campo o que redesenhar, como “laço azul”, e clique em **{{ui:canvas.partFix.redraw}}**. Só a parte pintada é redesenhada com o modelo e as configurações da aba de geração. Se o campo estiver vazio, usa-se o prompt da aba de geração. O prompt da aba de geração não é reescrito. O resultado fica provisoriamente na tela; escolha **{{ui:canvas.staging.accept}}** ou descarte. | Um modelo de imagem |
| Aplicar mosaico | Sem usar máscara, passe diretamente a ferramenta **{{ui:canvas.tool.mosaic}}** sobre a imagem. | Nada |

A imagem original não muda. O recorte é salvo na galeria como uma imagem nova.

## Corrigir rostos

![As configurações de correção de rosto abertas na faixa do visualizador](shot:facefix)

Em imagens com o personagem distante, rostos pequenos costumam sair desfeitos. **{{ui:facefix.menu}}** encontra automaticamente os rostos da imagem, redesenha só eles em alta resolução e os devolve à imagem original. O que não é rosto não muda.

1. Clique com o botão direito numa imagem da galeria e escolha **{{ui:facefix.menu}}** em **{{ui:gallery.tools.heading}}**, e ele é executado de imediato. Para conferir as configurações antes de executar, abra a faixa pela engrenagem à direita do item ou pelo botão **{{ui:facefix.menu}}** da barra de ferramentas do visualizador.
2. Só na primeira vez, são necessárias as extensões ComfyUI-Impact-Pack e ComfyUI-Impact-Subpack. Instale com **{{ui:gallery.tools.install}}**, na faixa, e clique em **{{ui:gallery.tools.restart}}**. O modelo que encontra os rostos é preparado pela própria Subpack.
3. Confira as configurações.
   - **{{ui:facefix.model}}**: vem selecionado o modelo usado na imagem original.
   - **{{ui:facefix.detector}}**: o modelo usado para encontrar rostos. Normalmente pode ficar como está.
   - **{{ui:facefix.prompt}}**: vem com o prompt da imagem original. Acrescentar características do rosto funciona bem.
   - **{{ui:facefix.strength}}**: quanto mais baixo, mais perto do rosto original; quanto mais alto, mais se redesenha.
   - **{{ui:facefix.sensitivity}}**: subindo, só rostos seguros são encontrados; descendo, também se encontram rostos pequenos e de perfil. Em compensação, fica mais fácil apanhar o que não é rosto.
4. Clique em **{{ui:gallery.tools.run}}**.

O resultado é salvo na mesma pasta da imagem original, e o visualizador passa a mostrá-lo ao lado da original. Se não gostar, clique em **{{ui:gallery.tools.edit}}**, mude as configurações e execute de novo. O modelo e o conteúdo a redesenhar ficam memorizados apenas enquanto se usa a mesma imagem.

> Uma imagem criada com LoRA é redesenhada sem a LoRA. Por isso, o estilo só do rosto pode parecer um pouco diferente.

> Se aparecer “O modelo que encontra rostos (YOLO) não foi encontrado”, reinicie o ComfyUI ou instale a extensão de novo.

## Finalizar a imagem como original de mangá

**{{ui:gallery.manga.menu}}**, na barra de ferramentas do visualizador, transforma a imagem aberta em um original de mangá em preto e branco, com traços nítidos. As sombras viram áreas planas e trama de retícula de verdade (pontos), e as linhas principais dentro dos pretos chapados são vazadas em branco, finas. Ao desenhar, sai sempre uma imagem colorida comum; este acabamento é uma operação posterior, feita sobre a imagem de que você gostou.

1. Abra a imagem no visualizador e clique em **{{ui:gallery.manga.menu}}**. À esquerda aparece a imagem original.
2. Só na primeira vez, é necessária a extensão ComfyUI-MangaScreen. Se ela não estiver instalada, aparece uma orientação: clique em **{{ui:gallery.manga.installPack}}** e, depois de instalar, em **{{ui:gallery.manga.restartEngine}}**. Até a instalação terminar, os botões de baixo não podem ser clicados.
3. Se necessário, mude os valores (eles são memorizados para a próxima vez).
   - **{{ui:gallery.manga.screenLines}}**: o número de linhas de pontos ao longo da largura. 120 é grosso, 200 é o padrão e 300 é fino.
   - **{{ui:gallery.manga.whitePoint}}**: o que é mais claro que isso vira branco de papel. Baixando, somem os tons da pele e dos cabelos claros.
   - **{{ui:gallery.manga.blackPoint}}**: o que é mais escuro que isso vira preto chapado. Subindo, aumentam as áreas pretas.
   - **{{ui:gallery.manga.gradation}}**: expressa sombras que escurecem suavemente pelo tamanho dos pontos, sem degraus. Com 0, ficam só áreas planas.
   - **{{ui:gallery.manga.whiteLines}}**: a quantidade de linhas vazadas em branco dentro dos pretos chapados. 0 desativa.
   **{{ui:gallery.manga.reset}}** devolve todos os valores ao padrão.
4. Clique em **{{ui:gallery.manga.tryRun}}** e o resultado aparece à direita, para comparar com a imagem original. Só experimentar não salva nada.
5. Se gostar, clique em **{{ui:gallery.manga.save}}**. A imagem finalizada é salva como imagem nova, na mesma pasta da original, e a original não muda. Com **{{ui:gallery.manga.open}}**, a imagem é aberta.

Ao salvar, o acabamento é refeito com os valores que você está vendo, então leva o mesmo tempo que o teste.

## Criar um prompt a partir de uma imagem

![Escrevendo tags olhando a imagem, na faixa do visualizador](shot:caption)

O app olha a imagem e escreve o prompt (tags ou frases) que a desenharia. Serve para quando se quer criar imagens parecidas com uma de que se gostou ou quando não se sabe como escrever o prompt.

1. Clique com o botão direito numa imagem da galeria e escolha **{{ui:caption.menu}}** em **{{ui:gallery.tools.heading}}**, e ele escreve de imediato. O botão **{{ui:caption.fromPrompt}}**, acima do campo do prompt na aba de geração, faz o mesmo. Esse botão usa a imagem selecionada na galeria e, se nenhuma estiver selecionada, abre a tela para escolher um arquivo de imagem. Também funciona soltar neste botão uma imagem da galeria ou um arquivo de imagem do computador.
2. Para mudar o modo de escrever, clique em **{{ui:gallery.tools.edit}}**, na faixa, e escolha **{{ui:caption.style.tags}}** ou **{{ui:caption.style.sentence}}** em **{{ui:caption.style}}**.
3. Clique em **{{ui:gallery.tools.run}}**.
4. As palavras que aparecem podem ser corrigidas ali mesmo, na faixa. Clique em **{{ui:caption.replace}}**, **{{ui:caption.append}}** ou **{{ui:caption.copy}}**.

O destino de substituir ou acrescentar é o campo “{{ui:params.prompt.positive}}” da aba de geração. Este recurso não acrescenta imagens à galeria.

> Este recurso exige a extensão ComfyUI-Florence2. Se ela não estiver instalada, é possível instalá-la pela faixa (veja “Quando uma extensão é necessária”, neste capítulo). No primeiro uso, começa o download do modelo que transforma a imagem em palavras (Florence-2 PromptGen).

## Registrar e usar um personagem

![A caixa de diálogo para registrar como personagem](shot:character)

Se você registrar o desenho de um personagem de que gosta, poderá criar imagens de outras cenas aproximadas do mesmo personagem. São registradas 3 coisas:

- Imagens de referência (desenhos do mesmo personagem, quantas quiser)
- Palavras de aparência (cor do cabelo e dos olhos, roupas etc., acrescentadas ao início do prompt)
- A intensidade da semelhança

### Registrar

1. Na galeria, selecione as imagens que quer registrar. Para várias, clique segurando `Ctrl`.
2. Clique no botão **{{ui:character.menu}}** do visualizador ou escolha **{{ui:character.menu}}** no menu do botão direito. Também é possível abrir pelo campo **{{ui:character.row.choose}}** da aba de geração: no fim da lista há **{{ui:character.row.register}}**.
3. Digite **{{ui:character.name}}** e **{{ui:character.tags}}**. Escreva as características que não devem mudar (cabelo castanho, blusa branca, saia azul etc.).
4. Defina **{{ui:character.weight}}**. Quanto mais alto, mais se parece com as imagens de referência, mas menos liberdade há na cena e na composição.
5. Clique em **{{ui:character.save}}**.

Com **{{ui:character.addSelected}}**, é possível acrescentar depois como imagens de referência as imagens selecionadas na galeria. **{{ui:character.removePicture}}** é o ✕ no canto superior direito da imagem.

Ativando **{{ui:character.whiteBg}}**, é criada uma versão da imagem registrada com o fundo trocado por branco, e ela passa a ser a imagem de referência. Isso evita que a cor do fundo passe para as imagens geradas. A imagem original permanece, e a imagem de fundo branco é salva como nova. Se a extensão ComfyUI-RMBG, usada para remover o fundo, não estiver instalada, essa chave não pode ser usada e a imagem original é usada como está.

### Usar

1. No painel esquerdo da aba **{{ui:app.tabs.generate}}** (ou da aba [Tela](05-canvas.md)), abra **{{ui:character.row.choose}}** e escolha o personagem que quer usar.
2. As imagens de referência do personagem entram no campo “{{ui:params.refImage.sectionLabel}}”, e as palavras de aparência são acrescentadas ao início do prompt.
3. Gere como de costume.

Ao usar, o app às vezes faz ajustes automáticos. Uma notificação avisa.

- Com imagens de referência, uma escala de CFG alta faz a imagem queimar com facilidade; por isso, se a escala de CFG for maior que 5, ela é reduzida para 4,5.
- As imagens de referência são no máximo 8 no total. Se, somadas às outras imagens de referência, passarem de 8, são usadas a partir da primeira.
- Quando há várias imagens de referência, a intensidade de cada uma é reduzida automaticamente, para que não se sobreponham e fiquem fortes demais.
- Imagens excluídas da galeria não podem ser usadas. Se todas foram excluídas, o personagem não pode ser usado.

Para corrigir ou excluir um personagem registrado, use o botão “…” do item na lista.

> É um recurso para “se aproximar” do mesmo personagem, e o rosto não sai exatamente igual. Penteado, cor, roupas etc. tendem a se manter, mas os traços do rosto mudam um pouco. As características que se quer manter funcionam melhor se forem escritas nas palavras de aparência.

> Para usar imagens de referência, são necessários a extensão ComfyUI_IPAdapter_plus e um modelo para imagens de referência. Se não estiverem instalados, é possível instalá-los pelo campo de imagem de referência da aba de geração. Para os modelos, veja o capítulo [Modelos](08-models.md).

## Escolher uma LoRA para o personagem

Na caixa de diálogo de edição do personagem, é possível escolher uma LoRA em **{{ui:lora.section}}**. Depois de escolhida, dá para ligar e desligar com **{{ui:lora.use}}** e mudar **{{ui:lora.weight}}**, e, ao usar o personagem, a LoRA e as palavras-gatilho entram no prompt. O treinamento de LoRA é feito por outro app, o novira-train.

## Comparar configurações com uma grade de comparação

![A caixa de diálogo da grade de comparação](shot:xyplot)

É um recurso para ver como a imagem muda quando se altera a escala de CFG ou o número de passos, alinhando tudo numa única tabela.

1. Na aba de geração, defina o prompt e o modelo como de costume.
2. Clique na seta “▼” à direita do botão **{{ui:params.invoke.invoke}}** e escolha **{{ui:xyplot.menu}}**.
3. Em **{{ui:xyplot.x}}** e **{{ui:xyplot.y}}**, escolha as configurações a variar. Também é possível criar com apenas uma delas.
4. Digite os valores. Os números são separados por vírgula (exemplo: 3, 5, 7).
5. Clique em **{{ui:xyplot.run}}**.

Embaixo da caixa de diálogo aparece quantas imagens serão criadas, como em “Serão criadas 6 imagens (3 colunas × 2 linhas).”

As configurações que podem ser variadas são estas:

| Configuração | Como digitar |
|---|---|
| {{ui:xyplot.axis.cfgScale}} | Número (1 a 30) |
| {{ui:xyplot.axis.steps}} | Inteiro (1 a 150) |
| {{ui:xyplot.axis.seed}} | Inteiro |
| {{ui:xyplot.axis.strength}} | Número (0,05 a 1). Só vale ao criar imagem para imagem. |
| {{ui:xyplot.axis.scheduler}} | Escolha na lista |
| {{ui:xyplot.axis.model}} | Escolha na lista modelos da mesma família |
| {{ui:xyplot.axis.prompt}} | Escreva um por linha. Eles são acrescentados ao prompt |

As regras são estas:

- Uma configuração aceita até 8 valores. A tabela tem no máximo 36 imagens no total.
- Não é possível escolher a mesma configuração na horizontal e na vertical.
- Todas as imagens são desenhadas com a **mesma seed** (exceto quando se escolhe a configuração que varia a seed). A única diferença é a configuração que foi variada.
- As configurações são tiradas do formulário da aba de geração naquele momento. O formulário não é reescrito.
- As imagens que não puderam ser criadas aparecem como × na tabela. A tabela é feita com as demais.

A tabela pronta é salva na galeria como uma única imagem. Com **{{ui:xyplot.open}}**, ela pode ser exibida no visualizador. As imagens individuais que deram origem à tabela também permanecem na galeria.

> Com muitas imagens, leva-se muito tempo. Para 36 imagens, são necessárias 36 gerações. Recomenda-se começar testando 2 ou 3 valores.

## Escolher entre rascunhos

![A aba de rascunhos com os candidatos desenhados até a metade alinhados](shot:drafts)

Dependendo da seed, a imagem muda muito. Os rascunhos desenham “até a metade” com muitas seeds e só terminam a composição de que você gostou. Isso economiza tempo.

Abra a aba **{{ui:app.views.drafts}}**, no centro da aba **{{ui:app.tabs.generate}}**.

1. Escolha **{{ui:drafts.model}}**. No começo, vem selecionado o modelo da aba de geração. Entre os modelos de imagem que podem ser escolhidos na aba de geração, além de SDXL e SD1.X, também é possível escolher modelos só de corpo principal, como Anima, Flux, FLUX.2 e Z-Image. Os modelos de edição (Flux Fill, Flux Kontext, Qwen-Image-Edit) servem para corrigir a imagem original e por isso não estão na lista; quando um deles está em uso, o nome aparece embaixo.
2. Defina **{{ui:drafts.count}}** (de 1 a 24 imagens; no começo são 4, e dá para mudar em **{{ui:settings.draftCount.label}}**, nas configurações). A quantidade e a posição permanecem com os valores definidos na tela, mesmo ao trocar para outras telas, até o app ser fechado.
3. Defina **{{ui:drafts.position}}** (25 a 60%; no começo, 35%). Quanto menor, mais rápido fica, mas a imagem sai mais grosseira.
4. Clique em **{{ui:drafts.start}}**.

As imagens dos rascunhos se alinham à medida que ficam prontas. Para o prompt e as demais configurações, valem as da aba de geração.

Ao clicar numa imagem, ela é selecionada (clicando de novo, é desmarcada). Com duplo clique, ela é vista em tamanho grande no visualizador. O botão de estrela (**{{ui:drafts.keep}}**) e o ✕ (**{{ui:drafts.reject}}**) são marcas para uso próprio. Ao clicar no botão “{{ui:manual.drafts.finish}} ○ imagens”, embaixo à direita (○ é o número de imagens selecionadas), as imagens selecionadas são desenhadas até o fim. Para escolher de novo, clique em **{{ui:drafts.clearSelection}}**.

As imagens desenhadas até o fim entram na galeria como numa geração comum, e “{{ui:drafts.badge.finished}}” aparece sobre o rascunho. Se houver rascunhos que falharam, aparece o botão “{{ui:manual.drafts.retry}} ○ com falha”.

> “{{ui:manual.drafts.finish}}” não quer dizer retomar do meio. Com a mesma seed, a imagem é redesenhada do começo ao fim. Por isso, o tempo até ficar pronta é o mesmo de uma geração comum. Sai a imagem com a composição vista no rascunho.

> Os rascunhos podem ser usados na geração a partir de texto e no redesenho com uma imagem colocada em **{{ui:params.i2i.title}}**. Em {{ui:params.i2i.title}}, o desenho vai até a proporção da posição, dentro dos passos que realmente seriam desenhados conforme **{{ui:params.image.strength}}**. As imagens dos rascunhos não aparecem na lista da galeria.

Os rascunhos se alinham nas abas do alto, “na ordem em que foram iniciados”. Só os 5 mais novos aparecem nas abas. Todos os rascunhos podem ser vistos na tela **{{ui:drafts.history.title}}**, aberta pelo botão “Histórico” à esquerda das abas.

- Na coluna da esquerda, ao escolher o período ({{ui:drafts.history.period.today}}, {{ui:drafts.history.period.yesterday}}, {{ui:drafts.history.period.week}}, {{ui:drafts.history.period.older}}) e o modelo, só os rascunhos correspondentes aparecem. No campo de cima, é possível procurar por palavras do prompt ou do nome do modelo.
- Os rascunhos se dividem por data, e aparecem as imagens desenhadas na ocasião, a hora, o tamanho e o número de rascunhos e de imagens finalizadas.
- **{{ui:drafts.history.open}}** abre o rascunho, e **{{ui:drafts.history.reuse}}** devolve as configurações dele aos campos de geração.

Quando não precisar mais, feche pelo ✕ da aba ou do histórico. Em “{{ui:drafts.closeOlder}}”, na tela do histórico, também é possível fechar de uma vez os mais antigos que não estão nas abas.

## Processar em lote

![A caixa de diálogo de processamento em lote](shot:batch)

Remover o fundo e ampliar podem ser aplicados de uma vez a várias imagens selecionadas.

1. Na galeria, selecione várias imagens (clique segurando `Ctrl`, ou clique segurando `Shift` para selecionar um intervalo).
2. Clique com o botão direito sobre as imagens selecionadas e escolha **{{ui:gallery.menu.batch}}**.
3. Escolha o processamento.
   - **{{ui:batch.op.removeBackground.title}}**: torna o fundo transparente. Exige a extensão ComfyUI-RMBG. Se ela não estiver instalada, aparece o botão de instalar.
   - **{{ui:batch.op.upscale.title}}**: amplia com um modelo de ampliação. Se não houver o modelo, instale-o pela tela de [Modelos](08-models.md).
4. Clique em **{{ui:batch.run}}**.

Cada imagem entra na fila como um item separado. O progresso pode ser visto na aba **{{ui:app.tabs.queue}}**. Os resultados entram como imagens novas, na mesma pasta da original. A imagem original não muda.

Para processar uma única imagem com cuidado, mudando as configurações, use os recursos individuais deste capítulo ([Remover o fundo](#remover-o-fundo)). Para ampliar uma imagem, também é possível usar a aba de [ampliação](06-upscaling-workflows.md).
