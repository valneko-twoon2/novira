// No console window, in debug builds too: the app logs to novira-data/logs/novira.log (applog), so nothing needs the console.
#![cfg_attr(windows, windows_subsystem = "windows")]

fn main() {
    novira::run();
}
