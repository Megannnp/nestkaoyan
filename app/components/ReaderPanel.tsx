"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { Resource, Question, Annotation, AnnotationTag, KnowledgeNode } from "../lib/types";
import {
  ANNOTATION_COLORS, UNKNOWN_ANNOTATION_TAG, UNKNOWN_ANNOTATION_COLOR,
  resolveAnnotationColor, isAnnotationTag, NEW_ANNOTATION_TAGS,
} from "../lib/types";
import { loadPdfBlob } from "../lib/pdf-storage";
import { chatCompleteStream, chatErrorReason } from "../lib/ai/chat-complete";
import { generatePageContent, searchInContent, ensurePdfWorker } from "./reader-content";
import styles from "../../styles/components.module.css";

interface ReaderPanelProps {
  activeResource: Resource;
  readerSearch: string;
  readerPage: string;
  readerZoom: string;
  relatedQuestions: Question[];
  subjectAnnotations: Annotation[];
  subjectNodes: KnowledgeNode[];
  onSetReaderSearch: (v: string) => void;
  onSetReaderPage: (v: string) => void;
  onSetReaderZoom: (v: string) => void;
  onSaveProgress: () => void;
  onShowRelated: (core: string, keyword: string, subject: string) => void;
  onCreateCard: (text: string, annotation?: Annotation) => void;
  onDeleteAnnotation: (id: string) => void;
  onEditAnnotation: (id: string, note: string) => void;
  onJumpToPage: (page: string) => void;
  /** 新增批注回调 */
  onCreateAnnotation?: (page: string, selection: string, tag: AnnotationTag, note: string) => void;
}

