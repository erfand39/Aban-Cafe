@echo off
chcp 65001 >nul
title Cafe Aban - Local Offline App
cd /d "%~dp0"

echo ==================================================
echo   Cafe Aban - Local Management System (Python)
echo ==================================================
echo.

set "PY_CMD="
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 --version >nul 2>nul
  if %errorlevel% equ 0 set "PY_CMD=py -3"
)

if "%PY_CMD%"=="" (
  where python >nul 2>nul
  if %errorlevel% equ 0 set "PY_CMD=python"
)

if "%PY_CMD%"=="" (
  where python3 >nul 2>nul
  if %errorlevel% equ 0 set "PY_CMD=python3"
)

if "%PY_CMD%"=="" (
  echo [ERROR] Python 3 is not installed on this computer.
  echo Please install Python 3 from https://www.python.org/downloads/
  echo Make sure to check "Add Python to PATH" during installation.
  pause
  exit /b 1
)

if not exist "dist\index.html" (
  echo [ERROR] Built UI folder "dist" was not found.
  echo Please make sure the complete Cafe Aban folder was extracted properly.
  pause
  exit /b 1
)

echo Database path: %~dp0data\cafe-aban.db
echo Starting Cafe Aban locally...
%PY_CMD% cafe_aban_server.py
pause
