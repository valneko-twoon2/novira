# Solução de problemas

Este capítulo reúne as causas de quando algo dá errado e o que tentar. Procure as palavras que aparecem na sua tela.

Primeiro, observar os dois itens a seguir costuma dar uma pista da causa.

- A aba **{{ui:app.tabs.queue}}**: um item que falhou mostra o motivo (veja [abaixo](#a-geração-falha)).
- {{ui:app.devlog.title}}: o registro interno do app (veja [O assistente e as configurações](09-assistant-settings.md)).

## Inicialização e o mecanismo

Para criar imagens e outros conteúdos, o novira usa um “mecanismo de geração de imagens” (o ComfyUI e o Python que o executa). O app instala o mecanismo sozinho e o inicia sozinho.

### A inicialização demora muito

Na primeira vez que o app é iniciado, demora um pouco, porque o mecanismo precisa ser baixado e descompactado. **{{ui:engine.firstRunNote}}**

Na primeira tela aparecem três etapas: **{{ui:splash.step.downloading}}**, **{{ui:splash.step.extracting}}** e **{{ui:splash.step.starting}}**. Durante o download, também são mostrados o tamanho, a velocidade e o tempo restante. Aguarde até terminar.

Quando o mecanismo fica pronto, a tela muda. A partir da segunda vez, é só o curto tempo entre iniciar e o mecanismo responder.

### Mensagens no alto da tela

Enquanto o mecanismo está sendo preparado, ou quando algo deu errado, aparece uma mensagem no alto da tela.

| Mensagem | Significado |
|---|---|
| {{ui:engine.title.downloading}} | O mecanismo está sendo baixado. São vários GB. Em uma conexão lenta, leva tempo |
| {{ui:engine.title.extracting}} | Os arquivos baixados estão sendo descompactados |
| {{ui:engine.title.starting}} | O mecanismo está sendo iniciado e o novira espera que ele se conecte |
| {{ui:engine.title.error}} | A preparação falhou. O motivo aparece abaixo |

### Apareceu a mensagem “{{ui:engine.title.error}}”

Se ela apareceu na primeira tela ao iniciar, pressionar **{{ui:splash.open}}** abre o app sem o mecanismo. Nesse caso não é possível criar imagens e outros conteúdos, mas dá para ver imagens e organizar modelos.

O que tentar:

1. Leia o texto do motivo. Verifique se você está conectado à internet e se há espaço livre no disco.
2. Tente de novo. Mesmo depois de a preparação do mecanismo ter falhado, o app tenta prepará-lo outra vez na próxima vez que você começar a gerar. Se ainda assim não resolver, feche o app e abra-o novamente.
3. Se o download terminou e só a descompactação falhou, os arquivos baixados permanecem, então tentar de novo continua a partir da descompactação.
4. Um software de segurança pode estar inspecionando os novos arquivos e interromper a descompactação. O app tenta automaticamente várias vezes, mas, se continuar acontecendo, tente excluir a pasta de dados (veja abaixo) da verificação ou desligue o software temporariamente.
5. Se o motivo disser “see logs/comfyui.log”, o log do mecanismo tem um motivo detalhado ([Como ler os logs](#como-ler-os-logs)).

> O mecanismo é o ComfyUI para Windows e, por padrão, é instalado o destinado a GPUs NVIDIA. Também há configurações para usar uma GPU AMD ou um ComfyUI instalado por você mesmo, mas são para usuários avançados ([Configurações avançadas](#configurações-avançadas)).

### O mecanismo parece ter parado no meio

O tempo de espera entre o mecanismo ser iniciado e responder é, por padrão, de 3 minutos. Depois disso, aparece um erro com o texto “ComfyUI did not answer in time”, que significa que o ComfyUI não respondeu a tempo. Se o mecanismo encerrou no meio da inicialização, aparece “ComfyUI exited while starting”. Nos dois casos, o motivo fica registrado no log do mecanismo (`comfyui.log`).

## Não é possível gerar

### O botão Gerar não pode ser pressionado

Ao passar o mouse sobre o botão Gerar na tela **{{ui:app.tabs.generate}}**, aparece uma lista de motivos em **{{ui:params.invoke.cannotInvoke}}**. Nas telas de vídeo, música, voz e logotipo, os motivos ficam alinhados sob o botão. Ao corrigir os motivos exibidos, um por um, o botão passa a poder ser pressionado.

| Motivo exibido | Como corrigir |
|---|---|
| {{ui:params.readiness.noModel}} | Escolha um modelo. Se nenhum estiver instalado, vá a “Nenhum modelo está instalado”, abaixo |
| {{ui:params.readiness.loraMissing}} | O LoRA que você tinha escolhido não foi encontrado. Ele pode ter sido excluído ou movido. Escolha o LoRA de novo ou remova-o |
| O LoRA “…” é incompatível com o modelo | A base (SDXL, SD1.X etc.) é diferente. Use um LoRA com a mesma base ou remova-o |
| Imagem de referência ○: nenhuma imagem selecionada, ou nenhum modelo selecionado | Coloque uma imagem e um modelo no campo da imagem de referência |
| As imagens de referência precisam da extensão … | Instale a extensão pela orientação no campo da imagem de referência ([Falta uma extensão](#falta-uma-extensão)) |
| {{ui:params.readiness.upscaleNoImage}} | Escolha uma imagem para ampliar |
| {{ui:params.readiness.upscaleNoModel}} | Escolha um modelo para a ampliação. Se nenhum estiver instalado, é possível instalar um em **{{ui:models.install.tab.starter}}** na aba {{ui:app.tabs.models}} |
| {{ui:video.problem.prompt}}, {{ui:music.problem.tags}}, {{ui:voice.problem.text}}, {{ui:logo.problem.text}} | Um campo obrigatório está vazio. Preencha-o |
| {{ui:video.problem.image}} | No modo “A partir de imagem”, nenhuma imagem para animar foi escolhida |
| {{ui:voice.problem.description}} | No modo “Descrever uma voz”, a descrição da voz está vazia |
| {{ui:video.problem.pack}}, {{ui:music.problem.pack}}, {{ui:voice.problem.pack}}, {{ui:logo.problem.pack}} | Os modelos dedicados não estão instalados. Vá ao próximo item |

### Os modelos de vídeo, música, voz ou logotipos não estão instalados

Um cartão aparece no painel esquerdo de cada tela; pressione **{{ui:pack.install}}**. Não é possível criar nada até a instalação terminar.

- Se o download falhar no meio, o botão do cartão muda para **{{ui:pack.retry}}**. Pressione-o para tentar de novo.
- Para voz, o mecanismo de leitura em voz alta também é instalado. O mecanismo de geração de imagens precisa ter terminado de ficar pronto antes.
- O modelo de vídeo rápido é um download separado do modelo de vídeo padrão.

Para detalhes, consulte [Vídeo, música, voz, logotipos e texto](07-media.md).

### Nenhum modelo está instalado

Quando a aba **{{ui:app.tabs.models}}** mostra **{{ui:models.empty.title}}**, não há nenhum modelo.

- Em **{{ui:models.install.tab.starter}}**, dentro de **{{ui:models.import}}**, é possível instalar o seu primeiro modelo.
- Também é possível procurar um modelo de que goste na aba **{{ui:app.tabs.browse}}** e instalá-lo.
- Se você já tem arquivos de modelo, pode trazer uma pasta inteira com **{{ui:models.install.tab.scan}}**, dentro de **{{ui:models.import}}**.

Para detalhes, consulte [Modelos](08-models.md).

### Falta uma extensão

Alguns recursos dizem “requer a extensão XXX”. Corrigir rostos, selecionar uma região, remover um fundo, preencher quadros de vídeo e usar imagens de referência estão entre eles.

1. Pressione **{{ui:params.refImage.installPack}}** ao lado da mensagem.
2. Quando a instalação terminar, pressione **{{ui:params.refImage.restartEngine}}** para reiniciar o mecanismo.
3. Depois da reinicialização, tente de novo.

Também é possível instalar e remover extensões na lista de **{{ui:workflows.panel.packs}}**, na aba **{{ui:app.tabs.workflows}}**.

> Quando você está conectado a um mecanismo preparado por você mesmo, e não ao instalado pelo app, o app não consegue instalar extensões. Instale-as nesse mecanismo.

### A GPU está sem memória ou disputando com outros apps

Imagens, vídeo e música usam a GPU do computador. Se outros apps (jogos, edição de vídeo, vídeos em um navegador etc.) estiverem usando a GPU, a memória pode faltar e causar falhas.

Quando falta memória, o erro pode incluir as letras “OOM” (de out of memory, memória esgotada).

Quando um trabalho falha por falta de memória, o app reconhece isso e mostra o aviso **{{ui:queue.oom.title}}**. Ele aparece acima da galeria, sob o item que falhou na aba **{{ui:app.tabs.queue}}**, nas telas de vídeo, música, voz e logotipo, e como notificação no canto inferior direito.

![O aviso de falta de memória da GPU, com os botões Tentar menor e Ativar o modo de pouca memória e reiniciar](shot:out-of-memory)

Os botões do aviso permitem tentar uma destas opções:

- **{{ui:queue.oom.retrySmaller}}**: cria de novo com as mesmas configurações e a mesma seed, em cerca de 75% da área, com a mesma proporção. Aparece apenas para imagens criadas em um tamanho escolhido (não para vídeo, música, voz, logotipos ou ampliação).
- **{{ui:queue.oom.lowMemory}}**: liga **{{ui:settings.lowMemory.label}}** (veja [O assistente e as configurações](09-assistant-settings.md)) e reinicia o mecanismo. Enquanto um item está sendo criado, vale a partir da próxima vez que o mecanismo for iniciado. Não aparece quando o modo já está ligado.

Depois que um trabalho falha por falta de memória, o app pede ao mecanismo que descarregue seus modelos e libere a memória. Por isso, o trabalho seguinte começa carregando o modelo de novo e demora um pouco mais.

O que tentar:

- Feche outros apps que usam a GPU, como jogos ou edição de vídeo, e crie de novo.
- Diminua o tamanho da imagem.
- Reduza os LoRAs e as imagens de referência usados.
- Para vídeo, crie em um tamanho menor e amplie depois com **{{ui:video.finish}}**. Também é possível experimentar **{{ui:video.light.fp8}}** e **{{ui:video.light.tiled}}** em **{{ui:video.light.title}}**.
- Abra o app de novo para liberar a memória em uso.

O modelo de voz é retirado da GPU quando não é usado por um tempo. A criação avança um item por vez, em ordem.

### A geração falha

Quando a criação de uma imagem, vídeo, música ou similar falha, o item na aba **{{ui:app.tabs.queue}}** passa a **{{ui:queue.status.failed}}**. Pressione o item para abri-lo e o motivo aparece em **{{ui:queue.detail.error}}**. Nas telas de vídeo, música, voz e logotipo, uma indicação de falha e o motivo também aparecem perto do alto do centro (até os 3 mais recentes).

Quando souber o motivo, é possível tentar de novo com as mesmas configurações usando o botão **{{ui:queue.action.retry}}** do item.

O texto do motivo vem de dentro do mecanismo ou do app, então pode estar em inglês. Estes são os mais comuns.

| Texto do motivo (a essência) | Significado e o que tentar |
|---|---|
| ComfyUI does not see ... (check model roots / extra_model_paths) | O mecanismo não encontra esse modelo. Você moveu o arquivo do modelo, ou a configuração das pastas de busca não corresponde. Instale-o de novo pela aba Modelos ou confira o local |
| ComfyUI is not reachable at ... | Não é possível conectar ao mecanismo que você preparou separadamente. Verifique se esse mecanismo está em execução |
| ComfyUI exited while starting / did not answer in time | O mecanismo não consegue iniciar. Veja o log do mecanismo |
| ... OOM | A GPU está sem memória. Veja o item anterior |
| ... models are not supported by the ComfyUI backend yet | Modelos FLUX e SD3.X ainda não podem ser usados para gerar imagens. Escolha um modelo SDXL ou SD1.X |
| Reference images need the ... custom node pack | A extensão necessária para imagens de referência não está instalada |
| This ComfyUI is too old for video / music | O mecanismo em uso não tem recursos necessários para vídeo ou música. Isso não acontece com o mecanismo instalado pelo app. Se você preparou o mecanismo por conta própria, atualize-o |
| The video / music / logo models are not installed yet | Os modelos dedicados não estão instalados. Baixe-os em cada tela |
| ComfyUI has no ... node; install the custom node pack | A extensão de um nó usado no fluxo de trabalho não está instalada |
| Interrupted because novira was closed | O app foi fechado no meio da criação. Crie de novo |

### A imagem foi criada, mas não aparece

Se a criação mostra **{{ui:queue.status.completed}}** mas nada aparece na galeria, verifique o seguinte.

- **Pasta diferente**: as novas imagens vão para a pasta marcada com **{{ui:gallery.boards.autoBadge}}** (por padrão, **{{ui:gallery.boards.uncategorized}}**). Se houver outra pasta aberta, elas não aparecem nela. Troque de pasta ou escolha de novo a pasta para onde vão as novas imagens com **{{ui:gallery.boards.setAutoAdd}}**.
- **Logotipos vão para “Recursos”**: os logotipos vão para **{{ui:gallery.view.assets}}**, e não para **{{ui:gallery.view.images}}**.
- **Como aparecem vídeo e áudio**: o vídeo fica alinhado como uma miniatura com ▶, e o áudio com ♪. Eles ficam ocultos se uma busca ou um filtro estiver ativo.

Se ainda não encontrar, confira o **{{ui:queue.col.destination}}** do item na aba **{{ui:app.tabs.queue}}**. Um item cujo destino de saída é **{{ui:queue.destination.canvas}}** aparece na tela, e não na galeria.

## Onde os dados ficam e backups

### Onde estão os dados

Imagens, modelos e registros vão todos para uma pasta chamada **`novira-data`**. O local é o seguinte.

- Versão distribuída: a pasta escolhida na instalação. O padrão é `novira-data` dentro da mesma pasta do executável do app (`novira.exe`).
- Versão em desenvolvimento: `novira-data` dentro da pasta principal do repositório.

É possível mudar para outro local com a variável de ambiente `NOVIRA_DATA_DIR`.

| Pasta ou arquivo | O que guarda |
|---|---|
| `outputs` | As imagens, os vídeos e os áudios que você criou |
| `novira.sqlite` | Registros como informações de imagens, pastas, a fila, a lista de modelos e fluxos de trabalho |
| `thumbnails` | Imagens reduzidas |
| `models` | Os modelos que você instalou |
| `comfyui` | O mecanismo de geração de imagens que o app instalou |
| `cache` | Dados temporários que o mecanismo usa |
| `voice` | A biblioteca para ler voz em voz alta |
| `logs` | Logs (veja abaixo) |
| `settings.json` | Configurações para usuários avançados (não há problema se não existir) |
| `secrets` | Chaves de API e tokens (criptografados) |
| `agent.json` | O tipo de IA escolhido para o assistente de IA |

O mecanismo que o app instalou (ComfyUI e Python) e seus dados de trabalho também ficam dentro da pasta de dados.

As configurações da tela do app (idioma, tema, predefinições, o histórico dos chats de IA etc.) ficam guardadas não em `novira-data`, mas na área de armazenamento do lado da tela do app.

### Backups

O novira tem um recurso que cria um backup e um recurso que restaura a partir de um backup. Para proteger imagens importantes para você, use a parte **{{ui:share.backup.section}}** das configurações (veja [O assistente e as configurações](09-assistant-settings.md#backup)). Um backup contém as imagens que você criou e o que você configurou ou registrou no app, mas não os modelos nem o mecanismo de geração de imagens. Se você quer guardar esses também, copie a pasta por conta própria.

1. Feche o app (verifique também se nada está sendo criado).
2. Copie a pasta `novira-data` inteira para outra unidade ou similar.

As maiores são `models` e `comfyui`. Se você quer guardar apenas as imagens e os registros, `outputs` e `novira.sqlite` são a parte principal. Os modelos em `models` muitas vezes podem ser baixados de novo de onde você os obteve, mas aqueles cuja distribuição terminou podem não ser recuperáveis.

> As chaves de API e os tokens são criptografados com um recurso do Windows. Se forem copiados para outro computador ou outro usuário, podem não ser legíveis; nesse caso, digite-os novamente nas configurações.

As configurações da tela do app, as predefinições e o histórico dos chats de IA não estão incluídos nesta cópia, mas estão incluídos em um backup.

## Como ler os logs

Os logs podem ser vistos em três lugares.

| Lugar | O que guarda |
|---|---|
| {{ui:app.devlog.title}} (dentro do app) | Os registros internos do app, e avisos e erros na tela. A exibição é ligada nas configurações ([O assistente e as configurações](09-assistant-settings.md)) |
| `novira-data\logs\novira.log` | O log do próprio app. Quando fica grande (mais de 2 MB), passa para `novira.log.1` |
| `novira-data\logs\comfyui.log` | O log do mecanismo de geração de imagens. O motivo aparece aqui quando ele não consegue iniciar ou quando a geração falha |

Em um log, as linhas novas são acrescentadas no fim. Quando algo aconteceu, olhe perto do fim. Linhas que contêm “error” ou “failed” são as pistas.

## Ao relatar um problema

Se você reunir o seguinte, a causa pode ser encontrada mais rápido.

1. **O que você fez e o que aconteceu**: a ordem das suas ações, o que você esperava e o que realmente aconteceu.
2. **As palavras na tela**: copie exatamente o texto do erro (o **{{ui:queue.detail.error}}** na aba **{{ui:app.tabs.queue}}** ou a mensagem que apareceu no alto da tela).
3. **A versão do app**: ela aparece na parte mais baixa da tela de configurações ou em **{{ui:app.nav.about}}**.
4. **O log do desenvolvedor**: o texto copiado com **{{ui:app.devlog.copy}}**.
5. **Os arquivos de log**: `novira.log` e `comfyui.log`, do período em que o problema aconteceu.
6. **Informações sobre o seu computador**: o tipo de GPU e sua memória, e a versão do Windows.

> Os logs podem conter prompts e locais de arquivos. Antes de entregá-los a alguém, verifique se há algo que você não queira mostrar.

## Configurações avançadas

Se você colocar um `settings.json` na pasta de dados, pode mudar o comportamento de itens como o mecanismo. Normalmente isso não é necessário.

| Nome da configuração | O que é |
|---|---|
| `comfyuiPackage` | O tipo de mecanismo a instalar. `nvidia` (padrão) ou `amd` |
| `comfyuiUrl` | Conectar a um ComfyUI que já está em execução (o app não instala nem inicia um mecanismo) |
| `comfyuiDir` | Usar a pasta de um ComfyUI instalado por você mesmo |
| `modelRoots` | Adicionar pastas para procurar modelos |
| `comfyuiStartTimeoutSecs` | O número de segundos de espera para o mecanismo iniciar (padrão 180) |
| `lowMemoryMode` | Modo de pouca memória (`true` ou `false`). Alterar **{{ui:settings.lowMemory.label}}** nas configurações o grava aqui |

Se o arquivo for escrito de forma incorreta, o app não inicia e mostra o motivo. Depois de fazer uma alteração, abra o app de novo.
