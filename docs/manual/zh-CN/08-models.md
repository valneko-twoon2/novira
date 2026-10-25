# 管理与查找模型

生成图像需要作为基础的“模型”。novira 中有用来整理手头模型的 **{{ui:app.tabs.models}}** 标签页，以及在网络上查找并安装模型的 **{{ui:app.tabs.browse}}** 标签页。

本章介绍这 2 个标签页的用法、模型的类型，以及如何查看许可证。

## 模型的类型

模型有“{{ui:models.sort.base}}”（属于哪个系列）和“{{ui:models.sort.type}}”（承担什么作用）。

### 基础（系列）

模型是按系列制作的，不同系列的无法组合。例如，SDXL 的模型无法使用 SD1.5 用的 LoRA。

| 显示 | 内容 |
|---|---|
| SD1.X | Stable Diffusion 1.5 等。运行较轻 |
| SD2.X | Stable Diffusion 2 系列 |
| SDXL | Stable Diffusion XL 系列。许多插画向的模型（Illustrious、NoobAI、Pony 等）也属于这里 |
| SD3.X | Stable Diffusion 3 系列 |
| FLUX | FLUX 系列 |
| Any | 不限系列的（放大器等） |

> 在目前的桌面版中，可用于生成图像的是 SD1.X、SD2.X、SDXL 的模型。FLUX 和 SD3.X 会出现在列表中，但用这些模型开始生成时，会出现意为“尚未支持”的错误。

模型与 LoRA 的基础不匹配时，**{{ui:app.tabs.generate}}** 界面的生成按钮会无法点击，并显示原因。

### 类型

| 类型 | 作用 |
|---|---|
| {{ui:models.rail.main}}（{{ui:models.type.main}}） | 绘制图像的本体 |
| {{ui:models.type.lora}} | 添加到本体上，增加画风或角色的小型模型 |
| {{ui:models.type.vae}} | 用于图像色彩和细节收尾的部件 |
| {{ui:models.type.controlnet}} | 指定姿势、线稿等图像的形状 |
| {{ui:models.type.ipAdapter}}、{{ui:models.type.clipVision}} | 把参考图像的氛围反映到生成中 |
| {{ui:models.rail.upscale}} | 放大图像 |
| {{ui:models.rail.encoders}} | 理解文字的部件 |
| {{ui:models.rail.diffusion}} | Wan 等，用于视频或专用流程的模型 |

视频、音乐、语音、Logo 用的模型不会出现在这个列表中。要从各自的界面下载（[视频、音乐、语音、Logo](07-media.md)）。

## 模型标签页

![模型标签页。左侧是分类，中间排列着模型卡片](shot:models)

**{{ui:app.tabs.models}}** 标签页是已安装模型的列表。

### 查找

用左侧的 **{{ui:models.rail.title}}**，可以按类型筛选。右侧会显示数量。

- **{{ui:models.rail.all}}**：全部
- **{{ui:models.rail.favorites}}**：加了星标的
- **{{ui:models.rail.main}}**、**{{ui:models.rail.lora}}**、**{{ui:models.rail.controlnet}}**、**{{ui:models.rail.vae}}**、**{{ui:models.rail.ipAdapter}}**、**{{ui:models.rail.upscale}}**、**{{ui:models.rail.encoders}}**、**{{ui:models.rail.diffusion}}**

在上方的栏中，可以按名称筛选（**{{ui:models.searchPlaceholder}}**）、按基础筛选、**{{ui:models.sort.label}}**（{{ui:models.sort.name}}、{{ui:models.sort.size}}、{{ui:models.sort.base}}、{{ui:models.sort.type}}）、在 **{{ui:models.view.grid}}** 和 **{{ui:models.view.list}}** 之间切换，以及调整缩略图的大小。

卡片的左下角带有基础（SDXL 等）和格式的标签。把鼠标移到卡片上，会出现星标（收藏）和菜单。

界面的右下角，会显示模型的数量和总大小。

### 添加模型

右上角有 2 个按钮。

- **{{ui:models.find}}**：跳转到 **{{ui:app.tabs.browse}}** 标签页（参见下文的章节）。
- **{{ui:models.import}}**：导入手头的文件，或已知地址的模型。

点击 **{{ui:models.import}}** 后，会打开 **{{ui:models.import.title}}** 界面，可以从 4 种方式中选择。

