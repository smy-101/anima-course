# Anima × ComfyUI 工作流递进实现报告：从 9 节点文生图到多阶段调参

> 面向对象：已经读过同目录三份报告——《Anima生图学习报告》（模型与安装）、《ComfyUI节点与参数详解》（节点字典）、《Anima提示词总结报告》（提示词）——知道"节点是什么、提示词怎么写"，但**还没亲手从空白画布把工作流搭起来**，不知道先学什么后学什么、参数该按什么顺序调的学习者
> 调研时间：2026 年 11 月下旬。ComfyUI 源码以 `master` 分支 `2fcb6cef`（2026-11-23）为准；官方模板以 `Comfy-Org/workflow_templates` 仓库当日内容为准
> 资料来源：**官方 Anima 模板 JSON（逐节点解析）**、Hugging Face 模型卡与讨论区、ComfyUI 源码、Comfy Org 文档、kohya-ss 的 LLLite 说明、CircleStone Labs 的 Civitai 页面、社区文章（完整链接见附录 C）
> 配套阅读：本报告**不重复**节点字典与提示词规则，只讲"**怎么把它们连起来、先学哪一级、每一级调什么**"

---

## 0. 一页速览

### 0.1 工作流阶梯（L0 → L8）

| 级别 | 名称 | 累计节点 | 这一级学会什么 | 核心参数 |
|---|---|---|---|---|
| **L0** | 最小文生图 | 9 | 把三件套模型加载进来，跑出第一张图 | 分辨率、seed、steps、cfg |
| **L1** | 可控文生图（= 官方模板展开） | 19 | 用**开关**在 Base / Turbo 之间切换，用**分辨率选择器**定画幅 | 开关、预设步数/CFG、画幅 |
| **L2** | 可比较：批量与参数扫描 | 19 + 4~8 | 一次跑出 CFG/步数/采样器/种子的对照图 | 列表、batch、网格 |
| **L3** | 图生图与"草稿→成品" | +4~6 | 用 `denoise` 控制保留程度；Turbo 起稿、Aesthetic 定稿；LoRA 串联 | denoise、LoRA 强度 |
| **L4** | 放大与两段式 | +3~5 | 三种放大路线；放大倍率 × 二次采样 denoise | 倍率、denoise、放大模型 |
| **L5** | 结构控制（Anima LLLite） | +3~6 | 用深度图/线稿/边缘图约束构图；预处理器的选择 | strength、start/end |
| **L6** | 局部重绘与扩图 | +4~7 | 官方"空 Latent + 控制图"法与 kohya"img2img + 遮罩"法 | 遮罩扩展、提示词写法 |
| **L7** | 自定义采样与调度 | +5~12 | 把采样拆成两段、换引导器、调 shift、加 APG/NAG | 起止步、shift、引导强度 |
| **L8** | 多模型对比与流水线化 | 不定 | 模型 × 种子网格、子图封装、循环迭代、文件名模板 | — |

### 0.2 参数调参阶梯（T1 → T6）

| 阶 | 调什么 | 怎么调 | 对应级别 |
|---|---|---|---|
| **T1** | 单变量标量：seed → 分辨率 → steps → cfg → 采样器 → 调度器 | 固定其它一切，一个一个扫 | L0–L2 |
| **T2** | 双变量网格：步数 × CFG、采样器 × 调度器、种子 × 模型 | 列表 + batch 两个维度 | L2、L8 |
| **T3** | 结构参数：denoise、LoRA 强度、LLLite strength / 生效区间 | 先粗后细，先 0.5 步长再 0.1 | L3–L6 |
| **T4** | 时间表参数：shift、调度器、某一段强制 CFG、分段采样 | 只在 T1–T3 调好后碰 | L7 |
| **T5** | 多阶段：放大倍率 × 二次采样 denoise × 每段模型；两段放大；重绘遮罩 | 每段单独验收，再串起来 | L3–L6 |
| **T6** | 自动化：循环迭代、批量队列、文件名变量、On Change | 让工作流替你跑重复实验 | L8 |

### 0.3 四条纪律（贯穿全部级别）

1. **固定种子**（K采样器 seed 右侧控件设为 `fixed`），否则分不清是参数的功劳还是运气。
2. **一次只改一个变量**；改完用 `图像表格` 把结果拼在一张图里看。
3. **先用 Turbo 调提示词和构图，再用 Base/Aesthetic 出成品**——由模型作者"从 Turbo 起步、用它快速迭代提示词"的建议（模型卡）推出来的工作节奏（Turbo 8 步 / CFG 1，Base 30 步 / CFG 4）。
4. **固定分辨率**：噪声张量的形状跟着画布尺寸走，同一种子在 1024² 和 896×1152 下是两张不同的图。固定种子做参数对比时，**画幅也不能动**（batch 内同一 seed 的多张噪声各不相同——L2 利用的正是这一点）。

---

## 1. 这份报告解决什么、怎么读

### 1.1 四份报告的分工

| 报告 | 回答的问题 | 本报告怎么用它 |
|---|---|---|
| Anima生图学习报告 | Anima 是什么、怎么装、放哪、基本参数 | 取"三版本参数基线"（§2.1） |
| ComfyUI节点与参数详解 | 每个节点的每个参数是什么意思 | 本报告每级给出**节点清单**，参数含义不赘述，去该报告第 3 章查 |
| Anima提示词总结报告 | 提示词怎么写 | 本报告只说"每级的提示词**写什么**"（例如重绘时只写遮罩区域） |
| **本报告** | **节点怎么连、先学哪级、参数按什么顺序调** | — |

### 1.2 阅读约定

- 节点写成 **中文界面名 `英文类名`**，搜索框里输英文类名一定能找到。
- 连线写成 `谁.输出 ──▶ 谁.输入`；代码块里的图就是全部连线，照着连即可。
- 来源标注：**【官方】**模板/模型卡/文档、**【源码】**ComfyUI 代码、**【作者】**模型作者（tdrussell）在讨论区或 Civitai 的说明、**【社区】**第三方实测（仅供参考，务必自己固定种子验证）。
- 每一级都有同样的六小节：目标 / 新增节点 / 连线 / 参数与取值 / 调参顺序 / 常见问题与验收。
- **级别之间是叠加关系**：高一级总是在低一级的管线上"插入"或"追加"节点，所以请按顺序做。

### 1.3 本报告核实的"官方事实"

以下内容是本次直接解析官方文件得到的，后面各节直接引用：

| 事实 | 来源 |
|---|---|
| 官方 "Anima Base v1: Text to Image" 模板是一个**子图**，内部 17 个节点：`UNETLoader`、`CLIPLoader(type=stable_diffusion)`、`VAELoader`、`EmptyLatentImage(1024×1024, batch 1)`、`CLIPTextEncode ×2`、`LoraLoaderModelOnly(turbo-lora, 1.0)`、`ComfySwitchNode ×3`、`PrimitiveInt 30/8`、`PrimitiveFloat 4/1`、`PrimitiveBoolean(false)`、`KSampler(30 步, cfg 4, euler, simple, denoise 1)`、`VAEDecode`；子图外有 `ResolutionSelector(1:1, 1 MP, multiple=16)`、`SaveImage`、`MarkdownNote` | 【官方】`templates/image_anima_base_v1.json` |
| 官方 LLLite 三个模板（Depth / Any Control / Inpainting）共用同一个子图 "Control to Image (Anima LLLite)"：在 UNETLoader 与 Turbo LoRA 开关之间插入 `ModelPatchLoader → AnimaLLLiteApply(strength 1, start 0, end 1)`；子图对外暴露 `control_image / mask / 正负提示词 / width / height / 三个模型名 / anima_lllite_model / control_strength / start_percent / end_percent / turbo_mode / turbo_lora` | 【官方】`templates/image_anima_lllite_*.json` |
| Depth 模板的预处理：`LoadImage → ResizeImageMaskNode(按总像素 1 MP, lanczos) → Depth Anything 3 子图(LoadDA3Model: depth_anything_3_mono_large, 放 `models/geometry_estimation/`; DA3Inference: 分辨率 504, upper_bound_resize, mono; DA3Render: 输出 depth, v2_style 归一化) → PreviewImage → GetImageSize → 子图的 width/height`；另有 `ImageCompare` 对比深度图与成图 | 【官方】同上 |
| Any Control 模板的预处理：`LoadImage → Canny(0.17, 0.45) → ImageInvert → PreviewImage → ResizeImageMaskNode(1 MP) → GetImageSize → 子图`；用 `anima-lllite-any-test-like-v2` | 【官方】同上 |
| Inpainting 模板：`LoadImage → Painter（在节点上涂抹）`，`Painter.IMAGE → 子图 control_image`，`Painter.MASK → MaskPreview → 子图 mask`；用 `anima-lllite-inpainting-v2`；**Turbo 默认开启**；示例正向提示词只有 `girl with red eyes`（只描述要填的区域） | 【官方】同上 |
| Anima 在 ComfyUI 里是 **flow-matching 模型**（`ModelType.FLOW`），噪声调度用 `ModelSamplingDiscreteFlow`，**shift = 3.0**；latent 格式与 Wan2.1 相同（16 通道、8 倍下采样）；支持 bf16 / fp16 / fp32，fp16 时显存估算系数 ×1.4 | 【源码】`comfy/supported_models.py`、`comfy/model_base.py` |
| `AnimaLLLiteApply`：控制图取前 3 通道，**自动按潜空间尺寸（latent×8）做中心裁剪 + bicubic 缩放**；4 通道（inpainting）权重时 mask 用最近邻缩放并**在 0.5 处二值化**，`inpaint_masked_input` 权重会把遮罩内的原图涂黑；`strength=0` 等价于不应用；只支持单帧（T=1）；只对 `start_percent~end_percent` 对应的 sigma 区间生效 | 【源码】`comfy_extras/nodes_model_patch.py`、`comfy/ldm/anima/lllite.py` |
| `CLIPLoader` 的 `type` 下拉里**没有** `anima`；官方模板用 `stable_diffusion`，文本编码器类型由权重自动识别 | 【源码】`nodes.py` |

---

## 2. 基线：参数基线与基线管线

### 2.1 三版本参数基线（所有级别的起点）

| 参数 | Base | Aesthetic | Turbo（整模型或 Turbo LoRA） |
|---|---|---|---|
| 文件位置 | `diffusion_models/anima-base-v1.0` | `diffusion_models/anima-aesthetic-v1.0 / v1.0b / v1.1` | `diffusion_models/anima-turbo-v1.0 / v1.1`，或 `loras/anima-turbo-lora-v0.2` 挂在 Base 上 |
| steps | 30（够用）~ 50（成品） | 同左 | **8 ~ 12** |
| cfg | **4 ~ 5**（Civitai 官方接口给的范围是 3 ~ 5） | 同左 | **1**（负向提示词失效） |
| sampler / scheduler | `er_sde`（作者默认）或 `euler`（模板默认）；`euler_a` 可用更高 CFG 不烧 | `euler` 很合适 | `euler`（作者说 ER-SDE 配 Turbo LoRA 可能"太吵太糊"，看提示词） |
| 质量标签 | 建议加 `masterpiece, best quality` | 可留可不留，**禁用 `score_*`** | 不需要（蒸馏时已烘入负向） |
| 模板默认负向 | `worst quality, low quality, score_1, score_2, score_3, blurry, jpeg artifacts, sepia` | 同左但去掉 score 项 | 无效，留空即可 |
| 分辨率 | 512² ~ 1536²，约 1 MP 最佳；**宽高用 16 的倍数** | 同左 | 同左 |
| 用途 | 画师风格、训 LoRA | 出成品 | 试提示词、试构图 |

