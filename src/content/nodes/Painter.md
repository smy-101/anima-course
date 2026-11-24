---
name_zh: 画板
category: 图像
first_level: L6
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_painter.py", note: "参数；输出 IMAGE + MASK" }
  - { badge: 官方, url: "https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_lllite_image_inpainting.json", note: "Inpainting 模板：LoadImage → 调整大小 → Painter" }
verified: 2026-11-24
inputs:
  - { name: image, type: IMAGE, required: false, desc: "可选：叠在原图上画" }
params:
  - { name: mask, default: "—", range: "涂抹结果（自动保存为临时文件）", desc: "在节点里直接涂；涂完要保存" }
  - { name: width, default: "512", range: "64 ~ 4096", desc: "画板尺寸（模板用 1024）" }
  - { name: height, default: "512", range: "64 ~ 4096", desc: "同上" }
  - { name: bg_color, default: "#000000", range: "颜色", desc: "底色" }
outputs:
  - { name: IMAGE, type: IMAGE, desc: "画板内容，作控制图" }
  - { name: MASK, type: MASK, desc: "涂过的区域（白）" }
---

在节点里直接涂抹，同时输出 IMAGE 与 MASK。官方 Inpainting 模板的画法：`LoadImage → 调整图像/掩码大小（≤ 1 MP）→ Painter.image`，`Painter.IMAGE → 应用 Anima LLLite.image`，`Painter.MASK → 预览遮罩 → AnimaLLLiteApply.mask`。

不接 `image` 时是白底黑线画板，可当手涂结构控制的控制图。涂完 `MASK` 全黑说明没保存。
