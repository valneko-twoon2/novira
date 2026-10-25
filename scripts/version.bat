@echo off
rem Sets the app's version in every file that holds it (backend\Cargo.toml, frontend\package.json and both lock files).
rem   scripts\version.bat           show the version now and ask for the new one
rem   scripts\version.bat 0.2.0     set it (0.2.0-beta.1 is fine too)
rem Nothing is committed: look at git diff, then commit.
setlocal
pushd "%~dp0.."
rem Put cargo first: a long PATH gets cut off at its end by cmd.
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
node tools\set-version.mjs %*
set "RESULT=%errorlevel%"
popd
endlocal & exit /b %RESULT%
