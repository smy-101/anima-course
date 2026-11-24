---
name_zh: 反转图像
category: 图像
first_level: L5
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py", note: 参数 }
  - { badge: 官方, url: "https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_lllite_any_control_to_image.json", note: "Canny → ImageInvert" }
verified: 2026-11-24
inputs:
  - { name: image, type: IMAGE, desc: "接 检测边缘 的输出" }
params: []
outputs:
  - { name: IMAGE, type: IMAGE, desc: "颜色取反" }
---

把 Canny 的黑底白线翻成白底黑线——`any-test-like-v2` 权重训练时吃的是这种。深度图、线稿权重要白底黑线时同理。
