# Anima × ComfyUI 学习课程

以 Anima × ComfyUI 为载体、教"AI 生图的一般方法"的循序渐进课程站：14 天、六个阶段、一条双轨路径（工作流 + 提示词），外加一层可搜索的参考（节点字典、标签字典、排错速查、资源）和一个可选择加入的成人附录。

每个参数都标为**起点值**，练习的目的是让学习者用固定种子做出自己的对照图。每页带来源徽章与核实日期。

- 建设方案（内容模型、课程主线、迁移流程、路线图）：[`docs/学习网站方案.md`](docs/学习网站方案.md)
- 原始笔记（一手资料，不参与构建）：[`source/`](source/)

## 本地开发

```bash
npm install
npm run dev          # Windows 浏览器打开 http://localhost:4321/anima-course/（项目在 WSL 也能访问）
npm run build        # 构建到 dist/，随后 pagefind 自动建索引（postbuild）
npm run check:site   # 待补图清单 + 死链检查（死链则退出码 1）
npm run check        # astro check：TS / .astro 类型检查
npm run preview      # 预览 dist/，地址同上
```

环境变量：

| 变量 | 默认 | 作用 |
|---|---|---|
| `BASE_PATH` | `/anima-course` | GitHub Pages 项目站点的子路径（= 仓库名） |
| `SITE_URL` | `https://USERNAME.github.io` | 站点根地址 |
| `NSFW` | `true` | `false` 时 `/nsfw/*` 整个不生成，导航与页脚也不出现 |
| `DEV_HOST` | `127.0.0.1` | dev / preview 的监听地址。设为 `0.0.0.0` 可让局域网访问 |

本地链接带 base：`http://localhost:4321/anima-course/`。

## 目录

```
source/                 原始 7 份笔记（一手资料）
src/content/            内容（六个 Content Collections，schema 见 src/content.config.ts）
  lessons/              课程：阶段 0–2 已迁移，3–5 待迁移
  nodes/                节点卡，文件名 = 英文类名
  tags/                 标签卡，文件名 = slug
  troubleshooting/      排错条目：现象 → 先调 → 再调 → 不要
  resources/            参数基线、模型清单、模板、误区、链接
  nsfw/                 成人附录（构建开关 NSFW）
src/pages/              路由：/ 阶段地图、/lessons/[id]、/nodes、/tags、/troubleshooting、/resources、/nsfw、/search
src/components/         FigureGallery、SourceBadge、Acceptance、AgeGate
scripts/                check-site.mjs（构建后检查）、satteri-base-links.mjs（正文链接加 base）
.github/workflows/      deploy.yml → GitHub Pages
```

## 写内容

每篇内容都是带 frontmatter 的 Markdown；frontmatter 字段由 `src/content.config.ts` 的 schema 校验，构建时缺字段会直接报错。

- **课程**：`stage` / `order` 决定顺序；`acceptance` 是可勾选的验收清单；`figures[]` 省略 `src` 即渲染"待补图"占位并进入 `npm run check:site` 的清单，补图时把文件放进 `src/assets/figures/` 并填 `src: ../../assets/figures/xxx.png`。
- **正文链接**写站内绝对路径（`/nodes/KSampler/`），构建时自动加 base。
- **节点**卡片文件名保留类名大小写；**标签**卡片文件名用小写连字符 slug。
- `verified` 写 `YYYY-MM-DD`；`sources` 的 `badge` 只能是 官方 / 源码 / 作者 / 平台 / 社区 / Danbooru。
- 改过 Markdown 处理配置（`astro.config.mjs` 里的 `markdown`）后要清掉内容层缓存：`rm -rf .astro node_modules/.astro`，否则已渲染的正文不会重新处理。

## 部署

推到 `main` 自动走 `.github/workflows/deploy.yml`（`withastro/action` → `actions/deploy-pages`）。仓库 Settings → Pages → Source 选 **GitHub Actions**。`BASE_PATH` / `SITE_URL` 由 workflow 从仓库名自动推出；要下线成人附录，把 workflow 里的 `NSFW` 改为 `'false'`。

示例图原图（内嵌工作流的 PNG）放 GitHub Releases，站内只提交优化副本。

## 技术栈

Astro 7 + MDX + React（islands）+ Pagefind（静态搜索，自动中文分词）。纯静态，无后端；进度与实验记录存浏览器 localStorage，可导出 / 导入 JSON。
