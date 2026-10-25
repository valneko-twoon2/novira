# 放大与工作流

本章介绍用来放大图像的 **{{ui:app.tabs.upscaling}}** 标签页，以及自己连接各项处理来制作流程的 **{{ui:app.tabs.workflows}}** 标签页。

## 放大

![放大标签页。中央排列着放置图像的位置和步骤卡片](shot:upscaling)

**{{ui:app.tabs.upscaling}}** 标签页在放大图像的同时，补画细节。它不是单纯地拉伸，而是先用放大模型把图像变大，然后使用提示词和 Tile ControlNet，把细小的地方重新绘制。

### 需要的内容

需要下面 2 个模型。没有安装时，左侧面板会出现提示。从“{{ui:params.upscale.openModels}}”按钮可以跳转到模型界面。安装方法请看 [模型](08-models.md) 一章。

- {{ui:params.upscale.model}}（Real-ESRGAN 等，用于放大图像的模型）
- 与所选主模型相匹配的 {{ui:params.upscale.tileControlnet}}

尚未安装任何放大模型时，左侧面板会列出候选模型，请从标有 **{{ui:media.choice.recommended}}** 的开始选择，并用 **{{ui:models.install.install}}** 安装。

### 步骤

1. 把想放大的图像，从图库拖到中央的卡片，或左侧面板 **{{ui:params.upscale.title}}** 的框中。右键点击图库中的图像（在查看器中是工具栏）并选择 **{{ui:gallery.menu.upscale}}**，或者在查看器中打开图像后按 `Shift+U`，标签页也会切换并放入图像。
2. 选择 **{{ui:params.upscale.model}}**。
3. 从 2x、4x、8x 中选择 **{{ui:params.upscale.scale}}**。会像“输出：2048×2048”这样显示完成后的大小。
4. 用下面 2 个滑块调整完成效果。
   - **{{ui:params.upscale.creativity}}**：越高，越偏离原图，补画新的细节。
   - **{{ui:params.upscale.structure}}**：越高，越保持原图的形状和布局。
5. 选择 **{{ui:params.upscale.tileControlnet}}**。如有需要，也选择 **{{ui:params.upscale.postProcessing}}**（它对绘制好的图像做收尾，之后再调整为输出尺寸）。
6. 点击 **{{ui:params.invoke.invoke}}**。

生成好的图像会进入图库。

- 输出的大小，单边最大为 8192 像素。超过时会出现警告，请调低倍率。
- 提示词会影响补画的细节。填入原图的提示词，图像的方向更容易吻合。
- 放大后的图像与原图相差太大时，调低 **{{ui:params.upscale.creativity}}**，调高 **{{ui:params.upscale.structure}}**。

> 想一次放大多张图像时，请在图库中选中多张，右键点击使用 **{{ui:gallery.menu.batch}}**（[修饰与复用图像](04-improve.md)）。这种方式只使用放大模型来放大。

## 工作流

![工作流标签页。右侧是描绘处理连接的界面，左侧是表单](shot:workflows)

工作流是这样一个功能：把“加载模型 → 输入提示词 → 生成图像 → 保存”之类的处理步骤，通过连接部件（节点）来组装。可以制作在平时的生成标签页中无法触及的细致步骤，以及把几种处理组合起来的流程。

一开始，建议从 **{{ui:workflows.panel.templates}}**（见下一节）中打开模板来使用。

界面由下面 2 个部分组成。

- 中央：**{{ui:app.views.editor}}**。排列节点，并用线连接。
- 左侧面板：**{{ui:workflows.panel.workflow}}**（表单）、**{{ui:workflows.panel.templates}}**、**{{ui:workflows.panel.packs}}**、**{{ui:workflows.panel.details}}**、**{{ui:workflows.panel.data}}** 这 5 个标签页。

要运行工作流，点击左侧面板上方的 **{{ui:params.invoke.invoke}}** 按钮。存在没有输出节点（“{{ui:workflows.nodes.save_image.title}}”等）、没有选择模型等问题时，会显示无法生成的原因。

### 添加节点并连接

1. 点击编辑器左上角的 **{{ui:workflows.toolbar.addNode}}**（＋）。用键盘的 `Shift+A` 或 `Space` 也可以打开。
2. 从列表中选择节点。在上方的搜索栏中输入文字，可以筛选。左侧的分类可以按内置节点的种类，或按已安装的扩展来筛选。
3. 从节点右侧的圆点（输出）拖动到另一个节点左侧的圆点（输入），进行连接。只能连接相同类型的圆点。

