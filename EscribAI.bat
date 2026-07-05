@echo off
rem ============================================================
rem  EscribAI - Lanzador para Windows
rem  Doble clic para abrir la app en modo aplicacion (ventana propia)
rem ============================================================
title EscribAI
cd /d "%~dp0"

set "NAV="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "NAV=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "NAV=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "NAV=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "NAV=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined NAV if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "NAV=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if not defined NAV (
  echo [ERROR] No se encontro Google Chrome ni Microsoft Edge.
  echo Instala Chrome desde https://google.com/chrome y vuelve a ejecutar.
  pause
  exit /b 1
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo Iniciando EscribAI en http://localhost:8765 ...
  start "EscribAI Server" /min cmd /c "python -m http.server 8765 --bind 127.0.0.1"
  timeout /t 2 /nobreak >nul
  start "" "%NAV%" --app=http://127.0.0.1:8765/index.html
  echo.
  echo EscribAI esta abierto. Cierra esta ventana para detener el servidor.
  pause >nul
  taskkill /fi "WINDOWTITLE eq EscribAI Server*" /f >nul 2>nul
) else (
  echo Abriendo EscribAI...
  start "" "%NAV%" --app="file:///%~dp0index.html"
)
exit /b 0
