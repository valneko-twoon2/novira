# 変更の検証

変更を確かめる方法を、最も軽い検査から実アプリまで順に示す。心配している失敗を捕まえられる最も軽い検査を回し、報告にはどのレベルを回し、どれを回していないかを書く。

## レベル

| レベル | 捕まえるもの | 方法 |
|---|---|---|
| 1. 静的検査とユニットテスト | 型、lint 規則、改行、メッセージカタログ、純粋なロジック、Rust ライブラリの動作、ワイヤ契約、作る ComfyUI のプロンプト、本物の ComfyUI がそれを受け付けること（ノード名、入力、リンク、選択肢、上限。`comfy::node_defs_check`） | `frontend/` で `npm run typecheck`、`npm run lint`、`npx vitest run <path>`。リポジトリ直下で `cargo fmt --all`、`cargo test -p novira-core --lib`、`--test <name>`、`cargo test -p novira`（IPC コマンド一覧と capabilities）。まとめて: `npm run check`（フロントエンド）または `scripts\check.bat`（両方） |
| 2. ブラウザ上のモック | レイアウト、画面の流れ、ComfyUI を必要としないすべて | `npm run e2e`（Playwright のユーザーフローとスクリーンショット比較。専用の開発サーバーをポート 5180 で起動する。複数のチェックアウトを同時に動かすときは `E2E_PORT`）。手早く見るには `npm run dev` のあと `node scripts/shot.mjs --url <URL> --out <png> [--click <selector> ...]`。`node scripts/tools/layout-scan.mjs`（リポジトリ直下）は全画面を走査し、レイアウトの欠陥と収まらない文字を調べる |
| 3. 本物のエンジン、ウィンドウなし | キューのワーカー、本物の ComfyUI でのグラフ、モデルファイルと置き場所、GPU。つまりジョブがキューからファイルまでで何をするか | `models_live`（後述）。エージェントが回す |
| 4. 本物のアプリ、隔離 | ウィンドウそのもの。IPC コマンド、WebView（画像・動画の表示、CSP）、起動、画面自身のリクエスト | 後述の手順。**既定ではユーザーが確かめる**。ブラウザで確かめられるものはすべて、`novira-server` 上の Playwright の Chromium で回す（`scripts/tools/server-run.mjs`、`models-sweep.mjs --via server`）。ウィンドウは、それが要るものだけに使う。IPC 層、シェル（`src-tauri`）、WebView の設定、起動を変えたときはエージェントが回す。モデルを変えたときは、モデルスイープ（後述）として回す |

モックのバックエンドは即座に答え、ComfyUI のようには失敗しない。そのためエンジン、キューのワーカー、モデルファイル、拡張機能に触れる機能は、レベル 3 を回すまで（または回していないと報告に書くまで）検証済みではない。レベル 3 は、モックと偽の ComfyUI では見つからないもの（ComfyUI が読まないフォルダに保存されたチェックポイント、画像なしで画像ジョブを組み立てたドライラン）を見つける。画面は見えないので、画面が送る・表示する内容の変更はレベル 2 で見る。ウィンドウでの経路全体はレベル 4。

## ドキュメントだけの変更

`AGENTS.md`、`README.md`、`docs/`、`.claude/rules/`、`.claude/skills/` だけに触れる変更は、テストと lint を省く。報告には「ドキュメントのみ、省略」と書く。例外: `docs/manual/` は `tests/manual.test.ts` を、地図と設計のページは `scripts/tools/docs-check.mjs` を回す。`npm run check:eol` は常に回す。

## テストの種類

各手法が何を、製品のどの部分で検査し、どの CI ジョブが回すか: [tests/README.md](tests/README.md)。

