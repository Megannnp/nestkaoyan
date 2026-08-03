"use client";

import { useWorkspace } from "./workspace-context";
import type { MasteryText, StudyMood } from "../lib/types";

/** 学习结果记录弹窗（从 page.tsx 抽出，行为等价）；数据/回调经 useWorkspace() 取用。 */
export function TaskCompletionModal() {
  const {
    activeTask, masteryOptions, moodOptions, timerStartTime,
    completionModalAllowEditTime, completionModalCustomEndTime, completionModalCustomMinutes, closeConfirmPending,
    completeTask, updateTask, requestCloseTaskDialog, markTaskDraftDirty, setActiveDialog,
    setCompletionModalAllowEditTime, setCompletionModalCustomMinutes, setCloseConfirmPending,
  } = useWorkspace();
  if (!activeTask) return null;
  return (
        <>
          <div className="modal-backdrop" role="presentation" onClick={requestCloseTaskDialog}>
            <section className="modal-panel compact-modal" role="dialog" aria-modal="true" aria-label="记录学习结果" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head">
                <div><span>今日任务</span><strong>{activeTask.title}</strong></div>
                <button onClick={requestCloseTaskDialog}>关闭</button>
              </div>
              <div className="mini-form modal-form">
                {/* 时间信息 — 自动计算，可编辑 */}
                <div className="p-3 mb-3 rounded-[8px] bg-[#F4F4F5]">
                  <div className="text-[11px] font-bold text-[#52525B] mb-2">本次学习</div>
                  <div className="flex items-center gap-4 text-[12px]">
                    <span>开始 <strong>{activeTask.startedAt || timerStartTime || "--"}</strong></span>
                    <span>结束 <strong>{completionModalCustomEndTime}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[12px]">
                    <span>实际</span>
                    {completionModalAllowEditTime ? (
                      <input
                        className="w-[60px] min-h-[28px] text-[13px] text-center rounded border border-[#D4D4D8]"
                        value={completionModalCustomMinutes}
                        onChange={(e) => {
                          setCompletionModalCustomMinutes(e.target.value);
                          markTaskDraftDirty(activeTask, { customMinutes: e.target.value });
                        }}
                        autoFocus
                      />
                    ) : (
                      <strong className="text-[#0F766E]">{completionModalCustomMinutes} 分钟</strong>
                    )}
                    <span className="text-[#71717A]">分钟</span>
                    {!completionModalAllowEditTime ? (
                      <button
                        className="text-[11px] px-1.5 py-0.5 rounded bg-white text-[#71717A] hover:text-[#18181B] border border-[#D4D4D8]"
                        onClick={() => setCompletionModalAllowEditTime(true)}
                      >
                        ✏ 编辑
                      </button>
                    ) : (
                      <button
                        className="text-[11px] px-1.5 py-0.5 rounded bg-white text-[#0F766E] border border-[#0F766E]"
                        onClick={() => setCompletionModalAllowEditTime(false)}
                      >
                        确认
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] text-[#A1A1AA] mt-1">如中途暂停或接电话可点击编辑修改时间</div>
                </div>
                <label><span>掌握程度</span><select value={activeTask.mastery} onChange={(event) => {
                  const mastery = event.target.value as MasteryText;
                  updateTask(activeTask.id, { mastery });
                  markTaskDraftDirty(activeTask, { mastery });
                }}>{masteryOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>正确率%</span><input value={activeTask.accuracy} onChange={(event) => {
                  const accuracy = event.target.value;
                  updateTask(activeTask.id, { accuracy });
                  markTaskDraftDirty(activeTask, { accuracy });
                }} placeholder="可选" /></label>
                <label><span>学习状态</span><select value={activeTask.mood} onChange={(event) => {
                  const mood = event.target.value as StudyMood;
                  updateTask(activeTask.id, { mood });
                  markTaskDraftDirty(activeTask, { mood });
                }}>{moodOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className="wide-field"><span>困难/错因</span><input value={activeTask.note} onChange={(event) => {
                  const note = event.target.value;
                  updateTask(activeTask.id, { note });
                  markTaskDraftDirty(activeTask, { note });
                }} placeholder="例如：判断过程类型时容易混淆" /></label>
                <button onClick={() => { completeTask(activeTask.id); setActiveDialog(null); }} type="button">保存并完成</button>
              </div>
            </section>
          </div>

        {/* ─── UX Sprint: 关闭确认（存在未保存内容时）─── */}
        {closeConfirmPending && (
          <div className="modal-backdrop" role="presentation">
            <section className="modal-panel compact-modal" role="dialog" aria-modal="true" aria-label="放弃未保存的学习记录" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head">
                <div><span>未保存的内容</span><strong>放弃未保存的学习记录？</strong></div>
              </div>
              <div className="p-4">
                <p className="text-[13px] text-[#71717A] leading-relaxed mb-4">已填写的内容已自动保存为草稿，关闭后再次进入该任务仍可恢复，不会丢失。</p>
                <div className="flex justify-end gap-2">
                  <button
                    className="min-h-[34px] px-4 rounded-[8px] bg-[#F4F4F5] text-[#18181B] font-bold text-[13px]"
                    onClick={() => setCloseConfirmPending(false)}
                  >
                    继续编辑
                  </button>
                  <button
                    className="min-h-[34px] px-4 rounded-[8px] bg-[#18181B] text-white font-bold text-[13px]"
                    onClick={() => { setCloseConfirmPending(false); setActiveDialog(null); }}
                  >
                    放弃退出
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
        </>
  );
}
