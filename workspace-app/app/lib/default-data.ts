import type { ExamGoal, Subject, Task, StudyDay, GrowthCard, CardDeck, CardCategory, Resource, Question, KnowledgeNode, Note, Annotation, AppSettings } from "./types.ts";
import { resourceToMaterial, resourceToMaterialSections } from "./types.ts";

// Static seed data - use FIXED dates to avoid hydration mismatch between server and client
// These are placeholder dates for initial seed data only.
const SEED_DATE_ONLY = "2026-07-30";

export const seedExam: ExamGoal = {
  examName: "2027 考研初试",
  school: "待设置",
  major: "待设置",
  examDate: "2026-12-26",
  startDate: SEED_DATE_ONLY,
  examGoalCreatedAt: SEED_DATE_ONLY,
  weeklyDays: "6",
  weekdayHours: "3.5",
  weekendHours: "8",
  baseline: "公共课第一轮推进中。",
};

export const seedSubjects: Subject[] = [
  {
    id: "s-politics",
    name: "政治",
    type: "公共课",
    maxScore: "100",
    targetScore: "70",
    currentProgress: "马克思主义原理",
    currentMastery: "有些模糊",
    weeklyHours: "6",
    hasPastPapers: true,
    hasSolutions: true,
    hasReferences: true,
    round: "第一轮",
    layer: "第 1 层",
    focus: "马原",
    risk: "正常",
  },
  {
    id: "s-english",
    name: "英语一",
    type: "公共课",
    maxScore: "100",
    targetScore: "70",
    currentProgress: "2010-2025 真题阅读",
    currentMastery: "基本理解",
    weeklyHours: "8",
    hasPastPapers: true,
    hasSolutions: true,
    hasReferences: true,
    round: "第一轮",
    layer: "第 1 层",
    focus: "长难句",
    risk: "正常",
  },
  {
    id: "s-english2",
    name: "英语二",
    type: "公共课",
    maxScore: "100",
    targetScore: "70",
    currentProgress: "2010-2025 真题阅读",
    currentMastery: "基本理解",
    weeklyHours: "8",
    hasPastPapers: true,
    hasSolutions: true,
    hasReferences: true,
    round: "第一轮",
    layer: "第 1 层",
    focus: "长难句",
    risk: "正常",
  },
  {
    id: "s-math2",
    name: "数学二",
    type: "公共课",
    maxScore: "150",
    targetScore: "110",
    currentProgress: "高数强化",
    currentMastery: "基本理解",
    weeklyHours: "10",
    hasPastPapers: true,
    hasSolutions: true,
    hasReferences: true,
    round: "第一轮",
    layer: "第 1 层",
    focus: "极限与导数",
    risk: "正常",
  },
];

// ─── 2026-08-14 公共课真题内置清单（用户确认：只做公共课，专业课真题不在范围）───
function buildPublicPastPaperResource(
  id: string,
  name: string,
  subject: string,
  fileName: string,
  year: string,
  linkedNode: string,
): Resource {
  return {
    id,
    name,
    subject,
    type: "真题",
    author: "全国统考",
    version: year,
    pages: "整套真题",
    status: "已索引",
    fileName,
    recommendedRound: "第二轮",
    recommendedLayer: "第 2-4 层",
    currentPage: "1",
    lastRead: "",
    readingMinutes: "0",
    linkedNode,
    resourceKind: "past_exam",
  };
}
// 英语一 2010-2025 / 数学二 2010-2025（2023、2024 已显式声明，不重复生成）
const extraPublicPaperResources: Resource[] = [
  // 政治 2003-2022、2025、2026（2023/2024 已显式声明；2026-08-16 补充 inbox 全量政治真题）
  ...[2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2025, 2026].map((y) =>
    buildPublicPastPaperResource(`r-politics-${y}`, `${y} 考研政治真题`, "政治", `politics-${y}.pdf`, String(y), "政治七核"),
  ),
  ...[2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2025].map((y) =>
    buildPublicPastPaperResource(`r-english-${y}`, `${y} 考研英语一真题`, "英语一", `english-${y}.pdf`, String(y), "英语七核"),
  ),
  // 英语二 2010-2025（2026-08-17 补充 inbox 英二全量真题）
  ...[2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025].map((y) =>
    buildPublicPastPaperResource(`r-english2-${y}`, `${y} 考研英语二真题`, "英语二", `english2-${y}.pdf`, String(y), "英语七核"),
  ),
  ...[2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025].map((y) =>
    buildPublicPastPaperResource(`r-math2-${y}`, `${y} 考研数学二真题`, "数学二", `math2-${y}.pdf`, String(y), "数学七核"),
  ),
];

