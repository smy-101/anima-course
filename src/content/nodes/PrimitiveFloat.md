---
name_zh: 浮点数
category: 工具与逻辑
first_level: L1
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_toolkit.py, note: 参数 }
verified: 2026-11-24
inputs: []
params:
  - { name: value, default: "0", range: "小数", desc: "要传给下游控件的值" }
outputs:
  - { name: FLOAT, type: FLOAT, desc: "接到 cfg、强度等浮点控件" }
---

给浮点控件传固定值。L2 的 CFG 扫描就是几个浮点数节点 → 创建列表 → K采样器.cfg。
