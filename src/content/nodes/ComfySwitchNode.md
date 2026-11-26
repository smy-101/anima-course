---
name_zh: 切换
category: 工具与逻辑
first_level: L1
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_toolkit.py, note: "惰性求值：只计算被选中的一路" }
verified: 2026-11-24
inputs:
  - { name: switch, type: BOOLEAN, desc: "接 布尔值" }
  - { name: on_true, type: "同类型", desc: "switch 为 true 时透传" }
  - { name: on_false, type: "同类型", desc: "switch 为 false 时透传" }
params: []
outputs:
  - { name: output, type: "同输入", desc: "被选中的那一路" }
---

二选一开关，MODEL / INT / FLOAT / STRING 都能切。只计算被选中的那一路（惰性求值），所以关着 Turbo 时 Turbo LoRA 不会被加载进显存。

L1 用三个切换节点分别切模型、步数、CFG，三个 `switch` 都接到同一个布尔值。
