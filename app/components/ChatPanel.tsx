import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { ChatSession } from "../lib/types";
import { saveUiState } from "../lib/storage";
import { formatMessageTime } from "../lib/utils";
import styles from "../../styles/components.module.css";
import { MESSAGE_TYPE_LABELS, SESSION_STATUS_ICONS, groupSessions, MessageBubble } from "./chat-panel-parts";

/**
 * AI 学习助手（Conversation UX v2）
 *
 * 参考 ChatGPT / Cursor / Claude / Notion AI 的三栏固定布局：
 *   ┌────────────────┬──────────────┐
 *   │ 顶部（学习上下文）│              │
 *   ├────────────────┤  历史会话列表 │
 *   │ 聊天记录（滚动） │  （独立滚动）  │
 *   ├────────────────┤              │
 *   │ 输入框（固定）   │              │
 *   └────────────────┴──────────────┘
 *
 * - 整个页面高度固定，只有聊天记录与历史列表内部滚动
 * - 历史按 今天 / 昨天 / 最近7天 / 本月 / 更早 自动分组
 * - 首条用户消息后自动生成会话标题
 * - 当前会话明显高亮，切换立即刷新
 * - 发送后自动滚动到底部；新消息带淡入动画
 * - Enter 发送 / Shift+Enter 换行 / 输入框自动增高（最多 8 行）
 * - 快捷问题仅在空聊天时显示
 * - 会话项更多菜单（⋯）：仅点击 ⋯ 打开；Portal 挂到 body（fixed 定位），
 *   避免被 overflow 滚动容器裁切；按剩余空间自动向上/向下展开
 * - 历史会话滚动状态：新建会话滚顶、切换滚入可视、手动滚动保存位置、打开菜单不跳动
 * - 学习上下文改为消息内联显示（不再常驻顶部状态栏——UX 减法）
 * - 消息类型视觉区分（AI 建议 / 系统操作 / 数据记录）
 */


interface ChatPanelProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onSend: (content: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onDeleteSession: (id: string) => void;
  onTogglePinned?: (id: string) => void;
  onUpdateSessionStatus?: (id: string, status: NonNullable<ChatSession["status"]>) => void;
  historyOpen: boolean;
  setHistoryOpen: (open: boolean) => void;
}

