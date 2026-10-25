# 製作圖像

這一章說明如何在 **{{ui:app.tabs.generate}}** 分頁製作圖像。
畫面各部分的介紹請見[開始使用](01-start.md)，製作出的圖像如何檢視與整理，請見[圖庫與檢視器](03-gallery.md)。

製作的流程，永遠是一樣的。

1. 選擇模型
2. 寫下提示詞
3. 視需要調整尺寸、種子等設定
4. 按下 **{{ui:params.invoke.invoke}}**

按下之後，並不是立刻開始畫圖，而是先進入「{{ui:app.tabs.queue}}」（排隊等候的隊伍）。輪到時，會一張一張地畫。

## 寫下提示詞

![在提示詞中寫下句子，並將種子設為固定的生成分頁](shot:generate-prompt)

左側面板的「{{ui:params.prompt.title}}」中，有 2 個欄位。

- **{{ui:params.prompt.positive}}**：寫下希望畫出的東西。
- **{{ui:params.prompt.negative}}**：寫下不希望出現的東西。例如 `blurry, watermark`（模糊、浮水印文字）。留空也可以生成。

寫法的參考如下。

- 用逗號（`,`）分隔，並排列單字或短句。
- 多數模型使用英文比較容易得到想要的結果。如果模型的說明中有指定寫法，請依照它來寫。
- 重要的詞放在前面。

欄位上方的小按鈕，作用如下。

| 按鈕 | 作用 |
|---|---|
| **{{ui:params.prompt.recommended}}** | 將適合所選模型的品質詞彙（`masterpiece, best quality` 等）加到「{{ui:params.prompt.positive}}」的開頭，並將常用的避免詞彙加到「{{ui:params.prompt.negative}}」的最後。已經存在的詞彙不會重複加入 |
| **{{ui:params.prompt.expand}}** | 用左右並排的大視窗，編輯正向與反向提示詞 |
| **{{ui:params.promptBook.open}}** | 開啟收錄單字及其意思的清單（後述） |
| **{{ui:caption.fromPrompt}}** | 查看圖像，寫出可當作提示詞的文字。也可以把圖庫中的圖像或電腦裡的圖像檔案拖到這個按鈕上（在[修飾與沿用圖像](04-improve.md)中說明） |
| 各欄位的「預設」 | 只儲存、叫出提示詞的句子（後述） |

### token 數

欄位上方的「0 / 77 個 token」，是目前所寫文字量的參考值。
token 是模型讀取文字時的分段單位。超過上限時，數字會變成警告的顏色。依模型而定，超過上限的部分可能比較不容易發揮效果。
這個數字是「大約」的值，並不是精確的數字。

### 一次製作多種組合 `{red|blue}`

在正向欄位中寫成 `{red|blue}` 這樣，用豎線（`|`）區隔大括號內的內容，就會為每個選項分別製作不同的圖像。

