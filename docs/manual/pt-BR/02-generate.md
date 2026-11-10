# Criar imagens

Este capítulo explica como criar imagens na aba **{{ui:app.tabs.generate}}**.
Para conhecer a tela, veja [Primeiros passos](01-start.md); para ver e organizar as imagens criadas, veja [Galeria e visualizador](03-gallery.md).

O caminho para criar é sempre o mesmo.

1. Escolher o modelo
2. Escrever o prompt
3. Se necessário, ajustar configurações como o tamanho e a seed
4. Clicar em **{{ui:params.invoke.invoke}}**

O desenho não começa no instante do clique: o pedido entra primeiro na “{{ui:app.tabs.queue}}” (a fila de espera). Quando chega a vez, as imagens são desenhadas uma de cada vez.

O modelo, o prompt e as configurações escolhidos continuam salvos quando o app é fechado e voltam como estavam na próxima vez que ele for aberto.

## Escrever o prompt

![A aba de geração com uma frase no prompt e a seed fixa](shot:generate-prompt)

Em “{{ui:params.prompt.title}}”, no painel da esquerda, há dois campos.

- **{{ui:params.prompt.positive}}**: escreva o que você quer que apareça.
- **{{ui:params.prompt.negative}}**: escreva o que você não quer que apareça, por exemplo `blurry, watermark` (desfocado, marca d'água). É possível gerar com ele vazio.

Algumas orientações para escrever:

- Liste palavras ou frases curtas separadas por vírgula (`,`).
- Com a maioria dos modelos, escrever em inglês costuma dar resultados mais fiéis ao que se espera. Se a descrição do modelo indicar uma forma de escrever, siga-a.
- Coloque as palavras importantes no começo.

Os pequenos botões acima do campo funcionam assim. Eles têm apenas ícones, e o nome aparece quando se passa o cursor sobre eles.

| Botão | Função |
|---|---|
| **{{ui:params.prompt.recommendedPositive}}** / **{{ui:params.prompt.recommendedNegative}}** | Acrescenta a “{{ui:params.prompt.positive}}” as palavras de qualidade mais usadas para o tipo do modelo escolhido e, ao final de “{{ui:params.prompt.negative}}”, as palavras que se quer evitar. Nos modelos que usam tags (Illustrious, NoobAI, Pony, Anima etc.), tags como `masterpiece, best quality` entram no início; nos modelos que usam frases (FLUX, Qwen-Image etc.), palavras que expressam qualidade entram no fim. Nos modelos que não usam prompt negativo (FLUX.1), nada é acrescentado ao negativo. Palavras que já estão no campo não são repetidas |
| **{{ui:params.prompt.expand}}** | Edita o positivo e o negativo lado a lado em uma janela grande |
| **{{ui:params.prompt.textView}}** / **{{ui:params.prompt.tagView}}** | Alterna a exibição do campo entre o texto puro e uma fileira de etiquetas (tags), uma por palavra. Ao clicar numa etiqueta, abre-se um pop-up em que é possível reescrever a palavra, mudar a intensidade com um controle deslizante, voltar a 1 ou apagar a etiqueta. Uma etiqueta com a intensidade alterada é escrita no prompt no formato `(smile:1.3)`. Para acrescentar uma etiqueta, digite a palavra no campo de baixo e pressione Enter |
| **{{ui:params.promptBook.open}}** | Abre predefinições de palavras reunidas com seus significados (veja adiante) |
| **{{ui:caption.fromPrompt}}** | Olha a imagem selecionada na galeria (ou, se nenhuma estiver selecionada, um arquivo de imagem escolhido) e escreve na hora palavras que podem ser usadas no prompt. O resultado aparece na faixa do visualizador. Também funciona soltar neste botão uma imagem da galeria ou um arquivo de imagem do computador (explicado em [Corrigir e reutilizar imagens](04-improve.md)) |

### Número de tokens

O “0 / 77 tokens” acima do campo é uma estimativa da quantidade de palavras escritas até agora.
O token é a unidade em que o modelo divide as palavras ao lê-las. Quando o limite é ultrapassado, o número muda para a cor de alerta. Em alguns modelos, o que passa do limite pode ter menos efeito.
O número é apenas aproximado, não exato.

### Gerar várias combinações de uma vez `{red|blue}`

Se, no campo positivo, você escrever opções separadas por barra vertical (`|`) dentro de chaves, como em `{red|blue}`, é criada uma imagem diferente para cada opção.

- Escrever `a {red|blue} flower` gera 2 variações: `a red flower` e `a blue flower`.
- Com duas ou mais chaves, saem todas as combinações. `a {red|blue} {cat|dog}` gera 4 variações.
- Também é possível colocar chaves dentro de outras chaves.
- Para usar a chave como um caractere comum, coloque `\` antes dela (`\{`).
- O número de combinações vai até 100.

Quando “{{ui:params.invoke.iterations}}” (veja adiante) é 2 ou mais, são criadas tantas imagens quanto o número de combinações × a quantidade. Por exemplo, com 2 variações e quantidade 3, saem 6 imagens.
Essa sintaxe só funciona no campo positivo. No campo negativo, as chaves são tratadas como caracteres comuns.

Para ver em quais frases a escrita se expande, use o botão **{{ui:params.prompt.dynamicPreview}}** (ícone `{ }`) acima do campo positivo. Ao clicar, aparece a lista das combinações. O campo negativo tem o mesmo botão, e nele também se pode escrever `{a|b}` e curingas. As combinações são formadas por todos os pares entre o positivo e o negativo.

### Curingas `__nome__`

![A janela dos curingas. À esquerda, a lista de listas; à direita, o nome e os itens da lista escolhida](shot:wildcards)

Se você escrever `__nome__` (dois sublinhados antes e depois do nome) no campo positivo, entra um item de cada vez da lista de “{{ui:params.wildcards.title}}” com esse nome. Se você guardar suas opções preferidas em uma lista, não precisa escrever `{red|blue}` toda vez.

- Escrever `1girl, __hair-color__` cria tantos prompts quantos forem os itens da lista hair-color.
- Os itens também podem conter `{a|b}` e outros curingas. Um curinga dentro de outro vai até 6 níveis.
- O limite de combinações (100) é o mesmo de `{ }`.
- Se você escrever um nome que não existe, uma lista sem itens ou uma lista que usa a si mesma, **{{ui:params.invoke.invoke}}** não pode ser clicado e o motivo aparece abaixo do botão.

As listas são abertas por **{{ui:params.wildcards.open}}**, na parte de baixo da janela do botão **{{ui:params.prompt.dynamicPreview}}**. Desde o início já existem três: hair-color (cor do cabelo), expression (expressão) e time-of-day (hora do dia).

| Operação | Função |
|---|---|
| **{{ui:params.wildcards.new}}** | Acrescenta uma lista vazia |
| Campo “{{ui:params.wildcards.name}}” | Muda o nome da lista. Podem ser usados letras, números, `-` e `_`, e o primeiro e o último caractere devem ser letra ou número |
| Campo “{{ui:params.wildcards.entries}}” | Escreva um item por linha. Linhas vazias e linhas que começam com `#` não viram itens |
| **{{ui:params.wildcards.import}}** / **{{ui:params.wildcards.export}}** | Lê e grava uma lista como um arquivo .txt com um item por linha. O arquivo lido vira uma nova lista com o nome do arquivo |
| **{{ui:common.delete}}** | Exclui a lista selecionada |

As listas são salvas dentro deste app (no computador que você está usando).

### Escolher ao acaso

Quando há combinações demais, troque “{{ui:params.prompt.dynamicMode}}” na janela do botão **{{ui:params.prompt.dynamicPreview}}**.

- **{{ui:params.prompt.modeCombinatorial}}** (configuração inicial): para cada combinação, são criadas tantas imagens quanto a quantidade.
- **{{ui:params.prompt.modeRandom}}**: são criadas tantas imagens quanto a quantidade, e para cada uma é escolhida uma combinação. A escolha é determinada pela seed da imagem, então redesenhar com a mesma seed dá o mesmo prompt.

Em qualquer um dos dois modos, o prompt realmente usado fica salvo com a imagem criada.

## Seed

As imagens são criadas a partir de um número chamado “{{ui:params.seed.label}}”. Com a mesma seed e as mesmas configurações, sai a mesma imagem.

Na linha “{{ui:params.seed.label}}”, na parte de cima do painel esquerdo, há dois botões.

- **{{ui:params.seed.random}}** (dado): usa uma seed nova a cada geração. A imagem é diferente toda vez. É o estado inicial.
- **{{ui:params.seed.fixed}}** (cadeado): desenha com a seed atual. Por mais vezes que você crie com as mesmas configurações, sai a mesma imagem. É útil para ver a diferença que uma única palavra do prompt faz.

Com a seed fixa, o campo do número e o botão “{{ui:params.seed.shuffle}}” ficam travados (para evitar mudanças sem querer).
Para usar um número determinado, digite-o no campo com “{{ui:params.seed.random}}” ativo e só então troque para “{{ui:params.seed.fixed}}”.
Para usar a seed de uma imagem de que você gostou, abra-a na galeria e clique em “{{ui:gallery.menu.useSeed}}”: a seed é carregada e fica fixa (veja [Galeria e visualizador](03-gallery.md)).

Se a quantidade for aumentada com a seed fixa, da segunda imagem em diante a seed aumenta de 1 em 1.

## Escolher o modelo

![A lista de modelos aberta, dividida por famílias como FLUX, SDXL e SD1.X](shot:model-picker)

O modelo que desenha é escolhido no cartão de modelo, na parte de cima do painel esquerdo.

1. Clique no campo do nome do modelo.
2. Escolha na lista. A lista é dividida por família de modelo (FLUX, SDXL, SD1.X etc.). Quando há muitos, digite parte do nome no campo de busca, no alto, para filtrar.

Modelos Anima, Flux, FLUX.2, Chroma, Qwen-Image, Z-Image, SD3, HiDream, AuraFlow e HunyuanImage também podem ser escolhidos aqui. Quando o modelo principal, o codificador de texto e o VAE são distribuídos em arquivos separados, o app procura pelo nome, entre os modelos instalados, o codificador de texto e o VAE e os utiliza. Ao instalar um modelo que tem arquivos faltando, aparece logo “{{ui:params.parts.title}}” com uma confirmação, e é possível ver os nomes e os tamanhos antes de instalar só os arquivos que faltam. Se você fechar a janela para fazer isso depois, abaixo do botão de gerar continuam aparecendo um aviso dos arquivos que faltam para aquele modelo e um botão para instalá-los sem sair da tela. Se passar de 5 GB, uma confirmação aparece também depois de clicar no botão. A instalação também pode ser feita em **{{ui:models.install.tab.starter}}**, na tela de modelos. Com esses modelos também funcionam máscara, camadas de controle e alta resolução. A imagem de referência só funciona com modelos SD1.X e SDXL. O que foi escolhido em “{{ui:params.generation.scheduler}}” não é usado: o desenho usa o amostrador e o agendador definidos para cada família (`euler / simple` no Flux). Só o Anima desenha com o agendador escolhido. O campo “{{ui:params.generation.scheduler}}” mostra a combinação realmente usada. Se você escolher “{{ui:params.generation.sampler}}” e “{{ui:params.generation.noiseSchedule}}”, o que foi escolhido tem prioridade, qualquer que seja a família do modelo.

- **Modelos de edição.** FLUX Kontext e Qwen-Image-Edit reescrevem a imagem que você entrega. Coloque a imagem original na origem (imagem para imagem) e escreva no prompt o que quer mudar. O FLUX Fill redesenha a parte mascarada (usado em inpaint ou outpaint com máscara). Com esses modelos, alta resolução, rascunhos e camadas de controle não funcionam. O app distingue os modelos comuns pelo conteúdo do arquivo e, no caso dos modelos de edição Kontext e Qwen, pelas palavras `kontext` e `edit` no nome do arquivo. Não mude o nome.
- **FLUX.2.** O klein funciona com poucos passos (a versão destilada usa CFG 1). O dev usa o valor de CFG como orientação. Se você colocar a imagem original na origem (imagem para imagem), o FLUX.2 a reescreve seguindo o prompt. Máscara, camadas de controle e alta resolução não funcionam no FLUX.2 (rascunhos funcionam).
- **Modelos quantizados (GGUF).** Modelos e codificadores de texto com a extensão `.gguf` são carregados pela extensão ComfyUI-GGUF. Instale-a uma vez na tela de extensões (https://github.com/city96/ComfyUI-GGUF) e reinicie o mecanismo. Enquanto ela não estiver instalada, a geração falha e a falha é exibida.
- **Modelos que exigem outras entradas.** Modelos que precisam de vídeo de controle, áudio, movimento de câmera ou vídeo de pose (Wan Fun Control, Wan Animate, Flux Canny etc.) ainda não funcionam. A geração falha e o que o modelo precisa é exibido.
3. O modelo escolhido recebe um ✓, e a imagem do cartão (a capa) também muda.

O botão **{{ui:app.tabs.short.models}}**, abaixo da lista, leva à aba {{ui:app.tabs.models}} (gerenciar os modelos que você tem), e o botão **{{ui:app.tabs.short.browse}}** leva à aba {{ui:app.tabs.browse}} (procurar na internet). Como obter mais modelos é explicado em [Preparar modelos](08-models.md).

Se o modelo tiver configurações recomendadas registradas (número de passos, CFG, agendador, tamanho), elas são preenchidas automaticamente quando ele é escolhido.
Ao trocar para um modelo de outra família, LoRAs e itens semelhantes que não combinam com o novo modelo são retirados (o número retirado é informado numa notificação).

Ao clicar no botão **{{ui:params.profile.title}}**, abaixo do campo do modelo, os valores recomendados para aquele modelo aparecem em uma lista. Se a configuração atual se afastar do recomendado, o botão fica com uma cor de destaque, e **{{ui:params.profile.apply}}** alinha tudo aos valores recomendados. O número de passos é considerado dentro de uma faixa que vai de um pouco abaixo a um pouco acima do recomendado. Os modelos Anima tendem a desmanchar a imagem com poucos passos (às vezes ela é preenchida por uma cor só), por isso o limite inferior da faixa é mais alto (se o recomendado é 30, a partir de 24).

> Se nenhum modelo estiver instalado, o campo mostra “{{ui:params.model.noModels}}” e não é possível gerar. Conclua antes [Preparar modelos](08-models.md).

## Outras configurações

Abaixo do prompt há seções que reúnem as configurações. Clique para abrir e fechar.

| Seção | O que contém |
|---|---|
| **{{ui:params.refImage.sectionLabel}}** (logo abaixo do prompt) | Imagens para aproximar o clima da imagem ou os personagens (veja adiante) |
| **{{ui:params.i2i.title}}** | A imagem original para redesenhar a partir de uma imagem (i2i) e {{ui:params.image.strength}} (veja adiante) |
| **{{ui:params.image.title}}** | {{ui:params.image.aspect}}, largura e altura. Também há os botões “{{ui:params.image.swap}}”, “{{ui:params.image.lock}}” e “{{ui:params.image.optimal}}” |
| **{{ui:params.generation.title}}** | LoRA (pequenos modelos adicionais que acrescentam estilo ou personagens), {{ui:params.generation.scheduler}}, {{ui:params.generation.sampler}}, {{ui:params.generation.noiseSchedule}} (escolhidos diretamente pelos nomes do ComfyUI; com “{{ui:params.generation.engineAuto}}”, segue-se o agendador ou o padrão do modelo e o nome usado na hora aparece como “Automático (nome)”; no FLUX.2, só o amostrador), {{ui:params.generation.steps}}, {{ui:params.generation.cfg}} |
| **{{ui:params.hires.title}}** | Uma segunda geração que amplia a imagem desenhada e a desenha de novo (veja adiante) |
| **{{ui:params.advanced.title}}** | {{ui:params.advanced.vae}}, {{ui:params.advanced.clipSkip}}, {{ui:params.advanced.seamless}} (imagens sem emenda visível quando ladrilhadas; funciona com modelos SD1.X e SDXL e exige que a extensão ComfyUI-seamless-tiling tenha sido instalada na tela de extensões) etc. |

Na dúvida, exceto o tamanho, pode-se deixar tudo como ficou ao escolher o modelo.
Ao passar o cursor sobre o nome de um item (“{{ui:params.generation.steps}}”, “{{ui:params.generation.cfg}}” etc.), aparece uma explicação curta. No título de cada seção, um pequeno resumo mostra os valores atuais.

Quanto maior o tamanho, maiores o tempo e a carga sobre o computador. Recomenda-se testar primeiro com um tamanho menor e, se o resultado for bom, ampliar com [Ampliação](06-upscaling-workflows.md).

## Correção em alta resolução

![A seção de correção em alta resolução aberta e ativada](shot:hires-fix)

Quando se desenha em um tamanho grande desde o início, é fácil sair duas pessoas na imagem ou as formas se desmancharem. A **{{ui:params.hires.title}}** primeiro desenha no tamanho configurado, amplia o resultado e o desenha de novo com a mesma seed e as mesmas configurações. Em uma única geração, sai uma imagem grande e detalhada. Esta seção existe nas abas {{ui:app.tabs.generate}} e {{ui:app.tabs.comic}}.

- **{{ui:params.hires.enable}}**: ative para usar.
- **{{ui:params.hires.scale}}**: de 1,25 a 2 vezes. O tamanho final aparece no título da seção e na linha de baixo.
- **{{ui:params.hires.strength}}**: de 0,2 a 0,75. Valores baixos mantêm quase intacta a primeira imagem; valores altos a redesenham bastante. O valor inicial é 0,45.
- **{{ui:params.hires.method}}**: **{{ui:params.hires.methodSmooth}}** amplia sem usar modelo. Se houver um modelo de ampliação instalado, do tipo usado na aba {{ui:app.tabs.upscaling}}, ele também pode ser escolhido.
- **{{ui:params.hires.steps}}**: o número de passos da segunda geração. Com 0, desenha com o mesmo número da primeira.

O tempo é o de desenhar duas vezes. O progresso é contado somando as duas etapas. LoRAs e imagens de referência também são usadas na segunda geração.

Quando o resultado fica muito acima do tamanho em que o modelo é bom (um lado maior que cerca de 2048 px no SDXL ou 1536 px no SD1.X), aparece um aviso abaixo do botão de gerar. A geração é possível, mas, se a imagem se desmanchar, reduza a ampliação.

A imagem guarda o tamanho da primeira geração e os valores de {{ui:params.hires.title}}. Ao carregar com “{{ui:gallery.menu.useAll}}” na galeria, a {{ui:params.hires.title}} também é preenchida exatamente assim.

## Quantidade e botão de gerar

![O menu aberto pela seta ao lado do botão de gerar](shot:invoke-menu)

As operações de geração ficam reunidas na parte de cima do painel esquerdo.

- **{{ui:params.invoke.invoke}}** (botão azul): adiciona ao fim da fila e gera. Também pode ser acionado com `Ctrl+Enter`.
- **Número ao lado do ×**: a quantidade de imagens criadas em uma operação. Com “3”, são criadas 3 imagens.
- **Botão × vermelho**: cancela o que está sendo desenhado agora.
- **∨ à direita de cada botão**: menu de outras operações.

Quando não é possível clicar, o botão fica cinza e o motivo (por exemplo, nenhum modelo escolhido) aparece na linha abaixo dele. Passando o cursor sobre o botão, vê-se a lista de motivos.
Durante o desenho, o botão muda para “{{ui:params.invoke.generating}}” e mostra o progresso (%) e o número de itens esperando na fila.

### Menu ∨ do botão de gerar

- **{{ui:params.invoke.addBack}}** (`Ctrl+Enter`): coloca na ordem em que foi pedido e desenha. É igual à geração comum.
- **{{ui:params.invoke.addFront}}** (`Ctrl+Shift+Enter`): fura a fila e vai para o início. Use quando quiser testar uma única imagem com urgência.
- **{{ui:xyplot.menu}}**: com base nas configurações atuais, alinha em uma única tabela imagens em que só 1 ou 2 configurações foram alteradas. Como são desenhadas com a mesma seed, a única diferença é o que foi mudado. Escolha na horizontal e na vertical itens como escala de CFG, número de passos ou modelo, digite os valores e clique em **{{ui:xyplot.run}}**.

### Menu de cancelamento

Ao clicar no ∨ à direita do botão × vermelho, aparece este menu.

- **{{ui:params.invoke.cancelCurrent}}** (`Shift+X`)
- **{{ui:params.invoke.clearQueue}}** (`Ctrl+Shift+X`): apaga tudo, tanto o que está esperando quanto o que está sendo desenhado. Não há confirmação.
- **{{ui:params.invoke.pause}}** / **{{ui:params.invoke.resume}}**: pausa e retoma o processamento da fila.
- **{{ui:params.invoke.openQueue}}**

## Ver a imagem pronta

![A tela depois da geração. A imagem aparece no visualizador central e também na galeria, à direita](shot:generate-result)

Ao clicar, o centro muda imediatamente para o visualizador.
Durante o desenho, uma faixa “{{ui:gallery.generating.title}}” aparece acima da galeria, à direita, com a imagem parcial, o número do passo e o progresso. A linha fina no alto do centro também mostra o progresso. A mesma imagem aparece como um pequeno quadro no início da galeria. Ao clicar nesse quadro, a imagem parcial é vista em tamanho grande no visualizador central. Quando a geração termina, ele passa a mostrar a imagem pronta.

Quando fica pronta, a imagem é acrescentada à galeria e aparece no visualizador.
A imagem é salva na pasta atualmente escolhida (a que tem a marca “{{ui:gallery.boards.autoBadge}}” no painel da direita). As pastas, e como organizar, comparar e refazer imagens, são explicadas em [Galeria e visualizador](03-gallery.md).

> Se a troca automática do visualizador para a nova imagem atrapalhar, desative “{{ui:gallery.settings.autoSwitch}}” em {{ui:gallery.settings.title}} (o botão de engrenagem).

## Predefinições

![A lista de predefinições. Aparecem as predefinições internas e as salvas](shot:presets)

Combinações de configurações usadas com frequência podem ser salvas como predefinições. Clique no cartão “{{ui:presets.label}}”, no alto do painel esquerdo, para abrir a lista.

Uma predefinição guarda em conjunto:

- O prompt (positivo e negativo)
- O modelo e as configurações (tamanho, número de passos, CFG, agendador, VAE etc.)
- LoRAs e imagens de referência
- {{ui:params.hires.title}}, as configurações da aba **{{ui:app.tabs.upscaling}}**, as configurações de inpaint (desfoque da máscara, expansão da pintura etc.) e a forma de criar prompts dinâmicos

A seed, a quantidade e a imagem a ser ampliada não entram.

O uso é este:

- Clicar num item da lista aplica aquelas configurações (**{{ui:presets.apply}}**).
- **{{ui:presets.saveNew}}**, abaixo da lista (ou o botão de salvar ao lado do cartão), salva as configurações atuais com um nome.
- O “…” à direita de um item permite **{{ui:presets.apply}}**, **{{ui:presets.overwrite}}**, **{{ui:presets.rename}}** e **{{ui:presets.delete}}**.
- A lista se divide em “{{ui:presets.group.mine}}” e “{{ui:presets.group.builtin}}”. As predefinições internas são exemplos que já vêm com o app.

### Alternar predefinições ao acaso

É possível usar várias predefinições ao acaso e gerar de uma vez. Serve para criar em sequência muitas imagens com prompts e tamanhos bem diferentes.

1. Clique no botão de setas cruzadas ({{ui:presets.run.title}}), à direita do cartão “{{ui:presets.label}}”.
2. Marque as predefinições que quer usar.
3. Digite a {{ui:presets.run.count}} no campo “×” e clique em **{{ui:presets.run.queue}}**.

Para cada imagem, uma das predefinições marcadas é escolhida com a mesma probabilidade, e a seed também é aleatória. Para o que não está na predefinição, valem as configurações atuais do painel esquerdo. As configurações do painel esquerdo não mudam.

- Se cada predefinição tiver um modelo diferente, o carregamento do modelo leva tempo a cada troca.
- Se o prompt tiver prompts dinâmicos, um prompt é escolhido a partir da seed para cada imagem (nem todas as combinações são criadas).
- Se alguma das predefinições marcadas estiver em um estado em que não pode gerar, o nome e o motivo são exibidos e não é possível adicionar à fila.
- As marcas e a quantidade continuam salvas na próxima vez que a janela for aberta.

## Predefinições de prompt

![As predefinições de prompt. Palavras e significados por categoria, com botões para acrescentar ao positivo e ao negativo](shot:prompt-book)

Para montar prompts sem precisar lembrar palavras em inglês, existe o **{{ui:params.promptBook.open}}**. Ele é aberto pelo botão acima de cada campo, positivo e negativo.

- Ao escolher à esquerda uma categoria (número de pessoas e personagens, relação e interação entre personagens, pose, movimento, expressão, olhar, composição, penteado, roupas etc.), só as palavras dessa categoria aparecem. No campo de busca, no alto, é possível procurar ao mesmo tempo por palavra, significado, categoria e anotação.
- Ao clicar em “{{ui:params.prompt.positive}}” ou “{{ui:params.prompt.negative}}” à direita de uma palavra, ela é acrescentada ao prompt. A palavra acrescentada recebe uma marca, que sai se você clicar de novo.
- No campo de entrada do alto, digite uma palavra e seu significado e clique em **{{ui:params.promptBook.register}}** para acrescentar a sua própria palavra. O lápis à direita da palavra edita, e a lixeira exclui.

## Imagem de referência

**{{ui:params.refImage.sectionLabel}}** é um recurso para aproximar de uma imagem nova o “clima” ou o “estilo” de uma imagem já existente. Ele não copia: usa como pista o uso das cores, o estilo do desenho e a impressão geral.

1. Clique no botão **＋** abaixo do prompt para acrescentar uma moldura.
2. Arraste e solte na moldura uma imagem da galeria. Também funciona soltar um arquivo de imagem do computador.
3. Clique na moldura para abrir uma pequena janela de configurações.

Na janela, é possível definir:

- **{{ui:params.refImage.model}}**: o modelo específico para imagens de referência (IP-Adapter). É preciso um que combine com a família do modelo escolhido.
- **{{ui:params.refImage.methodLabel}}**: o que usar como pista, como o conjunto, só o estilo ou só a composição (não aparece em algumas famílias de modelo).
- **{{ui:params.refImage.weight}}**: a intensidade da aproximação.
- **{{ui:params.refImage.begin}}** e **{{ui:params.refImage.end}}**: de que ponto até que ponto do processo de desenho o efeito age.

Se o modelo ou a extensão necessários não estiverem instalados, a moldura mostra uma marca de aviso, e uma orientação aparece na janela e abaixo do botão de gerar. É possível instalar pelo botão da orientação.

> A imagem de referência serve para “aproximar o clima”. Para “redesenhar a partir desta imagem”, use o i2i a seguir.

## i2i (redesenhar a partir da imagem original)

Quando você coloca uma imagem na seção **{{ui:params.i2i.title}}**, ela é usada como esboço para redesenhar. Serve para aproveitar a composição e as cores como estão e mudar conforme o prompt.

1. Abra a seção e solte na moldura uma imagem da galeria (ou um arquivo de imagem do computador). Também é possível colocá-la por **{{ui:params.refImage.openI2i}}**, na janelinha da imagem de referência.
2. A largura e a altura mudam para o tamanho em que o modelo é bom que mais se aproxima do formato da imagem colocada. Você pode alterá-las à mão depois.
3. Com **{{ui:params.image.strength}}**, defina o quanto redesenhar. Quanto mais perto de 0, mais a imagem original é mantida; quanto mais perto de 1, mais se desenha sem se importar com ela. Recomenda-se começar por volta de 0,5.

Com a {{ui:params.hires.title}} ativada, a imagem redesenhada a partir da original é ampliada e desenhada mais uma vez. Para retirá-la, clique no × no canto superior direito da moldura. Para redesenhar apenas a parte pintada, use [Desenhar sobre a tela](05-canvas.md).

### Personagens

No campo “{{ui:character.row.label}}”, acima da imagem de referência, é possível chamar personagens registrados (quantas imagens do mesmo personagem você quiser, com palavras sobre a aparência).
Ao escolher um, a imagem de referência e as palavras de aparência desse personagem são aplicadas. Como registrar personagens é explicado em [Corrigir imagens](04-improve.md).

## Fila

![A aba da fila. Os itens em processamento e os que esperam aparecem em lista](shot:queue)

Na aba **{{ui:app.tabs.queue}}**, é possível ver e operar a fila de geração. Quando há itens esperando, um selo com o número aparece em {{ui:app.tabs.queue}}, na navegação lateral.

No alto da tela há:

- O estado do processamento (“{{ui:queue.processor.running}}” ou “{{ui:queue.processor.paused}}”) e os botões de operação.
- O total de itens por situação ({{ui:queue.status.pending}}, {{ui:queue.status.inProgress}}, {{ui:queue.status.completed}}, {{ui:queue.status.failed}}, {{ui:queue.status.canceled}}).
- No canto superior direito, o progresso do item que está sendo desenhado agora.

A função dos botões é esta:

| Botão | Função |
|---|---|
| **{{ui:queue.action.pause}}** / **{{ui:queue.action.resume}}** | Pausa e retoma o processamento da fila. O que está sendo desenhado continua até o fim |
| **{{ui:queue.action.cancelCurrent}}** | Interrompe o que está sendo desenhado agora |
| **{{ui:queue.action.cancelAllExceptCurrent}}** | Cancela tudo o que está esperando |
| **{{ui:queue.action.prune}}** | Retira da lista os itens encerrados (concluídos, com falha, cancelados) |
| **{{ui:queue.action.clear}}** | Apaga todos os itens. Aparece uma janela de confirmação |

Ao clicar numa linha da lista abaixo, abrem-se as informações detalhadas do item (horário, imagens criadas, motivo da falha e o conteúdo das configurações).
O × à direita da linha cancela só aquele item. Nos itens que falharam ou foram cancelados, aparece um botão de nova tentativa.

## Atalhos de teclado

Os que não funcionam enquanto se digita um texto exigem que você saia do campo antes de pressioná-los.

| Operação | Tecla |
|---|---|
| Gerar (adicionar ao fim da fila) | `Ctrl+Enter` (funciona até durante a digitação do prompt) |
| Adicionar ao início da fila e gerar | `Ctrl+Shift+Enter` |
| Cancelar o que está sendo desenhado | `Shift+X` |
| Apagar toda a fila (sem confirmação) | `Ctrl+Shift+X` |
| Ir para o campo do prompt | `Alt+A` |
| Abrir e fechar o painel esquerdo e o direito | `T`, `G` |
| Abrir e fechar os dois painéis juntos | `F` |
| Trocar de aba (na ordem da navegação lateral, de {{ui:app.tabs.generate}} a {{ui:app.nav.extensions}}) | `1` a `9` |
| Abrir a lista de atalhos | `Shift+?` |

Os atalhos também podem ser conferidos em “{{ui:app.nav.hotkeys}}”, no menu **{{ui:app.nav.settings}}** da navegação lateral.
