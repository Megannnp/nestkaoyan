"use client";

import { useState, useRef, useEffect, useCallback } from "react";

/**
 * 学习计时器 Hook
 * 提供开始、暂停、继续、结束和重置计时功能
 */
interface TimerState {
  startTime: string;
  elapsedSeconds: number;
  isRunning: boolean;
}

interface TimerActions {
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => number; // returns elapsed minutes
  reset: () => void;
}

export function useTimer(): [TimerState, TimerActions] {
  const [startTime, setStartTime] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, []);

  const start = useCallback(() => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    setStartTime(timeStr);
    setElapsedSeconds(0);
    setIsRunning(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  const resume = useCallback(() => {
    if (isRunning) return;
    setIsRunning(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  }, [isRunning]);

  const stop = useCallback((): number => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
    return Math.round(elapsedSeconds / 60);
  }, [elapsedSeconds]);

  const reset = useCallback(() => {
    setIsRunning(false);
    setStartTime("");
    setElapsedSeconds(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  const state: TimerState = { startTime, elapsedSeconds, isRunning };
  const actions: TimerActions = { start, pause, resume, stop, reset };

  return [state, actions];
}