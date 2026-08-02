"use client";

/**
 * WorkspaceContext —— page.tsx 拆分的共享层。
 *
 * page.tsx（Home）把它的 state / 派生值 / handler 打包成一个 value 对象，经 Provider
 * 提供；抽出的视图组件（CardsView 等）通过 useWorkspace() 按需取用，避免 40-60 个
 * props 逐个透传。接口随每个视图的抽出逐步扩充——只加该视图真正用到的字段。
 */

import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type {
  Subject, GrowthCard, CardCategory, KnowledgeNode, Resource, ActiveDialog,
} from "../lib/types";

export interface WorkspaceCtx {
  // ── 常量（page.tsx 内定义，经 ctx 透出，避免各处引用被改动）──
  coreNames: string[];
  UNCATEGORIZED: string;
  ALL_GROUPS: string;

  // ── Cards 视图所需 state / 派生值 ──
  subjects: Subject[];
  activeCardSubject: string;
  cardSubjectView: string | null;
  activeCategoryName: string;
  activeCardCategory: string | null;
  categories: CardCategory[];
  subjectCategories: CardCategory[];
  subjectCards: GrowthCard[];
  dueCards: GrowthCard[];
  categoryStats: { category: CardCategory; total: number; due: number }[];
  uncategorizedCardCount: number;
  newCardDeckOpen: boolean;
  newCardDeckName: string;
  cardFilter: "待复习" | "全部" | "收藏";
  cardGroupBy: "按七核" | "按掌握度" | "按时间";
  cardMode: string;
  categoryReviewQueue: GrowthCard[];
  activeGroupCard: GrowthCard;
  categoryClampedCardIndex: number;
  cardFlipped: boolean;
  focusMode: boolean;
  visibleCategoryCards: GrowthCard[];
  hydratedTodayStr: string;
  activeDialog: ActiveDialog;
  editingCard: GrowthCard | null;
  cardDialogCategory: string;
  cardDialogSubject: string;
  cardDialogSubjectCategories: CardCategory[];
  nodes: KnowledgeNode[];
  activeResource: Resource | null;
  currentSubject: Subject | undefined;

  // ── setters ──
  setActiveCardSubject: (v: string) => void;
  setCardSubjectView: Dispatch<SetStateAction<string | null>>;
  setActiveCardCategory: Dispatch<SetStateAction<string | null>>;
  setCardIndex: Dispatch<SetStateAction<number>>;
  setCardFlipped: Dispatch<SetStateAction<boolean>>;
  setCardSubView: (v: "待复习" | "全部" | "收藏") => void;
  setRenamingCardId: Dispatch<SetStateAction<string | null>>;
  setRenamingCardName: Dispatch<SetStateAction<string>>;
  setCardMenuOpenId: Dispatch<SetStateAction<string | null>>;
  setDeletingCardId: Dispatch<SetStateAction<string | null>>;
  setNewCardDeckOpen: Dispatch<SetStateAction<boolean>>;
  setNewCardDeckName: Dispatch<SetStateAction<string>>;
  setCardFilter: Dispatch<SetStateAction<"待复习" | "全部" | "收藏">>;
  setCardGroupBy: Dispatch<SetStateAction<"按七核" | "按掌握度" | "按时间">>;
  setCardMode: Dispatch<SetStateAction<string>>;
  setFocusMode: Dispatch<SetStateAction<boolean>>;
  setCards: Dispatch<SetStateAction<GrowthCard[]>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setEditingCardId: Dispatch<SetStateAction<string | null>>;
  setActiveDialog: Dispatch<SetStateAction<ActiveDialog>>;
  setCardDialogCategory: Dispatch<SetStateAction<string>>;
  setCardDialogSubject: Dispatch<SetStateAction<string>>;

  // ── handlers ──
  openNewCardDialog: () => void;
  addCategoryInline: () => void;
  moveCard: (step: number) => void;
  reviewCard: (id: string, mastery: GrowthCard["mastery"]) => void;
  openCardSource: (card: GrowthCard) => void;
  showRelatedQuestions: (core: string, keyword?: string, subject?: string) => void;
  moveCardToCategory: (cardId: string, categoryId: string) => void;
  openEditCardDialog: (card: GrowthCard) => void;
  deleteCard: (item: GrowthCard) => void;
  pushAssistant: (text: string) => void;
}

const Ctx = createContext<WorkspaceCtx | null>(null);

export function WorkspaceProvider({ value, children }: { value: WorkspaceCtx; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
