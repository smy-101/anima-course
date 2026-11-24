---
name_zh: 归一化注意力引导
category: 模型补丁
first_level: L7
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_nag.py", note: "nag_scale / nag_alpha / nag_tau；要求 CFG > 1" }
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_custom_sampler.py", note: "挂了 NAG 后引导器会关闭 CFG 1 优化，改成正负两路都算" }
verified: 2026-11-24
inputs:
  - { name: model, type: MODEL, desc: "接模型线" }
params:
  - { name: nag_scale, default: "5.0", range: "0 ~ 50", desc: "引导强度；越大越远离负向" }
  - { name: nag_alpha, default: "0.5", range: "0 ~ 1", desc: "归一化注意力的混合系数；1 完全替换，0 无效" }
  - { name: nag_tau, default: "1.5", range: "1 ~ 10", desc: "阈值" }
outputs:
  - { name: MODEL, type: MODEL, desc: "打过补丁的模型" }
---

Normalized Attention Guidance：让负向"真正生效"又不烧图。**要求 CFG > 1**（它需要批里同时有正负两路，会关闭 CFG 1 优化），所以 Turbo 下无意义，速度也会掉一半。核心已内置，不必再装社区节点 Anima-NAG。
