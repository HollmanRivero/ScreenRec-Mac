@echo off
setlocal
title ScreenRec - Build

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js was not found in PATH.
  echo Install Node.js LTS from https://nodejs.org/ and run this file again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\electron-builder.cmd" (
  echo.
  echo Project dependencies are missing.
  echo Run: npm install
  echo.
  pause
  exit /b 1
)

echo.
echo [1/2] Creating portable preview: dist\win-unpacked\ScreenRec.exe
call "node_modules\.bin\electron-builder.cmd" --win --dir
if errorlevel 1 goto :failed

echo.
echo [2/2] Creating installer EXE in dist\
call "node_modules\.bin\electron-builder.cmd" --win nsis
if errorlevel 1 goto :failed

echo.
echo Build complete.
echo Preview:   dist\win-unpacked\ScreenRec.exe
echo Installer: dist\ScreenRec Setup 1.1.0.exe
echo.
pause
exit /b 0

:failed
echo.
echo Build failed. Read the message above, then try again.
echo.
pause
exit /b 1
