---
name_zh: 自注意力引导
category: 模型补丁
first_level: L7
experimental: true
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_sag.py", note: "scale 0.5 / blur_sigma 2.0" }
verified: 2026-11-24
inputs:
  - { name: model, type: MODEL, desc: "接模型线" }
params:
  - { name: scale, default: "0.5", range: "-2 ~ 5", desc: "引导强度" }
  - { name: blur_sigma, default: "2.0", range: "0 ~ 10", desc: "扰动用的模糊半径" }
outputs:
  - { name: MODEL, type: MODEL, desc: "打过补丁的模型" }
---

实验性引导增强，利用模型自身的注意力改善细节。通用工具，Anima 上未专项验证。
