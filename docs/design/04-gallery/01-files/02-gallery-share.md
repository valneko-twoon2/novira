---
covers:
  - backend/crates/novira-core/src/media/**
  - backend/crates/novira-core/src/provenance/**
  - backend/crates/novira-core/src/service/gallery.rs
  - backend/crates/novira-core/src/service/share.rs
  - backend/crates/novira-core/src/service/boards.rs
  - backend/crates/novira-core/src/service/worker.rs
  - backend/crates/novira-core/src/secret.rs
  - backend/src-tauri/src/image_scheme.rs
  - backend/crates/novira-core/src/image_serve.rs
  - backend/src-tauri/src/dialogs.rs
  - backend/src-tauri/tauri.conf.json
  - frontend/src/features/share/**
  - frontend/src/features/gallery/actions.ts
  - frontend/src/features/gallery/boards/**
  - frontend/src/state/gallery.ts
  - frontend/src/state/invoke.ts
---
# ギャラリーと共有

一覧に戻る: [README.md](README.md)

ギャラリーは、novira が作る、または受け取る画像、動画、音声を、サムネイルと埋め込み設定つきで保つ。共有用の書き出しは、ユーザーが選んだフォルダにコピーを書き、各コピーに AI 製の印（不可視の透かし、XMP のラベル、署名つき C2PA 資格情報）を付けられる。チェックはその印を読み戻す。生成は [01-media-generation.md](../../02-generation/02-media-workflows/01-media-generation.md)、バックアップは [01-settings-engine.md](../../01-app/03-engine/01-settings-engine.md) にある。

## 動作

**ファイルと名前。** 原本は `novira-data/outputs/` の下の `<uuid>.png`、`<uuid>.mp4`（動画）、`<uuid>.flac|wav|mp3`（音声）。フォルダ分けとファイル名の時刻は [01-gallery-files.md](01-gallery-files.md)。サムネイルは `novira-data/thumbnails/<stem>.thumb`で、品質 85 の JPEG、透明のある画像は PNG、256 x 256 に収める。名前が有効なのは（`images::is_valid_name`、`backend/crates/novira-core/src/media/images.rs`）、80 文字以内、上記の拡張子のいずれか、文字・数字・`-`・`_`・`.` のみ、先頭がドットでない、Windows のデバイス名でない、のとき。

**埋め込み設定。** 生成した PNG は `IEND` の前に UTF-8 の `iTXt` チャンクを持つ。`novira_metadata`（JSON の生成パラメーター）と、ジョブにあれば `novira_workflow`。ピクセルデータは再エンコードしない。そのような PNG をアップロードすると両方が復元される。

**呼び戻し。** 「すべて使用」、「リミックス」、ビューアのモデル行、顔を直す処理は、保存されたモデルをキーで取る。キーが空かインストールされていない（他のプログラムで作って取り込んだ画像）ときは、保存された名前を描画できるモデルの中から探す（`frontend/src/state/recallModel.ts`）。大文字小文字と句読点は無視し、名前またはファイル名の完全一致が優先で、なければその名前で始まる唯一のモデル。一致なし、または複数のときは現在のモデルを保ち、通知が足りないモデルの名を示す。LoRA と VAE はキーだけで保存するので、このフォールバックはない。

**アップロード。** ページは生のバイト列とオプション（ボード、中間フラグ、カテゴリ）をヘッダーで送る。デコードの前に `images::check_limits` が、256 MiB を超えるファイル、20,000 ピクセルを超える辺、100,000,000 ピクセルを超える総数、PNG、JPEG、WebP、GIF、BMP 以外の形式（内容から判定）を拒否する。PNG はチャンクとピクセルの検査後にバイト単位でそのまま保ち、ほかの形式は PNG に再エンコードする。

**ギャラリーの状態。** キャンバス用、中間画像、下書き（`draftAt`）、候補（宛先 `candidates`。[05-drafts.md](../../02-generation/01-pictures/05-drafts.md)）として作った画像には `isIntermediate` が付き、ボードのビューから外れる（`frontend/src/state/gallery.ts`）。

**動画と音声。** 動画は `mediaType: video` の `.mp4` として保存し、サムネイルは最初のフレーム。音楽は FLAC、音声合成は WAV で保存する（`backend/crates/novira-core/src/service/worker.rs`）。どちらも設定はデータベースの行にだけ保つ。`store_audio` は WAV、FLAC、MP3 以外のバイト列を拒否する。音声のサムネイルは 48 本のバーの 256 x 144 の PNG で、16 ビット PCM の WAV は音量から、ほかのファイルはバイトのパターンから描く。今のジョブは MP3 を書かない。スキームは `Range` リクエストに応じる（206 か 416）ので、メディアはシークできる。

**画像 URL。** ページが受け取るのは名前だけ。Windows では `http://novira-image.localhost/full/<name>` か `/thumb/<name>`、それ以外では `novira-image://localhost/...`。`backend/src-tauri/src/image_scheme.rs` が配信し（判定は `backend/crates/novira-core/src/image_serve.rs`）、未知または無効な名前は 404。CSP は `img-src` と `media-src` で許可する。

**共有用の書き出し。** 共有ダイアログ（`frontend/src/features/share/ShareDialog.tsx`）は名前とオプションを `export_images` に送る。コマンドはまずそれらを検査する（有効な名前 1〜10,000 件、オプション、透かしの状態）。その後シェルがフォルダのダイアログ（`backend/src-tauri/src/dialogs.rs`、rfd）を開き、キャンセルは `null` を返す。ページはパスを送受信しない。コピーはピクセルから再エンコードする（`backend/crates/novira-core/src/media/export.rs`）。PNG、JPEG（品質 1〜100、透明は白の上）、可逆 WebP。長辺は 2048、1536、1024、または 16〜16,384 に制限でき、拡大はしない。元のテキストチャンク、EXIF、XMP は残らない。「生成情報を削除」がオンでなければ、PNG のコピーは `novira_metadata` と `novira_workflow` を保ち、JPEG と WebP は保たない。既定（`frontend/src/features/share/shareOptions.ts`）は PNG、品質 90、元のサイズ、情報あり、透かしなしで、最後の選択はセッション中保つ。AI アシスタントは選択を入れてこのダイアログを開くだけ（`withPreset`）。動画、音声、存在しないファイルはスキップして数える。ファイル名は `<stem>.<ext>`、次に `<stem>-2.<ext>` で、上書きしない。ブラウザサーバー（`POST /export/images`）は同じコピー（`export_download`）を 1 回のダウンロードとして作る。画像 1 枚はそのまま、複数は無圧縮の zip。両側がメモリに保持するので、`export::MAX_DOWNLOAD_BYTES` を超えると拒否する。「フォルダを開く」はシェルが覚えている直近の書き出しのフォルダを開く。「新しいタブで開く」はブラウザ版でだけ表示する（`frontend/src/backend/openWindow.ts`）。

**ダウンロード。** `downloadImages`（メニュー、ビューア）は `save_images` を呼ぶ。デスクトップアプリではシェルがフォルダを尋ね、原本をそのままコピーする（`save_originals`。有効な名前 1〜10,000 件、上書きせず `-2`）。ブラウザは各画像を自身のオリジンからダウンロードする。

**AI の印。** 透かしのスイッチがオンなら、各コピーに次の順で 3 つの印を付ける。

1. TrustMark の透かし、バリアント P（BCH_5）: 61 ビット、16 ビットのマーカー `0x4E56` と 45 ビットのランダム id（`payload.rs`）を、リサイズの後に強さ 1.0 で埋め込む（`watermark.rs`）。合計 4096 x 4096 ピクセルを超える画像、または辺が 2 未満の画像は拒否する。
2. IPTC のソース種別 `trainedAlgorithmicMedia` を XMP として（`xmp.rs`）。PNG では `iTXt` パケット、JPEG では APP1 セグメント、WebP では `XMP ` チャンク。
3. 署名つき C2PA 資格情報（`credentials.rs`）: ソース `trainedAlgorithmicMedia` の create インテント。透かしがあるときはさらに `c2pa.watermarked` アクションと `c2pa.soft-binding` アサーション（アルゴリズム `com.adobe.trustmark.P`、値は `1*` に 61 ビットが続く）。マニフェストは XMP の上に埋め込む。

印を付けたコピーごとに `watermarks` の行が増える。12 桁の 16 進 id、ギャラリーの画像の名前、書き出し時刻、形式。透かしの状態が `ready` でなければ書き出しは拒否される（`check_export`）。

**透かしのファイル。** 固定のサイズとハッシュは「境界」を参照。ファイルは同梱フォルダ、次にデータフォルダから探し、起動時（`backend/src-tauri/src/lib.rs`）か `prepare_watermark` でダウンロードする。状態は `missing`、`downloading`、`ready`、`failed`（`provenance/mod.rs`）。コードは GPU の実行プロバイダーを設定しない。

**画像のチェック。** `check_watermark_file` はシェルのダイアログを開き、キャンセルで `null` を返す（ダイアログのないブラウザサーバーでは選択を隠す）。`check_watermark_image` はギャラリーの名前を受け取る。チェックは画像の右クリックメニューから開き、共有フォームにそこへのリンクはない。どちらも先に `images::check_limits` を実行する（`backend/crates/novira-core/src/service/share.rs`）。結果は、透かしを確認したか、novira の印か、その id を示し、既知の id では元の名前、その画像がまだギャラリーにあるか、書き出し時刻を示す。C2PA の状態（あり、有効、信頼済み、AI ソース、署名者、このインストールが作ったか）と XMP のソース種別も報告する。

**署名キー。** 透かしつきの最初の書き出しで、ローカルの CA と、約 10 年有効な ES256 のリーフ証明書（名前は「novira」）を作る。CA の鍵はすぐ破棄する。リーフの鍵とチェーンは、現在の Windows ユーザーの DPAPI で `novira-data/secrets/c2pa-signing.key` に保存する（`backend/crates/novira-core/src/secret.rs`）。

### ボード

ボードは `boards` テーブルの行: id（`board-` と 16 進 12 桁）、名前、`archived`、`createdAt`、`parentId`（サブフォルダのボード。`backend/crates/novira-core/src/service/boards.rs`）。画像は `boardId` で 1 つのボードに属し、`null` は未分類。ページが枚数とカバーを計算する（`frontend/src/state/boardStats.ts`。候補の画面のボードの選択も使う）。中間画像は除き、`general` は画像、それ以外はアセットとして数える。

- 作成と名前変更は名前をトリムし、空白のみを拒否する。
- アーカイブはフラグを立てるだけ。アーカイブ済みのボードは、アーカイブ表示がオンでなければ隠れ、そのとき選択中のボードをアーカイブすると未分類が選択される。自動追加のボードをアーカイブすると、その設定が解除される（`frontend/src/features/gallery/boards/boardActions.ts`）。
- 自動割り当ての設定がオン（既定）なら、ボードを選ぶと、生成、アップロード、キャンバスからの新しい画像の宛先になる（`autoAddBoardId()`、`frontend/src/state/invoke.ts`）。ギャラリーの画像が待機中または描画中のあいだ、Invoke は新しく選んだボードではなく最初の 1 件のボードを保つ（`generationBoardId()`）。ボードが削除されたか、キューが空なら、自動追加のボードに戻る。バックエンドは `boardId` がボードを指すかを検査しない。
- `delete_board(id, deleteImages)` はボードとその中のサブフォルダすべて（何段でも）を削除する。各画像は、ボードを失う（`boardId` が null）か、画像ごとゴミ箱へ送られ（[03-gallery-trash.md](03-gallery-trash.md)）、ゴミ箱へ送った名前が返る。ダイアログは中間でない画像を数えるが、削除は中間画像も対象にする。

## 境界

| 境界 | 防御 |
|---|---|
| 画像スキーム `novira-image` | URL は生成された名前だけを運ぶ。名前を検査し（`images::is_valid_name`。`nul.png` のような Windows のデバイス名も拒否）、それ以外は 404。トラバーサルとエンコード形でテスト済み。 |
| アップロードされた画像 | サイズ、辺、ピクセルの上限をデコードの前にヘッダーから検査する（`images::check_limits`）ので、小さなファイルが巨大なキャンバスを宣言することはできない。デコーダーに届くのは PNG、JPEG、WebP、GIF、BMP だけ（`images::ACCEPTED_FORMATS`）。`trustmark` が `image` クレートの全形式を有効にするため、ほか（TIFF、EXR、QOI など）はデコード前に拒否する。 |
| 書き出しの透かしファイル | TrustMark の `encoder_P.onnx` / `decoder_P.onnx` と Microsoft の `onnxruntime.dll` 1.22.0 は、サイズと SHA-256 を `backend/crates/novira-core/src/provenance/files.json` で固定する。`<exe folder>/resources/trustmark` から取るか、起動時に `https://cai-watermark.adobe.net` と `https://github.com` だけ（アドレスは `backend/crates/novira-core/src/endpoints.rs`、ホスト完全一致、`https`）から `novira-data/models/trustmark/` へダウンロードする。ストリーミング中に固定サイズで打ち切り、`.part` の名前で書きながらハッシュし、ハッシュが一致したときだけ改名する。ランタイムは固定の zip から名前つきの 1 エントリとして取り出し、同様に上限とハッシュをかける。セッション中の最初の使用の前に毎回全ファイルを再ハッシュし、ダウンロードしたファイルが失敗したら削除する。DLL は `libloading` でアプリのプロセスに読み込み（`ORT_DYLIB_PATH` なし、他のフォルダを探さない）、CPU のみで動く。ONNX ファイルはモデルデータで pickle ではない。 |
| 画像の透かしのチェック（`check_watermark_file`、`check_watermark_image`） | ファイルはコマンドの中でシェルが開くネイティブのダイアログからだけ来る（PNG、JPEG、WebP のフィルター）。ページは何も送らない。ギャラリーの画像は、ほかの画像の名前と同じく名指しされ検査される。ファイルは 1 つのハンドルで読み、全体を読む前にギャラリーのバイト上限を超えていれば拒否し、その後 `images::check_limits`（サイズ、辺、ピクセル、受け付ける形式）を通ってからデコーダー、C2PA パーサー、XMP のスキャンに渡る。C2PA リーダーはネットワークにアクセスしない（HTTP 機能なし、リモートマニフェストなし、OCSP なし）。ページに返すテキスト（ファイル名、署名者）は長さで切り、テキストとして表示する。 |
| コンテンツ資格情報の署名キー | 初回使用時に作る。ローカルの CA が ES256 のリーフ証明書に署名する（名前、アカウント、PC 名は含まない）。CA の秘密鍵はすぐ破棄し、リーフの鍵とチェーンは DPAPI で `novira-data/secrets/c2pa-signing.key` に保存する。鍵はバックエンドから出ず、バックアップに `secrets/` は含まれない。 |

## 既知の限界

- 書き出しの透かし（TrustMark）は公開された方式で、モデルがあれば誰でも同じマーカーを書き、id を読める。Adobe は除去ツールも公開している。JPEG 品質 80 と半分のサイズへの縮小には耐える（2026-10-11 に測定）が、画像の中へのクロップ（未測定。判断の際の目安は約 5 分の 1）、再生成、大きな編集では消えることがある。バリアント P が印を付けるのは画像の中央の正方形だけ。透かしがなくても何の証明にもならず、見つかっても証明ではなく手がかり。
- コンテンツ資格情報は、ユーザーの PC で作った証明書で署名されており、信頼リストにないので、ビューアでは署名者が不明と表示される。証明できるのは、このインストールが署名してからファイルが変わっていないことだけ。メタデータを削除する（多くのサイトがそうする）と消える。その場合、透かしの id が元のギャラリーの画像を指せるのは、書き出したアプリの中だけ。
- `onnxruntime.dll` と TrustMark のモデルはセッション中の最初の読み込みの前にハッシュを検査するが、同じユーザーで動くプログラムが、検査と読み込みのあいだにファイルを差し替える可能性はある（そのプログラムはユーザーのどのファイルも変更できるのと同じ）。DLL の読み込みには Microsoft Visual C++ ランタイムが要る。なければ透かしはエラーを報告し、アプリのほかの部分は影響を受けない。
- 結合または変形したレイヤーの画像は、レイヤーがなくなった後も非表示の画像として `outputs/` に残る。

## 未実装

- 漫画と PSD の書き出しはページ内で描かれ、バックエンドを通らないので、印は付かない。
- ボードのダウンロード（`frontend/src/features/gallery/boards/boardActions.ts` の `downloadBoard`）は通知を表示するだけ。
