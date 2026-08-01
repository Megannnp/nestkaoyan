import { expect } from "@playwright/test";
import { test, freshState, attachConsoleCollector, expectNoCriticalConsoleIssues, waitForStoredData } from "./helpers";

test.beforeEach(async ({ page }) => {
  await freshState(page);
});

/** 进入卡片中心并进入 828 物理化学「全部卡片」工作空间（学科 Tab 选中 → 点击「全部卡片」卡片组） */
async function gotoCardsSubject(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "成长卡片" }).click();
  // 等待事件系统稳定（Vite HMR 并行 worker 下 click 事件可能尚未绑定）
  await page.waitForTimeout(300);
  // 等待卡片中心路由渲染完成（避免 Sidebar 导航后立即查找学科按钮的竞态）
  await expect(page.getByRole("heading", { name: "成长卡片" })).toBeVisible({ timeout: 15000 });
  // 学科 Tab 选中 828 物理化学（首页卡片组网格中的「全部卡片」不含学科名，学科名仅在 Tab 上）
  await page.getByRole("button", { name: "828 物理化学", exact: true }).first().click();
  await page.waitForTimeout(300);
  // 点击「全部卡片」卡片组入口 → 进入卡片组工作空间（卡片视图）
  await page.getByRole("button", { name: /全部卡片/ }).first().click();
  await expect(page.getByRole("button", { name: "新建卡片" })).toBeVisible();
}

/** 进入某学科「全部卡片」卡片组（点击 828 学科对应入口卡片直达，已含「新建卡片」） */
async function gotoAllCardsGroup(page: import("@playwright/test").Page) {
  // 复用完整导航：成长卡片 → 卡片中心 → 全部卡片组（原实现缺少导航步骤，导致停留在 Dashboard）
  await gotoCardsSubject(page);
}

/** 通过弹窗快速创建卡片（仅卡片组内出现「新建卡片」入口） */
async function createCardViaModal(page: import("@playwright/test").Page, front: string, back = "背面") {
  await page.getByRole("button", { name: "新建卡片" }).click();
  const dialog = page.getByLabel("新建成长卡片");
  await expect(dialog).toBeVisible();
  await dialog.locator('input[name="front"]').fill(front);
  await dialog.locator('input[name="back"]').fill(back);
  await dialog.getByRole("button", { name: "创建成长卡片" }).click();
  await expect(dialog).toHaveCount(0);
}

