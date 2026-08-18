"use client";

import { useEffect, useState } from "react";
import { s } from "../lib/css-utils";
import type { WorkspaceView, ExamGoal } from "../lib/types";
import { loadUiState, readLegacyRawValue, saveUiState } from "../lib/storage";
import styles from "../../styles/components.module.css";

interface SidebarProps {
  daysLeft: number;
  exam: ExamGoal;
  totalTargetScore: number;
  overallProgress: number;
  heatmapStartFormatted: string;
  heatmapMonths: { label: string; colSpan: number }[];
  dayLabels: string[];
  heatmapGrid: ({ date: string; completed: number; minutes: number } | null)[][];
  todayStr: string;
  examDate: string;
  tooltipData: { date: string; top: number; left: number; above: boolean } | null;
  tooltipVisible: boolean;
  heatmapDays: { date: string; completed: number; minutes: number }[];
  cardsByDate: Record<string, number>;
  activeView: WorkspaceView;
  setActiveView: (v: WorkspaceView) => void;
  heatmapRef: React.RefObject<HTMLDivElement | null>;
  onCellMouseEnter: (e: React.MouseEvent<Element>, date: string) => void;
  onCellMouseLeave: () => void;
  onCellClick: (e: React.MouseEvent<Element>, date: string) => void;
  setTooltipVisible: (v: boolean) => void;
  setTooltipData: (d: { date: string; top: number; left: number; above: boolean } | null) => void;
}

