"use client";

import { useEffect, useRef } from "react";
import { renderLatex, renderKatexOnClient, hasLatex } from "../lib/katex-utils";

/**
 * LatexContent：将文本中的 \(...\) / $...$（行内）与 $$...$$（块级）LaTeX 公式
 * 渲染为 KaTeX 数学公式；普通文本原样显示（自动做 HTML 转义防 XSS）。
 *
 * 用法：
 *   <LatexContent text={message.content} className="..." />
 */
export function LatexContent({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (ref.current && hasLatex(text)) {
      renderKatexOnClient(ref.current);
    }
  }, [text]);

  // 无公式时直接渲染纯文本，避免不必要的 dangerouslySetInnerHTML
  if (!hasLatex(text)) {
    return <span className={className}>{text}</span>;
  }

  const html = renderLatex(text);
  return (
    <span
      ref={ref}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}