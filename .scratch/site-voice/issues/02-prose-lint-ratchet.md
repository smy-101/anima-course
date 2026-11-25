# 02: prose-lint 规则模块 + 棘轮脚本

**What to build:** 让 `npm run check:site` 多一段「文风检查」，对 `src/content` 的三个集合（lessons / troubleshooting / resources）跑 6 条硬规则，对 nodes / tags 只跑加粗与引号两条。这是整条流水线的 tracer bullet：它跑在现在的站上，应该精确报出已知现状——19 课加粗超标、13 个标题超 20 字、20 个「## 目标」、19 个「## 验收」、20 课含直引号。

先读：`.scratch/site-voice/spec.md`（Implementation Decisions 里的规则与计数口径）、`docs/文风.md`（01 的产物，规则的权威表述）、`src/lib/prompt-lint.ts` 与 `tests/prompt-lint.test.mjs`（形制先例：纯函数规则模块 + `node --test` 直接 import `.ts`）、`scripts/check-site.mjs`（构建后检查先例：死链退出码 1）。

决定：
- 规则模块是纯函数：输入 frontmatter 对象 + 正文字符串 + 集合名，输出违规列表（规则 id、严重度、位置、说明）。
- 计数口径：加粗只数正文 `**…**`，代码块与行内代码内不计，一对算一处；字数按 CJK 字符数；导语长度按 `summary` 字符数；标题长度按去掉路径前缀（形如 `L4 · `）后的字符数（含空格、英文与标点）；固定区块重名只对课程集合生效；引号规则查代码跨度之外的正文，以及按 YAML 解析后的 frontmatter 字符串值。
- 棘轮：默认报告模式（退出码 0，报告落 `reports/`）；一份「已改写」名单（先为空）里的文件若有任何硬规则违规，退出码 1。
- 报告要按文件列出每条违规的位置与说明，改写者能照着改。

**Blocked by:** 01

**Status:** done

- [x] `npm test` 里有 prose-lint 的用例：6 条规则各有「命中」和「豁免」两例（代码块内加粗不计；路径前缀不计入标题长度；非课程集合不查固定区块重名；代码跨度内的直引号不计；frontmatter 外层 YAML 引号不计）
- [x] `npm run check:site` 在当前内容上报出：lessons 加粗超标 ≥ 19、标题超长 ≥ 13、「## 目标」= 20、「## 验收」≥ 19、含直引号的文件 lessons 20 / resources 9 / nodes 32 / tags 64 左右；nodes / tags 的加粗超标约 33 + 40
- [x] 名单为空时退出码 0；往名单里放一个故意违规的 fixture 文件后退出码 1
- [x] AGENTS.md「收尾步骤」第 2 条的描述更新为「列出待补图、死链与文风违规」
- [x] 四项收尾检查全过（build / check:site / astro check / test）
