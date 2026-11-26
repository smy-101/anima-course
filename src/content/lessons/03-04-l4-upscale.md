---
title: L4 · 放大三路线
stage: 3
order: 4
summary: "学完你能把约 1 MP 的底图放大到 1536²，说出三条路线的差别，并定下二次采样的 denoise 起点。"
levels: [L4]
days: [8]
promptTrack: false
prerequisites:
  - 03-01-l3-img2img
nodes:
  - LatentUpscaleBy
  - UpscaleModelLoader
  - ImageUpscaleWithModel
  - ResizeImageMaskNode
  - ImageScaleBy
  - VAEDecodeTiled
  - KSampler
  - LoraLoaderModelOnly
  - ImageCompare
tags: []
deliverable: 同一张 1024² 底图，A / B / C 三条路线各一张 1536² 并排；一张二次采样 denoise 0.3 / 0.4 / 0.5 的对照。
acceptance:
  - 三条路线各出了一张 1536²，能说出它们在“细节 / 风格保持 / 耗时”上的差别
  - 固定倍率 1.5，扫过二次采样 denoise 0.3 / 0.4 / 0.5，选定了自己的起点
  - 知道 Anima 单段放大的倍率上限，以及超过上限该怎么办
  - 放大模型选的是动漫向，并能说出写实向模型在 Anima 上的问题
  - 实验记录本记下了“放大基线”：路线、倍率、denoise、放大模型
figures:
  - id: l4-route-a
    caption: "路线 A：只放大不重画，1536²，线条变实但没有新细节"
    group: 三路线
  - id: l4-route-b
    caption: "路线 B：Latent 放大 1.5× 后二次采样 denoise 0.4，1536²"
    group: 三路线
  - id: l4-route-c
    caption: "路线 C：放大模型放大、缩到目标像素、图生图 denoise 0.4，1536²"
    group: 三路线
  - id: l4-denoise-030
    caption: "二次采样 denoise 0.3：几乎不改，只锐化线条"
    group: 二次采样 denoise
  - id: l4-denoise-040
    caption: "denoise 0.4：补细节、不改构图（Anima 起点值）"
    group: 二次采样 denoise
  - id: l4-denoise-050
    caption: "denoise 0.5：明显重绘，五官可能变"
    group: 二次采样 denoise
transfers: true
sources:
  - badge: 官方
    url: https://docs.comfy.org/zh/tutorials/basic/upscale
    note: "官方放大教程：两段式（Latent 放大 + 二次采样）"
  - badge: 官方
    url: https://docs.comfy.org/zh/tutorials/utility/image-upscale
    note: 官方放大总览；Z-Image-Turbo 2K 模板的 denoise 区间参考
  - badge: 社区
    url: https://huggingface.co/circlestone-labs/Anima/discussions/163
    note: "HF 讨论区 #163：非分块放大不超过 1.5×"
  - badge: 社区
    url: https://huggingface.co/circlestone-labs/Anima/discussions/204
    note: "HF 讨论区 #204：1024² 1.5× / 1536² 1.3×；动漫放大模型"
  - badge: 作者
    url: https://civitai.com/models/2540444
    note: "Highres / Aesthetic Boost：1536 甚至 2048 不散架"
  - badge: 社区
    url: https://note.com/hkmclab/n/ne39ca8184d79
    note: "HKMC_AILab：Hires.Fix + Refiner 的推荐做法（非模型作者）"
verified: 2026-11-24
---

## 新增节点

阶段 2 的结论是约 1 MP 最佳。直接出 1536² 以上，重复人像、构图崩坏都会冒出来。想要大图，办法是**先在约 1 MP 定构图，再放大补细节**。这一课把同一张底图放大成三张 1536² 并排看差别：路线 A 最快，B 最常用，C 最稳。

