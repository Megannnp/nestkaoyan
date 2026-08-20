<p align="center">
  <img src="public/favicon.svg" alt="筑巢考研工作台" height="72">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/授权-个人免费%20·%20商用授权-green">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D22.13-blue">
  <img src="https://img.shields.io/badge/Stack-Next.js%2016%20·%20SQLite%20·%20Cloudflare%20Workers-blueviolet">
  <img src="https://img.shields.io/badge/安装-Docker%20一键%20·%20双击脚本%20·%20npm-orange">
  <img src="https://github.com/Megannnp/KaoyanPlatform/actions/workflows/ci.yml/badge.svg" alt="CI">
</p>

# 筑巢考研工作台（NestKaoyan）

> 一套「逆向设计 × 7核 × 4层 × 6轮」的 **AI 考研学习系统**：目标先行 → 知识图谱 → 动态计划 → Agent 闭环，帮助备考者从「知道」到「会用」。

- 📋 **今日工作台**：每日任务、学习计时、打卡热力图
- 🤖 **AI 学习助手**（可选）：真题分析 / 计划生成 / 对话即执行——支持**任意 OpenAI 兼容网关**（DeepSeek / 通义千问 / Kimi / Ollama 本地模型等），无密钥时优雅降级为本地规则
- 📚 **知识中心**：真题库（72 套公共课声明）+ PDF 原卷阅读（文字层选择成批注）+ 知识图谱
- 🗂️ **成长卡片**：卡片背诵 + 复习队列（间隔重复）
- ⚙️ **设置**：考试目标 / 科目 / AI / 学习方法 / 数据导出导入
- 🔑 **访问密码**：本机免登录，其他设备（手机/局域网）访问需密码，数据不裸奔

**数据双写本机**（浏览器 localStorage + 本地 SQLite，`data/kaoyan.db`）：换浏览器、清缓存、换设备（同一局域网）自动恢复；个人 / 非商用免费使用。

> [安装说明](./INSTALL.md) · [使用说明](./USAGE.md) · [部署说明](./DEPLOY.md) · [交付清单](./CHECKLIST.md)

---

## 👋 先看这里（1 分钟读懂）

**这是什么**：装在自己电脑（或局域网服务器）上的「AI 考研学习系统」——真题驱动 → 知识图谱 → 动态计划 → 复盘闭环。

**你是哪类人，就只看对应那篇**：

| 你属于… | 看这份 |
|---|---|
| 已经有人帮你装好了，只管用 | **[USAGE.md](./USAGE.md) 怎么用**（大白话，30 秒上手） |
| 想弄懂这套学习方法（7核·4层·6轮） | **[METHODOLOGY.md](./docs/METHODOLOGY.md) 学习方法论** |
| 想自己装（需要会打开终端、敲命令） | **[INSTALL.md](./INSTALL.md) 安装**（一步步来，Docker / 双击脚本 / 手动三种方式） |
| 装好了想上线到公网 / 手机随时访问 | **[DEPLOY.md](./DEPLOY.md) 部署** |
| 交付 / 接手前自检 | **[CHECKLIST.md](./CHECKLIST.md) 交付清单** |

> 个人用**完全免费**；只有公司 / 商用才需要买授权（见文末「授权」）。

## 为什么做筑巢考研

多数考研工具要么只做题库、要么只做打卡，无法形成「学 → 练 → 复盘」闭环。筑巢考研工作台想解决的：

- **真题驱动**：从真题抽核心考点 → 知识图谱 → 动态计划（而不是从目录页开始背书）
- **7核4层6轮**：内置完整学习方法论，把「今天学什么」变成有依据的决策
- **AI 真干活**：可选 AI 分析真题、生成计划、对话即执行；未配置时明确降级，不误导
- **数据不丢**：浏览器 + 本地 SQLite 双写，换设备自动恢复，多设备防覆盖
- **极简**：白卡 + 细边框 + 直接信息，专注学习本身

## 快速开始

> ⚠️ 下面几步需要命令行操作。完全不会命令行？可以双击 `install.command`（Mac）/ `install.bat`（Win）一键装，或用 Docker Desktop（图形界面）。

三种安装方式，选一个即可（详见 [INSTALL.md](./INSTALL.md)）：

| 方式 | 适合谁 | 怎么装 |
|---|---|---|
| **A. Docker 一键** | 任何人（尤其 Windows） | `docker compose up -d` → http://localhost:3000 |
| **B. 双击脚本** | macOS / Windows 用户 | 双击 `install.command`（Mac）/ `install.bat`（Win），自动生成访问密码 |
| **C. 开发者手动** | 想改代码 | `npm install` → `npm run dev`（需 Node ≥ 22.13） |

