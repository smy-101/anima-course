---
title: 模型文件清单
kind: 模型文件
order: 2
sources:
  - badge: 官方
    url: https://huggingface.co/circlestone-labs/Anima
    note: 主模型仓库
  - badge: 官方
    url: https://huggingface.co/circlestone-labs/Anima-Official-LoRAs
    note: 官方 LoRA
  - badge: 官方
    url: https://huggingface.co/Comfy-Org/Anima-LLLite
    note: LLLite 权重
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/text_encoders/anima.py
    note: 分词器内置，不用下载
verified: 2026-11-24
---

文件放错目录是最常见的错误。目录表见课程 [准备](/lessons/00-01-setup/)。

| 文件 | 放哪 | 大小 | 用在 |
|---|---|---|---|
| `anima-base-v1.0.safetensors`（及 aesthetic / turbo 各版本） | `models/diffusion_models/` | 3.89 GB | L0 起 |
| `qwen_3_06b_base.safetensors` | `models/text_encoders/` | 1.11 GB | L0 起 |
| `qwen_image_vae.safetensors` | `models/vae/` | 242 MB | L0 起 |
| `anima-turbo-lora-v0.2.safetensors` | `models/loras/` | 142 MB | L1 |
| `anima-highres-aesthetic-boost` / `anima-rl-v0.1` / `anima-greg-rutkowski-style` | `models/loras/` | 各约 140 MB | L3 / L4 |
| 动漫向放大模型（如 `4x_IllustrationJaNai_V1_ESRGAN_135k.pth`，社区） | `models/upscale_models/` | — | L4 |
| `anima-lllite-any-test-like-v2.safetensors` | `models/model_patches/` | 15.6 MB | L5 |
| `anima-lllite-depth-1.safetensors` | `models/model_patches/` | 7.5 MB | L5 |
| `anima-lllite-lineart-1` / `pose-1` / `scribble-1` | `models/model_patches/` | — | L5（Preview3 代） |
| `anima-lllite-inpainting-v2.safetensors` | `models/model_patches/` | 62.7 MB | L6 |
| `depth_anything_3_mono_large.safetensors`（`Comfy-Org/Depth-Anything-3`） | `models/geometry_estimation/` | 1.24 GB | L5 深度预处理 |

**不要放到 `checkpoints/`**——Anima 是拆分模型。

分词器文件不用下载：Qwen3 与 T5 的分词器内置在 ComfyUI 仓库中（`comfy/text_encoders/qwen25_tokenizer`、`t5_tokenizer`），`qwen_3_06b_base.safetensors` 只含 LM 权重。

官方仓库当日文件列表只有 2B 的 Base / Aesthetic / Turbo / Preview。网传"Anima 2.9B"**不是官方版本**，相关"六工作流"文章自述"未实际运行验证"，引用需谨慎。

### 官方 LoRA 用法

| 官方 LoRA | 用法 | 作者说明 |
|---|---|---|
| `anima-turbo-lora-v0.1 / v0.2` | CFG 1、8–12 步；`strength` 0.7 ~ 1.0 | v0.2 在 base-v1.0 上训练，"细节更自然"；降到 0.7 仍保持蒸馏；用 `euler`，`er_sde` 可能太吵 |
| `anima-highres-aesthetic-boost` | 出高分辨率时挂上，`strength` 1.0 | 1536 基本无问题，甚至 2048（4 MP）也不散架；美学提升"较弱、看提示词" |
| `anima-rl-v0.1` | 默认 1.0；配强的美学微调模型时可能要略高于 1 | 强化美学与细节的 RL 实验版 |
| `anima-greg-rutkowski-style` | 提示词前缀 `@greg rutkowski. `，自然语言提示词效果最好 | 风格 LoRA 示例，附带训练配置 |
