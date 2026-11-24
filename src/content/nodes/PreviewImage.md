---
name_zh: 预览图像
category: 图像
first_level: L2
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py, note: 输出节点 }
verified: 2026-11-24
inputs:
  - { name: images, type: IMAGE, desc: "要预览的图" }
params: []
outputs: []
---

输出节点：只在节点里显示，**不写入输出目录**。调试用——比如先看控制图长什么样、遮罩涂得对不对。
