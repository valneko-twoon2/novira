---
covers:
  - frontend/src/state/comic/request.ts
  - frontend/src/state/comic/generate.ts
  - frontend/src/state/comic/results.ts
  - frontend/src/state/comic/castRegions.ts
  - frontend/src/state/comic/characterLook.ts
  - frontend/src/state/comic/posePreset.ts
  - frontend/src/state/comic/balloonPlace.ts
  - frontend/src/features/comic/PanelTakes.tsx
  - frontend/src/state/comic/panelFix.ts
  - frontend/src/state/comic/fixState.ts
  - frontend/src/features/comic/PanelFix.tsx
  - frontend/src/state/comic/characterSheet.ts
  - frontend/src/features/comic/CharacterSheet.tsx
  - frontend/src/state/comic/places.ts
  - frontend/src/features/comic/Place*.tsx
  - frontend/src/features/comic/PanelPlace.tsx
---
# コミックのコマの絵

一覧に戻る: [README.md](README.md)

コミックのコマが絵を得る仕組み。コマを描くキューのジョブ、登場人物を同じに保つ言葉と参照画像、複数人のコマの領域、ポーズ、コマが持つ以前の絵、絵の一部の描き直し。保存文書は [01-comic-canvas.md](../01-canvas/01-comic-canvas.md) に、アシスタントの `scene` 操作は [03-comic-scene.md](03-comic-scene.md) にある。

## 動作

