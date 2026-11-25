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
npm run check:site   # 待补图清单 + 死链 + 文风检查（文风违规在 reports/prose-lint.json；死链或名单内违规则退出码 1）
npm run check        # astro check：TS / .astro 类型检查
npm test             # 提示词检查器与文风检查的规则测试（node --test）
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
  lessons/              课程：18 篇，阶段 0–5 已全部迁移（14 天路径）+ 2 篇开发者选修
  nodes/                节点卡（83 张，L0–L8 + 社区节点 + "Anima 为什么不用它"的 SD 系节点），文件名 = 英文类名
  tags/                 标签卡（340 张：四段式全部 SFW 标签 + 常用负向项），文件名 = slug
  troubleshooting/      排错条目：现象 → 先调 → 再调 → 不要
  resources/            参数基线、启动参数、模型清单、模板、误区、链接、换模型时什么不变
  nsfw/                 成人附录（构建开关 NSFW）：规则、词表、负向、模板、合规
src/pages/              路由：/ 阶段地图、/lessons/[id]、/nodes、/tags、/troubleshooting、/resources、/tools、/nsfw、/search
src/components/         FigureGallery、SourceBadge、Acceptance、AgeGate、PromptLint（提示词检查器）
src/lib/prompt-lint.ts  提示词检查器的规则与修正器（纯函数，tests/ 有测试）
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

## 迁移状态

| 内容 | 状态 |
|---|---|
| 课程阶段 0–5（18 篇） | 已迁移 |
| 节点卡 L0–L8 + 社区节点（UltimateSDUpscale、FaceDetailer 等） | 已迁移 |
| 标签字典 | 四段式的 SFW 标签已全部建卡（340 张）；成人词表待补 |
| 排错速查 | 51 条 |
| 启动参数与 Attention 后端（《节点详解》§5.5） | 已迁移（`resources/startup-args.md`） |
| 概念可迁移：换模型时什么不变、什么要换（《节点详解》§4.1–4.9） | 已迁移（`resources/transfer.md`） |
| 成人附录 | 规则、合规、词表（到 `nsfw` 级：表情 / 身体 / 衣物 / 展示与暗示）、负向、sensitive～nsfw 级模板（纯文字）；性行为 / 体液 / 群交 / 癖好 / 极端标签不进站 |
| 开发者选修（《补充B》：HTTP API / 无界面 / 自定义节点） | 已迁移为阶段 5 末尾的两篇选修课（`elective: true`，不计入 14 天进度） |
| 示例图（76 处占位，清单见 `npm run check:site`） | 待换机器补图 || L0–L8 工作流 JSON、四个工具（实验记录本 / 提示词检查器 / 排错向导 / 误区自测） | 提示词检查器已做（`/tools/prompt-lint/`，18 条规则）；其余三个工具与工作流 JSON 待做 |

## 技术栈

Astro 7 + MDX + React（islands）+ Pagefind（静态搜索，自动中文分词）。纯静态，无后端；进度与实验记录存浏览器 localStorage，可导出 / 导入 JSON。
