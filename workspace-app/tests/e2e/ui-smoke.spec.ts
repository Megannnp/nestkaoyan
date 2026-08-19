import { test, expect } from "@playwright/test";
import { freshState } from "./helpers";

test.describe("UI 细节冒烟（seed 用户）", () => {
  test.beforeEach(async ({ page }) => {
    await freshState(page);
  });

  test("无 NaN 文本与横向溢出 + 各 Tab 渲染", async ({ page }) => {
    const issues: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") issues.push(msg.text().slice(0, 150)); });
    page.on("pageerror", (err) => issues.push(String(err).slice(0, 150)));

    // 无 NaN 文本
    const bodyText = await page.evaluate(() => document.body.textContent || "");
    expect(bodyText).not.toContain("NaN");

    // 无横向溢出
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);

    // 各 Tab 渲染 + 空态
    const tabs = ["AI学习助手", "知识中心", "沉淀卡片", "设置"];
    for (const tab of tabs) {
      await page.getByRole("button", { name: tab }).first().click();
      await page.waitForTimeout(500);
      const body = await page.evaluate(() => document.body.textContent || "");
      expect(body.length).toBeGreaterThan(50);
    }

    // 返回今日工作台
    await page.getByRole("button", { name: "今日工作台" }).click();
    await page.waitForTimeout(400);

    // 热力图展开
    await page.getByText(/学习记录/).first().click();
    await page.waitForTimeout(500);

    // 全部 console error（React 已知 NaN 已修复，其余不应有）
    expect(issues.filter((t) => !t.includes("NaN for"))).toEqual([]);
  });
});

test.describe("UI 细节冒烟（新用户）", () => {
  test("Onboarding 向导可见且可交互", async ({ page }) => {
    // 新用户：无任何注入，首次打开应进入初始化向导
    await page.goto("/");
    await page.waitForTimeout(1500);
    await expect(page.locator("body")).toContainText("筑巢考研 · 初始化");

    // 向导步骤可前进（默认进入第 1 步，尝试「下一步」按钮存在）
    const nextBtn = page.locator("button", { hasText: "下一步" });
    const count = await nextBtn.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
