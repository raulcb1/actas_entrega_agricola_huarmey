' Script VBScript para ejecutar export_excel.ps1
' Este archivo es más silencioso que el .bat tradicional
' Haz doble clic para usarlo

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
strScriptPath = objFSO.GetParentFolderName(WScript.ScriptFullName)
objShell.CurrentDirectory = strScriptPath

' Buscar archivos JSON
Set objFolder = objFSO.GetFolder(strScriptPath)
Set objFiles = objFolder.Files
jsonCount = 0
ReDim jsonFiles(0)

For Each objFile In objFiles
  If InStr(objFile.Name, "acta_entrega_") > 0 And Right(objFile.Name, 5) = ".json" Then
    jsonCount = jsonCount + 1
    ReDim Preserve jsonFiles(jsonCount)
    jsonFiles(jsonCount) = objFile.Name
  End If
Next

If jsonCount = 0 Then
  MsgBox "No se encontraron archivos JSON." & vbCrLf & "Por favor, exporta un registro desde la interfaz web primero.", vbCritical, "Error"
  WScript.Quit 1
End If

If jsonCount = 1 Then
  selectedFile = jsonFiles(1)
Else
  prompt = "Selecciona un archivo JSON:" & vbCrLf & vbCrLf
  For i = 1 To jsonCount
    prompt = prompt & i & ". " & jsonFiles(i) & vbCrLf
  Next
  
  strInput = InputBox(prompt, "Exportar a Excel")
  If strInput = "" Then WScript.Quit
  
  If Not IsNumeric(strInput) Or strInput < 1 Or strInput > jsonCount Then
    MsgBox "Selección inválida", vbCritical, "Error"
    WScript.Quit 1
  End If
  
  selectedFile = jsonFiles(CInt(strInput))
End If

' Pedir nombre de salida
defaultOutput = Left(selectedFile, Len(selectedFile) - 5)
outputFile = InputBox("Nombre del archivo Excel:", "Nombre de salida", defaultOutput)
If outputFile = "" Then WScript.Quit

If LCase(Right(outputFile, 5)) <> ".xlsx" Then
  outputFile = outputFile & ".xlsx"
End If

' Ejecutar PowerShell
strCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File export_excel.ps1 -JsonFile """ & selectedFile & """ -OutputExcel """ & outputFile & """"
objShell.Run strCommand, 1, True

If objFSO.FileExists(outputFile) Then
  result = MsgBox("Excel generado exitosamente: " & outputFile & vbCrLf & vbCrLf & "¿Deseas abrirlo?", vbYesNo, "Éxito")
  If result = vbYes Then
    objShell.Run outputFile, 1, False
  End If
Else
  MsgBox "Error al generar el archivo Excel", vbCritical, "Error"
End If
