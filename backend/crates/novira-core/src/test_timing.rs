//! Debug-only shortening of the fixed pauses between retries.
//!
//! Some file operations are retried for a long time because Windows reports a sharing violation while another process
//! still holds the file (the old database during a restore, a folder being moved into place). A test of the "still
//! failing after every try" path would wait for the whole budget. A debug build lets a test replace each pause with a
//! few milliseconds through `NOVIRA_TEST_RETRY_PAUSE_MS`. Only the length of a pause changes: not how many tries are
//! made, not which errors are retried and not what is done afterwards. The release build does not contain the
//! variable name and always waits the real time.
use std::time::Duration;

/// The longest override accepted; anything larger (or not a number) is ignored.
#[cfg(any(debug_assertions, test))]
const MAX_OVERRIDE_MS: u64 = 1_000;

/// `value` as a pause when it is a whole number of milliseconds up to [`MAX_OVERRIDE_MS`].
#[cfg(any(debug_assertions, test))]
fn parse_override(value: Option<&str>) -> Option<Duration> {
    let ms: u64 = value?.parse().ok()?;
    (ms <= MAX_OVERRIDE_MS).then(|| Duration::from_millis(ms))
}

/// The pause to take between two retries: `real`, or in a debug build the value of `NOVIRA_TEST_RETRY_PAUSE_MS`.
pub(crate) fn retry_pause(real: Duration) -> Duration {
    #[cfg(debug_assertions)]
    if let Some(short) = parse_override(std::env::var("NOVIRA_TEST_RETRY_PAUSE_MS").ok().as_deref())
    {
        return short;
    }
    real
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_a_small_whole_number_of_milliseconds_is_an_override() {
        assert_eq!(parse_override(Some("1")), Some(Duration::from_millis(1)));
        assert_eq!(parse_override(Some("0")), Some(Duration::ZERO));
        assert_eq!(
            parse_override(Some("1000")),
            Some(Duration::from_millis(1000))
        );
        for bad in ["1001", "-1", "", "1.5", "fast", " 5"] {
            assert_eq!(parse_override(Some(bad)), None, "{bad}");
        }
        assert_eq!(parse_override(None), None);
    }

    #[test]
    fn without_the_variable_the_real_pause_is_used() {
        // Nothing in this test binary sets the variable.
        assert_eq!(retry_pause(Duration::from_secs(3)), Duration::from_secs(3));
    }
}
