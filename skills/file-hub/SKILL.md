---
name: file-hub
description: Manage, categorize, search, preview, edit, and reveal files in the Antigravity File Hub directory (projects/ and sessions/), or open the File Hub side-pane UI.
---

# Antigravity File Hub

Use this skill when the user asks to browse, categorize, organize, search, preview, edit, or open Antigravity-generated files in Explorer/Finder.

## Opening the Visual Manager

If the `agy-file-hub` plugin is enabled and running, offer the side-pane pill so the user can open the interactive manager in one click:

`[File Hub](sidecar://agy-file-hub/file-hub/)`

## Organizing Loose Files

When asked to organize loose files under the Antigravity root directory (`D:\Antigravity` or configured `rootDir`):
1. Move standalone multi-file repositories/apps into `<ROOT>/projects/<project-name>/`.
2. Group ad-hoc scripts, reports, and exports by date/topic into `<ROOT>/sessions/<YYYY-MM-DD>_<topic>/` and create a `.agy-session.json` metadata file describing the session title and tags.
3. Preserve `<ROOT>/_Storage/` and `<ROOT>/scratch/` untouched unless the user specifically asks to clean them.
