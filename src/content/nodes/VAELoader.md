---
name_zh: 加载VAE
category: 加载器
first_level: L0
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py, note: 参数 }
verified: 2026-11-24
inputs: []
params:
  - { name: vae_name, default: "—", range: "vae 目录下的文件", desc: "Anima：qwen_image_vae.safetensors（就是 Qwen-Image 的 VAE）" }
outputs:
  - { name: VAE, type: VAE, desc: "图像 ↔ 潜空间的编解码器" }
---

读取 `ComfyUI/models/vae/`。⚠️ VAE 必须和模型配套，用错的典型表现是出图发灰、发白或有噪点。Checkpoint 自带的 VAE 已在节点里输出，不用再单独加载——Anima 是拆分模型，所以要自己加载。
