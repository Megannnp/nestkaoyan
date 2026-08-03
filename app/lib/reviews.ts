import type { GrowthCard, KnowledgeNode, Question, Review, StructuredReview, Task } from "./types.ts";
import { extractReviewFields } from "./memory-rules.ts";
import { makeId } from "./utils.ts";

/**
 * 复盘域纯逻辑（从 page.tsx 抽取，便于离线单测与复用，降低上帝组件体积）。
 * 仅包含复盘统计、结构化复盘构建等纯函数；副作用（setState/toast）由组件层执行。
 */

/** 复盘维度：科目列表（全部 + 各科目） */
export function buildReviewSubjects(subjectNames: string[]): string[] {
  return ["全部科目", ...subjectNames];
}

/** 复盘维度：已完成任务总分钟数 */
export function reviewMinutesOf(tasks: Task[]): number {
  return tasks.filter((t) => t.done).reduce((sum, t) => sum + (Number(t.actualMinutes) || 0), 0);
}

/** 复盘维度：已完成任务数 */
export function reviewCompletedCount(tasks: Task[]): number {
  return tasks.filter((t) => t.done).length;
}

/** 复盘维度：月度关注知识点数 */
export function reviewNewNodesCount(nodes: KnowledgeNode[]): number {
  return nodes.filter((n) => n.isMonthlyFocus).length;
}

/** 复盘维度：已完成真题数 */
export function reviewDoneQuestionsCount(questions: Question[]): number {
  return questions.filter((q) => q.done).length;
}

/** 复盘维度：已复习卡片数 */
export function reviewReviewedCardsCount(cards: GrowthCard[]): number {
  return cards.filter((c) => c.lastReviewed !== "未复习").length;
}

/** 复盘维度：平均掌握度（0-100） */
export function reviewMasteryAverage(nodes: KnowledgeNode[]): number {
  return nodes.reduce((sum, n) => sum + n.masteryScore, 0) / Math.max(nodes.length, 1);
}

/** 复盘 AI 总结文案（与提取字段联动，展示同一套数据） */
export function buildReviewAiSummary(tasks: Task[], nodes: KnowledgeNode[]): string {
  return `今日完成 ${reviewCompletedCount(tasks)} 个任务，掌握度变化 ${Math.round(reviewMasteryAverage(nodes))}%。`;
}

/**
 * P4 Phase 1: 由 Review 表单构建结构化复盘（纯函数；未填写内容时返回 null）。
 * 与 memory-rules.extractReviewFields 共享同一套离线规则。
 */
export function buildStructuredReview(
  review: Review,
  mkId: (prefix: string) => string = makeId,
  now: () => string = () => new Date().toISOString(),
): StructuredReview | null {
  if (!review.done.trim() && !review.hard.trim()) return null;
  const parsed = extractReviewFields({
    done: review.done,
    hard: review.hard,
    overload: review.load,
    availableTime: review.tomorrow,
    priority: review.priority,
  });
  const timestamp = now();
  const aiSummary = [
    review.done.trim() ? `完成内容：${review.done.trim()}` : "",
    review.hard.trim() ? `困难点：${review.hard.trim()}` : "",
    parsed.loadLevel === "过少" ? "计划负荷偏少，可适当加量。" : parsed.loadLevel === "过多" ? "计划负荷偏重，建议精简。" : "计划负荷适中。",
  ].filter(Boolean).join(" ");
  return {
    id: mkId("sr"),
    sourceId: `review-${Date.now()}`,
    date: timestamp,
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
    createdAt: timestamp,
  };
}