---
covers:
  - .github/workflows/release.yml
  - scripts/release/package.bat
  - scripts/tools/package-release.mjs
  - scripts/tools/changelog.mjs
---
# リリースのワークフロー

一覧に戻る: [README.md](README.md)

リリースは `develop` から `main` への PR（検査が通ってから squash マージ）で `main` に入り、その `main` のコミットにバージョンタグを push する。バージョンタグを push すると、GitHub が Windows 向けのリリースをビルドし、タグ名を題名、`CHANGELOG.md` のそのタグの節をノートとするドラフトのリリースを残す。実行が成功したら、`/release-notes` のエージェントが公開する（ユーザーが頼んだリリースの準備から公開まで、[../../../development.md](../../../development.md) の「ブランチと PR」）。同じビルドは `scripts\release\package.bat` から手でも動く。ワークフローは、このスクリプトをまっさらなマシンで動かすもの。

## 動作

- **トリガー。** GitHub に `v*` のタグを push したときだけ（手動実行もブランチの push もなし）。
- **ビルドジョブ**（`windows-latest`、最大 90 分）。順に次を行う。
  1. `package-release.mjs --check-tag <tag>` は、タグが `v` に `backend/Cargo.toml` の `[workspace.package]` のバージョンをそのまま付けたもの（`0.4.0` なら `v0.4.0`）でなければ実行を止める。バージョンは `scripts\release\set-version.bat` で設定し、タグを付ける前にコミットする。続いて `changelog.mjs --notes <tag>` は、`CHANGELOG.md` にそのバージョンの空でない節がなければ止める（`/release-notes` がタグ付けの前に書く）。節はビルド成果物 `release-notes` としてアップロードする。
  2. `npm ci` と Playwright の Chromium（スモークテストが使う）。npm のキャッシュと、cargo のレジストリおよび `backend/target` のキャッシュは、`Cargo.lock` とツールチェーンのファイルをキーにする。
  3. `scripts\release\package.bat build`: フロントエンドと、アプリとサーバーをリリースモードで `artifacts\` にビルドする。
  4. ビルドしたものに `scripts/tools/release-smoke.mjs` を実行する: 空のフォルダと各旧データのフィクスチャでサーバーを、エンジンなしで `novira.exe` を動かす（[development.md](../../../development.md)）。GPU は使わない。ランナー上でだけ、`novira.exe` は `scripts/tools/start-medium.ps1` が通常ユーザーのトークン（administrators グループは deny-only、Medium 整合性）で起動する。スクリプトが作業フォルダに書く `.cmd` から、変数を設定し、トークンのグループを記録する。デスクトップ上では直接起動する。
  5. `package-release.mjs`: `novira-<version>-windows-x64.zip` とその `.sha256` を、同名のビルド成果物（`novira-<version>-windows-x64`）としてアップロードする。ドラフトジョブがこれをダウンロードする。
- **ドラフトジョブ**（`ubuntu-latest`）: zip とチェックサムを付けて `gh release create <tag> --draft --verify-tag --title <tag>` を実行し、ダウンロードした `release-notes` を本文にする。タグにハイフンがあれば（`v0.5.0-beta.1`）プレリリースにする。下書きを公開するのは `/release-notes`（エージェントがワークフローの成功を確かめてから `gh release edit --draft=false`）。リリースが既にあるタグの再実行は、ファイルを置き換えるだけ（`--clobber`）で、題名、本文、状態は変えない。
- `package.bat` は `CI` が設定されているとき、キー入力を待たない（ランナーには押す人がいない）。

## 境界

| 境界 | ガード |
|---|---|
| タグ名（外部からの入力） | 環境変数（`TAG`）経由でだけスクリプトに届き、スクリプトの文面に貼り込まない。`v` に `Cargo.toml` のバージョンを付けたものと等しくなければビルドは止まる |
| トークン | ワークフローは `contents: read`。`contents: write` を持つのはドラフトジョブだけで、リポジトリのコードは動かさず、ダウンロードした成果物（zip、そのチェックサム、ノートのファイル）に `gh` を使うだけ。ほかのシークレットは使わない |
| アクション | GitHub 自身のもの（`actions/*`）だけをメジャーバージョンで指定する。サードパーティのアクションはビルドで動かない |
| 公開されるもの | ドラフト。ワークフローは公開しない。公開は、実行の成功を確かめた `/release-notes` だけがする |

## 既知の限界

- ランナー上のジョブは昇格しており、WebView2 は昇格したアプリに `--remote-debugging-port` を与えなかった。`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` でもポリシーキーでも同じだった（`WEBVIEW2_USER_DATA_FOLDER` は取られた）。このためスモークテストはウィンドウに届かなかった。administrators グループを deny-only にして High 整合性で起動しても同じだった（`runas /trustlevel:0x20000`）。Medium 整合性での起動は開く（run 41378550015）。WebView2 が High 整合性でこのフラグを無視する理由は、Microsoft が文書化していない。
- アクションはコミットではなくメジャーバージョンで固定しているので、`actions/*` のアクションのタグが動かされてもそれを信頼する。
- ビルドはコード署名されていない。zip の SHA-256 が唯一の完全性の印。

## 未実装

- リリースは `test` ワークフローを待たない。タグは、リリース PR のマージコミットに打つ（そのコミットは PR の検査を通ったもの。`/release-notes`）。`test` ワークフローがまだ走らせないテストは手作業のままで（`scripts\check.bat`、`scripts\checks\full-check.bat`）、ライブテスト、ミューテーションの実行、実アプリも同じ。
