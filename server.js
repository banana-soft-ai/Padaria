// Ajuste mínimo para logar a PORT e ter fallback coerente
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '0.0.0.0';
// Platform injects PORT; fallback local 3000 for local dev
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const dir = __dirname;

// Don't pass hostname/port to Next constructor in production - keep defaults and let the http server bind explicitly
const app = next({ dev, dir });
const handle = app.getRequestHandler();

console.log('Starting Next server with:');
console.log('  NODE_ENV =', process.env.NODE_ENV);
console.log('  HOST     =', hostname);
console.log('  PORT     =', port);

// Log apenas a presença das variáveis do Supabase (nunca exponha as chaves)
console.log('  Supabase envs presence =>', {
  NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_URL: !!process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
})

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    const start = Date.now();
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    try {
      // health endpoint for platform checks
      if (req.url === '/_health' || req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        return;
      }

      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error(`Error occurred handling ${req.method} ${req.url}:`, err && err.stack ? err.stack : err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Internal Server Error');
    } finally {
      const ms = Date.now() - start;
      console.log(`${req.method} ${req.url} - ${res.statusCode || 200} - ${ms}ms`);
    }
  });

  server.listen(port, hostname);

  server.on('listening', () => {
    const displayHost = hostname === '0.0.0.0' ? 'localhost' : hostname;
    console.log(`> Ready on http://${displayHost}:${port}`);
  });

  server.on('error', (err) => {
    console.error('Server error:', err && err.stack ? err.stack : err);
    // Exit so platform can restart according to restartPolicy
    process.exit(1);
  });

  process.on('uncaughtException', (err) => {
    console.error('uncaughtException:', err && err.stack ? err.stack : err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('unhandledRejection:', reason && reason.stack ? reason.stack : reason);
    process.exit(1);
  });
});