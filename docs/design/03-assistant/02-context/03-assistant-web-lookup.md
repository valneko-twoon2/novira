---
covers:
  - backend/crates/novira-core/src/agent/reference.rs
  - backend/crates/novira-core/tests/reference_fake.rs
---
# アシスタントの事実調べ（Wikipedia）

一覧に戻る: [README.md](README.md)

アシスタントは、物語づくりを手伝うあいだ（時代、服装、場所、職業、用語）、Wikipedia で事実を調べられる。モデルが書いた語が Web サイトへ出る唯一の場所なので、リクエストは Rust のバックエンドだけが、固定の 2 つのホストへ、利用者が許可したあとに行う。アシスタント全体は [01-assistant.md](../01-core/01-assistant.md)。

## 動作

- ツール `lookup_reference`（`backend/crates/novira-core/src/agent/reference.rs`）: `query`（1 から 100 文字）と `language`（`ja` か `en`、既定 `ja`）。Rust のバックエンドが `ja.wikipedia.org` または `en.wikipedia.org` の MediaWiki action API を読み（各記事の冒頭をプレーンテキストで検索）、最大 3 件の `{title, extract, url}` を返す。各 extract は 1500 文字に切り、制御文字を除く。ウィンドウはコマンド `lookup_reference` を呼ぶ。ツールの説明は、テキストはデータであり、CC BY-SA 4.0 なのでタイトルと url で出典を示さねばならないこと、クエリは短く一般的であることをモデルに伝える。読み取り許可が必要（クエリが PC を出る）で、専用の設定「Wikipedia での調べもの」（`assistantWebAccess`）を持ち、許可の質問は送られる語を表示する。
- フロントエンド: `frontend/src/state/agentTools.ts` のハンドラーが `BackendClient.lookupReference` を呼ぶ。ブラウザのモックはクエリごとに定型の記事 1 件を返す。許可の質問（`frontend/src/features/agent/AgentWindow.tsx`）は専用のタイトルを持ち、語とサイトを表示する。設定「Wikipedia での調べもの」は 設定 > 生成 > エージェント にある（選択肢は「常に許可」「毎回確認する」「許可しない」）。

## 境界

| 境界 | 防ぎ方 |
|---|---|
| アシスタントによる Wikipedia での事実調べ | モデルが書いた語が Web サイトへ出る唯一の場所。コマンド `lookup_reference`（`backend/src-tauri/src/commands.rs`、`command_list.rs` と capability にある）は `language` と `query` を取り、バックエンドで両方をもう一度検査する。言語は正確に `ja` か `en` でなければならず（`Lang::parse`）、ホストはその enum から選び（`ja.wikipedia.org` か `en.wikipedia.org`、`endpoints::Service`）、入力からは決して選ばない。リクエストは `/w/api.php` への HTTPS GET で、パラメーターは固定、整えた語（制御文字は空白にし、1 から 100 文字）は 1 つのエンコード済みパラメーター（`gsrsearch`）として `Url::query_pairs_mut` で組み立てるので、`&`、`#`、改行でパラメーター、フラグメント、ヘッダーを足せない。アドレスは送信前と、リダイレクト後の最終アドレスでもう一度検査する（HTTPS、ホストが完全一致、ポートと認証情報なし）。リダイレクトは同じオリジンの中だけ、最大 3 回。Cookie ストアなし、接続タイムアウト 10 秒、合計 20 秒、説明的な `User-Agent`、答えは最大 1 MiB（ストリーミング中も）、返すのは最大 3 件・各 1500 文字で、別の形の答えはエラー。ウィンドウは外へ接続せず、`connect-src` は閉じたまま。ツールはバックエンド（`is_read_gated`）とウィンドウ（`isReadGated`）の両方で読み取り許可が必要で、「画像とプロンプトの読み取り」（`assistantReadAccess`）とは別の専用設定 `assistantWebAccess`（`always`、既定は `ask`、`never`）を使う。画像の許可が Web の許可になることはなく、Web の質問への「常に許可」が変えるのは Web の設定だけ。拒否、停止、「never」は、そのリクエストの中でもう聞かないよう伝えるエラーをモデルに返す。デバッグビルドだけ: `NOVIRA_TEST_WIKIPEDIA_JA_BASE` と `NOVIRA_TEST_WIKIPEDIA_EN_BASE` でループバックの偽サーバーを指せる。 |

## 既知の限界

- 事実調べはモデルのクエリを、HTTPS で Wikipedia に送る（通信は HTTPS）。Wikipedia は PC のアドレスと語を見られる。クエリは送る前に利用者へ表示するが、ツールの指示にかかわらず、モデルが私的な語を入れることはありうる。利用者は断れる。常に許可する利用者はそれを受け入れたことになる。結果は誰でも書ける Wikipedia のテキストで、モデルにとってはデータであり指示ではなく、誤りや誤解を招く内容を含みうる。
