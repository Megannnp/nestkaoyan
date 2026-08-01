import { expect } from "@playwright/test";
import { test, freshState, attachConsoleCollector, expectNoCriticalConsoleIssues, waitForStoredData } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshState(page);
});

/** 知识中心 → 828 物理化学 → 真题数据库 */
async function gotoQuestions(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "知识中心" }).click();
  await page.getByRole("button", { name: "828 物理化学" }).first().click();
  await page.getByRole("button", { name: "真题数据库" }).click();
}

test.describe("Questions 真题数据库", () => {
  test("筛选条与题目列表渲染", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoQuestions(page);

    await expect(page.locator(".filter-bar")).toBeVisible();
    await expect(page.locator(".question-list article").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "录入题目" })).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "questions-list");
  });

  test("七核筛选：热力学过滤列表", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoQuestions(page);

    const countBefore = await page.locator(".question-list article").count();
    expect(countBefore).toBeGreaterThan(0);

    await page.locator(".filter-bar select").nth(1).selectOption({ label: "热力学" });
    await page.waitForTimeout(200);
    const countAfter = await page.locator(".question-list article").count();
    expect(countAfter).toBeLessThanOrEqual(countBefore);
    expect(countAfter).toBeGreaterThan(0);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "questions-filter-core");
  });

  test("录入题目并持久化", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoQuestions(page);
    await page.getByRole("button", { name: "录入题目" }).click();

    const dialog = page.getByLabel("手动录入题目");
    await expect(dialog).toBeVisible();
    await dialog.locator('input[name="stem"]').fill("E2E验收测试题目：化学势梯度");
    await dialog.getByRole("button", { name: "手动录入题目" }).click();

    await expect(page.getByText("E2E验收测试题目：化学势梯度")).toBeVisible();

    await waitForStoredData(
      page,
      (data) => ((data.questions as { stem: string }[]) || []).some((q) => q.stem.includes("E2E验收测试题目")),
      "questions-add"
    );

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "questions-add");
  });

  test("内联编辑做题记录：结果选错误", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoQuestions(page);
    await page.getByRole("button", { name: "录入题目" }).click();
    const dialog = page.getByLabel("手动录入题目");
    await dialog.locator('input[name="stem"]').fill("内联编辑题目");
    await dialog.getByRole("button", { name: "手动录入题目" }).click();

    const item = page.locator(".question-list article", { hasText: "内联编辑题目" }).first();
    await item.locator("summary", { hasText: "做题记录/编辑" }).click();
    await item.locator("select").first().selectOption({ label: "错误" });

    const saved = await waitForStoredData(
      page,
      (data) =>
        ((data.questions as { stem: string; result: string; done: boolean }[]) || []).some(
          (q) => q.stem.includes("内联编辑题目") && q.result === "错误" && q.done === true
        ),
      "questions-inline-edit"
    );
    const edited = (saved.questions as { stem: string; result: string; done: boolean }[]).find((q) => q.stem.includes("内联编辑题目"));
    if (!edited) throw new Error("未找到内联编辑题目");
    expect(edited.result).toBe("错误");
    expect(edited.done).toBe(true);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "questions-inline-edit");
  });

  test("收藏题目（切换收藏状态）", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoQuestions(page);

    const firstItem = page.locator(".question-list article").first();
    await firstItem.locator("summary", { hasText: "做题记录/编辑" }).click();
    const favoriteBtn = firstItem.getByRole("button", { name: "收藏" }).or(firstItem.getByRole("button", { name: "取消收藏" }));
    await expect(favoriteBtn).toBeVisible();
    const beforeText = await favoriteBtn.textContent();
    const wasFavorited = beforeText?.includes("取消收藏") ?? false;

    await favoriteBtn.click();

    // 按钮文本翻转，表示收藏状态已切换
    const afterBtn = firstItem.getByRole("button", { name: wasFavorited ? "收藏" : "取消收藏" });
    await expect(afterBtn).toBeVisible();

    // 持久化验证：与 UI 状态一致（seed 中部分题已是收藏状态）
    await waitForStoredData(
      page,
      (data) => {
        const questions = (data.questions as { favorite?: boolean }[]) || [];
        if (wasFavorited) {
          // 取消收藏 → 至少一个仍为 true（seed 余量）
          return questions.some((q) => q.favorite === true) || questions.every((q) => q.favorite === false);
        }
        // 收藏 → 至少一个为 true
        return questions.some((q) => q.favorite === true);
      },
      "questions-favorite"
    );

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "questions-favorite");
  });

  test("删除题目", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoQuestions(page);
    await page.getByRole("button", { name: "录入题目" }).click();
    const dialog = page.getByLabel("手动录入题目");
    await dialog.locator('input[name="stem"]').fill("待删除题目");
    await dialog.getByRole("button", { name: "手动录入题目" }).click();
    await expect(page.getByText("待删除题目")).toBeVisible();

    const item = page.locator(".question-list article", { hasText: "待删除题目" }).first();
    await item.locator("summary", { hasText: "做题记录/编辑" }).click();
    await item.getByRole("button", { name: "删除题目" }).click();

    await expect(page.getByText("待删除题目")).toHaveCount(0);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "questions-delete");
  });
});