---
name_zh: 空Latent图像
category: Latent
first_level: L0
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py, note: 参数范围与默认 }
verified: 2026-11-24
inputs: []
params:
  - { name: width, default: "512", range: "16 ~ 16384，步长 8", desc: "输出图像的像素尺寸。必须是 8 的倍数；Anima 建议 16 的倍数" }
  - { name: height, default: "512", range: "16 ~ 16384，步长 8", desc: "同上" }
  - { name: batch_size, default: "1", range: "1 ~ 4096", desc: "一次生成几张。同一批次里每张噪声不同。越大越吃显存" }
outputs:
  - { name: LATENT, type: LATENT, desc: "全零的潜空间图，采样器往里加噪声" }
---

文生图的起点。width / height 可以拖成输入口，由分辨率选择器驱动（L1）。

分辨率决定构图质量：每种模型有自己的"舒适区"，Anima 约 1 MP 最佳、512² ~ 1536²，超出容易出现重复人像、构图崩坏。
