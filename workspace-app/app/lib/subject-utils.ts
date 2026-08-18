import type { Subject } from "./types";

/** 默认科目满分映射（公共课 100 / 专业课 150） */
export const DEFAULT_MAX_SCORE: Record<string, string> = {
  "公共课": "100",
  "专业课": "150",
};

/** 科目类型 → 推荐满分（未知类型回退 100） */
export function getDefaultMaxScore(type: string): string {
  return DEFAULT_MAX_SCORE[type] || "100";
}

export function makeSubjectId(): string {
  return `s-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
}

/** 空白科目模板 */
export const NEW_SUBJECT_TEMPLATE = (): Subject => ({
  id: makeSubjectId(),
  name: "",
  type: "公共课",
  maxScore: "100",
  targetScore: "70",
  currentProgress: "",
  currentMastery: "有些模糊",
  weeklyHours: "4",
  hasPastPapers: false,
  hasSolutions: false,
  hasReferences: false,
  round: "第一轮",
  layer: "Layer 1",
  focus: "",
  risk: "正常",
});

/**
 * 目标分不得超过满分：返回夹紧后的字符串。
 * 用于新增/编辑科目时的即时校验。
 */
export function clampTargetScore(target: string, maxScore: string): string {
  const num = Number(target) || 0;
  const max = Number(maxScore) || 0;
  return String(Math.min(Math.max(num, 0), max));
}

/** 依据科目类型创建一个带默认满分/目标分的科目（可显式覆盖满分，如数学为 150） */
export function makeSubject(partial: Partial<Subject> & { name: string; type?: string }): Subject {
  const type = partial.type ?? "公共课";
  const maxScore = partial.maxScore ?? getDefaultMaxScore(type);
  return {
    ...NEW_SUBJECT_TEMPLATE(),
    ...partial,
    id: partial.id ?? makeSubjectId(),
    type,
    maxScore,
    targetScore: clampTargetScore(partial.targetScore ?? "70", maxScore),
  };
}

/**
 * 初始化向导用的一键科目预设。
 * 数学虽为公共课但满分 150，故显式带 maxScore，避免被默认 100 夹紧。
 */
export const SUBJECT_PRESETS: { name: string; type: string; maxScore: string; targetScore: string }[] = [
  { name: "政治", type: "公共课", maxScore: "100", targetScore: "70" },
  { name: "英语一", type: "公共课", maxScore: "100", targetScore: "70" },
  { name: "英语二", type: "公共课", maxScore: "100", targetScore: "70" },
  { name: "数学一", type: "公共课", maxScore: "150", targetScore: "120" },
  { name: "数学二", type: "公共课", maxScore: "150", targetScore: "120" },
  { name: "数学三", type: "公共课", maxScore: "150", targetScore: "120" },
  { name: "专业课", type: "专业课", maxScore: "150", targetScore: "125" },
];
