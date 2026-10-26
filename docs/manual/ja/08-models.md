# モデルを管理する・探す

画像を作るには、絵のもとになる「モデル」が必要です。novira には、手元のモデルを整理する **{{ui:app.tabs.models}}** タブと、インターネットでモデルを探してダウンロードする **{{ui:app.tabs.browse}}** タブがあります。

この章では、2 つのタブの使い方と、モデルの種類、ライセンスの見方を説明します。

## モデルの種類

モデルには「{{ui:models.sort.base}}」（どの系統か）と「{{ui:models.sort.type}}」（どんな役目か）があります。

### ベース（系統）

モデルは系統ごとに作られていて、違う系統のものは組み合わせられません。たとえば SDXL のモデルに、SD1.5 用の LoRA は使えません。

| 表示 | 内容 |
|---|---|
| SD1.X | Stable Diffusion 1.5 など。軽く動きます |
| SD2.X | Stable Diffusion 2 系 |
| SDXL | Stable Diffusion XL 系。多くのイラスト向けモデル（Illustrious、NoobAI、Pony など）もここに入ります |
| SD3.X | Stable Diffusion 3 系 |
| FLUX | FLUX 系 |
| Any | 系統を選ばないもの（アップスケーラーなど） |

> SD1.X・SD2.X・SDXL のほかに、新しい系統（Anima・Flux・FLUX.2・Chroma・Qwen-Image・Z-Image・SD3・HiDream・AuraFlow・HunyuanImage・Hunyuan-DiT）のモデルで画像を作れ、Wan・HunyuanVideo・LTX-Video のモデルでは動画画面で動画を作れます。それ以外の系統のモデルは一覧には出ますが、生成すると失敗して系統名が表示されます。扱い方は「生成」の章にあります。

モデルと LoRA のベースが合わないと、**{{ui:app.tabs.generate}}** 画面の作成ボタンが押せなくなり、理由が出ます。

### 種類

| 種類 | 役目 |
|---|---|
| {{ui:models.rail.main}}（{{ui:models.type.main}}） | 絵を描く本体 |
| {{ui:models.type.lora}} | 本体に足して、画風やキャラクターを加える小さなモデル |
| {{ui:models.type.vae}} | 絵の色や細部の仕上げに使う部品 |
| {{ui:models.type.controlnet}}、{{ui:models.type.modelPatch}} | ポーズや線画など、絵の形を指定する（モデルパッチは Anima・Qwen-Image・Z-Image 用） |
| {{ui:models.type.ipAdapter}}、{{ui:models.type.clipVision}} | 参照画像の雰囲気を生成に反映する |
| {{ui:models.rail.upscale}} | 画像を大きくする |
| {{ui:models.rail.encoders}} | 文章を理解する部品（T5、Qwen、CLIP など。Anima や Flux のように、本体とは別に必要なもの） |
| {{ui:models.rail.diffusion}} | Flux・Wan・Anima・Qwen-Image など、本体だけ単独で配られているモデル。インストールするときは中身を見て種類と系統を判別します |

動画・音楽・音声・ロゴ用のモデルは、この一覧には出ません。それぞれの画面からダウンロードします（[動画・音楽・音声・ロゴ](07-media.md)）。

## モデルタブ

![モデルタブ。左にカテゴリ、真ん中にモデルのカードが並ぶ](shot:models)

**{{ui:app.tabs.models}}** タブは、インストールされているモデルの一覧です。

### 見つける

左の **{{ui:models.rail.title}}** で、種類ごとに絞り込めます。右に件数が出ます。

- **{{ui:models.rail.all}}**：すべて
- **{{ui:models.rail.favorites}}**：星を付けたもの
- **{{ui:models.rail.main}}**・**{{ui:models.rail.lora}}**・**{{ui:models.rail.controlnet}}**・**{{ui:models.rail.vae}}**・**{{ui:models.rail.ipAdapter}}**・**{{ui:models.rail.upscale}}**・**{{ui:models.rail.encoders}}**・**{{ui:models.rail.diffusion}}**

上のバーでは、名前で絞り込み（**{{ui:models.searchPlaceholder}}**）、ベースで絞り込み、**{{ui:models.sort.label}}**（{{ui:models.sort.name}}・{{ui:models.sort.size}}・{{ui:models.sort.base}}・{{ui:models.sort.type}}）、**{{ui:models.view.grid}}** と **{{ui:models.view.list}}** の切り替え、サムネイルの大きさの調整ができます。

