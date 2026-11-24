---
title: "L8 · 流水线化：子图、蓝图与成品流程 v1"
stage: 5
order: 4
summary: Day 14——把前面所有级别封装、复用、串联：从节点库拖出自己的蓝图，搭出"文生图 → 修脸 → 放大 → 重绘 → 交付"的完整流水线；知道哪些社区节点值得装、结业之后往哪走。
levels: [L8]
days: [14]
promptTrack: false
prerequisites:
  - 05-03-l8-compare-loop
nodes:
  - MarkdownNote
  - ImageSharpen
  - ImageCropV2
  - FaceDetailer
  - LatentUpscaleBy
  - UltimateSDUpscale
  - StringFormat
  - SaveImage
tags: []
deliverable: 成品流程 v1：一条从节点库蓝图出发的"文生图 → 放大 → 重绘"完整流水线，保存为工作流并收成子图。
acceptance:
  - L5 + L6 的重绘收成了子图 Anima Inpaint，对外只留 image / mask / 提示词 / 模型名
  - 完整流水线能从一个空画布搭起来：拖蓝图 → 接放大 → 接重绘 → 锐化裁切 → 保存
  - 用成品流程 v1 从一句提示词出了一张 2048² 的成品，中途修过脸或手
  - 便签里写着流程各段的基线参数；文件名带变量
  - 做过一次"常见误区"自测（盖住右列），错题记进了实验记录本
  - 社区节点只装了用得到的，并能说出每个包是哪一课用到的
figures:
  - id: l8-pipeline-canvas
    caption: "成品流程 v1 全图：蓝图 → 修脸 → 两段放大 → 重绘子图 → 锐化裁切 → 保存"
    group: 流水线
  - id: l8-pipeline-final
    caption: "用成品流程 v1 出的 2048² 成品"
    group: 流水线
transfers: false
sources:
  - badge: 官方
    url: https://docs.comfy.org/zh/interface/features/subgraph
    note: 子图与蓝图的创建、发布
  - badge: 官方
    url: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_lllite_image_inpainting.json
    note: "官方 \"Control to Image (Anima LLLite)\" 子图对外暴露 image / mask / text / 模型名 / strength / 开关"
  - badge: 官方
    url: https://huggingface.co/circlestone-labs/Anima
    note: "模型卡：LoRA 在 Base 上训；不训练 LLM adapter；rank 32 学习率 2e-5 起"
  - badge: 社区
    note: 社区节点清单来自各包 README 与 HF 讨论区
verified: 2026-11-24
---

## 目标

14 天的最后一天不学新节点。把 L1 的文生图、L5 + L6 的重绘各收成一个子图，从节点库拖出来，接上放大与后处理，搭出一条**从一句提示词到一张 2048² 成品**的流水线。它就是你接下来几个月的出图流程 v1——以后每次改进，都是在这条流水线的某一段上做一次单变量实验。

## 流水线化建议

1. **文生图收成子图** `Anima T2T`（Day 7 已做），发布为蓝图——以后每个新工作流直接从节点库拖。
2. **重绘收成子图** `Anima Inpaint`：把 L5 的 ModelPatchLoader → AnimaLLLiteApply 与 L6 路线 B 的遮罩 / 编码部分收进去，对外只留 `image` / `mask` / 正负提示词 / 模型名 / `strength`。对照官方 "Control to Image (Anima LLLite)" 子图的暴露清单：`image`、`mask`、`text`、`text_1`、`width` / `height`、三个模型名、`name`（补丁名）、`strength`、`start_percent` / `end_percent`、Turbo 开关、LoRA 名。
3. **文件名带参数**：例如 `Anima/L4_hires_d%KSampler.denoise%_s%LatentUpscaleBy.scale_by%`，调参时不会混淆。
4. **队列模式**：调参阶段切到 `Run (On Change)`，改一个数字就出一张。
5. **社区节点按需**：`comfyui_controlnet_aux`（DWPose / 线稿 / HED 预处理）、Impact Pack + Subpack（FaceDetailer / HandDetailer）、`rgthree-comfy`（K采样器 配置预设）、`RES4LYF`（`beta57` 调度器，模型作者推荐用于绘画质感）、`ComfyUI-ppm`（NegPip，CFG 1 下用负向）。只装可信作者、用得到的。

## 成品流程 v1

```
[Anima T2T 蓝图]（Turbo 开，固定 seed 找构图 → 关 Turbo / 换 Aesthetic 出成品）
        │ LATENT
        ▼
   VAEDecode① ──▶ FaceDetailer / HandDetailer（denoise 0.35，放大**之前**修）──▶ IMAGE
                                                                                           │
   ┌───────────────────────────────────────────────────────────────────────────────┘
   ▼
   ImageUpscaleWithModel（动漫向 4x）──▶ ResizeImageMaskNode(2.36 MP) ──▶ VAEEncode② ──▶ KSampler②(denoise 0.4，模型线挂 anima-highres-aesthetic-boost)
                                                                                           │ LATENT
                                                                                           ▼
                                                          （要 2048²：LatentUpscale(2048²) → KSampler③(denoise 0.3)；或改走 UltimateSDUpscale）
                                                                                           │
                                                                                           ▼
                                                                                      VAEDecode③ ──▶ [Anima Inpaint 蓝图]（有要改的局部才接）──▶ ImageSharpen(alpha 0.3 ~ 0.5) ──▶ ImageCropV2 ──▶ SaveImage("Anima/v1/%KSampler.seed%")
```

