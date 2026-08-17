# 筑巢考研工作台（Kaoyan Exam Workspace）

> 一套「逆向设计 × 7核 × 4层 × 6轮」的 AI 考研学习系统。
> 目标先行 → 知识图谱 → 动态计划 → Agent 闭环，帮助备考者从「知道」到「会用」。

## 产品定位

- **内核**：先看考试要什么（逆向设计），从真题抽出 7 个核心，按「理解 → 展开 → 练习 → 综合」4 层递进，整门课走「打底 → 连线 → 补漏 → 提速 → 真题 → 冲刺」6 轮
- **支撑**：知识图谱（知识点依赖网）+ 学习者模型（每个点的掌握度快照）+ 动态计划（AI 每天推理今天该做什么）
- **形态**：前端 React + 后端 Cloudflare Worker 全栈，数据默认存浏览器 localStorage（单机免运维）

## 功能模块

| 模块 | 说明 |
|------|------|
| 今日工作台 | 每日任务、计时、学习打卡 |
| AI 学习助手 | 自动安排学习、修改前询问、识别资料后确认 |
| 知识中心 | 学习资料（PDF 阅读 + 批注）、知识点图谱、题目练习 |
| 成长卡片 | 卡片背诵 + 复习队列 |
| 学习方法 | 内置整套学习系统说明（设置 → 学习方法） |
| 数据管理 | 本地数据导出 / 导入备份 |

## 技术栈（真实架构，交付时必须按此理解）

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | React 19 + Next.js 16（vinext） | `app/` 目录，服务端渲染 |
| 后端 | Cloudflare Workers（vinext Worker） | `worker/` 目录，同一部署单元 |
| AI | DeepSeek API（服务端调用） | `worker/ai/*`，key 只在 `env.DEEPSEEK_API_KEY` 读取 |
| 数据 | 浏览器 localStorage（默认）/ Cloudflare D1（可选） | 唯一读写入口 `app/lib/storage.ts` |
| 构建 | Vinext（Cloudflare 全栈构建器） | `npm run build` 产出 `dist/` |

> ⚠️ **架构约束**：本项目是 **Cloudflare Workers 全栈**（vinext 引擎），不是传统「React + Node + MySQL」。
> 部署目标是 Cloudflare Workers（含本地/自带域名/workers.dev），不要按 VPS + Nginx + MySQL 去部署。

## 快速开始（本地开发）

```bash
npm install

# 1. 配置密钥（本地开发）
cp .env.example .dev.vars
# 编辑 .dev.vars，填入 DEEPSEEK_API_KEY

# 2. 启动开发服务器
npm run dev        # 默认 http://localhost:3000

# 3. 构建验证（产出 dist/）
npm run build
```

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

- **许可证**：本项目以 **MIT License** 开源（见仓库根 `LICENSE`）。可自由使用、修改、商用，保留版权声明即可。
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

- 当前默认数据保存在**浏览器 localStorage**（key: `nest-exam-workspace-v5`），无需数据库即可运行
- 需要**多端同步 / 后台统一管理**时：启用 Cloudflare D1（见 `.env.example` 与 DEPLOY.md「可选：启用 D1」）
- 用户可随时在「设置 → 数据管理」导出/导入完整学习档案（JSON 备份）

## License

MIT License（见仓库根 `LICENSE`）。