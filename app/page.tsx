"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import type {
  Risk, MasteryText, StudyMood, WorkspaceView, KnowledgePanel,
  DashboardPanel, ReviewScope, ActiveDialog, DeletedBackup,
  ExamGoal, Subject, Resource, Question, KnowledgeNode, Task,
  PendingItem, Review, Note, PlanLog, AppSettings, StudyDay,
  GrowthCard, CardDeck, Annotation, AgentStep
} from "./lib/types";
import {
  seedExam, seedSubjects, seedResources, seedQuestions, seedNodes,
  seedTasks, seedNotes, seedCards, seedDecks, seedAnnotations, seedAppSettings,
  seedStudyDays
} from "./lib/default-data";
import { STORAGE, TASK, MASTERY, CARD_REVIEW_INTERVALS, CARD_REVIEW_LABELS, TOAST_DURATION, MAX_STUDY_DAYS, MAX_DATE_RANGE_DAYS, CHAT_KEEP_LAST, HEATMAP_SIZE } from "./lib/rules";
import { loadData, saveData, addStructuredReview, addMemoryItem, getMemoriesByType, createEmptyMemoryData } from "./lib/storage";
import { extractReviewFields, extractMemories, classifyMemory, generateMemoryId, isDuplicateMemory } from "./lib/memory-rules";
import type { StructuredReview, MemoryItem } from "./lib/types";
import { s, drawerShadow } from "./lib/css-utils";
import styles from "../styles/workspace.module.css";
import { Sidebar } from "./components/Sidebar";
import { ReviewPanel } from "./components/ReviewPanel";
import { ReviewDialog } from "./components/ReviewDialog";
import { TaskCard } from "./components/TaskCard";
import { CardViewer } from "./components/CardViewer";
import { ReaderPanel } from "./components/ReaderPanel";
import { SettingsPanel } from "./components/SettingsPanel";

