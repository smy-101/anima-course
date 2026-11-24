---
name_zh: 羽化遮罩
category: 遮罩
first_level: L6
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_mask.py", note: "四边羽化像素数" }
verified: 2026-11-24
inputs:
  - { name: mask, type: MASK, desc: "任意遮罩" }
params:
  - { name: "left / top / right / bottom", default: "0", range: "0 ~ 16384 像素", desc: "各边向内羽化的像素数；起点 8 ~ 16" }
outputs:
  - { name: MASK, type: MASK, desc: "带渐变边缘的遮罩" }
---

给遮罩四边做渐变。**只对噪波遮罩有意义**（VAE编码（局部重绘）/ 设置Latent噪波遮罩 的路线）；应用 Anima LLLite 的 mask 会被二值化，羽化无效。
