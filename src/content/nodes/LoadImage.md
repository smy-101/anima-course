---
name_zh: 加载图像
category: 图像
first_level: L3
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py", note: "输出 IMAGE 与 MASK" }
  - { badge: 官方, url: "https://docs.comfy.org/zh/interface/maskeditor", note: 蒙版编辑器 }
verified: 2026-11-24
inputs: []
params:
  - { name: image, default: "—", range: "ComfyUI/input/ 下的文件，或点 Upload 上传", desc: "文件名与路径尽量用英文" }
outputs:
  - { name: IMAGE, type: IMAGE, desc: "像素图，浮点 0 ~ 1" }
  - { name: MASK, type: MASK, desc: "图片自带的透明通道；没有透明通道时是全黑。在蒙版编辑器里涂抹后，涂过的区域变白" }
---

图生图、局部重绘、扩图、控制图的起点。上传的文件放在 `ComfyUI/input/`。

涂遮罩：选中节点 → 工具箱的遮罩图标，或右键 → “在蒙版编辑器中打开”，或悬停图片点左上角遮罩按钮。画笔 / 橡皮 / 油漆桶 / 按颜色选择，顶部栏有反转与清除，涂完点保存；遮罩从 `MASK` 输出口取，接预览遮罩 看一眼。

输入图的尺寸就是输出尺寸。大图直接编码会崩构图，先用调整图像/掩码大小 缩到约 1 MP。
