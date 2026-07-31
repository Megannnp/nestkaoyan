"use client";

import type { Review, ReviewScope } from "../lib/types";

interface ReviewDialogProps {
  review: Review;
  setReview: (r: Review) => void;
  reviewScope: ReviewScope;
  onSubmit: () => void;
  onClose: () => void;
}

export function ReviewDialog({
  review, setReview,
  reviewScope, onSubmit, onClose,
}: ReviewDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label="填写复盘"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div><span>Review</span><strong>填写复盘</strong></div>
          <button onClick={onClose}>关闭</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div className="grid grid-cols-1 gap-3 p-4">
            {reviewScope === "月复盘" ? (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-bold text-[#71717A]">本月完成了什么？</span>
                  <input className="min-h-[38px] px-3 rounded-[8px] border border-[#D4D4D8]"
                    value={review.done}
                    onChange={(e) => setReview({ ...review, done: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-bold text-[#71717A]">哪个部分最困难？</span>
                  <input className="min-h-[38px] px-3 rounded-[8px] border border-[#D4D4D8]"
                    value={review.hard}
                    onChange={(e) => setReview({ ...review, hard: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-bold text-[#71717A]">计划是否过多或过少？</span>
                  <select className="min-h-[38px] px-3 rounded-[8px] border border-[#D4D4D8]"
                    value={review.load}
                    onChange={(e) => setReview({ ...review, load: e.target.value as Review["load"] })}
                  >
                    <option>过少</option><option>刚好</option><option>过多</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-bold text-[#71717A]">需要优先处理什么？</span>
                  <input className="min-h-[38px] px-3 rounded-[8px] border border-[#D4D4D8]"
                    value={review.priority}
                    onChange={(e) => setReview({ ...review, priority: e.target.value })}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-bold text-[#71717A]">
                    {reviewScope === "日复盘" ? "今天" : "本周"}完成了什么？
                  </span>
                  <input className="min-h-[38px] px-3 rounded-[8px] border border-[#D4D4D8]"
                    value={review.done}
                    onChange={(e) => setReview({ ...review, done: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-bold text-[#71717A]">哪个部分最困难？</span>
                  <input className="min-h-[38px] px-3 rounded-[8px] border border-[#D4D4D8]"
                    value={review.hard}
                    onChange={(e) => setReview({ ...review, hard: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-bold text-[#71717A]">计划是否过多或过少？</span>
                  <select className="min-h-[38px] px-3 rounded-[8px] border border-[#D4D4D8]"
                    value={review.load}
                    onChange={(e) => setReview({ ...review, load: e.target.value as Review["load"] })}
                  >
                    <option>过少</option><option>刚好</option><option>过多</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-bold text-[#71717A]">明天可用多少时间？</span>
                  <input className="min-h-[38px] px-3 rounded-[8px] border border-[#D4D4D8]"
                    value={review.tomorrow}
                    onChange={(e) => setReview({ ...review, tomorrow: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-bold text-[#71717A]">需要优先处理什么？</span>
                  <input className="min-h-[38px] px-3 rounded-[8px] border border-[#D4D4D8]"
                    value={review.priority}
                    onChange={(e) => setReview({ ...review, priority: e.target.value })}
                  />
                </label>
              </>
            )}
            <button className="self-start min-h-[36px] px-4 rounded-[8px] bg-[#18181B] text-white font-bold text-[13px]">
              提交复盘
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}