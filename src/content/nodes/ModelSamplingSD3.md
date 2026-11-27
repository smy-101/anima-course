---
name_zh: 采样算法（SD3）
category: 模型补丁
first_level: L7
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_model_advanced.py", note: "shift 默认 3.0，范围 0 ~ 100" }
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/supported_models.py", note: "Anima 为 flow 模型，shift 写死 3.0" }
verified: 2026-11-24
inputs:
  - { name: model, type: MODEL, desc: "接 UNet加载器" }
params:
  - { name: shift, default: "3.0", range: "0 ~ 100", desc: "时间表偏移：调高 → 更多步数留在高噪声段（构图更稳、细节更足，常用于高分辨率）；调低 → 更快更平" }
outputs:
  - { name: MODEL, type: MODEL, desc: "改过时间表的模型" }
---

改 flow 模型（SD3、FLUX 系）的 shift，默认 3.0。Anima 上不要用这个节点：它的 multiplier 写死 1000，而 Anima 的 sampling_settings 是 multiplier 1.0，挂上后时间步被放大一千倍，出来的是纯噪点（2026-11-27 在 ComfyUI 0.46.2 上实测）。Anima 用 采样算法（AuraFlow），shift 填 3.0。先 3 → 5 → 7 对照；LLLite 的 v2 权重训练时 shift = 3.0，Preview3 代的 depth / lineart / scribble 是 1.0、any v1 是 4.0——这几种控制“发怪”时可对照试对应 shift（实验性）。
