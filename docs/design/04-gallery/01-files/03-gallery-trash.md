---
covers:
  - backend/crates/novira-core/src/service/gallery.rs
  - backend/crates/novira-core/src/service/boards.rs
  - backend/crates/novira-core/src/media/images.rs
  - frontend/src/state/galleryUndo.ts
  - frontend/src/features/gallery/actions.ts
  - frontend/src/features/gallery/grid/useGridHotkeys.ts
  - frontend/src/features/gallery/header/GalleryHeader.tsx
---
# 画像の削除と元に戻す操作

削除した画像はしばらく保管するので、誤った削除を元に戻せ、元に戻したものをもう一度削除することもできる。ファイルとボード自体は [02-gallery-share.md](02-gallery-share.md) にある。

## 動作

**ゴミ箱。** `delete_images` と、画像ごとボードを削除する操作は、画像をその場で消さない。画像のレコードは `trash` テーブル（画像のギャラリーレコードと時刻）へ移り、2 つのファイルはデータフォルダの `trash/` へ移る（`ImageFiles::trash`）。`restore_images` はそれらを戻し、戻った画像を返す。画像はボードとスターごと戻る。その間にボードが削除されていれば、未分類に戻る。ギャラリーが知らない名前（迷子のファイル）は即座に削除する。別のプログラムがファイルを開いているために原本を動かせない画像はギャラリーに残り、削除の結果でそれを報告する。ファイルを元の場所へ動かせない画像はゴミ箱に残り、もう一度復元できる。

**保管。** 画像は 14 日間、最大 500 枚まで残る。削除のたびに、それを超えた古いものは完全に消える（`stale_in_trash`）。バックアップにゴミ箱は含まない。

**画面では。** `state/galleryUndo.ts` は直近 30 回の削除を、1 回の削除ごとにその画像名として保持する。削除の通知はステータスバー右端の通知ベルの下にだけ出る（`app/NotificationBell.tsx`、`state/toasts.ts`。`quiet` の通知はベルがあるあいだトーストを出さないので、画像を次々削除してもギャラリーの上にトーストが積もらない。ベルが数え、ベルのない電話レイアウトではトーストを表示する）。通知には削除した画像の小さなコピー（ファイルがゴミ箱へ行く前に描く。ゴミ箱の画像は画像アドレスがもう配信しない。`state/pictureMarks.ts`）と、その削除を 1 回だけ元に戻す「元に戻す」ボタンが付く。ギャラリー上部の 2 つのボタンと Ctrl+Z / Ctrl+Shift+Z（Ctrl+Y も）は、直近の削除を元に戻し、再び削除する。キーはビューアを開いているとき、またはポインターがギャラリーの上にあるときに効くので、キャンバスは自分のキーを保つ。新しく削除すると、再び削除できるものは終わる。バックエンドが画像をもう持っていないときは、警告で知らせる。

## 既知の限界

- 元に戻せる履歴は再起動をまたいで保たない。ゴミ箱は保つので、14 日以内なら画像は `trash/` に残っている。
- 削除した画像がディスク容量を空けるのは、完全に消えたときだけ。
- 電話のページは同じゴミ箱へ削除するが、削除を元に戻せない。
