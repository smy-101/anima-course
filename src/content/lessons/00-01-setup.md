---
title: 装好 ComfyUI，出第一张图
stage: 0
order: 1
summary: "学完你能装好 ComfyUI、把 Anima 的模型文件放对目录，用官方模板出第一张图，并建起自己的实验记录本。"
levels: []
days: [1]
promptTrack: false
prerequisites: []
nodes:
  - UNETLoader
  - CLIPLoader
  - VAELoader
  - CheckpointLoaderSimple
tags: []
deliverable: "用官方模板出的第一张图，以及建好的实验记录本（E001 空表）。"
acceptance:
  - ComfyUI 已更新到最新版，模板库里能搜到“Anima Base v1”
  - 三个模型文件放在正确目录，右侧面板“问题”里没有缺失模型
  - 用官方模板出了一张图，知道图存在哪个目录
  - 能说出 ComfyUI 的五个概念：节点、连线、画布、工作流、运行
  - 能按顺序说出一张图生成的六个阶段
  - 实验记录本建好，字段与“实验记录模板”一致
  - 把生成的 PNG 拖回画布，看到了内嵌的工作流
figures:
  - id: setup-ui
    caption: "ComfyUI 界面地图：左侧栏、顶栏、画布 Run 栏、右侧面板"
    group: 界面
  - id: setup-template
    caption: "官方 “Anima Base v1” 模板加载后的画布：子图 + 分辨率选择器 + 保存节点 + 便签"
    group: 界面
  - id: setup-missing
    caption: "右侧面板“问题”页里的缺失模型列表与一键下载按钮"
    group: 界面
  - id: setup-first
    caption: "用模板示例提示词出的第一张图"
    group: 第一张图
transfers: false
sources:
  - badge: 官方
    url: https://huggingface.co/circlestone-labs/Anima
    note: 模型卡（版本、许可、硬件）
  - badge: 官方
    url: https://docs.comfy.org/zh/tutorials/image/anima/anima
    note: ComfyUI 官方 Anima 教程
  - badge: 官方
    url: https://docs.comfy.org/zh/interface/overview
    note: "界面地图、快捷键、队列与工作流保存（《节点详解》§2）"
  - badge: 官方
    url: https://docs.comfy.org/en/installation/desktop
    note: 桌面版安装与模型共享目录
  - badge: 社区
    note: 显存门槛为社区经验值
verified: 2026-11-24
---

## Anima 是什么

这一课不追求出好图。Anima 是 CircleStone Labs 与 Comfy Org 联合出品的文生图模型，参数量 20 亿。它专注动漫、插画和非写实艺术。照片级写实和长段文字渲染它都不做，写实是有意不做的。

它不是 SDXL 系，底层是 NVIDIA Cosmos-Predict2-2B，属于 DiT 架构。文本编码器是 Qwen3-0.6B，真正读得懂句子。VAE 用的是 Qwen-Image VAE。SDXL、Illustrious、NoobAI 的文本编码器基本只认标签。Anima 因为有 Qwen3 编码器，自然语言是真正的控制手段，不只是装饰。

显存门槛是社区经验值：8GB 可跑，相当于 RTX 3060 / 4060 的级别；12GB 以上流畅。

许可是这样分的。模型本身只能非商业使用，但生成出来的图片可以商用。不可以的是把模型挂成收费 API，或放进付费平台。

### 版本选择

三个版本并排看：

| 版本 | 文件 | 特点 | 适用 |
|---|---|---|---|
| Anima Base v1.0 | `anima-base-v1.0.safetensors` | 未经美学精调的底模。灵活性、多样性、画师风格遵循最强；默认画风朴素中性，不加质量或画师标签会显得很平 | 玩画师风格、训 LoRA（官方要求 LoRA 在 Base 上训） |
| Anima Aesthetic v1.0 / v1.0b / v1.1 | `anima-aesthetic-v1.x.safetensors` | 在高质量图上精调过，训练时去掉了所有质量标签；默认画风更好、更稳定 | 出成品图。作者认为 v1.0 比 v1.0b 好；v1.1 是更新版 |
| Anima Turbo v1.0 / v1.1 | `anima-turbo-v1.x.safetensors` | 蒸馏版。CFG 1、8–12 步；稳定性高、默认风格强，多样性下降 | 新手起步、快速试提示词 |

