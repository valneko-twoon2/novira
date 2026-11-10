# 製作圖像

這一章說明如何在 **{{ui:app.tabs.generate}}** 分頁製作圖像。
畫面的看法請見[開始使用](01-start.md)，做好的圖像如何檢視與整理，請見[圖庫與檢視器](03-gallery.md)。

製作的流程永遠相同。

1. 選擇模型
2. 寫下提示詞
3. 視需要調整尺寸、種子等設定
4. 按下 **{{ui:params.invoke.invoke}}**

按下之後並不會馬上開始畫圖，而是先進入「{{ui:app.tabs.queue}}」（排隊等候的行列）。輪到時，會一張一張地畫出來。

選好的模型、提示詞與設定，即使關閉應用程式也會保留，下次啟動時可以直接沿用。

## 寫下提示詞

![在提示詞中寫下句子，並將種子固定的生成分頁](shot:generate-prompt)

左側面板的「{{ui:params.prompt.title}}」有 2 個欄位。

- **{{ui:params.prompt.positive}}**：寫下希望畫出的東西。
- **{{ui:params.prompt.negative}}**：寫下不希望出現的東西。例如 `blurry, watermark`（模糊、浮水印文字）。留空也可以生成。

寫法的參考如下。

- 將單字或短句用逗號（`,`）隔開，依序排列。
- 多數模型用英文書寫，比較容易得到想要的結果。如果模型的說明中有指定寫法，請照著寫。
- 重要的詞放在前面。

欄位上方小按鈕的作用如下。按鈕只有圖示，將游標移上去就會顯示名稱。

| 按鈕 | 作用 |
|---|---|
| **{{ui:params.prompt.recommendedPositive}}** / **{{ui:params.prompt.recommendedNegative}}** | 將所選模型的類型中廣泛使用的品質詞彙加到「{{ui:params.prompt.positive}}」，並將想避開的詞彙加到「{{ui:params.prompt.negative}}」的最後。以標籤書寫的模型（Illustrious、NoobAI、Pony、Anima 等），會在最前面加上 `masterpiece, best quality` 這類標籤；以句子書寫的模型（FLUX、Qwen-Image 等），則在最後加上表示品質的詞彙。不使用反向提示詞的模型（FLUX.1）不會加上反向提示詞。已經存在的詞彙不會重複加入 |
| **{{ui:params.prompt.expand}}** | 在左右並排的大視窗中編輯正向與反向提示詞 |
| **{{ui:params.prompt.textView}}** / **{{ui:params.prompt.tagView}}** | 將欄位的顯示方式，在純文字顯示與逐詞標籤（tag）排列之間切換。按下標籤會開啟彈出視窗，可以改寫詞彙、用滑桿改變強度、恢復為 1，或刪除標籤。改變過強度的標籤，會以 `(smile:1.3)` 的形式寫進提示詞。在下方的輸入欄輸入詞彙後按 Enter，即可新增標籤 |
| **{{ui:params.promptBook.open}}** | 開啟附帶意思、收集單字的預設（後述） |
| **{{ui:caption.fromPrompt}}** | 查看圖庫中選取的圖像（沒有選取時，則看所選的圖像檔案），立刻寫出可用於提示詞的詞彙。結果會顯示在檢視器的橫條中。也可以將圖庫中的圖像或電腦裡的圖像檔案拖放到這個按鈕上（在[修飾與沿用圖像](04-improve.md)中說明） |

### token 數

欄位上方的「0 / 77 個 token」，是目前所寫詞彙量的參考值。
token 是模型在讀取詞彙時的分段單位。超過上限的數量時，數字會變成警告色。依模型而定，超過上限的部分可能比較不容易發揮作用。
這個數字只是「大約」的值，並非精確的數字。

### 一次製作多種組合 `{red|blue}`

在正向欄位中，像 `{red|blue}` 這樣，在大括號中以直線（`|`）隔開，每個選項就會各自產生不同的圖像。

