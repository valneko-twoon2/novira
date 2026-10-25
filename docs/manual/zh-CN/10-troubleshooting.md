# 遇到问题时

这里汇总了不顺利时的原因和可以尝试的做法。请根据界面上显示的文字来查找。

首先，查看下面 2 项，往往能抓住原因的线索。

- **{{ui:app.tabs.queue}}** 标签页：失败的项目中会显示原因（参见[下文](#生成失败)）。
- {{ui:app.devlog.title}}：应用内部的记录（参见 [助手与设置](09-assistant-settings.md)）。

## 启动与引擎

novira 使用“图像生成引擎”（ComfyUI，以及运行它的 Python）来生成图像等内容。引擎由应用自行安装、自行启动。

### 启动需要很长时间

首次启动时，因为要下载和解压引擎，所以需要花时间。**{{ui:engine.firstRunNote}}**

最初的界面中，会出现 **{{ui:splash.step.downloading}}**、**{{ui:splash.step.extracting}}**、**{{ui:splash.step.starting}}** 这 3 个阶段。下载过程中，还会显示大小、速度和剩余时间。请等到结束。

引擎准备好后，界面会切换。从第二次起，只是启动之后到引擎响应之前的短暂时间。

### 屏幕上方出现的消息

在引擎准备过程中，或出现问题时，屏幕上方会出现消息。

| 消息 | 含义 |
|---|---|
| {{ui:engine.title.downloading}} | 正在下载引擎。有数 GB。网速慢时需要较长时间 |
| {{ui:engine.title.extracting}} | 正在解压下载的文件 |
| {{ui:engine.title.starting}} | 正在启动引擎，并等待连接成功 |
| {{ui:engine.title.error}} | 准备失败。原因会显示在下方 |

### 出现“{{ui:engine.title.error}}”

出现在启动时最初的界面上时，点击 **{{ui:splash.open}}**，可以在没有引擎的情况下打开应用。这种情况下，无法生成图像等内容，但可以查看图像、整理模型。

可以尝试的做法：

1. 阅读原因的文字。确认是否连接了互联网、磁盘是否有剩余空间。
2. 重新再试一次。即使引擎准备失败之后，下次开始生成时，应用也会重新进行准备。如果仍然无法解决，请关闭应用再重新打开。
3. 下载已经完成、只是解压失败时，下载的文件会保留，所以重试时会从解压开始。
4. 有时安全软件正在检查新文件，导致解压停滞。应用会自动重试几次，如果仍然持续，请把数据文件夹（见下文）从检查对象中排除，或暂时停用。
5. 原因中出现“see logs/comfyui.log”时，引擎的日志中有详细的原因（[日志的查看方法](#日志的查看方法)）。

> 引擎是 Windows 用的 ComfyUI，默认安装的是 NVIDIA GPU 用的版本。也有使用 AMD GPU 或自己安装的 ComfyUI 的设置，但这是面向高级用户的（[面向高级用户的设置](#面向高级用户的设置)）。

### 引擎看起来在中途停住了

引擎启动后，等待其响应的时间，默认为 3 分钟。超过之后，会出现意为“ComfyUI did not answer in time”的错误。启动过程中引擎退出时，会显示“ComfyUI exited while starting”。无论哪种情况，引擎的日志（`comfyui.log`）中都会留有原因。

## 无法生成

### 生成按钮无法点击

把鼠标移到 **{{ui:app.tabs.generate}}** 界面的生成按钮上，会出现名为 **{{ui:params.invoke.cannotInvoke}}** 的原因列表。在视频、音乐、语音、Logo 的界面中，原因会排列在按钮下方。逐个解决显示出来的原因，按钮就可以点击了。

| 出现的原因 | 解决方法 |
|---|---|
| {{ui:params.readiness.noModel}} | 选择模型。没有安装时，请看下一项“没有安装模型” |
| {{ui:params.readiness.loraMissing}} | 找不到之前选择的 LoRA。可能是被删除或移动了。重新选择 LoRA，或将其移除 |
| LoRA“○○”与模型不兼容 | 基础（SDXL 或 SD1.X 等）不同。换成相同基础的 LoRA，或将其移除 |
| 参考图像 ○：未选择图像，或未选择模型 | 在参考图像栏中，放入图像和模型 |
| 参考图像需要扩展 ○○ | 从参考图像栏的指引中，安装扩展（[缺少扩展](#缺少扩展)） |
| {{ui:params.readiness.upscaleNoImage}} | 选择要放大的图像 |
| {{ui:params.readiness.upscaleNoModel}} | 选择放大用的模型。没有安装时，可以从{{ui:app.tabs.models}}标签页的 **{{ui:models.install.tab.starter}}** 中安装 |
| {{ui:video.problem.prompt}}、{{ui:music.problem.tags}}、{{ui:voice.problem.text}}、{{ui:logo.problem.text}} | 必填栏为空。请填写 |
| {{ui:video.problem.image}} | 在“图生视频（i2i）”时，没有选择要让其动起来的图像 |
| {{ui:voice.problem.description}} | 在“用文字创建声音”时，声音的描述为空 |
| {{ui:video.problem.pack}}、{{ui:music.problem.pack}}、{{ui:voice.problem.pack}}、{{ui:logo.problem.pack}} | 没有安装专用的模型。请看下一项 |

### 没有安装视频、音乐、语音、Logo 的模型

各自界面的左侧面板中会出现卡片，点击 **{{ui:pack.install}}**。在安装完成之前无法生成。

- 下载中途失败时，卡片上的按钮会变为 **{{ui:pack.retry}}**。点击后会重新进行。
- 语音还要安装朗读用的引擎。需要先完成图像生成引擎的准备。
- 高速的视频模型，与标准的视频模型是分开下载的。

详情请看 [视频、音乐、语音、Logo](07-media.md)。

### 没有安装模型

**{{ui:app.tabs.models}}** 标签页中显示 **{{ui:models.empty.title}}** 时，说明一个模型都没有。

- 从 **{{ui:models.import}}** 的 **{{ui:models.install.tab.starter}}** 中，可以安装第一个模型。
- 也可以在 **{{ui:app.tabs.browse}}** 标签页中，查找并安装喜欢的模型。
- 已经有模型文件时，可以用 **{{ui:models.import}}** 的 **{{ui:models.install.tab.scan}}**，连同文件夹一起导入。

详情请看 [模型](08-models.md)。

### 缺少扩展

有些功能会出现“需要扩展 ○○”。例如修复人脸、选取范围、去除背景、视频补帧、使用参考图像等。

1. 点击消息旁边的 **{{ui:params.refImage.installPack}}**。
2. 安装完成后，点击 **{{ui:params.refImage.restartEngine}}**，重启引擎。
3. 重启之后，再重新操作一次。

扩展也可以从 **{{ui:app.tabs.workflows}}** 标签页的 **{{ui:workflows.panel.packs}}** 中，按列表安装或移除。

> 连接的不是应用安装的引擎，而是自己准备的引擎时，无法从应用中安装扩展。请在该引擎一侧安装。

### GPU 显存不足，或与其他应用争用

图像、视频、音乐会使用电脑的 GPU。其他应用（游戏、视频编辑、浏览器中的视频等）正在使用 GPU 时，可能会因为显存不足而失败。

显存不足时，错误中有时会出现“OOM”字样（意为内存不足）。

因显存不足而失败时，应用会识别出来，并显示 **{{ui:queue.oom.title}}** 的提示。提示会出现在图库上方、**{{ui:app.tabs.queue}}** 标签页中失败项目的下方、视频·音乐·语音·Logo 的画面，以及画面右下角的通知中。

![GPU 显存不足时的提示，并排着缩小后重试和开启低显存模式并重启两个按钮](shot:out-of-memory)

可以用提示中的按钮尝试以下任一做法：

- **{{ui:queue.oom.retrySmaller}}**：保持相同的设置和种子，在保持长宽比的同时把面积缩小到约 75%，重新生成。只对指定尺寸生成的图像显示（视频、音乐、语音、Logo 和放大不显示）。
- **{{ui:queue.oom.lowMemory}}**：开启 **{{ui:settings.lowMemory.label}}**（参阅 [助手与设置](09-assistant-settings.md)）并重启引擎。有正在生成的项目时，将在下次启动引擎时生效。已经开启时不会显示。

因显存不足而失败后，应用会请求引擎卸载已加载的模型并释放显存。因此，下一次生成要从重新加载模型开始，会多花一点时间。

可以尝试的做法：

- 关闭游戏、视频编辑等使用 GPU 的其他应用，再重新生成。
- 缩小图像的尺寸。
- 减少使用的 LoRA 和参考图像。
- 视频用较小的尺寸生成，完成后用 **{{ui:video.finish}}** 放大。也可以试试 **{{ui:video.light.title}}** 的 **{{ui:video.light.fp8}}** 和 **{{ui:video.light.tiled}}**。
- 重新打开应用，释放正在占用的显存。

语音模型在一段时间不使用后，会从 GPU 中卸载。生成是一项一项依次进行的。

### 生成失败

图像、视频、音乐等的生成失败时，**{{ui:app.tabs.queue}}** 标签页中的项目会变为 **{{ui:queue.status.failed}}**。点击项目展开后，**{{ui:queue.detail.error}}** 中会显示原因。在视频、音乐、语音、Logo 的界面中，中间靠上的位置也会显示失败的提示和原因（最多显示最近的 3 条）。

弄清原因后，可以用项目的 **{{ui:queue.action.retry}}** 按钮，以相同的设置重新进行。

原因的文字来自引擎和应用的内部，所以有时是英文。列出常见的几种。

| 原因的文字（要点） | 含义与可以尝试的做法 |
|---|---|
| ComfyUI does not see ... (check model roots / extra_model_paths) | 引擎找不到该模型。可能是移动了模型文件，或查找文件夹的设置不匹配。在模型标签页中重新安装，或确认位置 |
| ComfyUI is not reachable at ... | 无法连接到另外准备的引擎。确认该引擎是否已启动 |
| ComfyUI exited while starting / did not answer in time | 引擎无法启动。请查看引擎的日志 |
| ... OOM | GPU 显存不足。请参阅上一项 |
| ... models are not supported by the ComfyUI backend yet | FLUX 和 SD3.X 的模型，目前还不能用于生成图像。请选择 SDXL 或 SD1.X 的模型 |
| Reference images need the ... custom node pack | 没有安装参考图像所需的扩展 |
| This ComfyUI is too old for video / music | 所使用的引擎中，没有视频或音乐所需的功能。如果是应用安装的引擎，不会发生。如果是自己准备的引擎，请更新 |
| The video / music / logo models are not installed yet | 没有安装专用的模型。请从各自的界面下载 |
| ComfyUI has no ... node; install the custom node pack | 没有安装工作流中所用节点的扩展 |
| Interrupted because novira was closed | 生成的途中，应用被关闭了。请重新生成 |

### 图像生成好了却看不到

生成已经 **{{ui:queue.status.completed}}**，但图库中没有出现时，请确认以下几点。

- **画板不对**：新图像会进入带有 **{{ui:gallery.boards.autoBadge}}** 标记的画板（初始状态下是 **{{ui:gallery.boards.uncategorized}}**）。打开的是其他画板时，那里不会出现。请切换画板，或用 **{{ui:gallery.boards.setAutoAdd}}** 重新选择放入新图像的画板。
- **Logo 会进入“资源”**：Logo 进入的是 **{{ui:gallery.view.assets}}** 而不是 **{{ui:gallery.view.images}}**。
- **视频和语音的显示方式**：视频以带 ▶ 的缩略图排列，语音以带 ♪ 的缩略图排列。残留着搜索或筛选时，会被隐藏。

仍然找不到时，在 **{{ui:app.tabs.queue}}** 标签页中确认项目的 **{{ui:queue.col.destination}}**。输出位置为 **{{ui:queue.destination.canvas}}** 的项目，会出现在画布中，而不是图库中。

## 数据的存放位置与备份

### 数据在哪里

图像、模型、记录，全部都放在名为 **`novira-data`** 的文件夹中。位置如下。

- 发行版：安装时选择的文件夹。初始值为与应用的可执行文件（`novira.exe`）相同的文件夹中的 `novira-data`。
- 开发中的版本：仓库最上层文件夹中的 `novira-data`。

可以用环境变量 `NOVIRA_DATA_DIR` 改到其他位置。

| 文件夹、文件 | 存放的内容 |
|---|---|
| `outputs` | 生成的图像、视频、语音 |
| `novira.sqlite` | 图像的信息、画板、队列、模型列表、工作流等的记录 |
| `thumbnails` | 缩略图 |
| `models` | 安装的模型 |
| `comfyui` | 应用安装的图像生成引擎 |
| `cache` | 引擎使用的临时数据 |
| `voice` | 语音朗读用的库 |
| `logs` | 日志（见下文） |
| `settings.json` | 面向高级用户的设置（没有也没关系） |
| `secrets` | API 密钥和令牌（已加密） |
| `agent.json` | 在 AI 助手中选择的 AI 的类型 |

应用安装的引擎（ComfyUI 和 Python），以及它们的工作用数据，也放在数据文件夹中。

应用界面的设置（语言、主题、预设、AI 的聊天记录等），不在 `novira-data` 中，而是在应用界面一侧的存储区域中。

### 备份

novira 有创建备份的功能，也有从备份恢复的功能。要保护重要的图像，请使用设置中的 **{{ui:share.backup.section}}**（参见 [助手与设置](09-assistant-settings.md#备份)）。备份中包含制作的图像，以及在应用内设置、登记的内容，但不包含模型和图像生成引擎。如果也想保留它们，请自己复制文件夹。

1. 关闭应用（同时确认没有正在生成的内容）。
2. 把 `novira-data` 文件夹整个复制到其他磁盘等位置。

容量大的是 `models` 和 `comfyui`。如果只保留图像和记录，重点是 `outputs` 和 `novira.sqlite`。`models` 中的模型，多数可以从导入来源重新下载，但已停止发布的可能无法恢复。

> API 密钥和令牌是用 Windows 的功能加密的。复制到其他电脑或其他用户时，可能无法读取，这种情况下，请在设置中重新填入。

应用界面的设置和预设、AI 的聊天记录，不包含在这份复制内容中，但包含在备份中。

## 日志的查看方法

日志可以在 3 个地方查看。

| 位置 | 内容 |
|---|---|
| {{ui:app.devlog.title}}（应用内） | 应用内部的记录，以及界面的警告和错误。在设置中打开显示（[助手与设置](09-assistant-settings.md)） |
| `novira-data\logs\novira.log` | 应用自身的记录。变大之后（超过 2 MB），会转移到 `novira.log.1` |
| `novira-data\logs\comfyui.log` | 图像生成引擎的记录。无法启动或生成失败时，会出现原因 |

日志的新行会追加在下方。出现问题时，请查看最下方附近。包含“error”或“failed”的行就是线索。

## 报告问题时

如果备齐下面这些，就能更快弄清原因。

1. **做了什么，结果怎样**：操作的顺序、期望的结果、实际发生的情况。
2. **界面上的文字**：把错误的文字（**{{ui:app.tabs.queue}}** 标签页的 **{{ui:queue.detail.error}}**，或屏幕上方出现的消息）原样抄下来。
3. **应用的版本**：显示在设置界面的最下方，或 **{{ui:app.nav.about}}** 中。
4. **开发者日志**：用 **{{ui:app.devlog.copy}}** 复制的文字。
5. **日志文件**：`novira.log` 和 `comfyui.log` 中，问题发生时间前后的部分。
6. **电脑的信息**：GPU 的型号和显存、Windows 的版本。

> 日志中可能包含提示词和文件的位置。交给别人之前，请确认是否有不想让人看到的部分。

## 面向高级用户的设置

在数据文件夹中放入 `settings.json`，可以改变引擎等的行为。通常不需要。

| 设置名 | 内容 |
|---|---|
| `comfyuiPackage` | 要安装的引擎的类型。`nvidia`（默认）或 `amd` |
| `comfyuiUrl` | 连接到已经在运行的 ComfyUI（应用不会安装引擎，也不会启动它） |
| `comfyuiDir` | 使用自己安装的 ComfyUI 的文件夹 |
| `modelRoots` | 添加查找模型的文件夹 |
| `comfyuiStartTimeoutSecs` | 等待引擎启动的秒数（默认为 180） |
| `lowMemoryMode` | 低显存模式（`true` 或 `false`）。在设置画面切换 **{{ui:settings.lowMemory.label}}** 时会写入这里 |

文件的写法有错误时，应用不会启动，并会显示原因。更改后，请重新打开应用。
