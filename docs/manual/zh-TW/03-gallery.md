# 圖庫與檢視器

製作出的圖像，會排列在畫面右側的 **圖庫** 中。在圖庫中選取的圖像，可以在中央的 **{{ui:app.views.viewer}}** 放大檢視。
這一章說明圖像的整理方式、尋找方式、在檢視器中的檢視方式、設定的叫出方式，以及刪除與下載。

## 圖庫的看法

選擇右側面板上方的 **{{ui:app.right.gallery}}** 分頁，就會顯示圖庫（旁邊的 **{{ui:app.right.assistant}}** 分頁是 [AI 助理](09-assistant-settings.md#助理)）。圖庫由上下 2 個部分組成。

- 上方：**{{ui:gallery.boards.title}}**。類似用來收納圖像的資料夾。
- 下方：所選看板中圖像的縮圖。

縮圖上方的列有以下項目。

- 「{{ui:gallery.view.images}}」與「{{ui:gallery.view.assets}}」的切換，以及圖像的數量。
- 放大鏡按鈕：搜尋（{{ui:gallery.search.label}}）
- 日曆按鈕：{{ui:gallery.date.button}}
- 齒輪按鈕：{{ui:gallery.settings.title}}
- 向上箭頭按鈕：{{ui:gallery.upload}}

**{{ui:gallery.view.images}}** 中會放入用 novira 製作的圖像（也包含影片與語音）。
**{{ui:gallery.view.assets}}** 中會放入上傳的圖像，以及像 Logo 這樣被當作「與作品分開的素材」來處理的東西。如果找不到某張圖像，請看看另一邊。

縮圖的大小，可以用齒輪按鈕中的滑桿調整。
影片與語音的縮圖上有播放記號，將游標移上去再左右移動，就能確認該位置的場景。

## 看板

看板是用來將圖像分類整理的容器。「{{ui:gallery.boards.uncategorized}}」是一開始就有的看板，沒有放進看板的圖像會放在這裡。

- **建立**：按下看板欄右上方的 **＋**（{{ui:gallery.boards.add}}）。可以當場輸入名稱。
- **切換**：點選看板。下方就只會排列該看板的圖像。
- **更改名稱**：連按兩下看板名稱，或從右鍵選單選擇「{{ui:common.rename}}」。
- **尋找**：用看板欄的放大鏡，可以搜尋看板名稱。
- **收合**：點選「{{ui:gallery.boards.title}}」標題。拖曳看板欄的下緣，可以改變高度。

### 新圖像會放進哪個看板

新製作的圖像（上傳的圖像也一樣）會放進標有「**{{ui:gallery.boards.autoBadge}}**」記號的看板。
一開始每次點選看板，該看板就會成為「{{ui:gallery.boards.autoBadge}}」。想要固定時，請在圖庫的設定中關閉「{{ui:gallery.settings.autoAssign}}」，再用看板右鍵選單的「{{ui:gallery.boards.setAutoAdd}}」來決定。

### 看板的右鍵選單

- **{{ui:gallery.boards.setAutoAdd}}**：設為新圖像的儲存位置。
- **{{ui:common.rename}}**
- **{{ui:gallery.boards.archive}}**：將看板從清單中隱藏。它不是被刪除，只要開啟圖庫設定中的「{{ui:gallery.settings.showArchived}}」，就能再次看到。用「{{ui:gallery.boards.unarchive}}」可以恢復原狀。
- **{{ui:gallery.boards.delete}}**：會出現確認視窗，請從以下擇一。
  - 「{{ui:gallery.boards.deleteBoardOnly}}」：圖像會保留，並移到「{{ui:gallery.boards.uncategorized}}」。
  - 「{{ui:gallery.boards.deleteBoardAndImages}}」：連看板中的圖像也一併刪除。

> 「{{ui:gallery.boards.uncategorized}}」無法更改名稱、封存或刪除。

## 選取圖像

縮圖可以用以下方式選取。

| 操作 | 結果 |
|---|---|
| 點選 | 選取該 1 張。在檢視器中檢視的圖像也會換成那張 |
| 按住 `Ctrl` 點選 | 加入已選取的圖像，或從選取中移除（多重選取） |
| 按住 `Shift` 點選 | 從先前選取的圖像到點選的圖像之間，全部一起選取 |
| 按住 `Alt` 點選 | 與檢視器中的圖像比較（後述） |
| 連按兩下 | 將中央切換為檢視器，放大檢視該圖像 |
| `Ctrl+A` | 選取目前排列的所有圖像 |
| 方向鍵 | 將選取移到前後、上下的圖像。按住 `Shift` 可擴大範圍 |
| `Esc` | 取消選取 |

> 方向鍵等按鍵，在游標位於圖庫上方，或中央為檢視器時才會作用。

選取的圖像會加上藍色外框。將游標移到縮圖上，會顯示以下項目。

- 圖像的尺寸（在圖庫設定的「{{ui:gallery.settings.alwaysShowSize}}」中，也可以設為隨時顯示）
- 星號按鈕（加上、取消星號）
- 垃圾桶按鈕（刪除）

加上星號的圖像，左上角會有黃色的星號記號。

## 在縮圖上按右鍵

![縮圖的右鍵選單。並排著在檢視器中開啟、下載、再混合、傳送到畫布等](shot:gallery-menu)

在縮圖上按右鍵，會以清單顯示可用於該圖像的操作。無法使用的操作會變成灰色（例如沒有設定記錄的圖像，無法使用「{{ui:gallery.menu.remix}}」）。

| 選單 | 作用 |
|---|---|
| **{{ui:gallery.menu.openInViewer}}** | 在中央的檢視器中放大檢視 |
| **{{ui:common.download}}** | 儲存圖像的檔案 |
| **{{ui:share.menu}}** | 選擇格式與尺寸，匯出副本（也可以移除生成資訊） |
| **{{ui:share.check.title}}** | 檢查圖像中含有的浮水印、AI 生成標示與內容憑證資訊 |
| **{{ui:common.copy}}**（`Ctrl+C`） | 將圖像複製到剪貼簿 |
| **{{ui:gallery.menu.compare}}**（`Alt+點選`） | 與檢視器中顯示的圖像比較 |
| **{{ui:gallery.menu.loadWorkflow}}**（`W`） | 開啟製作該圖像的工作流程 |
| **{{ui:gallery.menu.remix}}**（`R`） | 將種子以外的設定讀入左側面板 |
| **{{ui:gallery.menu.usePrompt}}**（`P`） | 只讀入提示詞 |
| **{{ui:gallery.menu.useSeed}}**（`S`） | 只讀入種子（種子會被固定） |
| **{{ui:gallery.menu.useAll}}**（`A`） | 讀入所有設定 |
| **{{ui:gallery.menu.useSize}}** | 只讀入寬度與高度 |
| **{{ui:gallery.menu.sendToCanvas}}** | 放到畫布上。可以選擇建立新的畫布，或是加到目前畫布中作為圖層或遮罩 |
| **{{ui:gallery.menu.useAsReference}}** | 加到參考圖像的方框 |
| **{{ui:gallery.menu.sendToVideo}}** | 作為影片的第一張圖像 |
| **{{ui:gallery.menu.sendToWorkflow}}** | 作為圖像輸入，加到已開啟的工作流程 |
| **{{ui:gallery.menu.sendToText}}** | 作為文字的背景 |
| **{{ui:gallery.menu.upscale}}**（`Shift+U`） | 傳送到放大分頁 |
| **{{ui:gallery.menu.segment}}** | 在畫布中開啟圖像，用筆刷塗抹想修改的部分，進行消除、去背或重畫 |
| **{{ui:gallery.derive.menu}}** | 以這張圖像的設定，製作不同種子或稍微改變的圖像 |
| **{{ui:gallery.tools.heading}}** | {{ui:facefix.menu}}、{{ui:cutout.menu}}、{{ui:caption.menu}}、{{ui:canvas.poseFromImage.menu}}。選擇後會以上次的設定立即執行，按右側的齒輪則會先開啟設定（[修飾與沿用圖像](04-improve.md)） |
| **{{ui:gallery.menu.trim}}** | 去除透明的邊緣，另存為新的透明圖像 |
| **{{ui:character.menu}}** | 將圖像登錄為角色 |
| **{{ui:gallery.menu.changeBoard}}** | 移到其他看板 |
| **{{ui:gallery.menu.star}}** / **{{ui:gallery.menu.unstar}}** | 加上、取消星號 |
| **{{ui:gallery.menu.delete}}**（`Del`） | 刪除圖像 |

「{{ui:gallery.menu.sendToCanvas}}」，以及重新製作、修飾圖像的操作方法，會在[在畫布上補畫](05-canvas.md)、[修飾與沿用圖像](04-improve.md)、[放大與工作流程](06-upscaling-workflows.md)、[影片、音樂、語音、Logo、文字](07-media.md)中說明。

> 只有在電腦的瀏覽器中開啟時，才會出現「{{ui:gallery.menu.openInNewTab}}」。桌面版不會出現。

## 一次操作多張圖像

![選取 2 張後按右鍵的選單](shot:gallery-multi-menu)

選取 2 張以上的圖像後，在其中一張按右鍵，會出現可批次使用的選單。最前面會顯示「已選取 2 張」這樣的選取數量。

- **{{ui:gallery.menu.changeBoard}}**：將所選的圖像一起移到其他看板。
- **{{ui:gallery.menu.starAll}}** / **{{ui:gallery.menu.unstarAll}}**
- **{{ui:common.download}}**：連續儲存所選的圖像。
- **{{ui:share.menu}}**：將所選的圖像一起匯出為分享用的副本（影片與語音除外）。
- **{{ui:gallery.menu.batch}}**：對所有選取的圖像套用相同的處理（移除背景、放大等）。每張會各別進入佇列。
- 最下方的紅色項目：一起刪除所選的圖像。

> 在未選取的圖像上按右鍵時，會出現那 1 張圖像的選單。想用在多張圖像時，請先選取，再在所選的圖像上按右鍵。

## 尋找、篩選、排序

### 搜尋

按下放大鏡按鈕，就會開啟搜尋欄。輸入檔名或正向提示詞的一部分，該看板的圖像就會被縮小範圍。按 `Esc` 可以關閉搜尋並解除篩選。

### 依日期篩選

![依日期篩選的選單。有今天、昨天等按鈕，以及月曆](shot:gallery-date)

按下日曆按鈕，會開啟依日期篩選的選單。

- **{{ui:gallery.date.quick.today}}**・**{{ui:gallery.date.quick.yesterday}}**・**{{ui:gallery.date.quick.last7}}**・**{{ui:gallery.date.quick.last30}}**：用 1 個按鈕決定期間。
- 月曆：有圖像的日子會有記號。點選日期，就只會排列那一天的圖像。用上方的箭頭可以切換月份。
- **{{ui:gallery.date.custom}}**：填入開始日與結束日後按下 **{{ui:gallery.date.apply}}**，就只會排列該期間的圖像。只填其中一邊也可以使用。
- **{{ui:gallery.date.quick.all}}**：取消篩選。

篩選期間，圖庫上方會出現期間的標籤。按標籤的 × 也能取消。

### 圖庫的設定

用齒輪按鈕，可以更改排列方式與外觀。

- {{ui:gallery.settings.thumbnailSize}}
- {{ui:gallery.settings.autoSwitch}}：圖像完成時，自動顯示那張圖像。
- {{ui:gallery.settings.autoAssign}}
- {{ui:gallery.settings.alwaysShowSize}}
- {{ui:gallery.settings.showArchived}}
- {{ui:gallery.settings.starredFirst}}：將加上星號的圖像排在最上面（一開始就是開啟的）。
- {{ui:gallery.settings.sort}}：「{{ui:gallery.settings.sortNewest}}」或「{{ui:gallery.settings.sortOldest}}」。
- {{ui:gallery.settings.groupByDate}}：加上每天的標題來分段。

## 在檢視器中檢視

![檢視器。上方有工具列，中央是圖像，右下是放大縮小按鈕，下方顯示圖像資訊](shot:viewer)

中央的「{{ui:app.views.viewer}}」會放大顯示所選的圖像。
用畫面左右的箭頭，可以移到前後的圖像。最下方的列會顯示圖像的尺寸、使用的模型、種子與檔名。影片與語音可以直接播放。

### 放大與移動

- 滑鼠滾輪：以游標的位置為中心放大、縮小。
- 拖曳：放大後圖像超出畫面時，用來移動圖像。按住 `Space`，或按住滾輪按鈕也可以移動。
- 連按兩下：在整體顯示與原始大小（100%）之間切換。
- 右下的按鈕：縮小、倍率（按下會顯示常用倍率的清單）、放大、`1:1`（原始大小）、符合畫面。
- 按鍵：`+` 與 `-` 每次調整 1 級，`Ctrl+0` 符合畫面，`Ctrl+1` 為原始大小。

### 工具列

圖像上方的工具列，並排著對該圖像的操作。將游標移到按鈕上，會顯示名稱與快速鍵。

| 群組 | 按鈕 |
|---|---|
| 資訊 | **{{ui:gallery.viewer.toggleMetadata}}**（`I`） |
| 讀入設定 | **{{ui:gallery.menu.remix}}**（`R`）、**{{ui:gallery.menu.usePrompt}}**（`P`）、**{{ui:gallery.menu.useSeed}}**（`S`）、**{{ui:gallery.menu.useAll}}**（`A`）、**{{ui:gallery.menu.loadWorkflow}}**（`W`）、**{{ui:gallery.derive.menu}}** |
| 傳送、修飾 | **{{ui:gallery.menu.sendToCanvas}}**、**{{ui:gallery.menu.useAsReference}}**、**{{ui:gallery.menu.upscale}}**（`Shift+U`）、**{{ui:gallery.menu.segment}}**、**{{ui:cutout.menu}}**、**{{ui:facefix.menu}}**、**{{ui:gallery.manga.menu}}**、**{{ui:character.menu}}**、**{{ui:gallery.compare.toggle}}**（`C`） |
| 整理 | **{{ui:gallery.menu.star}}**、**{{ui:common.download}}**、**{{ui:share.menu}}**、**{{ui:gallery.menu.delete}}**（`Del`） |

作用與縮圖右鍵選單中同名的項目相同。沒有設定的圖像（上傳的圖像等），讀入設定的按鈕會變成灰色。

## 圖像的資訊與設定的叫出

![中繼資料的面板。提示詞、模型、種子、步數等的清單](shot:viewer-metadata)

按下工具列的 **{{ui:gallery.viewer.toggleMetadata}}** 按鈕（`I`），圖像上方會開啟資訊面板。再按一次、按右上的 ×，或按面板之外的地方，就會關閉。面板中的文字，可以用拖曳選取後按 `Ctrl+C` 複製（選取文字時的 `Ctrl+C` 複製的是文字，而不是圖像）。
面板有 4 個分頁。

- **{{ui:gallery.meta.tabRecall}}**：製作圖像時的設定，會逐項排列（提示詞、模型、種子、步數、CFG 比例、排程器、尺寸、LoRA 等）。用各列右側的箭頭按鈕，可以**只把那一項**讀入左側面板。提示詞的列，可以用箭頭左邊的按鈕直接複製提示詞。對於排程器已決定的系列模型（Anima、Flux 等）的圖像，會顯示「{{ui:gallery.meta.sampling}}」列來取代排程器，可以得知實際使用的取樣器與排程器。這一列無法讀入，用「{{ui:gallery.menu.useAll}}」時排程器也會維持現狀。
- **{{ui:gallery.meta.tabMetadata}}**：可以用原樣查看所記錄的內容。可用右上的按鈕複製。
- **{{ui:gallery.meta.tabDetails}}**：檔名、尺寸、製作日期時間、看板、有無星號等。
- **{{ui:gallery.meta.tabWorkflow}}**：如果是以工作流程製作的圖像，會顯示其內容。

讀入設定的方式，依想使用的範圍來選擇。

| 方式 | 讀入的內容 |
|---|---|
| **{{ui:gallery.menu.useAll}}** | 提示詞、模型、種子、尺寸等設定的全部。種子會被固定。用其他軟體製作後匯入的圖像，會依名稱尋找模型（`v17` 與 `v170` 這種寫法的差異，視為相同模型）。找不到時，會維持目前的模型，並以通知告知 |
| **{{ui:gallery.menu.remix}}** | 種子以外的全部。目前的種子設定（隨機或固定）會維持原樣。想「用相同設定製作另一張圖像」時使用 |
| **{{ui:gallery.menu.usePrompt}}** | 只有提示詞（正向與反向） |
| **{{ui:gallery.menu.useSeed}}** | 只有種子。種子會被固定 |
| **{{ui:gallery.menu.useSize}}** | 只有寬度與高度（僅限右鍵選單） |

讀入之後，查看左側面板，按下 **{{ui:params.invoke.invoke}}** 即可。

> 用 novira 製作的圖像檔案（PNG）中，也一併記錄了設定。因此，即使把檔案搬到其他位置後重新上傳的圖像，有時也能讀入設定。用其他軟體製作的圖像，或經過加工後重新儲存的圖像，不包含設定。

## 比較 2 張圖像

![用滑桿比較 2 張圖像的檢視器。左右移動中間的垂直線](shot:viewer-compare)

想看 2 張圖像的差異時，請使用比較功能。

1. 點選要比較的第 1 張圖像來選取，並將中央設為「{{ui:app.views.viewer}}」分頁。
2. 按住 `Alt`，點選第 2 張的縮圖（也可以用右鍵選單的「{{ui:gallery.menu.compare}}」）。
3. 第 2 張的縮圖會出現「{{ui:gallery.compare.badge}}」的標籤，檢視器會變成比較畫面。

> 也可以先按住 `Ctrl` 選取 2 張，再按工具列的比較按鈕或 `C` 鍵來開始。只選了 1 張時，會顯示「{{ui:gallery.compare.hint}}」的說明。

比較畫面的上方會出現以下按鈕。

- **{{ui:gallery.compare.slider}}**：將 2 張圖像重疊，拖曳中間的垂直線，就能看出左右的差異。
- **{{ui:gallery.compare.sideBySide}}**：將 2 張圖像左右並排。
- **{{ui:gallery.compare.hover}}**：只有在游標放在圖像上的期間，才會切換成第 2 張。
- **{{ui:gallery.compare.swap}}**：對調第 1 張與第 2 張。
- **{{ui:gallery.compare.exit}}**：結束比較。也可以用 `Esc` 結束。

放大與移動時，2 張圖像會連動。細微部分的差異，放大後會比較容易看出來。

## 星號與刪除

### 加上星號

喜歡的圖像可以加上星號。從縮圖的星號按鈕、右鍵選單、檢視器的工具列，任何一個都可以加上或取消。
如果開啟了圖庫設定的「{{ui:gallery.settings.starredFirst}}」，加上星號的圖像就會聚集在最前面。

### 刪除

刪除圖像的方法如下。

- 縮圖的垃圾桶按鈕
- 右鍵選單的「{{ui:gallery.menu.delete}}」
- 檢視器工具列的垃圾桶按鈕
- 選取圖像後按 `Delete` 鍵（按 `Backspace` 也相同）

會出現確認視窗，按下「{{ui:common.delete}}」就會刪除。

刪除的圖像不會立刻消失，會保留 14 天（最多 500 張），所以可以取消刪除。

- 按下畫面右下角的鈴鐺，再按下刪除通知中的 **{{ui:gallery.undoDelete.action}}**。為了不妨礙連續刪除的作業，刪除的通知不會跳出在畫面上，只會收進鈴鐺裡（鈴鐺的數字會增加）。
- 按下圖庫上方的「{{ui:gallery.undoDelete.label}}」按鈕，或在指標放在圖庫上方的期間（或開啟檢視器的期間）按 `Ctrl+Z`。最近 30 次的刪除，可以從新的開始依序取消。
- 想再次刪除已復原的圖像時，使用「{{ui:gallery.redoDelete.label}}」按鈕或 `Ctrl+Shift+Z`（`Ctrl+Y`）。

> 可以取消的記錄，在關閉應用程式後就會忘記。刪除後超過 14 天的圖像，無法復原。連同看板一起刪除圖像時，也同樣可以取消。看板已經不存在時，圖像會回到「{{ui:gallery.boards.uncategorized}}」。

在確認視窗中勾選「{{ui:common.dontAskAgain}}」，之後就會不經確認直接刪除。想恢復確認時，請開啟 **{{ui:app.nav.settings}}** 的「{{ui:settings.confirmOnDelete}}」。

## 上傳與下載

### 上傳

可以將手邊的圖像放進圖庫。

- 按下圖庫上方的 **{{ui:gallery.upload}}** 按鈕，選擇檔案。
- 從檔案總管將圖像檔案拖放到圖庫。拖放到看板上時，會放進該看板。

上傳的圖像會放進標有「{{ui:gallery.boards.autoBadge}}」的看板的 **{{ui:gallery.view.assets}}**，畫面也會切換到那裡。可以一次放入多個檔案。不是圖像的檔案會被忽略。

### 下載

要儲存圖像的檔案，請使用右鍵選單，或檢視器工具列的 **{{ui:common.download}}**。選取了多張圖像時，會一起儲存。

桌面版會開啟選擇儲存位置資料夾的視窗，原始檔案會直接（包含生成資訊）複製過去。有相同名稱的檔案時，會加上「-2」這樣的編號，不會覆蓋。儲存後的通知中，可以用 **{{ui:share.openFolder}}** 開啟該資料夾。在瀏覽器中開啟時，會儲存到瀏覽器的下載項目。

### 匯出供分享使用

![匯出供分享使用的視窗。並排著格式（PNG、JPEG、WebP）、畫質、長邊上限、移除生成資訊的開關](shot:share-export)

要製作張貼到社群網站或交給別人的圖像副本，請從右鍵選單（選取多張圖像時也能使用），或檢視器工具列的 **{{ui:share.menu}}** 製作。原始圖像不會改變。

- **{{ui:share.format}}**：從 PNG、JPEG、WebP 中選擇。JPEG 可以決定 **{{ui:share.quality}}**（1 到 100），透明的部分會變成白色。WebP 以無損方式儲存。
- **{{ui:share.size}}**：「{{ui:share.size.original}}」、2048、1536、1024 px，或是以「{{ui:share.size.custom}}」填入長度。比該尺寸小的圖像不會放大。
- **{{ui:share.removeInfo}}**：一開始是關閉的。開啟後，不會包含提示詞、設定與工作流程，並會從像素重新儲存圖像，所以其他內嵌的資訊也不會留下。關閉時，只有 PNG 會保留設定。交給別人之前，如果不想讓人看到提示詞，請開啟。
- **{{ui:share.watermark}}**：一開始是關閉的。開啟後，會在匯出的圖像中放入肉眼看不見的浮水印（TrustMark）、表示是用 AI 製作的圖像的資訊（IPTC），以及帶有簽章的內容憑證資訊（C2PA）。浮水印中含有 novira 的標記與每張圖像各不相同的隨機編號，編號與原始圖像的配對會記錄在這個應用程式中。

按下 **{{ui:share.run}}** 後，桌面版會開啟選擇儲存位置資料夾的視窗。檔名是在圖庫的檔名加上新的副檔名，有相同名稱的檔案時，會加上「-2」「-3」這樣的編號，不會覆蓋。匯出後可以用 **{{ui:share.openFolder}}** 開啟該資料夾。

> 能匯出的只有圖像。所選項目中的影片與語音會被排除。在瀏覽器中開啟時，會儲存到瀏覽器的下載項目。1 張時直接儲存，2 張以上則會合併成 1 個 zip。一次能匯出的總量最多為 1 GB，超過時會顯示請減少張數的訊息。

浮水印所使用的檔案（合計約 140 MB），會在應用程式啟動時自動下載。在準備完成之前，開關下方會顯示進度，且無法按下 **{{ui:share.run}}**。下載失敗時，請按下 **{{ui:share.watermarkRetry}}**。

> 浮水印會放在圖像中央的正方形部分。已確認即使用畫質 80 的 JPEG 重新儲存，或縮小為一半的尺寸，仍然可以讀取，但裁切、重新製作或強力加工可能會使它消失。浮水印是公開的方式，所以任何人都可以寫入相同的內容。簽章是在這台電腦上製作的，因此在其他應用程式中，會顯示為不受信任的簽署者。浮水印的處理需要 Microsoft Visual C++ 可轉散發套件，沒有的話會顯示錯誤。

### 檢查浮水印

從縮圖右鍵選單的 **{{ui:share.check.title}}** 開啟。用 **{{ui:share.check.pick}}** 選擇圖像的檔案（PNG、JPEG、WebP）後，會檢查以下事項並以清單顯示。從右鍵選單開啟時，會立刻檢查該圖像。在瀏覽器中開啟時，無法選擇檔案來檢查。

- **{{ui:share.check.watermark}}**：有沒有 novira 的浮水印。有的話會顯示編號。
- **{{ui:share.check.original}}**：如果編號存在於這個應用程式的匯出記錄中，會顯示原始圖像與匯出的日期時間，並可以用 **{{ui:share.check.showOriginal}}** 顯示在檢視器中。
- **{{ui:share.check.credentials}}**：有沒有內容憑證資訊、簽章之後有沒有被更改、是否記錄為 AI 生成、簽署者是誰。
- **{{ui:share.check.iptc}}**：有沒有表示是用 AI 製作的圖像的資訊。

> 即使找不到浮水印，也不能證明不是用 AI 製作的。匯出記錄存在於這個應用程式的資料庫中，所以無法得知在其他電腦的 novira 匯出的圖像的原始圖像。浮水印所使用的檔案尚未準備完成時，只會檢查浮水印以外的項目。

## 拖放

縮圖可以拖曳到其他地方使用。選取了多張時，所選的圖像會一起移動。

- **拖到看板上**：將該圖像移到該看板。
- **拖到{{ui:params.refImage.sectionLabel}}的方框**：作為參考圖像（請見[製作圖像](02-generate.md)）。
- **拖到畫布或放大的圖像欄、開始畫面的卡片**：作為該畫面的素材使用。

檔案總管中的檔案，可以拖放到圖庫、看板、參考圖像的方框、開始畫面的卡片等。

## 圖庫的快速鍵

| 操作 | 按鍵 |
|---|---|
| 選取前後、上下的圖像 | 方向鍵（`Shift` 可擴大範圍） |
| 全選 | `Ctrl+A` |
| 取消選取 | `Esc` |
| 刪除所選的圖像 | `Delete` |
| 複製檢視器中的圖像，或圖庫中選取的圖像（在畫布畫面中，點選過圖庫的圖像之後也有效） | `Ctrl+C` |
| 開合資訊面板 | `I` |
| 再混合、提示詞、種子、全部 | `R`、`P`、`S`、`A` |
| 讀入工作流程 | `W` |
| 傳送到放大 | `Shift+U` |
| 開始、結束比較 | `C` |
| 整體顯示、原始大小 | `Ctrl+0`、`Ctrl+1` |
| 放大、縮小 | `+`、`-` |

這些在游標位於圖庫上方，或中央為檢視器時才會作用。清單也可以在 **{{ui:app.nav.settings}}** 選單的「{{ui:app.nav.hotkeys}}」中查看。
