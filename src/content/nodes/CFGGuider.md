---
name_zh: CFG引导器
category: 采样
first_level: L7
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_custom_sampler.py", note: "cfg 范围 0 ~ 100" }
verified: 2026-11-24
inputs:
  - { name: model, type: MODEL, desc: "接模型线" }
  - { name: positive, type: CONDITIONING, desc: "正向" }
  - { name: negative, type: CONDITIONING, desc: "负向" }
params:
  - { name: cfg, default: "8.0", range: "0 ~ 100", desc: "Anima 4 ~ 5" }
outputs:
  - { name: GUIDER, type: GUIDER, desc: "接 自定义采样器（高级） 的 guider" }
---

正常 CFG，等价于 K采样器 的引导方式。接 模型线上的 NAGuidance 等补丁时，因为需要正负两路，必须用它而不是基本引导器。
