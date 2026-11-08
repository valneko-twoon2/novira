---
covers:
  - backend/crates/novira-core/src/service/canvas.rs
  - backend/crates/novira-core/src/service/comics.rs
  - backend/crates/novira-core/src/fonts.rs
  - backend/crates/novira-core/src/db.rs
  - backend/crates/novira-core/src/types.rs
  - frontend/src/state/canvasPersistence.ts
  - frontend/src/state/canvasDocument.ts
  - frontend/src/state/comic/**
  - frontend/src/state/fonts.ts
  - frontend/src/features/comic/pageRender.ts
  - frontend/src/features/comic/pagePsd.ts
---
# キャンバス、コミック、ワークフロー、フォント

一覧に戻る: [README.md](README.md)

4 つの画面の保存文書。キャンバスはレイヤー・マスク・バウンディングボックスを 1 つの JSON テキストとして保存する。コミック画面は各プロジェクトをデータベースの 1 行として保存する。保存したノードワークフローは別々の行になる。コミックとテキストエディターのフォント一覧は、インストール済みのフォントから読む。バックエンドは大きさと形を検査したうえで文書をそのまま保存する。文書の形はフロントエンドが持ち、読み戻したものもフロントエンドが検査する。

## 動作

### キャンバス文書

- `novira.sqlite` の `meta` テーブルのキー `canvas` に 1 つのテキストとして保存する（`service/canvas.rs`）。`load_canvas` はそのテキストか `null` を返し、`save_canvas` は置き換える。バックエンドはフィールドを読まない。
- `save_canvas` は、32 MiB を超えるテキストと JSON オブジェクトでないテキストを、書く前に拒む。
- フロントエンドの文書（`frontend/src/state/canvasPersistence.ts`、`version` 1）は `entities`、`selectedEntityId`、`bbox`、`groupHidden`、`viewport` を持つ。元に戻す履歴は含まない。
- エンティティ、ボックス、選択、非表示グループのいずれかが変わると、1 秒後（`SAVE_DELAY_MS`）に保存を始める。その間に再び変わるとタイマーをやり直す。アプリを閉じるとき保留中の変更は保存されないため、最後の 1 秒の変更は失われる。
- 復元は起動時に 1 回、ブートストラップのデータが入った後で行う（`frontend/src/state/wiring.ts`）。保存を始めるのは、バックエンドからテキストを読めたときだけ。フロントエンドが使えないテキスト（別の版、JSON でない、`bbox` がない）は無視し、次の保存で置き換える。
- 復元では、未知のエンティティ種別、壊れたエンティティとオブジェクト、保存名のギャラリー画像がもう存在しない画像オブジェクトを捨てる。
- ページの中にしかない画像（`blob:` アドレス）は、先に非表示のギャラリー画像として保存する（`saveImageFromUrl`、`isIntermediate: true`、カテゴリ `general`）。保存はアドレスごとに 1 回で、以後は生きているレイヤーが保存済みの画像を使う。保存できなかった画像はその回の保存から外し、次の保存で再び試す。バックエンドに拒まれた保存は黙って捨て、次の変更でまた保存する。
- ブラウザのモックでは、文書はメモリ上にだけある。

### コミックプロジェクト

- プロジェクトごとに `comics` テーブル（`Table::Comics`、`db.rs`）の 1 行。ID、並べ替えキー `updated_at`、JSON 文書を持つ。通信上の型は `ComicRecord { id, updatedAt, document }`（`types.rs`）。プロジェクトはメモリ上の状態に持たず、`list_comics` がテーブルを読み、変更の古い順に返す。
- `save_comic(id, document)`（`service/comics.rs`）は次を拒む。空・64 文字超・ASCII の英数字と `-` と `_` 以外を含む ID、JSON オブジェクトでない文書、JSON テキストが 32 MiB を超える文書。`updated_at` を記録し、文書はそのまま保存する。
- `delete_comic(id)` は行を消す。未知の ID は何もしない。プロジェクトの画像はギャラリーに残る。
- フロントエンド（`frontend/src/state/comic/document.ts`）：各文書は `version` 2（`COMIC_VERSION`）を持つ。version 1 も読み、移行する（後述）。別の版の文書や文字列の `id` がない文書は、復元で飛ばし、書き戻さない。画面はプロジェクトを新しい順に並べる。プロジェクト ID は `comic-<uuid>`（`newComicId`）で作る。
- 各プロジェクトは最後の変更の 1 秒後に保存する（`frontend/src/state/comic/persistence.ts`）。削除したプロジェクトはすぐ消す。保存を始めるのは一覧を読んだ後だけ。
- ページは `canvas` を持つ。レイヤーはページのピクセル単位のキャンバスレイヤーで、version 1 の文書（コミック固有の以前のレイヤースタック）は読むときに移行する。ページのレイヤー、ペイントモード、インペイントは [02-comic-layers.md](02-comic-layers.md) にある。
- コマは `imageName` と `poseImageName`（ギャラリー名）、`poses`（1 人あたり 18 関節のリスト、コマに対する割合）、`takes`（以前の絵）を持つ。`poseCast` と `poseWords`（ポーズの各人物が誰で何をしているか）、`rough` と `depthImageName`（3D ラフと、そこから焼いた深度マップ。[02-comic-rough.md](../02-drawing/02-comic-rough.md)）も持てる。コマの描き方（キューのジョブ、登場人物の言葉と参照画像、領域、ポーズ、以前の絵）は [01-comic-drawing.md](../02-drawing/01-comic-drawing.md) にある。
- プロジェクトは `places`（最大 `PLACES_MAX` 個。名前、舞台の言葉、除く言葉）を持ち、`world`（全コマに付ける言葉。`WORLD_MAX` で切る。言葉がなければ持たない）も持てる。コマは舞台を名指し（`place`、舞台の ID）でき、その舞台が削除されると外れる。プロンプトへの渡り方は [01-comic-drawing.md](../02-drawing/01-comic-drawing.md) にある。
- プロジェクトは `castReference`（登場人物の IP-Adapter 参照の強さ。0.1〜1、読むとき範囲内に収める）を持てる。ないとコマは参照を使わない（[01-comic-drawing.md](../02-drawing/01-comic-drawing.md)）。
- ページレイアウト、文字入れの検査、擬音の画像は [03-comic-pages.md](03-comic-pages.md) にある。
- コミックの元に戻す・やり直しで戻るのは、ページ、コマ、吹き出し。戻らないのは、レイヤー（[02-comic-layers.md](02-comic-layers.md)）、画像、シート、テンプレート、名前、描画設定、スタイル、キャラクター参照（`history.ts`）。コマは、人がコミック画面の外にいても、コミックとページの描画設定をフォームに重ねて描く（`withPageDraw`、`drawSync.ts`）。このフォームの入れ替えには印（`isSwappingDraw`）を付け、コミックの変更リスナーは無視する。コミック画面の外では準備状況のヒントがリクエストを作り、リクエストがフォームを入れ替え、それがリスナーに再び通知して、際限なく続くためである。
- ページは 1 つの順序で描く。保存する絵は `frontend/src/features/comic/pageRender.ts` の `pageGroups`、PSD 書き出しは `pagePsd.ts`（不透明度、ブレンド、表示を保つ）、ページのサムネイルは `PageThumb.tsx`。ユーザーの各ラスターはキャンバス自身の描画コード（`ui/canvasDraw`）で専用のキャンバスに描くため、その消しゴムは自分のストロークにしか届かない。スロットの部品はまとめて先に描き、スロットの不透明度とブレンドでページに重ねる。

### ワークフロー

- 保存したワークフローとワークフローエディターは [02-workflows.md](../../02-generation/02-media-workflows/02-workflows.md) にある。
- ギャラリーのボードはここでは扱わない。[02-gallery-share.md](../../04-gallery/01-files/02-gallery-share.md) を参照。

### フォント

- `list_fonts` は引数を取らず、UI スレッドの外で動く（`backend/src-tauri/src/commands.rs`）。`fonts::installed_families()`（`backend/crates/novira-core/src/fonts.rs`）を返す。これは `HKEY_LOCAL_MACHINE`、次に `HKEY_CURRENT_USER` の `SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts` 以下の値名だけを、ワイド文字 API で読む（キーごとに最大 20000 個）。プロセスは起動しない。Windows 以外では一覧は空。
- 取るのは TrueType と OpenType のフォントだけ。`@` で始まる名前とビットマップフォントは除く。フルネームは、末尾からスタイルの語を落としてファミリーにする（1 語は必ず残す）。` & ` でつながった名前は別々に数える。各ファミリーは 1 回だけ現れ、大文字小文字を区別せず並べ、最大 3000（並べた後で切る）。128 文字を超えるファミリー、または `"`、`\`、`;`、`{`、`}`、制御文字を含むファミリーは捨てる。
- フロントエンド（`frontend/src/state/fonts.ts`）：一覧はフォントピッカー（`frontend/src/ui/FontPicker.tsx`）が初めて開いたときに 1 回読み込み、アプリ自身の同梱フォントは取り除く。コミックの吹き出しエディター、テキストエディター（`features/text/StyleControls.tsx`）、設定のペインがピッカーを使う。
- アプリ自身のフォント（Fontsource。`@font-face` の規則で約 1.4 MB）は専用のスタイルシート（`frontend/src/state/appFontFaces.ts`）にあり、`loadAppFonts` が 1 回だけ読み込む。読み込むのは、フォントピッカーかコミックの吹き出しが初めて表示されるとき（`useAppFonts`）、またはキャンバスが文字を描くとき（`ensureFont`）。吹き出しは規則が入った後にだけレイアウトするため、代替フォントで先に表示・中央寄せ・フィットされることはない。画面自身の文字はシステムフォントを使い、これらを必要としない。
- コミックの吹き出しに保存したフォント名は `parseFont`（`frontend/src/state/comic/document.ts`）で読む。前後の空白を除いた 128 文字以下で、`"`、`\`、`;`、`{`、`}`、`<`、`>`、制御文字を含まないもの。それ以外はフォントなしとして読む。

## 境界

| 境界 | 防ぎ方 |
|---|---|
| キャンバス文書（`load_canvas`、`save_canvas`） | 文書は `meta` テーブルの 1 つのテキストで、バインドパラメーターで書く。`save_canvas` は 32 MiB を超えるテキストと JSON オブジェクトでないテキストを書く前に拒み（`service/canvas.rs`）、バックエンドは中身を解釈しない。フロントエンドは復元時にテキストを入力として扱う。未知のレイヤー種別、オブジェクト、壊れた部分は捨て、画像は保存名のギャラリー画像からしか取らない。 |
| コミックプロジェクト（`list_comics`、`save_comic`、`delete_comic`） | 各コミックは `comics` テーブルの 1 行で、バインドパラメーターで書く。`save_comic` は書く前に、空・長すぎる・ASCII の英数字と `-` と `_` 以外を含む ID、JSON オブジェクトでない文書、JSON テキストが 32 MiB を超える文書（キャンバス文書と同じ上限）を拒む（`service/comics.rs`）。バックエンドは文書を解釈しない。`delete_comic` は ID だけを取る。 |
| インストール済みフォント名 | `list_fonts` は何も取らず、レジストリのフォント一覧を読むだけ（`fonts.rs`、ワイド文字のレジストリ API、プロセスなし）。返るのは 128 文字以下の名前を最大 3000 個で、引用符、バックスラッシュ、セミコロン、波括弧、制御文字を含む名前は捨てる。画面が名前を CSS の `font-family` の値に入れるため。コミックの吹き出しに保存したフォント名は `parseFont`（`state/comic/document.ts`）で読み、同じ文字に加えて `<` と `>` も拒む。 |

## 既知の限界

- コミックプロジェクトは暗号化せずにデータベースに保存され、キャンバス文書と同様にバックアップに含まれる。
- キャンバス文書（レイヤー、マスク）は暗号化せずにデータベースに保存され、画像と同様にバックアップに含まれる。結合・変形したレイヤーの画像は、レイヤーがなくなった後も非表示の画像として `outputs/` に残る。
