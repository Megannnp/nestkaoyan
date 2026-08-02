"use client";

import { useState, useRef, useEffect, type FormEvent, type MouseEvent as ReactMouseEvent } from "react";
import type {
  MasteryText, StudyMood, WorkspaceView, KnowledgePanel,
  DashboardPanel, ReviewScope, ActiveDialog, DeletedBackup,
  Resource, Question, KnowledgeNode, Task,
  PendingItem, Review, PlanLog, StudyDay,
  GrowthCard, Annotation, AgentStep, StudyDraft, AgentMessage, ChatSession, CardCategory,
  StructuredReview, Material, MaterialSection
} from "./lib/types";
import { resourceToMaterial, resourceToMaterialSections } from "./lib/types";
import {
  seedExam, seedSubjects, seedResources, seedQuestions, seedNodes,
  seedTasks, seedNotes, seedCards, seedAnnotations, seedAppSettings,
  seedStudyDays, seedCardCategories, seedMaterials, seedMaterialSections
} from "./lib/default-data";
import { TASK, TOAST_DURATION, MAX_STUDY_DAYS } from "./lib/rules";
import { savePdfFile, deletePdfFile } from "./lib/pdf-storage";
import { hydrateWorkspace, saveWorkspace } from "./lib/storage";
import { loadLearningEvents, appendLearningEvent, type LearningEvent } from "./lib/events";
import { computeReplayComparison, computeProgressComparison } from "./lib/replay-console";
import { projectKnowledgeState } from "./lib/projection";
import { extractReviewFields } from "./lib/memory-rules";
import styles from "../styles/workspace.module.css";
import { Sidebar } from "./components/Sidebar";
import { ReviewPanel } from "./components/ReviewPanel";
import { ReviewDialog } from "./components/ReviewDialog";
import { OnboardingWizard, type OnboardingResult } from "./components/OnboardingWizard";
import { WorkspaceProvider, type WorkspaceCtx } from "./components/workspace-context";
import { CardsView } from "./components/CardsView";
import { KnowledgeView } from "./components/KnowledgeView";
import { DashboardTasksView } from "./components/DashboardTasksView";
import { AgentView } from "./components/AgentView";
import { SettingsView } from "./components/SettingsView";
import { analyzeExam, analyzeErrorReason } from "./lib/ai/analyze-exam";
import { analyzeMistakes, mistakesErrorReason } from "./lib/ai/analyze-mistakes";
import { generatePlan as generateTodayPlan, planErrorReason } from "./lib/ai/plan-generate";
import { buildMaterialBundle, buildPlaceholderQuestionsForPastPaper, extractQuestionKeyword } from "./lib/materials";
import { makeId, today, dateOnly, normalizeExamGoal, dateRange } from "./lib/utils";

