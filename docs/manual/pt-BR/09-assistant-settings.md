# O agente, as configurações e os atalhos

Este capítulo explica o agente, que ajusta as configurações para você quando você diz o que quer em palavras, a tela de configurações, a lista de atalhos de teclado, a tela com informações sobre o app e o registro do desenvolvedor.

A tela de configurações, os atalhos de teclado e as informações sobre o app são abertos pelo **{{ui:app.nav.settingsMenu}}**, no canto inferior esquerdo da tela.

## O agente

![O agente no painel direito. A primeira tela, onde se escolhe qual IA usar e se faz o login](shot:agent)

Ao pressionar a aba **{{ui:app.right.assistant}}**, no alto do painel direito, o **{{ui:agent.title}}** aparece no lugar da galeria. Ele pode ser usado nas telas {{ui:app.tabs.generate}}, {{ui:app.tabs.canvas}}, {{ui:app.tabs.upscaling}} e {{ui:app.tabs.workflows}}, e o chat e o texto que você estava escrevendo continuam como estão quando você muda de tela. Com a aba **{{ui:app.right.gallery}}**, você volta à galeria. Quando você faz uma pergunta ao agente a partir da tela de {{ui:app.nav.extensions}}, ele abre em uma janela sobre a tela. Essa janela aparece só na tela em que você fez a pergunta e não aparece ao ir para outras telas, como {{ui:app.tabs.models}} e {{ui:app.tabs.browse}}. É possível mover a janela arrastando o título.

Em vez de escolher modelos e LoRAs ou definir o prompt e o tamanho, você diz em palavras o que quer criar, como “uma garota em estilo anime em pé numa praia ao pôr do sol”, e o agente escolhe as configurações e as preenche para você.

### Primeiros passos (login)

O novira não executa uma IA por conta própria. O agente chama um comando de IA que está no seu computador (Claude ou Codex) para produzir as respostas. Para usá-lo, é preciso fazer a seguinte preparação.

1. Instale no computador um destes comandos: **Claude**, da Anthropic, ou **Codex**, da OpenAI.
2. Abra o agente e pressione o que deseja usar (**{{ui:agent.setup.claude}}** ou **{{ui:agent.setup.codex}}**).
3. Um navegador se abre, e é nele que você faz o login.

Se esse comando não for encontrado no computador, aparece a mensagem “O comando de ○○ não foi encontrado neste PC. Instale-o primeiro.”. Instale esse comando antes.

Os serviços e contratos usados são os da opção que você escolheu. Com Claude e Codex, o novira não guarda chaves de API. O conteúdo da conversa (o texto que você enviou e as informações do app que o agente leu para trabalhar, como a lista de modelos, as configurações e o conteúdo do quadrinho ou do texto abertos) é enviado ao serviço que você escolheu. As informações das imagens da galeria e o prompt da aba de geração só são lidos quando você permite (veja “Permissão para ler imagens e prompts” abaixo).

A IA escolhida aparece na primeira linha do agente. Para trocá-la, pressione o botão **{{ui:agent.changeProvider}}**, à direita dessa linha.

### Conectar a um servidor como o Ollama

![A tela de conexão com um servidor. O botão do Ollama, o endereço, o modelo e o resultado do teste de conexão](shot:agent-server)

Além de Claude e Codex, o agente também pode usar um servidor com API compatível com a da OpenAI, que rode neste computador ou na rede (como Ollama e LM Studio). O novira consulta o servidor para obter as respostas e executa por conta própria as ferramentas do agente (configurações, operações do editor etc.), por isso é preciso um modelo compatível com chamadas de ferramentas.

Os passos para conectar são estes.

1. Abra o agente e pressione **{{ui:agent.setup.openai}}**.
2. Pressione o botão do servidor que vai usar (para o Ollama, o botão **Ollama**). O endereço é preenchido e a lista de modelos do servidor é carregada. Em outros servidores, digite em **{{ui:agent.endpoint.address}}** o endereço, que normalmente termina em “/v1”.
3. Escolha o **{{ui:agent.endpoint.model}}** na lista. Se o servidor não fornecer a lista, digite o nome.
4. Se o servidor exigir uma chave, digite-a em **{{ui:agent.endpoint.key}}**. A chave é salva criptografada neste computador e enviada somente a este servidor. Em um servidor no seu próprio computador, normalmente não é necessária.
5. Pressione **{{ui:agent.endpoint.test}}**. O teste verifica se o servidor responde, se o modelo existe e se ele consegue chamar as ferramentas do app.
6. Pressione **{{ui:agent.endpoint.use}}**.

Se o modelo não consegue chamar ferramentas, o teste mostra isso, junto com o motivo devolvido pelo servidor. Um aviso também permanece acima do campo de entrada, e o envio de mensagens é recusado. Se você escolher outro modelo com o botão ao lado do nome do chat, é possível verificar de novo. O teste também falha da mesma forma quando o contexto do servidor (o tamanho que ele consegue ler de uma vez) é pequeno demais para os pedidos do agente. A configuração padrão do Ollama é assim. Defina o contexto do servidor para 32768 ou mais (nas configurações do Ollama ou pela variável de ambiente OLLAMA_CONTEXT_LENGTH) e pressione **{{ui:agent.endpoint.test}}** de novo. O novira não finge que consegue usar ferramentas.

Enquanto um servidor é usado, o título do chat mostra OpenAI API. Pressione **{{ui:agent.changeProvider}}** para voltar à tela de escolha. O servidor que você digitou permanece no formulário.

Em um servidor fora deste computador, o que você envia e, se você permitir, o que o agente leu passam pela rede. Para esses servidores, aparece um aviso abaixo do endereço. Em servidores que não usam https, tudo, inclusive a chave, trafega sem criptografia, e esse aviso também aparece. A confirmação de “{{ui:agent.permission.title}}” também mostra para onde o conteúdo lido será enviado. A resposta do servidor é tratada como texto comum, e os pedidos só são executados se passarem pela mesma confirmação dos de Claude e Codex.

