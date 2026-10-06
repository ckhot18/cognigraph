import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);

export function createApp() {
  const app = express();

  // JSON body limit 50 kb (spec section 6). Malformed JSON -> 400 JSON shape.
  app.use(express.json({
    limit: '50kb',
    strict: true,
  }));

  // Tiny request logger: method path status ms. No payload logging (spec 13.14).
  // eslint-disable-next-line no-unused-vars
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      // eslint-disable-next-line no-console
      console.log(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
    });
    next();
  });

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'cognigraph-ai', time: new Date().toISOString() });
  });

  // Phase 0 placeholder: full routes land in Phase 3.
  // Unknown /api routes -> JSON 404 (never HTML, never a stack trace).
  app.use('/api', (req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: `Unknown API route: ${req.method} ${req.path}` } });
  });

  // Single-process demo fallback (spec section 9): serve built client from :8787.
  const distDir = path.join(__dirname, '..', 'client', 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // Malformed JSON body -> 400 with standard error shape.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Malformed JSON body.' } });
    }
    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds 50 kb.' } });
    }
    const status = err && err.status ? err.status : 500;
    return res.status(status).json({ error: { code: status === 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST', message: status === 500 ? 'Internal server error.' : (err.message || 'Bad request.') } });
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const app = createApp();
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`cognigraph-ai server listening on :${PORT}`);
  });
}
