"use client";

import { ChatPanel } from "./ChatPanel";
import type { ChatSession } from "../lib/types";
import { useWorkspace } from "./workspace-context";

/** AgentView（从 page.tsx 抽出，行为等价）；数据/回调经 useWorkspace() 取用。 */
export function AgentView() {
  const {
    chatSessions, activeSessionId, activeSessionIdRef, chatHistoryOpen,
    newChatSession, runPrompt, setChatSessions, setActiveSessionId, setChatHistoryOpen, setNotice,
  } = useWorkspace();
  return (
          <section className="workflow workspace-pane active" id="ai-assistant">
            <ChatPanel
              sessions={chatSessions}
              activeSessionId={activeSessionId || chatSessions[0]?.id || ""}
              onSelectSession={(id) => { setActiveSessionId(id); activeSessionIdRef.current = id; }}
              onNewSession={newChatSession}
              onSend={(content) => runPrompt(content)}
              onRenameSession={(id, title) => {
                setChatSessions((items) => items.map((s) => s.id === id ? { ...s, title } : s));
                setNotice("已重命名会话");
              }}
              onDeleteSession={(id) => {
                const remainingSessions = chatSessions.filter((s) => s.id !== id);
                setChatSessions(remainingSessions);
                if (activeSessionIdRef.current === id) {
                  const next = remainingSessions[0] ?? null;
                  setActiveSessionId(next?.id ?? "");
                  activeSessionIdRef.current = next?.id ?? "";
                }
                setNotice("已删除会话");
              }}
              onTogglePinned={(id) => {
                setChatSessions((items) => items.map((s) => s.id === id ? { ...s, pinned: !(s as ChatSession & { pinned?: boolean }).pinned } : s));
              }}
              onUpdateSessionStatus={(id, status) => {
                setChatSessions((items) => items.map((s) => s.id === id ? { ...s, status } : s));
                setNotice(status === "completed" ? "已标记为已完成" : "已恢复学习");
              }}
              historyOpen={chatHistoryOpen}
              setHistoryOpen={setChatHistoryOpen}
            />
          </section>
  );
}
