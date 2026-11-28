---
title: L1 · 给管线加上开关和画幅选择
stage: 1
order: 2
summary: "学完你能给 L0 管线加上 Base / Turbo 开关和画幅选择器，并把它和官方模板的子图逐节点对上。"
levels: [L1]
days: [2]
promptTrack: false
prerequisites:
  - 01-01-l0-minimal
nodes:
  - ResolutionSelector
  - PrimitiveBoolean
  - LoraLoaderModelOnly
  - PrimitiveInt
  - PrimitiveFloat
  - ComfySwitchNode
tags: []
deliverable: "自己的 Anima T2T 工作流（19 个节点），能与官方子图逐条对照。"
acceptance:
  - 画布尺寸由分辨率选择器驱动，EmptyLatentImage 的 width/height 已拖成输入口
  - 三个切换节点的 switch 都接到同一个布尔值；关 Turbo 时 30 步 / CFG 4，开 Turbo 时 8 步 / CFG 1
  - 开 Turbo 用同 seed、同提示词出了试稿；关 Turbo 用同 seed 出了成品
  - 比较了 Turbo LoRA 强度 1.0 / 0.8 / 0.7 并记入实验记录本
  - 拖入官方“Anima Base v1”模板，双击子图，逐节点、逐数值、逐连线对照过自己的工作流
figures:
  - id: l1-wiring
    src: ../../assets/figures/l1-wiring.webp
    caption: "L1 连线全图：三处改动（尺寸 / 模型开关 / 步数与 CFG 开关）"
    group: 管线
  - id: l1-turbo-vs-full
    src: ../../assets/figures/l1-turbo-vs-full.webp
    caption: "同 seed、同提示词：Turbo（8 步 / CFG 1）与 Full（30 步 / CFG 4）并排"
    group: 开关
  - id: l1-lora-strength
    src: ../../assets/figures/l1-lora-strength.webp
    caption: "Turbo LoRA 强度 1.0 / 0.8 / 0.7 对照"
    group: LoRA 强度
  - id: l1-subgraph-compare
    src: ../../assets/figures/l1-subgraph-compare.webp
    caption: "官方模板子图内部 17 节点 vs 自搭工作流的对照截图"
    group: 对照
transfers: true
sources:
  - badge: 官方
    url: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_base_v1.json
    note: 模板子图内部 17 节点的节点与数值
  - badge: 作者
    url: https://huggingface.co/circlestone-labs/Anima/discussions
    note: Turbo LoRA 降到 0.7 仍保持蒸馏；er_sde 配 Turbo LoRA 可能太吵
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_toolkit.py
    note: ComfySwitchNode 惰性求值；ResolutionSelector 尺寸公式
verified: 2026-11-24
---

## 新增节点

这一级在 L0 的 9 个节点上再加 10 个，共 19 个。做完后你会看懂官方模板为什么那样连，因为它就是这样连的。

| 节点 `类名` | 数量 | 作用 | 官方模板里的值 |
|---|---|---|---|
| 分辨率选择器 `ResolutionSelector` | 1 | 由比例和总像素算出宽高 | `1:1 (Square)`，`megapixels 1`，`multiple 16` |
| 布尔值 `PrimitiveBoolean` | 1 | 总开关 `turbo_mode` | `false` |
| LoRA加载器（仅模型）`LoraLoaderModelOnly` | 1 | 挂 Turbo LoRA | `anima-turbo-lora-v0.2.safetensors`，`strength 1.0` |
| 整数 `PrimitiveInt` | 2 | 两套步数 | `30`（Full）/ `8`（Turbo） |
| 浮点数 `PrimitiveFloat` | 2 | 两套 CFG | `4` / `1` |
| 切换 `ComfySwitchNode` | 3 | 分别切 MODEL / INT / FLOAT | `switch` 都由同一个布尔值驱动 |

端口与参数细节：[ResolutionSelector](/nodes/ResolutionSelector/) · [PrimitiveBoolean](/nodes/PrimitiveBoolean/) · [LoraLoaderModelOnly](/nodes/LoraLoaderModelOnly/) · [PrimitiveInt](/nodes/PrimitiveInt/) · [PrimitiveFloat](/nodes/PrimitiveFloat/) · [ComfySwitchNode](/nodes/ComfySwitchNode/)

## 连线

在 L0 的基础上改三处：