### 2.2 基线管线【基线】

后文每一级都在这条管线上改动。把它记成"**加载 → 编码 → 空画布 → 采样 → 解码 → 保存**"六段：

```
①加载   UNETLoader(anima-base-v1.0, default) ───────────────────────MODEL──▶ KSampler.model
        CLIPLoader(qwen_3_06b_base, type=stable_diffusion, device=default)
        VAELoader(qwen_image_vae)
②编码   CLIPLoader.CLIP ──▶ CLIPTextEncode(正向).clip  ──CONDITIONING──▶ KSampler.positive
        CLIPLoader.CLIP ──▶ CLIPTextEncode(负向).clip  ──CONDITIONING──▶ KSampler.negative
③画布   EmptyLatentImage(1024×1024, batch 1) ──LATENT──▶ KSampler.latent_image
④采样   KSampler(seed 固定, steps 30, cfg 4, euler, simple, denoise 1)
⑤解码   KSampler.LATENT ──▶ VAEDecode.samples      VAELoader.VAE ──▶ VAEDecode.vae
⑥保存   VAEDecode.IMAGE ──▶ SaveImage(filename_prefix = "Anima")
```

---

## 3. 工作流阶梯

### L0 最小文生图（9 个节点）

**目标**：从空白画布（`Ctrl+S` 先存一个叫 `L0` 的工作流）搭出 §2.2 的【基线】，跑出第一张图。这一级的目的不是出好图，而是**确认每个端口为什么连到那里**。

**节点清单**

| # | 节点 `类名` | 作用 | 关键参数 |
|---|---|---|---|
| 1 | UNet加载器 `UNETLoader` | 读入 2B 去噪模型 | `unet_name = anima-base-v1.0.safetensors`，`weight_dtype = default` |
| 2 | 加载CLIP `CLIPLoader` | 读入 Qwen3-0.6B 文本编码器 | `clip_name = qwen_3_06b_base.safetensors`，`type = stable_diffusion` |
| 3 | 加载VAE `VAELoader` | 读入 Qwen-Image VAE | `vae_name = qwen_image_vae.safetensors` |
| 4 | CLIP文本编码 `CLIPTextEncode`（正向） | 提示词 → 条件 | `text` |
| 5 | CLIP文本编码 `CLIPTextEncode`（负向） | 负向 → 条件 | `text` = 模板默认负向 |
| 6 | 空Latent图像 `EmptyLatentImage` | 起始画布 | `1024 × 1024`，`batch_size = 1` |
| 7 | K采样器 `KSampler` | 采样 | seed `fixed`，`steps 30`，`cfg 4`，`euler`，`simple`，`denoise 1` |
| 8 | VAE解码 `VAEDecode` | 潜空间 → 像素 | — |
| 9 | 保存图像 `SaveImage` | 写 PNG（内嵌工作流） | `filename_prefix = Anima/L0` |

**连线**：与 §2.2 完全一致，9 个节点、9 条线。

**参数与取值**

| 参数 | 取值 | 说明 |
|---|---|---|
| 画布尺寸 | 1024×1024 起步 | 宽高都必须是 8 的倍数（节点限制），**Anima 建议 16 的倍数**（官方模板 `ResolutionSelector.multiple=16`；kohya 的训练桶步长也是 16） |
| `batch_size` | 1 | 同一批次里每张的噪声不同；调参时保持 1，省显存且结果可控 |
| 正向示例 | 官方模板自带的赛博朋克肖像提示词（自然语言）或《提示词报告》附 A 模板（标签） | 两种都试一次 |
| 负向 | 模板默认那一串 | 见 §2.1 |

**调参顺序**：先什么都不调，跑通 → 固定 seed → 只换提示词跑 3 次 → 只换 seed 跑 3 次（体会"种子决定构图"）。

**常见问题与验收**

| 现象 | 原因 / 处理 |
|---|---|
| 三个加载器变红 | 文件没下或放错目录（对照《学习报告》§2.6 的目录表），放好后按 `R` |
| 下拉里没有刚放进去的文件 | 按 `R` 刷新；子文件夹里的文件可能检测不到，手动在节点里选 |
| 出图全黑 | `VAEDecode.vae` 没接 |
| 显存不足 | 降到 768×1024 一类约 0.8 MP 的尺寸；`weight_dtype` 保持 default（Anima 以 bf16 为主，fp16 的显存估算系数反而更高） |

验收：能指着每条线说出"它传的是什么类型的数据（薰衣草 MODEL / 黄 CLIP / 玫瑰 VAE / 橙 CONDITIONING / 粉 LATENT / 蓝 IMAGE）"。

---

### L1 可控文生图（19 个节点 = 官方模板的子图展开）

**目标**：把 L0 变成"**一个开关切换 Base/Turbo、一个选择器定画幅**"的可复用管线。做完这一级，你会看懂官方模板为什么那样连——因为它就是这样连的。

**新增节点（10 个）**

| 节点 `类名` | 数量 | 作用 | 官方模板里的值 |
|---|---|---|---|
| 分辨率选择器 `ResolutionSelector` | 1 | 由比例 + 总像素算出宽高 | `1:1 (Square)`，`megapixels 1`，`multiple 16` |
| 布尔值 `PrimitiveBoolean` | 1 | 总开关 `turbo_mode` | `false` |
| LoRA加载器（仅模型）`LoraLoaderModelOnly` | 1 | 挂 Turbo LoRA | `anima-turbo-lora-v0.2.safetensors`，`strength 1.0` |
| 整数 `PrimitiveInt` | 2 | 两套步数 | `30`（Full）/ `8`（Turbo） |
| 浮点数 `PrimitiveFloat` | 2 | 两套 CFG | `4` / `1` |
| 切换 `ComfySwitchNode` | 3 | 分别切 MODEL / INT / FLOAT | `switch` 都由同一个布尔值驱动 |

**连线**（在 L0 基础上改动三处）

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

> `ComfySwitchNode` 是**惰性求值**：只有被选中的那一路会被执行（《节点详解》3.8）。所以关着 Turbo 时，Turbo LoRA 那一路不会被计算，也就不会加载进显存。

**参数与取值**

`ResolutionSelector` 在 `multiple = 16` 时各比例的实际尺寸（本报告按源码公式计算）：

| 比例 | 0.5 MP | **1.0 MP（模板默认）** | 1.5 MP |
|---|---|---|---|
| 1:1 | 720×720 | **1024×1024** | 1248×1248 |
| 2:3 / 3:2 | 592×880 / 880×592 | **832×1248 / 1248×832** | 1024×1536 / 1536×1024 |
| 3:4 / 4:3 | 624×832 / 832×624 | **880×1184 / 1184×880** | 1088×1456 / 1456×1088 |
| 9:16 / 16:9 | 544×960 / 960×544 | **768×1360 / 1360×768** | 944×1680 / 1680×944 |
| 21:9 | 1104×480 | 1568×672 | 1920×816 |

| 开关 | Full（false） | Turbo（true） |
|---|---|---|
| 模型 | Base | Base + Turbo LoRA（或把 UNETLoader 换成 `anima-turbo-v1.1` 整模型并关掉 LoRA） |
| steps / cfg | 30 / 4 | 8 / 1 |
| 负向提示词 | 有效 | 无效 |
| 适用 | 出成品 | 试提示词 |

**调参顺序**：`turbo_mode` 开 → 填提示词 → 换 seed 找构图（8 步一张，很快）→ 关 `turbo_mode`，同 seed、同提示词出成品 → 比较 Turbo LoRA 强度 1.0 / 0.8 / 0.7（作者说低到 0.7 仍能保持蒸馏，更高多样性）。

**常见问题与验收**

| 现象 | 原因 / 处理 |
|---|---|
| 开 Turbo 后"AI 味"很重 | 作者建议：降 LoRA 权重、去掉质量标签、正向加 `anime coloring` |
| 开 Turbo 后线条发噪发糊 | 别用 `er_sde`，换 `euler`（作者说明） |
| 想用 1.5 MP 又怕崩图 | 先试 1.25 MP；或挂 `anima-highres-aesthetic-boost` LoRA（见 L4） |
| 切换开关没反应 | 三个 `ComfySwitchNode` 的 `switch` 输入都要接到同一个布尔值 |

验收：拖动官方模板 "Anima Base v1" 进画布，双击子图，确认**你自己搭的和子图内部一致**（节点、数值、连线逐条对照）。

---

### L2 可比较：批量与参数扫描（L1 + 4~8 个节点）

**目标**：让工作流**替你做实验**——一次运行出 CFG 3/3.5/4/4.5/5 的对照图，或 4 个种子 × 3 个采样器的网格。这是后面所有调参的基础设施。

**新增节点**

| 节点 `类名` | 作用 | 关键参数 |
|---|---|---|
| 创建列表 `CreateList` | 把 N 个同类型值合成列表；下游会对**每一项各跑一次** | 把要扫的值逐个接入 |
| 浮点数 / 整数 / 字符串（多行） `PrimitiveFloat` / `PrimitiveInt` / `PrimitiveStringMultiline` | 列表的来源 | — |
| 通用 Primitive `PrimitiveNode` | 值类型可选 **COMBO**，用来驱动 `sampler_name` 这类下拉控件（官方 `anima_comparison.json` 就这么做） | `er_sde` |
| 图像表格 `ImageGrid`（界面名"Make Image Grid"，实验性，`image/batch` 分类） | 把一批图排成网格；**直接接 batch 张量即可，会自动拆成单元格** | `columns`、`cell_width/height 256`、`padding 4` |
| 绘制文本叠加 `TextOverlay` | 在图上写字，给对照图标参数值 | `text`、`font_size`（图高的百分比）、`position top/bottom`、`align`、`outline` |
| 图像对比 `ImageCompare` | 滑块对比两张 | `image_a`、`image_b` |
| 预览图像 `PreviewImage` | 只显示不落盘 | — |

**连线 A：一维扫描（以 CFG 为例）**

```
PrimitiveFloat(3.0)  ─┐
PrimitiveFloat(3.5)  ─┤
PrimitiveFloat(4.0)  ─┼─▶ CreateList ──FLOAT[]──▶ KSampler.cfg（把控件拖成输入口）
PrimitiveFloat(4.5)  ─┤
PrimitiveFloat(5.0)  ─┘
KSampler(seed 固定).LATENT ──▶ VAEDecode ──IMAGE──▶ ImageGrid(columns=5) ──▶ SaveImage("Anima/L2_cfg")
```

