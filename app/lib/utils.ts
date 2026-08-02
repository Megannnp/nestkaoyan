import type { ExamGoal } from "./types";
import { seedExam } from "./default-data";
import { MAX_DATE_RANGE_DAYS } from "./rules";

/**
 * 纯工具函数（无 React 状态依赖）。
 * 从 page.tsx 抽取，便于离线单测与复用，降低上帝组件体积。
 */

let _idCounter = 0;
export function makeId(prefix: string) {
  _idCounter++;
  return `${prefix}-${Date.now()}-${_idCounter}-${Math.random().toString(16).slice(2)}`;
}

export function today() {
  return new Date().toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" });
}

export function dateOnly(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  // 统一按 Asia/Shanghai 计算“日期”，与 today() 保持一致（en-CA 输出 YYYY-MM-DD）
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

export function normalizeExamGoal(goal: ExamGoal): ExamGoal {
  return { ...seedExam, ...goal, startDate: goal.startDate ?? seedExam.startDate ?? "2026-07-30" };
}

export function dateRange(start: string, end: string) {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime > endTime) return [dateOnly()];
  const days = Math.min(MAX_DATE_RANGE_DAYS, Math.floor((endTime - startTime) / 86400000) + 1);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(startTime);
    date.setDate(date.getDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

// UX Sprint: 消息时间格式化（当天 HH:mm；非当天 M月D日 HH:mm；跨年 YYYY年M月D日 HH:mm）
export function formatMessageTime(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const sameDay = sameYear && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `${hh}:${mm}`;
  if (sameYear) return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}