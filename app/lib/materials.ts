import type { ExamGoal, MaterialSection, Question, Resource, Subject } from "./types";
import { resourceToMaterial, resourceToMaterialSections } from "./types";

const QUESTION_SEARCH_STOP_WORDS = ["找", "近五年", "最近", "三套", "真题", "哪里", "讲", "这个", "分析", "更新", "重排", "帮我", "请"];

export function extractQuestionKeyword(text: string) {
  return QUESTION_SEARCH_STOP_WORDS.reduce((value, word) => value.replaceAll(word, ""), text)
    .replace(/[，。！？、\s]/g, "")
    .trim();
}

export function materialSubjectId(resource: Resource, subjects: Subject[]) {
  return subjects.find((subject) => subject.name === resource.subject)?.id ?? resource.subject;
}

export function buildMaterialBundle(resource: Resource, subjects: Subject[], questions: Question[] = []) {
  return {
    material: resourceToMaterial(resource, materialSubjectId(resource, subjects)),
    sections: resourceToMaterialSections(resource, questions),
  };
}

export function buildPlaceholderQuestionsForPastPaper(
  resource: Resource,
  sections: MaterialSection[],
  exam: ExamGoal,
  dateOnly: string,
  makeId: (prefix: string) => string,
): Question[] {
  if (!resource.type.includes("真题")) return [];
  return sections.map((section, index): Question => ({
    id: makeId("q"),
    materialId: resource.id,
    sectionId: section.id,
    subject: resource.subject,
    school: exam.school,
    year: section.title.match(/20\d{2}/)?.[0] ?? dateOnly.slice(0, 4),
    number: String(index + 1),
    type: "待识别",
    score: "",
    stem: `${section.title} 待 AI 拆题`,
    answer: "",
    originalAnalysis: "",
    aiAnalysis: "已按套卷入库，等待模型解析具体题号。",
    difficulty: "3",
    core: resource.linkedNode.split("/")[0]?.trim() || "待识别",
    branch: resource.linkedNode.split("/")[1]?.trim() || "",
    knowledge: "待识别",
    layer: resource.recommendedLayer,
    done: false,
    result: "未做",
    errorReason: "",
    note: "",
    source: resource.name,
    confirmed: false,
    favorite: false,
  }));
}
