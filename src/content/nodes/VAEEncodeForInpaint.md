---
name_zh: VAE编码（局部重绘）
category: Latent
first_level: L6
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py", note: "grow_mask_by 默认 6、范围 0 ~ 64" }
verified: 2026-11-24
inputs:
  - { name: pixels, type: IMAGE, desc: "原图（先缩到约 1 MP）" }
  - { name: vae, type: VAE, desc: "接 加载VAE" }
  - { name: mask, type: MASK, desc: "要重绘的区域（白 = 重绘），接 扩展遮罩 之后" }
params:
  - { name: grow_mask_by, default: "6", range: "0 ~ 64", desc: "遮罩再向外扩几个像素，让过渡自然；接缝明显加到 12" }
outputs:
  - { name: LATENT, type: LATENT, desc: "带噪波遮罩的潜空间图，接 K采样器 的 latent_image" }
---

编码时带上"遮罩外不变"的信息：采样时只在遮罩内加噪去噪。kohya 推荐的 Anima 重绘路线 B（img2img + 遮罩，保色）用它；没有 LLLite 时的通用路线 C 也用它。

注意它和 应用 Anima LLLite 的 mask 要各接一份（都接 扩展遮罩 之后）：噪波遮罩可以是软边，LLLite 的会被二值化。
