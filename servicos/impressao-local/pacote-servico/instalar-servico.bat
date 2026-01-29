@echo off
setlocal enabledelayedexpansion

:: Verifica privilégios de Administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ======================================================
    echo  ERRO: VOCE PRECISA EXECUTAR COMO ADMINISTRADOR
    echo ======================================================
    echo  Clique com o botao direito neste arquivo e escolha:
    echo  "Executar como administrador"
    echo.
    pause
    exit /b
)

set SERVICE_NAME=ReyDosPaesPrint
set ROOT_DIR=%~dp0
set BIN_DIR=%ROOT_DIR%bin
set NSSM="%BIN_DIR%\nssm.exe"
set NODE="%BIN_DIR%\node.exe"
set MKCERT="%BIN_DIR%\mkcert.exe"
set SCRIPT="%ROOT_DIR%server.js"

:: Verifica se os binários existem
if not exist %NSSM% (
    echo ERRO: nssm.exe nao encontrado em %BIN_DIR%
    pause
    exit /b
)
if not exist %NODE% (
    echo ERRO: node.exe nao encontrado em %BIN_DIR%
    pause
    exit /b
)
if not exist %MKCERT% (
    echo ERRO: mkcert.exe nao encontrado em %BIN_DIR%
    pause
    exit /b
)

echo Gerando certificados HTTPS (necessario para site no Railway)...
cd /d %ROOT_DIR%
%MKCERT% -install >nul 2>&1
%MKCERT% localhost 127.0.0.1
if not exist "%ROOT_DIR%localhost+1.pem" (
    echo ERRO: Falha ao gerar certificados.
    pause
    exit /b
)
echo Certificados gerados com sucesso.

echo.
echo Instalando servico: %SERVICE_NAME%...

:: 1. Para o serviço se já existir
%NSSM% stop %SERVICE_NAME% >nul 2>&1
%NSSM% remove %SERVICE_NAME% confirm >nul 2>&1

:: 2. Instala o serviço
%NSSM% install %SERVICE_NAME% %NODE% %SCRIPT%

:: 3. Configurações
%NSSM% set %SERVICE_NAME% AppDirectory %ROOT_DIR%
%NSSM% set %SERVICE_NAME% Description "Servico de Impressao Automatica para PDV Elgin i9 - Rey dos Paes"
%NSSM% set %SERVICE_NAME% Start SERVICE_AUTO_START

:: 4. Configura logs de erro
%NSSM% set %SERVICE_NAME% AppStdout "%ROOT_DIR%logs\service.log"
%NSSM% set %SERVICE_NAME% AppStderr "%ROOT_DIR%logs\error.log"
if not exist "%ROOT_DIR%logs" mkdir "%ROOT_DIR%logs"

:: 5. Inicia o serviço
%NSSM% start %SERVICE_NAME%

echo.
echo ======================================================
echo  SERVICO INSTALADO E INICIADO COM SUCESSO!
echo ======================================================
echo.
echo A impressora Elgin i9 ja deve funcionar automaticamente.
echo Voce pode fechar esta janela.
echo.
pause
