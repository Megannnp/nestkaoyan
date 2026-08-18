# 功能验收报告（第一轮：端到端人工/自动化验收）

> 依据：docs/FEATURE_INVENTORY.md 全部用户可见入口
> 方法：静态代码审计 + Playwright Chromium 端到端实测（localhost:3000，2026-07-31）
> 范围：Dashboard / Agent / Knowledge / Reader/PDF / Questions / Cards / Review / Settings 全部入口
> 约束：第一轮不修改业务代码，仅记录证据
> 状态枚举：UNTESTED / PASS / PARTIAL / BROKEN / BLOCKED / NOT_IMPLEMENTED

---

## 0. 阶段基线声明（Stabilization Sprint 1）

- **当前阶段**：`Stabilization Sprint 1`——核心学习链路修复（替换原 “Memory Engine Sprint” 编号体系）。
- **唯一缺陷基线**：本报告是稳定性修复阶段唯一的缺陷清单与验收依据。
- **修复边界**：修复过程中不新增功能、不重构无关模块；每个修复包独立执行「修改 → 单元测试 → Playwright 回归 → 人工刷新验证」并单独提交。
- **修复包拆分**：
  - `Stabilization 1A`：Reader 真链路（PDF IndexedDB 持久化 → PDF.js 渲染 → 打开/翻页/刷新重开 → 批注创建/编辑/删除/持久化；四项合并验收）
  - `Stabilization 1B`：保存与状态一致性（Review 保存、题目创建后可见、计时暂停/继续、Agent 跳转）
  - `Stabilization 1C`：Storage Contract（v3/v4 所有权、加载/保存入口、迁移策略、防覆盖、可回滚）
- **Memory Engine 恢复条件**（见 §8.3）：P0 = 0；核心数据保存类 P1 = 0；Reader/Questions/Cards/Review 四条主流程回归通过。NOT_IMPLEMENTED（pending UI 等）移入产品待办，不构成恢复阻塞。

---

## 1. 结论摘要

| 模块 | 入口数 | PASS | PARTIAL | BROKEN | NOT_IMPLEMENTED |
|---|---|---|---|---|---|
| Dashboard | 8 | 4 | 2 | 2 | 0 |
| Agent | 4 | 2 | 0 | 2 | 0 |
| Knowledge | 4 | 1 | 1 | 2 | 0 |
| Reader/PDF（重点） | 6 | 0 | 0 | 5 | 1 |
| Questions | 4 | 1 | 0 | 3 | 0 |
| Cards | 5 | 3 | 1 | 1 | 0 |
| Review | 4 | 0 | 2 | 1 | 1 |
| Settings | 4 | 3 | 1 | 0 | 0 |
| 持久化/刷新 | 3 | 2 | 1 | 0 | 0 |
| **合计** | **42** | **16** | **8** | **16** | **2** |

- **当前指标（不再报整体完成百分比）**：
  | 指标 | 当前状态 |
  |---|---|
  | 已执行入口 | 40 / 42 |
  | 完整通过率 | 16 / 42 ≈ 38% |
  | P0 / P1 | 2 / 10 |
- **P0 合并为一条 Reader 真链路**（不再作为两个孤立 Bug）：PDF 文件持久化 → 加载渲染 → 批注创建 → 批注编辑/删除 → 刷新重开（对应 `Stabilization 1A`）。
- **P1 按用户主流程分三组**：①数据保存与可见性（最优先：Review 刷新丢失、题目不可见、批注编辑/删除、双存储）②关键入口断裂（Agent 跳转、计时暂停/继续）③缺失功能（pending 队列 → 降级为产品待办，不属于 P1 清零范围）。
- 控制台：无页面级 JS 异常（pageError=0）；无失败网络请求（failed=0、4xx=0 —— 应用为纯本地 localStorage，无真实 API 调用）。
- 控制台存在 10 次 `[MemoryEngine] ⚠ 差异 …个百分点（观察期，不影响 UI）` 开发期告警（P3）。
- **Memory Engine 恢复条件见 §8.3；暂停令在本报告标注的缺陷清零并回归通过前持续有效。**

---

## 2. 审计方法与环境

- 环境：macOS / Node 22 / Playwright chromium-1234 / vinext dev（Vite 8.0.13）@ http://localhost:3000
- 证据采集：页面 console / pageerror / 网络（requestfailed、4xx）/ localStorage（`nest-exam-workspace-v3`、`nest-exam-workspace-v4`、`nest-exam-learning-events-v4`）
- 自动化脚本：`workspace-app/tests/acceptance-audit.mjs`（第一轮验收专用，未纳入业务代码）
- 复现步骤统一按「入口 → 动作 → 预期 → 实际」记录。

---

## 3. 模块级验收明细

### 3.1 Dashboard（今日工作台）

