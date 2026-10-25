# アップスケールとワークフロー

この章では、絵を大きくする **{{ui:app.tabs.upscaling}}** と、処理を自分でつなげて作る **{{ui:app.tabs.workflows}}** タブを説明します。

## アップスケール

![アップスケール画面。中央に、絵のドロップ先と手順のカードが並ぶ](shot:upscaling)

**{{ui:app.tabs.upscaling}}** は、左のサイドバーの枠のアイコンで開きます（数字キーの 3 でも開きます）。絵を大きくしながら、細部を描き足します。単に引き伸ばすのではなく、まず拡大用のモデルで大きくし、そのあとプロンプトとタイル ControlNet を使って、細かいところを描き直します。

### 使うもの

次の 2 つのモデルを使います。インストールされていないときは、左パネルに注意が出ます。「{{ui:params.upscale.openModels}}」のボタンから、モデルの画面に移れます。インストールの仕方は [モデル](08-models.md) の章を見てください。

- {{ui:params.upscale.model}}（Real-ESRGAN など、絵を拡大するためのモデル）
- 選んでいるメインモデルに合う、{{ui:params.upscale.tileControlnet}}（合うものがあれば自動で選ばれます。Anima や Qwen-Image のように合うものがない系統では、タイル ControlNet なしで描き直します。このとき **{{ui:params.upscale.structure}}** は効かないので、形を保ちたいときは **{{ui:params.upscale.creativity}}** を下げます）

アップスケールモデルが 1 つもインストールされていないときは、左パネルに候補が並び、**{{ui:media.choice.recommended}}** の印が付いたものから選んで **{{ui:models.install.install}}** でインストールできます。

### 手順

1. 大きくしたい絵を、ギャラリーから、中央のカードか、左パネルの **{{ui:params.upscale.title}}** の枠にドラッグします。ギャラリーの絵を右クリック（ビューアではツールバー）して **{{ui:gallery.menu.upscale}}** を選ぶか、ビューアで絵を開いて `Shift+U` を押しても、タブが切り替わって絵が入ります。
2. **{{ui:params.upscale.model}}** を選びます。
3. **{{ui:params.upscale.scale}}** を、2x・4x・8x から選びます。「出力: 2048×2048」のように、できあがりの大きさが出ます。
4. 仕上がりを、次の 2 つのスライダーで調整します。
   - **{{ui:params.upscale.creativity}}**: 高いほど、元の絵から離れて、新しい細部を描き足します。
   - **{{ui:params.upscale.structure}}**: 高いほど、元の絵の形や配置を保ちます。
5. **{{ui:params.upscale.tileControlnet}}** を確かめます（合うものがあれば選ばれています）。必要なら、**{{ui:params.upscale.postProcessing}}**（描いた絵を、このモデルで仕上げてから、出力の大きさに合わせます）も選びます。
6. **{{ui:params.invoke.invoke}}** を押します。

できた絵は、ギャラリーに入ります。

- 出力の大きさは、1 辺が 8192 ピクセルまでです。それを超えると警告が出るので、倍率を下げてください。
- プロンプトは、描き足す細部に影響します。元の絵のプロンプトを入力しておくと、絵の方向が合いやすくなります。
- 拡大のあとの絵が元と違いすぎるときは、**{{ui:params.upscale.creativity}}** を下げ、**{{ui:params.upscale.structure}}** を上げます。

> 複数の絵を、1 度に拡大したいときは、ギャラリーで複数選んで、右クリックから **{{ui:gallery.menu.batch}}** を使います（[絵を直す・使い回す](04-improve.md)）。こちらは、拡大用のモデルだけで大きくします。

## ワークフロー

![ワークフロータブ。右が処理のつなぎを描く画面、左がフォーム](shot:workflows)

ワークフローは、「モデルを読み込む → プロンプトを入れる → 絵を作る → 保存する」といった処理の手順を、部品（ノード）をつなげて組み立てる機能です。普段の生成タブでは手が届かない、細かい手順や、いくつかの処理を組み合わせた流れを作れます。

最初は、**{{ui:workflows.panel.templates}}**（下の項）から、ひな形を開いて使うのがおすすめです。

