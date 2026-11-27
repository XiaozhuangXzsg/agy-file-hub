import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';

export const DATA_DIR = join(homedir(), '.gemini', 'antigravity', 'plugin_data', 'agy-file-hub');
export const SETTINGS_PATH = join(DATA_DIR, 'settings.json');

const PROTECTED_TOP_DIRS = new Set(['projects', 'sessions', 'scratch', '_storage']);
const SKIP_SCAN_DIRS = new Set(['node_modules', '.git', 'Cache', 'GPUCache', 'GrShaderCache', 'Code Cache']);
const MAX_TEXT_PREVIEW_BYTES = 2 * 1024 * 1024; // 2 MB

const EXT_GROUPS = {
  code: new Set([
    '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.ps1', '.psm1', '.bat', '.cmd', '.sh', '.bash',
    '.zsh', '.go', '.rs', '.java', '.kt', '.c', '.cpp', '.h', '.hpp', '.cs', '.rb', '.php', '.swift',
    '.vue', '.svelte', '.html', '.htm', '.css', '.scss', '.less', '.sql', '.lua', '.gd', '.dart'
  ]),
  doc: new Set(['.md', '.markdown', '.txt', '.rst', '.adoc', '.pdf', '.doc', '.docx', '.rtf', '.log']),
  image: new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif']),
  data: new Set(['.json', '.jsonc', '.yaml', '.yml', '.toml', '.xml', '.csv', '.tsv', '.ini', '.env', '.conf', '.cfg']),
  archive: new Set(['.zip', '.7z', '.rar', '.tar', '.gz', '.bz2', '.xz', '.tgz'])
};

const MIME_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

export function detectDefaultRootDir() {
  if (process.env.AGY_FILE_HUB_ROOT) return resolve(process.env.AGY_FILE_HUB_ROOT);
  if (process.platform === 'win32' && existsSync('D:\\Antigravity')) return 'D:\\Antigravity';
  return join(homedir(), 'Antigravity');
}

function readJsonSafe(filePath, fallback) {
  try {
    return existsSync(filePath) ? JSON.parse(readFileSync(filePath, 'utf8')) : fallback;
  } catch {
    return fallback;
  }
}

export function writeAtomic(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, filePath);
}

export function loadSettings() {
  const raw = readJsonSafe(SETTINGS_PATH, {});
  const rootDir = typeof raw.rootDir === 'string' && raw.rootDir.trim()
    ? resolve(raw.rootDir.trim())
    : detectDefaultRootDir();
  const customMeta = raw.customMeta && typeof raw.customMeta === 'object' ? raw.customMeta : {};
  const theme = raw.theme === 'light' ? 'light' : 'dark';
  return { rootDir, customMeta, theme };
}

export function saveSettings(patch = {}) {
  const cur = loadSettings();
  if (typeof patch.rootDir === 'string' && patch.rootDir.trim()) {
    const nextRoot = resolve(patch.rootDir.trim());
    mkdirSync(nextRoot, { recursive: true });
    cur.rootDir = nextRoot;
  }
  if (patch.theme === 'light' || patch.theme === 'dark') {
    cur.theme = patch.theme;
  }
  if (patch.customMeta && typeof patch.customMeta === 'object') {
    cur.customMeta = patch.customMeta;
  }
  writeAtomic(SETTINGS_PATH, JSON.stringify(cur, null, 2) + '\n');
  ensureBaseStructure(cur.rootDir);
  return cur;
}

export function ensureBaseStructure(rootDir) {
  mkdirSync(join(rootDir, 'projects'), { recursive: true });
  mkdirSync(join(rootDir, 'sessions'), { recursive: true });
}

export function toPosixRel(rootDir, absPath) {
  const rel = relative(rootDir, absPath);
  if (!rel || rel === '.') return '';
  return rel.split(sep).join('/');
}

