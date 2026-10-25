# 放大與工作流程

這一章說明用來放大圖像的 **{{ui:app.tabs.upscaling}}** 分頁，以及自己連接處理流程來製作的 **{{ui:app.tabs.workflows}}** 分頁。

## 放大

![放大分頁。中央排列著放置圖像的位置與步驟的卡片](shot:upscaling)

**{{ui:app.tabs.upscaling}}** 分頁會在放大圖像的同時補畫細節。它不是單純拉大，而是先用放大用的模型變大，再使用提示詞與 Tile ControlNet，重畫細微的地方。

### 使用的東西

需要下列 2 個模型。如果沒有安裝，左側面板會出現提醒。從「{{ui:params.upscale.openModels}}」按鈕，可以移到模型的畫面。安裝方法請見[模型](08-models.md)這一章。

- {{ui:params.upscale.model}}（Real-ESRGAN 等，用來放大圖像的模型）
- 符合所選主要模型的 {{ui:params.upscale.tileControlnet}}

尚未安裝任何放大模型時，左側面板會列出候選模型，請從標有 **{{ui:media.choice.recommended}}** 的開始選擇，並用 **{{ui:models.install.install}}** 安裝。

### 步驟

1. 將想放大的圖像，從圖庫拖曳到中央的卡片，或左側面板的 **{{ui:params.upscale.title}}** 框。在圖庫的圖像上按右鍵（在檢視器中是工具列）選擇 **{{ui:gallery.menu.upscale}}**，或在檢視器中開啟圖像後按 `Shift+U`，分頁也會切換，圖像會放進去。
2. 選擇 **{{ui:params.upscale.model}}**。
3. 從 2x、4x、8x 中選擇 **{{ui:params.upscale.scale}}**。會顯示像「輸出：2048×2048」這樣的完成尺寸。
4. 用下列 2 個滑桿調整成品。
   - **{{ui:params.upscale.creativity}}**：越高，越會偏離原圖，補畫新的細節。
   - **{{ui:params.upscale.structure}}**：越高，越會保留原圖的形狀與配置。
5. 選擇 **{{ui:params.upscale.tileControlnet}}**。需要的話，也選擇 **{{ui:params.upscale.postProcessing}}**（它會對繪製好的圖像做修飾，之後再調整為輸出尺寸）。
6. 按下 **{{ui:params.invoke.invoke}}**。

做好的圖像，會進入圖庫。

- 輸出的大小，單邊最多 8192 像素。超過時會出現警告，請調低倍率。
- 提示詞會影響補畫的細節。放入原圖的提示詞，圖像的方向會比較容易一致。
- 放大後的圖像與原圖差太多時，請調低 **{{ui:params.upscale.creativity}}**，調高 **{{ui:params.upscale.structure}}**。

> 想一次放大多張圖像時，請在圖庫中選取多張，從右鍵使用 **{{ui:gallery.menu.batch}}**（[修飾與沿用圖像](04-improve.md)）。這個方法只用放大用的模型來放大。

## 工作流程

![工作流程分頁。右側是繪製處理連接的畫面，左側是表單](shot:workflows)

工作流程是將「載入模型 → 輸入提示詞 → 製作圖像 → 儲存」這類處理的步驟，連接零件（節點）來組裝的功能。可以建立平常的生成分頁無法做到的細緻步驟，以及組合了數個處理的流程。

一開始，建議從 **{{ui:workflows.panel.templates}}**（下一個項目）開啟範本來使用。

畫面由下列 2 個部分組成。

- 中央：**{{ui:app.views.editor}}**。排列節點，並用線連接。
- 左側面板：**{{ui:workflows.panel.workflow}}**（表單）、**{{ui:workflows.panel.templates}}**、**{{ui:workflows.panel.packs}}**、**{{ui:workflows.panel.details}}**、**{{ui:workflows.panel.data}}** 這 5 個分頁。

要執行工作流程，請按下左側面板上方的 **{{ui:params.invoke.invoke}}** 按鈕。如果缺少輸出節點（「{{ui:workflows.nodes.save_image.title}}」等）、沒有選擇模型之類的問題，會顯示無法生成的原因。

### 新增節點並連接

1. 按下編輯器左上方的 **{{ui:workflows.toolbar.addNode}}**（＋）。用鍵盤的 `Shift+A` 或 `Space` 也能開啟。
2. 從清單中選擇節點。在上方的搜尋欄輸入文字，可以篩選。左側的分類可以依內建節點的種類，或依已安裝的擴充功能來篩選。
3. 從節點右側的圓點（輸出）拖曳到其他節點左側的圓點（輸入），連接起來。只有相同種類的才能連接。

