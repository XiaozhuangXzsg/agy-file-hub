import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createFolder,
  deleteEntry,
  getOverview,
  listEntries,
  moveEntry,
  readFileDetail,
  renameEntry,
  resolveSafePath,
  writeFileContent
} from '../lib/fs-service.mjs';
import { createFileHubServer } from '../sidecars/file-hub/main.mjs';

test('path jail blocks directory traversal', () => {
  const root = mkdtempSync(join(tmpdir(), 'agy-fh-'));
  try {
    assert.throws(() => resolveSafePath(root, '../outside.txt'), /escapes/i);
    assert.throws(() => resolveSafePath(root, 'projects/../../outside.txt'), /escapes/i);
    assert.ok(resolveSafePath(root, 'projects/demo/index.js').startsWith(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CRUD, session metadata, categorization, sorting, preview, rename & move', () => {
  const root = mkdtempSync(join(tmpdir(), 'agy-fh-crud-'));
  const settings = { rootDir: root, customMeta: {}, theme: 'dark' };
  try {
    const ov = getOverview(settings);
    assert.equal(ov.stats.projects.exists, true);
    assert.equal(ov.stats.sessions.exists, true);

    createFolder('sessions/2026-11-27_demo-run', { title: 'Demo Session', topic: 'demo-run', tags: ['test'] }, settings);
    writeFileContent('sessions/2026-11-27_demo-run/report.md', '# Hello\n\nWorld', true, settings);
    writeFileContent('projects/my-app/app.js', 'console.log(1);\n', true, settings);

    const sessions = listEntries({ category: 'sessions', sort: 'name', order: 'asc' }, settings);
    assert.equal(sessions.items.length, 1);
    assert.equal(sessions.items[0].sessionMeta.title, 'Demo Session');

    const md = readFileDetail('sessions/2026-11-27_demo-run/report.md', settings);
    assert.equal(md.previewKind, 'markdown');
    assert.equal(md.editable, true);
    assert.match(md.content, /# Hello/);

    writeFileContent('sessions/2026-11-27_demo-run/report.md', '# Updated\n', false, settings);
    assert.equal(readFileDetail('sessions/2026-11-27_demo-run/report.md', settings).content, '# Updated\n');

    const renamed = renameEntry('sessions/2026-11-27_demo-run/report.md', 'summary.md', settings);
    assert.equal(renamed.name, 'summary.md');

    const moved = moveEntry('sessions/2026-11-27_demo-run/summary.md', 'projects/my-app', settings);
    assert.equal(moved.path, 'projects/my-app/summary.md');

    const search = listEntries({ q: 'summary', recursive: '1' }, settings);
    assert.equal(search.items.length, 1);
    assert.equal(search.items[0].path, 'projects/my-app/summary.md');

    assert.throws(() => deleteEntry('projects', settings), /Protected/i);
    deleteEntry('projects/my-app/summary.md', settings);
    assert.equal(listEntries({ path: 'projects/my-app' }, settings).items.length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('HTTP sidecar enforces token auth and serves UI + overview + list APIs', async () => {
  const root = mkdtempSync(join(tmpdir(), 'agy-fh-http-'));
  const prevRoot = process.env.AGY_FILE_HUB_ROOT;
  process.env.AGY_FILE_HUB_ROOT = root;
  const server = createFileHubServer({ uiToken: 'secret-token-123' });
  await new Promise(res => server.listen(0, '127.0.0.1', res));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const uiRes = await fetch(`${base}/`);
    assert.equal(uiRes.status, 200);
    assert.match(await uiRes.text(), /Antigravity File Hub/);

    const unauth = await fetch(`${base}/api/overview`);
    assert.equal(unauth.status, 401);

    const auth = await fetch(`${base}/api/overview`, { headers: { 'x-sidecar-token': 'secret-token-123' } });
    assert.equal(auth.status, 200);
    const data = await auth.json();
    assert.equal(data.version, '1.0.0');
    assert.ok(data.rootDir);
  } finally {
    server.close();
    if (prevRoot === undefined) delete process.env.AGY_FILE_HUB_ROOT;
    else process.env.AGY_FILE_HUB_ROOT = prevRoot;
    rmSync(root, { recursive: true, force: true });
  }
});