画面は、次の 2 つでできています。

- 中央: **{{ui:app.views.editor}}**。ノードを並べて、線でつなぎます。
- 左パネル: **{{ui:workflows.panel.workflow}}**（フォーム）・**{{ui:workflows.panel.nodes}}**・**{{ui:workflows.panel.templates}}**・**{{ui:workflows.panel.packs}}**・**{{ui:workflows.panel.details}}**・**{{ui:workflows.panel.data}}** の 6 つのタブ。

ワークフローを動かすには、左パネルの上にある **{{ui:params.invoke.invoke}}** ボタンを押します。出力ノード（「{{ui:workflows.nodes.save_image.title}}」など）が無い、モデルが選ばれていない、といった問題があるときは、生成できない理由が表示されます。

つないだノードは、すべて実行に使われます。**{{ui:workflows.nodes.controlnet.title}}**、**{{ui:workflows.nodes.ip_adapter.title}}**、**{{ui:workflows.nodes.img_resize.title}}**、**{{ui:workflows.nodes.canny_edge_detection.title}}** なども、つないだとおりに働きます。**{{ui:workflows.nodes.ip_adapter.title}}** には、拡張機能とモデル（画像エンコーダー）が必要です。まだ実行できないのは、**{{ui:workflows.nodes.collect.title}}**・**{{ui:workflows.nodes.iterate.title}}**・**{{ui:workflows.nodes.range.title}}** と、ボックスぼかし、そして**{{ui:workflows.nodes.rand_int.title}}** をつないだ計算のノードです。使えない理由は、上の問題の表示に出ます。

### ノードを追加してつなぐ

左パネルの **{{ui:workflows.panel.nodes}}** タブには、足せるノードが ComfyUI と同じ分け方で並びます。**{{ui:workflows.nodeLibrary.section.core}}** と **{{ui:workflows.picker.extensions}}** の見出しの下に、種類ごとのフォルダ（モデル、画像、動画など）が ComfyUI と同じ順に並び、novira 独自の標準のノードも、同じ種類のフォルダに入っています。開くと中のフォルダとノードが出ます。**{{ui:workflows.picker.extensions}}** は、拡張機能の名前のフォルダの中に、その拡張のカテゴリが入ります。検索すると、合うノードが、どのフォルダにあるかと一緒に並びます。ノードをダブルクリック（または選んで `Enter`）するとキャンバスの中央に、キャンバスへドラッグするとその場所に、ノードが入ります。画面をふさぐ一覧を開かずに、続けて足せます。次の方法でも足せます。

1. キーボードの `Shift+A` か `Space` を押すと、ノードを選ぶ一覧が開きます。
2. 一覧から、ノードを選びます。上の検索欄に言葉を入れて、絞り込めます。左の分類で、標準のノードの種類や、ComfyUI 本体のノードの種類、インストールした拡張機能ごとに絞り込めます。
3. ノードの右側にある丸（出力）から、別のノードの左側の丸（入力）まで、ドラッグしてつなぎます。つなげるのは、同じ種類のものどうしだけです。

![ノードを追加するときの一覧](shot:workflows-add-node)

つなぐときの便利な機能があります。

- 線を、何もない所でドロップすると、そこにつなげられるノードだけが一覧に出ます。選ぶと、ノードを足して、そのままつながります。
- 線を、ノードの上でドロップすると、合う入力に自動でつながります。
- 選んだノードは、`Delete` で消えます。`Ctrl+C` と `Ctrl+V` で、ノードを複製できます。`Ctrl+Z` で元に戻し、`Ctrl+Shift+Z` でやり直します。
- ギャラリーの絵を、エディタにドラッグすると、その絵を入れる「{{ui:workflows.nodes.image.title}}」ノードが足されます。
- ノードの名前の左にある矢印で、ノードを折りたためます。名前をダブルクリックすると、名前を変えられます。

ノードの設定値は、ノードの中で直接入力します。つないだ入力の値は、つないだ先から来ます。

### 音楽や動画をワークフローで作る

