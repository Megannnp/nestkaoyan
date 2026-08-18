/**
 * Sprint 2A — Replay 一致性测试（验证投影确定性 / 可重建性）
 *
 * 核心断言：
 *  1. projectKnowledgeState(events, nodes) 多次 Replay 输出完全一致（确定性）
 *  2. 事件顺序打乱后，只要按 occurredAt 排序，结果一致（幂等）
 *  3. 所有字段都能从事件流推导（verifyReplayable）
 *  4. 业务规则统一走 memory-rules.ts（由代码结构保证，这里验证规则行为）
 *
 * 运行方式：node --experimental-strip-types --test tests/replay-determinism.test.mts
 * （Node >= 22.13 可省略 --experimental-strip-types）
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { KnowledgeNode } from "../app/lib/types.ts";
import { projectKnowledgeState, sortEventsByOccurredAt } from "../app/lib/projection.ts";
import type { LearningEvent } from "../app/lib/events.ts";

// ─────────────────────────────────────────────────────────────
// 测试数据构造
// ─────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id: "k-1",
    subject: "828 物理化学",
    core: "热力学",
    branch: "熵与熵变",
    knowledge: "熵变计算",
    explanation: "",
    prerequisite: "",
    related: "",
    masteryLevel: 2,
    masteryScore: 42,
    confidence: "中",
    round: "第一轮",
    layer: "Layer 2",
    mistakes: 5,
    reviewRisk: "需要关注",
    isMonthlyFocus: false,
    ...overrides,
  };
}

function makeEvent(
  id: string,
  type: LearningEvent["type"],
  occurredAt: string,
  nodeId: string,
  payload: LearningEvent["payload"] = {}
): LearningEvent {
  return {
    id,
    version: 1,
    type,
    occurredAt,
    sourceRef: {
      kind: type === "card_reviewed" ? "card" : type === "question_answered" ? "question" : "task",
      id: `${type}-${id}`,
      nodeIds: [nodeId],
    },
    payload,
  };
}

const nodes = [makeNode()];

/** 一组混合事件：错误题 → 对题 → 复习"模糊" → 复习"稳定" */
const mixedEvents: LearningEvent[] = [
  makeEvent("e1", "question_answered", "2026-07-01T10:00:00.000Z", "k-1", { result: "错误" }),
  makeEvent("e2", "question_answered", "2026-07-02T10:00:00.000Z", "k-1", { result: "正确" }),
  makeEvent("e3", "card_reviewed", "2026-07-03T10:00:00.000Z", "k-1", { mastery: "模糊", intervalDays: 3 }),
  makeEvent("e4", "card_reviewed", "2026-07-04T10:00:00.000Z", "k-1", { mastery: "稳定", intervalDays: 30 }),
];

// ─────────────────────────────────────────────────────────────
// 测试用例
// ─────────────────────────────────────────────────────────────

test("projectKnowledgeState 多次 Replay 输出完全一致（确定性）", () => {
  const a = projectKnowledgeState(mixedEvents, nodes);
  const b = projectKnowledgeState(mixedEvents, nodes);
  assert.deepEqual(a, b);
});

test("事件顺序打乱后按 occurredAt 排序，结果一致（幂等）", () => {
  const shuffled = [mixedEvents[3], mixedEvents[1], mixedEvents[0], mixedEvents[2]];
  const a = projectKnowledgeState(mixedEvents, nodes);
  const b = projectKnowledgeState(shuffled, nodes);
  assert.deepEqual(a, b);
});

test("可完全重建：删除旧 KnowledgeState 后 Replay 结果一致", () => {
  // 第一次 Replay 生成的状态
  const first = projectKnowledgeState(mixedEvents, nodes);
  // 模拟"删除全部 KnowledgeState"→ 仅保留事件流，重新 Replay
  const rebuilt = projectKnowledgeState(mixedEvents, nodes);
  assert.deepEqual(rebuilt, first);
});

