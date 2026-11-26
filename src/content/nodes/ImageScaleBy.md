---
name_zh: 缩放图像（比例）
category: 图像
first_level: L4
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py", note: 参数 }
verified: 2026-11-24
inputs:
  - { name: image, type: IMAGE, desc: "像素图" }
params:
  - { name: upscale_method, default: "—", range: "nearest-exact / bilinear / area / bicubic / lanczos", desc: "纯数学插值；放大用 lanczos" }
  - { name: scale_by, default: "1.0", range: "0.01 ~ 8", desc: "倍率，保持比例" }
outputs:
  - { name: IMAGE, type: IMAGE, desc: "缩放后的图" }
---

纯数学放大或缩小，不增加真实细节。只在“目标像素已知、又不想挂放大模型”时用来放大；多数情况下用 调整图像/掩码大小 更顺手（能按总像素、能匹配另一张图）。
