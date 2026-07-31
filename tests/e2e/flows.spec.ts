import { test, expect, type Page } from "@playwright/test";
async function fresh(p: Page){await p.goto("/");await p.evaluate(()=>localStorage.clear());await p.reload();}
test("dashboard loop",async({page})=>{await fresh(page);await page.getByRole("button",{name:"开始学习"}).first().click();await expect(page.getByText("正在学习中")).toBeVisible();await page.getByRole("button",{name:"结束学习"}).first().click();await expect(page.getByLabel("记录学习结果")).toBeVisible();});
test("knowledge upload",async({page})=>{await fresh(page);await page.getByRole("button",{name:"知识中心"}).click();await page.getByRole("button",{name:"学习资料"}).click();await page.getByRole("button",{name:"上传资源"}).click();await expect(page.getByLabel("AI识别资料")).toBeVisible();});
test("cards create review",async({page})=>{await fresh(page);await page.getByRole("button",{name:"成长卡片"}).click();await expect(page.getByText("成长卡片")).toHaveCount(2);});
