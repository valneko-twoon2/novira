@echo off
rem novira release build: puts the release programs into artifacts\ in the repository root (git-ignored).
rem   scripts\release.bat             build in release mode -> artifacts\novira.exe (the app) and, for a plain web
rem                                   browser, artifacts\novira-server.exe, artifacts\dist\ (the screens it serves)
rem                                   and artifacts\server.bat (starts the server on the data folder next to the exe)
rem The first release build takes a few minutes. Close a running exe in artifacts first (Windows locks it).
setlocal
pushd "%~dp0.."
rem Put cargo first: a long PATH gets cut off at its end by cmd.
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"

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

echo Building the app and the server in release mode...
pushd backend
cargo build -p novira -p novira-server --release
if errorlevel 1 ( popd & goto fail )
popd

if not exist artifacts mkdir artifacts
copy /Y backend\target\release\novira.exe artifacts\novira.exe >nul
if errorlevel 1 (
  echo Could not write artifacts\novira.exe. If it is running, close it and run this again.
  goto fail
)
copy /Y backend\target\release\novira-server.exe artifacts\novira-server.exe >nul
if errorlevel 1 (
  echo Could not write artifacts\novira-server.exe. If it is running, close it and run this again.
  goto fail
)
rem The server serves the built screens from a folder next to it; start from a clean copy so no old file stays.
if exist artifacts\dist rmdir /S /Q artifacts\dist
xcopy /E /I /Y /Q frontend\dist artifacts\dist >nul
if errorlevel 1 (
  echo Could not copy frontend\dist to artifacts\dist.
  goto fail
)
rem artifacts\server.bat is written here: it starts the server of a release folder (data folder next to the exe).
> artifacts\server.bat echo @echo off
>> artifacts\server.bat echo rem novira browser server, from the release folder: starts novira-server.exe on the data folder next to it ^(the one
>> artifacts\server.bat echo rem novira.exe uses^) with the image engine, and opens the page in the default browser. Ctrl-C stops it.
>> artifacts\server.bat echo rem The server listens on 127.0.0.1 only; the home network ^(a phone on the same Wi-Fi^) opens from the QR item of its page.
>> artifacts\server.bat echo rem The address it prints carries this start's token.
>> artifacts\server.bat echo rem Close novira ^(novira.exe^) first: only one program can hold the data folder.
>> artifacts\server.bat echo setlocal
>> artifacts\server.bat echo if not exist "%%~dp0novira-server.exe" ^(
>> artifacts\server.bat echo   echo novira-server.exe was not found next to this file.
>> artifacts\server.bat echo   goto fail
>> artifacts\server.bat echo ^)
>> artifacts\server.bat echo if not exist "%%~dp0dist\index.html" ^(
>> artifacts\server.bat echo   echo The folder dist was not found next to this file.
>> artifacts\server.bat echo   goto fail
>> artifacts\server.bat echo ^)
>> artifacts\server.bat echo "%%~dp0novira-server.exe" --data "%%~dp0novira-data" --dist "%%~dp0dist" --engine --open
>> artifacts\server.bat echo if errorlevel 1 goto fail
>> artifacts\server.bat echo endlocal
>> artifacts\server.bat echo exit /b 0
>> artifacts\server.bat echo.
>> artifacts\server.bat echo :fail
>> artifacts\server.bat echo echo.
>> artifacts\server.bat echo pause
>> artifacts\server.bat echo endlocal
>> artifacts\server.bat echo exit /b 1
if errorlevel 1 (
  echo Could not write artifacts\server.bat.
  goto fail
)

echo.
echo Done. The files are in %CD%\artifacts
popd
endlocal
exit /b 0

:fail
popd
echo.
pause
endlocal
exit /b 1
