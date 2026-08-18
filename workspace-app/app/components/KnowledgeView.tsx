"use client";

import { ReaderPanel } from "./ReaderPanel";
import { useWorkspace } from "./workspace-context";
import { dateOnly } from "../lib/utils";
import styles from "../../styles/workspace.module.css";
import type { Risk } from "../lib/types";

/** 递归收集拖拽的文件夹/多文件中的全部文件（webkitGetAsEntry 支持拖入文件夹）。 */
async function collectFilesFromDataTransfer(dataTransfer: DataTransfer | null): Promise<File[]> {
  if (!dataTransfer) return [];
  const files: File[] = [];
  const asyncWalk = (entry: FileSystemEntry | null): Promise<void> =>
    new Promise((resolve) => {
      if (!entry) return resolve();
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        fileEntry.file((file) => { files.push(file); resolve(); }, () => resolve());
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const reader = dirEntry.createReader();
        const readBatch = (): Promise<void> =>
          new Promise((res) => {
            reader.readEntries(async (entries) => {
              if (!entries.length) return res();
              await Promise.all(entries.map(asyncWalk));
              await readBatch(); // readEntries 分批返回，循环读到空
              res();
            }, () => res());
          });
        readBatch().then(resolve, resolve);
      } else resolve();
    });
  const entryPromises: Promise<void>[] = [];
  for (const item of Array.from(dataTransfer.items)) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) entryPromises.push(asyncWalk(entry));
    else {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  await Promise.all(entryPromises);
  return files;
}

