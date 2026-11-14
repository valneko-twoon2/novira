---
covers:
  - frontend/src/features/text/TextPanel.tsx
  - frontend/src/features/text/TextCanvas.tsx
  - frontend/src/features/text/TextBackgroundBar.tsx
  - frontend/src/ui/EmptyOverlay.tsx
  - frontend/src/features/text/TextAddBar.tsx
  - frontend/src/features/text/TextLayersPanel.tsx
  - frontend/src/features/text/TextCandidates.tsx
  - frontend/src/features/text/TextFloatingBar.tsx
  - frontend/src/features/text/barPlace.ts
  - frontend/src/features/text/TextScenePresetBar.tsx
  - frontend/src/features/text/saveScene.ts
  - frontend/src/state/presets/textScenePresets.ts
  - frontend/src/state/text/textSources.ts
---
# テキスト: 画面のレイアウト、テンプレート、開き直し

一覧に戻る: [README.md](README.md)

テキスト画面（生成タブの text）は生成画面と同じ配置で、シーンをベクターのレイヤーとして保つ。文字を AI で塗る方法は [05-text-rich.md](05-text-rich.md)。

## レイアウト
- **左の列**は生成画面と同じ部品と並びで、上から、プリセットのカード、シードの行、生成バー（キュー操作を含む）、モデルのカード、プロンプト欄、折りたたみの詳細（`RichSection.tsx` と [05-text-rich.md](05-text-rich.md)）、選択中のレイヤーの設定。各セクションは生成画面と同じく折りたためる。文字レイヤーのスタイルプリセットのカード（`TextPresetBar.tsx`、「文字の見た目」）は、そのレイヤーに適用するものなので、設定の先頭に置く。
- **中央のタブ**: 「テキスト」（編集のキャンバス）と「ビューア」（`app/Workspace.tsx` の `TextMain`、`useUi` の `textView`）。ギャラリーの画像を開くとビューアに切り替わる。編集のキャンバスはビューアの裏でマウントされたままにする。バックグラウンドのジョブが終わっても切り替えない（`showViewer` は引数なしの呼び出しだけが切り替える）。
- **キャンバスのツールバー**（`TextCanvas.tsx`）: 文字の追加、吹き出しの追加（形のメニュー）、元に戻す・やり直し、ズーム、背景とサイズ（`TextBackgroundBar.tsx`: 画像・色・透明の切り替え、色、よく使うサイズの一覧と幅・高さ。画像の背景は画像の大きさになるので、大きさだけを出し、画像の名前は i マークのツールチップに出す）、ギャラリーへの保存。狭いと 2 行目に折り返す。
- **空のキャンバス**: レイヤーが 1 つもないあいだ、キャンバスの真ん中にキャンバス画面と同じ案内のカード（`frontend/src/ui/EmptyOverlay.tsx`）を出す。ポインターを通すので、下のキャンバスの操作を妨げない。
- **クイックバー**（`TextFloatingBar.tsx`）: 選択中の表示されているレイヤーの上に出る。文字レイヤーのフォント、サイズ、塗りの色と輪郭の色、吹き出しの塗りと枠の色、複製と削除。バーの大きさは実測し、`barPlace.ts` がレイヤーの回転後の境界の上に置き、上に余白がなければ下、どちらもなければ上端に置く。いずれもシートの内側に収める。レイヤーをドラッグしているあいだは隠す。ほかはすべて左の列に残るので、操作がバーにだけあることはない。
- **右の列**: ギャラリーの下のレイヤーの積み重ね（`TextLayersPanel.tsx`。`app/RightColumn.tsx` がマウントし、キャンバスタブと同じ方式）。新しいものが上。
- **切り替え。** 生成タブで画像とテキストを行き来しても、開いた画面は作り直さず隠すだけにする（`Workspace.tsx` の `OpenedMedia`、`<Activity>`）。色の入力（`ColorInput`）は、ピッカーをドラッグしているあいだの変更を 1 フレームに 1 回へまとめ（最初の 1 回はすぐ、残りは最新の値だけ）、描き直しを減らす。
- **キャンバスの下**: 選択中の文字レイヤーの AI の候補（`TextCandidates.tsx`）。押すと 1 つを塗りにする。古くなった通知は新しい実行を勧め、1 つのボタンで通常の塗りへ戻る。

## テンプレート
テンプレート（画面の表示はプリセット。`textScenePresets.ts`、プリセットストア `novira.textScenePresets`）は、レイヤー（語、位置、スタイル、吹き出し、AI の塗り）とシートのサイズを保ち、シーンに単色の背景があればその色も保つ。背景の画像は含まない。適用するとレイヤーが置き換わり（新しい id、元に戻す 1 ステップ）、選択は解除される。画像の上で適用するとき、またはテンプレートが画像の上で作られたものなら、レイヤーを現在のシートに合わせて拡縮する。中心は各軸に沿って、サイズはすべて小さいほうの倍率で。単色の背景では、テンプレート自身のシートと色を使う。レイヤーの AI の塗りは名前で保たれ、フォントサイズに追従するので、拡縮しても新しい画像は要らない。

## 保存した画像を開き直す
ギャラリーに保存すると（`saveScene.ts`）、新しい画像の名前でシーンも保つ（`textSources.ts`、`novira.textSources`、新しい 30 件）。するとギャラリーのメニューにその画像の「テキストで編集」が出て、シーンを元に戻す 1 ステップとして戻す。シーンはこのデバイスにだけある。別のデバイスの画像や、新しい 30 件を過ぎた画像は通常の画像で、背景としては使える。

## 既知の限界
- AI の塗りは非表示のギャラリー画像: 設定の「中間画像を消去」で削除され、テンプレートや開き直したシーンは通常の塗りになる。
- 画像の上で作ったテンプレートは比率で配置するので、形の違う画像では文字がほかのものの上に載ることがある。
