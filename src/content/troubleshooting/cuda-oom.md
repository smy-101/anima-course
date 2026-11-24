---
symptom: "CUDA out of memory"
area: 环境
first: "降分辨率（约 0.8 MP）；batch_size 改 1"
then: "VAEDecodeTiled；启动参数 --cpu-vae、--reserve-vram"
dont: "切 fp16（Anima 的显存估算系数反而更高）"
sources:
  - { badge: 源码, note: "《节点详解》§5.2–5.3，依据源码与官方文档" }
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/samplers.py, note: "KSampler.set_steps" }
verified: 2026-11-24
---
只在 VAE 阶段 OOM = 解码爆显存，用分块解码。
