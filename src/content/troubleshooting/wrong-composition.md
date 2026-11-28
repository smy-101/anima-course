---
symptom: "构图 / 人物完全不对"
area: 参数
first: "seed"
then: "提示词（对照排错清单）"
dont: "加步数、加 CFG"
sources:
  - { badge: 社区, note: "原始笔记《ComfyUI 工作流递进实现报告》§5 速查表：综合官方、作者与社区" }
verified: 2026-11-24
---
构图不行换 seed，别调参数。这是 T1 里 seed 排第一位的原因。用 L2 的 batch 法一次出 4～8 个种子。
