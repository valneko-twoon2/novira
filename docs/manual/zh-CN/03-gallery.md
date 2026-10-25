# 图库与查看器

生成的图像会排列在屏幕右侧的 **图库** 中。在图库中选中的图像，可以在中央的 **{{ui:app.views.viewer}}** 中放大查看。
本章介绍图像的整理方法、查找方法、在查看器中的查看方法、设置的调用方法，以及删除和下载。

## 认识图库

右侧面板由上下两部分组成。

- 上方：**{{ui:gallery.boards.title}}**。类似用来收纳图像的文件夹。
- 下方：所选画板中图像的缩略图。

缩略图上方的一行有以下内容。

- “{{ui:gallery.view.images}}”和“{{ui:gallery.view.assets}}”的切换，以及图像的数量。
- 放大镜按钮：搜索（{{ui:gallery.search.label}}）
- 日历按钮：{{ui:gallery.date.button}}
- 齿轮按钮：{{ui:gallery.settings.title}}
- 向上箭头按钮：{{ui:gallery.upload}}

**{{ui:gallery.view.images}}** 中存放用 novira 生成的图像（也包括视频和语音）。
**{{ui:gallery.view.assets}}** 中存放上传的图像，以及像 Logo 这样作为“与作品分开的素材”来处理的内容。如果找不到某张图像，请看看另一边。

缩略图的大小可以用齿轮按钮中的滑块调整。
视频和语音的缩略图上带有播放标记，把光标放上去并左右移动，可以确认对应位置的画面。

## 画板

画板是用来把图像分类整理的容器。“{{ui:gallery.boards.uncategorized}}”是一开始就有的画板，没有放进画板的图像都会在这里。

- **创建**：点击画板栏右上角的 **＋**（{{ui:gallery.boards.add}}）。可以当场输入名称。
- **切换**：点击画板。下方只会排列该画板中的图像。
- **改名**：双击画板的名称，或在右键菜单中选择“{{ui:common.rename}}”。
- **查找**：用画板栏的放大镜，可以按画板名称搜索。
- **折叠**：点击“{{ui:gallery.boards.title}}”标题。拖动画板栏的下边缘，可以改变高度。

### 新图像会放进哪个画板

新生成的图像（上传的图像也一样）会放进带有“**{{ui:gallery.boards.autoBadge}}**”标记的画板。
初始状态下，每次点击画板，该画板就会变成“{{ui:gallery.boards.autoBadge}}”。想固定时，请在图库设置中关闭“{{ui:gallery.settings.autoAssign}}”，再用画板右键菜单中的“{{ui:gallery.boards.setAutoAdd}}”来指定。

### 画板的右键菜单

- **{{ui:gallery.boards.setAutoAdd}}**：作为新图像的保存位置。
- **{{ui:common.rename}}**
- **{{ui:gallery.boards.archive}}**：把画板从列表中隐藏。并不是消失，打开图库设置中的“{{ui:gallery.settings.showArchived}}”就能再次看到。用“{{ui:gallery.boards.unarchive}}”可以恢复。
- **{{ui:gallery.boards.delete}}**：会弹出确认窗口，请选择下面其中一项。
  - “{{ui:gallery.boards.deleteBoardOnly}}”：图像保留，并移到“{{ui:gallery.boards.uncategorized}}”。
  - “{{ui:gallery.boards.deleteBoardAndImages}}”：画板中的图像也一并删除。

> “{{ui:gallery.boards.uncategorized}}”不能改名、归档或删除。

## 选择图像

缩略图可以按下面的方式选择。

| 操作 | 结果 |
|---|---|
| 点击 | 选中这 1 张。在查看器中查看的图像也会换成这一张 |
| 按住 `Ctrl` 点击 | 加入已选的图像，或从已选中取消（多选） |
| 按住 `Shift` 点击 | 选中从之前选中的图像到点击的图像之间的全部图像 |
| 按住 `Alt` 点击 | 与查看器中的图像对比（见后文） |
| 双击 | 把中央切换为查看器，放大查看这张图像 |
| `Ctrl+A` | 选中当前排列的所有图像 |
| 方向键 | 把选择移到前后、上下的图像。按住 `Shift` 可以扩大范围 |
| `Esc` | 取消选择 |

