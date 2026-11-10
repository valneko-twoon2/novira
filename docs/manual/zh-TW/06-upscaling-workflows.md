# 放大與工作流程

這一章說明將圖像放大的 **{{ui:app.tabs.upscaling}}**，以及自己連接處理流程來製作的 **{{ui:app.tabs.workflows}}** 分頁。

## 放大

![放大畫面。中央並排著放置圖像的位置與步驟的卡片](shot:upscaling)

**{{ui:app.tabs.upscaling}}** 要從左側邊欄的方框圖示開啟（也可以按數字鍵 3 開啟）。它會在放大圖像的同時補畫細節。並不是單純拉伸，而是先用放大用的模型變大，接著使用提示詞與拼貼 ControlNet，重畫細微的地方。大張的圖像，會分成與原圖差不多大小的區塊，逐個區塊重畫後再連接起來。因為是以模型擅長的大小來繪製，所以不容易崩壞，所需的時間大致與區塊的數量成正比。每個區塊都是以整個提示詞來繪製，所以如果提示詞維持描寫人物的內容，天空或背景的區塊上，可能會補畫出小小的人影或臉。這時請調低 **{{ui:params.upscale.creativity}}**，或是讓提示詞只留下關於畫質與質感的詞彙。

### 使用的東西

會使用以下 2 個模型。尚未安裝時，左側面板會顯示注意事項。從「{{ui:params.upscale.openModels}}」按鈕，可以前往模型畫面。安裝方法請見[模型](08-models.md)這一章。

- {{ui:params.upscale.model}}（Real-ESRGAN 等，用來放大圖像的模型）
- 符合所選主要模型的{{ui:params.upscale.tileControlnet}}（有符合的就會自動選取。像 Anima 或 Qwen-Image 這種沒有符合項目的系列，則在沒有拼貼 ControlNet 的狀態下重畫。此時 **{{ui:params.upscale.structure}}** 不會發揮作用，所以想保持形狀時，請調低 **{{ui:params.upscale.creativity}}**）

完全沒有安裝放大模型時，左側面板會並排顯示候選項目，可以從標有 **{{ui:media.choice.recommended}}** 記號的項目中選擇，並用 **{{ui:models.install.install}}** 安裝。

### 步驟

1. 將想放大的圖像，從圖庫拖曳到中央的卡片，或左側面板 **{{ui:params.upscale.title}}** 的方框。在圖庫的圖像上按右鍵（在檢視器中則是工具列）選擇 **{{ui:gallery.menu.upscale}}**，或在檢視器中開啟圖像後按 `Shift+U`，分頁也會切換，並放入圖像。
2. 選擇 **{{ui:params.upscale.model}}**。
3. 從 2x、4x、8x 中選擇 **{{ui:params.upscale.scale}}**。會像「輸出：2048×2048」這樣顯示完成後的大小。
4. 用以下 2 個滑桿調整完成的效果。
   - **{{ui:params.upscale.creativity}}**: 越高，越會偏離原圖，補畫新的細節。
   - **{{ui:params.upscale.structure}}**: 越高，越會保持原圖的形狀與配置。
5. 確認 **{{ui:params.upscale.tileControlnet}}**（有符合的就會被選取）。必要時，也選擇 **{{ui:params.upscale.postProcessing}}**（用這個模型將畫好的圖像完稿後，再配合輸出的大小調整）。
6. 按下 **{{ui:params.invoke.invoke}}**。

做好的圖像會放進圖庫。

- 輸出的大小，單邊最大為 8192 像素。超過時會顯示警告，請降低倍率。
- 提示詞會影響補畫的細節。事先輸入原圖的提示詞，圖像的方向比較容易吻合。
- 放大後的圖像與原圖差太多時，請調低 **{{ui:params.upscale.creativity}}**，並調高 **{{ui:params.upscale.structure}}**。

> 想一次放大多張圖像時，請在圖庫中選取多張，從右鍵使用 **{{ui:gallery.menu.batch}}**（[修飾與沿用圖像](04-improve.md)）。這個方式只用放大用的模型來放大。

## 工作流程

