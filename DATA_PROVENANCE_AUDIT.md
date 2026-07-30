# 数字来源审计报告 (Data Provenance Audit)

**审计日期**: 2026-07-30
**审计范围**: workspace-app/app/ (page.tsx, layout.tsx, lib/types.ts, lib/default-data.ts)
**审计目标**: 追踪页面上所有数字、日期、百分比、数量和状态的真实来源

---

## 一、数字来源总表

### 1.1 侧栏 (Sidebar)

| 页面显示 | 当前值示例 | 来源文件 | 来源变量/函数 | 数据类型 | 是否硬编码 | 是否可被用户覆盖 | 是否动态计算 | 是否会同步更新 |
|---------|-----------|---------|-------------|---------|-----------|---------------|------------|--------------|
| 剩余天数 | 143 | page.tsx:165 | `daysLeft = Math.max(0, Math.ceil((new Date(exam.examDate).getTime() - Date.now()) / 86400000))` | computed | 否 | 是（通过设置考试日期） | 是 | 是 |
| 院校名称 | 哈尔滨工业大学重庆研究院 | page.tsx:851 | `exam.school` (seedExam.school) | string | 否（默认值） | 是 | 否 | 是 |
| 目标专业 | 828 物理化学 | page.tsx:852 | `exam.major` (seedExam.major) | string | 否（默认值） | 是 | 否 | 是 |
| 目标总分 | 315 | page.tsx:858 | `totalTargetScore = subjects.reduce((sum, subject) => sum + Number(subject.targetScore \|\| 0), 0)` | computed | 否 | 是 | 是 | 是 |
| 整体进度% | 57% | page.tsx:859 | `overallProgress` (复杂公式：nodes.masteryScore + questions + resources) | computed | 否 | 否 | 是 | 是 |
| 当前轮次 | 第一轮 | page.tsx:861 | `currentSubject?.round ?? "第一轮"` | string | 否（但有硬编码fallback "第一轮"） | 是 | 是 | 是 |
| 当前 Layer | Layer 2 | page.tsx:861 | `currentSubject?.layer ?? "Layer 1"` | string | 否（但有硬编码fallback "Layer 1"） | 是 | 是 | 是 |
| 当前核心 | 热力学第二定律 | page.tsx:994 | `currentSubject?.currentProgress ?? "热力学第二定律"` | string | **YES (fallback "热力学第二定律" 硬编码)** | 是 | 是 | 是 |
| 当前轮次·Layer | 第一轮·Layer 2 | page.tsx:995 | `currentSubject?.round ?? "第一轮"` / `currentSubject?.layer ?? "Layer 2"` | string | **YES (fallback "第一轮" 和 "Layer 2" 硬编码)** | 是 | 是 | 是 |
| 热力图开始日期 | 2026/07/01 | page.tsx:870 | `heatmapStartFormatted` (exam.examGoalCreatedAt) | string | 否 | 是（间接） | 是 | 是 |
| 热力图每一天的强度 | level 0-4 | page.tsx:908 | `day.completed` >= 1/2/3/4 (来自 studyDays) | computed | 否 | 否 | 是 | 是 |

### 1.2 今日任务面板

| 页面显示 | 当前值示例 | 来源文件 | 来源变量/函数 | 数据类型 | 是否硬编码 | 是否可被用户覆盖 | 是否动态计算 | 是否会同步更新 |
|---------|-----------|---------|-------------|---------|-----------|---------------|------------|--------------|
| 已完成任务数 | 3 | page.tsx:159 | `completed = tasks.filter(task => task.done).length` | computed | 否 | 是 | 是 | 是 |
| 总学习时长 | 125 分钟 | page.tsx:162 | `completedMinutes = tasks.reduce(...)` | computed | 否 | 是 | 是 | 是 |
| 任务预计时长 | 70 分钟 | page.tsx:1118 | `task.minutes` (seedTasks[0].minutes = 70) | number | **默认值（seed数据）** | 是 | 是 | 是 |
| 任务预计时长 | 55 分钟 | page.tsx:1118 | `task.minutes` (seedTasks[1].minutes = 55) | number | **默认值（seed数据）** | 是 | 是 | 是 |
| 任务总数 | 2 | page.tsx:189 | `tasks.length` | computed | 否 | 是 | 是 | 是 |