![添加节点时的列表](shot:workflows-add-node)

连接时有一些方便的功能。

- 把线放在什么都没有的地方，列表中只会出现可以连接到那里的节点。选择后，会添加节点并直接连接。
- 把线放在节点上，会自动连接到匹配的输入。
- 选中的节点，用 `Delete` 删除。用 `Ctrl+C` 和 `Ctrl+V` 可以复制节点。用 `Ctrl+Z` 撤销，用 `Ctrl+Shift+Z` 重做。
- 把图库中的图像拖到编辑器中，会添加放入这张图像的“{{ui:workflows.nodes.image.title}}”节点。
- 用节点名称左侧的箭头，可以折叠节点。双击名称，可以改名。

节点的设置值，直接在节点中输入。已连接的输入的值，来自所连接的对象。

### 按钮的排列

这是编辑器左上角的按钮。

| 按钮 | 做什么 |
|---|---|
| **{{ui:workflows.toolbar.addNode}}** | 添加节点。 |
| **{{ui:workflows.toolbar.library}}** | 打开工作流的列表。 |
| **{{ui:workflows.toolbar.new}}** | 开始一个空的工作流。 |
| **{{ui:workflows.toolbar.save}}**（`Ctrl+S`） | 保存。第一次保存时，会询问名称。 |
| **{{ui:workflows.toolbar.optimize}}** | 合并重复的节点，删除没有连到输出的节点和多余的连接，并从左到右重新排列。也可以撤销。 |
| **{{ui:workflows.toolbar.more}}** | **{{ui:common.saveAs}}**、**{{ui:workflows.toolbar.download}}**、**{{ui:workflows.toolbar.loadFromFile}}**。 |

右上角齿轮的 **{{ui:workflows.settings.title}}** 中，可以切换小地图的显示、吸附到网格等。

**{{ui:workflows.settings.autoTidy}}** 一开始是开启的。添加或删除节点和连线之后，过一会儿，会自动把节点从左到右重新排列，并合并作用相同的重复节点。合并时会出现通知，可以用 `Ctrl+Z` 恢复。没有连接的节点不会被自动删除。想自己排列时，请关闭。

有未保存的更改时，名称旁边会出现一个圆点。切换到其他工作流时，会询问是否可以放弃。

### 用表单使用

节点很多时，编辑器会变得难以看清。因此，可以制作只收集使用时经常调整的项目的“表单”。

1. 在编辑器中，右键点击项目（字段），选择 **{{ui:workflows.node.addToForm}}**。
2. 左侧面板的 **{{ui:workflows.panel.workflow}}** 标签页中，会排列出这个项目。
3. 点击 **{{ui:workflows.form.editForm}}**，可以调整顺序或移除。

只改变提示词和尺寸、反复运行时很方便。已连接的项目会显示“{{ui:workflows.form.connected}}”。

在 **{{ui:workflows.panel.details}}** 标签页中，可以写名称、作者、标签、说明等。在 **{{ui:workflows.panel.data}}** 标签页中，可以查看并复制工作流的内容（JSON）。

### 工作流库

![工作流库](shot:workflows-library)

点击 **{{ui:workflows.library.button}}**，会打开列表。

- **{{ui:workflows.library.recent}}**：最近打开的。
- **{{ui:workflows.library.yours}}**：自己保存的。
- **{{ui:workflows.library.defaults}}**：一开始就有的示例。示例要用 **{{ui:workflows.library.copyToMine}}** 复制成自己的之后再修改。

可以搜索、按标签筛选、更改排序。用 **{{ui:workflows.library.open}}** 打开，用垃圾桶按钮删除。**{{ui:workflows.library.new}}** 和 **{{ui:workflows.library.upload}}** 也在这里。

### 导出与导入

- 用 **{{ui:workflows.toolbar.download}}**，可以把工作流导出为 JSON 文件。
- 用 **{{ui:workflows.toolbar.loadFromFile}}**（或 **{{ui:workflows.library.upload}}**），可以导入导出的文件，或别人制作的文件。
- 导入的文件使用了尚未安装的扩展的节点时，会出现“{{ui:workflows.import.title}}”对话框。安装并重启 ComfyUI 后，该工作流会自动打开。
- 也可以从用工作流生成的图像中取出工作流。右键点击图库中的图像，选择 **{{ui:gallery.menu.loadWorkflow}}**（在查看器中打开图像时，也可以按 `W` 键）。即使是普通生成的图像，也可以根据设置组装出相同的流程。想把这张图像用作工作流的输入图像时，选择 **{{ui:gallery.menu.sendToWorkflow}}**。

