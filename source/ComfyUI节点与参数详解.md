# ComfyUI 节点与参数详解

> 面向对象：已经能在 ComfyUI 里跑通模板，想**看懂每个节点、每个参数在做什么**，进而自己搭建和改造工作流的学习者
> 调研时间：2026 年 11 月
> 资料来源：ComfyUI **源码**（`nodes.py`、`comfy_extras/*.py`、`comfy/samplers.py`、`folder_paths.py`，参数默认值/范围/选项均以源码为准）、ComfyUI 官方文档与官方教程（中文版）、官方博客。链接见文末
> 配套阅读：《Anima生图学习报告.md》（同目录）

---

## 目录

- [0. 一页速览](#0-一页速览)
- [1. 先懂原理：一张图是怎么生成的](#1-先懂原理一张图是怎么生成的)
- [2. 画布与界面操作](#2-画布与界面操作)
- [3. 节点与参数详解](#3-节点与参数详解)
  - [3.1 加载器](#31-加载器把模型文件请进工作流)　[3.2 提示词与条件](#32-提示词与条件conditioning)　[3.3 Latent 潜空间](#33-latent-潜空间)　[3.4 采样](#34-采样sampling)
  - [3.5 图像](#35-图像image)　[3.6 遮罩](#36-遮罩mask)　[3.7 模型修补与融合](#37-模型修补与融合)　[3.8 工具与逻辑节点](#38-工具与逻辑节点)
- [4. 典型工作流怎么搭](#4-典型工作流怎么搭)
- [5. 调参手册与排错](#5-调参手册与排错)
- [6. 学习路径](#6-学习路径)
- [7. 附录](#7-附录)

**怎么用这份报告**：第 1、2 章通读一遍；第 3 章当字典查——在 ComfyUI 里看到不懂的节点就来查；第 4 章照着搭一遍；第 5 章出图不满意时查。

---

## 0. 一页速览

| 问题 | 一句话答案 |
|---|---|
| ComfyUI 在干什么 | 把"加载模型 → 把提示词变成数字 → 造一张空白潜空间图 → 一步步去噪 → 解码成图片 → 保存"拆成一个个**节点**，用**连线**把数据传下去 |
| 连线的规矩 | **同颜色（同数据类型）才能连**；一个输出可以连多个输入，一个输入只能接一条线 |
| 最重要的节点 | **K采样器**——steps、cfg、采样器、调度器、种子、denoise 都在这里 |
| 最常改的参数 | 提示词、种子、`denoise`（图生图保留多少原图）、`cfg`、分辨率 |
| 节点三种状态 | 正常 / **忽略（Bypass，`Ctrl+B`）**：不执行但数据透传 / **禁用（Mute，`Ctrl+M`）**：不执行且下游断粮 |
| 控件能变成输入口 | 把连线**直接拖到控件上**，就能用别的节点（数字节点、列表）来驱动它——这是批量实验和参数网格的基础 |
| 模型放哪 | `ComfyUI/models/` 下对应子目录，放完按 `R` 刷新 |
| 工作流存哪 / 怎么还原 | 输出目录的 **PNG 里内嵌工作流**，把图拖回画布即可还原 |
| 新手三件套 | 固定种子、**一次只改一个参数**、用 Bypass 做 A/B 对比 |

---

## 1. 先懂原理：一张图是怎么生成的

### 1.1 六个阶段

```
① 加载模型      ② 编码提示词       ③ 起始画布        ④ 采样              ⑤ 解码            ⑥ 保存
┌────────────┐  ┌──────────────┐  ┌────────────┐  ┌────────────────┐  ┌──────────┐  ┌──────────┐
│ 加载器节点  │  │ CLIP文本编码  │  │ 空Latent图像│  │   K采样器       │  │ VAE解码   │  │ 保存图像  │
│ 模型/编码器 │─▶│ 文字→条件向量 │─▶│ 全是噪波的  │─▶│ 按提示词一步步  │─▶│ 潜空间→  │─▶│ 写成 PNG │
│ /VAE       │  │ (CONDITIONING)│  │ 潜空间图    │  │ 去噪            │  │ 像素     │  │          │
└────────────┘  └──────────────┘  └────────────┘  └────────────────┘  └──────────┘  └──────────┘
      │                                                    ▲                        ▲
      └────────────────── MODEL ───────────────────────────┘                        │
      └─────────────────────────────────────────── VAE ────────────────────────────┘
```

用一句话概括每一步：

| 阶段 | 做什么 | 对应节点 |
|---|---|---|
| ① 加载 | 把硬盘上的权重文件读进显存，拆成 **模型（负责去噪）**、**文本编码器（负责读提示词）**、**VAE（负责图像↔潜空间互转）** 三件套 | Checkpoint加载器 / UNet加载器 / 加载CLIP / 加载VAE |
| ② 编码 | 文本编码器把提示词变成一串数字（CONDITIONING），告诉去噪模型"往哪个方向画" | CLIP文本编码 |
| ③ 起始画布 | 生成一张（或一批）全是随机噪声的潜空间小图 | 空Latent图像（图生图则用 VAE编码） |
| ④ 采样 | 模型看着"当前噪声图 + 提示词"，预测噪声并减掉一点；重复 N 步，从一团噪声变成一张潜空间图 | K采样器 |
| ⑤ 解码 | VAE 把潜空间小图放大还原成真正的像素图 | VAE解码 |
| ⑥ 保存 | 写到 `ComfyUI/output/`，并把工作流信息嵌进 PNG | 保存图像 |

**Latent（潜空间）是什么？** 可以理解为图片的"高度压缩版"。常见模型（SD1.5、SDXL、Anima 等）里，1024×1024 的图在潜空间只有 128×128，信息密度高得多，所以模型在潜空间里去噪比直接在像素上算快很多。这也是为什么采样阶段改分辨率、放大图像有"Latent 版"的节点。

### 1.2 数据类型与颜色

连线和端口用颜色区分配对类型，**只有相同颜色才能相连**（官方文档表）：

| 数据类型 | 颜色 | 里面装的是什么 | 谁产生 |
|---|---|---|---|
| 扩散模型 MODEL | 薰衣草色 | 去噪网络的权重（含 LoRA、采样修补的叠加效果） | 各类加载器、LoRA 加载器 |
| CLIP | 黄色 | 文本编码器 | Checkpoint加载器、加载CLIP |
| VAE | 玫瑰色 | 图像↔潜空间的编解码器 | Checkpoint加载器、加载VAE |
| 条件 CONDITIONING | 橙色 | 编码后的提示词向量（含 ControlNet、区域等信息） | CLIP文本编码、应用ControlNet |
| 潜空间图像 LATENT | 粉色 | 压缩表示的图（一张或一批） | 空Latent图像、VAE编码、K采样器 |
| 像素图像 IMAGE | 蓝色 | 真正的图，浮点数 0–1，形状 `批次×高×宽×通道` | 加载图像、VAE解码 |
| 遮罩 MASK | 绿色 | 单通道灰度图 0–1，**白色=生效区域** | 遮罩节点、加载图像 |
| 数字 INT/FLOAT | 灰色 | 整数、小数 | 数字节点 |
| 其他 | — | CONTROL_NET、UPSCALE_MODEL、SAMPLER、SIGMAS、NOISE、GUIDER、CLIP_VISION 等，都属于"专用插头" | 各自的加载器/节点 |

IMAGE 类型可以带 4 个通道（RGBA），这时第 4 通道是透明度；`分离图像Alpha` / `合并图像Alpha` 负责把它和 MASK 互相转换。

### 1.3 节点的结构

```
              ┌──────────────────────────────┐
   输入端口 ──▶│  K采样器                      │──▶ 输出端口
 (左侧圆点)    │  ┌────────────────────────┐  │   (右侧圆点)
              │  │ 控件：seed  steps  cfg  │  │
              │  │ 下拉：采样器名  调度器   │  │
              │  └────────────────────────┘  │
              └──────────────────────────────┘
```

- **输入端口**：接收别的节点传来的数据。
- **输出端口**：把结果传给下游。
- **控件（widget）**：节点里可以直接填/选的参数框。
- **控件和输入可以互换**：把连线拖到某个控件上，该控件就变成输入端口，由上游节点提供数值——比如用"整数"节点给 seed 传值，用"创建列表"一次传入多个 CFG 值。在输入端口上右键可以转回控件。

三条实际运行规律：

1. **只执行通向"输出节点"的分支**。没有连到保存/预览等输出节点的节点不会运行。
2. **输入没变就不重算**。ComfyUI 有缓存，只改提示词时模型不会重新加载。
3. **强类型**。图像输出不能接到数字输入，所以接不上的线就是真的不兼容，不用硬试。

---

## 2. 画布与界面操作

### 2.1 界面地图

| 区域 | 内容 |
|---|---|
| 左侧边栏 | 资产（生成的图）、**节点库**（搜节点）、**模型库**（本地模型文件，可直接拖到画布生成对应加载器）、工作流（已保存的）、Apps |
| 画布 | 放节点的地方。顶部浮着 **Run 栏**：批量次数、Run、队列模式、取消、活动任务数 |
| 右侧面板 | 选中节点后的**参数**、**信息**（= 该节点的内置文档）、**设置**（状态/颜色/固定）；以及**错误**标签页（缺失模型、缺失节点包、缺失输入、报错日志） |
| 右下角 | 画布工具栏：选择/平移模式、适应视图、缩放、小地图、连线显隐 |
| 左下角 | 设置、帮助中心、底栏（快捷键表、日志、桌面版还有终端） |

### 2.2 必会快捷键（官方默认表，Windows/Linux）

| 快捷键 | 作用 | 快捷键 | 作用 |
|---|---|---|---|
| `Ctrl+Enter` | **运行** | `Ctrl+B` | **忽略/取消忽略**选中节点（Bypass） |
| `Ctrl+Alt+Enter` | 中断 | `Ctrl+M` | 禁用/取消禁用选中节点（Mute） |
| `Ctrl+Z` / `Ctrl+Y` | 撤销/重做 | `Ctrl+G` | 给选中节点加**框（Group）** |
| `Ctrl+S` / `Ctrl+O` | 保存 / 加载工作流 | `Alt+C` | 折叠/展开选中节点 |
| `Ctrl+A` | 全选节点 | `P` | 固定/取消固定（防止被拖动） |
| `Ctrl+C` / `Ctrl+V` | 复制粘贴（不保持外部连线） | `L` | 隐藏/显示选中节点的连线 |
| `Ctrl+C` / `Ctrl+Shift+V` | 复制粘贴（**保持**与外部输出的连线） | `Q` / `W` / `N` / `M` | 切换队列 / 工作流 / 节点库 / 模型库侧栏 |
| `Delete` / `Backspace` | 删除选中节点 | `.` | 适应视图到选中节点 |
| `Space`+拖动 | 平移画布 | `Alt+=` / `Alt+-` | 放大 / 缩小画布 |
| `Ctrl`+点击、`Shift`+点击 | 把节点加入选择 | `R` | **刷新节点定义**（重新扫描模型文件夹） |
| `Ctrl+,` | 打开设置 | `F` | 专注模式（全屏） |
| **双击左键**空白处 | **搜索并添加节点** | `Ctrl+Shift+K` | 打开底部快捷键面板 |

macOS 把 `Ctrl` 换成 `Cmd`、`Alt` 换成 `Option`。所有快捷键都可以在 **设置 → 快捷键** 里改，并保存成预设。

### 2.3 添加与连接

- **添加节点**：双击空白处搜索（输入英文类名如 `KSampler`、`VAEDecode` 也能搜到）；或从左侧节点库/模型库拖入。
- **连接**：从输出圆点拖到同色输入圆点。
- **拖线到空白处松手**：自动弹出搜索框，选中的节点会直接连好线——最快的连下游方式。
- **断开**：点住输入圆点拖走即可；或框选连线后点工具箱的"删除"。
- 把模型文件从**模型库**拖到画布，会自动生成对应的加载器并选好文件（如 `checkpoints` → Checkpoint加载器，`loras` → 加载LoRA，`diffusion_models` → UNet加载器）。

### 2.4 节点的三种状态：正常 / 忽略 / 禁用

| 状态 | 快捷键 | 节点是否执行 | 下游拿到什么 | 用途 |
|---|---|---|---|---|
| 正常 Always | — | 执行 | 本节点的输出 | 默认 |
| **忽略 Bypass** | `Ctrl+B` | 不执行 | **原样透传**同类型的输入（如 MODEL 进、MODEL 出） | **A/B 对比神器**：临时关掉某个 LoRA / ControlNet / 模型补丁，而不用拆线 |
| 禁用 Never（Mute） | `Ctrl+M` | 不执行 | 什么都没有，下游会报"缺少输入" | 彻底停掉一条分支 |

> 以两个串联的 LoRA 加载器为例：把第二个设为"禁用"，下游收不到模型而报错；设为"忽略"，下游拿到的是第一个 LoRA 的输出，工作流照常运行。

### 2.5 节点右键菜单与选择工具箱

选中节点后上方浮出的**选择工具箱**提供：改颜色、**Bypass 开关**、固定、删除、**节点文档**（书/i 图标）、**部分执行**（蓝色三角）、**收成子图**。

- **节点文档**：选中任意节点 → 工具箱文档图标，或右侧面板"信息"标签，可以看到该节点的官方说明。**这是最快的查参数方式，不用离开 ComfyUI。**
- **部分执行**：选中一个**输出节点**（保存/预览），点蓝色三角，只运行通往它的那条分支。
- 右键菜单里还有：改标题、克隆、模式（Always/Never/Bypass）、显示完整分辨率预览等。

### 2.6 整理画布：Reroute、Group、Note、子图

| 工具 | 作用 | 怎么用 |
|---|---|---|
| **Reroute（转接点）** | 把长绕的线"折一下"，让布局清爽。不限类型 | 从连线上或端口拖出 Reroute；右键可设垂直/水平 |
| **Group（框）** | 给一组节点画框并写标题 | 选中多个节点按 `Ctrl+G` |
| **Note / MarkdownNote** | 便签，写说明 | 从节点库添加；Note 是纯文本，MarkdownNote 支持排版 |
| **子图（Subgraph）** | 把一组节点封装成**一个可复用节点**，像"工作流的文件夹"。官方 Anima 模板就是把整条文生图管线封装成一个子图 | 选中节点 → 工具箱子图图标；双击子图空白处进入编辑；`Esc` 退出。子图可以 Bypass、可以嵌套、可以发布到节点库当"蓝图"反复使用 |

### 2.7 运行、队列与批量

Run 栏上从左到右：

| 控件 | 作用 |
|---|---|
| **批量次数** | 点一次 Run 把工作流排入队列几次。配合种子"随机/递增"就是一次出 N 张 |
| **Run** | 加入队列。按住 `Shift` 点 Run **插队**到最前 |
| 队列模式 | `Run`（点了才跑）/ `Run (On Change)`（一有改动就自动跑）/ `Run (Instant)`（上一次一结束立刻再跑） |
| 取消 | 停止当前任务 |
| 活动任务 | 排队+运行中的数量；点击打开队列，右键清空 |

**种子控件右侧的"生成后控制"**（control after generate）：`固定 fixed` / `递增 increment` / `递减 decrement` / `随机 randomize`。想复现就设"固定"；想批量出变体就设"随机"。

### 2.8 加载、保存与分享工作流

- **保存**：`Ctrl+S`，存在用户目录的 workflows 文件夹（便携版/手动安装为 `ComfyUI/user/default/workflows/`）。
- **从图片还原**：把任何一张 ComfyUI 生成的 PNG 拖回画布——**工作流 JSON 就嵌在图片里**。这是社区分享工作流的标准方式。
- **模板**：左侧 **模板**（或菜单 工作流 → 浏览工作流模板）里有官方为每个模型准备的现成工作流，缺失模型会在右侧面板列出并可一键下载。
- **导出工作流图像**：工作流标签页菜单 → 导出（工作流图像），得到一张"画布截图 PNG"，同样内嵌工作流。

### 2.9 遮罩编辑器

局部重绘时要在图上涂抹区域。打开方式：选中"加载图像"节点 → 工具箱的遮罩图标；或右键 → 在蒙版编辑器中打开；或悬停图片点左上角的遮罩按钮。

| 工具 | 说明 |
|---|---|
| Mask Pen 遮罩画笔 | 左键拖拽涂抹遮罩（最常用） |
| Paint Pen 绘画笔 | 直接在原图 RGB 上涂颜色（给模型提供"参考底色"） |
| Eraser 橡皮 | 擦除 |
| Paint Bucket 油漆桶 | 按颜色相近度填充连通区域（Threshold 控容差） |
| Color Select 颜色选择 | 选中画面里所有相近颜色生成遮罩（适合纯色背景） |

笔刷参数：形状、厚度 1–250、不透明度、硬度（1=硬边）、间距。顶部栏有撤销/重做、旋转翻转、**反转**、清除、保存。`Space`+拖动平移，`Ctrl`+滚轮缩放。

### 2.10 自定义节点

官方内置的叫 **Comfy Core** 节点；社区扩展叫自定义节点（registry.comfy.org）。

- 用内置的 **ComfyUI Manager** 搜索安装（自动装依赖），装完重启。
- 打开别人的工作流出现红色"缺失节点"时，右侧面板 → 错误 → 缺失节点包 → 全部安装。
- 只装可信作者的常用包；冷门插件有安全风险，也可能拖慢启动。
- 想自己写节点、或用脚本批量调用 ComfyUI：见《补充B-开发者方向-API与自定义节点》。

---

## 3. 节点与参数详解

> 阅读约定：标题格式为 **中文界面名 `英文类名`**（搜索框里输英文也能找到）。参数表的"取值"列给出源码里的选项或范围，"默认"是源码默认值——**模板里的预设值可能不同，以模板为准**。标 ⚠️ 的是容易踩的坑。

### 3.1 加载器：把模型文件请进工作流

加载器都做同一件事：从 `ComfyUI/models/` 的某个子目录读文件。**放对目录 + 按 `R` 刷新**，下拉列表里才会出现。

**模型文件夹对照表**（来自源码 `folder_paths.py`）

| 文件夹（`ComfyUI/models/` 下） | 放什么 | 对应加载器 |
|---|---|---|
| `checkpoints` | 三合一整包（模型+CLIP+VAE） | Checkpoint加载器（简易） |
| `diffusion_models`（旧名 `unet`） | 单独的去噪模型（UNET/DiT） | UNet加载器 |
| `text_encoders`（旧名 `clip`） | 文本编码器 | 加载CLIP / 双CLIP加载器 |
| `vae` | VAE（`vae_approx` 放近似 VAE） | 加载VAE |
| `loras` | LoRA | 加载LoRA 系列 |
| `controlnet`（含 T2I-Adapter） | ControlNet 模型 | 加载ControlNet模型 |
| `upscale_models` | 放大模型（ESRGAN 等，`.pth`） | 加载放大模型 |
| `latent_upscale_models` | 潜空间放大模型 | 加载 Latent 放大模型 |
| `clip_vision` | CLIP 视觉编码器（IPAdapter、风格模型用） | 加载CLIP视觉 |
| `style_models` | 风格模型（IPAdapter） | 加载风格模型 |
| `model_patches` | 模型补丁（如 Anima 的 LLLite） | 加载模型补丁 |
| `embeddings` | 文本嵌入（在提示词里用 `embedding:名称` 引用） | 无需节点 |
| `gligen` | GLIGEN（框选生成物体） | GLIGEN加载器 |
| `hypernetworks` / `photomaker` | 超网络 / PhotoMaker | 对应加载器 |

#### Checkpoint加载器（简易）`CheckpointLoaderSimple`

一个节点交出 MODEL、CLIP、VAE 三个输出，适合 SD1.5 / SDXL / FLUX 整包 checkpoint。

| 参数 | 取值 | 说明 |
|---|---|---|
| ckpt_name | `checkpoints` 目录下的文件 | 要加载的模型 |

| 输出 | 说明 |
|---|---|
| MODEL | 去噪模型 |
| CLIP | 文本编码器 |
| VAE | 图像编解码器 |

#### UNet加载器 `UNETLoader`

只加载去噪模型。Anima、Qwen-Image 等拆分式模型用它（Anima：`anima-base-v1.0.safetensors` 放 `diffusion_models/`）。

| 参数 | 取值 | 默认 | 说明 |
|---|---|---|---|
| unet_name | `diffusion_models` 目录下的文件 | — | 模型文件 |
| weight_dtype | `default` / `fp8_e4m3fn` / `fp8_e4m3fn_fast` / `fp8_e5m2` | default | 权重精度。`default` = 保持文件原样；`fp8_*` 把权重转成 8 位浮点**省显存**，速度/画质略有差异 |

#### 加载CLIP `CLIPLoader`

单独加载文本编码器。**`type` 必须和模型架构匹配**，否则报错或出乱图。

| 参数 | 取值 | 说明 |
|---|---|---|
| clip_name | `text_encoders` 目录下的文件 | 编码器文件 |
| type | `stable_diffusion` / `sd3` / `qwen_image` / `wan` / `ltxv` / `hidream` / `cosmos` / `pixart` / `lumina2` / `chroma` / `ace` / `omnigen2` / `flux2` / `hunyuan_image` …（共 33 种；SDXL、FLUX 的双编码器请用双CLIP加载器） | 架构类型。**Anima：`qwen_3_06b_base.safetensors` + `stable_diffusion`**（官方模板设定） |
| device（可选） | `default` / `cpu` | 放 CPU 上跑编码器可省一点显存 |

#### 双CLIP加载器 `DualCLIPLoader`

SDXL（clip_l + clip_g）、SD3、FLUX（clip_l + t5xxl）等需要两个编码器的模型用。

| 参数 | 取值 |
|---|---|
| clip_name1 / clip_name2 | `text_encoders` 下的两个文件 |
| type | `sdxl` / `sd3` / `flux` / `hidream` / `hunyuan_video` / `ltxv` / `newbie` / `ace` … |

> 源码注释里给了常见搭配：sdxl = clip-l + clip-g；flux = clip-l + t5；hidream = llama-3.1 + t5。

#### 加载VAE `VAELoader`

| 参数 | 取值 | 说明 |
|---|---|---|
| vae_name | `vae` 目录下的文件 | 例如 `qwen_image_vae.safetensors` |

⚠️ VAE 必须和模型配套。用错 VAE 的典型表现是出图发灰、发白或有噪点。Checkpoint 自带的 VAE 已在节点里输出，不用再单独加载。

#### 加载LoRA `LoraLoader`（同时影响模型和文本编码器）

| 参数 | 取值 | 默认 | 说明 |
|---|---|---|---|
| model / clip | 输入端口 | — | 接上游的 MODEL 和 CLIP |
| lora_name | `loras` 目录下的文件 | — | LoRA 文件 |
| strength_model | -100 ~ 100 | 1.0 | 对去噪模型的强度，日常 0~1，越大风格越强 |
| strength_clip | -100 ~ 100 | 1.0 | 对文本编码器的强度 |

输出 MODEL、CLIP（已叠加 LoRA）。**多个 LoRA 串联**：第一个的 MODEL/CLIP 输出接到第二个的 model/clip 输入，依此类推。

#### LoRA加载器（仅模型）`LoraLoaderModelOnly`

只有 model、lora_name、strength_model，输出 MODEL。适用于不含文本编码器部分的 LoRA，以及 Anima 这类拆分模型（官方 Anima 模板用它挂 Turbo LoRA）。⚠️ 两个 LoRA 加载器别混用：`LoraLoader` 的 clip 输入是必填，拆分模型如果没接 CLIP 会报缺少输入。

#### 加载 LoRA（模型）`LoadLoraModel`（LoRA 堆栈）

一个节点挂 1~20 个 LoRA，每行选文件、强度、开关。适合固定搭配一串 LoRA 的工作流。

#### 加载ControlNet模型 `ControlNetLoader`

| 参数 | 取值 |
|---|---|
| control_net_name | `controlnet` 目录下的文件 |

输出 CONTROL_NET → 接到"应用ControlNet"节点。

#### 加载放大模型 `UpscaleModelLoader`

| 参数 | 取值 | 说明 |
|---|---|---|
| model_name | `upscale_models` 目录下的文件 | 如 4x-ESRGAN、RealESRGAN、SwinIR |

输出 UPSCALE_MODEL → 接"使用模型放大图像"。官方教程的经验：RealESRGAN 通用；BSRGAN 擅长文字和锐利边缘；SwinIR 保留自然纹理、适合风景。

#### 其他加载器速览

| 节点 | 读取目录 | 输出 | 用途 |
|---|---|---|---|
| 加载CLIP视觉 `CLIPVisionLoader` | `clip_vision` | CLIP_VISION | 给"CLIP视觉编码"提供模型（IPAdapter、风格迁移） |
| 加载风格模型 `StyleModelLoader` | `style_models` | STYLE_MODEL | IPAdapter 风格模型 |
| 加载模型补丁 `ModelPatchLoader`（实验性） | `model_patches` | MODEL_PATCH | Anima 的 LLLite ControlNet 放这里 |
| GLIGEN加载器 `GLIGENLoader` | `gligen` | GLIGEN | 按文字框指定物体位置 |
| 加载Checkpoint（仅图像）`ImageOnlyCheckpointLoader` | `checkpoints` | MODEL, CLIP_VISION, VAE | 图生视频（SVD）模型 |

---

### 3.2 提示词与条件（Conditioning）

这一类节点的产出都是橙色的 **CONDITIONING**——"告诉模型画什么"。一个 K采样器需要两路条件：`positive`（想要的）和 `negative`（不想要的）。

#### CLIP文本编码 `CLIPTextEncode`

每个工作流至少两个：一个写正向提示词，一个写负向。

| 参数 | 取值 | 说明 |
|---|---|---|
| text | 多行文本 | 提示词。支持"动态提示词"语法（见下） |
| clip | CLIP 输入 | 接 Checkpoint加载器 或 加载CLIP 的输出 |

输出 CONDITIONING。

**提示词小语法**（SD 系 CLIP 编码器通用；不同模型敏感度不同）

| 写法 | 作用 | 备注 |
|---|---|---|
| `(词:1.2)` | 提高该词权重 | 括号里不写数字 `(词)` 约等于 1.1 倍。**不同模型需要的力度不同**：SDXL 常用 1.1~1.5，Anima 要到 1.5~2.0 才明显 |
| `[词]` | 降低该词权重 | 每层约除以 1.1 |
| `\(词\)` | 转义括号，按字面处理 | 标签里本身带括号时用（如 `toon \(style\)`） |
| `embedding:名称` | 插入文本嵌入 | 文件放 `models/embeddings`，支持 `.safetensors/.pt/.bin` |
| `{A\|B\|C}` | 动态提示词 | 每张图从竖线分隔的选项里随机选一个；配合 `batch_size > 1` 使用 |

#### 设置CLIP最后一层 `CLIPSetLastLayer`

| 参数 | 取值 | 默认 | 说明 |
|---|---|---|---|
| clip | CLIP | — | 输入编码器 |
| stop_at_clip_layer | -24 ~ -1 | -1 | 在第几层截断编码。`-1` 用全部层，`-24` 只用第一层 |

输出修改后的 CLIP（原 CLIP 不变）。主要影响 SD1.x 系模型的画面质感，较少调整。

#### CLIP视觉编码 `CLIPVisionEncode`

把**图片**编码成向量，供 IPAdapter / 风格模型使用（"参考这张图画"）。

| 参数 | 取值 | 说明 |
|---|---|---|
| clip_vision | CLIP_VISION | 来自 加载CLIP视觉 |
| image | IMAGE | 参考图 |
| crop | `center` / `none` | 是否中心裁剪到编码器尺寸 |

#### 合并与变换条件

| 节点 | 参数 | 作用 | 典型用法 |
|---|---|---|---|
| 条件合并 `ConditioningCombine` | conditioning_1, conditioning_2 | 两组条件**并行叠加、同等重要**（各算各的） | 两段提示词分别写、同时生效 |
| 条件连接 `ConditioningConcat` | conditioning_to, conditioning_from | 把第二组的 token **直接拼在**第一组后面 | 相当于把两段话写成一段长提示词 |
| 条件平均 `ConditioningAverage` | conditioning_to, conditioning_from, conditioning_to_strength（0~1，默认 1） | 在两组条件间按权重插值；1 = 完全是 to | 两个提示词之间做过渡 |
| 条件（乘法）`ConditioningMultiply` | conditioning, multiplier（-100~100，默认 1） | 整体缩放条件强度 | 增强或减弱某段提示词 |
| 条件零化 `ConditioningZeroOut` | conditioning | 把条件清零 | 造一份"空条件"当负面（CFG=1 的模型常用） |
| 设置条件时间 `ConditioningSetTimestepRange` | conditioning, start（0~1）, end（0~1） | 让该条件只在采样的某段时间生效 | 先定构图再放开细节 |
| 条件采样区域 `ConditioningSetArea` | conditioning, width, height, x, y（像素）, strength（0~10） | 把条件限定在一个矩形区域内 | **区域提示词**（左边的女孩、右边的男孩） |
| 条件采样区域（系数）`ConditioningSetAreaPercentage` | 同上，但用 0~1 的比例 | 同上 | 同上 |
| 条件遮罩 `ConditioningSetMask` | conditioning, mask, strength, set_cond_area（`default` / `mask bounds`） | 用遮罩（任意形状）限定条件作用范围 | 比"区域"更灵活的分区提示词 |
| 条件采样区域强度 `ConditioningSetAreaStrength` | conditioning, strength（0~10） | 调整已带区域信息的条件的强度 | 配合上面几个用 |

> ⚠️ 区域/遮罩类条件节点依赖模型的注意力机制，对 SD1.x / SDXL 有效；对 FLUX、Anima 这类新架构**通常无效或效果很弱**，需要专门的分区方案（自定义节点或多次局部重绘）。

#### 应用ControlNet（高级）`ControlNetApplyAdvanced`（当前版本）

用一张"控制图"（线稿、深度图、姿态骨架、涂鸦）约束画面的结构或构图。

| 参数 | 取值 | 默认 | 说明 |
|---|---|---|---|
| positive / negative | CONDITIONING | — | 正、负向条件进，**加了控制信息后的条件出** |
| control_net | CONTROL_NET | — | 来自 加载ControlNet模型 |
| image | IMAGE | — | 控制图。⚠️ 多数类型需要先"预处理"（把原图转成线稿/深度/姿态），预处理器主要在社区包 `comfyui_controlnet_aux` 里；核心节点只自带 Canny |
| strength | 0 ~ 10 | 1.0 | 控制强度，越大越听话 |
| start_percent | 0 ~ 1 | 0.0 | 采样进行到百分之多少时开始生效。如 0.2 = 前 20% 不干预 |
| end_percent | 0 ~ 1 | 1.0 | 何时停止生效。如 0.8 = 最后 20% 放开，让模型自由收尾 |
| vae（可选） | VAE | — | 部分新式 ControlNet（SD3、FLUX 系）需要 |

多个 ControlNet **串联**：第一个节点的 positive/negative 输出接到第二个的 positive/negative 输入。分区控制时，官方建议不同区域的强度设成相近的值（例如都设 1.0），否则一侧会压过另一侧。

旧版的 `ControlNetApply`（应用ControlNet（旧版））已弃用，默认搜不到，遇到老工作流请换成高级版。

> Anima 用的是另一套：**应用 Anima LLLite `AnimaLLLiteApply`**（实验性）。输入 model、model_patch（来自"加载模型补丁"）、image、strength、start_percent、end_percent、可选 mask，输出 MODEL。它直接修补模型而不是改条件，所以接在 UNet加载器 之后、K采样器 之前。

#### 内补模型条件 `InpaintModelConditioning`

配合 SD1.5/2.x 的**专用 inpainting 模型**使用。输入 positive、negative、vae、pixels、mask、noise_mask（默认开），输出处理后的正负条件。

---

### 3.3 Latent 潜空间

粉色 LATENT 是采样器的工作对象。这一类节点负责"造起始画布""像素↔潜空间互转""在潜空间里缩放拼接"。

#### 空Latent图像 `EmptyLatentImage`

文生图的起点：一张全是零的潜空间图（采样器会往里加噪声）。

| 参数 | 取值 | 默认 | 说明 |
|---|---|---|---|
| width / height | 16 ~ 16384，步长 8 | 512 | **输出图像的像素尺寸**（不是潜空间尺寸）。必须是 8 的倍数；不少新模型偏好 16/32/64 的倍数，以官方模板为准 |
| batch_size | 1 ~ 4096 | 1 | 一次生成几张。同一批次里每张噪声不同。⚠️ 越大越吃显存 |

分辨率决定了构图质量：每种模型有自己的"舒适区"（SD1.5 约 512²、SDXL 约 1024²、Anima 512²~1536² 约 1MP 最佳），超出容易出现重复人像、构图崩坏。

#### VAE编码 `VAEEncode` / VAE解码 `VAEDecode`

| 节点 | 输入 | 输出 | 用途 |
|---|---|---|---|
| VAE编码 | pixels（IMAGE）, vae | LATENT | 图生图：把一张图变成潜空间，作为采样起点 |
| VAE解码 | samples（LATENT）, vae | IMAGE | 把采样结果变成能看的图 |

#### VAE解码（分块）`VAEDecodeTiled` / VAE编码（分块）`VAEEncodeTiled`

大图编解码时显存不够（VAE 阶段 OOM）就换成这两个，把图切成小块处理。

| 参数 | 默认 | 范围 | 说明 |
|---|---|---|---|
| tile_size | 512 | 64 ~ 4096 | 每块大小 |
| overlap | 64 | 0 ~ 4096 | 相邻块重叠，减少接缝 |
| temporal_size / temporal_overlap | 64 / 8 | — | 仅视频 VAE 用 |

结果与整图处理有细微差别。

#### VAE编码（局部重绘）`VAEEncodeForInpaint`

局部重绘专用：输出里带了"遮罩外保持不变"的信息。

| 参数 | 取值 | 默认 | 说明 |
|---|---|---|---|
| pixels | IMAGE | — | 原图 |
| vae | VAE | — | — |
| mask | MASK | — | 要重绘的区域（白=重绘） |
| grow_mask_by | 0 ~ 64 | 6 | 把遮罩向外扩几个像素，让新旧区域过渡自然 |

#### 设置Latent噪波遮罩 `SetLatentNoiseMask`

输入 samples、mask，输出带遮罩的 LATENT。效果：**采样时只在遮罩内加噪去噪，遮罩外保持原样**。配合普通的 `VAE编码` 就能用常规模型做局部重绘（不如专用 inpainting 模型贴合，但通用）。

#### 缩放Latent `LatentUpscale` / 缩放Latent（比例）`LatentUpscaleBy`

在潜空间里直接放大（不解码成像素，省显存、快，但细节是插值出来的，需要再采样补细节）。

| 参数 | `LatentUpscale` | `LatentUpscaleBy` | 说明 |
|---|---|---|---|
| upscale_method | `nearest-exact` / `bilinear` / `area` / `bicubic` / `bislerp` | 同左 | 插值算法。`bislerp` 是专为潜空间设计的一种，对部分模型效果更好 |
| width / height | 0 ~ 16384，默认 512 | — | 目标尺寸；**填 0 = 按比例自动算** |
| crop | `disabled` / `center` | — | 是否居中裁剪到目标尺寸 |
| scale_by | — | 0.01 ~ 8，默认 1.5 | 放大倍率 |

#### 合成Latent `LatentComposite` / 合成Latent遮罩 `LatentCompositeMasked`

把一块潜空间贴到另一块上面（比如把局部重绘的小图贴回大图）。

| 参数 | `LatentComposite` | `LatentCompositeMasked` | 说明 |
|---|---|---|---|
| 目标 | samples_to | destination | 底图 |
| 来源 | samples_from | source | 要贴上去的图 |
| x, y | ✔ | ✔ | 贴在底图的哪个坐标 |
| feather | 0 ~ 16384，默认 0 | — | 边缘羽化像素 |
| resize_source | — | 默认关 | 是否先把来源缩放到目标尺寸 |
| mask（可选） | — | ✔ | 只贴遮罩内的部分 |

#### 潜空间基础变换

| 节点 | 参数 | 说明 |
|---|---|---|
| 裁剪Latent `LatentCrop` | width, height, x, y | 裁出一块。⚠️ 这里的坐标和尺寸按**潜空间单位**（像素 ÷ 8），不是像素 |
| 翻转Latent `LatentFlip` | `x-axis: vertically` / `y-axis: horizontally` | 上下翻 / 左右翻 |
| 旋转Latent `LatentRotate` | `none` / `90 degrees` / `180 degrees` / `270 degrees` | 旋转 |
| Latent相加 / 相减 `LatentAdd` / `LatentSubtract` | samples1, samples2（相减另有 multiplier -10~10） | 两张潜空间图逐元素加减 |
| Latent相乘 `LatentMultiply` | samples, multiplier（-10~10） | 整体缩放 |
| Latent插值 `LatentInterpolate` | samples1, samples2, ratio（0~1） | 0 = 第一张，1 = 第二张，中间是混合 |
| 混合Latent `LatentBlend`（实验性） | samples1, samples2, blend_factor（默认 0.5） | 按比例混合 |

#### 批次操作

"批次"是一次性处理的 N 张潜空间图（或图像）。

| 节点 | 参数 | 说明 |
|---|---|---|
| 从批次获取Latent `LatentFromBatch` | samples, batch_index, length（1~64） | 从一批里取出第 index 张起的 length 张（挑出满意的那张继续处理） |
| 重设Latent批次 `RebatchLatents` | latents, batch_size | 重新分组 |
| 复制Latent批次 `RepeatLatentBatch` | samples, amount（1~64） | 把同一张复制 N 份（同一个起点出多个变体） |
| 批量 Latents `BatchLatentsNode` | 1~50 个 latent 输入 | 合并成一批；尺寸不同会自动缩放到与第一个一致 |

#### 加载Latent `LoadLatent` / 保存Latent `SaveLatent`

把潜空间图存成 `.latent` 文件（输入目录 / 输出目录），下次直接拿来继续采样，跳过编码步骤。

---

### 3.4 采样（Sampling）

#### K采样器 `KSampler`——最该吃透的节点

它把"加噪 → 逐步去噪"打包好了。每个参数：

| 参数 | 取值 | 默认 | 作用 | 怎么调 |
|---|---|---|---|---|
| model | MODEL | — | 去噪模型（可带 LoRA、补丁） | 接加载器或 LoRA 链的末端 |
| seed | 0 ~ 1.8×10¹⁹ | 0 | 随机噪声的起点。**相同种子 + 相同设置 = 相同图** | 复现时设"固定"；找变体时"随机" |
| steps | 1 ~ 10000 | 20 | 去噪步数 | 预览 15~20；出图 25~40；蒸馏模型 4~12 |
| cfg | 0 ~ 100 | 8.0 | 提示词引导强度（Classifier-Free Guidance） | SD1.5/SDXL 6~8；Anima 4~5；Turbo/LCM 类 **1** |
| sampler_name | 45 种，见下表 | — | 每一步用什么数学方法去噪 | 先用 euler / er_sde，不满意再换 |
| scheduler | 9 种，见下表 | — | 每一步去掉多少噪声的"时间表" | simple / normal 起步 |
| positive | CONDITIONING | — | 正向条件 | 接 CLIP文本编码（正向） |
| negative | CONDITIONING | — | 负向条件 | 接 CLIP文本编码（负向）；CFG=1 时**不起作用** |
| latent_image | LATENT | — | 起始画布 | 文生图接 空Latent图像；图生图接 VAE编码 |
| denoise | 0 ~ 1 | 1.0 | **去噪比例**：1 = 完全重画；越小越保留输入图 | 文生图 1；图生图细化 0.4~0.6；微调 0.2~0.35 |

输出 LATENT（去噪后的潜空间图，还要经 VAE解码 才能看）。

**三个核心概念**

- **CFG**：模型会分别预测"有提示词"和"没提示词"时的噪声，最终方向 = 无条件预测 + **CFG ×**（有条件预测 − 无条件预测）。CFG 越高越听话，过高会过饱和、线条发硬（俗称"烧图"）。**CFG = 1 时结果就等于有条件预测本身，负面提示词完全不起作用**——这就是 Turbo/Lightning 类模型不用写负面的原因。
- **denoise**：只执行 sigma 时间表的后一段。denoise=0.5 时，采样从时间表的中点开始，输入图的结构因此保留一半。⚠️ **步数不会缩水**：源码 `KSampler.set_steps` 先按 `int(steps/denoise)` 生成一份更细的时间表，再取最后 `steps+1` 个 sigma——steps=30、denoise=0.5 仍然跑满 30 步，只是全部落在低噪声半区（比"完整 30 步的后 15 步"更密）。`基本调度器` 的 `denoise` 是同一逻辑。**会真正减少步数**的是另外两处：`K采样器（高级）` 的 `start_at_step / end_at_step`（按全表索引截取，20 步只跑后 10 步就真的只有 10 步）和 `分离Sigma降噪`（按 `round(steps×denoise)` 截取）。因此《递进报告》L7 的两段采样若想每段 30 步，两段的 steps 都要设 60。
- **seed**：决定初始噪声。同一种子下改提示词、改 CFG，才能公平比较参数效果。但**噪声张量的形状跟着 latent 尺寸走**：同一种子在 1024×1024 和 896×1152 下是两张不同的图，固定种子做参数对比时**分辨率也不能动**；batch 内同一 seed 的每张噪声各不相同（《递进报告》L2 利用的正是这一点）；不同显卡 / 精度下同种子也可能有细微差异，跨机器复现不要苛求像素级一致。
- **seed**：决定初始噪声。同一种子下改提示词、改 CFG，才能公平比较参数效果。

> 注：个别中文文档把 denoise 写成"值越低，与输入图像的关联性越小"，这是**译反了**。正确的是：值越低，越接近输入图。

**采样器速查**（共 45 个，源码 `comfy/samplers.py`。下表的风格描述是社区经验的概括，**不同模型表现不同，固定种子实测为准**）

| 采样器 | 特点 | 适用 |
|---|---|---|
| `euler` | 最基础的欧拉法：每步按当前预测走一步。快、稳定、收敛 | 默认首选之一（Anima 官方模板默认） |
| `dpmpp_2m` | DPM++ 2M，多步法：参考上一步的结果做校正。快，20~30 步质量好 | 经典组合 `dpmpp_2m + karras` |
| `er_sde` | 较新的 SDE 采样器，中性、平涂、线条锐利 | Anima 作者推荐的默认。自定义采样里有专门的 **`SamplerER_SDE`** 节点可调它：`solver_type`（ER-SDE / Reverse-time SDE / ODE）、`eta`（1.0；0 即退化为确定性 ODE）、`max_stage`（3）、`s_noise`（源码 `nodes_custom_sampler.py`） |
| `euler_ancestral` | 每步额外注入随机噪声（ancestral=祖先）。变化大、更有想象力；**不收敛**——步数再多画面也在变 | 换种子找惊喜 |
| `dpmpp_2s_ancestral` | 单步 + 随机噪声 | 低步数下细节较多 |
| `dpmpp_2m_sde` / `dpmpp_2m_sde_gpu` | 多步 + 随机（SDE）。细节和纹理更多，种子间差异更大；`_gpu` 版在 GPU 上生成噪声，更快 | 追求质感 |
| `dpmpp_3m_sde` / `dpmpp_3m_sde_gpu` | 三阶多步 SDE，更细腻，更慢 | 高步数出图 |
| `uni_pc` / `uni_pc_bh2` | 统一预测-校正，少步数（10~15）表现好 | 快速出图 |
| `heun` | 每步多评估一次模型来校正（约慢一倍），高步数下质量高 | 步数充足时 |
| `ddim` | 老牌确定式采样器，快 | 配 `ddim_uniform` |
| `lcm` | 配 LCM / Lightning 类蒸馏模型 | 蒸馏模型 |
| 带 `_cfg_pp` 后缀的 7 个 | CFG++ 变体：把引导放进采样步骤内部，画面更不容易过饱和。**此时 cfg 的含义和取值与普通模式不同**，需要试 | 高引导想不烧图 |
| 其余（`dpm_2`、`dpm_2_ancestral`、`heunpp2`、`exp_heun_2_x0`、`lms`、`dpm_fast`、`dpm_adaptive`、`dpmpp_sde`、`ddpm`、`ipndm`、`ipndm_v`、`deis`、`res_multistep`、`seeds_2`、`sa_solver` 等） | 较老或较新，日常很少用到 | 不必纠结 |

"收敛"的意思：步数足够后再加步数，画面基本不再变化。带 `ancestral` / `sde` 的采样器每步都在加随机噪声，所以**不收敛**，每一步的画面都在变。

**调度器速查**（共 9 个。同样是经验概括）

| 调度器 | 时间表特点 | 常见搭配 |
|---|---|---|
| `simple` | 按模型自身的噪声范围安排，较新模型的常用默认 | Anima 模板默认；很多官方模板默认 |
| `normal` | 传统的均匀线性 | SD1.5 + euler |
| `karras` | 按噪声比例重新分配步数，把更多步数给高噪声（定结构）阶段，低噪声阶段步子更大。通常细节更干净 | `dpmpp_2m + karras` |
| `sgm_uniform` | 另一种均匀方式，按模型噪声范围缩放 | SDXL、部分新模型的模板常用 |
| `exponential` | 指数间隔，变化集中在前段。画面更柔和、背景更干净，但损失一些细节 | 快速出图 |
| `beta` | 两端（最高、最低噪声）分配更多步数，中间较少 | 实验 |
| `ddim_uniform` | DDIM 式均匀 | `ddim` |
| `linear_quadratic` | 前段噪声下降更慢 | 实验 |
| `kl_optimal` | 按 KL 散度均衡分配步长 | 实验 |

> 调度器对画质的影响没有采样器和 CFG 大。`euler/simple` 或 `dpmpp_2m/karras` 就能应付绝大多数情况。某些组合在极端参数下会出问题（如 CFG 过高 + karras 容易过饱和），出图"烧"了先降 CFG。

#### K采样器（高级）`KSamplerAdvanced`

把 K采样器的几个动作拆开，可以**从中间开始、在中间停下**——多阶段采样的基础。

| 参数 | 取值 | 默认 | 说明 |
|---|---|---|---|
| model, cfg, sampler_name, scheduler, positive, negative, latent_image | 同 K采样器 | — | 没有 denoise，改用起止步控制 |
| add_noise | `enable` / `disable` | enable | 是否加初始噪声。**第二阶段采样接上一段的输出时要 disable** |
| noise_seed | 整数 | 0 | 加噪用的种子 |
| start_at_step / end_at_step | 0 ~ 10000 | 0 / 10000 | 从第几步开始、到第几步结束。20 步里只跑后 10 步 ≈ denoise 0.5 |
| return_with_leftover_noise | `disable` / `enable` | disable | 是否带着残留噪声输出。分两段用两个节点跑时要 enable |

#### 自定义采样全家桶

K采样器内部其实就是这几个零件。拆开用可以自由组合（每段换模型、换引导方式、自定义时间表）。

| 零件 | 节点 | 关键参数 | 输出 |
|---|---|---|---|
| 选采样方法 | K采样器选择 `KSamplerSelect` | sampler_name（45 选 1） | SAMPLER |
| 定时间表 | 基本调度器 `BasicScheduler` | model, scheduler, steps, denoise（0~1） | SIGMAS |
| 造噪声 | 随机噪波 `RandomNoise` / 禁用噪波 `DisableNoise` | noise_seed | NOISE |
| 定引导方式 | CFG引导器 `CFGGuider` | model, positive, negative, cfg | GUIDER |
| | 基本引导器 `BasicGuider` | model, conditioning（只有一路） | GUIDER |
| 执行采样 | 自定义采样器 `SamplerCustom` | model, add_noise, noise_seed, cfg, positive, negative, sampler, sigmas, latent_image | output, denoised_output |
| | 自定义采样器（高级）`SamplerCustomAdvanced` | noise, guider, sampler, sigmas, latent_image | output, denoised_output |

- **CFG引导器 vs 基本引导器**：前者走正负两路（正常 CFG）；后者只跑一路条件，**CFG 等效于 1 且少算一半**——Turbo/Lightning 这类 CFG=1 的模型用它更快。
- **denoised_output**：采样结束时模型对"干净图"的预测，某些特殊工作流会用到；日常取 `output`。
- **K采样器（高级）与自定义采样怎么选**：前者够用且简单；后者适合"前半段用 A 模型、后半段用 B 模型"这类玩法。

**时间表工具（SIGMAS 类）**

| 节点 | 参数 | 用途 |
|---|---|---|
| 分离Sigma `SplitSigmas` | sigmas, step | 把时间表在第 step 步切成高噪声、低噪声两段 |
| 分离Sigma降噪 `SplitSigmasDenoise` | sigmas, denoise（0~1） | 按去噪比例切两段 |
| 翻转Sigma `FlipSigmas` | sigmas | 倒序，用于 img2img 反向等特殊玩法 |
| 自定义Sigmas `ManualSigmas` | sigmas（字符串，如 `1, 0.5, 0.1`） | 手写时间表 |
| Karras调度器 `KarrasScheduler` | steps, sigma_max, sigma_min, rho | 手动设定 Karras 时间表的上下限与形状 |
| SDTurbo调度器 `SDTurboScheduler` | model, steps（1~10）, denoise | SD-Turbo 专用 |
| CFG 覆盖 `CFGOverride` | model, cfg, start_percent, end_percent | 在采样的某一段把 CFG 强制改成固定值 |


---

### 3.5 图像（Image）

蓝色 IMAGE 是"真正的图"。这一类负责读入、缩放、裁剪、拼接、调色和输出。

#### 加载与输出

| 节点 | 参数 | 输出 | 说明 |
|---|---|---|---|
| 加载图像 `LoadImage` | image（点 Upload 上传，或选 `ComfyUI/input/` 里的文件） | IMAGE, **MASK** | MASK 输出 = 图片自带的透明通道（没有透明通道时是全黑）。右键 → 在蒙版编辑器中打开，可以涂抹遮罩 |
| 加载图像（来自输出）`LoadImageOutput`（实验性） | image（带刷新按钮） | IMAGE, MASK | 从输出目录取图，刷新后自动选第一张，适合"生成→修改→再生成"的迭代 |
| 保存图像 `SaveImage` | images；filename_prefix（默认 `ComfyUI`） | 输出节点 | 存到 `ComfyUI/output/`。前缀可用 `/` 建子文件夹，支持变量：`%date:yyyy-MM-dd%`、`%节点名.width%` |
| 预览图像 `PreviewImage` | images | 输出节点 | 只在节点里显示，**不写入输出目录**（调试用） |
| 保存图像（高级）`SaveImageAdvanced` | images；filename_prefix；format（png 等，含位深、色彩空间、通道） | 输出节点 | 需要控制格式时用 |
| 图像对比 `ImageCompare` | image_a, image_b | 输出节点 | 滑块式左右对比两张图（看放大/修图前后差异） |
| 保存动画（WEBP）`SaveAnimatedWEBP` / 保存动画（APNG）`SaveAnimatedPNG` | images（一批=各帧）；fps（默认 6）；lossless / quality 或 compress_level | 输出节点 | 把一批图合成动图 |

> ⚠️ 上传的图片放在 `ComfyUI/input/`。文件名和路径尽量用英文，避免个别节点读取异常。

#### 缩放与放大

| 节点 | 参数 | 说明 |
|---|---|---|
| 缩放图像 `ImageScale` | upscale_method：`nearest-exact` / `bilinear` / `area` / `bicubic` / `lanczos`；width, height；crop：`disabled` / `center` | 缩放到**指定尺寸**（比例会被拉伸，除非开 crop）。纯数学插值，不增加真实细节 |
| 缩放图像（比例）`ImageScaleBy` | upscale_method；scale_by（0.01~8，默认 1.0） | 按倍率缩放，保持比例 |
| 缩放图像（像素）`ImageScaleToTotalPixels` | upscale_method；megapixels（0.01~16，默认 1.0）；resolution_steps | 缩放到指定总像素（1.0MP ≈ 1024×1024），保持比例。官方 SeedVR2 教程：放大前先用它缩到 0.35MP 效果更好 |
| 图像缩放到最大尺寸 `ImageScaleToMaxDimension` | upscale_method；largest_size（默认 512） | 长边缩到指定长度 |
| **调整图像/掩码大小** `ResizeImageMaskNode` | input（图像或遮罩都行）；resize_type：按尺寸 / 按倍率 / 按长边 / 按短边 / 按宽 / 按高 / 按总像素 / **匹配另一张图** / 缩放到某数的倍数；crop；scale_method | 新版的统一缩放节点，一个顶过去好几个 |
| **使用模型放大图像** `ImageUpscaleWithModel` | upscale_model；image | 用 AI 放大模型（ESRGAN 等）放大，**会重建细节**。内部自动分块（512 一块、重叠 32），大图也不容易爆显存 |

插值方法怎么选（官方 tooltip）：**缩小用 `area`，放大用 `lanczos`，像素风用 `nearest-exact`**。

三种"放大"的区别：

| 方式 | 做法 | 得到 | 代价 |
|---|---|---|---|
| 数学插值 | 缩放图像 / 缩放Latent | 只是变大，不增加细节 | 极快 |
| AI 放大模型 | 使用模型放大图像 | 变大且细节变丰富 | 需要模型文件，中等 |
| 放大 + 二次采样 | 任一种放大后接 K采样器（低 denoise） | 细节由生图模型重新"画"出来 | 最慢，效果最好 |

#### 裁剪、扩展、拼接

| 节点 | 参数 | 说明 |
|---|---|---|
| 图像裁剪 `ImageCropV2` | image；crop_region（x, y, width, height 的框选控件，越界自动收缩） | 裁一块。旧版 `ImageCrop`（裁剪图像）已弃用 |
| 裁剪图像（中心）`CenterCropImages` | width, height（1~8192） | 中心裁剪 |
| **外补画板** `ImagePadForOutpaint` | image；left, top, right, bottom（各方向补多少像素）；feathering（默认 40） | 给图四周补边，输出补边后的 IMAGE + 标出新区域的 MASK。扩图（Outpaint）的第一步 |
| 图像拼接 `ImageStitch` | image1, image2；direction：`right` / `down` / `left` / `up`；match_image_size（默认开）；spacing_width（偶数）；spacing_color | 把 image2 接到 image1 的某个方向 |
| 图像翻转 `ImageFlip` / 图像旋转 `ImageRotate` | `x-axis: vertically` / `y-axis: horizontally`；`none` / `90` / `180` / `270 degrees` | 翻转与旋转 |

#### 批次

| 节点 | 参数 | 说明 |
|---|---|---|
| 从批次获取图像 `ImageFromBatch` | image；batch_index；length（1~4096） | 从一批图里取第 index 张起的 length 张 |
| 重设图像批次 `RebatchImages` | images；batch_size | 重新分组 |
| 批量图像 `BatchImagesNode` | 2~50 个 image 输入 | 合并成一批（尺寸不同会缩放到与第一张一致） |
| 旧版 组合图像批次 `ImageBatch` | image1, image2 | 已弃用，用上面的 |

#### 合成与调色

| 节点 | 参数 | 说明 |
|---|---|---|
| 合成图像（遮罩）`ImageCompositeMasked` | destination, source, x, y, resize_source, mask（可选） | 把 source 按坐标贴到 destination 上，有 mask 则只贴遮罩内（把局部重绘的小图贴回原图） |
| 合并图像Alpha `JoinImageWithAlpha` / 分离图像Alpha `SplitImageWithAlpha` | image + alpha / image | RGB 图 + 遮罩 → 带透明的 RGBA 图 / 反向拆开 |
| 空图像 `EmptyImage` | width, height, batch_size, color | 纯色底图（做拼贴的底板） |
| 反转图像 `ImageInvert` | image | 颜色取反 |
| 模糊图像 `ImageBlur` | blur_radius（1~31）；sigma（0.1~10） | 高斯模糊 |
| 锐化图像 `ImageSharpen` | sharpen_radius；sigma；alpha（0~5） | 锐化，alpha 是强度 |
| 混合图像 `ImageBlend` | image1, image2；blend_factor（默认 0.5）；blend_mode：`normal` / `multiply` / `screen` / `overlay` / `soft_light` / `difference` | 图层混合 |
| 获取图像尺寸 `GetImageSize` | image | 输出 width、height、batch_size，可接到别的节点参数上 |
| 图像表格 `ImageGrid` | images；columns（默认 4）；单元格宽高（默认 256）；spacing | 把一批图排成网格拼图，**做参数对比图**必备 |

---

### 3.6 遮罩（Mask）

绿色 MASK 是单通道灰度图：**白色（1）= 生效，黑色（0）= 不生效**，灰度表示"部分生效"。用于局部重绘、扩图、分区条件、模型补丁的局部作用等。

| 节点 | 参数 | 说明 |
|---|---|---|
| 遮罩转换为图像 `MaskToImage` | mask | 把遮罩当灰度图显示。接"预览图像"就能看到遮罩长什么样 |
| 图像转换为遮罩 `ImageToMask` | image；channel：`red` / `green` / `blue` / `alpha` | 取某个通道当遮罩（比如用一张黑白图的红色通道） |
| 加载图像（作为遮罩）`LoadImageMask` | image；channel（`alpha` / `red` / `green` / `blue`） | 直接把外部图片文件读成遮罩 |
| 纯块遮罩 `SolidMask` | value（0~1）；width, height | 整张全白/全黑/半灰的遮罩 |
| 羽化遮罩 `FeatherMask` | mask；left, top, right, bottom | 四条边向内羽化的像素数 |
| 扩展遮罩 `GrowMask` | mask；expand（正=向外扩，负=向内缩）；tapered_corners（默认开） | **把涂抹范围扩大几像素**，保证边缘完整覆盖；负值收缩 |
| 反转遮罩 `InvertMask` | mask | 黑白互换 |
| 合成遮罩 `MaskComposite` | destination, source, x, y；operation：`multiply` / `add` / `subtract` / `and` / `or` / `xor` | 两个遮罩做运算（`subtract` = 从 A 里挖掉 B） |
| 裁剪遮罩 `CropMask` | mask；x, y, width, height | 裁一块 |
| 遮罩阈值 `ThresholdMask` | mask；value（默认 0.5） | 按阈值二值化，去掉灰色的半透明 |
| 预览遮罩 `MaskPreview` | mask | 输出节点，直接显示遮罩 |
| 批量 mask `BatchMasksNode` | 1~50 个 mask | 合并成一批 |

> 局部重绘时遮罩通常要比目标区域**略大一点**（`扩展遮罩` expand 4~16，或 VAE编码（局部重绘）的 `grow_mask_by`），否则边缘会留下原图的残影。

---

### 3.7 模型修补与融合

这一类节点都是 **MODEL 进、MODEL 出**，串在加载器和采样器之间，给模型"打补丁"。

#### 采样算法（ModelSampling 系列）

手动指定模型的预测方式和噪声范围，一般在模型自带信息不对、或要微调时间表时使用。

| 节点 | 参数 | 说明 |
|---|---|---|
| 采样算法（离散）`ModelSamplingDiscrete` | sampling：`eps` / `v_prediction` / `lcm` / `x0` / `img_to_img` / `img_to_img_flow`；zsnr（默认关） | 改变预测目标类型 |
| 采样算法（连续EDM）`ModelSamplingContinuousEDM` | sampling：`v_prediction` / `edm` / `edm_playground_v2.5` / `eps` / `cosmos_rflow`；sigma_max（默认 120）；sigma_min（默认 0.002） | EDM 系模型 |
| 采样算法（SD3）`ModelSamplingSD3` | shift（默认 3.0） | 时间表偏移，数值越大越多步数留给高噪声阶段 |
| 采样算法（AuraFlow）`ModelSamplingAuraFlow` | shift（默认 1.73）；sampling（`flow` / `img_to_img_velocity`） | AuraFlow 模型 |

> `shift` 类参数影响"细节 vs 构图"的步数分配，是进阶调优项；新手先用模型/模板的默认值。

#### 引导与稳定

| 节点 | 参数 | 说明 |
|---|---|---|
| 缩放CFG `RescaleCFG` | model；multiplier（0~1，默认 0.7） | 重新缩放模型输出，社区常用来缓解高 CFG 下的过饱和 |
| 自注意力引导 `SelfAttentionGuidance`（实验性） | model；scale（默认 0.5）；blur_sigma（默认 2） | 利用模型自身的注意力改善细节 |
| 差异扩散 `DifferentialDiffusion`（实验性） | model；strength（可选，默认 1） | 让遮罩的**灰度渐变**真正生效：边缘按深浅逐步过渡。常与 VAE编码（局部重绘）的遮罩搭配 |
| Perp-Neg 引导器 `PerpNegGuider`（实验性） | model, positive, negative, empty_conditioning, cfg, neg_scale | 垂直负向引导，输出 GUIDER 接自定义采样器 |

#### 模型融合（进阶）

| 节点 | 参数 | 说明 |
|---|---|---|
| 模型融合（简易）`ModelMergeSimple` | model1, model2；ratio（0~1） | **ratio=1 → 全是 model1；ratio=0 → 全是 model2** |
| 模型融合（分块）`ModelMergeBlocks` | model1, model2；input / middle / out（各 0~1） | 按网络区块分别设比例（比如输入层用 A、输出层用 B） |
| ModelAdd / ModelSubtract | model1, model2（相减另有 multiplier） | 权重直接加减 |
| 保存Checkpoint `CheckpointSave` | model, clip, vae；filename_prefix（默认 `checkpoints/ComfyUI`） | 把融合/挂了 LoRA 的模型存成 checkpoint 文件 |
| 保存模型 `ModelSave` | model；filename_prefix | 存成单独的扩散模型文件 |

#### 精度与设备

| 节点 | 参数 | 说明 |
|---|---|---|
| ModelComputeDtype | model；dtype：`default` / `fp32` / `fp16` / `bf16` | 改模型计算的精度。显存紧张时用 fp16/bf16 |
| VAE 计算数据类型 `VAEComputeDtype` | vae；dtype | 只改 VAE 编解码的精度，不影响其他分支 |

#### 应用 Anima LLLite `AnimaLLLiteApply`（实验性，Anima 专用）

Anima 的 ControlNet。模型文件放 `models/model_patches/`，用"加载模型补丁"读入。

| 参数 | 取值 | 默认 | 说明 |
|---|---|---|---|
| model | MODEL | — | 基础模型 |
| model_patch | MODEL_PATCH | — | LLLite 权重（any / depth / lineart / pose / scribble / inpainting 各一个文件） |
| image | IMAGE | — | 控制图（只用 RGB 三通道） |
| strength | -10 ~ 10 | 1.0 | 控制强度 |
| start_percent / end_percent | 0 ~ 1 | 0 / 1 | 生效的时间段 |
| mask（可选） | MASK | — | 只在遮罩区域内应用控制 |

需要 ComfyUI 0.29 以上。

---

### 3.8 工具与逻辑节点

这些节点不直接生图，但能让工作流**可调、可比、可自动化**。核心用法：把它们的输出**拖到别的节点控件上**，把控件变成输入。

| 节点 | 参数 | 输出 | 用途 |
|---|---|---|---|
| 整数 `PrimitiveInt` / 浮点数 `PrimitiveFloat` | value | INT / FLOAT | 给 seed、steps、cfg、强度等传固定值 |
| 字符串 `PrimitiveString` / 字符串（多行）`PrimitiveStringMultiline` | value | STRING | 把提示词抽出来集中管理 |
| 布尔值 `PrimitiveBoolean` | value | BOOLEAN | 开关 |
| 种子 `SeedNode` | seed（生成后控制默认"固定"） | INT | 单独管理种子 |
| **分辨率选择器** `ResolutionSelector` | aspect_ratio（默认 `1:1 (Square)`）；megapixels（0.1~16，默认 1.0）；multiple（默认 8） | width, height | 选比例和总像素，输出接到 空Latent图像 的 width/height。有实时预览 |
| 数学表达式 `ComfyMathExpression` | expression（如 `a + b`）；values（a, b, c… 自动命名） | Float, Int, Boolean | 做运算（比如步数 × 2） |
| 切换 `ComfySwitchNode` | switch；on_true；on_false | 同输入类型 | **二选一开关**：只计算被选中的那一路（惰性求值）。用来在两个模型/两组参数间切换 |
| 与 / 或 / 非 `ComfyAndNode` / `ComfyOrNode` / `ComfyNotNode` | values | BOOLEAN | 逻辑运算 |
| 非 `InvertBooleanNode` | boolean | BOOLEAN | 布尔取反 |
| 数字转换 `ComfyNumberConvert` | value | Float, Int | 把字符串/布尔转成数字 |
| 分支 `BranchNode` | 多个命名输入 + branch（选哪个） | 同输入类型 | 多选一，按名字挑一路透传 |
| 创建列表 `CreateList` | 若干同类型输入 | 列表 | 把多个值合成列表 |
| 从列表获取项目 `GetItemFromList` | list；index | 单个值 | 取第 N 项 |
| 预览任意 `PreviewAny` | source | 输出节点 | 把任何数据以文本形式显示出来（调试） |
| 开始循环 `StartLoop` / 结束循环 `EndLoop` | 模式：simple（迭代 N 次）/ For / List | iteration_index, is_first, is_last, 当前项, 当前值 | 让一段节点循环执行（逐批细化、迭代修图） |

**列表的妙用**：当一个节点的某个输入收到**列表**时，ComfyUI 会对列表里**每一项各跑一次**该节点及其下游，再汇总。所以：

- 3 个"整数"节点 → 创建列表 → 接到 K采样器的 `seed`：一次出 3 个种子的图。
- 3 个"浮点数"（CFG 3 / 6 / 9）→ 创建列表 → 接到 K采样器的 `cfg`，种子固定：一次得到 CFG 对比图。
- 3 个"字符串（多行）"→ 创建列表 → 接到 CLIP文本编码的 `text`：一次跑 3 条提示词。
- 结果接 `图像表格` 再接 `保存图像`：得到一张拼好的对比图。


---

## 4. 典型工作流怎么搭

下面每种工作流都用"**谁.输出 ──▶ 谁.输入**"的写法给出全部连线，照着连即可。所有工作流的最后一步都是 `K采样器.LATENT ──▶ VAE解码 ──▶ 保存图像`，后文不再重复画。

### 4.1 文生图（整包 checkpoint，如 SD1.5 / SDXL）

```
Checkpoint加载器（简易）.MODEL ──▶ K采样器.model
Checkpoint加载器（简易）.CLIP  ──▶ CLIP文本编码(正向).clip
Checkpoint加载器（简易）.CLIP  ──▶ CLIP文本编码(负向).clip
Checkpoint加载器（简易）.VAE   ──▶ VAE解码.vae
CLIP文本编码(正向) ──▶ K采样器.positive
CLIP文本编码(负向) ──▶ K采样器.negative
空Latent图像 ──▶ K采样器.latent_image
```

节点数：7 个（加载器 ×1、文本编码 ×2、空Latent ×1、K采样器 ×1、VAE解码 ×1、保存图像 ×1）。

| 参数 | SD1.5 | SDXL | 备注 |
|---|---|---|---|
| 空Latent图像 尺寸 | 512×512（或 512×768） | 1024×1024（或 896×1152） | |
| steps | 20~30 | 25~30 | |
| cfg | 6~8 | 5~7 | |
| sampler / scheduler | euler / normal 或 dpmpp_2m / karras | 同左，或 sgm_uniform | |
| denoise | 1.0 | 1.0 | |

### 4.2 文生图（拆分模型，Anima）

把 4.1 里的 Checkpoint加载器 换成三个加载器：

```
UNet加载器(anima-base-v1.0).MODEL ──▶ K采样器.model
加载CLIP(qwen_3_06b_base, type=stable_diffusion).CLIP ──▶ 两个 CLIP文本编码.clip
加载VAE(qwen_image_vae).VAE ──▶ VAE解码.vae
```

其余连线不变。参数（Anima）：1024×1024 左右、steps 30、cfg 4、`euler/simple`（官方模板）或 `er_sde`（模型卡推荐）。想加速：把 `anima-turbo-lora-v0.2` 用 **LoRA加载器（仅模型）** 串在 UNet加载器 与 K采样器 之间，steps 改 8、cfg 改 1。

### 4.3 图生图

在 4.1/4.2 基础上只改一处：**起始画布从"空白"换成"你的图"**。

```
加载图像.IMAGE ──▶ VAE编码.pixels
VAE编码.vae ◀── 加载器的 VAE
VAE编码.LATENT ──▶ K采样器.latent_image        （空Latent图像 不再需要）
K采样器.denoise = 0.4 ~ 0.7
```

| denoise | 效果 |
|---|---|
| 1.0 | 等于文生图，只借用尺寸，内容全变 |
| 0.7 ~ 0.9 | 大改：换风格、换内容，保留大致构图 |
| 0.4 ~ 0.6 | 细化：官方两段式工作流用的区间，结构不变、细节重画 |
| 0.2 ~ 0.35 | 微调：只动一点 |

⚠️ 输入图的尺寸就是输出尺寸。先用"缩放图像"把输入图调到模型舒服的分辨率，否则大图直接编码容易构图崩坏。

### 4.4 局部重绘（Inpaint）

在图生图基础上加"遮罩"。有专用 inpainting 模型时：

```
加载图像.IMAGE ──▶ VAE编码（局部重绘）.pixels
加载图像.MASK ──▶ VAE编码（局部重绘）.mask      （在加载图像节点上右键 → 蒙版编辑器 涂抹）
加载器的 VAE ──▶ VAE编码（局部重绘）.vae
VAE编码（局部重绘）.LATENT ──▶ K采样器.latent_image      denoise = 1.0

加载图像.IMAGE ──▶ 内补模型条件.pixels
加载图像.MASK ──▶ 内补模型条件.mask
加载器的 VAE ──▶ 内补模型条件.vae
CLIP文本编码(正向) ──▶ 内补模型条件.positive ──▶ K采样器.positive
CLIP文本编码(负向) ──▶ 内补模型条件.negative ──▶ K采样器.negative
```

没有专用模型时（Anima 属于这种情况）：把 `VAE编码（局部重绘）` 照常使用，去掉"内补模型条件"，文本编码直接接 K采样器；或用 `VAE编码` + `设置Latent噪波遮罩`。更彻底的做法是裁剪法：

```
加载图像 ──▶ 图像裁剪（只裁出目标区域，周围留余量）──▶ VAE编码 ──▶ K采样器(denoise 1)
加载图像.MASK ──▶ 裁剪遮罩（同样的 x,y,w,h）──▶ VAE编码（局部重绘）.mask ...
K采样器.LATENT ──▶ VAE解码.IMAGE ──▶ 合成图像（遮罩）.source
加载图像.IMAGE ──▶ 合成图像（遮罩）.destination      x,y = 裁剪时的坐标
```

裁剪法的好处：小区域放大到整个画布去重绘，细节远好于在整图上涂一小块。

要点：提示词描述**遮罩区域内想出现的东西**（而不是整张图）；遮罩比目标大一圈；效果不满意换种子多跑几次。

### 4.5 扩图（Outpaint）

局部重绘的变体，只是遮罩来自"外补画板"：

```
加载图像.IMAGE ──▶ 外补画板.image        （设 left/top/right/bottom，各方向补多少像素）
外补画板.IMAGE ──▶ VAE编码（局部重绘）.pixels
外补画板.MASK  ──▶ VAE编码（局部重绘）.mask
```

后面同 4.4。`feathering` 控制新旧区域的过渡宽度（默认 40）。

### 4.6 放大：从低分辨率出大图

**A. 放大模型（最简单）**

```
VAE解码.IMAGE ──▶ 使用模型放大图像.image
加载放大模型.UPSCALE_MODEL ──▶ 使用模型放大图像.upscale_model
使用模型放大图像.IMAGE ──▶ 保存图像
```

4x-ESRGAN 直接把 1024 变 4096。⚠️ 动漫插画类慎用写实向放大模型，容易把平涂线条"锐化过头"；给插画风选专门的放大模型，或用下面的方法。

**B. Latent 放大 + 二次采样（两段式，官方推荐）**

```
K采样器①.LATENT ──▶ 缩放Latent（比例）.samples      scale_by = 1.5
缩放Latent（比例）.LATENT ──▶ K采样器②.latent_image   denoise = 0.4 ~ 0.6
K采样器② ──▶ VAE解码 ──▶ 保存图像
```

第二段可以换模型、换 LoRA、换采样器。步数不宜过多（20~25），denoise 过高会改变构图，过低则细节不增。⚠️ 总分辨率别超过模型的舒适区太多（Anima 建议基础画幅不超过 1536²，倍率不超过 1.5），否则会糊、会花。

**C. 像素放大 + 图生图细化**

```
VAE解码.IMAGE ──▶ 缩放图像（或 使用模型放大图像）──▶ VAE编码.pixels ──▶ K采样器②(denoise 0.3 ~ 0.5)
```

比 B 稳定（不直接插值潜空间），但多一次编解码。

**D. 更强的方案**：SeedVR2 等扩散式修复放大模型（官方有效果对比与工作流），或分层放大（自定义节点）。有风格化的插画优先选"保守型"放大，免得细节跑偏。

**E. 分块放大（Tiled upscale）——突破"单段 1.5×"上限的标准做法**

A~C 三条路线都受"单段放大倍率"限制；要出 2K/4K 的通行做法是**先放大、再分块低 denoise 重绘、拼回**：每块都落在模型的舒适分辨率内，整图就不"烧"，代价是块与块的接缝要处理。社区标准节点是 **`UltimateSDUpscale`**（`ssitu/ComfyUI_UltimateSDUpscale`，Manager 搜 `comfyui_ultimatesdupscale`），它把"放大模型 → 切块 → 每块 img2img → 拼回 → 接缝修复"打包成一个节点：

```
VAEDecode①.IMAGE ───────────────────────────────▶ UltimateSDUpscale.image
UNETLoader / LoRA 链末端.MODEL ──────────────────▶ UltimateSDUpscale.model
CLIPTextEncode(正向 / 负向).CONDITIONING ─────────▶ UltimateSDUpscale.positive / negative
VAELoader.VAE ───────────────────────────────────▶ UltimateSDUpscale.vae
UpscaleModelLoader(动漫向 4x).UPSCALE_MODEL ─────▶ UltimateSDUpscale.upscale_model
UltimateSDUpscale.IMAGE ──▶ SaveImage
```

| 参数 | 起始值 | 说明 |
|---|---|---|
| `upscale_by` | 2 | 目标倍率（1024² → 2048²） |
| `tile_width / tile_height` | 1024 | 每块尺寸，取模型舒适区（Anima 约 1 MP） |
| `tile_padding` | 32 ~ 64 | 块与块的重叠，接缝明显就加 |
| `denoise` | 0.3 ~ 0.5 | 每块重绘强度（原版脚本作者 Coyote-A 给的区间）；过高会改细节 |
| `mode_type` | Chess | Linear 按行切；Chess 棋盘错位让相邻块不同时处理，接缝更隐蔽 |
| `steps / cfg / sampler / scheduler` | 20 ~ 30 / 4 / `euler` / `simple` | 每块采样参数，同 L4 二次采样 |
| `mask_blur` / `seam_fix_*` | 默认 | 块边缘羽化与二次接缝修复，先用默认 |

核心节点也能手工搭（`图像裁剪` → 逐块 `VAE编码` → `K采样器` 低 denoise → `VAE解码` → `合成图像（遮罩）`），但接缝处理繁琐，不如直接用现成节点。

**放大之后（出"成品"的最后几步）**：① 轻度锐化 `锐化图像`（`sharpen_radius` 1~2、`alpha` 0.3~0.5 起步，平涂画风极易过头）；② 用 `图像裁剪` 做最终构图裁切；③ `保存图像` 只写 PNG（无损但大），交付 / 分享用的 JPEG/WebP 在 ComfyUI 外批量转换最省事；④ 脸 / 手问题要在放大**之前**解决（《递进报告》L6 路线 E），放大后再修会把接缝和风格差一并放大。

### 4.7 LoRA

```
加载器.MODEL ──▶ 加载LoRA①.model      加载器.CLIP ──▶ 加载LoRA①.clip
加载LoRA①.MODEL ──▶ 加载LoRA②.model    加载LoRA①.CLIP ──▶ 加载LoRA②.clip
加载LoRA②.MODEL ──▶ K采样器.model      加载LoRA②.CLIP ──▶ CLIP文本编码.clip
```

- 文本编码器的 clip 线**也要从 LoRA 链的末端接**，否则 `strength_clip` 不生效。
- `strength_model` 从 0.7~1.0 起调；画风太抢就降，角色特征不够就升。
- 拆分模型（Anima）用 `LoRA加载器（仅模型）`，只串 model 线。
- 想 A/B 对比某个 LoRA？选中它按 `Ctrl+B`。

### 4.8 ControlNet

```
加载图像(控制图).IMAGE ──▶ 应用ControlNet（高级）.image
加载ControlNet模型.CONTROL_NET ──▶ 应用ControlNet（高级）.control_net
CLIP文本编码(正向) ──▶ 应用ControlNet（高级）.positive ──▶ K采样器.positive
CLIP文本编码(负向) ──▶ 应用ControlNet（高级）.negative ──▶ K采样器.negative
```

多个 ControlNet 串联：前一节的 positive/negative 输出接后一节输入。**先用小强度（0.5~0.7）**，不够再加；`end_percent` 调到 0.8 左右让模型自由收尾。预处理（原图 → 线稿/深度/姿态）需要社区节点包 `comfyui_controlnet_aux`。

Anima：把"应用ControlNet（高级）"换成"应用 Anima LLLite"，它接的是 model 线而不是条件线。

### 4.9 批量与参数网格

| 需求 | 做法 |
|---|---|
| 同一提示词出 N 个变体 | 种子设"随机"，Run 栏的批量次数设 N（排队 N 次）；或 空Latent图像.batch_size = N（一次采样 N 张，更吃显存） |
| 指定的几个种子 | N 个 `整数` 节点 → `创建列表` → 接 K采样器.seed |
| 一条提示词 × 多个 CFG | N 个 `浮点数` → `创建列表` → 接 K采样器.cfg（种子固定） |
| 多条提示词各出一张 | N 个 `字符串（多行）` → `创建列表` → 接 CLIP文本编码.text |
| 自动重跑 | 队列模式选 `Run (On Change)` |
| 拼成对比图 | VAE解码 → `图像表格` → 保存图像 |

---

## 5. 调参手册与排错

### 5.1 "我想要……该调什么"

| 目标 | 调这里 |
|---|---|
| 构图/人物完全换一个 | 换种子 |
| 更贴合提示词 | 提高 CFG（小幅）；或把关键内容写得更靠前、加权重 |
| 画面过饱和、线条发硬、"烧了" | 降 CFG；换调度器（karras → normal/simple）；试 `_cfg_pp` 采样器 |
| 细节更多 | 加步数；换 `dpmpp_2m_sde` / `dpmpp_3m_sde`；或放大后二次采样 |
| 更有变化/更梦幻 | `euler_ancestral` 等 ancestral 采样器 |
| 出图更快 | 降步数；换 Turbo/Lightning 版模型（CFG=1）；用 `基本引导器` |
| 图生图保留更多原图 | 降 denoise |
| 手/脸崩 | 局部重绘（裁剪法）；或放大后二次采样 |
| 背景太简单 | 提示词里具体描述背景；用 ControlNet 深度/线稿约束 |
| 局部重绘有接缝 | 扩大遮罩（`扩展遮罩` / `grow_mask_by`）；羽化；裁剪法 |
| 放大后糊/花 | 降二次采样的 denoise；降放大倍率；分两次放大 |
| 出图重复出现两个人/构图乱 | 分辨率超出模型舒适区 → 降到约 1MP，再放大 |

### 5.2 调试方法

1. **固定种子**再调参——否则分不清是参数的作用还是运气。
2. **一次只改一个变量**；用 `图像表格` 把结果拼起来看。
3. **用 Bypass 做减法**：效果不对时逐个 `Ctrl+B` 关掉 LoRA、ControlNet、补丁，定位是谁的问题。
4. **加预览节点**：在 VAE解码 后接 `预览图像`，在遮罩后接 `预览遮罩`，随时看到中间结果。
5. **部分执行**：选中某个输出节点点蓝色三角，只跑那条分支。
6. **看日志、读 traceback**：`Ctrl+反引号` 打开底部日志；桌面版另有 设置 → 日志（文件在 `%APPDATA%\Comfy Desktop\logs`）；便携版就是启动的那个命令行窗口。读 Python 报错的方法：
   - **从最后一行往上读**：最后一行是错误类型（`CUDA out of memory`、`ImportError`、`KeyError`、`AttributeError`…），它上面一行通常是出错原因的人话描述。
   - **找第一处"你的"文件**：traceback 里第一处出现 `custom_nodes/…`、`nodes.py` 或 `comfy_extras/…` 的行就是真正出错的位置；它上面的 `comfy/…`、`torch/…` 只是调用链。
   - 常见模式：

   | 报错里的关键字 | 多半意味着 | 处理 |
   |---|---|---|
   | `CUDA out of memory` / `OutOfMemoryError` | 显存不够（若只在 VAE 阶段，是解码爆显存） | 降分辨率 / batch；`VAE解码（分块）`；启动参数 `--cpu-vae`、`--reserve-vram`（§5.5） |
   | `ImportError` / `ModuleNotFoundError` / `cannot import name` | 自定义节点与当前 ComfyUI 版本不兼容，或依赖没装 | `--disable-all-custom-nodes` 定位；Manager 更新 / 重装该节点 |
   | `does not exist` / 缺失节点 | 工作流引用了未安装的节点（常见于导入旧工作流） | 右侧面板"错误 → 缺失节点包 → 全部安装" |
   | `Required input is missing` | 必填输入没连线 | 按提示补线 |
   | `Return type mismatch` | 节点版本变化导致输出类型变了 | 更新该节点 / ComfyUI；或换成新版节点 |
   | `size mismatch` / `shape … must match` | 尺寸不同的图做合成 / 拼批，或遮罩与图尺寸不同 | `调整图像/掩码大小` 的"匹配另一张图" |
   | `Exception in … node` 后面缩进的一段 | 某节点内部报错 | 看缩进里的最后一行，而不是外面那行 |

   PNG 里嵌的工作流能还原"怎么连的"，但**报错那一刻的 seed / 参数不会自动记下来**——配合《补充A》的实验记录。

### 5.3 常见报错与现象

| 现象 | 原因 | 解决 |
|---|---|---|
| 加载节点变红，提示模型缺失 | 文件没下/放错目录 | 对照 3.1 的文件夹表；放好按 `R` |
| 工作流里有红色"缺失节点" | 用了未安装的自定义节点，或 ComfyUI 版本太旧 | 右侧面板 → 错误 → 缺失节点包 → 全部安装；或更新 ComfyUI |
| `Required input is missing` | 某个必填输入没连线 | 按提示找到节点补连线 |
| 下拉列表里找不到刚放的模型 | 未刷新 | 按 `R`，或重启 |
| 尺寸不匹配报错 | 两张尺寸不同的图做批次/合成，或遮罩与图尺寸不同 | 用 `调整图像/掩码大小` 的"匹配另一张图" |
| 尺寸不是 8 的倍数报错 | 宽高设错 | 改成 8 的倍数 |
| 出图发灰/发白/全是噪点 | VAE 不匹配 | 用模型配套的 VAE |
| 运行中途显存不足（OOM） | 分辨率/批次太大 | 降分辨率；`batch_size` 改 1；VAE 换分块版；UNet加载器 选 fp8；关掉占显存的程序 |
| 一张全黑图 | VAE 没接或接错 | 检查 VAE解码.vae |
| 纯文字提示效果差 | 模型对自然语言支持有限 | 用标签式提示词；或换支持的模型 |
| 导入的工作流和截图不一样 | 节点版本变化 | 对照官方模板重新连 |

### 5.4 速度与显存

| 手段 | 效果 |
|---|---|
| 分辨率降到约 1MP，最后再放大 | 最有效 |
| `batch_size` = 1 | 省显存 |
| UNet加载器.weight_dtype = `fp8_e4m3fn` | 省显存，适合 8~12GB 卡跑大模型 |
| `VAE解码（分块）` | 大图解码不爆显存 |
| 蒸馏版模型（Turbo/Lightning）+ CFG 1 + `基本引导器` | 步数少 + 少算一路，数倍提速 |
| 先 Turbo 试稿、定稿再换完整模型 | 官方推荐的工作节奏 |

### 5.5 启动参数与 Attention 后端（命令行）

这些参数加在启动命令后面：便携版编辑 `.bat` 里 `python -s main.py` 之后那一段；桌面版在构建页 → **Startup arguments**；手动安装直接加在 `python main.py` 后。下表全部取自源码 `comfy/cli_args.py`；**同一格内的参数互斥**。

| 目的 | 参数 | 说明 |
|---|---|---|
| 显存不够 | `--lowvram` / `--novram` | 当前默认启用动态显存管理（dynamic VRAM），此时 `--lowvram` 基本无效（只让文本编码器跑 CPU），`--novram` 更激进。先靠节点侧解决：降分辨率、fp8、分块 VAE |
| | `--reserve-vram <GB>` | 给系统 / 其它程序预留显存；默认按操作系统预留一部分 |
| | `--cpu-vae` | VAE 跑 CPU，解码大图时不抢显存（慢） |
| | `--disable-smart-memory` | 用完就卸载到内存：更省显存、更慢 |
| 精度（全局强制） | `--fp16-unet` / `--bf16-unet` / `--fp32-unet` / `--fp8_e4m3fn-unet` / `--fp8_e5m2-unet` | 等价于在每个 UNet加载器 里选 `weight_dtype` |
| | `--fp16-vae` / `--bf16-vae` / `--fp32-vae` | 源码原话：`--fp16-vae` "可能导致黑图"；Anima 用配套 VAE 时保持默认 |
| | `--fp16-text-enc` / `--bf16-text-enc` / `--fp32-text-enc` / `--fp8_e4m3fn-text-enc` | 文本编码器精度 |
| Attention 后端（速度 / 显存 / 画质） | `--use-pytorch-cross-attention` / `--use-sage-attention` / `--use-flash-attention` / `--use-ck-attention` / `--use-split-cross-attention` / `--use-quad-cross-attention` | PyTorch 2.x 自带的注意力最稳；SageAttention / FlashAttention 更快但要装对应扩展；split / quad 是省显存的老方案；`ck` 是 Comfy 自家后端。出黑图 / 花图先换回默认 |
| | `--disable-xformers` | 装了 xformers 但结果异常时关掉 |
| 黑图排查 | `--force-upcast-attention` | 注意力计算强制上溢到 fp32；源码注释："如果它修好了黑图请报告" |
| 缓存 | `--cache-none` / `--cache-classic` / `--cache-lru N` | 默认按 RAM 压力缓存；`--cache-none` 每次全部重算（省内存、慢） |
| 实验性加速 | `--fast` | 开启 fp16 累加 / fp8 矩阵乘 / cuBLAS / autotune 等"未充分测试、可能降低画质"的优化；不带参数 = 全开。出图异常先去掉它 |
| 目录 | `--base-directory` / `--models-directory` / `--output-directory` / `--input-directory` / `--extra-model-paths-config` | 自定义模型 / 输入 / 输出目录（见《学习报告》§2.6） |
| 网络 | `--listen 0.0.0.0` / `--port 8188` / `--disable-auto-launch` | 局域网访问 / 改端口 / 不自动开浏览器（无界面常驻用，见《补充B》） |
| 排错 | `--disable-all-custom-nodes`（配合 `--whitelist-custom-nodes`） | 排除自定义节点干扰，再逐个放回 |
| | `--deterministic` | 尽量让结果可复现（更慢，且不保证完全一致） |
| | `--verbose DEBUG` / `--verbose DETAIL` | 更详细的日志；`DETAIL` 会在采样第一步打印模型、采样器、步数、cfg、seed、latent 形状 |

---

## 6. 学习路径

> 本路径已并入《ComfyUI工作流递进实现报告》§6 的 **14 天路径**（这里的 Day 1–2 → 那里 Day 1–4；Day 3–6 → 那里 Day 5–11；Day 7 → 那里 Day 7、14），以 14 天那条为准；这里保留作**节点专项**练习。对照表见目录下 `README.md`。

每天一个主题，都在 ComfyUI 里**动手**完成，用的都是上面讲过的节点。

| 天 | 主题 | 练习 | 涉及章节 |
|---|---|---|---|
| 1 | 看懂默认工作流 | 打开官方 Anima 模板，进入子图，对着报告 3.1~3.4 说出**每个节点、每条线**的作用；选中每个节点点"信息"标签读官方说明 | 1、3.1~3.4 |
| 2 | 采样参数 | 固定种子，用 `浮点数 + 创建列表` 一次跑 CFG 3/4/5/6；再跑 steps 10/20/30；再换 4 个采样器。结果接 `图像表格`，做成一张对照图 | 3.4、3.8 |
| 3 | 图生图 | 同一张输入图，denoise 取 0.2/0.4/0.6/0.8/1.0 各出一张，体会"保留程度" | 4.3 |
| 4 | 遮罩与局部重绘 | 用遮罩编辑器涂一块做局部重绘；再用裁剪法做一次，对比效果 | 2.9、3.6、4.4 |
| 5 | 放大 | 对同一张图分别做"放大模型""Latent 放大 + 二次采样"，对比清晰度和风格保持度 | 4.6 |
| 6 | LoRA 与 A/B | 挂两个 LoRA，用 `Ctrl+B` 分别关掉看各自贡献；调 `strength_model` | 4.7、2.4 |
| 7 | 搭自己的工作流 | 从空白画布搭"文生图 → 放大 → 二次采样 → 保存"，全选后收成**子图**，发布到节点库 | 2.6、4 |

做完这 7 天，ComfyUI 的核心节点就都亲手用过了。之后遇到新节点，先点"信息"标签读文档，再到本报告第 3 章查同类节点的用法。

---

## 7. 附录

### 7.1 内置节点分类总览

ComfyUI 内置节点按"类别/子类别"组织（节点搜索菜单里的路径）。下表是主干分类与本报告覆盖情况：

| 类别路径 | 放什么 | 代表节点 | 本报告 |
|---|---|---|---|
| `model/loaders` | 各种加载器 | Checkpoint加载器、UNet加载器、加载CLIP、加载VAE、加载LoRA | 3.1 ✔ |
| `model/conditioning` | 提示词与条件 | CLIP文本编码、条件合并、应用ControlNet | 3.2 ✔ |
| `model/latent` | 潜空间操作 | 空Latent图像、VAE编码/解码、缩放Latent | 3.3 ✔ |
| `model/sampling` | 采样 | K采样器、自定义采样全家桶 | 3.4 ✔ |
| `model/patch` | 模型补丁 | ModelSampling 系列、应用 Anima LLLite | 3.7 ✔ |
| `model/merging` | 模型融合与保存 | 模型融合（简易）、保存Checkpoint | 3.7 ✔ |
| `image` | 图像读写的根 | 加载图像、保存图像 | 3.5 ✔ |
| `image/upscaling` | 缩放放大 | 缩放图像、使用模型放大图像 | 3.5 ✔ |
| `image/transform` | 裁剪/翻转/外补 | 图像裁剪、外补画板 | 3.5 ✔ |
| `image/batch` | 批次 | 从批次获取图像、批量图像 | 3.5 ✔ |
| `image/mask` | 遮罩 | 纯块遮罩、扩展遮罩、合成遮罩 | 3.6 ✔ |
| `image/filters` / `image/color` / `image/compositing` | 滤镜、调色、合成 | 模糊、锐化、混合、合成图像（遮罩） | 3.5 ✔ |
| `image/detection`、`image/geometry` 等 | 目标检测、深度估计、分割 | SAM3、MediaPipe、MoGe、Depth Anything 3 | ✘ 进阶 |
| `utilities/primitive`、`utilities/logic` | 数字/逻辑/循环 | 整数、切换、与或非、开始/结束循环 | 3.8 ✔ |
| `latent`、`advanced/debug`、`experimental` | 杂项 | 获取 Latent 尺寸、ModelComputeDtype、混合Latent | 部分 ✔ |
| `audio`、`video`、`3d`、`text` | 音频、视频、3D、文本处理 | 创建视频、加载音频、GLSL Shader | ✘ 另行研究 |
| API Node / Partner | 调用外部付费 API 的节点 | Kling、Ideogram、Stability 等 | ✘ |

官方节点文档共 1200 多页，地址规律是 `https://docs.comfy.org/zh/built-in-nodes/<节点英文名>`，例如 `…/built-in-nodes/KSampler`。**更快的办法是在 ComfyUI 里选中节点看"信息"标签**，内容和网页版相同。

### 7.2 目录结构

```
ComfyUI/
├── models/                 ← 所有模型，按子目录分类（见 3.1 的对照表）
├── input/                  ← 上传的输入图片、.latent 文件
├── output/                 ← 保存图像的输出（PNG 内嵌工作流）
├── temp/                   ← 预览节点的临时文件
├── custom_nodes/           ← 自定义节点
├── user/default/workflows/ ← 保存的工作流 JSON
└── extra_model_paths.yaml  ← 可选：额外模型路径
```

### 7.3 资料来源

**官方文档（中文）**

- 文档首页与索引：https://docs.comfy.org/zh ｜ https://docs.comfy.org/llms.txt
- 基础概念：`/zh/basic-concepts/`（workflow、nodes、properties、links、models、custom-nodes）
- 界面：`/zh/interface/`（overview、shortcuts、right-side-panel、canvas-controls、maskeditor）、`/zh/interface/features/`（subgraph、partial-execution、node-docs、autogrow-inputs、template）
- 节点文档：https://docs.comfy.org/zh/built-in-nodes/KSampler（替换节点英文名）
- 教程：`/zh/tutorials/basic/`（text-to-image、image-to-image、inpaint、outpaint、upscale、lora、multiple-loras、batch-generation）、`/zh/tutorials/controlnet/`（controlnet、mixing-controlnets、pose-controlnet-2-pass）、`/zh/tutorials/utility/image-upscale`
- 官方博客《AI 放大完全手册》：https://blog.comfy.org/p/upscaling-in-comfyui

**源码（参数默认值、范围、选项的最终依据）**

- 仓库：https://github.com/comfyanonymous/ComfyUI （现由 Comfy-Org 维护）
- `nodes.py`（加载器、条件、Latent、采样、图像、遮罩等核心节点）、`comfy_extras/*.py`（其余内置节点）、`comfy/samplers.py`（采样器与调度器列表）、`folder_paths.py`（模型文件夹定义）

**采样器/调度器的补充参考**（社区经验，风格描述为概括性说法）

- ComfyUI Wiki：https://comfyui-wiki.com/zh/comfyui-nodes/sampling/sampler
- Comfy with ComfyUI《什么是采样器与调度器》：https://comfyui.nomadoor.net/zh/ai-capabilities/sampling/

**核实说明**

- 各节点的参数名、默认值、范围、下拉选项取自源码解析；中文说明取自官方中文节点文档，二者不一致时以源码为准。
- 采样器与调度器的"风格/适用"一栏，官方文档没有逐条说明，这里采用的是社区普遍经验的概括，**务必用自己的模型固定种子实测**。
- 官方中文文档中 K采样器 `denoise` 的描述有一处翻译颠倒，本报告已按源码 tooltip 与图生图教程更正。
