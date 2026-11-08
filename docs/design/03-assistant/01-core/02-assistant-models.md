---
covers:
  - backend/crates/novira-core/src/agent/models.rs
  - frontend/src/features/agent/AgentModelPicker.tsx
---
# アシスタントのモデル

一覧に戻る: [README.md](README.md)

コマンドラインツール（`claude`、`codex`）がリクエストを実行するモデルと思考の強さ。チャットのタイトル横のボタンで選ぶ。サーバーのモデルは保存した設定の一部。アシスタント全体は [01-assistant.md](01-assistant.md)。

## 動作

- Claude: 完全名の固定リスト（`backend/crates/novira-core/src/agent/models.rs` の `CLAUDE_MODELS`）。`claude-fable-5-1`（Fable 5.1）、`claude-opus-5-5`（Opus 5.5）、`claude-sonnet-5-5`（Sonnet 5.5）、`claude-haiku-5-5`（Haiku 5.5）の 4 つで、バージョン付きで表示し、`--model <完全名>` で渡す。`sonnet` のような別名は使わないので、表示した名前がそのまま答えるバージョンになる。強さは low から max までで、high から始まる。
- Codex: アカウントについて `models_cache.json`（ホームフォルダー内）が列挙するモデル（非表示のものは除く）を優先順に並べ、それぞれが列挙する強さを付ける。
- 既定: `AgentStatus.defaultModel` は、利用者が選ぶまでリクエストが動くモデル。Claude は `claude-sonnet-5-5`（何も指定しないとき CLI が取るもの）、Codex は一覧の最初のモデル。コマンドラインツールの選択には「既定」も入力した名前もなく、答えるモデルを必ず名指しして押す（`frontend/src/state/agent.ts` の `effectiveModel`）。一覧のない Codex だけが自身の既定で動き、既定として表示する。
- リクエストはモデル（`agentModel`）を運ぶ。バックエンドはツールが列挙しているときだけ受け取り、そうでなければ既定にする（`backend/crates/novira-core/src/agent/mod.rs` の `cli_model`）。古い別名（`opus`）で保存された選択は、ウィンドウがその名前を含む一覧上のモデルとして読む（`effectiveModel`）。
- モデルが取らない強さは捨て、選択はそのモデル自身の開始時の強さに戻る。ツールごとの選択はウィンドウに保持し（`novira.agent`）、次のメッセージから送る。

## 境界

| 境界 | 防ぎ方 |
|---|---|
| モデルの引数 | CLI 実行で固定の語でない唯一の引数。ツールが列挙し、名前が英数字と `.-_` だけ（64 文字以下、`-` で始まらない）のモデルだけを渡す。それ以外の名前は既定のモデルで動く。モデルについて環境変数には何も入れない。 |

## 既知の限界

- Claude の一覧はアプリに固定されている。新しい Claude モデルは `CLAUDE_MODELS` の更新後にだけ選べ、既定は CLI から読まない。
