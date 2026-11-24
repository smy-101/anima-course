---
name_zh: Checkpoint加载器（简易）
category: 加载器
first_level: L0
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py, note: "读取 checkpoints 目录；输出 MODEL、CLIP、VAE" }
verified: 2026-11-24
inputs: []
params:
  - { name: ckpt_name, default: "—", range: "checkpoints 目录下的文件", desc: "三合一整包 checkpoint" }
outputs:
  - { name: MODEL, type: MODEL, desc: "去噪模型" }
  - { name: CLIP, type: CLIP, desc: "包内自带的文本编码器" }
  - { name: VAE, type: VAE, desc: "包内自带的 VAE" }
---

一个节点交出 MODEL、CLIP、VAE 三个输出，适合 SD1.5 / SDXL / FLUX 这类**三合一整包** checkpoint——一个文件里打包了模型、文本编码器和 VAE。

**Anima 不用它**：Anima 是拆分模型，三个文件分开放，用 [UNet加载器](/nodes/UNETLoader/) + [加载CLIP](/nodes/CLIPLoader/) + [加载VAE](/nodes/VAELoader/)（见[准备](/lessons/00-01-setup/)）。两个节点的区别就是"整包 vs 拆分"，概念可迁移：换回 SD 系模型时，把这三个加载器换回这一个即可，后面的采样流程不变。
