/**
 * useSubjects — 科目 CRUD Hook
 */

"use client";

import { useState, useCallback } from "react";
import type { Subject } from "../types";
import { seedSubjects } from "../default-data";

export function useSubjects(initial?: Subject[]) {
  const [subjects, setSubjects] = useState<Subject[]>(initial ?? seedSubjects);

  const addSubject = useCallback((subject: Subject) => {
    setSubjects((prev) => [...prev, subject]);
  }, []);

  const updateSubject = useCallback((id: string, updates: Partial<Subject>) => {
    setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }, []);

  const removeSubject = useCallback((id: string) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { subjects, setSubjects, addSubject, updateSubject, removeSubject };
}