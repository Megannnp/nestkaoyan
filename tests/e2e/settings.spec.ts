import { expect } from "@playwright/test";
import { test, freshState, attachConsoleCollector, expectNoCriticalConsoleIssues, waitForStoredData } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshState(page);
});

test.describe("Settings 设置", () => {
  test("学习档案：入口列表 + 考试设置弹窗精简显示", async ({ page }) => {
    await page.getByRole("button", { name: "设置" }).click();
    // 设置首页：入口列表（有层级）；标题选择需精确（Sidebar/导航等多处含「设置」文本）
    await expect(page.getByTestId("app-ready").getByText("设置", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("我的目标")).toBeVisible();
    await expect(page.getByText("AI 学习助手")).toBeVisible();
    await expect(page.getByText("数据管理")).toBeVisible();
    // 进入「我的目标」二级页（2026-08-01 精简：弹窗标题改为「考试设置」）
    await page.getByRole("button", { name: /我的目标/ }).click();
    await expect(page.getByText("考试设置")).toBeVisible();
    // 目标总分展示（精确匹配，避免与科目汇总重复文本歧义）
    await expect(page.getByText("目标总分", { exact: true })).toBeVisible();
  });

  test("删除科目：进入编辑态后两阶段确认并持久化", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await page.getByRole("button", { name: "设置" }).click();
    // 设置首页：入口列表 → 点击「我的目标」
    await expect(page.getByText("我的目标")).toBeVisible();
    await page.getByRole("button", { name: /我的目标/ }).click();
    // 二级页：考试设置（2026-08-01 精简弹窗标题）
    await expect(page.getByText("考试设置")).toBeVisible();

    // 2026-08-03 用户反馈：默认展示信息，点击「编辑」才出现操作按钮
    const subjectRow = page.getByTestId("subject-row-s-politics");
    await subjectRow.getByRole("button", { name: "编辑" }).click();
    await expect(subjectRow.getByRole("button", { name: "删除" })).toBeVisible();
    await subjectRow.getByRole("button", { name: "删除" }).click();
    await expect(subjectRow.getByRole("button", { name: "确认删除" })).toBeVisible();
    await subjectRow.getByRole("button", { name: "确认删除" }).click();

    await waitForStoredData(
      page,
      (data) => !((data.subjects as { name: string }[]) || []).some((subject) => subject.name === "政治"),
      "settings-delete-subject",
    );
    await expect(subjectRow).toHaveCount(0);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "settings-delete-subject");
  });

  test("数据管理：导出 JSON 备份", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await page.getByRole("button", { name: "设置" }).click();
    await page.getByRole("button", { name: /数据管理/ }).click();
    await expect(page.getByTestId("app-ready").getByText("数据管理", { exact: true }).first()).toBeVisible();

    // 捕获下载事件并验证文件名
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /导出学习档案/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^kaoyan-workspace-backup-\d{4}-\d{2}-\d{2}\.json$/);
    // 读取导出内容：应包含 subjects/exportedAt/appName 元数据
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c as Buffer);
    const content = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    expect(content.appName).toBe("筑巢考研工作台");
    expect(Array.isArray(content.subjects)).toBe(true);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "settings-export");
  });

  test("数据管理：导入 JSON 备份并恢复", async ({ page }) => {
    await page.getByRole("button", { name: "设置" }).click();
    await page.getByRole("button", { name: /数据管理/ }).click();

    // 构造最小合法备份（含 subjects 字段）
    const backup = JSON.stringify({
      appName: "筑巢考研工作台",
      subjects: [{ id: "s-import", name: "导入测试科目", type: "公共课", maxScore: "100", targetScore: "60", currentProgress: "", currentMastery: "基本理解", weeklyHours: "5", hasPastPapers: false, hasSolutions: false, hasReferences: false, round: "第一轮", layer: "第 1 层", focus: "", risk: "正常" }],
      resources: [], materials: [], materialSections: [], questions: [], nodes: [], tasks: [], pending: [], notes: [], cards: [], annotations: [], studyDays: [], agentSteps: [], logs: [], chatSessions: [], review: {}, structuredReviews: [],
      onboardingCompleted: true,
    });
    await page.locator('input[type="file"][accept*="json"]').setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(backup),
    });

    // 导入成功提示 + 刷新恢复
    await expect(page.getByText(/导入成功/)).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1800); // 等待 reload 后 hydrate 恢复
    // 恢复的科目出现在设置 → 我的目标
    await page.getByRole("button", { name: "设置" }).click();
    await page.getByRole("button", { name: /我的目标/ }).click();
    await expect(page.getByText("导入测试科目")).toBeVisible();
  });
});