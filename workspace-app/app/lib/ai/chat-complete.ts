/** 客户端封装：调 OpenAI 兼容网关自由文本补全端点（SSE 流式） */
// 2026-08-05：用户可在「初始化 · 添加 API Key」步骤输入自己的 DeepSeek 密钥。
// 2026-08-20：支持任意 OpenAI 兼容网关（URL + Key + 模型），参考 NestLife AI 网关方案。
// 配置仅保存在本机 localStorage，并在请求头 x-api-key / x-api-base-url / x-api-model 中
// 发送给 worker（worker 内部使用，绝不下发）。
export const DEEPSEEK_API_KEY_STORAGE_KEY = "kaoyan_deepseek_api_key";
export const AI_BASE_URL_STORAGE_KEY = "kaoyan_ai_base_url";
export const AI_MODEL_STORAGE_KEY = "kaoyan_ai_model";

export function getStoredApiKey(): string {
  try {
    return (localStorage.getItem(DEEPSEEK_API_KEY_STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

export function setStoredApiKey(key: string): void {
  try {
    const trimmed = key.trim();
    if (trimmed) localStorage.setItem(DEEPSEEK_API_KEY_STORAGE_KEY, trimmed);
    else localStorage.removeItem(DEEPSEEK_API_KEY_STORAGE_KEY);
  } catch { /* localStorage 不可用（隐私模式）时静默 */ }
}

export function getStoredAiBaseUrl(): string {
  try {
    return (localStorage.getItem(AI_BASE_URL_STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

export function setStoredAiBaseUrl(url: string): void {
  try {
    const trimmed = url.trim();
    if (trimmed) localStorage.setItem(AI_BASE_URL_STORAGE_KEY, trimmed);
    else localStorage.removeItem(AI_BASE_URL_STORAGE_KEY);
  } catch { /* 静默 */ }
}

export function getStoredAiModel(): string {
  try {
    return (localStorage.getItem(AI_MODEL_STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

export function setStoredAiModel(model: string): void {
  try {
    const trimmed = model.trim();
    if (trimmed) localStorage.setItem(AI_MODEL_STORAGE_KEY, trimmed);
    else localStorage.removeItem(AI_MODEL_STORAGE_KEY);
  } catch { /* 静默 */ }
}

/** 组装 AI 网关请求头（设置页配置；未配置则省略，由 worker 回退环境变量） */
export function aiGatewayHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const key = getStoredApiKey();
  const url = getStoredAiBaseUrl();
  const model = getStoredAiModel();
  if (key) headers["x-api-key"] = key;
  if (url) headers["x-api-base-url"] = url;
  if (model) headers["x-api-model"] = model;
  return headers;
}

/** 服务端 AI 网关配置同步（跨设备；存 SQLite meta 表，受访问密码保护） */

/** 拉取：本机未配置时从服务端取回（换设备自动同步） */
export async function syncAiConfigFromServer(): Promise<void> {
  try {
    if (getStoredApiKey() && getStoredAiBaseUrl()) return;
    const res = await fetch("/api/ai-config", { method: "GET" });
    if (!res.ok) return;
    const body = (await res.json()) as { ok?: boolean; url?: unknown; key?: unknown; model?: unknown };
    if (!body?.ok) return;
    if (typeof body.key === "string" && body.key.trim() && !getStoredApiKey()) setStoredApiKey(body.key);
    if (typeof body.url === "string" && body.url.trim() && !getStoredAiBaseUrl()) setStoredAiBaseUrl(body.url);
    if (typeof body.model === "string" && body.model.trim() && !getStoredAiModel()) setStoredAiModel(body.model);
  } catch {
    /* 无后端/离线：静默 */
  }
}

/** 推送：保存配置时镜像到服务端（换设备可用） */
export async function mirrorAiConfigToServer(): Promise<void> {
  try {
    await fetch("/api/ai-config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        key: getStoredApiKey(),
        url: getStoredAiBaseUrl(),
        model: getStoredAiModel(),
      }),
    });
  } catch {
    /* 无后端/离线：静默 */
  }
}

export interface ChatCompleteResult {
  ok: boolean;
  provider?: string;
  content?: string;
  error?: string;
  message?: string;
}

export function chatErrorReason(error?: string): string {
  switch (error) {
    case "no_api_key": return "未配置模型密钥";
    case "timeout": return "模型响应超时";
    case "upstream_error": return "模型服务返回错误";
    case "empty_response": return "模型无返回内容";
    case "network_error": return "网络错误";
    default: return "模型调用失败";
  }
}

export interface ChatStreamOptions {
  system: string;
  user: string;
  /** 每个增量块的回调（typed by server SSE: { content }） */
  onDelta?: (delta: string) => void;
  /** 流结束回调（无论成功/失败） */
  onDone?: (result: ChatCompleteResult) => void;
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 流式对话：调 /api/chat-complete（SSE），逐块回调 onDelta。
 * 完整内容在 onDone 中以 ChatCompleteResult 返回（ok=false 时带 error）。
 */
export async function chatCompleteStream(options: ChatStreamOptions): Promise<void> {
  const { system, user, onDelta, onDone, signal, temperature, maxTokens } = options;
  if (!user.trim()) {
    onDone?.({ ok: false, error: "no_input" });
    return;
  }
  let full = "";
  let settled = false;
  const finish = (result: ChatCompleteResult) => {
    if (settled) return;
    settled = true;
    onDone?.(result);
  };

  try {
    const resp = await fetch("/api/chat-complete", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // 携带用户自配网关（URL/模型/Key；无则忽略，由 worker 回退环境变量）
        ...aiGatewayHeaders(),
      },
      body: JSON.stringify({ system, user, temperature, maxTokens }),
      signal,
    });
    if (!resp.ok) {
      const data = (await resp.json().catch(() => null)) as Partial<ChatCompleteResult> | null;
      finish({ ok: false, error: data?.error ?? `http_${resp.status}`, message: data?.message });
      return;
    }
    const contentType = resp.headers.get("content-type") ?? "";
    if (!contentType.includes("text/event-stream") || !resp.body) {
      // 兼容非流式 JSON 响应（旧 worker / 本地 mock）
      const data = (await resp.json().catch(() => null)) as Partial<ChatCompleteResult> | null;
      if (!data || !data.ok) {
        finish({ ok: false, error: data?.error ?? "empty_response", message: data?.message });
        return;
      }
      if (data.content) {
        full = data.content;
        onDelta?.(data.content);
      }
      finish({ ok: true, provider: data.provider, content: data.content ?? "" });
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) {
        for (const raw of event.split("\n")) {
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload) as { content?: string; choices?: { delta?: { content?: string } }[] };
            // 兼容两种 SSE 结构：worker 转发格式 `{content}` 与 DeepSeek 原生格式 `{choices:[{delta:{content}}]}`
            const delta = parsed?.content
              ?? parsed?.choices?.[0]?.delta?.content
              ?? "";
            if (delta) {
              full += delta;
              onDelta?.(delta);
            }
          } catch {
            // 忽略无法解析的块
          }
        }
      }
    }
    if (full.trim()) {
      finish({ ok: true, provider: "deepseek", content: full });
    } else {
      finish({ ok: false, error: "empty_response" });
    }
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      finish({ ok: false, error: "aborted", message: "请求已取消" });
    } else {
      finish({ ok: false, error: "network_error", message: String((err as Error)?.message || err) });
    }
  }
}

/** 保留非流式封装（用于不需要打字机效果的场景，例如本地降级） */
export async function chatComplete(system: string, user: string): Promise<ChatCompleteResult> {
  return new Promise((resolve) => {
    void chatCompleteStream({
      system,
      user,
      onDone: (result) => resolve(result),
    });
  });
}
