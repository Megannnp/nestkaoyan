"use client";

import type { AgentMessage, ChatSession } from "../lib/types";
import { formatMessageTime } from "../lib/utils";
import { LatexContent } from "./LatexContent";

/** 消息类型标签与图标 */
const MESSAGE_TYPE_LABELS: Record<NonNullable<AgentMessage["messageType"]>, { label: string; dot: string; bg: string; border: string }> = {
  chat: { label: "AI 建议", dot: "💡", bg: "#F4F4F5", border: "#E4E4E7" },
  action: { label: "系统操作", dot: "⚙️", bg: "#F5F3FF", border: "#EDE9FE" },
  record: { label: "数据记录", dot: "📝", bg: "#F4F4F5", border: "#E4E4E7" },
};

/** 会话状态图标（2026-08-05：去掉彩色 emoji，改黑白灰中性圆点配色） */
const SESSION_STATUS_ICONS: Record<NonNullable<ChatSession["status"]>, string> = {
  active: "学习中",
  completed: "已完成",
  paused: "已暂停",
};

/** 会话状态圆点配色（中性黑白灰） */
export const SESSION_STATUS_DOT: Record<NonNullable<ChatSession["status"]>, string> = {
  active: "bg-[#18181B]",
  completed: "bg-[#D4D4D8]",
  paused: "bg-[#52525B]",
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

/** 单条消息渲染（标准 IM：用户右侧 / AI 左侧 / 系统居中弱化。
 *  2026-08-05：去掉「AI建议/系统操作/数据记录」类型标签；时间仿微信放气泡外居中，不放气泡内） */
function MessageBubble({ message, index, sessionMessages }: { message: AgentMessage; index: number; sessionMessages: AgentMessage[] }) {
  const prev = sessionMessages[index - 1];
  const showTime = !(message.role === "system" && prev && prev.role === "system" && sameMinute(message.createdAt, prev.createdAt));
  // 同一分钟内上一条消息已显示过时间 → 本条不再重复显示（仿微信合并）
  const lastNonSystem = [...sessionMessages].slice(0, index).reverse().find((m) => m.role !== "system");
  const showBubbleTime = !lastNonSystem || !sameMinute(message.createdAt, lastNonSystem.createdAt);

  if (message.role === "system") {
    return (
      <div className="flex flex-col items-center my-1.5 message-fade-in">
        {/* 仿微信：时间居中在气泡外 */}
        {showTime && <span className="text-[10px] text-[#A1A1AA] mb-1">{formatMessageTime(message.createdAt)}</span>}
        <span className="text-[11px] text-[#52525B] bg-[#F4F4F5] px-2 py-0.5 rounded-full max-w-[85%] text-center leading-snug">
          {message.content}
        </span>
      </div>
    );
  }

  const isUser = message.role === "user";
  return (
    <div className="flex flex-col mb-3 message-fade-in">
      {/* 仿微信：时间居中在气泡外（同分钟多条只显示第一条时间） */}
      {showBubbleTime && (
        <div className="flex justify-center mb-1">
          <span className="text-[10px] text-[#A1A1AA]">{formatMessageTime(message.createdAt)}</span>
        </div>
      )}
      <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        <div className={`max-w-[80%] min-w-[60px] rounded-[12px] px-3 py-2 ${isUser ? "bg-[#18181B] text-white rounded-br-[4px]" : "bg-white border border-[#E4E4E7] rounded-bl-[4px]"}`}>
          <div className="text-[13px] whitespace-pre-wrap leading-relaxed">
            <LatexContent text={message.content} />
          </div>
        </div>
      </div>
    </div>
  );
}

export { MESSAGE_TYPE_LABELS, SESSION_STATUS_ICONS, groupSessions, MessageBubble };