作者本人的建议是从 Anima Turbo 开始。它平均只比 Aesthetic 略差，但出图极快，适合反复迭代提示词。它有时更稳定，效果甚至更好。

官方 ComfyUI 模板的做法是以 Base v1.0 为主模型，用一个开关决定是否挂载 `anima-turbo-lora-v0.2`。挂上后切换为 8 步、CFG 1。所以加速有两条路：直接用 Turbo 整模型，或在 Base 上挂 Turbo LoRA。

**Turbo 既是独立的整模型，也有 LoRA 形式，别把两者混在一起。** 整模型放 `diffusion_models/`，LoRA 放 `loras/`，两个文件都在官方仓库里。

## 模型文件与目录

要下载的是三个文件：主模型、文本编码器和 VAE。Turbo LoRA 可选。

```
📂 ComfyUI/models/
├── 📂 diffusion_models/
│   └── anima-base-v1.0.safetensors          (3.89 GB)   ← Aesthetic / Turbo 整模型也放这里
├── 📂 text_encoders/
│   └── qwen_3_06b_base.safetensors          (1.11 GB)
├── 📂 vae/
│   └── qwen_image_vae.safetensors           (242 MB)    ← 就是 Qwen-Image 的 VAE
└── 📂 loras/                                              (可选)
    └── anima-turbo-lora-v0.2.safetensors     (142 MB)
```

**三个文件不放 `checkpoints/`。** Anima 是拆分模型。SD 那种三合一的 checkpoint 由 [Checkpoint加载器（简易）](/nodes/CheckpointLoaderSimple/) 一个节点交出 MODEL、CLIP、VAE，Anima 不是这样。

`ComfyUI/models` 在哪取决于安装方式，放错目录往往是因为没先弄清这一点：

