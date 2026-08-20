"use strict";
import { aiEnvFallback } from "./ai-env.ts";
interface E { DEEPSEEK_API_KEY?: string; AI_BASE_URL?: string; AI_MODEL?: string }
interface TI { title?: string; subject?: string; core?: string; knowledge?: string; mistakes?: number; risk?: string; masteryScore?: number }
interface SI { name: string; weeklyHours?: number }
interface QI { year?: string; subject?: string; number?: string; core?: string; knowledge?: string; result?: string }
interface TDI { title?: string; subject?: string; core?: string; minutes?: number; completedAt?: string }
interface SDI { date?: string; minutes?: number; completed?: number }
interface B { subjects: SI[]; knowledge: TI[]; questions?: QI[]; tasks?: TDI[]; studyDays?: SDI[] }
interface GT { title: string; subject: string; core: string; knowledge: string; round: string; layer: string; minutes: number; reason: string; priority: number }
export interface PlanParsed { summary: string; tasks: GT[] }
const URL_ = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const TO = 30_000, MAXK = 20, MAXT = 8;
function j(data: unknown, status = 200): Response { return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } }) }
function msgs(subs: SI[], kn: TI[], qs: QI[], done: TDI[], days: SDI[]) {
  const ss = subs.map((s) => `${s.name}${s.weeklyHours ? `（每周${s.weeklyHours}h）` : ""}`).join("、") || "（未设置科目）";
  const kl = kn.slice(0, MAXK).map((k, i) => `${i + 1}. ${k.subject || ""} / ${k.core || ""} / ${k.knowledge || k.title || "未命名"}${k.risk ? ` 风险:${k.risk}` : ""}${typeof k.mistakes === "number" && k.mistakes > 0 ? ` 错题:${k.mistakes}` : ""}${typeof k.masteryScore === "number" ? ` 掌握度:${k.masteryScore}%` : ""}`).join("\n") || "（暂无知识点）";
  // 2026-08-03 增强：真题高频考点 + 学习者状态进 prompt
  const ql = qs.slice(0, 30).map((q, i) => `${i + 1}. ${q.year || ""} ${q.subject || ""} 第${q.number || ""}题 / ${q.core || ""} / ${q.knowledge || ""}${q.result === "错误" ? "（错）" : q.result === "正确" ? "（对）" : ""}`).join("\n") || "（暂无真题）";
  const dl = done.slice(0, 20).map((t) => `· ${t.title}${t.subject ? `（${t.subject}）` : ""}${t.minutes ? ` ${t.minutes}分钟` : ""}`).join("\n") || "（今日暂无已完成任务）";
  const sdl = days.slice(-14).map((d) => `· ${d.date}：${d.minutes ?? 0}分钟 / 完成${d.completed ?? 0}项`).join("\n") || "（暂无学习记录）";
  const sys = "你是资深考研辅导专家。根据给定科目的知识点掌握状态/错题/每周时长，以及真题覆盖的高频考点和近期学习状态，生成今日 1-4 个可执行任务。只依据给定内容，严禁编造。优先级：真题高频考点且未掌握>高风险>错题多>掌握度低。每任务≤120分钟。只输出 JSON 对象。";
  const usr = `考试科目：${ss}\n时间：今日\n知识点状态：\n${kl}\n近14天学习记录：\n${sdl}\n今日已完成：\n${dl}\n真题（含做题结果）：\n${ql}\n输出 json：{"summary":"60字内总结","tasks":[{"title":"任务名","subject":"科目","core":"七核","knowledge":"知识点","round":"轮次","layer":"层级","minutes":1-120,"reason":"原因","priority":1}]}。tasks 按 priority 升序至多8条；无依据可返回空数组并在 summary 说明。全部中文。`;
  return [{ role: "system", content: sys }, { role: "user", content: usr }];
}
export function parsePlanContent(c: string): PlanParsed {
  const d = JSON.parse(c) as unknown;
  if (!d || typeof d !== "object" || Array.isArray(d)) throw new Error("非对象 JSON");
  const o = d as Record<string, unknown>;
  const tasks: GT[] = (Array.isArray(o.tasks) ? o.tasks : []).map((t) => {
    const x = (t ?? {}) as Record<string, unknown>;
    const mn = Number(x.minutes), pr = Number(x.priority);
    return {
      title: String(x.title ?? "").trim().slice(0, 80),
      subject: String(x.subject ?? "").trim().slice(0, 40),
      core: String(x.core ?? "").trim().slice(0, 40),
      knowledge: String(x.knowledge ?? "").trim().slice(0, 80),
      round: String(x.round ?? "第一轮").trim().slice(0, 20),
      layer: String(x.layer ?? "Layer 1").trim().slice(0, 20),
      minutes: Number.isFinite(mn) ? Math.min(120, Math.max(1, Math.round(mn))) : 60,
      reason: String(x.reason ?? "").trim().slice(0, 200),
      priority: Number.isFinite(pr) ? Math.max(1, Math.round(pr)) : 1,
    };
  }).filter((t) => t.title).sort((a, b) => a.priority - b.priority).slice(0, MAXT);
  return { summary: String(o.summary ?? "").trim().slice(0, 200), tasks };
}
export async function handlePlanGenerate(req: Request, env: E | undefined): Promise<Response> {
  // 支持任意 OpenAI 兼容网关：请求头（设置页配置）> 环境变量 > 默认 DeepSeek。
  // 防御：vinext 本地/生产服务器调用 worker.fetch 时 env 可能为 undefined。
  const e: E = env ?? {};
  const key = req.headers.get("x-api-key")?.trim() || aiEnvFallback(e as Record<string, unknown>, "DEEPSEEK_API_KEY");
  const baseUrl = req.headers.get("x-api-base-url")?.trim() || aiEnvFallback(e as Record<string, unknown>, "AI_BASE_URL") || URL_;
  const model = req.headers.get("x-api-model")?.trim() || aiEnvFallback(e as Record<string, unknown>, "AI_MODEL") || MODEL;
  if (!key) return j({ ok: false, error: "no_api_key", message: "未配置模型密钥" }, 503);
  let b: B;
  try { b = (await req.json()) as B } catch { return j({ ok: false, error: "bad_request" }, 400) }
  const subs = Array.isArray(b?.subjects) ? b.subjects.filter((s) => s && String(s.name || "").trim()) : [];
  const kn = Array.isArray(b?.knowledge) ? b.knowledge.filter((k) => k && (String(k.knowledge || "").trim() || String(k.title || "").trim())) : [];
  if (subs.length === 0 && kn.length === 0) return j({ ok: false, error: "no_context", message: "缺少科目或知识点上下文" }, 400);
  const qs = Array.isArray(b?.questions) ? b.questions.filter((q) => q && (String(q.knowledge || "").trim() || String(q.core || "").trim())) : [];
  const done = Array.isArray(b?.tasks) ? b.tasks.filter((t) => t && String(t.title || "").trim()) : [];
  const days = Array.isArray(b?.studyDays) ? b.studyDays.filter((d) => d && String(d.date || "").trim()) : [];
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TO);
  try {
    const resp = await fetch(baseUrl, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ model, messages: msgs(subs, kn, qs, done, days), response_format: { type: "json_object" }, temperature: 0.3, max_tokens: 1500 }), signal: ac.signal });
    if (!resp.ok) { const detail = await resp.text().catch(() => ""); return j({ ok: false, error: "upstream_error", status: resp.status, message: detail.slice(0, 300) }, 502) }
    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data?.choices?.[0]?.message?.content ?? "";
    if (!content) return j({ ok: false, error: "empty_response" }, 502);
    let parsed: PlanParsed;
    try { parsed = parsePlanContent(content) } catch { return j({ ok: false, error: "parse_error" }, 502) }
    return j({ ok: true, provider: "deepseek", ...parsed });
  } catch (err) {
    const ab = (err as Error)?.name === "AbortError";
    return j({ ok: false, error: ab ? "timeout" : "network_error", message: String((err as Error)?.message || err).slice(0, 200) }, 502);
  } finally { clearTimeout(timer) }
}