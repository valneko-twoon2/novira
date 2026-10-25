# 影片、音樂、語音、Logo、文字

除了圖像之外，在 novira 中也能製作影片、音樂、語音與 Logo，還可以在圖像上加入文字與對話框。

這些功能都是從 **{{ui:app.tabs.generate}}** 分頁的左側面板使用。圖像的使用方法，請先閱讀[生成](02-generate.md)。

## 切換要製作的東西

左側面板的最上方，有只排列著圖示的切換按鈕。由左至右依序是 **{{ui:media.tab.image}}**、**{{ui:media.tab.video}}**、**{{ui:media.tab.music}}**、**{{ui:media.tab.voice}}**、**{{ui:media.tab.logo}}**、**{{ui:media.tab.text}}**、**{{ui:app.tabs.comic}}**。**{{ui:app.tabs.comic}}** 是製作漫畫頁面的畫面（[繪製漫畫](12-comic.md)）。

將滑鼠移到圖示上就會顯示名稱。切換之後，左側面板與中間的顯示，會變成該種類專用的內容。

## 共通的機制

影片、音樂、語音、Logo 的畫面，形式相同。

- 左側面板的最上方，有可以一次叫出設定的 **{{ui:presets.label}}**。
- 它的下方，有開始製作的按鈕。有不足的東西時，按鈕會變成無法按下的狀態，緊接著的下方會顯示原因。
- 原因出現「請先下載（製作項目）的模型」時，請從接下來出現的 **模型卡片** 安裝。
- 也可以用 `Ctrl+Enter` 代替開始製作的按鈕。
- 製作期間的狀況（排隊中、製作中、無法製作的原因），會顯示在中間畫面的最上方。可以用 **{{ui:media.job.cancel}}** 停止。

> 製作一次只會處理 1 件。製作影片或音樂的期間，圖像等其他的生成會處於排隊等候。等待中的項目，也可以在 **{{ui:app.tabs.queue}}** 分頁確認。

### 最初需要下載的模型

影片、音樂、語音、Logo 各自需要專用的模型。如果沒有安裝，左側面板會出現「模型卡片」。按下 **{{ui:pack.install}}**，應用程式就會自動匯入。

| 要製作的東西 | 卡片的名稱 | 大小的參考值 |
|---|---|---|
| 影片 | {{ui:pack.title.video}} | 約 18 GB |
| 影片（高速版） | {{ui:pack.title.turbo}} | 與標準版共通的檔案不會重複下載 |
| 音樂 | {{ui:pack.title.music}} | 約 10 GB |
| 語音 | {{ui:pack.title.voice}} | 約 9 GB |
| Logo | {{ui:pack.title.logo}} | 約 12 GB |

大小只是參考值。正確的大小，請看卡片上顯示的數字。

影片可以在標準版和高速版兩個模型中選擇。卡片會顯示本機 GPU 的名稱和顯示記憶體，以及每個模型是否合適（**{{ui:media.choice.fit.comfortable}}**、**{{ui:media.choice.fit.tight}}**、**{{ui:media.choice.fit.short}}**）。適合本機的模型會標上 **{{ui:media.choice.recommended}}**。無法讀取顯示記憶體時，是否合適會顯示為 **{{ui:media.choice.fit.unknown}}**。這只是大致的參考：即使標為 **{{ui:media.choice.fit.short}}**，也可能只是變慢而仍能執行。

下載只需要在最初進行一次。進度會顯示在卡片上，在任何畫面的左下角「{{ui:media.downloads.title}}」框中也看得到，途中也可以按 **{{ui:common.cancel}}**。失敗時，卡片會顯示原因，按鈕會變成 **{{ui:pack.retry}}**。

知道下載大小的，還會顯示剩餘時間（「剩餘約 2 分」）。剩餘時間是依下載速度估算的，剛開始的一小段時間不會顯示。不知道大小的，或在安裝處理中，會顯示從開始起經過的時間。下載擴充功能時，可以從框中的 **{{ui:media.downloads.manage}}** 開啟已安裝擴充功能的清單。

