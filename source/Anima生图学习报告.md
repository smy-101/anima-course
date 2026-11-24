# Anima × ComfyUI 生图学习报告

> 面向对象：刚接触 AI 生图、打算从 **Anima** 模型入手的学习者
> 调研时间：2026 年 11 月（模型状态以此时为准）
> 资料来源：Hugging Face 官方模型卡、ComfyUI 官方文档与官方工作流模板、社区作者 Volnovik 的提示词指南（非模型作者）、若干社区教程（完整链接见文末；NSFW 与标签含义的逐条标注见《Anima提示词总结报告.md》）

---

## 0. 一页速览（先看这个）

| 项目 | 结论 |
|---|---|
| Anima 是什么 | CircleStone Labs × Comfy Org 联合出品的 **20 亿参数**文生图模型，专注动漫/插画/非写实艺术；**不是 SDXL 系**，底层是 NVIDIA Cosmos-Predict2-2B（DiT 架构） |
| 文本编码器 | Qwen3-0.6B（真正"读得懂"句子）；VAE 用的是 Qwen-Image VAE |
| 不会做的事 | 照片级写实（有意为之）、长段文字渲染 |
| 新手该用哪个版本 | 作者建议**从 Turbo 起步**（快、稳），出成品再用 **Aesthetic**；玩画师风格/多样性用 **Base** |
| 需要哪几个文件 | 主模型 + 文本编码器 + VAE，共 3 个；可选 Turbo LoRA |
| 显存门槛 | 8GB 可跑（RTX 3060/4060 级别），12GB+ 流畅 |
| 提示词三句话 | ① 标签**全小写、用空格不用下划线**（`score_7` 例外）② 画师名**必须加 `@`** ③ 自然语言**至少写两句** |
| 推荐起步参数 | 1024×1024，30 步，CFG 4，`euler` + `simple`（官方模板默认）；或 `er_sde`（模型卡推荐） |
| ComfyUI 怎么开始 | 更新到最新版 → 侧栏 **模板** → 搜 **Anima Base v1** → 下载缺失模型 → 填提示词 → 运行 |
| 许可 | 模型本身**非商业许可**，但**生成出来的图片可以商用** |

---

## 1. 认识 Anima

### 1.1 基本情况

- **参数量**：2B（20 亿），消费级显卡即可运行。
- **架构**：基于 NVIDIA Cosmos-Predict2-2B-Text2Image 的 DiT 扩散模型；文本编码器为 **Qwen3-0.6B base**，再经一个"适配器"把标签和散文分开处理。
- **训练数据**：数百万张动漫图 + 约 80 万张非动漫艺术图（LAION-POP 的 ye-pop 子集和 DeviantArt，已过滤掉照片）；**未使用合成数据**。动漫数据的知识截止到 **2025 年 9 月**——比这更新的角色/作品可能不认识。
- **定位**：插画、动漫、概念艺术。官方明确说"写实不在设计范围内"。
- **与 SDXL/Illustrious/NoobAI 的区别**：那些模型的文本编码器基本只认标签，Anima 因为有 Qwen3 编码器，**自然语言是真正的控制手段**，而不只是装饰。

### 1.2 版本与选择

| 版本 | 文件 | 特点 | 适用场景 |
|---|---|---|---|
| **Anima Base v1.0** | `anima-base-v1.0.safetensors` | 未经美学精调的"真·底模"。灵活性、多样性、画师风格遵循最强；默认画风朴素中性，**不加质量/画师标签会显得很平** | 玩画师风格、训 LoRA（官方要求 LoRA 在 Base 上训） |
| **Anima Aesthetic v1.0 / v1.0b / v1.1** | `anima-aesthetic-v1.x.safetensors` | 在高质量图上精调过，**训练时去掉了所有质量标签**；默认画风更好、更稳定 | **出成品图**。作者认为 v1.0 比 v1.0b 好；v1.1 是更新版 |
| **Anima Turbo v1.0 / v1.1** | `anima-turbo-v1.x.safetensors` | 蒸馏版。**CFG 1、8–12 步**；稳定性高、默认风格强，多样性下降 | **新手起步、快速试提示词** |
| Anima Preview / Preview2 / Preview3-base | `anima-preview*.safetensors` | 开发中的预览版 | 暂时不用管 |

**作者本人的建议**：从 **Anima-Turbo** 开始。它平均只比 Aesthetic 略差，但出图极快，非常适合反复迭代提示词；有时因为更稳定，效果甚至更好。

**官方 ComfyUI 模板的做法**：以 Base v1.0 为主模型，通过一个开关决定是否挂载 `anima-turbo-lora-v0.2`（挂上后切换为 8 步 / CFG 1）。也就是说"加速"有两条路——直接用 Turbo 整模型，或在 Base 上挂 Turbo LoRA。

### 1.3 官方配套资源

| 资源 | 仓库 | 说明 |
|---|---|---|
| 主模型 | `circlestone-labs/Anima` | 全部 diffusion_models、text_encoder、vae |
| 官方 LoRA | `circlestone-labs/Anima-Official-LoRAs` | `anima-turbo-lora-v0.1 / v0.2`、`anima-rl-v0.1`、`anima-highres-aesthetic-boost`、`anima-greg-rutkowski-style`（各约 140MB） |
| ControlNet | `Comfy-Org/Anima-LLLite`（原作 kohya-ss） | any / depth / lineart / pose / scribble / inpainting，放 `models/model_patches/` |
| 模型对比工作流 | 主仓库里的 `anima_comparison.json` | 多模型同种子网格对比 |

