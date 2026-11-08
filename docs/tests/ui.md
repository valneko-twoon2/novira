# UI 層のテスト

フロントエンドの画面と部品を守るテスト。画面の流れ、操作の順序、見た目、文字の収まり、アクセシビリティを扱う。一覧に戻る: [README.md](README.md)。

| 手法 | ここで確かめること | 場所 | 実行 | CI |
|---|---|---|---|---|
| 部品テスト / Component | テスト用 DOM に画面や部品を描画して確かめる。一度開いた画面は隠れたまま残るので、開いている画面の写しを探して検査する | `frontend/src/app/phone/PhoneView.test.tsx` と、部品の隣の `*.test.tsx` | `npx vitest run <path>` | `vitest` |
| E2E / End-to-end | モックバックエンド上の画面の流れを Chromium で通す。ページのコンソールエラーは失敗にする | `frontend/e2e/`、`frontend/playwright.config.ts` | `npm run e2e`、または `npx playwright test --project=chromium` | `e2e-chromium` |
| モンキーテスト / Monkey | 固定シードのランダムなクリック、入力、キー、ドラッグを主要画面に与える。毎回、エラー境界が出ていないこと、アプリが残っていること、エラーが記録されていないことを確かめる。モック上のブラウザーのみ | `frontend/e2e/monkey.spec.ts` | `npx playwright test e2e/monkey.spec.ts --project=chromium`、`NOVIRA_MONKEY_SEED`、`NOVIRA_MONKEY_ACTIONS` | `e2e-chromium` |
| ブラウザー・端末横断 / Cross-browser and device | スマートフォン配置を、Chromium の Pixel 7 と WebKit の iPhone 14 で確かめる。iOS Safari そのものではなく、Firefox も無い | `frontend/e2e/phone.spec.ts`、`frontend/playwright.config.ts` | `npx playwright test --project=phone --project=webkit` | `e2e-phone` |
| 見た目の回帰 / Visual regression | 主要画面のスクリーンショットを基準画像と比べる。基準は環境ごとに 1 組。pre-commit は更新された基準を求める | `frontend/e2e/visual.spec.ts`、`frontend/e2e/__screenshots__/`、`scripts/tools/visual-baselines.mjs` | `npm run e2e:visual` | `manual` |
| レイアウト走査と文字の収まり / Layout scan and text fit | すべての画面、ダイアログ、メニューを ja と en、暗色と明色で開き、はみ出し、切れた文字、省略、接触、重なりを調べる。pre-commit は走査を通した記録を求める | `frontend/e2e/layout.spec.ts`、`frontend/e2e/layoutScan.ts`、`frontend/e2e/textFit.ts`、`scripts/tools/layout-scan.mjs` | `node scripts/tools/layout-scan.mjs` | `manual` |
| アクセシビリティ / Accessibility | 主要画面を axe で WCAG A と AA について検査し、既知の一覧と比べる。色のコントラストは検査しない | `frontend/e2e/a11y.spec.ts`、`frontend/e2e/a11yKnown.ts` | `npx playwright test e2e/a11y.spec.ts --project=chromium` | `e2e-chromium` |
| キーボード操作 / Keyboard | 8 つのタブで Tab を最大 300 回押し、見える操作部品がすべて止まること、フォーカス表示があること、正の `tabindex` や Tab 順から外された単独の部品が無いことを確かめる。設定、ショートカット、情報などの層は Escape で閉じ、フォーカスが開き元へ戻ること、モーダルの中で Tab が外へ出ないことも確かめる。既知の欠陥は減らすだけの一覧に置く | `frontend/e2e/a11yKeyboard.spec.ts`、`frontend/e2e/a11yKeyboard.ts`、`frontend/e2e/a11yKeyboardKnown.ts` | `npx playwright test e2e/a11yKeyboard.spec.ts --project=chromium` | `e2e-chromium` |
| モーション低減 / Reduced motion | 「動きを減らす」設定で、見える要素に 0.2 秒を超える動きや無限のアニメーションが残らないこと | `frontend/e2e/a11yMotion.spec.ts`、`frontend/e2e/a11yMotionKnown.ts` | `npx playwright test e2e/a11yMotion.spec.ts --project=chromium` | `e2e-chromium` |
| 拡大表示 / Zoom | UI の拡大率の両端と最小ウィンドウで、横スクロールが出ないこと、ナビがウィンドウ内にあること、はみ出し件数が既知の上限以下であること。ズームを適用するのはデスクトップのシェルだけなので、ブラウザーでは「ウィンドウ ÷ 拡大率」の表示領域で代用する | `frontend/e2e/a11yZoom.spec.ts`、`frontend/e2e/a11yZoomKnown.ts` | `npx playwright test e2e/a11yZoom.spec.ts --project=chromium` | `e2e-chromium` |
| 色のコントラスト / Contrast | 暗色と明色で、単色の背景の上の文字が 4.5（大きい文字は 3）以上であること。背景画像やグラデーションの上の文字は測らない。測れた文字が 15 件未満なら落とす | `frontend/e2e/a11yContrast.spec.ts`、`frontend/e2e/a11yContrast.ts`、`frontend/e2e/a11yContrastKnown.ts` | `npx playwright test e2e/a11yContrast.spec.ts --project=chromium` | `e2e-chromium` |
| 画面操作の時間予算 / Time budget | 頻繁に起きる操作（文字色をピッカーで速くドラッグする、画像とテキストの画面の切り替え、メイン画面の切り替え、レイヤーの追加、モザイクを重ねたときの 1 筆の遅さの伸び）の時間を中央値で測り、予算（測った値の約 3 倍）を超えたら、操作名と見るべきファイルを添えて落とす。開発ビルドのモックで、表示倍率 2 倍で測る | `frontend/e2e/perf-budget.spec.ts`、`frontend/e2e/perfBudget.ts` | `npx playwright test e2e/perf-budget.spec.ts --project=chromium` | `e2e-chromium` |

新しい画面やダイアログは、モンキーの `RUNS`、アクセシビリティの `TABS` か `SURFACES`、キーボード検査の `LAYERS` と `TABS`、レイアウト走査の一覧に足す（`.claude/rules/tests.md`）。

## この層にも関わる手法

- 性質ベース（フロントエンド）: [logic.md](logic.md)
- 差分（モックと本物）: [mock.md](mock.md)
- カバレッジ、カスタム lint: [repo.md](repo.md)
