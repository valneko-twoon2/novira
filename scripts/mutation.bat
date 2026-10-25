@echo off
rem Mutation testing: changes the code a little (a mutant), runs the tests, and reports mutants the tests did not notice.
rem It takes hours, so it is NOT part of scripts\check.bat or CI. Nothing in the sources is changed; reports go to novira-data\work\mutation\ (not committed).
rem   rust:     cargo-mutants on backend\crates\novira-core with backend\.cargo\mutants.toml. Mutants run in a temporary copy of the
rem             repository, so target\ and a running novira.exe are not touched. First run installs cargo-mutants.
rem Usage: scripts\mutation.bat rust                              the whole crate (about a day; prefer one file at a time)
rem        scripts\mutation.bat rust -- -f crates\novira-core\src\settings.rs     one file
rem        scripts\mutation.bat rust -- --shard 1/8               one eighth of the mutants (shards run on different days)
rem Extra arguments after "--" are passed on to the tool of the chosen part. At most two jobs run at once (the machine is shared).
setlocal
pushd "%~dp0.."
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
set "MUT_PART=%~1"
set "MUT_EXTRA="
set "MUT_FAILED="

rem Collect the arguments after "--".
shift
:collect
if "%~1"=="" goto :collected
if "%~1"=="--" (shift & goto :collect)
set "MUT_EXTRA=%MUT_EXTRA% %1"
shift
goto :collect
:collected

if /i "%MUT_PART%"=="rust" goto :rust
echo Usage: scripts\mutation.bat [rust] [-- extra arguments]
popd
endlocal
exit /b 2

:rust
pushd backend
cargo mutants --version >nul 2>&1
if errorlevel 1 (
  echo Installing cargo-mutants...
  cargo install cargo-mutants --locked
)
cargo mutants -p novira-core --jobs 2 -o ..\novira-data\work\mutation\rust %MUT_EXTRA%
popd
rem Exit code 2 means some mutants were missed, 3 means timeouts; both are findings, not failures of the run.
if errorlevel 4 set "MUT_FAILED=%MUT_FAILED% [rust]"
goto :done

:done
echo.
if defined MUT_FAILED (
  echo FAILED:%MUT_FAILED%
  popd
  endlocal
  exit /b 1
)
echo Reports: novira-data\work\mutation\rust\mutants.out\outcomes.json  (missed.txt, caught.txt, timeout.txt, unviable.txt)
popd
endlocal
exit /b 0