| 種類 | 場所 | 実行 | 意図した更新 |
|---|---|---|---|
| ユニット・コンポーネント | コードの隣（`*.test.ts[x]`、`#[cfg(test)] mod tests`） | `npx vitest run <path>`、`cargo test -p novira-core --lib` | — |
| プロパティ・ファズ風 | `backend/crates/novira-core/tests/prop_*.rs`（proptest、固定シード、同一プロセス。HTTP は loopback の偽サイトだけ） | `cargo test -p novira-core --test prop_paths`（`prop_graph`、`prop_parsers`、`prop_roundtrip`、`prop_loopback`）。`PROPTEST_CASES=<n>`、`PROPTEST_SEED=<n>` | 失敗した入力は、無視（ignore）せず普通のテストとして固定する |
| ミューテーションファズ | `backend/crates/novira-core/tests/fuzz_inputs.rs`: 有効な画像（PNG、JPEG、WebP、GIF、BMP。テキストと XMP つき）、署名つきコンテンツクレデンシャル、モデルヘッダー、バックアップ zip を、それぞれ 1〜4 回壊して（ビット反転、切り詰め、挿入、範囲のコピー、境界値の長さフィールド、継ぎ合わせ）読み直す。パニックしない、10 秒より遅いリーダーがない、バックアップは拒否されるかステージングフォルダにだけ展開される。安定版 Rust、小さなシード付き生成器、ファジングエンジンなし | `cargo test -p novira-core` の中（リーダーごとに 200 ケース）。長く探すには `NOVIRA_FUZZ_ITERATIONS=20000 NOVIRA_FUZZ_SEED=<n>` | パニックした入力は `logs/fuzz/` に保存し、リーダーの隣に普通のテストとして固定する |
| コマンドファズ（構造を意識） | `backend/crates/novira-core/tests/backend_service/api_fuzz.rs`: このマシンに留まるすべてのコマンドの引数（`contract/` のサンプルがあればそれ）を JSON ツリーとして壊し（別の型、境界の数値、変な文字列とパス、キーの除去・追加、長い・空のリスト、深い入れ子）、偽エンジンでワーカーを動かして `api::dispatch` に通す。文字列は時々、実在する id になる。パニックしない、1 呼び出し 10 秒未満、各呼び出しの後で `bootstrap` が答える、データフォルダの外に何も書かない、有効なジョブが最後まで終わる | `cargo test -p novira-core --test backend_service` の中（300 呼び出し）。長くするには `NOVIRA_FUZZ_ITERATIONS`、`NOVIRA_FUZZ_SEED`（最下位ビットは常に立つので、シード 2 と 3 は同じ動きになる） | 失敗した入力は `logs/fuzz/api-*.json` に保存し、普通のテストとして固定する |
| リクエストファズ（HTTP） | `backend/crates/novira-server/tests/http_fuzz.rs`: サーバー自身のルート（コマンド、`Range` つきの画像、アップロード、ページ、ペアリング）へのリクエストを、メソッド、パス、`Host`、`Origin`、`Sec-Fetch-Site`、トークンと Cookie、ヘッダーと本文で壊し、loopback 上で同一プロセスのサーバーへ生のまま送る。すべてのリクエストが 10 秒未満で 5xx なしに答えられる。`check_request` の検査に落ちたものは拒否され、すべて通ったものは拒否されない。サイトの隣のファイルや、認証情報なしのトークンを返す応答がない。送らないもの: ホームネットワークのルート、書き出し、Web サイトに届くコマンド | `cargo test -p novira-server` の中（300 リクエスト）。長くするには上と同じ | 失敗したリクエストは `logs/fuzz/http-*.txt` に保存する。発見はその検査のテスト（`tests/auth.rs`）に固定する |
| プロパティ・ファズ風（フロントエンド） | コードの隣（`*.property.test.ts[x]`、fast-check。設定は `frontend/src/propertyTest.testkit.ts`。同一プロセスのみ、`fetch` は例外を投げるスタブ、固定シード） | `npx vitest run <file>.property.test.ts`。`NOVIRA_PBT_RUNS=<n>`、`NOVIRA_PBT_SEED=<n>` | 失敗した入力はアプリ側で直す。直るまでは `known bug:` コメントつきの `it.fails` テストとして残す |
| サービス結合 | `backend/crates/novira-core/tests/backend_service/`（偽エンジン）、`comfy_fake_server/`（偽 ComfyUI） | `cargo test -p novira-core --test <name>` | — |
| 契約 | `contract/*.json`。検査は `frontend/src/backend/contract.test.ts`（サンプルは `contract/samples/`）、`frontend/src/backend/tauri/commands.contract.test.ts`、`backend/crates/novira-core/tests/contract/` | `npx vitest run src/backend/contract.test.ts src/backend/tauri`、`cargo test -p novira-core --test contract` | サンプルを変え、`CONTRACT_UPDATE=1 npx vitest run src/backend/contract.test.ts` を回し、次に Rust の検査 |
| ComfyUI プロンプトのスナップショット | フロントエンドの `features/*/__snapshots__/`、バックエンドの `src/comfy/__snapshots__/graph/`（`graph_snapshots.rs`。新しいモデルファミリーは `graph_snapshots_families.rs`） | `npx vitest run <file>.snapshot.test.ts`、`cargo test -p novira-core --lib comfy::graph_snapshots` | `npx vitest run -u <file>`、`UPDATE_SNAPSHOTS=1 cargo test -p novira-core --lib comfy::graph_snapshots` |
| ノード定義 | `src/comfy/__snapshots__/node-defs.json`: スナップショットが使うノードについての、本物の ComfyUI の定義。`comfy::node_defs_check` が、バックエンドのスナップショットのプロンプトすべてをこれに照らして検査する | `cargo test -p novira-core --lib comfy::node_defs_check` | ComfyUI を起動し（`--cpu` で足りる）、`node scripts/tools/comfy-node-defs.mjs http://127.0.0.1:<port>` を回して差分を読む。グラフにノードが増えたときと、新しい ComfyUI に追従するときに行う |
| 古いデータフォルダ | `backend/crates/novira-core/tests/fixtures/data-<version>/`。それぞれそのリリース自身のコードが書いたもの。`tests/backend_service/old_data.rs` がコピーを別フォルダで開き、ボード、画像、ファイル、設定、ワークフロー、コミック、ジョブがすべてあることと、新しいジョブが動くことを調べる | `cargo test -p novira-core --test backend_service old_data` | 書き換えない。リリースのとき、そのコミットで `cargo run -p novira-core --example make_old_data_fixture` を回し、`novira-data/work/fixture-out/` から `extra_model_paths.yaml` を除いて `data-<version>/` にコピーし、テストを 1 行足す |
| バックエンドとモックの比較（差分テスト） | `frontend/difftest/*.difftest.ts`: `MockBackend` と、空のデータフォルダ・エンジンなしの `novira-server` 経由の本物のバックエンドに、同じ呼び出しをする。`backends.difftest.ts` は固定ケース（ボード、ワークフロー、コミック、キャンバス、画面の状態、アップロードとギャラリーの編集、画像ごと削除したボード、エンジン設定とその上限、存在しないものへの呼び出し）。`sequences.difftest.ts` はボード、画像、コミックの呼び出しをシード付きでランダムに並べて回し、呼び出しのたびにそれらが作ったものすべてを比べる。作られた id、時刻、画像のアドレスは比べる前に番号に置き換え、拒否は拒否として比べ、失敗は最初に食い違った手順を示す | `node scripts/tools/diff-backends.mjs`（先にサーバーをビルドする。最新なら cargo は何もしない）。長い並びには `NOVIRA_DIFF_SEED`、`NOVIRA_DIFF_RUNS`、`NOVIRA_DIFF_STEPS` | 差分はモックで直すか、理由を添えてケースからその部分を外す（`novira-server` がシェル専用として答える呼び出しは外してある） |
| モンキー | `frontend/e2e/monkey.spec.ts`（chromium プロジェクト）: 各メイン画面に見えるものへの、シード付きのランダムなクリック、ダブルクリック、右クリック、入力（空、巨大、変わった文字）、キー、ホイール、ドラッグ。モックのライブラリと空のライブラリの両方で行う。操作のたびに `ErrorBoundary` が出ていない、アプリがある、ページがエラーをログに出していない、を満たす。失敗はシードとそれ以前の操作を示す | `npx playwright test --project=chromium` の中（1 回 60 操作）。長くするには `NOVIRA_MONKEY_SEED=<n> NOVIRA_MONKEY_ACTIONS=<n>`。`NOVIRA_MONKEY_TRACE=1` は各操作とその時刻を出す | 失敗はアプリで直す。シードで再現できる |
| エンドツーエンド | `frontend/e2e/*.spec.ts`。スマートフォンのレイアウト（`phone*.spec.ts`）は Chromium（`phone`）と、iPhone としての WebKit（`webkit`。Playwright の WebKit で、iOS Safari ではない） | `npm run e2e`（フローだけなら `npx playwright test --project=chromium`） | — |
| ビジュアルリグレッション | `frontend/e2e/visual/<画面>.spec.ts`。基準画像は `e2e/__screenshots__/visual/<画面>/<dark か light>/<名前>-<プラットフォーム>.png`（プラットフォームごとに 1 組。Windows は `-win32`）。画面全体と、各部品（プロンプト欄、プリセット、ダイアログなど）をダークとライトで撮る。開発版だけの画面（動画・音楽・音声・コミック）は撮らない | `npm run e2e:visual` | `npm run e2e:visual -- --update-snapshots=changed`（pre-commit フックは毎回この検査を回し、基準画像が合わないとコミットを拒否する。先に変わった画像をすべて見る） |
| レイアウト走査と文字の収まり | `frontend/e2e/layout.spec.ts`（`layout` プロジェクト）。計測は `e2e/layoutScan.ts` と `e2e/textFit.ts`、判定は `e2e/layoutRules.ts`（ユニットテストは `tests/layout-rules.test.ts`） | リポジトリ直下で `node scripts/tools/layout-scan.mjs`（ja と en、ダークとライト。ワーカー 6 つで約 2 分。`--locales all` で全言語。頼まれたときだけ） | —（基準なし。欠陥は直すか、設計どおりの場所として印を付ける） |

