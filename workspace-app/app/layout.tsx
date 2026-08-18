import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import { ErrorBoundary } from "./lib/error-boundary";

export const metadata: Metadata = {
  title: "筑巢考研工作台",
  description: "基于 7 核 4 层 6 轮学习法的 AI 考研学习代理。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body><ErrorBoundary>{children}</ErrorBoundary></body>
    </html>
  );
}
