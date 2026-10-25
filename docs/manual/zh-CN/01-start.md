# 开始之前

## novira 能做什么

novira 是一款 Windows 桌面应用，可以生成图像、视频、音乐和语音。
写下提示词（对想要生成内容的描述），点击 **{{ui:params.invoke.invoke}}** 按钮，图像就会在你的电脑里绘制出来，并排列在右侧的图库中。
界面布局和操作方式参考了图像生成工具 InvokeAI 的界面。用过 InvokeAI 的话，可以用同样的方式上手。

大致能做的事情如下。

- 用文字生成图像（本手册的重点）
- 以图像为基础重新生成、只重绘局部、放大
- 生成视频、音乐、语音、Logo 和带文字的图像
- 向 AI 助手咨询设置和提示词

> 绘图处理在你自己的电脑里完成。搜索和下载模型、AI 助手等需要联网的功能，只有在你选择使用时才会通信。

## 图像是如何生成的

novira 由下面 4 个部分组成。

| 部分 | 作用 |
|---|---|
| novira（本应用） | 界面、图库、排队（队列）、模型管理 |
| 图像生成引擎（ComfyUI） | 实际绘图的部分。由 novira 自行安装、自行启动并运行 |
| 模型 | 用来绘图的学习数据。每个是数 GB 的文件，需要与引擎分开另行准备 |
| 数据文件夹 | 存放生成的图像、模型、引擎本体等的位置 |

引擎不需要用户自己安装。首次启动时，novira 会自动安装。
引擎及其组件（Python 等）只会放在 novira 的数据文件夹中。不会改动电脑上的其他位置，也不会改动已有的 Python。

数据文件夹的名称是 `novira-data`，位于应用的文件夹中。要移动或备份图像和模型时，就使用这个文件夹。

> 生成图像需要用到 GPU（显卡）。默认会安装面向 NVIDIA 显卡的引擎。

模型决定了“用什么画风来画”。最开始需要有 1 个模型。安装方法在 [准备模型](08-models.md) 中介绍。

## 首次启动

打开应用后，首先会出现启动画面（Logo和缓缓漂浮的图像气泡）。
启动画面下方会出现一张卡片，显示当前正在做什么。

首次启动时，会开始安装图像生成引擎。卡片上会依次显示 3 个阶段。

1. **{{ui:splash.step.downloading}}**：下载 ComfyUI 和 Python。同时会显示大小、速度和预计剩余时间。
2. **{{ui:splash.step.extracting}}**：解压下载的文件。
3. **{{ui:splash.step.starting}}**：启动引擎，并等待连接成功。

> {{ui:engine.firstRunNote}}

安装只需要一次。从第二次起，启动画面几秒钟就会结束，引擎也会马上开始运行。

引擎准备好后，启动画面会消失，主界面随即打开。
正在读取数据时会显示“{{ui:splash.wait.heading.loading}}”，正在等待读取引擎和编辑所需的信息时会显示“{{ui:splash.wait.heading.preparing}}”。

### 屏幕上方出现的消息

打开应用后，如果引擎重新启动或重新安装，屏幕上方正中会出现一条横幅，告知当前状况。

- “{{ui:engine.title.downloading}}”“{{ui:engine.title.extracting}}”“{{ui:engine.title.starting}}”：正在处理中。在完成之前无法开始生成。完成后横幅会自动消失。
- “{{ui:engine.title.error}}”：引擎没能准备好。原因会显示在横幅下面一行。

启动画面出现错误时，原因下方会出现 **{{ui:splash.open}}** 按钮。点击后，可以在没有引擎的情况下打开应用。可以查看模型和进行设置，但无法生成图像。
错误持续出现时，请参阅 [遇到问题时](10-troubleshooting.md)。

## 认识界面

![生成标签页的整体。左侧是参数面板，中央是开始画面，右侧并排着画板和图库](shot:generate)

界面从左到右依次排列如下。

- 最左侧的细竖条：**侧边导航**。用来切换标签页。
- 左侧面板：**参数面板**。里面有提示词、模型等用于生成图像的设置。
- 中央：**主视图**。开始画面、图像查看器、画布等，是与各标签页对应的工作区域。
- 右侧面板：**图库**。排列着画板（类似文件夹的东西）和生成图像的缩略图。

### 侧边导航（标签页）

