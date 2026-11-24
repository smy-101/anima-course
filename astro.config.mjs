// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import { satteri } from '@astrojs/markdown-satteri';
import { satteriBaseLinks } from './scripts/satteri-base-links.mjs';

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
  // dev / preview 固定监听 IPv4 回环。原因：本机 Node 把 localhost 解析成 ::1，Vite 默认只绑 IPv6 回环，
  // 而 WSL 镜像网络只把 IPv4 回环转发到 Windows——结果 Windows 浏览器打不开。绑 127.0.0.1 两边都通，且不暴露到局域网。
  // 需要局域网访问时设 DEV_HOST=0.0.0.0。
  // Astro 7 起 server 配置同时作用于 `astro dev` 与 `astro preview`，没有单独的 preview 键。
  server: { host: process.env.DEV_HOST ?? '127.0.0.1', port: 4321 },
  markdown: {
    // Sätteri（默认处理器）+ 给正文链接加 base 的插件
    processor: satteri({ hastPlugins: [satteriBaseLinks()] }),
    shikiConfig: { theme: 'github-dark', wrap: true },
  },
});
