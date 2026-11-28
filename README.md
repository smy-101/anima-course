# Anima × ComfyUI 学习课程

以 Anima × ComfyUI 为载体、教"AI 生图的一般方法"的循序渐进课程站：14 天、六个阶段、一条双轨路径（工作流 + 提示词），外加一层可搜索的参考（节点字典、标签字典、排错速查、资源）和一个可选择加入的成人附录。

每个参数都标为**起点值**，练习的目的是让学习者用固定种子做出自己的对照图。每页带来源徽章与核实日期。

- 建设方案（内容模型、课程主线、迁移流程、路线图）：[`docs/学习网站方案.md`](docs/学习网站方案.md)
- 原始笔记（一手资料，不参与构建）：[`source/`](source/)

## 本地开发

```bash
npm install
npm run dev          # Windows 浏览器打开 http://127.0.0.1:4321/anima-course/（项目在 WSL 也能访问；别用 localhost，见下）
npm run build        # 构建到 dist/，随后 pagefind 自动建索引（postbuild）
npm run check:site   # 待补图清单 + 死链 + 站点地图 + 未渲染的加粗 + 文风检查（文风违规在 reports/prose-lint.json；除待补图外任一项有问题都退出码 1）
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

本地链接带 base：`http://127.0.0.1:4321/anima-course/`。别用 `localhost`：本机 Node 把它解析成 `::1`，而 dev / preview 只监听 IPv4 回环，WSL 镜像网络不转发 `::1`，Windows 浏览器会打不开。

## 目录

```
source/                 原始 7 份笔记（一手资料）
src/content/            内容（六个 Content Collections，schema 见 src/content.config.ts）
  lessons/              课程：18 篇，阶段 0–5 已全部迁移（14 天路径）+ 2 篇开发者选修
  nodes/                节点卡（84 张，L0–L8 + 社区节点 + "Anima 为什么不用它"的 SD 系节点），文件名 = 英文类名
  tags/                 标签卡（340 张：四段式全部 SFW 标签 + 常用负向项），文件名 = slug
  troubleshooting/      排错条目：现象 → 先调 → 再调 → 不要
  resources/            参数基线、启动参数、模型清单、模板、工作流文件、误区、链接、换模型时什么不变
  nsfw/                 成人附录（构建开关 NSFW）：规则、词表、负向、模板、合规
src/pages/              路由：/ 阶段地图、/lessons/[id]、/nodes、/tags、/troubleshooting、/resources、/tools、/nsfw、/search
src/components/         FigureGallery、Toc（本页目录）、SourceBadge、Icon（内联 SVG）、Acceptance、AgeGate、PromptLint（提示词检查器）、LabLog（实验记录本）
src/lib/               prompt-lint.ts（提示词检查器规则）、lab-log.ts（实验记录本规则）、prose-lint.ts（文风硬规则）：纯函数，tests/ 有测试；client-filter.ts（列表页即时筛选）、env.ts（模板里用的 url()）
src/lib/client-filter.ts 列表页的即时筛选（标签 / 节点 / 排错共用：计数、无结果提示）
scripts/                check-site.mjs（构建后检查）、prose-lint.mjs（文风检查）、satteri-base-links.mjs（正文链接加 base）、satteri-table-wrap.mjs（正文表格包滚动容器）、figures/（补图：出图、界面截图、转 WebP、转工作流 JSON、把工作流嵌进 PNG）
.github/workflows/      deploy.yml → GitHub Pages
```

## 写内容

每篇内容都是带 frontmatter 的 Markdown；frontmatter 字段由 `src/content.config.ts` 的 schema 校验，构建时缺字段会直接报错。

- 改内容前先读 `docs/文风.md`：它的硬规则由 `npm run check:site` 里的文风检查（prose-lint）强制，违规退出码 1；软规则靠通读。

- **课程**：`stage` / `order` 决定顺序；`acceptance` 是可勾选的验收清单；`figures[]` 省略 `src` 即渲染"待补图"占位并进入 `npm run check:site` 的清单。补图用 `scripts/figures/`：先在开着 ComfyUI 的机器上 `python figures.py <组>` 出 PNG 到 `figures-out/`（不入库），再 `node scripts/figures/prepare-site.mjs` 转成 `src/assets/figures/<id>.webp` 并自动写入 `src: ../../assets/figures/<id>.webp`。
- **界面截图**：`node scripts/figures/screenshots.mjs`（可加 `--only <id,…>`）。它用 Windows 上的 Chrome 无头模式打开本机 ComfyUI 前端，在页面里用前端自己的接口把画面摆好再截，输出到 `figures-out/screens/`；这类图按原始 2 倍分辨率存（`prepare-site.mjs` 的 MAP 里单独给了 `edge`），画廊里点开可以看原尺寸。
- **正文链接**写站内绝对路径（`/nodes/KSampler/`），构建时自动加 base。
- **节点**卡片文件名保留类名大小写；**标签**卡片文件名用小写连字符 slug。
- `verified` 写 `YYYY-MM-DD`；`sources` 的 `badge` 只能是 官方 / 源码 / 作者 / 平台 / 社区 / Danbooru。
- 改过 Markdown 处理配置（`astro.config.mjs` 里的 `markdown`）后要清掉内容层缓存：`rm -rf .astro node_modules/.astro`，否则已渲染的正文不会重新处理。

## 界面与样式

