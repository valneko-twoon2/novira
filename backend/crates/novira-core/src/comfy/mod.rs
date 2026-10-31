//! ComfyUI adapter: graph building, the HTTP/WebSocket client and the owned process.
pub mod client;
#[cfg(test)]
mod gap_tests;
pub mod graph;
#[cfg(test)]
mod graph_snapshots;
#[cfg(test)]
mod graph_snapshots_families;
pub mod install;
pub mod logo;
pub mod music;
#[cfg(test)]
mod node_defs_check;
pub mod node_packs;
pub mod process;
pub mod registry;
pub mod split;
mod switch;
mod tiles;
pub mod ui_locale;
pub mod user_graph;
mod variants;
pub mod video;
mod video_families;

pub use client::ComfyEngine;
