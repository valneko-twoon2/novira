# Criar imagens

Este capítulo explica como criar imagens na aba **{{ui:app.tabs.generate}}**.
Para conhecer a tela, veja [Primeiros passos](01-start.md); para ver e organizar as imagens criadas, veja [Galeria e visualizador](03-gallery.md).

O fluxo para criar é sempre o mesmo.

1. Escolher o modelo
2. Escrever o prompt
3. Se necessário, ajustar configurações como tamanho e seed
4. Clicar em **{{ui:params.invoke.invoke}}**

A imagem não começa a ser desenhada no instante do clique: primeiro ela entra na “{{ui:app.tabs.queue}}” (a linha de espera). Quando chega a vez, as imagens são desenhadas uma de cada vez.

## Escrever o prompt

![A aba de geração com uma frase no prompt e a seed fixa](shot:generate-prompt)

Em “{{ui:params.prompt.title}}”, no painel esquerdo, há dois campos.

- **{{ui:params.prompt.positive}}**: escreva o que se quer que seja desenhado.
- **{{ui:params.prompt.negative}}**: escreva o que não se quer que apareça, por exemplo `blurry, watermark` (desfoque, marca d’água). Também é possível gerar com ele vazio.

Algumas orientações para escrever:

- Separe palavras ou frases curtas com vírgulas (`,`).
- Com a maioria dos modelos, escrever em inglês costuma dar resultados mais fiéis ao que se espera. Se a descrição do modelo indicar uma forma de escrever, siga-a.
- Coloque as palavras importantes no começo.

Os pequenos botões acima do campo funcionam assim:

| Botão | Função |
|---|---|
| **{{ui:params.prompt.recommended}}** | Acrescenta, no início de “{{ui:params.prompt.positive}}”, palavras de qualidade adequadas ao modelo escolhido (como `masterpiece, best quality`) e, no fim de “{{ui:params.prompt.negative}}”, palavras comuns a evitar. As palavras que já estão no campo não são repetidas |
| **{{ui:params.prompt.expand}}** | Edita o positivo e o negativo lado a lado em uma janela grande |
| **{{ui:params.promptBook.open}}** | Abre uma lista de palavras reunidas com seus significados (veja adiante) |
| **{{ui:caption.fromPrompt}}** | Olha a imagem e escreve palavras que podem ser usadas no prompt. Também funciona soltando neste botão uma imagem da galeria ou um arquivo de imagem do computador (explicado em [Corrigir e reaproveitar imagens](04-improve.md)) |
| “Predefinição” de cada campo | Salva e carrega apenas o texto do prompt (veja adiante) |

### Contagem de tokens

O texto “0 / 77 tokens”, acima do campo, é uma estimativa da quantidade de palavras escritas.
Token é a unidade em que o modelo divide o texto ao lê-lo. Quando o limite é ultrapassado, o número muda para a cor de aviso. Em alguns modelos, a parte que passa do limite pode perder o efeito.
O número é aproximado, não exato.

### Criar várias combinações de uma vez `{red|blue}`

No campo positivo, se você escrever as opções entre chaves separadas por barras verticais (`|`), como em `{red|blue}`, uma imagem diferente é criada para cada opção.

