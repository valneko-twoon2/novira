// Runs before the page's first paint (a plain script in <head>, from the app's own origin as the CSP allows): puts the
// saved theme on <html>, so a light app never shows dark while its code loads. main.tsx and App.tsx take over after.
// Dark, the default, stays for anything unreadable. Keep in step with src/state/savedTheme.ts.
(function () {
  try {
    var saved = JSON.parse(localStorage.getItem('novira.settings') || 'null');
    if (saved && saved.state && saved.state.theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  } catch {
    // Storage blocked or unreadable: keep the default.
  }
})();
