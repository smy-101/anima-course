---
title: "L5 · 结构控制：Anima LLLite（Canny 线稿与深度图）"
stage: 4
order: 1
summary: 用一张"控制图"约束构图。Anima 不走 ControlNet 节点，而是给模型打补丁：ModelPatchLoader → AnimaLLLiteApply 串在模型线上。同一张原图分别用 Canny 与深度控制，各出一张对比。
levels: [L5]
days: [10]
promptTrack: false
prerequisites:
  - 03-05-l4-large
nodes:
  - ModelPatchLoader
  - AnimaLLLiteApply
  - GetImageSize
  - Canny
  - ImageInvert
  - LoadDA3Model
  - DA3Inference
  - DA3Render
  - ResizeImageMaskNode
  - LoadImage
  - PreviewImage
  - ImageCompare
  - EmptyLatentImage
tags:
  - lineart
deliverable: 两张"控制图 ↔ 成图"并排对比：Canny（any-test-like-v2）一张、深度（depth-1）一张。
acceptance:
  - LLLite 权重放在 models/model_patches/，ModelPatchLoader 没有变红
  - 能说出 Anima 的结构控制为什么接在 MODEL 线上而不是条件线上
  - 用 PreviewImage 确认过控制图本身是对的（线稿白底黑线、深度图近白远黑）
  - 画布尺寸用 GetImageSize 对齐了控制图，成图的边没有被裁
  - 做过 strength 0.8 / 1.0 / 1.2 的对照，选定自己的起点
  - Canny 与深度两张对比图都拼好了，能说出哪种控制更贴、哪种更自由
figures:
  - id: l5-canny-control
    caption: "Canny(0.17, 0.45) → 反转 后的控制图（白底黑线）"
    group: Canny
  - id: l5-canny-result
    caption: "同一提示词、any-test-like-v2 的成图，与控制图并排（ImageCompare）"
    group: Canny
  - id: l5-depth-control
    caption: "Depth Anything 3 输出的深度图（白 = 近，黑 = 远）"
    group: 深度
  - id: l5-depth-result
    caption: "depth-1 的成图，与深度图并排"
    group: 深度
  - id: l5-strength
    caption: "strength 0.8 / 1.0 / 1.2 对照（同一 Canny 控制图）"
    group: strength
transfers: true
sources:
  - badge: 官方
    url: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_lllite_any_control_to_image.json
    note: "官方 Any Control 模板：Canny 0.17 / 0.45 → 反转 → any-test-like-v2"
  - badge: 官方
    url: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_lllite_depth_control_to_image.json
    note: "官方 Depth 模板：Depth Anything 3 蓝图 → depth-1；GetImageSize 对齐画布"
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_model_patch.py
    note: "AnimaLLLiteApply：strength / start / end 范围；mask 二值化"
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/ldm/anima/lllite.py
    note: "控制图按 latent×8 中心裁剪 + bicubic 缩放"
  - badge: 官方
    url: https://huggingface.co/kohya-ss/Anima-LLLite
    note: "kohya 模型卡：各权重训练代际、控制图约定、shift；控制太强就降 strength 或缩小区间"
verified: 2026-11-24
---

## 目标

构图不满意时，换 seed 是碰运气；给模型一张"控制图"（线稿、深度图、涂鸦）才是确定性的办法。Anima 不走 SD 系的"应用ControlNet"（改条件），而是走**模型补丁**（改 MODEL）：两个节点串在 UNETLoader 与 K采样器 之间。这一课先把官方两个模板的连线拆开讲清楚，再各出一张对比图。

## 新增节点

| 节点 `类名` | 作用 | 关键参数 |
|---|---|---|
| 加载模型补丁 `ModelPatchLoader`（实验性） | 读 `models/model_patches/` 下的 LLLite 权重 | `name` |
| 应用 Anima LLLite `AnimaLLLiteApply`（实验性） | 把控制图注入模型 | `strength 1.0`、`start_percent 0`、`end_percent 1`、可选 `mask` |
| 获取图像尺寸 `GetImageSize` | 让输出画布 = 控制图尺寸 | 输出 width / height |
| 检测边缘 `Canny` + 反转图像 `ImageInvert` | 原图 → 白底黑线的线稿 | 官方模板 `0.17 / 0.45` |
| Depth Anything 3 蓝图（`LoadDA3Model` / `DA3Inference` / `DA3Render`） | 原图 → 深度图 | 节点库 → Comfy Blueprints → Preprocessors |
| 预览图像 `PreviewImage`、图像对比 `ImageCompare` | 看控制图；并排对比 | — |

