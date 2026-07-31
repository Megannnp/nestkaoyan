/**
 * useQuestions — 真题 CRUD + 筛选 Hook
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import type { Question } from "../types";
import { seedQuestions } from "../default-data";

export function useQuestions(initial?: Question[]) {
  const [questions, setQuestions] = useState<Question[]>(initial ?? seedQuestions);
  const [filterSubject, setFilterSubject] = useState<string>("");
  const [filterLayer, setFilterLayer] = useState<string>("");

  const addQuestion = useCallback((q: Question) => {
    setQuestions((prev) => [...prev, q]);
  }, []);

  const updateQuestion = useCallback((id: string, updates: Partial<Question>) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  }, []);

  const removeQuestion = useCallback((id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (filterSubject && q.subject !== filterSubject) return false;
      if (filterLayer && q.layer !== filterLayer) return false;
      return true;
    });
  }, [questions, filterSubject, filterLayer]);

  return {
    questions,
    setQuestions,
    addQuestion,
    updateQuestion,
    removeQuestion,
    filterSubject,
    setFilterSubject,
    filterLayer,
    setFilterLayer,
    filteredQuestions,
  };
}