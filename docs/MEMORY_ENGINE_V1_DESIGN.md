# Learning Memory Engine V1 — 数据模型与依赖审计设计

> 审计基线：commit `640ed6a`（main HEAD）
> 审计日期：2026-07-31
> 范围：仅数据模型设计与依赖审计。不修改 UI、不拆组件、不接入后端。
> 前置文档：`docs/MEMORY_ENGINE.md`（愿景）、`workspace-app/DATA_PROVENANCE_AUDIT.md`（数字来源审计）

> **实施状态（2026-07-31 更新）**：
> - ✅ **Sprint 1（Phase A）已实施**：`app/lib/events.ts` 上线，`study_completed` / `card_reviewed` / `question_answered` 三事件已接入 page.tsx 三处写入点，独立 v4 key。UI 零变化、旧读取路径零变化。
> - ✅ **版本化已加入**：`LearningEvent.version = 1`（事件级）+ `eventSchemaVersion = 1`（存储级）。高版本存储拒绝读写、缺版本旧事件自动提升为 v1。
> - ✅ **Sprint 2A（KnowledgeState 投影生成）已实施**：`lib/projection.ts`（`projectKnowledgeState` 纯函数）+ `lib/memory-rules.ts`（`KNOWLEDGE_PROJECTION_RULES` 规则引擎）+ `lib/replay-console.ts`（开发模式 Current vs Projected 对照，不接 UI）+ `types.ts`（`KnowledgeState` 类型）+ `tests/replay-determinism.test.mts`（Replay 一致性 8 项测试全过）。
> - ⏳ Sprint 2B（Dashboard 切换读取）、Sprint 3（ReviewSchedule）、Sprint 4（切换读取）、Sprint 5（Agent 消费）、Sprint 6（RAG + 七核知识图谱联动）尚未开始。
> - ℹ️ 事件命名已按实施定稿：`task_completed` → `study_completed`，`question_result` → `question_answered`。
> - 🔧 **开发工具规划**：`Replay Memory`（Sprint 3 前上线）——将 `LearningEvent[]` 重放为 `KnowledgeState[]`，输出统计摘要，成为 Memory 调试的第一现场。

---

## 1. 审计基线确认

| 项目 | 结论 |
|------|------|
| Git 仓库 | `workspace-app/`（非项目根目录） |
| 基线 commit | `640ed6a8afe15a1dcd541cd097798538194b54a5`（main HEAD，工作区干净） |
| 该 commit 变更 | 仅 Playwright 测试基础设施（5 文件，93 行） |
| 后端 | `db/schema.ts` 为空，D1/drizzle 未接入，当前为纯前端 localStorage 应用 |

---

## 2. 现状审计（As-Is）

### 2.1 存储层现状

当前存在 **两套 localStorage key 并存**，互不连通：

| Key | 定义位置 | 实际使用 |
|-----|---------|---------|
| `nest-exam-workspace-v3` | `rules.ts` `STORAGE.key` | `page.tsx` 直接读写（唯一实际使用的 key） |
| `nest-exam-workspace-v4` | `storage.ts` `STORAGE_KEY` | Sprint 1 起由 `app/lib/events.ts` 实际写入（`learningEvents`） |

`storage.ts` 已实现 v0→v1→v2 迁移（含记忆引擎字段 `longTermMemory` / `structuredReviews` / `masteryHistory` / `dailyPortraits` / `reflections` / `chatLearningEvents` / `learningProfile` / `memoryEngine` 初始化与过期清理），但该迁移层与 `app/lib/events.ts` 的 v4 写入并存，**两套 v4 体系尚未统一**（后续 Sprint 收敛）。

### 2.2 记忆引擎代码现状（已建未接线 / 已接线）

| 文件 | 内容 | 调用状态 |
|------|------|---------|
| `lib/types.ts` | 已定义 `StructuredReview`、`MemoryItem`、`MemoryType`、`KnowledgeSnapshot`、`KnowledgeMasteryMap`、`DailyPortrait`、`Reflection`、`ChatLearningEvent` 等类型 | 类型定义，仅被 lib 层引用 |
| `lib/storage.ts` | `loadData` / `saveData` / `saveDataImmediate` / v1→v2 迁移 / 过期清理 / 7 个 add/update 辅助函数 | **无任何调用点**（Sprint 1 未使用，保持休眠） |
| `lib/memory-engine.ts` | Phase 2-6 纯函数 API：`addMemory` / `generateMasterySnapshot` / `generateDailyPortrait` / `generateReflection` / `getEngineData` 等 | **无任何调用点**（仅 `lib/index.ts` barrel 导出） |
| `lib/memory-rules.ts` | `classifyMemory` / `extractMemories` / `extractReviewFields` / `MEMORY_RULES` 正则规则集 | **无任何调用点** |
| `lib/events.ts` | **Sprint 1 新增**：`LearningEvent` 类型 + 工厂 + v4 独立存储（`version` / `eventSchemaVersion`） | ✅ **已接线**（page.tsx 三处写入点） |
| `app/page.tsx` | 死 import：`loadData, saveData, addStructuredReview, addMemoryItem, getMemoriesByType, createEmptyMemoryData, extractReviewFields, extractMemories, classifyMemory, generateMemoryId, isDuplicateMemory` | **均为死 import，未调用**（Sprint 1 未清理） |