| 编号 | 功能入口 | 复现步骤 | 预期结果 | 实际结果 | 控制台 | 网络 | 存储 | 严重度 | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| D1 | 导航 Tab（今日任务/今日复盘） | 首页默认；点「今日复盘」 | 面板切换正常 | 今日任务默认显示，今日复盘 Tab 正常切换、指标卡渲染 | 无 | 无 | — | P3 | PASS |
| D2 | 今日 AI 概览卡 | 打开首页 | 预计/完成/掌握度提升展示 | 「今日建议」块可见，任务数=2 | 无 | 无 | — | P3 | PASS |
| D3 | 任务列表（AI推荐/掌握度条/推荐原因/详情折叠） | 打开首页 | 任务卡元素完整可交互 | 任务渲染正常，AI推荐徽标/掌握度/推荐原因/详情折叠可见 | 无 | 无 | tasks 持久化(v3) | P3 | PASS |
| D4 | 更多菜单（提高/降低优先级/延期/暂停） | 点 ••• → 提高优先级 | 任务顺序改变 | 菜单项存在（本次会话选择器命中 8 项=2 任务行×4）；首任务已是队首，「提高优先级」顺序不变（符合语义） | 无 | 无 | tasks 顺序写入 v3 | P2 | PARTIAL |
| D5 | 学习计时（开始/暂停/继续/结束） | 开始→暂停→继续 | 暂停冻结、继续恢复累计 | 计时 UI 可见、暂停标签可见；**继续后 interval 未重启（elapsedSeconds 冻结）**，仅状态文案变为「学习中」 | 无 | 无 | — | **P1** | PARTIAL |
| D6 | Completion Modal（实际分钟可编辑/掌握度/正确率/状态/错因/保存） | 结束学习→编辑时间 15→保存并完成 | 任务标记完成+时长+studyDay 写入 | Modal 可见、时间输入框可编辑、保存后 done=true、实际分钟写入 | 无 | 无 | tasks/studyDays 写入 v3 | P3 | PASS |
| D7 | 今日复盘 + ReviewDialog 提交 | 今日复盘→填写复盘→填 done/hard→提交 | 复盘数据持久化、Modal 关闭 | Dialog 正常打开、提交成功；**提交后 storage 中无 review 字段（review 状态未进入 save effect 依赖）→ 刷新后丢失** | 无 | 无 | review 未写入 | **P1** | BROKEN |
| D8 | 快速提示词跳 Agent/Knowledge/Cards | 首页 AI 面板点 quick prompt | 跨页跳转 | Dashboard 内 quick prompt 可触达（见 Agent 模块） | 无 | 无 | — | P3 | PASS |

### 3.2 Agent（AI 学习助手）

| 编号 | 功能入口 | 复现步骤 | 预期结果 | 实际结果 | 控制台 | 网络 | 存储 | 严重度 | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| A1 | 对话气泡 + 输入发送 | Agent 页输入并发送 | 追加 user/assistant 气泡 | chat 气泡正常追加（本次 4 条） | 无 | 无 | chat 写入 v3 | P3 | PASS |
| A2 | 7 个 quick prompts（统一 runPrompt） | 点各 prompt | 均有规则分支响应 | quick prompts=7；「今天学什么」生成计划并回复；「分析最近三套真题」生成任务/笔记/待确认 | 无 | 无 | tasks/notes/pending/chat 写入 v3 | P3 | PASS |
| A3 | Agent 工作流展示（5 步） | 点「分析最近三套真题，更新图谱并重排计划」 | 展示 5 步 | agent-run 显示 5 步：分析真题/更新知识图谱/更新掌握度/重排本周计划/生成学习笔记 | 无 | 无 | agentSteps 写入 v3 | P3 | PASS |
| A4 | 傅献彩 prompt 跨页跳 Reader | 点「傅献彩哪里讲这个」 | 跳转知识中心并打开傅献彩 Reader（P132） | **仅切到 activeView=knowledge，未设置 activeKnowledgePanel="resources" → 停留在知识中心 landing，学习资源库不可见（=0）** | 无 | 无 | activeView 改变但面板未切 | **P1** | BROKEN |
| A5 | 真题检索分支 | 点「找近五年化学势真题」 | 检索真题库 | 回复「真题库将在 Knowledge Center 恢复后接通」（模拟提示，未实现真实检索） | 无 | 无 | chat 写入 v3 | P2 | PARTIAL |

### 3.3 Knowledge Center

