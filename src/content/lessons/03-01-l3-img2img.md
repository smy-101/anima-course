---
title: L3 · 用图生图把草稿修成成品
stage: 3
order: 1
summary: "学完你能接上图生图，用 denoise 控制保留多少原图，并把 Turbo 起稿、Aesthetic 定稿接成一条管线。"
levels: [L3]
days: [5]
promptTrack: true
prerequisites:
  - 01-02-l1-controllable
  - 02-01-l2-sweeps
nodes:
  - LoadImage
  - ResizeImageMaskNode
  - VAEEncode
  - UNETLoader
  - KSampler
  - CreateList
  - ImageGrid
tags:
  - score-9
  - masterpiece
  - best-quality
  - artist-name
  - anime-coloring
  - detailed-background
  - scenery
deliverable: "同一张输入图 denoise 0.2 / 0.5 / 0.8 三档并排；一张“Turbo 起稿、Aesthetic 精修”的成图，保存前缀 Anima/L3。"
acceptance:
  - 同一张输入图在 denoise 0.2 / 0.35 / 0.5 / 0.7 / 1.0 五档各出一张，拼成一张对照图，能说出每档“保留了什么、改了什么”
  - 能解释为什么 30 步 + denoise 0.35 仍然跑满 30 步
  - 用 Turbo 固定 seed 找到满意构图后，换 Aesthetic 同 seed 出了一张成品
  - 用“潜空间精修”方式出了一张成品，denoise 在 0.35 ~ 0.5 之间，五官没有变
  - 两张成品都按“成品模板”改过提示词（没有 score_*、背景写了具体内容）
  - 实验记录本记下今天的“今日基线”：Turbo 试稿参数与 Aesthetic 成品参数各一行
figures:
  - id: l3-denoise-020
    caption: "同一输入图，denoise 0.2：只补细节，五官不变"
    group: denoise
  - id: l3-denoise-035
    caption: "denoise 0.35：Anima“只补细节不改五官”的上限"
    group: denoise
  - id: l3-denoise-050
    caption: "denoise 0.5：结构不变、细节重画"
    group: denoise
  - id: l3-denoise-070
    caption: "denoise 0.7：开始改表情与局部"
    group: denoise
  - id: l3-denoise-100
    caption: "denoise 1.0：等于文生图，只借了尺寸"
    group: denoise
  - id: l3-turbo-draft
    caption: "Turbo 8 步 / CFG 1 的试稿（seed 固定）"
    group: 两段
  - id: l3-aesthetic-final
    caption: "同一 seed 换 Aesthetic 30 步 / CFG 4 的成品（方式 1）"
    group: 两段
  - id: l3-latent-refine
    caption: "Turbo 潜空间经 Aesthetic 以 denoise 0.4 精修（方式 2）：构图与试稿一致"
    group: 两段
transfers: true
sources:
  - badge: 官方
    url: https://huggingface.co/circlestone-labs/Anima
    note: "模型卡：从 Turbo 起步迭代提示词；Aesthetic 出成品；LoRA 在 Base 上训"
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/samplers.py
    note: "KSampler.set_steps：denoise 不减步数"
  - badge: 官方
    url: https://docs.comfy.org/zh/tutorials/basic/image-to-image
    note: 官方图生图教程：输入图尺寸即输出尺寸、先缩到舒适区分辨率
  - badge: 社区
    url: https://note.com/nobinlog/n/n3620e68d1590
    note: "nobin：Anima 二次采样 denoise 0 ~ 0.4 只补细节，超过 0.4 五官会变（非模型作者）"
  - badge: 社区
    url: https://civitai.com/articles/37140
    note: "DXMPie《Anima Made Easy》：Hires denoise 0.45 ~ 0.65 的 WebUI 经验（非模型作者）"
verified: 2026-11-24
---

## 新增节点

前两个阶段都在从零生图。真实的工作节奏分三步。先用 Turbo 的 8 步快速试提示词和构图。选定 seed 以后换 Base 或 Aesthetic，30 步出成品。最后把成品的细节修到位。后两步共用同一个机制：图生图。它比 L1 多三个节点、少一个节点，唯一的旋钮是 `denoise`。

