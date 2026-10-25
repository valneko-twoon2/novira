# 畫布

![畫布分頁的整體畫面。中央是畫布，右下方是圖層清單](shot:canvas)

**{{ui:app.tabs.canvas}}** 分頁是用來「繪製、擺放、只重畫一部分」圖像的工作台。可以放置圖像並向外擴展、在想重畫的地方加上遮罩，或用火柴人決定姿勢。

畫面分成 3 個部分。

- 左側：與生成分頁相同設定的面板（提示詞、模型、尺寸等）。在畫布中，會多出 **{{ui:params.compositing.title}}** 的項目。
- 中央：畫布。上方排列著工具的按鈕。
- 右側：放入圖像的 **{{ui:canvas.layers.title}}** 清單。

在什麼都沒有的狀態下按下 **{{ui:params.invoke.invoke}}**，會在虛線框（生成範圍）中，像平常一樣製作圖像。畫布真正發揮本領，是在放入圖像或草稿的時候。 圖層和遮罩會自動儲存，重新開啟應用程式時會恢復原狀（復原歷程不會儲存）。

## 擺放與繪製圖像

在畫布上放置圖像的方法有好幾種。

- 用筆刷繪製。沒有選取圖層時，會自動建立{{ui:canvas.add.raster}}。
- 將圖庫的圖像拖曳到畫布。會出現選擇擺放位置（點陣、控制、重繪遮罩等）的框，請放到那裡。
- 按 `Ctrl+V` 可將剪貼簿中的圖像貼上為新的點陣圖層（同時也會儲存到圖庫）。
- 在圖庫的圖像上按右鍵（在檢視器中是筆的圖示），從 **{{ui:gallery.menu.sendToCanvas}}** 選擇目的地。

目的地如下。