レイアウト走査は、すべてのメイン画面、サイドバー、メディア画面、開くのが軽いダイアログ（設定ペイン、ホットキー、アバウトとライセンス、ギャラリーの設定、画像メニューとその項目が開くダイアログ、ビューア、ノードピッカー、モデル表示とインポート、ブラウズの詳細、拡張機能の詳細とバージョン、アシスタントとそのポップオーバー、ダイナミックプロンプトとポーズプリセット）を、折りたたまれた節を開いた状態で開き、実際のレイアウトから 4 種類の欠陥を報告する。`overflow` / `offscreen`（コントロールが入れ物からはみ出す、またはウィンドウの外に出る。意図して横にスクロールする行は問題ない）、`clipped`（overflow を隠すボックスで文字が切れる）、`truncated`（省略記号または行数制限で文字が「…」に縮められる）、`touching` / `overlap`（同じ面の、見えるコントロール 2 つまたは角丸のカード 2 枚の間が 1px 未満、または重なる。向き合う角が四角い、つなげた組は問題ない）。文字を縮める設計の場所には `data-truncate-ok`、意図してつなげたボックスには `data-touch-ok`、走査が飛ばすべき装飾には `data-layout-ignore` を付け、いずれもコメントで理由を書く。同じ走査で文字の収まりも調べる（`e2e/textFit.ts`: ラベルが切れる、ボタンからはみ出す、2 行に割れる、ツールチップ・メニュー・ダイアログがウィンドウの外に出る）。メイン画面では、すべてのツールチップ（トリガーにフォーカスして表示し、ページ内で 1 回の呼び出しにまとめる）と、それらが開くすべてのメニュー、ポップオーバー、ピッカーも対象にする（サイドバー、ギャラリーパネル、Invoke バーのものは Generate タブだけ。リストに並ぶ同じ開き口、たとえば各モデル行のメニューは 1 回だけ）。各面は言語ごとにダークテーマで 1 回開き、各手順の後でテーマをその場でライトに切り替えて、レイアウトをもう一度測る。テーマの違いは色だけで、描かれたボックスに関する規則だけが色に依存するため。`LAYOUT_SHOTS=<novira-data/work/ の下のフォルダ>` を付けると、走査した各手順のスクリーンショットも保存され、目で見られる。合格は、レイアウトのソース（css、`src/ui/`、`src/app/`、機能の tsx、走査自身）のハッシュとともに `novira-data/work/layout-scan/passes.json` に記録される。pre-commit フックは、レイアウトのソースを変えるコミットを、ステージされた内容そのもののハッシュを持つ ja と en の合格記録がない限り拒否する（作業ツリーに記録があるかは `node scripts/tools/layout-scan.mjs --check` で分かる）。走査はハーネスモード（`scripts/tools/harness-paths.mjs` の `HARNESS_MODE`。検証アプリとブラウザサーバーも使う。アプリの `production` ビルドだけが外すもの、たとえば当面隠しているメディアのタブは、含まれる）の最小化ビルドを開く（`frontend/scripts/e2e-server.mjs`。`novira-data/work/e2e-build/` に置かれ、ソースが変わったときだけ作り直す。開発サーバーは全ページの全モジュールを必要になったときにコンパイルする）。また e2e ロック（`scripts/tools/e2e-lock.mjs`。GPU ロックと同じく `novira-data/work/` の中のディレクトリで、持ち主のプロセスが消えていれば引き継がれる）を持つので、2 つ目の重い実行は待つ。ほかの Playwright の実行は `node scripts/tools/e2e-lock.mjs -- <command>` でロックを取れる。ワーカー数はプロセッサの半分で、6 を超えない（`--workers <n>` も上限がある。`frontend/playwright.config.ts` にも同じ上限がある）。これ以上だとユーザーの PC が遅くなって作業できなくなり、プロセッサ 16 では 12 ワーカーでも速くならず、16 ではケースがタイムアウトした。制限: spec にある面だけ、1600x900 だけ。ほかの言語は `--locales all` のときだけ。

スナップショット、フィクスチャ、基準画像の差分は、コミットする前にすべて読む。更新は、新しい出力が意図したものだという宣言である。

ネットワーク、`claude` / `codex` CLI、動いている ComfyUI を必要とするライブテストは、`backend/crates/novira-core/tests/` の下で `#[ignore]` にしてある。その統合についての変更のときだけ、`-- --ignored` を付けて名前を指定して回す。

