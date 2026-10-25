# Vídeo, música, voz, logotipo e texto

Além de imagens, no novira é possível criar vídeos, músicas, vozes e logotipos, e também inserir texto e balões de fala nas imagens.

Tudo isso é usado no painel esquerdo da aba **{{ui:app.tabs.generate}}**. Para o uso de imagens, veja antes [Gerar](02-generate.md).

## Alternar o que será criado

No alto do painel esquerdo há um seletor só com ícones. Da esquerda para a direita, são **{{ui:media.tab.image}}**, **{{ui:media.tab.video}}**, **{{ui:media.tab.music}}**, **{{ui:media.tab.voice}}**, **{{ui:media.tab.logo}}**, **{{ui:media.tab.text}}** e **{{ui:app.tabs.comic}}**. **{{ui:app.tabs.comic}}** é a tela para criar páginas de quadrinho ([Desenhar quadrinhos](12-comic.md)).

Ao passar o mouse sobre um ícone, o nome aparece. Ao alternar, o painel esquerdo e a exibição central mudam para os desse tipo.

## Funcionamento comum

As telas de vídeo, música, voz e logotipo têm a mesma forma.

- No alto do painel esquerdo há a **{{ui:presets.label}}**, que recupera várias configurações de uma vez.
- Abaixo dele fica o botão para começar a criar. Se algo estiver faltando, o botão fica desativado e o motivo aparece logo abaixo.
- Quando o motivo pede para baixar o modelo do que você quer criar (por exemplo, “Baixe primeiro o modelo de música”), baixe-o pelo **cartão do modelo** que aparece em seguida.
- No lugar do botão de começar, também é possível criar com `Ctrl+Enter`.
- O andamento (espera na fila, criação em curso, motivo de uma falha) aparece no alto da tela central. É possível interromper com **{{ui:media.job.cancel}}**.

> A criação é feita um item por vez. Enquanto um vídeo ou uma música está sendo criado, as outras gerações, como imagens, ficam na fila. Os itens em espera também podem ser vistos na aba **{{ui:app.tabs.queue}}**.

### Baixar os modelos necessários na primeira vez

Vídeo, música, voz e logotipo exigem, cada um, um modelo próprio. Se não estiver instalado, o painel esquerdo mostra um “cartão do modelo”. Ao pressionar **{{ui:pack.install}}**, o app o traz automaticamente.

| O que se cria | Nome do cartão | Tamanho aproximado |
|---|---|---|
| Vídeo | {{ui:pack.title.video}} | cerca de 18 GB |
| Vídeo (versão rápida) | {{ui:pack.title.turbo}} | Os arquivos em comum com a versão padrão não são baixados de novo |
| Música | {{ui:pack.title.music}} | cerca de 10 GB |
| Voz | {{ui:pack.title.voice}} | cerca de 9 GB |
| Logotipo | {{ui:pack.title.logo}} | cerca de 12 GB |

Os tamanhos são aproximados. Para o tamanho exato, veja o número exibido no cartão.

Para vídeo, é possível escolher entre 2 modelos: a versão padrão e a versão rápida. O cartão mostra o nome e a memória da GPU deste computador e indica, para cada modelo, se ele é adequado (**{{ui:media.choice.fit.comfortable}}**, **{{ui:media.choice.fit.tight}}**, **{{ui:media.choice.fit.short}}**). O que combina com este computador recebe a marca **{{ui:media.choice.recommended}}**. Se não for possível consultar a memória da GPU, a adequação aparece como **{{ui:media.choice.fit.unknown}}**. É apenas uma estimativa: mesmo com **{{ui:media.choice.fit.short}}**, às vezes funciona, só que mais devagar.

O download é feito uma única vez, no início. O andamento aparece no cartão e também, em qualquer tela, na caixa “{{ui:media.downloads.title}}” no canto inferior esquerdo, com o nome e o progresso; é possível usar **{{ui:common.cancel}}** durante o processo. Em caso de falha, o cartão mostra o motivo e o botão muda para **{{ui:pack.retry}}**.

Quando o tamanho do download é conhecido, também aparece o tempo restante, como “faltam cerca de ○ min” (é uma estimativa feita a partir da velocidade do download, por isso não aparece logo no início). Quando o tamanho é desconhecido, ou durante a instalação, aparece “○ min até agora”, com o tempo desde o início. No download de extensões, a caixa permite abrir, com **{{ui:media.downloads.manage}}**, a lista das extensões instaladas.

