---
symptom: "提示词不够贴"
area: 参数
first: "关键词靠前、权重 1.5 ~ 2.0"
then: "cfg ↑（≤ 5）"
dont: "堆负向"
sources:
  - { badge: 社区, note: "《递进报告》§5 速查表：综合官方、作者与社区" }
  - { badge: 官方, url: https://huggingface.co/circlestone-labs/Anima, note: "模型卡" }
verified: 2026-11-24
---
权重只在 T5 一路生效，1.2 约等于没加；2.0 是甜点。权重只用于排错，不预防性堆。
