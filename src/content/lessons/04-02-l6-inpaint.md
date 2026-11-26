---
title: L6 · 重画一块，其余不动
stage: 4
order: 2
summary: "学完你能只重画画面里的一块：用保色的路线换表情，用官方模板加一个原图里没有的物件。"
levels: [L6]
days: [11]
promptTrack: true
prerequisites:
  - 04-01-l5-lllite
nodes:
  - LoadImage
  - Painter
  - MaskPreview
  - GrowMask
  - FeatherMask
  - VAEEncodeForInpaint
  - SetLatentNoiseMask
  - VAEEncode
  - ResizeImageMaskNode
  - ModelPatchLoader
  - AnimaLLLiteApply
  - GetImageSize
tags:
  - closed-eyes
deliverable: 用路线 B 给一张成图换一个表情、用路线 A 添加一个物件，各一张（前后并排）。
acceptance:
  - 在蒙版编辑器里涂过遮罩，并用 MaskPreview 确认了范围；遮罩比目标区域大一圈
  - 能说出路线 A 与路线 B 的原理差别，以及为什么 A 会改没涂的地方的颜色、B 不会
  - 路线 B 换了表情：重绘区没有接缝，没涂的地方像素没变
  - 路线 A 添加了一个原图里没有的物件；两张前后并排，记进实验记录本
  - 重绘的提示词只写了遮罩里的内容，没有写整张图
figures:
  - id: l6-b-before
    caption: "路线 B 换表情：原图与涂好的遮罩（MaskPreview）"
    group: 换表情
  - id: l6-b-after
    caption: "路线 B 换表情：重绘后，未遮罩区域保持不变"
    group: 换表情
  - id: l6-a-before
    caption: "路线 A 加物件：原图与 Painter 涂出的重绘区域"
    group: 加物件
  - id: l6-a-after
    caption: "路线 A 加物件：成图（整图重新生成，未涂区域被控制图约束）"
    group: 加物件
transfers: true
sources:
  - badge: 官方
    url: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_lllite_image_inpainting.json
    note: "官方 Inpainting 模板：Painter → 子图 image / mask；Turbo 默认开；示例提示词只有 girl with red eyes"
  - badge: 官方
    url: https://huggingface.co/kohya-ss/Anima-LLLite
    note: "kohya：建议 img2img 时配合 mask 使用，否则颜色会略有偏移"
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/ldm/anima/lllite.py
    note: "inpainting 权重为 4 通道：mask 最近邻缩放并在 0.5 处二值化；遮罩内原图涂黑"
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py
    note: "VAEEncodeForInpaint.grow_mask_by 默认 6"
  - badge: 官方
    url: https://docs.comfy.org/zh/interface/maskeditor
    note: 蒙版编辑器：画笔 / 橡皮 / 油漆桶 / 按颜色选择 / 反转
verified: 2026-11-24
---

## 新增节点

脸崩、手崩、想换个表情、想加一把伞，都只需要重画一小块，其余不动。Anima 有两条路线。路线 A 是官方 Inpainting 模板，从纯噪声重新生成整张图，没涂的区域靠控制图“照抄”。路线 B 是 kohya 推荐的做法，在原图的潜空间上重绘，没涂的区域原样保留。这一课两条路线各做一次，顺带学会重绘专用的提示词写法：只写遮罩里要出现的东西。

| 节点 `类名` | 作用 | 关键参数 |
|---|---|---|
| 画板 `Painter` | 在节点里直接涂抹，输出 IMAGE + MASK（MASK = 涂过的区域） | `image` 可选（叠在原图上画） |
| 蒙版编辑器（`LoadImage` 上右键，选“在蒙版编辑器中打开”） | 在原图上精涂，遮罩从 `LoadImage.MASK` 输出 | 画笔 / 橡皮 / 油漆桶 / 按颜色选择 / 反转 |
| 扩展遮罩 `GrowMask` | 遮罩向外扩几像素 | `expand 4 ~ 16` |
| 羽化遮罩 `FeatherMask` | 四边羽化 | `left/top/right/bottom`（只对路线 B / C 有意义） |
| VAE编码（局部重绘）`VAEEncodeForInpaint` | 编码时带上“遮罩外不变”的信息 | `grow_mask_by 6` |
| 设置Latent噪波遮罩 `SetLatentNoiseMask` | 给普通 VAE编码 的结果加噪波遮罩 | — |
| 预览遮罩 `MaskPreview` | 看遮罩 | — |

