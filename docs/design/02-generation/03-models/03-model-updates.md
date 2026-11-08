---
covers:
  - backend/crates/novira-core/src/models/civitai/updates.rs
  - backend/crates/novira-core/src/models/civitai/updates/**
  - frontend/src/state/modelUpdates.ts
---
# 新しいモデルバージョンの通知

一覧に戻る: [README.md](README.md)

Civitai 由来のインストール済みモデルに新しいバージョンがないかを調べ、利用者がモデルのページを開かなくても知れるようにする。モデルの置き場所とインストールは [01-models.md](01-models.md)、モデルを見つける検索は [04-browse.md](04-browse.md)。

## 動作

- **新バージョン。** ページが Civitai のバージョンを示すインストール済みモデル（`pageUrl`: `civitai.com/models/<id>?modelVersionId=<version>`）について、`check_model_updates` で問い合わせる。50 モデルにつき 1 リクエストで、`GET /api/v1/models?ids=..&nsfw=true`（アダルトのモデルは `nsfw=true` のときだけ返る。すでにインストール済みなので指定する。`models/civitai/updates.rs`）。それぞれを、**同じベースモデル**で、公開されていて、有料でなく、インストール済みより後に公開された最新バージョンと比べる。モデルのページには SDXL 版と Flux 版が並ぶことが多く、どちらももう一方の更新ではない。応答（`ModelUpdate`: 新しいバージョンの名前・日付・ページ）はブラウザストレージ（`state/modelUpdates.ts`、キー `novira.modelUpdates`）に保持し、カードのタグ、詳細の行（新しいバージョンのページを開くボタン `open_source_page` つき）、新バージョンごとに一度の通知として表示する。モデルマネージャーは、開くときに保持した応答が 1 日より古ければ問い合わせ、ツールバーのボタンはすぐ問い合わせる。自動の確認が失敗しても何も言わず、ボタンの失敗は知らせる。送り出すのは、インストール済みの Civitai モデルのモデル id（と、保存されていれば Civitai キー）で、宛先は検索と同じアドレス。何もダウンロードも変更もしない。利用者がそのページか Browse から新しいバージョンをインストールする。

## 既知の限界

- 新バージョンの通知が読むのは、バージョンを示す Civitai のページ（`pageUrl`）からインストールしたモデルだけ。手でフォルダに置いたモデルや、ページを保持する前にインストールしたモデルには `pageUrl` がない。Civitai が別のベースモデル名で挙げるバージョンや、無料でない早期アクセスは出さない。日付が最新のバージョンが選ばれるので、作者が後継と考えるものとは限らない（同じベースの軽量版やインペイント版など）。
