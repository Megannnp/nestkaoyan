# Memory Engine 现有代码真实性审计

> 审计对象：`memory-engine.ts`、`memory-rules.ts`、`storage.ts`（基座 640ed6a，不含 page.tsx 之外的业务改动）
> 比照基准：`docs/MEMORY_ENGINE_V1_DESIGN.md`
> 审计日期：2026-07-31
> 约束：不修改任何业务代码；审计完成前不得启用 v4、不得接线页面、不得删除旧逻辑

> **实施状态（2026-07-31 更新）**：
> - ✅ **Sprint 1（Phase A）已实施**：`app/lib/events.ts` 新建，`study_completed` / `card_reviewed` / `question_answered` 三事件已接入 page.tsx 写入点。
> - 本审计中「设计缺失」的 `LearningEvent` 标记为 **已实施**；`KnowledgeState` / `ReviewSchedule` 仍为设计缺失（后续 Sprint）。
> - 本审计对 `memory-engine.ts` / `memory-rules.ts` / `storage.ts` 三文件的结论**保持不变**（Sprint 1 未改这三文件）。

---

## 1. 结论速览

| 文件 | 总体判定 | 明细 |
|------|---------|------|
| `lib/memory-engine.ts` | **需修改后复用** | 结构合理（纯函数式 API），但存在类型错误、时间/随机依赖、字段语义偏差 |
| `lib/memory-rules.ts` | **需修改后复用** | 规则集可复用，但输出类型不在 `MemoryType` 范围内，无法直接写入 `MemoryItem` |
| `lib/storage.ts`（记忆引擎部分） | **需修改后复用** | v1→v2 迁移与关键常量可复用；存在 `__version` 不落盘、日期比较、清理不完整三项缺陷 |
| `lib/rules.ts`（记忆相关常量） | **可直接复用** | `CARD_REVIEW_INTERVALS` / `MASTERY` / `PROGRESS_WEIGHT` 定义正确，是权威常量 |
| 设计三模型总体 | **部分已实施** | `LearningEvent` 已在 `app/lib/events.ts` 实施（Sprint 1）；`KnowledgeState` / `ReviewSchedule` 仍为设计缺失（后续 Sprint） |
| Git 仓库管理 | **应废弃现状** | 仓库根=`workspace-app/`，`docs/` 在仓库外；所有 Memory Engine 文档未纳入版本控制 |

---

## 2. `memory-engine.ts` 逐项审计

### 2.1 纯函数性质验证

| 函数 | 输入→输出确定性 | 副作用 | 判定 |
|------|----------------|--------|------|
| `getMemory` | 确定 | 无 | ✅ 纯函数 |
| `addMemory` | 依赖 `new Date()` + `generateMemoryId()`（时间戳+随机数） | 无外部 | ⚠️ 输出含当前时间与随机 ID，同输入不同输出 |
| `removeMemory` | 确定 | 无 | ✅ 纯函数 |
| `getMemoriesByNode` / `getMemoriesByTag` | 确定 | 无 | ✅ 纯函数 |
| `generateMasterySnapshot` | 依赖 `new Date()`（date 字段） | 无 | ⚠️ 时间依赖 |
| `addMasterySnapshotToHistory` | 确定 | 无 | ✅ 纯函数 |
| `generateDailyPortrait` | 依赖 `new Date()` + `generateMemoryId()`（仅 reflection id） | 无 | ⚠️ 时间/随机依赖 |
| `addDailyPortrait` | 依赖 `new Date()`（lastPortraitAt） | 无 | ⚠️ 时间依赖 |
| `detectAnomalies` | **非纯**：`studyDays.slice(-3)` 依赖入参顺序 | 无 | ⚠️ 前置条件未文档化（需升序） |
| `generateReflection` | 依赖 `new Date()` + `generateMemoryId()` | 无 | ⚠️ 时间/随机依赖 |
| `addReflection` | 依赖 `new Date()`（lastReflectionAt） | 无 | ⚠️ 时间依赖 |
| `getProfile` / `updateProfile` / `getEngineStatus` / `getEngineData` | 确定 | 无 | ✅ 纯函数 |

