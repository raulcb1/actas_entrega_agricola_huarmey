Param(
  [Parameter(Mandatory=$false)]
  [string]$JsonFile = "",

  [Parameter(Mandatory=$false)]
  [string]$CsvFile = "",

  [Parameter(Mandatory=$false)]
  [string]$RecordId = "",

  [Parameter(Mandatory=$false)]
  [string]$OutputExcel = ""
)

function Get-Value {
  Param(
    [object]$Object,
    [string]$Name
  )

  if ($null -eq $Object) {
    return ""
  }

  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property -or $null -eq $property.Value) {
    return ""
  }

  return [string]$property.Value
}

function Find-OldItem {
  Param(
    [object[]]$Items,
    [string]$Type
  )

  if (-not $Items) {
    return $null
  }

  foreach ($item in $Items) {
    $tipo = (Get-Value $item "tipo").ToLowerInvariant()
    if ($tipo.Contains($Type)) {
      return $item
    }
  }

  return $null
}

function Set-Cell {
  Param(
    [object]$Worksheet,
    [string]$Address,
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return
  }

  $cell = $Worksheet.Range($Address)
  $cell.NumberFormat = "@"
  $cell.Value2 = $Value
}

function Format-DateText {
  Param([string]$Value)

  if ($Value -match '^(\d{4})-(\d{2})-(\d{2})$') {
    return "$($Matches[3])/$($Matches[2])/$($Matches[1])"
  }

  return $Value
}

if ([string]::IsNullOrWhiteSpace($JsonFile) -and [string]::IsNullOrWhiteSpace($CsvFile)) {
  if (Test-Path "datos_actas.csv") {
    $CsvFile = "datos_actas.csv"
  } else {
    Write-Error "Indica -JsonFile o -CsvFile."
    exit 1
  }
}

if (-not [string]::IsNullOrWhiteSpace($CsvFile)) {
  if (-not (Test-Path $CsvFile)) {
    Write-Error "No se encontro el archivo CSV: $CsvFile"
    exit 1
  }

  try {
    $rows = @(Import-Csv -Path $CsvFile -Encoding UTF8)
  } catch {
    Write-Error "Error leyendo CSV: $_"
    exit 1
  }

  if ($rows.Count -eq 0) {
    Write-Error "El archivo CSV no contiene registros."
    exit 1
  }

  if (-not [string]::IsNullOrWhiteSpace($RecordId)) {
    $selected = $rows | Where-Object { $_.id -eq $RecordId } | Select-Object -First 1
  } else {
    $selected = $rows | Sort-Object createdAt -Descending | Select-Object -First 1
  }

  if ($null -eq $selected) {
    Write-Error "No se encontro el registro solicitado en el CSV."
    exit 1
  }

  $json = [PSCustomObject]@{
    id = $selected.id
    createdAt = $selected.createdAt
    usuario_nombre = $selected.usuario_nombre
    usuario_dni = $selected.usuario_dni
    usuario_puesto = $selected.usuario_puesto
    fecha_entrega = $selected.fecha_entrega
    equipos = [PSCustomObject]@{
      chip = [PSCustomObject]@{
        numero = $selected.chip_numero
      }
      radio = [PSCustomObject]@{
        marca = $selected.radio_marca
        modelo = $selected.radio_modelo
        serie = $selected.radio_serie
        obs = $selected.radio_obs
      }
      celular = [PSCustomObject]@{
        marca = $selected.celular_marca
        modelo = $selected.celular_modelo
        imei = $selected.celular_imei
        obs = $selected.celular_obs
      }
      laptop = [PSCustomObject]@{
        marca = $selected.laptop_marca
        modelo = $selected.laptop_modelo
        serie = $selected.laptop_serie
        obs = $selected.laptop_obs
      }
    }
    observaciones = $selected.observaciones
  }
  $sourceBaseName = if ($json.id) { "acta_entrega_$($json.id)" } else { [IO.Path]::GetFileNameWithoutExtension($CsvFile) }
} else {
  if (-not (Test-Path $JsonFile)) {
    Write-Error "No se encontro el archivo JSON: $JsonFile"
    exit 1
  }

  try {
    $json = Get-Content -Path $JsonFile -Raw -Encoding UTF8 | ConvertFrom-Json
  } catch {
    Write-Error "Error leyendo JSON: $_"
    exit 1
  }
  $sourceBaseName = [IO.Path]::GetFileNameWithoutExtension($JsonFile)
}

