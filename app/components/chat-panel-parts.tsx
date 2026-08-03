"use client";

import type { AgentMessage, ChatSession } from "../lib/types";
import { formatMessageTime } from "../lib/utils";

/** 消息类型标签与图标 */
const MESSAGE_TYPE_LABELS: Record<NonNullable<AgentMessage["messageType"]>, { label: string; dot: string; bg: string; border: string }> = {
  chat: { label: "AI 建议", dot: "💡", bg: "#F4F4F5", border: "#E4E4E7" },
  action: { label: "系统操作", dot: "⚙️", bg: "#F5F3FF", border: "#EDE9FE" },
  record: { label: "数据记录", dot: "📝", bg: "#F0FDF4", border: "#DCFCE7" },
};

/** 会话状态图标 */
const SESSION_STATUS_ICONS: Record<NonNullable<ChatSession["status"]>, string> = {
  active: "🟢",
  completed: "⚪",
  paused: "🟡",
};

/** 同一分钟内连续的多条系统消息 → 合并显示一次时间 */
function sameMinute(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate() && da.getHours() === db.getHours() && da.getMinutes() === db.getMinutes();
}

/** 会话历史按时间分组：今天 / 昨天 / 最近7天 / 本月 / 更早 */
function groupSessions(sessions: ChatSession[]): { label: string; list: ChatSession[] }[] {
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA");
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString("en-CA");
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const weekStartStr = weekStart.toLocaleDateString("en-CA");
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartStr = monthStart.toLocaleDateString("en-CA");

  const groups: { label: string; list: ChatSession[] }[] = [
    { label: "今天", list: [] },
    { label: "昨天", list: [] },
    { label: "最近7天", list: [] },
    { label: "本月", list: [] },
    { label: "更早", list: [] },
  ];
  for (const s of sessions) {
    const d = s.createdAt.slice(0, 10);
    if (d === todayStr) groups[0].list.push(s);
    else if (d === yesterdayStr) groups[1].list.push(s);
    else if (d >= weekStartStr) groups[2].list.push(s);
    else if (d >= monthStartStr) groups[3].list.push(s);
    else groups[4].list.push(s);
  }
  return groups.filter((g) => g.list.length > 0);
}

/** 单条消息渲染（标准 IM：用户右侧 / AI 左侧 / 系统弱化 / 类型标签 / 新消息动画） */
function MessageBubble({ message, index, sessionMessages }: { message: AgentMessage; index: number; sessionMessages: AgentMessage[] }) {
  const prev = sessionMessages[index - 1];
  const showTime = !(message.role === "system" && prev && prev.role === "system" && sameMinute(message.createdAt, prev.createdAt));
  const typeInfo = message.messageType ? MESSAGE_TYPE_LABELS[message.messageType] : null;

  if (message.role === "system") {
    return (
      <div className="flex flex-col items-center my-1.5 message-fade-in">
        <span className="text-[11px] text-[#A1A1AA] bg-[#F4F4F5] px-2 py-0.5 rounded-full max-w-[85%] text-center leading-snug">
          {typeInfo?.dot ? `${typeInfo.dot} ` : ""}{message.content}
        </span>
        {showTime && <span className="text-[10px] text-[#D4D4D8] mt-0.5">{formatMessageTime(message.createdAt)}</span>}
      </div>
    );
  }

  const isUser = message.role === "user";
  const roleLabel = isUser ? "我" : (typeInfo?.label ?? "AI");
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3 message-fade-in`}>
      <div className={`max-w-[80%] min-w-[120px] rounded-[12px] px-3 py-2 ${isUser ? "bg-[#18181B] text-white rounded-br-[4px]" : "bg-white border border-[#E4E4E7] rounded-bl-[4px]"}`}>
        <div className="flex items-center gap-1.5 mb-0.5">
          {!isUser && typeInfo && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: typeInfo.bg, color: "#52525B", border: `1px solid ${typeInfo.border}` }}
            >
              {typeInfo.dot} {roleLabel}
            </span>
          )}
          {isUser && <span className="text-[10px] text-white/70 font-bold">{roleLabel}</span>}
          <span className={`text-[10px] ${isUser ? "text-white/60" : "text-[#A1A1AA]"}`}>{formatMessageTime(message.createdAt)}</span>
        </div>
        <p className="text-[13px] whitespace-pre-wrap leading-relaxed">{message.content}</p>
      </div>
    </div>
  );
}

export { MESSAGE_TYPE_LABELS, SESSION_STATUS_ICONS, groupSessions, MessageBubble };
