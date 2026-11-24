---
name_zh: 缩放Latent（比例）
category: Latent
first_level: L4
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py", note: "upscale_methods 与 scale_by 范围" }
verified: 2026-11-24
inputs:
  - { name: samples, type: LATENT, desc: "接 K采样器① 的 LATENT" }
params:
  - { name: upscale_method, default: "—", range: "nearest-exact / bilinear / area / bicubic / bislerp", desc: "bislerp 是专为潜空间设计的插值；太软时换路线 C" }
  - { name: scale_by, default: "1.5", range: "0.01 ~ 8", desc: "倍率。Anima 从 1 MP 起步单段 ≤ 1.5" }
outputs:
  - { name: LATENT, type: LATENT, desc: "放大后的潜空间图，接第二个 K采样器 补细节" }
---

在潜空间里直接放大：不解码、省显存、快，但细节是插值出来的，**后面必须接低 denoise 的二次采样**。这是官方"两段式"放大的核心节点（路线 B）。

倍率上限来自社区实测（HF 讨论区）：1024² 起步 ≤ 1.5×，1536² 起步约 1.3×，再大分两段或分块。要做二维扫描（倍率 × denoise），把 `scale_by` 拖成输入口接创建列表。
