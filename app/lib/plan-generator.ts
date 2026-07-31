/**
 * Plan Generator — 计划生成引擎
 *
 * 根据考试目标的每日可用时间动态计算任务时长，
 * 而非使用固定默认值（TASK.defaultPlanMinutes = 60）。
 *
 * 使用方式：
 *   const plan = generatePlan(exam, subjects, tasks);
 */

import { TASK } from "./rules";
import type { ExamGoal, Task, Subject } from "./types";

// ============================================================
// 时间计算
// ============================================================

/**
 * 判断今天是否为周末
 * 0=周日, 6=周六
 */
function isWeekend(): boolean {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}

/**
 * 根据 ExamGoal 计算单日可用学习分钟数
 * - weekdayHours: 工作日每天可用小时数
 * - weekendHours: 周末每天可用小时数
 * - weeklyDays: 每周学习天数
 */
export function getDailyAvailableMinutes(exam: ExamGoal): number {
  const weekdayHours = parseFloat(exam.weekdayHours) || 0;
  const weekendHours = parseFloat(exam.weekendHours) || 0;
  const weeklyDays = parseInt(exam.weeklyDays, 10) || 6;

  // 如果两种都没设置，fallback 到默认值
  if (weekdayHours === 0 && weekendHours === 0) {
    return TASK.defaultPlanMinutes;
  }

  const hoursToday = isWeekend() ? weekendHours : weekdayHours;
  // 如果今天类型无数据，使用另一类型的数据
  const effectiveHours = hoursToday > 0 ? hoursToday : (weekdayHours || weekendHours);

  // 将小时转为分钟，并考虑每周学习天数做加权调整
  let minutes = effectiveHours * 60;

  // 如果每周只学几天，分摊到每天的平均时间应适当调整
  if (weeklyDays > 0 && weeklyDays < 7) {
    const dailyAverage = ((weekdayHours * 5) + (weekendHours * 2)) / weeklyDays;
    minutes = dailyAverage * 60;
  }

  // 保证最小值和最大值
  return Math.max(15, Math.min(240, Math.round(minutes)));
}

/**
 * 计算单个任务的建议时长（分钟）
 * - 根据当日可用总时间和任务数量动态分配
 * - 如果任务数量为0，使用可用时间的 1/3（默认3个任务）
 */
export function getTaskMinutes(exam: ExamGoal, taskCount: number): number {
  const totalMinutes = getDailyAvailableMinutes(exam);
  const count = taskCount || 3; // fallback 到 3 个任务
  return Math.max(15, Math.round(totalMinutes / count));
}

// ============================================================
// 计划生成
// ============================================================

export interface GeneratePlanOptions {
  /** 是否压缩计划（时间不够时） */
  compact?: boolean;
  /** 覆盖任务数量 */
  taskCount?: number;
}

/**
 * 生成今日学习计划
 *
 * @param exam  考试目标（包含 weekdayHours/weekendHours）
 * @param subjects 当前科目列表
 * @param tasks    现有任务列表（用于追加新任务时）
 * @param options  可选参数
 * @returns 包含建议任务时长和可用时间的计划信息
 */
export function generatePlan(
  exam: ExamGoal,
  subjects: Subject[],
  tasks: Task[],
  options: GeneratePlanOptions = {}
): {
  dailyMinutes: number;
  taskMinutes: number;
  suggestedTaskCount: number;
  isWeekend: boolean;
  weekdayHours: number;
  weekendHours: number;
} {
  const dailyMinutes = getDailyAvailableMinutes(exam);
  const pendingTasks = tasks.filter((t) => !t.done && t.status === "待开始");
  const taskCount = options.taskCount || pendingTasks.length || 3;
  const taskMinutes = getTaskMinutes(exam, options.compact ? taskCount + 2 : taskCount);

  return {
    dailyMinutes,
    taskMinutes,
    suggestedTaskCount: Math.min(taskCount, Math.floor(dailyMinutes / taskMinutes)),
    isWeekend: isWeekend(),
    weekdayHours: parseFloat(exam.weekdayHours) || 0,
    weekendHours: parseFloat(exam.weekendHours) || 0,
  };
}

// ============================================================
// 工具：更新任务的 estimatedCompletionMinutes
// ============================================================

/**
 * 为指定任务列表重新计算 estimatedCompletionMinutes
 */
export function updateTaskEstimates(tasks: Task[], taskMinutes: number): Task[] {
  return tasks.map((task) => ({
    ...task,
    estimatedCompletionMinutes: taskMinutes,
  }));
}

// ============================================================
// 工具：格式化输出
// ============================================================

/**
 * 生成计划摘要文本（适合 AI 提示或日志输出）
 */
export function formatPlanSummary(plan: ReturnType<typeof generatePlan>): string {
  const dayType = plan.isWeekend ? "周末" : "工作日";
  return (
    `今日学习计划摘要\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `日期类型：${dayType}\n` +
    `工作日可用：${plan.weekdayHours}h/天\n` +
    `周末可用：${plan.weekendHours}h/天\n` +
    `今日可用：${plan.dailyMinutes} 分钟\n` +
    `建议任务数：${plan.suggestedTaskCount}\n` +
    `每任务时长：${plan.taskMinutes} 分钟\n` +
    `━━━━━━━━━━━━━━━━`
  );
}