## リポジトリ全体の検査

| コマンド / ファイル | 回すもの | 含まないもの |
|---|---|---|
| `npm run check`（`frontend/` で） | `typecheck`、`lint`、すべての vitest テスト、`check:eol` | Playwright（`npm run e2e`）。数分かかり、ブラウザが要る |
| `node scripts/tools/affected.mjs`（リポジトリ直下。`--list`、`--e2e`、`--base <ref>`、またはパス） | 変更したファイルが必要とする検査を、`.claude/rules/tests.md` の表に従って回す。typecheck、変更ファイルへの eslint と stylelint、`vitest related`（変更したファイルを import するすべてのテスト）、変更したカタログ・章・フィクスチャ・記録・地図ページを読むテスト、`cargo fmt --check`、clippy、novira-core のライブラリテストと変更したモジュールを名前に含む結合テスト、シェルなら `-p novira`、改行。ビルド設定や依存は、その側全体を回す | `--e2e` がなければ Playwright（付けると、変更した機能の名前の spec、共有部分ならすべてのフロー、ビジュアルリグレッション）。別のモジュールを通してしかそのモジュールに届かない結合テスト。ライブテスト |
| `scripts\check.bat`（リポジトリ直下で実行。片側だけなら `scripts\check.bat frontend` / `scripts\check.bat backend`） | `npm run check`、`cargo fmt --all -- --check`、`cargo clippy -p novira-core --tests -- -D warnings`、`cargo test -p novira-core`、`cargo test -p novira`。すべての手順が回り、終了コードが失敗の有無を示す | Playwright、ignore されたライブテスト。`cargo test -p novira` は `target\debug\novira.exe` をビルドするが、novira が開いている間は Windows がロックする。そのときは `novira-data\work\check-target` にビルドする（`affected.mjs` と同じ。`check.bat` は先に古い出力を消す。後述「ハーネスの書き込み先」）。`CARGO_TARGET_DIR` が設定されていればそれに従う |
| `scripts\checks\full-check.bat`（`scripts/tools/full-check.mjs`。`--no-browser`、`--list`） | `scripts\check.bat`、`cargo test -p novira-server`、`scripts/tools/diff-backends.mjs`、Playwright のプロジェクト chromium・phone・webkit・visual（e2e ロックの下）、レイアウト走査。すべての手順が回り、各手順の結果と失敗した手順の出力の末尾を載せたレポートが `logs/full-check/<time>.md` に出る | ライブテスト、ミューテーション実行、本物のアプリ。手で起動する。CI はテストを回さない |
| `npm run check:eol` | 追跡されているファイルと、無視されていない未追跡ファイルへの `git ls-files --eol`。LF でない改行や混在で失敗する（バイナリは飛ばす。`.gitattributes` の `eol=lf` は尊重する） | ステージされた blob（作業ツリーを読む） |
| `scripts\checks\coverage.bat`（片側だけなら `frontend` / `backend`。`e2e` はブラウザカバレッジつきで Playwright のテストも回し、その行をユニットの数字に足す。`report` はレポートの作り直しだけ） | テストがコードのどれだけを実行するか: 文、分岐、関数、行（フロントエンド。下限あり）、行、関数、リージョン（novira-core）。どの実行も、これまでに測ったすべての部分を 1 つの図入りレポートにまとめて終わる（ReportGenerator による。`scripts/tools/coverage-report.mjs`。`dotnet` が要る）。`logs/coverage/report/index.html` で、フォルダごとにまとめ、ソース上のカバーされていない行と過去の実行の履歴を載せる | Rust の分岐カバレッジ。どの検査スクリプトからも回らない。合算（ユニット + E2E）の数字は行だけを数え、2 つのツールは行の数え方が少し違うので、おおよその値として読む |
| `scripts\checks\mutation.bat rust`（1 ファイルなら `-- -f <file>`） | Rust のテストがコードの実際の変更を捕まえるか: cargo-mutants が novira-core を変異させてテストを回し直す。生き残った変異体はテストの穴。レポートは `logs/mutation/` | フロントエンド。`scripts\check.bat` や CI からは回らない（何時間もかかる）。テストを強めた後でファイルごとに回す |
| `.githooks/pre-commit`（`frontend/` の `npm install` が有効にする。`prepare` スクリプト） | ステージされた `novira-data/`（`novira-data/work/` を含む）、`logs/`、`data/`、`outputs/`、`out/`、`config.json`、`.env*` を拒否。ステージされたファイルの改行。片方だけ変えた ja か en のメッセージ、ほかの言語の古い文言、翻訳されておらず保留とも記されていないマニュアルの章。ステージされた内容に対する走査の合格記録がないレイアウトのソース（記録を調べるだけで、走査は回さない）（`.githooks/pre-commit.mjs`、`check-i18n-sync.mjs`、`check-manual-sync.mjs`） | 遅いものすべて。`--no-verify` で飛ばされるが、エージェントは使わない |

これらの検査が強制する規則。上限は各ファイルの先頭に書いてある。

- レイヤー境界（`frontend/scripts/eslint-layers.mjs`、ESLint 規則）: `backend/` は `state/`、`ui/`、`features/`、`app/` のどれも import しない。`i18n/` と `theme/` はどのレイヤーも import しない。`state/` は `ui/`、`features/`、`app/` を import しない。`ui/` は `features/`、`app/` を import しない。機能はほかの機能を import しない（`features/media` を除く）。`@/` と相対指定子のどちらも解決する。規則を入れたときに違反だった import は、同じファイルに 1 件ずつ列挙してある。`frontend/tests/structure.test.ts` は、不要になった項目があると失敗するので、一覧は縮む一方になる。
- `frontend/src/` の下に何でも入れるフォルダ（`utils`、`misc`、`helpers`）を作らない（`frontend/tests/structure.test.ts`）。
- vitest や Playwright のソースに `.only` をコミットしない（`frontend/scripts/eslint-test-hygiene.mjs`。別名や計算された名前は捕まえない）。
- `#[ignore]` は `backend/**/tests/*_live.rs` だけに付ける。また、それを書き出すテストケースのない ComfyUI プロンプトのスナップショットファイルを置かない。フロントエンドもバックエンドも同じ（`frontend/tests/test-hygiene.test.ts`）。走査は、リテラルの名前と引数 1 つの `snap('name')` ヘルパーを読む。名前を実行時に組み立てるテストは、自分のフォルダを自分で検査する（`comfyPrompt.snapshot.test.ts` がそうしている）。`contract/` のフィクスチャには、両側に独自の孤立検査がある。

