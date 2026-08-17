import { access, cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

// Packages Sites metadata and migrations after Vite finishes compiling.
export function sites(): Plugin {
  let root = process.cwd();

  return {
    name: "sites",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    async closeBundle() {
      const outputDirectory = resolve(root, "dist", ".openai");
      const hostingConfig = resolve(root, ".openai", "hosting.json");
      const drizzleSource = resolve(root, "drizzle");

      await rm(outputDirectory, { recursive: true, force: true });
      await mkdir(outputDirectory, { recursive: true });

      if (await exists(hostingConfig)) {
        await cp(hostingConfig, resolve(outputDirectory, "hosting.json"));
      }
      if (await exists(drizzleSource)) {
        await cp(drizzleSource, resolve(outputDirectory, "drizzle"), {
          recursive: true,
        });
      }

      // 2026-08-05：中文 PDF 文本提取依赖 pdfjs-dist 的 CMap 字符映射表（*.bcmap）。
      // Vite 不会自动打包 node_modules 目录，需要在 build 完成后复制到客户端静态目录。
      // 部署后 cMapUrl 使用站点根相对路径 "/cmaps/"。
      const clientDir = resolve(root, "dist", "client");
      const cmapSource = resolve(root, "node_modules", "pdfjs-dist", "cmaps");
      if (await exists(cmapSource)) {
        await cp(cmapSource, resolve(clientDir, "cmaps"), { recursive: true });
      }
    },
  };
}