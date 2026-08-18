import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePlanContent } from "../worker/plan-generate.ts";

test("解析合法 JSON：summary + tasks 排序", () => {
  const p = parsePlanContent(JSON.stringify({
    summary: "今日集中复习高风险熵变",
    tasks: [
      { title: "熵变计算", subject: "828 物理化学", core: "热力学", knowledge: "熵变", round: "第一轮", layer: "Layer 2", minutes: 90, reason: "高风险", priority: 2 },
      { title: "相律判断", subject: "828 物理化学", core: "相平衡", knowledge: "自由度", round: "第一轮", layer: "Layer 1", minutes: 45, reason: "错题多", priority: 1 },
    ],
  }));
  assert.equal(p.summary, "今日集中复习高风险熵变");
  assert.equal(p.tasks.length, 2);
  assert.equal(p.tasks[0].priority, 1);
  assert.equal(p.tasks[1].priority, 2);
});

test("防御：非法 JSON / 非对象 / 空项过滤", () => {
  assert.throws(() => parsePlanContent("{ 非法"));
  assert.throws(() => parsePlanContent("[1,2]"), /非对象/);
  const empty = parsePlanContent(JSON.stringify({ summary: "", tasks: [] }));
  assert.equal(empty.tasks.length, 0);
  const filtered = parsePlanContent(JSON.stringify({ summary: "s", tasks: [
    { title: "" },
    { title: "有效任务", minutes: 30 },
  ] }));
  assert.equal(filtered.tasks.length, 1);
  assert.equal(filtered.tasks[0].title, "有效任务");
});

test("防御：minutes/priority 越界修正 + 截断", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ title: `任务${i}`, minutes: 999, priority: i }));
  const p = parsePlanContent(JSON.stringify({ summary: "长".repeat(300), tasks: many }));
  assert.equal(p.tasks.length, 8, "截断至 8 条");
  assert.equal(p.summary.length, 200, "summary 截断 200");
  assert.equal(p.tasks[0].minutes, 120, "minutes 上限 120");
  assert.equal(p.tasks[0].priority, 1, "priority 至少 1");
});