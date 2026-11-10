# 助理、設定、快速鍵

這一章說明只要用文字告訴它，就會幫你整理設定的助理、設定畫面、快速鍵的清單、應用程式的資訊畫面，以及開發者記錄。

設定畫面、快速鍵、應用程式的資訊，都是從畫面左下方的 **{{ui:app.nav.settingsMenu}}** 開啟。

## 助理

![右側面板的助理。選擇要使用的 AI 並登入的最初畫面](shot:agent)

按下右側面板上方的 **{{ui:app.right.assistant}}** 分頁，就會與圖庫交換，顯示 **{{ui:agent.title}}**。可以在 {{ui:app.tabs.generate}}、{{ui:app.tabs.canvas}}、{{ui:app.tabs.upscaling}}、{{ui:app.tabs.workflows}} 的畫面使用，即使切換畫面，聊天與寫到一半的文字也會原樣保留。按 **{{ui:app.right.gallery}}** 分頁，就會回到圖庫。從{{ui:app.nav.extensions}}的畫面向助理提問時，會在畫面上方以視窗開啟。這個視窗只會出現在提問的那個畫面，即使移到 {{ui:app.tabs.models}}、{{ui:app.tabs.browse}} 等其他畫面也不會出現。視窗可以拖曳標題來移動。

不用自己選擇模型或 LoRA、設定提示詞或尺寸，只要用文字告訴它想製作的東西，例如「站在夕陽海邊的動漫風格少女」，助理就會選擇設定並放入。

### 開始使用（登入）

助理並不是由 novira 自己執行 AI，而是呼叫你電腦中的 AI 指令（Claude 或 Codex）來產生回答。要使用的話，需要做下列準備。

1. 在電腦上先安裝 Anthropic 的 **Claude** 或 OpenAI 的 **Codex** 其中一個指令。
2. 開啟助理，按下想使用的那一個（**{{ui:agent.setup.claude}}** 或 **{{ui:agent.setup.codex}}**）。
3. 瀏覽器會開啟，請在那裡登入。

在電腦上找不到該指令時，會出現「在這台電腦上找不到 ○○ 的指令。請先安裝。」的提示。請先安裝該指令。

使用的服務與合約，是你所選擇的那一方的。使用 Claude 與 Codex 時，novira 不會儲存 API 金鑰。往來的內容（傳送的文字，以及助理為了作業而讀取的應用程式資訊，例如模型的清單、設定、開啟中的漫畫或文字的內容），會傳送到你所選擇的服務。圖庫圖像的資訊與生成分頁的提示詞，只有在你允許時才會讀取（請見下方的「讀取圖像與提示詞的許可」）。

所選的 AI，會顯示在助理最上方的那一列。想更換時，請按下該列右側的 **{{ui:agent.changeProvider}}** 按鈕。

### 連接 Ollama 等伺服器

![連接伺服器的畫面。Ollama 的按鈕、位址、模型、連線測試的結果](shot:agent-server)

除了 Claude 與 Codex，在這台電腦或網路上執行、具有 OpenAI 相容 API 的伺服器（Ollama 或 LM Studio 等），也可以讓助理使用。由 novira 向伺服器詢問答案，助理的工具（設定或編輯器的操作等）也由 novira 自己執行，所以需要支援工具呼叫的模型。

連接的步驟如下。

1. 開啟助理，按下 **{{ui:agent.setup.openai}}**。
2. 按下要使用的伺服器的按鈕（Ollama 的話，按 **Ollama** 的按鈕）。位址會自動填入，並讀取伺服器上的模型清單。其他伺服器，請在 **{{ui:agent.endpoint.address}}** 輸入通常以「/v1」結尾的位址。
3. **{{ui:agent.endpoint.model}}** 從清單中選擇。伺服器不提供清單時，請輸入名稱。
4. 伺服器要求金鑰時，請在 **{{ui:agent.endpoint.key}}** 輸入。金鑰會加密後儲存在這台電腦，只會傳送給這個伺服器。自己電腦上的伺服器，通常不需要。
5. 按下 **{{ui:agent.endpoint.test}}**。會確認伺服器是否有回應、模型是否存在，以及該模型是否能呼叫應用程式的工具。
6. 按下 **{{ui:agent.endpoint.use}}**。

模型無法呼叫工具時，測試會顯示這件事，伺服器回傳的原因也會一併顯示。輸入欄的上方也會留下警告，訊息的傳送會被拒絕。用聊天名稱旁邊的按鈕選擇其他模型，就能再次確認。伺服器的上下文（一次能讀取的長度）不足以應付助理的請求時，測試同樣會失敗。Ollama 的標準設定就是如此。請將伺服器的上下文長度設為 32768 以上（用 Ollama 的設定，或環境變數 OLLAMA_CONTEXT_LENGTH），再按一次 **{{ui:agent.endpoint.test}}**。novira 不會假裝能使用工具。

使用伺服器時，聊天的標題會顯示 OpenAI API。按下 **{{ui:agent.changeProvider}}** 就會回到選擇畫面。輸入過的伺服器，會保留在表單中。

位於這台電腦之外的伺服器，你傳送的內容，以及在你允許的情況下助理讀取的內容，會經過網路傳送出去。這類伺服器的位址下方會顯示警告。不使用 https 的伺服器，包含金鑰在內的所有內容都會以未加密的方式傳送，因此也會顯示該警告。「{{ui:agent.permission.title}}」的確認中，也會顯示讀取的內容會被傳送到哪裡。伺服器的回覆只會當作單純的文字處理，請求只有通過與 Claude 或 Codex 相同確認的才會被執行。