**结论**：全部函数无 `window`/`document`/存储副作用，符合"投影只读"设计。但 `new Date()` 散落于 6 个函数，V1 接线时应将时间作为显式参数注入（`now: () => string`），以符合 `MEMORY_ENGINE_V1_DESIGN.md` §5.2「重算幂等」要求。

### 2.2 类型安全缺陷

| 位置 | 问题 | 判定 |
|------|------|------|
| `memory-engine.ts:332` | `chatLearningEvents: (data.chatLearningEvents ?? []) as never[]` | 🔴 **需修改**。`never[]` 类型断言使该字段对任何消费者类型不可达；应为 `as ChatLearningEvent[]` |
| `addMemory` 返回类型 | 直接扩展 `data` 对象并覆盖 `longTermMemory` / `memoryEngine`，无结构校验 | ✅ 可接受（SaveData 是宽松 Record） |
| `generateMasterySnapshot` 的 `delta` 恒为 0 | 快照语义是"当前状态"，但 `delta: 0` 谎报无变化 | ⚠️ 需修改（应基于上一快照计算或置 `null`） |
| `generateDailyPortrait.overallRating` | 类型注释 1-5，实为 `Math.round(completionRate * 100)` → 0-100 | 🔴 **需修改**（字段语义与注释冲突） |
| `generateMasterySnapshot.forgetRisk` | `n.mistakes * 10` 可超过 100，突破 0-100 语义 | ⚠️ 需修改（应 `Math.min(100, ...)`） |

### 2.3 与 V1 设计模型的差距

| 设计模型 | 现有实现 | 判定 |
|---------|---------|------|
| `LearningEvent`（事件流） | `app/lib/events.ts`（Sprint 1 已实施）：`study_completed` / `card_reviewed` / `question_answered` | ✅ **已实施**（2026-07-31） |
| `KnowledgeState`（状态投影） | `generateMasterySnapshot` 产出 `KnowledgeMasteryMap`（单日快照聚合），非按节点投影状态 | 🆕 **设计缺失**（需新增 `projectKnowledgeState`） |
| `ReviewSchedule`（复习调度） | **无**（间隔算法在 page.tsx 内联 + rules.ts 常量） | 🆕 **设计缺失**（需新增 `projectReviewSchedule`） |
| `MemoryItem` 长期记忆 | `getMemory`/`addMemory`/`removeMemory` 完整 | ✅ 可直接复用（但 V1 明确不做长期记忆，见设计 §8 #4） |
| `StructuredReview` 生成 | **无**（`extractReviewFields` 在 memory-rules 供料，但未组装成 `StructuredReview` 实例） | ⚠️ 需新增组装函数（接线点） |
| `DailyPortrait` / `Reflection` | `generateDailyPortrait` / `generateReflection` 已实现 | ✅ 可直接复用（V1 不做定时任务，函数可留作后续） |
| `accessCount` / `lastAccessed` 更新 | `addMemory` 初始化后无更新函数；`getMemory` 不维护访问计数 | ⚠️ 需修改（V1 不启用则无影响，但保留语义缺陷记录） |

---

## 3. `memory-rules.ts` 逐项审计

### 3.1 与设计模型字段一致性

| 规则输出 | 设计要求 | 差距 | 判定 |
|---------|---------|------|------|
| `MemoryRule.type: MemoryType \| "short_term" \| "discard"` | `MemoryItem.type: MemoryType` | `"short_term"` / `"discard"` **不在** `MemoryType` 联合中 | 🔴 **需修改**（接线时需映射：short_term→不写长期记忆；discard→丢弃） |
| `extractMemories` 返回 `longTerm: string[] / shortTerm: string[]` | 应产出 `MemoryItem[]` | 仅文本数组，无 `source/confidence/relatedNodeIds` 等 | ⚠️ 需修改（需组装层） |
| `extractReviewFields` 返回 `loadLevel` | `StructuredReview.parsed.loadLevel` 同类型 | 一致 | ✅ 可直接复用 |
| `extractReviewFields.availableMinutes`（`parseFloat * 60`） | `parsed.availableMinutes` | 一致（"3 小时"→180） | ✅ 可直接复用 |
| `extractReviewFields.content/difficulty` | `parsed.content/difficulty` | 一致（按 `，,、` 拆分） | ✅ 可直接复用 |
| `classifyMemory` 默认 short_term 置信度 30 | V1 设计：不启用长期记忆 | `classifyMemory` 本身正确，但 V1 不应消费 | ⚠️ 可复用但 V1 不接线 |

