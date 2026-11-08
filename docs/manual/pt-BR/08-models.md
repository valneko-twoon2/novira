# Gerenciar e encontrar modelos

Para criar imagens, é preciso um “modelo”, que é a origem das imagens. O novira tem a aba **{{ui:app.tabs.models}}**, para organizar os modelos que já existem, e a aba **{{ui:app.tabs.browse}}**, para procurar na internet e baixar modelos.

Este capítulo explica como usar as duas abas, os tipos de modelo e como ler as licenças.

## Tipos de modelo

Um modelo tem uma “{{ui:models.sort.base}}” (a família a que pertence) e um “{{ui:models.sort.type}}” (a função que desempenha).

### Base (família)

Os modelos são feitos por família, e modelos de famílias diferentes não podem ser combinados. Por exemplo, um LoRA feito para SD1.5 não pode ser usado com um modelo SDXL.

| Exibido como | O que é |
|---|---|
| SD1.X | Stable Diffusion 1.5 e similares. Roda de forma leve |
| SD2.X | A família Stable Diffusion 2 |
| SDXL | A família Stable Diffusion XL. Muitos modelos de ilustração (Illustrious, NoobAI, Pony etc.) também estão aqui |
| SD3.X | A família Stable Diffusion 3 |
| FLUX | A família FLUX |
| Any | Itens que não dependem de uma família (ampliadores e similares) |

> Além de SD1.X, SD2.X e SDXL, é possível criar imagens com modelos de famílias mais novas (Anima, Flux, FLUX.2, Chroma, Qwen-Image, Z-Image, SD3, HiDream, AuraFlow, HunyuanImage e Hunyuan-DiT) e criar vídeos, na tela de vídeo, com modelos Wan, HunyuanVideo e LTX-Video. Modelos de outras famílias aparecem na lista, mas, ao gerar com eles, a geração falha e o nome da família é exibido. O modo de usá-los está no capítulo “Gerar”.

Se as bases do modelo e do LoRA não combinarem, o botão de gerar da tela **{{ui:app.tabs.generate}}** não pode ser pressionado e o motivo é exibido.

### Tipos

| Tipo | Função |
|---|---|
| {{ui:models.rail.main}} ({{ui:models.type.main}}) | O corpo principal que desenha a imagem |
| {{ui:models.type.lora}} | Um modelo pequeno acrescentado ao principal para adicionar um estilo de arte ou um personagem |
| {{ui:models.type.vae}} | Uma peça usada para finalizar as cores e os detalhes de uma imagem |
| {{ui:models.type.controlnet}}, {{ui:models.type.modelPatch}} | Especificam a forma de uma imagem, como uma pose ou um traço (o patch de modelo é para Anima, Qwen-Image e Z-Image) |
| {{ui:models.type.ipAdapter}}, {{ui:models.type.clipVision}} | Levam o clima de uma imagem de referência para a geração |
| {{ui:models.rail.upscale}} | Ampliam imagens |
| {{ui:models.rail.encoders}} | Peças que compreendem texto (T5, Qwen, CLIP etc.; necessárias além do modelo principal, como em Anima e Flux) |
| {{ui:models.rail.diffusion}} | Modelos distribuídos apenas como o corpo principal, como Flux, Wan, Anima e Qwen-Image. Ao instalar, o app examina o conteúdo para identificar o tipo e a família |

Modelos de vídeo, música, voz e logotipos não aparecem nesta lista. Eles são baixados nas respectivas telas ([Vídeo, música, voz, logotipos e texto](07-media.md)).

## A aba Modelos

![A aba Modelos. Categorias à esquerda e cartões de modelos alinhados no centro](shot:models)

A aba **{{ui:app.tabs.models}}** é a lista dos modelos instalados.

### Encontrar

Com **{{ui:models.rail.title}}**, à esquerda, é possível filtrar a lista por tipo. A quantidade aparece à direita.

- **{{ui:models.rail.all}}**: tudo
- **{{ui:models.rail.favorites}}**: os que receberam uma estrela
- **{{ui:models.rail.main}}**, **{{ui:models.rail.lora}}**, **{{ui:models.rail.controlnet}}**, **{{ui:models.rail.vae}}**, **{{ui:models.rail.ipAdapter}}**, **{{ui:models.rail.upscale}}**, **{{ui:models.rail.encoders}}**, **{{ui:models.rail.diffusion}}**

