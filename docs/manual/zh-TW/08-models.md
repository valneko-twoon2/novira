# 管理與搜尋模型

要製作圖像，需要作為圖像基礎的「模型」。novira 有整理手邊模型的 **{{ui:app.tabs.models}}** 分頁，以及在網路上搜尋並下載模型的 **{{ui:app.tabs.browse}}** 分頁。

這一章說明這 2 個分頁的使用方法、模型的種類，以及授權的看法。

## 模型的種類

模型有「{{ui:models.sort.base}}」（屬於哪個系列）與「{{ui:models.sort.type}}」（扮演什麼角色）。

### 基礎（系列）

模型是依系列製作的，不同系列的模型無法組合。例如，SDXL 的模型，無法使用 SD1.5 用的 LoRA。

| 顯示 | 內容 |
|---|---|
| SD1.X | Stable Diffusion 1.5 等。執行起來很輕量 |
| SD2.X | Stable Diffusion 2 系列 |
| SDXL | Stable Diffusion XL 系列。許多插畫用的模型（Illustrious、NoobAI、Pony 等）也屬於這裡 |
| SD3.X | Stable Diffusion 3 系列 |
| FLUX | FLUX 系列 |
| Any | 不限系列的東西（放大器等） |

> 除了 SD1.X、SD2.X、SDXL 之外，也能用新系列（Anima、Flux、FLUX.2、Chroma、Qwen-Image、Z-Image、SD3、HiDream、AuraFlow、HunyuanImage、Hunyuan-DiT）的模型製作圖像，用 Wan、HunyuanVideo、LTX-Video 的模型則可以在影片畫面製作影片。其他系列的模型雖然會出現在清單中，但生成時會失敗，並顯示系列名稱。使用方式請見「生成」一章。

模型與 LoRA 的基礎不相符時，**{{ui:app.tabs.generate}}** 畫面的製作按鈕會無法按下，並顯示原因。

### 種類

| 種類 | 作用 |
|---|---|
| {{ui:models.rail.main}}（{{ui:models.type.main}}） | 繪製圖像的本體 |
| {{ui:models.type.lora}} | 加到本體上，增添畫風或角色的小型模型 |
| {{ui:models.type.vae}} | 用來修飾圖像顏色與細節的零件 |
| {{ui:models.type.controlnet}}、{{ui:models.type.modelPatch}} | 指定姿勢或線稿等圖像的形狀（模型修補用於 Anima、Qwen-Image、Z-Image） |
| {{ui:models.type.ipAdapter}}、{{ui:models.type.clipVision}} | 將參考圖像的氛圍反映到生成中 |
| {{ui:models.rail.upscale}} | 放大圖像 |
| {{ui:models.rail.encoders}} | 理解文字的零件（T5、Qwen、CLIP 等。像 Anima 或 Flux 這樣，需要與本體分開準備的東西） |
| {{ui:models.rail.diffusion}} | Flux、Wan、Anima、Qwen-Image 等，只有本體單獨發布的模型。安裝時會查看內容，判別種類與系列 |

影片、音樂、語音、Logo 用的模型，不會出現在這個清單中。請從各自的畫面下載（[影片、音樂、語音、Logo、文字](07-media.md)）。

## 模型分頁

![模型分頁。左側是類別，中間排列著模型的卡片](shot:models)

**{{ui:app.tabs.models}}** 分頁，是已安裝的模型清單。

### 尋找

用左側的 **{{ui:models.rail.title}}**，可以依種類篩選。右邊會顯示數量。

- **{{ui:models.rail.all}}**：全部
- **{{ui:models.rail.favorites}}**：加上星號的
- **{{ui:models.rail.main}}**、**{{ui:models.rail.lora}}**、**{{ui:models.rail.controlnet}}**、**{{ui:models.rail.vae}}**、**{{ui:models.rail.ipAdapter}}**、**{{ui:models.rail.upscale}}**、**{{ui:models.rail.encoders}}**、**{{ui:models.rail.diffusion}}**

在上方的列中，可以用名稱篩選（**{{ui:models.searchPlaceholder}}**）、用基礎篩選、**{{ui:models.sort.label}}**（{{ui:models.sort.name}}、{{ui:models.sort.size}}、{{ui:models.sort.base}}、{{ui:models.sort.type}}）、切換 **{{ui:models.view.grid}}** 與 **{{ui:models.view.list}}**，以及調整縮圖的大小。