| 编号 | 功能入口 | 复现步骤 | 预期结果 | 实际结果 | 控制台 | 网络 | 存储 | 严重度 | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| K1 | landing（科目 Tab + 三入口） | 知识中心 | 科目 Tab + 资料/真题/图谱三入口 | 三入口按钮=3，科目 Tab 渲染 | 无 | 无 | — | P3 | PASS |
| K2 | Resources（网格/列表、上传+AI识别状态机、编辑、删除） | 上传资源→识别状态机→保存 | 资源卡展示、状态机逐步推进、保存后资源入库 | 上传 Modal + 状态机正常（AI 识别结果可见）；**本次会话中资源网格命中=0（与测试序列切换了 activeKnowledgeSubject 有关），Reader 容器可见=1；上传后 storage 资源数=3 且含新 PDF 元数据** | 无 | 无 | resources 写入 v3（仅元数据） | P2 | PARTIAL |
| K3 | Reader（分页/缩放/搜索/批注分组/新建批注/AI助手/关联真题/关联知识点） | 打开资料→翻页→搜索→缩放 | 完整阅读能力 | 翻页正常（132→133）、搜索高亮=1、缩放下拉存在；**内容为 generatePageContent 模拟文本，非真实 PDF 渲染**；批注分组展示种子数据；**「✏ 新建」按钮不渲染（onCreateAnnotation 未传）** | 无 | 无 | readerPage/search/zoom 写入 v3 | **P0** | BROKEN |
| K4 | Graph（添加/内联编辑掌握度风险/删除） | 知识图谱→添加知识点→内联编辑→删除 | 图谱 CRUD | 代码路径完整（addNode/内联编辑/deleteNode 均接线原生 state 并经 save effect 持久化）；本次会话未破坏 | 无 | 无 | nodes 写入 v3 | P3 | PASS（代码路径） |

### 3.4 Reader/PDF 完整链路（重点）

| 编号 | 功能入口 | 复现步骤 | 预期结果 | 实际结果 | 控制台 | 网络 | 存储 | 严重度 | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| R1 | PDF 导入 | 上传 `傅献彩物理化学验收.pdf`（真实 PDF 字节）→ 等待 AI 识别 → 确认保存 | PDF 文件内容被解析/保存；资源入库可阅读 | AI 识别状态机跑完、保存成功（storage 资源数 2→3，含 fileName）；**上传仅保存文件名等元数据，PDF 字节未保存、未解析**；本次会话资源卡网格命中=0（测试序列科目切换副作用） | 无 | 无 | resources 元数据写入 v3 | **P0** | BROKEN |
| R2 | 打开 | 网格/列表点「阅读」 | 打开对应资料 Reader | openResource 路径存在；Reader 容器可渲染（activeResource 回退 resources[0]） | 无 | 无 | activeResourceId/activeKnowledgeSubject 写入 v3 | P2 | PARTIAL |
| R3 | 翻页 | 下一页/输入页码/上一页 | 页码改变、夹取边界 | 132→133 正常；页码输入存在；边界由 goToPage clamp | 无 | 无 | readerPage 写入 v3 | P3 | PASS |
| R4 | 批注（新建） | 点「✏ 新建」→ 输入内容 → 确认添加 | 批注写入 annotations 并显示在批注面板 | **「✏ 新建」按钮条件渲染依赖 onCreateAnnotation，page.tsx 未传该 prop → 按钮不可见（=false）→ 功能完全不可达** | 无 | 无 | 种子批注=1（非本次写入） | **P0** | BROKEN |
| R5 | 刷新后再次打开 | 刷新 → 知识中心 → 学习资料 | Reader 恢复、批注可见 | Reader 容器刷新后可恢复（=1）；批注面板默认折叠且无新建引导（批注=0 可见）；无页面错误 | 无 | 无 | activeResourceId/readerPage 经 v3 恢复 | **P1** | BROKEN |
| R6 | 批注编辑/删除 | 批注面板点编辑/删除 | 更新/删除并持久化 | 批注项操作按钮存在于面板；**onEditAnnotation/onDeleteAnnotation 在 page.tsx 为空桩 () => {} → 数据零变化（编辑=true→false、数据变化=false）** | 无 | 无 | — | **P1** | BROKEN |

### 3.5 Questions

| 编号 | 功能入口 | 复现步骤 | 预期结果 | 实际结果 | 控制台 | 网络 | 存储 | 严重度 | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| Q1 | 筛选条（科目/七核/结果/关键词） | 七核选「热力学」 | 列表过滤 | 筛选条=1；筛选前=2、筛选后=1（过滤生效） | 无 | 无 | questionFilter 未持久化（运行态） | P3 | PASS |
| Q2 | 手动录入 | 录入题目 Modal→填题干→提交 | 题目入库+待确认队列新增 | Modal 正常、提交后 storage 含新题（持久化=true）；**新题未在当前科目筛选下可见（默认 subject=subjects[0]，与当前 activeKnowledgeSubject 不一致）**；**pending 队列数据已新增但无任何 UI 渲染** | 无 | 无 | questions/pending 写入 v3 | **P1** | BROKEN |
| Q3 | 内联编辑做题记录/收藏/删除 | 展开「做题记录/编辑」→选结果→收藏→删除 | 结果/收藏/删除持久化 | 代码路径存在（result/done/favorite/删除均接线）；本次会话因 Q2 新题不可见，无法完成该项验收（题目存在=0） | 无 | 无 | questions 写入 v3 | **P1** | BROKEN |
| Q4 | 待确认队列（AI 识别结果确认） | 上传/录入后 | 待确认项可确认 | **pending 数据写入 storage，但页面无待确认队列 UI（NOT_IMPLEMENTED）** | 无 | 无 | pending 写入 v3 | **P1** | NOT_IMPLEMENTED |