> 方向键等在光标位于图库上方，或中央为查看器时有效。

选中的图像会带有蓝色边框。把光标放在缩略图上，会出现以下内容。

- 图像的尺寸（在图库设置的“{{ui:gallery.settings.alwaysShowSize}}”中，也可以设为始终显示）
- 星标按钮（加星标、取消星标）
- 垃圾桶按钮（删除）

加了星标的图像，左上角会有黄色的星标记。

## 右键点击缩略图

![缩略图的右键菜单。排列着在查看器中打开、下载、混编、发送到画布等](shot:gallery-menu)

右键点击缩略图，会列出可以对这张图像进行的操作。不能使用的操作会变灰（例如，没有设置记录的图像无法使用“{{ui:gallery.menu.remix}}”）。

| 菜单 | 作用 |
|---|---|
| **{{ui:gallery.menu.openInViewer}}** | 在中央的查看器中放大查看 |
| **{{ui:common.download}}** | 保存图像的文件 |
| **{{ui:share.menu}}** | 选择格式和大小导出副本（也可以移除生成信息） |
| **{{ui:common.copy}}**（`Ctrl+C`） | 把图像复制到剪贴板 |
| **{{ui:gallery.menu.compare}}**（`Alt+点击`） | 与查看器中显示的图像对比 |
| **{{ui:gallery.menu.loadWorkflow}}**（`W`） | 打开生成这张图像的工作流 |
| **{{ui:gallery.menu.remix}}**（`R`） | 把除种子之外的设置载入左侧面板 |
| **{{ui:gallery.menu.usePrompt}}**（`P`） | 只载入提示词 |
| **{{ui:gallery.menu.useSeed}}**（`S`） | 只载入种子（种子会变为固定） |
| **{{ui:gallery.menu.useAll}}**（`A`） | 载入全部设置 |
| **{{ui:gallery.menu.useSize}}** | 只载入宽度和高度 |
| **{{ui:gallery.menu.sendToCanvas}}** | 放到画布上。可以选择建立新画布，或作为当前画布的图层或遮罩添加 |
| **{{ui:gallery.menu.useAsReference}}** | 添加到参考图像的框中 |
| **{{ui:gallery.menu.sendToVideo}}** | 作为视频的第一张图像 |
| **{{ui:gallery.menu.sendToWorkflow}}** | 作为图像输入添加到打开的工作流中 |
| **{{ui:gallery.menu.sendToText}}** | 作为文本的背景 |
| **{{ui:gallery.menu.upscale}}**（`Shift+U`） | 发送到放大标签页 |
| **{{ui:gallery.menu.segment}}** | 选取图像的一部分，进行抠图或重绘 |
| **{{ui:gallery.derive.menu}}** | 用这张图像的设置，生成不同种子或稍作改动的图像 |
| **{{ui:cutout.menu}}** | 去除背景 |
| **{{ui:facefix.menu}}** | 找到人脸并重新绘制 |
| **{{ui:gallery.menu.trim}}** | 去掉透明的空白边，另存为新的透明图像 |
| **{{ui:character.menu}}** | 把图像注册为角色 |
| **{{ui:gallery.menu.changeBoard}}** | 移到其他画板 |
| **{{ui:gallery.menu.star}}** / **{{ui:gallery.menu.unstar}}** | 加星标、取消星标 |
| **{{ui:gallery.menu.delete}}**（`Del`） | 删除图像 |

“{{ui:gallery.menu.sendToCanvas}}”，以及重新生成、修饰图像的操作的用法，在 [在画布上补画](05-canvas.md)、[修饰与复用图像](04-improve.md)、[放大与工作流](06-upscaling-workflows.md)、[视频、音乐、语音、Logo、文本](07-media.md) 中介绍。

> 只有在电脑的浏览器中打开时，才会出现“{{ui:gallery.menu.openInNewTab}}”。桌面版中不会出现。

## 批量操作多张图像

![选中 2 张后右键点击时的菜单](shot:gallery-multi-menu)

选中 2 张或更多图像后，右键点击其中一张，会出现可以批量使用的菜单。开头会显示所选数量，例如“已选择 2 张”。

