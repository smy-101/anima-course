---
name_zh: 加载 DA3 模型
category: 预处理
first_level: L5
sources:
  - { badge: 官方, url: "https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_lllite_depth_control_to_image.json", note: '“Image Depth Estimation (Depth Anything 3)” 蓝图内部节点' }
verified: 2026-11-24
inputs: []
params:
  - { name: model_name, default: "—", range: "geometry_estimation 目录下的文件", desc: "depth_anything_3_mono_large.safetensors（1.24 GB，Comfy-Org/Depth-Anything-3）放 models/geometry_estimation/" }
  - { name: dtype, default: "default", range: "default / …", desc: "权重精度，保持默认" }
outputs:
  - { name: DA3_MODEL, type: 专用, desc: "接 DA3 推理" }
---

“Image Depth Estimation (Depth Anything 3)” 官方蓝图里的加载节点（节点库 → Comfy Blueprints → Preprocessors）。日常直接把整个蓝图拖进画布，不必单独添加。
