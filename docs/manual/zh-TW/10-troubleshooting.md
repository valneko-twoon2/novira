# 遇到問題時

這裡彙整了不順利時的原因，以及可以嘗試的做法。請從畫面上出現的文字來尋找。

首先，查看下列 2 個地方，多半能掌握原因的線索。

- **{{ui:app.tabs.queue}}** 分頁：失敗的項目會顯示原因（請見[下方](#生成失敗)）。
- {{ui:app.devlog.title}}：應用程式內部的記載（請見[助理與設定](09-assistant-settings.md)）。

## 啟動與引擎

novira 為了製作圖像等內容，會使用「圖像生成引擎」（ComfyUI，以及用來執行它的 Python）。引擎是由應用程式自己安裝、自己啟動的。

### 啟動需要花費時間

第一次啟動時，因為有引擎的下載與解壓縮，所以會花費時間。**{{ui:engine.firstRunNote}}**

最初的畫面會顯示 **{{ui:splash.step.downloading}}**、**{{ui:splash.step.extracting}}**、**{{ui:splash.step.starting}}** 這 3 個階段。下載中，也會顯示大小、速度與剩餘時間。請等到完成為止。

引擎準備完成後，畫面會切換。從第二次起，只有啟動後到引擎回應之前的短暫時間。

### 畫面上方出現的訊息

引擎準備期間，或是不順利時，畫面上方會出現訊息。

| 訊息 | 意思 |
|---|---|
| {{ui:engine.title.downloading}} | 正在下載引擎。有數 GB。網路較慢時會花費時間 |
| {{ui:engine.title.extracting}} | 正在解壓縮下載的檔案 |
| {{ui:engine.title.starting}} | 正在啟動引擎，等待連線 |
| {{ui:engine.title.error}} | 準備失敗。下方會顯示原因 |

### 出現「{{ui:engine.title.error}}」

出現在啟動時的最初畫面時，按下 **{{ui:splash.open}}**，就可以在沒有引擎的情況下開啟應用程式。這種情況下，無法製作圖像等內容，但可以查看圖像，或整理模型。

可以嘗試的做法：

1. 閱讀原因的文字。確認是否已連上網路、磁碟是否還有空間。
2. 再試一次。即使引擎的準備失敗，下次開始生成時，應用程式也會重新進行準備。如果還是沒有改善，請關閉應用程式後重新開啟。
3. 如果下載已經完成，只有解壓縮失敗，下載的檔案會保留，所以重試時會從解壓縮繼續。
4. 有時安全性軟體正在檢查新檔案，使解壓縮停住。應用程式會自動重試數次，但持續發生時，請試著將資料資料夾（請見下方）排除在檢查對象之外，或暫時停用。
5. 原因中出現「see logs/comfyui.log」時，引擎的記錄中有詳細的原因（請見[查看記錄的方法](#查看記錄的方法)）。

> 引擎是 Windows 用的 ComfyUI，預設會安裝 NVIDIA GPU 用的版本。也有使用 AMD 的 GPU，或自己安裝的 ComfyUI 的設定，但這是給進階使用者的（請見[進階使用者設定](#進階使用者設定)）。

### 引擎看起來在中途停住了

引擎啟動後，等待回應的時間，預設是 3 分鐘。超過之後，會出現意思是「ComfyUI did not answer in time」的錯誤。啟動途中引擎結束時，會顯示「ComfyUI exited while starting」。兩者的原因，都會留在引擎的記錄（`comfyui.log`）中。

## 無法生成

### 無法按下生成按鈕

將滑鼠移到 **{{ui:app.tabs.generate}}** 畫面的生成按鈕上，會顯示 **{{ui:params.invoke.cannotInvoke}}** 這樣的原因清單。在影片、音樂、語音、Logo 的畫面，原因會排列在按鈕下方。逐一解決顯示出的原因，按鈕就能按下了。

| 顯示的原因 | 解決方式 |
|---|---|
| {{ui:params.readiness.noModel}} | 選擇模型。沒有安裝時，請見下一項的「沒有安裝模型」 |
| {{ui:params.readiness.loraMissing}} | 找不到原先選擇的 LoRA。可能已被刪除或移動。請重新選擇 LoRA，或移除 |
| LoRA「○○」與模型不相容 | 基礎（SDXL 或 SD1.X 等）不同。請改用相同基礎的 LoRA，或移除 |
| 參考圖像 ○：尚未選擇圖像，或尚未選擇模型 | 在參考圖像欄放入圖像與模型 |
| 參考圖像需要擴充功能 ○○ | 從參考圖像欄的說明安裝擴充功能（[缺少擴充功能](#缺少擴充功能)） |
| {{ui:params.readiness.upscaleNoImage}} | 選擇要放大的圖像 |
| {{ui:params.readiness.upscaleNoModel}} | 選擇放大用的模型。沒有安裝時，可以從{{ui:app.tabs.models}}分頁的 **{{ui:models.install.tab.starter}}** 安裝 |
| {{ui:video.problem.prompt}}、{{ui:music.problem.tags}}、{{ui:voice.problem.text}}、{{ui:logo.problem.text}} | 必填的欄位是空的。請輸入 |
| {{ui:video.problem.image}} | 在「從圖像（i2i）」時，沒有選擇要讓它動起來的圖像 |
| {{ui:voice.problem.description}} | 在「用文字製作聲音」時，聲音的說明是空的 |
| {{ui:video.problem.pack}}、{{ui:music.problem.pack}}、{{ui:voice.problem.pack}}、{{ui:logo.problem.pack}} | 沒有安裝專用的模型。請見下一個項目 |

### 沒有安裝影片、音樂、語音、Logo 的模型

各自畫面的左側面板會出現卡片，請按下 **{{ui:pack.install}}**。在安裝完成之前，無法製作。

- 下載途中失敗時，卡片的按鈕會變成 **{{ui:pack.retry}}**。按下後會重試。
- 語音也會安裝朗讀用的引擎。需要先完成圖像生成引擎的準備。
- 高速的影片模型，與標準的影片模型是分開下載的。

詳情請見[影片、音樂、語音、Logo](07-media.md)。

### 沒有安裝模型

**{{ui:app.tabs.models}}** 分頁顯示 **{{ui:models.empty.title}}** 時，表示一個模型都沒有。

- 可以從 **{{ui:models.import}}** 的 **{{ui:models.install.tab.starter}}**，安裝最初的模型。
- 也可以在 **{{ui:app.tabs.browse}}** 分頁，搜尋喜歡的模型並安裝。
- 已經有模型檔案時，可以用 **{{ui:models.import}}** 的 **{{ui:models.install.tab.scan}}**，連同資料夾一併匯入。

詳情請見[模型](08-models.md)。

### 缺少擴充功能

有些功能會顯示「需要擴充功能 ○○」。例如修復人臉、選取範圍、去除背景、補足影片的影格、使用參考圖像等。

1. 按下訊息旁邊的 **{{ui:params.refImage.installPack}}**。
2. 安裝完成後，按下 **{{ui:params.refImage.restartEngine}}**，重新啟動引擎。
3. 重新啟動之後，再試一次。

擴充功能也可以從 **{{ui:app.tabs.workflows}}** 分頁的 **{{ui:workflows.panel.packs}}**，以清單的方式安裝或移除。

> 連接的不是應用程式安裝的引擎，而是自己準備的引擎時，無法從應用程式安裝擴充功能。請在那個引擎那一側安裝。

### GPU 的記憶體不足，或與其他應用程式搶用

圖像、影片、音樂會使用電腦的 GPU。其他應用程式（遊戲、影片編輯、瀏覽器的影片等）正在使用 GPU 時，記憶體可能會不足而失敗。

記憶體不足時，錯誤中有時會出現「OOM」（記憶體不足的意思）的文字。

因記憶體不足而失敗時，應用程式會辨識出來，並顯示 **{{ui:queue.oom.title}}** 的提示。提示會出現在圖庫上方、**{{ui:app.tabs.queue}}** 分頁中失敗項目的下方、影片、音樂、語音、Logo 的畫面，以及畫面右下角的通知中。

![GPU 記憶體不足時的提示，並排著縮小後重試與開啟低顯示記憶體模式並重新啟動兩個按鈕](shot:out-of-memory)

可以用提示中的按鈕嘗試以下其中一種做法：

- **{{ui:queue.oom.retrySmaller}}**：維持相同的設定與種子，在保持長寬比的同時把面積縮小到約 75%，再製作一次。只對指定尺寸製作的圖像顯示（影片、音樂、語音、Logo 與放大不顯示）。
- **{{ui:queue.oom.lowMemory}}**：開啟 **{{ui:settings.lowMemory.label}}**（請見 [助理與設定](09-assistant-settings.md)）並重新啟動引擎。有正在製作的項目時，會在下次啟動引擎時生效。已經開啟時不會顯示。

因記憶體不足而失敗後，應用程式會請引擎卸除已載入的模型並釋放記憶體。因此下一次製作要從重新載入模型開始，會多花一點時間。

可以嘗試的做法：

- 關閉遊戲或影片編輯等其他使用 GPU 的應用程式後，再製作一次。
- 縮小圖像的尺寸。
- 減少使用的 LoRA 或參考圖像。
- 影片先用較小的尺寸製作，完成後再用 **{{ui:video.finish}}** 放大。也可以試試 **{{ui:video.light.title}}** 的 **{{ui:video.light.fp8}}** 與 **{{ui:video.light.tiled}}**。
- 重新開啟應用程式，釋放使用中的記憶體。

語音的模型，在一陣子沒有使用後會從 GPU 卸除。製作會 1 件接著 1 件依序進行。

### 生成失敗

圖像、影片、音樂等的製作失敗時，**{{ui:app.tabs.queue}}** 分頁的項目會變成 **{{ui:queue.status.failed}}**。按下項目展開後，**{{ui:queue.detail.error}}** 會顯示原因。在影片、音樂、語音、Logo 的畫面，中間的上方也會顯示失敗的標示與原因（最多顯示最近的 3 件）。

知道原因之後，可以用項目的 **{{ui:queue.action.retry}}** 按鈕，以相同的設定重試。

原因的文字，因為是由引擎或應用程式內部輸出的，所以有時是英文。以下列出常見的。

| 原因的文字（重點） | 意思與可以嘗試的做法 |
|---|---|
| ComfyUI does not see ... (check model roots / extra_model_paths) | 引擎找不到那個模型。可能是移動了模型的檔案，或搜尋資料夾的設定不正確。請在模型分頁重新安裝，或確認位置 |
| ComfyUI is not reachable at ... | 無法連線到另外準備的引擎。請確認該引擎是否已啟動 |
| ComfyUI exited while starting / did not answer in time | 引擎無法啟動。請查看引擎的記錄 |
| ... OOM | GPU 的記憶體不足。請見前一個項目 |
| ... models are not supported by the ComfyUI backend yet | FLUX 或 SD3.X 的模型，還不能用於生成圖像。請選擇 SDXL 或 SD1.X 的模型 |
| Reference images need the ... custom node pack | 沒有安裝參考圖像所需的擴充功能 |
| This ComfyUI is too old for video / music | 使用中的引擎，沒有影片或音樂所需的功能。如果是應用程式安裝的引擎，不會發生。如果是自己準備的引擎，請更新 |
| The video / music / logo models are not installed yet | 沒有安裝專用的模型。請從各自的畫面下載 |
| ComfyUI has no ... node; install the custom node pack | 沒有安裝工作流程所使用的節點的擴充功能 |
| Interrupted because novira was closed | 製作途中，應用程式被關閉了。請再製作一次 |

### 圖像做好了卻看不到

製作是 **{{ui:queue.status.completed}}**，但圖庫中沒有出現時，請確認下列事項。

- **看板不同**：新的圖像，會放進標有 **{{ui:gallery.boards.autoBadge}}** 標記的看板（初始狀態是 **{{ui:gallery.boards.uncategorized}}**）。如果開啟的是其他看板，就不會顯示在那裡。請切換看板，或用 **{{ui:gallery.boards.setAutoAdd}}** 重新選擇要放入新圖像的看板。
- **Logo 會放進「素材」**：Logo 不是放進 **{{ui:gallery.view.images}}**，而是放進 **{{ui:gallery.view.assets}}** 那一邊。
- **影片與語音的顯示方式**：影片是附有 ▶、語音是附有 ♪ 的縮圖來排列。如果還留著搜尋或篩選，就會被隱藏。

還是找不到時，請在 **{{ui:app.tabs.queue}}** 分頁確認項目的 **{{ui:queue.col.destination}}**。輸出目的地是 **{{ui:queue.destination.canvas}}** 的項目，會出現在畫布，而不是圖庫。

## 資料的存放位置與備份

### 資料在哪裡

圖像、模型、記載，全部都放在名為 **`novira-data`** 的資料夾中。位置如下。

- 發行版：安裝時選擇的資料夾。預設值為與應用程式的執行檔（`novira.exe`）相同資料夾中的 `novira-data`。
- 開發中的版本：儲存庫最上層資料夾中的 `novira-data`。

可以用環境變數 `NOVIRA_DATA_DIR`，改成其他位置。

| 資料夾、檔案 | 放入的內容 |
|---|---|
| `outputs` | 製作的圖像、影片、語音 |
| `novira.sqlite` | 圖像的資訊、看板、佇列、模型的清單、工作流程等的記載 |
| `thumbnails` | 縮小的圖像 |
| `models` | 安裝的模型 |
| `comfyui` | 應用程式安裝的圖像生成引擎 |
| `cache` | 引擎使用的暫時性資料 |
| `voice` | 語音朗讀用的程式庫 |
| `logs` | 記錄（請見下方） |
| `settings.json` | 給進階使用者的設定（沒有也沒關係） |
| `secrets` | API 金鑰與權杖（已加密） |
| `agent.json` | 在 AI 助理中選擇的 AI 種類 |

應用程式安裝的引擎（ComfyUI 與 Python），以及它的作業用資料，也都放在資料資料夾中。

應用程式畫面的設定（語言、主題、預設、AI 聊天的記錄等），不是放在 `novira-data`，而是放在應用程式畫面那一側的儲存區域。

### 備份

novira 有建立備份的功能，也有從備份還原的功能。要保護重要的圖像，請使用設定中的 **{{ui:share.backup.section}}**（請見 [助理與設定](09-assistant-settings.md#備份)）。備份中包含製作的圖像，以及在應用程式內設定、登錄的內容，但不包含模型與圖像生成引擎。若也想保留它們，請自己複製資料夾。

1. 關閉應用程式（也要確認沒有製作中的項目）。
2. 將 `novira-data` 資料夾整個複製到其他磁碟機等處。

容量較大的是 `models` 與 `comfyui`。只想留下圖像與記載時，以 `outputs` 與 `novira.sqlite` 為主。`models` 中的模型，通常可以從匯入來源重新下載，但已停止發布的，有時無法恢復。

> API 金鑰與權杖，是用 Windows 的功能加密的。複製到其他電腦或其他使用者時，有時無法讀取，這種情況下，請在設定中重新輸入。

應用程式畫面的設定與預設、AI 聊天的記錄，不包含在這份複本中，但包含在備份中。

## 查看記錄的方法

記錄可以在 3 個地方查看。

| 位置 | 內容 |
|---|---|
| {{ui:app.devlog.title}}（應用程式內） | 應用程式內部的記載，以及畫面的警告與錯誤。在設定中開啟顯示（[助理與設定](09-assistant-settings.md)） |
| `novira-data\logs\novira.log` | 應用程式本身的記載。變大時（超過 2 MB），會移到 `novira.log.1` |
| `novira-data\logs\comfyui.log` | 圖像生成引擎的記載。無法啟動，或生成失敗時的原因會顯示在這裡 |

記錄會將新的行加在下方。發生狀況時，請查看接近最下方的地方。含有「error」或「failed」的行就是線索。

## 回報問題時

如果備齊下列內容，就能更快找出原因。

1. **做了什麼，結果如何**：操作的順序、預期的結果、實際發生的事。
2. **畫面上的文字**：將錯誤的文字（**{{ui:app.tabs.queue}}** 分頁的 **{{ui:queue.detail.error}}**，或畫面上方出現的訊息）照原樣抄下來。
3. **應用程式的版本**：顯示在設定畫面的最下方，或 **{{ui:app.nav.about}}** 中。
4. **開發者記錄**：用 **{{ui:app.devlog.copy}}** 複製的文字。
5. **記錄檔**：`novira.log` 與 `comfyui.log` 中，發生問題的時間前後。
6. **電腦的資訊**：GPU 的種類與記憶體、Windows 的版本。

> 記錄中，有時會包含提示詞或檔案的位置。交給別人之前，請確認是否有不想讓人看到的部分。

## 進階使用者設定

在資料資料夾中放置 `settings.json`，就可以改變引擎等的運作。通常不需要。

| 設定名稱 | 內容 |
|---|---|
| `comfyuiPackage` | 要安裝的引擎種類。`nvidia`（預設）或 `amd` |
| `comfyuiUrl` | 連接已經在執行的 ComfyUI（應用程式不會安裝引擎，也不會啟動） |
| `comfyuiDir` | 使用自己安裝的 ComfyUI 的資料夾 |
| `modelRoots` | 新增搜尋模型的資料夾 |
| `comfyuiStartTimeoutSecs` | 等待引擎啟動的秒數（預設為 180） |
| `lowMemoryMode` | 低顯示記憶體模式（`true` 或 `false`）。在設定畫面切換 **{{ui:settings.lowMemory.label}}** 時會寫入這裡 |

檔案的寫法有錯誤時，應用程式不會啟動，並會顯示原因。變更之後，請重新開啟應用程式。

