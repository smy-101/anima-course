---
title: L0 · 从空白画布搭出 9 个节点
stage: 1
order: 1
summary: "学完你能从空白画布连出文生图的最短管线，并指着每条线说出它传的是什么类型的数据。"
levels: [L0]
days: [1]
promptTrack: false
prerequisites:
  - 00-01-setup
nodes:
  - UNETLoader
  - CLIPLoader
  - VAELoader
  - CLIPTextEncode
  - EmptyLatentImage
  - KSampler
  - VAEDecode
  - SaveImage
tags:
  - masterpiece
  - best-quality
  - score-9
  - safe
  - worst-quality
  - low-quality
  - blurry
  - jpeg-artifacts
  - sepia
deliverable: "第一张自己从零搭出来的 Anima 图，保存前缀 Anima/L0。"
acceptance:
  - 9 个节点、9 条线全部连对，运行出图
  - 能指着每条线说出数据类型与颜色（MODEL 薰衣草 / CLIP 黄 / VAE 玫瑰 / CONDITIONING 橙 / LATENT 粉 / IMAGE 蓝）
  - seed 已设为 fixed；同一条提示词换了 3 个 seed 各出一张
  - seed 不变、只换提示词，出了 3 张
  - 把输出的 PNG 拖回空白画布，还原出了工作流
  - 换 seed、换提示词出的两组图都记进了实验记录本，并写下今天的“今日基线”
  - 把官方模板“Anima Base v1”拖进画布，双击子图，和自己搭的对比过节点、数值与连线
figures:
  - id: l0-pipeline
    src: ../../assets/figures/l0-pipeline.webp
    caption: "L0 基线管线：9 节点连线截图，标注端口颜色与数据类型"
    group: 管线
  - id: l0-seed-a
    src: ../../assets/figures/l0-seed-a.webp
    caption: "同一提示词，seed 固定为 A 的构图"
    group: 种子
  - id: l0-seed-b
    src: ../../assets/figures/l0-seed-b.webp
    caption: "同一提示词，seed B"
    group: 种子
  - id: l0-seed-c
    src: ../../assets/figures/l0-seed-c.webp
    caption: "同一提示词，seed C，体会“种子决定构图”"
    group: 种子
  - id: l0-prompt-tags
    src: ../../assets/figures/l0-prompt-tags.webp
    caption: "同一 seed，模板 A（纯标签）"
    group: 提示词
  - id: l0-prompt-prose
    src: ../../assets/figures/l0-prompt-prose.webp
    caption: "同一 seed，模板 B（自然语言）"
    group: 提示词
transfers: true
sources:
  - badge: 官方
    url: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_base_v1.json
    note: 官方 Anima Base v1 模板的节点与默认值（30 步 / CFG 4 / euler / simple）
  - badge: 官方
    url: https://huggingface.co/circlestone-labs/Anima
    note: 模型卡（分辨率 16 的倍数、er_sde 推荐）
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py
    note: CLIPLoader 的 type 下拉里没有 anima，官方模板用 stable_diffusion
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/supported_models.py
    note: Anima 为 flow-matching，bf16 为主；fp16 显存估算系数 ×1.4
verified: 2026-11-24
---

## 数据类型

这一级你要从空白画布搭出最短的管线，跑出第一张图。目的不是出好图，而是弄清每个端口为什么连到那里。

端口用颜色区分类型，只有同颜色的端口才能连。先认这几种：

| 数据类型 | 颜色 | 里面装的是什么 | 谁产生 |
|---|---|---|---|
| 扩散模型 MODEL | 薰衣草色 | 去噪网络的权重，含 LoRA、采样修补的叠加效果 | 各类加载器、LoRA 加载器 |
| CLIP | 黄色 | 文本编码器 | 加载CLIP |
| VAE | 玫瑰色 | 图像与潜空间之间的编解码器 | 加载VAE |
| 条件 CONDITIONING | 橙色 | 编码后的提示词向量 | CLIP文本编码 |
| 潜空间图像 LATENT | 粉色 | 压缩表示的图，一张或一批 | 空Latent图像、K采样器 |
| 像素图像 IMAGE | 蓝色 | 真正的图，浮点数 0–1 | VAE解码 |
| 数字 INT / FLOAT | 灰色 | 整数、小数 | 数字节点 |

强类型省掉了猜测：**接不上的线就是真的不兼容，不用硬试。**

## 节点清单

一共 9 个节点：

| # | 节点 `类名` | 作用 | 关键参数 |
|---|---|---|---|
| 1 | UNet加载器 `UNETLoader` | 读入 2B 去噪模型 | `unet_name = anima-base-v1.0.safetensors`，`weight_dtype = default` |
| 2 | 加载CLIP `CLIPLoader` | 读入 Qwen3-0.6B 文本编码器 | `clip_name = qwen_3_06b_base.safetensors`，`type = stable_diffusion` |
| 3 | 加载VAE `VAELoader` | 读入 Qwen-Image VAE | `vae_name = qwen_image_vae.safetensors` |
| 4 | CLIP文本编码 `CLIPTextEncode`（正向） | 把提示词变成条件 | `text` |
| 5 | CLIP文本编码 `CLIPTextEncode`（负向） | 把负向变成条件 | `text` 为模板默认负向 |
| 6 | 空Latent图像 `EmptyLatentImage` | 起始画布 | `1024 × 1024`，`batch_size = 1` |
| 7 | K采样器 `KSampler` | 采样 | `seed fixed`，`steps 30`，`cfg 4`，`euler`，`simple`，`denoise 1` |
| 8 | VAE解码 `VAEDecode` | 把潜空间图变成像素图 | — |
| 9 | 保存图像 `SaveImage` | 写 PNG，内嵌工作流 | `filename_prefix = Anima/L0` |