- 寫成 `a {red|blue} flower`，就會變成 `a red flower` 與 `a blue flower` 這 2 種。
- 寫出 2 組以上的大括號，就會成為所有的組合。`a {red|blue} {cat|dog}` 就是 4 種。
- 大括號裡面，也可以再放入大括號。
- 想把大括號本身當作文字使用時，在前面加上 `\`（`\{`）。
- 組合的數量，最多到 100 種。

「{{ui:params.invoke.iterations}}」（後述）為 2 以上時，會製作出「組合數 × 張數」的圖像。例如 2 種組合、張數為 3，就是 6 張。
這種寫法只能用在正向欄位。在反向欄位中，大括號會直接被當作文字處理。

會展開成什麼樣的句子，可以用正向欄位上方的 **{{ui:params.prompt.dynamicPreview}}** 按鈕（`{ }` 圖示）確認。按下後，會顯示組合的清單。

### 萬用字元 `__名稱__`

![萬用字元視窗。左側是清單，右側是所選清單的名稱與項目](shot:wildcards)

在正向欄位中寫 `__名稱__`（名稱前後各兩個底線），就會從該名稱的「{{ui:params.wildcards.title}}」清單中逐一代入項目。把常用的選項做成清單，就不必每次都寫 `{red|blue}`。

- 寫成 `1girl, __hair-color__`，會依清單 hair-color 的項目數，產生相同數量的提示詞。
- 項目中也可以寫 `{a|b}` 或其他萬用字元。萬用字元中的萬用字元最多 6 層。
- 組合數的上限（100 種）與 `{ }` 相同。
- 如果寫了不存在的名稱、沒有項目的清單，或引用自身的清單，就無法按 **{{ui:params.invoke.invoke}}**，按鈕下方會顯示原因。

清單從 **{{ui:params.prompt.dynamicPreview}}** 按鈕視窗最下方的 **{{ui:params.wildcards.open}}** 開啟。一開始就有 hair-color（髮色）、expression（表情）、time-of-day（時段）這 3 個清單。

| 操作 | 作用 |
|---|---|
| **{{ui:params.wildcards.new}}** | 新增一個空清單 |
| 「{{ui:params.wildcards.name}}」欄位 | 修改清單名稱。可使用字母、數字、`-` 和 `_`，首尾須為字母或數字 |
| 「{{ui:params.wildcards.entries}}」欄位 | 每行寫一個。空行和以 `#` 開頭的行不算項目 |
| **{{ui:params.wildcards.import}}** / **{{ui:params.wildcards.export}}** | 將一個清單讀寫為每行一個項目的 .txt 檔案。匯入的檔案會成為以檔名命名的新清單 |
| **{{ui:common.delete}}** | 刪除所選清單 |

清單儲存在本應用程式中（目前使用的電腦上）。

### 隨機選取

組合過多時，在 **{{ui:params.prompt.dynamicPreview}}** 按鈕的視窗中切換「{{ui:params.prompt.dynamicMode}}」。

- **{{ui:params.prompt.modeCombinatorial}}**（預設）：每種組合各生成設定張數的圖像。
- **{{ui:params.prompt.modeRandom}}**：依設定張數生成圖像，每張選取一種組合。選哪一種由該圖像的種子決定，因此用相同種子重畫會得到相同的提示詞。

無論哪種方式，生成的圖像都會儲存實際使用的提示詞。

## 種子

圖像是由名為「{{ui:params.seed.label}}」的數字製作出來的。相同的種子與相同的設定，會做出相同的圖像。

左側面板上方的「{{ui:params.seed.label}}」這一列，有 2 個按鈕。

- **{{ui:params.seed.random}}**（骰子）：每次生成都使用新的種子。每次都會是不同的圖像。一開始是這個狀態。
- **{{ui:params.seed.fixed}}**（鎖）：以目前的種子來畫。用相同設定製作多少次，都會是相同的圖像。想看提示詞改掉一個詞後的差異時很方便。

設為固定後，種子的數字欄位與「{{ui:params.seed.shuffle}}」按鈕會被鎖定（為了避免不小心改到）。
想使用指定的數字時，請在「{{ui:params.seed.random}}」的狀態下把數字輸入欄位，再切換成「{{ui:params.seed.fixed}}」。
想使用喜歡的圖像的種子時，在圖庫中開啟那張圖像，按下「{{ui:gallery.menu.useSeed}}」，就能將種子設為固定並載入（請見[圖庫與檢視器](03-gallery.md)）。

固定的狀態下增加張數，第 2 張以後的圖像，種子會逐次加 1。

## 選擇模型

![開啟的模型清單。依 FLUX、SDXL、SD1.X 等系列分開](shot:model-picker)

用左側面板上方的模型卡片，選擇要用來畫圖的模型。

1. 點擊模型名稱欄位。
2. 從清單中選擇。清單依模型的系列（FLUX、SDXL、SD1.X 等）分開。數量很多時，可以在上方的搜尋欄輸入名稱的一部分來篩選。
3. 選取的模型會加上 ✓，卡片的圖像（封面圖像）也會跟著切換。

清單下方的 **{{ui:app.tabs.short.models}}** 按鈕可以前往 {{ui:app.tabs.models}} 分頁（管理已有的模型），**{{ui:app.tabs.short.browse}}** 按鈕可以前往 {{ui:app.tabs.browse}} 分頁（在網路上搜尋）。增加模型的方法，請見[準備模型](08-models.md)。

如果模型已登錄了建議的設定（步數、CFG、排程器、尺寸），選擇模型時會自動填入。
切換成系列不同的模型時，與新模型不相容的 LoRA 等會被移除（會通知移除的數量）。

按下模型欄位下方的 **{{ui:params.profile.title}}** 按鈕，會以清單顯示該模型的建議值。如果目前的設定偏離了建議值，按鈕會變成顯眼的顏色，按下 **{{ui:params.profile.apply}}** 就能統一成建議值。

> 如果一個模型都沒有安裝，欄位會顯示「{{ui:params.model.noModels}}」，無法生成。請先完成[準備模型](08-models.md)。

## 其他設定

提示詞的下方，排列著彙整設定的區塊。點擊就能展開或收合。

| 區塊 | 內容 |
|---|---|
| **{{ui:params.refImage.sectionLabel}}**（緊接在提示詞下方） | 用來讓畫面氛圍或登場人物更接近的圖像（後述） |
| **{{ui:params.image.title}}** | {{ui:params.image.aspect}}、寬度與高度。也有「{{ui:params.image.swap}}」「{{ui:params.image.lock}}」「{{ui:params.image.optimal}}」按鈕 |
| **{{ui:params.generation.title}}** | LoRA（用來加入畫風或人物的小型附加模型）、{{ui:params.generation.scheduler}}、{{ui:params.generation.steps}}、{{ui:params.generation.cfg}} |
| **{{ui:params.hires.title}}** | 將畫好的圖像放大後再畫一遍的第二遍生成（後述） |
| **{{ui:params.advanced.title}}** | {{ui:params.advanced.vae}}、{{ui:params.advanced.clipSkip}}、{{ui:params.advanced.seamless}}（拼接後不會出現接縫的圖像）等 |

不確定的話，除了尺寸以外，維持選擇模型時填入的內容就可以。
將游標移到項目名稱（「{{ui:params.generation.steps}}」「{{ui:params.generation.cfg}}」等）上，會出現簡短的說明。區塊的標題上，會以小字顯示目前數值的摘要。

尺寸越大，花費的時間與電腦的負擔就越多。建議先用較小的尺寸試試，滿意的話再用[放大](06-upscaling-workflows.md)變大。

## 高解析度修復

![開啟並啟用高解析度修復區塊的樣子](shot:hires-fix)

一開始就用大尺寸繪製，容易出現人物變成兩個或形狀崩壞。**{{ui:params.hires.title}}** 會先依設定的尺寸繪製，放大後再用相同的種子和設定重畫一遍。一次生成就能得到細節完整的大圖。此區塊位於 {{ui:app.tabs.generate}} 分頁與 {{ui:app.tabs.comic}} 分頁中。

- **{{ui:params.hires.enable}}**：開啟即可使用。
- **{{ui:params.hires.scale}}**：1.25～2 倍。最終尺寸顯示在區塊標題和最下面一行。
- **{{ui:params.hires.strength}}**：0.2～0.75。低時幾乎保留第一遍的圖像，高時會大幅重畫。預設是 0.45。
- **{{ui:params.hires.method}}**：**{{ui:params.hires.methodSmooth}}** 不使用模型放大。如果裝有 {{ui:app.tabs.upscaling}} 分頁使用的放大模型，也可以選擇它們。
- **{{ui:params.hires.steps}}**：第二遍的步數。為 0 時與第一遍步數相同。

耗時相當於畫兩遍。進度會把兩遍連起來計算。LoRA 和參考圖像在第二遍也會使用。

當最終尺寸遠超模型擅長的大小（長邊 SDXL 約 2048 px，SD1.X 約 1536 px）時，生成按鈕下方會顯示提示。仍然可以生成；如果畫面崩壞，請降低放大倍率。

圖像會儲存第一遍的尺寸和{{ui:params.hires.title}}的設定。在圖庫中用「{{ui:gallery.menu.useAll}}」讀取時，{{ui:params.hires.title}}也會依原樣填入。

## 生成次數與生成按鈕

![按下生成按鈕旁的箭頭後開啟的選單](shot:invoke-menu)

左側面板上方，彙整了生成的操作。

- **{{ui:params.invoke.invoke}}**（藍色按鈕）：加到佇列的最後並生成。也可以按 `Ctrl+Enter`。
- **× 旁邊的數字**：一次操作製作的張數。設為「3」就會製作 3 張。
- **紅色的 × 按鈕**：取消目前正在畫的內容。
- 各按鈕右邊的 **∨**：其他操作的選單。

無法按下時，按鈕會變成灰色，按鈕下方一行會顯示原因（例如沒有選擇模型）。將游標移到按鈕上，可以看到原因的清單。
繪製期間，按鈕會變成「{{ui:params.invoke.generating}}」，並顯示進度（%）與佇列的等待數量。

### 生成按鈕的 ∨ 選單

- **{{ui:params.invoke.addBack}}**（`Ctrl+Enter`）：依按下的順序排列並繪製。與一般的生成相同。
- **{{ui:params.invoke.addFront}}**（`Ctrl+Shift+Enter`）：插隊到佇列的最前面。急著只想試 1 張時使用。
- **{{ui:xyplot.menu}}**：以現在的設定為基礎，將只改變 1 到 2 個設定的圖像，並排在一張表格中。因為使用相同的種子來畫，所以差異只來自改變的設定。在橫向與縱向選擇 CFG 比例、步數、模型等，輸入數值後按下 **{{ui:xyplot.run}}**。

### 取消的選單

按下紅色 × 按鈕右邊的 ∨，會出現下列選單。

- **{{ui:params.invoke.cancelCurrent}}**（`Shift+X`）
- **{{ui:params.invoke.clearQueue}}**（`Ctrl+Shift+X`）：將等待中的與正在畫的全部清除。不會出現確認。
- **{{ui:params.invoke.pause}}** / **{{ui:params.invoke.resume}}**：暫停或繼續佇列的處理。
- **{{ui:params.invoke.openQueue}}**

## 檢視完成的圖像

![生成完成的畫面。中央的檢視器顯示圖像，右側的圖庫也出現了這張圖](shot:generate-result)

按下之後，中央會立刻切換成檢視器。
繪製期間，右側圖庫上方會出現「{{ui:gallery.generating.title}}」的橫條，可以看到過程中的圖像、步數與進度。中央上緣的細線也會顯示進度。

完成後，圖像會加入圖庫，檢視器會顯示那張圖像。
圖像會儲存到目前選取的（右側面板上標有「{{ui:gallery.boards.autoBadge}}」標記的）看板。關於看板，以及圖像的整理、比較與重做，請見[圖庫與檢視器](03-gallery.md)。

> 如果檢視器自動切換成新圖像造成困擾，請在{{ui:gallery.settings.title}}（齒輪按鈕）中，關閉「{{ui:gallery.settings.autoSwitch}}」。

## 預設

![預設的清單。內建的預設與儲存的預設並排](shot:presets)

常用的設定組合，可以儲存為預設。按下左側面板最上方的「{{ui:presets.label}}」卡片，就會開啟清單。

預設會一併包含下列內容。

- 提示詞（正向與反向）
- 模型與各項設定（尺寸、步數、CFG、排程器、VAE 等）
- LoRA 與參考圖像

種子與張數不會包含在內。

使用方法如下。

- 點擊清單中的項目，就會套用該設定（**{{ui:presets.apply}}**）。
- 用清單下方的 **{{ui:presets.saveNew}}**（或卡片旁的儲存按鈕），為目前的設定命名並儲存。
- 項目右邊的「…」可以進行 **{{ui:presets.apply}}**、**{{ui:presets.overwrite}}**、**{{ui:presets.rename}}**、**{{ui:presets.delete}}**。
- 清單分為「{{ui:presets.group.mine}}」與「{{ui:presets.group.builtin}}」。內建的預設，是一開始就有的範例。

另外，在正向與反向各欄位的上方，也有「預設」欄位。這個只會儲存、叫出提示詞的句子。適合用來儲存慣用的句子（品質詞彙、想避免的詞彙組合）。

## 提示詞清單

![提示詞清單。依分類並排著單字與意思，並有「正向」「反向」的加入按鈕](shot:prompt-book)

即使不記得英文單字，也能組出提示詞，這就是 **{{ui:params.promptBook.open}}**。從正向與反向各欄位上方的按鈕開啟。

- 在左邊選擇分類（髮型、表情、服裝、構圖等），就只會顯示該分類的單字。上方的搜尋欄，可以一次搜尋單字、意思、分類與備註。
- 按下單字右邊的「{{ui:params.prompt.positive}}」「{{ui:params.prompt.negative}}」，就會將該單字加入提示詞。加入的單字會打勾，再按一次就會取消。
- 在最上方的輸入欄輸入單字與意思，按下 **{{ui:params.promptBook.register}}**，就能加入自己的單字。單字右邊的鉛筆可以編輯，垃圾桶可以刪除。

## 參考圖像

**{{ui:params.refImage.sectionLabel}}** 是用來讓新圖像接近既有圖像的「氛圍」或「風格」的功能。它不是照樣複製，而是以色彩運用、畫風與整體印象為線索。

1. 按下提示詞下方的 **＋** 按鈕，新增 1 個框。
2. 將圖庫中的圖像拖曳到該框中。也可以放入電腦中的圖像檔。
3. 點擊該框，就會開啟設定的小視窗。

在小視窗中，可以決定下列事項。

- **{{ui:params.refImage.model}}**：參考圖像專用的模型（IP-Adapter）。需要與所選模型系列相符的模型。
- **{{ui:params.refImage.methodLabel}}**：以整體、僅風格、僅構圖等，決定以什麼為線索（依模型的系列，有時不會顯示）。
- **{{ui:params.refImage.weight}}**：接近的強度。
- **{{ui:params.refImage.begin}}** 與 **{{ui:params.refImage.end}}**：在繪製過程中，從哪裡到哪裡發揮效果。

沒有安裝所需的模型或擴充功能時，框上會出現警告標記，小視窗與生成按鈕下方會出現說明。可以從說明中的按鈕進行安裝。

> 參考圖像是用來「讓氛圍接近」的。想要「以這張圖為基礎重畫」時，請使用畫布。請見[在畫布上補畫](05-canvas.md)。

### 角色

參考圖像上方的「{{ui:character.row.label}}」欄位，可以叫出已登錄的人物（同一個人物的圖像可以有任意張數，並附上外觀的描述詞）。
選擇後，就會設定該人物的參考圖像與外觀描述詞。人物的登錄方法，會在[修飾圖像](04-improve.md)中說明。

## 佇列

![佇列分頁。顯示處理中的項目與等待中的項目清單](shot:queue)

在 **{{ui:app.tabs.queue}}** 分頁，可以查看並操作生成的排隊狀況。有等待中的項目時，側邊導覽列的{{ui:app.tabs.queue}}上會出現數字徽章。

畫面上方有下列內容。

- 處理的狀態（「{{ui:queue.processor.running}}」或「{{ui:queue.processor.paused}}」）與操作按鈕。
- 項目數量的明細（{{ui:queue.status.pending}}、{{ui:queue.status.inProgress}}、{{ui:queue.status.completed}}、{{ui:queue.status.failed}}、{{ui:queue.status.canceled}}）。
- 右上方是目前正在畫的項目的進度。

按鈕的作用如下。

| 按鈕 | 作用 |
|---|---|
| **{{ui:queue.action.pause}}** / **{{ui:queue.action.resume}}** | 暫停、繼續排隊等候的處理。正在畫的項目會照常畫到最後 |
| **{{ui:queue.action.cancelCurrent}}** | 停止目前正在畫的項目 |
| **{{ui:queue.action.cancelAllExceptCurrent}}** | 取消所有等待中的項目 |
| **{{ui:queue.action.prune}}** | 將已結束的項目（完成、失敗、已取消）從清單中清除 |
| **{{ui:queue.action.clear}}** | 清除所有項目。會出現確認視窗 |

點擊下方清單中的一列，會展開該項目的詳細資訊（時間、做出的圖像、失敗時的原因、設定的內容）。
用列右邊的 ×，可以只取消該項目。失敗或已取消的項目，會出現重做的按鈕。

## 快速鍵

在輸入文字時不會作用的按鍵，請先離開輸入欄再按。

| 操作 | 按鍵 |
|---|---|
| 生成（加到佇列的最後） | `Ctrl+Enter`（輸入提示詞時也能使用） |
| 加到佇列的最前面並生成 | `Ctrl+Shift+Enter` |
| 取消正在畫的內容 | `Shift+X` |
| 清除整個佇列（不需確認） | `Ctrl+Shift+X` |
| 移到提示詞欄位 | `Alt+A` |
| 開合左側面板、右側面板 | `T`、`G` |
| 同時開合左右的面板 | `F` |
| 切換分頁（依 {{ui:app.tabs.generate}} 到 {{ui:app.tabs.queue}} 的順序） | `1` 到 `9` |
| 開啟快速鍵的清單 | `Shift+?` |

快速鍵也可以在側邊導覽列的 **{{ui:app.nav.settings}}** 選單中的「{{ui:app.nav.hotkeys}}」確認。