export const seedResources: Resource[] = [
  // 2026-08-14：删除 r-3「政治历年精选」（politics-papers.pdf 无文件），题目 q-p1/q-p2 已重挂对应年份套卷
  // 2026-08-06 产品需求：真题库内置更完整的公共课真题（政治/英语多套年份、各题型带答案解析）
  {
    id: "r-politics-2024",
    name: "2024 考研政治真题",
    subject: "政治",
    type: "真题",
    author: "全国统考",
    version: "2024",
    pages: "整套真题",
    status: "已索引",
    fileName: "politics-2024.pdf",
    recommendedRound: "第二轮",
    recommendedLayer: "第 2-4 层",
    currentPage: "1",
    lastRead: "",
    readingMinutes: "0",
    linkedNode: "政治七核",
  },
  {
    id: "r-politics-2023",
    name: "2023 考研政治真题",
    subject: "政治",
    type: "真题",
    author: "全国统考",
    version: "2023",
    pages: "整套真题",
    status: "已索引",
    fileName: "politics-2023.pdf",
    recommendedRound: "第二轮",
    recommendedLayer: "第 2-4 层",
    currentPage: "1",
    lastRead: "",
    readingMinutes: "0",
    linkedNode: "政治七核",
  },
  {
    id: "r-english-2024",
    name: "2024 考研英语一真题",
    subject: "英语一",
    type: "真题",
    author: "全国统考",
    version: "2024",
    pages: "整套真题",
    status: "已索引",
    fileName: "english-2024.pdf",
    recommendedRound: "第二轮",
    recommendedLayer: "第 2-4 层",
    currentPage: "1",
    lastRead: "",
    readingMinutes: "0",
    linkedNode: "英语七核",
  },
  {
    id: "r-english-2023",
    name: "2023 考研英语一真题",
    subject: "英语一",
    type: "真题",
    author: "全国统考",
    version: "2023",
    pages: "整套真题",
    status: "已索引",
    fileName: "english-2023.pdf",
    recommendedRound: "第二轮",
    recommendedLayer: "第 2-4 层",
    currentPage: "1",
    lastRead: "",
    readingMinutes: "0",
    linkedNode: "英语七核",
  },
  ...extraPublicPaperResources,
];