```
// 改动 ①：画布尺寸改由选择器驱动
ResolutionSelector.width  ──INT──▶  EmptyLatentImage.width
ResolutionSelector.height ──INT──▶  EmptyLatentImage.height
（把 EmptyLatentImage 的 width/height 控件拖成输入口）

// 改动 ②：模型线经过开关
UNETLoader.MODEL ────────────────────────────────────────────────▶ ComfySwitch(MODEL).on_false
UNETLoader.MODEL ──▶ LoraLoaderModelOnly(turbo-lora, 1.0).MODEL ──▶ ComfySwitch(MODEL).on_true
ComfySwitch(MODEL).output ──MODEL──▶ KSampler.model

// 改动 ③：steps / cfg 经过开关
PrimitiveInt(30)    ──▶ ComfySwitch(INT).on_false     PrimitiveInt(8)    ──▶ ComfySwitch(INT).on_true
ComfySwitch(INT).output   ──INT──▶   KSampler.steps
PrimitiveFloat(4)   ──▶ ComfySwitch(FLOAT).on_false  PrimitiveFloat(1) ──▶ ComfySwitch(FLOAT).on_true
ComfySwitch(FLOAT).output ──FLOAT──▶ KSampler.cfg

// 总开关
PrimitiveBoolean(turbo_mode).BOOLEAN ──▶ 三个 ComfySwitchNode.switch
```

`ComfySwitchNode` 是惰性求值的：只有被选中的那一路会被执行。所以关着 Turbo 时，Turbo LoRA 那一路不会被计算，也不会加载进显存。

**把控件拖成输入口，是这一级的通用技巧。** 把连线直接拖到某个控件上，该控件就变成输入端口，数值改由上游节点提供。下一课的批量实验就靠它。

## 参数与取值

`ResolutionSelector` 设 `multiple = 16` 时，各比例的实际尺寸如下，按源码公式计算。模板默认是 1.0 MP 这一列。

| 比例 | 0.5 MP | 1.0 MP（模板默认） | 1.5 MP |
|---|---|---|---|
| 1:1 | 720×720 | 1024×1024 | 1248×1248 |
| 2:3 / 3:2 | 592×880 / 880×592 | 832×1248 / 1248×832 | 1024×1536 / 1536×1024 |
| 3:4 / 4:3 | 624×832 / 832×624 | 880×1184 / 1184×880 | 1088×1456 / 1456×1088 |
| 9:16 / 16:9 | 544×960 / 960×544 | 768×1360 / 1360×768 | 944×1680 / 1680×944 |
| 21:9 | 1104×480 | 1568×672 | 1920×816 |

开关两边的取值是起点值，出过图、看过结果再改：

| 开关 | Full（false） | Turbo（true） |
|---|---|---|
| 模型 | Base | Base + Turbo LoRA（或把 UNETLoader 换成 `anima-turbo-v1.1` 整模型并关掉 LoRA） |
| steps / cfg | 30 / 4 | 8 / 1 |
| 负向提示词 | 有效 | 无效 |
| 适用 | 出成品 | 试提示词 |

**Turbo 下负向提示词无效。** 这时 CFG 是 1，把想要的东西写进正向。

## 动手步骤

1. 在 L0 的工作流上另存为 `L1`。
2. 添加 `ResolutionSelector`，把 `EmptyLatentImage` 的 width、height 控件拖成输入口并连线。
3. 加 `LoraLoaderModelOnly`，选 `anima-turbo-lora-v0.2`。把 `UNETLoader.MODEL` 分两路：一路直连切换节点的 `on_false`，一路经 LoRA 连 `on_true`。
4. 加两个 `PrimitiveInt`（30 / 8）和两个 `PrimitiveFloat`（4 / 1），各接一个切换节点。
5. 加一个 `PrimitiveBoolean`，接到三个切换节点的 `switch`。
6. 打开 `turbo_mode`，填提示词，换 seed 找构图。8 步一张，很快。
7. 关掉 `turbo_mode`，用同一个 seed、同一条提示词出成品，和 Turbo 那张并排看。

做完后把官方模板“Anima Base v1”拖进画布，双击子图。逐节点、逐数值、逐连线核对，确认你搭的和子图内部一致。

把这个工作流存好。阶段 3 复盘时会把它收成一个子图 `Anima T2T`，以后每个新工作流直接从节点库拖。

## 调参顺序

先打开 `turbo_mode`，填提示词，换 seed 找构图。然后关掉 `turbo_mode`，用同一个 seed 出成品。最后比较 Turbo LoRA 的强度 1.0、0.8、0.7。作者说低到 0.7 仍能保持蒸馏，多样性更高。

## 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 开 Turbo 后“AI 味”很重 | 作者建议：降 LoRA 权重、去掉质量标签、正向加 `anime coloring` |
| 开 Turbo 后线条发噪发糊 | 别用 `er_sde`，换 `euler`（作者说明） |
| 想用 1.5 MP 又怕崩图 | 先试 1.25 MP；或挂 `anima-highres-aesthetic-boost` LoRA（阶段 3 讲） |
| 切换开关没反应 | 三个 `ComfySwitchNode` 的 `switch` 输入都要接到同一个布尔值 |
| 负向提示词在 Turbo 下没效果 | 正常。CFG 1 下负向无效，把想要的东西写进正向 |
