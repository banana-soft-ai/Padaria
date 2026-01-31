' Inicia o servidor de impressao em segundo plano (sem janela)
' Roda no contexto do usuario = tem acesso a impressora
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
scriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir
WshShell.Run "bin\node.exe server.js", 0, False
