---
covers:
  - frontend/src/state/imageTools/**
  - frontend/src/features/viewer/tools/**
  - frontend/src/features/gallery/menus/SingleImageMenu.tsx
---
# 画像のツール: 「直す」グループとツールバンド

完成した画像に対する 4 つの工程。どれもアプリの ComfyUI グラフのジョブで、顔を直す（Impact Pack の FaceDetailer）、背景を除去する（RMBG）、画像をプロンプトにする（Florence-2）、人物のポーズを読む（DWPose）。画像メニューからすぐ実行するか、設定のあるビューアの画像の上のバンドから実行する。画像はビューアに残るので、ズームや比較ができる。

## 動作

- **メニュー。** `SingleImageMenu.tsx` は 4 つを見出し `gallery.tools.heading` の下にまとめる（ポーズを読むのは電話では出さない）。項目は `quickRunTool`（`frontend/src/state/imageTools/actions.ts`）を呼ぶ。画像を表示し（`toolViewer().showPicture`。デスクトップはビューア、電話は全画面表示）、バンドをそのツールのステータスモードで開き、ノード定義が未知なら読み込み（`loadToolNodes`）、保存済みの設定で実行を始める。準備ができていないツールは、代わりにバンドを設定で開き、その理由を示す。右端の歯車の項目（`frontend/src/ui/overlays.tsx` の `ContextMenuSplitItem`）は `openToolSettings` を呼び、実行せずにバンドを設定で開く。
- **ほかの入口。** ビューアのツールバーの切り抜き・顔・キャプションのボタンは、表示中の画像でバンドを開閉する（`toggleToolBand`）。プロンプト欄の説明ボタンと、キャンバスのポーズツールの「画像からポーズ」ボタンは、ギャラリーで選択した 1 枚の静止画に対してツールを実行し、なければ先にファイルを選んでアップロードしてから実行する（`frontend/src/state/imageTools/pickPicture.ts`）。説明ボタンはドロップされた画像やファイルも受け取る。
- **バンド。** `frontend/src/features/viewer/tools/ToolBand.tsx`。デスクトップは `ImageViewer.tsx` がツールバーの下に、電話は `PhoneView` が画像の上にマウントする。状態（開閉、ツール、画像、モード `settings` か `status`、この画像の顔を直すモデルとプロンプト）は `band.ts` の `useToolBand`。スイッチでツールを切り替える。設定モードはツールの欄（`ToolFields.tsx`）と「実行」、または足りないもの（`readiness.ts`。読み込み中、インストールする拡張機能とそのインストールまたは再起動ボタン、顔検出なし、モデルなし）を示す。ステータスモードはその画像に対するツールの直近の実行（`ToolRunView.tsx`）を示す。待機中または処理中はキューの進捗とキャンセルボタン、終了後は使った設定と「設定を変えてやり直す」。バンドはビューアが別の静止画へ移るのに追従するが、ツールの実行が作った画像には追従しない（`madeByToolRun`。実行が結果を得る前にキューの項目から判別する）。
- **設定。** `useImageToolSettings`（`settings.ts`、キー `novira.imageTools`、ほかのページに即時に反映）が各ツールの前回の設定を保つ。バンドでの変更はすぐ保存される。保存値は `restoreToolSettings` で読み戻す（範囲は `TOOL_RANGES`）。顔を直すモデルとプロンプトはその画像自身のもの（`request.ts` の `faceFixModel`、`faceFixPrompt`）から始まり、バンドがその画像にとどまるあいだだけ保たれる。
- **実行。** `startToolRun`（`runs.ts`）がジョブを組み立て（`buildToolJob`。`frontend/src/state/comfy/` のグラフビルダーで、画像のジョブは画像のボードに、テキストのジョブはギャラリーに出さない）、`runJob` / `runTextJob` で待つ。中止コントローラーは自分で保つので、どの画面も実行を所有しない。バンドを閉じても、画面や画像を切り替えても実行は続き、初回の実行がジョブの中でダウンロードするモデルも続く。キューの項目をキャンセルするのは `cancelToolRun`（バンドのキャンセルボタン）だけ。バンドが始める拡張機能のインストールは `useNodePacks` とダウンロードドックを通り、これもバンドに依存しない。`useToolRuns` が各ツールの直近の実行を保つ。同じツールの古い実行も最後まで走って画像を保存するが、もう表示されない。
- **結果。** 画像はジョブがギャラリーに保存する。バンドがまだその画像でそのツールを表示していれば、ビューアが結果を元の画像と比較する（`toolViewer().showResult`。電話は結果を全画面で表示する）。説明は編集できるテキストとして、置き換え・追加・コピーつき（`applyDescription`）で表示する。ポーズは見つかった人数と、キャンバスが登録する配置処理（`posePlacer.ts` の `registerPosePlacer`。キャンバスも表示する）を通してキャンバスへ置くボタンつきで表示する。バンドが表示しないものは通知になる。画像を保存した、失敗とその理由、テキストの結果が準備できた、のいずれか。

## 境界

固有のものはない。ジョブは、アプリが書いたグラフ（`origin` `workflows`）を持つ通常のキューの項目で、ほかと同様にバックエンドが検査する（[01-generation.md](../../02-generation/01-pictures/01-generation.md)）。ツールのために選んだファイルは、ギャラリーの通常のアップロードと同じくアップロードされる。

## 既知の限界

- 表示されるのはツールごとに 1 回の実行。同じツールを別の画像で始めると、最初の実行についてバンドが示すものは置き換わる（その画像は保存される）。
- バンドが実行結果を表示しているあいだ、バンドはビューアがその結果へ移るのに追従しない。比較モードを抜けた後、別の画像を選ぶまでバンドは元の画像にとどまる。
- 顔を直す処理は、画像の LoRA を使わずに描き直す。