### 2.3 数据写入路径审计

#### 2.3.1 Dashboard Completion（任务完成）✅ 已采集

```
用户操作：记录结果 → completeTask(task.id)（page.tsx）
  ├─ updateTask(id, { done, status, actualMinutes, completedAt })          → tasks state
  ├─ recordStudyDay(minutes, delta)                                        → studyDays state（今日聚合，非事件日志）
  ├─ accuracy < 60 时直接扣减 nodes：                                      → nodes state（Overwrite）
  │    masteryScore -8 / masteryLevel -1 / mistakes +1 / reviewRisk "高风险"
  │    （数值硬编码在 page.tsx:612；rules.ts 的 MASTERY 常量未被引用）
  └─ ⚡ appendLearningEvent(study_completed)                               → v4 learningEvents（Sprint 1）
```

补充路径：`toggleTaskDone`（page.tsx:545）只改 `task.done` 并调用 `recordStudyDay`，不产生轨迹，**未采集事件**（Sprint 1 范围外）。

#### 2.3.2 Cards Review(卡片复习) ✅ 已采集

```
用户操作：复习按钮/快捷键 1/2/3 → reviewCard(id, mastery)（page.tsx:478）
  ├─ setCards({ mastery, lastReviewed, nextReviewAt })                     → cards state
  │     interval 硬编码：不会=1 / 模糊=3 / 认识=7 / 熟练=14 / 稳定=30
  │    （rules.ts CARD_REVIEW_INTERVALS 未被 page.tsx 引用）
  ├─ pushAssistant(...)                                                    → chat state
  └─ ⚡ appendLearningEvent(card_reviewed)                                 → v4 learningEvents（Sprint 1）
```

#### 2.3.3 Questions Result（做题结果）✅ 已采集

```
用户操作：做题记录下拉框 onChange（page.tsx:1273）
  ├─ setQuestions({ result, done })                                        → questions state
  └─ ⚡ appendLearningEvent(question_answered)                             → v4 learningEvents（Sprint 1）
```

#### 2.3.4 Review 提交（今日复盘）——当前完全未持久化

```
用户操作：ReviewDialog 提交 → onSubmit={() => setActiveDialog(null)}（page.tsx:1628）
  └─ 仅关闭弹窗，不写入任何存储，不产生事件（后续 Sprint 接入 review_submitted）
```

**关键缺口**：`ReviewPanel` 已声明可选 `structuredReviews` prop 并渲染 `ReviewHistoryPanel`，但 `page.tsx` 从未传入 → 复盘历史面板在当前 build 中永不显示。

### 2.4 数据读取路径审计

| 页面/区域 | 读取来源 | 计算方式 | 是否经过记忆引擎 |
|-----------|---------|---------|-----------------|
| Dashboard 整体进度 | nodes/questions/resources state | `overallProgress`（page.tsx:296） | 否 |
| Dashboard 今日建议（掌握度提升） | tasks state | `(masteryAfter - masteryBefore) 均值` | 否 |
| Cards「今日复习」 | cards state | `dueCards`：mastery/lastReviewed/nextReviewAt 混合判定（page.tsx:136） | 否 |
| Review 概览六指标 | tasks/questions/nodes/cards state | 直接 filter/reduce（page.tsx:128-134） | 否 |
| Review AI 总结 | nodes state | `reviewAiSummary` 静态模板串 | 否 |
| Sidebar 热力图 | studyDays state | `heatmapDays` 映射 | 否 |
| Sidebar 剩余天数/目标分 | exam/subjects state | 派生计算 | 否 |

**共性结论**：所有 Dashboard/Cards/Review 读取均为组件内直接 filter/reduce 现有 state；`getEngineData` / `getProfile` / `getMemoriesByType` 等引擎读取接口完全未消费。Sprint 1 保持现状。