### 1.3 AI 学习助手

| 页面显示 | 当前值示例 | 来源文件 | 来源变量/函数 | 数据类型 | 是否硬编码 | 是否可被用户覆盖 | 是否动态计算 | 是否会同步更新 |
|---------|-----------|---------|-------------|---------|-----------|---------------|------------|--------------|
| Agent 步骤数 | 5 | page.tsx:566 | `agentSteps.length` | computed | **YES (runAgentWorkflow 固定生成5步)** | 否 | 否 | 否 |
| 相关真题数量 | 2 | page.tsx:591 | `questions.filter(...).length` | computed | 否 | 否 | 是 | 是 |
| 成长卡片数量 | Math.min(dueCards.length, 10) | page.tsx:615 | `Math.min(dueCards.length, 10)` | computed | **10 作为最大值的硬编码** | 否 | 是 | 否 |

### 1.4 知识中心

| 页面显示 | 当前值示例 | 来源文件 | 来源变量/函数 | 数据类型 | 是否硬编码 | 是否可被用户覆盖 | 是否动态计算 | 是否会同步更新 |
|---------|-----------|---------|-------------|---------|-----------|---------------|------------|--------------|
| 学习资源数 | 1 | page.tsx:1275 | `subjectResources.length` | computed | 否 | 是 | 是 | 是 |
| 真题数量 | 1 | page.tsx:1276 | `subjectQuestions.length` | computed | 否 | 是 | 是 | 是 |
| 知识节点数 | 1 | page.tsx:1277 | `subjectNodes.length` | computed | 否 | 是 | 是 | 是 |
| 掌握分数 | 42 | page.tsx:1470 | `node.masteryScore` (seedNodes[0].masteryScore=42) | number | **默认值（seed数据）** | 是 | 是 | 是 |
| 掌握等级 | 2 级 | page.tsx:1470 | `node.masteryLevel` (seedNodes[0].masteryLevel=2) | number | **默认值（seed数据）** | 是 | 是 | 是 |

### 1.5 成长卡片

| 页面显示 | 当前值示例 | 来源文件 | 来源变量/函数 | 数据类型 | 是否硬编码 | 是否可被用户覆盖 | 是否动态计算 | 是否会同步更新 |
|---------|-----------|---------|-------------|---------|-----------|---------------|------------|--------------|
| 全部卡片数 | 1 | page.tsx:1514 | `subjectCards.length` | computed | 否 | 是 | 是 | 是 |
| 今日复习数 | 1 | page.tsx:1515 | `dueCards.length` | computed | 否 | 是 | 是 | 是 |
| 收藏卡片数 | 0 | page.tsx:1516 | `subjectCards.filter(card => card.favorite).length` | computed | 否 | 是 | 是 | 是 |
| 复习间隔天数 | 1/3/7/14/30 | page.tsx:789 | `const intervalDays = mastery === "不会" ? 1 : mastery === "模糊" ? 3 : ...` | number | **YES (硬编码 1,3,7,14,30)** | 否 | 是 | 否 |

### 1.6 今日复盘

| 页面显示 | 当前值示例 | 来源文件 | 来源变量/函数 | 数据类型 | 是否硬编码 | 是否可被用户覆盖 | 是否动态计算 | 是否会同步更新 |
|---------|-----------|---------|-------------|---------|-----------|---------------|------------|--------------|
| 今日学习时长 | 0 分钟 | page.tsx:1631 | `reviewMinutes` | computed | 否 | 是 | 是 | 是 |
| 完成任务 | 0/2 | page.tsx:1632 | `reviewCompletedTasks/reviewTasks.length` | computed | 否 | 是 | 是 | 是 |
| 新增/重点知识点 | 1 | page.tsx:1633 | `reviewNewNodes` | computed | 否 | 是 | 是 | 是 |
| 真题完成情况 | 1/2 | page.tsx:1634 | `reviewDoneQuestions/reviewQuestions.length` | computed | 否 | 是 | 是 | 是 |
| 成长卡片复习 | 0/1 | page.tsx:1635 | `reviewReviewedCards/reviewCards.length` | computed | 否 | 是 | 是 | 是 |
| 掌握度变化 | 0% | page.tsx:1636 | `reviewMasteryDelta` | computed | 否 | 是 | 是 | 是 |

