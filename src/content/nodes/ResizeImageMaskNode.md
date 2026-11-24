---
name_zh: 调整图像/掩码大小
category: 图像
first_level: L3
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_post_processing.py", note: "ResizeImageMaskNode：resize_type 的八种模式" }
  - { badge: 官方, url: "https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_lllite_depth_control_to_image.json", note: "模板用 scale total pixels / 1 MP / lanczos" }
verified: 2026-11-24
inputs:
  - { name: input, type: "IMAGE / MASK", desc: "图像或遮罩都行" }
params:
  - { name: resize_type, default: "—", range: "按尺寸 / 按倍率 / 按长边 / 按短边 / 按宽 / 按高 / 按总像素 / 匹配另一张图 / 缩放到某数的倍数", desc: "Anima 常用 **按总像素**（`megapixels 1.0`）；把过大的输入先缩到约 1 MP" }
  - { name: megapixels, default: "1.0", range: "0.01 ~ 16", desc: "按总像素模式的目标；1.0 ≈ 1024×1024，保持比例" }
  - { name: multiplier, default: "1.0", range: "0.01 ~ 8", desc: "按倍率模式的倍率" }
  - { name: crop, default: "center", range: "disabled / center", desc: "比例不一致时：disabled 拉伸，center 裁剪" }
  - { name: scale_method, default: "area", range: "nearest-exact / bilinear / area / bicubic / lanczos", desc: "官方建议：缩小用 area，放大用 lanczos，像素风用 nearest-exact" }
outputs:
  - { name: resized, type: "同输入", desc: "缩放后的图像或遮罩" }
---

新版的统一缩放节点，一个顶过去好几个（缩放图像 / 缩放图像（比例）/ 缩放图像（像素）/ 匹配尺寸）。

三类用法：① 图生图前把输入缩到模型舒适区（约 1 MP）；② 放大路线 C 里把放大模型的结果缩到目标总像素；③ "匹配另一张图"解决尺寸不匹配报错。
