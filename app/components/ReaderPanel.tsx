"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { Resource, Question, Annotation, AnnotationTag, KnowledgeNode } from "../lib/types";
import {
  ANNOTATION_COLORS, UNKNOWN_ANNOTATION_TAG, UNKNOWN_ANNOTATION_COLOR,
  resolveAnnotationColor, isAnnotationTag,
} from "../lib/types";
import { loadPdfBlob } from "../lib/pdf-storage";
import styles from "../../styles/components.module.css";

interface ReaderPanelProps {
  activeResource: Resource;
  readerSearch: string;
  readerPage: string;
  readerZoom: string;
  favoritePages: string[];
  activePageKey: string;
  relatedQuestions: Question[];
  subjectAnnotations: Annotation[];
  subjectNodes: KnowledgeNode[];
  onSetReaderSearch: (v: string) => void;
  onSetReaderPage: (v: string) => void;
  onSetReaderZoom: (v: string) => void;
  onSaveProgress: () => void;
  onMarkRead: () => void;
  onToggleFavorite: () => void;
  onShowRelated: (core: string, keyword: string, subject: string) => void;
  onCreateCard: (text: string, annotation?: Annotation) => void;
  onDeleteAnnotation: (id: string) => void;
  onEditAnnotation: (id: string, note: string) => void;
  onJumpToPage: (page: string) => void;
  /** 新增批注回调 */
  onCreateAnnotation?: (page: string, selection: string, tag: AnnotationTag, note: string) => void;
}

/** 从 Resource 数据生成模拟页面内容 */
function generatePageContent(
  resource: Resource,
  nodes: KnowledgeNode[],
  questions: Question[],
  pageNum: number
): string[] {
  const resourceName = resource.name || "资料";
  const subject = resource.subject || "物理化学";
  const linkedNode = resource.linkedNode || "";
  const coreName = linkedNode.split("/")[0]?.trim() || "热力学";
  const knowledgeName = linkedNode.split("/")[2]?.trim() || "";

  const relatedNodes = nodes.filter(n => n.subject === subject);
  const relatedQs = questions.filter(q => q.subject === subject);

  // Generate contextual content paragraphs based on actual data
  const paragraphs: string[] = [];

  if (knowledgeName) {
    paragraphs.push(`本节重点讲解 ${knowledgeName} 的核心概念与计算方法。在 ${resourceName} 中，该知识点位于第 ${pageNum} 页附近，属于 ${coreName} 范畴的核心内容。`);
  }

  if (relatedNodes.length > 0) {
    const topNode = relatedNodes[pageNum % relatedNodes.length];
    paragraphs.push(`${topNode.knowledge}：${topNode.explanation}。当前掌握度 ${topNode.masteryScore}%，风险等级：${topNode.reviewRisk}。建议重点关注 ${topNode.prerequisite} 等前置知识点。`);
  }

  if (relatedQs.length > 0) {
    const q = relatedQs[pageNum % relatedQs.length];
    paragraphs.push(`关联真题示例（${q.year}年 #${q.number}）：${q.stem}。该题难度 ${q.difficulty}/5，考查 ${q.knowledge} 相关内容。`);
  }

  paragraphs.push(`建议学习时间 15-20 分钟，完成本页后通过课后练习检验掌握程度。注意区分 ${coreName} 中不同概念的适用条件和常见错误。`);

  if (resource.type === "真题") {
    paragraphs.push(`本题为 ${subject} ${resource.version || ""} 真题，建议限时 ${pageNum % 30 + 10} 分钟内独立完成，再对照答案解析。`);
  }

  return paragraphs;
}

/** 模拟基于实际数据的 AI 阅读提示 */
function generateAiHint(
  resource: Resource,
  nodes: KnowledgeNode[],
  questions: Question[],
  pageNum: number
): { keyPoint: string; examFreq: string } {
  const linkedNode = resource.linkedNode || "";
  const knowledgeName = linkedNode.split("/")[2]?.trim() || resource.name || "当前内容";
  const subjectNodes = nodes.filter(n => n.subject === resource.subject);
  const subjectQuestions = questions.filter(q => q.subject === resource.subject);

  const highRiskNodes = subjectNodes.filter(n => n.reviewRisk === "高风险");
  const recentQuestions = subjectQuestions.filter(q => Number(q.year) >= 2023);

  const keyPoint = highRiskNodes.length > 0
    ? `${knowledgeName}：${highRiskNodes[0].explanation}。当前为高风险知识点，需重点复习。`
    : `${knowledgeName}：掌握基础概念和公式适用条件是本页核心。`;

  const freqStars = recentQuestions.length > 3 ? "★★★★★" : recentQuestions.length > 1 ? "★★★" : "★★";
  const examFreq = recentQuestions.length > 0
    ? `近 3 年考 ${recentQuestions.length} 次，${freqStars}`
    : `该知识点为 ${resource.subject} 基础内容，建议扎实掌握。`;

  return { keyPoint, examFreq };
}

