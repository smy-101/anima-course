---
name_zh: DA3 推理
category: 预处理
first_level: L5
sources:
  - { badge: 官方, url: "https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_lllite_depth_control_to_image.json", note: "模板：分辨率 504、upper_bound_resize、mono" }
verified: 2026-11-24
inputs:
  - { name: model, type: DA3_MODEL, desc: "接 加载 DA3 模型" }
  - { name: image, type: IMAGE, desc: "原图（先缩到约 1 MP）" }
params:
  - { name: resolution, default: "504", range: "整数", desc: "推理分辨率" }
  - { name: resize_method, default: "—", range: "upper_bound_resize 等", desc: "模板用 upper_bound_resize" }
  - { name: output, default: "—", range: "mono 等", desc: "模板用 mono（单目深度）" }
outputs:
  - { name: DA3_OUTPUT, type: 专用, desc: "接 DA3 渲染" }
---

Depth Anything 3 蓝图的推理节点。输入先经 调整图像/掩码大小 缩到 1 MP 再进来。