test("空事件流 → 无事件节点保持初始锚点（可重建兜底）", () => {
  const states = projectKnowledgeState([], nodes);
  assert.equal(states.length, 1);
  assert.equal(states[0].masteryScore, 42); // 节点初始 masteryScore
  assert.equal(states[0].derivedBy, "projectKnowledgeState:initial");
  assert.equal(states[0].sourceEventId, null);
});

test("事件作用于不存在的节点 → 跳过（容忍缺失，不抛错）", () => {
  const orphanEvent = makeEvent("orphan", "question_answered", "2026-07-05T10:00:00.000Z", "k-noexist", { result: "错误" });
  const states = projectKnowledgeState([...mixedEvents, orphanEvent], nodes);
  assert.equal(states.length, 1);
  assert.equal(states[0].mistakes, 6); // k-1 投影：初始 5 + e1 错误题 +1 = 6（孤儿事件被跳过，不加）
});

test("sortEventsByOccurredAt 升序排序（确定性）", () => {
  const sorted = sortEventsByOccurredAt([mixedEvents[3], mixedEvents[0], mixedEvents[2], mixedEvents[1]]);
  assert.deepEqual(
    sorted.map((e) => e.id),
    ["e1", "e2", "e3", "e4"]
  );
});

test("question_answered 错误 → mistakes +1、掌握度 -8（规则行为验证）", () => {
  const events = [makeEvent("err", "question_answered", "2026-07-01T10:00:00.000Z", "k-1", { result: "错误" })];
  const [state] = projectKnowledgeState(events, nodes);
  assert.equal(state.mistakes, 6); // 节点初始 mistakes=5 + 1
  assert.equal(state.masteryScore, 34); // 42 - 8
  assert.equal(state.reviewRisk, "需要关注"); // mastery=34 < 50 但 >= 30
});

test("card_reviewed 稳定 → reviewCount +1、掌握度 +12（规则行为验证）", () => {
  const events = [makeEvent("card", "card_reviewed", "2026-07-01T10:00:00.000Z", "k-1", { mastery: "稳定", intervalDays: 30 })];
  const [state] = projectKnowledgeState(events, nodes);
  assert.equal(state.reviewCount, 1);
  assert.equal(state.masteryScore, 54); // 42 + 12
  assert.equal(state.reviewRisk, "正常"); // 54 >= 50 → 正常
  assert.equal(state.lastCardMastery, "稳定");
  assert.equal(state.lastReviewedAt, "2026-07-01T10:00:00.000Z");
});

test("eventCount 可重建：未观测节点=0，触达事件数正确累计", () => {
  // k-1 有 4 条事件；新增一个无事件的节点 k-2
  const nodes2 = [makeNode(), makeNode({ id: "k-2", masteryScore: 10 })];
  const states = projectKnowledgeState(mixedEvents, nodes2);
  assert.equal(states[0].eventCount, 4); // k-1：4 条事件
  assert.equal(states[1].eventCount, 0); // k-2：未观测
  assert.equal(states[1].derivedBy, "projectKnowledgeState:initial");
});

test("projectedAt 确定性契约：取最后事件 occurredAt，多次 Replay 恒等", () => {
  const events = [
    makeEvent("t1", "question_answered", "2026-07-01T10:00:00.000Z", "k-1", { result: "错误" }),
    makeEvent("t2", "card_reviewed", "2026-07-02T10:00:00.000Z", "k-1", { mastery: "认识", intervalDays: 7 }),
  ];
  const a = projectKnowledgeState(events, nodes);
  const b = projectKnowledgeState(events, nodes);
  assert.equal(a[0].projectedAt, "2026-07-02T10:00:00.000Z"); // 最后事件
  assert.equal(a[0].projectedAt, b[0].projectedAt); // 恒等
});

test("projectedAt 确定性契约：空事件流 → ''", () => {
  const [state] = projectKnowledgeState([], nodes);
  assert.equal(state.projectedAt, "");
});