### 1.4 硬件要求（社区经验值）

| 等级 | 显存 | 显卡举例 | 体验 |
|---|---|---|---|
| 最低可用 | 8GB | RTX 3060 / 4060 | 能跑，建议降低分辨率 |
| 推荐 | 12GB+ | RTX 3060 12G / 4070 / 5070 | 流畅 |
| 理想 | 16GB+ | RTX 4080 / 4090 / 5080+ | 高分辨率、批量 |

> 显存不够时的对策：降分辨率（如 896×1152 → 768×1024）、用 Turbo 少步数、开 fp16、后期再放大。

### 1.5 许可证（重要）

- 模型采用 **CircleStone Labs Non-Commercial License**：模型及其衍生品（如 LoRA 权重）**只能非商业使用**；作为 Cosmos 的衍生模型还要遵守 NVIDIA Open Model License。
- **但非商业限制只针对模型，不针对产出图片**。卖图、接有偿约稿、给商业游戏/视觉小说做概念图都可以。
- 不可以的：把模型挂成收费 API、放进付费生图平台、把权重嵌进收费产品。商业授权需邮件联系官方。

---

## 2. ComfyUI 入门

### 2.1 ComfyUI 是什么

ComfyUI 是一个**节点式**生图工具：每个节点做一件事（加载模型、编码提示词、采样、解码、保存），用连线把数据从上游传到下游，组成一张"工作流"。和 WebUI 那种填表式界面相比，它更灵活、对新模型支持最快（Anima 就是 ComfyUI 原生支持），代价是上手时要理解几个概念。

**必须理解的 5 个概念**

| 概念 | 含义 |
|---|---|
| 节点（Node） | 一个功能块。左侧圆点是**输入**，右侧圆点是**输出**，节点内部是**控件**（文本框、数字、下拉框） |
| 连线（Link） | 从输出连到**同类型**输入。一个输出可以连多个输入；一个输入只能接一条线 |
| 画布（Canvas） | 放节点的区域 |
| 工作流（Workflow） | 整张节点图。可以保存为 JSON，也**内嵌在输出的 PNG 里**——把生成的图拖回画布就能还原工作流 |
| 运行（Run / Queue） | 点"运行"或 `Ctrl+Enter`，任务进队列，按节点依赖顺序执行 |

### 2.2 安装方式怎么选

| 方式 | 适合 | 特点 |
|---|---|---|
| **Comfy Desktop（桌面版）** | 新手、Windows/macOS(Apple Silicon)/Linux | 独立安装器，带启动器；默认跟**稳定版**通道，想尝鲜可在"管理 → 更新"切到 GitHub 最新版 |
| **ComfyUI Portable（便携版）** | Windows、想用最新功能 | 解压即用，自带嵌入式 Python；分 NVIDIA(CUDA 13)/AMD/Intel 三种包；始终是最新提交 |
| 手动安装 | 有 Python/Git 基础、WSL、特殊硬件 | 克隆仓库 + 虚拟环境 + `pip install -r requirements.txt` |
| Comfy Cloud | 不想装、没显卡 | 浏览器里跑官方模板，按量计费 |

**系统要求要点**：Python 3.13（推荐）、Chrome 143+、NVIDIA 20 系以上需要 CUDA 13.0 版 PyTorch；AMD（Windows 用 ROCm 10）、Intel Arc、Apple Silicon（MPS）都支持。

> **针对你这台机器的提示**：WSL2 里跑 ComfyUI 需要 GPU 直通（CUDA on WSL），配置比 Windows 侧原生安装麻烦。日常生图建议**直接在 Windows 侧装 Desktop 或 Portable**，模型统一放在一个目录，需要时再通过 `extra_model_paths.yaml` 共享。

### 2.3 便携版安装步骤（Windows）

1. 从 ComfyUI GitHub Releases 下载对应显卡的 `.7z`（NVIDIA 标准版 / NVIDIA 10 系及更老 cu126 版 / AMD / Intel）。
2. 用 7-Zip 解压，目录结构：

```
ComfyUI_windows_portable
├── ComfyUI/                 ← 程序主体，models/ 在这里面
├── python_embeded/          ← 独立 Python 环境
├── update/                  ← 升级脚本
├── advanced/                ← CPU 等其他启动脚本
└── run_nvidia_gpu.bat       ← 双击启动
```

3. 双击 `run_nvidia_gpu.bat`（AMD 是 `run_amd_gpu.bat`），看到 `To see the GUI go to: http://127.0.0.1:8188` 即成功；浏览器一般会自动打开，否则手动访问。
4. **运行期间不要关那个命令行窗口**，关了 ComfyUI 就停了。
5. 启动参数（显存紧张、换 Attention 后端、改端口/监听地址、无界面运行）见《节点详解》§5.5；不同安装方式的 `models` 目录位置不同，见 §2.6 开头的表。

### 2.4 界面速查

