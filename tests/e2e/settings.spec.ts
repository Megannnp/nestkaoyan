import { expect } from "@playwright/test";
import { test, freshState, attachConsoleCollector, expectNoCriticalConsoleIssues, waitForStoredData } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshState(page);
});

test.describe("Settings 设置", () => {
  test("删除科目：两阶段确认并持久化", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await page.getByRole("button", { name: "设置" }).click();
    await expect(page.getByText("考试与科目设置")).toBeVisible();

    const subjectRow = page.getByTestId("subject-row-s-828");
    await subjectRow.getByRole("button", { name: "删除" }).click();
    await expect(subjectRow.getByRole("button", { name: "确认删除" })).toBeVisible();
    await subjectRow.getByRole("button", { name: "确认删除" }).click();

    await waitForStoredData(
      page,
      (data) => !((data.subjects as { name: string }[]) || []).some((subject) => subject.name === "828 物理化学"),
      "settings-delete-subject",
    );
    await expect(subjectRow).toHaveCount(0);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "settings-delete-subject");
  });
});
