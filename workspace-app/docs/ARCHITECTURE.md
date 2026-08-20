# 架构规范 (Architecture Guide)

> 所有开发者（包括 AI）在修改代码前必须阅读此文档。

---

## 1. 项目结构

```
workspace-app/
├── app/
│   ├── lib/
│   │   ├── types.ts          # 所有 TypeScript 类型定义
│   │   ├── default-data.ts   # 所有初始/演示数据
│   │   ├── design-tokens.ts  # 设计 Token（字号、颜色、间距）
│   │   └── storage.ts        # localStorage 统一操作层（hydrate/save/migrate）+ 服务端镜像
│   ├── page.tsx              # 主页面（后续需拆分为组件）
│   ├── layout.tsx            # 根布局
│   ├── globals.css           # 全局样式
│   └── chatgpt-auth.ts       # ChatGPT 认证相关
├── db/                       # D1 schema（drizzle，云端可选）
├── database/                 # 本地 SQLite 同步服务（server.mjs，零依赖 node:sqlite）
├── tests/                    # 测试文件
├── docs/                     # 工程文档
└── ...
```

## 2. 核心原则

### 原则 1：页面不能超过 300 行
- 当前 `page.tsx` 约 1720 行，**必须拆分为组件**
- 每个组件文件不超过 200 行
- 页面只负责组合组件和声明 state

### 原则 2：所有 UI 必须组件化
- Sidebar 各区块应拆分为独立组件
- 模态框（Dialog）应抽取为通用组件
- 复用代码（如 MetricGrid、FilterBar）应组件化

### 原则 3：不得写硬编码数字
- 所有数字必须有来源（default-data, user input, or computed）
- 参见 [`DATA_GUIDE.md`](DATA_GUIDE.md)

### 原则 4：所有默认数据统一来自 `default-data.ts`
- 禁止在组件中硬编码 seed 数据
- 禁止在 JSX 中使用 fallback 字符串（如 `"热力学第二定律"`）

### 原则 5：Sidebar 禁止跨组件修改
- Sidebar 只负责显示和导航
- 点击 Sidebar 元素只能触发展开/收起或视图切换
- 不得在 Sidebar 中修改 subjects/tasks/nodes 等数据

### 原则 6：所有颜色来自 `Colors` Token
- 参见 [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)

### 原则 7：所有字号来自 `Typography` Token
- 参见 [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)

### 原则 8：所有 localStorage 操作统一走 storage 层
- (当前直接散布在 page.tsx 的 useEffect 中，需抽取)
- 目标：`storage.ts` 中定义 `loadState()` / `saveState()` / `clearState()`

### 原则 9：所有业务逻辑放自定义 Hooks
- 每个数据类型的 CRUD 操作放独立 Hook
- `useExam.ts` / `useSubjects.ts` / `useTasks.ts` / `useQuestions.ts` 等
- 页面只负责调用 Hook 和渲染

### 原则 10：页面只负责展示
- 页面中不包含复杂计算
- 计算逻辑放入 utils 或 hooks
- 事件处理函数保持简洁，调用外部函数

---

## 3. 数据流

```
User Input / AI Agent
        ↓
   Event Handler (page.tsx)
        ↓
   State Setter (useState)
        ↓
   useEffect (auto-save to localStorage + 镜像 SQLite/D1)
        ↓
   Derived Values (computed)
        ↓
   JSX Render
```

### 当前问题
- 所有 state 集中在 `page.tsx`，数据流不透明
- 没有单向数据流（可以随意修改任意 state）
- localStorage 保存逻辑在每个 state 变化时触发（性能浪费）

### 目标架构
```
User Input / AI Agent
        ↓
   Custom Hook (useExam, useSubjects, ...)
        ↓
   storage.ts (自动持久化)
        ↓
   Derived Values (computed in hooks or utils)
        ↓
   Component (纯展示)
```

---

## 4. 组件命名规范

| 前缀 | 用途 | 示例 |
|------|------|------|
| `Sidebar*` | 侧栏组件 | `SidebarLogo`, `SidebarHeatmap` |
| `Dialog*` | 模态框 | `DialogExam`, `DialogSubject` |
| `Panel*` | 面板 | `PanelTasks`, `PanelReview` |
| `*Card` | 卡片 | `GridCard`, `StudyCard` |
| `use*` | 自定义 Hook | `useTimer`, `useLocalStorage` |

---

## 5. 类型安全

- 所有 API 边界使用 `types.ts` 中定义的类型
- 禁止在组件中使用 `any`
- 表单事件使用 `FormEvent<HTMLFormElement>`
- 使用类型守卫处理 `null`/`undefined`