## 本物のエンジン、ウィンドウなし

`backend/crates/novira-core/tests/models_live.rs` は、`Backend::open` でデータフォルダを開き、ワーカーを動かし、ジョブを 1 つキューに入れ、ファイルを読み戻す。相手は、データフォルダの `settings.json` が指す本物の ComfyUI（`{"comfyuiDir": ...}`。後述の本物のアプリと同じくコピー）。ウィンドウも、アプリの 2 つ目のビルドも、Playwright もない。テストバイナリがビルド済みなら 1 回が 1 分未満（2026-10-12 の計測: LTX-Video のテキストから動画が 40 秒、Anima 1024 px が 41 秒。どちらも ComfyUI の起動を含む）。

```text
NOVIRA_GPU_LOCK=<the lock directory> node scripts/tools/models-live.mjs <part of the model name> [--image <file>] [--out <folder>]
```

ラッパー（リポジトリ直下）は、`NOVIRA_LIVE_DATA` を `novira-data/work/verify-data`（または `NOVIRA_VERIFY_DATA`）に設定し、`novira-data/work/` の厳密に内側にないデータフォルダや `settings.json` のないものを拒否し、共有モデルフォルダをその `settings.json` に足し（後述）、cargo を PATH に通し、後述の GPU 検査を回してから、`backend/` で `cargo test -p novira-core --test models_live -- --ignored --nocapture` を回す。ほかの `NOVIRA_LIVE_*` 変数は素通しされる。

モデルは、データフォルダのインストール済みモデルから探す（ファイルと、それが必要とするもの、つまりエンコーダーと VAE は、その `models/` にある）。ステップ数、CFG、サイズ、フレーム数はファミリーが決める（テストの `preset`）。`NOVIRA_LIVE_IMAGE` は画像から画像、または画像から動画のジョブを始め、`NOVIRA_LIVE_STEPS`、`_CFG`、`_SIZE`、`_FRAMES` は数値を変え、`NOVIRA_LIVE_OUT` は結果を目で見るために保存する。ワーカーは GPU ロックを自分で取る。先に、ユーザーが GPU を使っていないことを確かめる。スクリプトがデータフォルダへダウンロードする前に、そのモデルフォルダが本物のフォルダであることを確かめる。ユーザー自身の `novira-data/models/...` へのジャンクションになっていることがあり（`Get-ChildItem <data>/models | Select Name, LinkType, Target`）、そこへのダウンロードはユーザーのモデルに入ってしまう。別のジョブ（インペイント、コントロールレイヤー、Wan 2.2 のペア）が要るテストは、同じファイルに足す。`*_live.rs` は `#[ignore]` のままで、意図したときだけ回す。

ウィンドウと同じエンジンの経路である。見えないのは、画面と `Backend` の間の部分（画面が組み立てるリクエスト、IPC、WebView）。どちらを回したかを報告に書く。

## 本物のアプリ、隔離

デバッグ用の exe にはビルド済みのフロントエンドが埋め込まれる。アプリ自身のものは `frontend/dist`（`build.rs` は、それがない、またはソースより古いときだけ作り直す）。検証ビルドは代わりにハーネスビルド（`scripts/tools/harness-paths.mjs` の `buildHarnessDist`。`novira-data/work/e2e-build/` に置く）を埋め込む。そのためすべての画面が入り、ハーネスの成果物が `frontend/dist` に混ざらない（ユーザーの次の `cargo build` がそれを埋め込んでしまう）。動いている novira（Windows はその exe をロックする）にビルドを邪魔されないよう、別の Cargo ターゲットフォルダを使う。

```text
node frontend/scripts/e2e-server.mjs --build-only
cd backend && CARGO_TARGET_DIR=<temp>/novira-verify NOVIRA_SKIP_FRONTEND_BUILD=1 TAURI_CONFIG='{"build":{"frontendDist":"<the e2e-build folder>"}}' cargo build -p novira
```

専用のデータとブラウザプロファイル、操作用のデバッグポートを付けて起動する。

| 変数 | 値 |
|---|---|
| `NOVIRA_DATA_DIR` | `novira-data/work/` の厳密に内側のフォルダ（既定は `verify-data`）。`novira-data/` 自身は不可。そこには動いているアプリのロック、キュー、画像がある |
| `WEBVIEW2_USER_DATA_FOLDER` | `novira-data/work/verify-webview`（これがないと、ユーザーの novira が動いている間 WebView2 が失敗する） |
| `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` | `--remote-debugging-port=9333` |

ウィンドウは Playwright の `chromium.connectOverCDP('http://127.0.0.1:9333')` で操作する（`frontend/node_modules` の `@playwright/test`）。コンテキストメニューの項目は `data-testid` を引き継がないので、ロールと名前で選ぶ。

モデルはリポジトリの外に置く。検証では、非商用ライセンスのモデル（FLUX.1-dev、NoobAI-XL など）を使ってよい。

空のデータフォルダだと、アプリは初回起動時に自前の ComfyUI をダウンロードする。それを避ける、またはカスタムノードの拡張機能のインストールをユーザーのエンジンに及ばせないために、隔離したデータフォルダを ComfyUI のコピーに向ける。その `settings.json` に `{"comfyuiDir": "<copy>/ComfyUI"}` を書く。モデルと拡張機能のファイルは、そのデータフォルダへコピーまたはダウンロードできる。

### ハーネス: 検査を 1 つ回して片付ける