每一行都可以点进 [节点字典](/nodes/) 看端口与参数：[UNETLoader](/nodes/UNETLoader/) · [CLIPLoader](/nodes/CLIPLoader/) · [VAELoader](/nodes/VAELoader/) · [CLIPTextEncode](/nodes/CLIPTextEncode/) · [EmptyLatentImage](/nodes/EmptyLatentImage/) · [KSampler](/nodes/KSampler/) · [VAEDecode](/nodes/VAEDecode/) · [SaveImage](/nodes/SaveImage/)

## 连线

```
①加载   UNETLoader(anima-base-v1.0, default) ───────────────────────MODEL──▶ KSampler.model
        CLIPLoader(qwen_3_06b_base, type=stable_diffusion, device=default)
        VAELoader(qwen_image_vae)
②编码   CLIPLoader.CLIP ──▶ CLIPTextEncode(正向).clip  ──CONDITIONING──▶ KSampler.positive
        CLIPLoader.CLIP ──▶ CLIPTextEncode(负向).clip  ──CONDITIONING──▶ KSampler.negative
③画布   EmptyLatentImage(1024×1024, batch 1) ──LATENT──▶ KSampler.latent_image
④采样   KSampler(seed 固定, steps 30, cfg 4, euler, simple, denoise 1)
⑤解码   KSampler.LATENT ──▶ VAEDecode.samples      VAELoader.VAE ──▶ VAEDecode.vae
⑥保存   VAEDecode.IMAGE ──▶ SaveImage(filename_prefix = "Anima/L0")
```

一共 9 个节点、9 条线。**记住这条管线，后面每一级都是在它上面插入或追加节点。**

## 动手步骤

1. 先按 `Ctrl+S` 存一个叫 `L0` 的工作流。
2. 双击空白处，输入英文类名添加节点。输 `KSampler`、`VAEDecode` 这种类名一定能搜到。
3. 从输出圆点拖到同色输入圆点。连下游最快的方式是从输出圆点拖线到空白处松手。弹出搜索框后选中节点，线就连好了。
4. 把 K采样器 seed 控件右侧的选项设为 **fixed**。
5. 填提示词。正向先用[提示词模板](/resources/prompt-templates/)里的 A（纯标签）跑一张，再换 B（自然语言）跑一张，seed 不动。
6. 负向填模板默认那一串，见下一节的表。
7. 按 `Ctrl+Enter` 运行。图出现在保存图像节点和 `ComfyUI/output/Anima/L0/`。
8. 把输出的 PNG 拖回一个空白画布，工作流会原样还原。

搭完并出图后，把官方模板“Anima Base v1”拖进画布，双击子图。看看它和你搭的在节点、数值、连线上有什么不同，答案在下一课。

## 参数与取值

下表的数值都是起点值，用固定种子出过图、看过结果再改。

| 参数 | 取值 | 说明 |
|---|---|---|
| 画布尺寸 | 1024×1024 起步 | 宽高都必须是 8 的倍数，这是节点限制。Anima 建议 16 的倍数：官方模板的 `ResolutionSelector.multiple=16`，kohya 的训练桶步长也是 16 |
| `batch_size` | 1 | 同一批次里每张的噪声不同。调参时保持 1，省显存，结果也可控 |
| `steps` | 30 | 30 够用，40 出成品 |
| `cfg` | 4 | 甜点在 3 到 5 之间。画面过饱和、线条发硬，就是偏高了 |
| 采样器 / 调度器 | `euler` / `simple`（模板默认）或 `er_sde`（作者默认） | 采样器会明显影响画风，下一阶段用对照图选 |
| 正向 | 模板 A 或 B | 两种都试一次 |
| 负向 | `worst quality, low quality, score_1, score_2, score_3, blurry, jpeg artifacts, sepia` | 模板默认 |

三个版本完整的参数基线见[三版本参数基线](/resources/param-baseline/)。

## 调参顺序

先什么都不调，跑通。然后固定 seed，只换提示词跑 3 次，再只换 seed 跑 3 次，体会种子决定构图。这是“一次只改一个变量”的第一次练习。

## 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 三个加载器变成橙色、带“问题”角标 | 文件没下或放错目录，对照[准备课](/lessons/00-01-setup/)的目录表。放好后按 `R` |
| 下拉里没有刚放进去的文件 | 按 `R` 刷新。子文件夹里的文件可能检测不到，手动在节点里选 |
| 出图全黑 | `VAEDecode.vae` 没接 |
| 显存不足 | 降到 768×1024 一类约 0.8 MP 的尺寸。`weight_dtype` 保持 default，Anima 以 bf16 为主，fp16 的显存估算系数反而更高 |
| 出图重复人像 / 构图乱 | 分辨率保持在约 1 MP |