Na barra superior, é possível filtrar por nome (**{{ui:models.searchPlaceholder}}**), filtrar por base, usar **{{ui:models.sort.label}}** ({{ui:models.sort.name}}, {{ui:models.sort.size}}, {{ui:models.sort.base}}, {{ui:models.sort.type}}), alternar entre **{{ui:models.view.grid}}** e **{{ui:models.view.list}}** e ajustar o tamanho das miniaturas.

No canto inferior esquerdo de um cartão há etiquetas com a base (SDXL etc.) e o formato. Um modelo cuja licença é conhecida também tem, no canto superior esquerdo, uma etiqueta de licença ([Etiquetas de licença](#etiquetas-de-licença)); ao pressioná-la, o conteúdo da licença abre ali mesmo, sem selecionar o cartão. Quando os cartões são pequenos, a etiqueta mostra apenas a marca. Ao passar o mouse sobre um cartão, aparecem uma estrela (favorito) e um menu.

No canto inferior direito da tela, são exibidos o número de modelos e o tamanho total.

### Adicionar modelos

Há dois botões no canto superior direito.

- **{{ui:models.find}}**: vai para a aba **{{ui:app.tabs.browse}}** (veja a seção correspondente abaixo).
- **{{ui:models.import}}**: instala arquivos que você já tem, ou um modelo cujo endereço você conhece.

Ao pressionar **{{ui:models.import}}**, abre-se a tela **{{ui:models.import.title}}**, onde é possível escolher entre quatro métodos.

| Aba | Como usar |
|---|---|
| {{ui:models.install.tab.source}} | Digite o endereço de um modelo e pressione **{{ui:models.install.install}}** |
| {{ui:models.install.tab.scan}} | Pressione **{{ui:models.install.scan}}** e escolha uma pasta no diálogo que se abre; os modelos dentro dela são listados. **{{ui:models.install.installAll}}** instala todos de uma vez. Arquivos do computador são instalados por aqui. Não pode ser usado quando o app está aberto no navegador |
| {{ui:models.install.tab.starter}} | O app seleciona e lista modelos úteis para instalar logo no início. Os modelos de que eles dependem (como um VAE) são instalados junto. Também aparecem os pacotes de modelos de vídeo, música, voz, logotipo e do recurso de apagar. Como na tela de modelos, eles aparecem em cartões, e é possível filtrar por **{{ui:models.starter.purposes}}** (criar imagens, vídeo, ampliação etc.), à esquerda, e pela lista **{{ui:models.starter.allFamilies}}** (Anima, SDXL etc.), no alto. Ao escolher uma família, o VAE e os codificadores necessários a ela também são listados |
| {{ui:models.install.tab.huggingface}} | Um campo para pesquisar pelo nome do repositório no Hugging Face (`autor/nome`) |

No campo **{{ui:models.install.tab.source}}** é possível digitar o seguinte.

- O endereço da página de um modelo no Civitai
- Um endereço direto para um arquivo de modelo (que comece com `https://`)
- Um arquivo do Hugging Face (no formato `autor/nome::arquivo`)

Se você digitar o local de um arquivo do computador (em um formato como `C:\models\model.safetensors`), é exibido um aviso para usar **{{ui:models.install.tab.scan}}**. O arquivo escolhido ali é levado para a pasta de modelos do app (no mesmo disco, o espaço usado quase não aumenta; em outro disco, ele é copiado).

> Depois de digitar o repositório (`autor/nome`) e pressionar **{{ui:models.install.hfLookup}}**, a aba **{{ui:models.install.tab.huggingface}}** mostra os arquivos de modelo avulsos (`.safetensors`, `.gguf`, `.ckpt`, `.pt`, `.pth`) do repositório. Os arquivos dentro de pastas de componentes, como `unet` e `vae`, não aparecem. Se houver um token do Hugging Face salvo, a lista é obtida com ele.

A instalação avança em ordem. O andamento aparece em **{{ui:models.queue.title}}**, que surge ao pressionar **{{ui:models.dock.queue}}** no canto inferior esquerdo da tela (durante o trabalho, exibe “N instalando”). Aqui também é possível usar **{{ui:models.queue.cancel}}** em um item por vez e limpar os concluídos com **{{ui:models.queue.prune}}**.

Um arquivo que está no meio do download só vai para a pasta de modelos depois de concluído. Mesmo que se interrompa no meio, nenhum arquivo incompleto é deixado.

### Detalhes do modelo

![Ao escolher um modelo, os detalhes aparecem à direita. Tamanho, local, licença, origem etc. ficam alinhados](shot:models-detail)

Ao pressionar um cartão, os detalhes se abrem à direita. Para fechá-los, pressione **{{ui:models.detail.close}}** no canto superior direito.

Os detalhes mostram o nome, as etiquetas de base e tipo, a descrição, **{{ui:models.details.size}}**, **{{ui:models.details.path}}** (que pode ser copiado), **{{ui:models.details.license}}**, **{{ui:models.details.source}}** e **{{ui:models.details.page}}** (o endereço do modelo original; ao pressioná-lo, abre-se no navegador).

Quando o modelo tem várias imagens, é possível alternar com as setas à esquerda e à direita da imagem, e no canto inferior direito aparece o número da imagem atual (nos modelos instalados do Civitai, entram as imagens da página original).

Com os botões na parte superior, é possível fazer o seguinte.

- **{{ui:common.edit}}**: corrige o nome, a descrição, a base e o tipo. Use quando a base ou o tipo não tiver sido identificado corretamente de forma automática.
- **{{ui:common.delete}}**: exclui o modelo (veja abaixo).

Quando um modelo instalado do Civitai tem uma versão nova, o cartão recebe a etiqueta **{{ui:models.updates.tag}}**, e acima dos detalhes aparecem o nome e a data da nova versão. Ao pressionar **{{ui:models.updates.open}}**, a página da nova versão abre no navegador. As novas versões são verificadas automaticamente quando você abre a aba de modelos (se já se passou 1 dia ou mais desde a última verificação), e uma notificação avisa quando aparece uma nova. Para verificar na hora, pressione o botão **{{ui:models.updates.check}}**, no alto. Só são consideradas versões novas da mesma base, e versões pagas não são exibidas. Na verificação, o número do Civitai dos modelos instalados é enviado ao Civitai.

### Palavras-gatilho

LoRAs e similares têm palavras (palavras-gatilho) que fazem efeito quando colocadas no prompt. Se forem registradas em **{{ui:models.triggers.title}}**, ao escolher esse LoRA na tela **{{ui:app.tabs.generate}}**, as palavras aparecem como botões. Pressionar um deles o adiciona ao prompt.

Digite uma palavra no campo e pressione **{{ui:common.add}}** para registrá-la. É possível removê-la com o ×. As alterações são salvas na hora. Em modelos instalados do Civitai, as palavras indicadas pelo distribuidor podem já vir preenchidas.

### Configurações padrão

Um modelo principal tem **{{ui:models.defaults.title}}**. São valores preenchidos automaticamente ao escolher esse modelo na tela de geração.

- **{{ui:models.defaults.scheduler}}**
- **{{ui:models.defaults.steps}}**
- **{{ui:models.defaults.cfgScale}}**
- Largura e altura

Também é possível salvar **{{ui:models.defaults.vae}}** e **{{ui:models.defaults.vaePrecision}}**. Somente os itens cuja chave foi ligada são salvos. Pressione **{{ui:common.save}}** para confirmar.

Os “valores recomendados” variam de modelo para modelo; por isso, se você configurar uma vez os modelos que usa com frequência, não precisará ajustá-los toda vez.

### Excluir

Ao pressionar **{{ui:common.delete}}**, aparece uma confirmação. **{{ui:models.deleteWarning}}**

No entanto, um modelo instalado pelo novira (dentro da pasta de dados do app) é excluído junto com o arquivo, enquanto um modelo em uma pasta preparada por você é apenas removido da lista e o arquivo permanece.

## Etiquetas de licença

Os modelos têm termos de uso (uma licença) definidos pelo distribuidor. O novira mostra os pontos principais com etiquetas.

| Etiqueta | Significado |
|---|---|
| {{ui:browse.commercial.allowed}} | É permitido vender as imagens geradas, usá-las em serviços de geração e vender o próprio modelo |
| {{ui:browse.commercial.limited}} | Só parte dos usos comerciais é permitida (esta etiqueta também aparece quando algum item não consta na licença) |
| {{ui:browse.commercial.denied}} | Nenhum destes usos é permitido: vender as imagens geradas, usá-las em serviços de geração ou vender o próprio modelo |

Ao pressionar uma etiqueta, aparece uma lista de **{{ui:browse.permission.title}}**. É possível ver, em itens como “{{ui:browse.permission.sellImages}}”, “{{ui:browse.permission.sellModel}}” e “{{ui:browse.permission.shareMerges}}”, se cada um é permitido, não permitido ou não informado.

A etiqueta é definida a partir das permissões de uso que o autor configurou no Civitai e da licença exibida no Hugging Face. É apenas uma referência baseada no que os sites mostram; no fim, confira o texto da licença do distribuidor. **{{ui:browse.permission.disclaimer}}**

Quando a licença de um modelo instalado não é conhecida, é exibido **{{ui:models.details.licenseUnknown}}**.

> Também existem modelos com licenças não comerciais. Por exemplo, o vídeo **{{ui:video.model.fast}}** tem uma licença não comercial. Ao usar para trabalho ou venda as imagens ou os vídeos que você criar, confira sempre a licença do modelo utilizado.

## A aba Explorar

![A aba Explorar. Em cima ficam onde pesquisar, o tipo, o campo de busca e os filtros; abaixo, os cartões de modelos alinhados](shot:browse)

A aba **{{ui:app.tabs.browse}}** é uma tela para pesquisar modelos na internet e baixá-los na hora.

### Onde pesquisar

Com o seletor no canto superior esquerdo, escolhe-se onde pesquisar.

- **{{ui:browse.source.civitai}}**: um site onde se reúnem muitas ilustrações e LoRAs.
- **{{ui:browse.source.huggingface}}**: um site com muitos modelos de instituições de pesquisa e empresas. Lá não é possível encontrar modelos pelo nome: cole a URL da página do modelo (a página de uma pasta ou de um arquivo serve) ou `autor/nome` na caixa grande no meio da tela e pressione **{{ui:models.install.hfLookup}}**. Marque os arquivos exibidos e pressione o botão de instalar no canto superior direito para iniciar o download. Se você colou a URL de uma pasta, no início só aparecem os arquivos dessa pasta.

Ao lado, escolha o **{{ui:browse.kind.label}}**. São **{{ui:browse.kind.lora}}**, **{{ui:browse.kind.checkpoint}}**, **{{ui:browse.kind.controlnet}}**, **{{ui:browse.kind.vae}}**, **{{ui:browse.kind.diffusion}}** e **{{ui:browse.kind.all}}**.

### Filtrar

No campo de busca, digite o nome de um modelo, um autor ou uma etiqueta. Depois de digitar e esperar um instante, os resultados são substituídos.

É possível refinar os resultados com os menus à direita.

| Item | O que é |
|---|---|
| {{ui:browse.base.label}} | {{ui:browse.base.sdxlCompat}}, {{ui:browse.base.illustrious}}, {{ui:browse.base.noobai}}, {{ui:browse.base.sdxl}}, {{ui:browse.base.pony}}, {{ui:browse.base.sd15}}, {{ui:browse.base.flux}}, {{ui:browse.base.anima}} etc. |
| {{ui:browse.sort.label}} | {{ui:browse.sort.downloads}}, {{ui:browse.sort.rating}}, {{ui:browse.sort.newest}} |
| {{ui:browse.period.label}} | Todo o período, 1 ano, 1 mês, 1 semana, 24 horas (somente no Civitai). Nas versões pagas, o cartão mostra “{{ui:browse.paid.badge}}”. Para os itens em acesso antecipado, também aparece o dia em que ficam gratuitos. Versões pagas não podem ser instaladas (o botão não pode ser pressionado), pois o app não consegue saber se você já as comprou; obtenha-as pela página do Civitai |
| {{ui:browse.nsfw.label}} | Desligado por padrão. Ao ligar, aparecem também modelos para o público adulto |
| **{{ui:browse.filter.button}}** | Ao pressionar, abre-se uma caixa em que é possível filtrar pelo que a licença permite (vender as imagens geradas, usar em serviços de geração etc.; só aparecem os modelos que permitem tudo o que foi marcado), pelo tipo de checkpoint, pelo preço ({{ui:browse.filter.free}}, {{ui:browse.filter.paid}}), só os que têm arquivo no formato safetensors e pelo autor (nome exatamente igual). O botão mostra quantos filtros estão ativos, e **{{ui:browse.filter.reset}}** desfaz tudo (somente no Civitai) |

Ao rolar até o fim, mais itens são carregados. Também é possível carregar mais com **{{ui:browse.status.loadMore}}**. Se não foi possível buscar, pressione **{{ui:browse.status.retry}}**.

### Ler um cartão e baixar

Um cartão mostra uma imagem de exemplo, o nome do modelo, o autor, o número de downloads, o número de curtidas e a etiqueta de licença. Para LoRAs, as palavras-gatilho também são exibidas.

- **{{ui:browse.card.download}}**: baixa o arquivo representativo desse modelo.
- O ícone à direita (**{{ui:browse.card.openCivitai}}**): abre o site do distribuidor no navegador.

Ao pressionar um cartão, os detalhes se abrem pela direita. É possível ver as versões, a lista de arquivos (tamanho e formato), as palavras-gatilho, as etiquetas, a descrição e a licença. Escolha uma versão e pressione **{{ui:browse.card.download}}** no arquivo que deseja baixar. Pressionar uma palavra-gatilho a copia. Feche pressionando fora dele ou com `Esc`.

Em **{{ui:browse.samples.title}}**, nos detalhes, aparecem os exemplos dessa versão cujas configurações foram publicadas. Dá para ver a imagem, o sampler, o número de passos, o CFG, o tamanho, o prompt e os modelos e LoRAs usados (os que você não instalou aparecem com linha pontilhada). Ao pressionar **{{ui:browse.samples.use}}**, o prompt e as configurações vão para a tela de geração. As configurações que o exemplo não registrou ficam como estão, e dos modelos e LoRAs entram só os que você instalou; os que não estão instalados têm o nome mostrado em uma notificação. As configurações foram escritas por quem criou a imagem, então alguns exemplos não as têm, e outros não produzem a mesma imagem só com elas.

Quando o download começa, uma pequena caixa chamada **{{ui:browse.dock.title}}** aparece no canto inferior esquerdo da tela e mostra o andamento. É possível cancelar com **{{ui:browse.dock.cancel}}** e limpar os concluídos com **{{ui:browse.dock.clear}}**. Um cartão cujo download terminou muda para **{{ui:browse.card.installed}}** e também é adicionado à lista da aba **{{ui:app.tabs.models}}**.

> Ao baixar um modelo que exige login, registre sua chave de API do Civitai em **{{ui:settings.title}}**. Ao usar um modelo do Hugging Face que exige solicitação de acesso, registre seu token do Hugging Face. Ambos são criptografados e salvos neste computador, e não são exibidos na tela. Para detalhes, vá a [O agente, as configurações e os atalhos](09-assistant-settings.md).

> Para obter do Civitai a imagem e a licença de uso dos modelos locais, ligue **{{ui:settings.engine.civitai.label}}**, em **{{ui:settings.tab.engine}}** de **{{ui:settings.title}}**. Como o hash dos arquivos de modelo é enviado ao Civitai, ele vem desligado por padrão. A mudança vale a partir da próxima inicialização. Se houver modelos sem imagem com a opção desligada, aparece um aviso no alto da aba **{{ui:app.tabs.models}}**, e **{{ui:models.coverHint.open}}** abre as configurações.

Para seguir com a geração de imagens, vá a [Criar imagens](02-generate.md).
