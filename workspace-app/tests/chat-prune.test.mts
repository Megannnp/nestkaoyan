/**
 * 聊天容量上限（chat.ts pruneChatSessions / appendMessage）单元测试
 * 防止工作区 JSON 随聊天无界膨胀。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createChatSession, createMessage, appendMessage, pruneChatSessions } from "../app/lib/chat.ts";
import { CHAT_MAX_MESSAGES_PER_SESSION, CHAT_MAX_SESSIONS } from "../app/lib/rules.ts";

test("appendMessage 裁剪超过单会话上限的消息（保留最新）", () => {
  let sessions = [createChatSession("s1")];
  const total = CHAT_MAX_MESSAGES_PER_SESSION + 5;
  for (let i = 0; i < total; i++) {
    sessions = appendMessage(sessions, "s1", createMessage("user", `m${i}`));
  }
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].messages.length, CHAT_MAX_MESSAGES_PER_SESSION);
  // 最新保留在末尾
  assert.equal(sessions[0].messages[sessions[0].messages.length - 1].content, `m${total - 1}`);
  // 最旧被裁掉（85 - 80 = 5 条）
  assert.equal(sessions[0].messages[0].content, "m5");
});

test("pruneChatSessions 裁剪超过上限的最旧会话（新在前，保留最新）", () => {
  const sessions = Array.from({ length: CHAT_MAX_SESSIONS + 5 }, (_, i) => createChatSession(`s${i}`));
  const pruned = pruneChatSessions(sessions);
  assert.equal(pruned.length, CHAT_MAX_SESSIONS);
  assert.equal(pruned[0].id, "s0");
  assert.equal(pruned[pruned.length - 1].id, `s${CHAT_MAX_SESSIONS - 1}`);
});

test("pruneChatSessions 未超限时原样保留", () => {
  const sessions = Array.from({ length: 3 }, (_, i) => createChatSession(`s${i}`));
  assert.equal(pruneChatSessions(sessions).length, 3);
});
