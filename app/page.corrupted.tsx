"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
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

const quickPrompts = ["今天学什么","找近五年化学势真题","傅献彩哪里讲这个","为什么总错这类题","把今天整理成笔记","分析最近三套真题，更新图谱并重排计划","我现在属于第几轮"];
const masteryOptions: MasteryText[] = ["完全不懂","有些模糊","基本理解","能够讲清","能够迁移"];
const moodOptions: StudyMood[] = ["较差","一般","正常","较好","很好"];
const coreNames = ["热力学","相平衡","化学动力学","电化学","统计热力学","表面与胶体","实验与综合"];

let _counter = 0;
function makeId(prefix: string) { _counter++; return prefix + "-" + Date.now() + "-" + _counter + "-" + Math.random().toString(16).slice(2); }
function today() { return new Date().toLocaleString("zh-CN",{hour12:false,timeZone:"Asia/Shanghai"}); }
function dateOnly(offsetDays: number = 0) { const d = new Date(); d.setDate(d.getDate() + offsetDays); return d.toISOString().slice(0,10); }
function normalizeExamGoal(g: ExamGoal): ExamGoal { return { ...seedExam, ...g, startDate: g.startDate ?? seedExam.startDate ?? "2026-07-30" }; }
function dateRange(start: string, end: string) {
  const s = new Date(start).getTime(), e = new Date(end).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || s > e) return [dateOnly()];
  const days = Math.min(MAX_STUDY_DAYS, Math.floor((e - s) / 86400000) + 1);
  return Array.from({ length: days }, (_,i) => { const d = new Date(s); d.setDate(d.getDate() + i); return d.toISOString().slice(0,10); });
}

export default function Home() {
  const [activeView, setActiveView] = useState<WorkspaceView>("dashboard");
  const [activeKP, setActiveKP] = useState<KnowledgePanel>("landing");
  const [activeDP, setActiveDP] = useState<DashboardPanel>("tasks");
  const [reviewScope, setReviewScope] = useState<ReviewScope>("日复盘");
  const [activeReviewSubject, setActiveReviewSubject] = useState("全部科目");
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [activeTaskId, setActiveTaskId] = useState("");
  const [activeTimerTaskId, setActiveTimerTaskId] = useState("");
  const [lastDeleted, setLastDeleted] = useState<DeletedBackup | null>(null);
  const [exam, setExam] = useState(seedExam);
  const [appSettings, setAppSettings] = useState(seedAppSettings);
  const [subjects, setSubjects] = useState(seedSubjects);
  const [activeKS, setActiveKS] = useState(seedSubjects[0]?.name ?? "");
  const [activeCS, setActiveCS] = useState(seedSubjects[0]?.name ?? "");
  const [resources, setResources] = useState(seedResources);
  const [questions, setQuestions] = useState(seedQuestions);
  const [nodes, setNodes] = useState(seedNodes);
  const [tasks, setTasks] = useState(seedTasks);
  const [pending, setPending] = useState<PendingItem[]>([{id:"p-1",kind:"真题识别",title:"2023 828 真题第 6 题",subject:"828 物理化学",detail:"建议挂载到 相平衡 / 相律 / 自由度判断",status:"待确认"}]);
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
  const [cardView, setCardView] = useState<"复习"|"管理">("复习");
  const [reviewTab, setReviewTab] = useState<"概览"|"填写复盘"|"AI总结">("概览");
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [logs, setLogs] = useState<PlanLog[]>([{id:"l-1",time:today(),input:"今天只有两个小时",output:"压缩为 2 个 828 Layer 2 任务",accepted:"已接受",dataRead:["考试日期","当前轮次","高风险节点"],userRevision:"无",finalResult:"生成今日任务",rating:"未评价",rework:"0"}]);
  const [review, setReview] = useState<Review>({done:"",hard:"",load:"刚好",tomorrow:"3 小时",priority:""});
  const [chatInput, setChatInput] = useState("");
  const [notice, setNotice] = useState("");
  const [chat, setChat] = useState([{role:"user",text:"今天只有两个小时，我该学什么？"},{role:"assistant",text:"先处理 828 物理化学。当前熵变计算仍在 Layer 2，不进入综合题。"}]);
  const [questionFilter, setQuestionFilter] = useState({subject:"全部",core:"全部",result:"全部",keyword:""});
  const [tooltipData, setTooltipData] = useState<{date:string;top:number;left:number;above:boolean}|null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const heatmapRef = useRef<HTMLDivElement>(null);
  const hasInitializedScroll = useRef(false);
  const hoveredDateRef = useRef<string|null>(null);
  const [tappedDate, setTappedDate] = useState<string|null>(null);
  const [timerStartTime, setTimerStartTime] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const [completionModalAllowEditTime, setCompletionModalAllowEditTime] = useState(false);
  const [completionModalCustomMinutes, setCompletionModalCustomMinutes] = useState("");
  const [completionModalCustomEndTime, setCompletionModalCustomEndTime] = useState("--");
  const [hydratedTodayStr, setHydratedTodayStr] = useState("2026-07-30");
  const [hydratedDaysLeft, setHydratedDaysLeft] = useState(143);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState<string|null>(null);
  const [quickCardFront, setQuickCardFront] = useState("");
  const [quickCardBack, setQuickCardBack] = useState("");
  const [quickCardType, setQuickCardType] = useState<GrowthCard["type"]>("公式卡");
  const cardsRef = useRef<HTMLDivElement>(null);
  const [resourceView, setResourceView] = useState<"grid"|"list">("grid");
  const [readingMode, setReadingMode] = useState(false);
  const [readerTab, setReaderTab] = useState<ReaderTab>("annotations");
  const [fileUploadState, setFileUploadState] = useState<{name:string;size:number;inferred:ReturnType<typeof inferResource>;step:string}|null>(null);

  // Rest of the implementation needs to be recovered from the Vite dev server cache
  // The file was accidentally truncated. Please restore from the running dev server:
  // localhost:3001

  return <div className="p-8 text-center"><h2>File was corrupted. Please restore from backup.</h2></div>;
}