| 标签页 | 用法 |
|---|---|
| {{ui:models.install.tab.source}} | 填入模型的地址，或电脑中文件的位置，点击 **{{ui:models.install.install}}** |
| {{ui:models.install.tab.scan}} | 填入文件夹的位置并点击 **{{ui:models.install.scan}}**，里面的模型会排列出来。用 **{{ui:models.install.installAll}}** 可以一并安装 |
| {{ui:models.install.tab.starter}} | 由应用挑选并排列出一开始装上会比较方便的模型。依赖的模型（VAE 等）也会一并安装 |
| {{ui:models.install.tab.huggingface}} | 用 Hugging Face 的仓库名（`作者/名称`）进行查找的栏 |

在 **{{ui:models.install.tab.source}}** 栏中可以填入的有以下内容。

- Civitai 模型页面的地址
- 指向模型文件的直接地址（以 `https://` 开头的）
- 电脑中文件的位置（类似 `C:\models\model.safetensors` 的形式）
- Hugging Face 的文件（`作者/名称::文件名` 的形式）

指定电脑中的文件后，会导入到应用的模型文件夹中（如果在同一个磁盘，占用的空间几乎不会增加。在不同磁盘时会复制）。

> 输入仓库（`作者/名称`）并按下 **{{ui:models.install.hfLookup}}** 后，**{{ui:models.install.tab.huggingface}}** 标签页会列出该仓库中单独的模型文件（`.safetensors`、`.gguf`、`.ckpt`、`.pt`、`.pth`）。`unet`、`vae` 等 diffusers 管线文件夹中的文件不会列出。若已保存 Hugging Face 令牌，则用它获取列表。

安装操作会依次进行。进度可以点击界面左下角的 **{{ui:models.dock.queue}}**（处理中显示“正在安装 ○ 项”）后出现的 **{{ui:models.queue.title}}** 中查看。在这里还可以逐项 **{{ui:models.queue.cancel}}**，已结束的可以用 **{{ui:models.queue.prune}}** 清理。

下载到一半的文件，在完成后才会放入模型文件夹。中途停止，也不会留下残缺的文件。

### 模型的详情

![选中模型后右侧会显示详情。排列着大小、位置、许可证、来源等](shot:models-detail)

点击卡片，右侧会展开详情。要关闭时，点击右上角的 **{{ui:models.detail.close}}**。

详情中会显示名称、基础和类型的标签、说明、**{{ui:models.details.size}}**、**{{ui:models.details.path}}**（可以复制）、**{{ui:models.details.license}}**、**{{ui:models.details.source}}**。

用上方的按钮，可以进行以下操作。

- **{{ui:models.detail.openSource}}**：在浏览器中打开发布来源的页面（仅限有地址的模型）。
- **{{ui:common.edit}}**：修改名称、说明、基础、类型。在基础或类型没有被自动正确判断时使用。
- **{{ui:common.delete}}**：删除模型（见下文）。

### 触发词

LoRA 等，在使用时有输入到提示词中才会生效的词语（触发词）。登记在 **{{ui:models.triggers.title}}** 中之后，在 **{{ui:app.tabs.generate}}** 界面选择该 LoRA 时，这些词语会以按钮的形式出现。点击后会添加到提示词中。

在输入栏中填入词语并点击 **{{ui:common.add}}**，就会登记。用 × 可以移除。更改会立即保存。从 Civitai 安装的模型，有时一开始就带有发布来源所给出的词语。

### 默认设置

主模型有 **{{ui:models.defaults.title}}**。这是在生成界面选择该模型时，会自动填入的值。

- **{{ui:models.defaults.scheduler}}**
- **{{ui:models.defaults.steps}}**
- **{{ui:models.defaults.cfgScale}}**
- 宽度和高度

此外，**{{ui:models.defaults.vae}}** 和 **{{ui:models.defaults.vaePrecision}}** 也可以保存。只有打开了各项目开关的内容才会被保存。点击 **{{ui:common.save}}** 来确定。

因为每个模型的“推荐值”不同，对常用的模型设置一次，就不必每次都修改了。

### 删除

点击 **{{ui:common.delete}}** 会出现确认。**{{ui:models.deleteWarning}}**

不过，novira 安装的模型（应用数据文件夹中的）会连文件一起删除，而放在自己准备的文件夹中的模型，只是从列表中移除，文件会保留。

## 许可证标签

模型有发布来源所规定的使用条件（许可证）。novira 用标签来显示其要点。

| 标签 | 含义 |
|---|---|
| {{ui:browse.commercial.allowed}} | 允许出售生成的图像，或用于生成服务 |
| {{ui:browse.commercial.limited}} | 商业使用有条件（例如仅限出售生成的图像等） |
| {{ui:browse.commercial.denied}} | 不允许商业使用。仅限个人使用 |