- Escrever `a {red|blue} flower` gera duas versões: `a red flower` e `a blue flower`.
- Com duas ou mais chaves, saem todas as combinações. `a {red|blue} {cat|dog}` resulta em 4 versões.
- Também é possível colocar chaves dentro de chaves.
- Para usar a própria chave como caractere, coloque `\` antes dela (`\{`).
- O número de combinações é de no máximo 100.

Quando a “{{ui:params.invoke.iterations}}” (veja adiante) é 2 ou mais, são criadas tantas imagens quanto o número de combinações × a quantidade. Por exemplo, com 2 combinações e quantidade 3, são 6 imagens.
Essa sintaxe só vale no campo positivo. No campo negativo, as chaves são tratadas como texto comum.

Para conferir em quais frases o texto se expande, use o botão **{{ui:params.prompt.dynamicPreview}}** (ícone `{ }`) acima do campo positivo. Ao clicar, aparece a lista de combinações.

### Curingas `__nome__`

![A janela de curingas. A lista de listas fica à esquerda; o nome e os itens da lista escolhida, à direita](shot:wildcards)

Se você escrever `__nome__` (dois sublinhados antes e depois do nome) no campo positivo, é inserido um item de cada vez, da lista de “{{ui:params.wildcards.title}}” com esse nome. Se você deixar suas opções preferidas numa lista, não precisa escrever `{red|blue}` toda vez.

- Escrever `1girl, __hair-color__` cria tantos prompts quantos forem os itens da lista hair-color.
- Os itens também podem conter `{a|b}` e outros curingas. O limite é de 6 níveis de curingas dentro de curingas.
- O limite do número de combinações (100) é o mesmo de `{ }`.
- Se houver um nome inexistente, uma lista sem itens ou uma lista que usa a si mesma, **{{ui:params.invoke.invoke}}** não pode ser clicado e o motivo aparece abaixo do botão.

As listas são abertas por **{{ui:params.wildcards.open}}**, na parte de baixo da janela do botão **{{ui:params.prompt.dynamicPreview}}**. Desde o início já existem 3 listas: hair-color (cor do cabelo), expression (expressão) e time-of-day (hora do dia).

| Operação | Função |
|---|---|
| **{{ui:params.wildcards.new}}** | Adiciona uma lista vazia |
| Campo “{{ui:params.wildcards.name}}” | Muda o nome da lista. Podem ser usados letras, números, `-` e `_`, e o primeiro e o último caractere devem ser letra ou número |
| Campo “{{ui:params.wildcards.entries}}” | Escreva um item por linha. Linhas vazias e linhas que começam com `#` não viram itens |
| **{{ui:params.wildcards.import}}** / **{{ui:params.wildcards.export}}** | Lê e grava uma lista como arquivo .txt com um item por linha. O arquivo importado vira uma nova lista com o nome do arquivo |
| **{{ui:common.delete}}** | Exclui a lista selecionada |

As listas são salvas dentro deste app (no computador que está sendo usado).

### Escolher ao acaso

Quando há combinações demais, alterne “{{ui:params.prompt.dynamicMode}}” na janela do botão **{{ui:params.prompt.dynamicPreview}}**.

- **{{ui:params.prompt.modeCombinatorial}}** (configuração inicial): para cada combinação, cria tantas imagens quanto a quantidade.
- **{{ui:params.prompt.modeRandom}}**: cria tantas imagens quanto a quantidade e escolhe uma combinação para cada uma. A escolha depende da seed da imagem; por isso, redesenhar com a mesma seed dá o mesmo prompt.

Em qualquer um dos modos, o prompt realmente usado fica salvo junto com a imagem.

## Seed

As imagens são criadas a partir de um número chamado “{{ui:params.seed.label}}”. Com a mesma seed e as mesmas configurações, sai a mesma imagem.

Na linha “{{ui:params.seed.label}}”, na parte de cima do painel esquerdo, há dois botões.

- **{{ui:params.seed.random}}** (dado): usa uma seed nova a cada geração. Cada vez sai uma imagem diferente. É o estado inicial.
- **{{ui:params.seed.fixed}}** (cadeado): desenha com a seed atual. Não importa quantas vezes se crie com as mesmas configurações, a imagem é a mesma. É útil para ver a diferença causada ao mudar uma única palavra do prompt.

Com a seed fixa, o campo do número da seed e o botão “{{ui:params.seed.shuffle}}” ficam travados (para evitar mudanças acidentais).
Para usar um número específico, digite-o no campo com o estado “{{ui:params.seed.random}}” e depois passe para “{{ui:params.seed.fixed}}”.
Para usar a seed de uma imagem de que gostou, abra a imagem na galeria e clique em “{{ui:gallery.menu.useSeed}}”: a seed é carregada já fixa (veja [Galeria e visualizador](03-gallery.md)).

Se você aumentar a quantidade com a seed fixa, da segunda imagem em diante a seed sobe de 1 em 1.

## Escolher o modelo

![A lista de modelos aberta, dividida por família, como FLUX, SDXL e SD1.X](shot:model-picker)

No cartão de modelo, na parte de cima do painel esquerdo, escolha o modelo que vai desenhar.

1. Clique no campo do nome do modelo.
2. Escolha na lista. A lista é dividida por família de modelos (FLUX, SDXL, SD1.X etc.). Se houver muitos, digite parte do nome no campo de busca, acima, para filtrar.
3. O modelo escolhido recebe um ✓ e a imagem do cartão (a capa) também muda.

Os botões **{{ui:app.tabs.short.models}}**, abaixo da lista, levam à aba {{ui:app.tabs.models}} (gerenciamento dos modelos que você tem), e **{{ui:app.tabs.short.browse}}**, à aba {{ui:app.tabs.browse}} (busca na internet). Como aumentar o número de modelos é explicado em [Preparar modelos](08-models.md).

Se o modelo tiver configurações recomendadas registradas (passos, CFG, agendador, tamanho), elas são preenchidas automaticamente ao escolhê-lo.
Ao trocar para um modelo de outra família, LoRAs e itens semelhantes que não combinam com o novo modelo são removidos (a quantidade removida é informada em uma notificação).

Ao clicar no botão **{{ui:params.profile.title}}**, abaixo do campo de modelo, os valores recomendados para ele aparecem em uma lista. Se a configuração atual se afastar do recomendado, o botão fica destacado e **{{ui:params.profile.apply}}** alinha tudo aos valores recomendados.

> Quando nenhum modelo está instalado, o campo mostra “{{ui:params.model.noModels}}” e não é possível gerar. Conclua antes [Preparar modelos](08-models.md).

## Outras configurações

Abaixo do prompt há seções que reúnem as configurações. Elas abrem e fecham com um clique.

| Seção | O que contém |
|---|---|
| **{{ui:params.refImage.sectionLabel}}** (logo abaixo do prompt) | Imagens para aproximar o clima ou os personagens (veja adiante) |
| **{{ui:params.image.title}}** | {{ui:params.image.aspect}}, largura e altura. Também há os botões “{{ui:params.image.swap}}”, “{{ui:params.image.lock}}” e “{{ui:params.image.optimal}}” |
| **{{ui:params.generation.title}}** | LoRA (pequeno modelo adicional que acrescenta estilo ou personagens), {{ui:params.generation.scheduler}}, {{ui:params.generation.steps}} e {{ui:params.generation.cfg}} |
| **{{ui:params.hires.title}}** | Uma segunda geração que amplia a imagem desenhada e a desenha de novo (veja adiante) |
| **{{ui:params.advanced.title}}** | {{ui:params.advanced.vae}}, {{ui:params.advanced.clipSkip}}, {{ui:params.advanced.seamless}} (imagem que não mostra costura quando repetida lado a lado) etc. |

Na dúvida, exceto pelo tamanho, pode-se deixar o que foi preenchido ao escolher o modelo.
Passar o cursor sobre o nome de um item (“{{ui:params.generation.steps}}”, “{{ui:params.generation.cfg}}” etc.) mostra uma explicação curta. O título de cada seção exibe, em pequeno, um resumo do valor atual.

Quanto maior o tamanho, maiores o tempo e a carga sobre o computador. O recomendado é testar primeiro com um tamanho menor e, se o resultado for bom, aumentar com a [ampliação](06-upscaling-workflows.md).

## Correção em alta resolução

![A seção de correção em alta resolução aberta e ativada](shot:hires-fix)

Desenhar já em um tamanho grande facilita que apareçam duas pessoas ou que as formas se desfaçam. A **{{ui:params.hires.title}}** desenha primeiro no tamanho configurado, amplia o resultado e o desenha de novo com a mesma seed e as mesmas configurações. Em uma única geração, sai uma imagem grande e detalhada. Esta seção existe nas abas {{ui:app.tabs.generate}} e {{ui:app.tabs.comic}}.

- **{{ui:params.hires.enable}}**: ative para usar.
- **{{ui:params.hires.scale}}**: de 1,25 a 2 vezes. O tamanho final aparece no título da seção e na última linha.
- **{{ui:params.hires.strength}}**: de 0,2 a 0,75. Valores baixos mantêm quase por completo a primeira imagem; valores altos a redesenham bastante. O valor inicial é 0,45.
- **{{ui:params.hires.method}}**: **{{ui:params.hires.methodSmooth}}** amplia sem usar um modelo. Se houver um modelo de ampliação instalado, usado na aba {{ui:app.tabs.upscaling}}, ele também pode ser escolhido.
- **{{ui:params.hires.steps}}**: o número de passos da segunda geração. Com 0, usa-se o mesmo número da primeira.

O tempo é o de desenhar duas vezes. O progresso é contado somando as duas. LoRAs e imagens de referência também são usados na segunda geração.

Quando o resultado excede muito o tamanho em que o modelo é bom (cerca de 2048 px no lado maior com SDXL e 1536 px com SD1.X), aparece um aviso abaixo do botão de gerar. A geração é possível, mas, se a imagem se desfizer, reduza a escala de ampliação.

Na imagem são salvos o tamanho da primeira geração e os valores de {{ui:params.hires.title}}. Ao carregar com “{{ui:gallery.menu.useAll}}” na galeria, a {{ui:params.hires.title}} também é preenchida da mesma forma.

## Iterações e botão de gerar

![O menu aberto pela seta ao lado do botão de gerar](shot:invoke-menu)

Os controles de geração ficam juntos na parte de cima do painel esquerdo.

- **{{ui:params.invoke.invoke}}** (botão azul): adiciona ao fim da fila e gera. Também funciona com `Ctrl+Enter`.
- **O número ao lado do ×**: a quantidade de imagens criadas em uma operação. Com “3”, são criadas 3 imagens.
- **Botão × vermelho**: cancela o que está sendo desenhado.
- **∨ à direita de cada botão**: o menu das outras operações.

Quando não é possível clicar, o botão fica cinza e o motivo (como nenhum modelo escolhido) aparece na linha abaixo dele. Passando o cursor sobre o botão, vê-se a lista de motivos.
Durante o desenho, o botão muda para “{{ui:params.invoke.generating}}” e mostra o progresso (%) e o número de itens esperando na fila.

### Menu ∨ do botão de gerar

- **{{ui:params.invoke.addBack}}** (`Ctrl+Enter`): desenha na ordem em que foi clicado. É igual à geração comum.
- **{{ui:params.invoke.addFront}}** (`Ctrl+Shift+Enter`): entra na frente da fila de espera. Use quando houver pressa e se quiser testar apenas uma imagem.
- **{{ui:xyplot.menu}}**: com base nas configurações atuais, alinha em uma tabela imagens em que apenas 1 ou 2 configurações mudam. Como todas são desenhadas com a mesma seed, a diferença vem só do que foi alterado. Escolha, na horizontal e na vertical, itens como escala CFG, passos e modelo, digite os valores e clique em **{{ui:xyplot.run}}**.

### Menu de cancelamento

Clicando no ∨ à direita do botão × vermelho, aparece este menu:

- **{{ui:params.invoke.cancelCurrent}}** (`Shift+X`)
- **{{ui:params.invoke.clearQueue}}** (`Ctrl+Shift+X`): apaga tudo, tanto o que está esperando quanto o que está sendo desenhado. Não há confirmação.
- **{{ui:params.invoke.pause}}** / **{{ui:params.invoke.resume}}**: para e retoma o processamento da fila.
- **{{ui:params.invoke.openQueue}}**

## Ver a imagem criada

![A tela após o fim da geração. A imagem aparece no visualizador central e também na galeria, à direita](shot:generate-result)

Ao clicar, o centro muda imediatamente para o visualizador.
Durante o desenho, uma faixa “{{ui:gallery.generating.title}}” aparece acima da galeria, à direita, mostrando a imagem parcial, o número do passo e o progresso. A linha fina na borda superior do centro também indica o progresso.

Quando termina, a imagem é adicionada à galeria e aparece no visualizador.
A imagem é salva na pasta atualmente selecionada (a que tem a marca “{{ui:gallery.boards.autoBadge}}” no painel direito). Sobre pastas e sobre organizar, comparar e refazer imagens, veja [Galeria e visualizador](03-gallery.md).

> Se o visualizador trocar sozinho para a imagem nova e isso atrapalhar, desative “{{ui:gallery.settings.autoSwitch}}” em {{ui:gallery.settings.title}} (o botão de engrenagem).

## Predefinições

![A lista de predefinições. As predefinições embutidas e as salvas aparecem juntas](shot:presets)

Combinações de configurações usadas com frequência podem ser salvas como predefinições. Clique no cartão “{{ui:presets.label}}”, no topo do painel esquerdo, e a lista abre.

Uma predefinição guarda, em conjunto:

- O prompt (positivo e negativo)
- O modelo e cada configuração (tamanho, passos, CFG, agendador, VAE etc.)
- LoRAs e imagens de referência

A seed e a quantidade não entram.

Como usar:

- Clicar em um item da lista aplica aquelas configurações (**{{ui:presets.apply}}**).
- **{{ui:presets.saveNew}}**, abaixo da lista (ou o botão de salvar ao lado do cartão), salva as configurações atuais com um nome.
- O “…” à direita de cada item permite **{{ui:presets.apply}}**, **{{ui:presets.overwrite}}**, **{{ui:presets.rename}}** e **{{ui:presets.delete}}**.
- A lista é dividida em “{{ui:presets.group.mine}}” e “{{ui:presets.group.builtin}}”. As predefinições embutidas são exemplos que já vêm no app.

À parte disso, também há um campo “Predefinição” acima de cada campo positivo e negativo. Ele salva e carrega apenas o texto do prompt, e é adequado para guardar frases fixas (conjuntos de palavras de qualidade ou de palavras a evitar).

## Lista de prompts

![A lista de prompts. Palavras e significados por categoria, com botões de adicionar “Positivo” e “Negativo”](shot:prompt-book)

Para montar prompts sem precisar lembrar palavras em inglês, existe a **{{ui:params.promptBook.open}}**. Ela é aberta pelo botão acima dos campos positivo e negativo.

- Escolhendo à esquerda uma categoria (penteado, expressão, roupa, composição etc.), só as palavras dessa categoria aparecem. O campo de busca, acima, procura ao mesmo tempo em palavras, significados, categorias e anotações.
- Clicar em “{{ui:params.prompt.positive}}” ou “{{ui:params.prompt.negative}}”, à direita de uma palavra, a adiciona ao prompt. A palavra adicionada recebe uma marca de seleção, e clicar de novo a remove.
- No campo de entrada do topo, digite uma palavra e seu significado e clique em **{{ui:params.promptBook.register}}** para acrescentar a sua própria palavra. O lápis à direita da palavra edita e a lixeira exclui.

## Imagem de referência

O recurso **{{ui:params.refImage.sectionLabel}}** serve para aproximar a nova imagem do “clima” ou do “estilo” de uma imagem que já existe. Ele não copia o original: usa como pistas as cores, o estilo do desenho e a impressão geral.

1. Clique no botão **＋** abaixo do prompt para acrescentar um quadro.
2. Arraste e solte uma imagem da galeria nesse quadro. Também funciona soltar um arquivo de imagem do computador.
3. Clicar no quadro abre uma pequena janela de configuração.

Na janela, é possível definir:

- **{{ui:params.refImage.model}}**: um modelo exclusivo para imagem de referência (IP-Adapter). É necessário um que combine com a família do modelo escolhido.
- **{{ui:params.refImage.methodLabel}}**: o que usar como pista, como o conjunto, só o estilo ou só a composição (não aparece em algumas famílias de modelos).
- **{{ui:params.refImage.weight}}**: a intensidade da aproximação.
- **{{ui:params.refImage.begin}}** e **{{ui:params.refImage.end}}**: de que ponto a que ponto do processo de desenho o efeito vale.

Se o modelo ou a extensão necessários não estiverem instalados, o quadro mostra um sinal de aviso e há uma orientação na janela e abaixo do botão de gerar. É possível instalar pelo botão dessa orientação.

> A imagem de referência serve para “aproximar o clima”. Para “redesenhar a partir desta imagem”, use a tela de desenho. Veja [Desenhar sobre a tela](05-canvas.md).

### Personagens

No campo “{{ui:character.row.label}}”, acima da imagem de referência, é possível chamar uma pessoa registrada (qualquer número de imagens da mesma pessoa, com palavras de aparência).
Ao escolher, as imagens de referência e as palavras de aparência dessa pessoa são definidas. Como registrar uma pessoa é explicado em [Corrigir imagens](04-improve.md).

## Fila

![A aba de fila. O item em processamento e os que estão esperando aparecem em uma lista](shot:queue)

Na aba **{{ui:app.tabs.queue}}**, é possível ver e operar a fila de geração. Quando há itens esperando, um selo com o número aparece em {{ui:app.tabs.queue}}, na navegação lateral.

Na parte de cima da tela há:

- O estado do processamento (“{{ui:queue.processor.running}}” ou “{{ui:queue.processor.paused}}”) e os botões de operação.
- O detalhamento do número de itens ({{ui:queue.status.pending}}, {{ui:queue.status.inProgress}}, {{ui:queue.status.completed}}, {{ui:queue.status.failed}}, {{ui:queue.status.canceled}}).
- No alto, à direita, o progresso do item que está sendo desenhado.

Os botões funcionam assim:

| Botão | Função |
|---|---|
| **{{ui:queue.action.pause}}** / **{{ui:queue.action.resume}}** | Para ou retoma o processamento da fila. O que já está sendo desenhado continua até o fim |
| **{{ui:queue.action.cancelCurrent}}** | Interrompe o que está sendo desenhado |
| **{{ui:queue.action.cancelAllExceptCurrent}}** | Cancela tudo o que está esperando |
| **{{ui:queue.action.prune}}** | Remove da lista os itens terminados (concluídos, com falha ou cancelados) |
| **{{ui:queue.action.clear}}** | Apaga todos os itens. Aparece uma janela de confirmação |

Clicando em uma linha da lista abaixo, abrem-se as informações detalhadas do item (horário, imagens criadas, motivo da falha, conteúdo das configurações).
O × à direita da linha cancela apenas aquele item. Nos itens que falharam ou foram cancelados, aparece um botão para tentar de novo.

## Teclas de atalho

Os atalhos que não funcionam enquanto se digita texto devem ser usados depois de sair do campo de texto.

| Operação | Tecla |
|---|---|
| Gerar (adicionar ao fim da fila) | `Ctrl+Enter` (também funciona durante a digitação do prompt) |
| Gerar adicionando ao início da fila | `Ctrl+Shift+Enter` |
| Cancelar o que está sendo desenhado | `Shift+X` |
| Apagar toda a fila (sem confirmação) | `Ctrl+Shift+X` |
| Ir para o campo do prompt | `Alt+A` |
| Abrir ou fechar o painel esquerdo e o direito | `T`, `G` |
| Abrir ou fechar os dois painéis juntos | `F` |
| Trocar de aba (de {{ui:app.tabs.generate}} a {{ui:app.tabs.queue}}, em ordem) | `1` a `9` |
| Abrir a lista de atalhos | `Shift+?` |

Os atalhos também podem ser conferidos em “{{ui:app.nav.hotkeys}}”, no menu de **{{ui:app.nav.settings}}** da navegação lateral.
