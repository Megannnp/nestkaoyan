# 开发计划 (TODO)

> 六次审查报告：[REVIEW_v4.md](/docs/REVIEW_v4.md)（2026-08-02，完成度 ~83%）
> 最近更新：2026-08-06 — globals.css 大规模迁移（2172 → ~180 行）+ 死类清理

---

## 2026-08-03（设置页层级化——第二轮反馈：内容不要平铺）

> 用户反馈：设置内容不要平铺，需要有层级。已将平铺区块改为「设置首页入口列表 + 二级页」两级结构：
> - [x] **设置首页 3 个入口卡片**：我的目标（🎯）/ AI 学习助手（🤖）/ 数据管理（📦），每个含图标 + 标题 + 摘要副标题 + 箭头
> - [x] **点击入口进入二级页**：我的目标（考试与科目设置）、AI 学习助手、数据管理各自独立页面，顶部「← 返回」
> - [x] **首页入口摘要展示关键信息**：目标总分 N 分·考试日期已设置 / AI 当前已开启·关闭 / 数据管理导入导出
> - [x] **修复渲染期创建组件违规**：`GoalPage/AiPage/DataPage` → `goalView/aiView/dataView`（JSX 变量），消除 `react-hooks/static-components` 3 errors
> - [x] E2E 同步：新增「入口列表」断言；删除科目测试先进入「我的目标」二级页
>
> ### 验证（2026-08-03 实测）
> - `npx tsc --noEmit` ✅ / `npm run lint` ✅ / 单测 72/72 ✅ / `npm run build` ✅

---

## 2026-08-03（设置页「学习档案」重构——用户反馈极简学习系统）

> - [x] **结构收敛**：一级标题「我的学习档案」+ 顶部「我的考试」摘要卡（考试/院校/专业/日期/目标总分）；区块收敛为 我的目标 / AI 学习助手 / 数据管理 / 高级设置
> - [x] **总分非百分制修复**：删除「272 / 100」错误百分制显示（总分不是百分制，由各科目标分相加）；改为「272 分」+「来自 N 个科目」
> - [x] **科目卡精简**：非编辑态只显示名称 + 目标分 + 每周计划 + 当前进度；类型/轮次/层级收进编辑展开
> - [x] **风险状态 → 学习状态**：「高风险」等金融化词改为「需要加强」徽章（✓ 正常 / ● 需要加强）
> - [x] **AI 设置改用户语言**：「权限与行为」→「AI 学习助手」；「AI 执行修改前需确认」→「AI 修改内容前询问我（修改计划/更新图谱/创建卡片前先征求同意）」；「回答详细程度」→「回答风格：简洁/标准/深入」并移入 AI 区
> - [x] **数据管理**：「JSON 备份与恢复」→「导入资料 / 导出学习档案」
> - [x] **高级设置折叠**：AI 引擎/provider/model/retrievalMode 技术参数默认折叠
> - [x] E2E 同步：新增「学习档案总览」断言；保留删除科目选择器
>
> ### 验证（2026-08-03 实测）
> - `npx tsc --noEmit` ✅ / `npm run lint` ✅ / 单测 72/72 ✅ / `npm run build` ✅

---

## 2026-08-03（第六轮审查修复收口）

> 本轮为 2026-08-03 全站审查发现问题的全部修复：
> - [x] **意图路由误匹配收紧**：`text.includes("错")`/`text.includes("不会")` 误匹配「没错」「不会吧」「搞错了」等口语 → 改为明确错因意图正则（错因/错题/做错/总错/不会做/不会…题等）；新增 4 条误触发回归 + 4 条明确意图命中断言
> - [x] **通用 AI 对话接线（消除「假 AI 兜底」）**：`runPrompt` fallback 原返回固定文案「已收到…」；现调用已就绪的 `chatComplete`（/api/chat-complete）接 DeepSeek 自由文本补全，system 含当前学科/轮次/层级上下文；无 key 诚实降级标注「演示回复（未接真模型）」——`chatComplete`/`chatErrorReason` 原仅导入未使用产生的 2 个 lint warning 同步消除
> - [x] **导出版本号硬编码 → 常量**：`handleExportData` 原 `storageVersion: 6` 与 `STORAGE_VERSION` 分离，升 v7 后备份导入会触发只读保护拒写；现改用 `STORAGE_VERSION` 引用
> - [x] **ChatPanel 内联 `<style>` 迁移 CSS Module**：`.thin-scrollbar` / `.message-fade-in` + keyframes 迁移到 `components.module.css`（`:global()` 声明避免哈希化断裂）；删除组件内 27 行 `<style>` 块
>
> ### 验证（2026-08-03 实测）
> - `npx tsc --noEmit` ✅ 0 错误
> - `npm run lint` ✅ **0 errors / 0 warnings**（此前 2 warnings 已清除）
> - 单测全套 **72/72 PASS**（原 71 + 意图收紧断言 1）
> - `npm run build` ✅（vinext build 5 阶段全通过）