Quando a instalação termina, o cartão desaparece. Só a voz leva um pouco mais de tempo, pois o mecanismo de leitura em voz alta é instalado junto.

> Antes de baixar, o mecanismo que cria imagens (ComfyUI) precisa estar pronto. Se algo não avançar, veja [Solução de problemas](10-troubleshooting.md).

## Criar vídeos

![A tela de vídeo. À esquerda ficam as configurações, como o modo, o prompt e o tamanho; no centro, a lista dos vídeos criados](shot:media-video)

Há duas maneiras de criar um vídeo: a partir de um texto ou animando uma imagem.

### Como criar

1. No painel esquerdo, escolha **{{ui:media.tab.video}}**.
2. Se for a primeira vez, pressione **{{ui:pack.install}}** no cartão **{{ui:pack.title.video}}**.
3. Em **{{ui:video.mode.label}}**, escolha **{{ui:video.mode.text}}** ou **{{ui:video.mode.image}}**.
4. Em **{{ui:video.prompt}}**, escreva como deseja que seja o vídeo. Ao criar a partir de uma imagem, escreva como deseja que ela se mova.
5. Pressione **{{ui:params.invoke.invoke}}**.

Ao escolher **{{ui:video.mode.image}}**, aparece um campo para indicar a imagem que será animada. Solte uma imagem nele ou selecione uma imagem na galeria e pressione **{{ui:video.pickFromGallery}}**.

Também é possível clicar com o botão direito em uma imagem da galeria e escolher **{{ui:gallery.menu.sendToVideo}}**.

### Configurações

| Item | Conteúdo |
|---|---|
| {{ui:video.negative}} | Elementos que não se quer incluir. Desde o início já vêm palavras que evitam desfoque, texto etc. |
| {{ui:video.model}} | **{{ui:video.model.standard}}** cria com cuidado. **{{ui:video.model.fast}}** cria em menos tempo, mas os detalhes podem ficar grosseiros |
| {{ui:video.size}} | O tamanho do vídeo. Começa em 832×480. Também é possível escolher vertical ou quadrado |
| {{ui:video.fps}} | Número de quadros por segundo (8 a 30) |
| {{ui:video.lengthLabel}} | De 1 a 10 segundos. O número de quadros é definido automaticamente a partir da duração e da taxa de quadros |
| {{ui:video.steps}}, {{ui:video.cfg}} | Ajustes finos do resultado. Ao escolher o modelo, mudam para valores adequados a ele |
| {{ui:video.randomSeed}} | Se desativado, é possível fixar a seed e recriar o mesmo movimento |

Para usar **{{ui:video.model.fast}}**, é preciso baixar separadamente **{{ui:pack.title.turbo}}**. Esse modelo tem licença não comercial.

### Quando a memória da GPU é pequena

Em **{{ui:video.light.title}}** há 2 chaves.

- **{{ui:video.light.fp8}}**: a memória usada pelo modelo cai quase pela metade. Os detalhes podem ficar um pouco mais grosseiros.
- **{{ui:video.light.tiled}}**: evita o aumento repentino de memória na etapa final. A qualidade não muda, e fica um pouco mais lento.

Se ainda assim não bastar, também é possível criar em tamanho menor e depois ampliar o vídeo com **{{ui:video.finish}}**.

### Resultado

Um vídeo leva de alguns minutos a mais de dez minutos. Quando fica pronto, aparece na lista de vídeos no centro e pode ser reproduzido ali mesmo. Ele também entra na galeria à direita, como uma miniatura com ▶.

Abaixo de cada vídeo aparecem o prompt, o tamanho, a duração e a seed. É possível excluir com o botão da lixeira.

Ao pressionar **{{ui:video.finish}}**, abre-se a tela **{{ui:finish.title}}**.

- **{{ui:finish.smooth.title}}**: preenche os quadros intermediários para deixar o movimento mais suave.
- **{{ui:finish.enlarge.title}}**: amplia o vídeo com um modelo de ampliação. Usa muito tempo e memória.

O vídeo original permanece como está, e o vídeo finalizado é acrescentado como um novo. Para interpolar quadros, às vezes é necessária uma extensão (siga a orientação da tela e pressione **{{ui:finish.install}}**).

