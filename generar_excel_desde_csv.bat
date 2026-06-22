@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   Generador de Excel desde historico CSV
echo ========================================
echo.

set "DIR=%~dp0"
cd /d "%DIR%"

if not exist "datos_actas.csv" (
  echo ERROR: No se encontro datos_actas.csv
  echo Exporta el historico desde el sistema o crea el archivo primero.
  echo.
  pause
  exit /b 1
)

echo Registros disponibles:
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Import-Csv '.\datos_actas.csv' | ForEach-Object -Begin { $i=0 } -Process { $i++; '{0}. {1} | {2} | {3} | {4}' -f $i, $_.id, $_.fecha_entrega, $_.usuario_nombre, $_.usuario_dni }"
echo.
set /p "record_id=Ingresa el ID del registro (Enter para usar el mas reciente): "

set "args=-CsvFile .\datos_actas.csv"
if not "!record_id!"=="" set "args=!args! -RecordId !record_id!"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\export_excel.ps1" !args!

if %errorlevel% equ 0 (
  echo.
  echo Excel generado correctamente.
) else (
  echo.
  echo Error al generar el Excel.
)

echo.
pause
