/**
 * KaTeX rendering utilities
 */

function esc(s: string): string {
  // Build HTML entities at runtime to avoid auto-formatter issues
  const amp = String.fromCharCode(38) + "amp;";
  const lt = String.fromCharCode(38) + "lt;";
  const gt = String.fromCharCode(38) + "gt;";
  const quot = String.fromCharCode(38) + "quot;";
  const apos = String.fromCharCode(38) + "#x27;";
  return s
    .replace(/&/g, amp)
    .replace(/</g, lt)
    .replace(/>/g, gt)
    .replace(/"/g, quot)
    .replace(/'/g, apos);
}

export function renderLatex(text: string): string {
  // 同时匹配块级 $$...$$ 与行内 $...$（$$ 优先避免被行内规则吞掉）
  const combinedRe = /\$\$([\s\S]*?)\$\$|\$([^$\n]+?)\$/g;
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = combinedRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      // 公式之前的普通文本 → HTML 转义（防 XSS，并让返回值可安全注入）
      result += esc(text.slice(lastIndex, match.index));
    }
    const latex = match[1] !== undefined ? match[1] : match[2];
    const isBlock = match[1] !== undefined;
    if (latex.trim().length === 0) {
      // 空公式（如独立 "$" 或 "$$"）→ 保留原始符号，不做公式
      result += match[0];
    } else {
      result += '<span class="' + (isBlock ? "katex-display math-display" : "math-inline") + '" data-latex="' + esc(latex) + '">' + esc(latex) + '</span>';
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    result += esc(text.slice(lastIndex));
  }
  return result;
}

export function hasLatex(text: string): boolean {
  return text.includes("$");
}

export function renderKatexOnClient(container: HTMLElement | null): void {
  if (!container || typeof window === "undefined") return;
  import("katex").then(function (katex) {
    const els = container.querySelectorAll<HTMLElement>("[data-latex]");
    els.forEach(function (el) {
      const latex = el.getAttribute("data-latex");
      if (!latex) return;
      try {
        const display = el.classList.contains("math-display");
        el.innerHTML = katex.renderToString(latex, {
          throwOnError: false,
          displayMode: display,
          output: "html",
        });
        el.classList.add("katex-rendered");
      } catch {
        el.innerHTML = "<code>" + esc(latex) + "</code>";
      }
    });
  }).catch(function () {
    // kaTeX failed to load
  });
}