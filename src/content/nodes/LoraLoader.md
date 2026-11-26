---
name_zh: 加载LoRA
category: 加载器
first_level: L3
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py, note: "model / clip 均为必填；strength 默认 1.0，范围 -100 ~ 100" }
verified: 2026-11-24
inputs:
  - { name: model, type: MODEL, desc: "接上游的 MODEL" }
  - { name: clip, type: CLIP, desc: "接上游的 CLIP——必填。Anima 工作流里没有可接的 CLIP，会报缺少输入" }
params:
  - { name: lora_name, default: "—", range: "loras 目录下的文件", desc: "LoRA 文件" }
  - { name: strength_model, default: "1.0", range: "-100 ~ 100", desc: "对去噪模型的强度；日常 0 ~ 1，越大风格越强" }
  - { name: strength_clip, default: "1.0", range: "-100 ~ 100", desc: "对文本编码器的强度" }
outputs:
  - { name: MODEL, type: MODEL, desc: "已叠加 LoRA 的模型" }
  - { name: CLIP, type: CLIP, desc: "已叠加 LoRA 的文本编码器" }
---

整包 checkpoint 模型（SD1.5 / SDXL）的 LoRA 加载器：同时影响模型和文本编码器，输出 MODEL、CLIP 两条线。多个串联时，第一个的 MODEL / CLIP 接第二个的 model / clip。

Anima 不用它。Anima 是拆分模型，官方模板与 L1 / L3 用的都是 [LoRA加载器（仅模型）](/nodes/LoraLoaderModelOnly/)。从左侧模型库把 LoRA 文件拖到画布时，自动生成的就是这个节点——记得换成仅模型版，或直接从节点库添加。见课程 [LoRA 串联与 A/B](/lessons/03-02-l3-lora/)。