| 节点 `类名` | 作用 | 关键参数 |
|---|---|---|
| 缩放Latent（比例）`LatentUpscaleBy` | 潜空间直接放大 | `upscale_method bislerp / bicubic`，`scale_by 1.5` |
| 加载放大模型 `UpscaleModelLoader` | 读 AI 放大模型 | 文件放 `models/upscale_models/` |
| 使用模型放大图像 `ImageUpscaleWithModel` | 用放大模型放大像素图，会重建边缘 | 内部自动分块 |
| 调整图像/掩码大小 `ResizeImageMaskNode` / 缩放图像（比例）`ImageScaleBy` | 把放大结果缩到目标总像素 | `scale total pixels`，`lanczos` |
| VAE解码（分块）`VAEDecodeTiled` | 大图解码不爆显存 | `tile_size 512`、`overlap 64` |
| K采样器 `KSampler`（第二个） | 二次采样 | `denoise 0.35 ~ 0.45`，`steps 20 ~ 30` |

端口细节：[LatentUpscaleBy](/nodes/LatentUpscaleBy/) · [UpscaleModelLoader](/nodes/UpscaleModelLoader/) · [ImageUpscaleWithModel](/nodes/ImageUpscaleWithModel/) · [ResizeImageMaskNode](/nodes/ResizeImageMaskNode/) · [ImageScaleBy](/nodes/ImageScaleBy/) · [VAEDecodeTiled](/nodes/VAEDecodeTiled/)

## 放大路线

```
// A. 只放大不重画（最快）
KSampler①.LATENT ──▶ VAEDecode① ──▶ ImageUpscaleWithModel(4x 动漫向模型) ──▶ ResizeImageMaskNode(目标像素) ──▶ SaveImage

// B. Latent 放大 + 二次采样（最常用；官方"两段式"）
KSampler①.LATENT ──▶ LatentUpscaleBy(scale_by 1.5, bislerp) ──LATENT──▶ KSampler②.latent_image (denoise 0.4)
KSampler②.LATENT ──▶ VAEDecode ──▶ SaveImage
（KSampler② 的 model 线上可挂 anima-highres-aesthetic-boost；可换成 Aesthetic 模型）

// C. 像素放大 + 图生图（社区称 Hires.Fix：放大模型 + Refiner）
KSampler①.LATENT ──▶ VAEDecode① ──▶ ImageUpscaleWithModel ──▶ ResizeImageMaskNode(目标总像素) ──▶ VAEEncode②
VAEEncode②.LATENT ──▶ KSampler②.latent_image (denoise 0.35 ~ 0.45)
KSampler②.LATENT ──▶ VAEDecode② ──▶ SaveImage
```

| 路线 | 做法 | 细节 | 风格保持 | 耗时 |
|---|---|---|---|---|
| A | 放大模型一次到底 | 边缘更干净，但没有生图模型画出的新细节 | 最好 | 最快 |
| B | 潜空间插值后二次采样 | 细节由生图模型重画；bislerp 偏软 | 好，线条可能略糊 | 中 |
| C | 像素放大后再图生图 | 放大模型先把边缘处理干净，二次采样“顺着画” | 最稳 | 慢（多一次编解码） |

4x 放大模型会把 1024² 直接变成 4096²。要和 B / C 同尺寸比较，A 路线后面用调整图像/掩码大小 缩到 2.36 MP。

C 比 B 多一次编解码，但不直接插值潜空间，更稳定。社区 HKMC_AILab 给 Anima 推荐的做法就是 Hires.Fix + Refiner。走完 C 路线，再在原分辨率做一次 denoise 0.2 ~ 0.3 的 Refiner，最后过脸和手修复（阶段 4）。

## 二次采样的 denoise

**二次采样只补细节、不改构图。**Anima 从 denoise 0.35 ~ 0.4 起步，下表是各档的效果：

| denoise | 效果 |
|---|---|
| 0.15 ~ 0.25 | 几乎不改，只锐化线条（官方 Z-Image-Turbo 放大模板的“贴近原图”区间） |
| 0.35 ~ 0.45 | 补细节、不改构图，Anima 起步值 |
| 0.5 ~ 0.6 | 明显重绘，五官 / 表情可能变 |
| > 0.6 | 构图漂移；Anima 不建议 |

