---
title: 常见误区
kind: 误区
order: 1
sources:
  - badge: 官方
    url: https://huggingface.co/circlestone-labs/Anima
    note: 模型卡
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/samplers.py
    note: "KSampler.set_steps；text_encoders/anima.py"
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/ldm/anima/lllite.py
    note: "AnimaLLLiteApply：mask 二值化、控制图中心裁剪"
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py
    note: "KSamplerAdvanced 起止步按全表索引截取"
  - badge: 官方
    url: https://docs.comfy.org/zh/interface/features/subgraph
    note: 子图蓝图副本相互独立
  - badge: 社区
    note: "Civitai 33857 系列作者为 Volnovik，非模型作者；放大倍率上限来自 HF 讨论区 #163 / #204 / #165"
verified: 2026-11-24
---

社区教程里流传的说法，逐条核实过。每一条都可以当成自测题：先盖住右列，看自己会不会答错。

| 流传说法 | 实际情况 |
|---|---|
| “Turbo 是一个 LoRA，放 loras 目录” | Turbo 既是独立的整模型（`anima-turbo-v1.0/v1.1.safetensors`，放 `diffusion_models/`），也有 LoRA 形式（`anima-turbo-lora-v0.1/v0.2`，放 `loras/`）。两者都在官方仓库里 |
| “InvokeAI 也只需要那 3 个文件” | InvokeAI 还会额外下一个约 9GB 的 T5 编码器 |
| “负面提示词照抄官方那一串就行” | 用 Turbo（CFG 1）时负面无效；Aesthetic 不要 `score_*`。但不要因为正向用了 `@画师` 就删掉负面里的 `artist name`。它是“画面上别出现署名”的元标签 |
| “某些词只是普通的形容词” | `high contrast`、`monochrome`、`line art`、`wet`、`lace` 在 booru 里有精确含义，写进句子会把整张图带偏 |
| “提示词越长越好” | 自然语言要“可见事实多”，而不是形容词多；纯标签不必堆全（训练时有标签丢弃） |
| “把 Anima 当 SDXL / Illustrious 来写（下划线标签）” | Anima 要空格；下划线标签是常见错误（`score_N` 除外） |
| “denoise 0.5 = 只跑一半步数” | K采样器与基本调度器的 denoise 不减步数。源码先按 int(steps/denoise) 生成更细的时间表，再取最后 steps+1 段。减步数的是 K采样器（高级）的起止步与分离Sigma降噪 |
| “提示词一长就被截断了” | 两路分词器 `max_length=99999999`，ComfyUI 不截断；过长是注意力稀释 |
| “权重 1.2 就有明显加强” | 双分词器，Qwen 路权重被强制归 1，只有 T5 路生效。1.5 起、2.0 甜点 |
| “要另外下载分词器” | Qwen3 与 T5 分词器内置在 ComfyUI 仓库中，`qwen_3_06b_base.safetensors` 只含 LM 权重 |
| “同种子换分辨率还是同一张构图” | 噪声张量形状跟着画布尺寸走，1024² 和 896×1152 是两张不同的图 |
| “fp8 / fp16 省显存没代价” | Anima 支持 bf16 / fp16 / fp32；源码里 fp16 的显存估算系数 ×1.4，日常保持 `default`；fp8 可用但有画质代价 |
| “Anima 2.9B” | 不是官方版本：官方仓库当日只有 2B 的 Base / Aesthetic / Turbo / Preview；相关“六工作流”文章自述未运行验证 |
| “Civitai 33857 是模型作者的提示词指南” | 该系列是社区作者 Volnovik 写的，不是模型作者 tdrussell。两者推荐值有差异，引用必须区分 |
| “Anima 用 加载ControlNet模型 + 应用ControlNet 节点接 ControlNet” | Anima 走模型补丁路线：先接 [加载模型补丁](/nodes/ModelPatchLoader/)，再接 [应用 Anima LLLite](/nodes/AnimaLLLiteApply/)。两个节点串在 UNETLoader 与 K采样器之间，改的是 MODEL，不是条件。[加载ControlNet模型](/nodes/ControlNetLoader/) 那条路是 SD / SDXL 系的 |
| “桌面版模型放在程序目录里” | 当前桌面版在独立的共享目录 `%LOCALAPPDATA%\Comfy-Desktop\ComfyUI-Shared`，不在程序目录 |
| “denoise 值越低，与输入图像的关联性越小” | 个别中文文档译反了。正确：值越低，越接近输入图 |
| “图生图要把大图直接喂进去，出来的就是大图” | 输入图的尺寸就是输出尺寸；3000×4000 直接编码得到的是一张构图崩坏的图。先缩到约 1 MP，想要大图走放大 |
| “Turbo 起稿后同 seed 换 Aesthetic，构图一定一样” | 同架构、同文本编码器，构图往往相近但不保证相同。要保留构图就用潜空间精修（第二段 denoise 0.35 ~ 0.5） |
| “Anima 用 加载LoRA 挂 LoRA” | Anima 是拆分模型，只用 [LoRA加载器（仅模型）](/nodes/LoraLoaderModelOnly/)；[加载LoRA](/nodes/LoraLoader/) `LoraLoader` 的 clip 输入必填，没接会报缺少输入 |
| “放大倍率越大越好，一次 ×2” | 1024² 起步单段 ≤ 1.5×，1536² 起步约 1.3×；再大分两段或分块放大（UltimateSDUpscale） |
| “二次采样 denoise 越高细节越多” | 0.35 ~ 0.45 补细节不改构图；> 0.6 构图漂移 |
| “放大模型能顺手把手崩修好” | 放大模型只重建边缘；手脸要先重绘 / Detailer 修掉再放大，否则接缝和错误一并放大 |
| “LLLite 的 mask 可以羽化得软一点” | LLLite 在 0.5 处二值化 mask，软边等于没有；要比目标区域涂大一圈（扩展遮罩 8 ~ 16） |
| “LLLite 权重放 controlnet 目录” | 必须 `models/model_patches/`，用 加载模型补丁 读取；Pose 权重在 Preview3 代训的，v1.0 上偏弱 |
| “重绘时提示词照抄整图” | 局部重绘只写遮罩里要出现的东西；扩图才写整张画面 |
| “脸 / 手留到放大后再修” | 放大后再修会把接缝和风格差一并放大；在放大之前用裁剪法或 FaceDetailer |
| “两段采样每段 steps 填 30 就是各 30 步” | K采样器（高级）的 start / end 按全表索引截取，第二段真的只跑一半；想各 30 步两段都设 60。这与 K采样器 denoise 不减步数不同 |
| “基本引导器到哪都能用” | 它只跑一路条件，等效 CFG 1：Turbo 用它省一半；Base / Aesthetic 要负向、或挂 NAG 时必须用 CFG引导器 |
| “shift 调高更稳，所以越高越好” | Anima 默认 3.0（源码写死）；调高把步数留在高噪声段，步数固定时低噪声段变少会糊；LLLite v2 权重按 3.0 训练 |
| “NAG 在 Turbo 上也能让负向生效” | NAG 要求 CFG > 1（需要正负两路，会关闭 CFG 1 优化）；Turbo 下无意义 |
| “从蓝图拖出来的子图副本会跟着蓝图一起变” | 副本相互独立，可单独编辑；要统一更新就改节点库里的蓝图再重新拖 |
