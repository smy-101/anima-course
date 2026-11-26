---
name_zh: 图像表格
category: 图像
first_level: L2
experimental: true
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_dataset.py, note: "实验性节点，分类 image/batch" }
verified: 2026-11-24
inputs:
  - { name: images, type: IMAGE, desc: "直接接 batch 张量，会自动拆成单元格" }
params:
  - { name: columns, default: "—", range: "整数", desc: "列数。一维扫描 = 值的个数；二维网格 = batch 数" }
  - { name: "cell_width / cell_height", default: "256", range: "像素", desc: "单元格尺寸。看不清就调到 512" }
  - { name: padding, default: "4", range: "像素", desc: "单元格间距" }
outputs:
  - { name: IMAGE, type: IMAGE, desc: "拼好的网格图" }
---

界面名 “Make Image Grid”。把一批图排成网格，是所有参数对照的最后一站。在节点库 `image/batch` 下，搜 “grid” 或类名；旧版本可能没有。

二维网格（列表 × batch）时铺开顺序为“列表优先”：行 = 列表值，列 = batch。
