@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   Generador de Excel - Acta de Entrega
echo ========================================
echo.

REM Obtener el directorio actual
set "DIR=%~dp0"
cd /d "%DIR%"

REM Buscar archivos JSON en el directorio
setlocal enabledelayedexpansion
set "count=0"
for %%F in (acta_entrega_*.json) do (
  set /a count+=1
  set "file[!count!]=%%F"
  echo !count!. %%F
)

if %count% equ 0 (
  echo.
  echo ERROR: No se encontraron archivos JSON con el patrón 'acta_entrega_*.json'
  echo Asegúrate de exportar un registro desde la interfaz web primero.
  echo.
  pause
  exit /b 1
)

if %count% equ 1 (
  set "selected_file=!file[1]!"
  echo.
  echo Se seleccionó: !selected_file!
) else (
  echo.
  set /p "choice=Selecciona el número del archivo ^(1-%count%^): "
  
  if not defined file[!choice!] (
    echo ERROR: Selección inválida
    pause
    exit /b 1
  )
  set "selected_file=!file[%choice%]!"
)

echo.
set "output_file=!selected_file:.json=.xlsx!"
echo Nombre de archivo Excel de salida (por defecto: !output_file!):
set /p "user_output=Ingresa el nombre ^(o presiona Enter^): "
if not "!user_output!"=="" set "output_file=!user_output!"
if /i not "!output_file:~-5!"==".xlsx" set "output_file=!output_file!.xlsx"

echo.
echo Generando Excel desde: !selected_file!
echo Guardando como: !output_file!
echo.

REM Ejecutar el script PowerShell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\export_excel.ps1" -JsonFile "!selected_file!" -OutputExcel "!output_file!"

if %errorlevel% equ 0 (
  echo.
  echo ✓ Excel generado exitosamente: !output_file!
  echo.
  REM Preguntar si abrir el archivo
  set /p "open_file=¿Deseas abrir el archivo? (s/n): "
  if /i "!open_file!"=="s" (
    start "" "!output_file!"
  )
) else (
  echo.
  echo ✗ Error al generar el archivo Excel
  echo.
)

pause