![新增節點時的清單](shot:workflows-add-node)

連接時有一些方便的功能。

- 將線放開在沒有任何東西的地方，清單中只會出現能連接到那裡的節點。選擇後，就會新增節點並直接連接。
- 將線放開在節點上，會自動連接到符合的輸入。
- 選取的節點，可以用 `Delete` 刪除。用 `Ctrl+C` 與 `Ctrl+V`，可以複製節點。用 `Ctrl+Z` 復原，用 `Ctrl+Shift+Z` 重做。
- 將圖庫的圖像拖曳到編輯器，會新增放入該圖像的「{{ui:workflows.nodes.image.title}}」節點。
- 用節點名稱左邊的箭頭，可以收合節點。連按兩下名稱，可以更改名稱。

節點的設定值，直接在節點中輸入。已連接的輸入，其值來自連接的對象。

### 按鈕的排列

這是編輯器左上方的按鈕。

| 按鈕 | 做什麼 |
|---|---|
| **{{ui:workflows.toolbar.addNode}}** | 新增節點。 |
| **{{ui:workflows.toolbar.library}}** | 開啟工作流程的清單。 |
| **{{ui:workflows.toolbar.new}}** | 開始空白的工作流程。 |
| **{{ui:workflows.toolbar.save}}**（`Ctrl+S`） | 儲存。第一次儲存時，會詢問名稱。 |
| **{{ui:workflows.toolbar.optimize}}** | 合併重複的節點，刪除沒有連到輸出的節點與不需要的連線，並由左至右重新排列。也可以復原。 |
| **{{ui:workflows.toolbar.more}}** | **{{ui:common.saveAs}}**、**{{ui:workflows.toolbar.download}}**、**{{ui:workflows.toolbar.loadFromFile}}**。 |

在右上方齒輪的 **{{ui:workflows.settings.title}}** 中，可以切換顯示縮圖地圖、對齊格線等。

**{{ui:workflows.settings.autoTidy}}** 一開始就是開啟的。新增或刪除節點與線之後，稍等一下，就會自動將節點由左至右重新排列，並合併作用相同而重複的節點。合併時會出現通知，可以用 `Ctrl+Z` 還原。沒有連接的節點，不會自動刪除。想自己排列時，請關閉。

有尚未儲存的變更時，名稱旁邊會出現圓點。切換到其他工作流程時，會詢問是否可以捨棄。

### 用表單來使用

編輯器在節點很多時，會變得難以理解。因此，可以建立只彙整使用時常調整的項目的「表單」。

1. 在編輯器中，對項目（欄位）按右鍵，選擇 **{{ui:workflows.node.addToForm}}**。
2. 左側面板的 **{{ui:workflows.panel.workflow}}** 分頁中，會排列出該項目。
3. 按下 **{{ui:workflows.form.editForm}}**，就可以重新排序或移除。

只改變提示詞或尺寸，並反覆執行時很方便。已連接的項目，會顯示「{{ui:workflows.form.connected}}」。

在 **{{ui:workflows.panel.details}}** 分頁，可以寫入名稱、作者、標籤、說明等。在 **{{ui:workflows.panel.data}}** 分頁，可以查看並複製工作流程的內容（JSON）。

### 工作流程程式庫

![工作流程程式庫](shot:workflows-library)

按下 **{{ui:workflows.library.button}}**，就會開啟清單。

- **{{ui:workflows.library.recent}}**：最近開啟過的。
- **{{ui:workflows.library.yours}}**：自己儲存的。
- **{{ui:workflows.library.defaults}}**：一開始就有的範例。範例要用 **{{ui:workflows.library.copyToMine}}** 複製成自己的之後再修改。

可以搜尋、用標籤篩選、變更排列順序。用 **{{ui:workflows.library.open}}** 開啟，用垃圾桶按鈕刪除。**{{ui:workflows.library.new}}** 與 **{{ui:workflows.library.upload}}** 也在這裡。

### 匯出與載入

- 用 **{{ui:workflows.toolbar.download}}**，可以將工作流程匯出為 JSON 檔案。
- 用 **{{ui:workflows.toolbar.loadFromFile}}**（或 **{{ui:workflows.library.upload}}**），可以載入匯出的檔案，或其他人製作的檔案。
- 載入的檔案如果使用了尚未安裝的擴充功能的節點，會出現「{{ui:workflows.import.title}}」的對話框。安裝並重新啟動 ComfyUI 後，該工作流程會自動開啟。
- 也可以從用工作流程製作的圖像中，取出工作流程。在圖庫的圖像上按右鍵，選擇 **{{ui:gallery.menu.loadWorkflow}}**（在檢視器中開啟圖像時，也可以按 `W` 鍵）。即使是一般生成的圖像，也能依據設定組裝出相同的流程。**{{ui:gallery.menu.sendToWorkflow}}** 用在將該圖像作為工作流程的輸入圖像使用時。

