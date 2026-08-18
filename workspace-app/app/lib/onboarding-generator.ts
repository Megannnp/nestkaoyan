import type { ExamGoal, Subject, Resource, KnowledgeNode, Task, MasteryText } from "./types";

/**
 * 初始化向导 · 演示版学习结构生成器（规则，非 AI 正式分析）。
 *
 * 根据用户设置的科目与导入的资料，规则化生成一份初始知识图谱与第一阶段任务，
 * 目的是让新用户完成向导后立刻看到一个可运转的学习结构。所有产物在 UI 上均以
 * “演示生成”呈现，接入真实模型后再替换为 AI 正式分析。
 */

let _seq = 0;
function genId(prefix: string): string {
  _seq++;
  return `${prefix}-onb-${Date.now()}-${_seq}-${Math.random().toString(16).slice(2, 6)}`;
}

const MASTERY_LIST: MasteryText[] = ["完全不懂", "有些模糊", "基本理解", "能够讲清", "能够迁移"];
const MASTERY_TO_SCORE: Record<MasteryText, number> = {
  "完全不懂": 10, "有些模糊": 30, "基本理解": 55, "能够讲清": 75, "能够迁移": 90,
};
const MASTERY_TO_LEVEL: Record<MasteryText, number> = {
  "完全不懂": 0, "有些模糊": 1, "基本理解": 2, "能够讲清": 3, "能够迁移": 4,
};

/** 七核（专业课通用骨架；当前内置科目为公共课，专业课由用户自建时使用） */
const SEVEN_CORES = ["先秦文学", "两汉文学", "魏晋南北朝", "唐代文学", "宋代文学", "元明清文学", "现当代文学"];

/** 常见公共课的起始核心 */
const STARTER_CORES: Record<string, string[]> = {
  "政治": ["马原", "毛中特", "史纲", "思修法基", "时政"],
  "英语一": ["阅读理解", "长难句", "完形填空", "翻译", "写作"],
  "英语二": ["阅读理解", "长难句", "完形填空", "翻译", "写作"],
  "数学一": ["高等数学", "线性代数", "概率统计"],
  "数学二": ["高等数学", "线性代数"],
  "数学三": ["高等数学", "线性代数", "概率统计"],
};

function coresForSubject(subject: Subject): string[] {
  if (STARTER_CORES[subject.name]) return STARTER_CORES[subject.name];
  if (subject.type === "专业课") return SEVEN_CORES;
  const seed = subject.focus || subject.currentProgress;
  return seed ? [seed, "核心考点", "综合应用"] : ["基础", "核心考点", "综合应用"];
}

function normalizeMastery(value: string): MasteryText {
  return (MASTERY_LIST as string[]).includes(value) ? (value as MasteryText) : "有些模糊";
}

export interface InitialStructure {
  nodes: KnowledgeNode[];
  tasks: Task[];
}

/** 每份初始计划的第一阶段任务上限，避免今日任务过载 */
const MAX_INITIAL_TASKS = 4;

export function generateInitialStructure(
  _exam: ExamGoal,
  subjects: Subject[],
  resources: Resource[]
): InitialStructure {
  const nodes: KnowledgeNode[] = [];
  const tasks: Task[] = [];

  subjects.forEach((subject) => {
    const cores = coresForSubject(subject);
    const mastery = normalizeMastery(subject.currentMastery);
    const baseScore = MASTERY_TO_SCORE[mastery];
    const baseLevel = MASTERY_TO_LEVEL[mastery];
    const subjectResource = resources.find((r) => r.subject === subject.name);
    const hasPastPaper = resources.some(
      (r) => r.subject === subject.name && (r.resourceKind === "past_exam" || r.type.includes("真题"))
    );

    cores.forEach((core, ci) => {
      nodes.push({
        id: genId("k"),
        subject: subject.name,
        core,
        branch: "",
        knowledge: `${core}（起始考点）`,
        explanation: "演示生成：初始化向导据科目与资料规则化生成，非 AI 正式分析。",
        prerequisite: "",
        related: "",
        masteryLevel: baseLevel,
        masteryScore: baseScore,
        confidence: "低",
        round: subject.round || "第一轮",
        layer: subject.layer || "Layer 1",
        mistakes: 0,
        reviewRisk: ci === 0 ? (subject.risk || "正常") : "正常",
        isMonthlyFocus: ci === 0,
      });
    });

    // 第一阶段任务：每科 1 个，指向首个核心
    if (tasks.length < MAX_INITIAL_TASKS && cores.length) {
      const core = cores[0];
      tasks.push({
        id: genId("t"),
        title: `${subject.name}：入门梳理「${core}」`,
        subject: subject.name,
        core,
        branch: "",
        round: subject.round || "第一轮",
        layer: subject.layer || "Layer 1",
        source: subjectResource?.name ?? (hasPastPaper ? "已导入真题" : "待补充资料"),
        range: `${core} 基础概念与代表题型`,
        minutes: 60,
        standard: `能说清 ${core} 的核心概念，并完成 2-3 道基础题。`,
        reason: `演示生成的第一阶段任务：${subject.name} 当前处于「${mastery}」，先夯实 ${core}。`,
        backup: "",
        done: false,
        actualMinutes: "",
        difficulty: "2",
        mastery,
        accuracy: "",
        needReview: true,
        mood: "正常",
        note: "",
        status: "待开始",
        // 规则/演示生成，非 AI 推荐——不打 aiRecommended 徽标，避免误导
        aiRecommended: false,
        aiReasonForgetRate: "",
        aiReasonLayerStable: "",
        aiReasonMistakeCount: "",
        aiReasonExamFrequency: "",
        estimatedCompletionMinutes: 60,
        masteryBefore: baseScore,
        masteryAfter: Math.min(100, baseScore + 15),
        startedAt: "",
        completedAt: "",
        relatedCardIds: [],
        relatedQuestionIds: [],
      });
    }
  });

  return { nodes, tasks };
}
