---
title: 工作流文件
kind: 模板
order: 3
sources:
  - badge: 社区
    note: "文件由本站脚本从出图用的工作流转成前端格式，自动布局，能加载、能跑；见 scripts/figures/to_workflow.py 的说明"
  - badge: 官方
    url: https://docs.comfy.org/zh
    note: 加载工作流的操作见 ComfyUI 官方文档
verified: 2026-11-28
---

每个级别出示例图的那条工作流，都转成了 ComfyUI 的工作流 JSON，可以下载后加载。**它们是出某一张对照图用的，不是课程要你从空白画布搭的那条完整管线**。连线、取值和对应课文一致，种子也是固定的。适合你搭完后对照，或者在它的基础上改。

## 怎么用

把 JSON 文件拖进 ComfyUI 画布，或者按 `Ctrl+O` 加载。节点位置是脚本按连线自动排成的几列，能加载、能跑，布局不追求好看。

下载前先对一下模型。九条都用到官方的 `anima-base-v1.0`、`qwen_3_06b_base` 和 `qwen_image_vae`。有几条另外挂了 LoRA 或 LLLite 权重，见表里的“额外要有的文件”一列。缺的文件到[模型文件清单](/resources/model-files/)对照目录。

L3、L5、L6 三条带加载图像节点，要先在节点里选一张图。课程出图时用的是 L0 那条工作流出的图。换成你出的任何一张都能跑，画面和对照图不同是正常的。L6 还要一张遮罩图。课程用的那张是手涂的，不在下载里。在 `LoadImageMask` 节点里换成你自己涂的，涂法见下表 L6 那一课的路线 B 一节。

## 文件清单

下表一行一个文件，“出的是哪张图”一列写它在课程里对应的对照图。

| 文件 | 对应的课 | 出的是哪张图 | 额外要有的文件 | 节点数 |
| ------------ | ------------ | ------------ | ------------ | ------------ |
| [L0-minimal.json](/workflows/L0-minimal.json) | [L0 · 从空白画布搭出 9 个节点](/lessons/01-01-l0-minimal/) | 模板 A（纯标签）出的那一张 | 无 | 9 |
| [L1-turbo-switch.json](/workflows/L1-turbo-switch.json) | [L1 · 给管线加上开关和画幅选择](/lessons/01-02-l1-controllable/) | Turbo（8 步 / CFG 1）与 Full（30 步 / CFG 4）并排 | `anima-turbo-lora-v0.2` | 18 |
| [L2-sweeps.json](/workflows/L2-sweeps.json) | [L2 · 批量出对照图，把参数扫一遍](/lessons/02-01-l2-sweeps/) | CFG 3、3.5、4、4.5、5、6 的单行扫描 | 无 | 31 |
| [L3-img2img.json](/workflows/L3-img2img.json) | [L3 · 用图生图把草稿修成成品](/lessons/03-01-l3-img2img/) | denoise 0.2、0.35、0.5、0.7、1.0 各一张 | 一张底图 | 22 |
| [L4-upscale.json](/workflows/L4-upscale.json) | [L4 · 放大三路线](/lessons/03-04-l4-upscale/) | 1024² 起稿，放大到 1536² 后二次采样，denoise 0.3、0.4、0.5 各一张；0.4 那张再放大到 2048² | 无 | 21 |
| [L5-lllite.json](/workflows/L5-lllite.json) | [L5 · 用 LLLite 控制结构](/lessons/04-01-l5-lllite/) | Canny 控制图、strength 1.0 的成图，以及 strength 0.8、1.0、1.2 的对照 | `anima-lllite-any-test-like-v2`，一张底图 | 32 |
| [L6-inpaint.json](/workflows/L6-inpaint.json) | [L6 · 重画一块，其余不动](/lessons/04-02-l6-inpaint/) | 路线 B 换表情的后一张 | `anima-lllite-inpainting-v2`，一张底图和它的遮罩 | 14 |
| [L7-custom-sampler.json](/workflows/L7-custom-sampler.json) | [L7 · 拆开采样器](/lessons/05-01-l7-custom-sampler/) | 基本引导器那一侧（cfg 1、30 步） | 无 | 13 |
| [L8-compare-grid.json](/workflows/L8-compare-grid.json) | [L8 · 让工作流替你做对比和重复](/lessons/05-03-l8-compare-loop/) | Base、Aesthetic、Turbo LoRA 三种模型各四个种子 | `anima-aesthetic-v1.1`、`anima-turbo-lora-v0.2` | 25 |

课程里的每张示例图，PNG 原图里也嵌着出它的那条工作流。把图拖回画布同样能还原，做法见[L0 · 从空白画布搭出 9 个节点](/lessons/01-01-l0-minimal/)。
