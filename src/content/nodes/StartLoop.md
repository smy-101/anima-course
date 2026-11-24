---
name_zh: 开始循环
category: 工具
first_level: L8
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_loop.py", note: "simple / For / List 三种模式；输出 iteration_index 等" }
verified: 2026-11-24
inputs:
  - { name: initial_iteration_value, type: "任意（可选）", required: false, desc: "第一轮的 current_iteration_value，如 K采样器① 的 LATENT" }
params:
  - { name: mode, default: "simple", range: "simple / For / List", desc: "simple 按 num_iterations 重复；List 对列表逐项" }
  - { name: num_iterations, default: "4", range: "整数", desc: "循环次数（渐进放大用 3）" }
outputs:
  - { name: iteration_index, type: INT, desc: "当前是第几轮（从 0 起）" }
  - { name: is_first / is_last, type: BOOLEAN, desc: "是否首轮 / 末轮" }
  - { name: current_iteration_value, type: "任意", desc: "首轮 = initial_iteration_value，之后 = 结束循环 传回的 next_iteration_value" }
---

让一段节点循环 N 次：循环体内的节点会被复制 N 份串起来。渐进放大（每轮 1.25× + denoise 0.35）是典型用法；两三轮的话直接手搭串联的 K采样器 更易读。
