import { expect } from "@playwright/test";
import { test, freshState, attachConsoleCollector, expectNoCriticalConsoleIssues, STORAGE_KEY } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshState(page);
});

/** 进入今日工作台 → 今日复盘 Tab */
async function gotoReviewTab(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "今日工作台" }).click();
  await page.getByRole("button", { name: "今日复盘" }).click();
}

test.describe("Review 复盘", () => {
  test("日/周/月 Tab + 科目筛选 + 指标", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoReviewTab(page);

    await expect(page.getByRole("button", { name: "日复盘", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "周复盘", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "月复盘", exact: true })).toBeVisible();
    await expect(page.locator(".review-metrics")).toBeVisible();
    await expect(page.getByRole("button", { name: "填写复盘" })).toBeVisible();

    // 科目筛选（2026-08-01：由下拉框改为与全站一致的 Tab 风格）
    await page.getByRole("button", { name: "全部科目", exact: true }).click();
    await page.waitForTimeout(200);

    // 切换月复盘 → 指标文案变化
    await page.getByRole("button", { name: "月复盘", exact: true }).click();
    await expect(page.getByText("本月学习时长")).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "review-scope");
  });

  test("AI 总结展示（笔记列表已随信息架构精简移除）", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoReviewTab(page);

    await expect(page.getByText("AI 日复盘总结")).toBeVisible();
    // 2026-08-01 信息架构精简：AI 总结卡片不再内嵌笔记列表，只展示总结内容
    await expect(page.locator(".note-list")).toHaveCount(0);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "review-ai-summary");
  });

  test("填写复盘 Dialog 提交并持久化", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoReviewTab(page);
    await page.getByRole("button", { name: "填写复盘" }).click();

    const dialog = page.getByLabel("填写复盘");
    await expect(dialog).toBeVisible();

    // 填写内容：完成内容 + 困难 + 时间 + 优先级
    const inputs = dialog.locator("input");
    await inputs.nth(0).fill("E2E验收今天完成了任务A");
    await inputs.nth(1).fill("E2E验收困难部分B");
    await inputs.nth(2).fill("2 小时");
    await inputs.nth(3).fill("优先复习马原");
    await dialog.getByRole("button", { name: "提交复盘" }).click();

    // Dialog 关闭
    await expect(dialog).toHaveCount(0);

    // 持久化检查
    await page.waitForTimeout(600);
    const saved = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    }, STORAGE_KEY);
    expect(saved.review).toBeTruthy();
    expect(saved.review.done).toContain("E2E验收今天完成了任务A");
    expect(saved.review.hard).toContain("E2E验收困难部分B");

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "review-dialog");
  });

  test("刷新后复盘内容恢复", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoReviewTab(page);
    await page.getByRole("button", { name: "填写复盘" }).click();
    const dialog = page.getByLabel("填写复盘");
    await dialog.locator("input").nth(0).fill("刷新恢复的复盘内容");
    await dialog.getByRole("button", { name: "提交复盘" }).click();
    await page.waitForTimeout(600);

    // 刷新后重新打开 Dialog
    await page.reload();
    await gotoReviewTab(page);
    await page.getByRole("button", { name: "填写复盘" }).click();
    await expect(page.getByLabel("填写复盘").locator("input").nth(0)).toHaveValue("刷新恢复的复盘内容");

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "review-reload");
  });

  test("指标卡随完成任务联动", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    // 先完成一个任务
    const firstTaskRow = page.locator(".task-row").first();
    await firstTaskRow.getByRole("button", { name: "开始学习" }).click();
    await firstTaskRow.getByRole("button", { name: "结束学习" }).click();
    await page.getByLabel("记录学习结果").getByRole("button", { name: "保存并完成" }).click();
    await page.waitForTimeout(400);

    // 进入复盘查看完成数
    await gotoReviewTab(page);
    const metricsText = await page.locator(".review-metrics").textContent();
    expect(metricsText).toContain("1/");
    await expect(page.getByText(/今日完成 1 个任务/).first()).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "review-metrics-linked");
  });
});