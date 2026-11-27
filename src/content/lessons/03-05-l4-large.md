---
title: L4 · 把图做到 2048²
stage: 3
order: 5
summary: "学完你能用两段放大或分块放大把图做到 2048²，并补上锐化、裁切这些放大后的收尾步骤。"
levels: [L4]
days: [9]
promptTrack: false
prerequisites:
  - 03-04-l4-upscale
nodes:
  - LatentUpscaleBy
  - LatentUpscale
  - LoraLoaderModelOnly
  - UltimateSDUpscale
  - UpscaleModelLoader
  - ImageSharpen
  - ImageCropV2
  - VAEDecodeTiled
  - SaveImage
tags: []
deliverable: "一张 2048²（两段放大），一张分块放大的 2048² 对照；两者并排能说出差别。"
acceptance:
  - 两段放大：第一段 1.5×、第二段直接指定 2048²，每段单独验收后再串联
  - 挂 anima-highres-aesthetic-boost 出了一张 1536² 或更大的图，并与不挂时对比过
  - 用 UltimateSDUpscale 出了一张 2048²，接缝不明显；知道 tile_padding 和 denoise 各管什么
  - 做过轻度锐化（alpha 0.3 ~ 0.5）并与未锐化并排看过
  - 知道脸 / 手问题要在放大之前解决，并能说出原因
figures:
  - id: l4-two-stage
    src: ../../assets/figures/l4-two-stage.webp
    caption: "两段放大：1024² 先到 1536²（1.5×，denoise 0.4），再到 2048²（指定尺寸，denoise 0.3，挂 anima-highres-aesthetic-boost）"
    group: 2048²
  - id: l4-tiled
    caption: "分块放大：UltimateSDUpscale 2×、tile 1024、denoise 0.35 的 2048²"
    group: 2048²
  - id: l4-highres-lora
    src: ../../assets/figures/l4-highres-lora.webp
    caption: "同 seed 1536²：不挂 / 挂 anima-highres-aesthetic-boost"
    group: highres LoRA
  - id: l4-sharpen
    src: ../../assets/figures/l4-sharpen.webp
    caption: "放大后：未锐化 / ImageSharpen alpha 0.4 并排（局部放大）"
    group: 放大后处理
transfers: true
sources:
  - badge: 社区
    url: https://huggingface.co/circlestone-labs/Anima/discussions/165
    note: "HF 讨论区 #165：单段 hires 上限约 1.5×，更大分两段"
  - badge: 作者
    url: https://civitai.com/models/2540444
    note: "Highres / Aesthetic Boost：1536 甚至 2048 不散架"
  - badge: 社区
    url: https://github.com/ssitu/ComfyUI_UltimateSDUpscale
    note: "UltimateSDUpscale：参数区间来自节点说明"
  - badge: 官方
    url: https://blog.comfy.org/p/upscaling-in-comfyui
    note: Comfy 官方博客《AI 放大完全手册》
  - badge: 社区
    url: https://note.com/hkmclab/n/ne39ca8184d79
    note: "HKMC_AILab：Hires.Fix + Refiner（非模型作者）"
verified: 2026-11-24
---

## 两段放大

上一课的三条路线都受“单段 ≤ 1.5×”的限制，1024² 最多到 1536²。想要 2048² 甚至 4K，有两条正路。两段放大是把 B 路线做两遍；分块放大是把每块放在舒适区分辨率内重绘，再拼回。

```
KSampler①.LATENT ──▶ LatentUpscaleBy(1.5, bislerp) ──▶ KSampler②(denoise 0.4, 30 步) ──▶ LatentUpscale(2048×2048, bislerp) ──▶ KSampler③(denoise 0.3, 20 ~ 30 步) ──▶ VAEDecode ──▶ SaveImage
（KSampler③ 的 model 线上挂 anima-highres-aesthetic-boost，或换成 Aesthetic 整模型）
```

每一段单独验收，再串联：

| 段 | 验收 | 串联后的整体检查 |
|---|---|---|
| 第一段 1.5× | 构图不变、细节增加、没有过饱和 | — |
| 第二段指定目标尺寸 | 总像素超出舒适区，denoise 降到 0.3；没有波点、构图漂移 | 两段的风格是否一致 |

第二段用 缩放Latent（填目标宽高）而不是 缩放Latent（比例）：2048² ÷ 1536² ≈ 1.33×，算倍率不如直接给尺寸。宽高仍要是 16 的倍数。

`anima-highres-aesthetic-boost` 挂在第二段的模型线上。作者说明里它让 1536 甚至 2048（4 MP）“不散架”，强度 1.0；美学提升“较弱、看提示词”。同 seed 对比一次再决定留不留。

## 分块放大

标准做法是先放大，再分块低 denoise 重绘，最后拼回。**每块都在模型的舒适分辨率内重绘，整图就不会“烧”。**代价是块与块之间有接缝。社区标准节点 `UltimateSDUpscale`（Manager 搜 `comfyui_ultimatesdupscale`）把放大、切块、每块 img2img、拼回、接缝修复打包成一个节点：