运行一次得到一张 5 格的拼图，**顺序 = 列表顺序**。同样的办法：列表接 `KSampler.steps`（20/30/40）、接 `CLIPTextEncode.text`（多条提示词）、用 `PrimitiveNode(COMBO)` 接 `KSampler.sampler_name`、接 `KSampler.scheduler`。

**连线 B：二维网格（种子 × 参数）**

```
EmptyLatentImage.batch_size = 4        ← 同一 seed 下 batch 内每张噪声不同，相当于 4 个种子
CreateList(5 个 cfg) ──▶ KSampler.cfg
KSampler.LATENT ──▶ VAEDecode ──▶ ImageGrid(columns=4)   ← 列数 = batch 数
```

每个 cfg 值各跑一次、每次得到 4 张 → `ImageGrid` 收到 5 组 × 4 张，按"cfg 优先"的顺序铺开：**行 = cfg，列 = 种子**。

**连线 C：带标签的对照（≤ 6 个变体时最稳妥）**

列表法里 `TextOverlay` 的文字对每个分支都一样，所以需要标注时，直接复制 K采样器 分支：

```
KSampler(cfg=3.0) ──▶ VAEDecode ──▶ TextOverlay("cfg 3.0") ─┐
KSampler(cfg=3.5) ──▶ VAEDecode ──▶ TextOverlay("cfg 3.5") ─┼─▶ ImageGrid(columns=3) ──▶ SaveImage
KSampler(cfg=4.0) ──▶ VAEDecode ──▶ TextOverlay("cfg 4.0") ─┘
```

三个 K采样器 共用同一个 MODEL / CLIP / CONDITIONING / LATENT，只是 cfg 不同——这是"一次只改一个变量"最直观的形态。

**参数与取值**

| 扫描对象 | 建议取值 | 看什么 |
|---|---|---|
| cfg | 3 / 3.5 / 4 / 4.5 / 5 / 6 | 过饱和、线条发硬 = 烧了 → 降；特征缺失 → 小幅升 |
| steps | 10 / 20 / 30 / 40 / 50 | 30 之后边际收益；Turbo 看 6/8/10/12 |
| sampler | `euler` / `er_sde` / `euler_a` / `dpmpp_2m_sde_gpu` / `res_multistep` / `uni_pc` | 线条、平涂程度、细节（风格差异明显） |
| scheduler | `simple` / `sgm_uniform` / `beta` / `karras` / `ddim_uniform` | 影响小于采样器；`res_multistep + beta` 有人报告波点伪影 |
| batch_size | 2 ~ 4 | 越大越吃显存 |

**调参顺序**：先 B（种子 × cfg）确定 cfg 甜点 → 再扫采样器 → 最后扫调度器。所有扫描都用同一条提示词、同一个 seed。

**常见问题与验收**

| 现象 | 原因 / 处理 |
|---|---|
| 列表接上去后只跑了一张 | 确认连到 `CreateList` 的输出而不是某个 Primitive 的输出；`ImageGrid` 要接 `VAEDecode` 的 IMAGE |
| 找不到 `ImageGrid` | 它是实验性节点，在节点库 `image/batch` 下，搜索 "grid" 或类名；旧版本可能没有 |
| 网格太小看不清 | `cell_width/height` 调到 512，或减少列数 |
| 带 `_cfg_pp` 后缀的采样器出图"炸" | CFG++ 采样器要在 **CFG < 2**（推荐 1.5）下用，4.5 必烧（HF 讨论区回复） |

验收：手里有一张自己出的"CFG × 种子"网格图和一张"采样器"对照图，并能说出自己这张图上**最好的 cfg 与采样器**。

---

### L3 图生图与"草稿 → 成品"（L1 + 4~6 个节点）

**目标**：学会 `denoise`——图生图唯一的"保留程度"旋钮；并把"Turbo 起稿、Aesthetic 定稿"做成一条管线；顺带把 LoRA 串起来。

**新增节点**

| 节点 `类名` | 作用 | 关键参数 |
|---|---|---|
| 加载图像 `LoadImage` | 读入起点图；右键可在蒙版编辑器里涂遮罩（L6 用） | 文件放 `ComfyUI/input/` |
| 调整图像/掩码大小 `ResizeImageMaskNode` | 把输入图缩到模型舒适区分辨率（**输入图的尺寸就是输出尺寸**，大图直接编码会崩构图） | `resize_type = scale total pixels`，`megapixels 1.0`，`scale_method lanczos` |
| VAE编码 `VAEEncode` | 像素 → 潜空间 | `pixels`、`vae` |
| K采样器 `KSampler`（第二个） | 图生图采样 | `denoise` |
| LoRA加载器（仅模型）`LoraLoaderModelOnly`（可再串多个） | 风格 / 角色 LoRA | `strength_model` |

**连线 A：基础图生图**（在 L1 上只改一处：起始画布从"空白"换成"你的图"）

```
LoadImage.IMAGE ──▶ ResizeImageMaskNode(1 MP, lanczos).resized ──IMAGE──▶ VAEEncode.pixels
VAELoader.VAE ──▶ VAEEncode.vae
VAEEncode.LATENT ──LATENT──▶ KSampler.latent_image        （EmptyLatentImage 删掉；ResolutionSelector 不再起作用）
KSampler.denoise = 0.4 ~ 0.6
```

**连线 B：Turbo 起稿 → Aesthetic 定稿**（两个 UNet加载器、两个 K采样器）

```
// 方式 1：种子迁移（作者建议从 Turbo 起步、用它快速迭代提示词；成品换 Aesthetic）
UNETLoader(anima-turbo-v1.1).MODEL ──▶ KSampler①(8 步, cfg 1, seed 固定)
找到满意的 seed 后：UNETLoader 换成 anima-aesthetic-v1.1，KSampler 改 30 步 / cfg 4，seed 不变
（Turbo 与 Aesthetic 同架构、同文本编码器，同 seed 的构图往往相近，但不保证相同）

// 方式 2：潜空间精修（保留 Turbo 那张的构图）
UNETLoader(anima-turbo-v1.1).MODEL ──────────────────────────▶ KSampler①.model      (8 步, cfg 1, denoise 1)
KSampler①.LATENT ──LATENT──▶ KSampler②.latent_image
UNETLoader(anima-aesthetic-v1.1).MODEL ──▶ KSampler②.model     (denoise 0.35 ~ 0.5, 30 步, cfg 4)
KSampler②.LATENT ──▶ VAEDecode ──▶ SaveImage
```

> 方式 2 的 denoise 越低越像 Turbo 那张（含它的"默认风格"）；Turbo 的默认风格很强，想摆脱它就用方式 1 重新生成。

**连线 C：LoRA 串联**

```
UNETLoader.MODEL ──▶ LoraLoaderModelOnly①(风格 A, 0.8).MODEL ──▶ LoraLoaderModelOnly②(角色 B, 1.0).MODEL ──▶ KSampler.model
```

Anima 是拆分模型，**只用 `LoraLoaderModelOnly`**（`LoraLoader` 的 clip 输入是必填，没接会报缺少输入）。A/B 某个 LoRA：选中它按 `Ctrl+B`（忽略 = 数据透传）。

**参数与取值**

| `denoise` | 效果 | Anima 上的观察 |
|---|---|---|
| 1.0 | 等于文生图，只借尺寸 | — |
| 0.7 ~ 0.9 | 换风格、换内容，保留大致构图 | — |
| 0.4 ~ 0.6 | 细化：结构不变、细节重画 | 二次采样常用区间 |
| 0.2 ~ 0.35 | 微调 | 社区经验：Anima 在这个区间"只补细节不改五官"；超过 0.4 就会出现该闭的嘴张开、莫名出汗这类改动（nobin） |

> `denoise` **不会减少步数**（《节点详解》3.4，源码 `KSampler.set_steps`：先按 `int(steps/denoise)` 生成更细的时间表再取后段）：30 步 + denoise 0.35 仍是 30 步，不必为此加 steps。会减步数的是 L7 的 `KSamplerAdvanced` 起止步与 `SplitSigmasDenoise`。

| 官方 LoRA（`circlestone-labs/Anima-Official-LoRAs`） | 用法 | 作者说明 |
|---|---|---|
| `anima-turbo-lora-v0.1 / v0.2` | CFG 1、8–12 步；`strength` 0.7 ~ 1.0 | v0.2 在 base-v1.0 上训练，"细节更自然"；降到 0.7 仍保持蒸馏；用 `euler`，`er_sde` 可能太吵 |
| `anima-highres-aesthetic-boost` | 出高分辨率时挂上，`strength` 1.0 | 1536 基本无问题，甚至 2048（4 MP）也不散架；美学提升"较弱、看提示词"；v1.0 版说明写的是在 preview3 上训练 |
| `anima-rl-v0.1` | 默认 1.0；配强的美学微调模型时可能要略高于 1 | 强化美学与细节的 RL 实验版；在 preview3 上训练 |
| `anima-greg-rutkowski-style` | 提示词前缀 `@greg rutkowski. `，自然语言提示词效果最好 | 风格 LoRA 示例，附带训练配置 |

| 强度 | 经验 |
|---|---|
| 风格 LoRA | 0.6 ~ 1.0（Civitai 官方接口给的典型范围） |
| 角色 / 概念 LoRA | 偏高，1.0 起 |
| 训练于 Base 的 LoRA 用在 Aesthetic 上 | 可能被"稀释"，必要时略升强度 |

**调参顺序**：先用 B 的 denoise 扫一遍（0.2 / 0.35 / 0.5 / 0.7 / 1.0，用 L2 的列表法）→ 再上 LoRA，每个 LoRA 单独 Bypass 看贡献 → 最后做 Turbo→Aesthetic 的两段。

**常见问题与验收**

| 现象 | 原因 / 处理 |
|---|---|
| 图生图后构图面目全非 | denoise 过高，或输入图没缩到约 1 MP |
| 想保留原图颜色但总在变 | denoise ≤ 0.35；或改用 L5 的"控制图"方式 |
| LoRA 没效果 | 文件是否标注"兼容 Anima"；是否忘了保存后按 `R`；强度是否太低 |
| 两个 LoRA 风格互相打架 | 降其中一个到 0.6 ~ 0.7，或分两段采样各挂一个 |

验收：同一张输入图在 denoise 0.2 / 0.5 / 0.8 三档各出一张并排；一张"Turbo 起稿 → Aesthetic 精修"的成图。

---

### L4 放大与两段式（L3 + 3~5 个节点）

**目标**：在约 1 MP 定构图，再放大补细节。学会三条放大路线和 Anima 的倍率上限。

**新增节点**

| 节点 `类名` | 作用 | 关键参数 |
|---|---|---|
| 缩放Latent（比例）`LatentUpscaleBy` | 潜空间直接放大 | `upscale_method bislerp / bicubic`，`scale_by 1.5` |
| 加载放大模型 `UpscaleModelLoader` + 使用模型放大图像 `ImageUpscaleWithModel` | AI 放大模型（会重建细节，内部自动分块） | 模型放 `models/upscale_models/` |
| 缩放图像（比例）`ImageScaleBy` / 调整图像/掩码大小 `ResizeImageMaskNode` | 纯数学放大或缩到目标像素 | `lanczos` |
| VAE解码（分块）`VAEDecodeTiled` | 大图解码不爆显存 | `tile_size 512`、`overlap 64` |
| K采样器（第二个） | 二次采样 | `denoise 0.35 ~ 0.45`，`steps 20 ~ 30` |

