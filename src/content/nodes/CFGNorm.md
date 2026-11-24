---
name_zh: CFG 归一化
category: 模型补丁
first_level: L7
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_cfg.py", note: "strength 默认 1；pre_cfg 默认 false" }
verified: 2026-11-24
inputs:
  - { name: model, type: MODEL, desc: "接模型线" }
params:
  - { name: strength, default: "1.0", range: "0 ~ 100", desc: "归一化强度" }
  - { name: pre_cfg, default: "false", range: "布尔", desc: "true = 在采样器合成 CFG 之前缩放（会放大）；默认是合成之后只衰减" }
outputs:
  - { name: MODEL, type: MODEL, desc: "打过补丁的模型" }
---

对 CFG 合成后的预测做归一化，缓解高 CFG 过饱和的一类补丁。与 APG、TCFG 等同属"引导增强"，一次只叠一个，逐个 Bypass 对照。
