import type { Question } from "../types";
import { aiGatewayHeaders } from "./chat-complete";

/**
 * 客户端封装：调用服务端 /api/analyze-mistakes（错题 → 错因归因 + 分层建议）。
 * key 在服务端，本模块只发题干/自述错因与科目，不接触密钥。
 * 返回统一 shape：ok=false 时携带 error（no_api_key / no_mistakes / upstream_error / …），
 * 供调用方优雅降级到演示逻辑并向用户说明原因。
 */

export interface MistakeAnalysis {
  reason: string;
  detail: string;
  questionRef: string;
  suggestion: string;
}
export interface MistakesResult {
  ok: boolean;
  provider?: string;
  summary: string;
  mistakes: MistakeAnalysis[];
  error?: string;
  message?: string;
}

/** error 码 → 面向用户的简短原因 */
export function mistakesErrorReason(error?: string): string {
  switch (error) {
    case "no_api_key": return "未配置模型密钥";
    case "no_mistakes": return "该科目暂无已录入错题";
    case "timeout": return "模型响应超时";
    case "parse_error": return "模型返回格式异常";
    case "upstream_error": return "模型服务返回错误";
    default: return "模型调用失败";
  }
}

export async function analyzeMistakes(subject: string, mistakes: Question[]): Promise<MistakesResult> {
  if (!subject.trim() || mistakes.length === 0) {
    return { ok: false, summary: "", mistakes: [], error: "no_mistakes" };
  }
  const payload = {
    subject,
    mistakes: mistakes.map((q) => ({ year: q.year, number: q.number, core: q.core, stem: q.stem, errorReason: q.errorReason })),
  };
  try {
    const resp = await fetch("/api/analyze-mistakes", {
      method: "POST",
      headers: { "content-type": "application/json", ...aiGatewayHeaders() },
      body: JSON.stringify(payload),
    });
    const data = (await resp.json().catch(() => null)) as Partial<MistakesResult> | null;
    if (!resp.ok || !data || !data.ok) {
      return {
        ok: false,
        summary: "",
        mistakes: [],
        error: data?.error ?? `http_${resp.status}`,
        message: data?.message,
      };
    }
    return {
      ok: true,
      provider: data.provider,
      summary: data.summary ?? "",
      mistakes: data.mistakes ?? [],
    };
  } catch (err) {
    return { ok: false, summary: "", mistakes: [], error: "network_error", message: String((err as Error)?.message || err) };
  }
}