---
name_zh: 加载ControlNet模型
category: 加载器
first_level: L5
sources:
  - { badge: 源码, url: https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py, note: "读取 controlnet 目录；输出 CONTROL_NET" }
verified: 2026-11-24
inputs: []
params:
  - { name: control_net_name, default: "—", range: "controlnet 目录下的文件", desc: "SD / SDXL 系 ControlNet 模型（含 T2I-Adapter）" }
outputs:
  - { name: CONTROL_NET, type: CONTROL_NET, desc: "接 应用ControlNet（高级）的 control_net" }
---

SD / SDXL 系的 ControlNet 加载器：输出 CONTROL_NET，接到“应用ControlNet”节点，改的是条件（CONDITIONING）。

Anima 不走这条路。Anima 的结构控制 LLLite 是模型补丁：权重放 `models/model_patches/`，用 [加载模型补丁](/nodes/ModelPatchLoader/) 读取，再经 [应用 Anima LLLite](/nodes/AnimaLLLiteApply/) 接在 UNETLoader 与采样器之间，改的是 MODEL。这是把 SD 系 ControlNet 工作流搬到 Anima 时最容易错的一处，见课程 [L5](/lessons/04-01-l5-lllite/) 与[常见误区](/resources/misconceptions/)。
