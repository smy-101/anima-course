---
name_zh: CFG 覆盖
category: 模型补丁
first_level: L7
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_custom_sampler.py", note: "在 [start, end] 的 sigma 区间把 cfg 强制成固定值；多个叠加时离采样器最近的生效" }
verified: 2026-11-24
inputs:
  - { name: model, type: MODEL, desc: "接模型线" }
params:
  - { name: cfg, default: "1.0", range: "0 ~ 100", desc: "区间内强制的 CFG" }
  - { name: start_percent, default: "0", range: "0 ~ 1", desc: "区间起点" }
  - { name: end_percent, default: "1.0", range: "0 ~ 1", desc: "区间终点。想减轻早期过饱和：前 5% ~ 15% 强制 cfg 1" }
outputs:
  - { name: MODEL, type: MODEL, desc: "打过补丁的模型" }
---

在采样的某一段把 CFG 强制成固定值。通用技巧：开头几步强制 cfg 1，减轻早期过饱和；两段采样“前段 Turbo（cfg 1）、后段 Base（cfg 4）”也靠它。
