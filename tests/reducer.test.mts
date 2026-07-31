/**
 * Sprint 2B-1 — computeOverallProgress reducer 测试
 * 覆盖：空数据 / 未知 subjectId / 权重 / 0 mastery / 未观测科目 skipped / 确定性 / coverage / legacy
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { KnowledgeState, Subject } from "../app/lib/types.ts";
import { computeOverallProgress, computeLegacyProgress } from "../app/lib/reducer.ts";

function makeSubject(name: string): Subject {
  return {
    id: `s-${name}`, name, type: "统考", maxScore: "100", targetScore: "80",
    currentProgress: "", currentMastery: "", weeklyHours: "8",
    hasPastPapers: false, hasSolutions: false, hasReferences: false,
    round: "第一轮", layer: "Layer 1", focus: "", risk: "正常",
  };
}
function makeState(subjectId: string, masteryScore: number): KnowledgeState {
  return {
    nodeId: `k-${subjectId}`, subjectId, masteryScore, masteryLevel: 2, mistakes: 0,
    reviewCount: 0, reviewRisk: "正常", forgetRisk: 0, lastReviewedAt: null,
    lastCardMastery: null, lastQuestionResult: null, eventCount: 1,
    sourceEventId: null, projectedAt: "", derivedBy: "test",
  };
}

test("空数据契约：states 空 → 0", () => {
  assert.deepEqual(computeOverallProgress([], [makeSubject("物理化学")]), { progress: 0, effectiveSubjects: 0, skippedSubjects: 1 });
});
test("空数据契约：subjects 空 → 0", () => {
  assert.deepEqual(computeOverallProgress([makeState("物理化学", 50)], []), { progress: 0, effectiveSubjects: 0, skippedSubjects: 0 });
});
test("未知 subjectId 忽略", () => {
  const r = computeOverallProgress([makeState("不存在", 100), makeState("物理化学", 50)], [makeSubject("物理化学")]);
  assert.equal(r.progress, 50);
  assert.equal(r.effectiveSubjects, 1);
  assert.equal(r.skippedSubjects, 0);
});
test("权重：多科目等权", () => {
  const r = computeOverallProgress([makeState("物理化学", 40), makeState("数学二", 60)], [makeSubject("物理化学"), makeSubject("数学二")]);
  assert.equal(r.progress, 50);
  assert.equal(r.effectiveSubjects, 2);
});
test("0 mastery：全 0 科目得 0 分", () => {
  const r = computeOverallProgress([makeState("物理化学", 0), makeState("物理化学", 0), makeState("数学二", 100)], [makeSubject("物理化学"), makeSubject("数学二")]);
  assert.equal(r.progress, 50);
});
test("未观测科目：skipped + 权重重归一化", () => {
  const r = computeOverallProgress([makeState("物理化学", 80)], [makeSubject("物理化学"), makeSubject("数学二")]);
  assert.equal(r.progress, 80);
  assert.equal(r.effectiveSubjects, 1);
  assert.equal(r.skippedSubjects, 1);
});
test("确定性：同输入同输出", () => {
  const subjects = [makeSubject("A"), makeSubject("B")];
  const states = [makeState("A", 40), makeState("B", 60)];
  assert.deepEqual(computeOverallProgress(states, subjects), computeOverallProgress(states, subjects));
});
test("coverage：全科目有 state → skipped=0", () => {
  const r = computeOverallProgress([makeState("A", 10), makeState("B", 20), makeState("C", 30)], [makeSubject("A"), makeSubject("B"), makeSubject("C")]);
  assert.equal(r.effectiveSubjects, 3);
  assert.equal(r.skippedSubjects, 0);
  assert.equal(r.progress, 20);
});
test("单科目多节点 → 科目内平均", () => {
  const r = computeOverallProgress([makeState("物理化学", 40), makeState("物理化学", 80)], [makeSubject("物理化学")]);
  assert.equal(r.progress, 60);
  assert.equal(r.effectiveSubjects, 1);
});
test("legacy 对照：公式与旧逻辑一致 (50×0.55+50%×0.25+50%×0.2=50)", () => {
  assert.equal(computeLegacyProgress([50, 50], 1, 2, 1, 2), 50);
});
test("legacy 对照：nodes 空 → 0", () => {
  assert.equal(computeLegacyProgress([], 1, 2, 1, 2), 0);
});