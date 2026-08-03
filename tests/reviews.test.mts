import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReviewSubjects,
  reviewMinutesOf,
  reviewCompletedCount,
  reviewNewNodesCount,
  reviewDoneQuestionsCount,
  reviewReviewedCardsCount,
  reviewMasteryAverage,
  buildReviewAiSummary,
  buildStructuredReview,
} from "../app/lib/reviews.ts";
import type { GrowthCard, KnowledgeNode, Question, Review, Task } from "../app/lib/types.ts";

function task(partial: Partial<Task> & { id: string; actualMinutes?: string }): Task {
  return {
    id: partial.id,
    title: partial.title ?? "任务",
    subject: partial.subject ?? "828 物理化学",
    core: partial.core ?? "热力学",
    branch: partial.branch ?? "",
    round: partial.round ?? "第一轮",
    layer: partial.layer ?? "Layer 1",
    source: partial.source ?? "",
    range: partial.range ?? "",
    minutes: partial.minutes ?? 60,
    standard: partial.standard ?? "",
    reason: partial.reason ?? "",
    backup: partial.backup ?? "",
    done: partial.done ?? false,
    actualMinutes: partial.actualMinutes ?? "",
    difficulty: partial.difficulty ?? "2",
    mastery: partial.mastery ?? "有些模糊",
    accuracy: partial.accuracy ?? "",
    needReview: partial.needReview ?? false,
    mood: partial.mood ?? "正常",
    note: partial.note ?? "",
    status: partial.status ?? "待开始",
    aiRecommended: partial.aiRecommended ?? false,
    aiReasonForgetRate: partial.aiReasonForgetRate ?? "",
    aiReasonLayerStable: partial.aiReasonLayerStable ?? "",
    aiReasonMistakeCount: partial.aiReasonMistakeCount ?? "",
    aiReasonExamFrequency: partial.aiReasonExamFrequency ?? "",
    estimatedCompletionMinutes: partial.estimatedCompletionMinutes ?? 60,
    masteryBefore: partial.masteryBefore ?? 0,
    masteryAfter: partial.masteryAfter ?? 0,
    startedAt: partial.startedAt ?? "",
    completedAt: partial.completedAt ?? "",
    relatedCardIds: partial.relatedCardIds ?? [],
    relatedQuestionIds: partial.relatedQuestionIds ?? [],
  };
}

test("buildReviewSubjects：全部 + 科目列表", () => {
  assert.deepEqual(buildReviewSubjects(["物理化学", "数学"]), ["全部科目", "物理化学", "数学"]);
});

test("reviewMinutesOf / reviewCompletedCount：只统计已完成任务", () => {
  const tasks = [
    task({ id: "t1", done: true, actualMinutes: "45" }),
    task({ id: "t2", done: true, actualMinutes: "30" }),
    task({ id: "t3", done: false, actualMinutes: "90" }),
    task({ id: "t4", done: true, actualMinutes: "" }),
  ];
  assert.equal(reviewMinutesOf(tasks), 75, "空分钟不计入");
  assert.equal(reviewCompletedCount(tasks), 3);
});

test("reviewNewNodesCount / reviewDoneQuestionsCount / reviewReviewedCardsCount", () => {
  const nodes = [
    { isMonthlyFocus: true } as KnowledgeNode,
    { isMonthlyFocus: false } as KnowledgeNode,
    { isMonthlyFocus: true } as KnowledgeNode,
  ];
  assert.equal(reviewNewNodesCount(nodes), 2);

  const questions = [
    { done: true } as Question,
    { done: false } as Question,
  ];
  assert.equal(reviewDoneQuestionsCount(questions), 1);

  const cards = [
    { lastReviewed: "未复习" } as GrowthCard,
    { lastReviewed: "2026-08-01" } as GrowthCard,
  ];
  assert.equal(reviewReviewedCardsCount(cards), 1);
});

test("reviewMasteryAverage：空列表返回 0，含 0 节点不崩溃", () => {
  assert.equal(reviewMasteryAverage([]), 0);
  assert.equal(reviewMasteryAverage([{ masteryScore: 40 } as KnowledgeNode, { masteryScore: 80 } as KnowledgeNode]), 60);
});

test("buildReviewAiSummary：与统计函数联动", () => {
  const tasks = [task({ id: "t1", done: true })];
  const nodes = [{ masteryScore: 50 } as KnowledgeNode];
  assert.equal(buildReviewAiSummary(tasks, nodes), "今日完成 1 个任务，掌握度变化 50%。");
});

test("buildStructuredReview：空复盘返回 null（无空记录）", () => {
  const empty: Review = { done: "", hard: "", load: "刚好", tomorrow: "3 小时", priority: "" };
  assert.equal(buildStructuredReview(empty), null);
});

test("buildStructuredReview：解析完成/困难/负荷/可用时间", () => {
  const review: Review = { done: "熵变计算、相律判断", hard: "自由度计算", load: "刚好", tomorrow: "2 小时", priority: "高" };
  const mkId = (prefix: string) => `${prefix}-test`;
  const now = () => "2026-08-02T12:00:00.000Z";
  const structured = buildStructuredReview(review, mkId, now);
  assert.ok(structured);
  assert.equal(structured.id, "sr-test");
  assert.equal(structured.date, "2026-08-02T12:00:00.000Z");
  assert.deepEqual(structured.parsed.content, ["熵变计算", "相律判断"]);
  assert.deepEqual(structured.parsed.difficulty, ["自由度计算"]);
  assert.equal(structured.parsed.availableMinutes, 120);
  assert.equal(structured.parsed.loadLevel, "刚好");
  assert.equal(structured.parsed.completionRates.length, 2);
  assert.ok(structured.aiSummary.includes("完成内容：熵变计算、相律判断"));
  assert.ok(structured.aiSummary.includes("计划负荷适中"));
});