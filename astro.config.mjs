// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';

// GitHub Pages 项目站点：https://<user>.github.io/<repo>/
// 部署前把 SITE_URL 换成你的地址；BASE_PATH 默认为仓库名，两者都可用环境变量覆盖。
const SITE_URL = process.env.SITE_URL ?? 'https://USERNAME.github.io';
const BASE_PATH = process.env.BASE_PATH ?? '/anima-course';

// NSFW 附录构建开关：NSFW=false 时 /nsfw/* 整个不生成、导航不出现。
// 读取逻辑在 src/lib/env.ts；在 GitHub Actions 的 deploy.yml 里决定发布值。

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  integrations: [mdx(), react()],
  markdown: {
    shikiConfig: { theme: 'github-dark', wrap: true },
  },
});
