# Material-First 架构决策（2026-08-01）

> **产品方向决策**：系统以「资料（Material）」为一级入口，而非「题目（Question）」。
> 反向设计依据：学习者导入的是**一本教材 / 一套真题 / 一本习题集**，不是一道题。

---

## 1. 决策背景

当前系统以 Question 作为主要组织单元（AI 分析真题、录入题目、题目列表入口）。

用户明确方向：**学习者的真实行为是从资料开始的**。

```
❌ 现在：导入一道题 → 分析
✅ 目标：导入一份资料 → AI 分析资料 → 解析内置题目/章节 → 归纳知识点/七核 → 更新图谱 → 生成计划
```

这使 AI 分析对象始终是「一份资料」，而不是「一道题」，未来教材/真题/习题/讲义全走同一套流程。

---

## 2. 领域模型（Material-First 五层）

```
Material（资料）                 ← 一级入口
  └── Section（章节/套卷）        ← 教材章节 / 真题年份卷
       └── Question（题目）       ← 资料内题目（不再是孤立入口）
            └── KnowledgePoint（知识点）
                 └── CoreConcept（七核）  ← 最终汇聚到知识图谱
```

### 2.1 Material（新增/演进自 Resource）

```ts
export type MaterialType =
  | "textbook"      // 教材：如《高等数学》基础篇
  | "past_paper"    // 真题：政治/英语一/数学二 历年真题
  | "exercise_book" // 习题集：660 / 李林880 等
  | "handout"       // 讲义/笔记：自己整理的笔记
  | "lecture"       // 课程讲义

export type MaterialStatus =
  | "pending"      // 待分析（刚导入）
  | "analyzing"    // 分析中
  | "analyzed"     // 已分析
  | "partial"      // 部分分析

export type Material = {
  id: string;
  subjectId: string;
  name: string;
  type: MaterialType;
  status: MaterialStatus;
  // 文件/来源
  fileStorageKey?: string;   // IndexedDB PDF 二进制
  fileName?: string;
  source?: string;           // 原始路径
  // 分析结果（AI 分析资料后填充）
  analysis?: {
    sectionsCount: number;
    questionsCount: number;
    knowledgePointCount: number;
    coreConcepts: string[];  // 七核
    highFrequencyPoints: string[]; // 高频考点
    analyzedAt?: string;
  };
  // 阅读状态（复用原 Resource 字段）
  currentPage: string;
  lastOpenedPage?: string;
  createdAt?: string;
};
```

### 2.2 Section（新增：章节/套卷）

```ts
export type MaterialSection = {
  id: string;
  materialId: string;       // 所属资料
  sectionType: "chapter" | "exam" | "unit" | "topic";
  title: string;            // 章节名 / 2024年真题
  order: number;
  pageRange?: string;
  questionIds?: string[];   // 该章节下题目
  knowledgePointIds?: string[];
  analyzed?: boolean;
};
```

### 2.3 Question（演进：归属资料+章节）

```ts
export type Question = {
  id: string;
  // 新增归属（Material-First 核心）
  materialId: string;       // 所属资料（以前无）
  sectionId?: string;       // 所属章节/套卷
  // 原字段保留
  subject: string;
  school: string;
  year: string;
  number: string;
  type: string;
  score: string;
  stem: string;
  answer: string;
  originalAnalysis: string;
  aiAnalysis: string;
  difficulty: string;
  core: string;
  branch: string;
  knowledge: string;
  layer: string;
  done: boolean;
  result: "未做" | "正确" | "错误";
  errorReason: string;
  note: string;
  source: string;
  confirmed: boolean;
  favorite: boolean;
};
```

### 2.4 KnowledgePoint / CoreConcept（已有 KnowledgeNode，补充来源）

