---
covers:
  - .github/dependabot.yml
  - .github/workflows/dependabot-triage.yml
  - scripts/tools/dependabot-triage.mjs
---
# Dependabot: 依存の更新

一覧に戻る: [README.md](README.md)

## 動作

依存の更新は、脆弱性の通知と更新の PR を Dependabot に任せ、その PR の判断を `.github/workflows/dependabot-triage.yml` に任せる。

- **脆弱性の通知と security updates。** リポジトリの設定で有効にする（ファイルは持たない）。既知の脆弱性がある依存を直す PR が自動で出る。見つけるのは `Audit`、直す PR を作るのが Dependabot。
- **version updates。** `.github/dependabot.yml`。cargo（`/backend`）と npm（`/frontend`）は毎週月曜 04:00 JST に確かめ、minor と patch は 1 つの PR（`minor-and-patch` グループ）にまとめる。major は 1 件ずつ別の PR。GitHub Actions（`/`）は毎月、すべての更新を 1 つの PR（`github-actions` グループ）にまとめ、同時に開くのは 1 件まで。コミットの接頭辞は `chore`。PR の向き先は既定ブランチ（main）。作業ブランチは main から短く切るので、main に入った更新は次のブランチから届き、PR の検査は「ブランチ + 今の main」で走る（[../../../development.md](../../../development.md) の「ブランチと PR」）。
- **cooldown（7 日）。** 新しい版は、公開から 7 日たつまで PR にしない。すぐ取り下げられる版（壊れた版や悪意のある版）が PR にならず、PR の数も減る。security updates は待たない。
- **判断（`Dependabot triage`、`scripts/tools/dependabot-triage.mjs`）。** 4 時間ごと（と手動。手動は既定で `--dry`）に、開いている Dependabot の PR を 1 件ずつ見る。判断はタイトル、ラベル、経過日数、検査の状態だけで決まる関数で、`gh` を呼ぶのは `run` だけ。
  - 検査の状態は、head のコミットに対する `Test` と `Supply chain`（と、走っていれば `Audit`）の実行から決める。必須の 2 つが成功なら成功、どれかが失敗なら失敗、実行中なら保留、実行がなければ `none`。`cancelled`（新しい push に置き換えられた実行）は数えない。
  - minor と patch（と `minor-and-patch` グループ）で検査がすべて成功なら、squash でマージしてブランチを消す。
  - major は、検査に関わらず理由を書いて閉じる。人が変更を読むもので、Dependabot は次の major を別に出す。0.x の minor は major として扱う。
  - 検査が通らないまま 21 日開いている小さな更新は、閉じる（次の版で新しい PR が出る）。
  - `security` ラベルの PR は、規則では閉じない。小さくて検査が成功したものだけマージし、残りは人を待つ。
  - タイトルから版が読めない PR は、何もしない。毎月の `github-actions` グループもここに入る（major を含みうるので、人が読む）。
- **検査。** 更新の PR は、ほかの PR と同じく `Test`・`Supply chain`・`Audit` を PR として 1 回ずつ走らせる（[02-ci.md](02-ci.md)）。ブランチへの push では走らないので、Dependabot が一度に多くの PR を作っても、push の分の検査は重ならない。

## 境界

| 境界 | ガード |
|---|---|
| トークン | `Dependabot triage` だけが `contents: write` と `pull-requests: write` を持つ（PR のマージと閉じるため）。シークレットは使わない。スケジュール実行は既定ブランチのコードをリポジトリ自身のトークンで動かし、PR の中身を取り出して動かすことはない |

## 既知の限界

- 自動マージの安全は、`Test`・`Supply chain`・`Audit` に頼る。悪意のある更新はテストでは見つからず、検査を通った minor と patch はそのまま main に入る。許容の根拠は、major は人が読むこと、lock ファイルで固定されること、`cargo deny` が新しいライセンス・レジストリ・git 依存を止めること。
- リポジトリ自身のトークンで起こした push は、別のワークフローを起動しない。自動マージで main が動いても `Test` は走らない。
- 設定ファイルが既定ブランチに初めて入ったときや、設定を変えたときは、予定を待たずにすぐ 1 回走る。古い依存がまとめて PR になる（2026-11-11 には 17 件）。
- PR は作った時点の main の上にある。main が進むと、Dependabot は開いている PR を載せ直し（rebase）、その PR の検査がもう一度走る。
