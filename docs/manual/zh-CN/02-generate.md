# 生成图像

本章介绍如何在 **{{ui:app.tabs.generate}}** 标签页中生成图像。
界面各部分的介绍请看 [开始之前](01-start.md)，生成图像的查看与整理请看 [图库与查看器](03-gallery.md)。

生成的流程始终相同。

1. 选择模型
2. 写提示词
3. 如有需要，调整尺寸、种子等设置
4. 点击 **{{ui:params.invoke.invoke}}**

点击后并不是马上开始绘制，而是先进入“{{ui:app.tabs.queue}}”（等待的队伍）。轮到时，会一张一张地绘制。

## 写提示词

![在提示词中写了一句话、并将种子设为固定的生成标签页](shot:generate-prompt)

左侧面板的“{{ui:params.prompt.title}}”中有 2 个输入栏。

- **{{ui:params.prompt.positive}}**：写下希望画出的内容。
- **{{ui:params.prompt.negative}}**：写下不希望出现的内容。例如 `blurry, watermark`（模糊、水印文字）。留空也可以生成。

书写的参考如下。

- 用逗号（`,`）分隔单词或短句并依次排列。
- 多数模型使用英文更容易得到想要的效果。如果模型的说明中有书写方式的要求，请遵照。
- 重要的词放在前面。

输入栏上方的小按钮的作用如下。

| 按钮 | 作用 |
|---|---|
| **{{ui:params.prompt.recommended}}** | 将适合当前所选模型的品质用词（`masterpiece, best quality` 等）添加到“{{ui:params.prompt.positive}}”的开头，将常用的想要避免的词添加到“{{ui:params.prompt.negative}}”的末尾。已经存在的词不会重复添加 |
| **{{ui:params.prompt.expand}}** | 在左右并排的大窗口中编辑正向和反向提示词 |
| **{{ui:params.promptBook.open}}** | 打开带含义的单词收集列表（见后文） |
| **{{ui:caption.fromPrompt}}** | 查看图像，写出可用作提示词的文字。也可以把图库中的图像或电脑里的图像文件拖到这个按钮上（在[修饰与复用图像](04-improve.md)中说明） |
| 各输入栏的“预设” | 仅保存、调用提示词的文字（见后文） |

### token 数

输入栏上方的“0 / 77 个 token”，是当前所写内容分量的参考。
token 是模型读取文字时的分段单位。超过上限后，数字会变成警告色。对于某些模型，超出上限的部分可能不太起作用。
这个数字只是“大致”的值，并不精确。

### 批量生成组合 `{red|blue}`

在正向输入栏中，像 `{red|blue}` 这样，在花括号里用竖线（`|`）分隔书写，每个选项都会生成一张不同的图。

