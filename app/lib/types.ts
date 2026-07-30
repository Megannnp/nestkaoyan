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

export type Annotation = {
  id: string;
  resourceId: string;
  resourceName: string;
  page: string;
  selection: string;
  tag: "核心概念" | "重要公式" | "易错内容" | "不理解" | "真题相关" | "需要背诵";
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