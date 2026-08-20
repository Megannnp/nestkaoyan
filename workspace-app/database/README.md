# 数据库交付说明（database/）

> 数据策略：**浏览器 localStorage + 本地 SQLite 双写**（换浏览器/清缓存不丢）；
> 云端部署时可选 **Cloudflare D1**。工作区以 JSON 快照存于单张表，文件二进制独立落盘，
> schema 极简、易迁移、易备份。

---

## 一、默认数据存储（双写：浏览器缓存 + 本地 SQLite）

- 浏览器 **localStorage**（key: `nest-exam-workspace-v5`）：秒开 + 离线
- 本地 **SQLite**（`data/kaoyan.db`，由 `database/server.mjs` 提供）：权威持久化
- **文件二进制**（PDF/DOCX/文本/图片）存 IndexedDB + 镜像到服务端 `data/files/`
- 读写唯一入口：`app/lib/storage.ts`（`hydrateWorkspace` / `saveWorkspace`）
- 备份：拷贝 `data/kaoyan.db` + `data/files/`，或「设置 → 数据管理 → 导出」JSON

**效果**：换浏览器、清缓存、换设备（同一局域网）数据自动恢复，无需手动导出导入。

---

## 二、本地 SQLite 同步服务（database/server.mjs，零依赖）

零依赖的轻量 HTTP 服务（基于 Node 内置 `node:sqlite`，Node ≥ 22.5），
为打包安装（Docker / 双击脚本 / 手动）提供**服务端 SQLite 持久化**：

- 浏览器保存时自动 `PUT /api/workspace` → worker 代理到本服务 → 写入 SQLite 文件
- 新浏览器 / 换设备（同一局域网）首次打开自动 `GET /api/workspace` → 从服务端恢复
- **PDF/DOCX/文本文件**上传时镜像 `PUT /api/files/:key`，恢复时自动拉回
- 备份 = 拷贝 SQLite 文件 + `files/` 目录（默认 `data/`，docker volume `kaoyan-data`）

### 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 健康检查 `{ ok: true }` |
| GET | `/workspace` | 返回最近快照 `{ ok, snapshot, storageVersion, updatedAt }` |
| PUT | `/workspace` | 覆盖保存完整工作区快照 `{ ok }` |
| PUT | `/files/:key` | 上传文件二进制（落盘 `data/files/`，key 经 base64url 安全转码） |
| GET | `/files/:key` | 下载文件二进制流 |
| HEAD | `/files/:key` | 文件存在性检查（200/404） |
| DELETE | `/files/:key` | 删除文件（幂等） |
| POST | `/files/gc` | 孤儿文件 GC：删除不在 active 列表中的文件（崩溃残留兜底） |
| GET | `/ai-key` | 读取 AI 密钥（跨设备同步，受访问密码保护） |
| PUT | `/ai-key` | 保存 AI 密钥（body `{ key }`） |

> key 仅允许 `[A-Za-z0-9._:-]`，防路径穿越；单文件上限 `MAX_FILE_BYTES`（默认 200MB）。

### 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | `3001` | 监听端口 |
| `HOST` | `127.0.0.1` | 监听地址（默认仅本机，防止数据接口直连暴露；Docker 内部网络设 `0.0.0.0`） |
| `DB_PATH` | `./data/kaoyan.db` | SQLite 文件路径（Docker 挂卷到 `/app/data`） |
| `MAX_FILE_BYTES` | `200MB` | 单文件上传上限 |
| `MAX_WORKSPACE_BYTES` | `50MB` | 工作区快照上限（防超大数据撑爆库） |

### 表结构（与 D1 一致，`db/schema.ts` 已定义）

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | text (PK) | 快照标识（当前固定 `default`） |
| `storage_version` | integer | 存储契约版本（当前 6） |
| `payload` | text | 完整工作区 JSON（考试/科目/任务/知识点/资料/卡片…） |
| `updated_at` | text | 最后更新时间（默认 CURRENT_TIMESTAMP） |

### worker 后端选择顺序

1. `env.DB`（Cloudflare D1，云端部署）
2. `env.WORKSPACE_DB_URL` / `process.env.WORKSPACE_DB_URL`（本地 SQLite，Docker/双击/手动）
3. 都没有 → 纯浏览器本地模式（无 sidecar 时兜底，仅存 localStorage/IndexedDB）

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
| 单机备份 | 拷贝 `data/kaoyan.db` + `data/files/`（或「设置 → 数据管理 → 导出」JSON） |
| 换设备迁移 | 拷贝上述数据目录；同一局域网则打开即自动同步 |
| 本地 SQLite 备份 | 直接拷贝 `data/kaoyan.db`（或 docker volume 快照） |
| D1 备份 | `npx wrangler d1 export kaoyan-workspace --remote --output=backup.sql` |
| D1 恢复 | `npx wrangler d1 execute kaoyan-workspace --remote --file=backup.sql` |

---

## 五、为什么不是传统 MySQL？

- 本项目是 **Cloudflare Workers 全栈**（vinext），云上数据库配套是 **D1（SQLite 系）**
- 本地打包安装的持久化由**零依赖 SQLite 服务**承担（同样 SQLite 系，模型完全一致）
- 单张快照表的模型天然契合「整份工作区 = 一个 JSON」，D1/SQLite 即够、零运维
- 未来若做「多用户 SaaS 后台」，可基于 `payload` 按用户 id 加一列拆分，不必推翻架构
