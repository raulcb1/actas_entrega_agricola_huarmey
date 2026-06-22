# Actas de Entrega

Sistema local para registrar, consultar, visualizar e imprimir actas de entrega de equipos.

## Flujo principal

1. Abre `index.html`.
2. Entra a `registrar.html` desde el menu.
3. Carga o actualiza `datos_actas.csv` con el boton **Abrir datos_actas.csv**.
4. Registra el acta y guarda.
5. Entra a `buscar.html` para consultar el historico.
6. Abre un acta en `visualizar.html` para imprimirla.

## Historico

El archivo maestro del sistema es `datos_actas.csv`.

- Si el navegador permite acceso a archivos locales, primero abre `datos_actas.csv` desde el boton de la app.
- Si el navegador no permite escritura directa, usa **Exportar CSV** despues de guardar cambios.
- El sistema mantiene una copia temporal en el navegador como respaldo, pero el archivo portable es el CSV.

## Impresion y Excel

Opciones disponibles:

- **Imprimir directo:** desde `visualizar.html`, presiona **Imprimir**.
- **Excel desde CSV:** ejecuta `generar_excel_desde_csv.bat`.
- **Excel desde JSON:** descarga JSON desde `visualizar.html` y ejecuta `generar_excel.vbs` o `generar_excel.bat`.

El Excel generado copia `formato_ae.xlsx` y solo rellena las celdas editables. Las zonas `B2:M5` y `B32:M44` quedan intactas.

## Archivos

| Archivo | Uso |
| --- | --- |
| `index.html` | Menu principal |
| `registrar.html` | Registro y edicion de actas |
| `buscar.html` | Busqueda y reportes |
| `visualizar.html` | Vista imprimible |
| `app.js` | Logica del sistema |
| `styles.css` | Estilos e impresion |
| `datos_actas.csv` | Historico maestro |
| `formato_ae.xlsx` | Plantilla Excel original |
| `export_excel.ps1` | Generador de Excel desde JSON o CSV |
| `generar_excel_desde_csv.bat` | Generador rapido desde historico CSV |
| `generar_excel.vbs` / `generar_excel.bat` | Generadores desde JSON |

## Notas

- No requiere instalar Node, Python ni paquetes externos.
- Para generar Excel se necesita Microsoft Excel instalado.
- En equipos con politicas de dominio, el navegador puede pedir permiso antes de leer o escribir `datos_actas.csv`.