安裝完成後，卡片就會消失。只有語音，因為會一併安裝朗讀用的引擎，所以會花一點時間。

> 下載之前，製作圖像的引擎（ComfyUI）需要已經準備完成。進行得不順利時，請參閱[遇到問題時](10-troubleshooting.md)。

## 製作影片

![影片的畫面。左側是製作方式、提示詞、尺寸等設定，中間顯示製作出的影片清單](shot:media-video)

影片有從文字製作的方法，以及讓 1 張圖像動起來的方法。

### 製作方法

1. 在左側面板選擇 **{{ui:media.tab.video}}**。
2. 如果是第一次，請在 **{{ui:pack.title.video}}** 的卡片按下 **{{ui:pack.install}}**。
3. 在 **{{ui:video.mode.label}}** 中，選擇 **{{ui:video.mode.text}}** 或 **{{ui:video.mode.image}}**。
4. 在 **{{ui:video.prompt}}** 寫下想製作什麼樣的影片。從圖像製作時，寫下想讓它如何動。
5. 按下 **{{ui:params.invoke.invoke}}**。

選擇 **{{ui:video.mode.image}}** 後，會出現指定要讓它動起來的圖像的欄位。可以放入圖像，或是在圖庫中選取圖像後按下 **{{ui:video.pickFromGallery}}**。

也有在圖庫的圖像上按右鍵，選擇 **{{ui:gallery.menu.sendToVideo}}** 的方法。

### 設定

| 項目 | 內容 |
|---|---|
| {{ui:video.negative}} | 不想放入的元素。一開始就已經放入了避免模糊與文字等的詞彙 |
| {{ui:video.model}} | **{{ui:video.model.standard}}** 會仔細地製作。**{{ui:video.model.fast}}** 可以在較短的時間內製作，但細節有時會變粗糙 |
| {{ui:video.size}} | 影片的大小。一開始是 832×480。也可以選擇直向、正方形 |
| {{ui:video.fps}} | 每秒的影格數（8～30） |
| {{ui:video.lengthLabel}} | 1～10 秒。影格數會由長度與影格速率自動決定 |
| {{ui:video.steps}}、{{ui:video.cfg}} | 成品的細部調整。選擇模型後，會切換成適合該模型的值 |
| {{ui:video.randomSeed}} | 關閉後，可以決定種子，重新製作相同的動作 |

要使用 **{{ui:video.model.fast}}**，另外需要下載 **{{ui:pack.title.turbo}}**。這個模型是非商用授權。

### GPU 的記憶體較少時

**{{ui:video.light.title}}** 中有 2 個開關。

- **{{ui:video.light.fp8}}**：模型使用的記憶體幾乎會減半。細部有時會稍微變粗糙。
- **{{ui:video.light.tiled}}**：抑制最後修飾時記憶體突然增加的情形。畫質不會改變，會稍微變慢。

即使如此還是不夠時，也可以用較小的尺寸製作，再用 **{{ui:video.finish}}** 將做好的影片放大。

### 結果

影片需要數分鐘到十幾分鐘。完成後，會在中間排列成影片的清單，可以當場播放。右側的圖庫中，也會以附有 ▶ 的縮圖放入。

各個影片的下方，會顯示提示詞與大小、長度、種子。用垃圾桶按鈕可以刪除。

按下 **{{ui:video.finish}}**，會開啟 **{{ui:finish.title}}** 的畫面。

- **{{ui:finish.smooth.title}}**：補足影格之間的畫面，讓動作變得流暢。
- **{{ui:finish.enlarge.title}}**：用放大用的模型將影片變大。會使用較多的時間與記憶體。

原本的影片會保留，修飾後的影片會新增。補足影格有時需要擴充功能（請依照畫面的說明按下 **{{ui:finish.install}}**）。

## 製作音樂

![音樂的畫面。左側排列著風格、歌詞、長度、節奏等設定](shot:media-music)

從文字（風格）與歌詞，製作歌曲。

### 製作方法