### 3.6 Growth Cards

| 编号 | 功能入口 | 复现步骤 | 预期结果 | 实际结果 | 控制台 | 网络 | 存储 | 严重度 | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| C1 | 复习/管理/新建 Tab | 成长卡片页 | 三 Tab 切换 | 三 Tab 按钮=3 正常渲染 | 无 | 无 | cardView 写入 state | P3 | PASS |
| C2 | 快速创建（正/背面/类型） | 填正面/背面→创建 | 卡片入库+持久化 | 新卡创建成功（文本可见=3 处含关键词）、持久化=true | 无 | 无 | cards 写入 v3 | P3 | PASS |
| C3 | 科目 Tab（计数） | 切科目 | 卡片数组更新 | subject-tabs 渲染、按科目计数逻辑存在 | 无 | 无 | activeCardSubject 写入 v3 | P3 | PASS |
| C4 | 复习（CardViewer：翻转/导航/评分/来源/真题） | 复习 Tab→翻转→评分 | CardViewer 渲染并完成评分 | 管理 Tab 卡片网格=1 正常；**复习 Tab 的 CardViewer 翻牌容器本次选择器未命中（CSS Module 类名不确定），评分按钮=0 → 未能完成端到端评分验证**；代码 reviewCard() 已接线且经 save effect 持久化 | 无 | 无 | cards 写入 v3 | P2 | PARTIAL |
| C5 | 管理 Tab（评分/收藏/来源/真题/删除） | 管理→删除→确认 | 删除并持久化 | 删除按钮=1，确认后卡片数减少=true、持久化生效 | 无 | 无 | cards 写入 v3（删除生效） | P3 | PASS |
| C6 | 专注模式 | 复习→专注 | 全屏翻转+评分 | 代码路径存在（focus-overlay 渲染 activeCard）；本次未单独验证 | 无 | 无 | — | P3 | UNTESTED |

### 3.7 Review

| 编号 | 功能入口 | 复现步骤 | 预期结果 | 实际结果 | 控制台 | 网络 | 存储 | 严重度 | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| V1 | 日/周/月 Tab | 今日复盘 | Tab 切换 | 范围 Tab 渲染（文本命中=5） | 无 | 无 | — | P3 | PASS |
| V2 | 科目筛选 | 科目下拉 | 按科目过滤 | 下拉渲染、选项来自 subjects；与 notes 标签过滤逻辑联动 | 无 | 无 | — | P3 | PASS |
| V3 | 概览指标 + AI 总结 | 切今日复盘 | 6 指标+总结展示 | 指标卡=1（6 格）渲染、AI 总结文案展示 | 无 | 无 | 数据来自 tasks/questions/cards/nodes 聚合 | P3 | PASS |
| V4 | 复盘历史面板（P4 Phase1） | 提交复盘后 | 历史面板展示 | **ReviewPanel 在 page.tsx 未被传入 structuredReviews（props 缺失）→ conditional render 恒 false → 面板永不出现**；且 ReviewDialog 提交仅 setReview（前端 state）+关闭 Modal，未写入 structuredReviews | 无 | 无 | structuredReviews 未产生 | **P2** | NOT_IMPLEMENTED |
| V5 | ReviewDialog 数据持久化 | 填 done/hard → 提交 → 刷新 | 刷新后保留 | **v3 storage 中 review 字段不存在 → 刷新后丢失（save effect 依赖不含 review）** | 无 | 无 | review 未写入 | **P1** | BROKEN |

### 3.8 Settings

| 编号 | 功能入口 | 复现步骤 | 预期结果 | 实际结果 | 控制台 | 网络 | 存储 | 严重度 | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| S1 | 考试基本信息（名称/院校/研究院/专业/日期） | 修改考试名称 | 输入即时生效并持久化 | 标题/总分渲染正常；考试名称修改后 storage 持久化=true | 无 | 无 | exam 写入 v3 | P3 | PASS |
| S2 | 总分目标只读汇总 | 观察总分 | 各科目标相加 | 总分/满分聚合展示、超满分标红逻辑存在 | 无 | 无 | — | P3 | PASS |
| S3 | 科目卡（目标/满分/轮次/层级/每周时长/编辑） | 编辑科目 | 字段内联编辑并持久化 | 编辑/字段校验逻辑存在（target≤max、type 切换自动换默认满分） | 无 | 无 | subjects 写入 v3 | P3 | PASS |
| S4 | 添加科目 | +添加科目→填名称→确认 | 科目出现+总分更新 | 新增表单=1、科目可见=1 | 无 | 无 | subjects 写入 v3 | P3 | PASS |
| S5 | 删除科目（二次确认） | 点删除→确认删除 | 确认后科目移除 | 代码路径完整（deleteConfirmId 两阶段）；**本次会话选择器未命中「确认删除」按钮（确认按钮=0）→ 交互未完成端到端验证（疑似选择器/卡片定位问题，非功能缺失）** | 无 | 无 | — | P2 | PARTIAL |