| 节点 `类名` | 作用 | 关键参数 |
|---|---|---|
| 加载图像 `LoadImage` | 读入起点图 | 文件放 `ComfyUI/input/`；右键可在蒙版编辑器里涂遮罩（阶段 4 用） |
| 调整图像/掩码大小 `ResizeImageMaskNode` | 把输入图缩到模型舒适区分辨率 | `resize_type = scale total pixels`，`megapixels 1.0`，`scale_method lanczos` |
| VAE编码 `VAEEncode` | 像素转成潜空间 | `pixels`、`vae` |

端口与参数细节：[LoadImage](/nodes/LoadImage/) · [ResizeImageMaskNode](/nodes/ResizeImageMaskNode/) · [VAEEncode](/nodes/VAEEncode/) · [KSampler](/nodes/KSampler/)

## 基础图生图

在 L1 上只改一处：

```
LoadImage.IMAGE ──▶ ResizeImageMaskNode(1 MP, lanczos).resized ──IMAGE──▶ VAEEncode.pixels
VAELoader.VAE ──▶ VAEEncode.vae
VAEEncode.LATENT ──LATENT──▶ KSampler.latent_image        （EmptyLatentImage 删掉；ResolutionSelector 不再起作用）
KSampler.denoise = 0.4 ~ 0.6
```

**输入图的尺寸就是输出尺寸。** 潜空间是从这张图编码出来的，画布自然跟着它走，所以要先缩到约 1 MP。3000×4000 的图直接编码，出来的不是“大图”，而是一张构图崩坏的图。空Latent图像 和分辨率选择器两条线删掉，分辨率选择器节点本身可以留着不连。

## denoise

图生图只有 denoise 这一个旋钮，它决定保留多少原图。下表是各档的效果，常用区间当起点值用。

| `denoise` | 效果 | Anima 上的观察 |
|---|---|---|
| 1.0 | 等于文生图，只借尺寸 | — |
| 0.7 ~ 0.9 | 换风格、换内容，保留大致构图 | — |
| 0.4 ~ 0.6 | 细化：结构不变、细节重画 | 二次采样常用区间 |
| 0.2 ~ 0.35 | 微调 | 社区经验：Anima 在这个区间“只补细节不改五官”；超过 0.4 就会出现该闭的嘴张开、莫名出汗这类改动（nobin） |

**denoise 不会减少步数。** 源码 `KSampler.set_steps` 先按 `int(steps/denoise)` 生成一份更细的时间表，再取最后 `steps+1` 个 sigma。30 步加 denoise 0.35 仍然跑满 30 步，只是全部落在低噪声区。不必为了“补偿”去加 steps。会真正减步数的是阶段 5 的 K采样器（高级）起止步与分离Sigma降噪。

## 两段出图

试稿和成品分两段出，接法有两种。

### 方式 1 种子迁移

这是作者的建议：从 Turbo 起步，用它快速迭代提示词，成品换 Aesthetic。

```
UNETLoader(anima-turbo-v1.1).MODEL ──▶ KSampler(8 步, cfg 1, seed 固定)
找到满意的 seed 后：UNETLoader 换成 anima-aesthetic-v1.1，KSampler 改 30 步 / cfg 4，seed 不变
```

Turbo 与 Aesthetic 同架构、同文本编码器，**同 seed 的构图往往相近，但不保证相同**。L1 那个 `turbo_mode` 开关在这里有了另一种用法。把 Turbo LoRA 那一路换成 Aesthetic 整模型，或者直接换 UNETLoader 里的文件。

### 方式 2 潜空间精修

这种方式保留 Turbo 那张的构图。

```
UNETLoader(anima-turbo-v1.1).MODEL ─────────────────────────▶ KSampler①.model      (8 步, cfg 1, denoise 1)
KSampler①.LATENT ──LATENT──▶ KSampler②.latent_image
UNETLoader(anima-aesthetic-v1.1).MODEL ──▶ KSampler②.model     (denoise 0.35 ~ 0.5, 30 步, cfg 4)
KSampler②.LATENT ──▶ VAEDecode ──▶ SaveImage("Anima/L3")
```

方式 2 的 denoise 越低，成品越像 Turbo 那张，连它的“默认风格”也一起保留下来。Turbo 的默认风格很强，想彻底摆脱就用方式 1 重新生成。

## 参数与取值

表里都是起点值，出过图、看过结果再改。