1. 在左側面板選擇 **{{ui:media.tab.music}}**。
2. 如果是第一次，請在 **{{ui:pack.title.music}}** 的卡片按下 **{{ui:pack.install}}**。
3. 在 **{{ui:music.tags}}** 中，用逗號區隔寫下類型、氛圍、樂器。例如 `upbeat J-pop, female vocal, piano, bright`。
4. 如果要製作有歌聲的歌曲，請寫下 **{{ui:music.lyrics}}**。要製作沒有歌聲的歌曲時，請勾選 **{{ui:music.instrumental}}**。
5. 按下 **{{ui:params.invoke.invoke}}**。

風格是必填的。留空就無法製作。

歌詞可以像 `[verse]`（主歌）或 `[chorus]`（副歌）這樣，用方括號標示段落來寫。可以用英文、日文、中文等書寫。用 **{{ui:music.language}}** 選擇歌詞的語言。不確定時，請選 **{{ui:music.lang.unknown}}**。

### 設定

| 項目 | 內容 |
|---|---|
| {{ui:music.lengthLabel}} | 10～240 秒 |
| {{ui:music.bpm}} | 歌曲的速度（40～220） |
| {{ui:music.timeSignature}} | 2/4、3/4、4/4、6/4 |
| {{ui:music.key}} | 從 `C major` 到 `B minor` |
| {{ui:music.steps}}、{{ui:music.cfg}} | 成品的細部調整 |

### 結果

歌曲會在數十秒到數分鐘後，排列在中間的清單。每一首都附有播放器，可以直接播放。會顯示長度、速度、調性、種子，有歌詞時，可以開啟 **{{ui:audio.lyrics}}** 來確認。

圖庫中也會以音符的縮圖放入。

## 製作語音

![語音的畫面。左側排列著要朗讀的文字、語言、聲音的選擇方式](shot:media-voice)

將輸入的文字，變成聲音朗讀出來。

### 製作方法

1. 在左側面板選擇 **{{ui:media.tab.voice}}**。
2. 如果是第一次，請在 **{{ui:pack.title.voice}}** 的卡片按下 **{{ui:pack.install}}**。朗讀的引擎與模型，只會放進應用程式的資料夾中。
3. 在 **{{ui:voice.text}}** 輸入想朗讀的文字。
4. 選擇 **{{ui:voice.language}}**。選擇 **{{ui:voice.lang.Auto}}** 時，會從文字判斷。
5. 決定聲音（請見下方）。
6. 按下 **{{ui:params.invoke.invoke}}**。

### 決定聲音的方式

用 **{{ui:voice.mode.label}}**，可以從 2 種方法中選擇。

- **{{ui:voice.mode.preset}}**：從準備好的聲音中選擇。有日文女聲、中文、英文男聲、韓文女聲等，名稱後面會顯示語言與性別。在 **{{ui:voice.style}}** 寫下像「開朗有活力」「緩慢而沉穩」的內容，也可以指定說話的方式。
- **{{ui:voice.mode.design}}**：在 **{{ui:voice.description}}** 用文字寫下聲音的特徵。例如「沉穩偏低的男聲，說話緩慢而溫柔。」這樣的寫法。說明是必填的。

可以朗讀的語言，有日文、英文、中文、韓文、德文、法文、俄文、葡萄牙文、西班牙文、義大利文。

### 結果

做好的語音，會附上播放器排列在中間的清單。也會顯示使用的聲音（{{ui:audio.voice.designed}}時，會顯示「{{ui:audio.voice.designed}}」）與語言。圖庫中也會放入。

第一次生成時，因為要載入模型，會花一點時間。如果有一陣子沒有使用，模型會從 GPU 中卸除，記憶體會回到其他作業。

## 製作 Logo

![Logo 的畫面。左側排列著 Logo 的文字、風格、形狀、候選數量](shot:media-logo)

製作含有文字的 Logo 候選。

### 製作方法

