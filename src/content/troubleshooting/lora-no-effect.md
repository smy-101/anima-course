---
symptom: "LoRA 没效果"
area: 工作流
first: "放好文件后按 R；确认文件标注\"兼容 Anima\""
then: "强度升到 1.0；Ctrl+B 对照确认贡献；训练底模（preview3 → v1.0）差太远就换"
dont: "两个 LoRA 同时拉满"
sources:
  - { badge: 社区, note: "《递进报告》§5 速查表与各级常见问题：综合官方、作者与社区" }
verified: 2026-11-24
---
Anima 只用 LoRA加载器（仅模型）；`LoraLoader` 的 clip 输入是必填。见 [LoRA 串联与 A/B](/lessons/03-02-l3-lora/)。
