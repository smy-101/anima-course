---
name_zh: 设置Latent噪波遮罩
category: Latent
first_level: L6
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py", note: "samples + mask → LATENT" }
verified: 2026-11-24
inputs:
  - { name: samples, type: LATENT, desc: "接 VAE编码 的输出" }
  - { name: mask, type: MASK, desc: "白 = 重绘区域" }
params: []
outputs:
  - { name: LATENT, type: LATENT, desc: "带噪波遮罩的 LATENT" }
---

给普通 VAE编码 的结果加噪波遮罩，是 VAE编码（局部重绘） 的等价做法（`VAEEncode → SetLatentNoiseMask`）。应急用，Anima 上优先走 LLLite 路线。
