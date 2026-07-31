"use client";

import type { Task, MasteryText, StudyMood } from "../lib/types";

interface TaskCardProps {
  task: Task;
  activeTimerTaskId: string;
  timerStartTime: string;
  elapsedSeconds: number;
  onToggleDone: (task: Task) => void;
  onStartTask: (task: Task) => void;
  onEndLearning: (task: Task) => void;
  onRecordResult: (task: Task) => void;
  onShowDetail: (taskId: string) => void;
  onMoveTask: (id: string, dir: -1 | 1) => void;
  onUpdateTask: (id: string, patch: Partial<Task>) => void;
  onStopTimer: () => void;
}

export function TaskCard({
  task, activeTimerTaskId, timerStartTime, elapsedSeconds,
  onToggleDone, onStartTask, onEndLearning, onRecordResult, onShowDetail,
  onMoveTask, onUpdateTask, onStopTimer,
}: TaskCardProps) {
  const isActiveTimer = activeTimerTaskId === task.id;

  return (
    <article className={`task-row ${task.done ? "done" : ""}`} key={task.id}>
      <label className="task-check">
        <input type="checkbox" checked={task.done} onChange={() => onToggleDone(task)} />
      </label>
      <div className="task-content">
        <div className="task-title-row">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <strong className="text-[15px]">{task.title}</strong>
            {task.aiRecommended && <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#EDEDED] text-[#52525B] font-bold">AI推荐</span>}
          </div>
          <span className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded bg-[#F4F4F5] text-[#71717A] font-semibold whitespace-nowrap">🕒 {task.estimatedCompletionMinutes || task.minutes} min</span>
          <div className="relative inline-block">
            <button className="text-[12px] min-h-[28px] px-2 rounded-[6px] bg-[#F4F4F5] text-[#71717A] font-bold hover:bg-[#EDEDED]"
              onClick={(e) => { e.stopPropagation(); document.getElementById(`pop-${task.id}`)?.classList.toggle('hidden'); }}>⋯</button>
            <div id={`pop-${task.id}`} className="hidden absolute right-0 top-full mt-1 z-30 min-w-[140px] p-1.5 rounded-[8px] bg-white border border-[#E4E4E7] shadow-lg" onClick={(e) => e.stopPropagation()}>
              <button className="block w-full text-left text-[12px] px-3 py-1.5 rounded-[6px] hover:bg-[#F4F4F5]" onClick={() => onMoveTask(task.id, -1)}>提高优先级</button>
              <button className="block w-full text-left text-[12px] px-3 py-1.5 rounded-[6px] hover:bg-[#F4F4F5]" onClick={() => onMoveTask(task.id, 1)}>降低优先级</button>
              <button className="block w-full text-left text-[12px] px-3 py-1.5 rounded-[6px] hover:bg-[#F4F4F5]" onClick={() => { onUpdateTask(task.id, { status: "延期" }); }}>延期到明天</button>
              <button className="block w-full text-left text-[12px] px-3 py-1.5 rounded-[6px] hover:bg-[#F4F4F5]" onClick={() => { onUpdateTask(task.id, { status: "暂停" }); }}>暂停任务</button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#F4F4F5] text-[#71717A]">{task.subject}</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#F4F4F5] text-[#71717A]">{task.layer}</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#F4F4F5] text-[#71717A]">{task.round}</span>
        </div>
        <p className="text-[12px] text-[#71717A] mt-1">{task.standard}</p>
        {/* 掌握度进度条 */}
        <div className="mt-2">
          <div className="flex items-center justify-between text-[11px] text-[#71717A] mb-1">
            <span>掌握度</span>
            <span>{task.masteryBefore}% → {task.masteryAfter}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#E4E4E7] overflow-hidden flex">
            <div className="h-full rounded-l-full bg-[#D4D4D8]" style={{ width: `${task.masteryBefore}%` }} />
            <div className="h-full rounded-r-full bg-[#18181B]" style={{ width: `${task.masteryAfter - task.masteryBefore}%` }} />
          </div>
        </div>
        {/* 学习中实时信息 */}
        {isActiveTimer && (
          <div className="mt-2 p-2 rounded-[6px] bg-[#F4F4F5]">
            <div className="flex items-center justify-between gap-2 text-[12px] mb-1">
              <span className={`font-bold ${task.status === "暂停" ? "text-[#F59E0B]" : "text-[#52525B]"}`}>
                {task.status === "暂停" ? "● 已暂停" : "● 学习中"}
              </span>
              <span className="text-[#71717A]">开始 {timerStartTime}</span>
            </div>
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-[#71717A]">已学习</span>
              <span className="font-bold text-[#18181B]">{Math.floor(elapsedSeconds / 60)} 分钟 {elapsedSeconds % 60} 秒</span>
              <span className="text-[#A1A1AA]">| 预计 {task.estimatedCompletionMinutes || task.minutes} 分钟</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#D4D4D8] overflow-hidden mt-1.5">
              <div className="h-full rounded-full bg-[#0F766E] transition-all duration-500"
                style={{ width: `${Math.min(100, (elapsedSeconds / 60) / (task.estimatedCompletionMinutes || task.minutes) * 100)}%` }} />
            </div>
          </div>
        )}
        {/* 操作区 */}
        <div className="task-actions mt-2">
          {isActiveTimer ? (
            task.status === "暂停" ? (
              <>
                <button className="min-h-[30px] px-4 rounded-[6px] bg-[#F59E0B] text-white font-bold text-[12px]" type="button"
                  onClick={() => { onUpdateTask(task.id, { status: "学习中" }); onStopTimer(); }}>继续学习</button>
                <button className="min-h-[30px] px-3 rounded-[6px] bg-[#18181B] text-white font-bold text-[12px]" type="button"
                  onClick={() => onEndLearning(task)}>结束学习</button>
              </>
            ) : (
              <>
                <button className="min-h-[30px] px-4 rounded-[6px] bg-[#0F766E] text-white font-bold text-[12px]" type="button">⏱ 学习中</button>
                <button className="min-h-[30px] px-3 rounded-[6px] bg-[#F4F4F5] text-[#18181B] font-bold text-[12px]" type="button"
                  onClick={() => { onStopTimer(); onUpdateTask(task.id, { status: "暂停" }); }}>暂停</button>
                <button className="min-h-[30px] px-3 rounded-[6px] bg-[#18181B] text-white font-bold text-[12px]" type="button"
                  onClick={() => onEndLearning(task)}>结束学习</button>
              </>
            )
          ) : (
            <>
              <button className="min-h-[30px] px-4 rounded-[6px] bg-[#18181B] text-white font-bold text-[12px]" type="button"
                onClick={() => onStartTask(task)}>开始学习</button>
              <button className="min-h-[30px] px-3 rounded-[6px] bg-[#F4F4F5] text-[#71717A] text-[12px]" type="button"
                onClick={() => onRecordResult(task)}>记录结果</button>
              <button className="min-h-[30px] px-3 rounded-[6px] bg-[#F4F4F5] text-[#71717A] text-[12px]" type="button"
                onClick={() => onShowDetail(task.id)}>📋 详情</button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}