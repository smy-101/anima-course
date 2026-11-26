---
title: L7 · 调 shift，叠引导补丁
stage: 5
order: 2
summary: "学完你能调 shift，逐个试 APG、NAG、CFG 覆盖这些引导补丁，并用同 seed 的对照图决定每个补丁留不留。"
levels: [L7]
days: [12]
promptTrack: false
prerequisites:
  - 05-01-l7-custom-sampler
nodes:
  - ModelSamplingSD3
  - CFGOverride
  - APG
  - NAGuidance
  - CFGNorm
  - TCFG
  - PerturbedAttentionGuidance
  - SelfAttentionGuidance
  - CFGGuider
  - KSampler
  - BasicScheduler
  - SplitSigmas
  - ManualSigmas
  - KarrasScheduler
tags:
  - twins
deliverable: 一张 shift 3 / 5 / 7 对照图；一张“挂一个引导补丁 vs 不挂”的对照图，能说出补丁做了什么、值不值得留。
acceptance:
  - 知道 Anima 的 shift 默认是 3.0，挂 采样算法（SD3）不调等于没改
  - 做过 shift 3 / 5 / 7 的同 seed 对照，能说出调高后“步数留在高噪声段”的直观效果
  - 至少试过一个引导补丁（APG / NAG / CFG 覆盖任一），用 Ctrl+B 出了对照
  - 知道 NAG 要求 CFG > 1、Turbo 下无意义；知道挂 NAG 后速度掉一半是正常的
  - 每个留下的补丁都能说出“解决了我哪个具体问题”，留下 / 删掉的理由写进实验记录本
figures:
  - id: l7-shift-3
    caption: "shift 3.0（Anima 默认）"
    group: shift
  - id: l7-shift-5
    caption: "shift 5.0"
    group: shift
  - id: l7-shift-7
    caption: "shift 7.0，更多步数留在高噪声段"
    group: shift
  - id: l7-apg
    caption: "cfg 7：不挂 APG vs 挂 APG（eta 1 / norm 5 / momentum 0）"
    group: 引导补丁
  - id: l7-nag
    caption: "cfg 4：负向不挂 NAG vs 挂 NAG（scale 5 / alpha 0.5 / tau 1.5）"
    group: 引导补丁
transfers: true
sources:
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/supported_models.py
    note: "Anima：ModelType.FLOW、ModelSamplingDiscreteFlow、shift = 3.0"
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_model_advanced.py
    note: "ModelSamplingSD3.shift 默认 3.0"
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_nag.py
    note: "NAGuidance：nag_scale 5 / nag_alpha 0.5 / nag_tau 1.5；要求 CFG > 1"
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_apg.py
    note: "APG：eta 1 / norm_threshold 5 / momentum 0"
  - badge: 官方
    url: https://huggingface.co/kohya-ss/Anima-LLLite
    note: "kohya 模型卡：v2 权重训练时 shift 3.0；Preview3 代 depth / lineart / scribble 为 1.0，any v1 为 4.0"
  - badge: 社区
    url: https://huggingface.co/circlestone-labs/Anima/discussions/165
    note: "HF 讨论区 #165：CFG++ 采样器需 CFG < 2"
verified: 2026-11-24
---

## 补丁清单

上一课把采样器拆成了零件，这一课调它的时间表，再叠加几种引导方式。它们都是 MODEL 进、MODEL 出的补丁，串在加载器之后、采样器之前：

```
UNETLoader.MODEL ──▶ ModelSamplingSD3(shift 3.0) ──▶ APG ──▶ NAGuidance ──▶ CFGOverride(cfg 1, start 0, end 0.1) ──▶ KSampler.model
```

**原则只有一条：一次只叠一个**。挂上，`Ctrl+B`，并排看。这一级没有 Anima 专项数据，每个补丁都靠你自己的固定种子对照图决定去留。

| 节点 `类名` | 做什么 | 关键参数（源码默认） | 什么时候试 |
|---|---|---|---|
| 采样算法（SD3）`ModelSamplingSD3` | 改 flow 模型的 shift | `shift 3.0`（= Anima 默认） | 高分辨率想要更稳的构图；LLLite 控制发怪时对照 |
| CFG 覆盖 `CFGOverride` | 在某段采样里强制 CFG | `cfg 1.0`，`start_percent 0`，`end_percent 1` | 前几步强制 cfg 1 减轻早期过饱和；两段采样前段 Turbo |
| 自适应投影引导 `APG` | 投影式引导，降低高 CFG 过饱和 | `eta 1.0`、`norm_threshold 5.0`、`momentum 0.0` | 想用高 CFG 又不烧图 |
| 归一化注意力引导 `NAGuidance` | 在 CFG > 1 时让负向“真正生效”且不烧图 | `nag_scale 5.0`、`nag_alpha 0.5`、`nag_tau 1.5` | 负向不听话（Base / Aesthetic） |
| CFG 归一化 `CFGNorm` / TCFG `TCFG` / 扰动注意力引导 `PerturbedAttentionGuidance` / 自注意力引导 `SelfAttentionGuidance` | 其它引导增强 | `strength 1.0` / — / `scale 3.0` / `scale 0.5` | 研究用，逐个对照 |

