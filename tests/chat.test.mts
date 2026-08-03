import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyPromptIntent,
  createChatSession,
  createMessage,
  appendMessage,
  migrateLegacyChat,
} from "../app/lib/chat.ts";

test("migrateLegacyChat：旧 chat 数组迁移为单一 Session，字段规范化", () => {
  const fixedNow = 1785680409838;
  const session = migrateLegacyChat([
    { role: "user", text: "今天学什么" },
    { role: "assistant", content: "好的" },
    { role: "weird", text: "非法角色" },
  ], (prefix) => `${prefix}-fixed`, () => fixedNow);
  assert.ok(session);
  assert.equal(session.id, `s-${fixedNow}-legacy`);
  assert.equal(session.title, "对话历史");
  assert.equal(session.messages.length, 3);
  assert.equal(session.messages[0].role, "user");
  assert.equal(session.messages[0].content, "今天学什么");
  assert.equal(session.messages[1].content, "好的");
  assert.equal(session.messages[2].role, "assistant", "非法角色回退 assistant");
  assert.equal(session.messages[0].id, "m-fixed");
});

test("migrateLegacyChat：空/非数组返回 null", () => {
  assert.equal(migrateLegacyChat([]), null);
  assert.equal(migrateLegacyChat("not-an-array"), null);
  assert.equal(migrateLegacyChat(undefined), null);
});

test("createChatSession / createMessage / appendMessage：不可变 reducer", () => {
  const now = () => "2026-08-02T12:00:00.000Z";
  const s = createChatSession("s-1", now);
  assert.equal(s.title, "新对话");
  assert.equal(s.status, "active");
  assert.deepEqual(s.messages, []);

  const msg = createMessage("user", "你好", "chat", () => "m-1", now);
  assert.equal(msg.id, "m-1");
  assert.equal(msg.role, "user");
  assert.equal(msg.messageType, "chat");

  const next = appendMessage([s], "s-1", msg);
  assert.equal(next[0].messages.length, 1);
  assert.equal(s.messages.length, 0, "原数组不被修改");
  assert.equal(next[0].messages[0].content, "你好");

  const untouched = appendMessage([s], "s-missing", msg);
  assert.equal(untouched.length, 1);
  assert.equal(untouched[0].messages.length, 0, "Session 不存在时原样返回");
});

test("classifyPromptIntent：笔记分支优先于「今天」（关键回归）", () => {
  assert.deepEqual(classifyPromptIntent("把今天整理成笔记"), { type: "notes" });
  assert.deepEqual(classifyPromptIntent("总结今天所学"), { type: "notes" });
});

test("classifyPromptIntent：11 个意图全覆盖", () => {
  assert.deepEqual(classifyPromptIntent("今天学什么"), { type: "plan" });
  assert.deepEqual(classifyPromptIntent("帮我安排今天的计划"), { type: "plan" });
  assert.deepEqual(classifyPromptIntent("分析最近三套真题，更新图谱并重排计划"), { type: "agent-workflow" });
  assert.deepEqual(classifyPromptIntent("分析这套真题"), { type: "exam-analysis" });
  assert.deepEqual(classifyPromptIntent("找近五年化学势真题"), { type: "search-questions" });
  assert.deepEqual(classifyPromptIntent("傅献彩哪里讲这个"), { type: "fu-suggest" });
  assert.deepEqual(classifyPromptIntent("为什么总错这类题"), { type: "mistake-analysis" });
  assert.deepEqual(classifyPromptIntent("开始复习"), { type: "review-cards" });
  assert.deepEqual(classifyPromptIntent("生成一张公式卡"), { type: "create-card" });
  assert.deepEqual(classifyPromptIntent("我现在属于第几轮"), { type: "round-info" });
  assert.deepEqual(classifyPromptIntent("随便聊聊"), { type: "fallback" });
});