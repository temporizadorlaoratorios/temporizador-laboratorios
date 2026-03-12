@echo off
echo ========================================
echo   REINICIANDO SERVIDOR...
echo ========================================
echo.

echo 1. Deteniendo procesos anteriores...
taskkill /F /IM node.exe >nul 2>&1
echo Procesos detenidos.
echo.

echo 2. Iniciando servidor nuevamente...
echo.

cd /d "%~dp0"
node server.js

pause
