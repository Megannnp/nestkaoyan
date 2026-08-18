# 筑巢考研工作台（Kaoyan Exam Workspace）

> 一套「逆向设计 × 7核 × 4层 × 6轮」的 **AI 考研学习系统**（双轨授权：个人免费 / 商用付费）
> 目标先行 → 知识图谱 → 动态计划 → Agent 闭环，帮助备考者从「知道」到「会用」。

- **内核**：从真题抽出核心考点，按「理解 → 展开 → 练习 → 综合」4 层递进，整门课走「打底 → 连线 → 补漏 → 提速 → 真题 → 冲刺」6 轮
- **形态**：前端 React（Next.js 16 / vinext）+ 后端 Cloudflare Worker 全栈，数据默认 localStorage（免运维）
- **真题**：内置 72 套公共课真题的声明与命名规范（政治 / 英语一 / 英语二 / 数学二），PDF 按规范放置即可原卷浏览 + AI 讲解

## 快速开始

代码与完整文档在 [`workspace-app/`](./workspace-app)：

```bash
cd workspace-app
npm install
cp .env.example .dev.vars      # 填 DEEPSEEK_API_KEY（可选）
npm run dev                    # http://localhost:3000
npm run build                  # 生产构建（产出 dist/）
```

## 文档

- [README](./workspace-app/README.md) · [安装](./workspace-app/INSTALL.md) · [使用](./workspace-app/USAGE.md)
- [部署](./workspace-app/DEPLOY.md) · [交付自检](./workspace-app/CHECKLIST.md) · [架构](./workspace-app/docs/ARCHITECTURE.md)

## 开源说明

- **授权**：双轨——个人 / 学生 / 教育 / 非营利**免费**使用、修改、再分发（保留版权声明）；**商用需购买授权**。详见 [LICENSE](./LICENSE)。
- **真题 PDF 不含在仓库**（版权材料，见 `workspace-app/public/papers/README.md` 放置规范）
- **测试**：单元 78/78 ✅ · E2E 64/64 ✅（Playwright）

© 2026 重庆语梦筑巢科技有限责任公司 · 筑巢考研工作台™

