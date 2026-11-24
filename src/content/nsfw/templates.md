---
title: 模板：sensitive～nsfw 级
section: 模板
order: 1
sources:
  - badge: 官方
    url: https://huggingface.co/circlestone-labs/Anima
    note: "官方推荐前缀与负向"
  - badge: 社区
    url: https://dskjal.com/deeplearning/circlestone-labs-anima
    note: dskjal 示例的写法（分段、负向清单、漫画分格）
  - badge: 社区
    url: https://civitai.com/articles/33857
    note: Volnovik 示例（strap slip 等）
verified: 2026-11-24
---

> 收录范围见[词表](/nsfw/vocab-body-clothing/)：这里只放 `sensitive`～`nsfw` 级的模板，以及露骨模板的**写法要点**。每个数值 / 标签都是起点，用固定种子验证。

四段式结构、七条硬规则、`@画师` 写法与主线相同，见[提示词基础](/lessons/01-03-prompt-basics/)。成人模板只多三处：**等级标签**、**穿着 / 裸体组合标签**、**去码负向**。

## B · sensitive 级（泳装 / 高叉）

```
masterpiece, best quality, highres, sensitive, 1girl, solo, mature female, skinny, wide hips, silver hair, long hair, blue eyes, highleg bikini, skindentation, standing, contrapposto, looking at viewer, indoors, complex interior
```

负向：`worst quality, low quality, score_1, score_2, score_3, artist name, censored, jpeg artifacts, chromatic aberration, explicit, nsfw`

读法：`sensitive` 定级，负向挡掉 `explicit, nsfw` 防越级；`mature female` 明确成年；`highleg bikini` + `skindentation` 是这个等级最常见的两个标签；`censored` 进负向是官方推荐负向里没有的，见[负向](/nsfw/negative/)。

## D · 多人不传染（`and` 法 + 连带规则）

```
masterpiece, best quality, nsfw, 2girls, clothed female nude female, complex interior, photo background.

A girl with silver long hair and blue eyes wearing highleg leotard with navel cutout is standing on the left.

A girl with brown medium hair and red eyes wearing highleg leotard with cleavage cutout is standing on the right.
```

读法：`nsfw` 定级（有人裸、但不露器官）；`clothed female nude female` 一个标签交代谁穿谁裸。两个角色**各占一段**，发色、瞳色、穿着、位置都写全——漏写一项就会从另一人那里"串"过来，原理见主线的[多人与传染](/lessons/02-02-prompt-multi/)。

## E · 漫画分格（位置标签）

```
@画师, highres, absurdres, sensitive, 3koma, multiple views, doujinshi, manga, comic, sound effects, speech bubbles, 2girls, beach, sand,

A girl with brown hair wearing a bikini with covered nipples and skindentation is holding a innertube, full body on the right.

A black hair girl and a brown hair girl are facing each other, profile on the top left.

The two girls make heart hands duo on the left bottom.
```

负向：`censored, bar censor, sketch, flat color, worst quality, low quality, score_1, score_2, score_3, blurry, jpeg artifacts, sepia, watermark, logo, text, shaded face, blacklighting, english text, engrish text, chinese text, korean text`

读法：`3koma` + `multiple views` 定格式；每一格一段，用 `on the right` / `on the top left` / `on the left bottom` 写格位；同一角色在各格里发色重复写。负向里的文字类标签让拟声词默认变日文——想画中文或英文对话就别放。

## C · 双人穿衣（写法要点）

dskjal 的 explicit 级示例里，画面上两个人都穿着，等级仍按画面里最露骨的元素定为 `explicit`。可迁移的写法：

- 第一行是标签段：等级 + 人数 + 穿着 / 裸体组合标签（如 `clothed female nude male`）+ 场景，句末用句号结束。
- 随后**每个角色一段**自然语言：位置（`on the left side` / `on the right side`）、体貌、穿着、表情、视线方向、手在做什么。不想画脸的角色写 `faceless`。
- 负向用 dskjal 的完整清单：去码 + 画风 + 文字 + 解剖四组，逐词含义见[负向](/nsfw/negative/)。

## F · 露骨场景（写法要点）

- 姿势靠标签而不是长句：腿部、手部、体位各用一组专门标签，句子只补充角色特征与位置。
- 人物分段：dskjal 用 `// left` 这类注释行给自己做标记；更稳妥的做法是直接用空行分段，不依赖注释语法。
- 多人仍然遵守连带规则——每个角色的发色、瞳色都要写全。
- 负向与 C 相同，按场景去掉会误伤的项（例如场景本来就有动作线就去掉 `motion lines`）。

## 用模板前

1. 把示例里的角色特征换成自己的，等级标签按实际画面重选。
2. 负向先只保留去码与挡等级两项，出图后再按问题加。
3. `score_*` 在 Aesthetic 版上正负向都不要用，见[三版本参数基线](/resources/param-baseline/)。