| 安装方式 | 模型目录 |
|---|---|
| 便携版 Portable | `ComfyUI_windows_portable\ComfyUI\models\`，即上面的目录树 |
| 桌面版 Comfy Desktop（当前版） | 不在程序目录里，而在独立的共享目录：Windows 默认 `%LOCALAPPDATA%\Comfy-Desktop\ComfyUI-Shared`（旧版为 `%USERPROFILE%\ComfyUI-Shared`），其下再分 `models / input / output` |
| 更早的 Legacy Desktop | 数据目录由其 `config.json` 的 `basePath` 指定，通常在 `文档\ComfyUI` |
| 手动安装 / git clone | `<仓库目录>\ComfyUI\models\` |
| 自定义位置 | 任意目录，用 `extra_model_paths.yaml` 或启动参数 `--models-directory` 指向 |

模型放在子文件夹（如 `diffusion_models/anima/`）时，缺失检测只看一级目录，可能仍报缺失。这时在加载节点里手动选中文件即可。

分词器文件不用下载。Qwen3 与 T5 的分词器内置在 ComfyUI 仓库中，`qwen_3_06b_base.safetensors` 只含 LM 权重。

## ComfyUI 的工作方式

ComfyUI 是节点式的生图工具。每个节点做一件事，用连线把数据从上游传到下游，组成一张工作流。上手先认清下面的概念，再看出一张图的顺序。

### 基本概念

| 概念 | 含义 |
|---|---|
| 节点（Node） | 一个功能块。左侧圆点是输入，右侧圆点是输出，节点内部是控件，如文本框、数字框、下拉框 |
| 连线（Link） | 从输出连到同类型的输入。一个输出可以连多个输入，一个输入只能接一条线 |
| 画布（Canvas） | 放节点的区域 |
| 工作流（Workflow） | 整张节点图。可以保存为 JSON，也内嵌在输出的 PNG 里，把图拖回画布就能还原 |
| 运行（Run / Queue） | 点“运行”或按 `Ctrl+Enter`，任务进队列，按节点依赖顺序执行 |

### 出图的过程

出一张图分六步。UNet加载器、加载CLIP、加载VAE 这三个加载器先把权重读进显存，交出三样东西。模型负责去噪，文本编码器负责读提示词，VAE 负责在图像和潜空间之间互转。接着 CLIP文本编码 把提示词编成一串数字，即条件（CONDITIONING），告诉去噪模型往哪个方向画。空Latent图像 给出一张全是随机噪声的潜空间小图，图生图则改用 VAE编码。K采样器 看着当前的噪声图和提示词，预测噪声并减掉一点。这样重复若干步，一团噪声变成了一张潜空间图。最后 VAE解码 把它还原成像素图，保存图像 把图写到 `ComfyUI/output/`，并把工作流信息嵌进 PNG。

Latent（潜空间）可以理解为图片的高度压缩版。1024×1024 的图在潜空间只有 128×128。模型在潜空间里去噪，比直接在像素上算快得多。这六步你会在下一课亲手连一遍。

## 安装

| 方式 | 适合 | 特点 |
|---|---|---|
| 桌面版 Comfy Desktop | 新手；Windows、macOS（Apple Silicon）、Linux | 独立安装器，带启动器。默认跟稳定版通道，想尝鲜可以在管理面板的更新里切到 GitHub 最新版 |
| 便携版 ComfyUI Portable | Windows、想用最新功能 | 解压即用，自带嵌入式 Python。分 NVIDIA（CUDA 13）、AMD、Intel 三种包，始终是最新提交 |
| 手动安装 | 有 Python / Git 基础、WSL、特殊硬件 | 克隆仓库，建虚拟环境，再 `pip install -r requirements.txt` |
| Comfy Cloud | 不想装、没显卡 | 浏览器里跑官方模板，按量计费 |

系统要求：Python 3.13（推荐）、Chrome 143+，NVIDIA 20 系以上需要 CUDA 13.0 版 PyTorch。AMD、Intel Arc、Apple Silicon 都支持。

便携版分四步：

1. 从 ComfyUI GitHub Releases 下载对应显卡的 `.7z`，用 7-Zip 解压。
2. 双击 `run_nvidia_gpu.bat`，AMD 是 `run_amd_gpu.bat`。看到 `To see the GUI go to: http://127.0.0.1:8188` 就成功了，浏览器一般会自动打开。
3. **运行期间不要关那个命令行窗口**，关了 ComfyUI 就停了。
4. 更新时双击 `update/update_comfyui.bat`。`update_comfyui_and_python_dependencies.bat` 会重装 PyTorch 等依赖，有风险，仅在环境坏掉时用。

> 要加启动参数（显存、端口、Attention 后端、排错开关）时，两种安装方式改的地方不同。便携版编辑 `.bat` 里 `python -s main.py` 之后那一段。桌面版在启动器的 Startup arguments 里填。参数清单，以及先查节点、后用启动参数的顺序，见[启动参数与 Attention 后端](/resources/startup-args/)。

> Anima 需要较新的 ComfyUI。桌面版稳定通道可能滞后，找不到 Anima 模板时切到 GitHub 最新版。手动安装的，`git pull` 之后一定要 `pip install -r requirements.txt`，否则前端、模板、节点文档会滞后。

## 界面速查

