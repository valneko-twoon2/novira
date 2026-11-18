---
covers:
  - backend/crates/novira-core/src/hardware.rs
  - backend/crates/novira-core/src/comfy/install.rs
  - backend/crates/novira-core/src/comfy/switch.rs
  - backend/crates/novira-core/src/service/engine_settings.rs
  - frontend/src/features/settings/EnginePane.tsx
---
# GPU とエンジンのパッケージ

一覧に戻る: [README.md](README.md)

novira が自前でインストールする ComfyUI には、NVIDIA の GPU 用と AMD の GPU 用の 2 つのパッケージ（公式のポータブルリリース）がある。どちらを入れるかは設定 `comfyuiPackage` で決まり、既定の `auto` は PC の GPU に合わせて選ぶ。インストールと版の切り替えは [02-extensions.md](02-extensions.md)、設定ファイルと設定画面の全体は [01-settings-engine.md](01-settings-engine.md) に書いてある。

## 動作

- **選択。** `comfyuiPackage` は `auto`（既定）、`nvidia`、`amd`（`backend/crates/novira-core/src/types.rs` の `ComfyuiPackageChoice`）。`settings.json` を手で書き換えた未知の値は、画面には `auto` と見え、インストールはその値を断る。
- **自動の判定**（`backend/crates/novira-core/src/hardware.rs` の `auto_package`）。レジストリにあるディスプレイのドライバーの `MatchingDeviceId` を読む（`reg query`）。ドライバーは、カードが切られている間も残る（ノート PC が省電力のために NVIDIA の GPU を切るモード、外付けの GPU）ので、そのたびに種類が変わって入れ直すことはない。PCI のベンダー ID が NVIDIA のドライバーがあれば `nvidia`、無くて AMD のものがあれば `amd`、どちらも無ければ `nvidia`（`auto` ができる前の既定）。判定は起動ごとに 1 回で、ログにはベンダー ID だけを残す。
- **使うところ。** エンジンは、ComfyUI のインストール、パッケージの比較、版の切り替えの直前に、別のスレッドで判定を読む（`backend/crates/novira-core/src/comfy/client.rs` の `packages_for`）。アプリの起動はこれを待たない。
- **アーカイブ。** ダウンロードしたリリースは、種類（版を指定したときは版も）を名前に持つファイル（`archive_name`）に置き、展開に失敗したときも、同じ名前になる次のインストールにだけ使い回す。前の版が種類なしの名前（`comfyui.7z`、`comfyui-<版>.7z`）で残したものは、中身の種類が分からないので、展開せずに途中のダウンロードごと消す。
- **記録の無いインストール。** インストール元は `portable/novira-package.txt` に書く。記録の無いインストールは、設定が `amd` なら AMD 用、それ以外は NVIDIA 用とみなして記録する（`ComfyuiPackageChoice::unrecorded`、`adopt_package`）。設定の画面を開いただけでは記録しない。
- **変更。** 記録と、設定が指す種類（`auto` はこの PC で選ばれる種類）が違うと、次の起動で同じ ComfyUI の版を別のパッケージで入れ直し、拡張機能も入れ直す。新しいものが起動しないときは古いものに戻す（[02-extensions.md](02-extensions.md)）。`auto` のまま GPU を差し替えたときも同じ。
- **設定画面**（`frontend/src/features/settings/EnginePane.tsx`）。選択肢は自動・NVIDIA 向け・AMD 向けで、自動の項目は選ばれる種類を名前に示す（`EngineSettings.autoComfyuiPackage`）。インストール済みの種類と、選んだ項目が入れる種類が違うときは、保存の前に確認を出す。`restartNeeded` は、選択の名前ではなく入る種類で比べる（`auto` と、それが指す種類を明示した値は同じ）。
- **起動。** AMD 用も NVIDIA 用と同じ引数で起動する（`backend/crates/novira-core/src/comfy/process.rs`。公式の `run_amd_gpu.bat` も追加の引数や環境変数を持たない）。低メモリモードの `--novram` も同じ。メモリ不足の判定は ROCm（HIP）の文言も読む（`is_out_of_memory`）。
- **アシスタント。** `get_engine_info` が、自前のインストールの種類と、それを選ぶ設定を返す（`gpuBuild`）。

## 境界

| 境界 | ガード |
|---|---|
| 種類の設定（`set_engine_settings` の `comfyuiPackage`） | `auto`・`nvidia`・`amd` だけを受け取り、何かを書く前にバックエンドで検査する（`settings::check_package`）。ダウンロード先は種類ごとに決まった公式リリースのファイル名だけで、設定の値をそのままアドレスに入れない（`package_url_for`）。 |
| ドライバーの照会 | 固定の引数で `reg` を起動して読むだけで、何も書かない。機器の ID はベンダーの判定にだけ使い、画面にもログにも出さない。 |

## 既知の限界

- AMD 用は ComfyUI 公式の AMD 用ポータブル（PyTorch は ROCm）で、動くのは ComfyUI が対応する Radeon（RDNA 2 以降）と新しいドライバーの組み合わせ。それ以外の AMD の GPU では、`auto` が AMD 用を選んでもエンジンが起動しない。
- novira の開発では、AMD の GPU での実行を確かめていない。判定、選択、インストールの流れは単体テストとモックで、NVIDIA の PC での `auto` の判定と起動は本物のエンジンで確かめている（2026-11-18）。
- NVIDIA と AMD の両方の GPU がある PC では、`auto` は NVIDIA 用を選ぶ。NVIDIA の GPU を AMD の GPU に替え、NVIDIA のドライバーを消していない PC でも同じ。AMD の GPU で動かすには `amd` を選ぶ。
- `auto` の判定は `reg` の照会に頼る。管理者がレジストリ編集ツールを禁じている PC で照会が断られると、`auto` は NVIDIA 用になる。
- 展開に失敗して残したアーカイブ（2 GB 前後）は、同じ種類の次のインストールに使う（版を指定したときは同じ版のときだけ）。版を指定しない初回のインストールでは、その間に新しい版が出ていても、前にダウンロードした版を入れる。その前に別の種類や版に変えると `.downloads` に残り続け、完成したファイルなので未完了のダウンロードの一覧にも出ない。
- 動画・音楽・音声の機能や拡張機能のうち、CUDA を前提にするもの（`triton-windows` を使うものなど）が AMD 用で動くかは確かめていない。
