/**
 * 通用 DeepSeek 文本补全端点（/api/chat-complete）——SSE 流式
 * 供「笔记生成」「资料内容讲解」等自由文本意图复用。
 * key 只在服务端读取；缺 key → 503；失败由客户端诚实降级。
 *
 * 2026-08-03：改为 stream:true + SSE 转发，前端逐块渲染（打字机效果）。
 */

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const TIMEOUT_MS = 60_000;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** 将上游 DeepSeek SSE 流解析为 `data: {"content":"..."}` 转发给浏览器 */
function buildSseStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const reader = upstream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const raw of lines) {
            const line = raw.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (delta) {
                // 透传原始 delta 给前端（前端与 [DONE] 均不依赖服务端聚合）
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`));
              }
            } catch {
              // 忽略无法解析的行（如 keep-alive 注释行）
            }
          }
        }
      } catch {
        // 客户端断开或上游中断 → 结束流
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
}

export async function handleChatComplete(request: Request, env: { DEEPSEEK_API_KEY?: string }): Promise<Response> {
  // 2026-08-05：支持用户在前端「添加 API Key」步骤输入自己的密钥。
  // 优先使用请求头 x-api-key（用户自配密钥），其次回退到服务端 env.DEEPSEEK_API_KEY。
  // 密钥只在 worker 内使用，绝不写入响应或下发前端。
  const userKey = request.headers.get("x-api-key")?.trim();
  const key = userKey || env.DEEPSEEK_API_KEY;
  if (!key) return json({ ok: false, error: "no_api_key", message: "未配置模型密钥" }, 503);

  let body: { system?: string; user: string; temperature?: number; maxTokens?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "bad_request", message: "请求体不是合法 JSON" }, 400);
  }
  const user = String(body?.user || "").trim();
  if (!user) return json({ ok: false, error: "no_input", message: "缺少 user 输入" }, 400);
  const system = String(body?.system || "").trim();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: user },
        ],
        temperature: typeof body.temperature === "number" ? body.temperature : 0.4,
        max_tokens: typeof body.maxTokens === "number" ? body.maxTokens : 1200,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      return json({ ok: false, error: "upstream_error", status: resp.status, message: detail.slice(0, 300) }, 502);
    }
    if (!resp.body) {
      return json({ ok: false, error: "empty_response", message: "模型无返回内容" }, 502);
    }

    return new Response(buildSseStream(resp.body), {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        "x-accel-buffering": "no",
      },
    });
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