---
name_zh: 合成图像（遮罩）
category: 图像
first_level: L6
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_mask.py", note: "destination / source / x / y / mask" }
verified: 2026-11-24
inputs:
  - { name: destination, type: IMAGE, desc: "原图" }
  - { name: source, type: IMAGE, desc: "重绘后缩回原尺寸的小图" }
  - { name: mask, type: MASK, required: false, desc: "只贴遮罩内的部分；接 裁剪遮罩 的输出" }
params:
  - { name: x, default: "0", range: "0 ~ 16384", desc: "贴回坐标 = 裁剪时的 x" }
  - { name: y, default: "0", range: "0 ~ 16384", desc: "贴回坐标 = 裁剪时的 y" }
  - { name: resize_source, default: "false", range: "布尔", desc: "先把 source 缩放到 destination 尺寸再贴（通常关）" }
outputs:
  - { name: IMAGE, type: IMAGE, desc: "贴回后的整图" }
---

把裁剪法重绘的结果按坐标贴回原图。FaceDetailer 内部做的就是这件事（裁剪 → 放大 → 重绘 → 羽化 → 贴回）。
