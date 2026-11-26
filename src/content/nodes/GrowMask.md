---
name_zh: 扩展遮罩
category: 遮罩
first_level: L6
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_mask.py", note: "expand 正扩负缩；tapered_corners" }
verified: 2026-11-24
inputs:
  - { name: mask, type: MASK, desc: "接 加载图像.MASK（蒙版编辑器涂的）" }
params:
  - { name: expand, default: "0", range: "整数，正 = 向外扩，负 = 向内缩", desc: "起点 8；接缝有残影加到 16" }
  - { name: tapered_corners, default: "true", range: "布尔", desc: "扩出的角是尖的还是圆的" }
outputs:
  - { name: MASK, type: MASK, desc: "扩大后的遮罩" }
---

把涂抹范围向外扩几像素，保证边缘完整覆盖。LLLite 路线必用：它会把 mask 二值化，软边等于没有，所以要比目标区域大一圈。
