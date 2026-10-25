# 视频、音乐、语音、Logo、文本

除了图像，novira 还可以生成视频、音乐、语音和 Logo，也可以在图像上加入文字和对话气泡。

它们都从 **{{ui:app.tabs.generate}}** 标签页的左侧面板中使用。图像的用法请先阅读 [生成图像](02-generate.md)。

## 切换要生成的内容

左侧面板的最上方，有一排只有图标的切换按钮。从左到右依次是 **{{ui:media.tab.image}}**、**{{ui:media.tab.video}}**、**{{ui:media.tab.music}}**、**{{ui:media.tab.voice}}**、**{{ui:media.tab.logo}}**、**{{ui:media.tab.text}}**、**{{ui:app.tabs.comic}}**。**{{ui:app.tabs.comic}}** 是制作漫画页面的界面（[绘制漫画](12-comic.md)）。

把鼠标移到图标上会显示名称。切换后，左侧面板和中间的显示，会变成该类型专用的内容。

## 通用的机制

视频、音乐、语音、Logo 的界面，形式都相同。

- 左侧面板的最上方，有可以一次性调用设置的 **{{ui:presets.label}}**。
- 其下方是开始生成的按钮。有缺少的内容时，按钮无法点击，紧接着下方会显示原因。
- 原因中出现“请先下载（要生成的内容）的模型”时，请从接下来出现的 **模型卡片** 中安装。
- 除了开始生成的按钮，也可以用 `Ctrl+Enter` 来生成。
- 生成过程中的情况（排队、生成中、失败的原因），会显示在中间界面的最上方。可以用 **{{ui:media.job.cancel}}** 停止。

> 生成一次只处理 1 项。在生成视频或音乐期间，图像等其他生成需要排队等待。等待中的项目也可以在 **{{ui:app.tabs.queue}}** 标签页中确认。

### 首先需要下载的模型

视频、音乐、语音、Logo，各自需要专用的模型。没有安装时，左侧面板会出现“模型卡片”。点击 **{{ui:pack.install}}**，应用会自动导入。

| 生成的内容 | 卡片的名称 | 大小的参考 |
|---|---|---|
| 视频 | {{ui:pack.title.video}} | 约 18 GB |
| 视频（高速版） | {{ui:pack.title.turbo}} | 与标准版共用的文件不会重复下载 |
| 音乐 | {{ui:pack.title.music}} | 约 10 GB |
| 语音 | {{ui:pack.title.voice}} | 约 9 GB |
| Logo | {{ui:pack.title.logo}} | 约 12 GB |

大小只是参考。准确的大小，请看卡片上显示的数字。

视频可以在标准版和高速版两个模型中选择。卡片会显示本机 GPU 的名称和显存，以及每个模型是否合适（**{{ui:media.choice.fit.comfortable}}**、**{{ui:media.choice.fit.tight}}**、**{{ui:media.choice.fit.short}}**）。适合本机的模型会标上 **{{ui:media.choice.recommended}}**。无法读取显存时，是否合适会显示为 **{{ui:media.choice.fit.unknown}}**。这只是大致的参考：即使标为 **{{ui:media.choice.fit.short}}**，也可能只是变慢而仍能运行。

下载只在最开始进行一次。进度会显示在卡片上，在任何画面的左下角“{{ui:media.downloads.title}}”框中也能看到，中途也可以 **{{ui:common.cancel}}**。失败时，卡片上会显示原因，按钮会变为 **{{ui:pack.retry}}**。

能知道下载大小的，还会显示剩余时间（“还剩约 2 分”）。剩余时间是根据下载速度估算的，刚开始的一小段时间不会显示。不知道大小的，或者在安装处理中，会显示从开始起经过的时间。下载扩展时，可以从框中的 **{{ui:media.downloads.manage}}** 打开已安装扩展的列表。

安装完成后，卡片会消失。只有语音，因为会一并安装朗读用的引擎，所以需要多花一点时间。

> 下载之前，需要先完成生成图像的引擎（ComfyUI）的准备。进行得不顺利时，请看 [遇到问题时](10-troubleshooting.md)。

## 生成视频

![视频界面。左侧是生成方式、提示词、尺寸等设置，中间显示生成的视频列表](shot:media-video)

视频有用文字生成的方式，和让 1 张图像动起来的方式。

### 生成方法

1. 在左侧面板中选择 **{{ui:media.tab.video}}**。
2. 如果是第一次，在 **{{ui:pack.title.video}}** 的卡片上点击 **{{ui:pack.install}}**。
3. 在 **{{ui:video.mode.label}}** 中选择 **{{ui:video.mode.text}}** 或 **{{ui:video.mode.image}}**。
4. 在 **{{ui:video.prompt}}** 中写下想要什么样的视频。用图像生成时，写下想让它怎样动。
5. 点击 **{{ui:params.invoke.invoke}}**。

