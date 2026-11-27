# Antigravity File Hub (`agy-file-hub`)

English | [简体中文](./README.md)

A **zero-dependency** Google Antigravity plugin that enforces automatic **per-project and per-session folder organization** globally, paired with a native side-pane Web UI to **categorize, sort, search, preview, edit, inspect, and reveal** all Antigravity files in Explorer / Finder.

## Features

- **Always-On Global Organization Rule (`rules/AGENTS.md`)**:
  - Standalone projects → `<ROOT>/projects/<project-name>/`
  - Session-generated files → `<ROOT>/sessions/<YYYY-MM-DD>_<topic>/` (with `.agy-session.json` metadata)
  - Keeps your root folder clean and avoids cluttering the system drive.
- **Native Side-Pane Visual File Manager (`sidecars/file-hub`)**:
  - **Categorize**: Tabs for Projects, Sessions, Scratch, and Storage + file-type chips (Code, Docs, Images, Data/Config, Folders) + custom tags & notes.
  - **Sort & Search**: Sort by modified time, name, size, or type (ASC/DESC), plus recursive search across filenames, paths, session titles, and tags.
  - **Preview & Inspect**: Offline Markdown renderer, line-numbered code viewer, inline image viewer, directory size/count stats, and `.agy-session.json` inspector.
  - **Inline Editor & Operations**: Edit and save text/code files atomically (`Ctrl+S`), create session/project folders or files, rename, move across categories, and safely delete (with top-level & symlink protection).
  - **Reveal in Explorer / Finder**: One-click native reveal (`explorer.exe /select` on Windows, `open -R` on macOS, `xdg-open` on Linux).

## Installation

Requires `Node.js >= 18` (zero external dependencies).

```powershell
# Windows
git clone https://github.com/XiaozhuangXzsg/agy-file-hub.git
cd agy-file-hub
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

```bash
# macOS / Linux
git clone https://github.com/XiaozhuangXzsg/agy-file-hub.git
cd agy-file-hub
bash ./install.sh
```

Enable **Antigravity File Hub** in Antigravity Customizations and open the **File Hub** side pane.

## Testing

```bash
node --test test/fs-service.test.mjs
```

## License

MIT
