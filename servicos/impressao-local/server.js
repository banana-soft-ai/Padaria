/**
 * Serviço local de impressão para cupom fiscal (Elgin i9 ou impressora padrão).
 * Recebe POST /imprimir-cupom com { linhas: string[], printerName?: string }
 * e envia o texto para a impressora configurada.
 *
 * Usa HTTPS quando certificados existem (localhost+1.pem) para funcionar com
 * site hospedado em Railway/HTTPS (evita bloqueio Mixed Content).
 *
 * Uso: node server.js
 * Porta padrão: 3333 (variável de ambiente PORT)
 * Impressora: variável de ambiente PRINTER_NAME ou "Elgin i9"
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const { exec } = require('child_process')

const ROOT_DIR = __dirname
const CERT_PEM = path.join(ROOT_DIR, 'localhost+1.pem')
const CERT_KEY = path.join(ROOT_DIR, 'localhost+1-key.pem')
const useHttps = fs.existsSync(CERT_PEM) && fs.existsSync(CERT_KEY)

const http = require('http')
const https = require('https')

const PORT = parseInt(process.env.PORT || '3333', 10)
const PRINTER_NAME = process.env.PRINTER_NAME || 'Elgin i9'

const httpsOptions = useHttps ? {
  key: fs.readFileSync(CERT_KEY),
  cert: fs.readFileSync(CERT_PEM),
} : null

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function send(res, statusCode, body, contentType = 'application/json') {
  res.writeHead(statusCode, { 'Content-Type': contentType, ...CORS_HEADERS })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

function imprimirWindows(linhas, printerName) {
  return new Promise((resolve, reject) => {
    const texto = linhas.join('\r\n') + '\r\n'
    const tmpDir = os.tmpdir()
    const tmpFile = path.join(tmpDir, `cupom-${Date.now()}.txt`)
    const nomeImpressora = printerName || PRINTER_NAME

    try {
      fs.writeFileSync(tmpFile, texto, { encoding: 'utf8' })
    } catch (err) {
      reject(err)
      return
    }

    // Windows: print /D:"nome" "arquivo" (ou só print "arquivo" para impressora padrão)
    const escaped = nomeImpressora.replace(/"/g, '""')
    const cmd = escaped ? `print /D:"${escaped}" "${tmpFile}"` : `print "${tmpFile}"`
    exec(cmd, { windowsHide: true }, (err) => {
      try {
        fs.unlinkSync(tmpFile)
      } catch (_) {}
      if (err) reject(err)
      else resolve()
    })
  })
}

function imprimirUnix(linhas, printerName) {
  return new Promise((resolve, reject) => {
    const texto = linhas.join('\n') + '\n'
    const tmpFile = path.join(os.tmpdir(), `cupom-${Date.now()}.txt`)
    fs.writeFileSync(tmpFile, texto, { encoding: 'utf8' })
    const nome = printerName || PRINTER_NAME
    const cmd = nome ? `lp -d "${nome.replace(/"/g, '\\"')}" "${tmpFile}"` : `lp "${tmpFile}"`
    exec(cmd, (err) => {
      try {
        fs.unlinkSync(tmpFile)
      } catch (_) {}
      if (err) reject(err)
      else resolve()
    })
  })
}

function imprimir(linhas, printerName) {
  if (process.platform === 'win32') {
    return imprimirWindows(linhas, printerName)
  }
  return imprimirUnix(linhas, printerName)
}

const createServer = useHttps ? (handler) => https.createServer(httpsOptions, handler) : (handler) => http.createServer(handler)

const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    send(res, 204, '')
    return
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/status')) {
    send(res, 200, {
      ok: true,
      service: 'impressao-local',
      printer: PRINTER_NAME,
      platform: process.platform,
    })
    return
  }

  if (req.method !== 'POST' || req.url !== '/imprimir-cupom') {
    send(res, 404, { error: 'Not found' })
    return
  }

  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    let data
    try {
      data = JSON.parse(body)
    } catch {
      send(res, 400, { error: 'Body JSON inválido' })
      return
    }
    const linhas = Array.isArray(data.linhas) ? data.linhas : (data.texto ? data.texto.split('\n') : [])
    const printerName = typeof data.printerName === 'string' ? data.printerName : undefined

    if (linhas.length === 0) {
      send(res, 400, { error: 'Envie "linhas" (array de strings) ou "texto"' })
      return
    }

    imprimir(linhas, printerName)
      .then(() => send(res, 200, { ok: true, message: 'Enviado para impressora' }))
      .catch((err) => {
        console.error('Erro ao imprimir:', err)
        send(res, 500, {
          error: 'Falha ao enviar para impressora',
          detail: err.message || String(err),
        })
      })
  })
})

server.listen(PORT, '127.0.0.1', () => {
  const proto = useHttps ? 'https' : 'http'
  console.log(`Impressão local: ${proto}://127.0.0.1:${PORT} (impressora: ${PRINTER_NAME})`)
})
