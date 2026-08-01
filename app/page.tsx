"use client";

import { useState, useRef, useEffect, type FormEvent, type MouseEvent as ReactMouseEvent } from "react";
import type {
  Risk, MasteryText, StudyMood, WorkspaceView, KnowledgePanel,
  DashboardPanel, ReviewScope, ActiveDialog, DeletedBackup,
  ExamGoal, Resource, Question, KnowledgeNode, Task,
  PendingItem, Review, PlanLog, StudyDay,
  GrowthCard, Annotation, AgentStep, StudyDraft, AgentMessage, ChatSession, CardCategory,
  StructuredReview
} from "./lib/types";
import {
  seedExam, seedSubjects, seedResources, seedQuestions, seedNodes,
  seedTasks, seedNotes, seedCards, seedAnnotations, seedAppSettings,
  seedStudyDays, seedCardCategories
} from "./lib/default-data";
import { TASK, TOAST_DURATION, MAX_STUDY_DAYS, MAX_DATE_RANGE_DAYS } from "./lib/rules";
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
import { CardViewer, FocusMode } from "./components/CardViewer";
import { ReaderPanel } from "./components/ReaderPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { OnboardingWizard, type OnboardingResult } from "./components/OnboardingWizard";
import { analyzeExam, analyzeErrorReason } from "./lib/ai/analyze-exam";
import { ChatPanel } from "./components/ChatPanel";

const quickPrompts = ["今天学什么", "找近五年化学势真题", "傅献彩哪里讲这个", "为什么总错这类题", "把今天整理成笔记", "分析最近三套真题，更新图谱并重排计划", "我现在属于第几轮"];
const masteryOptions: MasteryText[] = ["完全不懂", "有些模糊", "基本理解", "能够讲清", "能够迁移"];
const moodOptions: StudyMood[] = ["较差", "一般", "正常", "较好", "很好"];
const coreNames = ["热力学", "相平衡", "化学动力学", "电化学", "统计热力学", "表面与胶体", "实验与综合"];
// UX Sprint: 消息时间格式化（当天 HH:mm；非当天 M月D日 HH:mm；跨年 YYYY年M月D日 HH:mm）
function formatMessageTime(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const sameDay = sameYear && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `${hh}:${mm}`;
  if (sameYear) return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}

