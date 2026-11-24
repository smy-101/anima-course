---
title: 启动参数与 Attention 后端（命令行）
kind: 基线
order: 3
sources:
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/cli_args.py
    note: "全部参数、默认值与互斥关系取自 comfy/cli_args.py；同一格内的参数互斥"
  - badge: 源码
    url: https://github.com/comfyanonymous/ComfyUI/blob/master/comfy/supported_models.py
    note: "Anima 支持 bf16 / fp16 / fp32；fp16 的显存估算系数 ×1.4"
  - badge: 官方
    url: https://docs.comfy.org/en/installation/desktop
    note: 桌面版安装；启动参数在启动器的 Startup arguments
  - badge: 社区
    note: Attention 后端的"更快 / 更稳"为社区概括，以自己的固定种子对照为准
verified: 2026-11-24
---

**先用节点解决，再动启动参数。** 显存不够先降分辨率、[UNet加载器](/nodes/UNETLoader/) 选 `fp8_e4m3fn`、大图用 [VAE解码（分块）](/nodes/VAEDecodeTiled/)；这些在画布上改完立刻能对照。启动参数改的是整个进程，改完要重启，而且**所有工作流一起受影响**，适合"这台机器长期就这么跑"的场合。

排错时反过来看：出图异常（黑图、花图、颜色不对）而最近又加过参数，**先去掉参数回到默认**再查别的。

## 参数加在哪

| 安装方式 | 加在哪 | 见 |
|---|---|---|
| 便携版 | 编辑 `run_nvidia_gpu.bat`（AMD 是 `run_amd_gpu.bat`），在 `python -s main.py` 之后那一段追加 | [准备 · 安装](/lessons/00-01-setup/) |
| 桌面版 | 启动器 → 设置（齿轮）→ **Launch / Startup arguments**，保存后重启 | [准备 · 安装](/lessons/00-01-setup/) |
| 手动安装 / WSL | 直接加在 `python main.py` 后面 | [准备 · 安装](/lessons/00-01-setup/) |

参数之间用空格分隔，带值的写成 `--reserve-vram 1.5`。

## 显存

| 参数 | 说明 |
|---|---|
| `--lowvram` / `--novram` | 当前默认启用**动态显存管理**，此时 `--lowvram` 基本无效（只让文本编码器跑 CPU），`--novram` 更激进。两者都先用节点侧的办法替代 |
| `--disable-dynamic-vram` / `--enable-dynamic-vram` | 关 / 开动态显存管理。关掉后回到"按显存估算加载"，`--lowvram` 才重新有意义；除非要复现旧版本行为，一般不用动 |
| `--reserve-vram <GB>` | 给系统 / 其它程序预留显存。默认按操作系统预留一部分；桌面还在占显存、或截图工具导致 OOM 时调它 |
| `--vram-headroom <GB>` | 动态显存管理额外留出的余量，默认 0 |
| `--cpu-vae` | VAE 跑 CPU。只在 [VAE解码](/nodes/VAEDecode/) 阶段爆显存时用，慢但稳；优先试分块解码 |
| `--disable-smart-memory` | 用完就卸载到内存。更省显存、更慢 |

排错入口：[CUDA out of memory](/troubleshooting/#cuda-oom)。

## 精度（全局强制）

全局强制，等价于在每个加载节点里选精度。

| 参数 | 说明 |
|---|---|
| `--fp16-unet` / `--bf16-unet` / `--fp32-unet` / `--fp8_e4m3fn-unet` / `--fp8_e5m2-unet` | 等价于 [UNet加载器](/nodes/UNETLoader/) 的 `weight_dtype`。Anima 以 bf16 为主，日常保持默认 |
| `--fp16-vae` / `--bf16-vae` / `--fp32-vae` | 源码原话：`--fp16-vae`"可能导致黑图"。用 Anima 配套 VAE 时保持默认 |
| `--fp16-text-enc` / `--bf16-text-enc` / `--fp32-text-enc` / `--fp8_e4m3fn-text-enc` | 文本编码器精度。Qwen3-0.6B 很小，一般不需要动 |

## Attention 后端（速度 / 显存 / 画质）

| 参数 | 说明 |
|---|---|
| `--use-pytorch-cross-attention` | PyTorch 2.x 自带的注意力，**最稳**。出问题先换回它 |
| `--use-sage-attention` / `--use-flash-attention` | 更快，要先装对应扩展；装不上就别加 |
| `--use-ck-attention` | Comfy 自家后端 |
| `--use-split-cross-attention` / `--use-quad-cross-attention` | 省显存的老方案，速度慢 |
| `--disable-xformers` | 装了 xformers 但结果异常时关掉它 |
| `--force-upcast-attention` | 注意力计算强制上溢到 fp32。源码注释："如果它修好了黑图请报告"——是**黑图排查项**，不是加速项 |

黑图 / 花图先换回默认后端，见[一张全黑图](/troubleshooting/#black-image)。

## 缓存

| 参数 | 说明 |
|---|---|
| `--cache-none` | 每次全部重算。省内存、慢；排查"结果和上次不一样"时有用 |
| `--cache-classic` | 旧式（激进）缓存策略 |
| `--cache-lru N` | 最多缓存 N 个节点的结果（LRU）；N 越大越占内存 |

默认按内存压力自动决定缓存多少，一般不用改。

## 实验性加速

| 参数 | 说明 |
|---|---|
| `--fast` | 开启 fp16 累加 / fp8 矩阵乘 / cuBLAS / autotune 等优化；不带值 = 全开。源码注明"未充分测试、可能降低画质"。**出图异常先去掉它** |

## 目录

| 参数 | 说明 |
|---|---|
| `--base-directory <path>` | 把 models / custom_nodes / input / output / temp / user 一起搬到同一个根目录下 |
| `--models-directory <path>` | 只改模型目录（见[准备](/lessons/00-01-setup/)的目录表） |
| `--output-directory` / `--input-directory` | 只改输出 / 输入目录 |
| `--extra-model-paths-config <yaml> [yaml…]` | 额外模型路径，可给多个文件；多个目录共用同一批权重时用 |

目录放错是最常见的"模型缺失"，先对照[准备 · 需要哪三个文件、放在哪](/lessons/00-01-setup/)。

## 网络

| 参数 | 说明 |
|---|---|
| `--listen <IP>` | 监听地址，默认 `127.0.0.1`（只有本机能访问）；`--listen 0.0.0.0` 或不带值的 `--listen` 是局域网可访问 |
| `--port 8188` | 改端口；默认 `127.0.0.1:8188` |
| `--disable-auto-launch` | 启动后不自动开浏览器（无界面常驻用） |

## 排错与复现

| 参数 | 说明 |
|---|---|
| `--disable-all-custom-nodes` | 不加载任何自定义节点。配合 `--whitelist-custom-nodes <目录>` 逐个放回，定位是哪个包把 ComfyUI 搞坏的 |
| `--deterministic` | 尽量让结果可复现。更慢，且不保证完全一致；**同机同种子本来就一致**，跨显卡 / 跨版本才需要它 |
| `--verbose DEBUG` / `--verbose DETAIL` | 更详细的日志。`DETAIL` 会在采样第一步打印模型、采样器、步数、cfg、seed、latent 形状——写实验记录本时可直接抄 |

`import failed`、缺失节点等报错的读法见[我想要……该调什么 · 调试方法](/resources/tuning-goals/)与[排错速查](/troubleshooting/)。