选择 **{{ui:video.mode.image}}** 后，会出现指定要让其动起来的图像的栏。可以放入图像，或在图库中选好图像后点击 **{{ui:video.pickFromGallery}}**。

也可以右键点击图库中的图像，选择 **{{ui:gallery.menu.sendToVideo}}**。

### 设置

| 项目 | 内容 |
|---|---|
| {{ui:video.negative}} | 不想出现的元素。一开始就填有避免模糊、文字等的词 |
| {{ui:video.model}} | **{{ui:video.model.standard}}** 生成得更细致。**{{ui:video.model.fast}}** 可以在较短时间内生成，但细节可能会变粗糙 |
| {{ui:video.size}} | 视频的大小。起初是 832×480。也可以选择竖版和正方形 |
| {{ui:video.fps}} | 每秒的帧数（8～30） |
| {{ui:video.lengthLabel}} | 1～10 秒。帧数由长度和帧率自动决定 |
| {{ui:video.steps}}、{{ui:video.cfg}} | 完成效果的细致调整。选择模型后，会切换为适合该模型的值 |
| {{ui:video.randomSeed}} | 关闭后，可以确定种子，重新生成相同的动作 |

要使用 **{{ui:video.model.fast}}**，需要另外下载 **{{ui:pack.title.turbo}}**。这个模型是非商用许可。

### GPU 显存较少时

**{{ui:video.light.title}}** 中有 2 个开关。

- **{{ui:video.light.fp8}}**：模型所用的显存几乎减半。细节可能会略微变粗糙。
- **{{ui:video.light.tiled}}**：抑制最后收尾时显存的骤增。画质不变，速度稍慢。

仍然不够时，也可以用较小的尺寸生成，再用 **{{ui:video.finish}}** 把生成好的视频放大。

### 结果

视频需要几分钟到十几分钟。生成完成后，会作为视频列表排列在中间，可以当场播放。右侧的图库中，也会作为带有 ▶ 的缩略图进入。

每个视频的下方，会显示提示词、大小、长度和种子。可以用垃圾桶按钮删除。

点击 **{{ui:video.finish}}**，会打开 **{{ui:finish.title}}** 界面。

- **{{ui:finish.smooth.title}}**：补充帧与帧之间的内容，使动作更流畅。
- **{{ui:finish.enlarge.title}}**：用放大模型把视频变大。会占用较多时间和显存。

原视频会保留，并增加收尾后的新视频。补帧时可能需要扩展（请按照界面的指引点击 **{{ui:finish.install}}**）。

## 生成音乐

![音乐界面。左侧排列着风格、歌词、长度、节奏等设置](shot:media-music)

根据文字（风格）和歌词，生成乐曲。

### 生成方法

1. 在左侧面板中选择 **{{ui:media.tab.music}}**。
2. 如果是第一次，在 **{{ui:pack.title.music}}** 的卡片上点击 **{{ui:pack.install}}**。
3. 在 **{{ui:music.tags}}** 中，用逗号分隔，写下流派、氛围和乐器。例如 `upbeat J-pop, female vocal, piano, bright`。
4. 要生成带歌声的乐曲，请填写 **{{ui:music.lyrics}}**。不要歌声时，勾选 **{{ui:music.instrumental}}**。
5. 点击 **{{ui:params.invoke.invoke}}**。

风格是必填项。留空无法生成。

歌词可以像 `[verse]`（主歌）、`[chorus]`（副歌）这样，用方括号来标注分段。可以用英语、日语、中文等书写。用 **{{ui:music.language}}** 选择歌词的语言。拿不准时，选择 **{{ui:music.lang.unknown}}**。

### 设置

| 项目 | 内容 |
|---|---|
| {{ui:music.lengthLabel}} | 10～240 秒 |
| {{ui:music.bpm}} | 乐曲的速度（40～220） |
| {{ui:music.timeSignature}} | 2/4、3/4、4/4、6/4 |
| {{ui:music.key}} | 从 `C major` 到 `B minor` |
| {{ui:music.steps}}、{{ui:music.cfg}} | 完成效果的细致调整 |

### 结果

乐曲在几十秒到几分钟内，会排列在中间的列表中。每首都带有播放器，可以直接播放。会显示长度、速度、调、种子，有歌词时，可以打开 **{{ui:audio.lyrics}}** 来查看。

在图库中，也会以音符缩略图的形式进入。

## 生成语音

![语音界面。左侧排列着要朗读的文本、语言、音色的选择方式](shot:media-voice)

把输入的文本转为声音朗读出来。

### 生成方法