const quickPrompts = ["今天学什么", "找近五年化学势真题", "傅献彩哪里讲这个", "为什么总错这类题", "把今天整理成笔记", "分析最近三套真题，更新图谱并重排计划", "我现在属于第几轮"];
const masteryOptions: MasteryText[] = ["完全不懂", "有些模糊", "基本理解", "能够讲清", "能够迁移"];
const moodOptions: StudyMood[] = ["较差", "一般", "正常", "较好", "很好"];
const coreNames = ["热力学", "相平衡", "化学动力学", "电化学", "统计热力学", "表面与胶体", "实验与综合"];

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
  return date.toISOString().slice(0, 10);
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
  const [resourceView, setResourceView] = useState<"grid" | "list">("grid");
  const [fileUploadState, setFileUploadState] = useState<{
    name: string;
    size: number;
    inferred: ReturnType<typeof inferResource>;
    step: string;
  } | null>(null);
  const [questionFilter, setQuestionFilter] = useState({ subject: "全部", core: "全部", result: "全部", keyword: "" });
  const [readingMode, setReadingMode] = useState(false);
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

  // --- Derived / computed values ---
  const reviewSubjects = ["全部科目", ...subjects.map((s) => s.name)];
  const reviewMinutes = tasks.filter((t) => t.done).reduce((sum, t) => sum + (Number(t.actualMinutes) || 0), 0);
  const reviewCompletedTasks = tasks.filter((t) => t.done).length;
  const reviewNewNodes = nodes.filter((n) => n.isMonthlyFocus).length;
  const reviewDoneQuestions = questions.filter((q) => q.done).length;
  const reviewReviewedCards = cards.filter((c) => c.lastReviewed !== "未复习").length;
  const reviewMasteryDelta = nodes.reduce((sum, n) => sum + n.masteryScore, 0) / Math.max(nodes.length, 1);
  const reviewAiSummary = `今日完成 ${reviewCompletedTasks} 个任务，掌握度变化 ${Math.round(reviewMasteryDelta)}%。`;
  const activeCard = cards[cardIndex] || cards[0];
  const subjectResources = resources.filter((resource) => resource.subject === activeKnowledgeSubject);
  const activeResource = subjectResources.find((resource) => resource.id === activeResourceId) ?? subjectResources[0] ?? resources[0];
  const subjectQuestions = questions.filter((question) => question.subject === activeKnowledgeSubject);
  const subjectNodes = nodes.filter((node) => node.subject === activeKnowledgeSubject);
  const subjectAnnotations = annotations.filter((annotation) => subjectResources.some((resource) => resource.id === annotation.resourceId));
  const relatedQuestions = questions.filter((question) => activeResource && question.subject === activeResource.subject && (activeResource.linkedNode.includes(question.core) || activeResource.linkedNode.includes(question.branch)));
  const filteredQuestions = questions.filter((question) => {
    const bySubject = questionFilter.subject === "全部" || question.subject === questionFilter.subject;
    const byCore = questionFilter.core === "全部" || question.core === questionFilter.core;
    const byResult = questionFilter.result === "全部" || question.result === questionFilter.result;
    const byKeyword = !questionFilter.keyword || `${question.stem}${question.knowledge}${question.year}`.includes(questionFilter.keyword);
    return bySubject && byCore && byResult && byKeyword;
  });
  const activeTask = tasks.find((task) => task.id === activeTaskId);
  const currentSubject = subjects.find((subject) => subject.name === activeKnowledgeSubject) ?? subjects[0];

  // ─── Dashboard: Timer state & refs ───
  const [timerStartTime, setTimerStartTime] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // ─── Dashboard: Completion modal state ───
  const [completionModalAllowEditTime, setCompletionModalAllowEditTime] = useState(false);
  const [completionModalCustomMinutes, setCompletionModalCustomMinutes] = useState("");
  const [completionModalCustomEndTime, setCompletionModalCustomEndTime] = useState("--");

  // ─── Dashboard: Task drawer ───
  const [taskDrawerOpen, setTaskDrawerOpen] = useState<string | null>(null);

  // ─── Dashboard: Hydration-safe date (SSR: fixed; mount: real) ───
  const [hydratedTodayStr, setHydratedTodayStr] = useState("2026-07-30");
  const [hydratedDaysLeft, setHydratedDaysLeft] = useState(143);

  // ─── Dashboard: Hydration effect ───
  useEffect(() => {
    setHydratedTodayStr(dateOnly());
    setHydratedDaysLeft(Math.max(0, Math.ceil((new Date(exam.examDate).getTime() - Date.now()) / 86400000)));
  }, [exam.examDate]);

  // ─── localStorage load (hydrate from saved state) ───
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE.key);
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
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
      if (data.annotations) setAnnotations(data.annotations);
      if (data.activeResourceId) setActiveResourceId(data.activeResourceId);
      if (data.readerSearch) setReaderSearch(data.readerSearch);
      if (data.readerPage) setReaderPage(data.readerPage);
      if (data.readerZoom) setReaderZoom(data.readerZoom);
      if (data.favoritePages) setFavoritePages(data.favoritePages);
      if (data.studyDays) setStudyDays(data.studyDays);
      if (data.agentSteps) setAgentSteps(data.agentSteps);
      if (data.logs) setLogs(data.logs);
      if (data.chat) setChat(data.chat);
    } catch {
      window.localStorage.removeItem(STORAGE.key);
    }
  }, []);

  // ─── localStorage save (persist on all relevant state changes) ───
  useEffect(() => {
    window.localStorage.setItem(STORAGE.key, JSON.stringify({
      exam, appSettings, subjects, activeKnowledgeSubject, activeCardSubject,
      resources, questions, nodes, tasks, pending, notes, cards, annotations,
      activeResourceId, readerSearch, readerPage, readerZoom, favoritePages,
      studyDays, agentSteps, logs, chat,
    }));
  }, [exam, appSettings, subjects, activeKnowledgeSubject, activeCardSubject,
      resources, questions, nodes, tasks, pending, notes, cards, annotations,
      activeResourceId, readerSearch, readerPage, readerZoom, favoritePages,
      studyDays, agentSteps, logs, chat]);

  // ─── Sync active subjects when subjects change ───
  useEffect(() => {
    if (subjects.length && !subjects.some((s) => s.name === activeKnowledgeSubject))
      setActiveKnowledgeSubject(subjects[0].name);
    if (subjects.length && !subjects.some((s) => s.name === activeCardSubject))
      setActiveCardSubject(subjects[0].name);
  }, [subjects, activeKnowledgeSubject, activeCardSubject]);

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
  heatmapGrid.forEach((week, wi) => {
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
  const todayCardsCount = cards.filter((card) => card.createdAt.slice(0, 10) === todayStr).length;
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
    const recommendedLayer = isPastPaper ? "Layer 2-4" : "Layer 1-2";
    return { subject, type, name, pages, linkedNode, recommendedLayer, duplicate: resources.some((resource) => resource.fileName === rawName || resource.name === name) };
  }

  function openResource(resource: Resource) {
    setActiveResourceId(resource.id);
    setActiveKnowledgeSubject(resource.subject);
    setReaderPage(resource.currentPage || "1");
    setActiveKnowledgePanel("resources");
    setActiveView("knowledge");
    setNotice(`已打开资料：${resource.name}`);
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

  function deleteResource(item: Resource) {
    setLastDeleted({ collection: "resources", item, label: item.name });
    setResources((items) => items.filter((resource) => resource.id !== item.id));
    setNotice(`已删除资源：${item.name}`);
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
      layer: "Layer 1",
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

  // ─── Dashboard handlers ───
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
    updateTask(task.id, { status: "学习中", startedAt: startTimeStr });
    stopTimer();
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    setNotice(`开始学习：${task.title}`);
  }

  function handleEndLearning(task: Task) {
    stopTimer();
    const elapsedMin = Math.max(TASK.minElapsedMinutes, Math.round(elapsedSeconds / 60));
    setCompletionModalCustomMinutes(String(elapsedMin));
    setCompletionModalAllowEditTime(false);
    setCompletionModalCustomEndTime(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }));
    setActiveTaskId(task.id);
    setActiveDialog("task");
    setActiveTimerTaskId("");
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
        setReaderPage("132");
        setActiveView("knowledge");
        pushAssistant("傅献彩《物理化学》第六版 P132-140 已关联到 热力学 / 熵与熵变 / 熵变计算。");
      } else {
        pushAssistant("未找到傅献彩相关资源。");
      }
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
    if (text.includes("复习")) {
      pushAssistant("这个请求需要调用成长卡片复习队列，卡片首页将在 Growth Cards 恢复后接通。");
      return;
    }
    if (text.includes("卡片") || text.includes("填空卡") || text.includes("公式卡")) {
      pushAssistant("这个请求需要调用成长卡片系统，卡片首页将在 Growth Cards 恢复后接通。");
      return;
    }
    if (text.includes("第几轮")) {
      pushAssistant(`当前主要科目处于 ${currentSubject?.round ?? "第一轮"}，${currentSubject?.layer ?? "Layer 1"}。`);
      return;
    }
    pushAssistant("已收到。可以继续让我安排任务、检索真题、生成笔记或调整图谱。");
  }

  function pushAssistant(text: string) {
    setChat((items) => [...items, { role: "assistant", text }]);
    setNotice(text);
  }

  function addLog(input: string, output: string, accepted = "自动生成", dataRead = ["考试日期", "科目状态", "学习历史", "高风险节点"]) {
    setLogs((items) => [{ id: makeId("l"), time: today(), input, output, accepted, dataRead, userRevision: "待记录", finalResult: output, rating: "未评价", rework: "0" }, ...items]);
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

  return (
    <main>
      <Sidebar
        daysLeft={daysLeft} exam={exam} totalTargetScore={totalTargetScore} overallProgress={overallProgress}
        heatmapStartFormatted={heatmapStartFormatted} heatmapMonths={heatmapMonths} dayLabels={dayLabels} heatmapGrid={heatmapGrid}
        todayStr={todayStr} examDate={exam.examDate} tooltipData={null} tooltipVisible={false}
        heatmapDays={heatmapDays} cardsByDate={cardsByDate}
        activeView={activeView} setActiveView={setActiveView}
        heatmapRef={useRef<HTMLDivElement | null>(null)}
        onCellMouseEnter={() => {}} onCellMouseLeave={() => {}} onCellClick={() => {}}
        setTooltipVisible={() => {}} setTooltipData={() => {}}
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
              <div className="chat-window">
                {chat.slice(-7).map((message, index) => (
                  <div className={`bubble ${message.role}`} key={`${message.text}-${index}`}>{message.text}</div>
                ))}
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
                                  onClick={() => { updateTask(task.id, { status: "学习中" }); stopTimer(); }}>
                                  继续学习
                                </button>
                                <button className="min-h-[30px] px-3 rounded-[6px] bg-[#18181B] text-white font-bold text-[12px]" type="button"
                                  onClick={() => handleEndLearning(task)}>结束学习</button>
                              </>
                            ) : (
                              <>
                                <button className="min-h-[30px] px-4 rounded-[6px] bg-[#0F766E] text-white font-bold text-[12px]" type="button">⏱ 学习中</button>
                                <button className="min-h-[30px] px-3 rounded-[6px] bg-[#F4F4F5] text-[#18181B] font-bold text-[12px]" type="button"
                                  onClick={() => { stopTimer(); updateTask(task.id, { status: "暂停" }); }}>暂停</button>
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
                              onClick={() => { setActiveTaskId(task.id); setActiveDialog("task"); }}>记录结果</button>
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

        {/* ─── Agent 独立页面 ─── */}
        {activeView === "agent" && (
          <section className="workflow workspace-pane active" id="ai-assistant">
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
                          favoritePages={favoritePages} activePageKey={`${activeResource.id}-${readerPage}`}
                          relatedQuestions={relatedQuestions}
                          subjectAnnotations={subjectAnnotations}
                          subjectNodes={subjectNodes}
                          onSetReaderSearch={setReaderSearch} onSetReaderPage={setReaderPage}
                          onSetReaderZoom={setReaderZoom} onSaveProgress={() => {
                            setResources((items) => items.map((item) => item.id === activeResource.id ? { ...item, readingMinutes: String(Math.max(Number(item.readingMinutes || 0), Math.round(elapsedSeconds / 60))) } : item));
                          }}
                          onMarkRead={() => {}} onToggleFavorite={() => {}}
                          onShowRelated={() => {}} onCreateCard={() => {
                            pushAssistant("这个请求需要调用成长卡片系统，卡片首页将在 Growth Cards 恢复后接通。");
                          }}
                          onDeleteAnnotation={() => {}} onEditAnnotation={() => {}}
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
                      <button className="secondary-button" onClick={() => setActiveDialog("question")}>录入题目</button>
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
                            <label className="field"><span>学习层级</span><select name="layer"><option>Layer 1</option><option>Layer 2</option><option>Layer 3</option><option>Layer 4</option></select></label>
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

        {/* Cards - Card Viewer */}
        {activeView === "cards" && activeCard && (
          <CardViewer
            activeCard={activeCard}
            cardIndex={cardIndex} cardQueue={cards}
            cardFlipped={cardFlipped} cardMode={cardMode}
            onFlip={() => setCardFlipped(!cardFlipped)}
            onMove={(step) => setCardIndex(Math.max(0, Math.min(cards.length - 1, cardIndex + step)))}
            onReview={(id, mastery) => {
              setCards((prev) => prev.map((c) => {
                if (c.id !== id) return c;
                const interval = CARD_REVIEW_INTERVALS[mastery] || 1;
                const nextDate = new Date();
                nextDate.setDate(nextDate.getDate() + interval);
                return { ...c, mastery, lastReviewed: new Date().toISOString(), nextReviewAt: nextDate.toISOString().slice(0, 10) };
              }));
            }}
            onFocusMode={() => setFocusMode(!focusMode)}
            onOpenSource={() => {}}
            onShowRelated={() => {}}
          />
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
          <div className="modal-backdrop" role="presentation" onClick={() => setActiveDialog(null)}>
            <section className="modal-panel compact-modal" role="dialog" aria-modal="true" aria-label="记录学习结果" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head">
                <div><span>今日任务</span><strong>{activeTask.title}</strong></div>
                <button onClick={() => setActiveDialog(null)}>关闭</button>
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
          </div>
        )}

        {/* Review Dialog */}
        {activeDialog === "review" && (
          <ReviewDialog
            review={review} setReview={setReview}
            reviewScope={reviewScope}
            onSubmit={() => setActiveDialog(null)}
            onClose={() => setActiveDialog(null)}
          />
        )}
      </div>
    </main>
  );
}