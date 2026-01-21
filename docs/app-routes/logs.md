📘 API de Logs

Endpoint responsável por receber, validar e registrar logs enviados pelo front-end ou outros serviços internos.

📍 Endpoint
/api/logs

🧭 Métodos Disponíveis
# GET – Informações da API

URL:

GET /api/logs


Descrição:
Retorna informações básicas sobre o endpoint.

Resposta exemplo:

{
  "message": "Logs API endpoint",
  "endpoints": {
    "POST": "Enviar log para o servidor"
  }
}

# POST – Enviar Log

URL:

POST /api/logs


Descrição:
Recebe um log, valida os dados e registra no servidor.
No momento, os logs são apenas enviados ao console.

📤 Body da Requisição (JSON)
{
  "timestamp": "2025-12-09T16:00:00Z",
  "level": "info",
  "message": "Mensagem de teste",
  "context": {
    "rota": "/home",
    "usuarioId": 123
  }
}

🔍 Validação dos Campos
Campo	Tipo	Obrigatório	Descrição
timestamp	string	✅	Data/hora no formato ISO
level	string	✅	Nível do log: info, warn, error, debug
message	string	✅	Mensagem principal
context	object	❌	Dados adicionais
# Níveis de log aceitos
info, warn, error, debug

💬 Exemplos de Logs
# Exemplo: Log de informação
{
  "timestamp": "2025-12-09T16:00:00Z",
  "level": "info",
  "message": "Usuário acessou o dashboard",
  "context": {
    "user": "Leiliane",
    "page": "dashboard"
  }
}

# Exemplo: Log de erro
{
  "timestamp": "2025-12-09T16:05:21Z",
  "level": "error",
  "message": "Falha ao carregar dados",
  "context": {
    "endpoint": "/api/data",
    "error": "500 Internal Server Error"
  }
}

🧪 Possíveis Respostas
# 200 – Sucesso
{
  "success": true
}

# 400 – Estrutura inválida
{
  "error": "Estrutura inválida de log"
}

# 400 – Nível inválido
{
  "error": "Nível de log inválido"
}

# 500 – Erro interno
{
  "error": "Erro interno do servidor"
}

🛠️ Fluxo Interno do Endpoint

Recebe os dados via JSON

Valida timestamp, level e message

Verifica se o nível do log é aceito

Registra o log no servidor (console.log)

Retorna success: true

🚀 Melhorias Futuras

Armazenar logs em banco (PostgreSQL / MongoDB)

Integração com Sentry, DataDog, LogRocket

Dashboard para visualização dos logs

Middleware de logs reutilizável

Rate limiting e anti-spam