**三条路线**

```
// A. 只放大不重画（最快）
KSampler①.LATENT ──▶ VAEDecode① ──▶ ImageUpscaleWithModel(4x 动漫向模型) ──▶ SaveImage

// B. Latent 放大 + 二次采样（最常用；官方"两段式"）
KSampler①.LATENT ──▶ LatentUpscaleBy(scale_by 1.5, bislerp) ──LATENT──▶ KSampler②.latent_image (denoise 0.4)
KSampler②.LATENT ──▶ VAEDecode ──▶ SaveImage
（KSampler② 的 model 线上可挂 anima-highres-aesthetic-boost；可换成 Aesthetic 模型）

// C. 像素放大 + 图生图（社区称 Hires.Fix：放大模型 + Refiner）
KSampler①.LATENT ──▶ VAEDecode① ──▶ ImageUpscaleWithModel ──▶ ResizeImageMaskNode(目标总像素) ──▶ VAEEncode②
VAEEncode②.LATENT ──▶ KSampler②.latent_image (denoise 0.35 ~ 0.45)
KSampler②.LATENT ──▶ VAEDecode② ──▶ SaveImage
```

C 比 B 多一次编解码，但更稳定（不直接插值潜空间），而且放大模型先把边缘处理干净，二次采样更容易"顺着画"。社区（HKMC_AILab）的 Anima 推荐做法就是 **Hires.Fix + Refiner**：C 路线之后，再在原分辨率做一次 denoise 0.2 ~ 0.3 的 Refiner，最后过脸部/手部修复。

**D. 分块放大（Tiled）——要 2K/4K 时的正路**

A~C 都受"单段 ≤ 1.5×"限制。突破上限的标准做法是**先放大、再分块低 denoise 重绘、拼回**：每块都在模型的舒适分辨率内，整图就不烧；代价是接缝，需要块间重叠和接缝修复。社区标准节点 `UltimateSDUpscale`（`ssitu/ComfyUI_UltimateSDUpscale`，Manager 搜 `comfyui_ultimatesdupscale`）把这一整套打包成一个节点：

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

调参顺序：1024² 底图先 → 2048² 验收 → 接缝明显就加 `tile_padding` 或开 `seam_fix` → denoise 0.3 / 0.4 / 0.5 扫一遍（每块重绘强度，过高会改细节）。参数详解见《节点详解》§4.6 E。

**放大之后**：① 轻度锐化 `ImageSharpen`（`sharpen_radius` 1~2、`alpha` 0.3~0.5 起步，平涂画风极易过头）；② `ImageCropV2` 做最终构图裁切；③ `SaveImage` 只输出 PNG（无损但大），交付用的 JPEG/WebP 在 ComfyUI 外批转最省事；④ 脸 / 手问题在放大**之前**解决（L6 路线 E），放大后再修会把接缝和风格差一并放大。

**Anima 的倍率上限**【社区与作者在 HF 讨论区 #163、#204、#165 的答复】

| 起点 | 单段放大倍率 | 说明 |
|---|---|---|
| 1024² 左右（约 1 MP） | **≤ 1.5×**（→ 1536²，2.36 MP） | 超过容易"烧图" |
| 1536² 或 1024~1536 之间 | **约 1.3×** | 再高出现伪影 |
| 想要 2048² 以上 | **分两段**：先 1.5×，第二段直接指定目标尺寸 | 社区实测"单段 hires 上限约 1.5×" |
| 挂 `anima-highres-aesthetic-boost` | 直接出 1536²（甚至 2048²） | 作者说明；效果看提示词 |

常用尺寸（按 16 取整）：1024×1024 → ×1.25 = 1280×1280（1.64 MP）→ ×1.5 = 1536×1536（2.36 MP）→ ×2 = 2048×2048（4.19 MP）；896×1152 → ×1.5 = 1344×1728（2.32 MP）。

**二次采样的 denoise**（综合社区经验，起点 0.35 ~ 0.4）

| denoise | 效果 |
|---|---|
| 0.15 ~ 0.25 | 几乎不改，只锐化线条（官方 Z-Image-Turbo 放大模板给的"贴近原图"区间） |
| **0.35 ~ 0.45** | 补细节、不改构图——**Anima 起步值** |
| 0.5 ~ 0.6 | 明显重绘，五官/表情可能变 |
| > 0.6 | 构图漂移；Anima 不建议 |

**放大模型怎么选**：写实向的 4x-ESRGAN 会把平涂线条锐化过头；动漫插画优先选专门的模型（社区反馈 `4x_IllustrationJaNai_V1_ESRGAN_135k` 在 Anima 上干净，其它写实放大器在浅色区域出噪点）。放大前不要试图用放大修手崩、多指——先用 L6 重绘修掉再放大。

**调参顺序**：先固定倍率 1.5，用 L2 的列表法扫 denoise 0.3 / 0.4 / 0.5 → 满意后比较 B 与 C → 需要更大图再做两段。倍率与 denoise 可以做二维网格：`CreateList → LatentUpscaleBy.scale_by` × `CreateList → KSampler②.denoise`。

**常见问题与验收**

| 现象 | 原因 / 处理 |
|---|---|
| 放大后整张泛油、过饱和 | denoise 或 cfg 过高；二次采样 cfg 保持 4，denoise 降到 0.35 |
| 出现波点/网格状伪影 | 社区报告与 `res_multistep + beta` 及倍率过大有关；换 `euler/simple`，倍率先 1.25× |
| VAE 解码爆显存 | 换 `VAEDecodeTiled` |
| 放大后线条变糊 | 路线 B 的 bislerp 插值太软 → 改用路线 C（放大模型） |

验收：同一张 1024² 底图，A/B/C 三条路线各出一张 1536² 并排；能说出三条路线在"细节 / 风格保持 / 耗时"上的差别。

---

### L5 结构控制：Anima LLLite（L1 + 3~6 个节点）

**目标**：用一张"控制图"（深度图、线稿、边缘图、涂鸦）约束构图。Anima 不走 SD 系的"应用ControlNet"（改条件），而是走 **模型补丁**（改 MODEL），节点接在 UNETLoader 与 K采样器 之间。

**新增节点**

| 节点 `类名` | 作用 | 关键参数 |
|---|---|---|
| 加载模型补丁 `ModelPatchLoader` | 读 `models/model_patches/` 下的 LLLite 权重 | `name` |
| 应用 Anima LLLite `AnimaLLLiteApply`（实验性） | 把控制图注入模型 | `strength 1.0`、`start_percent 0`、`end_percent 1`、可选 `mask` |
| 获取图像尺寸 `GetImageSize` | 让输出画布 = 控制图尺寸 | — |
| 预处理器 | 原图 → 控制图 | 见下表 |

**连线**（官方 "Control to Image (Anima LLLite)" 子图的骨架）

```
LoadImage.IMAGE ──▶ 预处理器 ──▶ ResizeImageMaskNode(1 MP, lanczos).resized ──┬──IMAGE──▶ AnimaLLLiteApply.image
                                                                                  └──IMAGE──▶ GetImageSize
GetImageSize.width / height ──INT──▶ EmptyLatentImage.width / height
预处理器输出 ──▶ PreviewImage（看控制图长什么样）
UNETLoader.MODEL ──MODEL──▶ AnimaLLLiteApply.model
ModelPatchLoader(anima-lllite-xxx).MODEL_PATCH ──▶ AnimaLLLiteApply.model_patch
AnimaLLLiteApply.MODEL ──▶ （L1 的 ComfySwitch / LoraLoaderModelOnly）──▶ KSampler.model
VAEDecode.IMAGE ──▶ ImageCompare.image_b；ResizeImageMaskNode.resized ──▶ ImageCompare.image_a（左右对比）
```

**为什么要 `GetImageSize` → `EmptyLatentImage`**：`AnimaLLLiteApply` 会把控制图**中心裁剪到输出潜空间的宽高比**再 bicubic 缩放到 latent×8。让画布尺寸等于控制图尺寸，就不会被裁掉边。

**可用权重与控制图约定**【官方模型卡，kohya-ss】

| 文件 | 训练代际 | 控制图长什么样 | 备注 |
|---|---|---|---|
| `anima-lllite-inpainting-v2` | **Base v1.0** | RGB 原图 + 1 通道 mask（白 = 重绘区） | L6 用 |
| `anima-lllite-any-test-like-v2` | **Base v1.0** | 线稿 / 涂鸦（HED、PiDiNet）/ 灰度图 的混合 | 官方模板喂的是 **Canny 取反**（白底黑线）；最通用 |
| `anima-lllite-depth-1` | Preview3 时代 | 深度图：**白 = 近，黑 = 远**（Depth Anything V2/V3 风格） | 在 v1.0 上"质量略降但仍可用" |
| `anima-lllite-lineart-1` | Preview3 时代 | 白底黑线的线稿 | 同上 |
| `anima-lllite-scribble-1` | Preview3 时代 | 黑底白线的涂鸦 | 同上 |
| `anima-lllite-pose-1` | Preview3 时代 | DWPose 标准输出（彩色骨架 + 脸/手关键点） | **效果明显弱于其它几种**，当"软先验"用 |

**预处理器怎么选**

| 想要的控制 | 预处理器 | 在哪 |
|---|---|---|
| 边缘/线稿（最省事） | `Canny(0.17, 0.45) → ImageInvert` → 配 `any-test-like-v2` | 核心；官方 Any Control 模板 |
| 深度 | "Image Depth Estimation (Depth Anything 3)" 子图（模型 `depth_anything_3_mono_large.safetensors` 放 `models/geometry_estimation/`；DA3Render 输出 `depth`、归一化 `v2_style`）→ 配 `depth-1` | 核心；官方 Depth 模板；节点库 → Comfy Blueprints → Preprocessors |
| 深度（备选） | Depth Anything V2 / Lotus / MoGe 蓝图 | 节点库 → Comfy Blueprints → Preprocessors |
| 姿势 | DWPose（社区 `comfyui_controlnet_aux`）；核心的 SDPose 蓝图输出格式与训练用的 DWPose 不同，需实测 | 社区 + 核心 |
| 线稿 / 涂鸦 | `comfyui_controlnet_aux` 的 Lineart / HED / PiDiNet；或 kohya 训练时用的 AniLines、MangaLineExtraction | 社区 |
| 手涂 | `Painter` 节点（L6）白底黑线直接画 | 核心 |

**参数与取值**

| 参数 | 起始 | 调法 |
|---|---|---|
| `strength` | 1.0 | 不听话 → 1.2 ~ 1.5；太死板、纹理像控制图 → 0.6 ~ 0.8（kohya：控制太强就降 strength 或缩小区间）；`0` 等于不应用 |
| `start_percent` | 0 | 结构控制一般从 0 开始 |
| `end_percent` | 1.0 | 想让模型自由收尾 → 0.8 ~ 0.9（通用 ControlNet 经验，Anima 需实测） |
| `mask`（3 通道权重） | 不接 | 接了也会被忽略（源码：非 4 通道权重强制 `mask=None`） |
| `mask`（inpainting 权重） | 必接 | 在 0.5 处二值化；软边无效，所以要**涂大一圈** |

