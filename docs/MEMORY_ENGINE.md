# Learning Memory Engine（学习记忆引擎）

> 架构设计文档

---

## 1. 核心理念

传统学习平台把数据按模块割裂：

```
阅读 → 阅读数据
聊天 → 聊天记录
做题 → 做题统计

各模块互不相通
```

Learning Memory Engine 的核心理念是：

```
用户的一切学习行为
       ↓
 统一结构化处理
       ↓
 一份学习画像 → 所有模块共享
```

**这不是一个 AI 聊天窗口，这是一个持续成长的学习操作系统（Learning OS）。**

---

## 2. 数据流全景

```
┌─────────────────────────────────────────────────────────────┐
│                    学习行为输入层                           │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐       │
│  │ 复盘  │  │ AI聊天│  │ 做题  │  │ 错题  │  │学习时长│  ...
│  └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘       │
└─────┼─────────┼─────────┼─────────┼─────────┼────────────┘
      │         │         │         │         │
      ▼         ▼         ▼         ▼         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Learning Memory Engine                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               Memory Extractor (AI)                  │   │
│  │                                                     │   │
│  │  输入 → 分类 → [长期记忆 / 短期记忆 / 丢弃]         │   │
│  │                                                     │   │
│  │  规则示例：                                         │   │
│  │  ● "我只有晚上学习" → 长期（学习习惯）              │   │
│  │  ● "今天导数不会" → 短期（日复盘）                  │   │
│  │  ● "今天吃了什么" → 丢弃（无关内容）               │   │
│  └──────────────────────────┬──────────────────────────┘   │
│                              │                              │
│         ┌────────────────────┼────────────────────┐        │
│         ▼                    ▼                    ▼         │
│  ┌───────────┐    ┌──────────────┐    ┌─────────────┐     │
│  │ 长期记忆   │    │  短期记忆     │    │  丢弃 / 忽略 │     │
│  │ (永久)     │    │ (过期自动清除) │    │             │     │
│  └─────┬─────┘    └──────┬───────┘    └─────────────┘     │
│        │                  │                                 │
│        ▼                  ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Knowledge Graph Updater                 │   │
│  │  ● 更新掌握度                                      │   │
│  │  ● 更新遗忘曲线                                    │   │
│  │  ● 更新知识关联                                    │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Learning Portrait Generator                │   │
│  │  ● 每日画像 (DailySnapshot)                         │   │
│  │  ● 知识趋势图                                      │   │
│  │  ● 学习节奏分析                                    │   │
│  │  ● 情绪变化曲线                                    │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            Reflection Engine (AI 反思)               │   │
│  │  ● 自动检测异常 🔍                               │   │
│  │  ● 生成优化建议 💡                               │   │
│  │  ● 预测学习风险 ⚡                               │   │
│  └──────────────────────┬──────────────────────────────┘   │
└─────────────────────────┼──────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    所有模块共享                              │
│                                                             │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │ 规划  │ │ 阅读  │ │ 做题  │ │ 卡片  │ │ 聊天  │ │ 老师  │  │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘  │
│                                                             │
│  共享数据包括：                                             │
│  ● 用户学习画像 (LearningPortrait)                          │
│  ● 知识点掌握度 (KnowledgeMastery)                          │
│  ● 长期记忆 (LongTermMemory)                               │
│  ● 遗忘曲线 (ForgettingCurve)                              │
│  ● 学习策略 (LearningStrategy)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 数据类型定义

### 3.1 结构化复盘 (StructuredReview)

复盘输入不再被视为「文字日志」，而是解析为结构化数据。

```typescript
// app/lib/types.ts 新增

