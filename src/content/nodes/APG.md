---
name_zh: 自适应投影引导
category: 模型补丁
first_level: L7
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_apg.py", note: "eta / norm_threshold / momentum 的默认与范围" }
verified: 2026-11-24
inputs:
  - { name: model, type: MODEL, desc: "接模型线" }
params:
  - { name: eta, default: "1.0", range: "-10 ~ 10", desc: "平行引导向量的缩放；1 = 默认 CFG 行为" }
  - { name: norm_threshold, default: "5.0", range: "0 ~ 50", desc: "引导向量归一化阈值；0 = 关闭" }
  - { name: momentum, default: "0.0", range: "-5 ~ 1", desc: "引导的滑动平均；0 = 关闭" }
outputs:
  - { name: MODEL, type: MODEL, desc: "打过补丁的模型" }
---

投影式引导，降低高 CFG 下的过饱和。想用 cfg 6 ~ 8 又不烧图时试；Anima 上没有专项数据，逐个 `Ctrl+B` 对照。
