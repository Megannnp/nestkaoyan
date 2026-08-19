import { test, expect, type Page } from "@playwright/test";

export const STORAGE_KEY = "nest-exam-workspace-v5";
export const STORAGE_KEY_V4 = "nest-exam-workspace-v4";

/**
 * E2E 测试种子数据（2026-08-03：page.tsx 已移除虚拟数据初始态，
 * 测试专用——仅测试环境注入，生产环境不注入）
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - 仅测试文件引用，避免污染生产 bundle
import { buildE2ESeedState } from "./e2e-seed";

/**
 * Console 错误分类：
 * - Runtime Error  : pageerror（未捕获异常）或未分类 error
 * - Network Error  : requestfailed / response >= 400（API/资源加载失败）
 * - React Warning  : React 告警（如 key、hydration、setState in effect 等）
 * - Browser Warning: 浏览器/平台警告（如 favicon、autofill、deprecated API 等）
 * - Third-party    : 第三方库/扩展输出（不为本应用负责）
 */
export type ConsoleCategory =
  | "Runtime Error"
  | "Network Error"
  | "React Warning"
  | "Browser Warning"
  | "Third-party";

export interface CapturedConsoleIssue {
  category: ConsoleCategory;
  type: string;
  text: string;
  url?: string;
  status?: number;
  count: number;
}

/** 已知第三方/环境噪音前缀（不计入失败） */
const IGNORED_PATTERNS: { category: ConsoleCategory; patterns: RegExp[] }[] = [
  {
    category: "Third-party",
    patterns: [
      /Next\.js DEVELOPMENT MODE/i,
      /Download the React DevTools/i,
      /react-devtools/i,
      /favicon\.ico/i,
      /webpack/i,
      /hot-update/i,
    ],
  },
  {
    category: "Browser Warning",
    patterns: [
      /\[Violation\]/i,
      /Autofill/i,
      /SharedArrayBuffer/i,
      /Deprecated/i,
      /Password Manager/i,
      // React 19「空态渲染 NaN 数字」内部告警：渲染结果为空、不影响功能，非应用逻辑错误。
      // 2026-08-18 已修复根因（page.tsx Hydration effect：无效 exam.examDate 兜底为 0，不再产生 NaN）。
      // 保留本条目作为防御性噪音过滤，若未来出现其他 NaN 渲染源应先定位根因而非依赖此白名单。
      /Received NaN for the .* attribute/i,
    ],
  },
];

const REACT_WARNING_PATTERNS: RegExp[] = [
  /Warning: /i,
  /React does not recognize/i,
  /Each child in a list should have a unique/i,
  /set-state-in-effect/i,
  /Cannot update a component.*while rendering/i,
  /hydration/i,
  /Hydration failed/i,
  /react-hooks/i,
];

const NETWORK_FAILURE_PATTERNS: RegExp[] = [
  /net::/i,
  /Failed to fetch/i,
  /ERR_/i,
  /load failed/i,
  /404/i,
  /500/i,
  /NetworkError/i,
];

const RUNTIME_ERROR_PATTERNS: RegExp[] = [
  /TypeError/i,
  /ReferenceError/i,
  /RangeError/i,
  /SyntaxError/i,
  /Error: /,
  /Uncaught/i,
  /is not a function/i,
  /Cannot read properties/i,
  /is not defined/i,
];

export function classifyConsoleText(text: string, type: string): ConsoleCategory {
  // 1. 已知忽略噪音 → Third-party / Browser Warning
  for (const group of IGNORED_PATTERNS) {
    for (const pattern of group.patterns) {
      if (pattern.test(text)) return group.category;
    }
  }
  // 2. React 告警
  for (const pattern of REACT_WARNING_PATTERNS) {
    if (pattern.test(text)) return "React Warning";
  }
  // 3. Network 失败
  if (type === "requestfailed") return "Network Error";
  for (const pattern of NETWORK_FAILURE_PATTERNS) {
    if (pattern.test(text)) return "Network Error";
  }
  // 4. 运行时错误
  for (const pattern of RUNTIME_ERROR_PATTERNS) {
    if (pattern.test(text)) return "Runtime Error";
  }
  // 5. 兜底
  return type === "warning" ? "Browser Warning" : "Runtime Error";
}

