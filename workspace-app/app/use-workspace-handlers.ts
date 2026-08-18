 "use client";

import { useEffect, type Dispatch, type SetStateAction, type FormEvent } from "react";
import type {
  WorkspaceView, KnowledgePanel,
  ActiveDialog, DeletedBackup,
  Resource, Question, KnowledgeNode, Task,
  PendingItem, Review, PlanLog, StudyDay,
  GrowthCard, Annotation, Note, AgentStep, StudyDraft, ChatSession, CardCategory,
  StructuredReview, Material, MaterialSection,
  Subject, ExamGoal, AppSettings,
} from "./lib/types";
import { resourceToMaterial, resourceToMaterialSections } from "./lib/types";
import { seedNotes, seedResources, seedQuestions } from "./lib/default-data";
import { TASK, MAX_STUDY_DAYS } from "./lib/rules";
import { savePdfFile, deletePdfFile, saveDocText } from "./lib/pdf-storage";
import { isDocxFile, isLegacyDocFile, isTextFileType, isImageFileType, extractDocxText, extractTextFileContent } from "./lib/docx-utils";
import { saveWorkspace, STORAGE_VERSION } from "./lib/storage";
import { appendLearningEvent, type LearningEvent } from "./lib/events";
import { createMessage, appendMessage, classifyPromptIntent } from "./lib/chat";
import { analyzeExam, analyzeErrorReason } from "./lib/ai/analyze-exam";
import { analyzeMistakes, mistakesErrorReason } from "./lib/ai/analyze-mistakes";
import { generatePlan as generateTodayPlan, planErrorReason } from "./lib/ai/plan-generate";
import { chatCompleteStream, chatErrorReason } from "./lib/ai/chat-complete";
import { buildMaterialBundle, extractQuestionKeyword } from "./lib/materials";
import { makeId, today, dateOnly, normalizeExamGoal } from "./lib/utils";
import type { ResourceInference } from "./components/workspace-context";
import type { OnboardingResult } from "./components/OnboardingWizard";
import { useChatSession } from "./use-chat-session";

export interface HandlerDeps {
  ALL_GROUPS: string;
  UNCATEGORIZED: string;
  activeCardCategory: string | null;
  setActiveCardCategory: Dispatch<SetStateAction<string | null>>;
  activeCardSubject: string;
  setActiveCardSubject: Dispatch<SetStateAction<string>>;
  activeGroupCard: GrowthCard | null;
  activeKnowledgePanel: KnowledgePanel;
  setActiveKnowledgePanel: Dispatch<SetStateAction<KnowledgePanel>>;
  activeKnowledgeSubject: string;
  setActiveKnowledgeSubject: Dispatch<SetStateAction<string>>;
  activeResource: Resource | null;
  activeSessionIdRef: { current: string };
  activeTaskId: string;
  setActiveTaskId: Dispatch<SetStateAction<string>>;
  activeView: WorkspaceView;
  setActiveView: Dispatch<SetStateAction<WorkspaceView>>;
  cardFlipped: boolean;
  setCardFlipped: Dispatch<SetStateAction<boolean>>;
  cardSubView: "待复习" | "全部" | "收藏";
  setCardSubView: Dispatch<SetStateAction<"待复习" | "全部" | "收藏">>;
  cardSubjectView: string | null;
  setCardSubjectView: Dispatch<SetStateAction<string | null>>;
  cards: GrowthCard[];
  setCards: Dispatch<SetStateAction<GrowthCard[]>>;
  categories: CardCategory[];
  setCategories: Dispatch<SetStateAction<CardCategory[]>>;
  categoryReviewQueue: GrowthCard[];
  chatInput: string;
  setChatInput: Dispatch<SetStateAction<string>>;
  completionModalAllowEditTime: boolean;
  setCompletionModalAllowEditTime: Dispatch<SetStateAction<boolean>>;
  completionModalCustomMinutes: string;
  setCompletionModalCustomMinutes: Dispatch<SetStateAction<string>>;
  currentSubject: Subject | undefined;
  elapsedSeconds: number;
  setElapsedSeconds: Dispatch<SetStateAction<number>>;
  exam: ExamGoal;
  setExam: Dispatch<SetStateAction<ExamGoal>>;
  examAnalyzing: boolean;
  setExamAnalyzing: Dispatch<SetStateAction<boolean>>;
  lastDeleted: DeletedBackup | null;
  setLastDeleted: Dispatch<SetStateAction<DeletedBackup | null>>;
  materialAnalysisRunRef: { current: number };
  materialAnalysisTimeoutsRef: { current: ReturnType<typeof setTimeout>[] };
  materialSections: MaterialSection[];
  setMaterialSections: Dispatch<SetStateAction<MaterialSection[]>>;
  newCardDeckName: string;
  setNewCardDeckName: Dispatch<SetStateAction<string>>;
  nodes: KnowledgeNode[];
  setNodes: Dispatch<SetStateAction<KnowledgeNode[]>>;
  questions: Question[];
  setQuestions: Dispatch<SetStateAction<Question[]>>;
  resources: Resource[];
  setResources: Dispatch<SetStateAction<Resource[]>>;
  resourcesRef: { current: Resource[] };
  setActiveDialog: Dispatch<SetStateAction<ActiveDialog>>;
  setActiveResourceId: Dispatch<SetStateAction<string>>;
  setActiveSessionId: Dispatch<SetStateAction<string>>;
  setActiveTimerTaskId: Dispatch<SetStateAction<string>>;
  setAgentSteps: Dispatch<SetStateAction<AgentStep[]>>;
  setAnnotations: Dispatch<SetStateAction<Annotation[]>>;
  setCardDialogCategory: Dispatch<SetStateAction<string>>;
  setCardDialogSubject: Dispatch<SetStateAction<string>>;
  setCardIndex: Dispatch<SetStateAction<number>>;
  setChatHistoryOpen: Dispatch<SetStateAction<boolean>>;
  setChatSessions: Dispatch<SetStateAction<ChatSession[]>>;
  setCloseConfirmPending: Dispatch<SetStateAction<boolean>>;
  setCompletionModalCustomEndTime: Dispatch<SetStateAction<string>>;
  setEditingCardId: Dispatch<SetStateAction<string | null>>;
  setFileUploadState: Dispatch<SetStateAction<{ name: string; size: number; inferred: ResourceInference; step: string } | null>>;
  setLearningEvents: Dispatch<SetStateAction<LearningEvent[]>>;
  setLogs: Dispatch<SetStateAction<PlanLog[]>>;
  setMaterials: Dispatch<SetStateAction<Material[]>>;
  setNewCardDeckOpen: Dispatch<SetStateAction<boolean>>;
  setNotes: Dispatch<SetStateAction<typeof seedNotes>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setOnboardingCompleted: Dispatch<SetStateAction<boolean>>;
  setPending: Dispatch<SetStateAction<PendingItem[]>>;
  setQuestionFilter: Dispatch<SetStateAction<{ subject: string; core: string; result: string; keyword: string }>>;
  setReaderPage: Dispatch<SetStateAction<string>>;
  setStructuredReviews: Dispatch<SetStateAction<StructuredReview[]>>;
  setStudyDays: Dispatch<SetStateAction<StudyDay[]>>;
  setStudyDraft: Dispatch<SetStateAction<StudyDraft | null>>;
  setSubjects: Dispatch<SetStateAction<Subject[]>>;
  setTasks: Dispatch<SetStateAction<Task[]>>;
  setTimerAccumSeconds: Dispatch<SetStateAction<number>>;
  setTimerRunStartEpoch: Dispatch<SetStateAction<number>>;
  setTimerStartTime: Dispatch<SetStateAction<string>>;
  studyDraft: StudyDraft | null;
  subjectCategories: CardCategory[];
  subjects: Subject[];
  tasks: Task[];
  timerAccumSeconds: number;
  timerIntervalRef: { current: ReturnType<typeof setInterval> | undefined };
  timerRunStartEpoch: number;
  uploadProgressRunRef: { current: number };
  uploadProgressTimeoutsRef: { current: ReturnType<typeof setTimeout>[] };
  appSettings: AppSettings;
  materials: Material[];
  pending: PendingItem[];
  notes: typeof seedNotes;
  annotations: Annotation[];
  studyDays: StudyDay[];
  agentSteps: AgentStep[];
  logs: PlanLog[];
  chatSessions: ChatSession[];
  activeSessionId: string;
  review: Review;
  structuredReviews: StructuredReview[];
}

