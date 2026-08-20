"use client";

/**
 * ChatSession 管理独立 hook（2026-08-04 审查拆分）
 * 从 use-workspace-handlers.ts 抽出聊天会话域，降低上帝模块体积。
 * 导出名与行为与内联版本完全等价，调用方无需改动语义。
 */
import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AgentMessage, ChatSession } from "./lib/types";
import { createChatSession, createMessage, appendMessage } from "./lib/chat";
import { makeId } from "./lib/utils";

export interface UseChatSessionDeps {
  activeSessionIdRef: { current: string };
  setChatSessions: Dispatch<SetStateAction<ChatSession[]>>;
  setActiveSessionId: Dispatch<SetStateAction<string>>;
  setChatHistoryOpen: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string>>;
}

export function useChatSession(deps: UseChatSessionDeps) {
  const { activeSessionIdRef, setChatSessions, setActiveSessionId, setChatHistoryOpen, setNotice } = deps;

  // 打字机动画 interval 引用：新动画启动前清掉旧动画，组件卸载时清掉活动的，防止泄漏
  const typeTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (typeTimerRef.current) clearInterval(typeTimerRef.current);
      typeTimerRef.current = undefined;
    };
  }, []);

  function ensureChatSession() {
    let sessionId = activeSessionIdRef.current;
    if (!sessionId) {
      sessionId = makeId("s");
      setChatSessions((prev) => [createChatSession(sessionId), ...prev]);
      setActiveSessionId(sessionId);
      activeSessionIdRef.current = sessionId;
    }
    return sessionId;
  }

  function newChatSession() {
    const sessionId = makeId("s");
    setChatSessions((prev) => [createChatSession(sessionId), ...prev]);
    setActiveSessionId(sessionId);
    activeSessionIdRef.current = sessionId;
    setChatHistoryOpen(false);
    setNotice("已创建新对话（历史对话保留在左侧）");
  }

  function pushAssistant(text: string, messageType: NonNullable<AgentMessage["messageType"]> = "chat") {
    const sessionId = ensureChatSession();
    const message = createMessage("assistant", "", messageType);
    setChatSessions((items) => appendMessage(items, sessionId, message));
    // 空文本直接落一条空消息，不启动动画
    if (!text) return;
    const step = text.length > 300 ? 4 : 2;
    let idx = 0;
    // 新动画开始前清掉上一个未结束的动画，避免并发 interval 累积
    if (typeTimerRef.current) clearInterval(typeTimerRef.current);
    typeTimerRef.current = setInterval(() => {
      idx += step;
      setChatSessions((items) => items.map((s) => s.id === sessionId
        ? { ...s, messages: s.messages.map((m) => m.id === message.id ? { ...m, content: text.slice(0, idx), updatedAt: new Date().toISOString() } : m) }
        : s));
      if (idx >= text.length) {
        if (typeTimerRef.current) clearInterval(typeTimerRef.current);
        typeTimerRef.current = undefined;
        setNotice(text);
      }
    }, 20);
  }

  function pushSystem(text: string, messageType: "action" | "record" = "action") {
    const sessionId = ensureChatSession();
    setChatSessions((items) => appendMessage(items, sessionId, createMessage("system", text, messageType)));
    setNotice(text);
  }

  return { ensureChatSession, newChatSession, pushAssistant, pushSystem };
}