/**
 * useLocalStorage — localStorage 读写 Hook
 *
 * 封装同步读写逻辑，配合 storage.ts 的防抖保存。
 * 注意：由于 Next.js SSR，初始值不使用 localStorage，
 * 而是接收外部传入的初始值。
 */

"use client";

import { useState, useCallback } from "react";

/**
 * 通用 localStorage Hoo
 *
 * @param key   localStorage 键名
 * @param initialValue 初始值（SSR 安全）
 * @returns [value, setValue]
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const newValue = value instanceof Function ? value(prev) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(newValue));
        } catch {
          // 静默失败
        }
        return newValue;
      });
    },
    [key]
  );

  return [storedValue, setValue];
}