const quickPrompts = ["今天学什么", "找近五年化学势真题", "傅献彩哪里讲这个", "为什么总错这类题", "把今天整理成笔记", "分析最近三套真题，更新图谱并重排计划", "我现在属于第几轮"];
const masteryOptions: MasteryText[] = ["完全不懂", "有些模糊", "基本理解", "能够讲清", "能够迁移"];
const moodOptions: StudyMood[] = ["较差", "一般", "正常", "较好", "很好"];
const coreNames = ["热力学", "相平衡", "化学动力学", "电化学", "统计热力学", "表面与胶体", "实验与综合"];

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
  // ─── Dashboard: Hydration-safe date (SSR: fixed; mount: real) ───
  // 必须在派生值（dueCards 等）之前声明，否则 TDZ ReferenceError
  const [hydratedTodayStr, setHydratedTodayStr] = useState("2026-07-30");
  const [hydratedDaysLeft, setHydratedDaysLeft] = useState(143);
  const [exam, setExam] = useState(seedExam);
  const [appSettings, setAppSettings] = useState(seedAppSettings);
  const [subjects, setSubjects] = useState(seedSubjects);
  const [activeKnowledgeSubject, setActiveKnowledgeSubject] = useState(seedSubjects[0]?.name ?? "");
  const [activeCardSubject, setActiveCardSubject] = useState(seedSubjects[0]?.name ?? "");
  const [resources, setResources] = useState(seedResources);
  const [materials, setMaterials] = useState<Material[]>(seedMaterials);
  const [materialSections, setMaterialSections] = useState<MaterialSection[]>(seedMaterialSections);
  const [questions, setQuestions] = useState(seedQuestions);
  const [nodes, setNodes] = useState(seedNodes);
  const [tasks, setTasks] = useState(seedTasks);
  const [pending, setPending] = useState<PendingItem[]>([
    { id: "p-1", kind: "真题识别", title: "2023 828 真题第 6 题", subject: "828 物理化学", detail: "建议挂载到 相平衡 / 相律 / 自由度判断", status: "待确认" },
  ]);
  const [notes, setNotes] = useState(seedNotes);
  const [cards, setCards] = useState(seedCards);
  // ─── UX Sprint: 卡片自定义分类（学科 ≠ 分类；按 subjectId 隔离）───
  const [categories, setCategories] = useState<CardCategory[]>(seedCardCategories);
  // 当前打开的卡片组 id（null = 成长卡片首页；真实分类 / ALL_GROUPS / UNCATEGORIZED = 卡片组学习空间）
  const [activeCardCategory, setActiveCardCategory] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState(seedAnnotations);
  const [activeResourceId, setActiveResourceId] = useState(seedResources[0]?.id ?? "");
  const [readerSearch, setReaderSearch] = useState("");
  const [readerPage, setReaderPage] = useState(seedResources[0]?.currentPage ?? "");
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
  const [studyDays, setStudyDays] = useState<StudyDay[]>(seedStudyDays);
  const [learningEvents, setLearningEvents] = useState<LearningEvent[]>([]);
  const [focusMode, setFocusMode] = useState(false);
  const [cardMode, setCardMode] = useState("背诵");
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  // 编辑卡片弹窗当前编辑的卡片 id（null = 新建）
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  // 正在编辑的卡片（仅编辑弹窗使用；避免卡片列表变化时闪动）
  const editingCard = editingCardId ? cards.find((c) => c.id === editingCardId) ?? null : null;
  const [cardDialogSubject, setCardDialogSubject] = useState(seedSubjects[0]?.name ?? "");
  const [cardDialogCategory, setCardDialogCategory] = useState("");
  // ─── 卡片中心：卡片组作为一级工作空间（成长卡片 → 卡片组 → 卡片）───
  // null = 成长卡片首页（仅管理/展示卡片组）；有值 = 卡片组学习空间
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
    { id: "l-1", time: today(), input: "今天只有两个小时", output: "压缩为 2 个 828 Layer 2 任务", accepted: "已接受", dataRead: ["考试日期", "当前轮次", "高风险节点"], userRevision: "无", finalResult: "生成今日任务", rating: "未评价", rework: "0" },
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
  const reviewSubjects = ["全部科目", ...subjects.map((s) => s.name)];
  const reviewMinutes = tasks.filter((t) => t.done).reduce((sum, t) => sum + (Number(t.actualMinutes) || 0), 0);
  const reviewCompletedTasks = tasks.filter((t) => t.done).length;
  const reviewNewNodes = nodes.filter((n) => n.isMonthlyFocus).length;
  const reviewDoneQuestions = questions.filter((q) => q.done).length;
  const reviewReviewedCards = cards.filter((c) => c.lastReviewed !== "未复习").length;
  const reviewMasteryDelta = nodes.reduce((sum, n) => sum + n.masteryScore, 0) / Math.max(nodes.length, 1);
  const reviewAiSummary = `今日完成 ${reviewCompletedTasks} 个任务，掌握度变化 ${Math.round(reviewMasteryDelta)}%。`;
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
    setNotice(day ? `已打开 ${date} 的复盘记录` : `${date} 暂无学习记录`);
  }

  // ─── Dashboard: Hydration effect ───
  // 挂载后把 SSR 占位替换为真实日期/倒计时（标准 hydration 模式，需在 effect 内 setState）
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setHydratedTodayStr(dateOnly());
    setHydratedDaysLeft(Math.max(0, Math.ceil((new Date(exam.examDate).getTime() - Date.now()) / 86400000)));
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

  // ─── Storage Contract 1C-1: 唯一 hydrate 入口（v5 优先；v3/v4 自动迁移，可回滚）───
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const data = hydrateWorkspace();
    setBootChecked(true);
    if (!data) {
      requestAnimationFrame(() => requestAnimationFrame(() => setAppReady(true)));
      return; // 无任何存档 → 新用户，onboardingCompleted 保持 false → 显示初始化向导
    }
    try {
      // 老用户（已有存档但无该字段）默认视为已完成，不再弹向导
      setOnboardingCompleted((data.onboardingCompleted as boolean | undefined) ?? true);
      if (data.exam) setExam(normalizeExamGoal(data.exam));
      if (data.appSettings) setAppSettings(data.appSettings);
      if (data.subjects) setSubjects(data.subjects);
      if (data.activeKnowledgeSubject) setActiveKnowledgeSubject(data.activeKnowledgeSubject);
      if (data.activeCardSubject) setActiveCardSubject(data.activeCardSubject);
      if (data.resources) setResources(data.resources);
      if (data.materials && Array.isArray(data.materials)) {
        setMaterials(data.materials);
      } else if (data.resources && Array.isArray(data.resources)) {
        setMaterials((data.resources as Resource[]).map((resource) => resourceToMaterial(
          resource,
          (data.subjects as typeof subjects | undefined)?.find((subject) => subject.name === resource.subject)?.id ?? resource.subject,
        )));
      }
      if (data.materialSections && Array.isArray(data.materialSections)) {
        setMaterialSections(data.materialSections);
      } else if (data.resources && Array.isArray(data.resources)) {
        setMaterialSections((data.resources as Resource[]).flatMap((resource) => resourceToMaterialSections(resource, (data.questions as Question[] | undefined) ?? [])));
      }
      if (data.questions) setQuestions(data.questions);
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
        const migratedChat = (data.chat as unknown[]).map((item, index) => {
          const m = item as { id?: string; role?: string; text?: string; content?: string; createdAt?: string; updatedAt?: string; messageType?: string };
          return {
            id: m.id || `m-${Date.now()}-${index}`,
            role: (m.role === "user" || m.role === "assistant" || m.role === "system") ? m.role : "assistant",
            content: m.content ?? m.text ?? "",
            createdAt: m.createdAt || new Date().toISOString(),
            updatedAt: m.updatedAt,
            messageType: (m.messageType === "chat" || m.messageType === "action" || m.messageType === "record") ? m.messageType : "chat",
          } as AgentMessage;
        });
        const legacySession: ChatSession = {
          id: `s-${Date.now()}-legacy`,
          title: "对话历史",
          createdAt: new Date().toISOString(),
          messages: migratedChat,
        };
        setChatSessions([legacySession]);
        setActiveSessionId(legacySession.id);
        activeSessionIdRef.current = legacySession.id;
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

  // ─── Storage Contract 1C-1: 唯一 save 入口（防抖持久化，避免每次按键都全量序列化写盘 #3）───
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latestSnapshotRef = useRef<string>("");
  useEffect(() => {
    if (!appReady) return;
    latestSnapshotRef.current = JSON.stringify({
      exam, appSettings, subjects, activeKnowledgeSubject, activeCardSubject,
      resources, materials, materialSections, questions, nodes, tasks, pending, notes, cards, annotations,
      activeResourceId, readerSearch, readerPage, readerZoom,
      studyDays, agentSteps, logs, chatSessions, activeSessionId, review, structuredReviews, studyDraft, cardCategories: categories,
      onboardingCompleted,
      timer: { activeTimerTaskId, timerStartTime, timerAccumSeconds, timerRunStartEpoch },
    });
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      // saveWorkspace 失败 → 不覆盖已有数据（符合 Failure Policy：写失败保留内存 State，提示用户）
      const ok = saveWorkspace(JSON.parse(latestSnapshotRef.current) as Record<string, unknown>);
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
      saveWorkspace(JSON.parse(latestSnapshotRef.current) as Record<string, unknown>);
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
  // 使用 memory-rules 的 extractReviewFields（与记忆引擎同一套离线规则）生成结构化字段
  const handleReviewSubmit = () => {
    // P2 交互修复（深入审查 2026-08-01）：无内容时不产生空复盘记录
    if (!review.done.trim() && !review.hard.trim()) {
      setNotice("请至少填写「完成了什么」或「最困难的部分」");
      return;
    }
    const parsed = extractReviewFields({
      done: review.done,
      hard: review.hard,
      overload: review.load,
      availableTime: review.tomorrow,
      priority: review.priority,
    });
    const now = new Date().toISOString();
    const aiSummary = [
      review.done.trim() ? `完成内容：${review.done.trim()}` : "",
      review.hard.trim() ? `困难点：${review.hard.trim()}` : "",
      parsed.loadLevel === "过少" ? "计划负荷偏少，可适当加量。" : parsed.loadLevel === "过多" ? "计划负荷偏重，建议精简。" : "计划负荷适中。",
    ].filter(Boolean).join(" ");
    const structured: StructuredReview = {
      id: makeId("sr"),
      sourceId: `review-${Date.now()}`,
      date: now,
      rawInput: {
        done: review.done,
        hard: review.hard,
        overload: review.load,
        availableTime: review.tomorrow,
        priority: review.priority,
      },
      parsed: {
        content: parsed.content,
        completionRates: parsed.content.map(() => 100),
        difficulty: parsed.difficulty,
        emotion: "正常",
        confidence: 60,
        availableMinutes: parsed.availableMinutes,
        loadLevel: parsed.loadLevel,
      },
      knowledgeImpact: [],
      aiSummary: aiSummary || "今日复盘已记录。",
      createdAt: now,
    };
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

  // ─── 删除撤销窗口：约 8 秒后关闭撤销入口 ───
  useEffect(() => {
    if (!lastDeleted) return;
    const timer = setTimeout(() => setLastDeleted(null), 8000);
    return () => clearTimeout(timer);
  }, [lastDeleted]);

  // ─── Heatmap derived values ───
  const confirmedQuestions = questions.filter((q) => q.confirmed).length;
  const heatmapStart = exam.examGoalCreatedAt ?? hydratedTodayStr;
  const heatmapEnd = exam.examDate >= hydratedTodayStr ? exam.examDate : hydratedTodayStr;
  const heatmapDates = dateRange(heatmapStart, heatmapEnd);
  const heatmapDays = heatmapDates.map((date) => {
    const dayData = studyDays.find((d) => d.date === date);
    return { date, completed: dayData?.completed ?? 0, minutes: dayData?.minutes ?? 0 };
  });
  const heatmapTotalDays = heatmapDays.length;
  const monthNames = ["", "1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  const heatmapStartFormatted = `${heatmapStart.split("-")[0]}.${heatmapStart.split("-")[1]}.${heatmapStart.split("-")[2]}`;
  const startDayOfWeek = new Date(heatmapStart).getDay();
  const monBasedOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  const totalSlots = heatmapTotalDays + monBasedOffset;
  const heatmapWeeks = Math.ceil(totalSlots / 7);
  const heatmapGrid: ({ date: string; completed: number; minutes: number } | null)[][] = [];
  for (let w = 0; w < heatmapWeeks; w++) {
    const week: ({ date: string; completed: number; minutes: number } | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const slotIndex = w * 7 + d;
      if (slotIndex < monBasedOffset) {
        week.push(null);
      } else {
        const dayIndex = slotIndex - monBasedOffset;
        if (dayIndex < heatmapTotalDays) {
          week.push(heatmapDays[dayIndex]);
        }
      }
    }
    heatmapGrid.push(week);
  }
  const todayStr = hydratedTodayStr;
  const dayLabels: string[] = [];
  const weekDays = ["一", "二", "三", "四", "五"];
  for (let i = 0; i < 7; i++) {
    if (i > 0 && i < 6) dayLabels.push(weekDays[i - 1]);
    else dayLabels.push("");
  }
  const heatmapMonths: { label: string; colSpan: number }[] = [];
  heatmapGrid.forEach((week) => {
    const firstDay = week.find((d) => d !== null);
    if (!firstDay) return;
    const month = new Date(firstDay.date).getMonth() + 1;
    const prevMonth = heatmapMonths.length > 0 ? heatmapMonths[heatmapMonths.length - 1] : null;
    if (!prevMonth || prevMonth.label !== monthNames[month]) {
      heatmapMonths.push({ label: monthNames[month], colSpan: 1 });
    } else {
      prevMonth.colSpan++;
    }
  });
  const cardsByDate = cards.reduce<Record<string, number>>((acc, card) => {
    const d = card.createdAt.slice(0, 10);
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});

  // --- Computed values for Sidebar ---
  const daysLeft = hydratedDaysLeft;
  const totalTargetScore = subjects.reduce(
    (sum, subject) => sum + Number(subject.targetScore || 0),
    0
  );
  const overallProgress = nodes.length > 0
    ? Math.round(
        (nodes.reduce((sum, node) => sum + node.masteryScore, 0) / Math.max(nodes.length, 1)) * 0.55 +
        (confirmedQuestions / Math.max(questions.length, 1)) * 100 * 0.25 +
        (resources.filter((r) => r.status === "已索引").length / Math.max(resources.length, 1)) * 100 * 0.2
      )
    : 0;

  // ─── UX Sprint P0: ChatSession 管理（新建对话创建新 Session，不删除历史）───
  function ensureChatSession() {
    // 只信任 ref（函数式 setState 的 prev 会包含尚未提交的新 Session）。
    // 不可用旧闭包 chatSessions.some() 判断——React 批处理中它会误判并创建第二个 Session。
    let sessionId = activeSessionIdRef.current;
    if (!sessionId) {
      sessionId = makeId("s");
      setChatSessions((prev) => [{ id: sessionId, title: "新对话", createdAt: new Date().toISOString(), messages: [], status: "active" }, ...prev]);
      setActiveSessionId(sessionId);
      activeSessionIdRef.current = sessionId;
    }
    return sessionId;
  }

  function newChatSession() {
    const sessionId = makeId("s");
    setChatSessions((prev) => [{ id: sessionId, title: "新对话", createdAt: new Date().toISOString(), messages: [], status: "active" }, ...prev]);
    setActiveSessionId(sessionId);
    activeSessionIdRef.current = sessionId;
    setChatHistoryOpen(false);
    setNotice("已创建新对话（历史对话保留在左侧）");
  }

  // UX Sprint: 推送 AI/系统消息（记录真实 createdAt；messageType 区分 AI 建议/系统操作/数据记录）
  // 系统通知默认进入当前 Session 的「系统记录」折叠区，不与 AI 对话混排
  function pushAssistant(text: string, messageType: NonNullable<AgentMessage["messageType"]> = "chat") {
    const sessionId = ensureChatSession();
    setChatSessions((items) => items.map((s) => s.id === sessionId
      ? { ...s, messages: [...s.messages, { id: makeId("m"), role: "assistant", content: text, createdAt: new Date().toISOString(), messageType }] }
      : s));
    setNotice(text);
  }
  function pushSystem(text: string, messageType: "action" | "record" = "action") {
    const sessionId = ensureChatSession();
    setChatSessions((items) => items.map((s) => s.id === sessionId
      ? { ...s, messages: [...s.messages, { id: makeId("m"), role: "system", content: text, createdAt: new Date().toISOString(), messageType }] }
      : s));
    setNotice(text);
  }

  // 撤销最近一次删除（此前 setLastDeleted 记录了备份，但没有入口消费它）
  function restoreLastDeleted() {
    if (!lastDeleted) return;
    const backup = lastDeleted;
    switch (backup.collection) {
      case "resources": setResources((items) => [backup.item, ...items]); break;
      case "questions": setQuestions((items) => [backup.item, ...items]); break;
      case "nodes": setNodes((items) => [backup.item, ...items]); break;
      case "cards": setCards((items) => [backup.item, ...items]); break;
      case "subjects": setSubjects((items) => [...items, backup.item]); break;
    }
    setLastDeleted(null);
    setNotice(`已恢复：${backup.label}`);
  }

  // ─── 数据导出（PRD 3.5 JSON 备份）───
  function handleExportData() {
    try {
      const snapshot = {
        exportedAt: new Date().toISOString(),
        appName: "筑巢考研工作台",
        storageVersion: 6,
        exam, appSettings, subjects, activeKnowledgeSubject, activeCardSubject,
        resources, materials, materialSections, questions, nodes, tasks, pending, notes, cards,
        annotations, studyDays, agentSteps, logs, chatSessions, activeSessionId, review, structuredReviews,
        cardCategories: categories,
      };
      const json = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kaoyan-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setNotice("已导出完整数据备份 (JSON)");
    } catch (error) {
      console.error("[Export] 导出失败", error);
      setNotice("导出失败，请重试");
    }
  }

  // ─── 数据导入（PRD 3.5 JSON 恢复）：写入 localStorage 后刷新，由 mount hydrate 统一恢复 ───
  async function handleImportData(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Record<string, unknown>;
      if (!data || typeof data !== "object" || !Array.isArray(data.subjects)) {
        setNotice("导入失败：不是有效的备份文件（缺少 subjects 字段）");
        return;
      }
      const written = saveWorkspace({
        ...(data as Record<string, unknown>),
        storageVersion: 6,
        onboardingCompleted: data.onboardingCompleted ?? true,
      } as never);
      if (!written) {
        setNotice("导入失败：无法写入本地存储（可能磁盘版本更高或配额已满）");
        return;
      }
      setNotice("导入成功，正在刷新恢复数据…");
      setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      console.error("[Import] 导入失败", error);
      setNotice("导入失败：文件不是有效的 JSON 备份");
    }
  }

  // ─── Onboarding：完成向导 → 用用户数据整体替换演示种子（清空 828 残留内容）───
  function completeOnboarding(result: OnboardingResult) {
    setExam(normalizeExamGoal(result.exam));
    setSubjects(result.subjects);
    setResources(result.resources);
    setNodes(result.nodes);
    setTasks(result.tasks);
    // 其余学习内容清空，避免残留示例项目数据
    setQuestions([]);
    setCards([]);
    setAnnotations([]);
    setPending([]);
    setNotes([]);
    setStudyDays([]);
    setCategories([]);
    setStructuredReviews([]);
    // 激活科目指向新项目的首个科目
    const first = result.subjects[0]?.name ?? "";
    setActiveKnowledgeSubject(first);
    setActiveCardSubject(first);
    setActiveView("dashboard");
    setOnboardingCompleted(true);
    setNotice("已创建考研项目，开始你的学习吧。");
  }

  // ─── Onboarding：试用示例数据 → 保留现有种子，直接进入工作台 ───
  function loadDemoProject() {
    setOnboardingCompleted(true);
    setNotice("已载入示例数据（哈工大 / 828 物理化学）。");
  }

  // ─── Knowledge Center handlers ───
  function selectKnowledgeSubject(subjectName: string) {
    setActiveKnowledgeSubject(subjectName);
    setQuestionFilter((prev) => ({ ...prev, subject: "全部" }));
  }

  function inferResource(rawName: string, subjectHint: string) {
    const text = rawName.toLowerCase();
    const matchedSubject = subjects.find((subject) => rawName.includes(subject.name) || rawName.includes(subject.name.replace(/\s/g, "")));
    const subject = subjectHint || matchedSubject?.name || (rawName.includes("数学") ? "数学二" : rawName.includes("英语") ? "英语一" : rawName.includes("828") || rawName.includes("物理化学") || rawName.includes("傅献彩") ? "828 物理化学" : activeKnowledgeSubject || subjects[0]?.name || "未分科");
    const isPastPaper = rawName.includes("真题") || /20\d{2}/.test(rawName);
    const hasSolution = rawName.includes("解析") || rawName.includes("答案") || text.includes("solution");
    const isFu = rawName.includes("傅献彩") || text.includes("physical");
    const type = isPastPaper ? hasSolution ? "真题解析" : "真题" : isFu ? "教材" : rawName.includes("讲义") ? "课程讲义" : "学习资料";
    const name = isFu ? "傅献彩《物理化学》" : rawName.replace(/\.(pdf|docx?|png|jpe?g)$/i, "");
    const pages = isPastPaper ? "AI识别：按年份和题号拆分" : isFu ? "AI识别：共16章" : "AI识别：待确认章节";
    const linkedNode = subject.includes("828") ? "热力学 / 相平衡 / 化学动力学 / 电化学 / 统计热力学 / 表面与胶体 / 实验与综合" : "待AI关联知识图谱";
    const recommendedLayer = isPastPaper ? "第 2-4 层" : "第 1-2 层";
    return { subject, type, name, pages, linkedNode, recommendedLayer, duplicate: resources.some((resource) => resource.fileName === rawName || resource.name === name) };
  }

  function openResource(resource: Resource) {
    setActiveResourceId(resource.id);
    setActiveKnowledgeSubject(resource.subject);
    setReaderPage(resource.currentPage || "1");
    setActiveKnowledgePanel("resources");
    setActiveView("knowledge");
    // Stabilization 1A-5: 记录最近打开页码（用于刷新后恢复阅读位置）
    setResources((items) => items.map((item) => item.id === resource.id
      ? { ...item, lastOpenedPage: resource.currentPage || "1", lastRead: "刚刚" }
      : item));
    setNotice(`已打开资料：${resource.name}`);
  }

  function resetUploadProgress() {
    uploadProgressRunRef.current += 1;
    uploadProgressTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    uploadProgressTimeoutsRef.current = [];
    setFileUploadState(null);
  }

  function openResourceDialog() {
    resetUploadProgress();
    setActiveDialog("resource");
  }

  function closeResourceDialog() {
    resetUploadProgress();
    setActiveDialog(null);
  }

  function startUploadProgress(file: File, inferred: ReturnType<typeof inferResource>) {
    resetUploadProgress();
    const runId = uploadProgressRunRef.current;
    setFileUploadState({ name: file.name, size: file.size, inferred, step: "uploading" });
    const stages = [
      ["extracting", 400],
      ["identifying", 900],
      ["parsing", 1500],
      ["mapping", 2100],
      ["done", 2600],
    ] as const;
    stages.forEach(([step, delay]) => {
      const timeoutId = setTimeout(() => {
        if (uploadProgressRunRef.current !== runId) return;
        setFileUploadState((prev) => (prev && prev.name === file.name ? { ...prev, step } : prev));
      }, delay);
      uploadProgressTimeoutsRef.current.push(timeoutId);
    });
  }

  function upsertMaterialFromResource(resource: Resource) {
    const { material, sections } = buildMaterialBundle(resource, subjects);
    setMaterials((items) => [material, ...items.filter((item) => item.id !== material.id)]);
    setMaterialSections((items) => [...sections, ...items.filter((item) => item.materialId !== resource.id)]);
    return { material, sections };
  }

  function addPlaceholderQuestionsForPastPaper(resource: Resource, sections: MaterialSection[]) {
    const nextQuestions = buildPlaceholderQuestionsForPastPaper(resource, sections, exam, dateOnly(), makeId);
    if (nextQuestions.length) {
      setQuestions((items) => [...nextQuestions, ...items]);
      setMaterialSections((items) => items.map((section) => {
        const sectionQuestionIds = nextQuestions.filter((question) => question.sectionId === section.id).map((question) => question.id);
        return sectionQuestionIds.length ? { ...section, questionIds: sectionQuestionIds } : section;
      }));
    }
  }

  async function addResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fileValue = form.get("file");
    const file = fileValue instanceof File && fileValue.name ? fileValue : null;
    const isPdfFile = !!file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (file && !isPdfFile) {
      pushAssistant("当前仅支持保存 PDF 文件。请转换为 PDF 后再上传。");
      resetUploadProgress();
      return;
    }
    const fallbackName = `${activeKnowledgeSubject || "未分科"}${activeKnowledgePanel === "questions" ? "空白真题卷" : "空白资料"}-${dateOnly()}`;
    const rawName = String(file?.name || form.get("sourceText") || fallbackName).trim();
    const inferred = inferResource(rawName, String(form.get("subjectHint") ?? ""));
    const base: Resource = {
      id: makeId("r"),
      name: inferred.name,
      subject: inferred.subject,
      type: inferred.type,
      author: inferred.name.includes("傅献彩") ? "傅献彩" : "AI待确认",
      version: inferred.name.includes("傅献彩") ? "AI识别：第六版" : "AI待确认",
      pages: inferred.pages,
      status: "AI待确认",
      fileName: file?.name ?? rawName,
      recommendedRound: "第一轮",
      recommendedLayer: inferred.recommendedLayer,
      currentPage: "",
      lastRead: "",
      readingMinutes: "",
      linkedNode: inferred.linkedNode,
      kind: "demo",
      createdAt: new Date().toISOString(),
    };
    // Stabilization 1A-1: 真实 PDF 文件 → IndexedDB（绝不写入 localStorage）
    if (file && isPdfFile) {
      try {
        const stored = await savePdfFile(file);
        const resource: Resource = {
          ...base,
          kind: "pdf",
          fileStorageKey: stored.fileStorageKey,
          size: stored.size,
          mimeType: stored.mimeType,
        };
        resource.pages = `PDF 文件 · ${(stored.size / 1024).toFixed(1)} KB`;
        // 上传即自动生效：不再进入「待确认」队列，直接可供阅读
        setResources((items) => [resource, ...items]);
        const { sections } = upsertMaterialFromResource(resource);
        addPlaceholderQuestionsForPastPaper(resource, sections);
        pushAssistant(`PDF 已保存并可阅读：${resource.name}。`);
      } catch (err) {
        pushAssistant(`PDF 保存失败：${String(err)}`);
        closeResourceDialog();
        return;
      }
    } else {
      // 演示/非 PDF 资源：上传即自动生效，不再进入「待确认」队列
      setResources((items) => [base, ...items]);
      const { sections } = upsertMaterialFromResource(base);
      addPlaceholderQuestionsForPastPaper(base, sections);
      pushAssistant(`已添加演示/空白资料：${base.name}。`);
    }
    setActiveKnowledgeSubject(inferred.subject);
    closeResourceDialog();
  }

  // ─── B-1: 待确认队列操作（确认 / 忽略）───
  // 确认后按 kind 应用结果并移出队列；忽略则直接移出队列
  function confirmPendingItem(item: PendingItem) {
    setPending((items) => items.filter((p) => p.id !== item.id));
    if (item.kind === "真题识别" && item.targetId) {
      setQuestions((qitems) => qitems.map((q) => q.id === item.targetId ? { ...q, confirmed: true } : q));
      setNotice(`已确认：${item.title}`);
    } else if (item.kind === "资料切分" && item.targetId) {
      setResources((ritems) => ritems.map((r) => r.id === item.targetId ? { ...r, status: "已索引" } : r));
      setNotice(`已确认：${item.title}`);
    } else {
      setNotice(`已确认：${item.title}`);
    }
  }

  function dismissPendingItem(item: PendingItem) {
    setPending((items) => items.filter((p) => p.id !== item.id));
    setNotice(`已忽略：${item.title}`);
  }

  function deleteResource(item: Resource) {
    setLastDeleted({ collection: "resources", item, label: item.name });
    setResources((items) => items.filter((resource) => resource.id !== item.id));
    setMaterials((items) => items.filter((material) => material.id !== item.id));
    setMaterialSections((items) => items.filter((section) => section.materialId !== item.id));
    setQuestions((items) => items.filter((question) => question.materialId !== item.id));
    // Stabilization 1A-6: 同步清理 IndexedDB 中的 PDF 二进制
    if (item.kind === "pdf" && item.fileStorageKey) {
      deletePdfFile(item.fileStorageKey).catch(() => {});
    }
    // 清理关联批注
    setAnnotations((items) => items.filter((annotation) => annotation.resourceId !== item.id));
    setNotice(`已删除资源：${item.name}`);
  }

  // ─── Stabilization 1A-3/1A-4: 批注创建 / 编辑 / 删除（持久化经 save effect）───
  function onCreateAnnotation(page: string, selection: string, tag: Annotation["tag"], note: string) {
    if (!activeResource) return;
    const annotation: Annotation = {
      id: makeId("a"),
      resourceId: activeResource.id,
      resourceName: activeResource.name,
      page,
      selection,
      tag,
      note,
      linkedNode: activeResource.linkedNode || "待关联",
      createdAt: today(),
      handled: false,
      updatedAt: today(),
    };
    setAnnotations((items) => [annotation, ...items]);
    setNotice(`已添加批注：${selection.slice(0, 20)}`);
  }

  function onEditAnnotation(id: string, note: string) {
    setAnnotations((items) => items.map((item) => item.id === id ? { ...item, note, updatedAt: today() } : item));
  }

  function onDeleteAnnotation(id: string) {
    setAnnotations((items) => items.filter((item) => item.id !== id));
    setNotice("已删除批注");
  }

  function deleteQuestion(item: Question) {
    setLastDeleted({ collection: "questions", item, label: `${item.year} 第 ${item.number} 题` });
    setQuestions((items) => items.filter((question) => question.id !== item.id));
    setNotice(`已删除真题：${item.year} 第 ${item.number} 题`);
  }

  function deleteNode(item: KnowledgeNode) {
    setLastDeleted({ collection: "nodes", item, label: item.knowledge });
    setNodes((items) => items.filter((node) => node.id !== item.id));
    setNotice(`已删除知识点：${item.knowledge}`);
  }

  // ─── 卡片组管理：创建 / 重命名（内联）/ 删除（确认框）───
  function addCategoryInline() {
    const name = newCardDeckName.trim().slice(0, 30);
    if (!name) { setNotice("名称不能为空"); return; }
    if (subjectCategories.some((c) => c.name === name)) { setNotice("卡片组名称已存在"); return; }
    const subject = subjects.find((s) => s.name === activeCardSubject);
    if (!subject) return;
    const now = today();
    setCategories((items) => [...items, { id: makeId("cat"), subjectId: subject.id, name, createdAt: now, updatedAt: now }]);
    setNewCardDeckOpen(false);
    setNewCardDeckName("");
    setNotice(`已新建卡片组：${name}`);
  }

  // 卡片移动到当前学科内的其他分类（不能跨学科移动）
  function moveCardToCategory(cardId: string, categoryId: string) {
    setCards((items) => items.map((c) => c.id === cardId
      ? { ...c, categoryId: categoryId || undefined }
      : c));
  }
  function reviewCard(id: string, mastery: GrowthCard["mastery"]) {
    const card = cards.find((c) => c.id === id);
    const intervalDays = mastery === "不会" ? 1 : mastery === "模糊" ? 3 : mastery === "认识" ? 7 : mastery === "熟练" ? 14 : 30;
    setCards((items) => items.map((card) => card.id === id ? { ...card, mastery, lastReviewed: today(), nextReviewAt: dateOnly(intervalDays) } : card));
    const interval = mastery === "不会" ? "明天" : mastery === "模糊" ? "3 天后" : mastery === "认识" ? "7 天后" : mastery === "熟练" ? "14 天后" : "30 天后";
    pushAssistant(`已记录卡片掌握状态：${mastery}。下次建议复习：${interval}。`);
    // LearningEvent: card_reviewed（Sprint 1 / Phase A，纯副作用采集）
    setLearningEvents((prev) => appendLearningEvent(prev, {
      type: "card_reviewed",
      sourceRef: {
        kind: "card",
        id,
        subjectId: card?.subject,
        nodeIds: nodes.filter((n) => n.knowledge === card?.knowledge || n.core === card?.core).map((n) => n.id),
      },
      payload: { mastery, intervalDays },
    }));
    setCardFlipped(false);
    // 卡片组内复习队列推进（卡片组 → 卡片 的信息层级）
    setCardIndex((index) => Math.min(index + 1, Math.max(categoryReviewQueue.length - 1, 0)));
  }
  function moveCard(step: number) {
    setCardFlipped(false);
    // 卡片组内复习队列推进（卡片组 → 卡片 的信息层级）
    setCardIndex((index) => Math.min(Math.max(index + step, 0), Math.max(categoryReviewQueue.length - 1, 0)));
  }

  // 键盘快捷键 (仅当在卡片组学习空间「待复习」视图时生效)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // P0 修复（交互审查 2026-08-01）：输入框/文本域聚焦时忽略快捷键，避免打字误触翻面/评分
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName ?? "";
      if (tagName === "INPUT" || tagName === "TEXTAREA" || target?.isContentEditable) return;

      if (activeView !== "cards" || !cardSubjectView || !activeCardCategory || cardSubView !== "待复习" || !activeGroupCard) return;
      if (e.key === " " || e.key === "Space") { e.preventDefault(); setCardFlipped((v) => !v); }
      else if (e.key === "ArrowLeft") moveCard(-1);
      else if (e.key === "ArrowRight") moveCard(1);
      else if (e.key === "1") reviewCard(activeGroupCard.id, "认识");
      else if (e.key === "2") reviewCard(activeGroupCard.id, "模糊");
      else if (e.key === "3") reviewCard(activeGroupCard.id, "不会");
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // moveCard/reviewCard 每次渲染重建但语义稳定；此处依赖已覆盖会影响行为的状态
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, cardSubjectView, activeCardCategory, cardSubView, activeGroupCard, categoryReviewQueue, cardFlipped]);

  // ─── Growth Cards handlers ───
  function safeCardCategoryForSubject(categoryId: string | undefined, subjectName: string) {
    if (!categoryId) return "";
    const subject = subjects.find((item) => item.name === subjectName);
    return subject && categories.some((cat) => cat.id === categoryId && cat.subjectId === subject.id) ? categoryId : "";
  }

  function openNewCardDialog() {
    const subject = activeCardSubject || currentSubject?.name || subjects[0]?.name || "";
    const candidateCategory = activeCardCategory && activeCardCategory !== ALL_GROUPS && activeCardCategory !== UNCATEGORIZED ? activeCardCategory : "";
    setEditingCardId(null);
    setCardDialogSubject(subject);
    setCardDialogCategory(safeCardCategoryForSubject(candidateCategory, subject));
    setActiveDialog("card");
  }

  function openEditCardDialog(card: GrowthCard) {
    const subject = card.subject || activeCardSubject || subjects[0]?.name || "";
    setEditingCardId(card.id);
    setCardDialogSubject(subject);
    setCardDialogCategory(safeCardCategoryForSubject(card.categoryId, subject));
    setActiveDialog("card");
  }

  function createCardFromText(createdBy: GrowthCard["createdBy"], text: string, annotation?: Annotation) {
    const card: GrowthCard = {
      id: makeId("c"),
      title: annotation ? `${annotation.selection}：${annotation.tag}` : "AI 生成成长卡片",
      front: annotation?.selection ?? "请回忆这条内容的核心结论。",
      back: annotation ? `${annotation.selection}\n${annotation.note}` : text,
      type: text.includes("填空") ? "填空卡" : text.includes("推导") ? "推导卡" : text.includes("条件") ? "条件辨析卡" : "公式卡",
      subject: currentSubject?.name ?? "未分科",
      core: nodes[0]?.core ?? "待关联",
      branch: nodes[0]?.branch ?? "待关联",
      knowledge: nodes[0]?.knowledge ?? "待关联",
      source: annotation?.resourceName ?? activeResource?.name ?? "AI 对话",
      page: annotation?.page ?? activeResource?.currentPage ?? "",
      modes: ["背诵", text.includes("填空") ? "填空" : "条件辨析"],
      createdBy,
      createdAt: today(),
      lastReviewed: "未复习",
      nextReviewAt: dateOnly(),
      mastery: "模糊",
      note: annotation?.note ?? "",
      favorite: false,
    };
    setCards((items) => [card, ...items]);
    setActiveCardSubject(card.subject);
    if (annotation) setAnnotations((items) => items.map((item) => item.id === annotation.id ? { ...item, handled: true } : item));
    pushAssistant(`已创建成长卡片：${card.title}`);
  }

  function deleteCard(item: GrowthCard) {
    setLastDeleted({ collection: "cards", item, label: item.title });
    setCards((items) => items.filter((card) => card.id !== item.id));
    setNotice(`已删除卡片：${item.title}`);
  }

  function openCardSource(card: GrowthCard) {
    const relatedResource = resources.find((r) => r.name.includes(card.source) || card.source.includes(r.name));
    if (relatedResource) {
      setActiveResourceId(relatedResource.id);
      setActiveKnowledgeSubject(relatedResource.subject);
      setReaderPage(card.page || relatedResource.currentPage || "1");
      setActiveKnowledgePanel("resources");
      setActiveView("knowledge");
      setNotice(`已打开来源：${card.source}`);
    } else {
      pushAssistant(`未找到卡片来源资源：${card.source}`);
    }
  }

  function showRelatedQuestions(core: string, keyword = "", subject = activeCardSubject || currentSubject?.name || activeKnowledgeSubject || "") {
    // UX Sprint（学科隔离）: 相关真题严格锁定当前科目，不允许跨学科展示
    const targetSubject = subject || activeKnowledgeSubject || "";
    setQuestionFilter({ subject: targetSubject, core, result: "全部", keyword });
    setActiveKnowledgeSubject(targetSubject);
    setActiveKnowledgePanel("questions");
    setActiveView("knowledge");
  }

  // ─── Dashboard handlers ───
  function updateTask(id: string, patch: Partial<Task>) {
    setTasks((items) => items.map((task) => task.id === id ? { ...task, ...patch } : task));
  }

  // 每个任务对某一天的学习记录只计一次，避免反复勾选/多入口重复累加（#8）
  function recordTaskDone(task: Task, minutes: number) {
    const date = dateOnly();
    if (task.countedForDate === date) return;
    recordStudyDay(minutes, 1);
    updateTask(task.id, { countedForDate: date });
  }

  function recordTaskUndone(task: Task) {
    if (!task.countedForDate) return;
    const minutes = Number(task.actualMinutes || task.minutes || 0);
    recordStudyDay(-minutes, -1); // 反向抵扣当天的计入
    updateTask(task.id, { countedForDate: "" });
  }

  function toggleTaskDone(task: Task) {
    const nextDone = !task.done;
    updateTask(task.id, { done: nextDone });
    if (nextDone) recordTaskDone(task, task.actualMinutes !== "" ? Number(task.actualMinutes) : (task.minutes || 0));
    else recordTaskUndone(task);
  }

  function moveTask(id: string, direction: -1 | 1) {
    const index = tasks.findIndex((task) => task.id === id);
    const target = index + direction;
    if (index < 0) return;
    if (target < 0 || target >= tasks.length) {
      setNotice(direction < 0 ? "已经是最高优先级" : "已经是最低优先级");
      return;
    }
    setTasks((items) => {
      const currentIndex = items.findIndex((task) => task.id === id);
      const currentTarget = currentIndex + direction;
      if (currentIndex < 0 || currentTarget < 0 || currentTarget >= items.length) return items;
      const next = [...items];
      [next[currentIndex], next[currentTarget]] = [next[currentTarget], next[currentIndex]];
      return next;
    });
    setNotice(direction < 0 ? "已提高优先级" : "已降低优先级");
  }

  function stopTimer() {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = undefined;
    }
  }

  // 以给定起点（墙钟 ms）开始/恢复一个运行段；interval 仅按时间戳重算显示值，
  // 因此后台节流也不会少算，刷新后用持久化的起点即可无缝续计。
  function runTimerFrom(accumSeconds: number, startEpoch: number) {
    setTimerAccumSeconds(accumSeconds);
    setTimerRunStartEpoch(startEpoch);
    const compute = () => accumSeconds + Math.max(0, Math.floor((Date.now() - startEpoch) / 1000));
    setElapsedSeconds(compute());
    stopTimer();
    timerIntervalRef.current = setInterval(() => setElapsedSeconds(compute()), 1000);
  }

  // 当前真实已学秒数（不依赖 interval 的最后一次 tick）
  function currentElapsedSeconds() {
    return timerRunStartEpoch > 0
      ? timerAccumSeconds + Math.max(0, Math.floor((Date.now() - timerRunStartEpoch) / 1000))
      : timerAccumSeconds;
  }

  function startTask(task: Task) {
    const now = new Date();
    const startTimeStr = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    setTimerStartTime(startTimeStr);
    setActiveTimerTaskId(task.id);
    setCompletionModalAllowEditTime(false);
    setCompletionModalCustomMinutes("");
    updateTask(task.id, { status: "学习中", startedAt: startTimeStr });
    runTimerFrom(0, Date.now());
    // UX Sprint: 用户主动开始新学习段 → 清除该任务的历史草稿（明确的新会话意图）
    setStudyDraft((prev) => (prev && prev.taskId === task.id ? null : prev));
    setNotice(`开始学习：${task.title}`);
  }

  function pauseTimer(task: Task) {
    stopTimer();
    const total = currentElapsedSeconds();
    setTimerAccumSeconds(total);
    setTimerRunStartEpoch(0);
    setElapsedSeconds(total);
    updateTask(task.id, { status: "暂停" });
  }

  function resumeTimer(task: Task) {
    updateTask(task.id, { status: "学习中" });
    runTimerFrom(timerAccumSeconds, Date.now());
  }

  function handleEndLearning(task: Task) {
    stopTimer();
    const totalSeconds = currentElapsedSeconds();
    setElapsedSeconds(totalSeconds);
    setTimerRunStartEpoch(0);
    const elapsedMin = Math.max(TASK.minElapsedMinutes, Math.round(totalSeconds / 60));
    setCompletionModalCustomMinutes(String(elapsedMin));
    setCompletionModalAllowEditTime(false);
    setCompletionModalCustomEndTime(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }));
    setActiveTaskId(task.id);
    setActiveDialog("task");
    setActiveTimerTaskId("");
    // UX Sprint: 结束学习 → 自动保存草稿（计时/掌握程度/学习状态/正确率/困难原因；关闭不丢失）
    setStudyDraft({
      taskId: task.id,
      elapsedSeconds: totalSeconds,
      customMinutes: String(elapsedMin),
      mastery: task.mastery,
      accuracy: task.accuracy,
      mood: task.mood,
      note: task.note,
      dirty: false,
    });
  }

  // ─── UX Sprint: 学习结束弹窗统一入口（恢复草稿 / 初始化）───
  function openTaskDialog(task: Task) {
    const draft = studyDraft && studyDraft.taskId === task.id ? studyDraft : null;
    setActiveTaskId(task.id);
    setActiveDialog("task");
    if (draft) {
      // 恢复草稿：计时与全部表单值；计时从已累计秒数续接（不丢失）
      setElapsedSeconds(draft.elapsedSeconds);
      setTimerAccumSeconds(draft.elapsedSeconds);
      setTimerRunStartEpoch(0);
      setCompletionModalCustomMinutes(draft.customMinutes);
      setCompletionModalAllowEditTime(false);
      updateTask(task.id, {
        mastery: draft.mastery,
        accuracy: draft.accuracy,
        mood: draft.mood,
        note: draft.note,
      });
      setNotice(`已恢复未完成的学习记录：${task.title}`);
    } else {
      setElapsedSeconds(0);
      setTimerAccumSeconds(0);
      setTimerRunStartEpoch(0);
      setCompletionModalCustomMinutes(String(Math.max(TASK.minElapsedMinutes, Number(task.actualMinutes || 0) || 0)));
      setCompletionModalAllowEditTime(false);
    }
    setCompletionModalCustomEndTime(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }));
  }

  // UX Sprint: 表单任意字段修改 → 标记草稿 dirty（关闭时触发确认；草稿本身已持久化）
  function markTaskDraftDirty(task: Task, patch: Partial<Pick<StudyDraft, "mastery" | "accuracy" | "mood" | "note" | "customMinutes" | "elapsedSeconds">>) {
    setStudyDraft((prev) => {
      const base = prev && prev.taskId === task.id
        ? prev
        : {
            taskId: task.id,
            elapsedSeconds: currentElapsedSeconds(),
            customMinutes: completionModalCustomMinutes,
            mastery: task.mastery,
            accuracy: task.accuracy,
            mood: task.mood,
            note: task.note,
          };
      return { ...base, ...patch, dirty: true };
    });
  }

  // UX Sprint: 关闭学习结束弹窗 → 存在未保存内容时先弹确认，否则直接关闭
  function requestCloseTaskDialog() {
    if (studyDraft && studyDraft.taskId === activeTaskId && studyDraft.dirty) {
      setCloseConfirmPending(true);
    } else {
      setActiveDialog(null);
    }
  }

  function completeTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    // P1 交互修复（深入审查 2026-08-01）：自定义分钟 / 正确率做输入校验，拒绝空值、非数字、负数、超界
    // 避免 NaN / 负时长污染 studyDays 与掌握度事件
    let actualMinutesValue = completionModalAllowEditTime ? completionModalCustomMinutes : (task.actualMinutes || String(Math.max(1, Math.round(elapsedSeconds / 60))));
    const parsedMinutes = Number(actualMinutesValue);
    if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
      setNotice("实际分钟数无效，已保留自动计算值");
      actualMinutesValue = String(Math.max(1, Math.round(elapsedSeconds / 60)));
    } else {
      actualMinutesValue = String(Math.round(parsedMinutes));
    }
    let accuracyNumber = Number(task.accuracy || 0);
    if (!Number.isFinite(accuracyNumber) || accuracyNumber < 0) accuracyNumber = 0;
    if (accuracyNumber > 100) accuracyNumber = 100;
    // UX Sprint: 保存并完成才真正生成学习记录 → 清空该任务草稿
    setStudyDraft((prev) => (prev && prev.taskId === id ? null : prev));
    const endTimeStr = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    updateTask(id, {
      done: true,
      status: "已完成",
      actualMinutes: actualMinutesValue,
      accuracy: String(accuracyNumber),
      completedAt: endTimeStr,
    });
    recordTaskDone(task, Number(actualMinutesValue || task.minutes || 0));
    // LearningEvent: study_completed（Sprint 1 / Phase A，纯副作用采集）
    setLearningEvents((prev) => appendLearningEvent(prev, {
      type: "study_completed",
      sourceRef: {
        kind: "task",
        id: task.id,
        subjectId: task.subject,
        nodeIds: nodes.filter((n) => n.knowledge === task.branch || n.core === task.core).map((n) => n.id),
      },
      payload: {
        minutes: Number(actualMinutesValue || task.minutes || 0),
        accuracy: accuracyNumber || undefined,
        masteryBefore: task.masteryBefore ?? undefined,
        masteryAfter: task.masteryAfter ?? undefined,
      },
    }));
    if (accuracyNumber && accuracyNumber < 60) {
      setNodes((items) => items.map((node) =>
        node.knowledge === task.branch || node.core === task.core
          ? { ...node, masteryScore: Math.max(0, node.masteryScore - 8), masteryLevel: Math.max(0, node.masteryLevel - 1), mistakes: node.mistakes + 1, reviewRisk: "高风险" }
          : node
      ));
    }
  }

  function generatePlan(input = "手动重新安排今天") {
    const highRiskNode = nodes.find((node) => node.reviewRisk === "高风险") ?? nodes[0];
    if (!highRiskNode) return;
    const nextTasks: Task[] = [{
      id: makeId("t"),
      title: `回看 ${highRiskNode.knowledge}`,
      subject: highRiskNode.subject,
      core: highRiskNode.core,
      branch: highRiskNode.branch,
      round: highRiskNode.round,
      layer: highRiskNode.layer,
      source: resources.find((r) => r.subject === highRiskNode.subject)?.name ?? "已上传资料",
      range: "关联章节和错题",
      minutes: 60,
      standard: "能够复述核心条件并完成相似题。",
      reason: `${highRiskNode.knowledge} 错题 ${highRiskNode.mistakes} 次，遗忘风险 ${highRiskNode.reviewRisk}。`,
      backup: "",
      done: false,
      actualMinutes: "",
      difficulty: "2",
      mastery: "有些模糊",
      accuracy: "",
      needReview: true,
      mood: "正常",
      note: "",
      status: "待开始",
      aiRecommended: true,
      aiReasonForgetRate: `遗忘风险 ${highRiskNode.reviewRisk}`,
      aiReasonLayerStable: `${highRiskNode.layer} 尚未稳定`,
      aiReasonMistakeCount: `错题 ${highRiskNode.mistakes} 次`,
      aiReasonExamFrequency: "属于高频考点",
      startedAt: "",
      estimatedCompletionMinutes: 60,
      masteryBefore: highRiskNode.masteryScore,
      masteryAfter: Math.min(100, highRiskNode.masteryScore + 20),
      completedAt: "",
      relatedCardIds: [],
      relatedQuestionIds: [],
    }];
    setTasks(nextTasks);
    addLog(input, `生成 ${nextTasks.length} 个任务，优先 ${highRiskNode.core} / ${highRiskNode.knowledge}`);
  }

  // Material-First（2026-08-01）：AI 分析一份资料 → 解析章节/题目/知识点/七核
  // 当前先展示解析链步骤演示；接真模型后替换 result 来源（见 analyze-exam）
  async function analyzeMaterial(resource: Resource) {
    if (examAnalyzing) return;
    materialAnalysisTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    materialAnalysisTimeoutsRef.current = [];
    const runId = materialAnalysisRunRef.current + 1;
    materialAnalysisRunRef.current = runId;
    setExamAnalyzing(true);
    setActiveResourceId(resource.id);
    setActiveKnowledgeSubject(resource.subject);
    setActiveView("knowledge");
    setActiveKnowledgePanel("resources");
    // 解析链步骤（Match 用户「AI 分析资料」流程）
    const steps: AgentStep[] = [
      "解析资料类型", "识别章节/套卷", "抽取题目", "归纳知识点", "提取高频考点", "形成七核", "更新知识图谱",
    ].map((title) => ({ id: makeId("a"), title, status: "等待" } as AgentStep));
    setAgentSteps(steps);
    pushSystem(`正在 AI 分析资料：${resource.name}…`, "action");
    steps.forEach((step, i) => {
      const timeoutId = setTimeout(async () => {
        if (materialAnalysisRunRef.current !== runId) return;
        const resourceStillExists = resourcesRef.current.some((item) => item.id === resource.id);
        if (!resourceStillExists) {
          if (i === steps.length - 1) setExamAnalyzing(false);
          return;
        }
        setAgentSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, status: "完成" } : s));
        if (i === steps.length - 1) {
          const subjectId = subjects.find((subject) => subject.name === resource.subject)?.id ?? resource.subject;
          const m = resourceToMaterial(resource, subjectId);
          let aiNodes: KnowledgeNode[] = [];
          if (resource.type.includes("真题")) {
            const materialQuestions = questions.filter((question) => question.materialId === resource.id || question.source.includes(resource.name));
            const result = await analyzeExam(resource.subject, materialQuestions);
            if (result.ok) {
              aiNodes = result.nodes
                .filter((node) => node.knowledge && !nodes.some((existing) => existing.subject === resource.subject && existing.knowledge === node.knowledge))
                .map((node) => ({
                  id: makeId("k"),
                  subject: resource.subject,
                  core: node.core || "核心考点",
                  branch: node.branch || "",
                  knowledge: node.knowledge,
                  explanation: `AI 正式（DeepSeek）：${node.reason}`.slice(0, 300),
                  prerequisite: "",
                  related: resource.name,
                  masteryLevel: 0,
                  masteryScore: 20,
                  confidence: "低",
                  round: currentSubject?.round || "第一轮",
                  layer: currentSubject?.layer || "Layer 1",
                  mistakes: 0,
                  reviewRisk: "正常",
                  isMonthlyFocus: false,
                }));
              if (aiNodes.length) setNodes((items) => [...aiNodes, ...items]);
              setNotes((items) => [{
                id: makeId("n"),
                title: `资料分析（AI 正式 · DeepSeek）：${resource.name}`,
                body: `高频核心：${result.cores.map((core) => `${core.name}(${core.frequency})`).join("、") || "—"}`,
                tags: ["AI正式", "资料分析", resource.subject],
              }, ...items]);
            } else {
              pushSystem(`演示回复（${analyzeErrorReason(result.error)}，资料解析未接真模型）`, "action");
            }
          }
          setResources((items) => items.map((r) => r.id === resource.id ? { ...r, status: "已索引" } : r));
          setMaterials((items) => items.map((material) => material.id === resource.id
            ? {
              ...m,
              status: "analyzed",
              analysis: {
                sectionsCount: materialSections.filter((section) => section.materialId === resource.id).length || 1,
                questionsCount: questions.filter((question) => question.materialId === resource.id || question.source.includes(resource.name)).length,
                knowledgePointCount: nodes.filter((node) => node.subject === resource.subject).length + aiNodes.length,
                coreConcepts: Array.from(new Set([...nodes.filter((node) => node.subject === resource.subject).map((node) => node.core), ...aiNodes.map((node) => node.core)])).slice(0, 8),
                highFrequencyPoints: Array.from(new Set(questions.filter((question) => question.subject === resource.subject).map((question) => question.knowledge))).filter(Boolean).slice(0, 8),
                analyzedAt: new Date().toISOString(),
              },
            }
            : material));
          setMaterialSections((items) => items.map((section) => section.materialId === resource.id ? { ...section, analyzed: true } : section));
          pushAssistant(`「${resource.name}」AI 分析完成：识别 ${m.type}，生成解析链（章节→题目→知识点→七核）。`, "record");
          setExamAnalyzing(false);
        }
      }, 350 * (i + 1));
      materialAnalysisTimeoutsRef.current.push(timeoutId);
    });
  }

  // 真题分析（首个真 AI 意图）：调 DeepSeek 提取高频考点/七核并写入图谱；
  // 无 key / 失败 → 优雅降级到演示逻辑，并明确标注「演示回复」，绝不伪装成真实分析。
  async function runExamAnalysis(subjectName: string) {
    if (examAnalyzing) return;
    setExamAnalyzing(true);
    try {
    const subjectQuestions = questions.filter((q) => q.subject === subjectName);
    const steps: AgentStep[] = ["分析真题", "更新知识图谱", "生成学习笔记"].map((title) => ({ id: makeId("a"), title, status: "等待" }));
    setAgentSteps(steps);
    pushSystem(`正在用 DeepSeek 分析 ${subjectName || "当前科目"} 的真题…`, "action");

    const result = await analyzeExam(subjectName, subjectQuestions);

    if (result.ok && (result.cores.length > 0 || result.nodes.length > 0)) {
      const coreSummary = result.cores.slice(0, 5).map((c) => `${c.name}(${c.frequency})`).join("、");
      // 依据 AI 结果新增知识图谱节点（按知识点去重，明确标注来源）
      const newNodes: KnowledgeNode[] = result.nodes
        .filter((n) => n.knowledge && !nodes.some((ex) => ex.subject === subjectName && ex.knowledge === n.knowledge))
        .map((n) => ({
          id: makeId("k"),
          subject: subjectName,
          core: n.core || "核心考点",
          branch: n.branch || "",
          knowledge: n.knowledge,
          explanation: `AI 正式（DeepSeek）：${n.reason}`.slice(0, 300),
          prerequisite: "",
          related: "",
          masteryLevel: 0,
          masteryScore: 20,
          confidence: "低",
          round: currentSubject?.round || "第一轮",
          layer: currentSubject?.layer || "Layer 1",
          mistakes: 0,
          reviewRisk: "正常",
          isMonthlyFocus: false,
        }));
      if (newNodes.length) setNodes((items) => [...newNodes, ...items]);
      setPending((items) => [{ id: makeId("p"), kind: "图谱更新", title: `AI 正式分析：${subjectName} 高频考点`, subject: subjectName || "未分科", detail: `DeepSeek 识别 ${result.cores.length} 个核心、新增 ${newNodes.length} 个知识点；高频：${coreSummary || "—"}`, status: "待确认" }, ...items]);
      setNotes((items) => [{ id: makeId("n"), title: `真题分析（AI 正式 · DeepSeek）：${subjectName}`, body: `高频核心：${coreSummary || "—"}\n建议知识点：\n${result.nodes.slice(0, 12).map((n) => `· ${n.core}/${n.knowledge}——${n.reason}`).join("\n")}`, tags: ["AI正式", "真题分析", subjectName] }, ...items]);
      setAgentSteps(steps.map((s) => ({ ...s, status: "完成" })));
      pushSystem(`AI 正式分析完成（DeepSeek）：${result.cores.length} 个高频核心、新增 ${newNodes.length} 个知识点。`, "action");
    } else {
      // 降级演示（明确标注，不误导）
      const core = nodes.find((n) => n.subject === subjectName)?.core ?? "核心考点";
      const knowledge = nodes.find((n) => n.subject === subjectName)?.knowledge ?? "起始考点";
      setPending((items) => [{ id: makeId("p"), kind: "图谱更新", title: "真题分析结果（演示）", subject: subjectName || "未分科", detail: `建议提高 ${core} / ${knowledge} 的复习优先级`, status: "待确认" }, ...items]);
      setNotes((items) => [{ id: makeId("n"), title: "真题分析学习笔记（演示）", body: `演示回复：集中指向 ${core} / ${knowledge}。先补适用条件，再做综合题。`, tags: ["演示", "真题分析", core] }, ...items]);
      setAgentSteps(steps.map((s) => ({ ...s, status: "完成" })));
      pushSystem(`演示回复（${analyzeErrorReason(result.error)}，未接真模型）`, "action");
    }
    } finally {
      setExamAnalyzing(false);
    }
  }

  // 错因分析（第 2 个真 AI 意图）：取本学科最近的错题 → DeepSeek 归因 + 分层建议；
  // 无 key / 失败 → 优雅降级到规则回复，并明确标注「演示回复」。
  async function runMistakeAnalysis(subjectName: string) {
    const subject = subjectName || currentSubject?.name || "";
    const mistakes = questions.filter((q) => q.subject === subject && q.result === "错误").slice(0, 12);
    if (mistakes.length === 0) {
      pushAssistant(`当前 ${subject || "科目"} 暂无已标记「错误」的真题，可在真题库做题记录中标记错题。`);
      return;
    }
    pushSystem(`正在用 DeepSeek 分析 ${subject || "当前科目"} 的错因…`, "action");
    const result = await analyzeMistakes(subject, mistakes);
    if (result.ok && result.mistakes.length > 0) {
      const lines = result.mistakes.map((m) => `· ${m.reason}：${m.detail}（${m.questionRef}）→ ${m.suggestion}`).join("\n");
      pushAssistant(`错因分析（AI 正式 · DeepSeek）：${result.summary}\n${lines}`);
    } else {
      pushAssistant(`演示回复（${mistakesErrorReason(result.error)}，未接真模型）：近期错题集中在 ${mistakes[0]?.core || "核心考点"} 的适用条件判断，建议先重看条件再专项练习。`);
    }
  }

  async function runAgentWorkflow(input: string) {
    await runExamAnalysis(currentSubject?.name ?? "");
    generatePlan(input);
  }

  // 今日计划真生成（第 3 个真 AI 意图）：DeepSeek 基于知识点/错题/科目时长生成多任务计划；
  // 无 key / 失败 → 降级到本地 generatePlan，并诚实标注「演示回复」。
  async function runPlanGeneration() {
    pushSystem("正在用 DeepSeek 生成今日计划…", "action");
    const result = await generateTodayPlan(subjects, nodes);
    if (result.ok && result.tasks.length > 0) {
      const tasks: Task[] = result.tasks.map((t) => ({
        id: makeId("t"),
        title: t.title,
        subject: t.subject,
        core: t.core,
        branch: t.knowledge,
        round: t.round,
        layer: t.layer,
        source: "AI 正式（DeepSeek）",
        range: "今日重点",
        minutes: t.minutes,
        standard: "完成对应练习并能在无提示下讲清核心条件",
        reason: t.reason,
        backup: "",
        done: false, actualMinutes: "", difficulty: "2", mastery: "有些模糊", accuracy: "", needReview: true, mood: "正常", note: "", status: "待开始",
        aiRecommended: true,
        aiReasonForgetRate: t.priority === 1 ? "今日最高优先级" : "",
        aiReasonLayerStable: "",
        aiReasonMistakeCount: "",
        aiReasonExamFrequency: "",
        startedAt: "", estimatedCompletionMinutes: t.minutes,
        masteryBefore: 0, masteryAfter: 0, completedAt: "",
        relatedCardIds: [], relatedQuestionIds: [],
      }));
      setTasks(tasks);
      pushAssistant(`今日计划（AI 正式 · DeepSeek）：${result.summary}\n${result.tasks.map((t) => `· ${t.title}（${t.minutes} 分钟）— ${t.reason}`).join("\n")}`);
    } else {
      generatePlan("AI 指令：今天学什么");
      pushAssistant(`演示回复（${planErrorReason(result.error)}，未接真模型）：已按风险知识点生成今日任务。`);
    }
  }

  function searchQuestionsFromPrompt(text: string) {
    const keyword = extractQuestionKeyword(text);
    const keywordMatched = questions.filter((question) => {
      const haystack = `${question.year}${question.number}${question.stem}${question.core}${question.branch}${question.knowledge}${question.source}`;
      return !keyword || haystack.includes(keyword);
    });
    const fallbackSubject = activeKnowledgeSubject || currentSubject?.name || subjects[0]?.name || "";
    const subjectName = keywordMatched[0]?.subject || fallbackSubject;
    const matched = keywordMatched.filter((question) => question.subject === subjectName);
    setActiveView("knowledge");
    setActiveKnowledgeSubject(subjectName);
    setActiveKnowledgePanel("questions");
    setQuestionFilter({ subject: subjectName, core: "全部", result: "全部", keyword });
    if (matched.length > 0) {
      const summary = matched.slice(0, 3).map((q) => `${q.year} 第 ${q.number} 题：${q.knowledge}`).join("；");
      pushAssistant(`已检索真题库，找到 ${matched.length} 道相关真题：${summary}`);
    } else {
      pushAssistant(`已检索 ${subjectName} 真题库，暂未找到「${keyword || text}」相关题目。`);
    }
  }

  function runPrompt(prompt = chatInput) {
    const text = prompt.trim();
    if (!text) return;
    // UX Sprint P0: 用户消息写入当前 Session（无 Session 时自动创建；发送即标记为「正在学习」）
    const sessionId = ensureChatSession();
    setChatSessions((items) => items.map((s) => s.id === sessionId
      ? { ...s, title: s.title === "新对话" ? text.slice(0, 20) : s.title, status: "active", messages: [...s.messages, { id: makeId("m"), role: "user", content: text, createdAt: new Date().toISOString(), messageType: "chat" }] }
      : s));
    setChatInput("");
    // REVIEW_v6 P2：笔记/总结分支必须优先于「今天/学什么」——「把今天整理成笔记」含「今天」
    // 若「今天」分支在前会被误转发为「生成今日计划」。笔记分支提前后该快速 prompt 正确进笔记分支。
    if (text.includes("笔记") || text.includes("总结")) {
      setNotes((items) => [{ id: makeId("n"), title: "AI 生成笔记", body: "今日重点：先判断过程类型，再选择熵变公式。", tags: ["AI笔记", "热力学"] }, ...items]);
      pushAssistant("已生成成长笔记。");
      return;
    }
    if (text.includes("今天") || text.includes("学什么")) {
      runPlanGeneration();
      return;
    }
    if (text.includes("分析") && text.includes("真题") && (text.includes("更新") || text.includes("重排"))) {
      runAgentWorkflow(text);
      return;
    }
    if (text.includes("分析") && text.includes("真题")) {
      runExamAnalysis(currentSubject?.name ?? "");
      return;
    }
    if (text.includes("化学势") || (text.includes("真题") && text.includes("找"))) {
      searchQuestionsFromPrompt(text);
      return;
    }
    if (text.includes("傅献彩") || text.includes("哪里讲")) {
      const resource = resources.find((item) => item.name.includes("傅献彩"));
      if (resource) {
        setActiveResourceId(resource.id);
        setActiveKnowledgeSubject(resource.subject);
        setActiveKnowledgePanel("resources"); // Stabilization 1B-4: 真正进入 resources/Reader，而非 landing
        setReaderPage("132");
        setActiveView("knowledge");
        setNotice(`已打开：${resource.name} P132-140`);
        pushAssistant(`傅献彩《物理化学》第六版 P132-140 已关联到 热力学 / 熵与熵变 / 熵变计算。`);
      } else {
        pushAssistant("未找到傅献彩相关资源。");
      }
      return;
    }
    if (text.includes("错") || text.includes("不会")) {
      runMistakeAnalysis(currentSubject?.name ?? "");
      return;
    }
    if (text.includes("复习")) {
      setActiveView("cards");
      setCardSubjectView(activeCardSubject || currentSubject?.name || subjects[0]?.name || "");
      setActiveCardCategory(ALL_GROUPS);
      setCardSubView("待复习");
      pushAssistant(`已进入 ${activeCardSubject || currentSubject?.name || "当前科目"} 的成长卡片复习。`);
      return;
    }
    if (text.includes("卡片") || text.includes("填空卡") || text.includes("公式卡")) {
      createCardFromText("AI对话", text);
      setActiveView("cards");
      setCardSubjectView(activeCardSubject || currentSubject?.name || "");
      setActiveCardCategory(ALL_GROUPS);
      setCardSubView("待复习");
      return;
    }
    if (text.includes("第几轮")) {
      pushAssistant(`当前主要科目处于 ${currentSubject?.round ?? "第一轮"}，${currentSubject?.layer ?? "第 1 层"}。`);
      return;
    }
    pushAssistant("已收到。可以继续让我安排任务、检索真题、生成笔记或调整图谱。");
  }

  function addLog(input: string, output: string, accepted = "自动生成", dataRead = ["考试日期", "科目状态", "学习历史", "高风险节点"]) {
    setLogs((items) => [{ id: makeId("l"), time: today(), input, output, accepted, dataRead, userRevision: "待记录", finalResult: output, rating: "未评价", rework: "0" }, ...items]);
  }

  function recordStudyDay(minutes = 0, completedDelta = 0) {
    const date = dateOnly();
    setStudyDays((items) => {
      const exists = items.some((item) => item.date === date);
      const next = exists
        ? items.map((item) => item.date === date ? { ...item, completed: Math.max(0, item.completed + completedDelta), minutes: Math.max(0, item.minutes + minutes) } : item)
        : [...items, { date, completed: Math.max(0, completedDelta), minutes: Math.max(0, minutes) }];
      return next.slice(-MAX_STUDY_DAYS);
    });
  }

  const workspaceCtx: WorkspaceCtx = {
    coreNames, UNCATEGORIZED, ALL_GROUPS,
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
    subjectResources, subjectQuestions, subjectNodes, subjectAnnotations,
    setActiveView, setActiveKnowledgePanel, setActiveKnowledgeSubject, setResourceView, setReadingMode,
    setReaderPage, setReaderSearch, setReaderZoom, setResources, setQuestions, setQuestionFilter,
    setNodes, setLearningEvents,
    selectKnowledgeSubject, inferResource, openResource, openResourceDialog, closeResourceDialog,
    startUploadProgress, addResource, deleteResource, analyzeMaterial,
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
  };

  return (
    <WorkspaceProvider value={workspaceCtx}>
    <main>
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
            reviewCompletedTasks={reviewCompletedTasks} reviewNewNodes={reviewNewNodes}
            reviewQuestions={questions} reviewDoneQuestions={reviewDoneQuestions}
            reviewCards={cards} reviewReviewedCards={reviewReviewedCards}
            reviewMasteryDelta={reviewMasteryDelta} reviewAiSummary={reviewAiSummary}
            notes={notes}
            structuredReviews={structuredReviews}
            onOpenReviewDialog={() => setActiveDialog("review")}
          />
        )}

        {/* ─── Knowledge Center ─── */}
        {activeView === "knowledge" && <KnowledgeView />}

        {/* ─── Growth Cards 卡片中心（卡片组作为一级工作空间：成长卡片 → 卡片组 → 卡片）─── */}
        {activeView === "cards" && <CardsView />}

        {/* Settings Panel */}
        {activeView === "settings" && <SettingsView />}

        {/* ─── Completion Modal (Task result dialog) ─── */}
        {activeDialog === "task" && activeTask && (
          <div className="modal-backdrop" role="presentation" onClick={requestCloseTaskDialog}>
            <section className="modal-panel compact-modal" role="dialog" aria-modal="true" aria-label="记录学习结果" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head">
                <div><span>今日任务</span><strong>{activeTask.title}</strong></div>
                <button onClick={requestCloseTaskDialog}>关闭</button>
              </div>
              <div className="mini-form modal-form">
                {/* 时间信息 — 自动计算，可编辑 */}
                <div className="p-3 mb-3 rounded-[8px] bg-[#F4F4F5]">
                  <div className="text-[11px] font-bold text-[#52525B] mb-2">本次学习</div>
                  <div className="flex items-center gap-4 text-[12px]">
                    <span>开始 <strong>{activeTask.startedAt || timerStartTime || "--"}</strong></span>
                    <span>结束 <strong>{completionModalCustomEndTime}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[12px]">
                    <span>实际</span>
                    {completionModalAllowEditTime ? (
                      <input
                        className="w-[60px] min-h-[28px] text-[13px] text-center rounded border border-[#D4D4D8]"
                        value={completionModalCustomMinutes}
                        onChange={(e) => {
                          setCompletionModalCustomMinutes(e.target.value);
                          markTaskDraftDirty(activeTask, { customMinutes: e.target.value });
                        }}
                        autoFocus
                      />
                    ) : (
                      <strong className="text-[#0F766E]">{completionModalCustomMinutes} 分钟</strong>
                    )}
                    <span className="text-[#71717A]">分钟</span>
                    {!completionModalAllowEditTime ? (
                      <button
                        className="text-[11px] px-1.5 py-0.5 rounded bg-white text-[#71717A] hover:text-[#18181B] border border-[#D4D4D8]"
                        onClick={() => setCompletionModalAllowEditTime(true)}
                      >
                        ✏ 编辑
                      </button>
                    ) : (
                      <button
                        className="text-[11px] px-1.5 py-0.5 rounded bg-white text-[#0F766E] border border-[#0F766E]"
                        onClick={() => setCompletionModalAllowEditTime(false)}
                      >
                        确认
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] text-[#A1A1AA] mt-1">如中途暂停或接电话可点击编辑修改时间</div>
                </div>
                <label><span>掌握程度</span><select value={activeTask.mastery} onChange={(event) => {
                  const mastery = event.target.value as MasteryText;
                  updateTask(activeTask.id, { mastery });
                  markTaskDraftDirty(activeTask, { mastery });
                }}>{masteryOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>正确率%</span><input value={activeTask.accuracy} onChange={(event) => {
                  const accuracy = event.target.value;
                  updateTask(activeTask.id, { accuracy });
                  markTaskDraftDirty(activeTask, { accuracy });
                }} placeholder="可选" /></label>
                <label><span>学习状态</span><select value={activeTask.mood} onChange={(event) => {
                  const mood = event.target.value as StudyMood;
                  updateTask(activeTask.id, { mood });
                  markTaskDraftDirty(activeTask, { mood });
                }}>{moodOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className="wide-field"><span>困难/错因</span><input value={activeTask.note} onChange={(event) => {
                  const note = event.target.value;
                  updateTask(activeTask.id, { note });
                  markTaskDraftDirty(activeTask, { note });
                }} placeholder="例如：判断过程类型时容易混淆" /></label>
                <button onClick={() => { completeTask(activeTask.id); setActiveDialog(null); }} type="button">保存并完成</button>
              </div>
            </section>
          </div>
        )}

        {/* ─── UX Sprint: 关闭确认（存在未保存内容时）─── */}
        {closeConfirmPending && (
          <div className="modal-backdrop" role="presentation">
            <section className="modal-panel compact-modal" role="dialog" aria-modal="true" aria-label="放弃未保存的学习记录" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head">
                <div><span>未保存的内容</span><strong>放弃未保存的学习记录？</strong></div>
              </div>
              <div className="p-4">
                <p className="text-[13px] text-[#71717A] leading-relaxed mb-4">已填写的内容已自动保存为草稿，关闭后再次进入该任务仍可恢复，不会丢失。</p>
                <div className="flex justify-end gap-2">
                  <button
                    className="min-h-[34px] px-4 rounded-[8px] bg-[#F4F4F5] text-[#18181B] font-bold text-[13px]"
                    onClick={() => setCloseConfirmPending(false)}
                  >
                    继续编辑
                  </button>
                  <button
                    className="min-h-[34px] px-4 rounded-[8px] bg-[#18181B] text-white font-bold text-[13px]"
                    onClick={() => { setCloseConfirmPending(false); setActiveDialog(null); }}
                  >
                    放弃退出
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

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
        <OnboardingWizard onComplete={completeOnboarding} onLoadDemo={loadDemoProject} />
      )}
    </main>
    </WorkspaceProvider>
  );
}
