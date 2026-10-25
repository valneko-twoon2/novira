//! `novira-server --data <dir> --dist <dir> [--port N] [--engine] [--open]`: the novira backend on `127.0.0.1` for a web
//! browser. Prints one line, `novira-server: http://127.0.0.1:<port>/?token=<token>`, when it is ready; open that address.
//! The home-network listener (TLS, its own port) stays closed until the page on this computer opens it from the QR item
//! of the side bar, for a phone to pair with.
use novira_core::startup::Refusal;
use novira_server::{Ca, Control, Server};
use std::path::{Path, PathBuf};
use std::process::ExitCode;

const USAGE: &str = "usage: novira-server --data <folder> --dist <folder> [--port <number>] [--engine] [--open]
  --data    the data folder (else the NOVIRA_DATA_DIR variable); one process per folder. There is no default:
            the server never guesses at the data of an installed app
  --dist    the built frontend (frontend/dist)
  --port    the port (default: the port of the last start on this data folder, else a free one)
  --engine  also start the queue worker and the image engine, as the app does (installs ComfyUI on a first run)
  --open    open the printed address in the default browser";

struct Options {
    data: PathBuf,
    dist: PathBuf,
    port: Option<u16>,
    engine: bool,
    open: bool,
}

fn parse(args: impl Iterator<Item = String>, env_data: Option<String>) -> Result<Options, String> {
    let (mut data, mut dist, mut port, mut engine, mut open) = (
        env_data.filter(|d| !d.is_empty()).map(PathBuf::from),
        None,
        None,
        false,
        false,
    );
    let mut args = args;
    while let Some(arg) = args.next() {
        let mut value = |name: &str| args.next().ok_or_else(|| format!("{name} needs a value"));
        match arg.as_str() {
            "--data" => data = Some(PathBuf::from(value("--data")?)),
            "--dist" => dist = Some(PathBuf::from(value("--dist")?)),
            "--port" => {
                port = Some(
                    value("--port")?
                        .parse()
                        .map_err(|_| "--port must be a number from 0 to 65535".to_string())?,
                )
            }
            "--engine" => engine = true,
            "--open" => open = true,
            other => return Err(format!("unknown option: {other}")),
        }
    }
    Ok(Options {
        data: data.ok_or("no data folder: give --data or set NOVIRA_DATA_DIR")?,
        dist: dist.ok_or("no frontend folder: give --dist")?,
        port,
        engine,
        open,
    })
}

/// Where the port of the last start is kept, inside the data folder.
const PORT_FILE: &str = "server-port";

/// The port the last start on this data folder used, if it left one.
fn remembered_port(data: &Path) -> Option<u16> {
    let port: u16 = std::fs::read_to_string(data.join(PORT_FILE))
        .ok()?
        .trim()
        .parse()
        .ok()?;
    (port != 0).then_some(port)
}

/// The browser keeps the page's saved state (drafts, presets, settings) per address, port included, so a port that
/// changed on every start would show an empty page each time. A failure to write it only loses that sameness.
fn remember_port(data: &Path, port: u16) {
    if let Err(e) = std::fs::write(data.join(PORT_FILE), port.to_string()) {
        eprintln!("novira-server: cannot keep the port for the next start: {e}");
    }
}

/// Hands the address to the default browser without going through a shell (the same call as the desktop app's links).
fn open_in_browser(url: &str) -> std::io::Result<()> {
    novira_core::api::browser_command(url).spawn().map(|_| ())
}

/// Lets the page on this computer open the home network (`/lan/*`). It stays closed until then. A failure leaves the
/// server on this computer only.
fn allow_home_network(server: &Server, data: &Path) {
    match Ca::load_or_create(data) {
        Ok(ca) => server.enable_lan(Control::new(
            data.to_path_buf(),
            ca,
            novira_server::system_probe(),
        )),
        Err(e) => eprintln!("novira-server: {e}; only this computer can open the page"),
    }
}

