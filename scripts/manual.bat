@echo off
rem Builds the user manual (docs\manual\<language>\*.md -> novira-data\work\manual\<language>\: index.html and one page per chapter) and takes its screenshots.
rem   scripts\manual.bat                 take the screenshots of every language, build the pages, open them in the browser
rem   scripts\manual.bat build           build the pages only (the screenshots must have been taken before)
rem   scripts\manual.bat shots           take the screenshots only
rem   scripts\manual.bat shots ja,en     only some languages (also: scripts\manual.bat build ja)
rem Output stays under novira-data\work\ (not committed). The screenshots come from the browser mock, so no engine, GPU or running novira is needed.
setlocal
pushd "%~dp0.."

if not exist frontend\node_modules (
  echo Installing frontend packages...
  pushd frontend
  call npm ci
  if errorlevel 1 ( popd & goto fail )
  popd
)

set "MODE=%~1"
set "LANGS=%~2"
set "LANG_ARG="
if not "%LANGS%"=="" set "LANG_ARG=--locale %LANGS%"

if /i "%MODE%"=="build" goto build
if /i "%MODE%"=="shots" goto shots
if not "%MODE%"=="" (
  echo Unknown option "%MODE%". Use: scripts\manual.bat [build ^| shots] [languages]
  goto fail
)

:shots
echo Taking the screenshots...
node frontend\scripts\manual.mjs shots %LANG_ARG%
if errorlevel 1 goto fail
if /i "%MODE%"=="shots" goto done

:build
echo Building the manual...
set "OPEN_ARG=--open"
if /i "%MODE%"=="build" set "OPEN_ARG="
node frontend\scripts\manual.mjs build %LANG_ARG% %OPEN_ARG%
if errorlevel 1 goto fail

:done
popd
exit /b 0

:fail
popd
exit /b 1