export function ReaderPanel({
  activeResource, readerSearch, readerPage, readerZoom,
  relatedQuestions, subjectAnnotations, subjectNodes,
  onSetReaderSearch, onSetReaderPage, onSetReaderZoom,
  onSaveProgress,
  onShowRelated, onCreateCard, onDeleteAnnotation, onEditAnnotation, onJumpToPage,
  onCreateAnnotation,
}: ReaderPanelProps) {
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [showNewAnnotation, setShowNewAnnotation] = useState(false);
  const [newAnnotationText, setNewAnnotationText] = useState("");
  const [newAnnotationTag, setNewAnnotationTag] = useState<AnnotationTag>("重点");
  // P3 交互修复（2026-08-01）：批注内联编辑 + 两阶段删除（替代原生 prompt/confirm）
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null);
  const [editingAnnText, setEditingAnnText] = useState("");
  const [confirmDeleteAnnId, setConfirmDeleteAnnId] = useState<string | null>(null);
  // P3 交互修复：本地短提示（批注表单 / 保存进度 / 搜索无匹配，避免依赖父级 toast 连通性）
  const [noticeText, setNoticeText] = useState<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // 2026-08-03 产品修复：AI 阅读助手改为真实 DeepSeek 流式讲解（不再是本地模拟假数据）
  const [aiStreamText, setAiStreamText] = useState("");
  const [aiStreaming, setAiStreaming] = useState(false);
  const aiRunRef = useRef(0);
  const flash = useCallback((text: string) => {
    setNoticeText(text);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNoticeText(null), 2200);
  }, []);
  useEffect(() => () => { if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current); }, []);
  // Stabilization 1A-2: PDF.js 状态
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfTotalPages, setPdfTotalPages] = useState<number | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  // 2026-08-04 修复：提取当前页 PDF 真实文本，喂给 AI 讲解/提问（不再"推测"）
  const [pagePdfText, setPagePdfText] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  // 2026-08-04 新功能：PDF 文字层（可选中的透明文字）→ 选中文字成批注
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const textLayerTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [pdfSelection, setPdfSelection] = useState("");

  // 2026-08-03：AI 讲解流式内容分段渲染（去掉 ** markdown 符号，按换行/句子切段落，便于阅读）
  function renderAiStreamText(text: string) {
    const clean = text
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/^#{1,6}\s*/gm, "")
      .replace(/`([^`]+)`/g, "$1")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!clean.length) return [text];
    const paragraphs: string[] = [];
    for (const line of clean) {
      const sentences = line.split(/(?<=[。！？；])/).map((s) => s.trim()).filter(Boolean);
      if (sentences.length <= 1) {
        paragraphs.push(line);
      } else {
        let buffer = "";
        for (const sentence of sentences) {
          buffer += sentence;
          if (buffer.length >= 40 || /[。！？；]$/.test(sentence)) {
            paragraphs.push(buffer.trim());
            buffer = "";
          }
        }
        if (buffer.trim()) paragraphs.push(buffer.trim());
      }
    }
    return paragraphs;
  }

  const annotationCount = subjectAnnotations.length;
  const currentPage = Number(readerPage) || 1;
  const isRealPdf = activeResource?.kind === "pdf" && !!activeResource?.fileStorageKey;
  const maxPages = isRealPdf && pdfTotalPages ? pdfTotalPages : Math.max(1, currentPage + 20); // demo: simulate page range

  // Generate dynamic page content
  const pageContent = useMemo(() =>
    generatePageContent(activeResource, subjectNodes, relatedQuestions, currentPage),
    [activeResource, subjectNodes, relatedQuestions, currentPage]
  );

  // 2026-08-04 清理：本地规则概览（generateAiHint）已无 UI 消费，移除死代码
  // （讲解/提问均使用真实 DeepSeek + 当前页 PDF 真实文本 pagePdfText）

  // 2026-08-03：真实 AI 讲解本页（SSE 流式打字机；失败降级展示原因）
  async function askAiExplain(options?: { silent?: boolean }) {
    const runId = aiRunRef.current + 1;
    aiRunRef.current = runId;
    if (!options?.silent) setAiStreamText("");
    setAiStreaming(true);
    const subject = activeResource.subject || "当前科目";
    const knowledge = activeResource.linkedNode?.split("/")[2]?.trim() || activeResource.name || "本页内容";
    const relatedDesc = relatedQuestions.slice(0, 5).map((q) => `${q.year}年#${q.number}：${q.stem}`).join("；") || "暂无";
    const weakNodes = subjectNodes.filter((n) => n.reviewRisk === "高风险").slice(0, 3).map((n) => n.knowledge).join("、") || "无";
    const system = "你是「筑巢考研工作台」的 AI 阅读助手。要求：1) 简明扼要，直接给出重点结论；2) 不超过 250 字；3) 不要客套话、不要免责声明、不要推测式铺垫；4) 用小标题列出 2-4 个要点；5) 每个要点后引用原文短句作为依据，格式「引文：「…」」。必须基于给定原文内容，严禁编造。";
    const user = `我正在阅读：《${activeResource.name}》（${subject}），第 ${currentPage} 页。\n本页原文：${pagePdfText || "（未提取到文字，可能是扫描版 PDF）"}\n本页知识点：${knowledge}\n高风险知识点：${weakNodes}\n关联真题：${relatedDesc}\n请基于原文讲重点：本页核心概念 / 适用条件 / 易错点。每点注明原文引文。`;
    await chatCompleteStream({
      system,
      user,
      onDelta: (delta) => {
        if (aiRunRef.current !== runId) return;
        setAiStreamText((prev) => prev + delta);
      },
      onDone: (result) => {
        if (aiRunRef.current !== runId) return;
        if (!result.ok || !result.content) {
          setAiStreamText(`（AI 讲解暂不可用：${chatErrorReason(result.error)}）`);
        }
        setAiStreaming(false);
      },
    });
  }

  // 2026-08-03：AI 助手展开 / 页码变化时自动发起讲解——每翻一页都重新讲解「这一页」内容
  const aiAutoFiredRef = useRef(0);
  useEffect(() => {
    if (aiExpanded && !aiStreaming && aiAutoFiredRef.current !== currentPage) {
      aiAutoFiredRef.current = currentPage;
      void askAiExplain({ silent: false });
    }
    // 页码变化时重新发起，避免「切换第二页 AI 还在讲第一页」
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiExpanded, currentPage]);

  // 2026-08-03：AI 助手旁直接提问（就地流式回答，不跳转）
  const [aiQuestion, setAiQuestion] = useState("");
  async function askAiQuestion() {
    const question = aiQuestion.trim();
    if (!question || aiStreaming) return;
    const runId = aiRunRef.current + 1;
    aiRunRef.current = runId;
    setAiStreamText("");
    setAiStreaming(true);
    setAiQuestion("");
    const subject = activeResource.subject || "当前科目";
    const knowledge = activeResource.linkedNode?.split("/")[2]?.trim() || activeResource.name || "本页内容";
    const system = "你是「筑巢考研工作台」的 AI 阅读助手。要求：1) 简明扼要直接回答；2) 不超过 300 字；3) 不要客套话；4) 可结合当前阅读上下文。严禁编造。";
    const user = `我正在阅读：《${activeResource.name}》（${subject}），第 ${currentPage} 页。\n本页原文：${pagePdfText || "（未提取到文字，可能是扫描版 PDF）"}\n本页知识点：${knowledge}。\n问题：${question}`;
    await chatCompleteStream({
      system,
      user,
      onDelta: (delta) => {
        if (aiRunRef.current !== runId) return;
        setAiStreamText((prev) => prev + delta);
      },
      onDone: (result) => {
        if (aiRunRef.current !== runId) return;
        if (!result.ok || !result.content) {
          setAiStreamText(`（AI 暂不可用：${chatErrorReason(result.error)}）`);
        }
        setAiStreaming(false);
      },
    });
  }

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
    // P3 交互修复（2026-08-01）：空内容不再静默返回，给出可见提示
    if (!newAnnotationText.trim()) {
      flash("请输入批注内容");
      return;
    }
    onCreateAnnotation?.(
      String(currentPage),
      newAnnotationText.trim(),
      newAnnotationTag,
      ""
    );
    setNewAnnotationText("");
    setNewAnnotationTag("重点");
    setShowNewAnnotation(false);
    flash("批注已添加");
  }, [newAnnotationText, newAnnotationTag, currentPage, onCreateAnnotation, flash]);

  // 2026-08-04：PDF 选中文字 → 预填批注表单（文字层 mouseup 捕获选区）
  function capturePdfSelection() {
    const sel = window.getSelection()?.toString().trim() || "";
    if (sel) setPdfSelection(sel);
  }
  function createAnnotationFromSelection() {
    if (!pdfSelection.trim()) return;
    setNewAnnotationText(pdfSelection);
    setNewAnnotationTag("重点");
    setShowNewAnnotation(true);
    setPdfSelection("");
    flash("已选中文字，可调整标签后确认添加");
  }

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
      textLayerTaskRef.current?.cancel();
      textLayerTaskRef.current = null;
      setPdfSelection("");
    };
    // 仅当资源本身（id/文件）变化时才重载 PDF；lastOpenedPage 仅在加载当刻读取一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeResource?.id, activeResource?.fileStorageKey]);

  // ─── Stabilization 1A-2: 当前页 Canvas 渲染（含 1A-2f 单页渲染失败重试）───
  useEffect(() => {
    let cancelled = false;
    if (!isRealPdf || !pdfTotalPages || !activeResource?.fileStorageKey) return;

    async function renderPage() {
      setPdfError(null);
      setPdfLoading(true);
      setPdfSelection("");
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
        const baseScale = (Number(readerZoom.replace("%", "")) || 100) / 100;
        const viewport = page.getViewport({ scale: baseScale });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const renderTask = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = renderTask;
        // 2026-08-04 修复：同步提取当前页真实 PDF 文本（供 AI 讲解/提问，替代"推测"）
        // 2026-08-04 新功能：叠加可选中的透明文字层（选中文字 → 成批注）
        try {
          const content = await page.getTextContent();
          const text = content.items
            .map((item) => ("str" in item ? (item as { str: string }).str : ""))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 3000);
          if (!cancelled) setPagePdfText(text);
          // 仅当本页确有文字时叠加文字层（扫描版无文字层跳过，避免空白覆盖）
          const textLayerEl = textLayerRef.current;
          if (!cancelled && textLayerEl && content.items.length > 0) {
            textLayerEl.innerHTML = "";
            // 文字层尺寸需与 canvas 实际显示尺寸一致（canvas 受 max-width:100% 约束）
            const rect = canvas.getBoundingClientRect();
            const cssScale = rect.width > 0 ? rect.width / (viewport.width || 1) : 1;
            const textViewport = page.getViewport({ scale: baseScale * cssScale });
            const textLayerTask = new pdfjsLib.TextLayer({
              textContentSource: content,
              container: textLayerEl,
              viewport: textViewport,
            });
            textLayerTaskRef.current = textLayerTask;
            await textLayerTask.render();
            if (cancelled) textLayerTaskRef.current = null;
          } else if (!cancelled) {
            textLayerTaskRef.current = null;
          }
        } catch {
          if (!cancelled) setPagePdfText("");
        }
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
      } catch {
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
      textLayerTaskRef.current?.cancel();
      textLayerTaskRef.current = null;
      setPdfSelection("");
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
          <button onClick={() => { onSaveProgress(); flash("已保存阅读进度"); }} className={styles.readerSaveBtn}>
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
                <div className={styles.pdfPageWrap}>
                  <canvas ref={canvasRef} className={styles.readerCanvas} />
                  {/* 2026-08-04：透明文字层覆盖在 canvas 上，文字可选中 → 成批注 */}
                  <div
                    ref={textLayerRef}
                    className={styles.pdfTextLayer}
                    onMouseUp={capturePdfSelection}
                  />
                </div>
                {/* 2026-08-04：选中文字后的快捷操作条 */}
                {pdfSelection && (
                  <div className={styles.pdfSelectionBar}>
                    <span className={styles.pdfSelectionCount}>已选 {pdfSelection.length} 字</span>
                    <button className={styles.pdfSelectionBtn} onClick={createAnnotationFromSelection}>
                      ✏ 存为批注
                    </button>
                    <button className={styles.pdfSelectionCancel} onClick={() => setPdfSelection("")}>
                      取消
                    </button>
                  </div>
                )}
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
                  <p className={`${styles.contentText} ${styles.readerEllipsis}`}>··· 其余内容</p>
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
                  {/* P3 交互修复：搜索无匹配时给出可见提示 */}
                  {readerSearch.trim() && !pageContent.some((para) => searchInContent(para, readerSearch)) && (
                    <p className={`${styles.contentText} ${styles.readerSearchEmpty}`}>未找到与「{readerSearch}」匹配的内容</p>
                  )}
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
                    onClick={() => onShowRelated(q.core, q.knowledge, activeResource.subject)}>
                    {q.year}年 第{q.number}题
                  </button>
                ))}
              </div>
            </div>
          )}
          {subjectNodes.length > 0 && (
            <div className={`${styles.relatedPanel} ${styles.relatedPanelMin}`}>
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
              <span className={styles.aiAssistantLabel}>资料：</span>
              《{activeResource.name}》· {activeResource.subject} · P{currentPage}
            </p>
            {subjectNodes.length > 0 && (
              <p className={`${styles.aiAssistantText} ${styles.aiAssistantTopMargin}`}>
                <span className={styles.aiAssistantLabel}>本页知识点：</span>
                {subjectNodes.slice(0, 4).map((n) => n.knowledge).join("、")}
              </p>
            )}
            {relatedQuestions.length > 0 && (
              <p className={`${styles.aiAssistantText} ${styles.aiAssistantTopMargin}`}>
                <span className={styles.aiAssistantLabel}>关联真题：</span>
                {relatedQuestions.slice(0, 3).map((q) => `${q.year}年 第${q.number}题`).join("、")}
              </p>
            )}
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
            {/* 2026-08-04：展示本页原文，供核对 AI 讲解是否忠于原文（化解"推测"信任问题） */}
            {pagePdfText && (
              <details className={`${styles.aiAssistantText} ${styles.aiAssistantTopMargin}`}>
                <summary className={styles.aiAssistantLabel} style={{ cursor: "pointer" }}>
                  📄 本页原文（点击展开核对）
                </summary>
                <p className={`${styles.contentText} ${styles.aiAssistantTopMargin}`} style={{ color: "rgba(255,255,255,0.8)" }}>
                  {pagePdfText}
                </p>
              </details>
            )}
            <div className={`${styles.aiAssistantActions} ${styles.aiAssistantTopMargin}`}>
              <button className={styles.aiAssistantBtn}
                disabled={aiStreaming}
                onClick={() => askAiExplain()}>
                {aiStreaming ? "💭 AI 讲解中…" : "🤖 AI 讲解本页"}
              </button>
            </div>
            {/* 2026-08-03：AI 助手旁直接提问 */}
            <div className={`${styles.aiAssistantActions} ${styles.aiAssistantTopMargin}`}>
              <input
                className={styles.aiQuestionInput}
                placeholder="向 AI 提问本页内容…"
                value={aiQuestion}
                disabled={aiStreaming}
                onChange={(e) => setAiQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") askAiQuestion();
                }}
              />
              <button
                className={styles.aiAssistantBtn}
                disabled={aiStreaming || !aiQuestion.trim()}
                onClick={askAiQuestion}
              >
                提问
              </button>
            </div>
            {aiStreamText && (
              <div className={`${styles.aiAssistantText} ${styles.aiAssistantTopMargin}`}>
                <span className={styles.aiAssistantLabel}>💬 AI：</span>
                <div className="mt-1 space-y-2">
                  {renderAiStreamText(aiStreamText).map((para, i) => (
                    <p key={i} className={styles.contentText}>{para}</p>
                  ))}
                </div>
              </div>
            )}
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
              {NEW_ANNOTATION_TAGS.map((tag) => (
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
        <div className={styles.annotationToolbar}>
          <button className={styles.annotationToggleBtn} onClick={() => setShowAnnotations(!showAnnotations)}>
            📌 批注 {showAnnotations ? "▶" : `(${annotationCount})`}
          </button>
          {onCreateAnnotation && (
            <button
              className={`${styles.annotationToggleBtn} ${styles.annotationNewBtn}`}
              onClick={() => setShowNewAnnotation(true)}
            >
              ✏ 新建
            </button>
          )}
        </div>

        {showAnnotations && (
          <>
            <div className={styles.annotationStatusBar}>
              {NEW_ANNOTATION_TAGS.map((tag) => (
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
                <div key={tag} className={styles.annotationGroup}>
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
                        <div className={styles.annotationItemHead}>
                          <span className={styles.annotationPage} style={{ color: color.border }}>P{item.page}</span>
                        </div>
                        <p className={styles.annotationText}>{item.selection}</p>
                        {editingAnnId === item.id ? (
                          // P3 交互修复：内联编辑（替代原生 prompt）
                          <div onClick={(e) => e.stopPropagation()} className={styles.annotationEditBlock}>
                            <input
                              className={styles.annotationEditInput}
                              value={editingAnnText}
                              onChange={(e) => setEditingAnnText(e.target.value)}
                              placeholder="批注备注"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  onEditAnnotation(item.id, editingAnnText.trim());
                                  flash("批注已更新");
                                  setEditingAnnId(null);
                                }
                                if (e.key === "Escape") setEditingAnnId(null);
                              }}
                            />
                            <div className={`${styles.annotationActions} ${styles.annotationActionsMargin}`}>
                              <button className={styles.annotationActionBtn}
                                onClick={() => { onEditAnnotation(item.id, editingAnnText.trim()); flash("批注已更新"); setEditingAnnId(null); }}>
                                保存
                              </button>
                              <button className={styles.annotationActionBtn}
                                onClick={() => setEditingAnnId(null)}>
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {item.note && <p className={styles.annotationNote}>✏ {item.note}</p>}
                            <div className={styles.annotationActions}>
                              <button className={styles.annotationActionBtn}
                                onClick={(e) => { e.stopPropagation(); setEditingAnnId(item.id); setEditingAnnText(item.note || ""); }}>
                                编辑
                              </button>
                              {confirmDeleteAnnId === item.id ? (
                                <span onClick={(e) => e.stopPropagation()} className={styles.annotationActions}>
                                  <button className={`${styles.annotationActionBtn} ${styles.annotationActionDanger}`}
                                    onClick={() => { onDeleteAnnotation(item.id); flash("批注已删除"); setConfirmDeleteAnnId(null); }}>
                                    确认删除
                                  </button>
                                  <button className={styles.annotationActionBtn}
                                    onClick={() => setConfirmDeleteAnnId(null)}>
                                    取消
                                  </button>
                                </span>
                              ) : (
                                <button className={`${styles.annotationActionBtn} ${styles.annotationActionDanger}`}
                                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteAnnId(item.id); }}>
                                  删除
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* ⚠ 显式隔离渲染：非法历史标签分组（红色警告，不崩溃） */}
            {annotationsByTag.unknown.length > 0 && (
              <div className={styles.annotationInvalidGroup}>
                <div className={`${styles.annotationSectionHead} ${styles.annotationInvalidHead}`}>
                  <span>⚠️</span>
                  <span className={styles.annotationSectionLabel}>{UNKNOWN_ANNOTATION_TAG}</span>
                  <span className={styles.annotationSectionCount}>{annotationsByTag.unknown.length}</span>
                </div>
                <div className={styles.annotationInvalidLabel}>
                  {UNKNOWN_ANNOTATION_COLOR.label}
                </div>
                {annotationsByTag.unknown.map((item) => (
                  <div key={item.id} className={`${styles.annotationItem} ${styles.annotationInvalidItem}`}
                    onClick={() => onJumpToPage(item.page)}>
                    <div className={styles.annotationItemHead}>
                      <span className={styles.annotationPage} style={{ color: "#DC2626" }}>P{item.page}</span>
                      <span className={styles.annotationInvalidSpan}>非法标签: {String(item.tag)}</span>
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

      {/* P3 交互修复：本地短提示（批注/保存/搜索反馈） */}
      {noticeText && (
        <div className={styles.readerFlashStatic}>
          {noticeText}
        </div>
      )}
    </div>
  );
}
