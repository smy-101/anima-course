# 11: 棘轮切成全量硬失败 + 收尾

**What to build:** 全部内容改写完后，把文风检查从「名单内强制」切成「全部强制」：任何硬规则违规让 `npm run check:site` 退出码 1，名单机制退场。顺手把文档收尾。

先读：`.scratch/site-voice/spec.md`、`docs/文风.md`、`docs/文风依据.md`（若存在）。

要做：
- 移除「已改写」名单及其配置；三个集合 + 字典卡集合的硬规则违规一律退出码 1。
- README「写内容」和 AGENTS.md「收尾步骤」补一句：改内容前读 `docs/文风.md`，文风违规会在 `check:site` 报出。
- `docs/文风.md` 每条规则的来源编号补齐（来自 `docs/文风依据.md`，含 H6 / S7）；依据文档若与暂行数值有冲突，以依据为准更新规范并记一条 ADR。
- `GLOSSARY.md` 若实现过程中冒出新词（如报告里的规则 id 对应的中文叫法），补进去。

**Blocked by:** 04, 05, 06, 07, 08, 09, 10

**Status:** ready-for-agent

- [ ] 名单机制不再存在；故意在一个任意的 lessons / troubleshooting / resources / nodes / tags 文件里加一处违规，`check:site` 退出码 1
- [ ] README 与 AGENTS.md 已更新
- [ ] `docs/文风.md` 每条规则有来源编号，无「待依据文档」字样
- [ ] 四项收尾检查全过