```ts
export type KnowledgeNode = {
  // 原字段保留
  id: string;
  subject: string;
  core: string;
  branch: string;
  knowledge: string;
  explanation: string;
  masteryLevel: number;
  masteryScore: number;
  // Material-First 补充
  sourceMaterialIds?: string[];  // 来自哪些资料（聚合）
  sourceQuestionIds?: string[];  // 来自哪些题目
};
```

---

## 3. AI 分析流程（目标）

按钮从「AI 分析真题」→「AI 分析资料」，输出完整解析链：

```
2024 考研政治真题
   ↓ [AI 分析资料]
正在分析……
   ✓ 共识别 1 套真题
   ✓ 共 426 道题
   ✓ 共 138 个知识点
   ✓ 提取 32 个高频考点
   ✓ 归纳 7 个核心概念
   ↓
更新知识图谱（138 个知识点入图）
   ↓
生成学习计划（按高频考点重排）
```

### 分析入口
- 资料库每张卡片：`[AI 分析]` 按钮
- 状态机：pending → analyzing（分步输出 ✓）→ analyzed

---

## 4. 首页：资料库（目标）

```
📚 我的资料
────────────
✓ 数学二历年真题 2015-2025   [已分析]  [阅读] [AI 重新分析]
✓ 2024 考研政治真题          [已分析]  [阅读] [AI 重新分析]
 英语一 2010-2025 真题       [待分析]  [阅读] [AI 分析]
 肖秀荣政治四套卷           [待分析]  [阅读] [AI 分析]
```

点击资料 → 进入 Reader（读 PDF）
点击 AI 分析 → 进入解析流程（章节→题目→知识点→七核）

---

## 5. 工作流串联

```
导入一份资料
   │
   ▼
AI 分析资料（解析章节/真题）
   │
   ▼
抽取知识点
   │
   ▼
归纳高频考点
   │
   ▼
形成七核
   │
   ▼
更新知识图谱
   │
   ▼
生成学习计划
```

---

## 6. 与现有代码的差距（迁移路径）

| 现状 | 目标 | 迁移动作 |
|------|------|---------|
| `Resource` 类型（有 kind/status/fileStorageKey） | `Material` 类型 | 改名 + 增加 `type`（textbook/past_paper/...）+ `analysis` 结果 |
| `Question` 无资料归属 | `Question.materialId/sectionId` | 增加字段；旧数据迁移时按 `question.source` 猜测 materialId |
| 知识中心 Questions 入口 | 资料库入口（Material-first） | 首页改「资料库」；题目列表改为资料内部视图 |
| AI 分析真题按钮 | AI 分析资料按钮 | `runExamAnalysis` 演进为 `analyzeMaterial(material)`，输出解析链 |
| `resources[]` 数组 | `materials[]` 数组 | 存储 key 演进（Storage Contract v6 时） |

**注意**：当前 v5 存储契约保持稳定，本决策是**后续 v6 Storage Contract 的设计基础**，不立即改动存储 schema。

---

## 7. 实施建议（分阶段）

### Phase 1：模型层准备（不改存储）
- ~ types.ts：新增 `MaterialType`/`MaterialStatus` + Material、MaterialSection 类型（兼容旧 Resource）
- ~ 在 ReaderPanel / 资源库 UI 显示「待分析/已分析」状态徽标

### Phase 2：交互演进
- ~ 资源库首页卡片：加入 `[AI 分析]` 按钮 + 分析状态
- ~ `runExamAnalysis` 改为 `analyzeMaterial`（当前可先展示流程步骤，再接真 AI）

### Phase 3：存储演进（v6，D1 迁移时）
- ~ 将 `resources` → `materials`，`questions` 挂 `materialId/sectionId`
- ~ 随 D1 数据库落地统一迁移

---

## 8. 决策状态

- **方向**：✅ 已确认（用户 2026-08-01）
- **Phase 1**（模型/UI 准备）：待实施
- **Phase 2**（AI 分析资料流程）：待实施
- **Phase 3**（存储演进 v6）：随 D1