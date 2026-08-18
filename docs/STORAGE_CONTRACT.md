# Storage Contract（Stabilization 1C-0 设计，本轮不写代码）

> 阶段：Stabilization 1C-0（设计）→ 1C-1（implement）→ 1C-2（migration/rollback 演练）
> 约束：本文件只描述契约；任何代码改动放到 1C-1。
> 依据：现有存储事实（2026-07-31 验收审计）
>
> 2026-08-04 审查修复：`events.ts` 事件流 key 由误用的 `nest-exam-workspace-v4`
> 迁移为 `nest-exam-learning-events-v4`（与 workspace v4 隔离）；旧 key 中合法事件
> 在首次加载时一次性迁移，不覆盖 workspace 数据。Sidebar 折叠态改走 `saveUiState`。

## 0. 现状事实（必须对现有数据保持兼容）

| Key | 当前写入方 | 当前读取方 | 内容 |
|---|---|---|---|
| nest-exam-workspace-v3 | page.tsx 直写 | page.tsx 直读 | 业务数据（exam/subjects/resources/questions/nodes/tasks/pending/notes/cards/annotations/reader 状态/studyDays/agentSteps/logs/chat/review） |
| nest-exam-workspace-v4 | storage.ts saveData（未被 page.tsx 调用） | storage.ts loadData（未被 page.tsx 调用） | Memory Engine 字段 + dataVersion |
| nest-exam-learning-events-v4 | events.ts | events.ts | LearningEvent 事件流 |
| IndexedDB nest-exam-pdf-files | pdf-storage.ts | pdf-storage.ts | PDF 二进制 Blob（1A 新增） |

⚠ 关键问题（1C-1 必须消除）：
1. **两个 workspace key 并存（v3/v4）互不迁移** → 数据可能分裂。
2. page.tsx 绕过 storage.ts（直写 setItem/直读 getItem），storage.ts 的 migrate/清洗/防抖未覆盖主链路。
3. 未来若切到 storage.ts，v3 用户数据将被忽略 → 必须迁移。

---

## 1. Storage Ownership（唯一 Owner）

规则：**每类数据只能有一个 Owner**；Owner 提供读写入口；非 Owner 禁止直写。

| 数据 | 权威存储 | 读取入口 | 写入入口 | Owner 组件 |
|---|---|---|---|---|
| exam / appSettings / subjects | workspace（新契约 key） | hydrateWorkspace() | saveWorkspace() | storage.ts |
| resources（元数据）/ questions / nodes / tasks | workspace（新） | hydrateWorkspace() | saveWorkspace() | storage.ts |
| pending / notes / cards / annotations | workspace（新） | hydrateWorkspace() | saveWorkspace() | storage.ts |
| studyDays / agentSteps / logs / chat / review | workspace（新） | hydrateWorkspace() | saveWorkspace() | storage.ts |
| reader 状态（page/zoom/search/favoritePages 等） | workspace（新） | hydrateWorkspace() | saveWorkspace() | storage.ts |
| PDF Blob | IndexedDB | pdf-storage.ts loadPdfBlob | pdf-storage.ts save/deletePdfFile | pdf-storage.ts |
| LearningEvent | nest-exam-learning-events-v4 | events.ts loadLearningEvents | events.ts appendLearningEvent | events.ts（保持独立 key） |
| KnowledgeState | 不落盘（Replay 推导） | projection.ts | 不直接写 | projection.ts |
| structuredReviews / longTermMemory / masteryHistory / dailyPortraits / reflections / learningProfile | workspace（新） | storage.ts | storage.ts | storage.ts |

执行规则：
- page.tsx 只调用 hydrateWorkspace() / saveWorkspace()，不再直接操作 localStorage。
- 任何组件读写业务数据必须经由 Owner 入口，不得自行 setItem。
- 独立 key（events、IndexedDB）各自保持唯一 Owner。

---

## 2. 生命周期（单一 hydrate 入口）

```
启动 → hydrateWorkspace()（唯一入口） → 内存 State
   ↑                                      ↓ 用户修改
   └────── 刷新/重开 ← saveWorkspace()（唯一入口，防抖）
```

