---
name_zh: 预览遮罩
category: 遮罩
first_level: L6
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_mask.py", note: "输出节点，不落盘" }
verified: 2026-11-24
inputs:
  - { name: mask, type: MASK, desc: "任意遮罩" }
params: []
outputs:
  - { name: mask, type: MASK, desc: "透传，便于串在链路中间观察" }
---

输出节点：直接显示遮罩长什么样（白 = 生效）。重绘前先看一眼——遮罩范围错了，后面调什么都没用。