左パネルの **{{ui:workflows.panel.nodes}}** タブと、ノードを追加する一覧の左には、**{{ui:workflows.picker.core}}** の分類があります。ComfyUI が最初から持っているノードが、種類（音声、動画、サンプリングなど）ごとに並び、音楽や動画をつくるノードもここにあります。標準のノードと自由に組み合わせられます。

- ひな形の **{{ui:workflows.templates.musicAceStep.title}}**・**{{ui:workflows.templates.videoWan22.title}}**・**{{ui:workflows.templates.videoWan22Image.title}}** を開くと、すぐに動かせます。モデルは、音楽タブと動画タブでダウンロードしたものを使います。
- 結果を保存するノード（Save Audio や Save Video）で、形式を選びます。MP3 の音質のように、選んだ形式に必要な設定は、その下に出ます。
- できた音楽や動画は、ギャラリーに入ります。ギャラリーが扱える形式は、音楽が MP3・WAV・FLAC、動画が MP4 です。Opus や WebM などを選ぶと、保存できない形式だと知らせるメッセージが出て、止まります。
- ギャラリーの音楽や動画は、Load Audio や Load Video のノードで選んで、つなげます。
- **{{ui:workflows.nodes.voice_speak.title}}** のノード（分類は **{{ui:workflows.categories.audio}}**）は、文章を声に出して読み上げた音声を作ります。音声タブと同じエンジン（Qwen3-TTS）で、あらかじめインストールしておく必要があります。できた音声は、音声を受け取るノードにつなぎます。Save Audio につなげば MP3 などで保存でき、Create Video の音声につなげば動画に声を付けられます（音声が動画より長いと、動画の長さで切られます）。ひな形の **{{ui:workflows.templates.voiceRead.title}}** と **{{ui:workflows.templates.videoNarration.title}}** が、そのまま使えます。
- 「ランダムな整数」をつないでいないシードは、いつも同じ結果になります。ひな形には、最初からつないであります。
- ComfyUI 本体のノードの名前、項目、フォルダの名前は、ComfyUI 自身の画面と同じ言葉で出ます。ComfyUI に訳がない言葉（拡張機能のノードなど）は英語のままです。使えるノードの数は、ComfyUI の版で変わります。

### ボタンの並び

エディタの左上のボタンです。

| ボタン | 何をするか |
|---|---|
| **{{ui:workflows.toolbar.new}}** | 空のワークフローを始めます。 |
| **{{ui:workflows.toolbar.save}}**（`Ctrl+S`） | 保存します。初めて保存するときは、名前を聞かれます。 |
| **{{ui:workflows.toolbar.optimize}}** | 重複するノードをまとめ、出力につながらないノードと、いらない接続を消して、左から右へ並べ直します。やり直しもできます。 |
| **{{ui:workflows.toolbar.more}}** | **{{ui:common.saveAs}}**、**{{ui:workflows.toolbar.download}}**、**{{ui:workflows.toolbar.loadFromFile}}**。 |

右上の歯車の **{{ui:workflows.settings.title}}** では、ミニマップの表示、グリッドに合わせる、などを切り替えられます。

**{{ui:workflows.settings.autoTidy}}** は、最初はオフです。オンにすると、ノードや線を足したり消したりすると、少しして、ノードを左から右へ自動で並べ直し、同じ働きの重複したノードをまとめます。まとめたときは通知が出て、`Ctrl+Z` で戻せます。つながっていないノードは、自動では消えません。自分で並べたいときは、オフのままにしてください。

保存していない変更があると、名前の横に点が出ます。ほかのワークフローに切り替えるときは、破棄してよいかを聞かれます。

### フォームで使う

エディタは、ノードがたくさんあると、分かりにくくなります。そこで、使うときによくいじる項目だけを集めた「フォーム」を作れます。

1. エディタで、項目（フィールド）を右クリックして、**{{ui:workflows.node.addToForm}}** を選びます。
2. 左パネルの **{{ui:workflows.panel.workflow}}** タブに、その項目が並びます。
3. **{{ui:workflows.form.editForm}}** を押すと、並べ替えや外すことができます。

プロンプトやサイズだけを変えながら、何度も動かすときに便利です。つないである項目は、「{{ui:workflows.form.connected}}」と表示されます。

