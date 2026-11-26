---
name_zh: 检测边缘 (Canny)
category: 预处理
first_level: L5
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_canny.py", note: "low/high threshold 范围" }
  - { badge: 官方, url: "https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_lllite_any_control_to_image.json", note: "模板用 0.17 / 0.45，再取反" }
verified: 2026-11-24
inputs:
  - { name: image, type: IMAGE, desc: "原图" }
params:
  - { name: low_threshold, default: "0.4", range: "0.01 ~ 0.99", desc: "官方 Anima 模板用 **0.17**（多留细节）" }
  - { name: high_threshold, default: "0.8", range: "0.01 ~ 0.99", desc: "官方 Anima 模板用 **0.45**" }
outputs:
  - { name: IMAGE, type: IMAGE, desc: "边缘图：黑底白线" }
---

核心自带的边缘预处理器。Anima 官方 “Any Control” 模板的用法：`Canny(0.17, 0.45) → 反转图像`，得到白底黑线，再配 `anima-lllite-any-test-like-v2`。

其它预处理器（深度、姿势、线稿、涂鸦）在节点库 → Comfy Blueprints → Preprocessors，或社区包 `comfyui_controlnet_aux`。