- 寫成 `a {red|blue} flower`，就會變成 `a red flower` 與 `a blue flower` 兩種。
- 寫 2 組以上的大括號，會變成所有的組合。`a {red|blue} {cat|dog}` 就有 4 種。
- 大括號裡面也可以再放大括號。
- 想把大括號本身當成文字使用時，在前面加上 `\`（`\{`）。
- 組合的數量最多為 100 種。

當「{{ui:params.invoke.iterations}}」（後述）在 2 以上時，會製作「組合數 × 張數」的圖像。例如 2 種組合、張數為 3，就是 6 張。
這種寫法只能用在正向欄位。在反向欄位中，大括號會直接當成文字處理。

會展開成什麼樣的句子，可以用正向欄位上方的 **{{ui:params.prompt.dynamicPreview}}** 按鈕（`{ }` 圖示）確認。按下後會顯示組合的清單。反向欄位也有同樣的按鈕，反向提示詞中同樣可以寫 `{a|b}` 或萬用字元。組合會由正向與反向的所有搭配產生。

### 萬用字元 `__名稱__`

![萬用字元的視窗。左側是清單的列表，右側並排著所選清單的名稱與項目](shot:wildcards)

在正向欄位中寫下 `__名稱__`（名稱的前後各加 2 個底線），就會從該名稱的「{{ui:params.wildcards.title}}」清單中，每次帶入 1 個項目。如果把常用的選項做成清單，就不用每次都寫 `{red|blue}`。

- 寫成 `1girl, __hair-color__`，就會依 hair-color 清單的項目數量產生對應的提示詞。
- 項目之中也可以寫 `{a|b}` 或其他萬用字元。萬用字元之中的萬用字元最多可套用 6 層。
- 組合數量的上限（100 種）與 `{ }` 相同。
- 如果寫了不存在的名稱、項目為空的清單，或使用自己本身的清單，就無法按下 **{{ui:params.invoke.invoke}}**，按鈕下方會顯示原因。

清單可以從 **{{ui:params.prompt.dynamicPreview}}** 按鈕視窗最下方的 **{{ui:params.wildcards.open}}** 開啟。一開始就內建 hair-color（髮色）、expression（表情）、time-of-day（時段）3 個清單。

| 操作 | 作用 |
|---|---|
| **{{ui:params.wildcards.new}}** | 新增一個空白清單 |
| 「{{ui:params.wildcards.name}}」欄位 | 更改清單的名稱。可使用文字、數字、`-`、`_`，且開頭與結尾必須是文字或數字 |
| 「{{ui:params.wildcards.entries}}」欄位 | 每行寫 1 個。空白行與以 `#` 開頭的行不會成為項目 |
| **{{ui:params.wildcards.import}}** / **{{ui:params.wildcards.export}}** | 將 1 個清單以每行 1 個項目的 .txt 檔案讀入或寫出。讀入的檔案會成為以檔名為名稱的新清單 |
| **{{ui:common.delete}}** | 刪除所選的清單 |

清單會儲存在這個應用程式之中（也就是目前使用的電腦）。

### 隨機選擇

組合太多時，可以在 **{{ui:params.prompt.dynamicPreview}}** 按鈕的視窗中切換「{{ui:params.prompt.dynamicMode}}」。

- **{{ui:params.prompt.modeCombinatorial}}**（初始設定）：每種組合各製作張數份量的圖像。
- **{{ui:params.prompt.modeRandom}}**：製作張數份量的圖像，每張從組合中隨機選出 1 個。選哪一個是由那張圖的種子決定，所以用同一個種子重畫，會得到相同的提示詞。

無論用哪種選法，做好的圖像都會保存實際使用的提示詞。

## 種子

圖像是從名為「{{ui:params.seed.label}}」的數字產生的。只要種子與設定相同，就會得到相同的圖像。

左側面板上方的「{{ui:params.seed.label}}」列有 2 個按鈕。

- **{{ui:params.seed.random}}**（骰子）：每次生成都使用新的種子。每次都會得到不同的圖像。一開始是這個狀態。
- **{{ui:params.seed.fixed}}**（鎖頭）：以目前的種子繪製。即使用相同設定製作多少次，都會得到相同的圖像。想看提示詞改掉一個詞之後的差異時很方便。

固定之後，種子的數字欄與「{{ui:params.seed.shuffle}}」按鈕會被鎖定（為了避免不小心改到）。
想使用指定的數字時，請在「{{ui:params.seed.random}}」的狀態下把數字填進數字欄，再切換成「{{ui:params.seed.fixed}}」。
想使用喜歡的圖像的種子時，請在圖庫中開啟那張圖，按下「{{ui:gallery.menu.useSeed}}」，就能以固定種子的狀態讀入（請見[圖庫與檢視器](03-gallery.md)）。

在固定的狀態下增加張數，第 2 張以後的種子會依序加 1。

## 選擇模型

![模型清單已展開。依 FLUX、SDXL、SD1.X 等系列分類](shot:model-picker)

在左側面板上方的模型卡片中，選擇用來畫圖的模型。

1. 點選模型名稱欄。
2. 從清單中選擇。清單依模型的系列（FLUX、SDXL、SD1.X 等）分類。數量很多時，可以在上方的搜尋欄輸入名稱的一部分來縮小範圍。

Anima、Flux、FLUX.2、Chroma、Qwen-Image、Z-Image、SD3、HiDream、AuraFlow、HunyuanImage 的模型也可以在這裡選擇。當本體、文字編碼器、VAE 是以各別檔案發布時，應用程式會依名稱，從已安裝的模型中尋找並使用文字編碼器與 VAE。安裝缺少檔案的模型時，會立刻出現「{{ui:params.parts.title}}」的確認，看過名稱與大小之後，可以只安裝缺少的檔案。如果先選擇稍後再說而關閉，生成按鈕下方也會顯示該模型缺少檔案的說明，以及不必切換畫面就能安裝這些檔案的按鈕。超過 5 GB 時，按下按鈕之後還會再出現確認。也可以從模型畫面的 **{{ui:models.install.tab.starter}}** 安裝。這些模型同樣可以使用遮罩、控制圖層與高解析度修復。參考圖像只能用於 SD1.X 與 SDXL 的模型。在「{{ui:params.generation.scheduler}}」中選擇的項目不會被使用，而是以各系列決定好的取樣器與排程器（Flux 是 `euler / simple`）來繪製（只有 Anima 會以所選的排程器繪製）。「{{ui:params.generation.scheduler}}」欄位會顯示實際使用的組合。選擇「{{ui:params.generation.sampler}}」與「{{ui:params.generation.noiseSchedule}}」之後，無論是哪個系列的模型，都會以所選的為優先。

- **編輯模型。** FLUX Kontext 與 Qwen-Image-Edit 會改寫交給它們的圖像。請將原圖放進來源（圖像轉圖像），並在提示詞中寫下想改變的內容。FLUX Fill 會重畫遮罩的部分（用於帶遮罩的局部重繪或外延繪製）。這些模型無法使用高解析度修復、草稿與控制圖層。應用程式是依檔案的內容來區分這些模型與一般模型，Kontext 與 Qwen 的編輯模型則是依檔名中的 `kontext` 或 `edit` 這些字詞來區分。請不要更改名稱。
- **FLUX.2。** klein 只需少量步數就能運作（蒸餾版的 CFG 為 1）。dev 會將 CFG 的值當作引導（guidance）來使用。把原圖放進來源（圖像轉圖像）後，FLUX.2 會依照提示詞改寫。遮罩、控制圖層與高解析度修復無法用於 FLUX.2（可以使用草稿）。
- **量化（GGUF）模型。** 副檔名為 `.gguf` 的模型或文字編碼器，是由擴充功能 ComfyUI-GGUF 讀取。請在擴充功能畫面安裝一次（https://github.com/city96/ComfyUI-GGUF），並重新啟動引擎。在安裝之前，生成會失敗，並顯示相關訊息。
- **需要其他輸入的模型。** 需要控制用的影片、語音、鏡頭運動、姿勢影片的模型（Wan Fun Control、Wan Animate、Flux Canny 等），目前還無法運作。生成會失敗，並顯示該模型所需要的東西。
3. 所選的模型會加上 ✓，卡片的圖像（封面圖像）也會跟著切換。

清單下方的 **{{ui:app.tabs.short.models}}** 按鈕可以前往 {{ui:app.tabs.models}} 分頁（管理已有的模型），**{{ui:app.tabs.short.browse}}** 按鈕可以前往 {{ui:app.tabs.browse}} 分頁（在網路上尋找）。增加模型的方法，會在[準備模型](08-models.md)中說明。

如果模型登錄了建議的設定（步數、CFG、排程器、尺寸），選擇模型時就會自動帶入。
切換成系列不同的模型時，與新模型不相容的 LoRA 等會被移除（會通知移除的數量）。

按下模型欄下方的 **{{ui:params.profile.title}}** 按鈕，會以清單顯示該模型的建議值。如果目前的設定與建議值有落差，按鈕會變成醒目的顏色，按下 **{{ui:params.profile.apply}}** 就能調成建議值。 步數是以建議值稍低到稍高的範圍來判斷。Anima 的模型在步數少時圖像容易崩壞（有時會被塗成單一顏色），所以範圍的下限偏高（建議值為 30 時，要 24 以上）。

> 完全沒有安裝任何模型時，欄位會顯示「{{ui:params.model.noModels}}」，無法生成。請先完成[準備模型](08-models.md)。

## 其他設定

提示詞的下方，並排著整理好設定的區塊。點選即可展開或收合。

| 區塊 | 內含項目 |
|---|---|
| **{{ui:params.refImage.sectionLabel}}**（提示詞的正下方） | 用來讓畫面氛圍或登場角色靠近的圖像（後述） |
| **{{ui:params.i2i.title}}** | 依原圖重畫（i2i）時的原始圖像，以及{{ui:params.image.strength}}（後述） |
| **{{ui:params.image.title}}** | {{ui:params.image.aspect}}、寬度與高度。也有「{{ui:params.image.swap}}」「{{ui:params.image.lock}}」「{{ui:params.image.optimal}}」按鈕 |
| **{{ui:params.generation.title}}** | LoRA（可加入畫風或角色的小型附加模型）、{{ui:params.generation.scheduler}}、{{ui:params.generation.sampler}}、{{ui:params.generation.noiseSchedule}}（直接以 ComfyUI 的名稱選擇。選「{{ui:params.generation.engineAuto}}」時，會依排程器或模型的預設，並顯示當時使用的名稱為「自動（名稱）」。FLUX.2 只有取樣器）、{{ui:params.generation.steps}}、{{ui:params.generation.cfg}} |
| **{{ui:params.hires.title}}** | 將畫好的圖像放大，再重畫一次的第二次生成（後述） |
| **{{ui:params.advanced.title}}** | {{ui:params.advanced.vae}}、{{ui:params.advanced.clipSkip}}、{{ui:params.advanced.seamless}}（連接起來也不會出現接縫的圖像。可用於 SD1.X 與 SDXL 的模型，需要事先從擴充功能畫面安裝擴充功能 ComfyUI-seamless-tiling）等 |

不確定時，除了尺寸以外，維持選擇模型時帶入的內容即可。
將游標移到項目名稱（「{{ui:params.generation.steps}}」「{{ui:params.generation.cfg}}」等）上，會顯示簡短的說明。區塊標題上會以小字顯示目前數值的摘要。

尺寸越大，花費的時間與對電腦的負擔就越多。建議先用小一點的尺寸嘗試，滿意之後再用[放大](06-upscaling-workflows.md)變大。

## 高解析度修復

![展開高解析度修復區塊並開啟的樣子](shot:hires-fix)

一開始就用大尺寸繪製，人物容易變成 2 個人，或形狀容易崩壞。**{{ui:params.hires.title}}** 會先以設定的尺寸繪製，放大之後，再用相同的種子與設定重畫一次。一次生成就能得到細節完整的大圖像。這個區塊位於 {{ui:app.tabs.generate}} 分頁與 {{ui:app.tabs.comic}} 分頁。

- **{{ui:params.hires.enable}}**：開啟後即可使用。
- **{{ui:params.hires.scale}}**：1.25 到 2 倍。完成後的尺寸會顯示在區塊標題與最下面一行。
- **{{ui:params.hires.strength}}**：0.2 到 0.75。低時會幾乎保留第一次的圖像，高時則會大幅重畫。一開始是 0.45。
- **{{ui:params.hires.method}}**：**{{ui:params.hires.methodSmooth}}** 不使用模型來放大。如果已安裝 {{ui:app.tabs.upscaling}} 分頁所使用的放大模型，也可以選擇那些模型。
- **{{ui:params.hires.steps}}**：第二次的步數。為 0 時，會以與第一次相同的步數繪製。

需要的時間是畫 2 次的份量。進度是將 2 次合併計算。LoRA 與參考圖像在第二次也會使用。

完成的尺寸大幅超出模型擅長的尺寸時（長邊在 SDXL 約為 2048 px，在 SD1.X 約為 1536 px），生成按鈕下方會顯示注意事項。雖然可以生成，但如果圖像崩壞，請降低放大倍率。

圖像會保存第一次的尺寸與{{ui:params.hires.title}}的數值。用圖庫的「{{ui:gallery.menu.useAll}}」讀入時，{{ui:params.hires.title}}也會照樣帶入。

## 生成次數與生成按鈕

![按下生成按鈕旁邊的箭頭所展開的選單](shot:invoke-menu)

左側面板的上方，集中了生成的操作。

- **{{ui:params.invoke.invoke}}**（藍色按鈕）：加到佇列的最後並生成。也可以按 `Ctrl+Enter`。
- **× 旁邊的數字**：一次操作所製作的張數。設為「3」就會製作 3 張。
- **紅色的 × 按鈕**：取消目前正在畫的項目。
- 各按鈕右側的 **∨**：其他操作的選單。

無法按下時，按鈕會變成灰色，按鈕下方一行會顯示原因（例如沒有選擇模型）。將游標移到按鈕上，可以看到原因的清單。
繪製期間，按鈕會變成「{{ui:params.invoke.generating}}」，並顯示進度（%）與佇列的等待數量。

### 生成按鈕的 ∨ 選單

- **{{ui:params.invoke.addBack}}**（`Ctrl+Enter`）：依按下的順序排列並繪製。與一般的生成相同。
- **{{ui:params.invoke.addFront}}**（`Ctrl+Shift+Enter`）：插隊到等待行列的最前面。想趕快只試一張時使用。
- **{{ui:xyplot.menu}}**：以目前的設定為基礎，將只改變 1 到 2 個設定的圖像，並排在 1 張表中。因為是用相同的種子繪製，所以差異只來自改變的設定。在橫向與縱向選擇 CFG 比例、步數、模型等，填入數值後按下 **{{ui:xyplot.run}}**。

### 取消的選單

按下紅色 × 按鈕右邊的 ∨，會顯示以下選單。

- **{{ui:params.invoke.cancelCurrent}}**（`Shift+X`）
- **{{ui:params.invoke.clearQueue}}**（`Ctrl+Shift+X`）：等待中的項目與繪製中的項目，全部清除。不會出現確認。
- **{{ui:params.invoke.pause}}** / **{{ui:params.invoke.resume}}**：暫停或繼續佇列的處理。
- **{{ui:params.invoke.openQueue}}**

## 查看做好的圖像

![生成結束的畫面。中央的檢視器顯示著圖像，右側的圖庫中也排列著圖像](shot:generate-result)

按下之後，中央會立刻切換為檢視器。
繪製期間，右側圖庫的上方會出現「{{ui:gallery.generating.title}}」的橫條，可以看到過程中的圖像、步數與進度。中央上緣的細線也會顯示進度。同一張圖像也會在圖庫的最前面，以小方框的形式排列。按下這個方框，就能在中央的檢視器中放大查看過程中的圖像。生成結束後，會切換為完成的圖像。

完成之後，圖像會加入圖庫，並顯示在檢視器中。
圖像會儲存到目前選取的（在右側面板中標有「{{ui:gallery.boards.autoBadge}}」記號的）看板。關於看板，以及圖像的整理、比較與重做，會在[圖庫與檢視器](03-gallery.md)中說明。

> 如果檢視器自動切換到新圖像讓你覺得困擾，請在{{ui:gallery.settings.title}}（齒輪按鈕）中，關閉「{{ui:gallery.settings.autoSwitch}}」。

## 預設

![預設的清單。並排著內建的預設與已儲存的預設](shot:presets)

常用的設定組合可以儲存為預設。按下左側面板最上方的「{{ui:presets.label}}」卡片，就會展開清單。

預設會一併包含以下內容。

- 提示詞（正向與反向）
- 模型與各項設定（尺寸、步數、CFG、排程器、VAE 等）
- LoRA 與參考圖像
- {{ui:params.hires.title}}、**{{ui:app.tabs.upscaling}}** 分頁的設定、局部重繪的設定（遮罩模糊、向外補畫等）、動態提示詞的產生方式

種子、張數與要放大的圖像不會包含在內。

使用方法如下。

- 點選清單中的項目，該設定就會套用（**{{ui:presets.apply}}**）。
- 用清單下方的 **{{ui:presets.saveNew}}**（或卡片旁邊的儲存按鈕），為目前的設定命名並儲存。
- 項目右側的「…」，可以進行 **{{ui:presets.apply}}**、**{{ui:presets.overwrite}}**、**{{ui:presets.rename}}**、**{{ui:presets.delete}}**。
- 清單分為「{{ui:presets.group.mine}}」與「{{ui:presets.group.builtin}}」。內建的預設是一開始就有的範例。

### 隨機輪流使用預設

可以隨機輪流使用幾個預設，一次大量生成。想連續製作許多提示詞與尺寸都大不相同的圖像時使用。

1. 按下「{{ui:presets.label}}」卡片右側的交叉箭頭按鈕（{{ui:presets.run.title}}）。
2. 勾選要使用的預設。
3. 在「×」欄位填入{{ui:presets.run.count}}，按下 **{{ui:presets.run.queue}}**。

每一張圖都會以相同的機率，從勾選的預設中選出 1 個，種子也是隨機的。預設中沒有包含的設定，會使用左側面板目前的設定。左側面板的設定不會改變。

- 如果各預設使用的模型不同，每次切換都要花時間讀取模型。
- 提示詞中有動態提示詞時，每張圖會依種子選出 1 個提示詞（不會製作所有組合）。
- 勾選的預設中，只要有任何一個處於無法生成的狀態，就會顯示它的名稱與原因，且無法加入佇列。
- 勾選與張數，下次開啟時也會保留。

## 提示詞預設

![提示詞預設。依分類並排著單字與意思，並有「正向」「反向」的新增按鈕](shot:prompt-book)

為了讓你即使不記得英文單字，也能組合提示詞，備有 **{{ui:params.promptBook.open}}**。從正向、反向各欄位上方的按鈕開啟。

- 在左側選擇分類（人數與人物、人物的關係與互動、姿勢、動作、表情、視線、構圖、髮型、服裝等），就只會顯示該分類的單字。上方的搜尋欄可以同時搜尋單字、意思、分類與備註。
- 按下單字右側的「{{ui:params.prompt.positive}}」或「{{ui:params.prompt.negative}}」，該單字就會加入提示詞。加入的單字會打勾，再按一次就會取消。
- 在最上方的輸入欄填入單字與意思，按下 **{{ui:params.promptBook.register}}**，就能加入自己的單字。單字右側的鉛筆可以編輯，垃圾桶可以刪除。

## 參考圖像

**{{ui:params.refImage.sectionLabel}}** 是用來讓新圖像靠近既有圖像的「氛圍」與「風格」的功能。它不是原樣複製，而是以色彩運用、畫風與整體印象為線索。

1. 按下提示詞下方的 **＋** 按鈕，新增 1 個方框。
2. 將圖庫中的圖像拖放到該方框。也可以拖放電腦裡的圖像檔案來使用。
3. 點選方框，就會開啟設定的小視窗。

在小視窗中，可以決定以下事項。

- **{{ui:params.refImage.model}}**：參考圖像專用的模型（IP-Adapter）。需要符合所選模型系列的項目。
- **{{ui:params.refImage.methodLabel}}**：整體、僅風格、僅構圖等，以什麼作為線索（依模型系列不同，可能不會顯示）。
- **{{ui:params.refImage.weight}}**：靠近的強度。
- **{{ui:params.refImage.begin}}** 與 **{{ui:params.refImage.end}}**：在繪製過程中，從哪裡到哪裡發揮作用。

如果尚未安裝所需的模型或擴充功能，方框上會出現警告記號，小視窗與生成按鈕下方會顯示說明。可以從說明中的按鈕進行安裝。

> 參考圖像是用來「讓氛圍靠近」。如果想「以這張圖為基礎重畫」，請使用下面的 i2i。

## i2i（從原圖重畫）

在 **{{ui:params.i2i.title}}** 區塊中放入圖像，就會以該圖像為草稿重畫。想直接保留構圖與色彩，同時配合提示詞做變化時使用。

1. 展開區塊，將圖庫中的圖像（或電腦裡的圖像檔案）拖放到方框中。也可以從參考圖像小視窗的 **{{ui:params.refImage.openI2i}}** 放入。
2. 寬度與高度會變成最接近所放入圖像形狀、且是模型擅長的尺寸。事後手動更改也沒有問題。
3. 用 **{{ui:params.image.strength}}** 決定要重畫多少。越接近 0 越維持原圖，越接近 1 就越不在意原圖來繪製。建議從 0.5 前後開始嘗試。

開啟 {{ui:params.hires.title}} 後，會將從原圖重畫的圖像放大，再重畫一次。要取下圖像時，按方框右上角的 ×。想只重畫塗抹的部分時，請使用[在畫布上補畫](05-canvas.md)。

### 角色

參考圖像上方的「{{ui:character.row.label}}」欄位，可以叫出已登錄的人物（同一個人物的任意張數圖像，並附上外觀的詞彙）。
選擇之後，就會設定該人物的參考圖像與外觀詞彙。人物的登錄方法，會在[修飾與沿用圖像](04-improve.md)中說明。

## 佇列

![佇列分頁。以清單顯示處理中的項目與等待中的項目](shot:queue)

在 **{{ui:app.tabs.queue}}** 分頁，可以查看並操作生成的排隊情形。有項目在等待時，側邊導覽列的 {{ui:app.tabs.queue}} 上會出現數字徽章。

畫面上方有以下內容。

- 處理的狀態（「{{ui:queue.processor.running}}」或「{{ui:queue.processor.paused}}」）與操作按鈕。
- 項目數量的明細（{{ui:queue.status.pending}}、{{ui:queue.status.inProgress}}、{{ui:queue.status.completed}}、{{ui:queue.status.failed}}、{{ui:queue.status.canceled}}）。
- 右上方是目前正在畫的項目的進度。

按鈕的作用如下。

| 按鈕 | 作用 |
|---|---|
| **{{ui:queue.action.pause}}** / **{{ui:queue.action.resume}}** | 暫停、繼續排隊等候的處理。正在畫的項目會照樣畫到最後 |
| **{{ui:queue.action.cancelCurrent}}** | 停止目前正在畫的項目 |
| **{{ui:queue.action.cancelAllExceptCurrent}}** | 取消所有等待中的項目 |
| **{{ui:queue.action.prune}}** | 從清單中清除已結束的項目（完成、失敗、取消） |
| **{{ui:queue.action.clear}}** | 清除所有項目。會出現確認視窗 |

點選下方清單的列，會展開該項目的詳細資訊（時間、做好的圖像、失敗時的原因、設定內容）。
用列右側的 × 可以只取消該項目。失敗或已取消的項目會出現重試按鈕。

## 快速鍵

在輸入文字期間不會作用的按鍵，請先離開輸入欄再按。

| 操作 | 按鍵 |
|---|---|
| 生成（加到佇列最後） | `Ctrl+Enter`（輸入提示詞時也能使用） |
| 加到佇列最前面並生成 | `Ctrl+Shift+Enter` |
| 取消正在畫的項目 | `Shift+X` |
| 清除全部佇列（不確認） | `Ctrl+Shift+X` |
| 移到提示詞欄位 | `Alt+A` |
| 開合左側面板、右側面板 | `T`、`G` |
| 同時開合左右面板 | `F` |
| 切換分頁（依側邊導覽列的順序，從 {{ui:app.tabs.generate}} 到 {{ui:app.nav.extensions}}） | `1` 到 `9` |
| 開啟快速鍵一覽 | `Shift+?` |

快速鍵也可以在側邊導覽列 **{{ui:app.nav.settings}}** 選單的「{{ui:app.nav.hotkeys}}」中確認。
