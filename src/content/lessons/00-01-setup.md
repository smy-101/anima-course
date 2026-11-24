---
title: 准备：认识 Anima、装好 ComfyUI、出第一张图
stage: 0
order: 1
summary: Anima 是什么、三个版本怎么选、要下哪三个文件、ComfyUI 的五个概念、用官方模板跑出第一张图；最后把"四条纪律"和实验记录本立起来。
levels: []
days: [1]
promptTrack: false
prerequisites: []
nodes:
  - UNETLoader
  - CLIPLoader
  - VAELoader
tags: []
deliverable: 用官方模板出的第一张图，以及建好的实验记录本（E001 空表）。
acceptance:
  - ComfyUI 已更新到最新版，模板库里能搜到 "Anima Base v1"
  - 三个模型文件放在正确目录，右侧面板"问题"里没有缺失模型
  - 用官方模板出了一张图，知道图存在哪个目录
  - 能说出 ComfyUI 的五个概念：节点、连线、画布、工作流、运行
  - 能按顺序说出一张图生成的六个阶段
  - 实验记录本建好，字段与"实验记录模板"一致
  - 把生成的 PNG 拖回画布，看到了内嵌的工作流
figures:
  - id: setup-ui
    caption: "ComfyUI 界面地图：左侧栏、顶栏、画布 Run 栏、右侧面板"
    group: 界面
  - id: setup-template
    caption: "官方 \"Anima Base v1\" 模板加载后的画布：子图 + 分辨率选择器 + 保存节点 + 便签"
    group: 界面
  - id: setup-missing
    caption: "右侧面板\"问题 → 缺失模型\"与一键下载按钮"
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
    url: https://docs.comfy.org/en/installation/desktop
    note: 桌面版安装与模型共享目录
  - badge: 社区
    note: 显存门槛为社区经验值
verified: 2026-11-24
---

## 目标

这一课不追求出好图。目标是：知道 Anima 是什么、该用哪个版本、三个文件放在哪；会用官方模板出第一张图；理解 ComfyUI 的几个基本概念；把后面 13 天要用的"纪律"和"记录本"立起来。

## Anima 是什么

| 项目 | 结论 |
|---|---|
| 是什么 | CircleStone Labs × Comfy Org 联合出品的 **20 亿参数**文生图模型，专注动漫 / 插画 / 非写实艺术。**不是 SDXL 系**，底层是 NVIDIA Cosmos-Predict2-2B（DiT 架构） |
| 文本编码器 | Qwen3-0.6B——真正"读得懂"句子；VAE 用 Qwen-Image VAE |
| 不会做的事 | 照片级写实（有意为之）、长段文字渲染 |
| 显存门槛（社区经验值） | 8GB 可跑（RTX 3060 / 4060 级别），12GB+ 流畅 |
| 许可 | 模型本身**非商业许可**，但**生成出来的图片可以商用**；不可把模型挂成收费 API、放进付费平台 |

与 SDXL / Illustrious / NoobAI 的区别：那些模型的文本编码器基本只认标签；Anima 因为有 Qwen3 编码器，**自然语言是真正的控制手段**，不只是装饰。

### 三个版本怎么选

| 版本 | 文件 | 特点 | 适用场景 |
|---|---|---|---|
| **Anima Base v1.0** | `anima-base-v1.0.safetensors` | 未经美学精调的"真·底模"。灵活性、多样性、画师风格遵循最强；默认画风朴素中性，**不加质量 / 画师标签会显得很平** | 玩画师风格、训 LoRA（官方要求 LoRA 在 Base 上训） |
| **Anima Aesthetic** v1.0 / v1.0b / v1.1 | `anima-aesthetic-v1.x.safetensors` | 在高质量图上精调过，**训练时去掉了所有质量标签**；默认画风更好、更稳定 | **出成品图**。作者认为 v1.0 比 v1.0b 好；v1.1 是更新版 |
| **Anima Turbo** v1.0 / v1.1 | `anima-turbo-v1.x.safetensors` | 蒸馏版。**CFG 1、8–12 步**；稳定性高、默认风格强，多样性下降 | **新手起步、快速试提示词** |

作者本人的建议：从 **Anima-Turbo** 开始。它平均只比 Aesthetic 略差，但出图极快，非常适合反复迭代提示词；有时因为更稳定，效果甚至更好。