读法：每一框都是一个子图或一个节点，箭头是它们之间唯一的连接。**段与段之间只传 IMAGE 或 LATENT**，这样任何一段都能单独 `Ctrl+B` 掉、单独重做。这条走的是 L4 的路线 C（像素放大 + 图生图），因为修脸手要在像素域做、且要在放大之前；想要更快的 Latent 路线 B，就从 T2T 的 LATENT 直接接 缩放Latent（比例），把 Detailer 挪到最后（放大后再修，接缝会被放大，但省一次编解码——用对照图决定）。

## 动手步骤

1. 把 L6 路线 B 的工作流打开，框选 ModelPatchLoader、AnimaLLLiteApply、GrowMask、VAEEncodeForInpaint 与 K采样器，收成子图 `Anima Inpaint`，整理暴露的输入，发布到节点库。
2. 新建空白工作流 `Pipeline v1`：从节点库拖 `Anima T2T`，Turbo 开，固定 seed 找构图；关 Turbo 出成品。
3. 接 VAEDecode① → FaceDetailer（denoise 0.35），再按上图接路线 C 的放大（放大模型 → 缩到 2.36 MP → VAE编码 → K采样器② denoise 0.4），输出接 VAE解码③。
4. 有局部要改就接 `Anima Inpaint`，没有就跳过。接锐化、裁切、保存（前缀带变量）。
5. 加一张 Markdown 便签，写各段基线：Turbo 8 / 1；Aesthetic 30 / 4；放大 1.5× d0.4 → 2048² d0.3；Detailer 0.35；锐化 alpha 0.4。
6. 全选收成子图 `Anima Pipeline v1`，另存。拖到新画布跑一遍确认能出图。
7. 做"常见误区"自测：打开[常见误区](/resources/misconceptions/)，盖住右列逐条答，错题抄进实验记录本。

## 参数与取值

流水线本身没有新参数。每一段的起点值就是前四个阶段的"今日基线"——把它们写进便签，流水线才带着"为什么"。

## 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 拖出来的蓝图之间接不上 | 子图输出是 IMAGE 还是 LATENT 要对上：放大走 LATENT，重绘走 IMAGE |
| 流水线一长就不知道哪段出问题 | 逐段 `Ctrl+B`，或选中某个输出节点点蓝色三角"部分执行"只跑那条分支 |
| 改了子图里的参数，别的副本没变 | 蓝图副本相互独立；要统一就改节点库里的蓝图再重新拖 |
| 社区节点装多了启动变慢 / 报 import failed | 只留用得到的；用 `--disable-all-custom-nodes` 排查，逐个放回 |
| 成品流程 v1 出图不满意 | 回到单段做单变量实验，改完再更新子图——不要在流水线里直接调参 |

## 结业：14 天之后

**你手里应该有的**：第一张图 → `Anima T2T` 蓝图 → 参数基线表 → 五档 denoise 对照 → LoRA 四宫格 → 三路线 1536² → 一张 2048² → LLLite 两张对比 → 换表情 / 加物件 / 扩图三张 → 修脸修手 → 基本引导器对照、shift 对照 → 3 × 4 网格 → 成品流程 v1，以及一本写满"为什么"的实验记录本（可导出 JSON）。

**往下走的三条路**：

| 方向 | 做什么 | 从哪开始 |
|---|---|---|
| 把流水线跑成批量 | 用 HTTP API 脚本跑扫描、无界面常驻、自己写节点 | 开发者选修（原始笔记《补充B》，站内内容待迁移） |
| 训自己的 LoRA | 在 **Base** 上训；**不要训练 LLM adapter**（`llm_adapter_lr=0`）；rank 32 的 LoRA 学习率从 `2e-5` 起 | 模型卡 |
| 复核 | 站内每页带核实日期；ComfyUI 版本、模板、节点参数都会变，季度回来对照一次 | 各页的"核实于"徽章 |

**方法比参数重要**。这 14 天反复用的只有四条：固定种子、一次只改一个变量、Turbo 试稿 Base 出成品、固定分辨率。换一个模型，节点名和参数范围会变，这四条不会。

## 验收

- 成品流程 v1 能从空画布搭起来并出一张 2048²；两个自制蓝图在节点库里；便签里有基线；误区自测做过。
- 课程到此结束。排错时回到[排错速查](/troubleshooting/)；写提示词时回到[标签字典](/tags/)与[提示词模板](/resources/prompt-templates/)。
