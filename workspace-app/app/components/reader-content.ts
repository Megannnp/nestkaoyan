import type { Resource, Question, KnowledgeNode } from "../lib/types";

/** 从 Resource 数据生成模拟页面内容 */
function generatePageContent(
  resource: Resource,
  nodes: KnowledgeNode[],
  questions: Question[],
  pageNum: number
): string[] {
  const resourceName = resource.name || "资料";
  const subject = resource.subject || "政治";
  const linkedNode = resource.linkedNode || "";
  const coreName = linkedNode.split("/")[0]?.trim() || "核心考点";
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
  _pageNum: number
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

/**
 * 2026-08-05 修复：中文 PDF 文本提取必须配置 CMap。
 * 缺少 cMapUrl 时，使用 CJK 编码（如 UniGB-UCS2-H / UTM-XXX）的 PDF 会提取出乱码或空文本。
 * build/sites-vite-plugin.ts 已将 node_modules/pdfjs-dist/cmaps/*.bcmap 复制到站点根 /cmaps/，
 * 因此这里直接使用站点根相对路径，生产部署与本地构建均可解析。
 */
const PDF_CMAP_URL = "/cmaps/";

/** 获取 pdfjs getDocument 所需的 CMap 参数（用于文本提取/渲染） */
export function getPdfCMapOptions(): { cMapUrl: string; cMapPacked: boolean } {
  return { cMapUrl: PDF_CMAP_URL, cMapPacked: true };
}

export { generatePageContent, generateAiHint, searchInContent, ensurePdfWorker };