export function resolveSafePath(rootDir, relPath = '') {
  const cleanRoot = resolve(rootDir);
  if (typeof relPath !== 'string' || relPath.includes('\0')) {
    throw new Error('Invalid path');
  }
  const trimmed = relPath.replace(/^[/\\]+/, '');
  const abs = trimmed ? resolve(cleanRoot, trimmed) : cleanRoot;
  const cmpRoot = process.platform === 'win32' ? cleanRoot.toLowerCase() : cleanRoot;
  const cmpAbs = process.platform === 'win32' ? abs.toLowerCase() : abs;
  if (cmpAbs !== cmpRoot && !cmpAbs.startsWith(cmpRoot + sep)) {
    throw new Error('Path escapes Antigravity root directory');
  }
  return abs;
}

export function classifyFileType(name, isDir) {
  if (isDir) return 'folder';
  const ext = extname(name).toLowerCase();
  for (const [group, set] of Object.entries(EXT_GROUPS)) {
    if (set.has(ext)) return group;
  }
  return 'binary';
}

export function inferCategory(relPath, customMeta = {}) {
  const key = relPath.replace(/\\/g, '/');
  if (customMeta[key]?.customCategory) return customMeta[key].customCategory;
  const top = key.split('/')[0]?.toLowerCase() || '';
  if (top === 'projects') return 'projects';
  if (top === 'sessions') return 'sessions';
  if (top === 'scratch') return 'scratch';
  if (top === '_storage') return '_Storage';
  return 'other';
}

function readSessionMeta(dirAbsPath) {
  const metaPath = join(dirAbsPath, '.agy-session.json');
  if (!existsSync(metaPath)) return null;
  return readJsonSafe(metaPath, null);
}

function computeDirQuickStats(dirAbsPath, depth = 0, budget = { count: 0, maxNodes: 600 }) {
  let files = 0;
  let dirs = 0;
  let bytes = 0;
  if (depth > 4 || budget.count >= budget.maxNodes) return { files, dirs, bytes, truncated: true };
  let entries;
  try {
    entries = readdirSync(dirAbsPath, { withFileTypes: true });
  } catch {
    return { files, dirs, bytes, truncated: false };
  }
  let truncated = false;
  for (const ent of entries) {
    if (budget.count >= budget.maxNodes) { truncated = true; break; }
    budget.count++;
    const full = join(dirAbsPath, ent.name);
    try {
      const st = lstatSync(full);
      if (st.isSymbolicLink()) {
        dirs++;
        continue;
      }
      if (st.isDirectory()) {
        dirs++;
        if (!SKIP_SCAN_DIRS.has(ent.name)) {
          const sub = computeDirQuickStats(full, depth + 1, budget);
          files += sub.files;
          dirs += sub.dirs;
          bytes += sub.bytes;
          if (sub.truncated) truncated = true;
        }
      } else {
        files++;
        bytes += st.size;
      }
    } catch {}
  }
  return { files, dirs, bytes, truncated };
}

export function getOverview(settings = loadSettings()) {
  const { rootDir, customMeta, theme } = settings;
  ensureBaseStructure(rootDir);
  const categories = [
    { id: 'projects', label: '项目 (Projects)', dir: 'projects' },
    { id: 'sessions', label: '会话产出 (Sessions)', dir: 'sessions' },
    { id: 'scratch', label: '临时/默认区 (Scratch)', dir: 'scratch' },
    { id: '_Storage', label: '系统存储 (_Storage)', dir: '_Storage' }
  ];

  const stats = {};
  let totalFiles = 0;
  let totalDirs = 0;
  let totalBytes = 0;

  for (const cat of categories) {
    const abs = join(rootDir, cat.dir);
    if (!existsSync(abs)) {
      stats[cat.id] = { exists: false, topItems: 0, files: 0, dirs: 0, bytes: 0 };
      continue;
    }
    let topItems = 0;
    try {
      topItems = readdirSync(abs).filter(n => !n.startsWith('.')).length;
    } catch {}
    const q = computeDirQuickStats(abs, 0, { count: 0, maxNodes: 800 });
    stats[cat.id] = { exists: true, topItems, files: q.files, dirs: q.dirs, bytes: q.bytes, truncated: q.truncated };
    totalFiles += q.files;
    totalDirs += q.dirs;
    totalBytes += q.bytes;
  }

  return {
    rootDir,
    theme,
    platform: process.platform,
    categories,
    stats,
    totals: { files: totalFiles, dirs: totalDirs, bytes: totalBytes },
    customMetaCount: Object.keys(customMeta).length
  };
}

