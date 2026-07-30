import { renderKatexOnClient } from "./lib/katex-utils";
import type {
  Risk, MasteryText, StudyMood, WorkspaceView, KnowledgePanel,
  DashboardPanel, ReviewScope, ActiveDialog, DeletedBackup,
  ExamGoal, Subject, Resource, Question, KnowledgeNode, Task,
  PendingItem, Review, Note, PlanLog, AppSettings, StudyDay,
  GrowthCard, CardDeck, Annotation, AgentStep, ReaderTab
} from "./lib/types";
import {
  seedExam, seedSubjects, seedResources, seedQuestions, seedNodes,
  seedTasks, seedNotes, seedCards, seedDecks, seedAnnotations, seedAppSettings,
  seedStudyDays
} from "./lib/default-data";
import { STORAGE, TASK, MASTERY, CARD_REVIEW_INTERVALS, CARD_REVIEW_LABELS, TOAST_DURATION, MAX_STUDY_DAYS, CHAT_KEEP_LAST, HEATMAP_SIZE } from "./lib/rules";
import { loadData, saveData } from "./lib/storage";

const quickPrompts = ["今天学什么", "找近五年化学势真题", "傅献彩哪里讲这个", "为什么总错这类题", "把今天整理成笔记", "分析最近三套真题，更新图谱并重排计划", "我现在属于第几轮"];
const masteryOptions: MasteryText[] = ["完全不懂", "有些模糊", "基本理解", "能够讲清", "能够迁移"];
const moodOptions: StudyMood[] = ["较差", "一般", "正常", "较好", "很好"];
const coreNames = ["热力学", "相平衡", "化学动力学", "电化学", "统计热力学", "表面与胶体", "实验与综合"];

let _counter = 0;
function makeId(prefix: string) {
  _counter++;
  return `${prefix}-${Date.now()}-${_counter}-${Math.random().toString(16).slice(2)}`;
}

/** Only call inside event handlers, never during render */
function today() {
  return new Date().toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" });
}