- **{{ui:gallery.menu.changeBoard}}**：把所选图像一并移到其他画板。
- **{{ui:gallery.menu.starAll}}** / **{{ui:gallery.menu.unstarAll}}**
- **{{ui:common.download}}**：依次保存所选图像。
- **{{ui:share.menu}}**：将所选图像一并导出为用于分享的副本（视频和音频除外）。
- **{{ui:gallery.menu.batch}}**：对所选的所有图像进行相同的处理（去除背景、放大等）。每张会分别进入队列。
- 最下方的红色项目：把所选图像一并删除。

> 右键点击未选中的图像时，会出现这 1 张的菜单。想对多张图像使用时，请先选中，再在所选图像上右键点击。

## 查找、筛选、排序

### 搜索

点击放大镜按钮，会打开搜索栏。输入文件名或正向提示词的一部分，就会筛选该画板中的图像。按 `Esc` 可以关闭搜索，并取消筛选。

### 按日期筛选

![按日期筛选的菜单。有今天、昨天等按钮和月历](shot:gallery-date)

点击日历按钮，会打开按日期筛选的菜单。

- **{{ui:gallery.date.quick.today}}**、**{{ui:gallery.date.quick.yesterday}}**、**{{ui:gallery.date.quick.last7}}**、**{{ui:gallery.date.quick.last30}}**：一键确定期间。
- 月历：有图像的日期会带有标记。点击日期，就只会排列那一天的图像。用上方的箭头可以切换月份。
- **{{ui:gallery.date.custom}}**：填入开始日期和结束日期后点击 **{{ui:gallery.date.apply}}**，就只会排列该期间的图像。只填其中一个也可以。
- **{{ui:gallery.date.quick.all}}**：取消筛选。

筛选期间，图库上方会出现期间的标签。点击标签上的 × 也可以取消。

### 图库设置

用齿轮按钮可以改变排列方式和外观。

- {{ui:gallery.settings.thumbnailSize}}
- {{ui:gallery.settings.autoSwitch}}：图像生成后，自动显示该图像。
- {{ui:gallery.settings.autoAssign}}
- {{ui:gallery.settings.alwaysShowSize}}
- {{ui:gallery.settings.showArchived}}
- {{ui:gallery.settings.starredFirst}}：把加了星标的图像排在最前面（初始为开启）。
- {{ui:gallery.settings.sort}}：“{{ui:gallery.settings.sortNewest}}”或“{{ui:gallery.settings.sortOldest}}”。
- {{ui:gallery.settings.groupByDate}}：加上按天的标题进行分隔。

## 在查看器中查看

![查看器。上方是工具栏，中央是图像，右下是缩放按钮，下方显示图像的信息](shot:viewer)

中央的“{{ui:app.views.viewer}}”中会放大显示所选的图像。
前后的图像可以用屏幕左右的箭头切换。最下面一行会显示图像的尺寸、使用的模型、种子和文件名。视频和语音可以直接播放。

### 缩放与移动

- 鼠标滚轮：以光标位置为中心放大、缩小。
- 拖动：放大后图像超出画面时，用来移动图像。按住 `Space`，或按住滚轮按钮，也可以移动。
- 双击：在整体显示和原始大小（100%）之间切换。
- 右下的按钮：缩小、倍率（点击会出现常用倍率的列表）、放大、`1:1`（原始大小）、适应屏幕。
- 按键：`+` 和 `-` 每次调整一档，`Ctrl+0` 适应屏幕，`Ctrl+1` 恢复原始大小。

### 工具栏

图像上方的工具栏中排列着针对这张图像的操作。把光标放在按钮上，会显示名称和快捷键。

| 分组 | 按钮 |
|---|---|
| 信息 | **{{ui:gallery.viewer.toggleMetadata}}**（`I`） |
| 载入设置 | **{{ui:gallery.menu.remix}}**（`R`）、**{{ui:gallery.menu.usePrompt}}**（`P`）、**{{ui:gallery.menu.useSeed}}**（`S`）、**{{ui:gallery.menu.useAll}}**（`A`）、**{{ui:gallery.menu.loadWorkflow}}**（`W`）、**{{ui:gallery.derive.menu}}** |
| 发送、修饰 | **{{ui:gallery.menu.sendToCanvas}}**、**{{ui:gallery.menu.useAsReference}}**、**{{ui:gallery.menu.upscale}}**（`Shift+U`）、**{{ui:gallery.menu.segment}}**、**{{ui:cutout.menu}}**、**{{ui:facefix.menu}}**、**{{ui:character.menu}}**、**{{ui:gallery.compare.toggle}}**（`C`） |
| 整理 | **{{ui:gallery.menu.star}}**、**{{ui:common.download}}**、**{{ui:share.menu}}**、**{{ui:gallery.menu.delete}}**（`Del`） |