test.describe("Cards 卡片中心", () => {
  test("卡片中心：首页学科 Tab + 学科入口 + 卡片组工作空间", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await page.getByRole("button", { name: "成长卡片" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByRole("heading", { name: "成长卡片" })).toBeVisible();

    // 首页展示学科 Tab（与知识中心一致）
    await expect(page.getByRole("button", { name: "828 物理化学", exact: true }).first()).toBeVisible();

    // 学科 Tab 选中 828 物理化学 → 点击「全部卡片」卡片组入口 → 进入卡片组工作空间（卡片视图）
    await page.getByRole("button", { name: "828 物理化学", exact: true }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /全部卡片/ }).first().click();
    // 卡片组内出现「新建卡片」入口，证明已进入卡片视图
    await expect(page.getByRole("button", { name: "新建卡片" })).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "cards-tabs");
  });

  test("进入「全部卡片」卡片组：复习 + 新建卡片", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoAllCardsGroup(page);
    await expect(page.locator(".flip-container, [class*=flip-container]").first()).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "cards-group-review");
  });

  test("弹窗快速创建卡片并持久化", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoAllCardsGroup(page);
    await createCardViaModal(page, "E2E卡片正面");

    await waitForStoredData(
      page,
      (data) => ((data.cards as { front: string }[]) || []).some((c) => c.front === "E2E卡片正面"),
      "cards-quick-create"
    );

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "cards-quick-create");
  });

  test("卡片评分：认识 [1] 更新掌握度", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoAllCardsGroup(page);

    // 点击认识评分（卡片组工作空间直接复习）
    await page.getByRole("button", { name: /认识 \[1\]/ }).first().click();

    await waitForStoredData(
      page,
      (data) => ((data.cards as { mastery: string }[]) || []).some((c) => c.mastery === "认识"),
      "cards-rate"
    );

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "cards-rate");
  });

  test("键盘快捷键：空格翻面 / 1 评分", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoAllCardsGroup(page);

    // 空格翻面
    await page.keyboard.press("Space");
    await expect(page.locator(".flip-container.flipped, [class*=flip-container][class*=flipped]").first()).toBeVisible({ timeout: 3000 });

    // 数字 1 评分
    await page.keyboard.press("1");

    await waitForStoredData(
      page,
      (data) => ((data.cards as { mastery: string }[]) || []).some((c) => c.mastery === "认识"),
      "cards-keyboard"
    );

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "cards-keyboard");
  });

  test("卡片管理：卡片网格 + 编辑 + 删除", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoAllCardsGroup(page);
    // 切到「全部」子视图（card-grid 仅在全部视图渲染；默认是「待复习」复习视图）
    await page.getByRole("button", { name: "全部", exact: true }).first().click();
    await page.waitForTimeout(200);
    // 卡片组工作空间内查看全部卡片
    await expect(page.locator(".card-grid .study-card").first()).toBeVisible();

    // 编辑卡片弹窗（预填）
    await page.locator(".study-card button", { hasText: "编辑" }).first().click();
    await expect(page.getByLabel("编辑成长卡片")).toBeVisible();
    const frontInput = page.getByLabel("编辑成长卡片").locator('input[name="front"]');
    await expect(frontInput).toHaveValue(/理想气体/);
    await frontInput.fill("E2E编辑后的卡片正面");
    await page.getByLabel("编辑成长卡片").getByRole("button", { name: "保存修改" }).click();
    await expect(page.getByLabel("编辑成长卡片")).toHaveCount(0);
    await expect(page.getByText("已保存卡片修改")).toBeVisible();

    // 删除（confirm 对话框）
    const cardsBefore = await page.locator(".card-grid .study-card").count();
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator(".study-card button", { hasText: "删除" }).first().click();
    await page.waitForTimeout(300);
    const cardsAfter = await page.locator(".card-grid .study-card").count();
    expect(cardsAfter).toBe(cardsBefore - 1);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "cards-manage-edit-delete");
  });

  test("新建卡片弹窗：精简字段 + 更多设置折叠 + 默认卡片组", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoAllCardsGroup(page);
    await page.getByRole("button", { name: "新建卡片" }).click();

    const dialog = page.getByLabel("新建成长卡片");
    await expect(dialog).toBeVisible();

    // 默认只展示必要字段：正面/背面/类型/卡片组
    await expect(dialog.locator('input[name="front"]')).toBeVisible();
    await expect(dialog.locator('input[name="back"]')).toBeVisible();
    await expect(dialog.locator('select[name="type"]')).toBeVisible();
    // 全部卡片组中新建 → 默认「未分类」
    await expect(dialog.locator('select[name="category"]')).toHaveValue("");

    // 更多设置默认折叠，展开后可修改科目/七核/知识点/来源
    const moreSummary = dialog.locator("summary", { hasText: "更多设置" });
    await expect(moreSummary).toBeVisible();
    await moreSummary.click();
    await expect(dialog.locator('select[name="subject"]')).toBeVisible();
    await expect(dialog.locator('select[name="core"]')).toBeVisible();

    // 默认继承当前科目（828 物理化学）
    await expect(dialog.locator('select[name="subject"]')).toHaveValue("828 物理化学");

    await dialog.locator('input[name="front"]').fill("E2E手动卡片标题");
    await dialog.getByRole("button", { name: "创建成长卡片" }).click();
    await expect(dialog).toHaveCount(0);

    await waitForStoredData(
      page,
      (data) => ((data.cards as { title: string }[]) || []).some((c) => c.title === "E2E手动卡片标题"),
      "cards-manual-create"
    );

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "cards-manual-create");
  });

  test("学科 Tab：切换学科后数据隔离（英语一不显示 828 卡片）", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoAllCardsGroup(page);
    // 等待学科 Tab 事件绑定稳定（并行 worker 下 HMR 偶发未就绪）
    await page.waitForTimeout(300);
    // 学科 Tab 高亮 828 物理化学
    await expect(page.getByRole("button", { name: "828 物理化学" }).first()).toHaveClass(/text-white/);
    // 切到「全部」子视图（card-grid 仅在全部视图渲染；默认是「待复习」复习视图）
    await page.getByRole("button", { name: "全部", exact: true }).first().click();
    await page.waitForTimeout(200);
    // 全部卡片工作空间显示 1 张卡片
    await expect(page.locator(".card-grid .study-card").first()).toBeVisible();

    // 切换到 英语一（无卡片）→ 学科 Tab 切换后回到学科概览
    await page.getByRole("button", { name: "英语一" }).first().click();
    await page.waitForTimeout(300);
    // 英语一卡片组网格：全部卡片组 0 张
    await expect(page.locator(".card-grid .study-card")).toHaveCount(0);
    // 不出现 828 的卡片内容
    await expect(page.getByText("理想气体恒温过程熵变公式")).toHaveCount(0);

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "cards-subject-isolation");
  });

  test("卡片组：新建卡片组 + 组内新建卡片 + 组内复习", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoAllCardsGroup(page);
    // 返回成长卡片首页（卡片组工作空间 → 管理页）
    await page.getByRole("button", { name: "← 返回" }).click();
    // 学科概览卡片组网格中新建卡片组：点击分类网格中的「新建卡片组」（页面顶部还有一个只滚动不展开的同名按钮，须点 last）
    await page.getByRole("button", { name: /新建卡片组/ }).last().click();
    await page.getByPlaceholder("最多 30 字").fill("我的公式");
    await page.getByRole("button", { name: "创建", exact: true }).click();
    // 卡片组卡以 role=button 渲染；避免与 toast「已新建卡片组：我的公式」strict mode 冲突
    await expect(page.getByRole("button", { name: /我的公式/ }).first()).toBeVisible();

    // 进入「我的公式」卡片组 → 组内出现「新建卡片」按钮并可新建（组内复习能力）
    await page.locator('[role="button"]', { hasText: "我的公式" }).first().click();
    await expect(page.getByRole("button", { name: "新建卡片" })).toBeVisible();
    // 组内新建一张卡片，验证进入卡片组复习工作空间
    await createCardViaModal(page, "E2E组内卡片");

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "cards-category");
  });

  test("刷新后卡片组保留（学科隔离）", async ({ page }) => {
    const collector = attachConsoleCollector(page);

    await gotoAllCardsGroup(page);
    await page.getByRole("button", { name: "← 返回" }).click();
    await page.getByRole("button", { name: /新建卡片组/ }).last().click();
    await page.getByPlaceholder("最多 30 字").fill("刷新保留卡片组");
    await page.getByRole("button", { name: "创建", exact: true }).click();
    // 卡片组卡以 role=button 渲染；避免与 toast「已新建卡片组：刷新保留卡片组」strict mode 冲突
    await expect(page.getByRole("button", { name: /刷新保留卡片组/ }).first()).toBeVisible();

    await page.waitForTimeout(600);
    await page.reload();
    await page.getByRole("button", { name: "成长卡片" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByRole("heading", { name: "成长卡片" })).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "828 物理化学", exact: true }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /全部卡片/ }).first().click();
    await page.getByRole("button", { name: "← 返回" }).click();
    await expect(page.getByRole("button", { name: /刷新保留卡片组/ }).first()).toBeVisible();

    const issues = collector.getIssues();
    expectNoCriticalConsoleIssues(issues, "cards-category-reload");
  });
});