---
name_zh: TCFG
category: 模型补丁
first_level: L7
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_tcfg.py", note: "Tangential Damping CFG，无参数" }
verified: 2026-11-24
inputs:
  - { name: model, type: MODEL, desc: "接模型线" }
params: []
outputs:
  - { name: MODEL, type: MODEL, desc: "打过补丁的模型" }
---

Tangential Damping CFG： refining 负向预测使其与正向对齐。没有参数，挂上就生效。Anima 上属“通用工具、未专项验证”。
