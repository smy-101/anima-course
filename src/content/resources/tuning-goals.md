---
title: "我想要……该调什么"
kind: 基线
order: 2
sources:
  - badge: 源码
    note: "《节点详解》§5.1，依据源码与官方教程"
verified: 2026-11-24
---

先查这张表定位方向，再用[排错速查](/troubleshooting/)看"先调 → 再调 → 不要"。低阶没调好不要碰高阶。

| 目标 | 调这里 | 课程 |
|---|---|---|
| 构图 / 人物完全换一个 | 换种子 | [L2](/lessons/02-01-l2-sweeps/) |
| 更贴合提示词 | 提高 CFG（小幅）；或把关键内容写得更靠前、加权重 | [提示词基础](/lessons/01-03-prompt-basics/) |
| 画面过饱和、线条发硬、"烧了" | 降 CFG；换调度器（karras → normal / simple）；试 `_cfg_pp` 采样器 | [排错](/troubleshooting/#oversaturated) |
| 细节更多 | 加步数；换 `dpmpp_2m_sde` / `dpmpp_3m_sde`；或放大后二次采样 | [L2](/lessons/02-01-l2-sweeps/)、[L4 放大](/lessons/03-04-l4-upscale/) |
| 更有变化 / 更梦幻 | `euler_ancestral` 等 ancestral 采样器（不收敛） | [L2](/lessons/02-01-l2-sweeps/) |
| 出图更快 | 降步数；换 Turbo 版（CFG = 1）；用基本引导器 | [L1](/lessons/01-02-l1-controllable/)、[L7](/lessons/05-01-l7-custom-sampler/) |
| 图生图保留更多原图 | 降 denoise（≤ 0.35 只补细节） | [L3](/lessons/03-01-l3-img2img/) |
| 手 / 脸崩 | 裁剪法重绘 / FaceDetailer；在放大**之前**修 | [L6](/lessons/04-03-l6-outpaint/) |
| 背景太简单 | 提示词里具体描述背景；用 LLLite 深度 / 线稿约束 | [多人、场景与排错](/lessons/02-02-prompt-multi/)、[L5](/lessons/04-01-l5-lllite/) |
| 局部重绘有接缝 | 扩大遮罩（扩展遮罩 / grow_mask_by）；羽化（仅噪波遮罩路线）；裁剪法 | [L6 重绘](/lessons/04-02-l6-inpaint/) |
| 放大后糊 / 花 | 降二次采样的 denoise；降放大倍率；分两次放大或分块放大 | [L4 放大](/lessons/03-04-l4-upscale/)、[两段与分块](/lessons/03-05-l4-large/) |
| 出图重复出现两个人 / 构图乱 | 分辨率超出模型舒适区 → 降到约 1 MP，再放大 | [L0](/lessons/01-01-l0-minimal/) |
| 画面不够大 | 扩图（外补画板 → 重绘路线 B），总尺寸约 1 MP | [L6 扩图](/lessons/04-03-l6-outpaint/) |
| 构图要照着一张参考图 | LLLite 结构控制（Canny / 深度） | [L5](/lessons/04-01-l5-lllite/) |
| 高 CFG 想不烧图 | APG；或 cfg 1.5 + CFG++ 采样器 | [L7 引导补丁](/lessons/05-02-l7-shift-guidance/) |
| 负向在 Base / Aesthetic 上不听话 | NAGuidance（需 CFG > 1） | [L7 引导补丁](/lessons/05-02-l7-shift-guidance/) |
| 调参时图混在一起 / 想自动重跑 | 文件名带变量；队列模式 Run (On Change) | [L8](/lessons/05-03-l8-compare-loop/) |

## 调试方法

1. **固定种子**再调参——否则分不清是参数的作用还是运气。
2. **一次只改一个变量**；用图像表格把结果拼起来看。
3. **用 Bypass 做减法**：效果不对时逐个 `Ctrl+B` 关掉 LoRA、补丁，定位是谁的问题。
4. **加预览节点**：在 VAE解码后接预览图像，在遮罩后接预览遮罩，随时看到中间结果。
5. **部分执行**：选中某个输出节点点蓝色三角，只跑那条分支。
6. **看日志、读 traceback**：`Ctrl+反引号` 打开底部日志；桌面版另有 设置 → 日志；便携版就是启动的那个命令行窗口。读 Python 报错：从最后一行往上读，最后一行是错误类型，上面一行是人话描述；traceback 里第一处出现 `custom_nodes/…`、`nodes.py` 或 `comfy_extras/…` 的行就是真正出错的位置。

## 速度与显存

| 手段 | 效果 |
|---|---|
| 分辨率降到约 1 MP，最后再放大 | 最有效 |
| `batch_size` = 1 | 省显存 |
| UNet加载器 `weight_dtype = fp8_e4m3fn` | 省显存，适合 8～12 GB 卡；有画质代价 |
| VAE解码（分块） | 大图解码不爆显存 |
| 蒸馏版模型（Turbo）+ CFG 1 + 基本引导器 | 步数少 + 少算一路，数倍提速 |
| 先 Turbo 试稿、定稿再换完整模型 | 官方推荐的工作节奏 |

节点侧还不够，再动启动参数（`--cpu-vae`、`--reserve-vram`、`--fp8_e4m3fn-unet`、Attention 后端等）：改的是整个进程，要重启且所有工作流一起受影响。清单见[启动参数与 Attention 后端](/resources/startup-args/)。