function buildEntryRecord(rootDir, absPath, customMeta) {
  const st = statSync(absPath);
  const lst = lstatSync(absPath);
  const isDir = st.isDirectory();
  const name = basename(absPath);
  const rel = toPosixRel(rootDir, absPath);
  const ext = isDir ? '' : extname(name).toLowerCase();
  const fileType = classifyFileType(name, isDir);
  const category = inferCategory(rel, customMeta);
  const sessionMeta = isDir ? readSessionMeta(absPath) : null;
  const userMeta = customMeta[rel] || {};
  let childCount = null;
  if (isDir) {
    try {
      childCount = readdirSync(absPath).filter(n => n !== '.agy-session.json').length;
    } catch {
      childCount = 0;
    }
  }
  return {
    name,
    path: rel,
    fullPath: absPath,
    isDir,
    isLink: lst.isSymbolicLink(),
    ext,
    fileType,
    category,
    size: isDir ? 0 : st.size,
    mtimeMs: st.mtimeMs,
    ctimeMs: st.ctimeMs || st.birthtimeMs,
    childCount,
    sessionMeta,
    tags: Array.isArray(userMeta.tags) ? userMeta.tags : (Array.isArray(sessionMeta?.tags) ? sessionMeta.tags : []),
    note: userMeta.note || '',
    customCategory: userMeta.customCategory || ''
  };
}

