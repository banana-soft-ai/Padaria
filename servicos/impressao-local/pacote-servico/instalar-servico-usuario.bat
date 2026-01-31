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

echo ======================================================
echo  INSTALADOR - SERVICO DE IMPRESSAO (como usuario)
echo ======================================================
echo.
echo Este instalador configura o servico para rodar com
echo SEU usuario, assim ele tera acesso a impressora.
echo.
echo Usuario atual: %USERNAME%
echo.

:: Gerar certificados se não existirem
if not exist "%ROOT_DIR%localhost+1.pem" (
    echo Gerando certificados HTTPS...
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
) else (
    echo Certificados HTTPS ja existem.
    echo.
)

:: Remove serviço anterior se existir
echo Removendo servico anterior...
%NSSM% stop %SERVICE_NAME% >nul 2>&1
timeout /t 2 >nul
%NSSM% remove %SERVICE_NAME% confirm >nul 2>&1
timeout /t 1 >nul

:: Instala o serviço
echo Instalando servico...
%NSSM% install %SERVICE_NAME% %NODE% %SCRIPT%

:: Configurações
%NSSM% set %SERVICE_NAME% AppDirectory %ROOT_DIR%
%NSSM% set %SERVICE_NAME% Description "Servico de Impressao PDV Elgin i9 - Rey dos Paes"
%NSSM% set %SERVICE_NAME% Start SERVICE_AUTO_START
%NSSM% set %SERVICE_NAME% AppStdout "%ROOT_DIR%logs\service.log"
%NSSM% set %SERVICE_NAME% AppStderr "%ROOT_DIR%logs\error.log"
if not exist "%ROOT_DIR%logs" mkdir "%ROOT_DIR%logs"

:: IMPORTANTE: Configura para rodar como o usuário logado
echo.
echo Digite a senha do usuario "%USERNAME%" do Windows.
echo Se a conta NAO tiver senha, pressione ENTER direto.
echo.
set /p SENHA="Senha: "

%NSSM% set %SERVICE_NAME% ObjectName ".\%USERNAME%" "%SENHA%"
if %errorLevel% neq 0 (
    echo.
    echo AVISO: Nao foi possivel configurar o usuario. O servico pode
    echo rodar como Sistema e NAO ter acesso a impressora.
    echo.
    echo Tente executar manualmente: nssm edit %SERVICE_NAME%
    echo Na aba "Log on", marque "This account" e informe .\%USERNAME%
    echo.
) else (
    echo Configurado para rodar como usuario %USERNAME%.
)

:: Inicia o serviço
echo.
echo Iniciando servico...
%NSSM% start %SERVICE_NAME%
timeout /t 2 >nul

echo.
echo ======================================================
echo  INSTALACAO CONCLUIDA!
echo ======================================================
echo.
echo O servico ReyDosPaesPrint esta rodando.
echo A impressora Elgin i9 deve funcionar com o app no Railway.
echo.
echo Para testar: acesse https://127.0.0.1:3333 no navegador
echo.
pause