> 别人制作的工作流，是在你的电脑上运行的程序的连接。来源不明的文件，请不要导入。

## 模板

**{{ui:workflows.panel.templates}}** 标签页中排列着常用组合的模板。

- 点击 **{{ui:workflows.templates.open}}**，会作为新的工作流打开。
- 点击 **{{ui:workflows.templates.add}}**，会添加到当前编辑器的右侧。
- 模型和图像，在打开之后再选择。

需要扩展的模板，会出现“所需扩展包”栏。点击 **{{ui:workflows.templates.installPacks}}** 安装，再用 **{{ui:workflows.templates.restartFirst}}** 按钮重启 ComfyUI，就可以打开了。

提供的模板如下。

| 模板 | 做什么 | 需要的扩展 |
|---|---|---|
| **{{ui:workflows.templates.text2image.title}}** | 根据模型和提示词生成 1 张并保存的基本形式。 | 无 |
| **{{ui:workflows.templates.text2imageUpscale.title}}** | 把用 1024 生成的图像放大到 2048 并保存。 | 无 |
| **{{ui:workflows.templates.loraStack.title}}** | 把 LoRA 依次连接到模型上，添加画风和细节。 | 无 |
| **{{ui:workflows.templates.image2image.title}}** | 以手头的图像为基础，用不同的提示词重新绘制。 | 无 |
| **{{ui:workflows.templates.upscale.title}}** | 用放大模型，把图像高清地放大。 | 无 |
| **{{ui:workflows.templates.controlnetCanny.title}}** | 提取图像的轮廓线，在保持其形状的同时重新绘制。 | 无 |
| **{{ui:workflows.templates.imageToVideo.title}}** | 让 1 张图像动起来，变成短视频。 | 无（需要视频用的模型） |
| **{{ui:workflows.templates.filmGrain.title}}** | 给生成的图像添加照片般的颗粒。 | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.faceRig.title}}** | 改变人脸照片的表情、视线和头部朝向。 | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.tiledUpscale.title}}** | 放大到 2048 后，按分块重新绘制，补充细节。 | ComfyUI_UltimateSDUpscale |
| **{{ui:workflows.templates.styleReference.title}}** | 把参考图像的画风，迁移到提示词所生成的图像上。 | ComfyUI_IPAdapter_plus（以及它的模型） |
| **{{ui:workflows.templates.faceDetailer.title}}** | 找到生成的图像中的人脸，用高分辨率重新绘制。 | Impact Pack 和 Impact Subpack |
| **{{ui:workflows.templates.removeBackground.title}}** | 只留下人物或物体，把背景变为透明。 | ComfyUI-RMBG |
| **{{ui:workflows.templates.whiteBackground.title}}** | 只留下人物或物体，把背景变为纯白。适合作为防止参考图像的背景颜色渗入图像的预处理。 | ComfyUI-RMBG |
| **{{ui:workflows.templates.poseControl.title}}** | 提取参考图像中人物的姿势，绘制姿态相同的新图像。 | comfyui_controlnet_aux（以及 OpenPose 用的 ControlNet 模型） |
| **{{ui:workflows.templates.captionToImage.title}}** | 把参考图像的内容变成文字，作为提示词，重新绘制。 | Florence-2 的扩展 |
| **{{ui:workflows.templates.characterReference.title}}** | 把角色的图像变成白色背景作为参考图像，统一头发、眼睛和服装，绘制新的场景。CFG 设为适合参考图像的较低值。 | ComfyUI-RMBG 和 ComfyUI_IPAdapter_plus |
| **{{ui:workflows.templates.characterPose.title}}** | 角色的外观取自参考图像，姿态取自火柴人（OpenPose）来绘制。 | 上面的 2 个，加上 comfyui_controlnet_aux 和 OpenPose 用的 ControlNet 模型 |

