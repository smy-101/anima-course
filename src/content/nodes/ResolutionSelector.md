---
name_zh: 分辨率选择器
category: 工具与逻辑
first_level: L1
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_resolution.py, note: 尺寸公式 }
  - { badge: 官方, url: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_base_v1.json, note: "模板默认 1:1、1 MP、multiple 16" }
verified: 2026-11-24
inputs: []
params:
  - { name: aspect_ratio, default: "1:1 (Square)", range: "1:1 / 2:3 / 3:2 / 3:4 / 4:3 / 9:16 / 16:9 / 21:9 …", desc: "画幅比例" }
  - { name: megapixels, default: "1.0", range: "0.1 ~ 16", desc: "总像素。Anima 约 1 MP 最佳" }
  - { name: multiple, default: "8", range: "整数", desc: "宽高取整步长。Anima 用 16" }
outputs:
  - { name: width, type: INT, desc: "接到 空Latent图像 的 width" }
  - { name: height, type: INT, desc: "接到 空Latent图像 的 height" }
---

由比例 + 总像素算出宽高，有实时预览。把 空Latent图像 的 width / height 控件拖成输入口再连线。

`multiple = 16`、1 MP 时：1:1 → 1024×1024；2:3 → 832×1248；3:4 → 880×1184；9:16 → 768×1360。
