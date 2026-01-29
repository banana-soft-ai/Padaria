' Inicia o serviço de impressão local sem mostrar janela (para usar na Inicialização do Windows)
Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = scriptDir & "\start-impressao-local.bat"
' Executa oculto (0) para não mostrar janela; False = não esperar término
WshShell.Run "cmd /c """ & batPath & """", 0, False