`node scripts/tools/verify-real-app.mjs <test.mjs> [--build] [--keep]` はリポジトリ直下から実行し、隔離したアプリに対してテストスクリプトを 1 つ回し、終わったら片付ける。最初に `scripts/tools/ui-refs.mjs` でスクリプトを検査し、画面にもうないテスト id や画面文言のキーをスクリプトが名指ししていたら止まる（数分のビルドの前に）。検証用 exe がなければビルドする（`--build` は先に作り直す。フロントエンドはハーネスモードなので、アプリのすべての画面が入る）。上の変数を付けて起動し（シェルに `NOVIRA_GPU_LOCK` があれば引き継ぐ）、デバッグポートを待ち、テストを `node` で回す。その後は常に、検証ウィンドウを閉じ（15 秒後に強制。対象は自分のプロセスツリーだけ）、検証用 ComfyUI（コマンドラインに `comfy-copy` を含む python プロセス）を止め、検証用 exe を削除する。検証ターゲットフォルダの `debug/novira.exe` と、cargo が `debug/deps/` に残すコピー（`novira.exe` または `novira-<hash>.exe`）である。`novira_core-<hash>.exe` のようなテストバイナリはアプリではないので残る。`--keep` は exe をそのまま残す。

何かを起動・削除する前に、ハーネスは次の場合に実行を拒否する。検証ターゲットフォルダがリポジトリの内側にある、exe がユーザー自身の `novira.exe` のどれかになる、データフォルダや WebView2 プロファイルが `novira-data/work/` の厳密な内側にない（`novira-data/` 自身、`work/` 自身、外側は拒否）。環境変数は `NOVIRA_VERIFY_TARGET`（既定は `<temp>/novira-verify`）、`NOVIRA_VERIFY_DATA`（既定は `novira-data/work/verify-data`）。exe を削除するので、次の実行は先に再ビルドし、数分かかる。`--release` は代わりにリリース exe をビルドして回す。`--no-engine` は、データフォルダの `settings.json` に閉じた loopback ポートの `comfyuiUrl` を書き、`comfyuiDir` と `comfyuiPython` を取り除き、Civitai の照会を切る。これでアプリは ComfyUI プロセスを持たず、何もインストールしない（エンジンは到達不能と表示される）。GPU 検査も飛ばす。実行が終わると `settings.json` は元に戻される（実行が作ったものなら削除される）ので、エンジンありの次の実行が閉じたアドレスを見つけることはない。テストスクリプトには `NOVIRA_VERIFY_APP_PID` と `NOVIRA_VERIFY_STARTED_AT`（起動時刻のエポックミリ秒）が渡される。

## モデルスイープ

`node scripts/tools/models-sweep.mjs [--category <name>] [--model <part>] [--no-gpu] [--build] [--lookup]` は、Civitai の照会を切った隔離アプリを動かし、インストール済みのすべてのモデルを調べる。モデル画面に、レール項目とベースつきで載っているか。カバー（カードと Generate 画面のモデルカード。画像が読み込めること）。そのモデルで描く画面が提案するか。さらに GPU が空いていて `NOVIRA_GPU_LOCK` が設定されていれば、種類とベースごとに 1 モデルについて、その画面からジョブを 1 つ回し、検証用 ComfyUI の `/history` から読み戻したグラフがそのファイルを読み込み、空白でない画像ができていること。各モデルパック（動画、音楽、音声、インペイント、turbo）は、一覧の検査だけの行になる。任意のモデルルートにあるそのファイルを、アプリのパック状態と照らす。ディスク上にあるのに一覧にないファイルも失敗とする。表、記録、スクリーンショットはメインチェックアウトの `logs/models-sweep/<time>/` に出る。いつ回すか、失敗をどう扱うかは `.claude/rules/models.md`。`--lookup` は照会ありの 2 周目を足す。モデルファイルすべてのハッシュを Civitai に送るので、頼まれたときだけ回す（`--model` や `--category` と一緒でも同じ）。付けない場合、照会ありのカバー検査は「not run (use --lookup)」と表示される。照会なしだけの実行の記録も、Stop フックと `scripts/tools/affected.mjs` にとっては HEAD を覆う。ゲートが求めるのは照会なしの周と GPU の部分で、ネットワークの周ではない。合格はその実行のファイルについてのもの。ジョブの部分は種類とベースごとに 1 モデルを覆い、モデルすべてではない。

### ブラウザサーバー経由

`node scripts/tools/models-sweep.mjs --via server [...]` は、デスクトップウィンドウなしで同じ a から e の検査を回す。`scripts/tools/server-run.mjs` がフロントエンドのハーネスビルドを最新にし、`novira-server` をビルドし（`novira-data/work/server-target` へ。移すには `NOVIRA_SERVER_TARGET`。最新なら cargo は何もしないので、`--build` はウィンドウ専用）、`novira-server --data <verification data> --dist <the harness build> --engine` を起動し、Playwright 自前の Chromium が出力されたアドレスを e2e ロックを持ったまま開く。続けて `models-sweep-app.mjs` が、Tauri IPC の代わりに `POST /api/<command>` でバックエンドを呼び、ComfyUI の `/history` を従来どおり読む。データフォルダ、共有モデル（`modelRoots`）、エンジンのコピーはアプリでの実行と同じなので、アプリとサーバーは同時には動かせない（データフォルダごとに 1 プロセス）。GPU ロックは `NOVIRA_GPU_LOCK` から来る（サーバーのワーカーが取る。手で持たない）。2026-10-21 に、チェックポイント（`waiIllustriousSDXL_v170`）、LoRA（`ryugahama_yueilxl_v1`）、パックの行（`music pack`）でアプリ経由と照らして確かめた: 判定は同じ、グラフも同じ（違うのはシードだけ）、ジョブはウィンドウの 12 秒に対して 11〜18 秒。ブラウザ経路で確かめられないもの: `novira-image://` スキーム（画像は `/novira-image/` から来る）、WebView2 の描画とその GPU 経路、ネイティブダイアログとその背後のコマンド（`api::SHELL_ONLY`）、ウィンドウ自身の起動。このため `--via server` の記録には印が付き（`sweep.json` の `via`）、Stop フックにとっては HEAD を覆わない。ページ経由の 1 枚の実行（2026-10-21、`waiIllustriousSDXL_v170`、768x768、12 ステップ）: キュー項目は pending、in progress（生成中の帯はクリックの 0.3 秒後に表示。`/events` 越しの `invocation_progress`）、completed と進み、6.4 秒で終わり、続いて `image_added`、ギャラリーは `/novira-image/thumb/` から 256 px のサムネイルを表示した。Queue タブからキャンセルした 2 つ目の 50 ステップのジョブは、ソケット越しに `canceled` で返った。ページが使えるようになるのは約 20 秒後で、エンジンの起動（ウィンドウのスプラッシュゲート）による。絞った実行（`--model`、`--category`）は、ほかのモデルのファイルを「not listed」と報告しなくなった。

