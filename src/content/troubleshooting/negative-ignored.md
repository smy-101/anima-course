---
symptom: "负向不生效"
area: 参数
first: "确认不是 Turbo / CFG 1"
then: "[NAGuidance](/lessons/05-02-l7-shift-guidance/)（需 CFG > 1）"
dont: "堆更多负向"
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/samplers.py, note: "KSampler.set_steps" }
  - { badge: 社区, url: https://huggingface.co/circlestone-labs/Anima/discussions/165, note: "HF 讨论区 #165" }
verified: 2026-11-24
---
CFG = 1 时结果等于有条件预测本身，负向完全不起作用。
