---
name_zh: 使用模型放大图像
category: 图像
first_level: L4
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_upscale_model.py", note: "内部自动分块 512、重叠 32" }
verified: 2026-11-24
inputs:
  - { name: upscale_model, type: UPSCALE_MODEL, desc: "接 加载放大模型" }
  - { name: image, type: IMAGE, desc: "接 VAE解码 的 IMAGE" }
params: []
outputs:
  - { name: IMAGE, type: IMAGE, desc: "放大后的像素图（4x 模型把 1024 变 4096）" }
---

用 AI 放大模型放大像素图，**会重建细节**。内部自动分块处理，大图也不容易爆显存。

放大路线 A（只放大不重画）与路线 C（像素放大 + 图生图）都从这里出。C 路线后面要接 调整图像/掩码大小 把 4x 的结果缩回目标总像素，再 VAE编码 进二次采样。