端口细节：[ModelPatchLoader](/nodes/ModelPatchLoader/) · [AnimaLLLiteApply](/nodes/AnimaLLLiteApply/) · [GetImageSize](/nodes/GetImageSize/) · [Canny](/nodes/Canny/) · [ImageInvert](/nodes/ImageInvert/) · [LoadDA3Model](/nodes/LoadDA3Model/) · [DA3Inference](/nodes/DA3Inference/) · [DA3Render](/nodes/DA3Render/)

## 连线（官方 "Control to Image (Anima LLLite)" 子图的骨架）

```
// 预处理（官方 Any Control 模板）
LoadImage.IMAGE ──▶ Canny(0.17, 0.45) ──▶ ImageInvert ──▶ PreviewImage ──▶ ResizeImageMaskNode(1 MP, lanczos).resized ──┬──IMAGE──▶ AnimaLLLiteApply.image
                                                                                                                      └──IMAGE──▶ GetImageSize
// 预处理（官方 Depth 模板）：LoadImage → ResizeImageMaskNode(1 MP) → Depth Anything 3 蓝图 → PreviewImage → GetImageSize / AnimaLLLiteApply

// 画布对齐控制图
GetImageSize.width / height ──INT──▶ EmptyLatentImage.width / height

// 模型线：补丁插在 UNETLoader 与 Turbo LoRA 开关之间
UNETLoader.MODEL ──MODEL──▶ AnimaLLLiteApply.model
ModelPatchLoader(anima-lllite-xxx).MODEL_PATCH ──▶ AnimaLLLiteApply.model_patch
AnimaLLLiteApply.MODEL ──▶ （L1 的 ComfySwitch / LoraLoaderModelOnly）──▶ KSampler.model

// 对比
VAEDecode.IMAGE ──▶ ImageCompare.image_b；控制图（缩放后）──▶ ImageCompare.image_a
```

**为什么要 `GetImageSize` → `EmptyLatentImage`**：`AnimaLLLiteApply` 会把控制图**中心裁剪到输出潜空间的宽高比**，再 bicubic 缩放到 latent×8。画布尺寸等于控制图尺寸，边就不会被裁掉。

## 可用权重与控制图约定

| 文件 | 训练代际 | 控制图长什么样 | 备注 |
|---|---|---|---|
| `anima-lllite-inpainting-v2` | **Base v1.0** | RGB 原图 + 1 通道 mask（白 = 重绘区） | 下一课重绘用 |
| `anima-lllite-any-test-like-v2` | **Base v1.0** | 线稿 / 涂鸦（HED、PiDiNet）/ 灰度图的混合 | 官方模板喂的是 **Canny 取反**（白底黑线）；最通用 |
| `anima-lllite-depth-1` | Preview3 时代 | 深度图：**白 = 近，黑 = 远**（Depth Anything V2/V3 风格） | 在 v1.0 上"质量略降但仍可用" |
| `anima-lllite-lineart-1` | Preview3 时代 | 白底黑线的线稿 | 同上 |
| `anima-lllite-scribble-1` | Preview3 时代 | 黑底白线的涂鸦 | 同上 |
| `anima-lllite-pose-1` | Preview3 时代 | DWPose 标准输出（彩色骨架 + 脸 / 手关键点） | **效果明显弱于其它几种**，当"软先验"用 |

两个 v2 代权重是在 Base v1.0 上训的，效果最稳；四种 Preview3 代的在 v1.0 上本来就弱一些。

## 预处理器怎么选

| 想要的控制 | 预处理器 | 在哪 |
|---|---|---|
| 边缘 / 线稿（最省事） | `Canny(0.17, 0.45) → ImageInvert` → 配 `any-test-like-v2` | 核心；官方 Any Control 模板 |
| 深度 | "Image Depth Estimation (Depth Anything 3)" 蓝图（模型 `depth_anything_3_mono_large.safetensors` 放 `models/geometry_estimation/`；DA3Render 输出 `depth`、归一化 `v2_style`）→ 配 `depth-1` | 核心；官方 Depth 模板 |
| 深度（备选） | Depth Anything V2 / Lotus / MoGe 蓝图 | 节点库 → Comfy Blueprints → Preprocessors |
| 姿势 | DWPose（社区 `comfyui_controlnet_aux`）；核心的 SDPose 蓝图输出格式与训练用的 DWPose 不同，需实测 | 社区 + 核心 |
| 线稿 / 涂鸦 | `comfyui_controlnet_aux` 的 Lineart / HED / PiDiNet；或 kohya 训练时用的 AniLines、MangaLineExtraction | 社区 |
| 手涂 | `Painter` 节点（下一课）白底黑线直接画 | 核心 |

