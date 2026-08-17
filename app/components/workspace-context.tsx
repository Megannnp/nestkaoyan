"use client";

/**
 * WorkspaceContext —— page.tsx 拆分的共享层。
 *
 * page.tsx（Home）把它的 state / 派生值 / handler 打包成一个 value 对象，经 Provider
 * 提供；抽出的视图组件（CardsView 等）通过 useWorkspace() 按需取用，避免 40-60 个
 * props 逐个透传。接口随每个视图的抽出逐步扩充——只加该视图真正用到的字段。
 */

import { createContext, useContext, type Dispatch, type SetStateAction, type FormEvent } from "react";
import type {
  Subject, GrowthCard, CardCategory, KnowledgeNode, Resource, ActiveDialog,
  KnowledgePanel, WorkspaceView, PendingItem, Annotation, Question,
  Task, AgentStep, AgentMessage, ChatSession, ExamGoal, AppSettings,
  MasteryText, StudyMood, StudyDraft, Material, MaterialSection,
} from "../lib/types";
import type { LearningEvent } from "../lib/events";

/** inferResource 的返回结构（AI 识别资料的推断结果） */
export interface ResourceInference {
  subject: string;
  type: string;
  name: string;
  pages: string;
  linkedNode: string;
  recommendedLayer: string;
  duplicate: boolean;
}

export interface WorkspaceCtx {
  // ── 常量（page.tsx 内定义，经 ctx 透出，避免各处引用被改动）──
  coreNames: string[];
  UNCATEGORIZED: string;
  ALL_GROUPS: string;

  // ── Cards 视图所需 state / 派生值 ──
  subjects: Subject[];
  activeCardSubject: string;
  cardSubjectView: string | null;
  activeCategoryName: string;
  activeCardCategory: string | null;
  categories: CardCategory[];
  subjectCategories: CardCategory[];
  subjectCards: GrowthCard[];
  dueCards: GrowthCard[];
  categoryStats: { category: CardCategory; total: number; due: number }[];
  uncategorizedCardCount: number;
  newCardDeckOpen: boolean;
  newCardDeckName: string;
  cardFilter: "待复习" | "全部" | "收藏";
  cardGroupBy: "按七核" | "按掌握度" | "按时间";
  cardMode: string;
  categoryReviewQueue: GrowthCard[];
  activeGroupCard: GrowthCard;
  categoryClampedCardIndex: number;
  cardFlipped: boolean;
  focusMode: boolean;
  visibleCategoryCards: GrowthCard[];
  hydratedTodayStr: string;
  // 重命名/删除编辑态 value（抽取 CardsView 时漏传——只传了 setter，导致点击无响应）
  renamingCardId: string | null;
  renamingCardName: string;
  deletingCardId: string | null;
  activeDialog: ActiveDialog;
  editingCard: GrowthCard | null;
  cardDialogCategory: string;
  cardDialogSubject: string;
  cardDialogSubjectCategories: CardCategory[];
  nodes: KnowledgeNode[];
  activeResource: Resource | null;
  currentSubject: Subject | undefined;

  // ── setters ──
  setActiveCardSubject: (v: string) => void;
  setCardSubjectView: Dispatch<SetStateAction<string | null>>;
  setActiveCardCategory: Dispatch<SetStateAction<string | null>>;
  setCardIndex: Dispatch<SetStateAction<number>>;
  setCardFlipped: Dispatch<SetStateAction<boolean>>;
  setCardSubView: (v: "待复习" | "全部" | "收藏") => void;
  setRenamingCardId: Dispatch<SetStateAction<string | null>>;
  setRenamingCardName: Dispatch<SetStateAction<string>>;
  setCardMenuOpenId: Dispatch<SetStateAction<string | null>>;
  setDeletingCardId: Dispatch<SetStateAction<string | null>>;
  setNewCardDeckOpen: Dispatch<SetStateAction<boolean>>;
  setNewCardDeckName: Dispatch<SetStateAction<string>>;
  setCardFilter: Dispatch<SetStateAction<"待复习" | "全部" | "收藏">>;
  setCardGroupBy: Dispatch<SetStateAction<"按七核" | "按掌握度" | "按时间">>;
  setCardMode: Dispatch<SetStateAction<string>>;
  setFocusMode: Dispatch<SetStateAction<boolean>>;
  setCards: Dispatch<SetStateAction<GrowthCard[]>>;
  setCategories: Dispatch<SetStateAction<CardCategory[]>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setEditingCardId: Dispatch<SetStateAction<string | null>>;
  setActiveDialog: Dispatch<SetStateAction<ActiveDialog>>;
  setCardDialogCategory: Dispatch<SetStateAction<string>>;
  setCardDialogSubject: Dispatch<SetStateAction<string>>;

  // ── handlers ──
  openNewCardDialog: () => void;
  addCategoryInline: () => void;
  moveCard: (step: number) => void;
  reviewCard: (id: string, mastery: GrowthCard["mastery"]) => void;
  openCardSource: (card: GrowthCard) => void;
  showRelatedQuestions: (core: string, keyword?: string, subject?: string) => void;
  moveCardToCategory: (cardId: string, categoryId: string) => void;
  openEditCardDialog: (card: GrowthCard) => void;
  deleteCard: (item: GrowthCard) => void;
  pushAssistant: (text: string) => void;