多个 LLLite 可以**串联**（例如姿势 + 深度）：前一个 `AnimaLLLiteApply.MODEL` 接后一个的 `model`，各自有独立的 strength 与生效区间；强度是相加的，别都拉满。

**调参顺序**：`PreviewImage` 先确认控制图本身是对的（深度图近白远黑、线稿白底黑线）→ strength 0.8 / 1.0 / 1.2 → end_percent 1.0 / 0.85 → 最后才动 start_percent。

**常见问题与验收**

| 现象 | 原因 / 处理 |
|---|---|
| `ModelPatchLoader` 变红 | 文件放错目录（必须 `models/model_patches/`），放好按 `R` |
| 控制图边缘被裁 | 没把 `GetImageSize` 接到 `EmptyLatentImage`，画布比例与控制图不一致 |
| 控制太弱 | 换 v2 代权重（any / inpainting）；Preview3 代的四种在 v1.0 上本来就弱；或提高 strength |
| 控制图的花纹出现在成图里 | strength 过高，或控制图分辨率远高于输出（先缩到 1 MP） |
| 想同时保留原图颜色 | LLLite 只管结构；把控制图 `VAEEncode` 后作为 `latent_image` 并用 denoise 0.3 ~ 0.5（即 L3 + L5 叠加） |

验收：同一张原图分别用 Canny 与深度两种控制，各出一张与控制图并排（`ImageCompare`）的对比图。

---

### L6 局部重绘与扩图（L5 + 4~7 个节点）

**目标**：只重画画面的一块（修手、换表情、加物件），或向外扩画布。Anima 有两条官方/作者认可的路线，各有适用场景。

**新增节点**

| 节点 `类名` | 作用 | 关键参数 |
|---|---|---|
| 画板 `Painter` | 在节点里直接涂抹，输出 IMAGE + MASK（MASK = 涂过的区域） | `image` 可选（叠在原图上画） |
| 蒙版编辑器（`LoadImage` 右键 → 在蒙版编辑器中打开） | 在原图上精涂，遮罩从 `LoadImage.MASK` 输出 | 画笔 / 橡皮 / 油漆桶 / 反转 |
| 扩展遮罩 `GrowMask` | 遮罩向外扩几像素，保证边缘完整覆盖 | `expand 4 ~ 16`，`tapered_corners` |
| 羽化遮罩 `FeatherMask` | 四边羽化 | `left/top/right/bottom` |
| VAE编码（局部重绘）`VAEEncodeForInpaint` | 编码时带上"遮罩外不变"的信息 | `grow_mask_by 6` |
| 设置Latent噪波遮罩 `SetLatentNoiseMask` | 给普通 `VAEEncode` 的结果加噪波遮罩 | — |
| 预览遮罩 `MaskPreview` | 看遮罩 | — |
| 外补画板 `ImagePadForOutpaint` | 四周补边，输出补边后的图 + 新区域的 MASK | `left/top/right/bottom`，`feathering 40` |
| 图像裁剪 `ImageCropV2` / 裁剪遮罩 `CropMask` / 合成图像（遮罩）`ImageCompositeMasked` | "裁剪法"：把小区域放大到整张画布重绘再贴回 | — |

**路线 A：官方 Inpainting 模板（空 Latent + 控制图）**

```
LoadImage.IMAGE ──▶ ResizeImageMaskNode(≤ 1 MP).resized ──IMAGE──▶ Painter.image
Painter.IMAGE ──IMAGE──▶ AnimaLLLiteApply.image（走 L5 的连线）
Painter.MASK  ──MASK───▶ MaskPreview（看一眼）──▶ AnimaLLLiteApply.mask
ModelPatchLoader(anima-lllite-inpainting-v2).MODEL_PATCH ──▶ AnimaLLLiteApply.model_patch
EmptyLatentImage 尺寸 = 原图尺寸（官方模板留默认 1024×1024，并在便签里提醒把过大的输入先缩到约 1 MP；更稳的做法是用 GetImageSize 把尺寸对齐）；Turbo 开；denoise 1
提示词只写"遮罩里要出现的东西"（模板示例：girl with red eyes）
```

原理：inpainting 权重是 4 通道的——被涂的区域在控制图里被涂黑，模型靠 mask 知道"这里要重画、其它地方照抄"。画布从纯噪声开始，**整张图都是重新生成的**，只是未遮罩区域被控制图强烈约束。

**路线 B：kohya 推荐的 img2img + 遮罩（保色）**

```
// 遮罩：从 LoadImage 的蒙版编辑器涂（LoadImage.MASK 输出），向外扩一圈并预览
LoadImage.MASK ──▶ GrowMask(expand 8).MASK ──┬──MASK──▶ MaskPreview
                                          ├──MASK──▶ VAEEncodeForInpaint.mask
                                          └──MASK──▶ AnimaLLLiteApply.mask
// 原图：缩到约 1 MP 后同时走两路
LoadImage.IMAGE ──▶ ResizeImageMaskNode(1 MP).resized ──┬──IMAGE──▶ VAEEncodeForInpaint.pixels
                                                        └──IMAGE──▶ AnimaLLLiteApply.image
VAELoader.VAE ──▶ VAEEncodeForInpaint.vae
VAEEncodeForInpaint.LATENT ──LATENT──▶ KSampler.latent_image (denoise 1)
// LLLite 侧与路线 A 相同：ModelPatchLoader(inpainting-v2) ──▶ AnimaLLLiteApply.model_patch；AnimaLLLiteApply.MODEL ──▶ KSampler.model
```

注意路线 B 的 `AnimaLLLiteApply` 接的是 **GrowMask 之后的 mask**（LLLite 会在 0.5 处二值化，而 `VAEEncodeForInpaint` 的噪波遮罩可以是软边）。

kohya 的说明：**建议 img2img 时配合 mask 使用，否则颜色会略有偏移**。这条路线里画布是原图的潜空间，未遮罩区域真正"原样保留"，色偏最小；代价是构图自由度低一点。

**路线 C：没有 LLLite 时的通用重绘**（效果弱，应急用）

```
LoadImage.IMAGE ──▶ VAEEncodeForInpaint(pixels, vae, mask, grow_mask_by 6) ──▶ KSampler(denoise 1)
或：LoadImage.IMAGE ──▶ VAEEncode ──▶ SetLatentNoiseMask(mask) ──▶ KSampler
```

**路线 D：裁剪法（小区域重绘细节最好）**

```
LoadImage.IMAGE ──▶ ImageCropV2(x,y,w,h，四周留余量) ──▶ ResizeImageMaskNode(放大到约 1 MP) ──▶ 路线 A 或 B
重绘结果 ──VAEDecode──▶ ResizeImageMaskNode(缩回 w×h) ──▶ ImageCompositeMasked.source
LoadImage.IMAGE ──▶ ImageCompositeMasked.destination；x,y = 裁剪坐标；mask = 裁剪遮罩（CropMask）
```

**扩图（Outpaint）**：把"遮罩"换成外补画板给的：

```
LoadImage.IMAGE ──▶ ImagePadForOutpaint(left/top/right/bottom 各补多少) ──IMAGE──▶ 路线 A/B 的 image
                                                              └──MASK───▶ 路线 A/B 的 mask（白 = 新补的区域）
```

扩图的提示词要描述**整张画面**（不只是新区域），分辨率同样控制在约 1 MP（补边后的总尺寸）。

**参数与取值**

| 参数 | 起始 | 说明 |
|---|---|---|
| `GrowMask.expand` | 8 | LLLite 路线 mask 会二值化，软边等于没有——比目标区域**大一圈**；接缝有残影就加到 16 |
| `VAEEncodeForInpaint.grow_mask_by` | 6 | 路线 B/C 用 |
| `FeatherMask` | 8 ~ 16 | 只对路线 B/C 的噪波遮罩有意义（渐变过渡）；路线 A 不吃羽化 |
| `denoise` | 1（A/B）；0.85 ~ 1（C） | 重绘区域要完全重画 |
| 提示词 | 只写区域内容（重绘）/ 整图（扩图） | 写得越具体越好，不写"看不见的东西" |
| seed | 随机多跑几次 | 区域小的时候种子差异很大 |

**调参顺序**：先 `MaskPreview` 确认遮罩范围 → 跑路线 B（保色，最常用）→ 需要大改时用路线 A → 小区域（手、脸）用路线 D → 边缘有残影就加 `GrowMask`。

**常见问题与验收**

| 现象 | 原因 / 处理 |
|---|---|
| 重绘区与周围有接缝、有原图残影 | 遮罩太小：`GrowMask` 8 → 16；路线 B 的 `grow_mask_by` 6 → 12 |
| 没涂的地方颜色也变了 | 用的是路线 A/C；换路线 B |
| 输入图 2000×3000 直接重绘全崩 | 先 `ResizeImageMaskNode` 缩到约 1 MP，修完再放大回去（L4） |
| 扩图后新区域和原图风格不一致 | 提示词描述整图；`feathering` 加大；分两次扩（每次一边） |
| `Painter` 涂的 mask 全黑 | 涂抹后要保存；`MaskPreview` 接在 `Painter.MASK` 上确认 |

**路线 E：Detailer——让节点替你找区域、涂遮罩、重绘、贴回（社区 Impact Pack）**

路线 A~D 都要自己涂遮罩；脸崩、手崩这类"位置可预测"的问题，用 `ltdrdata/ComfyUI-Impact-Pack` 的 **`FaceDetailer` / `HandDetailer`** 更省事：检测器找出每张脸 / 每只手 → 裁出并放大到 `guide_size` → 以 `denoise`（0.4~0.5）重绘 → 羽化后贴回原图。它内部就是路线 D（裁剪法）的自动化。

| 要点 | 说明 |
|---|---|
| 安装 | **Impact Pack 与 Impact Subpack 两个都要装**：`UltralyticsDetectorProvider`（加载检测模型的节点）在 Subpack 里，V8.0 起不再随 Pack 自动安装。Impact Pack 对 ComfyUI 版本有要求（V8.24 起需 0.3.63+，以其 README 为准） |
| 检测模型 | 如 `face_yolov8m.pt`、`hand_yolov8s.pt`，放 `ComfyUI/models/ultralytics/bbox/`，可由 Manager 下载 |
| 连线 | `VAEDecode.IMAGE ──▶ FaceDetailer.image`；`UltralyticsDetectorProvider.BBOX_DETECTOR ──▶ bbox_detector`；model / clip / vae / positive / negative 与 K采样器 相同 |
| 关键参数 | `guide_size`（检测框放大到多大再重绘，约 512）、`denoise`（0.4~0.5）、`feather`（贴回羽化）、`bbox_threshold`（检测阈值，漏检就降）；正负提示词**只写这张脸 / 手该有的样子**（如 `detailed face, looking at viewer`），不写整图 |
| 输出 | `image` = 贴回后的整图；`cropped_refined` = 单独的重绘小图，接 `预览图像` 看效果 |
| 顺序 | 在放大**之前**做；修完再走 L4。先用小 `denoise`（0.35）试，不够再升 |

