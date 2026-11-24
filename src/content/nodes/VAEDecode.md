---
name_zh: VAE解码
category: Latent
first_level: L0
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py, note: 参数 }
verified: 2026-11-24
inputs:
  - { name: samples, type: LATENT, desc: "接 K采样器 的 LATENT" }
  - { name: vae, type: VAE, desc: "接 加载VAE。没接会出全黑图" }
params: []
outputs:
  - { name: IMAGE, type: IMAGE, desc: "像素图，浮点 0 ~ 1" }
---

潜空间 → 像素。大图解码爆显存时换 VAE解码（分块）（`VAEDecodeTiled`，tile_size 512、overlap 64）。