#[tokio::main]
async fn main() -> ExitCode {
    let options = match parse(
        std::env::args().skip(1),
        std::env::var("NOVIRA_DATA_DIR").ok(),
    ) {
        Ok(o) => o,
        Err(e) => {
            eprintln!("novira-server: {e}\n{USAGE}");
            return ExitCode::from(2);
        }
    };
    let data = novira_core::plain_path(options.data.canonicalize().unwrap_or(options.data.clone()));
    let backend = match novira_server::open_backend(&data) {
        Ok(b) => b,
        Err(Refusal::AlreadyRunning) => {
            eprintln!(
                "novira-server: another novira already uses the data folder {}",
                data.display()
            );
            return ExitCode::from(3);
        }
        Err(Refusal::Error(e)) => {
            eprintln!(
                "novira-server: cannot open the data folder {}: {e}",
                data.display()
            );
            return ExitCode::from(1);
        }
    };
    // A port asked for is used as it is. Without one the last port comes back, unless something holds it now.
    let wanted = options.port.or_else(|| remembered_port(&data));
    let mut started =
        novira_server::start(backend.clone(), options.dist.clone(), wanted.unwrap_or(0)).await;
    if started.is_err() && options.port.is_none() && wanted.is_some() {
        eprintln!("novira-server: the port of the last start is taken; using a free one");
        started = novira_server::start(backend.clone(), options.dist, 0).await;
    }
    let server = match started {
        Ok(s) => s,
        Err(e) => {
            eprintln!("novira-server: cannot start: {e}");
            return ExitCode::from(1);
        }
    };
    remember_port(&data, server.port());
    // After the server: it sets the backend's event sink, and the engine's first events (install progress) must reach it.
    if options.engine {
        tokio::spawn(backend.clone().run_worker());
        let engine = backend.clone();
        tokio::spawn(async move { engine.prepare_engine().await });
        let watermark = backend.clone();
        tokio::spawn(async move { watermark.prepare_watermark().await });
    }
    eprintln!("novira-server: data folder {}", data.display());
    println!("novira-server: {}", server.url());
    allow_home_network(&server, &data);
    if options.open {
        if let Err(e) = open_in_browser(&server.url()) {
            eprintln!("novira-server: cannot open the browser: {e}");
        }
    }
    let _ = tokio::signal::ctrl_c().await;
    server.stop().await;
    backend.shutdown();
    novira_core::gpu_lock::release_all();
    ExitCode::SUCCESS
}

#[cfg(test)]
mod tests {
    use super::{parse, remember_port, remembered_port, PORT_FILE};

    fn args(s: &str) -> impl Iterator<Item = String> + '_ {
        s.split_whitespace().map(str::to_string)
    }

    #[test]
    fn the_options_are_read_and_the_data_folder_has_no_default() {
        let o = parse(args("--data d --dist f --port 8123 --engine --open"), None).unwrap();
        assert_eq!(
            (o.port, o.engine, o.open, o.data.to_str(), o.dist.to_str()),
            (Some(8123), true, true, Some("d"), Some("f"))
        );
        let plain = parse(args("--data d --dist f"), None).unwrap();
        assert_eq!((plain.engine, plain.open, plain.port), (false, false, None));
        // The variable is the fallback, and the option wins.
        assert_eq!(
            parse(args("--dist f"), Some("env".into()))
                .unwrap()
                .data
                .to_str(),
            Some("env")
        );
        assert_eq!(
            parse(args("--data d --dist f"), Some("env".into()))
                .unwrap()
                .data
                .to_str(),
            Some("d")
        );
        assert!(parse(args("--dist f"), None).is_err());
        assert!(parse(args("--dist f"), Some(String::new())).is_err());
        assert!(parse(args("--data d"), None).is_err());
        assert!(parse(args("--data d --dist f --port x"), None).is_err());
        assert!(parse(args("--data d --dist f --port 70000"), None).is_err());
        assert!(parse(args("--data d --dist"), None).is_err());
        assert!(parse(args("--data d --dist f --wan"), None).is_err());
        // The home network is opened from the page, not by an option.
        assert!(parse(args("--data d --dist f --lan"), None).is_err());
    }

    #[test]
    fn the_port_of_the_last_start_comes_back() {
        let dir = std::env::temp_dir().join(format!("novira-port-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        assert_eq!(remembered_port(&dir), None);
        remember_port(&dir, 49321);
        assert_eq!(remembered_port(&dir), Some(49321));
        // What is not a usable port is ignored, so a start still gets a free one.
        for bad in ["", "0", "x", "70000", "-1"] {
            std::fs::write(dir.join(PORT_FILE), bad).unwrap();
            assert_eq!(remembered_port(&dir), None, "{bad:?}");
        }
        std::fs::write(
            dir.join(PORT_FILE),
            " 8123
",
        )
        .unwrap();
        assert_eq!(remembered_port(&dir), Some(8123));
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
