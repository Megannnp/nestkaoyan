"use client";

import { useWorkspace } from "./workspace-context";
import { formatMessageTime } from "../lib/utils";
import styles from "../../styles/workspace.module.css";

/** 今日任务视图（从 page.tsx 抽出，行为等价）；数据/回调经 useWorkspace() 取用。 */
export function DashboardTasksView() {
  const {
    tasks, agentSteps, activeChatMessages, quickPrompts, activeTimerTaskId, timerStartTime, elapsedSeconds,
    updateTask, toggleTaskDone, moveTask, startTask, pauseTimer, resumeTimer, handleEndLearning,
    openTaskDialog, generatePlan, runPrompt, setActiveView, setActiveKnowledgePanel, setNotice,
  } = useWorkspace();
  return (
          <section className="hero-grid workspace-pane active dashboard-hero" id="agent">
            {/* AI Summary Card — only independent parts (no chat, no runPrompt) */}
            <div className="agent-panel">
              <div className="section-label">AI Workspace</div>
              <h1>AI 学习助手</h1>
              <div className="quick-prompts">
                {quickPrompts.map((prompt) => <button key={prompt} onClick={() => runPrompt(prompt)}>{prompt}</button>)}
              </div>
              {agentSteps.length > 0 && (
                <div className="agent-run">
                  {agentSteps.map((step, index) => (
                    <div key={step.id}>
                      <span>{index + 1}</span>
                      <strong>{step.title}</strong>
                      <b>{step.status}</b>
                    </div>
                  ))}
                </div>
              )}
              {/* Dashboard 小窗：展示当前 Session 最近 3 条 AI 对话（不含系统记录） */}
              <div className="chat-window min-h-[180px]">
                {activeChatMessages.filter((m) => m.role !== "system").slice(-3).map((message) => (
                  <div className={`bubble ${message.role}`} key={message.id}>
                    {message.content}
                    <span className="mt-1 block text-right text-[11px] text-[#A1A1AA]">{formatMessageTime(message.createdAt)}</span>
                  </div>
                ))}
                {activeChatMessages.filter((m) => m.role !== "system").length === 0 && (
                  <p className="text-[12px] text-[#A1A1AA]">输入消息开始对话，或进入 AI 助手查看完整聊天。</p>
                )}
              </div>
            </div>

            {/* Engine Panel — Tasks */}
            <div className="engine-panel" id="today">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="section-label">今日学习</div>
                  <h2 className="mb-0">任务与完成记录</h2>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button className="secondary-button" onClick={() => { setActiveView("knowledge"); setActiveKnowledgePanel("resources"); }}>我的资料库</button>
                  <button className="secondary-button" onClick={() => generatePlan()}>重新生成今日计划</button>
                </div>
              </div>
              {/* AI 总览 */}
              <div className="mt-4 p-4 rounded-[8px] bg-[#F4F4F5]">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <strong className="text-[14px]">今日建议</strong>
                  <span className="text-[12px] text-[#71717A]">AI 生成 · 基于遗忘曲线和考试时间</span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-[#71717A] mb-2">
                  <span>预计：<strong className="text-[#18181B]">{tasks.reduce((s, t) => s + t.minutes, 0)} 分钟</strong></span>
                  <span>完成：<strong className="text-[#18181B]">{tasks.length} 个任务</strong></span>
                  <span>掌握度提升：<strong className="text-[#18181B]">+{Math.round(tasks.reduce((s, t) => s + (t.masteryAfter - t.masteryBefore), 0) / Math.max(tasks.length, 1))}%</strong></span>
                </div>
                {tasks.some((t) => t.aiRecommended) && <p className="text-[12px] text-[#71717A]">AI 判断：今天不建议进入新章节。优先稳定熵变计算。</p>}
              </div>
              <div className="mt-4 task-stack">
                {tasks.map((task) => (
                  <article className={`task-row ${task.done ? "done" : ""}`} key={task.id}>
                    <label className="task-check">
                      <input type="checkbox" checked={task.done} onChange={() => toggleTaskDone(task)} />
                    </label>
                    <div className="task-content">
                      <div className="task-title-row">
                        <strong>{task.title}</strong>
                        {task.aiRecommended && <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#EDEDED] text-[#52525B] font-bold">AI推荐</span>}
                        <span className="task-duration">{task.estimatedCompletionMinutes || task.minutes} 分钟</span>
                      </div>
                      <span className="text-[12px]">{task.subject} / {task.core} / {task.branch} / {task.round} / {task.layer}</span>
                      {/* 掌握度变化 */}
                      <div className="flex items-center gap-2 text-[12px] text-[#71717A] mt-0.5">
                        <span>掌握度</span>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-[#18181B]">{task.masteryBefore}%</span>
                          <span className="text-[#A1A1AA]">→</span>
                          <span className="font-bold text-[#18181B]">{task.masteryAfter}%</span>
                        </div>
                      </div>
                      {/* AI 推荐原因 */}
                      {task.aiRecommended && (
                        <div className="mt-1.5 p-2 rounded-[6px] bg-[#F4F4F5]">
                          <div className="text-[11px] font-bold text-[#52525B] mb-1">AI 推荐原因</div>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-[#71717A]">
                            {task.aiReasonForgetRate && <span>• {task.aiReasonForgetRate}</span>}
                            {task.aiReasonLayerStable && <span>• {task.aiReasonLayerStable}</span>}
                            {task.aiReasonMistakeCount && <span>• {task.aiReasonMistakeCount}</span>}
                            {task.aiReasonExamFrequency && <span>• {task.aiReasonExamFrequency}</span>}
                          </div>
                        </div>
                      )}
                      <p className="text-[12px] mt-1">{task.standard}</p>
                      {/* 学习中实时信息 */}
                      {activeTimerTaskId === task.id && (
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
                          <progress
                            className={`${styles.progressBar} mt-1.5`}
                            value={Math.min(100, (elapsedSeconds / 60) / (task.estimatedCompletionMinutes || task.minutes) * 100)}
                            max={100}
                          />
                          <div className="flex items-center justify-between text-[11px] text-[#71717A] mt-0.5">
                            <span>{Math.floor(elapsedSeconds / 60)} / {task.estimatedCompletionMinutes || task.minutes} min</span>
                            <span>剩余 {Math.max(0, (task.estimatedCompletionMinutes || task.minutes) - Math.floor(elapsedSeconds / 60))} 分钟</span>
                          </div>
                        </div>
                      )}
                      {/* 操作区 */}
                      <div className="task-actions">
                        {activeTimerTaskId === task.id ? (
                          <>
                            {task.status === "暂停" ? (
                              <>
                                <button className="min-h-[30px] px-4 rounded-[6px] bg-[#F59E0B] text-white font-bold text-[12px]" type="button"
                                  onClick={() => resumeTimer(task)}>
                                  继续学习
                                </button>
                                <button className="min-h-[30px] px-3 rounded-[6px] bg-[#18181B] text-white font-bold text-[12px]" type="button"
                                  onClick={() => handleEndLearning(task)}>结束学习</button>
                              </>
                            ) : (
                              <>
                                <button className="min-h-[30px] px-4 rounded-[6px] bg-[#0F766E] text-white font-bold text-[12px]" type="button">⏱ 学习中</button>
                                <button className="min-h-[30px] px-3 rounded-[6px] bg-[#F4F4F5] text-[#18181B] font-bold text-[12px]" type="button"
                                  onClick={() => pauseTimer(task)}>暂停</button>
                                <button className="min-h-[30px] px-3 rounded-[6px] bg-[#18181B] text-white font-bold text-[12px]" type="button"
                                  onClick={() => handleEndLearning(task)}>结束学习</button>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <button className="min-h-[30px] px-4 rounded-[6px] bg-[#18181B] text-white font-bold text-[12px]" type="button"
                              onClick={() => startTask(task)}>开始学习</button>
                            <button className="min-h-[30px] px-3 rounded-[6px] bg-[#F4F4F5] text-[#71717A] text-[12px]" type="button"
                              onClick={() => openTaskDialog(task)}>记录结果</button>
                          </>
                        )}
                        <details className="more-menu">
                          <summary className="text-[12px] min-h-[28px] px-2 rounded-[6px] bg-[#F4F4F5] text-[#71717A] font-bold">•••</summary>
                          <div className="more-items">
                            <button className="text-button text-[12px]" type="button" onClick={() => moveTask(task.id, -1)}>提高优先级</button>
                            <button className="text-button text-[12px]" type="button" onClick={() => moveTask(task.id, 1)}>降低优先级</button>
                            <button className="text-button text-[12px]" type="button"
                              onClick={() => { updateTask(task.id, { status: "延期" }); setNotice(`已延期：${task.title}`); }}>延期到明天</button>
                            <button className="text-button text-[12px]" type="button"
                              onClick={() => { updateTask(task.id, { status: "暂停" }); setNotice(`已暂停：${task.title}`); }}>暂停任务</button>
                          </div>
                        </details>
                      </div>
                      {/* 详情折叠 */}
                      <details className="inline-details">
                        <summary className="text-[12px] text-[#71717A] font-bold">▼ 查看详情</summary>
                        <div className="flex flex-wrap gap-2 mt-2 p-2 rounded bg-[#F4F4F5]">
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-white whitespace-nowrap">教材：{task.source}</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-white whitespace-nowrap">范围：{task.range}</span>
                          {task.reason && <span className="text-[11px] text-[#71717A] w-full mt-1">原因：{task.reason}</span>}
                        </div>
                      </details>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
  );
}