1. 在左侧面板中选择 **{{ui:media.tab.voice}}**。
2. 如果是第一次，在 **{{ui:pack.title.voice}}** 的卡片上点击 **{{ui:pack.install}}**。朗读的引擎和模型，只会安装在应用的文件夹中。
3. 在 **{{ui:voice.text}}** 中，输入想朗读的文本。
4. 选择 **{{ui:voice.language}}**。选 **{{ui:voice.lang.Auto}}** 时，会根据文本判断。
5. 确定声音（见下文）。
6. 点击 **{{ui:params.invoke.invoke}}**。

### 声音的确定方式

用 **{{ui:voice.mode.label}}** 可以从 2 种方式中选择。

- **{{ui:voice.mode.preset}}**：从准备好的音色中选择。有日语女声、中文、英语男声、韩语女声等，名称后面会显示语言和性别。在 **{{ui:voice.style}}** 中写上“开朗有活力”“缓慢沉稳”之类的话，还可以指定说话方式。
- **{{ui:voice.mode.design}}**：在 **{{ui:voice.description}}** 中，用文字写下声音的特征。例如“沉稳偏低的男声。说话缓慢、温柔。”说明是必填项。

可以朗读的语言有：日语、英语、中文、韩语、德语、法语、俄语、葡萄牙语、西班牙语、意大利语。

### 结果

生成好的语音，会带着播放器排列在中间的列表中。使用的音色（{{ui:audio.voice.designed}}时显示“{{ui:audio.voice.designed}}”）和语言也会显示。也会进入图库。

第一次生成时，因为要加载模型，会花一点时间。一段时间不使用后，模型会从 GPU 中卸载，显存会还给其他工作。

## 生成 Logo

![Logo 界面。左侧排列着 Logo 的文字、风格、形状、候选数量](shot:media-logo)

生成带文字的 Logo 候选。

### 生成方法

1. 在左侧面板中选择 **{{ui:media.tab.logo}}**。
2. 如果是第一次，在 **{{ui:pack.title.logo}}** 的卡片上点击 **{{ui:pack.install}}**。
3. 在 **{{ui:logo.text}}** 中，输入要放进 Logo 的文字（最多 60 个字符）。
4. 在 **{{ui:logo.style}}** 中，写下氛围、颜色和形状。用中文或英文都可以。例如“极简、蓝白、几何”。
5. 在 **{{ui:logo.size}}** 中，从 **{{ui:logo.size.square}}**、**{{ui:logo.size.wide}}**、**{{ui:logo.size.tall}}** 中选择形状。
6. 从 1～4 中选择 **{{ui:logo.countLabel}}**，点击 **{{ui:params.invoke.invoke}}**。

### 结果与叠加文字

生成好的 Logo，会作为候选排列在中间。在图库中，它们进入的是 **{{ui:gallery.view.assets}}** 而不是 **{{ui:gallery.view.images}}**。打开生成 Logo 的界面后，右侧的图库会自动切换为资源显示。

英文文字能准确显示，但日文可能会出现错字。这时，请点击喜欢的候选的 **{{ui:logo.layText}}**。会切换到 **{{ui:media.tab.text}}**，该 Logo 会成为背景，可以叠加喜欢的文字。

## 文本（文字与对话气泡）

![文本界面。左侧是添加文字的按钮、背景、图层、文字样式，中间显示正在编辑的图像](shot:media-text)

**{{ui:media.tab.text}}** 是在图像上加入文字和对话气泡，并保存为图像的编辑界面。不需要下载模型。也不使用生成图像的处理，所以可以立即使用。

### 确定背景

用 **{{ui:text.bg.title}}** 选择把文字放在什么之上。

- **{{ui:text.bg.image}}**：以图像为背景。在图库中显示图像后点击 **{{ui:text.bg.useViewer}}**，或把图像放入这个界面。会以与图像相同的大小保存。
- **{{ui:text.bg.color}}**：纯色的背景。大小可以从列表中的 1024×1024、1920×1080 等中选择，也可以用数字输入宽度和高度。
- **{{ui:text.bg.transparent}}**：没有背景。可以只把文字生成为透明的图像。

也可以右键点击图库中的图像，选择 **{{ui:gallery.menu.sendToText}}**。

### 添加文字和对话气泡

- **{{ui:text.add.text}}**：添加文字图层。
- **{{ui:text.add.bubble}}**：添加对话气泡。形状从 **{{ui:text.shape.round}}**、**{{ui:text.shape.box}}**、**{{ui:text.shape.cloud}}**、**{{ui:text.shape.burst}}**、**{{ui:text.shape.whisper}}**、**{{ui:text.shape.narration}}** 中选择。

添加的内容，可以在界面中拖动来移动。选中后四个角会出现圆形的把手，拖动可以改变大小。对话气泡有“{{ui:text.bubble.tail}}”，拖动尖端的把手来改变方向。

