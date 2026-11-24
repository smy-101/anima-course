---
name_zh: ER-SDE 采样器
category: 采样
first_level: L7
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_custom_sampler.py", note: "solver_type / max_stage / eta / s_noise 的默认与范围" }
  - { badge: 作者, url: "https://huggingface.co/circlestone-labs/Anima", note: "模型卡推荐 er_sde" }
verified: 2026-11-24
inputs: []
params:
  - { name: solver_type, default: "ER-SDE", range: "ER-SDE / Reverse-time SDE / ODE", desc: "K采样器 下拉里的 er_sde 就是 ER-SDE 模式" }
  - { name: max_stage, default: "3", range: "1 ~ 3", desc: "求解器阶段数，保持 3" }
  - { name: eta, default: "1.0", range: "0 ~ 10", desc: "随机强度。0 = 退化为确定性 ODE（可复现、更平）" }
  - { name: s_noise, default: "1.0", range: "0 ~ 100", desc: "噪声缩放" }
outputs:
  - { name: SAMPLER, type: SAMPLER, desc: "接 自定义采样器（高级） 的 sampler" }
---

Anima 作者推荐的 `er_sde` 的可调版本。想要它的线条风格又要结果确定，把 `eta` 设 0；嫌它太"放飞"就降 `s_noise`。只在做采样器对照时才需要动这些。
