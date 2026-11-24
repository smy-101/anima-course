---
name_zh: 缩放Latent
category: Latent
first_level: L4
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py", note: "width / height 填 0 = 按比例自动算；crop" }
verified: 2026-11-24
inputs:
  - { name: samples, type: LATENT, desc: "接 K采样器① 或上一段放大的 LATENT" }
params:
  - { name: upscale_method, default: "—", range: "nearest-exact / bilinear / area / bicubic / bislerp", desc: "同 缩放Latent（比例）" }
  - { name: width / height, default: "512", range: "0 ~ 16384；填 0 = 按比例自动算", desc: "目标像素尺寸。两段放大的第二段用它直接指定目标，如 2048 × 2048" }
  - { name: crop, default: "disabled", range: "disabled / center", desc: "比例不一致时是否居中裁剪" }
outputs:
  - { name: LATENT, type: LATENT, desc: "放大后的潜空间图" }
---

与 缩放Latent（比例） 的区别：这里填**目标宽高**而不是倍率。两段放大"第一段 1.5×，第二段直接给目标尺寸"就靠它。宽高仍要是 16 的倍数。