### O que ele faz por você

A partir do seu texto, o agente decide o seguinte e preenche as configurações. O que foi preenchido aparece como uma lista na resposta.

| O quê | Exemplo |
|---|---|
| Escolher um modelo | Escolhe um adequado entre os modelos instalados |
| Adicionar um LoRA | Adiciona um LoRA que combine com o estilo de arte |
| Prompt | Escreve o prompt e o prompt negativo |
| Alterar configurações | Tamanho, passos, CFG, agendador, seed |
| Fluxo de trabalho | Monta um grafo ou corrige o grafo aberto (também monta grafos de música, vídeo e voz com os nós do próprio ComfyUI; quem executa é você, pressionando **{{ui:params.invoke.invoke}}**) |
| Texto | Corrige o texto e os balões abertos em **{{ui:media.tab.text}}** |
| Vídeo, música, voz | Altera as configurações de cada uma dessas telas |
| Quadrinho | Em **{{ui:app.tabs.comic}}**, muda a divisão em quadros, adiciona e divide quadros e muda o prompt e a pose de cada quadro e os balões (veja “Ajuda com o quadrinho” abaixo) |
| Pose | Coloca em **{{ui:app.tabs.canvas}}** um boneco de palitos com a pose pedida em palavras (veja [Desenhar sobre a tela](05-canvas.md#criar-uma-pose-na-tela)) |
| Geração | Só quando você pede (e na geração de teste, abaixo), coloca na fila de geração as configurações atuais ou os quadros do quadrinho |
| Recomendação de extensões | Indica extensões adequadas ao que você quer fazer, que podem ser instaladas por um botão |
| Como usar o app | Responde onde pressionar, usando os nomes das telas |
| Explicar extensões | Diz o que uma extensão faz e como usá-la (veja “Perguntar sobre o app e as extensões” abaixo) |

O agente observa qual tela você tem aberta. Por exemplo, se você abrir **{{ui:media.tab.text}}** e disser “deixe o texto na vertical”, esse texto muda.

O agente aplica à tela o que muda, à medida que trabalha. Durante o trabalho, o que mudou aparece em ordem sob “{{ui:agent.thinking}}”. Imagens e vídeos só são criados quando você pede (eles entram na fila de geração). Se você não pedir, ele apenas altera as configurações; veja o resultado e, se estiver bom, pressione **{{ui:agent.generate}}** na resposta para começar a criar. Com um quadrinho aberto, ao lado dele aparece também o botão “Gerar todas as páginas”. Ao pressioná-lo, os quadros que têm prompt, de todas as páginas, entram juntos na fila (se você não pressionar, nada entra). O agente não apaga imagens nem instala modelos ou extensões (para as extensões, apenas faz recomendações). Negrito, listas e tabelas na resposta são exibidos nessa forma, e não como símbolos.

### Perguntas de volta e geração de teste

Quando o pedido deixa em aberto algo que muda muito o resultado, como qual personagem mudar, se é o fundo ou o personagem, ou se é o penteado ou a cor do cabelo, o agente pergunta antes de mudar. Quando você responde, ele muda conforme a resposta. Se, depois de uma correção, você disser “o anterior estava melhor” ou “essa menina podia ficar como estava”, o agente confere neste chat o estado anterior à mudança e restaura essa parte (se você fechar o app, o estado anterior à mudança deixa de ser conhecido).

Quando você pede uma aparência difícil de transmitir só com palavras, como “com um clima de verão”, o agente pode gerar uma única imagem de teste e, olhando-a, perguntar “É esse o clima?”. A imagem de teste aparece abaixo da resposta. Para ver a imagem, aparece a mesma confirmação de “Permissão para ler imagens e prompts”, abaixo. Se não quiser que ele faça gerações de teste, desligue **{{ui:settings.assistantTrial.label}}** nas configurações (veja “Configurações”, abaixo).

### Ajuda com o quadrinho

Se você pedir com **{{ui:app.tabs.comic}}** aberto, o agente lê a página aberta (a forma dos quadros, o prompt de cada quadro, as poses e os balões) e a reescreve diretamente. Por exemplo, você pode pedir assim.

- Peça “Faça 5 quadros com um momento de destaque. O primeiro grande, cortado na diagonal” e ele cria a divisão em quadros. Se você não definir a forma, ele cria como num quadrinho de verdade: com alturas de faixa e larguras de quadro irregulares, um quadro grande para o momento de destaque e, conforme a cena, cortes diagonais e quadros que vão até a borda do papel. O espaço entre os quadros é maior na vertical que na horizontal. A divisão muda a cada página. Ele pode usar um modelo de página padrão ou decidir sozinho a forma dos quadros.
- Peça “Escreva o prompt de cada quadro com esta história” e ele escreve, para cada quadro, um prompt com um enquadramento que combina com o andamento da história (close, plano geral, contra-plongée etc.).
- Peça “Escreva a descrição de cena de cada quadro com esta história” e ele escreve, para cada quadro, a cena em texto (o lugar, a hora e quem faz o quê).
- Peça “Coloque falas em cada quadro” e ele posiciona balões e escreve as falas neles. Se uma fala não cabe no balão, o texto é diminuído para caber.
- Peça “Coloque a menina do quadro 2 numa pose de corrida” e ele dá uma pose a esse quadro. Ele também escreve os personagens (a aparência de cada um), para que o rosto e a roupa fiquem iguais em todos os quadros. Os balões são colocados ao lado de quem fala, com um tamanho que não se sobrepõe aos outros.
- Peça “Crie um quadrinho novo e monte a divisão em quadros de 30 páginas” e ele cria o quadrinho, acrescenta as páginas e leva a divisão em quadros, os prompts e as falas até o fim. Mesmo que você peça de outra tela, ele muda para a tela do quadrinho para trabalhar. Mesmo um trabalho longo continua até o fim dentro de um único pedido. Para interromper no meio, pressione **{{ui:agent.stop}}**.

Os desenhos só são feitos quando você pede (eles entram na fila de desenho). Se você não pedir, depois que os prompts estiverem preenchidos, pressione **{{ui:comic.panel.draw}}**, **{{ui:comic.page.drawAll}}** ou **{{ui:comic.comic.drawAll}}**. Se você pedir “desenhe todas as páginas”, todos os quadros de todas as páginas entram juntos na fila. O botão “Gerar todas as páginas”, abaixo da resposta, faz o mesmo. Ao pressionar **{{ui:agent.undo}}**, as páginas do quadrinho que mudaram nessa resposta voltam de uma vez ao que eram.

### Anexar imagens

Você pode anexar imagens à mensagem e pedir, por exemplo, “pense num prompt a partir desta imagem”.

- Com o botão de clipe à esquerda do campo de entrada (**{{ui:agent.attach.add}}**), escolha uma imagem do computador.
- Também é possível anexar arrastando e soltando no campo de entrada uma imagem da galeria ou um arquivo de imagem do computador.
- Também é possível anexar colando no campo de entrada uma imagem copiada.

As imagens anexadas aparecem acima do campo de entrada e podem ser retiradas com o × no canto superior direito. É possível anexar até 4 imagens por mensagem. Se você enviar só a imagem, sem escrever texto, é como se tivesse pedido “{{ui:agent.attach.defaultAsk}}”. As imagens anexadas do computador também entram na galeria. As imagens são enviadas junto com essa mensagem à IA que você escolheu (Claude, Codex ou o servidor conectado). Elas não acompanham as mensagens seguintes, por isso, ao pedir de novo algo sobre a mesma imagem, anexe-a outra vez. Um modelo que não consegue ler imagens não responde bem.

### Permissão para ler imagens e prompts

As informações das imagens da galeria (prompt, modelo etc.) e o campo de prompt da aba de geração podem conter coisas que você não quer mostrar. Por isso, quando o agente tenta lê-los, no início aparece no chat uma confirmação de “{{ui:agent.permission.title}}”, que também mostra o que ele pretende ler.

- **{{ui:agent.permission.once}}**: permite a leitura só desta vez. Na próxima tentativa, a confirmação aparece de novo.
- **{{ui:agent.permission.always}}**: permite a leitura daqui em diante, sem confirmar (a configuração muda para **{{ui:settings.assistantRead.always}}**).
- **{{ui:agent.permission.deny}}**: não permite a leitura. O agente continua o trabalho sem ler ou diz o que precisa.

Com a tela do quadrinho aberta, o agente pode olhar o desenho de páginas que ele terminou de desenhar (a seu pedido, para conferir a aparência dos personagens e os balões). Nesse caso, aparece a mesma confirmação, e o desenho da página só é enviado se você permitir. Nas outras telas, ele não olha.

Se a confirmação aparece ou não pode ser mudado em **{{ui:settings.assistantRead.label}}**, em **{{ui:settings.section.assistant}}**, na aba **{{ui:settings.tab.generation}}** das configurações (veja “Configurações”, abaixo). O conteúdo das telas que o agente corrige para você, como quadrinho, texto, fluxo de trabalho, vídeo, música e voz e a pose na tela, é lido sem confirmação.

### Pesquisas na Wikipédia

Ao criar uma história (época, roupas, lugares, profissões, termos etc.), o agente pesquisa fatos na Wikipédia em japonês ou inglês e pode ler o início de até 3 artigos. Sai do computador apenas uma palavra de busca curta, e o único destino é a Wikipédia. Quem envia é o próprio app; a tela nunca se conecta diretamente. Como a palavra de busca vai para a internet, antes de pesquisar aparece no chat uma confirmação de “{{ui:agent.permission.webTitle}}”, que também mostra a palavra de busca que será enviada.

- **{{ui:agent.permission.once}}**: permite a pesquisa só desta vez. Na próxima tentativa, ele pergunta de novo.
- **{{ui:agent.permission.always}}**: permite pesquisar daqui em diante, sem confirmar (a configuração muda para **{{ui:settings.assistantRead.always}}**).
- **{{ui:agent.permission.deny}}**: não permite a pesquisa. O agente segue com o que já sabe e, durante esse pedido, não pede de novo.

Esta é outra configuração: **{{ui:settings.assistantWeb.label}}**, em **{{ui:settings.section.assistant}}**, na aba **{{ui:settings.tab.generation}}** das configurações. Permitir a leitura de imagens não permite as pesquisas (e vice-versa). Os textos da Wikipédia têm a licença CC BY-SA 4.0, por isso, ao usar um fato, o agente informa o nome do artigo original. As respostas podem estar erradas; confira o que for importante.

### Escolher o modelo e a profundidade de raciocínio

Pressionando o pequeno botão em forma de cérebro, à direita do nome do chat, é possível escolher o **{{ui:agent.model.label}}** e o **{{ui:agent.effort.label}}** que o agente usa. O que você escolher vale a partir da próxima mensagem enviada. Claude e Codex guardam suas escolhas separadamente.

- Os modelos do Claude podem ser escolhidos entre Fable 5.1, Opus 5.5, Sonnet 5.5 e Haiku 5.5. É usada a versão com o nome indicado. A profundidade de raciocínio tem 5 níveis, de **{{ui:agent.effort.low}}** a **{{ui:agent.effort.max}}**.
- Os modelos do Codex podem ser escolhidos na lista de modelos que o Codex informa estarem disponíveis na sua conta (a lista é lida do que o Codex salvou no computador). Para a profundidade de raciocínio, só aparecem as que o modelo escolhido aceita (alguns modelos aceitam até **{{ui:agent.effort.ultra}}**).
- Em um servidor, aparecem os modelos que o servidor lista. Também é possível digitar um nome. Não há profundidade de raciocínio. Como o modelo faz parte das configurações do servidor, ao escolher outro modelo, ele é salvo.

Enquanto você não tiver escolhido, o Claude usa o Sonnet 5.5 e o Codex usa o primeiro modelo da lista, e o botão também mostra esse nome. O modelo cujo nome aparece no botão é sempre o que responde (só quando o Codex não salvou a lista aparece **{{ui:agent.model.default}}**, e o Codex decide o modelo). Sempre há uma profundidade de raciocínio escolhida. No início, é a profundidade padrão de cada modelo; ao trocar de modelo, se o novo não aceitar a profundidade atual, volta à profundidade padrão desse modelo.

### Mudar a altura do campo de entrada

Arrastar para cima a alça horizontal na borda superior do campo de entrada o deixa mais alto, e arrastar para baixo o deixa mais baixo. Também é possível mudar selecionando a alça e pressionando as setas para cima e para baixo. A altura é a mesma na próxima vez que você abrir.

### Chamar modelos de texto

Ao digitar “/” no início do campo de entrada, abre-se uma lista de modelos de texto com formas de pedir usadas com frequência. Se você digitar letras depois de “/”, a lista é filtrada apenas para os que contêm essas letras no nome, no comando ou no texto (por exemplo, “/quadrinho” ou “/comic”).

Escolha com as setas para cima e para baixo e confirme com Enter ou Tab. Pressionar uma linha da lista também confirma. O texto do modelo escolhido entra no campo de entrada; continue escrevendo e depois envie (só escolher não envia). A tecla Esc fecha a lista.

### Perguntar sobre o app e as extensões

Além de pedir configurações, também é possível fazer perguntas. Por exemplo, se você perguntar “como removo o fundo?” ou “onde pressiono para adicionar um modelo?”, o agente responde onde pressionar, usando os nomes que aparecem na tela. A resposta vem no idioma que você está usando.

Também é possível perguntar sobre extensões. O agente explica em palavras simples o que a extensão faz, quando usá-la e como usá-la. Há 3 maneiras de perguntar.

- Pressione um cartão na lista de **{{ui:app.nav.extensions}}** para abrir os detalhes e pressione **{{ui:agent.ask.button}}**. A pergunta sobre essa extensão é enviada em um novo chat.
- Digite uma palavra no campo de busca no alto de **{{ui:app.nav.extensions}}** e pressione **{{ui:agent.ask.resultsButton}}**, que aparece. O agente responde qual é a diferença entre as extensões encontradas (até as 8 primeiras) e por qual vale a pena começar.
- Escreva no chat o nome da extensão (em letras latinas) e pergunte. O agente procura, entre as extensões publicadas, as que combinam com o nome ou a descrição e responde (se a lista ainda não foi carregada, ele a carrega nesse momento).

Para uma extensão instalada, ele também diz o nome dos nós que ela acrescenta e a que conectá-los. As que ainda não estão instaladas vêm com um cartão na resposta, e é possível instalá-las na hora com **{{ui:workflows.packs.install}}**.

> A explicação das extensões se baseia na descrição publicada e nas informações dos nós. Ele deve responder “não sei” sobre o que não conhece, mas também pode errar. Antes de instalar, confira também a página do distribuidor.

### Desfazer

As respostas que mudaram configurações ou edições trazem o botão **{{ui:agent.undo}}**. Ao pressioná-lo, as configurações e edições que mudaram por causa desse pedido voltam de uma vez ao que eram antes. O que já entrou na fila de geração não é cancelado (cancele na fila).

No entanto, depois de reabrir o app, as mudanças anteriores não podem mais ser desfeitas (o botão deixa de poder ser pressionado).

### Repetir até ficar parecido

Se você pedir “deixe parecido com esta imagem” ou “vá se aproximando gerando algumas imagens”, o agente repete as gerações de teste. A cada imagem gerada, ele compara com a imagem-alvo, corrige só o que é diferente e gera a próxima.

- Mesmo quando uma resposta termina, o app pede automaticamente a imagem seguinte. O agente só para quando considera que chegou perto do alvo ou quando 2 imagens seguidas não se aproximaram.
- O máximo é de 30 imagens.
- No chat aparece “Aproximando: N / N imagem”.
- Para parar, pressione **{{ui:agent.stop}}** ou envie uma nova mensagem. A mensagem enviada vai no lugar da próxima imagem.
- Se {{ui:settings.assistantTrial.label}} estiver desligado, essa repetição não começa.

### Verificar o tamanho da conversa

Dentro do mesmo chat, o agente responde lembrando-se do que foi dito antes. As imagens anexadas e as que o agente mostrou também têm seus nomes mantidos e, quando necessário, ele as revê.

- Acima do campo de entrada, o tamanho da conversa que acompanhará o próximo envio aparece como “cerca de N / N tokens”. O número é uma estimativa.
- Enquanto a chave “{{ui:agent.context.limit}}”, na mesma linha, estiver ligada (ela vem ligada desde o início), quando a conversa está prestes a passar de 30000 tokens, as mensagens antigas são enviadas como um resumo curto de uma linha cada. As mensagens novas são enviadas como estão, e o número de mensagens resumidas aparece na linha. O resumo usa só cerca dos primeiros 140 caracteres, então as formulações detalhadas não são mantidas. Se, ao cortar, o assistente esquecer a conversa anterior, desligue a chave para enviar a conversa inteira (se for muito longa, pode passar do limite do modelo usado).
- Enquanto essa chave estiver ligada, o prompt que o assistente escreve no campo de prompt de {{ui:app.tabs.generate}} também é limitado a 77 tokens por campo (o número que aparece abaixo do campo). O app não aceita um prompt mais longo, e o assistente o encurta e escreve de novo. Para que ele escreva prompts longos, desligue a chave.
- Ao mudar de assunto, comece um novo chat com {{ui:agent.session.new}} para não ser arrastado pela conversa antiga.

### Histórico de chats

As conversas com o agente ficam guardadas como “chats”. Ao pressionar o nome do chat, no alto da janela, abre-se a lista **{{ui:agent.session.history}}**.

- Ao escolher um da lista, você continua a conversa desse chat.
- Com **{{ui:agent.session.rename}}** é possível dar um nome.
- Com **{{ui:agent.session.delete}}** é possível apagar.
- Com **{{ui:agent.session.new}}**, ao lado, é possível começar um novo chat.

O texto do chat pode ser selecionado arrastando e copiado. Ao pressionar o botão no canto inferior direito de cada mensagem (**{{ui:agent.copy}}**), o texto inteiro dessa mensagem é copiado.

> As mensagens que você escreve e envia enquanto espera uma resposta entram em uma fila e são enviadas automaticamente quando a resposta atual termina. As mensagens na fila aparecem esmaecidas e podem ser retiradas com o ×. Se a resposta falhar, as mensagens da fila voltam ao campo de entrada. Para interromper, cancele com o botão **{{ui:agent.stop}}**. O que já tiver mudado até o cancelamento permanece, e **{{ui:agent.undo}}** o desfaz de uma vez.

A largura do painel direito pode ser mudada arrastando a divisa do painel. Uma janela aberta sobre a tela pode ter o tamanho mudado arrastando qualquer um dos quatro lados e quatro cantos, e no canto inferior direito aparece uma marca para isso. O tamanho é lembrado. Quando a resposta traz o fluxo da decisão, ele aparece em uma linha acima da resposta. Ao pressioná-la, tudo se abre (**{{ui:agent.thoughts.label}}**). É um resumo curto de como a IA interpretou o pedido e por que fez o que fez, e não o pensamento interno da IA em si.

## Configurações

![A tela de configurações. As abas ficam à esquerda e os itens da aba escolhida, à direita](shot:settings)

Ao escolher **{{ui:app.nav.settings}}** no **{{ui:app.nav.settingsMenu}}**, no canto inferior esquerdo, abre-se a tela de configurações. Ao escolher uma aba à esquerda, os itens dela aparecem à direita. O que você muda é usado na hora e permanece mesmo depois de fechar o app. Ao abrir de novo, abre-se a última aba que você estava vendo.

> Esta imagem é uma tela de exemplo, executada no navegador. Ela não mostra **{{ui:settings.uiZoom.label}}**, que só existe na versão para desktop.

### {{ui:settings.tab.general}}

| Item | Conteúdo |
|---|---|
| {{ui:settings.language.label}} | Escolha entre {{ui:settings.language.ja}}, {{ui:settings.language.en}}, {{ui:settings.language.zhcn}}, {{ui:settings.language.zhtw}}, {{ui:settings.language.ko}}, {{ui:settings.language.ru}}, {{ui:settings.language.es}}, {{ui:settings.language.ptbr}}, {{ui:settings.language.fr}} e {{ui:settings.language.de}}. O idioma da tela muda na hora |
| {{ui:settings.theme.label}} | **{{ui:settings.theme.dark}}** (padrão) ou **{{ui:settings.theme.light}}** |
| {{ui:settings.uiZoom.label}} | Somente na versão para desktop. É o tamanho da tela inteira. Pode ser de 50% a 300%. Também pode ser mudado com `Ctrl` e `+` / `-` |
| {{ui:settings.startTab.label}} | A aba exibida primeiro ao abrir o app. No início é **{{ui:app.tabs.generate}}**. Se você escolher **{{ui:settings.startTab.last}}**, abre-se a aba em que o app estava quando foi fechado da última vez |
| {{ui:settings.waitForEngine.label}} | Ligada no início: a tela de abertura espera até o carregamento do mecanismo de imagens terminar. Se desligada, o app abre mesmo com o carregamento em andamento. O estado do mecanismo aparece em um banner |
| {{ui:settings.toastSeconds.label}} | O número de segundos até uma notificação sumir sozinha. Pode ser de 2 a 15 segundos (no início, 3,5 segundos) |

### {{ui:settings.tab.generation}}

- **{{ui:settings.antialiasProgressImages}}**: exibe com suavidade a imagem em andamento da geração, na caixa “{{ui:gallery.generating.title}}” da galeria. Desligada, ela é vista com pontos grosseiros.
- **{{ui:settings.draftCount.label}}**: o valor inicial do número de imagens ao abrir a tela de rascunhos (de 1 a 24 imagens; no início, 4). Também é possível mudá-lo na própria tela, a cada vez.
- **{{ui:settings.draftPosition.label}}**: o valor inicial da posição ao abrir a tela de rascunhos (de 25 a 60 %; no início, 35 %).
- **{{ui:settings.lowMemory.label}}**: para computadores com pouca memória de GPU. Quando ligada, os modelos não ficam parados na memória da GPU, então é possível criar com menos memória, mas a criação fica mais lenta. Ao alternar, o mecanismo é reiniciado. Se houver itens sendo criados, ela passa a valer na próxima vez que o mecanismo for iniciado. Não pode ser usada quando o app está conectado a um mecanismo iniciado em outro lugar.
- **{{ui:settings.assistantRead.label}}** (**{{ui:settings.section.assistant}}**): se o agente pode ler as informações das imagens da galeria e o prompt da aba de geração. Escolha entre **{{ui:settings.assistantRead.ask}}** (padrão), **{{ui:settings.assistantRead.always}}** e **{{ui:settings.assistantRead.never}}**.
- **{{ui:settings.assistantWeb.label}}** (**{{ui:settings.section.assistant}}**): se o agente pode pesquisar fatos na Wikipédia. A escolha é igual, e é uma configuração separada da leitura de imagens.
- **{{ui:settings.assistantTrial.label}}** (**{{ui:settings.section.assistant}}**): se, quando a intenção do pedido não está clara, o agente pode gerar por conta própria uma única imagem de teste. No início, está ligada.

### {{ui:settings.tab.gallery}}

- **{{ui:gallery.settings.thumbnailSize}}**, **{{ui:gallery.settings.sort}}**, **{{ui:gallery.settings.starredFirst}}**, **{{ui:gallery.settings.groupByDate}}**, **{{ui:gallery.settings.alwaysShowSize}}**, **{{ui:gallery.settings.showArchived}}**, **{{ui:gallery.settings.autoSwitch}}**, **{{ui:gallery.settings.autoAssign}}**: são os mesmos itens de **{{ui:gallery.settings.title}}**, que se abre com o botão de engrenagem da galeria. Mudar em qualquer um dos dois tem o mesmo efeito.
- **{{ui:settings.confirmOnDelete}}**: mostra uma confirmação antes de apagar uma imagem. Quando você escolhe “{{ui:common.dontAskAgain}}” na tela de confirmação, esta opção também é desligada.
- **{{ui:settings.clearIntermediates}}**: apaga as imagens que não aparecem na galeria, como os resultados intermediários da tela. O número de itens a apagar aparece no botão.

### {{ui:settings.tab.edit}}

- **{{ui:settings.undoLimit.label}}**: o número de operações que podem ser desfeitas na edição da tela, do quadrinho, do texto e do fluxo de trabalho. Pode ser de 10 a 200 (no início, 60). Aumentar usa mais memória.

### {{ui:settings.tab.comicText}}

- **{{ui:settings.comicFont.label}}**: a fonte usada no texto dos balões em que nenhuma fonte foi escolhida. Dá para escolher entre as fontes do app e as instaladas neste computador. **{{ui:common.font.standard}}** é a fonte padrão do app.
- **{{ui:settings.textFont.label}}**: a fonte usada nos novos textos acrescentados na tela de texto. A escolha é igual à da fonte dos balões.
- **{{ui:settings.section.comicPage}}**: define **{{ui:comic.page.size}}**, **{{ui:comic.page.direction}}**, **{{ui:settings.comicPage.panels}}** (de 1 a 6), **{{ui:comic.page.frameWidth}}** e **{{ui:comic.page.margin}}** dos quadrinhos novos e das páginas acrescentadas depois. As páginas existentes não mudam.

### {{ui:settings.tab.engine}}

É onde o app guarda os dados e como o mecanismo de imagens (ComfyUI) é iniciado. O que você muda aqui passa a valer na próxima vez que o app for iniciado (isso aparece no alto).

| Item | Conteúdo |
|---|---|
| {{ui:settings.engine.dataDir.label}} | A pasta onde ficam as imagens criadas, os modelos, o mecanismo de imagens etc. No início, é `novira-data`, dentro da pasta do usuário. Ao pressionar **{{ui:settings.engine.dataDir.change}}**, você primeiro escolhe o que fazer com os dados atuais. **{{ui:settings.engine.dataDir.dialog.move}}** move os dados atuais para a pasta escolhida. Mesmo que a pasta tenha outras coisas, é possível mover se não houver nada com o mesmo nome (a operação é feita no início da próxima inicialização, então pode demorar se houver muitos dados). **{{ui:settings.engine.dataDir.dialog.use}}** abre a pasta escolhida sem mover os dados (se houver dados, eles são usados; se estiver vazia, começa-se do zero). Depois, abre-se uma janela para escolher a pasta, e o local escolhido passa a ser usado a partir da próxima inicialização. **{{ui:settings.engine.dataDir.cancel}}** desiste. Se a mudança não puder ser feita, o motivo é exibido e o app inicia com a pasta atual. Quando a pasta é definida pela variável de ambiente `NOVIRA_DATA_DIR`, não é possível mudá-la aqui |
| {{ui:settings.engine.comfyui.label}} | O ComfyUI em uso. Normalmente está em `comfyui`, dentro da pasta de dados, e esse local é exibido. Quando outro ComfyUI foi indicado no arquivo de configuração, aparece o local dele. Com **{{ui:settings.engine.comfyui.change}}** é possível mudar o local onde o app instala o ComfyUI. Se a pasta escolhida estiver vazia, o ComfyUI é instalado do zero na próxima inicialização (é um download grande). Se for uma pasta onde ele já está instalado, ela é usada como está. Os arquivos do local antigo não são apagados automaticamente. Para voltar para dentro da pasta de dados, escolha o `comfyui` que há nela |
| {{ui:settings.engine.package.label}} | **{{ui:settings.engine.package.nvidia}}** ou **{{ui:settings.engine.package.amd}}**. É usado na próxima vez que o ComfyUI for baixado (primeira instalação ou troca de versão). Se, com o ComfyUI instalado, você escolher outro tipo, aparece uma confirmação. Ao confirmar, na próxima vez que o novira for iniciado, o ComfyUI será reinstalado com o tipo escolhido (o download é grande e demora) |
| {{ui:settings.engine.timeout.label}} | O número de segundos que se espera, depois de iniciar o ComfyUI, até que ele responda. Pode ser de 30 a 1800 segundos. Aumente em computadores lentos |
| {{ui:settings.engine.modelRoots.label}} | Pastas onde procurar modelos, além da pasta models da pasta de dados. Ao pressionar **{{ui:settings.engine.modelRoots.add}}**, abre-se uma janela para escolher a pasta. O app reconhece a estrutura das pastas do ComfyUI e do Stability Matrix. Os modelos adicionais de vídeo, música, voz e apagar também são encontrados por aqui (só são lidos; ao instalar algo novo, sempre vai para a pasta de dados). É possível adicionar até 16. Não é possível adicionar uma pasta dentro da pasta de dados nem uma que já esteja na lista. Retire com o botão ×. Quando o app está aberto no navegador, não é possível adicionar, só retirar |

### {{ui:settings.tab.accounts}}

São os campos para quando o site de distribuição de modelos exige login. O que você digita é salvo criptografado neste computador e não é exibido na tela.

| Item | Conteúdo |
|---|---|
| {{ui:settings.civitaiKey.label}} | Usada para baixar modelos que exigem login |
| {{ui:settings.hfToken.label}} | Usado para baixar modelos que exigem solicitação de acesso |

Cole o valor e pressione **{{ui:settings.civitaiKey.save}}**. Depois, também é possível usar **{{ui:settings.civitaiKey.change}}** e **{{ui:settings.civitaiKey.remove}}**.

### {{ui:settings.tab.data}}

#### {{ui:share.backup.section}}

![O campo de backup na tela de configurações. O botão para criar um backup e o botão para restaurar a partir de um backup](shot:settings-backup)

As imagens criadas e o que você configurou e registrou no app podem ser reunidos e salvos em um único arquivo zip. Use para se mudar para outro computador ou como precaução.

- **{{ui:share.backup.createLabel}}**: abre uma janela para escolher onde salvar. O nome do arquivo já vem como “novira-backup-data-hora.zip”. Com muitas imagens, demora, e o andamento aparece neste campo.
- **{{ui:share.backup.restoreLabel}}**: escolha o arquivo zip do backup. Depois de conferir o conteúdo, aparece uma janela de confirmação.

O que entra e o que não entra no backup é o seguinte.

| O que entra | O que não entra |
|---|---|
| Imagens, vídeos e áudios da galeria e as miniaturas deles | Modelos |
| Boards, fluxos de trabalho, quadrinhos e o registro da fila | O mecanismo de imagens (ComfyUI) e as extensões |
| Personagens, predefinições, listas de prompts, rascunhos, chats com a IA e configurações da tela | Chaves de API e tokens, e configurações próprias de cada computador, como o local do ComfyUI |

![A janela de confirmação da restauração. Mostra a data e hora em que o backup foi criado, o número de itens e o aviso de substituição](shot:restore-confirm)

A janela de confirmação mostra a data e a hora em que o backup foi criado e o número de imagens, boards e fluxos de trabalho que ele contém. Ao pressionar **{{ui:share.backup.confirm}}**, o app se fecha, é iniciado de novo e os dados atuais são substituídos pelo conteúdo do backup. Se algo der errado, os dados originais são restaurados e você é avisado.

> Os dados substituídos não podem ser recuperados. Se for preciso, faça um backup do estado atual antes de restaurar. As chaves de API e os tokens são criptografados para este computador; por isso, depois de restaurar, digite-os de novo em **{{ui:settings.tab.accounts}}**. Com o app aberto no navegador, não é possível criar nem restaurar backups. Use o app de desktop.

#### {{ui:settings.section.unfinished}}

Quando um download é interrompido no meio, um arquivo incompleto permanece na pasta de dados. Neste campo, é possível conferir o nome, a pasta e o tamanho dos arquivos que restaram. Com **{{ui:settings.unfinished.delete}}** é possível apagar um por um e, com **{{ui:settings.unfinished.deleteAll}}**, apagar todos (ao pressionar, primeiro é pedida uma confirmação). Os arquivos que restaram são aproveitados, a partir de onde pararam, na próxima vez que você iniciar o mesmo download. Se forem apagados, esse download recomeça do zero. Arquivos em uso não são apagados e permanecem.

#### {{ui:settings.section.reset}}

Escolha em **{{ui:settings.reset.scope.label}}** o que será restaurado, pressione **{{ui:settings.resetWebUi}}** e, em seguida, pressione **{{ui:settings.resetConfirm}}** mais uma vez para confirmar. Imagens, modelos, quadrinhos e telas não são apagados.

O estado da tela, como configurações, predefinições, rascunhos e históricos, é salvo na pasta de dados. Enquanto você usar a mesma pasta de dados, o conteúdo é o mesmo ao abrir no app de desktop e no navegador. Como os dois não podem ser abertos ao mesmo tempo, o conteúdo passa de um para o outro quando você os usa em sequência. A restauração também vale para os dois.

| Escopo | O que volta ao valor inicial |
|---|---|
| {{ui:settings.reset.scope.settings}} | Os itens da tela de configurações. Voltam na hora |
| {{ui:settings.reset.scope.generation}} | O prompt, o modelo e os parâmetros da tela de geração |
| {{ui:settings.reset.scope.gallery}} | A exibição da galeria (tamanho das miniaturas, ordem etc.) |
| {{ui:settings.reset.scope.assistant}} | As conversas com o agente. Todas são apagadas |
| {{ui:settings.reset.scope.all}} | Todas as configurações e estados de tela salvos no navegador. Predefinições, personagens, listas de prompts e conversas com o agente também são apagados |

Exceto “{{ui:settings.reset.scope.settings}}”, as mudanças só valem depois de pressionar **{{ui:settings.reload}}**, que aparece após a confirmação, para recarregar.

### {{ui:settings.tab.developer}}

- **{{ui:settings.showDevLog}}**: mostra na navegação à esquerda o botão {{ui:app.devlog.short}} (veja “Registro do desenvolvedor”, abaixo).

## Atalhos de teclado

![A lista de atalhos de teclado. Para cada categoria, como app e tela, são listadas as ações e as teclas](shot:hotkeys)

Escolha **{{ui:app.nav.hotkeys}}** no **{{ui:app.nav.settingsMenu}}**, no canto inferior esquerdo, ou pressione `Shift+?` para abrir a lista. No campo de busca no alto, é possível procurar pelo nome da ação ou pela tecla.

Aqui estão reunidos os mais usados. Para ver todos, confira a lista na tela.

### O app todo

| Tecla | Ação |
|---|---|
| `Ctrl+Enter` | Gerar (adicionar à fila) |
| `Ctrl+Shift+Enter` | Adicionar ao início da fila e gerar |
| `Shift+X` | Cancelar o item em processamento |
| `Ctrl+Shift+X` | Limpar toda a fila |
| `Alt+A` | Ir para o campo de prompt |
| `T` | Abrir/fechar o painel esquerdo |
| `G` | Abrir/fechar o painel direito (galeria e agente) |
| `F` | Abrir/fechar os painéis esquerdo e direito juntos |
| `1` a `9` | Ir para a aba de mesmo número |
| `Shift+?` | Abrir a lista de atalhos |
| `Ctrl` + `+` / `-` | Ampliar/reduzir a tela inteira |

### Tela

| Tecla | Ação |
|---|---|
| `B` | {{ui:settings.hotkeys.canvas.brush}} |
| `E` | {{ui:settings.hotkeys.canvas.eraser}} |
| `U` | {{ui:settings.hotkeys.canvas.rect}} |
| `V` | {{ui:settings.hotkeys.canvas.move}} |
| `C` | {{ui:settings.hotkeys.canvas.bbox}} |
| `H` | Mover a exibição |
| `I` | {{ui:settings.hotkeys.canvas.colorPicker}} |
| `[` / `]` | Diminuir/aumentar o pincel |
| `Ctrl+Z` | {{ui:settings.hotkeys.canvas.undo}} |
| `Ctrl+Shift+Z`, `Ctrl+Y` | {{ui:settings.hotkeys.canvas.redo}} |
| `Q` | Alternar com a ferramenta usada logo antes |
| `Enter`, `Esc` | {{ui:settings.hotkeys.canvas.acceptStaged}}, {{ui:settings.hotkeys.canvas.discardStaged}} |

### Galeria e visualizador

| Tecla | Ação |
|---|---|
| Setas | {{ui:settings.hotkeys.gallery.navigate}} |
| `Ctrl+A` | {{ui:settings.hotkeys.gallery.selectAll}} |
| `Esc` | {{ui:settings.hotkeys.gallery.clearSelection}} |
| `.` | {{ui:settings.hotkeys.gallery.star}} |
| `I` | {{ui:settings.hotkeys.viewer.toggleMetadata}} |
| `R` | {{ui:settings.hotkeys.viewer.remix}} (carrega tudo, menos a seed) |
| `P`, `S`, `A` | Carregar o prompt, a seed ou tudo |
| `W` | {{ui:settings.hotkeys.viewer.loadWorkflow}} |
| `Shift+U` | {{ui:settings.hotkeys.viewer.upscale}} |
| `C` | {{ui:settings.hotkeys.viewer.compare}} |
| `Delete` | {{ui:settings.hotkeys.viewer.delete}} |
| `Ctrl+0`, `Ctrl+1` | {{ui:settings.hotkeys.viewer.zoomFit}}, {{ui:settings.hotkeys.viewer.zoomActual}} |

### Fluxos de trabalho

| Tecla | Ação |
|---|---|
| `Shift+A`, `Space` | {{ui:settings.hotkeys.workflows.addNode}} |
| `Delete` | Apagar os nós selecionados e as conexões |
| `Ctrl+C`, `Ctrl+V` | {{ui:settings.hotkeys.workflows.copy}}, {{ui:settings.hotkeys.workflows.paste}} |
| `Ctrl+S` | {{ui:settings.hotkeys.workflows.save}} |
| `Ctrl+Z`, `Ctrl+Shift+Z` | {{ui:settings.hotkeys.workflows.undo}}, {{ui:settings.hotkeys.workflows.redo}} |

Enquanto você digita texto, as teclas de uma só letra, como `T` e `G`, não funcionam.

## Sobre o app

![A tela de informações sobre o app. O logotipo, a versão, a licença e a lista do software de código aberto usado](shot:about)

Ao escolher **{{ui:app.nav.about}}** no **{{ui:app.nav.settingsMenu}}**, no canto inferior esquerdo, aparecem no alto o nome do app, a versão, a licença e o aviso de direitos autorais. Abaixo, há duas abas.

- **{{ui:settings.about.license.title}}**: o texto completo da licença do novira (Apache License 2.0). O mesmo documento (`LICENSE`) também está na pasta onde o app foi instalado.
- **{{ui:settings.about.oss.title}}**: a lista do software de código aberto usado. Cada linha mostra o nome e a versão. Ao pressionar **{{ui:settings.about.oss.showLicense}}**, o texto completo da licença aparece abaixo (pressione de novo para fechar). Ao pressionar **{{ui:settings.about.oss.homepage}}**, a página desse software abre no navegador. Para o mecanismo de geração e as extensões, que não vêm incluídos no app, confira o texto completo da licença na página inicial deles.

Com os botões acima da lista, é possível filtrar por **{{ui:settings.about.oss.short.frontend}}**, **{{ui:settings.about.oss.short.backend}}**, **{{ui:settings.about.oss.short.engine}}** e **{{ui:settings.about.oss.short.packs}}** (as extensões instaladas no momento). No campo de busca, é possível procurar pelo nome. O texto completo das licenças do software incluído também está reunido em `THIRD_PARTY_NOTICES.txt`, na pasta onde o app foi instalado.

As extensões (nós personalizados do ComfyUI) e os modelos seguem, ao serem instalados, a licença de cada distribuidor.

## Registro do desenvolvedor

É um registro para procurar a causa quando algo não vai bem. No dia a dia, não é preciso usá-lo.

Ao ligar **{{ui:settings.showDevLog}}** em **{{ui:settings.title}}**, aparece na navegação à esquerda o botão “{{ui:app.devlog.short}}”. Ao pressioná-lo, abre-se à direita o painel **{{ui:app.devlog.title}}**.

Aqui aparecem, com a hora, os registros internos do app (o log do backend), os avisos da tela e os erros que não foram capturados.

- Na seleção do alto, é possível filtrar por **{{ui:app.devlog.level.all}}**, **{{ui:app.devlog.level.warn}}** e **{{ui:app.devlog.level.error}}**.
- Se você digitar uma palavra no campo de filtro, só aparecem as linhas que a contêm.
- Com **{{ui:app.devlog.copy}}**, as linhas exibidas são copiadas como texto. Ao relatar um problema, é possível colá-las.
- Com **{{ui:app.devlog.clear}}**, o registro é apagado.

> O registro é o histórico de enquanto o app está aberto. Ao fechar, o registro da tela é apagado. Para saber como investigar com mais detalhe, veja [Solução de problemas](10-troubleshooting.md).
