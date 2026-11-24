---
name_zh: 图像裁剪
category: 图像
first_level: L6
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_images.py", note: "crop_region 框选控件，越界自动收缩" }
verified: 2026-11-24
inputs:
  - { name: image, type: IMAGE, desc: "原图" }
params:
  - { name: crop_region, default: "—", range: "x, y, width, height 的框选控件", desc: "裁剪框；重绘时四周留余量" }
outputs:
  - { name: IMAGE, type: IMAGE, desc: "裁出的小图" }
---

裁剪法重绘的第一步：把小区域（手、脸）裁出来，四周留余量，再用 调整图像/掩码大小 放大到约 1 MP 去重绘——细节远好于在整图上涂一小块。也是放大后做最终构图裁切的工具。
