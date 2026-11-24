---
title: 常见误区（核实后修正）
kind: 误区
order: 1
sources:
  - badge: 官方
    url: https://huggingface.co/circlestone-labs/Anima
    note: 模型卡
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/samplers.py
    note: "KSampler.set_steps；text_encoders/anima.py"
  - badge: 社区
    note: "Civitai 33857 系列作者为 Volnovik，非模型作者"
verified: 2026-11-24
---

社区教程里流传的说法，逐条核实。每一条都可以当成自测题：先盖住右列，看自己会不会答错。

| 流传说法 | 实际情况 |
|---|---|
| "Turbo 是一个 LoRA，放 loras 目录" | Turbo **既是独立的整模型**（`anima-turbo-v1.0/v1.1.safetensors`，放 `diffusion_models/`），**也有 LoRA 形式**（`anima-turbo-lora-v0.1/v0.2`，放 `loras/`）。两者都在官方仓库里 |
| "InvokeAI 也只需要那 3 个文件" | InvokeAI 还会额外下一个约 9GB 的 T5 编码器 |
| "负面提示词照抄官方那一串就行" | 用 Turbo（CFG 1）时负面无效；Aesthetic 不要 `score_*`。但**不要**因为正向用了 `@画师` 就删掉负面里的 `artist name`——那是"画面上别出现署名"的元标签 |
| "某些词只是普通的形容词" | `high contrast`、`monochrome`、`line art`、`wet`、`lace` 在 booru 里有精确含义，写进句子会把整张图带偏 |
| "提示词越长越好" | 自然语言要"可见事实多"，而不是形容词多；纯标签不必堆全（训练时有标签丢弃） |
| "把 Anima 当 SDXL / Illustrious 来写（下划线标签）" | Anima 要空格；下划线标签是常见错误（`score_N` 除外） |
| "denoise 0.5 = 只跑一半步数" | K采样器与基本调度器的 denoise **不减步数**：源码先按 int(steps/denoise) 生成更细的时间表再取最后 steps+1 段。减步数的是 K采样器（高级）的起止步与分离Sigma降噪 |
| "提示词一长就被截断了" | 两路分词器 `max_length=99999999`，**ComfyUI 不截断**；过长是注意力稀释 |
| "权重 1.2 就有明显加强" | 双分词器，Qwen 路权重被强制归 1，只有 T5 路生效。1.5 起、2.0 甜点 |
| "要另外下载分词器" | Qwen3 与 T5 分词器内置在 ComfyUI 仓库中，`qwen_3_06b_base.safetensors` 只含 LM 权重 |
| "同种子换分辨率还是同一张构图" | 噪声张量形状跟着画布尺寸走，1024² 和 896×1152 是两张不同的图 |
| "fp8 / fp16 省显存没代价" | Anima 支持 bf16 / fp16 / fp32；源码里 fp16 的显存估算系数 ×1.4，日常保持 `default`；fp8 可用但有画质代价 |
| "Anima 2.9B" | **不是官方版本**：官方仓库当日只有 2B 的 Base / Aesthetic / Turbo / Preview；相关"六工作流"文章自述未运行验证 |
| "Civitai 33857 是模型作者的提示词指南" | 该系列是社区作者 **Volnovik** 写的，不是模型作者 tdrussell。两者推荐值有差异，引用必须区分 |
| "Anima 用应用ControlNet 节点接 ControlNet" | Anima 走**模型补丁**路线：`ModelPatchLoader → AnimaLLLiteApply` 接在 UNETLoader 与 K采样器之间，改的是 MODEL 不是条件 |
| "桌面版模型放在程序目录里" | 当前桌面版在独立的共享目录 `%LOCALAPPDATA%\Comfy-Desktop\ComfyUI-Shared`，不在程序目录 |
| "denoise 值越低，与输入图像的关联性越小" | 个别中文文档译反了。正确：值越低，越接近输入图 |
