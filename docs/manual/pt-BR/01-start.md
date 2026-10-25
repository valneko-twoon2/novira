# Primeiros passos

## O que o novira faz

O novira é um app de desktop para Windows que cria imagens, vídeos, música e voz.
Basta escrever um prompt (a descrição do que se quer criar) e clicar no botão **{{ui:params.invoke.invoke}}**: a imagem é desenhada no próprio computador e aparece na galeria, à direita.
A tela e as operações seguem as do InvokeAI, uma ferramenta de geração de imagens. Quem já usou o InvokeAI vai se sentir em casa.

De forma geral, é possível:

- Criar imagens a partir de texto (o foco deste guia)
- Refazer uma imagem a partir de outra, redesenhar só uma parte dela e ampliá-la
- Criar vídeos, música, voz, logotipos e imagens com texto
- Conversar com o assistente de IA sobre configurações e prompts

> O desenho das imagens acontece no seu computador. Os recursos que usam a internet, como buscar e baixar modelos ou o assistente de IA, só se comunicam quando você escolhe usá-los.

## Como as imagens são criadas

O novira é formado por 4 partes:

| Parte | Função |
|---|---|
| novira (este app) | Tela, galeria, fila de espera e gerenciamento de modelos |
| Mecanismo de geração de imagens (ComfyUI) | A parte que realmente desenha. O novira o instala e o inicia por conta própria |
| Modelos | Dados de aprendizado usados para desenhar. Cada um é um arquivo de vários GB, preparado à parte do mecanismo |
| Pasta de dados | O lugar onde ficam as imagens criadas, os modelos, o próprio mecanismo etc. |

Não é preciso instalar o mecanismo manualmente. O novira o instala sozinho na primeira inicialização.
O mecanismo e seus componentes (como o Python) ficam apenas dentro da pasta de dados do novira. Nenhum outro local do computador nem qualquer Python já existente é alterado.

A pasta de dados se chama `novira-data` e fica dentro da pasta do app. É ela que se usa para mover ou fazer backup de imagens e modelos.

> A geração de imagens usa a GPU (placa de vídeo). Por padrão, é instalado o mecanismo para GPUs NVIDIA.

O modelo define o estilo do desenho, e é necessário ter um modelo desde o começo. Como instalar é explicado em [Preparar modelos](08-models.md).

## Na primeira inicialização

Ao abrir o app, aparece primeiro a tela de abertura (o logotipo e bolhas de imagem flutuando devagar).
Abaixo dela, um cartão mostra o que está sendo feito no momento.

Na primeira inicialização, começa a instalação do mecanismo de geração de imagens. O cartão mostra 3 etapas, em sequência:

1. **{{ui:splash.step.downloading}}**: baixa o ComfyUI e o Python. Também são exibidos o tamanho, a velocidade e uma estimativa do tempo restante.
2. **{{ui:splash.step.extracting}}**: extrai os arquivos baixados.
3. **{{ui:splash.step.starting}}**: inicia o mecanismo e aguarda a conexão.

> {{ui:engine.firstRunNote}}

A instalação acontece uma única vez. Nas próximas vezes, a tela de abertura dura alguns segundos e o mecanismo começa a funcionar logo.

Quando o mecanismo fica pronto, a tela de abertura desaparece e a tela principal é aberta.
Enquanto os dados são carregados, aparece “{{ui:splash.wait.heading.loading}}”; enquanto se aguarda o carregamento das informações do mecanismo e da edição, aparece “{{ui:splash.wait.heading.preparing}}”.

### Mensagens na parte de cima da tela

Se, depois de o app ser aberto, o mecanismo for reiniciado ou reinstalado, uma faixa (banner) aparece no centro, na parte de cima da tela, para informar a situação.

- “{{ui:engine.title.downloading}}”, “{{ui:engine.title.extracting}}”, “{{ui:engine.title.starting}}”: trabalho em andamento. A geração só começa depois que terminar. Quando acaba, a faixa some sozinha.
- “{{ui:engine.title.error}}”: não foi possível preparar o mecanismo. O motivo aparece na linha abaixo da faixa.

Se ocorrer um erro na tela de abertura, o botão **{{ui:splash.open}}** aparece abaixo do motivo. Ao clicar nele, o app abre sem o mecanismo. É possível verificar modelos e mexer nas configurações, mas não criar imagens.
Se o erro continuar, consulte [Solução de problemas](10-troubleshooting.md).

## Conhecendo a tela

![A aba de geração inteira. O painel de parâmetros fica à esquerda, a tela inicial no centro e as pastas e a galeria à direita](shot:generate)

A tela é organizada da esquerda para a direita, assim:

- A faixa vertical estreita na extrema esquerda: a **navegação lateral**. Serve para trocar de aba.
- O painel da esquerda: o **painel de parâmetros**. Contém as configurações para criar imagens, como o prompt e o modelo.
- O centro: a **visualização principal**. É o espaço de trabalho de cada aba, como a tela inicial, o visualizador de imagens e a tela de desenho.
- O painel da direita: a **galeria**. Mostra as pastas, parecidas com as do computador, e as miniaturas das imagens criadas.

### Navegação lateral (abas)

