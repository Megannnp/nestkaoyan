# Kaoyan Exam Workspace 私有部署 — Docker 镜像
# 构建：docker build -t kaoyan-exam-workspace .
# 运行：见 docker-compose.yml（推荐）或：
#   docker run -d -p 3000:3000 -v $(pwd)/papers:/app/public/papers kaoyan-exam-workspace
#
# 数据说明：业务数据默认存在浏览器 localStorage（零服务端数据库），
# 真题 PDF 通过卷挂载 /app/public/papers（构建产物不含 PDF，见 public/papers/README.md）。

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 构建产物 dist/（vinext：Cloudflare Workers 全栈，本地 start 亦基于 dist 静态服务）
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
# 运行时文件：产物 + 依赖 + 公开资源（papers 目录由卷挂载，避免把版权 PDF 打进镜像）
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/.openai ./openai
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/vite.config.ts ./vite.config.ts
COPY --from=builder /app/postcss.config.mjs ./postcss.config.mjs
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# 访问密码自动生成入口（KAOYAN_AUTH=1 默认启用；数据卷 /app/data 持久化密码）
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh
EXPOSE 3000
# PORT 环境变量由 vinext start 读取（默认 3000）；.wrangler 日志目录需可写
RUN mkdir -p .wrangler
ENTRYPOINT ["./entrypoint.sh"]
CMD ["npm", "run", "start"]