官方 ComfyUI 模板的做法：以 Base v1.0 为主模型，通过一个开关决定是否挂载 `anima-turbo-lora-v0.2`（挂上后切换为 8 步 / CFG 1）。也就是说"加速"有两条路——直接用 Turbo 整模型，或在 Base 上挂 Turbo LoRA。

> 常见误区：**"Turbo 是一个 LoRA，放 loras 目录"**。Turbo 既是独立的整模型（放 `diffusion_models/`），也有 LoRA 形式（放 `loras/`），两者都在官方仓库里，别混淆。

## 需要哪三个文件、放在哪

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

⚠️ **不要放到 `checkpoints/`**。Anima 是拆分模型，不是 SD 那种三合一 checkpoint。

> 📂 **`ComfyUI/models` 到底在哪，取决于安装方式**（"放错目录"的根源往往是这个）：

| 安装方式 | 模型目录 |
|---|---|
| 便携版 Portable | `ComfyUI_windows_portable\ComfyUI\models\`（即上面的目录树） |
| 桌面版 Comfy Desktop（当前版） | **不在程序目录里**，而在独立的共享目录：Windows 默认 `%LOCALAPPDATA%\Comfy-Desktop\ComfyUI-Shared`（旧版为 `%USERPROFILE%\ComfyUI-Shared`），其下再分 `models / input / output` |
| 更早的 Legacy Desktop | 数据目录由其 `config.json` 的 `basePath` 指定，通常在 `文档\ComfyUI` |
| 手动安装 / git clone | `<仓库目录>\ComfyUI\models\` |
| 自定义位置 | 任意目录，用 `extra_model_paths.yaml` 或启动参数 `--models-directory` 指向 |

模型放在子文件夹（如 `diffusion_models/anima/`）时，缺失检测只看一级目录，可能仍报缺失——在加载节点里手动选中文件即可。分词器文件**不用下载**：Qwen3 与 T5 的分词器内置在 ComfyUI 仓库中，`qwen_3_06b_base.safetensors` 只含 LM 权重。

## ComfyUI：五个概念、六个阶段

### 必须理解的五个概念

| 概念 | 含义 |
|---|---|
| 节点（Node） | 一个功能块。左侧圆点是**输入**，右侧圆点是**输出**，节点内部是**控件**（文本框、数字、下拉框） |
| 连线（Link） | 从输出连到**同类型**输入。一个输出可以连多个输入；一个输入只能接一条线 |
| 画布（Canvas） | 放节点的区域 |
| 工作流（Workflow） | 整张节点图。可以保存为 JSON，也**内嵌在输出的 PNG 里**——把生成的图拖回画布就能还原工作流 |
| 运行（Run / Queue） | 点"运行"或 `Ctrl+Enter`，任务进队列，按节点依赖顺序执行 |

### 一张图是怎么生成的：六个阶段

| 阶段 | 做什么 | 对应节点 |
|---|---|---|
| ① 加载 | 把硬盘上的权重文件读进显存，拆成**模型（负责去噪）**、**文本编码器（负责读提示词）**、**VAE（负责图像↔潜空间互转）**三件套 | UNet加载器 / 加载CLIP / 加载VAE |
| ② 编码 | 文本编码器把提示词变成一串数字（CONDITIONING），告诉去噪模型"往哪个方向画" | CLIP文本编码 |
| ③ 起始画布 | 生成一张（或一批）全是随机噪声的潜空间小图 | 空Latent图像（图生图则用 VAE编码） |
| ④ 采样 | 模型看着"当前噪声图 + 提示词"，预测噪声并减掉一点；重复 N 步，从一团噪声变成一张潜空间图 | K采样器 |
| ⑤ 解码 | VAE 把潜空间小图放大还原成真正的像素图 | VAE解码 |
| ⑥ 保存 | 写到 `ComfyUI/output/`，并把工作流信息嵌进 PNG | 保存图像 |

**Latent（潜空间）**可以理解为图片的"高度压缩版"：1024×1024 的图在潜空间只有 128×128，模型在潜空间里去噪比直接在像素上算快得多。下一课（L0）会把这六个阶段亲手连一遍。

## 安装

| 方式 | 适合 | 特点 |
|---|---|---|
| **Comfy Desktop（桌面版）** | 新手、Windows / macOS (Apple Silicon) / Linux | 独立安装器，带启动器；默认跟**稳定版**通道，想尝鲜可在"管理 → 更新"切到 GitHub 最新版 |
| **ComfyUI Portable（便携版）** | Windows、想用最新功能 | 解压即用，自带嵌入式 Python；分 NVIDIA (CUDA 13) / AMD / Intel 三种包；始终是最新提交 |
| 手动安装 | 有 Python / Git 基础、WSL、特殊硬件 | 克隆仓库 + 虚拟环境 + `pip install -r requirements.txt` |
| Comfy Cloud | 不想装、没显卡 | 浏览器里跑官方模板，按量计费 |

系统要求要点：Python 3.13（推荐）、Chrome 143+、NVIDIA 20 系以上需要 CUDA 13.0 版 PyTorch；AMD、Intel Arc、Apple Silicon 都支持。

便携版的四个步骤：

1. 从 ComfyUI GitHub Releases 下载对应显卡的 `.7z`，用 7-Zip 解压。
2. 双击 `run_nvidia_gpu.bat`（AMD 是 `run_amd_gpu.bat`），看到 `To see the GUI go to: http://127.0.0.1:8188` 即成功；浏览器一般会自动打开。
3. **运行期间不要关那个命令行窗口**，关了 ComfyUI 就停了。
4. 更新：双击 `update/update_comfyui.bat`。`update_comfyui_and_python_dependencies.bat` 会重装 PyTorch 等依赖，**有风险，仅在环境坏掉时用**。