/** 复盘的 AI 解析结果 */
export type StructuredReview = {
  id: string;
  /** 关联的任务/复习 ID */
  sourceId: string;
  /** 复盘日期 */
  date: string;
  
  /** 原始用户输入 */
  rawInput: {
    done: string;      // 今天完成了什么
    hard: string;      // 哪个部分最困难
    overload: string;  // 计划是否过多/过少
    availableTime: string; // 明天可用时间
    priority: string;  // 需要优先处理什么
    mood?: string;     // 情绪（可选扩展）
  };

  /** AI 解析后的结构化字段 */
  parsed: {
    /** 学习内容列表 */
    content: string[];
    /** 每个内容的完成率 0-100 */
    completionRates: number[];
    /** 困难知识点 */
    difficulty: string[];
    /** 情绪等级 */
    emotion: StudyMood;
    /** 信心百分比 0-100 */
    confidence: number;
    /** 明天可用时间（分钟） */
    availableMinutes: number;
    /** 计划负荷评估 */
    loadLevel: "过少" | "刚好" | "过多";
  };

  /** 本次复盘对知识图谱的影响 */
  knowledgeImpact: {
    nodeId: string;
    masteryDelta: number;
    reason: string;
  }[];

  /** AI 生成的总结摘要 */
  aiSummary: string;
  
  createdAt: string;
};
```

### 3.2 长期记忆 (LongTermMemory)

长期记忆是共享的「用户画像」核心，所有模块可读写。

```typescript
/** 记忆类型分类 */
export type MemoryType = 
  /** 学习目标：我目标130分 */
  | "goal"
  /** 学习习惯：我只有晚上学习 */
  | "habit"
  /** 知识弱点：我容易在积分计算出错 */
  | "weakness"
  /** 学习偏好：我喜欢先做数学再做英语 */
  | "preference"
  /** 情绪模式：我每到月底就焦虑 */
  | "emotion_pattern"
  /** 行为模式：我经常拖延后半小时 */
  | "behavior_pattern"
  /** 个人背景：我是在职考研 */
  | "background";

/** 记忆来源 */
export type MemorySource = 
  | "review"        // 用户复盘
  | "chat"          // AI 对话
  | "question"      // 做题过程
  | "task"          // 任务执行
  | "reflection"    // AI 自动反思
  | "manual"        // 手动录入
  | "system";       // 系统推导

/** 单个记忆条目 */
export type MemoryItem = {
  id: string;
  /** 记忆类型 */
  type: MemoryType;
  /** 记忆内容（人类可读） */
  content: string;
  /** 原始证据（触发此记忆的用户行为） */
  evidence: string;
  /** 来源 */
  source: MemorySource;
  /** 来源的详细引用（日期、上下文） */
  sourceRef: string;
  
  /** AI 置信度 0-100 */
  confidence: number;
  
  /** 过期时间，null = 永久 */
  expiresAt: string | null;
  
  /** 创建时间 */
  createdAt: string;
  /** 最后访问时间 */
  lastAccessed: string;
  /** 访问次数（越高频越重要） */
  accessCount: number;
  
  /** 标签（便于检索） */
  tags: string[];
  
  /** 关联的知识点 ID */
  relatedNodeIds: string[];
  /** 关联的科目 ID */
  relatedSubjectIds: string[];
  
  /** 是否已被 Agent 采纳 */
  applied: boolean;
  /** 采纳后的效果记录 */
  effect: string;
};
```

### 3.3 知识掌握度 (KnowledgeMasterySnapshot)

所有知识点的统一掌握度视图，按时间追踪变化。

```typescript
/** 单个知识点在某一时刻的掌握度快照 */
export type KnowledgeSnapshot = {
  nodeId: string;
  date: string;
  
  /** 掌握度 0-100 */
  masteryScore: number;
  /** 信心水平 */
  confidence: "低" | "中" | "高";
  
  /** 较上次变化 */
  delta: number;
  /** 变化原因 */
  deltaReason: string;
  
  /** 遗忘风险 0-100 */
  forgetRisk: number;
  /** 上次复习日期 */
  lastReviewDate: string;
  /** 建议下次复习日期 */
  nextReviewDate: string;
  
  /** 最近错误次数 */
  recentMistakes: number;
  /** 最近正确率 0-100 */
  recentAccuracy: number;
};

