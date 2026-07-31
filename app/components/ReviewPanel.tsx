"use client";

import type { Note, ReviewScope, StructuredReview } from "../lib/types";
import { ReviewHistoryPanel } from "./ReviewHistoryPanel";

interface ReviewPanelProps {
  reviewScope: ReviewScope;
  setReviewScope: (s: ReviewScope) => void;
  activeReviewSubject: string;
  setActiveReviewSubject: (s: string) => void;
  reviewSubjects: string[];
  reviewMinutes: number;
  reviewTasks: { length: number };
  reviewCompletedTasks: number;
  reviewNewNodes: number;
  reviewQuestions: { length: number };
  reviewDoneQuestions: number;
  reviewCards: { length: number };
  reviewReviewedCards: number;
  reviewMasteryDelta: number;
  reviewAiSummary: string;
  notes: Note[];
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
  reviewCompletedTasks, reviewNewNodes,
  reviewQuestions, reviewDoneQuestions,
  reviewCards, reviewReviewedCards,
  reviewMasteryDelta, reviewAiSummary,
  notes, onOpenReviewDialog,
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

      <div className="flex items-center gap-2 mb-4">
        <span className="text-[12px] text-[#71717A] font-semibold shrink-0">科目：</span>
        <select className="min-h-[32px] text-[13px] px-2 rounded border border-[#D4D4D8] bg-white"
          value={activeReviewSubject}
          onChange={(e) => setActiveReviewSubject(e.target.value)}
        >
          {reviewSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* 概览指标 */}
      <div className="metric-grid review-metrics">
        {reviewScope === "月复盘" ? (
          <>
            <div><span>本月学习时长</span><strong>{num(reviewMinutes)} 分钟</strong></div>
            <div><span>本月完成任务</span><strong>{num(reviewCompletedTasks)}/{reviewTasks.length}</strong></div>
            <div><span>新增重点知识点</span><strong>{num(reviewNewNodes)}</strong></div>
            <div><span>真题完成情况</span><strong>{num(reviewDoneQuestions)}/{reviewQuestions.length}</strong></div>
            <div><span>成长卡片复习</span><strong>{num(reviewReviewedCards)}/{reviewCards.length}</strong></div>
            <div><span>掌握度变化</span><strong>{num(reviewMasteryDelta)}%</strong></div>
          </>
        ) : (
          <>
            <div><span>{reviewScope === "日复盘" ? "今日" : "本周"}学习时长</span><strong>{num(reviewMinutes)} 分钟</strong></div>
            <div><span>完成任务</span><strong>{num(reviewCompletedTasks)}/{reviewTasks.length}</strong></div>
            <div><span>新增/重点知识点</span><strong>{num(reviewNewNodes)}</strong></div>
            <div><span>真题完成情况</span><strong>{num(reviewDoneQuestions)}/{reviewQuestions.length}</strong></div>
            <div><span>成长卡片复习</span><strong>{num(reviewReviewedCards)}/{reviewCards.length}</strong></div>
            <div><span>掌握度变化</span><strong>{num(reviewMasteryDelta)}%</strong></div>
          </>
        )}
      </div>

      <p className="text-[13px] text-[#71717A] leading-relaxed mb-4">{reviewAiSummary}</p>

      {/* AI 总结 */}
      <div className="p-4 border border-[#E4E4E7] rounded-[8px] bg-white mb-4">
        <div className="section-label">AI {reviewScope}总结</div>
        <p className="text-[13px] text-[#71717A] leading-relaxed mt-2">{reviewAiSummary}</p>
        <div className="note-list mt-4">
          {notes
            .filter((note) => activeReviewSubject === "全部科目" || note.tags.includes(activeReviewSubject) || note.tags.some((tag) => activeReviewSubject.includes(tag)))
            .map((note) => (
              <article key={note.id} className="p-3 rounded-[8px] bg-[#F4F4F5]">
                <strong className="block text-[13px]">{note.title}</strong>
                <p className="text-[12px] text-[#71717A] mt-1">{note.body}</p>
                <div className="flex flex-wrap gap-1 mt-2">{note.tags.map((tag) => <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded bg-white">{tag}</span>)}</div>
              </article>
            ))}
        </div>
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