作用与缩略图右键菜单中同名的项目相同。对于没有设置的图像（上传的图像等），载入设置的按钮会变灰。

## 图像的信息与设置的调用

![元数据面板。提示词、模型、种子、步数等的列表](shot:viewer-metadata)

点击工具栏的 **{{ui:gallery.viewer.toggleMetadata}}** 按钮（`I`），图像上方会打开信息面板。再点击一次，或点击右上角的 ×，即可关闭。
面板中有 4 个标签页。

- **{{ui:gallery.meta.tabRecall}}**：按项目列出生成这张图像时的设置（提示词、模型、种子、步数、CFG 比例、调度器、尺寸、LoRA 等）。用各行右侧的箭头按钮，可以把**仅该项目**载入左侧面板。
- **{{ui:gallery.meta.tabMetadata}}**：可以按原样查看记录的内容。用右上角的按钮可以复制。
- **{{ui:gallery.meta.tabDetails}}**：文件名、尺寸、生成日期时间、画板、有无星标等。
- **{{ui:gallery.meta.tabWorkflow}}**：如果是用工作流生成的图像，会显示其内容。

载入设置的方法，根据想使用的范围来选择。

| 方法 | 载入的内容 |
|---|---|
| **{{ui:gallery.menu.useAll}}** | 提示词、模型、种子、尺寸等全部设置。种子会变为固定 |
| **{{ui:gallery.menu.remix}}** | 除种子之外的全部内容。当前的种子设置（随机还是固定）保持不变。想“用相同的设置生成另一张图像”时使用 |
| **{{ui:gallery.menu.usePrompt}}** | 仅提示词（正向和反向） |
| **{{ui:gallery.menu.useSeed}}** | 仅种子。种子会变为固定 |
| **{{ui:gallery.menu.useSize}}** | 仅宽度和高度（仅右键菜单） |

载入之后，查看左侧面板，点击 **{{ui:params.invoke.invoke}}** 即可。

> 用 novira 生成的图像文件（PNG）中，也一并记录了设置。因此，即使把文件移到别处后重新上传的图像，有时也能载入设置。用其他软件生成的图像，或经过加工后重新保存的图像，则不包含设置。

## 对比两张图像

![用滑块对比 2 张图像的查看器。左右拖动中间的竖线](shot:viewer-compare)

想看两张图像的差别时，可以使用对比。

1. 点击选中想对比的第一张图像，把中央切换到“{{ui:app.views.viewer}}”标签页。
2. 按住 `Alt` 点击第二张的缩略图（也可以用右键菜单中的“{{ui:gallery.menu.compare}}”）。
3. 第二张的缩略图上会出现“{{ui:gallery.compare.badge}}”标签，查看器会变为对比画面。

> 也可以先按住 `Ctrl` 选中 2 张，再点击工具栏的对比按钮或按 `C` 键来开始。只选了 1 张时，会提示“{{ui:gallery.compare.hint}}”。

对比画面上方会出现下面的按钮。

- **{{ui:gallery.compare.slider}}**：把 2 张叠在一起，拖动中间的竖线，就能看到左右有什么不同。
- **{{ui:gallery.compare.sideBySide}}**：把 2 张左右并排。
- **{{ui:gallery.compare.hover}}**：只在光标放在图像上的期间，切换为第二张。
- **{{ui:gallery.compare.swap}}**：交换第一张和第二张。
- **{{ui:gallery.compare.exit}}**：结束对比。按 `Esc` 也可以结束。

缩放和移动时，两张会联动。放大后，更容易看出细节上的差别。

## 星标与删除

### 加星标

喜欢的图像可以加上星标。从缩略图的星标按钮、右键菜单、查看器的工具栏中，任何一处都可以加上或取消。
如果开启了图库设置中的“{{ui:gallery.settings.starredFirst}}”，加了星标的图像会聚集在最前面。

