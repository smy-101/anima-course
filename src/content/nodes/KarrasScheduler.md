---
name_zh: Karras调度器
category: 采样
first_level: L7
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_custom_sampler.py, note: "默认 steps 20、sigma_max 14.614642、sigma_min 0.0291675、rho 7.0" }
verified: 2026-11-24
inputs: []
params:
  - { name: steps, default: "20", range: "1 ~ 10000", desc: "步数" }
  - { name: sigma_max, default: "14.614642", range: "0 ~ 5000", desc: "时间表起点的噪声强度（高噪声端）" }
  - { name: sigma_min, default: "0.0291675", range: "0 ~ 5000", desc: "时间表终点的噪声强度（低噪声端）" }
  - { name: rho, default: "7.0", range: "0 ~ 100", desc: "Karras 形状参数：越大，越多步数挤向高噪声端" }
outputs:
  - { name: SIGMAS, type: SIGMAS, desc: "接 自定义采样器（高级） 的 sigmas" }
---

手动设定 Karras 时间表的上下限与形状，研究用。默认值是 SD1.5 时代的噪声范围；Anima 是 flow 模型，噪声范围与之不同，直接套默认值出的图没有参考意义。

想用 Karras 调度，在 [基本调度器](/nodes/BasicScheduler/) 里选 `karras` 即可——它会按模型自身的噪声范围生成时间表。见课程 [shift 与引导补丁](/lessons/05-02-l7-shift-guidance/)。
