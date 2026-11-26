---
name_zh: 加载CLIP
category: 加载器
first_level: L0
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py, note: "type 下拉里没有 anima；文本编码器类型由权重自动识别" }
  - { badge: 官方, url: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_base_v1.json, note: 模板用 qwen_3_06b_base + stable_diffusion }
verified: 2026-11-24
inputs: []
params:
  - { name: clip_name, default: "—", range: "text_encoders 目录下的文件", desc: "Anima：qwen_3_06b_base.safetensors（只含 LM 权重，分词器内置在 ComfyUI 里）" }
  - { name: type, default: "—", range: "stable_diffusion / sd3 / flux / wan / …（共 33 种）", desc: "必须和模型架构匹配。Anima 用 stable_diffusion" }
  - { name: device, default: "default", range: "default / cpu", desc: "可选。放 CPU 上跑编码器可省一点显存", required: false }
outputs:
  - { name: CLIP, type: CLIP, desc: "文本编码器" }
---

单独加载文本编码器。读取 `ComfyUI/models/text_encoders/`（旧名 `clip`）。

⚠️ `type` 必须和模型架构匹配，否则报错或出乱图。Anima 的下拉里没有 `anima` 选项，官方模板用 `stable_diffusion`，编码器类型由权重自动识别。SDXL / FLUX 的双编码器请用双CLIP加载器。