/** 完整知识掌握度视图 */
export type KnowledgeMasteryMap = {
  date: string;
  snapshots: KnowledgeSnapshot[];
  
  /** 总体掌握度 0-100 */
  overallMastery: number;
  /** 趋势: "up" | "down" | "stable" */
  trend: "up" | "down" | "stable";
  
  /** 薄弱知识点 TOP N */
  weakPoints: { nodeId: string; score: number }[];
  /** 进步最大知识点 TOP N */
  improvingPoints: { nodeId: string; delta: number }[];
};
```

### 3.4 学习画像 (LearningPortrait)

每日自动生成的用户学习画像。

```typescript
/** 每日学习画像 */
export type DailyPortrait = {
  date: string;
  
  /** 整体评分 1-5 */
  overallRating: number;
  
  /** 学习统计 */
  stats: {
    /** 总学习时长（分钟） */
    totalMinutes: number;
    /** 完成任务数 */
    tasksCompleted: number;
    /** 任务完成率 0-100 */
    completionRate: number;
    /** 有效学习时长（排除拖延） */
    effectiveMinutes: number;
    /** 拖延时长（分钟） */
    procrastinationMinutes: number;
  };
  
  /** 掌握度变化 */
  masteryChanges: {
    /** 提升的知识点 */
    improved: { nodeId: string; name: string; delta: number }[];
    /** 下降的知识点 */
    declined: { nodeId: string; name: string; delta: number }[];
  };
  
  /** 当日情绪 */
  emotion: {
    overall: StudyMood;
    /** 情绪变化：早上 / 中午 / 晚上 */
    timeline: { period: string; mood: StudyMood }[];
  };
  
  /** AI 建议 */
  recommendations: {
    priority: "high" | "medium" | "low";
    content: string;
    reason: string;
    actionType: "task" | "review" | "card" | "rest";
  }[];
  
  /** AI 总结 */
  summary: string;
};

/** 长期学习画像（累积） */
export type LearningProfile = {
  userId: string;
  updatedAt: string;
  
  /** 基本画像 */
  basics: {
    /** 考试目标 */
    examGoal: string;
    /** 目标分数 */
    targetScore: number;
    /** 备考天数 */
    totalDays: number;
    /** 剩余天数 */
    daysLeft: number;
  };
  
  /** 学习特征 */
  traits: {
    /** 最佳学习时段 */
    bestTimeSlot: "早上" | "上午" | "下午" | "晚上" | "深夜";
    /** 最长专注时长（分钟） */
    maxFocusMinutes: number;
    /** 平均每日时长 */
    avgDailyMinutes: number;
    /** 周中 vs 周末平均对比 */
    weekdayWeekendRatio: number;
    /** 拖延倾向 0-100 */
    procrastinationTendency: number;
  };
  
  /** 当前策略 */
  strategy: {
    /** 薄弱科目 */
    weakSubjects: string[];
    /** 优势科目 */
    strongSubjects: string[];
    /** 推荐学习顺序 */
    recommendedOrder: string[];
    /** 当前推荐的复习模式 */
    reviewMode: "基础" | "强化" | "冲刺";
  };
  
  /** 长期记忆索引 */
  memoryIds: string[];
};
```

### 3.5 AI 反思 (Reflection)

后台自动生成的反思记录，用户不可见。

```typescript
/** AI 反思记录 */
export type Reflection = {
  id: string;
  date: string;
  
  /** 触发此反思的事件 */
  trigger: {
    type: "连续下降" | "异常波动" | "模式识别" | "定期检查";
    detail: string;
  };
  
  /** AI 分析 */
  analysis: string;
  
  /** 优化建议 */
  suggestion: {
    summary: string;
    detail: string;
    /** 建议执行的动作 */
    actions: {
      type: "复习" | "调整" | "休息" | "专项训练" | "心理疏导";
      target: string;
      reason: string;
    }[];
  };
  
  /** 影响的知识点 */
  affectedNodes: string[];
  
  /** 掌握度变化分数 */
  masteryDelta: number;
  
  /** 优先级 */
  priority: "低" | "中" | "高" | "紧急";
  
  /** 建议是否被采纳 */
  applied: boolean;
  /** 采纳后的效果 */
  effect?: string;
};
```

### 3.6 聊天学习行为 (ChatLearningEvent)

AI 聊天不仅是对话记录，更是学习行为数据。

```typescript
/** 聊天中提取的学习行为 */
export type ChatLearningEvent = {
  id: string;
  chatId: string;
  timestamp: string;
  
  /** 涉及的知识点 */
  knowledgePoints: {
    nodeId: string;
    name: string;
    /** 用户对此知识点的表现 */
    performance: "正确" | "错误" | "疑问" | "讲解" | "举例";
    /** 用户信心信号 */
    confidenceSignal: "高" | "中" | "低";
  }[];
  
  /** 暴露的知识漏洞 */
  exposedWeakness: string[];
  
  /** 本次对话对掌握度的预估影响 */
  estimatedMasteryImpact: {
    nodeId: string;
    delta: number;
  }[];
  
  /** 建议后续动作 */
  suggestedActions: string[];
};
```

---

## 4. 核心引擎组件

### 4.1 Memory Extractor（记忆提取器）

职责：处理所有用户输入，分类并提取记忆。

```
输入 → Memory Extractor → 输出

