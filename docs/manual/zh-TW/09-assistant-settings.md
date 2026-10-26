# AI 助理、設定、快速鍵

這一章說明只要用文字告訴它，就會幫你整理設定的 AI 助理、設定畫面、快速鍵的清單、應用程式的資訊畫面，以及開發者記錄。

設定畫面、快速鍵、應用程式的資訊，都是從畫面左下方的 **{{ui:app.nav.settingsMenu}}** 開啟。

## AI 助理

![AI 助理的視窗。選擇要使用的 AI 並登入的最初畫面](shot:agent)

按下左側導覽列的 **AI** 按鈕（**{{ui:agent.open}}**），就會開啟 **{{ui:agent.title}}** 的視窗。視窗可以拖曳標題來移動。

不用自己選擇模型或 LoRA、設定提示詞或尺寸，只要用文字告訴它想製作的東西，例如「站在夕陽海邊的動漫風格少女」，助理就會選擇設定並放入。

### 開始使用（登入）

AI 助理並不是由 novira 自己執行 AI，而是呼叫你電腦中的 AI 指令（Claude 或 Codex）來產生回答。要使用的話，需要做下列準備。

1. 在電腦上先安裝 Anthropic 的 **Claude** 或 OpenAI 的 **Codex** 其中一個指令。
2. 開啟助理，按下想使用的那一個（**{{ui:agent.setup.claude}}** 或 **{{ui:agent.setup.codex}}**）。
3. 瀏覽器會開啟，請在那裡登入。

在電腦上找不到該指令時，會出現「在這台電腦上找不到 ○○ 的指令。請先安裝。」的提示。請先安裝該指令。

使用的服務與合約，是你所選擇的那一方的。novira 不會儲存 API 金鑰。往來的內容（傳送的文字、目前的模型清單與設定等），會傳送到你所選擇的服務。

所選的 AI，會顯示在視窗上方的標題。想更換時，請按下上方的 **{{ui:agent.changeProvider}}** 按鈕。

### 它會做什麼

助理會從你的文字中決定下列事項，並放入設定。放入的內容，會以清單顯示在回覆中。