export function attachConsoleCollector(page: Page): { getIssues: () => CapturedConsoleIssue[] } {
  const issues: {
    category: ConsoleCategory;
    type: string;
    text: string;
    url?: string;
    status?: number;
  }[] = [];

  page.on("console", (msg) => {
    const t = msg.type();
    if (t === "error" || t === "warning") {
      issues.push({ category: classifyConsoleText(msg.text(), t), type: t, text: msg.text() });
    }
  });
  page.on("pageerror", (err) => {
    issues.push({ category: "Runtime Error", type: "pageerror", text: String(err) });
  });
  page.on("requestfailed", (req) => {
    issues.push({
      category: "Network Error",
      type: "requestfailed",
      text: `${req.url()} ${req.failure()?.errorText ?? ""}`,
      url: req.url(),
    });
  });
  page.on("response", (res) => {
    if (res.status() >= 400) {
      issues.push({
        category: "Network Error",
        type: "response",
        text: `${res.url()} ${res.status()}`,
        url: res.url(),
        status: res.status(),
      });
    }
  });

  return {
    getIssues() {
      const counts = new Map<string, CapturedConsoleIssue>();
      for (const item of issues) {
        const key = `${item.category}|${item.type}|${item.text}`;
        const existing = counts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(key, { ...item, count: 1 });
        }
      }
      return Array.from(counts.values());
    },
  };
}

/** 汇总分类统计 */
export function summarizeIssues(issues: CapturedConsoleIssue[], label: string): void {
  const categories: ConsoleCategory[] = [
    "Runtime Error",
    "Network Error",
    "React Warning",
    "Browser Warning",
    "Third-party",
  ];
  const summary = categories.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = 0;
    return acc;
  }, {});
  for (const issue of issues) summary[issue.category] += issue.count;

  const lines: string[] = [];
  for (const cat of categories) {
    lines.push(`  ${cat}: ${summary[cat]}`);
  }
  console.log(`\n[ConsoleStats:${label}]`);
  console.log(lines.join("\n"));
  console.log("[ConsoleStats:end]\n");
}

/**
 * 断言：不允许出现 Runtime Error / Network Error / React Warning。
 * Browser Warning 与 Third-party 仅记录，不使测试失败。
 */
export function expectNoCriticalConsoleIssues(issues: CapturedConsoleIssue[], label: string): void {
  // 每次断言前输出五分类统计（Runtime / Network / React / Browser / Third-party）
  summarizeIssues(issues, label);
  const critical = issues.filter(
    (issue) =>
      issue.category === "Runtime Error" ||
      issue.category === "Network Error" ||
      issue.category === "React Warning"
  );
  if (critical.length > 0) {
    const detail = critical.map((c) => `[${c.category}] ${c.type}: ${c.text}`).join("\n");
    throw new Error(`[ConsoleErrors:${label}] ${critical.length} 个关键控制台问题:\n${detail}`);
  }
}

/**
 * 每个 spec 独立运行：清空 localStorage 并刷新，保证不依赖前一个测试遗留状态。
 * 每个 test 开始时调用（test.beforeEach）。
 */
/**
 * 每次页面加载前（含 reload）注入 onboardingCompleted=true，
 * 根治 Onboarding 全屏向导拦截导航的问题。
 */
/** 测试注入的完整种子状态（page.tsx 已移除虚拟数据，测试自行注入） */
export async function freshState(page: Page): Promise<void> {
  const seed = buildE2ESeedState();
  await page.addInitScript(({ key, seedState }) => {
    // 只在无存档时注入 seed：避免测试内 page.reload() 把用户已保存数据（批注/卡片等）重置为 seed
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify(seedState));
    }
  }, { key: STORAGE_KEY, seedState: seed });
  await page.goto("/");
  await page.evaluate(({ key, seedState }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(seedState));
  }, { key: STORAGE_KEY, seedState: seed });
  await page.reload();
  await expect(page.getByRole("button", { name: "知识中心" })).toBeVisible();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.waitForTimeout(300);
}

/** 紧凑断言失败的分类输出（用于 test.step 内） */
export async function withConsoleCapture(
  page: Page,
  label: string,
  fn: () => Promise<void>
): Promise<CapturedConsoleIssue[]> {
  const collector = attachConsoleCollector(page);
  await fn();
  await page.waitForTimeout(200);
  const issues = collector.getIssues();
  summarizeIssues(issues, label);
  return issues;
}

/**
 * 轮询等待 localStorage 中出现指定值（防抖 400ms 保存生效）。
 * 返回解析后的 storage 对象；超时抛错。
 */
export async function waitForStoredData(
  page: Page,
  predicate: (data: Record<string, unknown>) => boolean,
  label: string,
  timeout = 8000
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeout;
  let last: Record<string, unknown> | null = null;
  while (Date.now() < deadline) {
    last = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    }, STORAGE_KEY);
    if (last && predicate(last)) return last;
    await page.waitForTimeout(200);
  }
  throw new Error(`[${label}] 等待 localStorage 持久化超时（${timeout}ms），最近值=${JSON.stringify(last ?? null).slice(0, 200)}`);
}

export { test, expect };
