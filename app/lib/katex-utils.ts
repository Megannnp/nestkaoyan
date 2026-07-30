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
  let result = text;
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, function (_m: string, latex: string) {
    return '<span class="katex-display math-display" data-latex="' + esc(latex) + '">' + esc(latex) + '</span>';
  });
  result = result.replace(/\$([^$\n]+?)\$/g, function (_m: string, latex: string) {
    if (latex.trim().length === 0) return "$" + latex + "$";
    return '<span class="math-inline" data-latex="' + esc(latex) + '">' + esc(latex) + '</span>';
  });
  return result;
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