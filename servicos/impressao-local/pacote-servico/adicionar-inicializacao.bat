@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

echo ======================================================
echo  ADICIONAR A INICIALIZACAO AUTOMATICA
echo ======================================================
echo.
echo Este script adiciona o servidor de impressao na
echo inicializacao do Windows. Ele rodara quando voce
echo fizer login (sem precisar de servico).
echo.
echo Vantagem: sempre tem acesso a impressora.
echo.

:: Cria VBS na pasta de inicialização com caminho correto embutido
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.CurrentDirectory = "%SCRIPT_DIR%"
echo WshShell.Run "%SCRIPT_DIR%bin\node.exe server.js", 0, False
) > "%STARTUP%\ReyDosPaesImpressao.vbs"
if %errorLevel% neq 0 (
    echo ERRO ao criar. Verifique se tem permissao.
    pause
    exit /b
)

echo Atalho criado em: %STARTUP%
echo.
echo Deseja iniciar o servidor AGORA? (S/N)
set /p INICIAR=
if /i "%INICIAR%"=="S" (
    echo Iniciando...
    start "" wscript "%SCRIPT_DIR%iniciar-servidor.vbs"
    timeout /t 2 >nul
    echo.
    echo Servidor iniciado! Acesse https://127.0.0.1:3333
) else (
    echo Para iniciar manualmente: execute iniciar-servidor.vbs
)

echo.
echo ======================================================
echo  PRONTO!
echo ======================================================
echo.
echo O servidor sera iniciado automaticamente quando voce
echo fizer login no Windows.
echo.
pause
