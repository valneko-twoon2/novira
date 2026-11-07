@echo off
rem The whole test suite in one run, started by hand (there is no CI): scripts\check.bat plus the browser server tests,
rem every Playwright project and the layout scan; the report goes to logs\full-check\. Takes about half an hour.
rem Usage: scripts\checks\full-check.bat [--no-browser]      (see scripts\tools\full-check.mjs)
setlocal
pushd "%~dp0..\.."
node scripts\tools\full-check.mjs %*
set "FULL_CHECK_EXIT=%ERRORLEVEL%"
popd
endlocal & exit /b %FULL_CHECK_EXIT%
