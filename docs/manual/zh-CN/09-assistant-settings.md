# AI 助手、设置、快捷键

本章介绍：只需用文字描述就能帮你调整设置的 AI 助手、设置界面、快捷键列表、应用信息界面，以及开发者日志。

设置界面、快捷键和应用信息，都从屏幕左下角的 **{{ui:app.nav.settingsMenu}}** 中打开。

## AI 助手

![AI 助手的窗口。选择要使用的 AI 并登录的初始界面](shot:agent)

点击左侧导航的 **AI** 按钮（**{{ui:agent.open}}**），会打开 **{{ui:agent.title}}** 窗口。窗口可以拖动标题来移动。

你不必自己选择模型和 LoRA、设置提示词和尺寸，只要像“站在夕阳海边的动漫风格少女”这样，用文字描述想生成的内容，助手就会选好设置并填入。

### 开始使用（登录）

AI 助手并不是由 novira 自己运行 AI，而是调用你电脑上的 AI 命令（Claude 或 Codex）来生成回答。使用时，需要做下面的准备。

1. 在电脑上安装 Anthropic 的 **Claude** 或 OpenAI 的 **Codex** 中任意一个的命令。
2. 打开助手，点击想使用的那个（**{{ui:agent.setup.claude}}** 或 **{{ui:agent.setup.codex}}**）。
3. 会打开浏览器，在那里登录。

在电脑上找不到该命令时，会出现“在这台电脑上找不到 ○○ 的命令。请先安装。”的提示。请先安装该命令。

所使用的服务及其合同，属于你所选的一方。novira 不保存 API 密钥。交互的内容（发送的文字、当前的模型列表和设置等），会发送到你所选的服务。

选中的 AI 会显示在窗口上方的标题处。想更换时，点击上方的 **{{ui:agent.changeProvider}}** 按钮。

### 能做什么

助手会根据你的文字决定下面这些内容，并填入设置。填入的内容，会以列表形式显示在回复中。

