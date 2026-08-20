/**
 * 真题分析端点（首个真 AI 意图）：历年真题 → 高频考点/七核 + 建议知识图谱节点。
 *
 * 设计约束：
 *   - API key 只在服务端读取（env.DEEPSEEK_API_KEY），绝不下发前端。
 *   - DeepSeek OpenAI 兼容接口 + response_format:json_object 结构化输出。
 *   - 缺 key → 503（客户端据此优雅降级到演示，不报错崩溃）。
 *   - provider 细节集中在此，后续切 Qwen(DashScope)/GLM 只改 URL/model/key 名。
 */

interface AnalyzeEnv {
  DEEPSEEK_API_KEY?: string;
  /** OpenAI 兼容网关地址（可选；默认 DeepSeek） */
  AI_BASE_URL?: string;
  /** 默认模型名（可选；默认 deepseek-chat） */
  AI_MODEL?: string;
}

interface QuestionInput {
  year?: string;
  number?: string;
  core?: string;
  stem: string;
}

interface AnalyzeRequestBody {
  subject: string;
  questions: QuestionInput[];
}

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const TIMEOUT_MS = 30_000;
/** 控制 prompt 体积与成本：最多分析这么多题、每题截断长度 */
const MAX_QUESTIONS = 60;
const MAX_STEM_CHARS = 400;

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
export interface AnalyzeParsed {
  cores: AnalyzeCore[];
  nodes: AnalyzeNode[];
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function buildMessages(subject: string, questions: QuestionInput[]) {
  const list = questions
    .slice(0, MAX_QUESTIONS)
    .map((q, i) => {
      const ref = [q.year, q.number ? `第${q.number}题` : ""].filter(Boolean).join(" ") || `题${i + 1}`;
      return `【${ref}】${String(q.stem || "").slice(0, MAX_STEM_CHARS)}`;
    })
    .join("\n");

  const system =
    "你是资深考研辅导专家。任务：分析给定科目的历年真题，提取高频考点并聚合为少数几个" +
    "“核心知识主题”（七核思路：把零散考点归并为 5-8 个核心主题），并给出建议纳入知识图谱的节点。" +
    "只依据给定题目，严禁编造题目中不存在的考点。必须只输出一个 JSON 对象，不要任何多余文字或解释。";

  const user =
    `科目：${subject}\n以下是该科目的历年真题（每行一题）：\n${list}\n\n` +
    "请输出 json，结构如下：\n" +
    '{\n' +
    '  "cores": [{"name": "核心主题名", "frequency": 出现题目数(整数), "questionRefs": ["题目引用"]}],\n' +
    '  "nodes": [{"core": "所属核心主题", "branch": "分支(可空字符串)", "knowledge": "具体知识点", "reason": "重要性/依据哪些题"}]\n' +
    "}\n" +
    "要求：cores 按 frequency 从高到低排序、至多 8 个；nodes 至多 20 个；全部用中文；不得杜撰题目之外的考点。";

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/**
 * 解析并防御性校验模型返回的 JSON 文本（导出以便离线单测，不打网络）。
 * 解析失败或结构非法时抛错，由调用方转成 502。
 */
export function parseAnalyzeContent(content: string): AnalyzeParsed {
  const data = JSON.parse(content) as unknown;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("模型返回非对象 JSON");
  const obj = data as Record<string, unknown>;

  const coresRaw = Array.isArray(obj.cores) ? obj.cores : [];
  const nodesRaw = Array.isArray(obj.nodes) ? obj.nodes : [];

  const cores: AnalyzeCore[] = coresRaw
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      const freq = Number(o.frequency);
      return {
        name: String(o.name ?? "").trim(),
        frequency: Number.isFinite(freq) ? Math.max(0, Math.round(freq)) : 0,
        questionRefs: Array.isArray(o.questionRefs) ? o.questionRefs.map((r) => String(r)).slice(0, 20) : [],
      };
    })
    .filter((c) => c.name)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 8);

  const nodes: AnalyzeNode[] = nodesRaw
    .map((n) => {
      const o = (n ?? {}) as Record<string, unknown>;
      return {
        core: String(o.core ?? "").trim(),
        branch: String(o.branch ?? "").trim(),
        knowledge: String(o.knowledge ?? "").trim(),
        reason: String(o.reason ?? "").trim(),
      };
    })
    .filter((n) => n.knowledge)
    .slice(0, 20);

  return { cores, nodes };
}

export async function handleAnalyzeExam(request: Request, env: AnalyzeEnv | undefined): Promise<Response> {
  // 支持任意 OpenAI 兼容网关：请求头（设置页配置）> 环境变量 > 默认 DeepSeek。
  // 防御：vinext 本地/生产服务器调用 worker.fetch 时 env 可能为 undefined。
  const e: AnalyzeEnv = env ?? {};
  const key = request.headers.get("x-api-key")?.trim() || e.DEEPSEEK_API_KEY;
  const baseUrl = request.headers.get("x-api-base-url")?.trim() || e.AI_BASE_URL || DEEPSEEK_URL;
  const model = request.headers.get("x-api-model")?.trim() || e.AI_MODEL || MODEL;
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
  const questions = Array.isArray(body?.questions)
    ? body.questions.filter((q) => q && String(q.stem || "").trim())
    : [];
  if (!subject || questions.length === 0) {
    return json({ ok: false, error: "no_questions", message: "缺少科目或已录入真题" }, 400);
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
        messages: buildMessages(subject, questions),
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 2000,
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
      parsed = parseAnalyzeContent(content);
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