export function ChatPanel({
  sessions, activeSessionId,
  onSelectSession, onNewSession, onSend,
  onRenameSession, onDeleteSession, onTogglePinned, onUpdateSessionStatus,
  historyOpen, setHistoryOpen,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  // 更多菜单：仅通过 ⋯ 按钮点击打开；同一时间只开一个（null = 全部关闭）
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  // ⋯ 按钮 ref（计算菜单位置与展开方向）
  const menuButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  // Portal 菜单 fixed 定位（相对 viewport；不放在 overflow 容器内，避免被裁切）
  const [menuRect, setMenuRect] = useState<{ top: number; right: number; width: number } | null>(null);
  // P3 交互修复（2026-08-01）：定制内联重命名 + 两阶段删除会话（替代原生 prompt/confirm）
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // 手动滚动标记（新建/切换自动滚动时跳过保存）
  const userScrollingRef = useRef(false);

  // 新消息自动滚动到底部 + 平滑滚动（仅聊天区）
  const prevMsgCount = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const count = activeSession?.messages.length ?? 0;
    const isNew = count > prevMsgCount.current;
    prevMsgCount.current = count;
    if (isNew) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [activeSessionId, activeSession?.messages.length]);

  // 点击菜单外部（且不在 ⋯ 按钮 / Portal 菜单内）→ 关闭菜单
  useEffect(() => {
    if (!menuSessionId) return;
    function onDocPointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("[data-session-menu]")) return;
      setMenuSessionId(null);
    }
    document.addEventListener("mousedown", onDocPointerDown);
    return () => document.removeEventListener("mousedown", onDocPointerDown);
  }, [menuSessionId]);

  // 会话列表滚动：关闭菜单；用户滚动（非自动）时保存位置
  const sessionListScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sessionListScrollRef.current;
    if (!el) return;
    const container = el;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    function onListScroll() {
      setMenuSessionId(null);
      if (userScrollingRef.current) {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          saveUiState("chat-history-scroll", container.scrollTop);
        }, 300);
      }
    }
    // 用户手动滚动（wheel / touchmove）
    function onWheel() { userScrollingRef.current = true; }
    container.addEventListener("wheel", onWheel, { passive: true });
    container.addEventListener("touchmove", onWheel, { passive: true });
    container.addEventListener("scroll", onListScroll, { passive: true });
    return () => {
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("touchmove", onWheel);
      container.removeEventListener("scroll", onListScroll);
      if (saveTimer) clearTimeout(saveTimer);
    };
  }, []);

  // 切换对话：清空输入框、关闭菜单；若该会话不在可视区自动滚入（不强制回顶）
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setInput("");
    setMenuSessionId(null);
    setMenuRect(null);
    const listEl = sessionListScrollRef.current;
    if (listEl && activeSessionId) {
      userScrollingRef.current = false;
      const item = listEl.querySelector<HTMLElement>(`[data-session-id="${activeSessionId}"]`);
      if (item) {
        const listRect = listEl.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        if (itemRect.bottom > listRect.bottom - 8 || itemRect.top < listRect.top + 8) {
          item.scrollIntoView({ block: "nearest" });
        }
      } else {
        listEl.scrollTop = 0;
      }
    }
    // 切换后恢复用户标记
    setTimeout(() => { userScrollingRef.current = false; }, 100);
  }, [activeSessionId, sessions]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = input.trim();
      if (text) {
        onSend(text);
        setInput("");
        requestAnimationFrame(() => {
          if (inputRef.current) inputRef.current.style.height = "auto";
        });
      }
    }
  }

  function handleInputChange(value: string) {
    setInput(value);
    const el = inputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 176)}px`;
    }
  }

  // 固定会话优先排序
  const pinned = sessions.filter((s) => (s as ChatSession & { pinned?: boolean }).pinned);
  const unpinned = sessions.filter((s) => !(s as ChatSession & { pinned?: boolean }).pinned);
  const orderedSessions = [...pinned, ...unpinned];

  // 聊天消息拆分
  const chatMessages = activeSession?.messages ?? [];
  const systemMessages = chatMessages.filter((m) => m.role === "system");
  const conversationMessages = chatMessages.filter((m) => m.role !== "system");
  const [systemOpen, setSystemOpen] = useState(false);

  // 打开菜单：计算 fixed 坐标 + 方向
  function openMenu(s: ChatSession) {
    const btn = menuButtonRefs.current.get(s.id);
    const MENU_W = 148;
    const MENU_H = 200;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const above = spaceBelow < MENU_H;
      setMenuRect({
        top: above ? rect.bottom - MENU_H : rect.bottom + 4,
        right: Math.max(8, window.innerWidth - rect.right + 2),
        width: MENU_W,
      });
    }
    setMenuSessionId(s.id);
  }

  // Portal 渲染更多菜单（挂到 body，fixed 定位，不被 overflow 容器裁切）
  const menuSession = menuSessionId ? sessions.find((s) => s.id === menuSessionId) ?? null : null;
  const menuSessionPinned = Boolean(menuSession && (menuSession as ChatSession & { pinned?: boolean }).pinned);
  const portableMenu = menuSession && menuRect ? (
    createPortal(
      <div
        data-session-menu
        className="fixed z-[999] w-[148px] rounded-[9px] bg-white shadow-[0_1px_6px_rgba(0,0,0,0.08)] p-1.5 border border-[#E4E4E7]"
        style={{
          top: menuRect.top,
          right: menuRect.right,
        }}
      >
        <>
              <button
                className="flex items-center gap-2.5 w-full text-left text-[14px] h-[38px] px-2.5 rounded-[6px] hover:bg-[#F4F4F5] text-[#18181B]"
                onClick={() => {
                  // P3 交互修复：不再用原生 prompt，转内联编辑（列表顶部渲染编辑条）
                  setRenameTargetId(menuSession.id);
                  setRenameValue(menuSession.title);
                  setMenuSessionId(null);
                }}
              >
                <svg className="w-[16px] h-[16px] shrink-0 text-[#71717A]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zM19.5 7.125L16.875 4.5" /></svg>
                重命名
              </button>
              {onTogglePinned && (
                <button
                  className="flex items-center gap-2.5 w-full text-left text-[14px] h-[38px] px-2.5 rounded-[6px] hover:bg-[#F4F4F5] text-[#18181B]"
                  onClick={() => { onTogglePinned(menuSession.id); setMenuSessionId(null); }}
                >
                  <svg className="w-[16px] h-[16px] shrink-0 text-[#71717A]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM6.75 12.75l-2.25 6h15l-2.25-6a6.75 6.75 0 10-10.5 0z" /></svg>
                  {menuSessionPinned ? "取消固定" : "固定会话"}
                </button>
              )}
              <button
                className="flex items-center gap-2.5 w-full text-left text-[14px] h-[38px] px-2.5 rounded-[6px] hover:bg-[#F4F4F5] text-[#18181B]"
                onClick={() => {
                  navigator.clipboard?.writeText(`【${menuSession.title}】\n${menuSession.messages.map((m) => `${m.role === "user" ? "我" : m.role === "system" ? "系统" : "AI"}：${m.content}`).join("\n")}`).then(() => {
                    setMenuSessionId(null);
                  });
                }}
              >
                <svg className="w-[16px] h-[16px] shrink-0 text-[#71717A]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.9 14.239a2.25 2.25 0 001.5 2.425H6a2.25 2.25 0 001.5-2.425M8.25 7.5h6.75" /></svg>
                复制
              </button>
              {onUpdateSessionStatus && (
                <button
                  className="flex items-center gap-2.5 w-full text-left text-[14px] h-[38px] px-2.5 rounded-[6px] hover:bg-[#F4F4F5] text-[#18181B]"
                  onClick={() => {
                    const next = menuSession.status === "completed" ? "active" : menuSession.status === "paused" ? "active" : "completed";
                    onUpdateSessionStatus(menuSession.id, next);
                    setMenuSessionId(null);
                  }}
                >
                  <svg className="w-[16px] h-[16px] shrink-0 text-[#71717A]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {menuSession.status === "completed" ? "恢复学习" : "标记完成"}
                </button>
              )}
              <button
                className="flex items-center gap-2.5 w-full text-left text-[14px] h-[38px] px-2.5 rounded-[6px] hover:bg-[#FEF2F2] text-[#EF4444]"
                onClick={() => {
                  // P3 交互修复：不再用原生 confirm，转两阶段确认
                  setConfirmDeleteId(menuSession.id);
                  setMenuSessionId(null);
                }}
              >
                <svg className="w-[16px] h-[16px] shrink-0 text-[#EF4444]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                删除
              </button>
        </>
      </div>,
      document.body
    )
  ) : null;

  return (
    // P0 修复：必须用固定 height（而非 minHeight），否则历史会话/聊天变长会把整个页面撑高出现整页滚动条
    <section className={`flex flex-col overflow-hidden ${styles.chatPanelHeight}`} id="ai-chat-panel">
      {/* ─── 顶部操作栏（上下文跟随消息内联显示，不再常驻顶部） ─── */}
      <div className="flex items-center gap-3 px-4 py-3 mb-0 rounded-t-[10px] border border-b-0 border-[#E4E4E7] bg-white shrink-0">
        <div className="flex-1" />
        <div className="flex items-center gap-2 shrink-0">
          {activeSession?.status && (
            <span className="text-[12px]" title={`${SESSION_STATUS_ICONS[activeSession.status]} ${activeSession.status === "active" ? "正在学习" : activeSession.status === "completed" ? "已完成" : "暂停"}`}>
              {SESSION_STATUS_ICONS[activeSession.status]}
            </span>
          )}
          <span className="text-[13px] font-bold text-[#18181B] max-w-[180px] truncate">{activeSession?.title || "新对话"}</span>
        </div>
        <button
          className="min-h-[30px] px-3 rounded-[8px] bg-[#18181B] text-white font-bold text-[12px] shrink-0"
          onClick={onNewSession}
        >
          + 新建会话
        </button>
        <button
          className={`min-h-[30px] px-3 rounded-[8px] font-bold text-[12px] shrink-0 ${historyOpen ? "bg-[#18181B] text-white" : "bg-[#F4F4F5] text-[#18181B]"}`}
          onClick={() => setHistoryOpen(!historyOpen)}
        >
          历史会话
        </button>
      </div>

      {/* ─── 主内容区：聊天 75% + 历史 25%（页面高度固定，各自独立滚动） ─── */}
      <div className="flex-1 flex gap-3 min-h-0 p-3 bg-[#F4F4F5] rounded-b-[10px]">
        {/* 聊天区（flex-1：聊天记录唯一滚动区域；输入框固定在底部） */}
        <div className="flex-1 flex flex-col min-w-0 rounded-[10px] border border-[#E4E4E7] bg-[#FBFBFC] overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 thin-scrollbar" data-testid="chat-scroll">
            {conversationMessages.length === 0 ? (
              <div className="py-12 text-center px-6">
                <div className="text-[28px] mb-2">🦉</div>
                <strong className="text-[16px] block mb-1.5">你好，我是你的 AI 学习助手。</strong>
                <p className="text-[12px] text-[#71717A] mb-4">今天想解决什么问题？</p>
                <div className="flex flex-wrap justify-center gap-2 max-w-[420px] mx-auto">
                  {[
                    { q: "今天应该学什么？", dot: "🗓️" },
                    { q: "帮我分析这份真题", dot: "📝" },
                    { q: "制定今天学习计划", dot: "📋" },
                    { q: "为什么最近效率下降？", dot: "📉" },
                  ].map(({ q, dot }) => (
                    <button
                      key={q}
                      onClick={() => { onSend(q); setInput(""); }}
                      className="text-[12px] px-3 py-1.5 rounded-full bg-white border border-[#E4E4E7] text-[#52525B] hover:border-[#18181B] hover:bg-[#FAFAFA] transition-colors"
                    >
                      {dot} {q}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[#A1A1AA] mt-4">提示：发送第一条消息后快捷问题自动隐藏</p>
              </div>
            ) : (
              conversationMessages.map((message, index) => (
                <MessageBubble key={message.id} message={message} index={index} sessionMessages={conversationMessages} />
              ))
            )}
          </div>

          {systemMessages.length > 0 && (
            <details className="px-3 pb-1" open={systemOpen} onToggle={(e) => setSystemOpen((e.target as HTMLDetailsElement).open)}>
              <summary className="text-[11px] text-[#A1A1AA] cursor-pointer select-none">
                系统记录（{systemMessages.length}）
              </summary>
              <div className="mt-1 max-h-[100px] overflow-y-auto rounded-[8px] bg-[#FAFAFA] p-2 thin-scrollbar">
                {systemMessages.map((m) => (
                  <div key={m.id} className="text-[11px] text-[#A1A1AA] mb-1 flex items-start gap-2">
                    <span>{MESSAGE_TYPE_LABELS[m.messageType ?? "action"]?.dot ?? "⚙️"}</span>
                    <span className="flex-1">{m.content}</span>
                    <span className="shrink-0">{formatMessageTime(m.createdAt)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* 输入框（固定底部，自动增高最多 8 行） */}
          <div className="px-3 py-2.5 border-t border-[#E4E4E7] bg-white shrink-0">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="今天想解决什么问题？"
              rows={1}
              autoFocus
              data-testid="chat-input"
              className="w-full min-h-[40px] max-h-[176px] px-3 py-2 rounded-[10px] border border-[#D4D4D8] bg-white text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-[#18181B]/10 leading-relaxed"
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px] text-[#A1A1AA]">Enter 发送 · Shift+Enter 换行</span>
              <button
                className="min-h-[32px] px-5 rounded-[8px] bg-[#18181B] text-white font-bold text-[13px] disabled:opacity-40 hover:opacity-90 transition-opacity"
                disabled={!input.trim()}
                onClick={() => {
                  const text = input.trim();
                  if (text) {
                    onSend(text);
                    setInput("");
                    requestAnimationFrame(() => {
                      if (inputRef.current) inputRef.current.style.height = "auto";
                    });
                  }
                }}
              >
                发送
              </button>
            </div>
          </div>
        </div>

        {/* 历史会话列表（固定宽度 25%，固定高度，独立滚动；标题固定，列表滚动） */}
        {historyOpen && (
          <aside className="w-[240px] shrink-0 rounded-[10px] bg-white border border-[#E4E4E7] overflow-hidden flex flex-col min-h-0">
            {/* 固定区域：标题 */}
            <div className="px-3 py-2.5 border-b border-[#E4E4E7] bg-[#FAFAFA] shrink-0">
              <div className="text-[13px] font-bold text-[#52525B]">历史会话</div>
              <div className="text-[10px] text-[#A1A1AA] mt-1">回看「昨天我是怎么学习的」</div>
            </div>
            {/* 可滚动区域：会话列表（细滚动条，底部预留 padding） */}
            <div
              ref={sessionListScrollRef}
              className="flex-1 overflow-y-auto overflow-x-hidden p-1.5 pb-4 min-h-0 thin-scrollbar"
            >
              {/* P3 交互修复：内联重命名条（替代原生 prompt） */}
              {renameTargetId && (
                <div className="p-2 mb-2 rounded-[8px] border border-[#E4E4E7] bg-[#FAFAFA]">
                  <div className="text-[11px] font-bold text-[#52525B] mb-1">重命名会话</div>
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="w-full min-h-[30px] text-[12px] px-2 rounded-[6px] border border-[#D4D4D8] bg-white"
                    placeholder="会话名称"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (renameValue.trim()) onRenameSession(renameTargetId, renameValue.trim());
                        setRenameTargetId(null);
                      }
                      if (e.key === "Escape") setRenameTargetId(null);
                    }}
                  />
                  <div className="flex gap-1.5 mt-1.5">
                    <button
                      className="text-[11px] font-bold px-2 py-1 rounded-[6px] bg-[#18181B] text-white"
                      onClick={() => { if (renameValue.trim()) onRenameSession(renameTargetId, renameValue.trim()); setRenameTargetId(null); }}
                    >保存</button>
                    <button
                      className="text-[11px] font-bold px-2 py-1 rounded-[6px] bg-[#F4F4F5] text-[#71717A]"
                      onClick={() => setRenameTargetId(null)}
                    >取消</button>
                  </div>
                </div>
              )}

              {/* P3 交互修复：两阶段删除确认条（替代原生 confirm） */}
              {confirmDeleteId && (
                <div className="p-2 mb-2 rounded-[8px] border border-[#FECACA] bg-[#FEF2F2]">
                  <div className="text-[12px] text-[#B91C1C] mb-1">删除该会话？此操作不可撤销。</div>
                  <div className="flex gap-1.5">
                    <button
                      className="text-[11px] font-bold px-2 py-1 rounded-[6px] bg-[#DC2626] text-white"
                      onClick={() => { onDeleteSession(confirmDeleteId); setConfirmDeleteId(null); }}
                    >确认删除</button>
                    <button
                      className="text-[11px] font-bold px-2 py-1 rounded-[6px] bg-white text-[#71717A] border border-[#D4D4D8]"
                      onClick={() => setConfirmDeleteId(null)}
                    >取消</button>
                  </div>
                </div>
              )}

              {groupSessions(orderedSessions).map((group) => (
                <div key={group.label}>
                  <div className="text-[10px] font-bold text-[#A1A1AA] px-2 pb-1 pt-2.5">{group.label}</div>
                  {group.list.map((s) => {
                    const isActive = s.id === activeSessionId;
                    const isPinned = (s as ChatSession & { pinned?: boolean }).pinned;
                    const wasMenuOpen = menuSessionId === s.id;
                    return (
                      <div
                        key={s.id}
                        data-session-id={s.id}
                        data-session-menu
                        className={`relative rounded-[8px] mb-1.5 ${isActive ? "bg-[#18181B] text-white" : "hover:bg-[#F4F4F5]"} transition-colors ${styles.sessionItemHeight}`}
                      >
                        {/* 会话主体（点击切换对话；⋯ 按钮独立 32×32，互不影响） */}
                        <button
                          className="absolute inset-0 w-full text-left pl-3 pr-12"
                          onClick={() => onSelectSession(s.id)}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 mt-2">
                            {isPinned && <span className="text-[11px] shrink-0 opacity-60">📍</span>}
                            {s.status && <span className="text-[10px] shrink-0">{SESSION_STATUS_ICONS[s.status]}</span>}
                            <span className={`text-[13px] font-bold truncate ${isActive ? "text-white" : "text-[#18181B]"}`}>{s.title}</span>
                          </div>
                          <span className={`block text-[11px] mt-0.5 ${isActive ? "text-white/60" : "text-[#A1A1AA]"}`}>
                            {formatMessageTime(s.createdAt)}
                          </span>
                          <span className={`block text-[11px] mt-0.5 truncate ${isActive ? "text-white/50" : "text-[#A1A1AA]"}`}>
                            {s.messages.length > 0 ? `${s.messages.length} 条消息 · 最后更新 ${formatMessageTime(s.messages[s.messages.length - 1]?.createdAt)}` : "暂无消息"}
                          </span>
                        </button>

                        {/* ⋯ 按钮：独立 32×32 点击区域，仅点击打开/关闭 */}
                        <button
                          data-session-menu
                          ref={(el) => { if (el) menuButtonRefs.current.set(s.id, el); else menuButtonRefs.current.delete(s.id); }}
                          className="absolute right-0.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-[8px] text-[#71717A] hover:bg-black/10 active:bg-black/15 transition-colors"
                          aria-label={`会话菜单：${s.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (wasMenuOpen) {
                              setMenuSessionId(null);
                              return;
                            }
                            openMenu(s);
                          }}
                        >
                          <svg className="w-[16px] h-[16px]" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
              {groupSessions(orderedSessions).length === 0 && (
                <p className="text-[12px] text-[#A1A1AA] text-center py-8">还没有历史会话</p>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Portal 菜单：fixed 定位到 body，不被历史会话容器裁切；层级高于列表 */}
      {portableMenu}

      {/* 全局样式：细滚动条 + 消息动画 */}
      <style>{`
        .message-fade-in {
          animation: messageFadeIn 0.25s ease-out;
        }
        @keyframes messageFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .thin-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #D4D4D8 transparent;
        }
        .thin-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .thin-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .thin-scrollbar::-webkit-scrollbar-thumb {
          background: #D4D4D8;
          border-radius: 999px;
        }
        .thin-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #A1A1AA;
        }
      `}</style>
    </section>
  );
}
