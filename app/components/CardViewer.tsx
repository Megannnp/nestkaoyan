"use client";

import { useEffect } from "react";
import type { GrowthCard } from "../lib/types";

interface CardViewerProps {
  activeCard: GrowthCard;
  cardIndex: number;
  cardQueue: GrowthCard[];
  cardFlipped: boolean;
  cardMode: string;
  onFlip: () => void;
  onMove: (step: number) => void;
  onReview: (id: string, mastery: GrowthCard["mastery"]) => void;
  onFocusMode: () => void;
  onOpenSource: (card: GrowthCard) => void;
  onShowRelated: (core: string, knowledge: string, subject: string) => void;
}

export function CardViewer({
  activeCard, cardIndex, cardQueue, cardFlipped, cardMode,
  onFlip, onMove, onReview, onFocusMode, onOpenSource, onShowRelated,
}: CardViewerProps) {
  return (
    <>
      <div className={`flip-container ${cardFlipped ? "flipped" : ""}`} onClick={onFlip} style={{ minHeight: '300px', marginBottom: '16px' }}>
        <div className="flipper">
          <div className="front">
            <div className="study-card-head mb-2 w-full">
              <strong className="text-[16px]">{activeCard.title}</strong>
              <div className="flex items-center gap-2 shrink-0">
                <span className="tag-badge subtle">{activeCard.type}</span>
                <span className="text-[12px] text-[#71717A]">{cardIndex + 1}/{cardQueue.length}</span>
              </div>
            </div>
            <div className="text-[13px] text-[#71717A] mb-3 w-full text-left">
              <span className="tag-badge subtle">{activeCard.subject}</span>
              <span className="tag-badge subtle ml-1">{activeCard.core}</span>
            </div>
            <p className="text-[16px] leading-relaxed w-full text-center">
              {cardMode === "填空" ? activeCard.front.replace(/熵变公式|公式|条件/g, "______") : activeCard.front}
            </p>
            <div className="text-[12px] text-[#71717A] mt-4">点击或按 Space 翻面</div>
          </div>
          <div className="back">
            <div className="study-card-head mb-2 w-full"><strong className="text-[16px]">{activeCard.title}</strong></div>
            <p className="text-[16px] leading-relaxed w-full text-center">{activeCard.back}</p>
            <div className="flex flex-wrap gap-1 mt-4 justify-center">
              {activeCard.note && <span className="tag-badge amber">{activeCard.note}</span>}
              <span className="tag-badge subtle">来源：{activeCard.source}</span>
            </div>
            <div className="text-[12px] text-[#71717A] mt-3">点击或按 Space 看正面</div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-[#71717A] font-semibold mr-1">快捷键：</span>
        <span className="kbd-hint">Space</span><span className="text-[11px] text-[#71717A]">翻面</span>
        <span className="kbd-hint ml-1">←</span><span className="text-[11px] text-[#71717A]">上一张</span>
        <span className="kbd-hint ml-1">→</span><span className="text-[11px] text-[#71717A]">下一张</span>
        <span className="kbd-hint ml-1">1</span><span className="text-[11px] text-[#71717A]">认识</span>
        <span className="kbd-hint ml-1">2</span><span className="text-[11px] text-[#71717A]">模糊</span>
        <span className="kbd-hint ml-1">3</span><span className="text-[11px] text-[#71717A]">不会</span>
      </div>
      <div className="text-[12px] text-[#71717A] mb-3">下次复习：{activeCard.nextReviewAt} · 当前掌握：{activeCard.mastery}</div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="min-h-[32px] px-3 rounded-[8px] bg-[#F4F4F5] text-[#18181B] font-bold text-[13px]" onClick={() => onMove(-1)} disabled={cardIndex === 0}>上一张</button>
        <button className="min-h-[32px] px-3 rounded-[8px] bg-[#F4F4F5] text-[#18181B] font-bold text-[13px]" onClick={onFlip}>{cardFlipped ? "看正面" : "翻面"}</button>
        <button className="min-h-[32px] px-3 rounded-[8px] bg-[#F4F4F5] text-[#18181B] font-bold text-[13px]" onClick={() => onMove(1)} disabled={cardIndex >= cardQueue.length - 1}>下一张</button>
        <button className="min-h-[32px] px-3 rounded-[8px] bg-[#4CAF74] text-white font-bold text-[13px]" onClick={() => onReview(activeCard.id, "认识")}>认识 [1]</button>
        <button className="min-h-[32px] px-3 rounded-[8px] bg-[#C89B4A] text-white font-bold text-[13px]" onClick={() => onReview(activeCard.id, "模糊")}>模糊 [2]</button>
        <button className="min-h-[32px] px-3 rounded-[8px] bg-[#B5655D] text-white font-bold text-[13px]" onClick={() => onReview(activeCard.id, "不会")}>不会 [3]</button>
        <button className="min-h-[32px] px-3 rounded-[8px] bg-[#18181B] text-white font-bold text-[13px]" onClick={onFocusMode}>专注学习</button>
        <details className="more-menu">
          <summary className="text-[12px]">更多</summary>
          <div className="more-items">
            <button className="text-button text-[12px]" onClick={() => onOpenSource(activeCard)}>查看来源</button>
            <button className="text-button text-[12px]" onClick={() => onShowRelated(activeCard.core, activeCard.knowledge, activeCard.subject)}>相关真题</button>
          </div>
        </details>
      </div>
    </>
  );
}

interface FocusModeProps {
  activeCard: GrowthCard;
  cardFlipped: boolean;
  onFlip: () => void;
  onReview: (id: string, mastery: GrowthCard["mastery"]) => void;
  onClose: () => void;
}

export function FocusMode({ activeCard, cardFlipped, onFlip, onReview, onClose }: FocusModeProps) {
  // Escape 关闭专注模式（与 CardViewer 快捷键体系一致；FocusMode 自身不拦截 1/2/3/空格）
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    // 遮罩点击仅关闭「专注模式」容器内的内部点击不会意外退出：
    // focus-card 内 stopPropagation；focus-card 容器外点遮罩才退出（用户需明确点击外部区域）
    <div className="focus-overlay" onClick={onClose}>
      <div className="focus-card" onClick={(e) => e.stopPropagation()}>
        <div className={`flip-container ${cardFlipped ? "flipped" : ""}`} onClick={onFlip} style={{ minHeight: '340px' }}>
          <div className="flipper">
            <div className="front">
              <div className="text-[14px] font-bold text-[#52525B] mb-3">{activeCard.subject} / {activeCard.core}</div>
              <p className="text-[20px] leading-relaxed">{activeCard.front}</p>
            </div>
            <div className="back">
              <div className="text-[14px] font-bold text-[#52525B] mb-3">答案</div>
              <p className="text-[18px] leading-relaxed">{activeCard.back}</p>
            </div>
          </div>
        </div>
        <div className="flex justify-center gap-3 mt-4">
          <button className="min-h-[36px] px-4 rounded-[8px] bg-[#4CAF74] text-white font-bold text-[13px]" onClick={() => { onReview(activeCard.id, "认识"); onClose(); }}>认识 [1]</button>
          <button className="min-h-[36px] px-4 rounded-[8px] bg-[#C89B4A] text-white font-bold text-[13px]" onClick={() => { onReview(activeCard.id, "模糊"); onClose(); }}>模糊 [2]</button>
          <button className="min-h-[36px] px-4 rounded-[8px] bg-[#B5655D] text-white font-bold text-[13px]" onClick={() => { onReview(activeCard.id, "不会"); onClose(); }}>不会 [3]</button>
          <button className="min-h-[36px] px-4 rounded-[8px] bg-[#F4F4F5] text-[#18181B] font-bold text-[13px]" onClick={onClose}>退出</button>
        </div>
      </div>
    </div>
  );
}