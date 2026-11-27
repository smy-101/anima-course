---
name_zh: 采样算法（AuraFlow）
category: 模型补丁
first_level: L7
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_model_advanced.py", note: "patch_aura 调同一个 patch，multiplier 传 1.0；ModelSamplingSD3 的 multiplier 写死 1000" }
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/supported_models.py", note: "Anima 的 sampling_settings 是 multiplier 1.0、shift 3.0" }
verified: 2026-11-27
inputs:
  - { name: model, type: MODEL, desc: "接 UNet加载器" }
params:
  - { name: shift, default: "1.73", range: "0 ~ 100", desc: "时间表偏移。Anima 默认 3.0，节点默认是 AuraFlow 模型的 1.73，对照时要手填 3 / 5 / 7；调高 → 更多步数留在高噪声段（构图更稳、细节更足，常用于高分辨率）；调低 → 更快更平" }
outputs:
  - { name: MODEL, type: MODEL, desc: "改过时间表的模型" }
---

改 flow 模型的 shift，和采样算法（SD3）是同一个补丁，区别只在 multiplier：这个节点传 1.0，SD3 那个写死 1000。Anima 的 sampling_settings 写的是 multiplier 1.0，所以在 Anima 上要用这个节点。挂 采样算法（SD3）会把时间步放大一千倍，出来的是纯噪点（2026-11-27 在 ComfyUI 0.46.2 上实测）。作者发布的 `anima_comparison.json` 给 Anima 分支接的也是它，shift 填 3.0。LLLite 的 v2 权重训练时 shift = 3.0，Preview3 代的 depth / lineart / scribble 是 1.0、any v1 是 4.0，这几种控制“发怪”时可对照试对应 shift（实验性）。
