//! What the app does when it cannot start. Nothing is on screen yet, so a dialog that says why is the only way the user learns it.
//! The lock that keeps two copies of the app from using one data folder lives in `novira_core::startup`, shared with the
//! browser server.
use rfd::{MessageButtons, MessageDialog, MessageLevel};
use std::path::Path;

pub use novira_core::startup::Refusal;

/// Shows the reason and the data folder in a dialog, then ends the process. The text is Japanese: the dialog comes
/// before the screen and its catalog exist.
pub fn fail(refusal: Refusal, data_dir: &Path) -> ! {
    let reason = match refusal {
        Refusal::AlreadyRunning => {
            "このデータフォルダは、既に起動している novira が使用中です。".to_string()
        }
        Refusal::Error(e) => format!(
            "データを開けませんでした:
{e}"
        ),
    };
    MessageDialog::new()
        .set_level(MessageLevel::Error)
        .set_title("novira を起動できません")
        .set_description(format!(
            "{reason}

データフォルダ: {}",
            data_dir.display()
        ))
        .set_buttons(MessageButtons::Ok)
        .show();
    std::process::exit(1);
}
