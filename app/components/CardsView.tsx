"use client";

import { CardViewer, FocusMode } from "./CardViewer";
import { useWorkspace } from "./workspace-context";
import { makeId, today, dateOnly } from "../lib/utils";
import type { GrowthCard } from "../lib/types";

/**
 * 成长卡片视图（从 page.tsx 抽出，行为等价）。
 * 数据/回调经 useWorkspace() 取用，不改动任何交互逻辑。
 */
export function CardsView() {
  const {
    coreNames, UNCATEGORIZED, ALL_GROUPS,
    subjects, activeCardSubject, cardSubjectView, activeCategoryName, activeCardCategory,
    categories, subjectCategories, subjectCards, dueCards, categoryStats, uncategorizedCardCount,
    newCardDeckOpen, newCardDeckName, cardFilter, cardGroupBy, cardMode,
    categoryReviewQueue, activeGroupCard, categoryClampedCardIndex, cardFlipped, focusMode,
    visibleCategoryCards, hydratedTodayStr, activeDialog, editingCard,
    renamingCardId, renamingCardName, deletingCardId,
    cardDialogCategory, cardDialogSubject, cardDialogSubjectCategories, nodes, activeResource, currentSubject,
    setActiveCardSubject, setCardSubjectView, setActiveCardCategory, setCardIndex, setCardFlipped,
    setCardSubView, setRenamingCardId, setRenamingCardName, setCardMenuOpenId, setDeletingCardId,
    setNewCardDeckOpen, setNewCardDeckName, setCardFilter, setCardGroupBy, setCardMode, setFocusMode,
    setCards, setCategories, setNotice, setEditingCardId, setActiveDialog, setCardDialogCategory, setCardDialogSubject,
    openNewCardDialog, addCategoryInline, moveCard, reviewCard, openCardSource, showRelatedQuestions,
    moveCardToCategory, openEditCardDialog, deleteCard, pushAssistant,
  } = useWorkspace();

  return (
          <section className="knowledge workspace-pane active" id="cards">
            <div className="section-heading">
              <div><div className="section-label">Growth Cards</div><h2>{cardSubjectView ? activeCategoryName : "成长卡片"}</h2></div>
              {/* 黑白灰统一按钮风格：Primary 黑底白字（开始复习）；Secondary 白底浅灰边框黑字（返回/新建/管理） */}
              <div className="flex items-center gap-3 shrink-0 flex-wrap">
                {cardSubjectView ? (
                  <>
                    {/* 返回 — Secondary（最低权重，放最左） */}
                    <button
                      className="min-h-[32px] px-3 rounded-[8px] bg-white border border-[#D4D4D8] text-[#18181B] font-bold text-[13px] hover:bg-[#F4F4F5] transition-colors"
                      onClick={() => { setCardSubjectView(null); setActiveCardCategory(null); setCardIndex(0); setCardFlipped(false); }}
                    >← 返回</button>
                    {/* 新建卡片 — Secondary（中权重） */}
                    <button
                      className="min-h-[32px] px-3 rounded-[8px] bg-white border border-[#D4D4D8] text-[#18181B] font-bold text-[13px] hover:bg-[#F4F4F5] transition-colors"
                      onClick={openNewCardDialog}
                    >新建卡片</button>
                    {/* 开始复习 — Primary（最高权重，放最右） */}
                    <button
                      className="min-h-[32px] px-3 rounded-[8px] bg-[#18181B] text-white font-bold text-[13px] hover:opacity-90 transition-opacity"
                      onClick={() => { setCardSubView("待复习"); setCardIndex(0); setCardFlipped(false); }}
                    >开始复习</button>
                    {activeCardCategory !== ALL_GROUPS && activeCardCategory !== UNCATEGORIZED && (
                      <button
                        className="min-h-[32px] px-3 rounded-[8px] bg-white border border-[#D4D4D8] text-[#18181B] font-bold text-[13px] hover:bg-[#F4F4F5] transition-colors"
                        onClick={() => { const cat = categories.find((c) => c.id === activeCardCategory); if (cat) { setRenamingCardId(cat.id); setRenamingCardName(cat.name); setCardMenuOpenId(null); } }}
                      >✏️ 重命名卡片组</button>
                    )}
                    {activeCardCategory !== ALL_GROUPS && activeCardCategory !== UNCATEGORIZED && (
                      <button
                        className="min-h-[32px] px-3 rounded-[8px] bg-white border border-[#D4D4D8] text-[#EF4444] font-bold text-[13px] hover:bg-[#FEF2F2] transition-colors"
                        onClick={() => { if (activeCardCategory && activeCardCategory !== ALL_GROUPS && activeCardCategory !== UNCATEGORIZED) setDeletingCardId(activeCardCategory); }}
                      >🗑️ 删除卡片组</button>
                    )}
                  </>
                ) : (
                  <>
                    {/* 新建卡片组 — Secondary（中权重） */}
                    <button
                      className="min-h-[32px] px-3 rounded-[8px] bg-white border border-[#D4D4D8] text-[#18181B] font-bold text-[13px] hover:bg-[#F4F4F5] transition-colors"
                      onClick={() => { document.getElementById("new-card-deck-form")?.scrollIntoView({ behavior: "smooth" }); (document.getElementById("new-card-deck-input") as HTMLInputElement | null)?.focus(); }}
                    >新建卡片组</button>
                    {/* 开始复习 — Primary（最高权重，放最右） */}
                    <button
                      className="min-h-[32px] px-3 rounded-[8px] bg-[#18181B] text-white font-bold text-[13px] hover:opacity-90 transition-opacity"
                      onClick={() => { setCardSubjectView(activeCardSubject || subjects[0]?.name || ""); setActiveCardCategory(ALL_GROUPS); setCardSubView("待复习"); setCardIndex(0); setCardFlipped(false); }}
                    >开始复习</button>
                  </>
                )}
              </div>
            </div>

            {/* 成长卡片首页：仅管理/展示该学科的卡片组（点击卡片组进入学习空间） */}
            {!cardSubjectView && (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  {subjects.map((subject) => (
                    <button
                      key={subject.id}
                      className={`min-h-[30px] px-3 rounded-[8px] font-bold text-[12px] ${
                        activeCardSubject === subject.name
                          ? "bg-[#18181B] text-white"
                          : "bg-[#F4F4F5] text-[#18181B]"
                      }`}
                      onClick={() => setActiveCardSubject(subject.name)}
                    >
                      {subject.name}
                    </button>
                  ))}
                </div>

                {/* 该学科全部卡片组网格：全部卡片 / 自定义卡片组 / 未分类 / 新建卡片组 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 全部卡片组（虚拟组）— 样式与知识中心三个入口完全一致 */}
                  <div
                    role="button"
                    tabIndex={0}
                    className="p-6 rounded-[12px] border border-[#E4E4E7] bg-white text-left cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => { setCardSubjectView(activeCardSubject); setActiveCardCategory(ALL_GROUPS); setCardSubView("待复习"); setCardIndex(0); setCardFlipped(false); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCardSubjectView(activeCardSubject); setActiveCardCategory(ALL_GROUPS); setCardSubView("待复习"); setCardIndex(0); setCardFlipped(false); } }}
                  >
                    <div className="text-[24px] mb-2">🗂️</div>
                    <strong className="text-[16px] block mb-1">全部卡片</strong>
                    <span className="text-[13px] text-[#71717A]">{subjectCards.length} 张卡片 · 待复习 {dueCards.length}</span>
                  </div>
                  {/* 自定义卡片组 — 样式与知识中心三个入口完全一致（右上角保持 hover ⋯ 管理） */}
                  {categoryStats.map(({ category, total, due }) => (
                    <div
                      key={category.id}
                      role="button"
                      tabIndex={0}
                      className="group p-6 rounded-[12px] border border-[#E4E4E7] bg-white text-left cursor-pointer hover:shadow-md transition-shadow relative"
                      onClick={() => { setCardSubjectView(activeCardSubject); setActiveCardCategory(category.id); setCardSubView("待复习"); setCardIndex(0); setCardFlipped(false); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCardSubjectView(activeCardSubject); setActiveCardCategory(category.id); setCardSubView("待复习"); setCardIndex(0); setCardFlipped(false); } }}
                    >
                      <div className="text-[24px] mb-2">📁</div>
                      <strong className="text-[16px] block mb-1 pr-12">{category.name}</strong>
                      <span className="text-[13px] text-[#71717A]">{total} 张卡片 · 待复习 {due}</span>
                      {/* 始终可见的操作按钮：直接点击执行，不依赖 hover/弹层/外部监听，确保可用 */}
                      <span className="absolute top-3 right-2 z-10 flex items-center gap-0.5">
                        <button
                          type="button"
                          className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#18181B] transition-colors"
                          title="重命名卡片组"
                          aria-label="重命名卡片组"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setRenamingCardId(category.id);
                            setRenamingCardName(category.name);
                          }}
                        >
                          <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zM19.5 7.125L16.875 4.5" /></svg>
                        </button>
                        <button
                          type="button"
                          className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#71717A] hover:bg-[#FEF2F2] hover:text-[#EF4444] transition-colors"
                          title="删除卡片组"
                          aria-label="删除卡片组"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setDeletingCardId(category.id);
                          }}
                        >
                          <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                        </button>
                      </span>
                    </div>
                  ))}
                  {/* 未分类卡片组（系统固定，最后）— 样式与知识中心三个入口完全一致 */}
                  <div
                    role="button"
                    tabIndex={0}
                    className="p-6 rounded-[12px] border border-[#E4E4E7] bg-white text-left cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => { setCardSubjectView(activeCardSubject); setActiveCardCategory(UNCATEGORIZED); setCardSubView("待复习"); setCardIndex(0); setCardFlipped(false); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCardSubjectView(activeCardSubject); setActiveCardCategory(UNCATEGORIZED); setCardSubView("待复习"); setCardIndex(0); setCardFlipped(false); } }}
                  >
                    <div className="text-[24px] mb-2">📄</div>
                    <strong className="text-[16px] block mb-1">未分类</strong>
                    <span className="text-[13px] text-[#71717A]">{uncategorizedCardCount} 张卡片</span>
                  </div>
                  {/* 新建卡片组（样式与知识中心入口一致，但允许新建；点击展开输入框，创建后自动收起） */}
                  <div className="p-6 rounded-[12px] border-2 border-dashed border-[#D4D4D8] bg-[#FAFAFA]">
                    {!newCardDeckOpen ? (
                      <button
                        className="w-full text-left text-[#71717A] hover:text-[#18181B] transition-colors"
                        onClick={() => { setNewCardDeckOpen(true); setCardMenuOpenId(null); }}
                      >
                        <div className="text-[24px] mb-2">➕</div>
                        <strong className="text-[16px] block mb-1 text-[#18181B]">新建卡片组</strong>
                        <span className="text-[13px] text-[#71717A]">创建后自动收起</span>
                      </button>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <strong className="text-[14px] text-[#18181B]">卡片组名称</strong>
                        <input
                          autoFocus
                          value={newCardDeckName}
                          onChange={(e) => setNewCardDeckName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategoryInline(); } if (e.key === "Escape") { setNewCardDeckOpen(false); setNewCardDeckName(""); } }}
                          placeholder="最多 30 字"
                          maxLength={30}
                          className="min-h-[36px] text-[13px] px-3 rounded-[8px] border border-[#D4D4D8] bg-white focus:outline-none focus:ring-2 focus:ring-[#18181B]/10"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="min-h-[32px] px-3 rounded-[8px] bg-[#F4F4F5] text-[#71717A] font-bold text-[12px]"
                            onClick={() => { setNewCardDeckOpen(false); setNewCardDeckName(""); }}
                          >取消</button>
                          <button
                            className="min-h-[32px] px-4 rounded-[8px] bg-[#18181B] text-white font-bold text-[12px]"
                            onClick={addCategoryInline}
                          >创建</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* 学科内视图：先切换学科 Tab，再展示概览/分类/卡片 */}
            {cardSubjectView && (
              <>
                {/* 卡片组学习空间：学科 Tab 保持当前卡片组学习空间；统计/筛选/翻卡全部在此完成 */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {subjects.map((subject) => (
                    <button
                      key={subject.id}
                      className={`min-h-[30px] px-3 rounded-[8px] font-bold text-[12px] ${
                        activeCardSubject === subject.name
                          ? "bg-[#18181B] text-white"
                          : "bg-[#F4F4F5] text-[#18181B]"
                      }`}
                      onClick={() => { setActiveCardSubject(subject.name); setActiveCardCategory(ALL_GROUPS); setCardSubView("待复习"); setCardIndex(0); setCardFlipped(false); }}
                    >
                      {subject.name}
                    </button>
                  ))}
                </div>

                {/* ─── 信息架构（2026-08-01）：状态筛选 × 分组方式 两个独立维度 ─── */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-[#A1A1AA] mr-0.5">状态</span>
                    {(["待复习", "全部", "收藏"] as const).map((view) => (
                      <button
                        key={view}
                        className={`min-h-[28px] px-3 rounded-[8px] font-bold text-[12px] ${cardFilter === view ? "bg-[#18181B] text-white" : "bg-[#F4F4F5] text-[#18181B]"}`}
                        onClick={() => setCardFilter(view)}
                      >
                        {view}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-[#A1A1AA] mr-0.5">分组</span>
                    {(["按七核", "按掌握度", "按时间"] as const).map((g) => (
                      <button
                        key={g}
                        className={`min-h-[28px] px-3 rounded-[8px] font-bold text-[12px] ${cardGroupBy === g ? "bg-[#18181B] text-white" : "bg-[#F4F4F5] text-[#18181B]"}`}
                        onClick={() => setCardGroupBy(g)}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 多模式学习（PRD 3.4）：背诵 / 填空 / 推导 / 条件辨析 */}
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-[11px] font-bold text-[#A1A1AA] mr-0.5">模式</span>
                  {(["背诵", "填空", "推导", "条件辨析"] as const).map((mode) => (
                    <button
                      key={mode}
                      className={`min-h-[28px] px-3 rounded-[8px] font-bold text-[12px] ${cardMode === mode ? "bg-[#18181B] text-white" : "bg-[#F4F4F5] text-[#18181B]"}`}
                      onClick={() => setCardMode(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {/* 待复习（状态=待复习）→ 卡片复习器（仅当前卡片组范围） */}
                {cardFilter === "待复习" && (
                  categoryReviewQueue.length > 0 ? (
                    <CardViewer
                      activeCard={activeGroupCard}
                      cardIndex={categoryClampedCardIndex} cardQueue={categoryReviewQueue}
                      cardFlipped={cardFlipped} cardMode={cardMode}
                      onFlip={() => setCardFlipped(!cardFlipped)}
                      onMove={moveCard}
                      onReview={reviewCard}
                      onFocusMode={() => setFocusMode(!focusMode)}
                      onOpenSource={openCardSource}
                      onShowRelated={showRelatedQuestions}
                    />
                  ) : (
                    <p className="empty-state">该卡片组暂无待复习卡片</p>
                  )
                )}

                {/* 分组=按七核（默认）：按 core 分组统计当前筛选卡片 */}
                {cardGroupBy === "按七核" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {coreNames.map((core) => {
                      const coreCards = visibleCategoryCards.filter((card) => card.core === core);
                      if (coreCards.length === 0) return null;
                      return (
                        <article key={core} className="p-3 rounded-[8px] border border-[#E4E4E7] bg-white">
                          <strong className="text-[13px] block mb-2">{core}</strong>
                          <span className="text-[12px] text-[#71717A]">{coreCards.length} 张卡片</span>
                        </article>
                      );
                    })}
                  </div>
                )}

                {/* 分组=按掌握度：按 mastery 分组统计当前筛选卡片 */}
                {cardGroupBy === "按掌握度" && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {(["不会", "模糊", "认识", "熟练"] as const).map((mastery) => {
                      const masteryCards = visibleCategoryCards.filter((card) => card.mastery === mastery);
                      if (masteryCards.length === 0) return null;
                      return (
                        <article key={mastery} className="p-3 rounded-[8px] border border-[#E4E4E7] bg-white">
                          <strong className="text-[13px] block mb-2">{mastery}</strong>
                          <span className="text-[12px] text-[#71717A]">{masteryCards.length} 张卡片</span>
                        </article>
                      );
                    })}
                  </div>
                )}

                {/* 分组=按时间：按复习时间/到期状态统计当前筛选卡片 */}
                {cardGroupBy === "按时间" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { label: "未复习", list: visibleCategoryCards.filter((card) => card.lastReviewed === "未复习") },
                      { label: "到期复习", list: visibleCategoryCards.filter((card) => card.lastReviewed !== "未复习" && (!card.nextReviewAt || card.nextReviewAt <= hydratedTodayStr)) },
                      { label: "未来复习", list: visibleCategoryCards.filter((card) => card.lastReviewed !== "未复习" && card.nextReviewAt > hydratedTodayStr) },
                    ].map((group) => (
                      group.list.length > 0 ? (
                        <article key={group.label} className="p-3 rounded-[8px] border border-[#E4E4E7] bg-white">
                          <strong className="text-[13px] block mb-2">{group.label}</strong>
                          <span className="text-[12px] text-[#71717A]">{group.list.length} 张卡片</span>
                        </article>
                      ) : null
                    ))}
                    {visibleCategoryCards.length === 0 && <p className="empty-state">当前筛选下暂无卡片。</p>}
                  </div>
                )}

                {/* 状态=全部/收藏 → 该卡片组卡片网格（含移动到其他卡片组管理） */}
                {(cardFilter === "全部" || cardFilter === "收藏") && (
                  <div className="card-grid">
                    {visibleCategoryCards.map((card) => (
                      <article className="study-card" key={card.id}>
                        <div className="study-card-head">
                          <strong>{card.title}</strong>
                          <span>{card.type}</span>
                        </div>
                        <p className="text-[13px]">{cardMode === "填空" ? card.front.replace(/熵变公式|公式|条件/g, "______") : card.front}</p>
                        <details>
                          <summary>{cardMode === "背诵" ? "查看背面" : "查看参考答案"}</summary>
                          <p className="text-[13px]">{card.back}</p>
                        </details>
                        <div className="subject-meta">
                          <span>{card.subject}</span><span>{card.core}</span><span>{card.knowledge}</span>
                        </div>
                        {/* 移动到其他卡片组（只能移动到当前学科下的卡片组，不能跨学科） */}
                        {activeCardCategory !== ALL_GROUPS && activeCardCategory !== UNCATEGORIZED && (
                          <label className="flex items-center gap-1.5 mt-2 text-[12px] text-[#71717A]">
                            <span className="shrink-0">卡片组</span>
                            <select
                              className="min-h-[28px] text-[12px] px-2 rounded border border-[#D4D4D8] bg-white"
                              value={card.categoryId ?? ""}
                              onChange={(e) => { moveCardToCategory(card.id, e.target.value); setNotice(`已移动卡片到卡片组`); }}
                            >
                              <option value="">未分类</option>
                              {subjectCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                            </select>
                          </label>
                        )}
                        <small className="block text-[12px] text-[#71717A] mt-2">来源：{card.source} {card.page} / {card.lastReviewed} / {card.nextReviewAt}</small>
                        <div className="card-actions">
                          <button className="text-button text-[12px]" onClick={() => reviewCard(card.id, "认识")}>认识</button>
                          <button className="text-button text-[12px]" onClick={() => reviewCard(card.id, "模糊")}>模糊</button>
                          <button className="text-button text-[12px]" onClick={() => reviewCard(card.id, "不会")}>不会</button>
                          <button className="text-button text-[12px]" onClick={() => setCards((items) => items.map((item) => item.id === card.id ? { ...item, favorite: !item.favorite } : item))}>{card.favorite ? "★收藏" : "收藏"}</button>
                          <button className="text-button text-[12px]" onClick={() => openEditCardDialog(card)}>编辑</button>
                          <button className="text-button text-[12px]" onClick={() => openCardSource(card)}>来源</button>
                          <button className="text-button text-[12px]" onClick={() => showRelatedQuestions(card.core, card.knowledge, card.subject)}>真题</button>
                          <button className="text-button text-[12px]" onClick={() => deleteCard(card)}>删除</button>
                        </div>
                      </article>
                    ))}
                    {visibleCategoryCards.length === 0 && <p className="empty-state">{cardFilter === "收藏" ? "该卡片组暂无收藏卡片。" : "该卡片组暂无卡片。"}</p>}
                  </div>
                )}
              </>
            )}

            {/* REVIEW_v6 P1: 卡片组重命名内联编辑框（section 根级渲染：首页网格与学科内学习空间均可触发并看到编辑框） */}
            {renamingCardId && (
              <div className="mb-4 p-3 rounded-[8px] border border-[#E4E4E7] bg-white flex items-center gap-2">
                <strong className="text-[12px] text-[#18181B] shrink-0">重命名卡片组</strong>
                <input
                  autoFocus
                  className="min-h-[34px] text-[13px] px-3 rounded-[8px] border border-[#D4D4D8] bg-white focus:outline-none focus:ring-2 focus:ring-[#18181B]/10 flex-1"
                  value={renamingCardName}
                  maxLength={30}
                  onChange={(e) => setRenamingCardName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const name = renamingCardName.trim().slice(0, 30);
                      if (!name) { setNotice("名称不能为空"); return; }
                      if (subjectCategories.some((c) => c.id !== renamingCardId && c.name === name)) { setNotice("卡片组名称已存在"); return; }
                      setCategories((items) => items.map((c) => c.id === renamingCardId ? { ...c, name, updatedAt: today() } : c));
                      setNotice(`已重命名卡片组：${name}`);
                      setRenamingCardId(null);
                    }
                    if (e.key === "Escape") setRenamingCardId(null);
                  }}
                />
                <button
                  className="min-h-[32px] px-3 rounded-[8px] bg-[#18181B] text-white font-bold text-[12px]"
                  onClick={() => {
                    const name = renamingCardName.trim().slice(0, 30);
                    if (!name) { setNotice("名称不能为空"); return; }
                    if (subjectCategories.some((c) => c.id !== renamingCardId && c.name === name)) { setNotice("卡片组名称已存在"); return; }
                    setCategories((items) => items.map((c) => c.id === renamingCardId ? { ...c, name, updatedAt: today() } : c));
                    setNotice(`已重命名卡片组：${name}`);
                    setRenamingCardId(null);
                  }}
                >保存</button>
                <button
                  className="min-h-[32px] px-3 rounded-[8px] bg-[#F4F4F5] text-[#71717A] font-bold text-[12px]"
                  onClick={() => setRenamingCardId(null)}
                >取消</button>
              </div>
            )}

            {/* 专注模式（统一使用 CardViewer 导出的 FocusMode 组件，单一实现；Escape 关闭 + 遮罩防误触） */}
            {focusMode && activeGroupCard && cardSubjectView && (
              <FocusMode
                activeCard={activeGroupCard}
                cardFlipped={cardFlipped}
                onFlip={() => setCardFlipped((v) => !v)}
                onReview={reviewCard}
                onClose={() => setFocusMode(false)}
              />
            )}

            {/* REVIEW_v6 P1: 删除卡片组确认弹窗（原来只设 state 不渲染，点击无响应；卡片归入未分类，不丢失内容） */}
            {deletingCardId && (
              <div className="modal-backdrop" role="presentation" onClick={() => setDeletingCardId(null)}>
                <section className="modal-panel compact-modal" role="dialog" aria-modal="true" aria-label="删除卡片组" onClick={(event) => event.stopPropagation()}>
                  <div className="modal-head">
                    <div><span>卡片组管理</span><strong>删除卡片组？</strong></div>
                    <button onClick={() => setDeletingCardId(null)}>关闭</button>
                  </div>
                  <div className="p-4">
                    <p className="text-[13px] text-[#71717A] leading-relaxed mb-2">
                      删除「{subjectCategories.find((c) => c.id === deletingCardId)?.name ?? "该卡片组"}」后，其中卡片将归入「未分类」，卡片内容不会丢失。
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        className="min-h-[34px] px-4 rounded-[8px] bg-[#F4F4F5] text-[#18181B] font-bold text-[13px]"
                        onClick={() => setDeletingCardId(null)}
                      >取消</button>
                      <button
                        className="min-h-[34px] px-4 rounded-[8px] bg-[#EF4444] text-white font-bold text-[13px]"
                        onClick={() => {
                          setCards((items) => items.map((c) => c.categoryId === deletingCardId ? { ...c, categoryId: undefined } : c));
                          setCategories((items) => items.filter((c) => c.id !== deletingCardId));
                          // 删除的是当前正在学习的分类 → 重置为「全部卡片」，避免 activeCardCategory 指向已删除 id 导致空列表
                          if (activeCardCategory === deletingCardId) {
                            setActiveCardCategory(ALL_GROUPS);
                            setCardIndex(0);
                            setCardFlipped(false);
                          }
                          setNotice("已删除卡片组（卡片已归入未分类）");
                          setDeletingCardId(null);
                        }}
                      >确认删除</button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* 新建 / 编辑卡片弹窗（编辑时预填并更新；新建时自动继承上下文 + 更多设置折叠） */}
            {activeDialog === "card" && (
              <div className="modal-backdrop" role="presentation" onClick={() => { setEditingCardId(null); setActiveDialog(null); }}>
                <section className="modal-panel" role="dialog" aria-modal="true" aria-label={editingCard ? "编辑成长卡片" : "新建成长卡片"} onClick={(event) => event.stopPropagation()}>
                  <div className="modal-head"><div><span>成长卡片</span><strong>{editingCard ? "编辑成长卡片" : "新建成长卡片"}</strong></div><button onClick={() => { setEditingCardId(null); setActiveDialog(null); }}>关闭</button></div>
                  <form className="form-grid" key={editingCard?.id ?? "new"} onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    const front = String(form.get("front") ?? "").trim();
                    if (!front) return;
                    const submittedSubject = String(form.get("subject") ?? "").trim() || activeCardSubject || currentSubject?.name || "";
                    const submittedSubjectRecord = subjects.find((subject) => subject.name === submittedSubject);
                    const safeCategoryId = cardDialogCategory && submittedSubjectRecord && categories.some((cat) => cat.id === cardDialogCategory && cat.subjectId === submittedSubjectRecord.id)
                      ? cardDialogCategory
                      : undefined;
                    if (editingCard) {
                      // 编辑：保留 id / createdAt / 学习状态，更新可编辑字段
                      setCards((items) => items.map((item) => item.id === editingCard.id
                        ? {
                            ...item,
                            title: front.slice(0, 40),
                            front,
                            back: String(form.get("back") ?? "").trim() || "待补充",
                            type: String(form.get("type") ?? item.type) as GrowthCard["type"],
                            subject: submittedSubject || item.subject,
                            core: String(form.get("core") ?? "").trim() || item.core,
                            branch: String(form.get("branch") ?? "").trim() || "",
                            knowledge: String(form.get("knowledge") ?? "").trim() || "",
                            source: String(form.get("source") ?? "").trim() || item.source,
                            page: String(form.get("page") ?? "").trim() || item.page,
                            categoryId: safeCategoryId,
                          }
                        : item));
                      setNotice("已保存卡片修改");
                      setEditingCardId(null);
                      setActiveDialog(null);
                      return;
                    }
                    const subject = submittedSubject;
                    const subjectNode = nodes.find((n) => n.subject === subject);
                    const type = String(form.get("type") ?? "概念卡") as GrowthCard["type"];
                    // 分类可选，不选 → 未分类；分类列表只显示当前学科（学科隔离）
                    const card: GrowthCard = {
                      id: makeId("c"),
                      title: front.slice(0, 40),
                      front,
                      back: String(form.get("back") ?? "").trim() || "待补充",
                      type,
                      subject,
                      // 科目/七核/知识点/来源 自动继承当前上下文，仅当用户在「更多设置」中修改时覆盖
                      core: String(form.get("core") ?? "").trim() || subjectNode?.core || "待关联",
                      branch: String(form.get("branch") ?? "").trim() || subjectNode?.branch || "",
                      knowledge: String(form.get("knowledge") ?? "").trim() || subjectNode?.knowledge || "",
                      source: String(form.get("source") ?? "").trim() || activeResource?.name || "手动创建",
                      page: String(form.get("page") ?? "").trim() || activeResource?.currentPage || "",
                      modes: ["背诵", type === "填空卡" ? "填空" : "条件辨析"],
                      createdBy: "手动",
                      createdAt: today(),
                      lastReviewed: "未复习",
                      nextReviewAt: dateOnly(),
                      mastery: "模糊",
                      note: "",
                      favorite: false,
                      categoryId: safeCategoryId,
                    };
                    setCards((items) => [card, ...items]);
                    setActiveCardSubject(subject);
                    pushAssistant(`已创建${type}：${card.title}`);
                    setActiveDialog(null);
                    event.currentTarget.reset();
                  }}>
                    <label className="field wide-field"><span>正面 *</span><input name="front" defaultValue={editingCard?.front ?? ""} autoFocus required /></label>
                    <label className="field wide-field"><span>背面</span><input name="back" defaultValue={editingCard?.back ?? ""} placeholder="可选，默认待补充" /></label>
                    <label className="field"><span>类型</span><select name="type" defaultValue={editingCard?.type ?? "概念卡"}><option>公式卡</option><option>概念卡</option><option>填空卡</option><option>推导卡</option><option>条件辨析卡</option><option>错题卡</option></select></label>
                    <label className="field wide-field"><span>卡片组</span><select name="category" value={cardDialogCategory} onChange={(event) => setCardDialogCategory(event.target.value)}><option value="">未分类</option>{cardDialogSubjectCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></label>
                    {/* 高级信息默认折叠：编辑时预填，新建时自动继承上下文 */}
                    <details className="inline-details mt-2">
                      <summary className="text-[12px] text-[#71717A] font-bold">更多设置</summary>
                      <div className="grid grid-cols-1 gap-3 mt-2">
                        <label className="field"><span>科目</span><select name="subject" value={cardDialogSubject} onChange={(event) => { setCardDialogSubject(event.target.value); setCardDialogCategory(""); }}>{subjects.map((subject) => <option key={subject.id} value={subject.name}>{subject.name}</option>)}</select></label>
                        <label className="field"><span>七核</span><select name="core" defaultValue={editingCard?.core ?? ""}><option value="">自动继承当前科目</option>{coreNames.map((core) => <option key={core} value={core}>{core}</option>)}</select></label>
                        <label className="field"><span>分支</span><input name="branch" defaultValue={editingCard?.branch ?? ""} placeholder="自动继承当前科目" /></label>
                        <label className="field"><span>知识点</span><input name="knowledge" defaultValue={editingCard?.knowledge ?? ""} placeholder="自动继承当前科目" /></label>
                        <label className="field wide-field"><span>来源</span><input name="source" defaultValue={editingCard?.source ?? ""} placeholder={activeResource?.name || "手动创建"} /></label>
                        <label className="field"><span>页码</span><input name="page" defaultValue={editingCard?.page ?? ""} placeholder={activeResource?.currentPage || ""} /></label>
                      </div>
                    </details>
                    <button>{editingCard ? "保存修改" : "创建成长卡片"}</button>
                  </form>
                </section>
              </div>
            )}
          </section>
  );
}