### 2.5 状态所有权现状

| 数据 | 唯一写入口 | 是否可回放 | 是否有时间维度 |
|------|-----------|-----------|---------------|
| tasks | `updateTask`/`setTasks` | 否（覆盖式） | 部分（startedAt/completedAt） |
| studyDays | `recordStudyDay` | 否（按日聚合覆盖） | 有（date+当日聚合） |
| cards | `setCards`（reviewCard 等直接改） | 否（覆盖式） | 部分（lastReviewed/nextReviewAt） |
| questions.result | `setQuestions`（JSX inline） | 否（覆盖式） | 否 |
| nodes.mastery | `setNodes`（completeTask 扣减/手动编辑） | 否（覆盖式） | 否 |
| review 文本 | 无（仅 state） | 否 | 否 |
| **learningEvents（Sprint 1 新增）** | `appendLearningEvent` | **是（append-only 事实流）** | **是（occurredAt/version）** |

---

## 3. 目标数据流（To-Be）

```
┌──────────────────────────────────────────────────────────────────────┐
│                       写入动作（现状不变）                              │
│  completeTask / reviewCard / questionResult / reviewSubmit ...        │
└──────────────────────────────┬───────────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                 LearningEvent（追加式，含 version）                    │
│  唯一真相源：一切学习行为的不可变事件流                                │
│  { id, version, type, occurredAt, sourceRef, payload }               │
│  v4 存储：{ eventSchemaVersion, learningEvents, ... }                │
└───────────┬───────────────────────────────┬──────────────────────────┘
            ▼                               ▼
┌──────────────────────┐      ┌──────────────────────────────────┐
│  KnowledgeState       │      │  ReviewSchedule                  │
│  （知识点状态投影）     │      │  （复习调度）                     │
│  ← 由 events Replay    │      │  ← 由 card_reviewed / 规则      │
└───────────┬───────────┘      └───────────────┬──────────────────┘
            ▼                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                              读取消费                                 │
│  Dashboard（Sprint 2B） · Cards（Sprint 3-4） · Review（Sprint 4）    │
│  Agent（Sprint 5） · RAG + 七核图谱（Sprint 6）                       │
│  · 开发工具 Replay Memory（Sprint 3 前）                              │
└──────────────────────────────────────────────────────────────────────┘
```

**核心原则**：写入动作同时追加 `LearningEvent`（副作用，不阻塞 UI 乐观更新）；`KnowledgeState` 与 `ReviewSchedule` 是事件的投影（projection），可随时从事件流重算；读取方消费投影而非直接扫描原始集合。

---

## 4. 核心模型字段定义（V1 已实施部分 + 目标态）

### 4.1 `LearningEvent` — 学习事件（追加式事实流）✅ 已实施（Sprint 1）

```typescript
export type LearningEventType =
  | "study_completed"     // 任务/学习完成（含实际分钟/正确率/掌握度前后）——Sprint 1 已接线
  | "task_toggled"        // 任务勾选（轻量完成，Sprint 1 未采集）
  | "card_reviewed"       // 卡片复习（掌握档位/间隔）——Sprint 1 已接线
  | "question_answered"   // 做题结果（正确/错误）——Sprint 1 已接线
  | "review_submitted"    // 复盘提交（结构化文本，后续 Sprint）
  | "node_updated"        // 知识点手动校正（后续 Sprint）
  | "resource_read";      // 资料阅读进度（预留）

export type LearningEvent = {
  id: string;                        // 格式 evt-<timestamp>-<seq>-<rand>
  /** 事件结构版本（当前 1）。payload 结构变更时 +1，Replay 据此选择解析器 */
  version: number;
  type: LearningEventType;
  occurredAt: string;                // ISO 时间戳（写入时刻）
  /** 来源引用：触发本事件的业务对象 */
  sourceRef: {
    kind: "task" | "card" | "question" | "review" | "node" | "resource";
    id: string;                      // 业务对象 id
    subjectId?: string;              // 科目 id（可空，用于跨模块过滤）
    nodeIds?: string[];              // 关联知识点 id（可空，用于掌握度投影）
  };
  /** 事件载荷：按 type 归一化的最小事实集，禁止存派生 UI 状态 */
  payload: {
    // study_completed
    minutes?: number;
    accuracy?: number;               // 0-100
    masteryBefore?: number;
    masteryAfter?: number;
    // card_reviewed
    mastery?: GrowthCard["mastery"]; // 不会/模糊/认识/熟练/稳定
    intervalDays?: number;
    // question_answered
    result?: "正确" | "错误" | "未做";
    errorReason?: string;
    // review_submitted（后续 Sprint）
    scope?: "日复盘" | "周复盘" | "月复盘";
    done?: string;
    hard?: string;
    load?: "过少" | "刚好" | "过多";
    tomorrow?: string;
    priority?: string;
    // node_updated（后续 Sprint）
    masteryScore?: number;
    mistakes?: number;
  };
  /** 可追溯的原始快照（可选，供 UI 回滚/调试） */
  snapshot?: Record<string, unknown>;
};
```

