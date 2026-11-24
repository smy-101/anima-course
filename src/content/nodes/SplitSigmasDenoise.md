---
name_zh: 分离Sigma降噪
category: 采样
first_level: L7
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_custom_sampler.py", note: "按 round(steps×denoise) 截取，会减步数" }
verified: 2026-11-24
inputs:
  - { name: sigmas, type: SIGMAS, desc: "接 基本调度器" }
params:
  - { name: denoise, default: "1.0", range: "0 ~ 1", desc: "去噪比例" }
outputs:
  - { name: high_sigmas, type: SIGMAS, desc: "被跳过的高噪声段" }
  - { name: low_sigmas, type: SIGMAS, desc: "保留的低噪声段，接自定义采样器" }
---

按去噪比例取时间表的后一段——图生图版的自定义采样用它。注意它和 K采样器 的 `denoise` 不同：**这里真的会减步数**（按 round(steps×denoise) 截取）。
