---
symptom: "放大后糊 / 花 / 波点"
area: 放大
first: "倍率 ↓ 1.25、denoise ↓ 0.3"
then: "换路线 C（放大模型）；换 euler/simple"
dont: "一次 ×2"
sources:
  - { badge: 社区, url: https://huggingface.co/circlestone-labs/Anima/discussions/165, note: "HF 讨论区 #165" }
  - { badge: 社区, note: "《递进报告》§5 速查表：综合官方、作者与社区" }
verified: 2026-11-24
---
1024² 起步单段 ≤ 1.5×；1536² 起步约 1.3×；更大分两段或分块。