![工作流程分頁。右側是描繪處理連接的畫面，左側是表單](shot:workflows)

工作流程是把「讀取模型 → 放入提示詞 → 製作圖像 → 儲存」這樣的處理步驟，用零件（節點）連接起來組成的功能。可以建立平常的生成分頁無法做到的細緻步驟，或是組合了幾個處理的流程。

一開始建議從 **{{ui:workflows.panel.templates}}**（下一節）開啟範本來使用。

畫面由以下 2 個部分組成。

- 中央：**{{ui:app.views.editor}}**。排列節點，並用線連接。
- 左側面板：**{{ui:workflows.panel.workflow}}**（表單）・**{{ui:workflows.panel.nodes}}**・**{{ui:workflows.panel.templates}}**・**{{ui:workflows.panel.packs}}**・**{{ui:workflows.panel.details}}**・**{{ui:workflows.panel.data}}** 這 6 個分頁。

要執行工作流程，請按下左側面板上方的 **{{ui:params.invoke.invoke}}** 按鈕。如果有沒有輸出節點（「{{ui:workflows.nodes.save_image.title}}」等）、沒有選擇模型等問題，會顯示無法生成的原因。

連接起來的節點，全部都會用於執行。**{{ui:workflows.nodes.controlnet.title}}**、**{{ui:workflows.nodes.ip_adapter.title}}**、**{{ui:workflows.nodes.img_resize.title}}**、**{{ui:workflows.nodes.canny_edge_detection.title}}** 等，也都會依連接的方式運作。**{{ui:workflows.nodes.ip_adapter.title}}** 需要擴充功能與模型（圖像編碼器）。目前還無法執行的有：**{{ui:workflows.nodes.collect.title}}**・**{{ui:workflows.nodes.iterate.title}}**・**{{ui:workflows.nodes.range.title}}**、方框模糊，以及連接了 **{{ui:workflows.nodes.rand_int.title}}** 的運算節點。無法使用的原因，會顯示在上述的問題提示中。

### 新增節點並連接

左側面板的 **{{ui:workflows.panel.nodes}}** 分頁中，可新增的節點，會以與 ComfyUI 相同的分類方式排列。在 **{{ui:workflows.nodeLibrary.section.core}}** 與 **{{ui:workflows.picker.extensions}}** 的標題下方，各種類的資料夾（模型、圖像、影片等）會以與 ComfyUI 相同的順序排列，novira 獨有的標準節點，也放在相同種類的資料夾中。開啟後會顯示其中的資料夾與節點。**{{ui:workflows.picker.extensions}}** 是在擴充功能名稱的資料夾之中，放著該擴充功能的類別。搜尋後，會連同所在的資料夾一起，排列出符合的節點。連按兩下節點（或選取後按 `Enter`），節點會放進畫布的中央；拖曳到畫布，則會放在該位置。不需要開啟會遮住畫面的清單，就能連續新增。也可以用以下方式新增。

1. 按鍵盤的 `Shift+A` 或 `Space`，會開啟選擇節點的清單。
2. 從清單中選擇節點。在上方的搜尋欄輸入詞彙，可以縮小範圍。用左側的分類，可以依標準節點的種類、ComfyUI 本體節點的種類，以及已安裝的各擴充功能來縮小範圍。
3. 從節點右側的圓點（輸出），拖曳到另一個節點左側的圓點（輸入）來連接。只能連接相同種類的項目。

![新增節點時的清單](shot:workflows-add-node)

連接時有一些方便的功能。

- 把線放開在什麼都沒有的地方，清單中只會顯示可以連接到那裡的節點。選擇後，會新增節點並直接連接。
- 把線放開在節點上，會自動連接到符合的輸入。
- 選取的節點可以用 `Delete` 刪除。用 `Ctrl+C` 與 `Ctrl+V` 可以複製節點。用 `Ctrl+Z` 復原，用 `Ctrl+Shift+Z` 重做。
- 將圖庫的圖像拖曳到編輯器，會新增放入該圖像的「{{ui:workflows.nodes.image.title}}」節點。
- 用節點名稱左側的箭頭，可以收合節點。連按兩下名稱，可以更改名稱。

