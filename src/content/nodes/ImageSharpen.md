---
name_zh: 锐化图像
category: 图像
first_level: L4
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_post_processing.py", note: 参数 }
verified: 2026-11-24
inputs:
  - { name: image, type: IMAGE, desc: "放大后的图" }
params:
  - { name: sharpen_radius, default: "1", range: "1 ~ 31", desc: "半径。起点 1 ~ 2" }
  - { name: sigma, default: "1.0", range: "0.1 ~ 10", desc: "模糊半径" }
  - { name: alpha, default: "1.0", range: "0 ~ 5", desc: "强度。平涂画风极易过头，起点 0.3 ~ 0.5" }
outputs:
  - { name: IMAGE, type: IMAGE, desc: "锐化后的图" }
---

放大后的最后一步可选：轻度锐化让线条更实。动漫平涂画风对锐化非常敏感，`alpha` 从 0.3 起，宁少勿多。
