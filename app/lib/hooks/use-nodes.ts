/**
 * useNodes — 知识点 CRUD Hook
 */

"use client";

import { useState, useCallback } from "react";
import type { KnowledgeNode } from "../types";
import { seedNodes } from "../default-data";

export function useNodes(initial?: KnowledgeNode[]) {
  const [nodes, setNodes] = useState<KnowledgeNode[]>(initial ?? seedNodes);

  const addNode = useCallback((node: KnowledgeNode) => {
    setNodes((prev) => [...prev, node]);
  }, []);

  const updateNode = useCallback((id: string, updates: Partial<KnowledgeNode>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
  }, []);

  const removeNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { nodes, setNodes, addNode, updateNode, removeNode };
}