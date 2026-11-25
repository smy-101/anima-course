# 10: 字典卡 lint 修复（节点 83 + 标签 340）

**What to build:** 按 lint 报告修掉节点卡和标签卡上多余的加粗（预计 33 张节点、40 张标签）和 ASCII 直引号（lint 实测 32 张节点、68 张标签），不重写。字典卡的 `desc` 字段是刻意的短语体，保持。

先读：`docs/文风.md`（加粗约定那一条）、`.scratch/site-voice/spec.md`。跑 `npm run check:site` 拿到报告，照着改。

只做两类改动：删掉不是控件 / 节点名、也不是「每节一句关键话」的加粗（通常是列表项开头的名词高亮）；把代码跨度之外的 `"…"` 换成 “…”。frontmatter 里若字符串值本身用双引号包裹且内部含 `\"`，改成单引号包裹或块标量，保证 YAML 仍能解析、值不变。不加内容、不删内容。

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `check:site` 的报告里 nodes / tags 集合加粗超标为 0、直引号为 0
- [ ] 改过的 frontmatter 仍能被 Astro 解析（`npm run build` 通过），字符串值逐一未变
- [ ] 没有 `desc` 字段被改写；frontmatter 结构字段未动
- [ ] 四项收尾检查全过
