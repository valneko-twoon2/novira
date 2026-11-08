---
covers:
  - backend/src-tauri/capabilities/**
  - backend/src-tauri/tauri.conf.json
  - backend/src-tauri/src/command_list.rs
  - backend/src-tauri/src/commands.rs
  - backend/src-tauri/tests/security/**
  - frontend/scripts/eslint-security.mjs
  - .claude/rules/security.md
---
# セキュリティ設計

一覧に戻る: [README.md](README.md)

デスクトップアプリが何を守り、どう守り、何をあえて開けたままにしているか。このページは全機能に共通することを持つ。守るもの、攻撃者として想定するもの、すべての呼び出しが通る 2 つの境界（IPC と WebView の内容）、各機能の境界がどこに書かれているか、どの機能にも属さない限界、変更後の再確認の方法。機能ごとの境界と既知の限界は、その機能のページの挙動の隣にある。

## 守るもの

- 秘密: Civitai の API キー、Hugging Face のトークン、アシスタントがつなぐ OpenAI 互換サーバーの API キー、エクスポートでコンテンツクレデンシャルに署名する秘密鍵。
- ユーザーのファイル: アプリはユーザーが指したモデルファイルを読み、自分の `novira-data/` フォルダに書く。それ以外の場所を読み書きするよう仕向けられてはならない。
- ユーザーの PC: アプリはほかのプログラム（ComfyUI の Python、`claude` / `codex`、ブラウザ）を起動し、数 GB のファイルをダウンロードする。

想定する攻撃者: 悪意のある、または侵害された Web ページやモデル一覧（Civitai / Hugging Face のデータ）、悪意のあるモデルファイルや画像、WebView 内で動いてしまったスクリプト、ほかのローカルプログラム。ユーザーのアカウントを既に握っている人は対象外。

## すべての呼び出しが通る境界

| 境界 | 守り |
|---|---|
| WebView から Rust へ（IPC） | 許可するのは novira 自身のコマンドだけ（`backend/src-tauri/capabilities/default.json`。登録済みの一覧 `backend/src-tauri/src/command_list.rs` と等しいことをテストが保つ）。fs、shell、http、opener のプラグインは無い。対象は `main` ウィンドウだけで、リモートのページには権限を与えない。 |
| WebView の内容 | `backend/src-tauri/tauri.conf.json` の CSP: スクリプトと接続は自分のオリジンだけ。画像は画像スキーム、`data:`、`blob:`、モデルサイトなど決まったホストからだけ、メディア（Browse の動画カバー）は画像スキームと `https://*.civitai.com` からだけ。`object-src`、`frame-src`、`form-action`、`base-uri` は閉じる。UI は React でデータを描画し（`innerHTML` は使わない）、Civitai の説明文はバックエンドでプレーンテキストにする。ウィンドウに戻るボタンは無く、アプリのオリジンを出ない（`backend/src-tauri/src/navigation.rs` が、ほかへの最上位ナビゲーションを拒否する）。 |

コマンドは、呼び出し側ではなく境界で受け取った内容を検証する。WebView はファイルパスを送受信せず（ネイティブダイアログはシェルが自分で開く）、画像は生成された名前だけで受け取る。

## 各機能の境界の場所

| ページ | 持つ境界 |
|---|---|
| [01-runtime.md](01-runtime.md) | データベース（固定 SQL、束縛パラメータ） |
| [01-browser-server.md](../../06-server/01-local/01-browser-server.md) | ブラウザ用サーバー: ループバック（ホームネットワークは必要なときに開く）、起動ごとのトークン、`Host` と `Origin` の検査、提供するコマンド、イベントソケット、アップロード、画像名、フロントエンドフォルダのファイル |
| [02-browser-server-pairing.md](../../06-server/02-network/02-browser-server-pairing.md) | デバイスのペアリング: フラグメント内のコード、公開のペアリング経路、このコンピューターでの承認、アドレスに結び付いたセッション、レート制限 |
| [01-browser-server-lan.md](../../06-server/02-network/01-browser-server-lan.md) | 必要なときに開くホームネットワーク: TLS 専用のリスナー、ローカル CA とその名前制約、どの接続に応えるか（サブネットの検査）、ホームアドレスの `Host` と `Origin` |
| [03-browser-server-remote.md](../../06-server/02-network/03-browser-server-remote.md) | 外出先のスマートフォン: tailnet アドレスのリスナー、tailnet 名の `Host`、承認後の登録、パスキーの検査とチャレンジ、`tailscale.exe` の実行、保存したパスキー |
| [01-generation.md](../../02-generation/01-pictures/01-generation.md) | ジョブが使う画像、ローカルエンジン |
| [01-models.md](../../02-generation/03-models/01-models.md) | モデルのダウンロード、フォルダスキャンが挙げるローカルファイル、通信中と保存時の秘密 |
| [04-browse.md](../../02-generation/03-models/04-browse.md) | Civitai と Hugging Face のページを開くこと |
| [02-extensions.md](../03-engine/02-extensions.md) | ComfyUI のカスタムノードパックとそのバージョン、ComfyUI のバージョン切り替え |
| [01-assistant.md](../../03-assistant/01-core/01-assistant.md) | アシスタント（CLI と OpenAI 互換サーバー）、そのツールサーバー、画像とプロンプトの読み取り |
| [03-assistant-web-lookup.md](../../03-assistant/02-context/03-assistant-web-lookup.md) | アシスタントの事実の調べもの（`lookup_reference`）: モデルが書いた言葉から出す唯一のリクエストで、ユーザーが許可した後、`ja.wikipedia.org` / `en.wikipedia.org` だけに送る |
| [02-gallery-share.md](../../04-gallery/01-files/02-gallery-share.md) | 画像スキーム、アップロードされた画像、エクスポートの透かしファイル、画像の検証、コンテンツクレデンシャルの署名鍵 |
| [01-comic-canvas.md](../../05-comic/01-canvas/01-comic-canvas.md) | キャンバス文書、漫画プロジェクト、インストール済みのフォント名 |
| [01-settings-engine.md](../03-engine/01-settings-engine.md) | エンジン設定、未完了のダウンロード、ユーザーが選ぶファイル、バックアップ zip の復元 |
| [03-ui-state-sync.md](../02-screens/03-ui-state-sync.md) | 共有する画面状態: サイズと形の検査、保存が送るページ ID とイベント、ページがほかのページから取り込むもの |

新しいコマンド、URL、パス、プロセス、外部データを使う場所は、同じコミットで、それが属する機能の表に加える。

## どの機能にも属さない既知の限界

- `c2pa` が serde_json の `preserve_order` を有効にするので、JSON オブジェクトはバックエンド全体でキーを加えた順を保つ。novira に JSON テキストを比較する箇所は無く、グラフのスナップショットは比較前にキーを並べ替える。
- 依存関係の指摘: `cargo audit`（2026-10-24）は `rsa` の RUSTSEC-2023-0071（Marvin タイミング攻撃）を報告する。`c2pa` はこれを外部の RSA 署名済みマニフェストの検証にだけ使い、攻撃は秘密鍵操作のタイミングから秘密鍵を復元するもので、novira は RSA 鍵を持たない（署名は ES256）。`zip` は 2026-11-04 に 9（ロックは 9.3.0）へ上げ（`c2pa` も 0.91.10）、8.6.0 の 3 件（RUSTSEC-2026-0367/0368/0369）は当たらなくなった。rustls は `novira-server` のホームネットワーク用リスナーのためにだけコンパイルされ（アプリもそのリスナーを内部で動かすためリンクする）、0.23.46 と rustls-webpki 0.103.16 で、RUSTSEC-2026-0346 から -0349 と -0382 を直した版である。それ以外はネイティブ TLS（`reqwest`）を使う。RUSTSEC-2026-0383（`webpki-root-certs`）はロックファイルにあるが、コンパイルされるツリーには無い。RUSTSEC-2026-0387（`crypto-bigint` 0.5 のタイミング）は、ロックの `crypto-bigint` が 0.7.10 なので当たらなくなった。メンテナンス終了や unsound の警告は、ビルド時マクロ（`paste`、proc-macro-error）、`glib`（Linux の GTK）、`tokio`（RUSTSEC-2026-0386）に残っている。`npm audit --omit=dev` は配布するフロントエンドの依存に脆弱性 0 件と報告する。audit ワークフロー（[02-ci.md](../04-release/02-ci.md)）が両方を毎週実行し、判断済みの指摘は `backend/.cargo/audit.toml` に載せるので、新しい勧告だけが失敗にする。ロックファイルのライセンス、禁止または不特定バージョンの依存、取得元、git 履歴中の秘密は、supply-chain ワークフロー（[02-ci.md](../04-release/02-ci.md)）が手動と毎週で検査する。
- 外部サービスのアドレスは `endpoints.rs` にある。テストがそれをループバックサーバーに向け直せるのはデバッグビルド（`debug_assertions`）だけで、リリースビルドはこの方法でリダイレクトできない。
- 秘密はユーザーの Windows アカウントで暗号化され、同じユーザーのほかのプログラムには対抗しない。これとほかの機能の限界は、その機能のページにある。
- ブラウザ用サーバー（`novira-server`）は、同じコマンドの第 2 の入口。そこのページに IPC の権限一覧は無く、代わりになるのは起動ごとのトークン、`Host` と `Origin` の検査（イベントソケットとアップロードにも）、一覧 `SERVED` である。コマンドを提供するのは、バックエンド自身の検査が、アプリのウィンドウに対して既に安全にしているときだけ。キーは書き込み専用（DPAPI で保存し、返さない）、ローカルのモデルファイルのパスは拒否する（アプリは自分のフォルダスキャンからしか受け取らない）、ダイアログを開くものやバックアップを復元するものは提供しない。アプリの外のページ（Civitai、Hugging Face、モデルの配布元）は、バックエンドが組み立てて検査したアドレスとして返り、ページは新しいタブで開くので、アプリが開かないサイトをブラウザが開くことはない。このコンピューター（ループバックのピア）では、トークンを持つ者がウィンドウにできることをできるので、トークンはログに出さない。コンソールやプロセス一覧を読むほかのローカルプログラムは、上と同じ限界である。同じホストの別ポートを提供するものも同じ限界である。ブラウザはホストの cookie をすべてのポートに送るため（cookie 名がポートを持つのは、2 つのサーバーが自分のトークンを別々に保つためだけ）。ホームネットワーク（必要なときに開く）のデバイスが到達できるのは、このコンピューター上の CA が署名した証明書を持つ TLS リスナーだけで、このコンピューターが承認したセッションでだけ入れ（起動トークンはそこでは資格情報にならない）、安全な部分集合だけを得る。`LOOPBACK_ONLY`（インストール、拡張機能とエンジンのバージョン変更、エンジンとモデルフォルダの設定、キー、アシスタントのセットアップ）は、トークンがあってもそこでは拒否される。リスナーはこのコンピューターの持ち主が信頼したネットワーク（ゲートウェイで識別）でだけ開き、30 分使われなければ閉じる。スマートフォンが入れるのは、このコンピューターの前の人が両方の画面の番号を見比べて許可した後だけで、CA を信頼するのは、このコンピューターが示す指紋と見比べた後にするべきである（隙は、2 分以内に撮られた QR コードと、見ないで承認すること）。したがって盗まれたセッションができるのは、生成、ギャラリー、アシスタントとのチャット（アプリのツールを通してしか動かない）までで、インストール、設定変更、キー、新しいアシスタントサーバーはできない。デスクトップアプリは同じホームネットワーク用リスナーを自分の中で動かし、このコンピューター上にリスナーは持たない。ウィンドウは同じ管理経路を実行する 9 つの `lan_*` コマンドでそれを操作する。外出先では、持ち主が有効にしている間、スマートフォンは Tailscale 経由でだけ第 3 のリスナー（tailnet のデバイス、tailnet 名の証明書）に届き、このコンピューターの承認後に作ったパスキーでだけ入れる。サインインのたびにユーザー確認があり、得られる部分集合は同じ。ウィンドウは 8 つの `remote_*` コマンドで操作し、このリスナーも rustls で提供する。外出先: [03-browser-server-remote.md](../../06-server/02-network/03-browser-server-remote.md)。グループごとの理由: [01-browser-server.md](../../06-server/01-local/01-browser-server.md)、ホームネットワーク: [01-browser-server-lan.md](../../06-server/02-network/01-browser-server-lan.md)。

## 再確認

コマンド、URL、パス、プロセス、外部データを使う場所を加える変更の後: 権限（capability）の一覧を更新し、呼び出し側ではなく境界で検証し、敵対的な入力のテストを加え、`cargo audit` と `npm run audit`（`frontend/` で `npm audit --omit=dev`）を実行する。エージェント向けの変更ごとのチェックリストは `.claude/rules/security.md`。

機械的な検査（各検査の限界はそのコードの隣に書いてある）:

| 検査 | 守るもの |
|---|---|
| ESLint の `novira-security/*` と `no-eval`、`no-implied-eval`、`no-new-func`、`no-script-url`（`frontend/scripts/eslint-security.mjs`） | DOM への HTML 文字列（`dangerouslySetInnerHTML`、`innerHTML` / `outerHTML` / `srcdoc` への代入、`insertAdjacentHTML`、`document.write`）、動的コード、`src/backend` の `openInNewWindow` を通さない別ウィンドウを禁じる。構文だけを見る。 |
| `cargo test -p novira --test security`（`backend/src-tauri/tests/security/`） | `config`: CSP の重要なディレクティブ、`devCsp`、アセットプロトコル、Tauri プラグイン依存が無いこと、capability ファイルが 1 つだけであること。`source_scan`: Rust からコマンドインタープリターを起動しない（`build.rs` は許可）、SQL テキストは `Table::name()` だけを取る、`rusqlite` はデータベースモジュールだけで使う。`secrets`: git がコミットするすべてのものの中の資格情報の形とキーファイル。テキストの走査なので、別名、組み立てた文字列、履歴、未知のキー形式は見えない。 |
| `cargo test -p novira`（`the_capability_allows_exactly_the_registered_commands`） | capability が登録済みコマンドと等しく、プラグイン権限を持たず、`main` ウィンドウだけに適用されること。 |
| 守りの隣のユニットテスト（`images`、`models::install`、`image_serve`、`service::guidance`、`backup`。zip-slip と他アプリのバックアップは `tests/backend_service/backup.rs`） | 名前の検証、トラバーサル、URL の解析、サイズ制限、ガイダンスの制限を、敵対的な入力で検査する。 |
