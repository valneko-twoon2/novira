---
covers:
  - backend/crates/novira-core/src/service/pack_store.rs
  - backend/crates/novira-core/src/packs.rs
  - backend/crates/novira-core/src/hardware.rs
  - frontend/src/state/hardware.ts
  - frontend/src/features/media/modelFit.ts
  - frontend/src/features/media/PackChoice.tsx
  - frontend/src/features/media/PackCard.tsx
---
# モデルパック、スターターモデル、適合マーク

一覧に戻る: [README.md](README.md)

メディアの種類によっては必要になる追加のモデルファイル（動画、音楽、音声、インペイント）、スターターモデルの固定リスト、パックがカードに合うかを示すハードウェアのマーク。モデルファイル自体、そのフォルダ、インストールのソース、キーは [01-models.md](01-models.md)。

## 動作

- **パック。** メディアの種類ごとに 1 つ、計 5 つ。`video`（Wan 2.2 TI2V 5B）、`turbo`（4 ステップの Wan 2.2 5B。動画パックのテキストエンコーダと VAE を再利用する）、`music`（ACE-Step 1.5 turbo）、`voice`（音声エンジンのライブラリと Hugging Face のモデル。[03-voice.md](../04-media-screens/03-voice.md) を参照）、`inpaint`（LaMa、GitHub の `big-lama.pt`）。インストールは通常の一覧の外にあたる `<data>/models/<kind>/` へファイルを置く。パックは、`modelRoots` のどのフォルダでも `<root>/<kind>/` にファイルがあればそれも数える（同じレイアウト。データフォルダのコピーが優先。読み取り専用: novira はそこにインストールも移動も削除もしない。共有ルートがすでに持つファイルはインストールで飛ばす）。音声エンジンもそこからモデルを読み込む。パックが ready になるのは、各ファイルがどれかのルートにあるとき（`packs::find_file`、`voice::model_dir_in`）。音声を除くすべてのパックが、`extra_model_paths.yaml` に自分の `novira_<kind>` 節を持つ。
- **パックのコマンド。** `pack_status`・`install_pack`・`cancel_pack` は種類を取る。`install_pack` はバックグラウンドでダウンロードしてすぐ返り、実行中のパックへの 2 回目の呼び出しは何もしない。進捗は種類を持つ `pack` イベントとして届く（`missing`・`downloading`・`installing`・`ready`・`error`）。`bootstrap` は 5 つすべての状態を返す。パックが ready になるのはすべてのファイルがあるときで、サイズとハッシュは検査しない。キャンセルすると、ディスク上の実態に戻る。
- **スターターモデル。** `list_starter_models` は `backend/crates/novira-core/src/models/starter.rs` の固定リストを返す。Hugging Face（`owner/repo::path`）か GitHub の単一ファイル。スターターモデルタブ（`frontend/src/features/models/InstallStarter.tsx`）は、これをメディアパックとともに、モデル画面と同じカードで表示する。左に用途（すべての用途を常に件数つきで一覧）、ツールバーにファミリー（`starterCatalog.ts`: 用途は型・ベース・編集モデルの名前から。共有の部品は、それを依存として挙げるモデルのファミリーを取る。各パックの用途とファミリーは固定）。1 項目をインストールする（パックは `installPack` 経由）。ファミリーを選んでバンドルがある場合は、まだインストールもキュー投入もされていない項目をインストールする。バンドルはベースに完全一致するので、`any` の項目（CLIP ViT-H エンコーダ、アップスケーラー）はどれにも入らず、`flux` バンドルは常に無効。依存は表示しない。パーツに分けて読み込むモデルでは、`model_parts`（`service/model_store.rs`。計算は `models/parts.rs`）が `comfy::split` にそのファミリーが必要とするものを尋ね、インストール済みのモデルをワーカーの名前照合（`split::pick`）で調べ、足りないもののスターター項目（`sizeBytes` つき）と、項目のない足りないファイルの名前を返す。生成パネル（`state/modelParts.ts`）はそれを最初の理由として表示し、それらの項目をインストールするボタンを出す。5 GB を超えるとき、およびパーツが足りないメインモデルや拡散モデルの `model_added` のたびに、先に確認が開く。
- **ハードウェア。** `hardware_info` は呼び出しごとにカードを読む（`hardware.rs`）。まず `nvidia-smi`（メモリが最大のもの）、なければ Windows でディスプレイアダプターのレジストリの `qwMemorySize`（メモリが最大のもの）、それもなければ不明。ページはセッションごとに一度だけ読む（`frontend/src/state/hardware.ts`）。
- **適合マーク。** `modelFit.ts` はメモリを GB に丸め、`PACK_NEEDS`（パックごとの最小と快適な GB）と比べて、快適・ぎりぎり・不足・不明のいずれかにする。動画の選択（`PackChoice.tsx`）は、最初の快適なモデル、なければ最初のぎりぎりのモデルを勧める。`PackCard.tsx` は未インストールのパックにマークを出す。