### 1.7 科目管理

| 页面显示 | 当前值示例 | 来源文件 | 来源变量/函数 | 数据类型 | 是否硬编码 | 是否可被用户覆盖 | 是否动态计算 | 是否会同步更新 |
|---------|-----------|---------|-------------|---------|-----------|---------------|------------|--------------|
| 科目目标分数 | 125 | page.tsx:1236 | `subject.targetScore` (seedSubjects[0].targetScore="125") | string | **默认值（seed数据）** | 是 | 否 | 是 |
| 每周小时 | 16 小时/周 | page.tsx:1237 | `subject.weeklyHours` (seedSubjects[0].weeklyHours="16") | string | **默认值（seed数据）** | 是 | 否 | 是 |
| 风险状态 | 高风险 | page.tsx:1236 | `subject.risk` (seedSubjects[0].risk="高风险") | string | **默认值（seed数据）** | 是 | 否 | 是 |

### 1.8 设置页

| 页面显示 | 当前值示例 | 来源文件 | 来源变量/函数 | 数据类型 | 是否硬编码 | 是否可被用户覆盖 | 是否动态计算 | 是否会同步更新 |
|---------|-----------|---------|-------------|---------|-----------|---------------|------------|--------------|
| 考试日期 | 2026-12-20 | page.tsx:1161 | `exam.examDate` (seedExam.examDate="2026-12-20") | string | **默认值（seed数据）** | 是 | 否 | 是 |
| 总分目标 | 315 (只读) | page.tsx:1162 | `totalTargetScore` (computed) | computed | 否 | 否 | 是 | 是 |

---

## 二、来源分类

### A. 用户设置 (可通过设置页修改)
| 数据项 | 存储位置 | 初始值来源 |
|-------|---------|-----------|
| examName | exam.examName | seedExam.examName |
| school | exam.school | seedExam.school |
| major | exam.major | seedExam.major |
| examDate | exam.examDate | seedExam.examDate ("2026-12-20") |
| weeklyDays | exam.weeklyDays | seedExam.weeklyDays |
| weekdayHours | exam.weekdayHours | seedExam.weekdayHours |
| weekendHours | exam.weekendHours | seedExam.weekendHours |
| baseline | exam.baseline | seedExam.baseline |
| subject.targetScore | subject.targetScore | seedSubjects[0-2].targetScore |
| subject.weeklyHours | subject.weeklyHours | seedSubjects[0-2].weeklyHours |
| appSettings.* | appSettings.* | seedAppSettings |

### B. 用户行为记录 (通过操作累积)
| 数据项 | 存储位置 | 初始值 |
|-------|---------|-------|
| studyDays (热力图) | studyDays state | seedStudyDays (4条固定记录) |
| tasks (任务列表) | tasks state | seedTasks (2条固定任务) |
| cards (成长卡片) | cards state | seedCards (1张固定卡片) |
| questions (真题) | questions state | seedQuestions (2条固定真题) |
| nodes (知识点) | nodes state | seedNodes (2个固定节点) |
| completed (已完成任务数) | computed from tasks | 动态 |
| completedMinutes (总分钟) | computed from tasks | 动态 |

### C. 动态计算
| 数据项 | 公式 | 依赖 |
|-------|-----|------|
| daysLeft | Math.max(0, Math.ceil((exam.examDate - now) / 86400000)) | exam.examDate |
| totalTargetScore | subjects.reduce(sum + targetScore) | subjects[].targetScore |
| overallProgress | nodes.masteryScore * 0.55 + confirmedQuestions * 0.25 + indexedResources * 0.2 | nodes, questions, resources |
| completed | tasks.filter(done).length | tasks[].done |
| completedMinutes | tasks.reduce(actualMinutes \|\| minutes) | tasks |
| heatmap levels | day.completed >= 1/2/3/4 | studyDays |
| review statistics | various filters | tasks, questions, nodes, cards |