验收：用路线 B 给一张成图换一个表情、用路线 A 添加一个物件、用外补画板把横图扩成方图，各一张。

### L7 自定义采样与调度（L1 + 5~12 个节点）

**目标**：把 K采样器拆开——自己选引导器、自己切时间表、分两段用不同模型/不同 CFG、调 shift、叠加新的引导方式（APG / NAG / CFGNorm 等）。这一级的东西**大多没有 Anima 专项验证**，是通用工具，务必用 L2 的对照方法逐个验证。

**新增节点**

| 节点 `类名` | 作用 | 关键参数（源码默认） |
|---|---|---|
| K采样器选择 `KSamplerSelect` | 选采样器 | `sampler_name` |
| ER-SDE 采样器 `SamplerER_SDE` | `er_sde` 的可调版本（Anima 作者推荐的采样器） | `solver_type`：ER-SDE / Reverse-time SDE / ODE；`eta` 1.0（0 = 退化为确定性 ODE）；`max_stage` 3；`s_noise` 1.0 |
| 基本调度器 `BasicScheduler` | 生成 sigma 时间表 | `scheduler simple`，`steps`，`denoise 1.0` |
| 随机噪波 `RandomNoise` / 禁用噪波 `DisableNoise` | 起始噪声 | `noise_seed` |
| 基本引导器 `BasicGuider` | **只有一路条件，等效 CFG 1，少算一半** | `model`、`conditioning` |
| CFG引导器 `CFGGuider` | 正常 CFG | `model`、`positive`、`negative`、`cfg` |
| 自定义采样器（高级）`SamplerCustomAdvanced` | 执行采样 | `noise`、`guider`、`sampler`、`sigmas`、`latent_image` → `output` |
| K采样器（高级）`KSamplerAdvanced` | 按起止步切分 | `add_noise`、`start_at_step`、`end_at_step`、`return_with_leftover_noise` |
| 分离Sigma `SplitSigmas` / 分离Sigma降噪 `SplitSigmasDenoise` | 把时间表切两段 | `step` / `denoise` |
| 采样算法（SD3）`ModelSamplingSD3` | 改 flow 模型的 **shift** | `shift 3.0`（= Anima 默认） |
| CFG覆盖 `CFGOverride` | 在某段采样里强制 CFG | `cfg 1.0`，`start_percent 0`，`end_percent 1` |
| 自适应投影引导 `APG` | 投影式引导，降低高 CFG 过饱和 | `eta 1.0`、`norm_threshold 5.0`、`momentum 0.0` |
| Normalized Attention Guidance `NAGuidance` | 在 CFG > 1 时让负向"真正生效"且不烧图 | `nag_scale 5.0`、`nag_alpha 0.5`、`nag_tau 1.5` |
| `CFGNorm` / `TCFG` / `PerturbedAttentionGuidance` / `SelfAttentionGuidance` | 其它引导增强补丁 | `strength 1.0` / — / `scale 3.0` / `scale 0.5` |

**连线 ①：Turbo 用基本引导器（省一半算力）**

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

**连线 ②：两段采样（前段定构图、后段补细节）**

```
KSamplerAdvanced①(add_noise=enable, steps 30, start 0, end 15, return_with_leftover_noise=enable).LATENT
   ──LATENT──▶ KSamplerAdvanced②(add_noise=disable, start 15, end 30, return_with_leftover_noise=disable).latent_image
```

两段可以挂不同的模型补丁：例如①挂 Turbo LoRA + `CFGOverride(cfg 1)`，②用 Base + cfg 4——"前段快、后段精"（实验性：Turbo 的默认风格会带进后半段）。

> ⚠️ `start_at_step / end_at_step` 是按**全表索引**截取：steps 30、start 15 → 第二段真的只跑 15 步；想每段 30 步，两段的 steps 都设 60。这与 K采样器 `denoise` 的行为不同（后者不减步数，《节点详解》3.4）。

**连线 ③：调 shift / 叠加引导补丁（都是 MODEL 进、MODEL 出，串在加载器之后）**

```
UNETLoader.MODEL ──▶ ModelSamplingSD3(shift 3.0) ──▶ APG ──▶ NAGuidance ──▶ CFGOverride(cfg 1, start 0, end 0.1) ──▶ KSampler.model
```

**参数与取值**

| 参数 | Anima 默认 | 怎么调 | 依据 |
|---|---|---|---|
| `ModelSamplingSD3.shift` | **3.0**（源码写死） | 调高 → 更多步数留在高噪声段（构图更稳、细节更足，常用于高分辨率）；调低 → 更快更"平"。先 3 → 5 → 7 对照 | 通用 flow 模型经验；Anima 无专项数据 |
| `CFGOverride` 窗口 | 不用 | 前几步强制 cfg 1（`end_percent 0.05 ~ 0.15`）可减轻早期过饱和 | 通用技巧 |
| `APG` | `eta 1 / norm 5 / momentum 0` | 高 CFG 想不烧图时试 | 通用 |
| `NAGuidance` | `scale 5 / alpha 0.5 / tau 1.5` | **要求 CFG > 1**（它需要批里同时有正负两路，会关闭 CFG 1 优化）；Turbo 下无意义 | 通用；《提示词报告》里提到的自定义节点 Anima-NAG 的思路，现在核心已有同名实现 |
| CFG++ 采样器（`*_cfg_pp`） | — | 必须配 **CFG < 2（推荐 1.5）**，4.5 必烧 | HF 讨论区回复 |
| LLLite + shift | 3.0 | v2 权重训练时 shift = 3.0；Preview3 代的 depth / lineart / scribble 训练时是 1.0、any v1 是 4.0——这几种控制"发怪"时可对照试一下对应 shift（实验性） | kohya 模型卡 |

**调参顺序**：先用连线 ① 把 Turbo 的速度拉满 → 连线 ③ 一次只叠一个补丁、逐个 `Ctrl+B` 对照 → 最后才玩连线 ② 的分段换模型。

**常见问题与验收**

| 现象 | 原因 / 处理 |
|---|---|
| `SamplerCustomAdvanced` 报缺输入 | 五个输入全必填：noise / guider / sampler / sigmas / latent_image |
| 第二段出图是纯噪声 | ②的 `add_noise` 忘了 disable，或①的 `return_with_leftover_noise` 没 enable |
| 挂了 NAG 后速度掉一半 | 正常：它关闭了 CFG 1 优化，改成正负两路都算 |
| 找不到 `NAGuidance` / `APG` | 核心节点较新，桌面稳定版可能还没有；更新到最新版 |

验收：用连线 ① 出一张 Turbo 图并与 K采样器 版本对比耗时；用连线 ② 出一张"两段"图并能解释两段各自的参数。

---

### L8 多模型对比与流水线化（节点数不定）

**目标**：把前面所有级别**封装、复用、自动化**——做一张"模型 × 种子"对比网格；把自己的管线收成子图/蓝图；用循环节点做迭代放大；用文件名变量整理输出。

**用到的节点 / 功能**

| 节点 `类名` / 功能 | 作用 |
|---|---|
| 图像拼接 `ImageStitch` | 把 image2 接到 image1 的 right/down/left/up；**支持批次**（按索引逐张拼） |
| 图像表格 `ImageGrid` | 批次 → 网格（L2） |
| 字符串连接 `StringConcatenate` / 字符串格式化 `StringFormat` | 拼提示词前缀、拼文件名 |
| 通用 Primitive `PrimitiveNode`（COMBO） | 把 `sampler_name` 抽成共享控件 |
| 子图（选中节点 → 工具箱子图图标） | 封装成一个节点；可**发布到节点库**成为"蓝图"（Node Library → Comfy Blueprints） |
| 开始循环 `StartLoop` / 结束循环 `EndLoop`（含 `LoopIteration`） | 让一段节点循环 N 次：`iteration_index`、`is_first`、`is_last`、`current_iteration_value` |
| Run 栏：批量次数、队列模式 `Run (On Change)` | 同一工作流排队 N 次；一改参数就自动重跑 |
| `SaveImage.filename_prefix` 变量 | `%date:yyyy-MM-dd%`、`%节点名.参数%`（《节点详解》3.5） |

**连线 ①：模型 × 种子对比网格（作者 `anima_comparison.json` 的做法）**

```
共享：PrimitiveNode(Seed, fixed) ──INT──▶ 每个 KSampler.seed
      PrimitiveInt(Steps 30) ──▶ 每个 KSampler.steps      PrimitiveFloat(CFG 4) ──▶ 每个 KSampler.cfg
      PrimitiveNode(COMBO, er_sde) ──▶ 每个 KSampler.sampler_name
      EmptyLatentImage(832×1248, batch_size 4) ──LATENT──▶ 每个 KSampler.latent_image    ← 同一 seed，batch 内 4 种噪声 = 4 个"种子"
每个模型一个分支：
      UNETLoader(A).MODEL ──▶ KSamplerA ──▶ VAEDecodeA
      UNETLoader(B).MODEL ──▶ KSamplerB ──▶ VAEDecodeB
      UNETLoader(C).MODEL ──▶ KSamplerC ──▶ VAEDecodeC
拼图：
      VAEDecodeA.IMAGE ──▶ ImageStitch①.image1      VAEDecodeB.IMAGE ──▶ ImageStitch①.image2 (direction right)
      ImageStitch①.IMAGE ──▶ ImageStitch②.image1   VAEDecodeC.IMAGE ──▶ ImageStitch②.image2
      ImageStitch②.IMAGE ──▶ ImageGrid(columns = 1) ──▶ SaveImage("Anima/compare")
```

结果：**列 = 模型，行 = 种子**（4 行 3 列）。不同架构的模型（SDXL、Lumina、Newbie）也能放进同一张网格——只要每个分支自带自己的文本编码器与 VAE。作者的 Anima 分支还显式接了一个 `ModelSamplingAuraFlow(shift 3.0)`，数值等于 Anima 默认值，是为了和其它 flow 模型对齐写法。

**连线 ②：渐进放大循环（每轮 1.25× + denoise 0.35）**

```
StartLoop(mode simple, num_iterations 3).current_iteration_value ──LATENT──▶ LatentUpscaleBy(1.25)
KSampler①.LATENT ──▶ StartLoop.initial_iteration_value
循环体内：LatentUpscaleBy.LATENT ──▶ KSampler②(denoise 0.35).latent_image
          KSampler②.LATENT ──▶ EndLoop.next_iteration_value
EndLoop.output_value ──LATENT──▶ VAEDecode ──▶ SaveImage
```

循环节点把"体内"的节点复制 N 份串起来，`iteration_index` 可接到 `TextOverlay` 或文件名做标记。更简单的等价做法：直接手搭两三个 K采样器 串联（L4 的两段放大），可读性更好。

**流水线化建议**

