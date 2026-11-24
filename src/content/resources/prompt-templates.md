---
title: 提示词模板与负向
kind: 模板
order: 1
sources:
  - badge: 官方
    url: https://huggingface.co/circlestone-labs/Anima
    note: 官方推荐前缀、负面与完整标签示例
  - badge: 官方
    url: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_anima_base_v1.json
    note: 模板默认负向
  - badge: 社区
    url: https://civitai.com/articles/33857
    note: Volnovik 推荐负向（非模型作者）
verified: 2026-11-24
---

## 官方推荐前缀与负面

```
正向前缀：masterpiece, best quality, score_7, safe,
负面：    worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration
```

负面里的 `artist name` 是 Danbooru 的元标签，意思是"画面上出现了画师署名"，**和正向使用 `@画师` 不冲突**，不要删。

## 官方完整标签示例

```
year 2025, newest, normal quality, score_5, highres, safe, 1girl, oomuro sakurako, yuru yuri, @nnn yryr, smile, brown hair, hat, solo, fur-trimmed gloves, open mouth, long hair, gift box, fang, skirt, red gloves, blunt bangs, gloves, one eye closed, shirt, brown eyes, santa costume, red hat, skin fang, twitter username, white background, holding bag, fur trim, simple background, brown skirt, bag, gift bag, looking at viewer, santa hat, ;d, red shirt, box, gift, fur-trimmed headwear, holding, red capelet, holding box, capelet
```

## 第一周可直接复制的模板

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

**负面（Base / Aesthetic，CFG 4–5 时用）**

```
worst quality, low quality, score_1, score_2, score_3, blurry, jpeg artifacts, chromatic aberration
```

用法：先复制 A 跑一张，固定种子，再依次换 B、C，对比差异——这就是阶段 1 的提示词练习。

## 各来源推荐负向

| 来源 | 负向 | 适用 |
|---|---|---|
| **官方模型卡** | `worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration` | Base（CFG 4–5） |
| **ComfyUI 官方模板** | `worst quality, low quality, score_1, score_2, score_3, blurry, jpeg artifacts, sepia` | Base + Turbo LoRA（开 Turbo 后 CFG 1，负向无效） |
| Volnovik（社区） | `worst quality, low quality, score_1, score_2, score_3, artist name, jpeg artifacts, censored, signature, twins, chromatic aberration` | Base；Aesthetic 版去掉 score 项 |
| Mage 平台预置 | `worst quality, low quality, 低 score 标签, early, old, blurry, jpeg artifacts, artist name, text bubble, speech bubble, + 手部/解剖错误` | mage.space |

注意：官方两套负向**都没有** `censored`——做 NSFW 时需要自己加（见成人附录）。

## 负向逐词含义（SFW 常用）

| 负向词 | 含义 | 为什么放负向 |
|---|---|---|
| `worst quality` / `low quality` | 人工评分最低两档 | 压低质量 |
| `score_1` `score_2` `score_3` | Pony 美学评分最低档 | 压低美学分；Aesthetic 版**不用** |
| `artist name` | 画面上出现画师署名 | 避免签名 / 水印。与正向 `@画师` 不冲突 |
| `signature` / `watermark` / `logo` / `text` | 签名 / 水印 / 商标 / 文字 | 同上 |
| `blurry` | 模糊 | 避免糊图 |
| `jpeg artifacts` | JPEG 压缩伪影 | 避免压缩感 |
| `chromatic aberration` | 色差（红蓝边） | 避免镜头色差 |
| `sepia` | 棕褐色调 | 避免整体泛黄 |
| `twins` | 双胞胎 | 避免"一个人画成两个" |
| `3d` | 3D 渲染风 | 避免跑成 3D |
| `sketch` / `oekaki` | 草图 / 涂鸦板风 | 避免线稿化 |
| `flat color` | 无阴影平涂 | 避免过于扁平（追扁平风时**不要**放） |
| `monochrome` / `greyscale` | 黑白 / 灰度 | 避免灰度图（追黑白风时**不要**放） |
| `shaded face` / `blacklighting` | 脸部阴影 / 逆光黑影 | 避免脸发黑 |
| `english text` / `engrish text` 等语言文字标签 | 画面文字语言 | 放负向后拟声词会默认变成**日文** |
| `text bubble` / `speech bubble` | 文字框 / 对话框 | 画漫画时**不要**放 |
| `early` / `old` | 早期年代画风 | 强制现代画风；追复古时**不要**放 |
| `bad anatomy` / `bad hands` / `missing fingers` / `extra digits` / `fewer digits` / `artistic error` | 解剖错误 / 手崩 / 缺指 / 多指 / 少指 | 手崩时加 |
| `impossible clothes` / `impossible underwear` | 物理上不可能的衣物 | 避免穿模 |
| `pov hand` | 第一人称手 | 避免多出一只手 |
| `motion lines` | 动作线 | 避免乱加效果线 |
| `white background` | 白底 | 避免白底 |
| `nsfw` / `explicit` / `sensitive` | 其它安全等级 | **SFW 用户防越级** |
| `simple background` | 纯色背景 | **治白底** |
| `painterly` | 厚涂 | 想要动画风时避免厚涂 |
| `anime coloring` / `anime screenshot` | 赛璐璐 / 动画截图风 | 想要插画风 / 2.5D 时避免动画化 |
| `@画师` 或作品名 | 不想要的画风 | **用负向对抗画风**：指定低画力画师或不喜欢的工作室风格 |
| `backlighting` | 逆光 | 避免脸部过暗 |

## 负向使用原则

1. **第一轮不要填负向**，先看裸提示词出什么问题，再针对性加。
2. 但**先检查标准负向会不会破坏你的场景**（追黑白风却负向里有 `monochrome`）。
3. 不要堆 SDXL 时代那套一两百词的负向——Anima 对负向敏感，过大的负向会抹掉细节或引入意外偏移。
4. **Turbo / CFG 1 下负向无效**；要用负向就 NegPip（`(worst quality:-1)` 语法，ComfyUI-ppm）或 NAG（核心已有 `NAGuidance`，阶段 5 讲）。
5. 负向里也可以写自然语言。