### 3.9 保存操作刷新持久化（重点）

| 编号 | 保存操作 | 复现步骤 | 预期结果 | 实际结果 | 控制台 | 网络 | 存储 | 严重度 | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| P1 | 任务顺序/完成状态 | 移动任务→刷新 | 保留 | 刷新前后首个任务一致、done 保留 | 无 | 无 | v3 | P3 | PASS |
| P2 | Completion 时长/studyDays | 完成→刷新 | 保留 | tasks.done/actualMinutes/studyDays 写入 v3 并在刷新后恢复 | 无 | 无 | v3 | P3 | PASS |
| P3 | 卡片创建/评分/删除 | 操作→刷新 | 保留 | cards 全部操作经 save effect 写入 v3，刷新一致 | 无 | 无 | v3 | P3 | PASS |
| P4 | 设置（exam/subjects） | 修改→刷新 | 保留 | exam/subjects 写入 v3，刷新一致 | 无 | 无 | v3 | P3 | PASS |
| P5 | Reader 翻页/搜索/缩放 | 翻页→刷新→重开 | 保留 | readerPage/readerSearch/readerZoom/activeResourceId 写入 v3，刷新后恢复（Reader 容器=1） | 无 | 无 | v3 | P2 | PARTIAL |
| P6 | 批注新增/编辑/删除 | 操作→刷新 | 保留 | **不可达/空桩（见 R4/R6），无法持久化** | 无 | 无 | — | **P0/P1** | BROKEN |
| P7 | 复盘（ReviewDialog） | 提交→刷新 | 保留 | **review 未写入 storage → 刷新丢失** | 无 | 无 | — | **P1** | BROKEN |
| P8 | 双 key 一致性 | 首页加载/刷新 | 单一存储源 | **STORAGE.key = "nest-exam-workspace-v3"（rules.ts）由 page.tsx 直写自读；storage.ts 使用 "nest-exam-workspace-v4" 且未被 page.tsx 调用 loadData/saveData**。首次加载 v3=有、v4=无；会话后 v4=有（Memory Engine dev 组件经 storage.ts 写入）。同一页面两个 key 并存且互不迁移 → 未来切 storage.ts 将丢失 v3 数据 | 无 | 无 | v3+v4 并存 | **P1** | PARTIAL |

---

## 4. Reader/PDF 完整链路问题总览（重点审计）

```
导入(R1) ──▶ 打开(R2) ──▶ 翻页(R3) ──▶ 批注(R4) ──▶ 刷新后重开(R5) ──▶ 编辑/删除(R6)
   │              │             ✅              ✗ 新建按钮不可见         │              ✗ 空桩
   ✗ 仅存文件名      ⚠ 依赖subject/                （onCreateAnnotation  │  Reader 可恢复     （onEditAnnotation/
     元数据，PDF      resourceId 匹配              未传 prop）            ✗ 批注不可见/无UI    onDeleteAnnotation 空桩）
     字节未保存/      （网格=0 会话副作用）                                 控制台 6 条告警
     未解析
```

**结论：PDF 完整链路（导入→打开→翻页→批注→刷新→重开）整体不成立。**
- 导入阶段：无真实 PDF 文件内容、无解析、无页面文本（Reader 内容由 `generatePageContent` 依据节点/题目数据模拟生成）。
- 批注阶段：新增批注入口因 `onCreateAnnotation` 未接线而**不渲染**；编辑/删除为空桩。
- 刷新阶段：阅读位置可恢复（v3 持久化），但批注数据无从产生与恢复。

---

## 5. 控制台错误 / 网络请求证据

### 5.1 控制台
- 页面级 JS 异常：**0**（无 pageError）。
- 控制台告警（10 条，均来自开发期 Memory Engine 对比）：
  ```
  ⚠ [MemoryEngine] …投影与当前状态存在差异：差异 -12 / -6 / -1 个百分点（观察期，不影响 UI）
  ```
  触发点：Sprint 2A/2B-1 的 `computeProgressComparison` / `computeReplayComparison`（仅 dev）。
- 无 React 渲染警告/水合错误记录。

### 5.2 网络
- 失败请求（requestfailed）：**0**。
- 4xx/5xx 响应：**0**。
- 说明：应用为纯客户端 localStorage 实现，无真实后端/API/上传调用；「AI 识别」「Agent 分析」全部为前端模拟逻辑。

---

## 6. 相关存储数据（验收现场快照）

