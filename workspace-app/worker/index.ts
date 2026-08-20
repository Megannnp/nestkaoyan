/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleAnalyzeExam } from "./analyze-exam";
import { handleAnalyzeMistakes } from "./analyze-mistakes";
import { handlePlanGenerate } from "./plan-generate";
import { handleChatComplete } from "./chat-complete";
import { handleWorkspace } from "./workspace";
import { handleFiles } from "./files";

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  /** 本地 SQLite 同步服务地址（Docker 部署：http://kaoyan-db:3001；也可经 process.env 注入） */
  WORKSPACE_DB_URL?: string;
  /** DeepSeek 真题分析密钥（服务端 secret / 本地 .dev.vars；绝不下发前端） */
  DEEPSEEK_API_KEY?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 真题分析 API（首个真 AI 意图）——key 只在服务端使用
    if (url.pathname === "/api/analyze-exam" && request.method === "POST") {
      return handleAnalyzeExam(request, env);
    }

    if (url.pathname === "/api/analyze-mistakes" && request.method === "POST") {
      return handleAnalyzeMistakes(request, env);
    }

    if (url.pathname === "/api/plan-generate" && request.method === "POST") {
      return handlePlanGenerate(request, env);
    }

    if (url.pathname === "/api/chat-complete" && request.method === "POST") {
      return handleChatComplete(request, env);
    }

    if (url.pathname === "/api/workspace") {
      return handleWorkspace(request, env);
    }

    if (url.pathname.startsWith("/api/files/")) {
      return handleFiles(request, env);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
