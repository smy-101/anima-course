---
title: L2 · 批量出对照图，把参数扫一遍
stage: 2
order: 1
summary: "学完你能让工作流一次运行出一整组对照图，并用它扫完 cfg、steps 和采样器，定下自己的参数基线。"
levels: [L2]
days: [3, 4]
promptTrack: false
prerequisites:
  - 01-02-l1-controllable
nodes:
  - CreateList
  - PrimitiveNode
  - ImageGrid
  - TextOverlay
  - ImageCompare
  - PreviewImage
tags: []
deliverable: "一张“CFG × 种子”网格图、一张“采样器 × 调度器”对照图，以及写进实验记录本的“自己的参数基线”。"
acceptance:
  - 用列表法一次跑出了 5 个 cfg 值的对照网格，顺序 = 列表顺序
  - 用 batch_size 做出了“行 = cfg、列 = 种子”的二维网格
  - 扫过 steps（20 / 30 / 40 / 50）并说出边际收益在哪
  - 扫过 6 个采样器，选出自己的默认采样器与调度器
  - 做过带标签的三分支对照（≤ 6 个变体时最稳妥）
  - 实验记录本里写下了“今日基线”：模型 / 采样器 / cfg / steps
  - 能指着自己出的网格图，说出这张图上最好的 cfg 与采样器
figures:
  - id: l2-cfg-seeds
    caption: "CFG 3 / 3.5 / 4 / 4.5 / 5（行）× 4 个种子（列）的网格图"
    group: 网格
  - id: l2-cfg-sweep
    caption: "CFG 3 / 3.5 / 4 / 4.5 / 5 / 6 单行扫描，seed 固定"
    group: 一维扫描
  - id: l2-steps-sweep
    caption: "steps 10 / 20 / 30 / 40 / 50"
    group: 一维扫描
  - id: l2-samplers
    caption: "euler / er_sde / euler_a / dpmpp_2m_sde_gpu / res_multistep / uni_pc 对照"
    group: 采样器
  - id: l2-labeled
    caption: "带 TextOverlay 标签的三分支对照"
    group: 带标签对照
transfers: true
sources:
  - badge: 官方
    url: https://github.com/circlestone-labs/Anima
    note: anima_comparison.json 用 PrimitiveNode(COMBO) 驱动 sampler_name
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_dataset.py
    note: ImageGrid 为实验性节点，分类 image/batch，可直接接 batch 张量
  - badge: 社区
    url: https://huggingface.co/circlestone-labs/Anima/discussions/165
    note: CFG++ 采样器需 CFG < 2；res_multistep + beta 有波点报告
verified: 2026-11-24
---

## 新增节点

上一课你学会把控件拖成输入口，这一课用它来做实验。这一级在 L1 上加 4～8 个节点。

| 节点 `类名` | 作用 | 关键参数 |
|---|---|---|
| 创建列表 `CreateList` | 把 N 个同类型值合成列表；下游会对每一项各跑一次 | 把要扫的值逐个接入 |
| 浮点数 / 整数 / 字符串（多行） `PrimitiveFloat` / `PrimitiveInt` / `PrimitiveStringMultiline` | 列表的来源 | — |
| 通用 Primitive `PrimitiveNode` | 值类型可选 `COMBO`，用来驱动 `sampler_name` 这类下拉控件（官方 `anima_comparison.json` 就这么做） | `er_sde` |
| 图像表格 `ImageGrid`（界面名 “Make Image Grid”，实验性） | 把一批图排成网格；直接接 batch 张量即可，会自动拆成单元格 | `columns`、`cell_width/height 256`、`padding 4` |
| 绘制文本叠加 `TextOverlay` | 在图上写字，给对照图标参数值 | `text`、`font_size`、`position`、`align`、`outline` |
| 图像对比 `ImageCompare` | 滑块对比两张 | `image_a`、`image_b` |
| 预览图像 `PreviewImage` | 只显示不落盘 | — |

端口细节：[CreateList](/nodes/CreateList/) · [PrimitiveNode](/nodes/PrimitiveNode/) · [ImageGrid](/nodes/ImageGrid/) · [TextOverlay](/nodes/TextOverlay/) · [ImageCompare](/nodes/ImageCompare/) · [PreviewImage](/nodes/PreviewImage/)

## 一维扫描

先拿 cfg 试，一次运行就出 CFG 3 / 3.5 / 4 / 4.5 / 5 五张对照图。五个浮点数节点各填一个值，全部接进创建列表，再接到 K采样器的 cfg 上：

```
PrimitiveFloat(3.0)  ─┐
PrimitiveFloat(3.5)  ─┤
PrimitiveFloat(4.0)  ─┼─▶ CreateList ──FLOAT[]──▶ KSampler.cfg（把控件拖成输入口）
PrimitiveFloat(4.5)  ─┤
PrimitiveFloat(5.0)  ─┘
KSampler(seed 固定).LATENT ──▶ VAEDecode ──IMAGE──▶ ImageGrid(columns=5) ──▶ SaveImage("Anima/L2_cfg")
```

运行一次得到一张 5 格的拼图，**格子的顺序就是列表的顺序**。同样的办法还用在别处。列表可以接 `KSampler.steps`（20 / 30 / 40），也可以接 `CLIPTextEncode.text`，一次跑多条提示词。`PrimitiveNode` 的值类型选 `COMBO`，可以接 `KSampler.sampler_name` 或 `KSampler.scheduler`。

## 二维网格

一维扫描一次只动一个维度。想知道换几个种子还稳不稳，就把 `batch_size` 当第二个维度：