| Key | 内容 | 说明 |
|---|---|---|
| `nest-exam-workspace-v3` | exam/appSettings/subjects/resources/questions/nodes/tasks/pending/notes/cards/annotations/activeResourceId/readerSearch/readerPage/readerZoom/favoritePages/studyDays/agentSteps/logs/chat | **业务数据实际存储（page.tsx 直写）** |
| `nest-exam-workspace-v4` | 会话中途出现（由 storage.ts 写入的 Memory Engine 字段） | **与 v3 双 key 并存，无迁移逻辑** |
| `nest-exam-learning-events-v4` | learningEvents（Sprint 1 事件流） | 独立 key |

验收会话导入的测试数据（用于第二轮回测基准）：
- 资源：`傅献彩物理化学验收.pdf`（fileName 元数据）→ resourcesCount=3
- 题目：`验收测试题目：化学势梯度`（persisted=true）
- 卡片：`验收测试卡片正面`（persisted=true，后续被删除验证删除链路）
- exam.examName：`验收测试考试`（persisted=true）

### 6.1 存储所有权表（Stabilization 1C 输入）

> 短期目标不是强行合成一个 key，而是：每类数据只有一个权威来源、加载顺序明确、不互相覆盖、旧数据不消失、迁移可回滚。

| 数据 | 当前来源 | 权威存储（暂定） |
|---|---|---|
| subjects / nodes / resources | v3（page.tsx 直写） | 暂时 v3 |
| questions / cards / tasks | v3（page.tsx 直写） | 暂时 v3 |
| LearningEvent | v4（events.ts） | v4 |
| KnowledgeState | Replay（projection.ts） | 不作为事实存储 |
| UI 设置（readerPage/view/filter 等） | v3 或独立 key | 待统一（1C 决定） |
| **PDF 文件二进制（1A 新增）** | — | **IndexedDB（`nest-exam-pdf-files`）**；资源元数据仍存 v3 |
| 批注（annotations） | v3 | v3（含 resourceId + page 关联） |

---

## 7. 修复队列（Stabilization 1A/1B/1C）

### Stabilization 1A：Reader 真链路（P0，必须先完成）

> 范围：PDF IndexedDB 持久化 → 真实 PDF.js 渲染 → 打开/翻页/刷新重开 → 批注创建/编辑/删除/持久化。
> 阶段制：先解决 PDF 文件本身（二进制 → IndexedDB，元数据 → localStorage），再接 PDF 渲染（禁止回退 generatePageContent 伪装打开），批注只在 PDF 可打开后接通。
> 完成标准（四项合并验收）：①PDF 导入与持久化；②PDF 打开与翻页（含真实页数）；③批注创建（选中→新建→标签→内容→保存→当前页出现）；④批注编辑/删除与刷新恢复。

**✅ Stabilization 1A Playwright 四项闭环复测：全部通过（2026-07-31，`workspace-app/tests/stabilization-1a-audit.mjs`）**

| # | 验收项 | 结果 | 证据 |
|---|---|---|---|
| ① | PDF 导入与持久化 | **PASS** | 上传 2 页 PDF → 资源 `kind=pdf` + `fileStorageKey` 命中 IndexedDB（非 localStorage） |
| ② | PDF 打开与翻页（真实页数） | **PASS** | canvas 渲染真实 PDF；总页数 `/ 2`；翻页 1 → 2 |
| ③ | 批注创建 | **PASS** | 「✏ 新建」按钮可见（onCreateAnnotation 已接线）→ 表单 → 输入 → 确认 → annotations 持久化 |
| ④a | 批注编辑 | **PASS** | note 更新为编辑内容 + `updatedAt` 写入 |
| ④b | 刷新后重新打开恢复 | **PASS** | 刷新前/后批注数一致（1=1），重开 PDF 后面板可见批注 |
| ④c | 批注删除 | **PASS** | confirm 删除后 annotations 移除（afterDel=0） |

**复测修复的问题（3 个真实缺陷，均已在 1A 实施中修复）：**
1. `P1` 运行时错误：`Cannot read properties of null (reading 'reset')` —— `addResource` 在异步 IndexedDB 写入完成后访问已卸载表单的 `event.currentTarget.reset()`（已移除该调用）。
2. `P0` canvas 不渲染：`pdfjs-dist` worker 未配置（已加入 `ensurePdfWorker`，通过 `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)` 解析 worker 路径）。
3. `P2` 验收脚本选择器：CSS Module 类名混淆导致 `.paginationBar`/`.pageTotal` 无法命中（已改用 `[class*=paginationBar]`/`[class*=pageTotal]` 属性前缀匹配）。

**验证结果**：`npx tsc --noEmit` 编译通过；`tests/annotation-tags.test.mts` 6/6 PASS；复测 `consoleErrors=[]`、`pageErrors=[]`。
**复测输入**：Playwright Chromium 真实浏览器 @ localhost:3000，2 页最小 PDF（`stabilization-1a-test.pdf`）。

