/**
 * 通用 OpenAI 兼容文本补全端点（/api/chat-complete）——SSE 流式
 * 供「笔记生成」「资料内容讲解」等自由文本意图复用。
 * key 只在服务端读取；缺 key → 503；失败由客户端诚实降级。
 *
 * 网关可配置（参考 NestLife 的 AI 网关方案）：
 *   - 客户端请求头 x-api-base-url / x-api-model / x-api-key（设置页配置）
 *   - 回退环境变量（env 绑定 + process.env）AI_BASE_URL / AI_MODEL / DEEPSEEK_API_KEY
 *   - 默认 DeepSeek
 *
 * 2026-08-03：改为 stream:true + SSE 转发，前端逐块渲染（打字机效果）。
 */

import { aiEnvFallback } from "./ai-env.ts";

const DEFAULT_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-chat";
const TIMEOUT_MS = 60_000;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

interface ChatEnv {
  DEEPSEEK_API_KEY?: string;
  /** OpenAI 兼容网关地址（可选；默认 https://api.deepseek.com/chat/completions） */
  AI_BASE_URL?: string;
  /** 默认模型名（可选；默认 deepseek-chat） */
  AI_MODEL?: string;
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

export async function handleChatComplete(request: Request, env: ChatEnv | undefined): Promise<Response> {
  // 2026-08-05：支持用户在前端「添加 API Key」步骤输入自己的密钥；
  // 2026-08-20：支持任意 OpenAI 兼容网关（URL + 模型 + Key 均可客户端配置）。
  // 优先级：请求头（设置页配置）> 环境变量 > 默认 DeepSeek。
  // 防御：vinext 本地/生产服务器调用 worker.fetch 时 env 可能为 undefined。
  const e: ChatEnv = env ?? {};
  const userKey = request.headers.get("x-api-key")?.trim();
  const userUrl = request.headers.get("x-api-base-url")?.trim();
  const userModel = request.headers.get("x-api-model")?.trim();
  const key = userKey || aiEnvFallback(e as Record<string, unknown>, "DEEPSEEK_API_KEY");
  const baseUrl = userUrl || aiEnvFallback(e as Record<string, unknown>, "AI_BASE_URL") || DEFAULT_URL;
  const model = userModel || aiEnvFallback(e as Record<string, unknown>, "AI_MODEL") || DEFAULT_MODEL;
  if (!key) return json({ ok: false, error: "no_api_key", message: "未配置模型密钥" }, 503);
  if (!/^https?:\/\//i.test(baseUrl)) {
    return json({ ok: false, error: "bad_gateway_url", message: "网关地址需以 http(s):// 开头" }, 400);
  }

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
    const resp = await fetch(baseUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
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