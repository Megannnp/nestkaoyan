export type Risk = "正常" | "需要关注" | "进度落后" | "高风险";
export type MasteryText = "完全不懂" | "有些模糊" | "基本理解" | "能够讲清" | "能够迁移";
export type StudyMood = "较差" | "一般" | "正常" | "较好" | "很好";
export type WorkspaceView = "dashboard" | "agent" | "knowledge" | "cards" | "settings";
export type KnowledgePanel = "resources" | "questions" | "graph" | "landing";
export type DashboardPanel = "tasks" | "review";
export type ReviewScope = "日复盘" | "周复盘" | "月复盘";
export type ActiveDialog = "resource" | "question" | "node" | "card" | "task" | "annotation" | "exam" | "subject" | "review" | null;
export type ReaderTab = "annotations" | "knowledge" | "cards" | "ai";
export type DeletedBackup =
  | { collection: "subjects"; item: Subject; label: string }
  | { collection: "resources"; item: Resource; label: string }
  | { collection: "questions"; item: Question; label: string }
  | { collection: "nodes"; item: KnowledgeNode; label: string }
  | { collection: "cards"; item: GrowthCard; label: string };

export type ExamGoal = {
  examName: string;
  school: string;
  major: string;
  examDate: string;
  startDate: string;
  examGoalCreatedAt?: string;
  weeklyDays: string;
  weekdayHours: string;
  weekendHours: string;
  baseline: string;
};

export type Subject = {
  id: string;
  name: string;
  type: string;
  /** 满分（如 100、150），不允许修改科目时超过此值 */
  maxScore: string;
  /** 目标分数，不得超过 maxScore */
  targetScore: string;
  currentProgress: string;
  currentMastery: string;
  weeklyHours: string;
  hasPastPapers: boolean;
  hasSolutions: boolean;
  hasReferences: boolean;
  round: string;
  layer: string;
  focus: string;
  risk: Risk;
};

export type Resource = {
  id: string;
  name: string;
  subject: string;
  type: string;
  author: string;
  version: string;
  pages: string;
  status: string;
  fileName: string;
  recommendedRound: string;
  recommendedLayer: string;
  currentPage: string;
  lastRead: string;
  readingMinutes: string;
  linkedNode: string;
};

