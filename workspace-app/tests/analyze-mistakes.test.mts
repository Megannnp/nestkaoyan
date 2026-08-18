/**
 * analyze-mistakes 离线单测：验证 parseMistakeContent 结构化解析与防御性校验（不打网络）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMistakeContent } from "../worker/analyze-mistakes.ts";

test("解析合法 JSON：summary + mistakes 数组", () => {
  const content = JSON.stringify({
    summary: "错因集中在适用条件判断。",
    mistakes: [
      { reason: "条件判断错误", detail: "混淆了恒温与绝热过程", questionRef: "2023 第 6 题", suggestion: "重看适用条件并做 3 题专项" },
      { reason: "概念混淆", detail: "熵与焓定义混用", questionRef: "2022 第 3 题", suggestion: "复习熵变公式推导" },
    ],
  });

  const parsed = parseMistakeContent(content);

  assert.equal(parsed.summary, "错因集中在适用条件判断。");
  assert.equal(parsed.mistakes.length, 2);
  assert.equal(parsed.mistakes[0].reason, "条件判断错误");
  assert.equal(parsed.mistakes[0].suggestion, "重看适用条件并做 3 题专项");
  assert.equal(parsed.mistakes[1].detail, "熵与焓定义混用");
});

test("防御：非对象 JSON / 缺失字段 / 空项过滤", () => {
  // 数组 → 抛错
  assert.throws(() => parseMistakeContent("[1,2,3]"), /非对象/);
  // 仅字符串 → 抛错
  assert.throws(() => parseMistakeContent('"hello"'), /非对象/);

  // 非法 JSON → 抛错
  assert.throws(() => parseMistakeContent("{ 这不是有效 JSON"));

  // 空 mistakes → 返回空数组
  const empty = parseMistakeContent(JSON.stringify({ summary: "", mistakes: [] }));
  assert.equal(empty.mistakes.length, 0);

  // 全空项 → 被过滤
  const filtered = parseMistakeContent(JSON.stringify({
    summary: "s",
    mistakes: [
      { reason: "", detail: "", questionRef: "", suggestion: "" },
      { reason: "方法不熟", detail: "d", questionRef: "r", suggestion: "sug" },
    ],
  }));
  assert.equal(filtered.mistakes.length, 1);
  assert.equal(filtered.mistakes[0].reason, "方法不熟");
});

test("防御：mistakes 截断至 8 条、summary 截断至 200 字", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    reason: `错因${i}`,
    detail: "d",
    questionRef: `q${i}`,
    suggestion: "s",
  }));
  const parsed = parseMistakeContent(JSON.stringify({ summary: "长".repeat(300), mistakes: many }));
  assert.equal(parsed.mistakes.length, 8, "mistakes 应截断至 8 条");
  assert.equal(parsed.summary.length, 200, "summary 应截断至 200 字");
});

test("防御：Reason 外的多余字段被忽略；detail 为数字时转字符串", () => {
  const parsed = parseMistakeContent(JSON.stringify({
    summary: "s",
    mistakes: [
      { reason: "计算失误", detail: 42, questionRef: "q", suggestion: "sug", extra: "忽略" },
    ],
  }));
  assert.equal(parsed.mistakes.length, 1);
  assert.equal(parsed.mistakes[0].detail, "42", "detail 数字应转字符串");
});