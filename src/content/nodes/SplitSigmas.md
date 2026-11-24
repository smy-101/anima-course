---
name_zh: 分离Sigma
category: 采样
first_level: L7
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_custom_sampler.py", note: "按 step 切两段" }
verified: 2026-11-24
inputs:
  - { name: sigmas, type: SIGMAS, desc: "接 基本调度器" }
params:
  - { name: step, default: "0", range: "0 ~ 10000", desc: "在第几步切开（切点 50% 起步，可试 30% ~ 70%）" }
outputs:
  - { name: high_sigmas, type: SIGMAS, desc: "高噪声段（前段）" }
  - { name: low_sigmas, type: SIGMAS, desc: "低噪声段（后段）" }
---

把一张时间表切成前后两段，分别喂两个 自定义采样器（高级）：前段定构图、后段补细节，两段可以挂不同的模型补丁与引导器。