### 3.2 纯函数性质验证

| 函数 | 确定性 | 判定 |
|------|--------|------|
| `classifyMemory` | 确定（正则引擎） | ✅ 纯函数 |
| `extractMemories` | 确定 | ✅ 纯函数 |
| `extractReviewFields` | 确定（`rawInput.overload` 用 `/少|不够|轻松/` 与 `/多|重|累|满/` 判定） | ✅ 纯函数 |
| `isDuplicateMemory` | 确定（大小写不敏感包含匹配） | ✅ 纯函数 |
| `generateMemoryId` | 随机（时间戳 + `Math.random`） | ⚠️ 非纯；V1 事件 ID 生成需独立策略 |

**结论**：`memory-rules.ts` 除 ID 生成外全部为纯函数，规则集与 `extractReviewFields` 可直接复用；但输出类型需增加映射层才能接入 v4。

---

## 4. `storage.ts`（记忆引擎部分）逐项审计

### 4.1 v4 迁移安全性验证

| 检查项 | 现状 | 风险 | 判定 |
|--------|------|------|------|
| `migrateData` 版本判定 | `__version ?? 0`；v0→v1（examGoalCreatedAt）→v2（记忆字段） | 若 v3 数据无 `__version`，会被当 v0 走两段迁移 | ⚠️ 但当前 `page.tsx` 的 v3 save effect **不写 `__version`**，此路径本就触发 |
| `loadData` 迁移结果是否落盘 | `loadData` 仅返回迁移后内存对象；`saveData` 才落盘 | `page.tsx` 不使用 `loadData`（直接 `getItem`），迁移结果**永不写回 v3** | 🔴 **需修改**（v4 接入时必须用 `loadData` 统一入口，否则迁移无效） |
| `saveData` 写入 `__version: DATA_VERSION(2)` | 与 `migrateData` 的 `version < 2` 逻辑一致 | 若未来升 v3，`migrateData` 需同步加分支 | ✅ 当前安全 |
| 双 key 写入 | v3（page.tsx）/ v4（storage.ts）互不干扰 | 符合 V1 设计 §6.1 | ✅ 已符合 |
| `cleanupExpiredData` 执行时机 | 仅在 `loadData` 中的 `migrateData` 末尾执行 | 若长期不 reload，过期数据不清理（可接受，V1 量级小） | ⚠️ 可接受 |

### 4.2 历史数据兼容性缺陷

| 位置 | 问题 | 影响 | 判定 |
|------|------|------|------|
| `cleanupExpiredData` 长期记忆清理 | `now = new Date().toISOString()` 与 `m.expiresAt` 直接字符串比较 | 若 `expiresAt` 为 `YYYY-MM-DD`（date-only），任何 date-only 字符串 < ISO 时间戳 → **当天到期记录被误删** | 🔴 **需修改**（统一比较基准：都转 date-only 或都转 UTC ISO） |
| `chatLearningEvents` 清理 | `e.timestamp >= cutoff7` 字符串比较，`cutoff7` 为 date-only，`timestamp` 为完整 ISO | date-only 与 ISO 同前缀比较时按字典序：`2026-07-24`（cutoff）`>`/`<` `2026-07-24T...`，7 天边界事件可能被误保留一天 | ⚠️ 需修改（边界对齐） |
| `masteryHistory` 保留 | **无清理逻辑**（V1 设计要求 90 天归档） | 无限增长 | ⚠️ 需修改（或 V1 明确不启用 masteryHistory 时暂缓） |
| `learningProfile`保留 | 永久保留 | 可接受（单份结构） | ✅ |
| 迁移幂等性 | `migrateData` 每次 load 都执行清理 | 幂等（相同输入→相同输出） | ✅ |
| 空数据兜底 | `createEmptyMemoryData()` 为各数组初始 `[]` | 安全 | ✅ |