### 它會做什麼

助理會從你的文字決定下列事項，並放入設定。放入的內容，會以清單顯示在回覆中。

| 內容 | 範例 |
|---|---|
| 選擇模型 | 從已安裝的模型中，選擇合適的 |
| 加入 LoRA | 加入符合畫風的 LoRA |
| 提示詞 | 寫下提示詞與負面提示詞 |
| 變更設定 | 尺寸、步數、CFG、排程器、種子 |
| 工作流程 | 建立圖形、修改開啟中的圖形（也會用 ComfyUI 本體的節點組出音樂、影片、語音的圖形。執行的是你，請按 **{{ui:params.invoke.invoke}}**） |
| 文字 | 修改在 **{{ui:media.tab.text}}** 開啟的文字與對話框 |
| 影片、音樂、語音 | 變更各個畫面的設定 |
| 漫畫 | 在 **{{ui:app.tabs.comic}}** 中，變更分格、新增與分割格子、每格的提示詞與姿勢、對話框（請見下方的「請它幫忙畫漫畫」） |
| 姿勢 | 在 **{{ui:app.tabs.canvas}}** 中，擺放依文字要求的姿勢的火柴人（請見[畫布](05-canvas.md#在畫布上製作姿勢)） |
| 生成 | 只有在你要求時（以及下方的試畫），才會把目前的設定或漫畫的格子加入生成的佇列 |
| 推薦擴充功能 | 介紹符合想做的事的擴充功能，並可以用按鈕安裝 |
| 應用程式的使用方法 | 使用畫面的名稱，回答該按哪裡 |
| 擴充功能的說明 | 說明能做什麼、如何使用（請見下方的「詢問使用方法或擴充功能」） |

助理看得到你開啟的是哪個畫面。例如開啟 **{{ui:media.tab.text}}**，告訴它「把文字改成直書」，那段文字就會改變。

助理會一邊作業，一邊立刻把變更的內容放進畫面。作業期間，變更的內容會依序顯示在「{{ui:agent.thinking}}」的下方。圖像或影片只有在你要求時才會製作（加入生成的佇列）。沒有要求時只會變更設定，所以看過結果覺得不錯，按回覆中的 **{{ui:agent.generate}}**，就會直接開始製作。開啟漫畫時，旁邊也會出現「生成全部頁面」按鈕。按下後，會把有提示詞的格子，整本全部頁面一併加入佇列（不按就不會加入）。助理不會刪除圖像，也不會安裝模型或擴充功能（擴充功能只會提出推薦）。回覆中的粗體、項目符號、表格等，不會以符號原樣顯示，而是以該形式顯示。

### 反問與試畫

當你要求的內容中，有會大幅改變結果卻不明確的地方，例如要改哪個人物、背景還是人物、髮型還是髮色，助理會在變更之前反問。回答後，就會照你的回答變更。請它修改之後，如果你告訴它「之前的比較好」「那個女孩維持原樣就好」，助理會在這個聊天中確認變更前的狀態，並把那個部分還原（關閉應用程式後，就無法得知變更前的狀態）。

要求像「夏天的氛圍」這樣只用言語難以傳達的外觀時，助理有時會自己試著生成 1 張，看過那張圖像後確認「是這樣的氛圍嗎？」。試畫的圖像會顯示在回覆的下方。查看圖像時，會出現與下方「讀取圖像與提示詞的許可」相同的確認。不想讓它試畫時，請關閉設定的 **{{ui:settings.assistantTrial.label}}**（請見下方的「設定」）。

### 請它幫忙畫漫畫

在開啟 **{{ui:app.tabs.comic}}** 的狀態下提出要求，助理會讀取開啟中的頁面（格子的形狀、每格的提示詞、姿勢、對話框），並直接改寫。例如可以這樣要求。

- 要求「做成有精彩場面的 5 格。第 1 格要大，斜著分割」，就會製作分格。沒有特別指定形狀時，會像實際的漫畫一樣，讓每一段的高度與格子的寬度參差不齊，把精彩場面的格子放大，並依場景加入斜向的切線，或延伸到紙張邊緣的格子。格子之間，上下的間隔比左右寬。每一頁的分法都不同。有時會使用標準的範本，也有時會自己決定格子的形狀。
- 要求「依這個故事寫每格的提示詞」，就會為每一格寫下加入符合故事發展的構圖（特寫、遠景、仰角等）的提示詞。
- 要求「依這個故事寫每格的場景說明」，就會為每一格用文字寫下場景（地點、時間、誰在做什麼）。
- 要求「在每格加入台詞」，就會擺放對話框並放入台詞。台詞超出對話框時，會縮小文字，收進對話框中。
- 要求「把第 2 格的女孩改成奔跑的姿勢」，就會為那一格加上姿勢。也會寫下登場人物（每個角色的外觀），讓每一格的臉與服裝都一致。對話框會放在說話者的旁邊，大小不會與其他人重疊。
- 要求「新建一部漫畫，組出 30 頁份的分格」，就會新建漫畫、增加頁面，並把分格、提示詞、台詞做到最後。即使從其他畫面提出要求，也會切換到漫畫的畫面進行作業。就算是很長的作業，也會在一次要求之中持續到完成。中途想停止時，請按 **{{ui:agent.stop}}**。

圖畫只有在你要求時才會畫（加入繪製的佇列）。沒有要求時，提示詞放入後，請按 **{{ui:comic.panel.draw}}**、**{{ui:comic.page.drawAll}}**、**{{ui:comic.comic.drawAll}}** 其中之一。要求「畫全部頁面」，就會把全部頁面的所有格子一併加入佇列。回覆下方的「生成全部頁面」按鈕也一樣。按下 **{{ui:agent.undo}}**，那則回覆所改變的漫畫頁面，會一併還原。

### 附加圖像

可以在訊息中附上圖像，像「請根據這張圖像想提示詞」這樣要求。

- 用輸入欄左側的迴紋針按鈕（**{{ui:agent.attach.add}}**），選擇電腦中的圖像。
- 將圖庫的圖像或電腦中的圖像檔案，拖曳放到輸入欄，也可以附加。
- 將複製的圖像貼到輸入欄，也可以附加。

附加的圖像會排列在輸入欄的上方，用右上角的 × 可以移除。1 則訊息最多可以附加 4 張。沒有寫文字、只傳送圖像時，會視為提出了「{{ui:agent.attach.defaultAsk}}」的要求。從電腦附加的圖像，也會放入圖庫。圖像會與該則訊息一起，傳送給所選的 AI（Claude、Codex、連接的伺服器）。之後的訊息不會帶著它，所以要針對同一張圖像再次提出要求時，請再附加一次。無法讀取圖像的模型，無法順利回答。

### 讀取圖像與提示詞的許可

圖庫圖像的資訊（提示詞或模型等），以及生成分頁的提示詞欄，可能有不想讓人看到的內容。因此，助理要讀取這些內容時，一開始會在聊天中出現「{{ui:agent.permission.title}}」的確認。也會顯示它要讀取什麼。

- **{{ui:agent.permission.once}}**：只讓它讀取這一次。下次再要讀取時，會再次出現確認。
- **{{ui:agent.permission.always}}**：今後不再確認，直接讓它讀取（設定會變成 **{{ui:settings.assistantRead.always}}**）。
- **{{ui:agent.permission.deny}}**：不讓它讀取。助理會在不讀取的情況下繼續作業，或回答需要什麼。

開啟漫畫的畫面時，助理有時會查看畫完的頁面的圖畫（因為你的要求，用來確認人物的外觀或對話框）。這時也會出現相同的確認，只有在你允許時，頁面的圖畫才會被傳送。在其他畫面不會查看。

是否要確認，可以用設定的 **{{ui:settings.tab.generation}}** 分頁的 **{{ui:settings.section.assistant}}** 中的 **{{ui:settings.assistantRead.label}}** 來更改（請見下方的「設定」）。漫畫、文字、工作流程、影片、音樂、語音的畫面，以及畫布的姿勢等，讓助理幫忙修改的畫面的內容，不需確認就會讀取。

### 用 Wikipedia 查資料

製作故事時（時代、服裝、場所、職業、用語等），助理可以在日文或英文的 Wikipedia 查詢事實，最多讀取 3 篇文章的開頭。傳出電腦之外的只有簡短的搜尋詞，送出的對象只有 Wikipedia。負責傳送的是應用程式本體，畫面不會直接連線。因為搜尋詞會傳到網際網路，所以查詢之前，聊天中會出現「{{ui:agent.permission.webTitle}}」的確認，也會顯示要傳送的搜尋詞。

- **{{ui:agent.permission.once}}**：只讓它查詢這一次。下次再要查詢時，會再次確認。
- **{{ui:agent.permission.always}}**：以後不再確認，直接讓它查詢（設定會變成 **{{ui:settings.assistantRead.always}}**）。
- **{{ui:agent.permission.deny}}**：不讓它查詢。助理會在已知的範圍內進行，在那次要求期間，不會再次請求。

這是另一項設定，是設定的 **{{ui:settings.tab.generation}}** 分頁的 **{{ui:settings.section.assistant}}** 中的 **{{ui:settings.assistantWeb.label}}**。即使允許讀取圖像，也不代表允許查資料（反過來也一樣）。Wikipedia 的文章是 CC BY-SA 4.0 授權，所以助理在使用事實時，會告知原始文章的名稱。答案也可能有誤，重要的事請自行確認。

### 選擇模型與思考的深度

按下聊天名稱右側的腦形小按鈕，可以選擇助理使用的 **{{ui:agent.model.label}}** 與 **{{ui:agent.effort.label}}**。選擇的內容，會從下一則傳送的訊息開始使用。Claude 與 Codex 會分別記住。

- Claude 的模型，可以從 Fable 5.1、Opus 5.5、Sonnet 5.5、Haiku 5.5 中選擇。會使用如名稱所示的版本。思考的深度，從 **{{ui:agent.effort.low}}** 到 **{{ui:agent.effort.max}}**，共 5 個等級。
- Codex 的模型，可以從 Codex 表示你的帳號可以使用的模型清單中選擇（清單是讀取 Codex 儲存在電腦上的內容）。思考的深度，只會顯示所選模型接受的（也有接受到 **{{ui:agent.effort.ultra}}** 的模型）。
- 伺服器的話，會顯示伺服器列在清單中的模型。也可以輸入名稱。沒有思考的深度。模型是伺服器設定的一部分，所以選擇其他模型後，該選擇會被儲存。

尚未選擇時，Claude 會選用 Sonnet 5.5，Codex 則會選用清單中的第一個模型，按鈕上也會顯示該名稱。按鈕上顯示名稱的模型，一定會負責回答（只有在 Codex 沒有儲存清單時，會顯示 **{{ui:agent.model.default}}**，由 Codex 決定模型）。思考的深度，一定會選著其中 1 個。一開始選的是各個模型的標準深度，換成其他模型時，如果該模型不接受目前的深度，就會回到該模型的標準深度。

### 更改輸入欄的高度

將輸入欄上緣的橫長把手往上拖曳，輸入欄就會變高，往下拖曳就會變低。選取把手後按上下方向鍵，也可以更改。高度在下次開啟時也會維持相同。

### 叫出範本

在輸入欄的開頭輸入「/」，常用要求方式的範本就會以依功能分類的清單開啟。接著「/」輸入文字，就會只篩選出以該文字開頭的指令。沒有這樣的指令時，會留下名稱或文句含有該文字的項目（例如「/comic」或「/姿勢」）。

用上下方向鍵選擇，按 Enter 或 Tab 決定。按下清單中的列也可以決定。輸入欄中只會留下「/pose」這樣的指令，請在後面寫上內容，再按 Enter 傳送。傳送時，指令會換成範本的文句（只是決定的話，不會傳送）。按 Esc 鍵可以關閉清單。

選擇「/help」，就會在輸入欄上方開啟每個指令的說明和它傳送的文句。這些內容不會傳送給助理。按 Esc 鍵或關閉按鈕可以關閉。

### 詢問使用方法或擴充功能

不只是要求設定，也可以提問。例如問「要怎麼去除背景？」「要新增模型該按哪裡？」，它會使用畫面上顯示的名稱，回答該按哪裡。回答會用目前使用的語言回覆。

也可以詢問擴充功能。會用淺顯的話說明能做什麼、什麼時候使用、怎麼使用。詢問的方式有 3 種。

- 在 **{{ui:app.nav.extensions}}** 的清單中按下卡片開啟詳細資料，再按 **{{ui:agent.ask.button}}**。關於該擴充功能的提問，會在新的聊天中傳送。
- 在 **{{ui:app.nav.extensions}}** 上方的搜尋欄輸入文字後會出現 **{{ui:agent.ask.resultsButton}}**，按下它。會回答符合的擴充功能（最多前 8 個）的差異，以及從哪一個開始試比較好。
- 在聊天中寫下擴充功能的名稱（英文字母）來詢問。會從公開的擴充功能中，找出名稱或說明相符的來回答（清單尚未載入時，會在那時載入）。

如果是已安裝的擴充功能，也會回答新增的節點名稱，以及要連接到哪裡。尚未安裝的，回覆中會附上卡片，可以用 **{{ui:workflows.packs.install}}** 直接安裝。

> 擴充功能的說明，是依據公開的說明文字與節點的資訊。不知道的事應該會回答「不知道」，但也可能會弄錯。安裝之前，也請確認發布來源的頁面。

### 復原

變更了設定或編輯的回覆，會附有 **{{ui:agent.undo}}** 按鈕。按下後，因該要求而改變的設定或編輯，會一併回到要求之前。已經加入生成佇列的不會被取消（請在佇列中取消）。

不過，重新開啟應用程式之後，在那之前的變更就無法復原（按鈕會變成無法按下）。

### 反覆繪製到相似為止

要求「請畫得像這張圖像」「一邊生成幾張一邊讓它接近」時，助理會反覆試畫。每畫完 1 張，就與目標的圖像比較，只修改不同的地方，再畫下一張。

- 即使一次回答結束了，應用程式也會自動要求下一張。助理停下來的時機，只有判斷已經接近目標時，或連續 2 張都沒有接近時。
- 最多 30 張。
- 聊天中會顯示「接近的作業：第 幾 / 幾 張」。
- 想停止時，請按 **{{ui:agent.stop}}**，或傳送新的訊息。傳送的訊息，會代替下一張而送出。
- 關閉 {{ui:settings.assistantTrial.label}} 時，這個反覆不會開始。

### 確認對話的長度

在同一個聊天中，助理會記著先前的往來來回答。附加的圖像，以及助理展示過的圖像，名稱也會被延續下去，需要時會重新查看。

- 輸入欄的上方，會以「約 幾 / 幾 個 token」顯示下次傳送時會附上的對話大小。數字是參考值。
- 同一列的「{{ui:agent.context.limit}}」開關開啟期間（一開始就是開啟的），當對話快要超過 30000 個 token 時，會把舊訊息整理成每則一行的簡短摘要後傳送。新的訊息會原樣傳送，整理的則數會顯示在該列。摘要是開頭約 140 個字，所以細微的措辭不會保留。如果關閉後助理會忘記先前的話題，可以關閉開關，這樣會傳送對話的全部（太長時，可能會超過所使用模型的上限）。
- 這個開關開啟期間，助理寫在 {{ui:app.tabs.generate}} 提示詞欄的提示詞，每個欄位也會被限制在 77 個 token（欄位下方顯示的數字）以內。超過的提示詞應用程式不會接受，助理會縮短後重寫。想讓它寫長的提示詞時，請關閉開關。
- 要換話題時，用 {{ui:agent.session.new}} 開始新的聊天，就不會被舊的對話牽著走。

### 聊天的紀錄

與助理的往來，會以「聊天」的形式保留下來。按視窗上方的聊天名稱部分，就會開啟 **{{ui:agent.session.history}}** 的清單。

- 從清單中選擇，就能接續該聊天繼續談話。
- 用 **{{ui:agent.session.rename}}** 可以命名。
- 用 **{{ui:agent.session.delete}}** 可以刪除。
- 旁邊的 **{{ui:agent.session.new}}** 可以開始新的聊天。

聊天的文字，可以拖曳選取後複製。按每則訊息右下角的按鈕（**{{ui:agent.copy}}**），就會複製該則訊息的全文。

> 在等待回覆期間寫好並傳送的訊息，會進入佇列，等目前的回覆結束後自動傳送。排隊中的訊息會以淡色顯示，用 × 可以移除。回覆失敗時，排隊中的訊息會回到輸入欄。要中止時，請用 **{{ui:agent.stop}}** 按鈕取消。取消之前已經改變的內容會維持原樣，可以用 **{{ui:agent.undo}}** 一併還原。

右側面板的寬度，可以拖曳面板的邊界來更改。開啟在畫面上方的視窗，拖曳四個邊與四個角的任何位置，都可以更改大小。右下角會顯示標記。大小會被記住。回覆附有判斷過程時，會在回覆的上方以 1 行顯示。按下就會全部展開（**{{ui:agent.thoughts.label}}**）。這是 AI 簡短整理它如何解讀、為什麼這樣做的內容，並不是 AI 內部思考的原樣。

## 設定

![設定的畫面。左側排列著分頁，右側顯示所選分頁的項目](shot:settings)

從左下方的 **{{ui:app.nav.settingsMenu}}** 選擇 **{{ui:app.nav.settings}}**，就會開啟設定的畫面。選擇左側的分頁，右側就會顯示該分頁的項目。變更的內容會立即套用，即使關閉應用程式也會保留。再次開啟時，會開啟最後看的分頁。

> 這張圖像是在瀏覽器中執行的範例畫面。只有桌面版才有的 **{{ui:settings.uiZoom.label}}** 沒有拍進去。

### {{ui:settings.tab.general}}

| 項目 | 內容 |
|---|---|
| {{ui:settings.language.label}} | 從{{ui:settings.language.ja}}、{{ui:settings.language.en}}、{{ui:settings.language.zhcn}}、{{ui:settings.language.zhtw}}、{{ui:settings.language.ko}}、{{ui:settings.language.ru}}、{{ui:settings.language.es}}、{{ui:settings.language.ptbr}}、{{ui:settings.language.fr}}、{{ui:settings.language.de}}中選擇。畫面的語言會立即切換 |
| {{ui:settings.theme.label}} | **{{ui:settings.theme.dark}}**（預設）或 **{{ui:settings.theme.light}}** |
| {{ui:settings.uiZoom.label}} | 僅限桌面版。整個畫面的大小。可以從 50% 選到 300%。也可以用 `Ctrl` 與 `+` / `-` 更改 |
| {{ui:settings.startTab.label}} | 開啟應用程式時最先顯示的分頁。一開始是 **{{ui:app.tabs.generate}}**。選擇 **{{ui:settings.startTab.last}}** 後，會開啟上次關閉時的分頁 |
| {{ui:settings.waitForEngine.label}} | 一開始是開啟的，啟動畫面會等到圖像引擎載入結束。關閉後，即使載入到一半也會開啟應用程式。引擎的狀態會顯示在橫幅中 |
| {{ui:settings.toastSeconds.label}} | 通知自動消失之前的秒數。可以從 2 秒選到 15 秒（一開始是 3.5 秒） |

### {{ui:settings.tab.generation}}

- **{{ui:settings.antialiasProgressImages}}**：將生成途中的圖畫，在圖庫的「{{ui:gallery.generating.title}}」框中平滑地顯示。關閉的話，會維持粗糙的點狀。
- **{{ui:settings.draftCount.label}}**：開啟草稿畫面時，張數的初始值（1～24 張。一開始是 4 張）。也可以在畫面上隨時更改。
- **{{ui:settings.draftPosition.label}}**：開啟草稿畫面時，位置的初始值（25～60 %。一開始是 35 %）。
- **{{ui:settings.lowMemory.label}}**：適用於 GPU 記憶體較少的電腦。開啟後，不會讓模型一直留在 GPU 的記憶體中，所以可以用較少的記憶體製作，但製作會變慢。切換時會重新啟動引擎。有製作中的項目時，會從下次啟動引擎時開始套用。連接到在其他地方啟動的引擎時無法使用。
- **{{ui:settings.assistantRead.label}}**（**{{ui:settings.section.assistant}}**）：助理是否可以讀取圖庫圖像的資訊與生成分頁的提示詞。從 **{{ui:settings.assistantRead.ask}}**（預設）、**{{ui:settings.assistantRead.always}}**、**{{ui:settings.assistantRead.never}}** 中選擇。
- **{{ui:settings.assistantWeb.label}}**（**{{ui:settings.section.assistant}}**）：助理是否可以在 Wikipedia 查詢事實。選擇方式相同，與讀取圖像是不同的設定。
- **{{ui:settings.assistantTrial.label}}**（**{{ui:settings.section.assistant}}**）：要求的意圖不明確時，助理是否可以自己試著生成 1 張。一開始是開啟的。

### {{ui:settings.tab.gallery}}

- **{{ui:gallery.settings.thumbnailSize}}**、**{{ui:gallery.settings.sort}}**、**{{ui:gallery.settings.starredFirst}}**、**{{ui:gallery.settings.groupByDate}}**、**{{ui:gallery.settings.alwaysShowSize}}**、**{{ui:gallery.settings.showArchived}}**、**{{ui:gallery.settings.newToCandidates}}**、**{{ui:gallery.settings.autoSwitch}}**、**{{ui:gallery.settings.autoAssign}}**：與用圖庫的齒輪按鈕開啟的 **{{ui:gallery.settings.title}}** 是相同的項目。在哪一邊更改，結果都一樣。
- **{{ui:settings.confirmOnDelete}}**：刪除圖像之前，先顯示確認。在確認畫面選擇「{{ui:common.dontAskAgain}}」時，這裡也會變成關閉。
- **{{ui:settings.clearIntermediates}}**：刪除畫布的中間結果等不會顯示在圖庫的圖像。要刪除的數量會顯示在按鈕上。

### {{ui:settings.tab.edit}}

- **{{ui:settings.undoLimit.label}}**：畫布、漫畫、文字、工作流程的編輯中，可以復原的操作數量。可以從 10 選到 200（一開始是 60）。調高會使用較多記憶體。

### {{ui:settings.tab.comicText}}

- **{{ui:settings.comicFont.label}}**：用於沒有選擇字型的對話框文字的字型。可以從應用程式的字型，以及這台電腦中已安裝的字型中選擇。**{{ui:common.font.standard}}** 是應用程式的標準文字。
- **{{ui:settings.textFont.label}}**：在文字畫面新增文字時使用的字型。選擇方式與對話框的字型相同。
- **{{ui:settings.section.comicPage}}**：決定新建的漫畫，以及之後新增的頁面的 **{{ui:comic.page.size}}**、**{{ui:comic.page.direction}}**、**{{ui:settings.comicPage.panels}}**（1 到 6）、**{{ui:comic.page.frameWidth}}**、**{{ui:comic.page.margin}}**。現有的頁面不會改變。

### {{ui:settings.tab.engine}}

應用程式存放資料的位置，以及圖像引擎（ComfyUI）的啟動方式。在這裡變更的內容，會從下次啟動應用程式時開始套用（上方會顯示這件事）。

| 項目 | 內容 |
|---|---|
| {{ui:settings.engine.dataDir.label}} | 存放製作的圖畫、模型、圖像引擎等的資料夾。一開始是使用者資料夾中的 `novira-data`。按下 **{{ui:settings.engine.dataDir.change}}** 後，首先選擇目前資料的處理方式。**{{ui:settings.engine.dataDir.dialog.move}}** 會把目前的資料移到所選的資料夾。即使資料夾中有其他東西，只要沒有同名的就能移動（因為會在下次啟動的一開始進行，量多的話會花時間）。**{{ui:settings.engine.dataDir.dialog.use}}** 不移動資料，而是開啟所選的資料夾（有資料的話就使用該資料，空的話就重新開始）。接著會開啟選擇資料夾的視窗，選擇的位置會從下次啟動開始使用。用 **{{ui:settings.engine.dataDir.cancel}}** 可以取消。無法移動時，會顯示原因，並維持目前的資料夾啟動。以環境變數 `NOVIRA_DATA_DIR` 指定時，無法在這裡更改 |
| {{ui:settings.engine.comfyui.label}} | 使用中的 ComfyUI。平常位於資料夾中的 `comfyui`，並會顯示該位置。以設定檔指定了其他 ComfyUI 時，會顯示該位置。用 **{{ui:settings.engine.comfyui.change}}** 可以更改應用程式安裝的 ComfyUI 的存放位置。所選的資料夾是空的，下次啟動時會重新安裝（下載量很大）。已經是安裝完成的資料夾，則直接使用。舊位置的檔案不會自動刪除。要回到資料夾中時，請選擇其中的 `comfyui` |
| {{ui:settings.engine.package.label}} | **{{ui:settings.engine.package.nvidia}}** 或 **{{ui:settings.engine.package.amd}}**。下次下載 ComfyUI 時（第一次安裝或版本切換）會使用。已安裝 ComfyUI 時，如果選擇其他種類，會出現確認。確認後，下次啟動 novira 時，會以所選的種類重新安裝 ComfyUI（下載量很大，需要時間） |
| {{ui:settings.engine.timeout.label}} | 啟動 ComfyUI 之後，等待回應的秒數。可以從 30 秒選到 1800 秒。速度慢的電腦請調長 |
| {{ui:settings.engine.modelRoots.label}} | 除了資料資料夾的 models 之外，用來尋找模型的資料夾。按下 **{{ui:settings.engine.modelRoots.add}}** 會開啟選擇資料夾的視窗。可以辨識 ComfyUI 或 Stability Matrix 的資料夾形式。影片、音樂、語音、消除的追加模型也能從這裡找到（只讀取，新安裝時一律放入資料資料夾）。最多可以新增 16 個。資料資料夾之中，以及已經存在的資料夾無法新增。用 × 按鈕移除。在瀏覽器中開啟時，無法新增，只能移除 |

### {{ui:settings.tab.accounts}}

這是模型發布網站需要登入時使用的欄位。輸入的內容會加密後儲存在這台電腦，不會顯示在畫面上。

| 項目 | 內容 |
|---|---|
| {{ui:settings.civitaiKey.label}} | 用於下載需要登入的模型 |
| {{ui:settings.hfToken.label}} | 用於下載需要申請存取的模型 |

貼上後按下 **{{ui:settings.civitaiKey.save}}**。之後也可以 **{{ui:settings.civitaiKey.change}}** 或 **{{ui:settings.civitaiKey.remove}}**。

### {{ui:settings.tab.data}}

#### {{ui:share.backup.section}}

![設定畫面的備份欄。建立備份的按鈕，以及從備份還原的按鈕](shot:settings-backup)

可以把製作的圖畫，以及在應用程式中設定、登錄的東西，整合成 1 個 zip 檔案儲存。用於搬到另一台電腦，或作為萬一時的準備。

- **{{ui:share.backup.createLabel}}**：會開啟選擇儲存位置的視窗。檔名一開始就是「novira-backup-日期-時間.zip」。圖畫很多的話會花時間，進度會顯示在這個欄位。
- **{{ui:share.backup.restoreLabel}}**：選擇備份的 zip 檔案。確認內容之後，會出現確認的視窗。

備份中會包含與不會包含的東西如下。

| 會包含的東西 | 不會包含的東西 |
|---|---|
| 圖庫的圖畫、影片、語音，以及它們的縮圖 | 模型 |
| 看板、工作流程、漫畫、佇列的紀錄 | 圖像引擎（ComfyUI）與擴充功能 |
| 角色、預設、提示詞清單、草稿、AI 的聊天、畫面的設定 | API 金鑰與權杖、ComfyUI 的位置等每台電腦各自的設定 |

![還原的確認視窗。顯示建立備份的日期時間與內容的數量、取代的注意事項](shot:restore-confirm)

確認的視窗中，會顯示建立備份的日期時間，以及其中包含的圖像、看板、工作流程的數量。按下 **{{ui:share.backup.confirm}}** 後，應用程式會先結束再重新啟動，目前的資料會被取代為備份的內容。沒有成功時會回到原本的資料，並告知這件事。

> 被取代的資料無法復原。需要的話，請在還原之前先建立目前狀態的備份。API 金鑰與權杖是為這台電腦專用而加密的，所以還原之後，請在 **{{ui:settings.tab.accounts}}** 重新輸入。在瀏覽器中開啟時，無法建立備份，也無法還原。請在桌面應用程式中使用。

#### {{ui:settings.section.unfinished}}

下載中途停止時，寫到一半的檔案會留在資料資料夾中。在這個欄位，可以確認留下的檔案的名稱、所在的資料夾、大小。用 **{{ui:settings.unfinished.delete}}** 可以逐個刪除，用 **{{ui:settings.unfinished.deleteAll}}** 可以全部刪除（按下後，會先要求確認）。留下的檔案，在下次開始相同的下載時，會從中斷的地方繼續使用。刪除後，該下載會從頭重新取得。使用中的檔案不會被刪除，會保留下來。

#### {{ui:settings.section.reset}}

用 **{{ui:settings.reset.scope.label}}** 選擇要還原的範圍，按下 **{{ui:settings.resetWebUi}}** 之後，再按一次 **{{ui:settings.resetConfirm}}** 確定。圖像、模型、漫畫、畫布不會被刪除。

設定、預設、草稿、紀錄等畫面的狀態，會儲存在資料資料夾中。只要使用相同的資料資料夾，用桌面應用程式與用瀏覽器開啟時，內容就會相同。因為無法同時開啟兩者，所以連續使用時會接續下去。重設也會反映到兩邊。

| 範圍 | 會回到初始值的東西 |
|---|---|
| {{ui:settings.reset.scope.settings}} | 設定畫面的項目。會立即還原 |
| {{ui:settings.reset.scope.generation}} | 生成畫面的提示詞、模型、各個參數 |
| {{ui:settings.reset.scope.gallery}} | 圖庫的顯示（縮圖的大小、排列順序等） |
| {{ui:settings.reset.scope.assistant}} | 與助理的對話。會全部刪除 |
| {{ui:settings.reset.scope.all}} | 瀏覽器中儲存的設定與畫面狀態的全部。預設、角色、提示詞清單、助理的對話也會被刪除 |

「{{ui:settings.reset.scope.settings}}」以外，在確定之後按下出現的 **{{ui:settings.reload}}** 重新載入，才會反映。

### {{ui:settings.tab.developer}}

- **{{ui:settings.showDevLog}}**：在左側的導覽列顯示{{ui:app.devlog.short}}的按鈕（請見下方的「開發者記錄」）。

## 快速鍵

![快速鍵的清單。依應用程式、畫布等分類，排列著操作與按鍵](shot:hotkeys)

從左下方的 **{{ui:app.nav.settingsMenu}}** 選擇 **{{ui:app.nav.hotkeys}}**，或按 `Shift+?`，就會開啟清單。可以在上方的搜尋欄，用操作名稱或按鍵搜尋。

這裡整理常用的。全部請在畫面的清單中確認。

### 整個應用程式

| 按鍵 | 操作 |
|---|---|
| `Ctrl+Enter` | 生成（加入佇列） |
| `Ctrl+Shift+Enter` | 加到佇列的最前面並生成 |
| `Shift+X` | 取消處理中的項目 |
| `Ctrl+Shift+X` | 清除全部佇列 |
| `Alt+A` | 移到提示詞欄 |
| `T` | 開啟或關閉左側面板 |
| `G` | 開啟或關閉右側面板（圖庫與助理） |
| `F` | 一併開啟或關閉左右面板 |
| `1` ～ `9` | 移到對應編號的分頁 |
| `Shift+?` | 開啟快速鍵清單 |
| `Ctrl` + `+` / `-` | 放大或縮小整個畫面 |

### 畫布

| 按鍵 | 操作 |
|---|---|
| `B` | {{ui:settings.hotkeys.canvas.brush}} |
| `E` | {{ui:settings.hotkeys.canvas.eraser}} |
| `U` | {{ui:settings.hotkeys.canvas.rect}} |
| `V` | {{ui:settings.hotkeys.canvas.move}} |
| `C` | {{ui:settings.hotkeys.canvas.bbox}} |
| `H` | 移動顯示 |
| `I` | {{ui:settings.hotkeys.canvas.colorPicker}} |
| `[` / `]` | 縮小、放大筆刷 |
| `Ctrl+Z` | {{ui:settings.hotkeys.canvas.undo}} |
| `Ctrl+Shift+Z`、`Ctrl+Y` | {{ui:settings.hotkeys.canvas.redo}} |
| `Q` | 與上一個使用的工具切換 |
| `Enter`、`Esc` | {{ui:settings.hotkeys.canvas.acceptStaged}}、{{ui:settings.hotkeys.canvas.discardStaged}} |

### 圖庫與檢視器

| 按鍵 | 操作 |
|---|---|
| 方向鍵 | {{ui:settings.hotkeys.gallery.navigate}} |
| `Ctrl+A` | {{ui:settings.hotkeys.gallery.selectAll}} |
| `Esc` | {{ui:settings.hotkeys.gallery.clearSelection}} |
| `.` | {{ui:settings.hotkeys.gallery.star}} |
| `I` | {{ui:settings.hotkeys.viewer.toggleMetadata}} |
| `R` | {{ui:settings.hotkeys.viewer.remix}}（載入種子以外的內容） |
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
| `Delete` | 刪除選取的節點與連線 |
| `Ctrl+C`、`Ctrl+V` | {{ui:settings.hotkeys.workflows.copy}}、{{ui:settings.hotkeys.workflows.paste}} |
| `Ctrl+S` | {{ui:settings.hotkeys.workflows.save}} |
| `Ctrl+Z`、`Ctrl+Shift+Z` | {{ui:settings.hotkeys.workflows.undo}}、{{ui:settings.hotkeys.workflows.redo}} |

正在輸入文字時，`T` 或 `G` 等單一字元的按鍵不會作用。

## 關於本應用程式

![應用程式資訊的畫面。Logo、版本、授權、使用中的開放原始碼清單](shot:about)

從左下方的 **{{ui:app.nav.settingsMenu}}** 選擇 **{{ui:app.nav.about}}**，上方會顯示應用程式的名稱、版本、授權、著作權的標示。其下分成 2 個分頁。

- **{{ui:settings.about.license.title}}**：novira 的授權（Apache License 2.0）全文。安裝位置的資料夾中也有相同的文件（`LICENSE`）。
- **{{ui:settings.about.oss.title}}**：使用中的開放原始碼軟體清單。每一列排列著名稱與版本。按下 **{{ui:settings.about.oss.showLicense}}**，其下會顯示授權全文（再按一次就會關閉）。按下 **{{ui:settings.about.oss.homepage}}**，會用瀏覽器開啟該軟體的頁面。沒有隨應用程式附帶的生成引擎與擴充功能，請到首頁確認授權全文。

用清單上方的按鈕，可以篩選為 **{{ui:settings.about.oss.short.frontend}}**、**{{ui:settings.about.oss.short.backend}}**、**{{ui:settings.about.oss.short.engine}}**、**{{ui:settings.about.oss.short.packs}}**（目前已安裝的擴充功能）。在搜尋欄可以用名稱搜尋。隨附軟體的授權全文，也整理在安裝位置資料夾的 `THIRD_PARTY_NOTICES.txt` 中。

擴充功能（ComfyUI 的自訂節點）與模型，在安裝時，各自遵循其發布來源的授權。

## 開發者記錄

這是發生什麼問題時，用來尋找原因的記錄。平常不使用也沒關係。

開啟 **{{ui:settings.title}}** 的 **{{ui:settings.showDevLog}}** 後，左側導覽列會出現「{{ui:app.devlog.short}}」的按鈕。按下後，右側會開啟 **{{ui:app.devlog.title}}** 的面板。

這裡會附上時間，排列應用程式的內部記錄（後端的記錄）、畫面的警告，以及沒有被攔截到的錯誤。

- 用上方的選項，可以篩選為 **{{ui:app.devlog.level.all}}**、**{{ui:app.devlog.level.warn}}**、**{{ui:app.devlog.level.error}}**。
- 在篩選欄輸入文字，就只會顯示含有該文字的列。
- 用 **{{ui:app.devlog.copy}}** 可以把顯示的列複製成文字。回報問題時，可以貼上使用。
- 用 **{{ui:app.devlog.clear}}** 可以清除。

> 記錄是開啟應用程式期間的紀錄。關閉後，畫面上的記錄就會消失。詳細的查找方式請見[遇到問題時](10-troubleshooting.md)。
