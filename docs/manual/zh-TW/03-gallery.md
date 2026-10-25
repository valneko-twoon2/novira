# 圖庫與檢視器

製作出的圖像，會排列在畫面右側的 **圖庫** 中。在圖庫中選取的圖像，可以在中央的 **{{ui:app.views.viewer}}** 放大檢視。
這一章說明圖像的整理方式、尋找方式、在檢視器中的檢視方式、設定的叫出方式，以及刪除與下載。

## 認識圖庫

右側面板由上下 2 個部分組成。

- 上方：**{{ui:gallery.boards.title}}**。類似用來收納圖像的資料夾。
- 下方：所選看板中圖像的縮圖。

縮圖上方的那一列，有下列項目。

- 「{{ui:gallery.view.images}}」與「{{ui:gallery.view.assets}}」的切換，以及圖像的數量。
- 放大鏡按鈕：搜尋（{{ui:gallery.search.label}}）
- 日曆按鈕：{{ui:gallery.date.button}}
- 齒輪按鈕：{{ui:gallery.settings.title}}
- 向上箭頭按鈕：{{ui:gallery.upload}}

**{{ui:gallery.view.images}}** 中，是以 novira 製作的圖像（也包含影片與語音）。
**{{ui:gallery.view.assets}}** 中，是上傳的圖像，以及像 Logo 這類被當作「與作品分開的素材」來處理的東西。找不到圖像時，請看看另一邊。

縮圖的大小，可以用齒輪按鈕中的滑桿來調整。
影片與語音的縮圖上有播放標記，將游標移上去並橫向移動，就能確認該位置的場景。

## 看板

看板是用來分類整理圖像的容器。「{{ui:gallery.boards.uncategorized}}」是一開始就有的看板，沒有放進看板的圖像會收在這裡。

- **建立**：按下看板欄右上方的 **＋**（{{ui:gallery.boards.add}}）。可以當場輸入名稱。
- **切換**：點擊看板。下方只會排列該看板的圖像。
- **更改名稱**：連按兩下看板的名稱，或從右鍵選單選擇「{{ui:common.rename}}」。
- **搜尋**：用看板欄的放大鏡，可以搜尋看板名稱。
- **收合**：點擊「{{ui:gallery.boards.title}}」的標題。拖曳看板欄的下緣，可以改變高度。

### 新圖像會放進哪個看板

新製作的圖像（上傳的圖像也一樣），會放進標有「**{{ui:gallery.boards.autoBadge}}**」標記的看板。
一開始，每次點擊看板，該看板就會變成「{{ui:gallery.boards.autoBadge}}」。想固定下來時，請在圖庫的設定中關閉「{{ui:gallery.settings.autoAssign}}」，再用看板右鍵選單的「{{ui:gallery.boards.setAutoAdd}}」來指定。

### 看板的右鍵選單

- **{{ui:gallery.boards.setAutoAdd}}**：設為新圖像的儲存位置。
- **{{ui:common.rename}}**
- **{{ui:gallery.boards.archive}}**：將看板從清單中隱藏。它不會消失，只要在圖庫設定中開啟「{{ui:gallery.settings.showArchived}}」，就能再看到。用「{{ui:gallery.boards.unarchive}}」可以恢復。
- **{{ui:gallery.boards.delete}}**：會出現確認視窗，請選擇下列其中一項。
  - 「{{ui:gallery.boards.deleteBoardOnly}}」：圖像會保留，並移到「{{ui:gallery.boards.uncategorized}}」。
  - 「{{ui:gallery.boards.deleteBoardAndImages}}」：連看板中的圖像也一併刪除。

> 「{{ui:gallery.boards.uncategorized}}」無法更改名稱、封存或刪除。

## 選取圖像

縮圖可以用下列方式選取。

| 操作 | 結果 |
|---|---|
| 點擊 | 選取那 1 張。在檢視器中看的圖像，也會換成那張圖像 |
| 按住 `Ctrl` 並點擊 | 加入已選取的圖像，或從選取中移除（多選） |
| 按住 `Shift` 並點擊 | 從先前選取的圖像，到點擊的圖像為止，一併選取 |
| 按住 `Alt` 並點擊 | 與檢視器中的圖像比較（後述） |
| 連按兩下 | 將中央切換成檢視器，放大檢視那張圖像 |
| `Ctrl+A` | 選取目前排列出來的所有圖像 |
| 方向鍵 | 將選取移到前後、上下的圖像。按住 `Shift` 可以擴大範圍 |
| `Esc` | 解除選取 |

