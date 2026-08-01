import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAnalyzeContent } from "../worker/analyze-exam.ts";

test("正常 JSON → 解析 cores/nodes 并按 frequency 降序", () => {
  const content = JSON.stringify({
    cores: [
      { name: "电化学", frequency: 3, questionRefs: ["2020 第5题"] },
      { name: "热力学", frequency: 7, questionRefs: ["2019 第1题", "2021 第2题"] },
    ],
    nodes: [
      { core: "热力学", branch: "熵", knowledge: "熵变计算", reason: "多次出现" },
    ],
  });
  const r = parseAnalyzeContent(content);
  assert.equal(r.cores.length, 2);
  assert.equal(r.cores[0].name, "热力学"); // 频次高的排前
  assert.equal(r.cores[0].frequency, 7);
  assert.equal(r.nodes.length, 1);
  assert.equal(r.nodes[0].knowledge, "熵变计算");
});

test("缺字段 / 脏数据 → 防御性默认，不抛错", () => {
  const content = JSON.stringify({
    cores: [
      { name: "有效", frequency: "5" }, // frequency 是字符串
      { name: "", frequency: 2 },        // 名称空 → 过滤
      { frequency: 1 },                   // 无 name → 过滤
    ],
    nodes: [
      { knowledge: "保留" },              // 缺 core/branch/reason → 补空串
      { core: "x", knowledge: "" },       // knowledge 空 → 过滤
    ],
  });
  const r = parseAnalyzeContent(content);
  assert.equal(r.cores.length, 1);
  assert.equal(r.cores[0].name, "有效");
  assert.equal(r.cores[0].frequency, 5); // 字符串数字被规整
  assert.deepEqual(r.cores[0].questionRefs, []); // 缺 questionRefs → []
  assert.equal(r.nodes.length, 1);
  assert.equal(r.nodes[0].core, "");
  assert.equal(r.nodes[0].knowledge, "保留");
});

test("cores/nodes 缺失或非数组 → 空数组", () => {
  const r = parseAnalyzeContent(JSON.stringify({ foo: 1 }));
  assert.deepEqual(r.cores, []);
  assert.deepEqual(r.nodes, []);
});

test("上限：cores≤8、nodes≤20", () => {
  const cores = Array.from({ length: 12 }, (_, i) => ({ name: `c${i}`, frequency: i, questionRefs: [] }));
  const nodes = Array.from({ length: 30 }, (_, i) => ({ core: "c", branch: "", knowledge: `k${i}`, reason: "" }));
  const r = parseAnalyzeContent(JSON.stringify({ cores, nodes }));
  assert.equal(r.cores.length, 8);
  assert.equal(r.nodes.length, 20);
});

test("非法 JSON → 抛错（由调用方转 502）", () => {
  assert.throws(() => parseAnalyzeContent("not json"));
});

test("非对象 JSON（数组）→ 抛错", () => {
  assert.throws(() => parseAnalyzeContent("[1,2,3]"));
});
