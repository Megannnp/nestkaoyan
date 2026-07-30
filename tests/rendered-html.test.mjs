import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the kaoyan learning agent workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>筑巢考研工作台<\/title>/i);
  assert.match(html, /AI Workspace/);
  assert.match(html, /Learning Agent/);
  assert.match(html, /考试目标/);
  assert.match(html, /科目管理/);
  assert.match(html, /真题数据库/);
  assert.match(html, /知识图谱/);
  assert.match(html, /学习资源库/);
  assert.match(html, /设置/);
  assert.match(html, /Knowledge Center/);
  assert.match(html, /全部卡片/);
  assert.match(html, /资源与阅读/);
  assert.match(html, /当前科目/);
  assert.match(html, /下次复习/);
  assert.match(html, /录入题目/);
  assert.match(html, /上传资源/);
  assert.match(html, /AI First/);
  assert.match(html, /每日复盘/);
  assert.match(html, /导出数据/);
  assert.match(html, /成长卡片/);
  assert.match(html, /电子资料阅读器/);
  assert.match(html, /勾画与批注/);
  assert.match(html, /最近70天/);
  assert.match(html, /阅读分钟/);
  assert.match(html, /导入数据/);
  assert.match(html, /添加科目/);
  assert.match(html, /上传资源/);
  assert.match(html, /AI识别结果/);
  assert.match(html, /上传并识别/);
  assert.match(html, /添加知识点/);
  assert.match(html, /保存进度/);
  assert.match(html, /收藏页面/);
  assert.match(html, /相关真题/);
  assert.match(html, /当前位置/);
  assert.match(html, /新增批注/);
  assert.match(html, /记录学习结果/);
  assert.match(html, /开始计时/);
  assert.match(html, /备用任务/);
  assert.match(html, /周复盘/);
  assert.match(html, /月复盘/);
  assert.match(html, /全部科目/);
  assert.match(html, /今日学习时长/);
  assert.match(html, /完成任务/);
  assert.match(html, /新增\/重点知识点/);
  assert.match(html, /真题完成情况/);
  assert.match(html, /成长卡片复习/);
  assert.match(html, /掌握度变化/);
  assert.match(html, /统计与导出/);
  assert.match(html, /模型提供商/);
  assert.match(html, /资料解析模式/);
  assert.match(html, /提醒时间/);
  assert.match(html, /数据导入/);
  assert.match(html, /数据导出/);
  assert.match(html, /设为当前学习科目/);
  assert.match(html, /读取数据/);
  assert.match(html, /分析最近三套真题/);
  assert.match(html, /编辑科目/);
  assert.match(html, /编辑资源/);
  assert.match(html, /做题记录\/编辑/);
  assert.match(html, /查看来源/);
  assert.match(html, /今天只有两个小时/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/);
});

test("markdown requirements document is generated", async () => {
  const markdown = await readFile(new URL("../../筑巢考研工作台 MVP 产品需求文档.md", import.meta.url), "utf8");
  assert.match(markdown, /# .*考研工作台|筑巢考研工作台/);
  assert.match(markdown, /AI First，Manual Confirm/);
  assert.match(markdown, /用户负责提供资料/);
});

test("starter preview code has been removed from product entry files", async () => {
  const [page, layout, packageJson, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /SkeletonPreview|_sites-preview|codex-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(css, /\.hero-grid\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /\.hero-grid\.agent-only \.engine-panel\s*\{[^}]*display:\s*none/s);
  assert.doesNotMatch(page, /<span>资源名称<\/span>|<span>作者<\/span><input name="author"|<span>版本<\/span><input name="version"/);
});