### 删除

删除图像的方法如下。

- 缩略图的垃圾桶按钮
- 右键菜单中的“{{ui:gallery.menu.delete}}”
- 查看器工具栏的垃圾桶按钮
- 选中图像后按 `Delete` 键（按 `Backspace` 效果相同）

会弹出确认窗口，点击“{{ui:common.delete}}”就会删除。

> 删除的图像无法恢复。没有类似回收站的存放处。

在确认窗口的“{{ui:common.dontAskAgain}}”上打勾，以后删除时就不再确认。想恢复确认时，请在 **{{ui:app.nav.settings}}** 中打开“{{ui:settings.confirmOnDelete}}”。

## 上传与下载

### 上传

可以把手头的图像放进图库。

- 点击图库上方的 **{{ui:gallery.upload}}** 按钮，选择文件。
- 从资源管理器把图像文件拖放到图库中。拖放到画板上时，会放进该画板。

上传的图像会进入“{{ui:gallery.boards.autoBadge}}”画板的 **{{ui:gallery.view.assets}}**，画面也会切换到那里。可以一次放入多个文件。不是图像的文件会被忽略。

### 下载

保存图像的文件，请使用右键菜单，或查看器工具栏的 **{{ui:common.download}}**。选中多张图像时，会一并保存。

### 导出以分享

![导出以分享窗口。排列着格式（PNG、JPEG、WebP）、画质、长边上限和移除生成信息的开关](shot:share-export)

要制作发到社交网络或交给别人的图像副本，请使用右键菜单（选中多张图像时也能用）或查看器工具栏的 **{{ui:share.menu}}**。原来的图像不会改变。

- **{{ui:share.format}}**：从 PNG、JPEG、WebP 中选择。JPEG 可以设定 **{{ui:share.quality}}**（1～100），透明部分会变成白色。WebP 以无损方式保存。
- **{{ui:share.size}}**：选择“{{ui:share.size.original}}”、2048、1536、1024 px，或用“{{ui:share.size.custom}}”输入长度。比它小的图像不会放大。
- **{{ui:share.removeInfo}}**：一开始是关闭的。打开后，不包含提示词、设置和工作流，并根据像素重新保存图像，因此也不会残留其他嵌入信息。关闭时，只有 PNG 会保留设置。交给别人之前，如果不想让人看到提示词，请打开它。

点击 **{{ui:share.run}}** 后，桌面版会打开选择保存文件夹的窗口。文件名是图库的文件名加上新的扩展名；已有同名文件时，会加上“-2”“-3”这样的编号，不会覆盖。导出后，可以用 **{{ui:share.openFolder}}** 打开该文件夹。

> 只能导出图像。所选项目中的视频和音频会被排除。在浏览器中打开时，会保存到浏览器的下载位置。

## 拖放

缩略图可以拖到其他位置使用。选中多张时，所选的图像会一起移动。

- **拖到画板上**：把这张图像移到该画板。
- **拖到{{ui:params.refImage.sectionLabel}}的框中**：作为参考图像（参见 [生成图像](02-generate.md)）。
- **拖到画布或放大的图像栏、开始画面的卡片上**：作为该画面的素材使用。

资源管理器中的文件，可以放到图库、画板、参考图像的框、开始画面的卡片等位置。

## 图库的快捷键

| 操作 | 按键 |
|---|---|
| 选择前后、上下的图像 | 方向键（`Shift` 扩大范围） |
| 全选 | `Ctrl+A` |
| 取消选择 | `Esc` |
| 删除所选图像 | `Delete` |
| 复制查看器中的图像 | `Ctrl+C` |
| 展开、收起信息面板 | `I` |
| 混编、提示词、种子、全部 | `R`、`P`、`S`、`A` |
| 载入工作流 | `W` |
| 发送到放大 | `Shift+U` |
| 开始、结束对比 | `C` |
| 整体显示、原始大小 | `Ctrl+0`、`Ctrl+1` |
| 放大、缩小 | `+`、`-` |

这些在光标位于图库上方，或中央为查看器时有效。列表也可以在 **{{ui:app.nav.settings}}** 菜单的“{{ui:app.nav.hotkeys}}”中查看。