export const seedQuestions: Question[] = [
  {
    id: "q-p1",
    materialId: "r-politics-2025",
    sectionId: "r-politics-2025-section-2025",
    subject: "政治",
    school: "全国统考",
    year: "2025",
    number: "1",
    type: "单选题",
    score: "1",
    stem: "马克思主义认为，社会存在与社会意识的关系是（　）",
    answer: "社会存在决定社会意识，社会意识具有相对独立性并能反作用于社会存在。",
    originalAnalysis: "把握唯物史观的基本原理。",
    aiAnalysis: "基础题，考查唯物史观第一层原理。",
    difficulty: "1",
    core: "马克思主义基本原理",
    branch: "唯物史观",
    knowledge: "社会存在与社会意识",
    layer: "第 1 层",
    done: false,
    result: "未做",
    errorReason: "",
    note: "",
    source: "2025 政治真题 P1",
    confirmed: true,
    favorite: false,
  },
  {
    id: "q-politics-2025-2",
    materialId: "r-politics-2025",
    sectionId: "r-politics-2025-section-2025",
    subject: "政治",
    school: "全国统考",
    year: "2025",
    number: "2",
    type: "单选题",
    score: "1",
    stem: "马克思认为：\"对人类生活形式的思索，从而对这些形式的科学分析，总是采取同实际发展相反的道路……这种思索是从发展过程的完成的结果开始的。\"这种\"从后思索法\"所揭示的内涵是：历史的发展总是按照时间顺序从过去到现在以至未来，而对历史的认识则要遵循相反的顺序。下列表述与\"从后思索法\"相一致的是（　）",
    answer: "B。人体解剖对于猴体解剖是一把钥匙。\"从后思索法\"即从完成的结果出发回溯认识历史，正如以成熟形态的人体反观低级形态的猴体。",
    originalAnalysis: "2025 考研政治真题第 2 题（从 PDF 提取题干、解析确认答案）。",
    aiAnalysis: "理解\"从后思索法\"：认识顺序与历史发展顺序相反，以结果反推过程。",
    difficulty: "2",
    core: "马克思主义基本原理",
    branch: "唯物史观",
    knowledge: "从后思索法",
    layer: "第 2 层",
    done: false,
    result: "未做",
    errorReason: "",
    note: "",
    source: "2025 政治真题 P2",
    confirmed: true,
    favorite: false,
  },
  {
    id: "q-politics-2025-3",
    materialId: "r-politics-2025",
    sectionId: "r-politics-2025-section-2025",
    subject: "政治",
    school: "全国统考",
    year: "2025",
    number: "3",
    type: "单选题",
    score: "1",
    stem: "唯物史观从人民群众创造历史这一基本前提出发，也不否认个人在历史上的作用。习近平在纪念毛泽东同志诞辰 120 周年座谈会上指出：\"不能用今天的时代条件、发展水平、认识水平去衡量和要求前人，不能苛求前人干出只有后人才能干出的业绩来。\"这一论述表明（　）",
    answer: "D。要从特定的历史条件出发对历史人物作具体全面的考察和评价。",
    originalAnalysis: "2025 考研政治真题第 3 题（从 PDF 提取题干、解析确认答案）。",
    aiAnalysis: "评价历史人物必须置于特定历史条件，作具体全面的考察。",
    difficulty: "2",
    core: "马克思主义基本原理",
    branch: "唯物史观",
    knowledge: "评价历史人物",
    layer: "第 2 层",
    done: false,
    result: "未做",
    errorReason: "",
    note: "",
    source: "2025 政治真题 P2",
    confirmed: true,
    favorite: false,
  },
  {
    id: "q-p2",
    materialId: "r-politics-2024",
    sectionId: "r-politics-2024-section-2024",
    subject: "政治",
    school: "全国统考",
    year: "2024",
    number: "17",
    type: "多选题",
    score: "2",
    stem: "中国式现代化的中国特色包括（　）",
    answer: "人口规模巨大的现代化、全体人民共同富裕的现代化、物质文明和精神文明相协调的现代化、人与自然和谐共生的现代化、走和平发展道路的现代化。",
    originalAnalysis: "对应二十大报告对中国式现代化的系统阐述。",
    aiAnalysis: "识记题，注意五个特色缺一不可。",
    difficulty: "2",
    core: "毛泽东思想和中国特色社会主义理论体系",
    branch: "中国式现代化",
    knowledge: "中国式现代化五个特色",
    layer: "第 2 层",
    done: false,
    result: "未做",
    errorReason: "",
    note: "",
    source: "2024 政治真题 P2",
    confirmed: true,
    favorite: false,
  },
  // ─── 2026-08-06 内置公共课真题：政治 2024（各题型带答案解析）───
  {
    id: "q-politics-2024-1",
    materialId: "r-politics-2024",
    sectionId: "r-politics-2024-section-2024",
    subject: "政治",
    school: "全国统考",
    year: "2024",
    number: "1",
    type: "单选题",
    score: "1",
    stem: "马克思主义哲学认为，世界的本原是（　）",
    answer: "物质。物质决定意识，意识是物质世界长期发展的产物。",
    originalAnalysis: "考查唯物主义基本观点。",
    aiAnalysis: "基础识记题，属于马克思主义哲学第一层原理。",
    difficulty: "1",
    core: "马克思主义基本原理",
    branch: "唯物论",
    knowledge: "世界的物质统一性",
    layer: "第 1 层",
    done: false,
    result: "未做",
    errorReason: "",
    note: "",
    source: "2024 政治真题 P1",
    confirmed: true,
    favorite: false,
  },
  {
    id: "q-politics-2024-2",
    materialId: "r-politics-2024",
    sectionId: "r-politics-2024-section-2024",
    subject: "政治",
    school: "全国统考",
    year: "2024",
    number: "2",
    type: "多选题",
    score: "2",
    stem: "党的二十大报告指出，中国式现代化的本质要求包括（　）",
    answer: "坚持中国共产党领导，坚持中国特色社会主义，实现高质量发展，发展全过程人民民主，丰富人民精神世界，实现全体人民共同富裕，促进人与自然和谐共生，推动构建人类命运共同体，创造人类文明新形态。",
    originalAnalysis: "对应党的二十大报告原文。",
    aiAnalysis: "政策原文识记题，注意完整记忆九条本质要求。",
    difficulty: "2",
    core: "毛泽东思想和中国特色社会主义理论体系",
    branch: "中国式现代化",
    knowledge: "中国式现代化本质要求",
    layer: "第 2 层",
    done: false,
    result: "未做",
    errorReason: "",
    note: "",
    source: "2024 政治真题 P2",
    confirmed: true,
    favorite: false,
  },
  {
    id: "q-politics-2024-3",
    materialId: "r-politics-2024",
    sectionId: "r-politics-2024-section-2024",
    subject: "政治",
    school: "全国统考",
    year: "2024",
    number: "3",
    type: "分析题",
    score: "10",
    stem: "结合材料分析：为什么说\"江山就是人民，人民就是江山\"？",
    answer: "① 人民是历史的创造者，是社会变革的决定力量；② 中国共产党根基在人民、血脉在人民，必须坚持以人民为中心的发展思想；③ 为人民谋幸福是党的初心使命，群众路线是党的生命线。",
    originalAnalysis: "需结合唯物史观群众史观与党的群众路线展开。",
    aiAnalysis: "综合题，考查唯物史观与党的群众路线联系。",
    difficulty: "3",
    core: "马克思主义基本原理",
    branch: "唯物史观",
    knowledge: "人民群众是历史的创造者",
    layer: "第 3 层",
    done: false,
    result: "未做",
    errorReason: "",
    note: "",
    source: "2024 政治真题 P3",
    confirmed: true,
    favorite: false,
  },
];