**{{ui:workflows.panel.details}}** タブでは、名前・作者・タグ・説明などを書けます。**{{ui:workflows.panel.data}}** タブでは、ワークフローの中身（JSON）を見て、コピーできます。

### ワークフローライブラリ

![ワークフローライブラリ](shot:workflows-library)

左パネルの一番上、生成ボタンの上にある **{{ui:workflows.library.button}}** のカード（いま開いているワークフローの名前が出ています）を押すと、一覧が開きます。

- **{{ui:workflows.library.recent}}**: 最近開いたもの。
- **{{ui:workflows.library.yours}}**: 自分で保存したもの。
- **{{ui:workflows.library.defaults}}**: 最初から入っている見本。見本は、**{{ui:workflows.library.copyToMine}}** で、自分用にコピーしてから直します。

検索や、タグでの絞り込み、並び順の変更ができます。**{{ui:workflows.library.open}}** で開き、ごみ箱のボタンで削除します。**{{ui:workflows.library.new}}** と **{{ui:workflows.library.upload}}** もここにあります。

### 書き出しと読み込み

- **{{ui:workflows.toolbar.download}}** で、ワークフローを JSON のファイルとして書き出せます。
- **{{ui:workflows.toolbar.loadFromFile}}**（または **{{ui:workflows.library.upload}}**）で、書き出したファイルや、ほかの人が作ったファイルを読み込めます。
- 読み込んだファイルが、まだインストールされていない拡張機能のノードを使っているときは、「{{ui:workflows.import.title}}」というダイアログが出ます。インストールして ComfyUI を再起動すると、そのワークフローが自動で開きます。
- ワークフローで作った絵からも、ワークフローを取り出せます。ギャラリーの絵を右クリックして、**{{ui:gallery.menu.loadWorkflow}}** を選びます（ビューアで絵を開いているときは `W` キーでも使えます）。普通に生成した絵でも、設定から同じ流れを組み立てられます。**{{ui:gallery.menu.sendToWorkflow}}** は、その絵をワークフローの入力画像として使うときに選びます。

> ほかの人が作ったワークフローは、あなたのパソコンで動くプログラムのつなぎです。出どころの分からないファイルは、読み込まないでください。

## テンプレート

**{{ui:workflows.panel.templates}}** タブには、よく使う組み合わせのひな形が並びます。

- **{{ui:workflows.templates.open}}** を押すと、新しいワークフローとして開きます。
- **{{ui:workflows.templates.add}}** を押すと、今のエディタの右に足します。
- モデルや画像は、開いたあとで選びます。

拡張機能が必要なひな形には、「必要な拡張機能」の欄が出ます。**{{ui:workflows.templates.installPacks}}** を押してインストールし、**{{ui:workflows.templates.restartFirst}}** のボタンで ComfyUI を再起動すると、開けるようになります。ComfyUI 本体のノードで組んだひな形は、ComfyUI が動き出すと開けるようになります。

用意されているひな形は、次のとおりです。

