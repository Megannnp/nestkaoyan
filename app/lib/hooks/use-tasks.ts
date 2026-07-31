/**
 * useTasks — 任务 CRUD + 计划生成 Hook
 */

"use client";

import { useState, useCallback } from "react";
import type { Task } from "../types";
import { seedTasks } from "../default-data";

export function useTasks(initial?: Task[]) {
  const [tasks, setTasks] = useState<Task[]>(initial ?? seedTasks);

  const addTask = useCallback((task: Task) => {
    setTasks((prev) => [...prev, task]);
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleTaskDone = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }, []);

  const getPendingTasks = useCallback(() => {
    return tasks.filter((t) => !t.done && t.status === "待开始");
  }, [tasks]);

  return {
    tasks,
    setTasks,
    addTask,
    updateTask,
    removeTask,
    toggleTaskDone,
    getPendingTasks,
  };
}