| 区域/操作 | 说明 |
|---|---|
| 左侧边栏 | 顶部 ComfyUI 图标 = 主菜单（新建/打开/保存）；下面有**节点库**、**模板**、**资产**（已生成图片）等 |
| 顶栏 | 工作流标签页，旁边 **+** 新建空白工作流 |
| 右侧面板 | "问题"标签页会列出**缺失模型**、缺失节点、报错 |
| 右键画布 | 添加节点菜单 |
| 从输出圆点拖线到空白处松手 | 弹出节点搜索，选中即自动连好线 |
| `N` | 打开节点库搜索 |
| `R` | 重新扫描模型文件夹（放好模型后按一下） |
| `.` | 让整张工作流适应屏幕 |
| `Ctrl+Enter` | 运行 |
| 输出位置 | `ComfyUI/output/`，文件名 `ComfyUI_00001_.png` 递增；Save Image 节点可自定义前缀 |

### 2.5 文生图工作流长什么样

最简单的文生图 = **加载模型 → 编码提示词 → 空白潜空间 → 采样 → 解码 → 保存**。Anima 因为模型拆成三块，加载部分要三个节点：

```
UNETLoader (anima-base-v1.0)            ──MODEL──▶ KSampler.model
LoraLoaderModelOnly (anima-turbo-lora，可选)   串在 MODEL 与 KSampler 之间
CLIPLoader (qwen_3_06b_base)            ──CLIP──▶ CLIPTextEncode (正向) ──▶ KSampler.positive
                                          └─CLIP──▶ CLIPTextEncode (负向) ──▶ KSampler.negative
EmptyLatentImage (1024×1024)            ──LATENT──▶ KSampler.latent_image
KSampler                                ──LATENT──▶ VAEDecode.samples
VAELoader (qwen_image_vae)               ──VAE──▶ VAEDecode.vae
VAEDecode                               ──IMAGE──▶ SaveImage
```

**官方 "Anima Base v1" 模板**把上面整条管线封装成了一个 **Subgraph（子图）节点**，画布上只剩：子图节点 + 分辨率选择器 + 保存节点 + 说明便签。双击子图可以进去看/改内部节点。子图内部默认值：

- `UNETLoader`：`anima-base-v1.0.safetensors`
- `LoraLoaderModelOnly`：`anima-turbo-lora-v0.2.safetensors`（由布尔开关控制是否启用）
- `CLIPLoader`：`qwen_3_06b_base.safetensors`
- `KSampler`：seed 随机、**30 步、CFG 4、`euler`、`simple`**、denoise 1；开 Turbo 开关后变为 **8 步、CFG 1**
- 负向默认：`worst quality, low quality, score_1, score_2, score_3, blurry, jpeg artifacts, sepia`
- `EmptyLatentImage`：1024×1024，由 `ResolutionSelector` 驱动（1:1 / 竖版 / 横版）

### 2.6 跑通第一张 Anima 图（步骤）

1. **更新 ComfyUI 到最新**（Anima 需要较新的原生支持；桌面版稳定通道可能滞后，必要时切到"GitHub 最新版"）。
2. 侧栏点 **模板**，搜索 **Anima Base v1**，选择 "Anima Base v1: Text to Image"。
3. 加载后相关加载节点会**变红**，右侧面板"问题 → 缺失模型"列出文件。点每行的 **Download / Download all**（桌面版直接下到对应目录；浏览器版走浏览器下载，需自己移动），或手动从 HF 下载。
4. 把文件放到正确目录（见下表），按 `R` 刷新。
5. 在子图节点里填提示词（可先用模板自带的示例），确认分辨率为 1:1，点**运行**。
6. 图出现在 Save Image 节点和侧栏"资产 → 已生成"。

**模型文件与存放位置（放错是最常见的错误）**

```
📂 ComfyUI/models/
├── 📂 diffusion_models/
│   └── anima-base-v1.0.safetensors          (3.89 GB)   ← Aesthetic/Turbo 也放这里
├── 📂 text_encoders/
│   └── qwen_3_06b_base.safetensors          (1.11 GB)
├── 📂 vae/
│   └── qwen_image_vae.safetensors           (242 MB)    ← 就是 Qwen-Image 的 VAE
└── 📂 loras/                                              (可选)
    └── anima-turbo-lora-v0.2.safetensors     (142 MB)
```

