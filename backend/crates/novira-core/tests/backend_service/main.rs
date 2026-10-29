//! Backend service with a fake engine: queue lifecycle, saved results, persistence across restarts, models.
//! One test binary; each module covers one area and shares fixtures from `common`.

#[path = "../fake_site/mod.rs"]
mod fake_site;

mod api;
mod api_commands;
mod assistant;
mod assistant_endpoint;
mod backup;
mod backup_failures;
mod comics;
mod common;
mod damaged_database;
mod export_checks;
mod gallery;
mod graph;
mod guidance;
mod guidance_failures;
mod guidance_mutation;
mod keys_failures;
mod low_memory_off;
mod media;
mod memory;
mod models;
mod models_without_comfy;
mod node_pack_net;
mod queue;
mod settings;
mod worker;
mod worker_paths;
mod worker_split;
mod worker_video;