1. 在左側面板選擇 **{{ui:media.tab.logo}}**。
2. 如果是第一次，請在 **{{ui:pack.title.logo}}** 的卡片按下 **{{ui:pack.install}}**。
3. 在 **{{ui:logo.text}}** 輸入要放進 Logo 的文字（最多 60 個字）。
4. 在 **{{ui:logo.style}}** 寫下氛圍、顏色、形狀。用日文或英文都可以。例如「極簡、藍白、幾何」。
5. 在 **{{ui:logo.size}}** 中，從 **{{ui:logo.size.square}}**、**{{ui:logo.size.wide}}**、**{{ui:logo.size.tall}}** 選擇形狀。
6. 從 1～4 中選擇 **{{ui:logo.countLabel}}**，再按下 **{{ui:params.invoke.invoke}}**。

### 結果與疊上文字的方式

做好的 Logo，會以候選的形式排列在中間。在圖庫中，不是放進 **{{ui:gallery.view.images}}**，而是放進 **{{ui:gallery.view.assets}}** 那一邊。開啟製作 Logo 的畫面時，右側的圖庫會自動切換成素材的顯示。

英文的文字會正確地出現，但日文有時會崩壞。這種時候，請按下喜歡的候選的 **{{ui:logo.layText}}**。會切換到 **{{ui:media.tab.text}}**，該 Logo 會成為背景，所以可以疊上喜歡的文字。

## 文字（文字與對話框）

![文字的畫面。左側有新增文字的按鈕、背景、圖層、文字的樣式，中間顯示編輯中的圖像](shot:media-text)

**{{ui:media.tab.text}}** 是在圖像上加入文字與對話框，並儲存為圖像的編輯畫面。不需要下載模型。也不使用製作圖像的處理，所以可以馬上使用。

### 決定背景

用 **{{ui:text.bg.title}}**，選擇要把文字放在什麼上面。

- **{{ui:text.bg.image}}**：以圖像作為背景。在圖庫中顯示圖像後，按下 **{{ui:text.bg.useViewer}}**，或是將圖像放入這個畫面。會以與圖像相同的大小儲存。
- **{{ui:text.bg.color}}**：單色的背景。大小可以從清單中的 1024×1024 或 1920×1080 等選擇，或是用數字輸入寬度與高度。
- **{{ui:text.bg.transparent}}**：沒有背景。可以只製作文字的透明圖像。

也有在圖庫的圖像上按右鍵，選擇 **{{ui:gallery.menu.sendToText}}** 的方法。

### 加入文字與對話框

- **{{ui:text.add.text}}**：新增文字的圖層。
- **{{ui:text.add.bubble}}**：新增對話框。形狀從 **{{ui:text.shape.round}}**、**{{ui:text.shape.box}}**、**{{ui:text.shape.cloud}}**、**{{ui:text.shape.burst}}**、**{{ui:text.shape.whisper}}**、**{{ui:text.shape.narration}}** 中選擇。

加入的東西，可以在畫面中拖曳移動。選取後，四個角會出現圓形的把手，拖曳可以改變大小。對話框有「{{ui:text.bubble.tail}}」，拖曳前端的把手可以改變方向。

用 `Delete` 刪除，用 `Ctrl+D` 複製，用方向鍵一點一點地移動，用 `Ctrl+Z` 復原，用 `Ctrl+Shift+Z`（或 `Ctrl+Y`）重做。用畫面上的 **{{ui:text.undo}}**、**{{ui:text.redo}}** 按鈕也一樣。顯示的大小可以用 **{{ui:text.zoom.in}}**、**{{ui:text.zoom.out}}**、**{{ui:text.zoom.fit}}** 更改。

### 圖層

加入的文字與對話框，會依重疊的順序排列在 **{{ui:text.layers.title}}** 中。在清單上方的，越在前面。

可以對每一項分別進行 **{{ui:text.layer.hide}}**、**{{ui:text.layer.lock}}**、用 **{{ui:text.layer.up}}**、**{{ui:text.layer.down}}** 調換順序、**{{ui:text.layer.duplicate}}**、**{{ui:text.layer.delete}}**。用 **{{ui:text.layers.clear}}**，可以一次清除。