function collectRecursive(rootDir, startAbs, customMeta, opts, out = [], depth = 0) {
  if (depth > 6 || out.length >= 1000) return out;
  let entries;
  try {
    entries = readdirSync(startAbs, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    if (out.length >= 1000) break;
    if (ent.name === '.agy-session.json' && !opts.showHidden) continue;
    if (ent.name.startsWith('.') && !opts.showHidden) continue;
    const full = join(startAbs, ent.name);
    let rec;
    try {
      rec = buildEntryRecord(rootDir, full, customMeta);
    } catch {
      continue;
    }
    out.push(rec);
    if (rec.isDir && !SKIP_SCAN_DIRS.has(ent.name)) {
      collectRecursive(rootDir, full, customMeta, opts, out, depth + 1);
    }
  }
  return out;
}

export function listEntries(query = {}, settings = loadSettings()) {
  const { rootDir, customMeta } = settings;
  ensureBaseStructure(rootDir);

  const relPath = typeof query.path === 'string' ? query.path.trim() : '';
  const category = typeof query.category === 'string' ? query.category.trim() : 'all';
  const fileType = typeof query.fileType === 'string' ? query.fileType.trim() : 'all';
  const q = typeof query.q === 'string' ? query.q.trim().toLowerCase() : '';
  const sort = typeof query.sort === 'string' ? query.sort : 'mtime';
  const order = query.order === 'asc' ? 'asc' : 'desc';
  const showHidden = query.showHidden === '1' || query.showHidden === 'true';
  const foldersFirst = query.foldersFirst !== '0';
  const recursive = query.recursive === '1' || query.recursive === 'true' || Boolean(q) || (fileType !== 'all' && !relPath);

  let baseRel = relPath;
  if (!baseRel && category !== 'all' && category !== 'other') {
    baseRel = category;
  }

  const targetAbs = resolveSafePath(rootDir, baseRel);
  if (!existsSync(targetAbs)) {
    return { currentPath: baseRel, parentPath: '', breadcrumbs: [], items: [], total: 0 };
  }

  let items = [];
  if (recursive) {
    items = collectRecursive(rootDir, targetAbs, customMeta, { showHidden });
  } else {
    const entries = readdirSync(targetAbs, { withFileTypes: true });
    for (const ent of entries) {
      if (!showHidden && ent.name.startsWith('.')) continue;
      try {
        items.push(buildEntryRecord(rootDir, join(targetAbs, ent.name), customMeta));
      } catch {}
    }
  }

  if (category === 'other') {
    items = items.filter(it => it.category === 'other');
  } else if (category !== 'all' && relPath) {
    items = items.filter(it => it.category === category);
  }

  if (fileType !== 'all') {
    items = items.filter(it => it.fileType === fileType);
  }

  if (q) {
    items = items.filter(it => {
      const hay = [
        it.name,
        it.path,
        it.sessionMeta?.title || '',
        it.sessionMeta?.topic || '',
        it.note || '',
        ...(it.tags || [])
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  const mul = order === 'asc' ? 1 : -1;
  items.sort((a, b) => {
    if (foldersFirst && a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    let cmp = 0;
    if (sort === 'name') cmp = a.name.localeCompare(b.name, 'zh-CN', { numeric: true, sensitivity: 'base' });
    else if (sort === 'size') cmp = (a.size || 0) - (b.size || 0);
    else if (sort === 'type') cmp = (a.ext || a.fileType).localeCompare(b.ext || b.fileType);
    else cmp = (a.mtimeMs || 0) - (b.mtimeMs || 0);
    if (cmp === 0) cmp = a.name.localeCompare(b.name, 'zh-CN');
    return cmp * mul;
  });

  const parts = baseRel ? baseRel.split('/').filter(Boolean) : [];
  const breadcrumbs = parts.map((p, idx) => ({
    name: p,
    path: parts.slice(0, idx + 1).join('/')
  }));
  const parentPath = parts.length > 0 ? parts.slice(0, -1).join('/') : '';

  return {
    rootDir,
    currentPath: baseRel,
    parentPath,
    breadcrumbs,
    recursive,
    total: items.length,
    items
  };
}

function looksBinary(buf) {
  const sampleLen = Math.min(buf.length, 4096);
  let nulls = 0;
  for (let i = 0; i < sampleLen; i++) {
    if (buf[i] === 0) nulls++;
  }
  return nulls > 0;
}

export function readFileDetail(relPath, settings = loadSettings()) {
  const { rootDir, customMeta } = settings;
  const abs = resolveSafePath(rootDir, relPath);
  if (!existsSync(abs)) throw new Error('File not found');
  const rec = buildEntryRecord(rootDir, abs, customMeta);
  if (rec.isDir) {
    const q = computeDirQuickStats(abs, 0, { count: 0, maxNodes: 500 });
    return { ...rec, dirStats: q, previewKind: 'folder', editable: false, content: null };
  }

  const mimeType = MIME_MAP[rec.ext] || 'application/octet-stream';
  if (rec.fileType === 'image') {
    const svgText = rec.ext === '.svg' && rec.size <= MAX_TEXT_PREVIEW_BYTES
      ? readFileSync(abs, 'utf8')
      : null;
    return { ...rec, mimeType, previewKind: 'image', editable: rec.ext === '.svg', content: svgText };
  }

  if (rec.size > MAX_TEXT_PREVIEW_BYTES) {
    return {
      ...rec,
      mimeType,
      previewKind: 'too_large',
      editable: false,
      content: null,
      reason: `文件较大 (${(rec.size / 1048576).toFixed(2)} MB)，超过 2 MB 在线预览/编辑上限，请点击「在资源管理器中打开」。`
    };
  }

  const buf = readFileSync(abs);
  if (looksBinary(buf)) {
    return {
      ...rec,
      mimeType,
      previewKind: 'binary',
      editable: false,
      content: null,
      reason: '二进制文件不支持文本编辑，请使用系统关联程序或在资源管理器中打开。'
    };
  }

  const text = buf.toString('utf8');
  const lines = text.length === 0 ? 0 : text.split(/\r?\n/).length;
  const previewKind = rec.ext === '.md' || rec.ext === '.markdown' ? 'markdown' : 'text';
  return { ...rec, mimeType, previewKind, editable: true, lines, chars: text.length, content: text };
}

export function writeFileContent(relPath, content, createOnly = false, settings = loadSettings()) {
  const { rootDir } = settings;
  const abs = resolveSafePath(rootDir, relPath);
  if (createOnly && existsSync(abs)) throw new Error('File already exists');
  if (existsSync(abs) && statSync(abs).isDirectory()) throw new Error('Target is a directory');
  writeAtomic(abs, typeof content === 'string' ? content : '');
  return buildEntryRecord(rootDir, abs, settings.customMeta);
}

export function createFolder(relPath, sessionMeta = null, settings = loadSettings()) {
  const { rootDir } = settings;
  const abs = resolveSafePath(rootDir, relPath);
  if (existsSync(abs)) throw new Error('Folder already exists');
  mkdirSync(abs, { recursive: true });
  if (sessionMeta && typeof sessionMeta === 'object') {
    const payload = {
      title: String(sessionMeta.title || basename(abs)),
      topic: String(sessionMeta.topic || basename(abs)),
      category: String(sessionMeta.category || 'session'),
      conversationId: String(sessionMeta.conversationId || ''),
      createdAt: new Date().toISOString(),
      tags: Array.isArray(sessionMeta.tags) ? sessionMeta.tags : []
    };
    writeAtomic(join(abs, '.agy-session.json'), JSON.stringify(payload, null, 2) + '\n');
  }
  return buildEntryRecord(rootDir, abs, settings.customMeta);
}

export function renameEntry(relPath, newName, settings = loadSettings()) {
  const { rootDir, customMeta } = settings;
  if (!newName || /[/\\:*?"<>|]/.test(newName) || newName === '.' || newName === '..') {
    throw new Error('Invalid file or folder name');
  }
  const abs = resolveSafePath(rootDir, relPath);
  if (!existsSync(abs)) throw new Error('Source not found');
  const topRel = toPosixRel(rootDir, abs);
  if (!topRel || (!topRel.includes('/') && PROTECTED_TOP_DIRS.has(topRel.toLowerCase()))) {
    throw new Error('Protected top-level folder cannot be renamed');
  }
  const destAbs = resolveSafePath(rootDir, join(dirname(topRel) === '.' ? '' : dirname(topRel), newName));
  if (existsSync(destAbs)) throw new Error('A file or folder with that name already exists');
  renameSync(abs, destAbs);
  const newRel = toPosixRel(rootDir, destAbs);
  if (customMeta[topRel]) {
    customMeta[newRel] = customMeta[topRel];
    delete customMeta[topRel];
    saveSettings({ customMeta });
  }
  return buildEntryRecord(rootDir, destAbs, customMeta);
}

export function moveEntry(relPath, destDirRel, settings = loadSettings()) {
  const { rootDir, customMeta } = settings;
  const srcAbs = resolveSafePath(rootDir, relPath);
  if (!existsSync(srcAbs)) throw new Error('Source not found');
  const srcRel = toPosixRel(rootDir, srcAbs);
  if (!srcRel || (!srcRel.includes('/') && PROTECTED_TOP_DIRS.has(srcRel.toLowerCase()))) {
    throw new Error('Protected top-level folder cannot be moved');
  }
  const destDirAbs = resolveSafePath(rootDir, destDirRel || '');
  mkdirSync(destDirAbs, { recursive: true });
  const destAbs = resolveSafePath(rootDir, join(toPosixRel(rootDir, destDirAbs), basename(srcAbs)));
  if (destAbs.toLowerCase() === srcAbs.toLowerCase()) {
    return buildEntryRecord(rootDir, srcAbs, customMeta);
  }
  if (existsSync(destAbs)) throw new Error('Target already exists in destination folder');
  renameSync(srcAbs, destAbs);
  const newRel = toPosixRel(rootDir, destAbs);
  if (customMeta[srcRel]) {
    customMeta[newRel] = customMeta[srcRel];
    delete customMeta[srcRel];
    saveSettings({ customMeta });
  }
  return buildEntryRecord(rootDir, destAbs, customMeta);
}

export function deleteEntry(relPath, settings = loadSettings()) {
  const { rootDir, customMeta } = settings;
  const abs = resolveSafePath(rootDir, relPath);
  if (!existsSync(abs)) throw new Error('Target not found');
  const rel = toPosixRel(rootDir, abs);
  if (!rel || (!rel.includes('/') && PROTECTED_TOP_DIRS.has(rel.toLowerCase()))) {
    throw new Error('Protected top-level folder cannot be deleted');
  }
  const lst = lstatSync(abs);
  if (lst.isSymbolicLink()) {
    throw new Error('Refusing to delete symbolic link / junction from UI for safety');
  }
  rmSync(abs, { recursive: true, force: true });
  if (customMeta[rel]) {
    delete customMeta[rel];
    saveSettings({ customMeta });
  }
  return { deleted: rel };
}

export function updateCustomMeta(relPath, patch = {}, settings = loadSettings()) {
  const { rootDir, customMeta } = settings;
  const abs = resolveSafePath(rootDir, relPath);
  if (!existsSync(abs)) throw new Error('Target not found');
  const rel = toPosixRel(rootDir, abs);
  const prev = customMeta[rel] || {};
  const next = {
    customCategory: typeof patch.customCategory === 'string' ? patch.customCategory.trim() : (prev.customCategory || ''),
    tags: Array.isArray(patch.tags)
      ? patch.tags.map(t => String(t).trim()).filter(Boolean).slice(0, 12)
      : (prev.tags || []),
    note: typeof patch.note === 'string' ? patch.note.slice(0, 500) : (prev.note || '')
  };
  if (!next.customCategory && next.tags.length === 0 && !next.note) {
    delete customMeta[rel];
  } else {
    customMeta[rel] = next;
  }
  saveSettings({ customMeta });
  return buildEntryRecord(rootDir, abs, customMeta);
}

export function revealInExplorer(relPath = '', openFolder = false, settings = loadSettings()) {
  const { rootDir } = settings;
  const abs = resolveSafePath(rootDir, relPath || '');
  if (!existsSync(abs)) throw new Error('Path does not exist');
  const isDir = statSync(abs).isDirectory();

  if (process.platform === 'win32') {
    const safeAbs = abs.replace(/"/g, '');
    const child = (isDir && openFolder) || abs.toLowerCase() === resolve(rootDir).toLowerCase()
      ? spawn('explorer.exe', [`"${safeAbs}"`], { detached: true, stdio: 'ignore', windowsVerbatimArguments: true })
      : spawn('explorer.exe', [`/select,"${safeAbs}"`], { detached: true, stdio: 'ignore', windowsVerbatimArguments: true });
    child.unref();
  } else if (process.platform === 'darwin') {
    const args = isDir && openFolder ? [abs] : ['-R', abs];
    const child = spawn('open', args, { detached: true, stdio: 'ignore' });
    child.unref();
  } else {
    const target = isDir ? abs : dirname(abs);
    const child = spawn('xdg-open', [target], { detached: true, stdio: 'ignore' });
    child.unref();
  }
  return { ok: true, fullPath: abs };
}

export function getRawFileStreamInfo(relPath, settings = loadSettings()) {
  const { rootDir } = settings;
  const abs = resolveSafePath(rootDir, relPath);
  if (!existsSync(abs) || statSync(abs).isDirectory()) throw new Error('File not found');
  const ext = extname(abs).toLowerCase();
  const mimeType = MIME_MAP[ext] || 'application/octet-stream';
  return { absPath: abs, mimeType, size: statSync(abs).size };
}