**v4 存储结构（已实施）**：
```typescript
// localStorage key: nest-exam-workspace-v4
{
  eventSchemaVersion: 1,        // 存储级 schema 版本
  learningEvents: LearningEvent[],
  // 未来：knowledgeStates / reviewSchedules / meta
}
```

**版本兼容规则（已实施）**：
- 读取：`eventSchemaVersion > 当前版本` → 拒绝解析（返回空数组，保留原始存储）
- 写入：存储中 `eventSchemaVersion > 当前版本` → 拒绝追加（防低版本覆盖高版本）
- 兼容：事件缺 `version`（Sprint 1 上线初期写入）→ 自动提升为 v1

### 4.2 `KnowledgeState` — 知识点状态投影（目标态，Sprint 2A 实施）

与 `KnowledgeNode`（业务/图结构）保持 1:1，`KnowledgeState` 只承担「由事件推导出的状态」。

```typescript
export type KnowledgeState = {
  nodeId: string;                    // 对应 KnowledgeNode.id
  subjectId: string;
  /** 投影值：默认来自最近一次事件/手动校正 */
  masteryScore: number;              // 0-100
  masteryLevel: number;              // 0-4
  mistakes: number;
  reviewRisk: Risk;                  // 正常/需要关注/进度落后/高风险
  /** 稳定性：连续正确复习次数 / 连续错误次数（V1 由规则推导） */
  streakCorrect: number;
  streakWrong: number;
  /** 遗忘曲线（V1 简化）：距上次复习天数 + 最近结果加权 */
  forgetRisk: number;                // 0-100
  lastReviewedAt: string | null;
  lastResult: "正确" | "错误" | "未复习" | null;
  /** 投影元数据 */
  sourceEventId: string | null;      // 最近一次影响本状态的事件 id
  projectedAt: string;               // 投影计算时间
  dirty: boolean;                    // 有待处理事件未投影（重算队列标记）
};
```

### 4.3 `ReviewSchedule` — 复习调度（目标态，Sprint 3 实施）

取代「散落在 card.mastery / node.reviewRisk 中的隐性调度」，统一到期队列。

```typescript
export type ReviewScheduleTarget =
  | { kind: "card"; cardId: string }
  | { kind: "node"; nodeId: string };   // 知识点复习（V1 仅卡片，字段预留）

export type ReviewSchedule = {
  id: string;                          // sched-<timestamp>-<seq>
  target: ReviewScheduleTarget;
  subjectId: string;
  /** 当前重复阶段 */
  stage: "new" | "learning" | "review" | "relearning";
  /** 上次复习结果 */
  lastResult: "不会" | "模糊" | "认识" | "熟练" | "稳定" | null;
  /** 间隔天数：由 lastResult 与规则库 CARD_REVIEW_INTERVALS 对齐 */
  intervalDays: number;
  /** 到期日（YYYY-MM-DD）：today + intervalDays */
  dueAt: string;
  /** 连续到期未复习次数（负反馈：>3 天未复习触发遗忘风险提升） */
  overdueStreak: number;
  /** 历史复习次数（同一 target 的累计 reviewCard 事件数） */
  reviewCount: number;
  /** 调度元数据 */
  sourceEventId: string;               // 最近一次复习事件 id
  updatedAt: string;
};
```

### 4.4 三模型与现有类型的关系

| 现有类型 | 关系 | V1 处理 |
|---------|------|--------|
| `GrowthCard` | 业务卡片实体（正/背面/来源） | **不动**。`mastery/lastReviewed/nextReviewAt` 继续冗余保留，作为 UI 乐观缓存 |
| `KnowledgeNode` | 知识图谱实体 | **不动**。`masteryScore/mistakes/reviewRisk` 保留，但被投影函数视为「上一轮结果」 |
| `Task` / `Question` | 业务实体 | **不动**。结果写入仍走现有 setter |
| `StructuredReview` | 复盘解析产物 | 由 `review_submitted` 事件派生生成（复用现有 `extractReviewFields`） |
| `MemoryItem` | 长期记忆 | V1 不接入（见「明确不做清单」） |