| 区域 / 操作 | 说明 |
|---|---|
| 左侧边栏 | 顶部的 ComfyUI 图标是主菜单。下面依次是节点库、模板、资产（已生成图片）、模型库、工作流 |
| 顶栏 | 工作流标签页，旁边的 **+** 新建空白工作流。画布上方浮着 Run 栏：批量次数、Run、队列模式、取消 |
| 右侧面板 | 选中节点的参数、信息、设置三个标签页。信息就是该节点的内置文档。另有“问题 / 错误”标签页，列出缺失模型、缺失节点包和报错 |
| 右键画布，或双击空白处 | 添加节点菜单，或搜索并添加节点。输英文类名如 `KSampler` 也能搜到 |
| 从输出圆点拖线到空白处松手 | 弹出节点搜索，选中即自动连好线 |
| 断开连线 | 点住输入圆点拖走；或框选连线后按 `Delete` |
| `Ctrl+Enter` / `Ctrl+Alt+Enter` | 运行 / 中断 |
| `Ctrl+S` / `Ctrl+O` | 保存 / 加载工作流。保存的 JSON 在 `ComfyUI/user/default/workflows/`，桌面版在共享目录的 `user/` 下 |
| `Ctrl+Z` / `Ctrl+Y` | 撤销 / 重做 |
| `Ctrl+C` / `Ctrl+V` | 复制 / 粘贴选中节点，不带外部连线 |
| `Ctrl+C` / `Ctrl+Shift+V` | 复制 / 粘贴并保持与外部输出的连线。[L2](/lessons/02-01-l2-sweeps/) 搭参数扫描时，复制分支就靠它 |
| `Ctrl`+点击 / `Shift`+点击 | 把节点加入 / 移出当前选择 |
| `Ctrl+B` / `Ctrl+M` | 忽略 / 禁用。忽略（Bypass）：节点不执行，数据原样透传，做 A/B 对比时常用。禁用（Mute）：节点不执行，下游会报缺少输入 |
| `Ctrl+G` | 给选中节点加框（Group）。`Alt+C` 折叠 / 展开选中节点 |
| 从模型库拖文件到画布 | 自动生成对应的加载器并选好文件，`diffusion_models` 对应 UNet加载器。从 `loras` 拖出来的是带 CLIP 输入的 加载LoRA，Anima 要换成 [LoRA加载器（仅模型）](/nodes/LoraLoaderModelOnly/)，见 [LoRA 课](/lessons/03-02-l3-lora/) |
| Reroute（转接点） | 从连线或端口上拖出，把长绕的线折一下。右键可设垂直或水平 |
| `R` | 重新扫描模型文件夹。放好模型后按一下 |
| `.` | 让整张工作流适应屏幕 |
| `Ctrl+Shift+K` | 打开底部的快捷键面板。所有快捷键都可以在设置的快捷键页里改，并存成预设。macOS 把 `Ctrl` 换成 `Cmd`，`Alt` 换成 `Option` |
| Run 栏的批量次数与队列模式 | 批量次数是点一次 Run 排几次。队列模式有三种：`Run` 点了才跑，`Run (On Change)` 一有改动就自动跑，`Run (Instant)` 上一次一结束立刻再跑。按住 `Shift` 点 Run 可以插队到最前 |
| 工作流标签页菜单里的导出 | 导出“工作流图像”：一张画布截图 PNG，同样内嵌工作流，适合发给别人 |
| 种子控件右侧 | `fixed` / `increment` / `decrement` / `randomize` 四个选项。想复现就设为 `fixed` |
| 输出位置 | `ComfyUI/output/`，文件名 `ComfyUI_00001_.png` 递增。保存图像节点可以自定义前缀 |

查参数最快的方式是选中任意节点，点工具箱里的文档图标，或看右侧面板的“信息”标签。那里是该节点的官方说明，不用离开 ComfyUI。

## 第一张图

1. 把 ComfyUI 更新到最新。
2. 点侧栏的 **模板**，搜 **Anima Base v1**，选“Anima Base v1: Text to Image”。
3. 加载后，相关加载节点会变红，右侧面板“问题”页会列出缺失的模型。点每行的 **Download / Download all**。也可以手动从 Hugging Face 下载，按上面的目录表放好，再按 `R` 刷新。
4. 在子图节点里填提示词，先用模板自带的示例。确认分辨率是 1:1。
5. 把 K采样器的 seed 设为 **fixed**，以后所有对比都靠它。
6. 点 **运行**，或按 `Ctrl+Enter`。
7. 图出现在保存图像节点和侧栏“资产”的“已生成”里。把这张 PNG 拖回一个空白画布，工作流会原样还原。这也是社区分享工作流的标准方式。