## Criar música

![A tela de música. À esquerda estão as configurações, como estilo, letra, duração e andamento](shot:media-music)

Uma música é criada a partir de um texto (o estilo) e da letra.

### Como criar

1. No painel esquerdo, escolha **{{ui:media.tab.music}}**.
2. Se for a primeira vez, pressione **{{ui:pack.install}}** no cartão **{{ui:pack.title.music}}**.
3. Em **{{ui:music.tags}}**, escreva gênero, clima e instrumentos separados por vírgulas. Por exemplo: `upbeat J-pop, female vocal, piano, bright`.
4. Para uma música com canto, escreva a **{{ui:music.lyrics}}**. Para uma música sem canto, marque **{{ui:music.instrumental}}**.
5. Pressione **{{ui:params.invoke.invoke}}**.

O estilo é obrigatório. Com ele vazio, não é possível criar.

A letra pode ser dividida entre colchetes, como `[verse]` (estrofe) e `[chorus]` (refrão). Pode ser escrita em inglês, japonês, chinês etc. O idioma da letra é escolhido em **{{ui:music.language}}**. Se tiver dúvida, use **{{ui:music.lang.unknown}}**.

### Configurações

| Item | Conteúdo |
|---|---|
| {{ui:music.lengthLabel}} | 10 a 240 segundos |
| {{ui:music.bpm}} | A velocidade da música (40 a 220) |
| {{ui:music.timeSignature}} | 2/4, 3/4, 4/4, 6/4 |
| {{ui:music.key}} | De `C major` a `B minor` |
| {{ui:music.steps}}, {{ui:music.cfg}} | Ajustes finos do resultado |

### Resultado

A música leva de algumas dezenas de segundos a alguns minutos e aparece na lista central. Cada uma tem um player e pode ser reproduzida ali mesmo. São exibidos duração, andamento, tom e seed e, quando há letra, é possível abrir **{{ui:audio.lyrics}}** para conferir.

Ela também entra na galeria, com uma miniatura em forma de nota musical.

## Criar voz

![A tela de voz. À esquerda ficam o texto a ser lido, o idioma e a escolha da voz](shot:media-voice)

O texto digitado é lido em voz alta.

### Como criar

1. No painel esquerdo, escolha **{{ui:media.tab.voice}}**.
2. Se for a primeira vez, pressione **{{ui:pack.install}}** no cartão **{{ui:pack.title.voice}}**. O mecanismo de leitura e o modelo são instalados somente dentro da pasta do app.
3. Em **{{ui:voice.text}}**, digite o texto que será lido.
4. Escolha o **{{ui:voice.language}}**. Com **{{ui:voice.lang.Auto}}**, o idioma é detectado a partir do texto.
5. Defina a voz (veja abaixo).
6. Pressione **{{ui:params.invoke.invoke}}**.

### Como definir a voz

Em **{{ui:voice.mode.label}}**, é possível escolher entre 2 métodos.

- **{{ui:voice.mode.preset}}**: escolha entre as vozes disponíveis. Há, por exemplo, uma voz feminina em japonês, vozes em chinês, uma voz masculina em inglês e uma voz feminina em coreano; depois do nome aparecem o idioma e o gênero. Se em **{{ui:voice.style}}** você escrever algo como “animada e enérgica” ou “devagar e tranquila”, também é possível indicar o jeito de falar.
- **{{ui:voice.mode.design}}**: em **{{ui:voice.description}}**, descreva com palavras as características da voz. Por exemplo: “Voz masculina calma e grave. Fala devagar e com gentileza.” A descrição é obrigatória.

Os idiomas que podem ser lidos são japonês, inglês, chinês, coreano, alemão, francês, russo, português, espanhol e italiano.

### Resultado

O áudio criado aparece na lista central, com um player. Também são exibidos a voz usada (para uma voz criada por descrição, “{{ui:audio.voice.designed}}”) e o idioma. Ele também entra na galeria.

A primeira geração demora um pouco para carregar o modelo. Se ficar um tempo sem uso, o modelo sai da GPU e a memória volta para outras tarefas.

## Criar logotipos

![A tela de logotipo. À esquerda ficam o texto do logotipo, o estilo, o formato e o número de candidatos](shot:media-logo)

São criados candidatos de logotipo com texto.

### Como criar