| 标签页 | 用途 | 数字键 |
|---|---|---|
| **{{ui:app.tabs.generate}}** | 生成图像。通过上方的图标，还可以切换到视频、音乐、语音、Logo、文本和漫画 | `1` |
| **{{ui:app.tabs.canvas}}** | 摆放图像，补画或只重绘局部 | `2` |
| **{{ui:app.tabs.comic}}** | 制作漫画页面：分格排列、每个分格的图像、气泡与旁白。也可以通过{{ui:app.tabs.generate}}标签页上方图标最右侧的图标打开 | `3` |
| **{{ui:app.tabs.upscaling}}** | 放大图像的同时补画细节 | `4` |
| **{{ui:app.tabs.workflows}}** | 连接各个部件（节点），制作属于自己的生成流程 | `5` |
| **{{ui:app.tabs.models}}** | 已有模型的列表、安装和删除 | `6` |
| **{{ui:app.tabs.browse}}** | 搜索并导入网络上的模型 | `7` |
| **{{ui:app.tabs.queue}}** | 查看或停止生成队列。等待的数量会以徽标显示 | `8` |
| **{{ui:app.nav.extensions}}** | 查找 ComfyUI 扩展，并安装或删除 | `0` |

侧边导航的下方还有以下内容。

- **{{ui:app.tabs.short.agent}}**：在当前画面上方打开 AI 助手窗口。
- **{{ui:app.nav.settings}}**：从菜单中打开{{ui:app.nav.settings}}、{{ui:app.nav.hotkeys}}、{{ui:app.nav.about}}。
- 最上方的“n”Logo：打开{{ui:app.nav.about}}。

各部分的用法将在后面的章节中介绍。

- {{ui:app.tabs.generate}}、{{ui:app.tabs.queue}}：[生成图像](02-generate.md)
- 图库、查看器：[图库与查看器](03-gallery.md)
- {{ui:app.tabs.canvas}}：[在画布上补画](05-canvas.md)
- {{ui:app.tabs.comic}}：[绘制漫画](12-comic.md)
- {{ui:app.tabs.upscaling}}、{{ui:app.tabs.workflows}}：[放大与工作流](06-upscaling-workflows.md)
- 视频、音乐、语音等：[视频、音乐、语音、Logo、文本](07-media.md)
- {{ui:app.tabs.models}}、{{ui:app.tabs.browse}}：[准备模型](08-models.md)
- {{ui:app.tabs.short.agent}}、{{ui:app.nav.settings}}：[AI 助手与设置](09-assistant-settings.md)

### 中央的标签页（开始、查看器、草稿）

{{ui:app.tabs.generate}}标签页的中央上方有 3 个小标签页。

- **{{ui:app.views.launchpad}}**：入门指引。会显示“{{ui:params.launchpad.generate.textTitle}}”“{{ui:params.launchpad.generate.refTitle}}”等卡片和快捷键提示。
- **{{ui:app.views.viewer}}**：放大查看图像的地方。在图库中选中图像后，会显示在这里。
- **{{ui:app.views.drafts}}**：保持相同设置、只改变种子，并排显示许多画到一半的候选图，只把喜欢的画到最后的界面。

其他标签页也有各自专用的小标签页（例如{{ui:app.tabs.canvas}}有{{ui:app.views.canvas}}）。

### 隐藏面板

想把图像看得更大时，可以隐藏左右面板。

- 用中央上方边缘的小箭头按钮，可以展开或收起左侧面板、右侧面板。
- 用键盘操作时，`T` 切换左侧面板，`G` 切换右侧面板，`F` 同时切换左右两侧。
- 拖动面板之间的分界线，可以改变宽度。宽度只在应用打开期间会被记住（重新启动后恢复为原来的宽度）。

> `T`、`G`、`F` 这类单个字母的快捷键，在输入文字时不起作用。请先离开输入框再按。

## 生成第一张图（3 个步骤）

这是第一次生成图像的流程。以下说明以已经安装好模型为前提。

1. **选择模型。** 在左侧面板上方的模型栏中，选择想使用的模型。如果栏中显示“{{ui:params.model.noModels}}”，请先完成 [准备模型](08-models.md)。
2. **写提示词。** 在“{{ui:params.prompt.positive}}”栏中，用文字写下想要生成的图像。例如 `a lighthouse on a cliff at dusk, calm sea, warm light`，用逗号连接单词或短句。多数模型使用英文更容易得到想要的效果。
3. **点击{{ui:params.invoke.invoke}}。** 点击按钮，或按 `Ctrl+Enter`。右侧图库上方会出现“{{ui:gallery.generating.title}}”，可以看到中途的图像和进度。生成完成后，图像会显示在中央的查看器中，也会排列到图库里。

按钮是灰色、无法点击时，按钮下面一行会显示原因（例如“{{ui:params.readiness.noModel}}”）。解决了原因后就可以点击了。

生成的图像会自动保存到图库。如果不满意，稍微修改提示词或设置，再点击一次即可。
详细内容请继续阅读下一章 [生成图像](02-generate.md)。