export const seedMaterials = seedResources.map((resource) => resourceToMaterial(
  resource,
  seedSubjects.find((subject) => subject.name === resource.subject)?.id ?? resource.subject,
));
export const seedMaterialSections = seedResources.flatMap((resource) => resourceToMaterialSections(resource, seedQuestions));

// 2026-08-14 demo 数据已删除：知识点由 AI 从真实资料动态识别，seed 不再内置
export const seedNodes: KnowledgeNode[] = [];

// 2026-08-14 demo 数据已删除：任务由 AI 计划引擎动态生成
export const seedTasks: Task[] = [];
// 2026-08-14 demo 数据已删除：笔记由用户/Agent 基于真实学习记录生成
export const seedNotes: Note[] = [];

// 2026-08-14 demo 数据已删除：仅保留英语一牌组
export const seedDecks: CardDeck[] = [
  { id: "deck-english", subject: "英语一", name: "单词与长难句", cardIds: [] },
];

/**
 * UX Sprint: 卡片自定义分类 seed（学科 ≠ 分类）。
 * 每个学科拥有独立的分类列表，绑定 subjectId，不跨学科共享。
 * 2026-08-14 demo 数据已删除：分类由用户自建，seed 不再内置。
 */
export const seedCardCategories: CardCategory[] = [];

// 2026-08-14 demo 数据已删除：卡片由用户/资料批注生成
export const seedCards: GrowthCard[] = [];

// 2026-08-14 demo 数据已删除：批注由用户在 Reader 中真实创建
export const seedAnnotations: Annotation[] = [];

export const seedAppSettings: AppSettings = {
  aiProvider: "未接入",
  modelName: "本地规则模拟",
  retrievalMode: "本机 localStorage",
  notificationTime: "21:30",
  notificationChannel: "站内提醒",
  parseMode: "AI预识别 + 用户确认",
  aiEnabled: true,
  aiConfirmBeforeAction: true,
  aiConfirmAfterRecognition: true,
  aiAnswerDetail: "标准",
  aiReadUploads: true,
  aiReadStudyRecords: true,
  aiAdjustPlan: true,
};

export const seedStudyDays: StudyDay[] = [
  { date: SEED_DATE_ONLY, completed: 1, minutes: 45 },
  { date: SEED_DATE_ONLY, completed: 2, minutes: 120 },
  { date: SEED_DATE_ONLY, completed: 1, minutes: 60 },
  { date: SEED_DATE_ONLY, completed: 2, minutes: 95 },
];

// ─── 产品级常量（page.tsx 原内联；统一收敛于此，避免组件直接硬编码业务数据）───

/** 「七核」核心考点名称（公共课 fallback；正常状态由真题题目 core 字段动态生成） */
export const CORE_NAMES = ["马克思主义基本原理", "毛泽东思想和中国特色社会主义理论体系", "中国近现代史纲要", "思想道德与法治", "英语一 阅读", "数学二 高等数学", "数学二 线性代数"];

/** AI 助手快捷提问（产品文案，公共课） */
export const QUICK_PROMPTS = [
  "今天学什么",
  "制定今天学习计划",
  "为什么总错这类题",
  "把今天整理成笔记",
  "分析最近三套真题，更新图谱并重排计划",
  "找近三年政治真题",
  "我现在属于第几轮",
];

/** 掌握程度选项 */
export const MASTERY_OPTIONS = ["完全不懂", "有些模糊", "基本理解", "能够讲清", "能够迁移"] as const;

/** 学习状态选项 */
export const MOOD_OPTIONS = ["较差", "一般", "正常", "较好", "很好"] as const;