> 其他人製作的工作流程，是在你的電腦上執行的程式的串接。來源不明的檔案，請不要載入。

## 範本

**{{ui:workflows.panel.templates}}** 分頁中，排列著常用組合的範本。

- 按下 **{{ui:workflows.templates.open}}**，會以新的工作流程開啟。
- 按下 **{{ui:workflows.templates.add}}**，會加到目前編輯器的右邊。
- 模型與圖像，在開啟之後再選擇。

需要擴充功能的範本，會出現「需要的擴充包」欄位。按下 **{{ui:workflows.templates.installPacks}}** 安裝，再用 **{{ui:workflows.templates.restartFirst}}** 按鈕重新啟動 ComfyUI，就能開啟了。

準備好的範本如下。

| 範本 | 做什麼 | 需要的擴充功能 |
|---|---|---|
| **{{ui:workflows.templates.text2image.title}}** | 用模型與提示詞製作 1 張並儲存的基本形式。 | 無 |
| **{{ui:workflows.templates.text2imageUpscale.title}}** | 將用 1024 製作的圖像放大到 2048 並儲存。 | 無 |
| **{{ui:workflows.templates.loraStack.title}}** | 將 LoRA 依序連接到模型，加入畫風與細節。 | 無 |
| **{{ui:workflows.templates.image2image.title}}** | 以手邊的圖像為基礎，用不同的提示詞重畫。 | 無 |
| **{{ui:workflows.templates.upscale.title}}** | 用放大用的模型，將圖像高精細地放大。 | 無 |
| **{{ui:workflows.templates.controlnetCanny.title}}** | 擷取圖像的輪廓線，在保留該形狀的同時重新繪製。 | 無 |
| **{{ui:workflows.templates.imageToVideo.title}}** | 為 1 張圖像加上動作，製作成短影片。 | 無（需要影片用的模型） |
| **{{ui:workflows.templates.filmGrain.title}}** | 為製作的圖像加上像照片般的顆粒。 | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.faceRig.title}}** | 改變人臉照片的表情、視線、脖子的朝向。 | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.tiledUpscale.title}}** | 放大到 2048 後，依每個拼貼重畫，補上細節。 | ComfyUI_UltimateSDUpscale |
| **{{ui:workflows.templates.styleReference.title}}** | 將參考圖像的畫風，轉移到提示詞的圖像上。 | ComfyUI_IPAdapter_plus（以及它的模型） |
| **{{ui:workflows.templates.faceDetailer.title}}** | 找出製作的圖像中的人臉，用高解析度重畫。 | Impact Pack 與 Impact Subpack |
| **{{ui:workflows.templates.removeBackground.title}}** | 只留下人或物，將背景變透明。 | ComfyUI-RMBG |
| **{{ui:workflows.templates.whiteBackground.title}}** | 只留下人或物，將背景變成純白。適合作為防止參考圖像的背景顏色轉移到圖像上的前置作業。 | ComfyUI-RMBG |
| **{{ui:workflows.templates.poseControl.title}}** | 擷取作為參考的圖像中人物的姿勢，繪製相同姿態的新圖像。 | comfyui_controlnet_aux（以及 OpenPose 用的 ControlNet 模型） |
| **{{ui:workflows.templates.captionToImage.title}}** | 將作為參考的圖像內容寫成文字，作為提示詞，重新繪製。 | Florence-2 的擴充功能 |
| **{{ui:workflows.templates.characterReference.title}}** | 將角色的圖像換成白色背景作為參考圖像，統一頭髮、眼睛、服裝，繪製新的場景。CFG 設定為適合參考圖像的較低值。 | ComfyUI-RMBG 與 ComfyUI_IPAdapter_plus |
| **{{ui:workflows.templates.characterPose.title}}** | 角色的外觀取自參考圖像，姿勢取自火柴人（OpenPose）來繪製。 | 上面的 2 個，加上 comfyui_controlnet_aux 與 OpenPose 用的 ControlNet 模型 |