输入来源：
  - 复盘提交
  - AI 对话消息
  - 任务完成记录
  - 做题结果
  - 错题录入
  - 卡片复习

分类规则（由 AI 或规则引擎执行）：

长期记忆条件（任一条）：
  ✓ 涉及个人背景、习惯、偏好
  ✓ 明确表达目标或期望
  ✓ 反复出现的模式（>3次）
  ✓ 与学习方法论相关
  ✓ 明显的学习策略声明

短期记忆条件（任一条）：
  ✓ 今日学习的具体内容
  ✓ 具体某道题的困难
  ✓ 临时情绪波动
  ✓ 明日计划

丢弃条件（任一条）：
  ✓ 纯日常闲聊
  ✓ 无学习信息的对话
  ✓ 技术故障/操作问题
  ✓ 重复已记录的内容
  ✓ 明确无意义内容
```

### 4.2 Knowledge Graph Updater（知识图谱更新器）

职责：基于新数据更新所有知识点的掌握度。

```
事件 → 更新规则示例：

用户做对一道题：
  → 相关知识点掌握度 +2~5
  → 信心 +1

用户做错一道题（且错误原因是知识点不熟）：
  → 相关知识点掌握度 -3~8
  → 错误计数 +1
  → 遗忘风险 +5

用户连续 3 天未复习某知识点：
  → 遗忘风险每日 +10
  → 掌握度每日 -2

用户主动复盘说"掌握了"：
  → 掌握度 +5
  → 信心 +2

用户在聊天中问了关于某知识点的深层问题：
  → 掌握度可能不变，但信心调低
  → 标记为「需确认掌握」
```

### 4.3 Learning Portrait Generator（学习画像生成器）

职责：每日定时生成用户完整画像。

```
触发时间：每天 23:00（可配置）
输入：当日所有学习数据
输出：DailyPortrait

生成流程：
1. 汇总当日学习时长
2. 计算任务完成率
3. 对比知识点掌握度变化
4. 分析情绪变化曲线
5. 提取当日模式（拖延时段、高效时段）
6. 生成个性化建议
7. 更新长期画像
```

### 4.4 Reflection Engine（AI 反思引擎）

职责：后台自动检测异常、生成优化建议。

```
触发条件：
  - 定时触发：每天 00:00 执行
  - 事件触发：检测到异常数据

检测模式：

1. 连续下降检测
   → 某知识点掌握度连续 3 天下降
   → 生成 Reflection，建议优先复习

2. 模式识别
   → 每天最后 30 分钟效率下降
   → 生成 Reflection，建议调整任务顺序

3. 情绪异常检测
   → 用户连续 5 天情绪为「较差」
   → 生成 Reflection，建议降低学习强度

4. 遗忘风险预警
   → 某知识点遗忘风险 > 80%
   → 生成 Reflection，建议安排复习

5. 学习节奏评估
   → 用户连续 3 天超额完成任务 150%+
   → 生成 Reflection，提醒可持续性
```

---

## 5. 存储架构

### 5.1 localStorage 存储结构

```typescript
// 存储在 localStorage key: "nest-exam-workspace-v4"

interface MemoryEngineStorage {
  // 数据版本
  __version: number;
  
  // === 核心数据（现有，不改变） ===
  exam: ExamGoal;
  subjects: Subject[];
  resources: Resource[];
  questions: Question[];
  tasks: Task[];
  cards: GrowthCard[];
  nodes: KnowledgeNode[];
  // ... 其他现有字段
  
  // === 新增：记忆引擎数据 ===
  
  // 长期记忆
  longTermMemory: MemoryItem[];
  
  // 结构化复盘历史（短期，保留 30 天）
  structuredReviews: StructuredReview[];
  
  // 知识掌握度时间序列
  masteryHistory: KnowledgeMasteryMap[];
  
  // 每日画像（保留 90 天）
  dailyPortraits: DailyPortrait[];
  
  // AI 反思（保留 30 天）
  reflections: Reflection[];
  
  // 聊天学习事件（保留 7 天，提取后合并到掌握度）
  chatLearningEvents: ChatLearningEvent[];
  