節點的設定值，直接在節點中輸入。已連接的輸入的值，則來自連接的來源。

### 用工作流程製作音樂與影片

左側面板的 **{{ui:workflows.panel.nodes}}** 分頁，以及新增節點的清單左側，有 **{{ui:workflows.picker.core}}** 的分類。ComfyUI 原本就有的節點，會依種類（語音、影片、取樣等）排列，製作音樂與影片的節點也在這裡。可以和標準節點自由組合。

- 開啟範本 **{{ui:workflows.templates.musicAceStep.title}}**・**{{ui:workflows.templates.videoWan22.title}}**・**{{ui:workflows.templates.videoWan22Image.title}}**，就能立刻運作。模型會使用在音樂分頁與影片分頁下載的模型。
- 在儲存結果的節點（Save Audio 或 Save Video）中選擇格式。像 MP3 的音質這類，所選格式需要的設定，會顯示在下方。
- 做好的音樂與影片會放進圖庫。圖庫能處理的格式，音樂是 MP3・WAV・FLAC，影片是 MP4。選擇 Opus 或 WebM 等格式時，會顯示告知這是無法儲存的格式的訊息，並停止。
- 圖庫的音樂與影片，用 Load Audio 或 Load Video 節點選取並連接。
- **{{ui:workflows.nodes.voice_speak.title}}** 節點（分類為 **{{ui:workflows.categories.audio}}**），會製作將文字朗讀出聲的語音。引擎與語音分頁相同（Qwen3-TTS），需要事先安裝。做好的語音，連接到接收語音的節點。連接到 Save Audio 可以儲存成 MP3 等，連接到 Create Video 的語音，則可以為影片加上聲音（語音比影片長時，會依影片的長度截斷）。範本 **{{ui:workflows.templates.voiceRead.title}}** 與 **{{ui:workflows.templates.videoNarration.title}}** 可以直接使用。
- 沒有連接「隨機整數」的種子，每次都會得到相同的結果。範本中一開始就已經連接。
- ComfyUI 本體節點的名稱、項目與資料夾名稱，會以和 ComfyUI 本身畫面相同的詞彙顯示。ComfyUI 沒有翻譯的詞彙（擴充功能的節點等）維持英文。可使用的節點數量，會依 ComfyUI 的版本而變。

### 按鈕的排列

這是編輯器左上方的按鈕。

| 按鈕 | 做什麼 |
|---|---|
| **{{ui:workflows.toolbar.new}}** | 開始一個空白的工作流程。 |
| **{{ui:workflows.toolbar.save}}**（`Ctrl+S`） | 儲存。第一次儲存時，會詢問名稱。 |
| **{{ui:workflows.toolbar.optimize}}** | 合併重複的節點，刪除沒有連到輸出的節點與不需要的連線，並由左至右重新排列。也可以重做。 |
| **{{ui:workflows.toolbar.more}}** | **{{ui:common.saveAs}}**、**{{ui:workflows.toolbar.download}}**、**{{ui:workflows.toolbar.loadFromFile}}**。 |

右上齒輪的 **{{ui:workflows.settings.title}}**，可以切換顯示縮圖地圖、對齊格線等。

**{{ui:workflows.settings.autoTidy}}** 一開始是關閉的。開啟後，新增或刪除節點、連線時，過一會兒就會由左至右自動重新排列節點，並合併功能相同的重複節點。合併時會出現通知，可以用 `Ctrl+Z` 還原。沒有連接的節點，不會自動刪除。想自己排列時，請維持關閉。

有尚未儲存的更改時，名稱旁邊會出現圓點。切換到其他工作流程時，會詢問是否可以捨棄。

### 用表單使用

編輯器在節點很多時，會變得難以理解。因此可以建立只收集使用時常常調整的項目的「表單」。

1. 在編輯器中，對項目（欄位）按右鍵，選擇 **{{ui:workflows.node.addToForm}}**。
2. 左側面板的 **{{ui:workflows.panel.workflow}}** 分頁中，會排列出該項目。
3. 按下 **{{ui:workflows.form.editForm}}**，就可以調整順序或移除。