> **Anima 需要较新的 ComfyUI**。桌面版稳定通道可能滞后，找不到 Anima 模板时切到"GitHub 最新版"。手动安装的，`git pull` 后一定要 `pip install -r requirements.txt`，否则前端、模板、节点文档会滞后。

## 界面速查

| 区域 / 操作 | 说明 |
|---|---|
| 左侧边栏 | 顶部 ComfyUI 图标 = 主菜单；**节点库**、**模板**、**资产**（已生成图片）、模型库、工作流 |
| 顶栏 | 工作流标签页，旁边 **+** 新建空白工作流；画布上方浮着 **Run 栏**：批量次数、Run、队列模式、取消 |
| 右侧面板 | 选中节点的**参数**、**信息**（= 该节点的内置文档）、**设置**；以及**问题 / 错误**标签页（缺失模型、缺失节点包、报错） |
| 右键画布 / 双击空白处 | 添加节点菜单 / 搜索并添加节点（输英文类名如 `KSampler` 也能搜到） |
| 从输出圆点拖线到空白处松手 | 弹出节点搜索，选中即自动连好线 |
| `Ctrl+Enter` | 运行 |
| `Ctrl+S` / `Ctrl+O` | 保存 / 加载工作流 |
| `Ctrl+B` / `Ctrl+M` | **忽略**（Bypass：不执行但数据透传，A/B 对比神器）/ 禁用（Mute：下游断粮） |
| `R` | 重新扫描模型文件夹（放好模型后按一下） |
| `.` | 让整张工作流适应屏幕 |
| `Ctrl+G` | 给选中节点加框（Group） |
| 种子控件右侧 | `fixed` / `increment` / `decrement` / `randomize`——想复现就设 **fixed** |
| 输出位置 | `ComfyUI/output/`，文件名 `ComfyUI_00001_.png` 递增；保存图像节点可自定义前缀 |

**查参数最快的方式**：选中任意节点 → 工具箱文档图标，或右侧面板"信息"标签，直接读官方说明，不用离开 ComfyUI。

## 跑通第一张图

1. **更新 ComfyUI 到最新**。
2. 侧栏点 **模板**，搜索 **Anima Base v1**，选择 "Anima Base v1: Text to Image"。
3. 加载后相关加载节点会**变红**，右侧面板"问题 → 缺失模型"列出文件。点每行的 **Download / Download all**，或手动从 Hugging Face 下载后按上面的目录表放好，按 `R` 刷新。
4. 在子图节点里填提示词（先用模板自带的示例），确认分辨率为 1:1。
5. 把 K采样器的 seed 设为 **fixed**（以后所有对比都靠它）。
6. 点**运行**（`Ctrl+Enter`）。
7. 图出现在保存图像节点和侧栏"资产 → 已生成"。把这张 PNG 拖回一个空白画布——工作流会原样还原，这就是社区分享工作流的标准方式。