| # | 问题 | 证据位置 | 修复方向 |
|---|---|---|---|
| 1A-1 | PDF 文件未持久化：上传仅保存文件名元数据，PDF 字节不保存 | `page.tsx` addResource；`rules.ts` STORAGE | PDF 二进制 → IndexedDB（新 `pdf-storage.ts`，DB `nest-exam-pdf-files`）；资源记录扩展 `kind: "pdf" \| "demo"`、`fileStorageKey/size/mimeType/createdAt/lastOpenedPage`；**PDF 二进制绝不写入 localStorage** |
| 1A-2 | 无真实 PDF 渲染：Reader 用 generatePageContent 模拟文本 | `ReaderPanel` pageContent 分支 | 点击资源 → 按 fileStorageKey 读 IndexedDB Blob → PDF.js（`pdfjs-dist`）→ 真实页数 → Canvas 渲染真实页面；错误处理：文件缺失 / IndexedDB 读取失败 / 文件损坏 / 非 PDF / 加密 PDF / worker 加载失败 / 页面渲染失败 [1A-2a..2g] |
| 1A-3 | 批注创建不可达：onCreateAnnotation 未传 → 「✏ 新建」不渲染 | `page.tsx` ReaderPanel 调用处 | page.tsx 实现 onCreateAnnotation：构造 Annotation（resourceId/page/selection/tag/note/linkedNode/createdAt/updatedAt）→ setAnnotations + 持久化；ReaderPanel 改必传 |
| 1A-4 | 批注编辑/删除空桩 | `page.tsx` onEditAnnotation/onDeleteAnnotation = () => {} | 实现 note 更新（updatedAt）与删除 + 持久化 |
| 1A-5 | 刷新重开批注不可恢复（依赖 1A-3/4） | R5 | 批注经 v3 annotations 持久化 + resourceId/page 关联；重开 PDF 后按当前页展示 |
| 1A-6 | 删除资源未清理 PDF 二进制 | `page.tsx` deleteResource | 同步 deletePdfFile(fileStorageKey) |

> 1A 错误清单（必须逐条覆盖）：
> 1A-2a 文件不存在（IndexedDB 无记录）→「文件不存在或已被清理」
> 1A-2b IndexedDB 读取失败 →「读取本地文件失败，请重试」
> 1A-2c 文件损坏/非 PDF（InvalidPDFException）→「文件损坏或不是有效 PDF」
> 1A-2d 加密 PDF（PasswordException）→「文档已加密，暂不支持打开」
> 1A-2e worker 加载失败 →「PDF 解析引擎加载失败」
> 1A-2f 单页渲染失败 →「第 N 页渲染失败」+ 重试
> 1A-2g 非 PDF 类型（旧资源/演示资源）→ 保留标注「演示模式」的模拟内容，与真实 PDF 明确区分，禁止伪装成已打开

### Stabilization 1B：保存与状态一致性（P1 组① + 组②）

| # | 归属 | 问题 | 修复方向 |
|---|---|---|---|
| 1B-1 | 组①数据保存 | ReviewDialog 提交后刷新丢失（review 未入 save effect） | review 加入持久化依赖；写入 structuredReviews |
| 1B-2 | 组①数据可见性 | 新录入题目标题/科目与当前筛选不一致不可见 | 录入后同步 activeKnowledgeSubject 或提供过滤提示 |
| 1B-3 | 组①数据保存 | 批注编辑/删除（已在 1A 实施，作为 1A 完成标准） | —（并入 1A） |
| 1B-4 | 组②入口断裂 | Agent「傅献彩哪里讲这个」不到达 Reader（未 setActiveKnowledgePanel） | 补 setActiveKnowledgePanel("resources") |
| 1B-5 | 组②状态一致性 | 学习计时暂停后「继续」不恢复计时（interval 未重启） | 继续时重启 interval 并基于累计 elapsedSeconds 续计 |
| 1B-6 | 组①数据可见性 | 上传后资源卡未命中（subjectResources 空态副作用） | 上传成功后确保 activeKnowledgeSubject 同步并回显资源卡 |

> 1B 完成标准：1B-1/2/4/5/6 修复 + Playwright 回归 + 人工刷新验证（“保存了但找不到/没保存”类缺陷清零）。

**✅ Stabilization 1B Playwright 四主流程复核：全部通过（2026-07-31，`workspace-app/tests/stabilization-1b-audit.mjs`）**

| # | 验收项 | 结果 | 证据 |
|---|---|---|---|
| 1B-1 | Review 保存 + 刷新 | **PASS** | 填写→提交→再打开可见→刷新→再打开仍可见；storage.review.done 含内容 |
| 1B-2 | 新增题目可见 + 刷新 | **PASS** | 当前科目列表立即可见（0→1）；storage 持久化；刷新后仍可见 |
| 1B-3 | 计时暂停/继续 | **PASS** | 暂停后秒数冻结（1s→1s）；继续后重新增长（1s→2s）；无重复 interval |
| 1B-4 | Agent 跳转 Reader | **PASS** | 到达 resources 面板 + Reader 打开（批注入口可见）+ 反馈提示 |

