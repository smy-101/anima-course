---
name_zh: 获取图像尺寸
category: 图像
first_level: L5
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_images.py", note: "输出 width / height / batch_size" }
  - { badge: 官方, url: "https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_lllite_any_control_to_image.json", note: "模板用它把画布对齐控制图" }
verified: 2026-11-24
inputs:
  - { name: image, type: IMAGE, desc: "任何 IMAGE" }
params: []
outputs:
  - { name: width, type: INT, desc: "像素宽" }
  - { name: height, type: INT, desc: "像素高" }
  - { name: batch_size, type: INT, desc: "批次里的张数" }
---

把图像尺寸变成两个整数，接到别的节点控件上。LLLite 结构控制里必用：`width / height ──▶ 空Latent图像.width / height`，让画布 = 控制图尺寸，控制图就不会被中心裁剪。
