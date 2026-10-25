# Corrigir e reutilizar imagens

Este capítulo reúne os recursos para quando você pensa “quero corrigir um pouco esta imagem pronta”, “quero mais algumas no mesmo clima” ou “quero usar este personagem em outra cena também”.

A maioria dos recursos é acessada por um botão da barra de ferramentas acima do visualizador (a tela que mostra uma imagem em tamanho grande) ou pelo menu que aparece ao clicar com o botão direito em uma imagem da galeria. Passe o mouse sobre um botão da barra de ferramentas para ver seu nome. Para o básico do visualizador e da galeria, veja [A galeria](03-gallery.md).

## O que usar e onde

| O que você quer fazer | O que usar | O que mais é necessário |
|---|---|---|
| Criar mais algumas com as mesmas configurações, ou refazer uma com pequenas alterações | **{{ui:gallery.derive.menu}}** | O modelo usado na imagem original está instalado |
| Remover o fundo e manter só a pessoa ou o objeto | **{{ui:cutout.menu}}** | A extensão ComfyUI-RMBG |
| Aparar margens transparentes | **{{ui:gallery.menu.trim}}** (somente com o botão direito) | Nada |
| Selecionar parte de uma imagem e depois recortá-la, apagá-la ou repintá-la | **{{ui:gallery.menu.segment}}** | Uma extensão como ComfyUI-segment-anything-2 |
| Arrumar rostos pequenos e deformados | **{{ui:facefix.menu}}** | As extensões ComfyUI-Impact-Pack e ComfyUI-Impact-Subpack |
| Escrever um prompt a partir de uma imagem | **{{ui:caption.menu}}** | A extensão ComfyUI-Florence2 |
| Registrar um personagem e usá-lo em outras imagens | **{{ui:character.menu}}** | A extensão para imagens de referência (IP-Adapter) |
| Reunir em uma única tabela imagens com configurações alteradas | **{{ui:xyplot.menu}}** | Nada |
| Escolher entre candidatas desenhadas até certo ponto | A aba **{{ui:app.views.drafts}}** | Nada |
| Aplicar o mesmo processamento a muitas imagens | **{{ui:gallery.menu.batch}}** (escolha várias e clique com o botão direito) | Depende do processamento |

## Quando uma extensão é necessária

Remover fundos, selecionar uma região, corrigir rostos e outras funções trabalham adicionando “extensões” ao mecanismo que cria as imagens (ComfyUI). Se uma extensão não estiver instalada, a janela diz “… requer a extensão XXX.” e mostra botões para instalá-la.

1. Pressione **{{ui:cutout.install}}**. Ele baixa e instala automaticamente o que é necessário.
2. Quando a instalação termina, o botão muda para **{{ui:cutout.restart}}**. Pressione-o e o ComfyUI reinicia.
3. Depois da reinicialização, a mesma janela pode ser usada do jeito que está.

Na primeira vez que você usa uma extensão, os modelos que ela utiliza também começam a ser baixados, então demora um pouco. É preciso estar conectado à internet.

> Algumas extensões levam tempo e espaço em disco para serem instaladas. O ComfyUI-Impact-Pack precisa do Git para ser instalado. Em um computador sem Git, a instalação falha. Se aparecer uma mensagem, leia-a antes de tomar qualquer providência.

Você também pode instalar extensões pela aba “{{ui:workflows.panel.packs}}” em [Fluxos](06-upscaling-workflows.md). Se não funcionar, veja também [Solução de problemas](10-troubleshooting.md).

## Criar outra com as mesmas configurações (derivar)

![O menu “Derivar mais” aberto na barra de ferramentas do visualizador](shot:derive-menu)

Abra no visualizador uma imagem de que você gosta e pressione o botão **{{ui:gallery.derive.menu}}** (o ícone de ramificação) na barra de ferramentas. Na galeria, clique com o botão direito na imagem e escolha **{{ui:gallery.derive.menu}}**.

Você pode escolher entre os três tipos a seguir.

| Item | O que faz |
|---|---|
| “Mesmos ajustes, nova seed” (1 ou 4 imagens) | Desenha mudando apenas a seed, mantendo o prompt, o modelo, o tamanho e assim por diante. A composição muda, mas o clima é o mesmo. |
| “Refazer com pequenas mudanças” (1 ou 4 imagens) | Usa a imagem original como base e a redesenha de leve (com intensidade de 0,45). A composição e as cores permanecem, e só os detalhes mudam. |
| **{{ui:gallery.derive.custom}}** | Você decide o quanto mudar (veja a próxima seção). |