卡片的左下角，會附上基礎（SDXL 等）與格式的標籤。已知授權的模型，左上角也會附上授權的標籤（[授權的標籤](#授權的標籤)），按下去不需要選取卡片，就能當場開啟授權的內容。卡片較小時，標籤只會剩下記號。將滑鼠移到卡片上，會出現星號（我的最愛）與選單。

畫面的右下角，會顯示模型的數量與合計的大小。

### 新增模型

右上方有 2 個按鈕。

- **{{ui:models.find}}**：移到 **{{ui:app.tabs.browse}}** 分頁（請見下一章）。
- **{{ui:models.import}}**：安裝手邊的檔案，或已知位址的模型。

按下 **{{ui:models.import}}** 後，會開啟 **{{ui:models.import.title}}** 的畫面，可以從 4 種方法中選擇。

| 分頁 | 使用方法 |
|---|---|
| {{ui:models.install.tab.source}} | 輸入模型的位址，按下 **{{ui:models.install.install}}** |
| {{ui:models.install.tab.scan}} | 按下 **{{ui:models.install.scan}}** 開啟對話方塊，選擇資料夾後，裡面的模型就會排列出來。用 **{{ui:models.install.installAll}}** 可以一併安裝。電腦中的檔案要從這裡安裝。在瀏覽器中開啟時無法使用 |
| {{ui:models.install.tab.starter}} | 應用程式挑選出一開始先安裝會很方便的模型並排列出來。相依的模型（VAE 等）也會一併安裝。影片、音樂、語音、Logo、消除功能的模型套件也會排列出來。與模型畫面一樣以卡片排列，可以用左側的 **{{ui:models.starter.purposes}}**（製作圖像、影片、放大等），以及上方 **{{ui:models.starter.allFamilies}}** 的清單（Anima、SDXL 等）來篩選。選擇系列後，該系列所需的 VAE 與編碼器也會一併排列出來 |
| {{ui:models.install.tab.huggingface}} | 用 Hugging Face 的儲存庫名稱（`作者/名稱`）搜尋的欄位 |

**{{ui:models.install.tab.source}}** 欄位可以輸入的內容如下。

- Civitai 模型頁面的位址
- 模型檔案的直接位址（以 `https://` 開頭的）
- Hugging Face 的檔案（`作者/名稱::檔名` 的形式）

輸入電腦中檔案的位置（像 `C:\models\model.safetensors` 的形式）時，會顯示請改用 **{{ui:models.install.tab.scan}}** 的訊息。在那裡選擇的檔案，會匯入應用程式的模型資料夾（如果是同一個磁碟機，容量幾乎不會增加。如果是不同的磁碟機，則會複製）。

> **{{ui:models.install.tab.huggingface}}** 分頁，輸入儲存庫（`作者/名稱`）並按下 **{{ui:models.install.hfLookup}}** 後，會列出該儲存庫中單獨的模型檔案（`.safetensors`、`.gguf`、`.ckpt`、`.pt`、`.pth`）。`unet`、`vae` 等零件資料夾中的檔案不會列出。若已登錄 Hugging Face 的權杖，則使用該權杖取得清單。

安裝作業會依序進行。進度可以按畫面左下角的 **{{ui:models.dock.queue}}**（作業中是「正在安裝 ○ 個」）來開啟 **{{ui:models.queue.title}}** 查看。在這裡，也可以逐件 **{{ui:models.queue.cancel}}**，結束的部分可以按 **{{ui:models.queue.prune}}** 清除。

下載到一半的檔案，要等到完成後才會放進模型資料夾。即使中途停止，也不會留下不完整的檔案。

### 模型的詳細資料

![選取模型後，右側會顯示詳細資料。排列著大小、位置、授權、來源等](shot:models-detail)

按下卡片，右側會展開詳細資料。要關閉時，請按右上方的 **{{ui:models.detail.close}}**。

詳細資料中會顯示名稱、基礎與種類的標籤、說明、**{{ui:models.details.size}}**、**{{ui:models.details.path}}**（可以複製）、**{{ui:models.details.license}}**、**{{ui:models.details.source}}**、**{{ui:models.details.page}}**（原始模型的位址。按下會用瀏覽器開啟）。

模型有多張圖片時，可以用圖片左右的箭頭切換，右下角會顯示是第幾張（從 Civitai 安裝的模型，會放入原始頁面的圖片）。

用上方的按鈕，可以進行下列操作。

- **{{ui:models.detail.openSource}}**：用瀏覽器開啟原始模型的頁面（只限知道頁面的模型）。
- **{{ui:common.edit}}**：修改名稱、說明、基礎、種類。在基礎或種類沒有被自動正確判斷時使用。
- **{{ui:common.delete}}**：刪除模型（請見下方）。

從 Civitai 安裝的模型如果推出了新版本，卡片會附上 **{{ui:models.updates.tag}}** 的標籤，詳細資料的上方會顯示新版本的名稱與日期。按下 **{{ui:models.updates.open}}**，會用瀏覽器開啟新版本的頁面。新版本會在開啟模型分頁時（距離上次確認已超過 1 天的話）自動確認，有新發現時也會用通知告知。想立刻確認時，請按上方的 **{{ui:models.updates.check}}** 按鈕。只有相同基礎的新版本會成為對象，付費的版本不會顯示。確認時，已安裝模型的 Civitai 編號會傳送給 Civitai。

### 觸發詞

LoRA 等模型，有使用時放進提示詞就會發揮效果的詞彙（觸發詞）。登錄在 **{{ui:models.triggers.title}}** 中後，在 **{{ui:app.tabs.generate}}** 畫面選擇該 LoRA 時，詞彙會以按鈕顯示。按下就會加到提示詞中。

在輸入欄輸入詞彙並按下 **{{ui:common.add}}**，就會登錄。用 × 可以移除。變更會立即儲存。從 Civitai 安裝的模型，有時一開始就已經放入了發布來源所標示的詞彙。

### 預設值設定

本體的模型，有 **{{ui:models.defaults.title}}**。是在生成畫面選擇該模型時，會自動填入的值。

- **{{ui:models.defaults.scheduler}}**
- **{{ui:models.defaults.steps}}**
- **{{ui:models.defaults.cfgScale}}**
- 寬度與高度

另外，也可以儲存 **{{ui:models.defaults.vae}}** 與 **{{ui:models.defaults.vaePrecision}}**。只有將各項目的開關開啟的，才會被儲存。按下 **{{ui:common.save}}** 確定。

每個模型的「建議值」都不同，所以常用的模型只要設定一次，就不必每次都修改。

### 刪除

按下 **{{ui:common.delete}}** 會出現確認。**{{ui:models.deleteWarning}}**

不過，novira 安裝的模型（應用程式資料資料夾中的），連檔案都會被刪除，但位於自己準備的資料夾中的模型，只會從清單中移除，檔案會保留。

## 授權的標籤

模型有發布來源所訂定的使用條件（授權）。novira 會用標籤顯示它的重點。

| 標籤 | 意思 |
|---|---|
| {{ui:browse.commercial.allowed}} | 販售生成的圖像、用於生成服務、販售模型本身，全都被允許 |
| {{ui:browse.commercial.limited}} | 只允許一部分的商業用途（有未記載的項目時，也是這個標籤） |
| {{ui:browse.commercial.denied}} | 販售生成的圖像、用於生成服務、販售模型本身，全都不被允許 |

按下標籤，會以清單顯示 **{{ui:browse.permission.title}}**。例如關於「{{ui:browse.permission.sellImages}}」「{{ui:browse.permission.sellModel}}」「{{ui:browse.permission.shareMerges}}」等，可以看出可、不可、未記載。

標籤在 Civitai 是依據作者設定的使用許可，在 Hugging Face 則是依據授權的顯示來決定。這是以網站的顯示為基礎的參考，最終請務必確認發布來源的授權全文。**{{ui:browse.permission.disclaimer}}**

不清楚安裝的模型的授權時，會顯示 **{{ui:models.details.licenseUnknown}}**。

> 也有非商用授權的模型。例如，影片的 **{{ui:video.model.fast}}** 就是非商用授權。將製作的圖像或影片用於工作或販售時，請務必確認所使用模型的授權。

## 探索分頁

![探索分頁。上方有搜尋的地方、種類、搜尋欄、篩選，下方排列著模型的卡片](shot:browse)

**{{ui:app.tabs.browse}}** 分頁，是搜尋網路上的模型並直接下載的畫面。

### 搜尋的地方

用左上方的切換，選擇搜尋的地方。

- **{{ui:browse.source.civitai}}**：聚集了許多插畫與 LoRA 的網站。
- **{{ui:browse.source.huggingface}}**：有許多研究機構與企業模型的網站。無法依名稱搜尋，請把模型頁面的 URL（資料夾或檔案的頁面也可以）或 `作者/名稱` 貼到畫面中央的大輸入框，然後按下 **{{ui:models.install.hfLookup}}**。勾選顯示出的檔案，再按下右上角的安裝按鈕即可開始下載。如果貼上的是資料夾的 URL，一開始只會顯示該資料夾中的檔案。

在它的旁邊，選擇 **{{ui:browse.kind.label}}**。有 **{{ui:browse.kind.lora}}**、**{{ui:browse.kind.checkpoint}}**、**{{ui:browse.kind.controlnet}}**、**{{ui:browse.kind.vae}}**、**{{ui:browse.kind.diffusion}}**、**{{ui:browse.kind.all}}**。

### 篩選

在搜尋欄輸入模型名稱、作者、標籤。輸入後稍等一下，結果就會更換。

用右側的選單可以篩選。

| 項目 | 內容 |
|---|---|
| {{ui:browse.base.label}} | {{ui:browse.base.sdxlCompat}}、{{ui:browse.base.illustrious}}、{{ui:browse.base.noobai}}、{{ui:browse.base.sdxl}}、{{ui:browse.base.pony}}、{{ui:browse.base.sd15}}、{{ui:browse.base.flux}}、{{ui:browse.base.anima}} 等 |
| {{ui:browse.sort.label}} | {{ui:browse.sort.downloads}}、{{ui:browse.sort.rating}}、{{ui:browse.sort.newest}} |
| {{ui:browse.period.label}} | 全部期間、1 年、1 個月、1 週、24 小時（僅限 Civitai）。付費的版本，卡片上會顯示「{{ui:browse.paid.badge}}」。搶先體驗中的版本，也會顯示變成免費的日期。付費的版本，即使已經購買，應用程式也無法判別，所以無法安裝（按鈕無法按下）。請在 Civitai 的頁面取得 |
| {{ui:browse.nsfw.label}} | 預設為關閉。開啟後，也會顯示成人向的模型 |
| **{{ui:browse.filter.button}}** | 按下會展開一個框，可以用授權允許的事項（販售生成的圖像、用於生成服務等。只會顯示允許勾選的所有事項的模型）、檢查點的種類、費用（{{ui:browse.filter.free}}、{{ui:browse.filter.paid}}）、只顯示有 safetensors 格式檔案的、作者（名稱完全相同的）來篩選。按鈕上會顯示篩選了幾項，用 **{{ui:browse.filter.reset}}** 可以還原（僅限 Civitai） |

捲動到最下方，就會載入後續內容。用 **{{ui:browse.status.loadMore}}** 也可以載入。無法取得時，請按下 **{{ui:browse.status.retry}}**。

### 卡片的看法與下載方式

卡片上會顯示範例圖像、模型的名稱、作者、下載次數、喜歡的數量、授權的標籤。LoRA 也會顯示觸發詞。

- **{{ui:browse.card.download}}**：下載該模型的代表檔案。
- 右邊的圖示（**{{ui:browse.card.openCivitai}}**）：用瀏覽器開啟發布來源的網站。

按下卡片，右側會展開詳細資料。可以看到版本、檔案的清單（大小、格式）、觸發詞、標籤、說明、授權。選擇版本，按下想下載的檔案的 **{{ui:browse.card.download}}**。觸發詞按下就能複製。按外側或 `Esc` 可以關閉。

詳細資料的 **{{ui:browse.samples.title}}** 中，會排列出該版本的範例作品裡，設定有公開的那些。可以看到圖片、取樣器、步數、CFG、尺寸、提示詞，以及使用的模型與 LoRA（沒有安裝的會以虛線顯示）。按下 **{{ui:browse.samples.use}}**，提示詞與設定就會填入生成的畫面。範例作品沒有記錄的設定會維持現狀，模型與 LoRA 則只會填入已安裝的。沒有安裝的，會在通知中顯示名稱。設定是作者自己寫的，所以也有沒有設定的範例作品，或是照原樣用也不會產生相同圖像的範例作品。

開始下載後，畫面左下角會出現 **{{ui:browse.dock.title}}** 的小框，可以看到進度。用 **{{ui:browse.dock.cancel}}** 可以中止，結束的部分可以用 **{{ui:browse.dock.clear}}** 清除。下載完成的卡片會變成 **{{ui:browse.card.installed}}**，也會加入 **{{ui:app.tabs.models}}** 分頁的清單。

> 下載需要登入的模型時，請在 **{{ui:settings.title}}** 登錄 Civitai 的 API 金鑰。在 Hugging Face 使用需要申請存取的模型時，請登錄 Hugging Face 的權杖。兩者都會加密後儲存在這台電腦，不會顯示在畫面上。詳情請見[助理與設定](09-assistant-settings.md)。

> 要從 Civitai 取得本機模型的圖片與使用授權，請開啟 **{{ui:settings.title}}** 的 **{{ui:settings.tab.engine}}** 中的 **{{ui:settings.engine.civitai.label}}**。因為會把模型檔案的雜湊值傳送給 Civitai，所以預設為關閉。切換後會從下次啟動起生效。維持關閉時如果有沒有圖片的模型，**{{ui:app.tabs.models}}** 分頁的上方會出現提醒，可以從 **{{ui:models.coverHint.open}}** 開啟設定。

要進入圖像的生成時，請見[生成](02-generate.md)。