export function Sidebar({
  daysLeft, exam, totalTargetScore, overallProgress, heatmapStartFormatted,
  heatmapMonths, dayLabels, heatmapGrid, todayStr, examDate,
  tooltipData, tooltipVisible, heatmapDays, cardsByDate,
  activeView, setActiveView, heatmapRef,
  onCellMouseEnter, onCellMouseLeave, onCellClick,
}: SidebarProps) {
  // ─── 信息架构精简（2026-08-01）：热力图默认折叠为一行，展开才显示格子 ───
  // 避免压缩核心导航（四宫格）的可见性；点击头部区域展开/收起
  // 2026-08-03 体验优化 #5：折叠状态持久化到 localStorage
  // 2026-08-04 审查修复：改用 storage.ts 的 saveUiState/loadUiState（闭合「localStorage 直写 = 0」契约）
  // Hydration-safe：初始固定 false（SSR 与客户端首次渲染一致），
  // 持久化折叠状态在 mount 后用 useEffect 读取，避免 SSR 阶段访问 localStorage
  // 导致 hydration mismatch（2026-08-05 实测修复）
  const [heatmapExpanded, setHeatmapExpanded] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const stored = loadUiState("heatmap-expanded") as unknown;
      if (typeof stored === "boolean") { setHeatmapExpanded(stored); return; }
      // 兼容旧 key（kaoyan-heatmap-expanded 曾直接存 "1"/"0" 非 JSON 字符串）
      const legacy = readLegacyRawValue("kaoyan-heatmap-expanded");
      if (legacy !== null) setHeatmapExpanded(legacy === "1");
    } catch { /* 忽略读取失败，保持默认折叠 */ }
  }, []);
  const toggleHeatmap = () => {
    setHeatmapExpanded((v) => {
      const next = !v;
      saveUiState("heatmap-expanded", next);
      return next;
    });
  };
  return (
    <aside className="fixed top-0 left-0 h-screen w-[288px] z-10 hidden lg:flex flex-col bg-white/82 backdrop-blur-[18px] border-r border-[#E4E4E7] px-6 py-4 gap-3 overflow-y-auto overflow-x-hidden">
      {/* Logo + 倒计时 */}
      <div className="flex items-center gap-3 shrink-0">
        {/* 静态 SVG logo，用原生 <img> 即可（next/image 对 SVG 反而需额外配置） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/favicon.svg" alt="筑巢考研" className="w-10 h-10 shrink-0" />
        <div className="flex-1 min-w-0">
          <div style={s.logoText}>筑巢考研</div>
          <div style={s.logoSub}>Learning Agent</div>
        </div>
        <div className="flex items-baseline gap-1 shrink-0">
          <span style={s.countdownNum}>{daysLeft}</span>
          <span style={s.countdownUnit}>天</span>
        </div>
      </div>

      {/* 目标信息 + 进度 */}
      <div className="border-t border-[#F1F1F3] mt-3 pt-3">
        <div>
          <div style={s.schoolName} className="line-clamp-2">{exam.school || "未设置院校"}</div>
          <div style={s.majorName}>{exam.major || "未设置专业"}</div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between items-center">
            <span style={s.progressLabel}>目标 <span style={s.progressValue}>{totalTargetScore}</span></span>
            <span style={s.progressLabel}>整体进度 <span style={s.progressValue}>{overallProgress}%</span></span>
          </div>
          <div className="h-1.5 rounded-full bg-[#F1F1F3] overflow-hidden mt-2">
            <div className="h-full rounded-full bg-[#27272A] transition-all duration-300" style={{ width: `${overallProgress}%` }} />
          </div>
        </div>
      </div>

      {/* 热力图（默认折叠，点击展开） */}
      <div className="border-t border-[#E4E4E7] mt-3 pt-3 w-full min-w-0 max-w-full">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 mb-2 cursor-pointer text-left"
          onClick={toggleHeatmap}
          aria-expanded={heatmapExpanded}
        >
          <span className="text-[13px] font-semibold leading-[1.4] text-[#18181B] shrink-0">学习记录</span>
          <span className="text-[11px] leading-[1.4] text-[#71717A] shrink-0 whitespace-nowrap">
            {heatmapExpanded ? "收起 ▴" : `开始于 ${heatmapStartFormatted} ▾`}
          </span>
        </button>
        {heatmapExpanded && heatmapDays.length === 0 && (
          <div className="text-[12px] text-[#71717A] py-3 px-1 leading-relaxed">
            还没有学习记录。完成今天的任务后，这里会显示你的学习轨迹。
          </div>
        )}
        {heatmapExpanded && heatmapDays.length > 0 && (
        <div className={`w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden ${styles.sidebarHeatmapScroller}`} ref={heatmapRef}>
          <div className={`w-max ${styles.sidebarHeatmapInner}`}>
            {/* Month labels */}
            <div className="flex gap-[2px] mb-[2px] ml-[29px]">
              {heatmapMonths.map((m, i) => (
                <div key={i} className="text-[9px] text-[#71717A] leading-none h-[12px]" style={{ width: `${m.colSpan * 14 - 2}px` }}>{m.label}</div>
              ))}
            </div>
            {/* Grid with day labels */}
            <div className="flex gap-[2px]">
              <div className="flex flex-col gap-[2px] mr-[2px]">
                {dayLabels.map((label, i) => (
                  <div key={i} className="text-[9px] text-[#71717A] leading-none w-[24px] h-[12px] flex items-center justify-end pr-[3px]">{label}</div>
                ))}
              </div>
              {heatmapGrid.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[2px]">
                  {week.map((day, di) => {
                    if (day === null) return <div key={`pad-${wi}-${di}`} className="w-[12px] h-[12px]" />;
                    const isFuture = day.date > todayStr;
                    const isToday = day.date === todayStr;
                    const isExam = day.date === examDate;
                    const level = isFuture ? 0 : (day.completed >= 4 ? 4 : day.completed >= 3 ? 3 : day.completed >= 2 ? 2 : day.completed >= 1 ? 1 : 0);
                    let color = 'bg-[#F1F1F3]';
                    if (!isFuture && level === 1) color = 'bg-[#D4D4D8]';
                    else if (!isFuture && level === 2) color = 'bg-[#A1A1AA]';
                    else if (!isFuture && level === 3) color = 'bg-[#71717A]';
                    else if (!isFuture && level === 4) color = 'bg-[#27272A]';
                    return (
                      <button key={day.date}
                        type="button"
                        aria-label={`学习记录 ${day.date}`}
                        title={day.date}
                        className={`w-[12px] h-[12px] rounded-[2px] ${color} cursor-pointer border-0 p-0 ${isToday ? 'ring-[1px] ring-[#52525B]' : ''} ${isExam ? 'ring-[1px] ring-[#18181B]' : ''}`}
                        onMouseEnter={(e) => onCellMouseEnter(e, day.date)}
                        onMouseLeave={onCellMouseLeave}
                        onClick={(e) => onCellClick(e, day.date)} />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        )}
        {/* Tooltip */}
        <div style={{
          ...s.tooltipBox, top: tooltipData?.top ?? 0, left: tooltipData?.left ?? 0,
          opacity: tooltipVisible ? 1 : 0, transform: tooltipVisible ? 'translateY(0)' : 'translateY(4px)',
          transition: 'opacity 120ms ease, transform 120ms ease',
        }}>
          {tooltipData && (() => {
            const day = tooltipData.date;
            const dayData = heatmapDays.find((d) => d.date === day);
            const cardCount = cardsByDate[day] || 0;
            const isFuture = day > todayStr;
            const isExamDay = day === examDate;
            const parts = day.split("-");
            const dateLabel = `${parts[0]}.${parts[1]}.${parts[2]}`;
            const hasRecord = dayData && (dayData.completed > 0 || dayData.minutes > 0 || cardCount > 0);
            let dataLine = "";
            if (isFuture && !isExamDay && !hasRecord) dataLine = "尚未到达";
            else if (isExamDay && !hasRecord) dataLine = "考试日";
            else if (isExamDay && hasRecord) dataLine = `考试日 · ${dayData!.minutes} 分钟 · ${dayData!.completed} 项任务${cardCount > 0 ? ` · ${cardCount} 张卡片` : ''}`;
            else if (hasRecord) dataLine = `${dayData!.minutes} 分钟 · ${dayData!.completed} 项任务${cardCount > 0 ? ` · ${cardCount} 张卡片` : ''}`;
            else dataLine = "暂无学习记录";
            return <><div style={s.tooltipDate}>{dateLabel}</div><div style={s.tooltipData}>{dataLine}</div></>;
          })()}
        </div>
      </div>

      {/* 四宫格 */}
      <div className="border-t border-[#E4E4E7] mt-3 pt-3">
        <div className="text-[13px] font-semibold leading-[1.4] text-[#18181B] mb-2">核心工作区</div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "dashboard" as WorkspaceView, label: "今日工作台", icon: "📋" },
            { key: "agent" as WorkspaceView, label: "AI学习助手", icon: "🤖" },
            { key: "knowledge" as WorkspaceView, label: "知识中心", icon: "📚" },
            { key: "cards" as WorkspaceView, label: "沉淀卡片", icon: "🗂️" },
          ].map((item) => {
            const isActive = activeView === item.key;
            return (
              <button key={item.key}
                className={`flex flex-col items-center justify-center rounded-[14px] transition-all duration-200 w-full ${isActive ? 'bg-[#EDEDED] text-[#18181B]' : 'bg-white text-[#18181B] hover:bg-[#F4F4F5] hover:-translate-y-[1px]'}`}
                style={isActive ? s.gridBtnActive : s.gridBtnInactive}
                onClick={() => setActiveView(item.key)}>
                <span style={s.gridIcon}>{item.icon}</span>
                <span style={s.gridLabel(isActive)}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 设置 */}
      <nav className="border-t border-[#E4E4E7] mt-3 pt-3">
        <button className={`w-full flex items-center h-9 px-3 rounded-[10px] text-left transition-colors ${activeView === "settings" ? 'bg-[#EDEDED] text-[#18181B]' : 'bg-transparent text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5]'}`}
          onClick={() => setActiveView("settings")}>
          <span style={s.navIcon} className="mr-2">⚙️</span>
          <span style={s.navText}>设置</span>
        </button>
      </nav>
    </aside>
  );
}