Ao escolher um, as novas imagens entram na fila e aparecem na mesma pasta da original. **As configurações da aba Gerar não são reescritas.** O prompt que você está digitando também permanece como está.

> Quando quiser trazer as configurações de volta para a tela e depois ajustá-las você mesmo antes de criar uma imagem, use **{{ui:gallery.menu.remix}}**. Derivar serve para “criar com as configurações originais com o toque de um botão”.

### Escolher o quanto mudar e refazer

![A janela para decidir o quanto mudar](shot:derive)

Ao escolher **{{ui:gallery.derive.custom}}**, uma janela se abre.

1. Mova o controle deslizante **{{ui:gallery.derive.dialog.strength}}**. Quanto mais à esquerda ({{ui:gallery.derive.dialog.close}}), mais da composição e das cores originais permanecem; quanto mais à direita ({{ui:gallery.derive.dialog.free}}), mais o resultado se aproxima de outra imagem.
2. Escolha o **{{ui:gallery.derive.dialog.count}}** entre 1, 2, 4 e 8.
3. Pressione **{{ui:gallery.derive.dialog.create}}**.

Como referência, em torno de 0,25 resulta numa imagem quase igual à original, e em torno de 0,75 resulta numa imagem em que o personagem permanece, mas a composição muda bastante. Isso varia de imagem para imagem, então experimente alguns valores. O valor do controle deslizante é usado somente daquela vez.

### O que é mantido e o que não é

- Mantido: as configurações usadas quando a imagem foi criada, como o prompt, o prompt negativo, o modelo, o LoRA, o tamanho, os passos, a escala CFG e o agendador.
- As imagens de referência e as camadas de controle também são lembradas junto com a imagem, então são usadas como estão. No entanto, se uma dessas imagens tiver sido excluída da galeria, não é possível criar. O motivo aparece em uma notificação.
- Não mantidos: máscaras, orientação regional e configurações de rascunho. Se uma imagem foi criada antes deste recurso existir e usou imagens de referência ou algo parecido, elas não foram lembradas, então não podem ser mantidas. Quando algo não pôde ser mantido, você é avisado por uma notificação.

Nos casos a seguir, o botão não pode ser pressionado ou aparece uma notificação e não é possível criar.

- Quando a imagem não foi criada a partir de texto (isso inclui imagem para imagem, inpainting e outpainting). Imagens ampliadas, vídeo, áudio e similares não são abrangidos.
- Quando o modelo usado na imagem original não está instalado. Aparece uma notificação com o nome do modelo.

## Remover um fundo

![A janela para remover um fundo](shot:cutout)

Reconhece automaticamente o que há na imagem e cria uma imagem com o fundo removido. Você não precisa apontar nada com cliques.

1. Abra a imagem no visualizador e pressione **{{ui:cutout.menu}}**, com o ícone de tesoura (ele também está no menu de clique com o botão direito).
2. Se necessário, mude as configurações.
   - **{{ui:cutout.model}}**: normalmente pode ficar como está.
   - **{{ui:cutout.sensitivity}}**: quanto mais baixo você define, mais das partes com limites pouco claros ele mantém.
   - **{{ui:cutout.edge}}**: um valor positivo alarga o contorno e um valor negativo o desgasta.
   - **{{ui:cutout.background}}**: escolha **{{ui:cutout.background.alpha}}** ou **{{ui:cutout.background.white}}**.
3. Pressione **{{ui:cutout.run}}**.

A imagem pronta é salva como uma nova imagem na mesma pasta da original. **A imagem original permanece como está.** Se não ficar satisfeito com o resultado, mude as configurações e pressione **{{ui:cutout.again}}**. **{{ui:cutout.open}}** a mostra no visualizador.

