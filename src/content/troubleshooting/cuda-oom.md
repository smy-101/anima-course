---
symptom: "CUDA out of memory"
area: 环境
first: "降分辨率（约 0.8 MP）；batch_size 改 1"
then: "[VAEDecodeTiled](/nodes/VAEDecodeTiled/)；UNet加载器 weight_dtype 选 fp8_e4m3fn；最后才是启动参数 --cpu-vae、--reserve-vram（见[启动参数](/resources/startup-args/)）"
dont: "切 fp16（Anima 的显存估算系数反而更高）；一上来就加 --lowvram（动态显存管理下基本无效）"
sources:
  - { badge: 源码, note: "《节点详解》§5.2–5.5，依据源码与官方文档" }
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/cli_args.py, note: "--lowvram 在动态显存管理下无效；--cpu-vae / --reserve-vram" }
verified: 2026-11-24
---
只在 VAE 阶段 OOM = 解码爆显存，用分块解码。

顺序是先节点、后启动参数：画布上能改的（分辨率、fp8、分块 VAE）改完立刻能对照；启动参数改的是整个进程，要重启，而且所有工作流一起受影响。见[启动参数与 Attention 后端](/resources/startup-args/)。
