# 畫布

![畫布分頁的整體畫面。中央是畫布，右下是圖層的清單](shot:canvas)

**{{ui:app.tabs.canvas}}** 分頁是用來「繪製、放置、只重畫一部分」圖像的工作台。可以放置圖像並向外擴展、在想重畫的地方加上遮罩，或用火柴人決定姿勢。

畫面分成 3 個部分。

- 左側：與生成分頁相同設定的面板（提示詞、模型、尺寸等）。在畫布中，會多出 **{{ui:params.compositing.title}}** 的項目。
- 中央：畫布。上方並排著工具的按鈕。
- 右側：放入圖像的 **{{ui:canvas.layers.title}}** 清單。

在什麼都沒有的狀態下按下 **{{ui:params.invoke.invoke}}**，會在虛線框（生成範圍）之中，像平常一樣製作圖像。畫布真正的本領，在於把圖像或草稿放進去的時候。 圖層與遮罩會自動儲存，重新開啟應用程式時會恢復原狀（復原的記錄不會儲存）。

## 放置、繪製圖像

在畫布上放置圖像的方法有好幾種。

- 用筆刷繪製（先選擇 **{{ui:canvas.tool.brush}}**，或按 `B`）。如果沒有選取圖層，會自動建立{{ui:canvas.add.raster}}。
- 將圖庫的圖像拖曳到畫布。會出現讓你選擇放置位置（點陣、控制、重繪遮罩等）的方框，請放開在那裡。
- 用 `Ctrl+V`，將剪貼簿的圖像貼上為新的點陣圖層（也會儲存到圖庫）。
- 在圖庫的圖像上按右鍵（在檢視器中是畫筆圖示），從 **{{ui:gallery.menu.sendToCanvas}}** 選擇目的地。

目的地如下。

