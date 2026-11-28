---
name_zh: 加载模型补丁
category: 加载器
first_level: L5
experimental: true
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_model_patch.py", note: "实验性；读取 model_patches 目录" }
  - { badge: 官方, url: "https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_lllite_depth_control_to_image.json", note: "模板加载 anima-lllite-depth-1" }
verified: 2026-11-24
inputs: []
params:
  - { name: name, default: "—", range: "model_patches 目录下的文件", desc: "Anima LLLite 权重：any-test-like-v2 / depth-1 / lineart-1 / pose-1 / scribble-1 / inpainting-v2" }
outputs:
  - { name: MODEL_PATCH, type: MODEL_PATCH, desc: "接 应用 Anima LLLite 的 model_patch" }
---

读取 模型补丁（Anima 的 LLLite 结构控制权重）。文件必须放 `ComfyUI/models/model_patches/`。放错目录时节点变成橙色、带“问题”角标，放好后按 `R`。

权重清单与各自吃的控制图见课程 [L5](/lessons/04-01-l5-lllite/)。