- コマの絵は通常の生成ジョブ（origin `generate`、destination `gallery`、反復 1 回。`state/comic/request.ts`）。フロントエンドは待機中のキュー項目 ID をメモリに持ち（`state/comic/store.ts` の `pending`）、依頼したコマに絵を置く（`results.ts`）。描くボタンには 3 つの範囲がある（選択中のコマ、ページ、コミック全体）。範囲内でプロンプトのあるコマを読む順にキューへ入れ、キューに入れる前に、描画とアップロードの途中のポーズを待つ（`state/comic/posePreset.ts` の `posesReady`）ので、コマがポーズ画像を欠くことはない。
- プロジェクトは `cast`（最大 8 人。名前と外見タグ、600 文字）を持ち、各コマはそこに出る登場人物の ID（`cast`）を持つ。描くとき、コマの登場人物の言葉をプロンプトの前に置く（`state/comic/request.ts` の `castTags`）。タグ、続いてコマのプロンプトの構図が見せるパーツ（`parts`：髪、目、顔、服装、体、アクセサリー。各 120 文字。`state/comic/characterLook.ts`：アップ、上半身、後ろ姿、それ以外は全身）。`nonHuman` を付けた人物（怪物や動物など）は、どの構図でも全パーツを使い、参照画像は `no humans` で描く。これで人物の外見は 1 回書けばよく、コマは画面外のものを名指ししない。ポートレートは全パーツを使う。
- すべてのコマはコミックのスタイルの言葉（`state/comic/style.ts`）で描く。品質の言葉をプロンプトの前に、共通のネガティブをコマのネガティブの後ろに付ける。ページ固有のものかコミックのものを使い、なければメインモデルのファミリーの既定（`defaultStyle`）を使う。描画設定で編集でき（ユーザーのアーティストタグもここに入れる）、アシスタントの `style` 操作でも編集できる。既定のネガティブには色の言葉を入れない。コマはカラーで描き、ページは効果で白黒にするため。アシスタントには、メインモデルに合わせたコマのプロンプトの書き方を伝える（`get_comic_page` の `promptStyle`：SD 系はタグ、新しい系統は文。`promptStyleOf`）。長い文はタグモデルでは出来が悪かったため。
- コミックは背景が変わらないよう、舞台と世界観の 1 行を持つ（文書の `places` と `world`。`state/comic/request.ts` の `settingWords`）。舞台（`place`）を名指ししたコマは、自分のプロンプトの後に舞台の言葉を付け、すべてのコマは最後に世界観の言葉を付ける。舞台の除く言葉はコマのネガティブに加わる（`panelNegative`）。タグのプロンプトは人物とその行動を先に書くため、これらはプロンプトの後ろに置く。アップ（`framingOf`）には舞台の言葉を `CLOSE_PLACE_WEIGHT` で付ける。実エンジンでは、全強度だと被写体から画面を奪ったため。領域で描くコマは、これらを全体のプロンプトに残す。コマのツールで、コマの舞台の選択、舞台の追加、その言葉の編集ができる（`PanelPlace`）。アシスタントは `places` 操作と `panel` の `place` で書く。登場人物のポートレートとシートの各ビューは舞台を取らず、無地の背景で描く。
- 登場人物は参照画像（`imageName`）も持てる。その人物が出るコマは、コミックがキャラクター参照をオンにしたときだけ、それを IP-Adapter の参照として描く（`castReference`。強さ 0.1〜1、描画設定かアシスタントの `castReference` 操作で設定する。既定はオフ）。`characterRefs` は強さをコマの登場人物で分け合い（`referenceWeight`）、最初の 60%（`CAST_REFERENCE_END`）のステップに効かせ、アダプターは plain で、CFG スケールは設定のまま。複数のコマを描くとき、コマが登場人物の画像を使い（`usesCastPictures`：FLUX.2、または参照オンで IP-Adapter がインストール済み）、画像のない人物がいると、`ensurePortraits`（Invoke のビルドと `drawPanels` が呼ぶ）が先に、その人物ひとりの絵をキューに入れる（`portraitRequest`：タグと無地の白背景、1024 の正方形、ポーズも参照もなし。舞台や他の人物が参照に紛れ込まないため）。それを待って参照にしてから、コマをキューに入れる。絵が届かないとき（30 分）は、それなしでコマをキューに入れる。
- 登場人物はシートを持てる。斜め前、横、後ろ、顔の絵（`sheet`、`state/comic/document.ts` の `SHEET_VIEWS`）。各ビューは、その人物の絵（正面）を IP-Adapter の参照にして、ビューの言葉とそのビューが見せるパーツで描く（`sheetRequest`）。ほかのビューからは決して描かない。`makeSheet`（`state/comic/generate.ts`）は、正面がなければ先に描き、次にシートに足りないビューをキューに入れる。すでに描いているビューは入れ直さない。ビューは絵が届いたときにその人物へ入る（`bindSheetItem`、`sheetPending`。`pending` と同様に保存しない）。元に戻す手順は作らず、元に戻すはビューをそのままにする。今はシートを表示する画面がない。`frontend/src/features/comic/CharacterSheet.tsx` を使うのは `CastCharacter` のコミック全体モード（`panelId` なし）だけで、デザインタブの削除以降はどの画面もこれを使わない。アシスタントの `sheet` 操作が作る。
- メインモデルが FLUX.2 のときは、コマは IP-Adapter の参照の代わりに、登場人物の画像を参照画像としてモデル自身に渡し（`request.ts` の `castPictures`、最大 `MAX_REFERENCE_PICTURES`）、ガイダンスは下げない。シートのビューには正面の画像をその方法で渡す。Qwen-Image-Edit-Plus はコマには使わない。元画像が必要なため。
- 参照を使うコマは、各登場人物の参照として、プロンプトが必要とするビューを取る（`state/comic/characterSheet.ts` の `viewFor`：後ろ姿とアップは構図で、次に横と斜め前の言葉で決める）。シートにそのビューがないか、ギャラリーから消えたときは正面を使う。
- コミックの登場人物は、キャラクターライブラリのキャラクター（`libraryId`）にひも付けられ、それが LoRA を持つことがある（LoRA の学習は別アプリ novira-train にある）。コマは、LoRA をオンにしてインストール済みで、メインモデルのファミリーと合うもののうち、1 人だけのときその人物の LoRA を使い（`request.ts` の `castLora`）、トリガーワードをプロンプトの先頭に置く。2 人以上いるときはどれも使わない。
- 2 人以上の登場人物をポーズの人物に割り当てたコマ（`poseCast`。アシスタントの `who` か登場人物のツールで設定する。ないときは、人間の登場人物の数がポーズの人数と同じなら、コマの順に割り当てる）は、領域で描く（`state/comic/castRegions.ts`）。各人物の言葉と、その人物の行動（`poseWords`。シーンから）が、その人物を広げたボックスの上の領域レイヤーになり（`autoNegative` 付き）、参照画像には `regionImageUrl` と同じマスクを付ける（同じマスクは 1 回だけ保存して使い回す）。割り当てのない人物はコマの残りを共有し、コマのプロンプトは登場人物の言葉を含まない。マスクは中間のギャラリー画像で、コマをキューに入れる前に描く。対象は SD 1.5、SD 2、SDXL のメインモデル（コマ自身のページのモデル）だけ。それ以外のとき、人物が割り当てられていないときは、人間が同じコマにいると、人間でない登場人物の参照は外す。
- ポーズが ControlNet レイヤーとして送られるのは、選んだメインモデルに合う OpenPose モデルがあるときだけで、アシスタントにはそうなっているかを伝える（`get_comic_page` の `poseControl`）。レイヤーはそれがポーズだと伝える（`controlType`）ので、統合 ControlNet は体を読むと分かる。推測させると、棒人間を針金として描いたものがあった。アシスタントが `back` を与えた人物は後ろ姿で描く（顔を隠し、左右を入れ替える）。`neck` は枠内の人物を配置する（`readPoseSpec`）。ポーズは、制御画像のアップロードより前に、コマにすぐ設定するので、続く吹き出しが人物の立ち位置を使える。コマの 3D ラフは、深度マップを 2 つ目のレイヤーとして加える（[02-comic-rough.md](02-comic-rough.md)）。
- アシスタントが `speaker`（コマのポーズでの人物の番号）を与えた吹き出しは、その人物の近くの空き領域に、他の人物や、コマの他の吹き出しから離して置き、尾はその口に向ける（`state/comic/balloonPlace.ts`。吹き出しの大きさは言葉から見積もり、後で画面が実際の大きさに合わせる）。アシスタントが作った、または言い換えた吹き出しは、言葉を小さくして、コマに対する `BALLOON_LIMIT`（幅約 0.42、高さ 0.5、面積 0.11）以内に収める。その大きさで空き場所がないものは、収まるまで小さくする（擬音の文字は大きいまま）。コマは `figures`（最大 8 個のボックス。コマに対する割合）も持つ。アシスタントが、ポーズでは表せない動物などのために書き、吹き出しは人物と同じようにそれを避ける。これは描画もエンジンへの送信もされないので、プロンプトでそこに動物を指定する必要がある。
- コマは `takes` を持つ。以前の絵を最大 `TAKES_MAX` 枚（ギャラリー名とそのときのビュー）、新しい順に持つ。`setPanelImage` は、新しい絵が置き換える絵（描き直し、手で入れた絵）か、取り外した絵を先頭に置く。以前の絵をもう一度与えると元の位置のまま一覧から外れる。一覧にコマ自身の絵や同じ絵が 2 回入ることはない。元に戻すは、絵と同様に一覧をそのままにする。ページツールバーの絵の履歴（`frontend/src/features/comic/PanelTakes.tsx`）は、絵を戻す、または一覧から外す（絵はギャラリーに残る）ことができ、ギャラリーにもうない絵は除く。アシスタントは `earlierPictures`（枚数）を読み、`take` 操作で戻す。

