# 部署指南（DEPLOY.md）

> 目标：让网站**永线在线、可恢复、可复制**。
> 本项目是 **Cloudflare Workers 全栈**，云端全球网络自带高可用，不依赖你个人电脑开机。

---

## 一、正确的部署认知（重要）

| 场景 | 正确做法 | 错误做法 |
|------|----------|----------|
| **线上访问** | 部署到 **Cloudflare Workers**（本项目原生支持） | 在自己电脑跑 `npm run dev`（关机即断线） |
| **架构** | vinext = 前端 React + 后端 Worker **同一部署单元** | 拆成 VPS + Nginx + Node + MySQL |
| **数据库** | 本机部署默认「浏览器 localStorage + 本地 SQLite 双写」（免运维、数据不丢）；线上云端多端同步才启用 **D1** | 强制引入本地 MySQL |
| **AI 密钥** | Worker 机密（`wrangler secret put`），每套部署换自己的 key | 写死在代码里 |

**为什么 Cloudflare Workers 永不掉线？**
- 部署在全球 300+ 数据中心边缘网络，任何节点故障自动切换
- 无「服务器关机/重启/内存溢出」概念，天然无状态冷启动即用
- 免费版每日 10 万请求，个人备考场景绰绰有余
- 域名/部署全托管，你只需 `wrangler deploy` 一条命令发布

---

## 二、部署前置条件

| 要求 | 检查命令 |
|------|----------|
| Node.js ≥ 22.13 | `node -v` |
| Cloudflare 账号（免费） | https://dash.cloudflare.com/sign-up |
| Cloudflare CLI（随项目安装） | `npx wrangler --version` |

---

## 三、生产部署步骤（Cloudflare Workers）

```bash
# 1. 安装依赖
npm install

# 2. 登录 Cloudflare（浏览器弹出授权，只做一次）
npx wrangler login

# 3. 构建生产产物（产出 dist/）
npm run build

# 4. 配置 AI 密钥（部署方自己的 DeepSeek key）
npx wrangler secret put DEEPSEEK_API_KEY
# 提示输入时粘贴 key。输入即上云，不出现在代码/仓库里。

# 5. 部署（首次会生成 workers.dev 子域名，如 zhu-chao.workers.dev）
npx wrangler deploy
```

部署成功输出示例：
```
Uploaded 1 of 1 assets
Worker Startup Time (avg): 1.2 ms
Deployed zhu-chao.workers.dev (5.3 ms)
```

**之后每次更新**，只需：
```bash
npm run build && npx wrangler deploy
```

---

## 四、绑定自有域名（推荐）

1. Cloudflare 控制台 → Workers & Pages → 你的 Worker → **自定义域**
2. 添加域名（如 `kaoyan.example.com`），Cloudflare 自动配置 DNS + HTTPS
3. 访问 `https://kaoyan.example.com` 即为加密线上服务

---

## 五、本机/局域网与云数据库

**本机 / 局域网（Docker、双击脚本、手动）**：默认启用**本地 SQLite 同步服务**（`database/server.mjs`，零依赖 `node:sqlite`）——浏览器 localStorage 秒开离线，服务端 SQLite 权威持久化，换浏览器 / 换设备（同一局域网）自动恢复，默认启用访问密码。

**云端（Cloudflare Workers）**：数据在浏览器 localStorage；**只有**需要以下能力时才启用 D1：

- 多设备共享同一个学习档案（云端多端同步）
- 后台统一查看/管理所有用户数据

启用步骤（需要 Cloudflare D1 数据库）：
```bash
# 1. 在 .openai/hosting.json 设置  "d1": "你的库名"
# 2. 创建 D1 数据库
npx wrangler d1 create kaoyan-workspace

# 3. 生成并应用迁移（db/schema.ts 已在项目内）
npm run db:generate
npx wrangler d1 migrations apply kaoyan-workspace --remote

# 4. 重新部署
npm run build && npx wrangler deploy
```

> 代码中已预留 `mirrorWorkspaceToD1()`（storage.ts）与本地 `WORKSPACE_DB_URL` 代理（worker），本机 SQLite / 云端 D1 共用同一套 `/api/workspace` 契约，启用哪个后端由环境变量决定。

---

## 六、永线在线保障清单

| 保障项 | 实现 |
|--------|------|
| 24 小时在线 | Cloudflare Workers 全球边缘网络（无需自管进程） |
| 零停机发布 | `wrangler deploy` 无缝替换版本，无重启窗口 |
| 密钥安全 | Worker 机密 + `.dev.vars` 本地开发，双环境均不入 Git |
| 数据可备份 | 本机 SQLite 文件 + 「设置 → 数据管理」导出 JSON；云端启 D1 后自动备份 |
| 恢复能力 | 代码在 Git；密钥在 Cloudflare 面板；数据可导出导入 |

---

## 七、本地开发注意事项（防止开发期断线）

- 每次只跑**一个** dev server（`npm run dev`），不要与 `npm run build`、多次 playwright 并行共用 3000 端口
- E2E 测试请用 `npm run test:e2e`（playwright 会自动管理端口与 server）
- 改了 `worker/*.ts` 后先 `npm run build` 确认产物，再重启 dev server
- 需要长期演示时用 `npm run start`（生产模式静态服务），比 dev 模式稳定

---

## 八、常见问题

**Q：`wrangler deploy` 提示未登录？**
A：执行 `npx wrangler login`，浏览器完成授权后重试。

**Q：AI 功能提示「服务端未配置 DEEPSEEK_API_KEY」？**
A：本地开发在 `.dev.vars` 填入；生产执行 `npx wrangler secret put DEEPSEEK_API_KEY`。

**Q：本地 `ERR_CONNECTION_REFUSED`？**
A：dev server 未启动或端口被占用。先 `pkill -f "vinext dev"` 再 `npm run dev`。

**Q：想让别人也能跑起来？**
A：把整个 `workspace-app/`（含 README/DEPLOY/CHECKLIST/.env.example）交付，接手方执行：
```bash
npm install && cp .env.example .dev.vars && npm run dev
```
即可本地运行；按本指南即可上线。