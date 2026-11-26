---
name_zh: 保存图像
category: 图像
first_level: L0
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py, note: "filename_prefix 支持变量" }
verified: 2026-11-24
inputs:
  - { name: images, type: IMAGE, desc: "接 VAE解码 的 IMAGE" }
params:
  - { name: filename_prefix, default: "ComfyUI", range: "字符串", desc: "可用 / 建子文件夹；支持变量 %date:yyyy-MM-dd%、%节点名.参数%" }
outputs: []
---

输出节点：写到 `ComfyUI/output/`，文件名递增。PNG 里内嵌工作流——拖回画布即可还原，这是分享工作流的标准方式。

实验时把前缀带上实验 ID，例如 `Anima/E001/%KSampler.cfg%`，记录本和图就能对上。
