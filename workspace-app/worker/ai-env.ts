/**
 * AI 网关配置回退：env 绑定 > process.env（兼容 vinext 本地/容器服务器）。
 * env 绑定用于 Cloudflare 部署；process.env 用于本地与 Docker（nodejs_compat）。
 */
export function aiEnvFallback(env: Record<string, unknown>, key: string): string {
  const fromEnv = env[key];
  if (typeof fromEnv === "string" && fromEnv) return fromEnv;
  if (typeof process !== "undefined" && process.env?.[key]) return process.env[key] as string;
  return "";
}