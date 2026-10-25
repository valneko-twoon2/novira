//! How long each step of opening the backend took: written to the log once per start, and read by
//! `examples/backend_timing.rs` to compare start-up times before and after a change.
use std::time::{Duration, Instant};

/// The steps of one `Backend::open`, in the order they ran.
#[derive(Debug, Clone, Default)]
pub struct OpenTimings {
    pub phases: Vec<(&'static str, Duration)>,
}

impl OpenTimings {
    pub fn total(&self) -> Duration {
        self.phases.iter().map(|(_, d)| *d).sum()
    }

    /// One line for the log: the total and every step, in milliseconds.
    pub fn summary(&self) -> String {
        let steps: Vec<String> = self
            .phases
            .iter()
            .map(|(name, d)| format!("{name} {:.1}", ms(*d)))
            .collect();
        format!(
            "opened in {:.1} ms ({})",
            ms(self.total()),
            steps.join(", ")
        )
    }
}

fn ms(d: Duration) -> f64 {
    d.as_secs_f64() * 1000.0
}

/// Records the time since the previous step under a name.
pub(super) struct Stopwatch {
    last: Instant,
    timings: OpenTimings,
}

impl Stopwatch {
    pub(super) fn start() -> Self {
        Self {
            last: Instant::now(),
            timings: OpenTimings::default(),
        }
    }

    pub(super) fn lap(&mut self, name: &'static str) {
        let now = Instant::now();
        self.timings.phases.push((name, now - self.last));
        self.last = now;
    }

    pub(super) fn finish(self) -> OpenTimings {
        self.timings
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn laps_are_kept_in_order_and_summed_in_the_summary() {
        let mut watch = Stopwatch::start();
        watch.lap("first");
        watch.lap("second");
        let timings = watch.finish();
        let names: Vec<_> = timings.phases.iter().map(|(n, _)| *n).collect();
        assert_eq!(names, ["first", "second"]);
        assert_eq!(timings.total(), timings.phases[0].1 + timings.phases[1].1);
        let line = timings.summary();
        assert!(line.starts_with("opened in "), "{line}");
        assert!(
            line.contains("first ") && line.contains(", second "),
            "{line}"
        );
    }
}
