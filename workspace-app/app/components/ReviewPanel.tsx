"use client";

import type { ReviewScope, StructuredReview } from "../lib/types";
import { ReviewHistoryPanel } from "./ReviewHistoryPanel";

interface ReviewPanelProps {
  reviewScope: ReviewScope;
  setReviewScope: (s:ReviewScope) => void;
  activeReviewSubject: string;
  setActiveReviewSubject: (s:string) => void;
  reviewSubjects: string[];
  reviewMinutes: number;
  reviewTasks: { length: number };
  reviewCompletedTasks: number;
  reviewMasteryDelta: number;
  reviewAiSummary: string;
  onOpenReviewDialog: () => void;
  /** P4 Phase 1: 复盘历史记录 */
  structuredReviews?: StructuredReview[];
}

function num(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

export function ReviewPanel({
  reviewScope, setReviewScope,
  activeReviewSubject, setActiveReviewSubject,
  reviewSubjects, reviewMinutes, reviewTasks,
  reviewCompletedTasks,
  reviewMasteryDelta, reviewAiSummary,
  onOpenReviewDialog,
  structuredReviews = [],
}: ReviewPanelProps) {
  return (
    <section className="workflow workspace-pane active" id="review">
      <div className="section-heading">
        <div><div className="section-label">Review</div><h2>学习复盘</h2></div>
        <button className="secondary-button" onClick={onOpenReviewDialog}>填写复盘</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["日复盘", "周复盘", "月复盘"] as ReviewScope[]).map((scope) => (
          <button key={scope} className={`min-h-[32px] px-3 rounded-[8px] font-bold text-[13px] ${reviewScope === scope ? "bg-[#18181B] text-white" : "bg-[#F4F4F5] text-[#18181B]"}`} onClick={() => setReviewScope(scope)}>{scope}</button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {reviewSubjects.map((s) => (
          <button
            key={s}
            className={`min-h-[30px] px-3 rounded-[8px] font-bold text-[12px] ${
              activeReviewSubject === s
                ? "bg-[#18181B] text-white"
                : "bg-[#F4F4F5] text-[#18181B]"
            }`}
            onClick={() => setActiveReviewSubject(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {/* 概览指标（2026-08-01 精简：6 项 → 3 项核心指标） */}
      <div className="metric-grid review-metrics">
        <div><span>{reviewScope === "月复盘" ? "本月" : reviewScope === "周复盘" ? "本周" : "今日"}学习时长</span><strong>{num(reviewMinutes)} 分钟</strong></div>
        <div><span>完成任务</span><strong>{num(reviewCompletedTasks)}/{reviewTasks.length}</strong></div>
        <div><span>掌握度变化</span><strong>{num(reviewMasteryDelta)}%</strong></div>
      </div>

      {/* AI 总结 */}
      <div className="p-4 border border-[#E4E4E7] rounded-[8px] bg-white mb-4">
        <div className="section-label">AI {reviewScope}总结</div>
        <p className="text-[13px] text-[#71717A] leading-relaxed mt-2">{reviewAiSummary}</p>
      </div>

      {/* P4 Phase 1: 复盘历史记录面板 */}
      {structuredReviews.length > 0 && (
        <div className="mt-4 border-t border-[#E4E4E7] pt-4">
          <ReviewHistoryPanel reviews={structuredReviews} />
        </div>
      )}
    </section>
  );
}