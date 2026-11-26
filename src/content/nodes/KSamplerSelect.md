---
name_zh: K采样器选择
category: 采样
first_level: L7
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_custom_sampler.py", note: "sampler_name 下拉 = K采样器 的 45 种" }
verified: 2026-11-24
inputs: []
params:
  - { name: sampler_name, default: "—", range: "45 种，同 K采样器", desc: "Anima 先用 euler / er_sde" }
outputs:
  - { name: SAMPLER, type: SAMPLER, desc: "接 自定义采样器（高级） 的 sampler" }
---

把 K采样器 里的“采样方法”单独拿出来。与 基本调度器、随机噪波、引导器 一起喂给 自定义采样器（高级）。
