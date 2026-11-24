---
name_zh: VAE编码
category: Latent
first_level: L3
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py", note: 参数 }
verified: 2026-11-24
inputs:
  - { name: pixels, type: IMAGE, desc: "接 加载图像 或 调整图像/掩码大小 的 IMAGE" }
  - { name: vae, type: VAE, desc: "接 加载VAE，要与模型配套" }
outputs:
  - { name: LATENT, type: LATENT, desc: "原图的潜空间表示，接 K采样器 的 latent_image" }
---

像素 → 潜空间，图生图的第三段（把"空画布"换成"你的图"）。配合 K采样器 的 `denoise` 决定保留多少：1 完全重画只借尺寸，0.4 ~ 0.6 细化，0.2 ~ 0.35 微调。

局部重绘时换成 VAE编码（局部重绘）（带遮罩信息），或用本节点后再接 设置Latent噪波遮罩。
