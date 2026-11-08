---
covers:
  - frontend/src/state/comic/stamps.ts
  - frontend/src/state/comic/typeset.ts
  - frontend/src/state/comic/stamps.json
  - frontend/src/state/comic/templates.ts
  - frontend/src/state/comic/moreTemplates.ts
  - frontend/src/features/comic/PageTemplates.tsx
  - frontend/src/features/comic/StampPicker.tsx
---
# コミックのページレイアウト、文字入れの検査、擬音の画像

コミックのページをどう割れるか、コミックの文字入れをどう検査するか、コマに付けられる擬音の画像。保存文書、レイヤー、コミックの画像ジョブは [01-comic-canvas.md](01-comic-canvas.md) にある。

## 動作

- ページレイアウト：グリッド（`templates.ts` の `BUILTIN_PAGE_LAYOUTS`）と図形レイアウト（`templates.ts` と `moreTemplates.ts`）。各コマの角は単位点で、左から読むページ用として保存してあり、右から読むページではアプリが反転する。名前は `comic.template.builtin.<id>`。ページ自身のレイアウトはテンプレートとして保存でき、保存したテンプレートはコミックが持つ。
- 文字入れの検査（`state/comic/typeset.ts`）：`checkTypesetting` はコミックのすべての吹き出しを調べ、ページ・コマ・吹き出しの番号（1 から）つきで次を報告する。頭にかぶる吹き出し（ポーズの鼻と耳または目を囲むボックスが 20% 隠れる）、互いに重なる 2 つの吹き出し（小さいほうの 15%）、コマから 2% を超えてはみ出す吹き出し、60 文字または 5 行を超える吹き出し（キャプションと箱は除く）、空の吹き出し、コマの順序がページの読む向きに逆らう吹き出し（次が上にある、または同じ行で間違った側にある）。吹き出しのボックスは言葉から見積もる（`estimateBox`）ため、結果は手がかりである。アシスタントは `get_comic_page` の `typesetIssues` として読む。編集は止めない。
- 擬音の画像（吹き出し種別 `stamp`）：背景が透明な白黒の画像 114 枚（38 語の書体 3 種。gogogo のように 4〜7 回繰り返す語は専用の画像）。`frontend/src/assets/onomatopoeia` にあり（アプリに組み込み、`public/` はデスクトップ版のビルドから外す）、`state/comic/stamps.json`（ID、書体、書かれた語、読み、強さ、画像サイズ、用途）に一覧があり、`stamps.ts` を通して読む。吹き出しは画像 ID を `text` として持つ（どの画像も指さない text は何も描かず、保存したページから外す）。吹き出しも尾もなく、高さは `scale` を持つ吹き出しの文字サイズの `STAMP_HEIGHT_EM` 倍、幅は画像に従い、`rotation` は中心を軸に回す。画面は `img` を描く（`ComicBalloon.tsx`）。保存するページと PSD は読み込んだ画像を描く（`pageRender.ts` の `drawStamp`、画像は `preparePage` が読み込む）。吹き出しエディターは、テキスト欄をピッカー（`StampPicker.tsx`）に置き換える。ピッカーは語・読み・用途で検索し、手で絞り込める。アシスタントは `addBubble` の種別 `stamp` と、画像 ID か書かれた語・読みの語で追加する（`findStamp`：まず ID か語の完全一致、次に印を除き長音・小さい母音を同一視した語、1 つの音の繰り返しなら回数が最も近い画像。未知の語では操作が失敗し、38 語を挙げた注記を返す）。画像は CC0（`frontend/scripts/oss-included.json`）。

## 境界

| 境界 | 防ぎ方 |
|---|---|
| 保存した擬音の吹き出しが画像を指す | text を擬音の一覧から探す。どれも指さない text は何も描かず、保存したページから外すので、壊れた文書が別のファイルを読み込むことはない |
| 画像は固定のファイル | アプリに同梱する（`frontend/src/assets/onomatopoeia`、アプリに組み込み。`public/` はデスクトップ版のビルドから外す）。パスやアドレスは文書やアシスタントからは来ず、一覧から引く ID だけが使われる |

## 既知の限界

- レイアウト名は右から読むページを前提に書いてあり、左から読むページでは反転して見える。
- 擬音の画像は白黒のみ。色を変えることも、片側を伸ばすこともできない。
- 吹き出しの言葉が小さすぎると報告するのは、その大きさ（`TEXT_SHARE` × `scale` × ページ幅に対するコマ幅の割合）がページ幅の 1.7% 未満、つまり A5 のページで約 2.5 mm 未満のとき。画像（`stamp`）は検査しない。
- 文字入れの検査は報告するだけで、編集は止めない。頭を調べられるのはポーズのある人物だけで、ポーズなしで描いた顔は見えない。
