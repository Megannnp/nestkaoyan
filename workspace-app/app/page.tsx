"use client";

import { useState, useRef, useEffect, type MouseEvent as ReactMouseEvent } from "react";
import type {
  MasteryText, StudyMood, WorkspaceView, KnowledgePanel,
  DashboardPanel, ReviewScope, ActiveDialog, DeletedBackup,
  PendingItem, Review, PlanLog, StudyDay,
  AgentStep, StudyDraft, ChatSession, CardCategory,
  StructuredReview, Material, MaterialSection,
  ExamGoal, Subject, Resource, Question, KnowledgeNode, Task, Note, GrowthCard, Annotation,
} from "./lib/types";
import { resourceToMaterial, resourceToMaterialSections } from "./lib/types";
import {
  seedAppSettings, seedQuestions, seedResources,
  CORE_NAMES, QUICK_PROMPTS, MASTERY_OPTIONS, MOOD_OPTIONS,
} from "./lib/default-data";
import { TOAST_DURATION } from "./lib/rules";
import { hydrateWorkspace, saveWorkspace, buildWorkspaceSnapshot, fetchServerWorkspace, readLocalSavedAt, fetchServerWorkspaceMeta, isServerNewerThanLocal } from "./lib/storage";
import { restoreMissingFilesFromServer, garbageCollectServerFiles, fileStorageKeysForServerGc, deletePdfFile } from "./lib/pdf-storage";
import { syncAiConfigFromServer } from "./lib/ai/chat-complete";
import { loadLearningEvents, type LearningEvent } from "./lib/events";
import { computeReplayComparison, computeProgressComparison } from "./lib/replay-console";
import { projectKnowledgeState } from "./lib/projection";
import { computeLegacyProgress } from "./lib/reducer";
import { buildReviewSubjects, reviewMinutesOf, reviewCompletedCount, reviewMasteryAverage, buildReviewAiSummary, buildStructuredReview } from "./lib/reviews";
import { migrateLegacyChat } from "./lib/chat";
import styles from "../styles/workspace.module.css";
import { Sidebar } from "./components/Sidebar";
import { MobileNav } from "./components/MobileNav";
import { ReviewPanel } from "./components/ReviewPanel";
import { ReviewDialog } from "./components/ReviewDialog";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { WorkspaceProvider, type WorkspaceCtx } from "./components/workspace-context";
import { CardsView } from "./components/CardsView";
import { KnowledgeView } from "./components/KnowledgeView";
import { DashboardTasksView } from "./components/DashboardTasksView";
import { GlobalResourceUploadModal } from "./components/GlobalResourceUploadModal";
import { AgentView } from "./components/AgentView";
import { SettingsView } from "./components/SettingsView";
import LoginOverlay from "./components/LoginOverlay";
import { TaskCompletionModal } from "./components/TaskCompletionModal";
import { buildHeatmapDays, formatHeatmapStart, monBasedOffsetOf, buildHeatmapGrid, buildHeatmapDayLabels, countCardsByDate } from "./lib/heatmap";
import { today, dateOnly, normalizeExamGoal } from "./lib/utils";
import { useWorkspaceHandlers } from "./use-workspace-handlers";

const quickPrompts = QUICK_PROMPTS;
const masteryOptions: MasteryText[] = [...MASTERY_OPTIONS];
// 2026-08-05 产品需求：七核根据真题动态生成
const moodOptions: StudyMood[] = [...MOOD_OPTIONS];
// 2026-08-05 产品需求：七核根据历年真题动态生成，不再是写死内容。
const fallbackCoreNames = CORE_NAMES;