---

## 5. 状态所有权（Ownership）

### 5.1 所有权矩阵

| 数据 | 唯一事实源 | UI 乐观状态 | 投影读取 |
|------|-----------|------------|---------|
| 学习行为历史 | `LearningEvent[]`（append-only，含 version） | tasks/cards/questions 原 state | Review 历史、掌握度轨迹 |
| 知识点掌握 | `KnowledgeState[]`（events 投影） | nodes.masteryScore（现有） | Dashboard 进度（Sprint 2B）、Review 六指标（Sprint 4） |
| 复习到期 | `ReviewSchedule[]`（events 投影） | cards.nextReviewAt（现有） | Cards「今日复习」队列（Sprint 3-4） |
| 每日聚合 | `studyDays` | studyDays（现状） | Sidebar 热力图（保持现状） |

### 5.2 所有权规则

1. **单向写入**：用户动作 → UI setter（乐观更新，现状不变）→ 同一函数内追加 `LearningEvent`。两个写入顺序固定：先 setter 后 append。
2. **投影只读**：`KnowledgeState` / `ReviewSchedule` 只能由 `projectKnowledgeState(events)` / `projectReviewSchedule(events)` 纯函数产出，禁止组件直接 set。
3. **重算幂等**：投影函数输入 `(baseState, events[])`，输出确定性状态；同批事件重放结果一致。
4. **UI 缓存优先读投影**：V1 分阶段切换，先并轨后切换（见 §7）。
5. **手动校正覆盖**：用户在知识图谱手动改 `masteryScore` 时，追加 `node_updated` 事件作为新的投影锚点，而非直接改 `KnowledgeState` 数组。

### 5.3 现有状态中「应该被投影取代」的部分

| 现有代码 | 问题 | V1 归属 |
|---------|------|--------|
| page.tsx:612 completeTask 内联 -8/-1/+1 | 硬编码、无事件 | Sprint 2B 改由 `projectKnowledgeState` 规则计算 |
| page.tsx:479 reviewCard 内联 1/3/7/14/30 | 与 rules.ts `CARD_REVIEW_INTERVALS` 重复 | Sprint 3 改由 `projectReviewSchedule` 引用 rules.ts |
| page.tsx:136 dueCards 三信号混合判定 | 判定口径不一致（hydratedTodayStr 首帧偏差） | Sprint 3 改由 `ReviewSchedule.dueAt <= today` 统一判定 |
| page.tsx:128-134 review 六指标 filter/reduce | 全部现算、无缓存 | Sprint 4 改由 `KnowledgeState` + 当日 events 聚合 |

---

## 6. 历史 localStorage 兼容策略

### 6.1 双 key 并存约定

| Key | 角色 | 策略 |
|-----|------|------|
| `nest-exam-workspace-v3` | 现有业务数据的**唯一读写 key** | **保持不变**。page.tsx 现有 save effect 继续写 v3，绝不改动，避免破坏既有用户数据 |
| `nest-exam-workspace-v4` | 记忆引擎新数据 key | 结构：`{ eventSchemaVersion, learningEvents, ...(future: knowledgeStates / reviewSchedules / meta) }`。读取时 `eventSchemaVersion > 当前版本` 拒绝解析；写入时拒绝覆盖更高版本 |

禁止 merge 到同一个 key：v3 结构无版本迁移历史、page.tsx 直接 `JSON.stringify` 全量覆盖，改动风险不可控。

### 6.2 首次提升（Backfill）策略

```
首次运行（v4 不存在）：
  v4 = {
    eventSchemaVersion: 1,
    learningEvents: seedFromV3()   // 用 v3 现有数据回填初始事件
    knowledgeStates: project(seedFromV3())
    reviewSchedules: project(seedFromV3())
    meta: { backfilledAt, sourceVersion: 3, scheduler: "v1" }
  }
```

`seedFromV3()` 定义：
- `study_completed`：逐条 `v3.tasks[].done === true` → 事件（minutes 取 actualMinutes，无前后掌握度则留空；version: 1）
- `card_reviewed`：逐条 `v3.cards[]` 且 `lastReviewed !== "未复习"` → 事件（mastery 取当前值，intervalDays 由 `CARD_REVIEW_INTERVALS` 反查；version: 1）
- `question_answered`：逐条 `v3.questions[]` 且 `result !== "未做"` → 事件（version: 1）
- `review_submitted`：**不回填**（v3 无复盘历史，空即空）
- `node_updated`：`v3.nodes[]` 全量 → 事件（作为投影初始锚点；version: 1）