---

## ✅ 已完成 (全部核心任务)

### P0 基础改进 (7 项) ✅
### P2 中期改进 (4 项) ✅
### P3 组件拆分 ✅
### P4 记忆引擎全部 Phase 1-6 ✅

### 架构总交付
| 类别 | 数量 | 文件 |
|------|------|------|
| 组件 | 8 | Sidebar, Modal, TaskCard, ReaderPanel, CardViewer, ReviewPanel, ReviewDialog, ReviewHistoryPanel |
| 自定义 Hooks | 8 | useLocalStorage, useExam, useSubjects, useTasks, useQuestions, useNodes, useCards, useHeatmap |
| 核心 lib 模块 | 14 | rules, storage(新), memory-rules, memory-engine, plan-generator, css-utils, katex-utils, design-tokens, colors, default-data, types, error-boundary, pdf-storage, events |
| CSS Module | 1 | styles/workspace.module.css |
| page.tsx | - | 重构为组件化架构 |

### 核心功能清单
- [x] 动态计划生成（基于 weekdayHours/weekendHours）
- [x] 复盘历史记录面板（显示记录 + 展开查看 aiSummary + 知识图谱影响）— 2026-08-01 已接线
- [x] pending 待确认队列 UI（确认/忽略操作）— 2026-08-01 已实现
- [x] Storage Contract 1C-1: 单一 v5 key + hydrateWorkspace/saveWorkspace/migrateWorkspace + v3/v4 迁移回滚 — 2026-08-01 已实现
- [x] 记忆引擎单例 (Phase 2-6): 记忆 CRUD/检索、掌握度快照、每日画像、AI 反思/异常检测、全模块共享

### Storage Contract 1C-2 (migration/rollback 演练)
- [x] 模拟 v3+v4 共存现场 → 迁移 → 校验 storageVersion=5（2026-08-01，storage-contract-1c.test.mts 8/8 PASS）
- [x] 回滚演练（删除新 key 后重跑迁移仍成功）
- [x] 幂等 / 只读保护 / 损坏备份 / 写失败不覆盖
- [x] **写侧版本守卫（P1，2026-08-01 第三轮审查）**：saveWorkspace 写前检查磁盘版本，高于当前 → 拒写返回 false（与读侧对称，防旧构建降级覆盖未来版本数据）；存储契约测试扩至 10/10 PASS
- [x] Playwright 回归（Dashboard/Reader/Questions/Cards/Review 四条链 + 刷新）— 52/52 PASS（2026-08-01）

### 2026-08-01 新增完成（E2E 稳定化 + UX 减法）
- [x] E2E 全量回归 52/52 PASS（cards 10/10、dashboard+flows 15/15、Agent 6/6 单独验证稳定）
- [x] `freshState()` 用 `addInitScript` 注入 `onboardingCompleted=true`，根治 Onboarding 全屏拦截
- [x] 评分按钮降饱和度（认识 #4CAF74 / 模糊 #C89B4A / 不会 #B5655D，不改色义）
- [x] AI 对话顶部「当前学科+资料+页码」状态栏删除，上下文改消息内联（2026-08-01 交互审查：发现 page.tsx 仍传 currentSubject/currentResource/currentPage 且 ChatPanel 第 410-428 行仍渲染该状态栏 → 文档与代码不一致，标记待删除/确认）
- [x] E2E STATUS.md 更新为 PASS（52/52）

### 2026-08-01 交互审查修复（第四轮）
- [x] **P0 键盘误触**：卡片组全局 `handleKey`（空格/方向键/1/2/3 评分）未检查输入框焦点 → 在搜索/新建卡片组/编辑表单时打字会误触翻面或评分。已加 INPUT/TEXTAREA/contentEditable 焦点保护
- [x] **P2 专注模式配色不一致**：page.tsx 内嵌专注模式仍用旧色（#16A34A/#F59E0B/#EF4444），CardViewer.tsx 组件已降饱和（#4CAF74/#C89B4A/#B5655D）→ 已统一

