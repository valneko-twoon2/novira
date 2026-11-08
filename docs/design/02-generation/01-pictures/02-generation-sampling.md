---
covers:
  - backend/crates/novira-core/src/comfy/engine_sampling.rs
  - frontend/src/backend/engineSampling.ts
  - frontend/src/features/params/sections/GenerationSection.tsx
---
# 画像のサンプラーとノイズスケジュール

画像を何でサンプリングするか、そしてユーザーがそれをどう選べるか。

## 動作
- 設定 `scheduler` は InvokeAI のもので、サンプラーとノイズスケジュールを 1 つの名前にまとめる（`comfy/graph.rs` の `sampler_for`）。新しいファミリーのモデルは、設定にかかわらずそのファミリー固有の組で動く（`Family::sampling`）。Anima は設定に従い、素の `euler` はテンプレートの `euler / simple` を意味する。
- 画像は ComfyUI のサンプラー（`samplerName`）とノイズスケジュール（`noiseSchedule`）を、それぞれの名前で指定することもできる。指定は、設定やファミリーが実行する組の対応する半分を、どのファミリーでも置き換える（`engine_sampling::with_choice`）。名前は `comfy/engine_sampling.rs` にある ComfyUI の `KSampler` の一覧で、`contract/engine-sampling.json` が画面側の写しを持ち、両側が検査する。
- 選択は `graph::build` で適用される（高解像度修正、下書き、タイル、アップスケールのパスも反映する）。編集レシピにも適用される。FLUX.2 は `Flux2Scheduler` からシグマを取るので、指定できるのはサンプラーだけで、ノイズスケジュールは断る（画面は欄を隠す）。
- ワーカーは実行したものを `sampling` として記録する（`split::ran_sampling`）。画像が自分で名前を指定したときも同じ。ビューアーのその行は選択を呼び戻す。プリセットは選択を保持し、選択が存在する前に作ったプリセットは現在の選択を解除する。
- 画面の「auto」の項目は「Auto (name)」と、それが指すものを表示する。ファミリー固有の組か、スケジューラー設定が対応づける組（`runningSampling`。`contract/scheduler-sampling.json` が表を持ち、Rust が `sampler_for` と突き合わせて検査する）。
- ジョブの前にエンジンの `KSampler` の選択肢を読む。この ComfyUI にない名前は、その名前を示してジョブを失敗させる。

## 境界
- 2 つの一覧にない名前は、画面が何を送ってきても、プロンプトに届く前に断る（`with_choice`）。
- 動画、音楽、音声のグラフはこの選択を読まない。

## 既知の限界
- サンプラーがモデルに合うかは検査しない。テンプレートが使わないファミリーに選んだ名前（例: フローモデルへの SDE サンプラー）はそのまま動き、質の低い画像になることがある。
- 一覧は ComfyUI 0.3x のもの。新しい ComfyUI の追加の名前は、一覧を変えるまで選べない。