> 方向鍵等按鍵，在游標位於圖庫上方，或中央是檢視器時才會作用。

選取的圖像會加上藍色框線。將游標移到縮圖上，會出現下列項目。

- 圖像的尺寸（在圖庫設定的「{{ui:gallery.settings.alwaysShowSize}}」中，也可以設為隨時顯示）
- 星號按鈕（加上、取消星號）
- 垃圾桶按鈕（刪除）

加上星號的圖像，左上角會出現黃色的星號標記。

## 在縮圖上按右鍵

![縮圖的右鍵選單。排列著在檢視器中開啟、下載、混搭、傳送到畫布等項目](shot:gallery-menu)

在縮圖上按右鍵，會以清單顯示可用於該圖像的操作。不能用的操作會變成灰色（例如，沒有設定記錄的圖像，不能使用「{{ui:gallery.menu.remix}}」）。

| 選單 | 作用 |
|---|---|
| **{{ui:gallery.menu.openInViewer}}** | 在中央的檢視器放大檢視 |
| **{{ui:common.download}}** | 儲存圖像的檔案 |
| **{{ui:share.menu}}** | 選擇格式與大小匯出副本（也可以移除生成資訊） |
| **{{ui:common.copy}}**（`Ctrl+C`） | 將圖像複製到剪貼簿 |
| **{{ui:gallery.menu.compare}}**（`Alt+點擊`） | 與檢視器中顯示的圖像比較 |
| **{{ui:gallery.menu.loadWorkflow}}**（`W`） | 開啟製作那張圖像的工作流程 |
| **{{ui:gallery.menu.remix}}**（`R`） | 將種子以外的設定，載入左側面板 |
| **{{ui:gallery.menu.usePrompt}}**（`P`） | 只載入提示詞 |
| **{{ui:gallery.menu.useSeed}}**（`S`） | 只載入種子（種子會變成固定） |
| **{{ui:gallery.menu.useAll}}**（`A`） | 載入所有的設定 |
| **{{ui:gallery.menu.useSize}}** | 只載入寬度與高度 |
| **{{ui:gallery.menu.sendToCanvas}}** | 放到畫布上。可以選擇要成為新的畫布，或是加到目前畫布的圖層或遮罩 |
| **{{ui:gallery.menu.useAsReference}}** | 加到參考圖像的框中 |
| **{{ui:gallery.menu.sendToVideo}}** | 設為影片的第一張圖 |
| **{{ui:gallery.menu.sendToWorkflow}}** | 作為圖像的輸入，加到開啟中的工作流程 |
| **{{ui:gallery.menu.sendToText}}** | 設為文字的背景 |
| **{{ui:gallery.menu.upscale}}**（`Shift+U`） | 傳送到放大分頁 |
| **{{ui:gallery.menu.segment}}** | 選取圖像的一部分，進行去背或重畫 |
| **{{ui:gallery.derive.menu}}** | 以這張圖像的設定，製作不同種子或只稍微改變的圖像 |
| **{{ui:cutout.menu}}** | 移除背景 |
| **{{ui:facefix.menu}}** | 找出人臉並重畫 |
| **{{ui:gallery.menu.trim}}** | 去除透明的邊緣，另存為新的透明圖像 |
| **{{ui:character.menu}}** | 將圖像登錄為人物 |
| **{{ui:gallery.menu.changeBoard}}** | 移到其他看板 |
| **{{ui:gallery.menu.star}}** / **{{ui:gallery.menu.unstar}}** | 加上、取消星號 |
| **{{ui:gallery.menu.delete}}**（`Del`） | 刪除圖像 |

「{{ui:gallery.menu.sendToCanvas}}」，以及重新製作、修飾圖像的操作用法，會在[在畫布上補畫](05-canvas.md)、[修飾圖像](04-improve.md)、[放大與工作流程](06-upscaling-workflows.md)、[影片、音樂、語音、Logo、文字](07-media.md)中說明。

> 只有在電腦的瀏覽器中開啟時，才會出現「{{ui:gallery.menu.openInNewTab}}」。桌面版不會出現。

## 同時操作多張圖像

![選取 2 張後按右鍵時的選單](shot:gallery-multi-menu)

選取 2 張以上的圖像後，在選取的其中一張上按右鍵，就會出現可以一併使用的選單。最前面會顯示像「已選取 2 張」這樣的選取數量。