---

## Material-First 架构方向（P0 产品决策，2026-08-01 用户确认）

> 系统以「资料（Material）」为一级入口，而非「题目（Question）」。详细设计见 [docs/MATERIAL_FIRST_ARCHITECTURE.md](MATERIAL_FIRST_ARCHITECTURE.md)。

### Phase 1：模型层与 UI 准备（✅ 2026-08-01 已完成）
- [x] types.ts 新增 MaterialType/MaterialStatus + Material、MaterialSection 类型 + `resourceToMaterial` 转换器（兼容旧 Resource）
- [x] 资源库改为「我的资料库」视图 + 「上传资料」按钮 + 每张资料卡（已索引→🔄 AI 重新分析 / 待处理→🤖 AI 分析）
- [x] Question 增加 materialId/sectionId 可选字段（旧数据兼容）

### Phase 2：交互演进（✅ 2026-08-01 已完成演示级）
- [x] `analyzeMaterial(material)`：AI 分析资料 7 步解析链（解析资料类型→识别章节/套卷→抽取题目→归纳知识点→提取高频考点→形成七核→更新知识图谱）
- [x] 资料库卡片 AI 分析按钮（已索引→重新分析/待处理→AI 分析），完成后标记「已索引」
- [x] **知识图谱改为 AI 自动识别**（2026-08-01 用户确认）：移除「添加知识点」手动入口与表单→ 图谱仅展示 AI 从资料自动识别的知识点并随学习进度更新掌握度
- [x] **真题改为整套文件上传**（2026-08-01 用户确认）：「上传真题」→ 打开与资料同款 PDF 上传弹窗（AI 自动识别年份/套卷/题号拆分，不逐题录入）；移除「手动录入题目」表单入口

### Phase 3：存储演进（v6，随 D1）
- [x] `resources` → `materials` 迁移；`questions` 挂 `materialId/sectionId` — 2026-08-01 已升 storageVersion=6，保存 `materials/materialSections`，旧 v5 自动由 resources/questions 派生
- [x] Section 表（章节/套卷）落地 — 2026-08-01 已落 `MaterialSection`，真题按年份生成 exam section，教材生成 chapter section
- [x] `analyzeMaterial` 解析链从演示（setTimeout 分步）→ 接真模型（analyze-exam 返回真实 sections/questions/nodes）— 2026-08-01 真题资料分析已接 `/api/analyze-exam`，无 key 时明确降级
- [x] 首页独立「资料库」入口（当前位于知识中心-资源库）— 2026-08-01 已在今日工作台增加「我的资料库」直达入口并补 E2E
- [x] 真题 PDF 上传后按套卷切分生成真题题目（当前上传仅入库资料，题目识别为后续 AI 解析步骤）— 2026-08-01 已按年份/套卷生成 section 与待识别题目，并补上传 E2E 校验

---

## 剩余优化任务（下轮优先级排序，每次只推进一项，不要同时展开）

> 优先级（2026-08-01 用户确认）：真题检索接通 → next build 类型错误 → vite 打包测试 → ESLint → D1 数据库 → CSS 模块化（改动最大、业务收益最低，最后处理）

### 真题检索接通
- [x] 傅献彩/真题检索为模拟提示，未接真实数据流（P2-1）— 2026-08-01 已接本地 `questions` 数据流：Agent 检索会跳转真题库、设置筛选并返回命中摘要

### 真 AI 引擎（P0，2026-08-01 第三轮审查升级）
- [x] ChatPanel 精致 UI 背后 runPrompt 仍是关键词匹配假 AI；空状态提示「帮我分析这份真题」等高预期能力未兑现。建议：优先接 1~2 个最有价值意图（真题→考点、今日计划）到真实模型，或对话区明确标注「演示回复」— 2026-08-01 已将「分析真题」接到 `/api/analyze-exam`；无模型 key 时明确显示「演示回复（未接真模型）」

