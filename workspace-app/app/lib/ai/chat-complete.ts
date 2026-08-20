/** 客户端封装：调 DeepSeek 自由文本补全端点（SSE 流式） */
// 2026-08-05：用户可在「初始化 · 添加 API Key」步骤输入自己的 DeepSeek 密钥。
// 密钥仅保存在本机 localStorage，并在请求头 x-api-key 中发送给 worker（worker 内部使用，绝不下发）。
export const DEEPSEEK_API_KEY_STORAGE_KEY = "kaoyan_deepseek_api_key";

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

/** 服务端密钥同步（跨设备；存 SQLite meta 表，受访问密码保护） */

/** 拉取：本机无密钥时从服务端取回（换设备自动同步） */
export async function syncApiKeyFromServer(): Promise<void> {
  try {
    if (getStoredApiKey()) return;
    const res = await fetch("/api/ai-key", { method: "GET" });
    if (!res.ok) return;
    const body = (await res.json()) as { ok?: boolean; key?: unknown };
    if (body?.ok && typeof body.key === "string" && body.key.trim()) {
      setStoredApiKey(body.key);
    }
  } catch {
    /* 无后端/离线：静默 */
  }
}

/** 推送：保存密钥时镜像到服务端（换设备可用） */
export async function mirrorApiKeyToServer(): Promise<void> {
  try {
    await fetch("/api/ai-key", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: getStoredApiKey() }),
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
        // 2026-08-05：携带用户自配密钥（无则忽略，由 worker 回退 env.DEEPSEEK_API_KEY）
        ...(getStoredApiKey() ? { "x-api-key": getStoredApiKey() } : {}),
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