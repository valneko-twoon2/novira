# 開始使用

## novira 能做什麼

novira 是一款 Windows 桌面應用程式，可以製作圖像、影片、音樂與語音。
寫下提示詞（描述你想做出什麼的文字），按下 **{{ui:params.invoke.invoke}}** 按鈕，圖像就會在你的電腦裡畫出來，並排列在右側的圖庫中。
畫面的架構與操作，是以圖像生成工具 InvokeAI 的畫面為基礎。用過 InvokeAI 的人，可以用同樣的手感操作。

能做的事大致如下。

- 用文字製作圖像（這份手冊以此為主）
- 以圖像為基礎重新製作、只重畫一部分、放大
- 製作影片、音樂、語音、Logo 與含文字的圖像
- 向 AI 助理諮詢設定與提示詞

> 繪圖的處理都在你的電腦裡進行。搜尋與下載模型、AI 助理等使用網路的功能，只有在你選擇使用時才會連線。

## 圖像是怎麼做出來的

novira 由以下 4 個部分組成。

| 部分 | 作用 |
|---|---|
| novira（本應用程式） | 畫面、圖庫、排隊等候（佇列）、模型管理 |
| 圖像生成引擎（ComfyUI） | 實際畫圖的部分。由 novira 自行安裝、自行啟動並執行 |
| 模型 | 用來繪圖的學習資料。每個是數 GB 的檔案，需要與引擎分開準備 |
| 資料資料夾 | 存放製作出的圖像、模型、引擎本體等的地方 |

引擎不需要使用者自己安裝。第一次啟動時，novira 會自動安裝。
引擎與它的元件（Python 等）只會放進 novira 的資料資料夾裡。電腦其他位置，以及已經安裝的 Python，都不會被更動。

資料資料夾的名稱是 `novira-data`，位於應用程式的資料夾中。要搬移或備份圖像與模型時，就使用這個資料夾。

> 生成圖像會用到 GPU（顯示卡）。預設會安裝適用於 NVIDIA GPU 的引擎。

模型決定「要用什麼畫風來畫」。一開始需要先有 1 個模型。安裝方法請見[準備模型](08-models.md)。

## 第一次啟動時

開啟應用程式後，會先出現啟動畫面（Logo，以及緩緩飄浮的圖像泡泡）。
啟動畫面下方會出現一張卡片，顯示目前正在做什麼。

第一次啟動時，會開始安裝圖像生成引擎。卡片會依序顯示 3 個階段。

1. **{{ui:splash.step.downloading}}**：下載 ComfyUI 與 Python。同時也會顯示大小、速度與預估剩餘時間。
2. **{{ui:splash.step.extracting}}**：解壓縮下載的檔案。
3. **{{ui:splash.step.starting}}**：啟動引擎，等待連線完成。

> {{ui:engine.firstRunNote}}

安裝只需要一次。從第二次起，啟動畫面只要幾秒就結束，引擎也會馬上開始運作。

引擎準備完成後，啟動畫面會消失，開啟主畫面。
讀取資料時會顯示「{{ui:splash.wait.heading.loading}}」，等待讀取引擎與編輯所需的資訊時則顯示「{{ui:splash.wait.heading.preparing}}」。

### 畫面上方出現的訊息

開啟應用程式後，如果引擎重新啟動或重新安裝，畫面上方中央會出現一條橫幅（banner），告知目前的狀況。

- 「{{ui:engine.title.downloading}}」「{{ui:engine.title.extracting}}」「{{ui:engine.title.starting}}」：作業進行中。完成之前不會開始生成。完成後橫幅會自動消失。
- 「{{ui:engine.title.error}}」：無法準備好引擎。橫幅下方一行會顯示原因。

啟動畫面出現錯誤時，原因下方會出現 **{{ui:splash.open}}** 按鈕。按下後，可以在沒有引擎的情況下開啟應用程式。可以確認模型與變更設定，但無法製作圖像。
錯誤持續發生時，請參閱[遇到問題時](10-troubleshooting.md)。

## 認識畫面

![生成分頁的整體畫面。左側是參數面板，中央是開始畫面，右側並排著看板與圖庫](shot:generate)

畫面由左至右依序排列如下。

- 最左邊的細長直條：**側邊導覽列**。用來切換分頁。
- 左側面板：**參數面板**。裡面有提示詞、模型等製作圖像所需的設定。
- 中央：**主檢視區**。開始畫面、圖像檢視器、畫布等，依分頁而定的作業場所。
- 右側面板：**圖庫**。並排著看板（類似資料夾的東西）與製作出的圖像縮圖。

### 側邊導覽列（分頁）