- 描いたコマの絵の一部は、描き直せる（インペイント）。ページツールバーのブラシボタンで、選択中のコマへの塗りが始まる（`state/comic/fixState.ts`、保存しない）。コマの上のストローク（コマに対する割合、最大 `FIX_LIMITS`）、ブラシの太さ、その部分の言葉（空ならコマのプロンプト）、強さ（`FIX_STRENGTH`）を持つ。別のコマを選ぶと終わる。アシスタントは代わりにボックスで示す（`fix` 操作、コマに対する割合で最大 8 個）。`redrawPart`（`state/comic/generate.ts`）は、絵がコマに置かれている状態の逆変換（`state/comic/panelFix.ts` の `panelToPicture`：中心、回転、反転。`pageRender` の描き方と同じ）を通して、絵自身の大きさでマスクを描き、中間画像として保存し、`fixRequest`（`state/comic/request.ts`）をキューに入れる。origin `generate`、mode `inpaint`、元画像は絵、コマのスタイル、登場人物の言葉、（コミックが使うなら）参照画像、ポーズなし、高解像度パスなし、サイズは絵の大きさを 8 の倍数に丸め、1 辺 2048 ピクセルまで。エンジンが描き直した部分を絵に貼り戻す。新しい絵は古い絵の位置・ズーム・回転でコマに入り、古い絵は `takes` へ行く。コマのモデルが FLUX.2、絵がギャラリーから消えている、モデルがない場合は、すぐ拒む（`fixTarget`）。アシスタントの `fix` でも同じ。

## 既知の限界

- 登場人物の言葉が保つのは髪と服で、顔ではない。参照画像で顔は近づくが、コマ間の差は残る。参照をオフ（既定）にすると、人物が LoRA を持たない限り、コマ間で顔がより大きくずれる。
- 正面の絵から描いたビューが言葉どおりに向くか（特に後ろ姿）は、モデルによる。うまくいかなかったビューは外して描き直す。

## 未実装

- アプリを閉じたときにまだ待機中のコマのジョブは、ギャラリーには入るがコマには入らない。待機中の ID を保存しないため。
