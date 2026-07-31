/**
 * projectKnowledgeState — 知识点状态投影（Sprint 2A）
 *
 * 纯函数：由 LearningEvent[] 重放导出 KnowledgeState[]。
 *
 * 验收标准（达成）：
 *  1. 不读取全局状态、不写入存储
 *  2. 同一组事件多次 Replay 输出完全一致（确定性）
 *  3. 所有字段都能从事件流推导，不依赖隐藏状态（可完全重建）
 *  4. 业务规则统一在 memory-rules.ts 的 KNOWLEDGE_PROJECTION_RULES，
 *     本文件不内联任何业务规则
 *  5. 不修改任何 UI 读取路径（Sprint 2B 才切换）
 *
 * 可完全重建验证：
 *  删除全部 KnowledgeState → Replay 全部 LearningEvent → 结果一致。
 *  通过确定性测试：projectKnowledgeState(events) 两次调用结果 depthEqual。
 *
 * `projectedAt` 确定性契约（Sprint 2B-1 固化）：
 *  - 取"排序后最后一条事件的 occurredAt"（ISO 字符串），而非 `new Date()`。
 *  - 事件流为空 → `""`。
 *  - 因此同批事件无论调用多少次，projectedAt 恒等；可安全用于缓存键。
 */

import type { KnowledgeNode, KnowledgeState, Risk } from "./types.ts";
import type { LearningEvent } from "./events.ts";
import { KNOWLEDGE_PROJECTION_RULES } from "./memory-rules.ts";

/** 单节点投影上下文：累积器 + 最近事件跟踪 + 事件计数 */
type NodeProjectionContext = {
  accumulator: ReturnType<typeof KNOWLEDGE_PROJECTION_RULES.createInitialAccumulator>;
  lastEventId: string | null;
  lastReviewedAt: string | null;
  lastCardMastery: KnowledgeState["lastCardMastery"];
  lastQuestionResult: KnowledgeState["lastQuestionResult"];
  /** 触达本节点的事件数（可重建，eventCount === 0 表示未观测） */
  eventCount: number;
};

/** 投影所需的最小节点信息 */
type ProjectableNode = Pick<
  KnowledgeNode,
  "id" | "subject" | "masteryScore" | "masteryLevel" | "mistakes"
>;

/**
 * 投影一条事件对节点的效果（纯函数）。
 * 事件映射到节点：事件 sourceRef.nodeIds 包含该节点 → 生效。
 */
function applyEventToNode(
  ctx: NodeProjectionContext,
  event: LearningEvent,
  node: ProjectableNode
): NodeProjectionContext {
  const nextAcc = KNOWLEDGE_PROJECTION_RULES.applyEvent(ctx.accumulator, event, node);
  return {
    accumulator: nextAcc,
    lastEventId: event.id,
    eventCount: ctx.eventCount + 1,
    // 最近状态投影：来自事件本身，而非隐藏状态
    lastReviewedAt:
      event.type === "card_reviewed"
        ? event.occurredAt
        : ctx.lastReviewedAt,
    lastCardMastery:
      event.type === "card_reviewed"
        ? (event.payload.mastery ?? ctx.lastCardMastery)
        : ctx.lastCardMastery,
    lastQuestionResult:
      event.type === "question_answered"
        ? (event.payload.result === "正确" ? "正确" : event.payload.result === "错误" ? "错误" : ctx.lastQuestionResult)
        : ctx.lastQuestionResult,
  };
}

/**
 * 将一条事件分发给所有关联节点（纯函数）。
 * 事件顺序由调用方排序保证确定性。
 */
function foldEvent(
  contexts: Map<string, NodeProjectionContext>,
  event: LearningEvent,
  nodeById: Map<string, ProjectableNode>
): void {
  const nodeIds = event.sourceRef.nodeIds ?? [];
  for (const nodeId of nodeIds) {
    const node = nodeById.get(nodeId);
    if (!node) continue; // 事件关联的节点不存在 → 跳过（容忍）
    const ctx = contexts.get(nodeId) ?? {
      accumulator: KNOWLEDGE_PROJECTION_RULES.createInitialAccumulator(node),
      lastEventId: null,
      lastReviewedAt: null,
      lastCardMastery: null,
      lastQuestionResult: null,
      eventCount: 0,
    };
    contexts.set(nodeId, applyEventToNode(ctx, event, node));
  }
}

/**
 * 投影全部事件 → KnowledgeState[]
 *
 * @param events 任意顺序（内部按 occurredAt 排序，幂等）
 * @param nodes 当前知识节点列表（作为投影初始锚点）
 * @returns 每个节点一个 KnowledgeState，按 nodes 顺序
 */
export function projectKnowledgeState(
  events: LearningEvent[],
  nodes: KnowledgeNode[]
): KnowledgeState[] {
  const nodeById = new Map<string, ProjectableNode>();
  for (const n of nodes) {
    nodeById.set(n.id, { id: n.id, subject: n.subject, masteryScore: n.masteryScore, masteryLevel: n.masteryLevel, mistakes: n.mistakes });
  }

  // 事件按 occurredAt 排序（ISO 字符串可字典序比较）
  const sortedEvents = sortEventsByOccurredAt(events);
  const lastOccurredAt = sortedEvents.length > 0 ? sortedEvents[sortedEvents.length - 1].occurredAt : "";

  const contexts = new Map<string, NodeProjectionContext>();
  for (const event of sortedEvents) {
    foldEvent(contexts, event, nodeById);
  }

  const result: KnowledgeState[] = [];
  for (const n of nodes) {
    const ctx = contexts.get(n.id);
    if (!ctx) {
      // 无事件 → 初始锚点（当前节点状态）
      const initial = KNOWLEDGE_PROJECTION_RULES.createInitialAccumulator(n);
      result.push({
        nodeId: n.id,
        subjectId: n.subject,
        masteryScore: initial.masteryScore,
        masteryLevel: initial.masteryLevel,
        mistakes: initial.mistakes,
        reviewCount: 0,
        reviewRisk: initial.reviewRisk as Risk,
        forgetRisk: 0,
        lastReviewedAt: null,
        lastCardMastery: null,
        lastQuestionResult: null,
        eventCount: 0,
        sourceEventId: null,
        projectedAt: lastOccurredAt,
        derivedBy: "projectKnowledgeState:initial",
      });
      continue;
    }
    result.push({
      nodeId: n.id,
      subjectId: n.subject,
      masteryScore: ctx.accumulator.masteryScore,
      masteryLevel: ctx.accumulator.masteryLevel,
      mistakes: ctx.accumulator.mistakes,
      reviewCount: ctx.accumulator.reviewCount,
      reviewRisk: ctx.accumulator.reviewRisk as Risk,
      forgetRisk: ctx.accumulator.forgetRisk,
      lastReviewedAt: ctx.lastReviewedAt,
      lastCardMastery: ctx.lastCardMastery,
      lastQuestionResult: ctx.lastQuestionResult,
      eventCount: ctx.eventCount,
      sourceEventId: ctx.lastEventId,
      projectedAt: lastOccurredAt,
      derivedBy: "projectKnowledgeState:replay",
    });
  }

  return result;
}

/** 按 occurredAt 升序排序（确定性） */
export function sortEventsByOccurredAt(events: LearningEvent[]): LearningEvent[] {
  return [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}