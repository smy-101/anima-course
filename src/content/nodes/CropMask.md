---
name_zh: 裁剪遮罩
category: 遮罩
first_level: L6
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_mask.py", note: 参数 }
verified: 2026-11-24
inputs:
  - { name: mask, type: MASK, desc: "与原图同尺寸的遮罩" }
params:
  - { name: x, default: "0", range: "0 ~ 16384", desc: "与 图像裁剪 用同一组坐标" }
  - { name: y, default: "0", range: "0 ~ 16384", desc: "同上" }
  - { name: width, default: "512", range: "1 ~ 16384", desc: "同上" }
  - { name: height, default: "512", range: "1 ~ 16384", desc: "同上" }
outputs:
  - { name: MASK, type: MASK, desc: "裁出的小遮罩" }
---

裁剪法重绘里把遮罩按同样的 x / y / w / h 裁出来，贴回时作 合成图像（遮罩）的 mask。
