---
title: 三版本参数基线
kind: 基线
order: 1
sources:
  - badge: 官方
    url: https://huggingface.co/circlestone-labs/Anima
    note: 模型卡
  - badge: 官方
    url: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_base_v1.json
    note: 官方模板默认值
  - badge: 平台
    url: https://developer.civitai.com/orchestration/recipes/anima
    note: Civitai 开发者文档 Anima recipe（CFG 3 ~ 5、尺寸 16 倍数）
verified: 2026-11-24
---

所有级别的起点。数值随版本变化，以你的固定种子对照图为准。

| 参数 | Base | Aesthetic | Turbo（整模型或 Turbo LoRA） |
|---|---|---|---|
| 文件位置 | `diffusion_models/anima-base-v1.0` | `diffusion_models/anima-aesthetic-v1.0 / v1.0b / v1.1` | `diffusion_models/anima-turbo-v1.0 / v1.1`，或 `loras/anima-turbo-lora-v0.2` 挂在 Base 上 |
| steps | 30（够用）~ 50（成品） | 同左 | **8 ~ 12** |
| cfg | **4 ~ 5**（Civitai 官方接口给的范围是 3 ~ 5） | 同左 | **1**（负向提示词失效） |
| sampler / scheduler | `er_sde`（作者默认）或 `euler`（模板默认）；`euler_a` 可用更高 CFG 不烧 | `euler` 很合适 | `euler`（作者说 ER-SDE 配 Turbo LoRA 可能"太吵太糊"） |
| 质量标签 | 建议加 `masterpiece, best quality` | 可留可不留，**禁用 `score_*`** | 不需要（蒸馏时已烘入负向） |
| 模板默认负向 | `worst quality, low quality, score_1, score_2, score_3, blurry, jpeg artifacts, sepia` | 同左但去掉 score 项 | 无效，留空即可 |
| 分辨率 | 512² ~ 1536²，约 1 MP 最佳；**宽高用 16 的倍数** | 同左 | 同左 |
| 用途 | 画师风格、训 LoRA | 出成品 | 试提示词、试构图 |

### 推荐分辨率

| 用途 | 尺寸 | 比例 |
|---|---|---|
| 方形头像 / 单人 | 1024×1024 | 1:1 |
| 竖版立绘 | 896×1152 / 832×1216 | 3:4 / ~2:3 |
| 横版场景 / 壁纸 | 1152×896 / 1216×832 | 4:3 |
| 高分辨率 | 1536×1024 | 3:2 |

分辨率选择器在 `multiple = 16` 时的完整尺寸表见课程 [L1](/lessons/01-02-l1-controllable/)。

### 采样器风格（来自模型卡）

| 采样器 | 风格 | 备注 |
|---|---|---|
| `er_sde` | 中性、平涂、线条锐利 | 模型卡推荐的"万金油默认" |
| `euler_a` | 线条更细更柔，略带 2.5D | 可以比其他采样器用更高 CFG 而不烧图 |
| `dpmpp_2m_sde_gpu` | 接近 er_sde 但更多变、更有"创意" | 有些提示词下会太放飞 |
| `euler` | 比 er_sde 略有创意 | 配 Turbo / Aesthetic 很好；官方模板默认 |

调参口诀：一次只改一个变量、固定种子。画面过曝 / 色彩过艳 → 降 CFG（如 3.5）；特征缺失 → 小幅升 CFG 或改提示词；线条不喜欢 → 换采样器；细节不够 → 加步数或后期放大。
