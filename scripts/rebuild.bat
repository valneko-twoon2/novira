@echo off
rem novira clean rebuild: rebuilds the frontend and the app from scratch, then starts backend\target\debug\novira.exe.
rem Use it when the app looks broken although the sources are fine (for example the screen shows unstyled HTML):
rem the app's own build output, including the compressed copies of the screens that Tauri keeps between builds, is
rem thrown away and made again. Dependencies stay built, so this takes a few minutes, not a full build.
rem   scripts\rebuild.bat        clean the app crate only, then build and start
rem   scripts\rebuild.bat full   clean the whole backend\target (every dependency is built again; slow)
rem If novira is open, close it first (Windows locks the exe).
setlocal
pushd "%~dp0.."
rem Put cargo first: a long PATH gets cut off at its end by cmd.
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"

rem The full paths keep a Unix `find` earlier on PATH (Git Bash) from answering instead.
"%SystemRoot%\System32\tasklist.exe" /FI "IMAGENAME eq novira.exe" 2>nul | "%SystemRoot%\System32\find.exe" /I "novira.exe" >nul
if not errorlevel 1 (
  echo novira is running. Close it, then run this again.
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
if exist dist rmdir /s /q dist
call npm run build
if errorlevel 1 ( popd & goto fail )
popd

pushd backend
if /i "%~1"=="full" (
  echo Cleaning the whole backend build...
  cargo clean
) else (
  echo Cleaning the app's build output...
  cargo clean -p novira
)
if errorlevel 1 ( popd & goto fail )

echo Building the app...
cargo build -p novira
if errorlevel 1 ( popd & goto fail )
popd

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