二次采样的 cfg 保持 4、steps 20 ~ 30。Turbo（CFG 1）做二次采样也可以，但默认风格会更强。

## Anima 的倍率上限

**从约 1 MP 起，单段放大不超过 1.5×，更大就分两段。**

| 起点 | 单段放大倍率 | 说明 |
|---|---|---|
| 1024² 左右（约 1 MP） | ≤ 1.5×（1536²，2.36 MP） | 超过容易“烧图” |
| 1536² 或 1024 ~ 1536 之间 | 约 1.3× | 再高出现伪影 |
| 想要 2048² 以上 | 分两段：先 1.5×，第二段直接指定目标尺寸 | 社区实测“单段 hires 上限约 1.5×” |
| 挂 `anima-highres-aesthetic-boost` | 直接出 1536²（甚至 2048²） | 作者说明；效果看提示词 |

常用尺寸都按 16 取整。1024×1024 放大 1.25 倍是 1280×1280（1.64 MP），1.5 倍是 1536×1536（2.36 MP），2 倍是 2048×2048（4.19 MP）。896×1152 放大 1.5 倍是 1344×1728（2.32 MP）。

## 放大模型

写实向的 4x-ESRGAN 会把平涂线条锐化过头，动漫插画优先选专门的模型。社区反馈 `4x_IllustrationJaNai_V1_ESRGAN_135k` 在 Anima 上干净，其它写实放大器在浅色区域出噪点。放大前不要试图用放大修手崩、多指，先用阶段 4 的重绘修掉再放大。

## 动手步骤

1. 选一张阶段 3 的 1024² 成图，记下它的 seed 与提示词。在 `Anima T2T` 子图后面接保存图像，先出底图。
2. 路线 A：VAEDecode① 接 ImageUpscaleWithModel（动漫向 4x），再接 ResizeImageMaskNode（2.36 MP，lanczos），最后接保存图像，前缀 `Anima/L4_A`。
3. 路线 B：KSampler① 的 LATENT 接 LatentUpscaleBy（1.5，bislerp），再接 KSampler②（denoise 0.4、30 步、cfg 4）。VAEDecode 后接保存图像，前缀 `Anima/L4_B`。KSampler② 共用 KSampler① 的 model、clip 和正负条件。
4. 路线 C：按上面的连线接，ResizeImageMaskNode 设 2.36 MP。
5. 三张用图像对比或图像表格并排，写进实验记录本，细节、风格保持、耗时各一行。
6. 固定倍率 1.5，在路线 B 上扫二次采样 denoise 0.3 / 0.4 / 0.5：三个值接创建列表，再接 `KSampler②.denoise`。

## 调参顺序

先固定倍率 1.5，扫 denoise 0.3 / 0.4 / 0.5。满意后比较 B 与 C，需要更大图再做两段（下一课）。倍率与 denoise 可以做二维网格：一维是创建列表接 `LatentUpscaleBy.scale_by`，另一维是创建列表接 `KSampler②.denoise`。图像表格的列数等于 denoise 的个数。

每一段单独验收再串联。第一段看“构图可用”，第二段看“没有过饱和、波点、构图漂移”。

## 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 放大后整张泛油、过饱和 | denoise 或 cfg 过高；二次采样 cfg 保持 4，denoise 降到 0.35 |
| 出现波点 / 网格状伪影 | 社区报告与 `res_multistep + beta` 及倍率过大有关；换 `euler/simple`，倍率先 1.25× |
| VAE 解码爆显存 | 换 VAE解码（分块） |
| 放大后线条变糊 | 路线 B 的 bislerp 插值太软，改用路线 C（放大模型） |
| 放大后多了一个人 / 构图变了 | 倍率超上限，或 denoise > 0.6；先 1.25×、denoise 0.35 |