export default function Home() {
  const [activeView, setActiveView] = useState<WorkspaceView>("dashboard");
  const [activeKnowledgePanel, setActiveKnowledgePanel] = useState<KnowledgePanel>("landing");
  const [activeDashboardPanel, setActiveDashboardPanel] = useState<DashboardPanel>("tasks");
  const [reviewScope, setReviewScope] = useState<ReviewScope>("日复盘");
  const [activeReviewSubject, setActiveReviewSubject] = useState("全部科目");
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [activeTaskId, setActiveTaskId] = useState("");
  const [activeTimerTaskId, setActiveTimerTaskId] = useState("");
  const [lastDeleted, setLastDeleted] = useState<DeletedBackup | null>(null);
  // ─── Onboarding：首屏初始化向导 ───
  // onboardingCompleted 持久化；bootChecked 仅客户端，用于判定是否新用户（避免 SSR 闪现）
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [bootChecked, setBootChecked] = useState(false);
  const [appReady, setAppReady] = useState(false);
  // 私有部署访问密码门（KAOYAN_AUTH=1 且未授权时显示登录遮罩）
  const [authGate, setAuthGate] = useState<{ required: boolean; ok: boolean }>({ required: false, ok: true });
  // 多设备新鲜度：服务端快照比本机更新时提示（防止静默覆盖其他设备的数据）
  const [serverNewer, setServerNewer] = useState(false);
  // ─── Dashboard: Hydration-safe date (SSR: fixed; mount: real) ───
  // 必须在派生值（dueCards 等）之前声明，否则 TDZ ReferenceError
  const [hydratedTodayStr, setHydratedTodayStr] = useState("");
  const [hydratedDaysLeft, setHydratedDaysLeft] = useState(0);
  // 2026-08-03 用户反馈：移除虚拟数据，新用户初始状态为空白
  const [exam, setExam] = useState<ExamGoal>(() => ({
    examName: "", school: "", major: "", examDate: "", startDate: "",
    weeklyDays: "", weekdayHours: "", weekendHours: "", baseline: "",
  }));
  const [appSettings, setAppSettings] = useState(seedAppSettings);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeKnowledgeSubject, setActiveKnowledgeSubject] = useState("");
  const [activeCardSubject, setActiveCardSubject] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialSections, setMaterialSections] = useState<MaterialSection[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [cards, setCards] = useState<GrowthCard[]>([]);
  const [categories, setCategories] = useState<CardCategory[]>([]);
  const [activeCardCategory, setActiveCardCategory] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeResourceId, setActiveResourceId] = useState("");
  const [readerSearch, setReaderSearch] = useState("");
  const [readerPage, setReaderPage] = useState("");
  const [readerZoom, setReaderZoom] = useState("100%");
  const [resourceView, setResourceView] = useState<"grid" | "list">("grid");
  /** 资料库两态（2026-08-01）：false=书架页（管理与选择）；true=阅读页（Reader + 批注 + AI 学习） */
  const [readingMode, setReadingMode] = useState(false);
  const [fileUploadState, setFileUploadState] = useState<{
    name: string;
    size: number;
    inferred: ReturnType<typeof inferResource>;
    step: string;
  } | null>(null);
  const [questionFilter, setQuestionFilter] = useState({ subject: "全部", core: "全部", result: "全部", keyword: "" });
  const [studyDays, setStudyDays] = useState<StudyDay[]>([]);
  const [learningEvents, setLearningEvents] = useState<LearningEvent[]>([]);
  const [focusMode, setFocusMode] = useState(false);
  const [cardMode, setCardMode] = useState("背诵");
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  // 编辑卡片弹窗当前编辑的卡片 id（null = 新建）
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  // 正在编辑的卡片（仅编辑弹窗使用；避免卡片列表变化时闪动）
  const editingCard = editingCardId ? cards.find((c) => c.id === editingCardId) ?? null : null;
  const [cardDialogSubject, setCardDialogSubject] = useState("");
  const [cardDialogCategory, setCardDialogCategory] = useState("");
  // ─── 卡片中心：卡片组作为一级工作空间（沉淀卡片 → 卡片组 → 卡片）───
  // null = 沉淀卡片首页（仅管理/展示卡片组）；有值 = 卡片组学习空间
  const [cardSubjectView, setCardSubjectView] = useState<string | null>(null);
  // ─── 信息架构（2026-08-01 用户反馈）：拆分为【状态筛选】×【分组方式】两个独立维度 ───
  // 状态（回答「看哪些」）：待复习 / 全部 / 收藏
  const [cardFilter, setCardFilter] = useState<"待复习" | "全部" | "收藏">("待复习");
  // 分组（回答「怎么组织」）：按七核（默认，产品核心逻辑）/ 按掌握度 / 按时间
  const [cardGroupBy, setCardGroupBy] = useState<"按七核" | "按掌握度" | "按时间">("按七核");
  /** 兼容旧引用：导出当前筛选态（`cardSubView === "待复习"` → 待复习；否则全部） */
  const cardSubView = cardFilter;
  const setCardSubView = setCardFilter;
  // ─── 卡片组管理：⋯ 菜单（null=关闭；id=打开；同一时间只开一个）───
  const [cardMenuOpenId, setCardMenuOpenId] = useState<string | null>(null);
  // 重命名编辑态：正在重命名的卡片组 id（null=非编辑态）
  const [renamingCardId, setRenamingCardId] = useState<string | null>(null);
  // 重命名输入框当前值
  const [renamingCardName, setRenamingCardName] = useState("");
  // 删除确认弹窗：待删除的卡片组 id（null=关闭）
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  // 新建卡片组：折叠为按钮，点击展开输入框
  const [newCardDeckOpen, setNewCardDeckOpen] = useState(false);
  // 新建卡片组输入值
  const [newCardDeckName, setNewCardDeckName] = useState("");
  // 点击空白区域关闭卡片组 ⋯ 菜单
  useEffect(() => {
    if (!cardMenuOpenId) return;
    function onDocPointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("[data-card-deck-menu]")) return;
      setCardMenuOpenId(null);
    }
    document.addEventListener("mousedown", onDocPointerDown);
    return () => document.removeEventListener("mousedown", onDocPointerDown);
  }, [cardMenuOpenId]);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [examAnalyzing, setExamAnalyzing] = useState(false); // 真题 AI 分析进行中
  const [logs, setLogs] = useState<PlanLog[]>([
    { id: "l-1", time: today(), input: "今天只有两个小时", output: "压缩为 2 个 第 2 层任务", accepted: "已接受", dataRead: ["考试日期", "当前轮次", "高风险节点"], userRevision: "无", finalResult: "生成今日任务", rating: "未评价", rework: "0" },
  ]);
  const [review, setReview] = useState<Review>({ done: "", hard: "", load: "刚好", tomorrow: "3 小时", priority: "" });
  // ─── P4 Phase 1: 复盘历史记录（结构化解析结果；提交复盘时追加）───
  const [structuredReviews, setStructuredReviews] = useState<StructuredReview[]>([]);
  // ─── UX Sprint: 学习结束流程草稿（自动保存 + 关闭确认 + 再次进入恢复）───
  const [studyDraft, setStudyDraft] = useState<StudyDraft | null>(null);
  // 关闭确认弹窗：pending 为 true 时显示「继续编辑 / 放弃退出」
  const [closeConfirmPending, setCloseConfirmPending] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [notice, setNotice] = useState("");
  // ─── UX Sprint P0: AI 助手聊天界面重构 ───
  // 聊天按 Session 管理（新建对话创建新 Session，不删除历史）
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [chatHistoryOpen, setChatHistoryOpen] = useState(false);
  // UX Sprint P0: 同步最新 activeSessionId（避免 React 批处理导致「新建对话后立即发送」读到旧值）
  const activeSessionIdRef = useRef("");
  const resourcesRef = useRef(resources);
  const materialAnalysisRunRef = useRef(0);
  const materialAnalysisTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const uploadProgressRunRef = useRef(0);
  const uploadProgressTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const memoryEngineWarningShownRef = useRef(false);
  // 当前激活会话（无会话时返回 null，ChatPanel 显示欢迎界面）
  const activeChatSession = chatSessions.find((s) => s.id === activeSessionId) ?? null;
  const activeChatMessages = activeChatSession?.messages ?? [];

  useEffect(() => {
    resourcesRef.current = resources;
  }, [resources]);

  useEffect(() => () => {
    materialAnalysisTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    materialAnalysisTimeoutsRef.current = [];
    uploadProgressTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    uploadProgressTimeoutsRef.current = [];
    materialAnalysisRunRef.current += 1;
    uploadProgressRunRef.current += 1;
  }, []);

  // --- Derived / computed values ---
  const reviewSubjects = buildReviewSubjects(subjects.map((s) => s.name));
  const reviewMinutes = reviewMinutesOf(tasks);
  const reviewCompletedTasks = reviewCompletedCount(tasks);
  const reviewMasteryDelta = reviewMasteryAverage(nodes);
  const reviewAiSummary = buildReviewAiSummary(tasks, nodes);
  const subjectCards = cards.filter((card) => card.subject === activeCardSubject);
  const dueCards = subjectCards.filter((card) => card.mastery === "不会" || card.mastery === "模糊" || card.lastReviewed === "未复习" || !card.nextReviewAt || card.nextReviewAt <= hydratedTodayStr);
  // UX Sprint: 当前学科的自定义分类（只显示当前学科，隔离其他学科分类）
  const subjectCategories = categories.filter((cat) => {
    const subject = subjects.find((s) => s.name === activeCardSubject);
    return subject ? cat.subjectId === subject.id : false;
  });
  const cardDialogSubjectRecord = subjects.find((s) => s.name === cardDialogSubject);
  const cardDialogSubjectCategories = categories.filter((cat) => cardDialogSubjectRecord ? cat.subjectId === cardDialogSubjectRecord.id : false);
  // 分类概览统计（卡片数量 + 待复习数量）
  const categoryStats = subjectCategories.map((cat) => {
    const catCards = cards.filter((c) => c.subject === activeCardSubject && c.categoryId === cat.id);
    const due = catCards.filter((c) => c.mastery === "不会" || c.mastery === "模糊" || c.lastReviewed === "未复习" || !c.nextReviewAt || c.nextReviewAt <= hydratedTodayStr);
    return { category: cat, total: catCards.length, due: due.length };
  });
  // 未分类特殊标记（非真实分类 id）
  const UNCATEGORIZED = "__uncategorized";
  // 全部卡片虚拟组（非真实分类 id，点击「开始复习」进入该学科全部卡片）
  const ALL_GROUPS = "__all";
  const uncategorizedCards = cards.filter((c) => c.subject === activeCardSubject && !c.categoryId);
  const activeCategoryName = activeCardCategory
    ? activeCardCategory === ALL_GROUPS
      ? "全部卡片"
      : subjectCategories.find((c) => c.id === activeCardCategory)?.name ?? "未分类"
    : "";

  // 当前学科进入某卡片组后的卡片列表（未分类 → 无 categoryId；真实分类 → 匹配 categoryId；全部卡片 → 该学科全部）
  const currentCategoryCards = activeCardCategory
    ? activeCardCategory === UNCATEGORIZED
      ? cards.filter((c) => c.subject === activeCardSubject && !c.categoryId)
      : activeCardCategory === ALL_GROUPS
        ? cards.filter((c) => c.subject === activeCardSubject)
        : cards.filter((c) => c.subject === activeCardSubject && c.categoryId === activeCardCategory)
    : [];
  const visibleCategoryCards = cardFilter === "收藏"
    ? currentCategoryCards.filter((card) => card.favorite)
    : currentCategoryCards;
  const uncategorizedCardCount = uncategorizedCards.length;
  // 进入卡片组后只在该卡片组范围内复习（待复习优先）
  const categoryQueueCards = currentCategoryCards.filter((c) => c.mastery === "不会" || c.mastery === "模糊" || c.lastReviewed === "未复习" || !c.nextReviewAt || c.nextReviewAt <= hydratedTodayStr);
  const categoryReviewQueue = categoryQueueCards.length ? categoryQueueCards : currentCategoryCards;
  // 卡片组队列变化时把 index 夹在有效范围内（分类/全部卡片独立于学科总队列）
  const categoryClampedCardIndex = Math.min(Math.max(cardIndex, 0), Math.max(categoryReviewQueue.length - 1, 0));
  const activeGroupCard = categoryReviewQueue[categoryClampedCardIndex] ?? null;
  const subjectResources = resources.filter((resource) => resource.subject === activeKnowledgeSubject);
  // 2026-08-05 产品需求：七核根据历年真题动态生成（非写死）
  const coreNames = Array.from(new Set(questions.filter((q) => q.subject === activeKnowledgeSubject && q.core).map((q) => q.core)));
  const effectiveCoreNames = coreNames.length > 0 ? coreNames : fallbackCoreNames;
  // UX Sprint（学科隔离）: activeResource 只在当前学科资源内查找，禁止跨学科回退到其他科目
  const activeResource = subjectResources.find((resource) => resource.id === activeResourceId) ?? subjectResources[0] ?? null;
  const subjectQuestions = questions.filter((question) => question.subject === activeKnowledgeSubject);
  const subjectNodes = nodes.filter((node) => node.subject === activeKnowledgeSubject);
  const subjectAnnotations = annotations.filter((annotation) => subjectResources.some((resource) => resource.id === annotation.resourceId));
  const relatedQuestions = questions.filter((question) => activeResource && question.subject === activeResource.subject && (activeResource.linkedNode.includes(question.core) || activeResource.linkedNode.includes(question.branch)));
  // UX Sprint（学科隔离）: 真题查询默认锁定当前学科，不允许跨学科展示
  const effectiveQuestionSubject = questionFilter.subject === "全部" ? activeKnowledgeSubject : questionFilter.subject;
  const filteredQuestions = questions.filter((question) => {
    const bySubject = question.subject === effectiveQuestionSubject;
    const byCore = questionFilter.core === "全部" || question.core === questionFilter.core;
    const byResult = questionFilter.result === "全部" || question.result === questionFilter.result;
    const byKeyword = !questionFilter.keyword || `${question.stem}${question.knowledge}${question.year}`.includes(questionFilter.keyword);
    return bySubject && byCore && byResult && byKeyword;
  });
  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? null;
  const currentSubject = subjects.find((subject) => subject.name === activeKnowledgeSubject) ?? subjects[0];

  // ─── Dashboard: Timer state & refs ───
  // 计时基于墙钟时间戳（timerRunStartEpoch），而非累加 tick，
  // 避免标签页后台时 setInterval 被节流导致时长少算；刷新后可按时间戳恢复。
  const [timerStartTime, setTimerStartTime] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerAccumSeconds, setTimerAccumSeconds] = useState(0); // 之前已计入的段落秒数
  const [timerRunStartEpoch, setTimerRunStartEpoch] = useState(0); // 当前运行段起点 ms；0=未运行
  const timerIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // ─── Dashboard: Completion modal state ───
  const [completionModalAllowEditTime, setCompletionModalAllowEditTime] = useState(false);
  const [completionModalCustomMinutes, setCompletionModalCustomMinutes] = useState("");
  const [completionModalCustomEndTime, setCompletionModalCustomEndTime] = useState("--");

  // ─── Sidebar heatmap tooltip（Sidebar 已实现渲染，此处补上父级状态与定位）───
  const heatmapRef = useRef<HTMLDivElement | null>(null);
  const [tooltipData, setTooltipData] = useState<{ date: string; top: number; left: number; above: boolean } | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  function onCellMouseEnter(event: ReactMouseEvent<Element>, date: string) {
    const aside = heatmapRef.current?.closest("aside");
    if (!aside) return;
    const cell = event.currentTarget.getBoundingClientRect();
    const box = aside.getBoundingClientRect();
    const left = Math.min(cell.left - box.left + aside.scrollLeft, box.width - 200);
    const top = cell.top - box.top + aside.scrollTop - 46;
    setTooltipData({ date, top, left: Math.max(4, left), above: true });
    setTooltipVisible(true);
  }
  function onCellMouseLeave() {
    setTooltipVisible(false);
  }
  function onCellClick(event: ReactMouseEvent<Element>, date: string) {
    onCellMouseEnter(event, date);
    setActiveView("dashboard");
    setActiveDashboardPanel("review");
    const day = studyDays.find((item) => item.date === date);
    setNotice(day
      ? `已打开 ${date} 的复盘记录（完成 ${day.completed} 项 · ${day.minutes} 分钟）`
      : `${date} 暂无学习记录`);
  }

  // ─── Dashboard: Hydration effect ───
  // 挂载后把 SSR 占位替换为真实日期/倒计时（标准 hydration 模式，需在 effect 内 setState）
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setHydratedTodayStr(dateOnly());
    // 2026-08-18 修复：初始 exam.examDate 为空字符串时 new Date("").getTime()=NaN，
    // Math.max(0, NaN)=NaN → 侧栏渲染「NaN天」并触发 React「Received NaN」告警。
    // 无效日期兜底为 0 天（用户设置考试日期后 effect 随依赖变化重新计算）。
    const examDateMs = new Date(exam.examDate).getTime();
    setHydratedDaysLeft(Number.isNaN(examDateMs)
      ? 0
      : Math.max(0, Math.ceil((examDateMs - Date.now()) / 86400000)));
  }, [exam.examDate]);

  // ─── LearningEvent: load v4 events on mount (Sprint 1 / Phase A) ───
  useEffect(() => {
    setLearningEvents(loadLearningEvents());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ─── Sprint 2A/2B-1: 开发模式 Replay + Progress 对照（仅 console，不接 UI）───
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const summary = computeReplayComparison(learningEvents, nodes);
    if (summary.warnings > 0 && !memoryEngineWarningShownRef.current) {
      memoryEngineWarningShownRef.current = true;
      console.warn(`[MemoryEngine] ${summary.warnings} 个节点投影与当前状态存在差异（Sprint 2A 观察期，不影响 UI）`);
    }
    // Sprint 2B-1: Legacy vs Projected Dashboard Progress 对照
    const states = projectKnowledgeState(learningEvents, nodes);
    const confirmedQuestions = questions.filter((q) => q.confirmed).length;
    const indexedResources = resources.filter((r) => r.status === "已索引").length;
    computeProgressComparison(states, subjects, {
      nodeMasteryScores: nodes.map((n) => n.masteryScore),
      confirmedQuestions,
      totalQuestions: questions.length,
      indexedResources,
      totalResources: resources.length,
    });
  }, [learningEvents, nodes, subjects, questions, resources]);

  // ─── Storage Contract 1C-1: 唯一 save 入口（防抖持久化，避免每次按键都全量序列化写盘 #3）───
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latestSnapshotRef = useRef<string>("");
  useEffect(() => {
    if (!appReady) return;
    latestSnapshotRef.current = JSON.stringify(buildWorkspaceSnapshot({
      exam, appSettings, subjects, activeKnowledgeSubject, activeCardSubject,
      resources, materials, materialSections, questions, nodes, tasks, pending, notes, cards, annotations,
      activeResourceId, readerSearch, readerPage, readerZoom,
      studyDays, agentSteps, logs, chatSessions, activeSessionId, review, structuredReviews, studyDraft,
      categories, onboardingCompleted,
      timer: { activeTimerTaskId, timerStartTime, timerAccumSeconds, timerRunStartEpoch },
    }));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      // saveWorkspace 失败 → 不覆盖已有数据（符合 Failure Policy：写失败保留内存 State，提示用户）
      const ok = saveWorkspace(JSON.parse(latestSnapshotRef.current) as ReturnType<typeof buildWorkspaceSnapshot>);
      if (!ok) console.warn("[Storage] 写入失败（可能配额已满），数据保留在内存中");
    }, 400);
  }, [exam, appSettings, subjects, activeKnowledgeSubject, activeCardSubject,
      resources, materials, materialSections, questions, nodes, tasks, pending, notes, cards, annotations,
      activeResourceId, readerSearch, readerPage, readerZoom,
      studyDays, agentSteps, logs, chatSessions, activeSessionId, review, structuredReviews, studyDraft, categories,
      onboardingCompleted,
      activeTimerTaskId, timerStartTime, timerAccumSeconds, timerRunStartEpoch, appReady]);

  // 卸载 / 切后台时立即落盘，避免防抖窗口内的改动丢失
  useEffect(() => {
    function flush() {
      if (!latestSnapshotRef.current) return;
      saveWorkspace(JSON.parse(latestSnapshotRef.current) as ReturnType<typeof buildWorkspaceSnapshot>);
    }
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", flush);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      flush();
    };
  }, []);

  // ─── Sync active subjects when subjects change ───
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (subjects.length && !subjects.some((s) => s.name === activeKnowledgeSubject))
      setActiveKnowledgeSubject(subjects[0].name);
    if (subjects.length && !subjects.some((s) => s.name === activeCardSubject))
      setActiveCardSubject(subjects[0].name);
  }, [subjects, activeKnowledgeSubject, activeCardSubject]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ─── P4 Phase 1: 提交复盘 → 由规则引擎解析并追加到历史记录 ───
  // 使用 reviews.buildStructuredReview（内部复用 memory-rules.extractReviewFields 规则）
  const handleReviewSubmit = () => {
    // P2 交互修复（深入审查 2026-08-01）：无内容时不产生空复盘记录
    const structured = buildStructuredReview(review);
    if (!structured) {
      setNotice("请至少填写「完成了什么」或「最困难的部分」");
      return;
    }
    setStructuredReviews((items) => [structured, ...items]);
    setNotice("复盘已保存并加入历史记录");
    setActiveDialog(null);
  };

  // ─── Toast 自动消失（notice 之前从未被渲染，现补上可见反馈 + 自动清除）───
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [notice]);

  // ─── 删除撤销窗口：约 8 秒后关闭撤销入口，资源文件等窗口结束再清理 ───
  useEffect(() => {
    if (!lastDeleted) return;
    const timer = setTimeout(() => {
      if (lastDeleted.collection === "resources" && lastDeleted.item.fileStorageKey && lastDeleted.item.kind !== "demo") {
        void deletePdfFile(lastDeleted.item.fileStorageKey);
      }
      setLastDeleted(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [lastDeleted]);

  // ─── Heatmap derived values（纯计算抽到 lib/heatmap.ts）───
  const confirmedQuestions = questions.filter((q) => q.confirmed).length;
  const heatmapStart = exam.examGoalCreatedAt ?? hydratedTodayStr;
  const heatmapEnd = exam.examDate >= hydratedTodayStr ? exam.examDate : hydratedTodayStr;
  const { days: heatmapDays } = buildHeatmapDays(heatmapStart, heatmapEnd, studyDays);
  const heatmapStartFormatted = formatHeatmapStart(heatmapStart);
  const monBasedOffset = monBasedOffsetOf(heatmapStart);
  const { grid: heatmapGrid, months: heatmapMonths } = buildHeatmapGrid(heatmapDays, monBasedOffset);
  const todayStr = hydratedTodayStr;
  const dayLabels = buildHeatmapDayLabels();
  const cardsByDate = countCardsByDate(cards);

  // --- Computed values for Sidebar ---
  const daysLeft = hydratedDaysLeft;
  const totalTargetScore = subjects.reduce(
    (sum, subject) => sum + Number(subject.targetScore || 0),
    0
  );
  const overallProgress = computeLegacyProgress(
    nodes.map((node) => node.masteryScore),
    confirmedQuestions,
    questions.length,
    resources.filter((r) => r.status === "已索引").length,
    resources.length
  );

  // ─── 业务 handlers 抽到 use-workspace-handlers.ts（行为等价，经 deps 注入 state/派生值）───
  const {
    newChatSession, pushAssistant, restoreLastDeleted, handleExportData, handleImportData, completeOnboarding, selectKnowledgeSubject, inferResource, openResource, openResourceDialog, closeResourceDialog, startUploadProgress, startBatchUpload, addResource, confirmPendingItem, dismissPendingItem, deleteResource, onCreateAnnotation, onEditAnnotation, onDeleteAnnotation, deleteQuestion, deleteNode, addCategoryInline, moveCardToCategory, reviewCard, moveCard, openNewCardDialog, openEditCardDialog, createCardFromText, deleteCard, openCardSource, showRelatedQuestions, updateTask, toggleTaskDone, moveTask, runTimerFrom, startTask, pauseTimer, resumeTimer, handleEndLearning, openTaskDialog, markTaskDraftDirty, requestCloseTaskDialog, completeTask, generatePlan, analyzeMaterial, runPrompt,
  } = useWorkspaceHandlers({
    ALL_GROUPS, UNCATEGORIZED, activeCardCategory, setActiveCardCategory, activeCardSubject, setActiveCardSubject, activeGroupCard, activeKnowledgePanel, setActiveKnowledgePanel, activeKnowledgeSubject, setActiveKnowledgeSubject, activeResource, activeSessionIdRef, activeTaskId, setActiveTaskId, activeView, setActiveView, cardFlipped, setCardFlipped, cardSubView, setCardSubView, cardSubjectView, setCardSubjectView, cards, setCards, categories, setCategories, categoryReviewQueue, chatInput, setChatInput, completionModalAllowEditTime, setCompletionModalAllowEditTime, completionModalCustomMinutes, setCompletionModalCustomMinutes, currentSubject, elapsedSeconds, setElapsedSeconds, exam, setExam, examAnalyzing, setExamAnalyzing, lastDeleted, setLastDeleted, materialAnalysisRunRef, materialAnalysisTimeoutsRef, materialSections, setMaterialSections, newCardDeckName, setNewCardDeckName, nodes, setNodes, questions, setQuestions, resources, setResources, resourcesRef, setActiveDialog, setActiveResourceId, setActiveSessionId, setActiveTimerTaskId, setAgentSteps, setAnnotations, setCardDialogCategory, setCardDialogSubject, setCardIndex, setChatHistoryOpen, setChatSessions, setCloseConfirmPending, setCompletionModalCustomEndTime, setEditingCardId, setFileUploadState, setLearningEvents, setLogs, setMaterials, setNewCardDeckOpen, setNotes, setNotice, setOnboardingCompleted, setPending, setQuestionFilter, setReaderPage, setStructuredReviews, setStudyDays, setStudyDraft, setSubjects, setTasks, setTimerAccumSeconds, setTimerRunStartEpoch, setTimerStartTime, studyDraft, subjectCategories, subjects, tasks, timerAccumSeconds, timerIntervalRef, timerRunStartEpoch, uploadProgressRunRef, uploadProgressTimeoutsRef, appSettings, materials, pending, notes, annotations, studyDays, agentSteps, logs, chatSessions, activeSessionId, review, structuredReviews,
  
  });

  // 访问密码门：检查 /api/auth/status；未授权（非本机 + 无 session）时显示登录遮罩
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        const enabled = body?.authEnabled === true;
        setAuthGate({ required: enabled, ok: enabled ? body?.authorized === true : true });
      })
      .catch(() => {
        if (!cancelled) setAuthGate({ required: false, ok: true });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Storage Contract 1C-1: 唯一 hydrate 入口（v5 优先；v3/v4 自动迁移，可回滚）───
  // 置于 useWorkspaceHandlers 之后：内部使用 runTimerFrom（若在 handlers 声明前调用会 TDZ）
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const data = hydrateWorkspace();
    setBootChecked(true);
    if (!data) {
      // 本地无存档：尝试从服务端 SQLite/D1 恢复（换浏览器/换设备场景；失败则静默进入新用户）
      fetchServerWorkspace().then((remote) => {
        if (remote) {
          // 已写入 localStorage → 整页重载走正常 hydrate 路径（与「导入数据」恢复方式一致）
          window.location.reload();
          return;
        }
        requestAnimationFrame(() => requestAnimationFrame(() => setAppReady(true)));
      });
      return; // 无任何存档 → 新用户，onboardingCompleted 保持 false → 显示初始化向导
    }
    try {
      // ─── 2026-08-03 时间修复：检测旧演示存档的 seed 日期 ───
      // 早期 demo 曾把固定日期（2026-12-20 / 2026-07-30）写入存档，
      // 导致用户看到错误的倒计时/热力图。检测到这类 seed 值 → 视为无效存档，
      // 重置为新用户并重新走初始化向导（真实用户的考试日期不会是这些 seed 值）。
      if (data.exam) {
        const seedExamDate = data.exam.examDate;
        const seedCreated = data.exam.examGoalCreatedAt;
        const isLegacyDemoSeed = seedExamDate === "2026-12-20" || seedCreated === "2026-07-30";
        // 2026-08-04 修复：仅对「未完成引导的旧 demo 存档」重置为新用户。
        // 若存档已显式完成引导（onboardingCompleted=true，如 E2E 种子），
        // 不触发重置——避免已引导用户被误判为无效存档，也避免测试种子被拦截。
        if (isLegacyDemoSeed && !data.onboardingCompleted) {
          setOnboardingCompleted(false);
          return;
        }
        setExam(normalizeExamGoal(data.exam));
      }
      // 老用户（已有存档但无该字段）默认视为已完成，不再弹向导
      setOnboardingCompleted(data.onboardingCompleted ?? true);
      if (data.appSettings) setAppSettings(data.appSettings);
      if (data.subjects) setSubjects(data.subjects);
      if (data.activeKnowledgeSubject) setActiveKnowledgeSubject(data.activeKnowledgeSubject);
      if (data.activeCardSubject) setActiveCardSubject(data.activeCardSubject);
      if (data.resources) setResources(data.resources);
      // SQLite/D1 同步模式：拉回缺失的 PDF/文本二进制（换浏览器/清缓存后自动恢复）
      if (data.resources?.length) {
        void restoreMissingFilesFromServer(data.resources);
        // 服务端孤儿文件 GC（崩溃残留/删除镜像失败兜底）
        void garbageCollectServerFiles(fileStorageKeysForServerGc(data.resources));
      }
      // AI 网关配置跨设备拉取（本机未配置时从服务端取回）
      void syncAiConfigFromServer();
      // 多设备新鲜度：服务端快照更新于本地（含容差）→ 提示用户选择载入（防止静默覆盖）
      const localSavedAt = readLocalSavedAt();
      if (localSavedAt) {
        void fetchServerWorkspaceMeta().then((meta) => {
          if (!meta?.updatedAt) return;
          if (isServerNewerThanLocal(localSavedAt, meta.updatedAt)) setServerNewer(true);
        });
      }
      if (data.materials && Array.isArray(data.materials)) {
        setMaterials(data.materials);
      } else if (data.resources?.length) {
        setMaterials(data.resources.map((resource) => resourceToMaterial(
          resource,
          data.subjects?.find((subject) => subject.name === resource.subject)?.id ?? resource.subject,
        )));
      }
      if (data.materialSections && Array.isArray(data.materialSections)) {
        setMaterialSections(data.materialSections);
      } else if (data.resources?.length) {
        setMaterialSections(data.resources.flatMap((resource) => resourceToMaterialSections(resource, data.questions ?? [])));
      }
      if (data.questions) setQuestions(data.questions);
      // 2026-08-06 产品需求：老用户加载存档时也注入内置真题（政治/英语一/数学二，与 completeOnboarding 保持一致）
      const hydSubjectNames = ((data.subjects ?? []) as { name: string }[]).map((s) => s.name);
      const hydHasPolitics = hydSubjectNames.some((name) => name.includes("政治"));
      const hydHasEnglish = hydSubjectNames.some((name) => name.includes("英语"));
      const hydHasMath = hydSubjectNames.some((name) => name.includes("数学"));
      const hydSeedPapers = seedResources.filter((r) =>
        r.type === "真题"
        && ((hydHasPolitics && r.subject === "政治") || (hydHasEnglish && r.subject === "英语一") || (hydHasMath && r.subject === "数学二"))
      );
      const hydExistingResourceIds = ((data.resources ?? []) as { id: string }[]).map((r) => r.id);
      const hydMissingPapers = hydSeedPapers.filter((p) => !hydExistingResourceIds.includes(p.id));
      if (hydMissingPapers.length > 0) {
        setResources((items) => [...hydMissingPapers, ...items]);
        const hydQuestions = seedQuestions.filter((q) =>
          !((data.questions ?? []) as { id: string }[]).some((ex) => ex.id === q.id)
          && seedResources.some((r) => r.id === q.materialId && hydMissingPapers.some((p) => p.id === r.id))
        );
        setQuestions((items) => [...hydQuestions, ...items]);
      }
      if (data.nodes) setNodes(data.nodes);
      if (data.tasks) setTasks(data.tasks);
      if (data.pending) setPending(data.pending);
      if (data.notes) setNotes(data.notes);
      if (data.cards) setCards(data.cards);
      // UX Sprint: 恢复自定义分类（按 subjectId 隔离，不跨学科）
      if (data.cardCategories && Array.isArray(data.cardCategories)) setCategories(data.cardCategories);
      if (data.annotations) setAnnotations(data.annotations);
      if (data.activeResourceId) setActiveResourceId(data.activeResourceId);
      if (data.readerSearch) setReaderSearch(data.readerSearch);
      if (data.readerPage) setReaderPage(data.readerPage);
      if (data.readerZoom) setReaderZoom(data.readerZoom);
      if (data.studyDays) setStudyDays(data.studyDays);
      if (data.agentSteps) setAgentSteps(data.agentSteps);
      if (data.logs) setLogs(data.logs);
      // UX Sprint P0: 兼容历史数据（旧 chat 数组）→ 迁移为单一 ChatSession（不丢失历史）
      if (data.chatSessions && Array.isArray(data.chatSessions) && data.chatSessions.length > 0) {
        const restoredSessionId = data.activeSessionId || data.chatSessions[0].id;
        setChatSessions(data.chatSessions);
        setActiveSessionId(restoredSessionId);
        activeSessionIdRef.current = restoredSessionId;
      } else if (data.chat) {
        const legacySession = migrateLegacyChat(data.chat);
        if (legacySession) {
          setChatSessions([legacySession]);
          setActiveSessionId(legacySession.id);
          activeSessionIdRef.current = legacySession.id;
        }
      }
      // Stabilization 1B-1: 恢复已保存的复盘（刷新后再打开 ReviewDialog 可见）
      if (data.review) setReview(data.review);
      // P4 Phase 1: 恢复复盘历史记录（提交后刷新仍可见）
      if (data.structuredReviews && Array.isArray(data.structuredReviews)) setStructuredReviews(data.structuredReviews);
      // UX Sprint: 恢复学习结束草稿（关闭/刷新/切换页面均不丢失，保存并完成后才清空）
      if (data.studyDraft && data.studyDraft.taskId) setStudyDraft(data.studyDraft);
      // 恢复正在进行的计时（#7）：运行中的段落按持久化的墙钟起点无缝续计
      if (data.timer && data.timer.activeTimerTaskId) {
        setActiveTimerTaskId(data.timer.activeTimerTaskId);
        setTimerStartTime(data.timer.timerStartTime || "");
        const accum = Number(data.timer.timerAccumSeconds || 0);
        const startEpoch = Number(data.timer.timerRunStartEpoch || 0);
        if (startEpoch > 0) {
          runTimerFrom(accum, startEpoch);
        } else {
          setTimerAccumSeconds(accum);
          setElapsedSeconds(accum);
        }
      }
    } catch (err) {
      // hydrateWorkspace 已在内部备份损坏原始串；此处仅记录，不清除任何 key
      console.error("[Storage] hydrate 失败", err);
    } finally {
      requestAnimationFrame(() => requestAnimationFrame(() => setAppReady(true)));
    }
    // 仅在挂载时从 localStorage 恢复一次；runTimerFrom 为稳定语义，无需列入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const workspaceCtx: WorkspaceCtx = {
    coreNames: effectiveCoreNames, UNCATEGORIZED, ALL_GROUPS,
    subjects, activeCardSubject, cardSubjectView, activeCategoryName, activeCardCategory,
    categories, subjectCategories, subjectCards, dueCards, categoryStats, uncategorizedCardCount,
    newCardDeckOpen, newCardDeckName, cardFilter, cardGroupBy, cardMode,
    categoryReviewQueue, activeGroupCard, categoryClampedCardIndex, cardFlipped, focusMode,
    visibleCategoryCards, hydratedTodayStr,
    renamingCardId, renamingCardName, deletingCardId,
    activeDialog, editingCard,
    cardDialogCategory, cardDialogSubject, cardDialogSubjectCategories, nodes, activeResource, currentSubject,
    setActiveCardSubject, setCardSubjectView, setActiveCardCategory, setCardIndex, setCardFlipped,
    setCardSubView, setRenamingCardId, setRenamingCardName, setCardMenuOpenId, setDeletingCardId,
    setNewCardDeckOpen, setNewCardDeckName, setCardFilter, setCardGroupBy, setCardMode, setFocusMode,
    setCards, setCategories, setNotice, setEditingCardId, setActiveDialog, setCardDialogCategory, setCardDialogSubject,
    openNewCardDialog, addCategoryInline, moveCard, reviewCard, openCardSource, showRelatedQuestions,
    moveCardToCategory, openEditCardDialog, deleteCard, pushAssistant,
    // Knowledge
    activeView, activeKnowledgePanel, activeKnowledgeSubject, resourceView, readingMode,
    readerPage, readerSearch, readerZoom, examAnalyzing, elapsedSeconds, fileUploadState,
    questionFilter, pending, filteredQuestions, relatedQuestions,
    resources, materials, materialSections, subjectResources, subjectQuestions, subjectNodes, subjectAnnotations,
    setActiveView, setActiveKnowledgePanel, setActiveKnowledgeSubject, setResourceView, setReadingMode,
    setReaderPage, setReaderSearch, setReaderZoom, setResources, setQuestions, setQuestionFilter,
    setNodes, setLearningEvents,
    selectKnowledgeSubject, inferResource, openResource, openResourceDialog, closeResourceDialog,
    startUploadProgress, startBatchUpload, addResource, deleteResource, analyzeMaterial,
    confirmPendingItem, dismissPendingItem, deleteQuestion, deleteNode, createCardFromText,
    onCreateAnnotation, onEditAnnotation, onDeleteAnnotation,
    // Dashboard tasks
    tasks, agentSteps, activeChatMessages, quickPrompts, activeTimerTaskId, timerStartTime,
    updateTask, toggleTaskDone, moveTask, startTask, pauseTimer, resumeTimer, handleEndLearning,
    openTaskDialog, generatePlan, runPrompt,
    // Agent + Settings
    chatSessions, activeSessionId, activeSessionIdRef, chatHistoryOpen,
    newChatSession, setChatSessions, setActiveSessionId, setChatHistoryOpen,
    exam, appSettings, setExam, setSubjects, setAppSettings, handleExportData, handleImportData,
    // Task completion modal
    activeTask, masteryOptions, moodOptions,
    completionModalAllowEditTime, completionModalCustomEndTime, completionModalCustomMinutes, closeConfirmPending,
    completeTask, requestCloseTaskDialog, markTaskDraftDirty,
    setCompletionModalAllowEditTime, setCompletionModalCustomMinutes, setCloseConfirmPending,
  };

  return (
    <WorkspaceProvider value={workspaceCtx}>
    <main>
      {authGate.required && !authGate.ok && (
        <LoginOverlay onSuccess={() => window.location.reload()} />
      )}
      {serverNewer && (
        <div
          role="dialog"
          aria-label="检测到服务端更新"
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30"
        >
          <div className="max-w-sm w-full rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold mb-2">检测到其他设备有更新的数据</h3>
            <p className="text-sm text-gray-600 mb-4">
              服务端快照比本机更新（可能来自另一台设备）。载入服务端版本后，本机未同步的本地改动将被服务端数据覆盖。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setServerNewer(false)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700"
              >
                保留本地
              </button>
              <button
                type="button"
                onClick={() => {
                  void fetchServerWorkspace().then((s) => {
                    if (s) window.location.reload();
                  });
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-700 text-sm text-white"
              >
                载入服务端
              </button>
            </div>
          </div>
        </div>
      )}
      {!appReady && (
        <div
          aria-label="应用初始化中"
          className="fixed inset-0 z-[9999] bg-white/30"
          data-testid="app-loading-guard"
        />
      )}
      <Sidebar
        daysLeft={daysLeft} exam={exam} totalTargetScore={totalTargetScore} overallProgress={overallProgress}
        heatmapStartFormatted={heatmapStartFormatted} heatmapMonths={heatmapMonths} dayLabels={dayLabels} heatmapGrid={heatmapGrid}
        todayStr={todayStr} examDate={exam.examDate} tooltipData={tooltipData} tooltipVisible={tooltipVisible}
        heatmapDays={heatmapDays} cardsByDate={cardsByDate}
        activeView={activeView} setActiveView={setActiveView}
        heatmapRef={heatmapRef}
        onCellMouseEnter={onCellMouseEnter} onCellMouseLeave={onCellMouseLeave} onCellClick={onCellClick}
        setTooltipVisible={setTooltipVisible} setTooltipData={setTooltipData}
      />
      {/* 移动端（<lg）底部导航：Sidebar 在 <1024px 隐藏，需独立导航入口（2026-08-19） */}
      <MobileNav activeView={activeView} setActiveView={setActiveView} />

      <div className={styles.mainContent} data-testid={appReady ? "app-ready" : "app-booting"} aria-busy={!appReady}>
        {/* ─── Dashboard ─── */}
        {activeView === "dashboard" && (
          <div className="flex items-center gap-2 mb-4">
            <button
              className={`min-h-[34px] px-4 rounded-[8px] font-bold text-[13px] ${activeDashboardPanel === "tasks" ? "bg-[#18181B] text-white" : "bg-[#F4F4F5] text-[#18181B]"}`}
              onClick={() => setActiveDashboardPanel("tasks")}
            >
              今日任务
            </button>
            <button
              className={`min-h-[34px] px-4 rounded-[8px] font-bold text-[13px] ${activeDashboardPanel === "review" ? "bg-[#18181B] text-white" : "bg-[#F4F4F5] text-[#18181B]"}`}
              onClick={() => setActiveDashboardPanel("review")}
            >
              今日复盘
            </button>
          </div>
        )}

        {activeView === "dashboard" && activeDashboardPanel === "tasks" && <DashboardTasksView />}

        {/* ─── Agent 独立页面（Conversation UX v2: 三栏固定布局）─── */}
        {activeView === "agent" && <AgentView />}

        {/* Dashboard - Review Panel */}
        {activeView === "dashboard" && activeDashboardPanel === "review" && (
          <ReviewPanel
            reviewScope={reviewScope} setReviewScope={setReviewScope}
            activeReviewSubject={activeReviewSubject} setActiveReviewSubject={setActiveReviewSubject}
            reviewSubjects={reviewSubjects}
            reviewMinutes={reviewMinutes} reviewTasks={tasks}
            reviewCompletedTasks={reviewCompletedTasks}
            reviewMasteryDelta={reviewMasteryDelta} reviewAiSummary={reviewAiSummary}
            structuredReviews={structuredReviews}
            onOpenReviewDialog={() => setActiveDialog("review")}
          />
        )}

        {/* ─── Knowledge Center ─── */}
        {activeView === "knowledge" && <KnowledgeView />}

        {/* ─── Growth Cards 卡片中心（卡片组作为一级工作空间：沉淀卡片 → 卡片组 → 卡片）─── */}
        {activeView === "cards" && <CardsView />}

        {/* Settings Panel */}
        {activeView === "settings" && <SettingsView />}

        {/* ─── 全局上传资料弹窗（任意视图可用，不跳转；知识中心内仍用其内置的真题专用弹窗） ─── */}
        {activeDialog === "resource" && activeView !== "knowledge" && <GlobalResourceUploadModal />}

        {/* ─── Completion Modal (Task result dialog) ─── */}
        {activeDialog === "task" && activeTask && <TaskCompletionModal />}

        {/* Review Dialog */}
        {activeDialog === "review" && (
          <ReviewDialog
            review={review} setReview={setReview}
            reviewScope={reviewScope}
            onSubmit={handleReviewSubmit}
            onClose={() => setActiveDialog(null)}
          />
        )}
      </div>

      {/* ─── 全局 Toast + 删除撤销（此前 notice / lastDeleted 均无渲染入口）─── */}
      {(notice || lastDeleted) && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[100] flex items-center gap-3 max-w-[90vw] px-4 py-2.5 rounded-[10px] bg-[#18181B] text-white shadow-lg"
        >
          {notice && <span className="text-[13px] leading-snug">{notice}</span>}
          {lastDeleted && (
            <button
              type="button"
              className="text-[12px] font-bold px-2 py-1 rounded-[6px] bg-white/15 hover:bg-white/25 shrink-0"
              onClick={restoreLastDeleted}
            >
              撤销删除
            </button>
          )}
        </div>
      )}

      {/* ─── 初始化向导（仅客户端挂载后判定；新用户无存档时显示，SSR 不渲染）─── */}
      {bootChecked && !onboardingCompleted && (
        <OnboardingWizard onComplete={completeOnboarding} />
      )}
    </main>
    </WorkspaceProvider>
  );
}
