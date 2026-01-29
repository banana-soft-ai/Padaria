# Serviço de impressão local (Elgin i9)

Serviço Node.js que recebe o cupom fiscal e envia direto para a impressora (Elgin i9 ou outra), sem abrir o diálogo de impressão do navegador.

## Uso

1. **Inicie o serviço** no mesmo PC onde está o PDV e a impressora:
   ```bash
   cd servicos/impressao-local
   node server.js
   ```
   Por padrão escuta em `http://127.0.0.1:3333` (ou `https://127.0.0.1:3333` se certificados existirem).

2. **Site no Railway (HTTPS):** Para funcionar com o site hospedado no Railway, o serviço precisa usar HTTPS. Gere os certificados com mkcert:
   ```bash
   mkcert -install
   mkcert localhost 127.0.0.1
   ```
   Isso cria `localhost+1.pem` e `localhost+1-key.pem`. O serviço detecta e usa HTTPS automaticamente.

## Iniciar com o Windows (produção)

Para o serviço subir automaticamente quando o PC ligar (sem precisar rodar `npm run impressao-local` manualmente):

1. **Abra a pasta Inicialização do Windows**
   - Pressione `Win + R`, digite `shell:startup` e Enter.
   - Uma pasta será aberta (ex.: `C:\Users\SeuUsuario\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`).

2. **Crie um atalho**
   - Clique com o botão direito na pasta → **Novo** → **Atalho**.
   - Em "Local do item", informe o caminho completo do script **silencioso** (recomendado, sem janela):
     ```
     C:\caminho\para\rey-dos-paes\servicos\impressao-local\start-impressao-local-silent.vbs
     ```
     *(Troque `C:\caminho\para\rey-dos-paes` pelo caminho real do seu projeto.)*
   - Ou use o script **com janela** (para ver o terminal):
     ```
     C:\caminho\para\rey-dos-paes\servicos\impressao-local\start-impressao-local.bat
     ```
   - Dê um nome ao atalho (ex.: "Impressão local PDV") e conclua.

3. **Reinicie o PC ou faça logoff e logon** para testar. Na próxima vez que alguém fizer logon nesse usuário, o serviço já estará rodando.

**Requisitos:** Node.js deve estar instalado e no PATH do Windows (o mesmo usado no terminal). A impressora (ex.: Elgin i9) deve estar instalada e com o nome correto em Dispositivos e impressoras.

2. **Impressora:**  
   - No Windows, o nome da impressora deve ser exatamente como aparece em "Dispositivos e impressoras" (ex.: `Elgin i9`).  
   - Para usar outra impressora: `set PRINTER_NAME=Nome da Impressora` (Windows) ou `PRINTER_NAME="Nome" node server.js`.  
   - Para usar a impressora padrão do Windows: `set PRINTER_NAME=` (vazio) e use `print arquivo.txt` (o serviço envia para a padrão se não houver nome).

3. No PDV, ao finalizar a venda e clicar em **"Sim"** em "Deseja imprimir o cupom fiscal?", o sistema tenta enviar o cupom para este serviço. Se o serviço estiver rodando e a impressora configurada, o cupom sai direto na impressora.

## Variáveis de ambiente

| Variável        | Padrão     | Descrição                          |
|-----------------|------------|------------------------------------|
| `PORT`          | 3333       | Porta HTTP do serviço             |
| `PRINTER_NAME`  | Elgin i9   | Nome da impressora no Windows/Linux |

## Endpoints

- `GET /` ou `GET /status` — status do serviço e impressora configurada.
- `POST /imprimir-cupom` — corpo JSON: `{ "linhas": ["Linha 1", "Linha 2"], "printerName": "opcional" }`.

Se o serviço não estiver rodando ou der erro, o PDV usa o comportamento antigo (abre a janela de impressão do navegador).
