"use client";

import { useState, useEffect } from "react";

/**
 * 防抖 Hook: 在 `delay` 毫秒内没有新值变化后才返回最新值
 * 适用于 localStorage 写入等频繁操作
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}