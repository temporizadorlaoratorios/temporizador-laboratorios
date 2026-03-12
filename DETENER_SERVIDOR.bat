@echo off
echo Buscando y deteniendo procesos de Node.js...
taskkill /F /IM node.exe
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] No se pudo detener el proceso.
    echo Es posible que necesites permisos de ADMINISTRADOR.
    echo.
    echo Por favor:
    echo 1. Cierra esta ventana.
    echo 2. Haz CLIC DERECHO en este archivo.
    echo 3. Selecciona "Ejecutar como administrador".
) else (
    echo.
    echo [EXITO] Todos los procesos de Node.js han sido detenidos.
)
pause
