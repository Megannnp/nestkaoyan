/**
 * useHeatmap — 热力图数据计算 Hook
 *
 * 基于 studyDays 计算热力图所需数据，
 * 避免在渲染时重复计算。
 */

"use client";

import { useMemo } from "react";
import type { StudyDay } from "../types";
import { HEATMAP, MAX_STUDY_DAYS } from "../rules";

export interface HeatmapCell {
  date: string;
  count: number;
  minutes: number;
  level: number;
}

export interface HeatmapData {
  cells: HeatmapCell[];
  maxCount: number;
  weeks: HeatmapCell[][];
}

function getLevel(count: number): number {
  for (let i = HEATMAP.levels.length - 1; i >= 0; i--) {
    if (count >= HEATMAP.levels[i].min) return i;
  }
  return 0;
}

export function useHeatmap(studyDays: StudyDay[]): HeatmapData {
  return useMemo(() => {
    const sorted = [...studyDays].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const recent = sorted.slice(-MAX_STUDY_DAYS);

    const cells: HeatmapCell[] = recent.map((d) => ({
      date: d.date,
      count: d.completed,
      minutes: d.minutes,
      level: getLevel(d.completed),
    }));

    const maxCount = Math.max(...cells.map((c) => c.count), 0);

    const weeks: HeatmapCell[][] = [];
    let currentWeek: HeatmapCell[] = [];
    cells.forEach((cell, i) => {
      const dayOfWeek = new Date(cell.date).getDay();
      if (dayOfWeek === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(cell);
      if (i === cells.length - 1) weeks.push(currentWeek);
    });

    return { cells, maxCount, weeks };
  }, [studyDays]);
}