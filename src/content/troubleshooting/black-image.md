---
symptom: "一张全黑图"
area: 环境
first: "检查 VAEDecode.vae 是否接了"
then: "近期加过 --fp16-vae、--fast 或 attention 后端参数的，全部去掉回到默认；仍是黑图再试 --force-upcast-attention（见[启动参数](/resources/startup-args/)）"
dont: "带着新加的参数继续换节点排查"
sources:
  - { badge: 源码, note: "原始笔记《ComfyUI 节点与参数详解》§5.2–5.5，依据源码与官方文档" }
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/cli_args.py, note: "--fp16-vae “might cause black images”；--force-upcast-attention “please report if it fixes black images”" }
verified: 2026-11-24
---

先排除画布：VAE解码 没接 VAE，或 VAE 接错。画布没问题，就回想最近改过什么启动参数。源码注明 `--fp16-vae` 可能导致黑图，`--fast` 是“未充分测试”的优化。