### 4.3 关键常量与函数对齐

| storage.ts 成员 | 判定 | 说明 |
|----------------|------|------|
| `STORAGE_KEY = "nest-exam-workspace-v4"` | ✅ 可直接复用 | 与 V1 设计 §6.1 的独立 key 策略一致 |
| `MemoryEngineStatus` 接口 | ✅ 可直接复用 | `lastExtractionAt/.../version` 齐全 |
| `createEmptyMemoryData()` | ✅ 可直接复用 | V1 回填时作默认结构 |
| `cleanupExpiredData` | ⚠️ 需修改 | 上述日期比较缺陷 |
| `addMemoryItem` | ⚠️ 需修改 | 与 `memory-engine.ts:addMemory` **重复实现**，接线前需收敛（V1 若不做长期记忆则两者都不接） |
| `getMemoriesByType/ByNode/ByTag`（storage 版） | ⚠️ 需修改 | 与 `memory-engine.ts` 同名函数重复 |
| `addStructuredReview` | ✅ 可直接复用 | V1 Phase D 可用 |
| `addMasterySnapshot` / `addDailyPortrait` / `addReflection` / `addChatLearningEvent` / `updateLearningProfile` / `updateMemoryEngineStatus` | ✅ 可直接复用（V1 部分用不到） | 结构正确 |

---

## 5. 规则冲突对照表

### 5.1 三源对照（page.tsx 内联 / rules.ts / memory-rules.ts）

| 规则主题 | page.tsx 内联（As-Is） | rules.ts（权威） | memory-rules.ts | 冲突类型 | 设计判定 |
|---------|----------------------|-----------------|----------------|---------|---------|
| 卡片复习间隔（天） | `:479` `不会=1/模糊=3/认识=7/熟练=14/稳定=30` | `CARD_REVIEW_INTERVALS` 同值（`rules.ts:11-17`） | 无 | **重复定义**（值一致） | rules.ts 为权威；page.tsx 内联须在 Phase C 移除 |
| 卡片间隔文案 | `:481` `"明天"/"3 天后"/...` | `CARD_REVIEW_LABELS` 同值（`rules.ts:19-25`） | 无 | **重复定义**（值一致） | rules.ts 为权威 |
| 掌握度低正确率扣减 | `:612` `-8 / -1 / +1` | `MASTERY.lowAccuracyPenalty=8 / masteryLevelPenalty=1`（`rules.ts:30-41`） | 无 | **重复定义**（扣减值一致；`+1` 即 mistakes 计数，无常量） | rules.ts 为权威；`mistakes+1` 无常量亦可由事件投影规则承载 |
| 确认图谱扣减 | `:560` 旧审计记录 `-5`（当前已不在 completeTask，寻至 `MASTERY.confirmUpdatePenalty=5`） | `configUpdatePenalty=5` | 无 | rules.ts 有定义，page.tsx 未引用 | rules.ts 为权威 |
| 进度权重 | `:296-301` `0.55/0.25/0.2` | `PROGRESS_WEIGHT` 同值（`rules.ts:86-90`） | 无 | **重复定义**（值一致） | rules.ts 为权威；Phase B 统一 |
| 任务默认时长 | `:633` `minutes: 60`（generatePlan） | `TASK.defaultPlanMinutes=60`；`plan-generator.ts:40` 已引用 | 无 | page.tsx 与 rules.ts 重复，但 `plan-generator.ts` 已正确使用 rules | rules.ts 为权威；page.tsx:633 需替换 |
| 备用任务上限 | `:712` 旧审计 `Math.min(task.minutes, 30)`（当前实现未见 30 字面量，`generatePlan` 未用 backup） | `TASK.backupMaxMinutes=30` | 无 | rules.ts 定义了但当前 page.tsx 未使用 | rules.ts 为权威（备用逻辑休眠） |
| 最大复习卡片数 | `:615` 旧审计 `Math.min(dueCards.length, 10)`（当前实现无此逻辑） | `TASK.maxReviewCards=10` | 无 | rules.ts 定义了但 page.tsx 未使用 | rules.ts 为权威（该功能休眠） |
| 记忆分类（长期/短期/丢弃） | 无 | 无 | `MEMORY_RULES`（goal/habit/weakness/preference/emotion/behavior/background + short_term/discard） | 独立能力，无冲突 | memory-rules 可复用；**但 V1 明确不启用**（设计 §8 #4） |
| 复盘字段解析 | 无（ReviewDialog 不落盘） | 无 | `extractReviewFields`（content/difficulty/loadLevel/availableMinutes） | 独立能力，无冲突 | memory-rules 可复用；Phase A 接线时用 |
| 到期判定 | `:136` `mastery==="不会"||"模糊"||lastReviewed==="未复习"||!nextReviewAt||nextReviewAt<=hydratedTodayStr` 三信号混合 | 无 | 无 | 设计缺失（无统一到期判定） | **应废弃**，Phase C 改由 `ReviewSchedule.dueAt <= today` |

