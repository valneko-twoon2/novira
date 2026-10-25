@echo off
rem novira dev launcher: runs the app against the Vite dev server (hot reload for the frontend, real backend).
rem Frontend edits show up on save; only Rust edits recompile. Needs tauri-cli (installed on first run).
rem Data stays in novira-data\ in the repository root; what the harness generates (verification data, reports, builds)
rem lives under novira-data\work\ and is pruned when stale (tools/prune-stale.mjs). If novira is already open, close it first (Windows locks the exe).
setlocal
pushd "%~dp0.."
rem Put cargo first: a long PATH gets cut off at its end by cmd.
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"

"%SystemRoot%\System32\tasklist.exe" /FI "IMAGENAME eq novira.exe" 2>nul | "%SystemRoot%\System32\find.exe" /I "novira.exe" >nul
if not errorlevel 1 (
  echo novira is already running. Close it, then run this again.
  goto fail
)

rem Close a dev server left over on port 5173 (a Vite from an earlier run); only a node process is stopped.
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; if ($p -and $p.ProcessName -eq 'node') { Write-Host ('Stopping the old dev server (pid ' + $p.Id + ')'); Stop-Process -Id $p.Id -Force } }"

cargo tauri --version >nul 2>nul
if errorlevel 1 (
  echo Installing tauri-cli, this takes a few minutes...
  cargo install tauri-cli --version "^2" --locked
  if errorlevel 1 goto fail
)

if not exist frontend\node_modules (
  echo Installing frontend packages...
  pushd frontend
  call npm ci
  if errorlevel 1 ( popd & goto fail )
  popd
)

pushd backend\src-tauri
cargo tauri dev
set "CODE=%errorlevel%"
popd
if not "%CODE%"=="0" goto fail
popd
endlocal
exit /b 0

:fail
popd
echo.
pause
endlocal
exit /b 1
