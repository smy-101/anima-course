---
symptom: "Turbo 味太重"
area: 参数
first: "LoRA 强度 0.8 / 0.7"
then: "去质量标签、正向加 anime coloring"
dont: "加负向（无效）"
sources:
  - { badge: 作者, url: https://huggingface.co/circlestone-labs/Anima/discussions, note: "作者建议" }
verified: 2026-11-24
---
Turbo / CFG 1 下负向无效。想彻底摆脱 Turbo 默认风格，换 Aesthetic 用同 seed 重新生成（[L3 方式 1](/lessons/03-01-l3-img2img/)）；用潜空间精修（方式 2）时把 denoise 升到 0.5。
