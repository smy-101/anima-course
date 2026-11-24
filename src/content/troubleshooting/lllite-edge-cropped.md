---
symptom: "控制图的边缘被裁掉了"
area: 工作流
first: "获取图像尺寸 的 width / height 接到 空Latent图像"
then: "控制图先缩到约 1 MP 再进 应用 Anima LLLite"
dont: "调 strength"
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/ldm/anima/lllite.py", note: "控制图按输出潜空间宽高比中心裁剪 + bicubic 缩放" }
  - { badge: 社区, note: "《递进报告》§5 速查表与各级常见问题：综合官方、作者与社区" }
verified: 2026-11-24
---
节点会把控制图中心裁剪到输出潜空间的宽高比。画布 = 控制图尺寸就不会裁。见 [L5](/lessons/04-01-l5-lllite/)。