/** 模拟文本搜索 */
function searchInContent(
  text: string,
  query: string
): { before: string; match: string; after: string } | null {
  if (!query.trim()) return null;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, idx - 20);
  const end = Math.min(text.length, idx + query.length + 30);
  const before = (start > 0 ? "..." : "") + text.slice(start, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length, end) + (end < text.length ? "..." : "");
  return { before, match, after };
}

/** Stabilization 1A-2: 配置 pdfjs worker（Vite 环境下解析 worker 资源路径） */
function ensurePdfWorker(pdfjsLib: { GlobalWorkerOptions: { workerSrc?: string } }) {
  if (!pdfjsLib.GlobalWorkerOptions?.workerSrc) {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    } catch {
      // worker 路径不可解析：由错误矩阵 1A-2e 兜底
    }
  }
}

export function ReaderPanel({
  activeResource, readerSearch, readerPage, readerZoom,
  favoritePages, activePageKey, relatedQuestions, subjectAnnotations, subjectNodes,
  onSetReaderSearch, onSetReaderPage, onSetReaderZoom,
  onSaveProgress, onMarkRead, onToggleFavorite,
  onShowRelated, onCreateCard, onDeleteAnnotation, onEditAnnotation, onJumpToPage,
  onCreateAnnotation,
}: ReaderPanelProps) {
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [showNewAnnotation, setShowNewAnnotation] = useState(false);
  const [newAnnotationText, setNewAnnotationText] = useState("");
  const [newAnnotationTag, setNewAnnotationTag] = useState<AnnotationTag>("重点");
  // Stabilization 1A-2: PDF.js 状态
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfTotalPages, setPdfTotalPages] = useState<number | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const annotationCount = subjectAnnotations.length;
  const currentPage = Number(readerPage) || 1;
  const isRealPdf = activeResource?.kind === "pdf" && !!activeResource?.fileStorageKey;
  const maxPages = isRealPdf && pdfTotalPages ? pdfTotalPages : Math.max(1, currentPage + 20); // demo: simulate page range

  // Generate dynamic page content
  const pageContent = useMemo(() =>
    generatePageContent(activeResource, subjectNodes, relatedQuestions, currentPage),
    [activeResource, subjectNodes, relatedQuestions, currentPage]
  );

  // Generate dynamic AI hint
  const aiHint = useMemo(() =>
    generateAiHint(activeResource, subjectNodes, relatedQuestions, currentPage),
    [activeResource, subjectNodes, relatedQuestions, currentPage]
  );

  const annotationsByTag = useMemo(() => {
    const grouped = subjectAnnotations.reduce<Record<AnnotationTag, Annotation[]> & { unknown: Annotation[] }>(
      (acc, ann) => {
        // 显式隔离：非法历史标签不进入合法分组（不崩溃、不掩盖）
        if (!isAnnotationTag(ann.tag)) {
          acc.unknown.push(ann);
          return acc;
        }
        acc[ann.tag].push(ann);
        return acc;
      },
      { "重点": [], "疑问": [], "易错": [], "总结": [], "核心概念": [], unknown: [] }
    );
    // 修复历史类型：兼容早期直接把 legal tag 用作键但缺少 unknown 字段的写法
    return grouped;
  }, [subjectAnnotations]);

  // Font size based on zoom
  const fontSizeClass = readerZoom === "80%" ? styles.readerContentSmall
    : readerZoom === "125%" ? styles.readerContentLarge
    : styles.readerContentDefault;

  // Page navigation
  const goToPage = useCallback((page: number) => {
    const clamped = Math.max(1, Math.min(maxPages, page));
    onSetReaderPage(String(clamped));
  }, [maxPages, onSetReaderPage]);

  const handleSubmitAnnotation = useCallback(() => {
    if (!newAnnotationText.trim()) return;
    onCreateAnnotation?.(
      String(currentPage),
      newAnnotationText.trim(),
      newAnnotationTag,
      ""
    );
    setNewAnnotationText("");
    setNewAnnotationTag("重点");
    setShowNewAnnotation(false);
  }, [newAnnotationText, newAnnotationTag, currentPage, onCreateAnnotation]);

  // ─── Stabilization 1A-2: PDF 加载（IndexedDB → pdfjs-dist → Blob URL）───
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function loadPdf() {
      setPdfError(null);
      setPdfTotalPages(null);
      if (!isRealPdf || !activeResource?.fileStorageKey) {
        return;
      }
      setPdfLoading(true);
      try {
        // 1A-2a: 文件不存在（IndexedDB 无记录）→ loadPdfBlob 返回 null
        const blob = await loadPdfBlob(activeResource.fileStorageKey);
        if (cancelled) return;
        if (!blob) {
          setPdfError("文件不存在或已被清理");
          return;
        }
        // 1A-2c: 非 PDF 类型校验
        if (!blob.type.includes("pdf") && !blob.type.startsWith("application/octet-stream")) {
          setPdfError("文件损坏或不是有效 PDF");
          return;
        }
        // 动态加载 pdfjs-dist（1A-2e: worker 加载失败单独捕获）
        let pdfjsLib: typeof import("pdfjs-dist") | null = null;
        try {
          pdfjsLib = await import("pdfjs-dist");
        } catch {
          if (!cancelled) setPdfError("PDF 解析引擎加载失败");
          return;
        }
        if (cancelled) return;
        ensurePdfWorker(pdfjsLib as typeof import("pdfjs-dist"));
        objectUrl = URL.createObjectURL(blob);
        const pdf = await pdfjsLib.getDocument(objectUrl).promise;
        if (cancelled) return;
        setPdfTotalPages(pdf.numPages);
        // 打开资源后跳回上次页码（1A-5）
        const lastPage = activeResource.lastOpenedPage || "1";
        const pageNum = Math.min(Math.max(1, Number(lastPage) || 1), pdf.numPages);
        onSetReaderPage(String(pageNum));
      } catch (err) {
        if (cancelled) return;
        const msg = String((err as Error)?.message || err);
        // 1A-2d: 加密 PDF
        if (msg.includes("PasswordException") || msg.includes("password")) {
          setPdfError("文档已加密，暂不支持打开");
        } else if (msg.includes("InvalidPDFException") || msg.includes("Invalid PDF")) {
          setPdfError("文件损坏或不是有效 PDF");
        } else {
          setPdfError(`读取本地文件失败，请重试（${msg.slice(0, 60)}）`);
        }
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      // 取消进行中的渲染任务
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [activeResource?.id, activeResource?.fileStorageKey]);

  // ─── Stabilization 1A-2: 当前页 Canvas 渲染（含 1A-2f 单页渲染失败重试）───
  useEffect(() => {
    let cancelled = false;
    if (!isRealPdf || !pdfTotalPages || !activeResource?.fileStorageKey) return;

    async function renderPage() {
      setPdfError(null);
      setPdfLoading(true);
      try {
        const blob = await loadPdfBlob(activeResource.fileStorageKey!);
        if (cancelled || !blob) return;
        const pdfjsLib = await import("pdfjs-dist");
        if (cancelled) return;
        ensurePdfWorker(pdfjsLib as typeof import("pdfjs-dist"));
        const pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
        if (cancelled) return;
        const page = await pdf.getPage(Math.min(currentPage, pdf.numPages));
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const viewport = page.getViewport({ scale: (Number(readerZoom.replace("%", "")) || 100) / 100 });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const renderTask = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = renderTask;
        try {
          await renderTask.promise;
        } catch (err) {
          if (cancelled) return;
          const msg = String((err as Error)?.message || err);
          if (!msg.includes("cancelled")) {
            // 1A-2f: 单页渲染失败 →「第 N 页渲染失败」+ 重试一次
            try {
              await page.render({ canvasContext: ctx, viewport }).promise;
            } catch {
              if (!cancelled) setPdfError(`第 ${currentPage} 页渲染失败`);
            }
          }
        } finally {
          renderTaskRef.current = null;
        }
      } catch (err) {
        if (cancelled) return;
        setPdfError(`读取本地文件失败，请重试`);
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    }

    renderPage();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [isRealPdf, pdfTotalPages, currentPage, readerZoom, activeResource?.fileStorageKey]);

  return (
    <div className={styles.readerGrid}>
      {/* ═══ 左：AI 阅读空间 ═══ */}
      <div className={styles.readerPanel}>
        {/* 顶部：分页控制器 */}
        <div className={styles.paginationBar}>
          <button
            className={styles.pageNavBtn}
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
          >
            ‹ 上一页
          </button>
          <input
            className={styles.pageInput}
            type="text"
            value={readerPage}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              if (v) onSetReaderPage(v);
            }}
            onBlur={() => {
              const p = Number(readerPage);
              if (!p || p < 1) onSetReaderPage("1");
              else if (p > maxPages) onSetReaderPage(String(maxPages));
            }}
          />
          <span className={styles.pageTotal}>/ {maxPages}</span>
          <button
            className={styles.pageNavBtn}
            disabled={currentPage >= maxPages}
            onClick={() => goToPage(currentPage + 1)}
          >
            下一页 ›
          </button>
        </div>

        {/* 顶部定位栏 */}
        <div className={styles.readerToolbar}>
          <span className={styles.readerPageNum}>P{readerPage || "?"}</span>
          <span className={styles.readerSeparator}>·</span>
          <span className={styles.readerSubjectLabel}>
            {activeResource?.linkedNode?.split("/")[0]?.trim() || activeResource?.name || "阅读"}
          </span>
          <div className={styles.readerToolbarSpacer} />
          <input
            className={styles.readerSearchInput}
            value={readerSearch}
            onChange={(e) => onSetReaderSearch(e.target.value)}
            placeholder="🔍 搜索"
          />
          <select
            className={styles.readerZoomSelect}
            value={readerZoom}
            onChange={(e) => onSetReaderZoom(e.target.value)}
          >
            <option>80%</option><option>100%</option><option>125%</option>
          </select>
          <button onClick={onSaveProgress} className={styles.readerSaveBtn}>
            保存
          </button>
        </div>

        {/* 阅读目标 */}
        {activeResource && (
          <div className={styles.readerMeta}>
            <span>📖 P{activeResource.currentPage || "132"}-{String(Number(activeResource.currentPage || "132") + 8)}</span>
            <span>⏱ 预计 20 分钟</span>
            {relatedQuestions.length > 0 && (
              <span>📄 {relatedQuestions.length} 道关联真题</span>
            )}
          </div>
        )}

        {/* ═══ 内容区（1A-2g：真实 PDF → canvas；demo → 模拟文本 + 演示标注） ═══ */}
        <div className={`${styles.readerContent} ${fontSizeClass}`}>
          {isRealPdf ? (
            pdfError ? (
              <div className="p-6 rounded-[8px] bg-[#FEF2F2] border border-[#DC2626] text-[#DC2626] text-[13px]">
                ⚠️ {pdfError}
              </div>
            ) : (
              <>
                {pdfLoading && (
                  <p className="text-[12px] text-[#71717A] mb-2">正在加载 PDF…</p>
                )}
                <canvas ref={canvasRef} style={{ maxWidth: "100%", border: "1px solid #E4E4E7", borderRadius: 8 }} />
                {annotationCount > 0 && (
                  <div className="space-y-2 mt-4">
                    {subjectAnnotations.filter((ann) => Number(ann.page) === currentPage).map((ann) => {
                      const color = resolveAnnotationColor(ann.tag);
                      return (
                        <div key={ann.id} className={styles.annotatedText} style={{ borderColor: color.border }}>
                          <p className={styles.contentText}>{ann.selection}</p>
                          <div className={styles.annotatedTextTag}>
                            <span>{color.dot}</span>
                            <span className={styles.annotatedTextTagLabel}>
                              {isAnnotationTag(ann.tag) ? ann.tag : UNKNOWN_ANNOTATION_TAG}
                            </span>
                            {ann.note && (
                              <span className={styles.annotatedTextNote}>· {ann.note}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )
          ) : (
            <>
              <div className="mb-3 px-2 py-1 rounded-[6px] bg-[#F4F4F5] text-[11px] text-[#71717A] inline-block">
                📄 演示模式（Demo）— 非真实 PDF 文件，内容由本地数据模拟生成
              </div>
              {annotationCount > 0 ? (
                <div className="space-y-2">
                  {subjectAnnotations.map((ann) => {
                    const color = resolveAnnotationColor(ann.tag);
                    return (
                      <div key={ann.id} className={styles.annotatedText} style={{ borderColor: color.border }}>
                        <p className={styles.contentText}>{ann.selection}</p>
                        <div className={styles.annotatedTextTag}>
                          <span>{color.dot}</span>
                          <span className={styles.annotatedTextTagLabel}>
                            {isAnnotationTag(ann.tag) ? ann.tag : UNKNOWN_ANNOTATION_TAG}
                          </span>
                          {ann.note && (
                            <span className={styles.annotatedTextNote}>· {ann.note}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <p className={styles.contentText} style={{ color: "#A1A1AA", paddingTop: 4 }}>··· 其余内容</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pageContent.map((para, i) => {
                    // Apply search highlighting if search is active
                    if (readerSearch.trim()) {
                      const result = searchInContent(para, readerSearch);
                      if (result) {
                        return (
                          <p key={i} className={styles.contentText}>
                            {result.before}
                            <span className={styles.searchHighlight}>{result.match}</span>
                            {result.after}
                          </p>
                        );
                      }
                    }
                    return <p key={i} className={styles.contentText}>{para}</p>;
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* ═══ 本页关联 ═══ */}
        <div className={styles.relatedSection}>
          {relatedQuestions.length > 0 && (
            <div className={styles.relatedPanel}>
              <div className={styles.relatedLabel}>📄 本页真题</div>
              <div className={styles.relatedButtons}>
                {relatedQuestions.slice(0, 4).map((q) => (
                  <button key={q.id} className={styles.relatedBtn}
                    onClick={() => onShowRelated(q.core, q.knowledge, q.subject)}>
                    {q.year} #{q.number}
                  </button>
                ))}
              </div>
            </div>
          )}
          {subjectNodes.length > 0 && (
            <div className={styles.relatedPanel} style={{ minWidth: 150 }}>
              <div className={styles.relatedLabel}>🧠 知识点</div>
              <div className={styles.relatedButtons}>
                {subjectNodes.slice(0, 4).map((n) => (
                  <span key={n.knowledge} className={styles.knowledgeTag}>{n.knowledge}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══ AI 助手（默认折叠） ═══ */}
        <details className={styles.aiAssistant} open={aiExpanded} onToggle={() => setAiExpanded(!aiExpanded)}>
          <summary className={styles.aiAssistantSummary}>
            💡 AI 阅读助手 {aiExpanded ? "▲" : "▼"}
          </summary>
          <div className={styles.aiAssistantBody}>
            <p className={styles.aiAssistantText}>
              <span className={styles.aiAssistantLabel}>本页重点：</span>
              {aiHint.keyPoint}
            </p>
            <p className={styles.aiAssistantText} style={{ marginTop: 8 }}>
              <span className={styles.aiAssistantLabel}>考频：</span>
              {aiHint.examFreq}
            </p>
            <div className={styles.aiAssistantActions}>
              <button className={styles.aiAssistantBtn}
                onClick={() => onShowRelated("全部", "全部", activeResource.subject)}>
                📄 找真题
              </button>
              <button className={styles.aiAssistantBtn}
                onClick={() => onCreateCard("生成公式卡")}>
                🃏 生成卡片
              </button>
            </div>
          </div>
        </details>

        {/* ═══ 新增批注入口 ═══ */}
        {showNewAnnotation && (
          <div className={styles.newAnnotationForm}>
            <div className={styles.newAnnotationFormTitle}>✏ 新建批注</div>
            <textarea
              className={styles.newAnnotationTextarea}
              placeholder="选中内容或输入批注..."
              value={newAnnotationText}
              onChange={(e) => setNewAnnotationText(e.target.value)}
            />
            <div className={styles.newAnnotationTagRow}>
              {(["重点", "疑问", "易错", "总结"] as AnnotationTag[]).map((tag) => (
                <button
                  key={tag}
                  className={`${styles.newAnnotationTagBtn} ${newAnnotationTag === tag ? styles.newAnnotationTagBtnActive : ""}`}
                  onClick={() => setNewAnnotationTag(tag)}
                >
                  {ANNOTATION_COLORS[tag].dot} {tag}
                </button>
              ))}
            </div>
            <div className={styles.newAnnotationActions}>
              <button className={styles.newAnnotationSubmitBtn} onClick={handleSubmitAnnotation}>
                确认添加
              </button>
              <button className={styles.newAnnotationCancelBtn} onClick={() => setShowNewAnnotation(false)}>
                取消
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ 右：批注面板 ═══ */}
      <div className={`${styles.annotationPanel} ${showAnnotations ? "" : ""}`}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <button className={styles.annotationToggleBtn} onClick={() => setShowAnnotations(!showAnnotations)}>
            📌 批注 {showAnnotations ? "▶" : `(${annotationCount})`}
          </button>
          {onCreateAnnotation && (
            <button
              className={styles.annotationToggleBtn}
              onClick={() => setShowNewAnnotation(true)}
              style={{ background: "#18181B", color: "white" }}
            >
              ✏ 新建
            </button>
          )}
        </div>

        {showAnnotations && (
          <>
            <div className={styles.annotationStatusBar}>
              {(["重点", "疑问", "易错", "总结"] as AnnotationTag[]).map((tag) => (
                <span key={tag} className={styles.annotationTagDot}>
                  <span>{ANNOTATION_COLORS[tag].dot}</span>
                  <span>{tag}</span>
                </span>
              ))}
            </div>

            {(["重点", "易错", "疑问", "总结", "核心概念"] as AnnotationTag[]).map((tag) => {
              const items = annotationsByTag[tag];
              if (!items.length) return null;
              const color = resolveAnnotationColor(tag);
              return (
                <div key={tag} style={{ marginBottom: 8 }}>
                  <div className={styles.annotationSectionHead}>
                    <span>{color.dot}</span>
                    <span className={styles.annotationSectionLabel}>{tag}</span>
                    <span className={styles.annotationSectionCount}>{items.length}</span>
                  </div>
                  <div>
                    {items.map((item) => (
                      <div key={item.id} className={styles.annotationItem}
                        style={{ backgroundColor: color.bg, borderLeft: `3px solid ${color.border}` }}
                        onClick={() => onJumpToPage(item.page)}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                          <span className={styles.annotationPage} style={{ color: color.border }}>P{item.page}</span>
                        </div>
                        <p className={styles.annotationText}>{item.selection}</p>
                        {item.note && <p className={styles.annotationNote}>✏ {item.note}</p>}
                        <div className={styles.annotationActions}>
                          <button className={styles.annotationActionBtn}
                            onClick={(e) => { e.stopPropagation(); const n = prompt('编辑', item.note); if (n !== null) onEditAnnotation(item.id, n); }}>
                            编辑
                          </button>
                          <button className={`${styles.annotationActionBtn} ${styles.annotationActionDanger}`}
                            onClick={(e) => { e.stopPropagation(); if (confirm('删除？')) onDeleteAnnotation(item.id); }}>
                            删除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* ⚠ 显式隔离渲染：非法历史标签分组（红色警告，不崩溃） */}
            {annotationsByTag.unknown.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div className={styles.annotationSectionHead}
                  style={{ color: "#DC2626" }}>
                  <span>⚠️</span>
                  <span className={styles.annotationSectionLabel}>{UNKNOWN_ANNOTATION_TAG}</span>
                  <span className={styles.annotationSectionCount}>{annotationsByTag.unknown.length}</span>
                </div>
                <div className={styles.annotationSectionLabel}
                  style={{ color: "#DC2626", fontSize: 11, marginBottom: 4 }}>
                  {UNKNOWN_ANNOTATION_COLOR.label}
                </div>
                {annotationsByTag.unknown.map((item) => (
                  <div key={item.id} className={styles.annotationItem}
                    style={{ backgroundColor: "#FEF2F2", borderLeft: "3px solid #DC2626" }}
                    onClick={() => onJumpToPage(item.page)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                      <span className={styles.annotationPage} style={{ color: "#DC2626" }}>P{item.page}</span>
                      <span style={{ fontSize: 11, color: "#DC2626" }}>非法标签: {String(item.tag)}</span>
                    </div>
                    <p className={styles.annotationText}>{item.selection}</p>
                    {item.note && <p className={styles.annotationNote}>✏ {item.note}</p>}
                  </div>
                ))}
              </div>
            )}

            {annotationCount === 0 && (
              <div className={styles.annotationEmpty}>
                <p className={styles.annotationEmptyText}>暂无批注</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}