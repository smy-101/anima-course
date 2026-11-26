---
title: L8 · 让工作流替你做对比和重复
stage: 5
order: 3
summary: "学完你能拼出模型 × 种子的对比网格，用循环做渐进放大，并让文件名带上参数，调参时不混图。"
levels: [L8]
days: [13]
promptTrack: false
prerequisites:
  - 05-02-l7-shift-guidance
nodes:
  - ImageStitch
  - ImageGrid
  - StringConcatenate
  - StringFormat
  - StartLoop
  - EndLoop
  - PrimitiveNode
  - PrimitiveInt
  - PrimitiveFloat
  - LatentUpscaleBy
  - KSampler
  - TextOverlay
  - UNETLoader
  - CLIPLoader
  - VAELoader
tags: []
deliverable: 一张“3 模型 × 4 种子”网格；一次 3 轮渐进放大（每轮 1.25× + denoise 0.35）的结果。
acceptance:
  - 拼出了一张列 = 模型、行 = 种子的网格，行列顺序与预期一致
  - 知道为什么用 batch_size 当“种子”，以及不同架构的模型怎么放进同一张网格
  - 用开始循环 / 结束循环跑了一次 3 轮渐进放大，并能说出更简单的等价做法
  - 保存图像的前缀用了变量（日期或节点参数），文件按参数自动分目录
  - 用过 Run 栏的批量次数或 Run (On Change) 队列模式
figures:
  - id: l8-grid
    caption: "3 模型（列）× 4 种子（行）网格，Base / Aesthetic / Turbo，同 seed、同提示词"
    group: 网格
  - id: l8-loop
    caption: "渐进放大循环，从 1024² 逐轮放大到 1280²、1600²、2048²，每轮 denoise 0.35"
    group: 循环
  - id: l8-filenames
    caption: "输出目录 Anima/L4_hires_d0.4_s1.5/，按参数自动分目录"
    group: 文件名
transfers: true
sources:
  - badge: 官方
    url: https://github.com/circlestone-labs/Anima
    note: "anima_comparison.json：PrimitiveNode(COMBO) 驱动 sampler_name、batch_size 4 当种子、ImageStitch 拼列"
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_loop.py
    note: "StartLoop / EndLoop：simple / For / List 模式；iteration_index；accumulate"
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_images.py
    note: "ImageStitch 支持批次，按索引逐张拼"
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py
    note: "SaveImage.filename_prefix 支持 %date:yyyy-MM-dd%、%节点名.参数%"
  - badge: 官方
    url: https://docs.comfy.org/zh/interface/overview
    note: Run 栏：批量次数、队列模式
verified: 2026-11-24
---

## 用到的节点

到这里，单个工作流里的每一段你都调过了。这一课做三件自动化的事。用一张网格对比模型和种子，用循环做渐进放大，用带参数的文件名整理输出。它们不改变画面，只改变你做实验的速度，是调参阶梯里的 T6。

| 节点 `类名` | 作用 |
|---|---|
| 图像拼接 `ImageStitch` | 把 image2 接到 image1 的 right / down / left / up；支持批次，按索引逐张拼 |
| 图像表格 `ImageGrid` | 把一个批次拼成网格（L2） |
| 字符串连接 `StringConcatenate` / 字符串格式化 `StringFormat` | 拼提示词前缀、拼文件名 |
| 通用 Primitive `PrimitiveNode`（COMBO） | 把 `sampler_name` 抽成共享控件 |
| 开始循环 `StartLoop` / 结束循环 `EndLoop` | 让一段节点循环 N 次：`iteration_index`、`is_first`、`is_last`、`current_iteration_value` |
| Run 栏：批量次数、队列模式 `Run (On Change)` | 同一工作流排队 N 次；一改参数就自动重跑 |
| `SaveImage.filename_prefix` 变量 | `%date:yyyy-MM-dd%`、`%节点名.参数%` |

端口细节：[ImageStitch](/nodes/ImageStitch/) · [ImageGrid](/nodes/ImageGrid/) · [StringConcatenate](/nodes/StringConcatenate/) · [StringFormat](/nodes/StringFormat/) · [StartLoop](/nodes/StartLoop/) · [EndLoop](/nodes/EndLoop/)

## 对比网格

这一节的连法照搬作者发布的 `anima_comparison.json`，一张图看完模型 × 种子。

```
共享：PrimitiveNode(Seed, fixed) ──INT──▶ 每个 KSampler.seed
      PrimitiveInt(Steps 30) ──▶ 每个 KSampler.steps      PrimitiveFloat(CFG 4) ──▶ 每个 KSampler.cfg
      PrimitiveNode(COMBO, er_sde) ──▶ 每个 KSampler.sampler_name
      EmptyLatentImage(832×1248, batch_size 4) ──LATENT──▶ 每个 KSampler.latent_image    ← 同一 seed，batch 内 4 种噪声 = 4 个"种子"
每个模型一个分支：
      UNETLoader(A).MODEL ──▶ KSamplerA ──▶ VAEDecodeA
      UNETLoader(B).MODEL ──▶ KSamplerB ──▶ VAEDecodeB
      UNETLoader(C).MODEL ──▶ KSamplerC ──▶ VAEDecodeC
拼图：
      VAEDecodeA.IMAGE ──▶ ImageStitch①.image1      VAEDecodeB.IMAGE ──▶ ImageStitch①.image2 (direction right)
      ImageStitch①.IMAGE ──▶ ImageStitch②.image1   VAEDecodeC.IMAGE ──▶ ImageStitch②.image2
      ImageStitch②.IMAGE ──▶ ImageGrid(columns = 1) ──▶ SaveImage("Anima/compare")
```

