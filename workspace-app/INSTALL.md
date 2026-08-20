# 筑巢考研工作台 · 安装说明书（手把手版）

> 跟着做就行，大约 10 分钟跑起来。数据默认存在**你自己浏览器的 localStorage**（零外部数据库），断网也能用。
> 完全不想碰命令行？选 **路 A（Docker Desktop，图形界面）**，或请懂电脑的朋友帮忙双击一键脚本。

---

## 0. 先选一条路

| 选择 | 适合谁 | 你要装什么 |
|---|---|---|
| **A. Docker 一键**（最省事） | 任何人，尤其是 Windows 用户 | Docker Desktop（图形界面） |
| **B. 一键脚本** | macOS / Windows，会双击文件 | Node.js ≥ 22.13 |
| **C. 开发者手动** | 想改代码 / 二次开发 | Node.js ≥ 22.13 + git |

> ⚠️ 需要 **Node.js ≥ 22.13**（路 B/C）或 **Docker**（路 A，已内置 Node 环境）。

---

## 路 A：Docker 一键（推荐新手）

### A1. 安装 Docker Desktop

1. 打开 `docker.com/products/docker-desktop`，下载你系统的安装包
2. 双击安装，装完打开 Docker Desktop（首次可能提示登录/授权，允许即可）
3. 等右上角图标变绿（鲸鱼不再转圈）——Docker 就绪

> ✅ Docker Desktop 图标正常、显示 "running"。
> ❌ 装不上？改选 **路 B**。

### A2. 启动筑巢考研

打开终端（Windows: 按 `Win` 搜 `cmd`；macOS: 启动台→其他→终端），进到项目文件夹后运行：

```bash
cd 你的项目文件夹路径
docker compose up -d
```

首次会自动构建两个镜像（约 3~5 分钟，之后秒开）：`kaoyan-exam-workspace`（应用）和 `kaoyan-db`（本地 SQLite 数据库）。

> ✅ 出现 `Started` 或 `Container ... Started`。
> ❌ 报错？贴日志到 Issue，或 `docker compose down && docker compose up -d --build` 重试。

### A3. 打开使用

浏览器访问 **http://localhost:3000**

> 💡 **数据持久化**：Docker 模式自动启用本地 SQLite（`kaoyan-db` 容器），工作区数据存于数据卷 `kaoyan-data`——
> **换浏览器、清缓存、换设备（同一局域网）数据都不会丢**，首次打开自动从服务端恢复。
> 备份 = 直接拷贝 SQLite 数据文件（或备份数据卷）。

> 💡 真题 PDF：放到项目里新建的 `papers/` 文件夹（与 `public/papers/README.md` 的命名规范一致），刷新即自动出现。

---

## 路 B：一键脚本（macOS / Windows）

### B1. 安装 Node.js

1. 打开 `nodejs.org`，下载 **LTS** 版本
2. 双击安装，一路"下一步"
3. 验证：打开终端，运行 `node -v`

> ✅ 显示 `v22.13.0` 或更高。
> ❌ 提示"找不到命令"？重装一遍 LTS，或改走 **路 A**。

### B2. 双击一键脚本

| 系统 | 双击 |
|---|---|
| macOS | `install.command`（首次若提示"无法打开"，右键→打开） |
| Windows | `install.bat` |

脚本自动完成：检查 Node → 装依赖 → 构建 → **启动本地 SQLite** → 启动 → 打开浏览器。

> ✅ 看到「🎉 安装完成！」并自动打开 http://localhost:3000。
> ❌ 窗口一闪而过？右键脚本→用终端/命令提示符打开，看报错。
> 💡 **数据持久化**：脚本会同时启动本地 SQLite（`data/kaoyan.db`），换浏览器/清缓存数据不丢；
> 备份 = 拷贝 `data/kaoyan.db`（或「设置 → 数据管理 → 导出」）。
> 🔑 **访问密码**：首次安装自动生成（保存在 `data/password.txt`），**本机打开免登录**，
> 其他设备（手机/局域网）访问需输入该密码。

### B3. 常用命令（手动重启）

```bash
# 重新构建 + 启动
npm run build
npm run start          # 默认 http://localhost:3000（可 PORT=3100 npm run start 换端口）
```

---

## 路 C：开发者手动

```bash
# 1. 装依赖
npm install

# 2.（可选）配置 AI：cp .env.example .dev.vars 并填入你的 DeepSeek key
#    不填也能用——AI 功能诚实降级为「演示回复」，不误导。

# 3. 开发模式（热更新）
npm run dev             # http://localhost:3000

# 4. 生产构建 + 本地预览
npm run build
npm run start
```

**测试**：

```bash
npm run lint            # ESLint（0 错误）
npm run test:unit       # 单元测试（79/79）
npm test                # 构建 + 渲染冒烟
npx playwright test     # E2E（68/68，需先启动 dev server）
```

---

## 真题 PDF（可选，版权材料）

代码内置 **72 套公共课真题的声明与命名规范**（政治 24 / 英语一 16 / 英语二 16 / 数学二 16），但 **PDF 文件需自行放置**（版权材料，不入仓库、不入镜像）：

```bash
# 命名规范（详见 public/papers/README.md）
#   政治  -> public/papers/politics-YYYY.pdf（2003-2026）
#   英语一-> public/papers/english-YYYY.pdf（2010-2025）
#   英语二-> public/papers/english2-YYYY.pdf（2010-2025）
#   数学二-> public/papers/math2-YYYY.pdf（2010-2025）
```

- **路 A**：放到项目根 `papers/`（docker 卷已挂载）
- **路 B/C**：放到 `public/papers/`，然后重新 `npm run build` 或重启
- 没有 PDF 也能正常使用：上传自己的资料（PDF/DOCX/TXT/MD/图片）即可

---

## 上线到公网（可选）

需要手机随时访问 / 给朋友用？部署到 **Cloudflare Workers**（全球网络，免费额度充足）：

```bash
npm run build
npx wrangler login
npx wrangler secret put DEEPSEEK_API_KEY   # 填你的 key（可选）
npm run deploy
```

详细步骤与排错见 [DEPLOY.md](./DEPLOY.md)。

---

## 常见问题

| 问题 | 解决 |
|---|---|
| 端口被占用 | 换端口：`PORT=3100 npm run start`（路 B）或改 docker-compose.yml 的 `3000:3000` 为 `3100:3000` |
| 手机打不开电脑的 localhost | 手机连同一 WiFi，访问 `http://电脑IP:3000`；需输入访问密码（首次安装自动生成，见 `data/password.txt`） |
| 其他设备访问要密码吗 | 默认启用访问密码：**本机（localhost）免登录**，局域网/其他设备需输入密码；密码在 `data/password.txt`（Docker 在 `/app/data/password.txt`，容器日志也会打印） |
| 忘记访问密码 | 打开 `data/password.txt` 查看；或删除该文件后重启（会重新生成） |
| AI 提示"演示回复" | 在「设置 → AI 学习助手」填入你的 DeepSeek key（key 只存本机） |
| 数据会丢吗 | 三种安装方式都自动启用本地 SQLite（`data/kaoyan.db`），换浏览器/清缓存不丢；备份 = 拷贝该文件或「设置 → 数据管理 → 导出」 |
| 想用数据库 / 多端同步 | 已内置本地 SQLite（所有安装方式）；云端多端同步见 [DEPLOY.md](./DEPLOY.md)「可选：启用 D1」 |