1. 把 L1 的 19 个节点收成子图，命名 `Anima T2T`，发布为蓝图——以后每个新工作流直接从节点库拖。
2. 把 L5 + L6 的"LLLite 重绘"收成子图 `Anima Inpaint`，对外只留 image / mask / prompt / 模型名。
3. 文件名带参数：例如 `Anima/L4_hires_d[KSampler.denoise]_s[LatentUpscaleBy.scale_by]`，调参时不会混淆。
4. 调参阶段把队列模式切到 `Run (On Change)`，改一个数字就出一张。
5. 社区节点（按需）：`comfyui_controlnet_aux`（DWPose / 线稿 / HED 预处理）、ComfyUI-Manager 可装的 Impact Pack（`FaceDetailer` / `HandDetailer`，社区 Anima 流程常用）、`rgthree-comfy`（KSampler 配置预设）、`RES4LYF`（`beta57` 调度器，模型作者推荐用于绘画质感）、`ComfyUI-ppm`（NegPip，CFG 1 下用负向）。只装可信作者、用得到的。

验收：一张自己出的 3 模型 × 4 种子网格；一个发布到节点库的自制子图。

---

## 4. 参数调参阶梯（T1 → T6）

> 原则：**低阶没调好不要碰高阶**。T1 的 cfg/steps 没定，就去调 shift 和分段采样，结果无法归因。

### T1 单变量（L0–L2）

| 顺序 | 参数 | 扫描值 | 判断标准 | Anima 备注 |
|---|---|---|---|---|
| 1 | seed | 随机 4 ~ 8 个 | 构图是否可用 | 构图不行换 seed，别调参数 |
| 2 | 分辨率 / 比例 | 0.5 / 1.0 / 1.5 MP；1:1、3:4、2:3 | 是否出现重复人像、崩坏 | 约 1 MP 最佳；16 的倍数 |
| 3 | cfg | 3 / 3.5 / 4 / 4.5 / 5 / 6 | 过饱和、线条发硬 = 过高；特征缺失 = 偏低 | 甜点 3 ~ 5；`euler_a` 可略高；Turbo 固定 1 |
| 4 | steps | 20 / 30 / 40 / 50（Turbo 6 / 8 / 10 / 12） | 再加步数画面基本不变即够 | 30 够用，40 出成品 |
| 5 | sampler | `euler`、`er_sde`、`euler_a`、`dpmpp_2m_sde_gpu`、`res_multistep`、`uni_pc` | 线条、平涂度、细节 | 采样器改变画风；`res_multistep + beta` 有波点报告；CFG++ 要 CFG < 2 |
| 6 | scheduler | `simple`、`sgm_uniform`、`beta`、`karras`、`ddim_uniform` | 细微 | 影响小于采样器；`beta57` 需 RES4LYF |

### T2 双变量（L2、L8）

| 网格 | 外维（列表） | 内维（batch 或第二列表） | 读法 |
|---|---|---|---|
| cfg × 种子 | cfg 列表 | `batch_size 4` | 行 cfg、列种子；找"对多数种子都好"的 cfg |
| steps × cfg | steps 列表 | cfg 列表 | `ImageGrid(columns = cfg 个数)` |
| 采样器 × 调度器 | 采样器 COMBO 列表 | 调度器 COMBO 列表 | 固定 seed、固定 cfg 4 / 30 步 |
| 模型 × 种子 | 每个模型一个分支 | `batch_size 4` | L8 连线 ① |

### T3 结构参数（L3–L6）

| 参数 | 粗扫 | 细扫 | 注意 |
|---|---|---|---|
| img2img `denoise` | 0.2 / 0.5 / 0.8 / 1.0 | 0.1 步长 | Anima 在 ≤ 0.35 基本只补细节 |
| LoRA `strength_model` | 0.6 / 0.8 / 1.0 | 0.05 步长 | 先单独挂，再叠加；`Ctrl+B` 看贡献 |
| LLLite `strength` | 0.8 / 1.0 / 1.3 | 0.1 | 先确认控制图正确 |
| LLLite `end_percent` | 1.0 / 0.85 | 0.05 | 1.0 起步 |
| 遮罩 `GrowMask.expand` | 4 / 8 / 16 | — | 有接缝就加 |

### T4 时间表参数（L7）

| 参数 | 起始 | 范围 | 说明 |
|---|---|---|---|
| `ModelSamplingSD3.shift` | 3.0 | 2 ~ 7 | 高分辨率可试更高；LLLite v2 权重按 3.0 训练 |
| `CFGOverride` 窗口 | 不用 | 前 5% ~ 15% 强制 cfg 1 | 减轻早期过饱和 |
| `SplitSigmas` / `KSamplerAdvanced` 切点 | 50% | 30% ~ 70% | 两段用不同模型/CFG 时才需要 |
| `ManualSigmas` / `KarrasScheduler` | 不用 | — | 自定义时间表，研究用 |

### T5 多阶段（L3–L6）

| 场景 | 每段验收 | 串联后的整体检查 |
|---|---|---|
| Turbo 起稿 → Aesthetic 精修 | ①构图可用；②denoise 0.35 ~ 0.5 不改五官 | 整体风格是否仍带"Turbo 味" |
| 放大（倍率 × denoise） | 倍率先 1.25 / 1.5；denoise 0.3 / 0.4 / 0.5 | 有无过饱和、波点、构图漂移 |
| 两段放大 | 第一段 1.5×；第二段直接给目标尺寸 | 总像素是否超出舒适区（第二段 denoise 降到 0.3） |
| 重绘 → 放大 | 重绘区域无接缝 | 放大后接缝是否被放大模型"强调" |
| LLLite 控制 → 低 denoise 精修 | 控制图约束到位 | 精修阶段是否跑离控制 |

### T6 自动化（L8）

- 调参期：队列模式 `Run (On Change)`；`SaveImage` 文件名带参数变量。
- 批量期：Run 栏批量次数 N + seed `randomize`；或 `batch_size` N 一次采样。
- 迭代期：`StartLoop/EndLoop` 做渐进放大或"重绘 → 检查 → 再重绘"。
- 复用期：子图 → 发布蓝图；把 L1 / L5 / L6 各收一个。

---

## 5. 调参速查表（Anima）

| 现象 | 先调 | 再调 | 不要这样调 |
|---|---|---|---|
| 构图/人物完全不对 | seed | 提示词（对照《提示词报告》排错表） | 加步数、加 CFG |
| 画面过饱和、线条硬、"烧" | cfg ↓（3.5） | 换 `euler_a` / CFG++（CFG 1.5）/ 挂 APG | — |
| 提示词不够贴 | 关键词靠前、权重 1.5 ~ 2.0 | cfg ↑（≤ 5） | 堆负向 |
| 细节不够 | steps 40 | 换 `dpmpp_2m_sde_gpu` | 直接出 2 MP |
| 背景一片白 | 提示词写背景 / `scenery` | LLLite 深度控制 | — |
| 手崩 | L6 重绘（裁剪法） | 放大后二次采样 | 靠放大模型修 |
| 出图重复人像/构图乱 | 分辨率降到约 1 MP | 分辨率 16 倍数 | — |
| 放大后糊/花/波点 | 倍率 ↓ 1.25、denoise ↓ 0.3 | 换路线 C（放大模型） | 一次 ×2 |
| Turbo 味太重 | LoRA 强度 0.8 / 0.7 | 去质量标签、加 `anime coloring` | 加负向（无效） |
| 负向不生效 | 确认不是 Turbo / CFG 1 | `NAGuidance` | — |
| 重绘有接缝 | `GrowMask` 8 → 16 | 路线 B（img2img + mask） | 羽化（LLLite 路线无效） |
| LLLite 不听话 | strength 1.3 | 换 v2 代权重；end_percent 1.0 | 盲目加到 3 |

---

## 6. 14 天练习路径

> **三条学习路径只跟这一条**——《学习报告》§6 与《节点详解》§6 的两条 7 天路径都是它的子集（对照表见目录下 `README.md`）。但本路径是**工作流主线，不含提示词专项**：把《学习报告》Day 2–4、Day 6 的练习当作 Day 1–4 每天出图时的提示词内容。建议 Day 2 之前先读《补充A-反推标签与实验记录》，Day 14 之后按需读《补充B-开发者方向-API与自定义节点》。

| 天 | 级别 | 做什么 | 产出 |
|---|---|---|---|
| 1 | L0 | 空白画布搭 9 节点；对着端口颜色复述数据类型 | 第一张图 |
| 2 | L1 | 加开关与分辨率选择器；与官方子图逐节点对照 | `Anima T2T` 工作流 |
| 3 | L2 | cfg × 种子网格；steps 扫描 | 两张对照图 |
| 4 | L2 | 采样器 × 调度器网格；带标签的 3 分支对照 | 采样器对照图 + 自己的"参数基线" |
| 5 | L3 | img2img denoise 五档；Turbo → Aesthetic 两段 | 一张精修成图 |
| 6 | L3 | 挂两个 LoRA，`Ctrl+B` 看贡献；调强度 | LoRA 对照图 |
| 7 | 复盘 | 把前 6 天的参数基线写进 MarkdownNote；收成子图 | 自己的蓝图 v1 |
| 8 | L4 | A/B/C 三条放大路线 | 三张 1536² |
| 9 | L4 | denoise 扫描；两段放大；挂 highres LoRA | 一张 2048² |
| 10 | L5 | Canny + any-v2；Depth Anything 3 + depth-1 | 两张对比图 |
| 11 | L6 | 路线 B 换表情；路线 A 加物件；外补画板扩图 | 三张 |
| 12 | L7 | 基本引导器 Turbo；shift 3/5/7 对照；一个引导补丁 | 对照图 |
| 13 | L8 | 3 模型 × 4 种子网格；渐进放大循环 | 一张网格 |
| 14 | L8 | 从节点库拖自己的蓝图，搭"文生图 → 放大 → 重绘"完整流水线 | 成品流程 v1 |

---

## 7. 对现有三份报告的补充与勘误