  // 累积学习画像
  learningProfile: LearningProfile;
  
  // 记忆引擎运行状态
  memoryEngine: {
    lastExtractionAt: string;
    lastPortraitAt: string;
    lastReflectionAt: string;
    lastKnowledgeUpdateAt: string;
    pendingExtractions: number;
    version: number;
  };
}
```

### 5.2 数据保留策略

| 数据类型 | 保留周期 | 过期处理 |
|---------|---------|---------|
| 长期记忆 | 永久 | 不移除 |
| 短期记忆(review) | 30天 | 自动清理 |
| 知识掌握度历史 | 90天 | 自动归档(保留月均值) |
| 每日画像 | 90天 | 自动归档(保留周均值) |
| AI反思 | 30天 | 自动清理，关键反思提升为长期记忆 |
| 聊天学习事件 | 7天 | 提取后合并到掌握度，原始数据清除 |

---

## 6. 共享架构

### 6.1 模块间通信

所有模块通过 `LearningProfile` 和 `MemoryItem[]` 共享数据。

```
模块 A：阅读 Agent
  写入：阅读时长 → 影响 knowledgeMastery
  读取：用户偏好 → 推荐阅读顺序

模块 B：规划 Agent
  写入：任务完成情况 → 影响 dailyPortrait
  读取：长期弱点 → 优先安排复习

模块 C：AI 聊天 Agent
  写入：知识疑问 → 影响 knowledgeMastery
  读取：用户背景 → 个性化回答

模块 D：卡片 Agent
  写入：复习结果 → 影响 forgettingCurve
  读取：困难知识点 → 生成针对性卡片

模块 E：老师工作台
  读取：全部数据 → 提供教学决策支持
  写入：教学建议 → 作为 longTermMemory
```

### 6.2 共享规则

```
1. 所有 Agent 必须通过 MemoryEngine 读写共享数据
2. 禁止 Agent 直接修改其他 Agent 的私有状态
3. 写入时附加 evidence（原始来源引用）
4. 读取时指定置信度阈值（低于阈值不采纳）
5. 冲突时以最新数据为准
```

---

## 7. 实现计划

### Phase 1: 结构化复盘（基础）

- [ ] 定义 `StructuredReview` 类型
- [ ] 在复盘提交时调用 `MemoryExtractor` 解析用户输入
- [ ] 将解析后的结构化数据存入 `structuredReviews`
- [ ] 更新复盘 UI，展示 AI 解析结果

### Phase 2: 记忆引擎核心

- [ ] 定义 `MemoryItem`、`MemoryType`、`MemorySource` 类型
- [ ] 实现 `MemoryExtractor` 分类逻辑（规则版先，AI 版后）
- [ ] 实现长期记忆写入接口
- [ ] 实现短期记忆自动过期机制
- [ ] 实现记忆检索接口（按类型、标签、知识点）

### Phase 3: 知识图谱联动

- [ ] 定义 `KnowledgeSnapshot`、`KnowledgeMasteryMap` 类型
- [ ] 实现掌握度自动更新规则
- [ ] 实现遗忘曲线计算
- [ ] 实现知识点趋势追踪
- [ ] 将聊天中的知识点疑问同步到知识图谱

### Phase 4: 每日画像

- [ ] 定义 `DailyPortrait`、`LearningProfile` 类型
- [ ] 实现 `PortraitGenerator` 定时任务
- [ ] 实现情绪曲线分析
- [ ] 实现学习节奏分析
- [ ] 生成每日建议

### Phase 5: AI 反思

- [ ] 定义 `Reflection` 类型
- [ ] 实现异常检测规则
- [ ] 实现模式识别
- [ ] 实现建议生成
- [ ] 实现反思效果追踪

### Phase 6: 全模块共享

- [ ] 实现统一的 `MemoryEngine` 单例
- [ ] 实现所有 Agent 读写接口
- [ ] 实现冲突解决策略
- [ ] 实现性能优化（缓存、批量读写）
- [ ] 添加监控和调试工具

---

## 8. 数据流程示例

### 示例场景：用户完成一次复盘

```
用户提交复盘：
  "今天完成了积分换元法，计算题总是算错，中级难度。明天有 3 小时。"

                    ↓
                Memory Extractor
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
 长期记忆          短期记忆         丢弃
 "容易在积分      "今天学了         (无)
  计算出错"       换元法"
                    ↓               ↓
              写入 review        写入 longTermMemory
              parsed:             type: "weakness"
                difficulty:       content: "容易在积分
                ["换元法"]          计算出错"
                confidence: 60%   confidence: 80%
                emotion: "正常"
                available: 180min

                    ↓
            Knowledge Graph Updater
                    ↓
  "换元法" 知识点掌握度 65 → 58
  错误计数 +1
  遗忘风险 45% → 60%

                    ↓
            Portrait Generator (当天 23:00)
                    ↓
  今日画像：
  完成率：★★★★☆
  薄弱：换元法（掌握度 ↓7）
  建议：明天优先做 3 道换元法基础题

                    ↓
            Reflection Engine (次日 00:00)
                    ↓
  检测到：换元法掌握度连续下降
  反思ID: r-2026-08-01-001
  建议：安排换元法专项训练
  优先级：高

                    ↓
            Agent 共享 → 规划 Agent 读取
  → 明天任务中自动加入 "换元法基础训练 3 道"
  → 卡片 Agent 推送换元法公式卡
  → 聊天 Agent 准备换元法相关的答疑知识