## 速度の計測

`node scripts/tools/perf.mjs <backend|startup|app|all>`（リポジトリ直下）は、処理、起動、通信の時間を、どのセッションでも同じ方法で測る。どの部分も ComfyUI を起動せず、GPU を使わず、画面には何も出ない。

| 部分 | 測るもの |
|---|---|
| `backend` | リリースでの `backend/crates/novira-core/examples/backend_timing.rs`: データの新しいコピーでの `Backend::open` の各手順と、画面が起動時とよく呼ぶ各コマンドの 20 サンプル（呼び出し、その JSON、ブラウザサーバーのディスパッチ）、および答えのサイズ |
| `startup` | `scripts/tools/perf-startup.mjs`: `novira-server` 上（または `--via mock`）の Chromium での本番ビルドについて、リクエストからサムネイルが見えるまで、long task、アプリ自身のマークと呼び出し時間。`--switch` は画面の切り替えを足し、`--dist a=<folder> --dist b=<folder>` は 2 つのビルドを交互に回す |
| `app` | リリースの本物のデスクトップアプリ、隔離（`verify-real-app.mjs --release --no-engine`）: 1 回ごとに新しいプロセスで測り、そのあとリロードし、CDP で読む。Tauri IPC を測る唯一の部分。アプリの下に python プロセスがあると、実行は失敗する |

アプリは起動（`backend-ready`、`app-loaded`、`bootstrap-received`、`stores-filled`、`shell-visible`、`first-thumbnail`）とすべてのバックエンド呼び出し（名前、開始、所要時間。直近 500 件）を `frontend/src/backend/perf.ts` に記録し、ハーネスは `window.__noviraPerf.snapshot()` を読む。各答えのサイズは、セッションストレージのキー `novira-perf-record` が `1` で、ページをリロードしたあとにだけ記録する。答えを JSON テキストにするためである。

データは `novira-data/work/perf-data`（別のフォルダなら `--data`。`work/` の内側）で、`modelRoots` が共有モデルを指す、本物のデータのコピー。ルートを Windows パスで書いた状態で `work/perf/source` にコピーされる。スラッシュで書いたルートは、データベースが持つパスと等しくならず、開くたびにモデルヘッダーすべてを読み直す（約 250 ms）。ユーザーのアプリはそれをしない。各部分は `--runs` 回（既定 7）回り、すべてのサンプルを残す。

変更を判定するには、変更前のコードで `node scripts/tools/perf.mjs all --save before`、変更後に `node scripts/tools/perf.mjs all --compare before`（または最新の結果に対して `node scripts/tools/perf.mjs compare before`）。指標が動いたとみなすのは、新しい中央値が基準の最小〜最大サンプルの外にあり、10 % かつ 2 ms（件数は 1）以上の差があるとき。サイズは 1 % を超えて違うとき。それ以外はノイズ。`agent_status` は表示するが旗は立てない。アシスタントの CLI を動かし、それらは気まぐれに 45 ms か 270 ms で答えるため。コンソールには動いたものと主要な指標がいくつか出る。`logs/perf/<name>.md` には全指標、比較、`app` ではさらに IPC の表がある。コマンドごとに、ウィンドウでの時間（コールドとウォーム）と、バックエンド自身の時間（呼び出しとその JSON）を並べ、その差が IPC 経路のコストである。結果は `logs/perf/<name>.json` と `latest.json`、基準は `work/perf/baselines/<name>.json`。比べるのは同じマシンで取った時間だけ。ユーザーの重い作業（ビルド、生成、別のエージェントの実行）はそれを動かす。各部分は、前と最中のプロセッサの混み具合を記録する（結果の `load`、比較の 1 行、部分の前で 20 % を超えると警告）ので、まずその行を読み、負荷が違う間に旗が立った実行は繰り返す。2026-10-21 に変更のないコードを比べたところ、静かなマシン（各部分の前で 5〜12 % の使用率）では 167 指標のどれにも旗が立たず、間にほかの作業が走ったときは、ウォームの `app-loaded`（+11 %、1 回が 2 倍の時間）に旗が立った。記録器のコストは、オフのとき 1 呼び出しあたり約 0.13 µs（Node、200 000 呼び出し）。ありとなしを 9 回ずつ交互に回して比べた起動の差は、ノイズの範囲内だった。

## ハーネスの書き込み先

ルートは 2 つで、どちらもメインチェックアウトにある（worktree からも同じ。`scripts/tools/harness-paths.mjs` が `git worktree list` の最初の項目を取る）。人が読む結果は `logs/`、それ以外はすべて `novira-data/work/`。

### `logs/`

テスト結果とレポート。リポジトリの最上位に置き、1〜2 階層ですべてに届くようにしてある。git の対象外で、pre-commit フックが拒否する。カバレッジの実行、`mutation.bat`、ファズテストは、回したチェックアウトの `logs/` に書くので、worktree のものは worktree とともに消える。それ以外はすべてメインチェックアウトに出る。

| 項目 | 内容 | 未使用でこの期間を過ぎると削除 |
|---|---|---|
| `coverage/` | カバレッジの実行が残すもの: `report/index.html`（全部分）と `history/`、`frontend/`、`backend/`、`e2e/`、`e2e-raw/`、`combined-summary.txt` | 7 日 |
| `e2e/`、`e2e-<worktree folder>/` | Playwright の出力（失敗したケースのトレースとスクリーンショット）: メインチェックアウトの `e2e/` と、worktree ごとに 1 つ。Playwright は実行開始時に自分のフォルダを消すため | 7 日 |
| `playwright-report/` | CI の html レポーター | 7 日 |
| `mutation/` | `mutation.bat` のレポート | 7 日 |
| `models-sweep/<time>/` | モデルスイープの表 `sweep.md`、記録 `sweep.json`（Stop フックが読む）、スクリーンショット、グラフ、画像 | 7 日 |
| `perf/` | 速度計測の結果（前述） | 14 日 |
| `full-check/`、`fuzz/` | `full-check.mjs` のレポート。ファズテストが保存した入力 | 3 日 |