> 📂 **`ComfyUI/models` 到底在哪，取决于安装方式**（"放错目录"的根源往往是这个）：
>
> | 安装方式 | 模型目录 | 依据 |
> |---|---|---|
> | 便携版 Portable | `ComfyUI_windows_portable\ComfyUI\models\`（即上面的目录树） | 便携包目录结构 |
> | 桌面版 Comfy Desktop（当前版） | **不在程序目录里**，而在独立的**共享目录**：Windows 默认 `%LOCALAPPDATA%\Comfy-Desktop\ComfyUI-Shared`（旧版为 `%USERPROFILE%\ComfyUI-Shared`），其下再分 `models / input / output`，多个 build 共用。构建页 → Folders 可查看/勾选共享目录；桌面版 设置 → Shared folders 可添加 | 【官方】docs.comfy.org 桌面版安装与"从 Legacy Desktop 迁移"文档 |
> | 更早的 Legacy Desktop | 数据目录（含 `models / user / input / output`）由其 `config.json` 的 `basePath` 指定，通常在 `文档\ComfyUI` | 同上 |
> | 手动安装 / git clone | `<仓库目录>\ComfyUI\models\` | 源码 `folder_paths.py` |
> | 自定义位置 | 任意目录，用 `extra_model_paths.yaml` 或启动参数 `--models-directory` / `--base-directory` 指向 | 源码 `comfy/cli_args.py` |
>
> 换机器或换安装方式时，先确认这一格，再下载模型。

> ⚠️ **不要放到 `checkpoints/`**。Anima 是拆分模型，不是 SD 那种三合一 checkpoint。
> 模型放在子文件夹（如 `diffusion_models/anima/`）时，缺失检测只看一级目录，可能仍报缺失——在加载节点里手动选中文件即可。

### 2.7 更新与自定义节点

- **便携版**：双击 `update/update_comfyui.bat`（日常用这个）。`update_comfyui_and_python_dependencies.bat` 会重装 PyTorch 等依赖，**有风险，仅在环境坏掉时用**。
- **桌面版**：管理面板 → 更新 → 选稳定版 / GitHub 最新版。
- **手动**：`git pull` 后一定要 `pip install -r requirements.txt`，否则前端、模板、节点文档会滞后，出现"找不到新模板"。
- **自定义节点**：优先用内置的 **ComfyUI Manager** 安装（自动处理依赖）。只装可信作者、常用的包；冷门插件有安全风险。
  - Anima 进阶可能用到：**RES4LYF**（提供 `beta57` 调度器，画面更有绘画质感）、**ComfyUI-Manager** 本身。
- 中国大陆网络：更新和下载 HF 可能需要代理；pip 可用清华镜像。

### 2.8 常见故障

| 现象 | 原因 | 解决 |
|---|---|---|
| 加载节点变红，提示 missing | 文件没下/放错目录 | 对照 2.6 的目录表；放好后按 `R` |
| 找不到 "Anima" 模板 | ComfyUI 或模板依赖太旧 | 更新 ComfyUI 及依赖；桌面版切到 GitHub 最新版 |
| 加载工作流提示节点缺失 | 用了含第三方节点的 workflow | 看右侧面板缺哪个节点，用 Manager 装 |
| 启动日志有 `import failed` | 自定义节点依赖缺失或与新版本不兼容 | 用 `--disable-all-custom-nodes` 排查，逐个定位 |
| 显存不足（OOM） | 分辨率/模型太大 | 降到 768×1024、用 Turbo 8 步、关掉其他占显存程序 |
| 浏览器界面错乱 | Chrome 版本太低 | 升级到 Chrome 143+ |

---

## 3. 生成参数

| 参数 | Base / Aesthetic | Turbo | 说明 |
|---|---|---|---|
| 分辨率 | 512² ~ 1536²，约 100 万像素最佳 | 同左 | 超出范围容易崩图 |
| 步数 | **30–50**（30 够用，40 出成品） | **8–12** | 步数低=快但细节少；高=边际收益递减 |
| CFG | **4–5** | **1** | Turbo 在 CFG 1 下**负面提示词基本不起作用** |
| 采样器 | 见下表 | `euler` | 采样器会明显影响画风 |
| 调度器 | `simple` 或 `sgm_uniform` | `simple` | 绘画质感可试 `beta57`（RES4LYF） |
| Seed | 固定种子才能对比变量 | 同左 | 调试时把 `randomize` 改成 `fixed` |

**推荐分辨率**

| 用途 | 尺寸 | 比例 |
|---|---|---|
| 方形头像/单人 | 1024×1024 | 1:1 |
| 竖版立绘 | 896×1152 / 832×1216 | 3:4 / ~2:3 |
| 横版场景/壁纸 | 1152×896 / 1216×832 | 4:3 |
| 高分辨率 | 1536×1024 | 3:2 |

**采样器风格（来自模型卡）**

| 采样器 | 风格 | 备注 |
|---|---|---|
| `er_sde` | 中性、平涂、线条锐利 | 模型卡推荐的"万金油默认" |
| `euler_a` | 线条更细更柔，略带 2.5D | 可以比其他采样器用更高 CFG 而不烧图 |
| `dpmpp_2m_sde_gpu` | 接近 er_sde 但更多变、更有"创意" | 有些提示词下会太放飞 |
| `euler` | 比 er_sde 略有创意 | **配 Turbo / Aesthetic 很好**（它们本身已够稳）；官方模板默认 |

**调参口诀**：一次只改一个变量、固定种子。画面过曝/色彩过艳 → 降 CFG（如 3.5）；特征缺失 → 小幅升 CFG 或改提示词；线条不喜欢 → 换采样器；细节不够 → 加步数或后期放大。

---

## 4. Anima 提示词（核心）

### 4.1 三种写法

Anima 用 **Danbooru 风格标签 + 自然语言描述 + 二者混合** 三种数据训练，所以三种都能用：

| 写法 | 优点 | 缺点 | 适合 |
|---|---|---|---|
| **纯标签** | 精确、可查 wiki、发型/姿势/表情覆盖极深 | 没有方位词（"在左边"）、数据集偏见会漏进来 | 单人、明确属性 |
| **纯自然语言** | 能写位置关系、互动、场景逻辑 | 没有标准写法可查，难排错 | 场景、多人物互动、带文字的画面 |
| **混合（推荐）** | 兼得两者 | — | 大多数情况 |

Volnovik 指南把混合写法叫 **"boorified language"**：用句子搭骨架，在 booru 有精确标签的地方嵌标签。

### 4.2 硬性书写规则（务必遵守）

1. **标签全小写，用空格代替下划线**：`long hair` ✔，`long_hair` ✘。
2. **唯一例外是评分标签**：`score_9` ~ `score_1` 保留下划线。
3. **Danbooru 与 Gelbooru 拼写不同时，用 Gelbooru 的写法**。
4. **画师名前必须加 `@`**：`@nnn yryr`。不加效果会很弱。
5. **角色名、作品名按正常英文大小写**：`Fern from Sousou no Frieren`（自然语言里也一样）。
6. **权重要给得比 SDXL 高**：`(chibi:2)` 才明显；经验是 1.5 起步、**2.0 是甜点**。
7. **逗号后统一单个空格、不要拼错**：编码器不会模糊匹配错别字。社区还发现 `"best quality"` 和 `" best quality"`（逗号后有无空格）会带来不同的风格倾向——**保持格式一致**，别混用。
8. 不要用 Markdown / JSON 之类结构包装提示词。

### 4.3 标签推荐顺序

```
[质量 / 元数据 / 年代 / 安全标签] → [1girl / 1boy / 1other 等人数] → [角色名] → [作品名] → [@画师] → [一般描述标签]
```

每一组内部顺序随意。模型训练时其实把所有内容混在一起处理，这个顺序是"软规则"，但按训练顺序写最不容易出问题，也方便自己检查。

**各类标签清单**

| 类别 | 标签 | 说明 |
|---|---|---|
| 质量（人工评分） | `masterpiece`, `best quality`, `good quality`, `normal quality`, `low quality`, `worst quality` | 可用一组、两组都用、或都不用 |
| 质量（美学评分） | `score_9` … `score_1` | 源自 PonyV7 美学模型；最多选一个 |
| 年代 | `year 2025`, `year 2024`…；`newest`, `recent`, `mid`, `early`, `old` | 引导画风年代 |
| 元数据 | `highres`, `absurdres`, `anime screenshot`, `official art`, `twitter username`… | |
| 安全 | `safe`, `sensitive`, `nsfw`, `explicit` | **正向里要写安全等级**，不想要的等级放负向 |
| 画师 | `@画师名` | 最强的风格杠杆；多个画师可混风格 |
| 人数 | `1girl`, `1boy`, `2girls`, `solo`, `no humans`… | |

**官方推荐前缀与负面**

```
正向前缀：masterpiece, best quality, score_7, safe,
负面：    worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration
```

> 负面里的 `artist name` 是 Danbooru 的元标签，意思是**"画面上出现了画师署名"**（官方定义：*The artist's name or alias is on the image somewhere*），用来避免画面里冒出签名/水印。它**和正向使用 `@画师` 不冲突**，照官方推荐保留即可，不要删。

**官方完整标签示例**

```
year 2025, newest, normal quality, score_5, highres, safe, 1girl, oomuro sakurako, yuru yuri, @nnn yryr, smile, brown hair, hat, solo, fur-trimmed gloves, open mouth, long hair, gift box, fang, skirt, red gloves, blunt bangs, gloves, one eye closed, shirt, brown eyes, santa costume, red hat, skin fang, twitter username, white background, holding bag, fur trim, simple background, brown skirt, bag, gift bag, looking at viewer, santa hat, ;d, red shirt, box, gift, fur-trimmed headwear, holding, red capelet, holding box, capelet
```

### 4.4 按版本调整提示词

| 版本 | 质量标签 | score_* | 备注 |
|---|---|---|---|
| **Base** | 建议加 `masterpiece, best quality` | 可用（`score_7`） | 想要扁平/复古/绘画感时**去掉质量标签和 highres**，默认画风本来就更朴素 |
| **Aesthetic** | 可留 `masterpiece, best quality`，不加也行 | **正负向都不要用** | 已在高质量图上精调，score 会把画面推成"AI 味" |
| **Turbo** | 同 Base 即可 | 可用 | CFG 1 时负面提示词无效，把想要的东西写进正向；种子间变化比 Base 小 |

### 4.5 自然语言提示词要点

- **至少写两句**，越具体越好；极短的句子结果不可预测。
- **写"看得见的事实"，不是写形容词**。作者的说法是"为 0.6B 的大脑写作"：用简单词、简单句，一个分句一个可见事实，代词不要有歧义。
- **多角色必须"报名字 + 说长相"**。只列一串角色名模型会混淆。

  ```
  Digital artwork of Fern from Sousou no Frieren, with long purple hair and purple eyes,
  wearing a black coat over a white dress with puffy sleeves...
  ```
- **每个细节都要和角色绑在同一句里**，重复名字没问题。
- **位置关系用自然语言写**（标签没有方位），按阅读顺序（先左到右、再上到下）描述。
- **画面内文字**：用引号写出内容即可，单词和短句可靠，长句不行。
- LLM 帮你写的长句未必适合这个模型——回头读一遍："人类标注员会这么描述这张图吗？"
- 嵌套：一层嵌套可以，**两层嵌套基本失败**（4 格漫画是例外）。

### 4.6 混合写法示例

```
masterpiece, best quality, @big chungus. An anime girl with medium-length blonde hair is...
```

```
2girls, train compartment, sunset.
The girl by the window reads a book while her friend leans over the seat
and points toward a distant town outside.
```

Volnovik 指南里的"boorified language"范例（标签嵌在句子里，全部用空格）：

```
A dutch angle shot of a girl sitting in yokozuwari on the hill. She has head tilt, blue eyes
and half updo medium black hair and pink hair multicolored hair. She is dressed in medium dress.
Her silver dress has side cutout, short sleeves. She is looking afar with her blue eyes.
She has hand on own leg, and adjusting hair. Background is scenery landscape with blue sky and cloud.
light rays, shadow,
```

**分工原则**：外观属性交给标签，空间位置与互动关系交给句子。

### 4.7 陷阱标签：这些"普通英文词"其实会定义整张图

booru 里的很多标签就是日常英文单词。你把它们当普通形容词写进句子时，模型会**悄悄套用标签含义**，整张图被"吸"到某个特定样子。写提示词前和排错时都对照一遍（来源：社区作者 Volnovik 提示词指南的蒸馏版；**注意不是模型作者**）：

| 词 | 在 Anima 里实际的效果 | 常见误写 | 应该这样写 |
|---|---|---|---|
| `high contrast` | 一种极端、色阶化的高反差风格，整张图被它定义 | 在句子里写 "high contrast" 想要"色彩鲜明" | 直接写颜色（`crimson and teal palette`）或 `red theme` 等颜色主题标签 |
| `anime` | 锚定动画截图风 | 句子里写 "anime style"（模型本来就是动漫，多写反而拉偏） | 不写；画风用 `@画师` 或具体风格标签控制 |
| `anime coloring`, `cel shading \(2d\)` | 特定的平涂赛璐璐填色 | 句子里写 "clean cel shading" | 想要这个风格就**有意**用标签，否则别提 |
| `lineart` | **只有黑线、没有上色**的线稿 | 想表达"线条干净"写了 "line art" | 不写；想要线稿才用 `lineart`（一个词） |
| `lace` | 整件衣服都是蕾丝 | 想要"领口一点蕾丝边" | 小面积用 `lace trim` |
| `wet` | 皮肤/衣物湿透反光、满是水珠 | 想表达"淋了雨" | 写 `rain`；只有确实要湿身效果才用 `wet` |
| `colorful` | 一个特定的高饱和配色标签 | "colorful background" | 写出具体颜色 |
| `anime screenshot` | 截图式构图 | 想要"电影感"写了 "cinematic" | 用构图标签：`wide shot`, `from below`, `dutch angle`… |
| `monochrome` | **黑白图** | 想表达"低饱和" → 出了灰度图 | `muted color`, `pastel colors` |
| `blurry`, `depth of field` | 特定的虚化/景深效果 | "soft focus" | 用句子说明哪里清晰、哪里虚化 |
| `censored` | 打码条 | 在正向里随手写 "keep it tasteful/censored" | **永远不要放进正向**；用安全等级标签 |
| `cosplay` | 角色**扮演另一个作品的角色** | 当作"穿服装" | 穿服装用 `costume` 或具体服装标签 |
| `1other` | 一个非人类角色 | 当成"一个人" | 人用 `1girl` / `1boy` |
| `score_N` | 每个数字都是不同的质量+风格锚点 | "保险起见多写几个" | Base 上最多一个；Aesthetic 上一个都不要 |

另：带括号的标签要转义括号，这是训练时的写法——`card \(medium\)`、`amatsukaze \(kancolle\)`。

### 4.8 进阶技巧

**① 画风控制**

- 质量标签 + `highres` = 现代高细节动漫画风；去掉 = 扁平/复古。
- `@画师` 最强；`作品名` 可以带入该作品的美术方向；年代标签调年代。
- 内置风格标签（相当于模型自带的小 LoRA）：`toon \(style\)`, `western comics \(style\)`, `1980s \(style\)`, `oil painting \(medium\)`, `watercolor \(medium\)`, `pencil \(medium\)` 等（括号要按上面的写法转义）。
- 注意：质量标签会让扁平卡通风格变得"过于干净锐利"，追那种感觉时去掉。

**② 背景总是空白？**

语料里 `simple background` 占比很高，这是最常见的翻车点。解决办法：**具体描述背景**（内容、光线、纵深），或加标签 `scenery`, `detailed background`。

**③ 多角色**

人数标签 + 每个角色"X from Series" 各占一句 + 自然语言写位置。**连带规则**：给一个角色描述了某特征（比如发色），就要给场上所有角色都描述该特征，否则特征会"串"。

**④ 角色设定图**

```
character design sheet, front and side views, expression sheet, multiple views of the same character, ...
```

**⑤ 自造"伪标签"**

booru 没收录的概念可以发明标签式短语（如 `high twintails`），Anima 对此的容忍度比 SD1.5/Pony/Illustrious 高；但别造到离谱（`85mm anime cinematic lens` 这种不行）。

**⑥ 非动漫风格：数据集标签**

想出油画、抽象、概念艺术，而不是和动漫先验较劲——在提示词**最开头**写数据集标签并换行，第二行可选标题，第三行描述：

```
deviantart
Flame
Digital painting of a fiery dragon with glowing yellow eyes, black horns, and a long, sinuous tail, perched on a glowing, molten rock formation. The background is a gradient of dark purple to orange.
```

```
ye-pop
For Sale: Others by Arun Prem
Abstract, oil painting of three faceless, blue-skinned figures. ...
```

**⑦ 不必堆全标签**——训练时做了随机标签丢弃，不需要把所有相关标签都列上；但也因此种子之间差异很大。

### 4.9 提示词排错清单

| 现象 | 先检查 |
|---|---|
| 多个种子都出同一个毛病 | 是某个标签的**数据集偏见**，不是运气——换标签或把它推进负向 |
| 画风不对 | 质量标签用法、Aesthetic 上是否误用了 `score_*`、采样器 |
| 画师风格没出来 | 是否忘了 `@`（没加效果很弱） |
| 整张图被吸成某种特定样子 | 对照 4.7 陷阱标签表，句子里是否混入了普通英文单词恰好是标签 |
| 画面上出现签名/水印/乱码文字 | 负面保留 `artist name`，可再加 `signature`, `watermark`；检查正向里是否有会被画到衣服上的普通词 |
| 某概念"不认识" | 可能只是 booru 没这个标签，试试伪标签 |
| 自然语言不生效 | 句数够不够（≥2）、是否一词多义、角色名大小写、每个细节是否绑定到角色 |
| 非动漫画面往动漫跑 | 加 `ye-pop` / `deviantart` 数据集标签头 |
| 角色画错或缺特征 | 给**所有**角色补上发型/发色/瞳色标签 |
| 背景是一片白 | 具体描述背景或加 `scenery` |
| 手崩 | 补手部细节标签（`own hands together`, `hand up` 等）；提示词解决不了的留给图生图/局部重绘 |
| 衣服上冒出无意义的英文单词 | 模型会把普通词画到空白衣物上，把那个词删掉 |

---

## 5. 进阶方向（跑通基础后再看）

| 方向 | 做法 |
|---|---|
| **LoRA** | 放 `models/loras/`，用 `LoraLoaderModelOnly` 挂在 UNETLoader 之后；强度从 0.7 起调。选标注"兼容 Anima"的版本。官方有 highres-aesthetic-boost、greg-rutkowski-style 等 |
| **结构控制** | `Comfy-Org/Anima-LLLite` 的 ControlNet（深度/线稿/姿势/涂鸦/任意），放 `models/model_patches/`；官方模板库里有 "Anima Lllite: Depth / Any Control to Image / Image Inpainting" |
| **图生图 / 局部重绘** | 构图满意但局部有问题时用；提示词解决不了的再上 |
| **放大** | 先约 1024px 定构图，再用放大模型或二次采样放大。社区经验：二次采样的基础画幅别超过 1536²、倍率别超过 1.5，否则容易糊/花；要 2K/4K 用**分块放大**（Tiled，`UltimateSDUpscale`），见《节点详解》§4.6 E 与《递进报告》L4 路线 D |
| **反推标签（看图识标签）** | 拿参考图跑 tagger（`ComfyUI-WD14-Tagger`）得到它对应的 booru 标签——学标签最快的途径，见《补充A-反推标签与实验记录》 |
| **脸/手自动修复** | `ComfyUI-Impact-Pack` 的 `FaceDetailer` / `HandDetailer`：自动检测 → 裁出放大 → 重绘 → 贴回，见《递进报告》L6 路线 E |
| **画风预览** | Anima Style Explorer（`anima.mooshieblob.com`）可在线预览画师风格 |
| **训自己的 LoRA** | 在 **Base** 上训；**不要训练 LLM adapter**（`llm_adapter_lr=0`）；rank 32 的 LoRA 学习率从 `2e-5` 起 |

---

## 6. 建议学习路径（7 天）

> 本路径已并入《ComfyUI工作流递进实现报告》§6 的 **14 天路径**，以那条为准；这里保留作**提示词专项**练习。注意 14 天路径是工作流主线、不含提示词日程，要把下面的 Day 2–4、Day 6 穿插进它的 Day 1–4（对照表见目录下 `README.md`）。

**Day 1 — 跑通环境**
装好 ComfyUI → 更新 → 用官方 "Anima Base v1" 模板 → 下载 3 个模型 → 用模板示例提示词出第一张图。目标：理解"模型放哪、运行按钮在哪、图存哪"。

**Day 2 — 纯标签 + 已知角色**
固定种子。用官方前缀 + `1girl, 角色名, 作品名, ...` 写 5 条提示词。角色/画师标签去 **ANIMADEX**（`animadex.net`）查。目标：熟悉标签顺序，体会每个标签的作用。

**Day 3 — 自然语言**
同样的画面，改写成 2–3 句英文描述（不含标签）。对比标签版。目标：感受"位置关系、动作、互动"用句子写更顺。

**Day 4 — 混合写法 + 画师**
用"标签写外貌 + 句子写场景"的混合写法；加 `@画师`，试 3 个不同画师。目标：找到 2–3 个喜欢的画风组合。

**Day 5 — 参数实验**
固定种子、固定提示词，一次只改一个：步数（20/30/40）、CFG（3.5/4/5/6）、采样器（er_sde / euler_a / euler / dpmpp_2m_sde_gpu）。目标：建一张自己的"参数对照表"。

**Day 6 — 多角色与场景**
2 人互动场景，练习"名字 + 长相 + 位置"写法和连带规则；练背景描述。目标：能稳定出一张不串特征的多人图。

**Day 7 — 成品流程**
Turbo 快速试稿 → 选定种子 → 切 Aesthetic 出成品 → 放大。尝试挂一个 LoRA。目标：形成自己的出图流程。

**练习素材建议**：同一个想法（例如"雨天电车站台的少女"）贯穿 7 天，每天换一种写法/参数，这样进步最直观。

---

## 7. 工具与资源

| 用途 | 资源 |
|---|---|
| 官方模型卡（最权威） | https://huggingface.co/circlestone-labs/Anima |
| ComfyUI 官方 Anima 教程 | https://docs.comfy.org/zh/tutorials/image/anima/anima |
| 官方工作流模板 | https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_base_v1.json（ComfyUI 模板库内直接有） |
| 官方 LoRA | https://huggingface.co/circlestone-labs/Anima-Official-LoRAs |
| ControlNet LLLite | https://huggingface.co/Comfy-Org/Anima-LLLite |
| 角色/画师标签查询 | ANIMADEX https://animadex.net ；标签预览 https://tags.latent.moe |
| 画师风格预览 | https://anima.mooshieblob.com/ |
| 标签 wiki | https://danbooru.donmai.us / https://gelbooru.com（拼写以 Gelbooru 为准） |
| ComfyUI 文档 | https://docs.comfy.org/zh（安装、界面、模板、更新、排错） |
| ComfyUI Wiki 模型页 | https://comfyui-wiki.com/zh/models/anima |
| 社区提示词指南（**Volnovik，非模型作者**） | Civitai 文章 33857《Anima Generation Guide – Part 4: Prompting》；蒸馏版 https://github.com/Volnovik/anima-prompting |
| 其他 UI 参考 | MooshieUI（ComfyUI 的新手前端）、InvokeAI、WebUI Forge Neo、KusArt（在线） |
| 反推标签（看图识标签） | ComfyUI 自定义节点 `ComfyUI-WD14-Tagger`（pythongosssss，Manager 可装；模型用 SmilingWolf 的 WD Tagger v2/v3 系列）；用法见《补充A》 |
| 脸/手自动修复 | `ComfyUI-Impact-Pack` + `ComfyUI-Impact-Subpack`（ltdrdata；两个都要装） |
| 分块放大 | `ComfyUI_UltimateSDUpscale`（ssitu，Manager 搜 `comfyui_ultimatesdupscale`） |
| 中文视频/社区 | B 站搜"ComfyUI 入门""ComfyUI 节点""Anima 教程"；官方文档本身有中文版（见上）。视频里的界面与节点版本可能已变，操作细节以官方文档与本目录笔记为准 |
| 开发者：HTTP API / 无界面批量 / 自定义节点 | 见《补充B-开发者方向-API与自定义节点》 |

---

## 8. 社区教程里的常见误区（核实后修正）

| 流传说法 | 实际情况 |
|---|---|
| "Turbo 是一个 LoRA，放 loras 目录" | **Turbo 既是独立的整模型**（`anima-turbo-v1.0/v1.1.safetensors`，放 `diffusion_models/`），**也有 LoRA 形式**（`anima-turbo-lora-v0.1/v0.2`，放 `loras/`）。两者都在官方仓库里，别混淆 |
| "InvokeAI 也只需要那 3 个文件" | InvokeAI 还会额外下一个约 9GB 的 T5 编码器 |
| "负面提示词照抄官方那一串就行" | 用 Turbo（CFG 1）时负面无效；Aesthetic 不要 `score_*`。但**不要**因为正向用了 `@画师` 就删掉负面里的 `artist name`——那是"画面上别出现署名"的元标签，两者不冲突 |
| "某些词只是普通的形容词" | `high contrast`、`monochrome`、`line art`、`wet`、`lace` 这类词在 booru 里有精确含义，写进句子会把整张图带偏（见 4.7） |
| "提示词越长越好" | 自然语言要"可见事实多"，而不是形容词多；纯标签不必堆全（训练时有标签丢弃） |
| "把 Anima 当 SDXL/Illustrious 来写（下划线标签）" | Anima 要空格；下划线标签是常见错误 |

---

## 附：第一周可直接复制的提示词模板

**A. 单人标签版（Base / Turbo）**

```
masterpiece, best quality, score_7, newest, highres, safe,
1girl, solo, long black hair, amber eyes, white sailor dress, hair ribbon, standing, looking at viewer, gentle smile, upper body, outdoors, cherry blossoms, wind, sunlight, depth of field
```

**B. 自然语言版**

```
An anime illustration of a young woman with long black hair and amber eyes, standing under a cherry tree in full bloom.
She wears a white sailor dress with a red ribbon, and petals drift around her in the wind.
Warm afternoon sunlight falls on her face, and the background is soft and out of focus.
```

**C. 混合版（标签写外貌，句子写场景）**

```
masterpiece, best quality, safe, 1girl, solo, long black hair, amber eyes, white sailor dress, red hair ribbon, gentle smile.
She stands beneath a cherry tree in full bloom, with one hand reaching out to catch a falling petal.
The late-afternoon sun lights her from the left, and the park behind her is softly blurred.
```

**D. 带画师**

```
masterpiece, best quality, safe, 1girl, solo, long black hair, amber eyes, white sailor dress, @画师名, soft lighting, detailed background, scenery
```

**负面（Base/Aesthetic，CFG 4–5 时用）**

```
worst quality, low quality, score_1, score_2, score_3, blurry, jpeg artifacts, chromatic aberration
```

> 用法：先复制 A 跑一张，固定种子，再依次换 B、C，对比差异——这就是第 2–4 天的练习。
