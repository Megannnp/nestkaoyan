<p align="center">
  <img src="public/favicon.svg" alt="筑巢考研工作台" height="72">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/授权-个人免费%20·%20商用授权-green">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D22.13-blue">
  <img src="https://img.shields.io/badge/Stack-Next.js%2016%20·%20Cloudflare%20Workers%20·%20DeepSeek-blueviolet">
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

**数据 100% 留在本地**（浏览器 localStorage，零依赖），个人 / 非商用免费使用。

> [安装说明](./INSTALL.md) · [使用说明](./USAGE.md) · [部署说明](./DEPLOY.md) · [交付清单](./CHECKLIST.md)

---

## 为什么做筑巢考研

多数考研工具要么只做题库、要么只做打卡，无法形成「学 → 练 → 复盘」闭环。筑巢考研工作台想解决的：

- **真题驱动**：从真题抽核心考点 → 知识图谱 → 动态计划（而不是从目录页开始背书）
- **7核4层6轮**：内置完整学习方法论，把「今天学什么」变成有依据的决策
- **AI 真干活**：可选 DeepSeek 分析真题、生成计划、对话即执行；未配置时明确降级，不误导
- **极简**：白卡 + 细边框 + 直接信息，专注学习本身

## 快速开始

三种安装方式，选一个即可（详见 [INSTALL.md](./INSTALL.md)）：

| 方式 | 适合谁 | 怎么装 |
|---|---|---|
| **A. Docker 一键** | 任何人（尤其 Windows） | `docker compose up -d` → http://localhost:3000 |
| **B. 双击脚本** | macOS / Windows 用户 | 双击 `install.command`（Mac）/ `install.bat`（Win） |
| **C. 开发者手动** | 想改代码 | `npm install` → `npm run dev`（需 Node ≥ 22.13） |

**数据双写本机**：浏览器 localStorage（秒开、离线）+ 本地 SQLite（`data/kaoyan.db`，权威持久化）——换浏览器、清缓存、换设备（同一局域网）数据自动恢复；默认启用**访问密码**（本机免登录，其他设备需输入）。个人 / 非商用免费使用。

**真题 PDF（可选）**：代码内置 72 套公共课真题的声明与命名规范，PDF 文件按 [`public/papers/README.md`](./public/papers/README.md) 放置后即自动以原卷浏览 + AI 讲解。开源仓库**不含真题文件**（版权材料）。

## 测试

```bash
npm run test:unit   # 单元测试（79/79）
npm test            # 构建 + 渲染冒烟
npx playwright test # E2E（68/68，需 dev server）
```

## 文档

- [INSTALL.md](./INSTALL.md) — 安装说明书
- [USAGE.md](./USAGE.md) — 使用说明书
- [DEPLOY.md](./DEPLOY.md) — Cloudflare Workers 部署
- [CHECKLIST.md](./CHECKLIST.md) — 交付前自检清单
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 架构说明
- [CHANGELOG.md](./docs/CHANGELOG.md) — 版本记录

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

## 测试

```bash
npm run lint          # ESLint
npm test              # 构建 + 渲染冒烟
npm run test:unit     # 单元测试（reducer/replay/plan-generate 等）
npm run test:e2e      # Playwright E2E（需先本地 dev server）
```

## 目录结构（产品包布局）

```
workspace-app/
├── app/                  # 前端 React（页面 + 组件 + 状态）
│   ├── components/       #   UI 组件（Sidebar/ReaderPanel/ChatPanel 等）
│   └── lib/              #   状态管理/reducer/storage/类型/AI 客户端层
├── worker/               # 后端 Cloudflare Worker（AI 路由 + API）
│   └── ai/               #   DeepSeek 调用实现（analyze-exam/plan-generate 等）
├── db/ + drizzle/        # Drizzle schema 与 SQL 迁移（D1 可选）
├── styles/               # CSS Modules（components/workspace）
├── tests/                # 单测 + E2E（Playwright）
├── .env.example          # 环境变量模板（无密钥）
├── DEPLOY.md             # 部署文档
├── CHECKLIST.md          # 部署前检查清单
└── package.json          # 脚本与依赖
```

## 开源说明

- **授权**：本项目采用**双轨授权**（见仓库根 `LICENSE`）——个人 / 学生 / 教育 / 非营利组织**免费**使用、修改、再分发（保留版权声明）；组织或任何**商业用途需购买商业授权**。
- **贡献**：欢迎提交 Issue / PR。请先跑通 `npm run lint`、`npm run test:unit`、`npx playwright test`（E2E）再提交。
- **代码结构**见上方目录树；**部署**见 [DEPLOY.md](./DEPLOY.md)；**交付自检**见 [CHECKLIST.md](./CHECKLIST.md)。

## 真题 PDF（版权材料）

> ⚠️ **开源仓库不含真题 PDF**（版权材料 + 体积约 209MB）。代码内置了 **72 套公共课真题的声明与命名规范**（政治 24 / 英语一 16 / 英语二 16 / 数学二 16），但**文件需自行放置**：

```bash
# 1. 准备带文本层（可复制/搜索）的真题 PDF，按规范命名
#    政治  -> public/papers/politics-YYYY.pdf（2003-2026）
#    英语一-> public/papers/english-YYYY.pdf（2010-2025）
#    英语二-> public/papers/english2-YYYY.pdf（2010-2025）
#    数学二-> public/papers/math2-YYYY.pdf（2010-2025）

# 2. 放入目录即自动以原卷浏览（详见 public/papers/README.md）
```

放置后 `npm run build` 即可在阅读器中原卷浏览 + AI 讲解（需配置 `DEEPSEEK_API_KEY`）。

## 数据说明

- 默认数据保存在**浏览器 localStorage**（key: `nest-exam-workspace-v5`）+ **本地 SQLite**（`data/kaoyan.db`）双写：
  - 浏览器缓存负责秒开与离线；服务端 SQLite 为权威持久化
  - **换浏览器、清缓存、换设备（同一局域网）数据自动恢复**（含 PDF/DOCX/文本文件二进制）
  - **多设备防覆盖**：服务端快照比本机新时弹窗提示，可一键载入服务端版本
  - **AI 网关配置跨设备同步**：登录后新设备自动拉取已保存的网关 URL + Key + 模型（存服务端 meta 表，受访问密码保护）
- 三种安装方式（Docker / 双击脚本 / 开发者手动）都自动启用本地 SQLite；备份 = 拷贝 `data/kaoyan.db`
- 需要**云端多端同步 / 后台统一管理**时：启用 Cloudflare D1（见 `.env.example` 与 DEPLOY.md「可选：启用 D1」）
- 用户可随时在「设置 → 数据管理」导出/导入完整学习档案（JSON 备份）

## License

双轨授权协议（个人免费 / 商用付费），见仓库根 `LICENSE`。