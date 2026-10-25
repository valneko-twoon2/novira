# 画布

![画布标签页的整体。中央是画布，右下是图层的列表](shot:canvas)

**{{ui:app.tabs.canvas}}** 标签页是用来“绘制、摆放、只重绘局部”图像的工作台。可以摆放并扩展图像，在想重绘的地方加上遮罩，或者用火柴人来确定姿势。

界面分为 3 个部分。

- 左侧：与生成标签页相同设置的面板（提示词、模型、尺寸等）。在画布中，会增加 **{{ui:params.compositing.title}}** 的项目。
- 中央：画布。上方排列着工具按钮。
- 右侧：放置图像的 **{{ui:canvas.layers.title}}** 列表。

在什么都没有的状态下点击 **{{ui:params.invoke.invoke}}**，会在虚线框（生成范围）中，像平常一样生成图像。画布真正的价值，在于把图像或草稿放进去之后才体现出来。 图层和遮罩会自动保存，重新打开应用时会恢复原状（撤销历史不会保存）。

## 放置、绘制图像

在画布上放置图像的方法有好几种。

- 用画笔绘制。没有选中图层时，会自动创建{{ui:canvas.add.raster}}。
- 把图库中的图像拖到画布上。会出现用来选择放置位置（栅格、控制、局部重绘遮罩等）的框，把图像放进去。
- 按 `Ctrl+V` 可将剪贴板中的图像粘贴为新的栅格图层（同时也会保存到图库）。
- 右键点击图库中的图像（在查看器中是画笔图标），从 **{{ui:gallery.menu.sendToCanvas}}** 中选择去向。

去向如下。

