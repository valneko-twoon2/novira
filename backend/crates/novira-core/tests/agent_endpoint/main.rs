//! The assistant on an OpenAI-compatible server, against a fake server on a loopback port: the app's own
//! tool loop (`loop_run`) and the connection with its limits and its key (`connection`). The backend's side (saving the
//! server, the status, a request through `Backend`) is in `backend_service/assistant_endpoint.rs`.
mod connection;
mod loop_run;
mod server;
