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

这张表是所有级别的起点。数值随版本变化，以你的固定种子对照图为准。

| 参数 | Base | Aesthetic | Turbo（整模型或 Turbo LoRA） |
|---|---|---|---|
| 文件位置 | `diffusion_models/anima-base-v1.0` | `diffusion_models/anima-aesthetic-v1.0 / v1.0b / v1.1` | `diffusion_models/anima-turbo-v1.0 / v1.1`，或 `loras/anima-turbo-lora-v0.2` 挂在 Base 上 |
| steps | 30（够用）~ 50（成品） | 同左 | 8 ~ 12 |
| cfg | 4 ~ 5（Civitai 官方接口给的范围是 3 ~ 5） | 同左 | 1（负向提示词失效） |
| sampler / scheduler | `er_sde`（作者默认）或 `euler`（模板默认）；`euler_a` 可用更高 CFG 不烧 | `euler` 很合适 | `euler`（作者说 ER-SDE 配 Turbo LoRA 可能“太吵太糊”） |
| 质量标签 | 建议加 `masterpiece, best quality` | 可留可不留，禁用 `score_*` | 不需要（蒸馏时已烘入负向） |
| 模板默认负向 | `worst quality, low quality, score_1, score_2, score_3, blurry, jpeg artifacts, sepia` | 同左但去掉 score 项 | 无效，留空即可 |
| 分辨率 | 512² ~ 1536²，约 1 MP 最佳；宽高用 16 的倍数 | 同左 | 同左 |
| 用途 | 画师风格、训 LoRA | 出成品 | 试提示词、试构图 |

### 推荐分辨率

| 用途 | 尺寸 | 比例 |
|---|---|---|
| 方形头像 / 单人 | 1024×1024 | 1:1 |
| 竖版立绘 | 896×1152 / 832×1216 | 3:4 / ~2:3 |
| 横版场景 / 壁纸 | 1152×896 / 1216×832 | 4:3 |
| 高分辨率 | 1536×1024 | 3:2 |

分辨率选择器在 `multiple = 16` 时的完整尺寸表见课程 [L1](/lessons/01-02-l1-controllable/)。

### 采样器风格

采样器的风格差别来自模型卡：

| 采样器 | 风格 | 备注 |
|---|---|---|
| `er_sde` | 中性、平涂、线条锐利 | 模型卡推荐的“万金油默认” |
| `euler_a` | 线条更细更柔，略带 2.5D | 可以比其他采样器用更高 CFG 而不烧图 |
| `dpmpp_2m_sde_gpu` | 接近 er_sde 但更多变、更有“创意” | 有些提示词下会太放飞 |
| `euler` | 比 er_sde 略有创意 | 配 Turbo / Aesthetic 很好；官方模板默认 |

调参时一次只改一个变量，种子固定。画面过曝或色彩过艳，降 CFG（如 3.5）。特征缺失，小幅升 CFG 或改提示词。不喜欢线条，换采样器。细节不够，加步数或后期放大。

### 阶段 3–5 的起点值

这几个阶段用到的参数，起点值如下。

| 参数 | 起点 | 说明 | 课程 |
|---|---|---|---|
| 图生图 `denoise` | 0.4 ~ 0.6 细化；0.2 ~ 0.35 微调 | Anima 在 ≤ 0.35 基本只补细节不改五官 | [L3](/lessons/03-01-l3-img2img/) |
| 从 Turbo 到 Aesthetic 的潜空间精修 `denoise` | 0.35 ~ 0.5 | 越低越像 Turbo 那张（含默认风格） | [L3](/lessons/03-01-l3-img2img/) |
| LoRA 强度 | 风格 0.6 ~ 1.0；角色 1.0 起 | 先单独挂再叠加，`Ctrl+B` 看贡献 | [LoRA](/lessons/03-02-l3-lora/) |
| 放大倍率（单段） | 1024² 起 ≤ 1.5×；1536² 起约 1.3× | 更大分两段或分块 | [L4](/lessons/03-04-l4-upscale/) |
| 二次采样 `denoise` / cfg / steps | 0.35 ~ 0.45 / 4 / 20 ~ 30 | 第二段指定尺寸时 denoise 0.3 | [L4](/lessons/03-04-l4-upscale/) |
| 分块放大 | tile 1024、padding 32 ~ 64、denoise 0.3 ~ 0.5、Chess | 接缝明显就加 padding | [两段与分块](/lessons/03-05-l4-large/) |
| LLLite `strength` / `start` / `end` | 1.0 / 0 / 1.0 | 不听话 1.2 ~ 1.5；死板 0.6 ~ 0.8 | [L5](/lessons/04-01-l5-lllite/) |
| 重绘遮罩 | 扩展遮罩 8；`grow_mask_by` 6 | 有接缝就把 8 改成 16、6 改成 12；LLLite 路线不吃羽化 | [L6](/lessons/04-02-l6-inpaint/) |
| Detailer `denoise` / `guide_size` | 0.35（不够再升到 0.45）/ 512 | 在放大之前做 | [L6](/lessons/04-03-l6-outpaint/) |
| 两段采样切点 | 50%（15 / 30） | 起止步按全表索引截取 | [L7](/lessons/05-01-l7-custom-sampler/) |
| `shift` | 3.0（Anima 默认） | 对照 3 / 5 / 7；LLLite v2 权重按 3.0 训练 | [L7](/lessons/05-02-l7-shift-guidance/) |
| APG / NAG | `eta 1 / norm 5 / momentum 0`；`scale 5 / alpha 0.5 / tau 1.5` | NAG 需 CFG > 1 | [L7](/lessons/05-02-l7-shift-guidance/) |