| ひな形 | 何をするか | 必要な拡張機能 |
|---|---|---|
| **{{ui:workflows.templates.text2image.title}}** | モデルとプロンプトから 1 枚作って保存する、基本の形です。 | なし |
| **{{ui:workflows.templates.text2imageUpscale.title}}** | 1024 で作った絵を 2048 に拡大して保存します。 | なし |
| **{{ui:workflows.templates.loraStack.title}}** | モデルに LoRA を順につないで、絵柄と細部を足します。 | なし |
| **{{ui:workflows.templates.image2image.title}}** | 手持ちの絵を元に、別のプロンプトで描き直します。 | なし |
| **{{ui:workflows.templates.upscale.title}}** | 拡大用のモデルで、絵を高精細に大きくします。 | なし |
| **{{ui:workflows.templates.controlnetCanny.title}}** | 絵の輪郭線を抜き出して、その形を保ったまま新しく描きます。 | なし |
| **{{ui:workflows.templates.imageToVideo.title}}** | 1 枚の絵に動きをつけて、短い動画にします。 | なし（動画用のモデルが必要です） |
| **{{ui:workflows.templates.videoWan22.title}}** | ComfyUI 本体のノードで、文章から短い動画を作ります。長さ・サイズ・サンプラーも自由に変えられます。 | なし（動画用のモデルが必要です） |
| **{{ui:workflows.templates.videoWan22Image.title}}** | 同じ組み方で、選んだ絵から動画を作ります。 | なし（動画用のモデルが必要です） |
| **{{ui:workflows.templates.musicAceStep.title}}** | スタイルのタグと歌詞から曲を作ります。 | なし（音楽用のモデルが必要です） |
| **{{ui:workflows.templates.voiceRead.title}}** | 文章を読み上げた音声を作り、MP3 で保存します。 | なし（音声のエンジンとモデルが必要です） |
| **{{ui:workflows.templates.videoNarration.title}}** | ギャラリーの動画を選び、読み上げた音声をその動画の音声にして、新しい動画として保存します。 | なし（音声のエンジンとモデルが必要です） |
| **{{ui:workflows.templates.filmGrain.title}}** | 作った絵に、写真らしい粒子を足します。 | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.faceRig.title}}** | 顔写真の表情・目線・首の向きを変えます。 | ComfyUI-NKD-Basic-Tools |
| **{{ui:workflows.templates.tiledUpscale.title}}** | 2048 に拡大してから、タイルごとに描き直して細部を足します。 | ComfyUI_UltimateSDUpscale |
| **{{ui:workflows.templates.styleReference.title}}** | 参照画像の画風を、プロンプトの絵に移します。 | ComfyUI_IPAdapter_plus（と、そのモデル） |
| **{{ui:workflows.templates.faceDetailer.title}}** | 作った絵の顔を見つけて、高い解像度で描き直します。 | Impact Pack と Impact Subpack |
| **{{ui:workflows.templates.removeBackground.title}}** | 人や物だけを残して、背景を透明にします。 | ComfyUI-RMBG |
| **{{ui:workflows.templates.whiteBackground.title}}** | 人や物だけを残して、背景を真っ白にします。参照画像の背景の色が絵に移るのを防ぐ、下ごしらえに向きます。 | ComfyUI-RMBG |
| **{{ui:workflows.templates.poseControl.title}}** | 参考にした絵の人物のポーズを抜き出して、同じ姿勢の新しい絵を描きます。 | comfyui_controlnet_aux（と、OpenPose 用の ControlNet モデル） |
| **{{ui:workflows.templates.captionToImage.title}}** | 参考にした絵の内容を文章にして、プロンプトにして、新しく描きます。 | Florence-2 の拡張機能 |
| **{{ui:workflows.templates.characterReference.title}}** | キャラクターの絵を白い背景にして参照画像にし、髪・目・服をそろえて、新しい場面を描きます。CFG は、参照画像に合う低めの値になっています。 | ComfyUI-RMBG と ComfyUI_IPAdapter_plus |
| **{{ui:workflows.templates.characterPose.title}}** | キャラクターの見た目は参照画像から、姿勢は棒人間（OpenPose）から取って描きます。 | 上の 2 つに、comfyui_controlnet_aux と、OpenPose 用の ControlNet モデル |

