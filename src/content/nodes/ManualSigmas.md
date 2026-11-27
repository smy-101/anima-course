---
name_zh: 自定义Sigmas
category: 采样
first_level: L7
experimental: true
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_custom_sampler.py, note: '实验性；字符串里能识别为数字的依次作为 sigma，默认 “1, 0.5”' }
verified: 2026-11-24
inputs: []
params:
  - { name: sigmas, default: "1, 0.5", range: "逗号分隔的数字串", desc: "手写时间表，从高噪声到低噪声逐个写出" }
outputs:
  - { name: SIGMAS, type: SIGMAS, desc: "接 自定义采样器（高级） 的 sigmas" }
---

手写 sigma 时间表，研究用：想精确指定每一步的噪声水平时才碰。

日常调时间表优先用 [基本调度器](/nodes/BasicScheduler/)（选调度器）、[分离Sigma](/nodes/SplitSigmas/) / [分离Sigma降噪](/nodes/SplitSigmasDenoise/)（切段）或 [采样算法（AuraFlow）](/nodes/ModelSamplingAuraFlow/) 的 shift；这个节点留给“想复现某张图走过的采样路径”的场合。见课程 [shift 与引导补丁](/lessons/05-02-l7-shift-guidance/)。
