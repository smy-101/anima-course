---
name_zh: 创建列表
category: 工具与逻辑
first_level: L2
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_toolkit.py, note: "列表输入 → 下游对每一项各跑一次" }
verified: 2026-11-24
inputs:
  - { name: "（若干同类型输入）", type: "INT / FLOAT / STRING …", desc: "把要扫的值逐个接入" }
params: []
outputs:
  - { name: 列表, type: "FLOAT[] / INT[] / STRING[]", desc: "接到某个控件的输入口" }
---

把 N 个同类型值合成列表。当一个节点的某个输入收到列表时，ComfyUI 会对列表里每一项各跑一次该节点及其下游，再汇总。

- 3 个浮点数（CFG 3 / 4 / 5）→ 创建列表 → K采样器.cfg，种子固定：一次得到 CFG 对比。
- 列表接 seed：一次出多个种子。列表接 CLIP文本编码.text：一次跑多条提示词。
- 结果接图像表格再接保存图像：一张拼好的对照图。输出顺序 = 列表顺序。
