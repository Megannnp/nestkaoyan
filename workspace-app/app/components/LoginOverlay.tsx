"use client";

import { useState, type FormEvent } from "react";

/**
 * 访问密码登录遮罩（私有部署版）
 * 启用认证（KAOYAN_AUTH=1）且当前会话未授权时显示；登录成功后整页重载进入工作台。
 */
export default function LoginOverlay({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        onSuccess();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error || "登录失败");
    } catch {
      setError("网络错误，请重试");
    }
    setBusy(false);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#f7f5f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 320,
          padding: "36px 32px",
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #e8e4da",
          boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }}>📚</div>
        <h2 style={{ margin: "0 0 6px", fontSize: 18, color: "#3a2f22" }}>筑巢考研工作台</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#8a7a5f" }}>
          该实例已启用访问密码，请输入后进入
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="访问密码"
          autoFocus
          aria-label="访问密码"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #d8d0be",
            fontSize: 14,
            outline: "none",
          }}
        />
        {error && (
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "#c0392b" }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={busy || !password}
          style={{
            width: "100%",
            marginTop: 16,
            padding: "10px 0",
            borderRadius: 8,
            border: "none",
            background: busy ? "#c9b98f" : "#8a6d3b",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "验证中…" : "进入"}
        </button>
      </form>
    </div>
  );
}
