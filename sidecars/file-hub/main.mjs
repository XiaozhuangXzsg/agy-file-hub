import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createFolder,
  deleteEntry,
  getOverview,
  getRawFileStreamInfo,
  listEntries,
  loadSettings,
  moveEntry,
  readFileDetail,
  renameEntry,
  revealInExplorer,
  saveSettings,
  updateCustomMeta,
  writeFileContent
} from '../../lib/fs-service.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, '..', '..');
const UI_HTML_PATH = join(PLUGIN_ROOT, 'ui', 'index.html');
const VERSION = (() => {
  try {
    return JSON.parse(readFileSync(join(PLUGIN_ROOT, 'plugin.json'), 'utf8')).version || '1.0.0';
  } catch {
    return '1.0.0';
  }
})();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function readBody(req, maxBytes = 4 * 1024 * 1024) {
  return new Promise((resolveBody, rejectBody) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > maxBytes) {
        rejectBody(new Error('Request payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch {
        rejectBody(new Error('Invalid JSON body'));
      }
    });
    req.on('error', rejectBody);
  });
}

export function createFileHubServer({ uiToken = '' } = {}) {
  const isAuthorized = (req, url) => {
    if (url.pathname === '/' || url.pathname === '/healthz') return true;
    if (!uiToken) return true;
    return (req.headers['x-sidecar-token'] || url.searchParams.get('token')) === uiToken;
  };

  return createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (!isAuthorized(req, url)) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    try {
      if (req.method === 'GET' && url.pathname === '/healthz') {
        sendJson(res, 200, { ok: true, version: VERSION });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/') {
        if (!existsSync(UI_HTML_PATH)) {
          res.writeHead(500).end('UI asset missing');
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store'
        });
        res.end(readFileSync(UI_HTML_PATH, 'utf8'));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/overview') {
        const settings = loadSettings();
        sendJson(res, 200, { version: VERSION, ...getOverview(settings) });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/list') {
        const query = Object.fromEntries(url.searchParams.entries());
        sendJson(res, 200, listEntries(query));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/file') {
        const relPath = url.searchParams.get('path') || '';
        sendJson(res, 200, readFileDetail(relPath));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/raw') {
        const relPath = url.searchParams.get('path') || '';
        const info = getRawFileStreamInfo(relPath);
        res.writeHead(200, {
          'Content-Type': info.mimeType,
          'Content-Length': info.size,
          'Cache-Control': 'no-store'
        });
        createReadStream(info.absPath).pipe(res);
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/file') {
        const body = await readBody(req);
        const saved = writeFileContent(body.path, body.content, Boolean(body.createOnly));
        sendJson(res, 200, { ok: true, item: saved });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/mkdir') {
        const body = await readBody(req);
        const created = createFolder(body.path, body.sessionMeta || null);
        sendJson(res, 200, { ok: true, item: created });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/rename') {
        const body = await readBody(req);
        const item = renameEntry(body.path, body.newName);
        sendJson(res, 200, { ok: true, item });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/move') {
        const body = await readBody(req);
        const item = moveEntry(body.path, body.destDir);
        sendJson(res, 200, { ok: true, item });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/meta') {
        const body = await readBody(req);
        const item = updateCustomMeta(body.path, body);
        sendJson(res, 200, { ok: true, item });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/delete') {
        const body = await readBody(req);
        const result = deleteEntry(body.path);
        sendJson(res, 200, { ok: true, ...result });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/reveal') {
        const body = await readBody(req);
        const result = revealInExplorer(body.path || '', Boolean(body.openFolder));
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/settings') {
        const body = await readBody(req);
        const saved = saveSettings(body);
        sendJson(res, 200, { ok: true, settings: saved, overview: getOverview(saved) });
        return;
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = /not found|does not exist/i.test(msg) ? 404 : 400;
      sendJson(res, code, { error: msg });
    }
  });
}

function parseCliPort() {
  const idx = process.argv.indexOf('--port');
  if (idx >= 0 && process.argv[idx + 1]) return Number(process.argv[idx + 1]);
  return Number(process.env.ANTIGRAVITY_SIDECAR_WEB_PORT || process.env.PORT || 0);
}

const isMain = process.argv[1] && resolvePathEq(process.argv[1], fileURLToPath(import.meta.url));
function resolvePathEq(a, b) {
  return process.platform === 'win32'
    ? a.replace(/\\/g, '/').toLowerCase() === b.replace(/\\/g, '/').toLowerCase()
    : a === b;
}

if (isMain) {
  const port = parseCliPort();
  const uiToken = process.env.ANTIGRAVITY_SIDECAR_UI_TOKEN || '';
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('[agy-file-hub] No valid port supplied (set ANTIGRAVITY_SIDECAR_WEB_PORT or --port)');
    process.exit(1);
  }
  const server = createFileHubServer({ uiToken });
  server.listen(port, '127.0.0.1', () => {
    console.log(`[agy-file-hub] v${VERSION} listening on http://127.0.0.1:${port}`);
  });
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      server.close(() => process.exit(0));
    });
  }
}
