@echo off
rem novira browser server launcher: starts only the server (no app window) and opens the page in the default browser.
rem   scripts\server.bat        build the frontend and the server (npm and cargo only redo what changed), then start with the image engine
rem   scripts\server.bat fast   start without building
rem The server listens on 127.0.0.1 only; the home network (a phone on the same Wi-Fi) opens from the QR item of the page
rem it shows. The address it prints carries this start's token. Ctrl-C stops it.
rem Data stays in novira-data\ in the repository root, the folder the app uses: close novira first (one process per folder).
setlocal
pushd "%~dp0.."
rem Put cargo first: a long PATH gets cut off at its end by cmd.
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"

set "FAST="
for %%a in (%*) do (
  if /i "%%~a"=="fast" set "FAST=1"
)
if defined FAST goto run

rem The full paths keep a Unix `find` earlier on PATH (Git Bash) from answering instead.
"%SystemRoot%\System32\tasklist.exe" /FI "IMAGENAME eq novira.exe" 2>nul | "%SystemRoot%\System32\find.exe" /I "novira.exe" >nul
if not errorlevel 1 (
  echo novira is running and holds the data folder. Close it, then run this again.
  goto fail
)

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

echo Building the server...
pushd backend
cargo build -p novira-server
if errorlevel 1 ( popd & goto fail )
popd

:run
if not exist backend\target\debug\novira-server.exe (
  echo backend\target\debug\novira-server.exe was not found. Run scripts\server.bat without "fast" to build it.
  goto fail
)
if not exist frontend\dist\index.html (
  echo frontend\dist was not found. Run scripts\server.bat without "fast" to build it.
  goto fail
)
"backend\target\debug\novira-server.exe" --data "%CD%\novira-data" --dist "%CD%\frontend\dist" --engine --open
if errorlevel 1 goto fail
popd
endlocal
exit /b 0

:fail
popd
echo.
pause
endlocal
exit /b 1
