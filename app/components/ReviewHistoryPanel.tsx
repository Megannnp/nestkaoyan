"use client";

import { useState } from "react";
import type { StructuredReview } from "../lib/types";

interface ReviewHistoryPanelProps {
  reviews: StructuredReview[];
}

/**
 * 复盘历史记录面板
 *
 * P4 Phase 1: 显示近期结构化解析记录，可查看每次解析的 aiSummary
 */
export function ReviewHistoryPanel({ reviews }: ReviewHistoryPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (reviews.length === 0) {
    return (
      <div className="p-4 text-[13px] text-[#71717A] text-center">
        暂无复盘历史记录。完成学习后填写复盘即可在此查看。
      </div>
    );
  }

  // 按日期倒序排列
  const sorted = [...reviews].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-[14px] font-bold text-[#18181B] px-1">
        复盘历史记录（{reviews.length} 条）
      </h3>
      {sorted.map((review) => {
        const isExpanded = expandedId === review.id;
        const dateStr = review.date.split("T")[0];
        const moodEmoji: Record<string, string> = {
          "较差": "😞", "一般": "😐", "正常": "🙂", "较好": "😊", "很好": "🥳",
        };

        return (
          <div
            key={review.id}
            className="border border-[#E4E4E7] rounded-[8px] bg-white overflow-hidden"
          >
            {/* 摘要行 - 始终可见 */}
            <button
              className="w-full flex items-center justify-between p-3 hover:bg-[#F4F4F5] transition-colors text-left"
              onClick={() => toggleExpand(review.id)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[13px] shrink-0">{moodEmoji[review.parsed.emotion] || "📝"}</span>
                <span className="text-[13px] text-[#18181B] font-medium">{dateStr}</span>
                <span className="text-[11px] text-[#71717A]">
                  信心 {review.parsed.confidence}%
                </span>
                {review.knowledgeImpact.length > 0 && (
                  <span className="text-[11px] text-[#71717A]">
                    · {review.knowledgeImpact.length} 个知识点更新
                  </span>
                )}
              </div>
              <span className="text-[11px] text-[#A1A1AA] shrink-0">
                {isExpanded ? "收起 ▲" : "展开 ▼"}
              </span>
            </button>

            {/* 展开详情 */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-2 border-t border-[#F1F1F3] pt-2">
                {/* 复盘内容 */}
                <div className="text-[12px] text-[#71717A] space-y-1">
                  <div><span className="font-medium text-[#18181B]">完成内容：</span>{review.rawInput.done}</div>
                  <div><span className="font-medium text-[#18181B]">困难点：</span>{review.rawInput.hard}</div>
                  <div><span className="font-medium text-[#18181B]">负荷：</span>{review.rawInput.overload}</div>
                  <div><span className="font-medium text-[#18181B]">可用时间：</span>{review.rawInput.availableTime}</div>
                  {review.rawInput.priority && (
                    <div><span className="font-medium text-[#18181B]">优先级：</span>{review.rawInput.priority}</div>
                  )}
                </div>

                {/* AI 解析字段 */}
                {review.parsed.content.length > 0 && (
                  <div className="text-[12px]">
                    <span className="font-medium text-[#18181B]">学习内容：</span>
                    <span className="text-[#71717A]">{review.parsed.content.join("、")}</span>
                  </div>
                )}
                {review.parsed.difficulty.length > 0 && (
                  <div className="text-[12px]">
                    <span className="font-medium text-[#18181B]">困难知识点：</span>
                    <span className="text-[#71717A]">{review.parsed.difficulty.join("、")}</span>
                  </div>
                )}

                {/* AI 总结 */}
                {review.aiSummary && (
                  <div className="bg-[#F4F4F5] rounded-[6px] p-2">
                    <div className="text-[11px] font-bold text-[#71717A] mb-1">AI 总结</div>
                    <p className="text-[12px] text-[#18181B] leading-relaxed">{review.aiSummary}</p>
                  </div>
                )}

                {/* 知识图谱影响 */}
                {review.knowledgeImpact.length > 0 && (
                  <div className="bg-[#F0F9F0] rounded-[6px] p-2">
                    <div className="text-[11px] font-bold text-[#71717A] mb-1">知识图谱变化</div>
                    {review.knowledgeImpact.map((impact, i) => (
                      <div key={i} className="text-[12px] text-[#18181B]">
                        {impact.nodeId}: {impact.masteryDelta > 0 ? `+${impact.masteryDelta}` : impact.masteryDelta}%
                        <span className="text-[#71717A] ml-1">({impact.reason})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}