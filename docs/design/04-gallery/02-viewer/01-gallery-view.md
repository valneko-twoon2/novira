---
covers:
  - frontend/src/state/generating.ts
  - frontend/src/features/gallery/GeneratingStrip.tsx
  - frontend/src/features/gallery/grid/ImageGrid.tsx
  - frontend/src/features/gallery/grid/LiveThumbnail.tsx
  - frontend/src/features/gallery/grid/FolderTile.tsx
  - frontend/src/state/boardTree.ts
  - frontend/src/features/viewer/ImageViewer.tsx
  - frontend/src/features/viewer/LiveView.tsx
---
# ギャラリーのグリッドとビューア: 描画中の画像、サブフォルダ

一覧に戻る: [README.md](README.md)

描画中の画像がギャラリーとビューアにどう表示されるか、グリッドがボードのサブフォルダをどう表示するか。保存された画像、ボード、書き出しは [02-gallery-share.md](../01-files/02-gallery-share.md)、ジョブを動かすキューは [01-generation.md](../../02-generation/01-pictures/01-generation.md) にある。

## 動作

- 実行中のジョブ（`in_progress`、宛先 `gallery`、下書きでない）が、`frontend/src/state/generating.ts` の `generatingItems` が返すもの。下書きは下書きビューへ行き、キャンバスのジョブはキャンバスに表示される。
- グリッドの上の `GeneratingStrip.tsx` は、そのようなジョブごとに描画中の画像、ステップ、細いバーを表示し、メモリ不足になった画像を通知つきで、閉じるまで保つ。
- グリッドの先頭で `LiveThumbnail.tsx` は、同じジョブを、グリッドと同じ大きさのセルとして、保存済みの画像の前に表示する。条件は、ジョブのボードが選択中のボードであること、ビューが「画像」であること、検索や日付でグリッドが絞られていないこと。セルはグリッドのレイアウト、選択、キーボード移動には含まれない。
- サブフォルダは、`parentId` が別のボードであるボード（最大 8 階層で、バックエンドの `MAX_BOARD_DEPTH` と同じ値。折りたたんだボードは設定の `foldedBoards` に残る。`state/boardTree.ts`。保存形式とディスク上のフォルダは [02-gallery-share.md](../01-files/02-gallery-share.md) と [01-gallery-files.md](../01-files/01-gallery-files.md) にある）。ボード一覧ではボードの下にインデントして表示し、移動メニューとワークフローのボード欄では `Board / Subfolder` と呼ぶ。グリッドの先頭、ライブのセルの前に、開いているボードは各サブフォルダ（アーカイブ済みは「アーカイブ済みのボードを表示」がオンのときだけ）を `FolderTile`（最新の画像、名前、枚数）として表示し、開いているサブフォルダは、ボードへ戻る 1 つのタイルを表示する。検索や日付の絞り込みがあるとき、タイルは絞り込まれるのではなく、一切表示しない。タイルはクリックで開き（ボードを選択するので、自動追加がオンなら新しい画像の宛先にもなる）、ボード一覧の行と同じく、ドロップされた画像やファイルを受け取る。サブフォルダの画像は、ボード自身の一覧には含まれない。サブフォルダはボードの右クリックメニューから作り、サブフォルダのメニューからは作れない。
- セルを押すとギャラリーストアの `viewerLiveItemId` を設定し、ビューアを表示する。ビューアは描画中の画像をステップつきで枠に収めて描く（`LiveView.tsx`）。滑らかな途中経過画像の設定がオンでなければ、ドットが見える表示になる。
- 保存済みの画像を選ぶとき（名前つきの `setSelection`、`setViewerImage`）、またはジョブがもう実行中でなくなったとき、ビューアは保存済みの画像へ戻る。完成した画像は、設定の「新しい画像に自動で切り替え」がオンなら、ほかの新しい画像と同様に選択されてビューアを占める（`wiring.ts`）。`viewerLiveItemId` はセッションをまたいで保たない。

## 境界

固有のものはない。キューがすでに持つものを表示するだけで、描画中の画像は、キューのミラーが渡すエンジンのプレビュー。

## 既知の限界

- サブフォルダを別のボードへ移すことも、サブフォルダからサブフォルダを作ることもできない。上へ戻るタイルにはカバー画像がない。
- 選択中のボードと別のボードのジョブは、ストリップにだけ表示される。
- 描画中の画像はエンジンの低解像度のプレビューなので、セルとビューアでは拡大されて粗く見える。
