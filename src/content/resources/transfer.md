---
title: 换一个模型时，什么不变、什么要换
kind: 概念
order: 1
sources:
  - badge: 官方
    url: https://docs.comfy.org/zh/tutorials/image/anima/anima
    note: Anima 的加载器写法与参数起点
  - badge: 官方
    url: https://docs.comfy.org/zh/tutorials/basic/text-to-image
    note: 整包 checkpoint 的文生图工作流
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py
    note: "CheckpointLoaderSimple 交出 MODEL / CLIP / VAE；LoraLoader 的 clip 必填"
  - badge: 社区
    note: "SD1.5 / SDXL 的参数起点为社区概括（《节点详解》§4.1），以各模型卡为准"
verified: 2026-11-24
---

**这门课教的是方法，Anima 只是载体。** 学完 14 天换一个模型（SDXL、Illustrious、Qwen-Image、FLUX……），下面这些不用重学。要换的只有“接口”和“起点值”。

## 不变的

- 四条纪律。固定种子，一次只改一个变量，先用蒸馏版试稿再用完整版出成品，固定分辨率。
- 调参顺序 T1 到 T6：先是 seed，再是分辨率、cfg、steps、采样器，最后是调度器。低阶没定，不碰高阶。
- 六个阶段：加载、编码、起始画布、采样、解码、保存。换模型只是第一阶段换个加载器。
- K采样器每个参数的含义：seed / steps / cfg / sampler / scheduler / denoise；CFG = 1 时负向失效；denoise 不减步数。
- LoRA 的用法：串在模型线上，`strength` 从 0.7 ~ 1.0 起调，`Ctrl+B` 看贡献。文件必须与底模匹配。
- 图生图与局部重绘：denoise 五档的“保留程度”；遮罩比目标大一圈；重绘只写遮罩里要出现的东西；扩图写整张。
- 放大三路线与分块：放大模型、Latent 放大 + 二次采样、像素放大 + 图生图；单段倍率有上限，更大就两段或分块（UltimateSDUpscale）。
- 拆开采样器：K采样器（高级）、自定义采样器、引导器、时间表工具。这些零件是通用的，换模型照用。

## 要换的

**下表的数值都是起点值，换模型后要用自己的固定种子重做一遍 T1。**

| 项目 | Anima（拆分模型） | SDXL / Illustrious（整包） | SD1.5（整包） |
|---|---|---|---|
| 加载器 | [UNet加载器](/nodes/UNETLoader/) + [加载CLIP](/nodes/CLIPLoader/) + [加载VAE](/nodes/VAELoader/) 三个 | [Checkpoint加载器（简易）](/nodes/CheckpointLoaderSimple/) 一个，交出 MODEL / CLIP / VAE | 同左 |
| 文本编码器 | Qwen3-0.6B + T5；`type` 选 `stable_diffusion`（官方模板） | 包内自带（SDXL 是 clip_l + clip_g） | 包内自带 CLIP |
| 提示词写法 | 标签与自然语言都是真正的控制手段；标签用空格 | 以标签为主；Illustrious / Pony 系沿用 booru 下划线标签 | 以标签为主 |
| 起始分辨率 | 约 1 MP：1024×1024 | 1024×1024（或 896×1152） | 512×512（或 512×768） |
| steps | 30（Turbo 8 ~ 12） | 25 ~ 30 | 20 ~ 30 |
| cfg | 4 ~ 5（Turbo 1） | 5 ~ 7 | 6 ~ 8 |
| 采样器 / 调度器 | `euler / simple`（模板）或 `er_sde` | `euler / normal` 或 `dpmpp_2m / karras`，也可 `sgm_uniform` | `euler / normal` 或 `dpmpp_2m / karras` |
| 质量标签 | Base 可加 `masterpiece, best quality`；Aesthetic 禁 `score_*` | 按模型卡（Pony 系用 `score_*`） | 按模型卡 |
| 负向 | 敏感，短；Turbo 下无效 | 模型卡给的负向照用 | 模型卡给的负向照用 |
| LoRA 加载器 | [LoRA加载器（仅模型）](/nodes/LoraLoaderModelOnly/)；文件要标“兼容 Anima” | [加载LoRA](/nodes/LoraLoader/)（model + clip 都接）；文件要与底模匹配 | 同左 |
| 结构控制 | 模型补丁：先接 [加载模型补丁](/nodes/ModelPatchLoader/)，再接 [应用 Anima LLLite](/nodes/AnimaLLLiteApply/)，串在 model 线上；权重放 `model_patches/` | 先接 [加载ControlNet模型](/nodes/ControlNetLoader/)，再接应用ControlNet（高级），接在条件线上；权重放 `controlnet/` | 同左 |
| 预处理（线稿 / 深度） | 核心的 [Canny](/nodes/Canny/)、Depth Anything 3 | 通常用社区包 `comfyui_controlnet_aux` | 同左 |
| 局部重绘 | 无专用 inpaint 模型：VAE编码（局部重绘）+ 遮罩、LLLite 的 inpainting 权重、或裁剪法 | 有专用 inpainting 模型时，加 内补模型条件 节点 | 同左 |
| 加速版 | Turbo 整模型或 Turbo LoRA（CFG 1、8 步） | LCM / Lightning 类 LoRA，同样 CFG 1、少步数 | 同左 |

Qwen-Image、FLUX 等也是拆分模型，加载器写法与 Anima 同类（UNet加载器 + 文本编码器加载器 + 加载VAE）。区别在文本编码器要用哪个加载器、`type` 选什么，照各自的官方模板填。

## 换模型的最小步骤

1. 换加载器。三个拆分加载器换成一个整包加载器，或者反过来。文本编码器的 `type` 必须与架构匹配，否则报错或出乱图。
2. 分辨率回到模型的舒适区，然后重做 T1：先 cfg，再 steps，最后采样器。旧模型的基线表不能直接抄。
3. 质量标签与负向按新模型的模型卡换。第一轮先不填负向，看裸提示词出什么问题再加。
4. LoRA 换成“兼容该底模”的文件，加载器种类跟着模型走（拆分 / 整包）。
5. 结构控制换路线，模型补丁和条件线上的 ControlNet 互换。预处理节点往往可以复用。
6. 放大倍率上限与二次采样 denoise 重新验证。舒适区分辨率变了，倍率上限也跟着变。

**真正要重做的只有第 2 步和第 6 步。** 换完你会发现，那本来就是这门课让你用固定种子自己测的东西。