| 目的地 | 會變成什麼 |
|---|---|
| **{{ui:gallery.canvas.newCanvasRaster}}** | 先將畫布清空，以和那張圖像相同的大小開始。 |
| **{{ui:gallery.canvas.newCanvasControl}}** | 同樣是重新開始，但圖像會成為控制圖層。 |
| **{{ui:gallery.canvas.raster}}** | 以點陣圖層的形式，加到目前的畫布。 |
| **{{ui:gallery.canvas.control}}** | 以控制圖層的形式加入。 |
| **{{ui:gallery.canvas.inpaint}}** | 以重繪遮罩的形式加入。 |
| **{{ui:gallery.canvas.regional}}** | 作為區域引導的參考圖像加入（請見[區域引導](#區域引導目前還不能使用)）。 |

## 工具

上方的工具列排列著各種工具。也可以用鍵盤的字母鍵切換。

| 工具 | 按鍵 | 用途 |
|---|---|---|
| **{{ui:canvas.tool.brush}}** | `B` | 繪製圖像。顏色用工具列的顏色按鈕更改。 |
| **{{ui:canvas.tool.eraser}}** | `E` | 擦掉畫過的地方。 |
| **{{ui:canvas.tool.mosaic}}** | `M` | 把塗抹的地方變成馬賽克（用來遮擋）。方塊大小用工具列的數字來更改。只對有圖像的圖層有效。 |
| **{{ui:canvas.tool.rect}}** | `U` | 塗滿矩形。 |
| **{{ui:canvas.tool.lasso}}** | `L` | 圈出自由形狀並以顏色填滿（在重繪遮罩上，則會把圈起的範圍設為遮罩）。 |
| **{{ui:canvas.tool.pose}}** | `O` | 在控制圖層上放置火柴人姿勢，並移動關節（見下方「在畫布上製作姿勢」）。 |
| **{{ui:canvas.tool.move}}** | `V` | 移動圖層。方向鍵可將所選圖層每次移動 1 px（按住 Shift 為 10 px）。 |
| **{{ui:canvas.tool.bbox}}** | `C` | 移動生成範圍（邊界框）、改變大小。 |
| **{{ui:canvas.tool.view}}** | `H` | 移動顯示的位置。 |
| **{{ui:canvas.tool.colorPicker}}** | `I` | 從圖像中吸取顏色。 |

此外，還可以進行下列操作。

- 筆刷的粗細，用工具列的 **{{ui:canvas.toolbar.brushWidth}}**，或 `[` 與 `]` 鍵來更改。按 `Q` 會與上一次使用的工具互相切換。
- 放大、縮小用滑鼠滾輪，或 `+` 與 `-` 鍵。按 `Ctrl+0` 可以看到整體，按 `Ctrl+1` 則是實際大小（100%）。
- 要移動顯示的位置，可以按住 `Space` 並拖曳，或按住滾輪按鈕並拖曳。
- 用 **{{ui:canvas.toolbar.undo}}**（`Ctrl+Z`）與 **{{ui:canvas.toolbar.redo}}**（`Ctrl+Shift+Z`），可以復原與重做所畫的內容。

齒輪的 **{{ui:canvas.settings.title}}** 中，有顯示格線、將生成範圍外側變暗的顯示、讓畫的線條只限於生成範圍內的設定、將顯示中的點陣圖層合併為 1 個的操作等。

## 生成範圍（邊界框）

畫布中的虛線框，就是「這次要製作圖像的範圍」。每次生成，只會製作這個框內的內容，而它的大小就是圖像的大小。

- 切換到 **{{ui:canvas.tool.bbox}}**（`C`），拖曳來移動框。拖曳角或邊，大小就會改變。
- 用左側面板的 **{{ui:params.image.bboxWidth}}** 與 **{{ui:params.image.bboxHeight}}**，也能決定大小。
- 用 **{{ui:canvas.actions.fitBboxToLayers}}**（`Shift+C`），可以讓框對齊放置的圖像。

## 圖層

右下方的 **{{ui:canvas.layers.title}}**，會以清單顯示放在畫布上的東西。用 **{{ui:common.add}}** 按鈕新增。

![打開圖層的「新增」選單的畫面](shot:canvas-add-layer)

圖層有作用不同的種類。

| 種類 | 作用 |
|---|---|
| **{{ui:canvas.add.raster}}** | 一般的圖像圖層。用來繪製或放置圖像。這裡的內容，會成為「原圖」。 |
| **{{ui:canvas.add.control}}** | 作為形狀、線條、姿勢等線索的圖像。它會成為生成的指示，不會成為圖像的內容。 |
| **{{ui:canvas.add.inpaint}}** | 用塗抹的方式，指定「要重畫這裡」的範圍。 |
| **{{ui:canvas.add.regional}}** | 依位置指定不同提示詞的圖層。目前的桌面版，無法用於生成。 |
| **{{ui:canvas.add.globalRef}}** | 模仿整張圖像氛圍的參考圖像。與生成分頁的參考圖像相同。 |

在圖層的清單中，可以進行下列操作。

- 用眼睛圖示切換顯示與隱藏，用鎖頭圖示切換鎖定。隱藏的圖層不會用於生成。鎖定的圖層無法繪製。
- 連按兩下名稱，可以更改名稱。
- 按右鍵，可以進行複製、排序（往前後移動；同類圖層也可以在清單中拖曳來調整順序）、**{{ui:canvas.entityMenu.flipHorizontal}}**、**{{ui:canvas.entityMenu.flipVertical}}**、**{{ui:canvas.entityMenu.rotateRight}}**、**{{ui:canvas.entityMenu.rotateLeft}}**、**{{ui:canvas.entityMenu.scaleUp}}**、**{{ui:canvas.entityMenu.scaleDown}}**、**{{ui:canvas.pose.random}}**（僅限控制圖層）、轉換成其他種類、複製到剪貼簿、**{{ui:canvas.entityMenu.saveToGallery}}**、**{{ui:canvas.entityMenu.exportToFile}}**、刪除。
- 從 **{{ui:canvas.layers.more}}**（「…」），也可以將顯示中的點陣圖層合併為 1 個，或刪除所有圖層。

![圖層的右鍵選單](shot:canvas-layer-menu)

在選取的圖層下方，會展開該圖層的設定。

- {{ui:canvas.add.inpaint}}：遮罩的顏色與塗抹的花紋（僅限畫面上的顯示效果）、**{{ui:canvas.mask.denoiseLimit}}**（開啟並調低後，即使在遮罩內，也比較容易保留原圖）。右鍵選單中的 **{{ui:canvas.entityMenu.invertMask}}** 可以把生成範圍內被遮罩和未遮罩的部分互換。
- {{ui:canvas.add.control}}：請見下一個「{{ui:canvas.add.control}}」的項目。

## 會如何重畫

在畫布上按下 **{{ui:params.invoke.invoke}}**，應用程式會查看生成範圍中的內容，自動決定製作圖像的方式。不需要自己選擇。

| 生成範圍中的狀態 | 製作方式 |
|---|---|
| 顯示中的點陣圖層上，什麼都沒有畫 | 從文字生成圖像。 |
| 點陣圖層上，只有一部分被填滿 | 補上空白的部分並向外擴展（擴繪）。空白的部分會先用顏色填滿。 |
| 整體都被填滿，且重繪遮罩上沒有塗抹 | 以現在的圖像為基礎，重新繪製（圖像轉圖像）。 |
| 整體都被填滿，且重繪遮罩上有塗抹 | 只重畫遮罩的部分（重繪）。遮罩外側維持原圖。 |

圖像轉圖像時改變的程度，用左側面板的 **{{ui:params.image.strength}}** 決定。0 是維持原樣，1 則是完全重畫。

在擴繪時，空白的部分要用什麼填滿，在左側面板 **{{ui:params.compositing.title}}** 的 **{{ui:params.compositing.infillTitle}}** 中選擇。選擇 **{{ui:params.compositing.infill.color}}** 時，會用選擇的顏色（黑、白、灰等）填滿。選擇其他項目，則會融合周圍的顏色來填滿。接縫的模糊程度，用 **{{ui:params.compositing.maskBlur}}** 決定。

> 重繪用一般的模型就能直接使用，不需要專用的「重繪模型」。

## 決定是否採用結果（暫存）

在畫布上製作的圖像，不會立刻放進畫布。它會疊在生成範圍上顯示，並用下方的列（**{{ui:canvas.staging.title}}**）來決定是否採用。

| 按鈕 | 做什麼 |
|---|---|
| 左右箭頭（`←` `→`） | 製作多張時，查看下一張或上一張的圖像。 |
| **{{ui:canvas.staging.accept}}**（`Enter`） | 將這張圖像，以新的點陣圖層放入畫布。其他圖像會被捨棄。 |
| **{{ui:canvas.staging.hideResults}}** | 隱藏結果，與原圖比較。 |
| **{{ui:canvas.staging.saveToGallery}}** | 將這張圖像儲存到圖庫。 |
| **{{ui:canvas.staging.discard}}** | 只捨棄這張圖像。 |
| **{{ui:canvas.staging.discardAll}}**（`Esc`） | 全部捨棄。 |

> 結果的圖像不會直接排列在圖庫中。想留在圖庫的圖像，請先按下 **{{ui:canvas.staging.saveToGallery}}**。捨棄的圖像會消失。

結果列最左邊的把手（⋮⋮），是用來將圖像拖曳到其他地方的。

## 控制圖層

控制圖層是「依照這個形狀、這條線、這個姿勢來畫」的線索。可以放入線稿、輪廓、姿勢的圖像等。

要使用的話，需要符合主要模型的 ControlNet 模型。安裝方法請見[模型](08-models.md)這一章。選取圖層，在設定中選擇 **{{ui:common.model}}**。如果沒有模型，生成的地方會出現「控制圖層 1 沒有模型」等訊息，而無法製作。

設定如下。

- **{{ui:canvas.control.weight}}**：依循線索的強度。
- **{{ui:canvas.control.begin}}** 與 **{{ui:canvas.control.end}}**：從生成的幾成到幾成之間發揮效果。
- **{{ui:canvas.control.controlMode}}**：有 **{{ui:canvas.control.mode.balanced}}** 與 **{{ui:canvas.control.mode.moreControl}}**。**{{ui:canvas.control.mode.morePrompt}}** 目前的運作方式與 **{{ui:canvas.control.mode.balanced}}** 相同。
- **{{ui:canvas.control.filter}}**：將圖像轉換成線條或深度等線索用的圖像。這是在應用程式內進行的簡易轉換。用 **{{ui:canvas.control.process}}** 試試看，滿意的話，用 **{{ui:common.apply}}** 反映到圖像上。

## 製作姿勢（火柴人）

![用火柴人決定姿勢的對話框](shot:pose)

可以移動火柴人來決定姿勢。用文字指定姿勢卻不順利時很方便。

1. 在 **{{ui:app.tabs.canvas}}** 分頁，按下圖層的 **{{ui:common.add}}**，選擇 **{{ui:pose.menu}}**。
2. 從 **{{ui:pose.preset}}** 選擇接近的姿勢（{{ui:pose.preset.standing}}、{{ui:pose.preset.armsUp}}、{{ui:pose.preset.sitting}}、{{ui:pose.preset.walking}}）。
3. 拖曳關節的圓點，改變姿態。選取圓點後，也可以用方向鍵移動（按住 `Shift` 會大幅移動）。用 **{{ui:pose.mirror}}** 可以左右翻轉，用 **{{ui:pose.reset}}** 會回到最初的範本。
4. 選擇 **{{ui:pose.size}}**。通常用畫布的大小就可以。
5. 按下 **{{ui:pose.use}}**。

姿勢會以控制圖層的形式，放入畫布。如果畫布是空的，會以那個大小重新開始。

要使用的話，需要支援 OpenPose 的 ControlNet 模型。如果已安裝，應用程式會自動選為圖層的模型。沒有安裝時，會以通知告知。安裝模型後，請在圖層的設定中選擇。

> 只能決定 1 個人的姿勢。無法決定手指或臉的朝向，所以臉與手請用提示詞指定。

> 姿勢的效果，由圖層的 **{{ui:canvas.control.weight}}** 決定。姿勢的圖層，一開始就設定為最大的強度，並且從頭到尾都發揮效果。想讓姿勢有更多自由度時，請調低。

### 在畫布上製作姿勢

![用姿勢工具在畫布上放置了火柴人](shot:canvas-pose)

使用 **{{ui:canvas.tool.pose}}** 工具（`O`），可以直接在畫布上製作姿勢。放置好的姿勢，之後可以隨時反覆修改。

- 點擊空白處，會放置一個站立的火柴人。沒有選取控制圖層時，會新增一個控制圖層，並設定姿勢用的強度，以及支援 OpenPose 的模型（若已安裝）。
- 拖曳關節的圓點，會連同其前端的肢體一起轉動（骨骼的長度不變）。拖曳脖子，整個身體都會移動。按住 `Shift` 拖曳，則只移動該關節。
- 按住 `Alt` 點擊關節，可以隱藏該關節，或再次顯示（用於伸出畫面之外的肢體等）。
- 按 `R` 鍵或列中的 **{{ui:canvas.pose.random}}** 按鈕，選取圖層的姿勢會變成新的隨機姿勢。可以隨意反覆按，所以能一直試到滿意為止。
- 用姿勢工具列中的數字與閃電按鈕，可以更換姿勢並連續生成指定張數的圖像（最多 16 張）。每個姿勢的種子也會隨之改變，所以相同的設定也能得到各種姿態的圖像。如果目前無法生成，會顯示原因，且不會開始。
- 一個圖層中可以放置任意多個人。左右翻轉、旋轉、放大與縮小，可以從圖層的右鍵選單進行。
- 也可以用文字來要求。在開啟 **{{ui:app.tabs.canvas}}** 分頁的狀態下開啟 AI 助理，說出「正在奔跑的姿勢」「舉起左手」之類的描述，就會放置人形（最多 4 個）。放置之後再說「再稍微前傾一點」，它會修改該姿勢。所要求的姿勢是根據文字推測出來的，如果不符合預期，請拖曳關節來修改。
- 也可以從圖像中的人物產生。在圖庫的圖像上按右鍵，選擇 **{{ui:canvas.poseFromImage.menu}}**，或按下姿勢工具列中同名的按鈕，就會讀取圖中人物的骨架並作為火柴人放置（最多 4 人）。放置後的姿勢可以像一般姿勢一樣修改。使用它需要擴充功能（comfyui_controlnet_aux），如果尚未安裝，會當場提示安裝。第一次讀取時，下載模型需要一些時間。人物太小或被遮住時，可能找不到。
- 點選姿勢工具列中的 **{{ui:canvas.pose.presets}}** 按鈕會開啟一個視窗，左側是類別，右側是每個姿勢的卡片。卡片在與生成範圍形狀相同的框中畫出 OpenPose 火柴人。{{ui:canvas.pose.group.panel}}（遠近景別、兩個人、三人以上、日常場景、戲劇與情緒）還決定了人物的位置和大小，並會取代所選圖層的所有姿勢。{{ui:canvas.pose.group.standard}}和{{ui:canvas.pose.group.manga}}會取代所選圖層的第一個姿勢，位置和大小維持不變；如果沒有姿勢，則放置一個新的。舉起手臂或踢腿而超出範圍的姿勢會縮小到框內。
- 姿勢工具列中的 **{{ui:canvas.pose3d.menu}}** 按鈕可以用 3D 編輯姿勢（所選控制圖層的第一個姿勢；沒有時從站立的人偶開始）。拖曳關節時，骨骼長度保持不變，也可以讓骨骼轉向深處或前方。拖曳背景可轉動身體，滾輪可縮放。**{{ui:canvas.pose3d.front}}**、**{{ui:canvas.pose3d.side}}**、**{{ui:canvas.pose3d.back}}**、**{{ui:canvas.pose3d.top}}** 按鈕可切換到固定視角。按下 **{{ui:canvas.pose3d.apply}}** 後，目前看到的形狀會作為姿勢放到畫布上（深度也會被記住，因此可以再次用 3D 開啟並繼續轉動）；不按直接關閉則維持原樣。3D 顯示需要瀏覽器的 WebGL，無法使用時會顯示提示。

![放到畫布之前，先讀取圖像中的姿勢](shot:canvas-pose-from-image)

![選擇了「兩個人」類別後的「常用姿勢與構圖」視窗](shot:canvas-pose-presets)

![用 3D 編輯姿勢的對話框](shot:canvas-pose-3d)

想從照片中取出姿勢時，可以使用[工作流程](06-upscaling-workflows.md)的範本「{{ui:workflows.templates.poseControl.title}}」。

## 區域引導目前還不能使用

**{{ui:canvas.add.regional}}** 雖然在畫面上有準備，但目前的桌面版無法用於生成。如果有填了色的區域引導圖層，生成會被拒絕，並出現失敗的訊息（英文）。在畫布上生成時，請將區域引導的圖層隱藏或刪除。

## 儲存與收尾

- 要將畫布的圖像儲存到圖庫，請按下上方工具列的 **{{ui:canvas.toolbar.saveToGallery}}**（磁碟的圖示）。位於生成範圍內、顯示中的點陣圖層，會合併為 1 張儲存。
- 要只儲存 1 個圖層，請在圖層上按右鍵，選擇 **{{ui:canvas.entityMenu.saveToGallery}}**。
- **{{ui:canvas.settings.title}}** 中，還有 **{{ui:canvas.actions.clearCanvas}}**、**{{ui:canvas.actions.clearHistory}}**、**{{ui:canvas.actions.clearStaging}}**。**{{ui:canvas.actions.clearCanvas}}** 會清除全部的圖層。

修飾圖像的功能，在[修飾與沿用圖像](04-improve.md)中也有。「{{ui:gallery.menu.segment}}」的結果，可以傳送到畫布，進一步重畫。
