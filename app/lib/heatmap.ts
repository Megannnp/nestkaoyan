import type { StudyDay } from "./types";

/**
 * 热力图派生值纯函数（从 page.tsx 抽取，便于复用与离线测试）。
 * Sidebar 消费 buildHeatmapGrid / buildHeatmapDays / formatHeatmapStart 等全部派生值。
 */

export type HeatmapDay = {
  date: string;
  completed: number;
  minutes: number;
};

const monthNames = ["", "1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const weekDays = ["一", "二", "三", "四", "五"];

/**
 * 展开 [start, end] 区间内每一天（对齐 studyDays 的学习记录）。
 */
export function buildHeatmapDays(
  start: string,
  end: string,
  studyDays: StudyDay[]
): { days: HeatmapDay[]; totalDays: number } {
  const days: HeatmapDay[] = [];
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime > endTime) {
    return { days, totalDays: 0 };
  }
  const totalDays = Math.floor((endTime - startTime) / 86400000) + 1;
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(startTime);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().slice(0, 10);
    const dayData = studyDays.find((d) => d.date === dateStr);
    days.push({ date: dateStr, completed: dayData?.completed ?? 0, minutes: dayData?.minutes ?? 0 });
  }
  return { days, totalDays };
}

/**
 * 开始日期展示文案：YYYY.MM.DD（如 2026.7.30）。
 */
export function formatHeatmapStart(start: string): string {
  return `${start.split("-")[0]}.${start.split("-")[1]}.${start.split("-")[2]}`;
}

/**
 * 周一起始偏移：星期日=6，星期一~六=0~5。
 */
export function monBasedOffsetOf(start: string): number {
  const startDayOfWeek = new Date(start).getDay();
  return startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
}

/**
 * 按周切分热力图网格（周一为首列），并生成月份标签。
 */
export function buildHeatmapGrid(
  days: HeatmapDay[],
  monBasedOffset: number
): {
  grid: (HeatmapDay | null)[][];
  weeks: number;
  months: { label: string; colSpan: number }[];
} {
  const totalSlots = days.length + monBasedOffset;
  const weeks = Math.ceil(totalSlots / 7);
  const grid: (HeatmapDay | null)[][] = [];
  for (let w = 0; w < weeks; w++) {
    const week: (HeatmapDay | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const slotIndex = w * 7 + d;
      if (slotIndex < monBasedOffset) {
        week.push(null);
      } else {
        const dayIndex = slotIndex - monBasedOffset;
        if (dayIndex < days.length) {
          week.push(days[dayIndex]);
        }
      }
    }
    grid.push(week);
  }
  const months: { label: string; colSpan: number }[] = [];
  grid.forEach((week) => {
    const firstDay = week.find((d) => d !== null);
    if (!firstDay) return;
    const month = new Date(firstDay.date).getMonth() + 1;
    const prevMonth = months.length > 0 ? months[months.length - 1] : null;
    if (!prevMonth || prevMonth.label !== monthNames[month]) {
      months.push({ label: monthNames[month], colSpan: 1 });
    } else {
      prevMonth.colSpan++;
    }
  });
  return { grid, weeks, months };
}

/**
 * 左侧星期标签（周一~周五，首尾留空）。
 */
export function buildHeatmapDayLabels(): string[] {
  const labels: string[] = [];
  for (let i = 0; i < 7; i++) {
    if (i > 0 && i < 6) labels.push(weekDays[i - 1]);
    else labels.push("");
  }
  return labels;
}

/**
 * 按创建日期统计卡片数（YYYY-MM-DD → 数量），用于热力图 tooltip。
 * 仅依赖 createdAt 字段，参数放宽为结构子集便于离线测试与复用。
 */
export function countCardsByDate(cards: Array<{ createdAt: string }>): Record<string, number> {
  return cards.reduce<Record<string, number>>((acc, card) => {
    const d = card.createdAt.slice(0, 10);
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});
}