端口细节：[Painter](/nodes/Painter/) · [GrowMask](/nodes/GrowMask/) · [FeatherMask](/nodes/FeatherMask/) · [VAEEncodeForInpaint](/nodes/VAEEncodeForInpaint/) · [SetLatentNoiseMask](/nodes/SetLatentNoiseMask/) · [MaskPreview](/nodes/MaskPreview/)

## 路线 A 官方模板

```
LoadImage.IMAGE ──▶ ResizeImageMaskNode(≤ 1 MP).resized ──IMAGE──▶ Painter.image
Painter.IMAGE ──IMAGE──▶ AnimaLLLiteApply.image（走上一课的连线）
Painter.MASK  ──MASK───▶ MaskPreview ──▶ AnimaLLLiteApply.mask
ModelPatchLoader(anima-lllite-inpainting-v2).MODEL_PATCH ──▶ AnimaLLLiteApply.model_patch
EmptyLatentImage 尺寸 = 原图尺寸；Turbo 开；denoise 1
提示词只写"遮罩里要出现的东西"（官方模板示例：girl with red eyes）
```

inpainting 权重是 4 通道的。被涂的区域在控制图里被涂黑，模型靠 mask 知道哪里要重画、其它地方照抄。画布从纯噪声开始，**整张图都是重新生成的**，只是没遮罩的区域被控制图强烈约束。所以没涂的地方，颜色也会略有变化。

官方模板把 EmptyLatentImage 留在默认的 1024×1024，便签上提醒输入图过大（超过 1024×1024）时先缩一下。更稳的做法是用 GetImageSize 把画布尺寸对齐到缩放后的原图。

## 路线 B 保色重绘

```
// 遮罩：从 LoadImage 的蒙版编辑器涂（LoadImage.MASK 输出），向外扩一圈并预览
LoadImage.MASK ──▶ GrowMask(expand 8).MASK ──┬──MASK──▶ MaskPreview
                                          ├──MASK──▶ VAEEncodeForInpaint.mask
                                          └──MASK──▶ AnimaLLLiteApply.mask
// 原图：缩到约 1 MP 后同时走两路
LoadImage.IMAGE ──▶ ResizeImageMaskNode(1 MP).resized ──┬──IMAGE──▶ VAEEncodeForInpaint.pixels
                                                        └──IMAGE──▶ AnimaLLLiteApply.image
VAELoader.VAE ──▶ VAEEncodeForInpaint.vae
VAEEncodeForInpaint.LATENT ──LATENT──▶ KSampler.latent_image (denoise 1)
// LLLite 侧与路线 A 相同：ModelPatchLoader(inpainting-v2) ──▶ AnimaLLLiteApply.model_patch；AnimaLLLiteApply.MODEL ──▶ KSampler.model
```

注意 `AnimaLLLiteApply` 接的是 GrowMask 之后的 mask。LLLite 会在 0.5 处二值化，VAEEncodeForInpaint 的噪波遮罩则可以是软边。

kohya 的说明是，img2img 时建议配合 mask 使用，否则颜色会略有偏移。这条路线的画布是原图的潜空间，**没涂的区域原样保留，色偏最小**。代价是构图自由度低一点。日常首选这条路线。

## 路线 C 通用重绘

```
LoadImage.IMAGE ──▶ VAEEncodeForInpaint(pixels, vae, mask, grow_mask_by 6) ──▶ KSampler(denoise 1)
或：LoadImage.IMAGE ──▶ VAEEncode ──▶ SetLatentNoiseMask(mask) ──▶ KSampler(denoise 0.85 ~ 1)
```

这条路线效果弱于 A 和 B，在没有 LLLite 权重或想快速试一试时用。

## 提示词练习