- **{{ui:gallery.menu.changeBoard}}**：將選取的圖像，一併移到其他看板。
- **{{ui:gallery.menu.starAll}}** / **{{ui:gallery.menu.unstarAll}}**
- **{{ui:common.download}}**：連續儲存選取的圖像。
- **{{ui:share.menu}}**：將選取的圖像一併匯出為分享用的副本（影片與音訊除外）。
- **{{ui:gallery.menu.batch}}**：對所有選取的圖像，套用相同的處理（去除背景、放大等）。每 1 張會分別進入佇列。
- 最下方的紅色項目：將選取的圖像一併刪除。

> 在沒有選取的圖像上按右鍵時，會出現那 1 張圖像的選單。想用在多張圖像時，請先選取，再在選取的圖像上按右鍵。

## 搜尋、篩選、排序

### 搜尋

按下放大鏡按鈕，就會開啟搜尋欄。輸入檔名或正向提示詞的一部分，該看板的圖像就會被篩選出來。按 `Esc` 可以關閉搜尋，解除篩選。

### 以日期篩選

![以日期篩選的選單。有今天、昨天等按鈕，以及當月的日曆](shot:gallery-date)

按下日曆按鈕，就會開啟以日期篩選的選單。

- **{{ui:gallery.date.quick.today}}**、**{{ui:gallery.date.quick.yesterday}}**、**{{ui:gallery.date.quick.last7}}**、**{{ui:gallery.date.quick.last30}}**：用 1 個按鈕決定期間。
- 當月日曆：有圖像的日子會加上標記。點擊日期，就只會排列那一天的圖像。用上方的箭頭可以切換月份。
- **{{ui:gallery.date.custom}}**：輸入開始日與結束日後按下 **{{ui:gallery.date.apply}}**，就只會排列該期間的圖像。只填其中一邊也可以使用。
- **{{ui:gallery.date.quick.all}}**：取消篩選。

篩選期間，圖庫上方會出現期間的標籤。用標籤上的 × 也可以解除。

### 圖庫的設定

用齒輪按鈕，可以改變排列方式與外觀。

- {{ui:gallery.settings.thumbnailSize}}
- {{ui:gallery.settings.autoSwitch}}：圖像完成時，自動顯示那張圖像。
- {{ui:gallery.settings.autoAssign}}
- {{ui:gallery.settings.alwaysShowSize}}
- {{ui:gallery.settings.showArchived}}
- {{ui:gallery.settings.starredFirst}}：將加上星號的圖像，排在最上面（一開始就是開啟的）。
- {{ui:gallery.settings.sort}}：「{{ui:gallery.settings.sortNewest}}」或「{{ui:gallery.settings.sortOldest}}」。
- {{ui:gallery.settings.groupByDate}}：加上每天的標題來區隔。

## 在檢視器中檢視

![檢視器。上方有工具列，中央是圖像，右下角有縮放按鈕，下方顯示圖像的資訊](shot:viewer)

中央的「{{ui:app.views.viewer}}」會放大顯示所選的圖像。
用畫面左右的箭頭，可以移到前後的圖像。最下面一列會顯示圖像的尺寸、使用的模型、種子與檔名。影片與語音可以直接播放。

### 縮放與移動

- 滑鼠滾輪：以游標的位置為中心，放大、縮小。
- 拖曳：放大後圖像超出畫面時，用來移動圖像。按住 `Space`，或按住滾輪按鈕，也可以移動。
- 連按兩下：在整體顯示與原始大小（100%）之間切換。
- 右下角的按鈕：縮小、倍率（按下會顯示常用倍率的清單）、放大、`1:1`（原始大小）、符合畫面。
- 按鍵：`+` 與 `-` 每次調整 1 段，`Ctrl+0` 符合畫面，`Ctrl+1` 為原始大小。

### 工具列

圖像上方的工具列，排列著對該圖像的操作。將游標移到按鈕上，會顯示名稱與快速鍵。

| 群組 | 按鈕 |
|---|---|
| 資訊 | **{{ui:gallery.viewer.toggleMetadata}}**（`I`） |
| 載入設定 | **{{ui:gallery.menu.remix}}**（`R`）、**{{ui:gallery.menu.usePrompt}}**（`P`）、**{{ui:gallery.menu.useSeed}}**（`S`）、**{{ui:gallery.menu.useAll}}**（`A`）、**{{ui:gallery.menu.loadWorkflow}}**（`W`）、**{{ui:gallery.derive.menu}}** |
| 傳送、修飾 | **{{ui:gallery.menu.sendToCanvas}}**、**{{ui:gallery.menu.useAsReference}}**、**{{ui:gallery.menu.upscale}}**（`Shift+U`）、**{{ui:gallery.menu.segment}}**、**{{ui:cutout.menu}}**、**{{ui:facefix.menu}}**、**{{ui:character.menu}}**、**{{ui:gallery.compare.toggle}}**（`C`） |
| 整理 | **{{ui:gallery.menu.star}}**、**{{ui:common.download}}**、**{{ui:share.menu}}**、**{{ui:gallery.menu.delete}}**（`Del`） |