- 写成 `a {red|blue} flower`，就会得到 `a red flower` 和 `a blue flower` 两种。
- 写 2 对或更多花括号时，会得到所有的组合。`a {red|blue} {cat|dog}` 就是 4 种。
- 花括号里面也可以再放花括号。
- 想把花括号本身当作文字使用时，在前面加 `\`（`\{`）。
- 组合的数量最多为 100 种。

当“{{ui:params.invoke.iterations}}”（见后文）为 2 或以上时，会生成“组合数 × 数量”张图。例如 2 种组合、数量为 3，就是 6 张。
这种写法只能用于正向输入栏。在反向输入栏中，花括号会按原样当作文字处理。

会展开成什么样的句子，可以用正向输入栏上方的 **{{ui:params.prompt.dynamicPreview}}** 按钮（`{ }` 图标）确认。点击后会显示组合的列表。

### 通配符 `__名称__`

![通配符窗口。左侧是列表，右侧是所选列表的名称和条目](shot:wildcards)

在正向输入栏中写 `__名称__`（名称前后各两个下划线），就会从该名称的“{{ui:params.wildcards.title}}”列表中逐一代入条目。把常用的选项做成列表，就不必每次都写 `{red|blue}`。

- 写成 `1girl, __hair-color__`，会按列表 hair-color 的条目数生成相应数量的提示词。
- 条目中也可以写 `{a|b}` 或其他通配符。通配符中的通配符最多 6 层。
- 组合数的上限（100 种）与 `{ }` 相同。
- 如果写了不存在的名称、没有条目的列表，或引用自身的列表，就无法按 **{{ui:params.invoke.invoke}}**，按钮下方会显示原因。

列表从 **{{ui:params.prompt.dynamicPreview}}** 按钮窗口最下方的 **{{ui:params.wildcards.open}}** 打开。一开始就有 hair-color（发色）、expression（表情）、time-of-day（时段）这 3 个列表。

| 操作 | 作用 |
|---|---|
| **{{ui:params.wildcards.new}}** | 添加一个空列表 |
| “{{ui:params.wildcards.name}}”栏 | 修改列表名称。可使用字母、数字、`-` 和 `_`，首尾须为字母或数字 |
| “{{ui:params.wildcards.entries}}”栏 | 每行写一个。空行和以 `#` 开头的行不算条目 |
| **{{ui:params.wildcards.import}}** / **{{ui:params.wildcards.export}}** | 将一个列表读写为每行一个条目的 .txt 文件。导入的文件会成为以文件名命名的新列表 |
| **{{ui:common.delete}}** | 删除所选列表 |

列表保存在本应用中（当前使用的电脑上）。

### 随机选取

组合过多时，在 **{{ui:params.prompt.dynamicPreview}}** 按钮的窗口中切换“{{ui:params.prompt.dynamicMode}}”。

- **{{ui:params.prompt.modeCombinatorial}}**（默认）：每种组合各生成设定张数的图像。
- **{{ui:params.prompt.modeRandom}}**：按设定张数生成图像，每张选取一种组合。选哪一种由该图像的种子决定，因此用相同种子重画会得到相同的提示词。

无论哪种方式，生成的图像都会保存实际使用的提示词。

## 种子

图像是由名为“{{ui:params.seed.label}}”的数字生成的。相同的种子加上相同的设置，会得到相同的图像。

在左侧面板上方的“{{ui:params.seed.label}}”一行中，有 2 个按钮。

- **{{ui:params.seed.random}}**（骰子）：每次生成都使用新的种子。每次都是不同的图像。初始状态是这个。
- **{{ui:params.seed.fixed}}**（锁）：用当前的种子绘制。用相同的设置生成多少次，都是同一张图。想看提示词改动一个词后的差别时很方便。

设为固定后，种子的数字栏和“{{ui:params.seed.shuffle}}”按钮会被锁定（防止不小心改动）。
想使用指定的数字时，请在“{{ui:params.seed.random}}”状态下把数字填入数字栏，再切换到“{{ui:params.seed.fixed}}”。
想使用喜欢的图像的种子时，在图库中打开那张图，点击“{{ui:gallery.menu.useSeed}}”，就能把种子设为固定并载入（参见 [图库与查看器](03-gallery.md)）。

保持固定并增加数量时，第 2 张起的种子会依次加 1。

## 选择模型

![打开的模型列表。按 FLUX、SDXL、SD1.X 等系列分组](shot:model-picker)

在左侧面板上方的模型卡片中，选择用于绘图的模型。

1. 点击模型名称栏。
2. 从列表中选择。列表按模型的系列（FLUX、SDXL、SD1.X 等）分组。数量很多时，可以在上方搜索栏中输入名称的一部分来筛选。
3. 选中的模型会打上 ✓，卡片上的图像（封面图像）也会随之切换。

列表下方的 **{{ui:app.tabs.short.models}}** 按钮可以跳转到{{ui:app.tabs.models}}标签页（管理已有模型），**{{ui:app.tabs.short.browse}}** 按钮可以跳转到{{ui:app.tabs.browse}}标签页（在网络上查找）。增加模型的方法在 [准备模型](08-models.md) 中介绍。

如果模型登记了推荐设置（步数、CFG、调度器、尺寸），选择模型时会自动填入。
切换到系列不同的模型时，与新模型不匹配的 LoRA 等会被移除（会通知移除了多少个）。

点击模型栏下方的 **{{ui:params.profile.title}}** 按钮，会列出该模型的推荐值。当前设置与推荐值有偏差时，按钮会变成醒目的颜色，点击 **{{ui:params.profile.apply}}** 就能统一为推荐值。

> 一个模型都没有时，栏中会显示“{{ui:params.model.noModels}}”，无法生成。请先完成 [准备模型](08-models.md)。

## 其他设置

提示词下方排列着汇总各项设置的分区。点击可以展开或收起。

| 分区 | 包含的内容 |
|---|---|
| **{{ui:params.refImage.sectionLabel}}**（提示词的正下方） | 用来让图像的氛围或登场人物更接近的图像（见后文） |
| **{{ui:params.image.title}}** | {{ui:params.image.aspect}}、宽度和高度。还有“{{ui:params.image.swap}}”“{{ui:params.image.lock}}”“{{ui:params.image.optimal}}”按钮 |
| **{{ui:params.generation.title}}** | LoRA（用于添加画风或人物的小型附加模型）、{{ui:params.generation.scheduler}}、{{ui:params.generation.steps}}、{{ui:params.generation.cfg}} |
| **{{ui:params.hires.title}}** | 将画好的图像放大后再画一遍的第二遍生成（后述） |
| **{{ui:params.advanced.title}}** | {{ui:params.advanced.vae}}、{{ui:params.advanced.clipSkip}}、{{ui:params.advanced.seamless}}（拼接后不出现接缝的图像）等 |

拿不准的话，除尺寸外，保持选择模型时自动填入的内容即可。
把光标移到项目名称（“{{ui:params.generation.steps}}”“{{ui:params.generation.cfg}}”等）上，会显示简短的说明。分区的标题处会以小字显示当前值的摘要。

尺寸越大，耗时和对电脑的负担就越大。建议先用较小的尺寸试一试，满意后再用 [放大](06-upscaling-workflows.md) 变大。

## 高分辨率修复

![打开并启用高分辨率修复区块的样子](shot:hires-fix)

一开始就用大尺寸绘制，容易出现人物变成两个或形状崩坏。**{{ui:params.hires.title}}** 会先按设定的尺寸绘制，放大后再用相同的种子和设置重画一遍。一次生成就能得到细节完整的大图。此区块在 {{ui:app.tabs.generate}} 标签页和 {{ui:app.tabs.comic}} 标签页中。

- **{{ui:params.hires.enable}}**：打开即可使用。
- **{{ui:params.hires.scale}}**：1.25～2 倍。最终尺寸显示在区块标题和最下面一行。
- **{{ui:params.hires.strength}}**：0.2～0.75。低时几乎保留第一遍的图像，高时会大幅重画。默认是 0.45。
- **{{ui:params.hires.method}}**：**{{ui:params.hires.methodSmooth}}** 不使用模型放大。如果装有 {{ui:app.tabs.upscaling}} 标签页使用的放大模型，也可以选择它们。
- **{{ui:params.hires.steps}}**：第二遍的步数。为 0 时与第一遍步数相同。

耗时相当于画两遍。进度会把两遍连起来计算。LoRA 和参考图像在第二遍也会使用。

当最终尺寸远超模型擅长的大小（长边 SDXL 约 2048 px，SD1.X 约 1536 px）时，生成按钮下方会显示提示。仍然可以生成；如果画面崩坏，请降低放大倍率。

图像会保存第一遍的尺寸和{{ui:params.hires.title}}的设置。在图库中用“{{ui:gallery.menu.useAll}}”读取时，{{ui:params.hires.title}}也会按原样填入。

## 生成次数与生成按钮

![点击生成按钮旁的箭头后展开的菜单](shot:invoke-menu)

左侧面板上方汇集了生成的操作。

- **{{ui:params.invoke.invoke}}**（蓝色按钮）：添加到队列末尾并生成。也可以按 `Ctrl+Enter`。
- **× 旁边的数字**：一次操作生成的张数。设为“3”就生成 3 张。
- **红色的 × 按钮**：取消正在绘制的内容。
- 各按钮右侧的 **∨**：其他操作的菜单。

无法点击时，按钮会变灰，按钮下面一行会显示原因（例如没有选择模型）。把光标移到按钮上，可以看到原因的列表。
绘制过程中，按钮会变为“{{ui:params.invoke.generating}}”，并显示进度（%）和队列中等待的数量。

### 生成按钮的 ∨ 菜单

- **{{ui:params.invoke.addBack}}**（`Ctrl+Enter`）：按点击的顺序排队绘制。与通常的生成相同。
- **{{ui:params.invoke.addFront}}**（`Ctrl+Shift+Enter`）：插队到等待队伍的最前面。想紧急试一张时使用。
- **{{ui:xyplot.menu}}**：以当前设置为基础，把只改了 1～2 项设置的图像并排放进一张表中。因为使用相同的种子绘制，所以差别只来自改动的设置。在横向和纵向选择 CFG 比例、步数、模型等，填入数值后点击 **{{ui:xyplot.run}}**。

### 取消菜单

点击红色 × 按钮右侧的 ∨，会出现下面的菜单。

- **{{ui:params.invoke.cancelCurrent}}**（`Shift+X`）
- **{{ui:params.invoke.clearQueue}}**（`Ctrl+Shift+X`）：清除所有等待中和正在绘制的内容。不会弹出确认。
- **{{ui:params.invoke.pause}}** / **{{ui:params.invoke.resume}}**：暂停或恢复队列的处理。
- **{{ui:params.invoke.openQueue}}**

## 查看生成好的图像

![生成结束后的画面。中央的查看器中显示着图像，右侧的图库中也排列着](shot:generate-result)

点击后，中央会立刻切换为查看器。
绘制过程中，右侧图库上方会出现“{{ui:gallery.generating.title}}”横条，可以看到中途的图像、步数和进度。中央上边缘的细线也表示进度。

生成完成后，图像会加入图库，查看器中显示该图像。
图像会保存到当前所选的（右侧面板中带有“{{ui:gallery.boards.autoBadge}}”标记的）画板中。关于画板，以及图像的整理、比较和重做，在 [图库与查看器](03-gallery.md) 中介绍。

> 如果查看器自动切换到新图像让你觉得碍事，请在{{ui:gallery.settings.title}}（齿轮按钮）中关闭“{{ui:gallery.settings.autoSwitch}}”。

## 预设

![预设列表。排列着内置的预设和已保存的预设](shot:presets)

常用的设置组合可以保存为预设。点击左侧面板最上方的“{{ui:presets.label}}”卡片，会展开列表。

预设中会一并包含以下内容。

- 提示词（正向和反向）
- 模型和各项设置（尺寸、步数、CFG、调度器、VAE 等）
- LoRA 和参考图像

种子和数量不包含在内。

使用方法如下。

- 点击列表中的项目，该设置就会被应用（**{{ui:presets.apply}}**）。
- 用列表下方的 **{{ui:presets.saveNew}}**（或卡片旁边的保存按钮），为当前设置命名并保存。
- 项目右侧的“…”中，可以进行 **{{ui:presets.apply}}**、**{{ui:presets.overwrite}}**、**{{ui:presets.rename}}**、**{{ui:presets.delete}}**。
- 列表分为“{{ui:presets.group.mine}}”和“{{ui:presets.group.builtin}}”。内置预设是一开始就有的示例。

除此之外，正向、反向各输入栏的上方也有“预设”栏。这里仅保存、调用提示词的文字。适合保存固定用语（品质用词，或想要避免的词的组合）。

## 提示词列表

![提示词列表。按分类排列着单词和含义，并有“正向”“反向”添加按钮](shot:prompt-book)

为了让你即使不记得英文单词也能组合出提示词，提供了 **{{ui:params.promptBook.open}}**。从正向、反向各输入栏上方的按钮打开。

- 在左侧选择分类（发型、表情、服装、构图等），就只会列出该分类的单词。上方的搜索栏可以同时按单词、含义、分类、备注查找。
- 点击单词右侧的“{{ui:params.prompt.positive}}”“{{ui:params.prompt.negative}}”，该单词就会添加到提示词中。添加过的单词会打上勾，再点击一次就会取消。
- 在最上方的输入栏中填入单词和含义，点击 **{{ui:params.promptBook.register}}**，就能添加自己的单词。单词右侧的铅笔用于编辑，垃圾桶用于删除。

## 参考图像

**{{ui:params.refImage.sectionLabel}}** 是用来让新图像向已有图像的“氛围”和“风格”靠拢的功能。它并不是原样复制，而是以色彩运用、画风和整体印象作为线索。

1. 点击提示词下方的 **＋** 按钮，添加 1 个框。
2. 把图库中的图像拖放到该框中。拖放电脑中的图像文件也可以使用。
3. 点击该框，会打开设置小窗口。

在小窗口中，可以确定以下内容。

- **{{ui:params.refImage.model}}**：参考图像专用的模型（IP-Adapter）。需要与所选模型系列相匹配的模型。
- **{{ui:params.refImage.methodLabel}}**：整体、仅风格、仅构图等，以什么作为线索（根据模型系列，可能不会显示）。
- **{{ui:params.refImage.weight}}**：靠拢的强度。
- **{{ui:params.refImage.begin}}** 和 **{{ui:params.refImage.end}}**：在绘制过程的哪一段到哪一段起作用。

没有安装所需的模型或扩展时，框上会出现警告标记，小窗口和生成按钮下方会出现指引。可以通过指引中的按钮进行安装。

> 参考图像是用来“向氛围靠拢”的。想“以这张图为基础重新绘制”时，请使用画布。请参阅 [在画布上补画](05-canvas.md)。

### 角色

在参考图像上方的“{{ui:character.row.label}}”栏中，可以调用已注册的角色（同一角色的任意张图像，附带外观描述词）。
选择后，会设置该角色的参考图像和外观描述词。角色的注册方法在 [修饰与复用图像](04-improve.md) 中介绍。

## 队列

![队列标签页。列出了处理中的项目和等待中的项目](shot:queue)

在 **{{ui:app.tabs.queue}}** 标签页中，可以查看和操作生成的队列。有等待的项目时，侧边导航的{{ui:app.tabs.queue}}上会出现数量徽标。

画面上方有以下内容。

- 处理的状态（“{{ui:queue.processor.running}}”或“{{ui:queue.processor.paused}}”）和操作按钮。
- 项目数量的明细（{{ui:queue.status.pending}}、{{ui:queue.status.inProgress}}、{{ui:queue.status.completed}}、{{ui:queue.status.failed}}、{{ui:queue.status.canceled}}）。
- 右上方是当前正在绘制的项目的进度。

按钮的作用如下。

| 按钮 | 作用 |
|---|---|
| **{{ui:queue.action.pause}}** / **{{ui:queue.action.resume}}** | 暂停、恢复队列的处理。正在绘制的内容会照常画完 |
| **{{ui:queue.action.cancelCurrent}}** | 停止正在绘制的内容 |
| **{{ui:queue.action.cancelAllExceptCurrent}}** | 取消所有等待中的内容 |
| **{{ui:queue.action.prune}}** | 把已结束的项目（完成、失败、已取消）从列表中清除 |
| **{{ui:queue.action.clear}}** | 清除所有项目。会弹出确认窗口 |

点击下方列表中的行，会展开该项目的详细信息（时间、生成的图像、失败时的原因、设置的内容）。
点击行右侧的 × 可以只取消该项目。失败或已取消的项目上会出现重做按钮。

## 快捷键

在输入文字时不起作用的快捷键，请先离开输入栏再按。

| 操作 | 按键 |
|---|---|
| 生成（添加到队列末尾） | `Ctrl+Enter`（输入提示词时也可使用） |
| 添加到队列最前面并生成 | `Ctrl+Shift+Enter` |
| 取消正在绘制的内容 | `Shift+X` |
| 清除全部队列（无确认） | `Ctrl+Shift+X` |
| 移到提示词栏 | `Alt+A` |
| 展开、收起左侧面板、右侧面板 | `T`、`G` |
| 同时展开、收起左右面板 | `F` |
| 切换标签页（从{{ui:app.tabs.generate}}到{{ui:app.tabs.queue}}的顺序） | `1` 到 `9` |
| 打开快捷键列表 | `Shift+?` |

快捷键也可以在侧边导航的 **{{ui:app.nav.settings}}** 菜单中的“{{ui:app.nav.hotkeys}}”里确认。