キャラクターを使うひな形は、[キャラクターを登録して使う](04-improve.md#キャラクターを登録して使う) の機能を、ワークフローで細かく調整したいとき向けです。ふつうは、生成タブで登録したキャラクターを使えば足ります。棒人間の姿勢は、[キャンバス](05-canvas.md) の「{{ui:pose.title}}」で作れます。

## 拡張機能（カスタムノード）

**{{ui:workflows.panel.packs}}** タブでは、ComfyUI に拡張機能を足したり、外したりします。拡張機能は、ノードを増やすための追加パーツです。インストールしたノードは、ノードの追加の一覧の **{{ui:workflows.categories.extension}}** に出ます。

最初は、「{{ui:workflows.packs.whatToDo}}」の大きなタイルが並びます。やりたいこと（顔をきれいに直す、背景を消す、大きく高精細にする、など）を選ぶと、それに合う拡張機能が、説明つきで並びます。

1. 使いたい拡張機能の **{{ui:workflows.packs.install}}** を押します。
2. インストールが終わると、「{{ui:workflows.packs.restartNeeded}}」と出ます。**{{ui:workflows.packs.restart}}** を押します。
3. 再起動が済むと、その拡張機能のノードや、ひな形が使えます。

注意書きのある拡張機能があります。「Git が必要」「インストールに時間と容量がかかる」「更新が止まっている」などです。インストールする前に、読んでください。

カタログにないものは、**{{ui:workflows.packs.byAddress}}** で、GitHub のアドレス（https://github.com/ユーザー名/名前 の形）を入れてインストールできます。ほかにも入っている拡張機能は、**{{ui:workflows.packs.others}}** に出ます。不要な拡張機能は、**{{ui:workflows.packs.remove}}** で外せます（確認のため、もう一度押します）。

インストールした拡張機能は、ワークフローの画面でなくても、いつでも見られます。左のサイドバーにある **{{ui:app.nav.extensions}}**（パズルのアイコン）を押すと、**{{ui:workflows.packs.mgr.title}}** が開きます。公開されている拡張機能がカードで並び、左の一覧で **{{ui:workflows.packs.mgr.installed}}**・**{{ui:workflows.packs.mgr.notInstalled}}**・目的別に絞れ、上の欄で名前・作者・説明から探せます。**{{ui:workflows.packs.mgr.sort.label}}** は、初めは **{{ui:workflows.packs.mgr.sort.downloads}}** の多い順です。カードには作者・バージョン・更新日・ダウンロード数が出て、インストールされているものには **{{ui:workflows.packs.installed}}** と出ます。インストールされていないものは、カードの **{{ui:workflows.packs.install}}** でインストールできます。カードを押すと右に詳細が開き、**{{ui:workflows.packs.mgr.license}}** や配布元を確かめて、**{{ui:workflows.packs.remove}}** もできます。一覧にない拡張機能は、上の **{{ui:workflows.packs.mgr.addTitle}}** に GitHub のアドレスを入れてインストールできます。インストールしたり外したりしたあとは、同じ画面に出る **{{ui:workflows.packs.restart}}** を押すと反映されます。各カードの詳細には **{{ui:agent.ask.button}}** のボタンがあり、検索欄に言葉を入れると **{{ui:agent.ask.resultsButton}}** も出ます。押すと、エージェントが、その拡張機能が何をするもので、どう使うのかを説明します（[エージェントと設定](09-assistant-settings.md) を見てください）。

詳細の **{{ui:workflows.packs.version.label}}** には、いまインストールされているバージョンが出ます。その拡張機能のリポジトリがバージョンを公開しているときだけ **{{ui:workflows.packs.version.change}}** が出て、押すと選べるバージョンが並び、**{{ui:workflows.packs.version.apply}}** でそのバージョンに入れ替えます。いまインストールされているバージョンには **{{ui:workflows.packs.installed}}** と出ます。バージョンを公開していない拡張機能には、このボタンは出ません。反映するには、同じ画面の **{{ui:workflows.packs.restart}}** を押します。ほかの拡張機能や ComfyUI が対応していないと分かっているバージョンには **{{ui:workflows.packs.version.deprecated}}** と出て、どれが対応していないかも書かれます。自分でインストールした拡張機能は、ここからバージョンを変えられません。

ComfyUI のバージョンも、同じ画面から変えられます。一覧の先頭にある **{{ui:workflows.packs.version.comfyTitle}}** のカードを押し、右に出る **{{ui:workflows.packs.version.change}}** で選べるバージョンを並べます。**{{ui:workflows.packs.version.apply}}** を押したあと、もう一度 **{{ui:workflows.packs.version.confirm}}** を押すと切り替えが始まります。インストールされている拡張機能はすべてインストールし直すので数分かかり、終わるまで画像は作れません。新しいバージョンが起動しないときは、元のバージョンに戻ります。

> 拡張機能は、あなたのパソコンで動くプログラムです。出どころの分からないものはインストールしないでください。

> アプリが管理していない ComfyUI をつないでいるときは、この画面からはインストールできません。その ComfyUI の側でインストールしてください。

[絵を直す・使い回す](04-improve.md) の「{{ui:cutout.menu}}」や「{{ui:facefix.menu}}」など、拡張機能を使う機能は、必要になったときに、同じようにインストールを案内します。