作用與縮圖右鍵選單中同名的項目相同。沒有設定的圖像（上傳的圖像等），載入設定的按鈕會變成灰色。

## 圖像的資訊與設定的叫出

![中繼資料面板。排列著提示詞、模型、種子、步數等清單](shot:viewer-metadata)

按下工具列的 **{{ui:gallery.viewer.toggleMetadata}}** 按鈕（`I`），圖像上方會開啟資訊面板。再按一次，或按右上角的 ×，就會關閉。
面板中有 4 個分頁。

- **{{ui:gallery.meta.tabRecall}}**：製作圖像時的設定，會依項目排列（提示詞、模型、種子、步數、CFG 比例、排程器、尺寸、LoRA 等）。用各列右邊的箭頭按鈕，可以 **只把那個項目** 載入左側面板。
- **{{ui:gallery.meta.tabMetadata}}**：可以看到記錄內容的原始樣貌。用右上角的按鈕可以複製。
- **{{ui:gallery.meta.tabDetails}}**：檔名、尺寸、製作的日期時間、看板、有無星號等。
- **{{ui:gallery.meta.tabWorkflow}}**：如果是用工作流程製作的圖像，會顯示它的內容。

載入設定的方法，依想使用的範圍來選擇。

| 方法 | 載入的內容 |
|---|---|
| **{{ui:gallery.menu.useAll}}** | 提示詞、模型、種子、尺寸等，設定的全部。種子會變成固定 |
| **{{ui:gallery.menu.remix}}** | 種子以外的全部。目前的種子設定（隨機或固定）會維持不變。想要「用相同的設定，製作不同的圖像」時使用 |
| **{{ui:gallery.menu.usePrompt}}** | 只有提示詞（正向與反向） |
| **{{ui:gallery.menu.useSeed}}** | 只有種子。種子會變成固定 |
| **{{ui:gallery.menu.useSize}}** | 只有寬度與高度（僅限右鍵選單） |

載入之後，只要看一下左側面板，再按下 **{{ui:params.invoke.invoke}}** 即可。

> 以 novira 製作的圖像的圖像檔（PNG），會一併記錄設定。因此，即使是把檔案搬到其他位置後重新上傳的圖像，有時也能載入設定。用其他軟體製作的圖像，或經過加工後重新儲存的圖像，則沒有設定。

## 比較 2 張圖像

![用滑桿比較 2 張圖像的檢視器。左右移動中間的直線](shot:viewer-compare)

想看 2 張圖像的差異時，請使用比較。

1. 點擊選取要比較的第 1 張圖像，並將中央切換成「{{ui:app.views.viewer}}」分頁。
2. 按住 `Alt`，點擊第 2 張的縮圖（用右鍵選單的「{{ui:gallery.menu.compare}}」也可以）。
3. 第 2 張的縮圖會加上「{{ui:gallery.compare.badge}}」的標籤，檢視器會變成比較的畫面。

> 先按住 `Ctrl` 選取 2 張，再按工具列的比較按鈕或 `C` 鍵，也可以開始。只選了 1 張時，會出現「{{ui:gallery.compare.hint}}」的提示。

比較畫面的上方，會出現下列按鈕。

- **{{ui:gallery.compare.slider}}**：將 2 張重疊，拖曳中間的直線，就能看出左右兩邊有什麼不同。
- **{{ui:gallery.compare.sideBySide}}**：將 2 張左右並排。
- **{{ui:gallery.compare.hover}}**：只有在游標放在圖像上的期間，才會切換成第 2 張。
- **{{ui:gallery.compare.swap}}**：對調第 1 張與第 2 張。
- **{{ui:gallery.compare.exit}}**：結束比較。按 `Esc` 也可以結束。

縮放與移動，2 張會連動。細微部分的差異，放大來看會比較容易發現。

## 星號與刪除

### 加上星號

喜歡的圖像，可以加上星號。從縮圖的星號按鈕、右鍵選單、檢視器的工具列，任何一個都能加上或取消。
圖庫設定的「{{ui:gallery.settings.starredFirst}}」開啟時，加上星號的圖像會集中在最前面。