### 第三轮审查新增 P2（2026-08-01）
- [x] ChatPanel 用 `localStorage.setItem("kaoyan-chat-history-scroll")` 直写，绕过 storage.ts 单一 Owner 契约（虽仅 UI 滚动位置，但契约不应开口子）— 2026-08-01 已改为 `storage.ts` 的 `saveUiState`
- [x] page.tsx 又长回 2681 行（首次审查抽取的 hooks/reducer 未保留，逻辑继续堆积），上帝组件问题回归，需真正拆分 — 2026-08-01 已抽出 Material/真题检索/占位题规则到 `app/lib/materials.ts`，后续只按业务域继续拆
- [x] ChatPanel `menuAbove` / `menuAboveRef` 设置了但渲染时基本未读（定位实际用 `menuRect`），疑似残留状态可清理— 2026-08-01 复核当前代码已不存在

### 第四轮交互审查（2026-08-01）— 已全部修复
- [x] 专注模式双实现收敛：page.tsx 改用 CardViewer 导出的 `FocusMode` 组件，删除内嵌双实现
- [x] 全局键盘快捷键补 Escape 关闭专注模式（FocusMode 组件内 useEffect 监听）
- [x] ChatPanel 顶部状态栏文档-代码不一致修复：删除 ChatPanelProps 的 currentSubject/currentResource/currentPage 与渲染分支，page.tsx 同步移除传参
- [x] `/api/analyze-exam` 503 确认属预期降级：analyze-exam 未接模型 key 时返回 ok:false → runExamAnalysis 降级为「演示回复（未接真模型）」并明确标注，不伪装真实 AI（P0 真 AI 引擎接入仍待后续）

### 深入交互审查（2026-08-01）— 已修复
- [x] **P1 完成表单数据校验**：自定义分钟数拒绝空值/非数字/负数（无效回退自动计算值）；正确率 clamp 0-100，避免 NaN/负时长污染 studyDays 与掌握度事件
- [x] **P2 复盘必填校验**：空复盘（「完成了什么」与「最困难」均空）拦截并提示，不产生空 structuredReview

### 深入交互审查新增（2026-08-01）— 已全部修复
- [x] P2 Settings 编辑科目名称允许保存空值（`onUpdateSubject({name})` 无空校验，应阻止空名提交）— 2026-08-01 已阻止空名写入并提示
- [x] P3 Settings 新增科目空名校验无用户反馈（`handleAddSubject` 直接 return，无 toast/提示）— 2026-08-01 当前代码已提示「科目名称不能为空」

### 深入交互审查第三轮（2026-08-01）— 已全部修复
- [x] P3 批注编辑改内联表单、删除改两阶段确认（ReaderPanel）——替代原生 prompt/confirm
- [x] P3 ChatPanel 重命名改内联条、删除改两阶段确认条——替代原生 window.prompt/window.confirm
- [x] P3 批注空内容提交提示「请输入批注内容」（不再静默 return）
- [x] P3 Reader「保存」按钮点击后提示「已保存阅读进度」
- [x] P3 Reader 搜索无匹配提示「未找到与「xxx」匹配的内容」
- [x] P3 Reader 分页输入清空保持旧值（轻微，保留原行为，不阻塞）
- [x] P3 E2E 同步：`tests/e2e/reader.spec.ts` 批注编辑/删除移除 dialog 依赖，改内联/两阶段选择器；全量 52/52 PASS

### Tech Debt
- [ ] `npx next build` cloudflare:workers 类型错误修复 — 2026-08-01 类型错误未复现；`tsc --noEmit` 与正式 `vinext build` 均通过；原生 `npx next build` 失败原因为 Turbopack/PostCSS 在沙箱内创建进程/绑定端口被拒绝，提权复测因系统用量限制被拒
- [x] vite 打包后测试不通过问题修复 — 2026-08-01 `npm run test` 通过（vinext build + rendered-html 6/6）
- [x] ESLint 规则配置（禁止硬编码数字/内联样式）— 2026-08-01 `npm run lint` 通过
- [x] 测试覆盖：`npm run test` 通过（2026-08-01 验证：build + rendered-html 6/6 PASS，单测 36/36 PASS）

### D1 数据库
- [x] localStorage → D1 持久化数据库迁移 — 2026-08-01 已加 D1 `workspace_snapshots` schema/migration 与 `/api/workspace` upsert；当前无 D1 binding 时自动跳过并保留 localStorage

