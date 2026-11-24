---
symptom: "放大后多了一个人 / 构图变了"
area: 放大
first: "倍率先 1.25×、二次采样 denoise 降到 0.35"
then: "两段放大（每段 ≤ 1.5×）或分块放大"
dont: "一次 ×2"
sources:
  - { badge: 社区, url: "https://huggingface.co/circlestone-labs/Anima/discussions/165", note: "HF 讨论区 #165：单段 hires 上限约 1.5×" }
  - { badge: 社区, note: "《递进报告》§5 速查表与各级常见问题：综合官方、作者与社区" }
verified: 2026-11-24
---
总像素超出模型舒适区，或二次采样 denoise > 0.6。见 [L4](/lessons/03-04-l4-upscale/)。