| 参数 | 取值 | 说明 |
|---|---|---|
| 输入图分辨率 | 约 1 MP | 用调整图像/掩码大小 按总像素缩，保持比例 |
| `denoise` 扫描 | 0.2 / 0.35 / 0.5 / 0.7 / 1.0 | 用 L2 的创建列表一次跑完，接图像表格 |
| `steps` | Turbo 8 / Aesthetic 30 | denoise 不减步数，30 就写 30 |
| `cfg` | Turbo 1 / Aesthetic 4 | Aesthetic 负向有效，但去掉 `score_*` 项 |
| 方式 2 的 `denoise` | 0.35 ~ 0.5 | 想摆脱 Turbo 味取高，想保留构图取低 |
| 负向（Aesthetic） | `worst quality, low quality, blurry, jpeg artifacts, chromatic aberration` | 不要 `score_1~3`，Aesthetic 训练时去掉了质量标签 |

三版本完整基线见[三版本参数基线](/resources/param-baseline/)。

## 动手步骤

1. 在 L1 上另存为 `L3`。放一张阶段 2 出的满意成图到 `ComfyUI/input/`，添加加载图像 并选中它。
2. 按基础图生图的连法接：删掉空Latent图像，加调整图像/掩码大小（1 MP、lanczos）与 VAE编码。`turbo_mode` 关掉。
3. 扫 denoise 五档：五个浮点数接创建列表，再接 `KSampler.denoise`（拖成输入口），输出接图像表格。保存前缀 `Anima/E005_denoise`。
4. 接方式 1：`turbo_mode` 打开，固定 seed 找构图，8 步一张。满意后关掉，换 Aesthetic 文件，同 seed 出成品。
5. 接方式 2：按上面的连法加第二个 UNETLoader 与 K采样器，denoise 从 0.4 起步。
6. 按“成品模板”改一版提示词再出一次成品，比较差异。

## 调参顺序

denoise 是调参阶梯里的 T3，结构参数，做法是先粗后细。先按 0.5 步长粗扫（0.2 / 0.5 / 0.8 / 1.0），找到想要的档位，再在附近按 0.1 步长细扫。

两段要分别验收。方式 2 先确认 Turbo 那张的构图可用，再调第二段的 denoise。整体看风格是否还带“Turbo 味”。原则不变，低阶没调好不要碰高阶。cfg 和 steps 没定，就去调 denoise 和后面的 shift，结果没法归因。

## 提示词练习

试稿用 Turbo、成品用 Aesthetic，提示词要跟着换。下面是成品模板和试稿的差别，只有几处，但每一处都有原因。

| 项目 | Turbo 试稿 | Aesthetic 成品 | 为什么 |
|---|---|---|---|
| `score_*` | 可用可不用 | 正负向都不要 | Aesthetic 训练时去掉了全部质量标签，score 会把画面推成“AI 味” |
| `masterpiece, best quality` | 可留 | 可留可不留；想固定某画师风格就去掉 | 有质量标签时画师画风会“漂移”（社区）；质量标签还会让扁平风过于锐利 |
| `@画师` | 写 | 写 | 最强的风格杠杆；画师风格没出来先检查 `@` |
| 背景 | 写具体 | 写得更具体，加 `detailed background` / `scenery` | 成品阶段背景一片白是最常见的翻车点 |
| 负向 | 无效（CFG 1） | 官方负向去掉 `score_*` 项 | 负向不要堆，Anima 对负向敏感 |
| `anime coloring` | AI 味重时加 | 按需 | 作者建议的 Turbo 去 AI 味手段 |

```
成品模板 E（Aesthetic，CFG 4、30 步）：
正向前缀：masterpiece, best quality, safe, detailed background,
          …（四段式照常：人数 → 角色 → 作品 → @画师 → 通用标签 → 自然语言）
负向：    worst quality, low quality, blurry, jpeg artifacts, chromatic aberration
```

模板全文见[提示词模板](/resources/prompt-templates/)。练习：把 Turbo 试稿那条提示词改成成品版，同 seed 出两张并排看。把“Aesthetic 版到底好在哪”写进实验记录本。

## 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 图生图后构图面目全非 | denoise 过高，或输入图没缩到约 1 MP |
| 想保留原图颜色但总在变 | denoise ≤ 0.35；或改用阶段 4 的“控制图”方式 |
| 方式 2 的成品一股 Turbo 味 | 正常，denoise 越低越像试稿。提高 denoise，或改用方式 1 |
| 换了 Aesthetic 后构图全变 | 同 seed 不保证同构图。接受差异，或走方式 2 |
| 成品 AI 味很重 | 正负向删掉 `score_*`；去掉质量标签；负向加 `anime coloring, anime screenshot`（想要插画风时） |