使用角色的模板，适合想用工作流细致调整 [注册并使用角色](04-improve.md#注册并使用角色) 这一功能时。通常，使用在生成标签页中注册的角色就足够了。火柴人的姿态，可以用 [画布](05-canvas.md) 的“{{ui:pose.title}}”来制作。

## 扩展（节点包）

在 **{{ui:workflows.panel.packs}}** 标签页中，可以给 ComfyUI 添加或移除扩展。扩展是用来增加节点的附加部件。安装的节点，会出现在添加节点列表的 **{{ui:workflows.categories.extension}}** 中。

一开始，会排列出“{{ui:workflows.packs.whatToDo}}”的大图块。选择想做的事（修复人脸、去除背景、高清放大等），就会附带说明，排列出与之匹配的扩展。

1. 点击想使用的扩展的 **{{ui:workflows.packs.install}}**。
2. 安装完成后，会显示“{{ui:workflows.packs.restartNeeded}}”。点击 **{{ui:workflows.packs.restart}}**。
3. 重启完成后，就可以使用该扩展的节点和模板了。

有些扩展带有注意事项。例如“需要 Git”“安装需要较多时间和空间”“已停止更新”等。安装之前，请阅读。

目录中没有的，可以用 **{{ui:workflows.packs.byAddress}}**，填入 GitHub 的地址（https://github.com/用户名/名称 的形式）来安装。其他已安装的扩展，会显示在 **{{ui:workflows.packs.others}}** 中。不需要的扩展，可以用 **{{ui:workflows.packs.remove}}** 移除（为了确认，需要再点击一次）。

已安装的扩展，即使不在工作流画面中，也可以随时查看。点击左侧边栏中的 **{{ui:app.nav.extensions}}**（拼图图标），会打开 **{{ui:workflows.packs.mgr.title}}**。已公开的扩展以卡片显示，可以用左侧列表中的 **{{ui:workflows.packs.mgr.installed}}**、**{{ui:workflows.packs.mgr.notInstalled}}** 或用途来筛选，也可以在顶部的框中按名称、作者或说明搜索。**{{ui:workflows.packs.mgr.sort.label}}** 默认按 **{{ui:workflows.packs.mgr.sort.downloads}}** 从多到少。卡片上会显示作者、版本、更新日期和下载量，已安装的会显示 **{{ui:workflows.packs.installed}}**。尚未安装的，可以点击卡片上的 **{{ui:workflows.packs.install}}** 来安装。点击卡片，右侧会打开详情，可以确认 **{{ui:workflows.packs.mgr.license}}** 和来源，也可以进行 **{{ui:workflows.packs.remove}}**。列表中没有的扩展，可以在顶部的 **{{ui:workflows.packs.mgr.addTitle}}** 中输入 GitHub 地址来安装。安装或移除之后，点击同一画面中的 **{{ui:workflows.packs.restart}}**，即可生效。每张卡片的详情里都有 **{{ui:agent.ask.button}}** 按钮，在搜索框输入文字后还会出现 **{{ui:agent.ask.resultsButton}}**。点击后，AI 助手会说明该扩展能做什么、怎么使用（请参阅 [AI 助手与设置](09-assistant-settings.md)）。

详情中的 **{{ui:workflows.packs.version.label}}** 显示当前已安装的版本。只有该扩展的仓库公开了版本时，才会显示 **{{ui:workflows.packs.version.change}}**，点击后会列出可选择的版本，点击 **{{ui:workflows.packs.version.apply}}** 即可切换到该版本。当前已安装的版本会标注 **{{ui:workflows.packs.installed}}**。没有公开版本的扩展不会显示此按钮。要使更改生效，请点击同一画面中的 **{{ui:workflows.packs.restart}}**。已知其他扩展或 ComfyUI 不支持的版本，会标注 **{{ui:workflows.packs.version.deprecated}}**，并写明是哪一个不支持。手动安装的扩展无法在此更改版本。

ComfyUI 的版本也可以在同一画面中更改。点击列表最前面的 **{{ui:workflows.packs.version.comfyTitle}}** 卡片，再点击右侧的 **{{ui:workflows.packs.version.change}}**，会列出可选择的版本。点击 **{{ui:workflows.packs.version.apply}}** 后，再点击一次 **{{ui:workflows.packs.version.confirm}}** 即开始切换。已安装的扩展都会重新安装，需要几分钟，期间无法生成图像。如果新版本无法启动，会恢复为原来的版本。

> 扩展是在你的电脑上运行的程序。来源不明的，请不要安装。

> 连接着不是由应用管理的 ComfyUI 时，无法从这个界面安装。请在该 ComfyUI 一侧安装。

[修饰与复用图像](04-improve.md) 中的“{{ui:cutout.menu}}”和“{{ui:facefix.menu}}”等使用扩展的功能，在需要时，也会同样指引安装。
