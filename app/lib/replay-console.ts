/**
 * ReplayConsole — 开发模式对照工具（Sprint 2A）
 *
 * 作用：打印 Current Node Mastery vs Projected Mastery 对照，用于验证投影稳定性。
 * 仅 console 输出，不接任何 UI 读取路径。
 *
 * 设计约束：
 *   - 不写入存储、不修改状态
 *   - 纯读取 + console 输出
 *   - 仅在开发环境调用（page.tsx 中通过 import.meta.env.DEV 或 NODE_ENV 判定）
 */

import type { KnowledgeNode, KnowledgeState, Subject } from "./types.ts";
import type { LearningEvent } from "./events.ts";
import { projectKnowledgeState } from "./projection.ts";
import { computeOverallProgress, computeLegacyProgress } from "./reducer.ts";

export type ReplaySummary = {
  eventsProcessed: number;
  nodesProjected: number;
  nodesUpdated: number;
  warnings: number;
};

/**
 * 生成开发对照摘要
 *
 * @returns ReplaySummary（供测试断言）同时 console 输出对照表
 */
export function computeReplayComparison(
  events: LearningEvent[],
  nodes: KnowledgeNode[]
): ReplaySummary {
  const projected = projectKnowledgeState(events, nodes);

  const nodesUpdated = projected.filter(
    (p) => p.derivedBy === "projectKnowledgeState:replay"
  ).length;

  // 对照表：Current（nodes 现有）vs Projected
  const discrepancies: string[] = [];
  // eslint-disable-next-line no-console
  console.group("[MemoryEngine] Replay Memory（Sprint 2A 开发对照）");
  for (const n of nodes) {
    const state = projected.find((p) => p.nodeId === n.id);
    if (!state) continue;
    const currentMastery = n.masteryScore;
    const projectedMastery = state.masteryScore;
    const diff = projectedMastery - currentMastery;
    if (diff !== 0) {
      discrepancies.push(
        `  ${n.subject} / ${n.knowledge}: Current ${currentMastery} → Projected ${projectedMastery} (${diff > 0 ? "+" : ""}${diff})`
      );
    }
    // eslint-disable-next-line no-console
    console.log(`  ${n.subject} / ${n.knowledge}: Current ${currentMastery} | Projected ${projectedMastery}`);
  }
  if (discrepancies.length > 0) {
    // eslint-disable-next-line no-console
    console.warn("  差异明细：");
    for (const line of discrepancies) {
      // eslint-disable-next-line no-console
      console.warn(line);
    }
  }
  // eslint-disable-next-line no-console
  console.log(
    `Replay Finished | Events: ${events.length} | Nodes: ${projected.length} | Updated: ${nodesUpdated} | Warnings: ${discrepancies.length}`
  );
  // eslint-disable-next-line no-console
  console.groupEnd();

  return {
    eventsProcessed: events.length,
    nodesProjected: projected.length,
    nodesUpdated,
    warnings: discrepancies.length,
  };
}

/** 开发环境判定（Next/Vite 通用，避免依赖 import.meta.env 类型声明） */
export function isDevMode(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * Legacy vs Projected Dashboard Progress 开发对照（Sprint 2B-1）
 *
 * 输入：投影 states + 当前 subjects + legacy 三要素（节点掌握度/真题确认/资源索引）。
 * 仅 console 输出，不修改任何 UI 读取路径。
 */
export function computeProgressComparison(
  states: KnowledgeState[],
  subjects: Subject[],
  legacy: {
    nodeMasteryScores: number[];
    confirmedQuestions: number;
    totalQuestions: number;
    indexedResources: number;
    totalResources: number;
  }
): { legacyProgress: number; projectedProgress: number; effectiveSubjects: number; skippedSubjects: number } {
  const projectedResult = computeOverallProgress(states, subjects);
  const legacyProgress = computeLegacyProgress(
    legacy.nodeMasteryScores,
    legacy.confirmedQuestions,
    legacy.totalQuestions,
    legacy.indexedResources,
    legacy.totalResources
  );

  // eslint-disable-next-line no-console
  console.group("[MemoryEngine] Dashboard Progress 对照（Sprint 2B-1 开发模式）");
  // eslint-disable-next-line no-console
  console.log(`  Legacy Progress:     ${legacyProgress}%`);
  // eslint-disable-next-line no-console
  console.log(`  Projected Progress:  ${projectedResult.progress}%`);
  // eslint-disable-next-line no-console
  console.log(`  Effective Subjects:  ${projectedResult.effectiveSubjects} | Skipped (未观测): ${projectedResult.skippedSubjects}`);
  if (legacyProgress !== projectedResult.progress) {
    // eslint-disable-next-line no-console
    console.warn(`  ⚠ 差异 ${projectedResult.progress - legacyProgress > 0 ? "+" : ""}${projectedResult.progress - legacyProgress} 个百分点（观察期，不影响 UI）`);
  }
  // eslint-disable-next-line no-console
  console.groupEnd();

  return {
    legacyProgress,
    projectedProgress: projectedResult.progress,
    effectiveSubjects: projectedResult.effectiveSubjects,
    skippedSubjects: projectedResult.skippedSubjects,
  };
}

export type { KnowledgeState };