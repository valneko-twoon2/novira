//! Reading the graphics card on the machine the tests run on. The answer depends on the machine, so this only checks
//! that the reading ends and is consistent (a card with a name or memory, or the explicit "unknown").
use novira_core::hardware::{detect, HardwareInfo};

#[test]
fn detecting_the_card_ends_with_a_consistent_answer() {
    let info = detect();
    if info == HardwareInfo::unknown() {
        assert!(info.gpu_name.is_empty() && info.vram_bytes.is_none());
    } else {
        assert!(
            info.vram_bytes.is_some_and(|b| b > 0) || !info.gpu_name.is_empty(),
            "{info:?}"
        );
    }
}
