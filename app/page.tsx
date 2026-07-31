"use client";

import { useState, useRef, type FormEvent } from "react";
import type {
  MasteryText, StudyMood, WorkspaceView, KnowledgePanel,
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
  const activeResource = resources.find((r) => r.id === activeResourceId) || resources[0];

  // Placeholder timers & data for components that need them
  const timerStartTime = "";
  const elapsedSeconds = 0;

  // --- Task Card handlers (wired to state) ---
  const toggleTaskDone = (task: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
  };
  const updateTask = (id: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  return (
    <main>
      <Sidebar
        daysLeft={0} exam={exam} totalTargetScore={0} overallProgress={0}
        heatmapStartFormatted="" heatmapMonths={[]} dayLabels={[]} heatmapGrid={[]}
        todayStr="" examDate="" tooltipData={null} tooltipVisible={false}
        heatmapDays={[]} cardsByDate={{}}
        activeView={activeView} setActiveView={setActiveView}
        heatmapRef={useRef<HTMLDivElement | null>(null)}
        onCellMouseEnter={() => {}} onCellMouseLeave={() => {}} onCellClick={() => {}}
        setTooltipVisible={() => {}} setTooltipData={() => {}}
      />

      <div className="main-content">
        {/* Dashboard - Tasks Panel */}
        {activeView === "dashboard" && activeDashboardPanel === "tasks" && (
          <section className="workflow workspace-pane active" id="tasks">
            <div className="section-heading">
              <div><div className="section-label">Tasks</div><h2>今日任务</h2></div>
            </div>
            <div className="task-list">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  activeTimerTaskId={activeTimerTaskId}
                  timerStartTime={timerStartTime}
                  elapsedSeconds={elapsedSeconds}
                  onToggleDone={toggleTaskDone}
                  onStartTask={() => setActiveTimerTaskId(task.id)}
                  onEndLearning={() => updateTask(task.id, { status: "已完成" })}
                  onRecordResult={() => {}}
                  onShowDetail={() => setActiveTaskId(task.id)}
                  onMoveTask={() => {}}
                  onUpdateTask={updateTask}
                  onStopTimer={() => setActiveTimerTaskId("")}
                />
              ))}
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

        {/* Knowledge - Reader Panel */}
        {activeView === "knowledge" && activeKnowledgePanel === "resources" && activeResource && (
          <ReaderPanel
            activeResource={activeResource}
            readerSearch={readerSearch} readerPage={readerPage} readerZoom={readerZoom}
            favoritePages={favoritePages} activePageKey={`${activeResource.id}-${readerPage}`}
            relatedQuestions={questions.filter((q) => q.subject === activeResource.subject)}
            subjectAnnotations={annotations.filter((a) => a.resourceId === activeResource.id)}
            subjectNodes={nodes.filter((n) => n.subject === activeResource.subject)}
            onSetReaderSearch={setReaderSearch} onSetReaderPage={setReaderPage}
            onSetReaderZoom={setReaderZoom} onSaveProgress={() => {}}
            onMarkRead={() => {}} onToggleFavorite={() => {}}
            onShowRelated={() => {}} onCreateCard={() => {}}
            onDeleteAnnotation={() => {}} onEditAnnotation={() => {}}
            onJumpToPage={setReaderPage}
          />
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