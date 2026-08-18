import type { Question } from "../types";

/**
 * 客户端封装：调用服务端 /api/analyze-exam（真题 → 高频考点/七核 + 建议图谱节点）。
 * key 在服务端，本模块只发题干与科目，不接触密钥。
 * 返回统一 shape：ok=false 时携带 error（no_api_key / no_questions / upstream_error / …），
 * 供调用方优雅降级到演示逻辑并向用户说明原因。
 */

export interface AnalyzeCore {
  name: string;
  frequency: number;
  questionRefs: string[];
}
export interface AnalyzeNode {
  core: string;
  branch: string;
  knowledge: string;
  reason: string;
}
export interface AnalyzeResult {
  ok: boolean;
  provider?: string;
  cores: AnalyzeCore[];
  nodes: AnalyzeNode[];
  error?: string;
  message?: string;
}

/** error 码 → 面向用户的简短原因 */
export function analyzeErrorReason(error?: string): string {
  switch (error) {
    case "no_api_key": return "未配置模型密钥";
    case "no_questions": return "该科目暂无已录入真题";
    case "timeout": return "模型响应超时";
    case "parse_error": return "模型返回格式异常";
    case "upstream_error": return "模型服务返回错误";
    default: return "模型调用失败";
  }
}

export async function analyzeExam(subject: string, questions: Question[]): Promise<AnalyzeResult> {
  if (!subject.trim() || questions.length === 0) {
    return { ok: false, cores: [], nodes: [], error: "no_questions" };
  }
  const payload = {
    subject,
    questions: questions.map((q) => ({ year: q.year, number: q.number, core: q.core, stem: q.stem })),
  };
  try {
    const resp = await fetch("/api/analyze-exam", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await resp.json().catch(() => null)) as Partial<AnalyzeResult> | null;
    if (!resp.ok || !data || !data.ok) {
      return {
        ok: false,
        cores: [],
        nodes: [],
        error: data?.error ?? `http_${resp.status}`,
        message: data?.message,
      };
    }
    return { ok: true, provider: data.provider, cores: data.cores ?? [], nodes: data.nodes ?? [] };
  } catch (err) {
    return { ok: false, cores: [], nodes: [], error: "network_error", message: String((err as Error)?.message || err) };
  }
}
