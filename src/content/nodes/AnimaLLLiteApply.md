---
name_zh: 应用 Anima LLLite
category: 模型补丁
first_level: L5
experimental: true
sources:
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_model_patch.py", note: "参数范围；mask 在 0.5 处二值化" }
  - { badge: 源码, url: "https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/ldm/anima/lllite.py", note: "控制图按 latent×8 中心裁剪 + bicubic 缩放；非 4 通道权重忽略 mask" }
  - { badge: 官方, url: "https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_lllite_any_control_to_image.json", note: "模板默认 strength 1 / start 0 / end 1" }
verified: 2026-11-24
inputs:
  - { name: model, type: MODEL, desc: "接 UNet加载器（或 LoRA 链）" }
  - { name: model_patch, type: MODEL_PATCH, desc: "接 加载模型补丁" }
  - { name: image, type: IMAGE, desc: "控制图，只取 RGB 三通道" }
  - { name: mask, type: MASK, required: false, desc: "可选。inpainting 权重必接；3 通道权重接了也会被忽略" }
params:
  - { name: strength, default: "1.0", range: "-10 ~ 10", desc: "控制强度。0 等于不应用；不听话 1.2 ~ 1.5；太死板 0.6 ~ 0.8" }
  - { name: start_percent, default: "0", range: "0 ~ 1", desc: "从采样的百分之几开始生效。结构控制一般从 0 开始" }
  - { name: end_percent, default: "1.0", range: "0 ~ 1", desc: "到百分之几停止。想让模型自由收尾 → 0.8 ~ 0.9" }
outputs:
  - { name: MODEL, type: MODEL, desc: "已注入控制的模型，接 K采样器（或继续串第二个 LLLite）" }
---

Anima 的 ControlNet。与 SD 系"[加载ControlNet模型](/nodes/ControlNetLoader/) → 应用ControlNet"那条路不同：它**改 MODEL 而不是改条件**，所以串在 UNet加载器 与 K采样器 之间（L1 里就是放在 UNETLoader 与 Turbo LoRA 开关之间）。

源码里的三条规矩：

- **画布比例要 = 控制图比例**：节点把控制图按输出潜空间的宽高比做中心裁剪，再 bicubic 缩放到 latent×8。用 获取图像尺寸 把 空Latent图像 的宽高对齐控制图，边就不会被裁。
- **mask 会被二值化**（在 0.5 处）：软边、羽化对它无效，重绘时要涂大一圈。
- **只支持单帧**，只对 `start_percent ~ end_percent` 对应的 sigma 区间生效。

多个 LLLite 可以串联（姿势 + 深度），各自有独立的强度与区间；强度是相加的，别都拉满。
