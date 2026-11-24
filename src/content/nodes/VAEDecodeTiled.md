---
name_zh: VAE解码（分块）
category: Latent
first_level: L4
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py", note: "tile_size / overlap 范围" }
verified: 2026-11-24
inputs:
  - { name: samples, type: LATENT, desc: "接 K采样器 的 LATENT" }
  - { name: vae, type: VAE, desc: "接 加载VAE" }
params:
  - { name: tile_size, default: "512", range: "64 ~ 4096，步长 32", desc: "每块大小" }
  - { name: overlap, default: "64", range: "0 ~ 4096", desc: "相邻块重叠，减少接缝" }
outputs:
  - { name: IMAGE, type: IMAGE, desc: "解码后的像素图；与整图解码有细微差别" }
---

放大到 2048² 以上时 VAE 解码容易爆显存（报错只在 VAE 阶段出现），换成这个节点把图切成小块解码。只在显存不够时用，日常保持 VAE解码。
