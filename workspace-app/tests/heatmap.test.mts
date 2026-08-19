import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildHeatmapDays,
  formatHeatmapStart,
  monBasedOffsetOf,
  buildHeatmapGrid,
  buildHeatmapDayLabels,
  countCardsByDate,
} from "../app/lib/heatmap.ts";

test("buildHeatmapDays：展开日期并合并 studyDays 学习记录", () => {
  const { days, totalDays } = buildHeatmapDays(
    "2026-07-30",
    "2026-08-01",
    [
      { date: "2026-07-31", completed: 3, minutes: 120 },
    ]
  );
  assert.equal(totalDays, 3);
  assert.deepEqual(days, [
    { date: "2026-07-30", completed: 0, minutes: 0 },
    { date: "2026-07-31", completed: 3, minutes: 120 },
    { date: "2026-08-01", completed: 0, minutes: 0 },
  ]);
});

test("buildHeatmapDays：start > end 或非法日期 → 空数组不抛错", () => {
  assert.deepEqual(buildHeatmapDays("2026-08-02", "2026-07-30", []).days, []);
  assert.deepEqual(buildHeatmapDays("invalid", "2026-08-02", []).days, []);
  assert.deepEqual(buildHeatmapDays("2026-08-02", "invalid", []).days, []);
});

test("formatHeatmapStart：YYYY-MM-DD → YYYY.M.DD（保留前导零，与 head 版 page.tsx 行为一致）", () => {
  assert.equal(formatHeatmapStart("2026-07-30"), "2026.07.30");
  assert.equal(formatHeatmapStart("2026-11-05"), "2026.11.05");
});

test("monBasedOffsetOf：周一对齐偏移（周日=6，其余=星期-1）", () => {
  // 2026-07-30 是周四
  assert.equal(monBasedOffsetOf("2026-07-30"), 3);
  // 2026-08-02 是周日
  assert.equal(monBasedOffsetOf("2026-08-02"), 6);
});

test("monBasedOffsetOf：无效日期 → 0（不返回 NaN）", () => {
  assert.equal(monBasedOffsetOf(""), 0);
  assert.equal(monBasedOffsetOf("invalid"), 0);
  assert.equal(Number.isNaN(monBasedOffsetOf("")), false);
});

test("buildHeatmapGrid：周一为首列，首行留空，月份标签合并", () => {
  const { days } = buildHeatmapDays("2026-07-30", "2026-08-05", []);
  // 2026-07-30=周四，offset=3 → 首行 3 格空
  const { grid, weeks, months } = buildHeatmapGrid(days, monBasedOffsetOf("2026-07-30"));
  const firstWeek = grid[0];
  assert.equal(firstWeek.length, 7);
  assert.equal(firstWeek.filter((d) => d === null).length, 3);
  assert.equal(firstWeek[3]?.date, "2026-07-30");
  assert.ok(firstWeek[6]?.date === "2026-08-02" || firstWeek[6] === null);
  assert.ok(weeks >= 1);
  // 月份标签只含 7月/8月
  for (const m of months) assert.ok(["7月", "8月"].includes(m.label));
});

test("buildHeatmapDayLabels：首末留空，中间周一~周五", () => {
  assert.deepEqual(buildHeatmapDayLabels(), ["", "一", "二", "三", "四", "五", ""]);
});

test("countCardsByDate：按 createdAt 前 10 位统计数量", () => {
  const cards = [
    { createdAt: "2026-07-30T10:00:00.000Z" },
    { createdAt: "2026-07-30T12:00:00.000Z" },
    { createdAt: "2026-08-01T08:00:00.000Z" },
  ];
  assert.deepEqual(countCardsByDate(cards), { "2026-07-30": 2, "2026-08-01": 1 });
});

test("countCardsByDate：空数组 → 空对象", () => {
  assert.deepEqual(countCardsByDate([]), {});
});