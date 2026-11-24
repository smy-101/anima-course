---
name_zh: LoRA加载器（仅模型）
category: 加载器
first_level: L1
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py, note: 参数 }
  - { badge: 官方, url: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_base_v1.json, note: 模板用它挂 anima-turbo-lora-v0.2 }
verified: 2026-11-24
inputs:
  - { name: model, type: MODEL, desc: "接 UNet加载器 或上一个 LoRA 的 MODEL" }
params:
  - { name: lora_name, default: "—", range: "loras 目录下的文件", desc: "LoRA 文件" }
  - { name: strength_model, default: "1.0", range: "-100 ~ 100", desc: "强度。风格 LoRA 0.6 ~ 1.0；角色 / 概念 1.0 起；Turbo LoRA 0.7 ~ 1.0" }
outputs:
  - { name: MODEL, type: MODEL, desc: "已叠加 LoRA 的模型" }
---

只有 model、lora_name、strength_model，输出 MODEL。**Anima 是拆分模型，只用这个**——`LoraLoader` 的 clip 输入是必填，没接 CLIP 会报缺少输入。

多个 LoRA 串联：第一个的 MODEL 接第二个的 model。A/B 某个 LoRA：选中它按 `Ctrl+B`（忽略 = 数据透传）。
