---
name_zh: 外补画板
category: 图像
first_level: L6
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py", note: "输出补边后的 IMAGE 与新区域的 MASK" }
verified: 2026-11-24
inputs:
  - { name: image, type: IMAGE, desc: "原图" }
params:
  - { name: "left / top / right / bottom", default: "0", range: "像素", desc: "各方向补多少像素。补边后的总尺寸控制在约 1 MP" }
  - { name: feathering, default: "40", range: "0 ~ 16384", desc: "新旧区域的过渡宽度；风格不一致时加大" }
outputs:
  - { name: IMAGE, type: IMAGE, desc: "补边后的图（新区域为纯色），作重绘的 image" }
  - { name: MASK, type: MASK, desc: "白 = 新补的区域，作重绘的 mask" }
---

扩图（Outpaint）的第一步。输出直接接重绘路线 A / B 的 `image` 与 `mask`。提示词要描述**整张画面**，不只是新区域。