| 步骤 | 谁负责 | 发生频率 | 失败处理（见 §5） |
|---|---|---|---|
| hydrateWorkspace() | storage.ts | 每次启动（page.tsx useEffect） | 失败 → 空态 + console.error；保留旧数据备份 |
| 内存 State 更新 | page.tsx setState | 用户交互 | — |
| saveWorkspace()（防抖 500ms） | storage.ts | 任何状态变更 | 写失败 → 不覆盖已有数据，错误上报 |
| 刷新/重开 | 浏览器 | — | 重新 hydrateWorkspace |

禁止：多个组件各自 getItem/setItem 做 hydrate/save。

---

## 3. Migration（何时迁/何时不迁/何时回滚）

版本标记：workspace key 内新增 storageVersion（不依赖外层独立 key）。

| 版本 | 结构变化 | 由谁执行 |
|---|---|---|
| 3（当前 v3 数据） | 无（现网业务数据） | —（迁移源） |
| 4（当前 v4 数据） | Memory Engine 字段 | —（迁移源） |
| 5（新契约） | 合并 v3+v4 业务数据 + storageVersion=5 + owner 结构 | storage.ts migrateWorkspace() |

迁移策略（1C-1 实现，1C-2 演练）：
1. migrateWorkspace()：读 v3 与 v4 → 以 v3 为业务数据基座 → 以 v4 补充 Memory Engine 字段 → 写入新 workspace key（storageVersion=5）→ 在 v3/v4 留下 __migratedAt 标记。
2. 何时迁：新 key 不存在且存在 v3 或 v4。
3. 何时不迁：新 key 已存在（storageVersion=5）→ 直接使用，不重复迁移。
4. 回滚：迁移前 v3/v4 原样保留（只读标记，不删除）；若新 key 校验失败 → 不采纳迁移结果，回退读取旧 key。

校验（hydrate 前）：storageVersion 必须存在且 ≤ 当前版本；缺失 → 走迁移；大于当前 → 拒绝写入并保留用户数据（避免降级覆盖）。

---

## 4. Version（升级走 Migration，不用大量 if）

- 未来结构升级一律：storageVersion: n → n+1 + migrateWorkspace(n → n+1)。
- 代码内不写 if(version===3)...else if(version===4) 扩散；统一由 migration 表驱动（每个版本一个迁移函数）。
- 独立 key（events / IndexedDB）同样使用 version 字段，升级走各自 Owner 的迁移。

---

## 5. Failure Policy（提前定义，禁止静默丢数据）

| 场景 | 行为 |
|---|---|
| hydrate 失败（JSON 损坏） | 保留损坏原始串到 __corrupt_backup；使用 seed 空态；console.error；不清除原 key |
| localStorage 不可用 | 空态 + 顶部提示“本地存储不可用，数据不会被保存”；不清除已有 key |
| 写失败（Quota） | saveWorkspace 返回失败；保留内存 State；提示用户；不覆盖旧数据 |
| IndexedDB 不可用 | PDF 上传/读取返回错误矩阵 1A-2b；不影响 workspace 数据 |
| Migration 失败 | 保留 v3/v4 原样；回退读取旧数据；console.error；不采纳半迁移结果 |
| 版本高于当前 | 只读保护：拒绝写入新结构，避免降级覆盖 |

---

## 6. 1C 后续步骤（1C-1 / 1C-2）

- 1C-1（implement）：实现 hydrateWorkspace/saveWorkspace/migrateWorkspace（storageVersion=5）；page.tsx 改为唯一入口；删除直写；保留 events/IndexedDB 独立 Owner。每步跑 tsc --noEmit + 既有单测。
- 1C-2（migration/rollback 演练）：模拟 v3+v4 共存现场 → 迁移 → 校验 storageVersion=5 → 回滚演练（删除新 key 后重跑迁移仍成功）→ Playwright 回归（Dashboard/Reader/Questions/Cards/Review 四条链 + 刷新）。
- 1C 完成后再执行 Alpha Readiness Review（见 FUNCTIONAL_ACCEPTANCE_REPORT §8.3 更新）。

---

## 7. 当前结论（1C-0 输出，不写代码）

1. 新契约采用单一 workspace key（建议 nest-exam-workspace-v5），内含 storageVersion=5，业务数据 + Memory Engine 数据统一由 storage.ts Owner 管理；events key 与 IndexedDB 保持独立。
2. page.tsx 停止直写 localStorage，改为 hydrateWorkspace/saveWorkspace。
3. 迁移以 v3 为业务基座、v4 补充 Memory 字段，v3/v4 原样保留可回滚。
4. 任何改动在 1C-1 实施；本文件作为 1C-1/1C-2 验收基准。