只改變提示詞或尺寸，並多次執行時很方便。已連接的項目會顯示為「{{ui:workflows.form.connected}}」。

在 **{{ui:workflows.panel.details}}** 分頁，可以填寫名稱、作者、標籤、說明等。在 **{{ui:workflows.panel.data}}** 分頁，可以查看並複製工作流程的內容（JSON）。

### 工作流程程式庫

![工作流程程式庫](shot:workflows-library)

按下左側面板最上方、生成按鈕上方的 **{{ui:workflows.library.button}}** 卡片（會顯示目前開啟的工作流程名稱），就會開啟清單。

- **{{ui:workflows.library.recent}}**: 最近開啟的項目。
- **{{ui:workflows.library.yours}}**: 自己儲存的項目。
- **{{ui:workflows.library.defaults}}**: 一開始就有的範例。範例請先用 **{{ui:workflows.library.copyToMine}}** 複製成自己的，再進行修改。

可以搜尋、用標籤篩選，以及更改排列順序。用 **{{ui:workflows.library.open}}** 開啟，用垃圾桶按鈕刪除。**{{ui:workflows.library.new}}** 與 **{{ui:workflows.library.upload}}** 也在這裡。

### 匯出與讀入

- 用 **{{ui:workflows.toolbar.download}}**，可以將工作流程匯出為 JSON 檔案。
- 用 **{{ui:workflows.toolbar.loadFromFile}}**（或 **{{ui:workflows.library.upload}}**），可以讀入匯出的檔案，或其他人製作的檔案。
- 讀入的檔案如果使用了尚未安裝的擴充功能的節點，會出現名為「{{ui:workflows.import.title}}」的對話方塊。安裝並重新啟動 ComfyUI 後，該工作流程會自動開啟。
- 也可以從用工作流程製作的圖像中取出工作流程。在圖庫的圖像上按右鍵，選擇 **{{ui:gallery.menu.loadWorkflow}}**（在檢視器中開啟圖像時，也可以用 `W` 鍵）。即使是一般生成的圖像，也能從設定組合出相同的流程。**{{ui:gallery.menu.sendToWorkflow}}** 是在要將該圖像作為工作流程的輸入圖像使用時選擇。

> 其他人製作的工作流程，是在你的電腦上運作的程式的連接。請不要讀入來源不明的檔案。

## 範本

**{{ui:workflows.panel.templates}}** 分頁中，並排著常用組合的範本。

- 按下 **{{ui:workflows.templates.open}}**，會作為新的工作流程開啟。
- 按下 **{{ui:workflows.templates.add}}**，會加到目前編輯器的右側。
- 模型與圖像，在開啟之後再選擇。

需要擴充功能的範本，會出現「需要的擴充功能」欄。按下 **{{ui:workflows.templates.installPacks}}** 安裝，並用 **{{ui:workflows.templates.restartFirst}}** 按鈕重新啟動 ComfyUI 後，就能開啟。用 ComfyUI 本體節點組成的範本，在 ComfyUI 開始運作後就能開啟。

準備好的範本如下。

