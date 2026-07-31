// @ts-expect-error - cloudflare:workers types only available in Cloudflare Workers runtime
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  // Safely check if we're in a Cloudflare Workers environment
  const cfEnv = typeof env !== 'undefined' ? env as any : null;
  if (!cfEnv || !cfEnv.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(cfEnv.DB, { schema });
}
