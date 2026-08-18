# 数据库交付说明（database/）

> 数据策略：**默认零数据库运行**（浏览器 localStorage），需要多端同步/机构版时才启用
> Cloudflare D1。所有业务数据以 JSON 快照存于单张表，schema 极简、易迁移、易备份。

---

## 一、默认数据存储（当前生产形态）

- 位置：**浏览器 localStorage**（key: `nest-exam-workspace-v5`）
- 无需数据库、无需运维，单机可用
- 读写唯一入口：`app/lib/storage.ts`（`hydrateWorkspace` / `saveWorkspace`）
- 备份：用户「设置 → 数据管理 → 导出」下载完整 JSON；导入可恢复

**局限**（需要时才升级 D1）：
- 数据绑定浏览器，换设备/清缓存需手动导出导入
- 无法多端同步、无法后台统一管控

---

## 二、云数据库（Cloudflare D1，可选）

启用后工作区快照自动镜像写入 D1（代码已预留 `mirrorWorkspaceToD1()`）。

### 表结构（`db/schema.ts`，drizzle 已定义）

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | text (PK) | 快照标识（当前固定为 workspace 主键） |
| `storage_version` | integer | 存储契约版本（当前 6） |
| `payload` | text | 完整工作区 JSON（考试/科目/任务/知识点/资料/卡片…） |
| `updated_at` | text | 最后更新时间（默认 CURRENT_TIMESTAMP） |

迁移文件已生成于 `drizzle/0000_shiny_nitro.sql`。

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

## 三、备份与恢复（无论哪种存储）

| 场景 | 操作 |
|------|------|
| 单机备份 | 设置 → 数据管理 → 导出 JSON（建议每次大版本更新后导出一次） |
| 换设备迁移 | 旧设备导出 → 新设备同一浏览器打开 → 导入 |
| D1 备份 | `npx wrangler d1 export kaoyan-workspace --remote --output=backup.sql` |
| D1 恢复 | `npx wrangler d1 execute kaoyan-workspace --remote --file=backup.sql` |

---

## 四、为什么不是传统 MySQL？

- 本项目是 **Cloudflare Workers 全栈**（vinext），云上数据库配套是 **D1（SQLite 系）**
- 单张快照表的模型天然契合「整份工作区 = 一个 JSON」，D1 即够、零运维、免费额度充足
- 未来若做「多用户 SaaS 后台」，可基于 `payload` 按用户 id 加一列拆分，不必推翻架构