---

## 6. 性能规范

- 列表渲染使用 `key` 属性（使用 `id`，不要使用 `index`）
- 大型列表使用 `useMemo` / `useCallback` 优化
- localStorage 写入使用 debounce（当前每次 state 变化都写入）
- 模态框使用条件渲染而不是 CSS 隐藏

---

## 7. 模块职责边界 (Module Ownership)

> 本节回答"功能应该放在哪里"，与 FEATURE_INVENTORY.md（回答"系统有什么功能"）配合使用。
> 每次 Refactor 前：先看本节，再改代码。

### 7.1 页面级职责

| 模块 | 负责 | 不负责 |
|------|------|--------|
| **Dashboard** (今日工作台) | 今日任务、学习计时 (startTask/stopTimer/completeTask)、Completion Modal、今日概览、Nav Tabs | AI Chat、Reader、Cards scheduling |
| **Agent** (AI 学习助手) | chat、runPrompt、runAgentWorkflow、agentSteps、pending、日志、quick prompts | 任务编辑、Reader 打开、Cards 创建/复习 |
| **Knowledge Center** | Resources (上传/识别/编辑)、Reader、Questions (筛选/录入/编辑)、Graph (节点管理)、landing 导航 | AI Chat、Cards scheduling |
| **Growth Cards** | 卡片首页、快速创建、科目切换、复习队列 (subjectCards/dueCards/cardQueue)、管理 (评分/收藏/删除)、手动创建弹窗 | Reader 渲染、Questions 编辑 |
| **Review** | 日/周/月复盘、复盘历史、AI 总结 | 任务创建、Cards scheduling |
| **Settings** | 考试信息、科目管理 (目标分/满分/轮次/层级) | 学习数据修改 |

### 7.2 组件级职责

| 组件 | 负责 | 不负责 |
|------|------|--------|
| **Sidebar** | 导航 (activeView)、热力图展示、倒计时、目标/进度显示 | 修改 subjects/tasks/nodes 数据 |
| **CardViewer** | 卡片翻转 UI、翻页 UI、评分按钮 UI、快捷键提示 UI | reviewCard()、cardQueue 构建、scheduling 逻辑 |
| **ReaderPanel** | 阅读 UI、批注展示、搜索/缩放 UI、AI 助手面板 | 资源 CRUD、卡片创建业务 |
| **TaskCard** | 任务单项 UI、计时/暂停/结束 UI、详情折叠 | 任务状态持久化与业务计算 |
| **ReviewPanel** | 复盘指标与 AI 总结展示、历史列表 | 复盘数据提交业务 (submitReview) |
| **Modal** | 通用弹窗容器/遮罩 | 具体表单逻辑 |
| **SettingsPanel** | 考试/科目编辑 UI | 数据持久化策略 |

### 7.3 handler 归属

| Handler | 应放在 |
|---------|--------|
| startTask / stopTimer / handleEndLearning / completeTask / moveTask | Dashboard (page.tsx 层) |
| runPrompt / runAgentWorkflow / pushAssistant / addLog | Agent (page.tsx 层) |
| inferResource / openResource / addResource / deleteResource / addQuestion / addNode | Knowledge (page.tsx 层) |
| createCardFromText / reviewCard / moveCard / deleteCard / openCardSource / showRelatedQuestions | Growth Cards (page.tsx 层) |
| recordStudyDay / addLog | 共享 (page.tsx 层)，被 Dashboard/Agent 调用 |

### 7.4 跨域连接规则

| 从 → 到 | 通过 | 禁止 |
|---------|------|------|
| Agent → Cards (创建/复习) | createCardFromText + setActiveView("cards") | 在 Agent 内联实现卡片 UI |
| Agent → Knowledge (Reader/Questions) | setActiveView("knowledge") + openResource/showRelatedQuestions | 复制 Reader 逻辑到 Agent |
| Cards → Knowledge (来源/真题) | openCardSource / showRelatedQuestions | 在 Cards 内嵌 Reader/Questions |
| Knowledge → Cards (批注生成卡片) | createCardFromText("资料批注", ...) | 在 Reader 写卡业务 |

### 7.5 状态所有权

- **卡片队列状态** (subjectCards/dueCards/cardQueue/index/flipped) → page.tsx (Growth Cards 域)
- **复习业务** (reviewCard/moveCard/索引校正) → page.tsx (Growth Cards 域)
- **卡片 UI 状态** (翻转动画显示) → CardViewer 组件内部展示，但翻转布尔值由 page.tsx 持有并通过 props 传入
- **键盘快捷键** → 页面层 (page.tsx)，避免组件与页面重复监听
- **timer** → Dashboard 域 (page.tsx)，TaskCard 仅通过 props 展示