| 範本 | 做什麼 | 需要的擴充功能 |
|---|---|---|
| **{{ui:workflows.templates.text2image.title}}** | 從模型與提示詞製作 1 張並儲存的基本形式。 | 無 |
| **{{ui:workflows.templates.text2imageUpscale.title}}** | 將以 1024 製作的圖像放大到 2048 並儲存。 | 無 |
| **{{ui:workflows.templates.loraStack.title}}** | 將 LoRA 依序連接到模型，加入畫風與細節。 | 無 |
| **{{ui:workflows.templates.image2image.title}}** | 以手邊的圖像為基礎，用不同的提示詞重畫。 | 無 |
| **{{ui:workflows.templates.upscale.title}}** | 用放大用的模型，將圖像高精細地放大。 | 無 |
| **{{ui:workflows.templates.controlnetCanny.title}}** | 取出圖像的輪廓線，維持其形狀並重新繪製。 | 無 |
| **{{ui:workflows.templates.imageToVideo.title}}** | 讓 1 張圖像動起來，製作成短影片。 | 無（需要影片用的模型） |
| **{{ui:workflows.templates.videoWan22.title}}** | 用 ComfyUI 本體的節點，從文字製作短影片。長度、尺寸、取樣器也可以自由更改。 | 無（需要影片用的模型） |
| **{{ui:workflows.templates.videoWan22Image.title}}** | 以相同的組法，從所選的圖像製作影片。 | 無（需要影片用的模型） |
| **{{ui:workflows.templates.musicAceStep.title}}** | 從風格標籤與歌詞製作歌曲。 | 無（需要音樂用的模型） |
| **{{ui:workflows.templates.voiceRead.title}}** | 製作朗讀文字的語音，並以 MP3 儲存。 | 無（需要語音的引擎與模型） |
| **{{ui:workflows.templates.videoNarration.title}}** | 選擇圖庫的影片，將朗讀的語音作為該影片的聲音，並儲存為新的影片。 | 無（需要語音的引擎與模型） |
| **{{ui:workflows.templates.filmGrain.title}}** | 為製作好的圖像加上像照片一樣的顆粒。 | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.faceRig.title}}** | 改變臉部照片的表情、視線與脖子的朝向。 | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.tiledUpscale.title}}** | 放大到 2048 後，逐個拼貼重畫以補上細節。 | ComfyUI_UltimateSDUpscale |
| **{{ui:workflows.templates.styleReference.title}}** | 將參考圖像的畫風，轉移到提示詞的圖像上。 | ComfyUI_IPAdapter_plus（以及它的模型） |
| **{{ui:workflows.templates.faceDetailer.title}}** | 找出製作好的圖像中的臉，以高解析度重畫。 | Impact Pack 與 Impact Subpack |
| **{{ui:workflows.templates.removeBackground.title}}** | 只留下人或物體，將背景變透明。 | ComfyUI-RMBG |
| **{{ui:workflows.templates.whiteBackground.title}}** | 只留下人或物體，將背景變成純白。適合作為防止參考圖像的背景顏色轉移到圖像的前置作業。 | ComfyUI-RMBG |
| **{{ui:workflows.templates.poseControl.title}}** | 取出作為參考的圖像中人物的姿勢，畫出相同姿態的新圖像。 | comfyui_controlnet_aux（以及 OpenPose 用的 ControlNet 模型） |
| **{{ui:workflows.templates.captionToImage.title}}** | 將作為參考的圖像內容轉成文字，作為提示詞重新繪製。 | Florence-2 的擴充功能 |
| **{{ui:workflows.templates.characterReference.title}}** | 將角色的圖像改成白色背景作為參考圖像，統一頭髮、眼睛與服裝，繪製新的場景。CFG 是適合參考圖像的偏低數值。 | ComfyUI-RMBG 與 ComfyUI_IPAdapter_plus |
| **{{ui:workflows.templates.characterPose.title}}** | 角色的外觀取自參考圖像，姿態取自火柴人（OpenPose）來繪製。 | 上面 2 個，加上 comfyui_controlnet_aux 與 OpenPose 用的 ControlNet 模型 |

使用角色的範本，是為了想用工作流程細部調整[登錄並使用角色](04-improve.md)的功能時而準備的。通常使用在生成分頁登錄的角色就足夠了。火柴人的姿勢，可以用[畫布](05-canvas.md)的「{{ui:pose.title}}」來製作。

## 擴充功能（自訂節點）

在 **{{ui:workflows.panel.packs}}** 分頁，可以為 ComfyUI 新增或移除擴充功能。擴充功能是用來增加節點的附加零件。安裝後的節點，會出現在新增節點清單的 **{{ui:workflows.categories.extension}}** 中。

一開始，會並排著「{{ui:workflows.packs.whatToDo}}」的大型磚塊。選擇想做的事（修好臉、去除背景、放大並高精細化等），就會附上說明，並排出符合的擴充功能。

1. 按下想使用的擴充功能的 **{{ui:workflows.packs.install}}**。
2. 安裝完成後，會顯示「{{ui:workflows.packs.restartNeeded}}」。請按下 **{{ui:workflows.packs.restart}}**。
3. 重新啟動完成後，就能使用該擴充功能的節點與範本。