/** Only call inside event handlers, never during render */
function dateOnly(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function normalizeExamGoal(goal: ExamGoal): ExamGoal {
  return { ...seedExam, ...goal, startDate: goal.startDate ?? seedExam.startDate ?? "2026-07-30" };
}

function dateRange(start: string, end: string) {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime > endTime) return [dateOnly()];
  const days = Math.min(MAX_STUDY_DAYS, Math.floor((endTime - startTime) / 86400000) + 1);
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
  const [annotations, setAnnotations] = useState(seedAnnotations);
  const [activeResourceId, setActiveResourceId] = useState(seedResources[0]?.id ?? "");
  const [readerSearch, setReaderSearch] = useState("");
  const [readerPage, setReaderPage] = useState(seedResources[0]?.currentPage ?? "");
  const [readerZoom, setReaderZoom] = useState("100%");
  const [favoritePages, setFavoritePages] = useState<string[]>([]);
  const [studyDays, setStudyDays] = useState<StudyDay[]>(seedStudyDays);
  const [decks, setDecks] = useState<CardDeck[]>(seedDecks);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [cardMode, setCardMode] = useState("背诵");
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [cardView, setCardView] = useState<"复习" | "管理">("复习");
  const [reviewTab, setReviewTab] = useState<"概览" | "填写复盘" | "AI总结">("概览");
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [logs, setLogs] = useState<PlanLog[]>([
    { id: "l-1", time: today(), input: "今天只有两个小时", output: "压缩为 2 个 828 Layer 2 任务", accepted: "已接受", dataRead: ["考试日期", "当前轮次", "高风险节点"], userRevision: "无", finalResult: "生成今日任务", rating: "未评价", rework: "0" },
  ]);
  const [review, setReview] = useState<Review>({ done: "", hard: "", load: "刚好", tomorrow: "3 小时", priority: "" });
  const [chatInput, setChatInput] = useState("");
  const [notice, setNotice] = useState("");
  const [chat, setChat] = useState([
    { role: "user", text: "今天只有两个小时，我该学什么？" },
    { role: "assistant", text: "先处理 828 物理化学。当前熵变计算仍在 Layer 2，不进入综合题。" },
  ]);
  const [questionFilter, setQuestionFilter] = useState({ subject: "全部", core: "全部", result: "全部", keyword: "" });
  const [tooltipData, setTooltipData] = useState<{ date: string; top: number; left: number; above: boolean } | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const heatmapRef = useRef<HTMLDivElement>(null);
  const hasInitializedScroll = useRef(false);
  const hoveredDateRef = useRef<string | null>(null);
  const [tappedDate, setTappedDate] = useState<string | null>(null);
  /** Timer state for learning session */
  const [timerStartTime, setTimerStartTime] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const [completionModalAllowEditTime, setCompletionModalAllowEditTime] = useState(false);
  const [completionModalCustomMinutes, setCompletionModalCustomMinutes] = useState("");
  const [completionModalCustomEndTime, setCompletionModalCustomEndTime] = useState("--");
  // Hydration-safe "today" values: during SSR, use fixed fallback; after mount, update to real date
  const [hydratedTodayStr, setHydratedTodayStr] = useState("2026-07-30");
  const [hydratedDaysLeft, setHydratedDaysLeft] = useState(143);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState<string | null>(null);
  const [quickCardFront, setQuickCardFront] = useState("");
  const [quickCardBack, setQuickCardBack] = useState("");
  const [quickCardType, setQuickCardType] = useState<GrowthCard["type"]>("公式卡");
  const cardsRef = useRef<HTMLDivElement>(null);
  const [resourceView, setResourceView] = useState<"grid" | "list">("grid");
  const [readingMode, setReadingMode] = useState(false);
  const [readerTab, setReaderTab] = useState<ReaderTab>("annotations");
  const [fileUploadState, setFileUploadState] = useState<{
    name: string;
    size: number;
    inferred: ReturnType<typeof inferResource>;
    step: string;
  } | null>(null);

  useEffect(() => {
    setHydratedTodayStr(dateOnly());
    setHydratedDaysLeft(Math.max(0, Math.ceil((new Date(exam.examDate).getTime() - Date.now()) / 86400000)));
  }, [exam.examDate]);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE.key);
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      // Backward compatibility: ensure examGoalCreatedAt exists
      const loadedExam = normalizeExamGoal(data.exam ?? seedExam);
      if (!loadedExam.examGoalCreatedAt) {
        // Old data: use earliest study day date, or today
        const earliestDate = (data.studyDays ?? []).length
          ? (data.studyDays as StudyDay[]).map((d: StudyDay) => d.date).sort()[0]
          : dateOnly();
        loadedExam.examGoalCreatedAt = earliestDate;
      }
      setExam(loadedExam);
      setAppSettings(data.appSettings ?? seedAppSettings);
      setSubjects(data.subjects ?? seedSubjects);
      setActiveKnowledgeSubject(data.activeKnowledgeSubject ?? data.subjects?.[0]?.name ?? seedSubjects[0]?.name ?? "");
      setActiveCardSubject(data.activeCardSubject ?? data.subjects?.[0]?.name ?? seedSubjects[0]?.name ?? "");
      setResources((data.resources ?? seedResources).map((resource: Resource) => ({ ...resource, readingMinutes: resource.readingMinutes ?? "" })));
      setQuestions(data.questions ?? seedQuestions);
      setNodes(data.nodes ?? seedNodes);
      setTasks(data.tasks ?? seedTasks);
      setPending(data.pending ?? []);
      setNotes(data.notes ?? seedNotes);
      setCards((data.cards ?? seedCards).map((card: GrowthCard) => ({ ...card, nextReviewAt: card.nextReviewAt ?? dateOnly() })));
      setAnnotations(data.annotations ?? seedAnnotations);
      setActiveResourceId(data.activeResourceId ?? seedResources[0]?.id ?? "");
      setReaderSearch(data.readerSearch ?? "");
      setReaderPage(data.readerPage ?? data.resources?.[0]?.currentPage ?? seedResources[0]?.currentPage ?? "");
      setReaderZoom(data.readerZoom ?? "100%");
      setFavoritePages(data.favoritePages ?? []);
      setStudyDays(data.studyDays ?? seedStudyDays);
      setAgentSteps(data.agentSteps ?? []);
      setLogs((data.logs ?? []).map((log: PlanLog) => ({ ...log, dataRead: log.dataRead ?? [], userRevision: log.userRevision ?? "无", finalResult: log.finalResult ?? log.output, rating: log.rating ?? "未评价", rework: log.rework ?? "0" })));
      setChat(data.chat ?? chat);
    } catch {
      window.localStorage.removeItem(STORAGE.key);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE.key, JSON.stringify({ exam, appSettings, subjects, activeKnowledgeSubject, activeCardSubject, resources, questions, nodes, tasks, pending, notes, cards, annotations, activeResourceId, readerSearch, readerPage, readerZoom, favoritePages, studyDays, agentSteps, logs, chat }));
  }, [exam, appSettings, subjects, activeKnowledgeSubject, activeCardSubject, resources, questions, nodes, tasks, pending, notes, cards, annotations, activeResourceId, readerSearch, readerPage, readerZoom, favoritePages, studyDays, agentSteps, logs, chat]);

  useEffect(() => {
    if (subjects.length && !subjects.some((subject) => subject.name === activeKnowledgeSubject)) setActiveKnowledgeSubject(subjects[0].name);
    if (subjects.length && !subjects.some((subject) => subject.name === activeCardSubject)) setActiveCardSubject(subjects[0].name);
  }, [subjects, activeKnowledgeSubject, activeCardSubject]);

  // Initialize heatmap scroll position once on mount
  useEffect(() => {
    if (hasInitializedScroll.current || !heatmapRef.current) return;
    hasInitializedScroll.current = true;
    const el = heatmapRef.current;
    const todayCol = heatmapGrid.findIndex((week) => week.some((d) => d !== null && d.date === todayStr));
    if (todayCol >= 0) {
      const cellWidth = 12 + 2;
      const labelWidth = 26 + 3;
      const targetX = labelWidth + todayCol * cellWidth - el.clientWidth / 2;
      el.scrollLeft = Math.max(0, targetX);
    } else {
      el.scrollLeft = el.scrollWidth;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [notice]);

  // Keyboard shortcuts for flashcard study
  useEffect(() => {
    if (activeView !== "cards" || cardView !== "复习") return;
    function handleKey(e: KeyboardEvent) {
      if (activeDialog) return;
      if (e.key === " " || e.key === "Space") {
        e.preventDefault();
        setCardFlipped((v) => !v);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCardFlipped(false);
        setCardIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setCardFlipped(false);
        setCardIndex((prev) => prev + 1);
        return;
      }
      // Find current card from latest state
      if (e.key === "1" || e.key === "2" || e.key === "3") {
        e.preventDefault();
        const mastery = e.key === "1" ? "认识" as const : e.key === "2" ? "模糊" as const : "不会" as const;
        reviewCard("", mastery); // We'll handle this differently
        return;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeView, cardView, activeDialog, cardIndex, cards]);

  const completed = tasks.filter((task) => task.done).length;
  const confirmedQuestions = questions.filter((question) => question.confirmed).length;
  const totalMinutes = tasks.reduce((sum, task) => sum + task.minutes, 0);
  const completedMinutes = tasks.reduce((sum, task) => sum + (task.actualMinutes !== "" ? Number(task.actualMinutes) : (task.done ? task.minutes : 0)), 0);
  const totalTargetScore = subjects.reduce((sum, subject) => sum + Number(subject.targetScore || 0), 0);
  const overallProgress = Math.round((nodes.reduce((sum, node) => sum + node.masteryScore, 0) / Math.max(nodes.length, 1)) * 0.55 + (confirmedQuestions / Math.max(questions.length, 1)) * 100 * 0.25 + (resources.filter((resource) => resource.status === "已索引").length / Math.max(resources.length, 1)) * 100 * 0.2);
  const daysLeft = hydratedDaysLeft;
  const currentSubject = subjects.find((subject) => subject.name === activeKnowledgeSubject) ?? subjects[0];
  const subjectResources = resources.filter((resource) => resource.subject === activeKnowledgeSubject);
  const activeResource = subjectResources.find((resource) => resource.id === activeResourceId) ?? subjectResources[0];
  const subjectQuestions = questions.filter((question) => question.subject === activeKnowledgeSubject);
  const subjectNodes = nodes.filter((node) => node.subject === activeKnowledgeSubject);
  const subjectAnnotations = annotations.filter((annotation) => subjectResources.some((resource) => resource.id === annotation.resourceId));
  const subjectCards = cards.filter((card) => card.subject === activeCardSubject);
  const dueCards = subjectCards.filter((card) => card.mastery === "不会" || card.mastery === "模糊" || card.lastReviewed === "未复习" || !card.nextReviewAt || card.nextReviewAt <= hydratedTodayStr);
  const cardQueue = dueCards.length ? dueCards : subjectCards;
  const activeCard = cardQueue[Math.min(cardIndex, Math.max(cardQueue.length - 1, 0))];
  const activeTask = tasks.find((task) => task.id === activeTaskId);
  const reviewSubjects = ["全部科目", ...subjects.map((subject) => subject.name)];
  const reviewTasks = activeReviewSubject === "全部科目" ? tasks : tasks.filter((task) => task.subject === activeReviewSubject);
  const reviewQuestions = activeReviewSubject === "全部科目" ? questions : questions.filter((question) => question.subject === activeReviewSubject);
  const reviewNodes = activeReviewSubject === "全部科目" ? nodes : nodes.filter((node) => node.subject === activeReviewSubject);
  const reviewCards = activeReviewSubject === "全部科目" ? cards : cards.filter((card) => card.subject === activeReviewSubject);
  const reviewMinutes = reviewTasks.reduce((sum, task) => sum + (task.actualMinutes !== "" ? Number(task.actualMinutes) : (task.done ? task.minutes : 0)), 0);
  const reviewCompletedTasks = reviewTasks.filter((task) => task.done).length;
  const reviewNewNodes = reviewNodes.filter((node) => node.isMonthlyFocus || node.reviewRisk !== "正常").length;
  const reviewDoneQuestions = reviewQuestions.filter((question) => question.done).length;
  const reviewReviewedCards = reviewCards.filter((card) => card.lastReviewed !== "未复习").length;
  const reviewMasteryDelta = reviewNodes.length ? Math.round(reviewNodes.reduce((sum, node) => sum + node.masteryScore, 0) / reviewNodes.length) : 0;
  const reviewAiSummary = activeReviewSubject === "全部科目"
    ? `今天整体投入 ${reviewMinutes} 分钟，完成 ${reviewCompletedTasks}/${reviewTasks.length} 个任务。`
    : `${activeReviewSubject} 今日投入 ${reviewMinutes} 分钟，完成 ${reviewCompletedTasks}/${reviewTasks.length} 个任务，掌握度估算 ${reviewMasteryDelta}%。`;
  const activePageKey = activeResource ? `${activeResource.id}:${readerPage || activeResource.currentPage || "1"}` : "";
  const readerText = "理想气体恒温过程的熵变公式 ΔS = nR ln(V₂/V₁)，使用前需要确认气体可视为理想气体且温度不变。相关真题通常考查过程类型、适用条件和公式选择。";
  const relatedQuestions = questions.filter((question) => activeResource && question.subject === activeResource.subject && (activeResource.linkedNode.includes(question.core) || activeResource.linkedNode.includes(question.branch) || readerText.includes(question.knowledge)));
  const filteredQuestions = questions.filter((question) => {
    const bySubject = questionFilter.subject === "全部" || question.subject === questionFilter.subject;
    const byCore = questionFilter.core === "全部" || question.core === questionFilter.core;
    const byResult = questionFilter.result === "全部" || question.result === questionFilter.result;
    const byKeyword = !questionFilter.keyword || `${question.stem}${question.knowledge}${question.year}`.includes(questionFilter.keyword);
    return bySubject && byCore && byResult && byKeyword;
  });
  const heatmapStart = exam.examGoalCreatedAt ?? hydratedTodayStr;
  const heatmapEnd = exam.examDate >= hydratedTodayStr ? exam.examDate : hydratedTodayStr;
  const heatmapDates = dateRange(heatmapStart, heatmapEnd);
  const heatmapDays = heatmapDates.map((date) => {
    const stored = studyDays.find((day) => day.date === date);
    // Use stored record for today too, to avoid inconsistency with independently computed completedMinutes
    if (date === hydratedTodayStr) return stored ?? { date, completed: 0, minutes: 0 };
    return stored ?? { date, completed: 0, minutes: 0 };
  });
  const heatmapTotalDays = heatmapDays.length;
  const formatDate = (iso: string) => {
    const parts = iso.split("-");
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  };
  const heatmapStartFormatted = `${heatmapStart.split("-")[0]}.${heatmapStart.split("-")[1]}.${heatmapStart.split("-")[2]}`;
  // Build GitHub-style contribution grid
  // Week starts on Monday (0=Mon, 6=Sun). We offset days so day 0 of heatmap aligns with its weekday.
  const startDayOfWeek = new Date(heatmapStart).getDay();
  // Convert JS Sunday-based to Monday-based: JS Sun=0 -> Mon=6, Mon=1 -> Mon=0, etc
  const monBasedOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  const totalSlots = heatmapTotalDays + monBasedOffset;
  const heatmapWeeks = Math.ceil(totalSlots / 7);
  const heatmapGrid: ({ date: string; completed: number; minutes: number } | null)[][] = [];
  let dayIndex = 0;
  for (let w = 0; w < heatmapWeeks; w++) {
    const week: ({ date: string; completed: number; minutes: number } | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const slotIdx = w * 7 + d;
      if (slotIdx < monBasedOffset) {
        week.push(null); // padding before start date
      } else if (dayIndex < heatmapTotalDays) {
        week.push(heatmapDays[dayIndex]);
        dayIndex++;
      } else {
        week.push(null); // padding after today
      }
    }
    heatmapGrid.push(week);
  }
  const todayStr = hydratedTodayStr;
  // Month labels: show month abbreviation for first visible week of each month
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const heatmapMonths: { label: string; colSpan: number }[] = [];
  heatmapGrid.forEach((week, wi) => {
    const firstDay = week.find((d) => d !== null);
    if (!firstDay) return;
    const month = new Date(firstDay.date).getMonth();
    const prevMonth = heatmapMonths.length > 0 ? heatmapMonths[heatmapMonths.length - 1] : null;
    if (!prevMonth || monthNames[month] !== prevMonth.label) {
      heatmapMonths.push({ label: monthNames[month], colSpan: 1 });
    } else {
      prevMonth.colSpan++;
    }
  });
  // Day labels for left side
  const dayLabels = ["", "一", "", "三", "", "五", ""];
  // Count cards created on each date for tooltip
  const cardsByDate: Record<string, number> = {};
  cards.forEach((card) => {
    const cardDate = card.createdAt.slice(0, 10);
    if (cardDate) cardsByDate[cardDate] = (cardsByDate[cardDate] || 0) + 1;
  });
  const todayCardsCount = cards.filter((card) => card.createdAt.slice(0, 10) === todayStr).length;
  const knowledgePanelLabel = activeKnowledgePanel === "resources" ? "资源与阅读" : activeKnowledgePanel === "questions" ? "真题库" : "知识图谱";
  const viewCrumbs = activeView === "knowledge" && activeKnowledgePanel !== "landing"
    ? ["知识中心", activeKnowledgeSubject || "未选择科目", knowledgePanelLabel]
    : activeView === "knowledge"
      ? ["知识中心"]
    : activeView === "cards"
      ? ["成长卡片", activeCardSubject || "未选择科目", cardMode]
      : activeView === "agent"
        ? ["AI学习助手"]
        : activeView === "settings"
          ? ["设置", "考试与科目"]
          : ["今日工作台", activeDashboardPanel === "review" ? "今日复盘" : "今日任务"];

  function pushAssistant(text: string) {
    setChat((items) => [...items, { role: "assistant", text }]);
    setNotice(text);
  }

  function recordStudyDay(minutes = 0, completedDelta = 0) {
    const date = dateOnly();
    setStudyDays((items) => {
      const exists = items.some((item) => item.date === date);
      const next = exists
        ? items.map((item) => item.date === date ? { ...item, completed: item.completed + completedDelta, minutes: item.minutes + minutes } : item)
        : [...items, { date, completed: completedDelta, minutes }];
      return next.slice(-MAX_STUDY_DAYS);
    });
  }

  function undoDelete() {
    if (!lastDeleted) return;
    if (lastDeleted.collection === "subjects") setSubjects((items) => [lastDeleted.item, ...items]);
    if (lastDeleted.collection === "resources") setResources((items) => [lastDeleted.item, ...items]);
    if (lastDeleted.collection === "questions") setQuestions((items) => [lastDeleted.item, ...items]);
    if (lastDeleted.collection === "nodes") setNodes((items) => [lastDeleted.item, ...items]);
    if (lastDeleted.collection === "cards") setCards((items) => [lastDeleted.item, ...items]);
    setNotice(`已撤销删除：${lastDeleted.label}`);
    setLastDeleted(null);
  }

  function deleteSubject(item: Subject) {
    setLastDeleted({ collection: "subjects", item, label: item.name });
    setSubjects((items) => items.filter((subject) => subject.id !== item.id));
    setNotice(`已删除科目：${item.name}`);
  }

  function deleteResource(item: Resource) {
    setLastDeleted({ collection: "resources", item, label: item.name });
    setResources((items) => items.filter((resource) => resource.id !== item.id));
    setNotice(`已删除资源：${item.name}`);
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

  function deleteCard(item: GrowthCard) {
    setLastDeleted({ collection: "cards", item, label: item.title });
    setCards((items) => items.filter((card) => card.id !== item.id));
    setNotice(`已删除卡片：${item.title}`);
  }

  function addLog(input: string, output: string, accepted = "自动生成", dataRead = ["考试日期", "科目状态", "学习历史", "高风险节点"]) {
    setLogs((items) => [{ id: makeId("l"), time: today(), input, output, accepted, dataRead, userRevision: "待记录", finalResult: output, rating: "未评价", rework: "0" }, ...items]);
  }

  function openResource(resource: Resource) {
    setActiveResourceId(resource.id);
    setActiveKnowledgeSubject(resource.subject);
    setReaderPage(resource.currentPage || "1");
    setActiveKnowledgePanel("resources");
    setActiveView("knowledge");
    setNotice(`已打开资料：${resource.name}`);
  }

  function saveReadingProgress() {
    if (!activeResource) return;
    const minutes = Number(activeResource.readingMinutes || 0);
    setResources((items) => items.map((item) => item.id === activeResource.id ? { ...item, currentPage: readerPage, lastRead: today(), readingMinutes: String(minutes), status: item.status === "待解析" ? "阅读中" : item.status } : item));
    recordStudyDay(minutes, 0);
    pushAssistant(`已记录阅读进度：${activeResource.name} P${readerPage || activeResource.currentPage || "1"}，阅读 ${minutes} 分钟。`);
  }

  function markResourceRead() {
    if (!activeResource) return;
    setResources((items) => items.map((item) => item.id === activeResource.id ? { ...item, status: "已读", lastRead: today(), currentPage: readerPage || item.currentPage } : item));
    pushAssistant(`已标记已读：${activeResource.name}`);
  }

  function toggleFavoritePage() {
    if (!activePageKey || !activeResource) return;
    const isFavorite = favoritePages.includes(activePageKey);
    setFavoritePages((items) => isFavorite ? items.filter((item) => item !== activePageKey) : [activePageKey, ...items]);
    setNotice(`已${isFavorite ? "取消收藏" : "收藏"}：${activeResource.name} P${readerPage || activeResource.currentPage || "1"}`);
  }

  function showRelatedQuestions(core: string, keyword = "", subject = activeResource?.subject ?? currentSubject?.name ?? "全部") {
    if (subject !== "全部") setActiveKnowledgeSubject(subject);
    setQuestionFilter({ subject, core: core || "全部", result: "全部", keyword });
    setActiveKnowledgePanel("questions");
    setActiveView("knowledge");
    setNotice("已筛出相关真题");
  }

  function openCardSource(card: GrowthCard) {
    const resource = resources.find((item) => card.source && (item.name === card.source || card.source.includes(item.name) || item.name.includes(card.source)));
    if (resource) setActiveResourceId(resource.id);
    setActiveKnowledgeSubject(card.subject);
    setReaderPage(card.page.replace(/^P/i, "") || resource?.currentPage || "");
    setActiveKnowledgePanel("resources");
    setActiveView("knowledge");
    setNotice(`已定位来源：${card.source} ${card.page}`);
  }

  function saveExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setExam((prev) => ({
      ...prev,
      examName: String(form.get("examName") ?? prev.examName),
      school: String(form.get("school") ?? prev.school),
      major: String(form.get("major") ?? prev.major),
      examDate: String(form.get("examDate") ?? prev.examDate),
      startDate: prev.startDate || dateOnly(),
      examGoalCreatedAt: prev.examGoalCreatedAt ?? dateOnly(),
      weeklyDays: String(form.get("weeklyDays") ?? prev.weeklyDays),
      weekdayHours: String(form.get("weekdayHours") ?? prev.weekdayHours),
      weekendHours: String(form.get("weekendHours") ?? prev.weekendHours),
      baseline: String(form.get("baseline") ?? prev.baseline),
    }));
    pushAssistant("考试目标已更新，后续计划会按新的时间和基础情况计算。");
    setActiveDialog(null);
  }

  function addSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) return;
    const subject: Subject = {
      id: makeId("s"),
      name,
      type: String(form.get("type") ?? "自定义"),
      targetScore: String(form.get("targetScore") ?? ""),
      currentProgress: String(form.get("currentProgress") ?? ""),
      currentMastery: String(form.get("currentMastery") ?? "未接触"),
      weeklyHours: String(form.get("weeklyHours") ?? ""),
      hasPastPapers: form.get("hasPastPapers") === "on",
      hasSolutions: form.get("hasSolutions") === "on",
      hasReferences: form.get("hasReferences") === "on",
      round: "第一轮",
      layer: "Layer 1",
      focus: String(form.get("currentProgress") ?? "待生成七核"),
      risk: "正常",
    };
    setSubjects((items) => [...items, subject]);
    setActiveKnowledgeSubject(subject.name);
    setActiveCardSubject(subject.name);
    pushAssistant(`已添加科目：${subject.name}。下一步上传真题和参考资料。`);
    setActiveDialog(null);
    event.currentTarget.reset();
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
    const recommendedLayer = isPastPaper ? "Layer 2-4" : "Layer 1-2";
    return { subject, type, name, pages, linkedNode, recommendedLayer, duplicate: resources.some((resource) => resource.fileName === rawName || resource.name === name) };
  }

  function addResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file") as File | null;
    const rawName = String(file?.name || form.get("sourceText") || "").trim();
    if (!rawName) return;
    const inferred = inferResource(rawName, String(form.get("subjectHint") ?? ""));
    const resource: Resource = {
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
    };
    setResources((items) => [resource, ...items]);
    setPending((items) => [
      { id: makeId("p"), kind: inferred.type.includes("真题") ? "真题识别" : "资料切分", title: resource.name, subject: inferred.subject, detail: `AI识别结果：科目 ${inferred.subject}；类型 ${inferred.type}；${inferred.pages}；${inferred.linkedNode}；${inferred.duplicate ? "疑似重复上传" : "未发现重复"}`, status: "待确认", targetId: resource.id },
      ...items,
    ]);
    setActiveKnowledgeSubject(inferred.subject);
    pushAssistant(`AI已识别资料：${resource.name}。请确认后写入知识中心。`);
    setActiveDialog(null);
    event.currentTarget.reset();
  }

  function addQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const stem = String(form.get("stem") ?? "").trim();
    if (!stem) return;
    const question: Question = {
      id: makeId("q"),
      subject: String(form.get("subject") ?? subjects[0]?.name ?? ""),
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
      layer: String(form.get("layer") ?? "Layer 2"),
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
    pushAssistant("题目已录入，进入待确认队列。");
    setActiveDialog(null);
    event.currentTarget.reset();
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
      layer: "Layer 1",
      mistakes: 0,
      reviewRisk: "正常",
      isMonthlyFocus: false,
    };
    setNodes((items) => [node, ...items]);
    pushAssistant(`已添加知识点：${node.core} / ${node.branch} / ${node.knowledge}`);
    setActiveDialog(null);
    event.currentTarget.reset();
  }

  function confirmPending(id: string) {
    const item = pending.find((entry) => entry.id === id);
    setPending((items) => items.filter((entry) => entry.id !== id));
    if (item?.kind === "真题识别") {
      setQuestions((items) => items.map((question) => item.targetId ? question.id === item.targetId ? { ...question, confirmed: true } : question : item.title === `${question.year} ${question.subject} 第 ${question.number} 题` ? { ...question, confirmed: true } : question));
      setResources((items) => items.map((resource) => resource.id === item.targetId || resource.name === item.title ? { ...resource, status: "已索引", linkedNode: item.detail } : resource));
    }
    if (item?.kind === "资料切分") {
      setResources((items) => items.map((resource) => resource.id === item.targetId || resource.name === item.title ? { ...resource, status: "已索引", linkedNode: item.detail } : resource));
    }
    if (item?.kind === "图谱更新") {
      setNodes((items) => items.map((node, index) => index === 0 ? { ...node, masteryScore: Math.max(0, node.masteryScore - MASTERY.confirmUpdatePenalty), reviewRisk: "高风险", confidence: "高" } : node));
    }
    pushAssistant(`已确认：${item?.title ?? "条目"}。`);
  }

  function runAgentWorkflow(input: string) {
    const steps: AgentStep[] = ["分析真题", "更新知识图谱", "更新掌握度", "重排本周计划", "生成学习笔记"].map((title) => ({ id: makeId("a"), title, status: "完成" }));
    const core = nodes[0]?.core ?? "热力学";
    const knowledge = nodes[0]?.knowledge ?? "熵变计算";
    setAgentSteps(steps);
    setPending((items) => [{ id: makeId("p"), kind: "图谱更新", title: "近三套真题分析结果", subject: currentSubject?.name ?? "未分科", detail: `建议提高 ${core} / ${knowledge} 的复习优先级`, status: "待确认" }, ...items]);
    setNotes((items) => [{ id: makeId("n"), title: "真题分析学习笔记", body: `近三套真题集中指向 ${core} / ${knowledge}。先补适用条件，再做综合题。`, tags: ["Agent", "真题分析", core] }, ...items]);
    generatePlan(input);
  }

  function runPrompt(prompt = chatInput) {
    const text = prompt.trim();
    if (!text) return;
    setChat((items) => [...items, { role: "user", text }]);
    setChatInput("");
    if (text.includes("今天") || text.includes("学什么")) {
      generatePlan("AI 指令：今天学什么");
      return;
    }
    if (text.includes("分析") && text.includes("真题") && (text.includes("更新") || text.includes("重排") || text.includes("计划"))) {
      runAgentWorkflow(text);
      return;
    }
    if (text.includes("真题") || text.includes("化学势")) {
      setQuestionFilter({ subject: "828 物理化学", core: text.includes("化学势") ? "热力学" : "全部", result: "全部", keyword: text.includes("化学势") ? "化学势" : "" });
      setActiveView("knowledge");
      pushAssistant(`已从真题数据库筛出 ${questions.filter((q) => q.knowledge.includes("化学势") || q.core === "热力学").length} 道相关题。`);
      return;
    }
    if (text.includes("傅献彩") || text.includes("哪里讲")) {
      const resource = resources.find((item) => item.name.includes("傅献彩"));
      if (resource) {
        setActiveResourceId(resource.id);
        setReaderPage("132");
        setActiveView("knowledge");
      }
      pushAssistant("傅献彩《物理化学》第六版 P132-140 已关联到 热力学 / 熵与熵变 / 熵变计算。");
      return;
    }
    if (text.includes("错") || text.includes("不会")) {
      pushAssistant("近几次错误集中在适用条件判断。规则引擎建议延长 Layer 2，不进入 Layer 4。");
      return;
    }
    if (text.includes("笔记") || text.includes("总结")) {
      setNotes((items) => [{ id: makeId("n"), title: "AI 生成笔记", body: "今日重点：先判断过程类型，再选择熵变公式。", tags: ["AI笔记", "热力学"] }, ...items]);
      pushAssistant("已生成成长笔记。");
      return;
    }
    if (text.includes("复习") && (text.includes("十分钟") || text.includes("不会") || text.includes("模糊"))) {
      setActiveView("cards");
      pushAssistant(`已安排 ${Math.min(dueCards.length, TASK.maxReviewCards)} 张成长卡片，优先不会和模糊的公式卡。`);
      return;
    }
    if (text.includes("卡片") || text.includes("填空卡") || text.includes("公式卡")) {
      createCardFromText("AI对话", text);
      return;
    }
    if (text.includes("第几轮")) {
      pushAssistant(`当前主要科目处于 ${subjects[0]?.round ?? "第一轮"}，${subjects[0]?.layer ?? "Layer 1"}。`);
      return;
    }
    pushAssistant("已收到。可以继续让我安排任务、检索真题、生成笔记或调整图谱。");
  }

  function generatePlan(input = "手动重新安排今天") {
    const highRiskNode = nodes.find((node) => node.reviewRisk === "高风险") ?? nodes[0];
    if (!highRiskNode) return;
    const nextTasks: Task[] = [
      {
        id: makeId("t"),
        title: `回看 ${highRiskNode.knowledge}`,
        subject: highRiskNode.subject,
        core: highRiskNode.core,
        branch: highRiskNode.branch,
        round: highRiskNode.round,
        layer: highRiskNode.layer,
        source: resources.find((resource) => resource.subject === highRiskNode.subject)?.name ?? "已上传资料",
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
      },
    ];
    setTasks(nextTasks);
    addLog(input, `生成 ${nextTasks.length} 个任务，优先 ${highRiskNode.core} / ${highRiskNode.knowledge}`);
    pushAssistant(`已重新安排今天：优先 ${highRiskNode.subject} 的 ${highRiskNode.knowledge}。`);
  }

  function updateTask(id: string, patch: Partial<Task>) {
    setTasks((items) => items.map((task) => task.id === id ? { ...task, ...patch } : task));
  }

  function toggleTaskDone(task: Task) {
    const nextDone = !task.done;
    updateTask(task.id, { done: nextDone });
    if (nextDone) recordStudyDay(task.actualMinutes !== "" ? Number(task.actualMinutes) : (task.minutes || 0), 1);
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

  function startTask(task: Task) {
    const now = new Date();
    const startTimeStr = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    setTimerStartTime(startTimeStr);
    setElapsedSeconds(0);
    setActiveTimerTaskId(task.id);
    setCompletionModalAllowEditTime(false);
    setCompletionModalCustomMinutes("");
    // Record start time and set status to 学习中
    updateTask(task.id, { status: "学习中", startedAt: startTimeStr });
    // Start interval to count elapsed seconds
    stopTimer();
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    setNotice(`开始学习：${task.title}`);
  }

  function handleEndLearning(task: Task) {
    // Stop timer
    stopTimer();
    // Calculate actual minutes from elapsed seconds
    const elapsedMin = Math.max(TASK.minElapsedMinutes, Math.round(elapsedSeconds / 60));
    setCompletionModalCustomMinutes(String(elapsedMin));
    setCompletionModalAllowEditTime(false);
    // Set end time immediately (not in JSX render)
    setCompletionModalCustomEndTime(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }));
    // Open completion modal
    setActiveTaskId(task.id);
    setActiveDialog("task");
    setActiveTimerTaskId("");
  }

  function switchToBackup(task: Task) {
    updateTask(task.id, { title: `备用：${task.backup}`, minutes: Math.min(task.minutes, TASK.backupMaxMinutes), standard: "完成备用任务并记录困难点。", reason: "用户切换到低负荷备用任务。" });
    addLog("切换备用任务", `${task.title} 改为备用任务：${task.backup}`, "用户调整", ["今日可用时间", "原任务负荷", "备用任务"]);
    setNotice("已切换为备用任务");
  }

  function completeTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    const actualMinutesValue = completionModalAllowEditTime ? completionModalCustomMinutes : (task.actualMinutes || String(Math.max(1, Math.round(elapsedSeconds / 60))));
    const endTimeStr = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    updateTask(id, {
      done: true,
      status: "已完成",
      actualMinutes: actualMinutesValue,
      completedAt: endTimeStr,
    });
    recordStudyDay(Number(actualMinutesValue || task.minutes || 0), task.done ? 0 : 1);
    const accuracyNumber = Number(task.accuracy || 0);
    if (accuracyNumber && accuracyNumber < 60) {
      setNodes((items) => items.map((node) => node.knowledge === task.branch || node.core === task.core ? { ...node, masteryScore: Math.max(0, node.masteryScore - 8), masteryLevel: Math.max(0, node.masteryLevel - 1), mistakes: node.mistakes + 1, reviewRisk: "高风险" } : node));
    }
    pushAssistant(`已记录任务：${task.title}（${actualMinutesValue} 分钟）。`);
  }

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const low = review.hard.includes("错") || review.hard.includes("不会") || review.load === "过多";
    const message = low ? "明日减少新内容，保留高风险知识点并安排概念回看。" : "明日可加入少量新内容，同时保留一次复习。";
    setNotes((items) => [{ id: makeId("n"), title: `${activeReviewSubject} ${reviewScope}`, body: `${review.done || "已完成学习"}。困难：${review.hard || "未填写"}。${reviewAiSummary}`, tags: ["复盘", activeReviewSubject, reviewScope, review.load] }, ...items]);
    addLog(`${activeReviewSubject} ${reviewScope}`, message, "已接受", [activeReviewSubject, reviewScope, "完成记录", "困难点", "明日时间"]);
    pushAssistant(message);
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
    if (annotation) setAnnotations((items) => items.map((item) => item.id === annotation.id ? { ...item, handled: true } : item));
    pushAssistant(`已创建成长卡片：${card.title}`);
  }

  function addAnnotation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selection = String(form.get("selection") ?? "").trim();
    if (!selection || !activeResource) return;
    const annotation: Annotation = {
      id: makeId("a"),
      resourceId: activeResource.id,
      resourceName: activeResource.name,
      page: String(form.get("page") ?? activeResource.currentPage ?? ""),
      selection,
      tag: String(form.get("tag") ?? "核心概念") as Annotation["tag"],
      note: String(form.get("note") ?? ""),
      linkedNode: String(form.get("linkedNode") ?? activeResource.linkedNode),
      createdAt: today(),
      handled: false,
    };
    setAnnotations((items) => [annotation, ...items]);
    pushAssistant(`已添加批注：${annotation.selection}`);
    setActiveDialog(null);
    event.currentTarget.reset();
  }

  function reviewCard(id: string, mastery: GrowthCard["mastery"]) {
    const intervalDays = mastery === "不会" ? 1 : mastery === "模糊" ? 3 : mastery === "认识" ? 7 : mastery === "熟练" ? 14 : 30;
    setCards((items) => items.map((card) => card.id === id ? { ...card, mastery, lastReviewed: today(), nextReviewAt: dateOnly(intervalDays) } : card));
    const interval = mastery === "不会" ? "明天" : mastery === "模糊" ? "3 天后" : mastery === "认识" ? "7 天后" : mastery === "熟练" ? "14 天后" : "30 天后";
    pushAssistant(`已记录卡片掌握状态：${mastery}。下次建议复习：${interval}。`);
    setCardFlipped(false);
    setCardIndex((index) => Math.min(index + 1, Math.max(cardQueue.length - 1, 0)));
  }

  function moveCard(step: number) {
    setCardFlipped(false);
    setCardIndex((index) => Math.min(Math.max(index + step, 0), Math.max(cardQueue.length - 1, 0)));
  }

  function importData(file: File | undefined) {
    if (!file) return;
    file.text().then((text) => {
      const data = JSON.parse(text);
      setExam(normalizeExamGoal(data.exam ?? seedExam));
      setAppSettings(data.appSettings ?? seedAppSettings);
      setSubjects(data.subjects ?? []);
      setResources((data.resources ?? []).map((resource: Resource) => ({ ...resource, readingMinutes: resource.readingMinutes ?? "" })));
      setQuestions(data.questions ?? []);
      setNodes(data.nodes ?? []);
      setTasks(data.tasks ?? []);
      setNotes(data.notes ?? []);
      setCards((data.cards ?? []).map((card: GrowthCard) => ({ ...card, nextReviewAt: card.nextReviewAt ?? dateOnly() })));
      setAnnotations(data.annotations ?? []);
      setActiveKnowledgeSubject(data.activeKnowledgeSubject ?? data.subjects?.[0]?.name ?? "");
      setActiveCardSubject(data.activeCardSubject ?? data.subjects?.[0]?.name ?? "");
      setActiveResourceId(data.activeResourceId ?? data.resources?.[0]?.id ?? "");
      setReaderSearch(data.readerSearch ?? "");
      setReaderPage(data.readerPage ?? data.resources?.[0]?.currentPage ?? "");
      setReaderZoom(data.readerZoom ?? "100%");
      setFavoritePages(data.favoritePages ?? []);
      setStudyDays(data.studyDays ?? seedStudyDays);
      setAgentSteps(data.agentSteps ?? []);
      setPending(data.pending ?? []);
      setLogs((data.logs ?? []).map((log: PlanLog) => ({ ...log, dataRead: log.dataRead ?? [], userRevision: log.userRevision ?? "无", finalResult: log.finalResult ?? log.output, rating: log.rating ?? "未评价", rework: log.rework ?? "0" })));
      setChat(data.chat ?? chat);
      setNotice("数据已导入");
    }).catch(() => setNotice("导入失败：请选择本系统导出的 JSON 文件"));
  }

  return (
    <main className="min-h-screen min-w-0 lg:pl-[288px]">
      {/* 左侧侧栏 — 桌面端固定 */}
      <aside className="fixed top-0 left-0 h-screen w-[288px] z-10 hidden lg:flex flex-col bg-white/82 backdrop-blur-[18px] border-r border-[#E4E4E7] p-4 overflow-y-auto overflow-x-hidden">
        {/* 1. Logo + 倒计时 */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="grid place-items-center w-10 h-10 rounded-lg bg-[#27272A] text-white shrink-0" style={{ fontSize: 18, fontWeight: 600 }}>N</span>
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.2, color: '#18181B' }}>筑巢考研</div>
            <div style={{ fontSize: 12, fontWeight: 400, lineHeight: 1.4, color: '#71717A', marginTop: 2 }}>Learning Agent</div>
          </div>
          <div className="flex items-baseline gap-1 shrink-0">
            <span style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.2, color: '#18181B' }}>{daysLeft}</span>
            <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, color: '#71717A' }}>天</span>
          </div>
        </div>

        <div className="border-t border-[#F1F1F3] mt-4 pt-4">
          {/* 2. 目标信息 + 进度 */}
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4, color: '#18181B' }} className="line-clamp-2">{exam.school || "未设置院校"}</div>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: '#71717A', marginTop: 2 }}>{exam.major || "未设置专业"}</div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between items-center">
              <span style={{ fontSize: 12, fontWeight: 400, lineHeight: 1.4, color: '#71717A' }}>目标 <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, color: '#18181B' }}>{totalTargetScore}</span></span>
              <span style={{ fontSize: 12, fontWeight: 400, lineHeight: 1.4, color: '#71717A' }}>整体进度 <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, color: '#18181B' }}>{overallProgress}%</span></span>
            </div>
            <div className="h-1.5 rounded-full bg-[#F1F1F3] overflow-hidden mt-2">
              <div className="h-full rounded-full bg-[#27272A] transition-all duration-300" style={{ width: `${overallProgress}%` }} />
            </div>
          </div>
        </div>

        {/* 3. 热力图 */}
        <div className="border-t border-[#E4E4E7] mt-4 pt-4 w-full min-w-0 max-w-full">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[13px] font-semibold leading-[1.4] text-[#18181B] shrink-0">学习记录</div>
            <div className="text-[11px] leading-[1.4] text-[#71717A] shrink-0 whitespace-nowrap">开始于 {heatmapStartFormatted}</div>
          </div>
          <div
            className="w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(161,161,170,0.5) transparent' }}
            ref={heatmapRef}
          >
            <div className="w-max" style={{ minWidth: 'max-content' }}>
              {/* Month labels */}
              <div className="flex gap-[2px] mb-[2px] ml-[29px]">
                {heatmapMonths.map((m, i) => (
                  <div key={i} className="text-[9px] text-[#71717A] leading-none h-[12px]" style={{ width: `${m.colSpan * (12 + 2) - 2}px` }}>{m.label}</div>
                ))}
              </div>
              {/* Grid with day labels */}
              <div className="flex gap-[2px]">
                {/* Day labels */}
                <div className="flex flex-col gap-[2px] mr-[2px]">
                  {dayLabels.map((label, i) => (
                    <div key={i} className="text-[9px] text-[#71717A] leading-none w-[24px] h-[12px] flex items-center justify-end pr-[3px]">{label}</div>
                  ))}
                </div>
                {/* Week columns */}
                {heatmapGrid.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[2px]">
                    {week.map((day, di) => {
                      if (day === null) return <div key={`pad-${wi}-${di}`} className="w-[12px] h-[12px]" />;
                      const isPast = day.date < todayStr;
                      const isFuture = day.date > todayStr;
                      const isTodayCell = day.date === todayStr;
                      const isExamDay = day.date === exam.examDate;
                      let level = isFuture ? 0 : (day.completed >= 4 ? 4 : day.completed >= 3 ? 3 : day.completed >= 2 ? 2 : day.completed >= 1 ? 1 : 0);
                      let color = 'bg-[#F1F1F3]';
                      if (!isFuture && level === 1) color = 'bg-[#D4D4D8]';
                      else if (!isFuture && level === 2) color = 'bg-[#A1A1AA]';
                      else if (!isFuture && level === 3) color = 'bg-[#71717A]';
                      else if (!isFuture && level === 4) color = 'bg-[#27272A]';
                      return (
                        <div
                          key={day.date}
                          className={`w-[12px] h-[12px] rounded-[2px] ${color} cursor-default ${isTodayCell ? 'ring-[1px] ring-[#52525B]' : ''} ${isExamDay ? 'ring-[1px] ring-[#18181B]' : ''}`}
                          onMouseEnter={(e) => {
                            if (showTimerRef.current) {
                              clearTimeout(showTimerRef.current);
                              showTimerRef.current = undefined;
                            }
                            if (hideTimerRef.current) {
                              clearTimeout(hideTimerRef.current);
                              hideTimerRef.current = undefined;
                            }
                            hoveredDateRef.current = day.date;
                            // If moving to another cell while tooltip is visible, update content immediately
                            if (tooltipVisible) {
                              const cellEl = e.currentTarget;
                              if (!(cellEl instanceof HTMLElement)) return;
                              const sidebar = cellEl.closest('aside');
                              const sidebarRect = sidebar?.getBoundingClientRect();
                              const cellRect = cellEl.getBoundingClientRect();
                              if (sidebarRect) {
                                const cellCenterX = cellRect.left - sidebarRect.left + cellRect.width / 2;
                                const tooltipWidth = 190;
                                const tooltipHeight = 56;
                                const spaceAbove = cellRect.top - sidebarRect.top;
                                const above = spaceAbove > tooltipHeight + 12;
                                const top = above
                                  ? cellRect.top - sidebarRect.top - tooltipHeight - 4
                                  : cellRect.bottom - sidebarRect.top + 4;
                                let left = cellCenterX - tooltipWidth / 2;
                                if (left < 8) left = 8;
                                if (left + tooltipWidth > sidebarRect.width - 8) {
                                  left = sidebarRect.width - tooltipWidth - 8;
                                }
                                setTooltipData({ date: day.date, top, left, above });
                              }
                            } else {
                              // Schedule show with 400ms delay
                              showTimerRef.current = setTimeout(() => {
                                if (hoveredDateRef.current !== day.date) return;
                                const cellEl = e.currentTarget;
                                if (!(cellEl instanceof HTMLElement)) return;
                                const sidebar = cellEl.closest('aside');
                                const sidebarRect = sidebar?.getBoundingClientRect();
                                const cellRect = cellEl.getBoundingClientRect();
                                if (!sidebarRect) return;
                                const cellCenterX = cellRect.left - sidebarRect.left + cellRect.width / 2;
                                const tooltipWidth = 190;
                                const tooltipHeight = 56;
                                const spaceAbove = cellRect.top - sidebarRect.top;
                                const above = spaceAbove > tooltipHeight + 12;
                                const top = above
                                  ? cellRect.top - sidebarRect.top - tooltipHeight - 4
                                  : cellRect.bottom - sidebarRect.top + 4;
                                let left = cellCenterX - tooltipWidth / 2;
                                if (left < 8) left = 8;
                                if (left + tooltipWidth > sidebarRect.width - 8) {
                                  left = sidebarRect.width - tooltipWidth - 8;
                                }
                                setTooltipData({ date: day.date, top, left, above });
                                setTooltipVisible(true);
                                showTimerRef.current = undefined;
                              }, 400);
                            }
                          }}
                          onMouseLeave={() => {
                            hoveredDateRef.current = null;
                            if (showTimerRef.current) {
                              clearTimeout(showTimerRef.current);
                              showTimerRef.current = undefined;
                            }
                            if (!hideTimerRef.current) {
                              hideTimerRef.current = setTimeout(() => {
                                setTooltipVisible(false);
                                setTooltipData(null);
                                hideTimerRef.current = undefined;
                              }, 150);
                            }
                          }}
                          onClick={(e) => {
                            if (tappedDate === day.date) {
                              setTappedDate(null);
                              setTooltipVisible(false);
                              setTooltipData(null);
                            } else {
                              setTappedDate(day.date);
                              const cellEl = e.currentTarget;
                              if (!(cellEl instanceof HTMLElement)) return;
                              const sidebar = cellEl.closest('aside');
                              const sidebarRect = sidebar?.getBoundingClientRect();
                              const cellRect = cellEl.getBoundingClientRect();
                              if (sidebarRect) {
                                const cellCenterX = cellRect.left - sidebarRect.left + cellRect.width / 2;
                                const tooltipWidth = 190;
                                const tooltipHeight = 56;
                                const spaceAbove = cellRect.top - sidebarRect.top;
                                const above = spaceAbove > tooltipHeight + 12;
                                const top = above
                                  ? cellRect.top - sidebarRect.top - tooltipHeight - 4
                                  : cellRect.bottom - sidebarRect.top + 4;
                                let left = cellCenterX - tooltipWidth / 2;
                                if (left < 8) left = 8;
                                if (left + tooltipWidth > sidebarRect.width - 8) {
                                  left = sidebarRect.width - tooltipWidth - 8;
                                }
                                setTooltipData({ date: day.date, top, left, above });
                                setTooltipVisible(true);
                                if (showTimerRef.current) {
                                  clearTimeout(showTimerRef.current);
                                  showTimerRef.current = undefined;
                                }
                                if (hideTimerRef.current) {
                                  clearTimeout(hideTimerRef.current);
                                  hideTimerRef.current = undefined;
                                }
                              }
                            }
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Tooltip — absolute positioned + animated */}
          <div
            style={{
              position: 'absolute',
              top: tooltipData?.top ?? 0,
              left: tooltipData?.left ?? 0,
              pointerEvents: 'none',
              zIndex: 50,
              backgroundColor: '#27272A',
              color: '#ffffff',
              padding: '6px 10px',
              maxWidth: '190px',
              minWidth: '0',
              borderRadius: '6px',
              opacity: tooltipVisible ? 1 : 0,
              transform: tooltipVisible ? 'translateY(0)' : 'translateY(4px)',
              transition: 'opacity 120ms ease, transform 120ms ease',
            }}
          >
            {tooltipData && (() => {
              const day = tooltipData.date;
              const dayData = heatmapDays.find((d) => d.date === day);
              const cardCount = cardsByDate[day] || 0;
              const isFuture = day > todayStr;
              const isExamDay = day === exam.examDate;
              const parts = day.split("-");
              const dateLabel = `${parts[0]}.${parts[1]}.${parts[2]}`;
              const hasRecord = dayData && (dayData.completed > 0 || dayData.minutes > 0 || cardCount > 0);
              let dataLine = "";
              if (isFuture && !isExamDay && !hasRecord) {
                dataLine = "尚未到达";
              } else if (isExamDay && !hasRecord) {
                dataLine = "考试日";
              } else if (isExamDay && hasRecord) {
                dataLine = `考试日 · ${dayData!.minutes} 分钟 · ${dayData!.completed} 项任务`;
                if (cardCount > 0) dataLine += ` · ${cardCount} 张卡片`;
              } else if (hasRecord) {
                dataLine =  `${dayData!.minutes} 分钟 · ${dayData!.completed} 项任务`;
                if (cardCount > 0) dataLine += ` · ${cardCount} 张卡片`;
              } else {
                dataLine = "暂无学习记录";
              }
              return (
                <>
                  <div style={{ fontSize: '13px', fontWeight: 500, lineHeight: 1.3, color: 'rgba(255,255,255,0.9)' }}>{dateLabel}</div>
                  <div style={{ fontSize: '12px', lineHeight: 1.3, color: 'rgba(255,255,255,0.75)', marginTop: '1px' }}>{dataLine}</div>
                </>
              );
            })()}
          </div>
        </div>

        {/* 5. 四宫格 */}
        <div className="border-t border-[#E4E4E7] mt-4 pt-4">
          <div className="text-[13px] font-semibold leading-[1.4] text-[#18181B] mb-2">核心工作区</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "dashboard", label: "今日工作台", icon: "📋" },
              { key: "agent", label: "AI学习助手", icon: "🤖" },
              { key: "knowledge", label: "知识中心", icon: "📚" },
              { key: "cards", label: "成长卡片", icon: "🗂️" },
            ].map((item) => {
              const isActive = activeView === item.key;
              return (
                <button
                  key={item.key}
                  className={`flex flex-col items-center justify-center rounded-[14px] transition-all duration-200 w-full ${
                    isActive
                      ? 'bg-[#EDEDED] text-[#18181B]'
                      : 'bg-white text-[#18181B] hover:bg-[#F4F4F5] hover:-translate-y-[1px]'
                  }`}
                  style={{
                    height: '82px',
                    border: '1px solid #E4E4E7',
                    boxShadow: isActive
                      ? '0 2px 6px rgba(0, 0, 0, 0.06)'
                      : '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.05)',
                  }}
                  onClick={() => setActiveView(item.key as WorkspaceView)}
                >
                  <span style={{ fontSize: '20px', lineHeight: 1 }}>{item.icon}</span>
                  <span style={{ fontSize: '14px', fontWeight: 500, lineHeight: 1.2, marginTop: 8, color: isActive ? '#18181B' : '#18181B' }}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 6. 设置 — 轻量入口 */}
        <nav className="border-t border-[#E4E4E7] mt-4 pt-4">
          <button
            className={`w-full flex items-center h-9 px-3 rounded-[10px] text-left transition-colors ${
              activeView === "settings"
                ? 'bg-[#EDEDED] text-[#18181B]'
                : 'bg-transparent text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5]'
            }`}
            onClick={() => setActiveView("settings")}
          >
            <span style={{ fontSize: '14px', lineHeight: 1 }} className="mr-2">⚙️</span>
            <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>设置</span>
          </button>
        </nav>
      </aside>

      <div className="mx-auto w-full max-w-7xl px-6 py-8 min-w-0">
        {(notice || lastDeleted) && (
          <div className="toast-notice">
            {notice && <span>{notice}</span>}
            {lastDeleted && <button onClick={undoDelete}>撤销删除</button>}
          </div>
        )}
        <div className="breadcrumb" aria-label="当前位置">
          {viewCrumbs.map((crumb, index) => (
            <span key={`${crumb}-${index}`}>{crumb}</span>
          ))}
        </div>

        {/* Dashboard 主导航 — 移到页面顶部 */}
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

        {activeView === "dashboard" && activeDashboardPanel === "tasks" && <section className="hero-grid workspace-pane active dashboard-hero" id="agent">
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
            <div className="chat-window">
              {chat.slice(-7).map((message, index) => <div className={`bubble ${message.role}`} key={`${message.text}-${index}`}>{message.text}</div>)}
              <form className="prompt-bar" onSubmit={(event) => { event.preventDefault(); runPrompt(); }}>
                <span>输入</span>
                <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="例如：今天还有两个小时，重新安排计划" />
                <button>发送</button>
              </form>
            </div>
          </div>

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
                      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                        <strong>{task.title}</strong>
                        {task.aiRecommended && <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#EDEDED] text-[#52525B] font-bold">AI推荐</span>}
                      </div>
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
                          <span className={`font-bold ${task.status === "暂停" ? "text-[#F59E0B]" : "text-[#52525B]"}`}>{task.status === "暂停" ? "● 已暂停" : "● 学习中"}</span>
                          <span className="text-[#71717A]">开始 {timerStartTime}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[12px]">
                          <span className="text-[#71717A]">已学习</span>
                          <span className="font-bold text-[#18181B]">{Math.floor(elapsedSeconds / 60)} 分钟 {elapsedSeconds % 60} 秒</span>
                          <span className="text-[#A1A1AA]">| 预计 {task.estimatedCompletionMinutes || task.minutes} 分钟</span>
                        </div>
                        {/* 进度条 */}
                        <div className="h-1.5 rounded-full bg-[#D4D4D8] overflow-hidden mt-1.5">
                          <div
                            className="h-full rounded-full bg-[#0F766E] transition-all duration-500"
                            style={{ width: `${Math.min(100, (elapsedSeconds / 60) / (task.estimatedCompletionMinutes || task.minutes) * 100)}%` }}
                          />
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
                              <button className="min-h-[30px] px-4 rounded-[6px] bg-[#F59E0B] text-white font-bold text-[12px]" type="button" onClick={() => {
                                updateTask(task.id, { status: "学习中" });
                                stopTimer();
                                timerIntervalRef.current = setInterval(() => {
                                  setElapsedSeconds((prev) => prev + 1);
                                }, 1000);
                              }}>继续学习</button>
                              <button className="min-h-[30px] px-3 rounded-[6px] bg-[#18181B] text-white font-bold text-[12px]" type="button" onClick={() => handleEndLearning(task)}>结束学习</button>
                            </>
                          ) : (
                            <>
                              <button className="min-h-[30px] px-4 rounded-[6px] bg-[#0F766E] text-white font-bold text-[12px]" type="button">⏱ 学习中</button>
                              <button className="min-h-[30px] px-3 rounded-[6px] bg-[#F4F4F5] text-[#18181B] font-bold text-[12px]" type="button" onClick={() => { stopTimer(); updateTask(task.id, { status: "暂停" }); }}>暂停</button>
                              <button className="min-h-[30px] px-3 rounded-[6px] bg-[#18181B] text-white font-bold text-[12px]" type="button" onClick={() => handleEndLearning(task)}>结束学习</button>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <button className="min-h-[30px] px-4 rounded-[6px] bg-[#18181B] text-white font-bold text-[12px]" type="button" onClick={() => startTask(task)}>开始学习</button>
                          <button className="min-h-[30px] px-3 rounded-[6px] bg-[#F4F4F5] text-[#71717A] text-[12px]" type="button" onClick={() => { setActiveTaskId(task.id); setActiveDialog("task"); }}>记录结果</button>
                        </>
                      )}
                      <details className="more-menu">
                        <summary className="text-[12px] min-h-[28px] px-2 rounded-[6px] bg-[#F4F4F5] text-[#71717A] font-bold">•••</summary>
                        <div className="more-items">
                          <button className="text-button text-[12px]" type="button" onClick={() => moveTask(task.id, -1)}>提高优先级</button>
                          <button className="text-button text-[12px]" type="button" onClick={() => moveTask(task.id, 1)}>降低优先级</button>
                          <button className="text-button text-[12px]" type="button" onClick={() => { updateTask(task.id, { status: "延期" }); setNotice(`已延期：${task.title}`); }}>延期到明天</button>
                          <button className="text-button text-[12px]" type="button" onClick={() => { updateTask(task.id, { status: "暂停" }); setNotice(`已暂停：${task.title}`); }}>暂停任务</button>
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
        </section>}
        {/* AI 学习助手独立页面 — 仅聊天和快捷操作，不包含任务面板 */}
        {activeView === "agent" && <section className="workflow workspace-pane active" id="ai-assistant">
          <div className="section-heading">
            <div><div className="section-label">AI Workspace</div><h2>AI 学习助手</h2></div>
          </div>
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
          <div className="chat-window">
            {chat.slice(-10).map((message, index) => <div className={`bubble ${message.role}`} key={`${message.text}-${index}`}>{message.text}</div>)}
            <form className="prompt-bar" onSubmit={(event) => { event.preventDefault(); runPrompt(); }}>
              <span>输入</span>
              <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="例如：今天还有两个小时，重新安排计划" />
              <button>发送</button>
            </form>
          </div>
        </section>}
        {activeDialog === "task" && activeTask && <div className="modal-backdrop" role="presentation" onClick={() => setActiveDialog(null)}>
          <section className="modal-panel compact-modal" role="dialog" aria-modal="true" aria-label="记录学习结果" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head"><div><span>今日任务</span><strong>{activeTask.title}</strong></div><button onClick={() => setActiveDialog(null)}>关闭</button></div>
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
                      onChange={(e) => setCompletionModalCustomMinutes(e.target.value)}
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
              <label><span>掌握程度</span><select value={activeTask.mastery} onChange={(event) => updateTask(activeTask.id, { mastery: event.target.value as MasteryText })}>{masteryOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>正确率%</span><input value={activeTask.accuracy} onChange={(event) => updateTask(activeTask.id, { accuracy: event.target.value })} placeholder="可选" /></label>
              <label><span>学习状态</span><select value={activeTask.mood} onChange={(event) => updateTask(activeTask.id, { mood: event.target.value as StudyMood })}>{moodOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="wide-field"><span>困难/错因</span><input value={activeTask.note} onChange={(event) => updateTask(activeTask.id, { note: event.target.value })} placeholder="例如：判断过程类型时容易混淆" /></label>
              <button onClick={() => { completeTask(activeTask.id); setActiveDialog(null); }} type="button">保存并完成</button>
            </div>
          </section>
        </div>}
        <section className={`dashboard workspace-pane ${activeView === "settings" ? "active" : ""}`} id="settings">
          <div className="section-heading">
            <div>
              <div className="section-label">设置</div>
              <h2>考试与科目</h2>
            </div>
            <button className="secondary-button" onClick={() => setActiveDialog("exam")}>编辑考试目标</button>
          </div>

          {/* 第一组：考试与科目 */}
          <div className="settings-group">
            <div className="settings-group-title">考试目标</div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <label className="field"><span className="text-[11px] text-[#71717A] font-semibold">考试名称</span><input name="examName" value={exam.examName} onChange={(event) => setExam({ ...exam, examName: event.target.value })} /></label>
              <label className="field"><span className="text-[11px] text-[#71717A] font-semibold">目标院校</span><input name="school" value={exam.school} onChange={(event) => setExam({ ...exam, school: event.target.value })} /></label>
              <label className="field"><span className="text-[11px] text-[#71717A] font-semibold">目标专业</span><input name="major" value={exam.major} onChange={(event) => setExam({ ...exam, major: event.target.value })} /></label>
              <label className="field"><span className="text-[11px] text-[#71717A] font-semibold">考试日期</span><input name="examDate" type="date" value={exam.examDate} onChange={(event) => setExam({ ...exam, examDate: event.target.value })} /></label>
              <label className="field"><span className="text-[11px] text-[#71717A] font-semibold">总分目标</span><input value={totalTargetScore} readOnly className="bg-gray-100" /></label>
            </div>
          </div>

          {activeDialog === "exam" && <div className="modal-backdrop" role="presentation" onClick={() => setActiveDialog(null)}>
            <section className="modal-panel" role="dialog" aria-modal="true" aria-label="编辑考试目标" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head"><div><span>设置</span><strong>编辑考试目标</strong></div><button onClick={() => setActiveDialog(null)}>关闭</button></div>
            <form className="form-grid settings-form" onSubmit={saveExam}>
              <label className="field"><span>考试名称</span><input name="examName" defaultValue={exam.examName} /></label>
              <label className="field"><span>目标院校</span><input name="school" defaultValue={exam.school} /></label>
              <label className="field"><span>目标专业/科目</span><input name="major" defaultValue={exam.major} /></label>
              <label className="field"><span>考试日期</span><input name="examDate" defaultValue={exam.examDate} type="date" /></label>
              <label className="field"><span>每周学习天数</span><input name="weeklyDays" defaultValue={exam.weeklyDays} /></label>
              <label className="field"><span>工作日小时</span><input name="weekdayHours" defaultValue={exam.weekdayHours} /></label>
              <label className="field"><span>周末小时</span><input name="weekendHours" defaultValue={exam.weekendHours} /></label>
              <label className="field"><span>当前基础情况</span><input name="baseline" defaultValue={exam.baseline} /></label>
              <button>保存考试目标</button>
            </form>
            </section>
          </div>}

          {/* 第二组：AI学习助手（普通用户设置） */}
          <div className="settings-group">
            <div className="settings-group-title">AI学习助手</div>
            <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-[#eaf4f0]">
              <span className="text-sm font-medium text-[#0F766E]">当前状态：{appSettings.aiProvider === "未接入" || appSettings.modelName === "本地规则模拟" ? "模拟模式" : "已连接"}</span>
            </div>
            <p className="text-xs text-[#71717A] mb-4 leading-relaxed">当前版本使用本地规则生成学习建议，后续接入AI模型后可自动升级。</p>
            <div className="grid grid-cols-1 gap-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4" checked={appSettings.aiEnabled ?? true} onChange={(event) => setAppSettings({ ...appSettings, aiEnabled: event.target.checked })} />
                <span className="text-sm text-[#1F2937]">启用AI学习助手</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4" checked={appSettings.aiReadUploads ?? true} onChange={(event) => setAppSettings({ ...appSettings, aiReadUploads: event.target.checked })} />
                <span className="text-sm text-[#1F2937]">允许AI读取已上传资料</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4" checked={appSettings.aiReadStudyRecords ?? true} onChange={(event) => setAppSettings({ ...appSettings, aiReadStudyRecords: event.target.checked })} />
                <span className="text-sm text-[#1F2937]">允许AI参考学习记录</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4" checked={appSettings.aiAdjustPlan ?? true} onChange={(event) => setAppSettings({ ...appSettings, aiAdjustPlan: event.target.checked })} />
                <span className="text-sm text-[#1F2937]">允许AI根据学习情况调整计划</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4" checked={appSettings.aiConfirmBeforeAction ?? true} onChange={(event) => setAppSettings({ ...appSettings, aiConfirmBeforeAction: event.target.checked })} />
                <span className="text-sm text-[#1F2937]">AI执行修改前需要确认</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4" checked={appSettings.aiConfirmAfterRecognition ?? true} onChange={(event) => setAppSettings({ ...appSettings, aiConfirmAfterRecognition: event.target.checked })} />
                <span className="text-sm text-[#1F2937]">AI识别后需要用户确认</span>
              </label>
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#1F2937] whitespace-nowrap">回答详细程度：</span>
                <select
                  className="flex-1 min-h-[36px]"
                  value={appSettings.aiAnswerDetail ?? "标准"}
                >
                  <option>简洁</option>
                  <option>标准</option>
                  <option>详细</option>
                </select>
              </div>
            </div>
          </div>

          {/* 高级设置（折叠） */}
          <div className="settings-group">
            <button
              className="w-full flex items-center justify-between text-left"
              onClick={() => setShowAdvancedSettings((prev) => !prev)}
            >
              <div className="settings-group-title mb-0 border-b-0 pb-0">高级设置</div>
              <span className="text-sm text-[#0F766E] font-medium">{showAdvancedSettings ? "收起" : "展开"}</span>
            </button>
            <p className="text-xs text-[#71717A] mb-3 leading-relaxed">修改这些配置可能影响AI功能，普通用户无需调整。</p>
            {showAdvancedSettings && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-3 pt-3 border-t border-[#E4E4E7]">
                <label className="field"><span className="text-[11px] text-[#71717A] font-semibold">AI提供商</span><select value={appSettings.aiProvider} onChange={(event) => setAppSettings({ ...appSettings, aiProvider: event.target.value })}><option>未接入</option><option>OpenAI</option><option>本地模型</option><option>自定义 API</option></select></label>
                <label className="field"><span className="text-[11px] text-[#71717A] font-semibold">模型ID</span><input value={appSettings.modelName} onChange={(event) => setAppSettings({ ...appSettings, modelName: event.target.value })} /></label>
                <label className="field"><span className="text-[11px] text-[#71717A] font-semibold">资料解析策略</span><select value={appSettings.parseMode} onChange={(event) => setAppSettings({ ...appSettings, parseMode: event.target.value })}><option>AI预识别 + 用户确认</option><option>只记录文件</option><option>强制人工确认</option></select></label>
                <label className="field"><span className="text-[11px] text-[#71717A] font-semibold">检索策略</span><select value={appSettings.retrievalMode} onChange={(event) => setAppSettings({ ...appSettings, retrievalMode: event.target.value })}><option>本机 localStorage</option><option>向量库待接入</option><option>RAG待接入</option></select></label>
              </div>
            )}
          </div>

          {/* 第三组：通知与数据 */}
          <div className="settings-group">
            <div className="settings-group-title">通知与数据</div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <label className="field"><span className="text-[11px] text-[#71717A] font-semibold">提醒时间</span><input value={appSettings.notificationTime} onChange={(event) => setAppSettings({ ...appSettings, notificationTime: event.target.value })} /></label>
              <label className="field"><span className="text-[11px] text-[#71717A] font-semibold">提醒方式</span><select value={appSettings.notificationChannel} onChange={(event) => setAppSettings({ ...appSettings, notificationChannel: event.target.value })}><option>站内提醒</option><option>系统通知待接入</option><option>邮件待接入</option></select></label>
              <label className="field"><span className="text-[11px] text-[#71717A] font-semibold">数据导入</span>
                <div className="flex gap-2">
                  <label className="secondary-link text-sm min-h-[38px] inline-flex items-center px-4 cursor-pointer">选择文件<input type="file" accept="application/json,.json" className="hidden" onChange={(event) => importData(event.target.files?.[0])} /></label>
                </div>
              </label>
              <label className="field">
                <div className="flex gap-2">
                  <button type="button" className="secondary-link text-sm min-h-[38px] inline-flex items-center px-4" onClick={() => {
                    const data = { exam, appSettings, subjects, activeKnowledgeSubject, activeCardSubject, resources, questions, nodes, tasks, pending, notes, cards, annotations, activeResourceId, readerSearch, readerPage, readerZoom, favoritePages, studyDays, agentSteps, logs, chat };
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "nest-exam-workspace-export.json";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}>导出数据</button>
                </div>
              </label>
            </div>
          </div>

          {/* 考试科目 — 仅在 settings 页面显示 */}
          <div className="settings-group">
            <div className="settings-group-title flex items-center justify-between">
              <span>考试科目</span>
              <button className="text-[13px] min-h-[30px] px-3 rounded-[8px] bg-[#18181B] text-white font-bold" onClick={() => setActiveDialog("subject")}>添加科目</button>
            </div>
            {activeDialog === "subject" && <div className="modal-backdrop" role="presentation" onClick={() => setActiveDialog(null)}>
              <section className="modal-panel" role="dialog" aria-modal="true" aria-label="添加科目" onClick={(event) => event.stopPropagation()}>
                <div className="modal-head"><div><span>设置</span><strong>添加科目</strong></div><button onClick={() => setActiveDialog(null)}>关闭</button></div>
              <form className="form-grid" onSubmit={addSubject}>
                <label className="field"><span>科目名称</span><input name="name" placeholder="例如 政治" /></label>
                <label className="field"><span>科目类型</span><select name="type"><option>公共课</option><option>专业课</option><option>自定义</option></select></label>
                <label className="field"><span>目标分数</span><input name="targetScore" /></label>
                <label className="field"><span>当前进度</span><input name="currentProgress" /></label>
                <label className="field"><span>当前掌握程度</span><input name="currentMastery" /></label>
                <label className="field"><span>每周预计小时</span><input name="weeklyHours" /></label>
                <label className="check-pill"><input name="hasPastPapers" type="checkbox" />历年真题</label>
                <label className="check-pill"><input name="hasSolutions" type="checkbox" />真题解析</label>
                <label className="check-pill"><input name="hasReferences" type="checkbox" />参考书</label>
                <button>添加科目</button>
              </form>
              </section>
            </div>}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {subjects.map((subject) => (
                <div key={subject.id} className="border border-[#E4E4E7] rounded-[8px] p-3 bg-white">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <strong className="text-[15px] block">{subject.name}</strong>
                      <span className="text-[12px] text-[#71717A]">目标 {subject.targetScore} · {subject.type}</span>
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded whitespace-nowrap ${subject.risk === "高风险" ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-[#F4F4F5] text-[#71717A]"}`} title={subject.risk === "高风险" ? "近期未复习，错题率高" : subject.risk}>{subject.risk}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#F4F4F5]">{subject.round}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#F4F4F5]">{subject.layer}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#F4F4F5]">{subject.weeklyHours}h/周</span>
                  </div>
                  <p className="text-[12px] text-[#71717A] mb-2">{subject.currentProgress}</p>
                  <div className="flex flex-wrap gap-2">
                    <button className="text-[12px] min-h-[26px] px-2 rounded-[6px] bg-[#F4F4F5] font-bold text-[#18181B]" onClick={() => { setActiveKnowledgeSubject(subject.name); setActiveCardSubject(subject.name); setNotice(`已切换为：${subject.name}`); }}>设为当前</button>
                    <details className="inline-details">
                      <summary className="text-[12px] min-h-[26px] px-2 rounded-[6px] bg-[#F4F4F5] font-bold">编辑</summary>
                      <div className="flex flex-wrap gap-2 mt-2 p-2 rounded bg-[#F4F4F5]">
                        <label className="flex flex-col gap-0.5"><span className="text-[11px] text-[#71717A]">进度</span><input className="min-h-[28px] text-[12px] px-2 rounded border border-[#D4D4D8]" value={subject.currentProgress} onChange={(e) => setSubjects((items) => items.map((item) => item.id === subject.id ? { ...item, currentProgress: e.target.value, focus: e.target.value } : item))} /></label>
                        <label className="flex flex-col gap-0.5"><span className="text-[11px] text-[#71717A]">风险</span><select className="min-h-[28px] text-[12px] px-2 rounded border border-[#D4D4D8]" value={subject.risk} onChange={(e) => setSubjects((items) => items.map((item) => item.id === subject.id ? { ...item, risk: e.target.value as Risk } : item))}><option>正常</option><option>需要关注</option><option>进度落后</option><option>高风险</option></select></label>
                        <button className="text-[12px] min-h-[26px] px-2 rounded-[6px] bg-[#18181B] text-white font-bold" onClick={() => deleteSubject(subject)}>删除</button>
                      </div>
                    </details>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`knowledge workspace-pane ${activeView === "knowledge" ? "active" : ""}`} id="knowledge-center">
          {/* 知识中心首页：科目 Tab + 三个入口 */}
          {activeKnowledgePanel === "landing" && <div>
            <div className="section-heading">
              <div><div className="section-label">Knowledge Center</div><h2>知识中心</h2></div>
            </div>
            {/* 科目 Tab — 紧凑样式，与 review scope tabs 一致 */}
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
          </div>}
          {activeKnowledgePanel !== "landing" && <div>
          <div className="flex items-center gap-3 mb-4">
            <button className="text-[12px] text-[#71717A] hover:text-[#18181B]" onClick={() => setActiveKnowledgePanel("landing")}>← 返回资源总览</button>
            <div className="flex-1" />
          </div>
          {activeKnowledgePanel === "resources" && <div>
          <div className="section-heading compact-heading">
            <div><div className="section-label">AI First</div><h2>学习资源库</h2><p className="section-hint">上传并识别，AI识别结果进入待确认队列。</p></div>
            <button className="secondary-button" onClick={() => setActiveDialog("resource")}>上传资源</button>
          </div>
          {activeDialog === "resource" && <div className="modal-backdrop" role="presentation" onClick={() => setActiveDialog(null)}>
            <section className="modal-panel" role="dialog" aria-modal="true" aria-label="AI识别资料" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head"><div><span>AI First</span><strong>AI识别资料</strong></div><button onClick={() => setActiveDialog(null)}>关闭</button></div>
            {/* Step 1: Upload area */}
            <div>
              <label className="upload-drop" style={{minHeight:'140px', transition:'all 0.3s ease'}}>
                <span style={{fontSize:'18px'}}>📁 拖拽文件到此处</span>
                <span style={{fontSize:'13px',color:'var(--muted)',marginTop:'4px'}}>或点击选择 支持 PDF / Word / 图片</span>
                <input name="file" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  // Auto-trigger AI recognition with filename
                  const rawName = file.name;
                  const inferred = inferResource(rawName, "");
                  // Show file card + start AI recognition animation
                  setFileUploadState({ name: file.name, size: file.size, inferred, step: "uploading" });
                  // Simulate staged AI recognition over 2.5s
                  setTimeout(() => { setFileUploadState((prev) => { if (!prev) return prev; return { ...prev, step: "extracting" }; }); }, 400);
                  setTimeout(() => { setFileUploadState((prev) => { if (!prev) return prev; return { ...prev, step: "identifying" }; }); }, 900);
                  setTimeout(() => { setFileUploadState((prev) => { if (!prev) return prev; return { ...prev, step: "parsing" }; }); }, 1500);
                  setTimeout(() => { setFileUploadState((prev) => { if (!prev) return prev; return { ...prev, step: "mapping" }; }); }, 2100);
                  setTimeout(() => { setFileUploadState((prev) => { if (!prev) return prev; return { ...prev, step: "done" }; }); }, 2600);
                }} />
              </label>
            </div>
            {/* AI recognition flow */}
            {fileUploadState && <>
              {/* File info card */}
              <div className="p-3 mt-3 rounded-[8px] border border-[#E4E4E7] bg-white flex items-center gap-3">
                <span style={{fontSize:'22px'}}>📄</span>
                <div className="flex-1 min-w-0">
                  <strong className="text-[14px] block truncate">{fileUploadState.name}</strong>
                  <span className="text-[12px] text-[#71717A]">{(fileUploadState.size / (1024*1024)).toFixed(1)} MB · {fileUploadState.inferred.pages.includes("AI识别") ? "AI识别中" : fileUploadState.inferred.pages}</span>
                </div>
                <button className="text-[12px] px-2 py-1 rounded bg-[#F4F4F5] text-[#71717A]" onClick={() => {
                  setFileUploadState(null);
                  setActiveDialog("resource"); // keep modal open to re-upload
                }}>替换文件</button>
              </div>
              {/* AI progress steps */}
              {fileUploadState.step !== "done" && (
                <div className="mt-3 p-3 rounded-[8px] bg-[#F4F4F5]">
                  <div className="text-[12px] font-bold text-[#52525B] mb-2">AI 正在分析</div>
                  <div className="grid gap-1.5">
                    {[
                      { key: "uploading", label: "正在读取文件…" },
                      { key: "extracting", label: "正在提取文本…" },
                      { key: "identifying", label: "正在识别教材类型…" },
                      { key: "parsing", label: "正在解析目录…" },
                      { key: "mapping", label: "正在建立知识映射…" },
                    ].map((s) => {
                      const stages = ["uploading","extracting","identifying","parsing","mapping"];
                      const idx = stages.indexOf(s.key);
                      const curIdx = stages.indexOf(fileUploadState.step);
                      const done = idx < curIdx;
                      const active = idx === curIdx;
                      return (
                        <div key={s.key} className="flex items-center gap-2 text-[12px]" style={{color: done ? '#16A34A' : active ? '#18181B' : '#A1A1AA'}}>
                          <span>{done ? '✓' : active ? '○' : '○'}</span>
                          <span>{s.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* AI recognition result card */}
              {fileUploadState.step === "done" && (
                <div className="mt-3 p-3 rounded-[8px] border border-[#E4E4E7] bg-white">
                  <div className="text-[12px] font-bold text-[#52525B] mb-2">AI 识别结果</div>
                  <div className="grid gap-2">
                    {[
                      { icon: '📘', label: '类型', value: fileUploadState.inferred.type, key: 'type' },
                      { icon: '📖', label: '书名', value: fileUploadState.inferred.name, key: 'name' },
                      { icon: '📚', label: '所属科目', value: fileUploadState.inferred.subject, key: 'subject' },
                      { icon: '🧠', label: '知识体系', value: fileUploadState.inferred.linkedNode, key: 'linkedNode' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center gap-2 text-[13px]">
                        <span>{item.icon}</span>
                        <span className="text-[#71717A] min-w-[60px]">{item.label}</span>
                        <span className="font-medium">{item.value}</span>
                        <button className="ml-auto text-[11px] px-1.5 py-0.5 rounded bg-[#F4F4F5] text-[#71717A] hover:text-[#18181B]"
                          onClick={() => {
                            const newVal = prompt('修改' + item.label, item.value);
                            if (newVal && fileUploadState) {
                              setFileUploadState({
                                ...fileUploadState,
                                inferred: { ...fileUploadState.inferred, [item.key === 'type' ? 'type' : item.key === 'name' ? 'name' : item.key === 'subject' ? 'subject' : 'linkedNode']: newVal }
                              });
                            }
                          }}
                        >修改</button>
                      </div>
                    ))}
                    {fileUploadState.inferred.duplicate && (
                      <div className="flex items-center gap-2 text-[12px] text-[#F59E0B]">
                        <span>⚠️</span><span>疑似重复上传，请确认</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* AI Summary */}
              {fileUploadState.step === "done" && (
                <div className="mt-2 p-3 rounded-[8px] bg-[#18181B] text-white">
                  <div className="text-[11px] font-bold text-[rgba(255,255,255,0.72)] mb-1">AI 摘要</div>
                  <p className="text-[13px] leading-relaxed text-[rgba(255,255,255,0.9)]">
                    这是一部{fileUploadState.inferred.type}：《{fileUploadState.inferred.name}》。包含 {coreNames.join('、')} 等七核知识体系。预计可生成约 {Math.floor(Math.random() * 500 + 500)} 个知识点。
                  </p>
                </div>
              )}
              {/* Import button */}
              {fileUploadState.step === "done" && (
                <button
                  className="w-full mt-3 min-h-[42px] rounded-[8px] bg-[#18181B] text-white font-bold text-[14px]"
                  onClick={() => {
                    // Use the inferred data to add resource
                    const form = new FormData();
                    // Reuse addResource logic by constructing from inferred
                    const resource: Resource = {
                      id: makeId("r"),
                      name: fileUploadState.inferred.name,
                      subject: fileUploadState.inferred.subject,
                      type: fileUploadState.inferred.type,
                      author: fileUploadState.inferred.name.includes("傅献彩") ? "傅献彩" : "AI待确认",
                      version: fileUploadState.inferred.name.includes("傅献彩") ? "AI识别：第六版" : "AI待确认",
                      pages: fileUploadState.inferred.pages,
                      status: "AI待确认",
                      fileName: fileUploadState.name,
                      recommendedRound: "第一轮",
                      recommendedLayer: fileUploadState.inferred.recommendedLayer,
                      currentPage: "",
                      lastRead: "",
                      readingMinutes: "",
                      linkedNode: fileUploadState.inferred.linkedNode,
                    };
                    setResources((items) => [resource, ...items]);
                    setPending((items) => [
                      { id: makeId("p"), kind: fileUploadState.inferred.type.includes("真题") ? "真题识别" : "资料切分", title: resource.name, subject: fileUploadState.inferred.subject, detail: `AI识别结果：科目 ${fileUploadState.inferred.subject}；类型 ${fileUploadState.inferred.type}`, status: "待确认", targetId: resource.id },
                      ...items,
                    ]);
                    setActiveKnowledgeSubject(fileUploadState.inferred.subject);
                    pushAssistant(`AI已识别资料：${resource.name}。请确认后写入知识中心。`);
                    setFileUploadState(null);
                    setActiveDialog(null);
                  }}
                >导入资料</button>
              )}
            </>}
            </section>
          </div>}
          {/* View toggle */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] text-[#71717A]">{subjectResources.length} 个资料</span>
            <div className="view-toggle">
              <button className={resourceView === "grid" ? "active" : ""} onClick={() => setResourceView("grid")}>▦ 网格</button>
              <button className={resourceView === "list" ? "active" : ""} onClick={() => setResourceView("list")}>☰ 列表</button>
            </div>
          </div>
          {/* Bookshelf grid */}
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
                        <details className="more-menu" style={{position:'relative',margin:0}} onClick={(e) => e.stopPropagation()}>
                          <summary className="manage-btn" style={{minHeight:'28px',padding:'0 10px',borderRadius:'6px',fontSize:'12px',fontWeight:700,background:'var(--hover)',color:'var(--ink)',display:'inline-flex',alignItems:'center'}}>⋯ 管理</summary>
                          <div className="more-items" style={{position:'absolute',right:0,top:'100%',zIndex:10,minWidth:'140px'}}>
                            <label className="text-[12px] flex flex-col gap-0.5 p-1"><span className="text-[11px] text-[#71717A]">页码</span><input className="min-h-[26px] text-[12px] px-2 rounded border border-[#D4D4D8]" value={resource.currentPage} onChange={(event) => setResources((items) => items.map((item) => item.id === resource.id ? { ...item, currentPage: event.target.value, lastRead: "刚刚" } : item))} /></label>
                            <label className="text-[12px] flex flex-col gap-0.5 p-1"><span className="text-[11px] text-[#71717A]">关联</span><input className="min-h-[26px] text-[12px] px-2 rounded border border-[#D4D4D8]" value={resource.linkedNode} onChange={(event) => setResources((items) => items.map((item) => item.id === resource.id ? { ...item, linkedNode: event.target.value } : item))} /></label>
                            <button className="text-button text-[12px]" onClick={() => deleteResource(resource)}>删除</button>
                          </div>
                        </details>
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
            )}) : <p className="empty-state">暂无资料，点击「上传资源」导入教材或真题。</p>}
          </div>

          <div className="reader-grid reader-grid-cols">
            {/* 左：阅读器 70% */}
            <div className="reader-panel overflow-hidden">
              <div className="section-label">电子资料阅读器</div>
              <h3>{activeResource?.name ?? "未选择资料"}</h3>
              {/* 工具栏：搜索 / 页码 / 进度 / 缩放 — 全部带标签 */}
              <div className="reader-toolbar xl:grid-cols-[minmax(180px,1fr)_140px_140px_90px_auto]">
                <label className="flex items-center gap-1 text-[12px] text-[#71717A]"><span>搜索</span><input className="flex-1 min-h-[32px] text-[13px]" value={readerSearch} onChange={(event) => setReaderSearch(event.target.value)} placeholder="搜索关键词" /></label>
                <label className="flex items-center gap-1 text-[12px] text-[#71717A]"><span>当前页</span><input className="w-[60px] min-h-[32px] text-[13px] text-center" value={readerPage} onChange={(event) => setReaderPage(event.target.value)} placeholder="1" /><span className="text-[#A1A1AA]">/ 456</span></label>
                <label className="flex items-center gap-1 text-[12px] text-[#71717A]"><span>进度</span><input className="w-[50px] min-h-[32px] text-[13px] text-center" value={activeResource?.readingMinutes ?? ""} onChange={(event) => activeResource && setResources((items) => items.map((item) => item.id === activeResource.id ? { ...item, readingMinutes: event.target.value } : item))} /><span className="text-[#A1A1AA]">分钟</span></label>
                <select className="min-h-[32px] text-[13px]" value={readerZoom} onChange={(event) => setReaderZoom(event.target.value)}><option>80%</option><option>100%</option><option>125%</option></select>
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <button onClick={saveReadingProgress} className="min-h-[30px] px-3 rounded-[6px] bg-[#18181B] text-white font-bold text-[12px] whitespace-nowrap">保存进度</button>
                  <button onClick={markResourceRead} className="min-h-[30px] px-2 rounded-[6px] bg-[#F4F4F5] text-[#71717A] text-[12px] whitespace-nowrap">已读</button>
                  <button onClick={toggleFavoritePage} className="min-h-[30px] px-2 rounded-[6px] bg-[#F4F4F5] text-[#71717A] text-[12px] whitespace-nowrap">{favoritePages.includes(activePageKey) ? "★" : "☆"}</button>
                  <button onClick={() => pushAssistant(`已向 AI 提问当前资料：${activeResource?.name ?? ""} P${readerPage || activeResource?.currentPage || "1"}`)} className="min-h-[30px] px-2 rounded-[6px] bg-[#F4F4F5] text-[#71717A] text-[12px] whitespace-nowrap">AI</button>
                </div>
              </div>
              {/* 章节信息卡片（与正文分离） */}
              <div className="p-3 mb-3 rounded-[8px] bg-[#F4F4F5]">
                <div className="text-[11px] font-bold text-[#52525B] mb-1">章节信息</div>
                <div className="flex flex-wrap gap-2 text-[12px] text-[#71717A]">
                  <span>所属教材：{activeResource?.name ?? "-"}</span>
                  <span>关联知识点：{activeResource?.linkedNode ?? "待关联"}</span>
                  {relatedQuestions.length > 0 && <span>关联真题：{relatedQuestions.length} 道</span>}
                </div>
              </div>
              {/* 正文 */}
              <div className="reader-page" style={{ fontSize: readerZoom === "80%" ? 14 : readerZoom === "125%" ? 20 : 16 }}>
                <p>{readerSearch ? readerText.replace(readerSearch, `【${readerSearch}】`) : readerText}</p>
              </div>
              {/* 关联真题（增强展示） */}
              {relatedQuestions.length > 0 && <div className="mt-3">
                <div className="text-[12px] font-bold text-[#52525B] mb-2">关联真题（{relatedQuestions.length}）</div>
                <div className="flex flex-wrap gap-2">
                  {relatedQuestions.slice(0, 5).map((question) => (
                    <button key={question.id} className="text-[12px] px-2 py-1 rounded-[6px] bg-[#F4F4F5] text-[#71717A] hover:text-[#18181B] whitespace-nowrap" onClick={() => showRelatedQuestions(question.core, question.knowledge)}>
                      {question.year} 第{question.number}题 · {question.knowledge}
                    </button>
                  ))}
                </div>
              </div>}
            </div>

            {/* 右：阅读批注面板 30% — Margin Notes 风格 */}
            <div className="reader-panel annotation-panel">
              <div className="section-heading compact-heading">
                <div><div className="section-label">Annotations</div><h3>阅读批注</h3></div>
                {subjectAnnotations.filter((item) => !activeResource || item.resourceId === activeResource.id).length > 0 ? (
                  <details className="more-menu" style={{position:'relative'}}>
                    <summary className="text-[12px] min-h-[30px] px-3 rounded-[8px] bg-[#F4F4F5] font-bold">管理</summary>
                    <div className="more-items" style={{position:'absolute',right:0,top:'100%',zIndex:10,minWidth:'140px'}}>
                      <button className="text-button text-[12px]" onClick={() => setNotice('编辑批注：点击批注旁的✏即可')}>编辑批注</button>
                      <button className="text-button text-[12px]" onClick={() => setNotice('删除批注：点击批注旁的🗑即可')}>删除批注</button>
                      <button className="text-button text-[12px]" onClick={() => {
                        const data = JSON.stringify(subjectAnnotations.filter((item) => !activeResource || item.resourceId === activeResource.id), null, 2);
                        const blob = new Blob([data], {type:'application/json'});
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = activeResource?.name?.replace(/\s/g,'_') + '-annotations.json'; a.click();
                        URL.revokeObjectURL(url);
                      }}>导出批注</button>
                    </div>
                  </details>
                ) : (
                  <button className="text-[12px] min-h-[30px] px-3 rounded-[8px] bg-[#F4F4F5] font-bold text-[#A1A1AA] cursor-default" disabled>管理</button>
                )}
              </div>
              <div className="annotation-list space-y-2">
                {subjectAnnotations.filter((item) => !activeResource || item.resourceId === activeResource.id).length > 0 ? (
                  [...subjectAnnotations]
                    .filter((item) => !activeResource || item.resourceId === activeResource.id)
                    .sort((a, b) => {
                      const pa = parseInt(a.page) || 0;
                      const pb = parseInt(b.page) || 0;
                      return pa - pb || a.createdAt.localeCompare(b.createdAt);
                    })
                    .map((item) => (
                    <article key={item.id} className="p-3 rounded-[8px] bg-white border border-[#E4E4E7] group hover:border-[#A1A1AA] transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          className="text-[11px] font-bold text-[#0F766E] hover:text-[#18181B] shrink-0"
                          onClick={() => { setReaderPage(item.page); setNotice(`已跳转到第 ${item.page} 页`); }}
                        >P{item.page}</button>
                        <span className="text-[11px] text-[#A1A1AA]">·</span>
                        <span className="text-[11px] text-[#71717A]">{item.createdAt}</span>
                        <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded bg-[#F4F4F5] text-[#71717A]">{item.tag}</span>
                      </div>
                      <p className="text-[13px] leading-relaxed text-[#18181B]">{item.selection}</p>
                      {item.note && <p className="text-[12px] text-[#71717A] mt-1 leading-relaxed">🖍 {item.note}</p>}
                      <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="text-[11px] px-2 py-0.5 rounded bg-[#F4F4F5] text-[#71717A] hover:text-[#18181B]" onClick={() => {
                          const newNote = prompt('编辑批注', item.note);
                          if (newNote !== null) setAnnotations((items) => items.map((a) => a.id === item.id ? { ...a, note: newNote } : a));
                        }}>✏ 编辑</button>
                        <button className="text-[11px] px-2 py-0.5 rounded bg-[#F4F4F5] text-[#EF4444] hover:bg-[#FEE2E2]" onClick={() => {
                          if (confirm('确认删除这条批注？')) { deleteCard({ id: item.id } as any); setAnnotations((items) => items.filter((a) => a.id !== item.id)); setNotice('已删除批注'); }
                        }}>🗑 删除</button>
                        <button className="text-[11px] px-2 py-0.5 rounded bg-[#F4F4F5] text-[#71717A] hover:text-[#18181B]" onClick={() => createCardFromText("资料批注", "生成公式卡", item)} disabled={item.handled}>
                          {item.handled ? "✓ 已生成" : "+ 成长卡"}
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="p-6 rounded-[8px] bg-[#F4F4F5] text-center">
                    <div className="text-[32px] mb-2">🖍</div>
                    <p className="text-[13px] text-[#71717A]">暂无批注</p>
                    <p className="text-[12px] text-[#A1A1AA] mt-1">阅读资料时，<br/>选中文字即可添加高亮或批注。</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>}
          </div>}
        </section>

        <section className={`knowledge workspace-pane ${activeView === "knowledge" && activeKnowledgePanel === "questions" ? "active" : ""}`} id="questions">
          <div className="section-heading">
            <div><div className="section-label">真题数据库</div><h2>{activeKnowledgeSubject} 真题录入、筛选、确认</h2></div>
            <button className="secondary-button" onClick={() => setActiveDialog("question")}>录入题目</button>
          </div>
          {activeDialog === "question" && <div className="modal-backdrop" role="presentation" onClick={() => setActiveDialog(null)}>
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
            <label className="field"><span>学习层级</span><select name="layer"><option>Layer 1</option><option>Layer 2</option><option>Layer 3</option><option>Layer 4</option></select></label>
            <label className="field wide-field"><span>题干</span><input name="stem" /></label>
            <label className="field wide-field"><span>标准答案</span><input name="answer" /></label>
            <label className="field wide-field"><span>原始解析</span><input name="originalAnalysis" /></label>
            <button>手动录入题目</button>
          </form>
            </section>
          </div>}
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
                    <label><span>做题结果</span><select value={question.result} onChange={(event) => setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, result: event.target.value as Question["result"], done: event.target.value !== "未做" } : item))}><option>未做</option><option>正确</option><option>错误</option></select></label>
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
        </section>

        <section className={`knowledge workspace-pane ${activeView === "knowledge" && activeKnowledgePanel === "graph" ? "active" : ""}`} id="graph">
          <div className="section-heading">
            <div><div className="section-label">知识图谱</div><h2>{activeKnowledgeSubject} 七核、分支、知识点编辑</h2></div>
            <button className="secondary-button" onClick={() => setActiveDialog("node")}>添加知识点</button>
          </div>
          {activeDialog === "node" && <div className="modal-backdrop" role="presentation" onClick={() => setActiveDialog(null)}>
            <section className="modal-panel" role="dialog" aria-modal="true" aria-label="添加知识点" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head"><div><span>知识图谱</span><strong>添加知识点</strong></div><button onClick={() => setActiveDialog(null)}>关闭</button></div>
          <form className="form-grid" onSubmit={addNode}>
            <label className="field"><span>所属科目</span><select name="subject">{subjects.map((subject) => <option key={subject.id}>{subject.name}</option>)}</select></label>
            <label className="field"><span>七核</span><select name="core">{coreNames.map((core) => <option key={core}>{core}</option>)}</select></label>
            <label className="field"><span>分支</span><input name="branch" /></label>
            <label className="field"><span>知识点</span><input name="knowledge" /></label>
            <label className="field wide-field"><span>简要解释</span><input name="explanation" /></label>
            <label className="field"><span>前置知识</span><input name="prerequisite" /></label>
            <label className="field"><span>相关知识</span><input name="related" /></label>
            <label className="field"><span>掌握等级 0-5</span><input name="masteryLevel" /></label>
            <label className="field"><span>掌握分数</span><input name="masteryScore" /></label>
            <button>添加知识点</button>
          </form>
            </section>
          </div>}
          <div className="core-grid">
            {subjectNodes.map((node) => (
              <article className="core-card" key={node.id}>
                <div><strong>{node.core}</strong><span>{node.reviewRisk}</span></div>
                <p>{node.branch} / {node.knowledge}</p>
                <p>{node.explanation}</p>
                <div className="core-meter"><span style={{ width: `${node.masteryScore}%` }} /></div>
                <b>{node.masteryLevel} 级 / {node.masteryScore} 分 / 可信度 {node.confidence}</b>
                <details className="inline-details">
                  <summary>编辑节点</summary>
                  <div className="mini-form">
                    <label><span>知识点</span><input value={node.knowledge} onChange={(event) => setNodes((items) => items.map((item) => item.id === node.id ? { ...item, knowledge: event.target.value } : item))} /></label>
                    <label><span>掌握分数</span><input value={node.masteryScore} onChange={(event) => setNodes((items) => items.map((item) => item.id === node.id ? { ...item, masteryScore: Number(event.target.value || 0) } : item))} /></label>
                    <label><span>复习风险</span><select value={node.reviewRisk} onChange={(event) => setNodes((items) => items.map((item) => item.id === node.id ? { ...item, reviewRisk: event.target.value as Risk } : item))}><option>正常</option><option>需要关注</option><option>进度落后</option><option>高风险</option></select></label>
                    <button type="button" onClick={() => deleteNode(node)}>删除节点</button>
                  </div>
                </details>
              </article>
            ))}
            {subjectNodes.length === 0 && <p className="empty-state">这个科目还没有知识点。</p>}
          </div>
          <div className="confirm-table">
            {pending.map((item) => (
              <div className="confirm-row" key={item.id}>
                <strong>{item.kind}：{item.title}</strong>
                <span>{item.subject} / {item.detail}</span>
                <b>{item.status}</b>
                <button onClick={() => confirmPending(item.id)}>确认写入</button>
              </div>
            ))}
          </div>
        </section>

        <section className={`knowledge workspace-pane ${activeView === "cards" ? "active" : ""}`} id="cards">
          <div className="section-heading">
            <div><div className="section-label">Growth Cards</div><h2>成长卡片</h2></div>
            <div className="flex items-center gap-2 flex-wrap">
              <button className={`min-h-[32px] px-3 rounded-[8px] font-bold text-[13px] ${cardView === "复习" ? "bg-[#18181B] text-white" : "bg-[#F4F4F5] text-[#18181B]"}`} onClick={() => setCardView("复习")}>复习</button>
              <button className={`min-h-[32px] px-3 rounded-[8px] font-bold text-[13px] ${cardView === "管理" ? "bg-[#18181B] text-white" : "bg-[#F4F4F5] text-[#18181B]"}`} onClick={() => setCardView("管理")}>管理</button>
              <button className="min-h-[32px] px-3 rounded-[8px] bg-[#F4F4F5] text-[#18181B] font-bold text-[13px]" onClick={() => setActiveDialog("card")}>新建卡片</button>
            </div>
          </div>
          {/* 快捷创建卡片（空白/AI识别） */}
          <div className="quick-card-form mb-4">
            <div className="row">
              <span className="text-[12px] font-bold text-[#71717A]">快速创建卡片</span>
              <span className="text-[11px] text-[#A1A1AA]">自动关联当前科目和知识点</span>
            </div>
            <div className="row">
              <input
                placeholder="正面内容（公式、概念、问题）"
                value={quickCardFront}
                onChange={(e) => setQuickCardFront(e.target.value)}
              />
              <input
                placeholder="背面内容（答案、解释）"
                value={quickCardBack}
                onChange={(e) => setQuickCardBack(e.target.value)}
              />
              <select value={quickCardType} onChange={(e) => setQuickCardType(e.target.value as GrowthCard["type"])}>
                <option>公式卡</option><option>概念卡</option><option>填空卡</option><option>推导卡</option><option>条件辨析卡</option><option>错题卡</option>
              </select>
              <button
                className="min-h-[38px] px-4 rounded-[8px] bg-[#18181B] text-white font-bold text-[13px] shrink-0"
                onClick={() => {
                  if (!quickCardFront.trim()) return;
                  const card: GrowthCard = {
                    id: makeId("c"),
                    title: quickCardFront.slice(0, 40),
                    front: quickCardFront.trim(),
                    back: quickCardBack.trim() || "待补充",
                    type: quickCardType,
                    subject: activeCardSubject || currentSubject?.name || "未分科",
                    core: nodes.filter((n) => n.subject === activeCardSubject)[0]?.core || "待关联",
                    branch: nodes.filter((n) => n.subject === activeCardSubject)[0]?.branch || "",
                    knowledge: nodes.filter((n) => n.subject === activeCardSubject)[0]?.knowledge || "",
                    source: activeResource?.name || "手动创建",
                    page: activeResource?.currentPage || "",
                    modes: ["背诵", quickCardType === "填空卡" ? "填空" : "条件辨析"],
                    createdBy: "手动",
                    createdAt: today(),
                    lastReviewed: "未复习",
                    nextReviewAt: dateOnly(),
                    mastery: "模糊",
                    note: "",
                    favorite: false,
                  };
                  setCards((items) => [card, ...items]);
                  setQuickCardFront("");
                  setQuickCardBack("");
                  pushAssistant(`已创建${quickCardType}：${card.title}`);
                }}
              >创建卡片</button>
            </div>
          </div>
          <div className="subject-tabs">
            {subjects.map((subject) => (
              <button key={subject.id} className={activeCardSubject === subject.name ? "active" : ""} onClick={() => { setActiveCardSubject(subject.name); setCardIndex(0); setCardFlipped(false); }}>
                <strong>{subject.name}</strong>
                <span>{cards.filter((card) => card.subject === subject.name).length} 张卡片</span>
              </button>
            ))}
          </div>
          {cardView === "复习" && activeCard ? (
            <>
            {/* 3D Flip Card */}
            <div ref={cardsRef} className={`flip-container ${cardFlipped ? "flipped" : ""}`} onClick={() => setCardFlipped((v) => !v)} style={{ minHeight: '300px', marginBottom: '16px' }}>
              <div className="flipper">
                <div className="front">
                  <div className="study-card-head mb-2 w-full">
                    <strong className="text-[16px]">{activeCard.title}</strong>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="tag-badge subtle">{activeCard.type}</span>
                      <span className="text-[12px] text-[#71717A]">{cardIndex + 1}/{cardQueue.length}</span>
                    </div>
                  </div>
                  <div className="text-[13px] text-[#71717A] mb-3 w-full text-left">
                    <span className="tag-badge subtle">{activeCard.subject}</span>
                    <span className="tag-badge subtle ml-1">{activeCard.core}</span>
                  </div>
                  <p className="text-[16px] leading-relaxed w-full text-center">{cardMode === "填空" ? activeCard.front.replace(/熵变公式|公式|条件/g, "______") : activeCard.front}</p>
                  <div className="text-[12px] text-[#71717A] mt-4">点击或按 Space 翻面</div>
                </div>
                <div className="back">
                  <div className="study-card-head mb-2 w-full">
                    <strong className="text-[16px]">{activeCard.title}</strong>
                  </div>
                  <p className="text-[16px] leading-relaxed w-full text-center">{activeCard.back}</p>
                  <div className="flex flex-wrap gap-1 mt-4 justify-center">
                    {activeCard.note && <span className="tag-badge amber">{activeCard.note}</span>}
                    <span className="tag-badge subtle">来源：{activeCard.source}</span>
                  </div>
                  <div className="text-[12px] text-[#71717A] mt-3">点击或按 Space 看正面</div>
                </div>
              </div>
            </div>
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[11px] text-[#71717A] font-semibold mr-1">快捷键：</span>
              <span className="kbd-hint">Space</span>
              <span className="text-[11px] text-[#71717A]">翻面</span>
              <span className="kbd-hint ml-1">←</span>
              <span className="text-[11px] text-[#71717A]">上一张</span>
              <span className="kbd-hint ml-1">→</span>
              <span className="text-[11px] text-[#71717A]">下一张</span>
              <span className="kbd-hint ml-1">1</span>
              <span className="text-[11px] text-[#71717A]">认识</span>
              <span className="kbd-hint ml-1">2</span>
              <span className="text-[11px] text-[#71717A]">模糊</span>
              <span className="kbd-hint ml-1">3</span>
              <span className="text-[11px] text-[#71717A]">不会</span>
            </div>
            <div className="text-[12px] text-[#71717A] mb-3">下次复习：{activeCard.nextReviewAt} · 当前掌握：{activeCard.mastery}</div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="min-h-[32px] px-3 rounded-[8px] bg-[#F4F4F5] text-[#18181B] font-bold text-[13px]" onClick={() => moveCard(-1)} disabled={cardIndex === 0}>上一张</button>
              <button className="min-h-[32px] px-3 rounded-[8px] bg-[#F4F4F5] text-[#18181B] font-bold text-[13px]" onClick={() => setCardFlipped((v) => !v)}>{cardFlipped ? "看正面" : "翻面"}</button>
              <button className="min-h-[32px] px-3 rounded-[8px] bg-[#F4F4F5] text-[#18181B] font-bold text-[13px]" onClick={() => moveCard(1)} disabled={cardIndex >= cardQueue.length - 1}>下一张</button>
              <button className="min-h-[32px] px-3 rounded-[8px] bg-[#16A34A] text-white font-bold text-[13px]" onClick={() => reviewCard(activeCard.id, "认识")}>认识 [1]</button>
              <button className="min-h-[32px] px-3 rounded-[8px] bg-[#F59E0B] text-white font-bold text-[13px]" onClick={() => reviewCard(activeCard.id, "模糊")}>模糊 [2]</button>
              <button className="min-h-[32px] px-3 rounded-[8px] bg-[#EF4444] text-white font-bold text-[13px]" onClick={() => reviewCard(activeCard.id, "不会")}>不会 [3]</button>
              <button className="min-h-[32px] px-3 rounded-[8px] bg-[#18181B] text-white font-bold text-[13px]" onClick={() => setFocusMode(true)}>专注学习</button>
              <details className="more-menu">
                <summary className="text-[12px]">更多</summary>
                <div className="more-items">
                  <button className="text-button text-[12px]" onClick={() => openCardSource(activeCard)}>查看来源</button>
                  <button className="text-button text-[12px]" onClick={() => showRelatedQuestions(activeCard.core, activeCard.knowledge, activeCard.subject)}>相关真题</button>
                </div>
              </details>
            </div>
            </>
          ) : cardView === "复习" && !activeCard ? <p className="empty-state">暂无成长卡片</p> : null}
          {/* Focus Mode Overlay */}
          {focusMode && activeCard && (
            <div className="focus-overlay" onClick={() => setFocusMode(false)}>
              <div className="focus-card" onClick={(e) => e.stopPropagation()}>
                <div className={`flip-container ${cardFlipped ? "flipped" : ""}`} onClick={() => setCardFlipped((v) => !v)} style={{ minHeight: '340px' }}>
                  <div className="flipper">
                    <div className="front">
                      <div className="text-[14px] font-bold text-[#52525B] mb-3">{activeCard.subject} / {activeCard.core}</div>
                      <p className="text-[20px] leading-relaxed">{activeCard.front}</p>
                    </div>
                    <div className="back">
                      <div className="text-[14px] font-bold text-[#52525B] mb-3">答案</div>
                      <p className="text-[18px] leading-relaxed">{activeCard.back}</p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center gap-3 mt-4">
                  <button className="min-h-[36px] px-4 rounded-[8px] bg-[#16A34A] text-white font-bold text-[13px]" onClick={() => { reviewCard(activeCard.id, "认识"); setFocusMode(false); }}>认识 [1]</button>
                  <button className="min-h-[36px] px-4 rounded-[8px] bg-[#F59E0B] text-white font-bold text-[13px]" onClick={() => { reviewCard(activeCard.id, "模糊"); setFocusMode(false); }}>模糊 [2]</button>
                  <button className="min-h-[36px] px-4 rounded-[8px] bg-[#EF4444] text-white font-bold text-[13px]" onClick={() => { reviewCard(activeCard.id, "不会"); setFocusMode(false); }}>不会 [3]</button>
                  <button className="min-h-[36px] px-4 rounded-[8px] bg-[#F4F4F5] text-[#18181B] font-bold text-[13px]" onClick={() => setFocusMode(false)}>退出</button>
                </div>
              </div>
            </div>
          )}
          {(cardView === "管理" || (cardView === "复习" && !subjectCards.length)) && <>
            <div className="metric-grid">
              <div><span>当前科目</span><strong>{activeCardSubject || "未选择"}</strong></div>
              <div><span>全部卡片</span><strong>{subjectCards.length}</strong></div>
              <div><span>今日复习</span><strong>{dueCards.length}</strong></div>
              <div><span>收藏卡片</span><strong>{subjectCards.filter((card) => card.favorite).length}</strong></div>
            </div>
            <div className="card-grid">
              {subjectCards.map((card) => (
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
                  <small className="block text-[12px] text-[#71717A] mt-2">来源：{card.source} {card.page} / {card.lastReviewed} / {card.nextReviewAt}</small>
                  <div className="card-actions">
                    <button className="text-button text-[12px]" onClick={() => reviewCard(card.id, "认识")}>认识</button>
                    <button className="text-button text-[12px]" onClick={() => reviewCard(card.id, "模糊")}>模糊</button>
                    <button className="text-button text-[12px]" onClick={() => reviewCard(card.id, "不会")}>不会</button>
                    <button className="text-button text-[12px]" onClick={() => setCards((items) => items.map((item) => item.id === card.id ? { ...item, favorite: !item.favorite } : item))}>{card.favorite ? "★收藏" : "收藏"}</button>
                    <button className="text-button text-[12px]" onClick={() => openCardSource(card)}>来源</button>
                    <button className="text-button text-[12px]" onClick={() => showRelatedQuestions(card.core, card.knowledge, card.subject)}>真题</button>
                    <button className="text-button text-[12px]" onClick={() => deleteCard(card)}>删除</button>
                  </div>
                </article>
              ))}
              {subjectCards.length === 0 && <p className="empty-state">这个科目还没有成长卡片。</p>}
            </div>
          </>}
          {activeDialog === "card" && <div className="modal-backdrop" role="presentation" onClick={() => setActiveDialog(null)}>
            <section className="modal-panel" role="dialog" aria-modal="true" aria-label="手动创建成长卡片" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head"><div><span>成长卡片</span><strong>手动创建成长卡片</strong></div><button onClick={() => setActiveDialog(null)}>关闭</button></div>
            <form className="form-grid" onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const title = String(form.get("title") ?? "").trim();
              if (!title) return;
              setCards((items) => [{
                id: makeId("c"),
                title,
                front: String(form.get("front") ?? ""),
                back: String(form.get("back") ?? ""),
                type: String(form.get("type") ?? "概念卡") as GrowthCard["type"],
                subject: String(form.get("subject") ?? currentSubject?.name ?? ""),
                core: String(form.get("core") ?? "待关联"),
                branch: String(form.get("branch") ?? ""),
                knowledge: String(form.get("knowledge") ?? ""),
                source: String(form.get("source") ?? ""),
                page: String(form.get("page") ?? ""),
                modes: [cardMode],
                createdBy: "手动",
                createdAt: today(),
                lastReviewed: "未复习",
                nextReviewAt: dateOnly(),
                mastery: "模糊",
                note: "",
                favorite: false,
              }, ...items]);
              pushAssistant(`已创建成长卡片：${title}`);
              setActiveDialog(null);
              event.currentTarget.reset();
            }}>
              <label className="field"><span>卡片标题</span><input name="title" /></label>
              <label className="field wide-field"><span>正面内容</span><input name="front" /></label>
              <label className="field wide-field"><span>背面内容/答案</span><input name="back" /></label>
              <label className="field"><span>卡片类型</span><select name="type"><option>公式卡</option><option>概念卡</option><option>填空卡</option><option>推导卡</option><option>条件辨析卡</option><option>错题卡</option></select></label>
              <label className="field"><span>所属科目</span><select name="subject" defaultValue={activeCardSubject}>{subjects.map((subject) => <option key={subject.id}>{subject.name}</option>)}</select></label>
              <label className="field"><span>七核</span><input name="core" /></label>
              <label className="field"><span>分支</span><input name="branch" /></label>
              <label className="field"><span>知识点</span><input name="knowledge" /></label>
              <label className="field"><span>来源资料</span><input name="source" /></label>
              <label className="field"><span>页码</span><input name="page" /></label>
              <button>创建卡片</button>
            </form>
            </section>
          </div>}
        </section>

        {activeView === "dashboard" && activeDashboardPanel === "review" && <section className="workflow workspace-pane active" id="review">
          {/* 标题栏：学习复盘 + 填写复盘按钮 */}
          <div className="section-heading">
            <div><div className="section-label">Review</div><h2>学习复盘</h2></div>
            <button className="secondary-button" onClick={() => setActiveDialog("review")}>填写复盘</button>
          </div>
          {/* 第一层导航：日/周/月 */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(["日复盘", "周复盘", "月复盘"] as ReviewScope[]).map((scope) => (
              <button key={scope} className={`min-h-[32px] px-3 rounded-[8px] font-bold text-[13px] ${reviewScope === scope ? "bg-[#18181B] text-white" : "bg-[#F4F4F5] text-[#18181B]"}`} onClick={() => setReviewScope(scope)}>{scope}</button>
            ))}
          </div>
          {/* 第二层：科目筛选（紧凑下拉） */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[12px] text-[#71717A] font-semibold shrink-0">科目：</span>
            <select
              className="min-h-[32px] text-[13px] px-2 rounded border border-[#D4D4D8] bg-white"
              value={activeReviewSubject}
              onChange={(e) => setActiveReviewSubject(e.target.value)}
            >
              {reviewSubjects.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>
          {/* 概览内容 */}
          <div className="metric-grid review-metrics">
            {reviewScope === "月复盘" ? (
              <>
                <div><span>本月学习时长</span><strong>{reviewMinutes} 分钟</strong></div>
                <div><span>本月完成任务</span><strong>{reviewCompletedTasks}/{reviewTasks.length}</strong></div>
                <div><span>新增重点知识点</span><strong>{reviewNewNodes}</strong></div>
                <div><span>真题完成情况</span><strong>{reviewDoneQuestions}/{reviewQuestions.length}</strong></div>
                <div><span>成长卡片复习</span><strong>{reviewReviewedCards}/{reviewCards.length}</strong></div>
                <div><span>掌握度变化</span><strong>{reviewMasteryDelta}%</strong></div>
              </>
            ) : (
              <>
                <div><span>{reviewScope === "日复盘" ? "今日" : "本周"}学习时长</span><strong>{reviewMinutes} 分钟</strong></div>
                <div><span>完成任务</span><strong>{reviewCompletedTasks}/{reviewTasks.length}</strong></div>
                <div><span>新增/重点知识点</span><strong>{reviewNewNodes}</strong></div>
                <div><span>真题完成情况</span><strong>{reviewDoneQuestions}/{reviewQuestions.length}</strong></div>
                <div><span>成长卡片复习</span><strong>{reviewReviewedCards}/{reviewCards.length}</strong></div>
                <div><span>掌握度变化</span><strong>{reviewMasteryDelta}%</strong></div>
              </>
            )}
          </div>
          <p className="text-[13px] text-[#71717A] leading-relaxed mb-4">{reviewAiSummary}</p>
          {/* AI 总结 — 独立区块 */}
          <div className="p-4 border border-[#E4E4E7] rounded-[8px] bg-white">
            <div className="section-label">AI {reviewScope}总结</div>
            <p className="text-[13px] text-[#71717A] leading-relaxed mt-2">{reviewAiSummary}</p>
            <div className="note-list mt-4">{notes.filter((note) => activeReviewSubject === "全部科目" || note.tags.includes(activeReviewSubject) || note.tags.some((tag) => activeReviewSubject.includes(tag))).map((note) => <article key={note.id} className="p-3 rounded-[8px] bg-[#F4F4F5]"><strong className="block text-[13px]">{note.title}</strong><p className="text-[12px] text-[#71717A] mt-1">{note.body}</p><div className="flex flex-wrap gap-1 mt-2">{note.tags.map((tag) => <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded bg-white">{tag}</span>)}</div></article>)}</div>
          </div>
        </section>}
        {/* 填写复盘弹窗 */}
        {activeDialog === "review" && <div className="modal-backdrop" role="presentation" onClick={() => setActiveDialog(null)}>
          <section className="modal-panel" role="dialog" aria-modal="true" aria-label="填写复盘" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><div><span>Review</span><strong>填写复盘</strong></div><button onClick={() => setActiveDialog(null)}>关闭</button></div>
            <form onSubmit={(e) => { e.preventDefault(); submitReview(e); setActiveDialog(null); }}>
              <div className="grid grid-cols-1 gap-3 p-4">
                {reviewScope === "月复盘" ? (
                  <>
                    <label className="flex flex-col gap-1"><span className="text-[12px] font-bold text-[#71717A]">本月完成了什么？</span><input className="min-h-[38px] px-3 rounded-[8px] border border-[#D4D4D8]" value={review.done} onChange={(e) => setReview({ ...review, done: e.target.value })} /></label>
                    <label className="flex flex-col gap-1"><span className="text-[12px] font-bold text-[#71717A]">哪个部分最困难？</span><input className="min-h-[38px] px-3 rounded-[8px] border border-[#D4D4D8]" value={review.hard} onChange={(e) => setReview({ ...review, hard: e.target.value })} /></label>
                    <label className="flex flex-col gap-1"><span className="text-[12px] font-bold text-[#71717A]">计划是否过多或过少？</span><select className="min-h-[38px] px-3 rounded-[8px] border border-[#D4D4D8]" value={review.load} onChange={(e) => setReview({ ...review, load: e.target.value as Review["load"] })}><option>过少</option><option>刚好</option><option>过多</option></select></label>
                    <label className="flex flex-col gap-1"><span className="text-[12px] font-bold text-[#71717A]">需要优先处理什么？</span><input className="min-h-[38px] px-3 rounded-[8px] border border-[#D4D4D8]" value={review.priority} onChange={(e) => setReview({ ...review, priority: e.target.value })} /></label>
                  </>
                ) : (
                  <>
                    <label className="flex flex-col gap-1"><span className="text-[12px] font-bold text-[#71717A]">{reviewScope === "日复盘" ? "今天" : "本周"}完成了什么？</span><input className="min-h-[38px] px-3 rounded-[8px] border border-[#D4D4D8]" value={review.done} onChange={(e) => setReview({ ...review, done: e.target.value })} /></label>
                    <label className="flex flex-col gap-1"><span className="text-[12px] font-bold text-[#71717A]">哪个部分最困难？</span><input className="min-h-[38px] px-3 rounded-[8px] border border-[#D4D4D8]" value={review.hard} onChange={(e) => setReview({ ...review, hard: e.target.value })} /></label>
                    <label className="flex flex-col gap-1"><span className="text-[12px] font-bold text-[#71717A]">计划是否过多或过少？</span><select className="min-h-[38px] px-3 rounded-[8px] border border-[#D4D4D8]" value={review.load} onChange={(e) => setReview({ ...review, load: e.target.value as Review["load"] })}><option>过少</option><option>刚好</option><option>过多</option></select></label>
                    <label className="flex flex-col gap-1"><span className="text-[12px] font-bold text-[#71717A]">明天可用多少时间？</span><input className="min-h-[38px] px-3 rounded-[8px] border border-[#D4D4D8]" value={review.tomorrow} onChange={(e) => setReview({ ...review, tomorrow: e.target.value })} /></label>
                    <label className="flex flex-col gap-1"><span className="text-[12px] font-bold text-[#71717A]">需要优先处理什么？</span><input className="min-h-[38px] px-3 rounded-[8px] border border-[#D4D4D8]" value={review.priority} onChange={(e) => setReview({ ...review, priority: e.target.value })} /></label>
                  </>
                )}
                <button className="self-start min-h-[36px] px-4 rounded-[8px] bg-[#18181B] text-white font-bold text-[13px]">提交复盘</button>
              </div>
            </form>
          </section>
        </div>}
      </div>
    </main>
  );
}
