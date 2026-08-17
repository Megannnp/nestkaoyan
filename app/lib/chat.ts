import type { AgentMessage, ChatSession } from "./types.ts";
import { makeId } from "./utils.ts";

/**
 * 聊天会话域纯逻辑（从 page.tsx 抽取，便于离线单测与复用，降低上帝组件体积）。
 * 仅包含 Session/消息的不可变 reducer 与 Prompt 意图分类纯函数；副作用（setState/toast）由组件层执行。
 */

/** 旧版 chat 数组 → 单一 ChatSession 迁移（不丢失历史；空/非数组返回 null） */
export function migrateLegacyChat(
  chat: unknown,
  mkId: (prefix: string) => string = makeId,
  now: () => number = Date.now,
): ChatSession | null {
  if (!Array.isArray(chat) || chat.length === 0) return null;
  const messages: AgentMessage[] = (chat as unknown[]).map((item) => {
    const m = item as { id?: string; role?: string; text?: string; content?: string; createdAt?: string; updatedAt?: string; messageType?: string };
    return {
      id: m.id || mkId("m"),
      role: (m.role === "user" || m.role === "assistant" || m.role === "system") ? m.role : "assistant",
      content: m.content ?? m.text ?? "",
      createdAt: m.createdAt || new Date(now()).toISOString(),
      updatedAt: m.updatedAt,
      messageType: (m.messageType === "chat" || m.messageType === "action" || m.messageType === "record") ? m.messageType : "chat",
    };
  });
  const legacyIndex = now();
  return {
    id: `s-${legacyIndex}-legacy`,
    title: "对话历史",
    createdAt: new Date(legacyIndex).toISOString(),
    messages,
  };
}

/** 创建新 ChatSession（纯函数；sessionId 由调用方注入以保证与 ref/state 一致） */
export function createChatSession(
  sessionId: string,
  now: () => string = () => new Date().toISOString(),
): ChatSession {
  return { id: sessionId, title: "新对话", createdAt: now(), messages: [], status: "active" };
}

/** 创建一条 AgentMessage（纯函数） */
export function createMessage(
  role: AgentMessage["role"],
  content: string,
  messageType: NonNullable<AgentMessage["messageType"]> = "chat",
  mkId: (prefix: string) => string = makeId,
  now: () => string = () => new Date().toISOString(),
): AgentMessage {
  return { id: mkId("m"), role, content, createdAt: now(), messageType };
}

/** 往指定 Session 追加一条消息（不可变 reducer；无该 Session 时原样返回） */
export function appendMessage(
  sessions: ChatSession[],
  sessionId: string,
  message: AgentMessage,
): ChatSession[] {
  return sessions.map((s) => s.id === sessionId ? { ...s, messages: [...s.messages, message] } : s);
}

// ─── Prompt 意图路由（runPrompt 的纯分类部分）───

export type PromptIntent =
  | { type: "notes" }             // 笔记/总结
  | { type: "plan" }              // 今天学什么 / 今日计划
  | { type: "agent-workflow" }    // 分析真题 + 更新/重排
  | { type: "exam-analysis" }     // 分析真题
  | { type: "search-questions" }  // 找真题
  | { type: "mistake-analysis" }  // 错因分析
  | { type: "review-cards" }      // 复习
  | { type: "create-card" }       // 生成卡片
  | { type: "round-info" }        // 第几轮
  | { type: "fallback" };         // 兜底

/**
 * 将用户 Prompt 分类为意图（纯函数，无副作用）。
 * 优先级与 page.tsx runPrompt 完全一致：
 *   笔记 > 今日计划 > 真题更新重排 > 真题分析 > 检索 > 错因 > 复习 > 卡片 > 轮次 > 兜底
 * 要点：「把今天整理成笔记」含「今天」，必须由「笔记/总结」分支优先匹配，否则会被误转发为「生成今日计划」。
 */
export function classifyPromptIntent(text: string): PromptIntent {
  if (text.includes("笔记") || text.includes("总结")) return { type: "notes" };
  if (text.includes("今天") || text.includes("学什么")) return { type: "plan" };
  if (text.includes("分析") && text.includes("真题") && (text.includes("更新") || text.includes("重排"))) return { type: "agent-workflow" };
  if (text.includes("分析") && text.includes("真题")) return { type: "exam-analysis" };
  if (text.includes("真题") && text.includes("找")) return { type: "search-questions" };
  // 错因分析：仅匹配明确的错因/错题意图，避免「没错」「搞错了」等口语误触发
  if (/错因|错题|错误分析|为什么.*错|总.*错|老是错|老错|做错|容易错|错在|不会做|不会.*这道|这道.*不会|这题.*不会|不会.*题/.test(text)) return { type: "mistake-analysis" };
  if (text.includes("复习")) return { type: "review-cards" };
  if (text.includes("卡片") || text.includes("填空卡") || text.includes("公式卡")) return { type: "create-card" };
  if (text.includes("第几轮")) return { type: "round-info" };
  return { type: "fallback" };
}