/**
 * 错因分析端点（第 2 个真 AI 意图）：高频错题 → 错因归因 + 分层建议。
 *
 * 设计约束（与 analyze-exam 一致）：
 *   - API key 只在服务端读取（env.DEEPSEEK_API_KEY），绝不下发前端。
 *   - DeepSeek OpenAI 兼容接口 + response_format:json_object 结构化输出。
 *   - 缺 key → 503（客户端据此优雅降级到演示，不报错崩溃）。
 *   - 只依据用户提供的错题，严禁编造题目之外的错因。
 */

interface AnalyzeEnv {
  DEEPSEEK_API_KEY?: string;
  /** OpenAI 兼容网关地址（可选；默认 DeepSeek） */
  AI_BASE_URL?: string;
  /** 默认模型名（可选；默认 deepseek-chat） */
  AI_MODEL?: string;
}

import { aiEnvFallback } from "./ai-env.ts";

interface MistakeInput {
  year?: string;
  number?: string;
  core?: string;
  stem: string;
  errorReason?: string;
}

interface AnalyzeRequestBody {
  subject: string;
  mistakes: MistakeInput[];
}

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const TIMEOUT_MS = 30_000;
/** 控制 prompt 体积与成本：最多分析这么多题、每题截断长度 */
const MAX_MISTAKES = 12;
const MAX_STEM_CHARS = 400;

export interface MistakeAnalysis {
  /** 归因后的错因大类（如：概念混淆 / 计算失误 / 审题偏差 / 条件判断错误 / 方法不熟） */
  reason: string;
  /** 具体说明 */
  detail: string;
  /** 关联题目引用 */
  questionRef: string;
  /** 建议动作（如：重看适用条件 / 专项练习 5 题 / 复习公式推导） */
  suggestion: string;
}
export interface AnalyzeParsed {
  summary: string;
  mistakes: MistakeAnalysis[];
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function buildMessages(subject: string, mistakes: MistakeInput[]) {
  const list = mistakes
    .slice(0, MAX_MISTAKES)
    .map((q, i) => {
      const ref = [q.year, q.number ? `第${q.number}题` : ""].filter(Boolean).join(" ") || `错题${i + 1}`;
      const reason = q.errorReason ? `（用户自述错因：${q.errorReason}）` : "";
      return `【${ref}】${String(q.stem || "").slice(0, MAX_STEM_CHARS)}${reason}`;
    })
    .join("\n");

  const system =
    "你是资深考研辅导专家。任务：根据给定科目的高频错题，归纳共性错因并给出可执行的分层建议。" +
    "只依据给定题目与用户自述错因，严禁编造题目之外的错因或建议。" +
    "必须只输出一个 JSON 对象，不要任何多余文字或解释。";

  const user =
    `科目：${subject}\n以下是该科目近期做错的题目（每行一题）：\n${list}\n\n` +
    "请输出 json，结构如下：\n" +
    '{\n' +
    '  "summary": "一段 60 字内的总体错因总结",\n' +
    '  "mistakes": [{"reason": "错因大类", "detail": "具体说明", "questionRef": "题目引用", "suggestion": "建议动作"}]\n' +
    "}\n" +
    "要求：mistakes 按共性程度排序、至多 8 条；reason 从（概念混淆/计算失误/审题偏差/条件判断错误/方法不熟/其他）中选择最贴切的一个；全部用中文。";

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/**
 * 解析并防御性校验模型返回的 JSON 文本（导出以便离线单测，不打网络）。
 */
export function parseMistakeContent(content: string): AnalyzeParsed {
  const data = JSON.parse(content) as unknown;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("模型返回非对象 JSON");
  const obj = data as Record<string, unknown>;

  const summary = String(obj.summary ?? "").trim().slice(0, 200);
  const mistakesRaw = Array.isArray(obj.mistakes) ? obj.mistakes : [];

  const mistakes: MistakeAnalysis[] = mistakesRaw
    .map((m) => {
      const o = (m ?? {}) as Record<string, unknown>;
      return {
        reason: String(o.reason ?? "").trim(),
        detail: String(o.detail ?? "").trim(),
        questionRef: String(o.questionRef ?? "").trim(),
        suggestion: String(o.suggestion ?? "").trim(),
      };
    })
    .filter((m) => m.reason || m.detail || m.suggestion)
    .slice(0, 8);

  return { summary, mistakes };
}

export async function handleAnalyzeMistakes(request: Request, env: AnalyzeEnv | undefined): Promise<Response> {
  // 支持任意 OpenAI 兼容网关：请求头（设置页配置）> 环境变量 > 默认 DeepSeek。
  // 防御：vinext 本地/生产服务器调用 worker.fetch 时 env 可能为 undefined。
  const e: AnalyzeEnv = env ?? {};
  const key = request.headers.get("x-api-key")?.trim() || aiEnvFallback(e as Record<string, unknown>, "DEEPSEEK_API_KEY");
  const baseUrl = request.headers.get("x-api-base-url")?.trim() || aiEnvFallback(e as Record<string, unknown>, "AI_BASE_URL") || DEEPSEEK_URL;
  const model = request.headers.get("x-api-model")?.trim() || aiEnvFallback(e as Record<string, unknown>, "AI_MODEL") || MODEL;
  if (!key) {
    return json({ ok: false, error: "no_api_key", message: "未配置模型密钥" }, 503);
  }

  let body: AnalyzeRequestBody;
  try {
    body = (await request.json()) as AnalyzeRequestBody;
  } catch {
    return json({ ok: false, error: "bad_request", message: "请求体不是合法 JSON" }, 400);
  }

  const subject = String(body?.subject || "").trim();
  const mistakes = Array.isArray(body?.mistakes)
    ? body.mistakes.filter((q) => q && String(q.stem || "").trim())
    : [];
  if (!subject || mistakes.length === 0) {
    return json({ ok: false, error: "no_mistakes", message: "缺少科目或已录入错题" }, 400);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: buildMessages(subject, mistakes),
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 1500,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      return json({ ok: false, error: "upstream_error", status: resp.status, message: detail.slice(0, 300) }, 502);
    }

    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data?.choices?.[0]?.message?.content ?? "";
    if (!content) return json({ ok: false, error: "empty_response", message: "模型无返回内容" }, 502);

    let parsed: AnalyzeParsed;
    try {
      parsed = parseMistakeContent(content);
    } catch {
      return json({ ok: false, error: "parse_error", message: "模型返回非预期 JSON" }, 502);
    }
    return json({ ok: true, provider: "deepseek", ...parsed });
  } catch (err) {
    const aborted = (err as Error)?.name === "AbortError";
    return json(
      { ok: false, error: aborted ? "timeout" : "network_error", message: String((err as Error)?.message || err).slice(0, 200) },
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}