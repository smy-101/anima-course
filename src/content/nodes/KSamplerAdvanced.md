---
name_zh: K采样器（高级）
category: 采样
first_level: L7
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py", note: "add_noise / start_at_step / end_at_step / return_with_leftover_noise" }
verified: 2026-11-24
inputs:
  - { name: model, type: MODEL, desc: "同 K采样器" }
  - { name: positive, type: CONDITIONING, desc: "同 K采样器" }
  - { name: negative, type: CONDITIONING, desc: "同 K采样器" }
  - { name: latent_image, type: LATENT, desc: "第一段接空画布；第二段接第一段的输出" }
params:
  - { name: add_noise, default: "enable", range: "enable / disable", desc: "是否加初始噪声。**第二段必须 disable**" }
  - { name: noise_seed, default: "0", range: "整数", desc: "加噪用的种子" }
  - { name: steps, default: "20", range: "1 ~ 10000", desc: "整张时间表的步数" }
  - { name: cfg, default: "8.0", range: "0 ~ 100", desc: "同 K采样器" }
  - { name: sampler_name / scheduler, default: "—", range: "同 K采样器", desc: "同 K采样器" }
  - { name: start_at_step, default: "0", range: "0 ~ 10000", desc: "从第几步开始（按全表索引截取，真的会减步数）" }
  - { name: end_at_step, default: "10000", range: "0 ~ 10000", desc: "到第几步结束" }
  - { name: return_with_leftover_noise, default: "disable", range: "disable / enable", desc: "带着残留噪声输出。**第一段必须 enable**，第二段 disable" }
outputs:
  - { name: LATENT, type: LATENT, desc: "采样结果" }
---

按起止步切分采样，是“两段用不同模型 / 不同 CFG”的最简写法。

⚠️ `start_at_step / end_at_step` 按全表索引截取：steps 30、start 15 → 第二段真的只跑 15 步。想每段都 30 步，两段的 steps 都设 60。这与 K采样器 `denoise` 不减步数的行为不同。
