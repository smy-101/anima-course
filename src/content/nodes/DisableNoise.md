---
name_zh: 禁用噪波
category: 采样
first_level: L7
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_custom_sampler.py", note: "不产生噪声" }
verified: 2026-11-24
inputs: []
params: []
outputs:
  - { name: NOISE, type: NOISE, desc: "接 自定义采样器（高级） 的 noise；采样从输入的 latent 原样开始" }
---

两段采样的第二段用它：第一段输出的 latent 已带着残留噪声，不能再加一次。相当于 K采样器（高级） 的 `add_noise = disable`。
