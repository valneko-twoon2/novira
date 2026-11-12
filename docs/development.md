# 開発環境の用意

Windows PC でソースを動かす手順、ランチャーの使い分け、次に読むもの。部品のつながりは [architecture/README.md](architecture/README.md)、変更の確かめ方は [verification.md](verification.md)、リポジトリでの作業規則は [../AGENTS.md](../AGENTS.md)。

## 必要なもの

| ツール | 理由 |
|---|---|
| Windows 11 | ランチャーは `.bat` で、アプリは Windows 向けにビルドする |
| Git | リポジトリと、それが入れるフック |
| Node.js 22 以降 | フロントエンドと Node 製のツール（`frontend/package.json` の `engines`） |
| Rust（stable、rustup 経由） | `backend/rust-toolchain.toml` が `rustfmt` と `clippy` つきの stable チャンネルを選ぶ |
| Microsoft C++ Build Tools | Windows で Rust が必要とするリンカー（「C++ によるデスクトップ開発」ワークロード） |
| WebView2 ランタイム | ウィンドウはこれで UI を表示する。Windows 11 には入っている |
| GPU（生成するとき） | ComfyUI が使う。アプリは既定で NVIDIA 向けのビルドをインストールし、AMD 向けは設定のエンジンで選べる。モックでの画面作業には要らない |

`cargo` は `PATH` に通す。ランチャーは `%USERPROFILE%\.cargo\bin` を自分で追加する。`scripts\dev.bat` は初回に `tauri-cli`（バージョン 2）をインストールし、数分かかる。

## 最初の準備

```bat
git clone https://github.com/valneko-twoon2/novira.git
cd novira\frontend
npm ci
```

`npm ci` は Git のフックの場所を `.githooks/` に向ける（`prepare` スクリプト）。フックはコミットが受理される前に、行末、画面のレイアウト、ドキュメント、コミットメッセージを検査する（[architecture/tooling.md](architecture/03-tooling.md) を参照）。