| Aba | Para que serve | Tecla numérica |
|---|---|---|
| **{{ui:app.tabs.generate}}** | Criar imagens. Os ícones no alto também permitem alternar para vídeo, música, voz, logotipo, texto e quadrinhos | `1` |
| **{{ui:app.tabs.canvas}}** | Colocar uma imagem, desenhar por cima ou redesenhar só uma parte | `2` |
| **{{ui:app.tabs.comic}}** | Criar páginas de quadrinho: distribuição dos quadros, uma imagem por quadro, balões e legendas. Também abre pelo ícone mais à direita no alto da aba {{ui:app.tabs.generate}} | `3` |
| **{{ui:app.tabs.upscaling}}** | Aumentar a imagem e acrescentar detalhes finos | `4` |
| **{{ui:app.tabs.workflows}}** | Conectar componentes (nós) para montar o seu próprio processo de geração | `5` |
| **{{ui:app.tabs.models}}** | Lista dos modelos que você tem, instalação e exclusão | `6` |
| **{{ui:app.tabs.browse}}** | Procurar e trazer modelos da internet | `7` |
| **{{ui:app.tabs.queue}}** | Ver e interromper a fila de geração. Um selo mostra quantos itens estão esperando | `8` |
| **{{ui:app.nav.extensions}}** | Procurar extensões do ComfyUI e instalá-las ou removê-las | `0` |

Na parte de baixo da navegação lateral também há:

- **{{ui:app.tabs.short.agent}}**: abre a janela do assistente de IA sobre a tela atual.
- **{{ui:app.nav.settings}}**: no menu, abre {{ui:app.nav.settings}}, {{ui:app.nav.hotkeys}} e {{ui:app.nav.about}}.
- O logotipo “n” no alto: abre {{ui:app.nav.about}}.

Cada uma dessas partes é explicada nos próximos capítulos.

- {{ui:app.tabs.generate}} e {{ui:app.tabs.queue}}: [Criar imagens](02-generate.md)
- Galeria e visualizador: [Galeria e visualizador](03-gallery.md)
- {{ui:app.tabs.canvas}}: [Desenhar sobre a tela](05-canvas.md)
- {{ui:app.tabs.comic}}: [Desenhar quadrinhos](12-comic.md)
- {{ui:app.tabs.upscaling}} e {{ui:app.tabs.workflows}}: [Ampliação e fluxos de trabalho](06-upscaling-workflows.md)
- Vídeo, música, voz e outros: [Vídeo, música, voz, logotipo e texto](07-media.md)
- {{ui:app.tabs.models}} e {{ui:app.tabs.browse}}: [Preparar modelos](08-models.md)
- {{ui:app.tabs.short.agent}} e {{ui:app.nav.settings}}: [Assistente de IA e configurações](09-assistant-settings.md)

### Abas do centro (início, visualizador e rascunhos)

Na parte de cima do centro da aba {{ui:app.tabs.generate}} há 3 pequenas abas.

- **{{ui:app.views.launchpad}}**: um guia para começar. Mostra cartões como “{{ui:params.launchpad.generate.textTitle}}” e “{{ui:params.launchpad.generate.refTitle}}”, além de dicas de atalhos.
- **{{ui:app.views.viewer}}**: o lugar para ver as imagens em tamanho grande. Ao selecionar uma imagem na galeria, ela aparece aqui.
- **{{ui:app.views.drafts}}**: uma tela que alinha vários candidatos desenhados até a metade, com as mesmas configurações e apenas a seed diferente, para que só os preferidos sejam desenhados até o fim.

As outras abas também têm suas próprias pequenas abas (na aba {{ui:app.tabs.canvas}}, por exemplo, há {{ui:app.views.canvas}}).

### Ocultar os painéis

Para ver a imagem em um espaço maior, é possível ocultar os painéis da esquerda e da direita.

- Os pequenos botões de seta na borda superior do centro abrem e fecham o painel esquerdo e o direito.
- No teclado, `T` alterna o painel esquerdo, `G` o direito e `F` os dois ao mesmo tempo.
- Arrastar a divisa entre os painéis muda a largura deles. A largura fica memorizada enquanto o app estiver aberto; ao abri-lo de novo, ela volta à largura inicial.

> Os atalhos de uma única letra, como `T`, `G` e `F`, não funcionam enquanto se digita um texto. Saia do campo de texto antes de pressioná-los.

## Criar a primeira imagem (3 passos)

Este é o caminho para criar uma imagem pela primeira vez. A explicação pressupõe que já haja um modelo instalado.

1. **Escolher o modelo.** No campo de modelo, na parte de cima do painel esquerdo, escolha o modelo desejado. Se o campo mostrar “{{ui:params.model.noModels}}”, conclua antes [Preparar modelos](08-models.md).
2. **Escrever o prompt.** No campo “{{ui:params.prompt.positive}}”, descreva em palavras a imagem que se quer criar. Por exemplo, `a lighthouse on a cliff at dusk, calm sea, warm light`: palavras ou frases curtas ligadas por vírgulas. Com a maioria dos modelos, escrever em inglês costuma dar resultados mais fiéis ao que se espera.
3. **Clicar em {{ui:params.invoke.invoke}}.** Clique no botão ou pressione `Ctrl+Enter`. Acima da galeria, à direita, aparece “{{ui:gallery.generating.title}}”, com a imagem parcial e o progresso. Quando termina, a imagem aparece no visualizador central e também na galeria.

Se o botão estiver cinza e não puder ser clicado, o motivo aparece na linha abaixo dele (por exemplo, “{{ui:params.readiness.noModel}}”). Corrigindo o motivo, o botão volta a funcionar.

A imagem criada é salva automaticamente na galeria. Se não gostar do resultado, basta mudar um pouco o prompt ou as configurações e clicar de novo.
Para mais detalhes, siga para [Criar imagens](02-generate.md).