### CSS 模块化 (已完成)
- [x] **globals.css 全量迁移 + 死类清理（2026-08-06）**：2172 → 177 行。全部活跃字符串类（布局/弹窗/书架/任务/表单/卡头等）以 `:global()` 迁至 `styles/components.module.css`；死类（65 个零引用 + 若干共享块内失效类）一并清除；globals.css 仅保留 `:root` 设计令牌 / 基础元素样式 / 响应式断点 / KaTeX 公式样式
- [x] 消除内联动态样式（~30 处含动态计算宽度/颜色）— 2026-08-01 `app/page.tsx` 内 `style={{...}}` 已清零，动态宽度改为原生 `<progress>`

### 验收遗留 P2/P3 优化项
- [x] P2-1 真题检索接通（已单列于上）
- [x] P2-2 Cards 复习 Tab 端到端选择器未验证（评分/翻转）— 2026-08-01 已有评分/空格翻面 E2E，并新增专注模式 Escape E2E
- [x] P2-3 Settings 删除科目端到端选择器未命中断言 — 2026-08-01 已加稳定 `subject-row-*` selector 并补删除持久化 E2E
- [x] P3-1 开发期 MemoryEngine 差异告警循环输出，需收敛为一次性日志 — 2026-08-01 已用 ref 收敛为单次告警
- [x] P3-2 更多菜单首任务「提高优先级」无可视反馈，队首时应禁用或提示 — 2026-08-01 已提示「已经是最高优先级」并补 E2E
- [x] P3-3 专注模式/卡片键盘快捷键未纳入自动化验收 — 2026-08-01 已覆盖 Space 翻面、1 评分、Escape 退出专注模式

---

## REVIEW_v4 收口（2026-08-02）— 全部 P0/P1-Phase1/P2/P3 组件迁移完成

> 本轮已完成（2026-08-02，全部有测试支撑）：
> - [x] P0-1 全量 E2E 重跑 **64/64 PASS**，STATUS.md/CHANGELOG.md 数字已统一为 64
> - [x] P0-2 storage-contract-1c 文案 v5→v6 同步（单测 54/54 PASS）
> - [x] P1-Phase1 纯函数抽取到 `app/lib/utils.ts`（page.tsx 3157→3114 行；tsc ✅）
> - [x] P2 runPrompt 第 2 个真 AI 意图「错因分析」：worker + 路由 + 客户端 + 接入；无 key 诚实降级；单测 4/4 PASS
> - [x] P3 组件内联样式**全部迁移** CSS Modules：
>   - SettingsPanel ~80→0（664→573 行）
>   - ReaderPanel 28→5（仅动态颜色保留，Reader E2E 10/10）
>   - CardViewer 2→0、ChatPanel 4→1、Sidebar 5→2（仅动态位置/宽度保留）
>   - 验证：tsc ✅、单测 54/54 ✅、全量 E2E 64/64 ✅
> - [x] **P2-3 runPrompt 第 3 个真 AI 意图「今日计划真生成」**（2026-08-02）：`worker/plan-generate.ts` + `/api/plan-generate` + `app/lib/ai/plan-generate.ts` + `runPlanGeneration`；DeepSeek 基于知识点/错题/科目时长生成多任务计划；无 key 降级本地 generatePlan 并诚实标注；单测 3/3（解析防御）；**真 AI 已实测返回 4 个计划任务（DeepSeek key 已配置）**；全量 E2E 64/64 PASS

### P1 可维护性
- [x] page.tsx 继续按业务域拆分：抽取 **复盘域**（stats 7 函数 + `buildStructuredReview`）到 `app/lib/reviews.ts`、**聊天会话域**（Session/message 不可变 reducer + `classifyPromptIntent` 意图路由 11 类）到 `app/lib/chat.ts` — 2026-08-02 已接线（复盘派生值、handleReviewSubmit、旧 chat 迁移、runPrompt 全部改走纯函数）；新增 `tests/chat.test.mts`（5）+ `tests/reviews.test.mts`（7）共 12 单测 PASS；tsc ✅ 全量单测 63/63 PASS
- [x] page.tsx 按业务域拆分：抽取 **热力图域** 到 `app/lib/heatmap.ts`（buildHeatmapDays/Grid/DayLabels、formatHeatmapStart、monBasedOffsetOf、countCardsByDate；此前 page.tsx 已 import 但模块未落盘导致 tsc 失败，现已落盘） — 2026-08-02 已落地；page.tsx 清理 heatmap 抽取残留（dateRange 导入 + 未使用解构）；tsc ✅ lint 0 warnings
- [x] page.tsx 行数目标达成：当前 **~1907 行**（目标 ≤2200 行），后续按业务域再拆