回填仅执行一次（`meta.backfilledAt` 存在则跳过）。v3 后续变化通过写入动作增量追加事件。

### 6.3 版本兼容（Sprint 1 已实施）

- 读取：`eventSchemaVersion > 当前版本` → 拒绝解析（返回空数组，保留原始存储）
- 写入：存储中 `eventSchemaVersion > 当前版本` → 拒绝追加（防低版本覆盖高版本）
- 事件缺 `version` → 自动提升为 v1

### 6.4 投影读兼容

- 投影函数对缺失事件容忍：`KnowledgeState` 缺 `nodeId` 对应节点时输出 `dirty: true` 且跳过消费。
- `ReviewSchedule.dueAt` 校验 `YYYY-MM-DD`；非法格式按「今天到期」处理，不抛错。
- v3 中 `cards.nextReviewAt` 与投影 `dueAt` 冲突时，**以投影为准**（读切换阶段起）。

---

## 7. 分阶段接线方案

> 每个阶段 Gate：上一阶段验证通过后才进入下一阶段。实施策略为 **Strangler Fig Pattern（绞杀者模式）**——旧系统继续工作，新系统先建立，再逐步替换读取路径。

### Phase A — 事件采集（数据层接入）✅ 已实施（Sprint 1）

- [x] 新增 `lib/events.ts`：`appendLearningEvent(events, input)` / `loadLearningEvents()` / `createLearningEvent()`（独立 v4 key，同步持久化）。
- [x] 版本化：`version: 1`（事件级）+ `eventSchemaVersion: 1`（存储级）；高版本存储拒绝读写；缺 version 旧事件自动提升为 v1。
- [x] `page.tsx` 三个写入点接入（不改 UI）：
  - `completeTask` → 追加 `study_completed`
  - `reviewCard` → 追加 `card_reviewed`
  - questions result `onChange` → 追加 `question_answered`
- [ ] `toggleTaskDone` → `task_toggled`（未采集，Sprint 1 范围外）
- [ ] `ReviewDialog onSubmit` 复盘事件（后续 Sprint）
- [ ] `storage.ts` / `lib/index.ts` 统一入口（后续 Sprint 收敛）
- **验证（已通过）**：`tsc --noEmit` EXIT 0；`npm run build` 成功；v3 数据读写路径一字未改。

### Phase B — 投影（KnowledgeState）→ 拆分为 Sprint 2A / 2B

#### Sprint 2A — 投影生成（任何页面都不读取）✅ 已实施

- [x] 新增 `lib/projection.ts`：`projectKnowledgeState(events, nodes)` 纯函数（不读全局状态、不写存储；按 occurredAt 排序幂等）。
- [x] 业务规则统一在 `memory-rules.ts` `KNOWLEDGE_PROJECTION_RULES`，投影层零业务内联。
- [x] `KnowledgeState` 只存投影（mastery/reviewCount/risk/forgetRisk），事实由事件推导，可完全重建。
- [x] 开发模式并轨输出：`computeReplayComparison` 打印 `Current Node Mastery: X / Projected Mastery: Y`（page.tsx 挂载，仅 console）。
- [x] Replay 一致性测试 `tests/replay-determinism.test.mts`（8 项：确定性/幂等/可重建/初始锚点/孤儿容忍/排序/规则行为）全过。
- [ ] 新增 `lib/reducer.ts`：`computeOverallProgress(states, questions, resources)`（Sprint 2B 前置，未做）。
- [ ] 生成保存到 v4（`knowledgeStates`），不接任何 UI 读取（未做，保留纯函数形态）。
- **验证（已通过）**：`tsc --noEmit` EXIT 0；`npm run build` 成功；`npm run test:replay` 8/8 通过。

#### Sprint 2B — Dashboard 切换读取（2B-1 完成 reducer，未切换读取）

##### Sprint 2B-1 — Progress Reducer + 开发对照 ✅ 已实施

- [x] 新增 `lib/reducer.ts`：`computeOverallProgress(states, subjects)` 纯函数（科目等权、未知 subjectId 忽略、未观测科目 skipped+归一化、0 mastery 正确反映、空数据返回 0）。
- [x] `KnowledgeState` 新增可重建 `eventCount`（0 = 未观测节点）。
- [x] 固化 `projectedAt` 确定性契约（取最后事件 occurredAt，非 new Date()；空流=""；多次 Replay 恒等）。
- [x] 开发模式对照 `computeProgressComparison`：Legacy vs Projected Dashboard Progress（page.tsx console only，UI 零变化）。
- [x] 测试：`tests/reducer.test.mts`（11 项）+ `tests/replay-determinism.test.mts` 追加（eventCount / projectedAt 契约 3 项），**22/22 通过**。
- **验证（已通过）**：`tsc --noEmit` EXIT 0；`npm run build` 成功。

