---
name_zh: 基本引导器
category: 采样
first_level: L7
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_custom_sampler.py", note: "只有一路 conditioning，等效 CFG 1" }
verified: 2026-11-24
inputs:
  - { name: model, type: MODEL, desc: "接模型线" }
  - { name: conditioning, type: CONDITIONING, desc: "只接正向；负向不起作用" }
params: []
outputs:
  - { name: GUIDER, type: GUIDER, desc: "接 自定义采样器（高级） 的 guider" }
---

只跑一路条件，CFG 等效于 1，少算一半。Turbo 本来就是 CFG 1，用它白白快一倍；Base / Aesthetic 要负向时用 CFG引导器。