1. No painel esquerdo, escolha **{{ui:media.tab.logo}}**.
2. Se for a primeira vez, pressione **{{ui:pack.install}}** no cartão **{{ui:pack.title.logo}}**.
3. Em **{{ui:logo.text}}**, digite o texto que entrará no logotipo (até 60 caracteres).
4. Em **{{ui:logo.style}}**, escreva o clima, as cores e as formas. Pode ser em japonês ou em inglês. Por exemplo: “minimalista, azul e branco, geométrico”.
5. Em **{{ui:logo.size}}**, escolha o formato entre **{{ui:logo.size.square}}**, **{{ui:logo.size.wide}}** e **{{ui:logo.size.tall}}**.
6. Em **{{ui:logo.countLabel}}**, escolha um valor de 1 a 4 e pressione **{{ui:params.invoke.invoke}}**.

### Resultado e sobreposição de texto

Os logotipos criados aparecem no centro como candidatos. Na galeria, eles entram em **{{ui:gallery.view.assets}}**, e não em **{{ui:gallery.view.images}}**. Ao abrir a tela de logotipo, a galeria à direita muda automaticamente para a exibição de recursos.

O texto em inglês sai com precisão, mas o japonês pode ficar deformado. Nesse caso, pressione **{{ui:logo.layText}}** no candidato de que gostar. A tela muda para **{{ui:media.tab.text}}**, e esse logotipo passa a ser o fundo, de modo que se pode sobrepor o texto desejado.

## Texto (letras e balões de fala)

![A tela de texto. À esquerda ficam os botões para adicionar texto, o fundo, as camadas e o estilo do texto; no centro, a imagem em edição](shot:media-text)

**{{ui:media.tab.text}}** é uma tela de edição para inserir texto e balões de fala em uma imagem e salvá-la como imagem. Não é preciso baixar modelos. Como também não usa o processamento de criação de imagens, pode ser usada na hora.

### Definir o fundo

Em **{{ui:text.bg.title}}**, escolha sobre o que o texto será colocado.

- **{{ui:text.bg.image}}**: usa uma imagem como fundo. Exiba uma imagem na galeria e pressione **{{ui:text.bg.useViewer}}**, ou solte uma imagem nesta tela. Ela é salva com o mesmo tamanho da imagem.
- **{{ui:text.bg.color}}**: um fundo de cor única. O tamanho é escolhido na lista, como 1024×1024 ou 1920×1080, ou a largura e a altura são informadas em números.
- **{{ui:text.bg.transparent}}**: sem fundo. Permite criar apenas o texto, como uma imagem transparente.

Também é possível clicar com o botão direito em uma imagem da galeria e escolher **{{ui:gallery.menu.sendToText}}**.

### Adicionar texto e balões

- **{{ui:text.add.text}}**: acrescenta uma camada de texto.
- **{{ui:text.add.bubble}}**: acrescenta um balão de fala. O formato é escolhido entre **{{ui:text.shape.round}}**, **{{ui:text.shape.box}}**, **{{ui:text.shape.cloud}}**, **{{ui:text.shape.burst}}**, **{{ui:text.shape.whisper}}** e **{{ui:text.shape.narration}}**.

O que foi acrescentado pode ser movido arrastando na tela. Ao selecionar, aparecem alças redondas nos quatro cantos, e arrastá-las muda o tamanho. O balão tem um “{{ui:text.bubble.tail}}”; arraste a alça da ponta para mudar a direção.

`Delete` exclui, `Ctrl+D` duplica, as setas movem aos poucos, `Ctrl+Z` desfaz e `Ctrl+Shift+Z` (ou `Ctrl+Y`) refaz. Os botões **{{ui:text.undo}}** e **{{ui:text.redo}}**, na tela, fazem o mesmo. O tamanho da exibição é alterado com **{{ui:text.zoom.in}}**, **{{ui:text.zoom.out}}** e **{{ui:text.zoom.fit}}**.

### Camadas

Os textos e balões acrescentados aparecem em **{{ui:text.layers.title}}** na ordem de sobreposição. Quanto mais acima na lista, mais à frente.

Para cada um, é possível usar **{{ui:text.layer.hide}}**, **{{ui:text.layer.lock}}**, **{{ui:text.layer.up}}** e **{{ui:text.layer.down}}** para trocar a ordem, **{{ui:text.layer.duplicate}}** e **{{ui:text.layer.delete}}**. **{{ui:text.layers.clear}}** apaga tudo de uma vez.