export type Question = {
  id: string;
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

export type KnowledgeNode = {
  id: string;
  subject: string;
  core: string;
  branch: string;
  knowledge: string;
  explanation: string;
  prerequisite: string;
  related: string;
  masteryLevel: number;
  masteryScore: number;
  confidence: "低" | "中" | "高";
  round: string;
  layer: string;
  mistakes: number;
  reviewRisk: Risk;
  isMonthlyFocus: boolean;
};

export type TaskStatus = "待开始" | "学习中" | "暂停" | "等待复习" | "已完成" | "延期" | "失败";

export type Task = {
  id: string;
  title: string;
  subject: string;
  core: string;
  branch: string;
  round: string;
  layer: string;
  source: string;
  range: string;
  minutes: number;
  standard: string;
  reason: string;
  backup: string;
  done: boolean;
  actualMinutes: string;
  difficulty: string;
  mastery: MasteryText;
  accuracy: string;
  needReview: boolean;
  mood: StudyMood;
  note: string;
  /** New fields */
  status: TaskStatus;
  aiRecommended: boolean;
  aiReasonForgetRate: string;
  aiReasonLayerStable: string;
  aiReasonMistakeCount: string;
  aiReasonExamFrequency: string;
  estimatedCompletionMinutes: number;
  masteryBefore: number;
  masteryAfter: number;
  startedAt: string;
  completedAt: string;
  relatedCardIds: string[];
  relatedQuestionIds: string[];
};

export type PendingItem = {
  id: string;
  kind: "真题识别" | "资料切分" | "图谱更新";
  title: string;
  subject: string;
  detail: string;
  status: string;
  targetId?: string;
};

export type Review = {
  done: string;
  hard: string;
  load: "过少" | "刚好" | "过多";
  tomorrow: string;
  priority: string;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  tags: string[];
};

export type PlanLog = {
  id: string;
  time: string;
  input: string;
  output: string;
  accepted: string;
  dataRead: string[];
  userRevision: string;
  finalResult: string;
  rating: string;
  rework: string;
};

export type AnswerDetail = "简洁" | "标准" | "详细";

export type AppSettings = {
  aiProvider: string;
  modelName: string;
  retrievalMode: string;
  notificationTime: string;
  notificationChannel: string;
  parseMode: string;
  /** 普通用户：启用AI学习助手 */
  aiEnabled?: boolean;
  /** 普通用户：AI执行修改前需要确认 */
  aiConfirmBeforeAction?: boolean;
  /** 普通用户：AI识别后需要用户确认（替代parseMode下拉框） */
  aiConfirmAfterRecognition?: boolean;
  /** 普通用户：回答详细程度 */
  aiAnswerDetail?: AnswerDetail;
  /** 普通用户：允许AI读取已上传资料 */
  aiReadUploads?: boolean;
  /** 普通用户：允许AI参考学习记录 */
  aiReadStudyRecords?: boolean;
  /** 普通用户：允许AI根据学习情况调整计划 */
  aiAdjustPlan?: boolean;
};

export type StudyDay = {
  date: string;
  completed: number;
  minutes: number;
};

export type CardDeck = {
  id: string;
  subject: string;
  name: string;
  cardIds: string[];
};

export type GrowthCard = {
  id: string;
  deckId?: string;
  title: string;
  front: string;
  back: string;
  type: "公式卡" | "概念卡" | "填空卡" | "推导卡" | "条件辨析卡" | "错题卡";
  subject: string;
  core: string;
  branch: string;
  knowledge: string;
  source: string;
  page: string;
  modes: string[];
  createdBy: "手动" | "AI对话" | "资料批注" | "错题建议";
  createdAt: string;
  lastReviewed: string;
  nextReviewAt: string;
  mastery: "不会" | "模糊" | "认识" | "熟练" | "稳定";
  note: string;
  favorite: boolean;
};

/** 批注颜色标签定义 */
export type AnnotationTag =
  /** 🟡 重要公式、定义、结论 */
  | "重点"
  /** 🔵 暂时没理解、需要继续追问 */
  | "疑问"
  /** 🔴 容易混淆、容易用错、容易漏条件 */
  | "易错"
  /** 🟢 自己的理解、归纳和记忆方法 */
  | "总结";

/** 批注颜色映射 */
export const ANNOTATION_COLORS: Record<AnnotationTag, { dot: string; bg: string; border: string; label: string }> = {
  "重点": { dot: "🟡", bg: "#FEF9C3", border: "#EAB308", label: "重要公式、定义、结论" },
  "疑问": { dot: "🔵", bg: "#DBEAFE", border: "#3B82F6", label: "暂时没理解、需要继续追问" },
  "易错": { dot: "🔴", bg: "#FEE2E2", border: "#EF4444", label: "容易混淆、容易用错、容易漏条件" },
  "总结": { dot: "🟢", bg: "#DCFCE7", border: "#22C55E", label: "自己的理解、归纳和记忆方法" },
};

export type Annotation = {
  id: string;
  resourceId: string;
  resourceName: string;
  page: string;
  selection: string;
  tag: AnnotationTag;
  note: string;
  linkedNode: string;
  createdAt: string;
  handled: boolean;
};

export type AgentStep = {
  id: string;
  title: string;
  status: "等待" | "完成";
};

// ════════════════════════════════════════════════════════════
// Learning Memory Engine Types
// ════════════════════════════════════════════════════════════

/** 复盘的 AI 解析结果 */
export type StructuredReview = {
  id: string;
  /** 关联的任务/复习 ID */
  sourceId: string;
  /** 复盘日期 */
  date: string;

  /** 原始用户输入 */
  rawInput: {
    done: string;
    hard: string;
    overload: string;
    availableTime: string;
    priority: string;
    mood?: string;
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

/** 记忆类型分类 */
export type MemoryType =
  | "goal"
  | "habit"
  | "weakness"
  | "preference"
  | "emotion_pattern"
  | "behavior_pattern"
  | "background";

/** 记忆来源 */
export type MemorySource =
  | "review"
  | "chat"
  | "question"
  | "task"
  | "reflection"
  | "manual"
  | "system";

/** 单个记忆条目 */
export type MemoryItem = {
  id: string;
  type: MemoryType;
  content: string;
  evidence: string;
  source: MemorySource;
  sourceRef: string;
  confidence: number;
  expiresAt: string | null;
  createdAt: string;
  lastAccessed: string;
  accessCount: number;
  tags: string[];
  relatedNodeIds: string[];
  relatedSubjectIds: string[];
  applied: boolean;
  effect: string;
};

/** 单个知识点在某一时刻的掌握度快照 */
export type KnowledgeSnapshot = {
  nodeId: string;
  date: string;
  masteryScore: number;
  confidence: "低" | "中" | "高";
  delta: number;
  deltaReason: string;
  forgetRisk: number;
  lastReviewDate: string;
  nextReviewDate: string;
  recentMistakes: number;
  recentAccuracy: number;
};

/** 完整知识掌握度视图 */
export type KnowledgeMasteryMap = {
  date: string;
  snapshots: KnowledgeSnapshot[];
  overallMastery: number;
  trend: "up" | "down" | "stable";
  weakPoints: { nodeId: string; score: number }[];
  improvingPoints: { nodeId: string; delta: number }[];
};

/** 每日学习画像 */
export type DailyPortrait = {
  date: string;
  overallRating: number;
  stats: {
    totalMinutes: number;
    tasksCompleted: number;
    completionRate: number;
    effectiveMinutes: number;
    procrastinationMinutes: number;
  };
  masteryChanges: {
    improved: { nodeId: string; name: string; delta: number }[];
    declined: { nodeId: string; name: string; delta: number }[];
  };
  emotion: {
    overall: StudyMood;
    timeline: { period: string; mood: StudyMood }[];
  };
  recommendations: {
    priority: "high" | "medium" | "low";
    content: string;
    reason: string;
    actionType: "task" | "review" | "card" | "rest";
  }[];
  summary: string;
};

/** 长期学习画像（累积） */
export type LearningProfile = {
  userId: string;
  updatedAt: string;
  basics: {
    examGoal: string;
    targetScore: number;
    totalDays: number;
    daysLeft: number;
  };
  traits: {
    bestTimeSlot: "早上" | "上午" | "下午" | "晚上" | "深夜";
    maxFocusMinutes: number;
    avgDailyMinutes: number;
    weekdayWeekendRatio: number;
    procrastinationTendency: number;
  };
  strategy: {
    weakSubjects: string[];
    strongSubjects: string[];
    recommendedOrder: string[];
    reviewMode: "基础" | "强化" | "冲刺";
  };
  memoryIds: string[];
};

/** AI 反思记录 */
export type Reflection = {
  id: string;
  date: string;
  trigger: {
    type: "连续下降" | "异常波动" | "模式识别" | "定期检查";
    detail: string;
  };
  analysis: string;
  suggestion: {
    summary: string;
    detail: string;
    actions: {
      type: "复习" | "调整" | "休息" | "专项训练" | "心理疏导";
      target: string;
      reason: string;
    }[];
  };
  affectedNodes: string[];
  masteryDelta: number;
  priority: "低" | "中" | "高" | "紧急";
  applied: boolean;
  effect?: string;
};

/** 聊天中提取的学习行为 */
export type ChatLearningEvent = {
  id: string;
  chatId: string;
  timestamp: string;
  knowledgePoints: {
    nodeId: string;
    name: string;
    performance: "正确" | "错误" | "疑问" | "讲解" | "举例";
    confidenceSignal: "高" | "中" | "低";
  }[];
  exposedWeakness: string[];
  estimatedMasteryImpact: {
    nodeId: string;
    delta: number;
  }[];
  suggestedActions: string[];
};