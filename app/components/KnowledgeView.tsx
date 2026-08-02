"use client";

import { ReaderPanel } from "./ReaderPanel";
import { useWorkspace } from "./workspace-context";
import { dateOnly } from "../lib/utils";
import { appendLearningEvent } from "../lib/events";
import styles from "../../styles/workspace.module.css";
import type { Question, Risk } from "../lib/types";

/** 知识中心视图（从 page.tsx 抽出，行为等价）；数据/回调经 useWorkspace() 取用。 */
export function KnowledgeView() {
  const {
    ALL_GROUPS, coreNames,
    activeView, activeDialog, activeCardSubject, currentSubject, subjects, nodes, activeResource,
    activeKnowledgePanel, activeKnowledgeSubject, resourceView, readingMode,
    readerPage, readerSearch, readerZoom, elapsedSeconds, examAnalyzing, fileUploadState,
    questionFilter, pending, filteredQuestions, relatedQuestions,
    subjectResources, subjectQuestions, subjectNodes, subjectAnnotations,
    setActiveView, setActiveKnowledgePanel, setActiveKnowledgeSubject, setResourceView, setReadingMode,
    setReaderPage, setReaderSearch, setReaderZoom, setResources, setQuestions, setQuestionFilter,
    setNodes, setLearningEvents, setCardSubView, setCardSubjectView, setActiveCardCategory,
    selectKnowledgeSubject, inferResource, openResource, openResourceDialog, closeResourceDialog,
    startUploadProgress, addResource, deleteResource, analyzeMaterial,
    confirmPendingItem, dismissPendingItem, deleteQuestion, deleteNode, createCardFromText,
    onCreateAnnotation, onEditAnnotation, onDeleteAnnotation, showRelatedQuestions,
  } = useWorkspace();
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
                  <button className="p-6 rounded-[12px] border border-[#E4E4E7] bg-white text-left hover:shadow-md transition-shadow" onClick={() => { setActiveKnowledgePanel("resources"); }}>
                    <div className="text-[24px] mb-2">📚</div>
                    <strong className="text-[16px] block mb-1">学习资料</strong>
                    <span className="text-[13px] text-[#71717A]">{subjectResources.length} 个资料</span>
                  </button>
                  <button className="p-6 rounded-[12px] border border-[#E4E4E7] bg-white text-left hover:shadow-md transition-shadow" onClick={() => { setActiveKnowledgePanel("questions"); }}>
                    <div className="text-[24px] mb-2">📝</div>
                    <strong className="text-[16px] block mb-1">真题数据库</strong>
                    <span className="text-[13px] text-[#71717A]">{subjectQuestions.length} 道真题</span>
                  </button>
                  <button className="p-6 rounded-[12px] border border-[#E4E4E7] bg-white text-left hover:shadow-md transition-shadow" onClick={() => { setActiveKnowledgePanel("graph"); }}>
                    <div className="text-[24px] mb-2">🧠</div>
                    <strong className="text-[16px] block mb-1">知识图谱</strong>
                    <span className="text-[13px] text-[#71717A]">{subjectNodes.length} 个知识点</span>
                  </button>
                </div>
              </div>
            )}

            {/* 非 landing：返回按钮统一放在各面板右侧操作区（与成长卡片一致） */}
            {activeKnowledgePanel !== "landing" && (
              <div>

                {/* Resources — 两态：书架页（极简管理与选择）⇄ 阅读页（Reader + 批注 + AI 学习） */}
                {activeKnowledgePanel === "resources" && (
              <div>
                {readingMode && (
                  <div className="section-heading compact-heading">
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
                <div className="section-heading compact-heading">
                  <div><div className="section-label">Material Library</div><h2>我的资料库</h2><p className="section-hint">导入一本教材/一套真题/一本习题集，AI 以「资料」为对象解析。</p></div>
                  <div className="flex items-center gap-3 shrink-0 flex-wrap">
                    <button
                      className="min-h-[32px] px-3 rounded-[8px] bg-white border border-[#D4D4D8] text-[#18181B] font-bold text-[13px] hover:bg-[#F4F4F5] transition-colors"
                      onClick={() => setActiveKnowledgePanel("landing")}
                    >← 返回</button>
                    <button className="secondary-button" onClick={openResourceDialog}>上传资料</button>
                  </div>
                </div>

                    {/* 上传资源 Modal — 文件选择 + AI 识别状态机 */}
                    {activeDialog === "resource" && (
                      <div className="modal-backdrop" role="presentation" onClick={closeResourceDialog}>
                        <section className="modal-panel" role="dialog" aria-modal="true" aria-label="AI识别资料" onClick={(event) => event.stopPropagation()}>
                          <div className="modal-head"><div><span>AI First</span><strong>AI识别资料</strong></div><button onClick={closeResourceDialog}>关闭</button></div>
                          <form onSubmit={addResource} className="modal-form">
                            <input type="hidden" name="sourceText" value={`${activeKnowledgeSubject || "未分科"}空白资料-${dateOnly()}`} />
                            <label className={`upload-drop ${styles.uploadDropLarge}`}>
                              <span className={styles.uploadDropIcon}>📁 拖拽文件到此处</span>
                              <span className={styles.uploadDropHint}>或点击选择 支持 PDF（文件会保存在本机 IndexedDB）</span>
                              <input name="file" type="file" accept=".pdf,application/pdf" onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const rawName = file.name;
                                const inferred = inferResource(rawName, "");
                                startUploadProgress(file, inferred);
                              }} />
                            </label>
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
                                        return <span key={s} className={thisIdx < curIdx ? "text-[#0F766E]" : thisIdx === curIdx ? "text-[#18181B] font-bold" : "opacity-40"}>{thisIdx < curIdx ? "✓" : "·"}</span>;
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
                      <div className="view-toggle">
                        <button className={resourceView === "grid" ? "active" : ""} onClick={() => setResourceView("grid")}>▦ 网格</button>
                        <button className={resourceView === "list" ? "active" : ""} onClick={() => setResourceView("list")}>☰ 列表</button>
                      </div>
                    </div>

                    {/* B-1: 待确认队列（AI 识别结果确认；数据已写入 pending，此处补足渲染与确认/忽略操作） */}
                    {pending.length > 0 && (
                      <div className="mb-4 rounded-[10px] border border-[#EDE9FE] bg-[#FAF5FF] overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-[#F5F3FF]">
                          <strong className="text-[13px] text-[#6D28D9]">AI 待确认队列（{pending.length}）</strong>
                          <span className="text-[11px] text-[#A1A1AA]">AI 识别结果需人工确认后才生效</span>
                        </div>
                        <div className="divide-y divide-[#EDE9FE]">
                          {pending.map((item) => (
                            <div key={item.id} className="flex items-start gap-3 px-3 py-2.5">
                              <span className="text-[14px] shrink-0 mt-0.5">
                                {item.kind === "真题识别" ? "📝" : item.kind === "资料切分" ? "📚" : "🧠"}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <strong className="text-[12px] text-[#18181B] truncate">{item.title}</strong>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-[#EDE9FE] text-[#6D28D9] shrink-0">{item.kind}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#B45309] shrink-0">{item.status}</span>
                                </div>
                                <p className="text-[11px] text-[#71717A] mt-0.5 truncate">{item.detail}</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  className="min-h-[26px] px-3 rounded-[6px] bg-[#6D28D9] text-white font-bold text-[11px]"
                                  onClick={() => confirmPendingItem(item)}
                                >
                                  确认
                                </button>
                                <button
                                  className="min-h-[26px] px-2.5 rounded-[6px] bg-white border border-[#D4D4D8] text-[#71717A] font-bold text-[11px]"
                                  onClick={() => dismissPendingItem(item)}
                                >
                                  忽略
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bookshelf grid / list */}
                    <div className={resourceView === "grid" ? "bookshelf-grid" : "resource-list"}>
                      {subjectResources.length ? subjectResources.map((resource) => {
                        const initials = resource.name.replace(/[《》]/g, "").replace(/第[一二三四五六七八九十\d]+版/g, "").slice(0, 2);
                        const nodeCount = nodes.filter((n) => n.subject === resource.subject).length;
                        const isTextbook = resource.type === "教材";
                        const isPastPaper = resource.type.includes("真题");
                        return (
                          <article key={resource.id} className={resourceView === "grid" ? "book-card" : ""} onClick={() => { if (resourceView === "grid") { setReadingMode(true); openResource(resource); } }}>
                            {resourceView === "grid" ? (
                              // ─── 书架卡（参考 Apple Books / 微信读书）：
                              // 点击整卡进入阅读；当前阅读高亮主题色边框；细进度条；信息只保留主次
                              // 管理操作（AI 重新分析/重命名/删除）全部收进 ⋯ 菜单
                              <>
                                <div
                                  className={`book-spine ${isTextbook ? "empty-cover" : "has-cover"} ${activeResource?.id === resource.id ? "current" : ""}`}
                                  style={activeResource?.id === resource.id ? { borderColor: "#0F766E" } : undefined}
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
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F0FDF4] text-[#0F766E] border border-[#DCFCE7] mb-1 inline-block">📖 当前阅读</span>
                                  )}
                                  <div className="book-title">{resource.name}</div>
                                  {/* 主信息：类型 · 状态（真题显示分析状态） */}
                                  <div className="book-tags">
                                    <span className="tag-badge subtle">{resource.type}</span>
                                    {isPastPaper ? (
                                      <>
                                        <span className={`tag-badge ${resource.status === "已索引" ? "green" : "warn"}`}>{resource.status === "已索引" ? "✓ 已分析" : "待分析"}</span>
                                        {resource.status === "已索引" && <span className="tag-badge subtle">📊 七核:7 · 知识点:{nodeCount || "—"}</span>}
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
                                    value={Math.min(100, Math.max(3, (Number(resource.currentPage || resource.lastOpenedPage || 1) / Math.max(Number(String(resource.currentPage || "132").match(/\d+/)?.[0] || 132) + 40, 1)) * 100))}
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
                              </>
                            ) : (
                              <>
                                <strong>{resource.name}</strong>
                                <span>{resource.subject} / {resource.type} / {resource.status}</span>
                                <p>{resource.fileName} / {resource.pages || "未填页码"} / 关联：{resource.linkedNode}</p>
                                <button className="text-button" onClick={(event) => { event.stopPropagation(); setReadingMode(true); openResource(resource); }}>打开阅读</button>
                                <details className="inline-details">
                                  <summary>编辑资源</summary>
                                  <div className="mini-form">
                                    <label><span>当前页码</span><input value={resource.currentPage} onChange={(event) => setResources((items) => items.map((item) => item.id === resource.id ? { ...item, currentPage: event.target.value, lastRead: "刚刚" } : item))} /></label>
                                    <label><span>关联知识点</span><input value={resource.linkedNode} onChange={(event) => setResources((items) => items.map((item) => item.id === resource.id ? { ...item, linkedNode: event.target.value } : item))} /></label>
                                    <label><span>资源状态</span><select value={resource.status} onChange={(event) => setResources((items) => items.map((item) => item.id === resource.id ? { ...item, status: event.target.value } : item))}><option>待解析</option><option>阅读中</option><option>已读</option><option>已复习</option><option>需要重学</option><option>已索引</option></select></label>
                                    <button type="button" onClick={() => deleteResource(resource)}>删除资源</button>
                                  </div>
                                </details>
                              </>
                            )}
                          </article>
                        );
                      }) : <p className="empty-state">暂无资料，点击「上传资源」导入教材或真题。</p>}
                    </div>
                  </div>
                ) : activeResource ? (
                  <ReaderPanel
                    activeResource={activeResource}
                    readerSearch={readerSearch} readerPage={readerPage} readerZoom={readerZoom}
                    relatedQuestions={relatedQuestions}
                    subjectAnnotations={subjectAnnotations}
                    subjectNodes={subjectNodes}
                    onSetReaderSearch={setReaderSearch} onSetReaderPage={setReaderPage}
                    onSetReaderZoom={setReaderZoom} onSaveProgress={() => {
                      setResources((items) => items.map((item) => item.id === activeResource.id ? { ...item, readingMinutes: String(Math.max(Number(item.readingMinutes || 0), Math.round(elapsedSeconds / 60))) } : item));
                    }}
                    onShowRelated={showRelatedQuestions}
                    onCreateCard={(text, annotation) => { createCardFromText("资料批注", text, annotation); setActiveView("cards"); setCardSubjectView(activeCardSubject || currentSubject?.name || ""); setActiveCardCategory(ALL_GROUPS); setCardSubView("待复习"); }}
                    onCreateAnnotation={onCreateAnnotation}
                    onDeleteAnnotation={onDeleteAnnotation}
                    onEditAnnotation={onEditAnnotation}
                    onJumpToPage={setReaderPage}
                  />
                ) : (
                  <p className="empty-state">当前学科暂无可阅读资料。</p>
                )}
              </div>
                )}

                {/* Questions — 真题以「一套 / 一册」资料方式上传（与学习资料同款 AI 识别），不逐题录入 */}
                {activeKnowledgePanel === "questions" && (
                  <div>
                    {/* 统一极简模板：Material Library + 标题 + 单一导入入口（与「学习资料」共用同一套头部结构） */}
                    <div className="section-heading compact-heading">
                      <div><div className="section-label">Material Library</div><h2>真题数据库</h2><p className="section-hint">{subjectQuestions.length} 套真题 · 以「一套 / 一册」为单位</p></div>
                      <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        <button
                          className="min-h-[32px] px-3 rounded-[8px] bg-white border border-[#D4D4D8] text-[#18181B] font-bold text-[13px] hover:bg-[#F4F4F5] transition-colors"
                          onClick={() => setActiveKnowledgePanel("landing")}
                        >← 返回</button>
                        <button className="secondary-button" onClick={openResourceDialog}>上传真题</button>
                      </div>
                    </div>
                    <p className="text-[12px] text-[#71717A] mb-4">
                      🤖 真题以「一套（PDF）」方式上传，AI 自动识别年份/套卷并按题号拆分。不逐题录入。
                    </p>
                    {examAnalyzing && (
                      <div className="mb-3 text-[12px] text-[#0F766E] font-bold">AI 分析中…（运行 runExamAnalysis）</div>
                    )}
                    {activeDialog === "resource" && (
                      <div className="modal-backdrop" role="presentation" onClick={closeResourceDialog}>
                        <section className="modal-panel" role="dialog" aria-modal="true" aria-label="AI识别资料" onClick={(event) => event.stopPropagation()}>
                          <div className="modal-head"><div><span>真题库</span><strong>上传一套真题</strong></div><button onClick={closeResourceDialog}>关闭</button></div>
                          <form onSubmit={addResource} className="modal-form">
                            <input type="hidden" name="sourceText" value={`${activeKnowledgeSubject || "未分科"}空白真题卷-${dateOnly()}`} />
                            <label className={`upload-drop ${styles.uploadDropLarge}`}>
                              <span className={styles.uploadDropIcon}>📁 拖拽一套真题 PDF 到此处</span>
                              <span className={styles.uploadDropHint}>或点击选择 支持 PDF（AI 自动识别年份/套卷/题号）</span>
                              <input name="file" type="file" accept=".pdf,application/pdf" onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const inferred = inferResource(file.name, activeKnowledgeSubject);
                                startUploadProgress(file, inferred);
                              }} />
                            </label>
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
                    <div className="filter-bar">
                      <select value={questionFilter.subject} onChange={(event) => {
                        const subject = event.target.value;
                        setQuestionFilter({ ...questionFilter, subject });
                        if (subject !== "全部") setActiveKnowledgeSubject(subject);
                      }}><option>全部</option>{subjects.map((subject) => <option key={subject.id}>{subject.name}</option>)}</select>
                      <select value={questionFilter.core} onChange={(event) => setQuestionFilter({ ...questionFilter, core: event.target.value })}><option>全部</option>{coreNames.map((core) => <option key={core}>{core}</option>)}</select>
                      <select value={questionFilter.result} onChange={(event) => setQuestionFilter({ ...questionFilter, result: event.target.value })}><option>全部</option><option>未做</option><option>正确</option><option>错误</option></select>
                      <input value={questionFilter.keyword} onChange={(event) => setQuestionFilter({ ...questionFilter, keyword: event.target.value })} placeholder="搜索年份/题干/知识点" />
                    </div>
                    <div className="question-list">
                      {filteredQuestions.map((question) => (
                        <article key={question.id} className={!question.confirmed ? "unconfirmed" : ""}>
                          <div><strong>{question.year} {question.subject} 第 {question.number} 题</strong><b>{question.confirmed ? "已确认" : "待确认"}</b></div>
                          <p>{question.stem}</p>
                          <span>{question.core} / {question.branch} / {question.knowledge} / {question.layer} / 难度 {question.difficulty}</span>
                          <small>原解析：{question.originalAnalysis || "无"} / AI解析：{question.aiAnalysis}</small>
                          <details className="inline-details">
                            <summary>做题记录/编辑</summary>
                            <div className="mini-form">
                              <label><span>做题结果</span><select value={question.result} onChange={(event) => {
                                const result = event.target.value as Question["result"];
                                setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, result, done: result !== "未做" } : item));
                                // LearningEvent: question_answered（Sprint 1 / Phase A，纯副作用采集）
                                setLearningEvents((prev) => appendLearningEvent(prev, {
                                  type: "question_answered",
                                  sourceRef: {
                                    kind: "question",
                                    id: question.id,
                                    subjectId: question.subject,
                                    nodeIds: nodes.filter((n) => n.core === question.core).map((n) => n.id),
                                  },
                                  payload: { result, errorReason: question.errorReason || undefined },
                                }));
                              }}><option>未做</option><option>正确</option><option>错误</option></select></label>
                              <label><span>错误原因</span><input value={question.errorReason} onChange={(event) => setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, errorReason: event.target.value } : item))} /></label>
                              <label><span>用户笔记</span><input value={question.note} onChange={(event) => setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, note: event.target.value } : item))} /></label>
                              <button type="button" onClick={() => setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, favorite: !item.favorite } : item))}>{question.favorite ? "取消收藏" : "收藏"}</button>
                              <button type="button" onClick={() => deleteQuestion(question)}>删除题目</button>
                            </div>
                          </details>
                        </article>
                      ))}
                      {filteredQuestions.length === 0 && <p className="empty-state">当前筛选下没有真题。</p>}
                    </div>
                  </div>
                )}

                {/* Graph — 知识点由 AI 自动识别、随学习进度更新（不手动上传） */}
                {activeKnowledgePanel === "graph" && (
                  <div>
                    <div className="section-heading">
                      <div><div className="section-label">知识图谱</div><h2>{activeKnowledgeSubject} 知识图谱</h2></div>
                      <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        <button
                          className="min-h-[32px] px-3 rounded-[8px] bg-white border border-[#D4D4D8] text-[#18181B] font-bold text-[13px] hover:bg-[#F4F4F5] transition-colors"
                          onClick={() => setActiveKnowledgePanel("landing")}
                        >← 返回</button>
                      </div>
                    </div>
                    <p className="text-[12px] text-[#71717A] mb-4">
                      🤖 知识点由 AI 从已上传资料自动识别，并随学习进度（做题/复习/复盘）自动更新掌握度。
                    </p>
                    <div className="knowledge-list">
                      {subjectNodes.map((node) => (
                        <article key={node.id} className="p-3 rounded-[8px] border border-[#E4E4E7] bg-white">
                          <div className="flex items-center justify-between mb-1">
                            <strong className="text-[14px]">{node.core} / {node.branch} / {node.knowledge}</strong>
                            <span className={`tag-badge ${node.reviewRisk === "高风险" ? "danger" : node.reviewRisk === "需要关注" ? "warn" : "subtle"}`}>{node.reviewRisk}</span>
                          </div>
                          <p className="text-[12px] text-[#71717A] mb-2">{node.explanation}</p>
                          <div className="flex items-center gap-4 text-[12px] text-[#71717A]">
                            <span>掌握度 <strong className={`${node.masteryScore >= 70 ? "text-[#0F766E]" : node.masteryScore >= 40 ? "text-[#F59E0B]" : "text-[#EF4444]"}`}>{node.masteryScore}%</strong></span>
                            <span>掌握层级 {node.masteryLevel}/4</span>
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