export function useWorkspaceHandlers(deps: HandlerDeps) {
  const {
    ALL_GROUPS, UNCATEGORIZED, activeCardCategory, setActiveCardCategory, activeCardSubject, setActiveCardSubject, activeGroupCard, activeKnowledgePanel, setActiveKnowledgePanel, activeKnowledgeSubject, setActiveKnowledgeSubject, activeResource, activeSessionIdRef, activeTaskId, setActiveTaskId, activeView, setActiveView, cardFlipped, setCardFlipped, cardSubView, setCardSubView, cardSubjectView, setCardSubjectView, cards, setCards, categories, setCategories, categoryReviewQueue, chatInput, setChatInput, completionModalAllowEditTime, setCompletionModalAllowEditTime, completionModalCustomMinutes, setCompletionModalCustomMinutes, currentSubject, elapsedSeconds, setElapsedSeconds, exam, setExam, examAnalyzing, setExamAnalyzing, lastDeleted, setLastDeleted, materialAnalysisRunRef, materialAnalysisTimeoutsRef, materialSections, setMaterialSections, newCardDeckName, setNewCardDeckName, nodes, setNodes, questions, setQuestions, resources, setResources, resourcesRef, setActiveDialog, setActiveResourceId, setActiveSessionId, setActiveTimerTaskId, setAgentSteps, setAnnotations, setCardDialogCategory, setCardDialogSubject, setCardIndex, setChatHistoryOpen, setChatSessions, setCloseConfirmPending, setCompletionModalCustomEndTime, setEditingCardId, setFileUploadState, setLearningEvents, setLogs, setMaterials, setNewCardDeckOpen, setNotes, setNotice, setOnboardingCompleted, setPending, setQuestionFilter, setReaderPage, setStructuredReviews, setStudyDays, setStudyDraft, setSubjects, setTasks, setTimerAccumSeconds, setTimerRunStartEpoch, setTimerStartTime, studyDraft, subjectCategories, subjects, tasks, timerAccumSeconds, timerIntervalRef, timerRunStartEpoch, uploadProgressRunRef, uploadProgressTimeoutsRef, appSettings, materials, pending, notes, annotations, studyDays, agentSteps, logs, chatSessions, activeSessionId, review, structuredReviews,
  
  } = deps;

  // ─── UX Sprint P0: ChatSession 管理（2026-08-04 审查拆分到独立 hook）───
  const { ensureChatSession, newChatSession, pushAssistant, pushSystem } = useChatSession({
    activeSessionIdRef,
    setChatSessions,
    setActiveSessionId,
    setChatHistoryOpen,
    setNotice,
  });

  // 撤销最近一次删除（此前 setLastDeleted 记录了备份，但没有入口消费它）
  function restoreLastDeleted() {
    if (!lastDeleted) return;
    const backup = lastDeleted;
    switch (backup.collection) {
      case "resources": setResources((items) => [backup.item, ...items]); break;
      case "questions": setQuestions((items) => [backup.item, ...items]); break;
      case "nodes": setNodes((items) => [backup.item, ...items]); break;
      case "cards": setCards((items) => [backup.item, ...items]); break;
      case "subjects": setSubjects((items) => [...items, backup.item]); break;
    }
    setLastDeleted(null);
    setNotice(`已恢复：${backup.label}`);
  }

  // ─── 数据导出（PRD 3.5 JSON 备份，含 exportedAt/appName 元数据；与自动保存清单独立）───
  function handleExportData() {
    try {
      const snapshot = {
        exportedAt: new Date().toISOString(),
        appName: "筑巢考研工作台",
        storageVersion: STORAGE_VERSION,
        exam, appSettings, subjects, activeKnowledgeSubject, activeCardSubject,
        resources, materials, materialSections, questions, nodes, tasks, pending, notes, cards,
        annotations, studyDays, agentSteps, logs, chatSessions, activeSessionId, review, structuredReviews,
        cardCategories: categories,
      };
      const json = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kaoyan-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setNotice("已导出完整数据备份 (JSON)");
    } catch (error) {
      console.error("[Export] 导出失败", error);
      setNotice("导出失败，请重试");
    }
  }

  // ─── 数据导入（PRD 3.5 JSON 恢复）：写入 localStorage 后刷新，由 mount hydrate 统一恢复 ───
  async function handleImportData(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Record<string, unknown>;
      if (!data || typeof data !== "object" || !Array.isArray(data.subjects)) {
        setNotice("导入失败：不是有效的备份文件（缺少 subjects 字段）");
        return;
      }
      const written = saveWorkspace({
        ...data,
        onboardingCompleted: data.onboardingCompleted === false ? false : true,
      });
      if (!written) {
        setNotice("导入失败：无法写入本地存储（可能磁盘版本更高或配额已满）");
        return;
      }
      // 2026-08-17 修复：导入后同步内存 state——否则 reload 前 beforeunload flush 会用旧 state（seed）覆盖刚导入的数据
      if (data.exam && typeof data.exam === "object") setExam(normalizeExamGoal(data.exam as ExamGoal));
      if (Array.isArray(data.subjects)) setSubjects(data.subjects as Subject[]);
      if (Array.isArray(data.resources)) setResources(data.resources as Resource[]);
      if (Array.isArray(data.materials)) setMaterials(data.materials as Material[]);
      if (Array.isArray(data.materialSections)) setMaterialSections(data.materialSections as MaterialSection[]);
      if (Array.isArray(data.questions)) setQuestions(data.questions as Question[]);
      if (Array.isArray(data.nodes)) setNodes(data.nodes as KnowledgeNode[]);
      if (Array.isArray(data.tasks)) setTasks(data.tasks as Task[]);
      if (Array.isArray(data.notes)) setNotes(data.notes as Note[]);
      if (Array.isArray(data.cards)) setCards(data.cards as GrowthCard[]);
      if (Array.isArray(data.annotations)) setAnnotations(data.annotations as Annotation[]);
      if (Array.isArray(data.cardCategories)) setCategories(data.cardCategories as CardCategory[]);
      setNotice("导入成功，正在刷新恢复数据…");
      setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      console.error("[Import] 导入失败", error);
      setNotice("导入失败：文件不是有效的 JSON 备份");
    }
  }

  // ─── Onboarding：完成向导 → 用用户数据整体替换演示种子（清空示例残留内容）───
  function completeOnboarding(result: OnboardingResult) {
    setExam(normalizeExamGoal(result.exam));
    setSubjects(result.subjects);
    setResources(result.resources);
    setNodes(result.nodes);
    setTasks(result.tasks);
    // 内置真题库：用户选择的科目包含「政治」时开箱即见全部政治真题（2023/2024/2025），
    // 包含「英语」时开箱即见全部英语一真题（2010-2025），包含「数学」时开箱即见数学二真题。
    // 2026-08-14 修复：注入条件补上「数学二」科目（此前仅政治/英语一）。
    const subjectNames = result.subjects.map((subject) => subject.name);
    const hasPolitics = subjectNames.some((name) => name.includes("政治"));
    const hasEnglish = subjectNames.some((name) => name.includes("英语"));
    const hasMath = subjectNames.some((name) => name.includes("数学"));
    let builtinResources = result.resources;
    let builtinQuestions: Question[] = [];
    let builtinMaterials = materials;
    let builtinSections = materialSections;
    const seedPapers = seedResources.filter((resource) =>
      resource.type === "真题"
      && ((hasPolitics && resource.subject === "政治") || (hasEnglish && resource.subject === "英语一") || (hasMath && resource.subject === "数学二"))
      && !result.resources.some((item) => item.id === resource.id)
    );
    if (seedPapers.length > 0) {
      builtinResources = [...seedPapers, ...result.resources];
      builtinQuestions = seedQuestions.filter((question) =>
        !questions.some((existing) => existing.id === question.id)
        && !builtinResources.some((existing) => existing.id === question.materialId)
      );
      seedPapers.forEach((paper) => {
        const subjectId = result.subjects.find((subject) => subject.name === paper.subject)?.id
          ?? (paper.subject === "政治" ? "s-politics" : paper.subject === "数学二" ? "s-math2" : "s-english");
        const paperMaterial = resourceToMaterial(paper, subjectId);
        builtinMaterials = [paperMaterial, ...builtinMaterials.filter((material) => material.id !== paper.id)];
        const paperSections = resourceToMaterialSections(paper, seedQuestions).filter((section) =>
          !materialSections.some((existing) => existing.id === section.id)
        );
        builtinSections = [...paperSections, ...builtinSections];
      });
    }
    setResources(builtinResources);
    setMaterials(builtinMaterials);
    setMaterialSections(builtinSections);
    // 其余学习内容清空，避免残留示例项目数据
    setQuestions(builtinQuestions);
    setCards([]);
    setAnnotations([]);
    setPending([]);
    setNotes([]);
    setStudyDays([]);
    setCategories([]);
    setStructuredReviews([]);
    // 激活科目指向新项目的首个科目
    const first = result.subjects[0]?.name ?? "";
    setActiveKnowledgeSubject(first);
    setActiveCardSubject(first);
    setActiveView("dashboard");
    setOnboardingCompleted(true);
    setNotice("已创建考研项目，开始你的学习吧。");
  }

  // ─── Knowledge Center handlers ───
  function selectKnowledgeSubject(subjectName: string) {
    setActiveKnowledgeSubject(subjectName);
    setQuestionFilter((prev) => ({ ...prev, subject: "全部" }));
  }

  function inferResource(rawName: string, subjectHint = "") {
    const text = rawName.toLowerCase();
    // AI 自动归档：不依赖用户手动选择科目；优先从文件名/内容关键词自动识别所属科目与类型
    const matchedSubject = subjects.find((subject) => rawName.includes(subject.name) || rawName.includes(subject.name.replace(/\s/g, "")));
    const subject = matchedSubject?.name
      || (rawName.includes("数学") || text.includes("math") ? "数学二"
        : rawName.includes("英语") || text.includes("english") ? "英语一"
        : rawName.includes("政治") || text.includes("politics") || text.includes("political") ? "政治"
        : subjectHint || "待AI识别");
    const isPastPaper = rawName.includes("真题") || /20\d{2}/.test(rawName);
    const hasSolution = rawName.includes("解析") || rawName.includes("答案") || text.includes("solution");
    const isTextbook = /教材|课本|全书|辅导书|复习资料/.test(rawName) || text.includes("literature");
    const isImage = /\.(png|jpe?g|webp|gif|bmp)$/i.test(rawName);
    const type = isPastPaper ? hasSolution ? "真题解析" : "真题" : isTextbook ? "教材" : rawName.includes("讲义") ? "课程讲义" : isImage ? "图片资料" : "学习资料";
    const name = rawName.replace(/\.(pdf|docx?|png|jpe?g)$/i, "");
    const pages = isPastPaper ? "整套真题：直接阅读" : "AI识别：待确认章节";
    const linkedNode = "待AI关联知识图谱";
    const recommendedLayer = isPastPaper ? "第 2-4 层" : "第 1-2 层";
    return { subject, type, name, pages, linkedNode, recommendedLayer, duplicate: resources.some((resource) => resource.fileName === rawName || resource.name === name) };
  }

  function openResource(resource: Resource) {
    setActiveResourceId(resource.id);
    setActiveKnowledgeSubject(resource.subject);
    setReaderPage(resource.currentPage || "1");
    // 2026-08-07 修复：真题套卷从「真题库」打开，返回时应回到真题库（questions），而非学习资料（resources）
    setActiveKnowledgePanel(resource.type.includes("真题") ? "questions" : "resources");
    setActiveView("knowledge");
    // Stabilization 1A-5: 记录最近打开页码（用于刷新后恢复阅读位置）
    setResources((items) => items.map((item) => item.id === resource.id
      ? { ...item, lastOpenedPage: resource.currentPage || "1", lastRead: "刚刚" }
      : item));
    setNotice(`已打开资料：${resource.name}`);
  }

  function resetUploadProgress() {
    uploadProgressRunRef.current += 1;
    uploadProgressTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    uploadProgressTimeoutsRef.current = [];
    setFileUploadState(null);
  }

  function openResourceDialog() {
    resetUploadProgress();
    setActiveDialog("resource");
  }

  function closeResourceDialog() {
    resetUploadProgress();
    setActiveDialog(null);
  }

  function startUploadProgress(file: File, inferred: ReturnType<typeof inferResource>) {
    resetUploadProgress();
    const runId = uploadProgressRunRef.current;
    setFileUploadState({ name: file.name, size: file.size, inferred, step: "uploading" });
    const stages = [
      ["extracting", 400],
      ["identifying", 900],
      ["parsing", 1500],
      ["mapping", 2100],
      ["done", 2600],
    ] as const;
    stages.forEach(([step, delay]) => {
      const timeoutId = setTimeout(() => {
        if (uploadProgressRunRef.current !== runId) return;
        setFileUploadState((prev) => (prev && prev.name === file.name ? { ...prev, step } : prev));
      }, delay);
      uploadProgressTimeoutsRef.current.push(timeoutId);
    });
  }

  function upsertMaterialFromResource(resource: Resource) {
    const { material, sections } = buildMaterialBundle(resource, subjects);
    setMaterials((items) => [material, ...items.filter((item) => item.id !== material.id)]);
    setMaterialSections((items) => [...sections, ...items.filter((item) => item.materialId !== resource.id)]);
    return { material, sections };
  }

  // 2026-08-03 产品明确：所有真题不拆题。真题以「整套 PDF 资料」为单位保存与展示，
  // 不再自动生成逐题占位记录；addPlaceholderQuestionsForPastPaper 已废弃（保留函数供未来手动录入用，仅不自动调用）。

  async function addResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fileValue = form.get("file");
    const file = fileValue instanceof File && fileValue.name ? fileValue : null;
    const isPdfFile = !!file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    const isDocx = !!file && isDocxFile(file);
    const isTextFile = !!file && isTextFileType(file);
    const isImage = !!file && isImageFileType(file);
    if (file && isLegacyDocFile(file)) {
      pushAssistant("当前不支持 Word 97-2003（.doc）格式。请先将文档另存为 .docx 或 PDF 再上传。");
      resetUploadProgress();
      return;
    }
    if (file && !isPdfFile && !isDocx && !isTextFile && !isImage) {
      pushAssistant("当前仅支持 PDF / DOCX / 文本（txt、md）/ 图片文件。");
      resetUploadProgress();
      return;
    }
    const fallbackName = `${activeKnowledgeSubject || "未分科"}${activeKnowledgePanel === "questions" ? "空白真题卷" : "空白资料"}-${dateOnly()}`;
    const rawName = String(file?.name || form.get("sourceText") || fallbackName).trim();
    const inferred = inferResource(rawName, String(form.get("subjectHint") ?? ""));
    const base: Resource = {
      id: makeId("r"),
      name: inferred.name,
      subject: inferred.subject,
      type: inferred.type,
      author: "AI识别",
      version: "AI识别",
      pages: inferred.pages,
      status: "已索引",
      fileName: file?.name ?? rawName,
      recommendedRound: "第一轮",
      recommendedLayer: inferred.recommendedLayer,
      currentPage: "",
      lastRead: "",
      readingMinutes: "",
      linkedNode: inferred.linkedNode,
      kind: "demo",
      createdAt: new Date().toISOString(),
    };
    // Stabilization 1A-1: 真实文件（PDF / DOCX / 文本 / 图片）→ IndexedDB（绝不写入 localStorage）
    if (file && (isPdfFile || isDocx || isTextFile || isImage)) {
      const label = isPdfFile ? "PDF" : isDocx ? "DOCX" : isTextFile ? "文本" : "图片";
      try {
        const stored = await savePdfFile(file);
        const resource: Resource = {
          ...base,
          kind: isPdfFile ? "pdf" : isDocx ? "docx" : isTextFile ? "text" : "image",
          fileStorageKey: stored.fileStorageKey,
          size: stored.size,
          mimeType: stored.mimeType,
        };
        if (isDocx) {
          resource.pages = `DOCX 文档 · ${(stored.size / 1024).toFixed(1)} KB`;
          const docText = await extractDocxText(file).catch(() => "");
          if (docText) await saveDocText(stored.fileStorageKey, docText);
        } else if (isTextFile) {
          resource.pages = `文本文件 · ${(stored.size / 1024).toFixed(1)} KB`;
          const docText = await extractTextFileContent(file).catch(() => "");
          if (docText) await saveDocText(stored.fileStorageKey, docText);
        } else if (isImage) {
          resource.pages = `图片资料 · ${(stored.size / 1024).toFixed(1)} KB`;
        } else {
          resource.pages = `PDF 文件 · ${(stored.size / 1024).toFixed(1)} KB`;
        }
        // 上传即自动生效：不再进入「待确认」队列，直接可供阅读
        setResources((items) => [resource, ...items]);
        void upsertMaterialFromResource(resource);
        // 2026-08-03 产品修复：上传即自动 AI 识别，不需要学习者手动点「AI 分析」
        void autoAnalyzeMaterial(resource);
        pushAssistant(`${label} 已保存并可阅读，AI 正在自动识别：${resource.name}。`);
      } catch (err) {
        pushAssistant(`${label} 保存失败：${String(err)}`);
        closeResourceDialog();
        return;
      }
    } else {
      // 演示/非 PDF 资源：上传即自动生效，不再进入「待确认」队列
      setResources((items) => [base, ...items]);
      void upsertMaterialFromResource(base);
      // 2026-08-03 产品修复：上传即自动 AI 识别
      void autoAnalyzeMaterial(base);
      pushAssistant(`已添加演示/空白资料：${base.name}，AI 正在自动识别。`);
    }
    setActiveKnowledgeSubject(inferred.subject);
    closeResourceDialog();
  }

  // ─── 批量上传（2026-08-03 用户反馈：拖拽文件夹/多文件批量导入 PDF；2026-08-16 扩展为 PDF / DOCX / TXT / MD / 图片）───
  // 单个文件保存入库（与 addResource 中真实文件分支同款逻辑，抽成公共函数供单/批量共用）
  // subjectHint：批量时传入当前所在科目，避免文件名不含科目关键词时 fallback 到 subjects[0]（例如英语）导致跳科
  async function addFileToLibrary(file: File, subjectHint: string): Promise<boolean> {
    const isDocx = isDocxFile(file);
    const isTextFile = isTextFileType(file);
    const isImage = isImageFileType(file);
    const label = isDocx ? "DOCX" : isTextFile ? "文本" : isImage ? "图片" : "PDF";
    try {
      const stored = await savePdfFile(file);
      if (isDocx) {
        const docText = await extractDocxText(file).catch(() => "");
        if (docText) await saveDocText(stored.fileStorageKey, docText);
      } else if (isTextFile) {
        const docText = await extractTextFileContent(file).catch(() => "");
        if (docText) await saveDocText(stored.fileStorageKey, docText);
      }
      const rawName = file.name;
      const inferred = inferResource(rawName, subjectHint);
      const base: Resource = {
        id: makeId("r"),
        name: inferred.name,
        subject: inferred.subject,
        type: inferred.type,
        author: "AI识别",
        version: "AI识别",
        pages: inferred.pages,
        status: "已索引",
        fileName: rawName,
        recommendedRound: "第一轮",
        recommendedLayer: inferred.recommendedLayer,
        currentPage: "",
        lastRead: "",
        readingMinutes: "",
        linkedNode: inferred.linkedNode,
        createdAt: new Date().toISOString(),
        kind: isDocx ? "docx" : isTextFile ? "text" : isImage ? "image" : "pdf",
        fileStorageKey: stored.fileStorageKey,
        size: stored.size,
        mimeType: stored.mimeType,
      };
      base.pages = isDocx
        ? `DOCX 文档 · ${(stored.size / 1024).toFixed(1)} KB`
        : isTextFile
          ? `文本文件 · ${(stored.size / 1024).toFixed(1)} KB`
          : isImage
            ? `图片资料 · ${(stored.size / 1024).toFixed(1)} KB`
            : `PDF 文件 · ${(stored.size / 1024).toFixed(1)} KB`;
      // 上传即自动生效：不进入「待确认」队列，直接可供阅读
      setResources((items) => [base, ...items]);
      void upsertMaterialFromResource(base);
      // 2026-08-03 产品修复：上传即自动 AI 识别（批量每个文件独立自动识别，无互斥）
      void autoAnalyzeMaterial(base);
      // 注意：批量场景不在此切换 activeKnowledgeSubject——
      // 否则一批文件里最后一个的推断科目会覆盖用户当前所在科目（如专业课文件被判为英语 → 页面跳到英语）。
      return true;
    } catch (err) {
      pushAssistant(`${label} 保存失败：${file.name}（${String(err)}）`);
      return false;
    }
  }

  /** 批量上传：只接受 PDF / DOCX，逐个保存入库；同时用 fileUploadState 显示当前进度。
   *  subjectHint 传当前所在科目，保证文件名不含科目关键词的文件归属到用户当前科目，不跳科。
   *  2026-08-16 改进：.doc（Word 97-2003）虽不支持，但不再静默丢弃——汇总列出并提示转换。 */
  async function startBatchUpload(files: File[], subjectHint = "") {
    const list = Array.isArray(files) ? files : [];
    const docs = list.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf") || isDocxFile(f) || isTextFileType(f) || isImageFileType(f)
    );
    const skippedDocs = list.filter((f) => !docs.includes(f) && isLegacyDocFile(f));
    const otherSkipped = list.filter((f) => !docs.includes(f) && !isLegacyDocFile(f));
    if (docs.length === 0) {
      if (skippedDocs.length > 0) {
        pushAssistant(
          `不支持 Word 97-2003（.doc）格式：${skippedDocs.slice(0, 3).map((f) => f.name).join("、")}` +
          `${skippedDocs.length > 3 ? ` 等 ${skippedDocs.length} 个文件` : ""}。请先用 Word/WPS 另存为 .docx 或 PDF 再导入。`
        );
      } else {
        pushAssistant("拖入的文件中没有支持的格式。当前支持 PDF / DOCX / TXT / MD / 图片文件。");
      }
      return;
    }
    resetUploadProgress();
    let okCount = 0;
    for (const file of docs) {
      const inferred = inferResource(file.name, subjectHint);
      setFileUploadState({ name: file.name, size: file.size, inferred, step: "uploading" });
      const saved = await addFileToLibrary(file, subjectHint);
      if (saved) okCount += 1;
    }
    // 2026-08-07 修复：批量完成后清空 fileUploadState，
    // 避免用户误把「批量上传完成」卡片当作真实文件再次点击「确认保存」产生空白资料。
    setFileUploadState(null);
    // 批量完成后保持用户所在科目（不因最后一个文件的推断科目而跳科）。
    if (subjectHint) setActiveKnowledgeSubject(subjectHint);
    let message = `批量上传完成：成功 ${okCount}/${docs.length} 个文件（PDF / DOCX / TXT / MD / 图片）已加入资料库。`;
    if (skippedDocs.length > 0) {
      message += ` 另有 ${skippedDocs.length} 个 .doc 文件未导入：${skippedDocs.slice(0, 2).map((f) => f.name).join("、")}${skippedDocs.length > 2 ? " 等" : ""}（Word 97-2003 不支持，请另存为 .docx 或 PDF）。`;
    }
    if (otherSkipped.length > 0) {
      message += ` 另有 ${otherSkipped.length} 个不支持格式的文件未导入：${otherSkipped.slice(0, 2).map((f) => f.name).join("、")}${otherSkipped.length > 2 ? " 等" : ""}。`;
    }
    pushAssistant(message);
  }

  // ─── B-1: 待确认队列操作（确认 / 忽略）───
  // 确认后按 kind 应用结果并移出队列；忽略则直接移出队列
  function confirmPendingItem(item: PendingItem) {
    setPending((items) => items.filter((p) => p.id !== item.id));
    if (item.kind === "真题识别" && item.targetId) {
      setQuestions((qitems) => qitems.map((q) => q.id === item.targetId ? { ...q, confirmed: true } : q));
      setNotice(`已确认：${item.title}`);
    } else if (item.kind === "资料切分" && item.targetId) {
      setResources((ritems) => ritems.map((r) => r.id === item.targetId ? { ...r, status: "已索引" } : r));
      setNotice(`已确认：${item.title}`);
    } else {
      setNotice(`已确认：${item.title}`);
    }
  }

  function dismissPendingItem(item: PendingItem) {
    setPending((items) => items.filter((p) => p.id !== item.id));
    setNotice(`已忽略：${item.title}`);
  }

  function deleteResource(item: Resource) {
    setLastDeleted({ collection: "resources", item, label: item.name });
    setResources((items) => items.filter((resource) => resource.id !== item.id));
    setMaterials((items) => items.filter((material) => material.id !== item.id));
    setMaterialSections((items) => items.filter((section) => section.materialId !== item.id));
    setQuestions((items) => items.filter((question) => question.materialId !== item.id));
    // Stabilization 1A-6: 同步清理 IndexedDB 中的文件二进制（pdf / docx / text / image 都存了 Blob）
    if (item.fileStorageKey && item.kind && item.kind !== "demo") {
      deletePdfFile(item.fileStorageKey).catch(() => {});
    }
    // 清理关联批注
    setAnnotations((items) => items.filter((annotation) => annotation.resourceId !== item.id));
    setNotice(`已删除资源：${item.name}`);
  }

  // ─── Stabilization 1A-3/1A-4: 批注创建 / 编辑 / 删除（持久化经 save effect）───
  function onCreateAnnotation(page: string, selection: string, tag: Annotation["tag"], note: string) {
    if (!activeResource) return;
    const annotation: Annotation = {
      id: makeId("a"),
      resourceId: activeResource.id,
      resourceName: activeResource.name,
      page,
      selection,
      tag,
      note,
      linkedNode: activeResource.linkedNode || "待关联",
      createdAt: today(),
      handled: false,
      updatedAt: today(),
    };
    setAnnotations((items) => [annotation, ...items]);
    setNotice(`已添加批注：${selection.slice(0, 20)}`);
  }

  function onEditAnnotation(id: string, note: string) {
    setAnnotations((items) => items.map((item) => item.id === id ? { ...item, note, updatedAt: today() } : item));
  }

  function onDeleteAnnotation(id: string) {
    setAnnotations((items) => items.filter((item) => item.id !== id));
    setNotice("已删除批注");
  }

  function deleteQuestion(item: Question) {
    setLastDeleted({ collection: "questions", item, label: `${item.year} 第 ${item.number} 题` });
    setQuestions((items) => items.filter((question) => question.id !== item.id));
    setNotice(`已删除真题：${item.year} 第 ${item.number} 题`);
  }

  function deleteNode(item: KnowledgeNode) {
    setLastDeleted({ collection: "nodes", item, label: item.knowledge });
    setNodes((items) => items.filter((node) => node.id !== item.id));
    setNotice(`已删除知识点：${item.knowledge}`);
  }

  // ─── 卡片组管理：创建 / 重命名（内联）/ 删除（确认框）───
  function addCategoryInline() {
    const name = newCardDeckName.trim().slice(0, 30);
    if (!name) { setNotice("名称不能为空"); return; }
    if (subjectCategories.some((c) => c.name === name)) { setNotice("卡片组名称已存在"); return; }
    const subject = subjects.find((s) => s.name === activeCardSubject);
    if (!subject) return;
    const now = today();
    setCategories((items) => [...items, { id: makeId("cat"), subjectId: subject.id, name, createdAt: now, updatedAt: now }]);
    setNewCardDeckOpen(false);
    setNewCardDeckName("");
    setNotice(`已新建卡片组：${name}`);
  }

  // 卡片移动到当前学科内的其他分类（不能跨学科移动）
  function moveCardToCategory(cardId: string, categoryId: string) {
    setCards((items) => items.map((c) => c.id === cardId
      ? { ...c, categoryId: categoryId || undefined }
      : c));
  }
  function reviewCard(id: string, mastery: GrowthCard["mastery"]) {
    const card = cards.find((c) => c.id === id);
    const intervalDays = mastery === "不会" ? 1 : mastery === "模糊" ? 3 : mastery === "认识" ? 7 : mastery === "熟练" ? 14 : 30;
    setCards((items) => items.map((card) => card.id === id ? { ...card, mastery, lastReviewed: today(), nextReviewAt: dateOnly(intervalDays) } : card));
    const interval = mastery === "不会" ? "明天" : mastery === "模糊" ? "3 天后" : mastery === "认识" ? "7 天后" : mastery === "熟练" ? "14 天后" : "30 天后";
    // 2026-08-05 用户反馈：自动提示要说明是哪张卡片，且可点击「查看详情」跳转卡片页
    const cardTitle = card?.title || "该卡片";
    const cardSubject = card?.subject || activeCardSubject;
    pushAssistant(`已记录卡片「${cardTitle}」掌握状态：${mastery}。下次建议复习：${interval}。可在沉淀卡片（${cardSubject}）中查看详情。`);
    // LearningEvent: card_reviewed（Sprint 1 / Phase A，纯副作用采集）
    setLearningEvents((prev) => appendLearningEvent(prev, {
      type: "card_reviewed",
      sourceRef: {
        kind: "card",
        id,
        subjectId: card?.subject,
        nodeIds: nodes.filter((n) => n.knowledge === card?.knowledge || n.core === card?.core).map((n) => n.id),
      },
      payload: { mastery, intervalDays },
    }));
    setCardFlipped(false);
    // 卡片组内复习队列推进（卡片组 → 卡片 的信息层级）
    setCardIndex((index) => Math.min(index + 1, Math.max(categoryReviewQueue.length - 1, 0)));
  }
  function moveCard(step: number) {
    setCardFlipped(false);
    // 卡片组内复习队列推进（卡片组 → 卡片 的信息层级）
    setCardIndex((index) => Math.min(Math.max(index + step, 0), Math.max(categoryReviewQueue.length - 1, 0)));
  }

  // 键盘快捷键 (仅当在卡片组学习空间「待复习」视图时生效)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // P0 修复（交互审查 2026-08-01）：输入框/文本域聚焦时忽略快捷键，避免打字误触翻面/评分
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName ?? "";
      if (tagName === "INPUT" || tagName === "TEXTAREA" || target?.isContentEditable) return;

      if (activeView !== "cards" || !cardSubjectView || !activeCardCategory || cardSubView !== "待复习" || !activeGroupCard) return;
      if (e.key === " " || e.key === "Space") { e.preventDefault(); setCardFlipped((v) => !v); }
      else if (e.key === "ArrowLeft") moveCard(-1);
      else if (e.key === "ArrowRight") moveCard(1);
      else if (e.key === "1") reviewCard(activeGroupCard.id, "认识");
      else if (e.key === "2") reviewCard(activeGroupCard.id, "模糊");
      else if (e.key === "3") reviewCard(activeGroupCard.id, "不会");
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // moveCard/reviewCard 每次渲染重建但语义稳定；此处依赖已覆盖会影响行为的状态
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, cardSubjectView, activeCardCategory, cardSubView, activeGroupCard, categoryReviewQueue, cardFlipped]);

  // ─── Growth Cards handlers ───
  function safeCardCategoryForSubject(categoryId: string | undefined, subjectName: string) {
    if (!categoryId) return "";
    const subject = subjects.find((item) => item.name === subjectName);
    return subject && categories.some((cat) => cat.id === categoryId && cat.subjectId === subject.id) ? categoryId : "";
  }

  function openNewCardDialog() {
    const subject = activeCardSubject || currentSubject?.name || subjects[0]?.name || "";
    const candidateCategory = activeCardCategory && activeCardCategory !== ALL_GROUPS && activeCardCategory !== UNCATEGORIZED ? activeCardCategory : "";
    setEditingCardId(null);
    setCardDialogSubject(subject);
    setCardDialogCategory(safeCardCategoryForSubject(candidateCategory, subject));
    setActiveDialog("card");
  }

  function openEditCardDialog(card: GrowthCard) {
    const subject = card.subject || activeCardSubject || subjects[0]?.name || "";
    setEditingCardId(card.id);
    setCardDialogSubject(subject);
    setCardDialogCategory(safeCardCategoryForSubject(card.categoryId, subject));
    setActiveDialog("card");
  }

  function createCardFromText(createdBy: GrowthCard["createdBy"], text: string, annotation?: Annotation) {
    const card: GrowthCard = {
      id: makeId("c"),
      title: annotation ? `${annotation.selection}：${annotation.tag}` : "AI 生成沉淀卡片",
      front: annotation?.selection ?? "请回忆这条内容的核心结论。",
      back: annotation ? `${annotation.selection}\n${annotation.note}` : text,
      type: text.includes("填空") ? "填空卡" : text.includes("推导") ? "推导卡" : text.includes("条件") ? "条件辨析卡" : "公式卡",
      subject: currentSubject?.name ?? "未分科",
      core: nodes[0]?.core ?? "待关联",
      branch: nodes[0]?.branch ?? "待关联",
      knowledge: nodes[0]?.knowledge ?? "待关联",
      source: annotation?.resourceName ?? activeResource?.name ?? "AI 对话",
      page: annotation?.page ?? activeResource?.currentPage ?? "",
      modes: ["背诵", text.includes("填空") ? "填空" : "条件辨析"],
      createdBy,
      createdAt: today(),
      lastReviewed: "未复习",
      nextReviewAt: dateOnly(),
      mastery: "模糊",
      note: annotation?.note ?? "",
      favorite: false,
    };
    setCards((items) => [card, ...items]);
    setActiveCardSubject(card.subject);
    if (annotation) setAnnotations((items) => items.map((item) => item.id === annotation.id ? { ...item, handled: true } : item));
    pushAssistant(`已创建沉淀卡片：${card.title}`);
  }

  function deleteCard(item: GrowthCard) {
    setLastDeleted({ collection: "cards", item, label: item.title });
    setCards((items) => items.filter((card) => card.id !== item.id));
    setNotice(`已删除卡片：${item.title}`);
  }

  function openCardSource(card: GrowthCard) {
    const relatedResource = resources.find((r) => r.name.includes(card.source) || card.source.includes(r.name));
    if (relatedResource) {
      setActiveResourceId(relatedResource.id);
      setActiveKnowledgeSubject(relatedResource.subject);
      setReaderPage(card.page || relatedResource.currentPage || "1");
      setActiveKnowledgePanel("resources");
      setActiveView("knowledge");
      setNotice(`已打开来源：${card.source}`);
    } else {
      pushAssistant(`未找到卡片来源资源：${card.source}`);
    }
  }

  function showRelatedQuestions(core: string, keyword = "", subject = activeCardSubject || currentSubject?.name || activeKnowledgeSubject || "") {
    // UX Sprint（学科隔离）: 相关真题严格锁定当前科目，不允许跨学科展示
    const targetSubject = subject || activeKnowledgeSubject || "";
    // 2026-08-05 用户反馈：没有相关真题时不切换页面，仅提示
    const matched = questions.some((q) => {
      const bySubject = q.subject === targetSubject;
      const byCore = core === "全部" || q.core === core || q.knowledge === keyword || (keyword && q.knowledge.includes(keyword));
      return bySubject && byCore;
    });
    if (!matched) {
      pushAssistant(`「${core || keyword || "该卡片"}」暂无相关真题，可在真题库导入后查看。`);
      return;
    }
    setQuestionFilter({ subject: targetSubject, core, result: "全部", keyword });
    setActiveKnowledgeSubject(targetSubject);
    setActiveKnowledgePanel("questions");
    setActiveView("knowledge");
  }

  // ─── Dashboard handlers ───
  function updateTask(id: string, patch: Partial<Task>) {
    setTasks((items) => items.map((task) => task.id === id ? { ...task, ...patch } : task));
  }

  // 每个任务对某一天的学习记录只计一次，避免反复勾选/多入口重复累加（#8）
  function recordTaskDone(task: Task, minutes: number) {
    const date = dateOnly();
    if (task.countedForDate === date) return;
    recordStudyDay(minutes, 1);
    updateTask(task.id, { countedForDate: date });
  }

  function recordTaskUndone(task: Task) {
    if (!task.countedForDate) return;
    const minutes = Number(task.actualMinutes || task.minutes || 0);
    recordStudyDay(-minutes, -1); // 反向抵扣当天的计入
    updateTask(task.id, { countedForDate: "" });
  }

  function toggleTaskDone(task: Task) {
    const nextDone = !task.done;
    updateTask(task.id, { done: nextDone });
    if (nextDone) recordTaskDone(task, task.actualMinutes !== "" ? Number(task.actualMinutes) : (task.minutes || 0));
    else recordTaskUndone(task);
  }

  function moveTask(id: string, direction: -1 | 1) {
    const index = tasks.findIndex((task) => task.id === id);
    const target = index + direction;
    if (index < 0) return;
    if (target < 0 || target >= tasks.length) {
      setNotice(direction < 0 ? "已经是最高优先级" : "已经是最低优先级");
      return;
    }
    setTasks((items) => {
      const currentIndex = items.findIndex((task) => task.id === id);
      const currentTarget = currentIndex + direction;
      if (currentIndex < 0 || currentTarget < 0 || currentTarget >= items.length) return items;
      const next = [...items];
      [next[currentIndex], next[currentTarget]] = [next[currentTarget], next[currentIndex]];
      return next;
    });
    setNotice(direction < 0 ? "已提高优先级" : "已降低优先级");
  }

  function stopTimer() {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = undefined;
    }
  }

  // 以给定起点（墙钟 ms）开始/恢复一个运行段；interval 仅按时间戳重算显示值，
  // 因此后台节流也不会少算，刷新后用持久化的起点即可无缝续计。
  function runTimerFrom(accumSeconds: number, startEpoch: number) {
    setTimerAccumSeconds(accumSeconds);
    setTimerRunStartEpoch(startEpoch);
    const compute = () => accumSeconds + Math.max(0, Math.floor((Date.now() - startEpoch) / 1000));
    setElapsedSeconds(compute());
    stopTimer();
    timerIntervalRef.current = setInterval(() => setElapsedSeconds(compute()), 1000);
  }

  // 当前真实已学秒数（不依赖 interval 的最后一次 tick）
  function currentElapsedSeconds() {
    return timerRunStartEpoch > 0
      ? timerAccumSeconds + Math.max(0, Math.floor((Date.now() - timerRunStartEpoch) / 1000))
      : timerAccumSeconds;
  }

  function startTask(task: Task) {
    const now = new Date();
    const startTimeStr = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    setTimerStartTime(startTimeStr);
    setActiveTimerTaskId(task.id);
    setCompletionModalAllowEditTime(false);
    setCompletionModalCustomMinutes("");
    updateTask(task.id, { status: "学习中", startedAt: startTimeStr });
    runTimerFrom(0, Date.now());
    // UX Sprint: 用户主动开始新学习段 → 清除该任务的历史草稿（明确的新会话意图）
    setStudyDraft((prev) => (prev && prev.taskId === task.id ? null : prev));
    setNotice(`开始学习：${task.title}`);
  }

  function pauseTimer(task: Task) {
    stopTimer();
    const total = currentElapsedSeconds();
    setTimerAccumSeconds(total);
    setTimerRunStartEpoch(0);
    setElapsedSeconds(total);
    updateTask(task.id, { status: "暂停" });
  }

  function resumeTimer(task: Task) {
    updateTask(task.id, { status: "学习中" });
    runTimerFrom(timerAccumSeconds, Date.now());
  }

  function handleEndLearning(task: Task) {
    stopTimer();
    const totalSeconds = currentElapsedSeconds();
    setElapsedSeconds(totalSeconds);
    setTimerRunStartEpoch(0);
    const elapsedMin = Math.max(TASK.minElapsedMinutes, Math.round(totalSeconds / 60));
    setCompletionModalCustomMinutes(String(elapsedMin));
    setCompletionModalAllowEditTime(false);
    setCompletionModalCustomEndTime(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }));
    setActiveTaskId(task.id);
    setActiveDialog("task");
    setActiveTimerTaskId("");
    // UX Sprint: 结束学习 → 自动保存草稿（计时/掌握程度/学习状态/正确率/困难原因；关闭不丢失）
    setStudyDraft({
      taskId: task.id,
      elapsedSeconds: totalSeconds,
      customMinutes: String(elapsedMin),
      mastery: task.mastery,
      accuracy: task.accuracy,
      mood: task.mood,
      note: task.note,
      dirty: false,
    });
  }

  // ─── UX Sprint: 学习结束弹窗统一入口（恢复草稿 / 初始化）───
  function openTaskDialog(task: Task) {
    const draft = studyDraft && studyDraft.taskId === task.id ? studyDraft : null;
    setActiveTaskId(task.id);
    setActiveDialog("task");
    if (draft) {
      // 恢复草稿：计时与全部表单值；计时从已累计秒数续接（不丢失）
      setElapsedSeconds(draft.elapsedSeconds);
      setTimerAccumSeconds(draft.elapsedSeconds);
      setTimerRunStartEpoch(0);
      setCompletionModalCustomMinutes(draft.customMinutes);
      setCompletionModalAllowEditTime(false);
      updateTask(task.id, {
        mastery: draft.mastery,
        accuracy: draft.accuracy,
        mood: draft.mood,
        note: draft.note,
      });
      setNotice(`已恢复未完成的学习记录：${task.title}`);
    } else {
      setElapsedSeconds(0);
      setTimerAccumSeconds(0);
      setTimerRunStartEpoch(0);
      setCompletionModalCustomMinutes(String(Math.max(TASK.minElapsedMinutes, Number(task.actualMinutes || 0) || 0)));
      setCompletionModalAllowEditTime(false);
    }
    setCompletionModalCustomEndTime(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }));
  }

  // UX Sprint: 表单任意字段修改 → 标记草稿 dirty（关闭时触发确认；草稿本身已持久化）
  function markTaskDraftDirty(task: Task, patch: Partial<Pick<StudyDraft, "mastery" | "accuracy" | "mood" | "note" | "customMinutes" | "elapsedSeconds">>) {
    setStudyDraft((prev) => {
      const base = prev && prev.taskId === task.id
        ? prev
        : {
            taskId: task.id,
            elapsedSeconds: currentElapsedSeconds(),
            customMinutes: completionModalCustomMinutes,
            mastery: task.mastery,
            accuracy: task.accuracy,
            mood: task.mood,
            note: task.note,
          };
      return { ...base, ...patch, dirty: true };
    });
  }

  // UX Sprint: 关闭学习结束弹窗 → 存在未保存内容时先弹确认，否则直接关闭
  function requestCloseTaskDialog() {
    if (studyDraft && studyDraft.taskId === activeTaskId && studyDraft.dirty) {
      setCloseConfirmPending(true);
    } else {
      setActiveDialog(null);
    }
  }

  function completeTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    // P1 交互修复（深入审查 2026-08-01）：自定义分钟 / 正确率做输入校验，拒绝空值、非数字、负数、超界
    // 避免 NaN / 负时长污染 studyDays 与掌握度事件
    let actualMinutesValue = completionModalAllowEditTime ? completionModalCustomMinutes : (task.actualMinutes || String(Math.max(1, Math.round(elapsedSeconds / 60))));
    const parsedMinutes = Number(actualMinutesValue);
    if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
      setNotice("实际分钟数无效，已保留自动计算值");
      actualMinutesValue = String(Math.max(1, Math.round(elapsedSeconds / 60)));
    } else {
      actualMinutesValue = String(Math.round(parsedMinutes));
    }
    let accuracyNumber = Number(task.accuracy || 0);
    if (!Number.isFinite(accuracyNumber) || accuracyNumber < 0) accuracyNumber = 0;
    if (accuracyNumber > 100) accuracyNumber = 100;
    // UX Sprint: 保存并完成才真正生成学习记录 → 清空该任务草稿
    setStudyDraft((prev) => (prev && prev.taskId === id ? null : prev));
    const endTimeStr = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    updateTask(id, {
      done: true,
      status: "已完成",
      actualMinutes: actualMinutesValue,
      accuracy: String(accuracyNumber),
      completedAt: endTimeStr,
    });
    recordTaskDone(task, Number(actualMinutesValue || task.minutes || 0));
    // LearningEvent: study_completed（Sprint 1 / Phase A，纯副作用采集）
    setLearningEvents((prev) => appendLearningEvent(prev, {
      type: "study_completed",
      sourceRef: {
        kind: "task",
        id: task.id,
        subjectId: task.subject,
        nodeIds: nodes.filter((n) => n.knowledge === task.branch || n.core === task.core).map((n) => n.id),
      },
      payload: {
        minutes: Number(actualMinutesValue || task.minutes || 0),
        accuracy: accuracyNumber || undefined,
        masteryBefore: task.masteryBefore ?? undefined,
        masteryAfter: task.masteryAfter ?? undefined,
      },
    }));
    if (accuracyNumber && accuracyNumber < 60) {
      setNodes((items) => items.map((node) =>
        node.knowledge === task.branch || node.core === task.core
          ? { ...node, masteryScore: Math.max(0, node.masteryScore - 8), masteryLevel: Math.max(0, node.masteryLevel - 1), mistakes: node.mistakes + 1, reviewRisk: "高风险" }
          : node
      ));
    }
  }

  function generatePlan(input = "手动重新安排今天") {
    const highRiskNode = nodes.find((node) => node.reviewRisk === "高风险") ?? nodes[0];
    if (!highRiskNode) {
      setNotice("暂无知识点数据，请先在知识中心上传资料并让 AI 分析后生成计划");
      return;
    }
    const nextTasks: Task[] = [{
      id: makeId("t"),
      title: `回看 ${highRiskNode.knowledge}`,
      subject: highRiskNode.subject,
      core: highRiskNode.core,
      branch: highRiskNode.branch,
      round: highRiskNode.round,
      layer: highRiskNode.layer,
      source: resources.find((r) => r.subject === highRiskNode.subject)?.name ?? "已上传资料",
      range: "关联章节和错题",
      minutes: 60,
      standard: "能够复述核心条件并完成相似题。",
      reason: `${highRiskNode.knowledge} 错题 ${highRiskNode.mistakes} 次，遗忘风险 ${highRiskNode.reviewRisk}。`,
      backup: "",
      done: false,
      actualMinutes: "",
      difficulty: "2",
      mastery: "有些模糊",
      accuracy: "",
      needReview: true,
      mood: "正常",
      note: "",
      status: "待开始",
      aiRecommended: true,
      aiReasonForgetRate: `遗忘风险 ${highRiskNode.reviewRisk}`,
      aiReasonLayerStable: `${highRiskNode.layer} 尚未稳定`,
      aiReasonMistakeCount: `错题 ${highRiskNode.mistakes} 次`,
      aiReasonExamFrequency: "属于高频考点",
      startedAt: "",
      estimatedCompletionMinutes: 60,
      masteryBefore: highRiskNode.masteryScore,
      masteryAfter: Math.min(100, highRiskNode.masteryScore + 20),
      completedAt: "",
      relatedCardIds: [],
      relatedQuestionIds: [],
    }];
    setTasks(nextTasks);
    addLog(input, `生成 ${nextTasks.length} 个任务，优先 ${highRiskNode.core} / ${highRiskNode.knowledge}`);
  }

  // 2026-08-03 产品修复：上传后自动 AI 识别（与 analyzeMaterial 同款解析链，但：
  // 1) 不强制跳转 knowledge/resources 视图（上传场景不打断用户；手动点击仍走 analyzeMaterial 跳转）
  // 2) 不使用全局 runId 互斥——批量上传多个 PDF 时每个文件独立计时互不取消，全部完成识别
  // 3) 资源被删除时安全退出（避免幽灵分析完成回调）
  function autoAnalyzeMaterial(resource: Resource) {
    const steps: AgentStep[] = [
      "解析资料类型", "识别章节/套卷", "抽取题目", "归纳知识点", "提取高频考点", "形成七核", "更新知识图谱",
    ].map((title) => ({ id: makeId("a"), title, status: "等待" } as AgentStep));
    pushSystem(`正在 AI 识别资料：${resource.name}…`, "action");
    steps.forEach((step, i) => {
      const timeoutId = setTimeout(() => {
        // 资源已被删除 → 放弃后续步骤（不污染 UI）
        const resourceStillExists = resourcesRef.current.some((item) => item.id === resource.id);
        if (!resourceStillExists) return;
        if (i === steps.length - 1) {
          setResources((items) => items.map((r) => r.id === resource.id ? { ...r, status: "已索引" } : r));
          setMaterials((items) => items.map((material) => material.id === resource.id
            ? {
                ...material,
                status: "analyzed",
                analysis: {
                  sectionsCount: materialSections.filter((section) => section.materialId === resource.id).length || 1,
                  questionsCount: questions.filter((question) => question.materialId === resource.id || question.source.includes(resource.name)).length,
                  knowledgePointCount: nodes.filter((node) => node.subject === resource.subject).length,
                  coreConcepts: Array.from(new Set(nodes.filter((node) => node.subject === resource.subject).map((node) => node.core))).slice(0, 8),
                  highFrequencyPoints: Array.from(new Set(questions.filter((question) => question.subject === resource.subject).map((question) => question.knowledge))).filter(Boolean).slice(0, 8),
                  analyzedAt: new Date().toISOString(),
                },
              }
            : material));
          setMaterialSections((items) => items.map((section) => section.materialId === resource.id ? { ...section, analyzed: true } : section));
          pushAssistant(
            resource.kind === "image"
              ? `「${resource.name}」已保存为图片资料（图片暂不支持 AI 内容分析）。`
              : `「${resource.name}」AI 自动识别完成：${resource.type}，已关联知识图谱。`,
            "record"
          );
        }
      }, 350 * (i + 1));
      materialAnalysisTimeoutsRef.current.push(timeoutId);
    });
  }

  // Material-First（2026-08-01）：AI 分析一份资料 → 解析章节/题目/知识点/七核
  // 当前先展示解析链步骤演示；接真模型后替换 result 来源（见 analyze-exam）
  async function analyzeMaterial(resource: Resource) {
    if (examAnalyzing) return;
    materialAnalysisTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    materialAnalysisTimeoutsRef.current = [];
    const runId = materialAnalysisRunRef.current + 1;
    materialAnalysisRunRef.current = runId;
    setExamAnalyzing(true);
    setActiveResourceId(resource.id);
    setActiveKnowledgeSubject(resource.subject);
    setActiveView("knowledge");
    setActiveKnowledgePanel("resources");
    // 解析链步骤（Match 用户「AI 分析资料」流程）
    const steps: AgentStep[] = [
      "解析资料类型", "识别章节/套卷", "抽取题目", "归纳知识点", "提取高频考点", "形成七核", "更新知识图谱",
    ].map((title) => ({ id: makeId("a"), title, status: "等待" } as AgentStep));
    setAgentSteps(steps);
    pushSystem(`正在 AI 分析资料：${resource.name}…`, "action");
    steps.forEach((step, i) => {
      const timeoutId = setTimeout(async () => {
        if (materialAnalysisRunRef.current !== runId) return;
        const resourceStillExists = resourcesRef.current.some((item) => item.id === resource.id);
        if (!resourceStillExists) {
          if (i === steps.length - 1) setExamAnalyzing(false);
          return;
        }
        setAgentSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, status: "完成" } : s));
        if (i === steps.length - 1) {
          const subjectId = subjects.find((subject) => subject.name === resource.subject)?.id ?? resource.subject;
          const m = resourceToMaterial(resource, subjectId);
          // 2026-08-03 产品明确：所有真题不拆题。真题以整套 PDF 资料为单位保存与展示，
          // 不按题号拆解，仅标记「已分析」供书架识别（可阅读整套 PDF）。
          const aiNodes: KnowledgeNode[] = [];
          setResources((items) => items.map((r) => r.id === resource.id ? { ...r, status: "已索引" } : r));
          setMaterials((items) => items.map((material) => material.id === resource.id
            ? {
              ...m,
              status: "analyzed",
              analysis: {
                sectionsCount: materialSections.filter((section) => section.materialId === resource.id).length || 1,
                questionsCount: questions.filter((question) => question.materialId === resource.id || question.source.includes(resource.name)).length,
                knowledgePointCount: nodes.filter((node) => node.subject === resource.subject).length + aiNodes.length,
                coreConcepts: Array.from(new Set([...nodes.filter((node) => node.subject === resource.subject).map((node) => node.core), ...aiNodes.map((node) => node.core)])).slice(0, 8),
                highFrequencyPoints: Array.from(new Set(questions.filter((question) => question.subject === resource.subject).map((question) => question.knowledge))).filter(Boolean).slice(0, 8),
                analyzedAt: new Date().toISOString(),
              },
            }
            : material));
          setMaterialSections((items) => items.map((section) => section.materialId === resource.id ? { ...section, analyzed: true } : section));
          pushAssistant(
            resource.kind === "image"
              ? `「${resource.name}」AI 分析完成：图片资料（暂不支持内容解析，仅入库预览）。`
              : `「${resource.name}」AI 分析完成：识别 ${m.type}，生成解析链（章节→题目→知识点→七核）。`,
            "record"
          );
          setExamAnalyzing(false);
        }
      }, 350 * (i + 1));
      materialAnalysisTimeoutsRef.current.push(timeoutId);
    });
  }

  // 真题分析（首个真 AI 意图）：调 DeepSeek 提取高频考点/七核并写入图谱；
  // 无 key / 失败 → 优雅降级到演示逻辑，并明确标注「演示回复」，绝不伪装成真实分析。
  async function runExamAnalysis(subjectName: string) {
    if (examAnalyzing) return;
    setExamAnalyzing(true);
    try {
    const subjectQuestions = questions.filter((q) => q.subject === subjectName);
    const steps: AgentStep[] = ["分析真题", "更新知识图谱", "生成学习笔记"].map((title) => ({ id: makeId("a"), title, status: "等待" }));
    setAgentSteps(steps);
    pushSystem(`正在用 DeepSeek 分析 ${subjectName || "当前科目"} 的真题…`, "action");

    const result = await analyzeExam(subjectName, subjectQuestions);

    if (result.ok && (result.cores.length > 0 || result.nodes.length > 0)) {
      const coreSummary = result.cores.slice(0, 5).map((c) => `${c.name}(${c.frequency})`).join("、");
      // 依据 AI 结果新增知识图谱节点（按知识点去重，明确标注来源）
      const newNodes: KnowledgeNode[] = result.nodes
        .filter((n) => n.knowledge && !nodes.some((ex) => ex.subject === subjectName && ex.knowledge === n.knowledge))
        .map((n) => ({
          id: makeId("k"),
          subject: subjectName,
          core: n.core || "核心考点",
          branch: n.branch || "",
          knowledge: n.knowledge,
          explanation: `AI 正式（DeepSeek）：${n.reason}`.slice(0, 300),
          prerequisite: "",
          related: "",
          masteryLevel: 0,
          masteryScore: 20,
          confidence: "低",
          round: currentSubject?.round || "第一轮",
          layer: currentSubject?.layer || "Layer 1",
          mistakes: 0,
          reviewRisk: "正常",
          isMonthlyFocus: false,
        }));
      if (newNodes.length) setNodes((items) => [...newNodes, ...items]);
      setPending((items) => [{ id: makeId("p"), kind: "图谱更新", title: `AI 正式分析：${subjectName} 高频考点`, subject: subjectName || "未分科", detail: `DeepSeek 识别 ${result.cores.length} 个核心、新增 ${newNodes.length} 个知识点；高频：${coreSummary || "—"}`, status: "待确认" }, ...items]);
      setNotes((items) => [{ id: makeId("n"), title: `真题分析（AI 正式 · DeepSeek）：${subjectName}`, body: `高频核心：${coreSummary || "—"}\n建议知识点：\n${result.nodes.slice(0, 12).map((n) => `· ${n.core}/${n.knowledge}——${n.reason}`).join("\n")}`, tags: ["AI正式", "真题分析", subjectName] }, ...items]);
      setAgentSteps(steps.map((s) => ({ ...s, status: "完成" })));
      pushSystem(`AI 正式分析完成（DeepSeek）：${result.cores.length} 个高频核心、新增 ${newNodes.length} 个知识点。`, "action");
    } else {
      // 降级演示（明确标注，不误导）
      const core = nodes.find((n) => n.subject === subjectName)?.core ?? "核心考点";
      const knowledge = nodes.find((n) => n.subject === subjectName)?.knowledge ?? "起始考点";
      setPending((items) => [{ id: makeId("p"), kind: "图谱更新", title: "真题分析结果（演示）", subject: subjectName || "未分科", detail: `建议提高 ${core} / ${knowledge} 的复习优先级`, status: "待确认" }, ...items]);
      setNotes((items) => [{ id: makeId("n"), title: "真题分析学习笔记（演示）", body: `演示回复：集中指向 ${core} / ${knowledge}。先补适用条件，再做综合题。`, tags: ["演示", "真题分析", core] }, ...items]);
      setAgentSteps(steps.map((s) => ({ ...s, status: "完成" })));
      pushSystem(`演示回复（${analyzeErrorReason(result.error)}，未接真模型）`, "action");
    }
    } finally {
      setExamAnalyzing(false);
    }
  }

  // 错因分析（第 2 个真 AI 意图）：取本学科最近的错题 → DeepSeek 归因 + 分层建议；
  // 无 key / 失败 → 优雅降级到规则回复，并明确标注「演示回复」。
  async function runMistakeAnalysis(subjectName: string) {
    const subject = subjectName || currentSubject?.name || "";
    const mistakes = questions.filter((q) => q.subject === subject && q.result === "错误").slice(0, 12);
    if (mistakes.length === 0) {
      pushAssistant(`当前 ${subject || "科目"} 暂无已标记「错误」的真题，可在真题库做题记录中标记错题。`);
      return;
    }
    pushSystem(`正在用 DeepSeek 分析 ${subject || "当前科目"} 的错因…`, "action");
    const result = await analyzeMistakes(subject, mistakes);
    if (result.ok && result.mistakes.length > 0) {
      const lines = result.mistakes.map((m) => `· ${m.reason}：${m.detail}（${m.questionRef}）→ ${m.suggestion}`).join("\n");
      pushAssistant(`错因分析（AI 正式 · DeepSeek）：${result.summary}\n${lines}`);
    } else {
      pushAssistant(`演示回复（${mistakesErrorReason(result.error)}，未接真模型）：近期错题集中在 ${mistakes[0]?.core || "核心考点"} 的适用条件判断，建议先重看条件再专项练习。`);
    }
  }

  async function runAgentWorkflow(input: string) {
    await runExamAnalysis(currentSubject?.name ?? "");
    generatePlan(input);
  }

  // 今日计划真生成（第 3 个真 AI 意图）：DeepSeek 基于知识点/错题/科目时长生成多任务计划；
  // 无 key / 失败 → 降级到本地 generatePlan，并诚实标注「演示回复」。
  async function runPlanGeneration() {
    pushSystem("正在用 DeepSeek 生成今日计划…", "action");
    // 2026-08-03 增强：计划生成参考真题高频考点 + 学习者近期状态（已完成任务/学习天数）
    const result = await generateTodayPlan({
      subjects,
      nodes,
      questions,
      tasks,
      studyDays,
    });
    if (result.ok && result.tasks.length > 0) {
      const tasks: Task[] = result.tasks.map((t) => ({
        id: makeId("t"),
        title: t.title,
        subject: t.subject,
        core: t.core,
        branch: t.knowledge,
        round: t.round,
        layer: t.layer,
        source: "AI 正式（DeepSeek）",
        range: "今日重点",
        minutes: t.minutes,
        standard: "完成对应练习并能在无提示下讲清核心条件",
        reason: t.reason,
        backup: "",
        done: false, actualMinutes: "", difficulty: "2", mastery: "有些模糊", accuracy: "", needReview: true, mood: "正常", note: "", status: "待开始",
        aiRecommended: true,
        aiReasonForgetRate: t.priority === 1 ? "今日最高优先级" : "",
        aiReasonLayerStable: "",
        aiReasonMistakeCount: "",
        aiReasonExamFrequency: "",
        startedAt: "", estimatedCompletionMinutes: t.minutes,
        masteryBefore: 0, masteryAfter: 0, completedAt: "",
        relatedCardIds: [], relatedQuestionIds: [],
      }));
      setTasks(tasks);
      pushAssistant(`今日计划（AI 正式 · DeepSeek）：${result.summary}\n${result.tasks.map((t) => `· ${t.title}（${t.minutes} 分钟）— ${t.reason}`).join("\n")}`);
    } else {
      generatePlan("AI 指令：今天学什么");
      pushAssistant(`演示回复（${planErrorReason(result.error)}，未接真模型）：已按风险知识点生成今日任务。`);
    }
  }

  // 通用 AI 对话（第 4 个真 AI 意图）：未命中任何结构化意图时，调 DeepSeek 自由文本补全；
  // 2026-08-03 改为 SSE 流式输出（打字机效果）；无 key / 失败 → 诚实标注「演示回复」。
  async function runGeneralChat(text: string) {
    const subject = currentSubject?.name || activeKnowledgeSubject || subjects[0]?.name || "";
    const subjectNodes = nodes.filter((n) => n.subject === subject);
    const highRisk = subjectNodes.filter((n) => n.reviewRisk === "高风险").slice(0, 3).map((n) => `${n.knowledge}(${n.masteryScore}%)`).join("、") || "无";
    const doneTasksToday = tasks.filter((t) => t.done && t.completedAt).length;
    const totalMinutes = tasks.filter((t) => t.done).reduce((sum, t) => sum + Number(t.actualMinutes || t.minutes || 0), 0);
    const wrongCount = questions.filter((q) => q.subject === subject && q.result === "错误").length;
    const system = `你是「筑巢考研工作台」的 AI 学习助手，必须基于用户当前的备考情况回答，不要泛泛而谈。
当前用户正在备考：${subject}（${currentSubject?.round ?? "第一轮"} / ${currentSubject?.layer ?? "第 1 层"}）。
- 已上传资料 ${resources.filter((r) => r.subject === subject).length} 份、真题 ${questions.filter((q) => q.subject === subject).length} 道
- 今日本学科已完成 ${doneTasksToday} 项任务（累计 ${totalMinutes} 分钟）
- 高风险知识点：${highRisk}
- 错题 ${wrongCount} 道
请结合以上实际情况，用中文给出具体、可执行的建议。`;
    pushSystem("正在用 DeepSeek 思考…", "action");
    // 先占位一条空的 assistant 消息，后续流式逐块填充（打字机效果）
    const sessionId = ensureChatSession();
    const placeholderMessage = createMessage("assistant", "", "chat");
    setChatSessions((items) => appendMessage(items, sessionId, placeholderMessage));
    let hasContent = false;
    await chatCompleteStream({
      system,
      user: text,
      onDelta: (delta) => {
        hasContent = true;
        setChatSessions((items) => items.map((s) => s.id === sessionId
          ? { ...s, messages: s.messages.map((m) => m.id === placeholderMessage.id ? { ...m, content: m.content + delta, updatedAt: new Date().toISOString() } : m) }
          : s));
      },
      onDone: (result) => {
        if (result.ok && result.content) {
          setChatSessions((items) => items.map((s) => s.id === sessionId
            ? { ...s, messages: s.messages.map((m) => m.id === placeholderMessage.id ? { ...m, content: result.content ?? "", updatedAt: new Date().toISOString() } : m) }
            : s));
          setNotice("AI 回复完成");
          return;
        }
        // 失败 → 降级回复也逐字打字机输出（确保无 API key 时仍可见流式效果）
        const fallback = `演示回复（${chatErrorReason(result.error)}，未接真模型）：已收到你的问题「${text.slice(0, 30)}」。你可以让我安排任务、检索真题、分析错因或生成笔记。`;
        let idx = 0;
        const timer = setInterval(() => {
          idx += 2;
          setChatSessions((items) => items.map((s) => s.id === sessionId
            ? { ...s, messages: s.messages.map((m) => m.id === placeholderMessage.id ? { ...m, content: fallback.slice(0, idx), updatedAt: new Date().toISOString() } : m) }
            : s));
          if (idx >= fallback.length) {
            clearInterval(timer);
            setNotice("AI 回复生成失败，已展示演示回复");
          }
        }, 24);
      },
    });
    // 完全无输出（例如空响应）时兜底
    if (!hasContent) {
      // 亦逐字显示兜底回复
      const fallback = `演示回复（未接真模型）：已收到你的问题「${text.slice(0, 30)}」。`;
      let idx = 0;
      const timer = setInterval(() => {
        idx += 2;
        setChatSessions((items) => items.map((s) => s.id === sessionId
          ? { ...s, messages: s.messages.map((m) => m.id === placeholderMessage.id && !m.content ? { ...m, content: fallback.slice(0, idx), updatedAt: new Date().toISOString() } : m) }
          : s));
        if (idx >= fallback.length) {
          clearInterval(timer);
        }
      }, 24);
    }
  }

  function searchQuestionsFromPrompt(text: string) {
    const keyword = extractQuestionKeyword(text);
    const keywordMatched = questions.filter((question) => {
      const haystack = `${question.year}${question.number}${question.stem}${question.core}${question.branch}${question.knowledge}${question.source}`;
      return !keyword || haystack.includes(keyword);
    });
    const fallbackSubject = activeKnowledgeSubject || currentSubject?.name || subjects[0]?.name || "";
    const subjectName = keywordMatched[0]?.subject || fallbackSubject;
    const matched = keywordMatched.filter((question) => question.subject === subjectName);
    setActiveView("knowledge");
    setActiveKnowledgeSubject(subjectName);
    setActiveKnowledgePanel("questions");
    setQuestionFilter({ subject: subjectName, core: "全部", result: "全部", keyword });
    if (matched.length > 0) {
      const summary = matched.slice(0, 3).map((q) => `${q.year} 第 ${q.number} 题：${q.knowledge}`).join("；");
      pushAssistant(`已检索真题库，找到 ${matched.length} 道相关真题：${summary}`);
    } else {
      pushAssistant(`已检索 ${subjectName} 真题库，暂未找到「${keyword || text}」相关题目。`);
    }
  }

  function runPrompt(prompt = chatInput) {
    const text = prompt.trim();
    if (!text) return;
    // UX Sprint P0: 用户消息写入当前 Session（无 Session 时自动创建；发送即标记为「正在学习」）
    const sessionId = ensureChatSession();
    setChatSessions((items) => {
      const userMessage = createMessage("user", text);
      return appendMessage(items, sessionId, userMessage).map((s) => s.id === sessionId
        ? { ...s, title: s.title === "新对话" ? text.slice(0, 20) : s.title, status: "active" }
        : s);
    });
    setChatInput("");
    // REVIEW_v6 P2：意图路由抽到 lib/chat.classifyPromptIntent
    // 「把今天整理成笔记」必命中 notes（笔记分支优先于「今天/学什么」）
    const intent = classifyPromptIntent(text);
    switch (intent.type) {
      case "notes": {
        // 2026-08-04 修复：不再生成虚构内容，改为基于用户真实学习数据生成笔记摘要
        const subjectName = currentSubject?.name || activeKnowledgeSubject || subjects[0]?.name || "";
        const subjectTasks = tasks.filter((t) => t.subject === subjectName && t.done);
        const subjectWrong = questions.filter((q) => q.subject === subjectName && q.result === "错误");
        const subjectNodes = nodes.filter((n) => n.subject === subjectName);
        const highRisk = subjectNodes.filter((n) => n.reviewRisk === "高风险").slice(0, 3).map((n) => n.knowledge).join("、") || "暂无";
        const summary = [
          `今日已完成 ${subjectTasks.length} 项任务`,
          `错题 ${subjectWrong.length} 道`,
          `高风险知识点：${highRisk}`,
        ].join("；");
        setNotes((items) => [{ id: makeId("n"), title: `今日学习笔记（${dateOnly()}）`, body: summary, tags: ["AI笔记", subjectName] }, ...items]);
        pushAssistant(`已生成今日学习笔记：${summary}`);
        return;
      }
      case "plan": {
        runPlanGeneration();
        return;
      }
      case "agent-workflow": {
        runAgentWorkflow(text);
        return;
      }
      case "exam-analysis": {
        runExamAnalysis(currentSubject?.name ?? "");
        return;
      }
      case "search-questions": {
        searchQuestionsFromPrompt(text);
        return;
      }
      case "mistake-analysis": {
        runMistakeAnalysis(currentSubject?.name ?? "");
        return;
      }
      case "review-cards": {
        setActiveView("cards");
        setCardSubjectView(activeCardSubject || currentSubject?.name || subjects[0]?.name || "");
        setActiveCardCategory(ALL_GROUPS);
        setCardSubView("待复习");
        pushAssistant(`已进入 ${activeCardSubject || currentSubject?.name || "当前科目"} 的沉淀卡片复习。`);
        return;
      }
      case "create-card": {
        createCardFromText("AI对话", text);
        setActiveView("cards");
        setCardSubjectView(activeCardSubject || currentSubject?.name || "");
        setActiveCardCategory(ALL_GROUPS);
        setCardSubView("待复习");
        return;
      }
      case "round-info": {
        pushAssistant(`当前主要科目处于 ${currentSubject?.round ?? "第一轮"}，${currentSubject?.layer ?? "第 1 层"}。`);
        return;
      }
      default:
        runGeneralChat(text);
        return;
    }
  }

  function addLog(input: string, output: string, accepted = "自动生成", dataRead = ["考试日期", "科目状态", "学习历史", "高风险节点"]) {
    setLogs((items) => [{ id: makeId("l"), time: today(), input, output, accepted, dataRead, userRevision: "待记录", finalResult: output, rating: "未评价", rework: "0" }, ...items]);
  }

  function recordStudyDay(minutes = 0, completedDelta = 0) {
    const date = dateOnly();
    setStudyDays((items) => {
      const exists = items.some((item) => item.date === date);
      const next = exists
        ? items.map((item) => item.date === date ? { ...item, completed: Math.max(0, item.completed + completedDelta), minutes: Math.max(0, item.minutes + minutes) } : item)
        : [...items, { date, completed: Math.max(0, completedDelta), minutes: Math.max(0, minutes) }];
      return next.slice(-MAX_STUDY_DAYS);
    });
  }

  return {
    ensureChatSession, newChatSession, pushAssistant, pushSystem, restoreLastDeleted, handleExportData, handleImportData, completeOnboarding, selectKnowledgeSubject, inferResource, openResource, resetUploadProgress, openResourceDialog, closeResourceDialog, startUploadProgress, startBatchUpload, upsertMaterialFromResource, addResource, confirmPendingItem, dismissPendingItem, deleteResource, onCreateAnnotation, onEditAnnotation, onDeleteAnnotation, deleteQuestion, deleteNode, addCategoryInline, moveCardToCategory, reviewCard, moveCard, safeCardCategoryForSubject, openNewCardDialog, openEditCardDialog, createCardFromText, deleteCard, openCardSource, showRelatedQuestions, updateTask, recordTaskDone, recordTaskUndone, toggleTaskDone, moveTask, stopTimer, runTimerFrom, currentElapsedSeconds, startTask, pauseTimer, resumeTimer, handleEndLearning, openTaskDialog, markTaskDraftDirty, requestCloseTaskDialog, completeTask, generatePlan, analyzeMaterial, runExamAnalysis, runMistakeAnalysis, runAgentWorkflow, runPlanGeneration, searchQuestionsFromPrompt, runPrompt, addLog, recordStudyDay,
  };
}
