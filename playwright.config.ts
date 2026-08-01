import { defineConfig } from "@playwright/test";

/**
 * E2E 模块化验收测试（主验收标准）
 *
 * 架构原则：
 * 1. 每个 spec 文件独立运行（dashboard / knowledge / reader / questions / cards / review）
 * 2. 每个 test 通过 freshState() 清空 localStorage 并刷新，互不依赖页面状态
 * 3. Console 错误按五类统计：Runtime / Network / React Warning / Browser Warning / Third-party
 * 4. acceptance-audit.mjs 仅作为历史诊断脚本，不再作为主验收标准
 *
 * 运行：
 *   npx playwright test                        # 全部 spec
 *   npx playwright test tests/e2e/dashboard.spec.ts   # 单模块
 *   npx playwright test --grep "Reader"        # 关键词过滤
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  // 独立 spec 并行执行；同 spec 内 test 默认串行避免相互影响
  fullyParallel: false,
  workers: 4,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120000,
  },
  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],
});