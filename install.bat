@echo off
setlocal
title Project Session Manager Installer
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
if errorlevel 1 (
  echo.
  echo Installation did not complete successfully.
  pause
  exit /b 1
)
echo.
pause