##### Sprint 2B-2 — Dashboard 单点切换（待 2B-1 观察稳定后，由用户决定是否执行）

- [ ] Dashboard 整体进度读取 `computeOverallProgress` 结果。
- [ ] `completeTask` / `question_answered` / `card_reviewed` 的 node 联动改由投影承担。
- **验证**：Dashboard 数值与旧路径一致或差异可解释。

### Phase C — 调度（ReviewSchedule）→ Sprint 3

- [ ] 新增 `lib/schedule.ts`：`projectReviewSchedule(events)` 产出 `ReviewSchedule[]`；`getDueSchedules(schedules, today)` 统一到期判定。
- [ ] `reviewCard` 追加事件时同步刷新该 card 的 `ReviewSchedule`（投影）。
- [ ] `dueCards` 计算改用 `getDueSchedules`（读切换），保留 `card.mastery` 冗余字段供 UI 展示。
- **验证**：Cards「今日复习」数量与旧逻辑一致或更准确（修复首帧偏差）；复习一次后到期日正确推进。
- 🔧 **前置：Replay Memory 开发工具**——`LearningEvent[] → Replay → KnowledgeState`，输出 `Replay Finished / Events: N / Nodes Updated: N / Warnings: 0`。任何 Memory 相关 Bug 的第一排查入口。

### Phase D — Review 读取切换（复盘历史 + 六指标）→ Sprint 4

- [ ] `page.tsx` 向 `ReviewPanel` 传入 `structuredReviews`（由 `review_submitted` 事件投影生成）。
- [ ] `ReviewHistoryPanel` 开始展示真实历史数据。
- [ ] review 六指标改为读取 `KnowledgeState` + 当日 events 聚合（`reviewMasteryDelta` 从「均值」修正为「当日 delta」）。
- [ ] Dashboard 整体进度读取投影结果（Sprint 2B 的 reducer）。
- **验证**：Review 面板出现历史记录；六指标数值与现状一致或修正合理性合理解释。

### Phase E — 清理与收尾（后续）

- [ ] 移除 page.tsx 死 import（`addStructuredReview` / `addMemoryItem` / `extractMemories` 等）。
- [ ] 评估 `rules.ts STORAGE.key` 与 `storage.ts STORAGE_KEY` 命名统一（不改行为）。
- [ ] hooks 目录与 page.tsx state 的重复实现收敛（独立任务，不阻塞 V1）。

### Phase F — Agent 与图谱联动（Sprint 5 / Sprint 6）

- [ ] **Sprint 5**：Agent 真正消费 Memory Engine（读取 KnowledgeState / ReviewSchedule 做决策，而非模拟回复）。
- [ ] **Sprint 6**：RAG + 七核知识图谱联动（资源/真题/注释与 KnowledgeState 打通）。

---

## 7.5 演进路线图（2026-07-31 共识版）

```
Phase 0  恢复旧系统                    ✅ 完成（v1.0-recovered）
Phase 1  审计                          ✅ 完成（设计 + 真实性审计）
Sprint 1  LearningEvent 事件采集        ✅ 完成（含 version / eventSchemaVersion）
Sprint 2A KnowledgeState 投影生成       ✅ 完成（纯函数 + Replay 8 项测试 + 开发对照，不接 UI）
Sprint 2B Dashboard 切换读取            ⏳ 2A 稳定后
Sprint 3  ReviewSchedule 投影 + Replay Memory 工具
Sprint 4  Dashboard / Cards / Review 切换读取
Sprint 5  Agent 真正消费 Memory Engine
Sprint 6  RAG + 七核知识图谱联动
```

实施策略：**Strangler Fig Pattern（绞丝者模式）**——旧系统继续工作，新系统（事件流）先建立，再逐步替换读取路径。任何 Sprint 不一次性重写，每步可独立验证、可回退。

---

## 8. 明确不做清单（Out of Scope）