- 设计令牌（配色、字号、间距、圆角、动效）全在 `src/styles/global.css` 顶部的 `:root`；页面与组件只用令牌，不写裸色值。深色令牌因选择器不同写了两遍（跟随系统的媒体查询 + 手动切换的 `[data-theme="dark"]`），改一处要同步另一处。
- 方向是内容优先的极简：中性灰 + 单一主色，层级靠字号 / 间距 / 对比；品红只用于"提示词练习"这一种语义标记。
- 对比度：正文 ≥ 4.5:1，大字与控件描边、焦点环 ≥ 3:1。状态色因此分成"文字用深色、填充用亮色"两套（`--ok` / `--ok-fill` 等）。最小字号 12px，移动端正文保持 16px。
- 中文正文用系统自带的 CJK 字体，不加载 Web 字体；图标用 `Icon.astro` 的内联 SVG，不用 emoji。
- 类名是模板和 React 组件共用的契约，改名要一起改。新页面先用 `global.css` 里已有的组件（`.page-head`、`.cards`、`.pill`、`.note`、`.table-wrap`、`.filter-bar` 等），别另起一套。
- 对照图在画廊里是缩略图，外面包了一层链接（`.figure-open`）到原尺寸文件：生成的图看不出差别，界面截图全靠点开才读得出字，所以新加的图不要绕过这层链接。
- 搜索索引只收 `<main>` 里的内容（`Base.astro` 的 `data-pagefind-body`），页头导航和页脚不进索引。放在 `<main>` 里的导航文字（面包屑、目录、翻页器、无结果时的提示）要带 `data-pagefind-ignore`，否则每个页都会因为这些词被搜到。没有可查内容的页面（搜索页、404）给 `Base` 传 `noSearch`。

## 部署

推到 `main` 自动走 `.github/workflows/deploy.yml`（`withastro/action` → `actions/deploy-pages`）。构建之后依次跑 `npm run check:site`、`npm run check`、`npm test`，也就是收尾的四项；任一项失败就不部署。仓库 Settings → Pages → Source 选 **GitHub Actions**。`BASE_PATH` / `SITE_URL` 由 workflow 从仓库名自动推出；要下线成人附录，把 workflow 里的 `NSFW` 改为 `'false'`。

示例图原图（内嵌工作流的 PNG）放 GitHub Releases，站内只提交优化副本。原图留在 `figures-out/`（git-ignored），`python scripts/figures/embed_all.py` 会给每张嵌上工作流并打成 `figures-out/anima-course-figures-originals.zip`（文件名即图 id），把这个 zip 传到 Releases 即可。重新生成的办法见 `scripts/figures/figures.py` 顶部注释与 `docs/学习网站方案.md` §7。

## 迁移状态

| 内容 | 状态 |
|---|---|
| 课程阶段 0–5（18 篇） | 已迁移 |
| 节点卡 L0–L8 + 社区节点（UltimateSDUpscale、FaceDetailer 等） | 已迁移 |
| 标签字典 | 四段式的 SFW 标签已全部建卡（340 张）；成人词表不进标签字典，放在成人附录（范围见下一行） |
| 排错速查 | 51 条 |
| 启动参数与 Attention 后端（《节点详解》§5.5） | 已迁移（`resources/startup-args.md`） |
| 概念可迁移：换模型时什么不变、什么要换（《节点详解》§4.1–4.9） | 已迁移（`resources/transfer.md`） |
| 成人附录 | 规则、合规、词表（到 `nsfw` 级：表情 / 身体 / 衣物 / 展示与暗示）、负向、sensitive～nsfw 级模板（纯文字）；性行为 / 体液 / 群交 / 癖好 / 极端标签不进站 |
| 开发者选修（《补充B》：HTTP API / 无界面 / 自定义节点） | 已迁移为阶段 5 末尾的两篇选修课（`elective: true`，不计入 14 天进度） |
| 示例图（76 处占位，清单见 `npm run check:site`） | 63 张已补：54 张对照图（`scripts/figures/figures.py`，全部用官方 `anima-base-v1.0` 等权重）+ 9 张界面截图（`scripts/figures/screenshots.mjs`：界面地图、官方模板画布、问题页、L0 / L1 连线、子图内部对照、收成子图的画布、节点库里的蓝图、输出目录结构）。剩 13 张：8 张等插件或角色 LoRA（WD14、Impact Pack、UltimateSDUpscale、Depth Anything 3 节点、Civitai 角色 LoRA），4 张在 v1.0 与 preview3 上都没复现课程说法（标签传染、eye contact 标签优势、NAG、路线 A 背景加物件）；其中标签传染、eye contact、路线 A 三处已在课里注明本站没复现 |
| L0–L8 工作流 JSON、四个工具（实验记录本 / 提示词检查器 / 排错向导 / 误区自测） | 提示词检查器已做（`/tools/prompt-lint/`，18 条规则）；L0 / L1 / L2 / L3 / L4 / L5 / L6 / L7 / L8 的工作流 JSON 由 `scripts/figures/to_workflow.py --all` 生成到 `public/workflows/`（自动布局，拖进画布即可加载），下载入口在 `/resources/workflows/`；实验记录本已做（`/tools/lab-log/`，7 条规则）；排错向导、误区自测待做 |
| 示例图原图（内嵌工作流的 PNG）→ GitHub Releases | 未上传。`figures-out/anima-course-figures-originals.zip` 已打好，传到 Releases 即可；站内目前只有 9 个工作流 JSON 可下（`/resources/workflows/`），没有指向原图的链接 |

## 技术栈

Astro 7 + MDX + React（islands）+ Pagefind（静态搜索，自动中文分词）+ `@astrojs/sitemap`（成人附录、搜索页、404 不进站点地图，由 `check:site` 把关）。纯静态，无后端；进度与实验记录存浏览器 localStorage，可导出 / 导入 JSON。