有些擴充功能附有注意事項，例如「需要 Git」「安裝需要花費時間與容量」「已停止更新」等。安裝之前請先閱讀。

目錄中沒有的項目，可以用 **{{ui:workflows.packs.byAddress}}**，輸入 GitHub 的位址（https://github.com/使用者名稱/名稱 的形式）來安裝。其他已安裝的擴充功能，會顯示在 **{{ui:workflows.packs.others}}**。不需要的擴充功能可以用 **{{ui:workflows.packs.remove}}** 移除（為了確認，需要再按一次）。

已安裝的擴充功能，不在工作流程的畫面也能隨時查看。按下左側邊欄的 **{{ui:app.nav.extensions}}**（拼圖圖示），就會開啟 **{{ui:workflows.packs.mgr.title}}**。公開的擴充功能會以卡片排列，左側的清單可以依 **{{ui:workflows.packs.mgr.installed}}**・**{{ui:workflows.packs.mgr.notInstalled}}**・目的別來縮小範圍，上方的欄位可以用名稱、作者、說明來搜尋。**{{ui:workflows.packs.mgr.sort.label}}** 一開始是依 **{{ui:workflows.packs.mgr.sort.downloads}}** 由多到少。卡片上會顯示作者、版本、更新日、下載次數，已安裝的會顯示 **{{ui:workflows.packs.installed}}**。尚未安裝的，可以用卡片的 **{{ui:workflows.packs.install}}** 安裝。按下卡片，右側會展開詳細資訊，可以確認 **{{ui:workflows.packs.mgr.license}}** 與發布來源，也可以進行 **{{ui:workflows.packs.remove}}**。清單中沒有的擴充功能，可以在上方的 **{{ui:workflows.packs.mgr.addTitle}}** 輸入 GitHub 的位址來安裝。安裝或移除之後，按下同一個畫面中出現的 **{{ui:workflows.packs.restart}}** 就會反映。各卡片的詳細資訊中有 **{{ui:agent.ask.button}}** 按鈕，在搜尋欄輸入詞彙時也會出現 **{{ui:agent.ask.resultsButton}}**。按下後，AI 助理會說明該擴充功能是做什麼的、怎麼使用（請見[AI 助理與設定](09-assistant-settings.md)）。

詳細資訊的 **{{ui:workflows.packs.version.label}}**，會顯示目前安裝的版本。只有在該擴充功能的儲存庫公開了版本時，才會出現 **{{ui:workflows.packs.version.change}}**，按下後會排列出可選的版本，用 **{{ui:workflows.packs.version.apply}}** 更換成該版本。目前安裝的版本會顯示 **{{ui:workflows.packs.installed}}**。沒有公開版本的擴充功能，不會出現這個按鈕。要反映更改，請按同一個畫面的 **{{ui:workflows.packs.restart}}**。已知其他擴充功能或 ComfyUI 不支援的版本，會顯示 **{{ui:workflows.packs.version.deprecated}}**，並寫出是哪些不支援。自己安裝的擴充功能，無法從這裡更改版本。

ComfyUI 的版本，也可以在同一個畫面中更改。按下清單最前面的 **{{ui:workflows.packs.version.comfyTitle}}** 卡片，用右側出現的 **{{ui:workflows.packs.version.change}}** 排列出可選的版本。按下 **{{ui:workflows.packs.version.apply}}** 之後，再按一次 **{{ui:workflows.packs.version.confirm}}**，就會開始切換。因為會重新安裝所有已安裝的擴充功能，需要數分鐘，且在完成之前無法製作圖像。新版本無法啟動時，會回到原本的版本。

> 擴充功能是在你的電腦上運作的程式。請不要安裝來源不明的項目。

> 連接的是不由應用程式管理的 ComfyUI 時，無法從這個畫面安裝。請在該 ComfyUI 那邊安裝。

[修飾與沿用圖像](04-improve.md)的「{{ui:cutout.menu}}」與「{{ui:facefix.menu}}」等使用擴充功能的功能，在需要時也會同樣引導安裝。