### 5.2 冲突分级汇总

| 级别 | 项数 | 处置 |
|------|------|------|
| 🔴 值不一致 | 0 | 全部同值，无现行矛盾 |
| 🟠 重复定义（page.tsx 内联 vs rules.ts） | 5（间隔/文案/扣减/进度权重/任务时长） | Phase B/C 统一读取 rules.ts |
| 🟡 明确定义但 page.tsx 未引用（休眠常量） | 3（MASTERY.confirmUpdatePenalty / TASK.backupMaxMinutes / TASK.maxReviewCards） | 保留 rules.ts，V1 不额外启用 |
| 🟢 独立能力（无冲突） | 2（MEMORY_RULES / extractReviewFields） | Phase A 接线复盘解析；记忆分类 V1 不做 |
| 🔵 设计缺失 | 1（到期判定） | 新增 `ReviewSchedule` + `getDueSchedules` |

---

## 6. 逐文件判定汇总

| 文件/模块 | 判定 | 关键理由 |
|----------|------|---------|
| `memory-engine.ts` 整体 | ⚠️ **需修改** | `never[]` 类型错误、时间/随机依赖、overallRating 语义冲突 |
| `memory-engine.ts` `getMemory`/`addMemory`/`removeMemory` | ✅ **可直接复用** | 结构与 V1 §5 所有权相符（但 V1 不启用长期记忆） |
| `memory-engine.ts` `generateMasterySnapshot` | ⚠️ **需修改** | `delta:0` 谎报、`forgetRisk` 超界、时间依赖 |
| `memory-engine.ts` `generateDailyPortrait` | ⚠️ **需修改** | `overallRating` 0-100 但注释 1-5 |
| `memory-engine.ts` `detectAnomalies`/`generateReflection` | ⚠️ **需修改** | `slice(-3)` 顺序前置条件未文档化 |
| `memory-engine.ts` `getEngineData` | 🔴 **需修改** | `chatLearningEvents as never[]`（第 332 行） |
| `memory-rules.ts` `MEMORY_RULES`/`classifyMemory` | ⚠️ **需修改（接线时）** | 输出含 `"short_term"`/`"discard"`，不在 `MemoryType` 内 |
| `memory-rules.ts` `extractReviewFields` | ✅ **可直接复用** | Phase A 组装 `StructuredReview` 的直接数据源 |
| `memory-rules.ts` `generateMemoryId` | ⚠️ **需修改（V1 事件 ID）** | 随机非纯函数；事件 ID 建议 `evt-<ts>-<seq>-<rand>` 确定性序号 |
| `storage.ts` `STORAGE_KEY`/`createEmptyMemoryData`/`MemoryEngineStatus` | ✅ **可直接复用** | 与 V1 双 key 策略一致 |
| `storage.ts` `migrateData` | 🔴 **需修改** | `page.tsx` 不用 `loadData` → 迁移永不落盘；`expiresAt` 日期比较误删风险 |
| `storage.ts` `cleanupExpiredData` | ⚠️ **需修改** | date-only vs ISO 边界；`masteryHistory` 无清理 |
| `storage.ts` add 辅助函数 | ✅ **可直接复用** | `addStructuredReview` 等结构正确 |
| `storage.ts` `addMemoryItem`/get\*By\*（重复版） | ⚠️ **需修改（收敛）** | 与 memory-engine 重复实现，接线前须选一 |
| `rules.ts` 记忆相关常量 | ✅ **可直接复用** | 权威常量，V1 投影将引用 |
| `types.ts` 现有记忆引擎类型（MemoryItem/StructuredReview/KnowledgeSnapshot 等） | ✅ **可直接复用** | 与 V1 不冲突；V1 三模型须新增 |
| `lib/events.ts`（新文件，Sprint 1 新增） | ✅ **已实施** | `LearningEvent` 类型 + 工厂 + v4 独立存储 |
| `types.ts` 三新模型（LearningEvent/KnowledgeState/ReviewSchedule） | ⚠️ **部分缺失** | `LearningEvent` 已在 `lib/events.ts`；`KnowledgeState` / `ReviewSchedule` 仍待新增 |
| Git 仓库 | 🚫 **应废弃现状** | 仓库根=`workspace-app/`；`docs/MEMORY_ENGINE*.md` 未被追踪 |

