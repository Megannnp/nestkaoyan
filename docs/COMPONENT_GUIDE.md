# 组件职责指南 (Component Guide)

> 每个组件的职责边界。AI 在修改前必须确认修改范围是否在组件职责内。

---

## 1. Sidebar (侧栏)

**源位置**: `page.tsx` lines 836-1056

### 子区块职责

| 区块 | 当前行 | 只负责 |
|------|--------|--------|
| Logo + 倒计时 | 838-848 | 品牌展示、剩余天数 |
| 目标信息 + 进度 | 852-865 | 院校、专业、目标分、进度条 |
| 热力图 | 869-997 | 学习记录可视化 |
| 当前核心 | 1000-1004 | 当前学习科目和轮次 |
| 四宫格导航 | 1007-1040 | 导航按钮 |
| 设置入口 | 1043-1055 | 切换到设置页 |

### 禁止
- ❌ 修改 subjects / tasks / nodes 等数据
- ❌ 包含业务逻辑（生成任务、更新图谱等）
- ❌ 读取非展示所需的数据

---

## 2. Dashboard (今日工作台)

**源位置**: `page.tsx` lines 1144-1149 (tab), 1071-1129 (agent + tasks), 1678-1714 (review)

### 职责
- **今日任务面板**: 任务列表展示、排序、计时、完成
- **今日复盘面板**: 学习数据统计、复盘表单提交

### 禁止
- ❌ 修改 subjects 数据
- ❌ 修改 KnowledgeNode 数据（但可以触发 update）
- ❌ 直接操作 localStorage

---

## 3. Agent (AI学习助手)

**源位置**: `page.tsx` lines 1071-1097

### 职责
- 聊天交互（runPrompt）
- Agent 工作流执行（runAgentWorkflow）
- 快速提示按钮

### 禁止
- ❌ 绕过用户确认直接修改数据（必须走 dialog 或 notice）
- ❌ 硬编码学习建议（应由规则引擎或 AI 生成）

---

## 4. Knowledge Center (知识中心)

**源位置**: `page.tsx` lines 1315-1555

### 子面板
- **资源与阅读 (Resources)**: 资料 CRUD、阅读器、批注
- **真题库 (Questions)**: 真题 CRUD、筛选、做题记录
- **知识图谱 (Graph)**: 节点 CRUD、掌握度编辑、待确认队列

### 禁止
- ❌ 修改其他科目的数据
- ❌ 修改 tasks / studyDays 等非知识中心的数据

---

## 5. Cards (成长卡片)

**源位置**: `page.tsx` lines 1557-1676

### 职责
- 卡片 CRUD（背诵模式、填空模式等）
- 间隔复习管理（reviewCard）
- 来源关联（openCardSource）

### 禁止
- ❌ 修改 questions / nodes 数据（但可以触发相关真题筛选）

---

## 6. Settings (设置)

**源位置**: `page.tsx` lines 1151-1273

### 职责
- 考试目标编辑
- 科目管理
- AI 配置
- 数据导入导出

### 禁止
- ❌ 修改 tasks / studyDays 等学习数据

---

## 7. Dialogs (模态框)

### 职责
- 表单提交
- 数据创建/编辑
- 用户确认流程

### 通用规范
- 所有 Dialog 使用 `activeDialog` 控制显隐
- 使用 `modal-backdrop` 实现点击外部关闭
- 表单使用 `<form>` + `onSubmit` 处理
- 提交后调用 `setActiveDialog(null)` 关闭

---

## 8. 未来组件拆分计划

```
app/
├── components/
│   ├── Sidebar/
│   │   ├── Logo.tsx
│   │   ├── ExamCard.tsx
│   │   ├── Progress.tsx
│   │   ├── Heatmap.tsx
│   │   ├── CurrentCore.tsx
│   │   ├── QuickGrid.tsx
│   │   └── SettingsButton.tsx
│   ├── Dashboard/
│   │   ├── TaskPanel.tsx
│   │   ├── ReviewPanel.tsx
│   │   └── AgentPanel.tsx
│   ├── Knowledge/
│   │   ├── ResourcePanel.tsx
│   │   ├── QuestionPanel.tsx
│   │   ├── GraphPanel.tsx
│   │   └── Reader.tsx
│   ├── Cards/
│   │   ├── CardViewer.tsx
│   │   └── CardList.tsx
│   ├── Settings/
│   │   ├── ExamSettings.tsx
│   │   ├── SubjectManager.tsx
│   │   └── AIConfig.tsx
│   ├── Dialogs/
│   │   ├── DialogExam.tsx
│   │   ├── DialogSubject.tsx
│   │   ├── DialogResource.tsx
│   │   ├── DialogQuestion.tsx
│   │   ├── DialogNode.tsx
│   │   ├── DialogAnnotation.tsx
│   │   └── DialogCard.tsx
│   └── ui/
│       ├── Modal.tsx
│       ├── Breadcrumb.tsx
│       ├── MetricGrid.tsx
│       ├── FilterBar.tsx
│       └── Toast.tsx
└── hooks/
    ├── useLocalStorage.ts
    ├── useExam.ts
    ├── useSubjects.ts
    ├── useTasks.ts
    ├── useQuestions.ts
    ├── useNodes.ts
    ├── useCards.ts
    └── useHeatmap.ts