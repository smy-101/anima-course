---
name_zh: 基本调度器
category: 采样
first_level: L7
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_custom_sampler.py", note: "denoise 与 K采样器 同一逻辑：不减步数" }
verified: 2026-11-24
inputs:
  - { name: model, type: MODEL, desc: "接模型线（决定了噪声范围）" }
params:
  - { name: scheduler, default: "simple", range: "9 种，同 K采样器", desc: "Anima 用 simple" }
  - { name: steps, default: "20", range: "1 ~ 10000", desc: "Anima 30 / Turbo 8" }
  - { name: denoise, default: "1.0", range: "0 ~ 1", desc: "只取时间表的后一段；**不减步数**（先按 int(steps/denoise) 生成更细的时间表再取最后 steps+1 段）" }
outputs:
  - { name: SIGMAS, type: SIGMAS, desc: "sigma 时间表，接 自定义采样器（高级） 的 sigmas" }
---

生成 sigma 时间表。与 分离Sigma / 分离Sigma降噪 / Karras调度器 同属"时间表工具"：想自己切两段，就把它接 分离Sigma 再分别喂两个自定义采样器。
