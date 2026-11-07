# 智能体、设置、快捷键

本章介绍：只需用文字描述就能帮你调整设置的智能体、设置界面、快捷键列表、应用信息界面，以及开发者日志。

设置界面、快捷键和应用信息，都从屏幕左下角的 **{{ui:app.nav.settingsMenu}}** 中打开。

## 智能体

![右侧面板中的智能体。选择要使用的 AI 并登录的初始界面](shot:agent)

点击右侧面板上方的 **{{ui:app.right.assistant}}** 标签页，**{{ui:agent.title}}** 会与图库互换位置显示出来。在 {{ui:app.tabs.generate}}、{{ui:app.tabs.canvas}}、{{ui:app.tabs.upscaling}}、{{ui:app.tabs.workflows}} 的界面中都可以使用，切换界面后，聊天和写到一半的文字也会保留。点击 **{{ui:app.right.gallery}}** 标签页，就会回到图库。在{{ui:app.nav.extensions}}界面向智能体提问时，会在界面上方以窗口打开。这个窗口只出现在提问的界面，切换到 {{ui:app.tabs.models}}、{{ui:app.tabs.browse}} 等其他界面后不会出现。窗口可以拖动标题来移动。

你不必自己选择模型和 LoRA、设置提示词和尺寸，只要像“站在夕阳海边的动漫风格少女”这样，用文字描述想生成的内容，智能体就会选好设置并填入。

### 开始使用（登录）

智能体并不是由 novira 自己运行 AI，而是调用你电脑上的 AI 命令（Claude 或 Codex）来生成回答。使用时，需要做下面的准备。

1. 在电脑上安装 Anthropic 的 **Claude** 或 OpenAI 的 **Codex** 中任意一个的命令。
2. 打开智能体，点击想使用的那个（**{{ui:agent.setup.claude}}** 或 **{{ui:agent.setup.codex}}**）。
3. 会打开浏览器，在那里登录。

在电脑上找不到该命令时，会出现“在这台电脑上找不到 ○○ 的命令。请先安装。”的提示。请先安装该命令。

所使用的服务及其合同，属于你所选的一方。使用 Claude 和 Codex 时，novira 不保存 API 密钥。交互的内容（发送的文字，以及智能体为了工作而读取的应用信息，例如模型列表、设置、打开的漫画和文本的内容），会发送到你所选的服务。图库中图像的信息和生成标签页的提示词，只有在你允许时才会读取（见下面的“读取图像和提示词的许可”）。

选中的 AI 会显示在智能体最上面的一行。想更换时，点击该行右侧的 **{{ui:agent.changeProvider}}** 按钮。

### 连接 Ollama 等服务器

![连接服务器的界面。Ollama 的按钮、地址、模型、连接测试的结果](shot:agent-server)

除了 Claude 和 Codex，在这台电脑或网络上运行、带有 OpenAI 兼容 API 的服务器（Ollama 或 LM Studio 等），也可以供智能体使用。novira 向服务器询问回答，并自己执行智能体的工具（设置和编辑器的操作等），所以需要支持工具调用的模型。

连接的步骤如下。

1. 打开智能体，点击 **{{ui:agent.setup.openai}}**。
2. 点击要使用的服务器的按钮（Ollama 就点 **Ollama** 的按钮）。地址会填入，并加载服务器上的模型列表。其他服务器，请在 **{{ui:agent.endpoint.address}}** 中填入通常以“/v1”结尾的地址。
3. **{{ui:agent.endpoint.model}}** 从列表中选择。服务器不提供列表时，请输入名称。
4. 服务器要求密钥时，在 **{{ui:agent.endpoint.key}}** 中填入。密钥会加密保存在这台电脑上，只发送给这个服务器。自己电脑上的服务器，通常不需要。
5. 点击 **{{ui:agent.endpoint.test}}**。会确认服务器是否响应、是否有模型、该模型能否调用应用的工具。
6. 点击 **{{ui:agent.endpoint.use}}**。

模型无法调用工具时，测试会显示这一点，服务器返回的原因也会显示出来。输入栏上方也会保留警告，消息的发送会被拒绝。用聊天名称旁的按钮选择其他模型，可以再次确认。服务器的上下文（一次能读取的长度）不够智能体的请求时，测试也会同样失败。Ollama 的默认设置就是这样。请把服务器的上下文长度设为 32768 以上（在 Ollama 的设置中，或用环境变量 OLLAMA_CONTEXT_LENGTH），然后再次点击 **{{ui:agent.endpoint.test}}**。novira 不会假装能使用工具。

使用服务器时，聊天的标题会显示 OpenAI API。点击 **{{ui:agent.changeProvider}}** 会回到选择界面。填入的服务器会保留在表单中。

对于这台电脑之外的服务器，你发送的内容，以及在你允许的情况下智能体读取的内容，会通过网络发送出去。这样的服务器，地址下方会出现警告。不使用 https 的服务器，包括密钥在内的所有内容都会不加密地传输，所以也会出现那条警告。“{{ui:agent.permission.title}}”的确认中，还会显示读取的内容会发送到哪里。服务器的回复只当作普通文字处理，请求只有通过与 Claude 和 Codex 相同的确认后才会执行。

