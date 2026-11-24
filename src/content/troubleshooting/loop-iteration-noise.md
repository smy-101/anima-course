---
symptom: "渐进放大循环第二轮是纯噪声"
area: 工作流
first: "结束循环 的 next_iteration_value 接回循环体最后的 LATENT"
then: "循环体内的 K采样器 denoise < 1；accumulate 打开看每一轮"
dont: "在循环体里再加一个空Latent图像"
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_loop.py", note: "StartLoop / EndLoop 的传递值" }
verified: 2026-11-24
---
两三轮的渐进放大直接手搭串联的 K采样器 更易读。见 [L8](/lessons/05-03-l8-compare-loop/)。