次にリポジトリのルートで `scripts\start.bat` を実行する。最初のビルドは Rust の依存をすべてコンパイルするので数分かかり、2 回目以降は変更分だけをやり直す。アプリは初回の起動で自分の ComfyUI を `novira-data\` へインストールする。最初の 1 枚にはモデルも要る（マニュアルの第 1 章、[manual/en/01-start.md](manual/en/01-start.md) を参照）。

## 実行のしかた

| ランチャー | 動かすもの | 使うとき |
|---|---|---|
| `cd frontend && npm run dev` | UI だけをブラウザ（http://localhost:5173/）で、メモリ上のモックのバックエンドにつないで動かす | 画面を作っていて、エンジンが要らないとき。何も生成されず、モックは毎回同じ返事をする |
| `scripts\dev.bat` | Vite の開発サーバー上のデスクトップアプリ（`cargo tauri dev`）。バックエンドは本物 | フロントエンドをよく直すとき。保存した変更がすぐ見え、再コンパイルされるのは Rust の変更だけ |
| `scripts\start.bat` | 一度ビルドしたデスクトップアプリ（`start.bat fast` はビルドせずに開く） | 利用者が見るとおりのアプリが要るとき |
| `scripts\server.bat` | バックエンドだけをローカルの Web サーバーとして動かし、ブラウザで開く（`server.bat fast` はビルドを省く。家の Wi-Fi にいるスマホは、ページの ネットワークの項目から入れる） | ブラウザ版を作るとき、ウィンドウなしで本物のバックエンドが要るとき |
| `scripts\start.bat clean` | フロントエンドとアプリをきれいに再ビルドして開く（`start.bat clean full` は依存もすべて再ビルドする） | ソースは正しいのにアプリが壊れて見えるとき（例: スタイルのない HTML） |

Windows は実行中の `novira.exe` をロックするので、ランチャーで起動・再ビルド・検査をする前にアプリを閉じる。どのランチャーもデータをリポジトリのルートの `novira-data\` に置く。別のフォルダを使うなら `NOVIRA_DATA_DIR` を設定する。1 つのデータフォルダを使えるプロセスは同時に 1 つだけなので、アプリとブラウザ用サーバーは同じフォルダで一緒に動かせない。

## 作業の確かめ方

| コマンド | 内容 |
|---|---|
| `node scripts\tools\affected.mjs` | 変更したファイルに必要な検査だけを回す。ここから始める |
| `scripts\release\set-version.bat` | アプリのバージョンを `Cargo.toml`、`package.json`、ロックファイルに設定する（尋ねてくる。`set-version.bat 0.2.0` でも可） | リリースを準備するとき |
| `node scripts\tools\release-smoke.mjs` | `package.bat build` が `artifacts\` に作ったものを起動する。空のデータフォルダと古いデータのフィクスチャごとにサーバーを、エンジンなしでアプリを起動し、それぞれメイン画面かデータの応答が出るまで確かめる。GPU は使わず、作ったフォルダは終わると消す | リリースを公開するとき、zip の前 |
| `scripts\release\package.bat` | リリースを `artifacts\` にビルドし、リリースページ用の zip と SHA-256 にまとめる（プログラムとライセンス文だけ。`package.bat build` は zip の手前で止まる）。ノートは `CHANGELOG.md` のそのバージョンの節。タグ `v<version>` を push すると GitHub が同じことをして下書きのリリースを残す（[release-workflow.md](design/01-app/04-release/01-release-workflow.md)） | リリースを公開するとき |
| `scripts\check.bat` | 速い検査すべて。フロントエンドは型検査、lint、単体テスト、行末、バックエンドは `cargo fmt`、clippy、`cargo test`（`frontend` か `backend` で片側だけ） |
| `scripts\checks\full-check.bat` | あるテストすべて。ときどき手で回す（CI はテストを回さない）。`check.bat`、ブラウザ用サーバーのテスト、モックと本物のバックエンドの比較、Playwright の全プロジェクト、レイアウトのスキャンで約 30 分。レポートは `logs\full-check\` に出る（`--no-browser` でブラウザの手順を省く） |
| `cd frontend && npm run check` | フロントエンドの部分だけ |
| `cd frontend && npx vitest run <path>` | フロントエンドのテストファイル 1 つ |
| `cd backend && cargo test -p novira-core --lib` | バックエンドの単体テスト |
| `cd frontend && npm run e2e` | ブラウザでの画面の流れ（Playwright、モック上）。先に一度 `npx playwright install chromium webkit` を実行する（WebKit は iPhone が開くとおりにスマホのレイアウトを動かす） |

どの変更にどの検査が合うかは [../.claude/rules/tests.md](../.claude/rules/tests.md)。実アプリ、エンジン、モデルの総当たりの実行は [verification.md](verification.md)。

## ブランチと PR

ブランチは 2 本。作業の幹の `develop`（既定のブランチ）と、リリースしたものだけの `main`。作業ごとに `develop` から短いブランチを切り、PR で `develop` に戻す。リリースのときだけ、`develop` を `main` に squash マージする。`develop` に入るたびに CI を回すことはしない（CI と CodeQL は、リリースの PR と毎晩の `develop` で回る）。

1. **ブランチ。** 作業 1 つ（機能 1 つ、修正 1 つ）ごとに、`develop` から `node scripts/tools/worktree.mjs add <名前>` で worktree とブランチを作る。エージェントは自分の判断で作る。
2. **PR。** 終わったら `/ship`。説明は `.github/pull_request_template.md` の節（背景、変わらないこと、変更内容、確認結果、チェックリスト、追加・変更したテスト。meta/astryx の PR の節を日本語の名前にしたもの）で書き、`node scripts/tools/pr.mjs open` で push して `develop` 向けの PR を開く（`develop` 向けの PR では CI も CodeQL も回らない。直す検査は、push の前に手元で通す）。新しいエージェントが GitHub 上でレビューする（`pr.mjs review`。先頭に色付きの枠で「判定: OK / NG」と指摘・任意の件数と見たコミット、続いて「総評」「前回の指摘」「指摘」「任意」の節。指摘は `ファイル:行` と「問題」「直し方」）。指摘があれば直して、レビューをやり直す。2 回目からは、前回の指摘の扱いと前回からの差分だけを見る。「任意」の指摘はマージを止めない。
3. **マージ。** `pr.mjs merge` は、今の head に対するレビューが ok で、タイトルと説明が決まりに合うときに、`develop` へ squash でマージする（検査は待たない）。`develop` と `main` のブランチ保護が、PR を通さない push を拒む。
4. **リリース。** マージのたびに `/release-notes` が、前のタグから利用者に見える変更があるかを判断する。あれば版を決め、`CHANGELOG.md` の節を書いた変更を `develop` に入れ、`develop` のその時点の写し（ブランチ `release/v<版>`）から `main` へのリリースの PR（`pr.mjs open --release`）を開く。写しなので（`release/` のブランチが `develop` の外のコミットを持っていれば、`pr.mjs merge` は断る）、PR のレビューと検査のあいだにも `develop` への作業は進められる（途中で `develop` に入ったものは、写しを `develop` に進め直すまでリリースに入らない）。この PR は下書きで開き、レビューが ok になると下書きが外れて、CI と CodeQL が回る。すべて通ると、`pr.mjs merge` が `main` へ squash でマージする。タグを `main` のそのコミットに push し、リリースのワークフローが通ったら公開する。最後に `pr.mjs sync` が、`main` を `develop` にマージコミットで戻す（squash では `develop` の履歴が `main` に入らないので、戻さないと次のリリースの差分に出した変更が混ざる。マージの結果が `develop` のツリーと等しいときだけ、レビューなしで入る。リリースのあとに `develop` へ入った作業は、リリースが変えた行と別の場所なら、そのまま残る。同じ行を変えていると、`git merge` では競合する。そのときは、main の中身が過去のある時点の `develop` と同じなら（リリースは `develop` の写しなので普通はそう）、`develop` の中身のまま main を親に加えたマージコミットを `sync/<id>` のブランチにして、同じ形で入れる。そうでなければ `pr.mjs` は入れずに人へ回す）。
5. **依存の更新。** Dependabot の PR は `develop` 向け。`develop` 向けの PR では検査が回らないので、Dependabot のブランチへの push で `Test`・`Supply chain`・`Audit` が回り、小さな更新はそれが通れば自動でマージされる（[design/01-app/04-release/03-dependabot.md](design/01-app/04-release/03-dependabot.md)）。`develop` に入った更新は、次のリリースで `main` に入る。

## 知っておくこと

- **ものの場所。** `frontend/` が UI、`backend/` が Rust のワークスペース（`crates/novira-core` がライブラリとしてのバックエンド、`src-tauri` が薄いデスクトップシェル、`crates/novira-server` がブラウザ用サーバー）、`contract/` が両側で検査する JSON のサンプル、`scripts/` がランチャー、`scripts/tools/` が検査と補助。変更の種類ごとの出発点は [architecture/README.md](architecture/README.md) にある。
- **画面の文言** は `frontend/src/i18n/locales/` のカタログだけに、日本語と英語を一緒に書く。[../.claude/rules/i18n.md](../.claude/rules/i18n.md) を参照。
- **生成されるファイル:** テスト結果とレポートは `logs\`、残り（検証用データ、ビルド、一時ファイル）は `novira-data\work\` の下。どちらもコミットせず、古くなると片付けられる。
- **コミットメッセージ** は日本語で、Conventional Commits の種類（`feat:`、`fix:`、`docs:`、`chore:` など）で始める。1 行目は 72 文字以内、続けて短い箇条書きを 8 行まで（[../.claude/rules/commit-messages.md](../.claude/rules/commit-messages.md)）。従わないメッセージはコミットのフックが拒否する。
- **ポート。** 開発サーバーは 5173 を使う。ランチャーは起動前に、そのポートに残った Vite を止める。
