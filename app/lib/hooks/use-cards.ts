/**
 * useCards — 卡片 CRUD + 间隔复习 Hook
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import type { GrowthCard, CardDeck } from "../types";
import { seedCards, seedDecks } from "../default-data";
import { CARD_REVIEW_INTERVALS } from "../rules";

export function useCards(initialCards?: GrowthCard[], initialDecks?: CardDeck[]) {
  const [cards, setCards] = useState<GrowthCard[]>(initialCards ?? seedCards);
  const [decks, setDecks] = useState<CardDeck[]>(initialDecks ?? seedDecks);

  const addCard = useCallback((card: GrowthCard) => {
    setCards((prev) => [...prev, card]);
    if (card.deckId) {
      setDecks((prev) =>
        prev.map((d) =>
          d.id === card.deckId
            ? { ...d, cardIds: [...d.cardIds, card.id] }
            : d
        )
      );
    }
  }, []);

  const updateCard = useCallback((id: string, updates: Partial<GrowthCard>) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }, []);

  const removeCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    setDecks((prev) =>
      prev.map((d) => ({ ...d, cardIds: d.cardIds.filter((cid) => cid !== id) }))
    );
  }, []);

  /** 获取当前需要复习的卡片（今日到期或已过期） */
  const dueCards = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return cards.filter((c) => c.nextReviewAt <= today);
  }, [cards]);

  /** 更新卡片掌握度和下次复习时间 */
  const reviewCard = useCallback(
    (cardId: string, mastery: "不会" | "模糊" | "认识" | "熟练" | "稳定") => {
      const interval = CARD_REVIEW_INTERVALS[mastery] || 1;
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + interval);
      updateCard(cardId, {
        mastery,
        lastReviewed: new Date().toISOString(),
        nextReviewAt: nextDate.toISOString().slice(0, 10),
      });
    },
    [updateCard]
  );

  return {
    cards,
    setCards,
    decks,
    setDecks,
    addCard,
    updateCard,
    removeCard,
    reviewCard,
    dueCards,
  };
}