### 調整文字

選取圖層後，下方會出現設定。

| 項目 | 內容 |
|---|---|
| {{ui:text.content}} | 輸入文字（可以換行） |
| {{ui:text.font}}、{{ui:text.weight}}、{{ui:text.size}} | 字型、粗細、大小。字型已內建在應用程式中，所以在任何電腦上看起來都一樣 |
| {{ui:text.fill}} | **{{ui:text.fill.solid}}**，或 **{{ui:text.fill.gradient}}**（上下的顏色不同） |
| {{ui:text.stroke}}、{{ui:text.outline}} | 文字的描邊，以及它外側的描邊 |
| {{ui:text.shadow}} | 陰影。可以選擇顏色、模糊、偏移 |
| {{ui:text.letterSpacing}}、{{ui:text.lineHeight}}、{{ui:text.align}} | 字與字、行與行的間隔，以及對齊方式 |
| {{ui:text.vertical}} | 改成直書。直書時，對齊方式會變成「{{ui:text.align.top}}、{{ui:text.align.center}}、{{ui:text.align.bottom}}」 |
| {{ui:text.bend}} | 讓文字彎曲（直書時無法使用） |
| {{ui:text.rotation}}、{{ui:text.opacity}} | 旋轉與不透明度 |

對話框還可以調整大小、填色、框線、尾巴。在 **{{ui:text.shape.burst}}** 的形狀中，可以用 **{{ui:text.bubble.shuffle}}** 改變鋸齒的形狀。開啟 **{{ui:text.bubble.autoFit}}** 後，文字會縮小以容納在對話框中。

### 樣式的預設

左側面板最上方的預設中，有 **{{ui:text.preset.plain}}**、**{{ui:text.preset.pop}}**、**{{ui:text.preset.sfx}}**、**{{ui:text.preset.gold}}**、**{{ui:text.preset.sticker}}**、**{{ui:text.preset.soft}}** 這些 Logo 風格的樣式。選取文字的圖層後再使用，就會套用該樣式。

也可以儲存自己的樣式（字型、填色、描邊、陰影、字距）。

### 儲存

做好後，請按下 **{{ui:text.save}}**。會以背景大小的 PNG 圖像，放進圖庫。儲存之後，畫面上的編輯內容仍會保留，所以可以接著修改。

## 預設

影片、音樂、語音、Logo、文字的畫面中，也有與圖像相同形式的預設。從畫面左上方的 **{{ui:presets.label}}** 選擇，就會一併放入已儲存的設定。

要儲存自己的設定，請按下預設旁邊的儲存按鈕（**{{ui:presets.saveNew}}**），並命名。儲存的內容會排列在 **{{ui:presets.group.mine}}**。從清單中各項目的「…」選單，也可以進行 **{{ui:presets.overwrite}}**、**{{ui:presets.rename}}**、**{{ui:presets.delete}}**。一開始就準備好的，放在 **{{ui:presets.group.builtin}}** 中（名稱是英文）。

依畫面不同，儲存的內容也略有不同。

| 畫面 | 儲存的內容 | 不會儲存的東西 |
|---|---|---|
| 影片 | 提示詞、模型、尺寸、長度、品質的設定 | 種子與原本的圖像 |
| 音樂 | 風格的標籤與歌曲的設定 | 歌詞與種子 |
| 語音 | 語言與聲音（聲音與說話方式，或聲音的說明） | 要朗讀的文字 |
| Logo | 風格的詞彙與形狀、候選的數量 | 要放進 Logo 的文字 |
| 文字 | 文字的樣式 | 文字的內容 |

一開始就有的預設，影片有「Quick preview」「Standard 832x480」「Vertical, low VRAM」這 3 個，音樂有「Lo-fi instrumental」與「J-pop song」，語音有「Calm narrator」與「Energetic announcer」，Logo 有 5 個。

模型的尋找方式與安裝方式，請見[模型](08-models.md)。