### 7.6 已确认的"不恢复/不保留"项（防止回归）

| 项 | 原因 |
|----|------|
| `use-timer.ts` / `plan-generator.ts` | 死代码（零引用），已删除；计时统一走 handler 墙钟方案 |
| `cardsRef` | CardViewer 不需要外部 ref |
| 旧版内联 Flip Card JSX | 已被 CardViewer 组件接管，恢复会导致双重翻转/评分/监听 |
| Dashboard 内嵌完整 Agent Chat | Agent 已是独立页面，Dashboard 仅保留 AI 摘要与 quick prompts |

> 注意：`readingMode` 仍在 page.tsx 声明并被 KnowledgeView 使用（书架↔阅读双态），属于**活跃 state**，不属废弃项。

### 7.7 当前 page.tsx 状态与拆分方向

- `page.tsx` 现约 700 行（state + 派生值 + 渲染）；业务 handler 集中在 `use-workspace-handlers.ts`（~1270 行）
- 后续按 **Vertical Slice** 拆分为完整功能模块，而非按行数/UI 拆分：
  - `layout/` (Sidebar, WorkspaceLayout)
  - `dashboard/` (完整 Dashboard 含 Timer/Completion)
  - `agent/` (完整 Agent)
  - `knowledge/` (完整 Knowledge Center)
  - `cards/` (完整 Growth Cards)
  - `review/` (完整 Review)
  - `settings/` (完整 Settings)
- 每拆一个模块，必须连同其 state / handlers / derived values 一起移动，保持业务闭环。

---

## 8. Learning Memory Engine（学习记忆引擎）

> 完整架构文档：[MEMORY_ENGINE.md](MEMORY_ENGINE.md)

### 8.1 核心理念

用户的**所有学习行为**（复盘的文本、AI 聊天的内容、做题的结果）不再是孤立的文字记录，而是经过结构化和分类处理，进入**统一的学习画像**，供所有模块共享。

### 8.2 数据流

```
用户输入（复盘 / 聊天 / 做题）
        ↓
   Memory Extractor（记忆提取器）
        ↓
   ┌──────┬──────┬──────┐
   │ 长期  │ 短期  │ 丢弃  │
   │ 记忆  │ 记忆  │      │
   └──┬───┴──┬───┴──────┘
      │      │
      ▼      ▼
  Knowledge Graph Updater（知识图谱更新器）
      │
      ▼
  Portrait Generator（每日画像生成器）
      │
      ▼
  Reflection Engine（AI 反思引擎）
      │
      ▼
  所有 Agent 共享
```

### 8.3 新增数据类型

| 类型 | 用途 | 保留周期 |
|------|------|---------|
| `StructuredReview` | 复盘的 AI 结构化解析结果 | 30天 |
| `MemoryItem` | 长期记忆条目（目标/习惯/弱点等） | 永久/可配置过期 |
| `KnowledgeSnapshot` | 知识点掌握度快照 | 90天 |
| `DailyPortrait` | 每日学习画像 | 90天 |
| `Reflection` | AI 后台反思记录 | 30天 |
| `ChatLearningEvent` | 聊天的学习行为提取 | 7天 |
| `LearningProfile` | 累积学习画像 | 永久 |

### 8.4 离线规则引擎

在 AI 未接入时，使用 `memory-rules.ts` 的规则引擎完成记忆分类：

```typescript
// 规则示例
"我只有晚上学习" → 长期记忆（习惯）
"今天导数不会" → 短期记忆（日复盘）
"今天天气真好" → 丢弃
```

参见：`app/lib/memory-rules.ts`

### 8.5 存储架构

- localStorage key 升级为 `nest-exam-workspace-v4`
- 数据版本 v2（支持记忆引擎字段）
- 自动清理过期数据（加载时执行）
- 所有记忆引擎操作通过 `storage.ts` 的辅助接口完成

### 8.6 实现计划

参见 [TODO.md](TODO.md) 的 P4 部分，共 6 个 Phase：

1. Phase 1: 结构化复盘（基础）
2. Phase 2: 记忆引擎核心
3. Phase 3: 知识图谱联动
4. Phase 4: 每日画像
5. Phase 5: AI 反思
6. Phase 6: 全模块共享

每个 Phase 可独立发布，不阻塞现有功能。