### D. 默认演示数据 (seed 数据)
| 数据文件 | 数据项 | 示例值 |
|---------|-------|-------|
| default-data.ts:13 | seedExam.examDate | "2026-12-20" |
| default-data.ts:25 | seedSubjects[0].targetScore | "125" |
| default-data.ts:37 | seedSubjects[0].layer | "Layer 2" |
| default-data.ts:216 | seedTasks[0].minutes | 70 |
| default-data.ts:239 | seedTasks[1].minutes | 55 |
| default-data.ts:177 | seedNodes[0].masteryScore | 42 |
| default-data.ts:181 | seedNodes[0].mistakes | 8 |
| default-data.ts:311-315 | seedStudyDays | 4条固定记录 |
| default-data.ts:263 | seedCards | 1张固定卡片 |

### E. 纯硬编码 (硬编码在 JSX 或函数中)
| 位置 | 硬编码值 | 说明 |
|-----|---------|------|
| page.tsx:994 | `"热力学第二定律"` | currentSubject?.currentProgress 的 fallback |
| page.tsx:861 | `"第一轮"` / `"Layer 1"` | round/layer 的 fallback |
| page.tsx:995 | `"第一轮"` / `"Layer 2"` | 冗余的 fallback（与861重复） |
| page.tsx:789 | `1, 3, 7, 14, 30` | 卡片复习间隔天数 |
| page.tsx:791 | `"明天"`, `"3 天后"`, `"7 天后"`, `"14 天后"`, `"30 天后"` | 间隔文字描述 |
| page.tsx:633 | `minutes: 60` | generatePlan 中硬编码的任务时长 |
| page.tsx:666 | `minutes: 45` | generatePlan 中硬编码的任务时长 |
| page.tsx:712 | `Math.min(task.minutes, 30)` | 备用任务最大30分钟 |
| page.tsx:560 | `masteryScore - 5` | confirmPending 中硬编码的掌握度扣减 |
| page.tsx:724 | `masteryScore - 8`, `masteryLevel - 1`, `mistakes + 1` | completeTask 中硬编码的扣减 |
| page.tsx:566 | 固定5步 | runAgentWorkflow 固定生成 ["分析真题","更新知识图谱","更新掌握度","重排本周计划","生成学习笔记"] |
| page.tsx:615 | `Math.min(dueCards.length, 10)` | 安排卡片复习最多10张 |

---

## 三、关键风险分析

### ⚠️ 高风险（需立即修复）

1. **`||` 与 `??` 混用可能导致合法 0 被替换**
   - **page.tsx:163**: `Number(subject.targetScore || 0)` — 这里使用 `||`，如果 targetScore 是空字符串 ""，会被替换为 0。这是安全的因为空串和 0 在这里含义相同。
   - **page.tsx:162**: `Number(task.actualMinutes || (task.done ? task.minutes : 0))` — 使用 `||`，如果 actualMinutes 是 "0"（合法输入），会被替换为 task.minutes。这是 **BUG**：用户输入 0 分钟后会被忽略。
   - **page.tsx:723**: `Number(task.accuracy || 0)` — 如果 accuracy 是 "0"（合法输入），会被替换为 0。这是安全的。
   - **修复建议**: 使用 `??` 代替 `||` 或显式检查空字符串。

2. **热力图今天的数据源矛盾**
   - **page.tsx:207**: `if (date === dateOnly()) return { date, completed, minutes: completedMinutes };` — 对于今天的日期，总是返回动态计算的 completed 和 completedMinutes，**忽略 studyDays 中可能已存在的今天记录**。
   - **page.tsx:285**: `recordStudyDay` 同时向 studyDays 写入今天的数据
   - **后果**: 如果用户已保存 studyDays 中的今天数据（含自定义分钟数），热力图显示的却是独立计算的 completedMinutes，导致不一致。

3. **generatePlan 中的任务时长是硬编码**
   - **page.tsx:633**: `minutes: 60`
   - **page.tsx:666**: `minutes: 45`
   - 这些值不会根据用户设置（weekdayHours, weekendHours）或科目配置动态计算。