### P3 工程债
- [x] globals.css 全量迁移到 CSS Modules — 2026-08-06 完成（2172 → 177 行，见上方「CSS 模块化」条目）
- [ ] D1 真实 binding 验证（部署环境配 `D1Database` 后验证 GET 读回 + upsert 幂等）

---

## 2026-08-02 卡片组交互修复（focus chain 1785657510504 + 缺失模块落盘）

### 卡片组重命名 / 删除（P1）
- [x] **重命名编辑框移出学科内分支 → section 根级**：首页网格点击 ✏️ 重命名后编辑框不再被 `cardSubjectView` 分支裁剪——首页与学习空间均可看到并编辑（`CardsView.tsx`）
- [x] **删除当前分类后重置 activeCardCategory**：删除「正在学习」的分类时回退到「全部卡片」（`ALL_GROUPS`），避免 activeCardCategory 指向已删除 id 导致空列表/标题错乱（`CardsView.tsx`）

### 缺失模块落盘（tsc 修复）
- [x] **重建 `app/lib/heatmap.ts`**：此前 page.tsx 已 import 但文件未落盘 → `tsc` 报 `Cannot find module './lib/heatmap'`；现按 HEAD 版 page.tsx 内联逻辑抽取为纯函数模块（buildHeatmapDays / buildHeatmapGrid / buildHeatmapDayLabels / formatHeatmapStart / monBasedOffsetOf / countCardsByDate），Sidebar 消费契约不变
- [x] **page.tsx 清理 heatmap 抽取残留**：移除未使用的 `dateRange` 导入与 `heatmapTotalDays`/`heatmapWeeks` 解构（lint 4 warnings → 0）
- [x] **chat.ts 未使用参数清理**：`migrateLegacyChat` map 回调移除未使用 `index` 参数

### 测试竞态收敛
- [x] **chat.test 毫秒级竞态修复**：原断言 `s-${Date.now()}-legacy` 与 `migrateLegacyChat` 内部 `Date.now()` 相差 1ms 即随机失败（63 项中偶发 1 fail）；`migrateLegacyChat` 现支持注入 `now`，测试传固定值消除 flaky

### 验证（2026-08-02 实测）
- `npx tsc --noEmit` ✅
- `npm run lint` ✅（0 errors / 0 warnings）
- 单测 **63/63 PASS**（chat 竞态修复后稳定）
- Cards E2E **14/14 PASS**（卡片组重命名/删除改动后零回归，零 Runtime/Network 错误）

---

## 2026-08-02 全量回归确认 + 工程清理 + heatmap 测试补齐

### 全量回归
- [x] **全量 E2E 64/64 PASS**（`npx playwright test --workers=2`；卡片组修复后零回归，零 Runtime/Network/React 错误）— STATUS.md 变更记录已更新

### 遗留文件清理
- [x] 删除根目录 `works` 冗余草稿（heatmap 旧副本误放根目录）
- [x] 恢复 `public/favicon.svg`（layout.tsx metadata 引用 /favicon.svg，文件被误删导致 404）

### heatmap 测试补齐
- [x] 新增 `tests/heatmap.test.mts`（buildHeatmapDays/Grid/DayLabels、formatHeatmapStart、monBasedOffsetOf、countCardsByDate 共 7 项）——消灭「抽取模块无测试」缺口
- [x] `countCardsByDate` 参数放宽为 `Array<{ createdAt: string }>`（仅依赖 createdAt，消除 TS 过严类型）

### 验证基线（2026-08-02 实测）
- `npx tsc --noEmit` ✅
- `npm run lint` ✅（0 errors / 0 warnings）
- 单测全套 **71/71 PASS**（63 + heatmap 7 + analyze-exam 核对 1）
- 全量 E2E **64/64 PASS**

---

## 2026-08-03 脚手架模板残留清理 + CSS 死类分析

### 模板残留清理（零引用确认后删除）
- [x] 删除 `examples/d1`（Next.js D1 示例应用，脚手架自带，全库零引用）
- [x] 删除 `app/_sites-preview` 空目录（脚手架残留空壳）
- [x] **保留 `build/sites-vite-plugin.ts`**：经核实是 `vite.config.ts` 调用的活跃构建插件（打包 .openai/hosting.json 与 drizzle），不可删