---

## 7. 风险与处置建议（仅记录，不实施）

| # | 风险 | 建议处置时机 |
|---|------|-------------|
| 1 | `loadData` 迁移不落盘 → 即使启用 v4，v3→v4 回填若走 `loadData` 会丢失迁移中间态 | Phase A 接线时必须改用统一 `loadData`/`saveData` 入口（不删旧逻辑，双轨并存） |
| 2 | `expiresAt` date-only 与 ISO 比较可能误删当天长期记忆 | 修改 `cleanupExpiredData` 比较基准（Phase A 前） |
| 3 | `chatLearningEvents as never[]` 会让 `getEngineData(...).chatLearningEvents` 类型不可达 | 修改断言为 `as ChatLearningEvent[]` |
| 4 | memory-engine 时间依赖破坏投影幂等 | 接线时注入 `now` 函数；`generateMemoryId` 换确定性 ID |
| 5 | 5 处 page.tsx 内联与 rules.ts 重复但同值 | Phase B/C 统一引用 rules.ts，删除内联（属接线阶段，非本审计） |
| 6 | docs/ 在仓库外，记忆引擎权威文档无版本控制 | 本审计随附：复制到 `workspace-app/docs/` 并纳入 Git |

---

## 8. 附录：审计引用位置

| 位置 | 内容 |
|------|------|
| `app/lib/memory-engine.ts:332` | `chatLearningEvents as never[]` |
| `app/lib/memory-engine.ts:87-118` | `generateMasterySnapshot`（delta=0 / forgetRisk=mistakes*10） |
| `app/lib/memory-engine.ts:159-187` | `generateDailyPortrait`（overallRating 0-100） |
| `app/lib/memory-engine.ts:211-238` | `detectAnomalies`（slice(-3) 顺序依赖） |
| `app/lib/memory-rules.ts:14,24` | 规则输出类型含 `"short_term"|"discard"` |
| `app/lib/memory-rules.ts:287-330` | `extractReviewFields`（可复用） |
| `app/lib/storage.ts:127-158` | `cleanupExpiredData`（日期比较/无 masteryHistory 清理） |
| `app/lib/storage.ts:165-206` | `migrateData`（__version<2 迁移；不落盘问题在 page.tsx 侧） |
| `app/page.tsx:179-222` | v3 直接 `getItem`/`setItem`（不使用 `loadData`/`saveData`） |
| `app/page.tsx:479,481` | 卡片间隔/文案内联（与 rules.ts 重复） |
| `app/page.tsx:612` | 掌握度扣减内联（与 MASTERY 重复） |
| `app/page.tsx:296-301` | 进度权重内联（与 PROGRESS_WEIGHT 重复） |
| `app/page.tsx:136` | dueCards 三信号混合判定（设计缺失） |
| `app/page.tsx:16` | rules.ts 死 import（MASTERY/CARD_REVIEW_INTERVALS/LABELS/PROGRESS_WEIGHT 未引用） |
| `app/lib/rules.ts:11-41,86-90` | 权威常量定义 |
| `app/lib/plan-generator.ts:40` | 正确引用 `TASK.defaultPlanMinutes` |
| 仓库 | 根=`workspace-app/`；docs/ 未追踪 |