### 刪除

刪除圖像的方法如下。

- 縮圖的垃圾桶按鈕
- 右鍵選單的「{{ui:gallery.menu.delete}}」
- 檢視器工具列的垃圾桶按鈕
- 選取圖像後按 `Delete` 鍵（按 `Backspace` 也一樣）

會出現確認視窗，按下「{{ui:common.delete}}」就會刪除。

> 刪除的圖像無法復原。也沒有像垃圾桶那樣的存放處。

在確認視窗的「{{ui:common.dontAskAgain}}」打勾後，之後刪除就不會再確認。想恢復確認時，請開啟 **{{ui:app.nav.settings}}** 中的「{{ui:settings.confirmOnDelete}}」。

## 上傳與下載

### 上傳

可以把手邊的圖像放進圖庫。

- 按下圖庫上方的 **{{ui:gallery.upload}}** 按鈕，選擇檔案。
- 從檔案總管，將圖像檔拖曳到圖庫。放到看板上，就會放進該看板。

上傳的圖像，會放進「{{ui:gallery.boards.autoBadge}}」看板的 **{{ui:gallery.view.assets}}**，畫面也會切換到那裡。可以一次放入多個檔案。不是圖像的檔案會被忽略。

### 下載

要儲存圖像的檔案，請使用右鍵選單，或檢視器工具列的 **{{ui:common.download}}**。選取多張圖像時，會一併儲存。

### 匯出以分享

![匯出以分享視窗。排列著格式（PNG、JPEG、WebP）、畫質、長邊上限與移除生成資訊的開關](shot:share-export)

要製作貼到社群網站或交給別人的圖像副本，請使用右鍵選單（選取多張圖像時也能使用）或檢視器工具列的 **{{ui:share.menu}}**。原本的圖像不會改變。

- **{{ui:share.format}}**：從 PNG、JPEG、WebP 中選擇。JPEG 可以設定 **{{ui:share.quality}}**（1～100），透明部分會變成白色。WebP 以無損方式儲存。
- **{{ui:share.size}}**：選擇「{{ui:share.size.original}}」、2048、1536、1024 px，或用「{{ui:share.size.custom}}」輸入長度。比它小的圖像不會放大。
- **{{ui:share.removeInfo}}**：一開始是關閉的。開啟後，不包含提示詞、設定與工作流程，並依像素重新儲存圖像，因此也不會留下其他內嵌資訊。關閉時，只有 PNG 會保留設定。交給別人之前，若不想讓人看到提示詞，請開啟它。

按下 **{{ui:share.run}}** 後，桌面版會開啟選擇儲存資料夾的視窗。檔名是圖庫的檔名加上新的副檔名；已有同名檔案時，會加上「-2」「-3」這樣的編號，不會覆寫。匯出後，可以用 **{{ui:share.openFolder}}** 開啟該資料夾。

> 只能匯出圖像。選取項目中的影片與音訊會被排除。在瀏覽器中開啟時，會儲存到瀏覽器的下載位置。

## 拖放

縮圖可以拖曳到其他地方使用。選取多張時，選取的圖像會一起移動。

- **拖到看板上**：將那張圖像移到該看板。
- **拖到{{ui:params.refImage.sectionLabel}}的框**：設為參考圖像（請見[製作圖像](02-generate.md)）。
- **拖到畫布或放大的圖像欄、開始畫面的卡片**：作為該畫面的素材使用。

檔案總管中的檔案，可以放到圖庫、看板、參考圖像的框、開始畫面的卡片等處。

## 圖庫的快速鍵

| 操作 | 按鍵 |
|---|---|
| 選取前後、上下的圖像 | 方向鍵（用 `Shift` 擴大範圍） |
| 全選 | `Ctrl+A` |
| 解除選取 | `Esc` |
| 刪除選取的圖像 | `Delete` |
| 複製檢視器中的圖像 | `Ctrl+C` |
| 開合資訊面板 | `I` |
| 混搭、提示詞、種子、全部 | `R`、`P`、`S`、`A` |
| 載入工作流程 | `W` |
| 傳送到放大 | `Shift+U` |
| 開始、結束比較 | `C` |
| 整體顯示、原始大小 | `Ctrl+0`、`Ctrl+1` |
| 放大、縮小 | `+`、`-` |

這些按鍵在游標位於圖庫上方，或中央是檢視器時才會作用。清單也可以在 **{{ui:app.nav.settings}}** 選單的「{{ui:app.nav.hotkeys}}」中看到。
