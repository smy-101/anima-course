---
name_zh: 加载 LoRA（模型）
category: 加载器
first_level: L3
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_lora_stack.py, note: "1 ~ 20 行动态输入；每行 lora_name / strength / enabled；只作用于 MODEL" }
verified: 2026-11-24
inputs:
  - { name: model, type: MODEL, desc: "接 UNETLoader 或上一个加载器的 MODEL" }
params:
  - { name: "loras（每行）", default: "—", range: "1 ~ 20 行", desc: "每行三个控件：lora_name（loras 目录下的文件）、strength（默认 1.0，-100 ~ 100）、enabled（默认开；关掉即跳过该 LoRA，不用清文件）" }
outputs:
  - { name: MODEL, type: MODEL, desc: "按行顺序叠加完所有 LoRA 的模型" }
---

LoRA 堆栈：一个节点挂 1 ~ 20 个 LoRA，每行选文件、强度、开关，输出 MODEL。固定搭配一串 LoRA 的工作流用它，比串联多个 [LoRA加载器（仅模型）](/nodes/LoraLoaderModelOnly/) 省地方。

和仅模型版一样只作用于模型线，适用于 Anima（文本编码器另有同包的 加载 LoRA（文本编码器）`LoadLoraTextEncoder`）。行内 `enabled` 关掉或 `strength = 0` 都会跳过该 LoRA——但做 A/B 对照时，[课程里的做法](/lessons/03-02-l3-lora/)仍是多个单独的加载器 + `Ctrl+B`，一眼能看出是哪个 LoRA 的贡献。