4. **掌握度扣减规则硬编码**
   - **page.tsx:560**: `-5` (confirmPending 图谱更新)
   - **page.tsx:724**: `-8`, `-1`, `+1` (completeTask 正确率<60%)
   - 这些值散落在函数中，不可配置。

### ⚠️ 中风险（建议修复）

5. **多处硬编码 fallback 字符串**
   - `"热力学第二定律"`, `"第一轮"`, `"Layer 1"`, `"Layer 2"` — 这些应该在默认数据中定义，而不是在 JSX 中硬编码。
   - 同一定义在 page.tsx:861 和 page.tsx:995 重复出现。

6. **seedStudyDays 固定值可能造成误导**
   - 初始 4 条记录 (completed: 1/2/1/2, minutes: 45/120/60/95) 显示为历史学习记录
   - 用户看到热力图有数据，但其实都是默认演示数据

7. **seedTasks 默认值 (70, 55 分钟) 可能不符合用户实际**
   - 首次加载时显示的两个任务时长是固定的，与用户设置的每周可用时间无关

8. **exam.examDate 默认值 "2026-12-20" 硬编码在 seedExam 中**
   - 这没问题，用户修改后会保存到 localStorage 覆盖

### 🟢 低风险（可接受）

9. **color 级别划分 (>=4, >=3, >=2, >=1)** — 这是业务逻辑，属于设计决策

10. **dateRange max 900 天** — 合理上限

11. **studyDays 保留最近 140 条** (page.tsx:287) — 合理上限

---

## 四、输出结论

### 4.1 所有纯硬编码数字
| 值 | 位置 | 用途 |
|---|------|------|
| "热力学第二定律" | page.tsx:994 | fallback |
| "第一轮", "Layer 1" | page.tsx:861 | fallback |
| "第一轮", "Layer 2" | page.tsx:995 | fallback |
| 1, 3, 7, 14, 30 | page.tsx:789 | 卡片复习间隔 |
| 60 | page.tsx:633 | generatePlan 任务时长 |
| 45 | page.tsx:666 | generatePlan 任务时长 |
| 30 | page.tsx:712 | 备用任务最大分钟 |
| -5 | page.tsx:560 | 掌握度扣减 |
| -8, -1, +1 | page.tsx:724 | 掌握度/错误数调整 |
| 10 | page.tsx:615 | 最大复习卡片数 |
| 5 | page.tsx:566 | Agent 固定步骤数 |

### 4.2 所有默认演示数字（seed 数据）
| 值 | 来源 | 说明 |
|---|------|------|
| "2026-12-20" | seedExam.examDate | 考试日期 |
| "125", "120", "70" | seedSubjects[].targetScore | 各科目标分 → 总和315 |
| 70, 55 | seedTasks[].minutes | 任务时长 |
| 42, 48 | seedNodes[].masteryScore | 掌握分数 |
| 8, 2 | seedNodes[].mistakes | 错误次数 |
| 1,2,1,2 completed | seedStudyDays[].completed | 热力图数据 |
| 45,120,60,95 minutes | seedStudyDays[].minutes | 热力图数据 |
| 1 张卡片 | seedCards | 默认卡片 |

### 4.3 所有真实动态数字
| 值 | 计算方式 |
|---|---------|
| daysLeft | `Math.ceil((exam.examDate - now) / 86400000)` |
| totalTargetScore | `subjects.reduce(sum + Number(targetScore), 0)` |
| overallProgress | 加权公式 (nodes 55% + questions 25% + resources 20%) |
| completed | `tasks.filter(done).length` |
| completedMinutes | `tasks.reduce(actualMinutes || minutes)` |
| heatmap levels | `day.completed >= 1/2/3/4` |
| 各统计看板数字 | 各种 filter/reduce 计算 |

### 4.4 所有来源不明确的数字
| 值 | 问题 |
|---|------|
| `totalTargetScore` | 显示在设置页为只读（page.tsx:1162），但用户无法直接修改总分，只能通过修改各科目标分间接修改 |
| `reviewMasteryDelta` | 仅取平均掌握度，不反映变化量（line 187） |