结果是一张 4 行 3 列的网格，列是模型，行是种子。几个要点：

- `batch_size 4` 当 4 个“种子”用：同一 seed 下 batch 内每张的噪声不同，L2 讲过。
- **三个分支共用 seed、steps、cfg、采样器和 latent，只换模型**，这才是一次只改一个变量。
- 不同架构的模型（SDXL、Lumina、Newbie）也能放进同一张网格。前提是每个分支自带自己的文本编码器与 VAE。作者的 Anima 分支还显式接了一个 采样算法（AuraFlow），shift 填 3.0，和 Anima 默认值相同。这样写是为了和其它 flow 模型对齐。
- Turbo 分支的 cfg 和 steps 要单独给（cfg 1、steps 8）。给那个分支接两个 布尔切换，或者干脆不放 Turbo，用 Turbo LoRA 开关代替。

## 渐进放大循环

```
KSampler①.LATENT ──▶ StartLoop(mode simple, num_iterations 3).initial_iteration_value
StartLoop.current_iteration_value ──LATENT──▶ LatentUpscaleBy(1.25)
LatentUpscaleBy.LATENT ──▶ KSampler②(denoise 0.35).latent_image
KSampler②.LATENT ──▶ EndLoop.next_iteration_value
EndLoop.outputs ──LATENT──▶ VAEDecode ──▶ SaveImage
```

循环节点把“体内”的节点复制 N 份串起来。`iteration_index` 可以接到 绘制文本叠加 或文件名上做标记。`EndLoop.accumulate` 打开时返回每一轮的结果（一批），关闭时只返回最后一轮。更简单的等价做法是直接手搭两三个 K采样器 串联，就是 L4 的两段放大，可读性更好。**轮数固定就手搭串联，轮数常变才用循环**，循环的好处是不用到处复制节点。

## 文件名变量

`保存图像` 的前缀支持 `%date:yyyy-MM-dd%` 与 `%节点名.参数%`。调参阶段写成 `Anima/L4_hires_d%KSampler.denoise%_s%LatentUpscaleBy.scale_by%`，每个参数组合一个目录，图不会混。**变量名写的是节点标题，不是类名**。要更复杂的拼法用 字符串格式化，例如 `Anima/L4_hires_d{a}_s{b}`，a 和 b 接两个参数。

## 动手步骤

1. 网格。新建工作流，按对比网格一节的连法搭三个分支，用 Base、Aesthetic 和 Turbo LoRA 开关。共享控件用 Primitive 节点抽出来，`batch_size 4`。先跑一遍确认列是模型、行是种子，再用 绘制文本叠加 给每列写上模型名。
2. 循环。把 L4 的路线 B 改成渐进放大循环的连法，`num_iterations 3`，`iteration_index` 接 绘制文本叠加 写在图上。跑一次看三张逐步放大的图。
3. 文件名。把最近一个调参工作流的保存前缀改成带变量的写法，跑一次扫描，看输出目录结构。
4. 队列。调参时把队列模式切到 `Run (On Change)`，改一个数字就出一张。批量期用 Run 栏的批量次数 N，seed 设 `randomize`。

## 自动化

按时期挑一种用法。调参期用队列模式 `Run (On Change)`，`SaveImage` 文件名带参数变量。批量期用 Run 栏批量次数 N 配 seed `randomize`，或者 `batch_size` 设 N 一次采样。迭代期用 `StartLoop / EndLoop` 做渐进放大，或者“重绘、检查、再重绘”这类循环。复用期把子图发布成蓝图，这是下一课的事。

## 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 网格的行列反了 | `ImageStitch` 拼的是列（right），`ImageGrid(columns = 1)` 才按行铺；检查 direction 与 columns |
| 某一列的图明显不同 | 那个分支没接共享控件，用了自己的 seed 或 cfg；检查是否真的共用 |
| 循环跑完只有一张图 | `EndLoop.accumulate` 关着；想要每轮都看就打开 |
| 循环第二轮是纯噪声 | `next_iteration_value` 没接回 KSampler② 的输出；或第二段 `add_noise` 没关，用 K采样器时 denoise 要小于 1 |
| 文件名变量没生效 | 变量名要写节点标题而不是类名；给节点改个短标题，如把 `KSampler` 改成 `ks`，再用 `%ks.denoise%` |
| Run (On Change) 一改就跑、来不及 | 只在调参阶段开；调完切回 `Run` |

下一课把网格、循环和带参数的文件名串成一条完整的流水线。
