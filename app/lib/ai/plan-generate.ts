import type { KnowledgeNode, Question, Subject, Task, StudyDay } from "../types";

export interface PlanTask { title: string; subject: string; core: string; knowledge: string; round: string; layer: string; minutes: number; reason: string; priority: number }
export interface PlanResult { ok: boolean; provider?: string; summary: string; tasks: PlanTask[]; error?: string; message?: string }

export function planErrorReason(error?: string): string {
  switch (error) {
    case "no_api_key": return "未配置模型密钥";
    case "no_context": return "暂无科目或知识点上下文";
    case "timeout": return "模型响应超时";
    case "parse_error": return "模型返回格式异常";
    case "upstream_error": return "模型服务返回错误";
    default: return "模型调用失败";
  }
}

export interface PlanContext {
  subjects: Subject[];
  nodes: KnowledgeNode[];
  /** 真题（可选）：用于提取高频考点出题方向 */
  questions?: Question[];
  /** 今日已完成的真实任务（可选）：用于避免重复安排已完成内容 */
  tasks?: Task[];
  /** 近期学习天数统计（可选）：用于感知学习者节奏 */
  studyDays?: StudyDay[];
}

export async function generatePlan(ctx: PlanContext): Promise<PlanResult> {
  const { subjects, nodes, questions = [], tasks = [], studyDays = [] } = ctx;
  if (subjects.length === 0 && nodes.length === 0) {
    return { ok: false, summary: "", tasks: [], error: "no_context" };
  }
  const payload = {
    subjects: subjects.map((s) => ({ name: s.name, weeklyHours: s.weeklyHours })),
    knowledge: nodes.slice(0, 20).map((n) => ({
      subject: n.subject, core: n.core, knowledge: n.knowledge,
      mistakes: n.mistakes, risk: n.reviewRisk, masteryScore: n.masteryScore,
    })),
    questions: questions.slice(0, 30).map((q) => ({
      year: q.year, subject: q.subject, number: q.number, core: q.core, knowledge: q.knowledge, result: q.result,
    })),
    tasks: tasks.filter((t) => t.done).slice(0, 20).map((t) => ({
      title: t.title, subject: t.subject, core: t.core, minutes: Number(t.actualMinutes || t.minutes || 0), completedAt: t.completedAt,
    })),
    studyDays: studyDays.slice(-14).map((d) => ({ date: d.date, minutes: d.minutes, completed: d.completed })),
  };
  try {
    const resp = await fetch("/api/plan-generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await resp.json().catch(() => null)) as Partial<PlanResult> | null;
    if (!resp.ok || !data || !data.ok) {
      return { ok: false, summary: "", tasks: [], error: data?.error ?? `http_${resp.status}`, message: data?.message };
    }
    return { ok: true, provider: data.provider, summary: data.summary ?? "", tasks: data.tasks ?? [] };
  } catch (err) {
    return { ok: false, summary: "", tasks: [], error: "network_error", message: String((err as Error)?.message || err) };
  }
}