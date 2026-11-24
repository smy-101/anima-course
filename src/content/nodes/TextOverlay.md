---
name_zh: 绘制文本叠加
category: 图像
first_level: L2
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_text_overlay.py, note: 参数 }
verified: 2026-11-24
inputs:
  - { name: image, type: IMAGE, desc: "要写字的图" }
  - { name: text, type: STRING, desc: "文字" }
params:
  - { name: font_size, default: "—", range: "图高的百分比", desc: "字号" }
  - { name: position, default: "—", range: "top / bottom", desc: "位置" }
  - { name: align, default: "—", range: "left / center / right", desc: "对齐" }
  - { name: outline, default: "—", range: "布尔 / 宽度", desc: "描边，浅底深字时开" }
outputs:
  - { name: IMAGE, type: IMAGE, desc: "带字的原尺寸图" }
---

在图上写字，给对照图标参数值。列表法里每个分支拿到的文字相同，所以要标注时复制 K采样器分支，每支各接一个文字叠加。
