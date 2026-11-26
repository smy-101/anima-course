---
name_zh: 随机噪波
category: 采样
first_level: L7
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_custom_sampler.py", note: "noise_seed 带生成后控制" }
verified: 2026-11-24
inputs: []
params:
  - { name: noise_seed, default: "0", range: "整数", desc: "起始噪声的种子；控件右侧设 fixed 才能复现" }
outputs:
  - { name: NOISE, type: NOISE, desc: "接 自定义采样器（高级） 的 noise" }
---

自定义采样里的“种子”。第二段采样不要再加噪，换成 禁用噪波。
