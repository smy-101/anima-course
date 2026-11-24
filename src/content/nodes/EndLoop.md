---
name_zh: 结束循环
category: 工具
first_level: L8
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_loop.py", note: "output_value / next_iteration_value / accumulate" }
verified: 2026-11-24
inputs:
  - { name: output_value, type: "任意（可选）", required: false, desc: "循环体最后一步的结果，如第二个 K采样器 的 LATENT" }
  - { name: next_iteration_value, type: "任意（可选）", required: false, desc: "传回 开始循环 作为下一轮的 current_iteration_value" }
  - { name: terminations, type: "任意（可增长，可选）", required: false, desc: "每轮都必须执行一次的输出节点（如预览），值不返回" }
params:
  - { name: accumulate, default: "false", range: "布尔", desc: "true = 返回每一轮的 output_value（一批）；false = 只返回最后一轮" }
outputs:
  - { name: outputs, type: "任意（列表）", desc: "最终结果；接 VAE解码" }
---

循环的出口。渐进放大里 `output_value` 与 `next_iteration_value` 都接循环体内第二个 K采样器 的 LATENT：一份往下传，一份作为下一轮的输入。