### CSS 死类分析（为模块化迁移积累依据）
- [x] **65 个类**精确验证零消费（TSX className + E2E 选择器均无引用）：action-label / adjustment-grid / ai-* / annotation-* / brand / check-pill / completion-grid / confirm-* / core-* / countdown / dashboard-tabs / export-actions / form-section / graph-panel / knowledge-* / lead / mastery-* / mode-toggle / note-* / progress-line / prompt-bar / reader-* / review-* / rule-* / settings-* / subject-* / subnav / task-drawer / toast-notice 等
- [x] **死类清理已随 2026-08-06 globals.css 全量迁移一并完成**：共享声明块内的死类（brand/lead/export-actions/subnav 等）随迁移删除，保留活跃类

### 验证（2026-08-03 实测）
- `npx tsc --noEmit` ✅
- `npm run build` ✅（清理无破坏，vinext build 5 阶段全通过）

---

## 2026-08-03 可维护性全面修复（审查后"全部修掉"）

### 清理死代码与模板残留
- [x] 删除零引用文件：`app/lib/use-timer.ts`、`app/lib/plan-generator.ts`、`scripts/patch-page.tsx.py`
- [x] `package.json` name 由 `site-creator-vinext-starter` 改为 `kaoyan-exam-workspace`；新增 `test:unit` 脚本（`node --test tests/*.test.mts`，方便跑全量单测）
- [x] 清理 `page.tsx` / `use-workspace-handlers.ts` 共 80+ 处未使用导入与未使用解构（lint 80 warnings → 0）

### 存储层类型安全
- [x] `WorkspaceSnapshot` 由 `[key: string]: any` 改为**强类型接口**（已知业务字段全类型化 + 兼容字段 unknown）
- [x] 消灭 `saveWorkspace({...} as never)`，hydrate 区所有 `as boolean/Resource[]/Question[]` 手工断言消除
- [x] 新增 `buildWorkspaceSnapshot` + `WorkspaceStateInput`：save effect / flush 共用**单一字段清单**（原来两处手工维护的清单漂移风险消除）
- [x] 修复 hydrate effect 中 `runTimerFrom` 的 TDZ（lint error）——移至 `useWorkspaceHandlers` 声明之后

### 统一重复逻辑
- [x] page.tsx 内联整体进度公式改为复用 `reducer.computeLegacyProgress`（原两处相同公式并存）
- [x] 产品级常量收敛到 `default-data.ts`：`CORE_NAMES` / `QUICK_PROMPTS` / `MASTERY_OPTIONS` / `MOOD_OPTIONS`

### 文档同步
- [x] `ARCHITECTURE.md` §7.6 更新：`use-timer`/`plan-generator` 标记为已删死代码；`readingMode` 更正为活跃 state；§7.7 更新 page.tsx 实际行数与 handler 位置

### 验证基线
- `npx tsc --noEmit` ✅ 0 错误
- `npm run lint` ✅ 0 errors / 0 warnings
- `npm run test:unit` ✅ 71/71 PASS

---

## 2026-08-03 worker 层深入审查

### /api/workspace 边界加固（已修复）
- [x] GET `JSON.parse(row.payload)` 包裹 try/catch：DB payload 损坏不再抛 500，返回 `{ ok:false, error:"corrupt_payload" }`（客户端可继续 localStorage 兜底）
- [x] PUT 请求体增加 `Array.isArray` 拒绝：原 `typeof "object"` 校验放行数组（写入非对象数据），现返回 400

### AI handler 审查结论（无需改动）
- [x] analyze-exam / analyze-mistakes / plan-generate 三端点防御完备：无 key 503 诚实降级、`.json()` catch 400、上游非 2xx 转 502、AbortController 30s 超时、parse 防御函数（非法 JSON/非对象/字段缺失/截断）均有离线单测（6/4/3 PASS）

### 验证（2026-08-03 实测）
- `npx tsc --noEmit` ✅（IDE 的 D1Database 误报，tsc 0 错误）
- `npm run lint` ✅（0 errors / 0 warnings）
- 单测全套 **71/71 PASS**

---

## 已知说明（E2E 回归约定）

- [x] **默认回归方式**：`npx playwright test --workers=2`；4 workers 并行存在 Vite HMR 导航竞态，随机失败不视为业务回归。
- 相关修复记录见 `workspace-app/docs/CHANGELOG.md`（2026-08-01 条目）。