官方模板把整条管线封装成了一个**子图**节点，画布上只剩：子图 + 分辨率选择器 + 保存节点 + 说明便签。双击子图可以进去看内部 17 个节点。下一课我们不碰模板，自己从空白画布搭一遍，搭完再回来和子图对照。

## 四条纪律（贯穿全部级别）

1. **固定种子**（K采样器 seed 右侧控件设为 `fixed`），否则分不清是参数的功劳还是运气。
2. **一次只改一个变量**；改完用图像表格把结果拼在一张图里看。
3. **先用 Turbo 调提示词和构图，再用 Base / Aesthetic 出成品**——Turbo 8 步 / CFG 1，Base 30 步 / CFG 4。
4. **固定分辨率**：噪声张量的形状跟着画布尺寸走，同一种子在 1024² 和 896×1152 下是两张不同的图。固定种子做参数对比时，**画幅也不能动**。

这四条不是建议，是这门课后面每一个练习的前提。

## 建实验记录本

PNG 里嵌的工作流能还原"当时怎么连的"，但还原不了"你在对比什么、你觉得哪张更好、为什么"。所以从今天起，每次实验记一行。

| 日期 | 实验 ID | 目的 | 模型 / LoRA（强度） | 提示词（摘要） | seed | 分辨率 | steps | cfg | 采样器 / 调度器 | denoise | 其它变量 | 结论（好 / 坏 / 为什么） | 文件名或目录 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 11-25 | E001 | 找 cfg 甜点 | base-v1.0 | 樱花少女 A | 12345 | 1024² | 30 | 3.5 | euler / simple | 1 | — | 3.5 偏淡，发色特征丢失 | `Anima/E001/00003` |
| | E001 | | | | | | | 4.0 | | | | **4.0 最佳**，线条干净、颜色到位 | `Anima/E001/00004` |

记录规则：

1. **一个实验 ID = 一次扫描 = 一个变量**。同一 ID 下其它列不变，只填变化的那一列。
2. **结论列必须写"为什么"**，不能只写"好"。
3. **文件名列用保存图像节点的前缀带实验 ID**（如 `Anima/E001`），表和图就能对上。参数列允许写"见 PNG"（拖回画布可还原全部参数），但**目的与结论列必须手写**。
4. 每天最后一行写"**今日基线**"：当前认定的最佳组合（模型 / 采样器 / cfg / steps / denoise），第二天的实验从它出发。
5. 失败也记——"3.5 发色丢失"是信息，否则会重复踩。

每日复盘 5 分钟，三个问题：① 今天最佳是哪张、为什么；② 今天学到的"不要这样做"；③ 明天的实验 ID 和要验证的假设。

建表工具随你（Markdown、表格软件都行），只要字段和上面一致。

## 常见故障

| 现象 | 原因 | 解决 |
|---|---|---|
| 加载节点变红，提示 missing | 文件没下 / 放错目录 | 对照目录表；放好后按 `R` |
| 找不到 "Anima" 模板 | ComfyUI 或模板依赖太旧 | 更新 ComfyUI 及依赖；桌面版切到 GitHub 最新版 |
| 加载工作流提示节点缺失 | 用了含第三方节点的工作流 | 看右侧面板缺哪个节点，用 Manager 装 |
| 启动日志有 `import failed` | 自定义节点依赖缺失或与新版本不兼容 | 用 `--disable-all-custom-nodes` 排查，逐个定位 |
| 显存不足（OOM） | 分辨率 / 模型太大 | 降到 768×1024、用 Turbo 8 步、关掉其他占显存程序 |
| 浏览器界面错乱 | Chrome 版本太低 | 升级到 Chrome 143+ |

自定义节点只装可信作者、用得到的包；冷门插件有安全风险。进阶阶段可能用到 RES4LYF（`beta57` 调度器）、Impact Pack（脸 / 手修复）、UltimateSDUpscale（分块放大），到对应课程再装。

## 下一步

下一课 [L0 · 最小文生图](/lessons/01-01-l0-minimal/)：不用模板，从空白画布把 9 个节点连起来。带着这一课的三个文件和固定好的 seed 过去。
