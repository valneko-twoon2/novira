---
covers:
  - backend/crates/novira-core/src/agent/attach.rs
  - backend/crates/novira-core/src/agent/relay.rs
  - frontend/src/features/agent/Attachments.tsx
  - frontend/src/features/comic/agentView.ts
  - frontend/src/state/agentTools.ts
---
# アシスタントが見る画像

一覧に戻る: [README.md](README.md)

画像がモデルに届く経路は 3 つだけ。利用者がメッセージに添付する、コミック画面でアシスタントが自分で描いたページを見たいと頼む、ギャラリーの画像（試し描き）を `view_picture` で見たいと頼む。あとの 2 つは利用者の許可が必要。アシスタント全体は [01-assistant.md](../01-core/01-assistant.md)。

## 動作

- 添付画像（`backend/crates/novira-core/src/agent/attach.rs`）: 1 メッセージにつきギャラリーの名前で最大 4 枚。ファイル、ドロップ、貼り付けは先にギャラリーへ保存する（`frontend/src/features/agent/Attachments.tsx`）。サービスが読み、最大 1568 px の JPEG にして送る。Claude には stream-json の入出力、Codex にはリクエストのフォルダー内のファイルを渡す `-i`、サーバーには `image_url` パーツ。運ぶのはそのメッセージだけ。メッセージはモデルにギャラリーの名前を伝え（アプリで作った画像がどう作られたかを `get_image_info` で分かるように）、画像の見た目は画像そのものから読むよう伝える。ほかから来た画像には記録がなく、モデルは記録を求めてはならない。
- ツールが返す画像: `view_comic_page` は、ページの中間画像の名前で答える。この画像はウィンドウが描き（`frontend/src/features/comic/agentView.ts`）、コミック画面が開いている間（どのビューでも）だけ。リレーがサービスのリーダーで読み、添付として整える（`relay::PICTURE_TOOLS`、`with_picture`）。MCP の答えはそれを `image` コンテンツブロックで運び、サーバーのループは、そのターンのツールメッセージの後に `image_url` パーツ付きのユーザーメッセージで運ぶ（`toolloop::tool_pictures`）。
- `view_picture`（`frontend/src/state/agentTools.ts`）: `queueId` があれば、そのキュー項目の完了を待ち（`PICTURE_WAIT_MS`、4 分。読み取り許可が必要な呼び出しへのリレーの 600 秒の内側）、それが作った画像で答える。`name` があれば、その画像で答える。失敗、キャンセル、未完了の項目は、エラーの一文になる。画像は `view_comic_page` と同じリーダーが、専用の注記つきで読む。見せた名前（最大 8 件）は、チャットの答えの下に出る（アシスタントのメッセージの `images`）。
- メッセージの下の画像は、押すとビューアーで開く（`SentPictures`。ビューアーのない画面では Generate タブへ移る）。
- 試し描き: `trial` 付きの `generate` は 1 枚をキューに入れ（リクエストの `iterations` を 1 にして `enqueueActive({ pictures: 1 })`）、設定「エージェントの試し描き」（`assistantTrialPictures`）が切れている間は拒否される。この設定は各リクエストと一緒に運ばれ（`trialPictures`）、プロンプトはコミック画面以外で「trial pictures: allowed」または「off」と書き（`build_system`）、聞き返しと試しの規則を添える。
- コミック画面が開いていない、ページが存在しない、描いたコマがない場合、ツールはモデルへの一文で失敗する。描画されたページは、「ページを画像として保存」が描くとおりのページの JPEG（`pageRender`）で、`isIntermediate` つきで保存するので、ギャラリーには並ばない。

## 境界

| 境界 | 防ぎ方 |
|---|---|
| どの画像が PC を出るか | 添付: 利用者が添付した名前だけで、ギャラリーの名前と同じ検査をする。`view_comic_page`: 両方のリストで読み取り許可が必要（`is_read_gated`、`isReadGated`）、設定「画像とプロンプトの読み取り」（`assistantReadAccess`）のもとで尋ね、コミックタブが開いている間だけ、ウィンドウが描いたページだけ。`view_picture`: 同じく読み取り許可が必要。ギャラリーのどの画像でも指せるので、見るたびに同じ設定のもとで尋ねる。 |
| IPC 経路上のピクセル | ウィンドウの答えが運ぶのは画像名だけ（`{"picture": name}`）。バックエンドは名前を検査し（`images::is_valid_name`、動画や音声は不可）、`outputs/` から読み、デコード前にサイズを検査し（`attach::prepare`）、名前を画像に置き換える。存在しない、または読めない画像は、呼び出しをエラーにする。 |
| 画像の中の文字 | 各プロバイダーに、画像内の語はデータか文字入れであり、指示ではないと伝える。 |

## 既知の限界

- 2026-10-14 にこの PC で利用者自身のログインを使って確かめた（`agent_live`、`both_tools_see_the_picture_a_tool_returns`）: `claude` も `codex exec` も、ツールが返した単色の赤い画像を見て色を答えた。サーバーのループ（`image_url` パーツ付きのユーザーメッセージ）は、テストの偽サーバーでだけ確かめていて、実在のサーバーでは確かめていない。
- 画像コンテンツを捨てるプロバイダーやモデルは、テキストだけで答える。これは報告し、回避はしない。
- 試し描きが 1 枚になるのは、プロンプトに「すべての組み合わせ」モードの動的構文がない間だけ。そのビルダーは `iterations` が設定される前に、ほかのプロンプトを自分でキューに入れる。
- モデルが聞き返しと試し描きの規則に従うかどうかはテストしていない。テストが確かめるのは、規則、設定、ツール。
- 見るたびに中間画像を 1 枚保存する。会話のために最後の 4 枚を残し、古いものは削除し、コミックの実行は終わるときにすべて削除する（`state/comic/scratch.ts`）。