```bash
# 开发者手动（Node.js ≥ 22.13）
npm install
npm run db:start          # 另开终端：本地 SQLite 同步服务（数据持久化）
npm run dev               # http://localhost:3000
npm run build             # 生产构建（产出 dist/）
npm run deploy            # 上线 Cloudflare Workers
```

**访问密码**：三种安装方式都默认启用（首次自动生成，见 `data/password.txt`）——本机打开免登录，其他设备（手机/局域网）访问需输入密码。

**真题 PDF（可选）**：代码内置 72 套公共课真题的声明与命名规范，PDF 文件按 [`public/papers/README.md`](./public/papers/README.md) 放置后即自动以原卷浏览 + AI 讲解。开源仓库**不含真题文件**（版权材料）。

## AI 助手（可选，按需选档）

> **装工作台本身不需要装任何 AI 软件**。不配 AI，任务 / 知识 / 复盘 / 计划全部照常使用，AI 会明确显示「演示回复」，不误导。

| 需求 | 配置 | 要装软件吗 |
|---|---|---|
| 在线问答 / 真题分析 / 计划生成 | 设置页填**网关地址 + API Key**（DeepSeek / 通义千问 / Kimi 等任意 OpenAI 兼容端点） | ❌ 不用装，注册拿 Key 即可 |
| 离线问答（数据不出机器） | 网关填 `http://localhost:11434/v1/chat/completions`（本地 Ollama） | 装 Ollama（免费，可选） |

配置会**自动同步**到服务端（换设备不用重填，受访问密码保护）。未配置 AI 时全部功能正常使用。

## 测试

```bash
npm run test:unit   # 单元测试（113/113）
npm test            # 构建 + 渲染冒烟
npx playwright test # E2E（68/68，需 dev server）
```

## 文档

- [INSTALL.md](./INSTALL.md) — 安装说明书（三种方式，手把手）
- [USAGE.md](./USAGE.md) — 使用说明书
- [METHODOLOGY.md](./docs/METHODOLOGY.md) — 学习方法论（逆向设计 × 7核 × 4层 × 6轮）
- [DEPLOY.md](./DEPLOY.md) — 部署（本机 / 局域网 / Cloudflare Workers）
- [CHECKLIST.md](./CHECKLIST.md) — 交付前自检清单
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 开发者架构
- [CHANGELOG.md](./docs/CHANGELOG.md) — 版本记录

## 数据说明

- 默认**双写**：浏览器 localStorage（秒开离线）+ 本地 SQLite（`data/kaoyan.db`，权威持久化）
- **换浏览器、清缓存、换设备（同一局域网）自动恢复**（含 PDF/DOCX/文本文件二进制）
- **多设备防覆盖**：服务端快照比本机新时弹窗提示，可一键载入服务端版本
- **AI 网关配置跨设备同步**：新设备自动拉取已保存的网关 URL + Key + 模型（受访问密码保护）
- 备份 = 拷贝 `data/kaoyan.db`（或「设置 → 数据管理 → 导出」JSON）
- 云端多端同步可启用 Cloudflare D1（见 [DEPLOY.md](./DEPLOY.md)）

## 目录结构（产品包布局）

```text
workspace-app/
├── app/                  # 前端 React（页面 + 组件 + 状态）
│   ├── components/       #   UI 组件（Sidebar/ReaderPanel/ChatPanel 等）
│   └── lib/              #   状态管理/reducer/storage/类型/AI 客户端层
├── worker/               # 后端 Cloudflare Worker（AI 路由 + API + OpenAI 兼容网关）
├── database/             # 本地 SQLite 同步服务（server.mjs，零依赖 node:sqlite）
├── db/ + drizzle/        # Drizzle schema 与 SQL 迁移（D1 可选）
├── tests/                # 单测 + E2E（Playwright）
├── .env.example          # 环境变量模板（无密钥）
├── DEPLOY.md             # 部署文档
├── CHECKLIST.md          # 部署前检查清单
└── package.json          # 脚本与依赖
```

## 授权

**双轨授权**：个人 / 学生 / 教育 / 非营利组织**免费**使用、修改、再分发（保留版权声明）；组织或任何**商业用途需购买商业授权**。详见 [LICENSE](./LICENSE)。

© 2026 重庆语梦筑巢科技有限责任公司 · 筑巢考研工作台™

## 贡献

欢迎提 Issue、PR、建议。开发环境：

```bash
npm run dev         # 开发
npm run test:unit   # 单元测试
npm run lint        # lint
npx playwright test # E2E
```

## License

筑巢考研工作台 is dual-licensed: free for personal / non-commercial use, commercial use requires a paid license. See [LICENSE](./LICENSE).