| 去向 | 变成什么 |
|---|---|
| **{{ui:gallery.canvas.newCanvasRaster}}** | 先把画布清空，以与这张图像相同的大小重新开始。 |
| **{{ui:gallery.canvas.newCanvasControl}}** | 同样重新开始，但图像会成为控制图层。 |
| **{{ui:gallery.canvas.raster}}** | 作为栅格图层添加到当前的画布中。 |
| **{{ui:gallery.canvas.control}}** | 作为控制图层添加。 |
| **{{ui:gallery.canvas.inpaint}}** | 作为局部重绘遮罩添加。 |
| **{{ui:gallery.canvas.regional}}** | 作为区域引导的参考图像添加（请看 [区域引导](#区域引导暂时还不能使用)）。 |

## 工具

上方的栏中排列着工具。也可以用键盘的字母键来切换。

| 工具 | 按键 | 用途 |
|---|---|---|
| **{{ui:canvas.tool.brush}}** | `B` | 绘制图像。颜色用栏中的颜色按钮来更改。 |
| **{{ui:canvas.tool.eraser}}** | `E` | 擦除画过的地方。 |
| **{{ui:canvas.tool.mosaic}}** | `M` | 把涂抹的地方变成马赛克（用来遮挡）。方块大小在工具栏的数字里调整。只对有图像的图层有效。 |
| **{{ui:canvas.tool.rect}}** | `U` | 涂出矩形。 |
| **{{ui:canvas.tool.lasso}}** | `L` | 圈出自由形状并用颜色填充（在遮罩上则成为遮罩区域）。 |
| **{{ui:canvas.tool.pose}}** | `O` | 在控制图层上放置火柴人姿势，并移动关节（见下文“在画布上制作姿势”）。 |
| **{{ui:canvas.tool.move}}** | `V` | 移动图层。方向键可将所选图层每次移动 1 px（按住 Shift 为 10 px）。 |
| **{{ui:canvas.tool.bbox}}** | `C` | 移动生成范围（边界框）、改变其大小。 |
| **{{ui:canvas.tool.view}}** | `H` | 平移显示。 |
| **{{ui:canvas.tool.colorPicker}}** | `I` | 从图像中拾取颜色。 |

此外，还可以进行下面的操作。

- 画笔的粗细，用栏中的 **{{ui:canvas.toolbar.brushWidth}}**，或 `[` 和 `]` 键来改变。按 `Q` 可以与上一次使用的工具互相切换。
- 放大、缩小用鼠标滚轮，或 `+` 和 `-` 键。按 `Ctrl+0` 可以看到整体，按 `Ctrl+1` 则变为实际大小（100%）。
- 要平移显示，按住 `Space` 拖动，或按住滚轮按钮拖动。
- 用 **{{ui:canvas.toolbar.undo}}**（`Ctrl+Z`）和 **{{ui:canvas.toolbar.redo}}**（`Ctrl+Shift+Z`），可以撤销或重做绘制的内容。

齿轮的 **{{ui:canvas.settings.title}}** 中有：显示网格、把生成范围之外变暗的显示、让绘制的线条只落在生成范围内的设置、把可见的栅格图层合并为一个的操作等。

## 生成范围（边界框）

画布中的虚线框，是“这次生成图像的范围”。每次生成，只会生成这个框里的内容，它的大小就是图像的大小。

- 切换到 **{{ui:canvas.tool.bbox}}**（`C`），拖动框来移动。拖动角或边，可以改变大小。
- 也可以用左侧面板的 **{{ui:params.image.bboxWidth}}** 和 **{{ui:params.image.bboxHeight}}** 来确定大小。
- 用 **{{ui:canvas.actions.fitBboxToLayers}}**（`Shift+C`），可以让框贴合已放置的图像。

## 图层

在右下的 **{{ui:canvas.layers.title}}** 中，会列出画布上放置的内容。用 **{{ui:common.add}}** 按钮来添加。

![打开图层“添加”菜单的样子](shot:canvas-add-layer)

图层有几种作用不同的类型。

| 类型 | 作用 |
|---|---|
| **{{ui:canvas.add.raster}}** | 普通的图像图层。在这里绘制或放置图像。这里的内容会成为“原图”。 |
| **{{ui:canvas.add.control}}** | 作为形状、线条、姿势等线索的图像。它是生成的指示，不会成为图像的内容。 |
| **{{ui:canvas.add.inpaint}}** | 涂抹出“重绘这里”的范围。 |
| **{{ui:canvas.add.regional}}** | 为不同位置指定不同提示词的图层。在目前的桌面版中，无法用于生成。 |
| **{{ui:canvas.add.globalRef}}** | 模仿整幅图像氛围的参考图像。与生成标签页的参考图像相同。 |

在图层列表中，可以进行下面的操作。

- 用眼睛图标切换显示与隐藏，用锁图标切换锁定。隐藏的图层不会用于生成。锁定的图层无法绘制。
- 双击名称，可以改名。
- 右键点击，可以复制、调整顺序（前后移动；同类图层也可以在列表中拖动来调整顺序）、**{{ui:canvas.entityMenu.flipHorizontal}}**、**{{ui:canvas.entityMenu.flipVertical}}**、**{{ui:canvas.entityMenu.rotateRight}}**、**{{ui:canvas.entityMenu.rotateLeft}}**、**{{ui:canvas.entityMenu.scaleUp}}**、**{{ui:canvas.entityMenu.scaleDown}}**、**{{ui:canvas.pose.random}}**（仅限控制图层）、转换为其他类型、复制到剪贴板、**{{ui:canvas.entityMenu.saveToGallery}}**、**{{ui:canvas.entityMenu.exportToFile}}**、删除。
- 从 **{{ui:canvas.layers.more}}**（“…”）中，还可以把可见的栅格图层合并为一个、删除所有图层。

![图层的右键菜单](shot:canvas-layer-menu)

选中的图层下方，会展开该图层的设置。

- {{ui:canvas.add.inpaint}}：遮罩的颜色和涂抹的花纹（仅影响画面上的显示）、**{{ui:canvas.mask.denoiseLimit}}**（打开并调低后，即使在遮罩内也更容易保留原图）。右键菜单中的 **{{ui:canvas.entityMenu.invertMask}}** 可以把生成范围内被遮罩和未遮罩的部分互换。
- {{ui:canvas.add.control}}：请看下一节“{{ui:canvas.add.control}}”。

## 会如何重绘

在画布中点击 **{{ui:params.invoke.invoke}}** 后，应用会查看生成范围内的内容，自动决定生成图像的方式。不需要自己选择。

| 生成范围内的状态 | 生成方式 |
|---|---|
| 可见的栅格图层上什么都没画 | 用文字重新生成（文生图）。 |
| 栅格图层上只有一部分被填充 | 补全空着的部分并扩展（外绘）。空的部分会先用颜色填充。 |
| 整体都被填充，且局部重绘遮罩上没有涂抹 | 以现有的图像为基础重新绘制（图生图）。 |
| 整体都被填充，且局部重绘遮罩上有涂抹 | 只重绘遮罩的部分（局部重绘）。遮罩之外保持原图。 |

图生图时的改变程度，用左侧面板的 **{{ui:params.image.strength}}** 来确定。0 表示保持原样，1 表示完全重绘。

外绘时用什么来填充空的部分，在左侧面板 **{{ui:params.compositing.title}}** 中的 **{{ui:params.compositing.infillTitle}}** 里选择。选择 **{{ui:params.compositing.infill.color}}** 时，会用所选的颜色（黑、白、灰等）填充。选择其他选项时，会融合周围的颜色来填充。衔接处的模糊程度，用 **{{ui:params.compositing.maskBlur}}** 来确定。

> 局部重绘用普通的模型就可以直接使用。不需要专门的“局部重绘用模型”。

## 决定是否采用结果（暂存）

在画布中生成的图像，不会立刻进入画布。它会叠加显示在生成范围上，用下方的栏（**{{ui:canvas.staging.title}}**）来决定是否采用。

| 按钮 | 做什么 |
|---|---|
| 左右箭头（`←` `→`） | 生成了多张时，查看下一张或上一张图像。 |
| **{{ui:canvas.staging.accept}}**（`Enter`） | 把这张图像作为新的栅格图层放入画布。其他图像会被丢弃。 |
| **{{ui:canvas.staging.hideResults}}** | 隐藏结果，与原图对比。 |
| **{{ui:canvas.staging.saveToGallery}}** | 把这张图像保存到图库。 |
| **{{ui:canvas.staging.discard}}** | 只丢弃这张图像。 |
| **{{ui:canvas.staging.discardAll}}**（`Esc`） | 全部丢弃。 |

> 结果的图像不会直接排列在图库中。想留在图库里的图像，请先点击 **{{ui:canvas.staging.saveToGallery}}**。丢弃的图像会消失。

结果栏最左边的把手（⋮⋮），用来把图像拖到其他位置。

## 控制图层

控制图层是“请沿着这个形状、这条线、这个姿势来画”的线索。可以放入线稿、轮廓、姿势的图像等。

使用时，需要与主模型相匹配的 ControlNet 模型。安装方法请看 [模型](08-models.md) 一章。选中图层，在设置中选择 **{{ui:common.model}}**。没有模型时，生成处会显示“控制图层 1 没有模型”等提示，无法生成。

设置如下。

- **{{ui:canvas.control.weight}}**：遵循线索的强度。
- **{{ui:canvas.control.begin}}** 和 **{{ui:canvas.control.end}}**：从生成过程的几成到几成起作用。
- **{{ui:canvas.control.controlMode}}**：有 **{{ui:canvas.control.mode.balanced}}** 和 **{{ui:canvas.control.mode.moreControl}}**。**{{ui:canvas.control.mode.morePrompt}}** 目前的行为与 **{{ui:canvas.control.mode.balanced}}** 相同。
- **{{ui:canvas.control.filter}}**：把图像转换为线条或深度等线索用的图像。这是在应用内进行的简易转换。用 **{{ui:canvas.control.process}}** 试一下，满意的话用 **{{ui:common.apply}}** 反映到图像上。

## 制作姿势（火柴人）

![用火柴人确定姿势的对话框](shot:pose)

可以移动火柴人来确定姿势。在用文字指定姿势效果不好时很方便。

1. 在 **{{ui:app.tabs.canvas}}** 标签页中，点击图层的 **{{ui:common.add}}**，选择 **{{ui:pose.menu}}**。
2. 从 **{{ui:pose.preset}}** 中选择接近的姿势（{{ui:pose.preset.standing}}、{{ui:pose.preset.armsUp}}、{{ui:pose.preset.sitting}}、{{ui:pose.preset.walking}}）。
3. 拖动关节的圆点来改变姿态。选中圆点后，也可以用方向键移动（按住 `Shift` 会大幅移动）。用 **{{ui:pose.mirror}}** 可以左右翻转，用 **{{ui:pose.reset}}** 可以回到最初的模板。
4. 选择 **{{ui:pose.size}}**。通常使用画布的大小即可。
5. 点击 **{{ui:pose.use}}**。

姿势会作为控制图层放入画布。画布为空时，会以该大小重新开始。

使用时，需要支持 OpenPose 的 ControlNet 模型。已安装的话，应用会自动把它选为图层的模型。没有安装时，会通过通知告知。安装模型后，请在图层的设置中选择。

> 只能确定 1 个人的姿势。无法确定手指和脸的朝向，所以脸和手请用提示词来指定。

> 姿势的作用强度，由图层的 **{{ui:canvas.control.weight}}** 决定。姿势图层会被设为一开始就是最大强度，并从头到尾起作用。想增加姿势的自由度时，请调低。

### 在画布上制作姿势

![用姿势工具在画布上放置了火柴人](shot:canvas-pose)

使用 **{{ui:canvas.tool.pose}}** 工具（`O`），可以直接在画布上制作姿势。放置好的姿势，之后可以随时反复修改。

- 点击空白处，会放置一个站立的火柴人。没有选中控制图层时，会新建一个控制图层，并设置姿势用的强度，以及支持 OpenPose 的模型（已安装的话）。
- 拖动关节的圆点，会连同其前端的肢体一起转动（骨骼的长度不变）。拖动脖子，整个身体都会移动。按住 `Shift` 拖动，则只移动该关节。
- 按住 `Alt` 点击关节，可以隐藏该关节，或再次显示（用于伸出画面之外的肢体等）。
- 按 `R` 键或栏中的 **{{ui:canvas.pose.random}}** 按钮，选中图层的姿势会变成新的随机姿势。可以随意反复按，所以能一直试到满意为止。
- 用姿势工具栏中的数字和闪电按钮，可以更换姿势并连续生成相应张数的图像（最多 16 张）。每个姿势的种子也会随之改变，所以相同的设置也能得到各种姿态的图像。如果当前无法生成，会显示原因，且不会开始。
- 一个图层中可以放置任意多个人。左右翻转、旋转、放大和缩小，可以通过图层的右键菜单进行。
- 也可以用文字来要求。在打开 **{{ui:app.tabs.canvas}}** 标签的状态下打开 AI 助手，说出“正在奔跑的姿势”“抬起左手”之类的描述，就会放置火柴人（最多 4 个）。放置之后再说“再稍微前倾一点”，它会修改该姿势。所要求的姿势是根据文字推测出来的，如果不符合预期，请拖动关节来修改。
- 也可以从图像中的人物生成。在图库中右键点击图像并选择 **{{ui:canvas.poseFromImage.menu}}**，或点击姿势工具栏中同名的按钮，就会读取图中人物的骨架并作为火柴人放置（最多 4 人）。放置后的姿势可以像普通姿势一样修改。使用它需要扩展（comfyui_controlnet_aux），如果没有安装，会当场提示安装。第一次读取时，下载模型需要一些时间。人物太小或被遮挡时，可能找不到。
- 点击姿势工具栏中的 **{{ui:canvas.pose.presets}}** 按钮会打开一个窗口，左侧是类别，右侧是每个姿势的卡片。卡片在与生成范围形状相同的框中画出 OpenPose 火柴人。“{{ui:canvas.pose.group.panel}}”（远近景别、两个人、三人以上、日常场景、戏剧与情绪）还决定了人物的位置和大小，并会替换所选图层的所有姿势。“{{ui:canvas.pose.group.standard}}”和“{{ui:canvas.pose.group.manga}}”会替换所选图层的第一个姿势，位置和大小保持不变；如果没有姿势，则放置一个新的。举起手臂或踢腿而超出范围的姿势会缩小到框内。
- 姿势工具栏中的 **{{ui:canvas.pose3d.menu}}** 按钮可以用 3D 编辑姿势（所选控制图层的第一个姿势；没有时从站立的人偶开始）。拖动关节时，骨骼长度保持不变，也可以让骨骼朝向里侧或外侧。拖动背景可转动身体，滚轮可缩放。**{{ui:canvas.pose3d.front}}**、**{{ui:canvas.pose3d.side}}**、**{{ui:canvas.pose3d.back}}**、**{{ui:canvas.pose3d.top}}** 按钮可切换到固定视角。点击 **{{ui:canvas.pose3d.apply}}** 后，当前看到的形状会作为姿势放到画布上（深度也会被记住，因此可以再次用 3D 打开并继续转动）；不点击直接关闭则保持原样。3D 显示需要浏览器的 WebGL，不可用时会给出提示。

![从图像生成的姿势，放到画布之前的确认](shot:canvas-pose-from-image)

![选择了“两个人”类别后的“常用姿势与构图”窗口](shot:canvas-pose-presets)

![用 3D 编辑姿势的对话框](shot:canvas-pose-3d)

想从照片中提取姿势时，可以使用 [工作流](06-upscaling-workflows.md) 的模板“{{ui:workflows.templates.poseControl.title}}”。

## 区域引导暂时还不能使用

**{{ui:canvas.add.regional}}** 虽然在界面上有提供，但在目前的桌面版中无法用于生成。如果存在带有涂抹的区域引导图层，生成会被拒绝，并显示失败的消息（英文）。在画布中生成时，请把区域引导图层隐藏或删除。

## 保存与收尾

- 要把画布中的图像保存到图库，点击上方栏的 **{{ui:canvas.toolbar.saveToGallery}}**（磁盘图标）。生成范围内可见的栅格图层，会被合并为 1 张保存。
- 只保存 1 个图层时，右键点击图层，选择 **{{ui:canvas.entityMenu.saveToGallery}}**。
- **{{ui:canvas.settings.title}}** 中还有 **{{ui:canvas.actions.clearCanvas}}**、**{{ui:canvas.actions.clearHistory}}**、**{{ui:canvas.actions.clearStaging}}**。**{{ui:canvas.actions.clearCanvas}}** 会删除所有图层。

修饰图像的功能，在 [修饰与复用图像](04-improve.md) 中也有。“{{ui:gallery.menu.segment}}”的结果，可以发送到画布，进一步重绘。
