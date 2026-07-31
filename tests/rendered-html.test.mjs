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
  assert.match(html, /筑巢考研/);
  assert.match(html, /Learning Agent/);
  assert.match(html, /今日任务/);
  assert.match(html, /核心工作区/);
  assert.match(html, /今日工作台/);
  assert.match(html, /AI学习助手/);
  assert.match(html, /知识中心/);
  assert.match(html, /成长卡片/);
  assert.match(html, /设置/);
  assert.match(html, /学习记录/);
  assert.match(html, /Layer 2/);
  assert.match(html, /第一轮/);
  assert.match(html, /掌握度/);
  assert.match(html, /开始学习/);
  assert.match(html, /记录结果/);
  assert.match(html, /熵变计算适用条件/);
  assert.match(html, /828 物理化学/);
  assert.match(html, /回看：熵变计算适用条件/);
  assert.match(html, /哈尔滨工业大学/);
  assert.match(html, /完成 3 道基础辨析题/);
  assert.match(html, /AI推荐/);
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