/**
 * DOCX 支持（2026-08-05）
 *
 * - .docx 文件用 mammoth 在浏览器端解析为纯文本（保留段落结构）
 * - 文件本体存 IndexedDB（复用 pdf-storage 的 files store，Blob 通用）
 * - 解析出的纯文本单独存 IndexedDB（key = fileStorageKey + ":text"），供阅读与后续 RAG 检索
 * - .doc（Word 97-2003 二进制）前端可靠解析库少 → 明确提示转 .docx / PDF
 */
import mammoth from "mammoth";

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** 判断是否为 .docx 文件 */
export function isDocxFile(file: File): boolean {
  return (
    file.type === DOCX_MIME ||
    file.type === "application/octet-stream" && file.name.toLowerCase().endsWith(".docx") ||
    file.name.toLowerCase().endsWith(".docx")
  );
}

/** 判断是否为旧版 .doc 二进制（提示转换，不支持直接解析） */
export function isLegacyDocFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".doc") && !file.name.toLowerCase().endsWith(".docx");
}

/** 判断是否为纯文本文件（txt / md）——可直接解析为段落阅读 */
export function isTextFileType(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".markdown") || file.type === "text/plain" || file.type === "text/markdown";
}

/** 判断是否为图片文件——可识别入库并预览，暂不支持文字解析/AI 讲解 */
export function isImageFileType(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/.test(name);
}

/** 读取纯文本文件内容（txt / md） */
export async function extractTextFileContent(file: File): Promise<string> {
  return (await file.text()).trim();
}

/** 用 mammoth 从 File 提取纯文本 */
export async function extractDocxText(file: File): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return (result.value || "").trim();
}

/** 返回阅读友好文本（段落切分） */
export function docxTextToParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}