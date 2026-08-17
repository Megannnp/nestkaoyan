"use client";

import { useWorkspace } from "./workspace-context";
import styles from "../../styles/workspace.module.css";

/** 今日任务视图（从 page.tsx 抽出，行为等价）；数据/回调经 useWorkspace() 取用。
 *  2026-08-03 用户反馈：首页展示结论，详情展示依据。
 *  默认卡片只显示「要复习什么 / 为什么（一句话）/ 掌握度」，AI 推理细节全部收进「查看详情」。 */
export function DashboardTasksView() {
  const {
    tasks, activeTimerTaskId, timerStartTime, elapsedSeconds,
    updateTask, toggleTaskDone, moveTask, startTask, pauseTimer, resumeTimer, handleEndLearning,
    openTaskDialog, openResourceDialog, runPrompt, setNotice,
  } = useWorkspace();
  return (
          <section className="hero-grid workspace-pane active dashboard-hero" id="today">
            {/* Engine Panel — Tasks */}
            <div className="engine-panel" id="today">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="section-label">今日学习</div>
                  <h2 className="mb-0">任务与完成记录</h2>
                </div>
                <div className="flex items-center gap-2 shrink-0" />
              </div>
              {/* AI 总览（保留一条结论性建议，不讲推理过程） */}
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
                {tasks.some((t) => t.aiRecommended) && <p className="text-[12px] text-[#71717A]">今天建议优先稳定薄弱知识点，不急于进入新章节。</p>}
              </div>
              {/* 2026-08-03 体验优化 #1：空工作台引导卡（新用户刚完成向导，无任务时给下一步指引） */}
              {tasks.length === 0 && (
                <div className="mt-4 p-6 rounded-[12px] border border-[#E4E4E7] bg-white">
                  <div className="text-[18px] font-bold text-[#18181B] mb-2">开始你的学习</div>
                  <p className="text-[13px] text-[#71717A] leading-relaxed mb-4">先把你的资料（教材 / 真题 / 辅导书）上传到系统，AI 就能为你生成今日任务。</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="inline-flex items-center min-h-[34px] px-4 rounded-[8px] bg-[#18181B] text-white font-bold text-[13px]"
                      onClick={() => openResourceDialog()}
                    >
                      📚 去上传资料
                    </button>
                    <button
                      className="inline-flex items-center min-h-[34px] px-4 rounded-[8px] bg-[#F4F4F5] text-[#18181B] font-bold text-[13px]"
                      onClick={() => runPrompt("制定今天学习计划")}
                    >
                      ⚡ 先生成计划
                    </button>
                  </div>
                </div>
              )}
              {tasks.length > 0 && (
              <div className="mt-4 task-stack">
                {tasks.map((task) => (
                  <article className={`task-row ${task.done ? "done" : ""}`} key={task.id}>
                    <label className="task-check">
                      <input type="checkbox" checked={task.done} onChange={() => toggleTaskDone(task)} />
                    </label>
                    <div className="task-content">
                      {/* ─── 默认状态：只展示结论 ─── */}
                      <div className="task-title-row">
                        <strong>{task.title}</strong>
                        {task.aiRecommended && <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#EDEDED] text-[#52525B] font-bold">AI推荐</span>}
                        <span className="task-duration">{task.estimatedCompletionMinutes || task.minutes} 分钟</span>
                      </div>
                      <span className="text-[12px]">{task.subject} · {task.core}</span>
                      {/* 掌握度（当前值，不展示前后对比） */}
                      <div className="flex items-center gap-2 text-[12px] text-[#71717A] mt-0.5">
                        <span>掌握度</span>
                        <strong className="font-bold text-[#18181B]">{task.masteryBefore}%</strong>
                      </div>
                      {/* 一句话学习目标（用户可理解的语言，保留） */}
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

                      {/* 操作区：开始学习 / 记录结果 / 更多菜单 */}
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
                                <button className="min-h-[30px] px-4 rounded-[6px] bg-[#18181B] text-white font-bold text-[12px]" type="button">⏱ 学习中</button>
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
                              onClick={() => openTaskDialog(task)}>查看记录</button>
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

                      {/* ─── 查看详情：学习详情（2026-08-03 用户反馈：换成学生学习视角，不再是 AI 分析报告） ─── */}
                      <details className="inline-details">
                        <summary className="text-[12px] text-[#71717A] font-bold">▼ 查看详情</summary>
                        <div className="mt-2 p-3 rounded bg-[#F4F4F5] space-y-3">
                          <div>
                            <div className="text-[11px] font-bold text-[#52525B] mb-0.5">学习目标</div>
                            <p className="text-[12px] text-[#18181B] leading-snug">{task.standard}</p>
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-[#52525B] mb-0.5">薄弱原因</div>
                            <p className="text-[12px] text-[#71717A] leading-snug">
                              {task.aiRecommended
                                ? (task.aiReasonMistakeCount ? task.aiReasonMistakeCount : task.reason || "需要加强")
                                : (task.reason || "需要加强")}
                            </p>
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-[#52525B] mb-0.5">相关内容</div>
                            <p className="text-[12px] text-[#71717A] leading-snug">来源：{task.source}{task.range ? ` · ${task.range}` : ""}</p>
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-[#52525B] mb-0.5">学习记录</div>
                            <p className="text-[12px] text-[#71717A] leading-snug">
                              掌握度 <span className="font-bold text-[#18181B]">{task.masteryBefore}%</span>
                              <span className="text-[#A1A1AA]"> → </span>
                              <span className="font-bold text-[#18181B]">{task.masteryAfter}%</span>
                            </p>
                          </div>
                        </div>
                      </details>
                    </div>
                  </article>
                ))}
              </div>
              )}
            </div>
          </section>
  );
}