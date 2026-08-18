/**
 * computeOverallProgress — 科目进度 reducer（Sprint 2B-1）
 *
 * 纯函数：由 KnowledgeState[] + Subject[] 计算整体进度（0-100）。
 *
 * 处理规则（明确契约）：
 *  1. 权重：subjects 每科等权（1 / subjects.length）。
 *  2. 有效科目：states 中 subjectId 存在于 subjects 才计（未知 subjectId → 忽略该 state）。
 *  3. 空数据：states 为空或 subjects 为空 → 返回 0。
 *  4. 科目无 state（未观测科目）→ 该科权重从分母中剔除，剩余科目权重重归一化。
 *  5. 未观测节点（eventCount === 0）→ 保留节点初始锚点 masteryScore，不视为 0。
 *  6. 0 mastery：某科节点 masteryScore 全为 0 → 该科得分 0，正确反映。
 *
 * 确定性：无副作用、无 Date.now / Math.random / 全局读；同输入同输出。
 */

import type { KnowledgeState, Subject } from "./types.ts";

export type OverallProgressResult = {
  /** 整体进度（0-100，Math.round） */
  progress: number;
  /** 参与计算的科目数（有效科目） */
  effectiveSubjects: number;
  /** 未观测科目数（subjects 中存在但无任何 state） */
  skippedSubjects: number;
};

/**
 * 计算整体进度（投影驱动）
 *
 * @param states 来自 projectKnowledgeState(events, nodes) 的投影结果
 * @param subjects 当前科目列表（每科等权）
 */
export function computeOverallProgress(
  states: KnowledgeState[],
  subjects: Subject[]
): OverallProgressResult {
  // 空数据契约
  if (states.length === 0 || subjects.length === 0) {
    return { progress: 0, effectiveSubjects: 0, skippedSubjects: subjects.length };
  }

  // 科目名 → 该科所有 state 的 masteryScore 列表
  const bySubject = new Map<string, number[]>();
  const subjectNames = new Set(subjects.map((s) => s.name));

  for (const s of states) {
    // 未知 subjectId → 忽略（不参与）
    if (!subjectNames.has(s.subjectId)) continue;
    const scores = bySubject.get(s.subjectId) ?? [];
    scores.push(s.masteryScore);
    bySubject.set(s.subjectId, scores);
  }

  if (bySubject.size === 0) {
    return { progress: 0, effectiveSubjects: 0, skippedSubjects: subjects.length };
  }

  // 有效科目数 = 有 state 的科目；等权 1/N；未观测科目跳过
  const effectiveSubjects = bySubject.size;
  const skippedSubjects = subjects.length - bySubject.size;
  const subjectWeight = 1 / effectiveSubjects;

  let total = 0;
  for (const [, scores] of bySubject) {
    const subjectAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
    total += subjectAvg * subjectWeight;
  }

  return {
    progress: Math.round(Math.min(100, Math.max(0, total))),
    effectiveSubjects,
    skippedSubjects,
  };
}

/**
 * Legacy 进度对照函数（与 page.tsx 旧 logic 一致，用于开发模式对比）
 *
 * 旧公式：
 *   nodes 平均掌握度 × 0.55 + 已确认题占比 × 0.25 + 已索引资源占比 × 0.2
 */
export function computeLegacyProgress(
  nodeMasteryScores: number[],
  confirmedQuestions: number,
  totalQuestions: number,
  indexedResources: number,
  totalResources: number
): number {
  if (nodeMasteryScores.length === 0) return 0;
  const nodeAvg =
    nodeMasteryScores.reduce((a, b) => a + b, 0) / nodeMasteryScores.length;
  const questionRatio = totalQuestions > 0 ? confirmedQuestions / totalQuestions : 0;
  const resourceRatio = totalResources > 0 ? indexedResources / totalResources : 0;
  return Math.round(
    nodeAvg * 0.55 + questionRatio * 100 * 0.25 + resourceRatio * 100 * 0.2
  );
}