# 安装说明（INSTALL.md）

## 前置要求

- **Node.js ≥ 22.13**（本地开发 / 构建）

## 本地开发

```bash
npm install
cp .env.example .dev.vars   # 可选：填 DEEPSEEK_API_KEY（不填则 AI 降级为演示）
npm run dev                 # http://localhost:3000
```

## 生产构建

```bash
npm run build               # 产出 dist/（Cloudflare Workers 全栈，含自动生成的 wrangler.json）
npm run start               # 本地预览生产版
```

## 真题 PDF（可选）

1. 准备带文本层的真题 PDF（可复制/搜索），按 [`public/papers/README.md`](./public/papers/README.md) 命名放入 `public/papers/`；
2. 重新 `npm run build`，阅读器中即自动以原卷浏览。

## 部署

见 [DEPLOY.md](./DEPLOY.md)（Cloudflare Workers：`wrangler login` → `wrangler secret put DEEPSEEK_API_KEY` → `npm run deploy`）。

## 测试

```bash
npm run test:unit           # 单元测试
npm test                    # 构建 + 渲染冒烟
npx playwright test         # E2E（需 dev server，默认 localhost:3000）
```
