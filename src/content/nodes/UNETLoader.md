---
name_zh: UNet加载器
category: 加载器
first_level: L0
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py, note: 参数与默认值 }
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/supported_models.py, note: "Anima 支持 bf16 / fp16 / fp32；fp16 显存估算系数 ×1.4" }
verified: 2026-11-24
inputs: []
params:
  - { name: unet_name, default: "—", range: "diffusion_models 目录下的文件", desc: "Anima：anima-base-v1.0.safetensors" }
  - { name: weight_dtype, default: "default", range: "default / fp8_e4m3fn / fp8_e4m3fn_fast / fp8_e5m2", desc: "default = 保持文件原样；fp8_* 省显存但有画质代价。Anima 日常保持 default" }
outputs:
  - { name: MODEL, type: MODEL, desc: "去噪模型" }
---

只加载去噪模型。Anima、Qwen-Image 等拆分式模型用它。读取 `ComfyUI/models/diffusion_models/`（旧名 `unet`）。

Anima 以 bf16 为主，源码里 fp16 的显存估算系数是 ×1.4，所以**不要为了省显存切 fp16**；显存不够先降分辨率。