重绘的提示词只写遮罩里要出现的东西，和写整图不一样。下面是四个常见场景的写法。

| 场景 | 写什么 | 不要写 |
|---|---|---|
| 换表情 | `smile, open mouth, looking at viewer` | 整张图的描述、人数、背景 |
| 加物件 | `a red paper umbrella` | “a girl holding an umbrella”。人物本来就在，写了会多画一个人 |
| 修手 | `detailed hands, own hands together` | `bad hands` 放负向不如正向写清楚 |
| 修脸 | `detailed face, looking at viewer` | 看不见的东西（面罩后面的眼睛） |

**写得越具体越好，不写“看不见的东西”**。这条规则来自提示词基础一课，在重绘里同样成立：写了它就会画出来。路线 A 的官方模板默认 Turbo，负向无效，想要什么全写进正向。

## 参数与取值

表里都是起点值。

| 参数 | 起始 | 说明 |
|---|---|---|
| `GrowMask.expand` | 8 | LLLite 路线 mask 会二值化，软边等于没有，所以 mask 要比目标区域大一圈；接缝有残影就加到 16 |
| `VAEEncodeForInpaint.grow_mask_by` | 6 | 路线 B / C 用 |
| `FeatherMask` | 8 ~ 16 | 只对路线 B / C 的噪波遮罩有意义（渐变过渡）；路线 A 不吃羽化 |
| `denoise` | 1（A / B）；0.85 ~ 1（C） | 重绘区域要完全重画 |
| 模型 | 路线 A 官方默认 Turbo（8 步 / CFG 1） | 出成品时换 Aesthetic、30 步 / CFG 4 |
| seed | 随机多跑几次 | 区域小的时候种子差异很大 |

## 动手步骤

1. 选一张阶段 3 的成图，放 `ComfyUI/input/`。在 L5 的工作流上另存为 `L6`，ModelPatchLoader 换成 `anima-lllite-inpainting-v2`（62.7 MB）。
2. 路线 B 换表情。LoadImage 上右键，在蒙版编辑器里用画笔涂脸部，比脸大一圈，保存。MASK 接扩展遮罩（8），再分三路，接预览遮罩、VAEEncodeForInpaint.mask 和 AnimaLLLiteApply.mask。IMAGE 接调整图像/掩码大小（1 MP），再分两路，接 VAEEncodeForInpaint.pixels 和 AnimaLLLiteApply.image。删掉空Latent图像，K采样器 的 latent_image 接 VAEEncodeForInpaint。提示词只写新表情，跑。
3. 前后两张用图像对比 并排，把滑块拖到没涂的地方，确认像素没变。
4. 路线 A 加物件。LoadImage 接调整图像/掩码大小，再接画板，在要加物件的位置涂一块，略大于物件。画板 的 IMAGE 接 AnimaLLLiteApply.image；MASK 接预览遮罩，再接 AnimaLLLiteApply.mask。空Latent图像 接回来，用获取图像尺寸 对齐尺寸。Turbo 开，提示词写物件，多跑几个 seeds。
5. 边缘有残影，就把 GrowMask 从 8 加到 16，grow_mask_by 从 6 加到 12。

## 调参顺序

先用 `MaskPreview` 确认遮罩范围，再跑路线 B，它保色，也最常用。需要大改时用路线 A，小区域（手、脸）用下一课的裁剪法。边缘有残影就加 `GrowMask`。

## 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 重绘区与周围有接缝、有原图残影 | 遮罩太小：`GrowMask` 从 8 加到 16；路线 B 的 `grow_mask_by` 从 6 加到 12 |
| 没涂的地方颜色也变了 | 用的是路线 A / C；换路线 B |
| 重绘区和周围风格不一致 | 提示词写了与整图冲突的内容；或 Turbo 默认风格太强，换 Aesthetic |
| `Painter` 涂的 mask 全黑 | 涂抹后要保存；`MaskPreview` 接在 `Painter.MASK` 上确认 |
| 输入图 2000×3000 直接重绘全崩 | 先 `ResizeImageMaskNode` 缩到约 1 MP，修完再放大回去（L4） |
