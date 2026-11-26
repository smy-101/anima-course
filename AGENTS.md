# AGENTS.md — anima-course

课程站的内容与结构方案在 `docs/学习网站方案.md`：写新课程先读 §4（课程主线）与 §6（内容模型）；补图读 §7；迁移原始笔记读 §8。原始笔记在 `source/`，是一手资料，站点内容全部是它的派生。

## 改动内容后的收尾步骤

改内容前先读 `docs/文风.md`，硬规则与软规则都在那里；硬规则由第 2 步强制，软规则靠通读。

1. `npm run build`——frontmatter 不合 schema 会在这里报错，错误信息给出文件与字段。
2. `npm run check:site`——列出待补图、死链与文风违规；死链与文风违规退出码 1。
3. `npx astro check`——类型检查。
4. `npm test`——提示词检查器与文风检查的规则测试（`tests/`，改 `src/lib/prompt-lint.ts` 或 `src/lib/prose-lint.ts` 后必跑）。

四项都过再提交。

## 按任务分支

- **写课程 / 节点 / 标签 / 排错**：照同目录已有文件的 frontmatter 写；字段含义见 `src/content.config.ts` 的注释。
- **正文里链站内页面**：写 `/lessons/…/`、`/nodes/…/` 这种根路径，不写 base；`scripts/satteri-base-links.mjs` 会加前缀。`.astro` 模板里用 `src/lib/env.ts` 的 `url()`。
- **改 `astro.config.mjs` 的 `markdown` 段**：先 `rm -rf .astro node_modules/.astro`，内容层缓存按文件摘要复用已渲染正文，配置变了也不会重渲染。
- **改界面 / 写新页面**：设计令牌与约定见 `src/styles/global.css` 顶部和 README 的「界面与样式」；类名是模板与 React 组件共用的契约。改完在浏览器里过一遍 375 / 768 / 1280 三个宽度和浅 / 深两套（dev server 的 `127.0.0.1:4321` 可从 chrome-devtools MCP 直接打开；页面很长时别截整页图，会卡住标签页）。
- **dev / preview 的监听地址**：已固定为 `127.0.0.1`（`server.host` / `preview.host`）。本机 Node 把 `localhost` 解析成 `::1`，Vite 默认只绑 IPv6 回环，WSL 镜像网络不转发它，Windows 浏览器会打不开；保持 IPv4 回环。
- **frontmatter 里写字符串**：含 `: `、引号或括号的值加引号；`note:` 尤其容易漏。
- **成人附录（`src/content/nsfw/`）**：纯文字。示例图一律不放进这个集合。
- **部署**：`.github/workflows/deploy.yml`；`NSFW` 开关在那里。

## 约定

- 节点卡文件名 = 英文类名，保留大小写（loader 用 `generateId` 保住）；标签卡文件名 = 小写连字符 slug。
- 每个数值都是"起点值"，行文里这样说；每条结论带来源徽章。
- 笔记里的元信息（勘误表、"对现有笔记的修改建议"、"补充清单"）不进站，勘误改写成 `resources/misconceptions.md` 的条目。

## Agent skills

### Issue tracker

Issues 和 spec 是仓库里的本地 markdown：`.scratch/<feature>/spec.md`、`.scratch/<feature>/issues/NN-<slug>.md`。见 `docs/agents/issue-tracker.md`。

### Triage labels

五个默认角色名即标签名（`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`），记在票文件的 `Status:` 行。见 `docs/agents/triage-labels.md`。

### Domain docs

单语境：根目录 `GLOSSARY.md`，ADR 在 `docs/adr/`。见 `docs/agents/domain.md`。
