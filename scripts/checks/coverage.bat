@echo off
rem Measures test coverage; nothing is changed in the sources. Reports go to logs\coverage\ (not committed).
rem   frontend: vitest + v8 (statements, branches, functions, lines); fails below the floors in frontend\vitest.config.ts
rem   backend:  cargo llvm-cov for novira-core (lines, functions, regions; stable Rust cannot count branches); fails below 98.2% lines
rem Usage: scripts\checks\coverage.bat            both
rem        scripts\checks\coverage.bat frontend   only the frontend
rem        scripts\checks\coverage.bat backend    only the Rust part; first run installs cargo-llvm-cov (needs rustup)
rem        scripts\checks\coverage.bat e2e        runs the Playwright tests (about 15 minutes) with browser coverage and adds it to the unit figure (lines)
rem        scripts\checks\coverage.bat report     only builds the graphical report from the last runs and opens it
rem Every run ends with one graphical report of all the parts measured so far (ReportGenerator, scripts\tools\coverage-report.mjs):
rem logs\coverage\report\index.html, with the history of earlier runs.
rem The Rust build goes to backend\target\llvm-cov-target, so a running novira.exe is not touched.
setlocal
pushd "%~dp0..\.."
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
set "COV_FAILED="
set "COV_OUT=logs\coverage"

if /i "%~1"=="report" goto :done

if /i "%~1"=="e2e" (
  pushd frontend
  call npm run coverage
  call npm run coverage:e2e
  if errorlevel 1 set "COV_FAILED=%COV_FAILED% [e2e]"
  popd
  goto :done
)

if /i not "%~1"=="backend" (
  pushd frontend
  call npm run coverage
  if errorlevel 1 set "COV_FAILED=%COV_FAILED% [frontend]"
  popd
)

if /i not "%~1"=="frontend" (
  pushd backend
  cargo llvm-cov --version >nul 2>&1
  if errorlevel 1 (
    echo Installing cargo-llvm-cov...
    rustup component add llvm-tools-preview
    cargo install cargo-llvm-cov --locked
  )
  cargo llvm-cov test -p novira-core --ignore-filename-regex "(tests[\/]|_test\.rs$)" --fail-under-lines 98.2 --html --output-dir ..\%COV_OUT%\backend
  if errorlevel 1 set "COV_FAILED=%COV_FAILED% [backend]"
  rem The same measurement as Cobertura XML, for the combined report.
  cargo llvm-cov report -p novira-core --ignore-filename-regex "(tests[\/]|_test\.rs$)" --cobertura --output-path ..\%COV_OUT%\backend\cobertura.xml
  popd
)


:done
echo.
node scripts\tools\coverage-report.mjs --open
if errorlevel 1 set "COV_FAILED=%COV_FAILED% [report]"
if defined COV_FAILED (
  echo FAILED:%COV_FAILED%
  popd
  endlocal
  exit /b 1
)
echo Reports: %COV_OUT%\report\index.html (all parts)  %COV_OUT%\frontend\index.html  %COV_OUT%\backend\html\index.html  %COV_OUT%\e2e\index.html
if exist %COV_OUT%\combined-summary.txt type %COV_OUT%\combined-summary.txt
popd
endlocal
exit /b 0
