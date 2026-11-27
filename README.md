# Antigravity File Hub (`agy-file-hub`)

[English](./README_EN.md) | 简体中文

一款**零依赖**的 Google Antigravity 原生侧边栏（Sidecar）插件 + 全局文件归档规则包：
- **全局自动按「项目 / 会话」分目录归档**：未显式指定工作区时，所有新建项目自动落入 `projects/<项目名>/`，所有单次会话生成的脚本、报告、配置自动隔离到独立的 `sessions/<YYYY-MM-DD>_<主题>/` 并写入 `.agy-session.json` 元数据，彻底告别文件堆成一团或占满 C 盘。
- **原生 Antigravity 侧边栏可视化文件管理器**：内置分类、多维排序、递归搜索、Markdown/代码/图片预览、在线编辑保存（`Ctrl+S`）、自定义标签、重命名/移动分类、以及一键**在系统资源管理器（Explorer / Finder）中打开定位**。

---

## 目录规范

```text
<ROOT>/                          # Windows 默认 D:\Antigravity，其他平台默认 ~/Antigravity（可在界面内自定义）
├── projects/                    # 独立项目文件夹
│   └── <project-name>/
├── sessions/                    # 按会话隔离的产出目录（每个生成文件的会话独占一个命名文件夹）
│   └── <YYYY-MM-DD>_<topic>/
│       ├── .agy-session.json    # 会话标题、主题、ID、标签元数据
│       └── ...                  # 该会话生成的全部文件
├── scratch/                     # 默认/遗留临时工作区
└── _Storage/                    # 可选迁移的内部缓存与存储
```

## 核心功能

| 功能 | 说明 |
| :--- | :--- |
| **全局自动分类规则** | 随插件内置 `rules/AGENTS.md`，启用后对所有后续会话全局生效 |
| **分类浏览与自定义标签** | 顶部按 `项目 / 会话产出 / 临时区 / 系统存储` 分栏，支持按代码/文档/图片/配置二次过滤，并支持给任意文件/目录打自定义标签与备注 |
| **多维度排序** | 支持按修改时间、名称、大小、类型升/降序排列，文件夹自动置顶 |
| **多格式预览** | 离线 Markdown 渲染预览（支持切换源码）、带行号代码/文本预览、图片原图预览、文件夹统计与 `.agy-session.json` 卡片查看 |
| **在线编辑与管理** | 内置文本/代码编辑器（`Ctrl+S` 原子写入保存）、新建会话夹/项目夹/文件、重命名、跨分类移动、安全删除（受保护顶层目录与联接防误删） |
| **在资源管理器中打开** | 任意文件/文件夹一键调用系统 `explorer.exe /select`（Windows）/ `open -R`（macOS）/ `xdg-open`（Linux）精准定位 |

## 安装方式

要求：`Node.js >= 18`（零第三方 npm 依赖）。

### Windows (PowerShell)
```powershell
git clone https://github.com/XiaozhuangXzsg/agy-file-hub.git
cd agy-file-hub
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

### macOS / Linux
```bash
git clone https://github.com/XiaozhuangXzsg/agy-file-hub.git
cd agy-file-hub
bash ./install.sh
```

安装后在 Antigravity 的 **Customizations（自定义）** 中启用 **Antigravity File Hub**，点击右侧辅助栏中的 **File Hub** 即可打开可视化面板。

## 本地独立调试与测试

```bash
# 运行自动化测试（含路径越权安全校验与 HTTP API 集成测试）
node --test test/fs-service.test.mjs

# 独立启动本地 Web 预览
node sidecars/file-hub/main.mjs --port 18920
```

## License

MIT