### 能做什么

智能体会根据你的文字决定下面这些内容，并填入设置。填入的内容，会以列表形式显示在回复中。

| 内容 | 示例 |
|---|---|
| 选择模型 | 从已安装的模型中，选择合适的 |
| 添加 LoRA | 添加与画风相符的 LoRA |
| 提示词 | 书写提示词和反向提示词 |
| 更改设置 | 尺寸、步数、CFG、调度器、种子 |
| 工作流 | 创建图，修改已打开的图（也会用 ComfyUI 本体的节点组建音乐、视频、语音的图。运行由你来做，点击 **{{ui:params.invoke.invoke}}**） |
| 文本 | 修改在 **{{ui:media.tab.text}}** 中打开的文字和对话气泡 |
| 视频、音乐、语音 | 更改各自界面的设置 |
| 漫画 | 在 **{{ui:app.tabs.comic}}** 中，更改分格布局、添加和切割分格，以及各分格的提示词、姿势和气泡（见下面的“让智能体帮忙画漫画”） |
| 姿势 | 在 **{{ui:app.tabs.canvas}}** 中，放置按文字要求的姿势的火柴人（请参阅 [画布](05-canvas.md#在画布上制作姿势)） |
| 生成 | 只在你请求时（以及下面的试画），把当前的设置或漫画的分格加入生成的队列 |
| 推荐扩展 | 指引适合想做的事的扩展，并可以通过按钮安装 |
| 应用的用法 | 用屏幕上的名称，告诉你该点哪里 |
| 讲解扩展 | 说明扩展能做什么、怎么用（见下面的“询问用法和扩展”） |

智能体能看到你打开的是哪个界面。例如，打开 **{{ui:media.tab.text}}** 并告诉它“把文字改成竖排”，那段文字就会改变。

智能体一边工作，一边立即把改动填入界面。工作期间，改动的内容会依次显示在“{{ui:agent.thinking}}”的下方。图像和视频只在你请求时才生成（加入生成的队列）。没有请求时只会更改设置，所以看了结果觉得不错的话，点击回复中的 **{{ui:agent.generate}}**，就会直接开始生成。打开漫画时，它的旁边还会出现“生成全部页面”的按钮。点击后，会把所有页面中有提示词的分格一并加入队列（不点击就不会加入）。它不会删除图像，也不会安装模型或扩展（扩展只会给出推荐）。回复中的粗体、项目符号、表格等，不会显示为原样的符号，而是以相应的形式显示。

### 反问与试画

当请求的内容中有会让结果大不相同的地方不明确时，例如要改哪个人物、是背景还是人物、是发型还是发色，智能体会在修改之前先反问。回答之后，它会照此修改。修改之后，如果你说“之前的更好”“那个孩子保持原样就好”，智能体会在这个聊天中确认修改前的状态，并把那一部分恢复原样（关闭应用后，就无法知道修改前的状态了）。

像“夏天的氛围”这样，仅凭文字难以传达的外观，智能体有时会只试着生成 1 张，看了那张图像后确认“是这样的氛围吗？”。试画的图像会显示在回复下方。查看图像时，会出现与下面“读取图像和提示词的许可”相同的确认。不想让它试画时，请关闭设置中的 **{{ui:settings.assistantTrial.label}}**（见下面的“设置”）。

### 让智能体帮忙画漫画

在打开 **{{ui:app.tabs.comic}}** 的状态下提出请求，智能体会读取当前打开的页面（分格的形状、各分格的提示词、姿势、气泡），并直接改写。例如，可以这样请求。

- 请求“做成有高潮的 5 格。第 1 格大一些，斜着切”，它会制作分格布局。没有特别指定形状时，它会像真正的漫画那样，让每一行的高度和分格的宽度参差不齐，把高潮的分格画得大一些，并根据场景加入斜切的分格线和延伸到纸张边缘的分格。分格之间，上下的间距比左右的更宽。每一页的划分方式都会变化。它可能使用标准模板，也可能自己决定分格的形状。
- 请求“按这个故事写出各分格的提示词”，它会为每个分格写出提示词，并加入符合故事发展的构图（特写、远景、仰视等）。
- 请求“按这个故事写出各分格的分镜说明”，它会为每个分格用文字写出场面（地点、时间、谁在做什么）。
- 请求“给各分格加上台词”，它会放置气泡并填入台词。台词超出气泡时，会把文字缩小，使其收进气泡。
- 请求“把第 2 格的女孩改成奔跑的姿势”，它会为该分格设定姿势。它还会写下登场人物（各角色的外观），使脸和衣服在每个分格中都保持一致。气泡会放在说话人的旁边，大小不会与其他人重叠。
- 请求“新做一部漫画，组建 30 页的分格布局”，它会新建漫画、添加页面，并把分格布局、提示词、台词一直推进到最后。从其他界面请求，也会切换到漫画的界面来工作。即使是很长的工作，也会在一次请求中持续到完成。中途想停止时，请点击 **{{ui:agent.stop}}**。

图像只在你请求时才画（加入绘制的队列）。没有请求时，填好提示词后，请点击 **{{ui:comic.panel.draw}}**、**{{ui:comic.page.drawAll}}**、**{{ui:comic.comic.drawAll}}** 中的任意一个。请求“画出全部页面”，会把所有页面的全部分格一并加入队列。回复下方的“生成全部页面”按钮也一样。点击 **{{ui:agent.undo}}**，该回复改变的漫画页面会一起恢复原状。

### 附加图像

可以给消息附上图像，像“根据这张图像想一个提示词”这样请求。

- 用输入栏左侧的回形针按钮（**{{ui:agent.attach.add}}**），选择电脑中的图像。
- 把图库中的图像，或电脑中的图像文件，拖放到输入栏，也可以附上。
- 把复制的图像粘贴到输入栏，也可以附上。

附上的图像会排列在输入栏上方，用右上角的 × 可以移除。1 条消息最多可附 4 张。不写文字只发送图像时，相当于请求了“{{ui:agent.attach.defaultAsk}}”。从电脑附上的图像，也会进入图库。图像会与该消息一起，发送给所选的 AI（Claude、Codex、所连接的服务器）。之后的消息不会带上它，所以再次就同一张图像提出请求时，请重新附上。无法读取图像的模型，不能很好地回答。

### 读取图像和提示词的许可

图库中图像的信息（提示词和模型等），以及生成标签页的提示词栏中，可能有不想让别人看到的内容。因此，智能体想读取这些内容时，一开始会在聊天中出现“{{ui:agent.permission.title}}”的确认。要读取什么内容也会显示出来。

- **{{ui:agent.permission.once}}**：只让它读取这一次。下次想读取时，会再次出现确认。
- **{{ui:agent.permission.always}}**：今后不再确认，直接让它读取（设置会变为 **{{ui:settings.assistantRead.always}}**）。
- **{{ui:agent.permission.deny}}**：不让它读取。智能体会不读取而继续工作，或者回答需要什么。

打开漫画界面时，智能体有时会查看画完的页面的图像（在你请求时，为了确认人物的外观和气泡）。这时也会出现同样的确认，只有在你允许时，页面的图像才会发送出去。在其他界面不会查看。

是否确认，可以在设置的 **{{ui:settings.tab.generation}}** 标签页的 **{{ui:settings.section.assistant}}** 中，用 **{{ui:settings.assistantRead.label}}** 来更改（见下面的“设置”）。漫画、文本、工作流、视频、音乐、语音的界面，以及画布的姿势等，让智能体修改的界面的内容，不经确认就会读取。

### 用 Wikipedia 查资料

创作故事时（时代、服装、地点、职业、术语等），智能体可以在日语或英语的 Wikipedia 上查证事实，最多读取 3 篇文章的开头。离开电脑的只有简短的搜索词，发送目标只有 Wikipedia。发送的是应用本体，界面不会直接连接。因为搜索词会发到互联网上，所以查之前会在聊天中出现“{{ui:agent.permission.webTitle}}”的确认，要发送的搜索词也会显示。

- **{{ui:agent.permission.once}}**：只让它查这一次。下次想查时，会再次确认。
- **{{ui:agent.permission.always}}**：以后不再确认，直接让它查（设置会变为 **{{ui:settings.assistantRead.always}}**）。
- **{{ui:agent.permission.deny}}**：不让它查。智能体会在已知的范围内推进，在该次请求期间，不会再次请求。

这是另一项设置，即设置的 **{{ui:settings.tab.generation}}** 标签页的 **{{ui:settings.section.assistant}}** 中的 **{{ui:settings.assistantWeb.label}}**。即使允许读取图像，也不代表允许查资料（反过来也一样）。Wikipedia 的文章采用 CC BY-SA 4.0 许可证，所以智能体使用事实时，会告知原文章的名称。回答也可能有误，重要的事请自行确认。

### 选择模型和思考深度

点击聊天名称右侧脑形状的小按钮，可以选择智能体使用的 **{{ui:agent.model.label}}** 和 **{{ui:agent.effort.label}}**。所选内容会从下一条发送的消息开始使用。Claude 和 Codex 会分别记住各自的选择。

- Claude 的模型可以从 Fable 5.1、Opus 5.5、Sonnet 5.5、Haiku 5.5 中选择。会使用与名称相同的版本。思考深度从 **{{ui:agent.effort.low}}** 到 **{{ui:agent.effort.max}}** 共 5 级。
- Codex 的模型，可以从 Codex 表示你的账户可用的模型列表中选择（列表读取的是 Codex 保存在电脑上的内容）。思考深度只会显示所选模型接受的（也有接受到 **{{ui:agent.effort.ultra}}** 的模型）。
- 服务器会显示服务器列出的模型。也可以输入名称。没有思考深度。模型是服务器设置的一部分，所以选择其他模型后会保存下来。

尚未选择时，Claude 选中的是 Sonnet 5.5，Codex 选中的是列表中的第一个模型，按钮上也会显示该名称。始终由按钮上所显示名称的模型来回答（只有在 Codex 没有保存列表时，才会显示 **{{ui:agent.model.default}}**，由 Codex 决定模型）。思考深度始终选中其中一个。一开始选中的是各模型的标准深度，换成其他模型时，如果该模型不接受当前的深度，就会回到该模型的标准深度。

### 改变输入栏的高度

向上拖动输入栏上边缘的横条，输入栏会变高，向下拖动则变低。选中横条后按上下方向键，也可以改变。高度在下次打开时也会保持不变。

### 调用模板

在输入栏开头输入“/”，会打开常用请求的模板列表。在“/”后继续输入文字，列表会只留下名称、命令或文本中包含这些文字的模板（例如“/漫画”或“/comic”）。

用上下方向键选择，按 Enter 或 Tab 确定。点击列表中的行也可以确定。确定的模板文本会填入输入栏，请补充后续内容再发送（仅确定不会发送）。按 Esc 键关闭列表。

### 询问用法和扩展

除了让它设置，你也可以向它提问。例如“怎样去掉背景？”“在哪里添加模型？”它会用屏幕上显示的名称，告诉你该点哪里。回答使用你当前使用的语言。

也可以询问扩展。它会用通俗的话说明扩展能做什么、什么时候用、怎么用。提问方式有三种。

- 在 **{{ui:app.nav.extensions}}** 的列表中点开卡片查看详情，再点 **{{ui:agent.ask.button}}**。关于该扩展的提问会在新的聊天中发送。
- 在 **{{ui:app.nav.extensions}}** 顶部的搜索框输入文字，点出现的 **{{ui:agent.ask.resultsButton}}**。它会说明搜索到的扩展（最多前 8 个）有什么区别，以及先试哪一个。
- 在聊天中写出扩展的名称（英文字母）并提问。它会在已公开的扩展中查找名称或说明相符的扩展（如果列表尚未加载，会先加载）。

对于已安装的扩展，它还会说出扩展添加的节点名称，以及该连接到什么。对于尚未安装的扩展，回复中会附带卡片，可以直接用 **{{ui:workflows.packs.install}}** 安装。

> 说明依据的是扩展公开的介绍文字和节点信息。不知道的事它应当回答“不知道”，但也可能出错。安装前请再确认一下扩展的发布页面。

### 撤销

更改了设置或编辑的回复中，会带有 **{{ui:agent.undo}}** 按钮。点击后，因该请求而改变的设置和编辑，会一起回到请求之前。已加入生成队列的内容不会被取消（请在队列中取消）。

不过，重新打开应用之后，在此之前的更改无法恢复（按钮会无法点击）。

### 反复绘制直到相似

请求“画得像这张图像”“一边生成几张一边靠近”后，智能体会反复试画。每画 1 张，就与目标图像对比，只修改不同的地方，再画下一张。

- 即使一次回答结束，应用也会自动请求下一张。智能体停下来的情况，只有判断已经接近目标时，或连续 2 张都没有接近时。
- 最多 30 张。
- 聊天中会显示“逼近作业：第 几 / 几 张”。
- 想停止时，点击 **{{ui:agent.stop}}**，或发送新的消息。发送的消息会代替下一张发出。
- 关闭了 {{ui:settings.assistantTrial.label}} 时，这种反复不会开始。

### 确认对话的长度

在同一个聊天中，智能体会记住之前的交互来回答。附上的图像，以及智能体展示过的图像，名称也会沿用，需要时会重新查看。

- 输入栏上方，会以“约 几 / 几 个 token”显示下次发送所带的对话大小。数字只是参考。
- 同一行的“{{ui:agent.context.limit}}”开关处于打开期间（一开始就是打开的），对话快要超过 30000 个 token 时，会把旧的消息缩成每条一行的简短摘要再发送。新的消息会原样发送，摘要的条数会显示在该行。摘要只取开头的 140 个字左右，所以细微的措辞不会保留。因摘要而使智能体忘记之前的话时，请关闭开关，这样会发送对话的全部内容（太长时，可能会超出所用模型的上限）。
- 这个开关处于打开期间，智能体写入 {{ui:app.tabs.generate}} 提示词栏的提示词，也会被限制在每个栏 77 个 token（栏下方显示的数字）以内。超出的提示词应用不会接受，智能体会缩短后重写。想让它写长提示词时，请关闭开关。
- 换话题时，用 {{ui:agent.session.new}} 开始新的聊天，就不会被旧的对话牵着走。

### 聊天记录

与智能体的交互，会作为“聊天”保留下来。点击窗口上方聊天名称的部分，会打开 **{{ui:agent.session.history}}** 列表。

- 从列表中选择，可以接着该聊天继续对话。
- 用 **{{ui:agent.session.rename}}** 可以命名。
- 用 **{{ui:agent.session.delete}}** 可以删除。
- 旁边的 **{{ui:agent.session.new}}** 可以开始新的聊天。

聊天中的文字，可以拖动选中后复制。点击每条消息右下角的按钮（**{{ui:agent.copy}}**），会把该消息的文字整条复制。

> 在等待回复期间写好并发送的消息，会进入排队，当前的回复结束后自动发送。排队中的消息会显示得较淡，可以用 × 移除。回复失败时，排队中的消息会回到输入栏。想中止时，请用 **{{ui:agent.stop}}** 按钮取消。取消之前已经改变的内容会保留，可以用 **{{ui:agent.undo}}** 一并恢复原状。

右侧面板的宽度，可以拖动面板的边界来改变。在界面上方打开的窗口，拖动四条边和四个角中的任意位置，都可以改变大小。右下角会显示相应的标记。大小会被记住。当回复附带判断的过程时，会在回复上方显示为一行。点击它即可展开全部（**{{ui:agent.thoughts.label}}**）。这是 AI 对“怎样理解、为什么这样做”的简短总结，并不是 AI 内部思考的原样记录。

## 设置

![设置界面。左侧排列着标签页，右侧显示所选标签页的项目](shot:settings)

从左下角的 **{{ui:app.nav.settingsMenu}}** 中选择 **{{ui:app.nav.settings}}**，会打开设置界面。选择左侧的标签页，右侧会显示该标签页的项目。更改的内容会立即生效，关闭应用后也会保留。再次打开时，会打开上次查看的标签页。

> 这张图像是在浏览器中运行的示例界面。没有拍到仅桌面版才有的 **{{ui:settings.uiZoom.label}}**。

### {{ui:settings.tab.general}}

| 项目 | 内容 |
|---|---|
| {{ui:settings.language.label}} | 从 {{ui:settings.language.ja}}、{{ui:settings.language.en}}、{{ui:settings.language.zhcn}}、{{ui:settings.language.zhtw}}、{{ui:settings.language.ko}}、{{ui:settings.language.ru}}、{{ui:settings.language.es}}、{{ui:settings.language.ptbr}}、{{ui:settings.language.fr}}、{{ui:settings.language.de}} 中选择。界面的语言会立即切换 |
| {{ui:settings.theme.label}} | **{{ui:settings.theme.dark}}**（初始值）或 **{{ui:settings.theme.light}}** |
| {{ui:settings.uiZoom.label}} | 仅桌面版。整个界面的大小。可以从 50% 选到 300%。也可以用 `Ctrl` 和 `+` / `-` 来改变 |
| {{ui:settings.startTab.label}} | 打开应用时最先显示的标签页。一开始是 **{{ui:app.tabs.generate}}**。选择 **{{ui:settings.startTab.last}}** 后，会打开上次关闭时所在的标签页 |
| {{ui:settings.waitForEngine.label}} | 一开始是打开的，启动界面会等到图像引擎加载完成。关闭后，即使在加载途中也会打开应用。引擎的状态会显示在横幅中 |
| {{ui:settings.toastSeconds.label}} | 通知自动消失前的秒数。可以从 2 秒选到 15 秒（一开始是 3.5 秒） |

### {{ui:settings.tab.generation}}

- **{{ui:settings.antialiasProgressImages}}**：把生成中途的图像，在图库的“{{ui:gallery.generating.title}}”框里平滑地显示。关闭时，会以粗糙的点阵显示。
- **{{ui:settings.draftCount.label}}**：打开草稿界面时张数的初始值（1～24 张。一开始是 4 张）。也可以在界面上随时更改。
- **{{ui:settings.draftPosition.label}}**：打开草稿界面时位置的初始值（25～60 %。一开始是 35 %）。
- **{{ui:settings.lowMemory.label}}**：适用于 GPU 显存较小的电脑。开启后，模型不会一直留在 GPU 显存中，因此用较少的显存就能生成，但速度会变慢。切换时会重启引擎。有正在生成的项目时，将在下次启动引擎时生效。连接到在别处启动的引擎时无法使用。
- **{{ui:settings.assistantRead.label}}**（**{{ui:settings.section.assistant}}**）：智能体是否可以读取图库中图像的信息和生成标签页的提示词。从 **{{ui:settings.assistantRead.ask}}**（初始值）、**{{ui:settings.assistantRead.always}}**、**{{ui:settings.assistantRead.never}}** 中选择。
- **{{ui:settings.assistantWeb.label}}**（**{{ui:settings.section.assistant}}**）：智能体是否可以在 Wikipedia 上查证事实。选择方式相同，与读取图像是分开的设置。
- **{{ui:settings.assistantTrial.label}}**（**{{ui:settings.section.assistant}}**）：请求的意图不易理解时，智能体是否可以自己试着只生成 1 张。一开始是打开的。

### {{ui:settings.tab.gallery}}

- **{{ui:gallery.settings.thumbnailSize}}**、**{{ui:gallery.settings.sort}}**、**{{ui:gallery.settings.starredFirst}}**、**{{ui:gallery.settings.groupByDate}}**、**{{ui:gallery.settings.alwaysShowSize}}**、**{{ui:gallery.settings.showArchived}}**、**{{ui:gallery.settings.autoSwitch}}**、**{{ui:gallery.settings.autoAssign}}**：与点击图库的齿轮按钮打开的 **{{ui:gallery.settings.title}}** 相同的项目。在哪里更改，效果都一样。
- **{{ui:settings.confirmOnDelete}}**：删除图像之前，显示确认。在确认界面中选择“{{ui:common.dontAskAgain}}”时，这里也会变为关闭。
- **{{ui:settings.clearIntermediates}}**：删除画布的中途结果等不会出现在图库中的图像。要删除的数量会显示在按钮上。

### {{ui:settings.tab.edit}}

- **{{ui:settings.undoLimit.label}}**：在画布、漫画、文本、工作流的编辑中，可以撤销的操作数量。可以从 10 选到 200（一开始是 60）。数量越多，占用的内存越多。

### {{ui:settings.tab.comicText}}

- **{{ui:settings.comicFont.label}}**：用于没有选择字体的气泡文字的字体。可以从应用的字体和这台电脑上已安装的字体中选择。**{{ui:common.font.standard}}** 是应用的标准文字。
- **{{ui:settings.textFont.label}}**：在文本界面中新添加的文字所用的字体。选择方式与气泡的字体相同。
- **{{ui:settings.section.comicPage}}**：决定新建的漫画，以及之后添加的页面的 **{{ui:comic.page.size}}**、**{{ui:comic.page.direction}}**、**{{ui:settings.comicPage.panels}}**（1 到 6）、**{{ui:comic.page.frameWidth}}**、**{{ui:comic.page.margin}}**。现有的页面不会改变。

### {{ui:settings.tab.engine}}

应用存放数据的位置，以及图像引擎（ComfyUI）的启动方式。在这里更改的内容，会从下次启动应用时开始生效（上方会显示这一点）。

| 项目 | 内容 |
|---|---|
| {{ui:settings.engine.dataDir.label}} | 存放生成的图像、模型、图像引擎等的文件夹。一开始是用户文件夹中的 `novira-data`。点击 **{{ui:settings.engine.dataDir.change}}** 后，首先选择当前数据的处理方式。**{{ui:settings.engine.dataDir.dialog.move}}** 会把当前的数据移到所选的文件夹。即使文件夹里有其他东西，只要没有同名的就可以移动（在下次启动的最开始进行，所以量大时会花费时间）。**{{ui:settings.engine.dataDir.dialog.use}}** 不移动数据，而是打开所选的文件夹（有数据就用它，是空的就重新开始）。之后会打开选择文件夹的窗口，所选的位置会从下次启动起使用。可以用 **{{ui:settings.engine.dataDir.cancel}}** 取消。移动失败时，会显示原因，并仍用当前的文件夹启动。用环境变量 `NOVIRA_DATA_DIR` 指定时，无法在这里更改 |
| {{ui:settings.engine.comfyui.label}} | 正在使用的 ComfyUI。通常位于数据文件夹中的 `comfyui`，会显示该位置。在设置文件中指定了其他 ComfyUI 时，会显示那个位置。用 **{{ui:settings.engine.comfyui.change}}** 可以更改应用所安装的 ComfyUI 的存放位置。所选文件夹是空的话，下次启动时会重新安装（这是很大的下载）。如果是已经安装过的文件夹，就直接使用。旧位置的文件不会自动删除。要放回数据文件夹中时，请选择其中的 `comfyui` |
| {{ui:settings.engine.package.label}} | **{{ui:settings.engine.package.nvidia}}** 或 **{{ui:settings.engine.package.amd}}**。下次下载 ComfyUI 时（第一次安装或切换版本）会使用。ComfyUI 已安装时选择其他类型，会出现确认。确认后，下次启动 novira 时，会按所选的类型重新安装 ComfyUI（下载很大，需要花费时间） |
| {{ui:settings.engine.timeout.label}} | 启动 ComfyUI 后等待其响应的秒数。可以从 30 秒选到 1800 秒。电脑较慢时请调长 |
| {{ui:settings.engine.modelRoots.label}} | 除了数据文件夹的 models 之外，用来查找模型的文件夹。点击 **{{ui:settings.engine.modelRoots.add}}** 会打开选择文件夹的窗口。能识别 ComfyUI 和 Stability Matrix 的文件夹结构。视频、音乐、语音、擦除的追加模型也会从这里找到（只读取，新安装时总是放入数据文件夹）。最多可以添加 16 个。无法添加数据文件夹中的，以及已有的文件夹。用 × 按钮移除。在浏览器中打开时，无法添加，只能移除 |

### {{ui:settings.tab.accounts}}

这是为模型的分发网站需要登录时准备的栏。填入的内容会加密保存在这台电脑上，不会显示在界面中。

| 项目 | 内容 |
|---|---|
| {{ui:settings.civitaiKey.label}} | 用于下载需要登录的模型 |
| {{ui:settings.hfToken.label}} | 用于下载需要申请访问权限的模型 |

粘贴后点击 **{{ui:settings.civitaiKey.save}}**。之后也可以 **{{ui:settings.civitaiKey.change}}** 或 **{{ui:settings.civitaiKey.remove}}**。

### {{ui:settings.tab.data}}

#### {{ui:share.backup.section}}

![设置界面的备份栏。创建备份的按钮和从备份恢复的按钮](shot:settings-backup)

可以将制作的图像，以及在应用中设置、登记的内容，打包保存为一个 zip 文件。用于搬到另一台电脑，或以防万一。

- **{{ui:share.backup.createLabel}}**：会打开选择保存位置的窗口。文件名一开始就是“novira-backup-日期-时间.zip”。图像较多时需要一些时间，进度会显示在这一栏。
- **{{ui:share.backup.restoreLabel}}**：选择备份的 zip 文件。检查内容后，会出现确认窗口。

备份中包含和不包含的内容如下。

| 包含 | 不包含 |
|---|---|
| 图库的图像、视频、音频及其缩略图 | 模型 |
| 画板、工作流、漫画、队列的记录 | 图像引擎（ComfyUI）和扩展 |
| 角色、预设、提示词列表、草稿、AI 的聊天、界面设置 | API 密钥和令牌、ComfyUI 的位置等每台电脑各自的设置 |

![恢复的确认窗口。显示备份的创建日期时间、内容的数量和替换的注意事项](shot:restore-confirm)

确认窗口中会显示备份的创建日期时间，以及其中图像、画板、工作流的数量。点击 **{{ui:share.backup.confirm}}** 后，应用会先结束再重新启动，当前的数据会被替换为备份的内容。失败时会恢复原来的数据，并告知这一情况。

> 被替换的数据无法还原。如有需要，请在恢复之前先创建当前状态的备份。API 密钥和令牌仅为这台电脑加密，因此恢复后请在 **{{ui:settings.tab.accounts}}** 中重新输入。在浏览器中打开时，无法创建备份，也无法恢复。请使用桌面应用。

#### {{ui:settings.section.unfinished}}

下载中途停止时，写到一半的文件会留在数据文件夹中。在这一栏中，可以查看留下的文件的名称、所在的文件夹和大小。用 **{{ui:settings.unfinished.delete}}** 可以逐个删除，用 **{{ui:settings.unfinished.deleteAll}}** 可以全部删除（点击后，会先要求确认）。留下的文件，在下次开始同一个下载时会接着使用。删除后，该下载会从头重新获取。正在使用的文件不会被删除，会保留。

#### {{ui:settings.section.reset}}

用 **{{ui:settings.reset.scope.label}}** 选择恢复的范围，点击 **{{ui:settings.resetWebUi}}** 后，再次点击 **{{ui:settings.resetConfirm}}** 来确定。图像、模型、漫画、画布不会被删除。

设置、预设、草稿、历史等界面的状态，保存在数据文件夹中。只要使用同一个数据文件夹，用桌面应用打开和用浏览器打开时，内容就是相同的。两者无法同时打开，所以连续使用时会延续下来。重置也会反映到两边。

| 范围 | 恢复为初始值的内容 |
|---|---|
| {{ui:settings.reset.scope.settings}} | 设置界面的项目。会立即恢复 |
| {{ui:settings.reset.scope.generation}} | 生成界面的提示词、模型、各参数 |
| {{ui:settings.reset.scope.gallery}} | 图库的显示（缩略图的大小、排列顺序等） |
| {{ui:settings.reset.scope.assistant}} | 与智能体的对话。会全部消失 |
| {{ui:settings.reset.scope.all}} | 浏览器中保存的全部设置和界面状态。预设、角色、提示词列表、智能体的对话也会消失 |

除“{{ui:settings.reset.scope.settings}}”之外，确定后点击出现的 **{{ui:settings.reload}}** 重新加载，才会生效。

### {{ui:settings.tab.developer}}

- **{{ui:settings.showDevLog}}**：在左侧导航中显示{{ui:app.devlog.short}}按钮（参见下文的“开发者日志”）。

## 快捷键

![快捷键列表。按应用、画布等分类，排列着操作和按键](shot:hotkeys)

从左下角的 **{{ui:app.nav.settingsMenu}}** 中选择 **{{ui:app.nav.hotkeys}}**，或按 `Shift+?`，会打开列表。用上方的搜索栏，可以按操作名称或按键来查找。

这里汇总常用的。全部内容请在界面的列表中确认。

### 整个应用

| 按键 | 操作 |
|---|---|
| `Ctrl+Enter` | 生成（添加到队列） |
| `Ctrl+Shift+Enter` | 添加到队列最前面并生成 |
| `Shift+X` | 取消处理中的项目 |
| `Ctrl+Shift+X` | 清除全部队列 |
| `Alt+A` | 移到提示词栏 |
| `T` | 展开、收起左侧面板 |
| `G` | 展开、收起右侧面板（图库和智能体） |
| `F` | 同时展开、收起左右面板 |
| `1` 〜 `9` | 移到对应编号的标签页 |
| `Shift+?` | 打开快捷键列表 |
| `Ctrl` + `+` / `-` | 放大、缩小整个界面 |

### 画布

| 按键 | 操作 |
|---|---|
| `B` | {{ui:settings.hotkeys.canvas.brush}} |
| `E` | {{ui:settings.hotkeys.canvas.eraser}} |
| `U` | {{ui:settings.hotkeys.canvas.rect}} |
| `V` | {{ui:settings.hotkeys.canvas.move}} |
| `C` | {{ui:settings.hotkeys.canvas.bbox}} |
| `H` | 平移显示 |
| `I` | {{ui:settings.hotkeys.canvas.colorPicker}} |
| `[` / `]` | 缩小、放大画笔 |
| `Ctrl+Z` | {{ui:settings.hotkeys.canvas.undo}} |
| `Ctrl+Shift+Z`、`Ctrl+Y` | {{ui:settings.hotkeys.canvas.redo}} |
| `Q` | 与上一次使用的工具切换 |
| `Enter`、`Esc` | {{ui:settings.hotkeys.canvas.acceptStaged}}、{{ui:settings.hotkeys.canvas.discardStaged}} |

### 图库与查看器

| 按键 | 操作 |
|---|---|
| 方向键 | {{ui:settings.hotkeys.gallery.navigate}} |
| `Ctrl+A` | {{ui:settings.hotkeys.gallery.selectAll}} |
| `Esc` | {{ui:settings.hotkeys.gallery.clearSelection}} |
| `.` | {{ui:settings.hotkeys.gallery.star}} |
| `I` | {{ui:settings.hotkeys.viewer.toggleMetadata}} |
| `R` | {{ui:settings.hotkeys.viewer.remix}}（载入除种子之外的内容） |
| `P`、`S`、`A` | 载入提示词、种子、全部 |
| `W` | {{ui:settings.hotkeys.viewer.loadWorkflow}} |
| `Shift+U` | {{ui:settings.hotkeys.viewer.upscale}} |
| `C` | {{ui:settings.hotkeys.viewer.compare}} |
| `Delete` | {{ui:settings.hotkeys.viewer.delete}} |
| `Ctrl+0`、`Ctrl+1` | {{ui:settings.hotkeys.viewer.zoomFit}}、{{ui:settings.hotkeys.viewer.zoomActual}} |

### 工作流

| 按键 | 操作 |
|---|---|
| `Shift+A`、`Space` | {{ui:settings.hotkeys.workflows.addNode}} |
| `Delete` | 删除所选节点和连接 |
| `Ctrl+C`、`Ctrl+V` | {{ui:settings.hotkeys.workflows.copy}}、{{ui:settings.hotkeys.workflows.paste}} |
| `Ctrl+S` | {{ui:settings.hotkeys.workflows.save}} |
| `Ctrl+Z`、`Ctrl+Shift+Z` | {{ui:settings.hotkeys.workflows.undo}}、{{ui:settings.hotkeys.workflows.redo}} |

在输入文字的过程中，`T` 和 `G` 等单个字母的按键不起作用。

## 关于本应用

![应用信息界面。徽标、版本、许可证以及所使用的开源软件列表](shot:about)

从左下角的 **{{ui:app.nav.settingsMenu}}** 选择 **{{ui:app.nav.about}}**，顶部会显示应用名称、版本、许可证和版权信息。下方分为两个选项卡。

- **{{ui:settings.about.license.title}}**：novira 许可证（Apache License 2.0）的全文。安装文件夹中也有同一文件（`LICENSE`）。
- **{{ui:settings.about.oss.title}}**：应用使用的开源软件列表。每行显示名称和版本。点击 **{{ui:settings.about.oss.showLicense}}** 会在该行下方显示许可证全文（再次点击即可关闭）。点击 **{{ui:settings.about.oss.homepage}}** 会在浏览器中打开其页面。生成引擎和扩展未随应用附带，请在其主页查看许可证全文。

列表上方的按钮可筛选为 **{{ui:settings.about.oss.short.frontend}}**、**{{ui:settings.about.oss.short.backend}}**、**{{ui:settings.about.oss.short.engine}}** 或 **{{ui:settings.about.oss.short.packs}}**（当前已安装的扩展）。搜索框可按名称查找。随附软件的许可证全文也汇总在安装文件夹的 `THIRD_PARTY_NOTICES.txt` 中。

扩展（ComfyUI 的自定义节点）和模型在安装时遵循各自发布方的许可证。

## 开发者日志

这是在出现问题时，用来查找原因的日志。平时不用也没有关系。

打开 **{{ui:settings.title}}** 中的 **{{ui:settings.showDevLog}}**，左侧导航中会出现“{{ui:app.devlog.short}}”按钮。点击后，右侧会打开 **{{ui:app.devlog.title}}** 面板。

这里会带着时间，排列应用内部的记录（后端日志）、界面的警告，以及未能捕获的错误。

- 用上方的选项，可以筛选为 **{{ui:app.devlog.level.all}}**、**{{ui:app.devlog.level.warn}}**、**{{ui:app.devlog.level.error}}**。
- 在筛选栏中填入文字，只会显示包含该文字的行。
- 用 **{{ui:app.devlog.copy}}** 可以把显示的行作为文本复制。报告问题时，可以粘贴使用。
- 用 **{{ui:app.devlog.clear}}** 可以清除。

> 日志是打开应用期间的记录。关闭后，界面上的日志会消失。详细的排查方法请看 [遇到问题时](10-troubleshooting.md)。