### `novira-data/work/`

それ以外のすべて。`novira-data/` 経由で git の対象外。共有モデルはメインチェックアウトの `novira-data/models`。設定画面がデータフォルダをリポジトリの外へ移した場合は、`%LOCALAPPDATA%\novira` のポインタが指すフォルダの `models/`（デバッグビルドのものを先に）。移動で `work/` に運ばれた ComfyUI のコピーも使う。

| 項目 | 内容 | 未使用でこの期間を過ぎると削除 |
|---|---|---|
| `verify-data/` | 隔離アプリのデータフォルダ（`NOVIRA_VERIFY_DATA` で `work/` 内の別のフォルダも指せる）。その `settings.json` に共有モデルフォルダを載せる | 30 日 |
| `verify-webview/` | その WebView2 プロファイル | 30 日 |
| `comfy-copy/` | ComfyUI のコピー（コピーなので、拡張機能のインストールがユーザーのエンジンに及ばない）。python プロセスはこのフォルダ名で見分ける | 30 日 |
| `check-target/` | ユーザーの `novira.exe` が開いている間の、`check.bat` と `affected.mjs` の Cargo ターゲット | 14 日 |
| `server-target/`、`layout-scan/` | ブラウザサーバーの Cargo ターゲット（`scripts/tools/server-run.mjs`）。レイアウト走査の合格記録 | 14 日 |
| `perf-data/`、`perf-target/`、`perf/` | 速度計測を回すデータ（前述）、そのリリースビルド、作業コピーと基準 | それぞれ 30、14、14 日 |
| `manual/`、`e2e-build/` | ビルドしたマニュアル、フロントエンドのハーネスビルド（チェックアウトごとに 1 フォルダ。レイアウト走査が開き、検証アプリが埋め込み、ブラウザサーバーが配信する） | 7 日 |
| `e2e-lock/` | e2e ロック。重い Playwright の実行が持っている間だけ存在する | 一時物（3 日） |
| そのほかすべて（テストスクリプト、スクリーンショット、ログ、`live*`、ほかの `verify-*`） | 一時物 | 3 日 |

古いものは、既定で削除される。`scripts/tools/prune-stale.mjs` がやり（`--dry-run` は一覧のみ）、`verify-real-app.mjs` と `check.bat` の開始時に、また Stop フックから黙って回る。経過は、その項目の `.last-used` マーカー（ハーネスがその項目を使うときに書く）から数え、なければ最上位の最新の更新時刻から数える。削除するのは `novira-data/work/` と `logs/` の直下の項目だけ（`logs/` では表にある項目だけなので、ほかに置いたものは残る）。リンクはたどらず、`novira.lock` が保持されている項目や、動いているプロセスが名指ししている項目は残し、検証用の `novira.exe` が動いている間はすべて残す。自分の一時物（テストスクリプト、スクリーンショット）は `novira-data/work/<name>` に書く。残ることを当てにしない。

## 安全のための規則

- ユーザー自身の `novira.exe` とその ComfyUI を止めない。止めてよいのは検証用 exe と、コマンドラインに検証用コピーを含む Python プロセスだけ。
- 検証ウィンドウはユーザーの画面に見えており、ユーザーが使うこともある。再起動する前に、それが空いていること（キューが空、ダウンロード中のものがない）を確かめ、ユーザーのジョブが動いている間は操作しない。
- ユーザーが GPU を使っていないことを確かめる。`node scripts/tools/gpu-check.mjs` は `nvidia-smi` で負荷を測り（最も忙しい GPU の平均負荷が 25% 以上なら終了コード 1。変えるには `NOVIRA_GPU_BUSY_PERCENT`）、ロックを持つ者を表示する。`verify-real-app.mjs` と `models-live.mjs` は起動前にこれを回し、GPU が忙しければ止まる。ユーザーに尋ね、同意を得てからにかぎり `NOVIRA_GPU_CHECK=0` を設定して飛ばす。メモリは判定しない（待機中の ComfyUI もモデルを載せたままにする）。読むのは NVIDIA の GPU だけ。
- GPU を使う作業は、ディレクトリロック `NOVIRA_GPU_LOCK` を取る。取るには `mkdir`、放すには `rmdir`、あるあいだは待つ。アプリも自分のジョブで同じロックを取るので、アプリでジョブが動いている間は手で持たない（ジョブが永久に待つことになる）。ComfyUI に直接つなぐスクリプトは、`mkdir` が成功した後にだけ、ロックを自分で取る。アプリは自分のロックを隣の `<lock>.owner` ファイル（プロセス id と開始時刻）に記録し、終了時に放し、記録されたプロセスが消えているロックは引き継ぐので、クラッシュしても次の起動は止まらない。その記録のないロックはほかの誰かのもので、アプリは決して取り除かない。
- テスト結果とレポートは `logs/` に出し、ハーネスが生成するそれ以外はすべて `novira-data/work/` の下に置く（どちらも git の対象外。実行が作るまでフォルダは存在しない）。「ハーネスの書き込み先」を参照。
- ユーザーのモデル（`novira-data/models`）は共有で、コピーもリンクもしない。ハーネスはそのフォルダを検証データの `settings.json` の `modelRoots` に書く（なければ作り、あれば統合し、重複させない）。テストはそこのファイルを削除したり、そこへインストールしたりしてはならない。ダウンロードは検証データ自身の `models/` に入る。そこに置いたパック（動画、音楽、音声など）も同じ設定で読まれるので、隔離したアプリにも見える。ハーネスが削除するフォルダから、そこへのジャンクションやシンボリックリンクを作らない。