使用角色的範本，是為了想用工作流程細部調整[登錄並使用角色](04-improve.md#登錄並使用角色)的功能時而準備的。通常使用在生成分頁登錄的角色就足夠了。火柴人的姿勢，可以用[畫布](05-canvas.md)的「{{ui:pose.title}}」來製作。

## 擴充功能（節點包）

在 **{{ui:workflows.panel.packs}}** 分頁，可以為 ComfyUI 加入或移除擴充功能。擴充功能是用來增加節點的附加零件。安裝的節點，會出現在新增節點清單的 **{{ui:workflows.categories.extension}}** 中。

一開始，會排列著「{{ui:workflows.packs.whatToDo}}」的大型圖磚。選擇想做的事（修復人臉、去除背景、放大並高精細化等），符合的擴充功能就會附上說明排列出來。

1. 按下想使用的擴充功能的 **{{ui:workflows.packs.install}}**。
2. 安裝完成後，會出現「{{ui:workflows.packs.restartNeeded}}」。請按下 **{{ui:workflows.packs.restart}}**。
3. 重新啟動完成後，就能使用該擴充功能的節點與範本。

有些擴充功能附有注意事項。例如「需要 Git」「安裝需要花費時間與容量」「已停止更新」等。安裝之前請先閱讀。

目錄中沒有的，可以用 **{{ui:workflows.packs.byAddress}}**，輸入 GitHub 的位址（https://github.com/使用者名稱/名稱 的形式）來安裝。其他已安裝的擴充功能，會顯示在 **{{ui:workflows.packs.others}}**。不需要的擴充功能，可以用 **{{ui:workflows.packs.remove}}** 移除（為了確認，需要再按一次）。

已安裝的擴充功能，即使不在工作流程畫面中，也可以隨時查看。點選左側導覽列中的 **{{ui:app.nav.extensions}}**（拼圖圖示），會開啟 **{{ui:workflows.packs.mgr.title}}**。已公開的擴充功能以卡片顯示，可以用左側清單中的 **{{ui:workflows.packs.mgr.installed}}**、**{{ui:workflows.packs.mgr.notInstalled}}** 或用途來篩選，也可以在上方的欄位依名稱、作者或說明搜尋。**{{ui:workflows.packs.mgr.sort.label}}** 預設依 **{{ui:workflows.packs.mgr.sort.downloads}}** 由多到少。卡片上會顯示作者、版本、更新日期與下載量，已安裝的會顯示 **{{ui:workflows.packs.installed}}**。尚未安裝的，可以按卡片上的 **{{ui:workflows.packs.install}}** 來安裝。按下卡片，右側會開啟詳情，可以確認 **{{ui:workflows.packs.mgr.license}}** 和來源，也可以進行 **{{ui:workflows.packs.remove}}**。清單中沒有的擴充功能，可以在上方的 **{{ui:workflows.packs.mgr.addTitle}}** 中輸入 GitHub 位址來安裝。安裝或移除之後，按同一畫面中的 **{{ui:workflows.packs.restart}}**，即可生效。每張卡片的詳細資料裡都有 **{{ui:agent.ask.button}}** 按鈕，在搜尋欄輸入文字後還會出現 **{{ui:agent.ask.resultsButton}}**。按下後，AI 助理會說明該擴充功能能做什麼、怎麼使用（請參閱 [AI 助理與設定](09-assistant-settings.md)）。

詳情中的 **{{ui:workflows.packs.version.label}}** 會顯示目前已安裝的版本。只有該擴充功能的儲存庫公開了版本時，才會出現 **{{ui:workflows.packs.version.change}}**，按下後會列出可選擇的版本，按下 **{{ui:workflows.packs.version.apply}}** 即可切換到該版本。目前已安裝的版本會標示 **{{ui:workflows.packs.installed}}**。沒有公開版本的擴充功能不會出現此按鈕。要讓變更生效，請按同一畫面中的 **{{ui:workflows.packs.restart}}**。已知其他擴充功能或 ComfyUI 不支援的版本，會標示 **{{ui:workflows.packs.version.deprecated}}**，並寫明是哪一個不支援。自行安裝的擴充功能無法在此變更版本。

ComfyUI 的版本也可以在同一畫面中變更。按下清單最前面的 **{{ui:workflows.packs.version.comfyTitle}}** 卡片，再按右側的 **{{ui:workflows.packs.version.change}}**，會列出可選擇的版本。按下 **{{ui:workflows.packs.version.apply}}** 後，再按一次 **{{ui:workflows.packs.version.confirm}}** 即開始切換。已安裝的擴充功能都會重新安裝，需要幾分鐘，期間無法生成圖像。如果新版本無法啟動，會恢復為原本的版本。

> 擴充功能是在你的電腦上執行的程式。來源不明的，請不要安裝。

> 連接的是不由應用程式管理的 ComfyUI 時，無法從這個畫面安裝。請在那個 ComfyUI 那一側安裝。

[修飾與沿用圖像](04-improve.md)的「{{ui:cutout.menu}}」或「{{ui:facefix.menu}}」等，使用擴充功能的功能，在需要時也會以同樣的方式引導安裝。