### 4.5 所有修改后不会同步的数字
| 数据 | 原因 |
|-----|------|
| 硬编码 fallback ("热力学第二定律" 等) | 用户设置了 subject.currentProgress，但 fallback 只在值为 null/undefined 时使用，不会覆盖用户数据 |
| 今天的热力图数据 | 总是使用独立计算的 completed/completedMinutes，忽略 studyDays 中今天的记录 |

### 4.6 所有重复定义的数据
| 数据 | 重复位置 |
|-----|---------|
| `"第一轮"` / `"Layer 1"` | page.tsx:861 和 page.tsx:995 |
| `"第一轮"` / `"Layer 2"` | page.tsx:861 和 page.tsx:995 |

### 4.7 所有需要改为计算函数的数据
| 数据 | 建议 |
|-----|------|
| generatePlan 中的 60/45 分钟 | 改为基于 weekdayHours/weekendHours 动态计算 |
| 掌握度扣减 -5/-8 | 抽取为可配置常量或公式 |
| 卡片复习间隔 1/3/7/14/30 | 抽取为可配置的间隔映射表 |

### 4.8 所有需要改为统一状态源的数据
| 数据 | 当前问题 | 建议 |
|-----|---------|------|
| 今天的热力图数据 | 两个来源（computed 和 studyDays） | 统一从 studyDays 读取，避免 page.tsx:207 覆盖 |
| totalTargetScore | 在设置页只读显示，只能通过科目管理修改 | 保持现状（逻辑正确但 UX 可改进） |

### 4.9 建议保留为默认值的数据
| 数据 | 理由 |
|-----|------|
| seedExam (除 examDate 外) | 科目名称/院校/专业等，用户修改后会被覆盖 |
| seedAppSettings | 所有设置项用户可修改 |
| color 级别 (>=4 等) | 属于设计逻辑 |

### 4.10 建议立即修复的高风险项

| 优先级 | 问题 | 修复方案 |
|--------|------|---------|
| **P0** | page.tsx:207 今天热力图覆盖 studyDays | `if (date === dateOnly()) return stored ?? { date, completed, minutes: completedMinutes }` — 优先使用 studyDays 已存记录 |
| **P0** | page.tsx:162 `task.actualMinutes || ...` 导致合法"0"被替换 | 改为 `task.actualMinutes !== "" ? Number(task.actualMinutes) : (task.done ? task.minutes : 0)` |
| **P1** | `"热力学第二定律"` 等 JSX 硬编码 fallback | 提取到 default-data.ts 作为 seedSubjectDefault |
| **P1** | 多处 round/layer fallback 重复定义 | 统一到一处常量和默认值 |
| **P2** | generatePlan 任务时长硬编码 60/45 | 从 exam.weekdayHours/weekendHours 按比例计算 |
| **P2** | 掌握度扣减 -5/-8 散落代码中 | 定义为常量 e.g. `const MASTERY_PENALTY_LOW = 5; const MASTERY_PENALTY_HIGH = 8;` |

---

## 五、来源链参考

```
设置页保存考试日期
→ exam.examDate
→ calculate daysLeft() Math.max(0, Math.ceil((new Date(exam.examDate).getTime() - Date.now()) / 86400000))
→ Sidebar 倒计时显示 {daysLeft}

科目管理设置 targetScore
→ subjects[].targetScore
→ reduce sum: totalTargetScore
→ Sidebar "目标 315"

seedStudyDays (4条默认记录) + recordStudyDay() 新增记录
→ studyDays state
→ heatmapDays map + today override (RISK: line 207)
→ level = day.completed >= N
→ 热力图颜色

generatePlan()
→ hardcoded 60/45 minutes (RISK: not based on user settings)
→ tasks[].minutes
→ JSX {task.minutes} 分钟
```

---

## 六、总体评分

- **真实动态数据占比**: ~60% (大部分统计值是动态计算的)
- **seed 默认数据占比**: ~30% (首次加载时占比较高，用户使用后会逐步被真实数据覆盖)
- **纯硬编码数字占比**: ~10% (主要是 fallback 字符串和算法常量)
- **来源不明确/风险项**: 8 项（其中 P0 2 项，P1 2 项）
- **推荐立即修复**: 2 项（热力图今天数据源、actualMinutes || 0 问题）

**审计完成，等待确认后开始修复。**