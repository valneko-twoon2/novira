@echo off
rem novira launcher: builds the frontend and the app, then starts backend\target\debug\novira.exe.
rem   scripts\start.bat        build (only what changed), then start
rem   scripts\start.bat fast   start without building
rem Data stays in novira-data\ in the repository root. If novira is already open, close it first (Windows locks the exe).
setlocal
pushd "%~dp0.."
rem Put cargo first: a long PATH gets cut off at its end by cmd.
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"

if /i "%~1"=="fast" goto run

rem The full paths keep a Unix `find` earlier on PATH (Git Bash) from answering instead.
"%SystemRoot%\System32\tasklist.exe" /FI "IMAGENAME eq novira.exe" 2>nul | "%SystemRoot%\System32\find.exe" /I "novira.exe" >nul
if not errorlevel 1 (
  echo novira is already running. Close it, then run this again.
  echo ^(Use "scripts\start.bat fast" only to open it when it is not running.^)
  goto fail
)

rem Close a dev server left over on port 5173 (a Vite from an earlier run); only a node process is stopped.
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; if ($p -and $p.ProcessName -eq 'node') { Write-Host ('Stopping the old dev server (pid ' + $p.Id + ')'); Stop-Process -Id $p.Id -Force } }"

if not exist frontend\node_modules (
  echo Installing frontend packages...
  pushd frontend
  call npm ci
  if errorlevel 1 ( popd & goto fail )
  popd
)

echo Building the frontend...
pushd frontend
call npm run build
if errorlevel 1 ( popd & goto fail )
popd

echo Building the app...
pushd backend
cargo build -p novira
if errorlevel 1 ( popd & goto fail )
popd

:run
if not exist backend\target\debug\novira.exe (
  echo backend\target\debug\novira.exe was not found. Run scripts\start.bat without "fast" to build it.
  goto fail
)
start "" "backend\target\debug\novira.exe"
popd
endlocal
exit /b 0

:fail
popd
echo.
pause
endlocal
exit /b 1
