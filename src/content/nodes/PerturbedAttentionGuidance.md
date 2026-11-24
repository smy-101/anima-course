---
name_zh: 扰动注意力引导
category: 模型补丁
first_level: L7
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_pag.py", note: "scale 默认 3.0" }
verified: 2026-11-24
inputs:
  - { name: model, type: MODEL, desc: "接模型线" }
params:
  - { name: scale, default: "3.0", range: "0 ~ 100", desc: "引导强度" }
outputs:
  - { name: MODEL, type: MODEL, desc: "打过补丁的模型" }
---

Perturbed Attention Guidance：扰动注意力来提升质量。通用工具，Anima 上未专项验证。