  // ── Knowledge 视图所需 state / 派生值 ──
  activeView: WorkspaceView;
  activeKnowledgePanel: KnowledgePanel;
  activeKnowledgeSubject: string;
  resourceView: "grid" | "list";
  readingMode: boolean;
  readerPage: string;
  readerSearch: string;
  readerZoom: string;
  examAnalyzing: boolean;
  elapsedSeconds: number;
  fileUploadState: { name: string; size: number; inferred: ResourceInference; step: string } | null;
  questionFilter: { subject: string; core: string; result: string; keyword: string };
  pending: PendingItem[];
  filteredQuestions: Question[];
  relatedQuestions: Question[];
  resources: Resource[];
  materials: Material[];
  materialSections: MaterialSection[];
  subjectResources: Resource[];
  subjectQuestions: Question[];
  subjectNodes: KnowledgeNode[];
  subjectAnnotations: Annotation[];

  // ── Knowledge setters ──
  setActiveView: Dispatch<SetStateAction<WorkspaceView>>;
  setActiveKnowledgePanel: Dispatch<SetStateAction<KnowledgePanel>>;
  setActiveKnowledgeSubject: Dispatch<SetStateAction<string>>;
  setResourceView: Dispatch<SetStateAction<"grid" | "list">>;
  setReadingMode: Dispatch<SetStateAction<boolean>>;
  setReaderPage: Dispatch<SetStateAction<string>>;
  setReaderSearch: Dispatch<SetStateAction<string>>;
  setReaderZoom: Dispatch<SetStateAction<string>>;
  setResources: Dispatch<SetStateAction<Resource[]>>;
  setQuestions: Dispatch<SetStateAction<Question[]>>;
  setQuestionFilter: Dispatch<SetStateAction<{ subject: string; core: string; result: string; keyword: string }>>;
  setNodes: Dispatch<SetStateAction<KnowledgeNode[]>>;
  setLearningEvents: Dispatch<SetStateAction<LearningEvent[]>>;

  // ── Knowledge handlers ──
  selectKnowledgeSubject: (subjectName: string) => void;
  inferResource: (rawName: string, subjectHint: string) => ResourceInference;
  openResource: (resource: Resource) => void;
  openResourceDialog: () => void;
  closeResourceDialog: () => void;
  startUploadProgress: (file: File, inferred: ResourceInference) => void;
  startBatchUpload: (files: File[], subjectHint?: string) => Promise<void>;
  addResource: (event: FormEvent<HTMLFormElement>) => void;
  deleteResource: (item: Resource) => void;
  analyzeMaterial: (resource: Resource) => void;
  confirmPendingItem: (item: PendingItem) => void;
  dismissPendingItem: (item: PendingItem) => void;
  deleteQuestion: (item: Question) => void;
  deleteNode: (item: KnowledgeNode) => void;
  createCardFromText: (createdBy: GrowthCard["createdBy"], text: string, annotation?: Annotation) => void;
  onCreateAnnotation: (page: string, selection: string, tag: Annotation["tag"], note: string) => void;
  onEditAnnotation: (id: string, note: string) => void;
  onDeleteAnnotation: (id: string) => void;

  // ── Dashboard（今日任务）视图所需 ──
  tasks: Task[];
  agentSteps: AgentStep[];
  activeChatMessages: AgentMessage[];
  quickPrompts: string[];
  activeTimerTaskId: string;
  timerStartTime: string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTaskDone: (task: Task) => void;
  moveTask: (id: string, direction: -1 | 1) => void;
  startTask: (task: Task) => void;
  pauseTimer: (task: Task) => void;
  resumeTimer: (task: Task) => void;
  handleEndLearning: (task: Task) => void;
  openTaskDialog: (task: Task) => void;
  generatePlan: (input?: string) => void;
  runPrompt: (prompt?: string) => void;

  // ── Agent 视图（AI 学习助手 / ChatPanel）所需 ──
  chatSessions: ChatSession[];
  activeSessionId: string;
  activeSessionIdRef: { current: string };
  chatHistoryOpen: boolean;
  newChatSession: () => void;
  setChatSessions: Dispatch<SetStateAction<ChatSession[]>>;
  setActiveSessionId: Dispatch<SetStateAction<string>>;
  setChatHistoryOpen: Dispatch<SetStateAction<boolean>>;

  // ── Settings 视图所需 ──
  exam: ExamGoal;
  appSettings: AppSettings;
  setExam: Dispatch<SetStateAction<ExamGoal>>;
  setSubjects: Dispatch<SetStateAction<Subject[]>>;
  setAppSettings: Dispatch<SetStateAction<AppSettings>>;
  handleExportData: () => void;
  handleImportData: (file: File) => Promise<void>;

  // ── 学习结果记录弹窗（TaskCompletionModal）所需 ──
  activeTask: Task | null;
  masteryOptions: MasteryText[];
  moodOptions: StudyMood[];
  completionModalAllowEditTime: boolean;
  completionModalCustomEndTime: string;
  completionModalCustomMinutes: string;
  closeConfirmPending: boolean;
  completeTask: (id: string) => void;
  requestCloseTaskDialog: () => void;
  markTaskDraftDirty: (task: Task, patch: Partial<Pick<StudyDraft, "mastery" | "accuracy" | "mood" | "note" | "customMinutes" | "elapsedSeconds">>) => void;
  setCompletionModalAllowEditTime: Dispatch<SetStateAction<boolean>>;
  setCompletionModalCustomMinutes: Dispatch<SetStateAction<string>>;
  setCloseConfirmPending: Dispatch<SetStateAction<boolean>>;
}

const Ctx = createContext<WorkspaceCtx | null>(null);

export function WorkspaceProvider({ value, children }: { value: WorkspaceCtx; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
