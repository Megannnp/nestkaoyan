/**
 * E2E 测试专用种子数据（2026-08-03）
 *
 * page.tsx 已移除虚拟数据（新用户进入是空白），
 * E2E 测试依赖「公共课」种子数据（政治 / 英语一 / 数学二）。
 * 此文件仅在测试环境被 helpers.ts 引用，不进入生产 bundle。
 * 2026-08-14：生产 seed 已删除 demo 数据（卡片为空），此处注入一张「政治」测试卡片
 * 支撑卡片复习/评分/隔离等用例（仅测试夹具，不污染生产 seed）。
 */
import type { GrowthCard, KnowledgeNode, Task } from "../../app/lib/types";
import {
  seedExam, seedSubjects, seedResources, seedQuestions, seedNodes,
  seedTasks, seedNotes, seedCards, seedAnnotations, seedAppSettings,
  seedStudyDays, seedCardCategories, seedMaterials, seedMaterialSections,
} from "../../app/lib/default-data";

/** E2E 专用测试卡片（政治科目，供卡片复习/评分/学科隔离用例） */
const E2E_POLITICS_CARD: GrowthCard = {
  id: "e2e-card-politics-1",
  title: "中国式现代化的五个特色",
  front: "中国式现代化的五个特色是？",
  back: "人口规模巨大、全体人民共同富裕、物质文明和精神文明相协调、人与自然和谐共生、走和平发展道路。",
  type: "概念卡",
  subject: "政治",
  core: "毛泽东思想和中国特色社会主义理论体系",
  branch: "中国式现代化",
  knowledge: "中国式现代化五个特色",
  source: "2024 考研政治真题",
  page: "P1",
  modes: ["背诵", "填空"],
  createdBy: "AI对话",
  createdAt: "2026-07-30T22:00:00.000Z",
  lastReviewed: "未复习",
  nextReviewAt: "2026-07-30",
  mastery: "模糊",
  note: "",
  favorite: false,
};

/** E2E 专用政治知识点（支撑知识图谱列表/风险编辑用例；生产 seed 节点已清空） */
const E2E_POLITICS_NODE: KnowledgeNode = {
  id: "e2e-node-politics-1",
  subject: "政治",
  core: "马克思主义基本原理",
  branch: "唯物史观",
  knowledge: "社会存在与社会意识",
  explanation: "E2E 测试节点：社会存在决定社会意识，社会意识具有相对独立性。",
  prerequisite: "",
  related: "",
  masteryLevel: 1,
  masteryScore: 40,
  confidence: "低",
  round: "第一轮",
  layer: "第 1 层",
  mistakes: 2,
  reviewRisk: "需要关注",
  isMonthlyFocus: true,
};

/** E2E 专用政治任务（支撑 Dashboard 任务列表/计时/排序、复盘指标卡等用例；生产 seed 任务已清空） */
const E2E_POLITICS_TASK: Task = {
  id: "e2e-task-politics-1",
  title: "马原第一轮：唯物史观核心概念",
  subject: "政治",
  core: "马克思主义基本原理",
  branch: "唯物史观",
  round: "第一轮",
  layer: "第 1 层",
  source: "2024 考研政治真题",
  range: "社会存在与社会意识",
  minutes: 60,
  standard: "能说清社会存在决定社会意识，并完成 2 道相关真题。",
  reason: "E2E 测试任务：巩固唯物史观基础。",
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
  aiReasonForgetRate: "遗忘概率 60%",
  aiReasonLayerStable: "第 1 层尚未稳定",
  aiReasonMistakeCount: "错题 2 次",
  aiReasonExamFrequency: "属于高频真题考点",
  estimatedCompletionMinutes: 60,
  masteryBefore: 40,
  masteryAfter: 65,
  startedAt: "",
  completedAt: "",
  relatedCardIds: [],
  relatedQuestionIds: [],
};

/** E2E 专用英语一任务（与政治任务构成多任务，支撑排序/隔离用例） */
const E2E_ENGLISH_TASK: Task = {
  id: "e2e-task-english-1",
  title: "英语一阅读：2010 年真题 Text 1",
  subject: "英语一",
  core: "阅读理解",
  branch: "长难句",
  round: "第一轮",
  layer: "第 1 层",
  source: "2010 考研英语一真题",
  range: "Text 1",
  minutes: 45,
  standard: "能复述主旨并讲清长难句结构。",
  reason: "E2E 测试任务：阅读理解基础。",
  backup: "",
  done: false,
  actualMinutes: "",
  difficulty: "2",
  mastery: "基本理解",
  accuracy: "",
  needReview: false,
  mood: "正常",
  note: "",
  status: "待开始",
  aiRecommended: false,
  aiReasonForgetRate: "",
  aiReasonLayerStable: "",
  aiReasonMistakeCount: "",
  aiReasonExamFrequency: "",
  estimatedCompletionMinutes: 45,
  masteryBefore: 50,
  masteryAfter: 70,
  startedAt: "",
  completedAt: "",
  relatedCardIds: [],
  relatedQuestionIds: [],
};

export function buildE2ESeedState(): Record<string, unknown> {
  // 2026-08-04 说明：page.tsx「无效存档检测」已尊重 onboardingCompleted=true，
  // 种子显式标记完成引导 → 不触发重置。保持 seedExam 固定日期以兼容
  // 热力图（2026-07-30）/ 复盘等依赖起始日期的测试断言。
  return {
    storageVersion: 5,
    onboardingCompleted: true,
    exam: seedExam,
    appSettings: seedAppSettings,
    subjects: seedSubjects,
    activeKnowledgeSubject: seedSubjects[0]?.name ?? "",
    activeCardSubject: seedSubjects[0]?.name ?? "",
    resources: seedResources,
    materials: seedMaterials,
    materialSections: seedMaterialSections,
    questions: seedQuestions,
    nodes: [...seedNodes, E2E_POLITICS_NODE],
    tasks: [...seedTasks, E2E_POLITICS_TASK, E2E_ENGLISH_TASK],
    pending: [],
    notes: seedNotes,
    cards: [...seedCards, E2E_POLITICS_CARD],
    cardCategories: seedCardCategories,
    annotations: seedAnnotations,
    studyDays: seedStudyDays,
    agentSteps: [],
    logs: [],
    chatSessions: [],
    activeSessionId: "",
    review: { done: "", hard: "", load: "刚好", tomorrow: "3 小时", priority: "" },
    structuredReviews: [],
    studyDraft: null,
    activeResourceId: seedResources[0]?.id ?? "",
    readerSearch: "",
    readerPage: seedResources[0]?.currentPage ?? "",
    readerZoom: "100%",
    activeTimerTaskId: "",
    timerStartTime: "",
    timerAccumSeconds: 0,
    timerRunStartEpoch: 0,
  };
}