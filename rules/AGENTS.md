# Antigravity File Hub — Global Workspace & Session Organization Rules

When no active project workspace is explicitly set by the user, follow these directory rules strictly for all generated files:

1. **Unified Root Directory**:
   - Check `~/.gemini/antigravity/plugin_data/agy-file-hub/settings.json` (`rootDir`) if present; otherwise default to `D:\Antigravity\` on Windows (when `D:\Antigravity` exists) or `~/Antigravity/`.
   - Never drop loose files directly into the root directory or onto the system drive (`C:\`) unless explicitly requested by the user or required by the runtime environment.

2. **Strict Separation by Project vs. Session**:
   - **Standalone Projects** → `<ROOT>/projects/<project-name>/`
     - Choose a concise, semantic folder name (e.g., `kebab-case`).
   - **Session-Generated Files** (scripts, reports, exports, configs, patches, downloads, ad-hoc tools) → `<ROOT>/sessions/<YYYY-MM-DD>_<concise-topic>/`
     - Whenever a conversation creates any file outside an explicit workspace, it MUST create its own dedicated, meaningfully named subfolder under `<ROOT>/sessions/` and store all files generated during that conversation inside that folder.
     - Never scatter files into the root folder or mix files into another conversation's folder.
     - Write a lightweight `.agy-session.json` file inside the new session folder:
       ```json
       {
         "title": "Human-readable session title",
         "topic": "concise-topic-slug",
         "category": "session",
         "conversationId": "<current-conversation-id>",
         "createdAt": "<ISO-8601 timestamp>",
         "tags": ["optional", "tags"]
       }
       ```

3. **Keep Internal Storage Clean**:
   - Reserve `<ROOT>/_Storage/` for migrated Antigravity internal caches/data and `<ROOT>/scratch/` for legacy scratch links.