```
KSampler①.LATENT ──▶ VAEDecode① ──▶ UltimateSDUpscale.image
LoRA 链末端.MODEL ─────────────────▶ UltimateSDUpscale.model
CLIPTextEncode(正向 / 负向) ────────▶ UltimateSDUpscale.positive / negative
VAELoader.VAE ─────────────────────▶ UltimateSDUpscale.vae
UpscaleModelLoader(动漫向 4x) ─────▶ UltimateSDUpscale.upscale_model
UltimateSDUpscale：upscale_by 2、tile_width/height 1024、tile_padding 32~64、denoise 0.3~0.5、
                    mode_type Chess、steps 20~30、cfg 4、euler/simple
UltimateSDUpscale.IMAGE ──▶ SaveImage
```

| 参数 | 起始值 | 说明 |
|---|---|---|
| `upscale_by` | 2 | 目标倍率（1024² 放大到 2048²） |
| `tile_width / tile_height` | 1024 | 每块尺寸，取模型舒适区（Anima 约 1 MP） |
| `tile_padding` | 32 ~ 64 | 块与块的重叠，接缝明显就加 |
| `denoise` | 0.3 ~ 0.5 | 每块重绘强度；过高会改细节 |
| `mode_type` | Chess | 棋盘错位让相邻块不同时处理，接缝更隐蔽 |
| `steps / cfg / sampler / scheduler` | 20 ~ 30 / 4 / `euler` / `simple` | 每块采样参数，同二次采样 |

分块放大的调参顺序：先出 1024² 底图，验收 2048² 的结果。接缝明显就加 `tile_padding` 或开 `seam_fix`，最后把 denoise 0.3 / 0.4 / 0.5 扫一遍。用核心节点也能手工搭。顺序是图像裁剪、逐块 VAE编码、K采样器低 denoise、VAE解码、合成图像（遮罩）。但接缝处理繁琐，不如用现成节点。

## 放大后处理

1. 轻度锐化：锐化图像 `ImageSharpen`，`sharpen_radius` 1 ~ 2、`alpha` 0.3 ~ 0.5 起步。平涂画风极易过头，与未锐化并排看局部再定。
2. 最终构图裁切：图像裁剪 `ImageCropV2`，放大后的图按需要裁成成品比例。
3. 交付格式：保存图像只输出 PNG（无损但大）；交付 / 分享用的 JPEG / WebP 在 ComfyUI 外批量转换最省事。
4. **脸和手的问题要在放大之前解决（阶段 4 的路线 E）。**放大后再修，会把接缝和风格差一并放大。

阶段 3 到这里结束。你手里有了完整的出图流程：Turbo 试稿、Aesthetic 成品、LoRA、放大到 2048²。

## 动手步骤

1. 在上一课的路线 B 后面再加一级。缩放Latent（2048×2048）接 K采样器③（denoise 0.3、20 步、cfg 4），再接 VAE解码。模型线上挂 `anima-highres-aesthetic-boost`。先只验收第二段。
2. 同 seed 出一张不挂 highres LoRA 的，比较。
3. 装 `ComfyUI_UltimateSDUpscale`，按上图接到 KSampler① 之后，`upscale_by 2`、tile 1024、padding 32、denoise 0.35、Chess。
4. 两张 2048² 并排（图像对比），各裁一块局部（如脸部）放大看细节与接缝。
5. 接锐化图像（alpha 0.4）与不接各出一张，局部并排。
6. 2048² 解码爆显存就把 VAE解码 换成 VAE解码（分块）。

## 调参顺序

多阶段流程是调参阶梯里的 T5。每个场景都先看每段的验收，再看串联后的整体：

| 场景 | 每段验收 | 串联后的整体检查 |
|---|---|---|
| 两段放大 | 第一段 1.5×；第二段直接给目标尺寸 | 总像素是否超出舒适区（第二段 denoise 降到 0.3） |
| 分块放大 | 单块看是否烧；整图看接缝 | 接缝是否被锐化“强调” |
| 重绘后放大（阶段 4） | 重绘区域无接缝 | 放大后接缝是否被放大模型强调 |

原则不变：**每段单独验收，再串起来。**串联后出问题，逐级 `Ctrl+B` 定位是哪一段。

## 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 第二段放大后构图漂移 | denoise 过高（> 0.35）或目标尺寸超出太多；先 1.25× |
| 分块放大有接缝 | `tile_padding` 加到 64；开 `seam_fix`；`mode_type` 用 Chess |
| 分块放大每块风格不一致 | 提示词相同但每块独立采样；降低 denoise、换 Chess、加 padding |
| 放大后手 / 脸的问题更明显 | 正常，先修再放大（阶段 4） |
| 锐化后线条发毛 | `alpha` 过高，降到 0.3；或 `sharpen_radius` 降到 1 |
