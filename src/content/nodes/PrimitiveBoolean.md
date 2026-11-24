---
name_zh: 布尔值
category: 工具与逻辑
first_level: L1
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_toolkit.py, note: 参数 }
verified: 2026-11-24
inputs: []
params:
  - { name: value, default: "false", range: "true / false", desc: "开关值" }
outputs:
  - { name: BOOLEAN, type: BOOLEAN, desc: "接到切换节点的 switch" }
---

总开关。L1 用一个布尔值同时驱动三个切换节点（模型 / 步数 / CFG），实现 Base 与 Turbo 一键切换。
