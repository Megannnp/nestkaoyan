# 数据库交付说明（database/）

> 数据策略：**默认零数据库运行**（浏览器 localStorage）；需要数据不跟浏览器走时，
> 可启用**本地 SQLite 同步服务**（Docker/局域网）或 **Cloudflare D1**（云端）。
> 所有业务数据以 JSON 快照存于单张表，schema 极简、易迁移、易备份。

---

## 一、默认数据存储（当前生产形态）

- 位置：**浏览器 localStorage**（key: `nest-exam-workspace-v5`）
- 无需数据库、无需运维，单机可用
- 读写唯一入口：`app/lib/storage.ts`（`hydrateWorkspace` / `saveWorkspace`）
- 备份：用户「设置 → 数据管理 → 导出」下载完整 JSON；导入可恢复

**局限**（需要时才升级下面两种方案）：
- 数据绑定浏览器，换设备/清缓存需手动导出导入
- 无法多端同步、无法后台统一管控

---

## 二、本地 SQLite 同步服务（database/server.mjs，Docker/局域网，可选）

零依赖的轻量 HTTP 服务（基于 Node 内置 `node:sqlite`，Node ≥ 22.5），
为打包安装（`docker compose`）提供**服务端 SQLite 持久化**：

- 浏览器保存时自动 `PUT /api/workspace` → worker 代理到本服务 → 写入 SQLite 文件
- 新浏览器 / 换设备（同一局域网）首次打开自动 `GET /api/workspace` → 从服务端恢复
- 备份 = 直接拷贝 SQLite 文件（默认 `data/kaoyan.db`，docker volume `kaoyan-data`）

### 表结构（与 D1 一致，`db/schema.ts` 已定义）

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | text (PK) | 快照标识（当前固定 `default`） |
| `storage_version` | integer | 存储契约版本（当前 6） |
| `payload` | text | 完整工作区 JSON（考试/科目/任务/知识点/资料/卡片…） |
| `updated_at` | text | 最后更新时间（默认 CURRENT_TIMESTAMP） |

### worker 后端选择顺序

1. `env.DB`（Cloudflare D1，云端部署）
2. `env.WORKSPACE_DB_URL` / `process.env.WORKSPACE_DB_URL`（本地 SQLite，Docker）
3. 都没有 → 纯 localStorage 模式（双击脚本 / 快速体验）

### 运行（Docker 已由 docker-compose 编排）

```bash
cd database
node server.mjs          # 默认 :3001，数据 ./data/kaoyan.db
docker build -t kaoyan-db . && docker run -p 3001:3001 -v $(pwd)/data:/app/data kaoyan-db
```

详见 [database/README 详见 server.mjs 头部注释](./server.mjs)。

---

## 三、云数据库（Cloudflare D1，可选）

启用后工作区快照自动镜像写入 D1（代码已预留 `mirrorWorkspaceToD1()`）。

### 表结构（同 §二）

### 启用步骤

```bash
# 1. 绑定 D1（改 .openai/hosting.json）
#    { "d1": "kaoyan-workspace", "r2": null }

# 2. 创建数据库
npx wrangler d1 create kaoyan-workspace

# 3. 应用迁移
npm run db:generate
npx wrangler d1 migrations apply kaoyan-workspace --remote

# 4. 重新部署
npm run build && npx wrangler deploy
```

---

## 四、备份与恢复（无论哪种存储）

| 场景 | 操作 |
|------|------|
| 单机备份 | 设置 → 数据管理 → 导出 JSON（建议每次大版本更新后导出一次） |
| 换设备迁移 | 旧设备导出 → 新设备同一浏览器打开 → 导入；或启用 SQLite/D1 后自动同步 |
| 本地 SQLite 备份 | 直接拷贝 `data/kaoyan.db`（或 docker volume 快照） |
| D1 备份 | `npx wrangler d1 export kaoyan-workspace --remote --output=backup.sql` |
| D1 恢复 | `npx wrangler d1 execute kaoyan-workspace --remote --file=backup.sql` |

---

## 五、为什么不是传统 MySQL？

- 本项目是 **Cloudflare Workers 全栈**（vinext），云上数据库配套是 **D1（SQLite 系）**
- 本地打包安装的持久化由**零依赖 SQLite 服务**承担（同样 SQLite 系，模型完全一致）
- 单张快照表的模型天然契合「整份工作区 = 一个 JSON」，D1/SQLite 即够、零运维
- 未来若做「多用户 SaaS 后台」，可基于 `payload` 按用户 id 加一列拆分，不必推翻架构
