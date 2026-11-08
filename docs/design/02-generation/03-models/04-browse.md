---
covers:
  - backend/crates/novira-core/src/models/civitai.rs
  - backend/crates/novira-core/src/models/civitai/**
  - backend/crates/novira-core/src/models/huggingface.rs
  - backend/crates/novira-core/src/models/content_filter.rs
  - backend/crates/novira-core/src/service/browse.rs
  - frontend/src/features/browse/**
---
# Browse: Civitai と Hugging Face の検索

一覧に戻る: [README.md](README.md)

Browse タブは Civitai と Hugging Face でモデルを検索し、そのページを開く。何をインストールするか、ファイルをどこへ置くか、キーをどこに保持するかは [01-models.md](01-models.md)。このページは検索と、それが開くページを扱う。

## 動作

- **Civitai の検索。** `source: civitai` は、種類に応じた型、ベースモデル、ライセンスのフィルタ、並び順、期間、カーソルで `GET /api/v1/models` を呼ぶ（`models/civitai.rs`）。カバーは Civitai の画像アドレス。動画は最初のフレーム（`anim=false`）で表示し、そのバージョンに画像がないときだけ使う。カードはポインタが乗っている間ミュートで再生し、詳細ビューには動画自身のコントロールがある（`features/browse/Cover.tsx`。そのために `media-src` が `https://*.civitai.com` を許す）。通常レベルを超える画像は、成人向けコンテンツがオンでなければ除く。ベースのフィルタは全ベース（`all`、ベースは送らない）で始まる。リストは、SDXL ファミリー（`sdxl-compat`）、Civitai の名前で送る単一のベース（`Illustrious`、`NoobAI`、`SDXL 1.0`、`Pony`、`SD 1.5`、`Anima`）、Flux の各派生を表す `FLUX.1`（`FLUX_BASES`: Civitai に `FLUX.1` という名前のベースはなく、`Flux.1 D`・`Flux.1 S`・`Flux.1 Krea`・`Flux.1 Kontext`・`Flux.2 D` と Klein 系を挙げるので、まとめて要求する）、`all`（`features/browse/BrowseBar.tsx`）。説明はプレーンテキストにする。カバーのアドレスがないモデルは空の枠を出す（成人向けコンテンツがオフの間は、Civitai が通常を超える評価の画像をすべて省くので、その旨の注記つき）。画像を代わりに立てるのはブラウザのモックだけ。
- **タブを開き直したとき。** 5 分以内に見た最初のページはそのまま表示し、新しいリクエストはしない（その次のページへのリクエストもしない）。それより古いものは、すぐ表示して再検索する。再試行は常に問い合わせる。ページは次の起動のためにディスクにも保持する。
- **Hugging Face の検索。** `source: huggingface` は、タグのフィルタ（`lora`、`controlnet`、`text-to-image`、ベースモデルのタグ）、ハブの並び順、`Link` カーソルで `GET /api/models` を呼ぶ（`models/huggingface.rs`）。リポジトリは 1 つのバージョン `main` に対応し、その単一のモデルファイルを持つ。diffusers のコンポーネントフォルダは飛ばす。モデルファイルのないリポジトリは捨てる。絞り込みの結果が 12 件に満たなければ、最大 4 ページまで読む。
- **アダルトコンテンツ。** Browse バーのスイッチ（`includeNsfw`、既定でオフ）はすべての検索に付く。Civitai は `nsfw` パラメータで適用する。Hugging Face にはレーティングがないので、`models/content_filter.rs`（`looks_adult`）が、`not-for-all-audiences` タグ、名前・タグ・モデルカードのテキスト・サンプルプロンプト（ネガティブプロンプトは除く）にあるアダルトの語、またはオーナーが `UNRATED_MIRRORS` にあることでリポジトリに印を付ける。プライベートのリポジトリは常に捨て、スイッチがオフの間は印付きのものも捨てる。Hugging Face のカバーは、スイッチがオンになるまでぼかしたまま（`features/browse/Cover.tsx`）。
- **ライセンスタグ。** 各モデルは 6 つの許可を持つ（`civitai::PERMISSION_KEYS`: Civitai では `allowCommercialUse`・`allowDerivatives`・`allowDifferentLicense`・`allowNoCredit` から、Hugging Face ではライセンスタグから）。そして `civitai::commercial_of` が最初の 3 つ（画像を売る、生成サービス、モデルを売る）から作る要約を持つ。3 つすべてが許されていれば `allowed`、どれも許されていなければ `denied`、それ以外は `limited` で、タグが一覧より多くを語ることはない。Civitai の `RentCivit`（自社サービスのみ）は生成サービスなしと数える。インストール済みのモデルは付与されたライセンスを保持する。起動時に `registry::corrected_license_summaries` が、旧版が違う方法で作った保存済みの要約を、その許可に合わせて直す。
- **ページを開く。** `open_civitai_page` は 12 桁までのモデル id を取り、`https://civitai.com/models/<id>` を開く。`open_huggingface_page` は平易な `owner/repo` を取り、`https://huggingface.co/<repo>` を開く。`open_source_page` は、`SOURCE_SITES`（`backend/crates/novira-core/src/models/install.rs`: モデルサイト、コードホスト、2 つのダウンロードサイト、またはそのサブドメイン）にあるホストの、ユーザー名のない `https` アドレスを 500 文字まで開く。拡張機能のソースリンクと、このアプリについてダイアログのオープンソース一覧のホームページもこれを使う（[02-extensions.md](../../01-app/03-engine/02-extensions.md) と [01-settings-engine.md](../../01-app/03-engine/01-settings-engine.md) を参照）。ブラウザは Windows では `rundll32.exe url.dll,FileProtocolHandler <url>`（`api::browser_command`）、ほかでは `xdg-open` で起動し、シェルは通さない。
- **Civitai の分割。** `backend/crates/novira-core/src/models/civitai.rs` では、`newest` 以外の並び順で複数のベースモデルを指定すると、ベースごとに 1 リクエストを同時に送り、それぞれがページの等分を受け持つ。`sdxl-compat` は `SDXL_COMPATIBLE`。応答は重複する id を除いて統合し、評価かダウンロード数で並べ、その後でライセンスと safetensors のフィルタをかける。次のカーソルは `multi:` とベースからカーソルへの JSON マップで、次のページのないベースは外れ、失敗したベースは、すべてが失敗しない限り飛ばす。
- **サンプル設定。** Civitai モデルの詳細ビューは、設定を共有しているサンプル画像を一覧する（`civitai_samples`: 表示中のバージョンについて `GET /api/v1/images?modelVersionId=..&withMeta=true&type=image&sort=Most Reactions`、最大 24 件。`models/civitai/samples.rs`、`features/browse/SamplesSection.tsx`）。Civitai が設定を返すのは `withMeta` のおかげで、検索の応答には `hasMeta` しかない。Civitai は `meta` を自由形式にしており、投稿者が省くこともあるので、フィールドはすべて任意、プロンプトのない画像は捨て、数値は範囲を検査し、モデルと LoRA は `civitaiResources`（バージョン id）、なければ `resources`（名前）、なければ `Model` フィールド（AIR アドレスか名前）から取る。通常を超える評価の画像は、成人向けコンテンツのスイッチがあるときだけ来る（`nsfw=true` の 2 回目のリクエスト）。**この設定を使う**（`features/browse/applySample.ts`）は、プロンプト、ネガティブプロンプト、シード（固定）、ステップ数、CFG、サイズ、clip skip、スケジューラーを生成フォームに入れて生成を開く。画像が記録していない設定はそのまま残す。Civitai は A1111 の clip skip（1 はなし）を書くが、フォームはスキップしたレイヤー数を数えるので、1 つ小さくなる。サンプラー名がスケジューラーに対応するのは同じものを動かすときだけ（`schedulerOf`: `DPM++ 2M Karras` は `dpmpp_2m_k`）で、そうでなければ現在のものが残り、通知がそれを名指す。チェックポイントと LoRA が入るのはインストール済みのときだけで、そのページが示す Civitai バージョン（`pageUrl`）で、なければ名前で見つける。ないものは一覧に印を付けて通知で名指しし、LoRA を使った画像は、フォームの LoRA を、その中のインストール済みのものに置き換える（インストール済みがなければ、なし）。

## 境界

| 境界 | ガード |
|---|---|
| ページを開く | `open_civitai_page` は数値の id、`open_huggingface_page` は平易な文字の `owner/repo`、`open_source_page` はホストが `SOURCE_SITES` にある（またはそのサブドメインの）`https` アドレスを取る（拡張機能マネージャーのソースリンク、このアプリについてダイアログのホームページ）。同梱のオープンソース一覧のホームページがすべてその一覧にあることをテストが保つ。ブラウザはアドレスを 1 つの引数として起動し、シェルは通さない。 |

- **有料バージョン。** Civitai のバージョンは `paidAccess`（`permanent`、または早期アクセスの `endsAt`）を持つ。それらでも `availability` は `Public` のままなので、判断材料にならない。`CivitaiVersion.paid` と `paid_until`（エポック ms。恒久的に有料のバージョンはなし）がこれを保持し、`is_paid_at(now)` がまだ支払いを求めるかを返すので、終わった早期アクセスは再び無料になる。`price` フィルタ（`free`、`paid`。`civitai.rs` の `keep`）は最新バージョンを見る。カードはバッジ（「有料」、または「有料 〜{date}」）を出し、詳細は早期アクセスの終わりを示し、ダウンロードボタンは有料のバージョンではすべてロックされる。API キーでは購入者とそれ以外を区別できないので、アプリは試みない（`features/browse/paid.ts`、`DownloadButton.tsx`）。Hugging Face にはない。

## 既知の限界

- Hugging Face と Civitai のコンテンツフィルタは最善努力（アダルトコンテンツを参照）。
- サンプル設定は投稿者が書いたもの。設定を記録しないツールで作った画像や、投稿者が隠した画像には設定がなく、記録された値が間違っていたり、別のツールの設定の考え方に従っていたりすることがある（このアプリにスケジューラーがないサンプラー、別のファイルに一致する名前の LoRA）。画像が使った embedding と VAE は適用しない。
