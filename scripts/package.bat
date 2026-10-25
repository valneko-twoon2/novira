@echo off
rem Packs artifacts\ (made by release.bat) into artifacts\novira-VERSION-windows-x64.zip, with its SHA-256 file, for a release page.
rem Run scripts\release.bat first. The zip holds the programs and the licence texts only, never artifacts\novira-data.
setlocal
pushd "%~dp0.."
node tools\package-release.mjs
set "RESULT=%errorlevel%"
if not "%RESULT%"=="0" pause
popd
endlocal & exit /b %RESULT%
