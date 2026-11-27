---
title: L7 · 拆开采样器
stage: 5
order: 1
summary: "学完你能把 K采样器 拆成零件重组：让 Turbo 少算一半，并给采样的前后两段挂不同模型。"
levels: [L7]
days: [12]
promptTrack: false
prerequisites:
  - 04-03-l6-outpaint
nodes:
  - KSamplerSelect
  - SamplerER_SDE
  - BasicScheduler
  - RandomNoise
  - DisableNoise
  - BasicGuider
  - CFGGuider
  - SamplerCustomAdvanced
  - KSamplerAdvanced
  - SplitSigmas
  - SplitSigmasDenoise
  - CFGOverride
  - TextOverlay
  - ImageGrid
tags: []
deliverable: 一张“基本引导器 Turbo vs K采样器 Turbo”的对照（含耗时）；一张两段采样的图，能解释两段各自的参数。
acceptance:
  - 用基本引导器 + 自定义采样器（高级）出了一张 Turbo 图，与 K采样器 版本并排，记录了两者耗时
  - 知道 BasicGuider 等效 CFG 1、只跑一路条件；知道什么时候必须用 CFG引导器
  - 用两个 K采样器（高级）做了两段采样，第一段 return_with_leftover_noise = enable、第二段 add_noise = disable；能解释两段各自的参数与开关
  - 能说出 start_at_step / end_at_step 按“全表索引”截取与 denoise 不减步数的区别
  - 两段挂了不同模型补丁（如前段 Turbo LoRA + CFG 覆盖 cfg 1，后段 Base + cfg 4）并对照过“前段快、后段精”的效果
figures:
  - id: l7-basic-guider
    src: ../../assets/figures/l7-basic-guider.webp
    caption: "同 seed、cfg 1、30 步：K采样器（左）和基本引导器 + 自定义采样器（右），画面一致，标注耗时"
    group: 基本引导器
  - id: l7-two-stage
    src: ../../assets/figures/l7-two-stage.webp
    caption: "两段采样：0–15 步 Turbo LoRA + cfg 1，15–30 步 Base + cfg 4"
    group: 两段采样
  - id: l7-vs-oneshot
    src: ../../assets/figures/l7-vs-oneshot.webp
    caption: "两段采样 vs 单段 Base 30 步（同 seed）"
    group: 两段采样
transfers: true
sources:
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_custom_sampler.py
    note: "引导器、调度器、SamplerCustomAdvanced、SplitSigmas；NAG 关闭 CFG 1 优化"
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/nodes.py
    note: "KSamplerAdvanced：add_noise / start_at_step / end_at_step / return_with_leftover_noise"
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/samplers.py
    note: "KSampler.set_steps：denoise 不减步数"
  - badge: 作者
    url: https://huggingface.co/circlestone-labs/Anima
    note: 模型卡：er_sde 推荐
verified: 2026-11-24
---

## 采样器的零件

K采样器 把选采样方法、定时间表、造噪声、定引导方式、执行采样打包好了。拆开用可以自由组合：Turbo 少算一半，两段用不同模型或不同 CFG，换一种引导方式。这一课只做两件最实用的，Turbo 用基本引导器和两段采样；shift 与引导补丁放下一课。**这一级的东西大多没有 Anima 专项验证**，是通用工具。每一步都用 L2 的对照方法验证，一次只改一个。

| 零件 | 节点 `类名` | 关键参数 | 输出 |
|---|---|---|---|
| 选采样方法 | K采样器选择 `KSamplerSelect` | `sampler_name`（45 选 1） | SAMPLER |
| | ER-SDE 采样器 `SamplerER_SDE` | `solver_type` ER-SDE / Reverse-time SDE / ODE；`eta` 1.0（0 = 退化为确定性 ODE）；`max_stage` 3；`s_noise` 1.0 | SAMPLER |
| 定时间表 | 基本调度器 `BasicScheduler` | `scheduler simple`、`steps`、`denoise 1.0` | SIGMAS |
| 造噪声 | 随机噪波 `RandomNoise` / 禁用噪波 `DisableNoise` | `noise_seed` | NOISE |
| 定引导方式 | 基本引导器 `BasicGuider` | `model`、`conditioning`（只有一路，等效 CFG 1） | GUIDER |
| | CFG引导器 `CFGGuider` | `model`、`positive`、`negative`、`cfg` | GUIDER |
| 执行采样 | 自定义采样器（高级）`SamplerCustomAdvanced` | `noise`、`guider`、`sampler`、`sigmas`、`latent_image` | `output`（LATENT） |
| 不拆开也能切两段 | K采样器（高级）`KSamplerAdvanced` | `add_noise`、`start_at_step`、`end_at_step`、`return_with_leftover_noise` | LATENT |
| 时间表工具 | 分离Sigma `SplitSigmas` / 分离Sigma降噪 `SplitSigmasDenoise` | `step` / `denoise` | 两段 SIGMAS |