| 内容 | 示例 |
|---|---|
| 选择模型 | 从已安装的模型中，选择合适的 |
| 添加 LoRA | 添加与画风相符的 LoRA |
| 提示词 | 书写提示词和反向提示词 |
| 更改设置 | 尺寸、步数、CFG、调度器、种子 |
| 工作流 | 创建图，修改已打开的图 |
| 文本 | 修改在 **{{ui:media.tab.text}}** 中打开的文字和对话气泡 |
| 视频、音乐、语音 | 更改各自界面的设置 |
| 漫画 | 在 **{{ui:app.tabs.comic}}** 中，更改分格布局、添加和切割分格，以及各分格的提示词、姿势和气泡（见下面的“让助手帮忙画漫画”） |
| 姿势 | 在 **{{ui:app.tabs.canvas}}** 中，放置按文字要求的姿势的火柴人（请参阅 [在画布上补画](05-canvas.md#在画布上制作姿势)） |
| 推荐扩展 | 指引适合想做的事的扩展，并可以通过按钮安装 |
| 应用的用法 | 用屏幕上的名称，告诉你该点哪里 |
| 讲解扩展 | 说明扩展能做什么、怎么用（见下面的“询问用法和扩展”） |

助手能看到你打开的是哪个界面。例如，打开 **{{ui:media.tab.text}}** 并告诉它“把文字改成竖排”，那段文字就会改变。

助手只会更改设置，不会生成图像。看了结果觉得不错的话，点击回复中的 **{{ui:agent.generate}}**，就会直接开始生成。

### 让助手帮忙画漫画

在打开 **{{ui:app.tabs.comic}}** 的状态下提出请求，助手会读取当前打开的页面（分格的形状、各分格的提示词、姿势、气泡），并直接改写。例如，可以这样请求。

- 请求“做成有高潮的 5 格。第 1 格大一些，斜着切”，它会制作分格布局。它可能使用标准模板，也可能自己决定分格的形状。
- 请求“按这个故事写出各分格的提示词”，它会为每个分格写出提示词，并加入符合故事发展的构图（特写、远景、仰视等）。
- 请求“给各分格加上台词”，它会放置气泡并填入台词。
- 请求“把第 2 格的女孩改成奔跑的姿势”，它会为该分格设定姿势。

它不会画出图像本身。填好提示词后，请点击 **{{ui:comic.panel.draw}}** 或 **{{ui:comic.page.drawAll}}**。点击 **{{ui:agent.undo}}**，该回复改变的漫画页面会一起恢复原状。

### 选择模型和思考深度

点击聊天名称右侧脑形状的小按钮，可以选择助手使用的 **{{ui:agent.model.label}}** 和 **{{ui:agent.effort.label}}**。所选内容会从下一条发送的消息开始使用。Claude 和 Codex 会分别记住各自的选择。

- Claude 的模型可以从 **{{ui:agent.model.default}}**、Fable、Opus、Sonnet、Haiku 中选择。点击 **{{ui:agent.model.custom}}**，可以直接输入模型名称。思考深度从 **{{ui:agent.effort.low}}** 到 **{{ui:agent.effort.max}}** 共 5 级。
- Codex 的模型无法选择（遵循该命令自身的设置）。思考深度为 **{{ui:agent.effort.low}}**、**{{ui:agent.effort.medium}}**、**{{ui:agent.effort.high}}**。

选择 **{{ui:agent.model.default}}** 时，遵循该命令自身的设置。

### 调用模板

在输入框开头输入“/”，会打开常用请求的模板列表。在“/”后继续输入文字，列表会只留下名称、命令或文本中包含这些文字的模板（例如“/漫画”或“/comic”）。

用上下方向键选择，按 Enter 或 Tab 确定。点击列表中的行也可以确定。确定的模板文本会填入输入框，请补充后续内容再发送（仅确定不会发送）。按 Esc 键关闭列表。

### 询问用法和扩展

除了让它设置，你也可以向它提问。例如“怎样去掉背景？”“在哪里添加模型？”它会用屏幕上显示的名称，告诉你该点哪里。回答使用你当前使用的语言。

也可以询问扩展。它会用通俗的话说明扩展能做什么、什么时候用、怎么用。提问方式有三种：

- 在 **{{ui:app.nav.extensions}}** 的列表中点开卡片查看详情，再点 **{{ui:agent.ask.button}}**。关于该扩展的提问会在新的聊天中发送。
- 在 **{{ui:app.nav.extensions}}** 顶部的搜索框输入文字，点出现的 **{{ui:agent.ask.resultsButton}}**。它会说明搜索到的扩展（最多前 8 个）有什么区别，以及先试哪一个。
- 在聊天中写出扩展的名称（英文字母）并提问。它会在已公开的扩展中查找名称或说明相符的扩展（如果列表尚未加载，会先加载）。

对于已安装的扩展，它还会说出扩展添加的节点名称，以及该连接到什么。对于尚未安装的扩展，回复中会附带卡片，可以直接用 **{{ui:workflows.packs.install}}** 安装。

> 说明依据的是扩展公开的介绍文字和节点信息。不知道的事它应当回答“不知道”，但也可能出错。安装前请再确认一下扩展的发布页面。

### 撤销

填入了设置的回复中，会带有 **{{ui:agent.undo}}** 按钮。点击后，会回到该回复之前的设置。

不过，重新打开应用之后，在此之前的更改无法恢复（按钮会无法点击）。

### 聊天记录

与助手的交互，会作为“聊天”保留下来。点击窗口上方聊天名称的部分，会打开 **{{ui:agent.session.history}}** 列表。

- 从列表中选择，可以接着该聊天继续对话。
- 用 **{{ui:agent.session.rename}}** 可以命名。
- 用 **{{ui:agent.session.delete}}** 可以删除。
- 旁边的 **{{ui:agent.session.new}}** 可以开始新的聊天。

> 在等待回复期间，无法继续发送。请等到“{{ui:agent.thinking}}”的显示消失，或用代替发送按钮出现的 **{{ui:agent.stop}}** 按钮取消。已取消的请求不会改变任何设置。

拖动窗口的四条边和四个角中的任意位置，都可以改变窗口大小。右下角会显示相应的标记。大小会被记住。当回复附带 AI 对你请求的理解过程时，会在回复上方显示为一行。点击它即可展开全部（**{{ui:agent.thoughts.label}}**）。这是 AI 对“怎样理解请求、为什么这样选择”的简短总结，并不是它内部思考的原样记录。

## 设置

![设置界面。排列着常规、账户、生成、界面、开发者等项目](shot:settings)

从左下角的 **{{ui:app.nav.settingsMenu}}** 中选择 **{{ui:app.nav.settings}}**，会打开设置界面。更改的内容会立即生效，关闭应用后也会保留。

> 这张图像是在浏览器中运行的示例界面。没有拍到仅桌面版才有的 **{{ui:settings.uiZoom.label}}**。

### {{ui:settings.section.general}}

| 项目 | 内容 |
|---|---|
| {{ui:settings.language.label}} | 从 {{ui:settings.language.ja}}、{{ui:settings.language.en}}、{{ui:settings.language.zhcn}}、{{ui:settings.language.zhtw}}、{{ui:settings.language.ko}}、{{ui:settings.language.ru}}、{{ui:settings.language.es}}、{{ui:settings.language.ptbr}}、{{ui:settings.language.fr}}、{{ui:settings.language.de}} 中选择。界面的语言会立即切换 |
| {{ui:settings.theme.label}} | **{{ui:settings.theme.dark}}**（初始值）或 **{{ui:settings.theme.light}}** |

### {{ui:settings.section.accounts}}

这是为模型的分发网站需要登录时准备的栏。填入的内容会加密保存在这台电脑上，不会显示在界面中。

| 项目 | 内容 |
|---|---|
| {{ui:settings.civitaiKey.label}} | 用于下载需要登录的模型 |
| {{ui:settings.hfToken.label}} | 用于下载需要申请访问权限的模型 |

粘贴后点击 **{{ui:settings.civitaiKey.save}}**。之后也可以 **{{ui:settings.civitaiKey.change}}** 或 **{{ui:settings.civitaiKey.remove}}**。

### {{ui:settings.section.generation}}

- **{{ui:settings.antialiasProgressImages}}**：把生成中途的图像，在图库的“{{ui:gallery.generating.title}}”框里平滑地显示。关闭时，会以粗糙的点阵显示。
- **{{ui:settings.lowMemory.label}}**：适用于 GPU 显存较小的电脑。开启后，模型不会一直留在 GPU 显存中，因此用较少的显存就能生成，但速度会变慢。切换时会重启引擎。有正在生成的项目时，将在下次启动引擎时生效。连接到在别处启动的引擎时无法使用。

### {{ui:settings.section.ui}}

- **{{ui:settings.uiZoom.label}}**（仅桌面版）：整个界面的大小。可以从 50% 选到 300%。也可以用 `Ctrl` 和 `+` / `-` 来改变。
- **{{ui:settings.confirmOnDelete}}**：删除图像之前，显示确认。在确认界面中选择“{{ui:common.dontAskAgain}}”时，这里也会变为关闭。

### {{ui:share.backup.section}}

![设置界面的备份栏。创建备份的按钮和从备份恢复的按钮](shot:settings-backup)

可以将制作的图像，以及在应用中设置、登记的内容，打包保存为一个 zip 文件。用于搬到另一台电脑，或以防万一。

- **{{ui:share.backup.create}}**：会打开选择保存位置的窗口。文件名一开始就是“novira-backup-日期-时间.zip”。图像较多时需要一些时间，进度会显示在这一栏。
- **{{ui:share.backup.restore}}**：选择备份的 zip 文件。检查内容后，会出现确认窗口。

备份中包含和不包含的内容如下。

| 包含 | 不包含 |
|---|---|
| 图库的图像、视频、音频及其缩略图 | 模型 |
| 画板、工作流、漫画、队列的记录 | 图像引擎（ComfyUI）和扩展 |
| 角色、预设、提示词列表、草稿、AI 的聊天、界面设置 | API 密钥和令牌、ComfyUI 的位置等每台电脑各自的设置 |

![恢复的确认窗口。显示备份的创建日期时间、内容的数量和替换的注意事项](shot:restore-confirm)

确认窗口中会显示备份的创建日期时间，以及其中图像、画板、工作流的数量。点击 **{{ui:share.backup.confirm}}** 后，应用会先结束再重新启动，当前的数据会被替换为备份的内容。失败时会恢复原来的数据，并告知这一情况。

> 被替换的数据无法还原。如有需要，请在恢复之前先创建当前状态的备份。API 密钥和令牌仅为这台电脑加密，因此恢复后请在 **{{ui:settings.section.accounts}}** 中重新输入。在浏览器中打开时，会下载不含图像的 JSON 文件，并且无法恢复。

### {{ui:settings.section.developer}}

- **{{ui:settings.showDevLog}}**：在左侧导航中显示{{ui:app.devlog.short}}按钮（参见下文的“开发者日志”）。
- **{{ui:settings.clearIntermediates}}**：删除画布的中途结果等不会出现在图库中的图像。要删除的数量会显示在按钮上。
- **{{ui:settings.resetWebUi}}**：把界面的设置和状态恢复为初始值。图像和模型不会被删除。点击后，用 **{{ui:settings.resetConfirm}}** 确认，再用 **{{ui:settings.reload}}** 重新加载。

设置界面中，此外还有“{{ui:settings.useCpuNoise}}”“{{ui:settings.enableInformationalPopovers}}”“{{ui:settings.enableImageDebugging}}”“{{ui:settings.clearIntermediatesOnStartup}}”的开关。它们在当前版本中，不会改变生成或界面的行为。

界面的最下方，会显示应用的版本。

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
| `G` | 展开、收起右侧面板 |
| `F` | 同时展开、收起左右面板 |
| `1` 〜 `9`、`0` | 移到对应编号的标签页 |
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

扩展功能（ComfyUI 的自定义节点）和模型在安装时遵循各自发布方的许可证。

## 开发者日志

这是在出现问题时，用来查找原因的日志。平时不用也没有关系。

打开 **{{ui:settings.title}}** 中的 **{{ui:settings.showDevLog}}**，左侧导航中会出现“{{ui:app.devlog.short}}”按钮。点击后，右侧会打开 **{{ui:app.devlog.title}}** 面板。

这里会带着时间，排列应用内部的记录（后端日志）、界面的警告，以及未能捕获的错误。

- 用上方的选项，可以筛选为 **{{ui:app.devlog.level.all}}**、**{{ui:app.devlog.level.warn}}**、**{{ui:app.devlog.level.error}}**。
- 在筛选栏中填入文字，只会显示包含该文字的行。
- 用 **{{ui:app.devlog.copy}}** 可以把显示的行作为文本复制。报告问题时，可以粘贴使用。
- 用 **{{ui:app.devlog.clear}}** 可以清除。

> 日志是打开应用期间的记录。关闭后，界面上的日志会消失。详细的排查方法请看 [遇到问题时](10-troubleshooting.md)。
