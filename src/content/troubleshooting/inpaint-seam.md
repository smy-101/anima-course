---
symptom: "重绘有接缝"
area: 重绘
first: "GrowMask 8 → 16"
then: "路线 B（img2img + mask）"
dont: "羽化（LLLite 路线无效）"
sources:
  - { badge: 社区, note: "《递进报告》§5 速查表：综合官方、作者与社区" }
verified: 2026-11-24
---
LLLite 的 mask 会在 0.5 处二值化，软边等于没有——涂大一圈。
