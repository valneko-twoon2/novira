// Which changed files can alter what the main screens show, so the visual regression (e2e/visual/) is due:
// scripts/tools/affected.mjs names `npm run e2e:visual` for them. The pre-commit hook runs it on every commit anyway
// (scripts/tools/commit-gates.mjs); update the baselines in the same commit when a change is intended.

/** Source that decides what the screens show: components, styles, i18n catalogs, the mock data and the page itself. */
const SCREEN_SOURCE = /^frontend\/(src\/.+\.(tsx?|css)|src\/i18n\/locales\/.+\.json|index\.html)$/;
/** Tests, test support and type declarations. */
const NOT_SCREENS = /(\.test\.tsx?|\.testkit\.ts|\.d\.ts)$/;

/** Whether a changed path can change what a main screen shows. */
export function isScreenSource(path) {
  return SCREEN_SOURCE.test(path) && !NOT_SCREENS.test(path);
}