カードの左下には、ベース（SDXL など）と形式の札が付きます。ライセンスが分かっているモデルには、左上にライセンスの札（[ライセンスの札](#ライセンスの札)）も付き、押すとカードを選ばずにその場でライセンスの内容が開きます。カードが小さいときは、札は印だけになります。カードにマウスを重ねると、星（お気に入り）とメニューが出ます。

画面の右下には、モデルの数と合計の大きさが出ます。

### モデルを足す

右上に 2 つのボタンがあります。

- **{{ui:models.find}}**：**{{ui:app.tabs.browse}}** タブに移ります（下の章を参照）。
- **{{ui:models.import}}**：手元のファイルや、アドレスのわかっているモデルをインストールします。

**{{ui:models.import}}** を押すと、**{{ui:models.import.title}}** の画面が開き、4 つの方法から選べます。

| タブ | 使い方 |
|---|---|
| {{ui:models.install.tab.source}} | モデルのアドレスを入力して **{{ui:models.install.install}}** を押します |
| {{ui:models.install.tab.scan}} | **{{ui:models.install.scan}}** を押して開くダイアログでフォルダを選ぶと、中のモデルが並びます。**{{ui:models.install.installAll}}** でまとめてインストールできます。パソコン内のファイルはここからインストールします。ブラウザで開いているときは使えません |
| {{ui:models.install.tab.starter}} | 最初にインストールしておくと便利なモデルを、アプリが選んで並べています。依存するモデル（VAE など）も一緒に入ります |
| {{ui:models.install.tab.huggingface}} | Hugging Face のリポジトリ名（`作者/名前`）で探す欄です |

**{{ui:models.install.tab.source}}** の欄に入力できるのは、次のものです。

- Civitai のモデルのページのアドレス
- モデルファイルへの直接のアドレス（`https://` で始まるもの）
- Hugging Face のファイル（`作者/名前::ファイル名` の形）

パソコン内のファイルの場所（`C:\models\model.safetensors` のような形）を入力すると、**{{ui:models.install.tab.scan}}** を使うよう表示されます。そこで選んだファイルは、アプリのモデルフォルダに取り込まれます（同じドライブなら、容量はほとんど増えません。別のドライブのときはコピーされます）。

> **{{ui:models.install.tab.huggingface}}** タブは、リポジトリ（`作者/名前`）を入れて **{{ui:models.install.hfLookup}}** を押すと、そのリポジトリの単体のモデルファイル（`.safetensors`、`.gguf`、`.ckpt`、`.pt`、`.pth`）の一覧を出します。`unet` や `vae` などの部品フォルダの中のファイルは出ません。Hugging Face のトークンを登録してあれば、そのトークンを使って一覧を取ります。

インストールは順番に進みます。進み具合は、画面の左下の **{{ui:models.dock.queue}}**（作業中は「○ 件インストール中」）を押すと出る **{{ui:models.queue.title}}** で見られます。ここで、1 件ずつ **{{ui:models.queue.cancel}}** もでき、終わった分は **{{ui:models.queue.prune}}** で片付けられます。

ダウンロードの途中のファイルは、完了してからモデルフォルダに入ります。途中で止めても、中途半端なファイルは残りません。

### モデルの詳細

![モデルを選ぶと右に詳細が出る。サイズ・場所・ライセンス・ソースなどが並ぶ](shot:models-detail)

カードを押すと、右に詳細が開きます。閉じるときは右上の **{{ui:models.detail.close}}** を押します。

詳細には、名前、ベースと種類の札、説明、**{{ui:models.details.size}}**、**{{ui:models.details.path}}**（コピーできます）、**{{ui:models.details.license}}**、**{{ui:models.details.source}}**、**{{ui:models.details.page}}**（元のモデルのアドレス。押すとブラウザで開きます）が出ます。

モデルの絵が複数あるときは、絵の左右の矢印で切り替えられ、右下に何枚目かが出ます（Civitai から入れたモデルは、元のページの絵が入ります）。

上のボタンでは、次のことができます。

- **{{ui:models.detail.openSource}}**：元のモデルのページをブラウザで開きます（ページが分かるモデルだけ）。
- **{{ui:common.edit}}**：名前・説明・ベース・種類を直します。ベースや種類が自動で正しく判定されなかったときに使います。
- **{{ui:common.delete}}**：モデルを削除します（下を参照）。

### トリガーフレーズ

LoRA などには、使うときにプロンプトへ入れると効く言葉（トリガーフレーズ）があります。**{{ui:models.triggers.title}}** に登録しておくと、**{{ui:app.tabs.generate}}** 画面でその LoRA を選んだときに、言葉がボタンとして出ます。押すと、プロンプトに足されます。

入力欄に言葉を入れて **{{ui:common.add}}** を押すと登録されます。×で外せます。変更はすぐに保存されます。Civitai からインストールしたモデルは、配布元が示している言葉が最初から入っていることがあります。

### 既定の設定

本体のモデルには、**{{ui:models.defaults.title}}** があります。そのモデルを生成画面で選んだときに、自動で入る値です。

- **{{ui:models.defaults.scheduler}}**
- **{{ui:models.defaults.steps}}**
- **{{ui:models.defaults.cfgScale}}**
- 幅と高さ

そのほかに **{{ui:models.defaults.vae}}** と **{{ui:models.defaults.vaePrecision}}** も保存できます。項目ごとのスイッチをオンにしたものだけが保存されます。**{{ui:common.save}}** を押して確定します。

モデルごとに「おすすめの値」が違うので、よく使うモデルは一度設定しておくと、毎回直さずに済みます。

### 削除

**{{ui:common.delete}}** を押すと確認が出ます。**{{ui:models.deleteWarning}}**

ただし、novira がインストールしたモデル（アプリのデータフォルダの中のもの）はファイルごと消えますが、自分で用意したフォルダにあるモデルは、一覧から外れるだけで、ファイルは残ります。

## ライセンスの札

モデルには、配布元が決めた利用条件（ライセンス）があります。novira は、その要点を札で示します。

| 札 | 意味 |
|---|---|
| {{ui:browse.commercial.allowed}} | 生成画像の販売、生成サービスでの利用、モデル自体の販売がすべて許可されています |
| {{ui:browse.commercial.limited}} | 商用の使い方の一部だけが許可されています（記載のないものがあるときも、この札です） |
| {{ui:browse.commercial.denied}} | 生成画像の販売、生成サービスでの利用、モデル自体の販売のどれも許可されていません |

札を押すと、**{{ui:browse.permission.title}}**が一覧で出ます。たとえば「{{ui:browse.permission.sellImages}}」「{{ui:browse.permission.sellModel}}」「{{ui:browse.permission.shareMerges}}」などについて、可・不可・記載なしが分かります。

札は、Civitai では作者が設定した利用許可から、Hugging Face ではライセンスの表示から決めています。サイトの表示を基にした目安で、最終的には配布元のライセンス本文を確認してください。**{{ui:browse.permission.disclaimer}}**

インストールしたモデルのライセンスが分からないときは、**{{ui:models.details.licenseUnknown}}** と出ます。

> 非商用のライセンスのモデルもあります。たとえば、動画の **{{ui:video.model.fast}}** は非商用ライセンスです。作った画像や動画を仕事や販売に使うときは、使ったモデルのライセンスを必ず確かめてください。

## 探すタブ

![探すタブ。上に探す場所・種類・検索欄・絞り込み、下にモデルのカードが並ぶ](shot:browse)

**{{ui:app.tabs.browse}}** タブは、インターネット上のモデルを探して、そのままダウンロードする画面です。

### 探す場所

左上の切り替えで、探す場所を選びます。

- **{{ui:browse.source.civitai}}**：イラストや LoRA が多く集まっているサイトです。
- **{{ui:browse.source.huggingface}}**：研究機関や企業のモデルが多いサイトです。名前では探せないので、画面の真ん中の大きな欄に、モデルのページの URL（フォルダやファイルのページでもかまいません）か `作者/名前` を貼り付けて **{{ui:models.install.hfLookup}}** を押します。出たファイルにチェックを入れ、右上のインストールのボタンを押すと、ダウンロードが始まります。フォルダの URL を貼ったときは、まずそのフォルダの中のファイルだけが出ます。

そのとなりで、**{{ui:browse.kind.label}}** を選びます。**{{ui:browse.kind.lora}}**・**{{ui:browse.kind.checkpoint}}**・**{{ui:browse.kind.controlnet}}**・**{{ui:browse.kind.vae}}**・**{{ui:browse.kind.diffusion}}**・**{{ui:browse.kind.all}}** です。

### 絞り込み

検索欄には、モデル名・作者・タグを入れます。入れて少し待つと、結果が入れ替わります。

右側のメニューで絞り込めます。

| 項目 | 内容 |
|---|---|
| {{ui:browse.base.label}} | {{ui:browse.base.sdxlCompat}}、{{ui:browse.base.illustrious}}、{{ui:browse.base.noobai}}、{{ui:browse.base.sdxl}}、{{ui:browse.base.pony}}、{{ui:browse.base.sd15}}、{{ui:browse.base.flux}}、{{ui:browse.base.anima}} など |
| {{ui:browse.sort.label}} | {{ui:browse.sort.downloads}}、{{ui:browse.sort.rating}}、{{ui:browse.sort.newest}} |
| {{ui:browse.period.label}} | 全期間・1 年・1 か月・1 週間・24 時間（Civitai のときだけ）。有料の版には、カードに「{{ui:browse.paid.badge}}」と出ます。アーリーアクセス中のものは、無料になる日も出ます。有料の版は、購入済みでもアプリからは判別できないため、インストールできません（ボタンは押せません）。Civitai のページで入手してください |
| {{ui:browse.nsfw.label}} | 初期値はオフです。オンにすると、成人向けのモデルも出ます |
| **{{ui:browse.filter.button}}** | 押すと枠が開き、ライセンスで許可されていること（生成した画像の販売、生成サービスでの利用など。チェックしたものをすべて許すモデルだけが出ます）、チェックポイントの種類、料金（{{ui:browse.filter.free}}・{{ui:browse.filter.paid}}）、safetensors 形式のファイルがあるものだけ、作者（名前が完全に同じもの）で絞れます。いくつ絞っているかがボタンに出て、**{{ui:browse.filter.reset}}** で戻せます（Civitai のときだけ） |

下までスクロールすると、続きが読み込まれます。**{{ui:browse.status.loadMore}}** でも読み込めます。取得できなかったときは **{{ui:browse.status.retry}}** を押してください。

### カードの見方とダウンロードの仕方

カードには、見本の画像、モデルの名前、作者、ダウンロード数、いいね数、ライセンスの札が出ます。LoRA には、トリガーワードも出ます。

- **{{ui:browse.card.download}}**：そのモデルの代表のファイルをダウンロードします。
- 右のアイコン（**{{ui:browse.card.openCivitai}}**）：配布元のサイトをブラウザで開きます。

カードを押すと、右から詳細が開きます。バージョン、ファイルの一覧（大きさ・形式）、トリガーワード、タグ、説明、ライセンスが見られます。バージョンを選び、ダウンロードしたいファイルの **{{ui:browse.card.download}}** を押します。トリガーワードは、押すとコピーできます。外側を押すか `Esc` で閉じます。

ダウンロードを始めると、画面の左下に **{{ui:browse.dock.title}}** の小さな枠が出て、進み具合が見えます。**{{ui:browse.dock.cancel}}** でキャンセルでき、終わった分は **{{ui:browse.dock.clear}}** で消せます。ダウンロードが終わったカードは **{{ui:browse.card.installed}}** に変わり、**{{ui:app.tabs.models}}** タブの一覧にも加わります。

> ログインが必要なモデルをダウンロードするときは、**{{ui:settings.title}}** で Civitai の API キーを登録してください。Hugging Face で、アクセス申請が必要なモデルを使うときは、Hugging Face のトークンを登録します。どちらも暗号化してこのパソコンに保存され、画面には表示されません。くわしくは [エージェント・設定](09-assistant-settings.md) へ。

> ローカルのモデルの絵と使用許諾を Civitai から取るには、**{{ui:settings.title}}** の **{{ui:settings.tab.engine}}** にある **{{ui:settings.engine.civitai.label}}** をオンにします。モデルファイルのハッシュを Civitai に送るため、初期値はオフです。切り替えは次回の起動から反映されます。オフのまま絵のないモデルがあると、**{{ui:app.tabs.models}}** タブの上に注意書きが出て、**{{ui:models.coverHint.open}}** から設定を開けます。

画像の生成に進むときは [生成](02-generate.md) へ。