| 內容 | 範例 |
|---|---|
| 選擇模型 | 從已安裝的模型中，選出合適的 |
| 加入 LoRA | 加入符合畫風的 LoRA |
| 提示詞 | 寫下提示詞與反向提示詞 |
| 變更設定 | 尺寸、步數、CFG、排程器、種子 |
| 工作流程 | 建立圖形、修改開啟中的圖形 |
| 文字 | 修改在 **{{ui:media.tab.text}}** 中開啟的文字與對話框 |
| 影片、音樂、語音 | 變更各自畫面中的設定 |
| 漫畫 | 在 **{{ui:app.tabs.comic}}** 中，變更分格、新增與切割分格，以及各分格的提示詞、姿勢與對話框（見下面的「請助理幫忙畫漫畫」） |
| 姿勢 | 在 **{{ui:app.tabs.canvas}}** 中，依文字要求放置火柴人的姿勢（請見 [在畫布上製作姿勢](05-canvas.md#在畫布上製作姿勢)） |
| 推薦擴充功能 | 介紹符合想做的事的擴充功能，並可從按鈕安裝 |
| 應用程式的用法 | 用畫面上的名稱回答該按哪裡 |
| 說明擴充功能 | 說明擴充功能能做什麼、怎麼用（見下面的「詢問用法與擴充功能」） |

助理看得到你正開啟哪個畫面。例如開啟 **{{ui:media.tab.text}}** 並告訴它「把文字改成直書」，那段文字就會改變。

助理只會變更設定。它不會製作圖像。看過結果覺得不錯時，按下回覆中的 **{{ui:agent.generate}}**，就會直接開始製作。

### 請助理幫忙畫漫畫

在開啟 **{{ui:app.tabs.comic}}** 的狀態下提出請求，助理會讀取目前開啟的頁面（分格的形狀、各分格的提示詞、姿勢、對話框），並直接改寫。例如，可以這樣請求。

- 請求「做成有高潮的 5 格。第 1 格大一點，斜著切」，它會製作分格。它可能使用標準範本，也可能自己決定分格的形狀。
- 請求「依這個故事寫出各分格的提示詞」，它會為每個分格寫出提示詞，並加入符合故事發展的構圖（特寫、遠景、仰角等）。
- 請求「在各分格加上台詞」，它會放置對話框並填入台詞。
- 請求「把第 2 格的女孩改成奔跑的姿勢」，它會為該分格設定姿勢。

它不會畫出圖像本身。填好提示詞後，請按下 **{{ui:comic.panel.draw}}** 或 **{{ui:comic.page.drawAll}}**。按下 **{{ui:agent.undo}}**，該回覆所變更的漫畫頁面會一起恢復原狀。

### 選擇模型與思考深度

按下聊天名稱右側腦形狀的小按鈕，可以選擇助理使用的 **{{ui:agent.model.label}}** 與 **{{ui:agent.effort.label}}**。選擇的內容會從下一則傳送的訊息開始使用。Claude 與 Codex 會分別記住各自的選擇。

- Claude 的模型可以從 **{{ui:agent.model.default}}**、Fable、Opus、Sonnet、Haiku 中選擇。按下 **{{ui:agent.model.custom}}**，可以直接輸入模型名稱。思考深度從 **{{ui:agent.effort.low}}** 到 **{{ui:agent.effort.max}}** 共 5 級。
- Codex 的模型無法選擇（依照該指令本身的設定）。思考深度為 **{{ui:agent.effort.low}}**、**{{ui:agent.effort.medium}}**、**{{ui:agent.effort.high}}**。

選擇 **{{ui:agent.model.default}}** 時，會依照該指令本身的設定。

### 呼叫範本

在輸入欄開頭輸入「/」，會開啟常用請求的範本清單。在「/」後繼續輸入文字，清單只會留下名稱、指令或文字中含有這些文字的範本（例如「/漫畫」或「/comic」）。

用上下方向鍵選擇，按 Enter 或 Tab 確定。按下清單中的列也可以確定。確定的範本文字會填入輸入欄，請補寫後續內容再傳送（只確定不會傳送）。按 Esc 鍵關閉清單。

### 詢問用法與擴充功能

除了請它設定，你也可以向它提問。例如「要怎麼去除背景？」「在哪裡新增模型？」它會用畫面上顯示的名稱，告訴你該按哪裡。回答會使用你目前使用的語言。

也可以詢問擴充功能。它會用淺顯的話說明擴充功能能做什麼、什麼時候用、怎麼用。提問的方式有三種：

- 在 **{{ui:app.nav.extensions}}** 的清單中按下卡片開啟詳細資料，再按 **{{ui:agent.ask.button}}**。關於該擴充功能的提問會在新的聊天中傳送。
- 在 **{{ui:app.nav.extensions}}** 上方的搜尋欄輸入文字，按下出現的 **{{ui:agent.ask.resultsButton}}**。它會說明搜尋到的擴充功能（最多前 8 個）有什麼差異，以及先試哪一個。
- 在聊天中寫出擴充功能的名稱（英文字母）並提問。它會在已公開的擴充功能中尋找名稱或說明相符的項目（如果清單尚未載入，會先載入）。

對於已安裝的擴充功能，它還會說出擴充功能新增的節點名稱，以及該連接到什麼。對於尚未安裝的擴充功能，回覆中會附上卡片，可以直接用 **{{ui:workflows.packs.install}}** 安裝。

> 說明依據的是擴充功能公開的介紹文字與節點資訊。不知道的事它應當回答「不知道」，但也可能出錯。安裝前請再確認一下擴充功能的發布頁面。

### 復原

放入設定的回覆，會附上 **{{ui:agent.undo}}** 按鈕。按下後，會回到那則回覆之前的設定。

不過，重新開啟應用程式之後，就無法復原在那之前的變更（按鈕會變成無法按下）。

### 聊天的記錄

與助理的往來，會以「聊天」的形式保留下來。按下視窗上方聊天名稱的部分，就會開啟 **{{ui:agent.session.history}}** 的清單。

- 從清單中選擇，就可以從那個聊天的後續繼續對話。
- 用 **{{ui:agent.session.rename}}** 可以命名。
- 用 **{{ui:agent.session.delete}}** 可以刪除。
- 旁邊的 **{{ui:agent.session.new}}**，可以開始新的聊天。

> 等待回覆期間，無法連續傳送。請等到「{{ui:agent.thinking}}」的顯示消失為止，或用取代傳送按鈕出現的 **{{ui:agent.stop}}** 按鈕取消。已取消的請求不會改變任何設定。

拖曳視窗四邊與四角的任何位置，都可以改變視窗大小。右下角會顯示相應的標記。大小會被記住。當回覆附帶判斷的過程時，會在回覆上方以一行顯示。按下它即可展開全部（**{{ui:agent.thoughts.label}}**）。這是 AI 對「怎麼理解請求、為什麼這樣選擇」的簡短總結，並不是它內部思考的原樣紀錄。

## 設定

![設定的畫面。排列著一般、帳號、生成、UI、開發人員的各個項目](shot:settings)

從左下方的 **{{ui:app.nav.settingsMenu}}** 選擇 **{{ui:app.nav.settings}}**，就會開啟設定的畫面。變更的內容會立即生效，關閉應用程式後也會保留。

> 這張圖像是在瀏覽器中執行的範例畫面。沒有拍到只有桌面版才有的 **{{ui:settings.uiZoom.label}}**。

### {{ui:settings.section.general}}

| 項目 | 內容 |
|---|---|
| {{ui:settings.language.label}} | 從{{ui:settings.language.ja}}、{{ui:settings.language.en}}、{{ui:settings.language.zhcn}}、{{ui:settings.language.zhtw}}、{{ui:settings.language.ko}}、{{ui:settings.language.ru}}、{{ui:settings.language.es}}、{{ui:settings.language.ptbr}}、{{ui:settings.language.fr}}、{{ui:settings.language.de}} 中選擇。畫面的文字會立即切換 |
| {{ui:settings.theme.label}} | **{{ui:settings.theme.dark}}**（預設）或 **{{ui:settings.theme.light}}** |

### {{ui:settings.section.accounts}}

這是為了模型的發布網站需要登入時而準備的欄位。輸入的內容會加密後儲存在這台電腦，不會顯示在畫面上。

| 項目 | 內容 |
|---|---|
| {{ui:settings.civitaiKey.label}} | 用於下載需要登入的模型 |
| {{ui:settings.hfToken.label}} | 用於下載需要申請存取的模型 |

貼上後按下 **{{ui:settings.civitaiKey.save}}**。之後也能使用 **{{ui:settings.civitaiKey.change}}** 或 **{{ui:settings.civitaiKey.remove}}**。

### {{ui:settings.section.generation}}

- **{{ui:settings.antialiasProgressImages}}**：將生成途中的圖像，在圖庫「{{ui:gallery.generating.title}}」的框中平滑地顯示。關閉的話，會維持粗糙的點狀來顯示。
- **{{ui:settings.lowMemory.label}}**：適用於 GPU 記憶體較少的電腦。開啟後，模型不會一直留在 GPU 記憶體中，因此用較少的記憶體就能製作，但速度會變慢。切換時會重新啟動引擎。有正在製作的項目時，會在下次啟動引擎時生效。連線到在別處啟動的引擎時無法使用。

### {{ui:settings.section.ui}}

- **{{ui:settings.uiZoom.label}}**（僅限桌面版）：整個畫面的大小。可以選擇 50% 到 300%。用 `Ctrl` 加 `+` / `-` 也可以更改。
- **{{ui:settings.confirmOnDelete}}**：刪除圖像前，會出現確認。在確認畫面選擇「{{ui:common.dontAskAgain}}」時，這裡也會變成關閉。

### {{ui:share.backup.section}}

![設定畫面的備份欄。建立備份的按鈕與從備份還原的按鈕](shot:settings-backup)

可以將製作的圖像，以及在應用程式中設定、登錄的內容，打包儲存成一個 zip 檔。用於搬到另一台電腦，或以防萬一。

- **{{ui:share.backup.createLabel}}**：會開啟選擇儲存位置的視窗。檔名一開始就是「novira-backup-日期-時間.zip」。圖像較多時需要一些時間，進度會顯示在這一欄。
- **{{ui:share.backup.restoreLabel}}**：選擇備份的 zip 檔。檢查內容後，會出現確認視窗。

備份中包含與不包含的內容如下。

| 包含 | 不包含 |
|---|---|
| 圖庫的圖像、影片、音訊及其縮圖 | 模型 |
| 看板、工作流程、漫畫、佇列的紀錄 | 圖像引擎（ComfyUI）與擴充功能 |
| 角色、預設、提示詞清單、草稿、AI 助理的聊天、畫面設定 | API 金鑰與權杖、ComfyUI 的位置等每台電腦各自的設定 |

![還原的確認視窗。顯示備份的建立日期時間、內容的數量與取代的注意事項](shot:restore-confirm)

確認視窗中會顯示備份的建立日期時間，以及其中圖像、看板、工作流程的數量。按下 **{{ui:share.backup.confirm}}** 後，應用程式會先結束再重新啟動，目前的資料會被取代為備份的內容。失敗時會還原原本的資料，並告知這個情況。

> 被取代的資料無法復原。如有需要，請在還原之前先建立目前狀態的備份。API 金鑰與權杖僅為這台電腦加密，因此還原後請在 **{{ui:settings.section.accounts}}** 中重新輸入。在瀏覽器中開啟時，會下載不含圖像的 JSON 檔，並且無法還原。

### {{ui:settings.section.developer}}

- **{{ui:settings.showDevLog}}**：在左側導覽列顯示{{ui:app.devlog.short}}的按鈕（請見下方的「開發者記錄」）。
- **{{ui:settings.clearIntermediates}}**：清除畫布的途中結果等，不會顯示在圖庫中的圖像。要清除的數量會顯示在按鈕上。
- **{{ui:settings.resetWebUi}}**：將畫面的設定與狀態恢復為預設值。圖像與模型不會消失。按下之後，用 **{{ui:settings.resetConfirm}}** 確定，再用 **{{ui:settings.reload}}** 重新載入。

設定畫面中，另外還有「{{ui:settings.useCpuNoise}}」「{{ui:settings.enableInformationalPopovers}}」「{{ui:settings.enableImageDebugging}}」「{{ui:settings.clearIntermediatesOnStartup}}」的開關。這些在目前的版本中，不會改變生成或畫面的運作。

畫面的最下方，會顯示應用程式的版本。

## 快速鍵

![快速鍵的清單。依應用程式、畫布等分類，排列著操作與按鍵](shot:hotkeys)

從左下方的 **{{ui:app.nav.settingsMenu}}** 選擇 **{{ui:app.nav.hotkeys}}**，或按 `Shift+?`，就會開啟清單。用上方的搜尋欄，可以用操作名稱或按鍵來尋找。

這裡彙整了常用的。全部的內容，請在畫面的清單中確認。

### 整個應用程式

| 按鍵 | 操作 |
|---|---|
| `Ctrl+Enter` | 生成（加到佇列） |
| `Ctrl+Shift+Enter` | 加到佇列的最前面並生成 |
| `Shift+X` | 取消處理中的項目 |
| `Ctrl+Shift+X` | 清除整個佇列 |
| `Alt+A` | 移到提示詞欄 |
| `T` | 開合左側面板 |
| `G` | 開合右側面板 |
| `F` | 同時開合左右的面板 |
| `1` 〜 `9`、`0` | 移到編號的分頁 |
| `Shift+?` | 開啟快速鍵清單 |
| `Ctrl` + `+` / `-` | 放大、縮小整個畫面 |

### 畫布

| 按鍵 | 操作 |
|---|---|
| `B` | {{ui:settings.hotkeys.canvas.brush}} |
| `E` | {{ui:settings.hotkeys.canvas.eraser}} |
| `U` | {{ui:settings.hotkeys.canvas.rect}} |
| `V` | {{ui:settings.hotkeys.canvas.move}} |
| `C` | {{ui:settings.hotkeys.canvas.bbox}} |
| `H` | 移動顯示的位置 |
| `I` | {{ui:settings.hotkeys.canvas.colorPicker}} |
| `[` / `]` | 縮小、放大筆刷 |
| `Ctrl+Z` | {{ui:settings.hotkeys.canvas.undo}} |
| `Ctrl+Shift+Z`、`Ctrl+Y` | {{ui:settings.hotkeys.canvas.redo}} |
| `Q` | 與上一次使用的工具互相切換 |
| `Enter`、`Esc` | {{ui:settings.hotkeys.canvas.acceptStaged}}、{{ui:settings.hotkeys.canvas.discardStaged}} |

### 圖庫與檢視器

| 按鍵 | 操作 |
|---|---|
| 方向鍵 | {{ui:settings.hotkeys.gallery.navigate}} |
| `Ctrl+A` | {{ui:settings.hotkeys.gallery.selectAll}} |
| `Esc` | {{ui:settings.hotkeys.gallery.clearSelection}} |
| `.` | {{ui:settings.hotkeys.gallery.star}} |
| `I` | {{ui:settings.hotkeys.viewer.toggleMetadata}} |
| `R` | {{ui:settings.hotkeys.viewer.remix}}（載入種子以外的設定） |
| `P`、`S`、`A` | 載入提示詞、種子、全部 |
| `W` | {{ui:settings.hotkeys.viewer.loadWorkflow}} |
| `Shift+U` | {{ui:settings.hotkeys.viewer.upscale}} |
| `C` | {{ui:settings.hotkeys.viewer.compare}} |
| `Delete` | {{ui:settings.hotkeys.viewer.delete}} |
| `Ctrl+0`、`Ctrl+1` | {{ui:settings.hotkeys.viewer.zoomFit}}、{{ui:settings.hotkeys.viewer.zoomActual}} |

### 工作流程

| 按鍵 | 操作 |
|---|---|
| `Shift+A`、`Space` | {{ui:settings.hotkeys.workflows.addNode}} |
| `Delete` | 刪除所選的節點與連線 |
| `Ctrl+C`、`Ctrl+V` | {{ui:settings.hotkeys.workflows.copy}}、{{ui:settings.hotkeys.workflows.paste}} |
| `Ctrl+S` | {{ui:settings.hotkeys.workflows.save}} |
| `Ctrl+Z`、`Ctrl+Shift+Z` | {{ui:settings.hotkeys.workflows.undo}}、{{ui:settings.hotkeys.workflows.redo}} |

輸入文字時，`T` 或 `G` 等單一字元的按鍵不會作用。

## 關於這個應用程式

![應用程式資訊畫面。標誌、版本、授權以及所使用的開源軟體清單](shot:about)

從左下角的 **{{ui:app.nav.settingsMenu}}** 選擇 **{{ui:app.nav.about}}**，上方會顯示應用程式名稱、版本、授權和著作權資訊。下方分為兩個分頁。

- **{{ui:settings.about.license.title}}**：novira 授權條款（Apache License 2.0）的全文。安裝資料夾中也有同一檔案（`LICENSE`）。
- **{{ui:settings.about.oss.title}}**：應用程式使用的開放原始碼軟體清單。每列顯示名稱與版本。按下 **{{ui:settings.about.oss.showLicense}}** 會在該列下方顯示授權全文（再按一次即可關閉）。按下 **{{ui:settings.about.oss.homepage}}** 會在瀏覽器中開啟其頁面。生成引擎與擴充功能未隨應用程式附帶，請到其首頁查看授權全文。

清單上方的按鈕可篩選為 **{{ui:settings.about.oss.short.frontend}}**、**{{ui:settings.about.oss.short.backend}}**、**{{ui:settings.about.oss.short.engine}}** 或 **{{ui:settings.about.oss.short.packs}}**（目前已安裝的擴充功能）。搜尋框可依名稱尋找。隨附軟體的授權全文也彙整在安裝資料夾的 `THIRD_PARTY_NOTICES.txt` 中。

擴充功能（ComfyUI 的自訂節點）和模型在安裝時遵循各自發布者的授權。

## 開發者記錄

這是在遇到問題時，用來尋找原因的記錄。平常不需要使用。

開啟 **{{ui:settings.title}}** 的 **{{ui:settings.showDevLog}}** 後，左側導覽列會出現「{{ui:app.devlog.short}}」的按鈕。按下後，右側會開啟 **{{ui:app.devlog.title}}** 的面板。

這裡會附上時間，排列應用程式內部的記錄（後端的記錄）、畫面的警告、未被攔截的錯誤。

- 用上方的選項，可以篩選成 **{{ui:app.devlog.level.all}}**、**{{ui:app.devlog.level.warn}}**、**{{ui:app.devlog.level.error}}**。
- 在篩選欄輸入詞彙，就只會顯示包含該詞彙的行。
- 用 **{{ui:app.devlog.copy}}**，可以將顯示的行當作文字複製。回報問題時，可以貼上使用。
- 用 **{{ui:app.devlog.clear}}** 可以清除。

> 記錄是應用程式開啟期間的記載。關閉後，畫面上的記錄就會消失。詳細的調查方法，請見[遇到問題時](10-troubleshooting.md)。