/** 知识中心视图（从 page.tsx 抽出，行为等价）；数据/回调经 useWorkspace() 取用。 */
export function KnowledgeView() {
  const {
    ALL_GROUPS,
    activeView, activeDialog, activeCardSubject, currentSubject, subjects, activeResource,
    activeKnowledgePanel, activeKnowledgeSubject, readingMode,
    readerPage, readerSearch, readerZoom, elapsedSeconds, examAnalyzing, fileUploadState,
    relatedQuestions,
    subjectResources, subjectQuestions, subjectNodes, subjectAnnotations,
    materialSections,
    setActiveView, setActiveKnowledgePanel, setReadingMode,
    setReaderPage, setReaderSearch, setReaderZoom, setResources,
    setNodes, setCardSubView, setCardSubjectView, setActiveCardCategory,
    selectKnowledgeSubject, openResource, openResourceDialog, closeResourceDialog,
    startBatchUpload, addResource, deleteResource, analyzeMaterial,
    deleteNode, createCardFromText,
    onCreateAnnotation, onEditAnnotation, onDeleteAnnotation, showRelatedQuestions,
  } = useWorkspace();

  /** 拖拽文件/文件夹到上传区：递归收集全部文件后走批量上传（支持 PDF / DOCX / TXT / MD / 图片）。
   *  传当前所在科目作为 subjectHint，保证文件名不含科目关键词的 PDF 归属当前科目，不跳科。
   *  兜底：某些环境 DataTransfer.items 为空时，回退到 dataTransfer.files 标准列表。 */
  const handleDropFiles = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    let files = await collectFilesFromDataTransfer(e.dataTransfer);
    if (files.length === 0 && e.dataTransfer.files?.length) {
      files = Array.from(e.dataTransfer.files);
    }
    if (files.length) await startBatchUpload(files, activeKnowledgeSubject);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  /** 点击「选择文件夹」批量导入：folder input 使用 webkitdirectory 读取整个文件夹。 */
  const handleFolderInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) await startBatchUpload(files, activeKnowledgeSubject);
    e.target.value = "";
  };

  /** 点击「多选文件」批量导入：multiple input 读取多个文件。 */
  const handleMultiInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) await startBatchUpload(files, activeKnowledgeSubject);
    e.target.value = "";
  };

  // 2026-08-05 产品需求：真题库 =「一套一套真题」——以套卷（整套 PDF 资料）为单位展示与阅读，不逐题拆解
  const subjectPapers = subjectResources.filter((resource) => resource.type.includes("真题"));
  // 2026-08-07 继续审查：翻页实时写回 resource.currentPage / lastOpenedPage——
  // 书架进度条与续读恢复必须跟随真实阅读位置，而非停留在初始 seed 值。
  const handleReaderPageChange = (page: string) => {
    setReaderPage(page);
    if (activeResource) {
      setResources((items) => items.map((item) => item.id === activeResource.id
        ? { ...item, currentPage: page, lastOpenedPage: page }
        : item));
    }
  };
  // 2026-08-07 继续审查：Reader 渲染提升为公共变量——
  // 「学习资料」(resources) 与「真题库」(questions) 共用同一阅读页，避免从真题库打开套卷后无法阅读。
  const readerPanel = activeResource ? (
    <ReaderPanel
      activeResource={activeResource}
      readerSearch={readerSearch} readerPage={readerPage} readerZoom={readerZoom}
      relatedQuestions={relatedQuestions}
      subjectAnnotations={subjectAnnotations}
      subjectNodes={subjectNodes}
      onSetReaderSearch={setReaderSearch} onSetReaderPage={handleReaderPageChange}
      onSetReaderZoom={setReaderZoom} onExit={() => setReadingMode(false)} onSaveProgress={() => {
        setResources((items) => items.map((item) => item.id === activeResource.id ? { ...item, readingMinutes: String(Math.max(Number(item.readingMinutes || 0), Math.round(elapsedSeconds / 60))) } : item));
      }}
      onShowRelated={showRelatedQuestions}
      onCreateCard={(text, annotation) => { createCardFromText("资料批注", text, annotation); setActiveView("cards"); setCardSubjectView(currentSubject?.name || activeCardSubject || ""); setActiveCardCategory(ALL_GROUPS); setCardSubView("待复习"); }}
      onCreateAnnotation={onCreateAnnotation}
      onDeleteAnnotation={onDeleteAnnotation}
      onEditAnnotation={onEditAnnotation}
      onJumpToPage={handleReaderPageChange}
    />
  ) : null;
  return (
          <section className={`knowledge workspace-pane ${activeView === "knowledge" ? "active" : ""}`} id="knowledge-center">
            {/* 知识中心首页：科目 Tab + 三个入口 */}
            {activeKnowledgePanel === "landing" && (
              <div>
                <div className="section-heading">
                  <div><div className="section-label">Knowledge Center</div><h2>知识中心</h2></div>
                </div>
                {/* 科目 Tab */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {subjects.map((subject) => (
                    <button
                      key={subject.id}
                      className={`min-h-[30px] px-3 rounded-[8px] font-bold text-[12px] ${
                        activeKnowledgeSubject === subject.name
                          ? "bg-[#18181B] text-white"
                          : "bg-[#F4F4F5] text-[#18181B]"
                      }`}
                      onClick={() => selectKnowledgeSubject(subject.name)}
                    >
                      {subject.name}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div role="button" tabIndex={0} className="p-6 rounded-[12px] border border-[#E4E4E7] bg-white text-left cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveKnowledgePanel("questions"); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveKnowledgePanel("questions"); } }}>
                    <div className="text-[24px] mb-2">📝</div>
                    <strong className="text-[16px] block mb-1">真题库</strong>
                    <span className="text-[13px] text-[#71717A]">{subjectPapers.length} 套真题</span>
                  </div>
                  <div role="button" tabIndex={0} className="p-6 rounded-[12px] border border-[#E4E4E7] bg-white text-left cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveKnowledgePanel("resources"); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveKnowledgePanel("resources"); } }}>
                    <div className="text-[24px] mb-2">📚</div>
                    <strong className="text-[16px] block mb-1">学习资料</strong>
                    <span className="text-[13px] text-[#71717A]">{subjectResources.length} 个资料</span>
                  </div>
                  <div role="button" tabIndex={0} className="p-6 rounded-[12px] border border-[#E4E4E7] bg-white text-left cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveKnowledgePanel("graph"); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveKnowledgePanel("graph"); } }}>
                    <div className="text-[24px] mb-2">🧠</div>
                    <strong className="text-[16px] block mb-1">知识图谱</strong>
                    <span className="text-[13px] text-[#71717A]">{subjectNodes.length} 个知识点</span>
                  </div>
                </div>
              </div>
            )}

            {/* 非 landing：返回按钮统一放在各面板右侧操作区（与沉淀卡片一致） */}
            {activeKnowledgePanel !== "landing" && (
              <div>

                {/* Resources — 两态：书架页（极简管理与选择）⇄ 阅读页（Reader + 批注 + AI 学习） */}
                {activeKnowledgePanel === "resources" && (
              <div>
                {readingMode && (
                  <div className="section-heading">
                    <div>
                      <div className="section-label">Reader</div>
                      <h2 className="truncate">{activeResource?.name || "资料"}</h2>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                      <button
                        className="min-h-[32px] px-3 rounded-[8px] bg-white border border-[#D4D4D8] text-[#18181B] font-bold text-[13px] hover:bg-[#F4F4F5] transition-colors"
                        onClick={() => setReadingMode(false)}
                      >← 返回</button>
                    </div>
                  </div>
                )}
                {!readingMode ? (
                <div>
                <div className="section-heading">
                  <div><div className="section-label">Material Library</div><h2>我的资料库</h2></div>
                  <div className="flex items-center gap-3 shrink-0 flex-wrap">
                    <button
                      className="min-h-[32px] px-3 rounded-[8px] bg-white border border-[#D4D4D8] text-[#18181B] font-bold text-[13px] hover:bg-[#F4F4F5] transition-colors"
                      onClick={() => setActiveKnowledgePanel("landing")}
                    >← 返回</button>
                    <button className="secondary-button" onClick={openResourceDialog}>上传资料</button>
                  </div>
                </div>

                    {/* 学科 Tab（与沉淀卡片一致：标题固定、学科 Tab 保持显示，切换不跳转） */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {subjects.map((subject) => (
                        <button
                          key={subject.id}
                          className={`min-h-[30px] px-3 rounded-[8px] font-bold text-[12px] ${
                            activeKnowledgeSubject === subject.name
                              ? "bg-[#18181B] text-white"
                              : "bg-[#F4F4F5] text-[#18181B]"
                          }`}
                          onClick={() => selectKnowledgeSubject(subject.name)}
                        >
                          {subject.name}
                        </button>
                      ))}
                    </div>

                    {/* 上传资源 Modal — 文件选择 + AI 识别状态机 */}
                    {activeDialog === "resource" && (
                      <div className="modal-backdrop" role="presentation" onClick={closeResourceDialog}>
                        <section className="modal-panel" role="dialog" aria-modal="true" aria-label="AI识别资料" onClick={(event) => event.stopPropagation()}>
                          <div className="modal-head"><div><span>AI First</span><strong>AI识别资料</strong></div><button onClick={closeResourceDialog}>关闭</button></div>
                          <form onSubmit={addResource} className="modal-form">
                            <input type="hidden" name="sourceText" value={`${activeKnowledgeSubject || "未分科"}空白资料-${dateOnly()}`} />
                            <div className={`upload-drop ${styles.uploadDropLarge}`}
                              onDragOver={handleDragOver}
                              onDrop={handleDropFiles}
                            >
                              <span className={styles.uploadDropIcon}>📁 拖拽文件或文件夹到此处</span>
                              <span className={styles.uploadDropHint}>支持 PDF / DOCX / TXT / MD / 图片；Word 97-2003（.doc）请先用 Word/WPS 另存为 PDF 或 .docx</span>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <label className="inline-flex items-center justify-center min-h-[38px] px-4 rounded-[8px] bg-white border border-[#D4D4D8] text-[#18181B] font-bold text-[13px] cursor-pointer hover:bg-[#F4F4F5] transition-colors" role="button">
                                选择多个文件
                                <input type="file" accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,text/plain,.md,text/markdown,.png,image/png,.jpg,image/jpeg,.webp,image/webp,.gif,image/gif" multiple className="hidden" onChange={handleMultiInput} />
                              </label>
                              <label className="inline-flex items-center justify-center min-h-[38px] px-4 rounded-[8px] bg-white border border-[#D4D4D8] text-[#18181B] font-bold text-[13px] cursor-pointer hover:bg-[#F4F4F5] transition-colors" role="button">
                                选择文件夹
                                <input
                                  type="file"
                                  multiple
                                  // @ts-expect-error webkitdirectory 非标准属性
                                  webkitdirectory=""
                                  directory=""
                                  className="hidden"
                                  onChange={handleFolderInput}
                                />
                              </label>
                            </div>
                            {fileUploadState && (
                              <div className="p-3 mt-3 rounded-[8px] border border-[#E4E4E7] bg-white flex items-center gap-3">
                                <span className={styles.fileIcon}>📄</span>
                                <div className="flex-1 min-w-0">
                                  <strong className="text-[14px] block truncate">{fileUploadState.name}</strong>
                                  <span className="text-[12px] text-[#71717A]">{(fileUploadState.size / (1024 * 1024)).toFixed(1)} MB · {fileUploadState.inferred.pages.includes("AI识别") ? "AI识别中" : fileUploadState.inferred.pages}</span>
                                  {fileUploadState.step !== "done" && (
                                    <div className="mt-1 flex items-center gap-1 text-[11px] text-[#71717A]">
                                      {["uploading", "extracting", "identifying", "parsing", "mapping"].map((s) => {
                                        const stages = ["uploading", "extracting", "identifying", "parsing", "mapping"];
                                        const curIdx = stages.indexOf(fileUploadState.step);
                                        const thisIdx = stages.indexOf(s);
                                        return <span key={s} className={thisIdx < curIdx ? "text-[#18181B]" : thisIdx === curIdx ? "text-[#18181B] font-bold" : "opacity-40"}>{thisIdx < curIdx ? "✓" : "·"}</span>;
                                      })}
                                      <span className="ml-1">
                                        {fileUploadState.step === "uploading" ? "上传中" : fileUploadState.step === "extracting" ? "提取文本" : fileUploadState.step === "identifying" ? "识别科目/类型" : fileUploadState.step === "parsing" ? "解析章节" : fileUploadState.step === "mapping" ? "关联知识图谱" : ""}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {fileUploadState?.step === "done" && (
                              <div className="p-3 mt-3 rounded-[8px] border border-[#E4E4E7] bg-white">
                                <div className="text-[12px] font-bold text-[#18181B] mb-2">AI 识别结果</div>
                                {[
                                  { icon: '📘', label: '类型', value: fileUploadState.inferred.type },
                                  { icon: '📖', label: '书名', value: fileUploadState.inferred.name },
                                  { icon: '📚', label: '所属科目', value: fileUploadState.inferred.subject },
                                  { icon: '🧠', label: '知识体系', value: fileUploadState.inferred.linkedNode },
                                ].map((item) => (
                                  <div key={item.label} className="flex items-center gap-2 text-[12px] mt-1">
                                    <span>{item.icon}</span>
                                    <span className="text-[#71717A] w-[64px] shrink-0">{item.label}</span>
                                    <span className="text-[#18181B]">{item.value}</span>
                                  </div>
                                ))}
                                <div className="flex gap-2 mt-3">
                                  <button className="primary-btn" type="submit">确认保存</button>
                                  <button className="secondary-btn" type="button" onClick={closeResourceDialog}>取消</button>
                                </div>
                              </div>
                            )}
                            {!fileUploadState && (
                              <div className="flex gap-2 mt-3">
                                <button className="primary-btn" type="submit">直接添加空白资料</button>
                              </div>
                            )}
                          </form>
                        </section>
                      </div>
                    )}

                    {/* 资料库工具栏 */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[13px] text-[#71717A]">{subjectResources.length} 个资料</span>
                    </div>

                    {/* 2026-08-03 产品方向：资料上传即自动确认，不再展示「AI 待确认队列」 */}

                    {/* Bookshelf grid */}
                    {subjectResources.length > 0 && (
                    <div className="bookshelf-grid">
                      {subjectResources.map((resource) => {
                        const initials = resource.name.replace(/[《》]/g, "").replace(/第[一二三四五六七八九十\d]+版/g, "").slice(0, 2);
                        const isTextbook = resource.type === "教材";
                        const isPastPaper = resource.type.includes("真题");
                        return (
                          <article key={resource.id} className="book-card" onClick={() => { setReadingMode(true); openResource(resource); }}>
                            <div
                              className={`book-spine ${isTextbook ? "empty-cover" : "has-cover"} ${activeResource?.id === resource.id ? "current" : ""}`}
                              style={activeResource?.id === resource.id ? { borderColor: "#18181B" } : undefined}
                            >
                              {isTextbook ? (
                                <span className="initials">{initials}</span>
                              ) : isPastPaper ? (
                                <span>📝</span>
                              ) : (
                                <span>📄</span>
                              )}
                            </div>
                            <div className="book-body">
                              {/* 当前阅读标签 */}
                              {activeResource?.id === resource.id && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F4F4F5] text-[#18181B] border border-[#E4E4E7] mb-1 inline-block">📖 当前阅读</span>
                              )}
                              <div className="book-title">{resource.name}</div>
                              {/* 主信息：类型 · 状态（真题显示分析状态） */}
                              <div className="book-tags">
                                <span className="tag-badge subtle">{resource.type}</span>
                                {isPastPaper ? (
                                  <>
                                    <span className={`tag-badge ${resource.status === "已索引" ? "green" : "warn"}`}>{resource.status === "已索引" ? "✓ 已分析" : "待分析"}</span>
                                  </>
                                ) : (
                                  <span className={`tag-badge ${resource.status === "已索引" ? "green" : "subtle"}`}>{resource.status}</span>
                                )}
                              </div>
                              {/* 阅读进度（书架最重要的信息：读到哪里了） */}
                              <div className="text-[12px] text-[#71717A] mt-1.5 flex items-center gap-2">
                                <span>阅读到 P</span>
                                <strong className="text-[#18181B]">{resource.currentPage || resource.lastOpenedPage || "1"}</strong>
                                <span className="text-[11px] text-[#A1A1AA]">({resource.currentPage ? "续读" : "未开始"})</span>
                              </div>
                              <progress
                                className={`${styles.progressBar} mt-1`}
                                value={Math.min(100, Math.max(3, (Number(resource.currentPage || resource.lastOpenedPage || 1) / Math.max(Number(String(resource.pages || "100").match(/\d+/)?.[0] || 100), 1)) * 100))}
                                max={100}
                              />
                              {/* ⋯ 菜单：AI 重新分析 / 删除（不再常驻操作按钮） */}
                              <details className="more-menu mt-2" onClick={(e) => e.stopPropagation()}>
                                <summary className="text-[12px] min-h-[24px] px-2 rounded-[6px] bg-[#F4F4F5] text-[#71717A] font-bold inline-flex items-center">⋯</summary>
                                <div className="more-items">
                                  <button className="text-button text-[12px]" onClick={(e) => { e.stopPropagation(); analyzeMaterial(resource); }}>
                                    {resource.status === "已索引" ? "🔄 AI 重新分析" : "🤖 AI 分析"}
                                  </button>
                                  <button className="text-button text-[12px]" onClick={(e) => { e.stopPropagation(); deleteResource(resource); }}>删除</button>
                                </div>
                              </details>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    )}
                    {subjectResources.length === 0 && <p className="empty-state">暂无资料，点击「上传资源」导入教材或真题。</p>}
                  </div>
                ) : readerPanel ? (
                  readerPanel
                ) : (
                  <p className="empty-state">当前学科暂无可阅读资料。</p>
                )}
              </div>
                )}

                {/* Questions — 真题以「一套 / 一册」资料方式上传（与学习资料同款 AI 识别），不逐题录入 */}
                {activeKnowledgePanel === "questions" && (
                  <div>
                    {/* 统一极简模板：Material Library + 标题 + 单一导入入口（与「学习资料」共用同一套头部结构） */}
                    <div className="section-heading">
                      <div><div className="section-label">Material Library</div><h2>真题库</h2></div>
                      <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        <button
                          className="min-h-[32px] px-3 rounded-[8px] bg-white border border-[#D4D4D8] text-[#18181B] font-bold text-[13px] hover:bg-[#F4F4F5] transition-colors"
                          onClick={() => setActiveKnowledgePanel("landing")}
                        >← 返回</button>
                        <button className="secondary-button" onClick={openResourceDialog}>上传真题</button>
                      </div>
                    </div>

                    {/* 学科 Tab（与沉淀卡片一致：标题固定、学科 Tab 保持显示，切换不跳转） */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {subjects.map((subject) => (
                        <button
                          key={subject.id}
                          className={`min-h-[30px] px-3 rounded-[8px] font-bold text-[12px] ${
                            activeKnowledgeSubject === subject.name
                              ? "bg-[#18181B] text-white"
                              : "bg-[#F4F4F5] text-[#18181B]"
                          }`}
                          onClick={() => selectKnowledgeSubject(subject.name)}
                        >
                          {subject.name}
                        </button>
                      ))}
                    </div>
                    {examAnalyzing && (
                      <div className="mb-3 text-[12px] text-[#18181B] font-bold">AI 分析中…（运行 runExamAnalysis）</div>
                    )}
                    {activeDialog === "resource" && (
                      <div className="modal-backdrop" role="presentation" onClick={closeResourceDialog}>
                        <section className="modal-panel" role="dialog" aria-modal="true" aria-label="AI识别资料" onClick={(event) => event.stopPropagation()}>
                          <div className="modal-head"><div><span>真题库</span><strong>上传一套真题</strong></div><button onClick={closeResourceDialog}>关闭</button></div>
                          <form onSubmit={addResource} className="modal-form">
                            <input type="hidden" name="sourceText" value={`${activeKnowledgeSubject || "未分科"}空白真题卷-${dateOnly()}`} />
                            <div className={`upload-drop ${styles.uploadDropLarge}`}
                              onDragOver={handleDragOver}
                              onDrop={handleDropFiles}
                            >
                              <span className={styles.uploadDropIcon}>📁 拖拽真题 PDF / DOCX / 文件夹到此处</span>
                              <span className={styles.uploadDropHint}>支持 PDF / DOCX / TXT / MD / 图片；.doc 请另存为 PDF 或 .docx 后导入</span>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <label className="inline-flex items-center justify-center min-h-[38px] px-4 rounded-[8px] bg-white border border-[#D4D4D8] text-[#18181B] font-bold text-[13px] cursor-pointer hover:bg-[#F4F4F5] transition-colors" role="button">
                                选择多个文件
                                <input type="file" accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,text/plain,.md,text/markdown,.png,image/png,.jpg,image/jpeg,.webp,image/webp,.gif,image/gif" multiple className="hidden" onChange={handleMultiInput} />
                              </label>
                              <label className="inline-flex items-center justify-center min-h-[38px] px-4 rounded-[8px] bg-white border border-[#D4D4D8] text-[#18181B] font-bold text-[13px] cursor-pointer hover:bg-[#F4F4F5] transition-colors" role="button">
                                选择文件夹
                                <input
                                  type="file"
                                  multiple
                                  // @ts-expect-error webkitdirectory 非标准属性
                                  webkitdirectory=""
                                  directory=""
                                  className="hidden"
                                  onChange={handleFolderInput}
                                />
                              </label>
                            </div>
                            {fileUploadState?.step === "done" && (
                              <div className="p-3 mt-3 rounded-[8px] border border-[#E4E4E7] bg-white">
                                <div className="text-[12px] font-bold text-[#18181B] mb-2">AI 识别结果（整套真题）</div>
                                {[
                                  { icon: '📝', label: '套卷', value: fileUploadState.inferred.name },
                                  { icon: '📚', label: '所属科目', value: fileUploadState.inferred.subject },
                                  { icon: '🧠', label: '知识体系', value: fileUploadState.inferred.linkedNode },
                                ].map((item) => (
                                  <div key={item.label} className="flex items-center gap-2 text-[12px] mt-1">
                                    <span>{item.icon}</span><span className="text-[#71717A] w-[64px] shrink-0">{item.label}</span><span className="text-[#18181B]">{item.value}</span>
                                  </div>
                                ))}
                                <div className="flex gap-2 mt-3">
                                  <button className="primary-btn" type="submit">确认保存整套</button>
                                  <button className="secondary-btn" type="button" onClick={closeResourceDialog}>取消</button>
                                </div>
                              </div>
                            )}
                            {!fileUploadState && <button className="primary-btn mt-3" type="submit">直接添加空白真题卷</button>}
                          </form>
                        </section>
                      </div>
                    )}
                    {readingMode && readerPanel ? (
                      readerPanel
                    ) : (
                      <>
                    {/* 真题库 =「一套一套真题」书架：不逐题拆解，整套入库直接阅读 */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[13px] text-[#71717A]">{subjectPapers.length} 套真题</span>
                    </div>
                    {subjectPapers.length > 0 && (
                      <div className="bookshelf-grid">
                        {subjectPapers.map((paper) => {
                          const paperSections = materialSections.filter((section) => section.materialId === paper.id);
                          const questionCount = subjectQuestions.filter((question) => question.materialId === paper.id).length;
                          const sectionYears = Array.from(new Set(paperSections.map((section) => section.title.match(/20\d{2}/)?.[0]).filter((year): year is string => Boolean(year))));
                          const isAnalyzed = paper.status === "已索引";
                          return (
                            <article key={paper.id} className="book-card" onClick={() => { setReadingMode(true); openResource(paper); }}>
                              <div
                                className={`book-spine has-cover ${activeResource?.id === paper.id ? "current" : ""}`}
                                style={activeResource?.id === paper.id ? { borderColor: "#18181B" } : undefined}
                              >
                                <span>📝</span>
                              </div>
                              <div className="book-body">
                                {activeResource?.id === paper.id && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F4F4F5] text-[#18181B] border border-[#E4E4E7] mb-1 inline-block">📖 当前阅读</span>
                                )}
                                <div className="book-title">{paper.name}</div>
                                <div className="book-tags">
                                  <span className="tag-badge subtle">真题</span>
                                  <span className={`tag-badge ${isAnalyzed ? "green" : "warn"}`}>{isAnalyzed ? "✓ 已分析" : "待分析"}</span>
                                </div>
                                <div className="text-[12px] text-[#71717A] mt-1.5 flex items-center gap-2">
                                  {sectionYears.length > 0 && <span>{sectionYears.join(" / ")} 年</span>}
                                  <span>{questionCount > 0 ? `${questionCount} 道题` : "整套直接阅读"}</span>
                                </div>
                                {/* ⋯ 菜单：AI 重新分析 / 删除（与学习资料书架一致） */}
                                <details className="more-menu mt-2" onClick={(e) => e.stopPropagation()}>
                                  <summary className="text-[12px] min-h-[24px] px-2 rounded-[6px] bg-[#F4F4F5] text-[#71717A] font-bold inline-flex items-center">⋯</summary>
                                  <div className="more-items">
                                    <button className="text-button text-[12px]" onClick={(e) => { e.stopPropagation(); analyzeMaterial(paper); }}>
                                      {isAnalyzed ? "🔄 AI 重新分析" : "🤖 AI 分析"}
                                    </button>
                                    <button className="text-button text-[12px]" onClick={(e) => { e.stopPropagation(); deleteResource(paper); }}>删除</button>
                                  </div>
                                </details>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                    {subjectPapers.length === 0 && <p className="empty-state">暂无真题套卷——点击「上传真题」导入整套 PDF / DOCX，直接阅读。</p>}
                      </>
                    )}
                  </div>
                )}

                {/* Graph — 知识点由 AI 自动识别、随学习进度更新（不手动上传） */}
                {activeKnowledgePanel === "graph" && (
                  <div>
                    <div className="section-heading">
                      <div><div className="section-label">Material Library</div><h2>知识图谱</h2></div>
                      <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        <button
                          className="min-h-[32px] px-3 rounded-[8px] bg-white border border-[#D4D4D8] text-[#18181B] font-bold text-[13px] hover:bg-[#F4F4F5] transition-colors"
                          onClick={() => setActiveKnowledgePanel("landing")}
                        >← 返回</button>
                      </div>
                    </div>

                    {/* 学科 Tab（与沉淀卡片一致：标题固定、学科 Tab 保持显示，切换不跳转） */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {subjects.map((subject) => (
                        <button
                          key={subject.id}
                          className={`min-h-[30px] px-3 rounded-[8px] font-bold text-[12px] ${
                            activeKnowledgeSubject === subject.name
                              ? "bg-[#18181B] text-white"
                              : "bg-[#F4F4F5] text-[#18181B]"
                          }`}
                          onClick={() => selectKnowledgeSubject(subject.name)}
                        >
                          {subject.name}
                        </button>
                      ))}
                    </div>
                    <div className="knowledge-list">
                      {subjectNodes.map((node) => (
                        <article key={node.id} className="p-3 rounded-[8px] border border-[#E4E4E7] bg-white">
                          <div className="flex items-center justify-between mb-1">
                            <strong className="text-[14px]">{node.core} / {node.branch} / {node.knowledge}</strong>
                            <span className={`tag-badge ${node.reviewRisk === "高风险" ? "danger" : node.reviewRisk === "需要关注" ? "warn" : "subtle"}`}>
                              {node.reviewRisk === "高风险" ? "重点巩固" : node.reviewRisk === "需要关注" ? "建议复习" : "正常"}
                            </span>
                          </div>
                          <p className="text-[12px] text-[#71717A] mb-2">{node.explanation}</p>
                          <div className="flex items-center gap-4 text-[12px] text-[#71717A]">
                            <span>掌握度 <strong className={`${node.masteryScore >= 70 ? "text-[#18181B]" : node.masteryScore >= 40 ? "text-[#F59E0B]" : "text-[#EF4444]"}`}>{node.masteryScore}%</strong></span>
                            <span>错题 {node.mistakes} 次</span>
                            {node.isMonthlyFocus && <span className="tag-badge green">当月重点</span>}
                          </div>
                          <details className="inline-details">
                            <summary className="text-[12px] text-[#71717A] font-bold">编辑</summary>
                            <div className="mini-form mt-2">
                              <label><span>知识点</span><input value={node.knowledge} onChange={(event) => setNodes((items) => items.map((item) => item.id === node.id ? { ...item, knowledge: event.target.value } : item))} /></label>
                              <label><span>掌握分数</span><input value={node.masteryScore} onChange={(event) => setNodes((items) => items.map((item) => item.id === node.id ? { ...item, masteryScore: Number(event.target.value || 0) } : item))} /></label>
                              <label><span>复习风险</span><select value={node.reviewRisk} onChange={(event) => setNodes((items) => items.map((item) => item.id === node.id ? { ...item, reviewRisk: event.target.value as Risk } : item))}><option>正常</option><option>需要关注</option><option>进度落后</option><option>高风险</option></select></label>
                              <button type="button" onClick={() => deleteNode(node)}>删除节点</button>
                            </div>
                          </details>
                        </article>
                      ))}
                      {subjectNodes.length === 0 && <p className="empty-state">暂无知识点——上传资料并点击「AI 分析」后自动生成图谱。</p>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
  );
}