| 位置 | 原文 | 补充 / 修正 | 依据 |
|---|---|---|---|
| 《提示词报告》§9 "CFG 1 下用负向" | 只列了 NegPip 与自定义节点 Anima-NAG | 核心已内置 `NAGuidance`（Normalized Attention Guidance，`comfy_extras/nodes_nag.py`），参数 `nag_scale / nag_alpha / nag_tau`；但**要求 CFG > 1**（它关闭 CFG 1 优化），Turbo 下无效 | 源码 |
| 《节点详解》3.5 图像表格 | 未说明出处 | `ImageGrid` 在 `comfy_extras/nodes_dataset.py`，实验性节点，分类 `image/batch`，可直接接 batch 张量 | 源码 |
| 《节点详解》§3 | 没有 `Painter` | 新核心节点：在节点内涂抹，输出 IMAGE + MASK；官方 Inpainting 模板用它 | 官方模板 |
| 《节点详解》2.10 | 自定义节点用 Manager 安装 | 另有 **Comfy Blueprints**（节点库 → Comfy Blueprints）：官方以子图形式提供的预处理与生成模块，含 "Text to Image (Anima Base 1.0)"、"Control to Image (Anima LLLite)"、"Image Depth Estimation (Depth Anything 3)"、SDPose 姿势图等 | workflow_templates 仓库 `blueprints/index.json` |
| 《学习报告》§5 放大 | "基础画幅别超过 1536²、倍率别超过 1.5" | 更细的说法：约 1 MP 起步 ≤ 1.5×；1536² 起步约 1.3×；更大就分两段；二次采样 denoise 起步 0.35 ~ 0.45 | HF 讨论区 #163 / #204 / #165 |
| 《学习报告》/《节点详解》`weight_dtype` | "fp8 省显存" | Anima 支持 bf16 / fp16 / fp32；源码里 fp16 的显存估算系数 ×1.4，日常保持 `default`（bf16）；fp8 可用但有画质代价 | 源码 `supported_models.py` |
| 《学习报告》§3 采样器表 | 45 种 | 社区补充：`res_multistep + beta` 可能留波点伪影；`uni_pc + ddim_uniform` 被部分人认为又快又干净（有争议）；CFG++ 系列需 CFG < 2 | HF 讨论区 #165 |
| 全部 | — | 网传 "Anima 2.9B" **不是官方版本**：官方仓库当日文件列表只有 2B 的 Base / Aesthetic / Turbo / Preview；相关"六工作流"文章自述"未实际运行验证"，引用需谨慎 | HF 文件列表 |
| 《节点详解》3.4 denoise | "前一半步数被跳过"（易被读成步数减半） | K采样器与 `BasicScheduler` 的 denoise **不减步数**：源码先按 `int(steps/denoise)` 生成时间表再取最后 `steps+1` 段；减步数的是 `KSamplerAdvanced` 起止步与 `SplitSigmasDenoise` | 源码 `comfy/samplers.py`、`comfy_extras/nodes_custom_sampler.py` |
| 《学习报告》§2.6 模型目录 | 只给了便携版路径 | 桌面版模型在共享目录 `%LOCALAPPDATA%\Comfy-Desktop\ComfyUI-Shared`（旧版 `%USERPROFILE%\ComfyUI-Shared`），不在程序目录 | docs.comfy.org 桌面版安装 / 迁移文档 |
| 《提示词报告》§11 "提示词一长就不听话" | 未说明机制 | 两路分词器 `max_length=99999999`，**ComfyUI 不截断**；过长是注意力稀释，非被切掉 | 源码 `comfy/text_encoders/anima.py` |

---

## 附录 A　节点 × 级别矩阵

| 节点 `类名` | 首次出现 | 节点 `类名` | 首次出现 |
|---|---|---|---|
| `UNETLoader` / `CLIPLoader` / `VAELoader` | L0 | `ModelPatchLoader` / `AnimaLLLiteApply` | L5 |
| `CLIPTextEncode` ×2 / `EmptyLatentImage` / `KSampler` / `VAEDecode` / `SaveImage` | L0 | `Canny` / `ImageInvert`；Depth Anything 3 子图（`LoadDA3Model` / `DA3Inference` / `DA3Render`） | L5 |
| `ResolutionSelector` / `PrimitiveBoolean` / `PrimitiveInt` / `PrimitiveFloat` / `ComfySwitchNode` / `LoraLoaderModelOnly` | L1 | `Painter` / `GrowMask` / `FeatherMask` / `VAEEncodeForInpaint` / `SetLatentNoiseMask` / `MaskPreview` / `ImagePadForOutpaint` / `ImageCropV2` / `CropMask` / `ImageCompositeMasked` | L6 |
| `CreateList` / `PrimitiveNode` / `ImageGrid` / `TextOverlay` / `ImageCompare` / `PreviewImage` | L2 | `KSamplerSelect` / `BasicScheduler` / `RandomNoise` / `BasicGuider` / `CFGGuider` / `SamplerCustomAdvanced` / `KSamplerAdvanced` / `SplitSigmas` / `ModelSamplingSD3` / `CFGOverride` / `APG` / `NAGuidance` / `CFGNorm` / `TCFG` / `PerturbedAttentionGuidance` / `SelfAttentionGuidance` | L7 |
| `LoadImage` / `ResizeImageMaskNode` / `VAEEncode` | L3 | `ImageStitch` / `StringConcatenate` / `StringFormat` / `StartLoop` / `EndLoop` / `MarkdownNote`；子图与蓝图 | L8 |
| `LatentUpscaleBy` / `UpscaleModelLoader` / `ImageUpscaleWithModel` / `ImageScaleBy` / `VAEDecodeTiled` | L4 | `GetImageSize` | L4 / L5 |

## 附录 B　模型文件清单（本报告涉及）

| 文件 | 放哪 | 大小 | 用在 |
|---|---|---|---|
| `anima-base-v1.0.safetensors`（及 aesthetic / turbo 各版本） | `models/diffusion_models/` | 3.89 GB | L0 起 |
| `qwen_3_06b_base.safetensors` | `models/text_encoders/` | 1.11 GB | L0 起 |
| `qwen_image_vae.safetensors` | `models/vae/` | 242 MB | L0 起 |
| `anima-turbo-lora-v0.2.safetensors` | `models/loras/` | 142 MB | L1 |
| `anima-highres-aesthetic-boost` / `anima-rl-v0.1` / `anima-greg-rutkowski-style` | `models/loras/` | 各约 140 MB | L3 / L4 |
| 动漫向放大模型（如 `4x_IllustrationJaNai_V1_ESRGAN_135k.pth`，社区） | `models/upscale_models/` | — | L4 |
| `anima-lllite-any-test-like-v2.safetensors` | `models/model_patches/` | 15.6 MB | L5 |
| `anima-lllite-depth-1.safetensors` | `models/model_patches/` | 7.5 MB | L5 |
| `anima-lllite-lineart-1` / `pose-1` / `scribble-1` | `models/model_patches/` | — | L5（Preview3 代） |
| `anima-lllite-inpainting-v2.safetensors` | `models/model_patches/` | 62.7 MB | L6 |
| `depth_anything_3_mono_large.safetensors`（`Comfy-Org/Depth-Anything-3`） | `models/geometry_estimation/` | 1.24 GB | L5 深度预处理 |

> 分词器文件不用下载：Qwen3 与 T5 的分词器内置在 ComfyUI 仓库中（`comfy/text_encoders/qwen25_tokenizer`、`t5_tokenizer`），`qwen_3_06b_base.safetensors` 只含 LM 权重（源码 `comfy/text_encoders/anima.py`）。

## 附录 C　资料来源

**官方模板与模型（本次逐节点解析）**

- 文生图模板：https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_base_v1.json
- LLLite Depth / Any Control / Inpainting 模板：https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_lllite_depth_control_to_image.json 、`image_anima_lllite_any_control_to_image.json` 、`image_anima_lllite_image_inpainting.json`
- 蓝图索引：https://github.com/Comfy-Org/workflow_templates/blob/main/blueprints/index.json
- Anima 模型卡与对比工作流：https://huggingface.co/circlestone-labs/Anima （`anima_comparison.json`）
- 官方 LoRA 镜像：https://huggingface.co/circlestone-labs/Anima-Official-LoRAs ；说明取自 Civitai https://civitai.com/user/circlestone_labs/models （Anima Turbo LoRA #2560840、Highres/Aesthetic Boost #2540444、Anima RL #2583128）
- LLLite 权重与说明：https://huggingface.co/Comfy-Org/Anima-LLLite ；https://huggingface.co/kohya-ss/Anima-LLLite （含 `PREVIEW3.md`）；https://github.com/kohya-ss/ComfyUI-Anima-LLLite ；训练/推理指南 https://github.com/kohya-ss/sd-scripts/blob/main/docs/anima_train_control_net_lllite.md
- Comfy Org 文档：Anima 教程 https://docs.comfy.org/zh/tutorials/image/anima/anima ；放大教程 https://docs.comfy.org/zh/tutorials/basic/upscale ；放大总览 https://docs.comfy.org/zh/tutorials/utility/image-upscale ；局部重绘 https://docs.comfy.org/zh/tutorials/basic/inpaint
- Civitai 开发者文档 Anima recipe（CFG 3 ~ 5、尺寸 16 倍数）：https://developer.civitai.com/orchestration/recipes/anima

**ComfyUI 源码（master `2fcb6cef`，2026-11-23）**

- `comfy/supported_models.py`（Anima：FLOW、shift 3.0、Wan21 latent、fp16 显存系数）、`comfy/model_base.py`、`comfy/model_sampling.py`（`ModelSamplingDiscreteFlow` / `time_snr_shift`）
- `comfy_extras/nodes_model_patch.py` 与 `comfy/ldm/anima/lllite.py`（`AnimaLLLiteApply` 细节）
- `comfy_extras/nodes_model_advanced.py`（`ModelSamplingSD3`）、`nodes_nag.py`、`nodes_apg.py`、`nodes_cfg.py`、`nodes_tcfg.py`、`nodes_pag.py`、`nodes_sag.py`
- `comfy_extras/nodes_custom_sampler.py`（引导器、调度器、`SamplerCustomAdvanced`）、`nodes_advanced_samplers.py`
- `comfy_extras/nodes_painter.py`、`nodes_resolution.py`、`nodes_post_processing.py`（`ResizeImageMaskNode`、`ImageScaleToTotalPixels`）、`nodes_dataset.py`（`ImageGrid`）、`nodes_images.py`（`ImageStitch`、`GetImageSize`、`ImageCropToMask`）、`nodes_text_overlay.py`、`nodes_loop.py`、`nodes_toolkit.py`（`CreateList`）、`nodes_mask.py`、`nodes.py`（`CLIPLoader` 类型表、`KSamplerAdvanced`、`VAEEncodeForInpaint`、`ImagePadForOutpaint`、`LatentUpscaleBy`）
- `comfy/utils.py`（`common_upscale` 的中心裁剪逻辑）

**作者与社区（仅供参考，需自测）**

- HF 讨论区：#163 "Had a question about Hires.fix"（非分块放大不超过 1.5×）、#204 "Problem with upscale artifacts"（1024² 1.5× / 1536² 1.3×；动漫放大模型）、#165 "Optimal sampler / scheduler settings for Anima"（单段 hires 上限、两段放大、采样器对比站、CFG++ 需 CFG < 2）
- DXMPie《Anima Made Easy》 https://civitai.com/articles/37140 （Hires denoise 0.45 ~ 0.65 的 WebUI 经验）
- HKMC_AILab《[Anima] A Complete Guide to Anima Upscaling》 https://note.com/hkmclab/n/ne39ca8184d79 （Hires.Fix + Refiner）
- nobin《5 Tips I Started Using After Switching to Anima in ComfyUI》 https://note.com/nobinlog/n/n3620e68d1590 （Anima 二次采样 denoise 0 ~ 0.4）
- 官方 Z-Image-Turbo 2K 放大模板文档（denoise 区间参考）：https://docs.comfy.org/zh/tutorials/utility/image-upscale

**核实说明**

- 官方模板的节点、数值、连线均来自对 JSON 的程序化解析，不是凭截图推断。
- 社区数值（放倍率、denoise、采样器风格）会随提示词与版本变化，本报告只把它们当"起点"，结论以你自己的固定种子对照图为准。
- "Anima 2.9B" 相关内容未采信：官方仓库无此文件，相关文章自述未运行验证。