if ([string]::IsNullOrWhiteSpace($OutputExcel)) {
  $OutputExcel = "$sourceBaseName.xlsx"
} elseif ([IO.Path]::GetExtension($OutputExcel) -eq "") {
  $OutputExcel = "$OutputExcel.xlsx"
}

if (-not [IO.Path]::IsPathRooted($OutputExcel)) {
  $OutputExcel = Join-Path -Path (Get-Location) -ChildPath $OutputExcel
}

$sourceFile = Join-Path -Path (Get-Location) -ChildPath "formato_ae.xlsx"
if (-not (Test-Path $sourceFile)) {
  Write-Error "No se encontro el archivo plantilla: $sourceFile"
  exit 1
}

Copy-Item -Path $sourceFile -Destination $OutputExcel -Force

$equipos = $json.equipos
if ($null -eq $equipos) {
  $chipItem = Find-OldItem $json.items "chip"
  $radioItem = Find-OldItem $json.items "radio"
  $celularItem = Find-OldItem $json.items "celular"
  $laptopItem = Find-OldItem $json.items "laptop"

  $equipos = [PSCustomObject]@{
    chip = [PSCustomObject]@{
      numero = Get-Value $chipItem "numero"
    }
    radio = [PSCustomObject]@{
      marca = Get-Value $radioItem "marca"
      modelo = Get-Value $radioItem "modelo"
      serie = if (Get-Value $radioItem "serie") { Get-Value $radioItem "serie" } else { Get-Value $radioItem "numero" }
      obs = Get-Value $radioItem "obs"
    }
    celular = [PSCustomObject]@{
      marca = Get-Value $celularItem "marca"
      modelo = Get-Value $celularItem "modelo"
      imei = Get-Value $celularItem "imei"
      obs = Get-Value $celularItem "obs"
    }
    laptop = [PSCustomObject]@{
      marca = Get-Value $laptopItem "marca"
      modelo = Get-Value $laptopItem "modelo"
      serie = if (Get-Value $laptopItem "serie") { Get-Value $laptopItem "serie" } else { Get-Value $laptopItem "numero" }
      obs = Get-Value $laptopItem "obs"
    }
  }
}

$excel = $null
$wb = $null
$ws = $null

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false

  $wb = $excel.Workbooks.Open($OutputExcel)
  $ws = $wb.Worksheets.Item(1)

  Set-Cell $ws "C7" (Format-DateText (Get-Value $json "fecha_entrega"))

  $usuarioNombre = Get-Value $json "usuario_nombre"
  $usuarioDni = Get-Value $json "usuario_dni"
  $usuarioPuesto = Get-Value $json "usuario_puesto"
  if ($usuarioNombre -or $usuarioDni) {
    Set-Cell $ws "B9" "Por medio del presente documento, al Sr. (a): $usuarioNombre con DNI: $usuarioDni,"
  }
  if ($usuarioPuesto) {
    Set-Cell $ws "B11" " quien nos representa en la compania en el puesto de $usuarioPuesto se genera la entrega de lo siguiente."
  }

  Set-Cell $ws "C16" (Get-Value $equipos.chip "numero")

  Set-Cell $ws "C22" (Get-Value $equipos.radio "marca")
  Set-Cell $ws "C24" (Get-Value $equipos.radio "modelo")
  Set-Cell $ws "C26" (Get-Value $equipos.radio "serie")
  Set-Cell $ws "C28" (Get-Value $equipos.radio "obs")

  Set-Cell $ws "G16" (Get-Value $equipos.celular "marca")
  Set-Cell $ws "G18" (Get-Value $equipos.celular "modelo")
  Set-Cell $ws "G20" (Get-Value $equipos.celular "imei")
  Set-Cell $ws "G22" (Get-Value $equipos.celular "obs")

  Set-Cell $ws "M16" (Get-Value $equipos.laptop "marca")
  Set-Cell $ws "M18" (Get-Value $equipos.laptop "modelo")
  Set-Cell $ws "M20" (Get-Value $equipos.laptop "serie")
  Set-Cell $ws "M22" (Get-Value $equipos.laptop "obs")

  Set-Cell $ws "F25" (Get-Value $json "observaciones")

  $wb.Save()
  $wb.Close($false)
  $excel.Quit()

  Write-Host "Excel generado exitosamente: $OutputExcel"
  exit 0
} catch {
  Write-Error "Error al procesar Excel: $_"
  try { if ($wb) { $wb.Close($false) } } catch {}
  try { if ($excel) { $excel.Quit() } } catch {}
  exit 1
} finally {
  if ($ws) { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($ws) | Out-Null }
  if ($wb) { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($wb) | Out-Null }
  if ($excel) { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null }
}