端口细节：[ModelSamplingSD3](/nodes/ModelSamplingSD3/) · [CFGOverride](/nodes/CFGOverride/) · [APG](/nodes/APG/) · [NAGuidance](/nodes/NAGuidance/) · [CFGNorm](/nodes/CFGNorm/) · [TCFG](/nodes/TCFG/) · [PerturbedAttentionGuidance](/nodes/PerturbedAttentionGuidance/) · [SelfAttentionGuidance](/nodes/SelfAttentionGuidance/)

## 参数与取值

怎么调一栏的数值都是起点值。

| 参数 | Anima 默认 | 怎么调 | 依据 |
|---|---|---|---|
| `ModelSamplingSD3.shift` | 3.0（源码写死） | 调高后更多步数留在高噪声段，构图更稳、细节更足，常用于高分辨率；调低后更快、更“平”。先拿 3、5、7 各出一张对照 | 通用 flow 模型经验；Anima 无专项数据 |
| `CFGOverride` 窗口 | 不用 | 前几步强制 cfg 1（`end_percent 0.05 ~ 0.15`）可减轻早期过饱和 | 通用技巧 |
| `APG` | `eta 1 / norm 5 / momentum 0` | 高 CFG 想不烧图时试 | 通用 |
| `NAGuidance` | `scale 5 / alpha 0.5 / tau 1.5` | 要求 CFG > 1，因为它需要批里同时有正负两路，会关闭 CFG 1 优化；Turbo 下无意义 | 通用；《提示词报告》里提到的自定义节点 Anima-NAG 的思路，核心已有同名实现 |
| CFG++ 采样器（`*_cfg_pp`） | — | 必须配 CFG < 2（推荐 1.5），4.5 一定会烧图 | HF 讨论区回复 |
| LLLite + shift | 3.0 | v2 权重训练时 shift = 3.0；Preview3 代的 depth / lineart / scribble 训练时是 1.0、any v1 是 4.0。这几种控制“发怪”时，可以对照试一下对应的 shift（实验性） | kohya 模型卡 |

## 时间表参数

这一节是调参阶梯里的 T4，只在 T1–T3 调好后碰。cfg / steps / denoise 没定就去调 shift，结果无法归因。表里都是起点值。

| 参数 | 起始 | 范围 | 说明 |
|---|---|---|---|
| `ModelSamplingSD3.shift` | 3.0 | 2 ~ 7 | 高分辨率可试更高；LLLite v2 权重按 3.0 训练 |
| `CFGOverride` 窗口 | 不用 | 前 5% ~ 15% 强制 cfg 1 | 减轻早期过饱和 |
| `SplitSigmas` / K采样器（高级）切点 | 50% | 30% ~ 70% | 两段用不同模型 / CFG 时才需要 |
| 手写 Sigmas [ManualSigmas](/nodes/ManualSigmas/) / [KarrasScheduler](/nodes/KarrasScheduler/) | 不用 | — | 自定义时间表，研究用 |

## 动手步骤

1. shift 对照。在 `Anima T2T` 子图里或外面，给 UNETLoader 的 MODEL 串一个采样算法（SD3）。`shift` 拖成输入口，接创建列表（3 / 5 / 7）。Base 模式、同 seed、同提示词，出三张拼一张。换一张 1536² 的图再试一次，shift 的收益在高分辨率上更明显。
2. APG。cfg 拉到 7，先出不挂 APG 的一张，这时会过饱和；再挂 APG 出一张，并排。
3. NAG。cfg 4、Aesthetic 模型，负向里放一个明确不想要的东西，如 `twins`。不挂 NAG 和挂 NAG 各出一张，速度差一倍是正常的。
4. CFG 覆盖。cfg 6，挂一个 CFG覆盖（cfg 1、end_percent 0.1），与不挂并排，看过饱和是否减轻。
5. 每个补丁只留一个在模型线上，其余删掉或 `Ctrl+B`。

## 调参顺序

按上面的原则，挂一个补丁，`Ctrl+B` 对照。能说出“解决了我哪个具体问题”才留下，再叠下一个。shift 从 3 起步，再到 5、7；CFG 覆盖先试前 10%；NAG 从默认值起步。

## 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 挂了 NAG 后速度掉一半 | 正常：它关闭了 CFG 1 优化，改成正负两路都算 |
| 挂 NAG 没效果 | 模型是 Turbo / CFG 1，而 NAG 要求 CFG > 1 |
| 找不到 `NAGuidance` / `APG` | 核心节点较新，桌面稳定版可能还没有；更新到最新版 |
| shift 调高后图变糊 / 变慢 | 步数固定时高噪声段分到更多步、低噪声段变少；steps 加 5 ~ 10 再看 |
| 补丁叠了三四个，画面变怪 | 无法归因，只留一个，逐个对照 |
| 想用 CFG++ 采样器 | 配 CFG < 2（推荐 1.5）；4.5 必烧 |
