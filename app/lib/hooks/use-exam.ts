/**
 * useExam — 考试目标 CRUD Hook
 */

"use client";

import { useState, useCallback } from "react";
import type { ExamGoal } from "../types";
import { seedExam } from "../default-data";

export function useExam(initial?: ExamGoal) {
  const [exam, setExam] = useState<ExamGoal>(initial ?? seedExam);

  const updateExam = useCallback((updates: Partial<ExamGoal>) => {
    setExam((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetExam = useCallback(() => {
    setExam(seedExam);
  }, []);

  return { exam, setExam, updateExam, resetExam };
}