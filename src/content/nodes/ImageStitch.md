---
name_zh: 图像拼接
category: 图像
first_level: L8
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_images.py", note: "direction / match_image_size；支持批次" }
verified: 2026-11-24
inputs:
  - { name: image1, type: IMAGE, desc: "第一张（或一批）" }
  - { name: image2, type: IMAGE, required: false, desc: "接到 image1 的某个方向；不接则原样返回 image1" }
params:
  - { name: direction, default: "right", range: "right / down / left / up", desc: "image2 接在 image1 的哪一侧" }
  - { name: match_image_size, default: "true", range: "布尔", desc: "是否把 image2 缩放到与 image1 同尺寸" }
  - { name: spacing_width, default: "0", range: "0 ~ 1024（偶数）", desc: "两张图之间留的空隙" }
  - { name: spacing_color, default: "white", range: "white / black / red / green / blue", desc: "空隙颜色" }
outputs:
  - { name: IMAGE, type: IMAGE, desc: "拼好的图" }
---

把 image2 接到 image1 的某个方向。**支持批次**：两路各是 4 张，就按索引逐张拼成 4 张——模型 × 种子网格的"列拼接"靠它，再接 图像表格 铺行。