| # | 事项 | 原因 |
|---|------|------|
| 1 | **不修改任何 UI/组件结构** | 本任务限定数据模型与依赖审计 |
| 2 | **不拆 page.tsx、不引入组件** | 与 README/REVIEW 约束一致，重构属独立任务 |
| 3 | **不接入后端**（D1/drizzle/Cloudflare Workers） | `db/schema.ts` 空、页面纯 localStorage；接线会引入部署负担 |
| 4 | **不启用 `MemoryItem` 长期记忆 / `MemoryExtractor` AI 分类** | 规则引擎 `memory-rules.ts` 已存在但置信度低，V1 不消费；避免误记忆 |
| 5 | **不实现 `DailyPortrait` / `Reflection` 定时任务** | 依赖 AI 与定时触发，V1 无载体 |
| 6 | **不修改现有 `nodes.masteryScore` 等字段语义** | 现有字段继续作为 UI 缓存；投影状态独立存放 |
| 7 | **不做 `chatLearningEvents` 聊天事件采集** | 聊天为模拟回复，非真实学习行为 |
| 8 | **不清理 page.tsx 死 import / 不统一双 key** | 属 Phase E 收尾，本设计仅标记 |
| 9 | **不引入数据迁移破坏**：v3 key 读写路径一字不改 | 保护既有用户 localStorage 数据 |
| 10 | **`reviewMasteryDelta` 语义修正**（均值→delta） | 仅设计目标，实施在 Phase D，不提前改 |
| 11 | **`eventSchemaVersion` 升级迁移**（v1→v2+） | 当前版本无需迁移；未来升级时新增迁移函数并在设计文档登记 |

---

## 9. 风险与决策记录

| # | 风险 | 决策 |
|---|------|------|
| 1 | v3/v4 双 key 可能产生「v3 有数据、v4 事件为空」 | Phase A 首次回填解决；之后每次写入动作都双写 |
| 2 | UI 乐观 state（cards.mastery）与投影（ReviewSchedule）可能短暂不一致 | 投影在事件 append 后同步计算，Sprint 3 起 UI 读投影；冗余字段仅展示 |
| 3 | 投影函数重算成本随事件增长 | V1 事件量级 < 10k/月，直接全量投影可接受；超限后引入游标增量投影（不做于 V1） |
| 4 | `ReviewDialog` 目前不写任何存储，改动会突然产生持久化行为 | 属预期修复；新增 v4 数据不影响 v3 读取 |
| 5 | 现有 `CARD_REVIEW_INTERVALS` 在 rules.ts 已被 use-cards.ts 引用，page.tsx 未引用 | Sprint 3 统一由投影引用 rules.ts，消除 page.tsx 内联 1/3/7/14/30 |
| 6 | `hydratedTodayStr` 首帧为 "2026-07-30" 导致 dueCards 判定偏差 | Sprint 3 用 `getToday()` 纯函数统一日期来源，`today()` 不再依赖 hydrated 状态 |
| 7 | 事件结构演进（payload 增字段）导致旧数据无法解析 | 已加 `version`（事件级）+ `eventSchemaVersion`（存储级）；高版本拒绝读写，缺版本自动提升 v1 |
| 8 | Replay 工具遗漏导致投影调试困难 | Sprint 3 前上线 `Replay Memory` 开发工具，成为 Memory Bug 第一排查入口 |

---

## 10. 附录：本审计引用的代码位置

| 位置 | 内容 |
|------|------|
| `rules.ts:101` | `STORAGE.key = "nest-exam-workspace-v3"`（页面实际使用） |
| `storage.ts:12` | `STORAGE_KEY = "nest-exam-workspace-v4"`（休眠迁移层） |
| `lib/events.ts` | Sprint 1 新增：LearningEvent + version + eventSchemaVersion + v4 独立存储 |
| `page.tsx:179-222` | v3 加载/保存 effect（记忆引擎字段未包含） |
| `page.tsx:478-485` | reviewCard 内联间隔 |
| `page.tsx:596-616` | completeTask 内联掌握度扣减 + study_completed 事件 |
| `page.tsx:738-747` | recordStudyDay 按日聚合 |
| `page.tsx:1273` | 做题结果 inline setState + question_answered 事件 |
| `page.tsx:1624-1631` | ReviewDialog onSubmit 仅关弹窗 |
| `page.tsx:136` | dueCards 三信号混合判定 |
| `page.tsx:128-134` | Review 六指标 filter/reduce |
| `page.tsx:17-18` | 记忆引擎死 import |
| `components/ReviewPanel.tsx:109-113` | structuredReviews 可选面板（未传入） |
| `components/ReviewHistoryPanel.tsx` | 历史面板 UI 已就绪 |
| `lib/memory-engine.ts` | Phase 2-6 纯函数（无调用点） |
| `db/schema.ts` | 空 schema，后端未接入 |