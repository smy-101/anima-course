---
symptom: "挂 NAG 后速度掉一半 / 没效果"
area: 参数
first: "确认 CFG > 1（Turbo 下无意义）"
then: "用 CFG引导器 而不是 基本引导器；速度掉一半是正常的"
dont: "同时叠 APG / TCFG 等多个补丁"
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_custom_sampler.py", note: "NAG 关闭 CFG 1 优化，改成正负两路都算" }
verified: 2026-11-24
---
NAG 需要批里同时有正负两路。见 [shift 与引导补丁](/lessons/05-02-l7-shift-guidance/)。