```
EmptyLatentImage.batch_size = 4        ← 同一 seed 下 batch 内每张噪声不同，相当于 4 个种子
CreateList(5 个 cfg) ──▶ KSampler.cfg
KSampler.LATENT ──▶ VAEDecode ──▶ ImageGrid(columns=4)   ← 列数 = batch 数
```

同一个 seed 下，batch 里的每张噪声都不一样，相当于 4 个种子。每个 cfg 值各跑一次，每次得到 4 张，图像表格一共收到 5 组 × 4 张。它按 cfg 优先的顺序铺开，**行是 cfg，列是种子**。在这一张图上找对多数种子都好的 cfg。

## 带标签的对照

列表法里，绘制文本叠加 写的文字对每个分支都一样，每一格标不出自己的参数值。变体不超过 6 个时，最稳妥的办法是直接复制 K采样器分支。每个分支各接一个绘制文本叠加：

```
KSampler(cfg=3.0) ──▶ VAEDecode ──▶ TextOverlay("cfg 3.0") ─┐
KSampler(cfg=3.5) ──▶ VAEDecode ──▶ TextOverlay("cfg 3.5") ─┼─▶ ImageGrid(columns=3) ──▶ SaveImage
KSampler(cfg=4.0) ──▶ VAEDecode ──▶ TextOverlay("cfg 4.0") ─┘
```

三个 K采样器共用同一个 MODEL、CLIP、CONDITIONING 和 LATENT，只有 cfg 不同。这就是“一次只改一个变量”最直观的样子。

## 扫描起点值

下表是起点值，出过图、看过结果再改。

| 扫描对象 | 起点值 | 看什么 |
|---|---|---|
| cfg | 3 / 3.5 / 4 / 4.5 / 5 / 6 | 过饱和、线条发硬就是烧了，往下降；特征缺失就小幅往上升 |
| steps | 10 / 20 / 30 / 40 / 50 | 30 步之后还有没有边际收益；Turbo 看 6 / 8 / 10 / 12 |
| sampler | `euler` / `er_sde` / `euler_a` / `dpmpp_2m_sde_gpu` / `res_multistep` / `uni_pc` | 线条、平涂程度、细节，风格差异明显 |
| scheduler | `simple` / `sgm_uniform` / `beta` / `karras` / `ddim_uniform` | 影响小于采样器；`res_multistep + beta` 有人报告出现波点伪影 |
| batch_size | 2 ~ 4 | 越大越吃显存 |

## 调参顺序

顺序比取值重要。调参阶梯里，这一课用到前两级：T1 是单变量，T2 是双变量。

先做 T1，固定其它一切，按下面的次序一个一个扫。表里的扫描值同样是起点值。

| 顺序 | 参数 | 扫描值 | 判断标准 |
|---|---|---|---|
| 1 | seed | 随机 4 ~ 8 个 | 构图是否可用。构图不行就换 seed，别调参数 |
| 2 | 分辨率 / 比例 | 0.5 / 1.0 / 1.5 MP；1:1、3:4、2:3 | 是否出现重复人像、崩坏。约 1 MP 最佳，尺寸取 16 的倍数 |
| 3 | cfg | 3 / 3.5 / 4 / 4.5 / 5 / 6 | 甜点在 3 ~ 5；`euler_a` 可略高；Turbo 固定 1 |
| 4 | steps | 20 / 30 / 40 / 50 | 再加步数画面基本不变，就够 |
| 5 | sampler | 见上表 | 采样器改变画风 |
| 6 | scheduler | 见上表 | 影响细微 |

T1 的每一项都定下来以后，再做 T2，两个维度一起扫：

| 网格 | 外维（列表） | 内维（batch 或第二列表） | 读法 |
|---|---|---|---|
| cfg × 种子 | cfg 列表 | `batch_size 4` | 找对多数种子都好的 cfg |
| steps × cfg | steps 列表 | cfg 列表 | `ImageGrid.columns` 设成 cfg 的个数 |
| 采样器 × 调度器 | 采样器 COMBO 列表 | 调度器 COMBO 列表 | 固定 seed、固定 cfg 4 和 30 步 |

**低阶没调好，不要碰高阶。** cfg 和 steps 没定，就去调 shift 和分段采样，结果没法归因。

## 动手步骤

1. 在 L1 上另存为 `L2`，把 `turbo_mode` 关掉。参数对比用 Full 模式做。
2. 按一维扫描的连法做一次 cfg 扫描，`ImageGrid.columns` 设成值的个数。保存前缀带上实验 ID，比如 `Anima/E001`。
3. 按二维网格的连法做 cfg × 种子网格。找出对多数种子都好的 cfg，记进[实验记录本](/tools/lab-log/)。
4. 同法扫 steps，再按 T2 的做法做采样器 × 调度器网格。
5. 做一张带标签的三分支对照，给记录本当配图。
6. 写“今日基线”。

## 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 列表接上去后只跑了一张 | 确认连到 `CreateList` 的输出，而不是某个 Primitive 的输出；`ImageGrid` 要接 `VAEDecode` 的 IMAGE |
| 找不到 `ImageGrid` | 实验性节点，在节点库 `image/batch` 下，搜 “grid” 或类名；旧版本可能没有 |
| 网格太小看不清 | `cell_width/height` 调到 512，或减少列数 |
| 带 `_cfg_pp` 后缀的采样器出图“炸” | CFG++ 采样器要在 CFG < 2 下用（推荐 1.5），4.5 必烧 |
