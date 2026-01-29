@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERRO: Execute como ADMINISTRADOR.
    pause
    exit /b
)

set SERVICE_NAME=ReyDosPaesPrint
set BIN_DIR=%~dp0bin
set NSSM="%BIN_DIR%\nssm.exe"

echo Removendo servico: %SERVICE_NAME%...

%NSSM% stop %SERVICE_NAME%
%NSSM% remove %SERVICE_NAME% confirm

echo.
echo Servico removido com sucesso.
pause