点击标签，会以列表显示 **{{ui:browse.permission.title}}**。例如关于“{{ui:browse.permission.sellImages}}”“{{ui:browse.permission.sellModel}}”“{{ui:browse.permission.shareMerges}}”等，可以看出是允许、不允许还是未注明。

标签在 Civitai 上是根据作者设置的使用许可，在 Hugging Face 上是根据许可证的标注来确定的。这是以网站的显示为基础的参考，最终请确认发布来源的许可证正文。**{{ui:browse.permission.disclaimer}}**

不清楚已安装模型的许可证时，会显示 **{{ui:models.details.licenseUnknown}}**。

> 也有非商用许可证的模型。例如，视频的 **{{ui:video.model.fast}}** 是非商用许可。把生成的图像或视频用于工作或出售时，请务必确认所用模型的许可证。

## 探索标签页

![探索标签页。上方是查找位置、类型、搜索栏、筛选，下方排列着模型卡片](shot:browse)

**{{ui:app.tabs.browse}}** 标签页是在网络上查找模型并直接安装的界面。

### 查找位置

用左上角的切换来选择查找位置。

- **{{ui:browse.source.civitai}}**：聚集了许多插画和 LoRA 的网站。
- **{{ui:browse.source.huggingface}}**：有许多研究机构和企业模型的网站。那里的模型无法按名称查找，请把模型页面的 URL（文件夹或文件的页面也可以）或 `owner/name` 粘贴到屏幕中央的大输入框中，然后点击 **{{ui:models.install.hfLookup}}**。勾选显示出的文件，再点击右上角的安装按钮即可开始下载。如果粘贴的是文件夹的 URL，一开始只显示该文件夹中的文件。

在它旁边选择 **{{ui:browse.kind.label}}**。有 **{{ui:browse.kind.lora}}**、**{{ui:browse.kind.checkpoint}}**、**{{ui:browse.kind.controlnet}}**、**{{ui:browse.kind.vae}}**、**{{ui:browse.kind.diffusion}}**、**{{ui:browse.kind.all}}**。

### 筛选

在搜索栏中填入模型名称、作者、标签。填入后稍等片刻，结果就会更新。

用右侧的菜单可以筛选。

| 项目 | 内容 |
|---|---|
| {{ui:browse.base.label}} | {{ui:browse.base.sdxlCompat}}、{{ui:browse.base.illustrious}}、{{ui:browse.base.noobai}}、{{ui:browse.base.sdxl}}、{{ui:browse.base.pony}}、{{ui:browse.base.sd15}}、{{ui:browse.base.flux}}、{{ui:browse.base.anima}} 等 |
| {{ui:browse.sort.label}} | {{ui:browse.sort.downloads}}、{{ui:browse.sort.rating}}、{{ui:browse.sort.newest}} |
| {{ui:browse.period.label}} | 全部时间、1 年、1 个月、1 周、24 小时（仅限 Civitai） |
| {{ui:browse.nsfw.label}} | 初始为关闭。打开后，成人向的模型也会出现 |

滚动到底部，会加载后续内容。也可以用 **{{ui:browse.status.loadMore}}** 来加载。没能获取到时，请点击 **{{ui:browse.status.retry}}**。

### 卡片的看法与下载方法

卡片上会显示示例图像、模型的名称、作者、下载数、点赞数、许可证标签。LoRA 还会显示触发词。

- **{{ui:browse.card.download}}**：下载该模型的代表文件。
- 右侧的图标（**{{ui:browse.card.openCivitai}}**）：在浏览器中打开发布来源的网站。

点击卡片，右侧会展开详情。可以查看版本、文件列表（大小、格式）、触发词、标签、说明、许可证。选择版本，点击想下载的文件的 **{{ui:browse.card.download}}**。触发词点击后可以复制。点击外侧或按 `Esc` 关闭。

开始下载后，界面左下角会出现 **{{ui:browse.dock.title}}** 的小框，可以看到进度。可以用 **{{ui:browse.dock.cancel}}** 中止，已结束的可以用 **{{ui:browse.dock.clear}}** 清除。安装完成的卡片会变为 **{{ui:browse.card.installed}}**，同时也会加入 **{{ui:app.tabs.models}}** 标签页的列表。

> 下载需要登录的模型时，请在 **{{ui:settings.title}}** 中登记 Civitai 的 API 密钥。在 Hugging Face 上使用需要申请访问权限的模型时，请登记 Hugging Face 的令牌。两者都会加密保存在这台电脑上，不会显示在界面中。详情请看 [助手与设置](09-assistant-settings.md)。

要继续生成图像，请看 [生成图像](02-generate.md)。