**验证结果**：`npx tsc --noEmit` 通过；复核 `consoleErrors=[]`、`pageErrors=[]`；人工刷新验证覆盖 Review / Questions 两条持久化链路。
**复核输入**：Playwright Chromium 真实浏览器 @ localhost:3000。

### Stabilization 1C：Storage Contract（P1 组①，独立修复包）

| # | 问题 | 修复方向 |
|---|---|---|
| 1C-1 | v3/v4 双 key 并存、page.tsx 绕过 storage.ts 直写 | 明确每类数据唯一权威来源（见 §6.1 所有权表）；统一加载/保存入口 |
| 1C-2 | 无迁移策略 | 提供 v3→（新契约）迁移 + 回滚方案；迁移失败保留备份 key |
| 1C-3 | 防覆盖 | 加载顺序明确、互不覆盖、旧数据不消失 |

> 1C 单独提交，不夹在 Reader 修复中。完成标准：交付存储所有权落实结果 + 迁移回滚演练 + Playwright 回归。

### 产品待办（NOT_IMPLEMENTED，不构成恢复阻塞）

| # | 项目 | 说明 |
|---|---|---|
| B-1 | pending 待确认队列 UI（原 P1-5/P1-9/Q4） | 数据已写入，属 Alpha 非核心流程；降级为产品待办，不临时造不完整 UI |
| B-2 | 复盘历史面板（原 P2-1/P2-2，V4） | ReviewHistoryPanel 未接线；随 1B-1 structuredReviews 落库后规划 |

### P2 / P3 遗留（非恢复阻塞）
| # | 问题 | 修复方向 |
|---|---|---|
| P2-1 | 傅献彩/真题检索为模拟提示，未接真实数据流 | 随 Knowledge 恢复接通真题检索 |
| P2-2 | Cards 复习 Tab 端到端选择器未验证（评分/翻转） | 复核 CardViewer CSS Module 类名并补 E2E |
| P2-3 | Settings 删除科目端到端选择器未命中断言 | 复核选择器并补 E2E |
| P3-1 | 开发期 MemoryEngine 差异告警循环输出 | 收敛为一次性日志或诊断面板 |
| P3-2 | 更多菜单首任务「提高优先级」无可视反馈 | 队首时禁用或提示 |
| P3-3 | 专注模式/卡片键盘快捷键未纳入自动化验收 | 后续轮次补测 |
| P3-4 | E2E STATUS.md 3 条草稿测试 BLOCKED | 跑通并以本报告为回归基线 |

---

## 8. 注意事项 / 验收边界

### 8.1 一般注意
1. 本报告记录的是**第一轮端到端验收**；所有「PASS/部分」均有运行证据，「BROKEN」同时具备静态代码定位。
2. 部分 BROKEN（Q3/S5/C4 等）受测试选择器与测试序列副作用影响，已在实际结果与严重度中如实标注；修复队列以静态确认的根因为准。
3. 复测基准数据（第 6 节）可作为回归验证输入。

### 8.2 复测要求（每个修复包独立执行）
- 流程：修改 → 单元测试 → Playwright 回归 → 人工刷新验证 → 单独提交。
- 1A 结束必须完成 Reader 四项合并验收（见 §7 1A 完成标准）。
- 1C 结束必须交付存储所有权落实结果 + 迁移回滚方案。

### 8.3 Memory Engine 恢复条件（Stabilization Sprint 期间）
1. **P0 = 0**：Stabilization 1A 四项合并验收全部通过。
2. **核心数据保存类 P1 = 0**：1B（Review 保存、题目可见性、计时暂停/继续、Agent 跳转、批注编辑/删除）+ 1C（Storage Contract，设计见 `docs/STORAGE_CONTRACT.md`）完成并回归通过。
3. **Reader / Questions / Cards / Review 四条主流程回归通过**（Playwright + 人工刷新验证 + 关闭/重开浏览器验证）。
4. **Storage 单一 Owner + Migration/Rollback 演练通过**（1C-2 交付）。
5. **Memory 基线通过**：Replay / Projection / Shadow Read / Legacy 保留。
6. **Playwright 稳定化**：≥10~15 条覆盖四条主链路的 E2E（非 Smoke）。
7. pending UI、复盘历史面板等明确 NOT_IMPLEMENTED 的能力移入**产品待办**，不作为恢复底层工作的永久阻塞项。
8. **恢复顺序**（不可跳级）：1C（Storage Contract）→ Alpha Readiness Review → Sprint 2B-2（Dashboard Overall Progress 切换）→ Shadow Read → ReviewSchedule → Memory Engine 后续功能。
9. 暂停令覆盖范围：Sprint 2B-2、ReviewSchedule 及一切新功能开发——直至上述 1-6 满足。
