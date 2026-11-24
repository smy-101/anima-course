---
name_zh: 整数
category: 工具与逻辑
first_level: L1
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_toolkit.py, note: 参数 }
verified: 2026-11-24
inputs: []
params:
  - { name: value, default: "0", range: "整数", desc: "要传给下游控件的值" }
outputs:
  - { name: INT, type: INT, desc: "接到 seed、steps 等整数控件" }
---

给整数控件传固定值。把连线拖到目标节点的控件上，控件就变成输入口。多个整数节点接创建列表可一次扫多个值。