let _idCounter = 0;
function makeId(prefix: string) {
  _idCounter++;
  return `${prefix}-${Date.now()}-${_idCounter}-${Math.random().toString(16).slice(2)}`;
}
function today() {
  return new Date().toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" });
}
function dateOnly(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  // 统一按 Asia/Shanghai 计算“日期”，与 today() 保持一致（en-CA 输出 YYYY-MM-DD）
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}
function normalizeExamGoal(goal: ExamGoal): ExamGoal {
  return { ...seedExam, ...goal, startDate: goal.startDate ?? seedExam.startDate ?? "2026-07-30" };
}
function dateRange(start: string, end: string) {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime > endTime) return [dateOnly()];
  const days = Math.min(MAX_DATE_RANGE_DAYS, Math.floor((endTime - startTime) / 86400000) + 1);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(startTime);
    date.setDate(date.getDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

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
  const [cardMode] = useState("背诵");
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  // 编辑卡片弹窗当前编辑的卡片 id（null = 新建）
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  // 正在编辑的卡片（仅编辑弹窗使用；避免卡片列表变化时闪动）
  const editingCard = editingCardId ? cards.find((c) => c.id === editingCardId) ?? null : null;
  // ─── 卡片中心：卡片组作为一级工作空间（成长卡片 → 卡片组 → 卡片）───
  // null = 成长卡片首页（仅管理/展示卡片组）；有值 = 卡片组学习空间
  const [cardSubjectView, setCardSubjectView] = useState<string | null>(null);
  // 卡片组学习空间内子视图：待复习 / 全部 / 按七核 / 按掌握状态（统计/筛选/翻卡全部在卡片组内完成）
  const [cardSubView, setCardSubView] = useState<"待复习" | "全部" | "按七核" | "按掌握状态">("待复习");
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
  // 当前激活会话（无会话时返回 null，ChatPanel 显示欢迎界面）
  const activeChatSession = chatSessions.find((s) => s.id === activeSessionId) ?? null;
  const activeChatMessages = activeChatSession?.messages ?? [];

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
  const reviewedTodayCards = subjectCards.filter((card) => card.lastReviewed !== "未复习" && card.lastReviewed.slice(0, 10) === hydratedTodayStr);
  const cardQueue = dueCards.length ? dueCards : subjectCards;
  // UX Sprint: 卡片中心学科 Tab 分组统计（当前学科待复习/全部/今日已复习）
  const subjectCardStats = subjects.map((subject) => {
    const subjectCardList = cards.filter((card) => card.subject === subject.name);
    const due = subjectCardList.filter((card) => card.mastery === "不会" || card.mastery === "模糊" || card.lastReviewed === "未复习" || !card.nextReviewAt || card.nextReviewAt <= hydratedTodayStr);
    const reviewedToday = subjectCardList.filter((card) => card.lastReviewed !== "未复习" && card.lastReviewed.slice(0, 10) === hydratedTodayStr);
    return { subject, total: subjectCardList.length, due: due.length, reviewedToday: reviewedToday.length };
  });
  // UX Sprint: 当前学科的自定义分类（只显示当前学科，隔离其他学科分类）
  const subjectCategories = categories.filter((cat) => {
    const subject = subjects.find((s) => s.name === activeCardSubject);
    return subject ? cat.subjectId === subject.id : false;
  });
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
  const uncategorizedCardCount = uncategorizedCards.length;
  // 进入卡片组后只在该卡片组范围内复习（待复习优先）
  const categoryQueueCards = currentCategoryCards.filter((c) => c.mastery === "不会" || c.mastery === "模糊" || c.lastReviewed === "未复习" || !c.nextReviewAt || c.nextReviewAt <= hydratedTodayStr);
  const categoryReviewQueue = categoryQueueCards.length ? categoryQueueCards : currentCategoryCards;
  // 卡片组队列变化时把 index 夹在有效范围内（分类/全部卡片独立于学科总队列）
  const categoryClampedCardIndex = Math.min(Math.max(cardIndex, 0), Math.max(categoryReviewQueue.length - 1, 0));
  const activeGroupCard = categoryReviewQueue[categoryClampedCardIndex] ?? null;
  // 队列变化时把 index 夹在有效范围内（派生值，避免在 effect 里 setState 造成级联渲染）
  const clampedCardIndex = Math.min(Math.max(cardIndex, 0), Math.max(cardQueue.length - 1, 0));
  const activeCard = cardQueue[clampedCardIndex];
  const subjectResources = resources.filter((resource) => resource.subject === activeKnowledgeSubject);
  // UX Sprint（学科隔离）: activeResource 只在当前学科资源内查找，禁止跨学科回退到其他科目
  const activeResource = subjectResources.find((resource) => resource.id === activeResourceId) ?? subjectResources[0] ?? null;
  const subjectQuestions = questions.filter((question) => question.subject === activeKnowledgeSubject);
  const subjectNodes = nodes.filter((node) => node.subject === activeKnowledgeSubject);
  const subjectAnnotations = annotations.filter((annotation) => subjectResources.some((resource) => resource.id === annotation.resourceId));
  const relatedQuestions = questions.filter((question) => activeResource && question.subject === activeResource.subject && (activeResource.linkedNode.includes(question.core) || activeResource.linkedNode.includes(question.branch)));
  // UX Sprint（学科隔离）: 真题查询默认锁定当前学科，不允许跨学科展示
  const filteredQuestions = questions.filter((question) => {
    const bySubject = question.subject === activeKnowledgeSubject;
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
    if (summary.warnings > 0) {
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
    if (!data) return; // 无任何存档 → 新用户，onboardingCompleted 保持 false → 显示初始化向导
    try {
      // 老用户（已有存档但无该字段）默认视为已完成，不再弹向导
      setOnboardingCompleted((data.onboardingCompleted as boolean | undefined) ?? true);
      if (data.exam) setExam(normalizeExamGoal(data.exam));
      if (data.appSettings) setAppSettings(data.appSettings);
      if (data.subjects) setSubjects(data.subjects);
      if (data.activeKnowledgeSubject) setActiveKnowledgeSubject(data.activeKnowledgeSubject);
      if (data.activeCardSubject) setActiveCardSubject(data.activeCardSubject);
      if (data.resources) setResources(data.resources);
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
        setChatSessions(data.chatSessions);
        setActiveSessionId(data.activeSessionId || data.chatSessions[0].id);
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
    }
    // 仅在挂载时从 localStorage 恢复一次；runTimerFrom 为稳定语义，无需列入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ─── Storage Contract 1C-1: 唯一 save 入口（防抖持久化，避免每次按键都全量序列化写盘 #3）───
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latestSnapshotRef = useRef<string>("");
  useEffect(() => {
    latestSnapshotRef.current = JSON.stringify({
      exam, appSettings, subjects, activeKnowledgeSubject, activeCardSubject,
      resources, questions, nodes, tasks, pending, notes, cards, annotations,
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
      resources, questions, nodes, tasks, pending, notes, cards, annotations,
      activeResourceId, readerSearch, readerPage, readerZoom,
      studyDays, agentSteps, logs, chatSessions, activeSessionId, review, structuredReviews, studyDraft, categories,
      onboardingCompleted,
      activeTimerTaskId, timerStartTime, timerAccumSeconds, timerRunStartEpoch]);

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

  async function addResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file") as File | null;
    const rawName = String(file?.name || form.get("sourceText") || "").trim();
    if (!rawName) return;
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
    if (file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
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
        pushAssistant(`PDF 已保存并可阅读：${resource.name}。`);
      } catch (err) {
        pushAssistant(`PDF 保存失败：${String(err)}`);
        setActiveDialog(null);
        return;
      }
    } else {
      // 演示/非 PDF 资源：上传即自动生效，不再进入「待确认」队列
      setResources((items) => [base, ...items]);
      pushAssistant(`已添加演示/空白资料：${base.name}。`);
    }
    setActiveKnowledgeSubject(inferred.subject);
    setActiveDialog(null);
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

  function addQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const stem = String(form.get("stem") ?? "").trim();
    if (!stem) return;
    const question: Question = {
      id: makeId("q"),
      // Stabilization 1B-2: 新题默认属于当前激活科目（不再默认 subjects[0]）
      subject: String(form.get("subject") ?? activeKnowledgeSubject ?? subjects[0]?.name ?? ""),
      school: String(form.get("school") ?? exam.school),
      year: String(form.get("year") ?? ""),
      number: String(form.get("number") ?? ""),
      type: String(form.get("type") ?? "未知题型"),
      score: String(form.get("score") ?? ""),
      stem,
      answer: String(form.get("answer") ?? ""),
      originalAnalysis: String(form.get("originalAnalysis") ?? ""),
      aiAnalysis: "待 AI 补充解析",
      difficulty: String(form.get("difficulty") ?? "3"),
      core: String(form.get("core") ?? coreNames[0]),
      branch: String(form.get("branch") ?? ""),
      knowledge: String(form.get("knowledge") ?? ""),
      layer: String(form.get("layer") ?? "第 2 层"),
      done: false,
      result: "未做",
      errorReason: "",
      note: "",
      source: "手动录入",
      confirmed: false,
      favorite: false,
    };
    setQuestions((items) => [question, ...items]);
    setPending((items) => [{ id: makeId("p"), kind: "真题识别", title: `${question.year} ${question.subject} 第 ${question.number} 题`, subject: question.subject, detail: `建议关联到 ${question.core} / ${question.branch} / ${question.knowledge}`, status: "待确认", targetId: question.id }, ...items]);
    // Stabilization 1B-2: 跨科目创建 → 明确跳转到该科目；同科目 → 在当前列表立即可见
    if (question.subject !== activeKnowledgeSubject) {
      setActiveKnowledgeSubject(question.subject);
    }
    pushAssistant(`题目已保存到 ${question.subject}：${question.year} 第 ${question.number} 题`);
    setActiveDialog(null);
    event.currentTarget.reset();
  }

  function deleteQuestion(item: Question) {
    setLastDeleted({ collection: "questions", item, label: `${item.year} 第 ${item.number} 题` });
    setQuestions((items) => items.filter((question) => question.id !== item.id));
    setNotice(`已删除真题：${item.year} 第 ${item.number} 题`);
  }

  function addNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const knowledge = String(form.get("knowledge") ?? "").trim();
    if (!knowledge) return;
    const node: KnowledgeNode = {
      id: makeId("k"),
      subject: String(form.get("subject") ?? subjects[0]?.name ?? ""),
      core: String(form.get("core") ?? coreNames[0]),
      branch: String(form.get("branch") ?? ""),
      knowledge,
      explanation: String(form.get("explanation") ?? ""),
      prerequisite: String(form.get("prerequisite") ?? ""),
      related: String(form.get("related") ?? ""),
      masteryLevel: Number(form.get("masteryLevel") ?? 0),
      masteryScore: Number(form.get("masteryScore") ?? 0),
      confidence: "低",
      round: "第一轮",
      layer: "第 1 层",
      mistakes: 0,
      reviewRisk: "正常",
      isMonthlyFocus: false,
    };
    setNodes((items) => [node, ...items]);
    setActiveKnowledgeSubject(node.subject);
    pushAssistant(`已添加知识点：${node.knowledge}（${node.core} / ${node.branch}）`);
    setActiveDialog(null);
    event.currentTarget.reset();
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

  function saveRenameCardInline() {
    if (!renamingCardId) return;
    const name = renamingCardName.trim().slice(0, 30);
    if (!name) { setNotice("名称不能为空"); setRenamingCardId(null); return; }
    if (subjectCategories.some((c) => c.id !== renamingCardId && c.name === name)) { setNotice("卡片组名称已存在"); return; }
    setCategories((items) => items.map((c) => c.id === renamingCardId ? { ...c, name, updatedAt: today() } : c));
    setRenamingCardId(null);
    setRenamingCardName("");
    setCardMenuOpenId(null);
    setNotice(`已重命名为「${name}」`);
  }

  function confirmDeleteCard() {
    if (!deletingCardId) return;
    setCategories((items) => items.filter((c) => c.id !== deletingCardId));
    // 删除卡片组 → 卡片移入未分类（categoryId 置空），不影响卡片内容
    setCards((items) => items.map((c) => c.categoryId === deletingCardId ? { ...c, categoryId: undefined } : c));
    // 若正在该卡片组的学习空间内，删除后返回成长卡片首页
    if (activeCardCategory === deletingCardId) {
      setActiveCardCategory(null);
      setCardSubjectView(null);
    }
    setDeletingCardId(null);
    setCardMenuOpenId(null);
    setNotice("已删除卡片组，卡片已移入「未分类」");
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
    setTasks((items) => {
      const index = items.findIndex((task) => task.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= items.length) return items;
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
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
    // UX Sprint: 保存并完成才真正生成学习记录 → 清空该任务草稿
    setStudyDraft((prev) => (prev && prev.taskId === id ? null : prev));
    const actualMinutesValue = completionModalAllowEditTime ? completionModalCustomMinutes : (task.actualMinutes || String(Math.max(1, Math.round(elapsedSeconds / 60))));
    const endTimeStr = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    updateTask(id, {
      done: true,
      status: "已完成",
      actualMinutes: actualMinutesValue,
      completedAt: endTimeStr,
    });
    recordTaskDone(task, Number(actualMinutesValue || task.minutes || 0));
    const accuracyNumber = Number(task.accuracy || 0);
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

  async function runAgentWorkflow(input: string) {
    await runExamAnalysis(currentSubject?.name ?? "");
    generatePlan(input); // 重排计划仍为演示逻辑（“今日计划真生成”是后续意图）
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
    if (text.includes("今天") || text.includes("学什么")) {
      generatePlan("AI 指令：今天学什么");
      pushAssistant("已按今日风险知识点重新安排计划。");
      return;
    }
    if (text.includes("分析") && text.includes("真题") && (text.includes("更新") || text.includes("重排"))) {
      runAgentWorkflow(text);
      return;
    }
    if (text.includes("化学势") || (text.includes("真题") && text.includes("找"))) {
      pushAssistant("这个请求需要调用真题数据库筛选，真题库将在 Knowledge Center 恢复后接通。");
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
      pushAssistant("近几次错误集中在适用条件判断。规则引擎建议延长第 2 层，不进入第 4 层。");
      return;
    }
    if (text.includes("笔记") || text.includes("总结")) {
      setNotes((items) => [{ id: makeId("n"), title: "AI 生成笔记", body: "今日重点：先判断过程类型，再选择熵变公式。", tags: ["AI笔记", "热力学"] }, ...items]);
      pushAssistant("已生成成长笔记。");
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

  return (
    <main>
      <Sidebar
        daysLeft={daysLeft} exam={exam} totalTargetScore={totalTargetScore} overallProgress={overallProgress}
        heatmapStartFormatted={heatmapStartFormatted} heatmapMonths={heatmapMonths} dayLabels={dayLabels} heatmapGrid={heatmapGrid}
        todayStr={todayStr} examDate={exam.examDate} tooltipData={tooltipData} tooltipVisible={tooltipVisible}
        heatmapDays={heatmapDays} cardsByDate={cardsByDate}
        activeView={activeView} setActiveView={setActiveView}
        heatmapRef={heatmapRef}
        onCellMouseEnter={onCellMouseEnter} onCellMouseLeave={onCellMouseLeave} onCellClick={onCellMouseEnter}
        setTooltipVisible={setTooltipVisible} setTooltipData={setTooltipData}
      />

      <div className={styles.mainContent}>
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

        {activeView === "dashboard" && activeDashboardPanel === "tasks" && (
          <section className="hero-grid workspace-pane active dashboard-hero" id="agent">
            {/* AI Summary Card — only independent parts (no chat, no runPrompt) */}
            <div className="agent-panel">
              <div className="section-label">AI Workspace</div>
              <h1>AI 学习助手</h1>
              <div className="quick-prompts">
                {quickPrompts.map((prompt) => <button key={prompt} onClick={() => runPrompt(prompt)}>{prompt}</button>)}
              </div>
              {agentSteps.length > 0 && (
                <div className="agent-run">
                  {agentSteps.map((step, index) => (
                    <div key={step.id}>
                      <span>{index + 1}</span>
                      <strong>{step.title}</strong>
                      <b>{step.status}</b>
                    </div>
                  ))}
                </div>
              )}
              {/* Dashboard 小窗：展示当前 Session 最近 3 条 AI 对话（不含系统记录） */}
              <div className="chat-window min-h-[180px]">
                {activeChatMessages.filter((m) => m.role !== "system").slice(-3).map((message) => (
                  <div className={`bubble ${message.role}`} key={message.id}>
                    {message.content}
                    <span className="mt-1 block text-right text-[11px] text-[#A1A1AA]">{formatMessageTime(message.createdAt)}</span>
                  </div>
                ))}
                {activeChatMessages.filter((m) => m.role !== "system").length === 0 && (
                  <p className="text-[12px] text-[#A1A1AA]">输入消息开始对话，或进入 AI 助手查看完整聊天。</p>
                )}
              </div>
            </div>

            {/* Engine Panel — Tasks */}
            <div className="engine-panel" id="today">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="section-label">今日学习</div>
                  <h2 className="mb-0">任务与完成记录</h2>
                </div>
                <button className="secondary-button shrink-0" onClick={() => generatePlan()}>重新生成今日计划</button>
              </div>
              {/* AI 总览 */}
              <div className="mt-4 p-4 rounded-[8px] bg-[#F4F4F5]">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <strong className="text-[14px]">今日建议</strong>
                  <span className="text-[12px] text-[#71717A]">AI 生成 · 基于遗忘曲线和考试时间</span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-[#71717A] mb-2">
                  <span>预计：<strong className="text-[#18181B]">{tasks.reduce((s, t) => s + t.minutes, 0)} 分钟</strong></span>
                  <span>完成：<strong className="text-[#18181B]">{tasks.length} 个任务</strong></span>
                  <span>掌握度提升：<strong className="text-[#18181B]">+{Math.round(tasks.reduce((s, t) => s + (t.masteryAfter - t.masteryBefore), 0) / Math.max(tasks.length, 1))}%</strong></span>
                </div>
                {tasks.some((t) => t.aiRecommended) && <p className="text-[12px] text-[#71717A]">AI 判断：今天不建议进入新章节。优先稳定熵变计算。</p>}
              </div>
              <div className="mt-4 task-stack">
                {tasks.map((task) => (
                  <article className={`task-row ${task.done ? "done" : ""}`} key={task.id}>
                    <label className="task-check">
                      <input type="checkbox" checked={task.done} onChange={() => toggleTaskDone(task)} />
                    </label>
                    <div className="task-content">
                      <div className="task-title-row">
                        <strong>{task.title}</strong>
                        {task.aiRecommended && <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#EDEDED] text-[#52525B] font-bold">AI推荐</span>}
                        <span className="task-duration">{task.estimatedCompletionMinutes || task.minutes} 分钟</span>
                      </div>
                      <span className="text-[12px]">{task.subject} / {task.core} / {task.branch} / {task.round} / {task.layer}</span>
                      {/* 掌握度变化 */}
                      <div className="flex items-center gap-2 text-[12px] text-[#71717A] mt-0.5">
                        <span>掌握度</span>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-[#18181B]">{task.masteryBefore}%</span>
                          <span className="text-[#A1A1AA]">→</span>
                          <span className="font-bold text-[#18181B]">{task.masteryAfter}%</span>
                        </div>
                      </div>
                      {/* AI 推荐原因 */}
                      {task.aiRecommended && (
                        <div className="mt-1.5 p-2 rounded-[6px] bg-[#F4F4F5]">
                          <div className="text-[11px] font-bold text-[#52525B] mb-1">AI 推荐原因</div>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-[#71717A]">
                            {task.aiReasonForgetRate && <span>• {task.aiReasonForgetRate}</span>}
                            {task.aiReasonLayerStable && <span>• {task.aiReasonLayerStable}</span>}
                            {task.aiReasonMistakeCount && <span>• {task.aiReasonMistakeCount}</span>}
                            {task.aiReasonExamFrequency && <span>• {task.aiReasonExamFrequency}</span>}
                          </div>
                        </div>
                      )}
                      <p className="text-[12px] mt-1">{task.standard}</p>
                      {/* 学习中实时信息 */}
                      {activeTimerTaskId === task.id && (
                        <div className="mt-2 p-2 rounded-[6px] bg-[#F4F4F5]">
                          <div className="flex items-center justify-between gap-2 text-[12px] mb-1">
                            <span className={`font-bold ${task.status === "暂停" ? "text-[#F59E0B]" : "text-[#52525B]"}`}>
                              {task.status === "暂停" ? "● 已暂停" : "● 学习中"}
                            </span>
                            <span className="text-[#71717A]">开始 {timerStartTime}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[12px]">
                            <span className="text-[#71717A]">已学习</span>
                            <span className="font-bold text-[#18181B]">{Math.floor(elapsedSeconds / 60)} 分钟 {elapsedSeconds % 60} 秒</span>
                            <span className="text-[#A1A1AA]">| 预计 {task.estimatedCompletionMinutes || task.minutes} 分钟</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#D4D4D8] overflow-hidden mt-1.5">
                            <div className="h-full rounded-full bg-[#0F766E] transition-all duration-500"
                              style={{ width: `${Math.min(100, (elapsedSeconds / 60) / (task.estimatedCompletionMinutes || task.minutes) * 100)}%` }} />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[#71717A] mt-0.5">
                            <span>{Math.floor(elapsedSeconds / 60)} / {task.estimatedCompletionMinutes || task.minutes} min</span>
                            <span>剩余 {Math.max(0, (task.estimatedCompletionMinutes || task.minutes) - Math.floor(elapsedSeconds / 60))} 分钟</span>
                          </div>
                        </div>
                      )}
                      {/* 操作区 */}
                      <div className="task-actions">
                        {activeTimerTaskId === task.id ? (
                          <>
                            {task.status === "暂停" ? (
                              <>
                                <button className="min-h-[30px] px-4 rounded-[6px] bg-[#F59E0B] text-white font-bold text-[12px]" type="button"
                                  onClick={() => resumeTimer(task)}>
                                  继续学习
                                </button>
                                <button className="min-h-[30px] px-3 rounded-[6px] bg-[#18181B] text-white font-bold text-[12px]" type="button"
                                  onClick={() => handleEndLearning(task)}>结束学习</button>
                              </>
                            ) : (
                              <>
                                <button className="min-h-[30px] px-4 rounded-[6px] bg-[#0F766E] text-white font-bold text-[12px]" type="button">⏱ 学习中</button>
                                <button className="min-h-[30px] px-3 rounded-[6px] bg-[#F4F4F5] text-[#18181B] font-bold text-[12px]" type="button"
                                  onClick={() => pauseTimer(task)}>暂停</button>
                                <button className="min-h-[30px] px-3 rounded-[6px] bg-[#18181B] text-white font-bold text-[12px]" type="button"
                                  onClick={() => handleEndLearning(task)}>结束学习</button>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <button className="min-h-[30px] px-4 rounded-[6px] bg-[#18181B] text-white font-bold text-[12px]" type="button"
                              onClick={() => startTask(task)}>开始学习</button>
                            <button className="min-h-[30px] px-3 rounded-[6px] bg-[#F4F4F5] text-[#71717A] text-[12px]" type="button"
                              onClick={() => openTaskDialog(task)}>记录结果</button>
                          </>
                        )}
                        <details className="more-menu">
                          <summary className="text-[12px] min-h-[28px] px-2 rounded-[6px] bg-[#F4F4F5] text-[#71717A] font-bold">•••</summary>
                          <div className="more-items">
                            <button className="text-button text-[12px]" type="button" onClick={() => moveTask(task.id, -1)}>提高优先级</button>
                            <button className="text-button text-[12px]" type="button" onClick={() => moveTask(task.id, 1)}>降低优先级</button>
                            <button className="text-button text-[12px]" type="button"
                              onClick={() => { updateTask(task.id, { status: "延期" }); setNotice(`已延期：${task.title}`); }}>延期到明天</button>
                            <button className="text-button text-[12px]" type="button"
                              onClick={() => { updateTask(task.id, { status: "暂停" }); setNotice(`已暂停：${task.title}`); }}>暂停任务</button>
                          </div>
                        </details>
                      </div>
                      {/* 详情折叠 */}
                      <details className="inline-details">
                        <summary className="text-[12px] text-[#71717A] font-bold">▼ 查看详情</summary>
                        <div className="flex flex-wrap gap-2 mt-2 p-2 rounded bg-[#F4F4F5]">
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-white whitespace-nowrap">教材：{task.source}</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-white whitespace-nowrap">范围：{task.range}</span>
                          {task.reason && <span className="text-[11px] text-[#71717A] w-full mt-1">原因：{task.reason}</span>}
                        </div>
                      </details>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ─── Agent 独立页面（Conversation UX v2: 三栏固定布局）─── */}
        {activeView === "agent" && (
          <section className="workflow workspace-pane active" id="ai-assistant">
            <ChatPanel
              sessions={chatSessions}
              activeSessionId={activeSessionId || chatSessions[0]?.id || ""}
              currentSubject={activeCardSubject || currentSubject?.name || ""}
              currentResource={activeResource?.name || ""}
              currentPage={activeResource?.currentPage || ""}
              onSelectSession={(id) => { setActiveSessionId(id); activeSessionIdRef.current = id; }}
              onNewSession={newChatSession}
              onSend={(content) => runPrompt(content)}
              onRenameSession={(id, title) => {
                setChatSessions((items) => items.map((s) => s.id === id ? { ...s, title } : s));
                setNotice("已重命名会话");
              }}
              onDeleteSession={(id) => {
                setChatSessions((items) => items.filter((s) => s.id !== id));
                if (activeSessionId === id) {
                  const next = chatSessions.find((s) => s.id !== id) ?? null;
                  setActiveSessionId(next?.id ?? "");
                  activeSessionIdRef.current = next?.id ?? "";
                }
                setNotice("已删除会话");
              }}
              onTogglePinned={(id) => {
                setChatSessions((items) => items.map((s) => s.id === id ? { ...s, pinned: !(s as ChatSession & { pinned?: boolean }).pinned } : s));
              }}
              onUpdateSessionStatus={(id, status) => {
                setChatSessions((items) => items.map((s) => s.id === id ? { ...s, status } : s));
                setNotice(status === "completed" ? "已标记为已完成" : "已恢复学习");
              }}
              historyOpen={chatHistoryOpen}
              setHistoryOpen={setChatHistoryOpen}
            />
          </section>
        )}

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
        {activeView === "knowledge" && (
          <section className={`knowledge workspace-pane ${activeView === "knowledge" ? "active" : ""}`} id="knowledge-center">
            {/* 知识中心首页：科目 Tab + 三个入口 */}
            {activeKnowledgePanel === "landing" && (
              <div>
                <div className="section-heading">
                  <div><div className="section-label">Knowledge Center</div><h2>知识中心</h2></div>
                </div>
                {/* 科目 Tab */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {subjects.map((subject) => (
                    <button
                      key={subject.id}
                      className={`min-h-[30px] px-3 rounded-[8px] font-bold text-[12px] ${
                        activeKnowledgeSubject === subject.name
                          ? "bg-[#18181B] text-white"
                          : "bg-[#F4F4F5] text-[#18181B]"
                      }`}
                      onClick={() => setActiveKnowledgeSubject(subject.name)}
                    >
                      {subject.name}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button className="p-6 rounded-[12px] border border-[#E4E4E7] bg-white text-left hover:shadow-md transition-shadow" onClick={() => { setActiveKnowledgePanel("resources"); }}>
                    <div className="text-[24px] mb-2">📚</div>
                    <strong className="text-[16px] block mb-1">学习资料</strong>
                    <span className="text-[13px] text-[#71717A]">{subjectResources.length} 个资料</span>
                  </button>
                  <button className="p-6 rounded-[12px] border border-[#E4E4E7] bg-white text-left hover:shadow-md transition-shadow" onClick={() => { setActiveKnowledgePanel("questions"); }}>
                    <div className="text-[24px] mb-2">📝</div>
                    <strong className="text-[16px] block mb-1">真题数据库</strong>
                    <span className="text-[13px] text-[#71717A]">{subjectQuestions.length} 道真题</span>
                  </button>
                  <button className="p-6 rounded-[12px] border border-[#E4E4E7] bg-white text-left hover:shadow-md transition-shadow" onClick={() => { setActiveKnowledgePanel("graph"); }}>
                    <div className="text-[24px] mb-2">🧠</div>
                    <strong className="text-[16px] block mb-1">知识图谱</strong>
                    <span className="text-[13px] text-[#71717A]">{subjectNodes.length} 个知识点</span>
                  </button>
                </div>
              </div>
            )}

            {/* 非 landing：面包屑返回 */}
            {activeKnowledgePanel !== "landing" && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <button className="text-[12px] text-[#71717A] hover:text-[#18181B]" onClick={() => setActiveKnowledgePanel("landing")}>← 返回资源总览</button>
                  <div className="flex-1" />
                </div>

                {/* Resources */}
                {activeKnowledgePanel === "resources" && (
                  <div>
                    <div className="section-heading compact-heading">
                      <div><div className="section-label">AI First</div><h2>学习资源库</h2><p className="section-hint">上传并识别，AI识别结果进入待确认队列。</p></div>
                      <button className="secondary-button" onClick={() => setActiveDialog("resource")}>上传资源</button>
                    </div>

                    {/* 上传资源 Modal — 文件选择 + AI 识别状态机 */}
                    {activeDialog === "resource" && (
                      <div className="modal-backdrop" role="presentation" onClick={() => setActiveDialog(null)}>
                        <section className="modal-panel" role="dialog" aria-modal="true" aria-label="AI识别资料" onClick={(event) => event.stopPropagation()}>
                          <div className="modal-head"><div><span>AI First</span><strong>AI识别资料</strong></div><button onClick={() => setActiveDialog(null)}>关闭</button></div>
                          <form onSubmit={addResource} className="modal-form">
                            <label className="upload-drop" style={{ minHeight: '140px', transition: 'all 0.3s ease' }}>
                              <span style={{ fontSize: '18px' }}>📁 拖拽文件到此处</span>
                              <span style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>或点击选择 支持 PDF / Word / 图片</span>
                              <input name="file" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const rawName = file.name;
                                const inferred = inferResource(rawName, "");
                                setFileUploadState({ name: file.name, size: file.size, inferred, step: "uploading" });
                                setTimeout(() => { setFileUploadState((prev) => { if (!prev) return prev; return { ...prev, step: "extracting" }; }); }, 400);
                                setTimeout(() => { setFileUploadState((prev) => { if (!prev) return prev; return { ...prev, step: "identifying" }; }); }, 900);
                                setTimeout(() => { setFileUploadState((prev) => { if (!prev) return prev; return { ...prev, step: "parsing" }; }); }, 1500);
                                setTimeout(() => { setFileUploadState((prev) => { if (!prev) return prev; return { ...prev, step: "mapping" }; }); }, 2100);
                                setTimeout(() => { setFileUploadState((prev) => { if (!prev) return prev; return { ...prev, step: "done" }; }); }, 2600);
                              }} />
                            </label>
                            {fileUploadState && (
                              <div className="p-3 mt-3 rounded-[8px] border border-[#E4E4E7] bg-white flex items-center gap-3">
                                <span style={{ fontSize: '22px' }}>📄</span>
                                <div className="flex-1 min-w-0">
                                  <strong className="text-[14px] block truncate">{fileUploadState.name}</strong>
                                  <span className="text-[12px] text-[#71717A]">{(fileUploadState.size / (1024 * 1024)).toFixed(1)} MB · {fileUploadState.inferred.pages.includes("AI识别") ? "AI识别中" : fileUploadState.inferred.pages}</span>
                                  {fileUploadState.step !== "done" && (
                                    <div className="mt-1 flex items-center gap-1 text-[11px] text-[#71717A]">
                                      {["uploading", "extracting", "identifying", "parsing", "mapping"].map((s) => {
                                        const stages = ["uploading", "extracting", "identifying", "parsing", "mapping"];
                                        const curIdx = stages.indexOf(fileUploadState.step);
                                        const thisIdx = stages.indexOf(s);
                                        return <span key={s} className={thisIdx < curIdx ? "text-[#0F766E]" : thisIdx === curIdx ? "text-[#18181B] font-bold" : "opacity-40"}>{thisIdx < curIdx ? "✓" : "·"}</span>;
                                      })}
                                      <span className="ml-1">
                                        {fileUploadState.step === "uploading" ? "上传中" : fileUploadState.step === "extracting" ? "提取文本" : fileUploadState.step === "identifying" ? "识别科目/类型" : fileUploadState.step === "parsing" ? "解析章节" : fileUploadState.step === "mapping" ? "关联知识图谱" : ""}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {fileUploadState?.step === "done" && (
                              <div className="p-3 mt-3 rounded-[8px] border border-[#E4E4E7] bg-white">
                                <div className="text-[12px] font-bold text-[#18181B] mb-2">AI 识别结果</div>
                                {[
                                  { icon: '📘', label: '类型', value: fileUploadState.inferred.type },
                                  { icon: '📖', label: '书名', value: fileUploadState.inferred.name },
                                  { icon: '📚', label: '所属科目', value: fileUploadState.inferred.subject },
                                  { icon: '🧠', label: '知识体系', value: fileUploadState.inferred.linkedNode },
                                ].map((item) => (
                                  <div key={item.label} className="flex items-center gap-2 text-[12px] mt-1">
                                    <span>{item.icon}</span>
                                    <span className="text-[#71717A] w-[64px] shrink-0">{item.label}</span>
                                    <span className="text-[#18181B]">{item.value}</span>
                                  </div>
                                ))}
                                <div className="flex gap-2 mt-3">
                                  <button className="primary-btn" type="submit">确认保存</button>
                                  <button className="secondary-btn" type="button" onClick={() => setActiveDialog(null)}>取消</button>
                                </div>
                              </div>
                            )}
                            {!fileUploadState && (
                              <div className="flex gap-2 mt-3">
                                <button className="primary-btn" type="submit">直接添加空白资料</button>
                              </div>
                            )}
                          </form>
                        </section>
                      </div>
                    )}

                    {/* 资料库工具栏 */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[13px] text-[#71717A]">{subjectResources.length} 个资料</span>
                      <div className="view-toggle">
                        <button className={resourceView === "grid" ? "active" : ""} onClick={() => setResourceView("grid")}>▦ 网格</button>
                        <button className={resourceView === "list" ? "active" : ""} onClick={() => setResourceView("list")}>☰ 列表</button>
                      </div>
                    </div>

                    {/* B-1: 待确认队列（AI 识别结果确认；数据已写入 pending，此处补足渲染与确认/忽略操作） */}
                    {pending.length > 0 && (
                      <div className="mb-4 rounded-[10px] border border-[#EDE9FE] bg-[#FAF5FF] overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-[#F5F3FF]">
                          <strong className="text-[13px] text-[#6D28D9]">AI 待确认队列（{pending.length}）</strong>
                          <span className="text-[11px] text-[#A1A1AA]">AI 识别结果需人工确认后才生效</span>
                        </div>
                        <div className="divide-y divide-[#EDE9FE]">
                          {pending.map((item) => (
                            <div key={item.id} className="flex items-start gap-3 px-3 py-2.5">
                              <span className="text-[14px] shrink-0 mt-0.5">
                                {item.kind === "真题识别" ? "📝" : item.kind === "资料切分" ? "📚" : "🧠"}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <strong className="text-[12px] text-[#18181B] truncate">{item.title}</strong>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-[#EDE9FE] text-[#6D28D9] shrink-0">{item.kind}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#B45309] shrink-0">{item.status}</span>
                                </div>
                                <p className="text-[11px] text-[#71717A] mt-0.5 truncate">{item.detail}</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  className="min-h-[26px] px-3 rounded-[6px] bg-[#6D28D9] text-white font-bold text-[11px]"
                                  onClick={() => confirmPendingItem(item)}
                                >
                                  确认
                                </button>
                                <button
                                  className="min-h-[26px] px-2.5 rounded-[6px] bg-white border border-[#D4D4D8] text-[#71717A] font-bold text-[11px]"
                                  onClick={() => dismissPendingItem(item)}
                                >
                                  忽略
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bookshelf grid / list */}
                    <div className={resourceView === "grid" ? "bookshelf-grid" : "resource-list"}>
                      {subjectResources.length ? subjectResources.map((resource) => {
                        const initials = resource.name.replace(/[《》]/g, "").replace(/第[一二三四五六七八九十\d]+版/g, "").slice(0, 2);
                        const nodeCount = nodes.filter((n) => n.subject === resource.subject).length;
                        const isTextbook = resource.type === "教材";
                        const isPastPaper = resource.type.includes("真题");
                        return (
                          <article key={resource.id} className={resourceView === "grid" ? "book-card" : ""} onClick={() => resourceView === "grid" ? openResource(resource) : undefined}>
                            {resourceView === "grid" ? (
                              <>
                                <div className={`book-spine ${isTextbook ? "empty-cover" : "has-cover"}`}>
                                  {isTextbook ? (
                                    <span className="initials">{initials}</span>
                                  ) : isPastPaper ? (
                                    <span>📝</span>
                                  ) : (
                                    <span>📄</span>
                                  )}
                                </div>
                                <div className="book-body">
                                  <div className="book-title">{resource.name}</div>
                                  <div className="book-author">{resource.author} · {resource.version || "待确认"}</div>
                                  <div className="book-tags">
                                    <span className="tag-badge subtle">{resource.type}</span>
                                    <span className={`tag-badge ${resource.status === "已索引" ? "green" : "subtle"}`}>{resource.status}</span>
                                    <span className="tag-badge subtle">{resource.pages || "—"}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1 text-[11px] text-[#A1A1AA]">
                                    <span>关联：{resource.linkedNode}</span>
                                    <span>· {nodeCount} 知识点</span>
                                  </div>
                                  <div className="book-footer">
                                    <button onClick={(e) => { e.stopPropagation(); openResource(resource); }}>📖 阅读</button>
                                    <button className="text-button" onClick={(e) => { e.stopPropagation(); deleteResource(resource); }}>删除</button>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <strong>{resource.name}</strong>
                                <span>{resource.subject} / {resource.type} / {resource.status}</span>
                                <p>{resource.fileName} / {resource.pages || "未填页码"} / 关联：{resource.linkedNode}</p>
                                <button className="text-button" onClick={() => openResource(resource)}>打开阅读</button>
                                <details className="inline-details">
                                  <summary>编辑资源</summary>
                                  <div className="mini-form">
                                    <label><span>当前页码</span><input value={resource.currentPage} onChange={(event) => setResources((items) => items.map((item) => item.id === resource.id ? { ...item, currentPage: event.target.value, lastRead: "刚刚" } : item))} /></label>
                                    <label><span>关联知识点</span><input value={resource.linkedNode} onChange={(event) => setResources((items) => items.map((item) => item.id === resource.id ? { ...item, linkedNode: event.target.value } : item))} /></label>
                                    <label><span>资源状态</span><select value={resource.status} onChange={(event) => setResources((items) => items.map((item) => item.id === resource.id ? { ...item, status: event.target.value } : item))}><option>待解析</option><option>阅读中</option><option>已读</option><option>已复习</option><option>需要重学</option><option>已索引</option></select></label>
                                    <button type="button" onClick={() => deleteResource(resource)}>删除资源</button>
                                  </div>
                                </details>
                              </>
                            )}
                          </article>
                        );
                      }) : <p className="empty-state">暂无资料，点击「上传资源」导入教材或真题。</p>}
                    </div>

                    {/* Reader 阅读器 */}
                    {activeResource && (
                      <div className="mt-6 border-t border-[#E4E4E7] pt-4">
                        <ReaderPanel
                          activeResource={activeResource}
                          readerSearch={readerSearch} readerPage={readerPage} readerZoom={readerZoom}
                          relatedQuestions={relatedQuestions}
                          subjectAnnotations={subjectAnnotations}
                          subjectNodes={subjectNodes}
                          onSetReaderSearch={setReaderSearch} onSetReaderPage={setReaderPage}
                          onSetReaderZoom={setReaderZoom} onSaveProgress={() => {
                            setResources((items) => items.map((item) => item.id === activeResource.id ? { ...item, readingMinutes: String(Math.max(Number(item.readingMinutes || 0), Math.round(elapsedSeconds / 60))) } : item));
                          }}
                          onShowRelated={showRelatedQuestions}
                          onCreateCard={(text, annotation) => { createCardFromText("资料批注", text, annotation); setActiveView("cards"); setCardSubjectView(activeCardSubject || currentSubject?.name || ""); setActiveCardCategory(ALL_GROUPS); setCardSubView("待复习"); }}
                          onCreateAnnotation={onCreateAnnotation}
                          onDeleteAnnotation={onDeleteAnnotation}
                          onEditAnnotation={onEditAnnotation}
                          onJumpToPage={setReaderPage}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Questions */}
                {activeKnowledgePanel === "questions" && (
                  <div>
                    <div className="section-heading">
                      <div><div className="section-label">真题数据库</div><h2>{activeKnowledgeSubject} 真题录入、筛选、确认</h2></div>
                      <div className="flex items-center gap-2">
                        <button
                          className="min-h-[34px] px-4 rounded-[8px] bg-[#0F766E] text-white font-bold text-[13px] disabled:opacity-40"
                          disabled={examAnalyzing || subjectQuestions.length === 0}
                          title={subjectQuestions.length === 0 ? "先录入该科目的真题" : "用 DeepSeek 分析真题、提取高频考点并写入图谱"}
                          onClick={() => runExamAnalysis(activeKnowledgeSubject)}
                        >
                          {examAnalyzing ? "AI 分析中…" : "AI 分析真题（正式）"}
                        </button>
                        <button className="secondary-button" onClick={() => setActiveDialog("question")}>录入题目</button>
                      </div>
                    </div>
                    {activeDialog === "question" && (
                      <div className="modal-backdrop" role="presentation" onClick={() => setActiveDialog(null)}>
                        <section className="modal-panel" role="dialog" aria-modal="true" aria-label="手动录入题目" onClick={(event) => event.stopPropagation()}>
                          <div className="modal-head"><div><span>真题数据库</span><strong>手动录入题目</strong></div><button onClick={() => setActiveDialog(null)}>关闭</button></div>
                          <form className="form-grid question-form" onSubmit={addQuestion}>
                            <label className="field"><span>所属科目</span><select name="subject">{subjects.map((subject) => <option key={subject.id}>{subject.name}</option>)}</select></label>
                            <label className="field"><span>学校</span><input name="school" /></label>
                            <label className="field"><span>年份</span><input name="year" /></label>
                            <label className="field"><span>题号</span><input name="number" /></label>
                            <label className="field"><span>题型</span><input name="type" /></label>
                            <label className="field"><span>分值</span><input name="score" /></label>
                            <label className="field"><span>七核</span><select name="core">{coreNames.map((core) => <option key={core}>{core}</option>)}</select></label>
                            <label className="field"><span>分支</span><input name="branch" /></label>
                            <label className="field"><span>知识点</span><input name="knowledge" /></label>
                            <label className="field"><span>难度 1-5</span><input name="difficulty" /></label>
                            <label className="field"><span>学习层级</span><select name="layer"><option>第 1 层</option><option>第 2 层</option><option>第 3 层</option><option>第 4 层</option></select></label>
                            <label className="field wide-field"><span>题干</span><input name="stem" /></label>
                            <label className="field wide-field"><span>标准答案</span><input name="answer" /></label>
                            <label className="field wide-field"><span>原始解析</span><input name="originalAnalysis" /></label>
                            <button>手动录入题目</button>
                          </form>
                        </section>
                      </div>
                    )}
                    <div className="filter-bar">
                      <select value={questionFilter.subject} onChange={(event) => setQuestionFilter({ ...questionFilter, subject: event.target.value })}><option>全部</option>{subjects.map((subject) => <option key={subject.id}>{subject.name}</option>)}</select>
                      <select value={questionFilter.core} onChange={(event) => setQuestionFilter({ ...questionFilter, core: event.target.value })}><option>全部</option>{coreNames.map((core) => <option key={core}>{core}</option>)}</select>
                      <select value={questionFilter.result} onChange={(event) => setQuestionFilter({ ...questionFilter, result: event.target.value })}><option>全部</option><option>未做</option><option>正确</option><option>错误</option></select>
                      <input value={questionFilter.keyword} onChange={(event) => setQuestionFilter({ ...questionFilter, keyword: event.target.value })} placeholder="搜索年份/题干/知识点" />
                    </div>
                    <div className="question-list">
                      {filteredQuestions.filter((question) => question.subject === activeKnowledgeSubject).map((question) => (
                        <article key={question.id} className={!question.confirmed ? "unconfirmed" : ""}>
                          <div><strong>{question.year} {question.subject} 第 {question.number} 题</strong><b>{question.confirmed ? "已确认" : "待确认"}</b></div>
                          <p>{question.stem}</p>
                          <span>{question.core} / {question.branch} / {question.knowledge} / {question.layer} / 难度 {question.difficulty}</span>
                          <small>原解析：{question.originalAnalysis || "无"} / AI解析：{question.aiAnalysis}</small>
                          <details className="inline-details">
                            <summary>做题记录/编辑</summary>
                            <div className="mini-form">
                              <label><span>做题结果</span><select value={question.result} onChange={(event) => {
                                const result = event.target.value as Question["result"];
                                setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, result, done: result !== "未做" } : item));
                                // LearningEvent: question_answered（Sprint 1 / Phase A，纯副作用采集）
                                setLearningEvents((prev) => appendLearningEvent(prev, {
                                  type: "question_answered",
                                  sourceRef: {
                                    kind: "question",
                                    id: question.id,
                                    subjectId: question.subject,
                                    nodeIds: nodes.filter((n) => n.core === question.core).map((n) => n.id),
                                  },
                                  payload: { result, errorReason: question.errorReason || undefined },
                                }));
                              }}><option>未做</option><option>正确</option><option>错误</option></select></label>
                              <label><span>错误原因</span><input value={question.errorReason} onChange={(event) => setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, errorReason: event.target.value } : item))} /></label>
                              <label><span>用户笔记</span><input value={question.note} onChange={(event) => setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, note: event.target.value } : item))} /></label>
                              <button type="button" onClick={() => setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, favorite: !item.favorite } : item))}>{question.favorite ? "取消收藏" : "收藏"}</button>
                              <button type="button" onClick={() => deleteQuestion(question)}>删除题目</button>
                            </div>
                          </details>
                        </article>
                      ))}
                      {filteredQuestions.filter((question) => question.subject === activeKnowledgeSubject).length === 0 && <p className="empty-state">当前筛选下没有真题。</p>}
                    </div>
                  </div>
                )}

                {/* Graph */}
                {activeKnowledgePanel === "graph" && (
                  <div>
                    <div className="section-heading">
                      <div><div className="section-label">知识图谱</div><h2>{activeKnowledgeSubject} 七核、分支、知识点编辑</h2></div>
                      <button className="secondary-button" onClick={() => setActiveDialog("node")}>添加知识点</button>
                    </div>
                    {activeDialog === "node" && (
                      <div className="modal-backdrop" role="presentation" onClick={() => setActiveDialog(null)}>
                        <section className="modal-panel" role="dialog" aria-modal="true" aria-label="添加知识点" onClick={(event) => event.stopPropagation()}>
                          <div className="modal-head"><div><span>知识图谱</span><strong>添加知识点</strong></div><button onClick={() => setActiveDialog(null)}>关闭</button></div>
                          <form className="form-grid" onSubmit={addNode}>
                            <label className="field"><span>所属科目</span><select name="subject">{subjects.map((subject) => <option key={subject.id}>{subject.name}</option>)}</select></label>
                            <label className="field"><span>七核</span><select name="core">{coreNames.map((core) => <option key={core}>{core}</option>)}</select></label>
                            <label className="field"><span>分支</span><input name="branch" /></label>
                            <label className="field wide-field"><span>知识点</span><input name="knowledge" /></label>
                            <label className="field wide-field"><span>解释</span><input name="explanation" /></label>
                            <label className="field"><span>前置</span><input name="prerequisite" /></label>
                            <label className="field"><span>相关</span><input name="related" /></label>
                            <label className="field"><span>掌握层级</span><select name="masteryLevel"><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label>
                            <label className="field"><span>掌握分数</span><input name="masteryScore" /></label>
                            <button>添加知识点</button>
                          </form>
                        </section>
                      </div>
                    )}
                    <div className="knowledge-list">
                      {subjectNodes.map((node) => (
                        <article key={node.id} className="p-3 rounded-[8px] border border-[#E4E4E7] bg-white">
                          <div className="flex items-center justify-between mb-1">
                            <strong className="text-[14px]">{node.core} / {node.branch} / {node.knowledge}</strong>
                            <span className={`tag-badge ${node.reviewRisk === "高风险" ? "danger" : node.reviewRisk === "需要关注" ? "warn" : "subtle"}`}>{node.reviewRisk}</span>
                          </div>
                          <p className="text-[12px] text-[#71717A] mb-2">{node.explanation}</p>
                          <div className="flex items-center gap-4 text-[12px] text-[#71717A]">
                            <span>掌握度 <strong className={`${node.masteryScore >= 70 ? "text-[#0F766E]" : node.masteryScore >= 40 ? "text-[#F59E0B]" : "text-[#EF4444]"}`}>{node.masteryScore}%</strong></span>
                            <span>掌握层级 {node.masteryLevel}/4</span>
                            <span>错题 {node.mistakes} 次</span>
                            {node.isMonthlyFocus && <span className="tag-badge green">当月重点</span>}
                          </div>
                          <details className="inline-details">
                            <summary className="text-[12px] text-[#71717A] font-bold">编辑</summary>
                            <div className="mini-form mt-2">
                              <label><span>知识点</span><input value={node.knowledge} onChange={(event) => setNodes((items) => items.map((item) => item.id === node.id ? { ...item, knowledge: event.target.value } : item))} /></label>
                              <label><span>掌握分数</span><input value={node.masteryScore} onChange={(event) => setNodes((items) => items.map((item) => item.id === node.id ? { ...item, masteryScore: Number(event.target.value || 0) } : item))} /></label>
                              <label><span>复习风险</span><select value={node.reviewRisk} onChange={(event) => setNodes((items) => items.map((item) => item.id === node.id ? { ...item, reviewRisk: event.target.value as Risk } : item))}><option>正常</option><option>需要关注</option><option>进度落后</option><option>高风险</option></select></label>
                              <button type="button" onClick={() => deleteNode(node)}>删除节点</button>
                            </div>
                          </details>
                        </article>
                      ))}
                      {subjectNodes.length === 0 && <p className="empty-state">暂无知识点，点击「添加知识点」开始构建图谱。</p>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ─── Growth Cards 卡片中心（卡片组作为一级工作空间：成长卡片 → 卡片组 → 卡片）─── */}
        {activeView === "cards" && (
          <section className={`knowledge workspace-pane ${activeView === "cards" ? "active" : ""}`} id="cards">
            <div className="section-heading">
              <div><div className="section-label">Growth Cards</div><h2>{cardSubjectView ? activeCategoryName : "成长卡片"}</h2></div>
              {/* 黑白灰统一按钮风格：Primary 黑底白字（开始复习）；Secondary 白底浅灰边框黑字（返回/新建/管理） */}
              <div className="flex items-center gap-3 shrink-0 flex-wrap">
                {cardSubjectView ? (
                  <>
                    {/* 返回 — Secondary（最低权重，放最左） */}
                    <button
                      className="min-h-[32px] px-3 rounded-[8px] bg-white border border-[#D4D4D8] text-[#18181B] font-bold text-[13px] hover:bg-[#F4F4F5] transition-colors"
                      onClick={() => { setCardSubjectView(null); setActiveCardCategory(null); setCardIndex(0); setCardFlipped(false); }}
                    >← 返回</button>
                    {/* 新建卡片 — Secondary（中权重） */}
                    <button
                      className="min-h-[32px] px-3 rounded-[8px] bg-white border border-[#D4D4D8] text-[#18181B] font-bold text-[13px] hover:bg-[#F4F4F5] transition-colors"
                      onClick={() => { setEditingCardId(null); setActiveDialog("card"); }}
                    >新建卡片</button>
                    {/* 开始复习 — Primary（最高权重，放最右） */}
                    <button
                      className="min-h-[32px] px-3 rounded-[8px] bg-[#18181B] text-white font-bold text-[13px] hover:opacity-90 transition-opacity"
                      onClick={() => { setCardSubView("待复习"); setCardIndex(0); setCardFlipped(false); }}
                    >开始复习</button>
                    {activeCardCategory !== ALL_GROUPS && activeCardCategory !== UNCATEGORIZED && (
                      <button
                        className="min-h-[32px] px-3 rounded-[8px] bg-white border border-[#D4D4D8] text-[#18181B] font-bold text-[13px] hover:bg-[#F4F4F5] transition-colors"
                        onClick={() => { const cat = categories.find((c) => c.id === activeCardCategory); if (cat) { setRenamingCardId(cat.id); setRenamingCardName(cat.name); setCardMenuOpenId(null); } }}
                      >✏️ 重命名卡片组</button>
                    )}
                    {activeCardCategory !== ALL_GROUPS && activeCardCategory !== UNCATEGORIZED && (
                      <button
                        className="min-h-[32px] px-3 rounded-[8px] bg-white border border-[#D4D4D8] text-[#EF4444] font-bold text-[13px] hover:bg-[#FEF2F2] transition-colors"
                        onClick={() => { if (activeCardCategory && activeCardCategory !== ALL_GROUPS && activeCardCategory !== UNCATEGORIZED) setDeletingCardId(activeCardCategory); }}
                      >🗑️ 删除卡片组</button>
                    )}
                  </>
                ) : (
                  <>
                    {/* 新建卡片组 — Secondary（中权重） */}
                    <button
                      className="min-h-[32px] px-3 rounded-[8px] bg-white border border-[#D4D4D8] text-[#18181B] font-bold text-[13px] hover:bg-[#F4F4F5] transition-colors"
                      onClick={() => { document.getElementById("new-card-deck-form")?.scrollIntoView({ behavior: "smooth" }); (document.getElementById("new-card-deck-input") as HTMLInputElement | null)?.focus(); }}
                    >新建卡片组</button>
                    {/* 开始复习 — Primary（最高权重，放最右） */}
                    <button
                      className="min-h-[32px] px-3 rounded-[8px] bg-[#18181B] text-white font-bold text-[13px] hover:opacity-90 transition-opacity"
                      onClick={() => { setCardSubjectView(activeCardSubject || subjects[0]?.name || ""); setActiveCardCategory(ALL_GROUPS); setCardSubView("待复习"); setCardIndex(0); setCardFlipped(false); }}
                    >开始复习</button>
                  </>
                )}
              </div>
            </div>

            {/* 成长卡片首页：仅管理/展示该学科的卡片组（点击卡片组进入学习空间） */}
            {!cardSubjectView && (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  {subjects.map((subject) => (
                    <button
                      key={subject.id}
                      className={`min-h-[30px] px-3 rounded-[8px] font-bold text-[12px] ${
                        activeCardSubject === subject.name
                          ? "bg-[#18181B] text-white"
                          : "bg-[#F4F4F5] text-[#18181B]"
                      }`}
                      onClick={() => setActiveCardSubject(subject.name)}
                    >
                      {subject.name}
                    </button>
                  ))}
                </div>

                {/* 该学科全部卡片组网格：全部卡片 / 自定义卡片组 / 未分类 / 新建卡片组 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 全部卡片组（虚拟组）— 样式与知识中心三个入口完全一致 */}
                  <div
                    role="button"
                    tabIndex={0}
                    className="p-6 rounded-[12px] border border-[#E4E4E7] bg-white text-left cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => { setCardSubjectView(activeCardSubject); setActiveCardCategory(ALL_GROUPS); setCardSubView("待复习"); setCardIndex(0); setCardFlipped(false); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCardSubjectView(activeCardSubject); setActiveCardCategory(ALL_GROUPS); setCardSubView("待复习"); setCardIndex(0); setCardFlipped(false); } }}
                  >
                    <div className="text-[24px] mb-2">🗂️</div>
                    <strong className="text-[16px] block mb-1">全部卡片</strong>
                    <span className="text-[13px] text-[#71717A]">{subjectCards.length} 张卡片 · 待复习 {dueCards.length}</span>
                  </div>
                  {/* 自定义卡片组 — 样式与知识中心三个入口完全一致（右上角保持 hover ⋯ 管理） */}
                  {categoryStats.map(({ category, total, due }) => (
                    <div
                      key={category.id}
                      role="button"
                      tabIndex={0}
                      className="group p-6 rounded-[12px] border border-[#E4E4E7] bg-white text-left cursor-pointer hover:shadow-md transition-shadow relative"
                      onClick={() => { setCardSubjectView(activeCardSubject); setActiveCardCategory(category.id); setCardSubView("待复习"); setCardIndex(0); setCardFlipped(false); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCardSubjectView(activeCardSubject); setActiveCardCategory(category.id); setCardSubView("待复习"); setCardIndex(0); setCardFlipped(false); } }}
                    >
                      <div className="text-[24px] mb-2">📁</div>
                      <strong className="text-[16px] block mb-1 pr-12">{category.name}</strong>
                      <span className="text-[13px] text-[#71717A]">{total} 张卡片 · 待复习 {due}</span>
                      {/* 始终可见的操作按钮：直接点击执行，不依赖 hover/弹层/外部监听，确保可用 */}
                      <span className="absolute top-3 right-2 z-10 flex items-center gap-0.5">
                        <button
                          type="button"
                          className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#18181B] transition-colors"
                          title="重命名卡片组"
                          aria-label="重命名卡片组"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setRenamingCardId(category.id);
                            setRenamingCardName(category.name);
                          }}
                        >
                          <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zM19.5 7.125L16.875 4.5" /></svg>
                        </button>
                        <button
                          type="button"
                          className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#71717A] hover:bg-[#FEF2F2] hover:text-[#EF4444] transition-colors"
                          title="删除卡片组"
                          aria-label="删除卡片组"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setDeletingCardId(category.id);
                          }}
                        >
                          <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                        </button>
                      </span>
                    </div>
                  ))}
                  {/* 未分类卡片组（系统固定，最后）— 样式与知识中心三个入口完全一致 */}
                  <div
                    role="button"
                    tabIndex={0}
                    className="p-6 rounded-[12px] border border-[#E4E4E7] bg-white text-left cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => { setCardSubjectView(activeCardSubject); setActiveCardCategory(UNCATEGORIZED); setCardSubView("待复习"); setCardIndex(0); setCardFlipped(false); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCardSubjectView(activeCardSubject); setActiveCardCategory(UNCATEGORIZED); setCardSubView("待复习"); setCardIndex(0); setCardFlipped(false); } }}
                  >
                    <div className="text-[24px] mb-2">📄</div>
                    <strong className="text-[16px] block mb-1">未分类</strong>
                    <span className="text-[13px] text-[#71717A]">{uncategorizedCardCount} 张卡片</span>
                  </div>
                  {/* 新建卡片组（样式与知识中心入口一致，但允许新建；点击展开输入框，创建后自动收起） */}
                  <div className="p-6 rounded-[12px] border-2 border-dashed border-[#D4D4D8] bg-[#FAFAFA]">
                    {!newCardDeckOpen ? (
                      <button
                        className="w-full text-left text-[#71717A] hover:text-[#18181B] transition-colors"
                        onClick={() => { setNewCardDeckOpen(true); setCardMenuOpenId(null); }}
                      >
                        <div className="text-[24px] mb-2">➕</div>
                        <strong className="text-[16px] block mb-1 text-[#18181B]">新建卡片组</strong>
                        <span className="text-[13px] text-[#71717A]">创建后自动收起</span>
                      </button>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <strong className="text-[14px] text-[#18181B]">卡片组名称</strong>
                        <input
                          autoFocus
                          value={newCardDeckName}
                          onChange={(e) => setNewCardDeckName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategoryInline(); } if (e.key === "Escape") { setNewCardDeckOpen(false); setNewCardDeckName(""); } }}
                          placeholder="最多 30 字"
                          maxLength={30}
                          className="min-h-[36px] text-[13px] px-3 rounded-[8px] border border-[#D4D4D8] bg-white focus:outline-none focus:ring-2 focus:ring-[#18181B]/10"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="min-h-[32px] px-3 rounded-[8px] bg-[#F4F4F5] text-[#71717A] font-bold text-[12px]"
                            onClick={() => { setNewCardDeckOpen(false); setNewCardDeckName(""); }}
                          >取消</button>
                          <button
                            className="min-h-[32px] px-4 rounded-[8px] bg-[#18181B] text-white font-bold text-[12px]"
                            onClick={addCategoryInline}
                          >创建</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* 学科内视图：先切换学科 Tab，再展示概览/分类/卡片 */}
            {cardSubjectView && (
              <>
                {/* 卡片组学习空间：学科 Tab 保持当前卡片组学习空间；统计/筛选/翻卡全部在此完成 */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {subjects.map((subject) => (
                    <button
                      key={subject.id}
                      className={`min-h-[30px] px-3 rounded-[8px] font-bold text-[12px] ${
                        activeCardSubject === subject.name
                          ? "bg-[#18181B] text-white"
                          : "bg-[#F4F4F5] text-[#18181B]"
                      }`}
                      onClick={() => { setActiveCardSubject(subject.name); setActiveCardCategory(ALL_GROUPS); setCardSubView("待复习"); setCardIndex(0); setCardFlipped(false); }}
                    >
                      {subject.name}
                    </button>
                  ))}
                </div>

                {/* 卡片组内统计：待复习 / 全部卡片 / 今日已复习 / 收藏 */}
                <div className="metric-grid mb-4">
                  <div><span>待复习</span><strong>{categoryQueueCards.length}</strong></div>
                  <div><span>全部卡片</span><strong>{currentCategoryCards.length}</strong></div>
                  <div><span>今日已复习</span><strong>{currentCategoryCards.filter((c) => c.lastReviewed !== "未复习" && c.lastReviewed.slice(0, 10) === hydratedTodayStr).length}</strong></div>
                  <div><span>收藏卡片</span><strong>{currentCategoryCards.filter((c) => c.favorite).length}</strong></div>
                </div>

                {/* 筛选 / 查看方式：待复习 / 全部 / 按七核 / 按掌握状态 */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {(["待复习", "全部", "按七核", "按掌握状态"] as const).map((view) => (
                    <button
                      key={view}
                      className={`min-h-[30px] px-3 rounded-[8px] font-bold text-[12px] ${cardSubView === view ? "bg-[#18181B] text-white" : "bg-[#F4F4F5] text-[#18181B]"}`}
                      onClick={() => setCardSubView(view)}
                    >
                      {view}
                    </button>
                  ))}
                </div>

                {/* 待复习 → 卡片复习器（仅当前卡片组范围） */}
                {cardSubView === "待复习" && (
                  categoryReviewQueue.length > 0 ? (
                    <CardViewer
                      activeCard={activeGroupCard}
                      cardIndex={categoryClampedCardIndex} cardQueue={categoryReviewQueue}
                      cardFlipped={cardFlipped} cardMode={cardMode}
                      onFlip={() => setCardFlipped(!cardFlipped)}
                      onMove={moveCard}
                      onReview={reviewCard}
                      onFocusMode={() => setFocusMode(!focusMode)}
                      onOpenSource={openCardSource}
                      onShowRelated={showRelatedQuestions}
                    />
                  ) : (
                    <p className="empty-state">该卡片组暂无待复习卡片</p>
                  )
                )}

                {/* 按七核查看 → 按 core 分组统计该卡片组卡片 */}
                {cardSubView === "按七核" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {coreNames.map((core) => {
                      const coreCards = currentCategoryCards.filter((card) => card.core === core);
                      if (coreCards.length === 0) return null;
                      return (
                        <article key={core} className="p-3 rounded-[8px] border border-[#E4E4E7] bg-white">
                          <strong className="text-[13px] block mb-2">{core}</strong>
                          <span className="text-[12px] text-[#71717A]">{coreCards.length} 张卡片</span>
                        </article>
                      );
                    })}
                  </div>
                )}

                {/* 按掌握状态查看 → 按 mastery 分组统计该卡片组卡片 */}
                {cardSubView === "按掌握状态" && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {(["不会", "模糊", "认识", "熟练"] as const).map((mastery) => {
                      const masteryCards = currentCategoryCards.filter((card) => card.mastery === mastery);
                      if (masteryCards.length === 0) return null;
                      return (
                        <article key={mastery} className="p-3 rounded-[8px] border border-[#E4E4E7] bg-white">
                          <strong className="text-[13px] block mb-2">{mastery}</strong>
                          <span className="text-[12px] text-[#71717A]">{masteryCards.length} 张卡片</span>
                        </article>
                      );
                    })}
                  </div>
                )}

                {/* 全部 → 该卡片组全部卡片网格（含移动到其他卡片组管理） */}
                {cardSubView === "全部" && (
                  <div className="card-grid">
                    {currentCategoryCards.map((card) => (
                      <article className="study-card" key={card.id}>
                        <div className="study-card-head">
                          <strong>{card.title}</strong>
                          <span>{card.type}</span>
                        </div>
                        <p className="text-[13px]">{cardMode === "填空" ? card.front.replace(/熵变公式|公式|条件/g, "______") : card.front}</p>
                        <details>
                          <summary>{cardMode === "背诵" ? "查看背面" : "查看参考答案"}</summary>
                          <p className="text-[13px]">{card.back}</p>
                        </details>
                        <div className="subject-meta">
                          <span>{card.subject}</span><span>{card.core}</span><span>{card.knowledge}</span>
                        </div>
                        {/* 移动到其他卡片组（只能移动到当前学科下的卡片组，不能跨学科） */}
                        {activeCardCategory !== ALL_GROUPS && activeCardCategory !== UNCATEGORIZED && (
                          <label className="flex items-center gap-1.5 mt-2 text-[12px] text-[#71717A]">
                            <span className="shrink-0">卡片组</span>
                            <select
                              className="min-h-[28px] text-[12px] px-2 rounded border border-[#D4D4D8] bg-white"
                              value={card.categoryId ?? ""}
                              onChange={(e) => { moveCardToCategory(card.id, e.target.value); setNotice(`已移动卡片到卡片组`); }}
                            >
                              <option value="">未分类</option>
                              {subjectCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                            </select>
                          </label>
                        )}
                        <small className="block text-[12px] text-[#71717A] mt-2">来源：{card.source} {card.page} / {card.lastReviewed} / {card.nextReviewAt}</small>
                        <div className="card-actions">
                          <button className="text-button text-[12px]" onClick={() => reviewCard(card.id, "认识")}>认识</button>
                          <button className="text-button text-[12px]" onClick={() => reviewCard(card.id, "模糊")}>模糊</button>
                          <button className="text-button text-[12px]" onClick={() => reviewCard(card.id, "不会")}>不会</button>
                          <button className="text-button text-[12px]" onClick={() => setCards((items) => items.map((item) => item.id === card.id ? { ...item, favorite: !item.favorite } : item))}>{card.favorite ? "★收藏" : "收藏"}</button>
                          <button className="text-button text-[12px]" onClick={() => { setEditingCardId(card.id); setActiveDialog("card"); }}>编辑</button>
                          <button className="text-button text-[12px]" onClick={() => openCardSource(card)}>来源</button>
                          <button className="text-button text-[12px]" onClick={() => showRelatedQuestions(card.core, card.knowledge, card.subject)}>真题</button>
                          <button className="text-button text-[12px]" onClick={() => deleteCard(card)}>删除</button>
                        </div>
                      </article>
                    ))}
                    {currentCategoryCards.length === 0 && <p className="empty-state">该卡片组暂无卡片。</p>}
                  </div>
                )}
              </>
            )}

            {/* 专注模式（统一使用 CardViewer 导出的 FocusMode 组件，单一实现；Escape 关闭 + 遮罩防误触） */}
            {focusMode && activeGroupCard && cardSubjectView && (
              <FocusMode
                activeCard={activeGroupCard}
                cardFlipped={cardFlipped}
                onFlip={() => setCardFlipped((v) => !v)}
                onReview={reviewCard}
                onClose={() => setFocusMode(false)}
              />
            )}

            {/* 新建 / 编辑卡片弹窗（编辑时预填并更新；新建时自动继承上下文 + 更多设置折叠） */}
            {activeDialog === "card" && (
              <div className="modal-backdrop" role="presentation" onClick={() => { setEditingCardId(null); setActiveDialog(null); }}>
                <section className="modal-panel" role="dialog" aria-modal="true" aria-label={editingCard ? "编辑成长卡片" : "新建成长卡片"} onClick={(event) => event.stopPropagation()}>
                  <div className="modal-head"><div><span>成长卡片</span><strong>{editingCard ? "编辑成长卡片" : "新建成长卡片"}</strong></div><button onClick={() => { setEditingCardId(null); setActiveDialog(null); }}>关闭</button></div>
                  <form className="form-grid" key={editingCard?.id ?? "new"} onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    const front = String(form.get("front") ?? "").trim();
                    if (!front) return;
                    if (editingCard) {
                      // 编辑：保留 id / createdAt / 学习状态，更新可编辑字段
                      setCards((items) => items.map((item) => item.id === editingCard.id
                        ? {
                            ...item,
                            title: front.slice(0, 40),
                            front,
                            back: String(form.get("back") ?? "").trim() || "待补充",
                            type: String(form.get("type") ?? item.type) as GrowthCard["type"],
                            subject: String(form.get("subject") ?? "").trim() || item.subject,
                            core: String(form.get("core") ?? "").trim() || item.core,
                            branch: String(form.get("branch") ?? "").trim() || "",
                            knowledge: String(form.get("knowledge") ?? "").trim() || "",
                            source: String(form.get("source") ?? "").trim() || item.source,
                            page: String(form.get("page") ?? "").trim() || item.page,
                            categoryId: String(form.get("category") ?? "") || undefined,
                          }
                        : item));
                      setNotice("已保存卡片修改");
                      setEditingCardId(null);
                      setActiveDialog(null);
                      return;
                    }
                    const subject = String(form.get("subject") ?? "").trim() || activeCardSubject || currentSubject?.name || "";
                    const subjectNode = nodes.find((n) => n.subject === subject);
                    const type = String(form.get("type") ?? "概念卡") as GrowthCard["type"];
                    // 分类可选，不选 → 未分类；分类列表只显示当前学科（学科隔离）
                    const selectedCategoryId = String(form.get("category") ?? "") || undefined;
                    const card: GrowthCard = {
                      id: makeId("c"),
                      title: front.slice(0, 40),
                      front,
                      back: String(form.get("back") ?? "").trim() || "待补充",
                      type,
                      subject,
                      // 科目/七核/知识点/来源 自动继承当前上下文，仅当用户在「更多设置」中修改时覆盖
                      core: String(form.get("core") ?? "").trim() || subjectNode?.core || "待关联",
                      branch: String(form.get("branch") ?? "").trim() || subjectNode?.branch || "",
                      knowledge: String(form.get("knowledge") ?? "").trim() || subjectNode?.knowledge || "",
                      source: String(form.get("source") ?? "").trim() || activeResource?.name || "手动创建",
                      page: String(form.get("page") ?? "").trim() || activeResource?.currentPage || "",
                      modes: ["背诵", type === "填空卡" ? "填空" : "条件辨析"],
                      createdBy: "手动",
                      createdAt: today(),
                      lastReviewed: "未复习",
                      nextReviewAt: dateOnly(),
                      mastery: "模糊",
                      note: "",
                      favorite: false,
                      categoryId: selectedCategoryId,
                    };
                    setCards((items) => [card, ...items]);
                    setActiveCardSubject(subject);
                    pushAssistant(`已创建${type}：${card.title}`);
                    setActiveDialog(null);
                    event.currentTarget.reset();
                  }}>
                    <label className="field wide-field"><span>正面 *</span><input name="front" defaultValue={editingCard?.front ?? ""} autoFocus required /></label>
                    <label className="field wide-field"><span>背面</span><input name="back" defaultValue={editingCard?.back ?? ""} placeholder="可选，默认待补充" /></label>
                    <label className="field"><span>类型</span><select name="type" defaultValue={editingCard?.type ?? "概念卡"}><option>公式卡</option><option>概念卡</option><option>填空卡</option><option>推导卡</option><option>条件辨析卡</option><option>错题卡</option></select></label>
                    <label className="field wide-field"><span>卡片组</span><select name="category" defaultValue={editingCard?.categoryId ?? (activeCardCategory && activeCardCategory !== ALL_GROUPS && activeCardCategory !== UNCATEGORIZED ? activeCardCategory : "")}><option value="">未分类</option>{subjectCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></label>
                    {/* 高级信息默认折叠：编辑时预填，新建时自动继承上下文 */}
                    <details className="inline-details mt-2">
                      <summary className="text-[12px] text-[#71717A] font-bold">更多设置</summary>
                      <div className="grid grid-cols-1 gap-3 mt-2">
                        <label className="field"><span>科目</span><select name="subject" defaultValue={(editingCard?.subject) || activeCardSubject || currentSubject?.name || ""}>{subjects.map((subject) => <option key={subject.id} value={subject.name}>{subject.name}</option>)}</select></label>
                        <label className="field"><span>七核</span><select name="core" defaultValue={editingCard?.core ?? ""}><option value="">自动继承当前科目</option>{coreNames.map((core) => <option key={core} value={core}>{core}</option>)}</select></label>
                        <label className="field"><span>分支</span><input name="branch" defaultValue={editingCard?.branch ?? ""} placeholder="自动继承当前科目" /></label>
                        <label className="field"><span>知识点</span><input name="knowledge" defaultValue={editingCard?.knowledge ?? ""} placeholder="自动继承当前科目" /></label>
                        <label className="field wide-field"><span>来源</span><input name="source" defaultValue={editingCard?.source ?? ""} placeholder={activeResource?.name || "手动创建"} /></label>
                        <label className="field"><span>页码</span><input name="page" defaultValue={editingCard?.page ?? ""} placeholder={activeResource?.currentPage || ""} /></label>
                      </div>
                    </details>
                    <button>{editingCard ? "保存修改" : "创建成长卡片"}</button>
                  </form>
                </section>
              </div>
            )}
          </section>
        )}

        {/* Settings Panel */}
        {activeView === "settings" && (
          <SettingsPanel
            exam={exam}
            subjects={subjects}
            onUpdateExam={(patch) => setExam((prev) => ({ ...prev, ...patch }))}
            onAddSubject={(subject) => setSubjects((prev) => [...prev, subject])}
            onUpdateSubject={(id, patch) => setSubjects((prev) =>
              prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
            )}
            onRemoveSubject={(id) => setSubjects((prev) => prev.filter((s) => s.id !== id))}
          />
        )}

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
  );
}