### Ajustar o texto

Ao selecionar uma camada, as configurações aparecem abaixo dela.

| Item | Conteúdo |
|---|---|
| {{ui:text.content}} | Digita o texto (é possível quebrar linhas) |
| {{ui:text.font}}, {{ui:text.weight}}, {{ui:text.size}} | Fonte, espessura e tamanho. As fontes vêm com o app, então a aparência é a mesma em qualquer PC |
| {{ui:text.fill}} | **{{ui:text.fill.solid}}** ou **{{ui:text.fill.gradient}}** (a cor muda de cima para baixo) |
| {{ui:text.stroke}}, {{ui:text.outline}} | O contorno do texto e o contorno externo a ele |
| {{ui:text.shadow}} | Sombra. É possível escolher cor, desfoque e deslocamento |
| {{ui:text.letterSpacing}}, {{ui:text.lineHeight}}, {{ui:text.align}} | Espaço entre letras, espaço entre linhas e alinhamento |
| {{ui:text.vertical}} | Escreve na vertical. Na escrita vertical, o alinhamento passa a ser “{{ui:text.align.top}}, {{ui:text.align.center}}, {{ui:text.align.bottom}}” |
| {{ui:text.bend}} | Curva o texto (não pode ser usado na escrita vertical) |
| {{ui:text.rotation}}, {{ui:text.opacity}} | Rotação e opacidade |

Nos balões também é possível ajustar o tamanho, a cor de preenchimento, a borda e o ponteiro. No formato **{{ui:text.shape.burst}}**, **{{ui:text.bubble.shuffle}}** muda as pontas. Ao ativar **{{ui:text.bubble.autoFit}}**, o texto diminui para caber no balão.

### Predefinições de estilo

As predefinições no alto do painel esquerdo trazem estilos de aparência de logotipo: **{{ui:text.preset.plain}}**, **{{ui:text.preset.pop}}**, **{{ui:text.preset.sfx}}**, **{{ui:text.preset.gold}}**, **{{ui:text.preset.sticker}}** e **{{ui:text.preset.soft}}**. Se forem usados com uma camada de texto selecionada, o estilo é aplicado a ela.

Também é possível salvar seus próprios estilos (fonte, preenchimento, contorno, sombra, espaço entre letras).

### Salvar

Quando terminar, pressione **{{ui:text.save}}**. Uma imagem PNG do tamanho do fundo entra na galeria. Mesmo depois de salvar, o conteúdo da edição permanece na tela, então é possível continuar ajustando.

## Predefinições

As telas de vídeo, música, voz, logotipo e texto também têm predefinições, na mesma forma que as de imagem. Ao escolher em **{{ui:presets.label}}**, no alto à esquerda da tela, as configurações salvas são aplicadas de uma vez.

Para salvar suas configurações, pressione o botão de salvar ao lado da predefinição (**{{ui:presets.saveNew}}**) e dê um nome. As salvas aparecem em **{{ui:presets.group.mine}}**. No menu “…” de cada item da lista, também é possível usar **{{ui:presets.overwrite}}**, **{{ui:presets.rename}}** e **{{ui:presets.delete}}**. As que já vêm com o app ficam em **{{ui:presets.group.builtin}}** (os nomes estão em inglês).

O que é salvo varia um pouco de tela para tela.

| Tela | O que é salvo | O que não é salvo |
|---|---|---|
| Vídeo | Prompt, modelo, tamanho, duração e configurações de qualidade | A seed e a imagem original |
| Música | As tags de estilo e as configurações da música | A letra e a seed |
| Voz | O idioma e a voz (a voz e o jeito de falar, ou a descrição da voz) | O texto a ser lido |
| Logotipo | As palavras de estilo, o formato e o número de candidatos | O texto do logotipo |
| Texto | O estilo do texto | O conteúdo do texto |

As predefinições que já vêm com o app são 3 para vídeo (“Quick preview”, “Standard 832x480” e “Vertical, low VRAM”), 2 para música (“Lo-fi instrumental” e “J-pop song”), 2 para voz (“Calm narrator” e “Energetic announcer”) e 5 para logotipo.

Para saber como procurar e instalar modelos, veja [Modelos](08-models.md).
