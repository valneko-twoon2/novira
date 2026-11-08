---
covers:
  - frontend/src/state/ui.ts
  - frontend/src/app/SideNav.tsx
  - frontend/src/features/media/MediaTabs.tsx
  - frontend/src/app/GlobalHotkeys.tsx
  - frontend/src/app/Workspace.tsx
  - frontend/src/app/ComicWorkspace.tsx
  - frontend/src/app/RightColumn.tsx
  - frontend/src/features/agent/AgentHost.tsx
---
# ナビゲーション

一覧に戻る: [README.md](README.md)

ユーザーが画面の間を移る方法。サイドバー、数字キー、生成と漫画を 1 つの項目にまとめるメディア行。

## 動作

- 画面はすべて `frontend/src/state/ui.ts` の `TabName`（`generate`、`canvas`、`comic`、`upscaling`、`workflows`、`models`、`browse`、`queue`、`extensions`）である。この名前は契約で、キューの起点、アシスタントの画面名、保存された開始タブ、画面ごとの中央ビューが使う。
- サイドバー（`SideNav.tsx`）は `NAV` の 8 項目を並べる。マウスはボタンを押した時点で切り替え（タッチとキーボードはクリック時）、選んだ項目はフェードなしで点灯する。ボタンを離すのと 120 ms のフェードが遅れに見えたため。2026-11-04 の計測（`novira-server` 上の Chromium、実データのコピー、画像 9118 枚）: 温まった状態の切り替えは描画まで 21〜41 ms（生成、キャンバス、アップスケール）で、大半は `<Activity>` が再表示した画面の最初のレイアウト（約 640 個のボックスで 5〜10 ms。表示中の画面の再レイアウトは 0.6 ms）であり、react-resizable-panels がパネルを再登録するときに強いられる。漫画にはこれが無い。`navOf` が漫画を生成に対応づけるので、漫画の間も生成の項目が点灯したままになる。拡張機能はバーの足元にトグルボタンとして置く。その上、デスクトップアプリと `novira-server` が自分のコンピューターに配信するページ（スマートフォンでは出ない）には、ネットワークの項目があり、ホームネットワークを開閉し、ネットワークを信頼し、ペアリングコードを示し、ペアリングを求めるスマートフォンを並べる（`NetworkButton.tsx`、[02-browser-server-pairing.md](../../06-server/02-network/02-browser-server-pairing.md)）。
- 生成と漫画は 1 つの項目の下にある 2 つの画面。漫画は、両方の左パネルの上端にあるメディア行 `MediaTabs.tsx` の 6 番目のアイコン（本）である（`Workspace.tsx` と `ComicWorkspace.tsx` に載る。テスト ID `media-comic`）。ほかの 5 つのアイコンは生成のメディアの種類を選び、一度開いた種類は、別のものを表示している間も非表示のまま載り続ける（`Workspace.tsx` の `OpenedMedia`。右カラムは画像とテキストで 1 つのギャラリーを保つ）。したがって画像とテキストの切り替えは何も作り直さない。漫画の表示中にどれかを押すと生成にも戻り、漫画の表示中はどれも点灯しない。項目と `1` キーは最後に表示したモードを開く（`generateMode`。2 つのどちらかが表示されるたびに `setTab` が更新する）。
- アシスタントにサイドバー項目は無い。生成、キャンバス、アップスケール、ワークフローでは、右カラム（`RightColumn.tsx`）が、中央と同じようなタブバーを持つ 1 つの枠にギャラリー、AI の順で 2 つのタブ（`agent-open`）を持つ。キャンバスはその下にレイヤーを保ち、テキスト画面も同じ（レイヤースタック `TextLayersPanel.tsx`）。表示するタブはアシスタントの `open` なので、アシスタントを開くもの（読み取り許可の質問、拡張機能マネージャーからの質問）は AI タブを表示し、アシスタントが開くとカラム自体も開く。漫画は自分のカラムを持つ。どの画面がアシスタントを持つかは `frontend/src/state/ui.ts` の `ASSISTANT_IN_COLUMN` で決まる。ほかの画面（モデル、探す、キュー、拡張機能）では、何かが呼んだ画面（拡張機能マネージャーからの質問、許可の質問）でだけ、アシスタントが画面の上に自分のウィンドウで浮かぶ（`AgentHost.tsx`）。右カラムに開いたままでも、それらの画面にはついて来ない。一度開いた画像の画面はすべて載ったままなので、各画面は表示されるたびにサイドカラムの幅（`panelWidths`、ピクセルの小数まで保つ）を取り直す（`Workspace.tsx`）。各画面のカラムは自分のチャットを持つので、下書きと添付画像はストアに置き（`draftText`、`draftAttached`）、ユーザーについて画面を移る。
- 漫画を開くコード（アシスタントの navigate ツール）はタブを `comic` にする。それ以外は変わらない。アップスケールは独立した項目で、フレームのアイコンを使う。
- 数字キーは `NAV_HOTKEYS`（`GlobalHotkeys.tsx`）に従う。1 生成、2 キャンバス、3 アップスケール、4 ワークフロー、5 モデル、6 探す、7 キュー、8 拡張機能。漫画に専用のキーは無い。
- 開始タブの設定は、サイドバーの 8 項目か「最後のタブ」（`frontend/src/state/settings.ts` の `restoreSettings`、`applyStartTab`）。最後のタブは漫画でもありうる。漫画や生成を開くと、生成の項目が開き直すモードにもなる。

## 境界

無し。ナビゲーションは WebView 内の画面状態で、境界をまたがない。

## 既知の限界

- メディア行があるのは生成と漫画の画面だけ。ほかの画面からは、漫画は生成の項目から行く。
- 当面、アプリのビルド（Vite のモード `production`）は動画、音楽、音声、漫画の画面を省く（`frontend/src/state/ui.ts` の `HIDDEN_TABS` と `isScreenShown`）。開発サーバー、テスト、すべてのハーネスビルド（`scripts/tools/harness-paths.mjs` の `HARNESS_MODE`: e2e ビルド、検証アプリ、ブラウザ用サーバー）はすべて表示する。隠した画面への入口は無い。ストアの `setTab` と `setMedia` が拒否し（保存された開始タブが `comic` でも生成が開く）、ギャラリーのメニューは画像をそこへ送る項目を外し、設定の「漫画・テキスト」タブは漫画の行を外してテキストの行だけを残し（タブ名は「テキスト」になる）、アシスタントはその画面を知らされず（`agentGuide`）、エディターも与えられず、ツールは使えないと答える。

## 未実装

- キャンバスはまだ独立したサイドバー項目である。
