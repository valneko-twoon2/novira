@echo off
rem Runs every fast check of the repository in one go (what CI runs, minus the Playwright tests):
rem   frontend: npm run check (typecheck, lint incl. layer rules, vitest, line ends)
rem   backend:  cargo fmt --check, cargo clippy -D warnings, cargo test for novira-core and the Tauri shell
rem Usage: scripts\check.bat            all of it
rem        scripts\check.bat frontend   only the frontend part
rem        scripts\check.bat backend    only the Rust part
rem Not included: Playwright (npm run e2e, slow) and the ignored live tests. Each step runs even when an earlier one
rem failed; the exit code is 1 when any failed.
rem cargo test -p novira builds backend\target\debug\novira.exe; while novira is open Windows locks that file, so then the
rem Rust checks build into novira-data\work\check-target instead (unless CARGO_TARGET_DIR is already set).
rem For only the checks a change needs, use node tools\affected.mjs instead.
setlocal EnableDelayedExpansion
pushd "%~dp0.."
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
rem Delete stale harness output under novira-data\work\ first (never fails the checks).
node tools\prune-stale.mjs >nul 2>nul
if not defined CARGO_TARGET_DIR if exist backend\target\debug\novira.exe (
  node -e "const f=require('fs');try{f.closeSync(f.openSync(process.argv[1],'r+'))}catch{process.exit(1)}" backend\target\debug\novira.exe || (
    set "CARGO_TARGET_DIR=%CD%\novira-data\work\check-target"
    echo novira.exe is open, so the Rust checks build into !CARGO_TARGET_DIR!
  )
)
set "CHECK_FAILED="
set "CHECK_PART=%~1"

if /i not "%CHECK_PART%"=="backend" (
  if not exist frontend\node_modules (
    echo Installing frontend packages...
    pushd frontend
    call npm ci
    popd
  )
  pushd frontend
  call :step "frontend: npm run check" npm run check
  popd
)

if /i not "%CHECK_PART%"=="frontend" (
  pushd backend
  call :step "cargo fmt --check" cargo fmt --all -- --check
  call :step "cargo clippy novira-core" cargo clippy -p novira-core --tests -- -D warnings
  call :step "cargo test novira-core" cargo test -p novira-core
  call :step "cargo test novira" cargo test -p novira
  popd
)

echo.
if defined CHECK_FAILED (
  echo FAILED:!CHECK_FAILED!
  popd
  endlocal
  exit /b 1
)
echo All checks passed.
popd
endlocal
exit /b 0

rem Runs one check and prints how long it took. %1 = label, the rest = the command.
rem Variables are prefixed CHECK_: a plain RC would be read by the Windows resource compiler lookup of the Tauri build.
:step
set "CHECK_LABEL=%~1"
shift
set "CHECK_CMD="
:collect
if "%~1"=="" goto run
set "CHECK_CMD=!CHECK_CMD! %1"
shift
goto collect
:run
echo.
echo === !CHECK_LABEL! ===
set "CHECK_T0=%time%"
call !CHECK_CMD!
set "CHECK_RC=!errorlevel!"
echo --- !CHECK_LABEL!: exit !CHECK_RC! (started !CHECK_T0!, finished %time%)
if not "!CHECK_RC!"=="0" set "CHECK_FAILED=!CHECK_FAILED! [!CHECK_LABEL!]"
exit /b 0