Um fundo branco é uma boa escolha quando você quer usar a imagem depois como imagem de referência de um [personagem](#registrar-e-usar-um-personagem). A cor do fundo tem menos chance de passar para as novas imagens que você criar.

## Aparar margens transparentes

Uma imagem com fundo transparente mantém margens transparentes ao redor dela. Com **{{ui:gallery.menu.trim}}**, você salva uma nova imagem transparente cortada rente à parte que tem conteúdo. É útil quando você a usa como adesivo ou como material.

- Clique com o botão direito em uma imagem da galeria e escolha-o. Logo depois de remover um fundo, você pode fazer o mesmo em **{{ui:cutout.trim}}** na janela (ele aparece somente quando você tornou o fundo transparente).
- Uma sombra tão fraca que quase não se vê é aparada como margem.
- Para uma imagem cuja área transparente não chega à borda da imagem, aparece “Não há margem para cortar.” e nada é salvo. Uma imagem totalmente transparente também não pode ser aparada.

## Selecionar uma região e corrigi-la

![A janela para indicar com cliques o que selecionar na imagem](shot:segment)

Você seleciona com um clique a coisa da imagem que tem em mente. Depois pode recortar, apagar ou repintar a parte selecionada.

1. Abra a imagem no visualizador e pressione **{{ui:gallery.menu.segment}}**.
2. Somente na primeira vez, é necessária a extensão ComfyUI-segment-anything-2. Instale-a seguindo as orientações da tela ([Quando uma extensão é necessária](#quando-uma-extensão-é-necessária)).
3. Clique na coisa que deseja selecionar. Se algo estiver faltando, clique em outro lugar para adicioná-lo. Para remover uma área que passou do limite, mude o botão para **{{ui:segment.mode.exclude}}** e clique, ou clique com o botão direito (ou clique segurando `Shift`). Clicar de novo em um ponto já marcado cancela esse ponto. **{{ui:segment.clear}}** permite recomeçar do início.
4. Pressione **{{ui:segment.run}}**. A área selecionada é mostrada em azul.
5. Se a área azul estiver certa, escolha a próxima operação. Se quiser selecionar o “resto”, ative **{{ui:segment.invert}}**.

| Botão | O que faz | O que é necessário |
|---|---|---|
| **{{ui:segment.cutout}}** | Recorta somente a parte selecionada e a salva como uma imagem transparente. | Nada |
| **{{ui:segment.mosaic}}** | Transforma a parte selecionada em blocos grossos (mosaico) e salva a imagem. O tamanho do bloco é o número ao lado do botão. | Nada |
| **{{ui:segment.erase}}** | Apaga a parte selecionada, mesclando-a com a imagem ao redor. | A extensão comfyui-inpaint-nodes. Com o modelo LaMa (cerca de 200 MB), apaga de forma natural. Sem ele, ainda é possível apagar de maneira simples. |
| **{{ui:segment.redraw.title}}** | Repinta somente a parte selecionada de acordo com uma instrução em texto. As outras partes não mudam. | Um modelo de imagem |
| **{{ui:segment.toCanvas}}** | Envia a imagem e a seleção para a [tela](05-canvas.md). A seleção se torna uma máscara de inpainting. | Nada |

Ao repintar, você escreve em texto **o que desenhar** (por exemplo: blue hair, red scarf). Fica mais fácil obter o que espera se escrever no estilo em que o modelo é bom (como tags em inglês para um modelo de estilo anime). Quanto mais baixo você define **{{ui:segment.redraw.strength}}**, mais das formas e cores originais permanecem.

O resultado é salvo como uma nova imagem na mesma pasta da original. A imagem original não muda.

## Corrigir rostos

![A janela para corrigir rostos](shot:facefix)

Em planos abertos, os rostos que aparecem pequenos costumam sair deformados. **{{ui:facefix.menu}}** encontra automaticamente os rostos da imagem, redesenha somente os rostos em alta resolução e os coloca de volta na imagem original. Nada além dos rostos muda.

1. Abra a imagem no visualizador e pressione **{{ui:facefix.menu}}** (ele também está no menu de clique com o botão direito).
2. Somente na primeira vez, são necessárias as extensões ComfyUI-Impact-Pack e ComfyUI-Impact-Subpack. Instale-as com **{{ui:facefix.install}}** e pressione **{{ui:facefix.restart}}**. O modelo que encontra rostos é preparado pelo próprio Subpack.
3. Confira as configurações.
   - **{{ui:facefix.model}}**: o modelo usado na imagem original vem selecionado.
   - **{{ui:facefix.prompt}}**: o prompt da imagem original vem preenchido. Acrescentar características do rosto torna o efeito maior.
   - **{{ui:facefix.strength}}**: quanto mais baixo, mais próximo do rosto original; quanto mais alto, mais ele redesenha.
   - **{{ui:facefix.sensitivity}}**: aumentá-la detecta apenas rostos seguros, e diminuí-la detecta também rostos pequenos e de perfil. No entanto, também fica mais fácil que ela detecte coisas que não são rostos.
4. Pressione **{{ui:facefix.run}}**.

O resultado é salvo na mesma pasta da original. Pressione **{{ui:facefix.open}}** para compará-lo com a original no visualizador. Se não gostar, mude as configurações e pressione **{{ui:facefix.again}}**.

> Uma imagem criada com um LoRA é redesenhada sem o LoRA. Por isso, somente o rosto pode parecer ligeiramente diferente em estilo.

> Quando aparecer “O modelo de detecção de rostos (YOLO) não foi encontrado”, reinicie o ComfyUI ou instale as extensões de novo.

## Criar um prompt a partir de uma imagem

![A janela depois de escrever tags para uma imagem](shot:caption)

Este recurso olha uma imagem e escreve um prompt (tags ou uma frase) para desenhá-la. Use quando quiser imagens parecidas com uma de que gosta, ou quando não souber como escrever o prompt.

1. Escolha o botão **{{ui:caption.menu}}** no visualizador, ou **{{ui:caption.menu}}** no menu de clique com o botão direito da imagem. Você também pode abri-lo pelo botão **{{ui:caption.fromPrompt}}** acima do campo de prompt na aba Gerar. Você pode soltar nesse botão uma imagem da galeria ou um arquivo de imagem do seu computador.
2. Em **{{ui:caption.style}}**, escolha **{{ui:caption.style.tags}}** ou **{{ui:caption.style.sentence}}**.
3. Pressione **{{ui:caption.run}}**.
4. Você pode editar as palavras ali mesmo. Depois pressione **{{ui:caption.replace}}**, **{{ui:caption.append}}** ou **{{ui:caption.copy}}**.

Substituir e adicionar atuam sobre “{{ui:params.prompt.positive}}” na aba Gerar. Este recurso não adiciona nenhuma imagem à galeria.

> Este recurso precisa da extensão ComfyUI-Florence2. Quando ela não está instalada, você pode instalá-la pela janela (veja “Quando uma extensão é necessária” neste capítulo). Na primeira vez que você o usa, o modelo para descrever imagens (Florence-2 PromptGen) é baixado.

## Registrar e usar um personagem

![A janela para registrar como personagem](shot:character)

Se você registrar uma imagem de um personagem de que gosta, poderá desenhar imagens em outras cenas que se aproximem do mesmo personagem. Você registra as três coisas a seguir.

- Imagens de referência (imagens do mesmo personagem, quantas quiser)
- Palavras de aparência (cor do cabelo e dos olhos, roupas e assim por diante; são adicionadas ao início do prompt)
- A intensidade da semelhança

### Registrar

1. Na galeria, escolha a imagem que deseja registrar. Para várias imagens, clique segurando `Ctrl`.
2. Escolha o botão **{{ui:character.menu}}** no visualizador, ou **{{ui:character.menu}}** no menu de clique com o botão direito. Se você abrir o campo **{{ui:character.row.choose}}** na aba Gerar, há **{{ui:character.row.register}}** bem no final da lista, e você também pode abri-lo por ali.
3. Digite o **{{ui:character.name}}** e a **{{ui:character.tags}}**. Escreva as características que você não quer que mudem (cabelo castanho, blusa branca, saia azul e assim por diante).
4. Defina a **{{ui:character.weight}}**. Quanto mais você a aumenta, mais o resultado se parece com as imagens de referência, mas menos liberdade você tem sobre a cena e a composição.
5. Pressione **{{ui:character.save}}**.

Com **{{ui:character.addSelected}}**, você pode adicionar depois às imagens de referência as imagens escolhidas na galeria. **{{ui:character.removePicture}}** é o ✕ no canto superior direito de uma imagem.

Se você ativar **{{ui:character.whiteBg}}**, é criada uma imagem com o fundo da imagem registrada trocado por branco, e ela é usada como imagem de referência. Isso evita que a cor do fundo passe para as imagens que você gera. A imagem original é mantida, e a imagem de fundo branco é salva como uma nova. Quando a extensão ComfyUI-RMBG, usada para remover fundos, não está instalada, essa chave não pode ser usada e a imagem original é usada como está.

### Usar

1. No painel esquerdo da aba **{{ui:app.tabs.generate}}** (ou da aba [Tela](05-canvas.md)), abra **{{ui:character.row.choose}}** e escolha o personagem que deseja usar.
2. As imagens de referência do personagem vão para o campo “{{ui:params.refImage.sectionLabel}}”, e as palavras de aparência são adicionadas ao início do prompt.
3. Gere como de costume.

Quando você usa um personagem, o app pode ajustar algumas coisas automaticamente. Você é avisado por uma notificação.

- Quando imagens de referência são usadas, uma escala CFG alta tende a queimar a imagem; por isso, se a escala CFG for maior que 5, ela é reduzida para 4,5.
- Você pode ter no máximo 8 imagens de referência no total. Quando o total com outras imagens de referência passa de 8, são usadas as imagens do início.
- Quando há várias imagens de referência, a intensidade por imagem é reduzida automaticamente para que, juntas, não fiquem fortes demais.
- Imagens que foram excluídas da galeria não podem ser usadas. Se todas foram excluídas, o personagem não pode ser usado.

Para corrigir ou excluir um personagem registrado, use o botão “…” de um item da lista.

> Este é um recurso que “se aproxima” do mesmo personagem, então não dá exatamente o mesmo rosto. Penteado, cor, roupas e assim por diante tendem a ser mantidos, mas as feições do rosto mudam um pouco. Escrever nas palavras de aparência as características que você quer manter ajuda.

> Para usar imagens de referência, você precisa da extensão ComfyUI_IPAdapter_plus e de um modelo para imagens de referência. Se não estiverem instalados, você pode instalá-los pelo campo de imagens de referência na aba Gerar. Sobre os modelos, veja o capítulo [Modelos](08-models.md).

## Comparar configurações com uma grade de comparação

![A janela da grade de comparação](shot:xyplot)

Como uma imagem muda quando você altera a escala CFG ou o número de passos? Este recurso coloca isso em uma única tabela para você comparar.

1. Na aba Gerar, defina o prompt e o modelo como de costume.
2. Pressione o “▼” à direita do botão **{{ui:params.invoke.invoke}}** e escolha **{{ui:xyplot.menu}}**.
3. Com **{{ui:xyplot.x}}** e **{{ui:xyplot.y}}**, escolha as configurações a alterar. Também é possível criar a grade com apenas uma delas.
4. Digite os valores. Escreva os números separados por vírgulas (por exemplo: 3, 5, 7).
5. Pressione **{{ui:xyplot.run}}**.

Na parte de baixo da janela, aparece o número de imagens que serão criadas, como “3 colunas × 2 linhas = 6 imagens serão criadas.”

As configurações que você pode alterar são as seguintes.

| Configuração | Como digitar |
|---|---|
| {{ui:xyplot.axis.cfgScale}} | Números (1 a 30) |
| {{ui:xyplot.axis.steps}} | Números inteiros (1 a 150) |
| {{ui:xyplot.axis.seed}} | Números inteiros |
| {{ui:xyplot.axis.strength}} | Números (0,05 a 1). Só tem efeito ao criar a partir de uma imagem (imagem para imagem). |
| {{ui:xyplot.axis.scheduler}} | Escolha em uma lista |
| {{ui:xyplot.axis.model}} | Escolha modelos da mesma família em uma lista |
| {{ui:xyplot.axis.prompt}} | Escreva um por linha. Eles são adicionados ao prompt |

As regras são as seguintes.

- Você pode digitar até 8 valores para uma configuração. A tabela pode ter no máximo 36 imagens no total.
- Você não pode escolher a mesma configuração para a horizontal e para a vertical.
- Todas as imagens são desenhadas com a **mesma seed** (exceto quando você escolhe uma configuração que muda a seed). A única diferença é a configuração que você alterou.
- As configurações são tiradas do formulário da aba Gerar naquele momento. O formulário não é reescrito.
- Uma imagem que não pôde ser criada aparece como × na tabela. A tabela ainda é feita com as outras imagens.

A tabela pronta é salva na galeria como uma única imagem. **{{ui:xyplot.open}}** a mostra no visualizador. As imagens individuais com que a tabela foi feita também permanecem na galeria.

> Quanto mais imagens, mais tempo leva. Para 36 imagens, são necessárias 36 gerações. Recomenda-se experimentar 2 ou 3 valores no início.

## Escolher entre rascunhos

![A aba Rascunhos com candidatas desenhadas até a metade, lado a lado](shot:drafts)

Uma imagem muda muito conforme a seed. Rascunhos é um recurso que desenha muitas seeds apenas “até certo ponto” e depois desenha até o fim somente as composições de que você gosta. Isso economiza tempo.

Abra a aba **{{ui:app.views.drafts}}** no centro da aba **{{ui:app.tabs.generate}}**.

1. Escolha o **{{ui:drafts.model}}**. No início, vem selecionado o modelo da aba Gerar.
2. Defina a **{{ui:drafts.count}}** (1 a 24 imagens; 8 no início).
3. Defina o **{{ui:drafts.position}}** (25 a 60%; 35% no início). Quanto menor, mais rápido termina, mas mais grosseiras ficam as imagens.
4. Pressione **{{ui:drafts.start}}**.

As imagens de rascunho aparecem na ordem em que ficam prontas. São usados o prompt e as outras configurações da aba Gerar.

Clique em uma imagem para escolhê-la (clique de novo para desmarcá-la). Clique duas vezes para vê-la em tamanho grande no visualizador. O botão de estrela (**{{ui:drafts.keep}}**) e o ✕ (**{{ui:drafts.reject}}**) são marcas para uso próprio. Pressione o botão “{{ui:manual.drafts.finish}} N imagens” no canto inferior direito (N é a quantidade de imagens escolhidas) e as imagens escolhidas são desenhadas até o fim. Para escolher de novo, pressione **{{ui:drafts.clearSelection}}**.

As imagens desenhadas até o fim vão para a galeria como em uma geração normal, e “{{ui:drafts.badge.finished}}” aparece sobre o rascunho. Se alguns rascunhos falharam, aparece um botão “{{ui:manual.drafts.retry}} N que falharam”.

> Embora o botão diga “{{ui:manual.drafts.finish}}”, ele não retoma do meio. Desenha de novo do começo ao fim com a mesma seed. Por isso, o tempo que leva para terminar é o mesmo de uma geração normal. Você obtém uma imagem com a composição que viu no rascunho.

> Os rascunhos só podem ser usados na geração que cria imagens a partir de texto. Se você tiver imagens de referência ou algo parecido configurado, aparece uma mensagem e não é possível iniciar. As imagens de rascunho não aparecem na lista da galeria.

Os rascunhos aparecem nas abas do topo “na ordem em que você os iniciou”. Quando não precisar mais de um, feche-o com o ✕ da aba dele.

## Processar em lote

![A janela de processamento em lote](shot:batch)

Você pode aplicar remoção de fundo ou ampliação a várias imagens escolhidas de uma só vez.

1. Na galeria, escolha várias imagens (clique segurando `Ctrl`, ou clique segurando `Shift` para escolher um intervalo).
2. Clique com o botão direito em uma imagem escolhida e escolha **{{ui:gallery.menu.batch}}**.
3. Escolha o processamento.
   - **{{ui:batch.op.removeBackground.title}}**: torna o fundo transparente. A extensão ComfyUI-RMBG é necessária. Se não estiver instalada, aparece um botão de instalação.
   - **{{ui:batch.op.upscale.title}}**: amplia com um modelo de ampliação. Se você não tiver um modelo, instale um pela tela [Modelos](08-models.md).
4. Pressione **{{ui:batch.run}}**.

Cada imagem entra na fila como um item próprio. Você pode ver o andamento na aba **{{ui:app.tabs.queue}}**. Os resultados vão para a mesma pasta das imagens originais, como imagens novas. As imagens originais não mudam.

Quando quiser processar com cuidado uma única imagem, alterando as configurações, use os recursos individuais deste capítulo ([Remover um fundo](#remover-um-fundo)). Para ampliar uma única imagem, você também pode usar a aba [Ampliação](06-upscaling-workflows.md).