用 `Delete` 删除，用 `Ctrl+D` 复制，用方向键一点一点地移动，用 `Ctrl+Z` 撤销，用 `Ctrl+Shift+Z`（或 `Ctrl+Y`）重做。界面上的 **{{ui:text.undo}}**、**{{ui:text.redo}}** 按钮也一样。显示的大小可以用 **{{ui:text.zoom.in}}**、**{{ui:text.zoom.out}}**、**{{ui:text.zoom.fit}}** 来改变。

### 图层

添加的文字和对话气泡，会按重叠的顺序排列在 **{{ui:text.layers.title}}** 中。列表中越靠上的越在前面。

对每一个，可以 **{{ui:text.layer.hide}}**、**{{ui:text.layer.lock}}**、用 **{{ui:text.layer.up}}**、**{{ui:text.layer.down}}** 调换顺序、**{{ui:text.layer.duplicate}}**、**{{ui:text.layer.delete}}**。用 **{{ui:text.layers.clear}}** 可以一并删除。

### 调整文字

选中图层后，下方会出现设置。

| 项目 | 内容 |
|---|---|
| {{ui:text.content}} | 输入文字（可以换行） |
| {{ui:text.font}}、{{ui:text.weight}}、{{ui:text.size}} | 字体、粗细、大小。字体已内置在应用中，所以在任何电脑上外观都相同 |
| {{ui:text.fill}} | **{{ui:text.fill.solid}}** 或 **{{ui:text.fill.gradient}}**（上下颜色不同） |
| {{ui:text.stroke}}、{{ui:text.outline}} | 文字的描边，以及其外侧的描边 |
| {{ui:text.shadow}} | 阴影。可以选择颜色、模糊和偏移 |
| {{ui:text.letterSpacing}}、{{ui:text.lineHeight}}、{{ui:text.align}} | 字与字、行与行的间隔，以及对齐方式 |
| {{ui:text.vertical}} | 设为竖排。竖排时，对齐方式会变为“{{ui:text.align.top}}、{{ui:text.align.center}}、{{ui:text.align.bottom}}” |
| {{ui:text.bend}} | 让文字弯曲（竖排时无法使用） |
| {{ui:text.rotation}}、{{ui:text.opacity}} | 旋转和不透明度 |

对话气泡中，还可以调整大小、填充颜色、边框和尾巴。在 **{{ui:text.shape.burst}}** 的形状中，可以用 **{{ui:text.bubble.shuffle}}** 改变锯齿。打开 **{{ui:text.bubble.autoFit}}** 后，文字会缩小以适应对话气泡。

### 样式预设

左侧面板最上方的预设中，有 **{{ui:text.preset.plain}}**、**{{ui:text.preset.pop}}**、**{{ui:text.preset.sfx}}**、**{{ui:text.preset.gold}}**、**{{ui:text.preset.sticker}}**、**{{ui:text.preset.soft}}** 这些 Logo 风格的样式。选中文字图层后再使用，该样式就会应用上去。

也可以保存自己的样式（字体、填充、描边、阴影、字距）。

### 保存

完成后点击 **{{ui:text.save}}**。会作为背景大小的 PNG 图像进入图库。保存之后，界面中的编辑内容仍会保留，所以可以继续修改。

## 预设

视频、音乐、语音、Logo、文本的界面中，也有与图像相同形式的预设。从界面左上方的 **{{ui:presets.label}}** 中选择，保存过的设置就会一并填入。

要保存自己的设置，点击预设旁边的保存按钮（**{{ui:presets.saveNew}}**），并命名。保存的内容会排列在 **{{ui:presets.group.mine}}** 中。从列表中各项目的“…”菜单，也可以进行 **{{ui:presets.overwrite}}**、**{{ui:presets.rename}}**、**{{ui:presets.delete}}**。一开始就准备好的预设，在 **{{ui:presets.group.builtin}}** 中（名称是英文）。

各个界面保存的内容略有不同。

| 界面 | 保存的内容 | 不保存的内容 |
|---|---|---|
| 视频 | 提示词、模型、尺寸、长度、品质的设置 | 种子和原图像 |
| 音乐 | 风格标签和乐曲的设置 | 歌词和种子 |
| 语音 | 语言和声音（音色和说话方式，或声音的描述） | 要朗读的文本 |
| Logo | 风格的词语和形状、候选的数量 | 要放进 Logo 的文字 |
| 文本 | 文字的样式 | 文字的内容 |

一开始就有的预设：视频有“Quick preview”“Standard 832x480”“Vertical, low VRAM”这 3 个，音乐有“Lo-fi instrumental”和“J-pop song”，语音有“Calm narrator”和“Energetic announcer”，Logo 有 5 个。

模型的查找和安装方法，请看 [模型](08-models.md)。