官方模板把整条管线封装成了一个子图节点。画布上只有四样东西：子图、分辨率选择器、保存节点和一张说明便签。双击子图可以进去看内部的 17 个节点。下一课你不用模板，从空白画布自己搭一遍，搭完再回来和子图对照。

## 实验纪律

四条纪律贯穿全部级别，从今天起就要守住。

- 固定种子。把 K采样器 seed 右侧的控件设为 `fixed`，否则分不清是参数的功劳还是运气。
- 一次只改一个变量。改完用图像表格把结果拼在一张图里看。
- 先用 Turbo 调提示词和构图，再用 Base 或 Aesthetic 出成品。Turbo 是 8 步、CFG 1，Base 是 30 步、CFG 4。
- 固定分辨率。噪声张量的形状跟着画布尺寸走，同一种子在 1024² 和 896×1152 下是两张不同的图。固定种子做参数对比时，画幅也不能动。

**这四条不是建议，是这门课后面每一个练习的前提。**

## 实验记录本

PNG 里嵌的工作流能还原当时怎么连的，但还原不了你在对比什么、觉得哪张更好、为什么。所以从今天起，每次实验记一行。

| 日期 | 实验 ID | 目的 | 模型 / LoRA（强度） | 提示词（摘要） | seed | 分辨率 | steps | cfg | 采样器 / 调度器 | denoise | 其它变量 | 结论（好 / 坏 / 为什么） | 文件名或目录 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 11-25 | E001 | 找 cfg 甜点 | base-v1.0 | 樱花少女 A | 12345 | 1024² | 30 | 3.5 | euler / simple | 1 | — | 3.5 偏淡，发色特征丢失 | `Anima/E001/00003` |
| | E001 | | | | | | | 4.0 | | | | 4.0 最佳，线条干净、颜色到位 | `Anima/E001/00004` |

记录规则：

- **一个实验 ID 对应一次扫描，只改一个变量。** 同一 ID 下其它列不变，只填变化的那一列。
- 结论列必须写为什么，不能只写“好”。
- 文件名列用保存图像节点的前缀带实验 ID，比如 `Anima/E001`，表和图就能对上。参数列允许写“见 PNG”，因为把图拖回画布可以还原全部参数。目的与结论两列必须手写。
- 每天最后一行写“今日基线”，记下当前认定的最佳组合：模型、采样器、cfg、steps、denoise。第二天的实验从它出发。
- 失败也记。“3.5 发色丢失”是信息，不记就会重复踩。

每天收工前复盘 5 分钟，回答三个问题：

- 今天最佳是哪张，为什么。
- 今天学到的“不要这样做”。
- 明天的实验 ID 和要验证的假设。

建表工具随你，Markdown、表格软件都行，只要字段和上面一致。

## 常见故障

| 现象 | 原因 | 解决 |
|---|---|---|
| 加载节点变红，提示 missing | 文件没下，或放错目录 | 对照目录表；放好后按 `R` |
| 找不到“Anima”模板 | ComfyUI 或模板依赖太旧 | 更新 ComfyUI 及依赖；桌面版切到 GitHub 最新版 |
| 加载工作流时提示节点缺失 | 用了含第三方节点的工作流 | 看右侧面板缺哪个节点，用 Manager 装 |
| 启动日志有 `import failed` | 自定义节点依赖缺失，或与新版本不兼容 | 用 `--disable-all-custom-nodes` 排查，逐个定位。见[启动参数](/resources/startup-args/) |
| 显存不足（OOM） | 分辨率或模型太大 | 降到 768×1024，用 Turbo 8 步，关掉其他占显存的程序 |
| 浏览器界面错乱 | Chrome 版本太低 | 升级到 Chrome 143+ |

自定义节点只装可信作者、用得到的包，冷门插件有安全风险。进阶阶段可能用到 RES4LYF（`beta57` 调度器）、Impact Pack（修脸、修手）和 UltimateSDUpscale（分块放大）。这些到对应课程再装。