| 目的地 | 會變成什麼 |
|---|---|
| **{{ui:gallery.canvas.newCanvasRaster}}** | 先將畫布清空，以與該圖像相同的大小開始。 |
| **{{ui:gallery.canvas.newCanvasControl}}** | 同樣是重新開始，但圖像會成為控制圖層。 |
| **{{ui:gallery.canvas.raster}}** | 在目前的畫布上，加入為點陣圖層。 |
| **{{ui:gallery.canvas.control}}** | 加入為控制圖層。 |
| **{{ui:gallery.canvas.inpaint}}** | 加入為重繪遮罩。 |
| **{{ui:gallery.canvas.regional}}** | 加入為區域引導的參考圖像（請見[區域引導](#區域引導)）。 |

## 工具

上方的列並排著工具。也可以用鍵盤的字母鍵切換。啟動應用程式時，選取的是 **{{ui:canvas.tool.view}}**，所以一開始在畫布上拖曳，只會讓顯示位置移動，不會畫出任何東西。

| 工具 | 按鍵 | 用途 |
|---|---|---|
| **{{ui:canvas.tool.brush}}** | `B` | 繪製圖像。顏色用列上的顏色按鈕更改。 |
| **{{ui:canvas.tool.eraser}}** | `E` | 擦掉畫過的地方。 |
| **{{ui:canvas.tool.mosaic}}** | `M` | 將塗抹的地方變成馬賽克（用在想遮住的地方）。粗細用列上的數字更改。只對有圖像的圖層有效。 |
| **{{ui:canvas.tool.rect}}** | `U` | 塗滿方形。 |
| **{{ui:canvas.tool.lasso}}** | `L` | 圈出自由的形狀，將其中用顏色塗滿（在遮罩上則會成為遮罩範圍）。 |
| **{{ui:canvas.tool.pose}}** | `O` | 在控制圖層放置火柴人的姿勢，並移動關節（下方的「在畫布上製作姿勢」）。 |
| **{{ui:canvas.tool.move}}** | `V` | 移動圖層。用方向鍵可以讓所選的圖層一次移動 1 px（按住 Shift 則一次 10 px）。 |
| **{{ui:canvas.tool.bbox}}** | `C` | 移動生成範圍（邊界框）、更改大小。 |
| **{{ui:canvas.tool.view}}** | `H` | 移動顯示位置。 |
| **{{ui:canvas.tool.colorPicker}}** | `I` | 從圖像中吸取顏色。 |
| **{{ui:canvas.tool.bucket}}** | `K` | 填滿與點選位置顏色相近的區域。要將多接近的顏色視為相近，由列上的 **{{ui:canvas.toolbar.bucketTolerance}}** 決定。 |

另外還可以進行以下操作。

- 筆刷的粗細，用列上的 **{{ui:canvas.toolbar.brushWidth}}**，或 `[` 與 `]` 鍵更改。用 `Q` 可以與前一個使用的工具切換。
- 放大、縮小，用滑鼠滾輪，或 `+` 與 `-` 鍵。`Ctrl+0` 可以看到整體，`Ctrl+1` 為實際大小（100%）。
- 要移動顯示位置，可以按住 `Space` 拖曳，或按住滾輪按鈕拖曳。
- 用 **{{ui:canvas.toolbar.undo}}**（`Ctrl+Z`）與 **{{ui:canvas.toolbar.redo}}**（`Ctrl+Shift+Z`），可以復原或重做畫過的內容。

齒輪 **{{ui:canvas.settings.title}}** 中，有顯示格線、將生成範圍外側變暗的顯示、讓畫過的線條只留在生成範圍內的設定、將顯示中的點陣圖層合併為一個的操作等。

## 生成範圍（邊界框）

畫布中的虛線框，就是「這次要製作圖像的範圍」。每次生成時，只會製作這個框之中的內容，其大小就是圖像的大小。

- 切換到 **{{ui:canvas.tool.bbox}}**（`C`），拖曳框即可移動。拖曳角或邊，大小就會改變。
- 也可以用左側面板的 **{{ui:params.image.bboxWidth}}** 與 **{{ui:params.image.bboxHeight}}** 決定大小。
- 用 **{{ui:canvas.actions.fitBboxToLayers}}**（`Shift+C`），讓框符合已放置的圖像。

## 圖層

右下的 **{{ui:canvas.layers.title}}**，會以清單顯示放在畫布上的東西。用 **{{ui:common.add}}** 按鈕新增。

![展開圖層「新增」選單的樣子](shot:canvas-add-layer)

圖層有作用各不相同的種類。

| 種類 | 作用 |
|---|---|
| **{{ui:canvas.add.raster}}** | 一般的圖像圖層。用來繪製或放置圖像。放在這裡的東西，會成為「原圖」。 |
| **{{ui:canvas.add.control}}** | 作為形狀、線條、姿勢等線索的圖像。它會成為生成的指示，不會成為圖像的內容。 |
| **{{ui:canvas.add.inpaint}}** | 用塗抹來指定「要重畫這裡」的範圍。 |
| **{{ui:canvas.add.regional}}** | 依場所指定不同提示詞的圖層（請見[區域引導](#區域引導)）。 |
| **{{ui:canvas.add.globalRef}}** | 模仿整張圖像氛圍的參考圖像。與生成分頁的參考圖像相同。 |

在圖層清單中，可以進行以下操作。

- 用眼睛圖示切換顯示與隱藏，用鎖頭圖示切換鎖定。隱藏的圖層不會用於生成。鎖定的圖層無法繪製。
- 連按兩下名稱，可以更改名稱。
- 按右鍵可以進行：複製、調整順序（前後移動。相同種類的圖層，也可以在清單中拖曳來調整順序）、**{{ui:canvas.entityMenu.flipHorizontal}}**、**{{ui:canvas.entityMenu.flipVertical}}**、**{{ui:canvas.entityMenu.rotateRight}}**、**{{ui:canvas.entityMenu.rotateLeft}}**、**{{ui:canvas.entityMenu.scaleUp}}**、**{{ui:canvas.entityMenu.scaleDown}}**、**{{ui:canvas.pose.random}}**（僅限控制圖層）、轉換成其他種類、複製到剪貼簿、**{{ui:canvas.entityMenu.saveToGallery}}**、**{{ui:canvas.entityMenu.exportToFile}}**、刪除。
- 從 **{{ui:canvas.layers.more}}**（「…」），也可以將顯示中的點陣圖層合併為一個，或刪除所有圖層。

![在圖層上按右鍵的選單](shot:canvas-layer-menu)

所選圖層的下方，會展開該圖層的設定。

- {{ui:canvas.add.inpaint}}: 遮罩的顏色與塗抹的花紋（僅影響畫面上的顯示）、**{{ui:canvas.mask.denoiseLimit}}**（開啟後調低，即使在遮罩之中也更容易保留原圖）。右鍵的 **{{ui:canvas.entityMenu.invertMask}}**，可以對調生成範圍中被遮罩的部分與空白的部分。用 **{{ui:canvas.partFix.redraw}}**・**{{ui:canvas.partFix.erase}}**・**{{ui:canvas.partFix.cutOutAction}}**，可以用文字指示重畫塗抹的部分、消除，或去背（[選取範圍來修飾](04-improve.md)）。
- {{ui:canvas.add.control}}: 請見後面的「{{ui:canvas.add.control}}」一節。

## 會怎麼重畫

在畫布上按下 **{{ui:params.invoke.invoke}}** 後，應用程式會查看生成範圍之中的內容，自動決定製作圖像的方式。不需要自己選擇。

| 生成範圍之中的狀態 | 製作方式 |
|---|---|
| 顯示中的點陣圖層上，什麼都沒有畫 | 從文字重新製作（文字轉圖像）。 |
| 點陣圖層上，只有一部分被填滿 | 補上空白的部分並向外擴展（外延繪製）。空白的部分會先用顏色填滿。 |
| 整體都已填滿，且重繪遮罩上沒有塗抹 | 以目前的圖像為基礎重畫（圖像轉圖像）。 |
| 整體都已填滿，且重繪遮罩上有塗抹 | 只重畫遮罩的部分（局部重繪）。遮罩之外維持原圖。 |

圖像轉圖像時改變的程度，由左側面板的 **{{ui:params.image.strength}}** 決定。0 為維持原樣，1 為完全重畫。

外延繪製時，空白的部分要用什麼填滿，可以在左側面板 **{{ui:params.compositing.title}}** 的 **{{ui:params.compositing.infillTitle}}** 中選擇。選 **{{ui:params.compositing.infill.color}}** 時，會用所選的顏色（黑、白、灰等）填滿。選擇其他項目，則會融合周圍的顏色來填滿。接縫的模糊程度由 **{{ui:params.compositing.maskBlur}}** 決定。

> 局部重繪可以直接用一般的模型。不需要專用的「局部重繪用模型」。

## 決定是否採用結果（暫存）

在畫布上製作的圖像，不會立刻放進畫布。它會疊在生成範圍上顯示，並用下方的列（**{{ui:canvas.staging.title}}**）決定是否採用。

| 按鈕 | 做什麼 |
|---|---|
| 左右箭頭（`←` `→`） | 製作了多張時，查看下一張或上一張。還在製作的期間，最後一頁是「生成中」的頁面，製作過程中的樣子只會顯示在這一頁。查看已完成圖像的頁面時，即使下一張完成，顯示也不會切換。 |
| **{{ui:canvas.staging.accept}}**（`Enter`） | 將這張圖像，作為新的點陣圖層放進畫布。其他的圖像會被捨棄。 |
| **{{ui:canvas.staging.hideResults}}** | 隱藏結果，與原圖比較。 |
| **{{ui:canvas.staging.saveToGallery}}** | 將這張圖像儲存到圖庫。 |
| **{{ui:canvas.staging.discard}}** | 只捨棄這張圖像。 |
| **{{ui:canvas.staging.discardAll}}**（`Esc`） | 全部捨棄。 |

> 結果的圖像，維持原狀時不會排列在圖庫中。想留在圖庫的圖像，請先按下 **{{ui:canvas.staging.saveToGallery}}**。捨棄的圖像會消失。

結果列左端的把手（⋮⋮），是用來將圖像拖曳交給其他地方的。

## 控制圖層

控制圖層是「請依照這個形狀、這條線、這個姿勢來畫」的線索。可以放入線稿、輪廓、姿勢的圖像等。

要使用它，需要符合主要模型的 ControlNet 模型。安裝方法請見[模型](08-models.md)這一章。選取圖層，在設定的 **{{ui:common.model}}** 中選擇。如果一直沒有模型，生成處會出現「控制圖層 1 沒有模型」等訊息，而無法製作。

設定如下。

- **{{ui:canvas.control.weight}}**: 依循線索的強度。
- **{{ui:canvas.control.begin}}** 與 **{{ui:canvas.control.end}}**: 在生成的幾成到幾成之間發揮作用。
- **{{ui:canvas.control.controlMode}}**: 有 **{{ui:canvas.control.mode.balanced}}** 與 **{{ui:canvas.control.mode.moreControl}}**。**{{ui:canvas.control.mode.morePrompt}}** 目前的運作與 **{{ui:canvas.control.mode.balanced}}** 相同。
- **{{ui:canvas.control.filter}}**: 將圖像轉換成線條或深度等線索用的圖像。這是在應用程式內進行的簡易轉換。用 **{{ui:canvas.control.process}}** 試做，滿意的話用 **{{ui:common.apply}}** 反映到圖像上。

## 製作姿勢（火柴人）

![用火柴人決定姿勢的對話方塊](shot:pose)

可以移動火柴人來決定姿勢。用文字指定姿勢卻不順利時很方便。

1. 在 **{{ui:app.tabs.canvas}}** 分頁，按下圖層的 **{{ui:common.add}}**，選擇 **{{ui:pose.menu}}**。
2. 從 **{{ui:pose.preset}}** 選擇接近的姿勢（{{ui:pose.preset.standing}}、{{ui:pose.preset.armsUp}}、{{ui:pose.preset.sitting}}、{{ui:pose.preset.walking}}）。
3. 拖曳關節的圓點來改變姿態。選取圓點後，也可以用方向鍵移動（按住 `Shift` 會大幅移動）。用 **{{ui:pose.mirror}}** 可以左右翻轉，用 **{{ui:pose.reset}}** 會回到最初的範本。
4. 選擇 **{{ui:pose.size}}**。通常使用畫布的大小即可。
5. 按下 **{{ui:pose.use}}**。

姿勢會作為控制圖層放進畫布。如果畫布是空的，就會以那個大小重新開始。

要使用它，需要支援 OpenPose 的 ControlNet 模型。如果已安裝，應用程式會自動選為圖層的模型。尚未安裝時，會以通知告知。請在安裝模型後，於圖層的設定中選擇。

> 只能決定 1 個人的姿勢。無法決定手指或臉的朝向，所以臉與手請用提示詞指定。

> 姿勢的效果，由圖層的 **{{ui:canvas.control.weight}}** 決定。姿勢的圖層，一開始就會設定為最大強度、從頭到尾都有效。想要增加姿勢的自由度時，請調低。

### 在畫布上製作姿勢

![用姿勢工具在畫布上放置火柴人的樣子](shot:canvas-pose)

使用 **{{ui:canvas.tool.pose}}** 工具（`O`），可以直接在畫布上製作姿勢。放置的姿勢，之後可以修改無數次。

- 點選什麼都沒有的地方，就會放置站立的火柴人。沒有選取控制圖層時，會建立新的控制圖層，並設定姿勢用的強度，以及支援 OpenPose 的模型（如果已安裝）。
- 拖曳關節的圓點，連同其前端的手腳一起旋轉（骨頭的長度不會改變）。拖曳脖子，整個身體都會移動。按住 `Shift` 拖曳，則只有該關節會移動。
- 按住 `Alt` 點選關節，可以隱藏該關節，或再次顯示（用於超出畫面的手腳等）。
- 按 `R` 鍵，或列上的 **{{ui:canvas.pose.random}}** 按鈕，所選圖層的姿勢會變成新的隨機姿勢。可以按無數次，所以能試到滿意為止。
- 用姿勢工具列上的數字與閃電按鈕，可以一邊改變姿勢，一邊連續生成該張數（最多 16 張）。每個姿勢的種子也會改變，所以用相同的設定，就能排列出各種姿態的圖像。處於無法生成的狀態時，會顯示原因而不會開始。
- 1 個圖層上可以放置任意人數。左右翻轉、旋轉、放大縮小，可以從圖層的右鍵選單進行。
- 也可以用文字拜託。在開啟 **{{ui:app.tabs.canvas}}** 分頁的狀態下開啟 AI 助理，傳達像「跑步的姿勢」「抬起左手」這樣的內容，就會放置火柴人（最多 4 人）。放置之後，如果傳達「再稍微前傾一點」，它會幫忙修改該姿勢。拜託它做的姿勢是從文字推測出來的，所以如果不符合期待，請拖曳關節自行修改。
- 也可以從圖像中拍到的人來製作。在圖庫的圖像上按右鍵，選擇 **{{ui:canvas.poseFromImage.menu}}**，會立刻讀取圖中人物的骨架，檢視器的橫條會顯示找到的人數。按下 **{{ui:canvas.poseFromImage.replace}}** 或 **{{ui:canvas.poseFromImage.add}}**，就會作為火柴人放到畫布上（最多 4 人）。姿勢工具列上的同名按鈕，會使用圖庫中選取的圖像，沒有選取時則會開啟選擇圖像檔案的畫面。放置的姿勢，可以像一般的姿勢一樣修改。使用時需要擴充功能（comfyui_controlnet_aux），沒有安裝時，會在橫條中引導安裝。第一次讀取時，因為要下載模型，會花一些時間。人物太小或被遮住時，有時會找不到。
- 按下姿勢工具列的 **{{ui:canvas.pose.presets}}** 按鈕，會開啟左側是分類、右側並排著姿勢卡片的畫面。卡片上，在生成範圍的框中畫著 OpenPose 的火柴人。「{{ui:canvas.pose.group.panel}}」（特寫與遠景、兩人、三人以上、日常的一個場景、劇情與情感）連人物的位置與大小都已決定，選擇後會取代圖層中所有的姿勢。「{{ui:canvas.pose.group.standard}}」與「{{ui:canvas.pose.group.manga}}」會取代所選圖層的第一個姿勢，位置與大小維持不變。沒有姿勢時，則會新放置。抬起手臂或踢起腿而超出框時，會縮小到能放進框中為止。
- 用姿勢工具列的 **{{ui:canvas.pose3d.menu}}** 按鈕，可以用 3D 編輯姿勢（所選控制圖層的第一個姿勢。沒有的話，會從站立的人偶開始）。拖曳關節時，會在保持骨頭長度的情況下移動。也可以朝向深處或朝向前方。拖曳背景會改變身體的朝向，用滾輪放大縮小。用 **{{ui:canvas.pose3d.front}}**・**{{ui:canvas.pose3d.side}}**・**{{ui:canvas.pose3d.back}}**・**{{ui:canvas.pose3d.top}}** 按鈕，可以切換為固定的方向。按下 **{{ui:canvas.pose3d.apply}}** 後，目前看到的方向的形狀會作為姿勢放進畫布（深度也會被記住，所以再次用 3D 開啟時可以旋轉），不按就關閉則維持原樣。3D 顯示需要瀏覽器的 WebGL，在無法使用的環境中會顯示相關訊息。

![將從圖像讀取的姿勢，在放到畫布之前確認的橫條](shot:canvas-pose-from-image)

![「經典姿勢與構圖」的畫面。選取了分類「兩人」的樣子](shot:canvas-pose-presets)

![用 3D 編輯姿勢的對話方塊](shot:canvas-pose-3d)

想從照片中取出姿勢時，可以使用[工作流程](06-upscaling-workflows.md)的範本「{{ui:workflows.templates.poseControl.title}}」。

## 區域引導

**{{ui:canvas.add.regional}}** 圖層，可以指定只對塗抹的地方有效的提示詞。塗抹區域後，在圖層的設定中加上正向提示詞（要畫在那裡的東西）或反向提示詞（不想放進那裡的東西）。整張圖像的提示詞，和以往一樣對整體有效，圖層的提示詞則會在該區域內疊加。開啟 **自動反向** 後，圖層的正向提示詞在區域之外會被抑制，所以「紅色帽子」只會出現在想要的地方。

- 生成範圍之中沒有塗抹的圖層，或沒有提示詞的圖層，因為沒有指定任何東西，所以不會被使用。
- 同時能使用的最多為 8 個。隱藏的圖層不會被使用。
- 區域引導可用於 SD1.X 與 SDXL 的模型。在較新的系列（Flux 或 Qwen-Image 等）中，生成會失敗並顯示相關訊息。此時請隱藏該圖層。
- 加到區域圖層的參考圖像，目前還不會被使用。

## 儲存與收尾

- 要將畫布的圖像儲存到圖庫，請按上方列的 **{{ui:canvas.toolbar.saveToGallery}}**（磁碟圖示）。生成範圍之中、顯示中的點陣圖層，會合併為 1 張儲存。
- 要在保持圖層分開的狀態下做成 PSD 檔案，請按 **{{ui:canvas.toolbar.savePsd}}**（文件與向下箭頭的圖示）。生成範圍之中的內容，會以瀏覽器下載的方式儲存。點陣圖層會保持名稱、位置、不透明度與顯示、隱藏，每個都成為 PSD 的一個圖層。控制圖層會作為隱藏的圖層放入，重繪遮罩與區域引導則不會放入。
- 只儲存 1 個圖層時，在圖層上按右鍵，選擇 **{{ui:canvas.entityMenu.saveToGallery}}**。
- **{{ui:canvas.settings.title}}** 中，也有 **{{ui:canvas.actions.clearCanvas}}**、**{{ui:canvas.actions.clearHistory}}**、**{{ui:canvas.actions.clearStaging}}**。**{{ui:canvas.actions.clearCanvas}}** 會刪除全部的圖層。

修飾圖像的功能，在[修飾與沿用圖像](04-improve.md)中也有。「{{ui:gallery.menu.segment}}」會在畫布中開啟圖像，重畫、消除或去背塗抹的部分。
