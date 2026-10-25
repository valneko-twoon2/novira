// The app's version, from package.json (kept equal to the Rust crates' version by a test in backend/src-tauri).
import pkg from '../../package.json';

export const APP_VERSION: string = pkg.version;
