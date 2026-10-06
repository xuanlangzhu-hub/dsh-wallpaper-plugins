@echo off
rem Runs the Cordis contract check with the official Desktop node runtime.
rem The export may be unavailable, so ELECTRON_RUN_AS_NODE is set explicitly; no
rem duplicate --expose-internals is added.
setlocal DisableDelayedExpansion
set "ELECTRON_RUN_AS_NODE=1"
"C:\Users\HP\AppData\Local\Programs\DeepSeek Harness\DeepSeek Harness.exe" "%~dp0sdk-contract.mjs"
exit /b %errorlevel%
