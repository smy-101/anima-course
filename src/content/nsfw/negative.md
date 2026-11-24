---
title: 成人内容的负向提示词
section: 负向
order: 1
sources:
  - badge: 官方
    url: https://huggingface.co/circlestone-labs/Anima
    note: "模型卡：官方推荐负向；“通过正向和负向中使用合适的安全标签来避免不想要的内容”"
  - badge: 社区
    url: https://dskjal.com/deeplearning/circlestone-labs-anima
    note: dskjal 的负向清单（去码、画风、文字、解剖）
  - badge: 社区
    url: https://civitai.com/articles/33857
    note: Volnovik 推荐负向
verified: 2026-11-24
---

主线已经讲过[负向的使用原则](/resources/prompt-templates/)：第一轮不填、不堆长负向、Turbo / CFG 1 下无效。成人内容只多三件事：**去码、挡等级、挡跑偏**。

## 去码

| 负向词 | 含义 | 说明 |
|---|---|---|
| `censored` | 打码（马赛克、黑条、模糊、白光、遮挡物） | 去码核心。**官方两套推荐负向里都没有它**，做成人内容要自己加 |
| `bar censor` / `mosaic censoring` | 黑条 / 马赛克 | `censored` 的子标签，可单列加强 |
| `blur censor` / `light censor` / `pixel censor` | 模糊 / 白光 / 像素打码 | 同上 |

`uncensored` 要不要放正向有争议，两种立场见[安全等级与核心规则](/nsfw/safety-rules/)。

## 挡等级

正向按内容写一个等级，**其余等级放负向**，防止越级或降级：

| 正向 | 负向里加 |
|---|---|
| `sensitive` | `nsfw, explicit` |
| `nsfw` | `explicit`（必要时加 `sensitive`） |
| `explicit` | — |
| `safe`（SFW 用户） | `nsfw, explicit`（必要时加 `sensitive`） |

## 挡跑偏（dskjal 清单里与成人内容相关的项）

| 负向词 | 为什么放负向 |
|---|---|
| `upper teeth only` | 张嘴时只画上排牙——避免特定的"呆板张嘴" |
| `impossible clothes` / `impossible underwear` | 物理上不可能的衣物——避免穿模 |
| `thong` / `lowleg` / `g-string` / `bow panties` | 不想要的内裤款式，按喜好 |
| `covered navel` | 避免肚脐总被遮；要含蓄就故意留在正向 |
| `pov hand` | 避免多出一只手 |
| `white background` | 避免白底 |
| `3d` / `sketch` / `flat color` | 避免跑成 3D、线稿化、过于扁平——**追这些风格时不要放** |
| `shaded face` / `blacklighting` | 避免脸发黑 |
| `english text` / `engrish text` / `chinese text` / `korean text` | 画面文字；放负向后拟声词会默认变成日文 |
| `text bubble` / `speech bubble` | 画漫画时**不要**放 |
| `bad anatomy` / `bad hands` / `missing fingers` / `extra digits` / `fewer digits` / `artistic error` | 解剖错误——手崩时加，见主线[手崩](/troubleshooting/#bad-hands) |
| `@画师` 或作品名 | 用负向对抗画风：指定低画力画师或不喜欢的风格，dskjal 称"非常稳定" |
| `twins` | 避免"一个人画成两个"（Volnovik 推荐负向自带） |

## 原则

1. **第一轮不要填负向**，先看裸提示词出什么问题，再针对性加（Volnovik）。
2. 先检查标准负向会不会破坏你的场景（追黑白风却负向里有 `monochrome`）。
3. 不要堆一两百词的负向——Anima 对负向敏感，过大的负向会抹掉细节或引入意外偏移。
4. **Turbo / CFG 1 下负向无效**；要用负向就 NegPip（`(worst quality:-1)` 语法）或 [NAGuidance](/nodes/NAGuidance/)。
5. 负向里也可以写自然语言。

各条逐词含义在主线的[提示词模板与负向](/resources/prompt-templates/)；单个标签的卡片在[标签字典](/tags/)。