```

---

## 9. 与现有系统的关系

### 现有数据不变

- `ExamGoal`、`Subject`、`Task`、`Card` 等现有类型不变
- 现有业务逻辑（计划生成、卡片复习等）不变
- 现有 localStorage 存储结构保持兼容

### 新增数据层

```
现有存储 (v3)             新增存储 (v4)
  exam                    longTermMemory[]
  subjects                structuredReviews[]
  tasks                   masteryHistory[]
  cards                   dailyPortraits[]
  nodes                   reflections[]
  ...                     chatLearningEvents[]
                          learningProfile
                          memoryEngine.status
```

### 迁移策略

1. `storage.ts` 版本升级 v3 → v4
2. 加载 v3 数据后，新增字段初始化为空数组
3. 记忆引擎功能逐步启用，不阻塞现有功能

---

## 10. 性能考虑

| 数据 | 预估规模 | 优化策略 |
|------|---------|---------|
| longTermMemory | < 1000 条 | 直接存储，内存缓存 |
| structuredReviews | 30 天 × ~1条/天 = 30条 | 直接存储 |
| masteryHistory | 90 天 × ~50节点 = 4500条 | 按日期分区存储 |
| dailyPortraits | 90 天 = 90条 | 直接存储 |
| chatLearningEvents | 7天 × ~10条/天 = 70条 | 定期清理 |
| reflections | 30 天 × ~3条/天 = 90条 | 直接存储 |

**关键优化点：**
- `masteryHistory` 是增长最快的，需定期归档（日数据 → 周均值）
- 聊天事件提取后及时合并，原始数据删除
- 长期记忆使用 LRU 缓存策略

---

## 11. 附录：规则引擎（离线版）

在 AI 未接入时，使用规则引擎完成拆分提取：

```typescript
// app/lib/memory-rules.ts

export const MEMORY_CLASSIFICATION_RULES = [
  // === 长期记忆规则 ===
  {
    pattern: /我[只每总][能要会]?/,
    type: "habit" as MemoryType,
    confidence: 70,
  },
  {
    pattern: /目标|希望|打算|计划.*[分考学]/,
    type: "goal" as MemoryType,
    confidence: 80,
  },
  {
    pattern: /容易|总是|经常|每次.*[错算忘混]/,
    type: "weakness" as MemoryType,
    confidence: 75,
  },
  {
    pattern: /习惯|喜欢|偏好|倾向于/,
    type: "preference" as MemoryType,
    confidence: 70,
  },
  
  // === 短期记忆规则 ===
  {
    pattern: /今天[完学做看读]/,
    type: "short_term" as MemoryType,
    confidence: 60,
  },
  {
    pattern: /明天[要打准]?/,
    type: "short_term" as MemoryType,
    confidence: 50,
  },
  
  // === 丢弃规则 ===
  {
    pattern: /吃了|睡了|天气|好玩|哈哈/,
    type: "discard" as MemoryType,
    confidence: 90,
  },
];
```

---

> 本文档定义了 Learning Memory Engine 的完整架构。
> 实现顺序：Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
> 每个 Phase 可独立发布，不阻塞现有功能。