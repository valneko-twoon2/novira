//! Gives `novira-server.exe` a Windows version resource (description, product name, versions, icon) like the one
//! tauri-build gives the app, so the file's properties read the same. The versions come from the workspace version.

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=../../src-tauri/icons/icon.ico");
    #[cfg(windows)]
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        let mut res = tauri_winres::WindowsResource::new();
        // The app's product name (`productName` in tauri.conf.json), so both files belong to the same product.
        res.set("ProductName", "novira")
            .set("FileDescription", "novira-server")
            .set("OriginalFilename", "novira-server.exe")
            .set_icon("../../src-tauri/icons/icon.ico");
        // Only the program: the test binaries need no resource.
        res.compile_for(&["novira-server"])
            .expect("failed to embed the Windows version resource");
    }
}
