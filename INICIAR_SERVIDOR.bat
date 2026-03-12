@echo off
echo ========================================
echo   TEMPORALIZADOR SINCRONIZADO - INDABI
echo ========================================
echo.
echo Iniciando servidor...
echo.

cd /d "%~dp0"

REM Verificar si Node.js está instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js no está instalado
    echo Por favor instala Node.js desde: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Verificar si las dependencias están instaladas
if not exist "node_modules" (
    echo Instalando dependencias por primera vez...
    echo Esto puede tardar un minuto...
    echo.
    call npm install
    echo.
    echo Dependencias instaladas!
    echo.
)

echo Servidor listo!
echo.
echo Abre tu navegador en: http://localhost:3000
echo Desde otras PCs: http://[IP-DE-ESTA-PC]:3000
echo.
echo Presiona Ctrl+C para detener el servidor
echo ========================================
echo.

node server.js

pause