官方 Any Control 模板的便签写着：其它预处理器可以替换 **Detect Edges (Canny)**，原生支持的在 **Node Library → Comfy Blueprints → Conditioning & Preprocessors** 里。

## 参数与取值

| 参数 | 起始 | 调法 |
|---|---|---|
| `strength` | 1.0 | 不听话 → 1.2 ~ 1.5；太死板、纹理像控制图 → 0.6 ~ 0.8（kohya：控制太强就降 strength 或缩小区间）；`0` 等于不应用 |
| `start_percent` | 0 | 结构控制一般从 0 开始 |
| `end_percent` | 1.0 | 想让模型自由收尾 → 0.8 ~ 0.9（通用 ControlNet 经验，Anima 需实测） |
| `mask`（3 通道权重） | 不接 | 接了也会被忽略（源码：非 4 通道权重强制 `mask=None`） |
| `mask`（inpainting 权重） | 必接 | 在 0.5 处二值化；软边无效，所以要**涂大一圈**（下一课） |

多个 LLLite 可以**串联**（例如姿势 + 深度）：前一个 `AnimaLLLiteApply.MODEL` 接后一个的 `model`，各自有独立的 strength 与生效区间；强度是相加的，别都拉满。

## 动手步骤

1. 下载 `anima-lllite-any-test-like-v2`（15.6 MB）与 `anima-lllite-depth-1`（7.5 MB），放 `models/model_patches/`，按 `R`。
2. 在 `Anima T2T` 子图里（或外面）按上图接模型线：UNETLoader → AnimaLLLiteApply → 原来的开关。放一张参考图到 `ComfyUI/input/`。
3. **Canny 路线**：LoadImage → Canny(0.17, 0.45) → 反转 → 预览图像 看一眼（白底黑线）→ 调整大小 1 MP → 接 `AnimaLLLiteApply.image` 与 GetImageSize → 空Latent图像。
4. 写提示词描述**整张画面**（控制图只管结构，内容靠提示词），跑一张。VAEDecode 后接图像对比，与控制图并排。
5. **深度路线**：节点库里把 "Image Depth Estimation (Depth Anything 3)" 蓝图拖进来（会提示下载 `depth_anything_3_mono_large`，1.24 GB），LoadImage → 调整大小 → 蓝图 → 预览图像（近白远黑）→ 同样接 image 与 GetImageSize；权重换 `depth-1`。
6. 固定 Canny 控制图，strength 0.8 / 1.0 / 1.2 三张对照。

## 调参顺序

`PreviewImage` 先确认控制图本身是对的（深度图近白远黑、线稿白底黑线）→ strength 0.8 / 1.0 / 1.2 → end_percent 1.0 / 0.85 → 最后才动 start_percent。控制图不对，调 strength 是白费。

## 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| `ModelPatchLoader` 变红 | 文件放错目录（必须 `models/model_patches/`），放好按 `R` |
| 控制图边缘被裁 | 没把 `GetImageSize` 接到 `EmptyLatentImage`，画布比例与控制图不一致 |
| 控制太弱 | 换 v2 代权重（any / inpainting）；Preview3 代的四种在 v1.0 上本来就弱；或提高 strength |
| 控制图的花纹出现在成图里 | strength 过高，或控制图分辨率远高于输出（先缩到 1 MP） |
| 想同时保留原图颜色 | LLLite 只管结构；把控制图 VAE编码 后作为 `latent_image` 并用 denoise 0.3 ~ 0.5（L3 + L5 叠加） |
| 整张图像控制图的风格 | strength 过高；或提示词没写清画风（`@画师`） |

## 验收

- 两张"控制图 ↔ 成图"并排的对比图，一张 strength 对照，记进实验记录本。
- 下一课把 mask 输入口用起来：[局部重绘：官方模板法与保色法](/lessons/04-02-l6-inpaint/)。
