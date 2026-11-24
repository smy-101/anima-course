---
name_zh: DA3 渲染
category: 预处理
first_level: L5
sources:
  - { badge: 官方, url: "https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_lllite_depth_control_to_image.json", note: "模板：depth / v2_style / 不裁天空" }
verified: 2026-11-24
inputs:
  - { name: output, type: DA3_OUTPUT, desc: "接 DA3 推理" }
params:
  - { name: output, default: "—", range: "depth 等", desc: "模板输出 depth（深度图）" }
  - { name: normalization, default: "—", range: "v2_style 等", desc: "归一化方式；v2_style = 白近黑远的 Depth Anything 风格" }
  - { name: apply_sky_clip, default: "false", range: "布尔", desc: "是否裁掉天空区域" }
outputs:
  - { name: IMAGE, type: IMAGE, desc: "深度图：白 = 近，黑 = 远。接 预览图像 看一眼，再进 应用 Anima LLLite" }
---

Depth Anything 3 蓝图的最后一步，输出可直接喂给 `anima-lllite-depth-1` 的深度图。先用 预览图像 确认"近白远黑"再往下走。
