---
name_zh: 加载放大模型
category: 加载器
first_level: L4
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_upscale_model.py", note: 参数 }
  - { badge: 社区, url: "https://huggingface.co/circlestone-labs/Anima/discussions/204", note: "动漫向放大模型在 Anima 上更干净" }
verified: 2026-11-24
inputs: []
params:
  - { name: model_name, default: "—", range: "upscale_models 目录下的文件", desc: "文件放 ComfyUI/models/upscale_models/" }
outputs:
  - { name: UPSCALE_MODEL, type: UPSCALE_MODEL, desc: "接 使用模型放大图像" }
---

读取 AI 放大模型（ESRGAN 系 `.pth`）。**动漫插画别用写实向的 4x-ESRGAN**，会把平涂线条锐化过头；社区反馈 `4x_IllustrationJaNai_V1_ESRGAN_135k` 在 Anima 上干净，其它写实放大器在浅色区域出噪点。

放大模型只负责"变大 + 重建边缘"，细节由后面的二次采样画出来。
