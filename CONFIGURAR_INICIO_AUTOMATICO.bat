@echo off
REM Script para configurar inicio automático del servidor
echo ========================================
echo   CONFIGURAR INICIO AUTOMATICO
echo ========================================
echo.

REM Crear tarea programada de Windows
schtasks /create /tn "Temporalizador INDABI" /tr "%~dp0INICIAR_SERVIDOR_OCULTO.vbs" /sc onlogon /rl highest /f

if %errorlevel% equ 0 (
    echo.
    echo ✅ Tarea creada exitosamente!
    echo.
    echo El servidor se iniciará automáticamente cuando inicies sesión.
    echo.
    echo Para DESACTIVAR el inicio automático, ejecuta:
    echo schtasks /delete /tn "Temporalizador INDABI" /f
    echo.
) else (
    echo.
    echo ❌ Error al crear la tarea
    echo Asegúrate de ejecutar este script como Administrador
    echo (Click derecho -^> Ejecutar como administrador)
    echo.
)

pause