| 分頁 | 用途 | 數字鍵 |
|---|---|---|
| **{{ui:app.tabs.generate}}** | 製作圖像。也可以用上方的圖示切換為影片、音樂、語音、Logo、文字、漫畫 | `1` |
| **{{ui:app.tabs.canvas}}** | 放置圖像，補畫內容或只重畫一部分 | `2` |
| **{{ui:app.tabs.comic}}** | 製作漫畫頁面：分格排列、每個分格的圖像、對話框與旁白。也可以從{{ui:app.tabs.generate}}分頁上方圖示的最右側圖示開啟 | `3` |
| **{{ui:app.tabs.upscaling}}** | 放大圖像，同時補畫細節 | `4` |
| **{{ui:app.tabs.workflows}}** | 連接零件（節點），建立專屬於自己的生成流程 | `5` |
| **{{ui:app.tabs.models}}** | 已有模型的清單、安裝、刪除 | `6` |
| **{{ui:app.tabs.browse}}** | 搜尋網路上的模型並匯入 | `7` |
| **{{ui:app.tabs.queue}}** | 查看、停止生成的排隊狀況。等待中的數量會以徽章顯示 | `8` |
| **{{ui:app.nav.extensions}}** | 尋找 ComfyUI 擴充功能，並安裝或移除 | `0` |

側邊導覽列的下方還有以下項目。

- **{{ui:app.tabs.short.agent}}**：在目前的畫面上開啟 AI 助理視窗。
- **{{ui:app.nav.settings}}**：從選單開啟 {{ui:app.nav.settings}}、{{ui:app.nav.hotkeys}}、{{ui:app.nav.about}}。
- 最上方的「n」Logo：開啟{{ui:app.nav.about}}。

各項的使用方法，會在後面的章節說明。

- {{ui:app.tabs.generate}}、{{ui:app.tabs.queue}}：[製作圖像](02-generate.md)
- 圖庫、檢視器：[圖庫與檢視器](03-gallery.md)
- {{ui:app.tabs.canvas}}：[在畫布上補畫](05-canvas.md)
- {{ui:app.tabs.comic}}：[繪製漫畫](12-comic.md)
- {{ui:app.tabs.upscaling}}、{{ui:app.tabs.workflows}}：[放大與工作流程](06-upscaling-workflows.md)
- 影片、音樂、語音等：[影片、音樂、語音、Logo、文字](07-media.md)
- {{ui:app.tabs.models}}、{{ui:app.tabs.browse}}：[準備模型](08-models.md)
- {{ui:app.tabs.short.agent}}、{{ui:app.nav.settings}}：[AI 助理與設定](09-assistant-settings.md)

### 中央的分頁（開始、檢視器、草稿）

{{ui:app.tabs.generate}}分頁的中央上方，有 3 個小分頁。

- **{{ui:app.views.launchpad}}**：開始方式的導引。會顯示「{{ui:params.launchpad.generate.textTitle}}」「{{ui:params.launchpad.generate.refTitle}}」等卡片，以及快速鍵提示。
- **{{ui:app.views.viewer}}**：放大檢視圖像的地方。在圖庫中選取圖像後，就會顯示在這裡。
- **{{ui:app.views.drafts}}**：以相同設定、只更換種子，並排顯示許多畫到一半的候選圖，只把喜歡的候選圖畫完的畫面。

其他分頁也有各自專用的小分頁（例如{{ui:app.tabs.canvas}}有 {{ui:app.views.canvas}} 等）。

### 隱藏面板

想把圖像看得更大時，可以隱藏左右的面板。

- 用中央上緣的小箭頭按鈕，開合左側面板與右側面板。
- 使用鍵盤時，按 `T` 開合左側面板，按 `G` 開合右側面板，按 `F` 同時開合左右兩側。
- 拖曳面板與面板之間的邊界，可以調整寬度。寬度會在開啟應用程式期間記住（重新啟動後會回到原本的寬度）。

> `T`、`G`、`F` 等單一字元的快速鍵，在輸入文字時不會作用。請先離開輸入欄再按。

## 製作第一張圖（3 個步驟）

這是第一次製作圖像的流程。以下假設已經安裝好模型。

1. **選擇模型。** 從左側面板上方的模型欄，選擇想用的模型。如果欄位顯示「{{ui:params.model.noModels}}」，請先完成[準備模型](08-models.md)。
2. **寫下提示詞。** 在「{{ui:params.prompt.positive}}」欄中，用文字寫下想畫的圖。例如 `a lighthouse on a cliff at dusk, calm sea, warm light`，用逗號連接單字或短句。多數模型使用英文比較容易得到想要的結果。
3. **按下{{ui:params.invoke.invoke}}。** 按下按鈕，或按 `Ctrl+Enter`。右側圖庫上方會出現「{{ui:gallery.generating.title}}」的顯示，可以看到過程中的圖像與進度。完成後，中央的檢視器會顯示圖像，圖庫中也會出現這張圖。

按鈕呈灰色、無法按下時，按鈕下方一行會顯示原因（例如「{{ui:params.readiness.noModel}}」）。排除原因後就能按下。

製作出的圖像會自動儲存到圖庫。如果不滿意，只要稍微修改提示詞或設定，再按一次即可。
詳細內容請繼續閱讀下一章[製作圖像](02-generate.md)。