端口细节：[KSamplerSelect](/nodes/KSamplerSelect/) · [SamplerER_SDE](/nodes/SamplerER_SDE/) · [BasicScheduler](/nodes/BasicScheduler/) · [RandomNoise](/nodes/RandomNoise/) · [DisableNoise](/nodes/DisableNoise/) · [BasicGuider](/nodes/BasicGuider/) · [CFGGuider](/nodes/CFGGuider/) · [SamplerCustomAdvanced](/nodes/SamplerCustomAdvanced/) · [KSamplerAdvanced](/nodes/KSamplerAdvanced/) · [SplitSigmas](/nodes/SplitSigmas/) · [SplitSigmasDenoise](/nodes/SplitSigmasDenoise/)

## 基本引导器

```
UNETLoader(turbo).MODEL ───────────────────────▶ BasicGuider.model
CLIPTextEncode(正向).CONDITIONING ─────────────▶ BasicGuider.conditioning
BasicGuider.GUIDER ──▶ SamplerCustomAdvanced.guider
KSamplerSelect(euler).SAMPLER ──▶ SamplerCustomAdvanced.sampler
BasicScheduler(model, simple, steps 8, denoise 1).SIGMAS ──▶ SamplerCustomAdvanced.sigmas
RandomNoise(seed).NOISE ──▶ SamplerCustomAdvanced.noise
EmptyLatentImage.LATENT ──▶ SamplerCustomAdvanced.latent_image
SamplerCustomAdvanced.output ──LATENT──▶ VAEDecode
```

**Turbo 本来就是 CFG 1，用基本引导器只跑一路条件，少算一半**。Base / Aesthetic 要用负向时，换成 CFG引导器。模型线上挂了 NAGuidance 时也必须用 CFG引导器，它需要正负两路。

## 两段采样

```
KSamplerAdvanced①(add_noise=enable, steps 30, start 0, end 15, return_with_leftover_noise=enable).LATENT
   ──LATENT──▶ KSamplerAdvanced②(add_noise=disable, start 15, end 30, return_with_leftover_noise=disable).latent_image
```

两段可以挂不同的模型补丁。例如第一段挂 Turbo LoRA 加 CFG覆盖（cfg 1），第二段用 Base 加 cfg 4，前段出图快，后段补细节。这是实验性做法，Turbo 的默认风格会带进后半段。

**起止步是按全表索引截取的，会减步数。**`start_at_step` 和 `end_at_step` 都是这样：steps 30、start 15 时，第二段真的只跑 15 步；想每段 30 步，两段的 steps 都设 60。K采样器 的 `denoise` 不同，它不减步数。

不想记两段的开关，也可以用拆开的方式。`BasicScheduler` 接 `SplitSigmas`（step 15），得到 high / low 两段，各接一个 SamplerCustomAdvanced。第一段接 RandomNoise，第二段接 DisableNoise，第二段的 latent_image 接第一段的 output。

## 参数与取值

表里都是起点值。

| 参数 | 取值 | 说明 |
|---|---|---|
| 基本引导器路线 | Turbo、euler、8 步、simple | 与 K采样器 版本同 seed 对比，画面应一致（只是快） |
| 两段切点 | 50%（15 / 30） | 可试 30% ~ 70% |
| 第一段 | Turbo LoRA + CFG覆盖(cfg 1, 0 ~ 0.5) | 快；定构图 |
| 第二段 | Base（或挂风格 LoRA）+ cfg 4 | 慢；补细节 |
| 每段步数 | 想各 30 步，steps 都设 60 | 全表索引截取 |

## 动手步骤

1. 在 `Anima T2T` 子图外另起一支，按基本引导器一节的连线接七个节点，seed 固定，出一张 Turbo 图。与子图 `turbo_mode` 开、同 seed 的 K采样器 版本并排，耗时看底部日志或节点上的显示。
2. 两段采样。把 K采样器 复制成两个 K采样器（高级），按两段采样一节的连法设开关与起止步。两段的 model 分别接 Turbo LoRA 那一路与 Base，第一段模型线再串一个 CFG覆盖（cfg 1、end_percent 0.5）。出一张，与单段 Base 30 步同 seed 并排。
3. 调切点：从 15 改到 9（30%）、21（70%），各出一张。
4. `SamplerCustomAdvanced` 报“缺少输入”时，检查五个输入是否都接了。

## 调参顺序

先用基本引导器把 Turbo 的速度拉满，日常收益最大。然后做下一课的引导补丁，一次只叠一个，逐个 `Ctrl+B` 对照。最后才试两段采样换模型。T4 时间表参数只在 T1–T3 调好后碰：cfg / steps / denoise 没定，两段怎么切都无法归因。

## 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| `SamplerCustomAdvanced` 报缺输入 | 五个输入全必填：noise / guider / sampler / sigmas / latent_image |
| 第二段出图是纯噪声 | 第二段的 `add_noise` 忘了 disable，或第一段的 `return_with_leftover_noise` 没 enable |
| 基本引导器路线的图和 K采样器 版本不一样 | 确认 steps / scheduler / sampler / seed 四项完全一致；Aesthetic / Base 上基本引导器等效 CFG 1，本来就不一样 |
| 两段总量比单段还差 | 第二段步数不够（全表索引截取）；或切点太靠前，构图没定 |
| 找不到 `SamplerER_SDE` / `NAGuidance` 等节点 | 核心节点较新，桌面稳定版可能还没有；更新到最新版 |
