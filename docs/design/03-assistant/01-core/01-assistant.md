---
covers:
  - backend/crates/novira-core/src/agent/**
  - backend/crates/novira-core/src/service/assistant.rs
  - frontend/src/state/agent.ts
  - frontend/src/state/agentTools.ts
  - frontend/src/state/agentGuide.ts
  - frontend/src/state/agentEndpoint.ts
  - frontend/src/state/agentExtensions.ts
  - frontend/src/features/workflows/agentNodes.ts
  - frontend/src/features/agent/**
  - contract/agent-request.json
  - .claude/rules/assistant.md
---
# AI アシスタント

一覧に戻る: [README.md](README.md)

アプリの設定と、アプリについての質問への回答を受け持つチャット。モデルはツール（設定、エディター、キュー、拡張機能の提案、アプリの案内）を通してしか動かない。利用者自身の `claude` または `codex` コマンドラインツール（それぞれのログインで認証）か、Ollama など OpenAI 互換 API のサーバーで動く。3 つとも同じツール、プロンプト、検査を使う。

## 動作

- ウィンドウ（`frontend/src/features/agent/agent.css`）: アプリのパネルの上に浮かび（`--z-assistant`、500）、ダイアログ（`--z-modal-overlay`、800）、メニュー、ポップオーバー、ツールチップの下に置くので、それらを隠さない。モデルの選択はすぐ上（`--z-assistant-popover`、501）。層は `frontend/src/theme/tokens.css` のトークンで、`frontend/tests/assistant-layer.test.ts` が読む。
- スマホではチャットが独立した画面になる（[02-phone-layout.md](../../01-app/02-screens/02-phone-layout.md)）。サインインとサーバーの設定は PC 側にだけある。
- プロバイダー: `AgentProvider` は `claude`・`codex`・`openai`（`backend/crates/novira-core/src/agent/mod.rs`）。選択は `<data>/agent.json` に保存し、キーは保存しない。`agent_login` は選択を保存して `claude auth login` または `codex login` を実行する（ブラウザが開く。最長 300 秒）。状態は `claude auth status` または `codex login status` から得る（`backend/crates/novira-core/src/agent/cli.rs`）。
- コマンドラインツールのモデルと思考の強さ: [02-assistant-models.md](02-assistant-models.md)。
- CLI のリクエスト: メッセージごとにヘッドレスで 1 回実行する。Claude は `-p --tools "" --setting-sources "" --strict-mcp-config --allowedTools mcp__novira`、アプリのサーバーは `--mcp-config` で渡す。Codex は `exec --sandbox read-only --ignore-user-config --ignore-rules`、サーバーは `-c`、答えは `-o` から読む。プロンプトは標準入力で渡す（`backend/crates/novira-core/src/agent/chat.rs`）。
- サーバーのリクエスト: Rust のバックエンドが `POST {base}/chat/completions`（`stream: false`）と `GET {base}/models` を自分で呼ぶ。`backend/crates/novira-core/src/agent/toolloop.rs` が規則とツールを関数定義として送り、返された呼び出しを `mcp::dispatch` で実行し、モデルが呼び出しなしで答えたら止める。
- 接続テスト（`agent_endpoint_test`）はモデル一覧と、`get_screen` による 1 回のツール往復を確かめる。`get_screen` の答えは定型で、実行はしない。ツールを呼べないモデルや、リクエストを途中で切るサーバー（`toolloop::cut_short`）は理由つきで記録し、新しいテストが通るか、サーバーかモデルが変わるまで拒否する。
- モデルに送る画像（添付、描いたコミックのページ）: [02-assistant-pictures.md](../02-context/02-assistant-pictures.md)。
- プロンプト（`backend/crates/novira-core/src/agent/prompt.rs`）: 英語の規則（`INSTRUCTIONS`）、ロケール、画面（`currentScreen()`）、聞かれた拡張機能、トークン予算に収まるチャットの過去のターン（[01-assistant-history.md](../02-context/01-assistant-history.md)）。モデル、設定、グラフは入れず、モデルがツールで読む。規則は、聞き返す前にアプリが持つものを読むこと、添付画像の見た目はピクセルから読み取って現在の設定に反映すること、選択肢の一覧で答えないこと、二度聞かないことを定める。最終回答は利用者の言語のテキストで、先頭に 1 行 300 文字まで・8 行までの `<thoughts>` ブロックを付けてもよい。テキストは 20000 文字で切る（`backend/crates/novira-core/src/agent/reply.rs`）。
- ツール（`backend/crates/novira-core/src/agent/tools.rs` の `TOOLS`）: 33 個。それぞれ説明と JSON スキーマを持つ。読み取り専用（20）: `get_screen`、`get_app_guide`、`get_manga_guide`、`list_models`、`get_generation_settings`、`get_queue_status`、`get_engine_info`、`get_comic_page`、`view_comic_page`、`view_picture`、`get_text_scene`、`get_workflow`、`search_comfy_nodes`、`get_form`、`get_pose`、`list_gallery_images`、`get_image_info`、`search_extensions`、`lookup_reference`、`recommend_packs`。変更する（13）: `refine`（[03-assistant-refine.md](03-assistant-refine.md)）、`select_model`、`add_lora`、`set_generation_settings`、`generate`、`cancel_queue`、`edit_comic`、`edit_text`、`edit_workflow`、`create_workflow`、`set_form`、`set_pose`、`export_pictures`（[04-assistant-runs-and-files.md](04-assistant-runs-and-files.md)）。`add_lora` はトリガーワードを返す。
- `lookup_reference`: [03-assistant-web-lookup.md](../02-context/03-assistant-web-lookup.md)。
- 引数の検査（`tools::check_call`）: 型、enum、長さ、個数、範囲、必須フィールド。未知のフィールドは、スキーマが `additionalProperties: false` を指定した所でだけ拒否する。引数は最大 512 KiB、1 回の編集は最大 400 操作（`MAX_OPS`）。
- `mcp::dispatch`（`backend/crates/novira-core/src/agent/mcp.rs`）が唯一の経路: リクエストの上限（150、`MAX_TOOL_CALLS`）に呼び出しを数え、検査を行い、ハンドラーに渡す。CLI には、アプリの MCP サーバー（Streamable HTTP、JSON の答え、`initialize`・`ping`・`tools/list`・`tools/call`、`127.0.0.1`）が 1 リクエスト分の呼び出しを運ぶ。
- リレー（`backend/crates/novira-core/src/agent/relay.rs`）: 各呼び出しは `agent_tool_call` イベント（`callId`、`tool`、`args`、`readGated`）としてウィンドウへ渡り、ウィンドウは `agent_tool_result` で答える。呼び出しは 120 秒（読み取り許可が必要なら 600 秒）待つ。答えがなければモデルにはエラーになる。
- ウィンドウ（`frontend/src/state/agentTools.ts`）: ハンドラーは各機能自身の適用処理を使う。`registerAgentEditor` で登録したエディターと、Generate タブのパラメーター。テキストの操作は未知のフォント、不正な色、範囲外の数値を捨てる（`frontend/src/features/text/aiOps.ts`）。ワークフローとして解釈できない編集は何も変えない（`frontend/src/features/workflows/aiOps.ts`）。200000 文字を超える答えは拒否する。
- ComfyUI のノードを使うワークフロー: `get_workflow` はエディター自身のノードと、レシピが使う ComfyUI のノードを列挙する。`search_comfy_nodes`（`frontend/src/features/workflows/agentNodes.ts`）は、ComfyUI が報告する残りのノード（インストール済みの拡張機能のものを含む）を数語で探し、1 回に最大 20 件、それぞれ `comfy:<Class>` 型、入力（選択肢、既定値、選択肢ごとの入力、リンク、ギャラリーのファイル）、出力を返す。語がなければグループを列挙する。ComfyUI が動いていない間は `ready: false` で答える。編集は `skipped`（除いた操作や部分とその理由: 未知の型、合わない型どうしの接続、ノードが取らない入力への値）を返す。未知のノード型を含むグラフは開かず、答えがどれかを示す。ツールが返すグラフは `problems`（Invoke ボタンを無効にする理由、`readinessReasons`）を持つ。グラフはワークフロー画面での `generate` で動く。
- エディターは `edit_*` に、コンテキスト全体の代わりに短い `answer` を返してよい（コミックは `comicAnswer`）。
- 元に戻す: リクエストは各種類の最初の変更の前に Generate の設定と各エディターのデータを保持し、1 回答につき 1 回の元に戻すで復元する（`frontend/src/state/agent.ts` の `undo`）。キュー済みのジョブと保存済みの画像は戻らない。モデルに伝える過去の答えと設定: [01-assistant-history.md](../02-context/01-assistant-history.md)。
- リクエスト実行中に書いたメッセージは `queued` で待ち（`state/agent.ts`、薄く表示、削除可）、終了後に送られる。失敗後は待ちのメッセージが入力欄に戻り、停止では保たれる。
- 「/」のコマンド（`frontend/src/features/agent/slashTemplates.ts`）: 定型の依頼を機能ごとの区分で一覧に出す。確定すると入力欄には `/コマンド ` だけが残り、送信のときに定型文と続きの文へ置きかえる（`expandCommand`。モデルに届くのは文章だけ）。`/help` は入力欄の上に説明を開くだけで何も送らない。ビルドが隠している画面（`isScreenShown`）の区分は一覧にも入力にも現れず、打っても普通の文として送られる。
- 同時に 1 リクエストだけ動き（`backend/crates/novira-core/src/service/assistant.rs`）、15 分（`CHAT_TIMEOUT`）以内。`agent_cancel` で終わり、それまでの変更は元に戻せる。

## 境界

| 境界 | 防ぎ方 |
|---|---|
| AI アシスタント | 利用者自身の `claude` / `codex` を、組み込みツールを切って実行する（引数は上の「CLI のリクエスト」）。プロンプトは標準入力、引数は固定。固定でない引数は、ツールが列挙するモデル 1 つだけ（[02-assistant-models.md](02-assistant-models.md)）。モデルはアプリのツールを通してしか動かない。画像の削除、モデル・拡張機能・プログラムのインストールをするツールはなく、`generate` は利用者が頼んだものをキューに入れるだけ。すべての呼び出しの引数はサーバーでツールのスキーマに照らして検査し、ウィンドウが各操作をもう一度検査する。最終回答はテキスト（最大 20000 文字）で、チャットはその Markdown を React 要素に組み立て、HTML にはしない。thoughts の行は 8 行・300 文字に切り、同じ方法で表示する。`agent_cancel` は引数を取らず、実行中のリクエストだけを止める（プロセスを kill し、待っている呼び出しを終える）。 |
| OpenAI 互換サーバーのアシスタント | 利用者が指定するサーバー。すべての呼び出しは Rust のバックエンド（`backend/crates/novira-core/src/agent/endpoint.rs`）が行い、ウィンドウは接続せず、`connect-src` は閉じたまま。`agent_endpoint_save`・`agent_endpoint_models`・`agent_endpoint_test` は入口で引数を検査する。アドレスは host を持つ `http` か `https` で、ユーザー名、パスワード、クエリ、フラグメント、空白は不可。この PC の外にあるサーバーへの平文 `http` は「暗号化されていない」、この PC の外のアドレスは「アシスタントが読んだものを受け取る」と表示する。キーは DPAPI のシークレット（`<data>/secrets/assistant-endpoint.key`）で、保存したアドレスへ `Authorization` ヘッダーにだけ載せて送り（入力したキーは、フォームに入力したアドレスへ）、ウィンドウには返さず、ログにも出さず、エラー文からも除く。新しいキーなしで別のアドレスを保存すると、保存済みのキーは捨てる。リダイレクトは同じホストの中（と `http` から `https` へ）だけ、最大 3 回。この PC 上のサーバーにはプロキシを通さない。上限: 接続 10 秒、1 呼び出し 5 分、1 リクエスト 15 分。答えは 4 MiB まで（モデル一覧 1 MiB、エラー文 64 KiB。サーバーのメッセージは 300 文字に切って表示）。サーバーの返答はデータで、そのツール呼び出しは MCP サーバーと同じ `mcp::dispatch` を通るので、このプロバイダーに弱い経路はない。ツールを呼べないモデルは、回避せずに拒否する。 |
| アシスタントのツールサーバー（ループバック） | アシスタントのリクエストが 1 つ動いている間だけ、OS が割り当てたポートで `127.0.0.1` を待ち受ける。同時に動くリクエストは 1 つ。リクエストごとに新しいランダムなベアラートークン（v4 UUID 2 つ）を使う。Claude はリクエスト専用の一時フォルダーの設定ファイル（後で削除）で、Codex は環境変数 `NOVIRA_MCP_TOKEN` で受け取り、引数では渡さない。実行前に拒否するもの: 誤り・欠落のトークン（定数時間で比較）、`127.0.0.1:<port>` と `localhost:<port>` 以外の `Host`（DNS リバインディング）、あらゆる `Origin` ヘッダー（Web ページ）、別のパス、16 KiB を超えるヘッダー部、1 MiB を超える本文、chunked や長さのない本文、JSON 以外のコンテンツタイプ、JSON でない本文、バッチ。1 リクエストにつきツール呼び出しは最大 150 回、15 分まで。呼び出しは `agent_tool_call` としてウィンドウへ渡り、答えは `agent_tool_result` で戻る。これは待機中の呼び出しにリレーが付けた形の id だけを受け付け、256 KiB を超える答えはエラーになる。誰も答えない呼び出しは、データではなくエラーとして終わる。 |
| アシスタントによる画像とプロンプトの読み取り | `list_gallery_images`、`get_image_info`、`view_comic_page`、`view_picture`、`includePrompts` 付きの `get_generation_settings` は、バックエンド（`backend/crates/novira-core/src/agent/tools.rs` の `is_read_gated`）とウィンドウ（`frontend/src/state/agentTools.ts` の `isReadGated`）の両方で読み取り許可が必要と印が付く。バックエンドは呼び出しに印を付けるだけで、ウィンドウが利用者の設定「画像とプロンプトの読み取り」（`assistantReadAccess`: 「常に許可」`always`、「毎回確認する」`ask`（既定）、「許可しない」`never`。設定 > 生成 > エージェント）を適用する。`lookup_reference` も同じ印だが、別の設定 `assistantWebAccess`（「Wikipedia での調べもの」）を使う。「ask」はチャットウィンドウに質問を出し、拒否、停止、「never」はモデルに、利用者が断ったというエラーを返す。利用者が添付した画像は質問なしで送る。ピクセルを返すツールは [02-assistant-pictures.md](../02-context/02-assistant-pictures.md) にある。添付の名前はギャラリーの名前と同じ検査をし、存在しなければプロバイダー開始前にリクエストを止める。ギャラリーの答えは画像名、サイズ、日付、モデル、プロンプト（一覧では 300 文字に切る）を含み、ファイルパスは含まず、補助画像は除く。 |

## 既知の限界

- OpenAI 互換サーバーでは、利用者のリクエストと、読み取り設定が許すときはプロンプトと画像の詳細が、入力したアドレスへ送られる。この PC の外では、平文 `http` ならネットワーク上で読まれ、`https` ならサーバーの運営者が読める。ウィンドウは両方を警告し、決めるのは利用者。アプリはプライベートネットワークのアドレスを止めないので、誤って入力したアドレスや、悪意ある指示が利用者の前に置いたアドレスへ、アプリがリクエストを送ることがある。外部サーバーの返答がモデルを惑わすこともある。
- リクエスト中は、同じ Windows ユーザーの別プログラムがツールサーバーのポートを見つけ、トークンを含む Claude の設定ファイルを読めるかもしれない。そのようなプログラムはすでに利用者として動ける。トークンが止めるのは Web ページと他のユーザーのプログラム。扱うエディター（コミック、テキスト、ワークフロー、フォーム、ポーズ）は許可なしで読む。許可設定の対象はギャラリーの画像と Generate タブのプロンプト欄だけ。
- ComfyUI Registry とインストール済みの拡張機能の説明は、`search_extensions` を通してモデルに届く。第三者が書いたもので、指示は「データとして扱う」よう定めているが、悪意あるテキストはモデルを惑わしうる。被害には限りがある。インストールや削除のツールはなく、設定とエディターの変更は元に戻せる。

## 未実装

- ストリーミング回答: 各リクエストは最終回答を待つ（サーバーのリクエストは `stream: false`）。
